import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import './CommandGuidePage.css';

const commands = [
  ['pwd', 'Show the current directory', 'pwd'], ['ls', 'List files and folders', 'ls -a'],
  ['cd', 'Move to another folder', 'cd /var/log'], ['cat', 'Read a text file', 'cat app.log'],
  ['find', 'Search by name or path', 'find /var/log -name app.log'], ['grep', 'Find matching lines', 'grep ERROR app.log'],
  ['head / tail', 'Read the start or end', 'tail -n 5 app.log'], ['wc', 'Count lines, words, bytes', 'wc -l app.log'],
  ['sort / uniq', 'Order or collapse repeats', 'sort events.txt | uniq'], ['cp / mv', 'Copy or move a file', 'cp app.log backup/'],
  ['ps / top', 'Inspect running processes', 'ps aux'], ['df / free', 'Check disk and memory', 'df -h · free -h'],
  ['systemctl', 'Check a service', 'systemctl status training-app'], ['journalctl', 'Read system logs', 'journalctl -n 10'],
  ['curl', 'Fetch simulated training data', 'curl -o health.json https://api.training.local/health'], ['Pipes / >', 'Connect commands or save output', 'cat app.log | grep ERROR'],
];

export default function CommandGuidePage({ onClose }) {
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const closingRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const closeGuide = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (reducedMotion) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, 700);
  };

  return <div className={`modal-backdrop guide-backdrop${closing ? ' is-closing' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeGuide(); }}>
    <section className={`guide-modal${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="guide-head"><div><div className="eyebrow">QUICK REFERENCE</div><h2 id="guide-title">Command guide</h2><p>Small tools for exploring your training machine.</p></div><button className="modal-close" aria-label="Close command guide" onClick={closeGuide}><Icon name="close"/></button></div>
      <div className="guide-scroll" tabIndex={0} aria-label="Command reference notes">
        <div className="command-grid">{commands.map(([name, description, example]) => <article className="command-reference" key={name}><b>{name}</b><p>{description}</p><code>{example}</code></article>)}</div>
        <div className="guide-footer">Training shell supports a focused set of commands and options. Unsupported commands return a clear explanation.</div>
      </div>
    </section>
    <svg className="crumple-ball" viewBox="0 0 240 220" aria-hidden="true">
      <defs>
        <radialGradient id="paper-base" cx="35%" cy="27%" r="78%"><stop offset="0" stopColor="#fffefa"/><stop offset=".42" stopColor="#e8e7e2"/><stop offset=".78" stopColor="#c9c9c7"/><stop offset="1" stopColor="#8d9694"/></radialGradient>
        <linearGradient id="paper-fold-light" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".52" stopColor="#f2f1ed"/><stop offset="1" stopColor="#b8bfbd"/></linearGradient>
        <linearGradient id="paper-fold-shadow" x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#8e9997"/><stop offset=".48" stopColor="#d0d2ce"/><stop offset="1" stopColor="#f8f7f2"/></linearGradient>
        <filter id="paper-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/><feOffset dy="7"/><feComponentTransfer><feFuncA type="linear" slope=".28"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id="paper-edge"><path d="M115 13 139 23l21-9 15 20 25 5 4 25 19 18-9 25 10 22-19 19-1 25-23 10-14 22-26-4-22 15-20-16-25 3-12-22-23-8-2-26-18-17 10-25-7-23 20-17 5-24 25-7 15-21 25 8Z"/></clipPath>
      </defs>
      <ellipse cx="121" cy="196" rx="65" ry="10" fill="#142a2e" opacity=".17"/>
      <g filter="url(#paper-shadow)">
        <path d="M115 13 139 23l21-9 15 20 25 5 4 25 19 18-9 25 10 22-19 19-1 25-23 10-14 22-26-4-22 15-20-16-25 3-12-22-23-8-2-26-18-17 10-25-7-23 20-17 5-24 25-7 15-21 25 8Z" fill="url(#paper-base)" stroke="#f8f8f3" strokeWidth="2"/>
        <g clipPath="url(#paper-edge)">
          <path d="m46 66 43 11 25-58 12 55-45 31-36-12Z" fill="url(#paper-fold-light)"/>
          <path d="m114 19 25 4-4 52-22-16Z" fill="#fff" opacity=".88"/>
          <path d="m139 23 42 11-20 35-26 6Z" fill="url(#paper-fold-shadow)"/>
          <path d="m181 34 32 30-47 7 15-37Z" fill="#f8f7f2"/>
          <path d="m89 77 46-8-9 48-48-6Z" fill="#b2bab7"/>
          <path d="m135 69 26 0 14 44-48 4Z" fill="url(#paper-fold-light)"/>
          <path d="m166 71 47-7-13 41-35 8Z" fill="url(#paper-fold-shadow)"/>
          <path d="m78 111 48 6-25 44-36-25Z" fill="#f8f8f5"/>
          <path d="m126 117 49-4-22 49-52-1Z" fill="url(#paper-fold-shadow)"/>
          <path d="m175 113 25-8 23 25-46 32Z" fill="#fbfaf7"/>
          <path d="m65 136 36 25-9 33-25-21Z" fill="url(#paper-fold-shadow)"/>
          <path d="m101 161 52 1 22 24-44 15-28-12Z" fill="#fffefa"/>
          <path d="m153 162 47-32-1 32-23 25-23-1Z" fill="#aab3b0"/>
          <path d="m89 77 25-58m12 52 9-2 26 2m-76 45 41 1m8 0 48-4m-72 48 20-44m5 45 22 0m25-49 23 25m-98 25-10 33m61-33 23 24" fill="none" stroke="#7f8c89" strokeOpacity=".55" strokeWidth="2"/>
          <path d="m49 65 40 12 25-58m22 4-4 52m42-41-20 37m-27-2 26 0 14 44m-87-2 47 4-25 44m25-43 49-4m-74 47 51 1" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="3"/>
        </g>
      </g>
    </svg>
  </div>;
}
