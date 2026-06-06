const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const correctBlock = `
    if (q.startsWith('insert into caffeine_logs')) {
      const nextId = (dbState.caffeine_logs.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) || 0) + 1;
      const row = {
        id: nextId,
        name: params[0],
        size: Number(params[1]),
        caffeine: Number(params[2]),
        caffeinePerMl: params[3] ?? null,
        icon: params[4] ?? null,
        isPreset: !!params[5],
        date: params[6],
        userId: params[7] ?? null,
        email: params[8] ?? null,
        createdAt: new Date().toISOString(),
      };
      dbState.caffeine_logs.push(row);
      persistDbState();
      return [makeResult(1, nextId)];
    }

    if (q.startsWith('select * from caffeine_logs where id = ?')) {
      const id = Number(params[0]);
      const rows = dbState.caffeine_logs.filter((r) => Number(r.id) === id);
      return [rows];
    }

    if (q.startsWith('delete from caffeine_logs where id = ?')) {
      const id = Number(params[0]);
      const before = dbState.caffeine_logs.length;
      dbState.caffeine_logs = dbState.caffeine_logs.filter((r) => Number(r.id) !== id);
      const affectedRows = before - dbState.caffeine_logs.length;
      if (affectedRows > 0) persistDbState();
      return [makeResult(affectedRows)];
    }

    if (q.startsWith('update caffeine_logs set name = ?, size = ?, caffeine = ?, icon = ? where id = ?')) {
      const name = params[0];
      const size = params[1];
      const caffeine = params[2];
      const icon = params[3];
      const id = Number(params[4]);
      
      const log = dbState.caffeine_logs.find((r) => Number(r.id) === id);
      if (!log) return [makeResult(0)];
      
      if (name !== undefined) log.name = name;
      if (size !== undefined) log.size = Number(size);
      if (caffeine !== undefined) log.caffeine = Number(caffeine);
      if (icon !== undefined) log.icon = icon;
      
      persistDbState();
      return [makeResult(1)];
    }
`;

// It currently has:
//     if (q.startsWith('insert into caffeine_logs')) {
//       const nextId = (dbState.caffeine_logs.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) || 0) + 1;
//       const row = {
//         id: nextId,
//         name: params[0],
//         size: Number(params[1]),
//         caffeine: Number(params[2]),
//       return [makeResult(affectedRows)];
//     }

const brokenBlockRegex = /if \(q\.startsWith\('insert into caffeine_logs'\)\) \{[\s\S]*?return \[makeResult\(affectedRows\)\];\s*\}/;

code = code.replace(brokenBlockRegex, correctBlock.trim());

fs.writeFileSync('server.js', code);
console.log('Restored correctly');
