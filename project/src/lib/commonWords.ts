// Common English words (3-7 letters) sourced from the Google 10,000 most
// frequent English words list (no swears). Used for target-word selection
// and reveal-word filtering so players never see obscure dictionary entries.

import commonWordsList from './commonWordsList.json';
import { PROSE_5, PROSE_6, PROSE_7 } from './proseWords';

const allCommonWords = commonWordsList as string[];
const commonWordSet = new Set(allCommonWords);

// Curated "high-utility vocabulary" words grouped by length. These literary
// prose words are prioritized in the vocabulary reveal so players see evocative
// words rather than technical filler or proper nouns.
const proseByLength = new Map<number, Set<string>>([
  [5, new Set(PROSE_5)],
  [6, new Set(PROSE_6)],
  [7, new Set(PROSE_7)],
]);

// Map: first letter -> array of 7-letter common words starting with that letter
const sevenLetterByFirstLetter = new Map<string, string[]>();
for (const w of allCommonWords) {
  if (w.length === 7) {
    const key = w[0];
    const arr = sevenLetterByFirstLetter.get(key) ?? [];
    arr.push(w);
    sevenLetterByFirstLetter.set(key, arr);
  }
}

export function getCommonSevenLetterWordsForLetter(letter: string): string[] {
  const key = letter.toLowerCase();
  return sevenLetterByFirstLetter.get(key) ?? [];
}

export function hasCommonWordForLetter(letter: string): boolean {
  const key = letter.toLowerCase();
  return (sevenLetterByFirstLetter.get(key)?.length ?? 0) > 0;
}

// Check if a word is in the common words list.
export function isCommonWord(word: string): boolean {
  return commonWordSet.has(word.toLowerCase().trim());
}

// Given a set of letters, find all common words (3-7 letters) that can be
// formed using a subset of those letters (each letter used at most once).
function canSpellFrom(word: string, available: string[]): boolean {
  const pool = [...available];
  for (const ch of word) {
    const idx = pool.indexOf(ch);
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }
  return true;
}

export function findCommonWordsFromLetters(letters: string): string[] {
  const pool = letters.toLowerCase().split('');
  const results: string[] = [];
  for (const w of allCommonWords) {
    if (w.length < 3 || w.length > 7) continue;
    if (canSpellFrom(w, pool)) results.push(w);
  }
  return results.sort();
}

// Map: first letter -> word list grouped by length (5, 6, 7)
const byFirstLetter = new Map<string, Map<number, string[]>>();
for (const w of allCommonWords) {
  if (w.length < 5 || w.length > 7) continue;
  const key = w[0];
  if (!byFirstLetter.has(key)) byFirstLetter.set(key, new Map());
  const lenMap = byFirstLetter.get(key)!;
  const arr = lenMap.get(w.length) ?? [];
  arr.push(w);
  lenMap.set(w.length, arr);
}

// Vocabulary reveal: up to `maxPerLen` common words of each length (5,6,7)
// that all start with `letter`. Not constrained to anagrams — this is for
// building the player's vocabulary around the starting letter.
export function findCommonWordsByFirstLetter(
  letter: string,
  lengths: number[] = [5, 6, 7],
  maxPerLen = 12
): string[] {
  const key = letter.toLowerCase();
  const lenMap = byFirstLetter.get(key);
  if (!lenMap) return [];
  const results: string[] = [];
  for (const len of lengths) {
    // Prioritize curated prose words first, then fill remaining slots from the
    // general common-words list. Prose words are surfaced whether or not they
    // also appear in the Google frequency list — the curated set is its own
    // source, not a filter on the general list. Both groups are sorted
    // alphabetically so the reveal reads cleanly.
    const proseSet = proseByLength.get(len);
    const general = (lenMap.get(len) ?? []).slice().sort();
    const seen = new Set<string>();
    const picked: string[] = [];
    // 1. Curated prose words matching this first letter, alphabetized.
    if (proseSet) {
      const prose = [...proseSet]
        .filter((w) => w[0] === key && w.length === len)
        .sort();
      for (const w of prose) {
        picked.push(w);
        seen.add(w);
      }
    }
    // 2. Fill remaining slots from the general common-words list.
    for (const w of general) {
      if (picked.length >= maxPerLen) break;
      if (!seen.has(w)) {
        picked.push(w);
        seen.add(w);
      }
    }
    results.push(...picked.slice(0, maxPerLen));
  }
  return results;
}
