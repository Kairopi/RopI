// Test harness: loads app modules through Vite (same aliases + import.meta.env as the browser).
// Usage: node .tmp-check/run.mjs .tmp-check/<test>.ts
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const mod = await server.ssrLoadModule('/' + process.argv[2].replace(/\\/g, '/'));
  await mod.default();
} catch (error) {
  console.error('TEST CRASHED:', error?.stack || error);
  process.exitCode = 1;
} finally {
  await server.close();
}
