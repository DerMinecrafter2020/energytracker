import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, LogOut, Trash2, RefreshCw, Database,
  TrendingUp, Users, Zap, Calendar, BarChart2, AlertTriangle,
  Download, Upload, Search, ChevronDown, ChevronUp, Coffee,
  Settings, Mail, Server, Lock, Eye, EyeOff, Send, MessageCircle,
  CheckCircle, UserCheck, UserX, Clock, Shield, Bot, User, Link, Hash, Edit3,
  Activity, FileText, Printer, Cloud,
} from 'lucide-react';
import { logout } from '../services/auth';
import { fetchLogs, deleteLog as deleteApiLog, adminUpdateLog } from '../services/api';
import {
  fetchSmtpConfig, saveSmtpConfig, testSmtpConfig,
  fetchAdminUsers, verifyAdminUser, deleteAdminUser, setUserRole, createAdminUser, impersonateUser,
  testDiscordWebhook, saveDiscordWebhook, fetchDiscordAiStatus, fetchAiConfig, saveAiConfig, fetchRedisHealth, fetchAdminChatStats,
  fetchAdminActivity, fetchAdminApiTests, fetchAdminAppSettings, saveAdminAppSettings, fetchAdminExportLogs, fetchDatabaseBackup, importDatabaseBackup,
  fetchS3Status, fetchS3Backups, createS3Backup, restoreS3Backup,
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

const dateKey = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const defaultExportStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return dateKey(d);
};

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatBytes = (value) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const buildAdminCsv = (items) => {
  const header = ['ID', 'Name', 'Koffein (mg)', 'Groesse (ml)', 'Datum', 'E-Mail', 'Erstellt'];
  const rows = items.map((item) => [
    item.id,
    item.name,
    item.caffeine,
    item.size,
    item.date,
    item.email || '',
    item.createdAt || '',
  ].map(csvValue).join(','));
  return [header.map(csvValue).join(','), ...rows].join('\n');
};

const htmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const renderAdminPrintableHtml = ({ items, summary }) => `
  <!doctype html>
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <title>Admin Export</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
        h1 { margin: 0 0 8px; }
        .meta { color: #4b5563; margin-bottom: 24px; }
        .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
        .value { font-size: 22px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px; }
        th { background: #f9fafb; }
      </style>
    </head>
    <body>
      <h1>Admin Export</h1>
      <div class="meta">${htmlEscape(summary.start)} bis ${htmlEscape(summary.end)}</div>
      <div class="cards">
        <div class="card"><div class="value">${summary.logCount}</div><div>Einträge</div></div>
        <div class="card"><div class="value">${summary.totalCaffeine} mg</div><div>Koffein</div></div>
        <div class="card"><div class="value">${summary.totalSize} ml</div><div>Getränke</div></div>
      </div>
      <table>
        <thead>
          <tr><th>Datum</th><th>Benutzer</th><th>Name</th><th>Groesse</th><th>Koffein</th></tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${htmlEscape(item.date)}</td>
              <td>${htmlEscape(item.email || '-')}</td>
              <td>${htmlEscape(item.name)}</td>
              <td>${htmlEscape(item.size)} ml</td>
              <td>${htmlEscape(item.caffeine)} mg</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
  </html>
`;

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

const Spinner = ({ className = 'w-4 h-4 border-2 border-white/30 border-t-white', block = false }) =>
  <span className={`${className} rounded-full animate-spin ${block ? 'block' : ''}`} />;

const ToggleSwitch = ({ checked, onClick, onColor = 'bg-green-500' }) => (
  <button type="button" onClick={onClick}
    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${checked ? onColor : 'bg-white/10'}`}>
    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${checked ? 'left-7' : 'left-1'}`} />
  </button>
);

const Field = ({ label, icon: Icon, children, className = '', inputClass = '', ...props }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
      <input {...props} className={`input-dark ${Icon ? 'pl-10' : ''} ${children ? 'pr-10' : ''} ${inputClass}`} />
      {children}
    </div>
  </div>
);

const MessageBox = ({ message, iconSize = 'w-4 h-4', onClose, className = 'glass-card rounded-2xl p-3' }) => message && (
  <div className={`${className} flex items-center gap-2 text-sm border animate-slide-in
    ${message.type === 'success'
      ? 'bg-green-500/10 border-green-500/30 text-green-300'
      : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
    {message.type === 'success'
      ? <CheckCircle className={`${iconSize} shrink-0`} />
      : <AlertTriangle className={`${iconSize} shrink-0`} />}
    <span>{message.text}</span>
    {onClose && <button onClick={onClose} className="ml-auto text-xs opacity-60 hover:opacity-100">×</button>}
  </div>
);

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AdminPanel = ({ session, onLogout, onShowUserPanel, onImpersonate, initialActiveTab = 'overview', onActiveTabChange }) => {
    const [allLogs, setAllLogs]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [search, setSearch]       = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir]     = useState('desc');
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  // Edit Log modal state
  const [editingLog, setEditingLog] = useState(null);
  const [editLogData, setEditLogData] = useState({ name: '', size: 0, caffeine: 0, icon: '' });
  const [editLogSaving, setEditLogSaving] = useState(false);
  


  // â”€â”€ SMTP state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const defaultSmtp = { host: '', port: 587, secure: false, auth: { user: '', pass: '' },
    fromName: 'Koffein-Tracker', fromEmail: '', baseUrl: '', registrationEnabled: true, demoEnabled: true, discordWebhook: '' };
  const [smtp, setSmtp]           = useState(defaultSmtp);
  const [smtpLoaded, setSmtpLoaded] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showSmtpPw, setShowSmtpPw] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [discordSaving, setDiscordSaving] = useState(false);
  const [discordTesting, setDiscordTesting] = useState(false);
  const [smtpMsg, setSmtpMsg]     = useState(null);
  const [discordAiStatus, setDiscordAiStatus] = useState(null);
  const [discordAiStatusLoading, setDiscordAiStatusLoading] = useState(false);
  const [discordAiStatusMsg, setDiscordAiStatusMsg] = useState(null);
  const [entryMode, setEntryMode] = useState('ai');
  const [entryModeSaving, setEntryModeSaving] = useState(false);
  const [entryModeMsg, setEntryModeMsg] = useState(null);

  // â”€â”€ AI Config state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [aiApiKey, setAiApiKey]   = useState('');
  const [aiModel, setAiModel]     = useState('deepseek/deepseek-v3');
  const [aiKeyMasked, setAiKeyMasked] = useState('');
  const [braveSearchKey, setBraveSearchKey] = useState('');
  const [braveKeyMasked, setBraveKeyMasked] = useState('');

  const [aiSaving, setAiSaving]   = useState(false);
  const [aiMsg, setAiMsg]         = useState(null);

  // â”€â”€ AI chat stats state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [chatStats, setChatStats] = useState({ users: [], totals: {} });
  const [chatStatsLoading, setChatStatsLoading] = useState(false);
  const [chatStatsMsg, setChatStatsMsg] = useState(null);

  // Admin activity and exports
  const [adminActivity, setAdminActivity] = useState({ totals: {}, recentLogins: [], topDrinks: [], usersOverLimit: [], recentLogs: [] });
  const [adminActivityLoading, setAdminActivityLoading] = useState(false);
  const [adminActivityMsg, setAdminActivityMsg] = useState(null);
  const [apiTests, setApiTests] = useState({ exists: false, tests: [], total: 0 });
  const [apiTestsLoading, setApiTestsLoading] = useState(false);
  const [apiTestsMsg, setApiTestsMsg] = useState(null);
  const [exportStart, setExportStart] = useState(defaultExportStart);
  const [exportEnd, setExportEnd] = useState(() => dateKey(new Date()));
  const [exportEmail, setExportEmail] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

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
  const [dbBackupLoading, setDbBackupLoading] = useState(false);
  const [dbImportLoading, setDbImportLoading] = useState(false);
  const [dbBackupMsg, setDbBackupMsg] = useState(null);
  const [s3Status, setS3Status] = useState(null);
  const [s3Backups, setS3Backups] = useState([]);
  const [s3Loading, setS3Loading] = useState(false);
  const [s3ActionLoading, setS3ActionLoading] = useState(false);
  const [s3Msg, setS3Msg] = useState(null);


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
      loadDiscordAiStatus();
      loadAppSettings();
      loadS3Backups();

    }
    if (activeTab === 'users') loadRegUsers();
    if (activeTab === 'chat') loadChatStats();
    if (activeTab === 'activity') loadAdminActivity();
    if (activeTab === 'tests') loadApiTests();
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

  const handleDatabaseExport = async () => {
    setDbBackupLoading(true);
    setDbBackupMsg(null);
    try {
      const backup = await fetchDatabaseBackup();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadFile(
        JSON.stringify(backup, null, 2),
        `koffein-db-backup-${stamp}.db`,
        'application/vnd.koffein-tracker.database+json;charset=utf-8;'
      );
      setDbBackupMsg({ type: 'success', text: 'Datenbank-Backup wurde als .db-Datei heruntergeladen.' });
    } catch (err) {
      setDbBackupMsg({ type: 'error', text: err.message || 'Backup fehlgeschlagen.' });
    } finally {
      setDbBackupLoading(false);
    }
  };

  const handleDatabaseImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('Datenbank wirklich importieren? Der aktuelle Datenbestand wird ersetzt.')) return;

    setDbImportLoading(true);
    setDbBackupMsg(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const result = await importDatabaseBackup(backup);
      const summary = result.summary || {};
      setDbBackupMsg({
        type: 'success',
        text: `Import abgeschlossen: ${summary.logs || 0} Logs, ${summary.users || 0} Benutzer, ${summary.reminders || 0} Reminder.`,
      });
      await Promise.all([
        loadAllLogs(),
        activeTab === 'users' ? loadRegUsers() : Promise.resolve(),
        activeTab === 'chat' ? loadChatStats() : Promise.resolve(),
        activeTab === 'activity' ? loadAdminActivity() : Promise.resolve(),
        handleRedisCheck(),
        loadS3Backups(),
      ]);
    } catch (err) {
      const isParseError = err instanceof SyntaxError;
      setDbBackupMsg({ type: 'error', text: isParseError ? 'Die .db-Datei ist kein gültiges Koffein-Tracker-Backup.' : (err.message || 'Import fehlgeschlagen.') });
    } finally {
      setDbImportLoading(false);
    }
  };

  const loadS3Backups = async () => {
    setS3Loading(true);
    setS3Msg(null);
    try {
      const status = await fetchS3Status();
      setS3Status(status);
      if (!status.configured) {
        setS3Backups([]);
        return;
      }

      const data = await fetchS3Backups();
      setS3Status(data.status || status);
      setS3Backups(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setS3Msg({ type: 'error', text: err.message || 'S3-Backups konnten nicht geladen werden.' });
    } finally {
      setS3Loading(false);
    }
  };

  const handleS3Backup = async () => {
    setS3ActionLoading(true);
    setS3Msg(null);
    try {
      const result = await createS3Backup();
      setS3Msg({ type: 'success', text: `S3-Backup gespeichert: ${result.filename || result.key}` });
      await loadS3Backups();
    } catch (err) {
      setS3Msg({ type: 'error', text: err.message || 'S3-Backup fehlgeschlagen.' });
    } finally {
      setS3ActionLoading(false);
    }
  };

  const handleS3Restore = async (key) => {
    if (!key) return;
    if (!window.confirm('S3-Backup wirklich wiederherstellen? Der aktuelle Datenbestand wird ersetzt.')) return;

    setS3ActionLoading(true);
    setS3Msg(null);
    try {
      const result = await restoreS3Backup(key);
      const summary = result.summary || {};
      setS3Msg({
        type: 'success',
        text: `S3-Restore abgeschlossen: ${summary.logs || 0} Logs, ${summary.users || 0} Benutzer, ${summary.reminders || 0} Reminder.`,
      });
      await Promise.all([
        loadAllLogs(),
        activeTab === 'users' ? loadRegUsers() : Promise.resolve(),
        activeTab === 'chat' ? loadChatStats() : Promise.resolve(),
        activeTab === 'activity' ? loadAdminActivity() : Promise.resolve(),
        handleRedisCheck(),
        loadS3Backups(),
      ]);
    } catch (err) {
      setS3Msg({ type: 'error', text: err.message || 'S3-Restore fehlgeschlagen.' });
    } finally {
      setS3ActionLoading(false);
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

  const handleDiscordWebhookSave = async () => {
    const safeWebhook = smtp.discordWebhook?.trim() || '';
    setDiscordSaving(true);
    setSmtpMsg(null);
    try {
      const res = await saveDiscordWebhook(safeWebhook);
      setSmtp((prev) => ({ ...prev, discordWebhook: safeWebhook }));
      await loadDiscordAiStatus();
      setSmtpMsg({ type: 'success', text: res.message || 'Discord Bot Webhook gespeichert.' });
    } catch (err) {
      setSmtpMsg({ type: 'error', text: err.message });
    } finally {
      setDiscordSaving(false);
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
      const safeWebhook = smtp.discordWebhook.trim();
      const res = await testDiscordWebhook(safeWebhook);
      await saveDiscordWebhook(safeWebhook);
      setSmtp((prev) => ({ ...prev, discordWebhook: safeWebhook }));
      await loadDiscordAiStatus();
      setSmtpMsg({ type: 'success', text: res.message || 'Discord Testnachricht gesendet.' });
    } catch (err) {
      setSmtpMsg({ type: 'error', text: err.message });
    } finally {
      setDiscordTesting(false);
    }
  };

  const loadDiscordAiStatus = async () => {
    setDiscordAiStatusLoading(true);
    setDiscordAiStatusMsg(null);
    try {
      const data = await fetchDiscordAiStatus();
      setDiscordAiStatus(data);
    } catch (err) {
      setDiscordAiStatusMsg({ type: 'error', text: err.message || 'Discord-KI-Status konnte nicht geladen werden.' });
    } finally {
      setDiscordAiStatusLoading(false);
    }
  };

  const loadAppSettings = async () => {
    try {
      const data = await fetchAdminAppSettings();
      setEntryMode(data.entryMode === 'manual' ? 'manual' : 'ai');
    } catch (err) {
      setEntryModeMsg({ type: 'error', text: err.message || 'App-Einstellungen konnten nicht geladen werden.' });
    }
  };

  const handleEntryModeSave = async (nextMode) => {
    const safeMode = nextMode === 'manual' ? 'manual' : 'ai';
    setEntryMode(safeMode);
    setEntryModeSaving(true);
    setEntryModeMsg(null);
    try {
      const result = await saveAdminAppSettings({ entryMode: safeMode });
      setEntryMode(result.settings?.entryMode === 'manual' ? 'manual' : 'ai');
      setEntryModeMsg({ type: 'success', text: 'Eingabeart gespeichert.' });
    } catch (err) {
      setEntryModeMsg({ type: 'error', text: err.message || 'Eingabeart konnte nicht gespeichert werden.' });
    } finally {
      setEntryModeSaving(false);
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

  const loadChatStats = async () => {
    setChatStatsLoading(true);
    setChatStatsMsg(null);
    try {
      const data = await fetchAdminChatStats();
      setChatStats({
        users: Array.isArray(data.users) ? data.users : [],
        totals: data.totals || {},
      });
    } catch (err) {
      setChatStatsMsg({ type: 'error', text: 'Fehler beim Laden der Chat-Statistik: ' + err.message });
    } finally {
      setChatStatsLoading(false);
    }
  };

  const loadAdminActivity = async () => {
    setAdminActivityLoading(true);
    setAdminActivityMsg(null);
    try {
      const data = await fetchAdminActivity();
      setAdminActivity({
        totals: data.totals || {},
        recentLogins: Array.isArray(data.recentLogins) ? data.recentLogins : [],
        topDrinks: Array.isArray(data.topDrinks) ? data.topDrinks : [],
        usersOverLimit: Array.isArray(data.usersOverLimit) ? data.usersOverLimit : [],
        recentLogs: Array.isArray(data.recentLogs) ? data.recentLogs : [],
      });
    } catch (err) {
      setAdminActivityMsg({ type: 'error', text: 'Fehler beim Laden der Aktivität: ' + err.message });
    } finally {
      setAdminActivityLoading(false);
    }
  };

  const loadApiTests = async () => {
    setApiTestsLoading(true);
    setApiTestsMsg(null);
    try {
      const data = await fetchAdminApiTests();
      setApiTests({
        ...data,
        tests: Array.isArray(data.tests) ? data.tests : [],
        total: Number(data.total || 0),
      });
      if (data.warning) setApiTestsMsg({ type: 'error', text: data.warning });
    } catch (err) {
      setApiTestsMsg({ type: 'error', text: 'Fehler beim Laden der API-Testanzeige: ' + err.message });
    } finally {
      setApiTestsLoading(false);
    }
  };

  const loadAdminExportData = () => fetchAdminExportLogs({
    start: exportStart,
    end: exportEnd,
    email: exportEmail.trim(),
  });

  const handleAdminCsvExport = async () => {
    setExportLoading(true);
    setExportMsg(null);
    try {
      const data = await loadAdminExportData();
      const items = Array.isArray(data.items) ? data.items : [];
      const summary = data.summary || { start: exportStart, end: exportEnd, logCount: items.length, totalCaffeine: 0, totalSize: 0 };
      downloadFile(buildAdminCsv(items), `koffein-admin-${summary.start}-${summary.end}.csv`, 'text/csv;charset=utf-8;');
      setExportMsg({ type: 'success', text: `${summary.logCount} Einträge exportiert.` });
    } catch (err) {
      setExportMsg({ type: 'error', text: err.message });
    } finally {
      setExportLoading(false);
    }
  };

  const handleAdminPdfExport = async () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setExportMsg({ type: 'error', text: 'Popup blockiert. Bitte Popups für diese Seite erlauben.' });
      return;
    }

    setExportLoading(true);
    setExportMsg(null);
    printWindow.document.write('<p style="font-family:Arial;padding:24px">Export wird vorbereitet...</p>');
    try {
      const data = await loadAdminExportData();
      const items = Array.isArray(data.items) ? data.items : [];
      const summary = data.summary || { start: exportStart, end: exportEnd, logCount: items.length, totalCaffeine: 0, totalSize: 0 };
      printWindow.document.open();
      printWindow.document.write(renderAdminPrintableHtml({ items, summary }));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      setExportMsg({ type: 'success', text: `${summary.logCount} Einträge für PDF vorbereitet.` });
    } catch (err) {
      printWindow.close();
      setExportMsg({ type: 'error', text: err.message });
    } finally {
      setExportLoading(false);
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

  const apiTestCategories = useMemo(() => {
    const counts = {};
    (apiTests.tests || []).forEach((testCase) => {
      const category = testCase.category || 'API';
      counts[category] = (counts[category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [apiTests.tests]);

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
  
  const handleEditSave = async () => {
    if (!editingLog) return;
    setEditLogSaving(true);
    try {
      await adminUpdateLog(editingLog.id, editLogData);
      setAllLogs(prev => prev.map(l => l.id === editingLog.id ? { ...l, ...editLogData } : l));
      setEditingLog(null);
    } catch (err) {
      console.error(err);
    } finally {
      setEditLogSaving(false);
    }
  };
  const setEditLogField = (field, value) => setEditLogData((prev) => ({ ...prev, [field]: value }));
  
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
              <h1 className="font-bold text-white leading-tight">Drink Tracker Admin</h1>
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
            { id: 'chat',      label: 'KI-Chat',    icon: MessageCircle },
            { id: 'activity',  label: 'Aktivität',  icon: Activity   },
            { id: 'tests',     label: 'API-Tests',  icon: FileText   },
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

            {/* System Actions */}


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
                  const k = l.name || 'Unbekannt';
                  counts[k] = (counts[k] || 0) + 1;
                });
                return Object.entries(counts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center gap-3 py-2">
                      <div className="flex-1 text-sm text-white truncate">{name}</div>
                      <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                          style={{ width: `${(count / allLogs.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-12 text-right">{count}×</span>
                    </div>
                  ));
              })()}
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• LOGS TAB â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'logs' && (
          <div className="animate-fade-in pb-10 space-y-4">

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suche nach Name oder Datum…"
                  className="input-dark pl-10"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadAllLogs}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card
                    text-slate-300 hover:text-white text-sm transition-all
                    disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Aktualisieren</span>
                </button>
                <button
                  onClick={exportCSV}
                  disabled={isLoading || allLogs.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                    bg-green-600/20 border border-green-500/30 text-green-400
                    hover:bg-green-600/30 text-sm transition-all disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">CSV Export</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 shimmer rounded-xl" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Keine Einträge gefunden.</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_auto] gap-4 px-5 py-3
                    border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <button onClick={() => toggleSort('name')} className="text-left hover:text-slate-300 transition-colors">
                      Name <SortIcon field="name" />
                    </button>
                    <button onClick={() => toggleSort('caffeine')} className="text-left hover:text-slate-300 transition-colors">
                      Koffein <SortIcon field="caffeine" />
                    </button>
                    <span>Größe</span>
                    <button onClick={() => toggleSort('date')} className="text-left hover:text-slate-300 transition-colors">
                      Datum <SortIcon field="date" />
                    </button>
                    <button onClick={() => toggleSort('createdAt')} className="text-left hover:text-slate-300 transition-colors">
                      Erstellt <SortIcon field="createdAt" />
                    </button>
                    <span className="text-right">Aktion</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                    {filteredLogs.map((log) => (
                      <div key={log.id}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_auto] gap-4 px-5 py-3.5
                          hover:bg-white/5 transition-colors items-center text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg shrink-0">{log.icon || '🥤'}</span>
                          <span className="text-white font-medium truncate">{log.name}</span>
                        </div>
                        <span className="text-blue-400 font-semibold">{log.caffeine} mg</span>
                        <span className="text-slate-400">{log.size} ml</span>
                        <span className="text-slate-400">{log.date || '–'}</span>
                        <span className="text-slate-500 text-xs">{formatDate(log.createdAt)}</span>
                        
                        <button
                          onClick={() => {
                            setEditingLog(log);
                            setEditLogData({ name: log.name, size: log.size, caffeine: log.caffeine, icon: log.icon });
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10
                            transition-all"
                          aria-label="Bearbeiten"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deleting === log.id}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10
                            transition-all disabled:opacity-50 ml-auto"
                          aria-label="Löschen"
                        >
                          {deleting === log.id
                            ? <Spinner className="w-4 h-4 border-2 border-red-400/30 border-t-red-400" block />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="px-5 py-3 border-t border-white/10 text-xs text-slate-600">
                    {filteredLogs.length} von {allLogs.length} Einträgen
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• USERS TAB â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'users' && (
          <div className="animate-fade-in pb-10 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Registrierte Benutzer
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowCreateUser(true); setUsersMsg(null); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl
                    bg-blue-600/20 border border-blue-500/30 text-blue-300
                    hover:bg-blue-600/30 text-sm transition-all">
                  <UserCheck className="w-4 h-4" />
                  Benutzer erstellen
                </button>
                <button onClick={loadRegUsers} disabled={usersLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card
                    text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
                  Aktualisieren
                </button>
              </div>
            </div>

            {/* â”€â”€ Create User Modal â”€â”€ */}
            {showCreateUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.7)' }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowCreateUser(false); }}>
                <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-5 animate-slide-in">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-400" />
                    Neuen Benutzer erstellen
                  </h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <Field label="Name" type="text" required value={createForm.name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Max Mustermann" inputClass="pl-0" />
                    <Field label="E-Mail" icon={Mail} type="email" required value={createForm.email}
                      onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="user@example.com" />
                    <Field label="Passwort / App-Token" icon={Lock} type={showCreatePw ? 'text' : 'password'} required minLength={8}
                      value={createForm.password}
                      onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Min. 8 Zeichen">
                      <button type="button" onClick={() => setShowCreatePw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showCreatePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </Field>
                    {/* Role */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rolle</label>
                      <div className="flex gap-2">
                        {[{ value: 'user', label: 'Benutzer', icon: Zap }, { value: 'admin', label: 'Admin', icon: Shield }].map(({ value, label, icon: Icon }) => (
                          <button key={value} type="button"
                            onClick={() => setCreateForm((p) => ({ ...p, role: value }))}
                            className={`flex items-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                              ${createForm.role === value
                                ? value === 'admin'
                                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                                  : 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}>
                            <Icon className="w-4 h-4 mx-auto" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Verified toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="text-sm text-white font-medium">Sofort verifizieren</p>
                        <p className="text-xs text-slate-500">Benutzer kann sich direkt anmelden</p>
                      </div>
                      <ToggleSwitch checked={createForm.verified} onClick={() => setCreateForm((p) => ({ ...p, verified: !p.verified }))} />
                    </div>
                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setShowCreateUser(false)}
                        className="flex-1 py-2.5 rounded-xl text-slate-400 bg-white/5
                          border border-white/10 hover:bg-white/10 transition-all text-sm font-medium">
                        Abbrechen
                      </button>
                      <button type="submit" disabled={createUserLoading}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-white
                          bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                          disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                        {createUserLoading
                          ? <Spinner />
                          : <UserCheck className="w-4 h-4" />}
                        Erstellen
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <MessageBox message={usersMsg} />

            <div className="glass-card rounded-2xl overflow-hidden">
              {usersLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 shimmer rounded-xl" />)}
                </div>
              ) : regUsers.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Noch keine registrierten Benutzer.</p>
                  <p className="text-xs mt-1 text-slate-600">
                    Konfiguriere SMTP und aktiviere die Registrierung im Tab "Einstellungen".
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3
                    border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <span>{'Name'}</span><span>{'E-Mail'}</span><span>Rolle</span><span>Status</span><span>Registriert</span>
                    <span className="text-right">Aktionen</span>
                  </div>
                  <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                    {regUsers.map((u) => (
                      (() => {
                        const isSelf = (session?.id && session.id === u.id) || (!session?.id && u.email === session?.email);
                        const isSelfAdminDemotionBlocked = isSelf && u.role === 'admin';
                        return (
                      <div key={u.id}
                        className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5
                          hover:bg-white/5 transition-colors items-center text-sm">
                        <span className="text-white font-medium truncate">{u.name}</span>
                        <span className="text-slate-400 truncate text-xs">{u.email}</span>
                        <span>
                          {u.role === 'admin'
                            ? <span className="flex items-center gap-1 text-xs text-amber-400">
                                <Shield className="w-3.5 h-3.5" />Admin
                              </span>
                            : <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Zap className="w-3.5 h-3.5" />Benutzer
                              </span>
                          }
                        </span>
                        <span>
                          {u.verified
                            ? <span className="flex items-center gap-1 text-xs text-green-400">
                                <CheckCircle className="w-3.5 h-3.5" />Aktiv
                              </span>
                            : <span className="flex items-center gap-1 text-xs text-amber-400">
                                <Clock className="w-3.5 h-3.5" />Ausstehend
                              </span>
                          }
                        </span>
                        <span className="text-slate-600 text-xs">{formatDate(u.createdAt)}</span>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => handleToggleRole(u.id, u.role)}
                            disabled={isSelfAdminDemotionBlocked}
                            className={`p-1.5 rounded-lg transition-all ${
                              isSelfAdminDemotionBlocked
                                ? 'text-slate-700 cursor-not-allowed'
                                : u.role === 'admin'
                                ? 'text-amber-400 hover:text-slate-400 hover:bg-white/5'
                                : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'
                            }`}
                            title={isSelfAdminDemotionBlocked
                              ? 'Eigenen Admin nicht herabstufen'
                              : u.role === 'admin' ? 'Zum Benutzer herabstufen' : 'Zum Admin befördern'}>
                            <Shield className="w-4 h-4" />
                          </button>
                          {!u.verified && (
                            <button onClick={() => handleVerifyUser(u.id)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-green-400
                                hover:bg-green-500/10 transition-all"
                              title="Manuell verifizieren">
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          {onImpersonate && (
                            <button
                              onClick={() => handleImpersonate(u)}
                              disabled={impersonatingId === u.id}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400
                                hover:bg-blue-500/10 transition-all disabled:opacity-50"
                              title={`Als ${u.name} anmelden`}>
                              {impersonatingId === u.id
                                ? <Spinner className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400" block />
                                : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                          <button onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400
                              hover:bg-red-500/10 transition-all"
                            title="Benutzer löschen">
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                        );
                      })()
                    ))}
                  </div>
                  <div className="px-5 py-3 border-t border-white/10 text-xs text-slate-600">
                    {regUsers.length} Benutzer
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• AI CHAT TAB â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'chat' && (
          <div className="animate-fade-in pb-10 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-violet-400" />
                KI-Chat Nachrichten
              </h2>
              <button onClick={loadChatStats} disabled={chatStatsLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card
                  text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${chatStatsLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
            </div>

            <MessageBox message={chatStatsMsg} onClose={() => setChatStatsMsg(null)} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Benutzer gesamt" value={chatStats.totals.users || 0} color="blue" />
              <StatCard icon={MessageCircle} label="Benutzer mit Chat" value={chatStats.totals.usersWithChat || 0} color="purple" />
              <StatCard icon={User} label="Nutzer-Nachrichten" value={chatStats.totals.userMessages || 0} color="green" />
              <StatCard icon={Bot} label="KI-Antworten" value={chatStats.totals.assistantMessages || 0} color="amber" />
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
              {chatStatsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 shimmer rounded-xl" />
                  ))}
                </div>
              ) : chatStats.users.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Noch keine Chatdaten vorhanden.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1.4fr] gap-3 px-5 py-3
                    border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <span>Benutzer</span>
                    <span>E-Mail</span>
                    <span>Nutzer</span>
                    <span>KI</span>
                    <span>Gesamt</span>
                    <span>Letzter Sync</span>
                  </div>
                  <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                    {chatStats.users.map((user) => {
                      const hasChat = Number(user.totalMessages || 0) > 0;
                      return (
                        <div key={user.ownerKey}
                          className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1.4fr] gap-3 px-5 py-3.5
                            hover:bg-white/5 transition-colors items-center text-sm">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-white font-medium min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${hasChat ? 'bg-green-400' : 'bg-slate-700'}`} />
                              <span className="truncate">{user.name || 'Unbekannt'}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              {user.role === 'admin' ? 'Admin' : 'Benutzer'}{user.registered ? '' : ' · nicht registriert'}
                            </div>
                          </div>
                          <span className="text-slate-400 truncate text-xs">{user.email || '–'}</span>
                          <span className="text-green-400 font-semibold">{user.userMessages || 0}</span>
                          <span className="text-violet-300 font-semibold">{user.assistantMessages || 0}</span>
                          <span className="text-blue-300 font-semibold">{user.totalMessages || 0}</span>
                          <span className="text-slate-500 text-xs">{user.updatedAt ? formatDate(user.updatedAt) : '–'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-5 py-3 border-t border-white/10 text-xs text-slate-600">
                    {chatStats.users.length} Benutzer · {chatStats.totals.totalMessages || 0} Nachrichten gesamt
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="animate-fade-in pb-10 space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-400" />
                Admin-Aktivität
              </h2>
              <button onClick={loadAdminActivity} disabled={adminActivityLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card
                  text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${adminActivityLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
            </div>

            <MessageBox message={adminActivityMsg} onClose={() => setAdminActivityMsg(null)} />

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Users} label="Benutzer" value={adminActivity.totals.registeredUsers || 0} color="blue" />
              <StatCard icon={Activity} label="Aktiv 7 Tage" value={adminActivity.totals.activeUsers7Days || 0} color="green" />
              <StatCard icon={Calendar} label="Logs heute" value={adminActivity.totals.logsToday || 0} color="purple" />
              <StatCard icon={Zap} label="Koffein heute" value={`${adminActivity.totals.caffeineToday || 0} mg`} color="amber" />
              <StatCard icon={AlertTriangle} label="Ueber Limit" value={adminActivity.totals.usersOverLimit || 0} color="red" />
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Zeitraum exportieren</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr_auto_auto] gap-3">
                <Field label="Von" type="date" value={exportStart} onChange={(e) => setExportStart(e.target.value)} inputClass="pl-0" />
                <Field label="Bis" type="date" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} inputClass="pl-0" />
                <Field label="Benutzer E-Mail optional" icon={Mail} type="email" value={exportEmail} onChange={(e) => setExportEmail(e.target.value)} placeholder="alle Benutzer" />
                <button onClick={handleAdminCsvExport} disabled={exportLoading}
                  className="self-end flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                    bg-green-600/20 border border-green-500/30 text-green-300
                    hover:bg-green-600/30 text-sm transition-all disabled:opacity-50">
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button onClick={handleAdminPdfExport} disabled={exportLoading}
                  className="self-end flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                    bg-blue-600/20 border border-blue-500/30 text-blue-300
                    hover:bg-blue-600/30 text-sm transition-all disabled:opacity-50">
                  <Printer className="w-4 h-4" />
                  PDF
                </button>
              </div>
              <MessageBox message={exportMsg} onClose={() => setExportMsg(null)} className="rounded-2xl p-3" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-amber-400" />
                  Meistgenutzte Getränke
                </h3>
                {adminActivityLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 shimmer rounded-xl" />)}</div>
                ) : adminActivity.topDrinks.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Daten vorhanden.</p>
                ) : (
                  <div className="space-y-3">
                    {adminActivity.topDrinks.map((drink) => {
                      const max = Math.max(1, ...adminActivity.topDrinks.map((item) => item.count || 0));
                      return (
                        <div key={drink.name} className="flex items-center gap-3">
                          <span className="text-sm text-white truncate flex-1">{drink.name}</span>
                          <div className="w-28 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-300" style={{ width: `${((drink.count || 0) / max) * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-10 text-right">{drink.count}x</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Benutzer über Limit
                </h3>
                {adminActivityLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 shimmer rounded-xl" />)}</div>
                ) : adminActivity.usersOverLimit.length === 0 ? (
                  <p className="text-sm text-slate-500">Heute ist niemand über Limit.</p>
                ) : (
                  <div className="space-y-2">
                    {adminActivity.usersOverLimit.map((user) => (
                      <div key={user.ownerKey} className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email || user.ownerKey}</p>
                        </div>
                        <span className="text-sm font-semibold text-red-300 shrink-0">+{user.overBy} mg</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-green-400" />
                  Letzte Logins
                </h3>
                {adminActivity.recentLogins.length === 0 ? (
                  <p className="text-sm text-slate-500">Noch keine Logins gespeichert.</p>
                ) : (
                  <div className="space-y-2">
                    {adminActivity.recentLogins.map((user) => (
                      <div key={user.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-white truncate">{user.name || user.email}</span>
                        <span className="text-xs text-slate-500 shrink-0">{formatDate(user.lastLogin)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  Neueste Einträge
                </h3>
                {adminActivity.recentLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine aktuellen Einträge.</p>
                ) : (
                  <div className="space-y-2">
                    {adminActivity.recentLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="text-white truncate">{log.name}</p>
                          <p className="text-xs text-slate-500 truncate">{log.owner?.email || log.email || 'unbekannt'}</p>
                        </div>
                        <span className="text-xs text-blue-300 shrink-0">{log.caffeine} mg</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* API TESTS TAB */}
        {activeTab === 'tests' && (
          <div className="animate-fade-in pb-10 space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                API-Testanzeige
              </h2>
              <button onClick={loadApiTests} disabled={apiTestsLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card
                  text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${apiTestsLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
            </div>

            <MessageBox message={apiTestsMsg} onClose={() => setApiTestsMsg(null)} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={CheckCircle} label="Testfälle" value={apiTests.total || 0} color="green" />
              <StatCard icon={FileText} label="Datei" value={apiTests.exists ? 'gefunden' : 'fehlt'} color={apiTests.exists ? 'blue' : 'red'} />
              <StatCard icon={Hash} label="Hash" value={apiTests.hash || '–'} color="purple" />
              <StatCard icon={Clock} label="Geändert" value={apiTests.updatedAt ? formatDate(apiTests.updatedAt) : '–'} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    Kategorien
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Übersicht der Testfälle aus {apiTests.file || 'tests/api.test.js'}.
                  </p>
                </div>

                {apiTestsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-10 shimmer rounded-xl" />)}
                  </div>
                ) : apiTestCategories.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine API-Tests gefunden.</p>
                ) : (
                  <div className="space-y-3">
                    {apiTestCategories.map((category) => {
                      const pct = apiTests.total > 0 ? (category.count / apiTests.total) * 100 : 0;
                      return (
                        <div key={category.name} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-white truncate">{category.name}</span>
                            <span className="text-xs text-slate-500 shrink-0">{category.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-xs text-slate-400 space-y-1">
                  <p>Datei: <span className="text-slate-200 font-mono">{apiTests.file || 'tests/api.test.js'}</span></p>
                  <p>Größe: <span className="text-slate-200">{apiTests.size ? formatBytes(apiTests.size) : '–'}</span></p>
                  <p className="break-all">Befehl: <span className="text-blue-300 font-mono">{apiTests.command || 'docker compose exec -T app node --test tests/api.test.js'}</span></p>
                </div>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                {apiTestsLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-12 shimmer rounded-xl" />
                    ))}
                  </div>
                ) : apiTests.tests.length === 0 ? (
                  <div className="py-16 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Keine Testfälle in api.test.js erkannt.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-3 px-5 py-3
                      border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span>#</span>
                      <span>Testfall</span>
                      <span>Kategorie</span>
                    </div>
                    <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                      {apiTests.tests.map((testCase) => (
                        <div key={testCase.id}
                          className="grid grid-cols-[auto_1fr_1fr] gap-3 px-5 py-3.5
                            hover:bg-white/5 transition-colors items-center text-sm">
                          <span className="text-slate-600 font-mono">{testCase.id}</span>
                          <span className="text-white font-medium min-w-0">{testCase.name}</span>
                          <span className="text-blue-300 text-xs truncate">{testCase.category || 'API'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-white/10 text-xs text-slate-600">
                      {apiTests.tests.length} Testfälle aus {apiTests.file || 'tests/api.test.js'}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• SETTINGS TAB â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in pb-10 space-y-6 max-w-6xl">



            {/* SMTP config card */}
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                SMTP-Server Konfiguration
              </h2>

              {/* Host + Port */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                <Field label="Server-Host" icon={Server} type="text" value={smtp.host}
                  onChange={(e) => handleSmtpChange('host', e.target.value)} placeholder="smtp.gmail.com" />
                <Field label="Port" icon={Hash} type="number" value={smtp.port} min="1" max="65535"
                  onChange={(e) => handleSmtpChange('port', Number(e.target.value))} className="w-24" />
              </div>

              {/* Security */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Verbindungssicherheit
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'Unverschlüsselt', secure: false, port: 25  },
                    { label: 'STARTTLS',         secure: false, port: 587 },
                    { label: 'SSL/TLS',          secure: true,  port: 465 },
                  ].map((opt) => (
                    <button key={opt.label} type="button"
                      onClick={() => { handleSmtpChange('secure', opt.secure); handleSmtpChange('port', opt.port); }}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all
                        ${smtp.secure === opt.secure && smtp.port === opt.port
                          ? 'bg-blue-600 text-white shadow-glow-blue'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                        }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auth */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Benutzername" icon={Mail} type="email" value={smtp.auth.user}
                  onChange={(e) => handleSmtpChange('auth.user', e.target.value)} placeholder="user@gmail.com" />
                <Field label="Passwort / App-Token" icon={Lock} type={showSmtpPw ? 'text' : 'password'} value={smtp.auth.pass}
                  onChange={(e) => handleSmtpChange('auth.pass', e.target.value)} placeholder="••••••••">
                  <button type="button" onClick={() => setShowSmtpPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showSmtpPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </Field>
              </div>

              {/* From name + email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Absender-Name" icon={User} type="text" value={smtp.fromName}
                  onChange={(e) => handleSmtpChange('fromName', e.target.value)} placeholder="Koffein-Tracker" />
                <Field label="Absender-E-Mail" icon={Mail} type="email" value={smtp.fromEmail}
                  onChange={(e) => handleSmtpChange('fromEmail', e.target.value)} placeholder="noreply@deine-domain.de" />
              </div>

              {/* Base URL */}
              <Field
                label={<>App-URL <span className="normal-case font-normal text-slate-600">(für Bestätigungslinks in E-Mails)</span></>}
                icon={Link}
                type="url"
                value={smtp.baseUrl}
                onChange={(e) => handleSmtpChange('baseUrl', e.target.value)}
                placeholder="https://deine-app.de"
              />

              {/* Save button */}
              <button onClick={handleSmtpSave} disabled={smtpSaving}
                className="w-full py-3 rounded-xl font-semibold text-white
                  bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                  disabled:opacity-60 transition-all shadow-glow-blue flex items-center justify-center gap-2">
                {smtpSaving
                  ? <Spinner />
                  : <Server className="w-4 h-4" />}
                Einstellungen speichern
              </button>
            </div>


            {/* Registration toggle card */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-400" />
                    Benutzer-Registrierung
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Erlaubt neuen Benutzern, sich selbst zu registrieren.
                  </p>
                </div>
                <ToggleSwitch checked={smtp.registrationEnabled} onClick={() => handleSmtpChange('registrationEnabled', !smtp.registrationEnabled)} />
              </div>
            </div>

            {/* Demo access toggle card */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Demo-Zugang
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Zeigt Demo-Login-Buttons auf der Anmeldeseite (Admin + Benutzer).
                  </p>
                </div>
                <ToggleSwitch checked={smtp.demoEnabled !== false} onColor="bg-amber-500" onClick={() => handleSmtpChange('demoEnabled', !smtp.demoEnabled)} />
              </div>
            </div>

            {/* Test email card */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                SMTP-Verbindung testen
              </h3>
              <p className="text-xs text-slate-500">
                Sendet eine Test-E-Mail um die Konfiguration zu prüfen. Speichere zuerst deine Einstellungen.
              </p>
              <div className="flex gap-2">
                <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com" className="input-dark flex-1" />
                <button onClick={handleSmtpTest} disabled={smtpTesting || !testEmail.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                    bg-amber-500/20 border border-amber-500/30 text-amber-300
                    hover:bg-amber-500/30 transition-all text-sm disabled:opacity-50 shrink-0">
                  {smtpTesting
                    ? <Spinner className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400" />
                    : <Send className="w-4 h-4" />}
                  Test senden
                </button>
              </div>
            </div>

            {/* Discord bot webhook card */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-indigo-400" />
                Discord KI-Bot Webhook
              </h3>
              <p className="text-xs text-slate-500">
                Hinterlege hier den Discord Webhook, über den der KI-Bot geplante Nachrichten sowie Meldungen zu hinzugefügten oder gelöschten Einträgen sendet.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="url" value={smtp.discordWebhook || ''} onChange={(e) => setSmtp({ ...smtp, discordWebhook: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..." className="input-dark flex-1" />
                <button onClick={handleDiscordWebhookSave} disabled={discordSaving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                    bg-green-500/20 border border-green-500/30 text-green-300
                    hover:bg-green-500/30 transition-all text-sm disabled:opacity-50 shrink-0 justify-center">
                  {discordSaving
                    ? <Spinner className="w-4 h-4 border-2 border-green-400/30 border-t-green-400" />
                    : <CheckCircle className="w-4 h-4" />}
                  Webhook speichern
                </button>
                <button onClick={handleDiscordTest} disabled={discordTesting || !smtp.discordWebhook?.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                    bg-indigo-500/20 border border-indigo-500/30 text-indigo-300
                    hover:bg-indigo-500/30 transition-all text-sm disabled:opacity-50 shrink-0 justify-center">
                  {discordTesting
                    ? <Spinner className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400" />
                    : <MessageCircle className="w-4 h-4" />}
                  Test senden
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-400" />
                    Discord KI-Bot Status
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Der Scheduler startet automatisch mit dem Server und sendet fällige KI-Nachrichten über den gespeicherten Webhook.
                  </p>
                </div>
                <button onClick={loadDiscordAiStatus} disabled={discordAiStatusLoading}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs
                    bg-white/5 border border-white/10 text-slate-300
                    hover:bg-white/10 transition-all disabled:opacity-50">
                  {discordAiStatusLoading
                    ? <Spinner className="w-3 h-3 border-2 border-slate-400/30 border-t-slate-400" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                  Aktualisieren
                </button>
              </div>

              <MessageBox message={discordAiStatusMsg} onClose={() => setDiscordAiStatusMsg(null)} className="rounded-xl p-3" />

              {discordAiStatus && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className={`rounded-xl px-3 py-2.5 border ${discordAiStatus.running ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                      <p className="text-slate-500 mb-1">Bot</p>
                      <p className="font-semibold">{discordAiStatus.running ? 'läuft' : 'gestoppt'}</p>
                    </div>
                    <div className={`rounded-xl px-3 py-2.5 border ${discordAiStatus.webhookConfigured ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                      <p className="text-slate-500 mb-1">Webhook</p>
                      <p className="font-semibold">{discordAiStatus.webhookConfigured ? 'konfiguriert' : 'fehlt'}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2.5 border border-white/10 bg-white/5">
                      <p className="text-slate-500 mb-1">Offen</p>
                      <p className="font-semibold text-white">{discordAiStatus.counts?.pending || 0}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2.5 border border-white/10 bg-white/5">
                      <p className="text-slate-500 mb-1">Gesendet / Fehler</p>
                      <p className="font-semibold text-white">{discordAiStatus.counts?.sent || 0} / {discordAiStatus.counts?.failed || 0}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-xs text-slate-400 space-y-1">
                    <p>Gestartet: <span className="text-slate-200">{discordAiStatus.startedAt ? formatDate(discordAiStatus.startedAt) : '–'}</span></p>
                    <p>Letzter Check: <span className="text-slate-200">{discordAiStatus.lastTickAt ? formatDate(discordAiStatus.lastTickAt) : '–'}</span></p>
                    <p>Nächste Nachricht: <span className="text-slate-200">{discordAiStatus.nextSchedule?.runAt ? formatDate(discordAiStatus.nextSchedule.runAt) : '–'}</span></p>
                    {discordAiStatus.lastError && (
                      <p className="text-red-300">Letzter Fehler: {discordAiStatus.lastError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  Eingabeart der App
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Legt fest, welches Fenster Benutzer zum Hinzufügen von Getränken zuerst sehen.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'ai', label: 'AI Chatfenster', icon: Bot, color: 'violet' },
                  { id: 'manual', label: 'Manuell hinzufügen', icon: Coffee, color: 'emerald' },
                ].map(({ id, label, icon: Icon, color }) => {
                  const active = entryMode === id;
                  const activeClass = color === 'emerald'
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                    : 'border-violet-400/50 bg-violet-500/15 text-violet-100';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleEntryModeSave(id)}
                      disabled={entryModeSaving}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all disabled:opacity-60
                        ${active ? activeClass : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="font-semibold text-sm">{label}</span>
                      {active && <CheckCircle className="w-4 h-4 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <MessageBox message={entryModeMsg} onClose={() => setEntryModeMsg(null)} className="rounded-xl p-3" />
            </div>

            {/* AI / OpenRouter settings card */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-400" />
                KI-Assistent (OpenRouter)
              </h3>
              <p className="text-xs text-slate-500">
                API-Key von <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-violet-400 underline">openrouter.ai</a> eingeben, um KI-Funktionen zu aktivieren.
                {aiKeyMasked && <span className="ml-1 text-slate-400">Aktueller Key: <span className="font-mono text-xs text-violet-300">{aiKeyMasked}</span></span>}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">API-Key</label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={aiKeyMasked ? 'Neuen Key eingeben zum Überschreiben…' : 'sk-or-v1-…'}
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Modell</label>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="deepseek/deepseek-v3"
                    className="input-dark font-mono text-sm"
                  />
                  <p className="text-xs text-slate-600 mt-1">z.B. google/gemini-2.0-flash-001, openai/gpt-4o-mini, meta-llama/llama-3.1-8b-instruct:free</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Brave Search API-Token
                  </label>
                  <input
                    type="password"
                    value={braveSearchKey}
                    onChange={(e) => setBraveSearchKey(e.target.value)}
                    placeholder={braveKeyMasked ? 'Neuen Token eingeben zum Überschreiben…' : 'BSA…'}
                    className="input-dark"
                  />
                  {braveKeyMasked && (
                    <p className="text-xs text-slate-500 mt-1">
                      Aktueller Token: <span className="font-mono text-orange-300">{braveKeyMasked}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-600 mt-1">
                    Optionaler <a href="https://brave.com/search/api/" target="_blank" rel="noreferrer" className="text-orange-400 underline">Brave Search API</a>-Token. Wenn gesetzt, wird Brave Search statt OpenFoodFacts für die KI-Getränkeerkennung verwendet.
                  </p>
                </div>
              </div>
              <button onClick={handleSaveAi} disabled={aiSaving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                  bg-violet-500/20 border border-violet-500/30 text-violet-300
                  hover:bg-violet-500/30 transition-all text-sm disabled:opacity-50">
                {aiSaving
                  ? <Spinner className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400" />
                  : <Bot className="w-4 h-4" />}
                Speichern
              </button>
              <MessageBox message={aiMsg} onClose={() => setAiMsg(null)} className="rounded-xl p-3" />
            </div>

            {/* Redis Health card */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-green-400" />
                  Redis Datenpersistenz
                </h3>
                <button
                  onClick={handleRedisCheck}
                  disabled={redisChecking}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs
                    bg-white/5 border border-white/10 text-slate-300
                    hover:bg-white/10 transition-all disabled:opacity-50">
                  {redisChecking
                    ? <Spinner className="w-3 h-3 border-2 border-slate-400/30 border-t-slate-400" />
                    : <RefreshCw className="w-3 h-3" />}
                  Prüfen
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Prüft ob Redis erreichbar ist, wie viele Einträge pro Datenschlüssel gespeichert sind
                und wann zuletzt ein Snapshot gesichert wurde.
              </p>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Datenbank Backup</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Exportiert oder importiert alle Redis-Daten als .db-Datei. Import ersetzt den aktuellen Datenbestand.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleDatabaseExport}
                      disabled={dbBackupLoading || dbImportLoading}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs
                        bg-green-600/20 border border-green-500/30 text-green-300
                        hover:bg-green-600/30 transition-all disabled:opacity-50"
                    >
                      {dbBackupLoading
                        ? <Spinner className="w-3 h-3 border-2 border-green-400/30 border-t-green-400" />
                        : <Download className="w-3.5 h-3.5" />}
                      Export
                    </button>
                    <label className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs
                      bg-amber-600/20 border border-amber-500/30 text-amber-300
                      hover:bg-amber-600/30 transition-all cursor-pointer
                      ${dbBackupLoading || dbImportLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {dbImportLoading
                        ? <Spinner className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400" />
                        : <Upload className="w-3.5 h-3.5" />}
                      Import
                      <input
                        type="file"
                        accept=".db,application/json,.json"
                        className="hidden"
                        onChange={handleDatabaseImport}
                        disabled={dbBackupLoading || dbImportLoading}
                      />
                    </label>
                  </div>
                </div>
                <MessageBox message={dbBackupMsg} onClose={() => setDbBackupMsg(null)} className="rounded-xl p-3" />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-sky-300" />
                      S3 Backup und Restore
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Sichert die .db-Datei in einen S3-kompatiblen Bucket und kann sie auf einer neuen Instanz wiederherstellen.
                    </p>
                    {s3Status && (
                      <p className="text-[11px] text-slate-500 mt-2 font-mono break-all">
                        {s3Status.configured
                          ? `${s3Status.bucket}/${s3Status.prefix || ''}`
                          : 'Nicht konfiguriert: S3_BUCKET, S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY setzen.'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={loadS3Backups}
                      disabled={s3Loading || s3ActionLoading}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs
                        bg-white/5 border border-white/10 text-slate-300
                        hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      {s3Loading
                        ? <Spinner className="w-3 h-3 border-2 border-slate-400/30 border-t-slate-400" />
                        : <RefreshCw className="w-3.5 h-3.5" />}
                      Aktualisieren
                    </button>
                    <button
                      type="button"
                      onClick={handleS3Backup}
                      disabled={s3ActionLoading || s3Loading || !s3Status?.configured}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs
                        bg-sky-600/20 border border-sky-500/30 text-sky-300
                        hover:bg-sky-600/30 transition-all disabled:opacity-50"
                    >
                      {s3ActionLoading
                        ? <Spinner className="w-3 h-3 border-2 border-sky-400/30 border-t-sky-400" />
                        : <Upload className="w-3.5 h-3.5" />}
                      Nach S3 sichern
                    </button>
                  </div>
                </div>

                <MessageBox message={s3Msg} onClose={() => setS3Msg(null)} className="rounded-xl p-3" />

                {s3Status?.configured && (
                  <div className="rounded-xl border border-white/8 overflow-hidden text-xs">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] px-3 py-2 bg-white/5 text-slate-500 font-semibold uppercase tracking-wider">
                      <span>Backup</span>
                      <span className="text-right">Aktion</span>
                    </div>
                    {s3Backups.length === 0 ? (
                      <div className="px-3 py-3 text-slate-500">Noch keine S3-Backups vorhanden.</div>
                    ) : (
                      s3Backups.slice(0, 12).map((backup) => (
                        <div key={backup.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 border-t border-white/5">
                          <div className="min-w-0">
                            <p className="text-slate-200 truncate font-mono">{backup.filename || backup.key}</p>
                            <p className="text-slate-500 mt-0.5">
                              {backup.lastModified ? formatDate(backup.lastModified) : 'Datum unbekannt'} · {formatBytes(backup.size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleS3Restore(backup.key)}
                            disabled={s3ActionLoading || s3Loading}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
                              bg-amber-600/20 border border-amber-500/30 text-amber-300
                              hover:bg-amber-600/30 transition-all disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Restore
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {redisError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {redisError}
                </div>
              )}
              {redisHealth && !redisError && (
                <div className="space-y-3">
                  {/* Status row */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium
                    ${redisHealth.connected
                      ? 'bg-green-500/10 border-green-500/30 text-green-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                    {redisHealth.connected
                      ? <CheckCircle className="w-4 h-4 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {redisHealth.connected ? 'Redis verbunden und erreichbar' : 'Redis nicht erreichbar'}
                  </div>
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 rounded-xl px-3 py-2.5 border border-white/8">
                      <p className="text-slate-500 mb-1">Persistenz-Modus</p>
                      <p className="text-white font-mono">{redisHealth.persistMode}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl px-3 py-2.5 border border-white/8">
                      <p className="text-slate-500 mb-1">Letzter Snapshot</p>
                      <p className="text-white">
                        {redisHealth.lastSave
                          ? new Date(redisHealth.lastSave).toLocaleString('de-DE')
                          : '–'}
                      </p>
                    </div>
                  </div>
                  {/* Keys table */}
                  {Object.keys(redisHealth.keys).length > 0 && (
                    <div className="rounded-xl border border-white/8 overflow-hidden text-xs">
                      <div className="grid grid-cols-[1fr_auto] px-3 py-2 bg-white/5
                        text-slate-500 font-semibold uppercase tracking-wider">
                        <span>Schlüssel</span>
                        <span className="text-right">Einträge</span>
                      </div>
                      {Object.entries(redisHealth.keys).map(([key, info]) => (
                        <div key={key} className="grid grid-cols-[1fr_auto] px-3 py-2.5
                          border-t border-white/5 hover:bg-white/5 transition-colors">
                          <span className="text-slate-300 font-mono">{key}</span>
                          <span className={`text-right font-semibold
                            ${info.count > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                            {info.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Feedback message */}
            <MessageBox message={smtpMsg} iconSize="w-5 h-5" onClose={() => setSmtpMsg(null)} className="glass-card rounded-2xl p-4 gap-3" />
          </div>
        )}

      {/* Edit Log Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-up">
            <h3 className="text-xl font-bold text-white mb-6">Log bearbeiten</h3>
            <div className="space-y-4">
              <Field label="Name" type="text" value={editLogData.name} onChange={(e) => setEditLogField('name', e.target.value)} inputClass="w-full pl-0" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Größe (ml)" type="number" value={editLogData.size} onChange={(e) => setEditLogField('size', e.target.value)} inputClass="w-full pl-0" />
                <Field label="Koffein (mg)" type="number" value={editLogData.caffeine} onChange={(e) => setEditLogField('caffeine', e.target.value)} inputClass="w-full pl-0" />
              </div>
              <Field label="Icon (Emoji)" type="text" value={editLogData.icon} onChange={(e) => setEditLogField('icon', e.target.value)} inputClass="w-full pl-0" maxLength={2} />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setEditingLog(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">Abbrechen</button>
              <button onClick={handleEditSave} disabled={editLogSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all text-sm shadow-glow-blue disabled:opacity-50">
                {editLogSaving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default AdminPanel;
