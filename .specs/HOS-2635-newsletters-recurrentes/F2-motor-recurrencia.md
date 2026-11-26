---
title: F2. Plantillas y motor de recurrencia
linear: HOS-2637
parent: HOS-2635
statusSource: linear
created: 2026-11-25
blockedBy: [HOS-2636]
smokeLabels: [status-needs-smoke-staging]
---

# F2. Plantillas y motor de recurrencia (HOS-2637)

Paraguas: [spec.md](./spec.md). Decisiones aplicables: D-3, D-4, D-5, D-6, D-7, D-9,
D-10 (sólo `contentType` obligatorio), D-13, D-14, D-15. Modo de envío: **sólo `auto`**.

## 1. Objetivo

Plantillas con versiones inmutables, cuerpos por idioma, recurrencia en hora de mercado,
un cron idempotente frente a dos contenedores, tolerancia de recuperación, historial de
corridas con lo que salió de verdad, deduplicación entre ediciones, soft-cap por
plantilla, simulación y calendario.

## 2. Alcance

**Incluye**
- Tablas `newsletter_schedules`, `_versions`, `_bodies`, `_runs`, `_run_items`; columnas `schedule_id`, `run_id` en campañas; enums pg completos (spec §9).
- Extras: CHECKs de recurrencia y locales, único parcial `(run_id, locale_filter)`.
- `computeSlots()`, `nextSlotAt`, `next_action_at`, calendario.
- Cron `newsletter-schedule-tick` con claim, compare-and-set y reconciliación de claims viejos.
- Tolerancia `catchUpWindowHours` (defaults diaria 3h, semanal 12h, mensual 24h).
- Modo `auto`: generar y enviar en el slot.
- Dedup `excludeRecentEditions` / `fillWithRepeats` sobre `run_items`.
- Soft-cap `respect | ignore` y `excludeScheduleId` en `getEligibleForCampaign`; aviso de intervalo.
- `send()` atómico ante concurrencia (H-2).
- Simulación (`simulate`, `simulate/test-send`) y test simulación == real.
- Permisos `newsletter.schedule.{view,write,manage}`, grants a `super_admin` y `admin`.
- Admin: lista, creación, edición como nueva versión, historial de corridas, simulación, calendario, activar/reanudar, duplicar.

**No incluye**
- `window`, `approval`, revisores, avisos, `HOSPEDA_NEWSLETTER_ALERT_EMAIL`, pausar, saltear, terminar, cancelar borrador (F3). En F2 el servicio responde 422 `SEND_MODE_NOT_AVAILABLE` a cualquier `send_mode` distinto de `auto`, y el default de servicio en F2 es `auto` (pasa a `window` al mergear F3, D-1).
- Baja por plantilla (F4).

> Sin pausa en F2, una plantilla activa sólo se detiene borrándola (soft delete, sólo si
> nunca corrió) o duplicando. Por eso F2 y F3 deberían promoverse a `main` juntos.

## 3. Dependencias

- **HOS-2636 (F1)**: `resolveBlocks()`, port, render por segmentos.
- **HOS-2613 (ya mergeado en staging)**: omitir `softCapWindowDays` saltea la exclusión
  entera (`newsletter-campaign.service.ts:811`, `newsletter-subscriber.service.ts:1795-1803`).
  `softCapPolicy: 'ignore'` usa ese camino tal cual; no hay que esperar nada (H-3).

## 4. Diseño

### 4.1 Recurrencia

- `daily`: todos los días a `time_of_day_minutes`. Intervalo 1 día.
- `weekly`: `weekday` (1 = lunes). Intervalo 7 días.
- `monthly`: `day_of_month` 1..28. Intervalo mínimo 28 días.
- Slot = `getUtcInstantForLocalMidnight(fecha local) + minutos` (`packages/utils/src/local-day.ts`).
- Cambiar la recurrencia (`PATCH /recurrence`) recalcula `next_slot_at` desde `now`. En
  F2 no hay borradores pendientes que cancelar (modo `auto`); la rama `rescheduled` llega en F3.

### 4.2 Versiones

- `POST /schedules` crea plantilla `paused` + versión 1 + cuerpos en una transacción.
- `POST /schedules/{id}/versions` crea la versión `n+1` con todo el payload (contenido y
  operativo) y mueve `current_version_id`. Nunca hay `UPDATE` sobre una versión.
- Validaciones: al menos un cuerpo; cada cuerpo referencia exactamente los `blockKey` de
  `blocks`; `content_type` presente; `enabled_locales` no vacío; `catch_up_window_hours`
  ≤ intervalo en horas.
- `blockKey` lo genera el editor al insertar el bloque y no cambia al reordenar (D-9).

### 4.3 Una corrida en modo auto

1. Claim (spec §12). 2. `resolveRun({ version, bodies, now, history })`:
   - resuelve bloques una vez para todos los idiomas (D-7);
   - por cada `enabled_locale` con cuerpo arma la campaña (`localeFilter = locale`,
     `contentType = version.content_type`, `schedule_id`, `run_id`, `body_json`
     materializado con config inline, `title = "<name> · <fecha local>"`);
   - idioma habilitado sin cuerpo → warning `locale_without_body`, no hay campaña.
3. `decision = skip_run` → run `skipped_empty`, sin campañas.
4. `commitRun()` en transacción: inserta campañas (`draft`) y marca run `generated`.
5. Por campaña, `send()` con actor de sistema y `excludeScheduleId` según política; guarda `resolved_body_json`.
   `send()` ya escribe `attribution_slug` en el mismo UPDATE (`newsletter-campaign.service.ts:720-723`,
   HOS-2359), así que las ediciones salen con UTMs sin trabajo extra.
6. Si al menos una campaña encoló > 0: inserta `run_items` (lo que salió, post-revalidación), run `sent`, `editions_sent + 1`.
   Una campaña con 0 elegibles queda `cancelled` con warning `no_eligible_subscribers`.
   Si todas dieron 0: run `skipped_empty` con `status_reason = 'no_audience'`, sin `run_items`.
7. Cualquier excepción después del claim: run `failed`, `report.error` con mensaje saneado (R5 del contrato de errores).

### 4.4 Soft-cap por plantilla

Forma actual en staging (post HOS-2613): `GetEligibleInputSchema`
(`newsletter-subscriber.service.ts:234-245`) tiene `softCapWindowDays` opcional; si falta,
`softCapCondition` es `TRUE` (`:1795-1803`). La subconsulta sólo mira `delivered_at`.

`getEligibleForCampaign` gana `excludeScheduleId?: string`, que sólo se usa cuando hay
ventana. La rama con ventana pasa a:

```sql
NOT EXISTS (
  SELECT 1 FROM newsletter_campaign_deliveries d
  JOIN newsletter_campaigns c ON c.id = d.campaign_id
  WHERE d.subscriber_id = ns.id
    AND d.delivered_at >= NOW() - (:days || ' days')::interval
    AND c.schedule_id IS DISTINCT FROM :excludeScheduleId
)
```

Decisión OQ-2 (owner, 2026-11-25): las entregas `pending` también cuentan, pero sólo las
de las últimas 24 h, para que una entrega trabada deje de bloquear al día siguiente. La
condición de fecha queda así, y aplica a todas las campañas (manuales incluidas):

```sql
AND (
  d.delivered_at >= NOW() - (:days || ' days')::interval
  OR (d.status = 'pending' AND d.created_at >= NOW() - interval '24 hours')
)
```

Va con un índice nuevo `(subscriber_id, status, created_at)` sobre
`newsletter_campaign_deliveries` y un test de regresión: dos campañas despachadas con
segundos de diferencia no le llegan al mismo suscriptor.

El parámetro entra por el helper privado `resolveEligibleForCampaign`
(`newsletter-campaign.service.ts:802-829`), que comparten `send()` y `getAudienceEstimate()`
(`GET /campaigns/{id}/audience-count`). Así el estimado de audiencia de un borrador
generado coincide con lo que `send()` va a encolar. El helper toma `excludeScheduleId` de
`campaign.scheduleId` cuando la versión tiene `respect`.

`respect` → `excludeScheduleId = schedule.id`; `ignore` → `ignoreSoftCap: true`, que omite la ventana (HOS-2613). Las entregas
de la plantilla SÍ cuentan contra otras campañas, por eso el aviso: si la política es
`respect` y el intervalo en días es menor que `HOSPEDA_NEWSLETTER_SOFTCAP_DAYS`, el admin
muestra "las ediciones de esta plantilla van a dejar fuera de otras campañas a quienes
las reciban". Semanal con soft-cap 7 no avisa (7 no es menor que 7).

### 4.5 Dedup

Historial = `run_items` de las últimas `excludeRecentEditions` corridas `sent` de la
plantilla, por `blockKey`. Candidatos excluidos; si quedan menos de `minItems` y
`fillWithRepeats`, se completa con los excluidos ordenados por la última vez mostrados
(más viejo primero) y se marcan `is_repeat`. `newest` default 0 (no excluye).

### 4.6 Simulación y calendario

- `POST /simulate` → `simulateRun({ scheduleId, now })` = `resolveRun()` sin `commitRun()`.
  Devuelve por idioma el HTML renderizado y el reporte: ítems por bloque, repeticiones,
  idiomas no generados, `wouldSkip`, y si el próximo slot tiene `skipNextRun` (sin consumirlo).
  También `excludedByMissingLocale: { total, byLocale: Partial<Record<Locale, number>> }`:
  suscriptores elegibles cuyo idioma la plantilla no tiene (OQ-5). Nunca se les manda otro
  idioma. El editor muestra el mismo conteo en vivo, desde `getAudienceEstimate()`.
- `POST /simulate/test-send` usa `sendTestEmailFromContent` con el HTML del idioma pedido.
- `GET /calendar?count=N` (1..52, default 10) desde `computeSlots()`: fecha local, `skipped`,
  `afterEnd`, `draftAt` (null en `auto`).

### 4.7 Claims viejos

Un run `claimed` o `generated` con más de 15 minutos lo reconcilia el tick: todas las
campañas `sending`/`sent` → `sent` (con `run_items` desde `resolved_body_json`); si no,
`failed` con `status_reason = 'stale_claim'`. Nunca reintenta un envío.

### 4.8 Modelo de datos (detalle de columnas; resumen y carriles en spec §9)

**`newsletter_schedules`**

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | uuid | PK, `defaultRandom()` |
| `name` | varchar(120) | not null, interno |
| `state` | `newsletter_schedule_state_enum` | not null, default `paused` |
| `frequency` | `newsletter_schedule_frequency_enum` | not null |
| `time_of_day_minutes` | smallint | not null, CHECK 0..1439 |
| `weekday` | smallint | null; CHECK 1..7 y obligatorio sii `weekly` (1 = lunes) |
| `day_of_month` | smallint | null; CHECK 1..28 y obligatorio sii `monthly` |
| `current_version_id` | uuid | null, FK versions `restrict` |
| `next_slot_at` | timestamptz | null mientras `ended` |
| `next_action_at` | timestamptz | null; min(generación de borrador, slot) |
| `skip_next_run` | boolean | not null default false |
| `skip_until` | timestamptz | null |
| `ends_at` | timestamptz | null |
| `max_editions` | integer | null, CHECK > 0 |
| `editions_sent` | integer | not null default 0 |
| `activated_at`, `paused_at`, `ended_at` | timestamptz | null |
| `ended_reason` | varchar(32) | null: `manual`, `ends_at`, `max_editions` |
| `duplicated_from_id` | uuid | null, FK self `set null` |
| `created_by` | uuid | not null, FK users `restrict` |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | auditoría, soft delete |

Índices: `(state, next_action_at)` (consulta del tick), `(created_by)`. `day_of_month`
con tope 28 evita definir qué pasa el 31 en febrero.

**`newsletter_schedule_versions`** (inmutable, sin `updated_at`)

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | uuid | PK |
| `schedule_id` | uuid | not null, FK `restrict` |
| `version_number` | integer | not null; UNIQUE `(schedule_id, version_number)` |
| `send_mode` | send mode enum | not null |
| `soft_cap_policy` | soft cap enum | not null default `respect` |
| `content_type` | `newsletter_content_type_enum` (existente) | **not null** (D-10) |
| `enabled_locales` | text[] | not null; CHECK no vacío y subconjunto de `{es,en,pt}` |
| `catch_up_window_hours` | smallint | not null, CHECK 1..168 |
| `review_window_hours` | smallint | null (`auto`); tope = intervalo, validado en servicio |
| `blocks` | jsonb | not null default `[]`; array de `DynamicBlockConfig` (F1 §4.5) |
| `created_by` | uuid | FK users |
| `created_at` | timestamptz | |

**`newsletter_schedule_bodies`**: `id` uuid PK; `version_id` FK `cascade`; `locale`
varchar(2) CHECK `es|en|pt`; `subject` varchar(120) not null; `public_name` varchar(80)
not null (lo que ve el suscriptor en el footer y en el perfil); `body_json` jsonb not
null; `created_at`. UNIQUE `(version_id, locale)`. Todo cuerpo referencia el mismo
conjunto de `blockKey` que `versions.blocks` (validado en servicio).

**`newsletter_schedule_runs`**

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | uuid | PK |
| `schedule_id` | uuid | not null, FK `restrict` |
| `version_id` | uuid | not null, FK `restrict` |
| `slot_at` | timestamptz | not null; **UNIQUE `(schedule_id, slot_at)`** |
| `status` | run status enum | not null |
| `status_reason` | varchar(40) | null: `rescheduled`, `below_min`, `paused_cancel`, `stale_claim`, `outside_catch_up`, ... |
| `is_late` | boolean | not null default false |
| `claim_token` | uuid | not null (id del tick que la reclamó) |
| `claimed_at` | timestamptz | not null default now |
| `generated_at`, `review_deadline_at`, `reminder_sent_at`, `approved_at`, `sent_at`, `finished_at` | timestamptz | null |
| `approved_by` | uuid | null, FK users `set null` |
| `report` | jsonb | not null default `{}`; `ResolutionReport` |
| `warnings` | jsonb | not null default `[]` |
| `created_at`, `updated_at` | timestamptz | |

Índices: `(status, slot_at)`, `(schedule_id, status, slot_at)` (historial y dedup). Las
filas sin trabajo (`missed`, `skipped_*`) también existen: el historial es completo.

**`newsletter_schedule_run_items`**: `id` uuid PK; `run_id` FK `cascade`; `block_key`
varchar(64) not null; `entity_type` `entity_type_enum` (existente); `entity_id` uuid
(polimórfico, sin FK, como `entity_views`); `position` smallint; `is_repeat` boolean;
`created_at`. UNIQUE `(run_id, block_key, entity_id)`. Se escribe al enviar, después de
revalidar (D-5).

**`newsletter_campaigns`** gana `schedule_id` (uuid null, FK `restrict`, índice) y
`run_id` (uuid null, FK `restrict`, UNIQUE parcial `(run_id, locale_filter) WHERE run_id
IS NOT NULL` en extras). CHECK en extras: `run_id IS NULL OR (schedule_id IS NOT NULL AND
content_type IS NOT NULL)`. Las campañas manuales siguen con `contentType` opcional.

## 5. Archivos a tocar

| Archivo | Cambio |
|---|---|
| `packages/schemas/src/enums/newsletter-schedule-*.enum.ts` | nuevos: state, run status, frequency, send mode, soft cap policy |
| `packages/schemas/src/enums/permission.enum.ts` | `NEWSLETTER_SCHEDULE_VIEW/WRITE/MANAGE`; categoría `NEWSLETTER_SCHEDULE` en `PermissionCategoryEnum` |
| `packages/schemas/src/entities/newsletter/newsletter-schedule*.schema.ts` | nuevos: base, crud, http, admin-search, run, calendar, simulation |
| `packages/db/src/schemas/enums.dbschema.ts` | pg enums nuevos |
| `packages/db/src/schemas/newsletter/newsletter_schedule*.dbschema.ts` | nuevos, + `index.ts` |
| `packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema.ts` | `schedule_id`, `run_id`, índices |
| `packages/db/src/migrations/NNNN_*.sql` | `db:generate` (incluye `permission_enum`) |
| `packages/db/src/migrations/extras/0NN-newsletter-schedules.constraints.sql` | nuevo, idempotente |
| `packages/db/docs/triggers-manifest.md` | registrar el extra |
| `packages/service-core/src/services/newsletter/schedule/` | nuevo: `recurrence.ts`, `newsletter-schedule.service.ts`, `newsletter-schedule.permissions.ts`, `schedule-run.engine.ts` (`resolveRun`, `simulateRun`, `executeRun`, `commitRun`), `schedule-tick.service.ts`, `dedup-history.ts` |
| `packages/service-core/src/services/newsletter/newsletter-campaign.service.ts` | `send()` (`:662-785`) con UPDATE condicional (H-2); `resolveEligibleForCampaign` (`:802-829`) pasa `excludeScheduleId` |
| `packages/service-core/src/services/newsletter/newsletter-subscriber.service.ts` | `excludeScheduleId` en `GetEligibleInputSchema` (`:234-245`) y en `softCapCondition` (`:1795-1803`) |
| `apps/api/src/cron/schedules.manifest.ts`, `apps/api/src/cron/registry.ts` | entrada `newsletter-schedule-tick` |
| `apps/api/src/cron/jobs/newsletter-schedule-tick.job.ts` | nuevo |
| `apps/api/src/routes/newsletter/admin/schedules.ts`, `schedule-runs.ts`, `schedule-simulation.ts` | nuevos |
| `apps/api/src/routes/newsletter/admin/index.ts` | registrar (rutas literales antes de `{id}`) |
| `packages/seed/src/required/rolePermissions.seed.ts` | baseline para `SUPER_ADMIN` y `ADMIN` |
| `packages/seed/src/data-migrations/NNNN-hos2637-newsletter-schedule-permissions.ts` | nuevo, vía `pnpm db:seed:make`, patrón de `0089-hos-981-qr-code-permissions.ts` |
| `apps/admin/src/routes/_authed/newsletter/schedules/{index,new,$scheduleId}.tsx` + `-components/` | nuevos |
| `apps/admin/src/config/ia/sidebars.ts`, `tabs.ts`, `create-actions.ts` | entrada "Plantillas recurrentes" con `NEWSLETTER_SCHEDULE_VIEW` |
| `packages/i18n/src/locales/{es,en,pt}/` | textos del admin |

## 6. Criterios de aceptación

- **AC-F2-1 Crear.** Dado un admin con `newsletter.schedule.write`, cuando crea una plantilla semanal (lunes 09:00) con cuerpo `es` y `contentType: 'offers'`, entonces existen plantilla `paused`, versión 1 y un cuerpo, y `next_slot_at` es null hasta activarla.
- **AC-F2-2 contentType obligatorio.** Dado un payload sin `contentType`, cuando se crea, entonces responde 400 `VALIDATION_ERROR` y no se escribe nada.
- **AC-F2-3 Modo no disponible.** Dado `sendMode: 'window'` en F2, cuando se crea, entonces responde 422 `SEND_MODE_NOT_AVAILABLE`.
- **AC-F2-4 Activar.** Dado el martes 10:00 hora AR, cuando se activa la plantilla de AC-F2-1, entonces `next_slot_at` es el lunes siguiente 09:00 AR (12:00 UTC).
- **AC-F2-5 Edición crea versión.** Dada la versión 1, cuando se edita el asunto, entonces existe la versión 2, `current_version_id` apunta a ella y la fila de la versión 1 está intacta.
- **AC-F2-6 blockKey estable.** Dado un cuerpo con bloques `k-aaaa1111` y `k-bbbb2222`, cuando se invierte su orden y se guarda, entonces la versión nueva conserva ambos `blockKey` y la dedup sigue usando el historial de cada uno.
- **AC-F2-7 Doble disparo en rollout.** Dados dos ticks simultáneos sobre el mismo slot (dos contenedores), cuando ambos ejecutan, entonces existe una sola fila en `newsletter_schedule_runs` para `(scheduleId, slotAt)`, una campaña por idioma y cada suscriptor tiene una sola entrega.
- **AC-F2-8 send() concurrente.** Dado un `draft` y dos `send()` simultáneos, cuando terminan, entonces uno devuelve el conteo real, el otro `CAMPAIGN_NOT_SENDABLE`, y `total_recipients` no queda en 0.
- **AC-F2-9 Recuperación dentro de tolerancia.** Dada una plantilla diaria a las 08:00 y el API caído de 07:50 a 10:30, cuando corre el tick de 10:30, entonces el slot de las 08:00 corre una vez con `is_late = true`.
- **AC-F2-10 Fuera de tolerancia.** Dado el mismo caso con el API vuelto a las 11:30, cuando corre el tick, entonces el run de las 08:00 queda `missed` con `status_reason = 'outside_catch_up'` y no hay campaña.
- **AC-F2-11 Varias corridas perdidas.** Dada una plantilla diaria y tres días caída, cuando vuelve dentro de las 3h del último slot, entonces los dos slots anteriores quedan `missed` y sólo el último corre.
- **AC-F2-12 Idioma sin cuerpo.** Dada una versión con `enabled_locales: ['es','en']` y sólo cuerpo `es`, cuando corre, entonces hay una campaña `es`, el run tiene el warning `locale_without_body` para `en` y termina `sent`.
- **AC-F2-13 Mismos ítems en todos los idiomas.** Dados cuerpos `es` y `pt`, cuando corre, entonces ambas campañas tienen los mismos `entity_id` en el mismo orden, con textos de `name_i18n.pt` o fallback `es`.
- **AC-F2-14 Bajo el mínimo.** Dado un único bloque con `minItems: 3` y 2 elegibles, cuando corre, entonces el run queda `skipped_empty` con `status_reason = 'below_min'` y no hay campañas.
- **AC-F2-15 run_items reflejan lo enviado.** Dado un ítem que se despublica entre la resolución y el `send()`, cuando termina la corrida, entonces `run_items` contiene el reemplazo y no el despublicado.
- **AC-F2-16 Dedup en destino chico.** Dado un destino con 3 alojamientos, un bloque `most_viewed` `count: 4`, `minItems: 3`, `excludeRecentEditions: 2`, `fillWithRepeats: true`, y la edición anterior con los 3, cuando corre, entonces salen los 3 con `is_repeat = true` y el reporte dice `repeatsUsed: 3`.
- **AC-F2-17 Dedup sin relleno.** Mismo caso con `fillWithRepeats: false` e `ifBelowMin: 'skip_run'`, entonces el run queda `skipped_empty`.
- **AC-F2-18 Soft-cap respect.** Dado un suscriptor que recibió la edición anterior de la misma plantilla hace 1 día, cuando corre con `respect` y soft-cap 7, entonces recibe la edición nueva.
- **AC-F2-19 Soft-cap contra otra campaña, borde exacto.** Dado un suscriptor con una campaña manual con `delivered_at = slot - 7 días` exactos, cuando corre con `respect`, entonces queda excluido (borde inclusivo, H-5); con `delivered_at = slot - 7 días - 1 segundo`, recibe.
- **AC-F2-20 Aviso de intervalo.** Dada una plantilla diaria con `respect` y soft-cap 7, cuando se abre el formulario, entonces se muestra el aviso; una semanal no lo muestra.
- **AC-F2-21 Simulación == real.** Dados datos fijos y un `now` fijo, cuando se ejecutan `simulateRun` y luego `executeRun` sobre la misma base, entonces el contenido resuelto por idioma (ítems, orden, repeticiones, bloques ocultos, HTML) es idéntico.
- **AC-F2-22 Simular no escribe.** Dada una plantilla con `skip_next_run = true`, cuando se simula, entonces no hay filas nuevas en runs ni run_items, `skip_next_run` sigue `true` y el reporte lo informa.
- **AC-F2-23 Calendario.** Dada una plantilla semanal con `max_editions: 2` y una edición enviada, cuando se pide `calendar?count=3`, entonces el primer slot es normal y los dos siguientes vienen con `afterEnd: true`.
- **AC-F2-24 maxEditions.** Dada `max_editions: 1`, cuando la primera corrida termina `sent`, entonces la plantilla pasa a `ended` con `ended_reason = 'max_editions'` y `next_slot_at` null.
- **AC-F2-25 Claim viejo.** Dado un run `claimed` hace 20 minutos sin campañas, cuando corre el tick, entonces queda `failed` con `stale_claim` y no se crea ninguna campaña nueva para ese slot.
- **AC-F2-26 Permisos.** Dado un `editor` (tiene `newsletter.campaign.write` pero no `newsletter.schedule.*`), cuando pide `GET /schedules`, entonces 403 `FORBIDDEN`; sin sesión, 401; un `{id}` inexistente con permiso, 404.
- **AC-F2-27 Cambio de recurrencia.** Dada una semanal de lunes, cuando se cambia a jueves 18:00, entonces `next_slot_at` es el próximo jueves 18:00 desde ahora y las corridas pasadas no cambian.
- **AC-F2-28 Idioma faltante.** Dada una plantilla sólo `es` y suscriptores elegibles `es` (10), `en` (3) y `pt` (2), cuando se simula y luego se ejecuta, entonces la simulación informa `excludedByMissingLocale = { total: 5, byLocale: { en: 3, pt: 2 } }`, la corrida crea 10 entregas y ninguna en otro idioma.

## 7. Plan de tests

| Nivel | Suite | Qué |
|---|---|---|
| Unit | `packages/service-core/test/services/newsletter/schedule/recurrence.test.ts` (nuevo) | AC-F2-4, 23, 27, fin de mes, lunes/domingo |
| Unit | `.../schedule/schedule-run.engine.test.ts` (nuevo) | AC-F2-12..17, 22 con port fake |
| Unit | `.../schedule/schedule-tick.service.test.ts` (nuevo) | AC-F2-9..11, 24, 25 con reloj de `@repo/test-clock` |
| Unit | `packages/service-core/test/services/newsletter/newsletter-subscriber.service.test.ts` | `excludeScheduleId` |
| Integración | `packages/service-core/test/integration/services/newsletter-schedule-run.integration.test.ts` (nuevo) | AC-F2-7 (dos `executeTick` en paralelo con `Promise.all` sobre Postgres real), 8, 15, 18, 19, **21** |
| Integración | `packages/db/test/integration/` | único `(schedule_id, slot_at)`, CHECKs de extras, único parcial de campañas |
| API | `apps/api/test/routes/newsletter/admin-schedules.test.ts` (nuevo) | AC-F2-1..3, 5, 26; asertar `mock.calls` |
| API | `apps/api/test/cron/newsletter-schedule-tick.job.test.ts` (nuevo), `apps/api/test/cron/schedules-manifest.test.ts` | registro y resultado del job |
| Seed | `packages/seed/test/required/rolePermissions.seed.test.ts` + test del data-migration | grants iguales al baseline |
| Admin | componentes de `schedules/-components/` | aviso AC-F2-20, calendario |
| E2E | `apps/e2e/tests/newsletter/` (nuevo `schedule-auto-flow.spec.ts`) | crear, simular, activar, disparar el job manualmente, ver run `sent` |

Para AC-F2-7 el test DEBE usar base real: el mock global de `@repo/db` de `apps/api`
no reproduce un índice único. Exigir conteo de tests ejecutados > 0 (no
`isDbAvailable()` silencioso).

## 8. Guards que se van a disparar

- `packages/schemas/test/enums/permission-naming-convention.guard.test.ts`: no debería saltar (H-11); correrlo igual.
- Tests de inventario de roles del admin: `apps/admin/test/config/ia/role-acceptance.admin-super.test.ts` (agregar los 3) y `role-acceptance.editor.test.ts` (verificar que NO los tiene).
- `packages/seed/test/required/rolePermissions.seed.test.ts`.
- Cualquier test que congele `PermissionCategoryEnum` o conteos de enums (buscar con `rg "PermissionCategoryEnum" packages/*/test apps/*/test`).
- `scripts/check-schema-drift.sh` (migración commiteada).
- `scripts/check-seed-dual-write.sh`: el baseline de `rolePermissions.seed.ts` y el data-migration van en el mismo PR.
- `apps/api/test/cron/schedules-manifest.test.ts`.
- `pnpm check:no-coerce-boolean`, `safeIlike` si la lista admin filtra por nombre.
- Guard de rutas: `createProtectedRoute` / `createAdminRoute` con el orden del contrato de errores.

## 9. Smoke (staging)

Label `status-needs-smoke-staging`. Hay que verlo en staging porque lo que se prueba es
el cron real con dos contenedores y el tiempo real:

1. Crear una plantilla diaria `auto` con el slot a 15 minutos, simular y comparar con el email recibido.
2. Disparar un redeploy durante la ventana del slot (con OK del dueño, coordinado) y confirmar una sola entrega por suscriptor de prueba.
3. Pausar el contenedor del API más de la tolerancia y confirmar el `missed`.
4. Dos ediciones seguidas: la segunda no repite ítems de `most_viewed` (dedup).

## 10. Tareas (orden de implementación)

1. **T-F2-01** Enums Zod y pg (state, run status, frequency, send mode, soft cap) + tests. (1.5h)
2. **T-F2-02** Permisos + categoría + tests de grouping y de convención. (1h)
3. **T-F2-03** Tablas `newsletter_schedules`, `_versions`, `_bodies` + `db:generate`. (2h)
4. **T-F2-04** Tablas `_runs`, `_run_items`, columnas en campañas + `db:generate`. (1.5h)
5. **T-F2-05** Extras de CHECKs y único parcial + test de integración de constraints. (1.5h)
6. **T-F2-06** Baseline `rolePermissions.seed.ts` + data-migration + tests; actualizar `role-acceptance.*`. (1.5h)
7. **T-F2-07** `computeSlots()` + tests AC-F2-4, 27. (2h)
8. **T-F2-08** Schemas Zod de plantilla, versión, cuerpo (validación de `blockKey` entre cuerpos) + tests. (2h)
9. **T-F2-09** `NewsletterScheduleService`: crear, versionar, activar/reanudar, recurrencia, duplicar + tests AC-F2-1..5. (2h)
10. **T-F2-10** `excludeScheduleId` en elegibilidad, por `resolveEligibleForCampaign` (alcanza también a `getAudienceEstimate`) + tests AC-F2-18, 19. (1.5h)
11. **T-F2-11** `send()` con UPDATE condicional + test de integración AC-F2-8. (1.5h)
12. **T-F2-12** Historial de dedup + tests AC-F2-16, 17. (1.5h)
13. **T-F2-13** `resolveRun` / `simulateRun` / `commitRun` / `executeRun` + unit AC-F2-12..15. (2h)
14. **T-F2-14** Test de integración simulación == real (AC-F2-21) y simular no escribe (AC-F2-22), más idioma faltante (AC-F2-28). (2h)
15. **T-F2-15** Tick: selección, missed, catch-up, claim, compare-and-set, claims viejos, `maxEditions` + unit AC-F2-9..11, 24, 25. (2h)
16. **T-F2-16** Test de integración de doble disparo AC-F2-7. (1.5h)
17. **T-F2-17** Job + manifest + registry + test del job. (1h)
18. **T-F2-18** Rutas admin de plantillas y versiones + tests AC-F2-26. (2h)
19. **T-F2-19** Rutas de runs, simulación, test-send, calendario + tests. (1.5h)
20. **T-F2-20** Admin: lista y formulario con editor por idioma y aviso de soft-cap. (2h)
21. **T-F2-21** Admin: detalle con historial, simulación por idioma y calendario. (2h)
22. **T-F2-22** Sidebar, tabs, i18n + e2e `schedule-auto-flow.spec.ts`. (1.5h)
