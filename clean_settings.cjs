const fs = require('fs');
let s = fs.readFileSync('src/components/SettingsPanel.jsx', 'utf8');

// 1. Remove settingLanguage state
s = s.replace(/const \[settingLanguage, setSettingLanguage\] = useState\('de'\);\n?/, '');

// 2. Remove settingLanguage from loaded settings
s = s.replace(/setSettingLanguage\(data\.language \|\| 'de'\);\n?/, '');

// 3. Remove language from update payload
s = s.replace(/theme,\s*language: settingLanguage,?\n?/, 'theme,\n');

// 4. Remove the language UI section. It's inside a block: 
// <div className="border-b border-white/10 pb-5">
//   <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
//     {'Erscheinungsbild'} & {}
//   </h4>
//   ...
//   </div>
// </div>

const uiToRemove = `        {/* Theme & Language */}
        <div className="border-b border-white/10 pb-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {'Erscheinungsbild'} & {}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-2">{}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettingLanguage('de')}
                  className={\`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 \${
                    settingLanguage === 'de'
                      ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-400/50'
                      : 'bg-black/20 text-slate-400 hover:bg-white/10 border border-white/5'
                  }\`}
                >
                  <span className="text-xl leading-none filter drop-shadow-md">🇩🇪</span>
                  Deutsch
                </button>
                <button
                  type="button"
                  onClick={() => setSettingLanguage('en')}
                  className={\`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 \${
                    settingLanguage === 'en'
                      ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-400/50'
                      : 'bg-black/20 text-slate-400 hover:bg-white/10 border border-white/5'
                  }\`}
                >
                  <span className="text-xl leading-none filter drop-shadow-md">🇬🇧</span>
                  English
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{'Erscheinungsbild'}</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} className="input-dark text-sm appearance-none cursor-pointer">
                <option value="system">Standard Dark</option>
                <option value="light">Light Mode</option>
                <option value="oled">True Black (OLED)</option>
                <option value="neon">Neon Punk</option>
                <option value="forest">Forest Green</option>
              </select>
            </div>
          </div>
        </div>`;

const uiToAdd = `        {/* Theme */}
        <div className="border-b border-white/10 pb-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Erscheinungsbild
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Erscheinungsbild</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} className="input-dark text-sm appearance-none cursor-pointer">
                <option value="system">Standard Dark</option>
                <option value="light">Light Mode</option>
                <option value="oled">True Black (OLED)</option>
                <option value="neon">Neon Punk</option>
                <option value="forest">Forest Green</option>
              </select>
            </div>
          </div>
        </div>`;

s = s.replace(uiToRemove, uiToAdd);

fs.writeFileSync('src/components/SettingsPanel.jsx', s);
console.log('SettingsPanel language removed');
