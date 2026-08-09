# HOS-376: Proveedores — registro de uso del beneficio y valoraciones

Spec: [`spec.md`](../spec.md) · Linear: [HOS-376](https://linear.app/hospeda-beta/issue/HOS-376)

## Progreso: 26/70 tareas (37%)

**Complejidad promedio:** 2.4/3 (máximo por tarea: 3)
**Profundidad del grafo:** 14 niveles
**Arranques paralelos:** 6 tareas sin dependencias

> Generado desde `state.json`. No editar a mano: regenerar si cambian las tareas.

---

## Fase `setup` — 13/13 completadas (complejidad promedio 1.9)

- [x] **T-001** (c2) — Crear los 3 enums de uso del beneficio en @repo/schemas
  - Crear packages/schemas/src/enums/host-trade-usage-status.{enum,schema}.ts (PENDING|CONFIRMED|REJECTED|EXPIRED), host-trade-usage-declared-by.{enum,schema}.ts (PROVIDER|HOST) y host-trade-usa…
  - Bloqueada por: — · Bloquea a: T-006, T-007, T-014, T-015
- [x] **T-002** (c1) — Agregar los 5 permisos nuevos a PermissionEnum
  - En packages/schemas/src/enums/permission.enum.ts, junto al bloque HOST_TRADE_* existente (líneas ~943-950): HOST_TRADE_REVIEW_CREATE ('hostTrade.review.create'), HOST_TRADE_REVIEW_VIEW_ALL (…
  - Bloqueada por: — · Bloquea a: T-003
- [x] **T-003** (c2) — Baseline del seed: asignar los 5 permisos a HOST / ADMIN / SUPER_ADMIN
  - En packages/seed/src/required/rolePermissions.seed.ts agregar: HOST → HOST_TRADE_REVIEW_CREATE (único que recibe); ADMIN y SUPER_ADMIN → los 5. Insertarlos en los bloques HOST_TRADE_* ya exi…
  - Bloqueada por: T-002 · Bloquea a: T-004
- [x] **T-004** (c2) — Data-migration del seed para los 5 permisos (dual-write OBLIGATORIO)
  - Correr `pnpm db:seed:make hos376-host-trade-permissions` y escribir la data-migration que inserta los 5 role-permissions en entornos ya seedeados. SIN esto el baseline de T-003 sólo llega a …
  - Bloqueada por: T-003 · Bloquea a: —
- [x] **T-005** (c1) — Agregar la dependencia `qrcode` a apps/api
  - Instalar `qrcode` (+ tipos si el paquete no los trae) SOLO en apps/api. Fijar la versión verificando el registry. Verificar con el análisis de bundle que no aparece en apps/web (R-9: HOS-369…
  - Bloqueada por: — · Bloquea a: T-029
- [x] **T-006** (c3) — dbschema de host_trade_benefit_usages
  - packages/db/src/schemas/host-trade/host_trade_benefit_usage.dbschema.ts con todas las columnas de spec §7.1, FKs (hostTradeId cascade, hostUserId cascade), los índices simples y compuestos, …
  - Bloqueada por: T-001 · Bloquea a: T-010
- [x] **T-007** (c3) — dbschema de host_trade_reviews
  - packages/db/src/schemas/host-trade/host_trade_review.dbschema.ts según spec §7.1: overallRating integer, rating jsonb nullable con las 3 dims, averageRating numeric(3,2) nullable, respectedB…
  - Bloqueada por: T-001 · Bloquea a: T-008, T-010
- [x] **T-008** (c2) — dbschema de host_trade_review_replies
  - packages/db/src/schemas/host-trade/host_trade_review_reply.dbschema.ts: reviewId UNIQUE FK cascade (una sola réplica por valoración), authorUserId, content, moderationState default PENDING, …
  - Bloqueada por: T-007 · Bloquea a: T-010
- [x] **T-009** (c2) — Agregar las 8 columnas nuevas a host_trades
  - En packages/db/src/schemas/host-trade/host_trade.dbschema.ts: confirmedUsesCount, distinctHostsCount, reviewsCount, benefitRespectedCount (integer NOT NULL default 0), averageRating (numeric…
  - Bloqueada por: — · Bloquea a: T-010
- [x] **T-010** (c2) — Generar la migración estructural (pnpm db:generate)
  - Correr `pnpm db:generate` y commitear el .sql + el _journal.json resultantes. Verificar que el número de migración no colisiona con otro en vuelo (ver el gotcha de colisiones que se automerg…
  - Bloqueada por: T-006, T-007, T-008, T-009 · Bloquea a: T-011, T-018
- [x] **T-011** (c2) — Extras SQL: los CHECK que Drizzle no expresa
  - Archivo idempotente en packages/db/src/migrations/extras/: (a) overallRating BETWEEN 1 AND 5; (b) cada dimensión del jsonb rating dentro de 1-5 cuando el jsonb no es null; (c) cross-column: …
  - Bloqueada por: T-010 · Bloquea a: —
- [x] **T-012** (c1) — Constantes de configuración del dominio
  - En packages/schemas/src/entities/host-trade/: HOST_TRADE_USAGE_EXPIRY_DAYS=30, HOST_TRADE_USAGE_REMINDER_DAYS=10, HOST_TRADE_REJECTION_SUSPEND_THRESHOLD=3, HOST_TRADE_REJECTION_WINDOW_DAYS=9…
  - Bloqueada por: — · Bloquea a: T-020, T-022, T-040, T-052
- [x] **T-013** (c2) — Usuario seed que sea anfitrión Y proveedor a la vez
  - La matriz de usuarios de prueba de SPEC-143 no tiene ninguno que sea host (con accommodations) y a la vez dueño de un host_trades. AC-16 y AC-17 lo necesitan. Agregarlo en packages/seed (bas…
  - Bloqueada por: — · Bloquea a: T-064

## Fase `core` — 13/17 completadas (complejidad promedio 2.6)

- [x] **T-014** (c3) — Zod schemas del uso del beneficio
  - packages/schemas/src/entities/host-trade-usage/: entity schema, create input/body (el body NO acepta hostUserId ni status — vienen del path/actor/servidor), update, access tiers (public/prot…
  - Bloqueada por: T-001 · Bloquea a: T-017, T-019
- [x] **T-015** (c3) — Zod schemas de la valoración
  - packages/schemas/src/entities/host-trade-review/: entity, create body (overallRating 1-5 obligatorio, rating jsonb opcional con las 3 dims, respectedBenefit boolean OBLIGATORIO, content opci…
  - Bloqueada por: T-001 · Bloquea a: T-016, T-017, T-024
- [x] **T-016** (c2) — Zod schemas de la réplica
  - packages/schemas/src/entities/host-trade-review-reply/: entity, create body (content min 10 / max 1000), update, access tiers. moderationState y reviewEditedAfterReply nunca user-settable. T…
  - Bloqueada por: T-015 · Bloquea a: T-017, T-025
- [x] **T-017** (c2) — Guard test de campos administrados no user-settable
  - Test estático con el molde de HOST_TRADE_OWNER_FORBIDDEN_FIELDS (host-trade.owner.schema.ts:79-94, que ya tiene su guard). Debe afirmar que moderationState, moderatedById, moderatedAt, moder…
  - Bloqueada por: T-014, T-015, T-016 · Bloquea a: —
- [x] **T-018** (c2) — Modelos DB de las 3 tablas nuevas
  - packages/db/src/models/hostTrade/: HostTradeBenefitUsageModel, HostTradeReviewModel, HostTradeReviewReplyModel, todos extendiendo BaseModelImpl con el molde de host-trade.model.ts. Incluir l…
  - Bloqueada por: T-010 · Bloquea a: T-019, T-024, T-025
- [x] **T-019** (c3) — Servicio de usos: declaración por los 3 canales
  - packages/service-core/src/services/hostTrade/host-trade-usage.service.ts extendiendo BaseCrudService, Result<T>, runWithLoggingAndValidation. Crear el uso desde: QR (declaredBy=HOST, el acto…
  - Bloqueada por: T-018, T-014 · Bloquea a: T-020, T-021, T-030
- [ ] **T-020** (c3) — Servicio de usos: guardas de declaración
  - Antes de crear un uso, verificar en orden: PROVIDER_REVOKED (host_trades.revokedAt o soft-deleted), DECLARATION_SUSPENDED (declarationSuspendedAt), DECLARATION_BLOCKED (existe un REJECTED vi…
  - Bloqueada por: T-019, T-012 · Bloquea a: T-031
- [x] **T-021** (c3) — Servicio de usos: confirmar, rechazar y revertir el rechazo
  - Resolver quién es la contraparte según declaredBy: si declaró el proveedor confirma el anfitrión, si declaró el anfitrión confirma el ownerUserId del proveedor. Cualquier otro actor obtiene …
  - Bloqueada por: T-019 · Bloquea a: T-022, T-023, T-024, T-033, T-042, T-043, T-057
- [ ] **T-022** (c3) — Servicio de usos: suspensión automática por umbral de rechazos
  - Al registrar un rechazo, contar los REJECTED de ese proveedor dentro de HOST_TRADE_REJECTION_WINDOW_DAYS. Si alcanza HOST_TRADE_REJECTION_SUSPEND_THRESHOLD, sellar declarationSuspendedAt con…
  - Bloqueada por: T-021, T-012, T-070 · Bloquea a: T-038, T-060
- [x] **T-023** (c3) — Recálculo de los 5 agregados denormalizados de host_trades
  - Con el molde de recalculateAndUpdateAccommodationStats: SQL de agregación desde TS que recalcula confirmedUsesCount, distinctHostsCount (COUNT DISTINCT hostUserId sobre CONFIRMED), reviewsCo…
  - Bloqueada por: T-021 · Bloquea a: T-028, T-044, T-052, T-059
- [x] **T-024** (c3) — Servicio de valoraciones: creación con los 4 gates de elegibilidad
  - packages/service-core/src/services/hostTrade/host-trade-review.service.ts. Los 4 gates de spec §6.3, cada uno con su código de error: (1) permiso HOST_TRADE_REVIEW_CREATE; (2) existe uso CON…
  - Bloqueada por: T-018, T-015, T-021 · Bloquea a: T-025, T-026, T-027, T-034, T-036, T-058
- [x] **T-025** (c2) — Servicio de réplicas: crear y editar, siempre PENDING
  - host-trade-review-reply.service.ts. Sólo el ownerUserId del proveedor dueño de la valoración puede responder; cualquier otro actor obtiene 404. Una sola réplica por valoración (UNIQUE + guar…
  - Bloqueada por: T-018, T-016, T-024 · Bloquea a: T-026, T-027, T-035, T-036
- [ ] **T-026** (c3) — Servicio de valoraciones: edición del anfitrión con re-moderación
  - Editar la propia valoración (patrón NUEVO en el repo: hoy ningún usuario puede editar su review, ACCOMMODATION_REVIEW_MODERATE es admin-only). Al editar: sellar editedAt, volver a pasar por …
  - Bloqueada por: T-024, T-025 · Bloquea a: T-034, T-065
- [x] **T-027** (c2) — Integrar resolveInitialModerationState y moderateText para el dominio nuevo
  - Extender resolveInitialModerationState (packages/service-core/src/services/moderation/review-moderation.helpers.ts) con el entityType nuevo: valoración → APPROVED por default, réplica → PEND…
  - Bloqueada por: T-024, T-025 · Bloquea a: T-028, T-065
- [x] **T-028** (c3) — Servicio de moderación admin de valoraciones y réplicas
  - moderateReview({id, decision, reason, actor}) y moderateReply(...) con gate HOST_TRADE_REVIEW_MODERATE, sellando moderationState/moderatedById/moderatedAt/moderationReason. Cada decisión sob…
  - Bloqueada por: T-027, T-023 · Bloquea a: T-037
- [ ] **T-029** (c2) — Generación del SVG del QR server-side
  - Helper en apps/api que, dado un host_trades.slug, genera el SVG del QR apuntando a {SITE_URL}/mi-cuenta/directorio-proveedores/{slug}/registrar-uso usando `qrcode`. Sin estado, sin tabla, si…
  - Bloqueada por: T-005 · Bloquea a: T-032

- [x] **T-070** (c2) — Exponer en Zod las 8 columnas de host_trades que agregó T-009
  - Los 5 agregados y las 3 de suspensión están en la DB desde T-009 pero no en HostTradeSchema, así que ningún endpoint las sirve y HostTradeModel no las puede escribir. Reparto de tiers + omit…
  - Bloqueada por: — · Bloquea a: T-022, T-052

## Fase `integration` — 0/27 completadas (complejidad promedio 2.5)

- [ ] **T-030** (c3) — Endpoints del anfitrión: declarar por QR y listar pendientes
  - apps/api/src/routes/host-trade/protected/: POST /{slug}/usages (gate HOST_TRADE_VIEW, declaredBy=HOST, creationChannel=QR), GET /usages/pending (paginado) y GET /usages/pending-count. Usar l…
  - Bloqueada por: T-019 · Bloquea a: T-045, T-046, T-047, T-061
- [ ] **T-031** (c3) — Endpoints del proveedor: declarar, listar usos y anfitriones vinculados
  - POST /protected/host-trades/mine/usages (body acepta hostUserId O hostEmail), GET /protected/host-trades/mine/usages (filtro por status, paginado), GET /protected/host-trades/mine/linked-hos…
  - Bloqueada por: T-020 · Bloquea a: T-039, T-050, T-062
- [ ] **T-032** (c1) — Endpoint GET /protected/host-trades/mine/qr
  - Devuelve el SVG del QR de la ficha propia. Ownership de fila. Tests: 404 sin ficha propia; el SVG apunta al slug correcto.
  - Bloqueada por: T-029 · Bloquea a: T-050
- [ ] **T-033** (c3) — Endpoints compartidos: confirm, reject y reject/undo
  - POST /protected/host-trades/usages/{id}/confirm, /reject (body {note?}) y /reject/undo. El servicio resuelve quién es la contraparte; el endpoint NO discrimina por rol. Todo camino ajeno dev…
  - Bloqueada por: T-021 · Bloquea a: T-041, T-046, T-061, T-065
- [ ] **T-034** (c3) — Endpoints de valoración: crear, editar y leer la propia
  - POST /protected/host-trades/{id}/reviews (gate HOST_TRADE_REVIEW_CREATE), PATCH /protected/host-trades/reviews/{id} (ownership, 404 si es ajena), GET /protected/host-trades/{id}/my-review (d…
  - Bloqueada por: T-024, T-026 · Bloquea a: T-039, T-041, T-048, T-049
- [ ] **T-035** (c2) — Endpoints de réplica: crear y editar
  - POST /protected/host-trades/reviews/{id}/reply y PATCH /protected/host-trades/replies/{id}. Ownership del proveedor; ajeno devuelve 404. Tests: la réplica creada NO aparece en el listado púb…
  - Bloqueada por: T-025 · Bloquea a: T-051
- [ ] **T-036** (c2) — Endpoint GET /protected/host-trades/{id}/reviews
  - Listado de valoraciones del proveedor para el directorio. Fuerza moderationState=APPROVED y deletedAt IS NULL DESPUÉS del spread de filtros del caller (imposible de bypassear por query param…
  - Bloqueada por: T-024, T-025 · Bloquea a: T-050, T-053
- [ ] **T-037** (c3) — Endpoints admin de valoraciones y réplicas
  - GET /admin/host-trades/reviews (HOST_TRADE_REVIEW_VIEW_ALL, filtro moderationState, paginación page+pageSize NO limit), POST /admin/host-trades/reviews/{id}/moderate, GET /admin/host-trades/…
  - Bloqueada por: T-028 · Bloquea a: T-041, T-055, T-063
- [ ] **T-038** (c3) — Endpoints admin de usos y suspensión de declaración
  - GET /admin/host-trades/usages (HOST_TRADE_USAGE_VIEW_ALL, filtros por status, hostTradeId, creationChannel, rango de fechas) y POST /admin/host-trades/{id}/declaration-suspension (HOST_TRADE…
  - Bloqueada por: T-022 · Bloquea a: T-056, T-063
- [ ] **T-039** (c2) — Rate limits de declaración y valoración
  - createSlidingWindowPerUserRateLimit en: POST mine/usages (más estricto en el canal EMAIL_LOOKUP, que es el vector de spray), POST {slug}/usages y POST reviews. Valores iniciales conservadore…
  - Bloqueada por: T-031, T-034 · Bloquea a: T-062
- [ ] **T-040** (c3) — Los 6 templates de mail del dominio
  - packages/notifications/src/templates/host-trade/: usage-confirmation-request, usage-confirmation-reminder, usage-confirmed, usage-rejected, review-received, reply-moderated. React Email, ESP…
  - Bloqueada por: T-012 · Bloquea a: T-041, T-043
- [ ] **T-041** (c3) — Cablear los envíos de mail en los flujos
  - Vía apps/api/src/utils/notification-helper.ts (trySendNotification): al declarar → pedido de confirmación a la contraparte; al confirmar → aviso al declarante; al rechazar → aviso al declara…
  - Bloqueada por: T-040, T-033, T-034, T-037 · Bloquea a: T-068
- [ ] **T-042** (c2) — Cron de expiración de usos a los 30 días
  - apps/api/src/cron/jobs/host-trade-usage-expiry.job.ts, diario: PENDING con expiresAt <= now() → EXPIRED. NO notifica a nadie (el silencio no acusa) y NO suma a ninguna estadística. Registrar…
  - Bloqueada por: T-021 · Bloquea a: T-066
- [ ] **T-043** (c2) — Cron de recordatorio al día 10
  - host-trade-usage-reminder.job.ts, diario: PENDING con createdAt <= now() - HOST_TRADE_USAGE_REMINDER_DAYS y reminderSentAt IS NULL → enviar el recordatorio y sellar reminderSentAt. La idempo…
  - Bloqueada por: T-040, T-021 · Bloquea a: T-066
- [ ] **T-044** (c2) — Cron semanal de reconciliación de agregados
  - host-trade-stats-reconcile.job.ts con el molde de featured-by-entitlement-reconcile.job.ts: recalcula los 5 contadores de todos los host_trades y corrige la deriva, registrando qué corrigió …
  - Bloqueada por: T-023 · Bloquea a: T-066
- [ ] **T-045** (c2) — Página de aterrizaje del QR (registrar uso)
  - apps/web/src/pages/[lang]/mi-cuenta/directorio-proveedores/[slug]/registrar-uso/index.astro. Sin sesión redirige a login y vuelve. Muestra el proveedor, pide fecha del servicio y nota opcion…
  - Bloqueada por: T-030 · Bloquea a: T-054
- [ ] **T-046** (c3) — Sección /mi-cuenta/usos-de-beneficio
  - Página + isla React: pendientes arriba con Confirmar / Rechazar (rechazar pide confirmación en un <dialog> y aclara que es reversible), historial abajo con badges por estado, y CTA a valorar…
  - Bloqueada por: T-030, T-033 · Bloquea a: T-054
- [ ] **T-047** (c2) — Contador de pendientes en la navegación de /mi-cuenta
  - Clonar el molde de apps/web/src/components/shared/whats-new/WhatsNewCountPill.client.tsx. Consume GET /usages/pending-count. SE APAGA AL RESOLVER, NO AL VER — si se apagara al mirar, el pend…
  - Bloqueada por: T-030 · Bloquea a: T-054
- [ ] **T-048** (c3) — Formulario de valoración
  - Isla React en <dialog> nativo: estrellas 1-5 para overallRating como radiogroup operable por teclado con label textual por valor (no sólo iconos), desglose de las 3 dimensiones COLAPSADO por…
  - Bloqueada por: T-034 · Bloquea a: T-049, T-054, T-067
- [ ] **T-049** (c2) — Modo edición de la valoración y cartel de réplica desactualizada
  - Si el anfitrión ya valoró, el mismo formulario abre precargado en modo edición y hace PATCH. En el listado público, cuando reviewEditedAfterReply es true, mostrar el cartel 'la valoración fu…
  - Bloqueada por: T-048, T-034 · Bloquea a: —
- [ ] **T-050** (c3) — Pestañas del proveedor en /mi-cuenta/proveedor
  - Extender la ficha existente con tres pestañas: Usos (declarar por selector o email + pendientes marcados como tales + historial), Valoraciones (listado con acción de responder), Mi QR (previ…
  - Bloqueada por: T-031, T-032, T-036 · Bloquea a: T-051, T-054
- [ ] **T-051** (c2) — Responder una valoración desde el panel del proveedor
  - Formulario de réplica en la pestaña Valoraciones, con aviso claro de que la respuesta pasa por revisión antes de publicarse (si no, el proveedor va a creer que se perdió). Estado visible: en…
  - Bloqueada por: T-035, T-050 · Bloquea a: —
- [ ] **T-052** (c2) — Stats en TradeCard con el umbral de 3 valoraciones
  - En apps/web/src/components/host/host-trades/TradeCard.tsx, bajo el beneficio: '★ 4,6 (12 valoraciones) · 34 usos · 21 anfitriones'. El promedio SÓLO se muestra a partir de HOST_TRADE_MIN_REV…
  - Bloqueada por: T-023, T-012, T-070 · Bloquea a: T-054
- [ ] **T-053** (c2) — Detalle del proveedor con valoraciones y réplicas
  - Vista de detalle dentro del directorio con la lista paginada de valoraciones aprobadas, su desglose cuando existe, el indicador de beneficio respetado y la réplica aprobada del proveedor. Sk…
  - Bloqueada por: T-036 · Bloquea a: T-054
- [ ] **T-054** (c3) — Namespace i18n del dominio en es/en/pt
  - Todas las cadenas de la UI web y admin en @repo/i18n, en los 3 locales. Verificar que el prefijo del namespace esté en CLIENT_I18N_KEY_PREFIXES — si falta, en producción salen las claves cru…
  - Bloqueada por: T-045, T-046, T-047, T-048, T-050, T-052, T-053 · Bloquea a: —
- [ ] **T-055** (c3) — Admin: cola de moderación de réplicas y valoraciones
  - apps/admin/src/routes/_authed/host-trades/: cola de réplicas PENDING (la prioritaria, porque bloquea publicación) y listado de valoraciones con filtro de moderationState. Hooks con el molde …
  - Bloqueada por: T-037 · Bloquea a: —
- [ ] **T-056** (c3) — Admin: listado de usos y gestión de suspensiones
  - Tabla de usos con filtros (status, proveedor, creationChannel, fechas) y vista de proveedores con la declaración suspendida, con acción de levantar la suspensión pidiendo motivo. TanStack Ta…
  - Bloqueada por: T-038 · Bloquea a: —

## Fase `testing` — 0/11 completadas (complejidad promedio 2.5)

- [ ] **T-057** (c3) — Tests unitarios de la máquina de estados del uso
  - TODAS las transiciones válidas (PENDING→CONFIRMED, PENDING→REJECTED, PENDING→EXPIRED, REJECTED→PENDING por undo) y TODAS las inválidas (CONFIRMED→cualquier cosa, EXPIRED→cualquier cosa, dobl…
  - Bloqueada por: T-021 · Bloquea a: —
- [ ] **T-058** (c3) — Tests unitarios de los 4 gates de elegibilidad, cada uno aislado
  - Un test por gate, con el resto de las condiciones satisfechas, para que la falla identifique el gate exacto. Incluye el caso mixto: un actor que cumple 3 de 4 falla por el que corresponde. M…
  - Bloqueada por: T-024 · Bloquea a: T-064
- [ ] **T-059** (c2) — Tests unitarios del recálculo de agregados
  - distinctHostsCount con usos repetidos del mismo anfitrión (el caso que más fácil se implementa mal); valoración PENDING que no suma; valoración soft-deleted que no suma; benefitRespectedCoun…
  - Bloqueada por: T-023 · Bloquea a: —
- [ ] **T-060** (c2) — Tests unitarios del umbral y la ventana de suspensión
  - 2 rechazos no suspenden y el 3ero sí (AC-11); un rechazo fuera de la ventana de 90 días no cuenta; el undo del que gatilló NO levanta la suspensión sola; el admin la levanta y queda registra…
  - Bloqueada por: T-022 · Bloquea a: —
- [ ] **T-061** (c3) — Tests de integración de los endpoints del anfitrión y compartidos
  - Cada endpoint de T-030 y T-033 con éxito / 401 / 403 / 404 / validación. Foco en que confirmar un uso ajeno devuelva 404 y NUNCA 403 (no ser oráculo de existencia). Recordar que apps/api usa…
  - Bloqueada por: T-030, T-033 · Bloquea a: T-064
- [ ] **T-062** (c2) — Tests de integración de los endpoints del proveedor y del rate limit
  - T-031, T-032 y T-039: ownership, HOST_NOT_FOUND explícito, linked-hosts que excluye pares sin uso confirmado, 429 al superar el límite, y que el límite del canal EMAIL_LOOKUP sea más estrict…
  - Bloqueada por: T-031, T-039 · Bloquea a: —
- [ ] **T-063** (c2) — Tests de integración de los endpoints admin
  - T-037 y T-038: 403 sin el permiso correspondiente (un permiso por endpoint, no genérico), moderar recalcula agregados, levantar la suspensión registra el admin, los filtros funcionan. Los te…
  - Bloqueada por: T-037, T-038 · Bloquea a: —
- [ ] **T-064** (c3) — Regresiones dedicadas: AC-6, AC-15, AC-16, AC-17
  - Un test con nombre explícito por cada uno: AC-6 confirmar el uso que uno mismo declaró da 404; AC-15 un usuario SÓLO proveedor no puede valorar a otro proveedor; AC-16 un usuario host+provee…
  - Bloqueada por: T-013, T-058, T-061 · Bloquea a: —
- [ ] **T-065** (c3) — Regresiones dedicadas: AC-19, AC-22, AC-28
  - AC-19 un texto con score de moderación ≥ 0.5 nace PENDING a pesar del default APPROVED; AC-22 editar una valoración ya respondida la re-modera, sella editedAt y deja la réplica VIVA con revi…
  - Bloqueada por: T-026, T-027, T-033 · Bloquea a: —
- [ ] **T-066** (c3) — Tests de los 3 crons
  - Expiración: vence a los 30 días exactos y no antes, y no notifica. Recordatorio: idempotente por reminderSentAt, corre dos veces y manda un solo mail (AC-8). Reconciliación: corrige un conta…
  - Bloqueada por: T-042, T-043, T-044 · Bloquea a: T-069
- [ ] **T-067** (c2) — Accesibilidad del formulario de estrellas y del dialog
  - Verificar en NAVEGADOR, no sólo en vitest: el radiogroup de estrellas se opera con teclado y anuncia el valor; el <dialog> respeta el trap de foco y Escape; el pill del contador anuncia el n…
  - Bloqueada por: T-048 · Bloquea a: —

## Fase `docs` — 0/2 completadas (complejidad promedio 1.5)

- [ ] **T-068** (c2) — Documentación
  - Actualizar apps/api/docs/route-architecture.md con los tiers nuevos, docs/guides/review-moderation.md con la postura asimétrica y su fundamento, packages/seed/CLAUDE.md con el usuario de dob…
  - Bloqueada por: T-041 · Bloquea a: —
- [ ] **T-069** (c1) — Checklist de smoke y labels de la issue
  - Escribir el checklist de smoke local (gates de rol, ownership, auto-valoración con los usuarios seed) y de staging (mails reales por Brevo y timing de los 3 crons) en .specs/HOS-376-proveedo…
  - Bloqueada por: T-066 · Bloquea a: —

---

## Grafo de dependencias

- **Nivel 0:** T-001, T-002, T-005, T-009, T-012, T-013
- **Nivel 1:** T-003, T-006, T-007, T-014, T-015, T-029, T-040
- **Nivel 2:** T-004, T-008, T-016, T-032
- **Nivel 3:** T-010, T-017
- **Nivel 4:** T-011, T-018
- **Nivel 5:** T-019
- **Nivel 6:** T-020, T-021, T-030
- **Nivel 7:** T-022, T-023, T-024, T-031, T-033, T-042, T-043, T-045, T-047, T-057
- **Nivel 8:** T-025, T-038, T-044, T-046, T-052, T-058, T-059, T-060, T-061
- **Nivel 9:** T-026, T-027, T-035, T-036, T-056, T-064, T-066
- **Nivel 10:** T-028, T-034, T-050, T-053, T-065, T-069
- **Nivel 11:** T-037, T-039, T-048, T-051
- **Nivel 12:** T-041, T-049, T-054, T-055, T-062, T-063, T-067
- **Nivel 13:** T-068

## Camino crítico (14 tareas, 13 saltos)

`T-001 → T-007 → T-008 → T-010 → T-018 → T-019 → T-021 → T-024 → T-025 → T-027 → T-028 → T-037 → T-041 → T-068`

## Siguiente

Fase `core` en curso (13/17). Las disponibles ahora: T-020, T-022, T-026,
T-029, T-030, T-033, T-037, T-040, T-042, T-052, T-057.

Quedan 4 de `core`: **T-020** (guardas de declaración), **T-022** (suspensión
automática), **T-026** (edición de la valoración — la otra mitad de AC-22) y
**T-029** (SVG del QR). Con T-028 cerrada, **T-037** (endpoints admin) también
quedó libre y abre la fase de integración.

El camino crítico sigue por **T-028** — la moderación admin, que ya tiene lo
que necesitaba: `recalculateHostTradeAggregates` para AC-27. T-026 sigue libre:
es la otra mitad de AC-22 — falta que la edición de la VALORACIÓN le ponga
`reviewEditedAfterReply` a la réplica.
