/**
 * Ropi's natural voice: Kokoro-82M, an open-weight neural TTS model, running on
 * your own device (WebGPU when available, otherwise WebAssembly). No server, no
 * per-word cost. Meta's Model API has speech-to-text but no text-to-speech, so
 * this is the voice; Muse does the thinking and the listening.
 *
 * Speaks one sentence-sized chunk at a time and writes the next chunk while the
 * current one plays, so it starts talking after the first chunk is ready.
 */

export const KOKORO_VOICES = [
  { id: 'af_heart', label: 'Heart (warm, US)' },
  { id: 'af_bella', label: 'Bella (bright, US)' },
  { id: 'am_michael', label: 'Michael (calm, US)' },
  { id: 'bf_emma', label: 'Emma (UK)' },
  { id: 'bm_george', label: 'George (UK)' },
] as const;

type Listener = (s: KokoroState) => void;
export interface KokoroState {
  status: 'off' | 'loading' | 'checking' | 'ready' | 'slow' | 'error';
  /** Seconds of work per second of speech on this device (under 1 = keeps up) */
  rtf?: number;
  pct: number;
  device?: string;
  error?: string;
}

let worker: Worker | null = null;
let state: KokoroState = { status: 'off', pct: 0 };
const listeners = new Set<Listener>();
const pending = new Map<number, { resolve: (a: { samples: Float32Array; rate: number }) => void; reject: (e: Error) => void }>();
let nextId = 1;
let ctx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
let generation = 0;

const set = (s: Partial<KokoroState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l(state));
};
export const kokoroState = () => state;
export function onKokoro(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const kokoroSupported = () => typeof Worker !== 'undefined' && typeof AudioContext !== 'undefined' && typeof WebAssembly !== 'undefined';

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'progress') set({ status: 'loading', pct: m.pct });
    else if (m.type === 'ready') {
      set({ status: 'checking', pct: 100, device: m.device });
      void speedCheck();
    }
    else if (m.type === 'audio') {
      pending.get(m.id)?.resolve({ samples: m.samples, rate: m.rate });
      pending.delete(m.id);
    } else if (m.type === 'error') {
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)!.reject(new Error(m.message));
        pending.delete(m.id);
      } else set({ status: 'error', error: m.message });
    }
  };
  worker.onerror = (e) => set({ status: 'error', error: e.message || 'The voice model could not start' });
  return worker;
}

/**
 * Can this device speak faster than real time? A natural voice that pauses mid-sentence
 * is worse than a plain one, so if writing 1 second of speech takes more than about a
 * second, Ropi keeps the browser voice and says why.
 */
async function speedCheck() {
  try {
    const t = performance.now();
    const a = await generate('Hi, I am Ropi. Tell me what you need.', 'af_heart', 1);
    const secs = a.samples.length / a.rate;
    const rtf = (performance.now() - t) / 1000 / Math.max(0.5, secs);
    set({ status: rtf <= 1.1 ? 'ready' : 'slow', rtf: Math.round(rtf * 10) / 10 });
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : 'The voice model failed its first try' });
  }
}

/** Download (once) and start the model */
export function loadKokoro() {
  if (!kokoroSupported()) {
    set({ status: 'error', error: 'This browser can’t run the natural voice.' });
    return;
  }
  if (state.status === 'ready' || state.status === 'loading' || state.status === 'checking' || state.status === 'slow') return;
  set({ status: 'loading', pct: 0, error: undefined });
  ensureWorker().postMessage({ type: 'load' });
}

function generate(text: string, voice: string, speed: number) {
  const id = nextId++;
  return new Promise<{ samples: Float32Array; rate: number }>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ensureWorker().postMessage({ type: 'speak', id, text, voice, speed });
  });
}

function play(samples: Float32Array, rate: number, gen: number): Promise<void> {
  return new Promise((resolve) => {
    if (gen !== generation) return resolve();
    ctx ??= new AudioContext();
    void ctx.resume();
    const buffer = ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      if (playing === src) playing = null;
      resolve();
    };
    playing = src;
    src.start();
  });
}

/** Speak chunks in order; the next chunk is generated while the current one plays */
export async function speakKokoro(chunks: string[], voice = 'af_heart', speed = 1): Promise<void> {
  const gen = ++generation;
  if (state.status !== 'ready') throw new Error('The natural voice is not loaded');
  let next = chunks.length ? generate(chunks[0], voice, speed) : null;
  for (let i = 0; i < chunks.length && next; i++) {
    const audio = await next;
    if (gen !== generation) return;
    next = i + 1 < chunks.length ? generate(chunks[i + 1], voice, speed) : null;
    await play(audio.samples, audio.rate, gen);
    if (gen !== generation) return;
  }
}

export function stopKokoro() {
  generation++;
  try {
    playing?.stop();
  } catch {
    // already stopped
  }
  playing = null;
}
