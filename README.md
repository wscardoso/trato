# Trato

Agendamento online com compromisso — multi-tenant para barbearias e salões.

> Dar um trato no visual. Manter o horário.

- Brand: [`03_BRAND_TRATO.md`](./03_BRAND_TRATO.md)
- Deploy: [`DEPLOY.md`](./DEPLOY.md) → `tratobarber.digitallforcelabs.cloud`

## Quick start (demo, no Postgres)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) or the Dom Carlos demo at  
[http://localhost:3000/agendar/dom-carlos-barbearia](http://localhost:3000/agendar/dom-carlos-barbearia).

`DEMO_MODE=true` in `.env.local` serves an in-memory Dom Carlos catalog with live slot math and concurrency checks.

## Production Postgres

1. Set `DEMO_MODE=false` and a real `DATABASE_URL`
2. Optional: `REDIS_URL` for distributed slot locks
3. Optional: `UAZAPI_BASE_URL` + `UAZAPI_TOKEN` ([uazapiGO](https://docs.uazapi.com/)); per-tenant token in `Tenant.waInstanceId`

```bash
npx prisma db push
psql "$DATABASE_URL" -f prisma/sql/bookings_no_overlap.sql
npm run db:seed
npm run dev
```

## Core routes

| Path | Role |
|---|---|
| `/` | Landing Trato |
| `/agendar/[slug]` | Public multi-step booking UI |
| `POST /api/bookings` | Zod-validated, lock + transaction create |
| `GET /api/slots` | Availability grid |
| `GET /api/tenants/[slug]` | Branding + services + staff |

## Docker (VPS / Coolify)

```bash
docker compose up -d --build
```

See `DEPLOY.md` for Traefik host `tratobarber.digitallforcelabs.cloud`.
