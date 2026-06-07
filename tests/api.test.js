import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const ADMIN_SECRET = 'et-admin-2024';

test('Bugfix 1: S3-Config-Request speichert und liefert Konfiguration', async () => {
  const testConfig = {
    endpoint: 'https://s3.example.com',
    region: 'us-east-1',
    bucket: 'test-bucket',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret'
  };

  // Speichere Config
  const saveRes = await fetch(`${BASE_URL}/admin/backup/s3/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': ADMIN_SECRET
    },
    body: JSON.stringify(testConfig)
  });

  assert.strictEqual(saveRes.status, 200, `Expected 200 OK, got ${saveRes.status}`);
  const saveBody = await saveRes.json();
  assert.strictEqual(saveBody.success, true, 'Expected success: true');

  // Lade Config (GET)
  const getRes = await fetch(`${BASE_URL}/admin/backup/s3/config`, {
    headers: { 'x-admin-secret': ADMIN_SECRET }
  });

  assert.strictEqual(getRes.status, 200, `Expected 200 OK, got ${getRes.status}`);
  const getBody = await getRes.json();
  assert.strictEqual(getBody.endpoint, testConfig.endpoint);
  assert.strictEqual(getBody.region, testConfig.region);
  assert.strictEqual(getBody.bucket, testConfig.bucket);
  assert.strictEqual(getBody.accessKeyId, testConfig.accessKeyId);
  // Das Secret wird maskiert gesendet
  assert.strictEqual(getBody.secretAccessKey, '••••••••');
});

test('Bugfix 2: UPDATE auf existierenden und nicht existierenden Log', async () => {
  // Erstelle zuerst ein Log
  const createRes = await fetch(`${BASE_URL}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Log API',
      size: 500,
      caffeine: 160,
      date: '2026-06-07'
    })
  });
  
  assert.strictEqual(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
  const createdLog = await createRes.json();
  const logId = createdLog.id;

  // Update auf existierenden Log
  const updateRes = await fetch(`${BASE_URL}/logs/${logId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Log Updated',
      size: 330,
      caffeine: 100,
      icon: '🧊'
    })
  });
  assert.strictEqual(updateRes.status, 200, `Expected 200 OK, got ${updateRes.status}`);
  const updatedLog = await updateRes.json();
  assert.strictEqual(updatedLog.name, 'Test Log Updated');

  // Update auf nicht existierenden Log
  const fakeId = 9999999;
  const failUpdateRes = await fetch(`${BASE_URL}/logs/${fakeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ghost Log',
      size: 100,
      caffeine: 50
    })
  });
  
  // Muss 404 zurückliefern
  assert.strictEqual(failUpdateRes.status, 404, `Expected 404 Not Found, got ${failUpdateRes.status}`);
  const failBody = await failUpdateRes.json();
  assert.strictEqual(failBody.error, 'Log nicht gefunden.');

  // Cleanup: lösche erstellten Log
  await fetch(`${BASE_URL}/logs/${logId}`, { method: 'DELETE' });
});
