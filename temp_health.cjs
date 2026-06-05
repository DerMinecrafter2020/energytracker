const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');
s = s.replace(pp.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', db_type: DB_TYPE });
});, pp.get('/api/health', async (req, res) => {
  const trans = await redis.get('koffein:translations');
  res.json({ status: 'ok', trans: JSON.parse(trans || '{}') });
}););
fs.writeFileSync('server.js', s, 'utf8');
