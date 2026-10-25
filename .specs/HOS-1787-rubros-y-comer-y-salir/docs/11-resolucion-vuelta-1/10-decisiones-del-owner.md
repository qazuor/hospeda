---
title: Resolución vuelta 1 · Decisiones del owner
linear: HOS-1787
created: 2026-10-25
status: respondida
---

# Resolución vuelta 1 · Preguntas al owner

Todas juntas, ordenadas para que las que condicionan a otras vayan primero. **Q-01 es la compuerta**:
Q-02 y Q-03 cambian según su respuesta. Cada pregunta dice qué decisión abierta (`OD-NN`) cierra y qué
hallazgos (`F-V1-NNN`, en `../10-revision-vuelta-1/00-consolidado.md`) destraba.

Lo que tenía una opción claramente mejor y no necesitaba criterio de producto ya se decidió y está al
final, en «Decidido sin preguntar», para que puedas objetarlo.

| Q | título | cierra | depende de |
|---|---|---|---|
| Q-01 | Cuándo cae el renombrado | OD-08 | (medición OD-14, recomendable) |
| Q-02 | Cómo se renombran los planes | OD-04 | Q-01 |
| Q-03 | Cómo se despliega el cambio | OD-06 | Q-01 |
| Q-04 | Nombres internos en el código | OD-02, OD-07 | - |
| Q-05 | Qué sobrevive del nombre viejo | OD-01, OD-03, OD-05 | Q-04 |
| Q-06 | Dónde se guardan los rubros | OD-09 | - |
| Q-07 | Alcance de alojamiento y experiencia | OD-10 | - |
| Q-08 | Qué rubros admite cada tipo | OD-11 | - |
| Q-09 | Planes y reseñas de noche | OD-12 | - |
| Q-10 | Datos de la noche | OD-13 | - |

## Antes de responder: una medición (OD-14, F-V1-026)

DEC-FAC-016 se apoya en «hoy no hay datos reales de gastronomía», y nadie lo midió. No es una decisión:
es una lectura en prod (por ssh al VPS con `hops psql --target=prod`; una salida vacía es un error
tragado, no «cero filas») que **necesita tu autorización**. Excluyendo `deleted_at`:

- fichas de gastronomía por estado de publicación;
- suscripciones de gastronomía activas o en prueba (`entity_subscriptions`, `billing_subscriptions`) = preapprovals vivas en MercadoPago;
- QR de gastronomía por `purpose` y `source`, y escaneos de los últimos 90 días (`qr_code_scan`);
- usuarios con rol `GASTRONOMY_OWNER`; bookmarks, vistas y fotos de gastronomía.

En staging, además: `subscription`, `trial`, `permanent_grant`, `quota_window` abiertas, `domain_event`
y `email_outbox` pendientes de la vertical. Ayuda sobre todo para Q-01, Q-03 y para decidir cuánto dura
el redirect de `/carta/`.

**Respuesta del owner (2026-10-25):** **cerrada sin medir.** El owner confirma al 100 % que no hay fichas reales de gastronomía en prod. La premisa de DEC-FAC-016 queda confirmada por el owner (DEC-FAC-027); no se hace la lectura en prod ni en staging.

---

## Q-01 · Cuándo cae el renombrado

**Contexto.** Producción corre hoy una versión vieja de la base (migración 0124). Staging ya tiene todo el
sistema nuevo de planes y verticales de HOS-1352 (migración 0177). Ese sistema llega a producción con el
**corte V6**, que además reemplaza toda la historia de migraciones por una sola «foto» de la base. El
renombrado puede viajar con ese corte o llegar después, como un cambio aparte sobre producción ya cortada.
Y no puede quedar partido con el corte en el medio.

1. **Antes del corte, como bloqueante del corte.**
   - Qué hace: el renombrado entra entero a staging antes de ejecutar V6; prod lo recibe junto con el
     corte.
   - Pros: la migración en prod es la más chica posible; los planes se corrigen en su origen (Q-02
     opción 1); el historial de soporte de staging se acepta perdido (son datos de prueba); las
     data-migrations viejas mueren con el corte.
   - Contras: suma un bloqueante al corte; si el renombrado se atrasa, atrasa el corte.
   - Impacto: V6 de HOS-1352 pasa a depender del sub-spec 1; los sub-specs 2 a 7 no.
2. **Después del corte.**
   - Qué hace: el corte sale sin esperar; el renombrado es una migración completa contra prod ya cortada.
   - Pros: el corte no se atrasa.
   - Contras: es la variante más cara: hay que enseñarle a un guard de inmutabilidad a aceptar renombres,
     desactivar protecciones de la base durante la migración, mantener alias de ids y un lector del
     nombre viejo del historial para siempre, y migrar suscripciones y pruebas reales (con smoke de
     billing en prod).
   - Impacto: el sub-spec 1 crece mucho.
3. **Antes si llega; si no, después.**
   - Qué hace: se apunta a antes; si el corte está listo y el renombrado no, sale el corte y se pasa a la 2.
   - Pros: no bloquea a nadie.
   - Contras: hay que especificar las dos variantes (doble trabajo) y congelar el renombrado a tiempo para
     no caer en el medio.
   - Impacto: spec con dos ramas.

**Recomendada: 1.** Es la única que deja el catálogo limpio sin abrir puertas en las protecciones de la
base, y prod casi no tiene datos de la vertical.

En **cualquier** opción, regla fija: el corte no puede caer entre dos PRs del renombrado.

Destraba: F-V1-001, 002 y 003 (con Q-02), 008 (cuotas), 009, 011, 013 (con Q-03).

**Respuesta del owner (2026-10-25):** **opción 1.** El renombrado entra entero antes del corte V6 y es **bloqueante del corte**. Regla fija: el corte nunca cae entre dos PRs del renombrado. Ver DEC-FAC-028.

## Q-02 · Cómo se renombran los planes

**Contexto.** Los planes, addons y claves de la vertical viven en staging, cargados por tres migraciones
(0129, 0144, 0176). Un guard (G18) y unos controles de la base sólo permiten **agregar** filas a ese
catálogo, nunca modificarlas ni borrarlas. Además el id de cada plan se calcula a partir del nombre de la
vertical: renombrarla cambia los ids. Prod todavía no tiene este catálogo. También hay que decidir si
cambian los nombres que ve el cliente (en MercadoPago el resumen de tarjeta dice «Gastronomía Básico»).

1. **Corregir el catálogo en su origen** (sólo si Q-01 = antes).
   - Qué hace: se editan 0129, 0144 y 0176 para que nazcan con `venue` y se resetea la base de staging
     (más las plantillas y bases de worktree).
   - Pros: cero deuda; el guard queda verde sin puertas nuevas; los ids cambian una sola vez, antes de que
     prod tenga nada atado a ellos.
   - Contras: es una excepción explícita a la regla «nunca editar una migración ya aplicada» (aplicada
     sólo en staging y local); hay que rehacer staging, incluidas sus suscripciones de prueba.
   - Impacto: un reset de staging coordinado.
2. **Migración nueva que enseña al guard a aceptar renombres.**
   - Qué hace: G18 aprende a plegar un renombre de identidad y la migración apaga y vuelve a encender los
     controles de inmutabilidad dentro de la transacción.
   - Pros: no edita historia.
   - Contras: abre una puerta en dos protecciones que hoy están cerradas a propósito; con ids nuevos hay
     que migrar suscripciones (smoke de billing en prod).
   - Impacto: cambios en G18 y en `extras/041`.
3. **Congelar los ids con un alias interno.**
   - Qué hace: el cálculo del id sigue usando «gastronomy» como semilla escondida; cambian sólo los textos.
   - Pros: ninguna suscripción pierde su ancla.
   - Contras: la palabra vieja sobrevive en un archivo (contada por el guard); igual necesita lo de la 2
     para las columnas de texto.
   - Impacto: se combina con la 2.
4. **El catálogo conserva `gastronomy` por dentro.**
   - Contras: contradice el renombrado total (DEC-FAC-016).

En 1, 2 y 3 se renombran también slugs (`venue-basico`, `extra-venues-1`…) y nombres visibles («Comer y
salir Básico»), para que el resumen de tarjeta coincida con la página de precios.

**Recomendada: 1 si Q-01 = antes** (la más barata y la única sin puertas nuevas); **si Q-01 = después,
2 + 3**.

Destraba: F-V1-002, 003, 045 (nombre del plan en la tarjeta).

**Respuesta del owner (2026-10-25):** **opción 1.** Se editan 0129, 0144 y 0176 en su origen para que el catálogo nazca `venue`; se resetean la base de staging, la plantilla y las bases de worktree; se cancelan las preapprovals huérfanas del sandbox de MercadoPago. Se renombran slugs y nombres visibles (`venue-basico/pro/premium`, `extra-venues-1`, `visibility-boost-venue-7d/30d`, título en MP «Comer y salir Básico»…). Ver DEC-FAC-029.

## Q-03 · Cómo se despliega el cambio

**Contexto.** Renombrar las tablas rompe al instante a la versión anterior de la API. Base, API, web y
admin se despliegan por separado, y durante un redeploy conviven el contenedor viejo y el nuevo. Un
redirect permanente (301) queda grabado en los navegadores y no se deshace si hay que volver atrás. Y el
renombrado son unos 1.500 archivos que hay que partir en PRs sin dejar staging roto.

1. **Ventana de mantenimiento, partición en dos etapas y redirect temporal durante la prueba.**
   - Qué hace: (a) varios PRs de renombrado «interno» (nombres en el código, carpetas) que siguen
     apuntando a las tablas viejas, sin migración ni cambio de contrato; (b) **un** PR atómico con la
     migración física, los datos y los contratos (API y URLs). Se despliega en ventana con orden fijo:
     bajar web y admin, migrar, desplegar API, desplegar web y admin. Redirects 302 (temporales) en
     staging y prod mientras dura la prueba, y 301 con un cambio explícito después. Migración inversa
     ensayada y lista escrita de lo que no vuelve (historial, correos ya enviados, buscadores).
   - Pros: cada PR deja staging sano; la parte riesgosa queda chica; se puede volver atrás.
   - Contras: unos minutos sin servicio; el PR atómico es grande.
   - Impacto: con Q-01 = antes, la ventana es la misma del corte, que ya es sin convivencia.
2. **Compatibilidad durante un release.**
   - Qué hace: vistas con el nombre viejo y alias de rutas y valores en el release N; se retiran en el N+1
     con un guard con fecha.
   - Pros: sin corte de servicio.
   - Contras: mucho código transitorio que hay que vigilar y retirar; el guard de palabra retirada necesita
     exenciones temporales.
   - Impacto: dos releases.
3. **Sin ventana ni compatibilidad.**
   - Contras: errores 500 y 404 mientras las piezas se despliegan. No recomendada.

**Recomendada: 1.** Con prod casi sin datos de la vertical, unos minutos de ventana cuestan menos que un
release entero de compatibilidad.

Destraba: F-V1-013.

**Respuesta del owner (2026-10-25):** **opción 1.** Dos etapas (varios PRs de renombrado lógico que siguen apuntando a las tablas viejas, y **un** PR físico atómico con migración, valores, contratos de API y URLs); ventana de mantenimiento en staging con orden fijo (bajar web y admin, migrar, API, web y admin); 302 durante el soak y 301 después; migración inversa ensayada. En prod viaja en la ventana del corte. Ver DEC-FAC-030.

## Q-04 · Nombres internos en el código

**Contexto.** Hay cuatro choques de nombres, y conviene fijarlos antes de la migración para no renombrar
dos veces: (a) `venue` ya existe para «eventos del local» (`venueEvents`, `GastronomyVenueEvents*`), para
un tipo de punto de interés (`sports_venue`) y para el lugar de un evento municipal (`venueName`); (b) en
el web, *facet* ya significa «filtro de búsqueda» y las colecciones de rubro se construyen con ese mismo
código; (c) «capacidad» ya significa «una clave del plan» en HOS-1353 y en el error `NO_CAPABILITY`; (d)
los valores `gastronomia`, `noche`, `estandar` quedarían como identificadores en español en código y base.

1. **Paquete limpio.**
   - Qué hace: (a) se queda `venue`; `GastronomyVenueEvents*` pasa a `VenueEvents*` (nunca
     `VenueVenue…`); la sección `venueEvents`, `sports_venue` y `venueName` no se tocan; (b) rubro en código
     = `BusinessLine` (el inglés de «rubro»); (c) capacidad de contenido = `ListingSection` (es lo que es en
     la pantalla); (d) valores internos en inglés (`food`, `nightlife`, `standard`) con un mapa al slug
     español de la URL (`/rubro/gastronomia/`), como ya hace el web con los tipos de alojamiento;
     parámetro de API en inglés; el segmento `mi-cuenta/comercio/venue/` se acepta (es el id de la
     vertical, no un texto).
   - Pros: ningún choque; el guard de palabra retirada queda limpio (`gastronomia` sólo vive en el mapa de
     slugs y en los redirects); cumple la regla de identificadores en inglés.
   - Contras: reemplaza el nombre de DEC-FAC-013 (`ListingFacet`) y el valor interno de DEC-FAC-015; un
     mapa más en el web.
   - Impacto: hoy sólo documentos; nada implementado.
2. **Mínimo.**
   - Qué hace: se quedan `ListingFacet`, «capacidad» y los valores en español; sólo se resuelve (a) como en
     la 1.
   - Pros: no cambia decisiones tomadas.
   - Contras: *facet* con dos significados en los archivos más tocados; `contentCapability` al lado de
     `capabilities` en la misma ruta; el guard tiene que distinguir la palabra retirada del valor vivo.
   - Impacto: más exenciones en el guard.
3. **Intermedio.**
   - Qué hace: sólo capacidad → `ListingSection`; lo demás como la 2.
   - Pros: saca el choque más peligroso (el de HOS-1353).
   - Contras: quedan el choque del web y el del guard.
   - Impacto: medio.

**Recomendada: 1.** Elimina los tres choques de una vez, ahora que todavía no cuesta nada.

Destraba: F-V1-033, 025 (parte), 041 (nombre del parámetro), 045 (segmento de mi-cuenta).

**Respuesta del owner (2026-10-25):** **opción 1, más dos choques que el owner encontró.** Nombres finales: rubro = `BusinessLine`; sección de contenido = `ListingSection`; rasgo dentro de una sección = `SectionTrait` (**no** `ContentFeatureDefinition`: *feature* choca con el catálogo de características `r_venue_feature`); `GastronomyVenueEvents*` → `VenueEvents*`; estados del resolvedor en código `absent | locked | available` (AUSENTE/BLOQUEADA/DISPONIBLE quedan como glosa en español en UI y docs); razón 409 al dueño `SECTION_ABSENT` (reemplaza `CAPABILITY_ABSENT` de DEC-FAC-018); valores de rubro en inglés en código (`food`, `nightlife`, `standard`) con mapa al slug español de la URL (`/comer-y-salir/rubro/gastronomia/`, `/rubro/noche/`); parámetro de API en inglés; `mi-cuenta/comercio/venue/` se acepta. Reemplaza DEC-FAC-013 (`ListingFacet`) y los valores internos de DEC-FAC-015. La palabra «capacidad/capability» queda **sólo** para la clave de entitlement (sentido HOS-1353). Ver DEC-FAC-031.

## Q-05 · Qué sobrevive del nombre viejo

**Contexto.** «Renombrado total» necesita un borde. Hay cosas que no son la vertical (la categoría
«gastronomía» de eventos y posts, la palabra en textos en español), cosas que viven afuera (fotos en
Cloudinary, analítica en PostHog, avisos de novedades ya vistos) y claves internas que nadie ve pero que
fijan ids (las fichas de ejemplo). El guard de palabra retirada se escribe según esta respuesta.

1. **Se renombra la vertical; se conserva lo que no es la vertical y lo que vive afuera.**
   - Qué hace:

     | qué | trato |
     |---|---|
     | categorías de eventos, posts, POI, tag de blog; prosa en español | se quedan (son el tema, no la vertical) |
     | cache tags y clases CSS `gastro-` | se renombran (son la vertical) y se purgan en el deploy |
     | `publicar-restaurante` | queda como ruta vieja con redirect |
     | títulos de addon con «restaurante» | se renombran con Q-02 |
     | ids de fichas de ejemplo y sus semillas | se congelan como claves opacas, con marcador contado por el guard |
     | carpetas de Cloudinary | no se mueven; carpetas mixtas (precedente HOS-831) |
     | propiedad PostHog `is_gastronomy_owner` | pasa a `is_venue_owner` (corta segmentos históricos; aceptable sin datos reales) |
     | ids de What's New y del tour | se renombran; los dueños los ven una vez más (precedente 0109) |
     | reglas de Cloudflare a mano | se actualizan en el mismo momento del deploy |
   - Pros: borde claro; guard escribible sin cientos de excepciones; no se rompe ningún sticker ni foto.
   - Contras: la palabra sobrevive en unas pocas claves opacas, contadas.
   - Impacto: G-FAC-R1 queda como está diseñado en `06-guards.md`.
2. **Cero rastro.**
   - Qué hace: además migra los ids de las fichas de ejemplo (con todo lo que cuelga) y renombra las
     categorías de contenido.
   - Pros: ni una ocurrencia.
   - Contras: rehace fichas de ejemplo con sus fotos, QR y eventos; «Gastronomía» como categoría de eventos
     es correcto y se perdería.
   - Impacto: mucho más trabajo y riesgo.
3. **Mínimo.**
   - Qué hace: sólo la vertical en código y base; lo externo y `gastro-` quedan.
   - Contras: cache tags y CSS con el nombre viejo para siempre; analítica con un nombre que no coincide.
   - Impacto: guard con más excepciones.

**Recomendada: 1.**

Destraba: F-V1-012, 025, 043.

**Respuesta del owner (2026-10-25):** el owner quiere **renombrar todo salvo lo que conservarlo tenga sentido de verdad**. Borde final, lo único que se conserva: (a) la categoría «Gastronomía» de eventos, posts y POI (es el tema, no la vertical); (b) la palabra en español en prosa y el nombre/slug público del rubro `gastronomia` (el valor en código es `food`); (c) el mapa de redirects legacy `/gastronomia/…` → `/comer-y-salir/…`; (d) el propio guard de palabra retirada; (e) eventos pasados de PostHog y correos ya enviados (historia externa). **Se renombra todo lo demás**, incluidos ids y semillas de fixtures (`gastronomy:${seedId}` → venue; staging se resetea por Q-02, no hace falta migración), carpetas de Cloudinary (el seed resube las fotos de ejemplo bajo `venue/`), cache tags y clases CSS `gastro-`, propiedad PostHog → `is_venue_owner`, ids de What's New y del tour. G-FAC-R1 se actualiza a esta lista exacta, cada excepción contada por nombre. Ver DEC-FAC-032.

## Q-06 · Dónde se guardan los rubros

**Contexto.** DEC-FAC-007 dijo «catálogo en código + tabla espejo en base». La revisión encontró que una
tabla espejo no entra en el guard actual del catálogo sin cambiarle la forma, y que la regla «toda ficha
tiene al menos un rubro» quedaría sólo en el servicio, donde dos pedidos simultáneos pueden romperla. Hay
una alternativa más simple: guardar los rubros como una lista dentro de la fila de la ficha, y que la base
exija que no esté vacía y sólo tenga rubros válidos.

1. **Lista dentro de la ficha, controlada por la base.**
   - Qué hace: columna `facets` (lista de textos) con una regla de base que exige al menos uno y sólo
     valores del catálogo, generada desde el código.
   - Pros: la base garantiza la regla sin mecanismos extra; viaja en la fila que la autorización ya lee
     (cero consultas de más, también en los listados); no suma tablas a la purga; el guard del espejo se
     reduce a «la regla coincide con el catálogo».
   - Contras: un rubro nuevo exige una migración de la regla (como hoy con las verticales).
   - Impacto: cambia la parte de base de DEC-FAC-007; el catálogo sigue en código.
2. **Tablas de relación con control diferido en base.**
   - Qué hace: tabla espejo con id sintético, una tabla de relación por vertical y un trigger que exige ≥1
     al cerrar la transacción.
   - Pros: patrón conocido (como servicios y características).
   - Contras: más piezas (tabla espejo, trigger, tres tablas en la purga); una consulta extra por ficha y
     carga en lote en los listados.
   - Impacto: como lo escrito, con dos agregados.
3. **Tablas de relación sin garantía en base** (lo escrito).
   - Contras: cargas masivas del admin, seeds o scripts pueden dejar fichas sin rubros en silencio.

**Recomendada: 1.** Más simple, más barata en cada lectura y garantiza la regla donde no se puede saltear.

Destraba: F-V1-027, 004, 017 (concurrencia), 018 (lectores), 034.

**Respuesta del owner (2026-10-25):** **delegada** («lo que sea mejor a largo plazo, pensando en otras verticales, más rubros y restricciones como máximo 2 rubros o "el rubro A excluye al B"»). Decide el orquestador, **opción 1 reforzada**: columna `business_lines text[] NOT NULL` en cada tabla de ficha, CHECK de base generado desde el catálogo, índice GIN, sin tabla espejo; las restricciones viven como **declaraciones** en el catálogo y las aplica **un** validador genérico. Ver DEC-FAC-026.

## Q-07 · Alcance de alojamiento y experiencia

**Contexto.** El pedido 3 del PDR es que el mecanismo sirva después para alojamiento (casa, hotel,
complejo). Pero hoy alojamiento decide qué mostrar **por campo** (video, descripción enriquecida,
insignia), no por sección, y tiene su propio editor; y experiencia oculta a propósito el «cómo llegar»
pago hasta tener reemplazo (HOS-1049). Pasar todo eso al resolvedor en esta spec cambiaría lo que ve el
público en verticales que nadie pidió tocar.

1. **Entran completos.**
   - Qué hace: cada sección actual es una capacidad, su editor se deriva del catálogo y lo público pasa al
     resolvedor.
   - Pros: mecanismo probado en tres verticales; nada que migrar después.
   - Contras: cambios visibles en fichas de alojamiento y experiencia, smoke de esas verticales, mucha más
     superficie en el editor; hay que decidir aparte si «traducciones» de alojamiento pasa de oculta a
     bloqueada con upsell.
   - Impacto: sub-specs 3 y 5 bastante más grandes.
2. **Entran al catálogo y al resolvedor, sin cambios visibles.**
   - Qué hace: sus capacidades se enumeran (no «todas») y el resolvedor corre y se prueba en las tres
     verticales; pero lo público de alojamiento (por campo) y el ocultamiento de indicaciones de
     experiencia se quedan como están, y el editor de alojamiento se migra en un hijo aparte con un guard
     que congela su lista manual de secciones.
   - Pros: genericidad probada donde importa; cero cambios visibles (lo que promete DEC-FAC-004).
   - Contras: la migración del editor de alojamiento queda para después.
   - Impacto: un hijo nuevo (8) en Linear.
3. **Fuera de esta spec.**
   - Contras: contradice DEC-FAC-004 y el pedido 3; el día del segundo caso hay que reescribir.

En 1 y 2, el «cómo llegar» de experiencia sigue oculto hasta que HOS-1049 tenga su reemplazo; no se
publica por efecto colateral.

**Recomendada: 2.** Prueba que el mecanismo es genérico sin cambiar lo que ve el público ni sumar smoke de
dos verticales.

Destraba: F-V1-014, 036.

**Respuesta del owner (2026-10-25):** **opción 2.** Alojamiento y experiencia entran al catálogo y al resolvedor con el rubro `standard`, sin cambios visibles; el editor de alojamiento conserva su lista manual congelada por un guard; su migración va a un hijo aparte (8, pendiente de crear en Linear). Ver DEC-FAC-033.

## Q-08 · Qué rubros admite cada tipo

**Contexto.** Los rubros son gratis e ilimitados y cada rubro tiene su página pública. Con la regla
actual («el tipo pertenece a alguno de los rubros elegidos») una heladería puede marcarse también «noche»
y aparecer en la página de boliches, justo lo que DEC-FAC-010 quería evitar. Tildar todo no cuesta nada y
nadie modera rubros.

1. **Cada tipo declara qué rubros admite.**
   - Qué hace: por ejemplo BOLICHE `{noche}` o `{noche, gastronomia}`, HELADERIA sólo `{gastronomia}`, BAR
     cualquiera de los dos o ambos. El servidor rechaza lo demás.
   - Pros: simple, sin moderación; páginas de rubro limpias; los filtros por tipo de cada página salen solos.
   - Contras: un caso real raro queda afuera hasta sumar la combinación al catálogo (un cambio de código).
   - Impacto: reemplaza la regla de validación de DEC-FAC-010.
2. **Separar «habilita secciones» de «aparece en la página del rubro».**
   - Qué hace: las secciones salen de todos los rubros elegidos; la página de un rubro sólo muestra fichas
     cuyo tipo es compatible.
   - Pros: un boliche que publica su carta de tragos no ensucia la página de gastronomía.
   - Contras: un concepto más que explicar y mantener.
   - Impacto: lógica de colecciones más compleja.
3. **Los cambios de rubro en fichas publicadas pasan por moderación.**
   - Contras: carga operativa; contradice «la moderación no cambia».

Además, en las tres: cuando soporte o un admin cambia los rubros de una ficha ajena, **se avisa al dueño**
(además del registro en la línea de tiempo, ya aplicado), y un rubro mal elegido se corrige con un pedido
de corrección al dueño (REQUEST_FIX), no editando a mano.

**Recomendada: 1 + aviso al dueño.** Es la única que frena la manipulación sin sumar moderación.

Destraba: F-V1-020, 041 (filtros por tipo de cada página).

**Respuesta del owner (2026-10-25):** **opción 1 + aviso al dueño + REQUEST_FIX.** Cada tipo declara qué rubros admite. El owner confirmó que RESTAURANT puede llevar `nightlife`. Matriz en el sub-spec 2 (RESTAURANT `{food, nightlife}`; CAFE, PARRILLA, HELADERIA, PANADERIA, ROTISERIA, FOOD_TRUCK `{food}`; BAR, CERVECERIA, PUB `{food, nightlife}`; BOLICHE `{nightlife}`). Cualquier subconjunto no vacío del conjunto permitido es válido. Cuando un tercero cambia los rubros de una ficha ajena se avisa al dueño, y un rubro mal elegido se corrige con REQUEST_FIX. Reemplaza la regla de validación de DEC-FAC-010. Ver DEC-FAC-034.

## Q-09 · Planes y reseñas de noche

**Contexto.** Los planes son los mismos para todos los rubros (DEC-FAC-002), pero lo que distingue pro y
premium es casi todo de la carta (carta, menú del día, fotos de platos, carta en idiomas, QR de mesa). Un
boliche que paga premium compra cosas que no puede usar, y la página de precios le habla de carta. Además
las reseñas puntúan comida, servicio, ambiente y precio: un boliche recibe «Comida: 2/5» y le baja el
promedio.

1. **Comparativa honesta y reseñas flexibles, sin tocar precios.**
   - Qué hace: las filas de la tabla de planes salen del catálogo y las de un rubro se marcan «sólo para
     locales con carta»; el upsell nombra lo que desbloquea; cada dimensión de reseña pasa a opcional y se
     muestra sólo si tiene votos (el promedio sale de las votadas).
   - Pros: barato, honesto, sirve para rubros futuros.
   - Contras: premium sigue aportando poco a un local sólo de noche.
   - Impacto: sub-spec 6 y reseñas.
2. **Lo de la 1 más un diferencial de noche antes de lanzar.**
   - Qué hace: además se diseña algo de pro/premium que sirva a la noche (por ejemplo destacar eventos o
     métricas de la ficha).
   - Pros: el plan caro tiene sentido para todos.
   - Contras: trabajo de producto y de billing antes del lanzamiento.
   - Impacto: retrasa el lanzamiento.
3. **Aceptarlo y documentarlo.**
   - Contras: riesgo de bajas y reembolsos de dueños de boliche.

**Recomendada: 1 ahora, y el diferencial de la 2 como follow-up de producto.** Corrige lo engañoso sin
bloquear el lanzamiento.

Destraba: F-V1-021.

**Respuesta del owner (2026-10-25):** **opción 1 ahora.** La comparativa de planes se genera desde el catálogo con las filas marcadas por rubro, el upsell nombra lo que desbloquea y las dimensiones de reseña pasan a opcionales (promedio sobre las votadas). La **opción 2** (diferencial de noche para pro/premium) es post-MVP y está en Linear **HOS-1796**. Ver DEC-FAC-035.

## Q-10 · Datos de la noche

**Contexto.** La sección «noche» quedó en borrador: entrada (gratis, paga, varía), precio, edad mínima y
dress code. En la realidad la entrada cambia por noche y por hora, el precio en pesos envejece en semanas,
un «+16» puede leerse como que se sirve alcohol a esa edad (prohibido a menores de 18, Ley 24.788), y un
dress code en texto libre obliga al dueño a traducirlo a mano a tres idiomas. Además el tipo nuevo `PUB` se
pisa con `BAR`, que hoy ya significa «bar o pub».

1. **Paquete completo, sin `PUB`.**
   - Qué hace: entrada gratis/paga/varía más una nota corta («gratis hasta la 1»); precio «desde» con fecha,
     mostrado como «aprox., actualizado <mes>»; edad mínima opcional (vacío = no informado), 18 sugerido para
     boliche, mostrada como insignia «+18» con un texto legal fijo y traducido; dress code como lista
     (casual, smart casual, elegante, sin restricciones) más nota opcional; se usa el horario único de la
     ficha y la limitación queda escrita; en un resto-bar los datos van bajo un título «De noche» para no
     espantar al cliente del mediodía. `PUB` no se agrega; BOLICHE en portugués es «balada».
   - Pros: datos útiles que no envejecen mal; el dress code se traduce solo; sin tipos duplicados.
   - Contras: no modela noches distintas con horarios propios.
   - Impacto: sub-spec 4.
2. **Igual que la 1, con `PUB` como tipo propio.**
   - Pros: los pubs se pueden filtrar aparte.
   - Contras: en inglés «Pub» y «Bar» se pisan; el dueño no sabe cuál elegir.
   - Impacto: un valor más de enum y sus etiquetas.
3. **Como está el borrador.**
   - Contras: «varía» sin texto queda vacío; precio desactualizado; dress code a traducir a mano.

**Recomendada: 1.**

Destraba: F-V1-038.

**Respuesta del owner (2026-10-25):** **opción 1, pero se agrega `PUB`.** Entrada gratis/paga/varía + nota corta; precio «desde» con fecha («aprox., actualizado <mes>»); edad mínima opcional (18 sugerido para BOLICHE), insignia «+18» con texto legal fijo y traducido (Ley 24.788); dress code como lista (casual, smart casual, elegante, sin restricciones) + nota opcional; horario único de la ficha con la limitación escrita; título «De noche» en fichas híbridas; BOLICHE en portugués = «balada». Después respondió OD-15: **`BAR` y `PUB` coexisten** con etiquetas y descripciones distintas (DEC-FAC-038). Ver DEC-FAC-036.

---

## Decidido sin preguntar (objetable)

Tenían una opción claramente mejor y no piden criterio de producto. Están en `../01-decision-log.md` y ya
aplicadas en los sub-specs. Si alguna no te cierra, decilo y se reabre.

| id | qué | por qué alcanza sin preguntar |
|---|---|---|
| DEC-FAC-018 | Cuando el dueño escribe en una sección que no aplica a sus rubros: 409 con `reason: CAPABILITY_ABSENT` (no 404) | lo impone la regla 3 del contrato de errores, y el contrato ya tiene ese código para conflictos de estado |
| DEC-FAC-019 | «No aplica» se evalúa justo después de identificar la ficha; «no pagó» se suma a la verificación de plan que ya existe | la otra posición cambiaba la respuesta de rutas que hoy andan |
| DEC-FAC-020 | Las claves que viven dentro de una sección (fotos de plato, carta en idiomas, QR) son «rasgos» de esa sección | sin esto quedan sueltas, fuera de los guards |
| DEC-FAC-021 | En un mismo guardado que agrega un rubro y carga su sección, vale el estado resultante | si no, el alta de un boliche en un paso fallaba |
| DEC-FAC-022 | La etiqueta del rubro sale de las traducciones; el slug sólo es la URL | regla del repo: todo texto visible pasa por i18n |
| DEC-FAC-023 | `/carta/` de un local sin carta disponible redirige a la ficha | los QR impresos siguen llegando |
| DEC-FAC-024 | Se retira la regla de «addon dependiente» | no hay ningún caso hoy (YAGNI) |
| DEC-FAC-025 | Sección bloqueada por plan: el dueño ve sus datos en sólo lectura y puede borrarlos | **roza producto**: es la que más conviene que mires |

---

**Respuesta del owner (2026-10-25):** sin objeciones a DEC-FAC-018…025: quedan **aceptadas** (DEC-FAC-037), con la razón de 018 renombrada a `SECTION_ABSENT` (Q-04).

---

## Bugs previos encontrados fuera de esta spec

Existen hoy, independientemente del renombrado. Archivados en Linear el 2026-10-25 (columna «Linear»).

| # | bug | evidencia | etiquetas sugeridas | Linear |
|---|---|---|---|---|
| 1 | El `getById` público de gastronomía devuelve `menuFileUrl` y `menuFileKind` sin el gate de plan: sólo `getBySlug` los anula. Expone la carta en PDF o foto de un dueño sin plan | `apps/api/src/routes/gastronomy/public/getById.ts:34-44`; `packages/schemas/src/entities/gastronomy/gastronomy.access.schema.ts:58-70` | `area-api`, `area-billing` | HOS-1792 (post-MVP) |
| 2 | La canónica de paginación del listado de gastronomía apunta a `/gastronomia/page/N/`, una ruta que no existe (el listado lee `?page=`) | `apps/web/src/pages/[lang]/gastronomia/index.astro:68,316-317` | `area-web` | decidido (OD-16): mecanismo de paginación compartido, **HOS-1797**, bloquea el sub-spec 6 (DEC-FAC-039) |
| 3 | Un cambio de plan que no cambia el estado de publicación no revalida la cache pública: la carta paga sigue visible hasta que vence la cache | `packages/verticals/src/publication/coverage-recalculation.ts:249-255`; `apps/api/src/utils/listing-publication/coverage-listener.ts:21-46` | `area-api`, `area-billing` | HOS-1793 (post-MVP) |
| 4 | `extras/032` saltea con un NOTICE (exit 0) si la tabla de media no existe: en una base nueva mal ordenada el invariante «una sola foto destacada» no existe y nadie se entera | `packages/db/src/migrations/extras/032-gastronomy-experience-media.constraints.sql:38-52` | `area-db` | HOS-1794 (post-MVP) |
| 5 | El `CLAUDE.md` raíz describe `entity_subscriptions` como tabla viva (cache de estado de suscripción); se borró en la 0125 | `packages/db/src/migrations/0125_robust_cassandra_nova.sql:68` | `area-devops` (docs; candidato a `[NOSPEC:…]`) | HOS-1795 (se corrige ahora) |

Además, el JSON-LD marca hoy a todo BAR y CERVECERIA como `Restaurant`
(`apps/web/src/components/seo/RestaurantJsonLd.astro:46`). Lo arregla el sub-spec 6; sólo merece issue
aparte si se quiere antes.
