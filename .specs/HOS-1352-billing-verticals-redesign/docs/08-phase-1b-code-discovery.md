---
title: FASE 1B — discovery del sistema actual, sólo contra el código
linear: HOS-1352
statusSource: linear
created: 2026-09-16
updated: 2026-09-16
status: CURRENT
---

# FASE 1B — qué existe hoy

Inventario de lo que el sistema **hace hoy**, leído del código que corre.

No clasifica nada. `KEEP` / `ADAPT` / `REWRITE` es FASE 5 y tiene su propio gate
(`DEC-METH-003`): **ninguna fila de acá lleva un juicio**, ni siquiera implícito.

---

## Regla de fuentes — decisión del owner, 2026-09-16

**La única fuente admitida es el código.** Ni documentación del repo, ni specs, ni
engram, ni Linear, ni memoria de ningún agente. Palabras del owner: *«el resto puede
estar desactualizado o mentir, la única verdad ahora que tenemos es el código»*.

Esto **restringe** lo que el PDR habilitaba: la FASE 1B del §65 lista quince fuentes
—memory, Engram, issues, Linear, docs, specs, artifacts, source code, schema,
migrations, tests, Web, API, Admin, jobs, logs— y acá se usan **sólo las de código**.
Queda registrado como apartamiento deliberado, no como omisión.

El motivo es verificable, no una preferencia: el 2026-09-15 el commit `471a54b7a`
borró **94 archivos y 37.151 líneas** de documentación de billing, y en la misma
limpieza se retiraron 45 memorias locales, 149 observaciones de engram y 303 issues
`area-billing` pasados a `Canceled`. Lo que sobrevivió de esas fuentes sobrevivió
**por no haber sido alcanzado**, no por estar vigente.

### Qué cuenta como evidencia

1. **Nada entra por su nombre.** Ni un archivo, ni una función, ni una columna, ni un
   test. Toda afirmación se lee en la implementación y cita `archivo:línea`.
2. **Todo conjunto se cuenta antes de recorrerse.** Sin denominador, «exhaustivo» no
   se puede verificar ni desmentir. Cada carril declara su total medido y cuántos
   lleva cubiertos.
3. **Un patrón que no matchea no es una ausencia.** Es un patrón mal escrito hasta
   que se demuestre lo contrario. Ver `F-1B-003`, donde un glob dio tres denominadores
   distintos y los tres estaban mal.
4. **La base de datos real gana sobre el esquema declarado.** Lo que existe en
   producción es un hecho; lo que el TypeScript dice que existe es una afirmación.
5. **Un hallazgo que contradice una decisión no toca el decision log.** Se anota acá
   y se le presenta al owner con el costo de cambiarla y el de no cambiarla.

### Ancla

Todo lo de este documento está medido sobre **`60a39dae2`** (2026-09-11 13:52 `-03`),
que al 2026-09-16 es la punta de `origin/staging` **y** el contenido de `origin/main`:
`git diff origin/main HEAD` fuera de `.specs/` da 48 `.md` y 2 `.json`, **cero
archivos de código**. Lo que se lee acá es lo que corre en producción.

Si `staging` se mueve, las mediciones no se actualizan solas: se re-miden o se marcan
caducas.

---

## Censo — los denominadores

Ningún número de esta tabla sale de un glob de nombres de archivo sin haber sido
verificado contra la definición real.

| Conjunto | Total medido | Cómo se midió | Cubierto |
|---|---|---|---|
| Tablas en producción | **174** | `information_schema.tables` en prod | 174 |
| Tablas con schema Drizzle en el repo | **147** | `pgTable(` multilínea en `packages/db/src` | 147 |
| Tablas sin schema en el repo | **27** | diferencia de los dos anteriores | 27 |
| `pgEnum` declarados | **90** | `pgEnum(` multilínea | 0 |
| Cron jobs registrados | **47** | el arreglo `cronJobs` de `registry.ts` | 0 |
| Migraciones estructurales | 125 | `packages/db/src/migrations/*.sql` | 0 |
| Migraciones `extras` | 42 | `migrations/extras/*.sql` | 0 |
| Data-migrations de seed | 121 | `packages/seed/src/data-migrations/*.ts` | 0 |
| Archivos de ruta de la API | 1150 | `apps/api/src/routes/**/*.ts` — **denominador provisorio**, son archivos y no endpoints registrados | 0 |
| Servicios en `service-core` | 101 | `*.service.ts` — **provisorio**, ver `F-1B-003` | 0 |
| Archivos que mencionan conceptos de billing | 4251 (2658 sin tests) | `rg -l` sobre `apps` y `packages` | — |

Los marcados **provisorio** están medidos por nombre de archivo y por lo tanto no
cumplen la regla 1: hay que reemplazarlos por el conteo de lo que realmente se
registra. `F-1B-003` es la razón.

---

## Hallazgos

### F-1B-001 — El núcleo de billing no tiene schema en este repo

**27 de las 174 tablas de producción no tienen ninguna definición Drizzle en
`packages/db/src`.** Las 27 son `billing_*`, y entre ellas está todo el núcleo:

```
billing_plans            billing_subscriptions    billing_customers
billing_payments         billing_invoices         billing_invoice_lines
billing_invoice_payments billing_refunds          billing_prices
billing_entitlements     billing_limits           billing_customer_entitlements
billing_customer_limits  billing_addons           billing_subscription_addons
billing_promo_codes      billing_promo_code_usage billing_usage_records
billing_checkouts        billing_payment_methods  billing_idempotency_keys
billing_webhook_events   billing_webhook_dead_letter
billing_audit_logs       billing_vendors          billing_vendor_payouts
billing_subscription_polling_jobs
```

Las crean las migraciones **de este repo** (`0000_baseline.sql` en adelante), pero sus
definiciones Drizzle viven en **`@qazuor/qzpay-drizzle`** (`^4.0.0`, declarado en
`packages/db/package.json:57`). O sea: el repo es dueño del **DDL** y no del
**modelo**.

En la otra dirección el resultado es limpio: **cero** tablas declaradas en el repo que
no existan en producción. El esquema del repo es un subconjunto estricto de la base
real.

*Medición*: `information_schema.tables` sobre prod vía `hops --target=prod psql`
(174), contra `pgTable(` multilínea sobre `packages/db/src` (147), 2026-09-16.

*Qué abre, sin resolverlo acá*: el §9 exige que toda configuración comercial salga de
la DB y el §7 exige un único motor genérico. Los dos aterrizan sobre tablas cuyo
modelo lo define un paquete externo, con su propio versionado.

---

### F-1B-002 — `entity_subscriptions` nunca se creó: llegó por rename

Es la única tabla declarada en el repo que ningún `CREATE TABLE` produce. No es un
hueco: `packages/db/src/migrations/0114_entity_subscriptions_rename.sql:1` hace
`ALTER TABLE "commerce_listing_subscriptions" RENAME TO "entity_subscriptions"`, y en
la misma migración le suelta el `NOT NULL` a `subscription_id` (línea 8) y le agrega
`plan_id varchar(255)` (línea 9).

La tabla original la creó `0017_acoustic_dust.sql:37`, con un índice único
`commerce_listing_subs_entity_uniq` sobre `(entity_type, entity_id)`
(`0017_acoustic_dust.sql:166`).

*Por qué está anotado*: cualquier censo que cruce «tablas creadas» contra «tablas
declaradas» va a reportar esta fila como discrepancia en las dos direcciones. No lo
es.

---

### F-1B-003 — Los cron jobs son 47, y los tres conteos por nombre de archivo daban mal

**El registro es `cronJobs` en `apps/api/src/cron/registry.ts:62-119`: 47 entradas.**
Los 47 símbolos importados (`registry.ts:8-54`) coinciden exactamente con los 47 del
arreglo — cero importados sin registrar, cero registrados sin importar.

Los denominadores por nombre de archivo daban **53**, **44** y **44 huérfanos de 44**,
y los tres estaban mal:

- `fd . apps/api/src/cron/jobs` → **53**, porque cuenta tests y archivos auxiliares.
- `fd -g '*.job.ts'` → **44**, porque **tres jobs no usan ese sufijo**:
  `apps/api/src/cron/jobs/trial-expiry.ts`,
  `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` y
  `apps/api/src/cron/jobs/finalize-cancelled-subs.ts`.
- «44 huérfanos de 44» salió de buscar los imports por ruta, cuando el registro importa
  de un barrel (`./jobs/index.js`, `registry.ts:55`).

**Los 47 están habilitados.** `getEnabledCronJobs` filtra por `job.enabled`
(`registry.ts:151`), `enabled` es obligatorio en el tipo (`types.ts:83`) y los 47 lo
declaran en `true` — ninguno en `false`. No hay ningún job apagado en silencio.

*Por qué está anotado como hallazgo y no como nota de método*: es el caso que fija la
regla 3. Tres mediciones plausibles, tres resultados distintos, y ninguna lo
suficientemente equivocada como para delatarse sola.

---

## Carriles pendientes

Ninguno empezado. El orden no está decidido.

| Carril | Denominador | Estado |
|---|---|---|
| Esquema: columnas, constraints, índices y triggers de las 174 | por medir | ⬜ |
| Los 90 `pgEnum` y su correspondencia con los enums de `@repo/schemas` | 90 | ⬜ |
| Los 47 cron jobs: qué hace cada uno, leído del handler | 47 | ⬜ |
| Endpoints registrados de la API por tier (`public` / `protected` / `admin`) | por medir | ⬜ |
| Servicios: métodos públicos y qué validan | por medir | ⬜ |
| Entitlements y limits: claves existentes y dónde se consumen | por medir | ⬜ |
| Superficies Web | por medir | ⬜ |
| Superficies Admin | por medir | ⬜ |
| Las 125 + 42 + 121 migraciones: qué quedó aplicado y qué quedó muerto | 288 | ⬜ |
| Tests: qué comportamiento afirman (como evidencia de intención, no de corrección) | por medir | ⬜ |
| `@qazuor/qzpay-*`: qué del núcleo vive fuera del repo | por medir | ⬜ |
