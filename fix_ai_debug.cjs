const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const target =             const responseText = await callOpenRouter(messages);
            let generatedDicts = null;
            try {
              // Cleanup markdown if AI accidentally includes it
              const cleanText = responseText.replace(/^\\s*\\\\\\\\\json\\s*/i, '').replace(/\\s*\\\\\\\\\\\s*$/i, '').trim();
              generatedDicts = JSON.parse(cleanText);
            } catch(e) {
              console.error('[AI] Translation JSON parse error:', e.message);
            };

const replacement =             const responseText = await callOpenRouter(messages);
            require('fs').writeFileSync('ai_translation_debug.txt', responseText, 'utf8');
            let generatedDicts = null;
            try {
              let cleanText = responseText.replace(/^\\s*\\\\\\\\\json\\s*/i, '').replace(/\\s*\\\\\\\\\\\s*$/i, '').trim();
              
              // Sometimes AI returns {"en": ...} but sometimes just {...} where it assumes we wanted the inner object
              if (!cleanText.includes('"en"')) {
                // Wrap it
                cleanText = \{"en": \}\;
              }
              
              generatedDicts = JSON.parse(cleanText);
            } catch(e) {
              console.error('[AI] Translation JSON parse error:', e.message);
            };

s = s.replace(target, replacement);
fs.writeFileSync('server.js', s, 'utf8');
