import { useEffect, useRef, useState, useCallback } from 'react';
import { Lightbulb, X, GripHorizontal } from 'lucide-react';

interface ProTipsPopupProps {
  onClose: () => void;
}

const TIPS: { n: number; text: React.ReactNode }[] = [
  { n: 1, text: <>First SPIN pops the 1st letter of the hidden word. Guess the word in 30s and get the highest <strong>500 Points</strong></> },
  { n: 2, text: <>Second SPIN correct Guess gets <strong>400 Points</strong></> },
  { n: 3, text: <>Third SPIN correct Guess gets <strong>200 Points</strong></> },
  { n: 4, text: <>Fourth SPIN is the Last spin, if Guessed correctly, gets <strong>100 Points</strong></> },
  { n: 5, text: <>If FAILED, You Loose and <strong>500 points</strong> will be deducted from the All-time Score.</> },
  { n: 6, text: <>Click REVEAL to see many combinations of the hidden word with pop up meanings from the dictionary</> },
  { n: 7, text: <>Click on top right icon inside the roulette box to Start A New Game</> },
];

export default function ProTipsPopup({ onClose }: ProTipsPopupProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!windowRef.current) return;
    const el = windowRef.current;
    const w = el.offsetWidth || 360;
    const h = el.offsetHeight || 460;
    const x = Math.max(8, (window.innerWidth - w) / 2);
    const y = Math.max(8, (window.innerHeight - h) / 2);
    setPos({ x, y });
  }, []);

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

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
      <div
        ref={windowRef}
        className="reveal-popup-window"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          width: 'min(380px, 92vw)',
          maxHeight: '82vh',
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
              <span className="prorec-led" aria-hidden="true">
                <span className="prorec-led-core" />
              </span>
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-casino-gold" />
                <p className="font-display text-sm font-bold tracking-widest text-gold-gradient">
                  SOLOALPHA PRO TIPS
                </p>
              </div>
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
        </div>

        <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }} />

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 py-3 reveal-popup-scroll">
          <div className="mb-3">
            <p className="font-display text-[11px] text-casino-gold tracking-wider mb-1">
              Add the SoloAlpha link from browser to your Home Screen
            </p>
            <p className="font-body text-[11px] text-gray-400">
              Word Game Puzzle · A 7-LETTER word guessing game
            </p>
          </div>

          <ol className="space-y-2.5">
            {TIPS.map((tip) => (
              <li key={tip.n} className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-casino-gold/15 border border-casino-gold/40 flex items-center justify-center font-display text-[10px] text-casino-gold font-bold">
                  {tip.n}
                </span>
                <p className="font-body text-[12px] leading-relaxed text-gray-300">
                  {tip.text}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-4 pt-3 border-t border-casino-gold/15">
            <p className="font-display text-[11px] text-casino-gold tracking-wider mb-1">
              Points Table
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5">
              {[
                ['Spin 1', '500'],
                ['Spin 2', '400'],
                ['Spin 3', '200'],
                ['Spin 4', '100'],
                ['Fail', '−500'],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between font-body text-[11px]">
                  <span className="text-gray-400">{label}</span>
                  <span className={val.startsWith('−') ? 'text-rose-400 font-bold' : 'text-casino-gold font-bold'}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="font-body text-[11px] text-gray-500 mt-4 text-center">
            See your All-Time score under <span className="text-casino-gold">Hall of Fame/Shame</span> 😎
          </p>
        </div>

        {/* Footer */}
        <div className="reveal-popup-footer">
          <p className="font-body text-xs text-gray-600 text-center">
            Drag header to move
          </p>
        </div>
      </div>
    </div>
  );
}
