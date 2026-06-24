---
spec-id: SPEC-271
title: Partners program — admin-sold monthly listing (new entity reusing sponsorship shape + commerce billing)
type: feature
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
decided: 2026-06-23
model_fit: basic
effort_estimate_hours: 20-32
tags: [partners, billing, qzpay, admin, web, directory]
---

# SPEC-271: Partners program

> ## ✅ ARCHITECTURE DECISION RESOLVED (2026-06-23)
>
> El relevamiento mostró que existe un sistema `sponsorship` VIVO (services
> `sponsorship`/`postSponsorship`, rutas API, admin `sponsor-dashboard`,
> `SponsorshipTierPgEnum`) que sponsorea posts/eventos con pago único. Partners es
> distinto (standalone, billing recurrente QZPay), así que:
>
> **Decisión:** crear entidad **`partners` NUEVA**, sin tocar `sponsorship`. Reusar:
> - el **SHAPE** de `sponsorship` (tiers/levels, logo/link, status, analytics, cron de
>   expiry) — copiar el diseño, NO las tablas.
> - el **billing recurrente** del patrón commerce SPEC-239 (`product_domain = 'partner'`,
>   tabla link `partner_subscriptions`, reconciler de visibilidad).
>
> Esto aísla el feature (cero riesgo de regresión sobre sponsorship de posts), reutiliza
> dos patrones ya probados, y NO introduce lógica nueva sutil → modelo básico.
>
> **Tiers:** bronze / silver / gold, diferenciados por **orden de aparición** (gold
> primero) y **tamaño de card** en la página pública. El owner define los precios al
> crear los `billing_plans` de partner. (Si se prefiere plan único, omitir el enum tier;
> la estructura lo soporta.)

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Sistema de partners donde comercios/ONGs/instituciones pagan mensual (QZPay) por
figurar en una lista pública de partners. Venta **manual**: un admin crea el partner y le
envía un link de pago (o registra pago manual). NO es self-service.

### 2. Out of Scope

- Self-service signup · Commission-based listings (SPEC-239) · Partner self-dashboard ·
  Display ads/banners (esto es listado, no rotación publicitaria)

### 3. User Flow

(sin cambios respecto del original — admin vende, manda link QZPay o registra pago manual,
sistema activa, partner aparece en `/partners/`). Pago manual activa sin QZPay.

### 4. Data Model — qué clonar y de dónde

#### 4.1 Tabla `partners` (nueva) — shape copiado de `sponsorships`

| Columna | Tipo | Fuente del patrón |
|---------|------|-------------------|
| id | UUID PK | estándar |
| slug | varchar unique | `sponsorships.slug` |
| name | varchar(255) | nuevo (sponsorship no tiene name propio) |
| type | enum COMMERCE/NGO/INSTITUTION | nuevo (`PartnerTypePgEnum`) |
| tier | enum BRONZE/SILVER/GOLD | espejo de `SponsorshipTierPgEnum` |
| logoUrl | text | `sponsorships.logoUrl` |
| websiteUrl | text | `sponsorships.linkUrl` |
| description | text | nuevo |
| subscriptionStatus | enum PENDING/ACTIVE/PAST_DUE/CANCELLED | `sponsorships.sponsorshipStatus` |
| lifecycleState | enum ACTIVE/ARCHIVED | `sponsorships.lifecycleState` |
| analytics | jsonb {impressions,clicks} | `sponsorships.analytics` |
| planId | varchar FK billing_plans | patrón commerce |
| subscriptionId | varchar FK billing_subscriptions | patrón commerce |
| startsAt / endsAt | timestamptz | `sponsorships.startsAt/endsAt` |
| audit (createdAt/updatedAt/deletedAt/createdById/...) | | estándar BaseModel |

Índices: replicar los de `sponsorships` relevantes — `(subscriptionStatus, lifecycleState)`
para `findActivePartners`, y `(lifecycleState, endsAt)` para el cron de expiry.

#### 4.2 Billing — patrón commerce SPEC-239 (recurrente)

- `billing_plans` con `product_domain = 'partner'` (NUEVO domain; igual que commerce usa
  `'commerce'`). NO incluir en `ALL_PLANS` (no exponerlo en `/public/plans`).
- `partner_subscriptions` — tabla link (UNIQUE on `partner_id`), espejo de
  `commerce_listing_subscriptions`. El reconciler de visibilidad decide si el partner se
  muestra según la subscription activa.
- `loadEntitlements()` ya filtra `product_domain = 'accommodation'`, así que un partner
  con subscription NO contamina entitlements de host/commerce. Verificar que el filtro
  excluya `'partner'` también (debería, por ser != accommodation).
- Columna `product_domain` ya existe (extras `017-billing-plans-product-domain.column.sql`);
  solo agregar el valor `'partner'` donde el enum/check lo liste.

### 5. Admin Panel (patrón SPEC-185 entity lists)

- Entity list `/partners/` con estado (activo/inactivo/past_due), filtro por tier/type.
- Create/Edit form: name, type, tier, logo (upload), website, description, plan.
- Botón **Send payment link**: genera link QZPay (start-paid con `product_domain='partner'`)
  y lo muestra para copiar.
- Botón **Register manual payment**: activa sin QZPay; **loggear en audit_log**.
- Permiso nuevo `PermissionEnum.PARTNER_MANAGE`.

### 6. Web (público)

- Page `/[lang]/partners/` — grid de partners activos, ordenado por tier (gold→silver→bronze)
  y dentro del tier por `startsAt`. Tamaño de card por tier.
- `PartnerCard.astro` — logo + nombre + link externo (`rel="sponsored noopener"`).
- Filtro por type. Indexable (noindex=false). JSON-LD `ItemList`.
- i18n es/en/pt. Click registra `analytics.clicks` (endpoint público de tracking, opcional MVP).

### 7. API Routes

(sin cambios respecto del original: `GET /public/partners`, CRUD `/admin/partners`,
`POST /admin/partners/:id/send-link`, `POST /admin/partners/:id/manual-payment`. Todas
admin con `PARTNER_MANAGE`.)

### 8. User Stories con Acceptance Checks

#### US-1 — Admin vende y activa un partner

```
GIVEN un admin con PARTNER_MANAGE
WHEN crea un partner (name, type, tier, logo, website) y envía el link de pago
THEN se genera un link QZPay con product_domain='partner'
 AND al completarse el pago, subscriptionStatus pasa a ACTIVE
 AND el partner aparece en /partners/ ordenado según su tier
```
Checks:
- [ ] crear/editar/borrar partner desde admin
- [ ] link QZPay generado usa `product_domain='partner'`
- [ ] pago manual activa sin QZPay y queda en `audit_log`
- [ ] partner ACTIVE visible; PENDING/PAST_DUE/CANCELLED/ARCHIVED NO visibles

#### US-2 — Aislamiento de billing (no contaminar entitlements)

```
GIVEN un usuario que es host (accommodation) Y también partner
WHEN se cargan sus entitlements de host
THEN la subscription de partner (product_domain='partner') NO altera sus entitlements de accommodation
```
Checks:
- [ ] test: `loadEntitlements()` ignora subscriptions con `product_domain='partner'`
- [ ] el plan de partner NO aparece en `GET /public/plans`

#### US-3 — Visualización pública correcta

```
GIVEN partners activos de distintos tiers
WHEN un usuario visita /partners/
THEN ve un grid ordenado gold→silver→bronze, con tamaño de card por tier
 AND el filtro por type funciona
 AND la página es indexable con JSON-LD ItemList válido
```
Checks:
- [ ] orden por tier + startsAt
- [ ] filtro type
- [ ] JSON-LD ItemList válido (Schema.org validator)
- [ ] i18n es/en/pt completo

### 9. Tasks

(las 14 del original siguen válidas; ajustes de fuente-de-patrón ya reflejados arriba.
T-271-01 clona shape de sponsorship; T-271-03 usa product_domain='partner'; T-271-12 cron
espeja el índice anticipatorio de sponsorship expiry.)

### 10. Risks

| Risk | Mitigation |
|------|-----------|
| Contaminar entitlements de accommodation/commerce | `product_domain='partner'` separado + test de aislamiento (US-2) |
| Tocar sponsorship vivo por error | NO se toca: partners es entidad nueva, solo se copia el shape |
| Partner churn queda visible | Reconciler de visibilidad (patrón commerce) + cron expiry + webhook QZPay cancelación |
| Pago manual sin trazabilidad | audit_log en cada pago manual |

---

## Part 2 — Implementation Notes

### Fuentes de patrón (clonar, no importar)

- **Shape de entidad:** `packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts`
  (slug, logoUrl, linkUrl, status, lifecycleState, analytics, índices de status+expiry).
  Tiers: `SponsorshipTierPgEnum` en `enums.dbschema.ts:199`.
- **Billing isolation:** patrón commerce SPEC-239 — ver `CLAUDE.md` sección "Commerce
  subscription isolation (SPEC-239)": `product_domain`, `commerce_listing_subscriptions`,
  reconciler. Extras `017-billing-plans-product-domain.column.sql`.
- **Admin entity list:** SPEC-185 (entity lists v2).
- **Web listing:** páginas de accommodations/destinos como referencia de grid + SEO.

### Cross-spec dependencies

- SPEC-239 (commerce billing isolation) — mismo mecanismo product_domain.
- SPEC-193/192 (billing en DB) — plans en DB; agregar el de partner.
- SPEC-268 (SEO) — la página /partners necesita JSON-LD ItemList (ya contemplado).

---

## Model Fit Verdict

**BÁSICO.** La decisión de arquitectura (entidad nueva, reuse de shape + billing) está
cerrada, y los dos patrones a clonar (sponsorship shape, commerce billing isolation) están
documentados y probados en el codebase. El trabajo es CRUD + integración de billing
siguiendo convenciones (BaseCrudService, Zod schemas, route factories, product_domain). El
único punto que merece un test cuidadoso es el aislamiento de entitlements (US-2), pero es
un test, no lógica nueva. Sin decisiones abiertas ni invariantes de concurrencia.
