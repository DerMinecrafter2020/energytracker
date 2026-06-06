const fs = require('fs');
let s = fs.readFileSync('src/components/AdminPanel.jsx', 'utf8');

// 1. App name
s = s.replace(
  /<div>\s*<h1 className="font-bold text-white leading-tight">Admin-Panel<\/h1>\s*<p className="text-xs text-slate-500">Koffein-Tracker<\/p>\s*<\/div>/,
  \`<div>
    <h1 className="font-bold text-white leading-tight">Drink Tracker Admin</h1>
  </div>\`
);

// 2. Add System Actions (S3 & Update) in Overview or Settings.
// I'll add them at the top of the Overview tab, right before Stats grid.
const systemActions = \`
            {/* System Actions */}
            <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20">
              <div>
                <h2 className="font-semibold text-white text-lg">Systemverwaltung</h2>
                <p className="text-sm text-slate-400">Backups und Updates durchführen</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    try {
                      alert('Starte S3 Backup...');
                      const res = await fetch('/api/admin/backup/s3', { method: 'POST' });
                      const data = await res.json();
                      if (data.success) alert('Backup erfolgreich auf S3 hochgeladen.');
                      else alert('Fehler: ' + data.error);
                    } catch (e) {
                      alert('Fehler: ' + e.message);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                  <Database className="w-4 h-4" />
                  S3 Backup
                </button>
                <button
                  onClick={async () => {
                    try {
                      alert('Überprüfe auf Updates...');
                      const res = await fetch('/api/admin/update', { method: 'POST' });
                      const data = await res.json();
                      if (data.success) alert(data.message || 'Update erfolgreich.');
                      else alert('Fehler: ' + data.error);
                    } catch (e) {
                      alert('Fehler: ' + e.message);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Update
                </button>
              </div>
            </div>
\`;

s = s.replace(/\{\/\* Stats grid \*\/\}/, systemActions + '\\n            {/* Stats grid */}');

fs.writeFileSync('src/components/AdminPanel.jsx', s);
console.log('AdminPanel.jsx updated');
