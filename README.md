# Vigil

Vigil is an on-call and incident management platform. Monitoring tools send
it alerts, it works out who is on call, emails that person, and keeps
escalating to the next person until someone acknowledges.

Built by [Priyanshu Maurya](https://github.com/nullbyPriyanshu).

## What it does

- **Alerts in.** Services get API keys. Anything that can send a webhook
  (curl, Sentry, Grafana, UptimeRobot) can open an incident. Repeats of the
  same problem are folded into one incident.
- **Uptime monitors.** Give Vigil an address and it visits it every 1, 5
  or 15 minutes. Two failures in a row open an incident; the incident
  closes by itself when the address answers again.
- **The right person.** Daily or weekly rotations decide who is on call,
  in each schedule's own timezone.
- **Escalation.** A policy is a list of steps: notify this person, team or
  schedule, wait N minutes, move on. Timers are queue jobs, so they survive
  a restart.
- **One-click response.** The email has Acknowledge and Resolve buttons that
  work without logging in.
- **Live.** The dashboard and incident pages update by themselves.
- **A record.** Every page, acknowledgement, comment and fix is on the
  incident's timeline, and Analytics shows how fast the team responds.
- **Roles.** Owner, Admin, Responder and Viewer.

## What it's made of

| Part | Built with |
| --- | --- |
| `apps/web` | Next.js 16, React 19, Tailwind 4, TanStack Query |
| `apps/api` | NestJS 11, Prisma 7 |
| Database | PostgreSQL |
| Timers and rate limits | Redis and BullMQ |
| Live updates | Socket.IO |
| Email | Resend |

It is a pnpm workspace run with Turborepo.

## Running it

You need Node 22 or newer, pnpm, and Docker.

```bash
pnpm install
docker compose up -d          # Postgres and Redis
```

Create `apps/api/.env`:

```bash
PORT=3001
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://vigil:vigil@localhost:5432/vigil
REDIS_URL=redis://localhost:6379
JWT_SECRET=any-long-random-string
API_KEY_PEPPER=another-long-random-string
RESEND_API_KEY=            # from resend.com
RESEND_WEBHOOK_SECRET=     # optional, for delivery status
MAIL_FROM="Vigil <onboarding@resend.dev>"
KEEP_AWAKE_URL=            # optional: this API's own public /health address
```

Create `apps/web/.env.local`:

```bash
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

Then set up the database and start everything:

```bash
cd apps/api
npx prisma migrate deploy --config prisma7.config.ts
cd ../..
pnpm dev                      # web on :3000, API on :3001
```

Then open http://localhost:3000, sign up, and the setup wizard walks you
through your first team, service and test alert.

## Tests

```bash
cd apps/api && pnpm test        # unit tests for the API
cd apps/web && pnpm test:e2e    # browser tests; the app must be running
```

The browser tests need `npx playwright install chromium` once. They sign in
as their own test person (`delivered+e2e@resend.dev`) in their own
"E2E Tests" organization, which they create on first run and keep. They
never touch another organization.

## Hosting on a free plan that sleeps

Free hosts such as Render put a server to sleep after about 15 minutes
without a visitor, and a sleeping Vigil can't page anyone. Set
`KEEP_AWAKE_URL` to the API's own public health address, for example
`https://your-api.onrender.com/health`, and the API visits it once a
minute so it never looks idle.

This keeps a running server awake. It cannot wake one that has already
stopped, and it cannot tell you when Vigil itself is down, so also point an
outside checker (UptimeRobot is free) at the same address.

## Sending an alert

```bash
curl -X POST http://localhost:3000/api/alerts \
  -H "X-Vigil-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Disk almost full", "severity": "high", "dedupKey": "disk-db-1"}'
```

Sentry, Grafana and UptimeRobot post to `/api/alerts/sentry`,
`/api/alerts/grafana` and `/api/alerts/uptimerobot` with the same header.
Each service page has copy-and-paste instructions.

## Keyboard shortcuts

Press `?` inside the app for the full list. `A` acknowledges and `R`
resolves the open incident; `G` then a letter jumps between pages.

## Licence

MIT. See [LICENSE](LICENSE).

## Decisions

Why things are built the way they are is in [Decisions.md](Decisions.md).
