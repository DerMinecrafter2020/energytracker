const fs = require('fs');
const content = fs.readFileSync('src/components/SettingsPanel.jsx', 'utf8');
const lines = content.split('\n');
console.log(lines.find(l => l.includes('Täglich')));
console.log(lines.find(l => l.includes('überschritten')));
console.log(lines.find(l => l.includes('Spätes')));
