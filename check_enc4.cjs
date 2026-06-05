const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const lines = s.split('\n');
console.log(lines.find(l => l.includes('Erster Start erkannt')));
