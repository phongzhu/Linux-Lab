import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import Terminal from '../components/Terminal';
import WorkspaceLoadingIllustration from '../components/WorkspaceLoadingIllustration';
import { terminalApi } from '../services/terminalApi';
import './TerminalPage.css';

export default function TerminalPage() {
  const [attempt, setAttempt] = useState(null);
  const [bootProgress, setBootProgress] = useState(0);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/home/learner');
  const [selectedFile, setSelectedFile] = useState(null);
  const [visibleFileLimit, setVisibleFileLimit] = useState(100);
  const [query, setQuery] = useState('');
  const [createKind, setCreateKind] = useState('');
  const [newEntryName, setNewEntryName] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [openApps, setOpenApps] = useState({ files: true, terminal: false, settings: false });
  const [settingsTab, setSettingsTab] = useState('System');
  const [desktopTheme, setDesktopTheme] = useState('Light');
  const [selectedLogin, setSelectedLogin] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherQuery, setLauncherQuery] = useState('');
  const [computerRebooting, setComputerRebooting] = useState(false);

  useEffect(() => {
    let active = true;
    terminalApi.workspace().then((result) => {
      if (!active) return;
      setAttempt({ id: 'free-exploration', state: result.workspace.state, commands: result.workspace.commands });
      setFiles(result.files);
      setCurrentPath(`/home/${result.workspace.state.user || 'learner'}`);
    }).catch((error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (attempt?.state?.interactivePrompt?.operation === 'login') {
      setSelectedLogin(attempt.state.interactivePrompt.username);
    }
  }, [attempt]);

  useEffect(() => {
    if (!attempt?.state?.initialSetup) { setBootProgress(100); return undefined; }
    setBootProgress(0);
    const timer = setInterval(() => setBootProgress((progress) => Math.min(100, progress + 4)), 55);
    return () => clearInterval(timer);
  }, [attempt?.state?.initialSetup]);

  const filteredFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return files.filter((file) => file.path.slice(0, file.path.lastIndexOf('/')) === currentPath && (!normalized || file.name.toLowerCase().includes(normalized)))
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'dir' ? -1 : 1;
        if (sortBy === 'size') return (left.size || 0) - (right.size || 0) || left.name.localeCompare(right.name);
        if (sortBy === 'type') return (left.extension || '').localeCompare(right.extension || '') || left.name.localeCompare(right.name);
        return left.name.localeCompare(right.name);
      });
  }, [files, currentPath, query, sortBy]);
  const visibleFiles = filteredFiles.slice(0, visibleFileLimit);

  useEffect(() => { setVisibleFileLimit(100); }, [currentPath, query, sortBy]);

  const runCommand = async (command) => {
    setBusy(true);
    setRequestError('');
    try {
      const result = await terminalApi.command(command);
      const setupActivated = Boolean(attempt?.state?.initialSetup && result.state.loginScreen && !result.state.initialSetup);
      const previousUser = attempt?.state?.user || 'learner';
      const previousLoggedIn = attempt?.state?.loggedIn;
      const nextState = { ...result.state };
      if (!Object.hasOwn(result.state, 'files')) nextState.files = attempt?.state?.files || {};
      setAttempt({ id: 'free-exploration', state: nextState, commands: result.commands });
      if (Array.isArray(result.files)) {
        setFiles((current) => current.length === result.files.length && current.every((file, index) => {
          const next = result.files[index];
          return file.path === next.path && file.type === next.type && file.size === next.size && file.modifiedAt === next.modifiedAt;
        }) ? current : result.files);
      }
      if (result.state.user !== previousUser) setCurrentPath(`/home/${result.state.user}`);
      if (result.state.loginScreen || result.state.user !== previousUser || result.state.loggedIn !== previousLoggedIn) {
        setSelectedFile(null);
        setQuery('');
      }
      if (setupActivated) {
        setSelectedLogin('');
        setLoginPassword('');
        setLoginError('');
        setComputerRebooting(true);
        window.setTimeout(() => setComputerRebooting(false), 900);
      }
      return result;
    } catch (error) {
      setRequestError(error.message);
      return null;
    } finally { setBusy(false); }
  };

  const openApp = (name) => setOpenApps((current) => ({ ...current, [name]: true }));
  const closeApp = (name) => setOpenApps((current) => ({ ...current, [name]: false }));
  const launchApp = (name) => {
    openApp(name);
    setLauncherOpen(false);
    setLauncherQuery('');
  };
  const selectLoginAccount = async (username) => {
    setSelectedLogin(username);
    setLoginError('');
    setLoginNotice('');
    const result = await runCommand(username);
    if (!result || result.entry.exitCode !== 0) {
      setSelectedLogin('');
      setLoginError('That account could not be selected. Choose an account and try again.');
    }
  };
  const submitLogin = async (event) => {
    event.preventDefault();
    if (!selectedLogin || !loginPassword || busy) return;
    const settingInitialPassword = attempt?.state?.interactivePrompt?.operation === 'initial-password';
    const result = await runCommand(loginPassword);
    setLoginPassword('');
    if (settingInitialPassword) {
      if (!result) return;
      if (result.state.interactivePrompt?.operation === 'initial-password') {
        setLoginError(result.entry.exitCode === 0 ? '' : result.entry.stderr || result.entry.stdout || 'Check the password and try again.');
        return;
      }
      if (result.entry.exitCode === 0) {
        setLoginNotice('');
        setSelectedLogin('');
      } else {
        setSelectedLogin('');
        setLoginError('The password could not be set. Please try again.');
      }
      return;
    }
    if (!result || !result.state.loggedIn) {
      setLoginError(result?.entry?.stderr || result?.entry?.stdout || 'Incorrect password. Try again, or choose Back to select another account.');
    } else {
      setCurrentPath(`/home/${selectedLogin}`);
      setSelectedLogin('');
      setOpenApps({ files: true, terminal: false, settings: false });
    }
  };

  const homePath = `/home/${attempt?.state?.user || 'learner'}`;
  const breadcrumbs = currentPath === homePath ? [] : currentPath.replace(`${homePath}/`, '').split('/').filter(Boolean);
  const appChoices = [
    { id: 'files', name: 'Files', description: `${attempt?.state?.user || 'user'} account folders`, icon: 'folder' },
    { id: 'terminal', name: 'Terminal', description: 'Ubuntu command line', icon: 'terminal' },
    { id: 'settings', name: 'Settings', description: 'System, users, display', icon: 'settings' },
  ];
  const normalizedLauncherQuery = launcherQuery.trim().toLowerCase();
  const matchingApps = appChoices.filter((app) => !normalizedLauncherQuery || `${app.name} ${app.description}`.toLowerCase().includes(normalizedLauncherQuery));
  const matchingFiles = normalizedLauncherQuery ? files.filter((file) => file.name.toLowerCase().includes(normalizedLauncherQuery)).slice(0, 8) : [];
  const openFilePreview = async (file) => {
    setSelectedFile({ ...file, loading: true });
    setCurrentPath(file.path.slice(0, file.path.lastIndexOf('/')));
    try {
      const result = await terminalApi.file(file.path);
      setSelectedFile((current) => current?.path === file.path ? { ...current, ...result.file, loading: false } : current);
    } catch (error) {
      setSelectedFile((current) => current?.path === file.path ? { ...current, loading: false, error: error.message } : current);
    }
  };
  const openSearchFile = (file) => {
    setCurrentPath(file.path.slice(0, file.path.lastIndexOf('/')));
    setSelectedFile(null);
    openApp('files');
    setLauncherOpen(false);
    setLauncherQuery('');
    if (file.type === 'file') openFilePreview(file);
  };
  const openEntry = (entry) => {
    if (entry.type === 'dir') { setCurrentPath(entry.path); setSelectedFile(null); setQuery(''); }
    else openFilePreview(entry);
  };
  const goToBreadcrumb = (index) => {
    const next = index < 0 ? homePath : `${homePath}/${breadcrumbs.slice(0, index + 1).join('/')}`;
    setCurrentPath(next);
    setSelectedFile(null);
    setQuery('');
  };
  const createEntry = async (event) => {
    event.preventDefault();
    const name = newEntryName.trim();
    if (!/^[\w.-][\w .-]{0,59}$/.test(name) || name === '.' || name === '..') return;
    const command = createKind === 'folder' ? 'mkdir' : 'touch';
    const result = await runCommand(`${command} "${currentPath}/${name}"`);
    if (result?.entry.exitCode === 0) { setNewEntryName(''); setCreateKind(''); }
  };

  if (loadError) return <main className="terminal-page page-shell"><div className="terminal-page-error" role="alert"><b>Terminal workspace unavailable</b><span>{loadError}</span><button onClick={() => window.location.reload()}>Retry</button></div></main>;
  if (!attempt) return <main className="terminal-page page-shell"><div className="terminal-page-loading" style={{ flex: '1 1 auto', minHeight: 0, width: '100%' }}><WorkspaceLoadingIllustration style={{ width: 'min(100%, 190px)', margin: '0 0 2px', filter: 'drop-shadow(0 9px 12px rgba(23,48,58,.12))' }}/><span>Preparing the Ubuntu practice workspace…</span></div></main>;

  return <main className="terminal-page page-shell">
    <div className="computer-monitor">
      <div className="monitor-bezel">
        <div className="monitor-screen">
          <div className="desktop-topbar"><span><i/> Ubuntu 24.04</span><b>LinuxLab Computer</b></div>
          {computerRebooting ? <section className="computer-reboot" aria-label="Restarting Ubuntu"><div><span className="computer-reboot-spinner"/><b>Ubuntu 24.04</b><small>Restarting LinuxLab computer…</small></div></section> : attempt.state.initialSetup ? <section className="first-boot-desktop" aria-label="Ubuntu first boot"><Terminal attempt={attempt} busy={busy} requestError={requestError} onCommand={runCommand} bootProgress={bootProgress}/></section> : attempt.state.loginScreen ? <section className="login-desktop" aria-label="Ubuntu account login">
            <div className="login-wallpaper-mark" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="47"/><circle cx="60" cy="60" r="25"/><circle cx="60" cy="13" r="8"/><circle cx="19" cy="84" r="8"/><circle cx="101" cy="84" r="8"/><path d="M60 21v14M26 80l13-8M94 80l-13-8"/></svg><span>Ubuntu</span></div>
            <div className="login-card">
              <div className="login-logo"><span>●</span><small>UBUNTU 24.04</small></div>
              <h1>{selectedLogin ? `Welcome, ${selectedLogin}` : 'Sign in'}</h1>
              <p>{selectedLogin ? 'Enter your password to continue.' : 'Choose an account to use this computer.'}</p>
              {!selectedLogin ? <div className="login-account-list">{Object.entries(attempt.state.users || {}).map(([username]) => <button key={username} onClick={() => selectLoginAccount(username)} disabled={busy}><span className="login-avatar">{username.slice(0, 1).toUpperCase()}</span><span><b>{username}</b><small>{attempt.state.adminUsers?.includes(username) ? 'Administrator account' : 'Standard account'}</small></span><Icon name="arrow" size={16}/></button>)}</div> : (() => { const setupPrompt = attempt.state.interactivePrompt?.operation === 'initial-password'; const confirmSetup = setupPrompt && attempt.state.interactivePrompt.step === 'confirm'; return <form className="login-password-form" onSubmit={submitLogin}><span className="login-selected-user"><span className="login-avatar">{selectedLogin.slice(0, 1).toUpperCase()}</span><b>{selectedLogin}</b></span><label htmlFor="computer-login-password">{setupPrompt ? confirmSetup ? 'Confirm administrator password' : 'Create administrator password' : 'Password'}</label><input id="computer-login-password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete={setupPrompt ? 'new-password' : 'current-password'} autoFocus/><div><button type="button" onClick={() => { setSelectedLogin(''); setLoginPassword(''); setLoginError(''); if (attempt.state.interactivePrompt) runCommand('cancel'); }}>Back</button><button type="submit" disabled={busy || !loginPassword}>{setupPrompt ? confirmSetup ? 'Set password' : 'Continue' : 'Sign in'}</button></div></form>; })()}
              {loginError && <p className="login-error" role="alert">{loginError}</p>}
              {loginNotice && <p className="login-notice" role="status">{loginNotice}</p>}
              <small className="login-host">{attempt.state.host || 'learnbox'} · LinuxLab training computer</small>
            </div>
          </section> : <>
    <div className={`free-terminal-workspace${!openApps.files ? ' no-files' : ''}${!openApps.terminal ? ' no-terminal' : ''}${!openApps.files && !openApps.terminal ? ' no-apps' : ''}${desktopTheme === 'Dark' ? ' theme-dark' : ''}`}>
      {openApps.files && <aside className="file-explorer" aria-label="Simulated file browser">
        <div className="file-explorer-heading"><div><Icon name="folder" size={17}/><b>{attempt.state.user} — Files</b></div><span className="file-explorer-count">{filteredFiles.length} items</span><div className="file-new-actions"><button title="Create folder" aria-label="Create folder" onClick={() => { setCreateKind('folder'); setNewEntryName(''); }}>+<small>Folder</small></button><button title="Create file" aria-label="Create file" onClick={() => { setCreateKind('file'); setNewEntryName(''); }}>+<small>File</small></button><button className="window-close" aria-label="Close File Explorer" title="Close" onClick={() => closeApp('files')}><Icon name="close" size={14}/></button></div></div>
        <label className="file-search"><Icon name="search" size={16}/><span className="sr-only">Search files</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this folder"/></label>
        <nav className="file-shortcuts" aria-label="Quick access">
          {[[ 'Documents', `${homePath}/Documents`], ['Downloads', `${homePath}/Downloads`], ['Projects', `${homePath}/Projects`]].map(([name, path]) => <button className={currentPath === path ? 'active' : ''} key={path} onClick={() => { setCurrentPath(path); setSelectedFile(null); setQuery(''); }}><Icon name="folder" size={14}/>{name}</button>)}
        </nav>
        {createKind && <form className="file-create-form" onSubmit={createEntry}><label htmlFor="new-file-name">New {createKind === 'folder' ? 'folder' : 'text file'}</label><div><input id="new-file-name" value={newEntryName} onChange={(event) => setNewEntryName(event.target.value)} placeholder={createKind === 'folder' ? 'Folder name' : 'notes.txt'} autoFocus/><button type="submit" disabled={busy || !newEntryName.trim()}>Create</button><button type="button" aria-label="Cancel create" onClick={() => setCreateKind('')}>×</button></div></form>}
        <div className="file-location" aria-label={`Folders in ${attempt.state.user}'s account`}><button onClick={() => goToBreadcrumb(-1)}>{attempt.state.user}</button>{breadcrumbs.map((part, index) => <span className="file-crumb" key={`${part}-${index}`}><b>/</b><button className={index === breadcrumbs.length - 1 ? 'current' : ''} onClick={() => goToBreadcrumb(index)}>{part}</button></span>)}</div>
        {!selectedFile && <div className="file-list-toolbar"><span>NAME</span><label>Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort files"><option value="name">Name</option><option value="type">File type</option><option value="size">Size</option></select></label></div>}
        {selectedFile ? <section className="document-preview" aria-label={`Preview ${selectedFile.name}`}>
          <div className="document-preview-head"><button onClick={() => setSelectedFile(null)} aria-label="Back to file list">← Files</button></div>
          <div className="document-preview-paper"><div className="document-file-type">{selectedFile.name.split('.').pop().toUpperCase()} FILE · SIMULATED</div><h2>{selectedFile.name}</h2><div className="document-preview-meta"><span>Account: {attempt.state.user}</span><span>{selectedFile.size} bytes · modified {selectedFile.modifiedAt || 'recently'}</span><span>Owner: {selectedFile.owner || attempt.state.user} · Permissions: {selectedFile.mode || '0644'}</span></div><pre>{selectedFile.loading ? 'Opening file…' : selectedFile.error || selectedFile.content || 'This file is empty.'}</pre></div>
        </section> : <div className="file-list" role="list" aria-label="Files in current folder">
          {visibleFiles.map((file) => <div className="file-row" key={file.path} role="listitem">
            <button className="file-open" title={file.type === 'dir' ? `Open ${file.name}` : `Preview ${file.name}`} onClick={() => openEntry(file)}><Icon name={file.type === 'dir' ? 'folder' : 'file'} size={16}/><span>{file.name}</span></button>
            {file.type === 'file' && <><span className="file-type-badge">{file.extension}</span><span className="file-size">{file.size} B</span></>}
          </div>)}
          {visibleFiles.length < filteredFiles.length && <button className="file-load-more" onClick={() => setVisibleFileLimit((count) => count + 100)}>Show more files <span>{visibleFiles.length} of {filteredFiles.length}</span></button>}
          {filteredFiles.length === 0 && <p className="file-empty">{query ? 'No matching files. Try another search.' : 'This folder is empty.'}</p>}
        </div>}
      </aside>}
      {openApps.terminal && <section className="terminal-workbench" aria-label="Terminal window">
        <div className="terminal-workbench-heading"><div><b>{attempt.state.loginScreen ? 'Computer login' : 'Terminal session'}</b><span>{attempt.state.loginScreen ? 'Enter an account name, then its password, to sign in.' : attempt.state.adminUsers?.includes(attempt.state.user) ? <>Admin: set a login password with <code>passwd</code>; create accounts with <code>sudo adduser USERNAME</code>; use <code>logout</code> to return to login.</> : <>User session · use <code>logout</code> to return to the computer login screen.</>}</span></div><button className="window-close" aria-label="Close Terminal" title="Close" onClick={() => closeApp('terminal')}><Icon name="close" size={14}/></button></div>
        <Terminal attempt={attempt} busy={busy} requestError={requestError} onCommand={runCommand}/>
      </section>}
      {openApps.settings && <section className="settings-window" aria-label="Settings window" role="dialog" aria-modal="false">
        <header><span><Icon name="settings" size={16}/> Settings</span><button aria-label="Close Settings" onClick={() => closeApp('settings')}><Icon name="close" size={15}/></button></header>
        <div className="settings-content"><nav aria-label="Settings categories">{['System', 'Users', 'Display', 'About'].map((tab) => <button className={settingsTab === tab ? 'active' : ''} key={tab} onClick={() => setSettingsTab(tab)}>{tab}</button>)}</nav><section>
          {settingsTab === 'System' && <><h2>System</h2><p>LinuxLab virtual computer</p><dl><dt>Operating system</dt><dd>Ubuntu 24.04.2 LTS</dd><dt>Computer name</dt><dd>{attempt.state.host || 'learnbox'}</dd><dt>Signed in as</dt><dd>{attempt.state.user}</dd><dt>Account type</dt><dd>{attempt.state.adminUsers?.includes(attempt.state.user) ? 'Administrator' : 'Standard user'}</dd></dl></>}
          {settingsTab === 'Users' && <><h2>Users</h2><p>Accounts on this computer</p><ul className="settings-users">{Object.entries(attempt.state.users || {}).map(([username]) => <li key={username}><span className="login-avatar">{username.slice(0, 1).toUpperCase()}</span><span><b>{username}</b><small>{attempt.state.adminUsers?.includes(username) ? 'Administrator' : 'Standard user'}</small></span></li>)}</ul>{attempt.state.adminUsers?.includes(attempt.state.user) && <p className="settings-hint">Create another account from Terminal with <code>sudo adduser USERNAME</code>.</p>}</>}
          {settingsTab === 'Display' && <><h2>Display</h2><p>Monitor settings</p><label className="settings-select">Desktop appearance<select value={desktopTheme} onChange={(event) => setDesktopTheme(event.target.value)}><option>Light</option><option>Dark</option></select></label><dl><dt>Resolution</dt><dd>Automatic</dd><dt>Refresh rate</dt><dd>60 Hz</dd><dt>Interface</dt><dd>Ubuntu desktop</dd></dl></>}
          {settingsTab === 'About' && <><h2>About this computer</h2><p>LinuxLab practice machine</p><dl><dt>Device</dt><dd>LinuxLab Virtual Monitor</dd><dt>OS</dt><dd>Ubuntu 24.04.2 LTS (simulated)</dd><dt>Session</dt><dd>Private practice workspace</dd></dl></>}
        </section></div>
      </section>}
    </div>
          <div className="desktop-dock" aria-label="Desktop applications"><button className={launcherOpen ? 'active' : ''} aria-label="Open Applications" title="Applications" onClick={() => setLauncherOpen((open) => !open)}><Icon name="apps" size={17}/></button><button className={openApps.files ? 'active' : ''} title="Files" aria-label="Open Files" onClick={() => openApps.files ? closeApp('files') : openApp('files')}><Icon name="folder" size={17}/></button><button className={openApps.terminal ? 'active' : ''} title="Terminal" aria-label="Open Terminal" onClick={() => openApps.terminal ? closeApp('terminal') : openApp('terminal')}><Icon name="terminal" size={17}/></button><div className="dock-spacer"/>{launcherOpen && <section className="app-launcher" aria-label="Applications and search" role="dialog">
            <label className="launcher-search"><Icon name="search" size={17}/><input value={launcherQuery} onChange={(event) => setLauncherQuery(event.target.value)} placeholder="Search apps, settings, and files" autoFocus/></label>
            <div className="launcher-content"><div className="launcher-section-heading"><b>{normalizedLauncherQuery ? 'Search results' : 'Pinned applications'}</b><small>{normalizedLauncherQuery ? `${matchingApps.length + matchingFiles.length} results` : 'LinuxLab apps'}</small></div>
              {matchingApps.length > 0 && <div className="launcher-app-grid">{matchingApps.map((app) => <button key={app.id} onClick={() => launchApp(app.id)}><span><Icon name={app.icon} size={20}/></span><b>{app.name}</b></button>)}</div>}
              {normalizedLauncherQuery && matchingFiles.length > 0 && <><div className="launcher-section-heading launcher-files-heading"><b>Files in {attempt.state.user}'s account</b></div><div className="launcher-file-results">{matchingFiles.map((file) => <button key={file.path} onClick={() => openSearchFile(file)}><Icon name={file.type === 'dir' ? 'folder' : 'file'} size={16}/><span><b>{file.name}</b><small>{file.path.slice(homePath.length).replace(/^\//, '')}</small></span></button>)}</div></>}
              {normalizedLauncherQuery && matchingApps.length === 0 && matchingFiles.length === 0 && <p className="launcher-empty">No apps or files matched that search.</p>}
            </div>
            <footer className="launcher-footer"><span className="login-avatar">{attempt.state.user.slice(0, 1).toUpperCase()}</span><span><b>{attempt.state.user}</b><small>{attempt.state.adminUsers?.includes(attempt.state.user) ? 'Administrator' : 'Standard user'}</small></span><button onClick={async () => { const result = await runCommand('logout'); if (result?.state.loginScreen) setLauncherOpen(false); }}>Log out</button></footer>
          </section>}</div>
          </>}
        </div>
        <div className="monitor-chin"><span>LINUXLAB</span><i/></div>
      </div>
      <div className="monitor-neck"/><div className="monitor-base"/>
    </div>
    <p className="free-terminal-safety"><Icon name="lock" size={14}/> Commands run only in this fictional Ubuntu workspace. No host files or system settings are changed.</p>
  </main>;
}
