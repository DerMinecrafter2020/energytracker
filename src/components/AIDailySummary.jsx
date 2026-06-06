import React, { useState } from 'react';
import { Brain, RefreshCw, Zap } from 'lucide-react';
import { fetchDailySummary } from '../services/aiApi';

const DAILY_LIMIT = 400;

const AIDailySummary = ({ logs = [], totalCaffeine = 0 }) => {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  const handleFetch = async () => {
    if (result || loading) return; // Only fetch if not already fetched
    setLoading(true);
    setError('');
    try {
      const data = await fetchDailySummary({ logs, totalCaffeine, dailyLimit: DAILY_LIMIT });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const percent = Math.min(100, Math.round((totalCaffeine / DAILY_LIMIT) * 100));
  const remaining = Math.max(0, DAILY_LIMIT - totalCaffeine);

  const statusColor = percent >= 100
    ? 'text-red-400'
    : percent >= 75
      ? 'text-amber-400'
      : 'text-green-400';

  return (
    <div 
      className={`glass-card rounded-3xl p-6 mb-6 animate-fade-in transition-all ${!result && !loading ? 'cursor-pointer hover:bg-white/5 active:scale-[0.98]' : ''}`}
      onClick={!result && !loading ? handleFetch : undefined}
    >
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-violet-400" />
        <span className="text-base font-bold text-white">KI-Tagesauswertung</span>
      </div>

      {!result && !loading && !error && (
        <div className="flex items-center justify-center gap-2 py-4 text-violet-400 bg-violet-500/10 rounded-2xl border border-violet-500/20">
          <Zap className="w-4 h-4" />
          <span className="text-sm font-medium">Tippe hier, um die Analyse zu starten</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-violet-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Analysiere...</span>
        </div>
      )}

      {(result || error) && (
        <div className="space-y-4 animate-fade-in">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
              <p className="text-slate-500 mb-0.5">Heute</p>
              <p className={`font-bold text-base ${statusColor}`}>{totalCaffeine} mg</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
              <p className="text-slate-500 mb-0.5">Limit</p>
              <p className="font-bold text-base text-slate-300">{DAILY_LIMIT} mg</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
              <p className="text-slate-500 mb-0.5">Noch frei</p>
              <p className={`font-bold text-base ${remaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {remaining} mg
              </p>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex justify-between items-center">
              <span>{error}</span>
              <button onClick={(e) => { e.stopPropagation(); handleFetch(); }} className="underline p-1">Erneut versuchen</button>
            </div>
          )}

          {result?.summary && (
            <div className="bg-white/5 border border-violet-500/15 rounded-2xl p-4">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.summary.replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIDailySummary;
