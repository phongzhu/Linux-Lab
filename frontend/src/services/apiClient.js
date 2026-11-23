const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'The learning server could not be reached. Check that the backend is running, then retry.');
  }
  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text().catch(() => '');
  let payload = {};
  if (contentType.includes('application/json') && responseText) {
    try { payload = JSON.parse(responseText); } catch { payload = {}; }
  }
  if (!response.ok) {
    const responseMessage = payload.error?.message;
    const plainMessage = !contentType.includes('text/html')
      ? responseText.replace(/\s+/g, ' ').trim().slice(0, 240)
      : '';
    const message = responseMessage || plainMessage || `The server returned HTTP ${response.status}${response.statusText ? ` (${response.statusText})` : ''}.`;
    throw new ApiError(response.status, payload.error?.code || 'REQUEST_FAILED', message);
  }
  if (!contentType.includes('application/json')) throw new ApiError(response.status, 'INVALID_SERVER_RESPONSE', 'The server returned an unexpected response. Check that the backend is running, then retry.');
  if (!responseText) return {};
  try { return JSON.parse(responseText); } catch { throw new ApiError(response.status, 'INVALID_SERVER_RESPONSE', 'The server returned an invalid response. Check the backend logs, then retry.'); }
}
