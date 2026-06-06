const fs = require('fs');

let admin = fs.readFileSync('src/components/AdminPanel.jsx', 'utf8');

// Add edit modal state
if (!admin.includes('const [editingLog, setEditingLog] = useState(null);')) {
  admin = admin.replace(
    'const [deleting, setDeleting] = useState(null);',
    'const [deleting, setDeleting] = useState(null);\n  const [editingLog, setEditingLog] = useState(null);\n  const [editLogData, setEditLogData] = useState({ name: \'\', size: \'\', caffeine: \'\', icon: \'\' });\n  const [editLogSaving, setEditLogSaving] = useState(false);'
  );
}

// Add handleEditSave
if (!admin.includes('const handleEditSave = async () => {')) {
  const editSaveCode = `
  const handleEditSave = async () => {
    if (!editingLog) return;
    setEditLogSaving(true);
    try {
      const { adminUpdateLog } = await import('../services/api');
      await adminUpdateLog(editingLog.id, editLogData);
      setAllLogs(prev => prev.map(l => l.id === editingLog.id ? { ...l, ...editLogData } : l));
      setEditingLog(null);
    } catch (err) {
      console.error(err);
    } finally {
      setEditLogSaving(false);
    }
  };
  `;
  admin = admin.replace('const handleDelete = async (id) => {', editSaveCode + '\n  const handleDelete = async (id) => {');
}

// Add Edit button next to Trash2
const editButtonHtml = `
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
`;
if (!admin.includes('setEditingLog(log);')) {
  admin = admin.replace(
    '<button\n                          onClick={() => handleDelete(log.id)}',
    editButtonHtml + '\n                        <button\n                          onClick={() => handleDelete(log.id)}'
  );
}

// Add Edit Log Modal at the bottom
const editModalHtml = `
      {/* Edit Log Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-up">
            <h3 className="text-xl font-bold text-white mb-6">Log bearbeiten</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Name</label>
                <input type="text" value={editLogData.name} onChange={e => setEditLogData({...editLogData, name: e.target.value})} className="input-dark w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Größe (ml)</label>
                  <input type="number" value={editLogData.size} onChange={e => setEditLogData({...editLogData, size: e.target.value})} className="input-dark w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Koffein (mg)</label>
                  <input type="number" value={editLogData.caffeine} onChange={e => setEditLogData({...editLogData, caffeine: e.target.value})} className="input-dark w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Icon (Emoji)</label>
                <input type="text" value={editLogData.icon} onChange={e => setEditLogData({...editLogData, icon: e.target.value})} className="input-dark w-full" maxLength={2} />
              </div>
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
`;

if (!admin.includes('Edit Log Modal')) {
  admin = admin.replace(
    '    </div>\n  );\n}',
    editModalHtml + '\n    </div>\n  );\n}'
  );
}

fs.writeFileSync('src/components/AdminPanel.jsx', admin);
console.log('AdminPanel.jsx patched for editing logs');
