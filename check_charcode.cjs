const fs = require('fs');
const content = fs.readFileSync('src/components/OnlineSearch.jsx', 'utf8');
const idx = content.indexOf('Getr');
const str = content.substring(idx, idx+10);
console.log(str);
for(let i=0;i<str.length;i++){
  console.log(str.charCodeAt(i).toString(16));
}
