const fs = require('fs');
const content = fs.readFileSync('src/components/CustomDrinks.jsx');
const str = content.toString('utf8');
const idx = str.indexOf('useState(');
console.log(content.slice(idx, idx+30));
