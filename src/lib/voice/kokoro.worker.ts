/// <reference lib="webworker" />
/**
 * Kokoro-82M (open-weight neural text-to-speech) running in a Web Worker, so
 * the page stays responsive while it speaks. The model (~92 MB, 8-bit) is
 * downloaded once from Hugging Face and cached by the browser.
 * https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
 *
 * messages in:  { type: 'load' } | { type: 'speak', id, text, voice, speed }
 * messages out: { type: 'progress', pct } | { type: 'ready', device } | { type: 'audio', id, samples, rate } | { type: 'error', id?, message }
 */
import { KokoroTTS } from 'kokoro-js';

let tts: KokoroTTS | null = null;
let loading: Promise<KokoroTTS> | null = null;

async function load(): Promise<KokoroTTS> {
  if (tts) return tts;
  loading ??= (async () => {
    // WebGPU only when the browser actually hands us a GPU (having navigator.gpu isn't enough)
    const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    const hasGpu = gpu ? await gpu.requestAdapter().then((a) => !!a).catch(() => false) : false;
    const files = new Map<string, number>();
    const progress_callback = (p: { status: string; file?: string; progress?: number }) => {
      if (p.status === 'progress' && p.file) {
        files.set(p.file, p.progress ?? 0);
        const pct = Math.round([...files.values()].reduce((a, b) => a + b, 0) / files.size);
        self.postMessage({ type: 'progress', pct });
      }
    };
    const open = (device: 'webgpu' | 'wasm') =>
      KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: device === 'webgpu' ? 'fp32' : 'q8', device, progress_callback });
    let device: 'webgpu' | 'wasm' = hasGpu ? 'webgpu' : 'wasm';
    let model: KokoroTTS;
    try {
      model = await open(device);
    } catch (e) {
      if (device !== 'webgpu') throw e;
      device = 'wasm';
      model = await open('wasm');
    }
    tts = model;
    self.postMessage({ type: 'ready', device });
    return model;
  })();
  return loading;
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      await load();
    } else if (m.type === 'speak') {
      const model = await load();
      const audio = await model.generate(m.text, { voice: m.voice ?? 'af_heart', speed: m.speed ?? 1 });
      const samples = audio.audio as Float32Array;
      self.postMessage({ type: 'audio', id: m.id, samples, rate: audio.sampling_rate }, [samples.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
  }
};
