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

function decodeWin1252(str) {
  let bytes = [];
  for(let i=0; i<str.length; i++) {
    let char = str[i];
    if(charToByte.has(char)) {
      bytes.push(charToByte.get(char));
    } else {
      // Not a valid win1252 char, meaning it wasn't double encoded, or it's just a normal unicode character
      // We can't reverse decode the whole file blindly if some parts weren't double encoded!
      // But wait! If the file was WHOLLY read and written, ALL characters in it must be within the Win1252 charset!
      // If there are ANY characters outside Win1252 (like emojis that I inserted LATER), they would fail here!
      return null; 
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

let testStr = 'ÃƒÂ¤';
console.log(decodeWin1252(testStr));
console.log(decodeWin1252(decodeWin1252(testStr)));
