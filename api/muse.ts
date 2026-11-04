/**
 * Ropi's model proxy (Vercel Function, Edge runtime).
 *
 * The browser calls /api/muse/<path>; this checks the caller is signed in to
 * Ropi (their Supabase session token), then forwards the request to Meta's
 * Model API with the key, which only lives here (MUSE_API_KEY, a server-only
 * environment variable). Responses, including streams, pass straight through.
 *
 * Only the endpoints Ropi uses are allowed, and bodies are capped, so the
 * proxy can't be used as a general key for anything else.
 */
export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const UPSTREAM = 'https://api.meta.ai/v1';
const ALLOWED = new Set(['chat/completions', 'responses', 'asr/transcribe', 'models', 'images/generations']);
const MAX_BYTES = 6 * 1024 * 1024;

// Signed-in sessions we've already checked (token -> expiry, ms), so most calls skip the round trip
const seen = new Map<string, number>();

async function signedIn(token: string): Promise<boolean> {
  const now = Date.now();
  const until = seen.get(token);
  if (until && until > now) return true;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return false;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  if (seen.size > 5000) seen.clear();
  seen.set(token, now + 5 * 60_000);
  return true;
}

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { message } }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.MUSE_API_KEY;
  if (!key) return json(500, 'The server has no MUSE_API_KEY set.');

  const url = new URL(req.url);
  const path = (url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/muse\/?/, '')).replace(/^\/+|\/+$/g, '');
  if (!ALLOWED.has(path)) return json(404, 'Not an endpoint Ropi uses.');
  if (!['GET', 'POST'].includes(req.method)) return json(405, 'Method not allowed.');

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !(await signedIn(token))) return json(401, 'Sign in to Ropi first.');

  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) return json(413, 'That upload is too large.');

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  const type = req.headers.get('content-type');
  if (type) headers['Content-Type'] = type;
  const accept = req.headers.get('accept');
  if (accept) headers.Accept = accept;

  const upstream = await fetch(`${UPSTREAM}/${path}`, {
    method: req.method,
    headers,
    body: req.method === 'POST' ? await req.arrayBuffer() : undefined,
  });

  // Streams (text/event-stream) and JSON pass straight through
  const out = new Headers({ 'Cache-Control': 'no-store' });
  const ct = upstream.headers.get('content-type');
  if (ct) out.set('Content-Type', ct);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
