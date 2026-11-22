import Icon from '../components/Icon';
import './ResultsPage.css';

export default function ResultsPage({ results, onNext, onDashboard }) {
  return <main className="results-page page-shell">
    <div className="results-card">
      <div className="results-confetti">✦</div>
      <div className="results-badge"><Icon name="check" size={28}/></div>
      <div className="eyebrow">LESSON COMPLETE</div>
      <h1>{results.replay ? 'Nicely done. Again.' : 'You did it!'}</h1>
      <p className="results-subtitle">You finished <b>{results.lesson.title}</b>. Every command you used ran in the safe training sandbox.</p>
      <div className="xp-earned"><Icon name="bolt" size={22}/><strong>+{results.earned} XP</strong><span>{results.replay ? 'Replay completed' : 'Added to your progress'}</span></div>
      <div className="recap-box">
        <h2>Commands you practiced</h2>
        <div className="recap-list">{results.lesson.recap.map((item) => <div key={item}><span><Icon name="check" size={14}/></span>{item}</div>)}</div>
      </div>
      <div className="results-actions"><button className="primary-button" onClick={onNext}>{results.lesson.number < 15 ? 'Next lesson' : 'Back to learning path'} <Icon name="arrow" size={18}/></button><button className="text-button" onClick={onDashboard}>Learning path</button></div>
    </div>
  </main>;
}
