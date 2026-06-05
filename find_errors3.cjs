const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const lines = s.split('\n');
console.log(lines.filter(l => l.includes('status(400)') || l.includes('status(409)')).map(l => l.trim()).join('\n').slice(0, 500));
