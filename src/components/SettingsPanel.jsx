import React, { useState, useEffect } from 'react';
import { Settings, Zap, Clock, AlertCircle, Shield, KeyRound, Trash2 } from 'lucide-react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import {
  fetchUserSettings,
  updateUserSettings,
  fetchSecurityStatus,
  setupTotp,
  enableTotp,
  disableTotp,
  fetchPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  removePasskey,
} from '../services/api';

export default function SettingsPanel({ session, isLoading, onSettingsChange }) {
  const [settings, setSettings] = useState(null);
  const [localLimit, setLocalLimit] = useState('400');
  const [notifyAtLimit, setNotifyAtLimit] = useState(true);
  const [notifyLate, setNotifyLate] = useState(true);
  const [notifyRapid, setNotifyRapid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [security, setSecurity] = useState({ totpEnabled: false, passkeys: [] });
  const [totpPassword, setTotpPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpDisablePassword, setTotpDisablePassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(false);

  useEffect(() => {
    try {
      setWebauthnSupported(browserSupportsWebAuthn());
    } catch {
      setWebauthnSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.email) return;

    const loadSettings = async () => {
      try {
        const userPayload = {
          userId: session.userId || null,
          email: session.email,
        };
        const data = await fetchUserSettings(userPayload);
        setSettings(data);
        setLocalLimit(String(data.dailyLimit || 400));
        setNotifyAtLimit(data.notifyAtLimit !== false);
        setNotifyLate(data.notifyLate !== false);
        setNotifyRapid(data.notifyRapid !== false);

        const sec = await fetchSecurityStatus(userPayload);
        setSecurity(sec);
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

  const handleStartTotpSetup = async () => {
    if (!totpPassword.trim()) {
      setSecurityMessage('Bitte Passwort eingeben.');
      return;
    }
    setSecurityLoading(true);
    setSecurityMessage('');
    try {
      const data = await setupTotp({
        userId: session.userId || null,
        email: session.email,
        password: totpPassword,
      });
      setTotpSecret(data.secret);
      setTotpUri(data.otpauthUrl);
      setSecurityMessage('TOTP vorbereitet. Code aus Authenticator-App eingeben.');
    } catch (err) {
      setSecurityMessage(err.message);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleEnableTotp = async () => {
    if (!totpCode.trim()) {
      setSecurityMessage('Bitte den 2FA Code eingeben.');
      return;
    }
    setSecurityLoading(true);
    setSecurityMessage('');
    try {
      const data = await enableTotp({
        userId: session.userId || null,
        email: session.email,
        code: totpCode,
      });
      setSecurity(data.security);
      setTotpPassword('');
      setTotpSecret('');
      setTotpUri('');
      setTotpCode('');
      setSecurityMessage('2FA erfolgreich aktiviert.');
    } catch (err) {
      setSecurityMessage(err.message);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!totpDisablePassword.trim()) {
      setSecurityMessage('Bitte Passwort eingeben, um 2FA zu deaktivieren.');
      return;
    }
    setSecurityLoading(true);
    setSecurityMessage('');
    try {
      const data = await disableTotp({
        userId: session.userId || null,
        email: session.email,
        password: totpDisablePassword,
      });
      setSecurity(data.security);
      setTotpDisablePassword('');
      setSecurityMessage('2FA deaktiviert.');
    } catch (err) {
      setSecurityMessage(err.message);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!webauthnSupported) {
      setSecurityMessage('WebAuthn wird von diesem Browser nicht unterstützt. Nutze bitte TOTP oder einen aktuellen Browser.');
      return;
    }

    setSecurityLoading(true);
    setSecurityMessage('');
    try {
      const reg = await fetchPasskeyRegistrationOptions({
        userId: session.userId || null,
        email: session.email,
      });

      const attestation = await startRegistration({ optionsJSON: reg.options });
      const label = `YubiKey ${new Date().toLocaleDateString('de-DE')}`;
      const verified = await verifyPasskeyRegistration({
        userId: session.userId || null,
        email: session.email,
        challengeToken: reg.challengeToken,
        response: attestation,
        name: label,
      });

      setSecurity(verified.security);
      setSecurityMessage('Sicherheitsschlüssel erfolgreich registriert.');
    } catch (err) {
      setSecurityMessage(err.message || 'Passkey-Registrierung fehlgeschlagen.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleRemovePasskey = async (credentialId) => {
    setSecurityLoading(true);
    setSecurityMessage('');
    try {
      const data = await removePasskey({
        userId: session.userId || null,
        email: session.email,
        credentialId,
      });
      setSecurity(data.security);
      setSecurityMessage('Sicherheitsschlüssel entfernt.');
    } catch (err) {
      setSecurityMessage(err.message);
    } finally {
      setSecurityLoading(false);
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

        <div className="border-t border-white/10 pt-5 space-y-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Sicherheit (2FA)
          </h4>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white font-medium">Authenticator App (TOTP)</p>
              <span className={`text-xs px-2.5 py-1 rounded-full ${security.totpEnabled ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-700/50 text-slate-300 border border-white/10'}`}>
                {security.totpEnabled ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>

            {!security.totpEnabled ? (
              <>
                <input
                  type="password"
                  value={totpPassword}
                  onChange={(e) => setTotpPassword(e.target.value)}
                  className="input-dark"
                  placeholder="Passwort zur Bestätigung"
                />
                <button
                  onClick={handleStartTotpSetup}
                  disabled={securityLoading}
                  className="w-full px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50"
                >
                  TOTP Setup starten
                </button>

                {totpSecret && (
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 space-y-2">
                    <p className="text-xs text-cyan-200">Secret: <span className="font-mono text-cyan-100">{totpSecret}</span></p>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                      alt="TOTP QR Code"
                      className="w-36 h-36 rounded-lg border border-white/10 bg-white p-1"
                    />
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\s+/g, ''))}
                      className="input-dark"
                      placeholder="Code aus App"
                    />
                    <button
                      onClick={handleEnableTotp}
                      disabled={securityLoading}
                      className="w-full px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold disabled:opacity-50"
                    >
                      2FA aktivieren
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  type="password"
                  value={totpDisablePassword}
                  onChange={(e) => setTotpDisablePassword(e.target.value)}
                  className="input-dark"
                  placeholder="Passwort für Deaktivierung"
                />
                <button
                  onClick={handleDisableTotp}
                  disabled={securityLoading}
                  className="w-full px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50"
                >
                  2FA deaktivieren
                </button>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white font-medium">Sicherheitsschlüssel (YubiKey / Passkey)</p>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-white/10">
                {Array.isArray(security.passkeys) ? security.passkeys.length : 0} hinterlegt
              </span>
            </div>

            {!webauthnSupported && (
              <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                Dieser Browser unterstützt WebAuthn/Sicherheitsschlüssel nicht.
              </div>
            )}

            <button
              onClick={handleRegisterPasskey}
              disabled={securityLoading || !webauthnSupported}
              className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" /> Sicherheitsschlüssel hinzufügen
            </button>

            {(security.passkeys || []).map((key) => (
              <div key={key.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-100 truncate">{key.name || 'Sicherheitsschlüssel'}</p>
                  <p className="text-xs text-slate-500 truncate">Hinzugefügt: {new Date(key.createdAt).toLocaleString('de-DE')}</p>
                </div>
                <button
                  onClick={() => handleRemovePasskey(key.id)}
                  disabled={securityLoading}
                  className="p-2 rounded-lg text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  title="Schlüssel entfernen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {!!securityMessage && (
            <div className="px-4 py-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-sm">
              {securityMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
