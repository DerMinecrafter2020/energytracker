const fs = require('fs');
const text = fs.readFileSync('server.js');
console.log(text.slice(text.indexOf('Schl'), text.indexOf('Schl') + 15));
