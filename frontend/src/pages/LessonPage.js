import { useState } from 'react';
import Icon from '../components/Icon';
import Terminal from '../components/Terminal';
import MonitoringWorkspace from '../components/MonitoringWorkspace';
import IncidentWorkspace from '../components/IncidentWorkspace';
import './LessonPage.css';

const missionBriefs = {
  u1l1: 'You have just been given access to a newly provisioned learnbox host. Before changing anything, verify where the shell opened and inspect the nearby files. A teammate left a welcome note with details about this training environment.',
  u1l2: 'A teammate saved setup notes under the projects folder. Navigate there, verify the path you reached, read the project README, then return to your home directory as you would during a real handoff.',
  u1l3: 'A service owner needs the port used by the training app. Inspect its JSON configuration at /etc/training/app.json and report the setting without changing the file.',
  u2l1: 'Support opened a ticket about intermittent failures and needs the application, authentication, and system logs. Locate the training log directory and confirm which evidence files are available before collecting them.',
  u2l2: 'You are preparing an incident handoff. Create a dedicated workspace under your home directory and add a notes file there, keeping the original system evidence untouched.',
  u2l3: 'The incident reviewer needs the application and system logs together. Copy both originals into incident-notes, then verify the copies are present before sharing the folder.',
  u3l1: 'The payment team reports checkout timeouts. Search the application log for errors, isolate upstream failures, and count the matching entries so the on-call engineer can judge the scope.',
  u3l2: 'A new on-call shift has taken over the incident. Review the newest application events, check authentication warnings, and count the log lines before writing a handoff.',
  u3l3: 'A release engineer suspects the same failure is repeating. Sort the error entries, collapse duplicates, and save a short report that the team can compare with the next deployment.',
  u4l1: 'Users say the service has become slow. Check the simulated disk and memory snapshots, then compare those readings with the warning recorded in the system log.',
  u4l2: 'The application is sluggish and the payment worker is suspected. Inspect the process snapshot, identify the busy process, and correlate it with the timeout evidence in the logs.',
  u4l3: 'An alert says the payment worker has failed while the main training app is still running. Check both service states and inspect recent journal entries to confirm the impact.',
  u5l1: 'A service owner wants a health check before a release. Request the simulated endpoint, save the response locally, and inspect the reported service status.',
  u5l2: 'You have saved a health response for the release review. Read the JSON file, identify the payment worker signal, and check the response size before reporting back.',
  u5l3: 'Payments are failing in the training environment. Check the worker and application logs, save the health evidence, then leave a concise incident report for the next engineer.',
};

const scenarioDirectories = {
  u1l1: '/home/learner', u1l2: '/home/learner/projects', u1l3: '/etc/training',
  u2l1: '/var/log/training', u2l2: '/home/learner', u2l3: '/var/log/training',
  u3l1: '/var/log/training', u3l2: '/var/log/training', u3l3: '/var/log/training',
  u4l1: '/var/log/training', u4l2: '/var/log/training', u4l3: '/var/log/training',
  u5l1: '/home/learner', u5l2: '/home/learner', u5l3: '/var/log/training',
};

function listDirectoryEntries(files = {}, directory) {
  const parent = directory === '/' ? '/' : directory.replace(/\/$/, '');
  return Object.entries(files)
    .filter(([path]) => {
      const slash = path.lastIndexOf('/');
      const entryParent = slash === 0 ? '/' : path.slice(0, slash);
      return path !== parent && entryParent === parent;
    })
    .map(([path, details]) => ({ name: path.slice(path.lastIndexOf('/') + 1), isDirectory: details?.type === 'dir' }))
    .filter(({ name }) => !name.startsWith('.'))
    .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
}

function DirectorySnapshot({ lessonId, files }) {
  const path = scenarioDirectories[lessonId] || '/home/learner';
  const entries = listDirectoryEntries(files, path);
  const visibleEntries = entries.slice(0, 5);

  return <section className="directory-card" aria-label="Relevant files and folders">
    <div className="directory-card-head"><span><Icon name="folder" size={15}/> FILE LOCATION</span><small>{entries.length} {entries.length === 1 ? 'item' : 'items'}</small></div>
    <div className="directory-path"><Icon name="folder" size={16}/><code>{path}</code></div>
    {visibleEntries.length > 0 ? <div className="directory-tree" role="list">
      {visibleEntries.map((entry, index) => <div className="directory-entry" role="listitem" key={entry.name}>
        <span className="tree-branch">{index === visibleEntries.length - 1 ? '└──' : '├──'}</span>
        <Icon name={entry.isDirectory ? 'folder' : 'file'} size={14}/>
        <span className="directory-entry-name">{entry.name}{entry.isDirectory ? '/' : ''}</span>
        <small>{entry.isDirectory ? 'folder' : 'file'}</small>
      </div>)}
      {entries.length > visibleEntries.length && <div className="directory-more">+ {entries.length - visibleEntries.length} more items</div>}
    </div> : <p className="directory-empty">This folder is empty so far. Your commands may add files here.</p>}
  </section>;
}

export default function LessonPage({ lesson, attempt, busy, requestError, onCommand, onBack, onRestart }) {
  const [hints, setHints] = useState(0);
  const taskDone = attempt.completedTasks || [];
  const nextTask = lesson.objectives.find((task) => !taskDone.includes(task.id));
  const showHint = () => setHints((value) => Math.min(value + 1, 3));
  const unitNumber = Number.isInteger(lesson.unitIndex) ? lesson.unitIndex + 1 : Number(lesson.unit_number) || 1;
  const lessonNumber = Number.isInteger(lesson.lessonIndex) ? lesson.lessonIndex + 1 : Number(lesson.lesson_number) || 1;
  const missionBrief = missionBriefs[lesson.id] || lesson.scenario;
  const isB01Dashboard = lesson.unitId?.endsWith('B01') && lesson.workspaceType === 'monitoring-dashboard';
  const isB02Incident = lesson.unitId?.endsWith('B02') && lesson.workspaceType === 'monitoring-dashboard';
  const isTrainingWorkspace = isB01Dashboard || isB02Incident;

  return <main className="lesson-page page-shell">
    <div className="lesson-toolbar">
      <button className="back-button" onClick={onBack}><span>‹</span> Learning path</button>
      <div className="lesson-breadcrumb">Unit {unitNumber}<span>/</span>{lesson.unitTitle}</div>
      <div className="lesson-progress-label">{taskDone.length} / {lesson.objectives.length} tasks</div>
    </div>
    <div className="lesson-track" aria-label={`${taskDone.length} of ${lesson.objectives.length} tasks complete`}><span style={{ width: `${taskDone.length / lesson.objectives.length * 100}%` }}/></div>
    <div className="lesson-layout">
      <section className="lesson-instructions" aria-label="Lesson plan" tabIndex={0}>
        <div className={`unit-kicker unit-${lesson.unitColor || 'mint'}`}><span>UNIT {unitNumber}</span><i/> LESSON {lessonNumber}</div>
        <h1>{lesson.title}</h1><p className="lesson-intro">{lesson.intro}</p>
        <div className="scenario-card">
          <div className="scenario-card-head"><span className="scenario-icon"><Icon name="terminal" size={17}/></span><div><b>INCIDENT BRIEF</b><small>{attempt.state.host || 'learnbox'} · simulated training case</small></div><span className="brief-status">ACTIVE</span></div>
          <p className="scenario-brief">{missionBrief}</p>
          <div className="scenario-objective"><b>YOUR ASSIGNMENT</b><span>{lesson.scenario}</span></div>
        </div>
        <DirectorySnapshot lessonId={lesson.id} files={attempt.state.files}/>
        <div className="task-heading"><h2>Mission tasks</h2><span>{taskDone.length} of {lesson.objectives.length} complete</span></div>
        <div className="task-list">
          {lesson.objectives.map((task, index) => {
            const done = taskDone.includes(task.id);
            return <article key={task.id} className={`task-card ${done ? 'task-done' : ''}`}>
              <div className="task-check">{done ? <Icon name="check" size={15}/> : <span>{String(index + 1).padStart(2, '0')}</span>}</div>
              <div><b>{task.title}</b><p>{task.description}</p>{done && <small>{task.feedback}</small>}</div>
            </article>;
          })}
        </div>
        <button className="hint-button" onClick={showHint}><span>?</span>{hints ? `Show another hint (${Math.min(hints, 3)}/3)` : 'Need a hint?'}</button>
        {hints > 0 && <div className="hint-card"><b>Hint {hints}</b><p>{!nextTask ? 'You have completed every task.' : nextTask.hints?.[hints - 1] || (hints === 1 ? 'Think about which command can help with this task.' : hints === 2 ? nextTask.hint : `Try this: ${nextTask.hint}`)}</p>{hints > 1 && <code>Use the command guide if you want to review the options.</code>}</div>}
        <div className="lesson-note"><span>✳</span> {isTrainingWorkspace ? 'Workspace actions use fictional training evidence and are saved with this attempt.' : 'Every command runs in a fictional sandbox. Explore freely; you can restart this lesson anytime.'}</div>
      </section>
      <section className="lesson-workspace" aria-label="Lesson workspace">
        <div className="workspace-heading"><div>{isB01Dashboard ? 'TRAINING DASHBOARD · FICTIONAL DATA' : isB02Incident ? 'INCIDENT DESK · SIMULATED EVIDENCE' : <><span className="live-dot"/> YOUR WORKSPACE</>}</div><button onClick={() => { setHints(0); onRestart(); }}>Restart lesson</button></div>
        {isB01Dashboard
          ? <MonitoringWorkspace key={attempt.id} lesson={lesson} attempt={attempt} busy={busy} requestError={requestError} onAction={onCommand}/>
          : isB02Incident
            ? <IncidentWorkspace key={attempt.id} lesson={lesson} attempt={attempt} busy={busy} requestError={requestError} onAction={onCommand}/>
          : <Terminal key={attempt.id} attempt={attempt} busy={busy} requestError={requestError} onCommand={onCommand}/>}
      </section>
    </div>
  </main>;
}
