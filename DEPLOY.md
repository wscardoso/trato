# Deploy Trato no Coolify (jeito certo)

Base: [Coolify Docs](https://coolify.io/docs) · [Applications](https://coolify.io/docs/applications) · [Dockerfile Build Pack](https://coolify.io/docs/applications/build-packs/dockerfile) · [Next.js](https://coolify.io/docs/applications/nextjs) · [GitHub](https://coolify.io/docs/applications/ci-cd/github/overview) · [Domains](https://coolify.io/docs/knowledge-base/domains) · [503 No Available Server](https://coolify.io/docs/troubleshoot/applications/no-available-server)

## Arquitetura

```
GitHub (trato)  →  Coolify (Dockerfile build)  →  Traefik SSL
                         ↓
              tratobarber.digitallforcelabs.cloud
                         ↓
              Postgres (Supabase / externo)
```

- **Build pack:** Dockerfile (não Nixpacks — temos `output: "standalone"`)
- **Porta do container:** `3000`
- **DNS:** CNAME `tratobarber` → `digitallforcelabs.cloud` (já ok se o Coolify escuta nesse host)
- **DB:** Postgres externo (ex. Supabase). `DEMO_MODE=false` em produção.

## 1. Repositório GitHub

Já criado / a criar: push deste projeto para GitHub (privado recomendado).

## 2. Coolify → Nova Application

1. **Project** → **+ Resource** → **Application**
2. Fonte: **GitHub App** ([setup](https://coolify.io/docs/applications/ci-cd/github/setup-github-app)) — melhor que deploy key avulsa
3. Selecione o repo `trato` (ou o nome que usar) e branch `main`
4. **Build Pack:** `Dockerfile`
5. Dockerfile location: `/Dockerfile` (raiz)
6. **Ports Exposes:** `3000`
7. **Domains:** `https://tratobarber.digitallforcelabs.cloud`
   - Se o painel pedir porta no FQDN: `https://tratobarber.digitallforcelabs.cloud:3000` ([Domains](https://coolify.io/docs/knowledge-base/domains))

## 3. Environment Variables

Runtime (+ Build se o Coolify exigir no build):

```env
DEMO_MODE=false
NODE_ENV=production
HOSTNAME=0.0.0.0
PORT=3000
NEXT_PUBLIC_APP_URL=https://tratobarber.digitallforcelabs.cloud
DATABASE_URL=postgresql://postgres:SENHA@db.SEU_REF.supabase.co:5432/postgres?sslmode=require
CRON_SECRET=um-segredo-longo
```

WhatsApp:

```env
UAZAPI_BASE_URL=
UAZAPI_TOKEN=
```

### Schema + seed (uma vez)

Com o mesmo `DATABASE_URL` na máquina local:

```bash
npx prisma migrate deploy
npx prisma db seed
```

O seed cria o tenant `dom-carlos-barbearia` (Carlos, Diego, serviços e agenda).

### Lembretes D−1 / 2h

Agende no Coolify (Scheduled Task / cron externo) a cada 1–5 minutos:

```bash
curl -X POST "https://tratobarber.digitallforcelabs.cloud/api/cron/notifications" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Em `DEMO_MODE=true` o cron responde `skipped: demo_mode` — o lembrete D−1 usa `setTimeout` no processo.

**Não** commitar `.env.local`. Segredos só no Coolify / Supabase.

## 4. Healthcheck (importante p/ 503)

O `Dockerfile` já tem `HEALTHCHECK` em `/`.  
No Coolify, confirme:

- Healthcheck path: `/`
- Port: `3000`
- Enabled

O erro atual **`503 no available server`** é exatamente o que a doc descreve quando o Traefik não tem backend healthy: [No Available Server](https://coolify.io/docs/troubleshoot/applications/no-available-server).

## 5. Deploy

**Deploy** no Coolify. Aguarde build + start. SSL Let's Encrypt é automático se DNS apontar certo e portas 80/443 abertas.

## 6. DNS — precisa mudar?

| Situação | Ação |
|---|---|
| CNAME `tratobarber` → `digitallforcelabs.cloud` e Coolify no mesmo server | **Manter** |
| Coolify mostrar um domínio/alvo diferente | Ajustar CNAME para o que o painel pedir |
| Quiser IP direto | Registro **A** → IP do server (hoje `72.60.147.135`) |

Não use `docker-compose.yml` com labels Traefik manuais no Coolify — o Coolify já gerencia o proxy. O compose local é só para testar na máquina.

## 7. Depois do go-live

| URL | Esperado |
|---|---|
| `/` | Landing Trato |
| `/agendar/dom-carlos-barbearia` | Funil demo |

Auto-deploy: ative webhook/GitHub App para redeploy a cada push em `main` ([GitHub Auto Deploy](https://coolify.io/docs/applications/ci-cd/github/auto-deploy)).

## Checklist rápido

- [ ] Repo no GitHub com `Dockerfile` na raiz
- [ ] Coolify App = Dockerfile, porta 3000
- [ ] Domain `https://tratobarber.digitallforcelabs.cloud`
- [ ] `DATABASE_URL` (Supabase) + `DEMO_MODE=false`
- [ ] `prisma migrate deploy` + `db seed`
- [ ] `CRON_SECRET` + scheduled task de notificações
- [ ] Healthcheck OK (some o 503)
- [ ] Auto-deploy ligado
