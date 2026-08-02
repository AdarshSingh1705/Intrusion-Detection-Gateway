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
| `dashboard` | 3000 | React control plane — Live Feed, Investigate, Settings |

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

**4. Open the dashboard**

Navigate to `http://localhost:3000` and log in with the seeded admin credentials (default: `admin` / `admin123`).

---

## Bootstrap / Seed

On first boot the gateway automatically creates:

| Resource | Value |
|---|---|
| Admin user | `ADMIN_USERNAME` / `ADMIN_PASSWORD` (from `.env`) |
| Default tenant | `tenantId: "default"` with test thresholds |

The seed is idempotent — it checks for existence before creating, so it is safe to run on every restart.

To reset and re-seed with different credentials:
```bash
docker compose down -v          # wipe MongoDB volume
# edit ADMIN_USERNAME / ADMIN_PASSWORD in .env
docker compose up --build
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
| `ADMIN_USERNAME` | No | Seeded admin username (default `admin`) |
| `ADMIN_PASSWORD` | No | Seeded admin password (default `admin123`) |
| `DEMO_SITE_ORIGIN_URL` | No | Origin to proxy to (default `http://demo-site:4000`) |
| `BREVO_API_KEY` | No | Brevo API key — enables email alerts (admin + user notifications) |
| `ALERT_SENDER_EMAIL` | No | From address for all alert emails |
| `ADMIN_ALERT_EMAIL` | No | Destination address for admin security alerts |

---

## Email notifications (Brevo)

The gateway sends two categories of email when `BREVO_API_KEY` is set:

| Trigger | Recipient | Subject |
|---|---|---|
| Guard fires (block/throttle event) | Admin (`ADMIN_ALERT_EMAIL`) | `[Gateway Alert] <rule> — <severity>` |
| Account locked after brute-force | Affected user (their registered email) | `Your account has been locked` |
| IP blocked after credential stuffing / flood | Affected user (their registered email) | `Suspicious activity detected on your account` |

All three are **fire-and-forget** — a Brevo failure never blocks the response path.

If `BREVO_API_KEY` is not set, the gateway runs normally. Alerts are still written to MongoDB and visible in the dashboard. No emails are sent and no errors are thrown.

To register a user with an email address so they can receive notifications:
```bash
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret","email":"alice@example.com"}'
```

---

## API Reference

### Auth — public endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/auth/signup` | `{ username, password, email? }` | `201 { userId }` |
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
# Sign up (email is optional but enables lockout notification)
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"correctpass","email":"testuser@example.com"}'

# Run brute-force sim
cd attack-sim && node bruteforce.js
```

Expected: attempts 1–4 return `401`, attempt 5 returns `423 account_locked`.
If Brevo is configured, `testuser@example.com` receives a lockout notification email.

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

The gateway monitors the origin server every 10 seconds. If ≥50% of the last 5 pings fail, the circuit opens and all requests receive a `503` holding page instead of hanging. After a 30-second cooldown it moves to half-open and lets one probe request through. On success it closes again.

To test: stop the demo-site container and watch the gateway switch to the holding page within ~10 seconds.

```bash
docker compose stop demo-site
```

---

## Dashboard

The React dashboard at `http://localhost:3000` provides three views:

| Page | Description |
|---|---|
| Live Feed | Auto-refreshing event log (5 s poll), alert banner, manual block button |
| Investigate | IP lookup — full event history, summary stats, block / unblock controls |
| Settings | Live threshold sliders — changes persist to MongoDB via the management API |

Log in with the seeded admin credentials. The dashboard proxies `/api` and `/auth` to the gateway so no CORS configuration is needed.

---

## Project structure

```
intrusion-detection-gateway/
├── gateway/
│   ├── config/
│   │   ├── db.js                # Mongoose connection
│   │   ├── redis.js             # ioredis client
│   │   ├── signatures.js        # SQLi / XSS regex patterns
│   │   └── defaultTenant.js     # Test thresholds (authFailMax:5, rateWarnMax:5, rateBlockMax:10)
│   ├── guards/
│   │   ├── authGuard.js         # Brute-force pre-check
│   │   ├── rateGuard.js         # Fixed-window flood detection
│   │   └── payloadGuard.js      # Signature matching
│   ├── core/
│   │   ├── decisionEngine.js    # Merges 3 verdicts → final action
│   │   └── runGuards.js         # Promise.all + logEvent + sendAlert
│   ├── middleware/
│   │   ├── adminAuth.js         # JWT verification for /api/*
│   │   ├── circuitBreaker.js    # 503 holding page when circuit open
│   │   ├── guardCheck.js        # Runs guards on /auth/* before route handler
│   │   ├── logger.js            # Fire-and-forget Event.create
│   │   └── tenantScope.js       # Sets req.tenantId = 'default'
│   ├── models/
│   │   ├── Alert.js
│   │   ├── Event.js
│   │   ├── Tenant.js
│   │   └── User.js              # Includes optional email field
│   ├── routes/
│   │   ├── auth.js              # signup (email?), login, refresh
│   │   ├── api.js               # Management API (6 endpoints)
│   │   └── tenants.js           # Tenant CRUD + threshold patch
│   ├── services/
│   │   ├── alerting.js          # sendAlert (admin email) + notifyUser (user email)
│   │   ├── healthMonitor.js     # Circuit breaker state machine
│   │   ├── lockout.js           # Redis account lockout
│   │   └── throttle.js          # Redis IP blocklist
│   ├── proxy.js                 # Fast-path blocklist check → runGuards → proxy
│   ├── seed.js                  # Creates admin user + default tenant on first boot
│   └── server.js                # Entry point
├── dashboard/
│   ├── src/
│   │   ├── api/client.js        # Fetch wrapper with auth header
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── LiveFeed.jsx
│   │   │   ├── Investigate.jsx
│   │   │   └── Settings.jsx
│   │   └── App.jsx              # Router + protected route guard
│   └── vite.config.js           # Proxies /api and /auth → gateway:8080
├── demo-site/
│   └── server.js                # Intentionally naive login form
├── attack-sim/
│   ├── bruteforce.js
│   ├── flood.js
│   └── injection.js
├── docker-compose.yml
└── .env.example
```

---

## Architecture decisions

- **Fail-open on Redis errors** — if Redis is unreachable, guards skip their checks and log a degraded event rather than blocking all traffic
- **Fire-and-forget logging** — event writes to MongoDB and all email sends never block the response path
- **Fixed-window rate limiting** — allows up to 2x burst at window boundaries; sliding window is a documented future improvement
- **Guards run in parallel** — `Promise.all` keeps detection latency minimal regardless of how many guards run
- **Brevo is fully optional** — alerts always write to MongoDB; email is an additive layer that activates only when `BREVO_API_KEY` is present
- **User email is optional** — signup accepts `email` but does not require it; notification silently no-ops if the field is absent
