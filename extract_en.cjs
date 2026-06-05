const fs = require('fs');
const text = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');
const match = text.match(/en:\s*\{([^}]+)\}/);
console.log(match ? match[0] : 'no en dict');
