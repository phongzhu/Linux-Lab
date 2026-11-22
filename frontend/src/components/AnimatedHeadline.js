import { useEffect, useState } from 'react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import styles from './AnimatedHeadline.module.css';

const phrases = [
  'Explore the terminal.',
  'Analyze application logs.',
  'Monitor your systems.',
  'Solve real scenarios.',
];

export default function AnimatedHeadline() {
  const reducedMotion = usePrefersReducedMotion();
  const [activePhrase, setActivePhrase] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setActivePhrase(0);
      return undefined;
    }

    let timerId = null;
    const scheduleNext = () => {
      if (document.visibilityState === 'hidden') return;
      timerId = window.setTimeout(() => {
        setActivePhrase((current) => (current + 1) % phrases.length);
        scheduleNext();
      }, 3000);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timerId);
        timerId = null;
      } else if (timerId === null) {
        scheduleNext();
      }
    };

    scheduleNext();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reducedMotion]);

  return <div className={styles.headline}>
    <h1 className={styles.phraseSlot} aria-hidden="true">
      <span key={activePhrase} className={styles.phrase}>{phrases[activePhrase]}</span>
    </h1>
    <p>Build practical terminal skills through guided lessons and realistic training scenarios.</p>
    <span className={styles.srOnly}>Explore the terminal. Analyze application logs. Monitor your systems. Solve real scenarios.</span>
  </div>;
}
