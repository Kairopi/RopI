/**
 * When have you finished speaking? (end-of-turn)
 *
 * A fixed "half a second of silence" cuts people off mid-thought: you pause to
 * think, and the agent jumps in. Production voice agents wait less when the
 * words sound finished and much longer when they don't (LiveKit's turn
 * detector: a short delay when the model is confident you're done, up to
 * several seconds when you trail off on "and..." or "so..."). This is the same
 * idea with a text heuristic instead of a model: no extra download, instant.
 *
 * Plus a setting for how patient Ropi is, and you can always tap to send.
 */

// Words a sentence doesn't end on: you're mid-thought
const DANGLING =
  /\b(and|but|or|so|because|cause|cuz|to|the|a|an|of|for|with|about|on|in|at|from|into|my|your|our|their|i|i'm|im|are|was|were|if|which|um|uh|er|erm|hmm|can|could|would|should|will|just|also|maybe|actually|basically|let's)$/i;
const COMMAND = /^(stop|cancel|pause|yes|yeah|yep|no|nope|start|go|ok|okay|thanks|thank you|next|skip|repeat|play it|that's all|bye)$/i;

export type Patience = 'short' | 'normal' | 'long';
const FACTOR: Record<Patience, number> = { short: 0.65, normal: 1, long: 1.6 };

export function patience(): Patience {
  try {
    const p = JSON.parse(localStorage.getItem('ropi-voice-v1') ?? '{}').patience;
    return p === 'short' || p === 'long' ? p : 'normal';
  } catch {
    return 'normal';
  }
}

/** How long to keep listening after the last word, in ms, given what's been said so far */
export function waitAfter(text: string, p: Patience = patience()): number {
  const raw = text.trim();
  const t = raw.toLowerCase().replace(/[.,!?;:]+$/, '').trim();
  if (!t) return 0;
  const words = t.split(/\s+/).length;
  let ms: number;
  if (COMMAND.test(t)) ms = 450; // "stop", "yes": answer right away
  else if (/[?]$/.test(raw) && words >= 3) ms = 1000; // a finished question
  else if (DANGLING.test(t)) ms = 2800; // trailing off: "...and", "so um"
  else if (words <= 2) ms = 2000; // "Explain..." usually has more coming
  else if (words <= 5) ms = 1600;
  else ms = 1300;
  return Math.round(ms * FACTOR[p]);
}
