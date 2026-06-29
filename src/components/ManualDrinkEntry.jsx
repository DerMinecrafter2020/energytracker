import React, { useEffect, useState } from 'react';
import { CalendarDays, Coffee, Droplets, Plus, Save, Zap } from 'lucide-react';

const presets = [
  { name: 'Kaffee', size: 250, caffeine: 100, icon: '☕' },
  { name: 'Red Bull', size: 250, caffeine: 80, icon: '🥤' },
  { name: 'Monster', size: 500, caffeine: 160, icon: '⚡' },
];

const emptyForm = (selectedDate) => ({
  name: '',
  size: 250,
  caffeine: 80,
  icon: '🥤',
  date: selectedDate,
});

const Field = ({ label, icon: Icon, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</span>
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
      {children}
    </div>
  </label>
);

const ManualDrinkEntry = ({ selectedDate, onAddDrink, isLoading = false }) => {
  const [form, setForm] = useState(() => emptyForm(selectedDate));
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setForm((prev) => ({ ...prev, date: selectedDate }));
  }, [selectedDate]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const applyPreset = (drink) => {
    setForm((prev) => ({ ...prev, ...drink, date: prev.date || selectedDate }));
    setMessage(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    const payload = {
      name: form.name.trim(),
      size: Number(form.size) || 0,
      caffeine: Number(form.caffeine) || 0,
      icon: form.icon.trim() || '🥤',
      date: form.date || selectedDate,
    };

    if (!payload.name || payload.size <= 0 || payload.caffeine <= 0) {
      setMessage({ type: 'error', text: 'Name, Menge und Koffein müssen ausgefüllt sein.' });
      return;
    }

    try {
      await onAddDrink(payload);
      setForm(emptyForm(payload.date));
      setMessage({ type: 'success', text: `${payload.name} wurde hinzugefügt.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Eintrag konnte nicht gespeichert werden.' });
    }
  };

  return (
    <section className="glass-card rounded-2xl sm:rounded-[1.75rem] border border-white/10 overflow-hidden shadow-glass">
      <div className="px-4 sm:px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white truncate">Manuell hinzufügen</h2>
            <p className="text-xs text-slate-500 truncate">{form.date || selectedDate}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {presets.map((drink) => (
            <button
              key={drink.name}
              type="button"
              onClick={() => applyPreset(drink)}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <span>{drink.icon}</span>
              <span>{drink.name}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr] gap-3">
          <Field label="Getränk" icon={Coffee}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="input-dark pl-10"
              placeholder="z.B. Kaffee"
            />
          </Field>
          <Field label="Datum" icon={CalendarDays}>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className="input-dark pl-10"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Icon">
            <input
              type="text"
              value={form.icon}
              onChange={(e) => update('icon', e.target.value)}
              className="input-dark text-center"
              maxLength={2}
            />
          </Field>
          <Field label="ml" icon={Droplets}>
            <input
              type="number"
              min="1"
              value={form.size}
              onChange={(e) => update('size', e.target.value)}
              className="input-dark pl-10"
            />
          </Field>
          <Field label="mg" icon={Zap}>
            <input
              type="number"
              min="1"
              value={form.caffeine}
              onChange={(e) => update('caffeine', e.target.value)}
              className="input-dark pl-10"
            />
          </Field>
        </div>

        {message && (
          <div className={`rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>
      </form>
    </section>
  );
};

export default ManualDrinkEntry;
