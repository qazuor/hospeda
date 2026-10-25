---
title: Sub-spec 3 · Resolvedor de secciones y paso de autorización
linear: HOS-1803 (hijo de HOS-1787)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (resolución de la vuelta 3)
---

# 3 · Resolvedor + paso de autorización

Decisiones: DEC-FAC-008, 009, 018, 019, 020, 021, 023, 031, 033, 037, y de la vuelta 2: 040, 041, 042, 048, 049,
050, 051, 055, y de las respuestas del owner a la vuelta 2: 062 (enlace de carta pago), 063 (contenido `absent`),
064 (vista previa de la bajada) y 065 (dimensiones de reseña), y de la vuelta 3: 071, 072, 073 (servidor de
reseñas, que vive acá) y 075 (vaciar `absent`). Depende de 2. Base: [discovery B §3-4](../docs/05-discovery-b-superficies.md). Vocabulario de
DEC-FAC-031: **sección** (`ListingSection`), **rasgo** (`SectionTrait`), estados `absent | locked | available` (en
UI y docs: AUSENTE / BLOQUEADA / DISPONIBLE). «Capacidad» sólo significa clave de entitlement; el código de error
`NO_CAPABILITY` del paso 6 es el existente de HOS-1353 y no se renombra.

## El resolvedor (`packages/verticals/src/listing-sections/`)

Función pura:

```ts
resolveListingSections<V>({
  vertical, businessLines,   // rubros de la ficha
  effectiveSet,              // conjunto efectivo del DUEÑO (V3), por user + vertical, ya leído
}): {
  sections: ReadonlyMap<ListingSectionId<V>, {
    state: 'absent' | 'locked' | 'available';
    traits: ReadonlyMap<SectionTraitId<V, ListingSectionId<V>>, 'absent' | 'locked' | 'available'>;
  }>;
  multiLine: boolean;        // más de un rubro de la ficha tiene secciones propias en estado ≠ absent (DEC-FAC-050)
}
```

Regla única, por sección `s` de la vertical:
- `absent` si `!s.common` y ningún rubro de la ficha la lista; todos sus rasgos quedan `absent`;
- si no, `locked` si `s.entitlementKey` existe y no está otorgada; **todos sus rasgos quedan `locked`**
  (DEC-FAC-051, F-V2-025);
- si no, `available`; cada rasgo es `locked` si su clave no está otorgada, si no `available`.

«Otorgada» **no** se reimplementa (F-V1-015, F-V2-056): `entitlement-step.ts` expone un predicado puro
`isGranted({ effective, key })` (la regla «valor efectivo > 0» de `resolveEntitlementStep`,
`entitlement-step.ts:21-38`) que usan el paso 6 y el resolvedor sobre un conjunto efectivo **ya leído**: una
implementación y una sola lectura por ficha (por dueño en los listados), no una por sección × rasgo. Un id de
sección o de rasgo desconocido **lanza** (como `UnknownStepKeyError`), nunca devuelve «sin restricción» (F-V1-031);
y `createProtectedRoute` se niega a levantar una ruta que declara una sección o un rasgo inexistente (F-V2-037),
como ya hace con el contrato de errores.

Usa el conjunto efectivo **del dueño de la ficha**, nunca del visitante: en la ficha pública por la regla 4 del
paraguas; en la acción 15, porque la cadena ya fija `subjectId` = dueño (F-V1-035).

**Proyector público genérico** (DEC-FAC-040): quita de la respuesta los `fields` de toda sección (y los campos de
todo rasgo) que no esté `available`. Reemplaza las proyecciones a mano por sección
(`menu-projection.ts`, `daily-specials-projection.ts`, `events-projection.ts`, `directions-projection.ts`).

**Alcance por vertical (DEC-FAC-033, corregida por DEC-FAC-049)**: el resolvedor corre y se prueba en las tres
verticales.
- **Experiencia migra**: `meetingPoint.directions` con `manage_experience_directions` reemplaza el gate de HOS-1049.
  HOS-1049 **no oculta**: retira las indicaciones cuando el plan no otorga la clave y se las muestra en sólo lectura
  al dueño bajado (`directions-projection.ts`, `listing-edit-data.ts:102-114`), que es exactamente un rasgo `locked`.
  La salida visible es idéntica; lo prueba el test de no regresión. `routes/experience/protected/patch.ts:63-68`
  deja su `Object.hasOwn(body, 'meetingPointDirections')` por el detector genérico.
- **Alojamiento**: entra al catálogo con sus secciones y **claves reales** (sub-spec 2), para que el resolvedor no
  mienta a un consumidor futuro, pero su público (gating por **campo**: video, descripción enriquecida, insignia; ~9
  lectores en `entitlement-filter.ts`) y sus rutas no se tocan: G-FAC-04 los exime por lista cerrada y contada que
  vacía el hijo 8.

### Estados degradados (F-V1-034)

| caso | comportamiento |
|---|---|
| ficha con cero rubros (no debería existir: el CHECK de base lo impide, DEC-FAC-026) | error de integridad: log `error` + métrica. Lecturas públicas: rubros derivados de la preselección del tipo como red de seguridad. Escrituras de una sección no común: 500 |
| fallo al leer el conjunto efectivo en lo público | todo lo que tiene clave = `locked` (falla cerrado, como `user-gate.ts:47-81`), **sin** cache de borde larga en esa respuesta (`no-store` o TTL corto) para que un fallo no quede publicado como «no pagó» |
| fallo al leer el conjunto efectivo en el editor | 503; nunca un mapa degradado |

## Escrituras y lecturas del dueño: dónde entra en la cadena (F-V1-015, DEC-FAC-019)

- **`absent` es el paso 4b**, inmediatamente después del paso 4 (recurso), y en `CREATE` (donde el paso 4 no corre)
  en el mismo lugar de la secuencia (DEC-FAC-048, F-V2-035). Depende sólo de los rubros resultantes, no del sujeto
  ni del plan. Va antes del paso 5 (cobertura), así que nunca convierte un `NO_COVERAGE` en otra cosa.
- **`locked` no es un paso nuevo**: la clave de la sección, y la de cada rasgo que el cuerpo pida, se agregan a
  `requiredKeys` del **paso 6** sólo cuando la intención es `write` (DEC-FAC-041). Responde `NO_CAPABILITY` (403
  `ENTITLEMENT_REQUIRED` con `entitlementKey`, que el web ya traduce a upsell).
- **Firma** (DEC-FAC-048): `resolveListingAccess({ …, sections?: { requested: readonly { id, intent }[];
  resultingBusinessLines: readonly BusinessLine[] } })`. `resultingBusinessLines` lo calcula el **middleware**:
  rubros de los hechos + el cambio de rubros del cuerpo, o sólo el cuerpo en `CREATE` (donde `facts` sigue siendo
  `null`, `resolve-listing-access.ts:125-126`). La razón `SECTION_ABSENT` entra a `ListingAccessResult` y al
  `switch` exhaustivo del middleware (`listing-access.ts:262-264`).
- `evaluatedSteps` pasa a admitir `'4b'` (tipo explícito); se actualizan `error-contract.md` («steps 3 through 7»),
  `runListingContentCall`, `check-step5-declared.ts` y `coverage-step-coverage.guard.test.ts`.
- `loadFacts` (`apps/api/src/utils/listing-access/ports.ts`) agrega `businessLines` a `ListingAccessFacts` (viajan
  en la fila que ya lee, DEC-FAC-026).

### Respuesta del paso 4b (F-V1-016, DEC-FAC-018, DEC-FAC-048)

El 404 del contrato existe para no revelar que una fila **ajena** existe. Al **dueño** (o a la acción 15), un
rechazo por el estado de su ficha no puede ser 404 (regla 3, `apps/api/docs/error-contract.md:277-281`): responde
**409 `ALREADY_EXISTS`** con `details: { reason: 'SECTION_ABSENT', section }`, lo que la tabla del contrato
prescribe para un conflicto de estado (precedente `COMMITMENT_TAKEN`). **A un sujeto que no es el dueño** (posible
en `READ_PUBLIC` y `WRITE_ABOUT_LISTING`, que admiten `PUBLISHED` a un ajeno, `listing-operation.ts:84-85`), el 4b
responde **`NOT_FOUND`** (F-V2-034). Se documenta en el contrato con la fila nueva. La web lo mapea a «esa sección ya
no aplica a los rubros de tu local», no al manejador genérico de 404.

### Intención de la ruta (DEC-FAC-041, F-V2-007)

- `listingSection: { id, intent: 'read' | 'write' | 'delete' }`, o una función del cuerpo que devuelve pares; lo
  mismo `sectionTraits`. `read` y `delete` corren sólo el 4b; `write` corre 4b + clave en el paso 6.
- **Borrado en `locked`** (DEC-FAC-025): una ruta `DELETE` o de vaciado declara `delete` y pasa sin la clave. Un PUT
  de reemplazo clasifica el cuerpo: vacío = `delete`; si no, `write`. Borrar ítems sueltos de una sección `locked`
  (un PUT con menos platos) es `write` y responde 403: queda fuera, y lo dice el upsell.
- **Contenido `absent` para el dueño** (DEC-FAC-063, Q-14; DEC-FAC-075): en `absent` el 4b **admite `read` cuando el
  paso 4 resolvió «dueño»** (incluida la acción 15, para que soporte vea lo que ve el dueño) y **`delete` sólo si el
  actor es el dueño** (`actor.id === subjectId`); la acción 15 con `delete` en `absent` recibe 409 `SECTION_ABSENT`, igual
  que `write`. Así el editor muestra el resumen «guardado y oculto» y el dueño, y sólo él, puede vaciar la sección. A un
  sujeto ajeno, `absent` sigue siendo `NOT_FOUND` para cualquier intención, y ningún lector público lo publica.
- Lecturas: siguen sin gatearse por plan (decisión vigente: «construir» ≠ «mirar»).

### Rutas que escriben varias secciones (F-V1-016, DEC-FAC-021, DEC-FAC-040)

- Para el PATCH de la ficha, `listingSection` es `({ body }) => sectionsTouchedByBody({ vertical, body })` con
  intención `write`: detección **por presencia de campos no nulos**, desde los `fields` del catálogo (no una lista
  propia de la ruta). Un formulario que manda `entryKind: null` en cada guardado no dispara el paso.
- La sección se evalúa sobre los **rubros resultantes** del pedido. «Agregar `nightlife` y cargar la entrada» en un
  guardado pasa; «quitar `nightlife` y escribir la entrada» responde 409. En el alta, los rubros resultantes son los
  del cuerpo. Test de los dos órdenes y del alta.

### Rutas y rasgos

Las rutas de subrecursos dejan de declarar literales de clave y declaran **sección + intención** y, si corresponde,
**rasgos** (G-FAC-04, G-FAC-06). Mapa inicial:

| ruta | sección / rasgos | intención |
|---|---|---|
| `putMenu` | `menu` + rasgos según cuerpo (`itemPhotos`, `translations`) | `write`, o `delete` con cuerpo vacío |
| `uploadMenuItemPhoto` | `menu.itemPhotos` | `write` |
| `uploadMenuFile` / `deleteMenuFile` | `menu` (el archivo lo cubre la clave de la sección; ya no hay rasgo `file`, DEC-FAC-062) | `write` / `delete` |
| PATCH de la ficha con `menuUrl` | `menu` vía `sectionsTouchedByBody` (`menuUrl` es un campo de `menu`, DEC-FAC-062) | `write` (`null` = borrar, pasa sin la clave) |
| `menuQr` | `menu.qr` (`menu_qr_scan_metrics`, DEC-FAC-051) | `read`; deja `READ_OWN_COMMERCIAL` (que lanza sin `step6Key`, `resolve-listing-access.ts:151-153`) por una operación de la cadena que no exige `step6Key`; el QR de mesa sigue siendo premium |
| `menuQrScans` | `menu.qrMetrics` | `read`, ídem operación |
| `putDailySpecials` | `dailySpecials` | `write` / `delete` |
| `putEvents` | `venueEvents` | `write` / `delete` |
| PATCH de la ficha (venue y experiencia) | `sectionsTouchedByBody` | `write` |
| `getMenu`, `getDailySpecials`, `getEvents` (protegidos) | `menu`, `dailySpecials`, `venueEvents` | `read` |

**Lecturas protegidas por la cadena** (DEC-FAC-055, F-V2-040): `getMenu`, `getDailySpecials` y `getEvents` hoy usan
`createCRUDRoute` con un chequeo a mano (`hasViewAll || ownerId === actor.id`). Pasan a la cadena con `READ_OWN`; sin
eso la declaración de sección no hace nada. **Quién puede leer no cambia**: el personal con `VENUE_VIEW_ALL` sigue
leyendo, por la acción 15 o, si la acción 15 no lo admite para `READ_OWN`, por lo que acuerde V8 (HOS-1362) antes de
mergear; test de no regresión de ese acceso.

## Lectores de contenido (F-V1-005)

Lista **cerrada** de todo lector público o semipúblico de contenido de una sección. Cada uno pasa por el resolvedor
y por el proyector genérico; `absent` y `locked` no se publican (la ficha pública no hace upsell) y los datos se
conservan. Un lector nuevo entra a esta tabla y al inventario de G-FAC-03(b).

| lector | hoy | con el resolvedor |
|---|---|---|
| `getBySlug` público | 3 proyecciones a mano + `readEffectiveKeys` | proyector genérico sobre el mapa de estados |
| `getById` público | sin proyección (expone `menuFileUrl` sin plan: bug previo HOS-1792, post-MVP) | el mismo proyector |
| `list`, `getByDestination` y demás listados públicos | columnas de la fila (saldrían las de `nightInfo`) | **un único lector público por vertical** usado por detalle y listados, con carga de rubros y conjunto efectivo **en lote** por página (por dueño, no por ficha) |
| contexto del chat de IA (`gastronomy-ai-context.ts` → `venue-ai-context.ts`, `chat.ts`) | decide `includeMenu` sólo por clave; usa `menuUrl` siempre | incluye una sección sólo si está `available`, y `menuUrl` sólo con `menu` `available` (DEC-FAC-062); `nightInfo` entra cuando lo esté (con las reglas de DEC-FAC-053); el `Record` de claves por vertical de `chat.ts` (`OWNER_CAPABILITY_KEYS_BY_ENTITY_TYPE`) se migra **entero**, venue y experiencia (DEC-FAC-049) |
| folleto PDF (`brochure-content.ts`) | imprime `menuUrl` | imprime la carta **y el enlace** sólo con `menu` `available` (DEC-FAC-062) |
| enlace externo `menuUrl` (bloque de contacto, chat, folleto, `menu-projection.ts`) | gratis en todo plan, nunca gateado (`menu-projection.ts:101-103`, a propósito) | **pago** (DEC-FAC-062, Q-13 = 3): es un campo de `menu` y sale sólo con `menu` `available`; el proyector genérico lo quita en `absent` y `locked`. Se borra el comportamiento de «enlace gratis» de `menu-projection.ts` y su docblock, con el test que lo fijaba invertido. Un local sólo de noche no tiene enlace de carta (`menu` es `absent`) |
| hoja y widget de QR de mesa | sin rubro | rasgo `menu.qr`: no se ofrece si no está `available` |
| página `/carta/` | 404 si no hay carta proyectada | sin carta estructurada ni archivo en un `menu` `available` (`absent`, `locked`, vacía, o `available` con sólo el enlace externo, que se muestra en la ficha) → **302 `no-store` a la ficha** (DEC-FAC-042, F-V2-013); el header se escribe a mano como en `qr/[slug].astro:117-130` |
| JSON-LD `hasMenu` | presencia de datos | sólo con `menu` `available` y algún contenido (carta, archivo o enlace: `hasMenu` admite una URL) |
| sitemap | hoy lista sólo la ficha (`sitemap-dynamic.xml.ts:414-419`), no `/carta/` | sigue sin listar `/carta/`; si algún día lo hace, sólo con `menu` `available` y carta estructurada o archivo, nunca con sólo el enlace (esa URL responde 302, DEC-FAC-062; F-V3-011) |
| exportación del dueño (`EXPORT`) y vista previa de purga (`purgePreview.ts`) | — | **incluyen todo lo guardado**, también lo `absent` y `locked` (DEC-FAC-063, Q-14); son del dueño y no se proyectan |
| formulario de reseña y su validación (DEC-FAC-065, Q-16) | no pide dimensiones | lee el mapa público de estados de la ficha: una dimensión ligada a una sección se ofrece y se acepta sólo si esa sección **no** es `absent`; las no ligadas, siempre. Nunca compara rubros |
| promedios por dimensión de la ficha (agregado `rating` de la fila; ficha, listados, JSON-LD si algún día los publica) (DEC-FAC-072, F-V3-002) | se publican siempre | el promedio y el conteo de una dimensión cuya `boundSection` está `absent` **no se publican**; los votos se conservan y vuelven si vuelve el rubro. `locked` no oculta. El agregado no está en los `fields` de ninguna sección (no es un campo de update), por eso es una regla propia del lector y no del proyector |
| vista previa de la bajada de plan (DEC-FAC-064, Q-15) | — | corre el resolvedor con el conjunto efectivo **simulado** del plan destino (sub-spec 5) |

Alojamiento (`entitlement-filter.ts`, 9 lectores, gating por **campo**) **no se reemplaza** en esta spec
(DEC-FAC-033, 049): el resolvedor gobierna secciones, y los rasgos de campo de alojamiento no son secciones del
catálogo. Su migración es el hijo 8 (pendiente de crear en Linear).

## Servidor de reseñas (DEC-FAC-065, 071, 073)

Vive en este hijo (no en el 6, que bloquea HOS-1797); el 6 se queda con el formulario y la ficha.
- **Rutas de alta de reseña** (venue y experiencia): validan el desglose con `validateReviewDimensions` (sub-spec 2)
  sobre los estados de la ficha (sólo `absent` importa, que depende de los rubros, no del plan). Experiencia declara
  sus cuatro dimensiones sin ligar, así que acepta exactamente lo de hoy.
- **Recálculo**: `recomputeRating` de la base compartida (`base-listing.service.ts:999-1046`) lee
  `ReviewRules.dimensionAveraging` de la vertical. `legacyNullAsZero` = el código de hoy movido sin cambios
  (experiencia). `votedOnly` (venue): por dimensión, promedio y conteo sólo de los votos; clave ausente si no hay
  votos; `averageRating` = promedio de `overallRating`. Se borra la imputación de `overallRating` a las dimensiones del
  servicio de reseñas de venue (`gastronomy.review.service.ts:671-684`). Formas de datos en el sub-spec 2
  (DEC-FAC-071).
- **Test golden de experiencia**: corre el recálculo sobre un fixture con y sin desglose (incluido `null`) y compara
  contra el valor capturado **antes** del cambio; tiene que dar idéntico.

## Lecturas para superficies

- **Editor (dueño)**: endpoint protegido por ficha que devuelve el mapa de estados y `multiLine` (o el mismo dato
  dentro del detalle de la ficha del dueño). Declara `listingAccess` (`READ_OWN`, admite la acción 15) y calcula con
  `ctx.get('listingAccess').subjectId`, nunca con el actor (F-V1-035).
- **Vista previa de la bajada de plan** (DEC-FAC-064): endpoint del lado de verticales, no de billing; contrato en el
  sub-spec 5.
- **Ficha pública**: ver «Lectores de contenido». El título «De noche» sale de `multiLine` + `headingWhenMultiLineKey`
  (DEC-FAC-050), no de comparar rubros.

## Guards

G-FAC-03 (a y b), G-FAC-04 y G-FAC-06.

## Criterio de aceptación

- **AC:3:1** — Test de matriz rubro × plan × sección × rasgo para los tres estados, **en las tres verticales**, incluida la fila
  «sección `locked` → rasgos `locked`» y `multiLine` (resto-bar básico con `menu` `locked` → `true`; boliche → `false`);
  mutación de cada rama.
- **AC:3:2** — Las rutas de carta, menú del día, eventos y `nightInfo` pasan por el paso 4b y el paso 6: 409 / 403 / 2xx según el
  estado; un pedido ajeno sigue en 404; un ajeno en una operación que admite `PUBLISHED` recibe 404, no 409.
- **AC:3:3** — PATCH que agrega `nightlife` y carga `nightInfo` en el mismo cuerpo → 2xx; que quita `nightlife` y la carga → 409;
  alta de una HELADERIA con campos de `nightInfo` → 409.
- **AC:3:4** — Borrado en `locked`: `deleteMenuFile` y un PUT vacío pasan sin la clave; un PUT con contenido responde 403.
- **AC:3:5** — `menuQr` y `menuQrScans` responden igual que hoy por plan (premium), sin 500.
- **AC:3:6** — Un dueño con la suscripción vencida que abre la carta recibe `NO_COVERAGE`, no `NO_CAPABILITY`.
- **AC:3:7** — Soporte con plan propio Premium sobre un dueño Básico ve `locked` (acción 15); el personal con `VIEW_ALL` sigue
  leyendo carta, menú del día y eventos.
- **AC:3:8** — La ficha pública **y los listados** de un local con plan sin `manage_venue_menu` no muestran la
  carta aunque tenga datos.
- **AC:3:9** — Un local que quitó el rubro de la carta no la expone por `getById`, chat de IA, folleto ni
  `/carta/`.
- **AC:3:10** — `/carta/` sin carta disponible responde 302 con `Cache-Control: no-store`, también con `menu` `available` y sólo
  el enlace.
- **AC:3:11** — Un local con plan sin `manage_venue_menu` no publica `menuUrl` en la ficha, el listado, el chat, el folleto ni el
  JSON-LD; con la clave, sí (DEC-FAC-062).
- **AC:3:12** — Dueño que quitó `food`: `getMenu` y el vaciado de `menu` → 2xx; `putMenu` con contenido → 409
  `SECTION_ABSENT`; un tercero → 404 en las tres (DEC-FAC-063). La exportación trae la carta. Un BOLICHE que manda `menuUrl` en el PATCH → 409.
- **AC:3:13** — Reseña de un BOLICHE con la dimensión `food` → 400; sin ella → 2xx; reseña de un RESTAURANT con `food` → 2xx
  aunque `menu` esté `locked` (DEC-FAC-065); `food: 0` → 400; reseña de experiencia con las cuatro dimensiones → 2xx.
- **AC:3:14** — Recálculo `votedOnly`: una dimensión sin votos queda sin clave; el promedio de una dimensión ignora las reseñas que
  no la votaron; test golden de experiencia en verde.
- **AC:3:15** — Un RESTAURANT con votos de comida que pasa a BOLICHE no publica «Comida»; vuelve a RESTAURANT y la publica
  (DEC-FAC-072).
- **AC:3:16** — Soporte (acción 15) lee una sección `absent` de un dueño y recibe 409 al vaciarla; el dueño la vacía (DEC-FAC-075).
- **AC:3:17** — Alojamiento y experiencia: salida pública idéntica a la de antes (test de no regresión), incluidas las
  indicaciones de experiencia con y sin la clave.
- **AC:3:18** — Los estados degradados de la tabla tienen su test.
