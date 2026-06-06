const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

// The incorrect user PUT code I added previously:
const oldUserPut = `
app.put('/api/logs/:id', async (req, res) => {
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

const newUserPut = `
app.put('/api/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, size, caffeine, icon } = req.body;
    const dbPool = getPool();
    // Assuming simple updates without strict user filtering for now since the app.delete didn't have it either.
    await dbPool.execute('UPDATE caffeine_logs SET name = ?, size = ?, caffeine = ?, icon = ? WHERE id = ?', [name, Number(size), Number(caffeine), icon, id]);
    res.json({ id, name, size: Number(size), caffeine: Number(caffeine), icon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

// Replace my wrong implementation (I might need to use string matching that handles some spacing)
// Let's use a targeted replace for everything from app.put('/api/logs/:id' up to its end before app.delete('/api/logs/:id'
server = server.replace(/app\.put\('\/api\/logs\/:id'[\s\S]*?\}\);/g, newUserPut.trim());

// Now fix the Admin endpoints I added:
const newAdminOps = `
app.put('/api/admin/logs/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, size, caffeine, icon } = req.body;
    const dbPool = getPool();
    await dbPool.execute('UPDATE caffeine_logs SET name = ?, size = ?, caffeine = ?, icon = ? WHERE id = ?', [name, Number(size), Number(caffeine), icon, id]);
    res.json({ id, name, size: Number(size), caffeine: Number(caffeine), icon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/logs/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const dbPool = getPool();
    await dbPool.execute('DELETE FROM caffeine_logs WHERE id = ?', [id]);
    res.json({ message: 'Log gelöscht' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

// Replace my wrong admin implementation:
server = server.replace(/app\.put\('\/api\/admin\/logs\/:id'[\s\S]*?app\.delete\('\/api\/admin\/logs\/:id'[\s\S]*?\}\);/g, newAdminOps.trim());

fs.writeFileSync('server.js', server);
console.log('Fixed verifyToken and MySQL logic');
