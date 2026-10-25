---
title: Sub-spec 2 · Catálogos de rubros y secciones + columna en base
linear: HOS-1802 (hijo de HOS-1787)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (resolución de la vuelta 3)
---

# 2 · Catálogos de rubros y secciones + columna `business_lines`

Decisiones: DEC-FAC-004, 005, 007 (parte de código), 008, 015, 020, 022, 024, 026, 031, 033, 034, 036, 038, y
de la vuelta 2: 040, 043, 045, 046, 047, 049, 050, 051, 058, 059, y de las respuestas del owner: 062 (enlace de carta
pago), 065 (dimensiones de reseña), 067 (frontera de tipos) y 068 (textos), y de la vuelta 3: 071, 072 y 073
(dimensiones de reseña). Depende de 1. Vocabulario final en
DEC-FAC-031: **rubro = `BusinessLine`**, **sección de contenido = `ListingSection`**, **rasgo = `SectionTrait`**.
La palabra «capacidad/capability» queda sólo para la clave de entitlement (HOS-1353). «Sección» es siempre la
sección del catálogo, no la del formulario del admin ni `EditorSection` del web (DEC-FAC-059).

## En código (`packages/schemas/src/catalog/`)

**Secciones de contenido**, por vertical, con **rasgos** (F-V1-006, DEC-FAC-020) y **campos** (DEC-FAC-040):

```ts
/** Ids literales por vertical, derivados del catálogo (F-V1-031, F-V2-037). */
type ListingSectionId<V extends ListingVertical> = /* unión literal derivada del catálogo */;
type SectionTraitId<V extends ListingVertical, S extends ListingSectionId<V>> = /* ídem, por sección */;

interface SectionTraitDefinition<V, S> {
  readonly id: SectionTraitId<V, S>;            // 'itemPhotos', 'translations', 'qr', 'qrMetrics', 'directions'
  readonly entitlementKey?: EntitlementKeyEnum; // la clave propia del rasgo
}

interface ListingSectionDefinition<V extends ListingVertical = ListingVertical> {
  readonly id: ListingSectionId<V>;             // 'menu', 'dailySpecials', 'nightInfo', 'meetingPoint'…
  readonly vertical: V;                         // sólo verticales con ficha
  readonly common: boolean;                     // aplica a cualquier rubro de la vertical
  readonly entitlementKey?: EntitlementKeyEnum; // si el plan restringe la sección entera
  readonly traits?: readonly SectionTraitDefinition<V, ListingSectionId<V>>[];
  readonly fields: readonly (keyof UpdateInputOf<V>)[]; // campos de la ficha que son de la sección, incluidos sus *I18n
  readonly headingWhenMultiLineKey?: string;    // título si la ficha tiene más de un rubro con secciones propias (DEC-FAC-050)
  readonly order: number;                       // orden de presentación (editor y ficha)
  readonly group: 'property' | 'content' | 'management';
}
```

**Campos por sección** (DEC-FAC-040, F-V2-006): `fields` está tipado contra el schema de update de la vertical,
así que un campo renombrado no compila. Una sección de subrecurso con tabla propia (carta, menú del día, eventos)
puede tener `fields` vacío. Los campos traducibles de una sección no común (`entry_note_i18n`,
`dress_code_note_i18n`) pertenecen a **esa** sección y se editan dentro de ella, no por la común `translations`.
De `fields` salen, sin otra lista:
- `sectionsTouchedByBody({ vertical, body })` (en este módulo): qué secciones toca un cuerpo, por presencia de
  campos **no nulos** (DEC-FAC-021); lo usan las rutas que escriben varias secciones;
- el proyector público genérico del sub-spec 3, que quita los `fields` de toda sección no `available`;
- `LISTING_SECTION_PAYLOAD_KEYS` del web (`listing-section-payload.ts`), derivado en vez de escrito a mano.

Un **rasgo** vive dentro de una sección: hereda `absent` de ella, queda `locked` si la sección está `locked`
(DEC-FAC-051) y suma su propia clave para `locked`. No es una sección del editor.

**Rubros**, por vertical:

```ts
type BusinessLineValue<V extends ListingVertical> = /* unión literal por vertical: venue → 'food' | 'nightlife' */;
type BusinessLine = BusinessLineValue<ListingVertical>;

interface BusinessLineDefinition<V extends ListingVertical = ListingVertical> {
  readonly vertical: V;
  readonly value: BusinessLineValue<V>;                   // valor interno, en inglés
  readonly urlSlug?: string;                              // sólo si es público: 'gastronomia', 'noche'
  readonly public: boolean;                               // tiene colección pública (DEC-FAC-011)
  readonly sections: readonly ListingSectionId<V>[];      // sólo las NO comunes
}
```

**Restricciones** (DEC-FAC-026): declaraciones por vertical, sin código por vertical.

```ts
interface BusinessLineRules<V extends ListingVertical = ListingVertical> {
  readonly vertical: V;
  readonly maxPerListing?: number;                                          // p. ej. 2
  readonly excludes?: readonly (readonly [BusinessLineValue<V>, BusinessLineValue<V>])[];
  readonly typeRules: Readonly<Record<ListingTypeOf<V>, {                   // exhaustivo sobre el enum de tipo (F-V2-037)
    readonly allowed: readonly BusinessLineValue<V>[];                      // conjunto permitido (DEC-FAC-034)
    readonly preselect: readonly BusinessLineValue<V>[];                    // ⊆ allowed
    readonly fieldDefaults?: Partial<UpdateInputOf<V>>;                     // sugerencia del alta (DEC-FAC-050)
  }>>;
}
```

**Validador genérico** en `@repo/schemas` (`validateBusinessLines({ vertical, type, businessLines })`, RO-RO,
devuelve error tipado): no vacío, **sin repetidos** (y el escritor normaliza a orden estable, DEC-FAC-047),
valores de esa vertical, `maxPerListing`, `excludes` y `allowed` del tipo. En el mismo módulo y con las mismas
reglas, **`resolveBusinessLineOptions({ vertical, type, selected }) → { value, selectable, reason? }[]`**: lo que el
selector del alta y el admin pueden ofrecer (con un `excludes` futuro, las opciones dependen de lo ya marcado;
F-V2-036). Ninguna validación de rubros vive fuera de este módulo (G-FAC-09); los escritores directos (tests,
fábricas, scripts) no están obligados a llamarlo: la base es la garantía (CHECK y default, abajo).

**Contrato del rechazo** (F-V2-055): el API responde **400 `VALIDATION_ERROR`** con `details.field =
'businessLines'` y una razón (`EMPTY`, `DUPLICATE`, `NOT_IN_VERTICAL`, `NOT_ALLOWED_FOR_TYPE`, `MAX_EXCEEDED`,
`EXCLUDED_PAIR`); claves `zodError.venue.businessLines.*` en es/en/pt; fila nueva en
`apps/api/docs/error-contract.md`. Un valor ajeno a la vertical se rechaza por **forma** (el schema de entrada de
cada vertical usa el enum de su vertical), antes del validador.

**Límite de rubros por plan: contrato del punto de extensión** (F-V2-039; no se implementa, DEC-FAC-006): si algún
día «el básico admite 1 rubro», (a) es una clave de limit de scope `vertical` evaluada en el **paso 7** con
`requested = |rubros resultantes|`; (b) el `limit` de la ruta recibe el cuerpo validado (hoy no lo recibe); (c) bajar
de plan nunca toca los rubros: sólo frena agregar; (d) los caminos sin cadena (seed, importaciones, scripts) no lo
aplican, y eso se acepta. No es una regla del catálogo y billing sigue sin leer rubros (DEC-FAC-003, G-FAC-07).

## Contenido inicial

Hoy ninguna vertical declara `maxPerListing` ni `excludes`; la declaración existe para cuando haga falta.

| vertical | rubro (valor) | slug de URL | público | secciones propias |
|---|---|---|---|---|
| venue | `food` | `gastronomia` | sí | `menu`, `dailySpecials` |
| venue | `nightlife` | `noche` | sí | `nightInfo` |
| accommodation | `standard` | — | no | ninguna (todas comunes, tabla abajo) |
| experience | `standard` | — | no | ninguna (todas comunes, tabla abajo) |

**Secciones por vertical** (lista cerrada, F-V2-012). Los ids son los de los registros del editor de hoy
(`apps/web/src/lib/editor/{listing,gastronomy,experience,accommodation}-editor-sections.ts`); alojamiento conserva
`photos` (renombrarlo es del hijo 8). `fields` se completa en la tarea desde `listing-section-payload.ts` y el schema
de update de cada vertical, con la regla 11 de G-FAC-02 como prueba.

| vertical | sección | común | grupo | clave de la sección | rasgos (clave) |
|---|---|---|---|---|---|
| venue | `basicInfo` | sí | property | — | — (los rubros se editan acá) |
| venue | `openingHours` | sí | property | — | — |
| venue | `price` | sí | property | — | — (`menuUrl` **sale** de acá, DEC-FAC-062) |
| venue | `amenities` | sí | property | — | — |
| venue | `media` | sí | content | — | — |
| venue | `contact` | sí | content | — | — |
| venue | `faqs` | sí | content | — | — |
| venue | `menu` | no (`food`) | content | `manage_venue_menu` (cubre carta estructurada, archivo **y el enlace externo `menuUrl`**, que pasa a ser campo de esta sección; DEC-FAC-062) | `itemPhotos` (`menu_item_photos`), `translations` (`multilingual_venue_menu`), `qr` (`menu_qr_scan_metrics`, DEC-FAC-051), `qrMetrics` (`menu_qr_scan_metrics`) |
| venue | `dailySpecials` | no (`food`) | content | `manage_venue_daily_special` | — |
| venue | `nightInfo` | no (`nightlife`) | property | — (gratis) | — ; `headingWhenMultiLineKey` = «De noche» |
| venue | `venueEvents` | sí | content | `manage_venue_events` | — |
| venue | `translations` | sí | management | — | — |
| experience | `basicInfo`, `openingHours`, `price`, `amenities`, `media`, `contact`, `faqs`, `translations` | sí | como venue | — | — |
| experience | `meetingPoint` | sí | property | — | `directions` (`manage_experience_directions`, DEC-FAC-049) |
| experience | `practicalInfo` | sí | property | — | — |
| accommodation | `basicInfo`, `capacityPricing`, `location`, `amenities` | sí | property | — | — |
| accommodation | `photos`, `faqs`, `contact`, `seo` | sí | content | — | — |
| accommodation | `calendar` | sí | management | `can_use_calendar` | `externalSync` (`can_sync_external_calendar`) |
| accommodation | `translations` | sí | management | la que hoy gobierna su `visibilityKey` (`'translations'`, `accommodation-editor-sections.ts:37`): se confirma en la tarea contra el código | — |
| accommodation | `externalReputation` | sí | management | — | — |

**La carta entera es paga** (DEC-FAC-062, Q-13 = 3): `menuUrl` deja la sección común `price` y entra a los `fields`
de `menu`, y todo `menu` queda bajo `manage_venue_menu`; la sección vuelve a poder estar `locked` entera (en el plan
básico lo está, enlace incluido) y por DEC-FAC-051 sus rasgos quedan `locked` con ella. El rasgo `file` se retira: tenía
la misma clave que la sección, así que nunca podía estar en un estado distinto. Un local sin `food` (BOLICHE) no tiene
enlace de carta. Como prod tiene cero fichas de la vertical (DEC-FAC-027) y staging se resetea, **no hay migración de
datos ni comunicación a dueños**: `menuUrl` sigue siendo la misma columna, sólo cambia de sección.

Las claves de venue son las de la vuelta 1 con el nombre final (DEC-FAC-029). Alojamiento declara sus claves
reales para que el resolvedor no mienta; su editor sigue con la lista manual congelada (G-FAC-08, que además
compara esta tabla con esa lista) y su gating público por campo no cambia (DEC-FAC-033, 049). Las claves de campo
de alojamiento (video, descripción enriquecida, insignia) no son secciones ni rasgos de este catálogo: son del
hijo 8.

**Tipos de venue** (`VenueTypeEnum`, DEC-FAC-034). Cualquier subconjunto **no vacío** del permitido es válido:

| tipo | permitidos | preselección en el alta | `fieldDefaults` |
|---|---|---|---|
| RESTAURANT | `food`, `nightlife` | `food` | — |
| CAFE, PARRILLA, HELADERIA, PANADERIA, ROTISERIA, FOOD_TRUCK | `food` | `food` | — |
| BAR, CERVECERIA, PUB | `food`, `nightlife` | `food`, `nightlife` | — |
| BOLICHE | `nightlife` (únicamente; si tiene cocina, el dueño elige BAR o RESTAURANT) | `nightlife` | `{ minAge: 18 }` (sugerencia) |

(`BAR` y `PUB` coexisten, DEC-FAC-038.) Alojamiento y experiencia: todos sus tipos permiten sólo `standard`, que
la base asigna por default.

**Tipos nuevos `PUB` y `BOLICHE` nacen acá** (DEC-FAC-045, F-V2-041; antes estaban en el sub-spec 4): la matriz y
G-FAC-02 regla 5 los necesitan. En este hijo: enum TS + `ALTER TYPE … ADD VALUE`, los `Record<Enum, …>` exhaustivos
(íconos, labels, slugs), claves i18n de etiqueta **y de descripción** (`venue.typeDescriptions.*`, es/en/pt, las dos
tablas de labels de web y admin juntas), y la descripción visible **debajo del selector de tipo** del alta y del
admin (F-V2-028). Frontera (DEC-FAC-067, Q-18): **BAR** = barra y tragos, coctelería; **PUB** = formato de bar con
cerveza tirada y ambiente de pub; **CERVECERIA** = **produce** su propia cerveza (artesanal). Las descripciones
es/en/pt se escriben con ese criterio. **Ninguna migración versionada usa
`BOLICHE` ni `PUB` como valor del enum**: `drizzle-kit migrate` corre todas las pendientes en una transacción y
Postgres no deja usar un valor agregado hasta el commit; toda comparación SQL es sobre `type::text`. Los usos
reales viven en el seed. En portugués BOLICHE es «balada».

**Mapa de URL**: `food` ↔ `gastronomia`, `nightlife` ↔ `noche` (como el web ya hace con los tipos de
alojamiento). El valor interno nunca va en la URL; el slug nunca va en código fuera del mapa (exención b de
G-FAC-R1).

**Presentación** (F-V1-048): el dominio (`id`, `common`, claves, rasgos, campos, rubros, reglas) vive en
`@repo/schemas`. La presentación (slug de la sección del editor, `labelKey`, componente) vive en el web, en un
`Record<ListingSectionId<V>, { slug, labelKey, Component }>` exhaustivo por vertical: una sección nueva no compila
sin su página. `order`, `group` y `headingWhenMultiLineKey` se quedan en el catálogo porque los usan la ficha
pública y el editor por igual.

**Etiquetas** (DEC-FAC-022, DEC-FAC-068): la etiqueta visible de cada rubro sale de i18n; textos aprobados: `food` =
«Gastronomía» / «Food & drink» / «Gastronomia»; `nightlife` = «Noche» / «Nightlife» / «Vida noturna» (tabla completa en
el sub-spec 6); el valor
del rubro es interno y el slug español sólo vive en la URL. `standard` no necesita etiqueta visible.

## Dimensiones de reseña (DEC-FAC-065, Q-16 = 2)

Las dimensiones de reseña se **declaran en el catálogo**, por vertical, y cada una puede ligarse a una sección. No hay
código por rubro ni por vertical: el formulario, la validación, el recálculo y el admin leen la declaración.

```ts
interface ReviewDimensionDefinition<V extends ListingVertical = ListingVertical> {
  readonly id: ReviewDimensionId<V>;              // unión literal por vertical
  readonly labelKey: string;                      // i18n
  readonly boundSection?: ListingSectionId<V>;    // se ofrece sólo si esa sección no es `absent` en la ficha
}

interface ReviewRules<V extends ListingVertical = ListingVertical> {
  readonly vertical: V;
  readonly dimensions: readonly ReviewDimensionDefinition<V>[];
  readonly dimensionAveraging: 'votedOnly' | 'legacyNullAsZero';  // ver abajo (DEC-FAC-073)
}
```

- **venue**: `food` (ligada a `menu`), `service`, `ambiance`, `value` (relación precio-calidad, el nombre que ya
  usa el código; no «precio»). `dimensionAveraging: 'votedOnly'`.
- **experience** (DEC-FAC-073): declara sus cuatro dimensiones de hoy (`food`, `service`, `ambiance`, `value`), **sin
  ligar**, con `dimensionAveraging: 'legacyNullAsZero'`. No hay default implícito: toda vertical cuyas reseñas recalcula
  la base compartida declara `ReviewRules` (G-FAC-02 regla 12). `legacyNullAsZero` es el cálculo de hoy de la base
  (`base-listing.service.ts:1022-1040`: suma `null` como 0 y promedia las cuatro), movido sin cambios; así experiencia
  no cambia sus promedios visibles (test golden, sub-spec 3). Pasarla a `votedOnly` es un cambio visible y va aparte.
- **accommodation**: no usa la base compartida (sólo `GastronomyService` y `ExperienceService` extienden
  `BaseListingService`, `gastronomy.service.ts:124`, `experience.service.ts:115`) y no declara `ReviewRules`.
- **Forma de datos en `votedOnly`** (DEC-FAC-071): el schema del desglose se **deriva** de las dimensiones declaradas
  (no hay una lista escrita a mano como la de `gastronomy-rating.schema.ts:27-75`); cada dimensión es **opcional**,
  entero de **1 a 5**; «no votó» es la **clave ausente** (un `0` o un `null` se rechazan por forma). El agregado de la
  ficha es `Partial<Record<ReviewDimensionId<V>, { average: number; count: number }>>` (clave ausente = cero votos) y
  `averageRating` = promedio de `overallRating`. `recomputeRating` recibe filas `Partial<Record<id, number>>` y la
  lista de dimensiones del catálogo. Sin migración de datos (cero fichas de venue en prod; staging se resetea).
- **Publicación con la sección `absent`** (DEC-FAC-072): el promedio de una dimensión ligada a una sección `absent`
  no se publica; los votos se conservan (lector en la tabla del sub-spec 3).
- Reglas: una dimensión ligada apunta a una sección **no común** de su vertical (ligar a una común no cambiaría nada);
  la regla es «se ofrece si la sección ligada no es `absent`», así que un RESTAURANT básico (carta `locked`) sí
  puntúa la comida; un BOLICHE no. Las no ligadas se ofrecen siempre.
- Validador genérico `validateReviewDimensions({ vertical, sectionStates, rating })` en el mismo módulo: rechaza una
  dimensión ajena a la vertical (por forma) o ligada a una sección `absent` con **400 `VALIDATION_ERROR`**, `details.field
  = 'rating.<id>'`, razón `DIMENSION_NOT_APPLICABLE`; claves `zodError.review.dimension.*`; fila en `error-contract.md`.
- Cubierto por G-FAC-02 (regla 12) y G-FAC-05.

## En base (DEC-FAC-026, 046, 047)

- **Columna** `business_lines text[] NOT NULL` en `venues`, `accommodations` y `experiences`. Sin tabla espejo ni
  tablas de relación.
- **Default** (DEC-FAC-046, F-V2-018): `DEFAULT ARRAY['standard']`, generado desde el catálogo, sólo en las tablas de
  verticales con un único rubro (`accommodations`, `experiences`). `venues` **sin default**: el rubro de un local no
  se adivina; los escritores directos de venue (fábricas, tests, fixtures) se ajustan en el mismo PR.
- **CHECK** generado desde el catálogo en el `dbschema` (como `ck_vertical_id`), por tabla:
  `cardinality(business_lines) >= 1 AND business_lines <@ ARRAY[…valores de esa vertical…]`, y en `venues` además
  la **matriz por tipo** (DEC-FAC-047, F-V2-022): `AND CASE type::text WHEN 'BOLICHE' THEN business_lines <@
  ARRAY['nightlife'] WHEN … ELSE false END`. Cubierto por la guarda de drift y por G-FAC-01. Si una regla futura es
  estática (máximo N, exclusión), el generador la suma igual.
- **Secuencia del `ADD COLUMN`** (F-V2-018): `ADD COLUMN` nullable (o con su default) → backfill → `SET NOT NULL` →
  `ADD CHECK`; el `ADD COLUMN … NOT NULL` que emite Drizzle falla sobre una tabla con filas.
- **Índice GIN** sobre `business_lines` para las colecciones.
- **Orden del arreglo**: sin significado; el escritor lo normaliza a orden estable. Si algún día hace falta un
  «rubro principal», el primer elemento lo es (punto de extensión documentado, sin uso hoy).
- **Entrada**: `businessLines: BusinessLineValue<V>[]`. La vertical **no** viaja en el cuerpo: la pone el servidor
  (G2c pone rojo una propiedad `vertical` en un schema de update de ficha, F-V1-047).
- **Default del servidor**: si la vertical tiene exactamente un rubro y el cliente no manda rubros, queda el de la
  base (`standard`). El schema de alta de alojamiento y experiencia no pasa a exigir `businessLines` (F-V1-036).
- **Backfill** (F-V1-017): en la **migración versionada** que crea la columna, no en el carril de seed (si no, entre
  el deploy y `db:seed:migrate` toda ficha tendría cero rubros y el resolvedor ocultaría la carta). Incluye las
  fichas con `deleted_at`. El `CASE type::text` del SQL usa la **preselección** del tipo y termina en `ELSE` (sin
  él, un tipo no listado da `NULL` y viola el `NOT NULL`). Su test compara contra la **lista fija de valores del
  enum que existían en esa migración** (escrita en el test), no contra el `typeRules` vivo, para no quedar rojo
  cuando se agregan tipos (F-V2-044).
- **Evolución del catálogo** (F-V1-034): si un cambio saca un rubro de los permitidos de un tipo, el mismo PR migra
  las fichas afectadas y regenera el CHECK; el validador corre sólo cuando un pedido cambia el tipo o los rubros,
  así que una ficha vieja nunca bloquea un guardado que no los toca (y el CHECK ya impide que exista).
- **Secciones**: sólo en código (no tienen FK que proteger).
- **Cuándo reconsiderar**: las tablas de relación sólo ganan si hace falta un atributo por asociación (estado de
  moderación por rubro, fechas); hoy no se prevé ninguno.

## En `PURGED` (F-V1-017)

- La clasificación por rubro **se conserva** en `PURGED`: no es contenido del dueño, es clasificación, y mantiene la
  invariante «≥1». Vive en la fila de la ficha, así que no agrega tablas a `scripts/guards/purged-closed-list.json`;
  G-FAC-10 la cuenta como columna de clasificación.
- Los datos de `nightInfo` se borran con el contenido (sub-spec 4).

## Seed

Baseline: las fichas de ejemplo traen `businessLines` según la preselección de su tipo. En entornos vivos los
rubros ya los escribió el backfill de la migración versionada, así que la data-migration que el dual-write exige
(`check-seed-dual-write.sh`) es una **verificación**: no escribe nada y falla si encuentra una ficha con
`business_lines` vacío (F-V2-049).

## Guards

G-FAC-01 (el CHECK, la matriz y el default coinciden con el catálogo), G-FAC-02 (integridad, reglas 1-12), G-FAC-07
(billing no lee rubros) y G-FAC-09 (un solo validador), ver `../docs/06-guards.md`.

## Criterio de aceptación

- **AC:2:1** — Catálogos tipados y exportados; ids como unión literal por vertical; G-FAC-02 en verde con sus
  mutaciones.
- **AC:2:2** — G-FAC-01 en verde con sus mutaciones.
- **AC:2:3** — G-FAC-07 y G-FAC-09 en verde con sus mutaciones.
- **AC:2:4** — Migración aplicada desde cero (con todas las pendientes juntas, incluido el `ADD VALUE`) y sobre seed; toda ficha
  existente, incluidas las borradas, con ≥1 rubro; una inserción con `business_lines = '{}'`, con un valor ajeno a
  la vertical o con BOLICHE `{food}` es rechazada por la base; una inserción directa en `accommodations` sin la
  columna recibe `{standard}`.
- **AC:2:5** — Test del validador por regla: no vacío, repetidos, valor ajeno, tipo que no admite el rubro (heladería con
  `nightlife`), `maxPerListing` y `excludes` con un catálogo de prueba que los declare; y de
  `resolveBusinessLineOptions` con los mismos casos.
- **AC:2:6** — Test del `CASE` del backfill contra la lista fija del enum de esa migración, con `ELSE`.
- **AC:2:7** — `PUB` y `BOLICHE` visibles en el alta con su descripción en es/en/pt, con la frontera de DEC-FAC-067.
- **AC:2:8** — `menuUrl` pertenece a `menu` (regla 11 de G-FAC-02 en verde, con `price` sin `menuUrl`).
- **AC:2:9** — Test de `validateReviewDimensions`: `food` en un BOLICHE → `DIMENSION_NOT_APPLICABLE`; en un RESTAURANT con `menu`
  `locked` → válido; dimensión ajena a la vertical → rechazo por forma; `food: 0` en venue → rechazo por forma; una
  reseña de experiencia con las cuatro dimensiones → válida (igual que hoy).
- **AC:2:10** — `ReviewRules` de experiencia declarado con `legacyNullAsZero`; G-FAC-02 regla 12 rojo si se borra.
