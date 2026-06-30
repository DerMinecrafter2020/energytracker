import React from 'react';
import { BarChart2, Brain, Clock, Coffee, Gauge } from 'lucide-react';

const PatternInsights = ({ insights }) => {
  if (!insights) return null;
  const topDrinks = Array.isArray(insights.topDrinks) ? insights.topDrinks : [];
  const maxDrinkCount = Math.max(1, ...topDrinks.map((drink) => Number(drink.count) || 0));
  const riskColor = insights.riskLevel === 'high'
    ? 'bg-red-500/10 border-red-500/30 text-red-300'
    : (insights.riskLevel === 'medium'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300');

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Persoenliche Muster</h2>
          <p className="text-xs text-slate-500">Aus den letzten 30 Tagen</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-5">
        <div className={`rounded-2xl border px-4 py-3 text-sm ${riskColor}`}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="flex items-center gap-2 font-semibold">
              <Gauge className="w-4 h-4" />
              Muster-Risiko
            </span>
            <span>{Math.round(Number(insights.riskScore) || 0)}%</span>
          </div>
          <p className="text-slate-200">{insights.focus}</p>
        </div>
        {(insights.messages || []).map((message) => (
          <div key={message} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300">
            {message}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3">
          <Clock className="w-4 h-4 text-blue-300 mb-2" />
          <p className="text-xl font-bold text-white">{insights.lateDrinkCount || 0}</p>
          <p className="text-xs text-slate-500">späte Einträge</p>
        </div>
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3">
          <BarChart2 className="w-4 h-4 text-red-300 mb-2" />
          <p className="text-xl font-bold text-white">{insights.overLimitDays || 0}</p>
          <p className="text-xs text-slate-500">Tage über Limit</p>
        </div>
      </div>

      {topDrinks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-300" />
            Häufigste Getränke
          </h3>
          <div className="space-y-2">
            {topDrinks.map((drink) => (
              <div key={drink.name} className="flex items-center gap-3">
                <span className="text-sm text-white truncate flex-1">{drink.name}</span>
                <div className="w-24 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-300"
                    style={{ width: `${((Number(drink.count) || 0) / maxDrinkCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-8 text-right">{drink.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatternInsights;
