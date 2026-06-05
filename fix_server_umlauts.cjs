const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');
s = s.replace(/ÃƒÅ“/g, 'Ü');
s = s.replace(/ÃƒÂ¼/g, 'ü');
s = s.replace(/ÃƒÂ¶/g, 'ö');
s = s.replace(/ÃƒÂ¤/g, 'ä');
fs.writeFileSync('server.js', s, 'utf8');
