/**
 * Listening with Meta's Muse Voice Transcribe (realtime), in the browser.
 *
 * wss://api.meta.ai/v1/asr/realtime: the key goes in the first JSON frame (no
 * headers needed, so a browser can connect directly). ENDPOINTING mode means
 * the model itself decides when you've finished a sentence and sends
 * `speechComplete`; meanwhile `transcript` partials show your words as you
 * speak. Audio is the mic, resampled to 24 kHz signed 16-bit mono (the model's
 * native rate), sent in ~85 ms frames as it's captured (real-time pacing).
 * Docs: https://dev.meta.ai/docs/speech-to-text (checked 2026-11-04).
 *
 * Works in any browser with a microphone (Chrome, Edge, Safari, Firefox, Brave),
 * unlike the browser's own speech recognition.
 */
import { SpeechError, type Heard } from './speech-manager';

const KEY = import.meta.env.VITE_MUSE_API_KEY as string | undefined;
const BASE = (import.meta.env.VITE_META_API_BASE_URL as string | undefined) || 'https://api.meta.ai/v1';
const WS_URL = BASE.replace(/^http/, 'ws') + '/asr/realtime';
const RATE = 24000;

export const museListenAvailable = () =>
  !!KEY && typeof window !== 'undefined' && typeof WebSocket !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== 'undefined';

/** Float32 at `from` Hz -> Int16 PCM at 24 kHz (linear interpolation) */
function toPcm24k(input: Float32Array, from: number): Int16Array {
  const ratio = from / RATE;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const s = input[i0] + (input[i1] - input[i0]) * (x - i0);
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  return out;
}

export interface MuseListenOptions {
  onInterim?: (text: string) => void;
  /** 0-1 mic level, about 12 times a second (for a live meter) */
  onLevel?: (level: number) => void;
  /** Words the model might mishear: topic names, product names */
  keywords?: string[];
  /** Give up if nobody starts speaking within this long */
  noSpeechMs?: number;
  /** After the model closes a sentence, wait this long for another before answering */
  graceMs?: number;
  /** Hard cap on one turn */
  maxMs?: number;
}

let active: { stop: () => void } | null = null;

/** Stop the current Muse listening session (it resolves with what was heard so far) */
export function stopMuseListening() {
  active?.stop();
}

export async function listenWithMuse(opts: MuseListenOptions = {}): Promise<Heard> {
  if (!museListenAvailable()) throw new SpeechError('not-supported');
  active?.stop();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    const name = (e as DOMException)?.name;
    throw new SpeechError(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : name === 'NotFoundError' ? 'audio-capture' : 'start-failed');
  }

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is old but works in every browser; 4096 frames is ~85 ms at 48 kHz
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);

  const ws = new WebSocket(`${WS_URL}?sessionId=ropi-${Date.now().toString(36)}`);
  ws.binaryType = 'arraybuffer';

  return new Promise<Heard>((resolve, reject) => {
    let ready = false;
    let settled = false;
    let heardSpeech = false;
    let partial = '';
    // Sentences the model already closed. A short pause between two sentences of one thought
    // ("Make me a note on cold starts. I want to practise it tonight.") must not cut you off.
    const done: string[] = [];
    let grace: ReturnType<typeof setTimeout> | undefined;
    // Turns can overlap: the next sentence may start before the last one's text arrives
    const open = new Set<number>();
    const said = () => [...done, partial].filter(Boolean).join(' ');
    const queue: ArrayBuffer[] = [];

    const cleanup = () => {
      clearTimeout(noSpeech);
      clearTimeout(cap);
      clearTimeout(grace);
      proc.onaudioprocess = null;
      try {
        source.disconnect();
        proc.disconnect();
        mute.disconnect();
      } catch {
        // already disconnected
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
      if (active === handle) active = null;
    };
    const endInput = () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'endStream' }));
        } catch {
          // closing anyway
        }
      }
    };
    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      endInput();
      setTimeout(() => ws.readyState === WebSocket.OPEN && ws.close(1000), 1500);
      const t = text.trim();
      if (t) resolve({ transcript: t, alternatives: [t], confidence: null });
      else reject(new SpeechError('no-speech'));
    };
    const fail = (code: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {
        // already closed
      }
      reject(new SpeechError(code));
    };

    const handle = {
      // Tapping stop: keep what was said so far
      stop: () => finish(said()),
    };
    active = handle;

    const noSpeech = setTimeout(() => !heardSpeech && finish(''), opts.noSpeechMs ?? 8000);
    const cap = setTimeout(() => finish(said()), opts.maxMs ?? 30000);

    proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      if (opts.onLevel) {
        let sum = 0;
        for (let i = 0; i < input.length; i += 4) sum += input[i] * input[i];
        opts.onLevel(Math.min(1, Math.sqrt(sum / (input.length / 4)) * 6));
      }
      const pcm = toPcm24k(input, ctx.sampleRate).buffer as ArrayBuffer;
      if (ready && ws.readyState === WebSocket.OPEN) ws.send(pcm);
      else if (queue.length < 40) queue.push(pcm); // about 3 s while the handshake completes
    };

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          authorization: { accessToken: `Bearer ${KEY}` },
          audioEncoding: 'PCM_24KHZ',
          model: 'muse-voice-transcribe-1.0',
          mode: 'ENDPOINTING',
          partialMode: 'CUMULATIVE',
          emitAudioProgress: false,
          languageBias: ['English'],
          ...(opts.keywords?.length ? { keywords: opts.keywords.slice(0, 30) } : {}),
        })
      );
    };
    ws.onmessage = (m) => {
      if (typeof m.data !== 'string') return;
      let ev: any;
      try {
        ev = JSON.parse(m.data);
      } catch {
        return;
      }
      if (!ready && ev.sessionId && !ev.type) {
        ready = true;
        for (const b of queue.splice(0)) ws.send(b);
        return;
      }
      if (ev.type === 'error') return fail(/auth|permission|401|403/i.test(String(ev.message)) ? 'not-allowed-key' : 'network');
      if (ev.type === 'speechStart') {
        heardSpeech = true;
        if (typeof ev.turnId === 'number') open.add(ev.turnId);
        clearTimeout(grace); // they kept going
      }
      if (ev.type === 'transcript' && typeof ev.transcript === 'string') {
        heardSpeech = true;
        clearTimeout(grace);
        partial = ev.transcript;
        opts.onInterim?.(said());
      }
      if (ev.type === 'speechComplete') {
        done.push(String(ev.transcript ?? partial).trim());
        if (typeof ev.turnId === 'number') open.delete(ev.turnId);
        // Still speaking (another turn is open): its partial is the live text, keep listening
        if (open.size === 0) partial = '';
        opts.onInterim?.(said());
        clearTimeout(grace);
        if (open.size === 0) grace = setTimeout(() => finish(said()), opts.graceMs ?? 900);
      }
    };
    ws.onerror = () => fail('network');
    ws.onclose = (e) => {
      if (settled) return;
      if (said()) finish(said());
      else fail(e.code === 1008 && !ready ? 'not-allowed-key' : 'network');
    };
  });
}

/** One recording (mono 16-bit WAV, 16 or 24 kHz) -> text, with Muse Voice Transcribe (POST /asr/transcribe) */
export async function transcribeRecording(wav: Blob, keywords: string[] = []): Promise<string> {
  if (!KEY) throw new SpeechError('not-supported');
  const form = new FormData();
  form.append(
    'request',
    new Blob([JSON.stringify({ model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV', mode: 'PUSH_TO_TALK', ...(keywords.length ? { keywords } : {}) })], { type: 'application/json' })
  );
  form.append('audio', wav, 'speech.wav');
  const r = await fetch(`${BASE}/asr/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `Muse transcribe error ${r.status}`);
  return String(j.transcript ?? '').trim();
}
