const fs = require('fs');
const content = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');
console.log(content.match(/Ã./g) || 'No Ã sequences');
console.log(content.match(/â./g) || 'No â sequences');
