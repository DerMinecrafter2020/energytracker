import React from 'react';

export default function DrinkHistoryChart({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-6 mb-6">
        <h3 className="text-white font-bold mb-4">Tagesverlauf</h3>
        <p className="text-slate-400 text-sm">Noch keine Getränke heute eingetragen.</p>
      </div>
    );
  }

  // Sort logs by time
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const maxCaffeine = Math.max(...sortedLogs.map(l => l.caffeine || 0), 100);

  return (
    <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in">
      <h3 className="text-white font-bold mb-6">Tagesverlauf</h3>
      <div className="flex items-end gap-2 h-40 overflow-x-auto pb-2 custom-scrollbar">
        {sortedLogs.map((log) => {
          const heightPercent = Math.max(5, Math.min(100, ((log.caffeine || 0) / maxCaffeine) * 100));
          const time = new Date(log.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={log.id} className="flex flex-col items-center gap-2 min-w-[3.5rem] group relative">
              {/* Tooltip */}
              <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap pointer-events-none z-10 shadow-lg border border-white/10">
                <span className="block font-bold">{log.name}</span>
                <span className="text-slate-300">{log.caffeine}mg</span>
              </div>
              {/* Bar */}
              <div className="w-10 bg-white/5 hover:bg-white/10 rounded-t-xl relative flex flex-col justify-end overflow-hidden transition-colors border-b border-white/10" style={{ height: '100px' }}>
                <div 
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-xl transition-all shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              {/* Time */}
              <span className="text-[10px] text-slate-400 font-medium">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
