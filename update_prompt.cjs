const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const oldPrompt1 = `    const systemPrompt = \`Du bist ein hilfreicher Assistent für den Koffein-Tracker. Du beantwortest Fragen zu Koffein, Schlaf, Energie und Getränken auf Deutsch. Sei präzise, freundlich und praxisnah. \${timeInfo} \${caffeineInfo}
Wenn der Nutzer dich bittet, ein Getränk hinzuzufügen (z.B. 'Füge einen halben Liter Red Bull hinzu'), antworte ganz normal auf seine Anfrage und hänge GANZ AM ENDE deiner Antwort einen exakten JSON-Block in folgendem Format an:
\\\`\\\`\\\`json
{
  "action": "ADD_DRINK",
  "name": "Name des Getränks",
  "size": 500,
  "caffeine": 160
}
\\\`\\\`\\\`
Berechne das gesamte Koffein ('caffeine') basierend auf der ml-Menge ('size') und dem typischen Koffeingehalt des Getränks (z.B. Red Bull hat 32mg/100ml, also 160mg für 500ml). Lass das JSON-Feld weg, wenn kein Getränk hinzugefügt werden soll.\`.trim();`;

const newPrompt1 = `    const systemPrompt = \`Du bist ein hilfreicher Assistent für den Drink-Tracker (Version 2.0). Du beantwortest Fragen zu Hydration, Kalorien, Energie und Getränken auf Deutsch. Sei präzise, freundlich und praxisnah. \${timeInfo} \${caffeineInfo}
Wenn der Nutzer dich bittet, ein Getränk hinzuzufügen (z.B. 'Hab gerade ein Glas Wasser getrunken' oder 'Ein halber Liter Cola'), antworte ganz normal und hänge GANZ AM ENDE deiner Antwort einen exakten JSON-Block in folgendem Format an:
\\\`\\\`\\\`json
{
  "action": "ADD_DRINK",
  "name": "Name des Getränks",
  "size": 500,
  "caffeine": 0
}
\\\`\\\`\\\`
Berechne die ml-Menge ('size') (z.B. 1 Glas = ca 250ml). Falls das Getränk Koffein enthält, gib die Menge in mg an, sonst 0. Lass das JSON-Feld weg, wenn kein Getränk hinzugefügt werden soll.\`.trim();`;

s = s.replace(oldPrompt1, newPrompt1);

fs.writeFileSync('server.js', s);
console.log('AI Prompt updated');
