---
title: Revisión vuelta 1 · Consolidado
linear: HOS-1787
created: 2026-10-25
base: origin/staging @ 2ebee74d0a (prod verificado contra origin/main, migración 0124)
---

# Revisión vuelta 1 · Consolidado

Fusión de los tres informes (A: datos y migración, 22 hallazgos; B: producto y edge cases, 22; C:
arquitectura, 24). **68 hallazgos de origen → 48 consolidados.** Ids nuevos `F-V1-NNN`, ordenados por
severidad. Cuando se fusionan hallazgos con severidades distintas queda la más alta; los
re-graduados se explican abajo.

## Verificaciones hechas al consolidar

Donde un reclamo era dudoso o dos revisores lo planteaban distinto, se miró el código:

| reclamo | resultado | evidencia |
|---|---|---|
| prod está en la migración 0124, staging en 0177 | confirmado | `git ls-tree origin/main packages/db/src/migrations/` termina en `0124_amusing_hawkeye.sql`; el checkout termina en `0177_hos1730_declared_payer_email.sql` |
| `entity_subscriptions` ya no existe en staging | confirmado | `0125_robust_cassandra_nova.sql:68` `DROP TABLE "entity_subscriptions" CASCADE`. En prod todavía existe: la borra la 0125 cuando llegue |
| G18 identifica la fila por la primera columna | confirmado (A-011 ≡ C-007) | `scripts/check-catalog-sql.ts:234` (`keyColumn = load.columns[0]`) y `:307` (`row[0]`) |
| G18 rechaza todo lo que no sea `INSERT … VALUES` | confirmado | `scripts/check-catalog-sql.ts:225-229` (`touches` incluye `UPDATE`, `DELETE FROM`, `TRUNCATE`) |
| los ids UUIDv5 derivan de la vertical | confirmado | `scripts/production-catalog/loads.ts:22` `catalogId('plan:${plan.vertical}:${plan.slug}')`; `catalog.ts:1904-1912` |
| el QR impreso apunta a `/q/<slug>` y lo que se repunta es `target_url` | confirmado (A-006 ≡ B-003) | `packages/db/src/schemas/qr-code/qr_code.dbschema.ts:19-26`; regex de lectura en `gastronomy-qr.ts:42` |
| regla 3 del contrato de errores: un rechazo al DUEÑO no es 404 | confirmado | `apps/api/docs/error-contract.md:277-281`; la tabla del contrato ya tiene «State conflict → 409 `ALREADY_EXISTS`» con `reason` (precedente `COMMITMENT_TAKEN`) |
| entre el paso 4 y el 6 está el paso 5 (cobertura) | confirmado | `packages/verticals/src/authorization/resolve-listing-access.ts:139-147` |
| G-R9 exige fila en la lista de purga para toda tabla con FK a una ficha | confirmado | `scripts/check-purged-closed-list.ts:1-12` |
| el checksum del ledger de seed no se verifica | confirmado | `packages/seed/src/data-migrations/ledger.ts:14-16` |

No hubo desacuerdos de fondo entre revisores. Donde dos proponían soluciones distintas para el mismo
problema (B-002 «capacidad hija» vs. C-002 «rasgos»; C-005 «409» vs. B-007 «404 con razón»), se
eligió una y se justifica en su párrafo.

## La decisión que condiciona todo

**F-V1-001 (renombrado antes o después del corte V6 de HOS-1352) es la decisión de compuerta.** Prod
corre la migración 0124 y no tiene el mundo nuevo (`vertical`, `plan*`, `subscription`, `trial`,
`domain_event`, `email_outbox`); staging va por la 0177. El paso 6 del corte aplasta la historia en
`0000_baseline.sql` y borra los módulos de data-migration. Según caiga el renombrado:

- **antes del corte**: F-V1-002 y F-V1-003 se resuelven editando en su origen las migraciones que sólo
  existen en staging (0129, 0144, 0176); F-V1-009 se reduce a aceptar la pérdida en staging; F-V1-011
  dura hasta el paso 6; F-V1-013 se apoya en la ventana que el corte ya tiene;
- **después del corte**: F-V1-002, 003 y 009 exigen la maquinaria completa (G18 que pliegue renombres,
  triggers desactivados, alias de ids, lector tolerante de `domain_event`) y F-V1-013 necesita su
  propia ventana o compatibilidad de un release.

Dependen de F-V1-001: **002, 003, 008 (parte de cuotas), 009, 011, 013**. Es `Q-01` en
[`../11-resolucion-vuelta-1/10-decisiones-del-owner.md`](../11-resolucion-vuelta-1/10-decisiones-del-owner.md).

## Tabla

| id | título | sev. | origen | decide owner | depende de | sub-spec |
|---|---|---|---|---|---|---|
| F-V1-001 | El renombrado ignora el corte V6: prod corre otro esquema | CRÍTICA | A-003 | sí (Q-01) | F-V1-026 (informa) | 1 |
| F-V1-002 | El catálogo de planes no se puede renombrar con G18 y los triggers de inmutabilidad | CRÍTICA | A-001 | sí (Q-02) | F-V1-001 | 1 |
| F-V1-003 | Los ids UUIDv5 del catálogo derivan de la vertical y de las claves | CRÍTICA | A-002 | sí (Q-02) | F-V1-001 | 1 |
| F-V1-004 | G-FAC-01 no se puede implementar como una carga de G18 | CRÍTICA | A-011, C-007 | no | Q-06 | 2, guards |
| F-V1-005 | El contenido oculto se filtra por lectores fuera de `getBySlug` | ALTA | B-001, C-013, C-003 (a, b) | no | - | 3 |
| F-V1-006 | Las claves que viven dentro de una sección no tienen lugar en el modelo | ALTA | B-002, C-002 | no | - | 2, 3 |
| F-V1-007 | Lo que protege a los QR impresos es `qr_codes.target_url`, no el 301 | ALTA | A-006, B-003 | no | F-V1-026 (duración) | 1 |
| F-V1-008 | Inventario de valores persistidos desactualizado e incompleto | ALTA | A-004, A-020 | no | F-V1-001 (cuotas) | 1 |
| F-V1-009 | `domain_event` es append-only y se lee por vertical | ALTA | A-005 | sí (vía Q-01) | F-V1-001 | 1 |
| F-V1-010 | Datos encolados y blobs que el código nuevo rechaza (outbox, `ai_settings`) | ALTA | A-007 | no | - | 1 |
| F-V1-011 | Las data-migrations históricas dejan de compilar; el checksum no es la restricción | ALTA | A-008 | no | F-V1-001 | 1 |
| F-V1-012 | Los ids de fixtures derivan de `gastronomy:${seedId}` | ALTA | A-009 | sí (Q-05) | - | 1 |
| F-V1-013 | Despliegue no atómico, partición en PRs y vuelta atrás sin plan | ALTA | A-010, A-017, A-022 | sí (Q-03) | F-V1-001 | 1 |
| F-V1-014 | Alojamiento y experiencia: genericidad en el papel y gating público por campo | ALTA | C-001, B-006, C-003 (c) | sí (Q-07) | - | 2, 3, 5 |
| F-V1-015 | El paso nuevo no tiene posición fija y duplica la regla del paso 6 | ALTA | C-004 | no | - | 3 |
| F-V1-016 | AUSENTE → 404 al dueño viola la regla 3; el PATCH decide con hechos previos | ALTA | C-005, C-006, B-007 | no | F-V1-015 | 3, 4 |
| F-V1-017 | Tablas nuevas sin fila en G-R9; backfill y «≥1 rubro» sin carril ni concurrencia | ALTA | C-008, A-014 | no | Q-06 | 2, 4 |
| F-V1-018 | G-FAC-03 prohíbe lo que tres sub-specs piden y no ve literales | ALTA | C-010 | no | Q-06 | guards |
| F-V1-019 | Falta el guard que obliga a declarar la capacidad | ALTA | C-011 | no | F-V1-006 | guards |
| F-V1-020 | Rubros gratis + colecciones públicas = manipulación; moderación de rubros | ALTA | B-004, B-018 | sí (Q-08) | - | 2, 7 |
| F-V1-021 | Un local sólo de noche paga diferenciales de la carta y le puntúan la comida | ALTA | B-005, B-013 | sí (Q-09) | - | 6 |
| F-V1-022 | Enums Postgres: `RENAME VALUE`, no recreación | MEDIA | A-012 | no | - | 1, 4 |
| F-V1-023 | Extras reaplicables: nombres de índices y fallas silenciosas | MEDIA | A-013 | no | - | 1 |
| F-V1-024 | Guards anclados al nombre quedan ciegos en silencio | MEDIA | A-015 | no | - | 1, guards |
| F-V1-025 | El patrón y la allowlist de G-FAC-R1 no cierran | MEDIA | A-016 | parcial (Q-05) | Q-04, Q-05 | guards |
| F-V1-026 | «Hoy no hay datos reales» no está medido | MEDIA | A-018 | no (medición) | - | 1 |
| F-V1-027 | «≥1 rubro» se puede garantizar en base con una columna array | MEDIA | C-009 | sí (Q-06) | - | 2 |
| F-V1-028 | Extender G1(b) no atrapa las ramas reales | MEDIA | C-012 | no | - | guards |
| F-V1-029 | La purga por cambio de plan no existe y la de rubros está incompleta | MEDIA | C-014, B-022 | no | - | 6 |
| F-V1-030 | G-FAC-02 regla 6 no tiene fuente para «misma vertical» | MEDIA | C-015 | no | - | guards |
| F-V1-031 | Ids de capacidad como `string` y sin regla para un id desconocido | MEDIA | C-016 | no | - | 2, 3 |
| F-V1-032 | La regla 2 («billing no lee rubros») no tiene guard | MEDIA | C-017 | no | - | guards |
| F-V1-033 | Nombres internos: `venue` vs. lo existente, *facet* y *capacidad* | MEDIA | C-018, C-019, C-024, A-021 | sí (Q-04) | - | 1, 2, 6 |
| F-V1-034 | Ciclo de vida de los rubros y estados degradados del resolvedor | MEDIA | B-008, C-020 | no | Q-06 | 2, 3, 5 |
| F-V1-035 | La coordinación con HOS-1362 depende de dónde viva BLOQUEADA | MEDIA | C-021 | no | F-V1-015 | 3, 7 |
| F-V1-036 | `estandar`: default en el alta y UI de una sola opción | MEDIA | B-009 | no | Q-07 | 2, 5, 7 |
| F-V1-037 | BLOQUEADA y AUSENTE vistas por el dueño | MEDIA | B-010 | no (objetable) | F-V1-016 | 5 |
| F-V1-038 | `nightInfo` no representa la noche real; `PUB` duplica a `BAR` | MEDIA | B-011, B-012 | sí (Q-10) | - | 4 |
| F-V1-039 | El chat de IA es un «asistente de restaurante» | MEDIA | B-014 | no | F-V1-005 | 6 |
| F-V1-040 | El JSON-LD marca todo local como `Restaurant` | MEDIA | B-015 | no | - | 6 |
| F-V1-041 | Colecciones: crawl, canónicas, sitemap vacío y estados vacíos | MEDIA | B-016 | no | - | 6 |
| F-V1-042 | «slug = UI = URL» choca con i18n; «Gastronomía» con cuatro significados | MEDIA | B-017 | no | - | 6 |
| F-V1-043 | Cloudinary: no se rompe nada, pero hay que decirlo | BAJA | A-019 | sí (Q-05) | - | 1 |
| F-V1-044 | La canónica de paginación apunta a una ruta inexistente | BAJA | B-019 | no | - | 6 |
| F-V1-045 | Detalles de UX del renombrado | BAJA | B-020 | parcial (Q-02, Q-04) | - | 1, 5 |
| F-V1-046 | «Una ficha = una dirección» vs. dos negocios en el mismo lugar | BAJA | B-021 | no (issue aparte) | - | - |
| F-V1-047 | La entrada de rubros no puede llevar `vertical` (G2c) | BAJA | C-022 | no | - | 2, 5, 7 |
| F-V1-048 | La presentación del catálogo queda partida sin decirlo | BAJA | C-023 | no | - | 2, 5 |

**Por severidad**: 4 CRÍTICA · 17 ALTA · 21 MEDIA · 6 BAJA.

**Re-graduados**: F-V1-004 queda CRÍTICA (A la puso ALTA, C CRÍTICA) porque el primer PR del sub-spec
2 no puede quedar verde tal como está escrito. F-V1-013 sube A-017 (MEDIA) y A-022 (BAJA) a ALTA al
fusionarlos con A-010. F-V1-021 sube B-013 (MEDIA) por fusión. F-V1-029 sube B-022 (BAJA). F-V1-033
sube C-024 y A-021 (BAJA) a MEDIA. Ninguno bajó.

---

## Hallazgos

### CRÍTICA

**F-V1-001 · El renombrado ignora el corte V6.** La spec diseña la migración «sobre staging», pero
prod está en la 0124 y el corte aplasta la historia. Si el renombrado cae antes, prod recibe el mundo
nuevo ya con `venue`; si cae después, hace falta la migración forward completa contra el mundo nuevo;
si cae en el medio de una partición en varios PRs, el baseline queda semi-renombrado (el peor caso, que
se prohíbe en cualquier opción). **Pendiente de decisión Q-01.** Mientras tanto se corrigió el contexto
de `spec.md` y del sub-spec 1 para que digan esto.

**F-V1-002 · El catálogo de planes choca con G18 y con `extras/041`.** G18 sólo pliega `INSERT`;
los triggers prohíben `UPDATE`/`DELETE` de filas versionadas y del `vertical` de `plan_version`; hay FK
compuestas que llevan la vertical. Y los triggers sólo existen donde corrió `db:apply-extras`, así que
una migración de renombrado pasa en CI (base desde cero) y falla en staging. **Pendiente de decisión
Q-02** (depende de Q-01). Se reescribió el «riesgo a revisar» del sub-spec 1 como bloqueante.

**F-V1-003 · Los ids UUIDv5 derivan de la vertical y de las claves.** Verificado: renombrar la vertical
cambia el id de los 6 planes, sus versiones, filas de entitlement/limit y `billing_option`; renombrar
una clave cambia cada fila que la usa. **Corrección factual aplicada** (discovery A §5 y OD-04 ya no
dicen «posiblemente»). **La salida, pendiente de Q-02.**

**F-V1-004 · G-FAC-01 no entra como carga de G18.** Con PK `(vertical, slug)` la primera columna se
repite y G18 da falso rojo; si se invierte, choca `estandar` de dos verticales. Además el modo baseline
de G18 no vigila cargas nuevas y G18 no permite retirar un rubro. Resolución técnica: si Q-06 elige la
columna array, `listing_facet` desaparece y G-FAC-01 pasa a «el CHECK de cada tabla de ficha coincide
con el catálogo»; si elige tablas de relación, PK sintética UUIDv5 (`facet:<vertical>:<slug>`) como
primera columna + `UNIQUE (vertical, slug)` para la FK, sin tocar G18, y la carga se suma al modo
baseline. **Aplicado en `06-guards.md` con las dos ramas; la rama la fija Q-06.**

### ALTA

**F-V1-005 · Lectores fuera del resolvedor.** Hoy el contenido sale también por `getById`, `list`,
`getByDestination`, el contexto del chat de IA, el folleto PDF, la hoja QR y `/carta/`; las columnas de
`nightInfo` viven en la fila y salen por cualquier proyección. Además alojamiento resuelve por dueño en
9 lectores, incluidos listados. **Aplicado**: el sub-spec 3 tiene ahora la lista cerrada de lectores,
cada uno con su comportamiento ante AUSENTE/BLOQUEADA, y un único lector público por vertical con carga
de rubros en lote para los listados. El fallo abierto previo de `menuFileUrl` en `getById` va como bug
aparte.

**F-V1-006 · Rasgos dentro de una sección.** La carta exige su clave y, según el cuerpo, fotos de plato,
carta multilingüe; el QR y las métricas usan `step6Key`; experiencia tiene `meetingPointDirections`
dentro de `meetingPoint`. Se eligió el modelo de **rasgos** de C (`features: { id, entitlementKey }[]`
dentro de la capacidad) sobre la «capacidad hija» de B, porque un rasgo no aparece como sección del
editor y hereda AUSENTE por construcción. **Aplicado** en sub-specs 2 y 3 (DEC-FAC-020).

**F-V1-007 · QR impresos.** El sticker codifica `/q/<slug>` y la plataforma redirige a
`qr_codes.target_url`. Lo que hay que migrar es `target_url` de las filas GENERATED (menú y folleto);
la regex de repunte tiene que aceptar las dos formas; sin eso el primer cambio de slug deja el sticker
en 404. El 301 de `/carta/` sigue sirviendo para enlaces y códigos MANUAL. **Aplicado** en sub-spec 1,
discovery A y G-FAC-R2. Cuánto dura el 301 de `/carta/` se decide con la medición F-V1-026.

**F-V1-008 · Inventario de valores persistidos.** `entity_subscriptions` ya no existe en staging (la
borra la 0125, que en prod todavía no corrió). Faltaban `user_role_audit.role`, `ai_usage.feature`,
`quota_window`, `domain_event`, `email_outbox.payload`, `qr_codes.target_url` y `plan.name`; y el campo
del hash Redis del conjunto efectivo. **Aplicado**: inventario rehecho en discovery A §4-§5 con columna
de entorno y tratamiento, y criterio de aceptación con una consulta de verificación por fila. Las
ventanas de cuota abiertas: se migran en la misma migración si Q-01 = después; en staging se aceptan
reiniciadas si Q-01 = antes.

**F-V1-009 · `domain_event` append-only.** No se puede actualizar (trigger `extras/056`) y los lectores
filtran por vertical. Con Q-01 = antes, en prod no existe todavía y en staging se acepta la pérdida
(dato de prueba). Con Q-01 = después, lector tolerante `entityTypesForVertical('venue') →
['venue','gastronomy']` como único punto. **Se resuelve con Q-01**, sin pregunta propia.

**F-V1-010 · Lecturas estrictas de datos viejos.** Los renderers del outbox lanzan con una vertical
desconocida y hay filas programadas a días vista; el blob de `ai_settings` se parsea con
`partialRecord` sobre el enum de features (precedente HOS-1220: se cayó toda la IA). **Aplicado**: estas
conversiones van en la migración versionada del renombrado físico, no en el carril de seed; lectores
tolerantes durante un release; test que parsea un blob con una feature desconocida (la conducta de zod
4 queda a confirmar con ese test).

**F-V1-011 · Data-migrations históricas.** Importan `gastronomies`, `PermissionEnum.GASTRONOMY_*`,
`RoleEnum.GASTRONOMY_OWNER`: si se renombran, `@repo/seed` no compila. El checksum no se verifica.
**Aplicado**: se editan sólo imports y literales de identificador; criterio de aceptación con
typecheck de `@repo/seed` y corrida de las pendientes de prod (`0109`, `0110`, `0125`…) después del
renombrado en una base clonada de prod-main. Con Q-01 = antes, el paso 6 borra estos módulos.

**F-V1-012 · Ids de fixtures.** `deterministicFixtureId({ seedKey: 'gastronomy:${seedId}' })` y los
`seedId` llevan la palabra; cambiarlos cambia el UUID de cada ficha de ejemplo, FAQ y reseña, y la
carpeta de Cloudinary. **Pendiente de decisión Q-05** (congelar como claves opacas, recomendado, o
migrar los ids).

**F-V1-013 · Despliegue, partición y vuelta atrás.** `RENAME TO` rompe al código viejo en el acto; base,
API, web y admin se despliegan por separado y Coolify alterna contenedores; drizzle-kit `generate` es
interactivo; un 301 cacheado no se deshace en un rollback. **Aplicado lo técnico**: la migración física
se escribe a mano con snapshot regenerado (sin TTY no hay otra). **Pendiente de decisión Q-03**: ventana
de mantenimiento vs. compatibilidad de un release, partición lógica/física (cierra OD-06), 302 durante el
soak.

**F-V1-014 · Alojamiento y experiencia.** El catálogo dice «todas las propias de la vertical» sin
enumerarlas; alojamiento conserva registro propio y su gating público es por campo; reemplazar el
`false` de experiencia por el resolvedor publica indicaciones que HOS-1049 oculta a propósito. **Pendiente
de decisión Q-07.** Se aplicó lo que vale para cualquier respuesta: G-FAC-02 exige ≥1 capacidad
declarada por vertical con ficha.

**F-V1-015 · Posición del paso nuevo.** «Después del 4 y antes del 6» admite dos lugares y uno cambia
`NO_COVERAGE` por `NO_CAPABILITY`. **Aplicado** (DEC-FAC-019): AUSENTE es el **paso 4b** (depende sólo de
los hechos de la ficha); BLOQUEADA no es un paso nuevo: la clave de la capacidad (y de los rasgos que el
cuerpo pide) entra a `requiredKeys` del paso 6, una sola regla de «clave otorgada».

**F-V1-016 · Respuesta al dueño y PATCH.** La regla 3 del contrato prohíbe responder 404 a un rechazo
dirigido al dueño; y el PATCH de la ficha lleva rubros y `nightInfo` juntos mientras `loadFacts` lee el
estado previo. Entre C-005 (409) y B-007 (404 con razón) se eligió **409 `ALREADY_EXISTS` con
`details.reason: 'CAPABILITY_ABSENT'`**, que es lo que la tabla del contrato ya prescribe para un
conflicto de estado (precedente `COMMITMENT_TAKEN`); el camino ajeno sigue en 404 por el paso 4. La
capacidad se evalúa sobre los **rubros resultantes** del pedido, y se detecta por presencia de campos
no nulos. **Aplicado** (DEC-FAC-018, DEC-FAC-021).

**F-V1-017 · PURGED, backfill y concurrencia.** Las tablas nuevas con FK a una ficha ponen rojo a G-R9;
nadie decidió qué pasa en `PURGED`; el backfill no tiene carril; «≥1 rubro» sólo en servicio no
resiste dos requests concurrentes. **Aplicado**: sección «En PURGED» (la clasificación por rubro se
conserva; `nightInfo` se borra con el contenido en PB9/PB12); backfill en la migración versionada que
crea la estructura, incluidas las fichas con `deleted_at`; filas en `purged-closed-list.json`. La
garantía de «≥1» depende de **Q-06** (CHECK de columna, o trigger diferible).

**F-V1-018 · G-FAC-03.** Prohíbe importar el catálogo, que los sub-specs 5, 6 y 7 necesitan, y no ve
`listing.facets.includes('noche')`. **Aplicado**: partido en (a) «decidir secciones» (nadie fuera del
resolvedor compara contra un valor de rubro) y (b) «leer la relación» (lista cerrada de módulos).
Importar el catálogo para mostrar opciones queda permitido.

**F-V1-019 · Falta G-FAC-06.** El riesgo real es una ruta nueva que se olvida de declarar su capacidad.
**Aplicado**: G-FAC-06 con inventario cerrado `ruta → capacidad` (modelo `check-step5-declared.ts`), y
G-FAC-04 se amplía a `step6Key`, constantes y `enforceUserGate`/`readEffectiveKeys`.

**F-V1-020 · Manipulación de rubros.** Con «el tipo pertenece a alguno de los rubros», HELADERIA +
`{gastronomia, noche}` es válida; tildar todo es gratis y llena las colecciones. Además el admin no
tiene permiso fijado para editar rubros ni aviso al dueño. **Aplicado**: el permiso de editar rubros es el
mismo que el de editar el tipo, y el cambio por un tercero queda registrado en la línea de tiempo de la
ficha. **Pendiente de decisión Q-08** (matriz de rubros permitidos por tipo, aviso al dueño, uso de
REQUEST_FIX).

**F-V1-021 · El local de noche y los planes.** Lo que distingue premium de pro es casi todo carta; las
reseñas puntúan «comida» a un boliche y bajan su promedio. **Pendiente de decisión Q-09.**

### MEDIA

**F-V1-022 · Enums Postgres.** «o recreación» deja abierta la variante que borra filas (0135) o falla.
**Aplicado**: `ALTER TYPE … RENAME VALUE` para los valores y `RENAME TO` para los 4 enums
`gastronomy_*_enum`, SQL editado a mano; CHECKs con `DROP` → `UPDATE` → `ADD`; `ADD VALUE` de tipos
nuevos en una migración separada de cualquier uso.

**F-V1-023 · Extras.** `RENAME TO` conserva nombres viejos de índices y constraints; `032` saltea con un
NOTICE si la tabla no existe; `026` falla. **Aplicado**: la migración renombra cada índice, FK,
constraint y secuencia; `026` y `032` se reescriben en el mismo PR; criterio con consulta a
`pg_indexes`/`pg_constraint`. Que `032` falle en vez de NOTICE va como mejora aparte.

**F-V1-024 · Guards ciegos.** G2c, G-R9 y G1(b) tienen regex o listas con el nombre y un piso de archivos
que se sigue cumpliendo si no se actualizan. **Aplicado**: una mutación posterior al renombrado por guard
atado al nombre, en lista cerrada; G-FAC-R1 escanea `scripts/`.

**F-V1-025 · G-FAC-R1.** La allowlist dice cinco entradas y la mutación habla de «cuarta»; un patrón por
palabra no distingue `/es/gastronomia/` (retirado) de un valor que se queda. **Aplicado el diseño**:
patrón por forma de identificador + regla de ruta + regla de `gastro-`, exención por marcador en línea
contado con auto-chequeo exacto, número de entradas corregido. **El alcance final del patrón, pendiente
de Q-04 y Q-05.**

**F-V1-026 · Datos sin medir.** DEC-FAC-016 se apoya en «no hay datos reales». No es una decisión: es una
medición de sólo lectura en prod (fichas, suscripciones, QR y escaneos, roles, bookmarks) y en staging.
**Sin pregunta**: queda como paso previo en el handoff; necesita autorización para leer prod.

**F-V1-027 · Columna array.** «La base no puede expresar ≥1 sin trigger» es falso: `facets text[] NOT
NULL CHECK (cardinality(facets) >= 1 AND facets <@ ARRAY[...])` lo garantiza, viaja en la fila que
`loadFacts` ya lee y no suma tablas a G-R9. Cambia la parte de base de DEC-FAC-007. **Pendiente de
decisión Q-06.**

**F-V1-028 · G-FAC-05.** G1(b) sólo ve ternarios; las ramas reales son `&&`, `if` y lookups. **Aplicado**:
lista cerrada de archivos con predicado ancho (cierra el «Abierto»).

**F-V1-029 · Purgas.** La invalidación de cobertura sólo revalida fichas que bajan o se restauran; un
cambio Pro → Básico deja la carta paga en cache. «Colecciones afectadas» tiene que ser rubros viejos ∪
nuevos, más listado general y páginas de destino. **Aplicado**: el sub-spec 6 diseña la revalidación por
cambio de conjunto efectivo y fija criterios con test. El comportamiento actual va como bug aparte.

**F-V1-030 · G-FAC-02 regla 6.** El catálogo de claves no dice de qué vertical es cada clave.
**Aplicado**: la vertical se deriva del catálogo de planes de producción (la clave aparece sólo en planes
de esa vertical); sin atributo nuevo en el catálogo de claves.

**F-V1-031 · Ids tipados.** **Aplicado**: unión literal por vertical, `contentCapability` tipado con la
vertical de la ruta, el resolvedor lanza ante un id desconocido (como `UnknownStepKeyError`), G-FAC-02
exige id único por vertical.

**F-V1-032 · Regla 2 sin guard.** **Aplicado**: G-FAC-07 (ningún archivo de `packages/payments` importa
el catálogo de rubros ni lee la columna o tabla de rubros), como caso de G14.

**F-V1-033 · Nombres internos.** Tres choques: `venue` con `venueEvents`/`GastronomyVenueEvents*`/
`sports_venue` (OD-02); *facet* ya es «faceta de filtro» en el web (OD-07); *capacidad* ya es «clave
booleana» en HOS-1353 y en `NO_CAPABILITY`. Más: valores de rubro en español como identificadores y
`?rubro=` en una API en inglés. OD-02 tiene que cerrarse antes de escribir la migración física.
**Pendiente de decisión Q-04.**

**F-V1-034 · Ciclo de vida y estados degradados.** Faltaban: cambio de tipo en edición, quitar un rubro
que deja huérfano al tipo, ficha con cero rubros, catálogo que evoluciona, fallo del conjunto efectivo
en lo público (todo BLOQUEADA, cacheado) y en el editor. **Aplicado**: tabla de comportamiento en el
sub-spec 3 y reglas de edición en el 5; la validación tipo ↔ rubro corre sólo cuando cambian tipo o
rubros; `facets ≥ 1` entra al gate de publicación; la regla de «addon dependiente» se retira por YAGNI
(DEC-FAC-024).

**F-V1-035 · HOS-1362.** Si BLOQUEADA vive fuera de la cadena, cada superficie tiene que acordarse de usar
el conjunto efectivo del dueño. **Aplicado**: con F-V1-015 queda dentro del paso 6, que ya evalúa sobre
`subjectId`; el endpoint del mapa declara `listingAccess` y usa `subjectId`. Test: soporte Premium sobre
dueño Básico ve BLOQUEADA.

**F-V1-036 · `estandar`.** **Aplicado**: el servidor asigna el único rubro cuando la vertical tiene uno
solo y el cliente no manda; selector, columna y filtro sólo aparecen con más de un rubro (consulta al
catálogo, no un literal de vertical); G-FAC-02: una vertical con un solo rubro no lo declara público.

**F-V1-037 · El dueño ante BLOQUEADA y AUSENTE.** **Aplicado como propuesta objetable** (DEC-FAC-025):
BLOQUEADA = datos en sólo lectura + upsell + borrado permitido (borrar no construye); el hub distingue
«bloqueada con datos» de «bloqueada vacía»; el aviso de quitar un rubro muestra cuántos ítems quedan
guardados; aviso en el editor cuando una sección no se publica.

**F-V1-038 · `nightInfo` y tipos nuevos.** La entrada varía por noche, el precio en pesos envejece,
`min_age` 0 vs. `null`, contexto legal del +18, dress code traducible a mano, horario único; `PUB` se
pisa con `BAR` («Bar or pub» en el propio enum) y en portugués BOLICHE es «balada». **Aplicado**: las
listas planas de tipos se derivan del enum con un test. **Pendiente de decisión Q-10** (campos y `PUB`).

**F-V1-039 · Prompt del chat.** **Aplicado**: prompt neutral («local de comida o de salida») con
secciones de contexto armadas desde capacidades DISPONIBLES; el prompt guardado en `ai_settings` se
actualiza sólo si sigue igual al default viejo (no se pisa una edición del admin).

**F-V1-040 · JSON-LD.** **Aplicado**: `@type` por **tipo** descriptivo con un `Record` exhaustivo
(BAR/CERVECERIA → `BarOrPub`, BOLICHE → `NightClub`, CAFE → `CafeOrCoffeeShop`, HELADERIA →
`IceCreamShop`, PANADERIA → `Bakery`, resto → `Restaurant`); `hasMenu` sólo con `menu` DISPONIBLE.

**F-V1-041 · Colecciones.** **Aplicado**: el parámetro de rubro entra a la política de crawl y a la
canónica promovida; sitemap sólo con colecciones con ≥1 ficha publicada (precedente atracciones);
`noindex,follow` para colección vacía; copy de estado vacío en tres idiomas.

**F-V1-042 · Etiquetas por i18n.** **Aplicado** (DEC-FAC-022, aclara DEC-FAC-015): el slug es fijo en
español y sólo vive en la URL; la etiqueta visible sale de i18n; breadcrumb de la ficha sin rubro. Las
etiquetas en/pt de «Comer y salir» y de los rubros quedan como tarea de contenido del sub-spec 6.

### BAJA

**F-V1-043 · Cloudinary.** Lo subido sigue sirviéndose; quedan carpetas mixtas. **Pendiente de Q-05**
(recomendado: no se mueve, precedente HOS-831).

**F-V1-044 · Paginación.** `gastronomia/index.astro` emite canónica `…/page/N/` y no existe la ruta.
**Aplicado** en el sub-spec 6 (se crea `comer-y-salir/page/[page].astro`); va también como bug aparte
porque existe hoy.

**F-V1-045 · Detalles de UX.** **Aplicado**: G-FAC-R2 acepta redirects definidos en la página
(`publicar-restaurante`) además de `legacy-redirects.ts`; los redirects de `mi-cuenta` conservan ruta
profunda y query; entrada de What's New para dueños. El segmento `mi-cuenta/comercio/venue/` va en Q-04;
el nombre del plan en el resumen de tarjeta va en Q-02.

**F-V1-046 · Dos negocios en una dirección.** Pertenece al issue aparte de la regla de dirección. **Sin
pregunta acá**: el sub-spec 5 lo nombra como dependencia de producto.

**F-V1-047 · Entrada de rubros.** **Aplicado**: la entrada es `facets: slug[]`; la vertical la pone el
servidor.

**F-V1-048 · Presentación del catálogo.** **Aplicado**: dominio en `@repo/schemas`; presentación (slug,
`labelKey`, componente) en un `Record` exhaustivo del web por capacidad, cuya exhaustividad es el guard.
