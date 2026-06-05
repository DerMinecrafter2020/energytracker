const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

let bestBlob = '';
walk('.git/objects', (filePath) => {
    if (filePath.includes('pack') || filePath.includes('info')) return;
    try {
        const compressed = fs.readFileSync(filePath);
        const decompressed = zlib.inflateSync(compressed).toString('utf8');
        if (decompressed.includes('const AdminPanel =') && decompressed.includes('export default AdminPanel;')) {
            if (decompressed.length > bestBlob.length && !decompressed.includes('loadingTranslations')) { // ignore my latest broken save if it was committed?
                bestBlob = decompressed;
            }
        }
    } catch(e) {}
});

if (bestBlob) {
    // Git blob format is "blob <size>\0<content>"
    const nullIdx = bestBlob.indexOf('\0');
    if (nullIdx !== -1) {
        bestBlob = bestBlob.substring(nullIdx + 1);
    }
    fs.writeFileSync('AdminPanel_git.jsx', bestBlob, 'utf8');
    console.log('Found! Length:', bestBlob.length);
} else {
    console.log('Not found in git objects.');
}
