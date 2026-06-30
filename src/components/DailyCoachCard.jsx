import React from 'react';
import { Bot, CheckCircle2, Gauge } from 'lucide-react';

const riskClasses = {
  low: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  high: 'border-red-500/25 bg-red-500/10 text-red-200',
};

const riskLabels = {
  low: 'ruhig',
  medium: 'achtsam',
  high: 'kritisch',
};

const DailyCoachCard = ({ coach }) => {
  if (!coach) return null;
  const risk = ['low', 'medium', 'high'].includes(coach.risk) ? coach.risk : 'low';
  const actions = Array.isArray(coach.actions) ? coach.actions.slice(0, 3) : [];

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-violet-300" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">Tagescoach</h2>
          <p className="text-xs text-slate-500">KI-Fokus fuer den ausgewaehlten Tag</p>
        </div>
      </div>

      <div className={`rounded-2xl border px-4 py-3 mb-3 ${riskClasses[risk]}`}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1">
          <Gauge className="w-3.5 h-3.5" />
          {riskLabels[risk]}
        </div>
        <p className="text-sm font-bold text-white">{coach.headline}</p>
        <p className="text-sm mt-1 opacity-90">{coach.advice}</p>
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action} className="flex items-start gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <span>{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyCoachCard;
