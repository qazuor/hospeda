---
title: Revisión vuelta 1 · B — producto, UX, edge cases y corner cases
linear: HOS-1787
created: 2026-10-25
---

# Revisión vuelta 1 · Revisor B (producto y edge cases)

Base verificada: `origin/staging @ 2ebee74d0a` (checkout `hospeda-spec-hos-1787-docs`). Las rutas
`file:line` son del código actual; las de la spec son relativas a la carpeta de la spec.

## Resumen

| severidad | cantidad |
|---|---|
| CRÍTICA | 0 |
| ALTA | 6 |
| MEDIA | 12 |
| BAJA | 4 |
| **total** | **22** |

Los tres temas que más pesan:

1. **«Ocultar» se definió para una sola superficie.** La spec saca el contenido oculto de
   `getBySlug`, pero hoy ese contenido también sale por `getById`, por el contexto del chat de IA,
   por el QR de carta y por el panel de mi-cuenta (F-001, F-002).
2. **Rubros gratis e ilimitados, sumados a colecciones públicas, se pueden manipular.** La
   validación tipo ↔ rubro no frena las combinaciones que DEC-FAC-010 dice querer evitar (F-004).
3. **Planes comunes con diferenciales que son de la carta.** Un boliche que paga premium compra
   secciones que para él son `AUSENTE` (F-005).

---

### F-V1-B-001 · El contenido oculto se filtra por superficies fuera de `getBySlug` · ALTA

**Dónde**: sub-spec 3 §«Lecturas para superficies» y sub-spec 4 (columnas `nightInfo` en `venues`).

**Evidencia**:
- `apps/api/src/routes/gastronomy/public/getById.ts:34-44`: la ruta pública devuelve
  `GastronomyPublicSchema` sin aplicar ninguna proyección.
- `packages/schemas/src/entities/gastronomy/gastronomy.access.schema.ts:58-70`: `menuFileUrl` y
  `menuFileKind` están en el schema público. El comentario aclara que **sólo `getBySlug`** los
  anula cuando el plan no otorga la carta. O sea que hoy `getById` público ya expone la carta en
  PDF o foto de un dueño sin plan: es un fallo abierto previo.
- `apps/api/src/services/ai-context/gastronomy-ai-context.ts:116-126,205`: el contexto del chat
  incluye hasta 40 ítems de la carta y `menuUrl` cuando `includeMenu` es verdadero, y
  `apps/api/src/routes/ai/protected/chat.ts:111-114,301-334` decide `includeMenu` **sólo** por
  `manage_gastronomy_menu`. El rubro no interviene.
- `apps/api/src/services/listing-brochure/brochure-content.ts:354`: el folleto PDF imprime
  `menuUrl`.

**Problema**: la sub-spec 3 dice que las capacidades `AUSENTE` y `BLOQUEADA` «no se publican», pero
reemplaza las proyecciones sólo en `getBySlug`. Las columnas nuevas de `nightInfo` viven en la fila
de `venues`, así que salen por **cualquier** proyección de la ficha (`getById`, `list`,
`getByDestination`, los payloads del dueño) salvo que alguien las quite a propósito.

**Escenario de falla**:
1. Un dueño quita el rubro `noche`. La ficha deja de mostrar la entrada y el +18, pero
   `GET /api/v1/public/venues/:id` los sigue devolviendo y cualquier cliente los renderiza.
2. Un dueño quita `gastronomia` de un bar que tenía carta. El turista le pregunta al chat de IA
   «¿qué hay en la carta?» y el modelo responde con los 40 ítems que la ficha ya no muestra.

**Propuesta**: que la sub-spec 3 cierre la lista de **todos** los lectores de contenido público y
semipúblico de una ficha, y que cada uno pase por el resolvedor: `getBySlug`, `getById`, `list`,
`getByDestination`, contexto del chat de IA, folleto PDF, hoja QR, página `/carta/`, sitemap y
JSON-LD. Hay que extender G-FAC-03 o sumar un guard que falle si un lector público del vertical no
llama al resolvedor (modelo: `content-edit-gate-coverage.guard.test.ts`). El fallo abierto de
`menuFileUrl` en `getById` conviene registrarlo como bug aparte y no esperar a esta spec.

---

### F-V1-B-002 · Los satélites de la carta no están modelados: QR de mesa, métricas, fotos, traducciones y widgets · ALTA

**Dónde**: sub-spec 2 (`ContentCapabilityDefinition.entitlementKey` admite una sola clave),
sub-spec 3 y sub-spec 5.

**Evidencia**:
- `apps/api/src/routes/gastronomy/protected/menuQr.ts:153-157` y `menuQrScans.ts:105-109`: gatean
  con `step6Key: 'menu_qr_scan_metrics'` y no con `capabilities`, así que G-FAC-04 no los ve. Otras
  rutas de la carta: `uploadMenuItemPhoto.ts`, `uploadMenuFile.ts`, `deleteMenuFile.ts` y los gates
  de cuerpo `menu-item-photo-gate.ts` y `menu-translations-gate.ts`, cada uno con su clave
  (`menu_item_photos`, `multilingual_gastronomy_menu`).
- `apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro:195-202`: `GastronomyMenuQrWidget`
  lista **todas** las fichas de la vertical sin mirar rubros.
- `apps/web/src/config/tours.ts:196-201`: el tour de bienvenida tiene el paso `gastronomy-qr`.
- `apps/web/src/pages/[lang]/gastronomia/[slug]/carta.astro:90-99`: `/carta/` responde 404 cuando
  la ficha no tiene carta proyectada.

**Problema**: «la carta» no es una capacidad sino una familia: carta, fotos de ítems, carta
multilingüe, QR de mesa, métricas de escaneo y archivo PDF o foto. Cada una tiene su clave. El
modelo actual (una capacidad, una clave opcional) no expresa «AUSENTE si `menu` es AUSENTE;
BLOQUEADA si falta su propia clave».

**Escenario de falla**:
1. Un BOLICHE con plan premium (sólo `noche`) ve en mi-cuenta el widget «QR de tu carta» y el paso
   del tour que lo presenta. Si lo genera, se crea una fila en `qr_codes` cuyo destino es una
   `/carta/` que responde 404.
2. Un bar con QR impresos en las mesas quita el rubro `gastronomia`. Cada escaneo termina en 404 y
   la UI de quitar rubro no avisa que hay QR impresos apuntando a la carta.

**Propuesta**: agregar a `ContentCapabilityDefinition` un `parent?: CapabilityId`. Una capacidad
hija hereda `AUSENTE` del padre y suma su propia clave para `BLOQUEADA`. Así quedarían declaradas
`menuItemPhotos`, `menuTranslations`, `menuQr` y `menuFile`. Todas las rutas y gates de la familia
declaran su `contentCapability`, y G-FAC-04 cubre también `step6Key` y los gates de cuerpo. Los
widgets y pasos de tour de mi-cuenta consultan el mapa de estados. El aviso al quitar un rubro tiene
que nombrar los QR de mesa activos (con su conteo de escaneos si existe).

---

### F-V1-B-003 · El repunte del QR de carta se rompe con el renombrado y los destinos persistidos quedan en dos saltos · ALTA

**Dónde**: sub-spec 1 §Mecánica 4 (redirects) y G-FAC-R2.

**Evidencia**:
- `packages/service-core/src/services/gastronomy/gastronomy-qr.ts:42`: la regex
  `^\/([a-z]{2})\/gastronomia\/[^/]+\/carta\/?$` recupera el idioma desde el `target_url`
  guardado.
- `packages/service-core/src/services/gastronomy/gastronomy.service.ts:731-737`: si la regex no
  matchea, el hook de cambio de slug **loguea y no repunta**.
- `qr_codes.target_url` guarda la URL absoluta con `/gastronomia/<slug>/carta/`.
- `apps/web/src/pages/qr/[slug].astro:117-130`: responde un 302 hacia ese destino.

**Problema**: después del renombrado, el constructor emite `/comer-y-salir/` y la regex nueva no
reconoce las filas viejas (o la vieja no reconoce las nuevas). La sub-spec sólo prevé el 301 de
`/gastronomia/…/carta/`; no migra `qr_codes.target_url` ni toca la regex.

**Escenario de falla**: un dueño renombra su local (cambia el slug) después del deploy. El repunte
falla en silencio y el QR impreso sigue apuntando al slug viejo: 302 → 301 → 404. Antes de eso, cada
escaneo ya hace dos saltos (302 + 301).

**Propuesta**: (1) una data-migration que reescriba `qr_codes.target_url` de propósito `MENU` (y de
cualquier propósito con la ruta vieja) al prefijo nuevo; (2) que la regex de lectura acepte los dos
prefijos durante un tiempo acotado; (3) un test de regresión «slug renombrado sobre una fila
pre-renombrado repunta». Se cruza con la lente de datos (A).

---

### F-V1-B-004 · Rubros gratis e ilimitados + colecciones públicas = manipulación; la validación no frena lo «absurdo» · ALTA · REQUIERE DECISIÓN DEL OWNER

**Dónde**: DEC-FAC-005, 006, 010 y 011; sub-spec 2 (tipos por rubro); sub-spec 7 («la moderación no
cambia»).

**Evidencia**: la regla de DEC-FAC-010 es «el tipo pertenece a **alguno** de los rubros elegidos».
Con la tabla de la sub-spec 2:
- HELADERIA + `{gastronomia, noche}` es válida, porque HELADERIA ∈ gastronomia. DEC-FAC-010 da
  justamente «heladería sólo noche» como ejemplo de combinación absurda, y la regla sólo frena el
  caso «sólo noche», no la mezcla.
- RESTAURANT + `noche` y BOLICHE + `gastronomia` también son válidas.

**Problema**:
1. Como sumar rubros no cuesta nada, el incentivo racional es tildarlos todos para aparecer en
   todas las colecciones. Las colecciones pierden sentido y nadie las modera.
2. Secciones y pertenencia a una colección quedan **acopladas**: un boliche que quiere publicar su
   carta de tragos (`menu`) tiene que entrar a la colección `gastronomia`, y una heladería que abre
   de noche entra a «Noche».
3. Los chips de `?type=` de `/rubro/noche/` no pueden salir del catálogo (BAR, CERVECERIA, PUB,
   BOLICHE), porque en esa colección también hay RESTAURANT y HELADERIA.

**Escenario de falla**: al mes del lanzamiento, `/comer-y-salir/rubro/noche/` de una ciudad chica
muestra panaderías y heladerías. El SEO de la colección se degrada y el turista que busca boliches
deja de confiar en la página.

**Propuesta** (opciones):
- **(a) Matriz tipo → rubros permitidos, no sólo preseleccionados.** El catálogo declara por tipo
  qué rubros admite (BOLICHE: `{noche}` o `{noche, gastronomia}`; HELADERIA: sólo `{gastronomia}`).
  Pros: simple, sin moderación. Contras: rigidez ante casos reales raros.
- **(b) Separar «habilita secciones» de «aparece en la colección».** La pertenencia a la colección
  sale de rubro ∩ tipos compatibles, y las secciones salen de la unión. Pros: el boliche con carta
  de tragos no contamina la colección gastronómica. Contras: un concepto más.
- **(c) Cambios de rubro en fichas publicadas pasan por moderación.** Contras: carga operativa y
  contradice «la moderación no cambia».
- **Recomendada: (a)**, con los chips de tipo de cada colección derivados de los datos reales.

**OD**: nueva.

---

### F-V1-B-005 · Planes comunes con diferenciales de la carta: un boliche paga premium por secciones AUSENTES · ALTA · REQUIERE DECISIÓN DEL OWNER

**Dónde**: DEC-FAC-002; sub-spec 6 (no toca pricing); copy de `/planes/comer-y-salir/` y
`/presentacion/comer-y-salir/`.

**Evidencia**:
- `scripts/production-catalog/catalog.ts:730-736`: pro suma `manage_gastronomy_menu`,
  `daily_special` y `events`.
- `scripts/production-catalog/catalog.ts:853-876`: premium suma `download_listing_pdf`,
  `menu_item_photos`, `multilingual_gastronomy_menu` y `menu_qr_scan_metrics`.
- `apps/web/src/components/billing/plan-comparison-rows.ts:353-387`: el código mismo describe la
  carta como «The gastronomy differentiator».

**Problema**: para un local sólo `noche`, lo que distingue a premium de pro es casi todo `AUSENTE`.
El único diferencial útil es el PDF. `nightInfo` es gratis en todos los planes. La página de
precios y la de presentación siguen hablando de carta y menú del día a un dueño de boliche. Y el
upsell proactivo de BLOQUEADA (sub-spec 5) llevará a esa misma página de precios.

**Escenario de falla**: un dueño de boliche contrata premium por «más visibilidad». En la tabla
comparativa ve «fotos en la carta, carta multilingüe, QR de mesa», se suscribe y descubre que no
puede usar nada de eso. Pide la baja o el reembolso.

**Propuesta** (opciones):
- **(a)** Filas comparativas y copy de pricing derivados del catálogo de capacidades, con las filas
  de un rubro marcadas «sólo para locales con rubro X». Sin cambio de precios.
- **(b)** Diseñar al menos un diferencial pro/premium para `noche` (p. ej. destacar eventos o
  métricas de la ficha) antes del lanzamiento.
- **(c)** Aceptarlo y documentarlo como conocido.
- **Recomendada: (a)** ahora y (b) como follow-up de producto. En todos los casos, el upsell de una
  sección BLOQUEADA tiene que nombrar la capacidad que desbloquea, no el plan genérico.

---

### F-V1-B-006 · Reemplazar el gating público de alojamiento y experiencia por el resolvedor cambia comportamiento visible · ALTA

**Dónde**: sub-spec 3 §«Ficha pública»; sub-spec 2 (fila `estandar`: «todas las propias de la
vertical»); DEC-FAC-004 («sin cambios visibles»).

**Evidencia**:
- `apps/api/src/utils/entitlement-filter.ts:24-58`: alojamiento gatea **campos** (`richDescription`,
  `video`, `verification`, `aiChat`), no secciones.
- `experience/public/getBySlug.ts` tiene `ownerGrantsDirections: false` fijo (discovery B §2,
  HOS-1049).

**Problema**:
1. El resolvedor decide secciones. Usarlo para reemplazar un filtro de campos es otro modelo y no
   está diseñado.
2. Reemplazar el `false` literal de experiencia por el resolvedor **publica** el «cómo llegar» para
   los dueños con `manage_experience_directions`. Eso es un cambio visible, justo lo que DEC-FAC-004
   promete no hacer.
3. «Todas las propias de la vertical» no es una lista. Dos implementadores van a armar catálogos de
   alojamiento distintos, o uno vacío que pasa G-FAC-02 regla 4 por vacuidad.

**Escenario de falla**: el PR de la sub-spec 3 cambia lo que ve el público en fichas de alojamiento
y experiencia sin que ninguna sub-spec lo pida ni haya smoke de esas verticales.

**Propuesta**: sacar alojamiento y experiencia del reemplazo público en esta spec (que conserven
`entitlement-filter.ts` y su literal) o, si entran, listar por vertical las capacidades exactas,
documentar el cambio de HOS-1049 como decisión explícita y agregar smoke de esas fichas. En
cualquier caso, G-FAC-02 tiene que exigir ≥1 capacidad declarada por vertical con ficha.

---

### F-V1-B-007 · Escrituras de una capacidad en la misma request que cambia los rubros; 404 indistinguible · MEDIA · REQUIERE DECISIÓN DEL OWNER

**Dónde**: sub-spec 3 (paso nuevo, `AUSENTE → 404`) y sub-spec 4 («escritura por el PATCH de la
ficha»).

**Problema**:
1. `nightInfo` son columnas de la ficha y se escriben por el PATCH general. El formulario
   consolidado del admin (sub-spec 7) y el alta mandan rubros y `nightInfo` **en el mismo cuerpo**.
   Si el paso evalúa los rubros que ya tiene la ficha (los `loadFacts` previos), «agregar `noche` y
   cargar la entrada» falla con 404. En el alta ni siquiera hay hechos previos.
2. Un 404 `NOT_FOUND` sobre el PATCH de una ficha que existe es indistinguible de «la ficha no
   existe» (`apps/api/docs/error-contract.md:41`). La web no puede decir «esa sección ya no aplica
   a tus rubros».
3. Pestaña desactualizada: el dueño quita `noche` en una pestaña y guarda `nightInfo` desde otra.
   Recibe un 404 genérico.

**Propuesta** (opciones):
- **(a)** Evaluar el paso contra los rubros **resultantes** del cuerpo (los previos más el cambio)
  y, para los campos de una capacidad AUSENTE dentro de un PATCH general, rechazar con 404 y un
  `error.reason` interno `CAPABILITY_ABSENT` que la web mapea a un mensaje propio.
- **(b)** Ignorar en silencio los campos de capacidades AUSENTES dentro del PATCH. Contra: pierde
  datos sin aviso.
- **Recomendada: (a)**. Hay que escribir explícitamente el caso del alta.

---

### F-V1-B-008 · El ciclo de vida de los rubros en edición está sin especificar · MEDIA

**Dónde**: sub-spec 2 (≥1 en servicio), sub-spec 5 (sólo el alta y quitar un rubro) y sub-spec 7.

**Evidencia**: `packages/schemas/src/common/listing-completeness.ts:240-265`: el gate de
publicación no conoce los rubros.

**Huecos**:
1. **Cambio de tipo en edición**: ¿re-sugiere rubros, los agrega solo o sólo valida? Ejemplo: de BAR
   `{noche}` a RESTAURANT es inválido. ¿Qué ve el dueño?
2. **Quitar un rubro que deja el tipo huérfano** (BOLICHE `{noche, gastronomia}` sin `noche`): hay
   que bloquearlo en la UI y decir por qué.
3. **Ficha con cero rubros**: fila legacy, backfill fallido o una puerta de alta que no los manda.
   Las puertas son el alta protegida, el admin, el seed, `supportEdits.ts` (acción 15) y el
   borrador pre-trial. No está dicho qué hace el resolvedor con `facets = []` (¿todo lo no común
   AUSENTE?) ni si la ficha se puede publicar. Propuesta: `facets ≥ 1` entra al gate de
   publicación y el resolvedor trata `[]` como un estado explícito, testeado.
4. **El catálogo evoluciona**: si un deploy saca un tipo de un rubro, las fichas existentes quedan
   inválidas y **cualquier** guardado falla por la validación tipo ↔ rubro. Hace falta una regla:
   validar sólo cuando cambian tipo o rubros, o migrar las fichas en el mismo cambio, con un guard.
5. **Volver a agregar un rubro**: la sub-spec 5 promete recuperar los datos. Falta decir qué pasa si
   en el medio cambió el plan (pasan a BLOQUEADA y no se publican) y cuánto tiempo se conservan.
6. **Addon dependiente**: sin caso hoy, así que es YAGNI. Recomendado: borrar la regla de la
   sub-spec 5 en vez de dejarla «escrita pero sin caso», que invita a implementarla a medias.

---

### F-V1-B-009 · `estandar` en alojamiento y experiencia: default en el alta y UI de una sola opción · MEDIA

**Dónde**: DEC-FAC-004, sub-spec 2 (backfill), sub-spec 5 (selector en datos básicos) y sub-spec 7
(columna y filtro).

**Problema**:
1. El servicio exige ≥1 rubro al crear. Si `facets` pasa a ser obligatorio en el schema de alta de
   alojamiento y experiencia, rompe a todo cliente que crea fichas hoy (web host onboarding, admin,
   seed, tests). No está dicho si el servidor lo asigna por defecto.
2. Si el editor y el admin renderizan el selector derivado del catálogo, el alojamiento muestra un
   checkbox único y fijo «Estándar», y el admin una columna «Rubro: estandar» en todas las filas.
   Contradice «sin cambios visibles».
3. `estandar` necesitaría etiqueta i18n en es/en/pt aunque nunca se muestre.

**Propuesta**: el servidor asigna el único rubro cuando la vertical tiene exactamente uno y el
cliente no manda rubros. El selector, la columna y el filtro sólo aparecen cuando el catálogo de la
vertical tiene más de un rubro. Esa consulta es al catálogo, no un literal de vertical, así que es
compatible con G-FAC-05. Sumar a G-FAC-02: «una vertical con un solo rubro no lo declara
`publico`».

---

### F-V1-B-010 · BLOQUEADA y AUSENTE desde el lado del dueño: datos cargados, lectura, borrado y vista previa · MEDIA

**Dónde**: DEC-FAC-009 y sub-spec 5.

**Problema**: el caso típico es una bajada de plan (premium → básico) con la carta ya cargada.
`manage_gastronomy_menu` no está en básico (`catalog.ts:548-662` vs. `730`). La spec no dice:
1. Si en BLOQUEADA el dueño ve sus datos (sólo lectura), sólo el upsell, o el formulario
   deshabilitado.
2. Si puede **borrar** contenido de una sección BLOQUEADA (p. ej. una carta vieja que no quiere que
   reaparezca al volver a subir de plan). Hoy la API rechaza toda escritura, incluido el borrado.
3. Qué muestra el hub (`listing-editor-hub-status-model.ts`) para una sección BLOQUEADA con datos:
   «cargada pero oculta por tu plan» es información crítica.
4. AUSENTE: las lecturas responden 404, así que después de quitar un rubro **el dueño tampoco
   puede ver** lo que se conserva. «Ocultar, no borrar» se vuelve invisible para todos. Conviene
   que el aviso al quitar un rubro diga cuántos ítems quedan guardados.
5. Si el dueño mira su ficha pública, no ve la carta y no sabe por qué. Hace falta un aviso en el
   editor o en la vista previa del dueño.

**Propuesta**: BLOQUEADA = datos en sólo lectura + upsell + borrado permitido (borrar no
«construye», es coherente con la regla «construir ≠ mirar»). El hub distingue «bloqueada con datos»
de «bloqueada vacía». El aviso de quitar un rubro muestra conteos.

---

### F-V1-B-011 · `nightInfo` como está diseñado no representa la noche real · MEDIA · REQUIERE DECISIÓN DEL OWNER

**Dónde**: sub-spec 4 §«Capacidad nightInfo».

**Problemas**:
1. **La entrada varía por noche y por hora** («gratis hasta la 1», «viernes $X, sábado $Y»).
   `entry_kind = varies` sin texto queda vacío de contenido. ¿`varies` admite precio? ¿`free` con
   precio es inválido? No está dicho.
2. **Moneda e inflación**: centavos de ARS sin fecha se desactualizan en semanas. Propuesta: guardar
   `entry_price_updated_at` y mostrar «aprox., actualizado <mes>», o usar rangos (el `priceRange`
   común ya existe).
3. **`min_age`**: 0 vs. `null` (¿«apto todo público» o «no informado»?). Las matinés para menores
   (13-17) y las noches +18 conviven en el mismo boliche. La venta de alcohol a menores de 18 está
   prohibida (Ley 24.788), y mostrar «+16» puede leerse como que se sirve alcohol a esa edad.
   Conviene que el texto legal y el formato (badge «+18») queden definidos y traducidos.
4. **Híbridos**: en un resto-bar `{gastronomia, noche}`, «Entrada paga» y «+18» sin contexto
   espantan al cliente del mediodía. Hace falta un marco tipo «De noche: …» o una franja horaria a
   la que aplica.
5. **Noches abiertas vs. horario**: hay un solo `openingHours` (soporta pasar la medianoche,
   `opening-hours.schema.ts:30-53`). Un resto-bar no puede decir «cocina 12-16 / 20-24, boliche
   jue-sáb 01-06». Decidir si `nightInfo` lleva sus noches o se acepta la limitación.
6. **Dress code**: texto libre traducible exige que el dueño lo traduzca a mano en tres idiomas, y
   la sección común de traducciones sólo cubre `nameI18n`, `summaryI18n`, `descriptionI18n` y
   `richDescriptionI18n` (`apps/web/src/components/listing/editor/listing-section-payload.ts:87`).
   No está dicho dónde se edita `dressCodeI18n`. Alternativa: enum (`casual`, `smart casual`,
   `elegante`, `sin restricciones`) + nota libre opcional, que se traduce solo.
7. Faltan el `slug`, el `labelKey`, el grupo y el orden de la sección del editor, y cómo entra
   `nightInfo` al contexto del chat de IA y al JSON-LD (F-014, F-015).

**Propuesta**: decidir 1, 3, 5 y 6 con el owner. Recomendado: `entry_kind` + `entry_note` libre
corto, precio con fecha, `min_age` nullable con 18 como valor sugerido para BOLICHE, dress code
como enum + nota, y la limitación del horario único documentada.

---

### F-V1-B-012 · `PUB` duplica a `BAR`, las etiquetas en/pt no están definidas y las listas de tipos no son exhaustivas · MEDIA

**Dónde**: sub-spec 4 §«Tipos nuevos».

**Evidencia**:
- `packages/schemas/src/enums/gastronomy-type.enum.ts:5`: el docblock dice «BAR: Bar or pub».
- Listas planas que **no** fallan la compilación al agregar un valor:
  `apps/web/src/pages/[lang]/gastronomia/index.astro:177-187` (`GASTRONOMY_TYPES`, que alimenta los
  chips de tipo) y `apps/web/src/lib/listing-summary/summary.catalogs.ts:16`
  (`DEFAULT_GASTRONOMY_TYPES`).

**Problema**: la sub-spec confía en que los `Record<Enum, …>` exhaustivos atrapen todo, pero estas
listas no son `Record`: PUB y BOLICHE quedan fuera del filtro y de los chips sin que nada falle. En
inglés «Pub» y «Bar» se pisan; en portugués BOLICHE es «balada» o «boate», no «boliche» (que en
Brasil es bowling).

**Propuesta**: (1) confirmar con el owner si `PUB` aporta algo distinto de BAR o se queda afuera;
(2) derivar las listas de tipos del enum o del catálogo, con un test que compare contra
`Object.values`; (3) fijar en la spec las etiquetas es/en/pt de los tipos nuevos.

---

### F-V1-B-013 · Las reseñas puntúan «comida» a un boliche · MEDIA · REQUIERE DECISIÓN DEL OWNER

**Dónde**: no lo trata ninguna sub-spec.

**Evidencia**: `packages/schemas/src/entities/gastronomy/subtypes/gastronomy.review.schema.ts:12-13,58-64`:
las dimensiones son food, service, ambiance y value, y el `averageRating` sale de esas dimensiones.

**Problema**: las dimensiones de reseña son por vertical, no por rubro. Un boliche recibe y muestra
«Comida: 2/5», que además baja su promedio.

**Propuesta** (opciones):
- (a) Dimensiones habilitadas por capacidad (p. ej. `food` sólo si `menu` no es AUSENTE).
- (b) Volver opcional cada dimensión y mostrar sólo las que tengan votos.
- (c) Dejarlo como está y documentarlo.
- **Recomendada: (b)**, más barata y compatible con rubros futuros.

---

### F-V1-B-014 · El chat de IA es un «asistente de restaurante» y rechazaría preguntas de la noche · MEDIA

**Evidencia**: `packages/ai-core/src/engine/default-prompts.ts:212` (guardrails «restaurant or food
venue») y `:358` («You are a dining assistant embedded in a restaurant detail page»). Los prompts
viven en `ai_settings` (data-migration 0101), así que cambiar el default no actualiza lo ya
guardado.

**Problema**: en un boliche, «¿cuánto sale la entrada?» o «¿hay dress code?» quedan fuera del
alcance que declara el prompt. Además el contexto no trae `nightInfo` (F-001).

**Propuesta**: prompt neutral («local de comida o salida») con secciones de contexto armadas desde
el mapa de capacidades DISPONIBLES, y una data-migration que actualice el prompt guardado, o una
regla que diga que no se pisa una edición del admin.

---

### F-V1-B-015 · El JSON-LD marca todo local como `Restaurant` · MEDIA

**Evidencia**: `apps/web/src/components/seo/RestaurantJsonLd.astro:46` (`'@type': 'Restaurant'`
fijo); `[slug].astro:270-281`.

**Problema**: un BOLICHE con `@type: Restaurant` es un dato estructurado falso. Google puede
mostrarlo como restaurante o ignorarlo.

**Propuesta**: mapear `@type` por el **tipo** descriptivo, que no es rubro, así que no viola la
regla 1: BAR/PUB/CERVECERIA → `BarOrPub`, BOLICHE → `NightClub`, CAFE → `CafeOrCoffeeShop`,
HELADERIA → `IceCreamShop`, PANADERIA → `Bakery`, resto → `Restaurant`. `hasMenu` sólo si `menu`
está DISPONIBLE. Que sea un `Record<Type, …>` exhaustivo.

---

### F-V1-B-016 · Colecciones: política de crawl, canónicas, sitemap vacío al lanzar y estados vacíos · MEDIA

**Dónde**: sub-spec 6 §Colecciones.

**Evidencia**:
- `apps/web/src/lib/filters/facet-crawl-policy.ts:46+`: `FACET_QUERY_PARAM_KEYS` no tiene `rubro`.
  La sub-spec agrega `?rubro=` a la API sin decir si existe en la web.
- `apps/web/src/pages/sitemap-dynamic.xml.ts:516-536`: hay dos precedentes opuestos. Los tipos de
  alojamiento entran **siempre**; las atracciones **sólo si se usan** («no empty page is ever
  advertised»).

**Problemas**:
1. Si `/comer-y-salir/?rubro=noche` existe en la web, hace falta `Disallow` y una canónica hacia
   `/rubro/noche/` (`promoted-facet-canonical.ts`). Si no, se repite el crawl combinatorio medido en
   HOS-369 (464k requests en 24 h).
2. Al lanzar **no hay fichas reales** (PDR §5). Publicar en el sitemap dos colecciones vacías × 3
   idiomas es anunciar thin content. Falta elegir el precedente.
3. Estado vacío por ciudad (`/rubro/noche/?destinationIds=<pueblo>` sin resultados): copy, CTA (ver
   todo Comer y salir, o publicar tu local) y `noindex` cuando está vacía.
4. `/rubro/noche/?type=…`: qué chips de tipo se ofrecen (se cruza con F-004).

**Propuesta**: sumar `rubro` a la política de crawl y a la canónica promovida; seguir el precedente
de atracciones (sitemap sólo con colecciones con ≥1 ficha publicada); `noindex,follow` para una
colección vacía; copy del estado vacío en las tres lenguas.

---

### F-V1-B-017 · «slug = UI = URL» choca con i18n, y la palabra «gastronomía» aparece con cuatro significados · MEDIA

**Dónde**: DEC-FAC-015 («un nombre por rubro, slug = UI = URL»), DEC-FAC-014 y sub-spec 6 (menú y
breadcrumbs «a definir»).

**Evidencia**: «Gastronomía» ya es categoría de eventos (`facet-slugs.ts:71`), de posts (`:84`),
sección de la home (`packages/i18n/src/locales/es/home.json:129-131`, «Sabores únicos de la cocina
regional») y dimensión de rating de destino (`DestinationRatingBreakdown.astro:22,46`).

**Problema**:
1. Si la UI muestra el slug, un visitante en inglés ve «noche» y «gastronomia». La regla tiene que
   decir que la UI usa i18n y que sólo el slug es fijo en español.
2. En la navegación conviven «Comer y salir › Gastronomía» y «Eventos › Gastronomía», que no son la
   misma cosa. Tampoco está definido el breadcrumb de una ficha híbrida (¿«Comer y salir › X» o con
   el rubro en el medio?).
3. Las etiquetas en/pt de «Comer y salir», `noche` y `gastronomia` no están fijadas.

**Propuesta**: corregir DEC-FAC-015 a «slug = URL; etiqueta por i18n». Breadcrumb de la ficha sin
rubro (la URL de la ficha es independiente del rubro, DEC-FAC-011). Fijar en la spec las etiquetas
es/en/pt y el texto del ítem de menú.

---

### F-V1-B-018 · Admin: permiso, aviso al dueño y efecto de cambiar los rubros de una ficha ajena · MEDIA

**Dónde**: sub-spec 7.

**Problema**:
1. No dice qué permiso habilita editar rubros (¿`venue.editAll`? ¿lo mismo que el tipo?).
2. Un moderador que saca `gastronomia` a una ficha oculta una carta que el dueño paga, sin
   notificarlo. Hace falta un aviso al dueño, o un registro en la línea de tiempo de la ficha.
3. No hay vía para corregir un abuso de rubros (F-004) más que editarlos a mano. ¿Se usa
   REQUEST_FIX?
4. El selector de tipo del admin vive en `gastronomy-consolidated.config.ts`, otra lista de tipos
   que hay que derivar (F-012).

**Propuesta**: fijar el permiso, notificar al dueño cuando un tercero cambia sus rubros y documentar
el uso de REQUEST_FIX para rubros mal elegidos.

---

### F-V1-B-019 · La canónica de paginación del listado apunta a una ruta que no existe · BAJA

**Evidencia**: `apps/web/src/pages/[lang]/gastronomia/index.astro:68` (lee `?page=`) y `:316-317`
(emite la canónica `…/gastronomia/page/N/`). No hay `gastronomia/page/[page].astro`, y el
middleware no reescribe `/page/N`.

**Problema**: es un bug previo que el renombrado hereda. La sub-spec 6 agrega `/rubro/<r>/page/N`
con el patrón de alojamiento, y el listado general queda con la otra convención y una canónica
rota.

**Propuesta**: arreglarlo en el mismo cambio de la sub-spec 6 (crear `comer-y-salir/page/[page].astro`
como alojamiento) y cubrirlo con el guard de sitemap/canónicas.

---

### F-V1-B-020 · Detalles de UX del renombrado · BAJA

1. `mi-cuenta/comercio/venue/…`: segmento en inglés en una URL que ve el dueño, mientras todo lo
   público queda en español. Aceptable, pero que sea una decisión explícita.
2. `publicar-restaurante` redirige desde su propia página
   (`apps/web/src/pages/[lang]/publicar-restaurante/index.astro`), no desde `legacy-redirects.ts`.
   Si G-FAC-R2 exige «existe en `legacy-redirects.ts`», o lo marca rojo o no lo ve. Tiene que
   aceptar las dos fuentes o mover esa regla.
3. Los redirects de `/mi-cuenta/comercio/gastronomy/<id>/editar/<seccion>/` tienen que conservar la
   ruta profunda y el query (marcadores de dueños, links en correos ya enviados).
4. El nombre del plan en el resumen de tarjeta («Gastronomía Básico») no va a coincidir con la
   página de precios («Comer y salir»). Se cruza con OD-04.
5. No hay un What's New ni un mail que les explique a los dueños de prueba o early adopters qué son
   los rubros.

---

### F-V1-B-021 · «Una ficha = una dirección» vs. dos negocios en el mismo lugar · BAJA · REQUIERE DECISIÓN DEL OWNER

**Dónde**: DEC-FAC-006 y 017; issue aparte.

**Problema**: la regla de una dirección más «rubros = unión» obliga a que un restaurante en planta
baja y un boliche en el subsuelo, con **nombres, marcas y horarios distintos** en el mismo número de
calle, sean una sola ficha con un nombre y un horario. Lo mismo pasa con patios gastronómicos y con
el restaurante abierto al público de un hotel (otra vertical, misma dirección).

**Propuesta**: que el issue de la dirección defina la clave (¿dirección + unidad o piso?) y las
excepciones antes de implementar la sub-spec 5, y que esta spec lo nombre como dependencia de
producto.

---

### F-V1-B-022 · Purga de cache: alcance incompleto · BAJA

**Dónde**: sub-spec 6 §Cache.

**Problema**: «las colecciones afectadas» tiene que ser **rubros viejos ∪ nuevos**, porque quitar
un rubro también tiene que sacar la ficha de esa colección. También hay que purgar el listado
general, las páginas de destino que listan locales (`getByDestination`) y, con un cambio de plan,
**todas** las fichas del dueño. Hoy esto último está como «verificar», sin criterio de aceptación.

**Propuesta**: agregar un criterio de aceptación con test: «quitar `noche` saca la ficha de
`/rubro/noche/` en la siguiente lectura sin cache» y «bajar de plan oculta la carta de las N fichas
del dueño».
