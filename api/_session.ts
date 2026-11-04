/**
 * Is this a signed-in Ropi user? Checks their Supabase session token with
 * Supabase itself, and remembers good tokens for 5 minutes.
 * (Files starting with _ in api/ aren't routes on Vercel.)
 */
declare const process: { env: Record<string, string | undefined> };

const seen = new Map<string, number>();

export async function signedIn(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
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

export const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
