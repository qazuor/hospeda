# Before Beta Testing

Checklist obligatorio antes de habilitar beta testing con clientes reales.
Cada item debe completarse y verificarse. No se abre beta hasta que todos
los bloqueantes (P0) estén resueltos.

## Estado actual

- SPEC-091 (Host Onboarding + Subscription Checkout): **implementado y commiteado**
- 225 tests pasando
- Typecheck y lint limpio en código nuevo
- Falta validación end-to-end con servicios reales

---

## P0 — Bloqueantes (no se lanza beta sin esto)

### 1. Smoke test manual de host onboarding en staging

- [ ] Levantar staging con DB reset + seed (`pnpm db:fresh-dev` en staging)
- [ ] Crear cuenta nueva como propietario, verificar email vía Resend
- [ ] Recorrer `/publicar` → CTA → `/publicar/nueva`
- [ ] Llenar las 8 secciones del formulario completas
- [ ] Verificar autosave (status indicator transiciona idle → saving → saved)
- [ ] Verificar persistencia: cerrar pestaña, reabrir, ver banner "Continuar borrador"
- [ ] Subir 5 fotos a Cloudinary, verificar que aparecen en thumbnails
- [ ] Click "Publicar" → redirect a `/alojamientos/{slug}` exitoso
- [ ] Verificar en DB: rol HOST asignado al usuario, accommodation con `lifecycleState=ACTIVE`
- [ ] Visitar `/mi-cuenta/propiedades` y ver la propiedad listada con badge verde
- [ ] Editar la propiedad desde `/mi-cuenta/propiedades/[id]/editar`, cambiar precio, ver autosave PATCH

### 2. Ejecutar staging runbook de checkout MercadoPago

Seguir `.claude/specs/SPEC-091-mvp-blockers/staging-runbook.md`. No saltar pasos.

#### Preconditions

- [ ] App MP sandbox creada en mercadopago.com.ar/developers
- [ ] Variables de entorno seteadas en staging:
  - `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`
  - `HOSPEDA_MERCADO_PAGO_PUBLIC_KEY`
  - `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`
- [ ] Webhook URL registrada en dashboard MP: `https://staging.hospeda.com.ar/api/v1/webhooks/mercadopago`
- [ ] Planes seedeados (owner-basico, owner-pro, owner-premium, tourist-free, tourist-plus, tourist-vip)

#### Scenarios

- [ ] Scenario 1: Approved payment con tarjeta `5031 7557 3453 0604` cardholder `APRO`
- [ ] Scenario 2: Pending payment cardholder `CONT`
- [ ] Scenario 3: Rejected payments — verificar las 4 razones (`OTHE`, `FUND`, `CALL`, `SECU`) y que la página de failure renderiza el mensaje correcto en cada caso
- [ ] Scenario 4: Webhook idempotency — replay 3 veces el mismo webhook, verificar 1 sola fila en `billing_webhook_events`
- [ ] Scenario 5: Unauthenticated checkout → redirect a `/auth/signin?redirect=/suscriptores/planes`

#### Verificación post-test

- [ ] Subscription activada en `billing_subscriptions` para el usuario de test
- [ ] `/mi-cuenta` refleja el plan contratado
- [ ] Logs de Sentry sin errores nuevos durante el flujo

### 3. Una transacción real pre-beta en producción

Antes de abrir beta, ejecutar UNA transacción real con monto bajo para validar
que el webhook funciona contra MercadoPago productivo.

- [ ] Variables de entorno productivas seteadas (credenciales reales, no sandbox)
- [ ] Webhook URL de producción registrada en MP: `https://hospeda.com.ar/api/v1/webhooks/mercadopago`
- [ ] Comprar el plan más barato activo (~ARS $100) con tarjeta personal
- [ ] Verificar:
  - [ ] PlanPurchaseButton renderiza en producción
  - [ ] MP checkout abre con preference real
  - [ ] Pago aprobado con tarjeta real
  - [ ] Firma HMAC validada (revisar logs Sentry, sin errores)
  - [ ] `providerEventId` almacenado en `billing_webhook_events`
  - [ ] Subscription activada en DB
  - [ ] Email de confirmación enviado o registrado
  - [ ] Página `/suscriptores/checkout/success` renderiza
- [ ] Hacer refund manual desde el dashboard de MP para recuperar los fondos
- [ ] Documentar el procedure de rollback si webhook falla en producción

### 4. Schema gaps menores que afectan datos

#### `location.city` no está en BaseLocationSchema

El form escribe en `location.city` pero el schema usa `BaseLocationSchema` que
solo tiene `country`. El campo se persiste pero puede caer silenciosamente.

- [ ] Decidir: cambiar `accommodation.schema.ts` a `FullLocationFields` (incluye city, state, postal) o aceptar que solo se guarda country
- [ ] Si se acepta: ocultar campos vacíos en el form
- [ ] Si se cambia: regenerar tipos y validar que migrate no rompa data existente

#### `amenityIds` no está en `AccommodationCreateInput`

Es relación join-table. El form lo envía como campo extra en el payload de
publish. La API puede rechazarlo o ignorarlo.

- [ ] Verificar comportamiento real: ¿API guarda los amenities? ¿En qué tabla?
- [ ] Si no se persisten: extender el endpoint para aceptar el array y crear las relaciones, o crear endpoint separado `POST /accommodations/{id}/amenities`
- [ ] Test de regresión: crear accommodation con 3 amenities, verificar que aparecen al hacer GET

### 5. Pricing page hardcoded vs billing config

Los precios en `/suscriptores/planes` y `/suscriptores/turistas` están hardcoded
en el `.astro` (4990, 9990, 1990, 3990) y NO coinciden con `plans.config.ts`
(que usa centavos: 3500000, 7500000).

- [ ] Decidir fuente de verdad: hardcoded en página o billing config
- [ ] Si billing config: fetch server-side de planes activos, mapear a las cards
- [ ] Si hardcoded: documentar como valores manuales y que deben actualizarse cuando cambien los planes
- [ ] Evitar que un cliente vea ARS $4.990 y termine pagando ARS $35.000 (riesgo legal)

---

## P1 — Importantes pero no bloqueantes (post-beta primer semana)

### 6. Leaflet map para sección ubicación

Hoy la sección de ubicación tiene inputs manuales de lat/lng con placeholder
"Mapa disponible próximamente".

- [ ] Instalar `leaflet` y `@types/leaflet` en `apps/web`
- [ ] Implementar map con dynamic import en `PropertyFormBasicSections.client.tsx`
- [ ] Pin draggable que actualice los inputs lat/lng
- [ ] Compact 200px height en mobile con toggle expandir
- [ ] Test integration: drag pin → valores en form actualizan

### 7. Pre-existing typecheck errors en apps/api

`apps/api` tiene errores de typecheck pre-existentes (no introducidos por SPEC-091):

- `apps/api/src/routes/accommodation/public/getBySlug.ts`
- `apps/api/src/routes/accommodation/public/similar.ts`
- `apps/api/src/auth/status.ts`
- Varios test files (cron, schema-validation)

- [ ] Auditar cada error
- [ ] Crear tickets de remediation o resolverlos en una pasada
- [ ] No bloquea SPEC-091 pero impide CI estricto

### 8. Pre-existing typecheck error en service-core

`packages/service-core/test/base/crud/getById.test.ts:379` tiene un error
pre-existente con `DrizzleClient | undefined`.

- [ ] Fix mínimo (probable: cast o non-null assertion)
- [ ] Verificar que el test sigue verificando lo correcto

### 9. SPEC-049 admin filtering — 5 tasks restantes

Filter UIs incompletas en 11 entidades CMS. Para beta no es bloqueante porque
los admins tienen búsqueda básica, pero impacta productividad.

- [ ] T-027 + T-029: tests de count/list con OR logic
- [ ] T-067: JSDoc en review rating
- [ ] T-068: schema tests faltantes (`service-error-code`, `tag/admin-search`, `accommodation-review/admin-search`)

### 10. SPEC-044 addon purchase schema cleanup

Una migración pendiente de aplicar.

- [ ] Aplicar la migración pendiente
- [ ] Verificar que no rompe queries existentes en producción

---

## P2 — Hardening recomendado (segundo sprint post-beta)

### 11. SPEC-042 CSP hardening

27 gaps abiertos. Para beta beta el riesgo XSS está presente pero acotado
(no aceptamos inputs de extraños hasta que la beta lo abra).

- [ ] Scope CSP a `/docs` (eliminar `unsafe-inline` ahí)
- [ ] Remover `onclick` inline en componentes legacy
- [ ] Verificar dominios MP/Sentry/Cloudinary en `script-src` y `connect-src`

### 12. SPEC-034 ISR revalidation

28 gaps. ISR funciona pero hay casos edge donde el contenido queda stale más
tiempo del esperado.

- [ ] Triggers manuales por entity/type
- [ ] Debounce en revalidation cascada
- [ ] Cron job para revalidación periódica de pages críticas

### 13. SPEC-040 critical package coverage

35 tasks. auth-ui, billing, logger, email tienen 0 tests.

- [ ] Priorizar billing y auth-ui (≥80% coverage)
- [ ] logger y email (≥70% coverage)

### 14. SPEC-041 admin integration tests

29 tasks. 0 tests de integración en admin.

- [ ] Smoke tests de las 40+ páginas admin (MSW + fixtures)
- [ ] Confianza para refactors

---

## Definition of Done para beta

Beta se abre cuando:

1. Todos los items P0 están con check
2. Mínimo 5 propietarios reales completaron host onboarding sin asistencia
3. Mínimo 1 transacción real procesada con éxito (incluido refund)
4. 0 incidentes críticos en Sentry durante 48h de QA con tráfico interno
5. Documentado el rollback procedure por si webhook falla en prod

## Owner

Qazuor — single decision-maker para abrir beta.

## Última actualización

2026-04-25
