import React, { useState } from 'react';
import { Brain, RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { fetchDailySummary } from '../services/aiApi';

const DAILY_LIMIT = 400;

const AIDailySummary = ({ logs = [], totalCaffeine = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  const handleFetch = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchDailySummary({ logs, totalCaffeine, dailyLimit: DAILY_LIMIT });
      setResult(data);
      setExpanded(true);
    } catch (err) {
      setError(err.message);
      setExpanded(true);
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
    <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" />
          <span className="text-base font-bold text-white">KI-Tagesauswertung</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
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

          {/* Generate button */}
          <button
            onClick={handleFetch}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />Analysiere...</>
            ) : (
              <><Zap className="w-4 h-4" />KI-Analyse starten</>
            )}
          </button>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          {result?.summary && (
            <div className="bg-white/5 border border-violet-500/15 rounded-2xl p-4">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{result.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIDailySummary;
