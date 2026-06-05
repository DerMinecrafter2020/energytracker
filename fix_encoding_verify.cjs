const fs = require('fs');
const content = fs.readFileSync('src/components/SettingsPanel.jsx', 'utf8');
const idx = content.indexOf('Deutsch');
console.log(content.substring(idx - 25, idx + 10));
