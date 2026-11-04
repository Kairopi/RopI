/**
 * A one-time link to start a live practice interview (ElevenLabs Agents).
 * The agent listens and speaks; its brain is Meta's Muse Spark (custom LLM,
 * key stored as an ElevenLabs secret). The ElevenLabs key stays here.
 * GET /api/interviewer -> { signedUrl } for signed-in Ropi users only.
 */
import { bearer, json, signedIn } from './_session';

export const config = { runtime: 'edge' };
declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.ELEVENLABS_API_KEY;
  const agent = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agent) return json(500, { error: { message: 'Live practice isn’t set up on the server yet.' } });
  if (!(await signedIn(bearer(req)))) return json(401, { error: { message: 'Sign in to Ropi first.' } });
  const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`, { headers: { 'xi-api-key': key } });
  const j = (await r.json().catch(() => ({}))) as { signed_url?: string };
  if (!r.ok || !j.signed_url) return json(502, { error: { message: `Couldn’t start the live interview (${r.status}).` } });
  return json(200, { signedUrl: j.signed_url });
}
