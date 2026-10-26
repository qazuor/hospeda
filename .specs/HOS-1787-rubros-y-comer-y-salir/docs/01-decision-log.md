---
title: Decision log — HOS-1787
linear: HOS-1787
statusSource: linear
created: 2026-10-25
status: CURRENT
---

# 01 · Decision log

Reglas: cada decisión tiene id `DEC-FAC-NNN`, fecha, quién decidió, qué, por qué y qué se
descartó. **Nunca se reescribe una decisión**: si cambia, se agrega una nueva y la vieja queda
marcada `SUPERSEDED por DEC-FAC-NNN`. **Vocabulario**: las entradas hasta DEC-FAC-025 usan el vocabulario
original (`ListingFacet`, «capacidad», `AUSENTE/BLOQUEADA/DISPONIBLE`, rubros `gastronomia/noche/estandar`);
DEC-FAC-031 fija los nombres finales y su equivalencia, y es lo que rige en sub-specs y guards. Las que nacen de una vuelta de revisión citan el hallazgo
(`F-VN-NNN`).

| id | estado | resumen |
|---|---|---|
| DEC-FAC-001 | VIGENTE | Una sola vertical; nada de vertical «Noche» |
| DEC-FAC-002 | VIGENTE | 3 planes comunes en escalera; sin planes por familia |
| DEC-FAC-003 | VIGENTE | Los rubros son gratis, por ficha, del lado de Verticales; billing no los ve |
| DEC-FAC-004 | VIGENTE (el valor `estandar` SUPERSEDED por DEC-FAC-031: `standard`) | Mecanismo genérico para toda vertical con ficha; `estandar` en las que no se dividen |
| DEC-FAC-005 | VIGENTE | Varios rubros por ficha (≥1); capacidades y colecciones = unión |
| DEC-FAC-006 | VIGENTE | Sin addon ni límite de rubros |
| DEC-FAC-007 | VIGENTE (la parte de base SUPERSEDED por DEC-FAC-026) | Catálogo de rubros en código + espejo en base |
| DEC-FAC-008 | VIGENTE | El rubro filtra capacidades de contenido, no claves de entitlement |
| DEC-FAC-009 | VIGENTE | Resolvedor de tres estados: AUSENTE / BLOQUEADA / DISPONIBLE |
| DEC-FAC-010 | VIGENTE (la regla de validación SUPERSEDED por DEC-FAC-034) | Cada tipo descriptivo pertenece a ≥1 rubro; preselección y validación |
| DEC-FAC-011 | VIGENTE | Cada rubro es su colección pública; URL de ficha independiente del rubro |
| DEC-FAC-012 | VIGENTE | Spec propia, implementable ya desde `staging` |
| DEC-FAC-013 | SUPERSEDED por DEC-FAC-031 | Nombres: `ListingFacet` / «rubro» / segmento `/rubro/` |
| DEC-FAC-014 | VIGENTE (el 301 SUPERSEDED por DEC-FAC-030: 302 durante el soak, 301 después) | Público «Comer y salir», `/comer-y-salir/`, 301 desde `/gastronomia/` |
| DEC-FAC-015 | VIGENTE (los valores internos SUPERSEDED por DEC-FAC-031; los tipos y rubros por tipo, por DEC-FAC-034 y 036) | Rubros iniciales `gastronomia` y `noche`, capacidades y tipos |
| DEC-FAC-016 | VIGENTE (`entity_subscriptions.entity_type` sale de la lista: la tabla la borra la 0125, discovery A §5) | Renombrado TOTAL `gastronomy` → `venue` |
| DEC-FAC-017 | VIGENTE | Paraguas + hijos; el renombrado bloquea a todos; regla de dirección aparte |
| DEC-FAC-018 | VIGENTE, aceptada (la razón SUPERSEDED por DEC-FAC-031: `SECTION_ABSENT`) | AUSENTE frente al dueño: 409 `ALREADY_EXISTS` con `reason: CAPABILITY_ABSENT` |
| DEC-FAC-019 | VIGENTE | AUSENTE es el paso 4b; BLOQUEADA entra a `requiredKeys` del paso 6 |
| DEC-FAC-020 | VIGENTE (el rasgo `menu.file` SUPERSEDED por DEC-FAC-062: se retira) | Rasgos dentro de una capacidad para las claves que viven dentro de una sección |
| DEC-FAC-021 | VIGENTE | La capacidad se detecta por campos no nulos y se evalúa sobre los rubros resultantes |
| DEC-FAC-022 | VIGENTE | Aclara DEC-FAC-015: la etiqueta visible del rubro sale de i18n; el slug sólo es URL |
| DEC-FAC-023 | VIGENTE (el código 301 SUPERSEDED por DEC-FAC-042: 302 `no-store`) | `/carta/` sin carta disponible redirige a la ficha, no 404 |
| DEC-FAC-024 | VIGENTE | Se retira la regla de «addon dependiente» (YAGNI) |
| DEC-FAC-025 | VIGENTE, aceptada | BLOQUEADA para el dueño: sólo lectura + upsell + borrado permitido |
| DEC-FAC-026 | VIGENTE | Rubros en columna `business_lines text[]`; restricciones declaradas y un validador genérico |
| DEC-FAC-027 | VIGENTE | OD-14 cerrada sin medir: el owner confirma que no hay fichas reales de gastronomía en prod |
| DEC-FAC-028 | VIGENTE | El renombrado cae antes del corte V6 y es bloqueante del corte |
| DEC-FAC-029 | VIGENTE (lista de migraciones editadas AMPLIADA por DEC-FAC-060: cinco) | Se editan 0129, 0144 y 0176 en su origen; reset de staging; slugs y nombres visibles renombrados |
| DEC-FAC-030 | VIGENTE (la «migración inversa ensayada» SUPERSEDED por DEC-FAC-061) | Despliegue en dos etapas, ventana de mantenimiento, 302 y luego 301, migración inversa ensayada |
| DEC-FAC-031 | VIGENTE | Nombres internos finales: `BusinessLine`, `ListingSection`, `SectionTrait`, estados `absent/locked/available`, valores en inglés |
| DEC-FAC-032 | VIGENTE | Borde del renombrado: sólo se conservan cinco excepciones; todo lo demás se renombra |
| DEC-FAC-033 | VIGENTE (la premisa sobre HOS-1049 y el gating de experiencia SUPERSEDED por DEC-FAC-049) | Alojamiento y experiencia entran al catálogo y al resolvedor con `standard`, sin cambios visibles |
| DEC-FAC-034 | VIGENTE | Cada tipo declara los rubros que admite; aviso al dueño y REQUEST_FIX |
| DEC-FAC-035 | VIGENTE (la parte de reseñas SUPERSEDED por DEC-FAC-065) | Comparativa de planes por rubro y reseñas con dimensiones opcionales; diferencial de noche post-MVP (HOS-1796) |
| DEC-FAC-036 | VIGENTE | `nightInfo` final y `PUB` incluido como tipo |
| DEC-FAC-037 | VIGENTE | DEC-FAC-018…025 aceptadas sin objeciones |
| DEC-FAC-038 | VIGENTE (frontera con CERVECERIA precisada por DEC-FAC-067) | `BAR` y `PUB` coexisten con etiquetas y descripciones distintas |
| DEC-FAC-039 | VIGENTE | Un solo mecanismo de paginación para todas las verticales (HOS-1797, bloquea el sub-spec 6) |
| DEC-FAC-040 | VIGENTE, objetable | Cada sección declara sus campos; detector, proyector y mapa del editor genéricos |
| DEC-FAC-041 | VIGENTE, objetable (`delete` en `absent`: resuelto por DEC-FAC-063) | La ruta declara la intención (`read`/`write`/`delete`) sobre su sección |
| DEC-FAC-042 | VIGENTE, objetable | `/carta/` sin carta: 302 con `no-store`, nunca 301 |
| DEC-FAC-043 | VIGENTE, objetable | G-FAC-03(a) se ancla en el operando tipado `BusinessLine`, no en el literal |
| DEC-FAC-044 | VIGENTE, objetable (la tile de la home sale de la exención (a) por DEC-FAC-068; «fuera del escaneo» AMPLIADO por DEC-FAC-070) | G-FAC-R1: historia ampliada, tema por lista cerrada, valores visibles; aclara la (b) de DEC-FAC-032 |
| DEC-FAC-045 | VIGENTE, objetable | Ninguna migración usa un valor recién agregado al enum; `PUB`/`BOLICHE` nacen en el sub-spec 2 |
| DEC-FAC-046 | VIGENTE, objetable | Default de `business_lines` generado para verticales de un rubro; G-FAC-09 reformulado |
| DEC-FAC-047 | VIGENTE, objetable | Matriz tipo → rubros también en el CHECK; helper de opciones; sin repetidos |
| DEC-FAC-048 | VIGENTE, objetable | Paso 4b: `SECTION_ABSENT` sólo al dueño, corre en `CREATE`, firma fija |
| DEC-FAC-049 | VIGENTE, objetable | Experiencia migra su gate al resolvedor; alojamiento declara claves con exención contada (corrige DEC-FAC-033) |
| DEC-FAC-050 | VIGENTE, objetable | «De noche» y la edad sugerida salen de datos del catálogo |
| DEC-FAC-051 | VIGENTE, objetable (con DEC-FAC-062 la sección `menu` entera puede estar `locked`; la regla no cambia) | Rasgos de una sección `locked` = `locked`; el QR de mesa conserva su clave (premium) |
| DEC-FAC-052 | VIGENTE, objetable | «Abierto ahora» por día de inicio del turno; badge en el cliente en HTML cacheado |
| DEC-FAC-053 | VIGENTE, objetable | Reglas duras de edad y alcohol en el chat del local |
| DEC-FAC-054 | VIGENTE, objetable | Ids de What's New y tours se renombran con migración de seen-ids encadenada |
| DEC-FAC-055 | VIGENTE, objetable | Lecturas protegidas de carta, menú del día y eventos pasan a la cadena |
| DEC-FAC-056 | VIGENTE, objetable | Aviso in-app de cambio de rubros: 30 días, colapsa, desaparece al editar |
| DEC-FAC-057 | VIGENTE, objetable | Admin sin `nightInfo`; REQUEST_FIX es política, no un bloqueo del sistema |
| DEC-FAC-058 | VIGENTE, objetable | Reglas de forma de `nightInfo` |
| DEC-FAC-059 | VIGENTE | Vocabulario: sección del catálogo ≠ sección del formulario del admin ≠ `EditorSection` |
| DEC-FAC-060 | VIGENTE (cómo las escanea G-FAC-R1: DEC-FAC-070) | Se editan cinco migraciones (0129, 0132, 0139, 0144, 0176) con una regla general |
| DEC-FAC-061 | VIGENTE | Marcha atrás: revert + reset en staging; backup del paso 2b en prod; sin migración inversa |
| DEC-FAC-062 | VIGENTE | El enlace externo a la carta pasa a ser pago, dentro de `menu` |
| DEC-FAC-063 | VIGENTE (`delete` en `absent` con la acción 15 SUPERSEDED por DEC-FAC-075: sólo el dueño real) | Contenido `absent`: el dueño ve el resumen y lo puede vaciar; la exportación trae todo |
| DEC-FAC-064 | VIGENTE | Aviso antes de bajar de plan en el MVP, simulado con el resolvedor |
| DEC-FAC-065 | VIGENTE (forma de datos: DEC-FAC-071; promedio con sección `absent`: DEC-FAC-072; el default implícito `legacyImputed`, su nombre y el lugar del servidor SUPERSEDED por DEC-FAC-073) | Dimensiones de reseña opcionales, declaradas en el catálogo y ligadas a secciones |
| DEC-FAC-066 | VIGENTE | Ítems de noche en el catálogo de comodidades y filtros sólo con fichas |
| DEC-FAC-067 | VIGENTE | Frontera de tipos: BAR tragos, PUB cerveza tirada, CERVECERIA productora |
| DEC-FAC-068 | VIGENTE | Textos es/en/pt aprobados; tile de la home «Eventos gastronómicos» |
| DEC-FAC-069 | VIGENTE (el bloqueo «lanzamiento en prod» SUPERSEDED por DEC-FAC-076: 9 bloquea el merge de 5 y 6) | Copy neutro del embudo en este programa, en un hijo propio (sub-spec 9) |
| DEC-FAC-070 | VIGENTE, objetable | G-FAC-R1: historia frente a valores; editadas y tests de migraciones viejas fuera del escaneo de identificadores |
| DEC-FAC-071 | VIGENTE, objetable | Forma de las dimensiones derivada del catálogo: opcional, entero 1-5, «sin voto» = clave ausente; agregado `{ average, count }` |
| DEC-FAC-072 | VIGENTE, objetable | El promedio de una dimensión ligada no se publica si su sección es `absent` |
| DEC-FAC-073 | VIGENTE, objetable | Servidor de reseñas en el sub-spec 3; experiencia declara `ReviewRules`; modo `legacyNullAsZero` |
| DEC-FAC-074 | VIGENTE, objetable | Columnas de `nightInfo` en la lista de la acción 15; `businessLines` es no-contenido; G-FAC-10 compara las dos listas |
| DEC-FAC-075 | VIGENTE, objetable | `delete` en `absent` sólo para el dueño real; la acción 15 sólo lee |
| DEC-FAC-076 | VIGENTE, objetable | El sub-spec 9 bloquea el merge de los sub-specs 5 y 6 |

---

## DEC-FAC-001 · Una sola vertical
**Fecha**: 2026-10-24 · **Decidió**: owner.
**Qué**: bares, pubs y boliches se quedan en la misma vertical que los restaurantes.
**Por qué**: (1) los híbridos (resto-bar, cervecería con cocina, bar que se vuelve boliche) son
comunes y en dos verticales quedarían partidos o pagando dos suscripciones; (2) reversibilidad:
separar después mueve filas a una tabla nueva, fusionar dos verticales mezcla suscripciones; (3)
costo: en el diseño de HOS-1352 «la vertical es la tabla» (HOS-1353 cap. 02, `listing`), así que una
vertical nueva es una tabla nueva con todo lo que cuelga de ella (2–3 semanas de agentes + cola).
**Descartado**: vertical nueva «Noche». Su ventaja real (precio propio desde el lanzamiento, plan a
medida para el dueño con locales separados) no compensó.

## DEC-FAC-002 · 3 planes comunes en escalera
**Fecha**: 2026-10-24 · **Decidió**: owner.
**Qué**: la vertical mantiene planes básico/pro/premium comunes a todos los rubros.
**Por qué**: se evaluaron 9 planes (3 familias × 3 niveles) y chocan con el diseño cerrado de
HOS-1353: `UNIQUE(vertical, rank) WHERE vendible AND vigente` (cap. 10 §2) exige una escalera
lineal; el plan de trial se deriva del rank más alto; la cobertura es por `user + vertical`, así que
un dueño con resto y boliche no podría tener un plan por local; y `direcciónDeCambio` con «cualquier
baja manda» vuelve baja todo cambio entre familias.
**Descartado**: planes por familia; planes por subtipo.

## DEC-FAC-003 · Rubros gratis, por ficha, del lado de Verticales
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: el rubro es un dato de la ficha; no tiene precio; billing no lo lee ni lo conoce.
**Por qué**: respeta la partición «toca plata / no toca plata» de HOS-1352 (`DEC-ARCH-005`); un
dato de ficha que no mueve plata no pertenece a billing.
**Descartado**: addons ocultos de costo cero «con el ciclo de vida del plan» — el modelo de addons
no tiene gratis-por-catálogo (el addon gratuito cuelga de un grant, `B/16` §3.2), un recurrente de
$0 no puede ser preapproval (piso de MP), `DEC-ADDON-002` dice que cancelar el plan no cancela
addons, y pasar de gratis a pago exige consentimiento ficha por ficha.

## DEC-FAC-004 · Mecanismo genérico
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: rubros y capacidades sirven a cualquier vertical con ficha. Hoy sólo Comer y salir tiene
más de un rubro; Alojamiento y Experiencia reciben un rubro `estandar` cada una, sin colección
pública y sin cambios visibles.
**Por qué**: el requisito 3 del PDR. Que toda vertical tenga ≥1 rubro elimina la rama «vertical sin
rubros», que es donde nacerían los `if`.
**Regla derivada**: ningún código pregunta por un rubro concreto; el código pregunta por
capacidades.

## DEC-FAC-005 · Varios rubros por ficha
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: una ficha tiene uno o más rubros de su vertical. Capacidades y colecciones salen de la
unión.
**Por qué**: un resto-bar es `{gastronomia, noche}` sin un rubro «híbrido»; evita la explosión
combinatoria (con 3 rubros base harían falta hasta 7 combinados) y escala a mezclas futuras de
alojamiento.
**Descartado**: un solo rubro por ficha con combinados declarados.

## DEC-FAC-006 · Sin addon ni límite de rubros
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: una ficha puede tener todos los rubros de su vertical, gratis. No se modela una clave de
limit `PERFILES_POR_FICHA`.
**Por qué**: el addon de «rubro extra» no frena cargar dos negocios en una ficha (el control
correcto es la regla de una dirección, DEC-FAC-017), castiga a los híbridos (la razón de
DEC-FAC-001) y depende de B10 (post-corte). Modelar el límite sin usarlo es YAGNI.

## DEC-FAC-007 · Catálogo en código + espejo en base
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: rubros por vertical, sus capacidades y sus colecciones se declaran en `@repo/schemas`. La
base tiene una tabla espejo sólo para la integridad referencial ficha ↔ rubro, y un guard verifica
que código y base coincidan.
**Por qué**: es el patrón que HOS-1353 cap. 02 ya usa para `vertical` («el espejo en base del enum
de código»). Un rubro nuevo casi siempre trae secciones nuevas, que son código igual.
**Descartado**: catálogo 100 % en base editable desde el admin (como los planes, `DEC-ARCH-013`):
apuntaría a claves que son código, sumaría una acción administrativa y su UI, y su flexibilidad no
se usaría sin deploy.

## DEC-FAC-008 · El rubro filtra capacidades de contenido
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: cada vertical declara en código su catálogo de capacidades de contenido (secciones). Cada
capacidad declara si es `comun` (aplica a todo rubro) y, opcionalmente, qué clave de entitlement
exige. El rubro lista sus capacidades no comunes.
**Por qué**: no toda sección propia de un rubro tiene clave de entitlement (la carta puede estar en
los tres planes y aun así no tener sentido para un boliche). Separa «¿tiene sentido para este
local?» (rubro) de «¿lo pagó?» (plan). No toca el catálogo de claves de HOS-1353 cap. 15: sólo lo
lee.
**Descartado**: un quinto atributo `filtrablePorPerfil` en el catálogo de claves (reabre un diseño
cerrado y no cubre las secciones sin clave).

## DEC-FAC-009 · Resolvedor de tres estados
**Fecha**: 2026-10-25 · **Decidió**: owner (corrección encontrada al leer
`apps/web/src/lib/editor/gastronomy-editor-sections.ts` en `staging`).
**Qué**: un único resolvedor devuelve por capacidad:
- `AUSENTE` — ni es común ni la tiene ningún rubro de la ficha: la sección no existe (su slug manda
  al hub);
- `BLOQUEADA` — algún rubro la tiene pero el plan no otorga su clave: se ve con upsell y la API
  rechaza la escritura (comportamiento actual del menú del día en `-basico`);
- `DISPONIBLE`.
Los registros a mano del editor por vertical pasan a derivarse del catálogo + resolvedor.
**Por qué**: un booleano mezcla «no aplica» con «no lo pagó», que la UI trata distinto.

## DEC-FAC-010 · Tipo descriptivo ↔ rubro
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: en el catálogo, cada tipo descriptivo (`GastronomyTypeEnum`, `AccommodationTypeEnum`,
`ExperienceTypeEnum`) pertenece a ≥1 rubro. En el alta, el tipo preselecciona sus rubros; en el
servidor se valida que el tipo pertenezca a alguno de los rubros elegidos. `type` sigue siendo de
un solo valor.
**Por qué**: el caso común queda en una decisión y se evitan combinaciones absurdas (heladería sólo
noche).
**Descartado**: ejes independientes; `type` multivaluado (los rubros ya cubren lo híbrido).

## DEC-FAC-011 · Cada rubro es su colección
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: no hay un concepto «colección» aparte: el rubro declara `publico` y, si lo es, tiene
página propia en `/{lang}/<vertical>/rubro/<rubro>/` (+ `/page/N`), con el mismo patrón que
`/alojamientos/tipo/[type]/`. La URL de la ficha no depende del rubro. El listado de la vertical
sigue mostrando todo. El menú puede promover una colección como ítem principal.
**Por qué**: un concepto menos; el segmento de prefijo evita chocar con `/<vertical>/[slug]`; una
URL de ficha atada al rubro se rompería al cambiarlo y daría dos canónicas a un híbrido.
**Descartado**: colecciones como rutas de primer nivel (`/salir/`): rompe lo genérico.

## DEC-FAC-012 · Spec propia, implementable ya
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: issue paraguas propia (HOS-1787), implementada con branches desde `staging`.
**Por qué**: la épica HOS-1352 entró a `staging` el 2026-10-20 (#3726); U1 y V1–V5 están Done y en
código (`packages/verticals`). V6/V7/V9 no tocan rubros. V8 (HOS-1362) es el único punto de
coordinación: su acción 15 (editar el contenido de una ficha ajena) tiene que consultar el
resolvedor.
**Descartado**: unidad nueva dentro de HOS-1353 (reabre un diseño cerrado); implementar sobre el
código previo a la épica.

## DEC-FAC-013 · Nombres del concepto
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: código `ListingFacet`; UI «rubro»; segmento de URL `/rubro/`.
**Por qué**: «profile» ya es el perfil de usuario en ~180 archivos; «rubro» es como habla el
comerciante argentino y sirve para alojamiento.
**Descartado**: `ListingProfile`, `ListingOffering` («qué ofrece»), `ListingKind` (choca con
`type`).

## DEC-FAC-014 · «Comer y salir»
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: nombre público «Comer y salir» (es/en/pt según i18n). URLs `/comer-y-salir/`,
`/planes/comer-y-salir/`, `/presentacion/comer-y-salir/`, colecciones
`/comer-y-salir/rubro/<rubro>/`; slug en español para los tres idiomas, como hoy; 301 desde
`/gastronomia/…`.
**Por qué**: cubre todo lo que puede entrar sin nombrar un rubro.
**Descartado**: «Gastronomía y noche» (se queda corto con un tercer rubro), «Salidas» (ambiguo con
Experiencias).

## DEC-FAC-015 · Rubros iniciales
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: un nombre por rubro (slug = UI = URL):
- `gastronomia` → propias: `menu` (carta), `dailySpecials` (menú del día);
- `noche` → propia: `nightInfo` (nueva: entrada gratis/paga + precio aproximado, edad mínima,
  dress code);
- comunes: basicInfo, openingHours, price, amenities, media, contact, faqs, translations,
  `venueEvents` (los eventos son comunes: un restaurante también hace peñas o shows);
- tipos: RESTAURANT, CAFE, PARRILLA, HELADERIA, PANADERIA, ROTISERIA, FOOD_TRUCK → `gastronomia`;
  BAR, CERVECERIA, `PUB` (nuevo) → ambos; `BOLICHE` (nuevo) → `noche`.
**Nota**: el rubro `gastronomia` conserva la palabra a propósito como nombre de rubro dentro de
«Comer y salir»; el guard del renombrado (DEC-FAC-016) tiene que distinguirlo (ver
`06-guards.md`).

## DEC-FAC-016 · Renombrado total `gastronomy` → `venue`
**Fecha**: 2026-10-25 · **Decidió**: owner. Reemplaza la frase de la conversación que conservaba el
identificador interno.
**Qué**: desaparece `gastronomy` de código, identificadores, tablas, columnas, enums TS y Postgres,
valores persistidos (vertical y su espejo, `entity_subscriptions.entity_type`, tipos de
favoritos/bookmarks, `PermissionEnum` en `role_permission`…), schemas, rutas API, parámetros, i18n
keys y strings, cache tags y documentación. Nombre interno `venue` (tabla `venues`).
**Por qué**: hoy no hay datos reales; nunca va a ser más barato.
**Descartado como nombre**: `establishment`, `hangout`, `spot` (59 colisiones), `eatery` y `dining`
(dejan afuera la noche), `gastro`, `outlet`, `hospitality` (incluye hoteles), compuestos literales.
**Garantía**: guard de repo al estilo `G8` de HOS-1352 (ver `06-guards.md`).

## DEC-FAC-017 · Estructura
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: HOS-1787 es el paraguas; los hijos son las fases de `sub-specs/`. El renombrado es el
primero y bloquea a todos. La regla «una ficha = un local físico = una dirección» es un issue
aparte relacionado.

---

## Decisiones de la resolución de la vuelta 1

Tomadas por el agente al resolver la vuelta 1 porque había una opción claramente mejor y ninguna exige
criterio de producto del owner. Quedan listadas en
`11-resolucion-vuelta-1/10-decisiones-del-owner.md` §«Decidido sin preguntar» para que el owner pueda
objetarlas. Ninguna reemplaza una decisión anterior.

## DEC-FAC-018 · AUSENTE frente al dueño: 409
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente), objetable. **Hallazgo**: F-V1-016
(C-005, C-006, B-007).
**Qué**: cuando el pedido del dueño (o de la acción 15) toca una capacidad `AUSENTE` en su ficha, la API
responde **409 `ALREADY_EXISTS`** con `details: { reason: 'CAPABILITY_ABSENT', capability }`. El camino
ajeno sigue respondiendo 404 en el paso 4. Se documenta en `apps/api/docs/error-contract.md`.
**Por qué**: la regla 3 del contrato de errores dice que un rechazo dirigido al dueño es sobre el
**estado** de la fila, no sobre su existencia, y que un 404 ahí «reemplaza una razón accionable por una
mentira». La tabla del contrato ya prescribe 409 `ALREADY_EXISTS` con `reason` para un conflicto de
estado (precedente `COMMITMENT_TAKEN`), así que no se inventa un código.
**Descartado**: 404 pelado (lo escrito antes; viola la regla 3 y la web no puede distinguirlo de «la
ficha no existe»); 404 con razón (rompe «body matches the entity ownership 404»).

## DEC-FAC-019 · Dónde entra el rubro en la cadena
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente), objetable. **Hallazgo**: F-V1-015,
F-V1-035 (C-004, C-021).
**Qué**: `AUSENTE` es el **paso 4b**, inmediatamente después del paso 4, porque depende sólo de los
hechos de la ficha. `BLOQUEADA` no es un paso nuevo: la clave de la capacidad (y la de cada rasgo pedido)
se agrega a `requiredKeys` del paso 6. `evaluatedSteps` admite `'4b'`.
**Por qué**: «después del 4 y antes del 6» admitía dos posiciones; antes del paso 5 cambiaba
`NO_COVERAGE` por `NO_CAPABILITY` en rutas que hoy andan. Con BLOQUEADA en el paso 6 hay una sola
implementación de «clave otorgada» y la evaluación sobre el dueño en la acción 15 sale gratis.

## DEC-FAC-020 · Rasgos dentro de una capacidad
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente), objetable. **Hallazgo**: F-V1-006
(B-002, C-002).
**Qué**: `ContentCapabilityDefinition` suma `features?: { id, entitlementKey? }[]`. Un rasgo hereda
`AUSENTE` de su capacidad y suma su propia clave para `BLOQUEADA`; no es una sección del editor. Rasgos
iniciales: `menu.itemPhotos`, `menu.translations`, `menu.qr`, `menu.qrMetrics`, `menu.file`.
**Por qué**: la carta tiene claves propias para fotos, carta multilingüe, QR y métricas; «una capacidad =
cero o una clave» las dejaba como literales sueltos fuera de los guards.
**Descartado**: capacidades hijas con `parent` (B-002): el editor las mostraría como secciones.

## DEC-FAC-021 · Capacidad por campos presentes y rubros resultantes
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente), objetable. **Hallazgo**: F-V1-016
(C-006, B-007).
**Qué**: una ruta que escribe varias secciones (el PATCH de la ficha) declara su capacidad como función
del cuerpo, detectada por presencia de campos **no nulos**; la capacidad se evalúa sobre los rubros
**resultantes** del pedido (los de la ficha más el cambio que traiga el mismo cuerpo).
**Por qué**: con los hechos previos, «agregar `noche` y cargar la entrada» fallaba y «quitar `noche` y
cargarla» pasaba.
**Descartado**: prohibir rubros y contenido de capacidades no comunes en el mismo PATCH (400): obliga a
dos guardados en el alta.

## DEC-FAC-022 · Etiqueta del rubro por i18n
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente). **Hallazgo**: F-V1-042 (B-017).
**Qué**: aclara el paréntesis «slug = UI = URL» de DEC-FAC-015: el slug es fijo (en español) y vive en la
URL; la etiqueta visible sale de i18n en es/en/pt. DEC-FAC-015 sigue vigente en todo lo demás. El valor
interno del rubro (español o inglés) lo decide Q-04.
**Por qué**: todo texto visible pasa por `@repo/i18n` (regla del repo); un visitante en inglés no puede
ver «gastronomia».

## DEC-FAC-023 · `/carta/` sin carta redirige a la ficha
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente), objetable. **Hallazgo**: F-V1-005
(C-013, B-002).
**Qué**: si `menu` no está `DISPONIBLE` (AUSENTE, BLOQUEADA o vacía), `/{lang}/comer-y-salir/<slug>/carta/`
responde 301 a la ficha.
**Por qué**: los QR impresos en las mesas siguen llegando; un 404 los mata, la ficha los aprovecha.

## DEC-FAC-024 · Sin regla de addon dependiente
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente). **Hallazgo**: F-V1-034 (B-008).
**Qué**: se retira del sub-spec 5 la regla «se rechaza quitar un rubro si un addon activo depende de una
capacidad que quedaría AUSENTE». El sub-spec la dejaba «a validar en la revisión».
**Por qué**: hoy ningún addon depende de una capacidad de contenido (YAGNI); una regla escrita sin caso
invita a implementarla a medias.

## DEC-FAC-025 · BLOQUEADA vista por el dueño
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 1 (agente), **objetable** (roza producto).
**Hallazgo**: F-V1-037 (B-010).
**Qué**: en una sección `BLOQUEADA` el dueño ve sus datos en sólo lectura, el upsell y puede **borrar**;
el hub distingue «bloqueada con datos» de «bloqueada vacía»; el aviso de quitar un rubro dice cuántos
ítems quedan guardados.
**Por qué**: el caso típico es una bajada de plan con la carta cargada; sin esto el dueño no sabe qué
tiene ni puede limpiar una carta vieja antes de volver a subir. Borrar no construye, así que respeta
«construir ≠ mirar».

---

## Decisiones de las respuestas del owner a la vuelta 1

Respuestas del 2026-10-25 a `11-resolucion-vuelta-1/10-decisiones-del-owner.md` (Q-01…Q-10). Cada una cita
su pregunta y la decisión abierta (`OD-NN`) que cierra.

## DEC-FAC-026 · Rubros en columna `business_lines` con restricciones declaradas
**Fecha**: 2026-10-25 · **Decidió**: owner delegó («lo que sea mejor a largo plazo»); decidió el
orquestador. **Pregunta**: Q-06 (cierra OD-09). **Hallazgo**: F-V1-027, 004, 017, 018, 034.
**Qué**: los rubros se guardan en una columna `business_lines text[] NOT NULL` de cada tabla de ficha
(`venues`, `accommodations`, `experiences`). Un CHECK de base, **generado desde el catálogo**, exige no
vacío y sólo valores válidos de esa vertical; índice GIN para las colecciones; **sin tabla espejo** ni
tablas de relación. Las restricciones viven como **declaraciones** en el catálogo de código, por
vertical: `maxPerListing?`, `excludes?` (pares), y los rubros permitidos por tipo (DEC-FAC-034). **Un solo
validador genérico** en `@repo/schemas`, usado por todo camino de escritura, las aplica; no hay código por
vertical. Las reglas estáticas estructurales (no vacío, valores válidos) también están en el CHECK; si una
regla futura es estática (máximo N, exclusión) el generador puede sumarla al CHECK. Una regla que dependa
del plan («el básico admite 1 rubro») **no** es una regla del catálogo: sería una clave de límite leída por
el resolvedor de HOS-1353, y billing sigue sin leer rubros (DEC-FAC-003). El orden del arreglo no tiene
significado; si algún día hace falta un «rubro principal», el primer elemento lo es (punto de extensión,
hoy sin uso).
**Por qué**: la base garantiza la regla «≥1 rubro» donde no se puede saltear (cargas masivas, seeds,
scripts, dos pedidos simultáneos); viaja en la fila que la autorización ya lee (cero consultas de más,
también en listados); no suma tablas a la purga; el guard se reduce a «el CHECK coincide con el catálogo».
Las restricciones como declaración escalan a más verticales y más rubros sin código nuevo.
**Descartado**: tabla espejo + tablas de relación + trigger diferido (más piezas, una consulta extra por
ficha, tres tablas en la purga); tablas sin garantía en base. **Disparador de reconsideración**: las tablas
de relación sólo ganan si hace falta un atributo **por asociación** (estado de moderación por rubro, fechas);
hoy no se prevé ninguno.
**Reemplaza**: la parte de base de DEC-FAC-007 (el catálogo sigue en código; desaparece la tabla espejo).

## DEC-FAC-027 · OD-14 cerrada sin medir
**Fecha**: 2026-10-25 · **Decidió**: owner. **Pregunta**: OD-14 (F-V1-026).
**Qué**: no se mide nada en prod. El owner confirma al 100 % que no hay fichas reales de gastronomía
en prod. La premisa de DEC-FAC-016 queda confirmada por el owner.
**Ampliación (2026-10-25)**: el owner confirma además que prod no tiene **ninguna** ficha de gastronomía de
ejemplo (cero reales y cero demo). Renombrar el `seedKey` de los fixtures no tiene impacto en prod.
**Por qué**: el dato lo tiene el dueño del negocio; la medición costaba una lectura con autorización en prod.
**Descartado**: la lectura de sólo lectura por `hops psql --target=prod`.

## DEC-FAC-028 · El renombrado cae antes del corte V6
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-01 (cierra OD-08). **Hallazgo**:
F-V1-001, 002, 003, 008, 009, 011, 013.
**Qué**: el renombrado entra **entero** a staging antes de ejecutar V6 y es **bloqueante del corte**: V6 de
HOS-1352 pasa a depender del sub-spec 1. Los sub-specs 2 a 7 no. **Regla fija: el corte nunca cae entre
dos PRs del renombrado.** Se eliminan de la spec las ramas «después del corte» (guard de inmutabilidad que
acepta renombres, alias de ids, lector tolerante del nombre viejo, migración de suscripciones reales).
**Por qué**: es la única variante que deja el catálogo limpio sin abrir puertas en las protecciones de la
base; prod casi no tiene datos de la vertical (DEC-FAC-027); las data-migrations viejas mueren con el corte.
**Descartado**: después del corte (la más cara); «antes si llega, si no después» (dos variantes
especificadas).

## DEC-FAC-029 · Catálogo corregido en su origen
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-02 (cierra OD-04). **Hallazgo**:
F-V1-002, 003, 045.
**Qué**: se editan las migraciones 0129, 0144 y 0176 para que el catálogo de planes, addons y claves nazca
`venue`. Es una excepción explícita a «nunca editar una migración ya aplicada» (aplicada sólo en staging y
local). Se resetean la base de staging, la plantilla de base y las bases de worktree, y **antes del reset**
se cancelan las preapprovals huérfanas del sandbox de MercadoPago. Se renombran slugs y nombres visibles:
`venue-basico/pro/premium`, `extra-venues-1`, `visibility-boost-venue-7d/30d`, planes de rol con el mismo
prefijo, título en MP «Comer y salir Básico» (el resumen de tarjeta coincide con la página de precios).
**Por qué**: cero deuda; G18 queda verde sin puertas nuevas; los ids UUIDv5 cambian una sola vez, antes de
que prod tenga nada atado a ellos.
**Descartado**: migración nueva que enseña a G18 a aceptar renombres y apaga los triggers de `extras/041`;
alias interno que congela los ids; catálogo que conserva `gastronomy` por dentro (contradice DEC-FAC-016).

## DEC-FAC-030 · Despliegue en dos etapas con ventana
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-03 (cierra OD-06). **Hallazgo**:
F-V1-013.
**Qué**: (a) **etapa lógica**: varios PRs de renombrado «interno» (nombres en el código, carpetas) que
siguen apuntando a las tablas y valores viejos, sin migración ni cambio de contrato; (b) **etapa física**:
**un** PR atómico con la migración, los valores persistidos, los contratos de API y las URLs. Se despliega
en una ventana de mantenimiento en staging con orden fijo: bajar web y admin, migrar, desplegar API,
desplegar web y admin. Redirects **302** durante el soak, 301 con un cambio explícito después. Migración
inversa ensayada y lista escrita de lo que no vuelve (historial, correos ya enviados, buscadores). En prod
viaja en la ventana del corte, que ya es sin convivencia.
**Por qué**: cada PR deja staging sano, la parte riesgosa queda chica y se puede volver atrás; unos minutos
de ventana cuestan menos que un release de compatibilidad. Un 301 queda grabado en los navegadores y no se
deshace.
**Descartado**: compatibilidad durante un release (vistas y alias, dos releases); sin ventana ni
compatibilidad (500 y 404 mientras se despliega).

## DEC-FAC-031 · Nombres internos finales
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1, con dos choques más que encontró él). **Pregunta**:
Q-04 (cierra OD-02 y OD-07). **Hallazgo**: F-V1-033, 025, 041, 045.
**Qué**:
| concepto | código | UI / docs |
|---|---|---|
| rubro | `BusinessLine` (columna `business_lines`, parámetro de API en inglés) | «rubro» |
| sección de contenido | `ListingSection` (`ListingSectionId<V>`) | «sección» |
| elemento dentro de una sección | `SectionTrait` (**no** *feature*: choca con el catálogo `r_venue_feature`) | «rasgo» |
| estados del resolvedor | `absent` / `locked` / `available` | AUSENTE / BLOQUEADA / DISPONIBLE (glosas) |
| razón del 409 al dueño | `SECTION_ABSENT` | reemplaza `CAPABILITY_ABSENT` |
| valores de rubro | `food`, `nightlife`, `standard` | mapa a slug de URL: `food` ↔ `gastronomia`, `nightlife` ↔ `noche` |
| eventos del local | `GastronomyVenueEvents*` → `VenueEvents*` | la sección `venueEvents`, `sports_venue` y `venueName` no se tocan |
Segmento `mi-cuenta/comercio/venue/` aceptado (es el id de la vertical). «Capacidad/capability» queda **sólo**
para la clave de entitlement (HOS-1353, incluido el código `NO_CAPABILITY` del paso 6, que no se renombra).
**Por qué**: elimina cinco choques de una vez, antes de migrar: *facet* (filtro de búsqueda del web),
«capacidad» (HOS-1353), *feature* (catálogo de características), `venue` (eventos del local) y los
identificadores en español en código y base.
**Descartado**: mínimo (`ListingFacet` y «capacidad» se quedan, más exenciones en el guard); intermedio.
**Reemplaza**: DEC-FAC-013 (`ListingFacet`), los valores internos de DEC-FAC-015 y la razón
`CAPABILITY_ABSENT` de DEC-FAC-018.

## DEC-FAC-032 · Borde del renombrado
**Fecha**: 2026-10-25 · **Decidió**: owner (quiere renombrar todo salvo lo que conservarlo tenga sentido).
**Pregunta**: Q-05 (cierra OD-01, OD-03 y OD-05). **Hallazgo**: F-V1-012, 025, 043.
**Qué**: sólo se conserva: (a) la categoría «Gastronomía» de eventos, posts y POI (tema, no vertical); (b) la
palabra en español en prosa y el nombre/slug público del rubro `gastronomia` (el valor en código es `food`);
(c) el mapa de redirects legacy `/gastronomia/…` → `/comer-y-salir/…`; (d) el propio guard de palabra
retirada; (e) los eventos pasados de PostHog y los correos ya enviados (historia externa). Se **renombra todo
lo demás**: ids y semillas de fixtures (`gastronomy:${seedId}` → venue; staging se resetea por DEC-FAC-029,
sin migración), carpetas de Cloudinary (el seed resube las fotos de ejemplo bajo `venue/`), cache tags y
clases CSS `gastro-`, propiedad PostHog → `is_venue_owner`, ids de What's New y del tour de mi-cuenta,
títulos de addon, la ruta `publicar-restaurante`. G-FAC-R1 se alinea a esta lista exacta, cada excepción
contada por nombre.
**Por qué**: borde claro y verificable por un guard; ninguna palabra vieja sobrevive por comodidad.
**Descartado**: conservar `gastro-`, Cloudinary y semillas como claves opacas (opción 1 original); mínimo.

## DEC-FAC-033 · Alcance de alojamiento y experiencia
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 2). **Pregunta**: Q-07 (cierra OD-10). **Hallazgo**:
F-V1-014, 036.
**Qué**: alojamiento y experiencia entran al catálogo y al resolvedor con el rubro `standard`, sin cambios
visibles: lo público de alojamiento (por campo) y el ocultamiento de indicaciones de experiencia (HOS-1049)
se quedan como están. El editor de alojamiento conserva su lista manual de secciones, **congelada por un
guard**; su migración al catálogo va a un **hijo 8** (pendiente de crear en Linear). Los editores de venue y
de experiencia se derivan del catálogo y el resolvedor.
**Por qué**: hoy hay una lista de secciones escrita a mano por vertical
(`apps/web/src/lib/editor/{listing,gastronomy,experience,accommodation}-editor-sections.ts`); al derivar las
de venue y experiencia, alojamiento queda como la única isla escrita a mano, y por eso existe el hijo 8. Se
difiere porque alojamiento decide por **campo** (video, descripción enriquecida, insignia; ~9 lectores) y
migrarlo cambia lo que ve el público, que DEC-FAC-004 promete no tocar.
**Descartado**: entran completos (cambios visibles y smoke de dos verticales que nadie pidió); fuera de esta
spec (contradice DEC-FAC-004 y el pedido 3 del PDR).

## DEC-FAC-034 · Rubros permitidos por tipo
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1 + aviso + REQUEST_FIX). **Pregunta**: Q-08 (cierra
OD-11). **Hallazgo**: F-V1-020, 041.
**Qué**: cada tipo declara en el catálogo los rubros que admite; cualquier subconjunto **no vacío** del
conjunto permitido es válido y el servidor rechaza lo demás (lo aplica el validador genérico de
DEC-FAC-026). Matriz: RESTAURANT `{food, nightlife}` (confirmado por el owner); CAFE, PARRILLA, HELADERIA,
PANADERIA, ROTISERIA, FOOD_TRUCK `{food}`; BAR, CERVECERIA, PUB `{food, nightlife}`; BOLICHE `{nightlife}`.
Preselección en el alta (la de DEC-FAC-015, ahora explícita): `{food}` para los tipos de comida;
`{nightlife}` para BOLICHE; ambos para BAR, CERVECERIA y PUB. Además: cuando soporte o un admin cambia los
rubros de una ficha ajena **se avisa al dueño** (más el registro en la línea de tiempo), y un rubro mal
elegido se corrige con un pedido de corrección al dueño (REQUEST_FIX), no editando a mano.
**Por qué**: impide que una heladería se marque «noche» y aparezca en la página de boliches, sin moderación;
los filtros por tipo de cada colección salen solos.
**Confirmaciones del owner (2026-10-25)**: (1) BOLICHE admite **sólo** `{nightlife}`; si un boliche tiene
cocina, el dueño elige BAR o RESTAURANT. (2) El aviso al dueño por un cambio de rubros hecho por un tercero va
por **correo e in-app**, reusando el canal que la moderación ya usa para REQUEST_FIX (sin mecanismo nuevo, vía
`packages/notifications`): ver sub-spec 7 para lo verificado en código.
**Descartado**: separar «habilita secciones» de «aparece en la página» (un concepto más); moderación de
cambios de rubro (carga operativa).
**Reemplaza**: la regla de validación de DEC-FAC-010 («el tipo pertenece a alguno de los rubros elegidos»).

## DEC-FAC-035 · Planes y reseñas de noche
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1 ahora; la 2 post-MVP). **Pregunta**: Q-09 (cierra
OD-12). **Hallazgo**: F-V1-021.
**Qué**: la tabla de comparación de planes se **genera desde el catálogo**, con las filas marcadas por rubro;
el upsell **nombra lo que desbloquea**; cada dimensión de reseña (comida, servicio, ambiente, precio) pasa a
ser opcional y se muestra sólo si tiene votos, y el promedio se calcula sobre las votadas. Los precios no
cambian (DEC-FAC-002). El **diferencial de noche** para pro/premium es post-MVP y está en Linear **HOS-1796**.
**Por qué**: corrige lo engañoso sin bloquear el lanzamiento.
**Descartado**: diferencial de noche antes de lanzar; aceptar y documentar.

## DEC-FAC-036 · `nightInfo` final y `PUB`
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1 + `PUB`). **Pregunta**: Q-10 (cierra OD-13).
**Hallazgo**: F-V1-038.
**Qué**: `nightInfo` queda con: entrada `free/paid/varies` + nota corta; precio «desde» con fecha, mostrado
«aprox., actualizado <mes>»; edad mínima opcional (vacío = no informado; 18 sugerido para BOLICHE) mostrada
como insignia «+N» con texto legal fijo y traducido (Ley 24.788); dress code como lista (casual, smart
casual, elegante, sin restricciones) + nota opcional; se usa el horario único de la ficha y la limitación
queda escrita; en una ficha híbrida los datos van bajo un título «De noche»; BOLICHE en portugués es
«balada». `PUB` **se agrega** como tipo; su relación con `BAR` la resuelve DEC-FAC-038.
**Por qué**: datos útiles que no envejecen mal; el dress code se traduce solo; el +18 no se lee como
permiso para servir alcohol a menores.
**Descartado**: el borrador original (entrada sin texto, precio sin fecha, dress code libre a traducir a
mano); no agregar `PUB`.

## DEC-FAC-037 · DEC-FAC-018…025 aceptadas
**Fecha**: 2026-10-25 · **Decidió**: owner (sin objeciones). **Pregunta**: «Decidido sin preguntar».
**Qué**: las ocho decisiones tomadas por el agente quedan aceptadas. La de DEC-FAC-018 conserva su forma
(409 `ALREADY_EXISTS`) con la razón renombrada a `SECTION_ABSENT` (DEC-FAC-031).

## DEC-FAC-038 · `BAR` y `PUB` coexisten
**Fecha**: 2026-10-25 · **Decidió**: owner. **Pregunta**: OD-15 (derivada de Q-10).
**Qué**: ambos tipos existen. `BAR` deja de describirse como «Bar or pub»: `BAR` = bar/coctelería (el
término genérico argentino); `PUB` = pub, orientado a cerveza (estilo irlandés). Cada uno tiene etiqueta y
descripción propias en es/en/pt. Los dos admiten `{food, nightlife}` y se preseleccionan con ambos
(DEC-FAC-034).
**Por qué**: en Argentina «bar» es el término genérico y «pub» un formato reconocible; diferenciar las
descripciones evita que el dueño no sepa cuál elegir.
**Descartado**: que `PUB` reemplace a `BAR` (obligaba a migrar `BAR` y a perder el término genérico).

## DEC-FAC-039 · Paginación compartida por todas las verticales
**Fecha**: 2026-10-25 · **Decidió**: owner. **Pregunta**: OD-16 (bug previo #2).
**Qué**: un solo mecanismo de paginación para todas las verticales, siguiendo el patrón de alojamientos:
ruta `/page/N/` que responde 301 en la página 1 y hace `Astro.rewrite` a `?page=N`, con canónica
autorreferente `/page/N/` (SPEC-157). Se trackea en Linear **HOS-1797**, que **bloquea el sub-spec 6** de
HOS-1787, para que `/comer-y-salir/` (incluidas las colecciones `/rubro/<rubro>/`) nazca ya sobre el
mecanismo compartido.
**Por qué**: gastronomía y experiencias hoy declaran canónica `/page/N/` (404) con enlaces `?page=N`; el
owner quiere el mismo código en todas.
**Descartado**: arreglar sólo gastronomía; pasar todo a `?page=N`.

---

## Decisiones de la resolución de la vuelta 2

Tomadas por el agente al resolver la vuelta 2 (`12-revision-vuelta-2/00-consolidado.md`) porque había una
opción claramente mejor y ninguna exige criterio de producto. Todas son **objetables** y están listadas en
`13-resolucion-vuelta-2/10-decisiones-del-owner.md` §«Decidido sin preguntar». Cuando corrigen una anterior,
la anterior queda marcada en el índice, no reescrita.

## DEC-FAC-040 · Cada sección declara sus campos
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-006 (C-001).
**Qué**: `ListingSectionDefinition` suma `fields: readonly (keyof UpdateInputOf<V>)[]`, tipado contra el schema
de update de la vertical (un campo renombrado no compila), incluidos sus `*I18n`. De ahí salen: (a) un único
detector `sectionsTouchedByBody({ vertical, body })` en `@repo/schemas`, que reemplaza las detecciones a mano de
cada ruta; (b) un único proyector público que quita los `fields` de toda sección no `available`; (c)
`LISTING_SECTION_PAYLOAD_KEYS` del web, derivado; (d) G-FAC-02 regla 11: cada campo del schema de update
pertenece a exactamente una sección. Los campos traducibles de una sección no común pertenecen a **esa**
sección y se editan dentro de ella, nunca por la común `translations`. Los subrecursos con tabla propia (carta,
menú del día, eventos) siguen con su ruta y su sección fija.
**Por qué**: es la pieza que la detección del PATCH (DEC-FAC-021), la proyección única del lector público y el
editor derivado suponían sin decir de dónde sale; sin ella cada uno escribe su lista de los mismos campos.
**Descartado**: dejar el mapa en el web (el API no puede importarlo); una lista por ruta.

## DEC-FAC-041 · Intención de la ruta sobre su sección
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-007 (C-002).
**Qué**: la declaración de sección de una ruta lleva intención: `listingSection: { id, intent: 'read' | 'write' |
'delete' }` (o una función del cuerpo que devuelve pares). `read` y `delete` corren sólo el paso 4b; `write` corre
4b y suma la clave al paso 6. Un PUT de reemplazo clasifica el cuerpo: vacío = `delete`; si no, `write` (borrar
ítems sueltos de una sección `locked` queda fuera, y se dice). Si `delete` se admite en `absent` lo decide Q-14;
hasta entonces corre el 4b.
**Por qué**: DEC-FAC-025 (aceptada) promete borrar en `locked`, y con una sola declaración la clave se exige para
cualquier operación: hoy `deleteMenuFile` responde 403 al dueño bajado.
**Descartado**: rutas de borrado sin declarar sección (salen de G-FAC-06 y del 4b).

## DEC-FAC-042 · `/carta/` sin carta: 302 `no-store`
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-013 (B-001).
**Qué**: cuando `menu` no tiene contenido `available`, `/{lang}/comer-y-salir/<slug>/carta/` responde **302** con
`Cache-Control: no-store` a la ficha (respuesta armada a mano, como `apps/web/src/pages/qr/[slug].astro:117-130`,
para que el header sobreviva). Test del código y del header. Reemplaza el código 301 de DEC-FAC-023; el resto de
esa decisión sigue.
**Por qué**: plan, rubro y carta son reversibles; un 301 queda grabado en el teléfono del comensal y nunca le
deja ver la carta cuando vuelve.

## DEC-FAC-043 · G-FAC-03(a) por operando tipado
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-011 (C-006,
B-011).
**Qué**: el guard no busca el texto `food`/`nightlife`/`standard`. Con el checker de TypeScript (como los guards de
`check-listing-clock.ts`), es rojo toda comparación, `includes`/`some`/`indexOf`, `switch` o índice cuyo operando
sea de tipo `BusinessLine` (o arreglo de él) fuera de `packages/verticals/src/listing-sections/`. Y las constantes
de valor de rubro sólo se importan desde los módulos de la lista (b) y desde el mapa de slugs. Mutación:
`listing.businessLines.includes('nightlife')` en un componente → rojo. Control negativo: `style === 'standard'` en
`rate-limit.ts` y `{ food: … }` en la reseña → verde.
**Por qué**: los tres valores ya se usan en ~15 archivos con otro sentido; un guard por texto nace rojo y se
angosta hasta dejar pasar lo que debía frenar (precedente G1(b), `check-vertical-axis-items.ts:36-43`).
**Descartado**: tipo marcado (*branded*): TypeScript sigue admitiendo comparar contra un literal que se solapa.

## DEC-FAC-044 · G-FAC-R1 rediseñado
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-015 (A-017,
B-004, B-005).
**Qué**: (1) **fuera del escaneo** (historia, no exención): además de las migraciones sin editar, la migración
de renombrado y su `meta/`, y los módulos de data-migration del seed (los borra el paso 6 del corte); (2) la
exención (a) pasa a «gastronomía como **tema**» con lista cerrada de archivos: categorías de eventos, posts y
POI, la **dimensión `gastronomy` del rating de destino** (schema, mensajes de error, etiquetas; **no** se
renombra ni se migra, porque es dato de prod con otro sentido), la tile de la home (clave e imagen),
`footer.categoryGastronomy` y los slugs de categoría de `facet-slugs.ts`; (3) **aclara** la (b) de DEC-FAC-032:
la palabra se conserva como tema en prosa y como etiqueta del rubro `food`; donde nombra a la **vertical** («Suscripción
de gastronomía», el ítem del menú) se renombra, porque la vertical se llama «Comer y salir» (DEC-FAC-014); (4)
regla 5 nueva sobre **valores** de `packages/i18n/src/locales/**` y `packages/notifications/src/**`:
`[Gg]astronom[ií]a` sólo en claves de una lista contada (las de (a) y la etiqueta del rubro). Siguen siendo cinco
exenciones.
**Por qué**: el auto-chequeo exacto no podía quedar verde (la migración de renombrado nombra la tabla vieja); un
uso temático legítimo se «arreglaba» renombrándolo y migrando datos de prod; y el guard no veía lo que lee el
visitante.

## DEC-FAC-045 · Valores nuevos del enum sin uso en migraciones
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-005 (A-005),
F-V2-041 (C-017).
**Qué**: ninguna migración versionada usa `BOLICHE` ni `PUB` como valor del enum; toda comparación en SQL contra
el tipo se hace sobre `type::text` (el `CASE` del backfill y el `CASE` del CHECK de DEC-FAC-047 ya lo son). Los
usos reales viven en el seed (otro proceso, otra transacción). Además, los valores `PUB`/`BOLICHE` (enum TS, `ADD
VALUE`, etiquetas y descripciones) se mueven del sub-spec 4 al **sub-spec 2**, porque la matriz tipo → rubros los
necesita; el sub-spec 4 queda con `nightInfo` y depende de 2 y 3.
**Por qué**: `drizzle-kit migrate` aplica todas las pendientes en una transacción (`0126_cool_captain_flint.sql:10`)
y Postgres no deja usar un valor agregado con `ADD VALUE` hasta el commit; separar la migración no alcanza en una
base desde cero, en el reset de staging ni en el corte. Agregar el valor en la misma migración que renombra el
tipo tampoco: la excepción de Postgres cubre un tipo **creado** en la transacción, no uno renombrado.
**Descartado**: migración separada (lo de la vuelta 1); `COMMIT` dentro de una migración (rompe la atomicidad del
lote).

## DEC-FAC-046 · Default de `business_lines`
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-018 (A-007).
**Qué**: `accommodations` y `experiences` llevan `DEFAULT ARRAY['standard']`, generado desde el catálogo (sólo
para verticales con un rubro); `venues` no tiene default (el rubro de un local no se adivina) y sus escritores
directos se ajustan. Secuencia: `ADD COLUMN` nullable → backfill → `SET NOT NULL` → `ADD CHECK`. G-FAC-01
verifica también el default. G-FAC-09 pasa a «ninguna **validación** de rubros fuera del validador» (no «todo
camino lo llama»).
**Por qué**: decenas de tests, fábricas y herramientas insertan fichas sin pasar por el servicio; sin default se
rompen, y la tentación es escribir `['standard']` a mano en cada uno.

## DEC-FAC-047 · Tipo → rubros también en la base
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-022 (A-012,
C-010), F-V2-036 (C-011), F-V2-046 (A-016).
**Qué**: el generador del CHECK de `venues` suma `CASE type::text WHEN '<tipo>' THEN business_lines <@
ARRAY[…permitidos…] … ELSE false END`; G-FAC-01 lo compara con `typeRules`. El validador genérico sigue para el
error tipado antes de llegar a la base, y suma la regla «sin repetidos» (y orden estable antes de escribir). En el
mismo módulo, `resolveBusinessLineOptions({ vertical, type, selected }) → { value, selectable, reason? }[]`
comparte las reglas con el validador; el editor y el admin lo usan y G-FAC-09 lo cuenta.
**Por qué**: la matriz es estática; fuera del CHECK, dos pedidos concurrentes dejan BOLICHE `{food}` para siempre,
justo lo que DEC-FAC-034 dice impedir. Y la UI necesita «qué se puede elegir», no sólo «inválido».

## DEC-FAC-048 · Alcance y firma del paso 4b
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-034 (C-008),
F-V2-035 (C-009).
**Qué**: `resolveListingAccess` recibe `sections?: { requested: readonly { id, intent }[]; resultingBusinessLines:
readonly BusinessLine[] }`, que calcula el middleware (rubros de los hechos + el cambio del cuerpo; en `CREATE`,
sólo el cuerpo). El 4b corre también en `CREATE`. Devuelve `SECTION_ABSENT` (409) **sólo** si el paso 4 resolvió
«dueño» (incluida la acción 15); a un sujeto ajeno, `NOT_FOUND`. La razón nueva entra a `ListingAccessResult` y a
la tabla del contrato.
**Por qué**: `READ_PUBLIC` y `WRITE_ABOUT_LISTING` admiten a un ajeno en `PUBLISHED`, así que no todo camino ajeno
muere en el paso 4; y en `CREATE` no hay hechos.

## DEC-FAC-049 · Experiencia y alojamiento frente a G-FAC-04
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-010 (C-005),
F-V2-012 (C-007).
**Qué**: corrige la premisa de DEC-FAC-033. **HOS-1049 no oculta nada**: retira las indicaciones si el plan no
otorga `manage_experience_directions` y las muestra en sólo lectura al dueño bajado
(`directions-projection.ts`, `listing-edit-data.ts:102-114`), que es la semántica de un rasgo `locked`. Por eso
experiencia **migra** su gate al resolvedor en esta spec (`meetingPoint.directions` con su clave), con salida
visible idéntica y el test de no regresión como prueba. Alojamiento declara sus secciones **con** su clave en el
catálogo (para que el resolvedor no mienta), y G-FAC-04 lleva una lista cerrada y contada de archivos de
alojamiento exentos (rutas de calendario y ocupación, `entitlement-filter.ts`, `routes/accommodation/public/list.ts`,
`getWhatsApp.ts`) que el hijo 8 vacía. El `Record` de claves por vertical de `chat.ts` se migra entero.
**Por qué**: con la premisa vieja, G-FAC-04 quedaba rojo en archivos que nadie iba a tocar, y las tres salidas
eran malas. Lo que DEC-FAC-033 quería («sin cambios visibles») se conserva.

## DEC-FAC-050 · Presentación desde el catálogo
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-026 (B-010,
C-012).
**Qué**: la sección declara `headingWhenMultiLineKey?`: si la ficha tiene **más de un rubro con secciones propias
en estado distinto de `absent`**, la sección se titula con esa clave i18n (`nightInfo` → «De noche»). El resolvedor
devuelve ese hecho (`multiLine: boolean`) junto al mapa; el componente pregunta eso, no por rubros. El tipo declara
`typeRules[type].fieldDefaults?` (`BOLICHE: { minAge: 18 }`), que el editor ofrece como sugerencia en el alta.
**Por qué**: «híbrida» es `includes('food') && includes('nightlife')`, que la regla 1 prohíbe; y derivarlo de
«hay una sección de `food` `available`» le saca el título a un resto-bar básico (con la carta `locked`). Contar en
estados ≠ `absent` lo evita.

## DEC-FAC-051 · Rasgos en sección `locked`; QR de mesa
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-025 (B-009),
F-V2-008 (C-003).
**Qué**: una sección `locked` deja todos sus rasgos `locked`. El rasgo `menu.qr` (QR de mesa) lleva
`menu_qr_scan_metrics`, la misma clave que `menu.qrMetrics` y la que hoy exige `menuQr`: el QR de mesa sigue siendo
premium. `menuQr` deja `READ_OWN_COMMERCIAL` (que lanza sin `step6Key`) por una operación de la cadena que no lo
exige, y declara sección + rasgo. G-FAC-02 admite dos rasgos con la misma clave.
**Por qué**: el rasgo sin clave regalaba el QR a pro (o a básico) sin que nadie lo decidiera, y quitar el `step6Key`
sin cambiar la operación es un 500. Mantener lo que se vende es la opción que no necesita al owner.
**Descartado**: QR de mesa incluido con la carta en pro (cambio comercial; el owner lo puede pedir aparte).

## DEC-FAC-052 · «Abierto ahora» por día de inicio del turno
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-014 (B-003).
**Qué**: un turno que envuelve la medianoche pertenece al día en que **empieza**: «abierto ahora» es (turno de hoy
contiene `now`, evaluado en `[open, 24:00)` si envuelve) **o** (el turno de ayer envuelve y `now < close`). Test con
viernes y sábado 23:30–06:00 (sábado 03:00 abierto, domingo 03:00 abierto, viernes 03:00 cerrado). En HTML cacheado
(colecciones, listados) el badge se calcula en el cliente con una isla chica; el SSR no lo emite. El docblock de
`gastronomy-hours.ts:102-107` («every real overnight schedule … repeats across consecutive days») se reescribe.
**Por qué**: la spec trae al producto el horario que rompe ese supuesto, y prod no tiene datos de la vertical
(DEC-FAC-027) que el cambio pudiera alterar.

## DEC-FAC-053 · Reglas de edad y alcohol en el chat
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-017 (B-007).
**Qué**: `DEFAULT_RULES.chat_venue` (código, no editable por el admin) suma: no afirmar que alguien puede ingresar
por debajo de la edad declarada, no dar consejos para eludirla, repetir textual la edad de la ficha y el texto
legal de la Ley 24.788 y derivar al local. La cláusula se mueve **entre** prompt y reglas para respetar el
invariante de `default-rules-equivalence.test.ts`; test de la regla presente.
**Por qué**: es la misma decisión legal que el owner tomó para la ficha (DEC-FAC-036).

## DEC-FAC-054 · What's New y tours renombrados sin re-notificar
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-029 (B-014).
**Qué**: los ids de What's New con la palabra se renombran (DEC-FAC-032), incluidos los publicados, y una
data-migration nueva (numerada después de la `0109`, que en prod todavía no corrió) reescribe
`users.settings.onboarding.whatsNew.seenIds` del id viejo al nuevo, con el mismo patrón idempotente de la 0109. La
cadena 0109 → nueva cubre `2026-09-05-<palabra retirada de G8>-…` → `…-gastronomy-…` → `…-venue-…` sin editar la 0109. Mismo trato
para el mapa de progreso de tours (`tourProgress.ts`) si guarda el id del tour (verificar en la tarea).
**Por qué**: el precedente 0109 existe justamente para renombrar sin que nadie vuelva a ver la entrada; con él,
renombrar todo no le cuesta nada a ningún usuario.
**Descartado**: conservar los ids publicados con marcador (contradice DEC-FAC-032); renombrar y aceptar el re-aviso.

## DEC-FAC-055 · Lecturas protegidas por la cadena
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-040 (C-016).
**Qué**: `getMenu`, `getDailySpecials` y `getEvents` protegidos pasan a la cadena (`READ_OWN`, intención `read`),
dejando el chequeo a mano `hasViewAll || ownerId === actor.id`. Quién puede leer **no cambia**: el personal con
`VENUE_VIEW_ALL` sigue leyendo (por la acción 15, que ya fija `subjectId` = dueño; si la acción 15 no admite
`READ_OWN` para ese permiso, se resuelve con V8/HOS-1362 antes de mergear), con test. G-FAC-06 verifica que la
ruta **use** la cadena, no sólo que declare la sección.
**Por qué**: declarar la sección en una ruta fuera de la cadena no hace nada y deja a G-FAC-06 verde por la
declaración.

## DEC-FAC-056 · Vida útil del aviso de cambio de rubros
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-032 (B-017).
**Qué**: el aviso derivado dura 30 días desde el último cambio (mismo criterio que `LIFT_NOTICE_WINDOW_DAYS`),
colapsa varios cambios en el último y desaparece si el dueño vuelve a editar sus rubros. Un REQUEST_FIX de rubros
con otra fix request abierta responde `ALREADY_OPEN` (`fix-request.ts:55`): el admin espera o agrega la corrección
a la abierta; se dice en el sub-spec 7.
**Por qué**: un evento puntual sin ventana queda para siempre arriba del editor.

## DEC-FAC-057 · Admin, `nightInfo` y REQUEST_FIX
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-033 (B-018).
**Qué**: el formulario consolidado del admin no muestra `nightInfo` (como no muestra la carta). El PATCH de admin
ya pasa por la cadena (`routes/gastronomy/admin/patch.ts:30`), así que el 4b frena igual una escritura de `nightInfo`
en una ficha sin `nightlife`. «Corregir un rubro mal elegido con REQUEST_FIX» es **política** operativa: el permiso
de editar rubros es el mismo para admin y soporte y el sistema no lo impide; lo que el sistema garantiza es el
registro y el aviso. El criterio de aceptación del sub-spec 7 se reescribe así.
**Por qué**: la regla y el criterio se contradecían, y el permiso no distingue admin de soporte.

## DEC-FAC-058 · Forma de `nightInfo`
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente), objetable. **Hallazgo**: F-V2-045 (A-015,
B-021).
**Qué**: `entry_note_i18n` y `dress_code_note_i18n` como columnas JSONB del patrón `*_i18n` de la vertical (el valor
base va en la misma columna, como el resto), dentro de la sección `nightInfo` (DEC-FAC-040) y del purge. CHECK
`entry_price_from >= 0` y `entry_price_from IS NULL OR entry_kind = 'paid'`; Zod `min_age` entre 13 y 30, la
**menor** edad que aplica (la diferencia por género o por noche va a la nota). `entry_price_updated_at` se mueve
sólo cuando el valor **cambia**; pasar de `paid` a otro valor borra el precio y su fecha. No se ocultan precios
viejos: la fecha mostrada ya lo dice.
**Por qué**: sin estas reglas, un PATCH que reenvía el mismo precio dice «actualizado este mes» sobre un dato viejo,
y una entrada gratis conserva un precio que nadie ve.

## DEC-FAC-059 · Vocabulario de «sección»
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 2 (agente). **Hallazgo**: F-V2-058 (C-021).
**Qué**: «sección» en esta spec es la **sección del catálogo** (`ListingSection`). No es la sección del formulario
consolidado del admin (`apps/admin/src/features/listing/config/listingSections.ts`) ni `EditorSection` del web
(`editor-registry.ts:48`, que incluye `seo` y `calendar`). La propiedad de ruta sigue llamándose `listingSection`
(coincide con el tipo); el grep de los guards se ancla en la propiedad de `createProtectedRoute`, no en la palabra.

---

## Decisiones de las respuestas del owner a la vuelta 2

Respuestas del 2026-10-25 a `13-resolucion-vuelta-2/10-decisiones-del-owner.md` (Q-11…Q-20). Cada una cita su
pregunta y la decisión abierta (`OD-NN`) que cierra. Dos van contra la opción recomendada (Q-13 y Q-16); se dice en
cada una qué cambió por eso. DEC-FAC-040…059 siguen objetables: el owner no las objetó ni las aceptó explícitamente.

## DEC-FAC-060 · Cinco migraciones editadas, con regla general
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-11 (cierra OD-17). **Hallazgo**: F-V2-001.
**Qué**: además de 0129, 0144 y 0176 se editan la **0139** (sus dos CHECK `ck_addon_product_compatible_verticals` y
`ck_promo_code_verticals` pasan a `'venue'`) y la **0132** (`fix_request_entity_type_check`, por coherencia). Regla
general escrita en el sub-spec 1: se edita toda migración entre la 0125 y la de renombrado que fije un literal de
vertical del que dependa una fila insertada por una migración editada. Criterio: `db:migrate` desde cero en verde
antes de cualquier otra prueba.
**Por qué**: sin la 0139, la base no se arma desde cero (CI, plantilla, reset de staging, prod en el paso 3 del
corte). Mismo argumento que DEC-FAC-029: sólo corrieron en staging y local.
**Descartado**: dejar la 0176 con `'gastronomy'` y convertir la columna en la migración de renombrado (G18 rojo).
**Reemplaza**: la lista cerrada de tres de DEC-FAC-029 (la idea sigue).

## DEC-FAC-061 · Marcha atrás sin migración inversa
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-12 (cierra OD-18). **Hallazgo**: F-V2-020.
**Qué**: en staging, volver atrás = revertir el PR físico y otro reset (la misma ventana, al revés). En prod = la
marcha atrás del corte V6: restaurar el backup completo del paso 2b. Se conserva la lista escrita de lo que no
vuelve solo (historial, correos enviados, buscadores, redirects cacheados, cache de Cloudflare).
**Por qué**: con el catálogo nacido `venue` una inversa choca con `extras/041`, G18 y las FK, y quedaría para
siempre en la historia; prod no tiene datos de la vertical (DEC-FAC-027), así que el backup cubre todo.
**Descartado**: inversa de lo que no es catálogo, ensayada y nunca mergeada.
**Reemplaza**: la «migración inversa ensayada» de DEC-FAC-030 (el resto de DEC-FAC-030 sigue).

## DEC-FAC-062 · El enlace a la carta pasa a ser pago
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 3, **no** la recomendada). **Pregunta**: Q-13 (cierra OD-19).
**Hallazgo**: F-V2-009 (B-002, C-004).
**Qué**: `menuUrl` deja la sección común `price` y pasa a ser un campo de `menu`; toda la sección `menu` (carta
estructurada, archivo y enlace) queda bajo `manage_venue_menu`. Consecuencias: (1) se borra el comportamiento de
«enlace gratis» de `menu-projection.ts:101-103` (y su docblock y su test), y el proyector genérico lo quita en
`absent` y `locked`; (2) la ficha, los listados, el chat de IA, el folleto y el JSON-LD publican el enlace sólo con
`menu` `available`; (3) el editor lo mueve de `PriceSection.client.tsx` a la carta; (4) un local sin `food` (BOLICHE)
no tiene enlace de carta (sección `absent`); (5) `menu` vuelve a poder estar `locked` **entera** y, por DEC-FAC-051,
sus rasgos quedan `locked` con ella; el rasgo `file` se retira (tenía la clave de la sección y nunca podía diferir);
(6) `/carta/` con `menu` `available` y sólo el enlace → 302 `no-store` a la ficha, que muestra el enlace
(DEC-FAC-042); `hasMenu` sí lo cuenta. **Sin migración de datos ni comunicación**: prod tiene cero fichas de la
vertical (DEC-FAC-027) y `menuUrl` sigue siendo la misma columna.
**Por qué** (del owner): todavía no hay clientes, así que nadie pierde lo que tenía; un modelo de carta de una pieza
es más simple.
**Descartado**: rasgo `link` gratis dentro de `menu` (la recomendada); sección común `menuLink`.
**Efectos fuera del sub-spec**: la fila de la carta en la comparativa de planes incluye el enlace; el sub-spec 9 busca
y corrige cualquier texto que prometa el enlace gratis (embudo o `catalog.ts`).

## DEC-FAC-063 · Contenido de una sección `absent` para el dueño
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-14 (cierra OD-20). **Hallazgo**: F-V2-042.
**Qué**: el mismo trato que `locked` (DEC-FAC-025): el hub muestra un resumen «guardado y oculto por tus rubros» con
conteos y permite vaciar la sección. En `absent`, el paso 4b admite las intenciones `read` y `delete` **sólo si el
paso 4 resolvió «dueño»** (incluida la acción 15); `write` sigue en 409 `SECTION_ABSENT`; a un sujeto ajeno, `NOT_FOUND`
para todo. La exportación del dueño y la vista previa de purga incluyen todo lo guardado, también lo `absent` y
`locked`. Ningún lector público lo publica.
**Por qué**: el dueño controla sus datos sin tener que volver a agregar el rubro para borrarlos.
**Descartado**: inalcanzable hasta volver a agregar el rubro.
**Completa**: DEC-FAC-041 (dejaba `delete` en `absent` pendiente) y DEC-FAC-048.

## DEC-FAC-064 · Aviso antes de bajar de plan, en el MVP
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-15 (cierra OD-21). **Hallazgo**: F-V2-031.
**Qué**: la confirmación de bajada del web llama a un endpoint protegido del lado de verticales (no de billing) que,
por cada ficha del actor en la vertical del plan destino, corre el resolvedor puro con el conjunto efectivo real y
con uno **simulado** (la fuente «plan» reemplazada por la versión vigente del plan destino; addons y grants como
están) y devuelve lo que pasa a `locked`, con conteos de ítems guardados y QR de mesa activos con sus escaneos. Vive
en el sub-spec 5. Billing sigue sin leer rubros (G-FAC-07). El mecanismo es genérico; aplica a las verticales cuyas
secciones gobierna el resolvedor (venue y experiencia, no alojamiento hasta el hijo 8); se prueba y se smokea venue.
**Por qué**: la bajada de plan es el caso típico de `locked`, y sin aviso los QR de mesa mueren en silencio.
**Descartado**: post-MVP con issue propio.
**No verificado**: si la bajada cancela addons en el mismo acto (entonces el simulado también los resta).

## DEC-FAC-065 · Dimensiones de reseña declaradas en el catálogo
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 2, **no** la recomendada; con la regla dura «sin código por rubro
ni por vertical»). **Pregunta**: Q-16 (cierra OD-22). **Hallazgo**: F-V2-024 (B-008).
**Qué**: el catálogo (`@repo/schemas`) declara por vertical `ReviewRules`: dimensiones `{ id, labelKey,
boundSection? }` y `dimensionAveraging: 'votedOnly' | 'legacyImputed'`. Venue: `food` (ligada a `menu`), `service`,
`ambiance`, `value` (relación precio-calidad), `votedOnly`. El formulario de reseña ofrece la calificación general
(obligatoria) y cada dimensión como opcional; una dimensión ligada se ofrece **sólo si su sección no es `absent`**
según el mapa público del resolvedor (un RESTAURANT básico con la carta `locked` sí puntúa la comida; un BOLICHE no);
las no ligadas, siempre. El servidor valida igual (`validateReviewDimensions`, 400 `DIMENSION_NOT_APPLICABLE`). En
venue se quita la imputación de `overallRating` a las dimensiones; cada dimensión promedia **sólo sus votos**; el
`averageRating` de la ficha es el promedio de `overallRating`. La ficha muestra las dimensiones con al menos un voto;
la moderación del admin las muestra. **Aislamiento de experiencia**: la base compartida (`base-listing.service.ts`)
lee el modo de la vertical con default `legacyImputed` = el código de hoy movido sin cambios; experiencia (y
alojamiento, si la usa) no declara nada y queda igual, probado por un test *golden* contra valores capturados antes
del cambio. Guards: G-FAC-02 regla 12 y G-FAC-05 (formulario, recálculo y moderación sin literales de dimensión,
tipo ni vertical).
**Por qué** (del owner): quiere el desglose; la regla dura obliga a que sea por catálogo.
**Descartado**: no pedir dimensiones (la recomendada); dimensiones por rubro escritas en el componente.
**Reemplaza**: la parte de reseñas de DEC-FAC-035.

## DEC-FAC-066 · Comodidades de noche y filtros con fichas
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-17 (cierra OD-23). **Hallazgo**: F-V2-027.
**Qué**: se agregan ítems de noche al catálogo con dual-write (baseline + data-migration, HOS-25). Lista **propuesta
por el agente**, ajustable en la tarea: comodidades `dance_floor`, `vip_area`, `cloakroom`, `outdoor_smoking_area`;
características `dj_sets`, `karaoke` (`live_music`, `happy_hour` y `bar_service` ya existen). En las colecciones y
el listado general se ofrecen sólo los filtros con ≥1 ficha publicada en esa colección.
**Por qué**: arregla lo que ve el turista sin un catálogo paralelo que lea rubros.
**Descartado**: `applicable_business_lines`; post-MVP. **Aceptado**: el editor del boliche sigue viendo las casillas
de cocina.

## DEC-FAC-067 · Frontera entre BAR, PUB y CERVECERIA
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-18 (cierra OD-24). **Hallazgo**: F-V2-028.
**Qué**: CERVECERIA = produce su propia cerveza (artesanal); PUB = formato de bar con cerveza tirada y ambiente de
pub; BAR = barra y tragos, coctelería. Las descripciones es/en/pt (`venue.typeDescriptions.*`) se escriben con ese
criterio. El enum no cambia.
**Descartado**: fusionar PUB en CERVECERIA.
**Precisa**: DEC-FAC-038.

## DEC-FAC-068 · Textos aprobados y tile de la home
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1). **Pregunta**: Q-19 (cierra OD-25). **Hallazgo**: F-V2-030.
**Qué**: la tabla de traducciones y el texto legal +18 de la pregunta, aprobados tal cual (tabla en el sub-spec 6;
dress code en el sub-spec 4). La tile de la home pasa a «Eventos gastronómicos» / «Food events» / «Eventos
gastronômicos» y sigue llevando a la categoría de eventos; su clave y su imagen se renombran (`foodEvents`,
propuesto) en el sub-spec 1 y **salen de la exención (a) de G-FAC-R1**.
**Descartado**: «Para comer» / «Para salir».
**Ajusta**: la lista de (a) de DEC-FAC-044.

## DEC-FAC-069 · Copy neutro del embudo, en un hijo propio
**Fecha**: 2026-10-25 · **Decidió**: owner (opción 1); dónde vive lo decidió el agente. **Pregunta**: Q-20 (cierra
OD-26). **Hallazgo**: F-V2-016.
**Qué**: el copy de vertical de todo el embudo pasa a neutro dentro de este programa, antes de lanzar la noche, con
inventario cerrado (presentación, venta, precios, publicar, footer, puertas de descubrimiento, correos de prueba y
bienvenida, What's New de lanzamiento, ícono). Vive en un **hijo nuevo, sub-spec 9** (`sub-specs/9-copy-del-embudo.md`),
no en el 6: toca correos y superficies que el 6 no toca, no depende de HOS-1797 y se revisa mejor como contenido.
Depende de 1 y 2; ninguna superficie que ofrezca `nightlife` llega a prod sin él.
**Descartado**: issue post-MVP; correos por rubro (viola la regla 1).


---

## Decisiones de la resolución de la vuelta 3

Tomadas por el agente al resolver la vuelta 3 (`14-revision-vuelta-3/R-deltas.md`). Ninguna necesitó al owner: cada
una se deriva de una regla ya decidida. Todas son **objetables** y están en
`15-resolucion-vuelta-3/00-arreglos-aplicados.md`.

## DEC-FAC-070 · G-FAC-R1: historia frente a valores
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 3 (agente), objetable. **Hallazgo**: F-V3-001.
**Qué**: (1) las cinco migraciones editadas (0129, 0132, 0139, 0144, 0176) y sus `meta/` salen del escaneo de las
reglas 1-5 de G-FAC-R1, como historia: describen el esquema de un momento en que la tabla se llama `gastronomies`
(`0132_noisy_marvel_boy.sql:26-29` no se puede editar). En su lugar, un **chequeo de valores** propio: en esos cinco
archivos no queda ningún literal de valor viejo (`'gastronomy'` como vertical, `{gastronomy}`, claves
`*_gastronomy_*`/`*_gastronomies*`, slugs `gastronomy-*`/`*-gastronomy-*`/`*-gastronomies-*`, títulos
«Gastronomía»/«Gastronomy»); los nombres de tabla, columna, índice y enum quedan permitidos. (2) Salen también del
escaneo, como historia, los **tests de historia**: los que aplican migraciones hasta un tag anterior a la migración de
renombrado (uso de `journal.entries` o de un tag fijo, p. ej. `cut-migration-over-data.test.ts`,
`retire-user-impersonate-over-data.test.ts`) y los que importan un módulo de `packages/seed/src/data-migrations/`
(p. ej. `whats-new-seen-ids-rename.integration.test.ts`). La lista es cerrada, contada y **derivada** por el guard
(no escrita a mano): un test entra si y sólo si cumple uno de los dos predicados. Siguen siendo cinco exenciones.
**Mutaciones**: devolver `'gastronomy'` al `ck_vertical_id` de la 0129 → rojo (chequeo de valores); `const x =
'gastronomy'` en un test que no aplica migraciones ni importa una data-migration → rojo.
**Por qué**: con la versión de DEC-FAC-044 el guard nacía rojo y la única salida era angostarlo a mano.
**Descartado**: una sexta exención (rompe la regla de las cinco); reescribir los tests de historia (probarían un
esquema que no existió).
**Amplía**: DEC-FAC-044 («fuera del escaneo») y precisa cómo DEC-FAC-060 se escanea.

## DEC-FAC-071 · Forma de datos de las dimensiones de reseña
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 3 (agente), objetable. **Hallazgo**: F-V3-003.
**Qué**: para una vertical con `dimensionAveraging: 'votedOnly'`: (1) el schema del desglose de la reseña se
**deriva** del catálogo (`ReviewDimensionId<V>`), cada dimensión **opcional**, entero de **1 a 5**; «no votó» es la
**clave ausente**, nunca `0` ni `null` (un `0` se rechaza por forma); (2) el agregado de la ficha es
`Partial<Record<ReviewDimensionId<V>, { average: number; count: number }>>`: clave ausente = cero votos;
(3) `recomputeRating` recibe filas genéricas `Partial<Record<id, number>>` y la lista de dimensiones del catálogo;
(4) `averageRating` de la ficha = promedio de `overallRating`. `GastronomyRatingSchema` (→ venue) deja de existir como
lista escrita a mano de las cuatro claves. Experiencia sigue en el modo legado con su schema y su firma de hoy. Sin
migración de datos: prod tiene cero fichas de venue (DEC-FAC-027) y staging se resetea.
**Por qué**: hoy el schema exige las cuatro y admite `0` (`gastronomy-rating.schema.ts:27-75`), y sirve a la vez
para la entrada y el agregado (`gastronomy.review.schema.ts:64,134`, `gastronomy.schema.ts:156`): con `votedOnly`
la ficha mostraría «0» o rechazaría el agregado.
**Descartado**: `null` como «sin voto» (el código de hoy ya trata `null` como 0 en la base).

## DEC-FAC-072 · Promedio de una dimensión con su sección `absent`
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 3 (agente), objetable. **Hallazgo**: F-V3-002.
**Qué**: el lector público no publica el promedio ni el conteo de una dimensión cuya `boundSection` esté `absent` en
el mapa de la ficha; los votos se conservan en las reseñas y en el agregado y vuelven a verse si vuelve el rubro.
`locked` no oculta (el turista sí comió). Es una fila nueva de la lista cerrada de lectores (sub-spec 3). El agregado no
se recalcula al cambiar rubros: la decisión es de lectura.
**Por qué**: el agregado vive en la fila de la ficha y no es un campo de update, así que no está en los `fields` de
ninguna sección y el proyector genérico no lo quitaba; un restaurante que pasa a boliche mostraba «Comida». Lo
manda la regla 5.

## DEC-FAC-073 · Dónde vive el servidor de reseñas y qué hace experiencia
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 3 (agente), objetable. **Hallazgo**: F-V3-006.
**Qué**: (1) la validación en las rutas de alta de reseña (`validateReviewDimensions`), el recálculo `votedOnly` y el
test golden pasan al **sub-spec 3** (no los bloquea HOS-1797); el 6 se queda con formulario y ficha. (2) **Toda
vertical cuyas reseñas recalcula la base compartida declara `ReviewRules`**: experiencia declara sus cuatro
dimensiones de hoy (`food`, `service`, `ambiance`, `value`), **sin ligar**, con el modo legado; ya no hay default
implícito. Con eso el validador de experiencia acepta exactamente lo que acepta hoy. Alojamiento no usa la base
(sólo `GastronomyService` y `ExperienceService` extienden `BaseListingService`, `gastronomy.service.ts:124`,
`experience.service.ts:115`) y no declara nada. (3) El modo legado se llama **`legacyNullAsZero`**: es lo que hace la
base hoy (suma `null` como 0 y promedia las cuatro, `base-listing.service.ts:1022-1040`); la imputación de
`overallRating` vivía en el servicio de reseñas de venue (`gastronomy.review.service.ts:671-684`) y se borra con
`votedOnly`. El código de la base se mueve sin cambios a la rama `legacyNullAsZero`; el golden lo prueba.
**Por qué**: el 400 del boliche estaba exigido por el sub-spec 3 y construido en el 6; un validador genérico sin
dimensiones declaradas rechazaba el desglose que experiencia acepta hoy; y el nombre `legacyImputed` describía mal a
experiencia.
**Reemplaza**: en DEC-FAC-065, el default implícito, el nombre del modo y la ubicación del servidor.

## DEC-FAC-074 · `nightInfo`, `businessLines` y la lista de la acción 15
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 3 (agente), objetable. **Hallazgo**: F-V3-007.
**Qué**: las columnas de `nightInfo` entran a `LISTING_SUPPORT_EDIT_CONTENT_FIELDS`
(`listing-support-edit.ts:141-183`) además del `SET` del purge. `businessLines` entra a `LISTING_NON_CONTENT_FIELDS`
(`listing-owner-act.ts:68`): es **clasificación**, como en `PURGED` (sub-spec 2), así que la acción 15 no cambia rubros
y el cambio de rubros de un tercero sigue sólo por `venue.editAll`, con su registro y su aviso (sub-spec 7). G-FAC-10
compara también el `SET` del purge con `LISTING_SUPPORT_EDIT_CONTENT_FIELDS` (mismas columnas de contenido).
**Por qué**: la lista de la acción 15 es copia a mano del purge y nadie la vigilaba; sin esta regla, soporte no podía
corregir la nota de entrada, o alguien sumaba `businessLines` y abría un camino de cambio de rubros sin aviso.
**Descartado**: `businessLines` como contenido de la acción 15 (duplica el camino de `editAll` sin el aviso).

## DEC-FAC-075 · Vaciar una sección `absent`: sólo el dueño real
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 3 (agente), objetable. **Hallazgo**: F-V3-012.
**Qué**: en `absent`, el paso 4b admite `read` cuando el paso 4 resolvió «dueño» (incluida la acción 15, para que
soporte vea lo que ve el dueño) y admite `delete` **sólo si el actor es el dueño** (`actor.id === subjectId`). La
acción 15 con `delete` en `absent` recibe 409 `SECTION_ABSENT`. En `locked` no cambia nada.
**Por qué**: DEC-FAC-063 se tomó porque «el dueño controla sus datos»; dejar que soporte borre datos que el dueño ni
siquiera ve publicados contradice la razón, y el sub-spec 7 ya no le ofrece secciones `absent`.
**Reemplaza**: en DEC-FAC-063, la inclusión de la acción 15 para `delete`.

## DEC-FAC-076 · El sub-spec 9 bloquea el merge de 5 y 6
**Fecha**: 2026-10-25 · **Decidió**: resolución vuelta 3 (agente), objetable. **Hallazgo**: F-V3-008.
**Qué**: los sub-specs 5 (editor, ofrece `nightlife` en el alta) y 6 (colección `/rubro/noche/`) dependen del 9 y no
se mergean antes que él. El 9 depende sólo de 1 y 2: no hay ciclo.
**Por qué**: «no llega a prod sin el 9» dependía de recordarlo al promover `staging` → `main`, que es un gesto manual
sobre todo lo acumulado; un orden de merge se hace cumplir solo.
**Descartado**: interruptor que apague `nightlife` hasta que llegue el 9 (es un parche intermedio).
**Reemplaza**: el bloqueo de DEC-FAC-069 («ninguna superficie que ofrezca `nightlife` llega a prod sin él»).

## DEC-FAC-077 · La etapa B del renombrado va en la umbrella `epic/HOS-1801-renombrado-fisico`
**Fecha**: 2026-10-25 · **Decidió**: owner (al revisar el árbol de PRs).
**Qué**: la etapa B del sub-spec 1 se integra en la umbrella `epic/HOS-1801-renombrado-fisico`, con la convención `epic/**`
del repo (DEC-CI-001): cortada de `staging` después de la etapa A, los tramos de revisión son PRs a la umbrella, `staging`
se mergea en ella periódicamente y el único PR a `staging` es el de la umbrella (la hoja `1.B9` del árbol), con CI completo
en verde. Entre tramos la umbrella puede estar en rojo. `scripts/check-umbrella-branch-target.sh`, que hoy vigila una sola
umbrella (`UMBRELLA_BRANCH`), se extiende para vigilar también esta antes de cortarla (hoja `1.B0`).
**Por qué**: la etapa B es un único merge a `staging` (DEC-FAC-030) pero no se puede revisar entera; la umbrella da el
camino ya conocido y protegido por guard para trocearla sin que ningún tramo llegue a `staging` suelto.
**Descartado**: rama de integración `spec/HOS-1801-etapa-b` sin guard (propuesta del árbol, nadie impedía un `--base staging`).

## DEC-FAC-078 · HOS-1808 (admin) queda bloqueado por HOS-1804 (`nightInfo`)
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: se agrega la relación de hijos 7 ← 4: el admin depende de 2, 3 **y 4**.
**Por qué**: el criterio del admin con `nightInfo` (PATCH rechazado por el paso 4b) necesita las columnas del 4, y el
selector de tipo derivado del enum de la config consolidada lo hace el 4.

## DEC-FAC-079 · El servidor completa los rubros con la preselección del tipo
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: si un alta omite `businessLines`, el servicio de alta completa `typeRules[type].preselect` (DEC-FAC-010) en toda
vertical: BOLICHE → `{nightlife}`, un tipo sólo de comida → `{food}`, alojamiento y experiencia → `{standard}`. Es
comportamiento permanente para web, admin, seed y cualquier cliente de la API. Va en el mismo PR que crea la columna.
**Por qué**: `venues` no tiene default en base (DEC-FAC-046) y el alta del web no manda rubros hasta el sub-spec 5; sin
esto el alta se rompía entre la columna y el selector. La preselección ya es la respuesta del catálogo para «qué rubros
tiene este tipo por defecto».
**Descartado**: un default en la base de `venues` (DEC-FAC-046: el rubro no se adivina en la base) y un parche temporal.
**Reemplaza**: en el sub-spec 2, «Default del servidor» sólo para verticales de un rubro.

## DEC-FAC-080 · El smoke del alta como boliche va con el sub-spec 5
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: la parte «alta como boliche y recibir el primer correo de prueba» del smoke del sub-spec 9 pasa a un criterio
nuevo del sub-spec 5 (smoke de staging del alta); el 9 conserva presentación → precios → publicar.
**Por qué**: el alta como boliche necesita el selector de rubros del 5, y el 5 no se mergea antes que el 9
(DEC-FAC-076): el smoke del 9 no se podía firmar.

## DEC-FAC-081 · «Una ficha = un local físico = una dirección»: issue relacionada, sin bloquear
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: la regla va en una issue aparte (HOS-1810), relacionada con HOS-1787 y sin bloquear ningún hijo; el sub-spec 5 no la espera
y el árbol de PRs no la modela.
**Reemplaza**: en el sub-spec 5, «antes de implementar este sub-spec».

## DEC-FAC-082 · Cada hoja del árbol lleva su etapa
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: toda hoja del árbol (`docs/20-arbol-linear/arbol.json`) declara `etapa`: `pre-corte` (mergeada antes de que
HOS-1352 promueva `staging` → `main`), `mvp` (antes del lanzamiento v1, puede caer después del corte) o `post-mvp`. Una
hoja `pre-corte` nunca depende de una `mvp`/`post-mvp`, y una `mvp` nunca de una `post-mvp`; `chequeo.py` lo hace cumplir.
Todo HOS-1801 es `pre-corte`; el resto, `mvp`, salvo `5.5` (`post-mvp`, DEC-FAC-083). De las tres candidatas que se
consultaron, `7.3` (registro y aviso al dueño) y `7.4` (REQUEST_FIX y vista de soporte) quedan `mvp`.
**Labels de Linear**: `pre-corte` → `pre-corte-1352` (label nuevo del team Hospeda, color `#DC2626`, «Debe estar
mergeado antes de que HOS-1352 promocione staging → main»), `mvp` → `pre_v1_product`, `post-mvp` → `post_v1`. Los hijos
existentes también lo llevan: HOS-1801 `pre-corte-1352`, HOS-1802…1808 `pre_v1_product`, HOS-1809 `post_v1`;
`crear_arbol.py` los **agrega** sin quitar los labels que ya tienen.

## DEC-FAC-083 · El aviso antes de bajar de plan pasa a post-MVP
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: la hoja `5.5` (endpoint `section-preview` y aviso en la confirmación de bajada, DEC-FAC-064) es `post-mvp`. El
diseño y su criterio (`AC:5:5`) se conservan en el sub-spec 5. La hoja `5.6` deja de depender de ella (pasa a depender de
`5.4`) y `5.5` depende sólo del resolvedor (`3.12`). G-FAC-05 nace sin su archivo y lo suma cuando entre.
**Reemplaza**: en DEC-FAC-064, «MVP».

## DEC-FAC-084 · HOS-1801 bloquea a HOS-1352
**Fecha**: 2026-10-25 · **Decidió**: owner.
**Qué**: relación `blocks` real en Linear: HOS-1352 queda bloqueado por HOS-1801 (el renombrado). `crear_arbol.py` la crea
si falta.
**Por qué**: el renombrado es bloqueante del corte V6 (DEC-FAC-028); hasta ahora sólo lo decía el texto.

## DEC-FAC-085 · El literal de `nightInfo` sale del sub-spec 3
**Fecha**: 2026-10-25 · **Decidió**: orquestador.
**Qué**: `AC:3:2` deja de nombrar las rutas de `nightInfo` (quedan carta, menú del día y eventos) y `AC:3:3` se reescribe
sobre una sección que ya existe: la carta (`menu`, ligada al rubro `food`; BOLICHE es `{nightlife}`, sub-spec 2). La
versión con `nightInfo` (agregar `nightlife` y cargarla en el mismo PATCH, quitarla y cargarla, alta de una HELADERIA con
sus campos) pasa a `AC:4:3`.
**Por qué**: el sub-spec 4 depende del 3, así que un AC del 3 que nombra `nightInfo` no se podía cumplir en su hoja.

## DEC-FAC-086 · Todas las carpetas de `.specs/` quedan fuera del escaneo de G-FAC-T1/R1
**Fecha**: 2026-10-25 · **Decidió**: orquestador.
**Qué**: lo fuera del escaneo deja de ser la lista cerrada «specs de HOS-1352/1353/1354 y esta spec» y pasa a ser el
prefijo `.specs/` entero.
**Por qué**: una spec es un registro histórico que nombra la vertical vieja a propósito. Con la lista cerrada, cada spec
nueva que mergea a staging rompe el guard (pasó con `.specs/HOS-1878-billing-analytics-events/spec.md` al mergear staging
en HOS-1813) y obliga a editar el guard por algo que no es código.
**Reemplaza**: la enumeración de specs en «Fuera del escaneo» de `06-guards.md` y del sub-spec 1.
