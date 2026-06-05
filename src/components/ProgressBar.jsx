import React from 'react';
import { Zap } from 'lucide-react';
import {
  calculateProgress,
  getProgressColor,
  getStatusMessage,
  DAILY_CAFFEINE_LIMIT,
} from '../utils/caffeineUtils';

const ProgressBar = ({ currentCaffeine }) => {
  const percentage    = calculateProgress(currentCaffeine);
  const status        = getStatusMessage(currentCaffeine);

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
    <div className="glass-card rounded-[2rem] p-6 mb-6 animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${barColor}`}>
            <Zap className="w-6 h-6" fill="currentColor" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#e2e2e5]">Koffein heute</h2>
            <p className="text-xs text-[#c4c6d0]">Limit: {DAILY_CAFFEINE_LIMIT} mg</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-[#e2e2e5]">{currentCaffeine}</span>
          <span className="text-lg text-[#8e9099] ml-1">mg</span>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-4 bg-[#2c2f38] rounded-full overflow-hidden mb-3">
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
      <div className={`px-4 py-3 rounded-2xl border ${statusBg}`}>
        <p className="text-sm font-medium text-center">{status.text}</p>
      </div>
    </div>
  );
};

export default ProgressBar;
