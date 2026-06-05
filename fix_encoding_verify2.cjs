const fs = require('fs');
const content = fs.readFileSync('src/components/SettingsPanel.jsx', 'utf8');
const idx = content.indexOf('Deutsch');
const flagStr = content.substring(idx - 15, idx - 1);
console.log(flagStr);
for(let i=0; i<flagStr.length; i++) {
  console.log(flagStr.charCodeAt(i).toString(16));
}
