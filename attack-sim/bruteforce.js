const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8080';
const USERNAME = process.env.TARGET_USER || 'testuser';
const ATTEMPTS = 10;

async function run() {
  console.log(`Brute-forcing ${USERNAME} with ${ATTEMPTS} attempts...`);
  for (let i = 1; i <= ATTEMPTS; i++) {
    const res = await fetch(`${GATEWAY}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: `wrongpass${i}` }),
    });
    const body = await res.json();
    console.log(`Attempt ${i}: ${res.status}`, body);
    if (res.status === 423) {
      console.log('Account locked — Auth Guard triggered successfully');
      break;
    }
  }
}

run().catch(console.error);
