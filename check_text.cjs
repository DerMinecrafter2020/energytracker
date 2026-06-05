const fs = require('fs');
const content = fs.readFileSync('src/components/DrinkHistory.jsx', 'utf8');
const lines = content.split('\n');
console.log(lines.find(l => l.includes('Getr')));
console.log(lines.find(l => l.includes('F')));
