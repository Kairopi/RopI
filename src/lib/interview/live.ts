/**
 * A live practice interview you talk through, out loud.
 *
 * How production voice agents are built (Pipecat, LiveKit Agents, ElevenLabs
 * Agents): streaming speech-to-text, a turn detector that knows when you've
 * finished, the LLM streaming its reply, and streaming text-to-speech that
 * starts talking on the first words, with barge-in. Ropi uses ElevenLabs
 * Agents for the ears, turn-taking and voice (Flash, ~75 ms to first audio)
 * and Meta's Muse Spark as the brain: the agent calls Muse as a custom LLM,
 * with minimal reasoning so replies start fast. The interviewer follows up on
 * what you actually said.
 */
import { Conversation } from '@elevenlabs/client';
import { sessionAuth } from '@/lib/api/config';

export interface LiveTurn {
  who: 'you' | 'ropi';
  text: string;
  at: number;
}

export interface LiveHandlers {
  onTurn: (t: LiveTurn) => void;
  /** Who's talking now */
  onMode: (speaking: 'ropi' | 'you') => void;
  onStatus: (s: string) => void;
  onEnd: (reason: string) => void;
  onError: (message: string) => void;
}

export interface LiveSession {
  end: () => Promise<void>;
  /** Your mic level 0-1, for a meter */
  inputLevel: () => number;
  /** Ropi's voice level 0-1 */
  outputLevel: () => number;
}

export async function startLiveInterview(vars: { role: string; kind: string; scenario: string; about: string }, h: LiveHandlers): Promise<LiveSession> {
  const r = await fetch('/api/interviewer', { headers: await sessionAuth() });
  const j = (await r.json().catch(() => ({}))) as { signedUrl?: string; error?: { message?: string } };
  if (!r.ok || !j.signedUrl) throw new Error(j.error?.message ?? 'Couldn’t start the live interview.');

  const conversation = await Conversation.startSession({
    signedUrl: j.signedUrl,
    connectionType: 'websocket',
    dynamicVariables: { role: vars.role, kind: vars.kind, scenario: vars.scenario, about: vars.about || 'Not shared.' },

    onMessage: (m: { source?: string; message?: string }) => {
      const text = String(m.message ?? '').trim();
      if (text) h.onTurn({ who: m.source === 'user' ? 'you' : 'ropi', text, at: Date.now() });
    },
    onModeChange: ({ mode }: { mode: string }) => h.onMode(mode === 'speaking' ? 'ropi' : 'you'),
    onStatusChange: ({ status }: { status: string }) => h.onStatus(status),
    onError: (message: unknown, ctx?: unknown) => {
      console.warn('[live] error', message, ctx);
      h.onError(typeof message === 'string' ? message : 'The live interview had a problem.');
    },
    onDisconnect: (d: { reason?: string; message?: string; closeReason?: string } | undefined) => {
      if (d?.reason === 'error') console.warn('[live] disconnected', JSON.stringify(d));
      h.onEnd(d?.reason ?? 'ended');
    },
  } as Parameters<typeof Conversation.startSession>[0]);

  return {
    end: async () => {
      await conversation.endSession().catch(() => undefined);
    },
    inputLevel: () => {
      try {
        return conversation.getInputVolume();
      } catch {
        return 0;
      }
    },
    outputLevel: () => {
      try {
        return conversation.getOutputVolume();
      } catch {
        return 0;
      }
    },
  };
}
