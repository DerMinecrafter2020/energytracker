const fs = require('fs');
const path = require('path');

const replacements = {
  'ðŸ‡©ðŸ‡ª': '🇩🇪',
  'ðŸ‡¬ðŸ‡§': '🇬🇧',
  'Ã¤': 'ä',
  'Ã¶': 'ö',
  'Ã¼': 'ü',
  'ÃŸ': 'ß',
  'Ã„': 'Ä',
  'Ã–': 'Ö',
  'Ãœ': 'Ü',
  'Ã©': 'é'
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  for (const [bad, good] of Object.entries(replacements)) {
    content = content.split(bad).join(good);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', filePath);
  }
}

const dirs = ['src/components', 'src', 'src/context'];
dirs.forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));
  files.forEach(file => {
    fixFile(path.join(dir, file));
  });
});
