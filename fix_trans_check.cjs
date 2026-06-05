const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// First remove the hack I just added
s = s.replace(`app.get('/api/translations', async (req, res) => {
  // FORCE WIPE TRANSLATIONS ONCE
  if (!global.wipedTrans) {
    global.wipedTrans = true;
    await redis.del('koffein:translations');
  }`, `app.get('/api/translations', async (req, res) => {`);

const target = `if (!translations || Object.keys(translations).length === 0) {`;
const replacement = `const isMissing = !translations || Object.keys(translations).length === 0;
    const isBroken = translations && translations.en && translations.en.discover === 'Entdecken';
    if (isMissing || isBroken) {`;

s = s.replace(target, replacement);

fs.writeFileSync('server.js', s, 'utf8');
