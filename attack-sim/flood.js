const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8080';
const REQUESTS = 20;

async function run() {
  console.log(`Flooding with ${REQUESTS} rapid requests...`);
  const results = await Promise.all(
    Array.from({ length: REQUESTS }, async (_, i) => {
      const res = await fetch(`${GATEWAY}/`, { method: 'GET' });
      return { i: i + 1, status: res.status };
    })
  );
  results.forEach(({ i, status }) => console.log(`Request ${i}: ${status}`));

  const throttled = results.filter((r) => r.status === 429).length;
  const blocked = results.filter((r) => r.status === 403).length;
  console.log(`\nThrottled (429): ${throttled} | Blocked (403): ${blocked}`);
}

run().catch(console.error);
