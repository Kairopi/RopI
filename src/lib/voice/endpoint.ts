/**
 * When have you finished speaking? (end-of-turn)
 *
 * A fixed "half a second of silence" cuts people off mid-thought: you pause to
 * think, and the agent jumps in. What production voice agents do instead:
 *  - wait less when the words sound finished and much longer when they don't
 *    (LiveKit's turn detector; OpenAI's "semantic VAD", whose low-eagerness
 *    setting waits several seconds when you trail off),
 *  - never end a turn while there's still sound on the mic (Pipecat's
 *    smart-turn only runs once the local VAD hears silence),
 *  - let the speaker take control (push-to-talk / "tap when done").
 * Ropi does all three: a text heuristic here (instant, no download), a local
 * voice check in the listeners, and a "I'll tap when I'm done" setting.
 *
 * Measured against how people pause: thinking pauses inside a sentence run
 * 0.5-2 s, and up to 3 s or more after "and"/"so"; between finished
 * sentences they're usually under 1 s. So a finished statement waits ~1.8 s.
 */

// Words a sentence doesn't end on: you're mid-thought
const DANGLING =
  /\b(and|but|or|so|because|cause|cuz|to|the|a|an|of|for|with|about|on|in|at|from|into|my|your|our|their|i|i'm|im|are|was|were|is|if|which|that|then|um|uh|er|erm|hmm|like|can|could|would|should|will|want|need|just|also|maybe|actually|basically|let's|how|what|when|where|why)$/i;
const COMMAND = /^(stop|cancel|pause|yes|yeah|yep|no|nope|start|go|ok|okay|thanks|thank you|next|skip|repeat|play it|that's all|bye|[abcd])$/i;

/** short / normal / long scale the waits; manual never sends until you tap */
export type Patience = 'short' | 'normal' | 'long' | 'manual';
const FACTOR: Record<Exclude<Patience, 'manual'>, number> = { short: 0.7, normal: 1, long: 1.7 };

export function patience(): Patience {
  try {
    const p = JSON.parse(localStorage.getItem('ropi-voice-v1') ?? '{}').patience;
    return p === 'short' || p === 'long' || p === 'manual' ? p : 'normal';
  } catch {
    return 'normal';
  }
}

/** How long to keep listening after the last word, in ms, given what's been said so far (Infinity: wait for a tap) */
export function waitAfter(text: string, p: Patience = patience()): number {
  const raw = text.trim();
  const t = raw.toLowerCase().replace(/[.,!?;:]+$/, '').trim();
  if (!t) return 0;
  if (p === 'manual') return COMMAND.test(t) && /^(stop|cancel)$/.test(t) ? 500 : Infinity;
  const words = t.split(/\s+/).length;
  let ms: number;
  if (COMMAND.test(t)) ms = 550; // "stop", "yes", "B": answer right away
  else if (/[?]$/.test(raw) && words >= 4) ms = 1300; // a finished question
  else if (DANGLING.test(t)) ms = 3600; // trailing off: "...and", "so um", "I want to"
  else if (words <= 2) ms = 2600; // "Explain..." usually has more coming
  else if (words <= 6) ms = 2200;
  else ms = 1800;
  return Math.round(ms * FACTOR[p]);
}

/**
 * A small voice-activity check on the mic level: "is there still speech?"
 * Learns the room's noise floor over the first half second, then calls
 * anything well above it speech. The listeners won't end a turn while this
 * heard you in the last ~0.7 s, even if the transcript hasn't caught up.
 */
export function createVoiceCheck() {
  let floor = 0.02;
  let samples = 0;
  let lastVoice = -Infinity;
  return {
    /** Feed each mic level (0-1) */
    push(level: number, now = Date.now()) {
      if (samples < 6) {
        floor = samples === 0 ? level : Math.min(floor, (floor * samples + level) / (samples + 1));
        samples++;
        return;
      }
      if (level > Math.max(0.06, floor * 2.8)) lastVoice = now;
      // Drift slowly toward quiet levels so a noisy start doesn't stick
      else floor = floor * 0.97 + Math.min(level, floor * 1.5) * 0.03;
    },
    /** Heard speech within the last `ms`? */
    speaking(ms = 700, now = Date.now()) {
      return now - lastVoice < ms;
    },
  };
}
