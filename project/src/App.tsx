import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Coins, RefreshCw, RotateCcw, X, Check, Crown, Timer, Volume2, VolumeX, TrendingDown, Lightbulb } from 'lucide-react';
import { supabase, getDeviceId, type PlayerStats } from './lib/supabase';
import { WORD_SLOTS, MAX_SPINS, GUESS_TIME, SPIN_TIME, jackpotForSpin, FAIL_PENALTY } from './lib/scoring';
import { getCommonSevenLetterWordsForLetter, hasCommonWordForLetter, findCommonWordsFromLetters, findCommonWordsByFirstLetter, isCommonWord } from './lib/commonWords';
import RevealPopup from './components/RevealPopup';
import ProTipsPopup from './components/ProTipsPopup';
import WordDefinition from './components/WordDefinition';
import RouletteWheel from './components/RouletteWheel';
import { playSpinSound, playBallLandSound, playPassBell, playFailSound, playTickSound } from './lib/sounds';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };
type GamePhase = 'spinning' | 'filling' | 'guessing' | 'won' | 'lost';

// Check whether every revealed letter is present in the guessed word
// (multiset subset — if two E's are revealed, the guess must have two E's).
// The guess may contain additional letters not yet revealed.
function matchesRevealedLetters(word: string, tiles: (string | null)[]): boolean {
  const pool = word.toLowerCase().split('');
  for (const tile of tiles) {
    if (tile === null) continue;
    const idx = pool.indexOf(tile.toLowerCase());
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }
  return true;
}

// Fallback dictionary check via the free dictionaryapi.dev — used when a word
// isn't in our local common-words list but might still be a valid English word.
async function isValidDictionaryWord(word: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 && !!data[0].word;
  } catch {
    return false;
  }
}

export default function App() {
  // Game state
  const [tiles, setTiles] = useState<(string | null)[]>(Array(WORD_SLOTS).fill(null));
  const [spinsUsed, setSpinsUsed] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('spinning');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [ballAngle, setBallAngle] = useState(0);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
  const [targetWord, setTargetWord] = useState<string>('');
  const [guessInput, setGuessInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(GUESS_TIME);
  const [spinTimeLeft, setSpinTimeLeft] = useState(SPIN_TIME);
  const [revealedWords, setRevealedWords] = useState<string[]>([]);
  const [showPayout, setShowPayout] = useState(false);
  const [defWord, setDefWord] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [allTimeCredit, setAllTimeCredit] = useState(0);
  const [allTimeDebit, setAllTimeDebit] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [revealActive, setRevealActive] = useState(false);
  const [showProTips, setShowProTips] = useState(false);
  // Precomputed at spin 1 so REVEAL can show every possible word at any game end.
  const allWordsRef = useRef<string[]>([]);
  // All 7-letter common words that start with the first landed letter — these are
  // the possible target words the machine could have picked (e.g. if L landed,
  // LATINAS, LEOPARD, LEATHER, LOGICAL, LOYALTY, etc.).
  const candidateWordsRef = useRef<string[]>([]);
  // Running score accumulated across all games in the session (can go negative).
  const [runningScore, setRunningScore] = useState(0);
  // Last spin's jackpot points (for the payout slip).
  const [lastJackpot, setLastJackpot] = useState(0);
  // The word the player actually guessed (may differ from targetWord when they
  // form a different valid 7-letter word from the same letters).
  const [winningWord, setWinningWord] = useState('');
  // "No word exists" popup — shown when the first spin lands on a letter with
  // no 7-letter words starting with it.
  const [noWordLetter, setNoWordLetter] = useState<string | null>(null);
  // Pre-computed random tile positions for spins 2-4 (indices into the 7-tile array).
  // Spin 1 always goes to tile 0. Spins 2-4 go to shuffled positions from 1-6.
  const [tileAssignment, setTileAssignment] = useState<number[]>([]);

  const guessInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filledLetters = useMemo(
    () => tiles.filter((t): t is string => t !== null),
    [tiles]
  );
  const allTilesFilled = filledLetters.length === WORD_SLOTS;
  const canSpin = phase === 'spinning' && !spinning && spinsUsed < MAX_SPINS;
  // Guess input is shown after the first spin, but not when game is over
  const showGuessInput = spinsUsed > 0 && phase !== 'won' && phase !== 'lost' && !spinning;
  // Wheel-hub popup timer: spin countdown between spins 2-4, and the guess
  // countdown after the final spin — same hub location in both phases.
  const showHubTimer =
    (phase === 'spinning' && !spinning && spinsUsed > 0 && spinsUsed < MAX_SPINS && spinTimeLeft > 0) ||
    (phase === 'guessing' && timeLeft > 0);
  const hubTimerSeconds = phase === 'guessing' ? timeLeft : spinTimeLeft;
  const hubTimerCritical = hubTimerSeconds <= 5;

  // Load player's all-time credit/debit totals (persisted in Supabase, keyed per device).
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('player_stats')
        .select('total_credit, total_debit')
        .eq('device_id', getDeviceId())
        .maybeSingle();
      if (!error && data) {
        setAllTimeCredit((data as PlayerStats).total_credit ?? 0);
        setAllTimeDebit((data as PlayerStats).total_debit ?? 0);
      }
      setStatsLoading(false);
    })();
  }, []);

  // Sync credit/debit deltas to Supabase so the all-time score survives reloads.
  const syncStats = useCallback((creditDelta: number, debitDelta: number) => {
    setAllTimeCredit((c) => c + creditDelta);
    setAllTimeDebit((d) => d + debitDelta);
    (async () => {
      const deviceId = getDeviceId();
      const { data } = await supabase
        .from('player_stats')
        .select('total_credit, total_debit')
        .eq('device_id', deviceId)
        .maybeSingle();
      const row = data as PlayerStats | null;
      await supabase.from('player_stats').upsert({
        device_id: deviceId,
        total_credit: (row?.total_credit ?? 0) + creditDelta,
        total_debit: (row?.total_debit ?? 0) + debitDelta,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_id' });
    })();
  }, []);

  const resetStats = useCallback(() => {
    setAllTimeCredit(0);
    setAllTimeDebit(0);
    (async () => {
      await supabase.from('player_stats').upsert({
        device_id: getDeviceId(),
        total_credit: 0,
        total_debit: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_id' });
    })();
    addToast('All-time score reset to 0', 'info');
  }, []);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }, []);

  const handleSpin = useCallback(() => {
    if (!canSpin) return;

    setSpinning(true);
    setLandedIndex(null);

    // On first spin, pick the target word based on a random wheel landing.
    // On subsequent spins, the ball must land on the correct letter from the word.
    let word = targetWord;
    let positions = tileAssignment;
    let targetTile: number;

    if (spinsUsed === 0) {
      // First spin: random landing on a letter that has at least one common word
      const validTiles: number[] = [];
      for (let t = 0; t < 26; t++) {
        if (hasCommonWordForLetter(String.fromCharCode(65 + t))) validTiles.push(t);
      }
      targetTile = validTiles[Math.floor(Math.random() * validTiles.length)];
      const targetLetter = String.fromCharCode(65 + targetTile);

      // Pick a common 7-letter word that starts with this letter
      const candidates = getCommonSevenLetterWordsForLetter(targetLetter);
      if (candidates.length === 0) {
        // Fallback safety — should never happen due to filtering above
        setNoWordLetter(targetLetter);
        setSpinning(false);
        setPhase('spinning');
        if (!muted) playFailSound();
        return;
      }
      word = candidates[Math.floor(Math.random() * candidates.length)];
      setTargetWord(word);
      const firstLetter = word[0].toLowerCase();
      // Start with anagram words that share the first letter (core matches)
      const anagramWords = findCommonWordsFromLetters(word).filter(
        (w) => w[0] === firstLetter
      );
      // Top up each length category with vocabulary words (common words
      // starting with the first letter, regardless of anagram spellability)
      // so categories 7/6/5 each fill toward 12 words for vocab building.
      const maxPerLen = 12;
      const lengths = [5, 6, 7];
      const vocabWords = findCommonWordsByFirstLetter(firstLetter, lengths, maxPerLen);
      const seen = new Set(anagramWords);
      const dedupedVocab = vocabWords.filter((w) => !seen.has(w));
      const totals = new Map<number, string[]>();
      for (const len of lengths) totals.set(len, []);
      for (const w of anagramWords) totals.get(w.length)?.push(w);
      for (const w of dedupedVocab) totals.get(w.length)?.push(w);
      allWordsRef.current = lengths.flatMap((len) => (totals.get(len) ?? []).slice(0, maxPerLen));
      candidateWordsRef.current = candidates;

      // Assign tile 0 (tile 1 in UI) to spin 1; shuffle tiles 1-6 for spins 2-4
      const rest = [1, 2, 3, 4, 5, 6];
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      positions = [0, ...rest.slice(0, MAX_SPINS - 1)];
      setTileAssignment(positions);
    } else {
      // Spins 2-4: ball lands on the letter at the pre-assigned word position
      const wordPos = positions[spinsUsed];
      const targetLetter = word[wordPos].toUpperCase();
      targetTile = targetLetter.charCodeAt(0) - 65; // 0-25
    }

    const targetLetter = String.fromCharCode(65 + targetTile);

    // Compute exact rotation so that the target tile center lands at top (0°)
    const tileAngle = 360 / 26;
    const tileCenter = targetTile * tileAngle + tileAngle / 2;
    const currentEff = ((rotation % 360) + 360) % 360;
    const neededDelta = ((360 - (tileCenter + currentEff) % 360) % 360) || 360;
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = fullSpins * 360 + neededDelta;
    const newRotation = rotation + targetRotation;

    // Ball counter-rotates; snap to a multiple of 360 so it ends at top
    const ballSpins = 4 + Math.floor(Math.random() * 3);
    const newBallAngle = (Math.floor(ballAngle / 360) - ballSpins) * 360;

    setRotation(newRotation);
    setBallAngle(newBallAngle);

    if (!muted) playSpinSound(4000);

    setTimeout(() => {
      setLandedIndex(targetTile);
      if (!muted) playBallLandSound();

      // Place the letter at its correct position in the word (Jeopardy-style)
      const wordPos = positions[spinsUsed];
      setTiles((prev) => {
        const next = [...prev];
        next[wordPos] = targetLetter;
        return next;
      });

      const newSpinsUsed = spinsUsed + 1;
      setSpinsUsed(newSpinsUsed);
      setSpinning(false);

      if (newSpinsUsed >= MAX_SPINS) {
        setPhase('guessing');
        setTimeLeft(GUESS_TIME);
        setGuessInput('');
        setTimeout(() => guessInputRef.current?.focus(), 100);
      } else {
        setPhase('spinning');
        // After first spin, focus guess input so user can type early
        if (newSpinsUsed === 1) {
          setTimeout(() => guessInputRef.current?.focus(), 150);
        }
      }
    }, 4100);
  }, [canSpin, rotation, ballAngle, spinsUsed, targetWord, tileAssignment, muted]);

  // Guess timer
  useEffect(() => {
    if (phase !== 'guessing') return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(GUESS_TIME);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Time's up — apply fail penalty, reveal word, go to lost
          if (!muted) playFailSound();
          setRunningScore((s) => s + FAIL_PENALTY);
          syncStats(0, Math.abs(FAIL_PENALTY));
          setTiles(targetWord.toUpperCase().split(''));
          addToast(`Time's up! The word was "${targetWord.toUpperCase()}" — ${FAIL_PENALTY} pts`, 'error');
          setPhase('lost');
          return 0;
        }
        if (prev <= 4 && !muted) playTickSound();
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, muted]);

  // Spin timer — 30s countdown between spins (spins 2-4). Auto-spins on expiry.
  useEffect(() => {
    if (phase !== 'spinning' || spinning || spinsUsed === 0 || spinsUsed >= MAX_SPINS) return;
    if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    setSpinTimeLeft(SPIN_TIME);

    spinTimerRef.current = setInterval(() => {
      setSpinTimeLeft((prev) => {
        if (prev <= 1) {
          if (spinTimerRef.current) clearInterval(spinTimerRef.current);
          return 0;
        }
        if (prev <= 5 && !muted) playTickSound();
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    };
  }, [phase, spinning, spinsUsed, muted]);

  const submitGuess = useCallback(async () => {
    const guess = guessInput.trim().toLowerCase();
    if (!guess || !targetWord) return;

    if (guess === targetWord.toLowerCase()) {
      // Exact match — full jackpot for this spin
      const jackpot = jackpotForSpin(spinsUsed);
      setLastJackpot(jackpot);
      setRunningScore((s) => s + jackpot);
      syncStats(jackpot, 0);
      setWinningWord(targetWord);
      setTiles(targetWord.toUpperCase().split(''));
      setPhase('won');
      if (timerRef.current) clearInterval(timerRef.current);
      if (!muted) playPassBell();
      addToast(`Jackpot! "${targetWord}" — +${jackpot} pts (spin ${spinsUsed})`, 'success');
    } else if (guess.length === 7 && matchesRevealedLetters(guess, tiles)) {
      // Not in local list — check dictionary API as fallback
      if (isCommonWord(guess) || await isValidDictionaryWord(guess)) {
        // Different valid 7-letter word formed from the same letters — also wins
        const jackpot = jackpotForSpin(spinsUsed);
        setLastJackpot(jackpot);
        setRunningScore((s) => s + jackpot);
        syncStats(jackpot, 0);
        setWinningWord(guess);
        setTiles(guess.toUpperCase().split(''));
        setPhase('won');
        if (timerRef.current) clearInterval(timerRef.current);
        if (!muted) playPassBell();
        addToast(`Jackpot! "${guess}" — +${jackpot} pts (spin ${spinsUsed})`, 'success');
      } else {
        addToast(`"${guess}" is not a valid 7-letter word`, 'error');
      }
    } else if (guess.length === 7 && (isCommonWord(guess) || await isValidDictionaryWord(guess))) {
      addToast(`"${guess}" is valid but doesn't match your revealed letters`, 'error');
    } else {
      addToast(`"${guess}" is not a valid 7-letter word`, 'error');
    }
  }, [guessInput, targetWord, spinsUsed, tiles, addToast, muted, syncStats]);

  const handleReveal = useCallback(() => {
    if (!targetWord || revealActive) return;
    setRevealActive(true);

    // Stop the guess timer — game is being revealed
    if (timerRef.current) clearInterval(timerRef.current);
    if (spinTimerRef.current) clearInterval(spinTimerRef.current);

    // Fill all 7 tiles with the complete hidden word
    if (targetWord) {
      setTiles(targetWord.toUpperCase().split(''));
    }

    // If the game was mid-play, transition to 'lost' so Play Again shows
    // (if already won, keep 'won' and skip the penalty)
    setPhase((prev) => {
      if (prev === 'won') return 'won';
      setRunningScore((s) => s + FAIL_PENALTY);
      syncStats(0, Math.abs(FAIL_PENALTY));
      addToast(`Revealed without guessing — ${FAIL_PENALTY} pts`, 'error');
      return 'lost';
    });

    // Show common words (3-7 letters) formable from the target word's letters
    setRevealedWords(allWordsRef.current);
    setShowPayout(true);
    setRevealActive(false);
  }, [targetWord, revealActive, syncStats]);

  const newGame = useCallback(() => {
    setTiles(Array(WORD_SLOTS).fill(null));
    setSpinsUsed(0);
    setPhase('spinning');
    setLandedIndex(null);
    setTargetWord('');
    setTileAssignment([]);
    setGuessInput('');
    setTimeLeft(GUESS_TIME);
    setSpinTimeLeft(SPIN_TIME);
    setRevealedWords([]);
    setShowPayout(false);
    allWordsRef.current = [];
    candidateWordsRef.current = [];
    setWinningWord('');
    setRevealActive(false);
    setRotation(0);
    setBallAngle(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (spinTimerRef.current) clearInterval(spinTimerRef.current);
  }, []);

  const newGameRef = useRef(newGame);
  newGameRef.current = newGame;

  return (
    <div className="bg-felt-pattern relative overflow-hidden" style={{ height: '100dvh' }}>
      <div className="overflow-hidden flex flex-col" style={{ height: '100dvh' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-casino-gold/10 blur-[120px] rounded-full" />

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg font-body text-sm font-medium shadow-lg animate-slide-up flex items-center gap-2 ${
              t.type === 'success'
                ? 'bg-emerald-600/90 text-white'
                : t.type === 'error'
                ? 'bg-rose-600/90 text-white'
                : 'bg-casino-ink text-gray-200 border border-casino-gold/30'
            }`}
          >
            {t.type === 'success' && <Check className="w-4 h-4" />}
            {t.type === 'error' && <X className="w-4 h-4" />}
            {t.type === 'info' && <Coins className="w-4 h-4" />}
            {t.message}
          </div>
        ))}
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-2 pb-2 md:pt-2 flex-1 min-h-0 flex flex-col items-center">
        {/* Header — pro tips + mute toggle */}
        <header className="flex items-center justify-between mb-2 w-full">
          <button
            onClick={() => setShowProTips(true)}
            className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-casino-gold/10 text-gray-400 hover:text-casino-gold transition-colors"
            title="Pro Tips"
            aria-label="Pro Tips"
          >
            <span className="prorec-led" aria-hidden="true">
              <span className="prorec-led-core" />
            </span>
            <Lightbulb className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMuted(!muted)}
            className="p-1.5 rounded-lg hover:bg-casino-gold/10 text-gray-400 hover:text-casino-gold transition-colors"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </header>

        {/* Main game area */}
        <div className="flex flex-col items-center">
          {/* Casino table surround — felt + golden rail */}
          <div className="casino-table-surround">
            {/* Anagram logo — top-left corner inside table */}
            <div className="anagram-logo-tl">
              <Coins className="w-3 h-3 text-casino-gold" />
              <span className="font-display text-[10px] font-bold text-gold-gradient tracking-normal">ANAGRAM</span>
            </div>
            {/* Build refresh — top-right corner inside table.
                Cache-busted reload (iOS Safari serves stale assets on plain reload()). */}
            <button
              onClick={() => {
                const u = new URL(window.location.href);
                u.searchParams.set('v', Date.now().toString());
                window.location.replace(u.toString());
              }}
              className="anagram-reload-tr"
              title="Refresh build"
              aria-label="Refresh build"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {/* Corner coin cups */}
            <div className="coin-cup coin-cup-tl" />
            <div className="coin-cup coin-cup-tr" />
            <div className="coin-cup coin-cup-bl" />
            <div className="coin-cup coin-cup-br" />

            {/* Roulette wheel */}
            <div className="relative flex items-center justify-center py-3 px-4">
              <RouletteWheel
                spinning={spinning}
                rotation={rotation}
                ballAngle={ballAngle}
                landedIndex={landedIndex}
                onSpinEnd={() => {}}
                timerOverlay={
                  showHubTimer ? (
                    <div className="flex flex-col items-center justify-center animate-fade-in rounded-full bg-casino-ink/94 border-[3px] border-casino-gold/60 shadow-[0_0_16px_rgba(212,175,55,0.5)] backdrop-blur-md" style={{ width: '18%', height: '18%' }}>
                      <Timer className={`w-3 h-3 mb-0.5 ${hubTimerCritical ? 'text-rose-400 timer-flash-red' : 'text-white timer-flash-white'}`} />
                      <span className={`font-display text-base font-bold leading-none ${hubTimerCritical ? 'text-rose-400 timer-flash-red' : 'text-white timer-flash-white'}`}>
                        {hubTimerSeconds}
                      </span>
                    </div>
                  ) : null
                }
              />
            </div>
          </div>

          {/* Credit / Debit boxes — under the roulette boundary box */}
          <div className="credit-debit-row">
            <div className="credit-debit-box credit-box">
              <Coins className="w-3 h-3 text-emerald-400" />
              <div className="flex flex-col leading-tight">
                <span className="cd-label">CREDIT</span>
                <span className="cd-value cd-credit">+{allTimeCredit}</span>
              </div>
            </div>
            <div className="credit-debit-box debit-box">
              <TrendingDown className="w-3 h-3 text-rose-400" />
              <div className="flex flex-col leading-tight">
                <span className="cd-label">DEBIT</span>
                <span className="cd-value cd-debit">−{allTimeDebit}</span>
              </div>
            </div>
          </div>
          <div className="mb-2" />

            {/* Buttons inside the table surround, with their own golden frame */}
            <div className="casino-btn-frame casino-btn-frame-sm">
              <button
                onClick={handleSpin}
                disabled={!canSpin}
                className="neon-spin-btn px-5 py-1.5 rounded-lg font-btn text-sm"
              >
                {spinning ? 'SPINNING...' : 'SPIN'}
              </button>
              <button
                onClick={handleReveal}
                disabled={revealActive}
                className="neon-reveal-btn px-5 py-1.5 rounded-lg font-btn text-sm"
              >
                {revealActive ? 'REVEALING...' : 'REVEAL'}
              </button>
            </div>

          {/* Spins counter */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-body text-xs text-gray-500 uppercase tracking-wider">
              Spins
            </span>
            <div className="flex gap-1.5">
              {Array.from({ length: MAX_SPINS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i < spinsUsed
                      ? 'bg-casino-gold shadow-[0_0_8px_rgba(212,175,55,0.6)]'
                      : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <span className="font-body text-xs text-gray-500">
              {spinsUsed}/{MAX_SPINS}
            </span>
          </div>

          {/* 7 letter tiles */}
          <div className="mb-2">
            <div className="flex justify-center gap-1.5 md:gap-2 flex-wrap">
              {tiles.map((letter, i) => (
                <div
                  key={i}
                  className={`w-9 h-11 md:w-10 md:h-12 flex items-center justify-center rounded-lg border-2 transition-all duration-300 ${
                    letter
                      ? 'gold-border bg-gradient-to-br from-casino-gold/15 to-casino-ink font-display text-lg md:text-xl font-bold text-casino-gold shadow-lg letter-tile-fill'
                      : 'border-dashed border-gray-700 bg-casino-ink/50'
                  }`}
                  style={letter ? { animationDelay: `${i * 40}ms` } : undefined}
                >
                  {letter ? (
                    <button
                      onClick={() => setDefWord(letter)}
                      className="hover:scale-110 transition-transform"
                      title="Click for meaning"
                    >
                      {letter}
                    </button>
                  ) : (
                    <span className="text-gray-700 text-[10px] font-body">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Guess input — shown from first spin onwards */}
          {showGuessInput && (
            <div className="w-full max-w-sm mb-2 animate-slide-up">
              <div className="flex gap-1.5">
                <input
                  ref={guessInputRef}
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitGuess(); }}
                  placeholder="Guess the 7-letter word..."
                  maxLength={7}
                  className="flex-1 px-3 py-2 rounded-lg bg-casino-ink border-2 border-casino-gold/30 focus:border-casino-gold/70 outline-none font-body text-sm text-gray-100 placeholder-gray-600 transition-colors uppercase tracking-wider"
                />
                <button
                  onClick={submitGuess}
                  className="px-4 py-2 rounded-lg bg-gradient-to-br from-casino-gold to-casino-gold-dark text-casino-ink-dark font-display font-bold text-sm tracking-wide hover:from-casino-gold-light hover:to-casino-gold transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  GUESS
                </button>
              </div>
              {phase === 'spinning' && spinsUsed < MAX_SPINS && (
                <p className="text-center text-[10px] text-gray-500 mt-1 font-body">
                  Keep spinning or guess the word now!
                </p>
              )}
            </div>
          )}

          {/* Won state — compact inline banner */}
          {phase === 'won' && (
            <div className="w-full max-w-xs mb-2 animate-slide-up">
              <div className="relative gold-border rounded-lg px-4 py-2 text-center bg-gradient-to-br from-casino-gold/20 to-casino-ink">
                <button
                  onClick={newGame}
                  className="absolute right-1.5 top-1.5 p-1 rounded-md text-casino-gold hover:bg-casino-gold/15 transition-colors"
                  title="Play Again"
                  aria-label="Play Again"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <h2 className="font-display text-base font-bold text-gold-gradient leading-tight">
                  JACKPOT! <span className="text-casino-gold">+{lastJackpot.toLocaleString()}</span>
                </h2>
                <p className="font-body text-[11px] text-gray-300">
                  <span className="text-casino-gold font-bold uppercase">{winningWord || targetWord}</span>
                </p>
              </div>
            </div>
          )}

          {/* Lost / Revealed state — compact inline banner */}
          {phase === 'lost' && !showPayout && (
            <div className="w-full max-w-xs mb-2 animate-slide-up">
              <div className="relative rounded-lg px-4 py-2 text-center bg-casino-ink-dark border border-gray-700">
                <button
                  onClick={newGame}
                  className="absolute right-1.5 top-1.5 p-1 rounded-md text-gray-400 hover:text-casino-gold hover:bg-casino-gold/15 transition-colors"
                  title="Play Again"
                  aria-label="Play Again"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <p className="font-body text-[11px] text-gray-400 leading-tight">The word was</p>
                <p className="font-display text-sm font-bold text-casino-gold uppercase tracking-widest leading-tight">
                  {targetWord}
                </p>
              </div>
            </div>
          )}

          {/* Hall of Fame / Shame — player's all-time net score */}
          <div className="w-full max-w-md mt-3">
            <div className="flex items-center gap-2 mb-2 justify-center">
              <Crown className="w-3.5 h-3.5 text-casino-gold" />
              <h2 className="font-display text-xs font-bold text-gold-gradient tracking-wider">
                HALL OF FAME / SHAME
              </h2>
            </div>
            {statsLoading ? (
              <div className="text-center text-gray-500 font-body text-xs py-2">
                Loading...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-casino-gold/30 bg-casino-ink/50">
                <span className="font-body text-[11px] uppercase tracking-wider text-gray-400">Your all-time Score</span>
                <span className={`font-display text-lg font-bold tabular-nums ${allTimeCredit - allTimeDebit >= 0 ? 'text-gold-gradient' : 'text-rose-400'}`}>
                  {(allTimeCredit - allTimeDebit).toLocaleString()}
                </span>
                <button
                  onClick={resetStats}
                  className="ml-1 p-1 rounded-md hover:bg-rose-500/15 text-gray-500 hover:text-rose-400 transition-colors"
                  title="Reset all-time score to 0"
                  aria-label="Reset all-time score to 0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reveal Popup Modal */}
      {showPayout && revealedWords.length > 0 && (
        <RevealPopup
          words={revealedWords}
          targetWord={targetWord}
          candidateWords={candidateWordsRef.current}
          onClose={() => setShowPayout(false)}
          onWordSelect={(w) => setDefWord(w)}
        />
      )}

      {/* "No word exists" popup — shown when first spin lands on a letter
          with no 7-letter words starting with it */}
      {noWordLetter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setNoWordLetter(null)}
        >
          <div
            className="reveal-popup-window max-w-sm w-full text-center p-8"
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl font-display font-bold text-casino-gold mb-2">
              {noWordLetter}
            </div>
            <p className="font-display text-lg font-bold text-white mb-2 tracking-wide">
              No Word Exists
            </p>
            <p className="font-body text-sm text-gray-400 mb-6">
              No 7-letter word starts with the letter{' '}
              <span className="text-casino-gold font-bold">{noWordLetter}</span>.
              Spin again to try a new letter.
            </p>
            <button
              onClick={() => setNoWordLetter(null)}
              className="font-btn px-6 py-2.5 rounded-xl bg-casino-gold text-casino-ink font-bold tracking-wider hover:bg-casino-gold-light transition-colors"
            >
              SPIN AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Word Definition Popup */}
      {defWord && (
        <WordDefinition
          word={defWord}
          onClose={() => setDefWord(null)}
        />
      )}

      {/* Pro Tips Popup */}
      {showProTips && (
        <ProTipsPopup onClose={() => setShowProTips(false)} />
      )}
      </div>
    </div>
  );
}
