const fs = require('fs');
let content = fs.readFileSync('src/components/StatsPanel.jsx', 'utf8');
content = content.replace(/⚠Ã¯Â¸./g, '⚠️');
fs.writeFileSync('src/components/StatsPanel.jsx', content, 'utf8');
console.log('Fixed StatsPanel.jsx');
