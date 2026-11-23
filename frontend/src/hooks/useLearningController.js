import { useCallback, useEffect, useMemo, useState } from 'react';
import { learningApi } from '../services/learningApi';

const emptyProgress = { completedLessons: [], xp: 0, streak: 0, lastLearningDay: null, timezone: 'Asia/Manila', activity: [] };

export default function useLearningController(userId) {
  const [units, setUnits] = useState([]);
  const [sections, setSections] = useState([]);
  const [progress, setProgress] = useState(emptyProgress);
  const [activeAttempts, setActiveAttempts] = useState([]);
  const [page, setPage] = useState('dashboard');
  const [lesson, setLesson] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [results, setResults] = useState(null);
  const [showReference, setShowReference] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestError, setRequestError] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError('');
    try {
      const [unitData, progressData, activeData] = await Promise.all([learningApi.units(), learningApi.progress(), learningApi.activeAttempts()]);
      setUnits(unitData.units);
      setSections(unitData.sections || []);
      setProgress(progressData.progress);
      setActiveAttempts(activeData.attempts);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const orderedLessons = useMemo(() => units.flatMap((unit) => unit.lessons || []), [units]);
  const completedCount = progress.completedLessons.length;
  const nextLesson = orderedLessons.find((item) => !progress.completedLessons.includes(item.id));

  const startLesson = useCallback(async (summary) => {
    setBusy(true); setError(''); setRequestError('');
    try {
      const result = await learningApi.startAttempt(summary.id, Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila');
      setLesson(result.lesson); setAttempt(result.attempt); setResults(null); setPage('lesson'); setShowReference(false);
      await loadDashboard();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, [loadDashboard]);

  const resumeAttempt = useCallback(async (summary) => {
    setBusy(true); setError('');
    try {
      const result = await learningApi.attempt(summary.id);
      setLesson(result.lesson); setAttempt(result.attempt); setPage('lesson'); setResults(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, []);

  const runCommand = useCallback(async (command) => {
    if (!attempt) return;
    setBusy(true); setRequestError('');
    try {
      const result = await learningApi.command(attempt.id, command);
      setAttempt(result.attempt);
      if (result.progress) setProgress((old) => ({ ...old, ...result.progress }));
      if (result.lessonComplete) {
        setResults({ lesson, earned: result.awardedXp, replay: result.awardedXp === 0 });
        setPage('results');
        await loadDashboard();
      }
    } catch (requestError) { setRequestError(requestError.message); }
    finally { setBusy(false); }
  }, [attempt, lesson, loadDashboard]);

  const restartLesson = useCallback(async () => {
    if (!attempt) return;
    setBusy(true); setRequestError('');
    try { const result = await learningApi.restart(attempt.id); setAttempt(result.attempt); setLesson(result.lesson); }
    catch (requestError) { setRequestError(requestError.message); }
    finally { setBusy(false); }
  }, [attempt]);

  const resetProgress = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const result = await learningApi.resetProgress();
      setProgress(result.progress); setActiveAttempts([]); setLesson(null); setAttempt(null); setResults(null); setPage('dashboard'); setResetOpen(false);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, []);

  const returnToDashboard = () => { setPage('dashboard'); setLesson(null); setAttempt(null); setResults(null); loadDashboard(); };
  const continueAfterResults = () => {
    const next = orderedLessons.find((item) => item.number > results.lesson.number);
    if (next) startLesson(next);
    else returnToDashboard();
  };

  return {
    state: { units, sections, progress, activeAttempts, page, lesson, attempt, results, showReference, resetOpen, loading, busy, error, requestError, completedCount, nextLesson },
    actions: {
      startLesson, resumeAttempt, runCommand, restartLesson, continueAfterResults, returnToDashboard, resetProgress, retry: loadDashboard,
      openReference: () => setShowReference(true), closeReference: () => setShowReference(false),
      openAlbum: () => setPage('album'),
      openTerminal: () => setPage('terminal'),
      openKiosk: () => setPage('kiosk'),
      openReset: () => setResetOpen(true), closeReset: () => setResetOpen(false),
    },
  };
}
