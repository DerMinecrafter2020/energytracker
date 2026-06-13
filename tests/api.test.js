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
