const fs = require('fs');
const content = fs.readFileSync('src/components/BottomNavigation.jsx', 'utf8');
const lines = content.split('\n');
console.log(lines.find(l => l.includes('Entdecken')));
console.log(lines.find(l => l.includes('Verlauf')));
