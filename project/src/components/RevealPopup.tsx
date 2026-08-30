import { useEffect, useRef, useState, useCallback } from 'react';
import { Eye, X, GripHorizontal } from 'lucide-react';

interface RevealPopupProps {
  words: string[];
  targetWord: string;
  candidateWords?: string[];
  onClose: () => void;
  onWordSelect: (word: string) => void;
}

const GROUPS = [7, 6, 5];
const MAX_PER_GROUP = 12;

export default function RevealPopup({ words, targetWord, candidateWords = [], onClose, onWordSelect }: RevealPopupProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Centre the window on first render (after layout)
  useEffect(() => {
    if (!windowRef.current) return;
    const el = windowRef.current;
    const w = el.offsetWidth || 340;
    const h = el.offsetHeight || 400;
    const x = Math.max(8, (window.innerWidth - w) / 2);
    const y = Math.max(8, (window.innerHeight - h) / 2);
    setPos({ x, y });
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    if (!windowRef.current) return;
    dragging.current = true;
    const rect = windowRef.current.getBoundingClientRect();
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [startDrag]);

  useEffect(() => {
    const move = (clientX: number, clientY: number) => {
      if (!dragging.current || !windowRef.current) return;
      const el = windowRef.current;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const newX = Math.max(0, Math.min(window.innerWidth - w, clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - h, clientY - dragOffset.current.y));
      setPos({ x: newX, y: newY });
    };
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault();
        move(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onEnd = () => { dragging.current = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const groups = GROUPS.map((len) => ({
    len,
    items: words.filter((w) => w.length === len).slice(0, MAX_PER_GROUP),
  })).filter((g) => g.items.length > 0);

  // Other 7-letter words that start with the same first letter as the target
  // — the possible target words the machine could have picked instead.
  const firstLetter = targetWord[0]?.toLowerCase() ?? '';
  const otherCandidates = candidateWords
    .filter((w) => w.toLowerCase() !== targetWord.toLowerCase())
    .sort()
    .slice(0, 24);

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
      <div
        ref={windowRef}
        className="reveal-popup-window"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          width: 'min(360px, 92vw)',
          maxHeight: '80vh',
          left: pos ? pos.x : '50%',
          top: pos ? pos.y : '50%',
          transform: pos ? 'none' : 'translate(-50%, -50%)',
          touchAction: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Drag handle header */}
        <div
          className="reveal-popup-header"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          style={{ touchAction: 'none' }}
        >
          <GripHorizontal className="w-4 h-4 text-casino-gold/50 mx-auto" />
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-casino-gold" />
              <p className="font-display text-sm font-bold tracking-widest text-gold-gradient">
                POSSIBLE WORDS
              </p>
            </div>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-casino-gold/15 text-gray-500 hover:text-casino-gold transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="font-body text-xs text-gray-500 mt-1 text-center">
            from <span className="text-casino-gold font-semibold tracking-wider uppercase">{targetWord}</span>
          </p>
        </div>

        <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }} />

        {/* Scrollable word list — 7, 6, 5 only, max 5 each */}
        <div className="overflow-y-auto flex-1 px-4 py-3 reveal-popup-scroll">
          {otherCandidates.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-btn text-xs tracking-widest text-sky-400">
                  OTHER {firstLetter.toUpperCase()}-WORDS
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(56,189,248,0.2)' }} />
              </div>
              <p className="font-body text-[11px] text-gray-500 mb-2">
                The wheel could have landed on any of these {otherCandidates.length === 24 ? '24+' : otherCandidates.length} other 7-letter words starting with <span className="text-sky-400 font-bold">{firstLetter.toUpperCase()}</span>:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {otherCandidates.map((word) => (
                  <button
                    key={word}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => onWordSelect(word)}
                    className="word-chip word-chip-sky"
                  >
                    {word.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.map(({ len, items }) => (
            <div key={len} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-btn text-xs tracking-widest ${len === 7 ? 'text-casino-gold' : 'text-gray-400'}`}>
                  {len}-LETTER
                </span>
                <div className="flex-1 h-px" style={{ background: len === 7 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((word) => (
                  <button
                    key={word}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => onWordSelect(word)}
                    className={`word-chip ${len === 7 ? 'word-chip-gold' : 'word-chip-plain'}`}
                  >
                    {word.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="reveal-popup-footer">
          <p className="font-body text-xs text-gray-600 text-center">
            Drag header to move · tap a word for its definition
          </p>
        </div>
      </div>
    </div>
  );
}
