import React from 'react';
import { Award, CheckCircle, Lock } from 'lucide-react';

const AchievementsPanel = ({ achievements = [] }) => {
  const items = Array.isArray(achievements) ? achievements : [];
  if (items.length === 0) return null;

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center">
          <Award className="w-5 h-5 text-green-300" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Achievements</h2>
          <p className="text-xs text-slate-500">Kleine Ziele, die nebenbei motivieren</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((achievement) => {
          const progress = Number(achievement.progress) || 0;
          const target = Math.max(1, Number(achievement.target) || 1);
          const pct = Math.min(100, (progress / target) * 100);
          return (
            <div key={achievement.id} className={`rounded-2xl border p-4 ${
              achievement.unlocked
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  achievement.unlocked ? 'bg-green-500/20 text-green-300' : 'bg-slate-700/60 text-slate-500'
                }`}>
                  {achievement.unlocked ? <CheckCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{achievement.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{achievement.description}</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                  <div className={`h-full rounded-full ${
                    achievement.unlocked ? 'bg-green-400' : 'bg-slate-500'
                  }`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 text-right">
                  {achievement.unit === 'mg' ? `${Math.round(progress)} / ${Math.round(target)} mg` : `${Math.round(progress)} / ${Math.round(target)}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementsPanel;
