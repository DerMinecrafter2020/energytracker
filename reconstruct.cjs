const fs = require('fs');
const step = JSON.parse(fs.readFileSync('step635.json', 'utf8'));
const output = step.content || step.tool_calls?.[0]?.output || JSON.stringify(step);

let diffStart = output.indexOf('[diff_block_start]');
if (diffStart === -1) {
    // maybe it is in action response
    diffStart = output.indexOf('@@ -');
}

const lines = output.split('\n');
let reconstructed = [];
let inDiff = false;
for (const line of lines) {
    if (line.includes('[diff_block_start]')) { inDiff = true; continue; }
    if (line.includes('[diff_block_end]')) { inDiff = false; continue; }
    if (inDiff) {
        if (line.startsWith('@@')) continue;
        if (line.startsWith('-')) {
            reconstructed.push(line.substring(1));
        } else if (line.startsWith(' ')) {
            reconstructed.push(line.substring(1));
        }
        // ignore '+' lines
    }
}

fs.writeFileSync('AdminPanel_reconstructed.jsx', reconstructed.join('\n'), 'utf8');
console.log('Reconstructed lines:', reconstructed.length);
