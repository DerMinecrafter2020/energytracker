import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../context/LanguageContext';
import {
  ShieldCheck, LogOut, Trash2, RefreshCw, Database,
  TrendingUp, Users, Zap, Calendar, BarChart2, AlertTriangle,
  Download, Search, ChevronDown, ChevronUp, Coffee,
  Settings, Mail, Server, Lock, Eye, EyeOff, Send, MessageCircle,
  CheckCircle, UserCheck, UserX, Clock, Shield, Bot, User, Link, Hash,
} from 'lucide-react';
import { logout } from '../services/auth';
import { fetchLogs, deleteLog as deleteApiLog } from '../services/api';
import {
  fetchSmtpConfig, saveSmtpConfig, testSmtpConfig,
  fetchAdminUsers, verifyAdminUser, deleteAdminUser, setUserRole, createAdminUser, impersonateUser,
  testDiscordWebhook, fetchAiConfig, saveAiConfig, fetchRedisHealth,
} from '../services/adminApi';

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const formatDate = (isoStr) => {
  if (!isoStr) return '–';
  return new Date(isoStr).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const getLast7Days = () =>
  Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

// â”€â”€ Stat Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StatCard = ({ icon: Icon, label, value, sub, color = 'blue' }) => {
  const colors = {
    blue:   'from-blue-600/20  to-blue-500/5  border-blue-500/20  text-blue-400',
    amber:  'from-amber-600/20 to-amber-500/5 border-amber-500/20 text-amber-400',
    green:  'from-green-600/20 to-green-500/5 border-green-500/20 text-green-400',
    red:    'from-red-600/20   to-red-500/5   border-red-500/20   text-red-400',
    purple: 'from-purple-600/20 to-purple-500/5 border-purple-500/20 text-purple-400',
  };
  const cls = colors[color] || colors.blue;
  return (
    <div className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${cls}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-current/10`}>
        <Icon className={`w-5 h-5 ${cls.split(' ').at(-1)}`} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
};

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AdminPanel = ({ session, onLogout, onShowUserPanel, onImpersonate, initialActiveTab = 'overview', onActiveTabChange }) => {
  const { t } = useTranslation();
  const [allLogs, setAllLogs]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [search, setSearch]       = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir]     = useState('desc');
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  // â”€â”€ SMTP state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const defaultSmtp = { host: '', port: 587, secure: false, auth: { user: '', pass: '' },
    fromName: 'Koffein-Tracker', fromEmail: '', baseUrl: '', registrationEnabled: true, demoEnabled: true };
  const [smtp, setSmtp]           = useState(defaultSmtp);
  const [smtpLoaded, setSmtpLoaded] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showSmtpPw, setShowSmtpPw] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [discordTesting, setDiscordTesting] = useState(false);
  const [smtpMsg, setSmtpMsg]     = useState(null);

  // â”€â”€ AI Config state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [aiApiKey, setAiApiKey]   = useState('');
  const [aiModel, setAiModel]     = useState('deepseek/deepseek-v3');
  const [aiKeyMasked, setAiKeyMasked] = useState('');
  const [braveSearchKey, setBraveSearchKey] = useState('');
  const [braveKeyMasked, setBraveKeyMasked] = useState('');

  const [aiSaving, setAiSaving]   = useState(false);
  const [aiMsg, setAiMsg]         = useState(null);

  // â”€â”€ Users state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [regUsers, setRegUsers]   = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersMsg, setUsersMsg]   = useState(null);

  // â”€â”€ Create User modal state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'user', verified: true });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState(null);

  // â”€â”€ Redis health state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [redisHealth, setRedisHealth]     = useState(null);
  const [redisChecking, setRedisChecking] = useState(false);
  const [redisError, setRedisError]       = useState(null);


  // Load SMTP config when settings tab is opened
  useEffect(() => {
    if (activeTab === 'settings' && !smtpLoaded) {
      fetchSmtpConfig()
        .then((cfg) => { if (cfg) setSmtp(cfg); setSmtpLoaded(true); })
        .catch(() => setSmtpLoaded(true));
      fetchAiConfig()
        .then((cfg) => { 
          setAiModel(cfg.model || 'google/gemini-2.0-flash-001'); 
          setAiKeyMasked(cfg.apiKeyMasked || ''); 
          setBraveKeyMasked(cfg.braveSearchKeyMasked || ''); 

        })
        .catch(() => {});
      handleRedisCheck();
    }
    if (activeTab === 'users') loadRegUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);



  useEffect(() => {
    if (onActiveTabChange) onActiveTabChange(activeTab);
  }, [activeTab, onActiveTabChange]);

  const handleRedisCheck = async () => {
    setRedisChecking(true);
    setRedisError(null);
    try {
      const data = await fetchRedisHealth();
      setRedisHealth(data);
    } catch (err) {
      setRedisError(err.message);
    } finally {
      setRedisChecking(false);
    }
  };

  const loadRegUsers = async () => {
    setUsersLoading(true);
    setUsersMsg(null);
    try {
      const data = await fetchAdminUsers();
      setRegUsers(data);
    } catch (err) {
      setUsersMsg({ type: 'error', text: 'Fehler beim Laden der Benutzer: ' + err.message });
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSmtpChange = (path, value) => {
    setSmtp((prev) => {
      if (path === 'auth.user') return { ...prev, auth: { ...prev.auth, user: value } };
      if (path === 'auth.pass') return { ...prev, auth: { ...prev.auth, pass: value } };
      return { ...prev, [path]: value };
    });
  };

  const handleSmtpSave = async () => {
    setSmtpSaving(true);
    setSmtpMsg(null);
    try {
      await saveSmtpConfig(smtp);
      setSmtpMsg({ type: 'success', text: 'SMTP-Einstellungen gespeichert.' });
    } catch (err) {
      setSmtpMsg({ type: 'error', text: err.message });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSmtpTest = async () => {
    if (!testEmail.trim()) { setSmtpMsg({ type: 'error', text: 'Bitte Ziel-E-Mail-Adresse eingeben.' }); return; }
    setSmtpTesting(true);
    setSmtpMsg(null);
    try {
      const res = await testSmtpConfig(testEmail.trim());
      setSmtpMsg({ type: 'success', text: res.message || 'Test-E-Mail gesendet.' });
    } catch (err) {
      setSmtpMsg({ type: 'error', text: err.message });
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleDiscordTest = async () => {
    if (!smtp.discordWebhook?.trim()) {
      setSmtpMsg({ type: 'error', text: 'Bitte Discord Webhook URL eingeben.' });
      return;
    }

    setDiscordTesting(true);
    setSmtpMsg(null);
    try {
      const res = await testDiscordWebhook(smtp.discordWebhook.trim());
      setSmtpMsg({ type: 'success', text: res.message || 'Discord Testnachricht gesendet.' });
    } catch (err) {
      setSmtpMsg({ type: 'error', text: err.message });
    } finally {
      setDiscordTesting(false);
    }
  };

  const handleSaveAi = async () => {
    setAiSaving(true);
    setAiMsg(null);
    try {
      await saveAiConfig({ 
        apiKey: aiApiKey.trim() || undefined, 
        model: aiModel.trim(), 
        braveSearchKey: braveSearchKey.trim() || undefined,

      });
      setAiMsg({ type: 'success', text: 'AI-Einstellungen gespeichert.' });
      if (aiApiKey.trim()) {
        setAiKeyMasked(aiApiKey.slice(0, 8) + '••••••••' + aiApiKey.slice(-4));
        setAiApiKey('');
      }
      if (braveSearchKey.trim()) {
        setBraveKeyMasked(braveSearchKey.slice(0, 4) + '••••••••' + braveSearchKey.slice(-4));
        setBraveSearchKey('');
      }

    } catch (err) {
      setAiMsg({ type: 'error', text: err.message });
    } finally {
      setAiSaving(false);
    }
  };



  const handleVerifyUser = async (id) => {
    try {
      await verifyAdminUser(id);
      setRegUsers((prev) => prev.map((u) => u.id === id ? { ...u, verified: true } : u));
      setUsersMsg({ type: 'success', text: 'Benutzer manuell verifiziert.' });
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Diesen Benutzer wirklich löschen?')) return;
    try {
      await deleteAdminUser(id);
      setRegUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateUserLoading(true);
    setUsersMsg(null);
    try {
      const newUser = await createAdminUser(createForm);
      setRegUsers((prev) => [newUser, ...prev]);
      setUsersMsg({ type: 'success', text: `Benutzer "${newUser.name}" wurde erfolgreich erstellt.` });
      setShowCreateUser(false);
      setCreateForm({ name: '', email: '', password: '', role: 'user', verified: true });
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleImpersonate = async (u) => {
    if (!onImpersonate) return;
    setImpersonatingId(u.id);
    try {
      const userData = await impersonateUser(u.id);
      onImpersonate(userData);
    } catch (err) {
      setUsersMsg({ type: 'error', text: 'Fehler beim Wechseln: ' + err.message });
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleToggleRole = async (id, currentRole) => {
    const isSelf = (session?.id && session.id === id) || (!session?.id && regUsers.find((u) => u.id === id)?.email === session?.email);
    if (isSelf && currentRole === 'admin') {
      setUsersMsg({ type: 'error', text: 'Du kannst deinen eigenen Admin-Account nicht herunterstufen.' });
      return;
    }
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await setUserRole(id, newRole);
      setRegUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u));
      setUsersMsg({ type: 'success', text: `Rolle auf "${newRole === 'admin' ? 'Admin' : 'Benutzer'}" geändert.` });
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    }
  };



  const loadAllLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const days = Array.from({ length: 30 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      });
      const results = await Promise.allSettled(days.map((day) => fetchLogs(day)));
      const combined = results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => r.value);
      setAllLogs(combined);
    } catch (err) {
      setError('Fehler beim Laden der Daten: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAllLogs(); }, []);

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const today = new Date().toISOString().split('T')[0];

  const stats = useMemo(() => {
    const todayLogs   = allLogs.filter((l) => (l.date || '').startsWith(today));
    const totalCaff   = allLogs.reduce((s, l) => s + (l.caffeine || 0), 0);
    const todayCaff   = todayLogs.reduce((s, l) => s + (l.caffeine || 0), 0);
    const avgPerDrink = allLogs.length
      ? Math.round(allLogs.reduce((s, l) => s + (l.caffeine || 0), 0) / allLogs.length)
      : 0;
    return { totalLogs: allLogs.length, todayLogs: todayLogs.length, totalCaff, todayCaff, avgPerDrink };
  }, [allLogs, today]);

  // â”€â”€ Chart data (last 7 days) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const chartData = useMemo(() => {
    const days = getLast7Days();
    return days.map((day) => {
      const dayLogs = allLogs.filter((l) => (l.date || '').startsWith(day));
      const total   = dayLogs.reduce((s, l) => s + (l.caffeine || 0), 0);
      return { day: day.slice(5), total };
    });
  }, [allLogs]);

  const chartMax = Math.max(...chartData.map((d) => d.total), 400);

  // â”€â”€ Sorted & filtered logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase();
    return [...allLogs]
      .filter((l) =>
        !q ||
        (l.name || '').toLowerCase().includes(q) ||
        (l.date || '').includes(q)
      )
      .sort((a, b) => {
        const av = a[sortField] ?? '';
        const bv = b[sortField] ?? '';
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [allLogs, search, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDelete = async (id) => {
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
    setDeleting(id);
    try {
      await deleteApiLog(id);
      setAllLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert('Fehler beim Löschen: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  // â”€â”€ Export CSV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const exportCSV = () => {
    const header = 'ID,Name,Koffein (mg),Größe (ml),Datum,Erstellt';
    const rows = allLogs.map((l) =>
      [l.id, `"${l.name}"`, l.caffeine, l.size, l.date, formatDate(l.createdAt)].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `koffein-logs-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
 logout(); onLogout(); };

  // â”€â”€ Sorting icon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const SortIcon = ({ field }) =>
    sortField === field
      ? sortDir === 'asc'
        ? <ChevronUp   className="w-3 h-3 inline ml-1 text-blue-400" />
        : <ChevronDown className="w-3 h-3 inline ml-1 text-blue-400" />
      : null;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at top, #0f172a 0%, #070b14 70%)' }}>

      {/* â”€â”€ Top nav â”€â”€ */}
      <header className="glass-card border-b border-white/10 px-4 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500
              flex items-center justify-center shadow-glow-amber">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white leading-tight">Admin-Panel</h1>
              <p className="text-xs text-slate-500">Koffein-Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onShowUserPanel && (
              <button
                onClick={onShowUserPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-300
                  bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all text-sm"
                title="Zur Benutzeransicht wechseln"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Benutzeransicht</span>
              </button>
            )}
            <span className="hidden sm:block text-xs text-slate-500">
              Angemeldet als <span className="text-amber-400 font-medium">{session.name}</span>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400
                hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      {/* â”€â”€ Tabs â”€â”€ */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="glass-card rounded-2xl p-1 mb-6 w-full overflow-x-auto">
          <div className="flex gap-1 min-w-max">
          {[
            { id: 'overview',  label: 'Übersicht',  icon: BarChart2  },
            { id: 'logs',      label: 'Alle Logs',  icon: Database   },
            { id: 'users',     label: 'Benutzer',   icon: Users      },
            { id: 'settings',  label: 'Einstellungen', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${activeTab === id
                  ? 'bg-blue-600 text-white shadow-glow-blue'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
          </div>
        </div>

        {/* â”€â”€ Error â”€â”€ */}
        {error && (
          <div className="glass-card rounded-2xl p-4 mb-6 border border-red-500/30
            bg-red-500/10 flex items-center gap-3 animate-slide-in">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={loadAllLogs} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
              Erneut laden
            </button>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• OVERVIEW TAB â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in space-y-6 pb-10">

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard icon={Database}   label="Logs gesamt"     value={stats.totalLogs}   color="blue"   />
              <StatCard icon={Calendar}   label="Logs heute"      value={stats.todayLogs}   color="green"  />
              <StatCard icon={Zap}        label="Koffein heute"   value={`${stats.todayCaff} mg`} color="amber" />
              <StatCard icon={TrendingUp} label="Koffein gesamt"  value={`${stats.totalCaff} mg`} color="purple"/>
              <StatCard icon={Coffee}     label="Ø pro Getränk"   value={`${stats.avgPerDrink} mg`} color="red" />
            </div>

            {/* Chart – last 7 days */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-400" />
                  Koffein letzte 7 Tage
                </h2>
              </div>
              <div className="flex items-end gap-3 h-40">
                {isLoading
                  ? Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="flex-1 shimmer rounded-t-xl" style={{ height: '60%' }} />
                    ))
                  : chartData.map(({ day, total }) => {
                      const pct = chartMax > 0 ? (total / chartMax) * 100 : 0;
                      const isToday = day === today.slice(5);
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                          <span className="text-xs text-slate-500">{total > 0 ? total : ''}</span>
                          <div
                            className={`w-full rounded-t-xl transition-all duration-500
                              ${isToday
                                ? 'bg-gradient-to-t from-blue-600 to-blue-400 shadow-glow-blue'
                                : 'bg-gradient-to-t from-slate-700 to-slate-600'
                              }`}
                            style={{ height: `${Math.max(pct, 4)}%` }}
                          />
                          <span className={`text-xs ${isToday ? 'text-blue-400 font-semibold' : 'text-slate-600'}`}>
                            {day}
                          </span>
                        </div>
                      );
                    })
                }
              </div>
            </div>

            {/* Quick stats table – top drinks */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                Top-Getränke gesamt
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-10 shimmer rounded-xl" />)}
                </div>
              ) : (() => {
                const counts = {};
                allLogs.forEach((l) => {
                  const k = 