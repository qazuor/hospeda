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
| Los 47 cron jobs: qué hace cada uno, leído del handler | 47 | ⬜ |
| Endpoints registrados de la API por tier (`public` / `protected` / `admin`) | por medir | ⬜ |
| Servicios: métodos públicos y qué validan | por medir | ⬜ |
| Entitlements y limits: claves existentes y dónde se consumen | por medir | ⬜ |
| Superficies Web | por medir | ⬜ |
| Superficies Admin | por medir | ⬜ |
| Las 125 + 42 + 121 migraciones: qué quedó aplicado y qué quedó muerto | 288 | ⬜ |
| Tests: qué comportamiento afirman (como evidencia de intención, no de corrección) | por medir | ⬜ |

Y en **qzpay**, con el mismo criterio:

| Carril | Denominador | Estado |
|---|---|---|
| `core` — el motor: qué expone y qué decide | 89 archivos / 22.120 líneas | ⬜ |
| `drizzle` — las 27 tablas: columnas, constraints e índices | 27 tablas / 68 archivos | ⬜ |
| `mercadopago` — el adaptador, contra las 89 filas ya medidas en 1C | 16 archivos | ⬜ |
| `hono` y `react` — las superficies que hospeda monta | 50 archivos | ⬜ |
| La frontera: qué decide qzpay y qué decide hospeda sobre el mismo hecho | por medir | ⬜ |
| El vocabulario: `QZPAY_TO_HOSPEDA_STATUS` y quién lo esquiva (pista de `F-1B-005`) | por medir | ⬜ |
| `stripe`, `nestjs`, `cli`, `dev` — sin consumidor en hospeda | 85 archivos | ⬜ |
