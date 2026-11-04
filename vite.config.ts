import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * In development, serve api/*.ts (the Vercel Functions) from the dev server,
 * so /api/interviewer and /api/muse work locally exactly as deployed.
 * Server-only variables (ELEVENLABS_API_KEY, MUSE_API_KEY) are read from .env
 * here and never reach the page.
 */
function devApi(mode: string): Plugin {
  return {
    name: 'ropi-dev-api',
    configureServer(server: ViteDevServer) {
      const env = loadEnv(mode, process.cwd(), '');
      for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;
      process.env.MUSE_API_KEY ??= env.VITE_MUSE_API_KEY;
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const m = url.pathname.match(/^\/api\/(interviewer|muse|llm)(?:\/(.*))?$/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const target = new URL(`http://localhost/api/${m[1]}`);
          if (m[2]) target.searchParams.set('path', m[2]);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const r: Response = await mod.default(new Request(target, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks) }));
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          if (r.body) for await (const c of r.body as unknown as AsyncIterable<Uint8Array>) res.write(c);
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { message: String((e as Error).message) } }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(mode)],
  // A quick tunnel lets ElevenLabs reach /api/llm while developing
  server: { allowedHosts: ['.trycloudflare.com'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
