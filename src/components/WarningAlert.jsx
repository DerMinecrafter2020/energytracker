import React, { useEffect, useState } from 'react';

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
        type: 'warning',
        icon: '⚠️',
        title: 'Limit erreicht!',
        message: `Du hast dein Limit um ${excess}mg überschritten (${todayStats.totalCaffeine}/${limit}mg)`,
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
          newWarnings.push({
            id: 'late-caffeine',
            type: 'info',
            icon: '🌙',
            title: 'Spätes Koffein',
            message: `Koffein nach 18:00 könnte deinen Schlaf beeinflussen. ${recentDrinks[recentDrinks.length - 1].name} um ${new Date(recentDrinks[recentDrinks.length - 1].timestamp).getHours()}:${String(new Date(recentDrinks[recentDrinks.length - 1].timestamp).getMinutes()).padStart(2, '0')}`,
          });
        }
      }
    }

    // Warning: Rapid consumption
    if (settings.notifyRapid && todayStats.logs.length >= 3) {
      // Check if 3+ drinks in last 2 hours
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const recentDrinks = todayStats.logs.filter((log) => new Date(log.timestamp) > twoHoursAgo);

      if (recentDrinks.length >= 3) {
        newWarnings.push({
          id: 'rapid-consumption',
          type: 'info',
          icon: '⚡',
          title: 'Schnelle Folge',
          message: `Du hast ${recentDrinks.length} Getränke in den letzten 2 Stunden konsumiert. Langsamer trinken ist gesünder!`,
        });
      }
    }

    setWarnings(newWarnings);
  }, [todayStats, settings]);

  const handleDismiss = (id) => {
    setDismissedWarnings((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setWarnings((prev) => prev.filter((w) => w.id !== id));
    }, 300);
  };

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className={`p-3 rounded-lg border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
            warning.type === 'warning'
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <span className="text-lg">{warning.icon}</span>
          <div className="flex-1">
            <p className={`font-medium ${warning.type === 'warning' ? 'text-red-800' : 'text-blue-800'}`}>
              {warning.title}
            </p>
            <p className={`text-sm ${warning.type === 'warning' ? 'text-red-700' : 'text-blue-700'}`}>
              {warning.message}
            </p>
          </div>
          <button
            onClick={() => handleDismiss(warning.id)}
            className="text-gray-500 hover:text-gray-700 font-bold"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
