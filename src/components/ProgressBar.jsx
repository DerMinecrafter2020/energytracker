import React from 'react';
import { Zap } from 'lucide-react';
import {
  calculateProgress,
  getProgressColor,
  getStatusMessage,
  DAILY_CAFFEINE_LIMIT,
} from '../utils/caffeineUtils';

const ProgressBar = ({ currentCaffeine, title = 'Koffein heute', isToday = true }) => {
  const percentage    = calculateProgress(currentCaffeine);
  const status        = getStatusMessage(currentCaffeine);
  const statusText    = isToday
    ? status.text
    : status.text.replace('heute', 'an diesem Tag').replace('Heute', 'An diesem Tag');

  // Material 3 Solid colors
  const barColor =
    percentage >= 100 ? 'bg-[#ffb4ab] text-[#690005]' :
    percentage >= 75  ? 'bg-[#ffb77c] text-[#4d2700]' :
    percentage >= 50  ? 'bg-[#e2c54a] text-[#393000]' :
                        'bg-[#a8c7fa] text-[#062e6f]';

  const statusBg =
    status.type === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-300' :
    status.type === 'warning' ? 'bg-orange-500/10 border-orange-500/30 text-orange-300' :
    status.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                                'bg-white/5 border-white/10 text-slate-300';

  return (
    <div className="glass-card rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${barColor}`}>
            <Zap className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#e2e2e5] truncate">{title}</h2>
            <p className="text-xs text-[#c4c6d0]">Limit: {DAILY_CAFFEINE_LIMIT} mg</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl sm:text-3xl font-bold text-[#e2e2e5]">{currentCaffeine}</span>
          <span className="text-base sm:text-lg text-[#8e9099] ml-1">mg</span>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-3 sm:h-4 bg-[#2c2f38] rounded-full overflow-hidden mb-3">
        <div
          className={`absolute inset-y-0 left-0 ${barColor.split(' ')[0]} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-slate-600 mb-4">
        <span>0 mg</span>
        <span className="font-semibold text-slate-400">{Math.round(percentage)}%</span>
        <span>{DAILY_CAFFEINE_LIMIT} mg</span>
      </div>

      {/* Status Msg */}
      <div className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border ${statusBg}`}>
        <p className="text-xs sm:text-sm font-medium text-center">{statusText}</p>
      </div>
    </div>
  );
};

export default ProgressBar;


