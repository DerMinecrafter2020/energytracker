const fs = require('fs');

const win1252 = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026', 0x86: '\u2020', 0x87: '\u2021',
  0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160', 0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D',
  0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153', 0x9E: '\u017E', 0x9F: '\u0178'
};
const charToByte = new Map();
for(let i=0; i<256; i++) {
  if (i >= 0x80 && i <= 0x9F) {
    if (win1252[i]) charToByte.set(win1252[i], i);
  } else {
    charToByte.set(String.fromCharCode(i), i);
  }
}

// These specific sequences are double encoded representations of UTF-8 characters.
const toReplace = {
  'ðŸ¥¤': '🥤',
  'ðŸ¤–': '🤖',
  'ðŸ·': '🍷',
  'â€\x90': '-',
  'Â ': ' ',
  '⚠ï¸\x8f': '⚠️',
  'â€†': ' ',
  'Ã¤': 'ä', // in case any are left
  'Ã¶': 'ö',
  'Ã¼': 'ü',
  'ÃŸ': 'ß',
  'Ã„': 'Ä',
  'Ã–': 'Ö',
  'Ãœ': 'Ü'
};

const dirs = ['src/components', 'src', 'src/context'];
dirs.forEach(dir => {
  fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js')).forEach(file => {
    let p = dir + '/' + file;
    let content = fs.readFileSync(p, 'utf8');
    let original = content;
    
    // Manual replacements for emojis and known control character messes
    for(const [k, v] of Object.entries(toReplace)) {
      content = content.split(k).join(v);
    }
    
    // Also try to find any word that looks like a double-encoded umlaut that we missed
    // For example, if there's any C3 84 sequence, etc.
    
    if (content !== original) {
      fs.writeFileSync(p, content, 'utf8');
      console.log('Fixed', p);
    }
  });
});
