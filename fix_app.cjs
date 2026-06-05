const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// We need to rename TrackerApp to TrackerAppInner
content = content.replace('function TrackerApp({ session', 'function TrackerAppInner({ session');

// And create a new TrackerApp that wraps TrackerAppInner in LanguageProvider
const newTrackerApp = 
function TrackerApp(props) {
  return (
    <LanguageProvider>
      <TrackerAppInner {...props} />
    </LanguageProvider>
  );
}

function TrackerAppInner({ session, onLogout, onShowAdminPanel, initialScrollY, onPersistScrollY }) {
;

content = content.replace('function TrackerAppInner({ session, onLogout, onShowAdminPanel, initialScrollY, onPersistScrollY }) {', newTrackerApp);

// Now inside TrackerAppInner, we remove the LanguageProvider wrap and just return the div
content = content.replace('<LanguageProvider language={settings?.language}>', '');
content = content.replace('</LanguageProvider>', '');

fs.writeFileSync('src/App.jsx', content, 'utf8');
