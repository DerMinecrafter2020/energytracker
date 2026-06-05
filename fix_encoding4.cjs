const fs = require('fs');
const dirs = ['src/components', 'src', 'src/context'];
const found = new Set();
dirs.forEach(dir => {
  fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js')).forEach(file => {
    const content = fs.readFileSync(dir + '/' + file, 'utf8');
    const matches = content.match(/â€./g) || [];
    matches.forEach(m => found.add(m));
  });
});
console.log([...found]);
