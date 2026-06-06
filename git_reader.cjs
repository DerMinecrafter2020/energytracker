const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function getObjectPath(hash) {
  return path.join('.git', 'objects', hash.substring(0, 2), hash.substring(2));
}

function readObject(hash) {
  const p = getObjectPath(hash);
  if (!fs.existsSync(p)) return null;
  const compressed = fs.readFileSync(p);
  const buffer = zlib.inflateSync(compressed);
  const spaceIdx = buffer.indexOf(32);
  const nullIdx = buffer.indexOf(0, spaceIdx);
  const type = buffer.toString('utf8', 0, spaceIdx);
  const size = parseInt(buffer.toString('utf8', spaceIdx + 1, nullIdx), 10);
  const data = buffer.slice(nullIdx + 1);
  return { type, size, data };
}

function parseTree(data) {
  const entries = [];
  let pos = 0;
  while (pos < data.length) {
    const spaceIdx = data.indexOf(32, pos);
    const nullIdx = data.indexOf(0, spaceIdx);
    const mode = data.toString('utf8', pos, spaceIdx);
    const name = data.toString('utf8', spaceIdx + 1, nullIdx);
    const hash = data.slice(nullIdx + 1, nullIdx + 21).toString('hex');
    entries.push({ mode, name, hash });
    pos = nullIdx + 21;
  }
  return entries;
}

function findFileInTree(treeHash, filePath) {
  const parts = filePath.split('/');
  let currentHash = treeHash;
  for (let i = 0; i < parts.length; i++) {
    const obj = readObject(currentHash);
    if (!obj || obj.type !== 'tree') return null;
    const tree = parseTree(obj.data);
    const entry = tree.find(e => e.name === parts[i]);
    if (!entry) return null;
    currentHash = entry.hash;
    if (i === parts.length - 1) {
      const fileObj = readObject(currentHash);
      return fileObj ? fileObj.data.toString('utf8') : null;
    }
  }
  return null;
}

try {
  // Read HEAD
  const headContent = fs.readFileSync('.git/HEAD', 'utf8').trim();
  let commitHash;
  if (headContent.startsWith('ref: ')) {
    const refPath = headContent.substring(5);
    commitHash = fs.readFileSync(path.join('.git', refPath), 'utf8').trim();
  } else {
    commitHash = headContent;
  }

  // Get commit object
  const commitObj = readObject(commitHash);
  let treeHash = '';
  const lines = commitObj.data.toString('utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('tree ')) {
      treeHash = line.substring(5);
      break;
    }
  }

  const content = findFileInTree(treeHash, 'src/components/DrinkHistory.jsx');
  if (content) {
    fs.writeFileSync('scratch/DrinkHistory_extracted.jsx', content);
    console.log('Successfully extracted DrinkHistory.jsx to scratch/DrinkHistory_extracted.jsx');
  } else {
    console.log('DrinkHistory.jsx not found in HEAD tree.');
  }

} catch(err) {
  console.error('Error:', err.message);
}
