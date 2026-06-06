const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

// Fix verifyToken -> just async (req, res)
server = server.replace(/app\.put\('\/api\/logs\/:id', verifyToken, async \(req, res\) =>/g, "app.put('/api/logs/:id', async (req, res) =>");

// Fix verifyAdmin -> requireAdmin
server = server.replace(/app\.put\('\/api\/admin\/logs\/:id', verifyAdmin, async \(req, res\) =>/g, "app.put('/api/admin/logs/:id', requireAdmin, async (req, res) =>");
server = server.replace(/app\.delete\('\/api\/admin\/logs\/:id', verifyAdmin, async \(req, res\) =>/g, "app.delete('/api/admin/logs/:id', requireAdmin, async (req, res) =>");

// Also there's req.user.email in the user update, let's fix it since auth middleware doesn't exist.
// Original code: const logIndex = dbState.caffeine_logs.findIndex(l => l.id === id && l.userId === req.user.email);
// If it's a MySQL backend now (which I noticed in app.delete), I might need to adjust!
// Wait! I noticed `await dbPool.execute('DELETE FROM caffeine_logs WHERE id = ?', [id]);` in the `app.delete` block.
// Is it MySQL?! 
fs.writeFileSync('server.js', server);
console.log('Fixed verifyToken and verifyAdmin references');
