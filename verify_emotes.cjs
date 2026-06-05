const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const line1 = s.split('\n').find(l => l.includes('API server running'));
console.log(Buffer.from(line1, 'utf8'));
