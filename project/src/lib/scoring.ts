// Scoring for the roulette word game.

export const WORD_SLOTS = 7;
export const MAX_SPINS = 4;
export const GUESS_TIME = 20;
export const SPIN_TIME = 30;

// Jackpot points decrease with each spin used. 500 on spin 1, 400 on spin 2,
// 300 on spin 3, 200 on spin 4.
export function jackpotForSpin(spinNumber: number): number {
  return Math.max(0, 600 - spinNumber * 100);
}

// Penalty when the player fails to guess any valid word.
export const FAIL_PENALTY = -500;

export function scoreWord(word: string): number {
  if (word.length !== 7) return 0;
  return 200;
}

export function totalScore(words: string[]): number {
  return words.reduce((sum, w) => sum + scoreWord(w), 0);
}

export function getScoreTier(score: number): { label: string; color: string } {
  if (score >= 2000) return { label: 'LEGENDARY', color: 'gold' };
  if (score >= 1000) return { label: 'EPIC', color: 'amber' };
  if (score >= 500) return { label: 'RARE', color: 'rose' };
  if (score >= 200) return { label: 'UNCOMMON', color: 'sky' };
  if (score >= 100) return { label: 'COMMON', color: 'emerald' };
  return { label: 'STARTER', color: 'slate' };
}
