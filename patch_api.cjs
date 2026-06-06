const fs = require('fs');

// --- Patch api.js ---
let api = fs.readFileSync('src/services/api.js', 'utf8');

if (!api.includes('export const updateLog =')) {
  const updateFns = `
export const updateLog = async (id, data) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const res = await fetch(\`\${API_BASE}/api/logs/\${id}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Fehler beim Aktualisieren des Logs');
  return res.json();
};

export const adminUpdateLog = async (id, data) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const res = await fetch(\`\${API_BASE}/api/admin/logs/\${id}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Fehler beim Aktualisieren');
  return res.json();
};

export const adminDeleteLog = async (id) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const res = await fetch(\`\${API_BASE}/api/admin/logs/\${id}\`, {
    method: 'DELETE',
    headers: { Authorization: \`Bearer \${token}\` },
  });
  if (!res.ok) throw new Error('Fehler beim Löschen');
  return res.json();
};
`;
  api = api + '\n' + updateFns;
  fs.writeFileSync('src/services/api.js', api);
  console.log('api.js updated');
}

// --- Patch server.js ---
let server = fs.readFileSync('server.js', 'utf8');

// Add user updateLog
if (!server.includes('app.put(\'/api/logs/:id\'')) {
  const userPut = `
app.put('/api/logs/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, size, caffeine, icon } = req.body;
    const logIndex = dbState.caffeine_logs.findIndex(l => l.id === id && l.userId === req.user.email);
    if (logIndex === -1) return res.status(404).json({ error: 'Log nicht gefunden' });
    
    if (name) dbState.caffeine_logs[logIndex].name = name;
    if (size) dbState.caffeine_logs[logIndex].size = Number(size);
    if (caffeine) dbState.caffeine_logs[logIndex].caffeine = Number(caffeine);
    if (icon) dbState.caffeine_logs[logIndex].icon = icon;
    
    await persistDbState();
    res.json(dbState.caffeine_logs[logIndex]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;
  server = server.replace('app.delete(\'/api/logs/:id\'', userPut + '\napp.delete(\'/api/logs/:id\'');
}

// Add admin update/delete log
if (!server.includes('app.put(\'/api/admin/logs/:id\'')) {
  const adminLogOps = `
app.put('/api/admin/logs/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, size, caffeine, icon } = req.body;
    const logIndex = dbState.caffeine_logs.findIndex(l => l.id === id);
    if (logIndex === -1) return res.status(404).json({ error: 'Log nicht gefunden' });
    
    if (name) dbState.caffeine_logs[logIndex].name = name;
    if (size) dbState.caffeine_logs[logIndex].size = Number(size);
    if (caffeine) dbState.caffeine_logs[logIndex].caffeine = Number(caffeine);
    if (icon) dbState.caffeine_logs[logIndex].icon = icon;
    
    await persistDbState();
    res.json(dbState.caffeine_logs[logIndex]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/logs/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const initialLen = dbState.caffeine_logs.length;
    dbState.caffeine_logs = dbState.caffeine_logs.filter(l => l.id !== id);
    if (dbState.caffeine_logs.length === initialLen) return res.status(404).json({ error: 'Log nicht gefunden' });
    
    await persistDbState();
    res.json({ message: 'Log gelöscht' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;
  server = server.replace('app.get(\'/api/admin/logs\'', adminLogOps + '\napp.get(\'/api/admin/logs\'');
}

fs.writeFileSync('server.js', server);
console.log('server.js updated');
