import { fireEvent, render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';

const lesson = (id, title, extra = {}) => ({ id, title, time: '8 min', objectives: [{ id: `${id}-1`, title: 'Inspect' }], prerequisites: ['u1l3'], intro: 'A detailed training case.', role: 'read-only investigator', workspaceType: 'monitoring-dashboard', implementationStatus: 'preview', ...extra });
const applied = {
  id: 'applied-linux-A01', trackId: 'applied-linux', number: 6, title: 'Files and application configuration', subtitle: 'Inspect and verify settings.', color: 'mint',
  lessons: [lesson('applied-linux-a01-l1', 'Inspect the configuration')],
};
const sre = {
  id: 'sre-operations-B01', trackId: 'sre-operations', number: 16, title: 'Access, metrics, and baselines', subtitle: 'Establish metric scope.', color: 'blue',
  lessons: [lesson('sre-operations-b01-l1', 'Begin a monitoring shift')],
};
const sections = [
  { id: 'linux-fundamentals', title: 'Linux Fundamentals', tracks: [{ id: 'linux-fundamentals', title: 'Linux Fundamentals', units: [] }] },
  { id: 'applied-linux-sre', title: 'Applied Linux & SRE Practice', tracks: [
    { id: 'applied-linux', title: 'Applied Linux', units: [applied] },
    { id: 'sre-operations', title: 'SRE Operations', units: [sre] },
  ] },
];

function renderDashboard(onStartLesson = jest.fn()) {
  return render(<DashboardPage
    units={[applied, sre]}
    sections={sections}
    progress={{ completedLessons: ['u1l3'], xp: 0 }}
    lessonCompleteCount={1}
    nextLesson={lesson('u1l3', 'Read a config file', { implementationStatus: 'ready', prerequisites: [] })}
    activeAttempts={[]}
    onStartLesson={onStartLesson}
    onResumeAttempt={jest.fn()}
    onOpenGuide={jest.fn()}
    onResetProgress={jest.fn()}
    loading={false}
    error=""
    onRetry={jest.fn()}
  />);
}

test('section and track selectors expose the structured applied catalog', () => {
  renderDashboard();
  fireEvent.change(screen.getByRole('combobox', { name: 'Learning section' }), { target: { value: 'applied-linux-sre' } });
  expect(screen.getByRole('heading', { name: 'Files and application configuration' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Practice track' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Practice track' }), { target: { value: 'sre-operations' } });
  expect(screen.getByRole('heading', { name: 'Access, metrics, and baselines' })).toBeInTheDocument();
});

test('lessons in progress can be opened directly without a preview gate', () => {
  const onStartLesson = jest.fn();
  renderDashboard(onStartLesson);
  fireEvent.change(screen.getByRole('combobox', { name: 'Learning section' }), { target: { value: 'applied-linux-sre' } });
  fireEvent.click(screen.getByRole('button', { name: /Inspect the configuration \(workspace in progress\)/ }));
  expect(onStartLesson).toHaveBeenCalledWith(applied.lessons[0]);
  expect(screen.getAllByText(/Workspace in progress/).length).toBeGreaterThan(0);
  expect(screen.queryByRole('dialog', { name: 'Inspect the configuration' })).not.toBeInTheDocument();
  expect(document.querySelector('.lesson-row.locked')).toBeNull();
});

test('a ready lesson starts even when legacy prerequisite metadata is present', () => {
  const onStartLesson = jest.fn();
  const readyUnit = { ...applied, lessons: [lesson('ready-with-old-prereq', 'Ready lesson', { implementationStatus: 'ready', prerequisites: ['not-completed'] })] };
  const readySections = [{ ...sections[1], tracks: [{ ...sections[1].tracks[0], units: [readyUnit] }] }];
  render(<DashboardPage
    units={[readyUnit]} sections={readySections} progress={{ completedLessons: [], xp: 0 }} lessonCompleteCount={0}
    nextLesson={readyUnit.lessons[0]} activeAttempts={[]} onStartLesson={onStartLesson} onResumeAttempt={jest.fn()}
    onOpenGuide={jest.fn()} onResetProgress={jest.fn()} loading={false} error="" onRetry={jest.fn()}
  />);
  fireEvent.click(screen.getByRole('button', { name: /Ready lesson/ }));
  expect(onStartLesson).toHaveBeenCalledWith(readyUnit.lessons[0]);
});
