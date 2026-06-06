const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

// Find the AI prompt and update it
if (server.includes('ADD_DRINK')) {
  const promptUpdate = `
  Der Benutzer sagt dir, was er getrunken hat oder bittet dich, Logs zu bearbeiten/löschen.
  Wenn er ein neues Getränk hinzufügt, antworte im JSON Format mit der Action "ADD_DRINK".
  Wenn er ein Getränk löschen möchte, antworte im JSON Format mit der Action "DELETE_DRINK" und der ungefähren Beschreibung (z.B. "Kaffee").
  Wenn er ein Getränk ändern möchte, antworte im JSON Format mit der Action "UPDATE_DRINK", der ungefähren Beschreibung (z.B. "Kaffee") und den neuen Daten.

  Erwartetes JSON für Hinzufügen:
  {
    "action": "ADD_DRINK",
    "name": "Kaffee",
    "size": 250,
    "caffeine": 80,
    "icon": "☕"
  }

  Erwartetes JSON für Löschen:
  {
    "action": "DELETE_DRINK",
    "name": "Kaffee"
  }

  Erwartetes JSON für Ändern (z.B. Größe/Koffein anpassen):
  {
    "action": "UPDATE_DRINK",
    "name": "Kaffee",
    "new_size": 300,
    "new_caffeine": 100
  }

  WICHTIG: Wenn du JSON sendest, sende NUR das JSON und keinen anderen Text.
  `;
  
  // I'll just use a targeted regex or string replacement for the prompt in server.js
  // Let's replace the block `Du bist ein hilfreicher KI-Assistent...`
  server = server.replace(/Du bist ein hilfreicher KI-Assistent für das Koffein-Tracking\.(.|\n)*?(?=WICHTIG: Wenn)/, promptUpdate);
  fs.writeFileSync('server.js', server);
  console.log('server.js prompt updated');
}
