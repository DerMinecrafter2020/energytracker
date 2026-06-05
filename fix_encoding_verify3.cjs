const fs = require('fs');
const content = fs.readFileSync('src/components/SettingsPanel.jsx', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('Deutsch'));
console.log(lines[idx - 1]);
console.log(lines[idx]);
console.log(lines[idx + 10]);
