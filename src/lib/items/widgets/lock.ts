import type { WidgetModule } from "../types";

export type LockGuess = { guess: string; exact: number; near: number };
type LockPub = { digits: number; maxGuesses: number };
type LockState = { guesses: LockGuess[]; solved: boolean };

export function scoreGuess(secret: string, guess: string): { exact: number; near: number } {
  let exact = 0;
  let near = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else if (secret.includes(guess[i])) near++;
  }
  return { exact, near };
}

export function validGuess(g: string, digits: number): string | null {
  if (!new RegExp(`^\\d{${digits}}$`).test(g)) return `Enter ${digits} digits`;
  if (new Set(g).size !== g.length) return "Digits can't repeat";
  return null;
}

/** The secret never leaves the server; each guess is checked through interact(). */
export const lock: WidgetModule<{ digits?: number; maxGuesses?: number }, LockPub, { secret: string }, unknown, LockState> = {
  generate(rng, c) {
    const digits = c.digits ?? 4;
    const secret = rng.shuffle("0123456789".split("")).slice(0, digits).join("");
    const maxGuesses = c.maxGuesses ?? 8;
    return { pub: { digits, maxGuesses }, key: { secret }, vars: { digits, maxGuesses } };
  },
  interact(pub, key, state, action) {
    const s: LockState = state ?? { guesses: [], solved: false };
    const guess = String((action as { guess?: string })?.guess ?? "");
    if (s.solved) return { state: s, reply: { error: "Already open", ...s } };
    if (s.guesses.length >= pub.maxGuesses) return { state: s, reply: { error: "No guesses left", ...s } };
    const err = validGuess(guess, pub.digits);
    if (err) return { state: s, reply: { error: err, ...s } };
    const r = scoreGuess(key.secret, guess);
    const next: LockState = { guesses: [...s.guesses, { guess, ...r }], solved: r.exact === pub.digits };
    return { state: next, reply: next };
  },
  grade(pub, _key, _r, state) {
    if (!state?.guesses?.length) return { fraction: 0 };
    if (state.solved) return { fraction: 1 };
    const best = Math.max(...state.guesses.map((g) => g.exact + g.near * 0.25));
    return { fraction: Math.round((best / pub.digits) * 0.4 * 100) / 100 };
  },
  describeKey: (_p, k) => k.secret,
};
