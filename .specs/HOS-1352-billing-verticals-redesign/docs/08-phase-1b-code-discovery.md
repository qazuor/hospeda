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

### Qué código — son DOS repos, y qzpay es nuestro

El relevamiento cubre **hospeda y `qzpay`** (`/home/qazuor/projects/PACKAGES/qzpay`).
Decisión del owner, 2026-09-16: *«es nuestro, incluilo en todo el relevamiento, ya que
también lo incluiremos en el refactor/código a escribir nuevo»*. qzpay **no** es una
dependencia de terceros que haya que rodear: es superficie reescribible como cualquier
otra.

### Anclas

| Repo | Ancla | Por qué ésa |
|---|---|---|
| hospeda | **`60a39dae2`** (2026-09-11 13:52 `-03`) | es la punta de `origin/staging` **y** el contenido de `origin/main`: `git diff origin/main HEAD` fuera de `.specs/` da 48 `.md` y 2 `.json`, **cero archivos de código** |
| qzpay | **`c934164`** = `origin/main` (2026-09-09 03:46 `-03`) | es el único punto donde las versiones coinciden con las que hospeda tiene instaladas — ver `F-1B-004` |

**En los dos casos el ancla es el ref remoto, no el working tree.** El checkout local
de qzpay está en otra branch y tres commits atrás; leerlo habría descrito código que no
corre. Se lee desde un worktree detached en `c934164`, sin tocar la branch del owner.

Si cualquiera de los dos refs se mueve, las mediciones no se actualizan solas: se
re-miden o se marcan caducas.

---

## Censo — los denominadores

Ningún número de esta tabla sale de un glob de nombres de archivo sin haber sido
verificado contra la definición real.

| Conjunto | Total medido | Cómo se midió | Cubierto |
|---|---|---|---|
| Tablas en producción | **174** | `information_schema.tables` en prod | 174 |
| … con schema Drizzle en **hospeda** | **147** | `pgTable(` multilínea en `packages/db/src` | 147 |
| … con schema Drizzle en **qzpay** | **27** | `pgTable(` multilínea en `packages/drizzle/src` | 27 |
| … sin schema en ningún lado | **0** | los dos conjuntos anteriores, cruzados | — |
| Paquetes publicables de qzpay | **9** | `packages/*/package.json` | 9 |
| … que hospeda importa | **5** | `@qazuor/qzpay-*` en el código, no en el `package.json` | 5 |
| `pgEnum` declarados en hospeda | **90** | `pgEnum(` multilínea, cruzado con `pg_type` en prod | **90** |
| Columnas en producción | **2.423** | `information_schema.columns` | 2.423 |
| Claves foráneas | **399** | `pg_constraint` con `contype='f'` | **399** |
| Índices | **836** | `pg_index` por catálogo — **no** por nombre, que da 160 PK en vez de 174 | **836** |
| Triggers no internos | **132** | `pg_trigger` sin `tgisinternal` | **132** |
| `CHECK` reales | **30** | `pg_constraint` con `contype='c'` — **no** `information_schema`, que dice 1.403 | **30** |
| Cron jobs registrados | **47** | el arreglo `cronJobs` de `registry.ts` | **47** horario · **47** partición · **47 de 47** handlers leídos (17 de billing + 30 fuera) |
| Migraciones estructurales | **125** | archivos, cruzados con `drizzle.__drizzle_migrations` en prod | **125** |
| Migraciones `extras` | **42** | `migrations/extras/*.sql`, inventariadas por sentencia | **42** |
| Data-migrations de seed | **105** | prefijo `NNNN-`, cruzado con `seed_migrations` en prod — **no** `fd -e ts`, que da 121 | **105** |
| **Handlers de la API** | **1.032** | `app.routes` con la app construida, menos 725 middleware — **no** los 1.150 archivos | **1.032** |
| … documentados en OpenAPI | **983** | el documento generado por la app | **983** |
| Clases exportadas en `service-core` | **126** | `export class`, no `*.service.ts` (que da 101) | **126** |
| … que extienden una base de servicio | **67** | 39 `BaseCrudService` + 19 `BaseService` + 6 related + 2 commerce | **67** |
| Archivos de billing en `apps/api/src/services` | **140** de 185 | `rg -l` por vocabulario de dominio | **140** |
| Archivos que mencionan conceptos de billing | 4251 (2658 sin tests) | `rg -l` sobre `apps` y `packages` | — |

Los marcados **provisorio** están medidos por nombre de archivo y por lo tanto no
cumplen la regla 1: hay que reemplazarlos por el conteo de lo que realmente se
registra. `F-1B-003` es la razón.

---

## Hallazgos

### F-1B-001 — El núcleo de billing vive en qzpay, y el censo de tablas cierra exacto

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

Las crean las migraciones **de hospeda** (`0000_baseline.sql` en adelante), y sus
definiciones Drizzle viven en **`qzpay/packages/drizzle/src`**. O sea: hospeda es dueño
del **DDL** y qzpay del **modelo**, sobre las mismas 27 tablas.

**El censo cierra sin residuo**, y las tres direcciones se verificaron por separado:

- qzpay define **exactamente 27** tablas (27 ocurrencias de `pgTable(`, 27 nombres
  únicos), y son **el mismo conjunto** que le falta a hospeda — no sólo la misma
  cantidad: los conjuntos son idénticos, comparados fila por fila.
- Las 27 de qzpay **están todas en producción**. Ninguna declarada de más.
- Cero tablas declaradas en hospeda que no existan en producción.

**174 = 147 + 27.** Ninguna tabla de producción queda sin dueño y ningún dueño declara
una tabla que no exista.

*Medición*: `information_schema.tables` sobre prod vía `hops --target=prod psql` (174),
contra `pgTable(` multilínea sobre `hospeda/packages/db/src` (147) y sobre
`qzpay/packages/drizzle/src` en `c934164` (27). 2026-09-16.

*Qué abre, sin resolverlo acá*: el §9 exige que toda configuración comercial salga de
la DB y el §7 exige un único motor genérico. Los dos aterrizan sobre tablas cuyo modelo
vive en el otro repo — que es reescribible, pero tiene versionado propio, se publica a
un registro y tiene otros consumidores potenciales (`stripe`, `nestjs`, `react`,
`hono`, `cli`) que hospeda no usa.

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

### F-1B-004 — El checkout local de qzpay no es el código que corre

El working tree de `/home/qazuor/projects/PACKAGES/qzpay` está en la branch
`feat/drop-product-domain-default`, en `7240dca`, **tres commits detrás de
`origin/main`**. Y las versiones que declara **no** son las que hospeda tiene
instaladas:

| paquete | checkout local | `origin/main` | instalado en hospeda |
|---|---|---|---|
| `qzpay-core` | 6.0.0 | **7.0.0** | **7.0.0** |
| `qzpay-drizzle` | 3.0.0 | **4.0.0** | **4.0.0** |
| `qzpay-mercadopago` | 2.11.1 | **2.11.2** | **2.11.2** |

En `core` y en `drizzle` la diferencia es **un major**, y el commit del working tree es
`feat(core,drizzle)!: require a productDomain when creating a plan` — un breaking change.
Relevar el working tree habría descrito una API que producción no tiene.

`origin/main` (`c934164`) coincide exactamente con lo instalado en los tres paquetes, y
por eso es el ancla. Las versiones instaladas salen de `pnpm-lock.yaml` de hospeda, no
de los rangos `^` del `package.json`, que no dicen qué se resolvió.

*Por qué está anotado*: es la misma trampa que la del working tree de hospeda, en otro
repo. Una afirmación sobre el código que corre se verifica contra el ref remoto.

---

### F-1B-005 — Hospeda usa 5 de los 9 paquetes de qzpay; 4 no tienen una sola referencia

Medido por los `import` del código, no por los `package.json`:

| paquete | versión | archivos `src` | líneas | tests | lo importa hospeda |
|---|---|---|---|---|---|
| `core` | 7.0.0 | 89 | 22.120 | 26 | **sí** (112 referencias) |
| `drizzle` | 4.0.0 | 68 | 14.762 | 46 | **sí** (52) |
| `mercadopago` | 2.11.2 | 16 | 4.160 | 15 | **sí** (39) |
| `hono` | 2.0.1 | 22 | 4.137 | 13 | **sí** (22) |
| `react` | 2.0.1 | 28 | 4.869 | 21 | **sí** (10) |
| `stripe` | 1.3.11 | 19 | 3.309 | 13 | no |
| `nestjs` | 2.0.1 | 36 | 2.507 | 15 | no |
| `cli` | 1.1.0 | 21 | 3.142 | 13 | no |
| `dev` | 1.4.7 | 9 | 3.039 | 8 | no |

**Los cinco están declarados donde se usan** — `apps/api` (core, hono, mercadopago),
`apps/admin` (core, react), `packages/db` (core, drizzle), `packages/billing` (core,
mercadopago), `packages/service-core` (core). Cero dependencias fantasma.

`stripe`, `nestjs`, `cli` y `dev` no tienen **ninguna** referencia en hospeda.

Una aclaración de método que casi produce un hallazgo falso: `packages/schemas` aparece
en una búsqueda de `@qazuor/qzpay-hono` y **no declara** ninguna dependencia de qzpay.
No es una dependencia fantasma: la coincidencia está en un **comentario**
(`packages/schemas/src/api/billing/admin-billing-view.schema.ts:7`), no en un import.

Ese comentario deja además una **pista a verificar, que todavía no es un hallazgo**:
afirma que qzpay y hospeda usan vocabularios distintos para el mismo hecho
(`succeeded`/`canceled` contra el de hospeda), que el camino del webhook normaliza con
`QZPAY_TO_HOSPEDA_STATUS` y que **el camino del cancel de admin escribe la grafía de
qzpay sin normalizar**. Es prosa dentro del código, o sea exactamente lo que la regla 1
no admite: hay que leerlo en la implementación antes de anotarlo.

---

### F-1B-006 — El esquema de producción, medido

Todo contra `information_schema` y `pg_catalog` en producción, 2026-09-16.

| | Total | hospeda (147 tablas) | qzpay (27 tablas) |
|---|---|---|---|
| Columnas | **2.423** | 2.028 | 395 |
| Claves primarias | **174** | — | — |
| Claves foráneas | **399** | — | — |
| `UNIQUE` | **39** | — | — |
| `CHECK` reales | **30** | 24 | 6 |
| Índices | **836** | — | — |
| Triggers no internos | **132** | — | — |
| Tipos `enum` | **90** | 90 | **0** |
| Vistas materializadas | **1** | — | — |

**Una trampa que cambia el número por cuarenta y seis veces.**
`information_schema.table_constraints` reporta **1.403** `CHECK`, y son **30**. Postgres
sintetiza una fila `CHECK` por cada columna `NOT NULL`, así que ese conteo mezcla dos
cosas distintas. Los `CHECK` reales salen de `pg_constraint` con `contype='c'`.

La aritmética cierra y por eso la explicación no es una hipótesis: hay **1.373** columnas
`NOT NULL` en producción, y **1.373 + 30 = 1.403**.

---

### F-1B-007 — Las dos mitades del esquema modelan los estados de forma incompatible

| | hospeda (147 tablas) | qzpay (27 tablas) |
|---|---|---|
| Tipos `enum` declarados | **90** | **0** |
| Columnas de tipo `enum` | **166** | **0** |
| `CHECK` reales | 24 | 6, **todos en una sola tabla** |

Los 90 tipos `enum` de producción son **exactamente** los 90 que declara
`hospeda/packages/db/src` — conjuntos idénticos, comparados por nombre. qzpay no declara
ni uno.

**Las diez columnas `status` de qzpay son `varchar` sin ninguna restricción.** Medido una
por una: `billing_subscriptions`, `billing_payments`, `billing_invoices`,
`billing_refunds`, `billing_checkouts`, `billing_payment_methods`,
`billing_subscription_addons`, `billing_webhook_events`, `billing_vendor_payouts` y
`billing_subscription_polling_jobs` son `character varying(50)` o `(20)`, y **cero** de
ellas tiene un `CHECK` que mencione `status`. La base acepta cualquier cadena que entre
en el largo.

Los 6 `CHECK` de qzpay están **todos sobre `billing_promo_codes`**: el dominio de
`effect_kind`, el de `value_kind`, y tres de forma por `effect_kind`. Ninguna otra tabla
de esa mitad tiene una sola restricción de dominio.

*Qué abre, sin resolverlo acá*: el §63 pide modelar explícitamente los estados y las
transiciones de Trial, Subscription, Payment, Manual Payment, Addon, Publication, Grace y
Pause. Del lado de hospeda hay 90 enums en la base; del lado donde viven Subscription y
Payment **no hay nada** que impida escribir un estado inexistente.

---

### F-1B-008 — Hospeda escribe restricciones dentro de tablas que modela qzpay

Los 6 `CHECK` de `billing_promo_codes` **no los define qzpay**: no hay una sola
coincidencia de `effect_kind_domain_chk` ni de `comp_shape_chk` en todo el repo de qzpay
en `c934164`. Los define **hospeda**, en
`packages/db/src/migrations/extras/020-promo-code-effect-constraints-backfill.sql`.

O sea que el acoplamiento entre los dos repos no va en una sola dirección: hospeda no
sólo crea el DDL de las 27 tablas, también les agrega restricciones de dominio por el
carril `extras`, que qzpay no conoce.

---

### F-1B-009 — El volumen real de la mitad de billing

De las **27** tablas de qzpay, **12 tienen filas** y **15 están completamente vacías**.

| tabla | filas |
|---|---|
| `billing_webhook_events` | **224** |
| `billing_webhook_dead_letter` | **75** |
| `billing_entitlements` | **53** |
| `billing_prices` | **30** |
| `billing_plans` | 20 |
| `billing_limits` | **20** |
| `billing_customers` | 19 |
| `billing_addons` | **15** |
| `billing_subscriptions` | **8** |
| `billing_idempotency_keys` | 6 |
| `billing_promo_codes` | 5 |
| `billing_promo_code_usage` | 4 |

> ⚠️ **Corregido el 2026-09-16.** La primera versión de esta tabla salió de
> `pg_stat_user_tables.n_live_tup` y **subestimaba seis filas**: decía 14
> entitlements donde hay 53, 3 limits donde hay 20, 10 precios donde hay 30, 9 addons
> donde hay 15, y 206/63 webhooks donde hay 224/75. `n_live_tup` es una estimación del
> planificador, no un conteo. Los números de arriba son `count(*)` sobre las 27, en una
> sola consulta. **El reparto vacías/no vacías no cambió**: siguen siendo 12 y 15.

**`billing_payments`, `billing_invoices`, `billing_refunds` y `billing_checkouts` tienen
cero filas**, contadas con `count(*)`.

Las 8 suscripciones se reparten en **3 `trialing`, 3 `abandoned` y 2 `comp`**. No hay
ninguna `active`.

*Por qué importa para el relevamiento y no sólo para la migración*: **75 entradas en
`billing_webhook_dead_letter` contra 224 eventos** es un tercio de los eventos en la cola
de fallidos, y **15 de las 27 tablas nunca recibieron una fila**. Una tabla vacía no dice
si su código funciona.

---

### F-1B-010 — Ninguna tabla de qzpay referencia a hospeda: la dependencia es de una sola mano

Las **399** claves foráneas de producción, repartidas por la frontera:

| dirección | cantidad |
|---|---|
| hospeda → hospeda | 358 |
| qzpay → qzpay | 22 |
| **hospeda → qzpay** | **19** |
| **qzpay → hospeda** | **0** |

**Cero en esa última fila.** El esquema de qzpay es cerrado sobre sí mismo: ninguna de
sus 27 tablas apunta a una de las 147 de hospeda. Toda la dependencia va en la otra
dirección, y son 19 columnas.

**Las 19, completas:**

| desde (hospeda) | columna | hacia (qzpay) | `ON DELETE` |
|---|---|---|---|
| `billing_addon_purchases` | `addon_id` | `billing_addons` | `SET NULL` |
| `billing_mp_addon_plans` | `addon_id` | `billing_addons` | `CASCADE` |
| `billing_addon_purchases` | `customer_id` | `billing_customers` | `RESTRICT` |
| `billing_dunning_attempts` | `customer_id` | `billing_customers` | `RESTRICT` |
| `billing_notification_log` | `customer_id` | `billing_customers` | `SET NULL` |
| `billing_pending_checkouts` | `customer_id` | `billing_customers` | `CASCADE` |
| `billing_mp_plans` | `commercial_plan_id` | `billing_plans` | `CASCADE` |
| `billing_plan_price_changes` | `plan_id` | `billing_plans` | `CASCADE` |
| **`partners`** | `plan_id` | `billing_plans` | `SET NULL` |
| `billing_plan_price_changes` | `price_id` | `billing_prices` | `CASCADE` |
| `billing_addon_purchases` | `subscription_id` | `billing_subscriptions` | `SET NULL` |
| `billing_dunning_attempts` | `subscription_id` | `billing_subscriptions` | `SET NULL` |
| `billing_pending_checkouts` | `local_subscription_id` | `billing_subscriptions` | `CASCADE` |
| `billing_plan_price_change_notices` | `subscription_id` | `billing_subscriptions` | `CASCADE` |
| `billing_plan_price_change_targets` | `subscription_id` | `billing_subscriptions` | `CASCADE` |
| `billing_subscription_events` | `subscription_id` | `billing_subscriptions` | `CASCADE` |
| **`entity_subscriptions`** | `subscription_id` | `billing_subscriptions` | `CASCADE` |
| **`partner_subscriptions`** | `subscription_id` | `billing_subscriptions` | `CASCADE` |
| **`partners`** | `subscription_id` | `billing_subscriptions` | `SET NULL` |

Cuatro cosas que salen de leer la tabla y no de suponerla:

1. **Sólo 5 de las 27 tablas de qzpay tienen algún referente en hospeda**:
   `billing_subscriptions` (9 de las 19), `billing_customers` (4), `billing_plans` (3),
   `billing_addons` (2) y `billing_prices` (1). **Las otras 22 no las referencia nadie
   desde este lado.**
2. **Casi toda la frontera la cruzan tablas `billing_*` propias de hospeda.** Las únicas
   tres excepciones son `partners` (dos columnas), `partner_subscriptions` y
   `entity_subscriptions`. O sea: el resto del dominio —alojamientos, destinos,
   usuarios, gastronomía, experiencias— **no toca las tablas de qzpay por clave
   foránea**.
3. **Los tres comportamientos de borrado conviven**: 11 `CASCADE`, 6 `SET NULL`,
   2 `RESTRICT`.
4. **`billing_addon_purchases` y `billing_dunning_attempts` tratan distinto al cliente
   y a la suscripción**: `RESTRICT` sobre `billing_customers` y `SET NULL` sobre
   `billing_subscriptions`. Borrar una suscripción deja la fila con el vínculo en nulo;
   borrar un cliente está bloqueado.

*Qué abre, sin resolverlo acá*: la separabilidad de los dos repos es una propiedad
**medida**, no una aspiración — 19 columnas en una sola dirección, concentradas en 5
tablas destino.

---

### F-1B-011 — Toda la base tiene DOS funciones de trigger, y una tabla quedó con el trigger duplicado por un rename

Los **132** triggers no internos invocan **exactamente dos** funciones:

| función | triggers | tablas |
|---|---|---|
| `set_updated_at` | **122** | 121 |
| `delete_entity_bookmarks` | **10** | 5 |

Repartidos: 119 sobre tablas de hospeda, **13 sobre tablas de qzpay**. O sea que el
carril `extras` de hospeda también le pone triggers a las tablas que modela qzpay — es
el mismo patrón de `F-1B-008`, en otra forma.

**La cobertura de `updated_at` es completa, verificada por la negativa.** Hay **121**
tablas con columna `updated_at` y **cero** que la tengan sin su trigger. Las 53
restantes (174 − 121) simplemente no tienen la columna. No hay ninguna tabla con un
`updated_at` que nadie actualice.

**La anomalía está en `entity_subscriptions`: tiene DOS triggers `set_updated_at`.**

```
trg_set_updated_at_commerce_listing_subscriptions
trg_set_updated_at_entity_subscriptions
```

El primero sobrevivió al rename de `F-1B-002` —Postgres renombra la tabla y deja el
trigger con su nombre viejo— y después se creó el segundo. La función se ejecuta dos
veces por cada fila modificada. Es idempotente, así que el resultado no cambia; lo que
queda es un resto del rename que nadie retiró.

Es la única tabla de las 174 con un trigger duplicado.

---

### F-1B-012 — Los 836 índices, y 77 restricciones de unicidad que no son constraints

Clasificados por catálogo (`pg_index.indisprimary` / `indisunique`), **no por el nombre
del índice**:

| tipo | cantidad |
|---|---|
| Clave primaria | **174** |
| Único | **116** |
| Normal | **546** |

Y por mitad: **705** sobre tablas de hospeda, **131** sobre las de qzpay.

**Clasificar por nombre da 160 claves primarias en vez de 174.** Catorce PK no se llaman
`*_pkey`: son las compuestas de las tablas de relación (`r_accommodation_amenity`,
`r_entity_tag`, `role_permission`, `user_role`, `user_permission`, …), que Drizzle nombra
`*_pk`. Es la regla 3 otra vez: el patrón fallaba, no la base.

**De los 116 índices únicos, sólo 39 respaldan una `constraint UNIQUE`; los otros 77 son
índices únicos sueltos.** La diferencia no es cosmética: un índice único impone la misma
unicidad, pero no aparece como constraint en `information_schema.table_constraints`, así
que cualquier inventario de restricciones que mire sólo ahí va a contar **39** donde hay
**116**.

Además hay **46 índices parciales** (con cláusula `WHERE`) y **21 de expresión**. Los
parciales son restricciones condicionales —unicidad que vale sólo para ciertas filas— y
no se leen en ningún lado salvo en el `indexdef`.

---

### F-1B-013 — El documento OpenAPI de la API no existe en ningún entorno desplegado

`GET /docs/openapi.json` devuelve **404 en producción y 404 en staging**, con el cuerpo
de error propio de la API (`{"success":false,"error":{"code":"NOT_FOUND"}}`), o sea que
la ruta no está registrada, no que el documento falle al generarse.

La causa está en `apps/api/src/app.ts:19-21`:

```ts
// Configure OpenAPI AFTER all routes are registered (only in non-production)
if (env.NODE_ENV !== 'production') {
    configureOpenAPI(app);
}
```

Y **los dos entornos corren `NODE_ENV=production`**, medido sobre Coolify, no supuesto:
`hops --target=staging env-list api --reveal --match '^NODE_ENV$'` y su equivalente en
prod devuelven `NODE_ENV=production` los dos. (De paso: la app `api` tiene **112**
variables de entorno configuradas en cada slot.)

Consecuencia para el relevamiento: **el contrato de la API no se puede obtener del
sistema que corre**. Con él caen también `/reference` (Scalar), `/docs/ui` (Swagger) y
`/docs`, que cuelgan del mismo `configureOpenAPI`.

Consecuencia de producto, anotada sin juzgarla: un consumidor externo —o un agente— no
tiene forma de descubrir la API desde el entorno real.

**Por eso el denominador de endpoints sigue abierto.** Contar por patrón no sirve: hay
**24** factories `create*Route*` distintas en `apps/api/src`, con dos estilos de
declaración (`export function` y `export const`), y los conteos por nombre dan cero para
seis de ellas — el mismo modo de falla de `F-1B-003`. La medición correcta es construir
la app y leer `app.routes`, que es exactamente lo que hace `listRoutes`
(`apps/api/src/utils/list-routes.ts`, invocado en `apps/api/src/index.ts:379`).

---

### F-1B-014 — Cuatro de los 42 `extras` mueven datos, y trece escriben sobre tablas de qzpay

Qué contienen realmente los **42** archivos de `packages/db/src/migrations/extras/`,
contado por sentencia y no por palabra suelta:

| sentencia | cantidad |
|---|---|
| `ADD CONSTRAINT` | 38 |
| `ALTER TABLE` | 36 |
| `CREATE UNIQUE INDEX` | 29 |
| `CREATE INDEX` | 14 |
| `CREATE TRIGGER` | 12 · `DROP TRIGGER` 11 |
| `CREATE OR REPLACE FUNCTION` | 6 |
| `INSERT INTO` | **6**, en **4 archivos** |
| `UPDATE … SET` | **6**, en **1 archivo** |
| `CREATE MATERIALIZED VIEW` | 2 |

**Cuatro archivos hacen cambios de datos**, y lo dicen en su propio nombre:

```
013-moderation-role-grants.data.sql
019-accommodation-media-backfill.data-migration.sql
027-social-post-target-media-backfill.data-migration.sql
028-vip-promotions-access-repair.data.sql
```

Es un hecho del inventario, no un juicio: el repo tiene **además** un directorio
`packages/seed/src/data-migrations/` con **121** módulos numerados, o sea dos lugares
distintos donde vive una migración de datos.

**Trece de los 42 tocan tablas que modela qzpay** — la tercera forma del mismo
acoplamiento de una sola mano que ya aparece en `F-1B-008` (constraints) y `F-1B-011`
(triggers).

**Dos mediciones que hubo que rehacer, las dos por la regla 3.** Buscar `UPDATE`
sin anclar da **60** ocurrencias y son **6**: la palabra está dentro de `updated_at`,
que aparece en casi todos los archivos. Y `ON UPDATE` —el sospechoso obvio, el de las
claves foráneas— aparece **una sola vez** y no era la causa. La hipótesis plausible y
la causa real no coincidieron.

---

### F-1B-015 — Los tres carriles de migración están al día en producción, y sólo dos llevan registro

En la base de producción existen **exactamente dos** tablas de ledger:
`drizzle.__drizzle_migrations` y `public.seed_migrations`.

| carril | en el repo | aplicadas en prod | pendientes |
|---|---|---|---|
| Estructural (`packages/db/src/migrations/*.sql`) | **125** | **125** | **0** |
| Datos de seed (`packages/seed/src/data-migrations/NNNN-*.ts`) | **105** | **105** | **0** |
| `extras` (`migrations/extras/*.sql`) | 42 | **sin ledger** | no aplica |

**El carril `extras` no deja registro de qué se aplicó.** No hay tabla que lo lleve: se
re-aplica entero y se apoya en que cada archivo sea idempotente. Consecuencia directa:
para los otros dos carriles existe una respuesta a *«¿esto está aplicado acá?»*, y para
los 42 `extras` **no existe** — sólo se puede inferir mirando si el objeto que crean
está presente.

**Otro denominador por nombre de archivo que estaba mal.** `fd -e ts` sobre
`data-migrations/` da **121**, y las migraciones son **105**: los otros 16 archivos son
la infraestructura del runner (`ledger.ts`, `discover.ts`, `context.ts`,
`fkGuard.ts`, `columnDependencyGuard.ts`, `safeDelete.ts`, `baselineStamp.ts`,
`billingCleanupGuards.ts`, `trialPlanMigration.ts`, …). Filtrando por el prefijo
`NNNN-` el conteo da 105, que es **exactamente** lo que el ledger de producción
reporta.

Es la tercera vez que un conteo por nombre de archivo da mal (`F-1B-003`, `F-1B-012`,
ésta). Las tres veces el error estuvo del lado del patrón.

---

### F-1B-016 — La API expone 1.032 handlers, y 52 no están en su propio contrato

Medido **construyendo la app** (`initApp()`, sin base de datos) y leyendo `app.routes` y
el documento OpenAPI, no contando archivos. Sonda descartable, no commiteada.

| | |
|---|---|
| Entradas en `app.routes` | 4.574 (1.757 únicas) |
| … de las cuales middleware (`ALL`) | **725** |
| **Handlers reales** | **1.032** |
| Operaciones en el documento OpenAPI | **983**, sobre **740** paths |

**Por tier** — y el reparto es el hallazgo:

| tier | operaciones |
|---|---|
| `/api/v1/admin/` | **557** (57%) |
| `/api/v1/protected/` | 299 |
| `/api/v1/public/` | **115** |
| `/api/v1/ai/` | 3 |
| otros | 9 |

Por método: 429 `GET`, 271 `POST`, 118 `DELETE`, 95 `PATCH`, 70 `PUT`.

**Los 52 handlers que no aparecen en el documento**, por prefijo:

| | |
|---|---|
| `/api/v1/protected/conversations` | 10 |
| **`/api/v1/protected/billing`** | **9** |
| `/api/v1/admin/conversations` | 7 |
| `/api/v1/public/conversations` | 5 |
| `/api/v1/admin/ai` | 4 |
| `/api/auth/*` | 6 |
| resto (accommodations, newsletter, alliance, commerce, webhooks, docs) | 11 |

**Los 9 de billing son rutas prefabricadas de qzpay.**
`apps/api/src/routes/billing/index.ts:26` importa `createBillingRoutes` de
`@qazuor/qzpay-hono` y las monta en `/api/v1/protected/billing`
(`apps/api/src/routes/index.ts:776`). Se registran sobre un router Hono común, no por la
factory con OpenAPI de hospeda, así que **existen y responden pero no figuran en el
contrato**: `customers`, `invoices`, `payments`, `plans`, `plans/{id}`,
`plans/{id}/prices`, `promo-codes`, `promo-codes/{code}`.

**Y tres operaciones del documento están malformadas.** Declaran el parámetro con la
sintaxis de Hono en vez de la de OpenAPI:

```
POST /api/v1/admin/alliance/leads/:id/approve-and-provision-partner
POST /api/v1/admin/alliance/leads/:id/mark-handled
POST /api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription
```

Son exactamente las **3** operaciones del documento con `:` en el path. Un cliente
generado desde ese documento trataría `:id` como parte literal de la URL.

*Nota de método*: este denominador **no se podía obtener contando archivos**. Los 1.150
archivos bajo `apps/api/src/routes/` no son endpoints, y las 24 factories `create*Route*`
tampoco se pueden contar por patrón. Hizo falta construir la app.

---

### F-1B-017 — Los 47 crons y su horario; tres lo toman del entorno y uno corre distinto en producción

**Los 47 registrados, con el horario que declara el código:**

| cron | horario | | cron | horario |
|---|---|---|---|---|
| `subscription-poll` | `* * * * *` | | `host-trade-usage-expiry` | `15 4 * * *` |
| `poll-apify-reputation-runs` | `*/2 * * * *` ¹ | | `partner-expiry` | `15 4 * * *` |
| `conversation-notification` | `*/5 * * * *` | | `entity-views-purge` | `30 3 * * *` |
| `newsletter-close-campaigns` | `*/5 * * * *` | | `conversation-token-cleanup` | `0 3 * * *` |
| `social-publish-dispatch` | `*/5 * * * *` | | `archive-abandoned-drafts` | `0 3 * * *` |
| `apply-scheduled-plan-changes` | `*/15 * * * *` | | `notification-log-purge` | `0 3 * * *` |
| `propagate-plan-price-changes` | `*/15 * * * *` | | `trial-reconcile` ² | `0 2 * * *` |
| `abandoned-pending-subs` | `0 * * * *` | | `addon-expiry` | `0 5 * * *` |
| `archive-expired-promotions` | `0 * * * *` | | `app-log-purge` | `0 5 * * *` |
| `courtesy-expiry` | `0 * * * *` | | `preapproval-less-expiry` | `30 5 * * *` |
| `webhook-retry` | `0 */1 * * *` | | `dunning` | `0 6 * * *` |
| `reactivation-supersession-reconcile` | `0 * * * *` | | `destination-weather-fetch` | `0 6,18 * * *` |
| `page-revalidation` | `0 * * * *` ¹ ³ | | `alerts-digest` | `0 8 * * *` |
| `subscription-drift-reconcile` | `17 * * * *` | | `notification-schedule` | `0 8 * * *` |
| `exchange-rate-fetch` | `0 */3 * * *` | | `conversation-token-reminder` | `0 9 * * *` |
| `lead-intake-backstop` | `20 */4 * * *` | | `view-monthly-rollup` | `10 4 * * *` |
| `calendar-sync-google` | `0 */6 * * *` | | `finalize-cancelled-subs` | `30 4 * * *` |
| `calendar-sync-ical` | `0 */6 * * *` | | `host-trade-usage-reminder` | `30 4 * * *` |
| `featured-by-entitlement-reconcile` | `0 */6 * * *` | | `partner-payment-review` | `30 4 * * *` |
| `search-index-refresh` | `0 */6 * * *` | | `partner-unpaid-reaper` | `45 4 * * *` |
| `entity-subscription-cache-reconcile` | `30 */6 * * *` | | `host-trade-stats-reconcile` | `0 5 * * 1` |
| `addon-subscription-reconcile` | `45 */6 * * *` | | `refresh-external-reputation` | `0 2 * * 1` ¹ |
| `cloudinary-e2e-cleanup` | `0 2 * * 0` | | `media-orphan-cleanup` | `0 0 * * 0` |
| `cron-run-purge` | `0 4 * * *` | | | |

¹ el horario sale de una variable de entorno, con ese valor como default.
² definido en `jobs/trial-expiry.ts`: **el archivo se llama distinto que el job**.
³ **en producción NO corre con ese horario** — ver abajo.

**Tres de los 47 leen su horario del entorno**, no del código:

| cron | default en el código | variable | valor en producción |
|---|---|---|---|
| `page-revalidation` | `0 * * * *` | `HOSPEDA_REVALIDATION_CRON_SCHEDULE` | **`0 */6 * * *`** |
| `refresh-external-reputation` | `0 2 * * 1` | `HOSPEDA_EXTREP_CRON_SCHEDULE` | sin setear |
| `poll-apify-reputation-runs` | `*/2 * * * *` | `HOSPEDA_EXTREP_POLL_SCHEDULE` | sin setear |

> ⚠️ **Ampliado el 2026-09-16 por `F-1B-043`.** El entorno no es la única fuente
> alternativa: `social-publish-dispatch` resuelve su horario contra la **base de datos**
> por el campo `resolveSchedule` del tipo. La tabla de arriba, que sale del literal
> `schedule`, describe su default y no necesariamente lo que corre.

**`page-revalidation` corre cada seis horas en producción, no cada hora.** Medido con
`hops --target=prod env-list api --reveal`, contra el default de
`jobs/page-revalidation.job.ts:40`. Es una divergencia real entre el código y el sistema
que corre, y del tipo que ningún test puede ver.

**Cuatro mediciones que hubo que rehacer, las cuatro por leer en vez de suponer:**

1. La extracción por `name: '...'` daba **46 de 47**. El que faltaba,
   `reactivation-supersession-reconcile`, declara `name: JOB_NAME`
   (`jobs/reactivation-supersession-reconcile.job.ts:151`), o sea una constante y no un
   literal.
2. Cinco `timeoutMs` parecían absurdos —`2`, `5`, `10`— y eran expresiones:
   `2 * 60 * 1000`, `5 * 60_000`, `10 * 60_000`. El regex tomaba el primer número.
3. Tres jobs parecían no tener horario y lo toman del entorno.
4. `jobs/trial-expiry.ts` define un job llamado **`trial-reconcile`**. Buscarlo por el
   nombre del archivo no lo encuentra; buscarlo por el nombre del job no encuentra el
   archivo.

---

### F-1B-018 — 17 de los 47 crons son de billing, y suman 13.500 líneas

Partición **por lo que cada handler referencia**, no por su nombre: menciones a las 27
tablas de qzpay, imports de `@qazuor/qzpay-*`, y vocabulario de dominio
(`subscription`, `entitlement`, `billing`, `plan`, `addon`, `promo`, `trial`,
`courtesy`).

**17 de los 47** superan las 50 referencias de dominio. Los diez más grandes:

| cron | líneas | | cron | líneas |
|---|---|---|---|---|
| `addon-expiry` | **2.076** | | `addon-subscription-reconcile` | 765 |
| `propagate-plan-price-changes` | 1.629 | | `abandoned-pending-subs` | 731 |
| `webhook-retry` | 1.082 | | `notification-schedule` | 693 |
| `subscription-poll` | 1.011 | | `entity-subscription-cache-reconcile` | 496 |
| `apply-scheduled-plan-changes` | 973 | | `courtesy-expiry` | 398 |
| `finalize-cancelled-subs` | 828 | | `reactivation-supersession-reconcile` | 390 |
| `dunning` | 773 | | `featured-by-entitlement-reconcile` | 362 |
| `subscription-drift-reconcile` | 766 | | `preapproval-less-expiry` | 359 |
| | | | **`trial-reconcile`** | **189** |

Las 17 suman **≈13.500 líneas**. Los otros 30 crons no tocan billing.

**Siete construyen su propio adaptador de MercadoPago** en vez de usar el de
qzpay-core: `abandoned-pending-subs`, `addon-subscription-reconcile`,
`reactivation-supersession-reconcile`, `subscription-drift-reconcile`,
`subscription-poll`, `trial-reconcile` y `webhook-retry`. El motivo está escrito en
`trial-expiry.ts:135-138`: `getPaymentAdapter()` devuelve la interfaz genérica y la
reconciliación necesita el `subscriptions.retrieve()` tipado de MercadoPago.

---

### F-1B-019 — «Billing no está configurado» se resuelve de cuatro formas distintas, y una descarta eventos

**Catorce** crons tienen la rama `if (!billing)`. Ante **exactamente la misma
condición**, hacen cuatro cosas distintas:

| qué hace | cuántos | quiénes |
|---|---|---|
| `success: true`, `processed: 0` | **11** | `abandoned-pending-subs`, `addon-subscription-reconcile`, `apply-scheduled-plan-changes`, `dunning`, `finalize-cancelled-subs`, `notification-schedule`, `propagate-plan-price-changes`, `reactivation-supersession-reconcile`, `subscription-drift-reconcile`, `subscription-poll`, `trial-reconcile` |
| `success: false`, `errors: 1` | **1** | `addon-expiry` (`:260-270`) |
| cuenta un error por fila y sigue | **1** | `courtesy-expiry` (`:127-131`) |
| **`return true`** | **1** | `webhook-retry` (`:104-107`, `:145`) |

**El cuarto caso descarta eventos.** `retryMercadoPagoPaymentUpdated` documenta su
retorno como *«true if processing succeeded, false otherwise»*
(`webhook-retry.job.ts:100`), y devuelve **`true`** cuando billing no está configurado,
sin haber procesado nada. En el llamador, `webhook-retry.job.ts:961-963`:

```ts
if (success) {
    // Mark as resolved
    await markAsResolved(tx, event.id, event.providerEventId);
    resolved++;
}
```

O sea que por ese camino **la cola de dead-letter se vacía marcando cada evento de pago
como resuelto sin haberlo procesado**, y el cron reporta éxito.

**Es un camino latente, no un bug activo**: depende de que `getQZPayBilling()` devuelva
un valor falsy, y eso **no está medido** — en producción billing está configurado, hay
8 suscripciones y 206 eventos de webhook. Lo que está medido es el camino y su efecto.

Y hay un artefacto citable de lo desparejo que es el patrón: `dunning.job.ts:316`
devuelve **`skipped: false` junto a `success: true`** en la rama de «no configurado» —
declara que no se salteó mientras se saltea.

*Nota*: un cron que se saltea porque **otra instancia tiene el lock** y reporta
`success: true` es correcto y no entra en este conteo (`exchange-rate-fetch:213`,
`dunning:725`). Son dos condiciones distintas que un regex suelto mezcla.

---

### F-1B-020 — En `trial-reconcile`, el `dryRun` no simula lo que hace el modo real

`trial-expiry.ts` tiene 189 líneas y delega toda su lógica en
`TrialService.reconcileExpiredTrials({ paymentAdapter })` (`:141`). Pero **las dos ramas
no comparten ni una línea**:

- **Modo real** (`:132-141`): construye el adaptador de MercadoPago y llama al servicio,
  que re-lee cada preapproval y espeja el veredicto del proveedor.
- **Dry run** (`:75-130`): lista las suscripciones `trialing` con
  `billing.subscriptions.listAll()` y **cuenta** las que tienen `trialEnd < now`. No
  llama al servicio, no habla con el proveedor, y no aplica ninguna de sus reglas.

El dry run responde *«cuántas tienen el trial vencido»*; el modo real hace *«qué dice el
proveedor de cada una»*. **Correr el dry run no dice qué va a hacer el modo real**, ni en
número ni en efecto.

---

### F-1B-021 — Una columna sin restricción, tres vocabularios de estado y dos mapas de traducción

`billing_subscriptions.status` es `varchar(50)` sin `CHECK` ni tipo `enum`
(`F-1B-007`). Lo que se escribe ahí sale de **tres** vocabularios distintos:

| fuente | dónde | valores |
|---|---|---|
| **qzpay** | `qzpay/packages/core/src/constants/subscription-status.ts` | 8: `active`, `trialing`, `past_due`, `paused`, **`canceled`**, `unpaid`, `incomplete`, `incomplete_expired` |
| **hospeda** | `packages/schemas/src/enums/subscription-status.enum.ts` | 10: `active`, `trialing`, `past_due`, `paused`, **`cancelled`**, `expired`, `pending_provider`, `abandoned`, `comp`, `courtesy` |
| **MercadoPago**, de paso | llega por el `mapStatus()` de `qzpay-mercadopago` | al menos `finished` y `pending` |

Sólo **cuatro** valores coinciden verbatim entre qzpay y hospeda: `active`, `trialing`,
`past_due`, `paused`. La cancelación **no** coincide: qzpay escribe `canceled` (una L) y
hospeda `cancelled` (dos).

**Y hay dos mapas de traducción, en direcciones distintas, que el código pide
explícitamente no unificar:**

| mapa | dónde | qué traduce | claves |
|---|---|---|---|
| `QZPAY_TO_HOSPEDA_STATUS` | `packages/service-core/…/subscription-status-provider.ts:44` | el estado **entrante** de `retrieve()` | 6: `active`, `paused`, `canceled`, `finished`, `past_due`, `pending` |
| `QZPAY_STORED_STATUS_ALIASES` | `packages/billing/src/predicates/subscription-status-normalize.ts:75` | el valor **ya guardado** en la base | 8: las de qzpay, con `unpaid`→`past_due`, `incomplete`→`pending_provider`, `incomplete_expired`→`abandoned` |

El segundo lo dice en su propio comentario (`:62-67`): *«NOT the same map… that one maps
the INCOMING retrieve() status (has finished/pending, never incomplete); this one maps
the STORED DB from status (has incomplete/unpaid). Do NOT merge»*.

**Consecuencia medible: el mapa de entrada no cubre cuatro de los ocho estados de
qzpay** — `trialing`, `unpaid`, `incomplete` e `incomplete_expired` no son claves suyas.
Y el camino para una clave ausente está en
`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:640-649`:

```ts
if (providerStatus === undefined) {
    apiLogger.warn(…, `Unknown QZPay subscription status: ${qzpayStatus}`);
    Sentry.captureException(…);
    return { success: true, statusChanged: false, outcome: 'provider_status_unknown' };
}
```

Devuelve **`success: true`** sin cambiar nada. A diferencia de los caminos de
`F-1B-019`, éste **sí avisa** —Sentry más un `warn`—, así que no es silencioso; el
webhook se da por procesado igual.

El mapa tiene **tres consumidores reales** —`trial.service.ts:1074`,
`preapproval-recovery.service.ts:95` y `subscription-logic.ts:628`— y aparece citado en
unos veinte comentarios más como referencia.

*Qué abre, sin resolverlo acá*: el §63 pide una máquina de estados explícita para
Subscription. Hoy los estados posibles están declarados en dos enums de dos repos, más
lo que el proveedor cuele, sobre una columna que no restringe nada.

---

### F-1B-022 — Los cinco crons del ciclo de vida calculan `success` de tres formas distintas

Leídos enteros: `subscription-poll` (1.011), `subscription-drift-reconcile` (766),
`abandoned-pending-subs` (731), `finalize-cancelled-subs` (828),
`reactivation-supersession-reconcile` (390).

| cron | cómo computa `success` |
|---|---|
| `subscription-drift-reconcile` | `errors === 0 && unknownAtProvider === 0 && unresolved === 0` (`:733-734`) — una sola fila sin resolver tiñe el tick entero |
| `finalize-cancelled-subs` | `errors === 0` (`:803`) |
| `abandoned-pending-subs` | `errors === 0` |
| `subscription-poll` | `errors === 0` (`:999`) |
| **`reactivation-supersession-reconcile`** | **`success: true` literal** (`:348-349`), con `errors` devuelto al lado |

**El último está verificado leyendo el `return`**: el objeto lleva `success: true`
escrito a mano y `errors` como campo aparte, así que un tick con
`cancel-did-not-take` —el caso exacto que ese cron existe para atrapar, una suscripción
vieja que sigue cobrando en paralelo— se reporta como éxito. Es el único de los cinco
que lo hace, y no hay comentario que explique la asimetría.

Los dos extremos son crons hermanos con la misma responsabilidad de **evitar el doble
cobro**.

---

### F-1B-023 — `finalize-cancelled-subs` cuenta la fila como finalizada antes de cancelar en el proveedor, y el resultado de esa cancelación no llega a ningún contador

Verificado en `finalize-cancelled-subs.ts:771-782`:

```ts
if (outcome.kind === 'finalized') {
    finalized += 1;
    // HOS-237: close the MP preapproval (soft-cancel only paused it).
    // Best-effort — a provider failure does not fail the finalization.
    await hardCancelPreapprovalBestEffort({ … });
}
```

El `finalized += 1` ocurre **antes** de la llamada, y el valor que devuelve
`hardCancelPreapprovalBestEffort` (`cancelled` / `skipped` / `failed`) **no se asigna a
nada**. El comentario lo declara deliberado.

Consecuencia medible: el cron puede informar `Finalized N, skipped 0, errors 0`
mientras **N preapprovals siguen vivas en MercadoPago**. La cancelación en el proveedor
es irreversible cuando sale bien y, cuando sale mal, invisible en el resultado.

---

### F-1B-024 — La descripción que ve un administrador describe el comportamiento anterior

`finalize-cancelled-subs.ts:709-710` declara en el `CronJobDefinition`:

> *«Finalizes soft-cancelled subscriptions whose **current_period_end** has elapsed…»*

Pero la consulta usa `effectiveEndDateExpr()` (`:225-227`, aplicada en `:279`), que es:

```sql
CASE WHEN status = 'trialing' AND trial_end IS NOT NULL THEN trial_end
     ELSE current_period_end END
```

O sea que para una suscripción en trial la fecha de corte es `trial_end`, no
`current_period_end`. El docblock del módulo sí lo documenta; el string `description`
—que es lo que se muestra en cualquier panel de crons— quedó describiendo el
comportamiento previo.

---

### F-1B-025 — Otras cuatro cosas del grupo de ciclo de vida

1. **Dos de los cinco no tienen lock de proceso.** `subscription-poll` (`1007`),
   `subscription-drift-reconcile` (`1010`) y `abandoned-pending-subs` (`1006`) usan
   `pg_try_advisory_xact_lock`; `finalize-cancelled-subs` y
   `reactivation-supersession-reconcile` **no tienen ninguno**. En el segundo, dos
   réplicas simultáneas pueden llamar a `cancel()` sobre el mismo par en paralelo: lo
   único que las separa es un índice único parcial **al insertar la auditoría**, o sea
   después de haber hablado con el proveedor.
2. **`subscription-poll` sí muta el monto en MercadoPago.** `:660` llama a
   `subscriptions.update(mpSubscriptionId, { transactionAmount })` desde
   `reconcileActiveDiscountAmounts` (`:532-695`), que el mismo handler invoca en
   `:994-996`. Un comentario en `:768-775` dice que el job nunca toca el monto de una
   suscripción activa — es cierto de `processOneJob`, la función donde está escrito, y
   fácil de leer como si valiera para el módulo.
3. **Ese reconciliador es enteramente best-effort**: sus errores se loguean pero **no
   entran** en `processed` ni en `errors` del cron.
4. **El cursor de `subscription-drift-reconcile` vive en memoria del módulo**
   (`:216`), no en la base: se pierde en cada reinicio o despliegue.

---

### F-1B-026 — El cron de `dunning` no muta nada: sus dos operaciones están apagadas por una constante

Verificado a mano. `dunning.job.ts:245` declara:

```ts
export const DUNNING_MUTATIONS_ENABLED = false;
```

y `:635` corta antes de llegar a `processRetries()` / `processCancellations()`, que viven
en `:668-720` y **nunca se ejecutan**. Lo que corre es una pasada de sólo observación que
cuenta los `past_due` y devuelve `processed: 0` con el mensaje literal
*«no local retries or cancellations attempted»* (`:654-665`).

**No es un olvido: tiene razón escrita** — *«MercadoPago native recycling is
authoritative»* (HOS-191 F5), y el docblock del módulo (`:20-58`) lo documenta como
decisión, incluyendo que `past_due` es hoy inalcanzable en el pipeline local.

**Pero el primer bloque de comentarios del mismo archivo (`:1-18`) sigue describiendo el
comportamiento viejo**: *«Uses QZPay's SubscriptionLifecycleService to process payment
retries», «Cancels subscriptions…»*. Un lector que se quede con el docblock de arriba se
lleva una descripción incorrecta de lo que corre, y recién en la línea 20 se entera.

Cruza con `DEC-SUB-002` (grace configurable) y con todo el §20: **hoy el grace del lado
nuestro no lo ejecuta nadie**.

---

### F-1B-027 — Un cobro de addon puede darse por procesado con su liquidación fallida

Verificado en `apps/api/src/routes/webhooks/mercadopago/addon-recurring-handler.ts:251-266`.
`settleRecurringAddonCharge` —que activa el addon, inserta en el ledger y avanza el
período— corre dentro de un `try`; el `catch` loguea con `capture: true`; y el

```ts
return { handled: true, purchaseId: purchase.id };
```

**queda fuera del `try/catch`**. O sea que una excepción en la liquidación no cambia el
retorno.

Río abajo eso importa: `webhook-retry.job.ts:324-335` trata `handled === true` como
procesado y el llamador ejecuta `markAsResolved`, sacando el evento de la cola de
dead-letter. **El cobro del addon queda cobrado en el proveedor, sin activar, sin ledger
y sin período avanzado, y el evento marcado como resuelto.**

**Tiene razón escrita**: *«event consumed anyway so it can never be booked as a plan
renewal»*. Es una elección entre dos daños, no un descuido — pero el daño elegido no
queda registrado en ningún contador.

Es el segundo camino que encontramos por el que la cola de dead-letter se vacía sin
trabajo hecho; el primero es el de `F-1B-019`.

---

### F-1B-028 — `addon-expiry` son siete responsabilidades en un archivo, y su docblock describe cuatro

Las 2.076 líneas se reparten en **siete fases**, todas bajo el mismo lock `43001`:

| # | fase | líneas | límite |
|---|---|---|---|
| 1 | expirar addons vencidos | 277-557 | sin `LIMIT` en SQL |
| 2 | aviso a 3 días | 558-687 | — |
| 3 | aviso a 1 día | 688-817 | — |
| 4 | reintento de revocación de huérfanos | 818-1421 | `LIMIT 100` |
| 5 | reconciliar split-state DB↔proveedor | 1423-1565 | `LIMIT 10` |
| 6 | reintento de quita de entitlements | 1566-1754 | `LIMIT 10` |
| 7 | reconciliar grants faltantes | 1755-2028 | `LIMIT 10` |

**El docblock del módulo (`:1-30`) documenta las fases 1 a 4.** Las fases 5, 6 y 7 —unas
600 líneas, y las tres mutan acceso o cobro— no figuran.

Las fases 2 y 3 son código casi idéntico con `daysAhead` distinto.

**Y el `LIMIT` de la fase 1 no está en SQL**: `addon-expiration.queries.ts:237` y `:322`
hacen `rawResults.slice(0, BATCH_SIZE)` **en JavaScript**, sin `limit()` en la consulta
(verificado: cero ocurrencias de `limit(` en ese archivo). El tope de 100 acota el
procesamiento, no lo que la base devuelve.

**Contradicción de política dentro del mismo archivo**, verificada en `:1080-1094`: si
falla la verificación del estado contra el proveedor, el código **revoca igual**
(*«proceeding with revocation conservatively — the orphaned state was already confirmed
via DB join»*), mientras que `closeAddonPreapproval` sigue la regla opuesta: si no puede
confirmar en el proveedor, **no expira**. Ante la misma duda, un camino le quita el
addon al cliente y el otro se abstiene.

---

### F-1B-029 — `success: true` literal: son cuatro crons, no uno

`F-1B-022` encontró el primero. Con los dos grupos restantes leídos, el patrón es:

| cron | dónde | qué queda afuera de `success` |
|---|---|---|
| `reactivation-supersession-reconcile` | `:348` | pares con `cancel-did-not-take` |
| `featured-by-entitlement-reconcile` | `:319-335` | owners cuya corrección falló |
| `notification-schedule` | `:615` | renovaciones, serie de trial y reintentos fallidos |
| **`addon-expiry`** | `:1857` (y `:2038` lo propaga) | **las siete fases** |

En los cuatro, `errors` se acumula y se devuelve en el resultado, pero **no participa del
cálculo de `success`**. Sólo una excepción que escape del handler entero lo pone en
`false`.

En `addon-expiry` eso significa que expiraciones rechazadas, revocaciones fallidas,
split-state no reconciliado, entitlements no removidos y grants no aplicados **dejan el
job en verde**.

`courtesy-expiry` es la excepción deliberada del lote: `:315-331` devuelve
`success: false` si `errors > 0`, y su docblock lo declara como decisión.

Y en los cuatro, más varios de los otros, **«no pude tomar el lock» y «billing no está
configurado» también devuelven `success: true`**, indistinguibles en ese campo de una
corrida real sin trabajo.

---

### F-1B-030 — Ningún cron relee el monto después de mutarlo en el proveedor

De los once handlers leídos, cuatro mutan el `transaction_amount` de una suscripción viva
en MercadoPago:

| cron | dónde |
|---|---|
| `subscription-poll` | `:660` |
| `apply-scheduled-plan-changes` | `:415-419` |
| `propagate-plan-price-changes` | `:779-803` (hasta 3 intentos, 400 ms de espera) |
| `webhook-retry` → `payment-logic.ts` | `:939` |

**Ninguno de los cuatro vuelve a leer el preapproval para comparar campo por campo.** El
éxito se determina por ausencia de excepción del SDK.

La única relectura que sí existe es la de `processSubscriptionUpdated`
(`subscription-logic.ts:601-610`), que relee el **estado** antes de escribirlo local — no
el monto.

Cruza directo con `DEC-MP-001` y `DEC-SUB-008`, que fijan que el cambio de precio se hace
mutando el monto **y que la mutación se verifica releyendo**, porque es el terreno donde
el proveedor ya demostró nueve veces aceptar sin aplicar.

---

### F-1B-031 — Dos crons resuelven el mismo cálculo con políticas opuestas

Ante el mismo fallo —no poder resolver el estado de descuento de una suscripción al
calcular su monto nuevo—:

- **`apply-scheduled-plan-changes.ts:95-144`** cae en **fail-open**: devuelve el precio
  pleno, sin descuento. Comentado como aceptable porque *«a missed discount
  re-application is recoverable via the reconciler»*.
- **`propagate-plan-price-changes.job.ts:268-316`** cae en **fail-closed**: difiere el
  target y no toca nada, comentado explícitamente para no *«invertir una baja en una suba
  accidental»*.

Los dos comentan su elección; las elecciones son opuestas. El primero puede cobrarle de
más a alguien con descuento vigente; el segundo prefiere no cobrar todavía.

Y hay una asimetría gemela en el tratamiento del target fallido: en
`propagate-plan-price-changes` un target `failed` **hace fallar el registro padre**
(`:1079-1094`), mientras que en `apply-scheduled-plan-changes` los pasos 2 a 4 pueden
fallar —incluida la propagación a MercadoPago— y la fila **sigue contando como
`applied`** (`:397-464`).

---

### F-1B-032 — La lógica de billing vive en TRES paquetes de hospeda, más dos de qzpay

| dónde | archivos | líneas |
|---|---|---|
| **`apps/api/src/services`** (los de billing) | **140** | **51.681** |
| `packages/service-core/src/services/billing` | 52 | 14.254 |
| `packages/billing/src` | 37 | 8.167 |
| **subtotal hospeda** | **229** | **74.102** |
| `qzpay/packages/core` | 89 | 22.120 |
| `qzpay/packages/drizzle` | 68 | 14.762 |
| `qzpay/packages/mercadopago` | 16 | 4.160 |
| **subtotal qzpay** | **173** | **41.042** |
| **TOTAL** | **402** | **≈115.000** |

**El hogar más grande no es un paquete compartido: es la app.** El 70 % de la lógica de
billing de hospeda está en `apps/api/src/services` —**140 de sus 185 archivos** mencionan
conceptos de billing—, no en `service-core` ni en `packages/billing`.

**Y los dos hogares tienen formas distintas.** `service-core` es de clases: **126 clases
exportadas**, de las cuales **39 extienden `BaseCrudService`**, 19 `BaseService`, 6
`BaseCrudRelatedService` y 2 `BaseCommerceListingService`. `apps/api/src/services` es de
funciones: **23 clases contra 337 funciones exportadas**.

*Nota de método, la séptima vez*: el patrón `class X extends BaseCrudService` daba **40**
ocurrencias y **39** nombres únicos, lo que parecía una clase declarada dos veces. No lo
era: la repetida es `AccommodationService`, y una de las dos está **dentro de un ejemplo
de docblock** (`packages/service-core/src/base/base.crud.service.ts:97`, con su `*` al
principio de la línea). Son 39.

*Qué abre, sin resolverlo acá*: el §7 pide **un único motor genérico de billing**, y el
§1 lista la lógica duplicada entre los problemas que motivaron este programa. La
medición no dice si esas 115.000 líneas están duplicadas — dice **dónde están**, y que
son cinco paquetes en dos repos.

---

### F-1B-033 — Entitlements y limits se declaran en TypeScript, y la tabla de la base es su reflejo

El §9 del PDR es terminante: *«Toda configuración relevante del dominio debe salir SI O SI
DE DATABASE. NO usar: archivos TS; JSON de configuración; constantes duplicadas…»*, y
lista **entitlements** y **limits** entre lo que debe salir de la base.

Hoy es al revés, y el propio código lo declara. `packages/billing/src/config/entitlements.config.ts:5-27`:

> *«`ENTITLEMENT_DEFINITIONS` is NOT DB-backed and is **intentionally NOT** part of the
> billing catalog that was migrated to the database… **the enum is the source of truth**,
> and this array is its human-readable companion… The seeder reads this array to populate
> the `billing_entitlements` lookup table, but **that table is a reflection of this file —
> not an independent source**.»*

La razón que da: las claves aparecen en genéricos de TypeScript y en firmas de
middleware, y un registro sólo-en-base perdería la exhaustividad en tiempo de
compilación.

**Los dos catálogos, medidos:**

| | declarado en TS | filas en producción |
|---|---|---|
| `EntitlementKey` | **53** | **53** ✓ |
| `LimitKey` | **22** | **20** ✗ |

**Los entitlements coinciden exacto.** Los limits **no**: dos claves existen en el enum y
**no tienen fila** en `billing_limits`:

```
max_ai_chat_experience_per_month
max_ai_chat_gastronomy_per_month
```

Son las cuotas de chat con IA de **gastronomía y experiencia** — las dos verticales que
el §5.5 separó de Commerce. Las otras siete claves `max_ai_*` sí están.

*Qué abre, sin resolverlo acá*: `DEC-ENT-001` estableció que existen entitlements
**medidos** y que cada uno declara dos cuotas; `DEC-ENT-002` fijó que se resetean
mensualmente. Las dos decisiones se apoyan en un catálogo que hoy vive en un enum de
TypeScript, con la tabla de la base como copia — y con dos claves que la copia no tiene.

---

### F-1B-034 — Las dos tablas de catálogo son de escritura solamente: veinte escritores, cero lectores

`F-1B-033` midió que el catálogo de claves vive en TypeScript y que la tabla es su
reflejo. Lo que se midió ahora es el otro lado: **a ese reflejo no lo lee nadie.**

| tabla | filas en prod | escritores | lectores |
|---|---|---|---|
| `billing_entitlements` | **53** | **17** | **0** |
| `billing_limits` | **20** | **3** | **0** |

**Los 17 escritores de `billing_entitlements`** son el seeder
(`packages/seed/src/required/billingEntitlements.seed.ts:61`), **catorce**
data-migrations que insertan la fila de su clave cuando falta —`0077:144`, `0080:100`,
`0081:121`, `0082:96`, `0084:114`, `0085:115`, `0086:111`, `0087:100`, `0088:101`,
`0091:111`, `0093:142`, `0094:301`, `0096:231`, `0098:111`— y **dos** `extras`:
`015-spec216-entitlement-prune-and-inherit.data.sql:63` (un `DELETE` de ocho claves) y
`028-vip-promotions-access-repair.data.sql:33` (un `INSERT`). O sea que los **tres**
carriles de migración de `F-1B-015` escriben la misma tabla.

**Los 3 de `billing_limits`**: el seeder (`billingLimits.seed.ts:67`) y dos
data-migrations, `0061:109` y `0096:214`.

**Y del lado de la lectura no hay una sola.** Verificado en las dos direcciones:

- En hospeda, `billingEntitlements` y `billingLimits` sólo aparecen fuera de tests en
  el seeder, las data-migrations, los `extras`, el re-export de
  `packages/db/src/billing/index.ts:53,70` y un comentario de
  `scripts/server-tools/src/commands/billing-test-reset.ts:7`. **Ninguna ruta, servicio,
  middleware o cron las consulta.**
- En qzpay, la API de lectura **existe y no la llama nadie**:
  `core/src/adapters/storage.adapter.ts:367-368` y `:378-379` declaran
  `findDefinitionByKey` y `listDefinitions` para los dos catálogos,
  `drizzle/src/repositories/limits.repository.ts:61,70` los implementa y
  `drizzle/src/adapter/drizzle-storage.adapter.ts:1265-1274` los expone. **Cero llamadas
  en `core`, en `hono`, en `react` y en hospeda.**

**El gate resuelve del plan, no del catálogo**, y el propio repo lo dice donde importa:
`extras/015…data.sql:70-71` justifica su `DELETE` sobre `billing_customer_entitlements`
con *«the column has no FK to `billing_entitlements`, and gating resolves from the plan
at runtime»*. Lo que se chequea es el JSONB `entitlements` / `limits` de la fila de
`billing_plans`.

Consecuencia directa: **una fila de más, de menos o desactualizada en cualquiera de las
dos tablas no cambia ningún comportamiento**, porque nadie las consulta. Es la razón por
la que las dos claves faltantes de `F-1B-033` pudieron estar ausentes sin que nada se
rompiera — y también por la que su ausencia no se detecta sola.

*Qué abre, sin resolverlo acá*: el §9 exige que la configuración del dominio salga de la
base. Hoy hay una copia en la base, escrita por veinte lugares y leída por ninguno.

---

### F-1B-035 — Las dos filas que faltan salen de una sola migración, y la regla que no siguió está escrita en otra

`F-1B-033` midió que `LimitKey` declara 22 claves y `billing_limits` tiene 20. Las dos
ausentes —`max_ai_chat_gastronomy_per_month` y `max_ai_chat_experience_per_month`— las
introdujo **`0093-hos-400-commerce-ai-chat-grant-and-quota.ts`**, y esa migración
**defiende un eje y no el otro**:

- **Entitlement**: `:135-148` consulta `billing_entitlements` por `ai_chat` e inserta la
  fila si falta, aunque su propio docblock (`:54-59`) explica que esa clave existe desde
  SPEC-173. *«It re-checks anyway and inserts if absent, so a database seeded from a
  narrower baseline is not left with a dangling grant.»*
- **Limit**: escribe el cap de las dos claves nuevas en el JSONB de las seis filas de
  `billing_plans` (`:158-196`) y **no toca `billing_limits`**. No es una omisión en el
  cuerpo: el `import` de la línea `85` trae `billingEntitlements`, `billingPlans` y `eq`
  — **la tabla de limits no está importada**, así que no había manera de escribirla.

**Es la única de las tres data-migrations que introdujo claves de limit nuevas sin su
fila de catálogo.** `0061:94-117` inserta las de `max_gastronomies` / `max_experiences`
antes de crear los planes, con el comentario *«inserted before the plans because a plan's
`limits` JSONB refers to these keys»*, y `0096:198-215` inserta la de
`max_active_private_galleries`. `0094` no entra en la comparación: escribe cuotas de
claves que ya existían (`:206-212` y `:234-237`, todas previas), no claves nuevas.

**Y la regla está escrita, en la migración siguiente.** `0096:199-206`:

> *«A grant naming a key with no `billing_entitlements` row is a dangling grant, and a
> plan limit naming a key with no `billing_limits` row is the same thing on the other
> axis. Both are created rather than assumed — `0093` and `0094` state the reason: the
> documented run order (`db:migrate` → `db:apply-extras` → `db:seed:migrate`) does not
> include the required seed, so a database can legitimately hold the plan rows while the
> lookup tables are still nearly empty.»*

Cita a `0093` como fuente de la razón, y `0093` aplicó esa razón sólo al eje de los
entitlements.

**El motivo por el que el eje de entitlements sí se defiende está medido, no supuesto.**
`0094:278-291` lo cuenta: la versión original verificaba la presencia de las 15 claves y
**tiraba** si faltaban, y *«that is precisely the state `cli-data-migrate.integration.test.ts`
builds, where 14 of the 15 were missing and this was the only one of the 94 migrations
that aborted the run»*. O sea que el eje de entitlements tiene catorce guardias porque un
test rompió una vez; el de limits no tuvo ese accidente y quedó con dos.

Cruza con `F-1B-034`: como **nadie lee `billing_limits`**, las dos filas ausentes no
producen ningún síntoma en runtime. El daño es de catálogo — y la única superficie donde
se nota es la etiqueta: las mismas dos claves, más `max_active_private_galleries`, son
**las únicas 3 de las 22** que no tienen entrada en
`packages/i18n/src/locales/<lang>/account.json` (`subscription.usage.limits.<key>`,
verificado en las tres locales), así que el panel de consumo cae al fallback de
`PlanUsageSection.client.tsx:283`, que es `limit.displayName` — *«that field comes from
`LIMIT_METADATA` and is hardcoded English»*, según el comentario de `:281-282`.

---

### F-1B-036 — Once mecanismos chequean las claves, y el único que falla CERRADO ante una clave ausente no lo llama nadie

Inventario de cómo se chequea una clave, contado sobre `apps/api/src/routes` (los 1.032
handlers de `F-1B-016`), con el nombre del mecanismo como patrón:

| mecanismo | dónde está definido | ocurrencias en rutas | archivos |
|---|---|---|---|
| `requireEntitlement(key)` | `middlewares/entitlement.ts:1335` | **79** | 71 |
| `commerceVerticalEntitlementMiddleware(v)` | `middlewares/commerce-entitlement.ts:591` | **50** | 39 |
| `requireLiveSubscription(domain)` | `middlewares/require-live-subscription.ts:79` | 34 | 34 |
| `gateXxx(...)` (los 15 de tourist/accommodation) | `middlewares/tourist-entitlements.ts`, `…/accommodation-entitlements.ts` | 17 | 14 |
| `enforceXxxLimit(...)` | `middlewares/limit-enforcement.ts`, `…/commerce-limit-enforcement.ts` | 15 | 6 |
| `hasEntitlement(c, key)` | `middlewares/entitlement.ts:1474` | 9 | 7 |
| `getRemainingLimit(c, key)` | `middlewares/entitlement.ts:1514` | 8 | 8 |
| `createAiQuotaMiddleware(feature)` | `middlewares/ai-quota.ts:174` | 7 | 4 |
| `checkLimit(params)` | `utils/limit-check.ts:178` | 5 | 5 |
| `assertXxxLimitOrThrow(...)` | `middlewares/limit-enforcement.ts` | 3 | 1 |
| **`requireLimit(key)`** | `middlewares/entitlement.ts:1402` | **0** | **0** |

**Ninguno se monta en el ensamblador**: `apps/api/src/routes/index.ts` no tiene una sola
ocurrencia de ninguno de los once. El gate se declara handler por handler.

**`requireLimit` es código muerto.** Fuera de tests, las únicas menciones en todo el repo
son su propia definición (`:1402`), el `@example` de su docblock (`:1388-1393`), dos
comentarios que lo nombran (`:1294`, `types.ts:96`) y una línea de `apps/api/CLAUDE.md`.
**Cero call sites.**

Eso importa porque **es el único camino que falla cerrado ante una clave de limit
ausente**, y las dos mitades están escritas en el mismo archivo:

| función | condición | qué devuelve |
|---|---|---|
| `requireLimit` (`:1421-1430`) | `!limits.has(key)` | `ServiceError(LIMIT_REACHED)` → **403** |
| `getRemainingLimit` (`:1528-1531`) | `!limits.has(key)` | **`-1`**, y el comentario lo dice: *«Limit not defined - treat as unlimited»* |

`checkLimit` (`utils/limit-check.ts:182`) y `ai-quota.ts:258-265` heredan el segundo sin
modificarlo. O sea: **la enforcement real de los 22 limits corre entera por el camino
cuyo default es ilimitado**, y el que rechaza no lo usa ninguna ruta.
`routes/ai/protected/chat.ts:408` lo dice de frente: *«Intentionally fail-open, UNLIKE
`requireLimit`»*.

Dos cosas más del mismo archivo, verificadas:

1. **El fail-open está acotado por un flag, no por el default.** Si la carga de billing
   falla, `entitlementMiddleware` deja los conjuntos vacíos **y** pone
   `billingLoadFailed = true` (`:1269-1275`, `:1293-1297`), y tanto `requireEntitlement`
   (`:1339-1349`) como `requireLimit` (`:1407-1417`) cortan con **503** antes de mirar la
   clave. El comentario de `:1294-1295` declara el motivo: *«so requireLimit /
   requireEntitlement will return 503 instead of silently granting unlimited access»*.
   Pero `getRemainingLimit`, `checkLimit` y `hasEntitlement` **no consultan ese flag**.
2. **`-1` es ambiguo por construcción**: es el valor explícito que guardan los conjuntos
   de staff (`entitlement.ts:557`, `owner-entitlement.ts:787`,
   `commerce-entitlement.ts:604`) y es también el que sintetiza `getRemainingLimit` para
   una clave ausente. El llamador no puede distinguirlos.

*Qué abre, sin resolverlo acá*: el §9 y `DEC-ENT-001` se apoyan en que una cuota no
declarada sea un error. Hoy es un permiso.

---

### F-1B-037 — Doce de las 53 claves no las chequea nada en el servidor, y seis funciones gate están escritas y montadas en ninguna ruta

Medido clave por clave sobre las 53: ocurrencias en `apps/api/src` y
`packages/service-core/src`, excluyendo tests, buscando las dos formas
(`EntitlementKey.MIEMBRO` y el literal `'valor'`).

**Nueve tienen CERO referencias en el servidor**, y todas existen en los mismos cuatro
lugares: el enum, `entitlements.config.ts`, la fila del plan en `plans.config.ts`, y una
superficie de exhibición:

| clave | dónde aparece, además del catálogo |
|---|---|
| `priority_support` | `apps/web/…/plan-comparison-rows.ts`, `apps/admin/…/plan-entitlement-groups.ts`, `apps/admin/src/lib/dashboard-sources/host.ts:181` |
| `custom_branding` | idem (`host.ts:182`) |
| `multi_property_management` | admin (`host.ts:183`) |
| `consolidated_analytics` | admin (`host.ts:184`) |
| `centralized_booking` | sólo `plan-entitlement-groups.ts` |
| `staff_management` | sólo `plan-entitlement-groups.ts` |
| `vip_support` | sólo `plan-entitlement-groups.ts` |
| `read_reviews` | web + admin |
| `manage_experience_private_galleries` | sólo admin; lo que sí se chequea es el **limit** `max_active_private_galleries` |

**Tres más tienen referencias, y todas están dentro de una función gate que ninguna ruta
monta:**

| clave | sus únicas referencias en el servidor |
|---|---|
| `respond_reviews` | `accommodation-entitlements.ts:548,554,561` — las tres, dentro de `gateReviewResponse` |
| `can_attach_review_photos` | `tourist-entitlements.ts:291,297,304` — dentro de `gateReviewPhotos` |
| `can_contact_whatsapp_direct` | el gate (`:468,496,503`) más `routes/accommodation/protected/getWhatsApp.ts:129`, que **informa** `canDirect` en la respuesta, no rechaza |

**Los seis gates sin montar**, verificados por la negativa: cada uno aparece en su propio
módulo, en `apps/api/test/middlewares/entitlement.test.ts` y en un `.md` de
`apps/api/docs/entitlements/`. **En ninguna ruta.**

```
gateReviewPhotos          tourist-entitlements.ts:289
gateCalendarAccess        accommodation-entitlements.ts:264
gateExternalCalendarSync  accommodation-entitlements.ts:321
gateWhatsAppDisplay       accommodation-entitlements.ts:383
gateWhatsAppDirect        accommodation-entitlements.ts:466
gateReviewResponse        accommodation-entitlements.ts:546
```

Los seis lo declaran arriba con el mismo comentario: `// PHANTOM-GATE (SPEC-145): route
not built yet`.

**Y dos de esos seis comentarios están caducos: la ruta SÍ existe, con otro mecanismo.**

- `gateCalendarAccess` dice *«route not built yet»* (`:261`), y `CAN_USE_CALENDAR` se
  chequea en **cuatro** rutas montadas con `requireEntitlement`:
  `routes/accommodation/protected/addOccupancy.ts:73`, `removeOccupancy.ts:52`,
  `updateOccupancyEvent.ts:89` y `batchOccupancy.ts:78`.
- `gateExternalCalendarSync` dice lo mismo (`:318`), y `CAN_SYNC_EXTERNAL_CALENDAR` está
  en `calendarSync.ts:100`, `calendarConnectGoogle.ts:155` y `calendarConnectIcal.ts:172`.

O sea que el gate quedó huérfano porque la ruta se construyó **por otro camino**, no
porque falte. Los otros cuatro comentarios no se contradicen: para `respond_reviews` y
`can_attach_review_photos` no hay ninguna otra referencia, y las dos de WhatsApp tienen
lecturas (`utils/tourist-entitlement-filter.ts:111,265` usa `DISPLAY` para filtrar el
contacto en el payload público) pero ninguna escritura gateada.

**Dos gates más no rechazan: recortan.** `gateRichDescription`
(`accommodation-entitlements.ts:84-121`) y `gateVideoEmbed` (`:158-227`) están montados
—10 y 12 ocurrencias en rutas— y ante la falta de la clave **no devuelven 403**:
neutralizan el markdown enriquecido (`:117-119`) o vacían el arreglo `videos`
(`:206`, `:218-223`) y llaman a `next()`. Es el único de los tres comportamientos
—403, recorte silencioso, informar en el cuerpo— que no deja rastro en la respuesta.

*Qué abre, sin resolverlo acá*: las doce claves están **vendidas** —viven en la fila del
plan y se dibujan en la tabla comparativa pública y en el editor de planes del admin—
y no hay nada del lado del servidor que cambie de comportamiento según se tengan o no.

---

### F-1B-038 — Hay una matriz de 896 rutas que declara el gate de cada una, y el guard que la vigila sólo verifica que los archivos existan

`apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts` (26.771 bytes) parsea un
markdown —`docs/billing/endpoint-gate-matrix.md`, 255.860 bytes en el ancla— con
`readFileSync` (`:85`) desde la ruta fija de `:68`, y lo compara contra los archivos de
`apps/api/src/routes`.

La tabla tiene **896 filas** con columnas `| ruta | archivo | decisión | claves | estado
| motivo |` (el layout está declarado en el comentario `:121-122` del guard), y las
decisiones se reparten así:

| decisión declarada | filas |
|---|---|
| `none` | **822** |
| `gate` | 52 |
| `gate+limit` | 17 |
| `limit` | 5 |

**Lo que el guard verifica son dos direcciones de presencia de archivo**, y nada más
(`:509-553`): que cada archivo nombrado por la matriz exista en disco, y que cada archivo
de ruta en disco tenga una fila. Hay además siete casos unitarios del parser
(`:431-508`) y un reporte de reconciliación de tamaños (`:554`).

**La columna `decisión` se parsea en el comentario y no se afirma en ningún `expect`.**
El guard extrae únicamente la columna 1 (el archivo). Una fila que declare `gate` sobre
una ruta que no lo aplica —o `none` sobre una que sí— pasa igual.

*Qué está medido y qué no*: contrastar las 896 filas contra el código da 3 rutas
declaradas `gate` y 13 declaradas `limit` donde no aparece el mecanismo esperado, y 22
declaradas `none` donde sí aparece uno. **Esos números no son un hallazgo**: la matriz es
documentación, que la regla de fuentes no admite, y el primer barrido ya demostró ser un
patrón mal escrito —`ai/protected/chat.ts` evalúa la cuota INLINE con
`getRemainingLimit`, `user-bookmark/protected/create.ts:73` usa
`assertFavoritesLimitOrThrow`, y ninguno de los dos matcheaba—. Quedan anotados como
**lista de sospechosos a leer uno por uno**, no como discrepancias.

Nota operativa, no del sistema: el commit `471a54b7a` de esta misma rama borró
`docs/billing/` entero y **dejó el guard en pie**. El `readFileSync` de `:85` no tiene
`existsSync` ni `skipIf` delante, así que en esta rama ese test tira `ENOENT`. En el
ancla los dos archivos existen.

---

### F-1B-039 — Once funciones de enforcement exportadas y montadas en cero rutas, y dos cuentan contra un cero escrito a mano

Sumando `F-1B-036` y `F-1B-037`, la superficie de enforcement que existe y no se usa:

| función | dónde | montada en |
|---|---|---|
| `requireLimit` | `middlewares/entitlement.ts:1402` | **0 rutas** |
| `gateReviewPhotos` | `middlewares/tourist-entitlements.ts:289` | 0 |
| `gateCalendarAccess` | `middlewares/accommodation-entitlements.ts:264` | 0 |
| `gateExternalCalendarSync` | `…:321` | 0 |
| `gateWhatsAppDisplay` | `…:383` | 0 |
| `gateWhatsAppDirect` | `…:466` | 0 |
| `gateReviewResponse` | `…:546` | 0 |
| `enforcePhotoLimit` | `middlewares/limit-enforcement.ts:329` | 0 |
| `enforceFavoritesLimit` | `…:682` | 0 |
| `enforcePropertiesLimit` | `…:738` | 0 |
| `enforceStaffAccountsLimit` | `…:853` | 0 |

Las que **sí** se montan del mismo archivo son `enforceAccommodationLimit` (`:201`, en 5
rutas), `enforcePromotionLimit` (`:440`, en 1) y `assertFavoritesLimitOrThrow` (`:587`,
en 1). O sea que dos de los cuatro `enforce*` sin montar están **reemplazados** por otro
camino —las fotos por `max_photos_per_accommodation`, con 15 referencias en rutas y
middlewares; los favoritos por el `assert…OrThrow` que
`routes/user-bookmark/protected/create.ts:73` llama **dentro del handler**, con el
comentario que explica por qué no es un middleware (`:70-92`)— y los otros dos no.

**`enforcePropertiesLimit` y `enforceStaffAccountsLimit` cuentan contra un literal.**
`limit-enforcement.ts:773` declara `const currentPropertyCount = 0;` y `:879` su gemelo
`const currentCount = 0;`, los dos bajo el
comentario `// RESERVED-LIMIT (SPEC-145): counting service not built` (`:760`, `:865`),
que además explica el efecto: *«the count is always 0 and the limit never fires»*. No es
inocuo del todo: `checkLimit` (`utils/limit-check.ts:194-204`) rechaza cuando
`maxAllowed === 0`, así que el stub **sí** rechazaría en un plan que declare la cuota en
cero, y nunca en ningún otro.

**El otro lado del mismo hecho está en el medidor.** `usage-tracking.service.ts:128-169`
clasifica cada `LimitKey` y marca **tres** como `UsageKind.UNBUILT`: `MAX_PROPERTIES`
(`:143`), `MAX_STAFF_ACCOUNTS` (`:144`) y `MAX_ACTIVE_PRIVATE_GALLERIES` (`:155`), o sea
sin contador. Las tres corresponden a claves de entitlement de las nueve de `F-1B-037`
que nadie chequea: `multi_property_management`, `staff_management` y
`manage_experience_private_galleries`. **La cuota sin contador y el permiso sin gate son
la misma función no construida, vista desde los dos ejes.**

El comentario de `:145-154` deja escrito qué pasa mientras tanto, y vale para las tres:
*«The cap is declared on all six commerce plan rows (an absent key would read as
UNLIMITED), but nothing creates, stores or expires a gallery yet»*, y *«Left here, it
would report a permanent `0 / 20` to a provider who is actually at their cap»*.

Y `max_active_private_galleries` es, de las 22, **la única sin una sola referencia en
rutas ni middlewares**: sus dos apariciones fuera del catálogo son esa línea del medidor
y `apps/web/src/lib/billing-limit-error.ts:142`.

---

### F-1B-040 — El `success: true` literal no es un patrón de billing: son nueve de los 47, y cinco están afuera

`F-1B-029` lo encontró en cuatro crons de billing. Leídos los **30 que no tocan
billing**, el patrón aparece en **cinco más**, y en los cinco el contador de errores
existe, se incrementa y se devuelve al lado sin participar del cálculo:

| cron | el `return` | dónde se incrementa `errors` |
|---|---|---|
| `alerts-digest` | `:210-217` | `:169`, `:222` |
| `conversation-notification` | `:416-423` | `:308`, `:311`, `:350`, `:378`, `:390`, `:399`, `:428` |
| `conversation-token-reminder` | `:456-463` | `:368`, `:397`, `:401`, `:407`, `:468` |
| `page-revalidation` | `:273-280` | `:127`, `:165`, `:218`, `:226`, `:290` |
| `host-trade-usage-reminder` | `:78-81` | `:66` |

En `page-revalidation` el mensaje lo dice y el campo lo desmiente en la misma línea:
`` `… cleaned up ${deleted} old log entries (${errors} errors)` `` junto a
`success: true`.

**Nueve de 47**, sumando los cuatro de `F-1B-029`. Del otro lado, **veinte** sí derivan
el resultado de un contador —`errors === 0` en diez (`subscription-poll:999`,
`finalize-cancelled-subs:803`, `partner-expiry:102`, `partner-payment-review:247`,
`partner-unpaid-reaper:213`, `preapproval-less-expiry:339`, `calendar-sync-google:135`,
`calendar-sync-ical:150`, `cloudinary-e2e-cleanup:113`,
`destination-weather-fetch:164` vía `summary.errors.length === 0`), más
`apply-scheduled-plan-changes:954`, `lead-intake-backstop:193`,
`propagate-plan-price-changes:1594`, `social-publish-dispatch:286` y seis que propagan
un `cronResult.success` calculado adentro de la transacción.

**Y hay una tercera forma, declarada.** `exchange-rate-fetch:181` no usa ninguna de las
dos: `const success = !hadErrors || result.stored > 0`, o sea que una corrida con errores
se reporta exitosa si guardó aunque sea una cotización. Es la única de las 47 con una
política de éxito parcial escrita explícitamente.

El resto —los purgadores y los rollups— escribe `success: true` con `errors: 0` fijo
porque no tiene bucle donde acumular un error: ahí el literal no esconde nada.

---

### F-1B-041 — Catorce de los 47 toman lock, dos lo RETIRARON a propósito, y contar por archivo da diecisiete

**Los 14 que ejecutan `pg_try_advisory_xact_lock`**, verificados excluyendo las líneas
que empiezan con `*` o `//`:

```
abandoned-pending-subs:434   addon-expiry:246              addon-subscription-reconcile:487
archive-abandoned-drafts:181 archive-expired-promotions:103 conversation-token-cleanup:77
destination-weather-fetch:135 dunning:295                  exchange-rate-fetch:93
notification-schedule:251    social-publish-dispatch:200   subscription-drift-reconcile:504
subscription-poll:917        webhook-retry:866
```

**Los otros 33 no toman ninguno**, y en tres de ellos eso está decidido y escrito:

| cron | qué dice y dónde |
|---|---|
| `conversation-notification` | *«Lock `43020` … has been REMOVED»* (`:52`); usa un claim atómico en Redis (`:162-169`) que **falla abierto** si Redis no responde (`:155-160`, `:170-176`) |
| `conversation-token-reminder` | *«Lock `43021` … has been REMOVED»* (`:47`), *«added serialization overhead without closing a…»* (`:57`); dedupe por la columna `*_reminder_sent_at` |
| `calendar-sync-google` | el docblock (`:11`) declara que deliberadamente no lo toma |

**Contar por archivo da 17 y no 14**, porque el patrón matchea los comentarios de esos
tres. Es la novena vez que un conteo por patrón da mal, y la primera en que el error lo
produce la propia documentación del código.

`social-publish-dispatch:43` deja anotado que su lock `43032` *«continues the
non-billing 4300x series»*: los de billing y los del resto están en rangos distintos, y
`exchange-rate-fetch` usa `1008`, fuera de los dos.

**Dónde se toma importa tanto como si se toma.** `destination-weather-fetch` documenta
(`:14-34`) que parte la corrida en dos fases —fetch HTTP afuera, persistencia adentro del
lock— para no sostener una transacción abierta mientras habla con la red.
`exchange-rate-fetch` hace lo contrario: el lock se toma en `:93` y las dos llamadas HTTP
—DolarAPI y ExchangeRate-API— ocurren **dentro** del mismo callback de `withTransaction`
(`:117-119` en el camino de dry-run, y dentro de `fetchAndStore()` en `:157`).

---

### F-1B-042 — La `description` que ve un administrador no describe el cuerpo en cuatro crons, y dos de los casos nuevos están fuera de billing

`F-1B-024` (`finalize-cancelled-subs`) y `F-1B-028` (`addon-expiry`) eran los dos de
billing. Los 30 restantes aportan **dos más**:

| cron | qué declara la `description` | qué hace el cuerpo |
|---|---|---|
| `entity-views-purge` | *«Purge entity_views rows older than 95 days»* (`:38`) | purga **dos** tablas: `entity_views` (`:68`) y `partner_logo_clicks` (`:79`). El comentario de `:72-78` explica que la segunda se plegó acá en vez de crear otro cron; la `description` no se actualizó. |
| `partner-payment-review` | *«Ask an admin whether a partner … **Never changes the partner state itself**»* (`:98-99`) | escribe `partners.payment_review_state = PENDING_CONFIRMATION` (`:182-187`) |

El segundo tiene la contradicción **adentro del mismo archivo**: el comentario de `:178`
llama a esa línea *«The ONLY write this job performs on a partner»*. El docblock del
módulo (`:22-27`) reconcilia las dos afirmaciones definiendo «estado» como
`subscriptionStatus` / `lifecycleState` / visibilidad, pero el string `description` —que
es lo único que se muestra en un panel de crons— dice *«never changes the partner state
itself»* sin esa aclaración.

Son **cuatro de 47**, y las cuatro fallan del mismo lado: la `description` describe una
versión anterior o más angosta del trabajo, nunca una más amplia.

---

### F-1B-043 — El horario tiene una CUARTA fuente que `F-1B-017` no vio: la base de datos

`F-1B-017` midió que 3 de los 47 leen su horario de una variable de entorno y dio por
sentado que los otros 44 lo declaran en el código. **Uno no**: `social-publish-dispatch`
lo lee de la base.

El mecanismo es un campo opcional del tipo, `resolveSchedule?: () => Promise<string>`
(`apps/api/src/cron/types.ts:96`), y `bootstrap.ts:115-121` lo prefiere sobre
`job.schedule` cuando está presente, cayendo al literal sólo si la promesa rechaza:

```ts
let scheduleExpression = job.schedule;
if (job.resolveSchedule) {
    try { scheduleExpression = await job.resolveSchedule(); } catch { /* warn + fallback */ }
}
```

**Lo declara un solo job de los 47** (`social-publish-dispatch.job.ts:134`), y su
resolvedor (`:112-118`) lee la fila `dispatch_cron_cadence` de `social_settings` y la
valida con `resolveDispatchCronCadence`. El literal `'*/5 * * * *'` de `:131` lleva el
comentario *«Documented default»*.

Se resuelve **una vez, al arrancar el scheduler** (`:108-110`), así que cambiar el
setting no tiene efecto hasta el próximo reinicio del proceso.

**En producción los dos coinciden**: `social_settings.dispatch_cron_cadence` vale
`*/5 * * * *`, medido contra la base de prod el 2026-09-16. O sea que hoy esta fuente no
produce ninguna divergencia — a diferencia de `page-revalidation`, que sí corre distinto
de su default (`F-1B-017`). Lo que cambia es el denominador: **el horario real de un cron
puede salir de tres lugares** —el literal, el entorno, la base— y el tercero no es
visible en el archivo del job sin seguir el `resolveSchedule`.

---

### F-1B-044 — Correr un cron en dry-run no dice qué va a hacer: en ocho devuelve cero sin medir nada, y uno no lo tiene

`F-1B-020` lo encontró en `trial-reconcile`, donde las dos ramas no comparten una línea.
Leídos los 47, la forma se repite y tiene dos extremos.

**Ocho devuelven `processed: 0` sin contar nada**, con el mismo bloque casi literal:

```
app-log-purge:42     cron-run-purge:47        entity-views-purge:52
host-trade-usage-expiry:34   media-orphan-cleanup:86  newsletter-close-campaigns:45
notification-log-purge:38    view-monthly-rollup:85
```

Cuatro de ellos son idénticos hasta en el mensaje —*«Dry run - no records purged»*, con
`processed: 0, errors: 0, details: { dryRun: true }`— y ninguno ejecuta la consulta que
diría cuántas filas alcanzaría. La rama sale **antes** de construir el servicio.

**El contraste está adentro del mismo lote.** `conversation-token-cleanup` sí mide: su
rama de dry-run corre un `select` de conteo (`:93-101`) y devuelve `wouldRevoke`
(`:109-115`), mientras la real corre el `update` (`:120-129`). `alerts-digest` devuelve
`wouldProcess` (`:142-154`). `lead-intake-backstop`, `partner-expiry`,
`partner-payment-review` y `partner-unpaid-reaper` reportan el conjunto de candidatos que
ya trajeron.

**Uno no tiene dry-run.** `poll-apify-reputation-runs` destructura sólo
`{ logger, startedAt }` (`:108`) y nunca consulta `dryRun`: es el único de los 47
handlers donde la bandera no existe. Correrlo «en seco» lo corre de verdad — hace upserts
en la tabla de reputación (`:209-224`, `:240-249`, `:267-277`) y habla con Apify
(`:179`, `:195`).

**Y en dos, la bandera se pasa a otra función en vez de ramificar acá**:
`destination-weather-fetch:141` la reenvía a `fetcher.persist(fetchResults, { dryRun, tx })`
—con el fetch HTTP ya ejecutado en `:128`, dry-run o no— y
`host-trade-stats-reconcile:35-37` se la pasa entera a `reconcileAllHostTradeAggregates`.
En los dos casos **qué hace el dry-run no se puede leer en el archivo del job**.

---

### F-1B-045 — El checkout que corre en producción es el que el código llama «apagado», y el flag alcanza cuatro caminos donde su registro dice uno

`apps/api/src/services/subscription-checkout.service.ts` (2.283 líneas, el archivo más
grande de `apps/api/src/services`) implementa **dos flujos completos por cada punto de
entrada**, elegidos por `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`:

- **Path C** — no se crea ninguna preapproval del lado nuestro. Se resuelve/provisiona un
  `preapproval_plan` de MercadoPago, se materializa una suscripción local en
  `pending_provider` más una fila de correlación en `billing_pending_checkouts`, y se
  redirige al **share link hosteado** de ese plan.
- **Own preapproval** — se crea un `POST /preapproval` propio por usuario, servidor a
  servidor (`own-preapproval-subscription-create.ts`, vía `createPaidSubscription` →
  `billing.subscriptions.create({ mode: 'paid' })`).

**El flag vale `true` en producción y en staging.** Medido el 2026-09-16 con
`hops --target=prod env-list api --reveal --match OWN_PREAPPROVAL` y su equivalente en
staging: `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED=true` en los dos slots.

**Y el código afirma tres veces lo contrario:**

| dónde | qué dice |
|---|---|
| `subscription-checkout.service.ts:18` | *«**Path C (flag off, live in production).**»* |
| `routes/commerce/protected/start-subscription.ts:587` | *«whenever `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` is off, **which is production today**»* |
| `packages/config/src/env-registry.hospeda.ts:958` | *«**Ships dark (default false)**»* |

El default sí es `false`: el registro lo declara en `:963` y el schema lo transforma con
`.optional().transform((v) => v === 'true')` (`apps/api/src/utils/env-schema.ts:512-515`),
así que sin setear queda apagado. Lo que está setado es el valor en Coolify.

**La segunda contradicción es de alcance.** El registro (`:963`) y el docblock del schema
(`env-schema.ts:508-510`) dicen, con las mismas palabras: *«Scoped to accommodation
monthly only — annual, commerce and partner checkouts are unaffected regardless of this
flag»*. El código lo lee en **los cuatro** puntos de entrada:

| entrada | función | dónde ramifica |
|---|---|---|
| accommodation mensual | `initiatePaidMonthlySubscription:479` | `:809` |
| commerce | `initiateCommerceSubscription:1071` | `:1231` |
| partner | `initiatePartnerMonthlySubscription:1441` | `:1531` |
| accommodation anual | `initiatePaidAnnualSubscription:1748` | `:1910` |

(más cuatro lecturas gemelas en `:734`, `:1184`, `:1501` y `:1881`, que eligen **qué
estrategia de reuso** aplica la idempotencia del checkout). La quinta entrada,
`initiatePaidPlanUpgrade:2092`, no lo lee.

**Qué cambia por leerlo al revés.** El camino que corre es el que crea una preapproval
real antes de escribir el estado local, o sea que la ventana de compensación que el
código documenta como *«Hueco A»* es la viva, no la apagada:
`own-preapproval-subscription-create.ts:430-470` captura el fallo de la escritura local
posterior al `POST /preapproval`, intenta un `hardCancelPreapprovalBestEffort` y, cuando
ese intento devuelve `failed`, loguea *«needs manual reconciliation, this is exactly the
orphan class HOS-937 targets»* (`:467`). Con el flag apagado esa rama es inalcanzable;
con el flag prendido es el camino normal de todo checkout.

Cruza con `F-1B-013`: las dos veces que este relevamiento comparó una afirmación del
código contra el entorno desplegado —el documento OpenAPI y este flag— el entorno decía
otra cosa, y en las dos la afirmación estaba escrita en un comentario.

**Y el PDR coincide con la medición, no con los comentarios.** El §5.6 —*«Finalmente
decidimos abandonar Path C como modelo principal… Hospeda crea explícitamente el
`preapproval` mediante API»*— describe exactamente lo que el flag prendido hace hoy. O
sea que lo desactualizado no es el relato del dueño: son los tres comentarios del código
que siguen diciendo que producción corre Path C.

---

### F-1B-046 — De los ocho métodos de `TrialService`, tres no los llama nadie

`apps/api/src/services/trial.service.ts` son 2.160 líneas con una clase de **ocho
métodos públicos**. Contados los call sites fuera del propio archivo y fuera de tests:

| método | líneas | call sites |
|---|---|---|
| `getTrialStatus` | `:385-787` | 7 |
| `reconcileExpiredTrials` | `:876-1227` | 2 (`routes/billing/trial.ts:397`, `cron/jobs/trial-expiry.ts:141`) |
| `extendTrial` | `:1236-1318` | 1 |
| `reactivateFromTrial` | `:1355-1547` | 1 |
| `reactivateSubscription` | `:1579-1876` | 1 |
| **`checkTrialExpiry`** | `:796-799` | **0** |
| **`findTrialsEndingSoon`** | `:1886-2019` | **0** |
| **`reconcileDuplicateSubscriptions`** | `:2047-2159` | **0** |

Los tres últimos están completos y no los invoca ninguna ruta, ningún cron y ningún otro
servicio. `reconcileDuplicateSubscriptions` tiene **una sola** aparición en el repo fuera
de su definición: el `@example` de su propio JSDoc (`:2041`).

Es el mismo hallazgo de forma que `F-1B-039` en el eje de los gates: superficie escrita,
probada y nunca alcanzada. Acá son **≈290 líneas** de los 2.160 del archivo.

---

### F-1B-047 — Sí existe un trial sin tarjeta: no sale del checkout, sale de publicar

`apps/api/src/services/subscription-trial-create.service.ts:146` exporta
`createTrialSubscription`, que **inserta una fila de `billing_subscriptions` con
`status: TRIALING` y sin `mpSubscriptionId`** (`:213-232`). El propio código marca la
ausencia como deliberada (`:211-212`): *«No `mpSubscriptionId` is named here, and that is
load-bearing rather than an omission: there is no MercadoPago object to point at»*.

`trialStart` es el reloj local y `trialEnd` es aritmética local (`:206-207`):

```ts
const trialStart = input.now ?? new Date();
const trialEnd = new Date(trialStart.getTime() + trialDays * MS_PER_DAY);
```

`currentPeriodStart` / `currentPeriodEnd` se apuntan a esa misma ventana (`:223-224`),
con el motivo escrito: `currentPeriodEnd` es `NOT NULL` en el esquema de qzpay.

**Tiene exactamente dos llamadores**, los dos fuera del checkout:

| llamador | qué lo dispara |
|---|---|
| `apps/api/src/services/accommodation-publish-deps.ts:265` | la primera publicación de un alojamiento (`metadata.source = 'first-publish-trial'`, `:231`) |
| `apps/api/src/services/commerce-trial-start.service.ts:339` | el arranque del trial de un listing de commerce |

Esto no contradice a `F-1B-045` ni al camino pago: los cinco puntos de entrada del
checkout siguen mandando `trialDays: 0` a MercadoPago. Lo que agrega es que **el trial de
la plataforma tiene dos orígenes distintos** —uno con preapproval y tarjeta, otro sin
nada de eso— y sólo el primero está atado a un objeto del proveedor.

`trial.service.ts` nunca importa `createTrialSubscription`: lo nombra en tres comentarios
(`:116`, `:147`, `:544`) afirmando que tiene dos call sites, y la afirmación coincide con
lo medido.

---

### F-1B-048 — Los tres trials vivos de producción, explicados fila por fila, y el hueco que ninguno ocupa

Las **8** suscripciones de `F-1B-009`, con las columnas que deciden qué cron las mira
(medido en prod el 2026-09-16):

| estado | filas | `mp_subscription_id` | `trial_end` |
|---|---|---|---|
| `trialing` | 3 | presente en las 3 | presente en las 3 |
| `abandoned` | 3 | **nulo** en las 3 | presente |
| `comp` | 2 | **nulo** en las 2 | **nulo** |

**Las tres en trial tienen dos duraciones distintas**, y la diferencia no es un error:

| plan | trial | por qué |
|---|---|---|
| `owner-basico` | **30 días** | `OWNER_TRIAL_DAYS = 30` (`packages/billing/src/constants/billing.constants.ts:17`) |
| `owner-pro` | **90 días** | 30 + `LANZAMIENTO60` |
| `owner-premium` | **90 días** | 30 + `LANZAMIENTO60` |

Verificado por el camino completo, no por la aritmética: `billing_promo_code_usage`
tiene 4 filas, y las dos que apuntan a esas suscripciones usan el código
`LANZAMIENTO60`, cuyo `effect_kind` es `trial_extension` con `extra_days = 60`. Las
otras dos usan `HOSPEDA_FREE` (`effect_kind = comp`) y son exactamente las dos filas
`comp`. **Ninguna de las tres tiene un evento de extensión**: sus únicos eventos en
`billing_subscription_events` son un `WEBHOOK_SUBSCRIPTION_TRIALING` cada una, o sea que
los 90 días se fijaron al crearse.

**Y el catálogo dice 30 en todos lados**: `metadata->>'trialDays'` vale `30` en las seis
filas de planes de `accommodation` (`owner-basico`, `owner-pro`, `owner-premium`,
`owner-trial`, `tourist-plus`; `owner-test-daily` vale `1`), y **`billing_prices.trial_days`
es nulo en las 30 filas**. La duración real de un trial no sale de la fila del plan ni de
la del precio: sale del constante de TypeScript más lo que sume una promo.

**El hueco medido**: una fila `trialing` con `trial_end` nulo sería invisible para los dos
mecanismos que expiran trials —la consulta de reclamo de `reconcileExpiredTrials` exige
`isNotNull(trialEnd)` (`trial.service.ts:936`) y `expireLocalTrial` trata `!trialEnd` como
*no vencido* (`trial-local-expiry.service.ts:325`)— y quedaría en `trialing` para siempre.
**Hoy no existe ninguna**: las tres tienen fecha. Las únicas dos filas sin `trial_end` son
las `comp`, que ningún camino de trial mira.

*Qué abre, sin resolverlo acá*: `DEC-TRIAL-*` y el §10.3 razonan sobre «el trial» como
una duración del plan. La medición dice que hoy es un constante del código más un efecto
de promo, y que la base guarda tres números distintos (30 en la metadata del plan, nulo
en el precio, 30 o 90 en la suscripción).

---

## Carriles pendientes

Ninguno empezado. El orden no está decidido.

| Carril | Denominador | Estado |
|---|---|---|
| ~~Esquema: censo de columnas, constraints y enums~~ | — | ✅ `F-1B-006` a `F-1B-009` |
| ~~Las 399 claves foráneas y la frontera hospeda↔qzpay~~ | — | ✅ `F-1B-010` |
| Las 358 FK internas de hospeda: el grafo de dependencias del dominio | 358 | ⬜ |
| ~~Los 836 índices y los 132 triggers~~ | — | ✅ `F-1B-011`, `F-1B-012` |
| Los 46 índices parciales y los 21 de expresión: qué condición imponen | 67 | ⬜ |
| Los 90 `pgEnum` y su correspondencia con los enums de `@repo/schemas` | 90 | ⬜ |
| ~~Los 47 crons: nombre, horario y habilitación~~ | — | ✅ `F-1B-003`, `F-1B-017` |
| ~~Los 17 handlers de billing, leídos por dentro~~ | — | ✅ `F-1B-018` a `F-1B-031` |
| ~~Los 30 crons restantes (no tocan billing)~~ | 30 | ✅ `F-1B-040` a `F-1B-044` — **47 de 47** leídos |
| ~~Endpoints registrados por tier~~ | — | ✅ `F-1B-016` |
| Qué hace cada uno de los 1.032 handlers | 1.032 | ⬜ |
| Los 67 servicios: métodos públicos y qué validan | 67 | ⬜ |
| Las 337 funciones de `apps/api/src/services` | 337 | ⬜ |
| ~~Entitlements y limits: el catálogo y su reflejo en la base~~ | — | ✅ `F-1B-033`, `F-1B-034`, `F-1B-035` |
| ~~Dónde se CONSUMEN las 53 + 22 claves~~ | 75 | ✅ `F-1B-036` a `F-1B-039` — **75 de 75** medidas |
| Los 16 archivos de rutas que la matriz y el código no coinciden: leer uno por uno | 16 | ⬜ (`F-1B-038`) |
| Superficies Web | por medir | ⬜ |
| Superficies Admin | por medir | ⬜ |
| ~~Las migraciones: qué quedó aplicado~~ | — | ✅ `F-1B-014`, `F-1B-015` |
| Qué hace cada una de las 125 estructurales: columnas muertas, renames, drops | 125 | ⬜ |
| Tests: qué comportamiento afirman (como evidencia de intención, no de corrección) | por medir | ⬜ |

Y en **qzpay**, con el mismo criterio:

| Carril | Denominador | Estado |
|---|---|---|
| `core` — el motor: qué expone y qué decide | 89 archivos / 22.120 líneas | ⬜ |
| `drizzle` — las 27 tablas: columnas, constraints e índices | 27 tablas / 68 archivos | ⬜ |
| `mercadopago` — el adaptador, contra las 89 filas ya medidas en 1C | 16 archivos | ⬜ |
| `hono` y `react` — las superficies que hospeda monta | 50 archivos | ⬜ |
| La frontera: qué decide qzpay y qué decide hospeda sobre el mismo hecho | por medir | ⬜ |
| ~~El vocabulario de estados y sus mapas~~ | — | ✅ `F-1B-021` |
| Los otros vocabularios compartidos: pago, factura, reembolso, addon | por medir | ⬜ |
| `stripe`, `nestjs`, `cli`, `dev` — sin consumidor en hospeda | 85 archivos | ⬜ |
