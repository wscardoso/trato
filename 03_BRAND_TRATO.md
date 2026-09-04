# 03 — Brand: Trato

**Product name:** Trato  
**Vertical:** Barbearia / beleza (B2B2C booking)  
**Status:** Nome oficial adotado

---

## Conceito & storytelling

**Trato** parte da expressão popular **“dar um trato no visual”** e, ao mesmo tempo, do sentido de **acordo / compromisso** — o cliente marca horário e o estabelecimento honra a pontualidade.

Promessa em uma linha:

> O trato é simples: você agenda, a casa cumpre.

Tom de voz: direto, urbano, confiável. Evitar jargão de “SaaS” na face do cliente; na face do barbeiro, falar de agenda cheia, no-show e WhatsApp.

---

## Análise de marca (UX / naming)

| Critério | Avaliação |
|---|---|
| Simetria & tipografia | 5 letras com “T”s nas pontas (`T-R-A-T-O`) — estabilidade visual |
| Ícone | Monograma em **T** estilizado (pente fino ou navalha retrátil) |
| Digitação mobile | Curto, alternância fácil de polegares |
| Domínios / handle | Staging agora · marca própria depois (ver abaixo) |
| Risco | Termo comum no vocabulário — exige marca tipográfica e monograma fortes em App Store / Play |

### Domínios

| Ambiente | Host | Papel |
|---|---|---|
| **Staging / MVP** | `tratobarber.digitallforcelabs.cloud` | Host ativo sob Digitall Force Labs — go-live rápido, SSL e DNS já controlados |
| Marca (futuro) | `trato.app` / `tratobarber.com.br` | Face comercial e App Store; apontar para o mesmo app quando a marca estiver pronta |
| Social | `@trato.app` | Handle alvo; até lá usar o da lab se preciso |

**Decisão atual:** usar `tratobarber.digitallforcelabs.cloud` como URL oficial do produto enquanto a lab hospeda. O subtítulo **Trato Barber** no subdomínio já reforça a marca e reduz ambiguidade do termo “trato”.

**Posicionamento digital:** na App Store / Play, listar como **Trato Barber**; o domínio de lab é infra, não o nome do app.

---

## Identidade visual (plataforma)

**Linha oficial: Urbano & Funcional** — tradição de barbearia (couro, aço, madeira) com UI moderna de alta conversão. Dark mode nativo.

| Papel | Nome | HEX | Uso |
|---|---|---|---|
| Background | Preto Grafite | `#121417` | Fundo principal |
| CTA / Ação | Cobre Âmbar | `#E06535` | Botões primários (“Confirmar Trato”, “Agendar”) |
| Superfícies | Cinza Chumbo | `#1E2228` | Cards, horários, modais |
| Leitura | Off-White | `#F4F5F6` | Títulos, textos, horários livres |
| Neutro | Cinza Aço | `#8C95A1` | Subtítulos, divisórias, disabled |
| Sucesso | Verde Sinal | `#10B981` | “Trato Feito”, confirmados |

Tokens CSS: `src/app/globals.css` (`--graphite`, `--copper`, `--lead`, `--offwhite`, `--steel`, `--signal`).

| Token UI | Uso |
|---|---|
| Wordmark | `TRATO` em display (tracking amplo), nunca “Trato App” no hero |
| Mark | Monograma T — `src/components/brand/trato-mark.tsx` |
| Tipografia | Display: Bebas Neue · UI: DM Sans |

Tenants podem override via `brandPrimary` / `logoUrl`. Default da plataforma = Cobre Âmbar.

### Alternativas de estilo (não ativas)

| Linha | Base | Acento | Quando |
|---|---|---|---|
| Esmeralda | `#0B0F19` | `#00E676` | Apelo jovem / “sinal verde” |
| Clássica | `#0A1128` | `#D4AF37` | Barbearia premium / alto padrão |

---

## Copy seeds

- Hero: **TRATO**
- Apoio: *Dar um trato no visual. Manter o horário.*
- CTA: *Agendar* / *Confirmar Trato*
- Sucesso: *Trato Feito*
- Footer booking: *Agendado com Trato*
- Meta title default: `Trato — agendamento com compromisso`
