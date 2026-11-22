import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import Terminal from '../components/Terminal';
import { terminalApi } from '../services/terminalApi';
import './TerminalPage.css';

export default function TerminalPage() {
  const [attempt, setAttempt] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/home/learner/Documents');
  const [selectedFile, setSelectedFile] = useState(null);
  const [query, setQuery] = useState('');
  const [createKind, setCreateKind] = useState('');
  const [newEntryName, setNewEntryName] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    terminalApi.workspace().then((result) => {
      if (!active) return;
      setAttempt({ id: 'free-exploration', state: result.workspace.state, commands: result.workspace.commands });
      setFiles(result.files);
    }).catch((error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, []);

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

  const runCommand = async (command) => {
    setBusy(true);
    setRequestError('');
    try {
      const result = await terminalApi.command(command);
      setAttempt({ id: 'free-exploration', state: result.state, commands: result.commands });
      setFiles(result.files);
      return result;
    } catch (error) {
      setRequestError(error.message);
      return null;
    } finally { setBusy(false); }
  };

  const breadcrumbs = currentPath === '/home/learner' ? [] : currentPath.replace('/home/learner', '~').split('/').filter(Boolean);
  const openEntry = (entry) => {
    if (entry.type === 'dir') { setCurrentPath(entry.path); setSelectedFile(null); setQuery(''); }
    else setSelectedFile(entry);
  };
  const goToBreadcrumb = (index) => {
    const next = index < 0 ? '/home/learner' : `/home/learner/${breadcrumbs.slice(1, index + 1).join('/')}`;
    setCurrentPath(next);
    setSelectedFile(null);
    setQuery('');
  };
  const printerConnected = Boolean(attempt?.state?.printerQueues?.office_printer?.enabled);
  const printFile = (file) => runCommand(`lp -d office_printer "${file.path}"`);
  const connectPrinter = () => runCommand('lpadmin -p office_printer -E -v ipp://printer.training.test/ipp/print -m everywhere');
  const createEntry = async (event) => {
    event.preventDefault();
    const name = newEntryName.trim();
    if (!/^[\w.-][\w .-]{0,59}$/.test(name) || name === '.' || name === '..') return;
    const command = createKind === 'folder' ? 'mkdir' : 'touch';
    const result = await runCommand(`${command} "${currentPath}/${name}"`);
    if (result?.entry.exitCode === 0) { setNewEntryName(''); setCreateKind(''); }
  };

  if (loadError) return <main className="terminal-page page-shell"><div className="terminal-page-error" role="alert"><b>Terminal workspace unavailable</b><span>{loadError}</span><button onClick={() => window.location.reload()}>Retry</button></div></main>;
  if (!attempt) return <main className="terminal-page page-shell"><div className="terminal-page-loading"><span className="terminal-page-spinner"/>Preparing the Ubuntu practice workspace…</div></main>;

  return <main className="terminal-page page-shell">
    <div className="free-terminal-workspace">
      <aside className="file-explorer" aria-label="Simulated file browser">
        <div className="file-explorer-heading"><div><Icon name="folder" size={17}/><b>File explorer</b></div><span className="file-explorer-count">{filteredFiles.length} items</span><div className="file-new-actions"><button title="Create folder" aria-label="Create folder" onClick={() => { setCreateKind('folder'); setNewEntryName(''); }}>+<small>Folder</small></button><button title="Create file" aria-label="Create file" onClick={() => { setCreateKind('file'); setNewEntryName(''); }}>+<small>File</small></button></div></div>
        <label className="file-search"><Icon name="search" size={16}/><span className="sr-only">Search files</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this folder"/></label>
        <nav className="file-shortcuts" aria-label="Quick access">
          {[['Documents', '/home/learner/Documents'], ['Downloads', '/home/learner/Downloads'], ['Projects', '/home/learner/projects']].map(([name, path]) => <button className={currentPath === path ? 'active' : ''} key={path} onClick={() => { setCurrentPath(path); setSelectedFile(null); setQuery(''); }}><Icon name="folder" size={14}/>{name}</button>)}
        </nav>
        {createKind && <form className="file-create-form" onSubmit={createEntry}><label htmlFor="new-file-name">New {createKind === 'folder' ? 'folder' : 'text file'}</label><div><input id="new-file-name" value={newEntryName} onChange={(event) => setNewEntryName(event.target.value)} placeholder={createKind === 'folder' ? 'Folder name' : 'notes.txt'} autoFocus/><button type="submit" disabled={busy || !newEntryName.trim()}>Create</button><button type="button" aria-label="Cancel create" onClick={() => setCreateKind('')}>×</button></div></form>}
        <div className="file-location" aria-label="Current folder"><button onClick={() => goToBreadcrumb(-1)}>Home</button>{breadcrumbs.map((part, index) => <span className="file-crumb" key={`${part}-${index}`}><b>/</b><button className={index === breadcrumbs.length - 1 ? 'current' : ''} onClick={() => goToBreadcrumb(index)}>{part}</button></span>)}</div>
        {!selectedFile && <div className="file-list-toolbar"><span>NAME</span><label>Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort files"><option value="name">Name</option><option value="type">File type</option><option value="size">Size</option></select></label></div>}
        {selectedFile ? <section className="document-preview" aria-label={`Preview ${selectedFile.name}`}>
          <div className="document-preview-head"><button onClick={() => setSelectedFile(null)} aria-label="Back to file list">← Files</button><button className="preview-print" onClick={() => printFile(selectedFile)} disabled={busy || !printerConnected}><Icon name="printer" size={15}/> Print</button></div>
          <div className="document-preview-paper"><div className="document-file-type">{selectedFile.name.split('.').pop().toUpperCase()} FILE · SIMULATED</div><h2>{selectedFile.name}</h2><div className="document-preview-meta"><span>{selectedFile.path}</span><span>{selectedFile.size} bytes · modified {selectedFile.modifiedAt || 'recently'}</span><span>Owner: {attempt.state.files[selectedFile.path]?.owner || 'learner'} · Permissions: {attempt.state.files[selectedFile.path]?.mode || '0644'}</span></div><pre>{attempt.state.files[selectedFile.path]?.content || 'This file is empty.'}</pre></div>
        </section> : <div className="file-list" role="list" aria-label="Files in current folder">
          {filteredFiles.map((file) => <div className="file-row" key={file.path} role="listitem">
            <button className="file-open" title={file.type === 'dir' ? `Open ${file.name}` : `Preview ${file.name}`} onClick={() => openEntry(file)}><Icon name={file.type === 'dir' ? 'folder' : 'file'} size={16}/><span>{file.name}</span></button>
            {file.type === 'file' && <><span className="file-type-badge">{file.extension}</span><span className="file-size">{file.size} B</span><button className="file-print" title={`Print ${file.name}`} aria-label={`Print ${file.name}`} onClick={() => printFile(file)} disabled={busy || !printerConnected}><Icon name="printer" size={15}/></button></>}
          </div>)}
          {filteredFiles.length === 0 && <p className="file-empty">{query ? 'No matching files. Try another search.' : 'This folder is empty.'}</p>}
        </div>}
        <div className={`printer-status${printerConnected ? ' connected' : ''}`}><span className="printer-status-light"/><div><b>{printerConnected ? 'office-printer' : 'Printer not connected'}</b><small>{printerConnected ? 'Simulated printer · ready' : 'Connect the training printer to print'}</small></div>{!printerConnected && <button onClick={connectPrinter} disabled={busy}>Connect</button>}</div>
      </aside>
      <section className="terminal-workbench" aria-label="Free-form terminal">
        <div className="terminal-workbench-heading"><div><b>Terminal session</b><span>Use commands freely. Changes stay in this practice workspace.</span></div><span className="terminal-host-label">learner@learnbox</span></div>
        <Terminal attempt={attempt} busy={busy} requestError={requestError} onCommand={runCommand}/>
        <div className="terminal-quick-actions"><span>Try:</span><button onClick={() => runCommand('ls ~/Documents | head -n 12')}>list documents</button><button onClick={() => runCommand('lpstat -p')}>check printer</button><button onClick={() => runCommand('help')}>command help</button></div>
      </section>
    </div>
    <p className="free-terminal-safety"><Icon name="lock" size={14}/> Commands run only in a fictional Ubuntu environment. No real files or printers are accessed.</p>
  </main>;
}
