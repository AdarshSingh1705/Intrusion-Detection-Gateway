const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8080';

const payloads = [
  {
    label: 'SQLi union select',
    body: {
      username: "' UNION SELECT * FROM users--",
      password: 'x',
    },
    expected: [403],
  },
  {
    label: 'SQLi or 1=1',
    body: {
      username: "' OR '1'='1",
      password: 'x',
    },
    expected: [403],
  },
  {
    label: 'SQLi drop table',
    body: {
      username: 'x',
      password: "'; DROP TABLE users--",
    },
    expected: [403],
  },
  {
    label: 'XSS script tag',
    body: {
      username: '<script>alert(1)</script>',
      password: 'x',
    },
    expected: [403],
  },
  {
    label: 'XSS onerror',
    body: {
      username: '<img onerror=alert(1)>',
      password: 'x',
    },
    expected: [403],
  },
  {
    label: 'Benign',
    body: {
      username: 'normaluser',
      password: 'normalpass',
    },
    expected: [401],
  },
];

async function run() {
  console.log('Running injection payload tests...\n');

  let failures = 0;

  for (const { label, body, expected } of payloads) {
    const res = await fetch(`${GATEWAY}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let result;
    try {
      result = text ? JSON.parse(text) : null;
    } catch {
      result = text;
    }

    const passed = expected.includes(res.status);

    console.log(
      `[${res.status}] ${label} ` +
      `(expected ${expected.join('/')}) ` +
      `${passed ? 'PASS' : 'FAIL'}`
    );

    if (!passed) {
      console.log('  Response:', result);
      failures++;
    }
  }

  console.log(`\nInjection test result: ${failures === 0 ? 'PASS' : 'FAIL'}`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});