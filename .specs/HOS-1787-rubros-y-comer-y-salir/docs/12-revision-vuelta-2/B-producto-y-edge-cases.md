---
title: Revisión vuelta 2 · B — producto, UX, edge cases, web pública/SEO, admin e i18n
linear: HOS-1787
created: 2026-10-25
---

# Revisión vuelta 2 · Revisor B (producto y edge cases)

Base de código verificada: worktree `hospeda-hos-1795-claude-md` en `origin/staging @ a44b8f05b4`. Las rutas
`file:line` de código son de ese árbol; las de la spec son relativas a la carpeta de la spec. No se re-levantan
hallazgos de la vuelta 1 ya cerrados salvo donde el arreglo quedó mal o incompleto (se dice en cada caso).

## Resumen

| severidad | cantidad |
|---|---|
| CRÍTICA | 0 |
| ALTA | 7 |
| MEDIA | 11 |
| BAJA | 8 |
| **total** | **26** |

Los temas que más pesan:

1. **La carta no es una sola cosa con una sola clave.** El enlace externo al menú (`menuUrl`) es gratis en todo
   plan, vive en la sección *común* de precio y sale por la ficha, el chat y el folleto. El modelo de la spec
   (sección `menu` con clave `manage_venue_menu`) o lo filtra a los boliches, o se lo saca a los restaurantes
   de plan básico (F-V2-B-002).
2. **Lo que depende de un estado reversible no puede ser un 301.** `/carta/` → ficha depende del plan y del
   rubro, que cambian; un 301 queda grabado en el teléfono del cliente que escaneó la mesa (F-V2-B-001).
3. **La noche rompe supuestos que el código escribió para restaurantes**: el «abierto ahora» (F-V2-B-003), el
   chat sin regla de edad (F-V2-B-007), el catálogo de características de cocina (F-V2-B-012) y todo el copy del
   embudo (F-V2-B-006).
4. **El guard de palabra retirada no ve lo que el visitante lee.** «Gastronomía» con tilde (es) y «Gastronomia»
   (pt) no matchean ninguna regla, y la excepción (b) las ampara igual; y a la vez la lista de excepciones no
   cuenta usos legítimos de `gastronomy` como tema (dimensión de rating de destino) (F-V2-B-004, F-V2-B-005).

Necesitan decisión del owner: F-V2-B-002, 006, 008, 012, 013, 014, 015, 016.

---

### F-V2-B-001 · `/carta/` → ficha como 301 queda grabado aunque el estado vuelva · ALTA

**Qué está mal**: DEC-FAC-023 y los sub-specs 3 y 6 fijan un **301** de `/carta/` a la ficha cuando `menu` no
está `available` (`absent`, `locked` o vacía). Los tres disparadores son **reversibles**: el dueño vuelve a
subir de plan, vuelve a agregar `food` o carga la carta. La misma spec (DEC-FAC-030) justifica el 302 del soak
con «un 301 queda grabado en los navegadores y no se deshace», y el propio código del QR ya razona igual.

**Evidencia**:
- `sub-specs/3-resolvedor.md:121`, `sub-specs/6-web-publica.md:34`, `docs/01-decision-log.md:300` (301).
- `apps/web/src/pages/qr/[slug].astro:117-130`: «302 and not 301: the target is editable, and a
  permanently-cached redirect…».
- `scripts/production-catalog/catalog.ts:547-650`: el plan `-basico` no otorga `manage_gastronomy_menu`, así
  que la carta de **todo** restaurante básico es `locked` y el 301 es el caso común, no el raro.

**Escenario**: restaurante en básico imprime stickers; cada comensal que escanea guarda en su teléfono
`/carta/` → ficha como permanente. El dueño pasa a Pro y carga la carta. El comensal habitual vuelve, escanea
y su navegador lo manda directo a la ficha sin pedir nada al servidor: nunca ve la carta. Lo mismo con la
caché de Cloudflare si la respuesta no sale `no-store`.

**Propuesta**: 302 (o 307) **sin cache** (`Cache-Control: no-store`, como `/qr/`) para el redirect
dependiente de estado. Cambiar DEC-FAC-023 y los dos sub-specs; test que afirme el código y el header. El 301
queda sólo para lo que es de verdad permanente (los legacy `/gastronomia/…` tras el soak).

**Decisión del owner**: no; es una corrección técnica de una decisión objetable ya aceptada.

---

### F-V2-B-002 · `menuUrl` (enlace al menú) no está modelado: se filtra a la noche o se le quita al básico · ALTA

**Qué está mal**: el catálogo de secciones pone toda la carta bajo `menu` (rubro `food`, clave
`manage_venue_menu`) con rasgos `itemPhotos`, `translations`, `qr`, `qrMetrics`, `file`. Pero hoy existe un
cuarto canal de carta, el **enlace externo** `menuUrl`, que (a) es **gratis en todo plan, a propósito**, y (b)
se edita en la sección **común** de precio y se publica en el bloque de contacto. No aparece en ningún
sub-spec.

**Evidencia**:
- `apps/api/src/routes/gastronomy/public/menu-projection.ts:101-103`: «`menuUrl` … is the one fallback still
  free on every tier and is never gated».
- `apps/web/src/components/listing/editor/PriceSection.client.tsx:94-107`: el campo «Enlace al menú» vive en
  la sección `price` (común según `sub-specs/2-catalogos.md`, «Comunes de venue»).
- `apps/web/src/components/gastronomy/GastronomyContactBlock.astro:27-38`: lo publica.
- `apps/api/src/services/ai-context/gastronomy-ai-context.ts:205`: el chat lo usa.
- `apps/api/src/services/listing-brochure/brochure-content.ts:354` (citado en la vuelta 1): el folleto lo imprime.
- `packages/i18n/src/locales/es/gastronomy.json:216`: el copy del bloqueo le dice al básico «podés … dejar el
  enlace».

**Escenarios**:
1. Boliche (sólo `nightlife`): en «Precio» ve «Enlace al menú», lo carga y aparece en su ficha. Contradice el
   requisito 2 del PDR («a un boliche no le corresponde la carta»).
2. Resto-bar que quita `food`: la carta estructurada se oculta, pero el enlace sigue en la ficha, en el chat y
   en el folleto. Rompe el criterio de aceptación del sub-spec 3 («no la expone por … chat de IA, folleto»).
3. Si el implementador lo «arregla» moviendo `menuUrl` dentro de `menu`: en básico `menu` queda `locked`, que
   no se publica ni se edita → **todos los restaurantes básicos pierden el único canal de carta gratis** que
   tienen hoy. Regresión silenciosa sobre la mayoría de los clientes.

**Propuesta**: que la sección `menu` **no tenga clave propia** y la gating pase a rasgos: `items` (carta
estructurada, `manage_venue_menu`), `file` (`manage_venue_menu`, que es lo que hoy exige
`uploadMenuFile.ts:118-122`), `link` (sin clave), más `itemPhotos`, `translations`, `qr`, `qrMetrics`. Así
`menu` es `absent` sin `food` (oculta todo, incluido el enlace) y nunca `locked` entera. Sumar `menuUrl` a la
tabla de lectores del sub-spec 3 y moverlo de la sección de precio a la de carta en el editor (cambia
`PriceSection.client.tsx:65`, que ya está en la lista de G-FAC-05).

**Decisión del owner**: sí.
- **Opción 1 (recomendada)**: `menu` sin clave; rasgos `items`/`file` con clave y `link` gratis. Mantiene lo
  que el básico tiene hoy y oculta todo con el rubro. Pro: cero regresión. Contra: `/carta/` con sólo el enlace
  → ¿301/302 al enlace externo o a la ficha? (decidir en la tarea).
- **Opción 2**: `menuUrl` como sección propia de `food`, sin clave. Pro: simple. Contra: dos secciones de
  «carta» en el editor.
- **Opción 3**: aceptar que el enlace pasa a pago (Pro). Contra: le saca algo al cliente que más paga poco, y
  el copy de `gastronomy.json:216` miente.

---

### F-V2-B-003 · «Abierto ahora» miente para el horario típico de un boliche · ALTA

**Qué está mal**: sub-spec 4 decide «horario único de la ficha» y escribe como limitación que no se modelan
noches distintas, con el ejemplo de un boliche que abre «sólo viernes y sábado». Pero el problema no es de
modelado: el cálculo actual del badge evalúa el turno nocturno **contra el día de hoy**, y lo justifica con un
supuesto que la noche rompe.

**Evidencia**: `apps/web/src/lib/gastronomy-hours.ts:102-107`: «The wrap is evaluated against TODAY's entry …
every real overnight schedule in scope repeats across consecutive days, so the two readings agree»; lógica en
`:129-131`. El badge sale en cada tarjeta (`GastronomyCard.astro:55-60,128-132`) y en la ficha.

**Escenario** (boliche que abre viernes y sábado de 00:30 a 06:00, cargado como `viernes 23:30–06:00` y
`sábado 23:30–06:00`):
- sábado 03:00 (es la noche del viernes, abierto): hoy es sábado, el turno del sábado envuelve, `03:00 < 06:00`
  → «Abierto» (correcto por casualidad);
- domingo 03:00 (noche del sábado, abierto): hoy es domingo, sin turno → **«Cerrado»** en el pico de la noche;
- jueves → viernes 03:00 (cerrado): hoy es viernes, su turno envuelve → **«Abierto ahora»** con el local
  cerrado. Un turista va y encuentra la persiana baja.

Además `/comer-y-salir/rubro/noche/` es cache class `catalog`: el badge calculado en el SSR queda congelado el
TTL de la página (si se generó a las 20:00, todos dicen «Cerrado» hasta que expire).

**Propuesta**: en el sub-spec 4 (o 6), evaluar el turno nocturno contra la entrada del **día anterior** cuando
`now < close` del turno de ayer (el arreglo que el docblock evita «para no cambiar datos existentes»: en prod no
hay datos). Y, para las páginas cacheadas, calcular el badge en el cliente (isla chica) o no mostrarlo en
listados. Test con el calendario viernes/sábado de arriba.

**Decisión del owner**: no (es un bug del caso que la spec trae al producto).

---

### F-V2-B-004 · El nombre visible de la vertical en es/pt no lo ve ningún guard ni lo inventaría nadie · ALTA

**Qué está mal**: G-FAC-R1 tiene cuatro reglas: identificador en inglés (`gastronomy`, `Gastronomy`…), rutas,
`gastro-` y `restaurante` en rutas/addons. **Ninguna** matchea «Gastronomía» (es, con tilde) ni «Gastronomia»
(pt). Y la excepción (b) ampara «la palabra en español en prosa». El renombrado de **claves** i18n
(`nav.gastronomy` → `nav.venue`) deja intacto el **valor**.

**Evidencia**:
- `docs/06-guards.md:40-48` (reglas) y `:54` (excepción b).
- `packages/i18n/src/locales/es/nav.json:6` `"gastronomy": "Gastronomía"` (y `pt/nav.json:6` «Gastronomia»),
  usado como ítem del menú en `apps/web/src/layouts/Header.astro:69`.
- Otros valores que nombran la **vertical**, no el tema: `es/account.json:168,486,545,789` («Suscripción de
  gastronomía»), `es/billing.json:710` («Gastronomías publicadas»), `es/footer.json:14` («Publicá tu local
  gastronómico»), `es/gastronomy.json:10` (título del listado «Gastronomía»), `:149,155,171` («Gastronomía
  Premium», «ficha de gastronomía»), `packages/notifications/src/utils/product-domain-copy.ts:140`.

**Escenario**: se mergea la etapa B con G-FAC-R1 verde. El header sigue diciendo «Gastronomía» y lleva a
`/comer-y-salir/`; mi-cuenta dice «Suscripción de gastronomía»; el listado se titula «Gastronomía». En pt igual.
Nadie lo detecta porque el guard pasa y la excepción (b) lo autoriza.

**Propuesta**: (1) sacar «prosa» de la excepción (b) y dejarla sólo como «el nombre/slug del rubro y la categoría
de contenido»; (2) inventario cerrado en el sub-spec 1 de las claves i18n cuyo **valor** nombra la vertical (las
de arriba como piso), cada una con su texto nuevo en es/en/pt; (3) una regla 5 de G-FAC-R1 sobre **valores** de
`packages/i18n/src/locales/**` y `packages/notifications/src/**`: `[Gg]astronom[ií]a` sólo en claves que
pertenecen a la excepción (a) o al rubro `food`, con lista de claves permitidas contada.

**Decisión del owner**: no para el guard; los textos nuevos entran en F-V2-B-015.

---

### F-V2-B-005 · La lista de excepciones de G-FAC-R1 no cuenta usos legítimos de `gastronomy` como tema · ALTA

**Qué está mal**: DEC-FAC-032 (a) conserva sólo «la categoría Gastronomía de eventos, posts y POI». Pero hay más
`gastronomy` en forma de identificador que es **tema**, no vertical, y uno es dato persistido.

**Evidencia**:
- `packages/schemas/src/entities/destination/subtypes/destination.rating.schema.ts:36-39`: la reseña de
  **destino** tiene la dimensión `gastronomy` (persistida en el JSONB de rating de reseñas de destino), con sus
  claves `error:destination.rating.gastronomy.*` y labels `es/destination.json:131,314`. El sub-spec 6
  (`:66-68`) la reconoce como «dimensión de rating de destino», pero la excepción (a) no.
- Tile de la home: `apps/web/src/pages/[lang]/index.astro:209-213` (`home.categoryTiles.tiles.gastronomy`,
  imagen `@/assets/images/categories/gastronomy.jpg`, enlaza a eventos `?category=GASTRONOMY`).
- `es/footer.json:61` `categoryGastronomy`, `apps/web/src/lib/facet-slugs.ts:71,84` (slugs de categoría).

**Escenario**: el agente corre G-FAC-R1, sale rojo en `destination.rating.schema.ts`, y lo «arregla» renombrando
la dimensión a `venue` (rompe el sentido) o a `food` (choca con el rubro); cualquiera de las dos obliga a migrar
el JSONB de las reseñas de destino **en prod**, que sí tiene datos. O agrega una sexta excepción a mano, que el
auto-chequeo prohíbe.

**Propuesta**: ampliar (a) a «gastronomía como **tema**» con lista cerrada de archivos: categorías de
eventos/posts/POI, **dimensión de rating de destino** (schema, mensajes, labels), tile de la home (clave e
imagen), `footer.categoryGastronomy`. Dejar escrito que la dimensión de destino **no** se renombra ni se migra.

**Decisión del owner**: no (es completar una lista que el owner ya definió por criterio: tema vs vertical).

---

### F-V2-B-006 · Todo el embudo le habla a un restaurante; ningún sub-spec reescribe el copy para la noche · ALTA

**Qué está mal**: el renombrado cambia URLs y nombres, y DEC-FAC-032 (b) conserva la prosa. Pero el **motivo**
del cambio (PDR, «el problema») es sumar bares y boliches, y el embudo que los trae sigue diciendo carta,
platos y restaurante. El sub-spec 6 sólo fija labels de «Comer y salir», de rubros y el estado vacío.

**Evidencia**:
- `es/publish.json:41,46,57,72` («tu restaurante, bar, parrilla o food truck… dónde comer», «el menú»).
- `es/pricing.json:235` («publicar tu restaurante, parrilla, rotisería o carrito»).
- `es/gastronomy.json:11,143` («los mejores restaurantes, bares y sabores», «buscando gastronomía»).
- **Correos de la serie de trial** (sólo en español, por vertical, no por rubro):
  `packages/notifications/src/utils/product-domain-copy.ts:69-77` («Un menú actualizado con tus platos y
  precios reales», «los horarios y el menú cargados completos»). Un boliche recibe «cargá tu menú».
- Ícono de la vertical: `ForkKnifeIcon` en `apps/web/src/config/discovery-doors.ts:157` y en la página de
  precios.
- `apps/web/src/pages/[lang]/presentacion/gastronomia/index.astro` (528 líneas de landing) y
  `planes/gastronomia/index.astro`.

**Escenario**: el dueño de un boliche llega a `/presentacion/comer-y-salir/`, lee «cargá tu carta plato por
plato», pasa a precios («publicar tu restaurante»), se registra y al día 3 le llega un correo que le dice que la
gente filtra por el menú. Entiende que la plataforma no es para él.

**Propuesta**: tarea de contenido explícita (sub-spec 6 o un hijo de contenido) con inventario cerrado: landing,
venta, precios, publicar, footer, discovery doors, los correos de trial y bienvenida, el What's New de
lanzamiento, el ícono. El copy de **vertical** tiene que nombrar ambas cosas («tu local», «comer o salir»); el que
sólo aplica a `food` va dentro de las secciones (que ya se ocultan por rubro). Ojo: los correos son por usuario +
vertical, no por ficha, así que **no** pueden ramificar por rubro sin violar la regla 1: tienen que ser neutros.

**Decisión del owner**: sí.
- **Opción 1 (recomendada)**: copy neutro de vertical en todo el embudo, en este programa, antes del lanzamiento
  público de la noche. Pro: coherente con la razón del cambio. Contra: tarea de contenido es/en/pt no chica.
- **Opción 2**: renombrar ahora y reescribir el copy en un issue aparte post-MVP. Contra: se lanza la noche con
  un embudo que la espanta.
- **Opción 3**: correos con copy por rubro. Contra: los correos no tienen ficha; obligaría a leer rubros fuera
  del resolvedor (G-FAC-03).

---

### F-V2-B-007 · El chat de IA recibe `nightInfo` sin ninguna regla sobre edad y alcohol · ALTA

**Qué está mal**: sub-specs 3, 4 y 6 meten `nightInfo` (incluida `min_age`) en el contexto del chat cuando está
`available`, y piden un prompt neutral. Las **reglas duras** del chat de la vertical están en `DEFAULT_RULES`
(código, no editables por el admin) y cubren alérgenos y precios vigentes, pero nada sobre edad mínima, ingreso
de menores ni alcohol. La spec sí se ocupó de esto en la ficha (texto legal fijo, Ley 24.788), no en el chat.

**Evidencia**: `packages/ai-core/src/engine/default-prompts.ts:212-214` (`chat_gastronomy` rules) y `:358`
(prompt «dining assistant embedded in a restaurant»); `docs/01-decision-log.md:491-492` (el +18 con texto legal).

**Escenario**: un adolescente pregunta en la ficha de un boliche «tengo 16, ¿me dejan entrar si voy con un
amigo mayor?» o «¿venden alcohol a menores?». El modelo, con `min_age: 18` y el dress code en contexto, improvisa
una respuesta («podrías consultar en la puerta…») que la plataforma está publicando.

**Propuesta**: en el sub-spec 6, cláusula nueva en `DEFAULT_RULES.chat_venue`: no afirmar que alguien puede
ingresar por debajo de la edad declarada, no dar consejos para eludirla, repetir textual la edad de la ficha y el
texto legal, y derivar al local. Ojo con `test/default-rules-equivalence.test.ts`: el invariante de multiset de
palabras obliga a mover la cláusula **entre** prompt y reglas, no a duplicarla. Test de la regla presente.

**Decisión del owner**: no (es la misma decisión legal que ya tomó para la ficha).

---

### F-V2-B-008 · Reseñas «con dimensiones opcionales»: el formulario no las pide y el recálculo las inventa · MEDIA

**Qué está mal**: DEC-FAC-035 y sub-spec 6 (`:76-77`) dicen que cada dimensión (comida, servicio, ambiente,
**precio**) pasa a opcional, se muestra si tiene votos, y que «un boliche ya no recibe Comida: 2/5». En el código:
1. El formulario público **sólo** pide `overallRating`: `GastronomyReviewForm.client.tsx:7-10` («the granular
   `rating` object is optional and intentionally not collected here»). Ya son opcionales.
2. Ninguna superficie pública muestra las dimensiones: la ficha sólo usa `averageRating`
   (`gastronomia/[slug].astro:268-278,404-406`).
3. El recálculo de la ficha **imputa** el `overallRating` a las cuatro dimensiones cuando la reseña no las trae:
   `gastronomy.review.service.ts:671-684`. Con eso toda dimensión «tiene votos» siempre, y el criterio «una reseña
   sin votos de comida no la cuenta» es imposible tal como está.
4. El recálculo vive en la clase base compartida con **experiencia** (`base-listing.service.ts:1021-1040`), que
   mapea a `null` y lo suma como 0 (`experience.review.service.ts:584-588`): cambiar «promedio sobre las votadas»
   en la base cambia los promedios **visibles** de experiencias, contra DEC-FAC-033 («sin cambios visibles»).
5. La cuarta dimensión es `value` (relación precio-calidad), no «precio».

**Escenario**: el implementador cambia la base para promediar sólo dimensiones no nulas; las experiencias con
reseñas sin desglose suben de golpe su `averageRating` (dejan de sumar ceros) y la no-regresión de experiencia
falla, o peor, no hay test y cambia en prod.

**Propuesta**: reescribir el punto en el sub-spec 6 como lo que realmente hace falta: (a) quitar la imputación de
`overallRating` a cada dimensión en venue; (b) `averageRating` de la ficha = promedio de `overallRating` (no de
dimensiones); (c) **no tocar** la base para experiencia en esta spec (o hacerlo como bug aparte con su propio
smoke); (d) nombre `value`. Si nadie muestra dimensiones, decir explícitamente que la UI de dimensiones no se
construye.

**Decisión del owner**: sí, una sola: ¿el formulario de reseña de venue empieza a **pedir** dimensiones?
- **Opción 1 (recomendada)**: no; se queda con la calificación general y el punto se reduce a (a)-(d). Pro:
  cero UI nueva, el boliche nunca ve «Comida». Contra: no hay desglose.
- **Opción 2**: sí, dimensiones opcionales en el form, con «comida» ofrecida sólo si `menu` no es `absent`.
  Contra: la reseña pregunta por un rubro (vía resolvedor) y abre moderación de dimensiones en el admin.

---

### F-V2-B-009 · No está definido el estado de los rasgos cuando la sección está `locked` · MEDIA

**Qué está mal**: la regla del resolvedor (`sub-specs/3-resolvedor.md:33-35`) dice: `absent` → rasgos `absent`;
«si no, `locked` si la clave no está otorgada»; «si no, `available`; cada rasgo `locked`/`available`». La rama
`locked` **no dice** qué valen los rasgos. El tipo devuelve `traits` siempre (`:28`).

**Escenario**: restaurante en básico (`menu` `locked`). `menu.qr` no tiene clave: una implementación devuelve
`qr: available` y el widget de QR de mesa (`VenueMenuQrWidget`) le ofrece imprimir stickers de una carta que no
se publica → todos los escaneos caen en la ficha (y con F-V2-B-001, para siempre). Otra devuelve `locked`. Los
dos sub-specs que consumen el mapa (5 y 6) se comportan distinto según quién lo implemente.

**Propuesta**: fijar «sección `locked` → todo rasgo `locked`» (salvo que F-V2-B-002 opción 1 saque la clave de
la sección, en cuyo caso la regla se simplifica) y sumar la fila a la matriz de tests del sub-spec 3.

**Decisión del owner**: no.

---

### F-V2-B-010 · El título «De noche» de las fichas híbridas obliga a preguntar por rubros concretos · MEDIA

**Qué está mal**: sub-spec 4 (`:47-49`) y 6 (`:27`): en una ficha **híbrida** (con `food` y `nightlife`) los datos
de `nightInfo` van bajo «De noche»; en una sólo `nightlife`, sin título. «Híbrida» es exactamente
`businessLines.includes('food') && businessLines.includes('nightlife')`, que la regla 1 del paraguas prohíbe y
G-FAC-03(a) pone en rojo (es su propio ejemplo de mutación, `docs/06-guards.md:150-151`).

**Escenario**: el implementador o escribe el `includes` y el guard lo frena (y lo «resuelve» con una excepción), o
lo deriva de secciones («hay alguna sección de `food` `available`»): entonces un resto-bar en básico (`menu`
`locked`, `dailySpecials` `locked`) no muestra el título y su ficha pública queda con los datos de la noche
pegados a la descripción del almuerzo, justo el caso que el título quería evitar.

**Propuesta**: que el resolvedor devuelva un hecho de presentación derivado y genérico, p. ej.
`sectionGroupsPresent` o «la ficha tiene ≥2 rubros con secciones no comunes (en cualquier estado ≠ `absent`)», y
que el componente pregunte eso. Escribir la regla en el sub-spec 3 y el caso en su matriz.

**Decisión del owner**: no.

---

### F-V2-B-011 · El predicado de G-FAC-03(a) choca con literales `food`/`nightlife` que ya existen y no son rubros · MEDIA

**Qué está mal**: G-FAC-03(a) prohíbe en `apps/*` y `packages/*` «un literal de valor de rubro en una
comparación, `includes`, `switch`, clave de objeto o índice». Los valores elegidos (`food`, `nightlife`) ya son
claves de objeto en otros dominios.

**Evidencia**:
- `food`: dimensión de reseña de venue y de experiencia (`gastronomy-rating.schema.ts:32`,
  `experience-rating.schema.ts`), recálculo (`base-listing.service.ts:1002,1021-1030`,
  `gastronomy.review.service.ts:680`).
- `nightlife`: dimensión de rating de destino (`destination.rating.schema.ts`, `destination-rating.ts`,
  `DestinationRatingBreakdown.astro`, `destinationReview.helpers.ts`), categoría de POI
  (`packages/icons/src/domain/poi-category.ts`), `PostCategoryEnum.NIGHTLIFE` con slug `noche`
  (`apps/web/src/lib/facet-slugs.ts:90`).

**Escenario**: el guard nace rojo en ~10 archivos ajenos. Lo que suele pasar (memoria del repo: «la escape hatch
esconde el fail-open») es que se le agregue una lista de exenciones por archivo o se lo ancle sólo a `'nightlife'`
entre comillas simples, y entonces deja pasar `businessLines.includes(BUSINESS_LINE.NIGHTLIFE)` o
`lines.some(l => l === nightlifeValue)`.

**Propuesta**: anclar el predicado al **receptor**, no al literal: rojo si el valor comparado sale de
`businessLines` (o de un tipo `BusinessLine`) — vía TypeScript checker o, si es regex, por el identificador
`businessLines`/`business_lines` en la misma expresión — y prohibir importar las constantes de valor de rubro
fuera de la lista (b). Documentar en «lo que NO verifica» las formas que se escapan.

**Decisión del owner**: no.

---

### F-V2-B-012 · Comodidades y características son de cocina: el boliche no tiene qué marcar y el filtro de noche muestra «menú infantil» · MEDIA

**Qué está mal**: `amenities` es sección común y el listado filtra por «Aptos y características». El catálogo
asignado a la vertical es casi todo cocina; no hay ítems de noche. La aplicabilidad del catálogo es por
**vertical** (`applicable_verticals`, SPEC-266), no por rubro.

**Evidencia**: seeds con `"gastronomy"` en `packages/seed/src/data/feature/`: `kids_menu`, `vegan_options`,
`gluten_free_options`, `nut_free_options`, `peruvian_cuisine`, `asian_cuisine`, `italian_cuisine`,
`river_cuisine`, `fusion_cuisine`…; en amenity: `takeaway`, `delivery`, `catering`, `happy_hour`, `live_music`,
`bar_service`. Filtro en `gastronomia/index.astro:243` (`gastronomy.listing.features`). Nada de pista, DJ, VIP,
guardarropa, mesas reservables de noche.

**Escenario**: el dueño del boliche abre «Servicios» y ve 30 casillas de cocina. El turista en
`/comer-y-salir/rubro/noche/` abre los filtros y le ofrecen «Cocina peruana» y «Menú infantil»; filtra por
«Música en vivo» y no encuentra nada porque nadie la marcó.

**Propuesta**: decidirlo antes del sub-spec 6.

**Decisión del owner**: sí.
- **Opción 1 (recomendada)**: sumar ítems de noche al catálogo (seed dual-write) y, en las colecciones, mostrar
  sólo los filtros con ≥1 ficha en la colección (mismo criterio que los chips de tipo). Pro: sin concepto nuevo.
  Contra: el editor del boliche sigue viendo las de cocina.
- **Opción 2**: columna `applicable_business_lines` en amenities/features. Pro: editor y filtros limpios. Contra:
  catálogo nuevo que el resolvedor no gobierna (otra lista que lee rubros, entra a G-FAC-03(b)).
- **Opción 3**: post-MVP.

---

### F-V2-B-013 · `BAR` / `PUB` / `CERVECERIA` se pisan y la descripción que los distingue no se ve en ningún lado · MEDIA

**Qué está mal**: DEC-FAC-038 resuelve BAR vs PUB con «descripciones propias en es/en/pt». Pero (1) no hay
superficie que muestre una descripción de tipo: el alta es un `select` con la etiqueta
(`ListingCreateForm.client.tsx:83`, `Object.values(GastronomyTypeEnum)`), y no existen claves i18n de
descripción de tipo (sólo `gastronomy.types.*` y `admin-entities` `…types.*`, ambos «Bar»); (2) `PUB` =
«orientado a cerveza» se superpone con `CERVECERIA` = «Craft brewery or beer house»
(`gastronomy-type.enum.ts:9`).

**Escenario**: el dueño de una cervecería artesanal con barra ve «Bar / Cervecería / Pub» sin explicación y
elige al azar; el turista que filtra `?type=PUB` en `/rubro/noche/` no ve las cervecerías. JSON-LD los manda a
los tres a `BarOrPub`, así que el tipo sólo sirve para filtrar, y el filtro queda partido.

**Propuesta**: (a) en el sub-spec 4, nombrar la superficie (descripción debajo del select, o un selector con
tarjetas) y las claves nuevas `venue.typeDescriptions.*` en es/en/pt; (b) las dos tablas de labels (web y
admin) entran juntas; (c) fijar los textos: BAR «barra y tragos, coctelería»; PUB «pub con barra de cerveza tirada
y ambiente de bar irlandés/inglés»; CERVECERIA «cervecería que **produce** su cerveza (artesanal)».

**Decisión del owner**: sí: ¿la frontera PUB/CERVECERIA es «produce o no produce»?
- **Opción 1 (recomendada)**: sí, CERVECERIA = productora; PUB = formato de bar. Pro: criterio verificable.
- **Opción 2**: fusionar PUB en CERVECERIA para la noche. Contra: reabre DEC-FAC-038.

---

### F-V2-B-014 · Renombrar los ids de What's New vuelve a mostrar una novedad vieja a TODOS los usuarios de prod · MEDIA

**Qué está mal**: sub-spec 1 (`:83`) renombra los 3 ids «los dueños ven una vez más el aviso». Uno de los tres
está dirigido a `USER`, es decir a todo el mundo, y ya está publicado en `main`.

**Evidencia**: `apps/api/src/data/whats-new/whats-new.ts:878-881`
(`'2026-09-03-ai-chat-gastronomy-experience'`, `roles: ['USER']`, publicado 2026-09-07; presente en
`origin/main`). El docblock del archivo (`:31-35`) dice que cambiar un id es inofensivo **mientras la entrada no
está publicada**.

**Escenario**: tras el corte, cada turista de prod abre la campana y ve como nueva «Chat con IA en restaurantes y
experiencias» (de hace dos meses). Para los dueños de venue de prod el costo es cero (no hay); para los turistas
es ruido real.

**Propuesta**: tratar los ids de entradas **publicadas** como historia externa (excepción (e), con marcador
contado) o renombrar sólo los de audiencia `GASTRONOMY_OWNER`. Los `roles: ['GASTRONOMY_OWNER']` sí cambian (son
el enum).

**Decisión del owner**: sí.
- **Opción 1 (recomendada)**: ids de entradas publicadas no se renombran (marcador `legacy-name-allowed`).
- **Opción 2**: se renombran todos y se acepta el re-aviso.

---

### F-V2-B-015 · Faltan los textos: «Comer y salir», los rubros y las colecciones en es/en/pt · MEDIA

**Qué está mal**: sub-spec 6 (`:66-68`) deja las etiquetas «para revisar en la vuelta 2» y sólo menciona labels y
estado vacío. Falta también el SEO de cada colección (title, description, H1, intro, OG) y la desambiguación con
«Gastronomía» tema (tile de la home que lleva a **eventos**, categoría de posts `/publicaciones/categoria/gastronomia/`
y `/categoria/noche/`, `facet-slugs.ts:84,90`).

**Escenario**: el menú dice «Comer y salir › Gastronomía» (venues) y la home dice «Gastronomía» (eventos); el
turista toca la tile esperando restaurantes y le aparecen festivales. En inglés, sin texto definido, el
implementador pone «Eat and leave».

**Propuesta** (para que el owner elija; los textos finales van a una tabla del sub-spec 6):

| clave | es | en | pt |
|---|---|---|---|
| vertical | Comer y salir | Food & nightlife *(alt.: Eat & go out)* | Comer e sair |
| rubro `food` | Gastronomía *(alt.: Para comer)* | Food & drink | Gastronomia |
| rubro `nightlife` | Noche *(alt.: Salidas nocturnas)* | Nightlife | Vida noturna *(no «balada»: balada es el tipo BOLICHE)* |
| tipo BOLICHE | Boliche | Nightclub | Balada |
| tipo BAR / PUB | Bar / Pub | Bar / Pub | Bar / Pub |
| título «De noche» | De noche | At night | À noite |
| dress code | Informal · Sport elegante · Elegante · Sin restricciones | Casual · Smart casual · Formal · No dress code | Casual · Esporte fino · Social · Sem restrições |
| texto legal +18 | Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788). | Sale of alcoholic beverages to persons under 18 is prohibited (Argentine Law 24.788). | Proibida a venda de bebidas alcoólicas a menores de 18 anos (Lei argentina 24.788). |
| title colección noche | Boliches, bares y pubs en {{destino}} · Hospeda | Nightclubs, bars and pubs in … | Baladas, bares e pubs em … |
| title colección gastronomía | Dónde comer en {{destino}} · Hospeda | Where to eat in … | Onde comer em … |

Y la tile de la home: renombrarla a «Eventos gastronómicos» (o sumar una tile «Comer y salir» que lleve a la
vertical) para que «Gastronomía» no signifique dos cosas en la misma pantalla.

**Decisión del owner**: sí (los nombres en en/pt y si el rubro `food` se etiqueta «Gastronomía»).
- **Opción 1 (recomendada)**: la tabla de arriba con las primeras opciones + tile «Eventos gastronómicos».
- **Opción 2**: «Para comer» / «Para salir» como etiquetas de rubro (evita el choque con el tema). Contra: menos
  buscable.

---

### F-V2-B-016 · Bajar de plan no avisa qué contenido deja de verse (ni los QR que quedan muertos) · MEDIA

**Qué está mal**: el sub-spec 5 hace un aviso **previo** detallado al quitar un rubro (secciones, ítems, QR y
escaneos), pero para la bajada de plan, que es el caso típico de `locked` (DEC-FAC-025 lo dice), sólo hay aviso
**después** («aviso en el editor … cuando una sección tiene datos que no se publican»). El flujo de cambio de plan
vive en billing y no puede leer rubros (G-FAC-07).

**Escenario**: dueño Pro con carta y 40 stickers en las mesas baja a Básico desde «Mi suscripción». Nadie le dice
que la carta deja de publicarse y que los 40 QR pasan a abrir la ficha sin carta. Se entera cuando un cliente se
queja.

**Propuesta**: en el confirm de bajada (web), consultar el mapa de estados **simulado** contra el conjunto
efectivo del plan destino (el resolvedor es puro: recibe `effectiveSet`) por cada ficha del dueño y listar lo que
pasa a `locked` con conteos. Billing sigue sin leer rubros: lo arma la web con el resolvedor.

**Decisión del owner**: sí: ¿entra en el MVP?
- **Opción 1 (recomendada)**: sí, en el sub-spec 5, sólo para la vertical venue.
- **Opción 2**: post-MVP, con issue propio.

---

### F-V2-B-017 · El aviso in-app de «te cambiaron los rubros» no tiene vida útil definida · MEDIA

**Qué está mal**: sub-spec 7 (`:31-37`) agrega un tipo de aviso al builder de avisos derivados. Los avisos de hoy
derivan de un **estado** que se cierra (fix request abierta) o tienen ventana fija (levantamiento de moderación,
`LIFT_NOTICE_WINDOW_DAYS = 30`, `listing-notices.builder.ts:24`). Un cambio de rubros es un evento puntual: sin
ventana el aviso queda para siempre; con dos cambios seguidos, ¿uno o dos avisos?

**Evidencia**: `apps/api/src/services/listing-notices/listing-notices.builder.ts:4-7,24`.

**Escenario**: soporte corrige los rubros en marzo; en noviembre el dueño sigue viendo «Soporte cambió los rubros
de tu local» arriba del editor.

**Propuesta**: fijar ventana (30 días, mismo criterio que el levantamiento), colapsar al último evento, y que el
aviso desaparezca si el dueño vuelve a editar los rubros. También decir qué pasa si ya hay una fix request abierta:
`requestListingFix` responde `ALREADY_OPEN` (`packages/verticals/src/publication/fix-request.ts:55`), así que el
admin no puede pedir corrección de rubros mientras haya otra pendiente.

**Decisión del owner**: no.

---

### F-V2-B-018 · Admin: `nightInfo` sin decidir, y el criterio de aceptación contradice la regla de REQUEST_FIX · MEDIA

**Qué está mal**:
1. El sub-spec 7 no dice si el formulario consolidado del admin muestra los campos de `nightInfo`, ni si el PATCH
   de **admin** (`apps/api/src/routes/gastronomy/admin/patch.ts`, fuera de la cadena `listingAccess` de las rutas
   protegidas) aplica la regla del paso 4b. Un admin podría escribir entrada y edad en una heladería.
2. La regla dice «el admin no edita a mano el rubro … emite REQUEST_FIX; la edición directa queda para soporte»,
   pero el primer criterio (`sub-specs/7-admin.md:51`) es «un admin cambia los rubros de un local…». Ni el permiso
   (`venue.editAll`) ni la UI distinguen «admin» de «soporte».

**Escenario**: un admin, con el formulario delante y el permiso, cambia el rubro por clasificación (lo que la regla
quería evitar); el dueño recibe el correo de cambio y ve que nadie le pidió nada.

**Propuesta**: (1) decidir explícitamente: el admin no muestra `nightInfo` (coherente con «el admin no tiene UI de
carta») y el PATCH admin rechaza esos campos (400) o pasa por el mismo chequeo de secciones; (2) o la regla de
REQUEST_FIX es política (y se dice así, sin pretender que el sistema la imponga), o se separa el permiso de
editar rubros.

**Decisión del owner**: no (la política ya la dio; falta escribirla sin contradicción).

---

### F-V2-B-019 · El QR impreso codifica `/qr/<slug>/`, no `/q/<slug>` · BAJA

**Evidencia**: `apps/web/src/pages/qr/[slug].astro:7` (`@route /qr/{slug}/`); `brochure-content.ts:67-70`
(«the symbol carries `{site}/qr/{qrSlug}/`»). La spec dice `/q/<slug>` en `sub-specs/1-renombrado.md:159` y
`docs/06-guards.md:79`.

**Escenario**: el test de G-FAC-R2 «escaneo de `/q/<slug>` llega en un salto» se escribe contra una ruta que no
existe y queda verde por 404 → o se arma una ruta `/q/` nueva.

**Propuesta**: corregir a `/qr/<slug>/` en los dos lugares.

---

### F-V2-B-020 · Un local con slug `rubro` pierde su `/carta/` · BAJA

**Qué está mal**: con `/comer-y-salir/rubro/[rubro]/` y `/comer-y-salir/[slug]/carta/`, Astro prioriza el
segmento estático: `/comer-y-salir/rubro/carta/` cae en la colección con `rubro = carta` → 404. No hay lista de
slugs reservados (no aparece ninguna en `packages`/`apps`).

**Escenario**: un local llamado «Rubro» (o «Page», con HOS-1797) publica su carta y el QR lo manda a un 404.

**Propuesta**: reservar `rubro` y `page` como slugs de ficha de venue (y `tipo`, `mapa`… en las demás) en el
generador de slugs, con test.

---

### F-V2-B-021 · `nightInfo`: rango de edad, edades por género y fecha del precio sin reglas · BAJA

**Qué está mal**: `min_age smallint` sin rango; el caso común de boliche argentino «ellas +18, ellos +21» no
entra (no hay nota de edad); `entry_price_updated_at` «la fija el servidor al guardar el precio» no dice si se
mueve cuando se guarda el mismo valor; un precio de hace dos años se sigue mostrando como «aprox., actualizado
<mes>».

**Propuesta**: Zod `min_age` entre 13 y 30 (o el que el owner diga); `min_age` es el **menor** de los que aplica y
la diferencia va en `entry_note`; la fecha se mueve sólo si cambia el valor; el precio se oculta (queda la nota)
pasados N meses (p. ej. 6).

---

### F-V2-B-022 · Dress code: `casual` y `no_restrictions` no se distinguen · BAJA

**Qué está mal**: para el dueño y el turista «casual» y «sin restricciones» son casi lo mismo; en Argentina el
término de puerta es «sport elegante», no «smart casual».

**Propuesta**: definir en la etiqueta qué excluye cada uno (p. ej. «Informal (sin ojotas ni musculosa)» vs «Sin
restricciones») y usar «Sport elegante» en es (tabla de F-V2-B-015).

---

### F-V2-B-023 · `publicar-restaurante` ya tiene destino y un 301 grabado: serán dos saltos · BAJA

**Evidencia**: `apps/web/src/pages/[lang]/publicar-restaurante/index.astro:36-42` ya redirige **301** a
`PUBLISH_PAGE_PATH_BY_VERTICAL.gastronomy` (`/publicar/gastronomia/`). La spec lo deja «destino a confirmar»
(`sub-specs/1-renombrado.md:79`).

**Escenario**: un navegador que ya visitó `publicar-restaurante` tiene grabado el 301 a `/publicar/gastronomia/`, que
después responde 302 a `/publicar/comer-y-salir/`: dos saltos, que G-FAC-R2 prohíbe pero no puede ver (está en la
caché del cliente).

**Propuesta**: el destino es `PUBLISH_PAGE_PATH_BY_VERTICAL.venue` (sin decisión pendiente); aceptar por escrito los
dos saltos de clientes con caché, y no cambiar el 301 de la página a 302 (sólo empeora).

---

### F-V2-B-024 · Restos de texto viejo y superficies que no existen · BAJA

- `docs/01-decision-log.md:23,33,96,197`: DEC-FAC-014 sigue diciendo «301 desde `/gastronomia/`» (DEC-FAC-030 lo
  cambió a 302 en el soak) y DEC-FAC-004 dice `estandar` (DEC-FAC-031: `standard`). Marcar el reemplazo parcial
  en el índice.
- `sub-specs/6-web-publica.md:61` («colección vacía por ciudad») y `:83` («páginas de destino que listan
  locales»): hoy no hay colección de venue por destino ni página de destino que liste venues
  (`destinos/[...path].astro` sólo trae alojamientos, `:349-352`). O se define esa colección o se borra la frase.
- `sub-specs/5-editor.md:34` llama `venue-qr` al paso del tour; `sub-specs/1-renombrado.md:83` no fija el id
  nuevo. Fijarlo en un solo lugar.

---

### F-V2-B-025 · El tour del dueño es por rol, no por ficha: el paso del QR apunta a un elemento que puede no existir · BAJA

**Evidencia**: `apps/web/src/config/tours.ts:164-201`: `web.gastronomy.welcome` por `roles`, paso
`gastronomy-qr` con `target: '[data-tour="gastronomy-qr"]'`.

**Escenario**: dueño con un solo boliche: el widget no se monta (sub-spec 5) y el paso del tour no encuentra su
target; según la librería, el tour se corta o muestra un globo flotando. Un dueño con resto y boliche ve el paso
según cuál ficha esté arriba.

**Propuesta**: el paso se salta si el target no está (y test), o se mueve a un tour por ficha. Decirlo en el
sub-spec 5.

---

### F-V2-B-026 · El rechazo del validador de rubros no tiene contrato de error ni mensaje · BAJA

**Qué está mal**: `validateBusinessLines` «devuelve error tipado», pero no se fija qué responde la API (¿400
`VALIDATION_ERROR` con `details.field = 'businessLines'`?), ni las claves i18n de los mensajes (vacío, valor ajeno,
tipo que no admite el rubro). El sub-spec 5 sólo mapea el 409.

**Escenario**: un cliente de API (o el admin, que valida «igual que el servidor») recibe un 500 o un mensaje en
inglés crudo al mandar `HELADERIA` + `nightlife`.

**Propuesta**: fila nueva en `apps/api/docs/error-contract.md` y claves `zodError.venue.businessLines.*` en es/en/pt.

---

## Key Learnings:

1. El modelo «una sección = una clave» no aguanta la carta real: hay un canal de carta gratis por diseño
   (`menuUrl`, `menu-projection.ts:101-103`) que vive en la sección común de precio. Antes de asignar una clave a
   una sección hay que inventariar **todos** los campos que la sección abarca, incluidos los que viven en otra.
2. Un redirect que depende de un estado reversible (plan, rubro, contenido) nunca puede ser 301: el repo ya lo
   razonó para `/qr/` (`qr/[slug].astro:117`) y la spec lo repitió mal para `/carta/`.
3. El badge «abierto ahora» (`gastronomy-hours.ts:102-107`) asume que todo turno nocturno se repite en días
   consecutivos; es falso para el horario típico de un boliche, justo el público que esta spec trae.
4. Un guard de palabra retirada basado en formas de identificador en inglés no ve el texto que lee el visitante
   («Gastronomía» con tilde, «Gastronomia» en pt); las excepciones de «prosa» lo vuelven ciego por diseño.
5. `food` y `nightlife` ya son claves de objeto en dominios ajenos (dimensiones de reseña de venue/experiencia,
   rating de destino, categoría de POI y de posts): un guard que prohíba el literal choca el primer día.
6. Las reseñas de venue ya son «sin dimensiones» en la UI; lo que fabrica dimensiones es la imputación del
   recálculo, y ese recálculo es compartido con experiencia.
7. Renombrar ids de What's New publicados con audiencia `USER` re-notifica a todos los usuarios de prod.
