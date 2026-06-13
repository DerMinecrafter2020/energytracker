import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { fetchDailySummary } from '../services/aiApi';

const weekdayLabels = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const parseDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getLogTime = (log) => {
  const value = log?.createdAt || log?.timestamp;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const CalendarSuggestions = ({ selectedDate, logs = [], totalCaffeine = 0, dailyLimit = 400, insights }) => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const suggestions = useMemo(() => {
    const items = [];
    const total = Number(totalCaffeine) || 0;
    const limit = Number(dailyLimit) || 400;
    const selected = parseDateKey(selectedDate);
    const weekday = weekdayLabels[selected.getDay()];
    const lateLogs = logs.filter((log) => {
      const time = getLogTime(log);
      return time && time.getHours() >= 18;
    });

    if (total > limit) {
      items.push(`Dieser Tag liegt ${total - limit} mg ueber deinem Limit. Eine kurze Analyse koennte helfen.`);
    } else if (logs.length > 0) {
      items.push(`Dieser Tag liegt bei ${total} mg von ${limit} mg und bleibt im Rahmen.`);
    } else {
      items.push('An diesem Tag sind noch keine Eintraege vorhanden.');
    }

    if (lateLogs.length > 0) {
      items.push(`${lateLogs.length} Eintrag liegt nach 18:00 Uhr. Das passt zur Schlafzeit-Warnung.`);
    }

    if (insights?.topWeekday?.label === weekday) {
      items.push(`${weekday} ist bei dir oft ein staerkerer Koffein-Tag. Aehnliche Tage im Blick behalten.`);
    }

    return items.slice(0, 3);
  }, [dailyLimit, insights, logs, selectedDate, totalCaffeine]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const data = await fetchDailySummary({
        logs,
        totalCaffeine,
        dailyLimit,
        selectedDate,
      });
      setSummary(data.summary || '');
    } catch (err) {
      setError('KI-Analyse konnte nicht geladen werden. Die lokalen Hinweise bleiben verfuegbar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-fuchsia-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">KI-Hinweise zum Kalender</h2>
            <p className="text-xs text-slate-500 truncate">{selectedDate}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading || logs.length === 0}
          className="rounded-xl bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-200 px-3 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Analysieren
        </button>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div key={suggestion} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300">
            {suggestion}
          </div>
        ))}
      </div>

      {summary && (
        <div className="mt-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 px-4 py-3 text-sm text-fuchsia-100 whitespace-pre-wrap">
          {summary}
        </div>
      )}
      {error && <p className="text-xs text-amber-300 mt-3">{error}</p>}
    </div>
  );
};

export default CalendarSuggestions;
