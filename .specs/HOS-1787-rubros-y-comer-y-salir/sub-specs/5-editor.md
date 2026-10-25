---
title: Sub-spec 5 · Editor del dueño
linear: HOS-1787 (hijo: lo crea el orquestador al cerrar la revisión)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (resolución de la vuelta 3)
---

# 5 · Editor del dueño (`apps/web`)

Decisiones: DEC-FAC-005, 009, 018, 024, 025, 031, 033, 034, 037, de la vuelta 2: 040, 041, 047, 050, 054, y de las
respuestas del owner: 062 (enlace de carta pago), 063 (contenido `absent`), 064 (aviso de bajada de plan), 067, y de
la vuelta 3: 075 (vaciar `absent`) y 076. Depende de 3, 4 **y 9** (DEC-FAC-076: el alta ofrece `nightlife`, así que no
se mergea antes que el copy neutro del embudo).

## Registros derivados

**Por qué** (DEC-FAC-033): hoy cada vertical tiene una lista de secciones del editor escrita a mano
(`apps/web/src/lib/editor/{listing,gastronomy,experience,accommodation}-editor-sections.ts`, hoy
`venue-…` tras el sub-spec 1). Las de **venue** y **experiencia** pasan a derivarse del catálogo y el
resolvedor. **Alojamiento** queda como la única isla escrita a mano, **congelada por un guard**
(G-FAC-08), y su migración va a un **hijo 8** (pendiente de crear en Linear). Se difiere porque
alojamiento decide por **campo** (video, descripción enriquecida, insignia; ~9 lectores) y migrarlo
cambia lo que ve el público.

- `GASTRONOMY_ONLY_SECTIONS`, `EXPERIENCE_ONLY_SECTIONS` y el ternario de `listing-editor-registry.ts`
  desaparecen para venue y experiencia: las secciones salen del catálogo de la vertical (orden y grupo del
  catálogo) filtradas por el mapa de estados del resolvedor; slug, etiqueta y componente salen del
  `Record` exhaustivo del web (sub-spec 2). La rama de alojamiento del registro sigue siendo la lista
  manual, intacta.
- `LISTING_SECTION_PAYLOAD_KEYS` (`listing-section-payload.ts`) se **deriva** de los `fields` del catálogo
  (DEC-FAC-040); su test de «cada campo en exactamente una sección» pasa a ser la regla 11 de G-FAC-02. Los
  campos traducibles de `nightInfo` se editan dentro de su sección. **`menuUrl` se mueve de
  `PriceSection.client.tsx` a la sección de la carta** (DEC-FAC-062): es pago con el resto de la carta, así que en el
  plan básico aparece dentro del upsell de `menu` y en un BOLICHE no aparece.
- **Texto del upsell de la carta** (F-V3-005): `gastronomy.json:216` (`owner.editor.menuManager.locked`, es/en/pt, →
  namespace `venue`) dice hoy «Mientras tanto podés subir una foto o un PDF del menú, o dejar el enlace.». Es falso
  (el archivo ya exige `manage_venue_menu`, `uploadMenuFile.ts:122`, y desde DEC-FAC-062 el enlace también): se
  reescribe nombrando lo que desbloquea el plan (carta, archivo y enlace), sin prometer nada en el plan básico.
- **Tests y docs que mueven `menuUrl`** (F-V3-004): los e2e `listing-owner-01-owner-edits-listings.spec.ts:207-243`
  (edita `menuUrl` en `precio`) y `listing-owner-02-access-control.spec.ts:184-189` (`#ce-menuUrl`) pasan a editarlo
  en la carta, con un dueño cuyo plan otorga `manage_venue_menu`; `apps/web/docs/listing-owner-self-service.md` se
  actualiza.
- `absent` → la sección no existe (slug → hub, como hoy).
- `locked` → upsell **proactivo** (hoy el upsell sólo aparece tras un 403) que nombra la sección o el
  rasgo que desbloquea, no el plan genérico.
- Los rasgos (`menu.itemPhotos`, `menu.translations`, `menu.qr`…) no son secciones: se muestran dentro de
  su sección con su propio estado. Widgets y pasos de tour de mi-cuenta (`VenueMenuQrWidget`, paso
  `venue-qr` del tour, id fijado en el sub-spec 1) consultan el mapa: no se ofrecen si `menu.qr` no está
  `available`.
- **El tour es por rol, no por ficha** (F-V2-054, `apps/web/src/config/tours.ts:164-201`): un dueño con sólo un
  boliche no tiene el widget del QR montado. El paso `venue-qr` **se salta** si su target no está en la página,
  con test (dueño con un solo boliche: el tour termina sin el paso y sin globo flotando).
- Las ramas por vertical listadas en discovery B §1 se reemplazan por consultas al catálogo o al
  resolvedor (G-FAC-05 por lista cerrada de archivos), salvo las de alojamiento (congeladas).

## Alta y rubros

- Al elegir el tipo se preseleccionan sus rubros (`typeRules.preselect` del catálogo) y se sugieren sus
  `fieldDefaults` (BOLICHE → edad mínima 18, DEC-FAC-050); el dueño puede sumar o quitar lo que
  `resolveBusinessLineOptions` marque `selectable` (DEC-FAC-047), con el `reason` como ayuda; mínimo uno. La UI
  no recalcula reglas: le pregunta al helper. El servidor valida con el validador genérico (DEC-FAC-026, 034):
  una heladería no ofrece `nightlife`.
- La descripción de cada tipo se ve **debajo del selector** (claves `venue.typeDescriptions.*`, sub-spec 2).
- Los rubros se editan dentro de la sección de datos básicos. **El selector sólo aparece si el catálogo de
  la vertical tiene más de un rubro** (consulta al catálogo, no un literal de vertical): alojamiento y
  experiencia no ven un checkbox único «Estándar» (F-V1-036). En un tipo con un solo rubro permitido
  (CAFE, BOLICHE…) el selector no ofrece nada que cambiar.
- La respuesta 409 `SECTION_ABSENT` se mapea a un mensaje propio («esa sección ya no aplica a los rubros de
  tu local»), no al manejador genérico de 404 (DEC-FAC-018). El 400 del validador (`details.field =
  'businessLines'` y su razón) se mapea a `zodError.venue.businessLines.*` (F-V2-055).

## Ciclo de vida en edición (F-V1-034)

- **Cambio de tipo**: el editor revalida contra los rubros actuales; si alguno no está permitido para el
  tipo nuevo, propone quitarlo (o agregar el que falta, según la preselección) y no deja guardar una
  combinación inválida.
- **Quitar un rubro que deja huérfano al tipo** (BOLICHE sin `nightlife`): se bloquea en la UI y se dice
  por qué.
- **Quitar un rubro**: el contenido de las secciones que quedan `absent` se oculta y no se borra. El aviso
  previo nombra las secciones que dejan de verse, **cuántos ítems quedan guardados** y, si hay QR de mesa
  activos, cuántos y sus escaneos recientes (los stickers seguirán llegando a la ficha por el 302 de
  `/carta/`, DEC-FAC-042).
- **Volver a agregar un rubro** recupera los datos; si en el medio cambió el plan, las secciones vuelven
  como `locked` y no se publican hasta que el plan las otorgue. Los datos se conservan sin plazo mientras
  la ficha exista (hasta `PURGED`).
- **`businessLines ≥ 1` entra al gate de publicación** (`listing-completeness.ts`).
- **Addon dependiente**: la regla «se rechaza quitar un rubro si un addon activo depende de una sección» se
  **retira** (DEC-FAC-024).
- **Cambios de un tercero** (soporte o admin) sobre los rubros: el dueño **recibe un aviso por correo e in-app** y ve el cambio
  (DEC-FAC-034). Si el rubro que puso el dueño está mal elegido, la vía es un pedido de corrección
  (REQUEST_FIX) al dueño, no una edición a mano. Detalle en el sub-spec 7.

## `locked` y `absent` vistas por el dueño (F-V1-037, DEC-FAC-025, aceptada)

- `locked` = datos en **sólo lectura** + upsell + **borrado permitido** (borrar no construye: es coherente
  con «construir ≠ mirar»). La API acepta el borrado porque la ruta declara intención `delete` (DEC-FAC-041):
  borrar el archivo, vaciar la carta o el menú del día. Borrar ítems sueltos es una edición (`write`) y responde
  403: el botón de la UI es «vaciar», no «quitar este plato».
- `absent` vista por el dueño (DEC-FAC-063, Q-14): el mismo trato que `locked`. El slug de la sección sigue
  llevando al hub, y el hub muestra un resumen «guardado y oculto por tus rubros» con conteos y el botón «vaciar»
  (intención `delete`, admitida en `absent` sólo cuando el actor es el dueño, no para soporte, DEC-FAC-075). No se edita: para editar, se vuelve a
  agregar el rubro. La exportación del dueño incluye todo lo guardado.
- **Aviso antes de bajar de plan** (DEC-FAC-064, Q-15, MVP). Ver la sección de abajo.
- El hub (`listing-editor-hub-status-model.ts`) distingue «bloqueada con datos (cargada pero oculta por tu
  plan)» de «bloqueada vacía».
- Aviso en el editor y en la vista previa del dueño cuando una sección tiene datos que no se publican, con
  el motivo (plan o rubro).

## Aviso antes de bajar de plan (DEC-FAC-064)

- **Dónde**: en la confirmación de bajada del web (`mi-cuenta`, flujo de cambio de plan), antes de llamar a la ruta
  de billing. Billing **no** lee rubros ni secciones (G-FAC-07): el aviso lo arma el lado de verticales.
- **Endpoint**: `GET /api/v1/protected/listings/section-preview?targetPlanId=<uuid>` (nombre a confirmar en la
  tarea), `createProtectedRoute`, sin permisos especiales (el sujeto es el actor). Para cada ficha del actor en la
  vertical del plan destino: arma el conjunto efectivo **simulado** reemplazando la fuente «plan» por la versión
  vigente del plan destino y dejando las demás fuentes (addons, grants) como están; corre el resolvedor puro con el
  real y con el simulado; devuelve, por ficha, las secciones y rasgos que pasan de `available` a `locked`, con
  cuántos ítems guardados tiene cada una y, para `menu.qr`, cuántos QR de mesa activos hay y sus escaneos de los
  últimos 30 días. Sin cambios, lista vacía y el confirm sigue como hoy.
- **Qué muestra**: «Al bajar a <plan>, en <ficha> deja de publicarse: Carta (32 platos, enlace externo), QR de mesa
  (40 activos, 310 escaneos en 30 días: van a abrir la ficha sin carta)». Los datos se conservan.
- **Alcance**: el mecanismo es genérico (no pregunta por la vertical); aplica a las verticales cuyas secciones
  gobierna el resolvedor (venue y experiencia; alojamiento queda fuera hasta el hijo 8 porque su catálogo no manda
  sobre su público). Lo que se prueba y se smokea es **venue**.
- **No verificado**: si la bajada cancela addons en el mismo acto (entonces el simulado también los resta); se
  confirma en la tarea leyendo el flujo de plan change.

## Comunicación

Entrada de What's New para dueños: qué son los rubros y cómo se eligen (F-V1-045). Los ids de What's New y
del tour usan el nombre `venue` (DEC-FAC-032); los renombrados no re-notifican a nadie por la migración de
seen-ids (DEC-FAC-054).

## Dependencia de producto

La regla «una ficha = un local físico = una dirección» (issue aparte) tiene que definir la clave (¿dirección
+ unidad o piso?) y las excepciones (dos negocios con marcas y horarios distintos en el mismo número, patios
gastronómicos, restaurante abierto al público de un hotel) antes de implementar este sub-spec (F-V1-046).

## Guards

G-FAC-05 (lista cerrada de archivos) y G-FAC-08 (lista manual de alojamiento congelada).

## Criterio de aceptación

- e2e: alta de un BAR con preselección de los dos rubros; alta de una HELADERIA sin opción de `nightlife`;
  slug de una sección `absent` → hub; sección `locked` con datos en sólo lectura, upsell visible, vaciado
  permitido (intención `delete`) y 403 al guardar; tour de un dueño con sólo un boliche sin el paso del QR; quitar `nightlife` oculta `nightInfo` (con aviso y conteo) y volver a
  agregarlo la recupera con sus datos; quitar el rubro que sostiene al tipo está bloqueado.
- e2e: dueño Pro de un restaurante con carta, enlace y QR de mesa activos que baja a Básico ve el aviso con los
  conteos antes de confirmar; un dueño sin nada que cambie no ve aviso.
- e2e: dueño que quitó `food` ve en el hub el resumen de la carta guardada y la puede vaciar; no la puede editar.
- `menuUrl` se edita dentro de la carta; en plan básico está dentro del upsell; en un BOLICHE no existe; los e2e
  `listing-owner-01/02` lo prueban en su nuevo lugar.
- El upsell de la carta en plan básico no promete archivo ni enlace (es/en/pt).
- Alojamiento y experiencia no muestran selector de rubro; el editor de alojamiento es idéntico al de antes
  y G-FAC-08 lo prueba.
