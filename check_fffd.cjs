const fs = require('fs');
const content = fs.readFileSync('src/components/OnlineSearch.jsx', 'utf8');
console.log(content.indexOf('\uFFFD') !== -1 ? 'CONTAINS U+FFFD' : 'NO FFFD');
