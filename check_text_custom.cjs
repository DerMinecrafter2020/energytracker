const fs = require('fs');
const content = fs.readFileSync('src/components/CustomDrinks.jsx', 'utf8');
const lines = content.split('\n');
console.log(lines.find(l => l.includes('Gr')));
console.log(lines.find(l => l.includes('Hinzuf')));
console.log(lines.find(l => l.includes('gel')));
