const fs = require('fs');
const path = require('path');

const map = {
  'ÃƒÂ¤': 'ä',
  'ÃƒÂ¶': 'ö',
  'ÃƒÂ¼': 'ü',
  'ÃƒÅ¸': 'ß',
  'Ãƒâ€': 'Ä',
  'Ãƒâ€“': 'Ö',
  'ÃƒÅ“': 'Ü',
  'Ã¢â‚¬“': '–',
  'Ã¢â‚¬Â¢': '•',
  'Ã¢Å““': '✔',
  'Ãƒ—': '×',
  'Ã˜': 'Ø',
  'Ã—': '×',
  'ÃƒËœ': 'Ø',
  'Ã°Å¸Â¤–': '🤖',
  'Ã°Å¸Â Â·': '🍷',
  'Ã°Å¸Â¥Â¤': '🥤',
  'Ã¢Å¡Â Ã¯Â¸Â ': '⚠️',
  'Ã¢Å¡Â ': '⚠'
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  for (const [bad, good] of Object.entries(map)) {
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
