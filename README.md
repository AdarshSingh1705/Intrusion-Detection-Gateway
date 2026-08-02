# Intrusion Detection & Containment Gateway

A reverse-proxy security gateway that sits in front of any web application and inspects every request in real time. It detects and blocks brute-force attacks, credential stuffing, application-layer DoS floods, and SQL injection / XSS payloads — before they ever reach the origin server.

---

## How it works

Every incoming request passes through three independent guards running in parallel:

```
Client → Gateway (guards run in parallel) → Decision Engine → Allow / Throttle / Block / Challenge
                                                            ↓ (on allow)
                                                       Origin Server
```

| Guard | Detects | Mechanism |
|---|---|---|
| Auth Guard | Brute-force, credential stuffing | Redis fail counters per username + IP |
| Rate Guard | Application-layer DoS / API abuse | Fixed-window Redis counter per IP |
| Payload Guard | SQLi, XSS | Regex signature matching on body, query, cookies |

The Decision Engine merges the three verdicts using a fixed priority order (injection > auth > rate > suspicious > allow) and returns one final action.

---

## Services

| Service | Port | Description |
|---|---|---|
| `gateway` | 8080 | Reverse proxy + all guards + management API |
| `demo-site` | 4000 | Deliberately unprotected "victim" app |
| `redis` | 6379 | Fast state — rate counters, blocklists, token revocation |
| `mongo` | 27017 | Durable state — events, alerts, users, tenants |
| `dashboard` | 3000 | React control plane (coming soon) |

---

## Getting started

**1. Clone and configure**
```bash
git clone <repo-url>
cd intrusion-detection-gateway
cp .env.example .env
```

Edit `.env` and set at minimum:
```
JWT_SECRET=your_strong_secret_here
```

**2. Start everything**
```bash
docker compose up --build
```

**3. Verify it's running**
```bash
curl http://localhost:8080/
# → HTML login page from demo-site (proxied through the gateway)
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Gateway port (default `8080`) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Secret for signing access + refresh tokens |
| `JWT_ACCESS_TTL` | No | Access token lifetime (default `15m`) |
| `JWT_REFRESH_TTL` | No | Refresh token lifetime (default `7d`) |
| `DEMO_SITE_ORIGIN_URL` | No | Origin to proxy to (default `http://demo-site:4000`) |
| `BREVO_API_KEY` | No | Brevo API key — enables email alerts on block events |
| `ALERT_SENDER_EMAIL` | No | From address for alert emails |
| `ADMIN_ALERT_EMAIL` | No | Destination address for alert emails |

---

## API Reference

### Auth — public endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/auth/signup` | `{ username, password }` | `201 { userId }` |
| `POST` | `/auth/login` | `{ username, password }` | `200 { accessToken, refreshToken }` |
| `POST` | `/auth/refresh` | `{ refreshToken }` | `200 { accessToken }` |

Login responses:
- `401` — invalid credentials
- `423` — account locked (brute-force threshold reached)
- `403` — blocked by guard (injection or credential stuffing)

### Management API — requires `Authorization: Bearer <accessToken>`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events?since=&severity=&limit=` | Filterable event log |
| `GET` | `/api/events/ip/:ip` | All events for a specific IP |
| `GET` | `/api/alerts?acknowledged=false` | Unacknowledged alerts |
| `PATCH` | `/api/alerts/:id/acknowledge` | Mark an alert as handled |
| `POST` | `/api/blocklist/:ip` | Manually block an IP (15 min TTL) |
| `DELETE` | `/api/blocklist/:ip` | Manually unblock an IP |

### Tenant onboarding

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/tenants` | `{ domain, originUrl }` | `201 { tenantId, apiKey }` — key shown once |
| `GET` | `/api/tenants/:tenantId` | — | `200 { tenant config }` |
| `PATCH` | `/api/tenants/:tenantId/thresholds` | `{ authFailMax, rateWarnMax, rateBlockMax }` | `200` |

---

## Testing the guards

### Auth Guard — brute-force

Sign up a user first, then run the brute-force sim:
```bash
# Sign up
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"correctpass"}'

# Run brute-force sim
cd attack-sim && node bruteforce.js
```

Expected: attempts 1–4 return `401`, attempt 5 returns `423 account_locked`.

### Rate Guard — flood

```bash
cd attack-sim && node flood.js
```

Expected: requests 1–5 return `200`, 6–10 return `429` (throttle), 11+ return `403` (blocked).

> Default thresholds in `gateway/config/defaultTenant.js` are set to `rateWarnMax: 5, rateBlockMax: 10` for easy testing.

### Payload Guard — injection

```bash
cd attack-sim && node injection.js
```

Expected: all SQLi/XSS payloads return `403`, the benign request returns `401` (wrong password, not blocked).

---

## Circuit breaker

The gateway monitors the origin server every 10 seconds. If ≥50% of the last 20 pings fail, the circuit opens and all requests receive a `503` holding page instead of hanging. After a 30-second cooldown it moves to half-open and lets one probe request through. On success it closes again.

To test: stop the demo-site container and watch the gateway switch to the holding page within ~10 seconds.

```bash
docker compose stop demo-site
```

---

## Project structure

```
intrusion-detection-gateway/
├── gateway/
│   ├── config/          # DB, Redis, signature patterns
│   ├── guards/          # authGuard, rateGuard, payloadGuard
│   ├── core/            # decisionEngine, runGuards
│   ├── middleware/      # logger, adminAuth, circuitBreaker, tenantScope, guardCheck
│   ├── models/          # Tenant, User, Event, Alert (Mongoose schemas)
│   ├── routes/          # auth, api, tenants
│   ├── services/        # lockout, throttle, alerting, healthMonitor
│   ├── proxy.js         # Main proxy handler
│   └── server.js        # Entry point
├── dashboard/           # React control plane (in progress)
├── demo-site/           # Unprotected origin app
├── attack-sim/          # bruteforce.js, flood.js, injection.js
├── docker-compose.yml
└── .env.example
```

---

## Architecture decisions

- **Fail-open on Redis errors** — if Redis is unreachable, guards skip their checks and log a degraded event rather than blocking all traffic
- **Fire-and-forget logging** — event writes to MongoDB never block the response path
- **Fixed-window rate limiting** — allows up to 2x burst at window boundaries; sliding window is a documented future improvement
- **Guards run in parallel** — `Promise.all` keeps detection latency minimal regardless of how many guards run
