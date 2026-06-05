const fs = require('fs');
const content = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');
const matches = content.match(/â€./g) || [];
console.log([...new Set(matches)]);
