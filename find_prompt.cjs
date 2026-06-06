const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('system:')) {
    for (let j = i; j < i + 30; j++) {
      if (lines[j]) console.log(j + ': ' + lines[j]);
    }
    break;
  }
}
