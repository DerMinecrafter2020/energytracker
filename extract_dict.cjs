const fs = require('fs');
const text = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');
const match = text.match(/de:\s*\{([^}]+)\}/);
console.log(match[0]);
