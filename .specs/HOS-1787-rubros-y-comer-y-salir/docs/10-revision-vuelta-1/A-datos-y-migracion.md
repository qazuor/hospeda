---
title: Revisión vuelta 1 · Revisor A · Datos y migración del renombrado
linear: HOS-1787
created: 2026-10-25
---

# Revisión vuelta 1 · A · Datos y migración

Lente: valores persistidos, migraciones, guards de base y continuidad externa del renombrado
`gastronomy` → `venue` (sub-specs 1 y 2, discovery A, guards G-FAC-R1/R2/01). Verificado contra el
checkout `hospeda-spec-hos-1787-docs` (`origin/staging` @ `2ebee74d0a`) y, para producción, contra
`origin/main` @ `c52c57b587` (lo que hoy corre en prod). No se consultó ninguna base.

## Resumen

| severidad | cantidad |
|---|---|
| CRÍTICA | 3 |
| ALTA | 8 |
| MEDIA | 7 |
| BAJA | 4 |
| **total** | **22** |

Lo más importante en tres líneas:

1. **Producción no tiene el mundo de HOS-1352.** `origin/main` termina en la migración `0124`; `staging`
   va por la `0177` (3.391 commits adelante). En prod no existen `vertical`, `catalog_key`, `plan*`,
   `subscription`, `trial`, `domain_event` ni `email_outbox`. El corte V6 además **aplasta la historia**
   en `0000_baseline.sql` y **borra los módulos de data-migration**. Cuándo cae el renombrado respecto
   del corte cambia casi todo el diseño de la migración (F-V1-A-003).
2. **El catálogo no se puede renombrar con las herramientas que la spec nombra.** GUARD:G18 sólo
   pliega `INSERT`, los triggers de `extras/041` prohíben `UPDATE`/`DELETE` de lo versionado, y los ids
   UUIDv5 **sí** derivan del nombre de la vertical y de las claves (verificado, ya no «posiblemente»).
3. **Varios datos vivos que el código nuevo va a rechazar** (payloads del outbox, el blob de
   `ai_settings`, `qr_codes.target_url`, `domain_event`) no están en el inventario de la spec, y el
   inventario incluye una tabla que ya no existe.

---

### F-V1-A-001 · El renombrado del catálogo choca con GUARD:G18 y con los triggers de inmutabilidad · CRÍTICA

**Dónde**: `sub-specs/1-renombrado.md` §Mecánica paso 2 («Riesgo a revisar: GUARD:G18 no admite
`UPDATE`…») y mapa de nombres (filas de claves de entitlement/limit y `VerticalEnum`).

**Evidencia**:
- G18 pliega **sólo** `INSERT … VALUES` acumulados y falla con cualquier otra sentencia sobre esas
  tablas: `scripts/check-catalog-sql.ts:32-35` (doc) y `:224-226`, `:241-250` (el regex `touches`
  incluye `UPDATE|DELETE FROM|TRUNCATE`; todo lo que no sea INSERT plano es violación). Además compara
  en ambos sentidos: una fila insertada por `0129`/`0144`/`0176` que ya no está en el código es rojo
  (`:338-345`, «is inserted by … but is no longer in the code catalog»). O sea: insertar las filas
  `venue` nuevas deja rojas las `gastronomy` viejas, y borrarlas es rojo por `DELETE`.
- Triggers de `packages/db/src/migrations/extras/041-plan-catalog-immutability.trigger.sql`:
  `plan_version` rechaza `DELETE` y todo `UPDATE` de `vertical` (`:102-125`, triggers `:127-129`);
  `plan_version_entitlement`, `plan_version_limit`, `addon_version*` rechazan `UPDATE` y `DELETE`
  (`:132-155`) e incluso un `INSERT` bajo una versión de otra transacción.
- Las FK hacia `vertical.id` y `catalog_key.key` no tienen `ON UPDATE` (sin `onUpdate` en
  `packages/db/src/schemas/vertical/*.ts`), y hay una cadena de FK **compuestas** que llevan la
  vertical: `subscription (plan_version_id, vertical) → plan_version(id, vertical)`
  (`subscription.dbschema.ts:158-159`), `plan_version(plan_id, vertical) → plan(id, vertical)`
  (`plan-catalog.dbschema.ts:121-125`), `trial` ×4 (`trial.dbschema.ts:100-116`),
  `permanent_grant` (`permanent-grant.dbschema.ts:90-91`), `plan_migration`
  (`plan-migration.dbschema.ts:71-72`); `quota_window` referencia `(vertical, key)`
  (`quota-window.dbschema.ts:15-20`).

**Problema**: la spec trata esto como «riesgo a revisar» cuando es un bloqueante de diseño. No hay un
camino que deje G18 verde, respete los triggers y renombre `vertical.id = 'gastronomy'` y las 8
claves. Y hay una trampa extra: **los triggers sólo existen donde ya corrió `db:apply-extras`**. En una
base desde cero (CI, worktrees, tests de integración) `db:migrate` corre toda la historia antes de los
extras, así que la migración de renombrado **pasa** en CI y **falla en staging** (el único entorno con
los triggers puestos y filas ancladas).

**Escenario de falla**: el PR del renombrado pasa CI (base desde cero, sin triggers). Al aplicarlo en
staging, `UPDATE plan_version SET vertical='venue'` lanza `P0001 plan_version is immutable except
current`; la migración aborta a mitad del lote y staging queda sin desplegar. Si en cambio se escribe
como INSERT de filas nuevas, G18 queda rojo por las filas `gastronomy` huérfanas y el PR no mergea.

**Propuesta** — `REQUIERE DECISIÓN DEL OWNER`:
1. **Enseñarle a G18 un plegado de renombre** (sentencia reconocida tipo
   `UPDATE "vertical" SET "id" = 'venue' WHERE "id" = 'gastronomy'` → mueve la clave en el conjunto
   acumulado), con su test positivo y mutación; y que la migración desactive y reactive
   explícitamente los triggers de 041 dentro de la transacción (con `DO` condicional, porque en base
   desde cero todavía no existen). Pro: forward-only, respeta «nunca editar una migración aplicada».
   Contra: abre una puerta en G18 y en la inmutabilidad (DEC-ARCH-001) que hoy está cerrada a
   propósito; hay que acotarla a renombres de identidad.
2. **Si el renombrado cae ANTES del corte** (ver F-V1-A-003): `0129/0144/0176` sólo están aplicadas en
   staging y en bases locales, nunca en prod. Editarlas en su lugar + resetear la base de staging deja
   G18 verde sin `UPDATE`. Pro: cero deuda en el catálogo. Contra: viola la regla del repo de no editar
   migraciones aplicadas y obliga a rehacer staging, plantillas `hospeda_template` y bases de worktree.
3. **Que el catálogo conserve `gastronomy` como valor persistido** y sólo se renombre lo visible.
   Contra: contradice DEC-FAC-016 («renombrado TOTAL»).
Recomiendo decidir primero F-V1-A-003; con «antes del corte», la opción 2 es la más barata y la única
sin puertas nuevas.

Toca: OD-04, OD-06.

---

### F-V1-A-002 · Los ids UUIDv5 del catálogo SÍ derivan de la vertical y de las claves · CRÍTICA

**Dónde**: discovery A §5 («ids UUIDv5 posiblemente derivados del slug: sin verificar»); OD-04;
sub-spec 1 mapa de nombres (slugs de plan y addon «PENDIENTE»).

**Evidencia**:
- `scripts/production-catalog/catalog.ts:1904-1912`: `catalogId(key)` = UUIDv5 (namespace fijo) sobre
  una clave natural.
- `scripts/production-catalog/loads.ts:22` plan = `catalogId('plan:${vertical}:${slug}')`;
  `:46-50` versión = `…:version:1`; `:67-70` entitlement = `…:version:1:entitlement:${key}`;
  `:82-85` limit = `…:limit:${key}`.
- `scripts/production-catalog/commercial-loads.ts:10-15,89,122,133,147,160,181`: `billing_option`
  = `plan:<vertical>:<slug>:version:1:billing_option:<cycle>`; addon = `addon:${slug}` y derivados.
- Los planes de rol de la vertical (`trial`, `pre-trial`, `floor`, `catalog.ts:1512-1570`) no tienen la
  palabra en el slug pero su id es `plan:gastronomy:trial`, etc.

**Problema**: renombrar la vertical **cambia el id de los 6 planes de la vertical, sus versiones, sus
filas de entitlement/limit y sus `billing_option`**, aunque se conserven los slugs. Renombrar una clave
(`publish_gastronomy` → `publish_venue`) cambia el id de cada fila de entitlement que la usa, en todos
los planes. Renombrar el slug de un addon cambia addon, versión, producto y filas. Todo lo que ancla
esos ids (suscripciones, trials, grants permanentes, migraciones de plan, vínculos con el proveedor de
pago) queda apuntando a filas que el generador ya no produce.

**Escenario de falla**: se cambia `vertical: 'gastronomy'` por `'venue'` en `catalog.ts`; el generador
emite ids nuevos; G18 pide insertar 6 planes «nuevos» y declara huérfanos los viejos, que no se pueden
borrar (F-V1-A-001) porque `subscription`/`trial` los anclan. En staging conviven dos catálogos de la
misma vertical y `UNIQUE(vertical, rank) WHERE sellable AND current` choca o, si se apagan los viejos,
cada suscripción existente queda en un plan «no vigente».

**Propuesta** — `REQUIERE DECISIÓN DEL OWNER`:
1. **Congelar la clave natural**: `catalogId` recibe un mapa de alias legado
   (`venue → gastronomy` para la semilla del id, clave `publish_venue → publish_gastronomy`), de modo
   que los ids no cambian y sólo cambian las columnas de texto. Pro: ningún anclaje se rompe. Contra:
   la palabra retirada sobrevive en un archivo (entrada de allowlist de G-FAC-R1) y hay que tocar las
   columnas `vertical`/`key` igual (sigue F-V1-A-001).
2. Aceptar ids nuevos y tratarlo como «publicar catálogo nuevo + retirar el viejo» con migración de
   las suscripciones (acción de migración de plan de HOS-1353). Pro: coherente con el versionado.
   Contra: es una migración de billing completa, con smoke de billing CORE.
3. Combinado con «renombrar antes del corte + editar 0144/0176» (F-V1-A-001 opción 2): los ids
   cambian una sola vez antes de que exista ningún anclaje en prod.
Cerrar OD-04 con el dato: ya no es «posiblemente», es «sí, de la vertical y de cada clave».

Toca: OD-04.

---

### F-V1-A-003 · La spec ignora el corte V6 de HOS-1352: prod corre otro esquema y el corte aplasta la historia · CRÍTICA

**Dónde**: `spec.md` §Contexto («construye sobre lo que HOS-1352 dejó en staging»); DEC-FAC-012;
DEC-FAC-016 («hoy no hay datos reales»); sub-spec 1 §Mecánica; OD-06.

**Evidencia**:
- `git ls-tree origin/main packages/db/src/migrations/` termina en `0124_amusing_hawkeye.sql`;
  staging en `0177_hos1730_declared_payer_email.sql`. `origin/main` no tiene `schemas/vertical/`,
  `schemas/trial/`, `domain_event` ni `email_outbox`; sí tiene `gastronomies` y
  `billing/entity_subscription.dbschema.ts` (con `product_domain = 'gastronomy'`).
- `scripts/cutover-v6/README.md` §«Step 6 order»: `prepare-repo` genera `0000_baseline.sql` desde la
  base cortada y **reescribe los ledgers**; «The seed ledger is emptied because its migration modules
  are removed». G18 ya tiene modo baseline (`scripts/check-catalog-sql.ts:385-420`).
- Premisas del corte (DEC-MIG-007 de HOS-1352): sin convivencia; las preapprovals viejas se cancelan
  en los pasos 1a/1b/2 (`scripts/cutover/README.md`).

**Problema**: la spec diseña una migración «sobre staging», pero el renombrado va a llegar a prod
**junto con** (o después de) el corte, y eso define todo:
- **Antes del corte**: prod pasa de `0124` a `0125…0177 + renombrado` en un solo lote; los datos del
  mundo nuevo (catálogo, trials del paso 3) nacen ya con `venue`; las preapprovals viejas de
  gastronomía se cancelan por el corte igual, así que OD-04 en prod casi desaparece; el paso 6 aplasta
  todo y la historia con `gastronomy` deja de existir en el repo. Lo único a migrar en prod son las
  tablas del mundo viejo (`gastronomies` y familia, enums de rol/permiso/entity_type, `qr_codes`,
  bookmarks, vistas, `ai_settings`, `users.settings`).
- **Después del corte**: hace falta la migración forward completa contra el mundo nuevo en prod, con
  todos los bloqueos de F-V1-A-001/002/005/007.
- **A mitad** (la partición de OD-06 en varios PRs con el corte en el medio): prod queda con un estado
  semi-renombrado aplastado en el baseline, y los PRs siguientes migran desde ahí. Es el peor caso.

**Escenario de falla**: se mergean los PRs 1–3 del renombrado; el owner ejecuta el corte; el paso 6
genera el baseline con `venues` pero con claves `*_gastronomy_*` todavía en `catalog_key`; los PRs 4–5
tienen que renombrar claves en un baseline nuevo, con G18 en modo baseline (que sólo mira `catalog_key`
y `vertical`) y con los módulos de data-migration ya borrados.

**Propuesta** — `REQUIERE DECISIÓN DEL OWNER`:
1. **Renombrado completo antes del corte, como bloqueante del corte** (recomendada): el renombrado
   entra entero a staging antes de ejecutar V6. Pro: la migración en prod es la más chica posible, el
   catálogo se puede corregir en su origen y el baseline sale limpio. Contra: suma un bloqueante al
   corte.
2. **Después del corte**: el corte no se toca, y la spec agrega la migración forward completa contra
   el mundo nuevo. Contra: es la variante con más bloqueos (F-V1-A-001, 002, 005, 007).
3. En cualquiera de los dos casos, **prohibir explícitamente** que el corte caiga entre dos PRs del
   renombrado (regla en OD-06 + coordinación con HOS-1352/V6).

Toca: OD-04, OD-06; coordinación con HOS-1352 (V6).

---

### F-V1-A-004 · Inventario de valores persistidos desactualizado e incompleto · ALTA

**Dónde**: discovery A §4 y §5; sub-spec 1 §Mecánica paso 2.

**Evidencia** (columnas reales en staging, `rg` sobre `packages/db/src/schemas`):
- **Ya no existe**: `entity_subscriptions` se borró en `0125_robust_cassandra_nova.sql:68`
  (`DROP TABLE "entity_subscriptions" CASCADE`). La spec y discovery A lo listan como a migrar. (El
  `CLAUDE.md` raíz también lo describe como vivo.)
- **Faltan** en el inventario:
  - `user_role_audit.role` (`user/user_role_audit.dbschema.ts:30`, `role_enum`): historia de roles con
    `GASTRONOMY_OWNER`;
  - `ai_usage.feature` (`ai/ai_usage.dbschema.ts:52`, varchar): uso histórico con `chat_gastronomy`;
  - `quota_window (vertical, key)` (`vertical/quota-window.dbschema.ts:15-20`): ventanas de cuota
    abiertas, con trigger «una abierta» en `extras/048`;
  - `domain_event.entity_type` = la vertical, append-only (ver F-V1-A-005);
  - `email_outbox.payload` (ver F-V1-A-007);
  - `qr_codes.target_url` con la URL `/gastronomia/…` (ver F-V1-A-006);
  - `plan.name` («Gastronomía Básico», «Gastronomy Trial»…, `catalog.ts:549,1514,1537,1562`), que es
    cosmético pero se muestra.
- `ProductDomainEnum` sigue en TS (`packages/schemas/src/enums/product-domain.enum.ts`) pero en staging
  ya no tiene columna: el «test de conteo congelado» es sólo de código.

**Problema**: una migración escrita desde este inventario hace `UPDATE entity_subscriptions` (que
aborta el lote en staging porque la tabla no existe) y deja sin migrar seis lugares con el valor viejo.

**Escenario de falla**: la migración `0178` incluye `UPDATE "entity_subscriptions" SET "entity_type" =
'venue' …`; en staging falla con `relation "entity_subscriptions" does not exist` y aborta todo el
lote. Corregido eso, un dueño de staging abre su historial de soporte y no ve nada (domain_event), y su
cuota de chat IA del mes se reinicia (quota_window y ai_usage).

**Propuesta**: rehacer el inventario de valores persistidos desde el esquema **actual** (no desde
discovery) con una tabla de tres columnas: dónde, en qué entornos existe (prod-main / staging / ambos)
y cómo se migra (RENAME VALUE / UPDATE en migración versionada / data-migration / lector tolerante /
no se migra). Que sea un artefacto del sub-spec 1 y que el criterio de aceptación incluya una consulta
de verificación por fila (`count(*) … = 0` sobre el valor viejo, excluyendo `deleted_at`).

---

### F-V1-A-005 · `domain_event` es append-only y los lectores filtran por `entity_type = vertical` · ALTA

**Dónde**: discovery A §4 (lista `domain_event.entity_type` como si fuera una columna más); sub-spec 1
§Mecánica paso 2.

**Evidencia**:
- `extras/056-domain-event-append-only.trigger.sql:5,12`: `BEFORE UPDATE OR DELETE ON domain_event` →
  `RAISE EXCEPTION 'domain_event is append-only'`.
- Escritores con la vertical como `entity_type`: `apps/api/src/services/listing-publication/*`,
  `listing-support-edit.service.ts`.
- Lector: `apps/api/src/services/listing-publication/listing-support-edit.service.ts:38-41`
  (`domainEventModel.findByEntity({ entityType: input.vertical, … })`).

**Problema**: la fila no se puede actualizar (el trigger lo prohíbe, y está bien que lo prohíba: es el
registro de auditoría). Si sólo cambia el código, todo lector que filtre por `'venue'` pierde la
historia previa al renombrado. Si la migración actualiza filas, rompe el principio append-only y, en
staging, falla.

**Escenario de falla**: después del deploy, el panel de «ediciones de soporte» de una ficha de comer y
salir aparece vacío, aunque haya ediciones registradas; cualquier lógica futura que derive estado de
eventos (V8, acción 15) ve una ficha sin pasado.

**Propuesta** — `REQUIERE DECISIÓN DEL OWNER`:
1. **Lector tolerante** (recomendada): un único helper `entityTypesForVertical('venue') →
   ['venue','gastronomy']` usado por todo `findByEntity` de fichas; la escritura sólo con `venue`.
   Pro: la auditoría queda intacta. Contra: el valor viejo vive en código para siempre (allowlist de
   G-FAC-R1 + guard de «sólo este helper»).
2. Migración que desactiva el trigger, actualiza y lo reactiva. Contra: reescribe la historia de
   auditoría; precedente peligroso.
3. Si el renombrado cae antes del corte (F-V1-A-003): en prod no hay `domain_event` todavía y en
   staging se puede aceptar la pérdida (datos de prueba). Hay que decirlo explícitamente.

---

### F-V1-A-006 · Los QR impresos apuntan a `/q/<slug>`, no a `/gastronomia/…/carta/`: lo que hay que migrar es `qr_codes.target_url` · ALTA

**Dónde**: sub-spec 1 §Mecánica paso 4 («incluida para siempre la ruta de los QR impresos»); discovery
A §5 («QR impresos `/{lang}/gastronomia/{slug}/carta/` → redirect permanente obligatorio»); G-FAC-R2.

**Evidencia**:
- `packages/db/src/schemas/qr-code/qr_code.dbschema.ts:19-24`: «A printed QR encodes a URL carrying
  `qrCodes.slug`, and the platform answers that URL with a redirect to `qrCodes.targetUrl`».
- `packages/service-core/src/services/gastronomy/gastronomy-qr.ts:42,62`: `target_url` guardado =
  `…/{lang}/gastronomia/{slug}/carta/`; la regex de lectura sólo reconoce esa forma.
- `packages/service-core/src/services/gastronomy/gastronomy.service.ts:730-737`: al cambiar el slug,
  si la regex no reconoce el `target_url` guardado, **no repunta** el QR (sólo loguea un error).
- `qr_codes` existe en prod (`origin/main:packages/db/src/schemas/qr-code/`), con
  `entity_type` = `entity_type_enum` (`GASTRONOMY`).
- También el QR de folleto (`QrCodePurposeEnum.BROCHURE`, `extras/040`) guarda la URL de la ficha.

**Problema**: el 301 desde `/gastronomia/…/carta/` es útil (enlaces, códigos MANUAL), pero no es lo que
protege a los stickers. Lo que los protege es migrar `qr_codes.target_url` de las filas GENERATED (menú
y folleto) a `/comer-y-salir/…`. Si no se migra: (a) cada escaneo hace dos saltos (`/q/` → 302 →
`/gastronomia/` → 301), contra la regla de «un salto»; (b) peor, la regex nueva no reconoce los
`target_url` viejos y el primer cambio de slug deja el sticker apuntando al slug viejo.

**Escenario de falla**: un bar con carta QR impresa cambia su slug después del renombrado. El servicio
no reconoce `…/gastronomia/<viejo>/carta/` y no repunta. El sticker hace `/q/abc` → `/gastronomia/<viejo>/carta/`
→ 301 → `/comer-y-salir/<viejo>/carta/` → **404**. El sticker está impreso y pegado en las mesas.

**Propuesta**: (1) agregar al sub-spec 1 la migración de datos de `qr_codes.target_url` (GENERATED,
`entity_type = GASTRONOMY`, cualquier `purpose`) y del valor de enum; (2) la regex de lectura acepta la
forma vieja y la nueva durante al menos un ciclo (o para siempre, si los MANUAL pueden tener la vieja);
(3) G-FAC-R2 suma un caso: «escaneo de `/q/<slug>` de un código de menú → un solo salto hasta
`/comer-y-salir/…/carta/`»; (4) medir en prod cuántos `qr_codes` de gastronomía hay y cuántos escaneos
tienen (`qr_code_scan`) antes de decidir si el 301 de `/carta/` tiene que ser «para siempre».

Toca: OD-01.

---

### F-V1-A-007 · Datos encolados y blobs que el código nuevo rechaza (outbox, `ai_settings`) · ALTA

**Dónde**: discovery A §5 (fila «payloads con vertical `gastronomy` | `email_outbox`… | correos
encolados» sin tratamiento); fila `chat_gastronomy` → `ai_settings` (data-migration 0101); sub-spec 1
no dice cómo ni cuándo.

**Evidencia**:
- `packages/notifications/src/services/outbox/listing-archived-renderers.tsx:10,24,33` (y
  `listing-retention-renderers.tsx:13`): el renderer **lanza** `TypeError` si `payload.vertical` no
  está en la lista. `email_outbox.send_after` (`email_outbox.dbschema.ts:79`) permite filas programadas
  a días vista (avisos de retención, renovación, trial).
- `packages/schemas/src/entities/ai/ai-settings.schema.ts:142`:
  `z.partialRecord(AiFeatureSchema, …)` en la lectura. `packages/ai-core/src/storage/settings.storage.ts:84-92`
  documenta que en HOS-1220 un cambio del enum de features tumbó **todas** las funciones de IA.
  Con zod 4 (`packages/schemas/package.json:39`), un `partialRecord` sobre un enum valida también las
  claves: una clave `chat_gastronomy` que ya no está en el enum haría fallar el parse del blob entero.
  (Inferido del comportamiento de zod 4; hay que confirmarlo con un test.)
- Orden de carriles en un entorno vivo: `db:migrate` → `db:apply-extras` → `db:seed:migrate`. La
  data-migration corre **después** de que el código nuevo ya está sirviendo.

**Problema**: hay datos que el código nuevo lee con validación estricta. Si la conversión va en una
data-migration de seed, hay una ventana (entre el deploy y `db:seed:migrate`, que es un paso manual)
en la que el código nuevo lee datos viejos y falla.

**Escenario de falla**: (a) un aviso de retención programado para dentro de 3 días con
`vertical: 'gastronomy'` se intenta enviar después del deploy; el renderer lanza, la fila queda fallida
y el dueño nunca recibe el aviso de que su ficha se archiva. (b) Tras el deploy y antes de correr la
data-migration de `ai_settings`, el blob tiene `chat_gastronomy` y el parse falla: se cae el chat IA de
alojamientos, el de experiencias y las traducciones, no sólo el de comer y salir (exactamente
HOS-1220).

**Propuesta**: (1) estas conversiones van en la **migración versionada** (el carril 1 admite
conversiones de datos atadas a un cambio estructural, `packages/db/CLAUDE.md` §carril 1), no en el
seed; (2) además, lectores tolerantes durante un release (los renderers aceptan el alias viejo; la
lectura de `ai_settings` ignora claves desconocidas en vez de rechazar el blob); (3) un test que
parsee un blob con una feature desconocida y pruebe que las demás siguen andando.

---

### F-V1-A-008 · Las data-migrations históricas dejan de compilar; el checksum no es la restricción real · ALTA

**Dónde**: sub-spec 1 §Mecánica paso 3 («Las data-migrations históricas no se tocan (checksum en el
ledger)»); discovery A §6.

**Evidencia**:
- El checksum **no se verifica**: `packages/seed/src/data-migrations/ledger.ts:16` («the
  checksum-drift check is not yet wired»).
- Data-migrations históricas que importan símbolos que el renombrado borra:
  `0079-hos-1077-vertical-…-permissions.ts:75` (`gastronomies` de `@repo/db`), `:93-98,147-148`
  (`PermissionEnum.GASTRONOMY_*`), `:163,179` (`RoleEnum.GASTRONOMY_OWNER`);
  `0110-hos1457-v53-permissions.ts:33` (`RoleEnum.GASTRONOMY_OWNER`);
  `0034-hos-372-…-media-to-relational.ts:53` (`gastronomyMedia`).
- `0109`, `0110` y `0125` (que mencionan la palabra) **no están en `origin/main`**: van a correr en prod
  por primera vez con el deploy del corte.

**Problema**: el motivo que da la spec para no tocar las data-migrations es falso, y el problema real no
aparece: si se renombran `RoleEnum`, `PermissionEnum` y las tablas de `@repo/db`, esos archivos no
compilan y el typecheck de `@repo/seed` queda rojo. Las salidas son editar sus imports (posible, porque
el checksum no se verifica) o dejar alias deprecados en `@repo/schemas`/`@repo/db` (que G-FAC-R1
prohibiría).

**Escenario de falla**: el implementador sigue la spec al pie de la letra, no toca `0079`/`0110` y el
PR del renombrado no pasa `typecheck`. O los edita sin saber que `0110` todavía no corrió en prod: con
el corte, `0110` corre después de la migración de renombrado y tiene que referirse a `VENUE_OWNER`
(el valor que ya existe en el enum Postgres en ese momento), no a `GASTRONOMY_OWNER`.

**Propuesta**: corregir el texto: «las data-migrations históricas se editan sólo en sus imports y
literales de identificador, para que compilen contra los nombres nuevos; su lógica no cambia; el
checksum no se verifica (ledger.ts:16)». Agregar al criterio de aceptación: `CI=true` typecheck de
`@repo/seed` y, en una base clonada de prod-main, correr las data-migrations pendientes (`0109`,
`0110`, `0125`…) **después** de la migración de renombrado. Si el renombrado cae antes del corte, el
paso 6 borra estos módulos y el problema dura sólo hasta el corte.

---

### F-V1-A-009 · Los ids deterministas de los fixtures derivan de `gastronomy:${seedId}` · ALTA

**Dónde**: sub-spec 1 §Mecánica paso 3 (`data/gastronomy/` → `data/venue/` con dual-write); discovery
A §5 última fila («posible derivación del id desde el nombre»).

**Evidencia**:
- `packages/seed/src/example/gastronomies.seed.ts:37`:
  `deterministicFixtureId({ seedKey: \`gastronomy:${seedId}\` })`; `:54` FAQ =
  `gastronomyFaq:${gastronomySeedId}:${index}`.
- El `seedId` es el campo `id` del fixture, que también tiene la palabra:
  `packages/seed/src/data/gastronomy/001-gastronomy-uruguay-la-parrilla-del-puerto.json:2`
  (`"id": "001-gastronomy-uruguay-…"`), y es igual al nombre de archivo
  (`data-migrations/example-fixture-ids.helpers.ts:22`).
- La carpeta Cloudinary de una ficha embebe su id (`media-upload.schema.ts:371-373`).

**Problema**: un renombrado mecánico de la semilla del id (`venue:`) o de los ids de fixture cambia el
UUID de cada ficha de ejemplo, de sus FAQ y de sus reseñas. Discovery lo dejó como «posible»: está
confirmado.

**Escenario de falla**: la data-migration de dual-write inserta las 6 fichas «nuevas» con UUIDs nuevos
en staging; las viejas siguen ahí (o las borra, y con ellas sus medios, QR, bookmarks y eventos de
dominio). Las data-migrations que buscan fixtures por id (`example-fixture-ids.helpers.ts`) dejan de
encontrarlos.

**Propuesta**: congelar las semillas de id existentes (`gastronomy:`/`gastronomyFaq:` e ids de
fixture) como claves opacas, allowlisteadas en G-FAC-R1 por ruta exacta, y renombrar sólo carpeta,
nombre de archivo y campos visibles; o, si el owner prefiere cero rastro, definir explícitamente la
migración de ids (UPDATE de PK con cascada manual) y su alcance. `REQUIERE DECISIÓN DEL OWNER` sólo si
se elige la segunda.

---

### F-V1-A-010 · Despliegue no atómico: base, API, web y admin se despliegan por separado · ALTA

**Dónde**: sub-spec 1 completo; OD-06; regla expand/contract del `CLAUDE.md` raíz (HOS-433).

**Evidencia**:
- Deploy manual por app desde Coolify (`CLAUDE.md` raíz, §Deploy); las migraciones se aplican con
  `hops db-migrate`, aparte del redeploy.
- Durante un redeploy de Coolify conviven dos contenedores y el tráfico alterna entre el viejo y el
  nuevo (memoria del proyecto, precedente medido).
- Contratos que cambian de nombre: rutas `/api/v1/*/gastronomies` (`apps/api/src/routes/index.ts:332,479,559`),
  `entityType: 'gastronomy'` en uploads y chat IA, `?applicableVertical=`, valores de enum en cuerpos.

**Problema**: `ALTER TABLE gastronomies RENAME TO venues` es una operación de *contract*: el código
viejo se rompe en el mismo instante. La spec no dice si hay ventana de mantenimiento, ni compatibilidad
transitoria, ni orden de despliegue entre las cuatro piezas. Tampoco considera los bundles viejos del
admin (SPA) y del web que ya están cargados en los navegadores.

**Escenario de falla**: se corre `hops db-migrate` en staging; el contenedor de API todavía viejo
consulta `gastronomies` → 500 en todas las fichas de comer y salir y en el home si las incluye. Después
se redeploya la API; el web sigue viejo y llama a `/api/v1/public/gastronomies` → 404 hasta que alguien
redeploya el web. Un admin con la pestaña abierta guarda una ficha → 404.

**Propuesta** — `REQUIERE DECISIÓN DEL OWNER`:
1. **Ventana de mantenimiento declarada** (recomendada si cae junto al corte, que ya es «sin
   convivencia»): orden fijo — bajar web/admin, migrar, desplegar API, desplegar web/admin.
2. **Compatibilidad de un release**: vistas `gastronomies` → `venues` (y alias de rutas API y de
   valores de entrada) en el release N, retiradas en N+1, con un guard de fecha de retiro.
3. En los dos casos, documentar el orden en el sub-spec y en el runbook del smoke.

Toca: OD-06.

---

### F-V1-A-011 · G-FAC-01 no se puede implementar como una carga de G18: G18 indexa por la primera columna · ALTA

**Dónde**: sub-spec 2 §En base (`listing_facet` con PK `(vertical, slug)`); `06-guards.md` G-FAC-01
(«una carga nueva en `buildLoads`/`LOAD_NAMES`… no un guard nuevo»).

**Evidencia**:
- `scripts/check-catalog-sql.ts:234` `const keyColumn = load.columns[0]`; `:271-279` una segunda
  fila con la misma clave es violación («inserted twice … would violate the primary key»).
  `generate-catalog-sql.ts:46-47` documenta «The first one is the primary key».
- Con PK `(vertical, slug)`, la primera columna `vertical` se repite (`venue/gastronomia`,
  `venue/noche`) → G18 rojo con un catálogo correcto.
- Modo baseline: `check-catalog-sql.ts:420` sólo compara `catalog_key` y `vertical` después del paso 6
  del corte, así que una carga nueva de `listing_facet` queda **sin vigilar** después del corte.
- G18 no pliega `DELETE` ni `UPDATE` (F-V1-A-001): el catálogo de rubros sólo puede crecer. No se
  puede retirar ni renombrar un rubro.

**Problema**: el guard propuesto da falso rojo desde el primer día; si se «arregla» poniendo `slug`
primero, da falso rojo cuando dos verticales tengan `estandar` (accommodation y experience ya lo
tienen, DEC-FAC-015). Y deja de vigilar después del corte.

**Escenario de falla**: la migración inserta 4 filas correctas; G18 dice «key 'venue' inserted twice».
El implementador ordena las columnas `(slug, vertical)`; G18 dice «key 'estandar' inserted twice».

**Propuesta**: (1) enseñarle a G18 claves compuestas (`keyColumns: string[]` en `CatalogLoad`), con
test positivo y mutación; o (2) PK sintética de una columna (`id = 'venue:gastronomia'`) + `UNIQUE
(vertical, slug)` como destino de la FK compuesta. (3) En los dos casos, sumar `listing_facet` a las
cargas del modo baseline. (4) Declarar en el sub-spec que un rubro no se retira ni se renombra sin
enseñarle antes a G18 esa forma (o aceptarlo como regla de producto).

---

### F-V1-A-012 · Enums Postgres y CHECK generados: la spec no dice cómo se mapean las filas · MEDIA

**Dónde**: sub-spec 1 §Mecánica paso 1 («`ALTER TYPE … RENAME` / `RENAME VALUE` (o recreación, como
hizo el repo en 0126, 0128 y 0135)») y paso 2.

**Evidencia**:
- `packages/db/src/migrations/0135_retire_user_impersonate.sql:1-7`: la recreación pasa las columnas a
  `text`, **borra** las filas del valor retirado y recién después recrea el tipo y castea. Para un
  renombre, el paso intermedio tiene que ser un `UPDATE … SET permission = 'venue.' || …`; drizzle-kit
  no lo genera, y su SQL generado castea `USING col::new_enum` → falla con las filas viejas.
- Columnas afectadas por `role_enum`/`permission_enum`/`entity_type_enum`: `r_role_permission`,
  `r_user_permission`, `r_user_role`, `user_role_audit`, `user_bookmark`, `r_entity_tag`,
  `entity_view`, `entity_view_monthly_rollup`, `entity_comment`, `qr_codes` (más el índice parcial de
  `extras/040` sobre `qr_codes.entity_type`).
- CHECKs generados desde `VerticalEnum` (`vertical.dbschema.ts:26-29` `ck_vertical_id`, y
  `ck_addon_product_compatible_verticals`, `ck_promo_code_verticals`, `fix_request_entity_type_check`):
  drizzle-kit emite `DROP`/`ADD CONSTRAINT` y el `ADD` valida las filas existentes.
- Sub-spec 4: `ALTER TYPE … ADD VALUE 'PUB'`. Un valor recién agregado no se puede usar en la misma
  transacción; si el backfill de rubros (sub-spec 2) o un seed del mismo lote usa `PUB`/`BOLICHE`,
  falla. (Inferido: verificar si el migrador del repo corre el lote en una sola transacción.)

**Problema**: «o recreación» deja abierta la variante que pierde datos o falla. `RENAME VALUE` es
in-place, atómico y arrastra todas las filas (incluida la auditoría); la recreación exige mapear a mano
en 10+ columnas.

**Escenario de falla**: el implementador acepta el SQL de `db:generate`, que recrea `permission_enum`
sin los valores `gastronomy.*` y castea; la migración falla en staging («invalid input value for enum»)
o, si copia 0135 al pie de la letra, **borra** las filas de permisos de `GASTRONOMY_OWNER`, y los dueños
quedan sin permisos de su vertical.

**Propuesta**: fijar en el sub-spec: `ALTER TYPE … RENAME VALUE` para los valores de `role_enum`,
`permission_enum`, `permission_category_enum` y `entity_type_enum`, y `ALTER TYPE … RENAME TO` para los
4 enums `gastronomy_*_enum`, con el SQL de drizzle editado a mano y el snapshot alineado; para los CHECK,
la secuencia `DROP` → `UPDATE` → `ADD`, editada a mano; y las altas de valor (`PUB`, `BOLICHE`) en una
migración separada de cualquier uso.

---

### F-V1-A-013 · Extras que se reaplican: nombres de índices y constraints, y fallas silenciosas · MEDIA

**Dónde**: sub-spec 1 §Mecánica paso 1 («Los extras vivos (`026`, `032`) se reescriben al nombre
nuevo»).

**Evidencia**:
- `extras/032-gastronomy-experience-media.constraints.sql:38-52,60-80`: si la tabla no existe, **saltea
  con un NOTICE** (no falla); crea `uq_gastronomy_media_single_featured` y
  `chk_gastronomy_media_featured_not_archived`, buscados por nombre.
- `extras/026-remove-seo-keywords.data-migration.sql:9`: `UPDATE gastronomies …` sin guarda → con la
  tabla renombrada, `db:apply-extras` **falla**.
- `ALTER TABLE … RENAME TO` conserva los nombres viejos de índices, constraints y secuencias.
  Precedente `0114_entity_subscriptions_rename.sql:1-12`: renombró la tabla y recreó a mano FK e
  índices con el nombre nuevo.

**Problema**: si la migración renombra sólo las tablas y `032` se reescribe con nombres `venue_*`, la
reaplicación crea un **segundo** índice único y un segundo CHECK (los `IF EXISTS` buscan el nombre
nuevo), y los viejos quedan vivos con un nombre que ningún guard de repo ve. Si `032` no se reescribe,
saltea en silencio y en una base nueva el invariante «una sola foto destacada» **no existe**.

**Escenario de falla**: en una base de worktree nueva se corre `db:migrate` + `db:apply-extras` con un
`032` sin actualizar: NOTICE «Table gastronomy_media does not exist, skipping», exit 0, y la base acepta
dos fotos destacadas por local.

**Propuesta**: la migración renombra explícitamente cada índice, FK, constraint y secuencia (inventario
desde `pg_indexes`/`pg_constraint` de una base con seed); `026` y `032` se reescriben en el mismo PR;
criterio de aceptación con una consulta a `pg_indexes`/`pg_constraint` que no devuelva ningún nombre
con `gastronom` y que encuentre exactamente un `uq_venue_media_single_featured`. Recomendable: que
`032` falle (no NOTICE) si la tabla no existe en una base migrada.

---

### F-V1-A-014 · Backfill de rubros y «≥1 rubro por ficha»: carril, ventana, concurrencia y purga · MEDIA

**Dónde**: sub-spec 2 §En base («≥1 rubro por ficha: lo exige el servicio… Backfill: todas las fichas
existentes reciben rubros por su tipo») y §Seed.

**Evidencia**:
- La regla tipo → rubro vive en código (`types` de cada rubro, sub-spec 2); un `INSERT … SELECT … CASE
  type` en SQL la duplica.
- `scripts/check-purged-closed-list.ts:22-24`: toda tabla que cuelga de una ficha tiene que estar en
  `scripts/guards/purged-closed-list.json` (la purga de V6.5 la recorre). `LISTING_TABLES =
  ['accommodations','gastronomies','experiences']`.
- El repo usa triggers en extras para invariantes que Drizzle no expresa (`extras/041`, `042`, `048`).

**Problema**:
- No dice en qué carril va el backfill. Si va como data-migration de seed, en el lapso entre deploy y
  `db:seed:migrate` toda ficha tiene cero rubros → el resolvedor da `AUSENTE` a la carta → 404 en
  `/carta/` (incluidos los QR). En una base fresca, la data-migration se estampa sin correr
  (`--baseline-stamp`), así que el baseline del seed tiene que traer las filas ya hechas.
- «≥1 por ficha» sólo en el servicio no resiste dos requests concurrentes que sacan rubros distintos
  (cada uno ve 2 y saca 1).
- Las tres tablas `r_*_facet` no aparecen en la lista cerrada de purga.

**Escenario de falla**: el dueño de un resto-bar `{gastronomia, noche}` saca `noche` desde el editor
mientras soporte saca `gastronomia` desde el admin: la ficha queda sin rubros y el resolvedor esconde
todas las secciones propias. Otro: la purga de una ficha borrada falla por FK desde `r_venue_facet`.

**Propuesta**: (1) backfill en la **migración versionada** que crea las tablas, con un test que compare
el `CASE` SQL con el catálogo de código (o generado por `generate-catalog-sql.ts`); (2) constraint
trigger `DEFERRABLE INITIALLY DEFERRED` en extras para «≥1 rubro», o `SELECT … FOR UPDATE` de la ficha
en el servicio, explícito en el sub-spec; (3) `r_accommodation_facet`, `r_venue_facet` y
`r_experience_facet` en la lista cerrada de purga con su `ON DELETE`; (4) aclarar si las fichas con
`deleted_at` también reciben rubros (recomendado: sí, para que restaurar no deje una ficha sin rubros).

---

### F-V1-A-015 · Guards anclados al nombre quedan ciegos en silencio después del renombrado · MEDIA

**Dónde**: sub-spec 1 §Mecánica paso 5 («Guards e inventarios atados al nombre… se actualizan en el
mismo cambio»); discovery A §8.

**Evidencia**:
- `scripts/check-vertical-immutable.ts:15,17` (G2c): `LISTING_PATH = /(?:accommodation|gastronomy|experience)/i`,
  `LISTING_TABLE = /\b(?:accommodations|gastronomies|experiences)\b/`; piso `MIN_SCANNED_FILES = 500`.
- `scripts/check-purged-closed-list.ts:23` (G-R9): `LISTING_TABLES` con `'gastronomies'`; piso 100.
- `scripts/check-vertical-axis-items.ts:72` (G1b): `DISPATCH_LITERALS = ['gastronomy','experience']`.

**Problema**: si alguno de estos guards no se actualiza, **no falla**: el piso de archivos escaneados
se sigue cumpliendo y simplemente deja de mirar la vertical renombrada (fail-open). «Se actualizan» no
alcanza como criterio de aceptación: un guard que no ve nada también está en verde.

**Escenario de falla**: el implementador renombra todo menos el regex de G2c; en el release siguiente
alguien agrega `vertical` al schema de update de venue y G2c sigue verde. Con G-R9: se crea
`venue_night_info_photos` con FK a `venues` y nadie exige su fila en la lista de purga.

**Propuesta**: criterio de aceptación por guard atado al nombre: **mutación posterior al renombrado**
que lo ponga en rojo sobre un archivo de venue (lista cerrada en el sub-spec, una línea por guard). Y
G-FAC-R1 tiene que escanear también `scripts/` para que un regex con la palabra vieja sea rojo.

---

### F-V1-A-016 · El patrón y la allowlist de G-FAC-R1 no cierran · MEDIA

**Dónde**: `06-guards.md` G-FAC-R1; DEC-FAC-015 (nota); OD-03, OD-05.

**Evidencia**:
- G8, el modelo, tiene allowlist de **exactamente tres** entradas con auto-chequeo (discovery A §9).
  G-FAC-R1 enumera **cinco** («migraciones…, data-migrations…, specs de HOS-1352/3/4, esta spec, y el
  mapa de redirects legacy») y después dice «agregar una **cuarta** entrada… → rojo».
- Legítimos que esta revisión agrega y la allowlist no cubre: tests de redirects
  (`public-redirect-paths.guard.test.ts` va a contener `/gastronomia/`), la regex tolerante de QR
  (F-V1-A-006), el lector tolerante de `domain_event` (F-V1-A-005), los alias legados de `catalogId`
  y las semillas de fixtures (F-V1-A-002, 009), el futuro `0000_baseline.sql`.
- El rubro `gastronomia` se queda (DEC-FAC-015) en código, URL (`/comer-y-salir/rubro/gastronomia/`),
  claves i18n y filas de `listing_facet`/`r_venue_facet`; la URL `/{lang}/gastronomia/` se retira.
  `EventCategoryEnum.GASTRONOMY`/`PostCategoryEnum.GASTRONOMY` usan la forma inglesa en mayúsculas.

**Problema**: con un patrón por palabra no se distingue `/es/gastronomia/` (retirado) de
`/comer-y-salir/rubro/gastronomia/` (válido), ni `GASTRONOMY_OWNER` (retirado) de
`EventCategoryEnum.GASTRONOMY` (si OD-03 lo deja). Y la allowlist de tamaño fijo no aguanta los usos
legados que el propio diseño necesita.

**Escenario de falla**: el guard nace con `gastronom` pelado y la primera corrida da cientos de rojos
legítimos; se agrega `--exclude` por carpeta hasta que la allowlist cubre media `apps/web` y el guard
ya no protege nada.

**Propuesta**: (1) resolver OD-03/OD-05 antes de escribir el guard; (2) patrón por **forma de
identificador** (`gastronomy|gastronomies|Gastronomy|GASTRONOMY` en sus combinaciones, con frontera de
palabra) más una regla aparte de **ruta** (`/(es|en|pt)/gastronomia(/|$)` y `planes|presentacion|publicar/gastronomia`)
y otra para `gastro-`; (3) exención por **marcador en línea** (`legacy-name-allowed: <motivo>`)
contada con auto-chequeo exacto, en vez de crecer la allowlist por carpeta; (4) corregir «cuarta» →
el número real.

Toca: OD-03, OD-05.

---

### F-V1-A-017 · Reversibilidad y rollback sin plan · MEDIA

**Dónde**: sub-spec 1 completo (no hay sección de rollback); DEC-FAC-014 (301).

**Evidencia**:
- 301 desde `legacy-redirects.ts`: los navegadores cachean un 301 sin vencimiento.
- `infra/cloudflare/rules/cache-rules.md:110-112,510-512` (reglas a mano por prefijo
  `/es|en|pt/gastronomia`) y `:276` (`max-age=14400` en el navegador).
- Lo irreversible por diseño: `domain_event` (F-V1-A-005), correos ya enviados con URLs viejas, índice
  de buscadores, títulos ya mostrados por MercadoPago.

**Problema**: no hay forma documentada de volver atrás si el smoke de staging falla a la mitad, ni de
qué queda afuera de un rollback. Con un 301 servido desde el día uno, un rollback deja a los
navegadores que ya lo vieron redirigiendo a `/comer-y-salir/`, que después del rollback da 404.

**Escenario de falla**: el renombrado sale a prod, aparece un bug de checkout en la vertical y se revierte
el deploy: los visitantes recurrentes de `/es/gastronomia/` siguen saltando a `/es/comer-y-salir/` (301
cacheado) y ven 404 hasta que limpian el caché.

**Propuesta**: (1) servir **302** durante el período de soak en staging y prod, y pasar a 301 con un
cambio explícito (y G-FAC-R2 que lo verifique); (2) migración inversa escrita y ensayada en una base
de ensayo (RENAME inversos + UPDATE inversos), con la lista de lo que no vuelve; (3) paso de deploy:
purgar en Cloudflare los prefijos viejos y los tags `list-gastro`/`gastro-<slug>`, y actualizar las
reglas a mano **en el mismo momento**, no «después».

---

### F-V1-A-018 · «Hoy no hay datos reales» no está medido · MEDIA

**Dónde**: DEC-FAC-016 («hoy no hay datos reales; nunca va a ser más barato»); OD-04 («medir»).

**Evidencia**: premisas del corte de HOS-1352 (DEC-MIG-007): prod tiene 5 cuentas que importan, cada
una con una ficha; no está registrado de qué vertical son. Prod tiene `qr_codes`, `gastronomies`,
`entity_subscriptions` y `billing_subscriptions` (`origin/main`).

**Problema**: la decisión de renombrado total se apoya en un dato sin medir, y varias propuestas de
esta revisión cambian según el resultado (QR para siempre, ventana de mantenimiento, migración de
preapprovals).

**Propuesta**: antes de cerrar OD-01/04/06, correr en prod con `hops psql --target=prod` (por ssh al
VPS; salida vacía = error tragado, no «cero filas») y excluyendo `deleted_at`:
- `select count(*) from gastronomies where deleted_at is null;` (por `lifecycle_state`/publicación);
- `select status, count(*) from entity_subscriptions where product_domain = 'gastronomy' group by 1;`
  y lo mismo en `billing_subscriptions` (activas o en prueba = preapprovals vivas en MP);
- `select purpose, source, count(*) from qr_codes where entity_type = 'GASTRONOMY' and deleted_at is null group by 1,2;`
  y los escaneos de los últimos 90 días en `qr_code_scan`;
- `select count(*) from r_user_role where role = 'GASTRONOMY_OWNER';`
- conteos de `user_bookmark`/`entity_view` con `entity_type = 'GASTRONOMY'` y de `gastronomy_media`.
En staging, además: `subscription`, `trial`, `permanent_grant`, `quota_window` abiertas,
`domain_event` y `email_outbox` pendientes con la vertical. Registrar los números en el decision log.

---

### F-V1-A-019 · Cloudinary: no se rompe nada, pero hay que decirlo · BAJA

**Dónde**: OD-01 (carpetas Cloudinary).

**Evidencia**: `packages/schemas/src/common/media-upload.schema.ts:371-373` (carpeta
`hospeda/<env>/gastronomies/<id>`); los únicos chequeos de prefijo son por entorno, no por entidad
(`apps/api/src/routes/media/admin/delete.ts:87-92,261-266`,
`apps/api/src/routes/media/protected/delete-entity.ts:86-91,289-294`).

**Problema**: ninguno funcional: lo ya subido sigue sirviéndose y se puede borrar. Queda una mezcla de
carpetas `gastronomies/` y `venues/` por entidad que el sub-spec no menciona.

**Propuesta**: cerrar esta parte de OD-01 como «no se mueve; carpetas mixtas aceptadas» (precedente
HOS-831), y que G-FAC-R1 no lea los `public_id` guardados en fixtures (o allowlistearlos).

Toca: OD-01.

---

### F-V1-A-020 · Caché Redis del conjunto efectivo y ventanas de cuota con la vertical en la clave · BAJA

**Dónde**: sub-spec 1 (no lo menciona).

**Evidencia**: `packages/verticals/src/effective-set-cache/cache.ts:69,109` (campo del hash = la
vertical); `quota_window (vertical, key)` (F-V1-A-004).

**Problema**: los campos `gastronomy` del hash quedan huérfanos (inofensivo, salvo la memoria), y las
ventanas de cuota abiertas no se encuentran con `venue`: cada dueño arranca el mes con la cuota de chat
IA en cero.

**Propuesta**: paso de deploy que invalide la generación global del caché (`gen:all`), y decidir si
las ventanas abiertas se migran (UPDATE de `vertical` y `key` en la migración) o se aceptan
reiniciadas (staging; en prod no existen antes del corte).

---

### F-V1-A-021 · OD-02 se tiene que cerrar antes de la migración: los nombres físicos no se renombran dos veces · BAJA

**Dónde**: sub-spec 1 mapa de nombres (`venueEvents` y familia «PENDIENTE (OD-02)»).

**Evidencia**: `gastronomy_events` pasaría a `venue_events`; el código ya llama a esa sección
`venueEvents`/`VenueEventRow`/`venue-event-draft.ts` (discovery A §3); el dominio de eventos
municipales usa `events` y `event_locations.venue_name`.

**Problema**: si OD-02 se resuelve después renombrando `venueEvents` → `listingEvents` (u otro), la
tabla, sus índices, el schema y los permisos vuelven a migrar. Cada renombrado físico cuesta todo lo de
F-V1-A-012/013.

**Propuesta**: cerrar OD-02 antes de escribir la migración del sub-spec 1 y fijar ahí mismo los
nombres finales de las 10 tablas y los 4 enums.

Toca: OD-02.

---

### F-V1-A-022 · La generación de la migración es interactiva y conviene separar nombre lógico de físico · BAJA

**Dónde**: sub-spec 1 §Mecánica paso 1; OD-06.

**Evidencia**: drizzle-kit `generate` pregunta, por cada tabla, columna y enum, si se creó o se renombró
(10 tablas, ~50 columnas con `gastronomy_id`, 4 enums); sin TTY no se puede responder. El precedente
`0114_entity_subscriptions_rename.sql` se escribió a mano y la guarda de drift exige que el snapshot
coincida.

**Problema**: un agente sin TTY no puede generar la migración y caería en escribir SQL + snapshot a
mano sin que el sub-spec lo prevea.

**Propuesta**: para OD-06, separar en (a) PRs de **renombrado lógico** (símbolos TS, carpetas,
rutas internas) con `pgTable('gastronomies')` todavía apuntando a los nombres físicos viejos (sin
migración, sin cambio de contrato), y (b) **un** PR atómico con la migración física escrita a mano,
los valores persistidos y los contratos (API/URL), con snapshot regenerado y verificado por la guarda
de drift. Así cada PR de la parte (a) deja staging sano y la parte riesgosa queda chica.

Toca: OD-06.
