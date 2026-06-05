const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');
const lines = text.split('\n');
const line = lines.find(l => l.includes('ist bereits registriert'));
console.log(line);
console.log(Buffer.from(line, 'utf8'));
