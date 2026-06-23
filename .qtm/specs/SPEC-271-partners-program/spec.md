---
spec-id: SPEC-271
title: Partners program — businesses/NGOs/institutions pay monthly to be listed as partners
type: feature
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 20-32
tags: [partners, billing, qzpay, admin, web, directory, advertising, commerce]
---

# SPEC-271: Partners program

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Crear un sistema de partners donde comercios, ONGs, e instituciones pagan un monto mensual para figurar como partners de Hospeda (publicidad/difusión). El flujo de venta es manual: un admin (persona física) gestiona el partner desde el admin panel, le envía un link de subscripción QZPay o registra pago manual, y el partner aparece en una lista pública de partners en la web.

**Why now:** Monetización. Los partners aportan revenue recurrente sin ser hosts ni comercios con listings. Es publicidad directa (no commission-based como SPEC-239 commerce).

**Key distinction:** NO es self-service. El admin vende el partner (persona física contacta al comercio/ONG, le ofrece el partnership, le envía el link de pago). El partner no se subscribe desde la web directamente.

### 2. Out of Scope

- Self-service partner signup (el partner no se subscribe solo)
- Commission-based commerce listings (eso es SPEC-239)
- Partner dashboard self-management (el admin gestiona todo)
- Rotación/banners de publicidad (esto es listing de partners, no display ads)

### 3. User Flow

#### 3.1 Admin flow (venta manual)

1. Admin contacta al comercio/ONG/institución (fuera del sistema)
2. Admin crea el partner en el admin panel (datos: nombre, logo, web, descripción, tipo)
3. Admin selecciona un plan de partner (tier: bronze/silver/gold o monto custom)
4. Admin envía link de subscripción QZPay al partner (email/WhatsApp)
5. Partner completa el pago via QZPay (MercadoPago)
6. Sistema detecta pago → activa partner
7. Partner aparece en la lista pública de partners en la web

#### 3.2 Pago manual

1. Admin registra pago manual (efectivo, transferencia) en el admin panel
2. Sistema activa partner sin QZPay

#### 3.3 Web flow (visualización)

1. Usuario visita `/partners/` (o sección en home/footer)
2. Ve lista de partners activos (grid de logos con link)
3. Filtro por tipo (comercio/ONG/institución) opcional
4. Click en partner → link externo al sitio del partner

### 4. Data Model

#### 4.1 Nueva tabla: `partners`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| name | varchar(255) | Nombre del partner |
| slug | varchar(255) unique | URL slug |
| type | enum | COMMERCE / NGO / INSTITUTION |
| logo_url | varchar | URL del logo |
| website_url | varchar | URL del sitio del partner |
| description | text | Descripción corta |
| lifecycleState | enum | ACTIVE / ARCHIVED |
| subscriptionStatus | enum | PENDING / ACTIVE / PAST_DUE / CANCELLED |
| planId | varchar FK | Referencia a billing_plans (plan de partner) |
| subscriptionId | varchar FK | Referencia a billing_subscriptions |
| startsAt | timestamptz | Inicio del partnership |
| endsAt | timestamptz nullable | Fin (si no es recurring) |
| createdById | UUID FK users | Admin que creó |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz nullable | Soft delete |

#### 4.2 Billing integration

- Usa `billing_plans` con `product_domain = 'partner'` (nuevo domain, igual que SPEC-239 usa `'commerce'`)
- Usa `billing_subscriptions` para trackear el pago mensual
- QZPay start-paid route reutilizado (mismo patrón que commerce)
- `commerce_listing_subscriptions` pattern: tabla link `partner_subscriptions` (UNIQUE on partner_id)

### 5. Admin Panel

- **Entity list**: `/partners/` — lista de partners con estado (activo/inactivo/past_due)
- **Create/Edit**: form con nombre, tipo, logo, website, descripción, plan
- **Send payment link**: botón que genera link QZPay y lo muestra para copiar/enviar
- **Register manual payment**: botón para registrar pago manual (no QZPay)
- **Permissions**: nuevo `PermissionEnum.PARTNER_MANAGE` (SUPER_ADMIN o STAFF con permiso)

### 6. Web (público)

- **Page**: `/[lang]/partners/` — grid de partners activos
- **Component**: `PartnerCard.astro` — logo + nombre + link
- **Filtro**: por tipo (comercio/ONG/institución) opcional
- **SEO**: `SEOHead` con noindex=false (indexable), JSON-LD `ItemList`
- **i18n**: textos en es/en/pt

### 7. API Routes

| Route | Tier | Auth | Descripción |
|-------|------|------|-------------|
| `GET /api/v1/public/partners` | Public | None | Lista de partners activos |
| `GET /api/v1/admin/partners` | Admin | PARTNER_MANAGE | Lista de todos los partners |
| `POST /api/v1/admin/partners` | Admin | PARTNER_MANAGE | Crear partner |
| `PATCH /api/v1/admin/partners/:id` | Admin | PARTNER_MANAGE | Editar partner |
| `DELETE /api/v1/admin/partners/:id` | Admin | PARTNER_MANAGE | Soft delete partner |
| `POST /api/v1/admin/partners/:id/send-link` | Admin | PARTNER_MANAGE | Generar link QZPay |
| `POST /api/v1/admin/partners/:id/manual-payment` | Admin | PARTNER_MANAGE | Registrar pago manual |

### 8. Tasks

| Task | Title | Status |
|---|---|---|
| T-271-01 | DB migration: `partners` table + `partner_subscriptions` link | pending |
| T-271-02 | Schemas: partner schema (Zod) en @repo/schemas | pending |
| T-271-03 | Billing: crear plan de partner con `product_domain = 'partner'` | pending |
| T-271-04 | Service: PartnerService en @repo/service-core | pending |
| T-271-05 | API routes: public + admin endpoints | pending |
| T-271-06 | Admin: partner entity list + create/edit form | pending |
| T-271-07 | Admin: send payment link (QZPay) + manual payment | pending |
| T-271-08 | Admin: permission PARTNER_MANAGE + sidebar entry | pending |
| T-271-09 | Web: `/partners/` page + PartnerCard component | pending |
| T-271-10 | Web: i18n strings (es/en/pt) | pending |
| T-271-11 | Web: SEO (SEOHead + JSON-LD ItemList) | pending |
| T-271-12 | Cron: partner subscription expiry/deactivation | pending |
| T-271-13 | Tests: service + API + admin + web | pending |
| T-271-14 | Seed: partner test data | pending |

### 9. Acceptance Criteria

- [ ] Admin puede crear/editar/eliminar partners
- [ ] Admin puede enviar link de pago QZPay al partner
- [ ] Admin puede registrar pago manual
- [ ] Partner activo aparece en `/partners/` en la web
- [ ] Partner inactivo NO aparece en `/partners/`
- [ ] Partner con subscription past_due no aparece hasta que se regularice
- [ ] Filtro por tipo funciona en web
- [ ] i18n completo en es/en/pt
- [ ] SEO: page indexable, JSON-LD válido
- [ ] Tests pasan con ≥90% coverage

### 10. Risks

| Risk | Mitigation |
|---|---|
| Conflicto con SPEC-239 commerce (product_domain) | Usar `product_domain = 'partner'` separado, no mezclar con commerce ni accommodation |
| Logo quality/size variable | Validar dimensions en upload, recomendar SVG/PNG transparente |
| Partner churn (cancela y queda visible) | Cron de deactivación + webhook QZPay para cancelación inmediata |
| Pago manual sin audit trail | Loggear en audit_log cada pago manual registrado |

---

## Part 2 — Implementation Notes

### Source

Owner request (2026-06-23): "sistema de partners, comercios/ong/instituciones que pagan un monto mensual por ser partner, figurando en lista de partners, osea, publicidad. Debe funcionar como commerce, si bien pagan con qzpay, el pedido inicial de pago se dispara desde el admin pasandole un link para subscribirse, o pago manual, no es subscripcion directa desde web, sino venta por un admin (persona física)."

### Reference

- Commerce pattern: SPEC-239 (commerce_listing_subscriptions, product_domain)
- Billing: QZPay (`@qzuor/qzpay-core`), MercadoPago adapter
- Sponsorship (existing): `packages/db/src/schemas/sponsorship/` — pattern similar pero para posts/events
- Admin entity pattern: SPEC-185 (admin entity lists v2)
- Web entity pattern: accommodations/destinos listing pages

### Cross-spec dependencies

- SPEC-239 (commerce listings) — mismo patrón de billing isolation (product_domain)
- SPEC-193 (billing go-live master) — billing system debe estar estable
- SPEC-192 (billing catalog to DB) — plans en DB
