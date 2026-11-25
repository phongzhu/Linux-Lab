import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import './Terminal.css';

const shellCommands = 'pwd ls cd mkdir touch cat echo printf head tail grep find wc sort uniq cp mv rm ps top df free systemctl journalctl curl jq editor vim vi whoami id ssh exit chmod chgrp chown sudo adduser su passwd logout ip getent ss uname date which tree file du man less more clear history help psql tar scp sha256sum bash crontab training-clock docker ddev lp lpstat lpadmin lpinfo cancel'.split(' ');

function completeInput(value, files, cwd, user, disablePrinterCommands = false) {
  const match = value.match(/^(.*?)([^\s]*)$/);
  if (!match) return value;
  const [, prefix, fragment] = match;
  if (!prefix) {
    const availableCommands = disablePrinterCommands ? shellCommands.filter((command) => !['lp', 'lpstat', 'lpadmin', 'lpinfo', 'cancel'].includes(command)) : shellCommands;
    const matches = availableCommands.filter((command) => command.startsWith(fragment));
    return matches.length === 1 ? `${matches[0]} ` : value;
  }

  const slashAt = fragment.lastIndexOf('/');
  const directoryPart = slashAt < 0 ? '' : fragment.slice(0, slashAt + 1);
  const namePart = fragment.slice(slashAt + 1);
  let directory = directoryPart.startsWith('~/') ? `/home/${user}/${directoryPart.slice(2)}` : directoryPart.startsWith('/') ? directoryPart : `${cwd}/${directoryPart}`;
  directory = `/${directory.split('/').filter((part) => part && part !== '.').reduce((parts, part) => part === '..' ? parts.slice(0, -1) : [...parts, part], []).join('/')}`;
  const entries = Object.keys(files || {}).filter((path) => path !== directory && path.slice(0, path.lastIndexOf('/')) === directory);
  const matches = entries.map((path) => ({ path, name: path.slice(path.lastIndexOf('/') + 1) })).filter(({ name }) => name.startsWith(namePart));
  if (matches.length !== 1) return value;
  const entry = matches[0];
  const isDirectory = files[entry.path]?.type === 'dir' || Object.keys(files || {}).some((path) => path.startsWith(`${entry.path}/`));
  const completed = `${directoryPart}${entry.name}${isDirectory ? '/' : ' '}`;
  return `${prefix}${completed}`;
}

export default function Terminal({ attempt, busy, requestError, onCommand, bootProgress = 100 }) {
  const [value, setValue] = useState('');
  const [pendingCommand, setPendingCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(0);
  const [displayStart, setDisplayStart] = useState(0);
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const commands = useMemo(() => attempt.commands || [], [attempt.commands]);
  const commandList = useMemo(() => commands.map((entry) => entry.command), [commands]);
  const lastClear = Math.max(commandList.lastIndexOf('clear'), commandList.lastIndexOf('logout'));
  const visibleCommands = commands.slice(Math.max(displayStart, lastClear + 1));
  const cwd = attempt.state.cwd;
  const user = attempt.state.user || 'learner';
  const host = attempt.state.host || 'learnbox';
  const homePath = `/home/${user}`;
  const label = cwd === homePath ? '~' : cwd.replace(homePath, '~');
  const databaseSession = attempt.state.databaseSession;
  const interactivePrompt = attempt.state.interactivePrompt;
  const initialSetup = Boolean(attempt.state.initialSetup);
  const bootReady = bootProgress >= 100;
  const passwordPrompt = interactivePrompt?.kind === 'password';
  const editorPrompt = interactivePrompt?.kind === 'editor';
  const loginScreen = Boolean(attempt.state.loginScreen);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [commands, requestError]);

  useEffect(() => {
    setHistoryIndex(commandList.length);
  }, [commandList.length]);

  useEffect(() => {
    if (bootReady && window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
  }, [bootReady, passwordPrompt, commandList.length]);

  const submit = async (event) => {
    event.preventDefault();
    const command = value.trim();
    if (!command || busy) return;
    setValue('');
    setHistoryIndex(commandList.length);
    setPendingCommand(command);
    try {
      await onCommand(command);
    } finally {
      setPendingCommand('');
    }
  };

  const clearTerminal = () => {
    setValue('');
    setDisplayStart(commands.length);
    inputRef.current?.focus();
  };

  const keyDown = (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setValue('');
      onCommand('clear');
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      setValue('');
      if (passwordPrompt) onCommand('cancel');
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      setValue((current) => completeInput(current, attempt.state.files, cwd, user, attempt.state.disablePrinterCommands));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setValue(commandList[next] || '');
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(commandList.length, historyIndex + 1);
      setHistoryIndex(next);
      setValue(commandList[next] || '');
    }
  };

  return <section className="terminal-card" aria-label="Simulated terminal">
    <div className="terminal-top"><div className="window-dots"><i/><i/><i/></div><div className="terminal-title"><Icon name="terminal" size={15}/> {initialSetup ? 'Ubuntu first start' : loginScreen ? 'System login' : `Terminal - ${user}@${host}:${label}`} </div><div className="terminal-actions"><span className="sandbox-pill"><span/> Ubuntu 24.04 · simulated</span><button className="terminal-clear" type="button" onClick={clearTerminal} aria-label="Clear terminal output" title="Clear terminal output"><Icon name="clear" size={13}/><span>Clear</span></button></div></div>
    <div className="terminal-output" ref={outputRef} onClick={() => inputRef.current?.focus()} aria-live="polite">
      {displayStart === 0 && lastClear < 0 && initialSetup && <div className="ubuntu-login first-boot-output">
        <pre className="term-line ubuntu-release">Ubuntu 24.04.2 LTS · LinuxLab virtual computer</pre>
        <pre className="term-line notice">Starting Ubuntu...</pre>
        <pre className="term-line notice">[  OK  ] Mounted virtual filesystem</pre>
        <pre className="term-line notice">[  OK  ] Started system services</pre>
        <pre className="term-line notice">Preparing first sign-in</pre>
        <div className="boot-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={bootProgress}><span style={{ width: `${bootProgress}%` }}/><b>{bootProgress}%</b></div>
        {bootReady && <><pre className="term-line ubuntu-welcome">Welcome to LinuxLab.</pre><pre className="term-line notice">Set an 8–128 character password for the built-in admin account to finish setup.</pre></>}
      </div>}
      {displayStart === 0 && lastClear < 0 && loginScreen && <div className="ubuntu-login">
        <pre className="term-line ubuntu-release">Ubuntu 24.04.2 LTS · {host} tty1</pre>
        <pre className="term-line ubuntu-login-line">LinuxLab computer is logged out.</pre>
        <pre className="term-line startup-tip">Available accounts: <b>{Object.keys(attempt.state.users || {}).join(', ')}</b></pre>
      </div>}
      {displayStart === 0 && lastClear < 0 && !loginScreen && !initialSetup && <div className="ubuntu-login">
        <pre className="term-line ubuntu-release">Ubuntu 24.04.2 LTS · {host}</pre>
        <pre className="term-line ubuntu-login-line">{attempt.state.remoteSession ? `SSH session for ${user}@${host}` : `Local training session for ${user}@${host}`}</pre>
        <pre className="term-line ubuntu-welcome">Welcome to Ubuntu 24.04.2 LTS.</pre>
        <pre className="term-line notice">LinuxLab training shell · commands run in a fictional sandbox.</pre>
        <pre className="term-line startup-tip">Start with <b>pwd</b> to see where you are, <b>ls</b> to look around, or type <b>help</b>.</pre>
      </div>}
      {visibleCommands.map((entry) => <div className="terminal-command-group" key={entry.id}>
        <pre className="term-line command">{entry.firstBootUsername ? <>Enter new UNIX username: {entry.command}</> : entry.loginInput ? <>learnbox login: {entry.command}</> : entry.passwordInput ? <>Password:</> : <><span className="prompt-user">{entry.userBefore || user}</span>@<span className="prompt-host">{entry.hostBefore || 'learnbox'}</span>:<span className="prompt-path">{(entry.cwdBefore || entry.cwd || homePath) === `/home/${entry.userBefore || user}` ? '~' : (entry.cwdBefore || entry.cwd || homePath).replace(`/home/${entry.userBefore || user}`, '~')}</span>$ {entry.command}</>}</pre>
        {(entry.stdout ?? (entry.succeeded ? entry.output : '')) && <pre className="term-line output">{entry.stdout ?? entry.output}</pre>}
        {(entry.stderr ?? (!entry.succeeded ? entry.output : '')) && <pre className="term-line error">{entry.stderr ?? entry.output}</pre>}
      </div>)}
      {pendingCommand && <div className="terminal-command-group terminal-command-pending" aria-live="polite">
        <pre className="term-line command"><span className="prompt-user">{user}</span>@<span className="prompt-host">{host}</span>:<span className="prompt-path">{label}</span>$ {pendingCommand}</pre>
        <pre className="term-line notice">Running…</pre>
      </div>}
      <form className="terminal-form" style={initialSetup && !bootReady ? { visibility: 'hidden' } : undefined} onSubmit={submit}><span className="prompt">{editorPrompt ? <b>-- INSERT --</b> : passwordPrompt ? <><b>{interactivePrompt.operation === 'sudo-adduser' ? `Admin sign-in password for ${interactivePrompt.username}` : interactivePrompt.operation === 'su' || interactivePrompt.operation === 'login' ? `Password for ${interactivePrompt.username}` : interactivePrompt.step === 'confirm' ? 'Retype new password' : interactivePrompt.operation === 'first-admin-password' ? 'New password for admin' : 'New password'}:</b></> : initialSetup ? <><b>New password for admin:</b></> : loginScreen ? <><b>learnbox login:</b></> : databaseSession ? <><b>{databaseSession.database}</b><em>=&gt;</em></> : <><b>{user}</b>@<strong>{host}</strong>:<em>{label}</em>$</>}</span><input ref={inputRef} type={passwordPrompt || initialSetup ? 'password' : 'text'} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={keyDown} aria-label={passwordPrompt || initialSetup ? 'Password input' : editorPrompt ? 'Text editor line' : loginScreen ? 'Account username' : 'Terminal command'} placeholder={passwordPrompt || initialSetup ? 'password input is hidden' : editorPrompt ? 'type a line, or :wq to save' : loginScreen ? 'enter account name' : commandList.length ? '' : databaseSession ? 'enter SQL or \\q' : 'try pwd'} autoComplete="off" spellCheck="false" disabled={busy || (initialSetup && !bootReady)}/><button type="submit" aria-label={passwordPrompt ? 'Submit password' : editorPrompt ? 'Add editor line' : loginScreen ? 'Submit account name' : 'Run command'} disabled={busy || (initialSetup && !bootReady)}><Icon name="arrow" size={17}/></button></form>
      {passwordPrompt && interactivePrompt.operation === 'sudo-adduser' && interactivePrompt.attempts > 0 && <div className="terminal-prompt-hint" role="alert">That admin password was not accepted. Use the same password you entered to sign in. {3 - interactivePrompt.attempts} attempt{3 - interactivePrompt.attempts === 1 ? '' : 's'} remaining.</div>}
    </div>
    <div className="terminal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> history <kbd>Tab</kbd> complete <kbd>Ctrl</kbd>+<kbd>L</kbd> clear</span><span>{requestError ? <span className="term-error">{requestError}</span> : 'Safe Ubuntu-style shell simulation'}</span></div>
  </section>;
}
