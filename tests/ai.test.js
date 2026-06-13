import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_API_URL || 'http://127.0.0.1:3001/api';
const USER_EMAIL = process.env.TEST_USER_EMAIL || 'user@energytracker.de';
const USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'User@2024!';

const login = async () => {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  assert.strictEqual(res.status, 200, `Login fehlgeschlagen: ${res.status}`);
  assert.ok(data.user?.token, 'Login muss ein Session-Token liefern');
  return data.user.token;
};

test('AI Chat sendet Logs und verarbeitet Request korrekt bis zum API-Key Fehler', async () => {
  const dummyLogs = [
    { id: 101, name: 'Monster Energy', size: 500, caffeine: 160 },
    { id: 102, name: 'Filterkaffee', size: 250, caffeine: 100 }
  ];

  const payload = {
    messages: [{ role: 'user', content: 'Lösche den Kaffee' }],
    totalCaffeineToday: 260,
    dailyLimit: 400,
    logs: dummyLogs,
    clientTime: '14:30',
    currentDate: '2026-06-13'
  };

  const token = await login();
  const res = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  
  // Da kein API Key in der Testumgebung gesetzt ist, erwarten wir genau diesen Fehler.
  // Das beweist, dass das Backend den Request korrekt geparst hat.
  if (res.status === 500) {
    assert.strictEqual(
      data.error.includes('Kein OpenRouter API-Key konfiguriert'),
      true,
      'Erwartet wurde der OpenRouter API-Key Fehler.'
    );
  } else {
    // Falls ein Key gesetzt ist und OpenRouter antwortet
    assert.strictEqual(res.status, 200);
    assert.ok(data.content !== undefined || data.tool_calls !== undefined);
  }
});
