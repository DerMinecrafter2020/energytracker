import React, { useState, useEffect } from 'react';
import { Settings, Zap, Clock, AlertCircle } from 'lucide-react';
import { fetchUserSettings, updateUserSettings } from '../services/api';

export default function SettingsPanel({ session, isLoading, onSettingsChange }) {
  const [settings, setSettings] = useState(null);
  const [localLimit, setLocalLimit] = useState('400');
  const [notifyAtLimit, setNotifyAtLimit] = useState(true);
  const [notifyLate, setNotifyLate] = useState(true);
  const [notifyRapid, setNotifyRapid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session?.email) return;

    const loadSettings = async () => {
      try {
        const data = await fetchUserSettings({
          userId: session.userId || null,
          email: session.email,
        });
        setSettings(data);
        setLocalLimit(String(data.dailyLimit || 400));
        setNotifyAtLimit(data.notifyAtLimit !== false);
        setNotifyLate(data.notifyLate !== false);
        setNotifyRapid(data.notifyRapid !== false);
      } catch (err) {
        console.error('Fehler beim Laden der Einstellungen:', err);
      }
    };

    loadSettings();
  }, [session]);

  const handleSaveSettings = async () => {
    if (!session?.email) return;
    setSaving(true);
    setMessage('');

    try {
      const dailyLimit = Math.max(0, Math.round(Number(localLimit) || 400));
      const updatedSettings = await updateUserSettings({
        userId: session.userId || null,
        email: session.email,
        dailyLimit,
        notifyAtLimit,
        notifyLate,
        notifyRapid,
      });

      setSettings(updatedSettings);
      setMessage('saved');
      setTimeout(() => setMessage(''), 3000);

      if (onSettingsChange) onSettingsChange(updatedSettings);
    } catch (err) {
      setMessage('error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="glass-card rounded-3xl p-6 animate-fade-in">
        <div className="flex items-center justify-center py-8">
          <p className="text-slate-400">Lädt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-6 animate-fade-in">
      <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
        <Settings className="w-5 h-5 text-purple-400" />
        Einstellungen
      </h3>

      <div className="space-y-5">
        {/* Daily Limit */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Tägliches Koffein-Limit
          </label>
          <div className="relative">
            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
            <input
              type="number"
              min="0"
              value={localLimit}
              onChange={(e) => setLocalLimit(e.target.value)}
              className="input-dark pl-10"
              placeholder="400"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">
              mg
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            WHO-Empfehlung: 400mg pro Tag
          </p>
        </div>

        {/* Notifications */}
        <div className="border-t border-white/10 pt-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Benachrichtigungen
          </h4>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifyAtLimit}
                onChange={(e) => setNotifyAtLimit(e.target.checked)}
                className="w-4 h-4 rounded border border-white/20 bg-white/5 
                  checked:bg-red-500 checked:border-red-400 mt-1 cursor-pointer
                  transition-all duration-200"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-red-300 transition-colors">
                  Limit überschritten
                </p>
                <p className="text-xs text-slate-500">
                  Warnung wenn Koffein Limit erreicht wird
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifyLate}
                onChange={(e) => setNotifyLate(e.target.checked)}
                className="w-4 h-4 rounded border border-white/20 bg-white/5 
                  checked:bg-blue-500 checked:border-blue-400 mt-1 cursor-pointer
                  transition-all duration-200"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                  Spätes Koffein
                </p>
                <p className="text-xs text-slate-500">
                  Warnung nach 18:00 Uhr
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifyRapid}
                onChange={(e) => setNotifyRapid(e.target.checked)}
                className="w-4 h-4 rounded border border-white/20 bg-white/5 
                  checked:bg-amber-500 checked:border-amber-400 mt-1 cursor-pointer
                  transition-all duration-200"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors">
                  Schnelle Folge
                </p>
                <p className="text-xs text-slate-500">
                  Warnung bei 3+ Getränken in 2h
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          disabled={saving || isLoading}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-500
            text-white font-semibold rounded-2xl
            hover:from-purple-500 hover:to-purple-400 disabled:opacity-50
            transition-all duration-200 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Speichern...
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              Speichern
            </>
          )}
        </button>

        {message === 'saved' && (
          <div className="px-4 py-2.5 rounded-2xl bg-green-500/10 border border-green-500/30
            text-green-300 text-sm font-medium text-center animate-fade-in">
            ✓ Einstellungen gespeichert
          </div>
        )}
        {message === 'error' && (
          <div className="px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30
            text-red-300 text-sm font-medium text-center animate-fade-in">
            × Fehler beim Speichern
          </div>
        )}
      </div>
    </div>
  );
}
