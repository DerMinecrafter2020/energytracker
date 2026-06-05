const fs = require('fs');

// Read German dictionary from frontend
const lcContent = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');
const match = lcContent.match(/de:\s*\{([^}]+)\}/);
if (!match) throw new Error("Could not extract German dictionary");

// Extract the raw text and parse it manually since it's JS, not JSON
let deDictRaw = match[1];
const defaultDe = {};
deDictRaw.split('\n').forEach(line => {
  const parts = line.split(':');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join(':').trim();
    val = val.replace(/^'/, '').replace(/',?$/, '').replace(/",?$/, '');
    if (key) defaultDe[key] = val;
  }
});

let serverContent = fs.readFileSync('server.js', 'utf8');

// We will add the AI translation logic into GET /api/translations
const target = `app.get('/api/translations', async (req, res) => {
  try {
    const raw = await redis.get('koffein:translations');
    let translations = raw ? JSON.parse(raw) : null;
    res.json(translations || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

const replacement = `const DEFAULT_DE_DICT = ${JSON.stringify(defaultDe, null, 2)};

let isTranslating = false;

app.get('/api/translations', async (req, res) => {
  try {
    const raw = await redis.get('koffein:translations');
    let translations = raw ? JSON.parse(raw) : null;
    
    // Auto-Translate trigger on first load if missing
    if (!translations || Object.keys(translations).length === 0) {
      const aiCfg = loadAiConfig();
      if (aiCfg && aiCfg.apiKey && !isTranslating) {
        isTranslating = true;
        // Run translation async in background so we don't block this request
        (async () => {
          try {
            console.log('[AI] Erster Start erkannt: Generiere fehlende ÃƒÅ“bersetzungen via KI...');
            const messages = [
              { role: 'system', content: 'Du bist ein professioneller ÃƒÅ“bersetzer fÃƒÂ¼r eine Koffein-Tracker-Web-App. Der Benutzer gibt dir ein JSON-Objekt mit deutschen Texten. Du sollst dieses JSON-Objekt ins Englische ("en"), Spanische ("es") und FranzÃƒÂ¶sische ("fr") ÃƒÂ¼bersetzen. Antworte AUSSCHLIESSLICH mit einem gÃƒÂ¼ltigen JSON-Objekt, das die Sprachen als Top-Level-Keys ("en", "es", "fr") enthÃƒÂ¤lt, und darunter die ÃƒÂ¼bersetzten Key-Value-Paare. Verwende KEIN Markdown (wie \`\`\`json).' },
              { role: 'user', content: JSON.stringify(DEFAULT_DE_DICT) }
            ];
            const responseText = await askAi(messages);
            let generatedDicts = null;
            try {
              // Cleanup markdown if AI accidentally includes it
              const cleanText = responseText.replace(/^\\s*\`\`\`json\\s*/i, '').replace(/\\s*\`\`\`\\s*$/i, '').trim();
              generatedDicts = JSON.parse(cleanText);
            } catch(e) {
              console.error('[AI] Translation JSON parse error:', e.message);
            }
            if (generatedDicts && generatedDicts.en) {
              const finalDict = { de: DEFAULT_DE_DICT, ...generatedDicts };
              await redis.set('koffein:translations', JSON.stringify(finalDict));
              console.log('[AI] ÃƒÅ“bersetzungen erfolgreich generiert und in Datenbank gespeichert.');
            }
          } catch (e) {
            console.error('[AI] Fehler bei der automatischen ÃƒÅ“bersetzung:', e.message);
          } finally {
            isTranslating = false;
          }
        })();
      }
    }
    
    res.json(translations || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

if (serverContent.includes('const DEFAULT_DE_DICT')) {
  console.log("Already applied");
} else {
  serverContent = serverContent.replace(target, replacement);
  fs.writeFileSync('server.js', serverContent, 'utf8');
  console.log('Modified server.js');
}

