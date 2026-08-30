import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Eye, BookOpen, Plus } from 'lucide-react';
import { scoreWord } from '../lib/scoring';
import WordDefinition from './WordDefinition';

interface PayoutSlipProps {
  words: string[];
  onClose: () => void;
  onWordSelect?: (word: string) => void;
  filledWords?: string[];
}

export default function PayoutSlip({ words, onClose, onWordSelect, filledWords = [] }: PayoutSlipProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [defWord, setDefWord] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (defWord) setDefWord(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, defWord]);

  const grouped = useMemo(() => {
    const groups: Record<number, string[]> = {};
    for (const word of words) {
      const len = word.length;
      if (!groups[len]) groups[len] = [];
      groups[len].push(word);
    }
    return Object.entries(groups)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([len, ws]) => ({ length: Number(len), words: ws }));
  }, [words]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.85)' }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="gold-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-casino-gold/30 bg-gradient-to-r from-casino-ink to-casino-ink-dark rounded-t-xl">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6 text-casino-gold" />
                <div>
                  <h2 className="font-display text-xl font-bold text-gold-gradient tracking-wider">
                    REVEALED WORDS
                  </h2>
                  <p className="text-xs text-gray-400">
                    {words.length} valid 7-letter words · Click any word for its meaning
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-casino-gold/20 transition-colors text-gray-400 hover:text-casino-gold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 bg-gradient-to-b from-casino-ink-dark to-casino-ink"
            >
              {grouped.map(({ length, words: groupWords }) => (
                <div key={length} className="mb-5">
                  <h3 className="font-display text-sm font-bold tracking-wider text-casino-gold/80 uppercase mb-2 pb-1 border-b border-casino-gold/20">
                    {length}-Letter Words
                    <span className="ml-2 text-gray-500 font-body font-normal">
                      ({groupWords.length})
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {groupWords.map((word) => {
                      const isFilled = filledWords.includes(word);
                      return (
                        <div
                          key={word}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm font-medium transition-all duration-200 border ${
                            isFilled
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-casino-ink border-casino-gold/20 text-gray-300'
                          }`}
                        >
                          <button
                            onClick={() => setDefWord(word)}
                            className="hover:text-casino-gold transition-colors"
                            title="View meaning"
                          >
                            {word}
                          </button>
                          <span className="text-xs text-gray-500">
                            {scoreWord(word)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {words.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="font-display text-lg">No words found</p>
                  <p className="text-sm mt-1">Spin to fill tiles, then reveal</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t-2 border-casino-gold/30 bg-casino-ink-dark rounded-b-xl">
              <p className="text-xs text-gray-500 text-center font-body">
                Click a word to see its meaning · Press ESC to close
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Word Definition Popup */}
      {defWord && (
        <WordDefinition
          word={defWord}
          onClose={() => setDefWord(null)}
          onAddToSlots={onWordSelect}
          isFilled={filledWords.includes(defWord)}
        />
      )}
    </>
  );
}
