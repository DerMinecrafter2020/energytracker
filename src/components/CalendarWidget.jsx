import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { fetchLogs } from '../services/api';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const toDateKey = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const parseDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  return new Date(year, month - 1, day || 1);
};

const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const formatDate = (dateKey, options = {}) => {
  if (!isDateKey(dateKey)) return '';
  return parseDateKey(dateKey).toLocaleDateString('de-DE', options);
};

const getMonthLabel = (date) =>
  date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

const buildCalendarDays = (viewDate) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index);
    return {
      date,
      key: toDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    };
  });
};

const createDraft = (log) => ({
  name: log?.name || '',
  size: String(log?.size || ''),
  caffeine: String(log?.caffeine || ''),
  icon: log?.icon || '',
});

const CalendarWidget = ({
  selectedDate,
  logs = [],
  userIdentity,
  onSelectDate,
  onUpdateLog,
  onDeleteLog,
  refreshKey = 0,
  isLoading = false,
}) => {
  const [viewDate, setViewDate] = useState(() => parseDateKey(selectedDate));
  const [monthLogs, setMonthLogs] = useState({});
  const [monthLoading, setMonthLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(createDraft());
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const next = parseDateKey(selectedDate);
    setViewDate((current) =>
      current.getFullYear() === next.getFullYear() && current.getMonth() === next.getMonth()
        ? current
        : new Date(next.getFullYear(), next.getMonth(), 1)
    );
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    const loadMonth = async () => {
      setMonthLoading(true);
      const days = buildCalendarDays(viewDate).filter((day) => day.isCurrentMonth);

      try {
        const entries = await Promise.all(
          days.map(async (day) => [day.key, await fetchLogs(day.key, userIdentity)])
        );
        if (!cancelled) setMonthLogs(Object.fromEntries(entries));
      } catch (err) {
        console.error('Fehler beim Laden der Kalenderdaten:', err);
      } finally {
        if (!cancelled) setMonthLoading(false);
      }
    };

    loadMonth();
    return () => {
      cancelled = true;
    };
  }, [viewDate, userIdentity, refreshKey]);

  useEffect(() => {
    setMonthLogs((prev) => ({ ...prev, [selectedDate]: logs }));
  }, [logs, selectedDate]);

  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const selectedTotal = logs.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);

  const moveMonth = (offset) => {
    setEditingId(null);
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const startEdit = (log) => {
    setEditingId(log.id);
    setDraft(createDraft(log));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(createDraft());
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editingId || !onUpdateLog) return;

    setSavingId(editingId);
    try {
      await onUpdateLog(editingId, {
        name: draft.name.trim() || 'Getränk',
        size: Number(draft.size) || 0,
        caffeine: Number(draft.caffeine) || 0,
        icon: draft.icon.trim() || '🥤',
      });
      cancelEdit();
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (log) => {
    if (!onDeleteLog) return;
    setSavingId(log.id);
    try {
      await onDeleteLog(log.id);
      if (String(editingId) === String(log.id)) cancelEdit();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in shadow-glass">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-blue-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Kalender</h2>
            <p className="text-xs text-slate-500 truncate">{getMonthLabel(viewDate)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {monthLoading && <Loader2 className="w-4 h-4 text-blue-300 animate-spin" />}
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-300 transition-colors"
            aria-label="Vorheriger Monat"
            title="Vorheriger Monat"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-300 transition-colors"
            aria-label="Nächster Monat"
            title="Nächster Monat"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-500 mb-2">
        {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dayLogs = monthLogs[day.key] || [];
          const count = dayLogs.length;
          const total = dayLogs.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);
          const selected = day.key === selectedDate;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => {
                cancelEdit();
                onSelectDate(day.key);
              }}
              className={`aspect-square min-h-[58px] rounded-xl border p-1.5 text-left transition-all
                ${selected
                  ? 'bg-blue-500/20 border-blue-400/60 shadow-[0_0_0_1px_rgba(96,165,250,0.25)]'
                  : 'bg-[#252830] border-white/5 hover:bg-[#2c2f38] hover:border-white/10'}
                ${day.isCurrentMonth ? 'opacity-100' : 'opacity-35'}`}
              aria-label={formatDate(day.key, { weekday: 'long', day: '2-digit', month: 'long' })}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`text-xs font-bold ${selected ? 'text-blue-200' : 'text-slate-300'}`}>{day.day}</span>
                {count > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-blue-400/15 text-blue-200 text-[10px] font-bold flex items-center justify-center">
                    {count}
                  </span>
                )}
              </div>
              {total > 0 && (
                <div className="mt-2 text-[10px] leading-tight text-slate-400 truncate">{total} mg</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 pt-5 border-t border-white/10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">
              {formatDate(selectedDate, { weekday: 'long', day: '2-digit', month: 'long' })}
            </h3>
            <p className="text-xs text-slate-500">{logs.length} Einträge • {selectedTotal} mg</p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-5 text-sm text-slate-500 text-center">
            Keine Einträge an diesem Tag.
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log) => {
              const editing = String(editingId) === String(log.id);
              const busy = String(savingId) === String(log.id) || isLoading;

              return (
                <div key={log.id} className="rounded-2xl bg-[#252830] border border-white/5 p-3">
                  {editing ? (
                    <form onSubmit={handleSave} className="space-y-3">
                      <div className="grid grid-cols-[56px_1fr] gap-2">
                        <input
                          value={draft.icon}
                          onChange={(event) => setDraft((prev) => ({ ...prev, icon: event.target.value }))}
                          className="w-full h-10 rounded-xl bg-black/20 border border-white/10 px-3 text-center text-white outline-none focus:border-blue-400/70"
                          aria-label="Icon"
                        />
                        <input
                          value={draft.name}
                          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                          className="w-full h-10 rounded-xl bg-black/20 border border-white/10 px-3 text-sm text-white outline-none focus:border-blue-400/70"
                          aria-label="Name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          value={draft.size}
                          onChange={(event) => setDraft((prev) => ({ ...prev, size: event.target.value }))}
                          className="w-full h-10 rounded-xl bg-black/20 border border-white/10 px-3 text-sm text-white outline-none focus:border-blue-400/70"
                          aria-label="Menge in Milliliter"
                        />
                        <input
                          type="number"
                          min="0"
                          value={draft.caffeine}
                          onChange={(event) => setDraft((prev) => ({ ...prev, caffeine: event.target.value }))}
                          className="w-full h-10 rounded-xl bg-black/20 border border-white/10 px-3 text-sm text-white outline-none focus:border-blue-400/70"
                          aria-label="Koffein in Milligramm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={busy}
                          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center disabled:opacity-50"
                          aria-label="Abbrechen"
                          title="Abbrechen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className="w-9 h-9 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 flex items-center justify-center disabled:opacity-50"
                          aria-label="Speichern"
                          title="Speichern"
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(log)}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left"
                        aria-label={`${log.name} bearbeiten`}
                      >
                        <span className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg shrink-0">
                          {log.icon || '🥤'}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white truncate">{log.name}</span>
                          <span className="block text-xs text-slate-500">ID {log.id} • {log.size} ml • {log.caffeine} mg</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(log)}
                        disabled={busy}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center disabled:opacity-50"
                        aria-label="Bearbeiten"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(log)}
                        disabled={busy}
                        className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center justify-center disabled:opacity-50"
                        aria-label="Löschen"
                        title="Löschen"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarWidget;
