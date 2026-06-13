import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Header from './components/Header';
import ProgressBar from './components/ProgressBar';
import ReminderSettings from './components/ReminderSettings';
import AIAssistant from './components/AIAssistant';
import CalendarWidget from './components/CalendarWidget';
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

const getTodayKey = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};
const formatDateLabel = (dateKey) => {
  if (!isDateKey(dateKey)) return '';
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const VIEW_STATE_KEY = 'et:last-view-state';
const userPayload = (session) => ({ userId: session?.id || null, email: session?.email });

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
  const [selectedDate, setSelectedDate] = useState(getTodayKey);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const isFirstCheck = useRef(true);
  const currentUser = useMemo(() => userPayload(session), [session?.id, session?.email]);
  const isSelectedDateToday = selectedDate === getTodayKey();

  const refreshStats = useCallback(async () => {
    if (session?.email) setTodayStats(await fetchTodayStats(currentUser));
  }, [session?.email, currentUser]);

  const fetchAllData = useCallback(async () => {
    try {
      const [selectedLogs, statsData, userSettings] = await Promise.all([
        fetchTodayLogs(selectedDate, currentUser),
        session?.email ? fetchTodayStats(currentUser) : Promise.resolve(null),
        session?.email ? fetchUserSettings(currentUser) : Promise.resolve(null),
      ]);
      setLogs(selectedLogs);
      if (statsData) setTodayStats(statsData);
      if (userSettings) setSettings(userSettings);
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
      setError('Fehler beim Laden der Daten.');
    }
  }, [session?.email, currentUser, selectedDate]);

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
      refreshStats().catch(console.error);
    }, 60000);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [fetchAllData, refreshStats]);

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

  const selectedDateCaffeine = useMemo(
    () => logs.reduce((sum, log) => sum + (log.caffeine || 0), 0),
    [logs]
  );
  const progressTitle = isSelectedDateToday ? 'Koffein heute' : `Koffein am ${formatDateLabel(selectedDate)}`;

  
  
  const handleUpdateLog = async (logId, data) => {
    try {
      const updated = await updateLog(logId, data);
      setLogs(prev => prev.map(l => String(l.id) === String(logId) ? { ...l, ...updated } : l));
      setCalendarRefreshKey((key) => key + 1);
      await refreshStats();
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };
  
  const handleDeleteLog = async (logId) => {
    try {
      await removeLog(logId);
      setLogs(prev => prev.filter(l => String(l.id) !== String(logId)));
      setCalendarRefreshKey((key) => key + 1);
      await refreshStats();
    } catch (err) {
      setError(err.message);
      throw err;
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
      const today = getTodayKey();
      const targetDate = isDateKey(drinkData?.date) ? drinkData.date : today;
      const payload = { ...drinkData, date: targetDate, ...userPayload(session) };
      const created = await addLog(payload);
      setSelectedDate(targetDate);
      if (targetDate === selectedDate) setLogs((prev) => [created, ...prev]);
      setCalendarRefreshKey((key) => key + 1);
      await refreshStats();
      return created;
    } catch (err) {
      setError('Fehler beim Hinzufügen. Bitte versuche es erneut.');
      throw err;
    } finally {
      setIsOperationLoading(false);
    }
  }, [session, refreshStats, selectedDate]);

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
            <ProgressBar currentCaffeine={selectedDateCaffeine} title={progressTitle} isToday={isSelectedDateToday} />
            
            {isSelectedDateToday && todayStats && settings && (
              <WarningAlert todayStats={todayStats} settings={settings} onClose={() => {}} />
            )}

            <CalendarWidget
              selectedDate={selectedDate}
              logs={logs}
              userIdentity={currentUser}
              onSelectDate={setSelectedDate}
              onUpdateLog={handleUpdateLog}
              onDeleteLog={handleDeleteLog}
              refreshKey={calendarRefreshKey}
              isLoading={isOperationLoading}
            />
            <DrinkHistory selectedDate={selectedDate} logs={logs} onDeleteLog={handleDeleteLog} onToggleFavorite={handleToggleFavorite} isFavoriteLog={() => false} />
            <AIAssistant key={session?.id || session?.email} session={session} selectedDate={selectedDate} totalCaffeineToday={selectedDateCaffeine} logs={logs} onAddDrink={handleAddDrink} onDeleteDrink={handleDeleteLog} onUpdateDrink={handleUpdateLog} />
            

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
