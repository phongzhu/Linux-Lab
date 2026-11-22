import { fireEvent, render, screen } from '@testing-library/react';
import Terminal from './Terminal';

const attempt = {
  id: 'attempt-1',
  state: {
    cwd: '/home/learner',
    files: {
      '/home/learner': { type: 'dir' },
      '/home/learner/readme.txt': { type: 'file', content: 'welcome' },
      '/home/learner/projects': { type: 'dir' },
    },
  },
  commands: [
    { id: 1, command: 'pwd', cwd: '/home/learner', output: '/home/learner', succeeded: true },
    { id: 2, command: 'ls', cwd: '/home/learner', output: 'readme.txt  projects', succeeded: true },
  ],
};

test('history arrows start at the newest saved command after reload', () => {
  render(<Terminal attempt={attempt} busy={false} requestError="" onCommand={jest.fn()}/>);
  const input = screen.getByRole('textbox', { name: 'Terminal command' });

  fireEvent.keyDown(input, { key: 'ArrowUp' });
  expect(input).toHaveValue('ls');
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  expect(input).toHaveValue('pwd');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(input).toHaveValue('ls');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(input).toHaveValue('');
});

test('historical prompts render with each command’s starting directory', () => {
  const attemptWithDirectoryChanges = {
    ...attempt,
    commands: [
      { id: 3, command: 'cd /etc', cwdBefore: '/home/learner', cwdAfter: '/etc', stdout: '', stderr: '', exitCode: 0 },
      { id: 4, command: 'cd training', cwdBefore: '/etc', cwdAfter: '/etc/training', stdout: '', stderr: '', exitCode: 0 },
    ],
  };
  const { container } = render(<Terminal attempt={attemptWithDirectoryChanges} busy={false} requestError="" onCommand={jest.fn()}/>);
  const prompts = [...container.querySelectorAll('.term-line.command')].map((entry) => entry.textContent);

  expect(prompts[0]).toContain('learner@learnbox:~$ cd /etc');
  expect(prompts[1]).toContain('learner@learnbox:/etc$ cd training');
});

test('historical prompts keep the host and user that were active before SSH changes', () => {
  const remoteAttempt = {
    ...attempt,
    state: { ...attempt.state, host: 'lab-app-01', user: 'learner', cwd: '/home/learner', remoteSession: { key: 'lab-app-01.training.test' } },
    commands: [
      { id: 5, command: 'ssh learner@lab-app-01.training.test', cwdBefore: '/home/learner', cwdAfter: '/home/learner', hostBefore: 'learner-pc', hostAfter: 'lab-app-01', userBefore: 'learner', userAfter: 'learner', stdout: 'Connected', stderr: '', exitCode: 0 },
      { id: 6, command: 'exit', cwdBefore: '/home/learner', cwdAfter: '/home/learner', hostBefore: 'lab-app-01', hostAfter: 'learner-pc', userBefore: 'learner', userAfter: 'learner', stdout: 'Disconnected', stderr: '', exitCode: 0 },
    ],
  };
  const { container } = render(<Terminal attempt={remoteAttempt} busy={false} requestError="" onCommand={jest.fn()}/>);
  const prompts = [...container.querySelectorAll('.term-line.command')].map((entry) => entry.textContent);

  expect(prompts[0]).toContain('learner@learner-pc:~$ ssh');
  expect(prompts[1]).toContain('learner@lab-app-01:~$ exit');
  expect(screen.getByText(/SSH session for learner@lab-app-01/)).toBeInTheDocument();
});

test('Tab completes a unique file name from the simulated home directory', () => {
  render(<Terminal attempt={attempt} busy={false} requestError="" onCommand={jest.fn()}/>);
  const input = screen.getByRole('textbox', { name: 'Terminal command' });
  fireEvent.change(input, { target: { value: 'cat read' } });

  fireEvent.keyDown(input, { key: 'Tab' });

  expect(input).toHaveValue('cat readme.txt ');
});

test('Ctrl+L asks the command handler to clear the terminal', () => {
  const onCommand = jest.fn();
  render(<Terminal attempt={attempt} busy={false} requestError="" onCommand={onCommand}/>);
  const input = screen.getByRole('textbox', { name: 'Terminal command' });
  fireEvent.change(input, { target: { value: 'unfinished command' } });

  fireEvent.keyDown(input, { key: 'l', ctrlKey: true });

  expect(input).toHaveValue('');
  expect(onCommand).toHaveBeenCalledWith('clear');
});
