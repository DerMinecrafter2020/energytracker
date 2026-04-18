import React, { useState, useEffect } from 'react';
import { fetchUserSettings, updateUserSettings } from '../services/api';

export default function SettingsPanel({ session, isLoading, onSettingsChange }) {
  const [settings, setSettings] = useState(null);
  const [localLimit, setLocalLimit] = useState('400');
  const [notifyAtLimit, setNotifyAtLimit] = useState(true);
  const [notifyLate, setNotifyLate] = useState(true);
  const [notifyRapid, setNotifyRapid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Load settings when session changes
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
      setMessage('✅ Einstellungen gespeichert!');
      setTimeout(() => setMessage(''), 3000);

      // Notify parent
      if (onSettingsChange) onSettingsChange(updatedSettings);
    } catch (err) {
      setMessage('❌ Fehler: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p>Laden...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">⚙️ Einstellungen</h2>

      {/* Daily Limit */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          📊 Tägliches Koffein-Limit (mg)
        </label>
        <input
          type="number"
          min="0"
          value={localLimit}
          onChange={(e) => setLocalLimit(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Standard: 400mg (WHO-Empfehlung)
        </p>
      </div>

      {/* Notifications */}
      <div className="mb-6 border-t pt-4">
        <h3 className="font-medium text-gray-700 mb-3">🔔 Benachrichtigungen</h3>

        <div className="space-y-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifyAtLimit}
              onChange={(e) => setNotifyAtLimit(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="ml-3 text-sm text-gray-700">
              ⚠️ Warnung beim Überschreiten des Limits
            </span>
          </label>

          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifyLate}
              onChange={(e) => setNotifyLate(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="ml-3 text-sm text-gray-700">
              🌙 Warnung bei spätem Koffein (nach 18:00)
            </span>
          </label>

          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifyRapid}
              onChange={(e) => setNotifyRapid(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="ml-3 text-sm text-gray-700">
              ⚡ Warnung bei schneller Folge (3+ in 2h)
            </span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-2">
        <button
          onClick={handleSaveSettings}
          disabled={saving || isLoading}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition"
        >
          {saving ? '💾 Speichern...' : '💾 Speichern'}
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
