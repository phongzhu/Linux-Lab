import { request } from './apiClient';

export const learningApi = {
  units: () => request('/units'),
  lesson: (lessonId) => request(`/lessons/${encodeURIComponent(lessonId)}`),
  progress: () => request('/progress'),
  resetProgress: () => request('/progress/reset', { method: 'POST' }),
  activeAttempts: () => request('/attempts/active'),
  startAttempt: (lessonId, timezone) => request('/attempts', { method: 'POST', body: { lessonId, timezone } }),
  attempt: (attemptId) => request(`/attempts/${encodeURIComponent(attemptId)}`),
  command: (attemptId, command) => request(`/attempts/${encodeURIComponent(attemptId)}/commands`, { method: 'POST', body: { command } }),
  restart: (attemptId) => request(`/attempts/${encodeURIComponent(attemptId)}/restart`, { method: 'POST' }),
};
