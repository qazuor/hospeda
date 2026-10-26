---
title: Revisión vuelta 2 · Consolidado
linear: HOS-1787
created: 2026-10-25
base: origin/staging @ a44b8f05b4 (worktree hospeda-hos-1795-claude-md); prod contra origin/main
---

# Revisión vuelta 2 · Consolidado

Fusión de los tres informes de la vuelta 2 (A: datos y migración, 22 hallazgos; B: producto y edge cases,
26; C: arquitectura, 21). **69 hallazgos de origen → 58 consolidados.** Ids nuevos `F-V2-NNN`, ordenados por
severidad. Al fusionar severidades distintas queda la más alta; los re-graduados se explican abajo. La
columna «clase» dice **(a)** se arregla sin decisión del owner, **(b)** necesita al owner.

## Verificaciones hechas al consolidar

Se miró el código de cada reclamo CRÍTICA y ALTA (worktree `hospeda-hos-1795-claude-md` en
`origin/staging`, más `origin/main` para prod):

| reclamo | resultado | evidencia |
|---|---|---|
| la 0139 fija CHECK con `'gastronomy'` que la 0176 editada violaría | confirmado (A-001) | `0139_serious_vampiro.sql:95,167`; `0176_production_catalog_prices_addons.sql:69,73` (`'{gastronomy}'`). La `0132:14` tiene el mismo patrón pero ninguna migración editada inserta filas que lo toquen |
| ninguna otra migración entre 0125 y 0178 fija un literal que choque con una fila de una migración editada | confirmado | barrido `rg gastronom` de 0123…0178: 0126/0128/0135 recrean `permission_enum` (corren antes del renombrado, que hace `RENAME VALUE`); 0148, 0158, 0167 operan sobre los nombres viejos antes del renombrado; la columna `role` de 0144 es el rol del plan (`trial`), no `role_enum` |
| `amenities`/`features.applicable_verticals` existen en prod con filas `'gastronomy'` | confirmado (A-002) | `git grep` en `origin/main`: `0028_deep_machine_man.sql:1-2`; `0076-hos-1054-allergen-features.ts` y `0078-hos-1073-gastronomy-cuisine-features.ts` están en `origin/main` |
| prod ejecuta 0125…0178 **y** el renombrado en el paso 3 del corte, en una transacción | confirmado (A-003, A-005) | `HOS-1352/docs/16-fase-7-del-paraguas.md` paso 3 («migrar») y paso 6 (foto de la base ya cortada); `0126_cool_captain_flint.sql:10` («on a clean database the whole chain runs in one transaction») |
| el paso 6 compara `pg_trigger` y `extras/002` nombra el trigger por tabla | confirmado (A-004) | `scripts/cutover-v6/step-6/schema-fingerprint.ts:63-64`; `extras/002-set-updated-at.trigger.sql:52-55` |
| el paso 2b del corte es un backup completo que restaura el aborto | confirmado (sostiene la opción 1 de Q-12) | `16-fase-7…` fila 2b |
| `/qr/` responde 302 a propósito; `/carta/` estaba especificado en 301 | confirmado (B-001) | `apps/web/src/pages/qr/[slug].astro:117-130` |
| `menuUrl` es gratis en todo plan y vive en la sección `price` | confirmado (B-002 ≡ C-004) | `menu-projection.ts:101-103`; `listing-section-payload.ts:84` |
| el badge evalúa el turno nocturno contra el día de hoy | confirmado (B-003) | `apps/web/src/lib/gastronomy-hours.ts:102-107,127-131` |
| «Gastronomía»/«Gastronomia» como valor visible del menú | confirmado (B-004) | `packages/i18n/src/locales/es/nav.json:6`, `pt/nav.json:6` |
| la dimensión de rating de destino se llama `gastronomy` | confirmado (B-005) | `destination.rating.schema.ts:36-39` |
| `chat_gastronomy` no tiene reglas de edad ni alcohol | confirmado (B-007) | `packages/ai-core/src/engine/default-prompts.ts:212-214` |
| el mapa sección → campos vive sólo en el web | confirmado (C-001) | `apps/web/src/components/listing/editor/listing-section-payload.ts:47-90` |
| `deleteMenuFile` exige la clave de la carta | confirmado (C-002) | `deleteMenuFile.ts:39-44` (`operation: 'EDIT'`, `capabilities: ['manage_gastronomy_menu']`) |
| `READ_OWN_COMMERCIAL` lanza sin `step6Key`; `menuQr` lo usa con `menu_qr_scan_metrics` | confirmado (C-003) | `resolve-listing-access.ts:151-153`; `menuQr.ts:150-158` |
| HOS-1049 es un gate por clave con sólo lectura para el dueño bajado | confirmado (C-005) | `routes/experience/public/directions-projection.ts:1-35`; `apps/web/src/components/listing/editor/listing-edit-data.ts:102-114` |
| `standard` ya se compara en otro dominio | confirmado (C-006) | `apps/api/src/middlewares/rate-limit.ts:25,58` |
| `READ_PUBLIC` y `WRITE_ABOUT_LISTING` admiten a un ajeno sobre `PUBLISHED` | confirmado (C-008) | `listing-operation.ts:84-85` |
| en `CREATE` el paso 4 no corre y `facts` tiene que ser `null` | confirmado (C-009) | `resolve-listing-access.ts:125-126` |
| `getMenu`/`getDailySpecials`/`getEvents` protegidos no usan la cadena | confirmado (C-016) | `createCRUDRoute` + chequeo a mano `hasViewAll \|\| ownerId === actor.id` en los tres |
| el id de What's New `2026-09-03-ai-chat-gastronomy-experience` es `roles: ['USER']` y está en `main` | confirmado (B-014) | `whats-new.ts:878-881`; presente en `origin/main` |
| el QR impreso codifica `/qr/<slug>/` | confirmado (B-019) | `apps/web/src/pages/qr/[slug].astro:8` (`@route /qr/{slug}/`) |

**No verificado** (queda como verificación dentro de la tarea): A-007 (el conteo de 29 + 9 escritores
directos, no recontado); A-022 (si algún lector parsea el rol de la cookie de sesión contra `RoleEnum`, el
propio revisor lo marca no verificado); B-008 punto 4 (que el recálculo de experiencia sume `null` como 0);
C-017 punto 3 (la relación «HOS-1798 bloquea a HOS-1787» en Linear: no se consultó Linear, se toma del
revisor y del orquestador); el mecanismo interno de Postgres por el que un valor agregado con `ADD VALUE` a un
tipo **renombrado** (no creado) en la misma transacción sigue siendo inseguro (ver F-V2-005: se tomó la regla
documentada «el valor nuevo no se puede usar hasta el commit», que es la conservadora).

## Dónde se equivocaron los revisores

- **B-014 (ids de What's New) no necesita al owner.** El revisor lee el «precedente `0109`» del sub-spec 1
  como «los dueños ven una vez más el aviso», pero `0109-hos1418-whats-new-seen-ids-rename.ts` hace lo
  contrario: reescribe `users.settings.onboarding.whatsNew.seenIds` del id viejo al nuevo para que **nadie**
  vuelva a verlo. Renombrar el id con una migración de seen-ids encadenada (la nueva corre después de la 0109,
  que todavía no corrió en prod) no re-notifica a nadie y respeta «renombrar todo». Lo que estaba mal es la
  frase del sub-spec 1, que ya se corrigió (F-V2-029, DEC-FAC-054). Tampoco hace falta editar la 0109 para
  que mapee directo al id final, como propone A-017: la cadena 0109 → nueva lo resuelve.
- **C-003 (QR de mesa) no necesita una pregunta.** El rasgo `qr` sin clave fue un error de redacción de la
  vuelta 1, no una decisión del owner. La corrección que no cambia lo que se vende (el QR de mesa sigue en
  premium) es la conservadora; queda como DEC objetable (DEC-FAC-051). Si el owner quiere sumarlo a pro, es
  un cambio comercial aparte.
- **A-001 la plantea el revisor como opción entre dos, pero la opción 2 es la que DEC-FAC-029 descartó.** Se
  pregunta igual (Q-11) porque cambia la letra de una decisión del owner, con la opción 1 recomendada.

## Las dos preguntas que van primero

**Q-11 (editar también 0139) y Q-12 (qué es la marcha atrás)** modifican DEC-FAC-029 y DEC-FAC-030, que
gobiernan el PR físico del sub-spec 1, el bloqueante del corte. El resto de las preguntas es de producto y
no bloquea el sub-spec 1. Detalle en
[`../13-resolucion-vuelta-2/10-decisiones-del-owner.md`](../13-resolucion-vuelta-2/10-decisiones-del-owner.md).

## Tabla

| id | título | sev. | origen | clase | sub-spec |
|---|---|---|---|---|---|
| F-V2-001 | La 0176 editada viola un CHECK de la 0139, que no se edita | CRÍTICA | A-001 | b (Q-11) | 1 |
| F-V2-002 | `applicable_verticals` de amenities/features en prod guarda `'gastronomy'` y nadie lo convierte | CRÍTICA | A-002 | a | 1 |
| F-V2-003 | Prod **ejecuta** la migración de renombrado sobre la base vieja; falta el ensayo de ese camino | ALTA | A-003, A-019 | a | 1 |
| F-V2-004 | Objetos con nombre viejo creados por los extras: triggers duplicados y renombres incondicionales | ALTA | A-004, A-006 | a | 1 |
| F-V2-005 | «`ADD VALUE` en migración separada» no alcanza: todo corre en una transacción | ALTA | A-005 | a | 2, 4 |
| F-V2-006 | Al catálogo le falta qué campos son de cada sección | ALTA | C-001 | a | 2, 3, 5 |
| F-V2-007 | «Borrar en `locked`» no se puede expresar: la ruta no declara intención | ALTA | C-002 | a | 3, 5 |
| F-V2-008 | QR de mesa: el sub-spec lo regala y la ruta tira 500 | ALTA | C-003 | a (objetable) | 2, 3 |
| F-V2-009 | `menuUrl`, el enlace gratis a la carta, no está modelado | ALTA | B-002, C-004 | b (Q-13) | 2, 3, 5, 6 |
| F-V2-010 | G-FAC-04 rojo sobre código que DEC-FAC-033 promete no tocar; HOS-1049 mal descripto | ALTA | C-005 | a | 2, 3, guards |
| F-V2-011 | G-FAC-03(a) se ancla en los literales `food`/`nightlife`/`standard`, ya usados en otros dominios | ALTA | C-006, B-011 | a | guards |
| F-V2-012 | Secciones de alojamiento y experiencia sin enumerar: puntero circular | ALTA | C-007 | a | 2, 3 |
| F-V2-013 | `/carta/` → ficha como 301 queda grabado aunque el estado vuelva | ALTA | B-001 | a | 3, 6 |
| F-V2-014 | «Abierto ahora» miente para el horario típico de un boliche | ALTA | B-003 | a | 4, 6 |
| F-V2-015 | G-FAC-R1 no puede quedar verde y no ve el texto que lee el visitante | ALTA | A-017, B-004, B-005 | a | 1, guards |
| F-V2-016 | Todo el embudo le habla a un restaurante | ALTA | B-006 | b (Q-20) | 6 |
| F-V2-017 | El chat de IA recibe `nightInfo` sin reglas de edad ni alcohol | ALTA | B-007 | a | 6 |
| F-V2-018 | `business_lines NOT NULL` sin default rompe los escritores directos | MEDIA | A-007 | a | 2 |
| F-V2-019 | La ventana de staging no apaga la API vieja ni sus crons | MEDIA | A-008 | a | 1 |
| F-V2-020 | La «migración inversa ensayada» no puede deshacer el catálogo | MEDIA | A-009 | b (Q-12) | 1 |
| F-V2-021 | Tablas de IA y de auditoría con la vertical en texto, fuera del inventario | MEDIA | A-011 | a | 1 |
| F-V2-022 | La regla tipo ↔ rubros quedó fuera del CHECK: carrera entre dos PATCH | MEDIA | A-012, C-010 | a | 2 |
| F-V2-023 | Nada garantiza que el purge limpie las columnas nuevas de `nightInfo` | MEDIA | A-014 | a | 4, guards |
| F-V2-024 | Reseñas: el formulario no pide dimensiones y el recálculo las inventa | MEDIA | B-008 | b (Q-16) | 6 |
| F-V2-025 | Estado de los rasgos cuando la sección está `locked` sin definir | MEDIA | B-009 | a | 3 |
| F-V2-026 | «De noche» y «18 para BOLICHE» escritos como lógica por rubro y por tipo | MEDIA | B-010, C-012 | a | 2, 4, 6 |
| F-V2-027 | Comodidades y características son de cocina | MEDIA | B-012 | b (Q-17) | 6 |
| F-V2-028 | `BAR`/`PUB`/`CERVECERIA` se pisan y la descripción no se ve | MEDIA | B-013 | b (Q-18) | 2, 4 |
| F-V2-029 | Renombrar ids de What's New publicados re-notificaría a todos | MEDIA | B-014 | a (revisor equivocado) | 1 |
| F-V2-030 | Faltan los textos es/en/pt de la vertical, los rubros, las colecciones y el dress code | MEDIA | B-015, B-022 | b (Q-19) | 6 |
| F-V2-031 | Bajar de plan no avisa qué contenido deja de verse | MEDIA | B-016 | b (Q-15) | 5 |
| F-V2-032 | El aviso in-app de «te cambiaron los rubros» no tiene vida útil | MEDIA | B-017 | a | 7 |
| F-V2-033 | Admin: `nightInfo` sin decidir; el criterio contradice REQUEST_FIX | MEDIA | B-018 | a | 7 |
| F-V2-034 | El 4b le respondería 409 a un visitante | MEDIA | C-008 | a | 3 |
| F-V2-035 | El 4b en el alta no tiene dónde correr; falta la firma | MEDIA | C-009 | a | 3 |
| F-V2-036 | El validador sólo dice «inválido»; la UI necesita las opciones | MEDIA | C-011 | a | 2, 5, 7 |
| F-V2-037 | Ids de rasgo y claves de `typeRules` tipados `string` | MEDIA | C-013 | a | 2, 3 |
| F-V2-038 | El catálogo de alojamiento no tiene consumidor y puede divergir | MEDIA | C-014 | a | guards |
| F-V2-039 | El punto de extensión «límite de rubros por plan» no tiene contrato | MEDIA | C-015 | a | 2 |
| F-V2-040 | Lecturas protegidas de carta, menú del día y eventos fuera de la cadena | MEDIA | C-016 | a | 3 |
| F-V2-041 | Orden de los hijos con dos dependencias al revés y un bloqueante sin registrar | MEDIA | C-017 | a | spec, 2, 4 |
| F-V2-042 | El contenido de una sección `absent` queda inalcanzable para su dueño | MEDIA | C-018 | b (Q-14) | 3, 5 |
| F-V2-043 | Bases no reseteadas: el renombrado falla con un error críptico | BAJA | A-010 | a | 1 |
| F-V2-044 | El test «`CASE` del backfill = `typeRules`» se pone rojo con tipos nuevos | BAJA | A-013 | a | 2 |
| F-V2-045 | Forma de `nightInfo` incompleta: i18n, CHECK, fecha del precio, rango de edad | BAJA | A-015, B-021 | a | 4 |
| F-V2-046 | `{food, food}` pasa el CHECK y el validador | BAJA | A-016 | a | 2 |
| F-V2-047 | La spec cita una «guarda de inmutabilidad de migraciones» que no existe | BAJA | A-018 | a | 1 |
| F-V2-048 | El orden `RENAME VALUE` / `UPDATE target_url` decide si se migra algo | BAJA | A-020 | a | 1 |
| F-V2-049 | Restos de vocabulario, contradicciones y superficies que no existen | BAJA | A-021, B-024 | a | varios |
| F-V2-050 | La cookie de sesión puede traer `GASTRONOMY_OWNER` unos minutos | BAJA | A-022 | a (no verificado) | 1 |
| F-V2-051 | El QR impreso codifica `/qr/<slug>/`, no `/q/<slug>` | BAJA | B-019 | a | 1, guards |
| F-V2-052 | Un local con slug `rubro` (o `page`) pierde su `/carta/` | BAJA | B-020 | a | 6 |
| F-V2-053 | `publicar-restaurante` ya tiene un 301: dos saltos | BAJA | B-023 | a | 1 |
| F-V2-054 | El tour es por rol y su paso del QR puede no tener target | BAJA | B-025 | a | 5 |
| F-V2-055 | El rechazo del validador no tiene contrato de error ni mensaje | BAJA | B-026 | a | 2, 5 |
| F-V2-056 | Cita vieja de `entitlement-step.ts` y N lecturas del conjunto efectivo | BAJA | C-019 | a | 3 |
| F-V2-057 | G-FAC-07 mira sólo `packages/payments` | BAJA | C-020 | a | 6, guards |
| F-V2-058 | «Section» ya significa otra cosa en el admin y en el web | BAJA | C-021 | a | 2 |

**Por severidad**: 2 CRÍTICA · 15 ALTA · 25 MEDIA · 16 BAJA. **Por clase**: 48 (a) · 10 (b).

**Fusiones** (11): B-002+C-004; C-006+B-011; A-012+C-010; A-017+B-004+B-005; A-021+B-024; B-010+C-012;
A-003+A-019; A-004+A-006; A-015+B-021; B-015+B-022.

**Re-graduados**: F-V2-003 sube A-019 (BAJA) por fusión; F-V2-004 sube A-006 (MEDIA); F-V2-011 sube B-011
(MEDIA); F-V2-015 sube A-017 (MEDIA); F-V2-030 sube B-022 (BAJA). Ninguno bajó.

---

## Hallazgos

### CRÍTICA

**F-V2-001 · La 0176 editada viola un CHECK de la 0139.** La 0139 crea `ck_addon_product_compatible_verticals`
y `ck_promo_code_verticals` con `'gastronomy'` escrito literal y sin `'venue'`; la 0176 editada insertaría
`'{venue}'` y `db:migrate` desde cero corta ahí: CI, plantilla, reset de staging y **prod en el paso 3 del
corte**. Regla general en vez de lista de números: se edita toda migración entre 0125 y la de renombrado que
fije un literal de vertical del que dependa una fila insertada por una migración editada (hoy, sólo la 0139;
la 0132 por coherencia). **Pregunta Q-11** porque cambia la letra de DEC-FAC-029.

**F-V2-002 · `applicable_verticals` en prod.** Las columnas existen en prod desde la 0028 y las data-migrations
0076 y 0078 (ya corridas en prod) escribieron `'gastronomy'`; el enum Zod `APPLICABLE_VERTICALS` es estricto.
Después del corte, o 500 en toda lectura del catálogo de amenities/features (incluido alojamiento) o un
editor de local nuevo sin comodidades ni alérgenos. Staging reseteado no lo muestra. **Aplicado**:
`array_replace` en la migración versionada (carril 1), dual-write de los 42 JSON del baseline, fila nueva en
discovery A §5 con entorno **ambos** y su `count(*) = 0`.

### ALTA

**F-V2-003 · Prod ejecuta el renombrado.** El corte no instala el baseline en prod: el paso 3 migra 0124 →
0178 + renombrado en una transacción, sobre datos y extras de la era 0124, y el paso 6 recién después toma la
foto. Con staging reseteado, prod es el único ambiente con esa historia. **Aplicado**: el criterio de
aceptación del sub-spec 1 es un **ensayo del paso 3 sobre un clon de prod-main** (cadena entera con las
migraciones editadas, `db:apply-extras`, `db:seed:migrate`, todos los `count(*) = 0` sobre ese clon,
incluido `cutover_v6_deleted_listing`, y el `compare` del paso 6); se anota como insumo del ensayo del corte
de HOS-1352. Corregidas las dos frases falsas («el baseline trae todo ya renombrado» para prod; «`domain_event`
no existe en prod»).

**F-V2-004 · Objetos de los extras.** `extras/002` crea `trg_set_updated_at_<tabla>` y, al reaplicarse tras el
`RENAME TO`, crea uno nuevo: prod queda con dos triggers por tabla y el `compare` del paso 6 falla después del
punto de no retorno. Y los índices/constraints/triggers de los extras existen en prod pero no en una base
desde cero, así que un `RENAME` incondicional rompe una de las dos. **Aplicado**: objetos de Drizzle con
`RENAME` directo; objetos de extras con `ALTER INDEX IF EXISTS … RENAME` y `DO $$ … IF EXISTS (pg_trigger /
pg_constraint)`; criterio con `pg_trigger` y `pg_type` además de `pg_indexes`/`pg_constraint`, y
`step-6 compare` en verde entre el clon migrado y una base desde cero.

**F-V2-005 · `ADD VALUE` en una transacción.** `drizzle-kit migrate` corre todas las pendientes en una
transacción; separar la migración no evita `unsafe use of new value`. **Aplicado** (DEC-FAC-045): ninguna
migración versionada usa `BOLICHE` ni `PUB` como valor del enum; toda comparación en SQL es sobre
`type::text` (el `CASE` del backfill y el `CASE` del CHECK de F-V2-022 lo son). Los usos reales viven en el
seed, que corre en otro proceso. Criterio: `db:migrate` desde cero con todas las pendientes juntas.

**F-V2-006 · Campos por sección.** Detección del PATCH, proyección pública y editor necesitan «qué campos son
de cada sección», y hoy esa lista existe sólo en el web (`LISTING_SECTION_PAYLOAD_KEYS`). Sin ella, tres
listas de los mismos campos en tres paquetes. **Aplicado** (DEC-FAC-040): `fields` tipado contra el schema de
update de la vertical en la definición de la sección; un detector genérico `sectionsTouchedByBody` en
`@repo/schemas`, un proyector genérico y el mapa del editor derivados; G-FAC-02 regla 11 («cada campo del
schema de update pertenece a exactamente una sección»). Los campos traducibles de una sección no común son de
esa sección, no de `translations`.

**F-V2-007 · Intención de la ruta.** DEC-FAC-025 dice que se puede borrar en `locked`, pero la ruta sólo
declara la sección y su clave entra al paso 6 para cualquier operación: hoy `deleteMenuFile` responde 403 al
dueño bajado. **Aplicado** (DEC-FAC-041): `listingSection: { id, intent: 'read' | 'write' | 'delete' }`; `read`
y `delete` corren sólo el 4b, `write` corre 4b + clave en el paso 6; un PUT de reemplazo con cuerpo vacío es
`delete`; G-FAC-06 exige `delete` en toda ruta `DELETE` o de vaciado.

**F-V2-008 · QR de mesa.** El sub-spec 2 declaraba el rasgo `menu.qr` sin clave y el 3 le quitaba el
`step6Key` a `menuQr`, cuya operación `READ_OWN_COMMERCIAL` lanza sin él (500); y «arreglarlo» con la clave de
la carta lo pasa de premium a pro sin decisión. **Aplicado como objetable** (DEC-FAC-051): `menu.qr` lleva
`menu_qr_scan_metrics` (igual que `qrMetrics`, G-FAC-02 admite dos rasgos con la misma clave); `menuQr` deja
`READ_OWN_COMMERCIAL` por una operación de la cadena que no exige `step6Key` y declara sección + rasgo. Nada
cambia en lo que se vende.

**F-V2-009 · `menuUrl`.** El enlace externo es gratis en todo plan por diseño, vive en la sección común
`price`, sale por la ficha, el chat y el folleto. En `menu` (con clave) se lo saca a todos los básicos; en
`price` se le filtra a un boliche. **Pregunta Q-13** (si el enlace es del rubro `food` o común). Se aplicó lo
que vale para cualquier respuesta: `menuUrl` entra a la tabla de lectores del sub-spec 3.

**F-V2-010 · G-FAC-04 y DEC-FAC-033.** Declarar la clave de un rasgo o sección de experiencia o alojamiento
pone rojo a G-FAC-04 en archivos que DEC-FAC-033 dice no tocar; y HOS-1049 **no** oculta nada: es un gate por
clave con sólo lectura para el dueño bajado, idéntico a un rasgo `locked`. **Aplicado** (DEC-FAC-049):
experiencia **migra** su gate al resolvedor en este trabajo (salida idéntica, probada por el test de no
regresión); alojamiento declara sus secciones **con** clave y G-FAC-04 lleva una lista cerrada y contada de
archivos de alojamiento exentos que el hijo 8 vacía; el `Record` de `chat.ts` se migra entero. La premisa de
DEC-FAC-033 queda corregida por DEC nueva.

**F-V2-011 · G-FAC-03(a) anclado en el texto.** `food` (POI, dimensión de reseña del propio venue),
`nightlife` (rating de destino, POI, categoría de posts) y `standard` (rate limit, sponsorship, tipo de
cambio) ya son claves de objeto y comparaciones en ~15 archivos ajenos: el guard nace rojo y se angosta hasta
dejar pasar lo que debía frenar (precedente G1(b)). **Aplicado** (DEC-FAC-043): el guard se ancla en el
**operando tipado** `BusinessLine` vía el checker de TS, nunca en el literal; prohíbe importar las constantes
de valor fuera de la lista (b) y del mapa de slugs; mutación positiva y control negativo (`rate-limit.ts`
verde).

**F-V2-012 · Secciones sin enumerar.** El sub-spec 2 apunta al 3 y el 3 no las enumera. **Aplicado**: tabla
cerrada por vertical en el sub-spec 2 (id, común, clave, rasgos, grupo), con los ids reales de
`experience-editor-sections.ts` y `accommodation-editor-sections.ts` (sin renombrar `photos`, que es del hijo 8).

**F-V2-013 · `/carta/` en 301.** Los tres disparadores (plan, rubro, carta vacía) son reversibles y un 301
queda en el teléfono del comensal; la propia `/qr/` usa 302 por esa razón. Con el básico sin la clave de la
carta, es el caso común. **Aplicado** (DEC-FAC-042): **302 con `Cache-Control: no-store`**, test del código y
del header; el 301 queda sólo para lo permanente (legacy tras el soak).

**F-V2-014 · «Abierto ahora».** El turno nocturno se evalúa contra el día de hoy («todo turno nocturno se
repite en días consecutivos»): falso para viernes y sábado. Domingo 03:00 dice «Cerrado» en el pico; viernes
03:00, «Abierto» con la persiana baja. Y en una colección cacheada el badge queda congelado. **Aplicado**
(DEC-FAC-052): pertenencia al turno contra el **día en que empieza** (hoy `[open, 24:00)` y ayer `[00:00,
close)` si ayer envuelve), con test del calendario viernes/sábado; en HTML cacheado el badge se calcula en el
cliente.

**F-V2-015 · G-FAC-R1.** Tres agujeros: (1) archivos que **tienen** que nombrar la palabra vieja (la propia
migración de renombrado y su snapshot, las data-migrations del seed) no entran en ninguna de las cinco
exenciones y el auto-chequeo exacto prohíbe una sexta; (2) usos de `gastronomy` como **tema** (dimensión de
rating de destino, persistida en prod; tile de la home; `footer.categoryGastronomy`) que la exención (a) no
lista; (3) «Gastronomía»/«Gastronomia» visibles en los valores i18n (`nav.json`, mi-cuenta, billing, footer,
título del listado) no matchean ninguna regla y la exención (b) los ampararía como «prosa». **Aplicado**
(DEC-FAC-044): «fuera del escaneo» suma la migración de renombrado con su `meta/` y los módulos de
data-migration (historia que borra el paso 6); (a) pasa a «gastronomía como tema» con lista cerrada de
archivos, y la dimensión de destino **no** se renombra ni se migra; (b) se aclara a «la palabra como tema y la
etiqueta del rubro `food`» (lo que nombra a la vertical se renombra); regla 5 nueva sobre valores de
`packages/i18n` y `packages/notifications` con lista contada de claves permitidas. Los textos nuevos van a
Q-19.

**F-V2-016 · Embudo de restaurante.** Landing, venta, precios, publicar, footer, ícono y los correos de trial
dicen carta, platos y restaurante; un boliche entiende que la plataforma no es para él. Los correos son por
usuario + vertical, no por ficha: no pueden ramificar por rubro. **Pregunta Q-20.**

**F-V2-017 · Chat sin reglas de edad.** `nightInfo` (con `min_age`) entra al contexto del chat y las reglas
duras sólo cubren alérgenos y precios. **Aplicado** (DEC-FAC-053): cláusula nueva en `DEFAULT_RULES.chat_venue`
(no afirmar ingreso por debajo de la edad declarada, no dar consejos para eludirla, repetir textual la edad y
el texto legal, derivar al local), movida **entre** prompt y reglas para respetar
`default-rules-equivalence.test.ts`.

### MEDIA

**F-V2-018 · Default de `business_lines`.** `NOT NULL` sin default rompe los escritores directos (tests,
fábricas, seed, herramientas del corte; el revisor contó 29 + 9, no recontado) y el `ADD COLUMN … NOT NULL`
falla sobre una tabla con filas. **Aplicado** (DEC-FAC-046): `DEFAULT ARRAY['standard']` generado desde el
catálogo para las verticales de un solo rubro; `venues` sin default (el rubro de un local no se adivina; sus
escritores directos se ajustan); secuencia del `ADD COLUMN` escrita (nullable → backfill → `SET NOT NULL` →
`ADD CHECK`); G-FAC-09 pasa a «ninguna validación de rubros fuera del validador» en vez de «todo camino lo
llama».

**F-V2-019 · API vieja durante el reset.** Entre el reset y el deploy, la API vieja sirve 500 y sus crons
escriben valores viejos. **Aplicado**: paso nuevo en la ventana, apagar la API (contenedor, crons y webhook)
antes del reset y migrar con `--pull` sobre el commit de la imagen nueva, verificado (como el paso 3 del corte).

**F-V2-020 · Marcha atrás.** Con el catálogo nacido `venue`, una inversa choca con `extras/041`, G18 y las FK; y
Drizzle sólo va hacia adelante. **Pregunta Q-12** (revert + reset en staging, backup del corte en prod).

**F-V2-021 · Tablas de IA y auditoría.** `ai_prompt_versions.feature` (curada), `ai_conversations.feature`,
`ai_request_log.feature`, `social_audit_log.entity_type` existen en prod. **Aplicado**: filas en discovery A §5:
`ai_prompt_versions` MV en carril 1; `ai_conversations` y `ai_request_log` MV; `social_audit_log` NM
explícito.

**F-V2-022 · Tipo ↔ rubros en base.** La matriz `allowed` es estática y quedó sólo en el validador: dos PATCH
concurrentes terminan en BOLICHE `{food}` o HELADERIA `{food, nightlife}` para siempre. **Aplicado**
(DEC-FAC-047): el generador suma al CHECK de `venues` el `CASE type::text WHEN … THEN business_lines <@ ARRAY[…]
… END`; G-FAC-01 lo compara con el catálogo; el validador sigue para el error tipado.

**F-V2-023 · Purge de `nightInfo`.** El purge limpia con un `SET` escrito a mano por vertical; G-R9 cuenta
tablas, no columnas. **Aplicado**: guard nuevo **G-FAC-10** (toda columna de una tabla de ficha está en el
`SET` del purge o en una lista cerrada y contada de columnas de sistema/clasificación).

**F-V2-024 · Reseñas.** El formulario ya sólo pide la calificación general; nadie muestra dimensiones; el
recálculo imputa la general a las cuatro dimensiones y vive en la base compartida con experiencia; la cuarta
dimensión es `value`. **Aplicadas las correcciones factuales**; **pregunta Q-16** (si el formulario empieza a
pedir dimensiones).

**F-V2-025 · Rasgos con sección `locked`.** La regla no decía qué valen. **Aplicado** (DEC-FAC-051): sección
`locked` → todo rasgo `locked`; fila en la matriz de tests.

**F-V2-026 · Presentación por datos.** «Híbrida» es preguntar por dos rubros y «18 para BOLICHE» es un `if` de
tipo. **Aplicado** (DEC-FAC-050): la sección declara `headingWhenMultiLineKey` («si la ficha tiene más de un
rubro con secciones propias no `absent`, esta sección se titula con esta clave»); el tipo declara
`fieldDefaults` (`{ minAge: 18 }` en BOLICHE), que el editor ofrece como sugerencia. El componente pregunta al
resolvedor, no a los rubros.

**F-V2-027 · Catálogo de cocina.** **Pregunta Q-17.**

**F-V2-028 · BAR/PUB/CERVECERIA.** **Pregunta Q-18** (la frontera). Se aplicó lo técnico: superficie y claves
`venue.typeDescriptions.*`; las dos tablas de labels (web y admin) entran juntas.

**F-V2-029 · What's New publicados.** **Aplicado** (DEC-FAC-054, revisor equivocado sobre la necesidad de
preguntar): se renombran los ids y una data-migration de seen-ids encadenada a la 0109 los reescribe; mismo
trato para el mapa de progreso de tours si guarda ids (verificar en la tarea).

**F-V2-030 · Textos.** **Pregunta Q-19** (tabla propuesta por B, con el dress code de B-022).

**F-V2-031 · Aviso de bajada de plan.** **Pregunta Q-15.**

**F-V2-032 · Vida útil del aviso de rubros.** **Aplicado** (DEC-FAC-056): ventana de 30 días (como
`LIFT_NOTICE_WINDOW_DAYS`), colapsa al último cambio, desaparece si el dueño vuelve a editar los rubros; con una
fix request abierta (`ALREADY_OPEN`) el admin no puede abrir otra, y se dice.

**F-V2-033 · Admin y `nightInfo`.** **Aplicado** (DEC-FAC-057): el admin no muestra `nightInfo` (como no muestra
la carta); el PATCH de admin ya pasa por la cadena (verificado por C), así que el 4b lo frena igual; REQUEST_FIX
es **política** (el permiso es el mismo), y el criterio del sub-spec 7 se reescribe sin contradicción.

**F-V2-034 · 4b a un ajeno.** **Aplicado** (DEC-FAC-048): `SECTION_ABSENT` sólo si el paso 4 resolvió «dueño»
(incluida la acción 15); a un sujeto ajeno, `NOT_FOUND`.

**F-V2-035 · 4b en el alta.** **Aplicado** (DEC-FAC-048): firma `sections?: { requested: { id, intent }[];
resultingBusinessLines }` calculada por el middleware (hechos + cuerpo; sólo cuerpo en `CREATE`); el 4b corre
también en `CREATE`; la razón nueva entra a `ListingAccessResult` y al contrato.

**F-V2-036 · Opciones del validador.** **Aplicado** (DEC-FAC-047): `resolveBusinessLineOptions({ vertical, type,
selected }) → { value, selectable, reason? }[]`, mismo módulo y mismas reglas que el validador; G-FAC-09 lo
cuenta.

**F-V2-037 · Ids tipados.** **Aplicado**: `SectionTraitId<V, S>`, `BusinessLineValue<V>`, `Record<ListingTypeOf<V>,
…>`; `createProtectedRoute` se niega a levantar una ruta con sección o rasgo inexistente; schema de entrada por
vertical (400 por forma).

**F-V2-038 · Catálogo de alojamiento.** **Aplicado**: G-FAC-08 suma «el conjunto de ids de alojamiento del
catálogo es igual al de `accommodation-editor-sections.ts`, con orden y grupo».

**F-V2-039 · Límite por plan.** **Aplicado**: contrato escrito en el sub-spec 2 (limit de scope `vertical` en el
paso 7 con `requested = |rubros resultantes|`; `limit` recibe el cuerpo; la bajada nunca toca rubros; los
caminos sin cadena no lo aplican). Sin implementar.

**F-V2-040 · Lecturas protegidas.** **Aplicado** (DEC-FAC-055): `getMenu`, `getDailySpecials`, `getEvents` pasan a
la cadena (`READ_OWN`, intención `read`); el acceso del personal con `VIEW_ALL` no cambia, por la acción 15 o
conservando el atajo, a fijar con V8 (HOS-1362) y con test; G-FAC-06 exige que la ruta **use** la cadena.

**F-V2-041 · Orden de los hijos.** **Aplicado** (DEC-FAC-045): los valores `PUB`/`BOLICHE` (enum TS, `ADD
VALUE`, etiquetas) pasan al sub-spec 2; el 4 depende de 2 **y** 3; HOS-1798 bloquea el arranque y HOS-1797 el
sub-spec 6, en `spec.md`.

**F-V2-042 · Contenido `absent`.** **Pregunta Q-14** (mismo trato que `locked` o inalcanzable).

### BAJA

**F-V2-043** (A-010) **Aplicado**: primera sentencia de la migración, `RAISE EXCEPTION` si existe la fila
`vertical.id = 'gastronomy'` («esta base necesita reset, DEC-FAC-029»); en la ventana, resetear `hospeda_dev`
antes de reconstruir la plantilla.
**F-V2-044** (A-013) **Aplicado**: el test compara contra la lista fija de valores del enum en esa migración y
exige `ELSE`.
**F-V2-045** (A-015, B-021) **Aplicado** (DEC-FAC-058): `entry_note_i18n` y `dress_code_note_i18n` como
columnas, en el purge; CHECK `entry_price_from >= 0` y sólo con `paid`; `min_age` entre 13 y 30; la fecha se
mueve sólo si el valor cambia; `paid` → otro valor borra el precio; `min_age` es la menor y la diferencia va a
la nota; sin ocultar precios viejos (la fecha ya lo dice).
**F-V2-046** (A-016) **Aplicado** (DEC-FAC-047): regla «sin repetidos» y orden estable antes de escribir.
**F-V2-047** (A-018) **Aplicado**: frase corregida; G18 no cambia (compara el acumulado con el código).
**F-V2-048** (A-020) **Aplicado**: primero los `UPDATE` de datos, después los `RENAME VALUE`; el `count = 0`
sobre `target_url` lo prueba.
**F-V2-049** (A-021, B-024) **Aplicado**: vocabulario de G-FAC-03(b)/07 sin relación ni tabla; seed del
sub-spec 2 sin data-migration ambigua; índice del decision log marca DEC-FAC-004, 014, 016, 023 y 033; 0177 →
0178; frases de colección por ciudad y páginas de destino que listan locales retiradas; id del paso del tour
fijado en un lugar.
**F-V2-050** (A-022) **Aplicado como verificación**: la tarea verifica si algún lector parsea el rol de la
cookie contra `RoleEnum`; si parsea, se documenta (la ventana del corte ya dura más que la cache de 5 min).
**F-V2-051** (B-019) **Aplicado**: `/qr/<slug>/` en sub-spec 1, discovery A y G-FAC-R2.
**F-V2-052** (B-020) **Aplicado**: slugs reservados de ficha (`rubro`, `page`, y los segmentos de las demás
verticales) en el generador, con test.
**F-V2-053** (B-023) **Aplicado**: destino `PUBLISH_PAGE_PATH_BY_VERTICAL.venue`; la página conserva su 301
apuntando directo al destino nuevo; los dos saltos de clientes con el 301 viejo en caché se aceptan por escrito.
**F-V2-054** (B-025) **Aplicado**: el paso del QR se salta si su target no está, con test.
**F-V2-055** (B-026) **Aplicado**: 400 `VALIDATION_ERROR` con `details.field = 'businessLines'` y razón; claves
`zodError.venue.businessLines.*` en es/en/pt; fila en `error-contract.md`.
**F-V2-056** (C-019) **Aplicado**: cita `entitlement-step.ts:21-38`; predicado puro `isGranted({ effective, key })`
usado por el paso 6 y el resolvedor sobre un conjunto ya leído.
**F-V2-057** (C-020) **Aplicado**: la comparativa por rubro se arma en el web con `@repo/schemas`; G-FAC-07 suma
`apps/api/src/routes/plan-catalog/` y las rutas `billing-*`.
**F-V2-058** (C-021) **Aplicado** (DEC-FAC-059): nota de vocabulario; la propiedad de ruta sigue `listingSection`.
