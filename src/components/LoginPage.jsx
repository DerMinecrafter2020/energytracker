import React, { useState, useEffect } from 'react';
import { Zap, Mail, Lock, Eye, EyeOff, LogIn, ShieldCheck, CheckCircle, AlertCircle, Clock, KeyRound, Shield } from 'lucide-react';
import {
  isWebAuthnSupported,
  login,
  completeLoginWithTotp,
  completeLoginWithPasskey,

} from '../services/auth';
import { fetchPublicSettings } from '../services/adminApi';

const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const alertStyles = {
  success: 'bg-green-500/10 border-green-500/30 text-green-300',
  warning: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
};
const alertIcons = { success: CheckCircle, warning: Clock, error: AlertCircle };

const Spinner = ({ className = 'w-5 h-5 border-2 border-white/30 border-t-white' }) =>
  <span className={`${className} rounded-full animate-spin`} />;

const AlertBox = ({ type = 'error', children }) => {
  const Icon = alertIcons[type] || AlertCircle;
  return (
    <div className={`mb-6 px-4 py-3 rounded-xl border flex gap-3 text-sm animate-fade-in ${alertStyles[type]}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
};

const ErrorMessage = ({ children }) => (
  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm animate-slide-in">
    {children}
  </div>
);

const AuthField = ({ label, icon: Icon, passwordToggle, showPassword, onTogglePassword, inputClass = '', ...props }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input {...props} className={`input-dark pl-12 ${passwordToggle ? 'pr-12' : ''} ${inputClass}`} />
      {passwordToggle && (
        <button type="button" onClick={onTogglePassword} tabIndex={-1}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  </div>
);

const SubmitButton = ({ loading, children, className = '' }) => (
  <button type="submit" disabled={loading}
    className={`w-full py-3.5 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 mt-2 ${className}`}>
    {loading ? <Spinner /> : children}
  </button>
);

const authRequest = async (path, body, fallback) => {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || fallback);
  return data;
};

const LoginPage = ({ onLogin, onShowRegister }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedBanner, setVerifiedBanner] = useState(null);
  const [publicSettings, setPublicSettings] = useState({ demoEnabled: true, registrationEnabled: true });
  const [pending2FA, setPending2FA] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  const [view, setView] = useState('login');
  const [resetToken, setResetToken] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setWebauthnSupported(isWebAuthnSupported());
  }, []);

  useEffect(() => {
    fetchPublicSettings().then((s) => setPublicSettings(s)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rToken = params.get('resetToken');
    if (rToken) {
      setResetToken(rToken);
      setView('reset');
    }
    const v = params.get('verified');
    if (v === '1') setVerifiedBanner({ type: 'success', text: 'E-Mail erfolgreich besttigt! Du kannst dich jetzt anmelden.' });
    else if (v === 'expired') setVerifiedBanner({ type: 'warning', text: 'Der Besttigungslink ist abgelaufen. Bitte registriere dich erneut.' });
    else if (v === 'invalid') setVerifiedBanner({ type: 'error', text: 'Ungltiger Besttigungslink.' });
    if (v) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email) return setError('Bitte gib deine E-Mail ein.');
    setIsLoading(true); setError(''); setMsg(null);
    try {
      await authRequest('/api/auth/forgot-password', { email }, 'Fehler beim Senden.');
      setMsg({ type: 'success', text: 'Falls ein Konto existiert, wurde eine E-Mail mit dem Reset-Link gesendet.' });
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError('Passwort muss mindestens 8 Zeichen lang sein.');
    setIsLoading(true); setError(''); setMsg(null);
    try {
      await authRequest('/api/auth/reset-password', { token: resetToken, newPassword: password }, 'Fehler beim Zurcksetzen.');
      setMsg({ type: 'success', text: 'Dein Passwort wurde erfolgreich gendert. Du kannst dich jetzt anmelden.' });
      setView('login'); setPassword('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Bitte alle Felder ausfllen.'); return; }
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result?.requiresSecondFactor) {
        setPending2FA(result);
      } else {
        onLogin(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runLoginStep = async (action) => {
    setIsLoading(true);
    setError('');
    try {
      onLogin(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpVerify = async () => {
    if (!pending2FA?.loginToken) return;
    if (!totpCode.trim()) return setError('Bitte gib deinen 2FA-Code ein.');
    runLoginStep(() => completeLoginWithTotp({ loginToken: pending2FA.loginToken, code: totpCode }));
  };

  const handlePasskeyVerify = async () => {
    if (!pending2FA?.loginToken) return;
    runLoginStep(() => completeLoginWithPasskey({ loginToken: pending2FA.loginToken }));
  };

  const fillDemo = (role) => {
    if (role === 'admin') {
      setEmail(import.meta.env.VITE_ADMIN_EMAIL || 'admin@energytracker.de');
    } else {
      setEmail(import.meta.env.VITE_USER_EMAIL || 'user@energytracker.de');
    }
    setPassword('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-transparent">
      {/* Animated Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[120px] animate-float-slow pointer-events-none -z-10"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-600/15 rounded-full blur-[140px] animate-float pointer-events-none -z-10"></div>

      <div className="glass-card rounded-[2.5rem] w-full max-w-4xl relative overflow-hidden shadow-glass animate-slide-in flex flex-col md:flex-row">
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center items-center text-center bg-white/5 border-b md:border-b-0 md:border-r border-white/10">
          <div className="w-20 h-20 rounded-3xl mx-auto bg-[#0842a0] flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-white" fill="currentColor" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Koffein-Tracker</h1>
          <p className="text-slate-400 mt-4 max-w-xs leading-relaxed">
            Behalte deinen Energielevel im Blick, optimiere deinen Schlaf und erreiche mehr.
          </p>
        </div>
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-bold text-white">Willkommen zurück</h2>
            <p className="text-slate-400 text-sm mt-1">Bitte melde dich an, um fortzufahren.</p>
          </div>

        {verifiedBanner && <AlertBox type={verifiedBanner.type}>{verifiedBanner.text}</AlertBox>}

        {msg && <AlertBox type={msg.type || 'success'}>{msg.text}</AlertBox>}

        {view === 'forgot' ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <AuthField label="E-Mail" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <SubmitButton loading={isLoading} className="rounded-full font-bold text-[#062e6f] bg-[#a8c7fa] hover:bg-[#d3e3fd]">
              Passwort zurücksetzen
            </SubmitButton>
            <div className="text-center mt-4">
              <button type="button" onClick={() => { setView('login'); setError(''); setMsg(null); }} className="text-sm text-slate-400 hover:text-white transition-colors">
                Zurück zur Anmeldung
              </button>
            </div>
          </form>
        ) : view === 'reset' ? (
          <form onSubmit={handleReset} className="space-y-4">
            <AuthField label="Neues Passwort" icon={Lock} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mind. 8 Zeichen" passwordToggle showPassword={showPw} onTogglePassword={() => setShowPw(v => !v)} />
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <SubmitButton loading={isLoading} className="rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-glow-blue">
              Passwort speichern
            </SubmitButton>
          </form>
        ) : !pending2FA ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthField label="E-Mail" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />

            <div>
              <AuthField label="Passwort / App-Token" icon={Lock} type={showPw ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                passwordToggle showPassword={showPw} onTogglePassword={() => setShowPw(v => !v)} />
              <div className="text-right mt-1">
                <button type="button" onClick={() => { setView('forgot'); setError(''); setMsg(null); }} tabIndex={-1} className="text-xs text-slate-400 hover:text-blue-400 transition-colors">
                  Passwort vergessen?
                </button>
              </div>
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <SubmitButton loading={isLoading} className="rounded-full font-bold text-[#062e6f] bg-[#a8c7fa] hover:bg-[#d3e3fd]">
              <><LogIn className="w-4 h-4" />Einloggen</>
            </SubmitButton>
          </form>
          ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
              <p className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" />Zweiter Faktor erforderlich</p>
              <p className="text-violet-300/90 mt-1">Fr {pending2FA.user?.email} muss die Anmeldung besttigt werden.</p>
            </div>

            {pending2FA.methods?.totp && (
              <div>
                <AuthField label="2FA Code" icon={KeyRound} type="text" value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\s+/g, ''))}
                  placeholder="123456" maxLength={8} />
                <button
                  type="button"
                  onClick={handleTotpVerify}
                  disabled={isLoading}
                  className="w-full mt-3 py-3 rounded-xl font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Code prfen
                </button>
              </div>
            )}

            {pending2FA.methods?.passkey && (
              <>
              {!webauthnSupported && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  Passkey-Login wird von diesem Browser nicht untersttzt. Nutze den 2FA-Code.
                </div>
              )}
              <button
                type="button"
                onClick={handlePasskeyVerify}
                disabled={isLoading || !webauthnSupported}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200
                  bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500
                  disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" /> Mit Sicherheitsschlssel anmelden
              </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setPending2FA(null);
                setTotpCode('');
                setPassword('');
              }}
              className="w-full py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              Zurck zur normalen Anmeldung
            </button>
          </div>
          )}

          {view === 'login' && !pending2FA && ( 
            <>
            {/* Register link */}
          {publicSettings.registrationEnabled && (
          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <p className="text-sm text-slate-500">
              {'Noch keinen Account?'} 
              <button onClick={onShowRegister}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                {'Hier registrieren'}
              </button>
            </p>
          </div>
          )}

          {/* Demo fill */}
          {publicSettings.demoEnabled && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-slate-600 text-center mb-3">{'Demo Login'}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => fillDemo('admin')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl
                  bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium
                  hover:bg-amber-500/20 transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" />Admin
              </button>
              <button type="button" onClick={() => fillDemo('user')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl
                  bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium
                  hover:bg-blue-500/20 transition-colors">
                <Zap className="w-3.5 h-3.5" />Benutzer
              </button>
            </div>
          </div>
          )}
          </>
          )}
          <p className="text-center text-xs text-slate-600 mt-8">
          Koffein-Tracker &copy; {new Date().getFullYear()}
        </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;












