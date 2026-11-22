import Icon from './Icon';

export default function TopBar({ page, user, onDashboard, onOpenGuide, onOpenAlbum, onOpenTerminal, onLogout }) {
  return <header className="topbar">
    <button className="brand" onClick={onDashboard}><span className="brand-mark"><img className="brand-logo" src="/logo-page.png" alt=""/></span><span>linux<span className="brand-accent">lab</span></span></button>
    <nav aria-label="Main navigation"><button className={page === 'dashboard' ? 'nav-link active' : 'nav-link'} onClick={onDashboard}><Icon name="terminal" size={17}/> Learning path</button><button className={page === 'terminal' ? 'nav-link active' : 'nav-link'} onClick={onOpenTerminal}><Icon name="terminal" size={17}/> Terminal</button><button className="nav-link" onClick={onOpenGuide}><Icon name="book" size={17}/> Command guide</button><button className={page === 'album' ? 'nav-link active' : 'nav-link'} onClick={onOpenAlbum}><Icon name="bookOpen" size={17}/> Album</button></nav>
    <button className="avatar" aria-label={`Sign out ${user?.email || 'learner'}`} onClick={onLogout}>L</button>
  </header>;
}
