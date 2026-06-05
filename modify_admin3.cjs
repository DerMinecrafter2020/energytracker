const fs = require('fs');
let content = fs.readFileSync('src/components/AdminPanel.jsx', 'utf8');

content = content.replace('Settings, Mail, Server, Lock, Eye, EyeOff, Send, MessageCircle,', 'Settings, Mail, Server, Lock, Eye, EyeOff, Send, MessageCircle, Globe,');
content = content.replace("import { fetchLogs, deleteLog as deleteApiLog } from '../services/api';", "import { fetchLogs, deleteLog as deleteApiLog, fetchTranslations, saveTranslations } from '../services/api';");

content = content.replace("{ id: 'settings',  label: 'Einstellungen', icon: Settings },", "{ id: 'settings',  label: 'Einstellungen', icon: Settings },\n            { id: 'translations', label: 'Sprachen', icon: Globe },");

const stateToAdd = `
  const [translationsJson, setTranslationsJson] = useState('');
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (activeTab === 'translations') {
      setLoadingTranslations(true);
      fetchTranslations().then(data => {
        setTranslationsJson(JSON.stringify(data, null, 2));
      }).catch(e => setError(e.message))
      .finally(() => setLoadingTranslations(false));
    }
  }, [activeTab]);

  const handleSaveTranslations = async () => {
    try {
      const parsed = JSON.parse(translationsJson);
      await saveTranslations(session, parsed);
      setMsg({ type: 'success', text: 'Übersetzungen erfolgreich gespeichert' });
    } catch(e) {
      setError('Ungültiges JSON oder Speicherfehler: ' + e.message);
    }
  };
`;
content = content.replace("const [activeTab, setActiveTab] = useState(initialActiveTab);", "const [activeTab, setActiveTab] = useState(initialActiveTab);\n" + stateToAdd);

const viewToAdd = `
        {activeTab === 'translations' && (
          <div className="glass-card p-6 rounded-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <Globe className="w-6 h-6 text-blue-400" />
              Sprachen & Übersetzungen bearbeiten
            </h3>
            
            {loadingTranslations ? (
              <p className="text-slate-400">Lade Übersetzungen...</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Hier kannst du die Übersetzungen im JSON-Format bearbeiten. 
                  Achte darauf, dass die Struktur (z.B. "de", "en") und die Keys erhalten bleiben.
                </p>
                <textarea
                  value={translationsJson}
                  onChange={(e) => setTranslationsJson(e.target.value)}
                  className="w-full h-[500px] bg-[#1a1c22] border border-white/10 rounded-xl p-4 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500/50"
                  spellCheck="false"
                />
                <button
                  onClick={handleSaveTranslations}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all"
                >
                  Übersetzungen speichern
                </button>
              </div>
            )}
            
            {msg && (
              <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300">
                {msg.text}
              </div>
            )}
          </div>
        )}
`;

content = content.replace("{/* ═══ SETTINGS TAB ═════════════════════════════════════ */}", viewToAdd + "\n        {/* ═══ SETTINGS TAB ═════════════════════════════════════ */}");

fs.writeFileSync('src/components/AdminPanel.jsx', content, 'utf8');
