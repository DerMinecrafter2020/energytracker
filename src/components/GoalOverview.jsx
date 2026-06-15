import React from 'react';
import { CalendarDays, Target } from 'lucide-react';

const formatMg = (value) => `${Math.round(Number(value) || 0).toLocaleString('de-DE')} mg`;

const PeriodCard = ({ title, subtitle, period, color }) => {
  const total = Number(period?.totalCaffeine) || 0;
  const target = Number(period?.target) || 0;
  const percent = Math.min(140, Number(period?.percent) || 0);
  const barColor = color === 'amber' ? 'from-amber-500 to-orange-400' : 'from-blue-500 to-cyan-300';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-lg border shrink-0 ${
          percent > 100
            ? 'bg-red-500/10 text-red-300 border-red-500/30'
            : 'bg-green-500/10 text-green-300 border-green-500/30'
        }`}>
          {Math.round(percent)}%
        </span>
      </div>

      <p className="text-lg font-bold text-white mb-2">
        {formatMg(total)} <span className="text-xs font-medium text-slate-500">von {formatMg(target)}</span>
      </p>

      <div className="h-2.5 rounded-full bg-black/30 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <p className="text-sm font-semibold text-white">{period?.loggedDays || 0}</p>
          <p className="text-[10px] text-slate-500">Tage</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{formatMg(period?.averagePerDay || 0)}</p>
          <p className="text-[10px] text-slate-500">Schnitt</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{period?.daysOverLimit || 0}</p>
          <p className="text-[10px] text-slate-500">über Limit</p>
        </div>
      </div>
    </div>
  );
};

const GoalOverview = ({ overview }) => {
  if (!overview?.week || !overview?.month) return null;

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
          <Target className="w-5 h-5 text-blue-300" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Wochen- und Monatsziele</h2>
          <p className="text-xs text-slate-500">Aus deinem Tageslimit berechnet</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PeriodCard
          title="Diese Woche"
          subtitle={`${overview.week.start} bis ${overview.week.end}`}
          period={overview.week}
          color="blue"
        />
        <PeriodCard
          title="Dieser Monat"
          subtitle={`${overview.month.start} bis ${overview.month.end}`}
          period={overview.month}
          color="amber"
        />
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {(overview.week.daily || []).map((day) => {
          const pct = overview.dailyLimit > 0 ? Math.min(100, ((day.totalCaffeine || 0) / overview.dailyLimit) * 100) : 0;
          return (
            <div key={day.date} className="min-w-0">
              <div className="h-12 rounded-xl bg-white/5 border border-white/5 overflow-hidden flex items-end">
                <div className="w-full bg-gradient-to-t from-blue-600 to-blue-300 rounded-t-lg" style={{ height: `${Math.max(5, pct)}%` }} />
              </div>
              <p className="text-[10px] text-slate-600 text-center mt-1 truncate">{day.date.slice(5)}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5" />
        Zielwert pro Woche: {formatMg((overview.dailyLimit || 400) * 7)}
      </p>
    </div>
  );
};

export default GoalOverview;
