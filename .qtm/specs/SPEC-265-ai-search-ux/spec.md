---
spec-id: SPEC-265
title: AI accommodation search — UI/UX improvements (transparency, onboarding, chat control, hybrid layout)
type: improvement
complexity: medium
status: draft
created: 2026-06-22T21:55:01Z
decided: 2026-06-24
model_fit: mixed
---

# SPEC-265 — AI accommodation search: UI/UX improvements

> Follow-up of **SPEC-199** (single-shot NL search intent) and **SPEC-212**
> (conversational multi-turn search). The AI pipeline works and is solid; this spec
> raises the **UI/UX** so the feature feels trustworthy, guided and polished —
> surfacing signal the backend already computes but discards, helping the user know
> what to ask, and tightening the chat interaction. **Not yet implemented.**

> ## ✅ RECON VERIFIED + DECISIONS RESOLVED (2026-06-24)
>
> Los claims del spec se verificaron contra el código actual (ver `## 2`). Decisiones
> del owner sobre las preguntas abiertas:
>
> - **D (layout) → HÍBRIDO.** Un entry point en `/alojamientos` que se **expande** a una
>   experiencia enfocada (drawer/modal overlay) con lugar para transparencia + onboarding.
>   La collapse (C4) queda **absorbida** por esto (cerrar = volver al entry point).
>   **POTENTE** (estado de apertura + transición). El `SearchChatPanel` es muy
>   self-contained (4 props) → se remonta dentro del drawer con cambio mínimo.
> - **Q2 (confidence) → solo interno.** Forwardear `confidence` pero usarlo **solo** para
>   disparar el `lowConfidenceMessage`; **sin badge numérico visible** (score ruidoso).
> - **Q3 (onboarding) → context-aware.** Ejemplos que se adaptan al contexto de la página
>   (tipo/destino activo) con fallback a un pool localizado; **POTENTE** (lógica de
>   selección). Absorbe B2 (hints de refinamiento tras resultados).
> - **Q4 (PR split) → chained PRs** (ver `## 6`): (i) señal API (confidence + error codes),
>   (ii) transparencia UI, (iii) onboarding, (iv) control/errores + layout híbrido.
>
> **Correcciones del recon (claims que estaban mal):** el "límite de 500 chars" **NO está
> enforced** en el path de chat (`AiChatMessageSchema.content` solo tiene `min(1)`); el cap
> existe solo en la ruta vieja single-shot. → C2 ahora **agrega** el `.max(500)` al schema,
> no solo renderiza el contador. Los 6 i18n keys (`charCount`, `rateLimitError`,
> `lowConfidenceMessage`, `triggerLabel`, `panelTitle`, `serviceError`) están **muertos**
> (confirmado).
>
> **Model fit = MIXTO:** A (transparencia) + C (control/errores) son BÁSICO (wiring de
> señal que el backend ya computa + i18n que ya existe). El layout híbrido (D) y el
> onboarding context-aware (B1) son POTENTE, atomizados y marcados.

## 1. Overview

### Goal

Mejorar la UX de la búsqueda NL (AI) en cuatro ejes: (1) **transparencia** de cómo la AI
interpretó la query (señal que el backend ya produce y tira), (2) **onboarding** (qué
puedo pedir), (3) **control de chat + claridad de errores**, (4) **layout híbrido**
(entry + expand).

### Governance note

`ai_search` es **platform feature, no entitlement** (SPEC-211 §7.7) — sin quota por plan;
costo capeado en el engine + rate limiting per-user/per-IP. **Auth requerida**: anónimos
ven un login CTA en vez del composer. Cualquier cambio de UX mantiene este modelo.

## 2. Current state (verificado en recon, 2026-06-24)

| Concern | Location |
|---|---|
| AI search UI (React island) | `apps/web/src/components/ai-search/SearchChatPanel.client.tsx` |
| Mounted (always-on, `client:load`, en el main column sobre la grilla) | `apps/web/src/pages/[lang]/alojamientos/index.astro:821-834` |
| Filter chips | `apps/web/src/components/ai-search/ActiveFilterChips.tsx` |
| State hook | `apps/web/src/components/ai-search/useSearchChat.ts` |
| SSE client | `apps/web/src/lib/api/search-chat-stream.ts` |
| API endpoint | `POST /api/v1/protected/ai/search-chat` (`apps/api/src/routes/ai/protected/search-chat.ts`) |
| Intent schema (tiene `confidence`) | `packages/schemas/src/entities/ai/ai-search-intent.schema.ts:312-331` |
| SSE `filters` event schema (sin `confidence`) | `packages/schemas/src/entities/ai/ai-search-chat.schema.ts:57-62` |
| Chat message schema (sin max length) | `packages/schemas/src/entities/ai/ai-chat.schema.ts:102` |
| i18n namespace | `aiSearch` (`packages/i18n/src/locales/{es,en,pt}/aiSearch.json`) |

### Verified facts (recon)

- **Confidence se tira:** `search-chat.ts:249` lee `typedObject` pero solo usa `.entities`;
  el `filters` event (`:385`) lleva solo `{ params, intent }`. El schema del event
  (`ai-search-chat.schema.ts:57-62`) no tiene campo confidence.
- **6 i18n keys muertos** (definidos, nunca consumidos por los componentes ai-search):
  `charCount` (es:32), `rateLimitError` (es:39), `lowConfidenceMessage` (es:41),
  `triggerLabel` (es:2), `panelTitle` (es:3), `serviceError` (es:40).
- **Destination chip genérico:** `ActiveFilterChips.tsx:181-186` muestra "Destino filtrado"
  sin resolver el UUID; el catálogo de destinos ya se fetchea en `index.astro:164` pero
  no se pasa al panel (props en `SearchChatPanel.client.tsx:54-59`).
- **AbortController sin botón:** `useSearchChat.ts:197,242-245,280,394-397` — solo aborta
  en un nuevo `send()`/`reset()`, no hay botón de Stop.
- **Sin cap de chars en el chat:** `ai-chat.schema.ts:102` `content: z.string().min(1)` —
  NO `.max(500)`. El textarea (`SearchChatPanel.client.tsx:484`) no tiene `maxLength`.
- **429 crudo:** `search-chat-stream.ts:128-138` surfacea `errBody.error.message ?? "HTTP
  <status>"`, nunca mapea a `rateLimitError`.

## 3. Scope — four workstreams

### A. Transparency of interpretation (BÁSICO)

| # | Change | Archivo:línea | Notes |
|---|--------|---------------|-------|
| A1 | **Forward `confidence`** del route al cliente: extraer `typedObject.confidence`, agregarlo al `filters` SSE event + a su schema + al tipo del SSE client + al hook | `search-chat.ts:249,385`; schema `ai-search-chat.schema.ts:57-62`; client `search-chat-stream.ts`; `useSearchChat.ts` | Cross-layer pero chico. |
| A2 | **Low-confidence UI** — cuando confidence < threshold o entities vacías, renderizar `aiSearch.lowConfidenceMessage` (ya traducido) con sugerencia de reformular, en vez de mostrar 0 resultados en silencio. Sin badge numérico (decisión owner) | i18n `lowConfidenceMessage`; UI en `SearchChatPanel.client.tsx`; depende de A1 | Threshold inicial sugerido: `confidence < 0.4` (calibrar con queries reales). |
| A3 | **Resolver el destination chip** — pasar el catálogo (ya fetcheado en `index.astro:164`) como prop nueva a `SearchChatPanel` → `ActiveFilterChips`, para mostrar el nombre real | `ActiveFilterChips.tsx:181-186`; prop nueva en `SearchChatPanel.client.tsx:54-59` | UI + prop wiring. |

### B. Onboarding / guidance (POTENTE — context-aware)

| # | Change | Notes |
|---|--------|-------|
| B1 | **Example query chips context-aware** en el empty state: clickeables que pueblan+envían. **Context sources:** (1) si la página tiene contexto de tipo/destino activo (`tipo/[type]`, destino), tailorear los ejemplos a ese contexto; (2) si no, rotar desde un pool localizado (es/en/pt). Cada ejemplo sale de las capacidades documentadas del prompt y se testea que el modelo lo maneje | POTENTE: lógica de selección por contexto + fallback. Atomizar: B1a pool estático localizado (básico) → B1b selección context-aware (potente). |
| B2 | **Refinement hints tras resultados** (ej: "¿filtrar por precio?") — absorbido en el motor context-aware de B1 | Mantener barato; reusar el pool. |

### C. Chat control + error clarity (BÁSICO)

| # | Change | Archivo:línea | Notes |
|---|--------|---------------|-------|
| C1 | **Stop/cancel streaming** — botón real de abort durante el streaming (el `AbortController` ya existe) | `useSearchChat.ts:197,242-245`; UI en `SearchChatPanel.client.tsx` | Exponer un `abort()` del hook + botón visible durante streaming. |
| C2 | **Character counter** — renderizar `aiSearch.charCount` (key existe) + `maxLength=500` en el textarea **Y agregar `.max(500)` a `AiChatMessageSchema.content`** (hoy no existe el cap — corrección del recon) | i18n `charCount`; textarea `SearchChatPanel.client.tsx:484`; **schema `ai-chat.schema.ts:102`** | NO es solo UI: incluye el cap en el schema. |
| C3 | **Differentiated error copy** — clasificar status: 429 → `aiSearch.rateLimitError`, 5xx/service → `aiSearch.serviceError`, etc., en vez de "HTTP 429" crudo | `search-chat-stream.ts:128-138` (clasificar status) + render en panel | UI + SSE client. |
| C4 | **Collapse / minimize** — **absorbido por D** (el estado colapsado = volver al entry point del layout híbrido) | — | No es tarea separada; sale del layout híbrido. |

### D. Layout / placement — HÍBRIDO (POTENTE)

Decisión owner: **híbrido**. Un **entry point** en `/alojamientos` (un search-bar / CTA
"Buscar con IA" en el main column, donde hoy está el panel always-on) que **expande** a
una **experiencia enfocada** (drawer lateral o modal overlay) con espacio para los
affordances de A (transparencia) y B (onboarding).

- El entry point reemplaza el mount always-on actual (`index.astro:821-834`).
- Al expandir, se monta el `SearchChatPanel` (self-contained, 4 props) dentro del
  drawer/modal. Cerrar el drawer = colapsar (absorbe C4).
- Responsive: en mobile el expand es full-screen; en desktop drawer lateral o modal.
- El `triggerLabel`/`panelTitle` (i18n keys muertos) se reviven para el entry point + el
  header del drawer.

## 4. Out of scope

- **"Bridge to the full listing"** (aplicar filtros AI a la URL del listado para
  paginar/ordenar) — owner lo deseleccionó. Follow-up separado.
- Billing / entitlement — `ai_search` sigue platform feature.
- Cambiar el pipeline de extracción, prompts o modelo (esto es UI/UX; el único toque de
  backend es forwardear `confidence` ya computado, agregar el cap de chars, y clasificar
  error codes).
- Nuevos slots / capacidades de búsqueda (no se agrega lo que la AI entiende, solo cómo se
  presenta).

## 5. User Stories (con checks testeables)

#### US-1 — Transparencia: low-confidence (A1+A2)

- **GIVEN** una query ambigua que el modelo extrae con `confidence < 0.4`
  **WHEN** se procesa el turno
  **THEN** el `filters` SSE event incluye `confidence`, y la UI renderiza
  `aiSearch.lowConfidenceMessage` (sugerencia de reformular) en vez de 0 resultados mudos.
  Sin badge numérico visible.

#### US-2 — Destination chip legible (A3)

- **GIVEN** una query que resuelve un `destinationId`
  **WHEN** se muestran los chips
  **THEN** el chip muestra el **nombre** del destino (del catálogo pasado por prop), no el UUID.

#### US-3 — Stop streaming (C1)

- **GIVEN** una respuesta streameando
  **WHEN** el user clickea "Detener"
  **THEN** el stream se aborta (vía el `AbortController` existente) y la UI queda en estado estable.

#### US-4 — Char counter + cap (C2)

- **GIVEN** el composer
  **WHEN** el user escribe
  **THEN** se ve `charCount` (`{n}/500`), el textarea topea en 500, y `AiChatMessageSchema.content`
  rechaza >500 en el server.

#### US-5 — Error 429 amigable (C3)

- **GIVEN** el user excede el rate limit
  **WHEN** el API responde 429
  **THEN** la UI muestra `aiSearch.rateLimitError` (copy traducido), no "HTTP 429".

#### US-6 — Onboarding context-aware (B1)

- **GIVEN** el chat vacío en `/alojamientos/tipo/cabana`
  **WHEN** el user ve el empty state
  **THEN** los ejemplos están tailoreados al contexto (cabañas); en `/alojamientos` sin
  contexto, rotan desde el pool localizado. Click puebla+envía.

#### US-7 — Layout híbrido (D)

- **GIVEN** `/alojamientos`
  **WHEN** el user clickea el entry point "Buscar con IA"
  **THEN** se expande el drawer/modal con el panel; cerrar vuelve al entry point (colapsa).
  En mobile es full-screen.

## 6. Tasks (chained PRs — Q4)

**PR (i) — señal API (BÁSICO):**
| Task | Title | Fit |
|---|---|---|
| T-265-01 | A1: forward `confidence` (route + SSE event schema + client type + hook) | BÁSICO |
| T-265-02 | C2-schema: agregar `.max(500)` a `AiChatMessageSchema.content` + test | BÁSICO |
| T-265-03 | C3-classify: clasificar status en el SSE client (429/5xx) | BÁSICO |

**PR (ii) — transparencia UI (BÁSICO):**
| T-265-04 | A2: low-confidence UI (`lowConfidenceMessage`, threshold 0.4) | BÁSICO |
| T-265-05 | A3: destination chip via catálogo (prop nueva) | BÁSICO |

**PR (iii) — onboarding (POTENTE):**
| T-265-06 | B1a: pool estático localizado de ejemplos (es/en/pt) + empty-state chips | BÁSICO |
| T-265-07 | B1b: selección **context-aware** (tipo/destino activo → tailor; fallback pool) | **POTENTE** |

**PR (iv) — control + layout híbrido (MIXTO):**
| T-265-08 | C1: botón de stop streaming | BÁSICO |
| T-265-09 | C2-ui: char counter + `maxLength` en textarea | BÁSICO |
| T-265-10 | C3-ui: render de error copy diferenciado | BÁSICO |
| T-265-11 | D: **layout híbrido** — entry point + drawer/modal expand + estado apertura + responsive (absorbe C4) | **POTENTE** |

**Transversal:**
| T-265-12 | i18n: revivir keys muertos + nuevos (ejemplos, entry/drawer) es/en/pt + key-coverage test | BÁSICO |
| T-265-13 | Tests: componentes (low-confidence, abort, example-click, expand/collapse) + SSE client (confidence forward + error classify) | BÁSICO |
| T-265-14 | Smoke Chrome: confidence band interno, ejemplos, abort, rate-limit copy, layout híbrido | BÁSICO |
| T-265-15 | Docs: actualizar AI-search docs + cross-ref SPEC-199/212 | BÁSICO |

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A1 forwarda confidence pero la UI sobre-interpreta un score ruidoso | Medium | Solo interno (decisión owner): banda coarse para disparar el mensaje, sin número visible; calibrar threshold con queries reales. |
| Layout híbrido (D) se infla a un rediseño | Medium | Time-box; el panel ya es self-contained (4 props), el expand reusa el componente; drawer/modal es patrón conocido. |
| Onboarding context-aware (B1b) se complica | Medium | Atomizado: B1a (pool estático) entrega valor solo; B1b suma context-awareness encima, no bloquea. |
| Ejemplos drift de lo que el modelo maneja | Low | Sacarlos de las capacidades documentadas del prompt; testear cada uno. |
| i18n drift (key en un solo locale) | Low | Key-coverage test es/en/pt (T-265-12). |
| Cross-layer (A1/C2/C3 tocan API+web) infla un PR "de UI" | Low/Med | Chained PRs: PR(i) señal API separado de los PRs de UI (Q4). |

## Internal Review Notes

- Construido desde una exploración real de la implementación actual (web island + API route
  + `@repo/ai-core` + i18n). Recon 2026-06-24 verificó los punteros de §2 y corrigió el
  mito del cap de 500 chars (no existe en el chat path) — ver banner.
- El win más barato es **transparencia (A)**: confidence + varios affordances ya están en
  el backend / i18n, solo falta wirearlos. Alto impacto de confianza, bajo costo → BÁSICO.
- Las dos piezas POTENTE son el **layout híbrido (D/T-265-11)** y el **onboarding
  context-aware (B1b/T-265-07)** — atomizadas y marcadas, asignables a un modelo más capaz.
- Owner scoping: transparencia + onboarding context-aware + chat-control/errores + layout
  híbrido; deseleccionó el eje "bridge to full listing".

## Model Fit Verdict

**MIXTO.** Con las decisiones tomadas:

- **BÁSICO (la mayoría):** A1 (forward confidence), A2 (low-confidence message — i18n ya
  existe), A3 (destination chip — catálogo ya fetcheado), C1 (stop — AbortController ya
  existe), C2 (char counter + cap de schema), C3 (error classify), B1a (pool estático). Todo
  tiene file:línea exacto y el backend/i18n ya provee la señal; es wiring.
- **POTENTE (2 piezas atomizadas):** **T-265-11 layout híbrido** (entry + drawer/modal
  expand + estado de apertura + responsive — decisión owner por sobre el in-place mínimo) y
  **T-265-07 onboarding context-aware** (selección de ejemplos según contexto de página).
  Ambas son las opciones más ambiciosas que eligió el owner; un modelo chico puede hacer la
  base (B1a pool estático, y un entry-point simple) pero el context-awareness y la
  transición del drawer conviene asignarlos a un modelo más capaz o revisarlos.

**Ejecución:** chained PRs (Q4). PR(i) señal API + PR(ii) transparencia + PR(iii) onboarding
+ PR(iv) control/layout. Las tareas BÁSICAS son tomables de corrido; las 2 POTENTE están
aisladas en sus propias tasks. Criterios de aceptación cerrados y testeables.
