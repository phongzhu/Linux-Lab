import { request } from './apiClient';

export const terminalApi = {
  workspace: () => request('/terminal/workspace'),
  file: (path) => request(`/terminal/file?path=${encodeURIComponent(path)}`),
  command: (command) => request('/terminal/command', { method: 'POST', body: { command } }),
};
