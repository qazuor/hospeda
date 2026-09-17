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
| Cron jobs registrados | **47** | el arreglo `cronJobs` de `registry.ts` | **47** horario · **47** partición · **17 de 17** handlers de billing leídos |
| Migraciones estructurales | **125** | archivos, cruzados con `drizzle.__drizzle_migrations` en prod | **125** |
| Migraciones `extras` | **42** | `migrations/extras/*.sql`, inventariadas por sentencia | **42** |
| Data-migrations de seed | **105** | prefijo `NNNN-`, cruzado con `seed_migrations` en prod — **no** `fd -e ts`, que da 121 | **105** |
| **Handlers de la API** | **1.032** | `app.routes` con la app construida, menos 725 middleware — **no** los 1.150 archivos | **1.032** |
| … documentados en OpenAPI | **983** | el documento generado por la app | **983** |
| Servicios en `service-core` | 101 | `*.service.ts` — **provisorio**, ver `F-1B-003` | 0 |
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
| `billing_webhook_events` | 206 |
| `billing_webhook_dead_letter` | 63 |
| `billing_plans` | 20 |
| `billing_customers` | 19 |
| `billing_entitlements` | 14 |
| `billing_prices` | 10 |
| `billing_addons` | 9 |
| `billing_subscriptions` | **8** |
| `billing_idempotency_keys` | 6 |
| `billing_promo_codes` | 5 |
| `billing_promo_code_usage` | 4 |
| `billing_limits` | 3 |

**`billing_payments`, `billing_invoices`, `billing_refunds` y `billing_checkouts` tienen
cero filas**, contadas con `count(*)` y no con la estadística de `pg_stat_user_tables`.

Las 8 suscripciones se reparten en **3 `trialing`, 3 `abandoned` y 2 `comp`**. No hay
ninguna `active`.

*Por qué importa para el relevamiento y no sólo para la migración*: 63 entradas en
`billing_webhook_dead_letter` contra 206 eventos procesados es una proporción que hay que
mirar, y **la mitad del esquema de billing nunca recibió una fila**. Una tabla vacía no
dice si su código funciona.

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
| Los 30 crons restantes (no tocan billing) | 30 | ⬜ |
| ~~Endpoints registrados por tier~~ | — | ✅ `F-1B-016` |
| Qué hace cada uno de los 1.032 handlers | 1.032 | ⬜ |
| Servicios: métodos públicos y qué validan | por medir | ⬜ |
| Entitlements y limits: claves existentes y dónde se consumen | por medir | ⬜ |
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
