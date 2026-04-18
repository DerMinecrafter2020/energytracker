import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Moon, Zap, X } from 'lucide-react';

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
        const recentDrinks = todayStats.logs.filter((log) => {
          const logTime = new Date(log.timestamp);
          return logTime.getHours() >= 18;
        });
        if (recentDrinks.length > 0) {
          const lastDrink = recentDrinks[recentDrinks.length - 1];
          const drinkTime = new Date(lastDrink.timestamp);
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
    }

    // Warning: Rapid consumption
    if (settings.notifyRapid && todayStats.logs.length >= 3) {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const recentDrinks = todayStats.logs.filter((log) => new Date(log.timestamp) > twoHoursAgo);

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
