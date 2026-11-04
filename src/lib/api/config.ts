/**
 * Where Ropi's model calls go, and how they're signed.
 *
 * Deployed (VITE_MUSE_PROXY=/api/muse): the browser never sees the Meta key.
 * Calls go to Ropi's own server function (api/muse.ts), signed with your
 * Supabase session; the function checks it and adds the key on the server.
 *
 * Local development (VITE_MUSE_API_KEY in .env): the browser calls Meta
 * directly. Anything named VITE_* is built into the page, so never deploy that way.
 */
import { supabase } from '@/lib/supabase';

const KEY = import.meta.env.VITE_MUSE_API_KEY as string | undefined;
const PROXY = (import.meta.env.VITE_MUSE_PROXY as string | undefined)?.replace(/\/+$/, '');

export const museViaProxy = !!PROXY;
export const MUSE_BASE = PROXY || (import.meta.env.VITE_META_API_BASE_URL as string | undefined) || 'https://api.meta.ai/v1';
/** Can Ropi reach the model at all? */
export const museReady = museViaProxy || !!KEY;
/** Live listening opens a WebSocket straight to Meta, which needs the key in the browser: local development only */
export const museRealtimeKey: string | undefined = museViaProxy ? undefined : KEY;

/** Your Ropi session, for Ropi's own server functions (/api/interviewer) */
export async function sessionAuth(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Authorization for a model call: your session (deployed) or the key (local) */
export async function museAuth(): Promise<Record<string, string>> {
  if (!museViaProxy) return KEY ? { Authorization: `Bearer ${KEY}` } : {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
