---
title: Revisión vuelta 3 · Deltas de la resolución de la vuelta 2
linear: HOS-1787
created: 2026-10-25
alcance: DEC-FAC-040…069 y lo que tocaron en sub-specs 1-7, 9, 06-guards, spec.md y discovery A
código de referencia: worktree hospeda-hos-1795-claude-md (origin/staging, a44b8f05b4)
---

# Vuelta 3 · Revisión de los deltas

Una sola revisión, corta, sobre lo que cambió la resolución de la vuelta 2 (arreglos + respuestas del owner) y lo
que esos cambios rompen en otro lado. Cada dato de código se verificó en el worktree de `origin/staging`.

**Resumen**: 0 CRÍTICA · 3 ALTA · 5 MEDIA · 7 BAJA. Ninguno necesita al owner: todos tienen una salida que se
deriva de reglas ya decididas (regla 5, DEC-FAC-057, DEC-FAC-065, DEC-FAC-069). Dos (F-V3-006 y F-V3-012) son
elecciones técnicas que el agente puede tomar y registrar como objetables.

Lo que se revisó y está bien (para no repetirlo): la lista de cinco migraciones editadas es completa para la
regla general de DEC-FAC-060 (grep de `'gastronomy'`/`{gastronomy}` en 0125…0178: las únicas filas que dependen de
un literal de vertical son las de 0144 y 0176, contra 0129 y 0139; 0148 nombra la vertical pero no depende de
ninguna migración editada); la regla de DEC-FAC-045 es correcta (`0126_cool_captain_flint.sql:10` confirma la
transacción única); la cadena 0109 → seen-ids de DEC-FAC-054 funciona y `RETIRED_WHATS_NEW_IDS` está vacío
(`whats-new.ts:106`), así que el guard del catálogo de What's New no se opone al renombre; `legacyImputed` deja a
experiencia idéntica si se mueve el código de la base sin cambios (ver F-V3-006 por el nombre).

---

## ALTA

### F-V3-001 · G-FAC-R1 nace rojo: la 0132 editada y los tests de migraciones históricas

- **Qué está mal**: el guard escanea las cinco migraciones editadas y todo test del repo, pero hay archivos que
  **tienen** que nombrar `gastronomies`/`gastronomy` porque describen el esquema de un momento anterior al
  renombrado. Ninguna exención ni el «fuera del escaneo» los cubre.
- **Evidencia**:
  - `06-guards.md:64`: «0129, 0132, 0139, 0144 y 0176 **sí** se editan y se escanean». Pero la 0132 hace
    `ALTER TABLE "gastronomies" ADD COLUMN …` cuatro veces (`0132_noisy_marvel_boy.sql:26-29`): la tabla se llama
    así hasta la migración de renombrado, así que esas líneas no se pueden editar. Lo mismo vale para los `meta/`
    de las editadas (un snapshot es el esquema entero de ese momento, con la tabla `gastronomies`).
  - Tests que aplican migraciones hasta un tag histórico y escriben sobre ese esquema:
    `packages/db/test/integration/cut-migration-over-data.test.ts:19,22,30,99-123` (corre la 0148 con
    `entityType: 'gastronomy'` y tabla `gastronomies`; la 0148 rechaza otro valor, `0148_cut_paso_3.sql:89`);
    `retire-user-impersonate-over-data.test.ts:45,49` (`'gastronomy.create'` sobre la 0135).
  - Tests de data-migrations históricas: 7 archivos en `packages/seed/test/data-migrations/` nombran la palabra,
    entre ellos `whats-new-seen-ids-rename.integration.test.ts:42`, que fija el id que **escribe** la 0109
    (`2026-09-05-gastronomy-experience-publish-free-trial`, `0109-…:52`). El test de la data-migration nueva de
    seen-ids también va a tener que nombrar los ids viejos. DEC-FAC-044 saca del escaneo los **módulos**
    (`packages/seed/src/data-migrations/`), no sus tests.
- **Escenario de falla**: el PR de la etapa B no puede poner G-FAC-R1 en verde sin romper estos tests (cambiarles
  el nombre los hace probar un esquema que no existió) o sin agregar una sexta exención, que el auto-chequeo
  prohíbe. La salida probable es angostar el guard a mano, que es justo lo que DEC-FAC-043/044 quisieron evitar.
- **Propuesta** (sin sumar exenciones, como historia):
  1. «Fuera del escaneo» suma: los tests que aplican migraciones hasta un tag anterior al renombrado o importan un
     módulo de `src/data-migrations/` (lista cerrada y contada, derivable: imports de `data-migrations/` y uso de
     `journal.entries` con tag), con el mismo destino que sus módulos (el paso 6 del corte los borra o los
     reescribe).
  2. Las cinco editadas salen del escaneo de la regla 1 como historia, y en su lugar un chequeo **específico**:
     en esos cinco archivos no queda ningún literal de **valor** de vertical, clave, plan o slug viejo
     (`'gastronomy'`, `{gastronomy}`, `*_gastronomy_*`, `gastronomy-*`, «Gastronomía/Gastronomy» en títulos); los
     nombres de tabla y de enum quedan permitidos. Mutación: devolver `'gastronomy'` al `ck_vertical_id` de la
     0129 → rojo.
- **Owner**: no.

### F-V3-002 · El promedio de una dimensión ligada sigue publicándose cuando su sección es `absent`

- **Qué está mal**: DEC-FAC-065 decide cuándo se **ofrece** una dimensión ligada (sección no `absent`), pero no
  cuándo se **muestra** su promedio. El sub-spec 6 dice «la ficha muestra el promedio de cada dimensión con al
  menos un voto» (`6-web-publica.md:146-147`), sin mirar el estado.
- **Evidencia**: el agregado vive desnormalizado en la fila de la ficha (`rating`, `gastronomy.schema.ts:156`;
  `base-listing.service.ts:1043-1046`) y no lo recalcula un cambio de rubros. `rating` no es un campo del schema
  de update, así que no puede estar en los `fields` de `menu` (DEC-FAC-040 los tipa contra `UpdateInputOf<V>`) y el
  proyector genérico no lo quita. La tabla cerrada de lectores del sub-spec 3 (`3-resolvedor.md:157-170`) no tiene
  la fila «promedio por dimensión».
- **Escenario de falla**: un RESTAURANT con 30 reseñas que votaron «Comida» pasa a BOLICHE (saca `food`); la ficha
  del boliche muestra «Comida: 2,1». Es el caso que motivó la pregunta, y viola la regla 5 («lo oculto no sale por
  ningún lector»).
- **Propuesta**: el lector público oculta el promedio (y el conteo) de toda dimensión cuya `boundSection` esté
  `absent` en el mapa de la ficha; los votos se conservan y vuelven si vuelve el rubro. Fila nueva en la tabla de
  lectores del sub-spec 3 (ficha, listados, JSON-LD si algún día publica dimensiones) y criterio: «RESTAURANT con
  votos de comida que pasa a BOLICHE no muestra Comida; vuelve a RESTAURANT y la muestra». `locked` no oculta (el
  turista sí comió).
- **Owner**: no (lo dicta la regla 5).

### F-V3-003 · La forma de los datos de las dimensiones no está decidida y la de hoy no admite «sin voto»

- **Qué está mal**: el sub-spec 2 declara `ReviewRules` y el 6 describe `votedOnly`, pero ninguno dice cómo cambian
  el schema de entrada, el agregado ni la firma del recálculo. Los tres hoy suponen las cuatro dimensiones siempre
  presentes.
- **Evidencia**:
  - `GastronomyRatingSchema` exige las cuatro y admite `0` (`gastronomy-rating.schema.ts:27-75`: `food` con
    mensaje `required`, `.min(0)`); se usa para la **entrada** de la reseña (`gastronomy.review.schema.ts:64,134`)
    y para el **agregado** de la ficha (`gastronomy.schema.ts:156`).
  - `recomputeRating` recibe `{ food?, service?, ambiance?, value? }[]` y escribe siempre las cuatro
    (`base-listing.service.ts:999-1046`).
- **Escenario de falla**: (a) con `votedOnly`, una ficha con votos sólo de «Servicio» produce un agregado parcial
  que el schema de la ficha rechaza, o el implementador escribe `0` en las dimensiones sin votos y la ficha muestra
  «Comida: 0»; (b) con `min(0)`, un `0` es un voto válido indistinguible de «no votó»; (c) «mostrar con ≥1 voto»
  necesita un conteo por dimensión que hoy no se guarda; (d) un schema con las cuatro claves escritas a mano no es
  «declarado en el catálogo».
- **Propuesta** (para el sub-spec 2, que es donde vive `ReviewRules`): el schema de rating de cada vertical con
  `ReviewRules` se **deriva** del catálogo: cada dimensión opcional, entero 1-5; el agregado de la ficha es
  `Partial<Record<ReviewDimensionId<V>, { average, count }>>` (clave ausente = sin votos); `recomputeRating` recibe
  filas genéricas por id. Venue no tiene filas en prod (DEC-FAC-027) y staging se resetea: sin migración de datos.
  La rama `legacyImputed` conserva el schema y la firma de hoy para experiencia.
- **Owner**: no.

---

## MEDIA

### F-V3-004 · Q-13 = 3 no llegó al admin ni a los e2e

- **Qué está mal**: `menuUrl` pasó a ser campo de `menu` (pago), pero el admin lo sigue editando como campo común y
  el sub-spec 7 no lo nombra. DEC-FAC-057 dice que el admin «no muestra la carta», y el enlace ahora es carta.
- **Evidencia**: `apps/admin/src/features/gastronomy/config/gastronomy-consolidated.config.ts:117` (modos `view`,
  `edit`, `create`), `GastronomyForm.tsx:349`, `routes/_authed/gastronomies/new.tsx:32`, tests
  `gastronomy.test.ts:200-204`. En el web, los e2e `listing-owner-01-owner-edits-listings.spec.ts:207-243` (edita
  `menuUrl` en `precio`) y `listing-owner-02-access-control.spec.ts:184-189` (`#ce-menuUrl`), y
  `apps/web/docs/listing-owner-self-service.md`.
- **Escenario de falla**: el PATCH de admin pasa por la cadena (DEC-FAC-057), así que un admin que guarda la ficha
  de un local básico con el enlace cargado recibe 403 `NO_CAPABILITY` (si el formulario reenvía el campo), y en un
  BOLICHE 409. Los e2e del sub-spec 5 quedan rojos sin que ninguna tarea los nombre.
- **Propuesta**: el sub-spec 7 saca `menuUrl` del formulario consolidado y del alta del admin, como la carta
  (DEC-FAC-057), con sus tests; el sub-spec 5 lista la reescritura de los dos e2e y del doc.
- **Owner**: no.

### F-V3-005 · El editor ya promete el enlace gratis, y el sub-spec 9 no lo va a encontrar

- **Qué está mal**: DEC-FAC-062 manda al sub-spec 9 a buscar textos que prometan el enlace gratis «en el embudo o
  `catalog.ts`». El texto existe, pero en el editor.
- **Evidencia**: `packages/i18n/src/locales/{es,en,pt}/gastronomy.json:216`
  (`owner.editor.menuManager.locked`): «Mientras tanto podés subir una foto o un PDF del menú, o dejar el
  enlace.». La mitad del archivo ya es falsa hoy: `uploadMenuFile` exige `manage_gastronomy_menu`
  (`uploadMenuFile.ts:122`). Con DEC-FAC-062 el enlace también lo es. `catalog.ts` y las páginas de precios no
  tienen promesas (grep sin hits).
- **Escenario de falla**: el dueño básico lee en el upsell que puede dejar el enlace, va a la carta y la encuentra
  bloqueada entera.
- **Propuesta**: el sub-spec 5 reescribe esa clave con el upsell que nombra lo que desbloquea (es/en/pt), con
  criterio; el sub-spec 9 deja de decir «no se relevó» y cita el resultado.
- **Owner**: no.

### F-V3-006 · Reseñas: servidor en el hijo equivocado, y experiencia sin regla para validador y formulario

- **Qué está mal**: (a) la validación en `createReview`, el recálculo `votedOnly` y el test golden están en el
  sub-spec 6 (`6-web-publica.md:136-145`), que bloquea HOS-1797 (paginación), mientras el criterio del sub-spec 3
  ya exige el 400 del BOLICHE (`3-resolvedor.md:212-213`); dos dueños para el mismo cambio, y uno bloqueado por
  algo ajeno. (b) Una vertical sin `ReviewRules` define sólo el **recálculo** (`legacyImputed`); no dice qué hacen
  `validateReviewDimensions` ni la moderación. Experiencia acepta hoy un desglose
  (`experience.review.schema.ts:61,130`); un validador genérico con «cero dimensiones declaradas» rechaza toda
  dimensión «ajena a la vertical» y cambia experiencia, contra DEC-FAC-065.
- **Evidencia adicional**: «accommodation, si la usa» se puede cerrar: sólo `GastronomyService` y
  `ExperienceService` extienden `BaseListingService` (`gastronomy.service.ts:124`, `experience.service.ts:115`).
  Y `legacyImputed` es un nombre engañoso: lo que hace la base hoy es contar `null` como 0
  (`base-listing.service.ts:1022-1027`); la imputación de `overallRating` está en el servicio de reseñas **de
  venue** (`gastronomy.review.service.ts:671-684`), no en la base; el de experiencia pasa `null`
  (`experience.review.service.ts:579-588`).
- **Propuesta**: (a) mover validación, recálculo y golden al sub-spec 3 (o a un hijo propio de reseñas sin la
  dependencia de HOS-1797); el 6 se queda con formulario y ficha. (b) Experiencia **declara** su `ReviewRules`
  (cuatro dimensiones sin ligar, modo legado), en vez de depender de un default implícito; G-FAC-02 regla 12 pasa a
  «toda vertical con reseñas por la base declara `ReviewRules`». (c) Renombrar el modo a algo que diga lo que hace
  (`legacyNullAsZero`, propuesto).
- **Owner**: no (elección técnica, registrar como objetable).

### F-V3-007 · `nightInfo` y `businessLines` frente a la lista de campos de la acción 15

- **Qué está mal**: G-FAC-10 vigila que las columnas nuevas entren al `SET` del purge, pero hay una lista gemela
  escrita a mano que nadie nombra: los campos que la acción 15 (soporte) puede escribir.
- **Evidencia**: `LISTING_SUPPORT_EDIT_CONTENT_FIELDS` (`packages/service-core/src/services/listing/listing-support-edit.ts:141-183`)
  es copia a mano de `BLANK_CONTENT` del purge («kept by hand», `:131-134`); un campo fuera de ella se rechaza
  (`:247`). `LISTING_NON_CONTENT_FIELDS` (`listing-owner-act.ts:68`) decide qué escrituras cuentan como «acto del
  dueño».
- **Escenario de falla**: soporte corrige la nota de entrada de un boliche por la acción 15 y recibe rechazo; o al
  revés, alguien suma `businessLines` a la lista de contenido «para que ande» y soporte cambia rubros por un camino
  sin el aviso del sub-spec 7.
- **Propuesta**: G-FAC-10 compara también el `SET` del purge con `LISTING_SUPPORT_EDIT_CONTENT_FIELDS`; las siete
  columnas de `nightInfo` entran a las dos; `businessLines` va a `LISTING_NON_CONTENT_FIELDS` (es clasificación,
  como en `PURGED`) y el cambio de rubros sigue sólo por `venue.editAll` con su aviso. Criterio en el sub-spec 4.
- **Owner**: no.

### F-V3-008 · «Ningún `nightlife` llega a prod sin el sub-spec 9» no tiene quién lo haga cumplir

- **Qué está mal**: el sub-spec 9 se declara bloqueante del lanzamiento en **prod** y «en paralelo con 3 a 7»
  (`9-copy-del-embudo.md:20-22`), y la tabla de fases lo pone a bloquear «lanzamiento de la noche» (`spec.md:56`).
  La promoción `staging` → `main` es un gesto manual del owner sobre todo lo acumulado; nada impide promover los
  sub-specs 5 y 6 con el copy de restaurante.
- **Escenario de falla**: se promueve staging por otro motivo y la noche sale a prod con el embudo que la espanta,
  que es el parche de UX que el owner prohibió.
- **Propuesta**: convertirlo en orden de merge: 5 y 6 dependen de 9 (9 sólo depende de 1 y 2, no hay ciclo). Si no,
  el selector de `nightlife` y la colección `/rubro/noche/` nacen apagados hasta que 9 esté mergeado (pero eso es un
  interruptor intermedio; la dependencia es más simple).
- **Owner**: no.

---

## BAJA

### F-V3-009 · El mapa de tours **sí** guarda el id: la migración de seen-ids tiene que cubrirlo

DEC-FAC-054 dejó «verificar en la tarea». Verificado: `apps/api/src/routes/user/protected/tourProgress.ts:8,57`
guarda `settings.onboarding.adminTours` como `tourId → version`, también para los tours del web
(`tours.ts:164`, `web.gastronomy.welcome`). Sin reescribir esa clave, todo dueño que completó el tour lo vuelve a
ver. Propuesta: el sub-spec 1 y discovery A §5 nombran `adminTours` en la data-migration de seen-ids, con test. El
paso (`gastronomy-qr`) no se guarda: no necesita nada.

### F-V3-010 · Restos de textos superados

- `1-renombrado.md:53`: «edición de 0129/0144/0176» → cinco (DEC-FAC-060).
- `05-discovery-a-renombrado.md:121`: «CHECKs de la **0139** (no editada)» → editada.
- Discovery A §5 todavía recomienda lo superado: `email_outbox` «LT de los renderers durante un release» (`:123`)
  contra `1-renombrado.md:186-188`, que los retira; Cloudinary «NM recomendado» (`:132`) contra
  `1-renombrado.md:101`, que renombra la carpeta; `quota_window` con «Q-01 antes/después» (`:125`).
- `01-decision-log.md:302` (DEC-FAC-020) lista `menu.file`, que DEC-FAC-062 retiró, y el índice no lo marca.
- DEC-FAC-065 y el sub-spec 2 (`:221-222`) dejan «accommodation, si la usa» abierto: no la usa (F-V3-006).

### F-V3-011 · La fila «JSON-LD `hasMenu`, sitemap» del sub-spec 3 mezcla dos reglas

`3-resolvedor.md:167` admite el enlace como «algún contenido» para `hasMenu` y para el sitemap a la vez. Si algún día
el sitemap lista `/carta/` (hoy no: `sitemap-dynamic.xml.ts:414-419` sólo lista la ficha), una ficha con sólo enlace
anunciaría una URL que responde 302 (DEC-FAC-062 punto 6). Separar: `hasMenu` admite el enlace; `/carta/` nunca va
al sitemap salvo con carta estructurada o archivo.

### F-V3-012 · Vaciar una sección `absent` también lo puede hacer soporte

DEC-FAC-063 (`01-decision-log.md:841-843`) y `3-resolvedor.md:112-115` admiten `delete` en `absent` «si el paso 4
resolvió dueño (incluida la acción 15)». El sub-spec 7 dice que a soporte no se le ofrecen secciones `absent`
(`7-admin.md:60`), pero el API lo deja borrar los datos ocultos de un dueño. La razón de la decisión es que «el
dueño controla sus datos». Propuesta: `read` en `absent` con acción 15 sí (para ver lo que ve el dueño), `delete` en
`absent` sólo si el sujeto es el actor. Técnica, registrar como objetable.

### F-V3-013 · El ensayo del paso 3 nombra una lista fija

`1-renombrado.md:251-256` ensaya «0125…0178 y la de renombrado». Si alguna migración de los sub-specs 2 o 4
(`ADD VALUE`, CHECK con `CASE`, backfill) se mergea a staging antes del corte, corre en esa misma transacción en
prod. El criterio debería decir «toda la cadena pendiente en el commit del corte», y la spec debería decir si 2-7
entran antes o después del corte. Al pasar: la 0148 sólo acepta `'gastronomy'` en la CUT-LIST
(`0148_cut_paso_3.sql:89`); con cero locales en prod no importa, pero el runbook del corte no debe escribir `venue`
en esa lista.

### F-V3-014 · Usuarios de fixture `gastro-owner-*` fuera del inventario

La regla 3 de G-FAC-R1 (prefijo `gastro-`) los atrapa, pero discovery A sólo lista `gastronomy-owner@local.test` y
`host-gastronomy@local.test` (`05-discovery-a-renombrado.md:135`). `gastro-owner-julieta/rodrigo/valentina@local.test`
aparecen en cinco e2e `listing-owner-0[1-5]` y en las data-migrations 0029 y 0059. Sumarlos al mapa de nombres.

### F-V3-015 · Lo que el implementador todavía tiene que decidir

- Hijos de Linear 1-7, 8 y 9 sin crear (todos los sub-specs dicen «hijo pendiente de crear»); sin ellos no hay tag
  `[HOS-NNN]` por PR ni etiquetas de smoke por hijo.
- Nombres marcados «propuesto» o «a confirmar»: endpoint `section-preview` (`5-editor.md:106`), clave `foodEvents`,
  ícono de la vertical, lista de ítems de noche. Conviene fijarlos al descomponer, no en el PR.
- El sub-spec 9 se llama «inventario cerrado» pero tiene una fila «a ubicar en la tarea (no se relevaron)» (correos de
  bienvenida) y la frase «un ítem nuevo … entra a esta tabla». Relevar los correos ahora (son pocos archivos de
  `packages/notifications`) y cerrarlo de verdad.

---

## Key Learnings:

1. Un guard de «palabra retirada» choca con todo lo que describe el esquema **antes** del renombrado: no sólo las
   migraciones, también los tests que aplican migraciones hasta un tag y los tests de data-migrations históricas.
   Sacar del escaneo los módulos sin sus tests deja el guard rojo de nacimiento.
2. Editar una migración vieja sólo puede cambiar **valores**; los nombres de tabla de ese momento (`ALTER TABLE
   "gastronomies"` en la 0132) no se pueden tocar. «Se edita y se escanea» tiene que ser un chequeo de valores, no la
   regla de identificadores.
3. Decidir cuándo se **ofrece** algo no decide cuándo se **muestra** su agregado: un dato desnormalizado en la fila
   (el `rating` de la ficha) escapa al proyector genérico porque no es un campo del schema de update.
4. `GastronomyRatingSchema` exige las cuatro dimensiones y admite 0, y se usa a la vez para la entrada de la reseña y
   para el agregado de la ficha: «dimensiones opcionales» es un cambio de forma de datos, no sólo de UI.
5. La imputación de `overallRating` vive en el servicio de reseñas de venue, no en la base compartida; la base cuenta
   `null` como 0. Sólo venue y experiencia extienden `BaseListingService`.
6. Cuando un campo cambia de sección, el admin es el lector que se olvida: su formulario consolidado edita `menuUrl`
   en los tres modos, y su PATCH pasa por la cadena.
7. `tourProgress.ts` guarda `settings.onboarding.adminTours` como `tourId → version` también para tours del web:
   renombrar un id de tour re-muestra el tour si no se migra la clave.
8. Hay dos listas a mano gemelas del purge (`BLANK_CONTENT` y `LISTING_SUPPORT_EDIT_CONTENT_FIELDS`); un guard que
   mira una sola deja la otra desincronizada en silencio.
