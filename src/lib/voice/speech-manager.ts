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
        network: 'Speech recognition needs an internet connection.',
        aborted: 'Listening stopped.',
        'start-failed': 'The microphone is busy. Try again in a moment.',
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

  constructor() {
    // Check TTS support (guarded so the module can be imported outside a browser)
    const hasWindow = typeof window !== 'undefined';
    this.isSupported = {
      tts: hasWindow && 'speechSynthesis' in window,
      stt: hasWindow && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window),
    };

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
    return { ...this.isSupported };
  }

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
   * Get available voices
   */
  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (this.voices.length > 0) {
        resolve(this.voices);
      } else {
        // Wait for voices to load
        setTimeout(() => {
          this.loadVoices();
          resolve(this.voices);
        }, 100);
      }
    });
  }

  /**
   * Get preferred voice (Natural, Premium, or Enhanced)
   */
  async getPreferredVoice(lang: string = 'en-US'): Promise<SpeechSynthesisVoice | null> {
    const voices = await this.getVoices();
    
    // Priority order: Natural > Premium > Enhanced > Default
    const priorities = ['Natural', 'Premium', 'Enhanced', 'Google', 'Microsoft'];
    
    for (const priority of priorities) {
      const voice = voices.find(v => 
        v.lang.startsWith(lang.split('-')[0]) && 
        v.name.includes(priority)
      );
      if (voice) return voice;
    }
    
    // Fallback: first voice for language
    return voices.find(v => v.lang.startsWith(lang.split('-')[0])) || voices[0] || null;
  }

  /**
   * Speak text (Text-to-Speech)
   * 
   * Research: 0.9 rate for clarity, 1.0 pitch for natural sound
   */
  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!this.isSupported.tts || !this.synthesis) {
      throw new Error('Text-to-speech not supported in this browser');
    }

    const synthesis = this.synthesis;
    const voice = options.voice ?? (await this.getPreferredVoice(options.lang ?? 'en-US'));

    // Only cancel when something is queued: in Chrome, cancel() immediately
    // followed by speak() can swallow the new utterance.
    if (synthesis.speaking || synthesis.pending) synthesis.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply options
      utterance.rate = options.rate ?? 0.9;      // Research: 0.9 = clear
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;
      utterance.lang = options.lang ?? 'en-US';
      if (voice) utterance.voice = voice;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        // stopSpeaking() / a newer speak() cancels this one: that is not a failure
        if (event.error === 'interrupted' || event.error === 'canceled') resolve();
        else reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      synthesis.speak(utterance);
    });
  }

  /**
   * Stop speaking immediately
   */
  stopSpeaking(): void {
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
   */
  async listenDetailed(options: { onInterim?: (text: string) => void } = {}): Promise<Heard> {
    if (!this.isSupported.stt || !this.recognition) {
      throw new Error('Speech recognition not supported in this browser');
    }
    this.recognition.interimResults = !!options.onInterim;
    this.recognition.maxAlternatives = 3;

    return new Promise((resolve, reject) => {
      // Settle exactly once: result, error, or "ended with nothing heard"
      let settled = false;
      let lastInterim = '';
      const finish = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      this.recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        if (!result.isFinal) {
          lastInterim = Array.from(event.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(' ');
          options.onInterim?.(lastInterim);
          return;
        }
        const alternatives = Array.from(result as ArrayLike<any>).map((a: any) => String(a.transcript).trim()).filter(Boolean);
        const confidence = Number(result[0].confidence) || 0;
        finish(() => resolve({ transcript: alternatives[0] ?? '', alternatives, confidence: confidence > 0 ? confidence : null }));
      };

      this.recognition.onerror = (event: any) => {
        finish(() => reject(new SpeechError(event.error)));
      };

      // Chrome ends recognition after a few seconds of silence without firing an error.
      // If it ended mid-word with only an interim guess, use that rather than losing it.
      this.recognition.onend = () => {
        if (lastInterim.trim()) finish(() => resolve({ transcript: lastInterim.trim(), alternatives: [lastInterim.trim()], confidence: null }));
        else finish(() => reject(new SpeechError('no-speech')));
      };

      try {
        this.recognition.start();
      } catch (error) {
        finish(() => reject(new SpeechError('start-failed')));
      }
    });
  }

  /**
   * Stop listening
   */
  stopListening(): void {
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
