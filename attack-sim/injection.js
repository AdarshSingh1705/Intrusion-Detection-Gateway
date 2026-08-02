const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8080';

const payloads = [
  { label: 'SQLi union select',   body: { username: "' UNION SELECT * FROM users--", password: 'x' } },
  { label: 'SQLi or 1=1',        body: { username: "' OR '1'='1", password: 'x' } },
  { label: 'SQLi drop table',    body: { username: 'x', password: "'; DROP TABLE users--" } },
  { label: 'XSS script tag',     body: { username: '<script>alert(1)</script>', password: 'x' } },
  { label: 'XSS onerror',        body: { username: '<img onerror=alert(1)>', password: 'x' } },
  { label: 'Benign (should pass)', body: { username: 'normaluser', password: 'normalpass' } },
];

async function run() {
  console.log('Running injection payloads...\n');
  for (const { label, body } of payloads) {
    const res = await fetch(`${GATEWAY}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    const expected = label.includes('Benign') ? '401/200' : '403';
    console.log(`[${res.status}] ${label} (expected ${expected})`);
    if (res.status === 403) console.log('  -> Blocked by Payload Guard ✓');
  }
}

run().catch(console.error);
