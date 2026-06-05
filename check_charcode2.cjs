const fs = require('fs');
const dirs = ['src/components', 'src', 'src/context'];
const found = new Set();
dirs.forEach(dir => {
  fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js')).forEach(file => {
    const content = fs.readFileSync(dir + '/' + file, 'utf8');
    for(let i=0; i<content.length; i++) {
      let code = content.charCodeAt(i);
      if (code > 127) {
        let char = content[i];
        if (!['ä','ö','ü','ß','Ä','Ö','Ü','é','–','—','•','…','“','”','‘','’','✅','❌','⚠️','🍷','🥤','🤖','🇩🇪','🇬🇧','Ø','×','←'].includes(char)) {
          // If it's part of an emoji (surrogate pairs), skip it
          if (code >= 0xD800 && code <= 0xDFFF) continue;
          found.add(char);
        }
      }
    }
  });
});
console.log([...found]);
