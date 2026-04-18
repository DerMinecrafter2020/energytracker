import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { fetchTodayStats, fetchWeeklyStats, fetchUserSettings } from '../services/api';

export default function StatsPanel({ session, isLoading }) {
  const [todayStats, setTodayStats] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);

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
    return (
      <div className="glass-card rounded-3xl p-6 animate-fade-in">
        <div className="flex items-center justify-center py-8">
          <p className="text-slate-400 text-sm">Lädt...</p>
        </div>
      </div>
    );
  }

  const limit = settings?.dailyLimit || 400;
  const percentage = Math.min(100, Math.round((todayStats.totalCaffeine / limit) * 100));
  const isOver = todayStats.isOverLimit;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[d.getDay()] + ' ' + d.getDate();
  };

  const maxCaffeine = Math.max(...weeklyStats.map((s) => s.totalCaffeine || 0), 100);

  return (
    <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in">
      <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-400" />
        Statistiken
      </h3>

      <div className="space-y-5">
        {/* Today Summary */}
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/30
          rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Heute
              </p>
              <p className="text-3xl font-bold text-white mt-1">
                {todayStats.totalCaffeine}
                <span className="text-lg text-slate-400 ml-1">mg</span>
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Limit: {limit}mg</p>
              <p className="text-blue-300 font-semibold mt-1">{todayStats.logCount} Getränk{todayStats.logCount !== 1 ? 'e' : ''}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden border border-white/10 mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOver ? 'bg-gradient-to-r from-red-600 to-red-500' : 'bg-gradient-to-r from-blue-600 to-blue-400'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">{Math.round(percentage)}%</span>
            <span className={isOver ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
              {isOver ? `⚠️ ${todayStats.totalCaffeine - limit}mg über Limit` : `✓ ${todayStats.remainingCaffeine}mg verbleibend`}
            </span>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="border-t border-white/10 pt-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Letzte 7 Tage
          </h4>

          {weeklyStats.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Noch keine Daten</p>
          ) : (
            <div className="space-y-2.5">
              {weeklyStats.map((day, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <div className="w-10 text-xs font-medium text-slate-500">
                    {formatDate(day.date)}
                  </div>

                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                        style={{
                          width: maxCaffeine > 0 ? `${(day.totalCaffeine / maxCaffeine) * 100}%` : '0%',
                        }}
                      />
                    </div>
                    <div className="w-12 text-right">
                      <p className="text-xs font-semibold text-white">{day.totalCaffeine}mg</p>
                      <p className="text-xs text-slate-500">{day.count}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Summary Stats */}
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">
              {Math.round(weeklyStats.reduce((sum, day) => sum + day.totalCaffeine, 0) / Math.max(weeklyStats.length, 1) || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Ø pro Tag</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-red-400">
              {weeklyStats.filter((day) => day.totalCaffeine > limit).length}
            </p>
            <p className="text-xs text-slate-500 mt-1">über Limit</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {weeklyStats.reduce((sum, day) => sum + day.count, 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Getränke</p>
          </div>
        </div>
      </div>
    </div>
  );
}
