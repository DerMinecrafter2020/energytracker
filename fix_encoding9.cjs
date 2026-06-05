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

// ⚠ is already there, we just need to replace ⚠Ã¯Â¸Â  with ⚠️
// Let's just do a string replacement for ⚠Ã¯Â¸Â  or buffer replacement
// bytes for Ã¯Â¸Â  : c3 af c2 b8 c2 8f
replaceBuffer('src/components/StatsPanel.jsx', [0xe2, 0x9a, 0xa0, 0xc3, 0xaf, 0xc2, 0xb8, 0xc2, 0x8f], '⚠️');
