const fs = require('fs');

function replaceFile(filePath, badBytes, goodStr) {
  let content = fs.readFileSync(filePath);
  let badBuffer = Buffer.from(badBytes);
  let idx = content.indexOf(badBuffer);
  if (idx !== -1) {
    let newContent = Buffer.concat([
      content.slice(0, idx),
      Buffer.from(goodStr, 'utf8'),
      content.slice(idx + badBuffer.length)
    ]);
    fs.writeFileSync(filePath, newContent);
    console.log('Fixed buffer in', filePath);
    replaceFile(filePath, badBytes, goodStr); // recursion to replace all
  }
}

replaceFile('src/components/CustomDrinks.jsx', [0xC3, 0xB0, 0xC5, 0xB8, 0xC2, 0x8D, 0xC2, 0xB7], '🍷');
replaceFile('src/components/StatsPanel.jsx', [0xE2, 0x9A, 0xA0, 0xC3, 0xAF, 0xC2, 0xB8, 0xC2, 0x8F], '⚠️');
