---
title: Resolución vuelta 2 · Decisiones del owner
linear: HOS-1787
created: 2026-10-25
status: respondida
---

# Resolución vuelta 2 · Preguntas al owner

> **Respondidas por el owner el 2026-10-25** (DEC-FAC-060…069; OD-17…OD-26 cerradas). Dos respuestas van contra la
> recomendada: Q-13 (opción 3) y Q-16 (opción 2). La respuesta está debajo de cada pregunta.

Diez preguntas, todas juntas, ordenadas para que las que condicionan a otras vayan primero. Cada una dice qué
decisión abierta (`OD-NN`, en `../04-open-decisions.md`) cierra y qué hallazgo (`F-V2-NNN`, en
`../12-revision-vuelta-2/00-consolidado.md`) destraba. Las de la vuelta 1 (Q-01…Q-10) ya están respondidas, por eso
la numeración sigue en Q-11.

Lo que tenía una opción claramente mejor ya se decidió y está al final, en «Decidido sin preguntar»
(DEC-FAC-040…059), para que lo puedas objetar.

| Q | título | cierra | hallazgo | depende de |
|---|---|---|---|---|
| Q-11 | Editar también la migración 0139 | OD-17 | F-V2-001 (CRÍTICA) | - |
| Q-12 | Cómo se vuelve atrás | OD-18 | F-V2-020 | Q-11 |
| Q-13 | Dónde vive el enlace gratis a la carta | OD-19 | F-V2-009 | - |
| Q-14 | Qué ve el dueño del contenido de un rubro que sacó | OD-20 | F-V2-042 | Q-13 |
| Q-15 | Aviso al bajar de plan | OD-21 | F-V2-031 | Q-13 |
| Q-16 | Reseñas con dimensiones | OD-22 | F-V2-024 | - |
| Q-17 | Comodidades de noche | OD-23 | F-V2-027 | - |
| Q-18 | Frontera entre `PUB` y `CERVECERIA` | OD-24 | F-V2-028 | - |
| Q-19 | Textos es/en/pt | OD-25 | F-V2-030 | Q-18 |
| Q-20 | Copy del embudo para la noche | OD-26 | F-V2-016 | Q-19 |

---

## Q-11 · Editar también la migración 0139

**Contexto.** En la vuelta 1 decidiste (DEC-FAC-029) que el catálogo nazca ya con `venue`, y para eso se editan
tres migraciones que todavía no corrieron en prod: 0129, 0144 y 0176. Falta una: la **0139** crea dos reglas en la
base (CHECK) que sólo aceptan la lista vieja de verticales, con `'gastronomy'` escrito a mano y sin `'venue'`. La
0176 editada intenta guardar `'venue'` y la 0139 lo rechaza. Resultado: la base no se puede armar desde cero. Eso
rompe el CI, la plantilla de los worktrees, el reset de staging y **prod en el paso 3 del corte**, donde esas
migraciones corren por primera vez.

1. **Editar también la 0139, y la 0132 por coherencia.**
   - Qué hace: las dos reglas de la 0139 pasan a decir `'venue'`. La 0132 (la regla de `fix_request`) no rompe nada,
     pero se edita igual para que no quede ningún literal viejo. Regla general escrita en el sub-spec 1: se edita
     toda migración entre la 0125 y la de renombrado que fije un literal de vertical del que dependa una fila
     insertada por una migración editada.
   - Pros: mismo argumento que ya aceptaste para las otras tres (sólo corrieron en staging y local, y staging se
     resetea). Dos archivos más, ningún riesgo nuevo.
   - Contras: la lista de migraciones editadas pasa de 3 a 5.
   - Impacto: sub-spec 1, DEC-FAC-029 (cambia la lista, no la idea).
2. **Dejar la 0176 con `'gastronomy'` y convertir esa columna en la migración de renombrado.**
   - Qué hace: la 0176 vuelve a su forma original para esa columna y la migración de renombrado la actualiza.
   - Pros: no se toca la 0139.
   - Contras: el guard del catálogo (G18) se pone rojo ante cualquier `UPDATE` de una tabla de carga, y habría que
     enseñarle a aceptar renombres. Es justo lo que DEC-FAC-029 quiso evitar.
   - Impacto: G18, sub-spec 1, y contradice DEC-FAC-029.

**Recomendada: 1.** Es la misma decisión que ya tomaste, aplicada a la migración que faltaba en la lista.

**Respuesta del owner (2026-10-25):** **opción 1.** Se editan también la 0139 y la 0132 (cinco migraciones editadas), con la regla general escrita en el sub-spec 1. → DEC-FAC-060 (amplía la lista de DEC-FAC-029).

---

## Q-12 · Cómo se vuelve atrás

**Contexto.** En la vuelta 1 se pidió (DEC-FAC-030) una «migración inversa ensayada» por si el renombrado sale mal.
Con el catálogo naciendo `venue` (Q-11 y DEC-FAC-029) esa inversa no se puede escribir: volver a `gastronomy` exige
modificar filas del catálogo que la base prohíbe tocar (triggers de `extras/041`), choca con claves foráneas y con
G18. Además Drizzle sólo va hacia adelante: una «inversa» sería una migración más que queda para siempre en la
historia, y en el baseline de prod si se mergea.

1. **Marcha atrás = revert + reset en staging; backup del corte en prod.**
   - Qué hace: en staging se revierte el PR del renombrado y se vuelve a resetear (la misma ventana, al revés). En
     prod, volver atrás es la marcha atrás del corte V6: restaurar el backup completo del paso 2b, que el corte ya
     exige. Se mantiene la lista escrita de lo que no vuelve solo (cache, QR impresos, enlaces externos).
   - Pros: cero código nuevo; no ensucia la historia de migraciones; usa un backup que ya es obligatorio.
   - Contras: no hay un «botón» de vuelta atrás parcial; en prod, volver atrás es volver atrás todo el corte.
   - Impacto: sub-spec 1 (criterio de aceptación), DEC-FAC-030.
2. **Inversa sólo de lo que no es catálogo, ensayada pero nunca mergeada.**
   - Qué hace: se escribe una inversa de tablas, enums y URLs, se prueba sobre un clon, y queda guardada fuera de
     la rama. El catálogo vuelve sólo por reset.
   - Pros: una vuelta atrás parcial existe y está probada.
   - Contras: más trabajo para un camino que igual termina en reset; una migración nunca mergeada se desactualiza
     sola.
   - Impacto: sub-spec 1, una tarea de ensayo más.

**Recomendada: 1.** Con prod sin datos reales de la vertical (DEC-FAC-027), el backup del corte cubre todo lo que
una inversa podría cubrir.

**Respuesta del owner (2026-10-25):** **opción 1.** Revert + reset en staging; en prod, restaurar el backup del paso 2b del corte. Se conserva la lista de lo que no vuelve. → DEC-FAC-061 (reemplaza la «migración inversa ensayada» de DEC-FAC-030).

---

## Q-13 · Dónde vive el enlace gratis a la carta

**Contexto.** Hoy un local puede poner un **enlace externo** a su carta (un PDF, una web) gratis en cualquier plan, a
propósito (`menu-projection.ts:101-103`). La carta armada plato por plato, el archivo y las fotos son pagos. El enlace
se edita hoy en la sección «Precio», que es común a todos. La spec nueva modela la carta como **una** sección con
clave paga: si el enlace entra ahí, todos los locales básicos pierden lo que hoy publican gratis; si se queda en
«Precio», un boliche (que no tiene carta) puede publicar un enlace de carta y los lectores se contradicen.

1. **La carta pierde la clave a nivel sección; el enlace es un rasgo gratis de la carta.**
   - Qué hace: la sección `menu` (del rubro `food`) no lleva clave; sus partes son rasgos: `link` gratis,
     `structured` y `file` con `manage_venue_menu`, más fotos, traducción y QR como hoy. El enlace se mueve de
     «Precio» a la carta. La sección nunca queda `locked` entera; quedan `locked` sus partes pagas. Un boliche no
     tiene enlace de carta. `/carta/` con sólo el enlace manda a la ficha.
   - Pros: nadie pierde nada de lo que hoy tiene gratis; coherente con DEC-FAC-034 («si tiene cocina, elegí BAR»);
     un solo lugar decide qué es la carta.
   - Contras: un boliche con carta de tragos no tiene dónde ponerla.
   - Impacto: sub-specs 2, 3, 5 y 6; el campo `menuUrl` cambia de sección (no de columna).
2. **Sección común propia para el enlace (`menuLink`).**
   - Qué hace: el enlace sale de «Precio» a una sección común nueva, sin clave, que tienen todos los rubros.
   - Pros: un boliche puede publicar su carta de tragos.
   - Contras: `hasMenu` en el JSON-LD de un boliche; la palabra «carta» en un local sin cocina; una sección más.
   - Impacto: sub-specs 2, 3, 5 y 6.
3. **El enlace pasa a ser pago, dentro de la carta.**
   - Qué hace: todo lo de la carta queda bajo `manage_venue_menu`.
   - Pros: el modelo más simple.
   - Contras: todo local básico pierde, sin aviso, el enlace que hoy publica. Es un cambio comercial, no técnico.
   - Impacto: planes y comunicación a dueños.

**Recomendada: 1.** No le saca nada a nadie y mantiene la carta como cosa del rubro `food`.

**Respuesta del owner (2026-10-25):** **opción 3** (no la recomendada). El enlace externo a la carta pasa a ser **pago**, dentro de `menu`, todo bajo `manage_venue_menu`. Motivo del owner: todavía no hay clientes, nadie pierde nada. Sin migración de datos ni comunicación (prod tiene cero fichas). → DEC-FAC-062.

---

## Q-14 · Qué ve el dueño del contenido de un rubro que sacó

**Contexto.** «Cambiar de rubro oculta, no borra» (regla 5). Si un dueño saca el rubro `food`, su carta queda
guardada pero la sección pasa a `absent` (no existe para esa ficha). Hoy la spec no dice si el dueño la puede ver,
borrar o exportar. Por ejemplo: cerró la cocina, quiere borrar la carta vieja con precios y fotos, y no puede sin
volver a agregar el rubro. La exportación del dueño tampoco dice si la incluye.

1. **Mismo trato que `locked`: ver y borrar; la exportación incluye todo.**
   - Qué hace: en el editor, la sección muestra un resumen «guardado y oculto» con la opción de vaciarla (intención
     `delete`, DEC-FAC-041, admitida en `absent` sólo para el dueño). La exportación del dueño incluye todo lo
     guardado.
   - Pros: el dueño controla sus datos; mismo patrón que ya aprobaste para `locked` (DEC-FAC-025).
   - Contras: un poco más de UI en el hub.
   - Impacto: sub-specs 3 (el 4b admite `delete` en `absent` para el dueño) y 5.
2. **Inalcanzable hasta volver a agregar el rubro; la exportación sí lo incluye.**
   - Qué hace: el dueño no ve ni toca la sección; la exportación sí la trae.
   - Pros: nada nuevo en el editor.
   - Contras: para limpiar hay que volver a agregar el rubro, borrar y sacarlo de nuevo.
   - Impacto: sub-spec 3 (fila de la exportación en la lista de lectores).

**Recomendada: 1.** Un dueño que no puede borrar sus propios datos es un reclamo seguro, y el patrón ya existe.

**Respuesta del owner (2026-10-25):** **opción 1.** Igual que `locked` para el dueño: resumen visible, vaciado permitido (intención `delete` admitida en `absent` sólo para el dueño), la exportación incluye todo. → DEC-FAC-063.

---

## Q-15 · Aviso al bajar de plan

**Contexto.** Al **sacar un rubro**, el editor avisa antes qué deja de verse (secciones, ítems, QR y escaneos). Al
**bajar de plan**, que es el caso más común de `locked`, sólo hay aviso después, en el editor. Ejemplo: un dueño Pro
con carta y 40 stickers QR en las mesas baja a Básico desde «Mi suscripción»; nadie le dice que la carta deja de
publicarse y que los 40 QR pasan a abrir la ficha sin carta. Billing no puede leer rubros (G-FAC-07), pero el
resolvedor es una función pura: la web puede simular el plan destino.

1. **Entra al MVP, en el sub-spec 5, para la vertical venue.**
   - Qué hace: en la confirmación de bajada, la web consulta el resolvedor con el conjunto de claves del plan
     destino, ficha por ficha, y lista lo que pasa a `locked`, con conteos y QR activos. Billing sigue sin leer
     rubros.
   - Pros: evita el caso del cliente que se entera por una queja; no viola ninguna regla.
   - Contras: una pantalla más en el flujo de cambio de plan.
   - Impacto: sub-spec 5, flujo de cambio de plan del web.
2. **Post-MVP, con issue propio.**
   - Qué hace: se lanza sin el aviso previo; queda el aviso posterior del editor.
   - Pros: menos alcance ahora.
   - Contras: el escenario de los 40 QR muertos sale a prod.
   - Impacto: un issue nuevo en Linear.

**Recomendada: 1.** Es el caso típico de `locked`, y el costo es una consulta al resolvedor que ya existe.

**Respuesta del owner (2026-10-25):** **opción 1.** Aviso previo a la bajada en el MVP, en el sub-spec 5, simulando el plan destino con el resolvedor puro; billing sigue sin leer rubros. → DEC-FAC-064.

---

## Q-16 · Reseñas con dimensiones

**Contexto.** DEC-FAC-035 dice que las dimensiones de la reseña (comida, servicio, ambiente, precio-calidad) pasan
a opcionales, para que un boliche no reciba «Comida: 2/5». Mirando el código: el formulario **ya** pide sólo la
calificación general; ninguna página muestra las dimensiones; y el recálculo de la ficha **inventa** las cuatro
dimensiones copiando la calificación general. Ese recálculo vive en una base compartida con experiencia, así que
cambiarlo ahí movería los promedios visibles de las experiencias. La cuarta dimensión es `value`, no «precio».

1. **El formulario no pide dimensiones; se arregla lo que hay.**
   - Qué hace: (a) venue deja de copiar la calificación general a cada dimensión; (b) el promedio de la ficha es el
     de la calificación general; (c) no se toca la base compartida con experiencia en esta spec; (d) se usa el
     nombre `value`. No se construye UI de dimensiones.
   - Pros: cero UI nueva; un boliche nunca ve «Comida»; experiencia no cambia.
   - Contras: no hay desglose por dimensión.
   - Impacto: sub-spec 6 (ya escrito con estas cuatro letras como recomendación).
2. **Dimensiones opcionales en el formulario, «comida» sólo si la carta no está `absent`.**
   - Qué hace: el formulario ofrece dimensiones; la de comida aparece según el resolvedor.
   - Pros: desglose real.
   - Contras: la reseña pregunta por una sección (vía resolvedor); abre moderación de dimensiones en el admin; UI
     nueva en web y admin.
   - Impacto: sub-specs 3, 6 y 7.

**Recomendada: 1.** Resuelve el problema real (el boliche con «Comida») sin construir nada.

**Respuesta del owner (2026-10-25):** **opción 2** (no la recomendada). Dimensiones opcionales en el formulario, diseñadas **genéricamente** (regla dura: sin código por rubro ni por vertical): declaradas en el catálogo, cada una ligable a una sección; se ofrece si su sección no es `absent`; promedio por dimensión sobre sus propios votos; general independiente; moderación con dimensiones; sin cambiar los promedios visibles de experiencia. → DEC-FAC-065 (reemplaza la parte de reseñas de DEC-FAC-035).

---

## Q-17 · Comodidades de noche

**Contexto.** Las comodidades y características de la vertical son casi todas de cocina (menú infantil, opciones
veganas, cocina peruana, delivery). No hay nada de noche (pista, DJ, VIP, guardarropa). Su aplicabilidad es por
vertical, no por rubro. El dueño del boliche ve 30 casillas de cocina, y el turista que filtra en la colección de
noche ve «Menú infantil».

1. **Sumar ítems de noche al catálogo y mostrar sólo filtros con fichas.**
   - Qué hace: se agregan ítems de noche (con dual-write del seed). En las colecciones, cada filtro aparece sólo si
     hay al menos una ficha de esa colección que lo tiene (mismo criterio que los chips de tipo).
   - Pros: sin concepto nuevo; el turista no ve filtros vacíos.
   - Contras: el editor del boliche sigue viendo las casillas de cocina.
   - Impacto: seed (dual-write), sub-spec 6.
2. **Columna `applicable_business_lines` en comodidades y características.**
   - Qué hace: cada ítem dice a qué rubros aplica.
   - Pros: editor y filtros limpios.
   - Contras: un segundo catálogo que lee rubros fuera del resolvedor (entra a la lista de G-FAC-03(b)); migración
     y seed.
   - Impacto: sub-specs 2, 5 y 6, guards.
3. **Post-MVP.**
   - Qué hace: se lanza la noche con el catálogo de cocina.
   - Pros: nada ahora.
   - Contras: la primera impresión del boliche es «esto no es para mí».
   - Impacto: un issue nuevo.

**Recomendada: 1.** Arregla lo que ve el turista sin sumar un catálogo paralelo.

**Respuesta del owner (2026-10-25):** **opción 1.** Ítems de noche al catálogo (dual-write) y filtros sólo con ≥1 ficha en la colección. Lista inicial propuesta por el agente. → DEC-FAC-066.

---

## Q-18 · Frontera entre `PUB` y `CERVECERIA`

**Contexto.** DEC-FAC-038 separó BAR de PUB con descripciones propias, pero `PUB` («orientado a cerveza») se pisa
con `CERVECERIA` («cervecería artesanal o casa de cerveza»). El dueño de una cervecería con barra elige al azar, y el
turista que filtra por PUB no ve las cervecerías. Lo técnico ya se aplicó: las descripciones se muestran debajo del
selector de tipo (`venue.typeDescriptions.*`).

1. **CERVECERIA = produce su cerveza; PUB = formato de bar.**
   - Qué hace: BAR «barra y tragos, coctelería»; PUB «barra de cerveza tirada, ambiente de pub»; CERVECERIA
     «produce su propia cerveza (artesanal)».
   - Pros: criterio verificable por cualquiera; no cambia el enum.
   - Contras: una cervecería que sólo revende queda como PUB.
   - Impacto: textos del sub-spec 2 (descripciones) y Q-19.
2. **Fusionar PUB en CERVECERIA para la noche.**
   - Qué hace: se retira `PUB` como tipo nuevo.
   - Pros: un tipo menos.
   - Contras: reabre DEC-FAC-038; un pub irlandés queda como «cervecería».
   - Impacto: sub-spec 2, DEC-FAC-038.

**Recomendada: 1.** Separa por un hecho, no por una sensación.

**Respuesta del owner (2026-10-25):** **opción 1.** CERVECERIA = produce su cerveza; PUB = bar de cerveza tirada con ambiente de pub; BAR = tragos y coctelería. → DEC-FAC-067.

---

## Q-19 · Textos es/en/pt

**Contexto.** Faltan los textos de la vertical, los rubros, las colecciones y el dress code en los tres idiomas. Sin
ellos, el implementador inventa (en inglés podría salir «Eat and leave»). Además, la home tiene una tile
«Gastronomía» que lleva a **eventos**: con el rubro también llamado «Gastronomía», la misma palabra significaría dos
cosas en la misma pantalla.

| clave | es | en | pt |
|---|---|---|---|
| vertical | Comer y salir | Food & nightlife | Comer e sair |
| rubro `food` | Gastronomía | Food & drink | Gastronomia |
| rubro `nightlife` | Noche | Nightlife | Vida noturna (no «balada»: es el tipo BOLICHE) |
| tipo BOLICHE | Boliche | Nightclub | Balada |
| tipo BAR / PUB | Bar / Pub | Bar / Pub | Bar / Pub |
| título «De noche» | De noche | At night | À noite |
| dress code | Informal (sin ojotas ni musculosa) · Sport elegante · Elegante · Sin restricciones | Casual · Smart casual · Formal · No dress code | Casual · Esporte fino · Social · Sem restrições |
| texto legal +18 | Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788). | Sale of alcoholic beverages to persons under 18 is prohibited (Argentine Law 24.788). | Proibida a venda de bebidas alcoólicas a menores de 18 anos (Lei argentina 24.788). |
| title colección noche | Boliches, bares y pubs en {{destino}} · Hospeda | Nightclubs, bars and pubs in {{destino}} · Hospeda | Baladas, bares e pubs em {{destino}} · Hospeda |
| title colección gastronomía | Dónde comer en {{destino}} · Hospeda | Where to eat in {{destino}} · Hospeda | Onde comer em {{destino}} · Hospeda |

1. **La tabla de arriba, y la tile de la home pasa a «Eventos gastronómicos».**
   - Qué hace: se fijan estos textos en el sub-spec 6 y la tile cambia de nombre (sigue llevando a eventos).
   - Pros: el rubro se llama como lo busca la gente; desaparece el choque en la home.
   - Contras: «Gastronomía» sigue existiendo como tema (eventos, posts) en otras pantallas.
   - Impacto: sub-spec 6, i18n, la lista de exenciones de G-FAC-R1 (la tile sale de la lista).
2. **«Para comer» / «Para salir» como etiquetas de rubro.**
   - Qué hace: igual que la 1, pero los rubros se llaman «Para comer» y «Para salir».
   - Pros: ningún choque con el tema «Gastronomía»; se lee bien junto a «Comer y salir».
   - Contras: menos buscable; los slugs (`gastronomia`, `noche`) ya no coinciden con la etiqueta.
   - Impacto: sub-spec 6, i18n.

Si alguna celda de la tabla no te convence, se cambia sola sin afectar el resto.

**Recomendada: 1.** Son las palabras con las que la gente busca, y la tile renombrada resuelve el choque.

**Respuesta del owner (2026-10-25):** **opción 1.** La tabla y el texto legal +18, aprobados como están; la tile de la home pasa a «Eventos gastronómicos» (en/pt equivalentes), sigue llevando a eventos y sale de la exención de G-FAC-R1. → DEC-FAC-068.

---

## Q-20 · Copy del embudo para la noche

**Contexto.** El renombrado cambia URLs y nombres, pero todo el embudo que trae a un dueño sigue hablándole a un
restaurante: la presentación, la venta, los precios, la página de publicar, el footer, el ícono (cubiertos) y los
correos de la serie de prueba («cargá tu menú con tus platos»). El dueño de un boliche entiende que la plataforma no
es para él. Los correos van por usuario y vertical, no por ficha, así que no pueden variar según el rubro.

1. **Copy neutro de vertical en todo el embudo, en este programa, antes de lanzar la noche.**
   - Qué hace: tarea de contenido con inventario cerrado (presentación, venta, precios, publicar, footer, puertas de
     descubrimiento, correos de prueba y bienvenida, What's New de lanzamiento, ícono). El copy de la vertical
     nombra las dos cosas («tu local», «para comer o para salir»); lo que sólo vale para cocina vive dentro de las
     secciones, que ya se ocultan por rubro.
   - Pros: coherente con la razón del cambio; los correos respetan la regla 1 (nadie pregunta por un rubro).
   - Contras: tarea de contenido es/en/pt nada chica.
   - Impacto: sub-spec 6 (o un hijo de contenido), notificaciones, i18n.
2. **Renombrar ahora y reescribir el copy en un issue aparte, después del MVP.**
   - Qué hace: se lanza con el copy de restaurante.
   - Pros: menos alcance ahora.
   - Contras: se lanza la noche con un embudo que la espanta. Choca con «cero parches intermedios de UX».
   - Impacto: un issue nuevo.
3. **Correos con copy por rubro.**
   - Qué hace: cada correo elige el texto según los rubros del dueño.
   - Pros: copy más específico.
   - Contras: los correos no tienen ficha; obliga a leer rubros fuera del resolvedor y viola la regla 1 (G-FAC-03).
   - Impacto: notificaciones, guards.

**Recomendada: 1.** Lanzar la noche con un embudo que habla de platos es un parche de UX, y la opción 3 rompe la
regla central del mecanismo.

**Respuesta del owner (2026-10-25):** **opción 1.** Copy neutro en todo el embudo, en este programa, antes de lanzar la noche, con el inventario cerrado. Vive en un hijo nuevo, `sub-specs/9-copy-del-embudo.md` (decisión del agente). → DEC-FAC-069.

---

## Decidido sin preguntar (objetable)

Todo está en `../01-decision-log.md`, con su porqué y lo descartado.

| DEC | qué decide |
|---|---|
| DEC-FAC-040 | cada sección declara sus `fields`; `sectionsTouchedByBody` y las claves del payload del editor salen del catálogo; un campo pertenece a una sola sección |
| DEC-FAC-041 | las rutas de contenido declaran intención `read` / `write` / `delete` |
| DEC-FAC-042 | `/carta/` sin carta disponible → 302 `no-store` a la ficha (no 301) |
| DEC-FAC-043 | G-FAC-03(a) por operando tipado `BusinessLine`, no por texto |
| DEC-FAC-044 | G-FAC-R1 rediseñado: qué queda fuera del escaneo, gastronomía-tema como lista cerrada (la dimensión de destino no se renombra), regla nueva sobre valores i18n |
| DEC-FAC-045 | ninguna migración versionada usa `PUB`/`BOLICHE` como valor del enum; los tipos nacen en el sub-spec 2 |
| DEC-FAC-046 | default `ARRAY['standard']` en alojamiento y experiencia; `venues` sin default |
| DEC-FAC-047 | la matriz tipo → rubros entra al CHECK de `venues`; `resolveBusinessLineOptions`; sin rubros repetidos |
| DEC-FAC-048 | el 4b: 409 `SECTION_ABSENT` sólo al dueño, 404 a un tercero; corre también en el alta; firma fijada |
| DEC-FAC-049 | experiencia migra su gate al resolvedor; alojamiento declara claves con una lista exenta contada que vacía el hijo 8 |
| DEC-FAC-050 | «De noche» por `headingWhenMultiLineKey` + `multiLine`; la edad sugerida de BOLICHE por `fieldDefaults` |
| DEC-FAC-051 | rasgos de una sección `locked` = `locked`; QR de mesa con `menu_qr_scan_metrics` (premium, como hoy); `menuQr` cambia su operación |
| DEC-FAC-052 | «abierto ahora»: un turno pertenece al día en que empieza; badge calculado en el cliente |
| DEC-FAC-053 | reglas duras de edad y alcohol en el chat de IA de la vertical |
| DEC-FAC-054 | ids de What's New y del tour renombrados con migración de ids vistos encadenada a la 0109 (nadie vuelve a verlos) |
| DEC-FAC-055 | lecturas protegidas de carta, menú del día y eventos pasan a la cadena; el acceso del personal se preserva |
| DEC-FAC-056 | aviso in-app de cambio de rubros: 30 días, colapsa, desaparece al editar |
| DEC-FAC-057 | el admin no edita `nightInfo`; REQUEST_FIX como política |
| DEC-FAC-058 | forma final de `nightInfo` (notas i18n, CHECKs de precio, edad 13–30, fecha del precio sólo si cambia) |
| DEC-FAC-059 | vocabulario: «sección» es la palabra del catálogo; la propiedad `listingSection` se mantiene |
