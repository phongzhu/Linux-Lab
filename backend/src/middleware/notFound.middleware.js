export function notFoundMiddleware(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That API route was not found.' } });
}
