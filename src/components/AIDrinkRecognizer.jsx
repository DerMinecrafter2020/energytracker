import React, { useState } from 'react';
import { Sparkles, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { recognizeDrink } from '../services/aiApi';

const confidenceColors = {
  hoch: 'text-green-400',
  mittel: 'text-amber-400',
  niedrig: 'text-red-400',
};

const AIDrinkRecognizer = ({ onRecognized }) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');

  const handleRecognize = async () => {
    if (!description.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await recognizeDrink(description.trim());
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onRecognized({
      name: result.name,
      caffeinePer100ml: result.caffeinePer100ml,
      sizeMl: result.sizeMl,
    });
    setDescription('');
    setResult(null);
  };

  return (
    <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in">
      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-violet-400" />
        KI-Getränkeerkennung
      </h3>
      <p className="text-xs text-slate-500 mb-4">Beschreibe dein Getränk, die KI schätzt den Koffeingehalt.</p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRecognize()}
          placeholder="z.B. großer Espresso doppio, Red Bull 250ml..."
          className="input-dark flex-1"
          disabled={loading}
        />
        <button
          onClick={handleRecognize}
          disabled={!description.trim() || loading}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors shrink-0 flex items-center gap-1.5"
        >
          {loading ? (
            <span className="inline-flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          ) : (
            <><Search className="w-4 h-4" />Erkennen</>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{result.name}</span>
            <span className={`text-xs font-medium ${confidenceColors[result.confidence] || 'text-slate-400'}`}>
              Konfidenz: {result.confidence}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-slate-500 mb-0.5">Koffein/100ml</p>
              <p className="text-violet-300 font-bold text-base">{result.caffeinePer100ml} mg</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-slate-500 mb-0.5">Menge</p>
              <p className="text-violet-300 font-bold text-base">{result.sizeMl} ml</p>
            </div>
          </div>
          {result.hint && (
            <p className="text-xs text-slate-500 italic">{result.hint}</p>
          )}
          <button
            onClick={handleApply}
            className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            In manuellen Rechner übernehmen
          </button>
        </div>
      )}
    </div>
  );
};

export default AIDrinkRecognizer;
