const fs = require('fs');

let ai = fs.readFileSync('src/components/AIAssistant.jsx', 'utf8');

// Update props
ai = ai.replace('({ totalCaffeineToday = 0, logs = [], onAddDrink })', '({ totalCaffeineToday = 0, logs = [], onAddDrink, onDeleteDrink, onUpdateDrink })');

// Update JSON parsing logic
const jsonParseLogic = `
      let drinkToAdd = null;
      let drinkToDelete = null;
      let drinkToUpdate = null;
      
      const jsonMatch = reply.match(/\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`/);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.action === 'ADD_DRINK') {
            drinkToAdd = parsed;
          } else if (parsed.action === 'DELETE_DRINK') {
            drinkToDelete = parsed;
          } else if (parsed.action === 'UPDATE_DRINK') {
            drinkToUpdate = parsed;
          }
        } catch (e) {
          console.error('Fehler beim Parsen der AI JSON-Antwort', e);
        }
        reply = reply.replace(/\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`/, '').trim();
      }

      if (!reply && jsonMatch) {
        if (drinkToAdd) reply = 'Getränk hinzugefügt.';
        if (drinkToDelete) reply = 'Getränk gelöscht.';
        if (drinkToUpdate) reply = 'Getränk aktualisiert.';
      }
      
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);

      if (drinkToAdd && onAddDrink) {
        await onAddDrink({
          name: drinkToAdd.name || 'AI Drink',
          size: Number(drinkToAdd.size) || 0,
          caffeine: Number(drinkToAdd.caffeine) || 0,
          icon: drinkToAdd.icon || '🤖'
        });
      }
      
      if (drinkToDelete && onDeleteDrink) {
        // Find the log id that matches the name closely
        const match = logs.find(l => l.name.toLowerCase().includes(drinkToDelete.name.toLowerCase()));
        if (match) {
          await onDeleteDrink(match.id);
        }
      }
      
      if (drinkToUpdate && onUpdateDrink) {
        const match = logs.find(l => l.name.toLowerCase().includes(drinkToUpdate.name.toLowerCase()));
        if (match) {
          await onUpdateDrink(match.id, {
            name: drinkToUpdate.new_name || match.name,
            size: drinkToUpdate.new_size ? Number(drinkToUpdate.new_size) : match.size,
            caffeine: drinkToUpdate.new_caffeine ? Number(drinkToUpdate.new_caffeine) : match.caffeine,
            icon: drinkToUpdate.icon || match.icon
          });
        }
      }
`;

ai = ai.replace(/let drinkToAdd = null;[\s\S]*?(?=} catch \(err\))/g, jsonParseLogic);

// Make height 600px
ai = ai.replace('h-[400px]', 'h-[600px]');

// Typing animation instead of > VERARBEITE...
const typingAnimation = `
        {loading && (
          <div className="text-violet-400 font-bold flex items-center gap-1">
            <span>&gt;</span>
            <div className="flex gap-1 ml-1">
              <span className="w-2 h-4 bg-violet-400 animate-pulse"></span>
            </div>
          </div>
        )}
`;
ai = ai.replace(/\{loading && \([\s\S]*?&gt; VERARBEITE\.\.\.[\s\S]*?\)\}/, typingAnimation.trim());

fs.writeFileSync('src/components/AIAssistant.jsx', ai);
console.log('AIAssistant updated');
