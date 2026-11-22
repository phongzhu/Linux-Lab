import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import PenguinToy from '../components/PenguinToy';
import './DashboardPage.css';

export default function DashboardPage({ units: allUnits = [], sections = [], progress, lessonCompleteCount, nextLesson, activeAttempts = [], onStartLesson, onResumeAttempt, onOpenGuide, onResetProgress, loading, error, onRetry }) {
  const carouselRef = useRef(null);
  const [sectionId, setSectionId] = useState('linux-fundamentals');
  const [trackId, setTrackId] = useState('');
  const availableSections = sections.length ? sections : allUnits.length ? [{ id: 'linux-fundamentals', title: 'Linux Fundamentals', tracks: [{ id: 'linux-fundamentals', title: 'Linux Fundamentals', units: allUnits }] }] : [];
  const selectedSection = availableSections.find((item) => item.id === sectionId) || availableSections[0];
  const selectedTracks = selectedSection?.tracks || [];
  const visibleTracks = selectedTracks;
  const activeTrackId = trackId && visibleTracks.some((track) => track.id === trackId) ? trackId : '';
  const units = visibleTracks.flatMap((track) => track.units.map((unit) => ({ ...unit, trackTitle: track.title })));
  const displayedUnits = activeTrackId ? units.filter((unit) => unit.trackId === activeTrackId) : units;
  const activeAttempt = activeAttempts[0];
  const firstLesson = displayedUnits.flatMap((unit) => unit.lessons).at(0) || allUnits.flatMap((unit) => unit.lessons).at(0);
  const featuredLesson = activeAttempt?.lesson || nextLesson || firstLesson;
  const featuredUnitIndex = units.findIndex((unit) => unit.lessons.some((lesson) => lesson.id === featuredLesson?.id));
  const [carousel, setCarousel] = useState({ index: 0, canPrevious: false, canNext: displayedUnits.length > 1 });

  const updateCarousel = useCallback(() => {
    const track = carouselRef.current;
    if (!track) return;
    const cards = Array.from(track.querySelectorAll('.unit-card'));
    const maxScroll = track.scrollWidth - track.clientWidth;
    const index = cards.reduce((closest, card, cardIndex) => {
      const distance = Math.abs(card.offsetLeft - track.scrollLeft);
      return distance < closest.distance ? { index: cardIndex, distance } : closest;
    }, { index: 0, distance: Infinity }).index;
    setCarousel({ index, canPrevious: track.scrollLeft > 2, canNext: track.scrollLeft < maxScroll - 2 });
  }, []);

  useEffect(() => { updateCarousel(); }, [updateCarousel, displayedUnits.length, sectionId, activeTrackId]);

  const moveCarousel = (direction) => {
    const track = carouselRef.current;
    const card = track?.querySelector('.unit-card');
    if (!track || !card) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 15;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: 'smooth' });
  };

  const startFeaturedLesson = () => {
    if (activeAttempt) onResumeAttempt(activeAttempt);
    else if (featuredLesson) onStartLesson(featuredLesson);
  };
  const featuredTitle = activeAttempt ? 'Pick up where you left off.' : lessonCompleteCount ? 'Ready for your next command?' : 'Ready for your first command?';
  const featuredButton = activeAttempt ? 'Resume lesson' : lessonCompleteCount ? 'Continue lesson' : 'Start lesson';
  const unitCount = loading && allUnits.length === 0 ? '—' : allUnits.length;

  return <main className="dashboard page-shell">
    <section className="next-step-banner">
      <div className="next-step-copy">
        <span className="next-step-kicker">YOUR NEXT STEP</span>
        <h1>{featuredTitle}</h1>
        <p>Build practical Linux skills, one lesson at a time.</p>
        <span className="next-step-meta">{featuredUnitIndex >= 0 ? `Unit ${String(featuredUnitIndex + 1).padStart(2, '0')}` : 'Learning path'} · {featuredLesson?.title || '15 hands-on lessons'} · {featuredLesson?.time || '3 min'}</span>
        <button className="next-step-button" onClick={startFeaturedLesson} disabled={!featuredLesson || loading}>
          {loading && !featuredLesson ? 'Loading lessons…' : featuredButton}<Icon name="arrow" size={17}/>
        </button>
      </div>
      <PenguinToy/>
      <div className="next-step-art" aria-hidden="true">
        <span className="next-step-prompt" aria-hidden="true">&gt;_</span>
        <span className="next-step-command" aria-hidden="true"><b>$</b> hello, linux</span>
        <i className="next-step-spark spark-a">＋</i><i className="next-step-spark spark-b">＋</i>
      </div>
    </section>

    <div className="dashboard-overview-row">
      <section className="dashboard-metrics" aria-label="Learning statistics">
        <div className="dashboard-metric"><span className="metric-icon"><Icon name="bookOpen" size={19}/></span><span className="metric-copy"><small>Lessons completed</small><strong>{lessonCompleteCount}<span> / {allUnits.flatMap((unit) => unit.lessons).length || 15}</span></strong></span></div>
        <div className="dashboard-metric"><span className="metric-icon"><Icon name="bolt" size={19}/></span><span className="metric-copy"><small>XP earned</small><strong>{progress.xp} XP</strong></span></div>
        <div className="dashboard-metric"><span className="metric-icon"><Icon name="terminal" size={19}/></span><span className="metric-copy"><small>Learning units</small><strong>{unitCount}</strong></span></div>
      </section>
      {availableSections.length > 1 && <label className="course-section-select"><span className="sr-only">Learning section</span><select aria-label="Learning section" value={selectedSection.id} onChange={(event) => { setSectionId(event.target.value); setTrackId(''); if (carouselRef.current) carouselRef.current.scrollLeft = 0; }}>
        {availableSections.map((section) => {
          const sectionLessons = section.tracks.flatMap((track) => track.units.flatMap((unit) => unit.lessons));
          const sectionDone = sectionLessons.filter((item) => progress.completedLessons.includes(item.id)).length;
          return <option key={section.id} value={section.id}>{section.title} · {sectionDone}/{sectionLessons.length} complete</option>;
        })}
      </select></label>}
    </div>

    {error && <div className="dashboard-error" role="alert"><span>{error}</span><button onClick={onRetry}>Retry</button></div>}

    <div className="path-heading">
      <div className="path-heading-main">
        <div className="path-heading-copy"><div className="eyebrow">THE LEARNING PATH</div><h2>Build your skills, one step at a time</h2></div>
        {selectedTracks.length > 1 && <label className="track-select">
        <span className="sr-only">Practice track</span>
        <select aria-label="Practice track" value={activeTrackId} onChange={(event) => { setTrackId(event.target.value); if (carouselRef.current) carouselRef.current.scrollLeft = 0; }}>
          <option value="">All tracks</option>
          {selectedTracks.map((track) => {
            const trackLessons = track.units.flatMap((unit) => unit.lessons);
            const trackDone = trackLessons.filter((item) => progress.completedLessons.includes(item.id)).length;
            return <option key={track.id} value={track.id}>{track.title} {trackDone}/{trackLessons.length} · {track.units.length} units</option>;
          })}
        </select>
        </label>}
      </div>
      <div className="path-controls">
        <span className="carousel-position">{String(Math.min(carousel.index + 1, Math.max(displayedUnits.length, 1))).padStart(2, '0')} <i>/</i> {String(displayedUnits.length).padStart(2, '0')}</span>
        <button className="carousel-arrow" onClick={() => moveCarousel(-1)} disabled={!carousel.canPrevious} aria-label="Previous learning unit"><Icon name="arrow" size={16}/></button>
        <button className="carousel-arrow" onClick={() => moveCarousel(1)} disabled={!carousel.canNext} aria-label="Next learning unit"><Icon name="arrow" size={16}/></button>
        <button className="reset-link" onClick={onResetProgress}><Icon name="reset" size={15}/> Reset progress</button>
      </div>
    </div>
    {loading && <p className="dashboard-loading" role="status"><span className="dashboard-loading-spinner" aria-hidden="true"/>Loading your learning path…</p>}
    {!loading && displayedUnits.length === 0 && !error && <div className="empty-state">Your learning path is getting ready. Try reloading in a moment.</div>}
    <div className="unit-grid" ref={carouselRef} onScroll={updateCarousel} role="region" aria-roledescription="carousel" aria-label="Learning units" tabIndex={0}>
      {displayedUnits.map((unit, unitIndex) => {
        const completedInUnit = unit.lessons.filter((item) => progress.completedLessons.includes(item.id)).length;
        const relativePosition = unitIndex - carousel.index;
        const carouselPosition = relativePosition === 0 ? 'left' : relativePosition === 1 ? 'center' : relativePosition === 2 ? 'right' : 'offscreen';
        return <section className={`unit-card unit-${unit.color}`} data-carousel-position={carouselPosition} key={unit.id || unit.title} style={{ '--unit-index': unitIndex }}>
          <div className="unit-head"><span className="unit-number">{(unit.trackId || 'linux-fundamentals') === 'linux-fundamentals' ? `0${unit.number || unitIndex + 1}` : (unit.id || '').split('-').at(-1)}</span><span className="unit-count">{completedInUnit}/{unit.lessons.length} done</span></div>
          <h3>{unit.title}</h3><p className="unit-subtitle">{unit.subtitle}</p>
          <div className="unit-progress"><span style={{ width: `${unit.lessons.length ? completedInUnit / unit.lessons.length * 100 : 0}%` }}/></div>
          <div className="lesson-list">
            {unit.lessons.map((item) => {
              const done = progress.completedLessons.includes(item.id);
              const inProgress = item.implementationStatus === 'preview';
              return <button key={item.id} className={"lesson-row " + (done ? 'done' : '')} onClick={() => onStartLesson(item)} aria-label={item.title + (inProgress ? ' (workspace in progress)' : '')}>
                <span className="lesson-status">{done ? <Icon name="check" size={15}/> : <span className="lesson-play">▶</span>}</span>
                <span className="lesson-title">{item.title}<small>{item.time} · {item.objectives.length} tasks</small></span>
                {inProgress && <span className="lesson-progress-label">Workspace in progress</span>}
                {!done && <Icon name="arrow" size={15}/>}
              </button>;
            })}
          </div>
        </section>;
      })}
    </div>
  </main>;
}
