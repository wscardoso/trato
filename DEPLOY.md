# Deploy Trato no Coolify (jeito certo)

Base: [Coolify Docs](https://coolify.io/docs) · [Applications](https://coolify.io/docs/applications) · [Dockerfile Build Pack](https://coolify.io/docs/applications/build-packs/dockerfile) · [Next.js](https://coolify.io/docs/applications/nextjs) · [GitHub](https://coolify.io/docs/applications/ci-cd/github/overview) · [Domains](https://coolify.io/docs/knowledge-base/domains) · [503 No Available Server](https://coolify.io/docs/troubleshoot/applications/no-available-server)

## Arquitetura

```
GitHub (trato)  →  Coolify (Dockerfile build)  →  Traefik SSL
                         ↓
              tratobarber.digitallforcelabs.cloud
```

- **Build pack:** Dockerfile (não Nixpacks — temos `output: "standalone"`)
- **Porta do container:** `3000`
- **DNS:** CNAME `tratobarber` → `digitallforcelabs.cloud` (já ok se o Coolify escuta nesse host)
- **MVP:** `DEMO_MODE=true` (sem Postgres ainda)

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
DEMO_MODE=true
NODE_ENV=production
HOSTNAME=0.0.0.0
PORT=3000
NEXT_PUBLIC_APP_URL=https://tratobarber.digitallforcelabs.cloud
```

Opcionais (WhatsApp):

```env
UAZAPI_BASE_URL=
UAZAPI_TOKEN=
```

**Não** commitar `.env.local`. Segredos só no Coolify.

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
- [ ] `DEMO_MODE=true`
- [ ] Healthcheck OK (some o 503)
- [ ] Auto-deploy ligado
