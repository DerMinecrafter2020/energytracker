import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Header from './components/Header';
import ProgressBar from './components/ProgressBar';
import ReminderSettings from './components/ReminderSettings';
import AIAssistant from './components/AIAssistant';
import ManualDrinkEntry from './components/ManualDrinkEntry';
import CalendarWidget from './components/CalendarWidget';
import CaffeineDecayChart from './components/CaffeineDecayChart';
import GoalOverview from './components/GoalOverview';
import DrinkHistory from './components/DrinkHistory';
import FavoriteQuickActions from './components/FavoriteQuickActions';
import PatternInsights from './components/PatternInsights';
import AchievementsPanel from './components/AchievementsPanel';
import ExportPanel from './components/ExportPanel';
import CalendarSuggestions from './components/CalendarSuggestions';
import DailyCoachCard from './components/DailyCoachCard';
import PersonalRecords from './components/PersonalRecords';
import LoginPage from './components/LoginPage';
import { Zap, Loader2, Bot, CalendarDays, History, Target, Droplets } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import RegisterPage from './components/RegisterPage';
import SettingsPanel from './components/SettingsPanel';
import WarningAlert from './components/WarningAlert';
import {
  fetchTodayStats,
  fetchStatsOverview,
  fetchPersonalRecords,
  fetchInsights,
  fetchUserSettings,
  fetchPublicSettings,
  fetchFavorites,
  addFavorite,
  removeFavorite,
  updateLog,
} from './services/api';
import { fetchTodayLogs, addLog, removeLog } from './services/storage';
import { fetchDailyCoach, fetchDailyHydrationQuote } from './services/aiApi';
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
const drinkKey = (drink) => [
  String(drink?.name || '').toLowerCase().trim(),
  Number(drink?.size || 0),
  Number(drink?.caffeine || 0),
  String(drink?.icon || '').trim(),
].join('|');
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

const getSavedAdminView = () => {
  const state = loadViewState();
  return state.adminView === 'user' ? 'user' : 'admin';
};

function App() {
  const initialViewState = loadViewState();
  const [session, setSession]     = useState(() => getSession());
  const [authView, setAuthView]   = useState(initialViewState.authView || 'login'); 
  const [adminView, setAdminView] = useState(initialViewState.adminView === 'user' ? 'user' : 'admin');
  const [adminTab, setAdminTab]   = useState(initialViewState.adminTab || 'overview');
  const [authNotice, setAuthNotice] = useState('');

  const impersonator = getImpersonatorSession();

  const persistScrollY = useCallback((scrollY) => {
    const current = loadViewState();
    saveViewState({ ...current, userScrollY: Math.max(0, Math.round(Number(scrollY) || 0)) });
  }, []);

  useEffect(() => {
    const current = loadViewState();
    saveViewState({ ...current, authView, adminTab, adminView });
  }, [authView, adminTab, adminView]);

  useEffect(() => {
    const handleAuthExpired = (event) => {
      logout();
      setSession(null);
      setAuthView('login');
      setAuthNotice(event.detail?.message || 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
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
    return <LoginPage initialMessage={authNotice} onLogin={(s) => { setAuthNotice(''); setSession(s); setAdminView(s?.role === 'admin' ? getSavedAdminView() : 'admin'); }} onShowRegister={() => setAuthView('register')} />;
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
  const [overviewStats, setOverviewStats] = useState(null);
  const [personalRecords, setPersonalRecords] = useState(null);
  const [insights, setInsights] = useState(null);
  const [settings, setSettings] = useState(null);
  const [appSettings, setAppSettings] = useState({ entryMode: 'ai' });
  const [favorites, setFavorites] = useState([]);
  const [hydrationQuote, setHydrationQuote] = useState({ quote: 'Hydration im Blick behalten', source: 'default' });
  const [dailyCoach, setDailyCoach] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [todayKey, setTodayKey] = useState(getTodayKey);
  const [selectedDate, setSelectedDate] = useState(getTodayKey);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const isFirstCheck = useRef(true);
  const followTodayRef = useRef(true);
  const currentUser = useMemo(() => userPayload(session), [session?.id, session?.email]);
  const isSelectedDateToday = selectedDate === todayKey;

  const refreshStats = useCallback(async () => {
    if (!session?.email) return;
    const [statsData, overviewData, recordsData, insightsData] = await Promise.all([
      fetchTodayStats(currentUser),
      fetchStatsOverview(currentUser),
      fetchPersonalRecords(currentUser),
      fetchInsights(currentUser),
    ]);
    setTodayStats(statsData);
    setOverviewStats(overviewData);
    setPersonalRecords(recordsData);
    setInsights(insightsData);
  }, [session?.email, currentUser]);

  const fetchAllData = useCallback(async () => {
    try {
      const [selectedLogs, statsData, overviewData, recordsData, insightsData, userSettings, favoriteItems, publicSettings] = await Promise.all([
        fetchTodayLogs(selectedDate, currentUser),
        session?.email ? fetchTodayStats(currentUser) : Promise.resolve(null),
        session?.email ? fetchStatsOverview(currentUser) : Promise.resolve(null),
        session?.email ? fetchPersonalRecords(currentUser) : Promise.resolve(null),
        session?.email ? fetchInsights(currentUser) : Promise.resolve(null),
        session?.email ? fetchUserSettings(currentUser) : Promise.resolve(null),
        session?.email ? fetchFavorites(currentUser) : Promise.resolve([]),
        fetchPublicSettings().catch(() => ({ entryMode: 'ai' })),
      ]);
      setLogs(selectedLogs);
      if (statsData) setTodayStats(statsData);
      if (overviewData) setOverviewStats(overviewData);
      if (recordsData) setPersonalRecords(recordsData);
      if (insightsData) setInsights(insightsData);
      if (userSettings) setSettings(userSettings);
      setFavorites(Array.isArray(favoriteItems) ? favoriteItems : []);
      setAppSettings({ entryMode: publicSettings?.entryMode === 'manual' ? 'manual' : 'ai' });
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
    let isMounted = true;
    setDailyCoach(null);
    Promise.all([
      fetchDailyHydrationQuote(selectedDate).catch(() => null),
      fetchDailyCoach(selectedDate).catch(() => null),
    ])
      .then(([quoteData, coachData]) => {
        if (!isMounted) return;
        if (quoteData?.quote) setHydrationQuote(quoteData);
        if (coachData?.headline) setDailyCoach(coachData);
      })
      .catch(() => {
        if (isMounted) setHydrationQuote({ quote: 'Hydration im Blick behalten', source: 'fallback' });
      });
    return () => { isMounted = false; };
  }, [selectedDate, calendarRefreshKey]);

  useEffect(() => {
    const refreshLocalDay = () => {
      const nextToday = getTodayKey();
      setTodayKey((previousToday) => {
        if (previousToday !== nextToday && (followTodayRef.current || selectedDate === previousToday)) {
          followTodayRef.current = true;
          setSelectedDate(nextToday);
        }
        return nextToday;
      });
    };

    refreshLocalDay();
    const interval = window.setInterval(refreshLocalDay, 30000);
    window.addEventListener('focus', refreshLocalDay);
    document.addEventListener('visibilitychange', refreshLocalDay);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshLocalDay);
      document.removeEventListener('visibilitychange', refreshLocalDay);
    };
  }, [selectedDate]);

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
  const dailyLimit = settings?.dailyLimit || todayStats?.dailyLimit || 400;
  const selectedDateLabel = isSelectedDateToday ? 'Heute' : formatDateLabel(selectedDate);
  const remainingCaffeine = Math.max(0, dailyLimit - selectedDateCaffeine);
  const aiContextSummary = `${selectedDateLabel}: ${selectedDateCaffeine} mg, ${logs.length} Einträge, Limit ${dailyLimit} mg`;
  const entryMode = appSettings.entryMode === 'manual' ? 'manual' : 'ai';

  
  
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
        const existing = favorites.find((favorite) => drinkKey(favorite) === drinkKey(log));
        if (existing) {
          await removeFavorite({ ...currentUser, favoriteId: existing.id });
          setFavorites((prev) => prev.filter((favorite) => favorite.id !== existing.id));
        }
      } else {
        const data = await addFavorite({ ...currentUser, drink: log });
        if (data?.item) {
          setFavorites((prev) => [data.item, ...prev.filter((favorite) => favorite.id !== data.item.id)]);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddFavoriteDrink = async (drink) => {
    await handleAddDrink({
      name: drink.name,
      size: Number(drink.size) || 0,
      caffeine: Number(drink.caffeine) || 0,
      caffeinePerMl: drink.caffeinePerMl,
      icon: drink.icon || '🥤',
      date: selectedDate,
    });
  };

  const handleRemoveFavorite = async (favoriteId) => {
    try {
      await removeFavorite({ ...currentUser, favoriteId });
      setFavorites((prev) => prev.filter((favorite) => favorite.id !== favoriteId));
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
      const payload = { ...drinkData, date: targetDate, ...currentUser };
      const created = await addLog(payload);
      followTodayRef.current = targetDate === getTodayKey();
      setSelectedDate(targetDate);
      const targetLogs = await fetchTodayLogs(targetDate, currentUser);
      setLogs(targetLogs);
      setCalendarRefreshKey((key) => key + 1);
      await refreshStats();
      return created;
    } catch (err) {
      setError('Fehler beim Hinzufügen. Bitte versuche es erneut.');
      throw err;
    } finally {
      setIsOperationLoading(false);
    }
  }, [currentUser, refreshStats]);

  const handleSelectDate = useCallback((dateKey) => {
    followTodayRef.current = dateKey === getTodayKey();
    setSelectedDate(dateKey);
  }, []);

  const isManualMode = entryMode === 'manual';
  const aiContextWidgets = (
    <>
      {isSelectedDateToday && todayStats && settings && (
        <WarningAlert todayStats={todayStats} settings={settings} onClose={() => {}} />
      )}

      <ProgressBar currentCaffeine={selectedDateCaffeine} title={progressTitle} isToday={isSelectedDateToday} />
      <DailyCoachCard coach={dailyCoach} />
      {overviewStats && <GoalOverview overview={overviewStats} />}
      {isSelectedDateToday && (
        <CaffeineDecayChart logs={logs} sleepTime={settings?.sleepTime || '23:00'} />
      )}

      <FavoriteQuickActions
        favorites={favorites}
        onAddFavorite={handleAddFavoriteDrink}
        onRemoveFavorite={handleRemoveFavorite}
        isLoading={isOperationLoading}
      />

      <CalendarSuggestions
        selectedDate={selectedDate}
        logs={logs}
        totalCaffeine={selectedDateCaffeine}
        dailyLimit={dailyLimit}
        insights={insights}
      />
    </>
  );
  const analysisWidgets = (
    <>
      {insights && <PatternInsights insights={insights} />}
      {personalRecords && <PersonalRecords records={personalRecords} />}
      {insights?.achievements && <AchievementsPanel achievements={insights.achievements} />}
      <ExportPanel userIdentity={currentUser} />
    </>
  );

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

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-5 lg:px-6 pb-20 sm:pb-24">
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
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-cyan-500/20 bg-cyan-500/5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                  <Droplets className="w-4 h-4 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-cyan-300 font-semibold uppercase tracking-wider">Tagesziel</p>
                  <p className="text-sm sm:text-base text-white font-semibold leading-snug">{hydrationQuote.quote}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <div className="glass-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2 min-w-0">
                  <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-300 shrink-0" />
                  Kontext
                </div>
                <p className="text-sm sm:text-lg font-bold text-white truncate">{selectedDateLabel}</p>
              </div>
              <div className="glass-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2 min-w-0">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
                  Koffein
                </div>
                <p className="text-sm sm:text-lg font-bold text-white truncate">{selectedDateCaffeine} mg</p>
              </div>
              <div className="glass-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2 min-w-0">
                  <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300 shrink-0" />
                  <span className="truncate">Rest</span>
                </div>
                <p className="text-sm sm:text-lg font-bold text-white truncate">{remainingCaffeine} mg</p>
              </div>
              <div className="glass-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2 min-w-0">
                  <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-300 shrink-0" />
                  Einträge
                </div>
                <p className="text-sm sm:text-lg font-bold text-white truncate">{logs.length}</p>
              </div>
            </div>

            <section className={`${isManualMode ? 'space-y-4 sm:space-y-5' : 'grid gap-4 sm:gap-5 items-start xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]'}`}>
              <div className="min-w-0">
                {isManualMode ? (
                  <ManualDrinkEntry
                    selectedDate={selectedDate}
                    onAddDrink={handleAddDrink}
                    isLoading={isOperationLoading}
                  />
                ) : (
                  <AIAssistant
                    key={session?.id || session?.email}
                    session={session}
                    selectedDate={selectedDate}
                    totalCaffeineToday={selectedDateCaffeine}
                    logs={logs}
                    onAddDrink={handleAddDrink}
                    onDeleteDrink={handleDeleteLog}
                    onUpdateDrink={handleUpdateLog}
                    primary
                    contextSummary={aiContextSummary}
                  />
                )}
              </div>

              <aside className={isManualMode ? 'space-y-3 sm:space-y-4' : 'space-y-3 sm:space-y-4 xl:sticky xl:top-24'}>
                <div className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-300">
                  <Bot className="w-4 h-4 text-violet-300" />
                  {isManualMode ? 'KI-Widgets und Automatik-Hilfen' : 'KI-Kontext zum Chat'}
                </div>

                {isManualMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
                    {aiContextWidgets}
                  </div>
                ) : aiContextWidgets}
              </aside>
            </section>

            <section className={isManualMode ? 'space-y-4 sm:space-y-5' : 'grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] items-start'}>
              <CalendarWidget
                selectedDate={selectedDate}
                logs={logs}
                userIdentity={currentUser}
                onSelectDate={handleSelectDate}
                onUpdateLog={handleUpdateLog}
                onDeleteLog={handleDeleteLog}
                refreshKey={calendarRefreshKey}
                isLoading={isOperationLoading}
              />

              <div className={isManualMode ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5' : 'space-y-4 sm:space-y-5'}>
                <DrinkHistory
                  selectedDate={selectedDate}
                  logs={logs}
                  onDeleteLog={handleDeleteLog}
                  onToggleFavorite={handleToggleFavorite}
                  isFavoriteLog={(log) => favorites.some((favorite) => drinkKey(favorite) === drinkKey(log))}
                />
                {analysisWidgets}
              </div>
            </section>
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
