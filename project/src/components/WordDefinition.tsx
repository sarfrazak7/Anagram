import { useState, useEffect, useCallback } from 'react';
import { X, BookOpen, Loader2, Plus, AlertCircle } from 'lucide-react';

interface WordDefinitionProps {
  word: string;
  onClose: () => void;
  onAddToSlots?: (word: string) => void;
  isFilled?: boolean;
}

interface Definition {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
}

async function fetchDefinitionFromAPI(word: string): Promise<Definition[]> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
  if (!res.ok) throw new Error('Not found');
  const data = await res.json();
  const mapped: Definition[] = (data[0]?.meanings ?? []).map((m: any) => ({
    partOfSpeech: m.partOfSpeech ?? '',
    definitions: (m.definitions ?? []).slice(0, 3).map((d: any) => ({
      definition: d.definition ?? '',
      example: d.example,
    })),
  }));
  if (mapped.length === 0) throw new Error('No meanings');
  return mapped;
}

export default function WordDefinition({ word, onClose, onAddToSlots, isFilled }: WordDefinitionProps) {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDefinition = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const defs = await fetchDefinitionFromAPI(word);
      setDefinitions(defs);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [word]);

  useEffect(() => {
    fetchDefinition();
  }, [fetchDefinition]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[80vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gold-border rounded-2xl shadow-2xl flex flex-col max-h-[80vh] bg-gradient-to-b from-casino-ink-dark to-casino-ink">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b-2 border-casino-gold/30">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-casino-gold" />
              <h3 className="font-display text-2xl font-bold text-gold-gradient uppercase tracking-wide">
                {word}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-casino-gold/20 transition-colors text-gray-400 hover:text-casino-gold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-casino-gold animate-spin" />
                <p className="text-gray-500 font-body text-sm">Looking up definition...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <AlertCircle className="w-8 h-8 text-rose-400/60" />
                <p className="text-gray-500 font-body text-sm text-center">
                  No definition found for "{word}"
                </p>
                <p className="text-gray-600 font-body text-xs text-center">
                  This may be a valid but obscure word not covered by standard dictionaries.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {definitions.map((def, i) => (
                  <div key={i}>
                    {def.partOfSpeech && (
                      <span className="inline-block text-xs font-bold text-casino-gold/70 uppercase tracking-wider bg-casino-gold/10 px-2 py-0.5 rounded-full mb-2">
                        {def.partOfSpeech}
                      </span>
                    )}
                    <ol className="space-y-2 list-decimal list-inside">
                      {def.definitions.map((d, j) => (
                        <li key={j} className="text-sm text-gray-300 font-body leading-relaxed">
                          {d.definition}
                          {d.example && (
                            <p className="text-xs text-gray-500 italic mt-1 ml-4">
                              "{d.example}"
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {onAddToSlots && (
            <div className="px-5 py-3 border-t-2 border-casino-gold/30">
              {isFilled ? (
                <p className="text-center text-sm text-emerald-400 font-body font-medium">
                  Already in your slots
                </p>
              ) : (
                <button
                  onClick={() => {
                    onAddToSlots(word);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-casino-gold to-casino-gold-dark text-casino-ink-dark font-display font-bold tracking-wide hover:from-casino-gold-light hover:to-casino-gold transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add to Slots
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
