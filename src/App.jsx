import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Header from './components/Header';
import ProgressBar from './components/ProgressBar';
import ReminderSettings from './components/ReminderSettings';
import AIAssistant from './components/AIAssistant';
import AIDailySummary from './components/AIDailySummary';
import DrinkHistory from './components/DrinkHistory';
import LoginPage from './components/LoginPage';
import { Zap, Loader2 } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import RegisterPage from './components/RegisterPage';
import SettingsPanel from './components/SettingsPanel';
import WarningAlert from './components/WarningAlert';
import {
  fetchTodayStats,
  fetchUserSettings,
  updateLog,
} from './services/api';
import { fetchTodayLogs, addLog, removeLog } from './services/storage';
import { getSession, logout, startImpersonation, stopImpersonation, getImpersonatorSession } from './services/auth';
import { fetchPublicSettings } from './services/adminApi';

const getTodayKey = () => new Date().toISOString().split('T')[0];
const VIEW_STATE_KEY = 'et:last-view-state';

const loadViewState = () => {
  try {
    const raw = localStorage.getItem(VIEW_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveViewState = (nextState) => {
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(nextState));
  } catch {
  }
};

function App() {
  const initialViewState = loadViewState();
  const [session, setSession]     = useState(() => getSession());
  const [publicSettings, setPublicSettings] = useState({ authMode: 'local', setupRequired: false });
  const [authView, setAuthView]   = useState(initialViewState.authView || 'login'); 
  const [adminView, setAdminView] = useState('admin'); 
  const [adminTab, setAdminTab]   = useState(initialViewState.adminTab || 'overview');

  const impersonator = getImpersonatorSession();

  const persistScrollY = useCallback((scrollY) => {
    const current = loadViewState();
    saveViewState({ ...current, userScrollY: Math.max(0, Math.round(Number(scrollY) || 0)) });
  }, []);

  useEffect(() => {
    const current = loadViewState();
    saveViewState({ ...current, authView, adminTab });
  }, [authView, adminTab]);

  useEffect(() => {
    let isMounted = true;
    fetchPublicSettings()
      .then((settings) => {
        if (isMounted) setPublicSettings(settings || { authMode: 'local', setupRequired: false });
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleImpersonate = (userData) => {
    const newSession = startImpersonation(userData);
    setSession(newSession);
    setAdminView('user');
  };

  const handleStopImpersonation = () => {
    const adminSession = stopImpersonation();
    setSession(adminSession);
    setAdminView('admin');
  };

  useEffect(() => {
    if (session?.role !== 'admin') setAdminView('admin');
  }, [session]);

  if (!session && authView === 'register') {
    return <RegisterPage onBack={() => setAuthView('login')} />;
  }
  if (!session) {
    return <LoginPage onLogin={(s) => { setSession(s); setAdminView('admin'); }} onShowRegister={() => setAuthView('register')} />;
  }

  if (session.role === 'admin' && adminView === 'admin') {
    return (
      <AdminPanel
        session={session}
        onLogout={() => setSession(null)}
        onShowUserPanel={() => setAdminView('user')}
        onImpersonate={handleImpersonate}
        initialActiveTab={adminTab}
        onActiveTabChange={setAdminTab}
      />
    );
  }

  return (
    <>
      {impersonator && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-3
          px-4 py-2 bg-amber-500 text-amber-950 text-sm font-medium shadow-lg">
          <span>
            👉 Du siehst die App als <strong>{session.name}</strong> ({session.email})
          </span>
          <button
            onClick={handleStopImpersonation}
            className="px-3 py-1 rounded-lg bg-amber-950/20 hover:bg-amber-950/30
              text-amber-950 font-semibold transition-all text-xs shrink-0">
            ← Zurück zum Admin-Panel
          </button>
        </div>
      )}
      <div style={impersonator ? { paddingTop: '2.5rem' } : undefined}>
        <TrackerApp
          session={session}
          onLogout={() => { logout(); setSession(null); }}
          onShowAdminPanel={session.role === 'admin' ? () => setAdminView('admin') : null}
          initialScrollY={Number(initialViewState.userScrollY) || 0}
          onPersistScrollY={persistScrollY}
        />
      </div>
    </>
  );
}

function TrackerApp({ session, onLogout, onShowAdminPanel, initialScrollY, onPersistScrollY }) {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [logs, setLogs]           = useState([]);
  const [error, setError]         = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [latestVersion, setLatestVersion]   = useState(null);
  const [todayStats, setTodayStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const isFirstCheck = useRef(true);

  const fetchAllData = useCallback(async () => {
    try {
      const today = getTodayKey();
      const [todayLogs, statsData, userSettings] = await Promise.all([
        fetchTodayLogs(today, { userId: session?.id, email: session?.email }),
        session?.email ? fetchTodayStats({ userId: session?.id || null, email: session?.email }) : Promise.resolve(null),
        session?.email ? fetchUserSettings({ userId: session?.id || null, email: session?.email }) : Promise.resolve(null),
      ]);
      setLogs(todayLogs);
      if (statsData) setTodayStats(statsData);
      if (userSettings) setSettings(userSettings);
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
      setError('Fehler beim Laden der Daten.');
    }
  }, [session?.id, session?.email]);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      await fetchAllData();
      if (isMounted) setIsAppLoading(false);
    };
    initialize();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchAllData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    const interval = setInterval(() => {
      if (session?.email) {
        fetchTodayStats({ userId: session?.id || null, email: session?.email })
          .then(stats => setTodayStats(stats))
          .catch(console.error);
      }
    }, 60000);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [fetchAllData, session?.id, session?.email]);

  useEffect(() => {
    if (typeof initialScrollY === 'number' && initialScrollY > 0) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: initialScrollY, behavior: 'auto' });
      });
    }
  }, [initialScrollY]);

  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.className = settings.theme === 'system' ? '' : `theme-${settings.theme}`;
    }
  }, [settings?.theme]);

  useEffect(() => {
    if (!onPersistScrollY) return undefined;
    let timeoutId = null;
    const onScroll = () => {
      if (timeoutId) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        onPersistScrollY(window.scrollY || 0);
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [onPersistScrollY]);

  useEffect(() => {
    let isMounted = true;
    const checkVersion = async () => {
      try {
        const response = await fetch('/api/version');
        if (!response.ok) return;
        const data = await response.json();
        if (!isMounted) return;
        const version = data.version || null;
        if (isFirstCheck.current) {
          setCurrentVersion(version);
          isFirstCheck.current = false;
        } else {
          setLatestVersion(version);
        }
      } catch {
        isFirstCheck.current = false;
      }
    };
    checkVersion();
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const totalCaffeineToday = useMemo(
    () => logs.reduce((sum, log) => sum + (log.caffeine || 0), 0),
    [logs]
  );

  
  
  const handleUpdateLog = async (logId, data) => {
    try {
      const updated = await updateLog(logId, data);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, ...updated } : l));
      if (session?.email) {
        const stats = await fetchTodayStats({
          userId: session?.id || null,
          email: session?.email,
        });
        setTodayStats(stats);
      }
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleDeleteLog = async (logId) => {
    try {
      await removeLog(logId);
      setLogs(prev => prev.filter(l => l.id !== logId));
      if (session?.email) {
        const stats = await fetchTodayStats({
          userId: session?.id || null,
          email: session?.email,
        });
        setTodayStats(stats);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleFavorite = async (log, isFavorite) => {
    try {
      if (isFavorite) {
        // Find favorite ID by log match (pseudo logic, adjust based on actual api)
        // If we don't have full favorites logic here, we just ignore or implement basic
      }
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleAddDrink = useCallback(async (drinkData) => {
    setIsOperationLoading(true);
    setError(null);
    try {
      const payload = { ...drinkData, date: getTodayKey(), userId: session?.id || null, email: session?.email || null };
      const created = await addLog(payload);
      setLogs((prev) => [created, ...prev]);

      if (session?.email) {
        const stats = await fetchTodayStats({
          userId: session?.id || null,
          email: session?.email,
        });
        setTodayStats(stats);
      }
    } catch (err) {
      setError('Fehler beim Hinzufügen. Bitte versuche es erneut.');
    } finally {
      setIsOperationLoading(false);
    }
  }, [session?.id, session?.email]);

  if (isAppLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#02040A] text-white">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-400 to-amber-400 shadow-glow-blue animate-glow-pulse mb-6 relative">
          <div className="absolute inset-0 bg-white/20 rounded-2xl animate-ping"></div>
          <Zap className="w-8 h-8 text-white relative z-10" fill="currentColor" />
        </div>
        <h1 className="text-2xl font-bold text-gradient mb-3 tracking-tight">Drink-Tracker</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Datenbank wird geladen...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen relative overflow-hidden bg-transparent">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[120px] animate-float-slow pointer-events-none -z-10"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-amber-500/15 rounded-full blur-[100px] animate-float-delayed pointer-events-none -z-10"></div>
      <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[60vw] bg-purple-600/15 rounded-full blur-[140px] animate-float pointer-events-none -z-10"></div>
      
      <Header
        isAuthenticated={true}
        isLoading={isOperationLoading}
        session={session}
        onLogout={onLogout}
        onShowAdminPanel={onShowAdminPanel}
        currentTab={showSettings ? 'settings' : 'home'}
        onGoHome={() => setShowSettings(false)}
        onShowSettings={() => setShowSettings(true)}
      />

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 pb-28">
        {latestVersion && latestVersion !== currentVersion && (
          <div className="glass-card border border-blue-500/30 bg-blue-500/10
            px-4 py-3 rounded-2xl mb-6 animate-fade-in">
            <p className="text-sm font-medium text-blue-300">Update verfügbar: {latestVersion}</p>
            <button onClick={() => window.location.reload()}
              className="text-xs underline mt-1 text-blue-400">
              Neu laden
            </button>
          </div>
        )}

        {error && (
          <div className="glass-card border border-red-500/30 bg-red-500/10
            px-4 py-3 rounded-2xl mb-6 animate-fade-in">
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-xs underline mt-1 text-red-400">
              Ausblenden
            </button>
          </div>
        )}

        {!showSettings && (
          <div className="space-y-6 animate-fade-in">
            <ProgressBar currentCaffeine={totalCaffeineToday} />
            
            {todayStats && settings && (
              <WarningAlert todayStats={todayStats} settings={settings} onClose={() => {}} />
            )}

            <AIDailySummary logs={logs} totalCaffeine={totalCaffeineToday} />
            <DrinkHistory logs={logs} onDeleteLog={handleDeleteLog} onToggleFavorite={handleToggleFavorite} isFavoriteLog={() => false} />
            <AIAssistant totalCaffeineToday={totalCaffeineToday} logs={logs} onAddDrink={handleAddDrink} onDeleteDrink={handleDeleteLog} onUpdateDrink={handleUpdateLog} />
            

          </div>
        )}

        {showSettings && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-card rounded-[2rem] p-6 shadow-glass">
              <h2 className="text-xl font-bold text-white mb-6">Einstellungen</h2>
              <SettingsPanel
                session={session}
                isLoading={isOperationLoading}
                onSettingsChange={(newSettings) => setSettings(newSettings)}
              />
            </div>
            <ReminderSettings session={session} />
          </div>
        )}
      </main>

      <footer className="text-center py-6 pb-32 text-slate-600 text-sm">
        <p>Drink-Tracker &copy; {new Date().getFullYear()}</p>
        <p className="text-xs mt-1 mb-2">Tagesziel: Hydration im Blick behalten</p>
        {(currentVersion || latestVersion) && (
          <p className="text-[10px] text-slate-500 opacity-60 font-mono tracking-wider">
            Version {latestVersion || currentVersion}
          </p>
        )}
      </footer>

      
      </div>
    </>
  );
}

export default App;
