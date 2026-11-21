# HOS-2410 inventory part C: provider and partner (host trades, partners, alliances, benefits)

Generated 2026-11-20 from branch `spec/HOS-2410-docs` (from origin/staging). Row
format: `inventory-format.md` §1.2. Columns: anchor | kind | audiences | what the
owner sees | source | plannedArticle | exempt.

52 inventory rows. Section 7 groups the non-visible crons and notification types and
is not counted.

## 1. Inventory

### 1.1 Account pages (`mi-cuenta/*`)

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| page:mi-cuenta/proveedor | page | provider | «Mi ficha de proveedor», with tabs Mi ficha / Usos / Valoraciones / Mi QR. States: error; "todavía no tenés ficha" (link to aliados); "tu ficha fue dada de baja" plus the admin reason, with no edit form. Ownership gates it, not a permission. | `apps/web/src/pages/[lang]/mi-cuenta/proveedor/index.astro:11-26,54-92,204-293` | provider-ficha | |
| page:mi-cuenta/directorio-proveedores | page | host | «Directorio de proveedores». Empty states: no accommodations, or no providers for your destinations. | `.../directorio-proveedores/index.astro:3-27` | provider-directory | |
| page:mi-cuenta/directorio-proveedores/[slug] | page | host | One provider: benefit, hours, stats, reviews with the provider's reply. States: 403 (not a host), 404, 422 REVOKED, retry. | `.../directorio-proveedores/[slug]/index.astro:3-29` | provider-directory | |
| page:mi-cuenta/directorio-proveedores/[slug]/registrar-uso | page | host | «Registrar uso del beneficio», the QR landing. Date defaults to today and cannot be in the future; optional note up to 300 chars. Same four terminal states as the detail page. | `.../[slug]/registrar-uso/index.astro:3-35`; `packages/i18n/src/locales/es/host-trades.json` (`registerUsage.*`); `packages/service-core/src/services/hostTrade/host-trade-usage.service.ts:88-91` | benefit-usage | |
| page:mi-cuenta/usos-de-beneficio | page | host, provider | «Usos del beneficio»: an «Esperan tu confirmación» inbox plus an «Historial» filtered by Pendientes, Confirmados, Rechazados and Vencidos. | `.../usos-de-beneficio/index.astro:3-23,50-105` | benefit-usage | |
| page:mi-cuenta/partner | page | partner | «Mi ficha de aliado». Banner states: empty, under review, rejected, approved, active subscription, revoked. "Tu cuota a pagar" by bank transfer; presence notice. | `.../partner/index.astro:3-38,68-110,110-215` | partner-ficha | |
| page:mi-cuenta/aliados | page | host, provider, partner | «Sumate como aliado» hub: doors, own applications, claim banner, partner stats, mentions log, traffic. | `.../aliados/index.astro:3-26,93-190` | alliance-apply | |
| page:mi-cuenta/ofertas-exclusivas | page | (tourist) | «Ofertas exclusivas», tourist deals scoped by plan. | `.../ofertas-exclusivas/index.astro:3-6` | — | out-of-scope: tourist-only (the file's own doc comment says so) |

### 1.2 Sections of account pages

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| page:mi-cuenta/proveedor?tab=usos | section | provider | Declare a use (pick a linked host, or enter an email); pending inbox; suspension notice with its reason. | `proveedor/index.astro:124-161,184-193`; `host-trades.json` `provider.usages.*` | benefit-usage-provider | |
| page:mi-cuenta/proveedor?tab=qr | section | provider | «Tu código QR»: SVG, download and print. It leads to registrar-uso. | `proveedor/index.astro:174-182`; `apps/api/src/routes/host-trade/protected/mine-qr.ts:1-25` | provider-qr | |
| page:mi-cuenta/proveedor?tab=valoraciones | section | provider | Reviews received. A reply needs at least 10 chars and goes to moderation; the rejection reason arrives only by email. | `proveedor/index.astro:163-172`; `packages/schemas/src/entities/host-trade/host-trade-usage.constants.ts:93`; `packages/notifications/src/types/notification.types.ts:249-259` | provider-reviews | |
| page:mi-cuenta/proveedor?tab=ficha | section | provider | Contact, 24h and hours change immediately. A benefit change goes to Hospeda review while the old one stays live. Name, slug and categories are managed by Hospeda. | `proveedor/index.astro:287-289`; `packages/i18n/src/locales/es/account.json` (`provider.form.*`) | provider-ficha | |
| page:mi-cuenta/aliados#mentions | section | partner | «Bitácora de menciones»: what Hospeda published for you, with a link to each post. | `aliados/index.astro:155-163`; `account.json` `partnerMentions.*` | partner-stats-mentions | |
| page:mi-cuenta/aliados#stats | section | partner | «Tus números»: page visits and logo clicks over 7/30 days, inside the platform only. | `aliados/index.astro:164-176`; `account.json` `partnerStats.*` | partner-stats-mentions | |

### 1.3 Public pages (no gate)

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| page:partners/[slug] (no gate) | page | partner | The partner's own page, only while the public-page key is active. Otherwise a 404 with no body. | `apps/web/src/pages/[lang]/partners/[slug].astro:3-12,48-51`; `apps/api/src/routes/partners/public/get-by-slug.ts:9-21` | partner-presence | |
| page:partners/reclamar (no gate) | page | partner | Noindex claim page, opened from the emailed link; the token travels in the URL fragment. | `apps/web/src/pages/[lang]/partners/reclamar/index.astro:2-6,22-35` | alliance-apply | |
| page:sumate/proveedor (no gate) | page | provider | «Sumate como proveedor de servicios». Posts an alliance lead with `kind: service_provider`; an admin reviews it by hand and nothing is created automatically. | `apps/web/src/pages/[lang]/sumate/proveedor/index.astro:3-14,22-28` | alliance-apply | |
| page:sumate/partner (no gate) | page | partner | «Convertite en partner de Hospeda». Posts an email to `POST /public/partner-applications` (Turnstile). | `apps/web/src/pages/[lang]/sumate/partner/index.astro:3-12,24-27`; `apps/api/src/routes/partner-application/public/submit.ts:11-35` | alliance-apply | |
| page:sumate/sponsor (no gate) | page | partner | «Sponsoreá Hospeda». An alliance lead with `kind: sponsor` that an admin evaluates; nothing is provisioned automatically. | `apps/web/src/pages/[lang]/sumate/sponsor/index.astro:3-12` | alliance-apply | |
| page:qr/[slug] (no gate) | page | host | The sticker URL `/qr/{qrSlug}/`, which redirects to registrar-uso. | `apps/api/src/routes/host-trade/protected/mine-qr.ts:63,147`; the file `apps/web/src/pages/qr/[slug].astro` exists (UNVERIFIED: body not read) | provider-qr | |
| page:index#carousel (no gate) | section | partner | Home logo carousel. The logo links to the partner's own page if it has one, otherwise out to its site with `rel="sponsored nofollow noopener"`, otherwise nowhere. | `apps/web/src/components/sections/PartnersSection.astro:2-9`; `apps/web/src/lib/partner-logo-link.ts:36-64` | partner-presence | |
| page:presentacion/proveedores (no gate) | page | provider | A sales deck the owner sends out. Noindex, not in the sitemap, untranslated. | `apps/web/src/pages/[lang]/presentacion/proveedores/index.astro:3-20` | — | no-user-surface: private commercial deck |
| page:presentacion/aliados (no gate) | page | partner | The same deck, for partners. | `.../presentacion/aliados/index.astro:3-20` | — | no-user-surface: private commercial deck |
| page:publicar/* | page | — | Verified absent. `publicar*` pages never mention provider, partner or host trade; onboarding for these audiences is `sumate/*` only. | `rg -il 'proveedor\|provider\|partner\|host-trade' apps/web/src/pages/[lang]/publicar*` (no hits) | — | no-user-surface: not for providers |

### 1.4 Entitlements, limits, activation

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| entitlement:partner_public_page | entitlement | partner | Gold plan: own page at `/partners/<slug>`, and the carousel logo links to it. | `packages/schemas/src/catalog/key-enums.ts:57`; `apps/api/src/services/partner-presence/partner-presence-read.service.ts:41-62` | partner-presence | |
| entitlement:partner_carousel_presence | entitlement | partner | Logo in the home carousel (both plans). | `key-enums.ts:58`; `partner-presence-read.service.ts:59-63` | partner-presence | |
| limit:(none) | limit | provider, partner | No `LimitKeyEnum` value applies to provider or partner. | `key-enums.ts:65-89` | — | no-user-surface: no limit keys |
| activation:partner | activation | partner | No trial: the partner activation event is `null`. | `packages/schemas/src/catalog/vertical-activation-event.ts:35-48` | partner-subscription | |
| plan:partner-silver / partner-gold | state | partner | Two plans; the tier is never shown publicly. Prices are DB rows and never go into help (guard (d)). | `scripts/production-catalog/commercial-catalog.ts:87-88`; `apps/web/src/lib/billing/dashboard-plan-stat.ts:16-17` | partner-subscription | |
| perm:HOST_TRADE_VIEW | entitlement | host | Directory access is a permission, not an entitlement. It is seeded for the HOST role and admins ("free for those who publish"). | `packages/seed/src/required/rolePermissions.seed.ts:1195` (HOST block from `:1068`); `apps/api/src/routes/host-trade/protected/list.ts:42`; `host-trades.json` `accessDenied.*` | provider-directory | |

### 1.5 States and rules

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| state:usage.PENDING/CONFIRMED/REJECTED/EXPIRED | state | host, provider | Pendiente / Confirmado / Rechazado / Vencido. Only CONFIRMED counts. | `host-trades.json` `usages.status.*`; `host-trade-aggregates.ts:35-50` | benefit-usage | |
| state:usage.expiry-30d | state | host, provider | A pending use expires after 30 days, silently. | `host-trade-usage.constants.ts:22` | benefit-usage | |
| state:usage.undo-reject | state | host, provider | Only the account that rejected can undo, which returns the use to PENDING; nobody is emailed. | `host-trade-usage.service.ts:1486-1498`; `apps/api/src/mcp/tools/host-trade/undo-benefit-rejection.ts:1-12` | benefit-usage | |
| state:usage.suspension | state | provider | 3 rejections within 90 days suspend the provider's ability to declare; an admin lifts it. Confirmed uses keep counting. | `host-trade-usage.constants.ts:45,48`; `host-trades.json` `provider.usages.suspended.*` | benefit-usage-provider | |
| state:usage.role-blind-404 | state | host, provider | Confirm, reject and undo are decided by `declaredBy`, never by role. Every foreign path answers 404, including answering your own declaration. | `apps/api/src/routes/host-trade/protected/usage-transitions.ts:3-26` | benefit-usage | |
| state:directory.public-counters | state | host | The card shows a rating only from 3 reviews. Counters are CONFIRMED uses, distinct hosts and APPROVED reviews. | `host-trade-usage.constants.ts:61`; `host-trade-aggregates.ts:47-60` | provider-directory | |
| state:trade.revoked | state | provider, host | The provider sees "ficha dada de baja" plus the reason; the host gets 422 REVOKED on the detail and registrar-uso pages; email `host_trade_revoked`. | `proveedor/index.astro:226-241`; `directorio-proveedores/[slug]/index.astro:22-24` | provider-ficha | |
| state:partner.revoked-vs-unpaid | state | partner | Revoked: "dada de baja y ya no se ve". Lapsed plan: "No se borró nada… tu presencia vuelve sola". Admin moderation hides presence even while the plan is active. | `partner/index.astro:68-76,110-125` | partner-ficha | |
| state:partner.content-review | state | partner | `contentReviewState` is pending, rejected or approved. Payment opens only once `contentApprovedAt` is set. | `partner/index.astro:7-38,89-97,126-165` | partner-ficha | |

### 1.6 MCP tools

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| tool:search_providers | tool | host | Searches the directory with paging, scoped to the owner's destinations. Requires HOST_TRADE_VIEW. Returns a portal link and never declares a use. | `apps/api/src/mcp/tools/registry.ts:51`; `.../host-trade/search-providers.ts:1-30` | assistant-benefit-usage | |
| tool:list_benefit_usages | tool | host, provider | Uses from both sides; `pendingMine` is the inbox. | `registry.ts:52`; `.../list-benefit-usages.ts:1-24` | assistant-benefit-usage | |
| tool:confirm_benefit_usage | tool | host, provider | Two steps: a preview with a single-use token, then the commit. Emails the declarant. | `registry.ts:53`; `.../answer-benefit-usage.ts:1-32` | assistant-benefit-usage | |
| tool:reject_benefit_usage | tool | host, provider | Same two steps; the note is optional. | `registry.ts:54`; `.../answer-benefit-usage.ts:24-36` | assistant-benefit-usage | |
| tool:undo_benefit_rejection | tool | host, provider | One step, only for the account that rejected; emails nobody. | `registry.ts:55`; `.../undo-benefit-rejection.ts:1-12` | assistant-benefit-usage | |

### 1.7 Emails (no gate)

Subjects come from `packages/notifications/src/utils/subject-builder.ts`.

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| email:host_trade_usage_confirmation_request | email | host, provider | «{counterpart} registró un uso del beneficio: ¿nos lo confirmás?» | `notification.types.ts:212`; `subject-builder.ts:99` | benefit-usage | |
| email:host_trade_usage_confirmation_reminder | email | host, provider | «Sigue pendiente el uso del beneficio con {counterpart}», a single reminder on day 10. | `notification.types.ts:222`; `subject-builder.ts:101` | benefit-usage | |
| email:host_trade_usage_confirmed | email | host, provider | «{counterpart} confirmó el uso del beneficio». When the host declared, it invites them to review. | `notification.types.ts:229`; `subject-builder.ts:103` | benefit-usage | |
| email:host_trade_usage_rejected | email | host, provider | «{counterpart} no reconoció el uso del beneficio», with the note. | `notification.types.ts:240`; `subject-builder.ts:105` | benefit-usage | |
| email:host_trade_review_received | email | provider | «Recibiste una valoración en {listing}» | `notification.types.ts:247`; `subject-builder.ts:112` | provider-reviews | |
| email:host_trade_reply_moderated | email | provider | «Novedades sobre tu respuesta en Hospeda», with the moderator's reason. | `notification.types.ts:259`; `subject-builder.ts:112-115` | provider-reviews | |
| email:host_trade_revoked | email | provider | «Tu ficha {listing} ya no aparece en el directorio de Hospeda» | `notification.types.ts:202`; `subject-builder.ts:93-94` | provider-ficha | |
| email:alliance_claim_invite | email | provider, partner | «¿Postulaste a {programa} en Hospeda? Confirmanos que fuiste vos». Single-use token valid 7 days. | `notification.types.ts:176`; `subject-builder.ts:82-83`; `packages/service-core/src/services/alliance-lead/alliance-lead.service.ts:376` | alliance-apply | |
| email:alliance_lead_decision | email | provider, partner | «Novedades sobre tu postulación a {programa} en Hospeda» (approval or rejection). | `notification.types.ts:188`; `subject-builder.ts:88-89` | alliance-apply | |
| email:partner_revoked | email | partner | «{partner} ya no aparece entre los aliados de Hospeda» | `notification.types.ts:260`; `subject-builder.ts:116` | partner-ficha | |
| email:partner_mentions_logged | email | partner | «Difundimos {partner} el {fecha}», one email per submission. | `notification.types.ts:272`; `subject-builder.ts:122` | partner-stats-mentions | |
| email:partner-claim-notice / partner-application-rejected (no gate) | email | partner | Claim link and rejection of a Partner application, rendered by the outbox rather than through `NotificationType`. UNVERIFIED: subject resolver not read. | `packages/notifications/src/services/outbox/partner-application-renderers.tsx:29,52-90`; `packages/notifications/src/templates/partner/` | alliance-apply | |

### 1.8 Crons

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| cron:host-trade-usage-expiry | cron | host, provider | Daily at 04:15: pending uses older than 30 days become Vencido. Notifies nobody. | `apps/api/src/cron/schedules.manifest.ts:122-128` | benefit-usage | |
| cron:host-trade-usage-reminder | cron | host, provider | Daily at 04:30: a single reminder on day 10, never repeated. | `schedules.manifest.ts:236-242` | benefit-usage | |

## 7. Not visible to owners, or out of scope

- `host-trade-stats-reconcile` (Mondays 05:00): recomputes the counters as a backstop (`schedules.manifest.ts:244-250`).
- Partner click telemetry: purge after 120 days, and a monthly rollup (`schedules.manifest.ts:362,377`).
- `provider-notification-retention`: about **payment** providers, not host-trade providers (`schedules.manifest.ts:463-467`). Do not cite it in help.
- `provider-watch-battery`: administrator email (`schedules.manifest.ts:470-475`).
- Admin routes under `apps/api/src/routes/{host-trade,partners,alliance,partner-application}/admin`, and the host-trade category catalog (admin plus a public list).

## 8. Proposed articles (part C)

The ids `provider-directory`, `benefit-usage` and `benefit-usage-provider` are reused from the current catalog.

| id | title | summary | audiences | public | covers | entryFor | related | crossPartLinks |
|---|---|---|---|---|---|---|---|---|
| provider-directory | Usar el directorio de proveedores | Encontrá proveedores locales con beneficios para anfitriones. | host | false | state:directory.public-counters, perm:HOST_TRADE_VIEW, state:trade.revoked | page:mi-cuenta/directorio-proveedores, page:mi-cuenta/directorio-proveedores/[slug] | benefit-usage, assistant-benefit-usage, alliance-apply, provider-reviews | accommodation publish |
| benefit-usage | Registrar y confirmar usos de un beneficio | Cómo se registra un uso y cómo se confirma, rechaza o deshace. | host, provider | false | registrar-uso, state:usage.*, emails host_trade_usage_*, crons usage-expiry/reminder | page:mi-cuenta/usos-de-beneficio, page:mi-cuenta/directorio-proveedores/[slug]/registrar-uso | provider-directory, benefit-usage-provider, provider-qr, provider-reviews, assistant-benefit-usage | — |
| benefit-usage-provider | Soy proveedor: registrar usos y confirmar los que me declaran | Cómo declarar un uso con el selector o por email, y qué pasa con una suspensión. | provider | false | tab=usos, state:usage.suspension | — | benefit-usage, provider-qr, provider-ficha, provider-reviews | — |
| provider-qr | Mi código QR de proveedor | Descargá e imprimí tu QR para que el anfitrión registre el uso él mismo. | provider | false | tab=qr, page:qr/[slug] | — | benefit-usage-provider, benefit-usage, provider-ficha | — |
| provider-ficha | Mi ficha de proveedor y cómo se publica | Cómo editar tu ficha y qué pasa si el equipo la da de baja. | provider | false | page:mi-cuenta/proveedor, tab=ficha, state:trade.revoked, email:host_trade_revoked | page:mi-cuenta/proveedor | provider-qr, benefit-usage-provider, provider-reviews, alliance-apply | contact |
| provider-reviews | Valoraciones y respuestas en mi ficha | Cómo ver valoraciones y responderlas, y por qué tu respuesta se revisa. | provider, host | false | tab=valoraciones, emails review_received/reply_moderated | — | provider-ficha, benefit-usage, provider-directory | — |
| alliance-apply | Sumarme como proveedor, partner o sponsor | Cómo postularte, confirmar que fuiste vos y qué esperar de la respuesta. | provider, partner | true | page:mi-cuenta/aliados, sumate/*, partners/reclamar, emails alliance_* and claim | page:mi-cuenta/aliados, page:sumate/proveedor, page:sumate/partner, page:sumate/sponsor, page:partners/reclamar | provider-ficha, partner-ficha, provider-directory | — |
| partner-ficha | Mi ficha de aliado: revisión, pago y baja | Logo y textos, qué revisamos, el pago por transferencia y la baja. | partner | false | page:mi-cuenta/partner, state:partner.*, email:partner_revoked | page:mi-cuenta/partner | partner-subscription, partner-presence, partner-stats-mentions, alliance-apply | subscription |
| partner-subscription | Mi plan de partner, sin período de prueba | Los dos planes, sin prueba, y cómo se cobran. | partner | false | plan:partner-*, activation:partner | — | partner-ficha, partner-presence | subscription, change-plan |
| partner-presence | Dónde aparece mi marca: carrusel y página propia | Qué incluye cada plan y cuándo tu página responde como si no existiera. | partner | true | entitlement:partner_public_page, entitlement:partner_carousel_presence, page:partners/[slug], page:index#carousel | page:partners/[slug] | partner-ficha, partner-subscription, partner-stats-mentions | — |
| partner-stats-mentions | Mis números y la bitácora de menciones | Qué medimos dentro de Hospeda y qué difundimos nosotros por vos. | partner | false | aliados#stats, aliados#mentions, email:partner_mentions_logged | — | partner-ficha, partner-presence | — |
| assistant-benefit-usage | Gestionar proveedores y usos desde el asistente | Buscar proveedores, y listar, confirmar, rechazar o deshacer usos con el asistente. | host, provider | false | tool:search_providers, list/confirm/reject/undo tools | — | benefit-usage, provider-directory, benefit-usage-provider | ai-assistants |

### Key facts per article (es)

- **provider-directory**: solo aparecen proveedores de los destinos de tus alojamientos; si no tenés alojamientos, el directorio queda vacío. La estrella aparece desde 3 valoraciones. NO esperar: proveedores de otros destinos, ni que el asistente declare usos por vos.
- **benefit-usage**: un uso cuenta solo cuando la otra parte lo confirma. Vence a los 30 días sin aviso, con un único recordatorio el día 10. Rechazar no pide motivo, y solo quien rechazó puede deshacerlo. Un rechazo impide volver a declarar entre las mismas dos partes. NO esperar: que declarar tu propio uso lo confirme. Un uso ajeno responde "no existe".
- **benefit-usage-provider**: lo que declarás no suma hasta que el anfitrión lo confirma. 3 rechazos en 90 días suspenden tu registro, y la suspensión la levanta Hospeda. NO esperar: que funcione un email del anfitrión distinto del de su cuenta.
- **provider-qr**: el QR lleva solo a `/qr/{slug}/`, sin token ni vencimiento. Quien lo escanea tiene que ser anfitrión. NO esperar: que el QR identifique solo al anfitrión; usa su sesión.
- **provider-ficha**: contacto, 24h y horario cambian al instante. El beneficio pasa por revisión y mientras tanto sigue visible el anterior. Nombre, slug y rubros los gestiona Hospeda. Si te dan de baja, ves el motivo y el formulario desaparece. NO esperar: recuperar la ficha desde el panel.
- **provider-reviews**: tu respuesta (mínimo 10 caracteres) siempre se revisa antes de publicarse, y si la editás vuelve a revisión. El motivo de un rechazo llega solo por email. NO esperar: poder borrar valoraciones.
- **alliance-apply**: postularte no crea nada solo: un admin revisa la postulación y recién ahí se crea la ficha. El enlace de confirmación vale 7 días. Proveedor y partner terminan con una ficha editable; sponsor queda como contacto. NO esperar: acceso inmediato.
- **partner-ficha**: el contenido pasa por cuatro estados (a completar, en revisión, corrección pedida, aprobado). El pago se habilita recién con el contenido aprobado, por transferencia. NO esperar: que "dado de baja" y "dejaste de pagar" sean lo mismo. Si volvés a pagar, la presencia vuelve sola.
- **partner-subscription**: el partner no tiene prueba gratis (su evento de activación es null). La suscripción la arma el equipo. Los precios van como `{{link:plans:partner}}`, nunca como números.
- **partner-presence**: solo el plan oro tiene página propia; el plata aparece en el carrusel con un link a su sitio. El nivel nunca se muestra en público. NO esperar: un directorio de partners, porque `/partners/` no existe.
- **partner-stats-mentions**: las métricas son de lo que pasa dentro de Hospeda (visitas, clics en el logo). La bitácora registra acciones, no resultados. NO esperar: métricas de redes ni de sitios externos.
- **assistant-benefit-usage**: confirmar y rechazar se hacen en dos pasos (vista previa y luego confirmación); deshacer, en uno. NO esperar: que el asistente cree un uso nuevo.

## 9. Gaps and bugs

1. The root `CLAUDE.md` says the public partner page answers 410 when the partner is revoked. No 410 exists today: `get-by-slug.ts:9-21` and `partners/[slug].astro:49-51` answer only 404. Help must not promise a 410, and the doc needs correcting.
2. Possible revoked-partner leak: `partner-presence-read.service.ts` never reads `revokedAt`. UNVERIFIED.
3. Gold and silver are not tiers in code, only plan slugs mapped to the two entitlements.
4. A stale comment in `aliados/index.astro:5-10` says sponsor and partner are "lead-only forever". Partner now has an application and claim flow.
5. Venue and experience owners and the directory: `HOST_TRADE_VIEW` is granted only to the HOST role. UNVERIFIED whether these owners hold it.
6. The partner-application claim TTL and its email subjects were not read (UNVERIFIED).
7. For a revoked provider the edit form is hidden, but the API still accepts PATCH (`proveedor/index.astro:15-21`).
8. UNVERIFIED whether the sidebar lists `/mi-cuenta/proveedor` and `/mi-cuenta/partner` after approval.
9. Name collision: `provider-notification-retention` is about the payment provider, not host trades.
10. The current topics `provider-directory` and `benefit-usage` do not mention the 30-day expiry, the day-10 reminder, or that a rejection blocks re-declaring.
