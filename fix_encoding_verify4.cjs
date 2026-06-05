const fs = require('fs');
const content = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');
const lines = content.split('\n');
console.log(lines.find(l => l.includes('Täglich')));
console.log(lines.find(l => l.includes('Größe')));
console.log(lines.find(l => l.includes('zurück')));
