/**
 * The live interviewer's brain: an OpenAI-compatible /chat/completions that
 * ElevenLabs Agents calls (custom LLM), answered by Meta's Muse Spark.
 *
 * Why not point ElevenLabs straight at Meta? It adds fields Meta rejects
 * (`user_id`, `elevenlabs_extra_body`), and a voice reply needs minimal
 * reasoning to start fast. So this keeps only the fields Meta accepts, sets
 * reasoning_effort to minimal, and streams Meta's answer straight back.
 * Only ElevenLabs can call it: it must send ROPI_LLM_SECRET as its API key.
 */
export const config = { runtime: 'edge' };
declare const process: { env: Record<string, string | undefined> };

const KEEP = ['messages', 'stream', 'stream_options', 'temperature', 'max_tokens', 'max_completion_tokens', 'tools', 'tool_choice', 'parallel_tool_calls', 'top_p', 'stop'];

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.ROPI_LLM_SECRET;
  const key = process.env.MUSE_API_KEY;
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !key || given !== secret) return new Response(JSON.stringify({ error: { message: 'Not allowed.' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clean: Record<string, unknown> = { model: 'muse-spark-1.3', reasoning_effort: 'minimal' };
  for (const k of KEEP) if (body[k] !== undefined) clean[k] = body[k];
  // Short spoken turns: cap the reply (reasoning shares the budget, so leave room)
  if (!clean.max_tokens && !clean.max_completion_tokens) clean.max_tokens = 1500;
  if (Array.isArray(clean.tools) && clean.tools.length === 0) {
    delete clean.tools;
    delete clean.tool_choice;
  }

  const upstream = await fetch('https://api.meta.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(clean),
  });
  const out = new Headers({ 'Cache-Control': 'no-store' });
  out.set('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
