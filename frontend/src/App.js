import TopBar from './components/TopBar';
import ResetProgressDialog from './components/ResetProgressDialog';
import CommandGuidePage from './pages/CommandGuidePage';
import DashboardPage from './pages/DashboardPage';
import LessonPage from './pages/LessonPage';
import ResultsPage from './pages/ResultsPage';
import AuthPage from './pages/AuthPage';
import AuthLoadingScreen from './components/AuthLoadingScreen';
import AlbumPage from './pages/AlbumPage';
import TerminalPage from './pages/TerminalPage';
import useLearningController from './hooks/useLearningController';
import { useAuth } from './context/AuthContext';
import './styles/global.css';
import './styles/responsive.css';

export default function App() {
  const auth = useAuth();
  const { state, actions } = useLearningController(auth.user?.id);

  if (auth.loading) return <AuthLoadingScreen/>;
  if (!auth.user) return <AuthPage/>;

  return <div className={`app-root ${state.page === 'dashboard' ? 'dashboard-shell' : state.page === 'lesson' ? 'lesson-shell' : state.page === 'album' ? 'album-shell' : state.page === 'terminal' ? 'terminal-shell' : ''}`}>
    <TopBar page={state.page} user={auth.user} onDashboard={actions.returnToDashboard} onOpenGuide={actions.openReference} onOpenAlbum={actions.openAlbum} onOpenTerminal={actions.openTerminal} onLogout={auth.logout}/>
    {state.page === 'dashboard' && <DashboardPage units={state.units} sections={state.sections} progress={state.progress} lessonCompleteCount={state.completedCount} nextLesson={state.nextLesson} activeAttempts={state.activeAttempts} onStartLesson={actions.startLesson} onResumeAttempt={actions.resumeAttempt} onOpenGuide={actions.openReference} onResetProgress={actions.openReset} loading={state.loading} error={state.error} onRetry={actions.retry}/>}
    {state.page === 'lesson' && state.lesson && state.attempt && <LessonPage lesson={state.lesson} attempt={state.attempt} busy={state.busy} requestError={state.requestError} onCommand={actions.runCommand} onBack={actions.returnToDashboard} onRestart={actions.restartLesson}/>}
    {state.page === 'results' && state.results && <ResultsPage results={state.results} onNext={actions.continueAfterResults} onDashboard={actions.returnToDashboard}/>}
    {state.page === 'album' && <AlbumPage/>}
    {state.page === 'terminal' && <TerminalPage/>}
    <footer className="site-footer"><div className="site-footer-inner"><span className="site-footer-brand">linux<span>lab</span></span><span>© 2026 LinuxLab</span></div></footer>
    {state.showReference && <CommandGuidePage onClose={actions.closeReference}/>}
    {state.resetOpen && <ResetProgressDialog onCancel={actions.closeReset} onConfirm={actions.resetProgress}/>}
    <div className="sr-only" aria-live="polite">{state.completedCount} of {state.units.reduce((total, unit) => total + unit.lessons.length, 0) || 15} lessons complete</div>
  </div>;
}
