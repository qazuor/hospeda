---
title: FASE 1B — discovery del sistema actual, sólo contra el código
linear: HOS-1352
statusSource: linear
created: 2026-09-16
updated: 2026-09-17
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
| Archivos de `apps/web/src` | **1.049** | `fd -e ts -e tsx -e astro` | **15** lo importan fuera de tests (42 lo mencionan — ver `F-1B-089`) |
| Archivos de `apps/admin/src` | **1.454** | idem | **22** lo importan fuera de tests (25 lo mencionan — ver `F-1B-089`) · 31 nombran las claves |
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

> ⚠️ **Corregido el 2026-09-17 por `F-1B-074`.** Los parciales son **46** y ese número se
> sostiene, pero los de expresión son **2**, no 21. El 21 salió de buscar patrones en el
> texto del `indexdef`, que matchea los casts `::text` y los `lower(…)` del **predicado**;
> un índice de expresión es el que la tiene en la **clave**, y eso lo dice el catálogo:
> `pg_index.indexprs IS NOT NULL`.

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

> ⚠️ **Ruta corregida el 2026-09-16 por `F-1B-063`.** Las dos líneas son correctas, el
> archivo no: viven en
> `packages/service-core/src/services/billing/addon/addon-expiration.queries.ts`. El
> `apps/api/src/services/addon-expiration.queries.ts` que nombraba esta cita es un shim
> de re-export de **20 líneas**, así que sus líneas 237 y 322 no existen.

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

### F-1B-049 — Los siete flags de billing, medidos en los dos entornos: tres corren al revés de su default y uno difiere ENTRE prod y staging

`F-1B-045` encontró uno. Medidos **los siete** flags booleanos de categoría `billing` del
registro (`packages/config/src/env-registry.hospeda.ts`, 126 entradas, 20 booleanas),
contra Coolify el 2026-09-16:

| flag | default declarado | **producción** | **staging** |
|---|---|---|---|
| `HOSPEDA_ADDON_LIFECYCLE_ENABLED` | `true` | `true` | `true` |
| `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` | `false` | **`true`** | **`true`** |
| `HOSPEDA_BILLING_POLLING_ENABLED` | `true` | **sin setear** | **sin setear** |
| `HOSPEDA_BILLING_PRICE_INCREASE_ENABLED` | `false` | `false` | `false` |
| `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` | `false` | **`true`** | **`false`** |
| `HOSPEDA_MERCADO_PAGO_SANDBOX` | `true` | `false` | `true` |
| `HOSPEDA_USER_CANCEL_ENABLED` | `false` | **`true`** | **`true`** |

**Tres de los siete corren al revés de su default declarado** —los tres que el registro
describe como apagados por seguridad— y `MERCADO_PAGO_SANDBOX` también, con la diferencia
de que ése es el valor que producción **tiene que** tener.

**Uno difiere entre los dos entornos, y es el que decide cómo se cobra un addon.**
Con `RECURRING_ADDONS_ENABLED` en `true`, `createAddonCheckout` toma la rama de
preapproval propio (`addon.checkout.ts:623-648`); en `false` toma la de `Preference` de
pago único (`:650-746`). O sea que **producción cobra addons por un camino y staging por
el otro**. El comentario que decide la rama (`addon.checkout.ts:473-475`) dice: *«Off
(the production default, **and the only value any environment has today**)»* — producción
lo tiene en `true`.

El registro, además, describe lo que pasa si se prende antes de tener la cadena completa
(`env-registry.hospeda.ts:990`): la fila de `billing_subscriptions` del addon lleva un
`mp_subscription_id` real y *«el handler genérico de MercadoPago resuelve los eventos de
preapproval contra esa columna sin filtrar por product_domain, así que matchea la fila del
addon y corre la activación de PLAN completa sobre algo que no es un plan»*. La cadena
existe —el handler es `addon-recurring-handler.ts` (`F-1B-027`) y el reconciliador es el
cron `addon-subscription-reconcile` (`F-1B-018`)—, así que esto queda anotado como la
condición que el propio registro pone, verificada como cumplida, no como un problema.

**Y hay un octavo flag, de categoría `testing`, prendido en producción**:
`HOSPEDA_SHOW_TEST_BILLING_PLAN=true` en los dos entornos.
`subscription-checkout.service.ts:159` lo describe como *«the SOLE gate»* del checkout del
plan oculto `owner-test-daily` —ARS 15 por **día**, `billing_prices` id `7f3873da`, interval
`day`—. Medido contra el sistema que corre: `GET /api/v1/public/plans` en producción
devuelve **tres** planes (`owner-basico`, `owner-pro`, `owner-premium`) y **no** lista el
de prueba, así que el plan no se ofrece; lo que el flag habilita es que un checkout con ese
slug **no sea rechazado**.

*Qué abre, sin resolverlo acá*: el `defaultValue` del registro describe con qué nace una
variable, no con qué corre el sistema. Las tres divergencias de arriba no se ven en ningún
diff, ningún test y ningún guard: sólo leyendo Coolify.

---

### F-1B-050 — El checkout de addons tiene dos caminos con idempotencia opuesta, y el que corre en producción no tiene reintento

`apps/api/src/services/addon.checkout.ts` son 1.605 líneas que exportan **dos** funciones
—`createAddonCheckout:263` y `confirmAddonPurchase:954`— más una constante. Las
validaciones compartidas (catálogo, propiedad del listing, suscripción activa, dominio,
categoría de plan, promo) terminan en `:612`, y ahí se abre la bifurcación de `F-1B-049`.

| | pago único (`Preference`) | recurrente (preapproval propio) |
|---|---|---|
| dónde | `:650-746` | `:623-648` |
| corre en | **staging** | **producción** |
| idempotencia | `randomUUID()` fresco por invocación (`:573`) | `resolveRecurringAddonCheckoutIdempotency`, que **lee una fila previa** antes de acuñar |
| confirmación | polling (`scheduleAddonCheckoutPolling:777`) | **sólo webhook** |

**La idempotencia del camino de pago único no existe, y el archivo lo dice de sí mismo.**
El comentario de `:553-572` corrige una versión anterior de sí mismo: *«the line below
this comment used to be preceded by the claim "a retry from the same logical checkout
reuses the same UUID" — that is FALSE»*, y describe la consecuencia: *«two clicks (or the
client's own retry) produce two DIFFERENT UUIDs, two DIFFERENT `idempotencyKey`s, and two
independently payable MercadoPago Preferences for the same one-time add-on purchase»*.
La línea `:573` es `const checkoutUuid = randomUUID();` sin ninguna consulta previa, y
`:697` la manda como `idempotencyKey`. El propio comentario cierra con *«NOT fixed here…
Tracked as a follow-up rather than built here»*.

**Y el camino que corre en producción es el que no tiene canal de reintento.** El
comentario de `:617-621` explica la asimetría: una `Preference` de MercadoPago no emite
ningún evento de Webhooks v2, así que el polling es su **único** canal de confirmación; un
preapproval sí los emite, y por eso la rama recurrente no agenda polling. Verificado: el
`return` de `:623` sale antes de `scheduleAddonCheckoutPolling` (`:777`). Si ese webhook no
llega, **nada re-dispara la confirmación** de un addon recurrente desde este archivo.

Eso empalma con `F-1B-027`, que midió que `addon-recurring-handler.ts:266` devuelve
`handled: true` aunque la liquidación tire, y con `F-1B-019`: el evento se marca resuelto y
sale de la cola de dead-letter.

**La confirmación se da por buena aunque el permiso no se otorgue.**
`confirmAddonPurchase` llama `applyAddonEntitlements` en `:1412`; si falla, loguea, marca
`needsEntitlementSync: true` en la fila (`:1432-1439`) y **devuelve éxito igual**
(`:1591`). El comentario de `:1410-1411` nombra el backstop: *«the addon-expiry cron's
Phase 7 grant-reconciliation sweep»*. Esa fase es una de las tres que `F-1B-028` midió
como **no documentadas** en el docblock de su propio módulo, dentro del cron que
`F-1B-029` midió devolviendo `success: true` literal para las siete fases.

La misma forma se repite dos veces más en la confirmación: si falla el `insert` en
`featured_listing_addon_grants` (`:1328-1354`) o si falta la metadata del target
(`:1378-1402`), se loguea, se captura en Sentry y la compra se confirma igual.

---

### F-1B-051 — El tercer nivel de reconciliación quedó inalcanzable por el flag que sí está prendido

`linkPreapprovalToLocalSub`
(`apps/api/src/services/billing/link-preapproval.service.ts:1002`) resuelve **qué fila
local corresponde a una preapproval** por tres niveles, en orden estricto
(`resolvePendingCheckout:198-344`):

| nivel | con qué resuelve | cuándo se usa |
|---|---|---|
| 1 | `expectedLocalSubscriptionId` + `customerId` | el `back_url` del navegador |
| 2 | `externalReference` (el nonce) | el webhook `subscription_preapproval` |
| 3 | `preapproval_plan_id` + email + ventana de 24h | cuando no hay ninguno de los dos |

**El nivel 3 no puede resolver nada para una preapproval creada por el camino que corre
hoy.** La cadena está verificada eslabón por eslabón:

1. La rama de preapproval propio crea una preapproval **ad-hoc**:
   `own-preapproval-subscription-create.ts:50` — *«the preapproval this creates carries NO
   `preapproval_plan_id`»* (HOS-1221) — y hay un guard de CI que lo mantiene así,
   `scripts/check-no-plan-id-to-own-preapproval.sh`.
2. La respuesta REST de una preapproval ad-hoc trae ese campo en nulo:
   `apps/api/src/utils/mp-preapproval-plan-lookup.ts:53-56` — *«`preapproval_plan_id` is
   `null` on the response for an ad-hoc (non-plan-based) preapproval»*.
3. `resolvePendingCheckout:281-287` corta con `not_found` **antes** de buscar candidatos
   cuando ese campo es falsy: `if (planLookup.kind !== 'ok' || !planLookup.preapprovalPlanId)`.

O sea que `findReconcileCandidates` ni siquiera se llega a ejecutar.

**Y hay un camino que sólo puede usar el nivel 3.** El webhook de
`subscription_authorized_payment` —el que llega cuando MercadoPago **ya cobró**— pasa los
dos campos en nulo a propósito (`subscription-payment-handler.ts:975-985`:
`externalReference: null, payerEmail: null`), con el comentario que lo explica: *«Passing
`null` for both only affects which resolution tier is attempted here (Tier 2/heuristic
fall through to Tier 3 directly)»*. Bajo el estado real del flag, esa caída termina
siempre en `not_found`.

**Qué NO es esto**: no es que las suscripciones queden sin vincular. El sentido del
preapproval propio es justamente que el `external_reference` sobrevive, así que el nivel 2
resuelve por el webhook de `subscription_preapproval`. Lo que quedó sin piso es el
**fallback**: el nivel 3 existía para el caso en que Path C perdía el
`external_reference`, y hoy es código inalcanzable para todo lo que se cree de acá en
adelante — alcanzable sólo para filas `pending_provider` heredadas de la época de Path C.

El módulo entero está escrito sobre la premisa contraria: `link-preapproval.service.ts:4-6`
abre con *«Path C's `/start-paid` never creates the MercadoPago preapproval
server-side»*, y el propio archivo del lookup dice *«Path C always creates plan-based
preapprovals»* (`mp-preapproval-plan-lookup.ts:54-55`). Es la tercera y cuarta afirmación
de código que `F-1B-045` desmiente con el valor medido en Coolify.

*Nota de método*: el sub-agente que leyó este archivo atribuyó además un comentario de
«tres llamadores» a `subscription-logic.ts`. **No existe**: `rg "three callers"` sobre
`apps/api/src` no devuelve nada. Lo verificable es el conteo —`processSubscriptionUpdated`
tiene **cuatro** llamadores: `subscription-handler.ts:54`, `webhook-retry.job.ts:174`,
`subscription-poll.job.ts:183` y `subscription-drift-reconcile.job.ts:655`— y queda
anotado como conteo, no como contradicción con un comentario que no está.

---

### F-1B-052 — Veinticuatro de las 333 funciones exportadas de `apps/api/src/services` no las consume nadie fuera de su archivo

**El denominador, descompuesto.** `F-1B-032` contó 337 funciones exportadas. Medidas por
sintaxis son **320 `export function` + 17 `export const … = (…)`**, que da exactamente
337; los **nombres distintos** son **333**, porque cuatro se exportan desde dos archivos:

```
buildChatSystemMessage   accommodation-ai-context.ts     ·  ai-context/owner-data-fence.ts
exchangeAuthorizationCode  mercadolibre-oauth/ml-oauth-client.ts · google-calendar/google-oauth-client.ts
refreshAccessToken         mercadolibre-oauth/ml-oauth-client.ts · google-calendar/google-oauth-client.ts
needsRefresh               mercadolibre-oauth/ml-token.service.ts · google-calendar/google-token.service.ts
```

Los tres últimos son el mismo trío de OAuth escrito dos veces, una por proveedor.

**El barrido.** Tokenizando los **6.624** archivos fuente de `apps/api/src`,
`apps/web/src`, `apps/admin/src` y `packages` (sin tests, sin `dist`), **24 de los 333
nombres no aparecen en ningún archivo que no sea el suyo**:

| categoría | cuántos | cuáles |
|---|---|---|
| Sólo los alcanza un test | **21** | `addMonthsClamped`, `admitsAddonGrant`, `applyCommerceUpgradeRestorations`, `buildExperienceMarkdownContext`, `buildGastronomyMarkdownContext`, `buildMarkdownContext`, `buildOrphanPaymentRow`, `causeHonoursPaidPeriod`, `claimRetryMintSlot`, `clearTouristVipGiftCache`, `computePlanChangeDelta`, `confirmCancellationDeferred`, `detectCoverFormat`, `formatCertificateDate`, `migrateSocialCredentialsToVault`, `parseIcsToRows`, `resetBillingMetricsService`, `resetMediaProviderForTesting`, `resolveCommerceListingCap`, `syncAccommodationSubscriptionCacheForOwner`, `unpublishListingsForExpiredTrial` |
| Se usa sólo dentro de su archivo | 1 | `getNewsletterDispatchQueue` (`newsletter/delivery-factory.ts:121`) |
| **Una sola ocurrencia en todo el repo: su propia definición** | **2** | `isOccupyingEvent` (`google-calendar/google-calendar-occupancy-filter.ts:102`), `_resetNewsletterDeliveryFactory` (`newsletter/delivery-factory.ts:214`) |

Los dos últimos no los llama ni un test: el `rg` de su nombre sobre `apps` y `packages`
devuelve exactamente una línea, la del `export`.

**Qué NO dice esta medición.** Que una función sólo la alcance un test no la hace
inservible: `resetMediaProviderForTesting`, `resetBillingMetricsService`,
`clearTouristVipGiftCache` y `_resetNewsletterDeliveryFactory` existen **para** los tests
por su propio nombre. Lo que la medición fija es el reparto: de 333 funciones exportadas,
**309 tienen al menos un consumidor real** y 24 no, y entre esas 24 hay nombres que
describen trabajo de producción —`unpublishListingsForExpiredTrial`,
`applyCommerceUpgradeRestorations`, `confirmCancellationDeferred`, `parseIcsToRows`— cuyo
único llamador vive en `test/`.

Es el tercer conteo de superficie inalcanzable del relevamiento, después de los once gates
de `F-1B-039` y los tres métodos de `F-1B-046`.

---

### F-1B-053 — La duplicación no es de nombres: dos servicios de cambio de plan comparten 114 líneas idénticas

**Por nombre no se ve casi nada.** Los cinco hogares de `F-1B-032` exportan **1.112**
símbolos invocables —360 `apps/api/src/services`, 110 `service-core/billing`, 54
`packages/billing`, 457 `qzpay/core`, 131 `qzpay/drizzle`— y **un solo nombre** aparece en
más de uno: `getPlanBySlug`, en `packages/billing` y en `service-core/billing`. Buscar
duplicación comparando nombres exportados no la encuentra.

**Por contenido sí.** Barriendo los **274** archivos de los tres hogares de hospeda con
ventanas de **10 líneas de código** (sin comentarios ni líneas en blanco, espacios
normalizados), hay **180 ventanas que aparecen en dos o más archivos distintos**. Los
pares que más comparten:

| par | líneas de código idénticas |
|---|---|
| `billing/immediate-plan-swap.service.ts` ↔ `billing/trialing-plan-upgrade.service.ts` | **114** — el **50 %** del primero y el **42 %** del segundo |
| `google-calendar/google-token.errors.ts` ↔ `mercadolibre-oauth/ml-token.errors.ts` | 43 — el **55 %** de cada uno |
| `commerce-brochure/brochure-render.ts` ↔ `experience-certificate/certificate-render.ts` | 57 (13 % / 21 %) |
| `plan-downgrade-remediation.service.ts` ↔ `plan-upgrade-restoration.service.ts` | 35 (10 % / 12 %) |
| `ai-context/experience-ai-context.ts` ↔ `ai-context/gastronomy-ai-context.ts` | 26 (11 % / 10 %) |

**El primer par son los dos caminos de cambio de plan sin cobro**, y el parentesco está
escrito: `immediate-plan-swap.service.ts:21-22` dice *«Same primitive as
`trialing-plan-upgrade.service.ts`»*. Uno sirve a una suscripción `active` cuyo plan
destino cuesta igual o menos (HOS-222) y el otro a una `trialing` (HOS-211); los dos
mutan el `transaction_amount` de la preapproval viva y no cobran nada.

El resto del ranking repite la misma forma: **un archivo por proveedor**
(Google ↔ MercadoLibre, dos veces) y **un archivo por vertical** (brochure de commerce ↔
certificado de experiencia, contexto de IA de experiencia ↔ el de gastronomía).

Esto no dice que sobre código: dice **dónde** está repetido y **cuánto**, medido sobre el
texto y no sobre los nombres.

---

### F-1B-054 — `subscriptions.update` significa dos cosas distintas, y ninguna de las nueve mutaciones de monto relee

`F-1B-030` midió que **cuatro crons** mutan el monto en MercadoPago sin releer. Barrida
toda `apps/api/src`, los sitios son **diez**, y los otros seis no son crons:

| dónde | línea | qué muta |
|---|---|---|
| `services/promo-renewal-mp.service.ts` | `:109`, `:181` | monto |
| `services/billing/apply-price-increase.service.ts` | `:300` | monto |
| `services/billing/immediate-plan-swap.service.ts` | `:168` | monto + `planId` |
| `services/billing/trialing-plan-upgrade.service.ts` | `:309` | monto + `planId` |
| `services/billing/link-preapproval.service.ts` | `:1092` | `externalReference` |
| `cron/jobs/subscription-poll.job.ts` | `:660` | monto |
| `cron/jobs/apply-scheduled-plan-changes.ts` | `:415` | monto |
| `cron/jobs/propagate-plan-price-changes.job.ts` | `:791` | monto |
| `routes/webhooks/mercadopago/payment-logic.ts` | `:939` | monto |

**Nueve de los diez mutan el `transaction_amount`** de una preapproval viva, y **ninguno
vuelve a leerla**: no hay un solo `subscriptions.retrieve(` dentro de las 80 líneas
siguientes a ninguna de las diez llamadas. El éxito se determina por ausencia de
excepción del SDK, igual que midió `F-1B-030` para el subconjunto de los crons.

**Y el mismo nombre de método significa otra cosa según el objeto.** `billing.subscriptions.update(...)`
—el de qzpay— escribe **sólo en la base local**, y hay ocho llamadas así en cinco
archivos (`subscription-downgrade.service.ts` ×2, `trial.service.ts`,
`apply-scheduled-plan-changes.ts` ×3, `subscription-pause.ts`, `payment-logic.ts`). El
código lo aclara donde el equívoco importaba: `routes/billing/subscription-pause.ts:337-339`
— *«Pure local — `subscriptions.update` never calls the provider (see qzpay-core dist
`subscriptions.update`), so this cannot re-trigger a second MercadoPago call»*.

*Nota de método, la décima vez*: buscar `subscriptions\.update\(` sin mirar el receptor da
**17** llamadas y mezcla las dos APIs. Separadas por receptor —`paymentAdapter`/`adapter`
contra `billing`/`this.billing`— son **10 y 8**. El patrón no distinguía dos cosas que el
código sí distingue.

> ⚠️ **El receptor no alcanza como regla general — ver `F-1B-080`.** Lo de arriba vale para
> `update` y se sostiene, pero **`billing.subscriptions.create({ mode: 'paid' })` SÍ llama a
> MercadoPago**, verificado en el código de qzpay. Separar por receptor resuelve este
> hallazgo y no clasifica el resto: hay que mirar el método, y en `create` hasta el
> argumento.

---

### F-1B-055 — «Cuánto suma un addon» está escrito tres veces, con tres políticas distintas ante una clave que no corresponde

Leídos enteros `addon-entitlement.service.ts` (840), `addon.user-addons.ts` (823) y
`addon-plan-change.service.ts` (875).

**El mismo cálculo, tres implementaciones.** Sumar los incrementos de los addons activos
de un cliente para una `limitKey` y escribir `base + suma` está escrito en:

| dónde | forma |
|---|---|
| `apps/api/src/services/addon-entitlement.service.ts:298-341` | bucle en línea sobre las compras activas, resolviendo cada addon con `getBySlug` |
| `packages/service-core/…/addon/addon-plan-change.helpers.ts:245-260` | `sumIncrements`, que usa `addon-plan-change.service.ts:703,717` |
| `packages/service-core/…/addon/addon-limit-recalculation.service.ts:390-428` | bucle propio, y **además** una rama `removeBySource` cuando el incremento queda en 0 que las otras dos no tienen |

Y la resolución del plan base —«probá `getById`, si falla `getBySlug`»— está escrita
otras tres veces: `addon-entitlement.service.ts:266-269`,
`addon-plan-change.service.ts:89-99` y
`addon-limit-recalculation.service.ts:98-110`.

**Ante una `limitKey` que no pertenece al dominio del plan, los tres hacen cosas
distintas:**

| dónde | qué hace |
|---|---|
| `addon-entitlement.service.ts:273` | `planLimits[addon.affectsLimitKey] ?? 0` — **no clasifica nada**: una clave ajena se lee como base 0 y se escribe el límite igual |
| `addon-plan-change.service.ts:458-486` | llama `classifyLimitKeyAgainstPlanDomain`; `'foreign'` → `skipped`, `'unclassified'` → `failed`, y las dos quedan en el resultado |
| `addon-limit-recalculation.service.ts:306-321` | rechaza con `outcome:'failed'` |

El comentario de `addon-plan-change.service.ts:480-484` describe esa política como *«the
same fail-closed answer `recalculateAddonLimitsForCustomer` gives an unknown key»* — o
sea que dos de los tres se declaran gemelos, y el tercero no participa.

**Tres call sites de la misma función, tres cableados de transacción distintos.**
`cancelAddonPurchaseRecord` (definida una sola vez en
`service-core/…/addon-user-addons.ts:400-425`) se invoca:

- `addon.user-addons.ts:288-290` — `{ purchaseId }` **sin** `ctx`, así que el `UPDATE`
  corre en una conexión nueva **aunque el llamador haya pasado `input.tx`**;
- `addon.user-addons.ts:701` — `{ purchaseId, ctx: { tx } }`, dentro del lock;
- y la rama de al lado (`:339-378`) no la usa: hace su propio
  `tx.update(billingAddonPurchases)` dentro de `withTransaction(..., input.tx)`.

**Dos funciones que sólo alcanza un test**, sumando 392 líneas:

| función | líneas | únicos llamadores |
|---|---|---|
| `AddonEntitlementService.getCustomerAddonAdjustments` | `:662-839` (178) | `apps/api/test/services/addon-entitlement.service.test.ts` |
| `revokeAllAddonsForCustomer` | `addon.user-addons.ts:610-823` (214) | `apps/api/test/services/addon-user-addons-recurring-cancel.test.ts` |

La segunda cierra preapprovals en MercadoPago (`:642-650`) y marca
`billingSubscriptions.metadata.addonCancellationIncomplete` más un evento
`ADDON_REVOCATIONS_PENDING` cuando alguna falla (`:762-781`). Ese camino de compensación
hoy sólo lo ejecuta su test.

*Corrección al material de origen*: el sub-agente informó que `revokeAllAddonsForCustomer`
no tenía **ningún** llamador. Verificado a mano: tiene uno, y es un test. La diferencia
importa porque «nadie la llama» y «sólo la llama un test» no son lo mismo.

---

### F-1B-056 — Cortesía y downgrade: una transacción por fila, dos políticas de recorte y un desempate que en producción nunca desempata

Leídos enteros `subscription-comp-grant.service.ts` (807),
`commerce-downgrade-remediation.service.ts` (771) y
`subscription-downgrade-excess.service.ts` (517).

**La cortesía no crea nada en MercadoPago, pero la misma llamada sí lo toca.**
`grantCompSubscription` (`:354`) tiene **un** llamador real,
`routes/billing/admin/subscription-comp.ts:185`. Antes de crear la fila `comp` recorre las
suscripciones que va a suplantar y, por cada una, llama
`hardCancelPreapprovalBestEffort` **contra MercadoPago** (`:485-489`) y después abre **una
transacción por fila** (`:579-607`) para escribir `status='cancelled'`,
`mpSubscriptionId=null` y su evento de auditoría. El comentario de `:715` —*«a comp never
goes through MercadoPago»*— es cierto de la fila nueva y no de la operación.

**Si el proveedor se niega a mitad del recorrido, lo ya hecho queda hecho.** `:557-570`
devuelve `PROVIDER_ERROR` y sale: las filas procesadas en vueltas anteriores ya están
`CANCELLED` y **la cortesía no se creó**. El propio mensaje de error lo asume y describe
cómo retomar: *«Retry — the grant resumes, skips whatever is already closed»*.

**Y la reconciliación de la fila nueva no está protegida.** `:720-724` hace
`await reconcileSubscriptionLinkedEntities({...})` **sin `try/catch`**, después de que la
transacción que creó la cortesía ya commiteó (`:656-682`), con el motivo escrito arriba
(`:715-719`): como no hay webhook para una cortesía, el reconciliador que en todos los
demás caminos dispara el webhook hay que llamarlo a mano. Si esa llamada tira, la cortesía
está en la base y el llamador recibe una excepción.

**Los dos servicios de exceso usan dos políticas de recorte distintas dentro del mismo
archivo.** `computeDowngradeExcess` (`:329-517`) es de sólo lectura —cero escrituras
verificadas— y calcula tres dimensiones:

| dimensión | cómo elige qué se conserva |
|---|---|
| alojamientos | `compareByRecency` — `updatedAt` desc, y `viewCount` desc como desempate |
| promociones activas | el mismo `compareByRecency` |
| **fotos por alojamiento** | **el orden del arreglo**: `gallery.slice(gallerySlots)` es el excedente (`:462-471`), porque una foto no tiene fecha propia — y el archivo lo declara como *DOCUMENTED DIVERGENCE* (`:465-470`) |

**El desempate declarado nunca se ejecuta en producción.** `defaultExcessDeps` —la
implementación real de las lecturas— pasa `viewCount: null` para **todos** los ítems, en
las dos consultas (`:223` y `:240`), con el comentario *«view data not trivially
reachable»*. El docblock de `:12` describe el desempate por vistas como comportamiento
vigente y el campo (`:91`, `:109`) dice *«used as a secondary sort tiebreaker when
non-null»*: en producción es siempre nulo, así que el orden es `updatedAt` y nada más.

**Del lado de commerce, el recorte es un flag y se escribe sin transacción.**
`applyCommerceDowngradeRestrictions` (`:483-562`) y `applyCommerceUpgradeRestorations`
(`:586-663`) hacen **un solo `UPDATE`** sobre `entity_subscriptions.plan_restricted`
(`:289-302`, sin `withTransaction` en todo el archivo) y después recorren los listings
llamando `reconcileListing` con un `try/catch` **por ítem** (`:525-544`, `:627-646`): si
uno falla, el flag ya quedó cambiado y la visibilidad pública de ese listing no se
re-derivó. El recorte es reversible por diseño —es un flag, no un borrado— y la
restauración devuelve hasta donde llega el `headroom` del plan nuevo (`:607-621`).

`applyCommerceUpgradeRestorations` sólo la llama la función de al lado (`:709`) y un test:
es una de las 24 de `F-1B-052`.

---

### F-1B-057 — Medir el consumo y enforzarlo son dos sistemas distintos, con tres políticas de fallo en un solo archivo

Leídos enteros `usage-tracking.service.ts` (990),
`middlewares/limit-enforcement.ts` (950) y `middlewares/commerce-limit-enforcement.ts`.

**Cuatro de las 22 claves reportan el consumo como un literal `0`**, cada una por un
motivo distinto escrito al lado:

| clave | línea | motivo declarado |
|---|---|---|
| `MAX_PHOTOS_PER_ACCOMMODATION` | `:754-761` | es por alojamiento; el desglose real sale de `getPerAccommodationUsage()` |
| `MAX_PROPERTIES` | `:780-783` | *«Blocked: complex/property table not yet created»* |
| `MAX_STAFF_ACCOUNTS` | `:785-788` | *«Blocked: staff management table not yet created»* |
| `MAX_COMPARE_ITEMS` | `:810-817` | es un tope **por request**, no una cantidad guardada |

A esas cuatro se suma `MAX_ACTIVE_PRIVATE_GALLERIES`, que **no tiene `case` propio**: cae
en el `default` (`:819-834`), no matchea ningún `AI_FEATURE_BY_LIMIT_KEY` y devuelve `0`
por esa vía. Es la misma clave que `F-1B-039` midió como `UNBUILT` y sin gate.

**El resto sí cuenta contra una consulta real**: `AccommodationService.count`,
`GastronomyService.countOwn` / `ExperienceService.countOwn` —y el comentario de `:735-741`
explica por qué no usan `count()`: ése fuerza `visibility: PUBLIC`—,
`OwnerPromotionService.count`, `UserBookmarkService.countBookmarksForUser`,
`AlertSubscriptionService.countActive`, `UserBookmarkCollectionService.countActiveCollections`,
`SearchHistoryService.countForActor`, y `getMonthlyCallCount` para las nueve `MAX_AI_*`.

**El mes de una cuota mensual es calendario UTC, por decisión escrita.**
`packages/ai-core/src/usage/reporting/month-range.ts:4-9`: *«Decision (owner-approved
2026-06-04): the "month" period for all AI usage reporting is **calendar-month UTC** …
and is NOT the billing-cycle anniversary»*. Queda anotado que `DEC-ENT-002` dejó ese punto
abierto —calendario contra aniversario— y que su implicación 4 pide computarlo *«en el
huso del mercado, no en UTC»*: el código ya tomó la primera mitad de esa decisión en junio
y la segunda al revés. **No se toca el decision log**; es material para la fase de
análisis.

**Tres políticas de fallo ante «no pude contar», las tres en `limit-enforcement.ts`:**

| función | qué hace si el conteo falla |
|---|---|
| `enforceAccommodationLimit` (`:223-235`) | **503**, con el motivo escrito: *«This used to call `next()` … which handed out an uncapped accommodation every time the count hiccupped»* (HOS-1078) |
| `enforcePromotionLimit`, `assertFavoritesLimitOrThrow` | **403 como si estuviera al tope**, vía `denyOnUnresolvedCount` (`:142-174`), que pasa `Number.MAX_SAFE_INTEGER` como conteo centinela |
| `enforcePhotoLimit`, `enforcePropertiesLimit`, `enforceStaffAccountsLimit`, `enforceFavoritesLimit` | **`next()`**: el `catch` re-lanza sólo `ServiceError`/`HTTPException` y ante cualquier otro error deja pasar (`:813-824` y gemelas) |

`commerce-limit-enforcement.ts` conoce **una sola**: 503 siempre (`:110-114`), y su
docblock de módulo lo declara como divergencia deliberada. Las cuatro funciones de la
tercera fila son, además, las mismas cuatro que `F-1B-039` midió sin montar en ninguna
ruta.

**Y el umbral que ve el usuario no coincide con el que rechaza.** `calculateThreshold`
(`utils/limit-check.ts:110-113`) devuelve `'ok'` cuando `max <= 0` —el comentario dice
*«Unlimited or disabled»*— mientras `checkLimit` (`:194-204`) rechaza con `allowed: false`
cuando `maxAllowed === 0`. Un plan con la funcionalidad apagada muestra la fila en verde y
la rechaza en la misma request.

---

### F-1B-058 — `apps/api/src/services/billing/`: 39 archivos planos, tres caminos para crear una suscripción y trece que hablan con MercadoPago

**El denominador, medido**: `apps/api/src/services/billing/` tiene **39 archivos** y
**15.304 líneas**, en un **directorio plano** —cero subdirectorios— y sin un solo
`.test.ts` adentro (los tests viven en `apps/api/test/services/billing/`).

**Tres archivos distintos crean la fila de una suscripción**, y los tres conviven:

| archivo | líneas | qué crea |
|---|---|---|
| `paid-subscription-create.ts` | 483 | llama `billing.subscriptions.create({mode:'paid'})` (`:398`) — el `POST /preapproval` |
| `own-preapproval-subscription-create.ts` | 502 | envuelve al anterior (`:326`) y normaliza el estado local a `pending_provider` (`:403`) |
| `pending-provider-subscription-create.ts` | 471 | inserta la fila local **sin** preapproval (`:352`) más la fila de correlación |

A eso se suman `subscription-comp-create.service.ts` y
`subscription-trial-create.service.ts` (`F-1B-047`), que están fuera de este directorio y
también insertan filas de `billing_subscriptions`: **cinco puntos de creación** en total.

**Trece de los 39 hablan con MercadoPago**:

```
apply-price-increase        immediate-plan-swap          link-preapproval
mp-plan-provisioning        mp-addon-plan-provisioning   own-preapproval-subscription-create
paid-subscription-create    pending-provider-subscription-create
preapproval-hard-cancel     preapproval-recovery         reactivation-supersession-complete
trialing-plan-upgrade       abandon-never-confirmed-subscription
```

**Trece escriben tablas de billing con Drizzle directo** —`billing_subscriptions`,
`billing_subscription_events`, `billing_orphan_payments`, `entity_subscriptions`,
`partner_subscriptions`— y el reparto de transacciones es desparejo: **tres** abren la suya
(`pending-provider-subscription-create`, `trial-local-expiry`, `link-preapproval`),
**cuatro** reciben una `tx` por parámetro (`own-preapproval-subscription-create`,
`subscription-domain-carry-forward`, `preapproval-recovery`,
`trial-supersede-on-activation`) y el resto escribe sin una ni otra. Sólo seis archivos
usan un modelo tipado (`billingMpPlanModel`, `billingMpAddonPlanModel`,
`billingPendingCheckoutModel`); el resto va contra la tabla.

**Cinco archivos para el ciclo de vida del trial**: `trial-eligibility.service.ts`,
`trial-local-expiry.service.ts`, `trial-series-cohort.ts`,
`trial-notification-offsets.ts` y `trial-supersede-on-activation.ts` —más
`trial.service.ts` (2.160 líneas) un directorio más arriba.

**Y dos servicios gemelos de aprovisionamiento**: `mp-plan-provisioning.service.ts` (591)
y `mp-addon-plan-provisioning.service.ts` (539), con la misma estructura
(`resolveOrProvisionMp*Plan` + `resolveCheckoutMp*PlanId`) contra dos tablas distintas
(`billing_mp_plans` / `billing_mp_addon_plans`).

**Tres símbolos sin consumidor de producción** en este directorio: `admitsAddonGrant`
(`addon-grant-domain.ts`, sólo tests), `clearTouristVipGiftCache`
(`tourist-vip-inheritance.ts:556`) y `TOTAL_TRIAL_SERIES_EMAILS`
(`trial-notification-offsets.ts:76`).

*Nota de método, la undécima vez, y esta vez el patrón mal escrito fue mío*: al agrupar
los 185 archivos de `apps/api/src/services` por «familia» tomé el primer segmento de la
ruta y, para los archivos sueltos, el prefijo del nombre — así que los `billing-*.ts` del
nivel de arriba (`billing-metrics.service.ts`, `billing-customer-sync.ts`, …) cayeron en
el mismo balde que el directorio y daban **44 archivos / 16.804 líneas**. Contado sobre el
directorio real: **39 / 15.304**. Ningún hallazgo publicado usaba el número inflado.

---

### F-1B-059 — Veintiuna afirmaciones del código sobre qzpay están ancladas a una versión, y sólo una nombra la instalada

El código de hospeda razona sobre el comportamiento de la librería del proveedor citando
la versión en la que lo verificó. Contadas todas las citas con número de versión sobre
`apps` y `packages`, sin tests: **21 afirmaciones en 13 archivos**, nombrando **doce
versiones distintas**.

| paquete | versiones citadas en comentarios | **instalada** (`pnpm-lock.yaml:4069-4094`) |
|---|---|---|
| `qzpay-core` | 1.1.0, 1.2.0, **1.12.0**, 2.0.0, 5.1.0, 5.2.0, 6.0.0, **7.0.0** | **7.0.0** |
| `qzpay-drizzle` | 1.10.0, 1.11.0, 2.0.0 | **4.0.0** |
| `qzpay-mercadopago` | 2.5.0 (×5) | **2.11.2** |

**Una sola de las 21 nombra la versión que corre** (`abandoned-pending-subs.job.ts:182`,
que cita `qzpay-core 7.0.0`). Las tres de `drizzle` y las cinco de `mercadopago` nombran
versiones que quedaron dos majors atrás y nueve parches atrás respectivamente.

Los ejemplos más citados son afirmaciones de comportamiento, no notas históricas:
`paid-subscription-create.ts:136` y `:155` describen en qué unidad espera `unitAmount`
*«(`@qazuor/qzpay-core@5.2.0`)»*; `:172` describe qué hace
`billing.subscriptions.create` *«(`@qazuor/qzpay-core@5.1.0`)»*; `:341` dice *«Until
qzpay-core 6.0.0 the parameter did not…»*; y
`packages/billing/src/adapters/mercadopago-stub.ts:26` abre su lista de comportamientos
del motor con *«Verified against `@qazuor/qzpay-core@1.12.0` (`dist/index.js`)»* — seis
majors atrás de lo instalado.

Cruza con `F-1B-004`, que midió lo mismo desde el otro lado: el checkout local de qzpay
declaraba `core 6.0.0` / `drizzle 3.0.0` cuando hospeda ya corría 7.0.0 / 4.0.0.

**Y el paquete de catálogo lleva dos adaptadores de prueba adentro.**
`packages/billing/src` son **37 archivos / 8.167 líneas**, de las cuales
`adapters/mercadopago-stub.ts` (337) y `adapters/qzpay-test-control.ts` (281) son **618
líneas de instrumentación de test** exportadas desde `adapters/index.ts:17`. Las habilita
`HOSPEDA_QZPAY_TEST_CONTROL_ENABLED`, que **no está seteada en producción ni en staging**
(medido: `hops env-list --match QZPAY_TEST_CONTROL` devuelve `No matches` en los dos).

El archivo más grande del paquete es `config/plans.config.ts`, con **1.721 líneas**: es el
catálogo comercial que `F-1B-033` midió viviendo en TypeScript.

---

### F-1B-060 — El mismo descuento porcentual se calcula con dos redondeos distintos dentro de una sola respuesta

`packages/service-core/src/services/billing/promo-code/` son **9 archivos y 4.117
líneas** —`redemption` 1.090, `crud` 725, `renewal` 590, `validation` 551, `service` 407,
`trial-extension` 402, `effect-reducer` 207, `defaults` 107, `index` 38—, leídos enteros.

**Tres sitios calculan «cuánto descuenta un porcentaje», y uno redondea distinto:**

| dónde | cálculo |
|---|---|
| `effect-reducer.ts:170` | `Math.floor(rawDiscount)` — y guarda el resto en `roundingDelta` (`:171-175`) |
| `promo-code.validation.ts:270` (camino legacy) | `Math.floor((amount * value) / 100)` |
| **`promo-code.validation.ts:205`** | **`Math.round((context.amount * value) / 100)`** |

Los tres conviven en la **misma** respuesta de `validatePromoCode`: el campo
`discountAmount` sale del `round` de `:205` y el `effectPreview.finalAmount` del `floor`
del reducer (`:309`) o del legacy (`:270`). Cuando el descuento bruto cae exactamente en
medio centavo, `discountAmount` y `amount - effectPreview.finalAmount` difieren en **1**,
en la misma llamada. Ningún comentario menciona la diferencia.

**El decremento multi-ciclo tiene un solo disparador y ninguna idempotencia.**
`promoEffectRemainingCycles` sólo baja en `promo-code.renewal.ts:447-449` y `:466-469`
(vía `persistRemainingCycles:581-590`), y el único llamador de `resolveRenewalPromoEffect`
fuera de tests es el webhook `subscription-payment-handler.ts:735`. La función lee
`remaining` y escribe `remaining - 1`: **nada dentro del archivo impide que dos entregas
del mismo cobro lo bajen dos veces**. El único control adyacente (HOS-245, `:349-407`)
compara el monto cobrado y saltea el decremento si no coincide — protege contra otro
monto, no contra una entrega repetida.

**La redención se difiere por convención del llamador, no por el servicio.**
`applyPromoCode` incrementa `usedCount` y escribe la fila de uso en el momento en que se
la llama (`:756-779` comp, `:827-829` trial, `:945-971` discount), y el propio
`effect-reducer.ts:78-99` documenta el riesgo: un `POST /apply` sin `subscriptionId`
*«redime el código… y sólo entonces retorna `finalAmount: 0`»*. Los caminos productivos lo
evitan **afuera**: el checkout de suscripción difiere la redención a
`link-preapproval.service.ts:872-885`, ya con la preapproval vinculada, y el de addons a
`addon.checkout.ts:1450-1479`, *«now that payment is confirmed … prevents inflating usage
counts for abandoned checkouts»*. La regla no vive en el servicio: vive en cada llamador.

**Y hay superficie sin llamador productivo**: `tryRedeemAtomically`,
`incrementPromoCodeUsage` y `recordPromoCodeUsage` sólo los alcanzan tests;
`getDefaultPromoCodeConfigs` también. La rama `comp` de `applyPromoCode` (`:754-807`)
sigue completa y **no tiene llamador que la alcance**: la única ruta HTTP que podría
hacerlo corta antes con `assertPromoCodeIsNotComp` (`routes/billing/promo-codes.apply.ts:202`),
y `promo-code-defaults.ts:24-26` lo dice: *«Nothing redeems a comp code any more»*. En
producción, sin embargo, hay dos suscripciones `comp` y las dos tienen una fila de uso de
`HOSPEDA_FREE` (`F-1B-048`).

**Validar es deliberadamente no atómico**: `validatePromoCode` corre ocho chequeos en
orden (`:105-196`) y **dos de ellos fallan abierto** ante un error de base —el tope por
usuario (`:465-467`) y el «sólo clientes nuevos» (`:384-386`)—, con el comentario *«Fail-open:
don't block validation on DB errors»*. El docblock (`:43-63`) declara el TOCTOU y remite
a la redención, que re-valida bajo `SELECT … FOR UPDATE`.

---

### F-1B-061 — Borrar una cuenta no toca billing: la única función que podía hacerlo no la llama nadie

Leídos enteros `refund-lifecycle.service.ts` (545), `courtesy-grant.service.ts` (373) y
`billing-customer-sync.ts` (531).

**`BillingCustomerSyncService.handleUserDeletion` (`billing-customer-sync.ts:355`) no
tiene un solo llamador.** Sus únicas apariciones fuera de la definición son dos tests. Y
la ruta que borra un usuario —`apps/api/src/routes/user/admin/delete.ts:34`— llama
`userService.softDelete(actor, id)` y **no menciona billing, suscripciones ni la caché de
entitlements en ninguna línea**.

Lo que cierra el círculo es que el repo ya midió por qué importa: el guard
`apps/api/test/services/inv1-cache-invalidation.guard.test.ts:450` registra esa función
como *«the only place that can invalidate»*, porque *«qzpay's `findByCustomerId` filters
`deleted_at IS NULL` … and account deletion fires no MercadoPago webhook»*. O sea: hay una
razón escrita de por qué hace falta, una función que la implementa, un test que la
documenta — y ningún camino que la ejecute.

**El refund declara su no-atomicidad como decisión.** `applyRefundLifecycle:366-377`
escribe `billing_payments.refunded_amount` **fuera** de toda transacción y, si ese `UPDATE`
tira, **sigue igual**: el log dice *«attempting subscription transition anyway»*. El
comentario de `:358-365` lo llama *«Intentional non-atomicity (accepted tradeoff)»* y
nombra el resultado raro que acepta: *«`refunded_amount` stays 0 on a cancelled sub»*.
Después, ya fuera de la transacción de estado, llama
`hardCancelPreapprovalBestEffort` (`:525-534`). La función devuelve `void` y **no relanza
ningún error**: cada paso tiene su `try/catch` que sólo loguea.

**Cortesía y `comp` son mecanismos opuestos sobre el mismo hecho.** El docblock de
`courtesy-grant.service.ts:17-21` los contrasta y el código lo cumple: `comp` **destruye**
la preapproval (`mp_subscription_id = NULL`, `F-1B-056`), mientras `courtesy` la
**pausa** —`billing.subscriptions.pause(subscriptionId)` (`:274`)— y lo hace **antes** de
escribir nada local (`:23-28`); si el proveedor se niega, registra
`recordPauseProviderRefusal` y devuelve `PROVIDER_ERROR` sin tocar la base (`:285-307`).
Tiene un único llamador: `routes/billing/admin/subscription-courtesy.ts:153`.

**El cliente de billing se cruza sólo por `external_id`.** `billing-customer-sync.ts` no
consulta por email en ninguna línea: todo lookup es
`billing.customers.getByExternalId(userId)` (`:102`, `:176`, `:250`, `:365`). La carrera
de dos requests concurrentes la resuelve el índice único parcial de
`extras/036-billing-customers-external-id-unique.index.sql` más `isDuplicateKeyError`
(SQLSTATE 23505), re-leyendo al ganador (`:170-181`). Un cliente con el mismo email y otro
`external_id` no lo detecta nada de este lado.

**Y un middleware construye el servicio que no usa.** `middlewares/billing-customer.ts:97`
hace `const _syncService = getSyncService();` bajo el comentario *«Try to ensure customer
exists / This will check cache first, then DB, then create if needed»* (`:99-102`), y el
bloque que sigue nunca le llama un método: resuelve con
`billing.customers.getByExternalId(actor.id)` (`:112`) y, si no hay cliente, deja `null`
con otro comentario —*«Customer will be created on auth/sync»* (`:127`)—. El guion bajo
del nombre es la convención de este repo para una variable que no se usa.

---

### F-1B-062 — Recortar y restaurar no son simétricos, y el «único reconciliador» son dos con 30 llamadas

Leídos enteros `plan-downgrade-remediation.service.ts` (727),
`plan-upgrade-restoration.service.ts` (585) y `subscription-linked-entities.service.ts`
(120), más los auxiliares que invocan.

**El recorte es atómico; lo que viene después, no.** `applyDowngradeRestrictions:458-692`
hace los tres pasos dentro de **una** `withTransaction` (`:530-571`): `accommodations.planRestricted`,
`ownerPromotions.planRestricted` y el archivado de `accommodation_media`
(`state='visible'` → `'archived'`). Un error en cualquiera revierte todo. Lo que corre
**después** del commit —recuento de destinos y revalidación ISR (`:573-661`)— tiene su
propio `try/catch` y sólo loguea.

**La restauración elige por fecha; el recorte, por decisión del host.** El downgrade acepta
`keepSelections` y las resuelve en `resolveKeepIds:245-304`. El upgrade no tiene ningún
parámetro equivalente: `splitByHeadroom` (`plan-upgrade-restoration.deps.ts:47-71`) hace
`restricted.slice(0, headroom)` sobre una lista ordenada por `updatedAt DESC`. Su propio
docblock (`:35-37`) remite el control fino a una UI que no es este servicio.

**Y el upgrade puede restaurar fotos que el downgrade nunca archivó.** La consulta que
alimenta la restauración (`plan-upgrade-restoration.deps.ts:238-249`) selecciona
**cualquier** fila con `state = 'archived'`, sin filtrar por origen — y el endpoint de
admin `routes/accommodation/admin/archiveMedia.ts:5-6` escribe exactamente ese estado, con
su docblock diciendo que es *«distinct from the billing downgrade archive»*. Nada en el
camino de restauración distingue una cosa de la otra.

**Una asimetría más, en la dirección contraria**: el upgrade saltea restaurar fotos de un
alojamiento que sigue `planRestricted` (guard «n-2», `plan-upgrade-restoration.service.ts:366-380`);
el downgrade **no tiene el guard inverso** — su bucle de archivado (`:544-570`) corre para
toda entrada del preview sin mirar si ese alojamiento acaba de quedar restringido en el
paso 1 de la misma pasada.

**El «único reconciliador» son dos, y las llamadas son treinta.** Medido hoy:
`reconcileSubscriptionLinkedEntities` tiene **17 llamadas en 13 archivos** y
`reconcilePartnerForSubscription` **13 más** — un segundo puente que escribe
`partner_subscriptions`, porque los partners no viven en `entity_subscriptions`. Ninguno
llama al otro.

El repo ya se quemó con ese número: el `CLAUDE.md` del ancla dice **«Do not look for the
count here — this bullet twice carried a number that was wrong by the time it was read
("six sites", then "nine … wired at five")»**, y delega el conteo vivo a
`apps/api/test/services/subscription-linked-entities-bridge.guard.test.ts`, que desde
HOS-1306 además exige el pareo: todo archivo que llame al puente de entidades llama
también al de partners o figura en `BRIDGE_ONLY_SITES` con la razón medida.

*(Nota: la copia del `CLAUDE.md` que traen las sesiones desde el clone principal todavía
dice «One reconciler, six sites». La del ancla ya está corregida.)*

**El puente no tira nunca, y eso está verificado y no sólo declarado**: sus tres
delegadas —`reconcileCommerceListingForSubscription`,
`syncAccommodationSubscriptionCacheForSubscription` y
`republishBillingUnpublishedAccommodations`— envuelven todo su cuerpo en `try/catch` y
ninguna relanza (`commerce-reconcile.service.ts:419-427`,
`entity-subscription-cache.service.ts:319-327`,
`accommodation-winback-republish.service.ts:262-270`). Por eso los 17 sitios lo llaman con
un `await` pelado. La excepción es la que midió `F-1B-056`: en `subscription-comp-grant`
esa misma llamada sí puede tirar por lo que ocurre **antes** de entrar.

**Y dos `defaultDeps` que sólo existen para un test**: los de
`plan-downgrade-remediation.service.ts:203` y `plan-upgrade-restoration.deps.ts:77` sólo
los importa `apps/api/test/services/plan-change-revalidation-slugs.test.ts`, con el
carve-out declarado en sus propios docblocks. `applyUpgradeRestorations` (sin el sufijo
`OrWarn`) tampoco tiene llamador productivo: las cuatro llamadas reales pasan por el
wrapper.

---

### F-1B-063 — Diez archivos de `apps/api/src/services` no tienen cuerpo: son shims de re-export a `@repo/service-core`, y una cita de este mismo registro apuntaba a uno

Barridos los **185** archivos `.ts` no-test de `apps/api/src/services`, **doce** no
declaran nada: todo su contenido son sentencias `export … from`. **Diez** apuntan a
`@repo/service-core` y **dos** son barrels internos (`index.ts` del directorio y de
`feedback/`). Los diez suman **162 líneas**:

| shim | líneas | consumidores de producción |
|---|---|---|
| `plan.service.ts` | 26 | **8** (3 middlewares, 4 rutas, `billing/tourist-vip-inheritance.ts:154`) |
| `addon-lifecycle-events.ts` | 25 | 1 (`routes/billing/admin/metrics.ts:19`) |
| `addon-expiration.queries.ts` | 20 | 1 (`addon-expiration.service.ts:28,38`) |
| `promo-code.service.ts` | 17 | 1 (`addon.checkout.ts:53`) |
| `addon-plan-change.helpers.ts` | 15 | 1 (`addon-plan-change.service.ts:49`) |
| `addon-limit-recalculation.service.ts` | 13 | 4 |
| `plan-disable-lifecycle.deps.ts` | 12 | 1 (`plan-disable-lifecycle.service.ts:59`) |
| `billing-settings.service.ts` | 12 | 2 |
| `addon-expiration.batch.ts` | 12 | 1 (`addon-expiration.service.ts:27,33`) |
| `notification-retention.service.ts` | 10 | 2 |

**Ninguno está muerto**: los diez tienen al menos un importador de producción. **Ocho** lo
dicen de sí mismos en su docblock —*«This shim maintains backward compatibility for
existing consumers in the API layer»*— y **tres de esos ocho** se declaran además
`@deprecated` con la instrucción de importar del paquete
(`promo-code.service.ts:6`, `addon-limit-recalculation.service.ts:6`,
`addon-expiration.batch.ts:6`).

**Los otros dos no son compatibilidad hacia atrás, y uno existe para los tests.**
`plan.service.ts:1-4` sólo se declara *«Re-export shim for the PlanService»*, sin motivo;
y `plan-disable-lifecycle.deps.ts:1-8` declara el suyo: re-exporta el helper de auditoría
*«so the main service can be unit-tested without touching `@repo/service-core` internals
directly»*, nombrando la ruta exacta que la suite mockea. O sea que ahí el shim **es** la
costura de test, y borrarlo rompe el mock, no un import.

**Dos símbolos se importan por los dos caminos a la vez.** `PlanService` entra **ocho**
veces por el shim y **dos** directo de `@repo/service-core`
(`addon-purchase-adjustments.ts:28`, `addon.checkout.recurring-resolve.ts:20`), y
`PromoCodeService` **una** por el shim (`addon.checkout.ts:53`) y **dos** directo
(`routes/billing/promo-codes.ts:28`, `routes/billing/promo-codes.apply.ts:32`). Son dos
grafías de la misma clase conviviendo dentro de la misma app.

**Qué corrige de este registro.** `F-1B-028` citó `addon-expiration.queries.ts:237` y
`:322` para el `slice` en JavaScript. Las líneas son correctas y el archivo no: están en
`packages/service-core/src/services/billing/addon/addon-expiration.queries.ts` (358
líneas), no en el shim de 20. El hecho medido —`rawResults.slice(0, BATCH_SIZE)` sin
`limit()` en la consulta— se re-verificó en el archivo real y se sostiene.

**Qué corrige del denominador.** Las **65.165 líneas** de `apps/api/src/services` que mide
`F-1B-032` incluyen estas 162 que no contienen lógica, y el directorio `addon/` de
`service-core` al que remiten son **19 archivos / 4.864 líneas** que el conteo de
`apps/api` no ve. La frontera entre los dos hogares de `F-1B-032` no es la que dibujan las
rutas de los `import`.

> ⚠️ **Segundo ajuste del mismo denominador, 2026-09-17.** Las 65.165 líneas incluyen
> además **un archivo de test** (`__tests__/ai-translate.service.test.ts`, 974 líneas), que
> el criterio de este censo excluye. El total de fuentes no-test es **64.191** sobre **185**
> archivos: 65.165 − 974 = 64.191, y 186 − 1 = 185. Los porcentajes de cobertura de la
> tabla de carriles usan el denominador corregido.

*Nota de método, la duodécima vez, y otra vez el patrón fue mío*: el primer barrido buscó
los importadores con el patrón `services/<nombre>`, que **no matchea un import relativo
dentro del propio directorio** (`from './addon-expiration.queries.js'`). Con ese patrón
seis de los diez shims parecían no tener ningún consumidor de producción. Contados por el
especificador completo, **cero** lo están.

---

### F-1B-064 — Los 90 `pgEnum` no tienen un solo valor de deriva contra producción, y once tipos no los usa ninguna columna — seis de esos once son el vocabulario de billing

**Los 90, por de dónde salen sus valores:**

| forma | cuántos |
|---|---|
| `pgEnum('<nombre>', enumToTuple(<XEnum>))` | **81** |
| `pgEnum('<nombre>', ['a', 'b', …])` — arreglo literal | **9** |

`enumToTuple` es `Object.values(e)` (`packages/db/src/utils/enum-utils.ts:21-25`), así que
para 81 de los 90 los valores del tipo de Postgres **son** los del enum de
`@repo/schemas`, en orden de declaración. Los otros 9 se escriben a mano, y **cinco de esos
9 son el mismo par `['visible', 'archived']` declarado como cinco tipos distintos**:
`accommodation_media_state_enum`, `post_media_state_enum`, `experience_media_state_enum`,
`gastronomy_media_state_enum` y `event_media_state_enum`.

**Cero deriva contra producción.** Comparados los 90 nombres y la cantidad de valores de
cada uno contra `pg_type`/`pg_enum` en prod (2026-09-16): los 90 nombres coinciden en las
dos direcciones —cero tipos en prod que el repo no declare, cero declarados que no existan—
y **ninguno difiere en cantidad de valores**. Es el único carril del relevamiento donde el
código y la base coinciden exacto.

**Y once de los 90 tipos no los usa NINGUNA columna:**

| tipo | valores | dónde se declara |
|---|---|---|
| `permission_category_enum` | **81** | `packages/db/src/schemas/enums.dbschema.ts:178` |
| `entity_permission_reason_enum` | 18 | `:266` |
| **`subscription_status_enum`** | **10** | `:301` |
| **`invoice_status_enum`** | 8 | `:308` |
| **`payment_status_enum`** | 8 | `:306` |
| **`refund_status_enum`** | 6 | `:310` |
| **`product_type_enum`** | 6 | `:113` |
| **`billing_interval_enum`** | 5 | `:296` |
| `access_right_scope_enum` | 5 | `:92` |
| `recurrence_type_enum` | 5 | `:204` |
| `preferred_contact_enum` | 3 | `:106` |

Medido en las dos direcciones. Del lado de la base: `pg_attribute` no tiene una sola
columna de ninguno de los once, ni del tipo ni de su tipo arreglo —verificado con el
control, que da **0 columnas de tipo arreglo de enum en toda la base**, así que la forma
`enum[]` no es el escondite—. Del lado del código: los once símbolos `*PgEnum` tienen
**exactamente una referencia cada uno en `packages/db/src`, que es su propia declaración**.
Ninguna definición de tabla los nombra.

**Seis de los once son la mitad de billing**: `subscription_status`, `payment_status`,
`invoice_status`, `refund_status`, `billing_interval` y `product_type`. Es la contracara
exacta de `F-1B-007`: hospeda **declaró y creó** en Postgres los tipos que restringirían
esos dominios, y las columnas que los usarían viven en las 27 tablas que modela qzpay, que
las declara `varchar` sin `CHECK`. Los tipos existen, tienen los valores correctos y no
restringen nada.

`subscription_status_enum` es el caso más nítido: sus **10** valores son los mismos 10 que
`F-1B-021` midió en `packages/schemas/src/enums/subscription-status.enum.ts` —incluidos
`comp` y `courtesy`, que qzpay no conoce— y la columna que los guardaría,
`billing_subscriptions.status`, es `varchar(50)` libre.

**Y hay 12 enums de `@repo/schemas` que no llegan a la base como tipo.** De los **93**
`export enum` de `packages/schemas/src`, 81 tienen su `pgEnum` y estos doce no:

```
CommerceEntityTypeEnum        EventDatePrecisionEnum      ModerationCategoryEnum
PlanChangeStatusEnum          ProductDomainEnum           PromoCodeDiscountTypeEnum
PromoEffectKindEnum           QrCodeCenterLogoEnum        QrCodeErrorCorrectionLevelEnum
QrCodeFormatEnum              ServiceErrorCode            ValueKindEnum
```

Cuatro de los doce son de billing y viven **fuera** del directorio `enums/`, dentro de un
archivo de schema de API: `PlanChangeStatusEnum` (`api/billing/plan-change.schema.ts`),
más `PromoEffectKindEnum`, `ValueKindEnum` y `PromoCodeDiscountTypeEnum`
(`api/billing/promo-code.schema.ts`). Los dominios de los dos primeros son exactamente los
que `F-1B-007` midió defendidos por los únicos 6 `CHECK` de la mitad de qzpay —los de
`billing_promo_codes`—, o sea por el carril `extras` de hospeda y no por un tipo.
`ProductDomainEnum`, el que separa las verticales, tampoco es un tipo de Postgres.

*Nota de método, la decimotercera vez, y de nuevo el patrón mal escrito fue mío, dos veces
seguidas*: el primer patrón —`pgEnum\(\s*'([^']+)'\s*,\s*\[(.*?)\]\)`— capturó **9 de 90**,
porque asumía el arreglo literal cuando la forma dominante es `enumToTuple(X)`. Y al
resolver después los valores del enum de TypeScript **sin quitar los comentarios primero**,
un `effect_kind = 'comp'` escrito dentro de un JSDoc se contó como un undécimo miembro de
`SubscriptionStatusEnum` y produjo una deriva repo↔producción que no existe. Las dos veces
el error estuvo del lado del patrón, no de la base.

---

### F-1B-065 — Reactivar un addon desde el admin no otorga nada, y apaga la bandera que su propio backstop usa para encontrarlo

`POST /api/v1/admin/billing/customers/addons/{id}/activate`
(`apps/api/src/routes/billing/admin/customer-addons.ts:178-187`, `BILLING_MANAGE`) llama a
`AdminAddonService.activateAddon` (`:107`). El método hace tres cosas, y la del medio no
puede ocurrir.

**1. La transacción pone la bandera en `false`.** `addon.admin.ts:380-388` escribe
`status: 'active'`, `canceledAt: null`, el nuevo `expiresAt` y **`needsEntitlementSync:
false`**, todo bajo un `SELECT … FOR UPDATE` (`:321-333`).

**2. La reaplicación de entitlements es inalcanzable.** `addon.admin.ts:417` construye el
servicio con el cliente de billing en nulo:

```ts
const entitlementService = new AddonEntitlementService(null);
try {
    await entitlementService.applyAddonEntitlements({ … });
} catch (entitlementError) { … }
```

y el método arranca con un guard que **devuelve** en vez de tirar
(`addon-entitlement.service.ts:99-107`):

```ts
if (!this.billing) {
    return { success: false, error: { code: 'SERVICE_UNAVAILABLE', … } };
}
```

El `ServiceResult` no se asigna a nada, así que el `success: false` se descarta sin leerse,
y como no hubo excepción **el `catch` de `:424` nunca corre**. Es la única de las **seis**
construcciones de `AddonEntitlementService` del repo que pasa `null`: las otras cinco pasan
un `billing` real (`addon-expiration.service.ts:80`,
`addon-recurring-activation.service.ts:513`, `addon.service.ts:63`,
`addon-expiry.job.ts:1620` y `:1913`).

**3. La bandera nunca vuelve a `true`.** El `UPDATE` que la levanta —`addon.admin.ts:448`,
`{ needsEntitlementSync: true }`— vive **dentro** de ese `catch` inalcanzable.

**El docblock describe los dos pasos que no ocurren.** `addon.admin.ts:286-297`, pasos 3 y
4: *«Outside the transaction, attempts to re-apply entitlements in QZPay»* y *«If QZPay
throws, marks the purchase with `needsEntitlementSync=true`»*. Ni se intenta contra QZPay
—el guard corta antes— ni se marca la bandera. La `description` de la ruta
(`customer-addons.ts:180-181`) repite la primera: *«Re-applies entitlements and sets status
to active»*.

**Y el backstop no puede encontrar la fila.** La fase 7 de `addon-expiry` —la que
`F-1B-050` nombra como red de contención de los grants faltantes— selecciona exactamente
`eq(billingAddonPurchases.needsEntitlementSync, true)`
(`apps/api/src/cron/jobs/addon-expiry.job.ts:1786-1789`). Una fila reactivada por el admin
queda `active` con la bandera en `false`, o sea **fuera del predicado que la repararía**.

El resultado medido es una compra `active`, sin `canceledAt`, con `expiresAt` nuevo, sin el
entitlement ni el limit que vende, y sin ninguna señal en la fila de que falte algo.

---

### F-1B-066 — La máquina de estados de un addon existe, está probada con 22 casos, y no la ejecuta ni una línea de producción

`packages/service-core/src/services/billing/addon/addon-status-transitions.ts` declara los
cuatro estados (`:18-23`), el mapa de transiciones válidas (`:43-51`) —`pending → active |
canceled`, `active → canceled | expired`, y los dos terminales con el conjunto vacío— y la
función que lo aplica, `validateAddonStatusTransition` (`:87`), que tira
`InvalidStateTransitionError` (`:107`).

**Call sites de producción: cero.** Verificado sobre `apps` y `packages` enteros: las
únicas ocurrencias del nombre son **cuatro** en su propio archivo —dos del docblock
(`:54`, `:77`, `:80`) y la firma (`:87`)— y **veinticuatro** en
`packages/service-core/test/billing/addon-status-transitions.test.ts`. Ninguna ruta, ningún
servicio, ningún cron la importa.

**Y el mapa contradice la razón de ser de una ruta montada.** El test afirma que
`expired → active` y `canceled → active` tiran (`:93`, `:119`, `:146`, `:189`, `:202`,
`:219`). Son exactamente las dos transiciones que `activateAddon` **exige**:
`addon.admin.ts:353-358` rechaza con `INVALID_STATUS` cualquier fila cuyo estado no sea
`expired` o `canceled` —*«Must be 'expired' or 'canceled'»*— antes de escribir `'active'`
en `:381-388`. O sea que la ruta de admin de `F-1B-065` no se salta la máquina de estados
por descuido: **existe para hacer las dos únicas transiciones que la máquina declara
imposibles**, y el `@example` del propio módulo usa `{ current: 'expired', target:
'active' }` como el caso que tira (`addon-status-transitions.ts:80`).

*Nota de método*: el sub-agente que leyó el archivo informó que ese `UPDATE` corre *«sin
ningún filtro de estado actual»*, mirando sólo el `.where()` de `:390-393` (`id` +
`deletedAt`). Verificado a mano, el filtro existe y está **río arriba**, en la lectura bajo
`FOR UPDATE` de la misma transacción (`:345-358`). La diferencia cambia el hallazgo de
«escribe a ciegas» a «exige el estado que la máquina prohíbe», que es lo contrario de un
descuido.

Quien impone el dominio es otra cosa y en otro carril: el `CHECK` de
`packages/db/src/migrations/extras/004-billing.constraints.sql:36`
—`status IN ('active','expired','canceled','pending')`— que acota los **valores** y no las
**transiciones**. Es el mismo reparto que `F-1B-008`: la restricción que existe sobre una
tabla de billing la puso el carril `extras` de hospeda.

---

### F-1B-067 — Publicar o editar contenido dispara traducciones pagadas que no se cuentan, y en producción hay quince de esas contra cero filas de consumo

`apps/api/src/services/translation-service.adapter.ts` llama `translateEntity` (`:48`) y
`persistTranslations` (`:54`) —o sea, una llamada real al proveedor por cada par (campo,
locale)— y **no tiene una sola línea de medición**: `rg 'meterAiUsage|recordAiUsage'` sobre
ese archivo devuelve **0**. El `catch` de `:68` lo declara *«Fire-and-forget: never throw
back to the caller»*.

**Está montado en el camino de escritura de cuatro entidades.** `apps/api/src/index.ts:347`
hace `initializeTranslationService(createTranslationServiceAdapter())`, y
`getTranslationService()` se invoca desde **ocho** sitios —el par crear/actualizar de cada
uno— en `packages/service-core`: `accommodation.service.ts:1095` y `:1359`,
`destination.service.ts:1061` y `:1122`, `event.service.ts:466` y `:507`,
`post.service.ts:647` y `:688`.

**Son tres caminos sin medir, no uno.** Medidos con el mismo patrón sobre cada archivo:

| camino | mide |
|---|---|
| `services/translation-service.adapter.ts` (auto-traducción al guardar) | **0** |
| `routes/ai/admin/translate.ts` (`translateEntity:143`, `batchTranslate:215`) | **0** |
| `routes/ai/admin/post-generate.ts` | **0** |

El tercero tiene razón escrita y los dos primeros no: `middlewares/ai-quota.ts:58-67`
declara `QuotaGatedAiFeature = Exclude<AiFeature, 'post_generate'>` porque los caminos de
admin *«are permission-gated only»*. No hay una exclusión equivalente para `translate`.

**Y la cuota y el techo de gasto son el mismo punto ciego, no dos.** Los dos leen la misma
tabla: el conteo por usuario con `getMonthlyCallCount`
(`packages/ai-core/src/usage/reporting/monthly-call-count.ts:42`, filtrando
`status IN ('success','fallback')`) y el techo global en dólares con
`aggregateAiUsageByMonth`, que suma `aiUsage.costEstimateMicroUsd`
(`packages/ai-core/src/storage/usage.queries.ts:114-125`, invocado desde
`packages/ai-core/src/usage/ceiling.ts:270-278`). Una llamada que no escribe en `ai_usage`
no la ve ninguno de los dos.

**Medido en producción el 2026-09-17**, y esta parte no es una inferencia sobre el código:

| | |
|---|---|
| Filas de `ai_usage` | **59** — `chat` 42, `search` 9, `text_improve` 8 |
| … con `feature = 'translate'` | **0** |
| Rango de fechas de `ai_usage` | 2026-07-08 a 2026-09-01 |
| Filas de contenido con una traducción de IA registrada | **15** — 12 `accommodations`, 1 `destination`, 1 `event`, 1 `post` |
| Fecha de esas traducciones | 2026-08-12, **dentro** del rango de `ai_usage` |

La marca es el `translation_meta` de la fila, que `ai-translate.service.ts:785` escribe con
el proveedor y el modelo (`{"summary":{"en":{"model":"gpt-5.4-nano","provider":"openai",…}}}`).
Quince traducciones con proveedor registrado, cero filas de consumo, en la misma ventana de
tiempo.

*Control, y corrección de mi primer conteo*: contar `translation_meta IS NOT NULL` da
**112**, y no son 112. **Noventa y siete de esas filas tienen `{}`** —la columna existe y
está vacía— así que el predicado honesto es que el JSON nombre un `provider`. Con ese
predicado son 15. Es la decimocuarta vez que un conteo mal acotado da de más, y la segunda
en esta sesión que el error fue mío.

---

### F-1B-068 — La cadena de addons recurrentes —la que corre en producción— no abre una sola transacción, y la mitad que no ve un webhook tampoco reporta a Sentry

Leídos enteros los **10** archivos de la cadena recurrente (**4.968 líneas**):
`addon-recurring-activation.service.ts` (596), `addon.checkout.recurring.ts` (534),
`addon.checkout.recurring-resolve.ts` (470), `addon.checkout.recurring-idempotency.ts`
(443), `addon-recurring-period.ts` (386), `addon-recurring-renewal.service.ts` (374),
`addon-recurring-revoke.service.ts` (207), `addon.checkout.recurring-write.ts` (153),
`addon-purchase-adjustments.ts` (107) y `addon-recurring-charging.ts` (79).

Es el camino que `F-1B-049` midió corriendo **en producción y no en staging**
(`HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED=true` en un slot y `false` en el otro).

**Cero transacciones, en los diez.** `grep -c withTransaction` sobre cada uno da **0**, y
ninguno recibe una `tx` por parámetro. Cada escritura es una sentencia suelta contra
`getDb()`.

**Lo que eso significa donde se liquida un cobro.** `settleRecurringAddonCharge`
(`addon-recurring-renewal.service.ts:232-374`) encadena **tres** escrituras
independientes:

| # | qué | dónde |
|---|---|---|
| 1 | el ledger de pago (`recordAddonPayment`) | `:246` |
| 2 | la activación de la compra (su propio `UPDATE`) | `:275` |
| 3 | el avance del período | `:326` |

Cualquiera puede quedar hecha con las otras sin hacer. Empalma con `F-1B-027`, que midió
que el handler del webhook devuelve `handled: true` aunque la liquidación tire, y con
`F-1B-019`: el evento se marca resuelto y sale de la cola de dead-letter.

**Y la visibilidad del fallo está repartida al revés de donde hace falta.** Contados los
`apiLogger.error`/`warn` y cuántos llevan `{ capture: true }` —o sea, cuántos llegan a
Sentry—:

| grupo | logs de error/warn | con `capture: true` |
|---|---|---|
| los 2 disparados por webhook (`activation`, `renewal`) | 13 | **9** |
| los 4 de checkout (`recurring`, `-resolve`, `-idempotency`, `-write`) | **13** | **0** |

Los cuatro de checkout describen en su propio texto los escenarios más caros y ninguno los
captura: *«pending add-on purchase row could not be written — cancelling the preapproval»*
(`addon.checkout.recurring.ts:485-494`) y *«FAILED to cancel the add-on preapproval… needs
manual reconciliation»* (`addon.checkout.recurring-write.ts:143-151`). El segundo es el
caso en que la preapproval quedó viva en MercadoPago sin fila local.

`addon-recurring-revoke.service.ts` no tiene **ningún** `apiLogger.error`/`warn`: toda su
visibilidad depende de que el llamador capture la excepción.

**La idempotencia del checkout recurrente no es una clave: es un `SELECT` previo.** El
propio archivo lo declara (`addon.checkout.recurring-idempotency.ts:14-17`): la clave del
proveedor *«is the new subscription's id, fresh on every call»* y el header HTTP lo
*«REGENERATES per user action»*. Lo que evita el doble cobro es leer el estado anterior
—`loadInFlightSnapshot:221-288`, dos `SELECT`— y, si no es reusable, cancelar en
MercadoPago (`:333`) y cerrar la fila local (`:354-361`) **antes** de emitir la nueva. Esa
cancelación tampoco se relee: no hay un `retrieve(` en todo el archivo.

Es la contracara exacta de `F-1B-050`, que midió el camino de pago único: ahí la
idempotencia no existe y la confirmación tiene polling; acá la idempotencia existe pero es
un `SELECT` y la confirmación no tiene más canal que el webhook.

*Corrección al material de origen*: el sub-agente contó **11** logs de error/warn en los
cuatro archivos de checkout. Son **13**. El reparto y la conclusión no cambian —siguen
siendo 0 con captura— pero el número sí.

---

### F-1B-069 — La cerca anti-inyección se extrajo a un módulo común para que no hubiera tres copias, y el archivo del que se extrajo nunca la importó

`apps/api/src/services/ai-context/owner-data-fence.ts` es el control que envuelve el texto
escrito por un dueño antes de que llegue al modelo. Su docblock (`:1-14`) declara por qué
existe:

> *«Extracted verbatim from `accommodation-ai-context.ts`… It moved here unchanged the
> moment a SECOND and THIRD assembler needed it, because the alternative — three copies of
> a security control — is the failure mode HOS-547 already described once… **Three copies
> free to drift is the same defect a level up**.»*

Y `ai-context/types.ts:15-17` lo repite como hecho: *«Those live in `owner-data-fence.ts`
and are **imported by every assembler** rather than reimplemented per vertical»*.

**Lo importan dos de los tres.** Medido: `experience-ai-context.ts:36` y
`gastronomy-ai-context.ts:46`, más el re-export de `ai-context/index.ts:21`.
`accommodation-ai-context.ts` —el archivo del que se extrajo— **no aparece**, y conserva
sus cinco copias privadas:

| pieza | copia de accommodation | módulo común |
|---|---|---|
| `OWNER_DATA_DELIMITER_START` / `_END` | `:50-51` | `:36-37` |
| `OWNER_DATA_DIRECTIVE` | `:61-67` | `:47-53` |
| `sanitizeOwnerDelimiters` | `:312-317` | `:78-83` |
| `fenceOwnerValue` | `:327-329` | `:96-98` |
| `truncate` | `:335-343` | `:111-119` |
| `buildChatSystemMessage` | `:392` | `:134` |

**Y el texto ya divergió.** Las dos copias de `OWNER_DATA_DIRECTIVE` difieren en dos
lugares: la de accommodation dice *«written by the **property** owner… relay to the
**guest**»*; la común, *«written by the **listing** owner… relay to the **visitor**»*. El
resto de la directiva —la parte que le dice al modelo que ignore instrucciones dentro de
la cerca— es idéntica.

O sea que la deriva que el módulo se creó para evitar ya ocurrió, en la única pieza que es
prosa dirigida al modelo, y entre el original y la copia.

Cierra además un cabo de `F-1B-052`: `buildChatSystemMessage` era uno de los cuatro nombres
exportados desde dos archivos distintos. Los otros tres son el trío de OAuth escrito dos
veces; éste es una cerca de seguridad escrita dos veces.

---

### F-1B-070 — Una compra de addon se confirma sin su fila de ledger, y el comentario que la precede dice lo contrario

`recordAddonPayment` (`apps/api/src/services/addon-payment-ledger.ts:186`) es lo único que
escribe la fila de `billing_payments` de un addon, y tiene **dos** llamadores de
producción: `addon.checkout.ts:1272` y `addon-recurring-renewal.service.ts:246`.

**El primero es condicional** (`addon.checkout.ts:1271-1292`):

```ts
if (input.paymentId && input.amountInCents !== undefined) {
    await recordAddonPayment({ … });
} else {
    apiLogger.error({ … },
        'Add-on purchase confirmed without a settled provider charge; no billing_payments
         row written — the charge cannot be reconciled or refunded');
}
```

La compra ya se insertó veinte líneas antes (`:1180`) y **la confirmación devuelve éxito
igual**. El único rastro es ese `apiLogger.error`, que **no lleva `capture: true`**: no
llega a Sentry. El texto del mensaje nombra las dos cosas que se pierden —reconciliar y
reembolsar— y las nombra correctamente, porque el reembolso resuelve por
`providerPaymentIds->>'mercadopago'`, que es justo lo que falta.

**Y el comentario inmediatamente anterior (`:1258-1270`) afirma la regla opuesta**: *«the
ledger entry must not be conditional on anything that runs later succeeding»*. Es cierto de
lo que corre **después** y no de lo que llega: el `if` de la línea siguiente la hace
condicional a dos campos de la entrada. El mismo bloque explica por qué ninguno se
defaultea —*«a row carrying the catalog list price instead of the charged amount would be a
plausible-looking lie»*— así que la elección es deliberada; lo que no queda registrado en
ninguna parte es el resultado de haberla tomado.

**El segundo inserter de compras no llama al ledger en absoluto.**
`addon.checkout.recurring-write.ts:67` inserta la fila `pending` del camino recurrente
—el que `F-1B-049` midió corriendo en producción— y no menciona `recordAddonPayment`. Su
primera fila de ledger llega recién con la confirmación del primer cobro, por el otro
llamador. Los otros dos `insert(billingAddonPurchases)` del repo son el seed de usuarios de
prueba y un script de migración.

---

### F-1B-071 — Un slug de plan no catalogado cierra en una función y abre en la de al lado, dentro del mismo archivo

`apps/api/src/services/billing/plan-domain-guard.ts` resuelve el dominio de un plan con
`productDomainForPlanSlug`, que devuelve `undefined` cuando el slug no está en el catálogo.
Las dos funciones que lo usan tratan ese `undefined` al revés:

| función | la comparación | qué hace con `undefined` |
|---|---|---|
| `assertAccommodationPlanSlug` (`:103-114`) | `if (resolved === ProductDomainEnum.ACCOMMODATION) return;` | **tira** `PlanDomainMismatchError` — **falla cerrado** |
| `assertAccommodationPlanChangeTarget` (`:324-327`) | `if (resolved === undefined \|\| resolved === ProductDomainEnum.ACCOMMODATION) return;` | **deja pasar** — **falla abierto** |

Las dos están documentadas como elección: la primera dice *«Fails closed on an unknown
slug»* (`:89`) y la segunda *«Fails OPEN on an unknown slug, and that is not the
fail-closed posture `isAccommodationPlanSlug` was written for»* (`:304-317`). O sea que la
asimetría no es un descuido; lo que queda medido es que **el mismo hecho —un slug que el
catálogo no conoce— habilita un cambio de plan y bloquea una remediación**, con las dos
reglas a doscientas líneas de distancia.

**Hay una tercera forma en el mismo archivo, y no es ninguna de las dos.**
`isAccommodationDomainSubscription` (`:166-181`) y `selectAccommodationSubscription`
(`:246`) inicializan `let resolved = <el objeto sin hidratar>` y **no lo reasignan en el
`catch`**, así que ante un fallo de lectura siguen con el objeto tal como llegó y delegan
el veredicto a `subscriptionMatchesDomain`, que vive en `@repo/service-core`. El default
real —tratar un `productDomain` nulo como accommodation— se decide allá, no acá. Su propio
docblock lo llama *«fails OPEN toward accommodation, twice over»* (`:132-144`).

**Y el error que la mitad cerrada lanza no lo atrapa nadie por su tipo.**
`PlanDomainMismatchError` se define (`:58-84`) y se tira (`:108`), y fuera de ese archivo su
nombre sólo aparece en un comentario de
`commerce-downgrade-remediation.service.ts:88`. Los dos llamadores
—`plan-downgrade-remediation.service.ts:482` y `plan-upgrade-restoration.service.ts:294`—
lo dejan propagar hasta el `catch` de sus envoltorios `…OrWarn`, que miran `err.message`.
La clase existe para distinguir, y ningún `instanceof` la distingue.

---

### F-1B-072 — Expirar un addon nunca corre en transacción, y hay una causa de cancelación declarada que ningún camino usa

**El parámetro de transacción existe y no lo pasa ningún llamador.**
`AddonExpirationService.expireAddon` (`apps/api/src/services/addon-expiration.service.ts:123-127`)
declara `input: ExpireAddonInput & { tx?: DrizzleClient }` y resuelve
`const db = input.tx ?? getDb()`. Sus **tres** llamadores de producción pasan sólo el id:

| llamador | qué pasa |
|---|---|
| `addon.admin.ts:273` | `{ purchaseId }` |
| `cron/jobs/addon-expiry.job.ts:328` | `{ purchaseId: addon.id }` |
| `addon-expiration.service.ts:347` (el lote) | lo que le dé `processExpiredAddonsBatch`, y el tipo `ExpireAddonFn` (`packages/service-core/…/addon-expiration.batch.ts:36-40`) **no tiene campo `tx`** |

O sea que la expiración siempre corre contra una conexión nueva, y sus dos escrituras —la
quita de entitlements y el `UPDATE` a `expired`— no son atómicas entre sí.

**Y las dos mitades de esa expiración tienen políticas opuestas ante el fallo**, dentro de
la misma función: si `closeAddonPreapproval` no confirma, corta con `SERVICE_UNAVAILABLE` y
la fila queda `active` (`:200-220`); si la quita de entitlements falla, se marca
`entitlementRemovalPending` y **se escribe `expired` igual** (`:225-259`, `:266`). Ante la
misma premisa —no se pudo revocar— un canal se abstiene y el otro sigue.

**Una causa de cancelación declarada y nunca pasada.**
`AddonPreapprovalCancelSource` (`apps/api/src/services/addon-preapproval-cancel.ts`) tiene
**siete** miembros. Seis tienen al menos un call site real; `'provider-terminal'` (`:87`)
aparece **una sola vez en `apps` y `packages` enteros: su propia declaración**. Su
comentario describe el caso —*«MercadoPago itself reported the preapproval terminal; we
mirror it locally»*— y el archivo que atiende ese caso,
`addon-recurring-revoke.service.ts`, no llama `closeAddonPreapproval` en ninguna línea:
espeja un estado ya terminal en vez de causarlo, así que no tiene a quién pasarle la causa.

*Corrección al material de origen*: el sub-agente informó **dos** llamadores de
`expireAddon`. Son **tres** — se le pasó el del cron (`addon-expiry.job.ts:328`), que es
justamente el de mayor volumen. La conclusión no cambia: ninguno de los tres pasa `tx`.

---

### F-1B-073 — Deshabilitar un plan no migra, no cancela y no toca al proveedor: marca una bandera por suscripción, cada una en su propia transacción

`disablePlanLifecycle` (`apps/api/src/services/plan-disable-lifecycle.service.ts:142`) es
el abanico que corre cuando un admin retira un plan. La llama sólo
`routes/billing/admin/plans.ts`, en dos lugares (`:313` y `:418`, el segundo un
re-disparo manual descrito como idempotente en `:414`).

**Lo único que escribe sobre la suscripción es una bandera.** `:189-195` hace
`.set({ cancelAtPeriodEnd: true, updatedAt })` y **el `status` queda como estaba**; el
docblock (`:13-14`) lo declara: *«status stays — the finalize-cancelled-subs cron
transitions to `cancelled` after `currentPeriodEnd`»*. No hay ningún `planId` reasignado a
otro plan: **no existe migración**, sólo un `migrationHint` (`:145`, `:232`) que es un
texto que viaja dentro del mail `PLAN_BEING_RETIRED`.

**No toca MercadoPago.** Cero ocurrencias de `paymentAdapter`, `preapproval` o
`hardCancel` en todo el archivo. La preapproval sigue viva y cobrando hasta que el cron
`finalize-cancelled-subs` la cierre —el mismo cron que `F-1B-023` midió contando la fila
como finalizada **antes** de cancelar en el proveedor, con el resultado de esa cancelación
sin asignar a ningún contador.

**Una transacción por suscripción, y el fallo de una no frena la pasada.** `:185-204` abre
`withServiceTransaction` **dentro** del bucle —el docblock lo declara *«independent, not
nested»* (`:35-39`)— y el `catch` de `:252-264` loguea y sigue. `affectedSubCount` cuenta
sólo los éxitos, así que un abanico parcial y uno completo se distinguen por un número que
nadie compara contra el total.

Dos cosas que ocurren **después** del commit y no se pueden revertir: `clearEntitlementCache`
(`:209`) y la notificación, que es `void Promise.resolve(...).catch(log)` (`:218-243`).

**Y la entrada de auditoría no se llama como dice el docblock.** `:18` promete *«writes ONE
`PLAN_DISABLED_BY_ADMIN` audit entry»*, y el código pasa `action: 'plan_disabled'`
(`:278`). `PLAN_DISABLED_BY_ADMIN` existe, pero anidado dentro de `changes.eventType`
(`:284`), no como el campo por el que se busca una acción de auditoría.

---

### F-1B-074 — Los índices de expresión son DOS, no 21, y los dos son de billing: indexan una clave de un JSONB que no existe como columna

Medido por catálogo y no por el texto del `indexdef`, que es lo que estaba mal en el censo:

| | por catálogo (`pg_index`) | por patrón sobre `indexdef` |
|---|---|---|
| Parciales (`indpred IS NOT NULL`) | **46** | 46 ✓ |
| De expresión (`indexprs IS NOT NULL`) | **2** | 21 / 25 ✗ |

El patrón matchea los `::text` y los `lower(…)` que aparecen en el **predicado** de un
índice parcial. Un índice de expresión es el que la lleva en la **clave**. Los dos
conceptos se cruzan —los 2 de expresión son también parciales— pero no son el mismo.

**Los dos, completos, y los dos son de billing:**

```sql
CREATE UNIQUE INDEX idx_notification_log_idempotency_key
  ON billing_notification_log ((metadata ->> 'idempotencyKey'))
  WHERE (metadata ->> 'idempotencyKey') IS NOT NULL;

CREATE UNIQUE INDEX uq_billing_subscription_events_supersession_pairing
  ON billing_subscription_events (subscription_id, (metadata ->> 'supersededSubscriptionId'))
  WHERE (metadata ->> 'supersededSubscriptionId') IS NOT NULL;
```

Los dos imponen unicidad sobre **una clave de un JSONB que no existe como columna**. El
segundo es el que `F-1B-025` nombró como lo único que separa a dos réplicas de
`reactivation-supersession-reconcile` de cancelar el mismo par en paralelo — y como es un
índice sobre la fila de auditoría, actúa **después** de haber hablado con el proveedor.

**Y de los 46 parciales, 33 son ÚNICOS.** O sea: **33 reglas de unicidad condicional** que
no figuran en `information_schema.table_constraints` —`F-1B-012` ya midió que ahí se ven
39 de 116— y que sólo se leen en el `indexdef`.

**Veintiuno de los 46 parciales están sobre tablas `billing_*`**, 11 de ellos únicos. Los
que más deciden:

| índice | qué impone |
|---|---|
| `idx_addon_purchases_active_unique` | un solo addon `active` por `(customer_id, addon_slug)` — el backstop que `F-1B-068` midió atrapando la reentrega del webhook |
| `billing_subscriptions_mp_id_uniq` | una sola fila local por preapproval, **sólo cuando `mp_subscription_id` no es nulo** |
| `billing_addon_purchases_mp_id_uniq` | lo mismo del lado de los addons |
| `billing_customers_external_id_livemode_uniq` | el candado de `(external_id, livemode)` que `F-1B-061` midió resolviendo la carrera de dos requests |
| `idx_polling_jobs_one_active_per_resource` | un solo job `pending` por `(provider, provider_resource_id)` |

**Ese `WHERE … IS NOT NULL` del segundo tiene consecuencia medida.** En producción hay 8
suscripciones y **5 tienen `mp_subscription_id` nulo** —las 3 `abandoned` y las 2 `comp`,
según `F-1B-048`—, así que cinco de las ocho filas están **fuera** de esa unicidad. No es
un defecto del índice: un `NULL` no colisiona con otro `NULL` en Postgres, y ésa es la
razón por la que el predicado está escrito. Lo que queda anotado es que la garantía cubre
tres de las ocho.

**Dos índices congelan una lista de negocio en su predicado.**
`uq_billing_subscription_events_trial_series` enumera **nueve** `event_type`
(`TRIAL_SERIES_NOTIF_PRE_10D`, `PRE_5D`, `PRE_1D`, `EXPIRY`, `POST_1D`, `POST_5D`,
`POST_10D`, `POST_30D`, `POST_60D`) y `uq_billing_subscription_events_trial_pre_end` otros
**dos** (`TRIAL_PRE_END_NOTIF_D3`, `D1`). Son las dos series de mails de trial, y su lista
vive en un índice de Postgres además de en el código.

**Hoy no hay deriva**: contadas las constantes del repo fuera de tests, `TRIAL_SERIES_NOTIF_*`
da exactamente **9** y `TRIAL_PRE_END_NOTIF_*` exactamente **2**, los mismos que enumeran
los dos predicados. Lo que queda medido es el acoplamiento: agregar un décimo mail a la
serie no lo deduplica nada hasta que se escriba una migración.

---

### F-1B-075 — La duración de un trial sale de dos lugares distintos según quién lo arranque, y las dos ramas terminan en la misma constante

`F-1B-048` midió que la duración real no sale de la fila del plan ni de la del precio.
Leídos los dos caminos que crean un trial sin tarjeta, el reparto exacto es éste:

| camino | de dónde saca los días | si falla |
|---|---|---|
| **alojamiento** (primera publicación) | nada: `createTrialSubscription` aplica su default | — |
| **commerce** (gastronomía / experiencia) | `billing_plans.metadata.trialDays` (`commerce-trial-start.service.ts:156`) | cae al default del creador |

El default es un literal de TypeScript:
`subscription-trial-create.service.ts:150` hace
`const trialDays = input.trialDays ?? OWNER_TRIAL_DAYS`, y `OWNER_TRIAL_DAYS = 30` vive en
`packages/billing/src/constants/billing.constants.ts:17`.

**La caída de commerce pasa por un cero.** `resolveCommerceTrialPlan` valida que el
`metadata.trialDays` sea un entero positivo y, si no lo es, deja `undefined`, avisa por log
—*«commerce trial plan declares no usable trialDays — falling back to the creator
default»* (`:165-168`)— y **devuelve `trialDays: 0`** (`:170`). Río abajo, `:343` omite el
campo cuando vale 0:

```ts
...(plan.trialDays > 0 ? { trialDays: plan.trialDays } : {}),
```

así que el `??` del creador resuelve a los mismos 30 días. **El cero no es una duración:
es la forma de decir «usá el default», y viaja como número.**

O sea: la columna `metadata.trialDays` existe en las filas de plan, sólo la lee el camino
de commerce, y cuando la lee mal termina en la misma constante que el camino que nunca la
mira. `F-1B-048` ya midió que esa metadata vale `30` en las seis filas de planes de
`accommodation` — el mismo número que el literal, así que hoy las dos fuentes coinciden y
la divergencia no se nota.

**Y hay un tercer número que no es duración de nada**: `subscription-comp-create.service.ts:75`
declara `COMP_PERIOD_MS = 100 * 365 * 24 * 60 * 60 * 1000` y lo usa como
`currentPeriodEnd`. Es la forma de satisfacer el `NOT NULL` de esa columna en el esquema de
qzpay con un período que nunca vence.

---

### F-1B-076 — La elegibilidad para un trial no atrapa un solo error, y el caso sin evidencia falla cerrado a propósito

`apps/api/src/services/billing/trial-eligibility.service.ts` decide si alguien puede
arrancar un trial. Tiene **cero bloques `try`/`catch`** —verificado con el patrón anclado
`}\s*catch\s*\(`, que da 0— así que un fallo de base en cualquiera de sus dos consultas
—`billing.subscriptions.getByCustomerId` (`:285`) o la de `billing_subscription_events`
(`:232`)— se propaga como excepción a sus **cuatro** llamadores:
`commerce-trial-start.service.ts:250` y `:313`, `accommodation-publish-deps.ts:200` y
`routes/billing/trial-eligibility.ts:106`.

No hay fail-open ni fail-closed programático ante un error de conexión: hay una excepción.
Lo que sí está decidido y escrito es qué hacer ante un **dato ausente**, que es otra cosa.

**La clasificación, completa:**

| grupo | estados | ¿consume el trial? |
|---|---|---|
| `NEVER_AUTHORIZED_STATUSES` (`:108-111`) | `pending_provider`, `abandoned` | **no** |
| `AUTHORIZED_STATUSES` (`:130-136`) | `active`, `trialing`, `past_due`, `paused`, `expired` | **sí** |
| tratado como consumido aparte (`:149-155`) | `comp` | **sí** |
| ambiguo, se resuelve por historial | `cancelled` | depende |

`cancelled` está deliberadamente fuera de los dos conjuntos porque se alcanza desde las dos
orillas, y el docblock (`:119-129`) lo explica: `active`/`trialing` → `cancelled` consumió
el trial, y `pending_provider` → `cancelled` —alguien que abandonó la página de
MercadoPago— no. Se dirime consultando `billing_subscription_events`.

**Y una fila `cancelled` sin ningún evento falla CERRADO, con la razón escrita**
(`:211-215`): *«with an empty audit trail there is no evidence in either direction, and the
two mistakes do not cost the same»*. Se elige hacia dónde fallar, no cuál caso es más
probable.

**Del otro lado, la expiración local trata dos cosas distintas como la misma.**
`expireLocalTrial` (`trial-local-expiry.service.ts:325`) corta con:

```ts
if (!subscription.trialEnd || subscription.trialEnd > now) {
    return { outcome: 'not-elapsed' };
}
```

Una fila **sin fecha** y una fila **cuya fecha todavía no llegó** devuelven el mismo
`'not-elapsed'`. Es la confirmación por el lado del código del hueco que `F-1B-048` midió
por el lado de los datos: una `trialing` con `trial_end` nulo no vence nunca, y el
resultado no la distingue de una que simplemente está en curso. En producción hoy no
existe ninguna.

Ese servicio además sólo mira los trials **sin tarjeta**: `:321-323` sale con
`'has-provider-id'` si la fila tiene `mpSubscriptionId`. Los de tarjeta los expira el otro
mecanismo, `reconcileExpiredTrials`, que re-lee la preapproval. Son dos caminos disjuntos
para el mismo hecho, separados por una columna.

*Nota de método, la decimoquinta vez, y también mía*: `grep -c catch` sobre ese archivo da
**1**, y no hay ninguno: el match es la palabra *«catches»* dentro de un comentario. El
sub-agente había reportado cero y tenía razón; lo que falló fue mi verificación, hasta
anclar el patrón a `}\s*catch\s*\(`.

---

### F-1B-077 — Las dos métricas de facturación suman los pagos de un estado que nadie escribe en ninguna parte del repo

`billing-metrics.service.ts` calcula la facturación con dos consultas, y las dos filtran por
el mismo valor:

| métrica | dónde | filtro |
|---|---|---|
| `getOverviewMetrics` → ingreso total | `:258-263` | `WHERE status = 'completed'` |
| `getRevenueTimeSeries` | `:342-353` | `WHERE status = 'completed'` |

**`'completed'` no es un estado de pago de este sistema.** El vocabulario de qzpay tiene
**ocho** valores y ése no está entre ellos
(`qzpay/packages/core/src/constants/payment-status.ts:4-13`, en el ancla `c934164`):

```
pending · processing · succeeded · failed · canceled · refunded · partially_refunded · disputed
```

Y del lado de hospeda, los cuatro sitios que escriben `billing_payments.status` escriben
**`'succeeded'`**: `billing/payment-reconcile.service.ts:421`,
`routes/webhooks/mercadopago/payment-logic.ts:415`, `:608` y `:1011`.

Buscado `'completed'` sobre `apps/api/src` y `packages/*/src` sin tests, las únicas dos
ocurrencias que apuntan a `billing_payments` son las dos consultas de arriba. Las demás
—`refund-status.enum.ts`, `admin-billing-view.status.ts`,
`billing/reactivation-supersession-complete.ts`, `newsletter-dispatch.worker.ts`— son otros
dominios con la misma palabra.

**Las dos métricas devuelven cero por construcción**, y eso es independiente de que
`billing_payments` esté hoy vacía en producción (`F-1B-009`): seguirían en cero el día que
se llene, porque ninguna fila va a llevar ese estado.

> **El repo ya había diagnosticado esto, en otro archivo.**
> `apps/api/src/services/admin-billing-view.status.ts:147-148` lo deja escrito al excluir
> ese valor de su mapa de alias: *«`completed` is deliberately ABSENT: no row has ever held
> it. **It was invented by the admin UI, which is what made its refund button dead**»*. O
> sea que el mismo error ya costó un botón de reembolso muerto, se corrigió en la vista de
> admin, y sigue vivo en las dos consultas de `billing-metrics.service.ts`.

**Y las consume una superficie duplicada.** `getBillingMetricsService()` expone cuatro
métodos, y los llaman **dos módulos de ruta distintos, los dos montados**:
`routes/billing/metrics.ts:123-125` (montado en `routes/index.ts:120`) y
`routes/billing/admin/metrics.ts:186-188` (montado en `routes/billing/admin/index.ts:54`).
Los dos declaran en su propia cabecera estar servidos bajo
`/api/v1/admin/billing/metrics`.

---

### F-1B-078 — Cancelar en el proveedor devuelve un veredicto de tres valores y la mitad de los llamadores lo tira

`hardCancelPreapprovalBestEffort` (`apps/api/src/services/billing/preapproval-hard-cancel.ts:221`)
devuelve `{ kind: 'cancelled' | 'skipped' | 'failed' }` y **nunca tira** (`:173`). Tiene
**seis** call sites de producción, y se reparten exactamente por la mitad:

| lee el resultado | lo descarta |
|---|---|
| `addon-preapproval-cancel.ts:166` (`const outcome =` → ramifica por `.kind`) | `refund-lifecycle.service.ts:525` — `await …({ … }).catch(…)`, y como la función no tira, el `.catch` no intercepta nada y el valor no se lee |
| `subscription-comp-grant.service.ts:485` | `cron/jobs/courtesy-expiry.job.ts:166` — `await` pelado |
| `billing/own-preapproval-subscription-create.ts:452` | `cron/jobs/finalize-cancelled-subs.ts:776` — `await` pelado |

`F-1B-023` ya había medido el último: `finalized += 1` ocurre en `:772`, **antes** de esa
llamada. Lo que agrega esta medición es que no es un caso aislado — es la mitad del
conjunto, y el otro caso de cron (`courtesy-expiry`) tiene la misma forma.

Los tres que sí lo leen lo usan sólo para decidir **qué loguear**: ninguno de los seis
vuelve a leer la preapproval para confirmar que la cancelación tomó. Es la misma ausencia
que `F-1B-030` y `F-1B-054` midieron del lado de las mutaciones de monto, ahora del lado de
la cancelación.

---

### F-1B-079 — Una cortesía se puede cancelar y no se puede des-cancelar, y es la única asimetría del par sin comentario que la explique

Los dos conjuntos que gobiernan el par, en dos archivos:

| | dónde | contenido |
|---|---|---|
| `SOFT_CANCELLABLE_STATUSES` | `subscription-cancel.service.ts:120` | `active`, `trialing`, **`courtesy`** |
| `UNCANCELLABLE_STATUSES` | `subscription-uncancel.service.ts:92` | `active`, `trialing`, **`past_due`** |

`courtesy` está en el primero y no en el segundo. Y el soft-cancel **no cambia el
`status`** —escribe sólo `cancelAtPeriodEnd` y `updatedAt` (`:262-265`)—, así que una
cortesía cancelada queda en `status='courtesy'` con la bandera puesta, y el guard de
`subscription-uncancel.service.ts:163` la rechaza con `VALIDATION_ERROR`. **Dentro de estos
dos archivos no hay ninguna combinación de entradas que revierta ese cancel.**

La asimetría espejo —`past_due`, que se puede des-cancelar y no cancelar— **sí tiene su
comentario** (`subscription-uncancel.service.ts:86-90`), declarada deliberada. La de
`courtesy` no tiene ninguno en ninguno de los dos archivos.

Cruza con `DEC-GRANT-003`, que decidió implementar la cortesía temporal **pausando** en el
proveedor y sosteniendo el servicio del lado nuestro. La medición no dice si esto la
contradice; dice que hoy el estado que esa decisión usa entra al camino de cancelación y no
al de reversión.

---

### F-1B-080 — El receptor no alcanza para saber si una llamada toca MercadoPago: `billing.subscriptions.create({ mode: 'paid' })` sí lo hace

`F-1B-054` estableció la regla que este relevamiento viene usando: `paymentAdapter.*` muta
MercadoPago y `billing.*` —el cliente de qzpay— escribe sólo local. **Vale para `update` y
no vale como regla del namespace.**

Verificado en el código de qzpay, en el ancla `c934164`, no en un comentario:

```ts
// qzpay/packages/core/src/billing.ts:1528
if (input.mode === 'paid' && paymentAdapter?.subscriptions) {
    …
    // :1636
    providerResult = await paymentAdapter.subscriptions.create(providerInput);
}
```

O sea que **el mismo método hace dos cosas distintas según su argumento**: con
`mode: 'paid'` sale a crear la preapproval, y sin él escribe una fila y nada más. En
hospeda ese camino se ejerce en `billing/paid-subscription-create.ts:398`, que es el punto
por el que pasa **todo** checkout pago.

La clasificación correcta tiene tres niveles, y sólo el primero es el receptor:

| | ejemplo | toca MercadoPago |
|---|---|---|
| receptor | `paymentAdapter.subscriptions.update` | **sí**, siempre |
| método | `billing.subscriptions.update` / `.cancel()` | **no** |
| argumento | `billing.subscriptions.create({ mode: 'paid' })` | **sí** |
| | `billing.subscriptions.create({ … })` sin `mode` | no |

`abandon-never-confirmed-subscription.ts:9-12`, `own-preapproval-subscription-create.ts:446`
y `paid-subscription-create.ts:461` documentan los tres, cada uno en su caso, que
`billing.subscriptions.cancel()` escribe `status:'canceled'` **local** y no toca al
proveedor — y ésa es exactamente la razón por la que existe
`hardCancelPreapprovalBestEffort` (`F-1B-078`) como el único camino real de cancelación
remota.

*Nota de método, la decimosexta vez, y ésta se propagó*: la regla «mirá el receptor» no
sólo quedó escrita en `F-1B-054`, la usé como contexto en cinco prompts de delegación de
esta sesión. Un sub-agente la contradijo con la cita del docblock, y la verificación contra
el fuente de qzpay le dio la razón. Un atajo que clasifica bien un conjunto no clasifica el
siguiente.

---

### F-1B-081 — El guard que impide dos suscripciones vivas no cuenta a `pending_provider`, que es el estado en el que nace toda suscripción

`assertNoLiveSubscriptionForDomain`
(`apps/api/src/services/billing/duplicate-subscription-guard.ts:190`) es la defensa contra
que un cliente termine con dos suscripciones del mismo dominio. Decide con
`isLiveSubscriptionStatus`, y ese conjunto está medido en el código, no en su docblock:

```
LIVE_SUBSCRIPTION_STATUSES  (packages/billing/src/predicates/is-live-subscription-status.ts:88)
  = ENTITLEMENT_GRANTING_STATUSES ∪ { 'past_due' }
  = { active, trialing, comp, courtesy, past_due }
```

`pending_provider` **no está**. Y es el estado con el que nacen las filas de los dos
creadores que llaman a ese guard: `paid-subscription-create.ts:377-385` y
`pending-provider-subscription-create.ts:331-345`.

**Consecuencia medible**: dos invocaciones concurrentes del mismo checkout leen las dos
«sin suscripción viva» y las dos siguen. La única defensa que queda es el módulo de
idempotencia, y `F-1B-082` mide que ahí la lectura y la escritura están separadas.

Empalma con lo que `F-1B-048` midió en producción: de las 8 suscripciones, **3 están en
`abandoned`** —el estado terminal al que va a parar un `pending_provider` que nunca se
confirmó—, y las tres tienen `mp_subscription_id` nulo.

---

### F-1B-082 — Ningún creador de suscripción acuña su clave de idempotencia leyendo si ya existe una

Leídos los tres, el patrón es el mismo en los tres:

| creador | qué acuña | ¿lee algo antes? |
|---|---|---|
| `pending-provider-subscription-create.ts:311` | `randomBytes(16)` como nonce | **no** |
| `own-preapproval-subscription-create.ts:294-502` | nada propio: delega en `createPaidSubscription` | **no** |
| `paid-subscription-create.ts:398` | el id de fila que qzpay genera por llamada | **no** |

Dos invocaciones del mismo checkout lógico producen dos claves distintas, dos filas y —en
el camino que corre en producción— dos preapprovals. Esto no es un descuido del código: es
lo que hay que hacer cuando el proveedor no deduplica, y `F-1B-017` de la matriz de MP ya
midió que ni `external_reference` ni `X-Idempotency-Key` sirven en `/preapproval`.

**El candado existe, y vive afuera del creador.** `checkout-idempotency.ts` lo implementa
con dos funciones de decisión —`decideCheckoutReuse` (`checkout-reuse-decision.ts:218-263`)
y `decideOwnPreapprovalReuse` (`checkout-idempotency.ts:482-521`)— que el **llamador**
invoca antes de crear. Son una lectura y una decisión, separadas de la escritura: no hay
lock ni constraint que las respalde dentro de estos archivos.

**Tres de esas funciones de reuso ya no se alcanzan.** `resolveReusableCommerceCheckout`,
`resolveReusablePartnerCheckout` y `resolveReusableAccommodationCheckout`
(`checkout-idempotency.ts:346-428`) están las tres detrás del ternario de
`HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` en `subscription-checkout.service.ts` (`:734`,
`:1183`, `:1501`, `:1881`), en la rama `else`. Con el flag en `true` en los dos entornos
(`F-1B-045`, `F-1B-049`), **son código inalcanzable en producción y en staging**.

**Y `isUniqueConstraintViolation` no la usa ninguno de los tres.** El helper existe
(`billing/unique-violation.ts`, detecta SQLSTATE `23505` caminando la cadena de `cause`
hasta 5 niveles) y tiene **un solo consumidor** en todo el repo:
`addon-recurring-activation.service.ts:446`, que está en un flujo de activación y no de
creación. Un `23505` durante cualquiera de las tres creaciones no se traduce a «ya lo hizo
otro»: se propaga como error genérico.

**Un código de error declarado, mapeado a HTTP y que nadie lanza.**
`subscription-checkout-error.ts:49` declara `DISCOUNT_APPLY_FAILED` en el union y
`subscription-checkout-error-http.ts:74` lo mapea a **502**. Buscado
`new SubscriptionCheckoutError('DISCOUNT_APPLY_FAILED'` sobre `apps` y `packages` sin
tests: **cero**. Lo que sí existe es otro string, en otro tipo de error:
`promo-renewal-mp.service.ts:127` produce `code: 'MP_DISCOUNT_APPLY_FAILED'` con forma de
`ServiceError`. Y un comentario de `routes/billing/start-paid.ts:335` describe el flujo
citando el nombre que nunca se lanza.

---

### F-1B-083 — Aplicar un descuento a una suscripción viva baja el monto en MercadoPago antes de comprometer la redención, y si la redención falla el monto bajo queda

`applyMultiCycleDiscountToExistingSubscription` (`promo-discount-apply.service.ts`) hace
los pasos en este orden:

| # | paso | dónde |
|---|---|---|
| 1 | mutar el `transaction_amount` en MercadoPago | `:193-202` → `promo-renewal-mp.service.ts:109` |
| 2 | comprometer la redención (incrementa `usedCount` y escribe la fila de uso) | `:212` |
| 3 | corregir el contador de ciclos | `:244-247` |

**El paso 1 es deliberadamente primero, y el archivo lo declara fail-closed**: si la
mutación falla no se llega al 2, así que el código no se gasta. Hasta ahí la elección está
tomada y escrita.

**Lo que queda medido es el otro extremo.** Si el paso 2 falla —por ejemplo, porque el
código llegó a su tope de usos entre la validación y la redención—, `:220-235` loguea y
**devuelve `{ success: false }` sin restaurar el monto**, con la razón escrita: *«we do NOT
auto-restore here because that would race the just-applied lower amount»*. El resultado es
una preapproval que ya cobra el monto descontado y un código de promoción que no quedó
marcado como usado. El mensaje de log lo nombra: *«manual reconcile required»*.

**Y el paso 3 es una escritura suelta, fuera de la transacción del paso 2.**
`:244-247` hace `getDb().update(billingSubscriptions).set({ promoEffectRemainingCycles })`
sin compartir `tx` con la redención que ya commiteó. El comentario de `:236-243` explica
por qué hace falta —el reducer interno siembra `N-1` porque asume el camino de checkout— y
si el proceso muere entre `:212` y `:244` el contador queda en `N-1` con el código ya
gastado.

**El guard de elegibilidad es más ancho que lo que declara.** El docblock (`:78-81`) y el
propio mensaje de error (`:123`) dicen que este camino es *«only for monthly subscriptions
with an active preapproval»*, y el único chequeo es `if (!sub.mpSubscriptionId)`
(`:117-126`). No hay ninguna comparación de `billingInterval` ni de cadencia en todo el
cuerpo (`:96-275`), verificado por ausencia del patrón. Como desde HOS-171 una suscripción
**anual también es una preapproval con `mp_subscription_id`**, una anual pasa este guard
igual que una mensual.

---

### F-1B-084 — Los dos aprovisionadores de planes de MercadoPago son gemelos que resuelven el precio por comprador con diseños opuestos, y crean el plan en el proveedor antes de reclamarlo local

`billing/mp-plan-provisioning.service.ts` (591) y
`billing/mp-addon-plan-provisioning.service.ts` (539) tienen la misma estructura de tres
ramas —acierto activo, acierto con deriva por compare-and-swap, y fallo con carrera—, con
comentarios casi textuales (`:322-328` contra `:359-365`). `truncateToLength` es
**idéntica carácter por carácter** entre `:171-177` y `:206-212`, y
`archiveMpPlanBestEffort` (`:574-591`) y `archiveMpAddonPlanBestEffort` (`:522-539`) son la
misma función con otra etiqueta de log.

**Pero la dimensión que decide cuántos planes existen está resuelta al revés en cada uno:**

| | clave de la variante | qué pasa con un precio distinto por comprador |
|---|---|---|
| planes comerciales | `(commercialPlanId, billingInterval, trialDays, **discountCycle1AmountArs**)` (`:65-77`, `:307-309`) | **cada monto genera su propio plan de MercadoPago**, y coexisten |
| planes de addon | `(addonId, billingInterval)` (`:342-346`) | prohibido: el `amountCentavos` está declarado *«hard contract»* que nunca lleva un monto por comprador (`:96-134`) |

Es el mismo problema con dos respuestas incompatibles, en dos archivos que por lo demás son
copias.

**Ninguno de los dos le pregunta a MercadoPago si el plan ya existe.** Las tres ramas de
cada uno leen y escriben **sólo la tabla local** (`billing_mp_plans` /
`billing_mp_addon_plans`), y `createMpPlan` (`:234-265`) llama siempre
`adapter.prices.create(...)`. Si la fila local falta para una variante que ya tiene su plan
del otro lado, el código no lo detecta: crea otro.

**Y el objeto del proveedor se crea antes de reclamar la variante localmente.** El orden de
la rama de fallo (`:365-391`) es: crear en MercadoPago (`:367`), después intentar el
`insert`, y si el `insert` pierde la carrera, **archivar el plan recién creado
best-effort** y converger en el ganador. O sea que dos checkouts concurrentes para la misma
variante **sí crean dos planes reales en MercadoPago**; uno queda archivado por un camino
declarado best-effort. El propio comentario lo dice: *«the unique constraint on the variant
key makes the insert the concurrency guard»* — el candado protege la tabla, no al
proveedor.

**Dos asimetrías más entre los gemelos, las dos con su razón escrita:**

- el seam de control de test (`applyTestControl`) envuelve el camino comercial
  (`:475-491`) y en el de addons está **deliberadamente omitido** (`:483-492`);
- el de addons tiene un guard fail-closed contra un `addonId` vacío (`:336-341`), cuyo
  comentario describe el síntoma que evita —*«a buyer authorizing a preapproval for a
  product they did not buy»*— y el comercial **no tiene el equivalente** sobre
  `commercialPlanId`.

**Y el docblock del de addons dice que nadie lo llama.** `:27-29`: *«Nothing calls this
module yet: recurring add-on checkout lands in PR 4»*. La cadena existe y está montada:
`addon.checkout.recurring.ts:213` → `addon.checkout.ts:624` → `addon.service.ts:115`. Lo
que sí es cierto es que está detrás del flag `RECURRING_ADDONS_ENABLED`, que `F-1B-049`
midió en **`true` en producción** y `false` en staging. El módulo no está sin cablear: está
corriendo en el entorno donde hay plata.

---

### F-1B-085 — Billing no toca el resto del dominio por clave foránea: lo toca por banderas, y hoy en producción están todas apagadas menos una

`F-1B-010` midió la frontera hospeda↔qzpay: 19 columnas en una sola dirección. Falta la
otra frontera, la que importa para saber qué se rompe afuera de billing si se rediseña.

**Por clave foránea, casi nada.** De las 399 FK de producción, las que cruzan entre las
tablas `billing_*` de hospeda y el resto del dominio son **seis**:

| dirección | cuántas | cuáles |
|---|---|---|
| de una tabla `billing_*` **hacia afuera** | **1** | `billing_settings.* → users` |
| **hacia adentro**, desde un puente de billing | 3 | `entity_subscriptions → billing_subscriptions`, `partner_subscriptions → billing_subscriptions`, `featured_listing_addon_grants → billing_addon_purchases` |
| **hacia adentro**, desde una tabla del dominio | **2** | `partners.plan_id → billing_plans`, `partners.subscription_id → billing_subscriptions` |

Los tres del medio son tablas puente: existen para billing. **La única tabla del dominio
que apunta a billing por FK es `partners`.** Alojamientos, destinos, usuarios, gastronomías,
experiencias, posts, eventos: **cero**.

**El acoplamiento real es por columnas desnormalizadas que ninguna restricción conecta.**
Medidas en el esquema de producción, las banderas que el código de billing escribe sobre
tablas del dominio son ocho:

| columna | quién la escribe |
|---|---|
| `accommodations.plan_restricted` | `plan-restriction.service.ts:84`, `:133` |
| `owner_promotions.plan_restricted` | `plan-restriction.service.ts:192`, `:247` |
| `entity_subscriptions.plan_restricted` | `commerce-downgrade-remediation.service.ts:289-302` |
| `accommodation_media.state` → `'archived'` | `plan-photo-restriction.service.ts:190`, `:399` |
| `accommodations.owner_suspended` | `subscription-pause.service.ts:78` |
| `users.service_suspended` | `subscription-pause.service.ts:73` |
| `accommodations.billing_unpublished_at` | `accommodation-winback-republish.service.ts:177` |
| `accommodations.featured_by_entitlement` | `accommodation.sync-featured-by-entitlement.ts:147`, `:237` |

Ninguna de las ocho tiene una FK ni un `CHECK` que la ate al estado de la suscripción que
la produjo: son copias, y la única cosa que las mantiene ciertas es que alguien las vuelva
a escribir.

**Y en producción, hoy, siete de las ocho están en cero** (medido el 2026-09-17):

| | filas con la bandera puesta | total |
|---|---|---|
| `accommodations.featured_by_entitlement` | **4** | 12 |
| `accommodations.plan_restricted` | 0 | 12 |
| `accommodations.owner_suspended` | 0 | 12 |
| `accommodations.billing_unpublished_at` | 0 | 12 |
| `users.service_suspended` | 0 | 23 |
| `entity_subscriptions.plan_restricted` | 0 | 12 |
| `accommodation_media` con `state = 'archived'` | 0 | 97 |
| `owner_promotions.plan_restricted` | 0 | **0 filas en la tabla** |

Lo que eso dice, con precisión: **ninguna fila de producción lleva hoy el rastro del
recorte por downgrade, de la suspensión por mora, ni del despublicado por billing.** No
dice que nunca se hayan prendido —una bandera se puede haber puesto y quitado—, pero sí que
el estado actual no las ejerce.

`accommodation_media` da el dato más limpio del lote: **0 de 97** archivadas. Es la misma
columna que `F-1B-062` midió sin forma de distinguir un archivado por billing de uno hecho
por un admin — hoy no hay ninguno de los dos.

*Qué abre, sin resolverlo acá*: toda la maquinaria de recorte y restauración que este
relevamiento midió por dentro —`plan-downgrade-remediation` (727), `plan-upgrade-restoration`
(585), `plan-restriction` (265), `plan-photo-restriction` (433),
`commerce-downgrade-remediation` (771), `subscription-downgrade-excess` (517), más el
abanico de `plan-disable-lifecycle`— escribe exactamente estas columnas. Son **≈3.300
líneas** cuyo efecto no está presente en ninguna fila de producción.

---

### F-1B-086 — Hay una ruta de admin sirviendo las métricas de un sistema de eventos que nadie emite, y que además se reinicia con el proceso

`packages/service-core/src/services/billing/addon/addon-lifecycle-events.ts` (351 líneas)
declara un bus de eventos del ciclo de vida de un addon: nueve tipos de evento, la función
que los emite (`emitLifecycleEvent`, `:305`) y un contador en memoria (`:24-30`).

**`emitLifecycleEvent` no la llama nadie.** Buscado sobre `apps` y `packages` enteros, sus
únicas apariciones fuera de tests son **tres**: la firma (`:305`), el `@example` de su
propio docblock (`:296`) y la línea del shim que la re-exporta
(`apps/api/src/services/addon-lifecycle-events.ts:22`). Ningún servicio, ruta ni cron la
invoca.

**Pero el lector sí está montado.** `apps/api/src/routes/billing/admin/metrics.ts:433`
declara `getAddonLifecycleMetricsRoute`, `:444` llama a `getAddonLifecycleMetrics()` y
`:459` la monta en el router. O sea que el endpoint responde, y responde el objeto inicial
—`revocationOutcomes: { success: 0, failed: 0 }`, los arreglos vacíos— porque nada lo
incrementó nunca.

**Y aunque algo emitiera, el número no sobreviviría a un despliegue.** El propio docblock
lo declara (`:17-22`): *«Collected per-process… no external dependency, **reset on process
restart**»*. Es un contador en memoria de un proceso, servido por un endpoint de
administración.

---

### F-1B-087 — Un servicio exige una conexión en su contrato, la ignora y abre la suya, mientras el llamador le pasa la que tiene abierta

`recalculateAddonLimitsForCustomer`
(`packages/service-core/src/services/billing/addon/addon-limit-recalculation.service.ts`)
declara `db: DrizzleClient` como campo **obligatorio** de su entrada (`:71`), documentado
como *«Drizzle database instance for querying `billing_addon_purchases`»*.

La implementación desestructura `const { customerId, limitKey, billing } = input;`
(`:175`) —**`db` no se lee en ninguna línea**— y abre una transacción nueva con
`withTransaction` (`:204`). El comentario de `:173-174` lo declara: *«`db` is retained in
the input interface for backward compatibility»*.

Su único llamador de producción, `apps/api/src/services/addon.user-addons.ts:406-411`, sí
le pasa un `db`. Así que el `SELECT … FOR UPDATE` sobre las compras activas (`:215-222`)
corre en **otra** conexión que la del llamador, y los dos locks no se ven entre sí.

**Y si el recálculo falla, la cancelación ya aplicada no se revierte.** El llamador
(`addon.user-addons.ts:414-438`) captura en Sentry, loguea *«DB cancel already applied —
webhook will reconcile»* y **sigue hasta su `return` de éxito**. El `catch` del servicio
(`:442-446`) convierte cualquier excepción en `{ outcome: 'failed' }` y nunca relanza.

**Aparte: `calculateThreshold` está escrita dos veces, con la misma lógica y firmas
distintas.** `packages/service-core/…/usage-tracking.types.ts:125` la declara con un
parámetro objeto y `apps/api/src/utils/limit-check.ts:110` con dos posicionales; las dos
abren con el mismo `if (max <= 0) return 'ok'`. La primera la usa
`usage-tracking.service.ts`; la segunda, siete sitios entre middlewares de límite y rutas
de media. No hay ningún import entre ellas. Es la misma función del umbral 80/90/100 % en
dos paquetes, y `F-1B-057` ya midió que ese `'ok'` para `max === 0` contradice al
`checkLimit` que rechaza en ese mismo caso.

---

### F-1B-088 — El número de días de prueba que ve un visitante sale de tres mecanismos, y dos de las páginas no consultan nada

`F-1B-075` midió los dos orígenes del lado del servidor. Del lado del sitio público hay un
tercero, y las páginas no usan el mismo:

| mecanismo | dónde | qué hace |
|---|---|---|
| **cómputo en vivo** | `apps/web/src/lib/billing/generic-trial-days.ts:126-143` | pide `/api/v1/public/plans`, filtra los planes `owner` activos con `hasTrial && trialDays > 0` y devuelve el **mínimo**; cae a la constante si el fetch falla |
| **la constante, sin consultar nada** | `pages/[lang]/preguntas-frecuentes/index.astro:156`, `pages/[lang]/funcionalidades/index.astro:91` | interpola `OWNER_TRIAL_DAYS` directo en la copy |
| **la constante como default de un prop** | `components/host/PropertyCard.astro:89` | `trialDays = OWNER_TRIAL_DAYS` |

El comentario de `computeMinimumTrialDays` (`:70-84`) explica por qué toma el **mínimo** y
no el máximo: *«a pre-selection promise can only be as good as the worst plan the visitor
might end up on»*.

**Hoy los tres dan 30, y está medido contra el sistema que corre.**
`GET https://api.hospeda.com.ar/api/v1/public/plans` devuelve **tres** planes —
`owner-basico`, `owner-pro`, `owner-premium`—, los tres con `isActive: true`,
`hasTrial: true` y **`trialDays: 30`**. El mínimo es 30, y `OWNER_TRIAL_DAYS` vale 30
(`packages/billing/src/constants/billing.constants.ts:17`).

Lo que queda anotado es la forma, no una divergencia: **el mismo número se le promete al
visitante desde una lectura en vivo en unas páginas y desde una constante compilada en
otras**, y sólo la primera reaccionaría a un cambio de catálogo. Sumado a los dos orígenes
del servidor, la duración de un trial se resuelve hoy en **cuatro** lugares.

*Nota sobre el mínimo*: como toma el menor de lo que el endpoint devuelva, un plan `owner`
activo con un trial corto que llegara a listarse bajaría la promesa de todo el sitio.
`F-1B-049` midió que `owner-test-daily` —cuyo `metadata.trialDays` es `1`— **no** aparece
en la respuesta pública pese a `HOSPEDA_SHOW_TEST_BILLING_PLAN=true` en producción, y la
consulta de arriba lo confirma: son tres planes y ninguno es el de prueba.

---

### F-1B-089 — El censo contaba 42 archivos de Web tocando billing y son 15

Recontado por el especificador de import y no por la mención:

| | menciona `@repo/billing` | **lo importa** | lo importa, sin tests |
|---|---|---|---|
| `apps/web/src` | 42 | 21 | **15** |
| `apps/admin/src` | 25 | 23 | **22** |

Los 42 y 25 del censo son menciones: incluyen tests y los archivos que sólo nombran el
paquete en un comentario. **La superficie real de Web son 15 archivos** de sus 1.049, y la
de Admin **22** de 1.454.

Los 15 de Web, completos:

```
components/host/PropertyCard.astro            components/host/PublishPrecheckPanel.astro
components/billing/plan-comparison-rows.ts    components/billing/plan-card-delta.ts
lib/host/usage-badge.ts                       lib/host/publish-precheck-panel-content.ts
lib/billing/fetch-plans.ts                    lib/billing/audience-plans.ts
lib/billing/generic-trial-days.ts             lib/billing-i18n.ts
lib/commerce/usage-badge.ts                   pages/[lang]/preguntas-frecuentes/index.astro
pages/[lang]/funcionalidades/index.astro      pages/[lang]/mi-cuenta/addons/index.astro
pages/[lang]/suscriptores/checkout/failure.astro
```

**Y la tabla comparativa pública no muestra el catálogo entero.**
`components/billing/plan-comparison-rows.ts` nombra **31** de las 53 claves de entitlement
y **16** de las 22 de limit; el admin nombra **las 53**. Cruza con `F-1B-037`: de las 53,
doce no las chequea nada en el servidor, y esta tabla es una de las dos superficies donde
esas doce se exhiben.

---

### F-1B-090 — El motor de qzpay expone 94 miembros y hospeda usa un tercio; cuatro namespaces enteros están en cero y nadie escucha sus eventos

Leídos enteros `packages/core/src/billing.ts` (3.092), `billing-from-env.ts` (217),
`index.ts` (32) y los 5 archivos de `adapters/` (1.383), en el ancla `c934164`.

**La superficie, contada con un parser que respeta las llaves anidadas:**

| namespace | métodos | | namespace | métodos |
|---|---|---|---|---|
| `subscriptions` | 12 | | `limits` | 7 |
| `addons` | **11** | | `payments` | 6 |
| `paymentMethods` | **9** | | `plans` | 5 |
| `customers` | 8 | | `promoCodes` | **5** |
| `invoices` | 7 | | `entitlements` | 5 |
| | | | `metrics` | **5** |
| | | | `checkout` | 5 |

**85 métodos en 12 namespaces**, más **9 miembros sueltos** (`on`, `once`, `off`,
`getPlans`, `getPlan`, `isLivemode`, `getStorage`, `getPaymentAdapter`, `getLogger`):
**94 direccionables**.

**Cuatro namespaces enteros no los llama hospeda ni una vez.** Contadas las llamadas
`billing.<ns>.<método>(` sobre `apps/api/src`, `packages/service-core/src` y
`packages/billing/src`, sin tests:

| namespace | llamadas |
|---|---|
| `subscriptions` | 119 |
| `plans` | 55 |
| `customers` | 47 |
| `limits` | 20 |
| `entitlements` | 15 |
| `payments` | 15 |
| `checkout` | 6 |
| `invoices` | 1 |
| **`promoCodes`** | **0** |
| **`addons`** | **0** |
| **`paymentMethods`** | **0** |
| **`metrics`** | **0** |

Los cuatro en cero suman **30 de los 85 métodos**. Y no es que esas funciones no existan en
hospeda: promos, addons y métricas de billing están implementados **de nuevo** del lado de
hospeda —`service-core/…/promo-code/` (4.117 líneas), los 23 archivos de addon de
`apps/api`, `billing-metrics.service.ts`— sobre las mismas tablas que el motor modela.

**Nadie escucha los eventos que el motor emite.** `billing.ts` emite más de veinte tipos
(`subscription.created/updated/canceled/paused/…`, `payment.succeeded/failed/refunded`,
`invoice.*`, `checkout.created`, `addon.*`, `payment_method.*`) y las tres funciones para
suscribirse —`on`, `once`, `off`— **no las llama nadie**: cero ocurrencias en `apps/api/src`,
`packages/service-core/src` y `packages/billing/src`.

**El motor no abre transacciones ni acepta una.** `storage.adapter.ts:120` declara
`transaction<T>(fn)` en el contrato, y `billing.ts` **no lo invoca nunca**: `transaction(`
da **0** ocurrencias en las 3.092 líneas. Ninguna firma de servicio recibe un `tx` del
host. El propio código documenta la decisión donde más importa (`billing.ts:1610-1614`):
*«The sequence cannot be made atomic: wrapping it in a SQL transaction would hold locks
across an HTTP round-trip»*. Es la razón por la que las ventanas de compensación que
`F-1B-045` y `F-1B-082` midieron del lado de hospeda existen.

**Y hay cableado muerto dentro del propio motor.** `QZPayBillingConfig.notifications`
—el adaptador de mail, con su tipo completo de 118 líneas en `adapters/email.adapter.ts`—
aparece en `billing.ts` exactamente **dos veces**: la declaración del campo (`:350`) y un
comentario ajeno (`:1212`). El constructor (`:1102-1123`) nunca lo lee. No es que hospeda
no lo pase: es que el motor no lo usaría aunque lo pasara.

**Hospeda además saltea la fachada en dos lugares.** `getStorage()` (7 call sites) se usa
sobre todo para llegar a `subscriptionPollingJobs`, que el contrato del storage declara
(`storage.adapter.ts:82-84`) y **ningún servicio de `billing.*` envuelve**; y
`getPaymentAdapter()` (9 call sites) llama al proveedor crudo, sin el registro local, los
eventos ni la estrategia de error que `billing.ts` pone alrededor de cada llamada.

*Nota de método, la decimoséptima vez, y mía*: el primer conteo de las llamadas por
namespace usó `billing\.<ns>\.` y dio 224 para `promoCodes`, 317 para `addons` y 204 para
`metrics` — el `.` sin escapar matcheaba rutas como `@repo/billing/promo-codes`. Anclado a
`(?<![A-Za-z0-9_])billing\.<ns>\.[a-zA-Z]+\(`, los tres dan **0**. Y el conteo de métodos
falló dos veces antes: una porque el `(.*?)\n\}` cortaba en la primera llave anidada, y otra
porque los métodos se declaran como **propiedades con tipo función** (`create: (input) => …`)
y el patrón buscaba `nombre(`.

---

### F-1B-091 — El único endpoint donde MercadoPago EXIGE la clave de idempotencia es el único método mutante que no la manda, y encima es el único envuelto en reintentos

Leídos enteros los 16 archivos de `qzpay/packages/mercadopago/src` (4.160 líneas).

**El reembolso.** `payment.adapter.ts:200-227`:

```ts
async refund(input: QZPayRefundInput, providerPaymentId: string) {
    return withRetry(async () => {            // ← :201, el ÚNICO envuelto en reintentos
        const body = {};
        if (input.amount) body.amount = input.amount / 100;
        const response = await this.refundApi.create({
            payment_id: Number(providerPaymentId),
            body                              // ← :210-213, SIN requestOptions
        });
        …
    }, this.retryConfig, 'Refund payment');
}
```

`FASE 1C` midió que en `/refunds` el header `X-Idempotency-Key` es **obligatorio**, y que la
idempotencia de este proveedor es **por endpoint**. Acá no se manda. Y el tipo de entrada
tampoco lo permite: `QZPayRefundInput`
(`qzpay/packages/core/src/types/payment.types.ts:60-64`) no declara el campo, así que
ningún llamador podría pasarlo. El hueco está en el contrato, no sólo en el adaptador.

**Los tres lugares donde sí se manda son otros.** `payment.adapter.ts:70` acuña una clave
para `payments.create`; `checkout.adapter.ts:239` la manda a `/checkout/preferences`; y
`subscription.adapter.ts:137` la manda a **`POST /preapproval`**, que es exactamente el
endpoint donde `EX-17` midió que el header *«se acepta y no hace nada»*.

**No es un bug activo hoy**: `billing_refunds` tiene **cero filas** en producción
(`F-1B-009`), así que ese camino nunca corrió de verdad. Lo que está medido es el camino.

**Los reintentos cubren un solo adaptador de seis.** `retry.utils.ts` lo importa
únicamente `payment.adapter.ts` (6 call sites). Los otros cinco —`subscription`,
`customer`, `checkout`, `price`, `card-token`— usan `wrapAdapterMethod`
(`error-mapper.ts:181-187`), que mapea el error y **no reintenta**. El cableado lo decide
`mercadopago.adapter.ts:76-81`: `retryConfig` se le pasa sólo al adaptador de pagos. O sea
que **el adaptador que hospeda más usa —`subscriptions`, con sus 7 métodos alcanzados— no
tiene reintento alguno**, y el que sí lo tiene tiene 4 de sus 7 métodos inalcanzables desde
hospeda.

**Ninguna mutación compara campo por campo después de mutar.** Revisado
`subscription.adapter.ts:159-244`: de los cinco mutantes (`update`, `cancel`, `pause`,
`resume`, `uncancel`), **sólo `update` relee** —llama `this.retrieve()` en `:186`— y ni
siquiera compara: devuelve el objeto releído como resultado. No hay un solo
`if (devuelto.campo !== enviado.campo)` en el archivo. Es la misma ausencia que `F-1B-030` y
`F-1B-054` midieron del lado de hospeda, ahora medida en la capa que habla con el proveedor:
**el punto donde el §0 de la matriz dice que hay que comparar es justamente donde nadie
compara.**

**Un estado que el mapa no conoce se devuelve tal cual, sin avisar.** Los tres mapas de
estado —`MERCADOPAGO_SUBSCRIPTION_STATUS` (4 claves), `MERCADOPAGO_PAYMENT_STATUS` (9) y el
de eventos— resuelven con `statusMap[x] ?? x` (`subscription.adapter.ts:444-447`,
`payment.adapter.ts:377-380`). Y `mapEventType` (`webhook.adapter.ts:333-373`) termina en
`return mpEventType` **sin ningún `logger.warn`**, mientras que la verificación de firma
del mismo archivo (`:175-308`) loguea cada rama de fallo. Un tipo de evento desconocido pasa
en silencio; una firma inválida deja rastro.

**Y la conversión de montos es asimétrica.** La salida hacia MercadoPago divide sin
redondear (`input.amount / 100` en cinco sitios) y la entrada siempre redondea
(`Math.round(x * 100)` en cinco más). Los adaptadores de `subscription` y `checkout` no
convierten de vuelta en absoluto: sus tipos de retorno no llevan ningún campo de monto, así
que **el importe que MercadoPago realmente aplicó a una suscripción nunca se lee de vuelta
en todo el paquete**.

---

### F-1B-092 — La máquina de estados de una suscripción es opcional: de los 24 archivos que escriben `status`, diez importan el guard

Leídos enteros los 24 archivos de `packages/service-core/src/services/billing/`
—`subscription/` (10), `plan/` (6), `constants.ts`, `featured/` (2), `notification/` (2),
`settings/` (2) y el `index.ts`—, **5.273 líneas**.

**El guard existe y es opt-in.** `subscription/subscription-status-transitions.ts` declara
`validateSubscriptionStatusTransition` (`:276`) y `checkSubscriptionStatusTransition`
(`:326`) sobre la tabla de transiciones de los 10 estados. Pero **24 archivos de
`apps/api/src` hacen `.update(billingSubscriptions)` y sólo 10 importan alguno de los dos**.
Dos escrituras sin guardar, leídas en sus imports:

- `courtesy-grant.service.ts:324` escribe `status: COURTESY` — su bloque de imports de
  `@repo/service-core` (`:37-43`) no trae ninguno de los dos;
- `subscription-comp-grant.service.ts:583` escribe `status: CANCELLED` — importa
  `normalizeStoredSubscriptionStatus` (`:120-123`) y ninguno de los guards.

Es el mismo hallazgo de forma que `F-1B-066` en los addons: una máquina de estados escrita,
probada, y que no es el cuello por donde pasan las escrituras. La diferencia es que ésta sí
tiene diez consumidores.

**El catálogo de eventos declara 58 tipos y 14 no los escribe nada.**
`constants.ts` define `BILLING_EVENT_TYPES` con 58 claves. Buscando cada una como
`BILLING_EVENT_TYPES.<CLAVE>` sobre `apps/api/src` y `packages/*/src` sin tests, catorce dan
cero:

```
PLAN_CHANGE_LOCAL_FAILED       PLAN_CHANGE_MP_PROPAGATION_FAILED   ADDON_EXPIRED
ADDON_LIMIT_RECALCULATED       DUNNING_ATTEMPT_CREATED             DUNNING_ATTEMPT_SUCCEEDED
DUNNING_ATTEMPT_FAILED         PROMO_CODE_REDEEMED                 PROMO_CODE_EXPIRED
NOTIFICATION_SCHEDULED         TRIAL_BLOCKED                       REACTIVATION_AUDIT_FAILED
TRIAL_PRE_END_NOTIF_D1         TRIAL_PRE_END_NOTIF_D3
```

Dos de esos catorce están **retirados a propósito** y el propio módulo lo declara
(`constants.ts:158-161`): los `TRIAL_PRE_END_NOTIF_*` se conservan para que las filas
históricas sigan significando algo — y son los mismos dos que `F-1B-074` encontró
congelados en el predicado de un índice único. Los tres de `DUNNING_ATTEMPT_*` cruzan con
`F-1B-026`: el cron de dunning tiene sus dos operaciones apagadas por una constante, así que
no hay quién los escriba.

**Y `plan.crud.ts` (1.201 líneas) descarta la causa de todos sus errores.** El archivo no
importa ningún logger ni Sentry, y sus **nueve** bloques `catch (_error)` —`:282`, `:331`,
`:381`, `:571`, `:877`, `:949`, `:1007`, `:1106`, `:1192`— nunca leen la variable: devuelven
`{ success: false, error: { code: INTERNAL_ERROR, message: '<genérico>' } }`. Un
`Error('Plan insert returned no row')` que el mismo archivo lanza en `:515` muere ahí.

**`settings/billing-settings.service.ts` falla al revés según la operación.** `getSettings`
(`:140-170`) envuelve su consulta en un `try/catch` que devuelve `DEFAULT_SETTINGS` (`:166`):
un error de base es indistinguible de «no hay configuración guardada». `updateSettings`
(`:195-249`) y `resetSettings` (`:269-311`) **no tienen `catch`**: cualquier error propaga.
La misma clase falla en silencio al leer y a los gritos al escribir.

Dato que importa para el §9 del PDR: **los 11 campos de `BillingSettings` salen de la base**
—la fila `key='global'` de `billing_settings`, mezclada sobre el default de TypeScript
(`:161-162`)—, así que la constante es el valor inicial y no una fuente paralela. Es la
excepción al patrón que `F-1B-033` midió para entitlements y limits.

---

### F-1B-093 — Cincuenta y nueve rutas de billing viven en el otro repo y están montadas en la API, incluidas las de forzar una cancelación y un reembolso

`qzpay/packages/hono` (4.137 líneas) fabrica routers enteros, y hospeda monta **los tres**:

| factory | rutas que declara | dónde se monta en hospeda |
|---|---|---|
| `createBillingRoutes` | **30** | `routes/index.ts:776` → `/api/v1/protected/billing` |
| `createAdminRoutes` | **26** | `routes/billing/admin/index.ts:189` → `/api/v1/admin/billing` |
| `createWebhookRouter` | **3** | `routes/webhooks/mercadopago/router.ts:120` |

**Las 26 de admin, completas** (contadas sobre `router.<verbo>(\`${prefix}…\`)` en
`packages/hono/src/routes/admin.routes.ts`):

```
GET  /dashboard · /customers · /customers/:id/full · /subscriptions · /subscriptions/:id
     /payments · /payments/:id · /invoices · /invoices/:id · /plans · /promo-codes
POST /subscriptions/:id/force-cancel · /cancel · /pause · /resume · /change-plan · /extend-trial
     /payments/:id/force-refund · /payments/:id/refund
     /invoices/:id/pay · /mark-paid · /void
     /customers/:customerId/entitlements · /limits/:key/set · /limits/:key/reset
DELETE /customers/:customerId/entitlements/:key
```

Trece de esas 26 **mutan**: cancelan a la fuerza, reembolsan a la fuerza, pausan, cambian
de plan, extienden un trial, marcan una factura pagada y otorgan o revocan un entitlement.
Están escritas en el otro repo.

**Las 30 del tier protegido incluyen `POST /customers`, `POST /payments`,
`POST /subscriptions`, `POST /invoices`, `DELETE /customers/:id` y el par
`POST`/`DELETE /customers/:customerId/entitlements`** — o sea, otorgar y revocar
entitlements desde el tier de **sesión de usuario**, no de admin.

**Hospeda no las reescribió: les pasa ganchos.** `routes/billing/admin/index.ts:189-194`
invoca la factory con `hooks: adminBillingHooks`, y el docblock del archivo (`:35-37`)
cuenta el movimiento: *«The custom `subscription-cancel.ts` route that used to live here
was removed in this change — its Phase 1 + Phase 2 lifecycle is now expressed as
onBefore/onAfter hooks consumed by qzpay-hono v1.3+»*. El ciclo de vida de una cancelación
de admin es hoy un callback que ejecuta código del otro repo.

**Y el orden de montaje es lo único que decide quién atiende.** El mismo docblock
(`:8-31`) declara que las rutas propias se montan PRIMERO para ganar las colisiones, que
`GET /payments` y `GET /subscriptions` están sombreadas a propósito porque *«qzpay's raw
rows carry no user, no plan slug and no amount, and spell a cancelled subscription
`canceled`»*, y deja escrita la trampa: *«Adding a second path to either router would
**silently** take that path away from qzpay»*. No hay ningún guard que lo verifique: la
garantía es el comentario.

**Un conteo que no cierra y queda abierto.** `F-1B-016` midió **9** handlers bajo
`/api/v1/protected/billing` ausentes del documento OpenAPI, y esta factory declara **30**
registros sin ninguna condición de configuración visible —hospeda le pasa sólo
`{billing, prefix, authMiddleware}` (`routes/billing/index.ts:112-116`)—. Los dos números
se midieron distinto: aquél construyendo la app y leyendo `app.routes`, éste contando
registros en el fuente. **No se resuelve acá cuál es el denominador correcto**; queda
anotado como discrepancia a re-medir construyendo la app, que es el método que `F-1B-016`
ya demostró necesario.

> **Intentado y no logrado, 2026-09-17.** Dos corridas de la sonda: la primera murió en la
> resolución de módulos de `tsx`, y la segunda —ya con las diez variables de entorno
> obligatorias sintetizadas y `NODE_ENV=development`— **fue matada por el techo de cinco
> minutos sin llegar a imprimir**. Construir la app es reproducible pero no es barato;
> queda como la próxima medición de este carril, no como algo pendiente de método.

---

### F-1B-094 — De las 4.869 líneas de componentes React de qzpay, hospeda no usa ninguno: importa el proveedor y el tema

`qzpay/packages/react` trae **9 componentes** (`CheckoutButton`, `EntitlementGate`,
`ErrorBoundary`, `InvoiceList`, `LimitGate`, `PaymentForm`, `PaymentMethodManager`,
`PricingTable`, `SubscriptionStatus`) y **8 hooks** (`useCustomer`, `useEntitlements`,
`useInvoices`, `useLimits`, `usePayment`, `usePlans`, `useSubscription`, más
`useIsomorphicLayoutEffect`).

**Hospeda importa cuatro símbolos, y ninguno es un componente ni un hook**:

| símbolo | dónde |
|---|---|
| `QZPayProvider`, `QZPayProviderProps` | `apps/admin/src/routes/__root.tsx:2` |
| `QZPayThemeProvider` | idem |
| `qzpayMergeTheme`, `QZPayTheme` | `apps/admin/src/lib/qzpay-theme.ts:12-13` |

Contados uno por uno sobre `apps` y `packages` sin tests, los nueve componentes y los ocho
hooks dan **cero**. `usePlans` aparece una sola vez en todo el repo y es dentro de
`apps/admin/test/integration/qzpay-provider.test.tsx:72`.

O sea que el paquete se monta —hay un `QZPayProvider` envolviendo la aplicación del admin y
un tema fusionado— y **la UI de billing del admin está escrita entera en hospeda**. Es el
mismo reparto que `F-1B-090` midió en el motor con `promoCodes`, `addons`,
`paymentMethods` y `metrics`: la pieza existe del lado de qzpay, y la que corre es la de
hospeda.

---

### F-1B-095 — Los cuatro paquetes de qzpay sin consumidor son hojas: 11.997 líneas que nada de lo que hospeda usa importa

`F-1B-005` midió que hospeda usa 5 de los 9 paquetes. Falta la pregunta que decide el
alcance de un rediseño: **¿los otros cuatro cuelgan de los cinco, o al revés?**

**El grafo completo, leído de los `package.json`:**

| paquete | archivos | líneas | depende de |
|---|---|---|---|
| **`core`** | 90 | **22.611** | — |
| **`drizzle`** | 68 | **14.762** | `core` |
| **`react`** | 28 | 4.869 | `core` |
| **`mercadopago`** | 16 | 4.160 | `core` |
| **`hono`** | 22 | 4.137 | `core`, `drizzle` |
| | | | |
| `stripe` | 19 | 3.309 | `core` |
| `dev` | 9 | 3.039 | `core`, `drizzle` |
| `cli` | 21 | 3.142 | `core`, `drizzle`, `hono`, `mercadopago`, `stripe` |
| `nestjs` | 36 | 2.507 | `core`, `drizzle` |

**Los cinco que hospeda usa: 224 archivos / 50.539 líneas. Los cuatro que no: 85 / 11.997.**

**Las flechas van todas en la misma dirección.** Ninguno de los cinco declara depender de
ninguno de los cuatro, y en el código hay exactamente **cuatro menciones**, todas dentro de
un `@example` de docblock: `packages/hono/src/index.ts:10` y
`packages/core/src/services/saved-card.service.ts:9`, `:277`, `:285`, las cuatro
nombrando `@qazuor/qzpay-stripe` como el adaptador alternativo que se podría enchufar.
Ningún `import` real.

O sea: **`stripe`, `nestjs`, `cli` y `dev` son hojas.** Son 11.997 líneas que se pueden
mirar como fuera del alcance sin tocar una sola línea de lo que corre — y el `cli`, que es
el único que depende de cuatro paquetes a la vez, no depende de él nadie.

*Lo que esta medición NO dice*: si esas 11.997 líneas deben existir o no. Dice que la
pregunta se puede responder aparte de las otras 50.539, porque el grafo no las ata.

---

### F-1B-096 — Los mappers de qzpay descartan campos en silencio, y uno de los descartados es el que su propio repositorio usa para filtrar

Leídos enteros los 35 archivos de `qzpay/packages/drizzle/src/schema/` (20 / 2.450 líneas) y
`mappers/` (15 / 1.882), más `types.ts` (73) e `index.ts` (19).

**El mapper de suscripción devuelve 21 de las 34 columnas.**
`mappers/subscription.mapper.ts:20-55` (`mapDrizzleSubscriptionToCore`) no incluye
`trialConverted`, `trialConvertedAt`, `endedAt`, `promoCodeId`, `defaultPaymentMethodId`,
**`gracePeriodEndsAt`**, `retryCount`, `nextRetryAt`, `productDomain`,
`promoEffectRemainingCycles`, `courtesyStartsAt`, `courtesyEndsAt`,
`courtesyCyclesGranted` ni `version`. Y de escritura puede menos: el mapper de update
(`:123-170`) nombra **ocho** columnas.

**`gracePeriodEndsAt` es el caso que cierra el círculo**: el repositorio del mismo paquete
lo usa como filtro y como orden en las dos consultas de mora —
`repositories/subscriptions.repository.ts:659` (`gt`), `:694-695` (`isNotNull` + `lt`)—,
así que **quien llama a `findWithExpiredGracePeriod()` recibe un objeto de dominio sin el
campo por el que esa consulta lo seleccionó.**

**Y la asimetría del mapper de planes está documentada… del lado que la arreglaron.**
`mappers/plan.mapper.ts:45-48`, dentro del mapper de ESCRITURA, explica el defecto:

> *«This mapper builds the row field-by-field, so a field it does not name is a field the
> caller cannot set — which is how a stated `productDomain` used to be dropped here and
> answered by the column default instead.»*

El mapper de LECTURA está treinta líneas más arriba (`:13-28`) y **tiene exactamente ese
defecto para el mismo campo**: no devuelve `productDomain`, ni `displayName`,
`monthlyPriceArs`, `annualPriceArs`, `livemode` o `version`, todos declarados `notNull()` en
`schema/plans.schema.ts:19-56`. Es la razón por la que hospeda lee `product_domain` con
consultas tipadas propias en vez de por este camino.

**Tres mappers no descartan: inventan.**

| dónde | qué inventa |
|---|---|
| `mappers/limit.mapper.ts:81` | `customerId: drizzle.subscriptionId` — el `customerId` del objeto de dominio **contiene un id de suscripción**; la tabla no tiene columna de cliente. Y la vuelta no es simétrica: `mapCoreUsageRecordToDrizzle` (`:93-103`) exige el `subscriptionId` como parámetro aparte, así que nadie puede reconstruir el insert leyendo el objeto que este mismo mapper produjo |
| `mappers/promo-code.mapper.ts:52-53` | `updatedAt: drizzle.createdAt` y `deletedAt: null`, con sus propios comentarios —*«Schema doesn't have updatedAt»*, *«Schema doesn't support soft deletes»*— sobre una tabla que efectivamente no declara ninguna de las dos |
| `mappers/vendor.mapper.ts:49-52` | `payoutSchedule ?? { interval: 'weekly', dayOfWeek: 1 }` sobre una columna nullable sin default: le pone un significado («semanal, los lunes») que nunca se escribió |

`mappers/payment-method.mapper.ts:125` repite el primero de esos comentarios.

**Los cuatro campos del motor de promos de SPEC-262 no están en ningún mapper.**
`effect_kind`, `value_kind`, `duration_cycles` y `extra_days`
(`schema/promo-codes.schema.ts:46-65`) no aparecen ni en la lectura (`:31-55`), ni en la
creación (`:60-104`), ni en el update (`:109-176`) de `promo-code.mapper.ts`. En hospeda
esos cuatro nombres tienen entre 29 y 56 archivos con menciones: **toda esa funcionalidad
pasa por afuera de la API de qzpay**, que es lo que `F-1B-060` midió desde el otro lado.

**Treinta y tres columnas `jsonb` y ninguna se valida.** Las 15 funciones
`mapDrizzle*ToCore` castean con `as Tipo` directo —`(drizzle.config as PromoCodeConfig) ?? {}`
(`promo-code.mapper.ts:32`), `drizzle.payoutSchedule as QZPayPayoutSchedule | null`
(`vendor.mapper.ts:39`), `(drizzle.scheduledPlanChange as QZPayScheduledPlanChange | null)`
(`subscription.mapper.ts:49`), `drizzle.limits as Array<{key,value,action}>`
(`addon.mapper.ts:38`)—. Un JSONB con otra forma pasa sin error hasta que algo río abajo
busca un campo que no está.

**Y 34 columnas `varchar` tienen un dominio cerrado y ninguna restricción**, repartidas en
las 27 tablas — los diez `status` que `F-1B-007` ya midió, más `billing_interval`,
`provider`, `type`, `mode`, `effect_kind`, `value_kind`, `source`, `action`, `entity_type`,
`actor_type`, `payment_mode`, `onboarding_status` y `resource_type`.

**Dos consistencias, medidas por la negativa**: ningún mapper convierte centavos a unidades
mayores (todo monto viaja como el mismo entero en los 15), y ninguno toca la zona horaria
(todo `timestamp` pasa como el mismo `Date`). La única excepción monetaria es
`billing_vendors.commission_rate`, un `numeric(5,2)` que viaja como string y se convierte
en los dos sentidos (`vendor.mapper.ts:48`, `:72`).

**`types.ts` (73 líneas) está muerto entero**: `QZPayDrizzleConfig` se re-exporta y no lo
importa nadie —ni hospeda ni el propio `adapter/index.ts:35`, que define su propia forma—,
y `QZPayDrizzleConnectionStatus` (`:67-73`) ni siquiera se re-exporta.

---

### F-1B-097 — Doce de los dieciséis servicios del motor no tienen un solo símbolo alcanzable desde hospeda, y el único que sí está apagado por una constante

Leídos enteros los 14 archivos de producción de `qzpay/packages/core/src/services/`
(**7.920** de las 8.762 líneas del directorio; los otros dos son un test y un ejemplo).

**El reparto, medido nombre por nombre** —cada símbolo exportado de cada archivo, buscado
sobre `apps/` y `packages/` de hospeda sin tests:

| archivo | líneas | alcanzable desde hospeda |
|---|---|---|
| `subscription-lifecycle.service.ts` | 932 | **sí**, por un solo llamador |
| `checkout.service.ts` | 491 | sólo **2 de 26** exports, y de forma indirecta |
| `metrics.service.ts` | 440 | cableado en la fachada, **namespace nunca llamado** |
| `discount.service.ts` | 774 | **cero** |
| `security.service.ts` | 736 | **cero** |
| `resilience.service.ts` | 672 | **cero** |
| `notification.service.ts` | 573 | **cero** |
| `job.service.ts` | 563 | **cero** |
| `marketplace.service.ts` | 536 | **cero** |
| `usage.service.ts` | 518 | **cero** |
| `invoice.service.ts` | 430 | **cero** |
| `health.service.ts` | 312 | **cero** |
| `payment.service.ts` | 307 | **cero** |
| `saved-card.service.ts` | 299 | **cero** |
| `payment-method.service.ts` | 290 | **cero** |

**Doce de los dieciséis en cero.** Y once de esos doce **`billing.ts` tampoco los importa**:
existen sólo por el barrel público del paquete (`services/index.ts:9-47`).

**El único que hospeda llama de verdad está apagado.** `dunning.job.ts:63` importa
`createSubscriptionLifecycle` y `:677-678` invoca `processRetries()` y
`processCancellations()` — **2 de los 5 métodos públicos**. Pero `F-1B-026` ya midió que
`DUNNING_MUTATIONS_ENABLED = false` (`dunning.job.ts:245`) corta antes de llegar ahí. Y hay
una capa más: `processRenewals()` —nunca invocado— es el **único** camino del motor que
escribe `PAST_DUE` (`subscription-lifecycle.service.ts:329-344`, alcanzado sólo desde
`:394-418`), así que el conjunto sobre el que operarían los reintentos está vacío incluso
con el interruptor prendido. **Era un no-op estructural antes de ser un no-op por bandera.**

Lo mismo arrastra a las facturas: los tres caminos que llaman `billing.invoices.create()`
(`:460`, `:586`, `:746`) cuelgan de métodos inalcanzables. Verificado por el otro lado:
`invoices.create(` da **cero** en el código de producción de hospeda, y la única llamada a
`billing.invoices.*` es una lectura (`middlewares/billing-ownership.middleware.ts:118`).
Es la explicación de por qué `billing_invoices` tiene cero filas.

**Donde los dos lados hacen lo mismo, lo hacen distinto.** `qzpayCalculateDiscountAmount`
(`discount.service.ts:273`) redondea con `Math.round`; el reducer propio de hospeda
(`service-core/…/promo-code/effect-reducer.ts:29`) usa `Math.floor`. `F-1B-060` ya midió
que hospeda usa los dos redondeos dentro de una misma respuesta; ahora además se sabe que el
motor tiene un tercero y que nadie lo llama.

**Y donde no hacen lo mismo, el nombre engaña.** El `usage.service.ts` del motor modela
**facturación medida** (eventos, tramos graduados, un runner de facturación); el
`usage-tracking.service.ts` de hospeda modela **consumo contra los límites del plan**. Son
dos cosas distintas con la misma palabra, y hospeda no importa un solo símbolo del primero.

**La idempotencia es el caso más literal de convivencia.**
`apps/api/src/middlewares/idempotency-key.ts:29-38` apunta a la tabla
`billing_idempotency_keys` *«already present in the schema»* y define
`HOSPEDA_KEY_NAMESPACE = 'hospeda-billing:'` (`:51-54`) **para no chocar con las entradas
propias de qzpay-core en la misma tabla**. Los dos mecanismos escriben la misma tabla y
ninguno llama al otro.

**Una tensión que el sub-agente reportó sin resolver, y que se resuelve cruzando dos
mediciones.** `billing.checkout.create()` persiste **antes** de hablar con el proveedor
(`billing.ts:2086`, comentado *«Decision 1A: no orphans»*) y tiene dos call sites vivos, y
sin embargo `billing_checkouts` tiene cero filas en producción (`F-1B-009`). No es una
contradicción:

1. `addon.checkout.ts:650` está **después** del `return` de `:623-631`, que es la rama que
   corre cuando `RECURRING_ADDONS_ENABLED` está en `true` — y `F-1B-049` midió ese flag en
   **`true` en producción** y `false` en staging. En producción ese `create` es inalcanzable.
2. `subscription-checkout.service.ts:2217` es el cobro prorrateado de un **upgrade de plan**,
   y `F-1B-048` midió que en producción no hay **ninguna** suscripción `active`: las 8 son
   3 `trialing`, 3 `abandoned` y 2 `comp`. Nadie pudo hacer un upgrade.

O sea que la tabla está vacía porque ninguno de los dos caminos se ejerció, no porque la
escritura falle.

---

### F-1B-098 — La transacción del adaptador de qzpay no aísla nada, dos repositorios enteros no están enchufados, y el más grande expone 6 de sus 29 métodos

Leídos enteros los 21 archivos de `qzpay/packages/drizzle/src/adapter/` (2 / 1.465 líneas) y
`repositories/` (19 / 6.882).

**La transacción descarta la transacción.** `adapter/drizzle-storage.adapter.ts:271-275`:

```ts
async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(async () => {
        return fn();
    });
}
```

La firma del callback **no recibe ningún parámetro**, así que el cliente de sesión que
`this.db.transaction()` entrega no se captura ni se le pasa a `fn()`. Todo lo que `fn()`
haga corre sobre `this.db`, la conexión de afuera. **Es una transacción que abre una
transacción y después trabaja fuera de ella.**

No es un problema activo, por la razón que `F-1B-090` ya midió: `core/src/billing.ts` no
invoca `transaction(` ni una vez en sus 3.092 líneas, y en hospeda `getStorage().transaction`
da cero. La función existe, está mal, y nadie la llama.

(La utilidad que sí lo haría bien, `utils/transaction.ts:58`, sólo se usa en
`examples/transactions.example.ts` y en un JSDoc.)

**El contrato está implementado 1 a 1 — y eso es lo que esconde el hallazgo.** Las 14
sub-interfaces del contrato (`core/src/adapters/storage.adapter.ts:75-456`) están las 14 en
el adaptador (`:213-226`) y cada una implementa exactamente los métodos que declara. Lo que
no cierra es la capa de abajo:

| repositorio | métodos | los alcanza el adaptador | huérfanos |
|---|---|---|---|
| **`subscriptions`** | **29** | **6** | **23** |
| `invoices` | 26 | 7 | 19 |
| `customers` | 20 | 7 | 13 |
| `payments` | 20 | 8 | 12 |
| `vendors` | 20 | 8 | 12 |
| `addons` | 20 | 11 | 9 |
| `promo-codes` | 18 | 7 | 11 |
| `limits` / `entitlements` | 18 | 9 / 8 | 9 / 10 |
| `prices` | 17 | 6 | 11 |
| `payment-methods` | 15 | 8 | 7 |
| `plans` | 13 | 5 | 8 |
| `usage-records` | 10 | 1 | 9 |
| `checkouts` · `subscription-polling-jobs` | 5 · 6 | 5 · 6 | **0 · 0** |
| **`webhook-events`** | **18** | **0** | **18** |
| **`audit-logs`** | **14** | **0** | **14** |

**Los dos últimos no están enchufados en absoluto**: `WebhookEventsRepository` y
`AuditLogsRepository` suman **825 líneas y 32 métodos**, el contrato no declara ninguna
propiedad para ellos y el constructor del adaptador no los instancia — cero ocurrencias de
sus nombres en `drizzle-storage.adapter.ts`.

**Y las tablas que esos dos modelan son las que más filas tienen.** `billing_webhook_events`
(224) y `billing_webhook_dead_letter` (75) son las dos tablas más pobladas de las 27
(`F-1B-009`), y las escribe **hospeda con Drizzle crudo**:
`cron/jobs/webhook-retry.job.ts:594-596`, `:723-741`, `:777-814`, `:887-891` y
`routes/webhooks/health.ts:56-114`. Lo mismo con `billing_audit_logs`, escrita desde
`service-core/…/promo-code.crud.ts:276,539,604`, `…/billing-settings.service.ts:232,296`,
`…/addon.audit.ts:88` y `…/plan.audit.ts:86`.

Es el mismo patrón que `F-1B-097` midió con la idempotencia —hospeda escribiendo en la
tabla de qzpay con un prefijo de namespace para no chocar— y que `F-1B-090` midió con
`promoCodes`, `addons`, `paymentMethods` y `metrics`: **la pieza existe del lado de qzpay y
la que corre es la de hospeda, sobre la misma tabla.**

**El caso extremo es `subscriptions.repository.ts`**: 750 líneas, 29 métodos, **6**
alcanzables. Entre los 23 huérfanos está toda la sección de consultas de ciclo de vida
—`findNeedingRenewal:574`, `findTrialsEndingSoon:607`, `findNeedingPaymentRetry:649`,
`findWithExpiredGracePeriod:686`, `findPendingCancellationAtPeriodEnd:726`—. Y hospeda
tiene su propia `findTrialsEndingSoon` (`apps/api/src/services/trial.service.ts:1886`),
que `F-1B-046` ya midió **sin ningún llamador**: el mismo nombre, escrito dos veces, sin
consumidor en ninguno de los dos lados.

**`entitlements` repite el hallazgo de `limits` y nadie lo había anotado.**
`F-1B-034` midió que `findDefinitionByKey` y `listDefinitions` de `limits` no los llama
nadie. Sus gemelos de `entitlements` están en las mismas líneas relativas
(`repositories/entitlements.repository.ts:61`, `:70`), expuestos por el adaptador
(`:1216-1224`), y también en cero.

**Un `where` que filtra por la columna de la tabla equivocada.** Las tres cargas eager de
`repositories/customers.repository.ts` —`findByIdWithSubscriptions:367-378`,
`findByIdWithPaymentMethods:388-399` y `findByIdWithRelations:425-453`— escriben el filtro
de la relación anidada así:

```ts
with: { subscriptions: { where: isNull(billingCustomers.deletedAt) } }
```

`billingCustomers` es la tabla **padre**. El filtro de soft-delete de las suscripciones
está mirando la columna del cliente. Los tres métodos son huérfanos —ni el contrato ni
hospeda los alcanzan—, así que el defecto nunca se ejerció.

**El filtro de `livemode` es desparejo, y eso mezcla sandbox con producción.**
`checkouts.repository.ts:findByCustomerId` (`:67-94`) no lo filtra aunque su `search`
(`:99-135`) sí; `addons.repository.ts:findByPlanId` (`:77-90`) y las dos por suscripción
(`:263-280`) tampoco; y **ninguno de los diez métodos de lectura de `usage-records`** lo
filtra, aunque la escritura sí graba la columna. En `subscriptions.repository.ts` las cinco
consultas de ciclo de vida lo reciben **opcional** y sólo agregan la condición
`if (livemode !== undefined)`: sin argumento, la consulta corre sin filtro.

**`listAll` pagina sin tope.** El adaptador la implementa con `collectAllPages`
(`utils/collect-all.ts:56-96`), cuyo `maxItems` es opcional (`:66`): sin él, el `while(true)`
de `:78` sigue pidiendo páginas hasta que el proveedor diga que no hay más. **Ninguno de los
14 `listAll` del adaptador pasa `maxItems`.**

---

### F-1B-099 — De los 261 símbolos que exportan cinco directorios del motor, hospeda usa seis; y el que hace aritmética de fechas carga el bug que hospeda ya pagó

Leídos enteros los **43 archivos** de `qzpay/packages/core/src/` en `events/` (6 / 1.923),
`helpers/` (6 / 2.258), `utils/` (7 / 1.362), `errors/` (8 / 612) y `constants/` (16 / 486):
**6.641 líneas**.

**El consumo, medido símbolo por símbolo:**

| directorio | exporta | lo usa hospeda |
|---|---|---|
| `helpers/` | 80 | **1** (un tipo) |
| `utils/` | 68 | **0** |
| `events/` | 55 | **0** |
| `constants/` | 47 | **4** (los cuatro, sólo como tipo) |
| `errors/` | 11 | **1** |
| **total** | **261** | **6** |

Los seis: `QZPayBillingInterval`, `QZPayCurrency`, `QZPayPaymentStatus` y
`QZPaySubscriptionStatus` (tipos de `constants/`), `QZPaySubscriptionWithHelpers` (tipo de
`helpers/`), y `QZPayProviderSyncError`, la **única** clase de error que hospeda atrapa con
un `instanceof` (`apps/api/src/lib/billing-provider-error.ts:59`, `:102-104`).

**Ninguno de los cuatro tipos de `constants/` se usa junto a su objeto de valor.**
`QZPAY_SUBSCRIPTION_STATUS`, `QZPAY_PAYMENT_STATUS` y los otros trece vocabularios cerrados
tienen cero imports; las menciones que aparecen en un `grep` son comentarios —
`billing/reactivation-supersession-complete.ts:97,99` cita
`QZPAY_SUBSCRIPTION_STATUS.CANCELED` en un docblock sin importarlo.

**El catálogo de eventos y lo que se emite son dos conjuntos, y no coinciden en ninguna de
las dos direcciones.** `constants/billing-event.ts:4-54` declara **34** tipos; los
`emitter.emit(...)` reales de `billing.ts` cubren **25**. Los **nueve que nadie emite**:
`subscription.trial_ending`, `subscription.trial_ended`, `payment.disputed`,
`invoice.payment_failed`, `checkout.completed`, `checkout.expired`, `vendor.created`,
`vendor.updated`, `vendor.payout`. Y al revés: **`billing.ts` emite `'checkout.created'`
dos veces (`:2120`, `:2151`) y ese string no existe en el catálogo.**

**El almacén de eventos es un arreglo en memoria.** `QZPayInMemoryEventStore`
(`events/event-store.ts:59-203`) guarda en `private events: QZPayEvent[] = []` (`:60`) y su
propio docblock dice *«for development/testing»* (`:56-58`). No hay persistencia, ni cola,
ni reintento de entrega: si `emit()` falla, `safeExecuteAsync` (`event-emitter.ts:271-294`)
llama a `options.onError`, cuyo default es un `console.error` (`:70`). Da igual para
hospeda, que no se suscribe a ninguno (`F-1B-090`).

**Y el helper de fechas del motor carga exactamente el bug que hospeda ya midió y arregló
por su cuenta.** `utils/date.utils.ts:20` hace:

```ts
case 'month':
    result.setMonth(result.getMonth() + count);
```

`setMonth`/`getMonth` leen y escriben en el huso **local del proceso**. Hospeda escribió un
módulo entero para no hacer eso, y su docblock cita el incidente con números
(`packages/utils/src/utc-date-math.ts:7-24`, HOS-1010, bajo
`TZ=America/Argentina/Buenos_Aires`):

```
2026-02-01 + 1 month => 2026-03-04   (tres días de más)
2026-03-01 + 1 month => 2026-03-29   (tres días de menos)
```

y explica por qué no se ve en producción: *«production and CI run on Alpine with no `TZ`
set, so they are UTC and never see it, while a developer machine in Argentina computes
something else from the same row»*. Las 397 columnas `timestamp` del repo son `timestamptz`,
así que Drizzle siempre devuelve un instante UTC.

**`qzpayAddInterval` tiene cero usos en hospeda**, así que el bug no está vivo por este
camino. Lo que queda medido es que **el motor ofrece la primitiva con el defecto que su
consumidor ya pagó**, y el consumidor la reemplazó sin que el motor se enterara.

**El prorrateo del motor tampoco se usa.** `qzpayCalculateProration`
(`utils/money.utils.ts:108-114`) y `qzpayCalculateSubscriptionProration`
(`helpers/subscription.helper.ts:317-345`) están en cero, consistente con lo que `F-1B-090`
midió: hospeda pasa `prorationBehavior: 'none'` y cobra el delta por un checkout aparte.

**Y el motor tiene su propia máquina de estados, también sin usar.**
`utils/validation.utils.ts:423-477` declara `QZPAY_VALID_STATUS_TRANSITIONS` sobre los 8
estados de qzpay, con cuatro guardas (`:508-585`). Cero usos en hospeda, que construyó la
suya —`service-core/…/subscription/subscription-status-transitions.ts`, la que `F-1B-092`
midió como opt-in— sobre un vocabulario de 10 estados que incluye tres que el de qzpay no
tiene.

**Un detalle que hace falta para leer el código de errores sin equivocarse: hay DOS
`QZPayErrorCode` distintos en el monorepo de qzpay.** El de `core/src/errors/error-codes.ts`
(30 valores, entre ellos `ENTITY_NOT_FOUND`) y otro, del adaptador de MercadoPago. Hospeda
documenta y copia a mano los valores del **segundo** —`billing-provider-error.ts:113-114`
lo dice: *«copied here to avoid importing from the adapter package directly»*, con
`resource_not_found`, `invalid_card`, `card_declined` y siete más que **no existen** en el
primero— y del primero no importa nada: sus cinco apariciones en hospeda son todas
comentarios.

**Dos clases de error viven fuera de `errors/` y no se re-exportan desde su barrel**:
`QZPayAmountOverflowError` (`utils/money.utils.ts:159-168`) y
`QZPayInvalidStatusTransitionError` (`utils/validation.utils.ts:482-492`). Quien mire el
índice de errores no las ve.

---

### F-1B-100 — En 125 migraciones estructurales se quitaron ocho columnas y ninguna era de billing

Contadas las sentencias sobre los **125** archivos de `packages/db/src/migrations/*.sql`:

| | sentencias |
|---|---|
| `CREATE TABLE` | **175** |
| `ADD COLUMN` | **182** |
| `ALTER COLUMN` | 19 |
| `DROP INDEX` | 14 |
| **`DROP COLUMN`** | **8** |
| `DROP CONSTRAINT` | 2 |
| `RENAME COLUMN` | 2 |
| **`DROP TABLE`** | **1** |
| `RENAME TO` | 1 |

**357 sentencias que agregan contra 9 que quitan: cuarenta a uno.**

**Y las nueve, completas, no tocan una sola tabla `billing_*`:**

| migración | qué quitó |
|---|---|
| `0028_deep_machine_man.sql:14-15` | `amenities.name`, `features.name` |
| `0069_mushy_captain_america.sql:105` | `users.role` |
| `0072_wealthy_kingpin.sql:1-3` | `accommodations.media`, `experiences.media`, `gastronomies.media` |
| `0090_stale_charles_xavier.sql:1` | `accommodations.schedule` |
| `0098_graceful_tarantula.sql:1` | `DROP TABLE commerce_leads CASCADE` |

Los tres renames tampoco: `accommodations.featured_by_plan → featured_by_entitlement`
(`0040_fantastic_menace.sql:9`), `commerce_listing_subscriptions → entity_subscriptions`
(`0114_entity_subscriptions_rename.sql:1`, el de `F-1B-002`) y
`revalidation_log.path → target` (`0070_volatile_freak.sql:1`).

**En toda la historia versionada del esquema, ninguna columna de billing se retiró nunca.**
Es la contracara estructural de lo que este relevamiento viene midiendo por el lado del
código: `F-1B-064` encontró seis tipos `enum` de billing que ninguna columna usa,
`F-1B-096` catorce columnas de `billing_subscriptions` que el mapper no devuelve, y
`F-1B-034` dos tablas con veinte escritores y cero lectores. Nada de eso se quitó porque
**el carril estructural casi no quita**.

*Precisión del conteo*: son **sentencias**, no objetos distintos. Las 175 `CREATE TABLE`
incluyen las del `0000_baseline.sql` y cualquier repetición idempotente, así que ese número
no es «175 tablas»; producción tiene 174 (`F-1B-006`). Lo que la proporción mide es la
**forma** de las migraciones, no el inventario.

---

### F-1B-101 — El catálogo de producción usa seis dominios de producto, el enum declara seis, y no son los mismos seis

**Los 20 planes de `billing_plans` en producción**, medidos el 2026-09-17:

| dominio | planes | cuáles |
|---|---|---|
| `accommodation` | 6 | `owner-basico`, `owner-pro`, `owner-premium` (activos) · `owner-trial`, `owner-test-daily`, `tourist-plus` (inactivos) |
| `gastronomy` | 4 | `gastronomy-basico/pro/premium` (activos) · `gastronomy-trial` |
| `experience` | 4 | `experience-basico/pro/premium` (activos) · `experience-trial` |
| `partner` | 3 | `partner-gold`, `partner-silver`, `partner-listing` (los tres activos) |
| **`tourist`** | 2 | `tourist-free`, `tourist-vip` (los dos **activos**) |
| **`commerce`** | 1 | `commerce-listing` (**activo**) |

**El enum tiene seis valores y la base tiene seis, y la intersección es cinco.**
`packages/schemas/src/enums/product-domain.enum.ts` declara `ACCOMMODATION`, `GASTRONOMY`,
`EXPERIENCE`, `PARTNER`, **`TOURIST`** y **`ADDON`**.

- **`commerce` está en producción y no en el enum**: es el valor retirado, y está sobre un
  plan **activo**. `subscriptionMatchesDomain` compara con `value === domain`, así que ese
  plan no matchea ninguno de los seis — el modo de falla buscado, no un accidente.
- **`addon` está en el enum y no en ningún plan**: es un dominio de mecanismo, y el guard de
  duplicados lo saltea explícitamente (`duplicate-subscription-guard.ts:210-212`).

**Y `tourist` es un vertical de pleno derecho, con su razón escrita.**
`BUSINESS_VERTICAL_PRODUCT_DOMAINS` lo incluye con un comentario que cuenta el incidente
(HOS-1233): antes los planes de turista se archivaban como `accommodation`, y
reclasificarlos sin sumarlos a esa lista *«would make the "mi plan" widget stop seeing a
live subscription and show "no plan" to somebody who is paying»*.

En producción hay **8 suscripciones: 7 `accommodation` y 1 `tourist`** — el vertical de
turista no es teórico, tiene un suscriptor.

> ⚠️ **Corrige una afirmación que este relevamiento venía arrastrando.** El `CLAUDE.md` del
> proyecto dice que `ProductDomainEnum` *«holds exactly four values»*, y la usé como
> contexto en varios prompts de delegación de esta sesión. Contra el código son **seis**.

**La otra mitad: el campo que decide el vertical no llega en el objeto, y hospeda lo
repone.** `F-1B-096` midió que el mapper de qzpay devuelve 21 de 34 columnas y que
`productDomain` es una de las descartadas. El docblock de
`subscription-product-domain.ts:236-250` describe la consecuencia desde este lado:
`getByCustomerId()` devuelve objetos donde `productDomain` llega **`undefined` — nunca
`null`, nunca el valor real**, y `subscriptionMatchesDomain` lee ese `undefined` como
«fila vieja, falla abierto a accommodation». Sin reponerlo, *«a gastronomy-only subscription
would match a caller scoped to `accommodation`»*.

`hydrateSubscriptionProductDomains` es esa reposición: **73 referencias en 24 archivos**.

**Y hoy la compensación no tiene fugas, medido por la negativa.** De las **30 llamadas
reales** a `getByCustomerId` en **20 archivos**, cuatro no hidratan
—`routes/billing/plan-change.ts`, `routes/billing/subscription-cancel.ts`,
`routes/webhooks/mercadopago/notifications.ts` y
`service-core/…/addon/addon-user-addons.ts`— y **ninguno de los cuatro compara por
dominio**: sus menciones de `productDomain` son comentarios. El guard de duplicados, que sí
compara, **evita la fachada por completo**: hace su propio `select` nombrando la columna
(`duplicate-subscription-guard.ts:233`) y su docblock (`:45`) dice por qué.

*Nota de método, la decimonovena vez, y mía*: el primer barrido dio **8 archivos sin
hidratar** sobre 26, incluido el guard de duplicados — falso en las dos puntas.
`rg -l 'subscriptions\.getByCustomerId'` matchea la mención dentro de un **docblock**, que
es justamente donde el guard explica que NO usa esa API. Filtrando las líneas que empiezan
con `*` o `//` quedan 30 llamadas en 20 archivos, y las cuatro sin hidratar no comparan
nada. El hallazgo se dio vuelta entero al anclar el patrón.

---

### F-1B-102 — Un límite en cero no se puede guardar desde el editor de planes, y del otro lado se lee como ilimitado

Leídos enteros los **22 archivos** de `apps/admin/src` que importan `@repo/billing`
(**4.889 líneas**).

**El editor arranca con las 22 claves en cero y las descarta al enviar.**
`features/billing-plans/components/PlanDialog.tsx:87-89`, al crear un plan nuevo:

```ts
limits: plan?.limits
    ? plan.limits.map((l) => ({ key: l.key, value: l.value }))
    : Object.values(LimitKey).map((key) => ({ key, value: 0 }))
```

y `:110`, al enviar:

```ts
limits: value.limits.filter((l) => l.value !== 0),
```

O sea que **un plan creado sin tocar ningún límite se envía con el arreglo vacío**, y un
límite que el operador ponga deliberadamente en `0` desaparece del payload igual que uno
que nunca tocó. Las dos intenciones —«no configuré esto» y «esto no se permite nunca»—
colapsan en la misma ausencia.

**Y la ausencia se lee como ilimitado en los dos lados.** En el cliente,
`features/billing/use-my-entitlements.ts:103-105` hace `data?.limits[key] ?? -1`. En el
servidor, `F-1B-036` ya midió que `getRemainingLimit` devuelve `-1` ante una clave ausente
con el comentario *«Limit not defined - treat as unlimited»*, y que ése es el camino por el
que corre **toda** la enforcement porque `requireLimit` —el único que falla cerrado— no
tiene call sites.

**El cero sí significa algo cuando llega**: `F-1B-057` midió que `checkLimit` rechaza con
`maxAllowed === 0`. El problema no es que el servidor no lo entienda: es que el editor no
puede escribirlo.

**Y el indicador tampoco lo muestra.** `features/billing/LimitProgressIndicator.tsx:73`
corta con `if (maxAllowed === 0) return null;` **antes** de calcular la razón y el estado
`atLimit` (`:75-77`). Su propio docblock (`:39-43`) describe cuatro estados visuales
incluyendo *«≥ 100 % → destructive + explicit "límite alcanzado" copy + CTA»*: para un
límite en cero ese estado es inalcanzable — el componente desaparece en vez de avisar.

El comentario de `:70-71` nombra la postura: *«Fail-open by design»*, y aclara que ahí caen
tanto el staff (`-1` explícito) como *«actors whose plan does not expose this limit (hook
defaults missing keys to -1)»*. Es el mismo `-1` ambiguo que `F-1B-036` midió del lado del
servidor.

**Dos cosas más del mismo lote:**

- `features/billing-addons/components/AddonDialog.tsx:1-6` declara en su docblock *«Uses
  TanStack Form with Zod validation»* y **no importa `zod` ni pasa `validators` a ningún
  `form.Field`**. Las cinco lecturas de `field.state.meta.errors` (`:163`, `:188`, `:215`,
  `:290`, `:515`) leen un arreglo que nada en el archivo puebla, y el asterisco de
  «requerido» de `durationDays` (`:306-309`) es sólo visual.
- `features/billing-subscriptions/utils.ts:191` decide los destinos de un cambio de plan
  filtrando `ALL_PLANS`, y el docblock del propio archivo (`:110-116`) declara que ese
  catálogo *«is deliberately accommodation-only (SPEC-239) — `commerce-listing`,
  `partner-listing`, `partner-silver`, and `partner-gold` are excluded from it even though
  they are real, purchasable plans»*. `F-1B-101` midió esos cuatro planes **activos** en
  producción.

---

### F-1B-103 — El cartel de «compra exitosa» de los addons lo decide un parámetro de la URL, y el estado real de la compra se busca y no se mira

Leídos enteros los **15 archivos** de `apps/web/src` que importan `@repo/billing`
(**6.134 líneas**).

`pages/[lang]/mi-cuenta/addons/index.astro:188-189` lee `status` y `addon` de
`Astro.url.searchParams`, y `:199-216` arma el cartel **sólo con eso**:

```ts
const resultBanner = statusParam === 'success'
    ? { kind: 'success', message: t('account.addons.result.success',
          '¡Complemento adquirido con éxito!', { addon: resultAddonName }) }
    : statusParam === 'failure' ? { … } : null;
```

**La página sí conoce el estado real y no lo consulta para esto.** `:90` y `:107-114`
traen `ownedResult` y arman `ownedAddonSlugs` filtrando por `status === 'active'`, y ese
arreglo se usa **solamente** para pintar la lista (`:262`). El cartel no lo cruza en
ninguna línea.

Además, `resultAddonName` (`:196-197`) cae al **literal crudo del parámetro** cuando no
matchea ningún addon conocido, así que el texto puede nombrar algo que no está en el
catálogo. El `?status=` es lo que MercadoPago pone en la URL de retorno —el comentario de
`:193-194` lo dice—, no una lectura del estado local; y `F-1B-050` midió que en producción
corre el camino recurrente, cuya única confirmación es el webhook.

**Y hay una segunda fuente de verdad para la tabla de comparación.**
`pages/[lang]/funcionalidades/index.astro:35-49` importa `VIAJEROS_TABLE_ROWS` y
`ANFITRIONES_TABLE_ROWS` de `@/lib/features-content` —arrays escritos a mano— y los pinta
en `:258-268` y `:309-319`; su propio comentario (`:57-64`) lo declara: *«No session, no API
call — the content is i18n + code»*. En paralelo,
`components/billing/plan-comparison-rows.ts:509-527` deriva **cada celda** de
`plan.entitlements`/`plan.limits` reales, y su docblock (`:12-22`) dice existir exactamente
para evitar la desincronización que una tabla a mano produce.

**El precedente está escrito en ese mismo archivo.** `plan-comparison-rows.ts:43-56`
explica por qué no existe una celda «todo incluido»: un valor así, escrito a mano, fue el
bug **HOS-329** — la tabla le prometió a `tourist-free` una funcionalidad que la API
bloquea.

**Y dos de las doce claves sin gate de servidor se muestran hoy como disponibles, sin
marca.** De las doce que `F-1B-037` midió sin ningún chequeo en el servidor, cinco están en
la tabla: `priority_support` (`:243-248`), `custom_branding` (`:260-265`) y
`respond_reviews` (`:195-200`) llevan `status: 'upcoming'`, pero **`read_reviews`
(`:89-94`) y `can_contact_whatsapp_direct` (`:126-130`) llevan `status: 'available'` y
ningún `noteKey`**. Es la misma clase de riesgo que el comentario de `:43-56` describe.

**Las páginas de marketing no consultan nada.** `preguntas-frecuentes/index.astro` define
51 preguntas (`:59-138`), todas por i18n, y **una sola** interpola un número real
—`OWNER_TRIAL_DAYS` (`:170-173`)—, la constante y no el valor vivo.
`funcionalidades/index.astro` usa esa misma constante en tres lugares (`:199`, `:290`,
`:451`). Es la forma que `F-1B-088` midió: lo vivo y lo compilado conviven por página.

**Dos defaults que ocultan la diferencia entre «no hay dato» y «el dato es cero»:**
`lib/host/usage-badge.ts:139` usa `0` cuando `currentUsage` no es un número y `:142` usa
`'ok'` cuando falta el umbral; y `lib/commerce/usage-badge.ts:69` devuelve `null` tanto
para «el dueño no tiene suscripción» como para «la request falló», con el docblock
(`:49-53`) declarando las dos causas para el mismo valor.

---

### F-1B-104 — El motor declara tipos para un producto que su propio esquema no puede guardar, y sus utilidades de base las reimplementan los repositorios al lado

Leídos enteros los dos últimos directorios de qzpay sin relevar: `core/src/types/`
(21 archivos / 2.484 líneas) y `drizzle/src/utils/` (9 / 1.667). **4.151 líneas.**
Con esto **qzpay queda relevado entero salvo tests y ejemplos.**

**`core/src/types/` exporta 124 tipos y hospeda importa 14.** Los 110 restantes (**89 %**)
no aparecen en ningún `import` de hospeda. Los 14: `QZPayCustomer`, `QZPaySubscription`,
`QZPayPlan`, `QZPayPrice`, `QZPayPayment`, `QZPayPromoCode`, `QZPayCustomerEntitlement`,
`QZPayCustomerLimit`, `QZPayScheduledPlanChange`, `QZPaySubscriptionPollingJob`,
`QZPayCreatePriceInput`, `QZPayRefundInput`, `QZPayLogger` y `QZPayLogMeta`.

**Tres archivos de tipos no tienen tabla en ninguna parte.** Cruzados contra los 18
archivos de `drizzle/src/schema/`:

| archivo | líneas | qué modela | tabla |
|---|---|---|---|
| `usage.types.ts` | **406** | un motor de facturación **medida**: `QZPayUsageMeter` con `aggregationType`, `QZPayMeteredPrice` con `pricingModel`/`tiers`/`billingMode`/`resetBehavior`, `QZPayPricingTier`, y un job de facturación | **ninguna** |
| `setup-intent.types.ts` | 154 | los SetupIntents de **Stripe** | **ninguna** |
| `metrics.types.ts` | 66 | MRR, churn, ingresos | **ninguna** |

Lo único que persiste de uso es `billing_usage_records`
(`schema/usage-records.schema.ts:15-37`): un log plano con `metricName` como `varchar`
suelto, `quantity`, `action`, `timestamp` y `metadata`. **No hay tabla de medidores, ni de
precios medidos, ni de tramos.** El archivo de tipos más grande del directorio —el 16 % de
`types/`— promete precios escalonados, graduados, por paquete y tarifa plana que la capa de
almacenamiento no puede expresar.

`setup-intent.types.ts` sólo lo referencian los tres archivos de `packages/stripe/`, el
paquete que `F-1B-095` midió sin ningún consumidor en hospeda.

**Y un campo del tipo de promo no tiene columna.** `types/promo-code.types.ts:21` declara
`applicableProductIds: string[]` —**requerido**—, y `schema/promo-codes.schema.ts` no tiene
ninguna columna de productos: tiene `validPlans` (`:27`), que son planes. Del mismo par,
`:13` declara `stackingMode: QZPayDiscountStackingMode` contra un
`combinable: boolean` (`:32`): un enum tipado del lado del tipo, un booleano del lado de la
tabla.

**Del lado de `drizzle/src/utils`, dos archivos enteros están sin usar y los repositorios
hacen a mano exactamente lo que ofrecen.**

| archivo | líneas | exports | llamadas reales fuera de su archivo |
|---|---|---|---|
| `soft-delete.ts` | 264 | 15 | **0** |
| `pagination.ts` | 270 | 13 | **0** (salvo `getPaginationOrderBy`, que usa `order-by.ts`) |
| `optimistic-locking.ts` | 223 | 12 | **1** (`generateVersion`) |
| `transaction.ts` | — | 10 | **0** de producción: sus cinco helpers sólo los usa `examples/transactions.example.ts` |

Y al lado, en los mismos repositorios: **127 `isNull(…deletedAt)` escritos a mano** —la
expresión exacta que devuelve `excludeDeleted()` (`soft-delete.ts:29-31`)— y **101
`.limit(`** en vez de la paginación del propio paquete.

`order-by.ts` es el único con tracción real: `resolveOrderBy` lo llaman **11** de los
repositorios, y resuelve por `instanceof PgColumn` en vez de interpolar el string del
llamador, así que no es vulnerable a inyección por nombre de columna.

**Tres defectos concretos en esas utilidades sin usar:**

1. `optimistic-locking.ts:184-186` — `compareAndSwap(column, expectedValue, _newValue)`
   **no hace ningún swap**: devuelve `eq(column, expectedValue)`, o sea la mitad
   «compare». El tercer parámetro lleva guión bajo porque no se usa, y el docblock lo
   titula *«compare-and-swap condition for atomic updates»*.
2. `migrate.ts:121` — `ensureDatabase` interpola el nombre directo en DDL:
   `sql.unsafe(\`CREATE DATABASE "${databaseName}"\`)`, sin lista blanca ni escape más allá
   de las comillas. Cero llamadores.
3. `migrate.ts:76-79` — `hasPendingMigrations` consulta
   `information_schema.tables WHERE table_name = 'drizzle_migrations'`, mientras
   `runMigrations` (`:45-47`) delega en el `migrate()` de drizzle-orm, que lleva su propio
   registro con otro nombre. Cero llamadores.

**Y tres convenciones distintas para armar SQL dinámico conviven en el mismo directorio**:
`transaction.ts:204` y `:262` pasan un template literal crudo a `tx.execute(...)` sin la
etiqueta `sql`; `optimistic-locking.ts:198`,`:211` usan la etiqueta;
`soft-delete.ts:227` usa `sql.raw` marcando la parte interpolada.

*Nota de método que el sub-agente reportó y conviene guardar*: buscar estos nombres por
símbolo en hospeda da cientos de falsos positivos, porque `withTransaction`,
`isSoftDeleted`, `runMigrations` e `isActive` **existen nativamente en hospeda** y no
tienen nada que ver (`packages/db/src/client.ts:174`,
`packages/service-core/src/utils/relations.ts:37`,
`packages/seed/src/data-migrations/runner.ts:295`). Y `base.repository.ts:13,16,25` menciona
`withTransaction` dentro de un `@example`, no en un `import`. Es la misma trampa que
`F-1B-101` documentó del lado de hospeda.

---

### F-1B-105 — Los 1.032 handlers son el PISO, no el inventario: se midieron con billing sin inicializar, y faltan 48 rutas que sólo existen cuando arranca

`F-1B-093` dejó abierta una discrepancia —9 handlers medidos contra 30 declarados— y dos
intentos de re-medirla fallaron. **La sonda corre y es barata**: como test de vitest dentro
de `apps/api`, construye la app con `initApp()` y vuelca `app.routes` más el documento
OpenAPI en **31 segundos**. El camino que fallaba era `tsx`; el que anda es el mismo que ya
usan `test/schema-validation/field-enforcement/strict.test.ts` y otros cinco tests, que
llaman `validateApiEnv()` y `initApp()` sin base de datos. La sonda quedó versionada en
[`probes/probe-45-volcar-la-tabla-de-rutas.test.ts.txt`](./probes/probe-45-volcar-la-tabla-de-rutas.test.ts.txt).

**Reproduce `F-1B-016` exacto**, los seis números:

| | `F-1B-016` | esta corrida |
|---|---|---|
| Entradas en `app.routes` | 4.574 | **4.574** |
| … únicas | 1.757 | **1.757** |
| Middleware (`ALL`) | 725 | **725** |
| **Handlers** | **1.032** | **1.032** |
| Operaciones OpenAPI | 983 | **983** |
| Paths OpenAPI | 740 | **740** |

**Y el número tiene una condición que nadie había nombrado: billing no está inicializado.**
La causa está medida, no inferida. `apps/api/src/routes/billing/index.ts:101-109` abre con:

```ts
const billing = getQZPayBilling();
if (!billing) {
    apiLogger.warn('Billing routes created but billing is not configured');
    return createRouter();   // ← router VACÍO
}
```

y `getQZPayBilling()` devuelve `null` bajo el arnés de tests. **No porque falte configuración**:
la sonda 46 midió que `isBillingConfigured()` pasa —`HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` y
`HOSPEDA_DATABASE_URL` están los dos presentes— y que lo que falla es el cuerpo del `try` de
`getBillingInstance` (`apps/api/src/middlewares/billing.ts:142-155`):

```
createBillingAdapter = THROW  [vitest] No "createBillingAdapter" export is defined
                              on the "@repo/db" mock
createMercadoPagoAdapter = ok
```

O sea: **el mock global de `@repo/db` de `apps/api` no exporta `createBillingAdapter`**, el
`catch` de `getBillingInstance` se lo traga, deja `billingInstance = null` con su backoff, y
las dos fábricas de qzpay devuelven routers vacíos. Verificado además por la negativa:
`getDb()` **sí** funciona bajo el mock (`getDb=ok (object)`), así que el fallo es de ese
export puntual y no de la base.

**Qué falta, contado contra el fuente de qzpay en el ancla `c934164`:**

| factory | declara | ya están en la tabla | **ausentes** |
|---|---|---|---|
| `createBillingRoutes` (`/api/v1/protected/billing`) | **34** | 11 | **23** |
| `createAdminRoutes` (`/api/v1/admin/billing`) | **26** | 4 | **22** |
| `createWebhookRouter` | 3 | 0 | **3** |

**Las 48 ausentes incluyen toda la superficie mutante del otro repo**: `POST /customers`,
`DELETE /customers/:id`, `POST /subscriptions`, `PATCH /subscriptions/:id`,
`POST /subscriptions/:id/pause` y `/resume`, `POST /payments`, `POST /payments/:id/refund`,
`POST /invoices`, `POST /invoices/:id/void`, el par
`POST`/`DELETE /customers/:customerId/entitlements` del tier **protegido**, y del lado admin
`force-cancel`, `force-refund`, `change-plan`, `extend-trial`, `mark-paid`, `limits/:key/set`
y `limits/:key/reset`. Verificado por la negativa: `GET /api/v1/protected/billing/customers/:id`,
`…/subscriptions/:id`, `…/payments/:id`, `…/invoices/:id`,
`…/customers/:customerId/entitlements` y `…/customers/:customerId/limits` dan **cero
ocurrencias en las 4.574 entradas**, ni con ese prefijo ni con ningún otro.

**Y el webhook de MercadoPago no está en la tabla en absoluto.** De las seis entradas con
`webhook` en el path, ninguna es `/api/v1/webhooks/mercadopago`: son
`admin/webhooks/events`, `admin/webhooks/dead-letter`, `admin/webhooks/dead-letter/:id/retry`,
`webhooks/health`, `public/webhooks/brevo/:token` y `admin/social/make-webhook-schema`.

**Corrige de paso el denominador de `F-1B-093`.** `createBillingRoutes` declara **34**
registros, no 30: el patrón anclado a ``router.<verbo>(`${prefix}…`)`` no ve los **cuatro**
que abren el argumento en la línea siguiente (`billing.routes.ts:214`, `:232`, `:333`, `:425`).
Los 34 están gateados por ocho banderas de configuración —`customers`, `subscriptions`,
`payments`, `invoices`, `plans`, `promoCodes`, `entitlements`, `limits`— que **todas
defaultean a `true`** (`billing.routes.ts:52-60`), y hospeda no pasa ninguna
(`routes/billing/index.ts:112-116`), así que en producción los 34 corren. Con `createAdminRoutes`
(26, confirmado) y el webhook (3), qzpay aporta **63** registros y no 59.

*Qué queda sin medir, y por qué no se fuerza acá*: el conteo de handlers **con billing
inicializado** necesita una base de datos alcanzable, y eso excede lo que esta fase hace. Lo
que sí queda fijado es la dirección del error: **1.032 es un piso**, y ninguna afirmación
sobre «toda la superficie de la API» puede apoyarse en él sin decir esta condición.

---

### F-1B-106 — Los 9 handlers de billing fuera del contrato no son rutas de qzpay: cinco son un 404 que hospeda registra a propósito, y tres son overrides propios

`F-1B-016` midió 9 handlers bajo `/api/v1/protected/billing` ausentes del documento OpenAPI y
los atribuyó a *«rutas prefabricadas de qzpay»*. **Los nueve son de hospeda**, y la atribución
se cae con la misma medición que `F-1B-105`: en esa corrida el router de qzpay estaba vacío.

**Primero, la comparación que había que rehacer.** Contar «ausente del documento» exige
normalizar las dos grafías de parámetro: `app.routes` escribe `:id` y el documento escribe
`{id}`. Sin normalizar, **toda** ruta parametrizada aparece como no documentada —18 bajo ese
prefijo en vez de 9, y 149 en toda la app en vez de 49—. Con `:x` y `{x}` colapsados a un
mismo símbolo, los ausentes son **49** en toda la app, y **9** bajo `/protected/billing`,
que es el número de `F-1B-016`.

**Los nueve, por quién los registra:**

| handler | quién lo registra | qué contesta |
|---|---|---|
| `GET /customers` | `collection-listing-block.ts:212` | **404 a todo el mundo** |
| `GET /subscriptions` | idem | **404** |
| `GET /invoices` | idem | **404** |
| `GET /payments` | idem | **404** |
| `GET /promo-codes` | idem | **404** |
| `GET /promo-codes/:code` | idem, vía `BLOCKED_RESOURCE_LOOKUPS` (`:106`) | **404** |
| `GET /plans` | `protectedPlansListRouter` | el catálogo filtrado de hospeda |
| `GET /plans/:id` | `protectedPlanByIdRouter` | idem |
| `GET /plans/:id/prices` | idem | idem |

Los tres últimos están **verificados por el nombre del handler** en la tabla volcada:
`handleProtectedPlansList`, `handleProtectedPlanById` y `handleProtectedPlanPrices` son tres
de los apenas **26 nombres no anónimos** de las 4.574 entradas, y son de hospeda
(`routes/billing/protected-plans-list.ts`, `…/protected-plan-by-id.ts`, montados en
`routes/billing/index.ts:307` y `:315`).

Los seis primeros salen de `createCollectionListingBlocker`
(`routes/billing/collection-listing-block.ts:196-222`), montado **antes** del wrapper de qzpay
(`routes/billing/index.ts:330`) porque Hono resuelve por primera coincidencia. El módulo
**deriva qué bloquear de la tabla de rutas del propio qzpay**
(`findCollectionListingSegments:137-166`) y, cuando esa tabla viene vacía, cae en
`BASELINE_BLOCKED_COLLECTIONS` (`:88-94`) —`customers`, `subscriptions`, `invoices`,
`payments`, `promo-codes`— menos `TIER_EXEMPT_COLLECTIONS` (`:77`, que contiene `plans`).
**Cinco, más el lookup por código: seis.** El propio archivo escribió por qué existe el piso:
*«If `createBillingRoutes` ever fails to build (the factory returns an empty router on error)
discovery yields nothing, and without a floor the block would silently disappear along with
the routes it guards»* (`:82-87`).

**Esa corrida ES ese caso, y el piso funcionó**: la fábrica devolvió el router vacío, el
descubrimiento no encontró nada y los seis 404 se registraron igual. Es la única defensa del
relevamiento que se midió operando en su modo degradado.

**Qué cambia la corrección.** `F-1B-016` leía esas nueve como superficie del otro repo
respondiendo fuera del contrato. Lo medido es lo contrario: **cinco de las nueve son una
puerta cerrada que hospeda puso delante de qzpay**, y su motivo está escrito con el incidente
(`:1-20`): los handlers de listado de qzpay *«return every row and treat `customerId` as an
OPTIONAL filter»*, los dos guards que tenían delante se deferían mutuamente, y
*«any authenticated user could list every customer's name and email»*.

**Y hay un sentido en el que el documento no miente: cero operaciones sin handler.** De las
983 operaciones declaradas, **todas** tienen su handler registrado. La asimetría va en una
sola dirección: 49 handlers sin operación, 0 operaciones sin handler.

---

### F-1B-107 — Los 1.032 handlers por tier: el 55 % son de admin, y el middleware se reparte igual

El carril pedía el reparto de los 1.032. Medido sobre la misma tabla volcada, **contando
handlers registrados** —no operaciones del documento, que es lo que `F-1B-016` repartió—:

| tier | **handlers** | operaciones OpenAPI (`F-1B-016`) | diferencia |
|---|---|---|---|
| `/api/v1/admin/` | **568** (55 %) | 557 | 11 |
| `/api/v1/protected/` | **321** (31 %) | 299 | 22 |
| `/api/v1/public/` | **123** (12 %) | 115 | 8 |
| `/api/v1/ai/` | 3 | 3 | 0 |
| otros (`/api/auth/*`, `/docs`, `/api/v1/webhooks`) | **17** | 9 | 8 |
| | **1.032** | **983** | **49** |

Por método: **456** `GET`, **288** `POST`, **119** `DELETE`, **98** `PATCH`, **71** `PUT`.
(El reparto por método de `F-1B-016` —429/271/118/95/70— era el de las 983 operaciones; las
49 que faltaban se reparten en los cinco verbos.)

**El middleware sigue la misma proporción**, y eso no era obvio: de los **725** paths con
registro `ALL`, **387** son de admin (53 %), **210** de protected (29 %), **117** de public
(16 %), 4 de `ai` y 7 del resto. La densidad es pareja —0,68 middleware por handler en admin,
0,65 en protected, 0,95 en public— o sea que el tier público es el que **más** middleware
por endpoint acumula, no el que menos.

**Un detalle del volcado que conviene no perder**: `app.routes` guarda **una entrada por
cada handler de la cadena**, no una por endpoint. Por eso las 4.574 entradas colapsan a
1.757 pares únicos: `POST /api/v1/admin/billing/plans/:id/apply-price-increase`, por ejemplo,
aparece **tres** veces (dos anónimas y una llamada `mw`). Los 1.032 son pares
`método + path` distintos; contar entradas crudas da **2.204** para los mismos endpoints.

**Y la prueba de que el prefijo de billing está bien poblado por hospeda y no por qzpay**:
bajo `/api/v1/protected/billing` hay **36** endpoints en **61** registros crudos, y bajo
`/api/v1/admin/billing` hay **50** en **106**. Las 26 rutas de admin que `F-1B-093` contó en
qzpay —las trece que mutan incluidas— **no son ninguna de esas 50**: son las 22 ausentes de
`F-1B-105` más cuatro colisiones (`GET /subscriptions`, `/payments`, `/plans`, `/promo-codes`)
que hospeda gana por orden de montaje.

---

### F-1B-108 — Prender el control de pruebas de qzpay agrega cinco rutas a la app, y el flag no está seteado en ningún entorno

Medición de control de `F-1B-105`: la misma sonda, con `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true`,
da **1.037** handlers en vez de 1.032. Los cinco de diferencia, y no hay ninguno de menos:

```
GET  /api/v1/test/qzpay-control/state
GET  /api/v1/test/qzpay-control/recorded-calls
POST /api/v1/test/qzpay-control/reset
POST /api/v1/test/qzpay-control/fail-next
POST /api/v1/test/qzpay-control/delay-next
```

`F-1B-059` ya había medido que ese flag **no está seteado ni en producción ni en staging**
(`hops env-list --match QZPAY_TEST_CONTROL` devuelve `No matches` en los dos), y que habilita
las 618 líneas de instrumentación de `packages/billing/src/adapters/`. Lo que agrega esta
medición es que **también abre un tier de rutas HTTP propio** —un quinto prefijo junto a
`admin`, `protected`, `public` y `ai`— con dos endpoints que inyectan fallas (`fail-next`) y
demoras (`delay-next`) en el camino de pago.

Queda anotado como lo que es: superficie condicionada a una variable hoy ausente, medida por
el control y no por lectura del código.

---

### F-1B-109 — De los dos módulos de métricas de billing, uno NO está montado: nadie lo importa, y `F-1B-077` los contó a los dos

`F-1B-077` midió que las dos consultas de facturación filtran por un `status='completed'` que
no existe, y cerró diciendo que las consume *«una superficie duplicada … dos módulos de ruta
distintos, **los dos montados**: `routes/billing/metrics.ts:123-125` (montado en
`routes/index.ts:120`) y `routes/billing/admin/metrics.ts:186-188`»*.

**La primera mitad es falsa, y el error es de resolución de módulo.** `routes/index.ts:120`
dice `import { metricsRoutes } from './metrics'`, y desde `routes/index.ts` ese especificador
resuelve a **`routes/metrics/`, un directorio** —`routes/metrics/index.ts:167` exporta
`export { router as metricsRoutes }`—, que son las métricas de la aplicación y no tienen nada
que ver con billing. **`routes/billing/metrics.ts` no existe como `routes/metrics.ts`**:
verificado, `ls routes/metrics.ts` da *«No such file or directory»*.

**Y a `routes/billing/metrics.ts` no lo importa nadie.** Exporta cinco símbolos
—`getDashboardMetricsRoute:104`, `getRecentActivityRoute:208`, `getSystemUsageRoute:308`,
`getApproachingLimitsRoute:353` y `metricsRouter:393`— y las **únicas** ocurrencias de
`metricsRouter` en todo `apps/api/src` sin tests son las cinco líneas del propio archivo
(`:393` y `:396-399`, donde se arma a sí mismo). Los dos únicos `import` de un módulo de
métricas en el árbol de rutas son `routes/index.ts:120` (el directorio, ajeno a billing) y
`routes/billing/admin/index.ts:54` (`adminMetricsRouter`, el archivo hermano **que sí está
montado**).

**Lo confirma la tabla de rutas de `F-1B-105`**: bajo `/api/v1/admin/billing/metrics` hay
**un** endpoint por path —`metrics`, `metrics/activity`, `metrics/approaching-limits`,
`metrics/lifecycle`, `metrics/system-usage`—, cada uno con dos registros crudos (middleware
más handler), no cuatro. Si los dos módulos estuvieran montados habría dos handlers por path.

**El hallazgo de `F-1B-077` se sostiene; su alcance se reduce a la mitad.** El `'completed'`
inalcanzable sigue vivo, porque `routes/billing/admin/metrics.ts` —el montado— llama a los
mismos cuatro métodos de `getBillingMetricsService()`. Lo que se cae es la duplicación
*servida*: hay dos archivos, se sirve uno.

**Y el archivo muerto no es un esqueleto**: son 399 líneas que declaran cuatro rutas con
`createAdminRoute`, con su docblock afirmando en `:9` *«All routes are mounted under
/api/v1/admin/billing/metrics»*. Es el segundo caso del relevamiento —después de los seis
gates `PHANTOM-GATE` de `F-1B-037`— de superficie completa, sintácticamente válida y
documentada como viva, que ninguna línea alcanza.

---

### F-1B-110 — La tabla «clientes por plan» del panel de admin muestra UUIDs en las dos columnas, y el consumo promedio es siempre un objeto vacío

`getSystemUsage` (`apps/api/src/services/billing-usage.service.ts:109-120`) arma su tercera
consulta así:

```sql
SELECT
    plan_id as plan_slug,
    plan_id as plan_name,
    COUNT(*) as customer_count
FROM billing_subscriptions
WHERE status IN (…) AND livemode = … AND deleted_at IS NULL
GROUP BY plan_id
```

**No hay `JOIN billing_plans` en ninguna línea del archivo.** Las dos columnas se alimentan de
la **misma** expresión, y `:140-145` las mapea a `planSlug` y `planName` del DTO. Como
`billing_subscriptions.plan_id` es el `varchar` que guarda el **UUID** de `billing_plans.id`
—el gotcha que el `CLAUDE.md` del repo documenta—, las dos columnas de la tabla que ve un
administrador traen el mismo UUID, ni un slug ni un nombre.

**Y la tercera columna del mismo DTO está vacía por construcción**: `:144` escribe
`averageUsage: {}` literal, sobre un campo que el tipo declara
`Record<string, number>` (`:40`).

**El objeto de categorías tampoco está acotado a lo que declara.** `:124-137` inicializa
`{ owner: 0, complex: 0, tourist: 0 }` y después recorre las filas de
`COALESCE(segment,'unknown')` escribiendo `customersByCategory[cat]` **en las dos ramas del
`if`**:

```ts
if (cat in customersByCategory) {
    customersByCategory[cat] = Number(row.count);
} else {
    // Map unknown segments to a fallback
    customersByCategory[cat] = Number(row.count);
}
```

Las dos ramas son la misma sentencia; el `else` no mapea a ningún fallback pese a decirlo.
Cualquier valor de `billing_customers.segment` —incluido `'unknown'` cuando la columna es
nula— entra como clave nueva, así que la respuesta no respeta las tres claves que declara la
interfaz `SystemUsageStats.customersByCategory` (`:40`).

**Empalma con `F-1B-109`**: el método se sirve por `routes/billing/admin/metrics.ts`, el
único de los dos módulos que está montado, en
`GET /api/v1/admin/billing/metrics/system-usage`.

---

### F-1B-111 — Los dos servicios de sincronización de calendario prometen «nunca lanzar» y leen la credencial antes de cualquier `try`; la ruta que los expone documenta esa promesa como razón para no capturar nada

`google-calendar-sync.service.ts:52-60` declara: *«This service **never throws** for
operational failures — it records the outcome on the connection's sync-state columns … and
returns a discriminated `CalendarSyncResult`»*.

**La primera sentencia de la función es una lectura que puede tirar, y está fuera de todo
`try`.** Verificado a mano leyendo el archivo entero: la función arranca en `:283`, su primera
línea de trabajo es `:288`

```ts
const credential = await getGoogleCredential({ accommodationId });
```

y el primer `try` **de la función** está en `:303`. El `try` de `:248` no la cubre: pertenece
al helper `recordFailure`, declarado en `:243-266`, o sea que cierra veinte líneas antes de
que la función exista. El gemelo de iCal tiene la misma forma:
`ical-calendar-sync.service.ts:269` lee la credencial y su primer `try` propio está en `:313`.

**Y esa lectura desencripta sin red.** `getGoogleCredential`
(`google-calendar/google-calendar-credential.repository.ts:137-154`) llama `decryptSecret` dos
veces —`:137` para el access token y `:149` para el refresh token— **sin un solo `try`** en la
función. Lo mismo en `ical-credential.repository.ts:113-117` y en
`mercadolibre-oauth/ml-credential.repository.ts:180-190`. Un fallo de derivación de clave —la
`HOSPEDA_OAUTH_VAULT_MASTER_KEY` ausente, que ya bloqueó un smoke de producción una vez— o un
auth-tag GCM que no verifica, sale como excepción.

**Consecuencia medida en los dos consumidores:**

| consumidor | qué pasa |
|---|---|
| `routes/accommodation/protected/calendarSync.ts:88-93` | llama sin `try/catch` propio, y su docblock (`:20-22`) declara *«Neither sync service throws for operational failures … so a failed sync surfaces as a 200 with `status: 'error'`, not a 5xx»*. Un `Error` genérico no es `ServiceError` ni `RefinedBodyValidationError`, así que cae al camino por defecto de `handleRouteError` — no al 200 documentado |
| `cron/jobs/calendar-sync-google.job.ts:97-119` | sí tiene un `catch` por alojamiento, así que el barrido no se cae; pero **no llama a `recordFailure`**: suma `errors += 1` y agrega el caso a `failures[]` del resultado del job, y la fila del calendario **nunca recibe su `lastSyncStatus = ERROR`** |

O sea: por el camino de la ruta la promesa del docblock no se cumple, y por el camino del cron
el estado que el anfitrión ve en su panel no se actualiza. Los dos por la misma línea.

*Contraste dentro del mismo lote*: `recordFailure` (`:243-266`) **sí** envuelve su escritura en
un `try/catch` que sólo loguea. El archivo protege la anotación del error y deja sin proteger
la lectura que lo produce.

---

### F-1B-112 — Los dos vaults de credenciales son la mitad el mismo código, y sus 26 registros de error no llegan a Sentry

`social-credential-vault.service.ts:10` declara que *«Mirrors `ai-credential-vault.service.ts`
(SPEC-173 T-022) **file-for-file**»*. Medido, no leído: normalizando los identificadores que
varían por proveedor —`aiProviderCredentials`↔`socialCredentials`, `providerId`↔`key`,
`aiCredentialAudit`↔`socialCredentialAudit`— sobre las líneas de código sin comentarios,
**238 de ~465 líneas normalizadas coinciden exactamente: ratio 0,51**. El par
`listAiProviderCredentials` (`ai-credential-vault.service.ts:251-309`) ↔ `listSocialCredentials`
(`social-credential-vault.service.ts:640-696`) es la misma estructura entera con otros nombres.

Son **812 + 778 = 1.590 líneas** para dos bóvedas que hacen lo mismo con dos tablas distintas,
y hay una tercera familia al lado —los tres repositorios de credenciales de Google, iCal y
MercadoLibre— con el mismo esquema `get/save` y su propio cifrado.

**Tres políticas distintas ante un fallo de desencriptado, en cinco lecturas:**

| lectura | qué hace ante `decryptSecret` roto |
|---|---|
| `getDecryptedAiProviderCredential` (`:751-812`) | lo mete en el mismo `try` que todo lo demás → `INTERNAL_ERROR`, indistinguible de cualquier otro error |
| `getDecryptedSocialCredential` (`social-…:719-778`) | idem |
| `getGoogleCredential` (`…:137-154`) | **sin `try`**: la excepción sale (ver `F-1B-111`) |
| `getIcalCredential` (`…:113-117`) | **sin `try`** |
| `getActiveMLCredential` (`…:180-190`) | **sin `try`** |

O sea que «la clave maestra no está» y «el ciphertext está corrupto» nunca se distinguen entre
sí, y además se propagan de dos formas incompatibles según qué proveedor sea.

**Cero de los 26 registros de error de estos archivos llega a Sentry.** Contados uno por uno:
11 en `ai-credential-vault`, 6 en `social-credential-vault`, 2 en `google-calendar-sync`, 5 en
`ical-calendar-sync` y 2 en `ical-parser`. **Ninguno lleva `{ capture: true }`**, la
convención que el resto del repo sí usa —`addon-lifecycle-cancellation.service.ts` entre
otros—. Es la misma forma que `F-1B-068` midió en la cadena de addons recurrentes: 13 logs de
error en los archivos de checkout, 0 con captura.

**Y no hay un solo reintento.** Buscado `retry|retries|backoff|attempt` sobre los doce
archivos: los únicos aciertos son comentarios que **clasifican** un error como *retryable*
(`google-calendar-sync.service.ts:153`, `:345`, `google-calendar-client.ts:155`). Ninguna
llamada reintenta. Un fallo transitorio de Google queda registrado como `ERROR` y espera al
cron siguiente, seis horas después.

**Superficie que no alcanza nadie**, medida por la negativa:
`GoogleCalendarSyncTokenInvalidError` (`google-calendar-client.ts:143-150`) se declara y se
lanza (`:284`) y **ningún consumidor la importa ni la captura**; la rama `syncToken` de
`buildQuery` (`:229-242`) no se ejercita porque `fetchAllPages`
(`google-calendar-sync.service.ts:208-232`) nunca la pasa; y la columna `syncToken`, que
`google-calendar-credential.repository.ts:60,161` se ocupa de poblar, **no la desestructura
ninguno de los tres call sites** de `getGoogleCredential`. Es coherente con el propio docblock
del servicio (`:29-32`), que declara el sync incremental retirado — lo que quedó vivo es el
cableado que lo alimentaba.

---

### F-1B-113 — Las primitivas para dibujar un PDF están escritas TRES veces, y el archivo que explica por qué no hay que copiarlas copia cuatro de seis

`F-1B-053` midió que `commerce-brochure/brochure-render.ts` y
`experience-certificate/certificate-render.ts` comparten **57 líneas idénticas**. Leídos los
quince archivos restantes de esas tres familias, la duplicación es mayor y tiene un tercer
vértice.

**Las tres funciones de dibujo, en tres archivos:**

| pieza | `listing-qr-sheet/qr-sheet-page.ts` | `commerce-brochure/brochure-render.ts` | `experience-certificate/certificate-render.ts` |
|---|---|---|---|
| `measure` | `:59-68` (**exportada**) | `:206-211` (privada) | `:104-110` (privada) |
| `drawTextTopDown` | `:82-98` (exportada) | `:269-285` (privada) | `:113-127` (privada) |
| `drawRectTopDown` | `:142-158` (exportada) | `:288-304` (privada) | `:132-147` (privada) |

**≈120 líneas de la misma lógica en tres copias.** La única diferencia real entre ellas es el
nombre de la constante de alto de página —`A4_HEIGHT` en dos, `PAGE_HEIGHT` en la tercera,
**mismo valor**— y los `readonly` de la versión exportada.

**Y el archivo que argumenta contra eso lo hace.** `certificate-render.ts:14-18` dice:

> *«`toDrawableText` and `wrapText` are **IMPORTED** from `commerce-brochure/brochure-render`
> rather than copied: the WinAnsi substitution rule is a correctness property of every PDF
> this API emits … and **two copies of it would drift**.»*

Verificado a mano: `certificate-render.ts:42` importa **exactamente esas dos**. Las otras
cuatro —`measure`, `drawTextTopDown`, `drawRectTopDown`, `drawCentredLine`— están copiadas ahí
mismo, treinta líneas más abajo del comentario que explica por qué no habría que copiarlas.

**El tercer vértice es el más nítido**: `qr-sheet-page.ts:25` **ya importa** `toDrawableText`
de `brochure-render.js`, y `qr-sheet-render.ts:79` importa `wrapText` del mismo módulo. El
archivo tiene la dependencia abierta y reimplementa las otras cuatro igual.

**Y hay una cuarta capa de copia, más corta y más barata de romper:**

- `t()`, `i18nText()` y `LOCALE_FALLBACK` son **18 líneas byte a byte idénticas** entre
  `commerce-brochure/brochure-content.ts:88,129-148` y
  `experience-certificate/certificate-content.ts:40,80-99`, comentarios de tipo incluidos.
- El bloque `new Response(pdf, { headers: … })` con `Content-Type: application/pdf` y
  `Cache-Control: private, no-store` está tres veces —`brochure-response.ts:63-75`,
  `qr-sheet-response.ts:55-67`, `certificate-response.ts:106-118`— y el patrón
  `FILENAME_SAFE = /[^a-z0-9-]/g` otras tres (`:35`, `:28`, `:65`).
- `PUBLIC_PATH_SEGMENT` —los segmentos públicos `gastronomia` / `experiencias` /
  `alojamientos`— está definido dos veces como literal, en `brochure-content.ts:110-113` y
  `qr-sheet-content.ts:127-131`. Éste **sí** está declarado deliberado, y con un test que lo
  vigila (`qr-sheet-content.ts:116-125`).
- `FALLBACK_PRINTED_DOMAIN = 'hospeda.com.ar'` aparece en `qr-sheet-render.ts:191-197` y en
  `brochure-render.ts:421-427`, dentro de dos copias de la misma función `printedDomain()`.

*Qué NO dice esta medición*: si sobra código. Dice **cuánto** está repetido y **dónde**, medido
sobre el texto, y que la única defensa escrita contra esa repetición —el comentario de
`certificate-render.ts`— describe una disciplina que su propio archivo aplica a dos de seis
piezas.

---

### F-1B-114 — El archivo que existe para no pasar de 500 líneas tiene 752, y su función central falla abierta o cerrada según el addon

`apps/api/src/services/addon-lifecycle-cancellation.service.ts` abre con (`:7-9`):

> *«This module is re-exported from `addon-lifecycle.service.ts` **to keep each file under the
> 500-line limit**.»*

Medido: **752 líneas** (`addon-lifecycle.service.ts`, el que lo re-exporta, tiene 363). El
archivo que se creó para respetar el tope lo excede en un 50 %.

**Y `revokeAddonForSubscriptionCancellation` (`addon-lifecycle.service.ts`) aplica dos
políticas opuestas dentro de la misma función, según qué addon sea:**

| rama | dónde | ante un fallo de revocación |
|---|---|---|
| addon con definición conocida (`entitlement` / `limit`) | `:176`, `:242` | `await billing.entitlements.revoke(...)` **sin `try`**: la excepción se propaga — **falla CERRADO**, y el docblock lo declara `@throws … FATAL` (`:120-122`) |
| addon desconocido o retirado (`addonDef === undefined`) | `:284`, `:300` | las mismas dos llamadas, cada una en su `try/catch` que sólo hace `apiLogger.warn` (`:288-296`, `:304-312`), y la función devuelve `outcome: 'success'` igual (`:328-333`) — **falla ABIERTO** |

Las dos ramas están documentadas en el docblock (`:89-109`), así que es una elección escrita y
no un descuido. Lo que queda medido es su efecto: **un addon que el catálogo ya no conoce se
da por revocado sin haberlo revocado**, y el resultado no lo distingue de una revocación real.

**Tres cosas más del mismo lote, con su evidencia:**

1. **La escritura local del éxito está fuera de la transacción que la cubriría.**
   `addon-lifecycle-cancellation.service.ts:440-448` cierra la preapproval en MercadoPago,
   `:540-545` revoca contra QZPay, y recién `:548-562` abre un `withTransaction` que envuelve
   **una sola** sentencia. Si el proceso muere entre la revocación remota y ese `UPDATE`, el
   `catch` de `:576` marca la compra `failed` con el permiso ya quitado.
2. **`softCancelRecurringAddon` devuelve el mismo éxito haya movido una fila o ninguna.**
   `addon-soft-cancel.ts:207` es el **único** `return { success: true }` del archivo, fuera del
   `try/catch`, alcanzado tanto por `rowCount === 0` (`:159-163`, *«treating as already
   cancelled»*) como por `rowCount > 0` (`:165-176`). Lo único que cambia entre las dos ramas
   es si se manda el mail (`:203-205`).
3. **La obligación que el módulo de grants difereidos le impone a sus llamadores la cumple uno
   de tres.** `deferred-addon-grants.service.ts:85-90` escribe *«Callers must **not** cache a
   degraded answer»*. `middlewares/entitlement.ts:424-427` lee `grants.degraded` y devuelve
   `shouldCache: false`; `middlewares/owner-entitlement.ts:264-272` y `:836-845` **no leen el
   campo en ninguna línea**. (El segundo de esos dos queda de todos modos fuera del camino de
   caché por otra condición, `:826`; el primero no se verificó río arriba.)

---

### F-1B-115 — El detector de divergencias de pago no puede distinguir una divergencia de un ledger vacío, y hoy el ledger está vacío

`computeBillingDivergences` (`apps/api/src/services/billing/payment-divergence.service.ts`,
528 líneas) compara lo que MercadoPago reporta contra lo que hospeda registró.
`loadRecordedProviderPaymentIds` (`:133-155`) arma el conjunto `recordedIds` leyendo
`billing_payments` (`:137-140`), y `:441` clasifica:

```ts
.filter((payment) => !recordedIds.has(payment.id))
```

**`F-1B-009` midió que `billing_payments` tiene CERO filas en producción.** Con esa tabla
vacía el conjunto es vacío siempre, así que **cada pago aprobado que el proveedor devuelva
dentro de la ventana se clasifica como `unrecorded-payment`** — y el resultado no lleva nada
que permita distinguir «divergencia real» de «el ledger todavía no tiene una sola fila».

No es un defecto del archivo: es la intersección entre su lógica y el estado medido de la
tabla. Lo que queda anotado es que el panel de reconciliación de admin
(`GET /api/v1/admin/billing/reconciliation/divergences`, gateado por
`BILLING_RECONCILIATION_MANAGE`) es hoy, por construcción, una lista de todo.

**Y el archivo es de sólo lectura, verificado por la negativa**: cero `insert(`, `update(`,
`delete(` o `db.execute` en las 528 líneas, consistente con su propio docblock (`:398`,
*«this function performs no writes of any kind»*).

**Los diez archivos de `services/billing/` de este lote no abren una sola transacción**
—`grep '\.transaction('` da 0 sobre los diez— y no la necesitan: las cuatro escrituras que
existen son sentencias únicas, y la más delicada, `resolveOrphanPayment`
(`orphan-payment-queue.admin.service.ts:213-236`), pone el guard `status = 'unresolved'`
**dentro del `WHERE`** (`:225`) en vez de leer y después escribir. Es el único lugar del
relevamiento donde una carrera se cierra así.

**Un detalle de conteo que vale guardar**: `resolveOrphanPayment` existe **dos veces** con el
mismo nombre y sin relación: el servicio
(`orphan-payment-queue.admin.service.ts:203`) y una función local del admin
(`apps/admin/src/features/billing-reconciliation/hooks.ts:243`, un envoltorio de `fetch` del
lado del cliente). Un `rg -l` habría contado dos consumidores donde hay uno.

---

### F-1B-116 — El precheck de publicación está escrito dos veces y falla ABIERTO; el resolver de plan de commerce, al lado, falla cerrado

**Dos endpoints vivos calculan la misma decisión para alojamientos:**

| ruta | cómo llega |
|---|---|
| `GET /api/v1/protected/host-onboarding/precheck` | en línea: `accommodationService.count(...)` (`routes/host-onboarding/protected/precheck.ts:75`) + `list(...)` (`:95`) → `deriveOnboardingDecision` (`:114`) |
| `GET /api/v1/protected/publish/precheck/{vertical}` | `resolvePublishPrecheck` (`services/publish-precheck.service.ts:148`) → `countOwnListings`/`listOwnDraftListings` (`publish-listing-reads.ts:185`,`:238`, que para alojamiento hacen **el mismo** `service.count(actor, {ownerId})`, `:205`) → el mismo `deriveOnboardingDecision` (`:179`) |

Los dos convergen en la misma función pura y tienen **dos schemas de respuesta casi
idénticos** —`OnboardingPrecheckResponseSchema` (`host-onboarding/protected/precheck.ts:43-57`)
y `PublishPrecheckResponseSchema` (`publish/protected/precheck.ts:58-72`), mismos campos, mismo
enum de `decision`—. El repo ya sabe de la duplicación y explica por qué no la cerró:
`publish-listing-reads.ts:144-150` dice que *«Accommodation keeps calling `count()` … routing
it through a new call would change the one vertical that bills correctly today»*.

**El genérico falla abierto, y está declarado.** `publish-precheck.service.ts:31-36` y
`:92-99` definen `FAIL_OPEN` como `decision: 'create_direct'` con `hasQuota: true`, devuelto
cuando las lecturas no resuelven (`:165-171`) o cuando la función entera tira (`:192-202`).
Entre los caminos que llegan ahí está un `vertical` que el `switch` de
`publish-listing-reads.ts:103-123` no reconoce —su `default` devuelve `null` (`:120`)—, o sea
que **un vertical desconocido contesta «andá, publicá»**. Hoy es inalcanzable desde afuera
porque la ruta acota con `z.enum(['accommodation','gastronomy','experience'])`
(`publish/protected/precheck.ts:49`); el servicio por sí solo no lo impide.

**El vecino hace lo contrario.** `commerce-plan-resolver.ts` falla **cerrado** en los dos
casos que modela: configuración ausente o malformada → `CommercePlanNotConfiguredError`
(`:100-105`, `:124-126`), mapeado a **503** en sus cinco llamadores; plan pedido que no es de
ese vertical → `CommercePlanNotForVerticalError` (`:80-90`, `:197-200`), mapeado a **400**.

Es la misma asimetría que `F-1B-071` midió dentro de un solo archivo —`assertAccommodationPlanSlug`
cerrado contra `assertAccommodationPlanChangeTarget` abierto— ahora entre dos servicios del
mismo dominio.

---

### F-1B-117 — El segundo puente son 12 call sites, no 13, y el comentario que lo describe llama «segundo» a lo que es un tercero

`F-1B-062` midió `reconcilePartnerForSubscription` con **13** llamadas. Recontado anclando el
patrón a `reconcilePartnerForSubscription\(` sobre `apps` y `packages` sin tests: **13 líneas,
y una es la definición** (`services/partner-reconcile.service.ts:150`). Son **12** call sites,
en 8 archivos:

```
subscription-comp-grant.service.ts:634,765   dunning.job.ts:449,528
finalize-cancelled-subs.ts:643               abandoned-pending-subs.job.ts:368
subscription-logic.ts:1432                   qzpay-admin-hooks.ts:401,990,1070
subscription-pause.ts:388,497
```

Es la misma trampa que el `CLAUDE.md` del repo ya documentó para el otro puente —*«this bullet
twice carried a number that was wrong by the time it was read»*—, esta vez por un lugar
distinto: no por caducidad, por contar la declaración como uso.

**Y el reparto entre los dos puentes es asimétrico donde importa.**
`partner-reconcile.service.ts:157-250` envuelve **todo** su cuerpo en un `try/catch` que
loguea y no relanza, así que cumple de verdad el contrato de no-tirar. El otro,
`reconcileSubscriptionLinkedEntities` (`services/subscription-linked-entities.service.ts:104-120`),
**no tiene `try` ni `catch` propios**: su garantía depende enteramente de que sus tres
delegadas se traguen los errores, que es lo que `F-1B-062` verificó archivo por archivo.
Eso hace que un comentario como el de `commerce-subscription-attach.service.ts:207-213`
—*«Non-throwing by contract (see the reconcile service)»*— sea cierto sólo mientras las tres
delegadas lo sigan siendo, y no por nada que esté escrito en la función que se invoca.

**Y ese `attach` encadena dos escrituras sin transacción**: el
`insert().onConflictDoUpdate()` sobre `entity_subscriptions` (`:180-200`) y la llamada al
puente (`:209`). El propio docblock del módulo describe qué se ve cuando la segunda no ocurre
(`:160-164`): *«the listing sits PRIVATE until some unrelated webhook happens to fire for that
subscription — the owner pays nothing extra, sees nothing appear, and has no way to tell
whether it worked»*.

---

### F-1B-118 — Dos docblocks del carril de IA describen cableado que no existe, y uno de ellos es sobre a dónde van los errores

**1. El `recordEvent` que dice no tocar Sentry, lo toca.** `services/ai-service.factory.ts:18-19`
afirma: *«Wiring `recordEvent` as a structured debug log entry (**NOT** usage-metering; per-call
metering + **Sentry are out of scope** for T-043)»*. El cuerpo, en `:240`, inyecta
`recordEvent: createAiObservabilityRecordEvent()`, y esa función
(`services/ai-observability.service.ts:76-201`) llama `Sentry.addBreadcrumb` /
`Sentry.captureMessage` para `fallback`, `exhausted`, `kill_switch` y `moderation_error`, más
`ph.capture` de PostHog en 5 de sus 6 tipos de evento. El docblock quedó en T-043; el cableado
es de T-035, documentado correctamente en el otro archivo (`:1-37`).

**2. El auto-sync «fire-and-forget» al crear o rotar una credencial no está.**
`services/ai-sync-models.service.ts:47-48` dice: *«the auto-sync-on-create/rotate wiring (T-010)
calls this service the same way, **fire-and-forget**, from inside an already-authorized
mutation»*. Medido: el único call site de `syncAiProviderModels` es
`routes/ai/credentials/index.ts:267`, dentro del handler de `POST /{providerId}/sync-models`
(`:250-264`), **con `await`**. Leídos enteros `createCredentialRoute` (`:114-148`) y
`rotateCredentialRoute` (`:202-236`): ninguno nombra `syncAiProviderModels` ni
`syncAiProviderModelsPreflight`.

**3. Tres inserts secuenciales sin transacción en la persistencia del chat.**
`persistConversationTurn` (`services/ai-chat-persistence.ts:103-210`) inserta la conversación
(`:117-129`, sólo en el primer turno), el mensaje del usuario (`:161-170`) y el del asistente
(`:187-196`), cada uno con su `try/catch` que loguea y relanza. `db.transaction` da **cero**
ocurrencias en el archivo. Si el tercero falla, la conversación queda con la pregunta y sin la
respuesta.

**4. Quién mide y quién no, confirmado del lado de los servicios.** Ninguno de los ocho
archivos de IA de este lote escribe en `ai_usage`: el único `insert(aiUsage)` del repo está en
`packages/ai-core/src/storage/usage.storage.ts:104`, y el metering del chat ocurre en la
**ruta** —`routes/ai/protected/chat.ts:558` y `:593`— antes de llamar a `persistChatTurn`
(`:618`). O sea que la medición vive en el borde HTTP y no en el servicio, que es exactamente
la forma por la que `F-1B-067` midió que la traducción automática —cuyo camino es un adaptador
y no una ruta— no se cuenta en ninguna parte.

**5. El techo de gasto no lo aplica el servicio que se llama «cost-alert».**
`services/ai-cost-alert.service.ts` sólo manda mail a `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` en
los cruces de 50 / 80 / 100 % (`:139-160`). El bloqueo real lo hace `checkCostCeiling` lanzando
`AiCeilingHitError` (`packages/ai-core/src/usage/ceiling.ts:21-24`). Y el de-dup del aviso
**falla abierto por decisión escrita**: si la consulta a `billing_notification_log` tira,
`wasAlertSent` (`:70-98`) devuelve `false` en el `catch` (`:96`) y el mail se manda otra vez —
*«allow-through on error to avoid missing a critical alert»* (`:64-65`).

---

### F-1B-119 — El reintento de notificaciones no distingue «no había nada» de «la consulta explotó», y su cooldown fijo no es el backoff que su nombre sugiere

`services/notification-retry.service.ts` (456 líneas) reintenta las filas `failed` de
`billing_notification_log` cuyo `type` esté en `CRITICAL_TYPES` (`:44-56`:
`TRIAL_ENDING_REMINDER`, `PAYMENT_FAILURE`, `ADDON_EXPIRED`, `RENEWAL_REMINDER`,
`COMP_GRANTED`). Tiene un único llamador de producción,
`cron/jobs/notification-schedule.job.ts`.

**Los tres números son fijos y no hay progresión**: `MAX_RETRIES = 3` (`:31`),
`RETRY_WINDOW_HOURS = 24` (`:33`) y `RETRY_COOLDOWN_MINUTES = 60` (`:35`). El intervalo entre
intentos es **siempre 60 minutos** — no hay backoff exponencial en ninguna línea.

**Y el `catch` que envuelve la consulta entera colapsa dos estados distintos.** `:320-326`
atrapa cualquier excepción —incluida una caída de conexión— loguea, y **devuelve `stats` con
todos los contadores en cero**, que es exactamente el mismo objeto que devuelve `:150-153`
cuando la cola está vacía. El cron que lo llama no puede distinguir «no había nada que
reintentar» de «la consulta falló», mirando el resultado.

Es la misma forma que el relevamiento viene midiendo en los crons —`F-1B-019`, `F-1B-029`,
`F-1B-040`— ahora un nivel más abajo, en el servicio.

**Lo que sí está bien cerrado es la carrera entre workers**: el claim es un `UPDATE`
condicional `failed → processing` (`:214-222`), y si `claimedRows === 0` el registro se saltea
(`:226-233`). No hay lectura-y-después-escritura.

**Y el filtro de tipos críticos gatea el bucle completo**: un tipo que no esté en
`CRITICAL_TYPES` se saltea con un `debug` (`:167-173`), así que agregar un `case` en
`reconstructPayload` sin agregar el tipo a esa lista produce código inalcanzable — cosa que el
propio comentario de `:39-43` deja escrita.

---

### F-1B-120 — Qué agregan las 125 migraciones, y la aritmética contra producción cierra sin residuo

`F-1B-100` contó lo que las 125 migraciones **quitan** y dejó abierto lo que agregan, con una
advertencia: *«Las 175 `CREATE TABLE` incluyen … cualquier repetición idempotente, así que ese
número no es "175 tablas"»*. **Medido, sí lo es**: las 175 sentencias producen **175 nombres
distintos** —cero repeticiones— y ninguna está dentro de un comentario (verificado excluyendo
las líneas que abren con `--`).

**Y con eso la aritmética contra producción cierra exacta:**

```
175 tablas creadas
 −1 DROP TABLE  (commerce_leads, 0098_graceful_tarantula.sql:1)
────
174 = las 174 tablas de producción (F-1B-006)
```

La tabla renombrada de `F-1B-002` no rompe el balance: `commerce_listing_subscriptions` está
entre las 175 creadas (`0017_acoustic_dust.sql:37`) y en producción se llama
`entity_subscriptions`. Es el mismo objeto con otro nombre, no una más ni una menos.

**El reparto de las 175: 82 en el baseline, 93 en las otras 124.** O sea que **más de la mitad
del esquema se construyó después del punto de partida**, y en tandas grandes: `0026` crea las
16 tablas de social, `0005` las 8 de IA, `0017` las 7 de gastronomía y commerce, `0019` las 5
de experiencias, `0031` las 2 de partners.

**Las 6 tablas `billing_*` creadas después del baseline, todas de hospeda:**

| tabla | migración |
|---|---|
| `billing_mp_plans` | `0061_heavy_blade.sql` |
| `billing_pending_checkouts` | `0062_clammy_jigsaw.sql` |
| `billing_plan_price_changes` · `billing_plan_price_change_targets` | `0064_amused_maelstrom.sql` |
| `billing_plan_price_change_notices` | `0066_young_wendell_vaughn.sql` |
| `billing_orphan_payments` | `0095_sparkling_supernaut.sql` |
| `billing_mp_addon_plans` | `0118_mean_bill_hollister.sql` |

Ninguna de las **27 que modela qzpay** se creó después del baseline: las 27 están en
`0000_baseline.sql`. Lo que hospeda agregó en billing durante 124 migraciones son **seis
tablas satélite propias**, todas sobre el eje MercadoPago / cambio de precio / huérfanos.

**El resto del censo, medido sobre las 125:**

| operación | cantidad |
|---|---|
| `ALTER TYPE … ADD VALUE` | **155** |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` | **610** |
| `ADD CONSTRAINT … FOREIGN KEY` | **404** |
| `CREATE TYPE` | **92**, sobre **90** nombres distintos |
| `ADD COLUMN` | **181** |
| `CREATE TABLE` | **175** |
| Sentencias totales (por `;`) | **1.724** |

**Los 90 nombres distintos de `CREATE TYPE` son exactamente los 90 tipos `enum` que `F-1B-064`
midió en producción.** Segundo carril donde el repo y la base coinciden sin deriva.

**Y 36 de las 125 no crean ni agregan nada**: sólo alteran lo que ya existe —backfills,
cambios de tipo, índices, permisos—. Entre ellas están las cuatro que `F-1B-100` nombró como
destructivas (`0028`, `0069`, `0072`, `0090`) y las dos que rehacen un enum (`0029`, `0085`).

---

### F-1B-121 — Las trece columnas que hospeda le agregó a las tablas de qzpay son EXACTAMENTE las trece que los mappers de qzpay no devuelven

De las **181** columnas agregadas en 125 migraciones, **21 caen sobre tablas `billing_*`**, en
seis tablas. El reparto es el hallazgo:

| tabla | dueña del modelo | columnas agregadas |
|---|---|---|
| **`billing_subscriptions`** | **qzpay** | `product_domain`, `promo_effect_remaining_cycles`, `courtesy_starts_at`, `courtesy_ends_at`, `courtesy_cycles_granted` |
| **`billing_plans`** | **qzpay** | `display_name`, `monthly_price_ars`, `annual_price_ars`, `product_domain` |
| **`billing_promo_codes`** | **qzpay** | `effect_kind`, `value_kind`, `duration_cycles`, `extra_days` |
| `billing_addon_purchases` | hospeda | `mp_subscription_id`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `billing_interval` |
| `billing_mp_plans` | hospeda | `init_point`, `discount_cycle1_amount_ars` |
| `billing_pending_checkouts` | hospeda | `pending_trial_extension` |

**Trece de las 21 están sobre tablas que modela el otro repo. Y las trece son invisibles para
sus mappers de lectura**, verificado a mano en el fuente de qzpay en el ancla `c934164`, no
contra `F-1B-096`:

- **`subscription.mapper.ts`** — `mapDrizzleSubscriptionToCore` (`:20-55`) devuelve 21 campos y
  ninguno es de los cinco. `productDomain` aparece **una sola vez en todo el archivo**, en
  `:96`, dentro del mapper de **escritura**. Las cuatro de cortesía y el contador de ciclos
  dan **cero ocurrencias en el archivo entero**: qzpay no puede ni leerlas ni escribirlas.
- **`plan.mapper.ts`** — las cuatro aparecen **dos veces cada una**, y las ocho apariciones
  están dentro de `mapCorePlanCreateToDrizzle` (`:33-65`, líneas `:36`, `:38`, `:40`, `:49`,
  `:56`, `:57`, `:58`). `mapDrizzlePlanToCore` (`:13-32`), que es la **lectura**, no nombra
  ninguna.
- **`promo-code.mapper.ts`** — `effectKind`, `valueKind`, `durationCycles` y `extraDays` dan
  **cero** en el archivo completo: ni lectura, ni creación, ni update.

**Nueve de las trece no tienen camino de escritura tampoco** (las cinco de
`billing_subscriptions` menos `productDomain`, más las cuatro de `billing_promo_codes`). O sea
que **el motor no puede poner ahí un valor aunque quisiera**, y quien las escribe es hospeda
con consultas tipadas propias — que es exactamente lo que el `CLAUDE.md` del proyecto declara
para `product_domain` y para el motor de promos de SPEC-262.

*Qué abre, sin resolverlo acá*: son cuatro medidas del mismo hecho, tomadas en cuatro carriles
independientes y que coinciden. `F-1B-001` midió que hospeda es dueña del DDL y qzpay del
modelo; `F-1B-008` que hospeda le pone `CHECK` a tablas que qzpay modela; `F-1B-011` que
también le pone triggers; y ahora que **cada columna que hospeda agregó a esas tablas en 124
migraciones cayó fuera del modelo**. El §7 pide un único motor genérico: hoy hay uno que no ve
trece de las columnas que gobiernan vertical, cortesía y promoción.

---

### F-1B-122 — Los enums crecieron 155 veces y se destruyeron dos, y esas dos no están en el censo de operaciones destructivas

`F-1B-100` midió **9** sentencias que quitan —8 `DROP COLUMN` y 1 `DROP TABLE`— contra 357 que
agregan, y concluyó *«cuarenta a uno»*. El conteo es correcto para las dos formas que miró;
recorridas **todas** las formas destructivas, aparecen cinco más:

| operación | cantidad | ¿estaba en `F-1B-100`? |
|---|---|---|
| `DROP COLUMN` | 8 | sí |
| `DROP TABLE` | 1 | sí |
| **`DROP INDEX`** | **14** | sí (listado, no contado entre las 9) |
| **`DROP TYPE`** | **2** | **no** |
| **`DROP CONSTRAINT`** | **2** | sí (listado) |
| **`DROP DEFAULT`** | **4** | **no** |
| **`DROP NOT NULL`** | **7** | **no** |

**Las dos `DROP TYPE` son la única forma en que este repo quitó un valor de un enum**, y las
dos son `DROP TYPE` seguido de `CREATE TYPE` con la lista nueva:

| tipo | creado | rehecho | qué cambió |
|---|---|---|---|
| `partner_tier_enum` | `0031_nice_venus.sql:2` con `('bronze','silver','gold')` | `0085_known_agent_zero.sql:22-23` con `('silver','gold')` | **se retiró `bronze`** |
| `permission_enum` | `0000_baseline.sql` | `0029_dear_dormammu.sql:18-19` | se reescribió la lista entera |

Son también la explicación de los **92 `CREATE TYPE` sobre 90 nombres**: los dos nombres
repetidos son exactamente esos.

**Contra eso, 155 `ALTER TYPE … ADD VALUE`.** La proporción del carril de enums es **155
agregados contra 2 destrucciones**, y las dos destrucciones fueron rehacer el tipo entero
porque Postgres no sabe quitar un valor de un `enum`. Es la misma forma que el resto del
esquema —`F-1B-100` ya la había nombrado— medida ahora en el eje que decide qué estados existen.

*Corrección de conteo*: `ADD COLUMN` son **181**, no 182. La ocurrencia 182 está **dentro de un
comentario**: `0123_brief_nebula.sql:3` explica un modo de falla citando la frase
`` `ADD COLUMN ... NOT NULL` ``. Es la vigésima vez que un conteo por patrón da de más, y la
tercera en que la causa es la propia documentación del código (las anteriores: `F-1B-041` con
los locks retirados y `F-1B-014` con `updated_at`). Anclando a `ALTER TABLE … ADD COLUMN` en la
misma sentencia, son 181 y todas son reales.

---

### F-1B-123 — El inventario real son 1.078 handlers: el piso se levantó, y lo que entra es toda la superficie mutante del otro repo

`F-1B-105` dejó los 1.032 como un piso y el carril abierto por *«necesita una base alcanzable»*.
**No la necesita.** Lo único que separaba a `getQZPayBilling()` de devolver una instancia era el
export que le falta al mock —medido en `F-1B-105`—, así que alcanza con un `vi.mock('@repo/db')`
a nivel de archivo que reponga `createBillingAdapter` devolviendo un adaptador inerte. La app se
construye igual, en **25 segundos**, y el guard de la sonda lo confirma:
`billingConfigured: true`. Versionada en
[`probes/probe-47-la-tabla-de-rutas-con-billing-inicializado.test.ts.txt`](./probes/probe-47-la-tabla-de-rutas-con-billing-inicializado.test.ts.txt).

| | piso (`F-1B-105`) | **real** |
|---|---|---|
| Entradas en `app.routes` | 4.574 | **4.673** |
| **Handlers** | **1.032** | **1.078** |
| Middleware (`ALL`) | 725 | **726** |

**Cuarenta y seis handlers nuevos, y cero que desaparezcan.** El reparto coincide **exacto** con
lo que `F-1B-105` había derivado del fuente de qzpay sin construir nada: 23 en `protected`, 22 en
`admin`, 1 el webhook.

| tier | piso | **real** |
|---|---|---|
| `/api/v1/admin/` | 568 | **590** |
| `/api/v1/protected/` | 321 | **344** |
| `/api/v1/public/` | 123 | 123 |
| otros | 17 | **18** |
| `/api/v1/ai/` | 3 | 3 |

Por método: **471** `GET`, **314** `POST`, **122** `DELETE`, **100** `PATCH`, **71** `PUT`.

**Las 23 del tier de SESIÓN DE USUARIO son el hallazgo.** No son lecturas: entre ellas están
`POST /customers`, `DELETE /customers/:id`, `PATCH /customers/:id`, `POST /subscriptions`,
`PATCH /subscriptions/:id`, `POST /subscriptions/:id/pause` y `/resume`, `POST /payments`,
**`POST /payments/:id/refund`**, `POST /invoices`, `POST /invoices/:id/void`, y el par
`POST` / `DELETE /customers/:customerId/entitlements` más
`POST /customers/:customerId/limits/:key/increment` y `/usage`. O sea: **reembolsar un pago,
otorgarse un entitlement e incrementarse un límite, desde el tier protegido**, servido por código
del otro repo. El único freno es el `qzpayWrapper` de `routes/billing/index.ts:332-335`, que les
aplica `billingAdminGuardMiddleware()` y `billingOwnershipMiddleware()`.

**Las 22 de admin son las trece mutantes que `F-1B-093` listó**, ahora verificadas presentes en la
tabla y no sólo declaradas en el fuente: `force-cancel`, `force-refund`, `refund`, `cancel`,
`pause`, `resume`, `change-plan`, `extend-trial`, `invoices/:id/pay`, `mark-paid`, `void`,
`limits/:key/set`, `limits/:key/reset`, más `POST`/`DELETE /customers/:customerId/entitlements`,
`GET /dashboard`, `GET /customers`, `GET /customers/:id/full`, `GET /invoices`,
`GET /invoices/:id`, `GET /payments/:id` y `GET /subscriptions/:id`.

**Corrige el denominador de qzpay por segunda vez.** `createWebhookRouter` declara **UNA** ruta,
no 3: `webhook.routes.ts:76` es el único `router.post('/')` del archivo, más un `router.use`
—verificado con un patrón que atraviesa saltos de línea sobre sus 198 líneas—. Y la tabla lo
confirma: entró **un** handler (`POST /api/v1/webhooks/mercadopago`) y **un** middleware
(`/api/v1/webhooks/mercadopago/*`). El total de qzpay es **34 + 26 + 1 = 61** registros;
`F-1B-093` decía 59 y `F-1B-105` había dicho 63.

**Y de las 61, 46 llegan a la tabla.** Las otras 15 son colisiones que hospeda gana por orden de
montaje: 11 en `protected` —las cinco que el bloqueador de `F-1B-106` cierra con 404, las tres de
planes, `promo-codes`, `promo-codes/:code` y `POST /promo-codes/validate`— y 4 en `admin`
(`GET /subscriptions`, `/payments`, `/plans`, `/promo-codes`).

---

### F-1B-124 — `initApp()` no construye la app que se sirve, y el orden de dos líneas de `index.ts` es lo único que sostiene 22 rutas de admin

Al medir `F-1B-123` la primera corrida dio **1.056** handlers, no 1.078: **las 22 de admin no
aparecieron y las 23 de `protected` sí**. La diferencia no estaba en el código de la app sino en
el orden en que la sonda hacía dos llamadas.

**El tier de admin de qzpay no se monta al importar: lo monta una función explícita.**
`routes/billing/admin/index.ts:175-197` declara `mountQZPayAdminTier()`, con su propio candado de
idempotencia (`qzpayAdminMounted`), que sale temprano si `getQZPayBilling()` es nulo y sólo
entonces hace `createAdminRoutes({…hooks})` y `app.route('/', qzpayAdmin)`. El comentario de
`:155-162` declara el motivo —el *hoisting* de ESM y que el mount necesita la base lista— y quién
debe llamarla: *«Caller (index.ts) must invoke `mountQZPayAdminTier()` AFTER …»*.

**Y el llamador la invoca cincuenta y ocho líneas antes de construir la app:**

| línea de `apps/api/src/index.ts` | qué hace |
|---|---|
| `:300-301` | `const { mountQZPayAdminTier } = await import('./routes/billing/admin'); mountQZPayAdminTier();` |
| `:359` | `const app = initApp();` |

Ese orden es **load-bearing**, porque Hono **copia** las rutas de un sub-app al padre en el
momento del `app.route(...)`: `setupRoutes` absorbe `adminBillingRoutes` cuando corre, y todo lo
que se monte en ese sub-app **después** ya no le llega al padre. Medido con el control, que es lo
que lo vuelve una lectura y no una hipótesis:

| orden en la sonda | handlers | admin |
|---|---|---|
| `initApp()` y **después** `mountQZPayAdminTier()` | **1.056** | 568 |
| `mountQZPayAdminTier()` y **después** `initApp()` — el de `index.ts` | **1.078** | **590** |

**Veintidós rutas de admin de billing, once de ellas mutantes, dependen de que esas dos líneas no
se reordenen.** No hay nada que lo vigile: ni un guard, ni un test, ni un error al arrancar.
Invertirlas no rompe nada visible —las rutas simplemente dejan de existir— y el
`apiLogger.info('QZPay admin tier mounted…')` de `:196` se sigue imprimiendo igual, porque la
función sí corrió.

**La consecuencia más ancha es la otra mitad del mismo hecho: `initApp()` no es la app que se
sirve.** Es lo que construyen los seis tests que lo llaman, cualquier herramienta y las dos
sondas de este relevamiento, y le faltan 22 rutas **aunque billing esté perfectamente
configurado**. El único lugar donde la app completa existe es el proceso del servidor, entre
`index.ts:301` y `:359`.

Cruza con `F-1B-013`: el documento OpenAPI tampoco se genera en producción, porque
`configureOpenAPI` está detrás de `NODE_ENV !== 'production'`. **Las dos únicas formas de
observar el contrato de esta API —el documento y la construcción de la app— describen cada una un
objeto distinto del que corre.**

---

### F-1B-125 — Los otros cuatro vocabularios compartidos: tres enums de hospeda no tipan nada, factura tiene CUATRO vocabularios para una tabla sin filas, y el único gobernado es el que qzpay no modela

`F-1B-021` hizo esto para el estado de SUSCRIPCIÓN. Repetido para los otros cuatro, el reparto
es más desparejo de lo que hacía esperar.

| | qzpay declara | hospeda declara en `enums/` | coinciden verbatim | valores filtrados que ningún vocabulario declara | valores declarados que nadie escribe |
|---|---|---|---|---|---|
| **Pago** | **8** | 8 (`PaymentStatusEnum`) | **4** | **`'completed'`** | `authorized`, `captured`, `declined`, `disputed` |
| **Factura** | **5** | 8 (`InvoiceStatusEnum`) | **2** | — | **los 5 + los 8 + 3 más** |
| **Reembolso** | **3**, sin archivo de constantes | 6 (`RefundStatusEnum`) | **2** | — | `approved`, `processing`, `completed`, `rejected`, y `pending`/`failed` de qzpay |
| **Addon** | 3 (`billing_subscription_addons`), inline | 4 en Zod (`billing_addon_purchases`) | 3 | — | el vocabulario entero de `billing_subscription_addons` |

**Tres de los cuatro enums de `packages/schemas/src/enums/` no tipan ninguna columna.**
`PaymentStatusEnum` (`payment-status.enum.ts:5-22`), `InvoiceStatusEnum`
(`invoice-status.enum.ts:5-22`) y `RefundStatusEnum` (`refund-status.enum.ts:5-18`) generan sus
`pgEnum` en `enums.dbschema.ts:306`, `:308` y `:310`, y **ninguno de los tres símbolos tiene una
referencia fuera de esa declaración**. Es la contracara exacta, desde el lado del vocabulario, de
los seis tipos de billing que `F-1B-064` midió sin una sola columna que los use.

**Y sólo uno de los tres tiene su ausencia documentada.**
`packages/schemas/src/api/billing/admin-billing-view.schema.ts:47-54` explica por qué el de pago
no se reusa: *«describe un ciclo autorizar/capturar que la integración de MercadoPago nunca
produce»*, y reusarlo *«significaría declarar estados que nunca pueden ocurrir mientras se omite
`succeeded`, que es el más común de la tabla»*. Ahí mismo define un **tercer** vocabulario de
pago, `AdminPaymentViewStatusSchema` (`:42-64`), con 7 valores — los 8 de qzpay menos `disputed`.
Factura y reembolso no tienen esa explicación: sus enums están muertos sin nota.

**Factura es el caso extremo: cuatro vocabularios para una tabla con cero filas y cero
escritores.**

| vocabulario | dónde | valores |
|---|---|---|
| qzpay | `core/src/constants/invoice-status.ts:4-10` | `draft, open, paid, void, uncollectible` |
| hospeda, enum muerto | `schemas/src/enums/invoice-status.enum.ts:5-22` | `draft, issued, sent, paid, partial_paid, overdue, cancelled, voided` |
| **admin, tipo escrito a mano** | `apps/admin/src/features/billing-invoices/components/InvoiceDetailDialog.tsx:24` | `draft, open, paid, void, uncollectible` |
| **admin, un CUARTO para sponsors** | `apps/admin/src/routes/_authed/sponsor/invoices.tsx:21` | `draft, open, paid, void` |

El tercero coincide verbatim con qzpay y **no lo importa**: es un `type` literal en un `.tsx`, sin
pasar por `@repo/schemas` — para facturas no existe un `admin-invoice-view.schema.ts` análogo al
de pagos. Y `billingInvoices` sólo aparece en producción como re-export
(`packages/db/src/billing/index.ts:66-67`) y en un **borrado** de limpieza
(`packages/seed/src/data-migrations/0059-purge-test-and-commerce-example.ts:581-584`). Nunca un
`insert` ni un `update`, verificado sobre `apps` y `packages` sin tests.

**El reembolso es el más asimétrico: hospeda no escribe esa columna en ninguna línea.**
`billingRefunds` aparece exactamente dos veces en producción y las dos son el re-export
(`packages/db/src/billing/index.ts:99-100`). El único escritor de toda la base de código es
**qzpay-core**, `core/src/billing.ts:2462`, con `status: 'succeeded'`. Y de los tres valores que
qzpay declara, **sólo ése llega a materializarse como fila**: la rama `failed` tira antes de
escribir y la rama `pending` sólo toca el `metadata` de `billing_payments`.

Dato de nombre contra contenido: `apps/api/src/services/refund-lifecycle.service.ts` (546 líneas)
**nunca toca `billing_refunds.status`**. Escribe `billing_payments.refunded_amount` y
`billing_subscriptions.status = CANCELLED`. Gestiona el estado de la **suscripción** a partir de
un reembolso que qzpay ya asentó.

**Y el único vocabulario realmente gobernado es el de la tabla que qzpay NO modela.**
`billing_addon_purchases` es de hospeda de punta a punta, y es la única de las cinco columnas con
las tres capas alineadas: el `CHECK` de `extras/004-billing.constraints.sql:33-35`, el Zod activo
de `schemas/src/api/billing/customer-addons.schema.ts:16-21` y `addon.schema.ts:203`, y los
escritores reales. Los cuatro valores coinciden verbatim en las tres.

Su gemela del otro repo, **`billing_subscription_addons`, no la escribe nada**: verificado con
`insert(billingSubscriptionAddons)` y `update(...)` sobre `apps` y `packages` excluyendo tests —
**cero resultados**. El único insert del repo vive en `apps/api/test/e2e/helpers/billing-factories.ts:424`.
Son **dos tablas para el estado de un addon**, una modelada por qzpay y vacía, otra de hospeda y
viva, sin nada que las reconcilie.

*Qué abre, sin resolverlo acá*: el §63 pide una máquina de estados explícita para Payment, Addon
y las demás. De los cinco vocabularios medidos entre este hallazgo y `F-1B-021`, **uno solo tiene
restricción en la base**, y es el de la tabla que el motor no conoce.

---

### F-1B-126 — El grafo del dominio no es una malla: 253 de las 358 claves foráneas apuntan a `users`, y el 68 % de todo el grafo anula en vez de propagar

Las **358** claves foráneas internas de hospeda —las 399 de producción menos las 41 que cruzan a
qzpay o viven dentro de qzpay (`F-1B-010`)—, leídas de `pg_constraint` en producción el
2026-09-17.

**El grafo es una estrella.** El grado de entrada, ordenado:

| tabla | FK que la apuntan |
|---|---|
| **`users`** | **253** (71 % de las 358) |
| `accommodations` | 14 |
| `destinations` | 13 |
| `gastronomies` | 9 |
| `experiences` | 6 |
| `partners` | 5 |
| `social_posts` | 4 |
| el resto | ≤ 3 cada una |

Las **cinco** entidades de dominio juntas —alojamientos, destinos, gastronomías, experiencias y
partners— suman **47**, menos de la quinta parte de lo que apunta a `users`.

**Y el comportamiento de borrado dominante es anular, no propagar:**

| `ON DELETE` | cantidad | % |
|---|---|---|
| **`SET NULL`** | **244** | **68 %** |
| `CASCADE` | 90 | 25 % |
| `RESTRICT` | 21 | 6 % |
| `NO ACTION` | 3 | 1 % |

**Qué pasa exactamente al borrar una fila de `users`**, que es la pregunta que el 71 % del grafo
contesta:

- **CASCADE a 18 tablas**: `account`, `session`, `verification` no —ésa está aislada—,
  `ai_conversations`, `host_trade_benefit_usages`, `host_trade_reviews`,
  `host_trade_review_replies`, `newsletter_subscribers`, `r_entity_tag`, `tags`,
  `tourist_price_alerts`, `user_auth_identities`, `user_bookmarks`,
  `user_bookmark_collections`, `user_permission`, `user_push_tokens`, `user_role`,
  `user_search_history`.
- **RESTRICT desde 10 tablas**, o sea que el borrado **está prohibido** si el usuario tiene
  aunque sea una fila en: `accommodations`, `experiences`, `gastronomies`, `events`, `posts`,
  `owner_promotions`, `sponsorships`, `newsletter_campaigns`, `accommodation_calendar_sync`,
  `accommodation_occupancy`.
- **SET NULL en 222 columnas repartidas en 77 tablas.**
- `NO ACTION` en 3.

**Cierra el círculo de `F-1B-061`**: ninguna de esas 253 toca una tabla de billing, porque
`qzpay → hospeda` tiene **cero** claves foráneas y el cliente de billing se cruza sólo por
`external_id`. Borrar un usuario —si los diez `RESTRICT` lo permitieran— **no toca su fila de
`billing_customers` ni su suscripción**, que es exactamente el hueco que
`BillingCustomerSyncService.handleUserDeletion` existe para tapar y que ningún camino ejecuta.
En la práctica no se llega a ese punto: la ruta de admin llama `softDelete`, no borra la fila.

**Veintitrés de las 174 tablas no participan de ninguna clave foránea**, ni como origen ni como
destino. **Siete son de billing**, y son justamente las que este relevamiento ya midió sin dueño
funcional:

```
billing_entitlements      billing_limits            ← 20 escritores, 0 lectores (F-1B-034)
billing_webhook_events    billing_webhook_dead_letter  ← las 2 más pobladas, repos no
billing_audit_logs           instanciados (F-1B-098), escritas por hospeda con Drizzle crudo
billing_idempotency_keys  ← dos mecanismos escriben la misma tabla (F-1B-097)
billing_orphan_payments
```

Las otras dieciséis son bitácoras y configuración: `app_log_entries`, `audit_log_entries`,
`cron_runs`, `entity_views`, `entity_view_monthly_rollups`, `exchange_rates`,
`external_oauth_credentials`, `feature_flags`, `feature_flag_audit_log`, `revalidation_config`,
`revalidation_log`, `role_permission`, `seed_migrations`, `social_audit_log`, `social_settings`
y `verification`.

**Cuatro auto-referencias**: `destinations → destinations` con `RESTRICT`, y tres columnas de
`users → users` con `SET NULL`.

*Qué abre, sin resolverlo acá*: el §13 pide que la autorización verifique owner, scope de
vertical y estado de acceso. La base modela la propiedad de una sola forma —una columna que
apunta a `users`, 253 veces— y **no modela el vertical en ninguna**: `F-1B-085` ya midió que
billing toca el dominio por ocho banderas desnormalizadas sin restricción, y este grafo confirma
que del otro lado tampoco hay nada que ate un recurso a la suscripción que lo habilita.

---

### F-1B-127 — Las rutas de qzpay no verifican de quién es el recurso: el `customerId` es un filtro opcional del query, y sin él devuelven la tabla

Leídos enteros los 22 archivos de `qzpay/packages/hono/src` (4.137 líneas) en el ancla `c934164`.

**El único middleware propio del paquete no valida nada.** `createQZPayMiddleware`
(`middleware/qzpay.middleware.ts:30-35`) es, completo:

```ts
return async (c, next) => { c.set('qzpay', config.billing); await next(); };
```

Inyecta el motor en el contexto y llama a `next()`. **El paquete no exporta ningún middleware de
autenticación**: `authMiddleware` es un parámetro que tiene que traer el consumidor.

**Y es OPCIONAL en el tier de usuario y OBLIGATORIO en el de admin**, verificado en los tipos:

| factory | declaración | cómo se aplica |
|---|---|---|
| `createBillingRoutes` | `authMiddleware?: MiddlewareHandler` (`types.ts:256`) | `if (authMiddleware) { router.use('*', authMiddleware); }` (`billing.routes.ts:70-72`) |
| `createAdminRoutes` | `authMiddleware: MiddlewareHandler` — **sin `?`** (`admin.routes.ts:213`, comentado *«required»*) | `router.use('*', authMiddleware);` incondicional (`:276`) |

Sin ese parámetro, las 34 rutas del tier protegido quedan abiertas. Hospeda **sí** lo pasa
(`billingAuthMiddleware`, `routes/billing/index.ts:115`), así que no es un agujero vivo — es
dónde vive la garantía.

**El aislamiento entre clientes no existe en el paquete.** `billing.routes.ts:162-166`:

```ts
const query = c.req.valid('query');
if (query.customerId) {
    const data = await billing.subscriptions.getByCustomerId(query.customerId);
    …
}
const result = await billing.subscriptions.list({ limit: query.limit, offset: query.offset });
```

**`customerId` es un filtro opcional que el llamador provee, y sin él la ruta lista la tabla.**
El mismo patrón en pagos (`:281-285`) y facturas (`:358-362`); y como **parámetro de ruta sin
ninguna comparación con el actor** en `GET /customers/:customerId/entitlements` (`:537-546`),
`GET …/limits` (`:595-604`) y `POST …/entitlements` (`:562-579`). En las 692 líneas del archivo
no hay una sola comparación entre el `customerId` de la request y un identificador de actor.

Es exactamente el defecto que hospeda describió al construir su bloqueador (`F-1B-106`): *«they
return every row and treat `customerId` as an OPTIONAL filter the caller may supply, never as an
imposed limit … any authenticated user could list every customer's name and email»*. Lo que
agrega esta lectura es que **el diagnóstico de hospeda sobre el otro repo es correcto al pie de
la letra**, y que las rutas de listado que el bloqueador cierra con 404 no son las únicas con esa
forma: los seis accesos por `:customerId` la tienen también, y **ésos no los cubre el bloqueador**
—sólo cierra colecciones de un segmento— sino `billingOwnershipMiddleware`
(`routes/billing/index.ts:333`).

**Cada operación mutante de admin tiene un gemelo `force-*` que se saltea los hooks, y está
escrito.** Verificado leyendo los dos lados:

| con hooks | crudo, sin hooks |
|---|---|
| `POST /subscriptions/:id/cancel` (`:511-552`) | **`force-cancel`** (`:493-507`) — comentado *«raw cancel, no hooks»* |
| `POST /payments/:id/refund` (`:785-809`) | **`force-refund`** (`:767-782`) |
| `POST /invoices/:id/pay` (`:872-889`) | **`mark-paid`** (`:856-867`) |

Los tres crudos llaman el método del motor directo. Y eso tiene consecuencia medida **del lado de
hospeda**: `apps/api/src/services/admin-billing-view.status.ts:14-17` documenta que la ruta admin
de cancelación *«goes straight through the `@qazuor/qzpay-hono` tier, which writes qzpay's own
`canceled`»* —una L— mientras el camino del webhook normaliza a `cancelled`. Es el origen de la
divergencia de grafía que `F-1B-021` midió en la columna.

**Los `onAfter*` no pueden vetar nada, y su error se traga.** `safeAfterHook` (`:284-299`) atrapa
lo que tire el hook, lo loguea y sigue: *«The core operation has already committed at this point,
so we never let a hook failure flip the …»*. Su tipo de retorno es `Promise<void>`. Y los
`onBefore*` —los únicos que pueden abortar con 422— existen sólo para **tres** operaciones
(`cancel`, `pause`, `resume`, `:94-202`): **no hay punto de intercepción previo para reembolsar,
pagar o anular una factura, ni para otorgar o revocar un entitlement, ni para fijar o resetear un
límite.**

**Y hay tres formas de error distintas en un mismo paquete**: `{ error: message }` plano en el
tier de webhooks (`middleware/webhook.middleware.ts:170-179`),
`{ success: false, error: { code, message } }` en los otros dos (`billing.routes.ts:654-683` y
`admin.routes.ts:1066-1094`, **duplicados byte a byte salvo nueve líneas**), y una cuarta que
agrega `details` en el validador Zod (`validators/zod-validator.ts:33-46`). El
`createErrorResponse` que el paquete exporta (`middleware/error.middleware.ts`) **no lo usa
ninguna de las dos factories**: cada una define el suyo.

---

### F-1B-128 — El paquete de React de qzpay no es un cliente: exige el motor entero en el navegador, y por eso hospeda no usa ni un componente

Leídos enteros los 28 archivos de `qzpay/packages/react/src` (4.869 líneas).

`F-1B-094` midió que hospeda importa cuatro símbolos y ninguno es componente ni hook. **La razón
está en el tipo de una prop.**

`QZPayProviderProps.billing` es **`QZPayBilling`** (`types.ts:28`, `:58`) — la instancia del motor
de `@qazuor/qzpay-core`, la misma que `createQZPayMiddleware` inyecta del lado del servidor, con
su adaptador de almacenamiento y su adaptador de pagos adentro. Y **los hooks la usan directo**:
`usePlans.ts:34` hace `const billing = useQZPay()` y después llama `billing.plans.*`; igual
`useCustomer.ts:38`, `useSubscription.ts:44`, `useEntitlements.ts:37`, `useLimits.ts:36`,
`usePayment.ts:43` e `useInvoices.ts:34`.

**Verificado por la negativa: `fetch(` y `axios` dan CERO en los 28 archivos.** El paquete no
habla HTTP en ninguna línea.

**Consecuencia: `react` y `hono` no son interoperables entre sí.** Las rutas de `hono` devuelven
`{ success, data, pagination? }`; los hooks de `react` consumen objetos de dominio crudos
devueltos por una llamada de método. Un consumidor que quisiera enchufar `PricingTable` contra
`createBillingRoutes` tendría que escribir el adaptador, y **ninguno de los 28 archivos lo
escribe**. Son dos superficies de integración del mismo paquete que no se conectan.

Eso explica el consumo medido: hospeda usa las rutas de `hono` desde el servidor y **cero**
componentes de `react`, porque usarlos exigiría exponer el motor completo —y con él el adaptador
de MercadoPago y el acceso a la base— al navegador del admin. Lo único que monta son los dos
envoltorios que **no hacen red**: `QZPayProvider` (`context/QZPayContext.tsx:36-51`, sólo
`useState` + `useMemo`, sin un `useEffect`) y `QZPayThemeProvider`
(`theme/ThemeContext.tsx:160-217`, variables CSS en memoria).

**Dos cosas más, medidas:**

1. **El mismo esqueleto de hook está copiado siete veces.** El trío
   `isMountedRef` + `requestIdRef` + `try/catch/finally` con el chequeo
   `currentRequestId === requestIdRef.current` aparece igual en `useCustomer.ts:42-84`,
   `useSubscription.ts:50-101`, `usePlans.ts:38-76`, `useEntitlements.ts:43-85`,
   `useLimits.ts:42-84`, `usePayment.ts:49-91` e `useInvoices.ts:40-82`. No hay hook base.
2. **Un símbolo exportado en el barrel intermedio y no en la raíz queda inalcanzable, y pasa en
   los dos paquetes.** `QZPayErrorBoundary` sale de `components/index.ts:12` y **no** de
   `index.ts:29-38`; su tipo `QZPayErrorBoundaryProps` está además **declarado dos veces**, en
   `components/ErrorBoundary.tsx:11-27` y en `types.ts:688-704`. Del lado de `hono`, lo mismo con
   `AdminSetLimitSchema` (`schemas/limit.schema.ts:24-33`), que la raíz no re-exporta.

*Qué abre, sin resolverlo acá*: `F-1B-095` midió que `stripe`, `nestjs`, `cli` y `dev` son hojas
—11.997 líneas que nada de lo que hospeda usa importa—. Con esto, `react` queda en una posición
parecida pero no igual: **se monta, no se usa**, y sus 4.869 líneas no son alcanzables sin un
cambio de arquitectura que ponga el motor en el navegador.

---

## Carriles pendientes

El orden no está decidido.

| Carril | Denominador | Estado |
|---|---|---|
| ~~Esquema: censo de columnas, constraints y enums~~ | — | ✅ `F-1B-006` a `F-1B-009` |
| ~~Las 399 claves foráneas y la frontera hospeda↔qzpay~~ | — | ✅ `F-1B-010` |
| ~~Las 358 FK internas de hospeda: el grafo del dominio~~ | 358 | ✅ `F-1B-126` — **253 de las 358 apuntan a `users`**; 68 % del grafo es `SET NULL`; 23 tablas sin ninguna FK, 7 de ellas de billing |
| ~~Los 836 índices y los 132 triggers~~ | — | ✅ `F-1B-011`, `F-1B-012` |
| ~~Los 46 índices parciales y los de expresión: qué condición imponen~~ | — | ✅ `F-1B-074` — 46 parciales (33 únicos) y **2** de expresión, no 21 |
| ~~Los 90 `pgEnum` y su correspondencia con los enums de `@repo/schemas`~~ | — | ✅ `F-1B-064` — **90 de 90**, cruzados con `pg_enum` en prod |
| ~~Los 47 crons: nombre, horario y habilitación~~ | — | ✅ `F-1B-003`, `F-1B-017` |
| ~~Los 17 handlers de billing, leídos por dentro~~ | — | ✅ `F-1B-018` a `F-1B-031` |
| ~~Los 30 crons restantes (no tocan billing)~~ | 30 | ✅ `F-1B-040` a `F-1B-044` — **47 de 47** leídos |
| ~~Endpoints registrados por tier~~ | — | ✅ `F-1B-016` |
| ~~Los handlers por tier~~ | **1.078** | ✅ `F-1B-123` — 590 admin · 344 protected · 123 public · 18 otros · 3 ai. `F-1B-107` repartió los 1.032 del piso; éste es el inventario con billing inicializado |
| ~~Re-medir la tabla de rutas CON billing inicializado~~ | 61 registros de qzpay | ✅ `F-1B-123` — **no hacía falta una base**: alcanzó con reponer `createBillingAdapter` en el mock. Entran 46 de los 61; las otras 15 son colisiones que hospeda gana por orden de montaje. Y `F-1B-124`: `initApp()` **no** construye la app que se sirve |
| Qué hace cada uno de los 1.078 handlers, uno por uno | 1.078 | ⬜ |
| Los 67 servicios: métodos públicos y qué validan | 67 | 🟨 ver la fila de abajo |
| ~~Las 337 funciones de `apps/api/src/services`~~ | 337 (**333** nombres) | ✅ **185 de 185 archivos / 64.191 de 64.191 líneas (100 %)**. Los **74** que quedaban —**19.654 líneas**, medidos cruzando el censo contra las citas de este registro— se leyeron en siete carriles: `F-1B-110` a `F-1B-119`. **Nota de método**: el conjunto se reconstruyó por «archivos que este registro no cita por nombre» y da **74**, no los 63 que declaraba la fila anterior; la diferencia son 11 archivos leídos y nunca citados, así que 74 ⊇ 63 y la cobertura cierra igual. Lo cerrado antes: **addon** (22), **ai** (16), **plan** (6), **creación + idempotencia** (11), **trial** (7), **cambio de plan / cancelación** (10), **pagos y huérfanos** (8) y **promos + provisioning** (11): `F-1B-065` a `F-1B-084`. Los 74 del cierre: addons sin cubrir (8), `services/billing/` (10), billing de primer nivel (13), commerce/partner/publicación (8), credenciales y calendarios (12), IA (8), brochure/QR/certificado/media/feedback (15). Diez de los 185 no tienen cuerpo (`F-1B-063`) |
| ~~Los 52 archivos de `service-core/src/services/billing`~~ | 52 | ✅ **52 de 52 leídos enteros, 14.254 de 14.254 líneas** — `F-1B-060`, `F-1B-066`, `F-1B-086`, `F-1B-087`, `F-1B-092` |
| ~~Entitlements y limits: el catálogo y su reflejo en la base~~ | — | ✅ `F-1B-033`, `F-1B-034`, `F-1B-035` |
| ~~Dónde se CONSUMEN las 53 + 22 claves~~ | 75 | ✅ `F-1B-036` a `F-1B-039` — **75 de 75** medidas |
| Los 16 archivos de rutas que la matriz y el código no coinciden: leer uno por uno | 16 | ⬜ (`F-1B-038`) |
| ~~Superficies Web~~ | **15** archivos / 6.134 líneas | ✅ **15 de 15 leídos enteros** — `F-1B-088`, `F-1B-089`, `F-1B-103` |
| ~~Superficies Admin~~ | **22** archivos / 4.889 líneas | ✅ **22 de 22 leídos enteros** — `F-1B-089`, `F-1B-102` |
| ~~Las migraciones: qué quedó aplicado~~ | — | ✅ `F-1B-014`, `F-1B-015` |
| ~~Qué hace cada una de las 125 estructurales: qué agrega y qué quita~~ | 125 | ✅ `F-1B-100`, `F-1B-120`, `F-1B-121`, `F-1B-122` — 175 tablas (82 baseline + 93 después), 181 columnas, 155 `ADD VALUE`, 610 índices, 404 FK, 92 `CREATE TYPE` sobre 90 nombres; la aritmética cierra con las 174 de producción. Las 21 columnas de billing y las 13 que caen fuera del modelo de qzpay, en `F-1B-121` |
| Tests: qué comportamiento afirman (como evidencia de intención, no de corrección) | por medir | ⬜ |

Y en **qzpay**, con el mismo criterio:

| Carril | Denominador | Estado |
|---|---|---|
| ~~`core` — el motor: qué expone y qué decide~~ | 90 archivos / 22.611 líneas | ✅ **21.769 de 22.611 (96 %)** — `F-1B-090`, `F-1B-097`, `F-1B-099`, `F-1B-104`. Lo no leído son el test y el ejemplo de `services/` |
| ~~`drizzle` — las 27 tablas: columnas, constraints e índices~~ | 68 archivos / 14.762 líneas | ✅ **65 de 68, 14.438 líneas** — `F-1B-096`, `F-1B-098`, `F-1B-104`. Lo no leído es `examples/` |
| ~~`mercadopago` — el adaptador, contra las 89 filas ya medidas en 1C~~ | — | ✅ **16 de 16 leídos enteros, 4.160 líneas** — `F-1B-091` |
| ~~`hono` y `react` — las superficies que hospeda monta~~ | 50 archivos / 9.006 líneas | ✅ **50 de 50 leídos enteros** — `F-1B-127`, `F-1B-128`. Con esto **qzpay queda relevado entero** salvo tests y ejemplos |
| La frontera: qué decide qzpay y qué decide hospeda sobre el mismo hecho | por medir | ⬜ |
| ~~El vocabulario de estados y sus mapas~~ | — | ✅ `F-1B-021` |
| ~~Los otros vocabularios compartidos: pago, factura, reembolso, addon~~ | 4 | ✅ `F-1B-125` — tres enums de hospeda no tipan nada; factura tiene **cuatro** vocabularios para una tabla con cero filas; el único gobernado es el que qzpay no modela |
| ~~`stripe`, `nestjs`, `cli`, `dev` — sin consumidor en hospeda~~ | 85 archivos / 11.997 líneas | ✅ `F-1B-095` — son HOJAS: nada de lo que hospeda usa los importa |
