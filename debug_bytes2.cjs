const fs = require('fs');
const text = fs.readFileSync('server.js');
const s = text.toString();
const idx = s.indexOf('ist bereits registriert');
console.log(text.slice(idx - 20, idx + 15));
