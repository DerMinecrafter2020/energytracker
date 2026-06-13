import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Moon, Zap, X } from 'lucide-react';

const ACTIVE_SLEEP_THRESHOLD_MG = 50;
const HALF_LIFE_HOURS = 5;

const getLogDate = (log) => {
  const value = log?.createdAt || log?.timestamp;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const sleepDateForToday = (time) => {
  const now = new Date();
  const match = String(time || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const date = new Date(now);
  date.setSeconds(0, 0);
  if (match) date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  else date.setHours(23, 0, 0, 0);
  if (date <= now) date.setDate(date.getDate() + 1);
  return date;
};

const activeCaffeineAt = (logs, point) =>
  logs.reduce((sum, log) => {
    const takenAt = getLogDate(log);
    if (!takenAt || takenAt > point) return sum;
    const hours = Math.max(0, (point - takenAt) / 36e5);
    return sum + (Number(log.caffeine) || 0) * Math.pow(0.5, hours / HALF_LIFE_HOURS);
  }, 0);

export default function WarningAlert({ todayStats, settings, onClose }) {
  const [warnings, setWarnings] = useState([]);
  const [dismissedWarnings, setDismissedWarnings] = useState(new Set());

  useEffect(() => {
    if (!todayStats || !settings) {
      setWarnings([]);
      return;
    }

    const newWarnings = [];
    const limit = settings.dailyLimit || 400;
    const logs = Array.isArray(todayStats.logs) ? todayStats.logs : [];

    // Warning: Over limit
    if (settings.notifyAtLimit && todayStats.isOverLimit) {
      const excess = todayStats.totalCaffeine - limit;
      newWarnings.push({
        id: 'over-limit',
        type: 'error',
        icon: AlertTriangle,
        title: 'Limit überschritten!',
        message: `Du hast dein Limit um ${excess}mg überschritten (${todayStats.totalCaffeine}/${limit}mg)`,
        color: 'red',
      });
    }

    // Warning: Late caffeine (after 18:00)
    if (settings.notifyLate) {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 18) {
        const recentDrinks = logs.filter((log) => {
          const logTime = getLogDate(log);
          if (!logTime) return false;
          return logTime.getHours() >= 18;
        });
        if (recentDrinks.length > 0) {
          const lastDrink = recentDrinks[recentDrinks.length - 1];
          const drinkTime = getLogDate(lastDrink);
          newWarnings.push({
            id: 'late-caffeine',
            type: 'warning',
            icon: Moon,
            title: 'Spätes Koffein',
            message: `${lastDrink.name} um ${drinkTime.getHours()}:${String(drinkTime.getMinutes()).padStart(2, '0')} Uhr könnte deinen Schlaf beeinflussen`,
            color: 'blue',
          });
        }
      }

      const sleepAt = sleepDateForToday(settings.sleepTime || '23:00');
      const activeAtSleep = Math.round(activeCaffeineAt(logs, sleepAt));
      if (activeAtSleep >= ACTIVE_SLEEP_THRESHOLD_MG) {
        newWarnings.push({
          id: 'sleep-caffeine',
          type: 'warning',
          icon: Moon,
          title: 'Koffein zur Schlafenszeit',
          message: `Um ${sleepAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr sind voraussichtlich noch ca. ${activeAtSleep}mg aktiv.`,
          color: 'blue',
        });
      }
    }

    // Warning: Rapid consumption
    if (settings.notifyRapid && logs.length >= 3) {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const recentDrinks = logs.filter((log) => {
        const logTime = getLogDate(log);
        return logTime && logTime > twoHoursAgo;
      });

      if (recentDrinks.length >= 3) {
        newWarnings.push({
          id: 'rapid-consumption',
          type: 'info',
          icon: Zap,
          title: 'Schnelle Folge erkannt',
          message: `${recentDrinks.length} Getränke in 2h – versuche langsamer zu trinken!`,
          color: 'amber',
        });
      }
    }

    setWarnings(newWarnings);
  }, [todayStats, settings]);

  const handleDismiss = (id) => {
    setDismissedWarnings((prev) => new Set([...prev, id]));
    setWarnings((prev) => prev.filter((w) => w.id !== id));
  };

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {warnings.map((warning) => {
        const bgColor =
          warning.color === 'red'
            ? 'bg-red-500/10 border-red-500/30'
            : warning.color === 'blue'
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-amber-500/10 border-amber-500/30';

        const textColor =
          warning.color === 'red'
            ? 'text-red-300'
            : warning.color === 'blue'
              ? 'text-blue-300'
              : 'text-amber-300';

        const Icon = warning.icon;

        return (
          <div
            key={warning.id}
            className={`p-3.5 rounded-2xl border flex items-start gap-3
              ${bgColor} animate-in fade-in slide-in-from-top-2 duration-300`}
          >
            <Icon className={`w-5 h-5 ${textColor} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${textColor}`}>
                {warning.title}
              </p>
              <p className={`text-xs ${textColor} opacity-90 mt-0.5`}>
                {warning.message}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(warning.id)}
              className={`${textColor} hover:opacity-100 opacity-70 transition-opacity
                shrink-0 p-1 hover:bg-white/10 rounded-lg`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}



