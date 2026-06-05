const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const targetRegex = /const responseText = await callOpenRouter\(messages\);\s*let generatedDicts = null;\s*try \{\s*\/\/ Cleanup markdown if AI accidentally includes it\s*const cleanText = responseText\.replace\(\/\^\\s\*`\+json\\s\*\/\w, ''\)\.replace\(\/\\s\*`\+\\s\*\$\/\w, ''\)\.trim\(\);\s*generatedDicts = JSON\.parse\(cleanText\);\s*\} catch\(e\) \{\s*console\.error\('\[AI\] Translation JSON parse error:', e\.message\);\s*\}/;

const replacement = `const responseText = await callOpenRouter(messages);
            require('fs').writeFileSync('ai_translation_debug.txt', responseText, 'utf8');
            let generatedDicts = null;
            try {
              let cleanText = responseText.replace(/^\\s*\`\`\`json\\s*/i, '').replace(/\\s*\`\`\`\\s*$/i, '').trim();
              generatedDicts = JSON.parse(cleanText);
            } catch(e) {
              console.error('[AI] Translation JSON parse error:', e.message);
            }`;

// Since Regex matching multiline can be tricky, I'll use index based replacement
const startIdx = s.indexOf('const responseText = await callOpenRouter(messages);');
if (startIdx !== -1) {
  const endStr = `console.error('[AI] Translation JSON parse error:', e.message);\n            }`;
  const endIdx = s.indexOf(endStr, startIdx);
  if (endIdx !== -1) {
    const fullTarget = s.substring(startIdx, endIdx + endStr.length);
    s = s.replace(fullTarget, replacement);
    fs.writeFileSync('server.js', s, 'utf8');
    console.log("Replaced successfully");
  }
}
