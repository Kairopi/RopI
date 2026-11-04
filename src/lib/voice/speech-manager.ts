/**
 * Speech Manager - Web Speech API Wrapper
 * 
 * Research-backed implementation based on:
 * - LEARNINGS_FROM_3_VOICE_SYSTEMS.md
 * - MDN Web Speech API best practices
 * - Browser compatibility testing (2024-2026)
 * 
 * Features:
 * - Text-to-Speech (TTS) with voice selection
 * - Speech-to-Text (STT) with error handling
 * - Browser compatibility detection
 * - Graceful degradation
 * - Fuzzy answer parsing
 */

import { listenWithMuse, museListenAvailable, stopMuseListening } from './muse-listen';
import { kokoroState, loadKokoro, speakKokoro, stopKokoro } from './kokoro';
import { waitAfter } from './endpoint';

/** Voice settings (Talk > Voice): natural = the on-device Kokoro voice */
export function voicePrefs(): { voice?: string; rate?: number; natural?: boolean; naturalVoice?: string; engine?: 'muse' | 'browser' } {
  try {
    return JSON.parse(localStorage.getItem('ropi-voice-v1') ?? '{}');
  } catch {
    return {};
  }
}

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

/** Speech recognition failure with a user-facing message */
export class SpeechError extends Error {
  constructor(public code: string) {
    super(
      {
        'no-speech': "I didn't hear anything.",
        'not-allowed': 'Microphone access is blocked. Allow it in the browser address bar, or click your answer.',
        'service-not-allowed': 'Microphone access is blocked. Allow it in the browser address bar, or click your answer.',
        'audio-capture': 'No microphone was found.',
        network: 'Voice recognition isn’t reachable from this browser. It needs Chrome or Edge with an internet connection (Brave and some others block it).',
        aborted: 'Listening stopped.',
        'start-failed': 'The microphone is busy. Try again in a moment.',
        'not-supported': 'This browser can’t listen. Try Chrome, Edge, Safari or Firefox.',
        'not-allowed-key': 'The voice service turned the connection down (check the API key).',
        'language-not-supported': 'Voice recognition doesn’t support this language here.',
      }[code] ?? `Speech recognition error (${code}).`
    );
  }
}

export interface Heard {
  transcript: string;
  /** Up to 3 guesses, best first */
  alternatives: string[];
  /** 0-1, or null when the browser doesn't report it */
  confidence: number | null;
}

export interface SpeechSupport {
  tts: boolean;
  stt: boolean;
}

export interface SpeakOptions {
  rate?: number;      // 0.1 to 10 (default: 0.9 for clarity)
  pitch?: number;     // 0 to 2 (default: 1)
  volume?: number;    // 0 to 1 (default: 1)
  voice?: SpeechSynthesisVoice;
  lang?: string;      // default: 'en-US'
}

/**
 * Speech Manager Class
 * Singleton for managing TTS and STT
 */
export class SpeechManager {
  private synthesis: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isSupported: SpeechSupport;
  private voices: SpeechSynthesisVoice[] = [];
  /** Bumped by stopSpeaking() and every speak(), so an old chunked reply stops */
  private speakGen = 0;
  private current: SpeechSynthesisUtterance | null = null;

  constructor() {
    // Check TTS support (guarded so the module can be imported outside a browser)
    const hasWindow = typeof window !== 'undefined';
    this.isSupported = {
      tts: hasWindow && 'speechSynthesis' in window,
      stt: hasWindow && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window),
    };

    // Natural voice: start loading it (from the browser cache after the first time)
    if (hasWindow && voicePrefs().natural) setTimeout(loadKokoro, 1200);

    // Initialize TTS
    if (this.isSupported.tts) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
    }

    // Initialize STT
    if (this.isSupported.stt) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // Configure recognition
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = 'en-US';
    }
  }

  /**
   * Check browser support
   */
  getSupport(): SpeechSupport {
    return { tts: this.isSupported.tts, stt: this.isSupported.stt || museListenAvailable() };
  }

  /**
   * Which ears: Meta Muse Voice Transcribe (default when the key is set: works in every
   * browser, model-detected end of speech, biased to your topic words) or the browser's own.
   */
  getEngine(): 'muse' | 'browser' {
    let pref: string | undefined;
    try {
      pref = JSON.parse(localStorage.getItem('ropi-voice-v1') ?? '{}').engine;
    } catch {
      // default
    }
    if (pref === 'browser' && this.isSupported.stt) return 'browser';
    return museListenAvailable() ? 'muse' : 'browser';
  }
  /** Who heard you last (shown in the Voice panel) */
  lastEngine: 'muse' | 'browser' | null = null;

  /**
   * Load available voices
   * Voices may load asynchronously
   */
  private loadVoices(): void {
    if (!this.synthesis) return;

    const loadVoicesImpl = () => {
      this.voices = this.synthesis!.getVoices();
    };

    loadVoicesImpl();

    // Voices may not be loaded immediately
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = loadVoicesImpl;
    }
  }

  /**
   * Get available voices. Browsers add their best (online, neural) voices a
   * moment after the page loads, so wait for that once instead of settling for
   * the first robotic one.
   */
  private voicesReady: Promise<void> | null = null;
  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.synthesis) return [];
    this.voicesReady ??= new Promise<void>((resolve) => {
      const synth = this.synthesis!;
      const done = () => {
        this.voices = synth.getVoices();
        resolve();
      };
      synth.addEventListener?.('voiceschanged', () => setTimeout(done, 150), { once: true });
      setTimeout(done, 1200);
    });
    this.voices = this.synthesis.getVoices();
    if (!this.voices.some((v) => voiceScore(v) >= 70)) await this.voicesReady;
    return this.voices;
  }

  /** The most natural-sounding voice for the language (see voiceScore) */
  async getPreferredVoice(lang: string = 'en-US'): Promise<SpeechSynthesisVoice | null> {
    const voices = (await this.getVoices()).filter((v) => v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
    return [...voices].sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang))[0] ?? null;
  }
  /**
   * Speak text (Text-to-Speech)
   *
   * Long text is spoken one short chunk at a time. Chrome's online voices stop
   * after about 15 seconds and never fire `end`, which used to leave Talk stuck
   * on "Ropi is talking". Each chunk also has a watchdog: if `end` doesn't come
   * well after the chunk should have finished, we move on.
   */
  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!this.isSupported.tts || !this.synthesis) {
      throw new Error('Text-to-speech not supported in this browser');
    }
    const synthesis = this.synthesis;
    // The natural voice, once it has downloaded; until then (or if it fails) the best browser voice
    const prefs = voicePrefs();
    if (prefs.natural && kokoroState().status === 'ready') {
      ++this.speakGen;
      if (synthesis.speaking || synthesis.pending) synthesis.cancel();
      try {
        await speakKokoro(chunkForSpeech(text, 220), prefs.naturalVoice ?? 'af_heart', options.rate ?? 1);
        return;
      } catch (e) {
        console.warn('[voice] natural voice failed, using the browser voice:', e);
      }
    }
    const voice = options.voice ?? (await this.getPreferredVoice(options.lang ?? 'en-US'));
    const gen = ++this.speakGen;

    // Only cancel when something is queued: in Chrome, cancel() immediately
    // followed by speak() can swallow the new utterance.
    if (synthesis.speaking || synthesis.pending) synthesis.cancel();

    const rate = options.rate ?? 0.9;
    for (const chunk of chunkForSpeech(text)) {
      if (gen !== this.speakGen) return; // stopped, or a newer speak() took over
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = rate;
        utterance.pitch = options.pitch ?? 1.0;
        utterance.volume = options.volume ?? 1.0;
        utterance.lang = voice?.lang ?? options.lang ?? 'en-US';
        if (voice) utterance.voice = voice;

        let done = false;
        const finish = (fn: () => void) => {
          if (done) return;
          done = true;
          clearTimeout(watchdog);
          clearInterval(keepAlive);
          fn();
        };
        // About 14 characters a second at normal speed, plus room for the voice to start
        const watchdog = setTimeout(() => finish(resolve), 4000 + (chunk.length / (14 * rate)) * 1000 * 1.6);
        // Belt and braces for the same Chrome bug: nudge long chunks along
        const keepAlive = setInterval(() => {
          if (synthesis.speaking && !synthesis.paused) {
            synthesis.pause();
            synthesis.resume();
          }
        }, 10000);

        utterance.onend = () => finish(resolve);
        utterance.onerror = (event) => {
          // stopSpeaking() / a newer speak() cancels this one: that is not a failure
          if (event.error === 'interrupted' || event.error === 'canceled') finish(resolve);
          else finish(() => reject(new Error(`Speech synthesis error: ${event.error}`)));
        };
        // Keep a reference: Chrome can garbage-collect an utterance mid-speech and drop `end`
        this.current = utterance;
        synthesis.speak(utterance);
      });
    }
  }

  /**
   * Stop speaking immediately
   */
  stopSpeaking(): void {
    this.speakGen++;
    stopKokoro();
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }
  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false;
  }

  /**
   * Listen for speech (Speech-to-Text)
   * 
   * Returns recognized transcript
   */
  async listen(): Promise<string> {
    return (await this.listenDetailed()).transcript;
  }

  /**
   * Listen once, with the live (interim) transcript as you speak, up to 3
   * alternative guesses, and the recogniser's confidence (0-1; some browsers
   * always report 0, which we treat as unknown).
   *
   * A fresh recogniser every time: reusing one throws "already started" if the
   * last session hasn't fully closed, which showed up as the mic doing nothing.
   * An empty final result (Edge does this on a cough or background noise) counts
   * as "didn't hear anything", instead of leaving the page stuck on "Listening".
   */
  async listenDetailed(options: { onInterim?: (text: string) => void; onLevel?: (level: number) => void; keywords?: string[]; prefer?: 'muse' | 'browser'; quick?: boolean } = {}): Promise<Heard> {
    const engine = options.prefer === 'browser' && this.isSupported.stt ? 'browser' : options.prefer === 'muse' && museListenAvailable() ? 'muse' : this.getEngine();
    if (engine === 'muse') {
      try {
        const heard = await listenWithMuse({ onInterim: options.onInterim, onLevel: options.onLevel, keywords: options.keywords });
        this.lastEngine = 'muse';
        return heard;
      } catch (e) {
        // Silence, a blocked mic or a stop are answers; a connection problem falls back to the browser
        const code = e instanceof SpeechError ? e.code : '';
        if (!['network', 'not-allowed-key', 'not-supported'].includes(code) || !this.isSupported.stt) throw e;
        console.warn('[voice] Muse listening failed, using the browser instead:', code);
      }
    }
    this.lastEngine = 'browser';
    return this.listenBrowser(options);
  }

  /**
   * The browser's recogniser, kept open across pauses (continuous) with Ropi
   * deciding when you've finished: Chrome on its own stops after about a second
   * of silence, which cut people off mid-thought. A pause after "and..." or a
   * single word waits much longer than a pause after a finished question
   * (see endpoint.ts). Tapping stop sends what was heard.
   */
  private async listenBrowser(options: { onInterim?: (text: string) => void; quick?: boolean } = {}): Promise<Heard> {
    if (!this.isSupported.stt) {
      throw new Error('Speech recognition not supported in this browser');
    }
    try {
      this.recognition?.abort?.();
    } catch {
      // not running
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    // Short answers (a quiz letter) keep the browser's own quick end; conversation stays open
    recognition.continuous = !options.quick;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    this.recognition = recognition;

    return new Promise((resolve, reject) => {
      let settled = false;
      let finals: string[] = [];
      let alternatives: string[] = [];
      let confidence: number | null = null;
      let interim = '';
      let lastActivity = Date.now();
      let heardAny = false;
      const startedAt = Date.now();
      const text = () => [...finals, interim].join(' ').replace(/\s+/g, ' ').trim();
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearInterval(tick);
        fn();
      };
      const done = () => {
        const t = text();
        if (t) finish(() => resolve({ transcript: t, alternatives: alternatives.length && finals.length === 1 && !interim ? alternatives : [t], confidence }));
        else finish(() => reject(new SpeechError('no-speech')));
      };

      // Our own end-of-turn: silence long enough for what was said
      const tick = setInterval(() => {
        const t = text();
        if (t && Date.now() - lastActivity > waitAfter(t)) {
          try {
            recognition.stop();
          } catch {
            // already stopping
          }
          done();
        } else if ((!heardAny && Date.now() - startedAt > 8000) || (!t && Date.now() - lastActivity > 9000) || Date.now() - startedAt > 45000) {
          try {
            recognition.stop();
          } catch {
            // already stopping
          }
          done();
        }
      }, 150);

      recognition.onresult = (event: any) => {
        heardAny = true;
        lastActivity = Date.now();
        const nextFinals: string[] = [];
        let nextInterim = '';
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i];
          const t = String(r[0]?.transcript ?? '').trim();
          if (!t) continue;
          if (r.isFinal) {
            nextFinals.push(t);
            if (i === event.results.length - 1) {
              alternatives = Array.from(r as ArrayLike<any>).map((a: any) => String(a.transcript).trim()).filter(Boolean);
              confidence = Number(r[0].confidence) > 0 ? Number(r[0].confidence) : null;
            }
          } else nextInterim += (nextInterim ? ' ' : '') + t;
        }
        finals = nextFinals;
        interim = nextInterim;
        if (text()) options.onInterim?.(text());
        if (options.quick && finals.length) done();
      };
      recognition.onspeechstart = () => {
        heardAny = true;
        lastActivity = Date.now();
      };
      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' && text()) return done();
        if (event.error === 'aborted' && settled) return;
        finish(() => reject(new SpeechError(event.error)));
      };
      // Ended (by us, by stopListening(), or by the browser): send whatever was said
      recognition.onend = () => done();

      try {
        recognition.start();
      } catch {
        finish(() => reject(new SpeechError('start-failed')));
      }
    });
  }
  /**
   * Stop listening
   */
  stopListening(): void {
    stopMuseListening();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        // Already stopped
      }
    }
  }

  /**
   * Check if currently listening
   */
  isListening(): boolean {
    // Web Speech API doesn't expose listening state directly
    // This would need to be tracked externally
    return false;
  }
}

/**
 * Split text for speech: whole sentences, at most ~180 characters each, so no
 * single utterance runs long enough to hit Chrome's 15-second cut-off.
 */
export function chunkForSpeech(text: string, max = 180): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+[)"']*|[^.!?]+$/g) ?? [];
  const out: string[] = [];
  let cur = '';
  const push = (s: string) => {
    if (s.trim()) out.push(s.trim());
  };
  for (const raw of sentences) {
    const s = raw.trim();
    if (s.length > max) {
      push(cur);
      cur = '';
      // A very long sentence: break at commas, then at spaces
      let rest = s;
      while (rest.length > max) {
        const cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf(' ', max));
        const at = cut > max * 0.4 ? cut + 1 : max;
        push(rest.slice(0, at));
        rest = rest.slice(at);
      }
      cur = rest;
    } else if ((cur + ' ' + s).trim().length > max) {
      push(cur);
      cur = s;
    } else {
      cur = (cur + ' ' + s).trim();
    }
  }
  push(cur);
  return out;
}

/**
 * How natural a browser voice sounds, 0-100. Based on the Readium project's tested
 * list of recommended Web Speech voices: neural "Natural" voices (Edge, Windows 11),
 * Apple's Premium/Enhanced voices and Google's online voices sound human; the old
 * Windows desktop voices (David, Zira, Mark) sound robotic.
 * https://github.com/HadrienGardeur/web-speech-recommended-voices
 */
export function voiceScore(v: Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>, lang = 'en-US'): number {
  const n = v.name;
  let s = 30;
  if (/\b(Natural|Neural)\b/i.test(n)) s = 95;
  else if (/\b(Premium|Enhanced)\b/i.test(n)) s = 88;
  else if (/^Google\b/i.test(n)) s = 80;
  else if (/\b(Samantha|Ava|Allison|Susan|Karen|Daniel|Serena|Moira|Tessa)\b/.test(n)) s = 65;
  else if (/Microsoft (David|Zira|Mark|Hazel|George|Susan)\b/i.test(n) || /Desktop/i.test(n)) s = 15;
  else if (/espeak|eSpeak/i.test(n)) s = 5;
  if (!v.localService) s += 2;
  if (v.lang === lang) s += 3;
  return s;
}

// Singleton instance
export const speechManager = new SpeechManager();

/**
 * Parse voice answer with fuzzy matching
 * 
 * Research: Users say answers in many ways:
 * - "A" or "a"
 * - "option A"
 * - "the answer is A"
 * - "A period" or "A."
 * - Partial content match
 */
// How speech recognizers commonly write each spoken letter
const LETTER_SOUNDS: string[][] = [
  ['a', 'ay', 'eh', 'hey'],
  ['b', 'bee', 'be'],
  ['c', 'see', 'sea', 'si'],
  ['d', 'dee', 'the'],
];
const NUMBER_WORDS: string[][] = [
  ['1', 'one', 'first'],
  ['2', 'two', 'to', 'too', 'second'],
  ['3', 'three', 'third'],
  ['4', 'four', 'for', 'fourth'],
];
const FILLER = new Set(['the', 'answer', 'is', 'its', "it's", 'i', 'think', 'say', 'pick', 'choose', 'go', 'with', 'um', 'uh', 'my', 'final', 'please', 'option', 'letter', 'choice', 'number']);

// Ignored when matching spoken words against option text
const STOPWORDS = new Set(['and', 'for', 'the', 'with', 'from', 'that', 'this', 'are', 'not', 'into', 'its', 'only']);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Parse a spoken answer into an option index (-1 = not understood).
 *
 * Handles: "B", "bee", "option C", "the answer is D", "number two",
 * "I think it's A", and saying (part of) the option text itself.
 */
export function parseVoiceAnswer(transcript: string, options: string[]): number {
  const text = normalize(transcript);
  if (!text) return -1;
  const words = text.split(' ');
  const count = Math.min(options.length, 4);

  // 1. Explicit marker: "option c", "letter b", "answer d", "number two", "choice 3"
  const marker = text.match(/\b(?:option|letter|answer|choice|number)\s+(?:is\s+)?([a-z0-9]+)\b/);
  // "the answer is a lambda function" is the article "a", not option A
  const articleA = marker && marker[1] === 'a' && text.slice((marker.index ?? 0) + marker[0].length).trim().length > 0;
  if (marker && !articleA) {
    const token = marker[1];
    for (let i = 0; i < count; i++) {
      if (LETTER_SOUNDS[i].includes(token) || NUMBER_WORDS[i].includes(token)) return i;
    }
  }

  // 2. Short answers ("b", "bee", "it's c", "two", "I'd go for C"): strip filler and look at
  //    what's left. Only for short utterances, so the article "a" in a sentence isn't option A.
  const core = words.filter((w) => !FILLER.has(w));
  if (core.length === 1) {
    const token = core[0];
    for (let i = 0; i < count; i++) {
      if (LETTER_SOUNDS[i].includes(token) || NUMBER_WORDS[i].includes(token)) return i;
    }
  }
  // "I'd go for C" / "I'll take B": a short phrase ending in a bare letter
  if (words.length <= 5) {
    const last = words[words.length - 1];
    const letter = ['a', 'b', 'c', 'd'].indexOf(last);
    if (letter >= 0 && letter < count && last !== 'a') return letter; // trailing "a" is too ambiguous
  }

  // 3. The user said the option text: score every option, accept only a clear winner
  const tokenSet = new Set(words);
  const scores = options.map((option) => {
    const optionTokens = normalize(option)
      .split(' ')
      .filter((w) => (w.length > 2 || /\d/.test(w)) && !FILLER.has(w) && !STOPWORDS.has(w));
    if (optionTokens.length === 0) return 0;
    const hits = optionTokens.filter((w) => tokenSet.has(w)).length;
    return hits / optionTokens.length;
  });
  const best = Math.max(...scores);
  const winners = scores.filter((s) => s === best).length;
  if (best >= 0.5 && winners === 1) return scores.indexOf(best);

  return -1;
}

/** Try each recognition guess in turn; the first one that maps to an option wins */
export function parseVoiceAnswerFromAlternatives(alternatives: string[], options: string[]): { index: number; heard: string } {
  for (const alt of alternatives) {
    const index = parseVoiceAnswer(alt, options);
    if (index !== -1) return { index, heard: alt };
  }
  return { index: -1, heard: alternatives[0] ?? '' };
}

export type VoiceCommand = 'repeat' | 'skip' | 'stop' | 'options' | 'yes' | 'no' | null;

/** Spoken control words during a voice quiz. Checked before answers. */
export function parseVoiceCommand(transcript: string): VoiceCommand {
  const t = normalize(transcript);
  if (!t) return null;
  if (/^(yes|yeah|yep|correct|right|that's right|that is right|yup|sure)$/.test(t)) return 'yes';
  if (/^(no|nope|wrong|not that|that's wrong)$/.test(t)) return 'no';
  if (/\b(repeat|again|say that again|one more time|pardon|what was the question)\b/.test(t)) return 'repeat';
  if (/\b(read (the )?options|what are the options|options)\b/.test(t)) return 'options';
  if (/\b(skip|next question|pass|i don't know|no idea|dunno)\b/.test(t)) return 'skip';
  if (/\b(stop|pause|quit|end quiz|that's enough)\b/.test(t)) return 'stop';
  return null;
}

/**
 * Format question with options for TTS
 * Makes spoken questions clearer
 */
export function formatQuestionForSpeech(question: string, options: string[]): string {
  let speech = question;
  
  // Remove question mark for natural pause
  if (speech.endsWith('?')) {
    speech = speech.slice(0, -1);
  }
  
  return speech;
}

/**
 * Format options for TTS
 * Returns array of option speeches
 */
export function formatOptionsForSpeech(options: string[]): string[] {
  return options.map((option, index) => {
    const letter = String.fromCharCode(65 + index);
    return `${letter}. ${option}`;
  });
}
