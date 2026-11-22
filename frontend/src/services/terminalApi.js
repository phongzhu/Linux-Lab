import { request } from './apiClient';

export const terminalApi = {
  workspace: () => request('/terminal/workspace'),
  command: (command) => request('/terminal/command', { method: 'POST', body: { command } }),
};
