import React, { useEffect, useState } from 'react';
import { Bell, Mail, MessageCircle, Save } from 'lucide-react';
import { fetchReminderSettings, saveReminderSettings } from '../services/api';

const ReminderSettings = ({ session }) => {
  const [settings, setSettings] = useState({
    enabled: true,
    time: '18:00',
    mailEnabled: true,
    discordEnabled: false,
    discordWebhook: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!session?.email) {
        if (isMounted) setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setMessage(null);
      try {
        const data = await fetchReminderSettings({ userId: session?.id, email: session.email });
        if (!isMounted) return;
        setSettings({
          enabled: data.enabled !== false,
          time: data.time || '18:00',
          mailEnabled: data.mailEnabled !== false,
          discordEnabled: !!data.discordEnabled,
          discordWebhook: data.discordWebhook || '',
        });
      } catch (err) {
        if (!isMounted) return;
        setMessage({ type: 'error', text: err.message || 'Fehler beim Laden.' });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [session?.id, session?.email]);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await saveReminderSettings({
        userId: session?.id || null,
        email: session?.email,
        enabled: settings.enabled,
        time: settings.time,
        mailEnabled: settings.mailEnabled,
        discordEnabled: settings.discordEnabled,
        discordWebhook: settings.discordWebhook.trim(),
      });
      setMessage({ type: 'success', text: 'Erinnerungen gespeichert.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Speichern.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in">
      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-400" />
        Reminder
        <span className="text-xs font-normal text-slate-500">Daily Track Ping</span>
      </h3>

      {isLoading ? (
        <div className="h-24 shimmer rounded-2xl" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
            <div>
              <p className="text-sm font-semibold text-white">Erinnerungen aktiv</p>
              <p className="text-xs text-slate-500">Tägliche Erinnerung zum Tracken</p>
            </div>
            <button
              type="button"
              onClick={() => update('enabled', !settings.enabled)}
              className={`relative w-12 h-6 rounded-full transition-all duration-300
                ${settings.enabled ? 'bg-green-500' : 'bg-white/10'}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300
                  ${settings.enabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Uhrzeit
            </label>
            <input
              type="time"
              value={settings.time}
              onChange={(e) => update('time', e.target.value)}
              className="input-dark"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update('mailEnabled', !settings.mailEnabled)}
              className={`p-3 rounded-2xl border text-left transition-all
                ${settings.mailEnabled
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-slate-400'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-sm font-semibold">E-Mail</span>
              </div>
              <p className="text-xs opacity-80">Reminder per Mail senden</p>
            </button>

            <button
              type="button"
              onClick={() => update('discordEnabled', !settings.discordEnabled)}
              className={`p-3 rounded-2xl border text-left transition-all
                ${settings.discordEnabled
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-slate-400'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">Discord</span>
              </div>
              <p className="text-xs opacity-80">Reminder in deinen Discord-Channel</p>
            </button>
          </div>

          {settings.discordEnabled && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Discord Webhook URL
              </label>
              <input
                type="url"
                value={settings.discordWebhook}
                onChange={(e) => update('discordWebhook', e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="input-dark"
              />
            </div>
          )}

          {message && (
            <div
              className={`text-sm rounded-xl px-3 py-2 border ${
                message.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !settings.time}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500
              hover:from-amber-400 hover:to-orange-400 text-white font-semibold
              disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Speichern…' : 'Reminder speichern'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReminderSettings;
