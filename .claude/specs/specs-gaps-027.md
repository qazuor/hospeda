# SPEC-027: Webhook Subscription Sync - Gap Analysis Report v4

**Date**: 2026-03-07
**Analyzed by**: Tech Lead (exhaustive consolidation) + 6 specialist agents (Backend/Tech Lead, DB/Schema, Notifications/TS, Frontend/React, QA, Hono/Wiring)
**Spec Status**: approved | **Implementation Status**: marked as COMPLETED
**Task State**: 20/20 tasks completed
**Analysis method**: Exhaustive line-by-line comparison of all 26 spec sections against actual implementation + 6 deep agent audits
**Audit pass**: v4 (builds on v3: confirms 23 existing gaps, discovers 7 new gaps G-024 to G-030, closes G-017)

---

## Executive Summary

La implementacion core de SPEC-027 es **solida y de alta calidad**. La logica principal (`subscription-logic.ts`), el handler, el retry job, las notificaciones, los templates, el esquema DB, la ruta admin, y el frontend estan bien implementados y siguen la spec con alta fidelidad.

La auditoria v4 incorpora hallazgos de **6 agentes especializados** (2 mas que v3). Confirma los gaps validos de v3, **cierra G-017** (confirmado que `showUnsubscribe={false}` SI esta presente en paused.tsx linea 27), y descubre **7 gaps adicionales** (G-024 a G-030).

**Totales**: 30 gaps (1 critico, 7 altos, 7 medios, 10 bajos, 5 info/cerrados)

---

## Gap Index

| # | Titulo | Severidad | Prioridad | Complejidad | Tipo | Estado | Auditoria |
|---|--------|-----------|-----------|-------------|------|--------|-----------|
| G-001 | Test de webhook-retry contradice la nueva logica | CRITICA | P0 | 2/10 | Bug en test | ABIERTO | v1 |
| G-002 | Faltan tests para subscription-handler.ts | ALTA | P1 | 3/10 | Test faltante | ABIERTO | v1 |
| G-003 | Faltan tests para admin API route (subscription-events.ts) | ALTA | P1 | 3/10 | Test faltante | ABIERTO | v1 |
| G-004 | Faltan tests de integracion end-to-end del flujo webhook | ALTA | P1 | 5/10 | Test faltante | ABIERTO | v1 |
| G-005 | Migracion DB no aplicada | MEDIA | P1 | 1/10 | Infraestructura | ABIERTO | v1 |
| G-006 | Subject patterns difieren de la spec | BAJA | P3 | 1/10 | Discrepancia menor | ABIERTO | v1 |
| G-007 | Status `paused` usa variant `secondary` en vez de `outline` | BAJA | P3 | 1/10 | Discrepancia menor | ABIERTO | v1 |
| G-008 | Falta i18n key `eventId` para ID de evento MercadoPago | BAJA | P3 | 1/10 | i18n incompleto | ABIERTO | v1 |
| G-009 | Falta key i18n `showing` para paginacion del historial | BAJA | P3 | 1/10 | Discrepancia menor | CERRADO (no aplica) | v1 |
| G-010 | Env var `ADMIN_NOTIFICATION_EMAILS` vs `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` | INFO | P4 | 0/10 | Discrepancia spec vs codigo | CERRADO (codigo correcto) | v1 |
| G-011 | No hay test de componente para SubscriptionDetailsDialog | MEDIA | P2 | 4/10 | Test faltante | ABIERTO | v2 |
| G-012 | Test subscription-logic.test.ts solo cubre helpers, NO processSubscriptionUpdated | ALTA | P1 | 5/10 | Test insuficiente | ABIERTO | v2 |
| G-013 | Admin route subscription-events no valida existencia de subscripcion | BAJA | P3 | 2/10 | Gap funcional | CERRADO (by design) | v2 |
| G-014 | i18n key `transition` dice "Transicion" pero spec dice "Cambio de estado" | BAJA | P3 | 1/10 | Discrepancia i18n | ABIERTO | v2 |
| G-015 | Template paused.tsx muestra `Estado: Pausada` que no esta en la spec | MEDIA | P3 | 1/10 | Funcionalidad extra | ABIERTO | v2 |
| G-016 | `sendNotification` no awaited dentro de notification functions (serverless risk) | ALTA | P1 | 2/10 | Confiabilidad | ABIERTO | v3 |
| G-017 | Template paused.tsx falta `showUnsubscribe={false}` | ~~MEDIA~~ | ~~P2~~ | ~~1/10~~ | ~~Bug template~~ | **CERRADO (falso positivo)** | v3->v4 |
| G-018 | Falta `Sentry.captureException` cuando `retrieve()` falla | MEDIA | P2 | 1/10 | Observabilidad | ABIERTO | v3 |
| G-019 | `metadata` column no tiene `.notNull()` en DB schema | MEDIA | P2 | 1/10 | Schema discrepancia | ABIERTO | v3 |
| G-020 | `created_at` index sin DESC en DB schema | BAJA | P3 | 1/10 | Schema discrepancia | ABIERTO | v3 |
| G-021 | Admin route schema en archivo local en vez de `@repo/schemas` | BAJA | P3 | 2/10 | Violacion SSoT | ABIERTO | v3 |
| G-022 | `providerEventId` hardcoded como "MP Event:" sin i18n | BAJA | P3 | 1/10 | i18n faltante | ABIERTO | v3 |
| G-023 | Timeline badges muestran raw status sin `getStatusLabel()` | BAJA | P3 | 1/10 | UX inconsistencia | ABIERTO | v3 |
| G-024 | Subject de PAUSED incluye `{planName}` cuando spec dice subject estatico | MEDIA | P2 | 1/10 | Discrepancia spec | **NUEVO v4** |
| G-025 | Timeline usa `toLocaleString()` en vez de `formatDate()` | BAJA | P3 | 1/10 | UX inconsistencia | **NUEVO v4** |
| G-026 | Tildes faltantes en i18n keys de PT (tabs.history, history.title, emptyState) | BAJA | P3 | 1/10 | i18n calidad | **NUEVO v4** |
| G-027 | `shouldSendAdminAlert` exportada pero nunca invocada directamente | BAJA | P3 | 1/10 | Code smell | **NUEVO v4** |
| G-028 | `processSubscriptionUpdated` nunca retorna `success: false` (contrato roto) | MEDIA | P3 | 2/10 | Type safety | **NUEVO v4** |
| G-029 | Doble validacion Zod en admin route handler | BAJA | P3 | 1/10 | Code quality | **NUEVO v4** |
| G-030 | Tests de templates no verifican `showUnsubscribe={false}` | MEDIA | P2 | 1/10 | Test gap | **NUEVO v4** |

---

## Detailed Gap Analysis

---

### G-001: Test de webhook-retry contradice la nueva logica

**Severidad**: CRITICA | **Prioridad**: P0 | **Complejidad**: 2/10 | **Auditoria**: v1, confirmado v4 (QA + Tech Lead)

**Descripcion**:
El archivo `apps/api/test/cron/webhook-retry.job.test.ts` (linea 343) contiene un test:

```
"should resolve subscription_preapproval.updated events without business logic"
```

Este test **aserta que NO se ejecuta logica de negocio** para eventos `subscription_preapproval.updated`. La implementacion de SPEC-027 **cambio exactamente eso**: ahora estos eventos SI ejecutan `retrySubscriptionUpdated()` con logica completa.

El test pasa actualmente porque los mocks no estan configurados para la nueva logica, pero la **asercion es conceptualmente incorrecta** y da falsa seguridad.

**Verificacion v4 (QA Agent)**: Confirmado. Test 5 (linea 343-361) verifica `extractPaymentInfo` no se llamo, pero no verifica que `processSubscriptionUpdated` SI se llame. Cero mocks de la nueva logica.

**Solucion propuesta**:
1. Reescribir el test para validar que `subscription_preapproval.updated` ahora SI ejecuta logica de negocio
2. Agregar test que verifique que `payment.created` sigue auto-resolviendo
3. Agregar test para billing no configurado y adapter falla

**Recomendacion**: Solucion directa inmediata. No requiere spec nueva.

---

### G-002: Faltan tests para subscription-handler.ts

**Severidad**: ALTA | **Prioridad**: P1 | **Complejidad**: 3/10 | **Auditoria**: v1, confirmado v4 (QA)

**Descripcion**: El archivo `apps/api/test/webhooks/subscription-handler.test.ts` **no existe**. La spec Section 15 define 5 test cases.

**Verificacion v4**: Confirmado. 0/5 casos cubiertos (0%).

**Solucion propuesta**: Crear el archivo con 5 tests (handler wiring, marks processed, error propagation, null deps, source='webhook').

**Recomendacion**: Solucion directa.

---

### G-003: Faltan tests para admin API route (subscription-events.ts)

**Severidad**: ALTA | **Prioridad**: P1 | **Complejidad**: 3/10 | **Auditoria**: v1, confirmado v4 (QA)

**Descripcion**: Cero tests para el endpoint admin `GET /api/v1/admin/billing/subscriptions/:id/events`.

**Solucion propuesta**: Crear test file con 5-7 tests (paginacion, orden DESC, respuesta vacia, validacion UUID, auth).

**Recomendacion**: Solucion directa.

---

### G-004: Faltan tests de integracion end-to-end del flujo webhook

**Severidad**: ALTA | **Prioridad**: P1 | **Complejidad**: 5/10 | **Auditoria**: v1, confirmado v4 (QA)

**Descripcion**: La spec Section 15 define 4 tests de integracion. Ninguno existe.

**Solucion propuesta**: Agregar tests de integracion con mocking selectivo.

**Recomendacion**: Solucion directa si los tests de integracion pre-existentes estan resueltos.

---

### G-005: Migracion DB no aplicada

**Severidad**: MEDIA | **Prioridad**: P1 | **Complejidad**: 1/10 | **Auditoria**: v1, confirmado v4 (DB Agent)

**Descripcion**: `packages/db/src/migrations/0018_perfect_the_fallen.sql` existe pero no se ejecuto. La tabla `billing_subscription_events` no existe en la DB.

**Nota v4**: Antes de aplicar, corregir G-019 y G-020 en el schema Drizzle y regenerar la migracion.

**Solucion propuesta**: Corregir schema -> regenerar migracion -> `pnpm db:migrate`.

**Recomendacion**: Solucion directa al momento de deploy.

---

### G-006: Subject patterns difieren de la spec

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v1, confirmado v4 (Notifications Agent)

**Descripcion**:
La spec define subjects como `"...cancelada - {planName}"`. La implementacion (subject-builder.ts:22-24) usa `"...{planName} ha sido cancelada"`. El `{planName}` esta en medio de la frase.

**Nota v4**: Ademas, hay inconsistencia de tildes: subjects usan `suscripción` (con tilde) pero los templates usan `suscripcion` (sin tilde).

**Impacto**: Funcional: ninguno. Los subjects actuales son mas naturales gramaticalmente.

**Solucion propuesta**: Mantener la implementacion actual. Unificar tildes (usar o no usar consistentemente).

**Recomendacion**: No requiere spec nueva. Decision de estilo.

---

### G-007: Status `paused` usa variant `secondary` en vez de `outline`

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v1, confirmado v4 (React Agent)

**Descripcion**: Spec Section 24 dice `outline`. Implementacion `utils.ts:41` usa `secondary`.

**Recomendacion**: Decision de diseno. Mantener `secondary` si se prefiere la diferenciacion visual.

---

### G-008: Falta i18n key `eventId` para ID de evento MercadoPago

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v1, confirmado v4 (React Agent)

**Descripcion**: La key `history.columns.eventId` no existe en ninguno de los 3 archivos i18n. El componente usa "MP Event:" hardcodeado (ver G-022).

**Solucion propuesta**: Agregar la key a los 3 locales y referenciarla en el componente.

**Recomendacion**: Resolver junto con G-022.

---

### G-009: Falta key i18n `showing` para paginacion del historial

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Estado**: CERRADO

**Descripcion**: El formato actual (`eventsPage / totalPages`) es compacto y aceptable. La key `showing` con formato `{from}-{to} de {total}` no fue implementada.

**Recomendacion**: No requiere accion.

---

### G-010: Env var `ADMIN_NOTIFICATION_EMAILS` vs `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`

**Severidad**: INFO | **Prioridad**: P4 | **Complejidad**: 0/10 | **Estado**: CERRADO

**Verificacion v4 (Hono Agent, Tech Lead Agent)**: Confirmado correcto. `notifications.ts` lineas 170 y 268 usan `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS`. El spec de referencia tiene el nombre incorrecto, no la implementacion.

---

### G-011: No hay test de componente para SubscriptionDetailsDialog

**Severidad**: MEDIA | **Prioridad**: P2 | **Complejidad**: 4/10 | **Auditoria**: v2

**Descripcion**: La spec menciona "component test for the timeline UI". No existe.

**Recomendacion**: Puede resolverse directo o incluirse en SPEC-022.

---

### G-012: Test subscription-logic.test.ts solo cubre helpers, NO processSubscriptionUpdated

**Severidad**: ALTA | **Prioridad**: P1 | **Complejidad**: 5/10 | **Auditoria**: v2, confirmado v4 (QA Agent - conteo exacto)

**Descripcion**: El archivo tiene 31 tests que cubren:
- `QZPAY_TO_HOSPEDA_STATUS` constant map (7 tests)
- `shouldSendReactivationEmail` (7 tests)
- `shouldSendPausedEmail` (4 tests)
- `shouldSendCancelledEmail` (5 tests)
- `shouldSendAdminAlert` (3 tests + 5 extras)

**CERO tests de `processSubscriptionUpdated()`**. Los 22 test cases de la spec Section 15 para la funcion principal estan **TODOS AUSENTES**.

**Cobertura estimada**: ~15% (solo helpers). La funcion principal de ~200 lineas y 10 pasos no tiene ningun test.

**Solucion propuesta**: Agregar tests para `processSubscriptionUpdated()` con el mocking strategy de la spec Section 15. Minimo 10-15 tests.

**Recomendacion**: Solucion directa URGENTE. Mayor deuda de testing de toda la SPEC-027.

---

### G-013: Admin route subscription-events no valida existencia de subscripcion

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 2/10 | **Estado**: CERRADO (by design)

**Descripcion**: El endpoint retorna 200 con data vacio para UUIDs inexistentes. Es correcto segun la spec Section 8.

---

### G-014: i18n key `transition` dice "Transicion" pero spec dice "Cambio de estado"

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v2, confirmado v4 (React Agent)

**Verificacion v4**: `es/admin-billing.json` linea 956 tiene `"Transicion"` (sin tilde). Spec dice `"Cambio de estado"`.

**Solucion propuesta**: Cambiar a `"Cambio de estado"` o al menos agregar tilde: `"Transición"`.

---

### G-015: Templates paused y reactivated muestran campos extra no especificados

**Severidad**: MEDIA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v2

**Descripcion**: Los templates agregan `<InfoRow label="Estado" value="Pausada/Activa" />` que la spec no define.

**Recomendacion**: Mantener. Los campos extra son informativos y utiles. Actualizar spec.

---

### G-016: `sendNotification` no awaited dentro de notification functions (serverless risk)

**Severidad**: ALTA | **Prioridad**: P1 | **Complejidad**: 2/10 | **Auditoria**: v3, confirmado v4 (Hono Agent - analisis detallado)

**Verificacion v4 (Hono Agent)**:
Las 3 funciones de suscripcion (`sendSubscriptionCancelledNotification`, `sendSubscriptionPausedNotification`, `sendSubscriptionReactivatedNotification`) NO hacen `await` de `sendNotification()`. Son fire-and-forget puro con `.catch()`.

Ademas, en `processSubscriptionUpdated()` (subscription-logic.ts:344-380), las llamadas a estas funciones tambien son fire-and-forget con `.catch()`.

**Dato adicional v4**: Las funciones de pago existentes (`sendPaymentSuccessNotification`, `sendPaymentFailureNotifications`) SI usan `await`. Hay una inconsistencia de patron dentro del mismo archivo `notifications.ts`.

**Impacto en serverless**: En Vercel, la funcion puede terminar antes de enviar las notificaciones. Las de pago (con await) son mas seguras que las de suscripcion (sin await).

**Solucion propuesta**: Usar `await` con try/catch en las 3 funciones de notificacion de suscripcion (tanto dentro de las funciones como en las llamadas desde processSubscriptionUpdated).

**Recomendacion**: Solucion directa. Fix trivial y critico para produccion.

---

### G-017: Template paused.tsx falta `showUnsubscribe={false}`

**Severidad**: ~~MEDIA~~ | **Prioridad**: ~~P2~~ | **Estado**: **CERRADO (falso positivo)**

**Verificacion v4 (Notifications Agent)**: El template `subscription-paused.tsx` linea 27 **SI tiene** `showUnsubscribe={false}`. La alerta v3 era incorrecta. Los 3 templates tienen el flag correctamente.

---

### G-018: Falta `Sentry.captureException` cuando `retrieve()` falla

**Severidad**: MEDIA | **Prioridad**: P2 | **Complejidad**: 1/10 | **Auditoria**: v3, confirmado v4 (Tech Lead Agent)

**Verificacion v4**: En `processSubscriptionUpdated()`, cuando `retrieve()` falla, el error se logea y se re-lanza (propaga), pero NO se captura en Sentry antes del throw.

**Nota**: El spec Section 7 item "MercadoPago API call fails" dice "the error is captured in Sentry". Sin embargo, `Sentry.captureException` SI se usa para status desconocidos (linea ~234). Solo falta para el caso de `retrieve()` failure.

**Solucion propuesta**: Agregar `Sentry.captureException(error, { extra: { subscriptionId, source } })` antes del `throw`.

---

### G-019: `metadata` column no tiene `.notNull()` en DB schema

**Severidad**: MEDIA | **Prioridad**: P2 | **Complejidad**: 1/10 | **Auditoria**: v3, confirmado v4 (DB Agent)

**Verificacion v4 (DB Agent)**:
- `billing_subscription_event.dbschema.ts` linea 19: `metadata: jsonb('metadata').$type<Record<string, unknown>>().default({})`
- Falta `.notNull()`
- La migracion SQL (linea 8) hereda el defecto: `"metadata" jsonb DEFAULT '{}'::jsonb` (sin NOT NULL)
- Ademas, el schema local `apps/api/src/schemas/subscription-events.schema.ts` define metadata como `.nullable()`, lo cual contradice la spec que dice NOT NULL

**Impacto type-safety**: Sin `.notNull()`, Drizzle infiere `Record<string, unknown> | null`, introduciendo null en la capa TypeScript.

**Solucion propuesta**: Agregar `.notNull()` al schema Drizzle. Si la migracion no se aplico (G-005), regenerar. El schema local tambien debe cambiar `.nullable()` a `.default({})`.

---

### G-020: `created_at` index sin DESC en DB schema

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v3, confirmado v4 (DB Agent)

**Verificacion v4**: Schema linea 26-28 no especifica `.desc()`. Migracion SQL linea 14 genera index ASC.

**Solucion propuesta**: Agregar `.desc()` al index. Resolver junto con G-005/G-019.

---

### G-021: Admin route schema en archivo local en vez de `@repo/schemas`

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 2/10 | **Auditoria**: v3, confirmado v4 (DB Agent + Tech Lead Agent)

**Verificacion v4 (DB Agent - analisis detallado de duplicacion)**:
Existe duplicacion con diferencias de contrato entre:
- `@repo/schemas` (`packages/schemas/src/api/billing/subscription-event.schema.ts`): usa `.max(50)`, `.positive()`, `.nonnegative()`, `.default({})`
- `apps/api/src/schemas/subscription-events.schema.ts`: sin `.max()`, sin `.positive()`, `metadata` es `.nullable()` (contradice spec)

Los schemas locales (`SubscriptionEventsParamSchema`, `ListSubscriptionEventsQuerySchema`) son aceptables en la capa de routing. Pero `SubscriptionEventResponseSchema` y `SubscriptionEventsListResponseSchema` duplican los de `@repo/schemas` con diferencias.

**Solucion propuesta**: Eliminar los schemas duplicados del archivo local. Importar desde `@repo/schemas`. Mantener solo los schemas de routing (param + query).

---

### G-022: `providerEventId` hardcoded como "MP Event:" sin i18n

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v3, confirmado v4 (React Agent)

**Verificacion v4**: `SubscriptionDetailsDialog.tsx` linea 434: `MP Event: {event.providerEventId}`. String en ingles hardcodeado en UI mayoritariamente en espanol.

**Solucion propuesta**: Resolver junto con G-008.

---

### G-023: Timeline badges muestran raw status sin `getStatusLabel()`

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10 | **Auditoria**: v3, confirmado v4 (React Agent)

**Verificacion v4**: `SubscriptionDetailsDialog.tsx` lineas 410 y 418: `{event.previousStatus}` y `{event.newStatus}` muestran strings crudos (`active`, `cancelled`) en vez de labels traducidos (`Activa`, `Cancelada`).

**Solucion propuesta**: Usar `getStatusLabel(event.previousStatus as SubscriptionStatus, t)` y similar para `newStatus`.

---

### G-024: Subject de PAUSED incluye `{planName}` cuando spec dice subject estatico [NUEVO v4]

**Severidad**: MEDIA | **Prioridad**: P2 | **Complejidad**: 1/10
**Fuente**: Notifications Agent

**Descripcion**:
La spec Section 3 y 9.3 define el subject de paused como:
```
"Tu suscripcion ha sido pausada - Accion requerida"
```
Es un subject **estatico** sin variable `{planName}`.

La implementacion (subject-builder.ts linea 23) usa:
```
"Tu suscripción {planName} ha sido pausada"
```
Incluye `{planName}` y NO incluye "Accion requerida".

**Impacto**: El subject de paused deberia transmitir urgencia con "Accion requerida". Al incluir `{planName}` y omitir la urgencia, el email puede parecer informativo en vez de requerir accion.

**Solucion propuesta**:
**Opcion A**: Cambiar a `"Tu suscripción ha sido pausada - Acción requerida"` (sin planName, con urgencia)
**Opcion B (recomendada)**: Cambiar a `"Tu suscripción {planName} ha sido pausada - Acción requerida"` (mantener planName, agregar urgencia)

**Recomendacion**: Solucion directa. Decision de UX sobre inclusion de planName.

---

### G-025: Timeline usa `toLocaleString()` en vez de `formatDate()` [NUEVO v4]

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10
**Fuente**: React Agent

**Descripcion**:
En `SubscriptionDetailsDialog.tsx` linea 423:
```tsx
{new Date(event.createdAt).toLocaleString()}
```

El resto del componente y la app usa `formatDate(date, locale)` de `./utils` que aplica formato consistente con locale `es-AR`. Aqui se usa `toLocaleString()` sin locale, lo que produce formatos inconsistentes dependiendo del browser del admin.

**Solucion propuesta**: Reemplazar con `formatDate(event.createdAt)`.

**Recomendacion**: Solucion directa trivial.

---

### G-026: Tildes faltantes en i18n keys de PT [NUEVO v4]

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10
**Fuente**: React Agent

**Descripcion**:
En `packages/i18n/src/locales/pt/admin-billing.json`:
- Linea 948: `tabs.history` = `"Historico"` (falta tilde: deberia ser `"Histórico"`)
- Linea 951: `history.title` = `"Historico de alteracoes"` (faltan tildes: `"Histórico de alterações"`)
- Linea 952: `history.emptyState` = `"Nenhuma alteracao registrada..."` (falta tilde: `"alteração"`)

Tambien en ES:
- Linea 953: `history.emptyState` dice `"suscripcion"` sin tilde (deberia ser `"suscripción"`)

**Solucion propuesta**: Corregir las tildes en los 2 archivos.

**Recomendacion**: Solucion directa trivial.

---

### G-027: `shouldSendAdminAlert` exportada pero nunca invocada directamente [NUEVO v4]

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10
**Fuente**: Tech Lead Agent

**Descripcion**:
La funcion `shouldSendAdminAlert()` en `subscription-logic.ts` esta exportada y tiene tests, pero **nunca se invoca directamente** en `processSubscriptionUpdated()`. El admin alert se envia implicitamente dentro de `sendSubscriptionCancelledNotification()` (que siempre envia user notification + admin alert cuando es invocada).

Esto funciona correctamente hoy porque `shouldSendCancelledEmail()` y `shouldSendAdminAlert()` tienen **exactamente la misma logica**. Pero si en el futuro las condiciones divergen, el admin alert no se enviaria independientemente.

**Solucion propuesta**:
**Opcion A (recomendada)**: Documentar como "by design" ya que ambas funciones son identicas hoy.
**Opcion B**: Invocar `shouldSendAdminAlert()` explicitamente y pasar un flag a `sendSubscriptionCancelledNotification()` para controlar si envia admin alert.

**Recomendacion**: No requiere accion inmediata. Documentar el acoplamiento. Los tests existentes de `shouldSendAdminAlert` sirven como documentacion de la regla de negocio.

---

### G-028: `processSubscriptionUpdated` nunca retorna `success: false` (contrato roto) [NUEVO v4]

**Severidad**: MEDIA | **Prioridad**: P3 | **Complejidad**: 2/10
**Fuente**: Hono Agent

**Descripcion**:
La interfaz `ProcessSubscriptionUpdatedResult` declara `success: boolean`, pero en la practica la funcion:
- Retorna `{ success: true, statusChanged: false }` para todos los no-op paths
- Retorna `{ success: true, statusChanged: true }` para el path exitoso
- **Nunca retorna `{ success: false }`** - los errores se lanzan con `throw`

El check `if (result.success)` en `subscription-handler.ts` linea 42 **nunca sera false**. Es dead code.

**Impacto**: Bajo hoy. Si en el futuro alguien agrega un path que retorne `success: false`, esperaria que el evento no se marque como procesado. Ese path funcionaria correctamente gracias al `if`. Pero la falta de tests para ese caso crea riesgo.

**Solucion propuesta**:
**Opcion A (recomendada)**: Simplificar - cambiar el retorno a `void` y usar solo `throw` para errores. Eliminar el campo `success`.
**Opcion B**: Mantener como esta (defensive programming para un futuro path de error no-throwing).

**Recomendacion**: No urgente. Puede resolverse en un refactor.

---

### G-029: Doble validacion Zod en admin route handler [NUEVO v4]

**Severidad**: BAJA | **Prioridad**: P3 | **Complejidad**: 1/10
**Fuente**: Tech Lead Agent

**Descripcion**:
En `subscription-events.ts` lineas 52-56, el handler parsea params y query con Zod manualmente:
```typescript
const { id: subscriptionId } = subscriptionIdParamSchema.parse(params);
const { page, pageSize } = ListSubscriptionEventsQuerySchema.parse({...});
```

Pero `createAdminRoute` ya valida `requestParams` y `requestQuery` antes de llamar al handler (via OpenAPI middleware). Los params/query ya llegan validados al handler.

**Impacto**: Performance despreciable (doble parse). Pero si la segunda validacion falla, lanza `ZodError` sin capturar que no pasa por el `HTTPException(500)` del catch.

**Solucion propuesta**: Eliminar los `.parse()` manuales y confiar en la validacion del factory. Castear los params directamente.

**Recomendacion**: Solucion directa en un cleanup pass.

---

### G-030: Tests de templates no verifican `showUnsubscribe={false}` [NUEVO v4]

**Severidad**: MEDIA | **Prioridad**: P2 | **Complejidad**: 1/10
**Fuente**: Notifications Agent + QA Agent

**Descripcion**:
Los 23 tests en `packages/notifications/test/templates/subscription-templates.test.tsx` cubren rendering, texto en espanol, CTA links, y campos opcionales. Pero **ningun test verifica** que `showUnsubscribe={false}` esta presente o que el link de unsubscribe NO aparece en el HTML.

**Impacto**: Si alguien cambia el template y quita `showUnsubscribe={false}`, los tests no lo detectarian. Los emails transaccionales mostrarian un link de unsubscribe incorrecto.

**Solucion propuesta**: Agregar un test por template que verifique que el HTML renderizado NO contiene un link de unsubscribe.

**Recomendacion**: Solucion directa trivial. 3 tests adicionales.

---

## Gaps NOT Found (Verification of Correct Implementation)

### Verificacion 1: Admin route usa `createAdminRoute` con `BILLING_READ_ALL` (CORRECTO)

La implementacion (subscription-events.ts:126-138) usa `createAdminRoute` con `requiredPermissions`. Esto es **mejor** que lo que la spec sugeria (simple `createRouter()` + `zValidator()`). La implementacion usa la factory correcta con permisos, OpenAPI, y auth automatica.

### Verificacion 2: `createResponse()` envuelve con `success: true` (CORRECTO)

`createAdminRoute` -> `createCRUDRoute` -> llama `createResponse(result, ctx, 200)` de `response-helpers.ts:70-80` que automaticamente envuelve el resultado del handler en `{ success: true, data: <handler result>, metadata: { timestamp, requestId } }`. El frontend accede `result.data.data` y `result.data.pagination` correctamente.

### Verificacion 3: Notification functions usan `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS` (CORRECTO)

notifications.ts lineas 170 y 268 usan el prefijo correcto. Confirmado por 3 agentes.

### Verificacion 4: Template paused.tsx tiene `showUnsubscribe={false}` (CORRECTO)

Linea 27: confirmado. G-017 era falso positivo, cerrado.

### Verificacion 5: DB schema file naming sigue patron singular (CORRECTO)

`billing_subscription_event.dbschema.ts` (singular).

### Verificacion 6: Barrel exports correctos (CORRECTO)

Todos los barrel exports verificados: DB, schemas, notifications templates, admin routes.

### Verificacion 7: Retry job split correcto (CORRECTO)

webhook-retry.job.ts: `payment.created` y `subscription_preapproval.updated` en cases separados. Confirmado.

### Verificacion 8: Status mapping completo (CORRECTO)

`QZPAY_TO_HOSPEDA_STATUS` cubre: active, paused, canceled->cancelled(2L), finished->expired, pending->null.

### Verificacion 9: Notification transition rules correctas (CORRECTO)

Todas las funciones `shouldSend*` implementan exactamente las reglas de la spec Section 6.

### Verificacion 10: cancel_at_period_end reset en reactivacion (CORRECTO)

subscription-logic.ts: resetea `cancelAtPeriodEnd` cuando `ACTIVE` y era `true`.

### Verificacion 11: canceled_at solo se setea si no existe (CORRECTO)

subscription-logic.ts: `!localSubscription.canceledAt` previene sobreescritura.

### Verificacion 12: getWebhookDependencies return type (CORRECTO)

utils.ts:240-260: retorna `{ billing, paymentAdapter }` o `null`. `billing` usa `NonNullable<>`.

### Verificacion 13: markEventProcessedByProviderId llamada correcta (CORRECTO)

subscription-handler.ts: llamada con `{ providerEventId: String(event.id) }` en ambos puntos (null deps y success).

---

## Summary of Required Actions

### Accion Inmediata (P0)

| Gap | Accion | Esfuerzo |
|-----|--------|----------|
| G-001 | Reescribir test de webhook-retry para subscription_preapproval.updated | 1-2h |

### Antes de Deploy (P1)

| Gap | Accion | Esfuerzo |
|-----|--------|----------|
| G-012 | **Crear tests para processSubscriptionUpdated() (10-15 tests)** | 4-6h |
| G-016 | **Await sendNotification en las 3 funciones de notificacion** | 30min |
| G-002 | Crear tests para subscription-handler.ts (4-5 tests) | 2-3h |
| G-003 | Crear tests para admin API route (5-7 tests) | 2-3h |
| G-004 | Crear tests de integracion (4 tests) | 3-5h |
| G-005 | Corregir schema (G-019, G-020) + regenerar migracion + aplicar | 30min |

### Pre-Deploy (P2)

| Gap | Accion | Esfuerzo |
|-----|--------|----------|
| G-018 | Agregar `Sentry.captureException` en retrieve() catch | 15min |
| G-019 | Agregar `.notNull()` a metadata en schema Drizzle | 5min (junto con G-005) |
| G-024 | Agregar "Accion requerida" al subject de PAUSED | 5min |
| G-030 | Agregar 3 tests de showUnsubscribe en templates | 30min |
| G-011 | Test de componente para SubscriptionDetailsDialog | 3-4h |

### Post-Deploy (P3)

| Gap | Accion | Esfuerzo |
|-----|--------|----------|
| G-006 | Decidir subject patterns (mantener o ajustar) + unificar tildes | 15min |
| G-007 | Decidir badge variant para paused | 5min |
| G-008 + G-022 | Agregar i18n key eventId + reemplazar "MP Event:" hardcoded | 30min |
| G-014 | Decidir label "Transicion" vs "Cambio de estado" | 5min |
| G-020 | Agregar `.desc()` al index de created_at | 5min (junto con G-005) |
| G-021 | Mover schemas locales a `@repo/schemas` | 1h |
| G-023 | Usar `getStatusLabel()` en timeline badges | 15min |
| G-025 | Reemplazar `toLocaleString()` con `formatDate()` | 5min |
| G-026 | Corregir tildes faltantes en PT y ES | 15min |
| G-027 | Documentar acoplamiento shouldSendAdminAlert | 5min |
| G-028 | Simplificar contrato de processSubscriptionUpdated | 30min |
| G-029 | Eliminar doble validacion Zod en admin route | 15min |

### No Requiere Accion

| Gap | Razon |
|-----|-------|
| G-009 | Formato de paginacion actual es aceptable |
| G-010 | Codigo correcto, solo actualizar spec |
| G-013 | By design, documentado en spec |
| G-015 | Mejora no especificada pero util, actualizar spec |
| G-017 | Falso positivo. Template SI tiene showUnsubscribe={false} |

---

## Testing Debt Summary

### Total: ~30-40 tests adicionales necesarios

| Area | Tests faltantes | Prioridad |
|------|----------------|-----------|
| `processSubscriptionUpdated()` | 10-15 tests (0/22 spec cases cubiertos) | P1 (mas critico) |
| `subscription-handler.ts` | 4-5 tests (archivo no existe) | P1 |
| Admin API route | 5-7 tests (archivo no existe) | P1 |
| Integracion E2E | 4 tests | P1 |
| webhook-retry reescritura | 3-4 tests (1 contradice logica) | P0 |
| SubscriptionDetailsDialog | 5 tests | P2 |
| Template showUnsubscribe | 3 tests | P2 |

### Total Code Fixes (non-test): ~15 cambios de codigo

| Area | Cambios | Prioridad |
|------|---------|-----------|
| Await notifications (G-016) | 3 funciones + 3 llamadas | P1 |
| DB schema fixes (G-019, G-020) + regen migration | 3 lineas + regen | P1/P2 |
| Sentry capture (G-018) | 1 linea | P2 |
| Subject PAUSED (G-024) | 1 linea | P2 |
| i18n keys (G-008, G-022) | 4 archivos | P3 |
| i18n tildes (G-026) | 2 archivos | P3 |
| Schema location (G-021) | 1 archivo mover | P3 |
| Timeline labels (G-023) | 2 lineas | P3 |
| Timeline date (G-025) | 1 linea | P3 |
| Double validation (G-029) | ~5 lineas | P3 |

---

## Recommendation

**No se requiere una SPEC formal nueva.** Todos los gaps son correcciones menores, fixes de confiabilidad, o tests faltantes que pueden resolverse directamente como tareas adicionales de SPEC-027 (reabrir) o como parte de SPEC-026 (Security Testing Gaps).

**Prioridad de solucion**:
1. **G-001 + G-012**: La combinacion de estos dos gaps es la mayor vulnerabilidad. El 80% del codigo de SPEC-027 (`processSubscriptionUpdated` + handler + retry wiring) **no tiene tests unitarios**. Los 31 tests existentes solo cubren funciones puras de decision (~50 lineas de 385).
2. **G-016**: Riesgo real de notificaciones perdidas en serverless. Fix trivial (cambiar fire-and-forget a await+try/catch).
3. **G-005 + G-019 + G-020**: Bloquea audit log y timeline admin. Resolver schema -> regenerar -> aplicar migracion.
4. **G-018**: Observabilidad. Sin Sentry capture, los errores de MercadoPago API no generan alertas.
5. **G-002 + G-003**: Completan la cobertura de wiring.
6. **G-024 + G-030**: Calidad de UX y tests de seguridad de templates.

**Impacto de la deuda de testing**: Si alguien modifica `processSubscriptionUpdated()`, no hay **ningun test** que detecte la regresion en el flujo principal. Solo los helpers puros estan cubiertos.

**Impacto de confiabilidad (G-016)**: En un deployment serverless (Vercel), las notificaciones fire-and-forget pueden perderse silenciosamente. Este es un bug latente que solo se manifiesta en produccion.
