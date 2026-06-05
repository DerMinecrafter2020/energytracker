const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const target = `app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', db_type: DB_TYPE });
});`;

const replacement = `app.get('/api/health', async (req, res) => {
  const trans = await redis.get('koffein:translations');
  res.json({ status: 'ok', trans: JSON.parse(trans || '{}') });
});`;

s = s.replace(target, replacement);
fs.writeFileSync('server.js', s, 'utf8');
