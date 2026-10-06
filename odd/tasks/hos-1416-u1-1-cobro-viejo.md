# HOS-1416 · U1.1 — Sacar el cobro viejo y su esquema (PR 1/6 de U1)

## Objetivo

Implementar la hoja HOS-1416 (clave de árbol `U1.1`, PR 1/6 de la pieza U1 de HOS-1352): dejar la
rama épica sin el sistema viejo de cobro (`@qazuor/qzpay`) y sin el esquema viejo de billing, con
typecheck y lint verdes (el comportamiento puede quedar roto: «lo que queda roto es el
comportamiento, no el build»).

## Problema y por qué

DEC-ARCH-014: los dos sistemas no conviven nunca; el viejo sale entero antes de construir el
nuevo, sin dejar código basura. Fuente única: spec consolidada
`10-corte/U1.md` (verificada spec→fuente con el brief de vuelta 3: **0 BLOQUEA, 2 MENOR** —
erratas de referencia en la spec misma, se corrigen en la rama de spec, no acá; reportadas al
owner). Hoja leída en Linear por API.

## Alcance autorizado (hoja)

- **AC:U1:1** — Ningún `package.json` ni import declara `@qazuor/qzpay*`; no quedan las rutas del
  cobro viejo (`apps/api/src/routes/billing/`, `apps/api/src/routes/webhooks/mercadopago/`), sus
  crons ni su adaptador (`packages/db/src/billing/drizzle-adapter.ts`).
- **AC:U1:2** — `packages/billing/src/config/` sale entero con lo que lo lee sólo para eso
  (`utils/config-drift-check.ts`, `validation/config-validator.ts`, seeders de planes); el esquema
  de las tablas viejas de billing sale generando la migración commiteada en el mismo cambio; las
  tres columnas de `accommodations` (`owner_suspended`, `plan_restricted`,
  `billing_unpublished_at`) sobreviven con sus lectores y sin escritores del cobro.

### Ediciones consecuentes (forzadas por los dos AC, mínimas)

- Todo archivo que importe símbolos borrados: se demuele si es del cobro; se reduce a lo no-billing
  si sobrevive (dirección spec: lote 1 A — gates de entitlement/limits fuera, cadena de permiso y
  propiedad queda; TEST:U1:15 de U1.4 lo verificará formalmente).
- Migración de datos del seed / seeders que importen `@repo/billing` o tablas del cobro: salen
  (formalmente AC:U1:7 de U1.4; forzado acá por el build de `packages/seed`).
- Extras del carril 2 que referencian tablas borradas: se retiran (forzado por
  `db:apply-extras` sobre base fresca). La FK/columna `customer_id` de
  `billing_notification_log` sale (forzado: su tabla referenciada se borra); la TABLA y su
  renombre quedan para U1.4 (lote 1 B).
- Guards y steps de CI que anclan archivos borrados: edición mínima. Env vars cuyo código lector
  muere: se retiran del registro si un guard exige simetría uso/registro.
- FK/columnas que sobreviven: `partners.starts_at`/`ends_at`/`tier` (V7), columnas de
  accommodations (V6), renombre de `billing_notification_log` (U1.4), seis columnas de pago de
  `partners`, `is_featured`/`featured_by_entitlement`, recreación de enums, G8, package del
  contrato: **NO en esta hoja**.

## Fuera de alcance

Ningún código del diseño nuevo. Ningún AC de hojas U1.2–U1.6 más allá de lo forzado arriba y
declarado. Sin merge, sin magic words en el PR.

## Restricciones

- TypeScript estricto, named exports, `import type`, sin `any`, ≤500 líneas/archivo.
- Commits: conventional, inglés, sin atribución IA, `git add` de rutas explícitas, `CI=true git
  commit`, commit inmediato tras cada staging.
- Migración estructural en carril 1 (`pnpm db:generate`), extras en carril 2.
- Gates: typecheck + lint (Biome) + tests de paquetes tocados, por filtro, con `CI=true`; CI del
  PR verde (`hops ci --wait`).

## Tests de la hoja

- **TEST:U1:1** (guard estático) — recorrido tipo G16(a): script `scripts/check-no-qzpay.sh`
  enchufado a `check:guards` y al job `guards` de `ci.yml`; falla si algún `package.json`/import
  declara `@qazuor/qzpay*` o si existen las rutas/crons/adaptador del cobro viejo. B1 lo retira
  cuando nazca G16.
- **TEST:U1:2** (migración desde cero) — `db:migrate` sobre base vacía: no crea ninguna tabla
  vieja de billing ni de qzpay; `accommodations` tiene sus tres columnas.
- **TEST:U1:3** (migración sobre datos) — sobre base con esquema y filas del sistema viejo, la
  migración saca las tablas viejas y conserva las tres columnas con sus datos.
- **TEST:U1:4 / TEST:U1:16** — smokes manuales etiquetados prod/staging; la spec dice que corren
  en las ventanas del corte, «no como gate de la pieza»: quedan pendientes para el corte, no en
  este PR.

## Modo TDD

Resuelto: **off** (Test-Informed Development del repo; sin strict TDD en config). Los TEST de la
hoja se escriben junto con la demolición; corrida con `CI=true`.

## Entrega

Un PR por hoja a `epic/HOS-1352-verticales-billing` (RUNBOOK; override del heuristic de 400
líneas). Título: `[HOS-1416] feat(billing)!: remove legacy qzpay billing system and schema`.
Sin `Closes`/magic words. Merge: owner.

## RDD / revisión

`gentle-ai review mode status` = on (global). El RUNBOOK asigna la revisión de la hoja a un
revisor externo con contexto limpio (paso 3 del ciclo) — esa es la revisión de este candidato;
no se lanza una transacción nativa paralela. Se registra `review assess` por work-unit commit
como evidencia de riesgo.

## Tareas

- [x] T1 — `packages/db`: de-qzpay de `client.ts`/`schema.ts`/`schemas/index.ts`
      (`qzpaySchema` fuera), borrar `src/billing/` (adaptador + barrel), borrar tablas viejas de
      billing de `src/schemas/billing/` (12 de 13; `billing_notification_log` queda sin FK/col
      `customer_id`), evaluar `partner_subscriptions` (lectores no-billing), generar migración
      carril 1, retirar extras que referencian tablas borradas, limpiar tests de `packages/db`,
      quitar deps qzpay de su `package.json`. Commit: `refactor(db): remove legacy qzpay billing schema and adapter`.
- [x] T2 — `packages/billing` (config/, adapters/, validation/, config-drift-check;
      index reducido a constants/predicates/types/money/resolve-reason) + `packages/service-core`
      (services/billing/ 55 archivos fuera; consumidores internos corregidos) + tests + package.json. Commit: `refactor(billing,service-core): remove legacy plan config and billing services`.
- [x] T3 — `packages/seed` (seeders de planes, data-migrations del cobro, helpers,
      test-users reducido al mínimo que compila y corre) + `apps/admin` (QZPayProvider, theme,
      billing-http-adapter, páginas de billing) + `apps/e2e` cleanup list + `scripts/server-tools`
      billing-test-reset. Commit: `refactor(seed,admin): remove legacy billing seeders and admin qzpay surface`.
- [x] T4 — `apps/api`: routes/billing + webhooks/mercadopago + test/qzpay-control +
      services/billing + servicios del cobro + middlewares (billing, billingCustomer, entitlement,
      owner-entitlement, limit/ai-quota...) + create-app/routes index + crons (22 jobs, registry,
      manifest) + rutas user/protected subscription & entitlements + listing change-plan + host
      dashboard + utils + tests. Commit: `refactor(api): remove legacy billing routes, webhooks, crons and middlewares`.
- [x] T5 — plomería del repo: 5 `package.json` + `pnpm-lock.yaml` (pnpm install),
      `pnpm-workspace.yaml` (líneas qzpay), `check:guards` + guard scripts que anclan archivos
      borrados + steps de `ci.yml`, `packages/config` env-registry (+contadores de test),
      endpoint-gate-matrix + inv1 guard test (ediciones forzadas), `scripts/check-no-qzpay.sh`
      (TEST:U1:1), tests de migración TEST:U1:2 y TEST:U1:3, gates completos por filtro con
      CI=true. Commit: `test(repo): add no-qzpay guard and legacy-schema migration tests`.

## Progreso y evidencia

- Verificación spec→fuente: 0 BLOQUEA / 2 MENOR (`/tmp/opencode/u1-vb-verification.txt`).
- Mapa del cobro viejo: reporte del mapper (resumido en las tareas T1–T5).
- Replay de migraciones DB: 7/7 tests de integración en verde.
- Rescate de API: 130/130 AI, 3/3 predicado canónico, 33/33 rutas enfocadas.
- Rescate de web: 107/107 tests enfocados; admin 2/2; notifications 31/31.
- Typecheck y lint por paquete completados en db, billing, service-core, api, admin, web, seed, config y notifications. El lint global de scripts señala errores de formato en archivos ajenos al cambio; los TS tocados pasan Biome.
- Pendiente: PR y `hops ci --wait`.

## Próximo paso

Abrir PR contra `epic/HOS-1352-verticales-billing`, publicar las decisiones transitorias y correr `hops ci --wait`.
