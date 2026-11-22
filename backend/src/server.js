import app from './app.js';
import { assertEnvironment, env } from './config/env.js';

assertEnvironment();
const server = app.listen(env.port, () => console.log(`Linux Simulation API listening on http://localhost:${env.port}`));

function shutdown(signal) {
  console.log(`${signal}: closing API server`);
  server.close((error) => { if (error) { console.error(error); process.exitCode = 1; } process.exit(); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
