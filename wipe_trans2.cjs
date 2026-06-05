const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const target1 = `app.get('/api/health', async (req, res) => {
  const trans = await redis.get('koffein:translations');
  res.json({ status: 'ok', trans: JSON.parse(trans || '{}') });
});`;

const replacement1 = `app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', db_type: DB_TYPE });
});`;

s = s.replace(target1, replacement1);

const target2 = `app.get('/api/translations', async (req, res) => {`;
const replacement2 = `app.get('/api/translations', async (req, res) => {
  // FORCE WIPE TRANSLATIONS ONCE
  if (!global.wipedTrans) {
    global.wipedTrans = true;
    await redis.del('koffein:translations');
  }`;

s = s.replace(target2, replacement2);
fs.writeFileSync('server.js', s, 'utf8');
