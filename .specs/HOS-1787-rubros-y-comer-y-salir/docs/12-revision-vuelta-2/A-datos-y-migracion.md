---
title: Revisión vuelta 2 · Revisor A · Datos, migraciones, mecánica del renombrado y corte
linear: HOS-1787
created: 2026-10-25
---

# Revisión vuelta 2 · A · Datos y migración

Lente: modelo de datos, migraciones, mecánica del renombrado en su variante única («antes del corte»),
interacción con el corte V6 de HOS-1352, columna `business_lines`, tipos nuevos y `nightInfo`, seed.
Leído contra la spec ya resuelta (DEC-FAC-026…039) y contra el código en el worktree
`hospeda-hos-1795-claude-md` (HEAD `a44b8f05b4` = `origin/staging` + un commit de docs); prod, contra
`origin/main` @ `c52c57b587`. No se consultó ninguna base ni se corrió nada que cambie estado.

No se re-levantan hallazgos de la vuelta 1 ya cerrados, salvo donde el arreglo es incompleto o
incorrecto (se dice explícitamente).

## Resumen

| severidad | cantidad |
|---|---|
| CRÍTICA | 2 |
| ALTA | 3 |
| MEDIA | 8 |
| BAJA | 9 |
| **total** | **22** |

Lo más importante en cuatro líneas:

1. **Editar sólo 0129/0144/0176 rompe la cadena de migraciones**: la 0139 (no editada) deja un CHECK que
   sólo admite `'gastronomy'`, y la 0176 editada inserta `'{venue}'`. Falla en toda base desde cero
   (CI, plantilla, staging reseteado) y en prod en el paso 3 del corte (F-V2-A-001).
2. **Prod sí tiene valores `'gastronomy'` que nadie convierte**: amenities y features del catálogo
   `required` (`applicable_verticals`), escritos por data-migrations ya corridas en prod. Con el enum Zod
   estricto, la lectura de amenities/features revienta después del corte (F-V2-A-002).
3. **Prod no recibe el renombrado «por el baseline»: ejecuta la migración de renombrado** en el paso 3 del
   corte, en una sola transacción con 0125…0178. El reset de staging hace que el único ambiente con una
   base vieja y extras aplicados sea prod, y la spec no ensaya ese camino entero (F-V2-A-003, 004).
4. **«`ADD VALUE` en una migración separada» no alcanza**: `drizzle-kit migrate` corre todas las
   pendientes en una sola transacción (F-V2-A-005).

Decisiones del owner necesarias: **F-V2-A-001** (ampliar la lista de migraciones editadas de DEC-FAC-029)
y **F-V2-A-009** (qué significa «marcha atrás» de DEC-FAC-030). El resto se puede resolver sin owner.

---

## CRÍTICA

### F-V2-A-001 · La 0176 editada viola un CHECK que dejó la 0139, que no se edita

**Qué está mal.** DEC-FAC-029 y el sub-spec 1 limitan la edición en origen a 0129, 0144 y 0176. Pero la
`0139` crea dos CHECK con la lista de verticales escrita literal, incluida `'gastronomy'` y sin `'venue'`:
`ck_addon_product_compatible_verticals` y `ck_promo_code_verticals`. Ninguna migración entre 0139 y 0176
los cambia. La 0176 inserta filas de `addon_product` con `compatible_verticals = '{gastronomy}'`; editada
para que nazca `venue`, inserta `'{venue}'`, que el CHECK de 0139 rechaza.

**Evidencia.**
- `packages/db/src/migrations/0139_serious_vampiro.sql:95` (`ck_promo_code_verticals … <@ ARRAY['accommodation', 'gastronomy', …]`) y `:167` (`ck_addon_product_compatible_verticals … <@ ARRAY['accommodation', 'gastronomy', 'experience', 'tourist', 'partner']::varchar[]`).
- `0176_production_catalog_prices_addons.sql:66` (columnas de `addon_product`, incluida `compatible_verticals`) y `:69,73,74` (`'{gastronomy}'`).
- `rg` sobre `01[4-7]*.sql`: ninguna redefine esos CHECK.
- Spec: `sub-specs/1-renombrado.md:119-123`, `docs/01-decision-log.md:376-381` (DEC-FAC-029 nombra las tres).
- La migración de renombrado viene **después** de la 0176 (staging ya tiene la `0178_dry_starhawk.sql`), así que su `DROP → UPDATE → ADD` de los CHECK llega tarde.

**Por qué importa.** `pnpm db:migrate` sobre una base vacía corta en la 0176 con `violates check
constraint "ck_addon_product_compatible_verticals"`. Eso es: el job de integración/e2e del CI, la
construcción de `hospeda_template`, el reset de staging de la ventana (paso 3) y **prod en el paso 3 del
corte**, donde 0125…0178 corren por primera vez. La ventana de staging queda con la base a medio migrar.

**Propuesta.** Agregar la 0139 a la lista de editadas (sus dos CHECK pasan a `'venue'`), y por coherencia la
`0132` (`fix_request_entity_type_check`, `0132_noisy_marvel_boy.sql:14`), aunque esa no rompe la cadena.
Regla general para el sub-spec 1, en vez de una lista cerrada de números: «se edita toda migración entre
0125 y la de renombrado que fije un literal de vertical del que dependa una fila insertada por una
migración editada». Criterio de aceptación: `db:migrate` desde cero con las migraciones editadas
(ya está) **antes** de cualquier otra prueba, porque éste es el primer error que aparece.

**Decisión del owner: sí.** DEC-FAC-029 fija «0129, 0144 y 0176». Opciones:
1. **Editar también 0139 (y 0132 por coherencia)**: mismo argumento que DEC-FAC-029 (aplicadas sólo en
   staging y local, staging se resetea). Costo: dos archivos más; ningún impacto nuevo. **Recomendada.**
2. Dejar la 0176 con `'{gastronomy}'` y convertir `addon_product.compatible_verticals` en la migración de
   renombrado: G18 se pone rojo (lee `UPDATE` sobre una tabla de carga y falla, `check-catalog-sql.ts:31-35`)
   y hay que enseñarle a aceptar renombres, que es justo lo que DEC-FAC-029 quiso evitar.

### F-V2-A-002 · `amenities`/`features.applicable_verticals` en prod guardan `'gastronomy'` y nadie las convierte

**Qué está mal.** La lista de conversiones de la migración versionada (`email_outbox.payload`,
`ai_settings`, `qr_codes.target_url`, `revalidation_config`) no incluye `amenities.applicable_verticals`
ni `features.applicable_verticals`. Discovery A §4 las nombra, pero §5 las mete en la fila de
`VerticalEnum` con entorno **staging**. Es falso: las columnas existen en prod desde la `0028` y las filas
de gastronomía las escribieron data-migrations que ya corrieron en prod (`0076-hos-1054-allergen-features`,
`0078-hos-1073-gastronomy-cuisine-features`, ambas en `origin/main`), más 42 archivos del baseline
`data/amenity` y `data/feature` con `"applicableVerticals": ["gastronomy"]`.

**Evidencia.**
- `git grep applicable_verticals origin/main -- packages/db/src/migrations` → `0028_deep_machine_man.sql:1-2`.
- `git grep -l gastronomy origin/main -- packages/seed/src/data-migrations` → `0076…`, `0078…` (entre otras).
- `packages/schemas/src/entities/amenity/amenity.schema.ts:14,18`: `APPLICABLE_VERTICALS = ['accommodation', 'gastronomy', 'experience']` y `ApplicableVerticalSchema = z.enum(…)`; lo usan `amenity.schema.ts:51-55` y `feature/feature.schema.ts:39-43`.
- Spec: `sub-specs/1-renombrado.md:128-137` (lista de conversiones), `sub-specs/1-renombrado.md:144-147` («la data-migration del seed para los entornos vivos queda vacía en staging; prod no tiene fichas»), `docs/05-discovery-a-renombrado.md:103`.

**Por qué importa.** Después del corte, el enum Zod dice `'venue'` y las filas de prod dicen
`'gastronomy'`. Una respuesta que valida `applicableVerticals` contra el enum falla con 500 en cada lectura
del catálogo de amenities/features (incluidas las páginas de alojamiento, que no tienen nada que ver); una
que no valida, filtra `?applicableVertical=venue` y devuelve vacío: el editor de un local nuevo en prod
arranca sin comodidades, sin cocinas y sin alérgenos. Staging se resetea y nace bien, así que **ningún
smoke de staging lo ve**: aparece la primera vez en prod.

**Propuesta.** (1) La migración versionada del renombrado hace
`UPDATE amenities SET applicable_verticals = array_replace(applicable_verticals, 'gastronomy', 'venue')`
(ídem `features`), en el carril 1 por el mismo argumento de F-V1-010. (2) Dual-write del baseline (los 42
JSON) con su data-migration, que en prod no hace nada porque el carril 1 ya convirtió. (3) Fila nueva en
discovery A §5 con entorno **ambos** y su `count(*) … = 0`. (4) Revisar con la misma lupa toda columna de
texto/arreglo que exista en `origin/main`: en esta vuelta aparecieron además las de F-V2-A-011.

**Decisión del owner: no.**

---

## ALTA

### F-V2-A-003 · Prod ejecuta la migración de renombrado; la spec lo trata como si llegara por el baseline

**Qué está mal.** El sub-spec 1 dice que «el baseline del corte trae todo ya renombrado» y que «en prod la
tabla `domain_event` no existe todavía». Pero el corte V6 no instala el baseline en prod: en el **paso 3**
corre `hops db-migrate --pull` sobre prod (0124), que aplica 0125…0178 **y** la migración de renombrado, y
recién en el **paso 6** reescribe los ledgers con una foto de esa base. Así que en prod la migración de
renombrado corre sobre una base vieja de verdad: con `gastronomies` (vaciada por la DELETE de la 0148),
`qr_codes`, `r_user_role`/`role_permission` con `GASTRONOMY_OWNER`, `amenities`/`features`, `ai_*`,
`revalidation_config`, `users.settings`, `cutover_v6_deleted_listing` (creada por la 0148) y con
**todos los extras de la era 0124 aplicados**. Cuando la migración de renombrado corre en prod, `domain_event`
sí existe (la crea una de 0125…0177).

**Evidencia.**
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:152` (paso 3: migrar con
  `hops db-migrate --pull`), `:161` (paso 6: reemplazar la historia por una foto de la base ya cortada).
- `0126_cool_captain_flint.sql:10`: «on a clean database the whole chain runs in one transaction».
- `0148_cut_paso_3.sql:41-48` (crea `cutover_v6_deleted_listing`), `:164` (DELETE de gastronomies).
- Spec: `sub-specs/1-renombrado.md:141-142`, `:147`, y el único ensayo sobre prod: `:189-190` (sólo
  data-migrations después del renombrado).

**Por qué importa.** El reset de staging (DEC-FAC-029) borra el único otro ambiente con historia vieja. El
primer lugar donde la migración de renombrado corre sobre datos y extras de la era 0124 es prod, adentro de
la ventana irreversible del corte. Cualquier diferencia (un índice con nombre viejo, un trigger, un valor
de texto no listado, F-V2-A-002, F-V2-A-004) aparece ahí.

**Propuesta.** Reescribir el criterio de aceptación del sub-spec 1 como un **ensayo del paso 3 sobre un
clon de prod-main**: (a) `db:migrate` de la cadena entera con 0129/0139/0144/0176 editadas y la migración
de renombrado, con la `CUT-LIST` real de la 0148; (b) `db:apply-extras`; (c) `db:seed:migrate`; (d) los
`count(*) = 0` de discovery A §5 sobre **ese** clon; (e) el `compare` del paso 6 (F-V2-A-004). Anotarlo
como insumo del «Momento 3 · antes del ensayo del corte» de HOS-1352 (`16-fase-7…:1097`) y corregir las
dos frases del sub-spec 1 (`domain_event` sí existe; no se puede actualizar porque es append-only **una vez
aplicados los extras**, que en prod corren después de migrar: en prod el `UPDATE` sí pasaría).

**Decisión del owner: no.**

### F-V2-A-004 · Los objetos con nombre viejo que crearon los extras hacen fallar el paso 6 del corte

**Qué está mal.** El paso 6 (`rewrite-ledgers`) compara el esquema **entero** de la base cortada con una base
construida desde el baseline más los extras, incluidos `pg_constraint` y `pg_trigger`. En prod, la `extras/002`
ya creó `trg_set_updated_at_gastronomies` y uno por cada `gastronomy_*` con `updated_at`. `RENAME TO` de la
tabla conserva el nombre del trigger; al reaplicar los extras, la `002` busca `trg_set_updated_at_venues`, no
lo encuentra y crea **otro**. Prod queda con dos triggers por tabla; la base construida desde el baseline,
con uno. El criterio de aceptación del sub-spec 1 sólo mira `pg_indexes`/`pg_constraint`.

**Evidencia.**
- `packages/db/src/migrations/extras/002-set-updated-at.trigger.sql` (nombre `'trg_set_updated_at_' || tbl.table_name`, guarda `IF NOT EXISTS` por nombre).
- `scripts/cutover-v6/step-6/schema-fingerprint.ts:28,32,64` (columnas, constraints, triggers) y `scripts/cutover-v6/README.md:42-43` (`rewrite-ledgers --target-url <cut-database> --built-url …` compara el esquema completo).
- Spec: `sub-specs/1-renombrado.md:185-186`.

**Por qué importa.** En el mejor caso el paso 6 se niega a reescribir los ledgers y el corte queda trabado
**después** del punto de no retorno, con prod ya migrada. En el peor, alguien «arregla» la comparación a mano
en la ventana. Staging reseteado nunca lo muestra.

**Propuesta.** La migración de renombrado renombra también los triggers de esas tablas
(`ALTER TRIGGER trg_set_updated_at_gastronomies ON venues RENAME TO trg_set_updated_at_venues`, dentro de un
`DO` que verifica existencia, porque en una base desde cero no existen, ver F-V2-A-006). Criterio: «ni
`pg_indexes`, ni `pg_constraint`, ni `pg_trigger`, ni `pg_type` devuelven `gastronom`» y **`step-6.ts compare`
en verde** entre el clon de prod-main migrado (F-V2-A-003) y una base desde cero.

**Decisión del owner: no.**

### F-V2-A-005 · «`ADD VALUE` en una migración separada» no evita el error: todo corre en una transacción

**Qué está mal.** El sub-spec 4 resuelve F-V1-022 poniendo el `ALTER TYPE … ADD VALUE 'BOLICHE'/'PUB'` en una
migración separada de cualquier uso. Pero `drizzle-kit migrate` aplica **todas** las pendientes en una sola
transacción; el repo ya lo documenta. Donde las dos migraciones están pendientes juntas (base desde cero en
CI y plantilla, reset de staging, prod en el corte si el sub-spec 4 llega antes), el valor recién agregado
se usa en la misma transacción y Postgres responde `unsafe use of new value "BOLICHE" of enum type`.

**Evidencia.** `0126_cool_captain_flint.sql:10`; `packages/db/package.json:40` (`drizzle-kit migrate`).
Spec: `sub-specs/4-tipos-y-noche.md:16-18`.

**Por qué importa.** El problema que la vuelta 1 quiso cerrar sigue abierto, y aparece justo en las bases
que se reconstruyen desde cero (CI), no en la de desarrollo del implementador, donde la migración del
`ADD VALUE` ya quedó aplicada antes.

**Propuesta.** Regla en el sub-spec 4: **ninguna migración versionada usa `BOLICHE` ni `PUB` como literal
del enum**; si una necesita compararlos, compara `type::text`. Los usos reales (fixtures) viven en el seed,
que corre en otro proceso. Criterio: `db:migrate` desde cero con las dos migraciones pendientes juntas.

**Decisión del owner: no.**

---

## MEDIA

### F-V2-A-006 · La migración de renombrado tiene que ser condicional sobre los objetos de los extras

**Qué está mal.** El sub-spec 1 pide renombrar «cada índice, FK, constraint y secuencia» y que `extras/032`
se reescriba «con los nombres que la migración ya renombró». Pero los objetos de los extras
(`uq_gastronomy_media_single_featured`, `chk_gastronomy_media_featured_not_archived`, los triggers de
F-V2-A-004) **no existen** cuando `db:migrate` corre sobre una base desde cero (los extras van después) y
**sí existen** en prod. Un `ALTER INDEX … RENAME` incondicional falla en una de las dos.

**Evidencia.** `extras/032-gastronomy-experience-media.constraints.sql:41-80`; orden de carriles en
`CLAUDE.md` (`db:migrate` → `db:apply-extras`). Spec: `sub-specs/1-renombrado.md:110-111,124-127`.

**Por qué importa.** O rompe CI (desde cero) o rompe el corte (prod). El ensayo «desde cero y sobre seed con
extras» lo detecta, pero la spec no le dice al implementador cómo escribirlo.

**Propuesta.** Escribir en la mecánica: objetos de Drizzle, `RENAME` directo; objetos de los extras,
`ALTER INDEX IF EXISTS … RENAME` y `DO $$ … IF EXISTS (pg_constraint/pg_trigger) …` para constraints y
triggers. Y fijar cómo se obtiene el snapshot del renombrado sin TTY: generar una vez con TTY, quedarse con
el snapshot y reemplazar el SQL por el escrito a mano; la guarda de drift (`check-schema-drift.sh`, que
exige la línea «No schema changes») es la prueba.

**Decisión del owner: no.**

### F-V2-A-007 · `business_lines NOT NULL` sin default rompe ~38 escritores directos

**Qué está mal.** DEC-FAC-026 crea `business_lines text[] NOT NULL` en las tres tablas sin default de base;
el «default» de un rubro único lo pone **el servidor**. Pero hay escritores que no pasan por el servicio: 29
archivos con `insert(accommodations|gastronomies|experiences)` y 9 con `INSERT INTO` crudo en `apps`,
`packages` y `scripts` (tests de integración, fábricas, el seed, herramientas del corte). G-FAC-09 promete
«todo camino de escritura llama a `validateBusinessLines`», que esos caminos no cumplen ni van a cumplir.
Además, el `ADD COLUMN … NOT NULL` que emite Drizzle falla sobre una tabla con filas: la secuencia (agregar
con default o nullable → backfill → `SET NOT NULL` → `ADD CHECK`) no está escrita.

**Evidencia.** `rg -l "insert\((accommodations|gastronomies|experiences)\)" apps packages scripts` → 29;
`rg -l 'INSERT INTO "?(accommodations|gastronomies|experiences)\b' -g '*.ts'` → 9. Spec:
`sub-specs/2-catalogos.md:124-142`, `docs/06-guards.md:184-191`.

**Por qué importa.** El PR del sub-spec 2 rompe decenas de suites que nada tienen que ver con rubros, y la
tentación es «arreglarlas» agregando `businessLines: ['standard']` a mano en 38 archivos (justo lo que G-FAC-03
prohíbe) o abriendo excepciones en G-FAC-09.

**Propuesta.** `DEFAULT ARRAY['standard']` **generado desde el catálogo** para las verticales de un solo rubro
(alojamiento, experiencia); `venues` sin default (el rubro de un local nunca se adivina; sus pocos
escritores directos se ajustan). G-FAC-01 verifica también el default. G-FAC-09 se reformula: «ninguna
**validación** de rubros fuera del validador», no «todo camino lo llama». Escribir la secuencia del
`ADD COLUMN` en el sub-spec 2.

**Decisión del owner: no.**

### F-V2-A-008 · La ventana de staging no apaga la API vieja ni sus crons durante el reset

**Qué está mal.** El orden fijo baja web y admin, resetea y migra, y **después** despliega la API. Entre el
reset y el deploy, la API vieja sigue sirviendo y corriendo crons contra una base reseteada que ya no tiene
`gastronomies` (500s) y donde puede escribir valores viejos (`'gastronomy'` en `quota_window`,
`domain_event`, `email_outbox`) que el código nuevo después no lee. Tampoco se pide la igualdad de commit
entre lo que migra y la imagen.

**Evidencia.** `sub-specs/1-renombrado.md:47-52`; `16-fase-7…:152` (el corte sí apaga contenedor, webhook y
crons, y exige igualdad de commit).

**Propuesta.** Paso 2 bis: apagar la API (o al menos `HOSPEDA_CRON_ADAPTER` y el webhook) antes del reset; migrar
con `--pull` sobre el commit de la imagen nueva y verificarlo, como el paso 3 del corte.

**Decisión del owner: no.**

### F-V2-A-009 · La «migración inversa ensayada» no puede deshacer el catálogo nacido `venue`

**Qué está mal.** DEC-FAC-030 pide una migración inversa ensayada. Con el catálogo corregido en su origen
(DEC-FAC-029) no hay nada que invertir con una migración: volver a `gastronomy` exige `UPDATE` sobre filas
versionadas que `extras/041` prohíbe, FK compuestas sin `ON UPDATE`, y G18 (que falla ante cualquier
`UPDATE` de una tabla de carga). Además Drizzle sólo va hacia adelante: una «inversa» es una migración nueva
que queda para siempre en la historia (y en el baseline de prod si se mergea).

**Evidencia.** `extras/041-plan-catalog-immutability.trigger.sql:127-182`; `scripts/check-catalog-sql.ts:31-35`.
Spec: `sub-specs/1-renombrado.md:55-56,191`; `docs/01-decision-log.md:393-396`.

**Por qué importa.** El criterio de aceptación pide algo imposible tal como está escrito, o algo que, si se
construye, ensucia la historia que DEC-FAC-029 quiso dejar limpia.

**Propuesta.** Definir la marcha atrás como: staging → revert del PR físico y **otro reset** (la misma
ventana al revés); prod → la marcha atrás del corte (restaurar el backup completo que el paso 6 ya exige).
La «lista de lo que no vuelve» se conserva.

**Decisión del owner: sí** (cambia el «qué» de DEC-FAC-030). Opciones:
1. **Marcha atrás = revert + reset en staging; backup del corte en prod.** Sin código nuevo. **Recomendada.**
2. Inversa sólo de lo que no es catálogo (tablas, enums, URLs), ensayada pero **nunca mergeada**; el catálogo
   vuelve sólo por reset. Más trabajo para un camino que igual termina en reset.

### F-V2-A-011 · Tablas de IA y de auditoría con la vertical en texto, fuera del inventario

**Qué está mal.** Discovery A §5 lista `ai_settings` y `ai_usage.feature`. Quedan afuera otras columnas de
texto que existen en prod desde la `0005`/`0026`: `ai_prompt_versions.feature` (configuración curada: los
prompts por feature), `ai_conversations.feature`, `ai_request_log.feature` y `social_audit_log.entity_type`.

**Evidencia.** `packages/db/src/schemas/ai/ai_prompt_versions.dbschema.ts:33`,
`ai/ai_conversations.dbschema.ts:49`, `ai/ai_request_log.dbschema.ts:45`,
`social/social_audit_log.dbschema.ts:28`; `git grep` en `origin/main` → `0005_breezy_beast.sql`,
`0026_thin_pete_wisdom.sql`. Código que arma la feature: `apps/api/src/services/ai-context/index.ts:72`.

**Por qué importa.** Si prod tiene un prompt versionado para `chat_gastronomy`, el chat de un local nuevo
pierde su prompt después del corte (cae al default o falla según el lector), en silencio.

**Propuesta.** Sumar las cuatro a §5: `ai_prompt_versions` MV en el carril 1; `ai_conversations` y
`ai_request_log` MV o NM explícito (historia); `social_audit_log` NM explícito. Cada MV con su `count = 0`.

**Decisión del owner: no.**

### F-V2-A-012 · La regla «rubros permitidos por tipo» es estática y no está en el CHECK: carrera entre dos PATCH

**Qué está mal.** DEC-FAC-026 dice que una regla estática puede ir al CHECK, y deja `allowed` por tipo sólo en
el validador. Pero `typeRules` **es** estática. Dos pedidos concurrentes, cada uno válido contra la fila que
leyó (A: tipo BAR → HELADERIA con rubros `{food}`; B: agrega `nightlife` con tipo BAR), terminan en
HELADERIA + `{food, nightlife}`: justo lo que DEC-FAC-034 dice impedir («que una heladería aparezca en la
página de boliches»). El sub-spec 2 además dice que el validador sólo corre si el pedido toca tipo o rubros,
así que nadie lo corrige después.

**Evidencia.** `docs/01-decision-log.md:330-341`, `sub-specs/2-catalogos.md:126-129,143-145`.

**Propuesta.** Generar desde el catálogo también `CASE type::text WHEN … THEN business_lines <@ ARRAY[…] …
END` dentro del CHECK de `venues` (alojamiento y experiencia no lo necesitan). La «evolución del catálogo» ya
obliga a migrar las fichas afectadas en el mismo PR, así que no cambia el costo; G-FAC-01 lo cubre. Si se
prefiere no tocar el CHECK: validar dentro de la misma transacción con `SELECT … FOR UPDATE` de la fila.

**Decisión del owner: no** (DEC-FAC-026 fue delegada y la propia decisión prevé el caso).

### F-V2-A-014 · Nada garantiza que el purge de `PURGED` limpie las columnas nuevas de `nightInfo`

**Qué está mal.** El purge limpia el contenido de la ficha con un `SET` escrito a mano por vertical
(`listing-purge.model.ts:84-99`); G-R9 cuenta **tablas**, no columnas. El sub-spec 4 dice «el inventario de
columnas que PB9/PB12 limpian los incluye en el mismo PR», pero no hay inventario ni guard: es una línea que
alguien tiene que acordarse de escribir.

**Evidencia.** `packages/db/src/models/listing/listing-purge.model.ts:88-92` (el `SET` de gastronomía);
`docs/06-guards.md:193-197`; `sub-specs/4-tipos-y-noche.md:59-63`.

**Por qué importa.** Si se olvida, una ficha `PURGED` conserva precio de entrada, edad mínima y notas: contenido
del dueño que el sistema promete borrar, sin que ningún test se ponga rojo.

**Propuesta.** Test (o guard) que lee las columnas de `venues`/`accommodations`/`experiences` desde el
`dbschema` y exige que cada una esté en el `SET` del purge **o** en una lista cerrada de columnas de
sistema/clasificación (`id`, `owner_id`, `type`, `business_lines`, `publication_status`, …), con conteo
exacto. Una columna nueva sin clasificar es roja.

**Decisión del owner: no.**

### F-V2-A-017 · G-FAC-R1 «exactamente cinco exenciones» no puede quedar verde

**Qué está mal.** Hay archivos que **tienen** que contener la palabra vieja y no entran en ninguna de las cinco:
(1) la propia migración de renombrado (`ALTER TABLE "gastronomies" RENAME TO …`) y su snapshot; (2) la limpieza
de nombres viejos en `extras/032`/`002` si se hace ahí; (3) las data-migrations del seed: 32 archivos mencionan
`gastronom` (prosa, valores, ids) y el sub-spec 1 dice editarlas «sólo en imports y literales de
identificador», que deja vivas las demás menciones; G8 las excluía como historia, G-FAC-R1 no. Un caso
concreto con efecto: `0109-hos1418-whats-new-seen-ids-rename.ts:52` mapea al id
`…-gastronomy-experience-publish-free-trial`, y corre **por primera vez en prod** en el corte: si el sub-spec 1
renombra ese id de What's New, la 0109 escribe en prod un id que ya no existe.

**Evidencia.** `docs/06-guards.md:49-60`; `sub-specs/1-renombrado.md:151-155`;
`docs/05-discovery-a-renombrado.md:172-174` (G8 exentaba data-migrations).

**Propuesta.** Agregar a «Fuera del escaneo» (historia, no exención): migraciones versionadas **nuevas** del
renombrado y su `meta/`, y los módulos de data-migration (que el paso 6 borra). Dentro de las data-migrations
pendientes en prod (`0109`, `0110`, `0125`), editar también los **valores** que escriben, no sólo los
identificadores: la 0109 mapea directo al id final `venue`.

**Decisión del owner: no** (no agrega una exención de código; es historia, como las migraciones sin editar).

---

## BAJA

### F-V2-A-010 · Bases no reseteadas: la migración de renombrado falla con un error críptico

`hospeda_dev` local, las bases de los worktrees vivos y cualquier plantilla construida desde `hospeda_dev`
(`wt-db.sh build-template`) tienen la 0129 vieja aplicada; la migración de renombrado llega a su `ADD
CONSTRAINT ck_vertical_id` con una fila `'gastronomy'` o choca con la FK de `plan`. La plantilla tiene huella
por contenido (`scripts/worktree/template.sh`, `wt_template_fingerprint`), pero las bases ya clonadas no.
**Propuesta**: primera sentencia de la migración, `DO $$ IF EXISTS (SELECT 1 FROM vertical WHERE id =
'gastronomy') THEN RAISE EXCEPTION 'HOS-1787: esta base necesita reset (DEC-FAC-029)'`; y en la ventana,
resetear `hospeda_dev` **antes** de reconstruir la plantilla. Owner: no.

### F-V2-A-013 · El test «`CASE` del backfill = `typeRules`» se pone rojo cuando el sub-spec 4 agrega tipos

La migración del sub-spec 2 queda congelada con el `CASE` de los tipos de ese día; el sub-spec 4 suma `BOLICHE`
y `PUB` a `typeRules`. Un test que compara los dos queda rojo para siempre o invita a editar una migración
aplicada. Además el `CASE` necesita `ELSE` (sin él, un tipo no listado da `NULL` y viola el `NOT NULL`).
**Propuesta**: el test compara sólo contra los valores del enum que existían en esa migración (lista fija en
el test) y exige `ELSE`. `sub-specs/2-catalogos.md:138-142,175`. Owner: no.

### F-V2-A-015 · Forma de `nightInfo` incompleta en base

`entry_note` y `dress_code_note` son «traducibles», pero el patrón de la vertical son columnas `*_i18n`
(ver `listing-purge.model.ts:88-89`): faltan en la tabla del sub-spec 4 y en el purge. Faltan CHECK baratos y
estáticos: `entry_price_from` `>= 0` y sólo con `entry_kind = 'paid'`, `min_age` en un rango. «La fecha la fija
el servidor al guardar el precio» tiene que decir «cuando el valor **cambia»**: si no, un PATCH que reenvía
el precio sin tocarlo dice «actualizado este mes» sobre un precio viejo. Y qué pasa con el precio al pasar de
`paid` a `free` (se borra o se conserva oculto). `sub-specs/4-tipos-y-noche.md:33-44`. Owner: no.

### F-V2-A-016 · `{food, food}` pasa el CHECK y el validador no lo prohíbe

`cardinality >= 1 AND <@` acepta duplicados, y la lista de reglas de `validateBusinessLines` no incluye
unicidad. Con «el primer elemento es el rubro principal» como punto de extensión, un duplicado se vuelve
ambiguo. **Propuesta**: regla «sin repetidos» en el validador y normalizar (orden estable) antes de escribir.
`sub-specs/2-catalogos.md:75-78,127`. Owner: no.

### F-V2-A-018 · La spec cita una «guarda de inmutabilidad de migraciones» que no existe

El sub-spec 1 dice que «la guarda de inmutabilidad de migraciones y G18 se actualizan en el mismo PR». No hay
tal guarda (sólo el mensaje de G18, `check-catalog-sql.ts:436-437`, y `check-schema-drift.sh`, que no mira
contenido de migraciones viejas); G18 no necesita cambios porque compara contra el código. **Propuesta**:
corregir la frase; si se quiere que la edición no siente precedente, crear una guarda chica que falle ante un
`M` sobre `migrations/*.sql` salvo una lista cerrada fechada. `sub-specs/1-renombrado.md:121-123`. Owner: no.

### F-V2-A-019 · `cutover_v6_deleted_listing` y la `CUT-LIST` de la 0148 guardan la vertical vieja

La 0148 crea `cutover_v6_deleted_listing` con `entity_type = 'gastronomy'` para cada ficha borrada y valida
la `CUT-LIST` contra `('accommodation', 'gastronomy', 'experience')` (`0148_cut_paso_3.sql:89,135`). La tabla
vive en prod hasta el paso 5b, o sea durante la migración de renombrado. Con cero fichas de gastronomía no
tiene filas, pero conviene que el ensayo de F-V2-A-003 lo **mida** (`count(*) WHERE entity_type =
'gastronomy' = 0`) en vez de suponerlo. Owner: no.

### F-V2-A-020 · El orden entre `RENAME VALUE` y el `UPDATE` de `qr_codes.target_url` decide si se migra algo

El `UPDATE` de `target_url` filtra por `entity_type = GASTRONOMY`; si corre después del `RENAME VALUE`, ese
literal ya no existe y actualiza cero filas en silencio (o falla al castear). **Propuesta**: fijar el orden
(primero los `UPDATE` de datos, después los `RENAME VALUE`) o filtrar por el valor nuevo; el `count = 0`
sobre `target_url LIKE '%/gastronomia/%'` lo prueba. `sub-specs/1-renombrado.md:159-163`. Owner: no.

### F-V2-A-021 · Restos de vocabulario y contradicciones internas

- `06-guards.md:131,134` (G-FAC-03 b: «leen la relación o la columna», «una consulta nueva a la relación») y
  `:168` (G-FAC-07: «la columna o la tabla de rubros»): con DEC-FAC-026 no hay relación ni tabla.
- `sub-specs/2-catalogos.md:157-160` pide «baseline + data-migration» para los rubros de las fichas de ejemplo,
  y `:138-142` pone el backfill en la migración versionada y dice que «la data-migration se estampa sin
  correr»: no queda claro qué data-migration hay ni qué hace.
- DEC-FAC-014 (`01-decision-log.md:34,197`) sigue diciendo «301 desde `/gastronomia/`» sin marca de
  SUPERSEDED por DEC-FAC-030 (302 durante el soak); `06-guards.md:80` y `sub-specs/1-renombrado.md:165` hablan
  del «301 de `/carta/`».
- DEC-FAC-016 (`01-decision-log.md:221`) lista `entity_subscriptions.entity_type` como valor a renombrar.
- `spec.md:66` y `sub-specs/1-renombrado.md:27` dicen «staging va por la 0177»: ya está la `0178_dry_starhawk.sql`
  (la de renombrado será la `0179` o posterior).

Owner: no.

### F-V2-A-022 · La cache de sesión puede traer `GASTRONOMY_OWNER` unos minutos después del corte

Better Auth tiene `session.cookieCache` encendido (`apps/api/src/lib/auth.ts:251`, `COOKIE_CACHE_MAX_AGE = 5 *
60` según `auth-deleted-user-guard.ts:24`) y `session.user.role` viaja en ella (`auth.ts:500`). En prod las
sesiones sobreviven al corte: hasta 5 minutos después del `RENAME VALUE`, una cookie puede decir
`GASTRONOMY_OWNER`. **No verificado**: si algún lector parsea ese rol contra `RoleEnum` (rechazo o 500) o lo
usa sólo como texto. **Propuesta**: verificarlo en la tarea; si parsea, la ventana del corte ya es larga
(crons apagados), alcanza con documentarlo o rotar el secreto de la cache. Owner: no.

---

## Lo que esta lente revisó y no encontró roto

- **UUIDv5 del catálogo**: los ids de plan/versión/addon sólo aparecen en 0144 y 0176 (fuera de `meta/`);
  ningún otro archivo los cita, así que regenerarlos con `pnpm gen:catalog-sql` y editar las dos
  migraciones alcanza. G18 compara el acumulado contra el código y queda verde sin cambios
  (`check-catalog-sql.ts:14-27`); después del corte pasa solo a «baseline mode» (`:412-420`).
- **`RENAME VALUE`** en `role_enum`, `permission_enum`, `permission_category_enum`, `entity_type_enum`: es
  seguro dentro de la transacción (la restricción de uso es sólo de `ADD VALUE`), y el índice parcial de
  `extras/040` no nombra la vertical (`040-…index.sql`, sólo en un comentario).
- **`entity_subscriptions`** y las tablas `billing_*` de qzpay: las borra la 0125 antes de que corra el
  renombrado en prod (`0125_robust_cassandra_nova.sql:57-94`); correcto no tocarlas.
- **Drizzle**: `text().array()`, `check()` con SQL generado y `index().using('gin', …)` son el mismo patrón que
  `ck_addon_product_compatible_verticals` (`0139:167`); la guarda de drift cubre el texto del CHECK.

## Key Learnings:

1. En este repo `drizzle-kit migrate` aplica todas las migraciones pendientes en **una sola transacción**
   (documentado en `0126_cool_captain_flint.sql:10`): «separar `ADD VALUE` en otra migración» no evita el
   error en bases desde cero ni en el corte.
2. El corte V6 de HOS-1352 **ejecuta** las migraciones pendientes sobre prod en el paso 3 y recién en el paso
   6 reemplaza la historia por un baseline; `rewrite-ledgers` compara el esquema completo (incluidos
   triggers) contra una base construida desde el baseline + extras. Todo lo que un renombrado deje con
   nombre viejo en prod traba el paso 6.
3. Los CHECK de verticales están escritos como literales en varias migraciones (0129, 0132, 0139); editar
   una migración que inserta un valor nuevo obliga a editar también la que fijó el CHECK que lo valida.
4. `amenities`/`features.applicable_verticals` existen en prod desde la `0028` y tienen filas `'gastronomy'`
   escritas por data-migrations de prod (0076, 0078); el enum Zod `APPLICABLE_VERTICALS` es estricto.
5. Resetear staging elimina el único ambiente, además de prod, con historia vieja y extras aplicados: los
   hallazgos de «valor viejo en prod» sólo se ven ensayando sobre un clon de prod-main.
6. `extras/002` nombra sus triggers por tabla (`trg_set_updated_at_<tabla>`) y crea uno nuevo si no encuentra
   el nombre: un `RENAME TO` de tabla deja dos triggers después de reaplicar los extras.
7. El purge de `PURGED` limpia columnas con un `SET` a mano por vertical (`listing-purge.model.ts`); ninguna
   guarda verifica que una columna nueva de contenido esté en ese `SET`.
