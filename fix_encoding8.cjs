const fs = require('fs');

function replaceBuffer(filePath, badBytes, goodStr) {
  let content = fs.readFileSync(filePath);
  let badBuffer = Buffer.from(badBytes);
  let idx = content.indexOf(badBuffer);
  let replaced = false;
  while (idx !== -1) {
    content = Buffer.concat([
      content.slice(0, idx),
      Buffer.from(goodStr, 'utf8'),
      content.slice(idx + badBuffer.length)
    ]);
    idx = content.indexOf(badBuffer);
    replaced = true;
  }
  if (replaced) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed buffer in', filePath);
  }
}

const dirs = ['src/components', 'src', 'src/context'];
dirs.forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));
  files.forEach(file => {
    let p = dir + '/' + file;
    // 🍷 : c3 83 c2 b0 c3 85 c2 b8 c3 82 c2 8d c3 82 c2 b7
    replaceBuffer(p, [0xc3, 0x83, 0xc2, 0xb0, 0xc3, 0x85, 0xc2, 0xb8, 0xc3, 0x82, 0xc2, 0x8d, 0xc3, 0x82, 0xc2, 0xb7], '🍷');
    // 🥤 : c3 83 c2 b0 c3 85 c2 b8 c3 82 c2 a5 c3 82 c2 a4
    replaceBuffer(p, [0xc3, 0x83, 0xc2, 0xb0, 0xc3, 0x85, 0xc2, 0xb8, 0xc3, 0x82, 0xc2, 0xa5, 0xc3, 0x82, 0xc2, 0xa4], '🥤');
    // 🤖 : c3 83 c2 b0 c3 85 c2 b8 c3 82 c2 a4 c3 83 a2 c3 82 80 c3 82 93
    // Wait, let's just use string replacements for the triple-encoded strings.
    // If it's triple encoded, we can just replace the string representation.
  });
});
