# Reverse-Engineering Audit — BarberPro Agenda

**Target:** `https://barberproagenda.com.br/agendar/dom-carlos-barbearia`  
**Tenant sample:** DOM CARLOS BARBEARIA (Iapu, MG)  
**Audit date:** 2026-09-04  
**Method:** SSR HTML/`__NEXT_DATA__` inspection, public client bundle (`/agendar/[slug]`), and public read APIs (`/api/public/*`). No booking was created.

---

## 1. System Architecture Breakdown

### 1.1 Stack signals (observed)

| Layer | Evidence |
| --- | --- |
| Frontend | Next.js **Pages Router** (`/pages/agendar/[slug]`), client hydration after SEO shell |
| Rendering | `getServerSideProps` (`__N_SSP`) — SEO metadata + light tenant snapshot; full catalog fetched client-side |
| Observability | Sentry (`sentry-transaction=/agendar/[slug]`), Cloudflare Insights, Meta Pixel / GTM hooks in `_app` |
| Identity of records | CUID-like IDs (`cmokqs2kt006p12z04l54w9k8`) — typical Prisma/Postgres SaaS pattern |
| Media | Tenant-scoped uploads (`/uploads/{barberId}/service-*.webp`) |
| Messaging / payments (product claims + UI) | WhatsApp automation; PIX via Mercado Pago when `pixEnabled` |
| Admin surface | Separate product domain `barberpromanager.com.br` (owner ops, not client booking) |

### 1.2 Multi-tenant isolation model

**URL contract:** `/agendar/[slug]` where `slug` is a unique public handle (e.g. `dom-carlos-barbearia`).

```
Client browser
    │
    ├─ GET /agendar/{slug}          → SSR SEO + theme shell
    ├─ GET /api/public/barber/{slug}→ Tenant config + services + schedules
    ├─ GET /api/public/availability/{slug}?date=&serviceId=&totalDuration=
    ├─ GET /api/public/blocked-days?slug=&month=&year=
    ├─ POST /api/public/appointment → Create booking (tenant resolved by barberSlug)
    ├─ GET  /api/public/check-payment?paymentId=
    ├─ GET  /api/public/check-membership?barberSlug=
    ├─ GET  /api/public/products/{slug}
    ├─ POST /api/public/orders
    └─ POST /api/public/client-address  (+ ViaCEP for home service)
```

**Isolation principle:** every public call is keyed by **slug / barberSlug**. There is no end-customer auth for booking; the tenant is resolved server-side from the slug. Returning clients are remembered in **browser `localStorage`** (`barberpro_client_*`), not via account login.

**Important product nuance:** marketing FAQ states the product was “thought for individual barbers,” but the booking API/UI already supports **collaborators**, **family companions**, **multi-service**, **home service**, and **products** — i.e. the public booking surface is richer than the simplest positioning copy.

### 1.3 Core entities & relationships

```
Tenant (Barber / Business)
├── slug (unique public key)
├── businessName, address, logo, theme, category
├── feature flags (pix, reminders, home/establishment, membership, collaborators, family cut)
├── bookingFlow snapshot
├── appointmentInterval (minutes)
├── maxAdvanceDays
├── subscription { isActive }
│
├── Service[] ─────────── optional ServiceCategory
│     id, name, description, price, duration, active, order, imageUrl
│
├── Schedule[] (WorkingHours per weekday)
│     dayOfWeek, startTime, endTime, active
│     breakStart/breakEnd (lunch)
│     coffeeBreakStart/coffeeBreakEnd
│
├── Collaborator[] (Staff) — optional when collaboratorsEnabled
│     assigned services / own availability (UI: “Qualquer barbeiro disponível”)
│
├── BlockedDay[] (holidays / closed dates by month)
│
├── Product[] + Order[] (retail upsell, can be products-only)
│
├── MembershipPlan[] (mensalista) — optional
│
├── Client (soft entity)
│     name, phone/WhatsApp, saved address, LGPD consent
│
└── Appointment / Booking
      tenant, service(s), optional companions[], optional collaboratorId
      date, time, serviceLocation (barbershop | home)
      paymentMethod (local | pix), reminderMinutes
      status lifecycle (pending payment → confirmed)
```

### 1.4 Tenant snapshot — Dom Carlos (live)

| Setting | Value |
| --- | --- |
| Theme | `barber-navy` |
| Layout | `modelo_layout: padrao` |
| Slot interval | **35 min** (`appointmentInterval`) |
| Advance window | **14 days** (`maxAdvanceDays`) |
| PIX / require payment | **off** |
| Reminder | **on**, controlled by barber, **24h** before |
| Collaborators | **off** |
| Home service | **off** (establishment only) |
| Membership | **off** |
| Family cut | **on** (`allowFamilyCut`) |
| Subscription | **active** |
| Services | Sobrancelha R$10; Corte Social / Degradê R$30; Navalhado R$35 — all **35 min** |
| Weekly hours | Tue–Fri ~07:50–19:55/20:30 with lunch **10:45–13:30** + coffee **15:15–15:50**; Sat **08:00–12:05**; Sun/Mon closed |

---

## 2. Step-by-Step User Flow Matrix

Observed flow is a **wizard with numbered “Passo N”**, sticky summary bar, and theme tokens (`--theme-*`). Location step is **conditional** (only if both home + shop are enabled).

### Flow overview

```
[/agendar/{slug}]
        │
        ▼
[0. Gate] subscription inactive? → “Agendamentos indisponíveis”
        │
        ▼
[1. Service] (+ optional Family companions / multi-service ≤3)
        │
        ▼
[1b. Location?] home vs establishment (if both flags true)
        │
        ▼
[2. Staff?] collaborator pick (if collaboratorsEnabled)
        │
        ▼
[3. Date] calendar constrained by schedules + blocked-days + maxAdvanceDays
        │
        ▼
[4. Time] availability API slots for date + duration
        │
        ▼
[5. Client form] WhatsApp-first ID → name; optional reminder; LGPD
        │     └─ home address (CEP/ViaCEP) if serviceLocation=home
        │
        ▼
[6. Payment] PIX QR / copy-paste OR “Pagar no local”
        │
        ▼
[7. Confirmation] WhatsApp confirmation claim + “Chegue 5 minutos antes”
        │
        └─ optional Products cart / “Meus agendamentos” / reschedule (?reagendar=)
```

### Per-screen matrix

| # | Screen | Inputs | Actions | Outputs / State |
| --- | --- | --- | --- | --- |
| 0 | Loading / SEO shell | URL `slug` | Hydrate; `GET /api/public/barber/{slug}` | Tenant config, services, schedules; cookie consent |
| 1 | Service selection (“Escolha o serviço”) | Catalog cards (name, duration, price, image) | Select primary service; optionally add up to **2 more services** or **acompanhantes** (family); “Ver produtos” | `serviceId`(s), `totalDuration`, companion rows |
| 1b | Location (conditional) | Flags `homeServiceEnabled` / `establishmentServiceEnabled` | “Atendimento no local” vs “Atendimento a Domicílio” | `serviceLocation` = `barbershop` \| home |
| 2 | Staff (conditional) | Collaborator list | Pick barber or “Qualquer barbeiro disponível” | `collaboratorId` or null |
| 3 | Date (“Escolha a data” / “Quando você gostaria de agendar?”) | Month calendar | Pick day; skip closed/blocked; respect `maxAdvanceDays` | `date` (ISO); loads blocked-days for month/year |
| 4 | Time (“Escolha o horário”) | `GET .../availability/{slug}?date=&serviceId=&totalDuration=` | Pick slot; change date if empty | `time` (HH:mm); empty → “Nenhum horário disponível nesta data” |
| 5 | Client form (“Finalize seu agendamento”) | WhatsApp, name; optional reminder minutes; address fields if home | Quick ID via `localStorage` (“Bom te ver de novo!” / “Não sou eu”); ViaCEP on CEP | `clientName`, `clientPhone`, `reminderMinutes`, address, `lgpdConsent` |
| 6 | Payment | `bookingFlow` + flags | **PIX** (QR + copia-e-cola, poll `check-payment`) or **Pagar no local** | `paymentMethod`: `pix` \| `local`; non-refundable warning if PIX |
| 7 | Confirmation | Booking result | “Fazer novo agendamento”; WhatsApp details claim | Confirmed appointment; optional membership success copy |

### Alternate / side flows

| Flow | Trigger | Notes |
| --- | --- | --- |
| Products-only | “Comprar somente produtos” | `POST /api/public/orders` with `items[]`; can continue into booking |
| Membership CTA | `membershipEnabled` | “Seja Mensalista!” / unlimited booking for 30 days positioning |
| Reschedule | `?reagendar={appointmentId}` | Passed as `rescheduleFromId` on appointment POST |
| Client area | “Meus agendamentos” / “Área do Cliente” | Phone-based recognition, not full account system |

### Appointment POST payload (reconstructed)

Primary booking body fields observed in the client bundle:

```json
{
  "bookingLayout": "padrao",
  "barberSlug": "dom-carlos-barbearia",
  "serviceId": "<cuid>",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "clientName": "...",
  "clientPhone": "digits-only",
  "paymentMethod": "local | pix",
  "serviceLocation": "barbershop",
  "reminderMinutes": null,
  "collaboratorId": null,
  "companions": [{ "serviceId": "...", "name": "Acompanhante" }],
  "lgpdConsent": true,
  "lgpdConsentVersion": "2026-05-23",
  "rescheduleFromId": null
}
```

---

## 3. Business Rules Catalog

### 3.1 Availability & calendar

| Rule | Discovery |
| --- | --- |
| Tenant must have **active subscription** | Inactive → bookings blocked (“Assinatura vencida”) |
| Slots derived from **weekday schedules** | `dayOfWeek` + start/end; Dom Carlos has no Sun/Mon rows |
| **Lunch break** excluded | `breakStart`/`breakEnd` (e.g. 10:45–13:30) |
| **Coffee break** excluded | `coffeeBreakStart`/`coffeeBreakEnd` (e.g. 15:15–15:50) |
| Slot grid uses **appointmentInterval** | Dom Carlos: 35′ — aligns with service durations |
| Duration-aware packing | Availability accepts `serviceId` + optional `totalDuration` (multi-service / family sum) |
| Advance booking cap | `maxAdvanceDays` (14 here) |
| Explicit closed days | `GET /api/public/blocked-days?slug=&month=&year=` |
| Real-time occupied slots omitted | Availability returns only free `times[]` |

### 3.2 Services & booking composition

| Rule | Discovery |
| --- | --- |
| Max **3 services** per booking | UI copy: “Máximo de 3 serviços por agendamento” |
| **Family cut** | When `allowFamilyCut`: add companions with own service + name |
| Multi-person labeling | “Corte Família (N pessoas)” in summary |
| Service images / ordering | `order`, `imageUrl`, `active` |
| Categories optional | `serviceCategories` / `categoryId` present in schema |

### 3.3 Payments & no-shows

| Rule | Discovery |
| --- | --- |
| Dual payment modes | `pix` vs `local` (“Pagar no local”) |
| Hard PIX gate optional | `requirePayment` / `requirePixPayment` |
| PIX non-refundable | Explicit UI: cancelamento/no-show → **sem reembolso** |
| Payment confirmation polling | `check-payment?paymentId=` until confirmed |
| Deposit as attendance guarantee | Product positioning + UI (“Garanta seu horário!”) |

### 3.4 Client, consent & messaging

| Rule | Discovery |
| --- | --- |
| No mandatory account | Book with WhatsApp + name |
| WhatsApp validation | Errors: `INVALID_WHATSAPP_NUMBER`, “Digite um número de WhatsApp válido” |
| Returning-client UX | `localStorage` key `barberpro_client_*` |
| LGPD consent | `lgpdConsent` + version stamp on POST |
| Reminders | Global enable; either barber-controlled hours or client-picked `reminderMinutes` |
| Post-booking ops tip | “Chegue 5 minutos antes”; remarcação via contato |

### 3.5 Location & staff

| Rule | Discovery |
| --- | --- |
| Home service address required | CEP → ViaCEP; street/number/bairro required; saved address reuse |
| Staff assignment optional | Collaborators + “any available” fallback |
| Products inventory | “Estoque insuficiente” path in UI |

### 3.6 Implicit UX / conversion rules

| Rule | Discovery |
| --- | --- |
| Mobile-first shell | `viewport-fit=cover`, PWA manifest/icons, max-width ~480px patterns in alternate layout CSS |
| Theme white-label | Themes e.g. `barber-navy`, `barber-gold-classic`, `barber-emerald`, `barber-blue-steel` |
| Cookie consent gate | Privacy policy link before analytics acceptance |
| Schema.org BarberShop | Injected for SEO (services as offer catalog) |

---

## 4. UX/UI & Friction Audit

### 4.1 What works

- **Slug deep-link** is shareable (WhatsApp, Instagram, Google) — low friction acquisition.
- **WhatsApp-first identity** matches BR barbershop behavior better than email/password.
- **Clear price + duration** on service cards; sticky booking summary reduces anxiety.
- **Break-aware slots** feel trustworthy vs naive 30-min grids that show impossible times.
- **Optional PIX** lets shops trade conversion vs no-show protection.

### 4.2 Conversion bottlenecks / friction

| Friction | Why it hurts |
| --- | --- |
| Multi-step wizard without progress save | Drop-off if user exits mid-flow (except saved phone/address) |
| Family/multi-service complexity | Powerful but increases cognitive load on mobile |
| Empty-day dead ends | Closed weekdays + blocked days need strong empty-state guidance (“Escolher outra data”) |
| PIX non-refundable policy | Necessary for shop, but can abort checkout if shown late |
| Reminder controlled only by barber | Client cannot tune preference when flag is on |
| Products + booking dual mode | Risk of mode confusion (“Comprar somente produtos” vs schedule) |
| Branding inconsistency | Marketing claims single-barber simplicity while UI exposes multi-staff/home/membership |
| Visual stack | Inter + gold/navy theme is common SaaS-barber look — weak differentiation |

### 4.3 Micro-interactions observed

- Step transitions / card enter animations (`screenIn`, `cardIn`, `slotIn` in layout CSS).
- Selected service stamp / accent gradient CTAs.
- PIX copy-to-clipboard toast (“Código PIX copiado!”).
- Returning-client greeting with “Não sou eu” reset.
- Loading copy for slots (“Carregando horários disponíveis...”).

---

## 5. Competitive Gaps & Opportunities

Three high-leverage features to beat BarberPro:

### 1) Conversational booking on WhatsApp (agent-native), not just reminders

BarberPro uses WhatsApp mainly for **confirmation/reminder/campaigns**. Opportunity: a true **booking agent** in WhatsApp that completes service → staff → slot → payment without opening the web wizard — and syncs the same inventory engine. This attacks Dom Carlos’ real channel (messages) instead of forcing a browser funnel.

### 2) Smart inventory: buffers, travel time, and fairness

Expose first-class rules BarberPro only partially implies: per-service **buffer before/after**, home-service **travel radius/time**, staff skill matrix, and **waitlist / next-available** when a day is full. Dom Carlos’ 35′ grid + dual breaks works, but competitors win when the engine explains *why* a slot is gone and offers alternatives automatically.

### 3) Trust & retention layer beyond PIX non-refundable

Replace pure “pay or lose” with configurable **policies**: free cancel window, credit wallet, no-show scoring, and one-tap **reschedule inside the client area** (BarberPro still pushes “entre em contato”). Pair with owner analytics: fill rate, idle gaps between breaks, and campaign ROI — making the SaaS a growth OS, not only a public form.

---

## 6. Build implications for our competing SaaS

1. **Tenant resolution by slug** + public read models for services/schedules/availability; mutate only via authenticated owner APIs.  
2. **Availability service** as the core domain module: schedules − breaks − blocked days − bookings − duration − buffers.  
3. **Feature flags per tenant** (`pix`, `home`, `collaborators`, `membership`, `family`) to keep UX simple when flags are off.  
4. **BR-native client identity**: WhatsApp + LGPD consent versioning + optional local remember-me.  
5. **Payment adapter** (PIX) with explicit policy engine (refundable windows vs hard deposit).  
6. **Channel strategy**: web booking link *and* WhatsApp agent sharing one booking engine.

---

## Appendix A — Public API surface (booking)

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/public/barber/{slug}` | Tenant + services + schedules + flags |
| GET | `/api/public/availability/{slug}` | Free times for date/duration |
| GET | `/api/public/blocked-days` | Closed dates by month/year |
| POST | `/api/public/appointment` | Create / reschedule booking |
| GET | `/api/public/check-payment` | PIX confirmation poll |
| GET | `/api/public/check-membership` | Mensalista status |
| GET | `/api/public/products/{slug}` | Retail catalog |
| POST | `/api/public/orders` | Product order |
| POST | `/api/public/client-address` | Persist home address |

## Appendix B — Source confidence

| Area | Confidence |
| --- | --- |
| URL/tenant model, entities, Dom Carlos config | **High** (live API + SSR) |
| Wizard steps, payment/family/home rules | **High** (client bundle strings + payloads) |
| Exact DB schema / owner admin workflows | **Medium** (inferred; admin app not fully audited) |
| Slot algorithm internals | **Medium** (behavioral: interval + breaks + duration params) |

---

*End of audit.*
