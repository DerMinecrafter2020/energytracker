const fs = require('fs');
const content = fs.readFileSync('src/components/CustomDrinks.jsx');
const str = content.toString('utf8');
const idx = str.indexOf('Ã');
console.log(content.slice(idx-5, idx+25));
