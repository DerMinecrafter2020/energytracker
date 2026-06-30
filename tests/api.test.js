import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@energytracker.de';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin@2024!';
const USER_EMAIL = process.env.TEST_USER_EMAIL || 'user@energytracker.de';
const USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'User@2024!';

const login = async (email, password) => {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  assert.strictEqual(res.status, 200, `Login fuer ${email} fehlgeschlagen: ${res.status}`);
  const body = await res.json();
  assert.ok(body.user?.token, 'Login muss ein Session-Token liefern');
  return body.user.token;
};

const authHeaders = (token, extra = {}) => ({
  Authorization: `Bearer ${token}`,
  ...extra,
});

test('Admin-API akzeptiert Bearer-Token und weist alte Secret-Header ab', async () => {
  const unauthenticatedRes = await fetch(`${BASE_URL}/admin/users`);
  assert.strictEqual(unauthenticatedRes.status, 401);

  const oldSecretRes = await fetch(`${BASE_URL}/admin/users`, {
    headers: { 'x-admin-secret': 'et-admin-2024' },
  });
  assert.strictEqual(oldSecretRes.status, 401);

  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminRes = await fetch(`${BASE_URL}/admin/users`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(adminRes.status, 200, `Expected 200 OK, got ${adminRes.status}`);
  const users = await adminRes.json();
  assert.ok(Array.isArray(users), 'Admin-Benutzerliste muss ein Array sein');
});

test('Admin kann Datenbank exportieren und dasselbe Backup wieder importieren', async () => {
  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const s3StatusRes = await fetch(`${BASE_URL}/admin/s3/status`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(s3StatusRes.status, 200, `Expected 200 OK, got ${s3StatusRes.status}`);
  const s3Status = await s3StatusRes.json();
  assert.strictEqual(typeof s3Status.configured, 'boolean');

  const exportRes = await fetch(`${BASE_URL}/admin/database/export`, {
    headers: authHeaders(token),
  });

  assert.strictEqual(exportRes.status, 200, `Expected 200 OK, got ${exportRes.status}`);
  assert.match(exportRes.headers.get('content-disposition') || '', /\.db"/);
  const backup = await exportRes.json();
  assert.strictEqual(backup.type, 'koffein-tracker-db-export');
  assert.strictEqual(backup.scope, 'full');
  assert.ok(backup.database, 'Backup muss database enthalten');
  assert.ok(Array.isArray(backup.database.caffeine_logs), 'Backup muss caffeine_logs als Array enthalten');
  assert.ok(Array.isArray(backup.database.users), 'Backup muss users als Array enthalten');
  assert.ok(backup.database.ai_config, 'Backup muss AI/API-Key-Konfiguration enthalten');
  assert.ok(backup.database.s3_settings, 'Backup muss S3-Konfiguration enthalten');

  const usersExportRes = await fetch(`${BASE_URL}/admin/database/export?scope=users`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(usersExportRes.status, 200, `Expected 200 OK, got ${usersExportRes.status}`);
  const usersBackup = await usersExportRes.json();
  assert.strictEqual(usersBackup.scope, 'users');
  assert.ok(Array.isArray(usersBackup.database.users), 'Benutzer-Backup muss users enthalten');
  assert.strictEqual(usersBackup.database.caffeine_logs, undefined);

  const logsExportRes = await fetch(`${BASE_URL}/admin/database/export?scope=logs`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(logsExportRes.status, 200, `Expected 200 OK, got ${logsExportRes.status}`);
  const logsBackup = await logsExportRes.json();
  assert.strictEqual(logsBackup.scope, 'logs');
  assert.ok(Array.isArray(logsBackup.database.caffeine_logs), 'Log-Backup muss caffeine_logs enthalten');
  assert.strictEqual(logsBackup.database.users, undefined);

  const keysExportRes = await fetch(`${BASE_URL}/admin/database/export?scope=api-keys`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(keysExportRes.status, 200, `Expected 200 OK, got ${keysExportRes.status}`);
  const keysBackup = await keysExportRes.json();
  assert.strictEqual(keysBackup.scope, 'api-keys');
  assert.ok(keysBackup.database.ai_config, 'API-Key-Backup muss ai_config enthalten');
  assert.ok(keysBackup.database.s3_settings, 'API-Key-Backup muss s3_settings enthalten');

  const s3ConfigRes = await fetch(`${BASE_URL}/admin/s3/config`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      bucket: 'test-backup-bucket',
      region: 'eu-central-1',
      endpoint: 'https://s3.example.invalid',
      prefix: 'tests/backups',
      forcePathStyle: true,
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    }),
  });
  assert.strictEqual(s3ConfigRes.status, 200, `Expected 200 OK, got ${s3ConfigRes.status}`);
  const s3Config = await s3ConfigRes.json();
  assert.strictEqual(s3Config.settings.configured, true);
  assert.strictEqual(s3Config.settings.bucket, 'test-backup-bucket');

  const shortEncryptionPasswordRes = await fetch(`${BASE_URL}/admin/app-settings`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ secretEncryptionPassword: 'zu-kurz' }),
  });
  assert.strictEqual(shortEncryptionPasswordRes.status, 400);

  const encryptionPassword = '0123456789abcdef0123456789abcdef';
  const encryptionPasswordRes = await fetch(`${BASE_URL}/admin/app-settings`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ secretEncryptionPassword: encryptionPassword }),
  });
  assert.strictEqual(encryptionPasswordRes.status, 200, `Expected 200 OK, got ${encryptionPasswordRes.status}`);
  const encryptionSettings = await encryptionPasswordRes.json();
  assert.strictEqual(encryptionSettings.settings.secretEncryption.adminKeySet, true);
  assert.strictEqual(JSON.stringify(encryptionSettings).includes(encryptionPassword), false);

  const encryptedKeysExportRes = await fetch(`${BASE_URL}/admin/database/export?scope=api-keys`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(encryptedKeysExportRes.status, 200, `Expected 200 OK, got ${encryptedKeysExportRes.status}`);
  const encryptedKeysBackup = await encryptedKeysExportRes.json();
  assert.match(encryptedKeysBackup.database.s3_settings.accessKeyId, /^enc:v1:/);
  assert.match(encryptedKeysBackup.database.s3_settings.secretAccessKey, /^enc:v1:/);
  assert.notStrictEqual(encryptedKeysBackup.database.s3_settings.accessKeyId, 'test-access-key');
  assert.notStrictEqual(encryptedKeysBackup.database.s3_settings.secretAccessKey, 'test-secret-key');

  const importRes = await fetch(`${BASE_URL}/admin/database/import`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ backup }),
  });

  assert.strictEqual(importRes.status, 200, `Expected 200 OK, got ${importRes.status}`);
  const importBody = await importRes.json();
  assert.strictEqual(importBody.success, true);
  assert.ok(importBody.summary, 'Import muss eine Zusammenfassung liefern');
});

test('Theme-Einstellung wird pro Benutzer gespeichert und validiert', async () => {
  const token = await login(USER_EMAIL, USER_PASSWORD);
  const originalRes = await fetch(`${BASE_URL}/settings/me`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(originalRes.status, 200, `Expected 200 OK, got ${originalRes.status}`);
  const original = await originalRes.json();

  try {
    const saveRes = await fetch(`${BASE_URL}/settings/me`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ theme: 'cyber' }),
    });
    assert.strictEqual(saveRes.status, 200, `Expected 200 OK, got ${saveRes.status}`);
    const saved = await saveRes.json();
    assert.strictEqual(saved.theme, 'cyber');

    const reloadRes = await fetch(`${BASE_URL}/settings/me`, {
      headers: authHeaders(token),
    });
    assert.strictEqual(reloadRes.status, 200, `Expected 200 OK, got ${reloadRes.status}`);
    const reloaded = await reloadRes.json();
    assert.strictEqual(reloaded.theme, 'cyber');

    const invalidRes = await fetch(`${BASE_URL}/settings/me`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ theme: 'does-not-exist' }),
    });
    assert.strictEqual(invalidRes.status, 200, `Expected 200 OK, got ${invalidRes.status}`);
    const invalid = await invalidRes.json();
    assert.strictEqual(invalid.theme, 'system');
  } finally {
    await fetch(`${BASE_URL}/settings/me`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ theme: original.theme || 'system' }),
    });
  }
});

test('Admin kann API-Testanzeige abrufen', async () => {
  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const res = await fetch(`${BASE_URL}/admin/tests/api`, {
    headers: authHeaders(token),
  });

  assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
  const body = await res.json();
  assert.strictEqual(body.exists, true);
  assert.ok(body.file.endsWith('tests/api.test.js'), 'Testanzeige muss api.test.js referenzieren');
  assert.ok(Array.isArray(body.tests), 'Testanzeige muss Testfälle als Array liefern');
  assert.ok(body.total >= 1, 'Mindestens ein Testfall muss erkannt werden');
  assert.ok(body.tests.some((entry) => entry.name.includes('Theme-Einstellung')), 'Theme-Test muss in der Anzeige enthalten sein');
});

test('Admin kann globale Eingabeart zwischen KI und manuell umschalten', async () => {
  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const originalRes = await fetch(`${BASE_URL}/admin/app-settings`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(originalRes.status, 200, `Expected 200 OK, got ${originalRes.status}`);
  const original = await originalRes.json();

  try {
    const saveRes = await fetch(`${BASE_URL}/admin/app-settings`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ entryMode: 'manual' }),
    });
    assert.strictEqual(saveRes.status, 200, `Expected 200 OK, got ${saveRes.status}`);
    const saved = await saveRes.json();
    assert.strictEqual(saved.settings.entryMode, 'manual');

    const publicRes = await fetch(`${BASE_URL}/settings/public`);
    assert.strictEqual(publicRes.status, 200, `Expected 200 OK, got ${publicRes.status}`);
    const publicSettings = await publicRes.json();
    assert.strictEqual(publicSettings.entryMode, 'manual');

    const invalidRes = await fetch(`${BASE_URL}/admin/app-settings`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ entryMode: 'unknown' }),
    });
    assert.strictEqual(invalidRes.status, 200, `Expected 200 OK, got ${invalidRes.status}`);
    const invalid = await invalidRes.json();
    assert.strictEqual(invalid.settings.entryMode, 'ai');
  } finally {
    await fetch(`${BASE_URL}/admin/app-settings`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ entryMode: original.entryMode || 'ai' }),
    });
  }
});

test('Public Settings liefern Demo-Zugangsdaten fuer Demo-Buttons', async () => {
  const res = await fetch(`${BASE_URL}/settings/public`);
  assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
  const body = await res.json();

  if (body.demoEnabled) {
    assert.strictEqual(body.demoCredentials?.admin?.email, ADMIN_EMAIL);
    assert.strictEqual(body.demoCredentials?.admin?.password, ADMIN_PASSWORD);
    assert.strictEqual(body.demoCredentials?.user?.email, USER_EMAIL);
    assert.strictEqual(body.demoCredentials?.user?.password, USER_PASSWORD);
  } else {
    assert.strictEqual(body.demoCredentials, null);
  }
});

test('Startseiten Export mailt PDF und Tagesziel-Spruch ist abrufbar', async () => {
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  let userToken = await login(USER_EMAIL, USER_PASSWORD);
  const exportRes = await fetch(`${BASE_URL}/admin/database/export`, {
    headers: authHeaders(adminToken),
  });
  assert.strictEqual(exportRes.status, 200);
  const backup = await exportRes.json();

  try {
    const smtpRes = await fetch(`${BASE_URL}/admin/smtp`, {
      method: 'POST',
      headers: authHeaders(adminToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        host: 'mailpit',
        port: 1025,
        secure: false,
        auth: { user: '', pass: '' },
        fromName: 'Koffein-Tracker',
        fromEmail: 'tracker@example.test',
        baseUrl: 'http://localhost:3001',
        registrationEnabled: true,
        demoEnabled: true,
      }),
    });
    assert.strictEqual(smtpRes.status, 200, `Expected 200 OK, got ${smtpRes.status}`);

    const updatedEmail = 'pdf-export-user@example.test';
    const profileRes = await fetch(`${BASE_URL}/user/profile`, {
      method: 'POST',
      headers: authHeaders(userToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        currentPassword: USER_PASSWORD,
        newName: 'PDF Export User',
        newEmail: updatedEmail,
      }),
    });
    assert.strictEqual(profileRes.status, 200, `Expected 200 OK, got ${profileRes.status}`);
    const profileBody = await profileRes.json();
    assert.strictEqual(profileBody.email, updatedEmail);
    userToken = profileBody.token;

    const mailRes = await fetch(`${BASE_URL}/export/logs/email-pdf`, {
      method: 'POST',
      headers: authHeaders(userToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ start: '2026-06-01', end: '2026-06-30', email: 'falsch@example.test' }),
    });
    assert.strictEqual(mailRes.status, 200, `Expected 200 OK, got ${mailRes.status}`);
    const mailBody = await mailRes.json();
    assert.strictEqual(mailBody.success, true);
    assert.strictEqual(mailBody.to, updatedEmail);
    assert.match(mailBody.filename, /\.pdf$/);
    assert.ok(Number(mailBody.size || 0) > 100, 'PDF-Anhang muss Inhalt haben');

    const quoteRes = await fetch(`${BASE_URL}/ai/daily-hydration?date=2026-06-29`, {
      headers: authHeaders(userToken),
    });
    assert.strictEqual(quoteRes.status, 200, `Expected 200 OK, got ${quoteRes.status}`);
    const quoteBody = await quoteRes.json();
    assert.strictEqual(quoteBody.date, '2026-06-29');
    assert.ok(String(quoteBody.quote || '').length >= 8, 'Tagesziel-Spruch muss Text enthalten');
  } finally {
    await fetch(`${BASE_URL}/admin/database/import`, {
      method: 'POST',
      headers: authHeaders(adminToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ backup }),
    });
  }
});

test('Version 3 liefert Tagescoach, Rekorde und erweiterte Muster', async () => {
  const token = await login(USER_EMAIL, USER_PASSWORD);

  const coachRes = await fetch(`${BASE_URL}/ai/daily-coach?date=2026-06-29`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(coachRes.status, 200, `Expected 200 OK, got ${coachRes.status}`);
  const coach = await coachRes.json();
  assert.strictEqual(coach.date, '2026-06-29');
  assert.ok(['low', 'medium', 'high'].includes(coach.risk));
  assert.ok(String(coach.headline || '').length > 0);
  assert.ok(Array.isArray(coach.actions));

  const recordsRes = await fetch(`${BASE_URL}/stats/records`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(recordsRes.status, 200, `Expected 200 OK, got ${recordsRes.status}`);
  const records = await recordsRes.json();
  assert.ok(records.range?.start);
  assert.strictEqual(typeof records.currentUnderLimitStreak, 'number');
  assert.strictEqual(typeof records.longestUnderLimitStreak, 'number');

  const insightsRes = await fetch(`${BASE_URL}/insights/me`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(insightsRes.status, 200, `Expected 200 OK, got ${insightsRes.status}`);
  const insights = await insightsRes.json();
  assert.ok(['low', 'medium', 'high'].includes(insights.riskLevel));
  assert.strictEqual(typeof insights.riskScore, 'number');
  assert.ok(String(insights.focus || '').length > 0);
});

test('Discord Webhook wird gespeichert und AI Scheduling funktioniert fuer angemeldete Benutzer', async () => {
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const userToken = await login(USER_EMAIL, USER_PASSWORD);
  const exportRes = await fetch(`${BASE_URL}/admin/database/export`, {
    headers: authHeaders(adminToken),
  });
  assert.strictEqual(exportRes.status, 200);
  const backup = await exportRes.json();

  try {
    const webhookUrl = 'https://discord.com/api/webhooks/123456789/test-token';
    const saveRes = await fetch(`${BASE_URL}/admin/discord/webhook`, {
      method: 'POST',
      headers: authHeaders(adminToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ webhookUrl }),
    });
    assert.strictEqual(saveRes.status, 200, `Expected 200 OK, got ${saveRes.status}`);
    const saveBody = await saveRes.json();
    assert.strictEqual(saveBody.webhookConfigured, true);

    const getRes = await fetch(`${BASE_URL}/admin/smtp`, {
      headers: authHeaders(adminToken),
    });
    assert.strictEqual(getRes.status, 200);
    const cfg = await getRes.json();
    assert.strictEqual(cfg.discordWebhook, webhookUrl);

    const scheduleRes = await fetch(`${BASE_URL}/ai/schedule-discord`, {
      method: 'POST',
      headers: authHeaders(userToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ time: '23:59', message: 'Testnachricht' }),
    });
    assert.strictEqual(scheduleRes.status, 200, `Expected 200 OK, got ${scheduleRes.status}`);
    const scheduleBody = await scheduleRes.json();
    assert.strictEqual(scheduleBody.success, true);
    assert.ok(scheduleBody.runAt, 'Geplante Discord-Nachricht muss runAt enthalten');

    const statusRes = await fetch(`${BASE_URL}/admin/discord-ai/status`, {
      headers: authHeaders(adminToken),
    });
    assert.strictEqual(statusRes.status, 200, `Expected 200 OK, got ${statusRes.status}`);
    const status = await statusRes.json();
    assert.strictEqual(status.running, true);
    assert.strictEqual(status.webhookConfigured, true);
    assert.ok(Number(status.counts?.pending || 0) >= 1, 'Mindestens eine Discord-KI-Nachricht muss offen sein');
  } finally {
    await fetch(`${BASE_URL}/admin/database/import`, {
      method: 'POST',
      headers: authHeaders(adminToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ backup }),
    });
  }
});

test('Log-API ist pro Benutzer geschuetzt und bleibt editierbar', async () => {
  const unauthenticatedCreate = await fetch(`${BASE_URL}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Unauthenticated Test Log',
      size: 250,
      caffeine: 80,
      date: '2026-06-07',
    }),
  });
  assert.strictEqual(unauthenticatedCreate.status, 401);

  const token = await login(USER_EMAIL, USER_PASSWORD);
  const createRes = await fetch(`${BASE_URL}/logs`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: 'Test Log API',
      size: 500,
      caffeine: 160,
      date: '2026-06-07',
    }),
  });

  assert.strictEqual(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
  const createdLog = await createRes.json();
  const logId = createdLog.id;

  try {
    const updateRes = await fetch(`${BASE_URL}/logs/${logId}`, {
      method: 'PUT',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name: 'Test Log Updated',
        size: 330,
        caffeine: 100,
        icon: 'Test',
      }),
    });
    assert.strictEqual(updateRes.status, 200, `Expected 200 OK, got ${updateRes.status}`);
    const updatedLog = await updateRes.json();
    assert.strictEqual(updatedLog.name, 'Test Log Updated');

    const fakeId = 9999999;
    const failUpdateRes = await fetch(`${BASE_URL}/logs/${fakeId}`, {
      method: 'PUT',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name: 'Ghost Log',
        size: 100,
        caffeine: 50,
      }),
    });

    assert.strictEqual(failUpdateRes.status, 404, `Expected 404 Not Found, got ${failUpdateRes.status}`);
    const failBody = await failUpdateRes.json();
    assert.strictEqual(failBody.error, 'Log nicht gefunden.');
  } finally {
    await fetch(`${BASE_URL}/logs/${logId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  }
});

test('Benutzer koennen fremde Logs weder abfragen noch loeschen', async () => {
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const userToken = await login(USER_EMAIL, USER_PASSWORD);
  const testDate = '2026-06-14';

  const createRes = await fetch(`${BASE_URL}/logs`, {
    method: 'POST',
    headers: authHeaders(adminToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: 'Admin Isolation Test',
      size: 100,
      caffeine: 50,
      date: testDate,
    }),
  });

  assert.strictEqual(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
  const adminLog = await createRes.json();

  try {
    const deleteAsUserRes = await fetch(`${BASE_URL}/logs/${adminLog.id}`, {
      method: 'DELETE',
      headers: authHeaders(userToken),
    });
    assert.strictEqual(deleteAsUserRes.status, 403);

    const queryAsUserRes = await fetch(`${BASE_URL}/logs?date=${testDate}&email=${ADMIN_EMAIL}`, {
      headers: authHeaders(userToken),
    });
    assert.strictEqual(queryAsUserRes.status, 200);
    const rows = await queryAsUserRes.json();
    assert.ok(Array.isArray(rows), 'Log-Liste muss ein Array sein');
    assert.strictEqual(rows.some((row) => String(row.id) === String(adminLog.id)), false);
  } finally {
    await fetch(`${BASE_URL}/logs/${adminLog.id}`, {
      method: 'DELETE',
      headers: authHeaders(adminToken),
    });
  }
});
