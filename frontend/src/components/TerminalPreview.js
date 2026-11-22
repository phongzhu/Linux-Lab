import { useEffect, useState } from 'react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import styles from './TerminalPreview.module.css';

const demonstration = [
  { command: 'pwd', output: '/home/learner' },
  { command: 'ls', output: 'app.log  config.json  reports' },
  { command: 'grep "ERROR" app.log', output: '[ERROR] Training service unavailable' },
];

export default function TerminalPreview() {
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [entries, setEntries] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    let timerId = null;
    let cancelled = false;
    const schedule = (callback, delay) => {
      timerId = window.setTimeout(() => { if (!cancelled) callback(); }, delay);
    };

    if (reducedMotion) {
      setEntries(demonstration);
      setCurrentCommand('');
      return () => { cancelled = true; window.clearTimeout(timerId); };
    }

    setEntries([]);
    setCurrentCommand('');

    const typeCommand = (stepIndex, charIndex = 0) => {
      const step = demonstration[stepIndex];
      setCurrentCommand(step.command.slice(0, charIndex));
      if (charIndex < step.command.length) {
        schedule(() => typeCommand(stepIndex, charIndex + 1), 48);
        return;
      }
      schedule(() => {
        setEntries((current) => [...current, step]);
        setCurrentCommand('');
        if (stepIndex < demonstration.length - 1) schedule(() => typeCommand(stepIndex + 1), 650);
        else schedule(() => { setEntries([]); typeCommand(0); }, 2800);
      }, 500);
    };

    typeCommand(0);
    return () => { cancelled = true; window.clearTimeout(timerId); };
  }, [visible, reducedMotion]);

  return <section className={styles.preview} aria-label="Training preview">
    <div className={styles.window} aria-hidden="true">
      <div className={styles.titlebar}>
        <div className={styles.controls}><i/><i/><i/></div>
        <span className={styles.windowTitle}>learner@linuxlab: ~/home</span>
        <span className={styles.titleSpacer}/>
      </div>
      <div className={styles.terminalBody}>
        {entries.map((entry, index) => <div className={styles.commandBlock} key={`${entry.command}-${index}`}>
          <div className={styles.commandLine}><span className={styles.prompt}>$</span> {entry.command}</div>
          <div className={styles.outputLine}>{entry.output}</div>
        </div>)}
        <div className={styles.commandLine}><span className={styles.prompt}>$</span> {currentCommand}<span className={styles.cursor}/></div>
      </div>
    </div>
    <span className={styles.srOnly}>Training preview, demonstration only. $ pwd, /home/learner. $ ls, app.log, config.json, reports. $ grep ERROR app.log, Error: Training service unavailable.</span>
  </section>;
}
