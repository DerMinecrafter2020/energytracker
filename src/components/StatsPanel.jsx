import React, { useState, useEffect } from 'react';
import { fetchTodayStats, fetchWeeklyStats, fetchUserSettings } from '../services/api';

export default function StatsPanel({ session, isLoading }) {
  const [todayStats, setTodayStats] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load stats
  useEffect(() => {
    if (!session?.email) return;

    const loadStats = async () => {
      setLoading(true);
      try {
        const [today, weekly, settingsData] = await Promise.all([
          fetchTodayStats({
            userId: session.userId || null,
            email: session.email,
          }),
          fetchWeeklyStats({
            userId: session.userId || null,
            email: session.email,
          }),
          fetchUserSettings({
            userId: session.userId || null,
            email: session.email,
          }),
        ]);

        setTodayStats(today);
        setWeeklyStats(weekly);
        setSettings(settingsData);
      } catch (err) {
        console.error('Fehler beim Laden der Statistiken:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [session]);

  if (loading || !todayStats) {
    return <div className="p-4 bg-gray-50 rounded-lg">Lädt...</div>;
  }

  const limit = settings?.dailyLimit || 400;
  const percentage = Math.min(100, Math.round((todayStats.totalCaffeine / limit) * 100));
  const isOver = todayStats.isOverLimit;
  const barColor = isOver ? 'bg-red-500' : 'bg-green-500';

  // Format date
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[d.getDay()] + ' ' + d.getDate();
  };

  // Find max caffeine for scaling
  const maxCaffeine = Math.max(...weeklyStats.map((s) => s.totalCaffeine || 0), 100);

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 space-y-6">
      <h2 className="text-lg font-semibold">📊 Statistiken</h2>

      {/* Today Stats */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-gray-700 mb-3">Heute</h3>
        <p className="text-3xl font-bold text-gray-800 mb-1">
          {todayStats.totalCaffeine}mg
        </p>
        <p className="text-sm text-gray-600 mb-3">
          von {limit}mg Limit • {todayStats.logCount} Getränk{todayStats.logCount !== 1 ? 'e' : ''}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-600">
          {percentage}% • {isOver ? `⚠️ ${todayStats.totalCaffeine - limit}mg über Limit` : `✅ ${todayStats.remainingCaffeine}mg verbleibend`}
        </p>
      </div>

      {/* Weekly Chart */}
      <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200">
        <h3 className="font-medium text-gray-700 mb-4">Letzte 7 Tage</h3>

        {weeklyStats.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Daten</p>
        ) : (
          <div className="space-y-2">
            {weeklyStats.map((day, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-12 text-xs font-medium text-gray-600">
                  {formatDate(day.date)}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                      style={{
                        width: maxCaffeine > 0 ? `${(day.totalCaffeine / maxCaffeine) * 100}%` : '0%',
                      }}
                    />
                  </div>
                  <div className="w-16 text-right">
                    <p className="text-sm font-semibold text-gray-800">{day.totalCaffeine}mg</p>
                    <p className="text-xs text-gray-500">{day.count} Getränk{day.count !== 1 ? 'e' : ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Summary */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-700 mb-3">Wochenzusammenfassung</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-800">
              {Math.round(weeklyStats.reduce((sum, day) => sum + day.totalCaffeine, 0) / weeklyStats.length || 0)}
            </p>
            <p className="text-xs text-gray-600">Ø pro Tag</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">
              {weeklyStats.filter((day) => day.totalCaffeine > limit).length}
            </p>
            <p className="text-xs text-gray-600">Tage über Limit</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">
              {weeklyStats.reduce((sum, day) => sum + day.count, 0)}
            </p>
            <p className="text-xs text-gray-600">Getränke gesamt</p>
          </div>
        </div>
      </div>
    </div>
  );
}
