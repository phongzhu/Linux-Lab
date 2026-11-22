export function errorMiddleware(error, _req, res, next) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  if (res.headersSent) return next(error);
  res.status(status).json({
    error: {
      code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
      message: status >= 500 ? 'The server could not complete this request.' : error.message,
    },
  });
}
