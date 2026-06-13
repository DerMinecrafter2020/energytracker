import React, { useMemo } from 'react';
import { Activity, Moon } from 'lucide-react';

const HALF_LIFE_HOURS = 5;
const ACTIVE_SLEEP_THRESHOLD_MG = 50;

const parseTimeForToday = (time, now = new Date()) => {
  const match = String(time || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const target = new Date(now);
  target.setSeconds(0, 0);
  if (match) {
    target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  } else {
    target.setHours(23, 0, 0, 0);
  }
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
};

const getLogDate = (log) => {
  const value = log?.createdAt || log?.timestamp;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const activeCaffeineAt = (logs, point) =>
  logs.reduce((sum, log) => {
    const takenAt = getLogDate(log);
    if (!takenAt || takenAt > point) return sum;
    const hours = Math.max(0, (point - takenAt) / 36e5);
    return sum + (Number(log.caffeine) || 0) * Math.pow(0.5, hours / HALF_LIFE_HOURS);
  }, 0);

const CaffeineDecayChart = ({ logs = [], sleepTime = '23:00' }) => {
  const data = useMemo(() => {
    const now = new Date();
    const sleepAt = parseTimeForToday(sleepTime, now);
    const points = Array.from({ length: 7 }, (_, index) => {
      const point = new Date(now.getTime() + index * 2 * 60 * 60 * 1000);
      return {
        label: point.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        active: Math.round(activeCaffeineAt(logs, point)),
      };
    });
    const current = Math.round(activeCaffeineAt(logs, now));
    const atSleep = Math.round(activeCaffeineAt(logs, sleepAt));
    const max = Math.max(100, current, atSleep, ...points.map((point) => point.active));
    return { points, current, atSleep, max, sleepLabel: sleepAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) };
  }, [logs, sleepTime]);

  const sleepRisk = data.atSleep >= ACTIVE_SLEEP_THRESHOLD_MG;

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Koffein-Abbau</h2>
            <p className="text-xs text-slate-500 truncate">Schaetzung mit {HALF_LIFE_HOURS}h Halbwertszeit</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-cyan-200">{data.current}</p>
          <p className="text-xs text-slate-500">mg aktiv</p>
        </div>
      </div>

      <div className="flex items-end gap-2 h-28 mb-3">
        {data.points.map((point) => (
          <div key={point.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="w-full h-20 rounded-xl bg-white/5 overflow-hidden flex items-end">
              <div
                className="w-full rounded-t-xl bg-gradient-to-t from-cyan-600 to-blue-300 transition-all"
                style={{ height: `${Math.max(4, (point.active / data.max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 truncate">{point.label}</span>
          </div>
        ))}
      </div>

      <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${
        sleepRisk
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
          : 'bg-green-500/10 border-green-500/30 text-green-200'
      }`}>
        <Moon className="w-4 h-4 shrink-0" />
        <p className="text-sm">
          Zur Schlafenszeit um {data.sleepLabel} Uhr voraussichtlich <strong>{data.atSleep} mg</strong> aktiv.
        </p>
      </div>
    </div>
  );
};

export default CaffeineDecayChart;
