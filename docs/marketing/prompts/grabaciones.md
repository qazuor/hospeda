# Grabaciones de pantalla

Todo el material de pantalla de los 37 videos sale del **mismo teléfono** y se hace de
una sola vez. Este documento fija cómo se graba, qué proporciones tiene que tener y qué
hay que capturar exactamente.

---

## El teléfono

| Fuente | Píxeles | Ratio a/h |
|---|:-:|:-:|
| **Grabación de pantalla** | 1080 × 2340 | **0,4615** |
| Screenshot | 816 × 1600 | 0,5100 |
| Video final | 1080 × 1920 | 0,5625 |

**El ratio de referencia es 0,4615** — 19.5:9. Es el de la grabación, que incluye la
pantalla completa con la barra de estado y la de navegación. El screenshot las recorta,
y por eso da distinto: la captura escalada a 1080 de ancho da 2118 de alto, y
2340 − 2118 = 222 px, exactamente lo que ocupan las dos barras.

### Se graba siempre, nunca se captura

Aunque la pantalla esté quieta. Un video de dos segundos sin movimiento equivale a una
captura **y calza en el marco del teléfono de los fondos**; un screenshot no, porque le
faltan las barras y queda en 0,51. Mezclar las dos fuentes garantiza que tarde o
temprano algo no encaje.

### A pantalla completa sobran 420 px

El video es 0,5625 y la grabación 0,4615: la grabación es **más angosta que el cuadro**.
Llevada a ancho completo mide 2340 de alto contra los 1920 del video.

Se recortan en este orden:

1. **La barra de estado** — además muestra la hora real y el nivel de batería, que en una
   pauta se ve descuidado.
2. **La barra de navegación** — los tres botones de Android no aportan nada.
3. Las dos suman ~222 px. Los **198 restantes** salen del contenido, repartidos según lo
   que convenga mostrar.

### Dentro del teléfono de un fondo

El teléfono de los fondos de patrón B mide **311 × 520 px** equivalentes en 1080 × 1920.
Eso es el 29% del ancho de una pantalla: **solo se leen títulos y botones**. Adentro va
un **recorte ampliado**, nunca la pantalla completa en miniatura.

> Regla práctica: si en la grabación original el elemento no es un título o un botón,
> dentro del teléfono no se va a leer.

---

## Qué grabar

25 grabaciones cubren los 37 videos. Están agrupadas por pantalla y no por video, porque
casi todas se reutilizan.

**Tipos**: `quieta` 2-3 s · `scroll` 10-15 s lento y parejo · `acción` el flujo entero
más margen, de una sola toma.

### Sin login — público

| # | Grabar | Tipo | Videos |
|:-:|---|:-:|---|
| P1 | Home | scroll | V2 V3 V4 |
| P2 | Listado de alojamientos | scroll | V2 V8 V30 |
| P3 | Buscador con filtros aplicados | acción | V30 |
| P4 | Buscador en lenguaje natural | acción | V30 |
| P5 | **Ficha de alojamiento completa**, sección por sección | scroll | V7 V8 V9 V10 |
| P6 | Botón de contacto → WhatsApp abriéndose | acción | V9 V18 |
| P7 | Página de destino | scroll | V2 V8 V29 V33 |
| P8 | Gastronomía: listado y ficha | scroll | V2 V26 V29 |
| P9 | Experiencias: listado y ficha | scroll | V2 V27 V29 |
| P10 | Agenda de eventos | scroll | V2 V29 V34 |
| P11 | Puntos de interés | scroll | V2 V29 |
| P12 | Favoritos: marcar varios y verlos juntos | acción | V31 |
| P13 | Comparador: agregar 3 y la tabla | acción | V32 |

### Con login de anfitrión

**No usar la cuenta de super admin**: tiene datos internos y otra interfaz.

| # | Grabar | Tipo | Videos |
|:-:|---|:-:|---|
| A1 | Alta completa: registro → publicado, sin cortes | acción | V11 |
| A2 | Carga de ficha: fotos, ubicación, servicios, precios, contacto | acción | V10 V11 |
| A3 | Calendario: conectar y ver las fechas bloquearse | acción | V16 |
| A4 | IA: descripción pobre → mejorada → traducida | acción | V17 |
| A5 | Opiniones de Google: conectar, aparecen las estrellas | acción | V19 |
| A6 | Panel de estadísticas con los números | scroll | V20 |
| A7 | Checkout con Mercado Pago | acción | V12 V21 |
| A8 | Planes, **sin que se lean los importes** | quieta | V13 |
| A9 | Directorio de oficios | scroll | V28 |

### Fuera de la plataforma

| # | Grabar | Tipo | Videos |
|:-:|---|:-:|---|
| E1 | Búsqueda en Google que devuelve la ficha | acción | V22 |
| E2 | Consulta a una IA que menciona un alojamiento | acción | V22 |
| E3 | Interfaces de Airbnb / Booking / Instagram | scroll | V23 |

---

## Cómo grabar

**P5 primero.** La usan cuatro videos y de ella sale el recorte que va dentro del
teléfono de los fondos. La ficha tiene que estar **bien cargada y ser de un alojamiento
lindo**: si está a medio llenar, el video juega en contra.

**Grabar de más y acelerar en edición.** Sobra material barato; volver a grabar cuesta.

**Las de acción, de una sola toma.** Si se corta y se retoma, se nota — y en V11 arruina
el argumento, porque el valor del video es que se vea el recorrido entero sin pasos
escondidos.

**Movimientos lentos y parejos.** Un scroll rápido es ilegible dentro de un teléfono de
311 px de ancho.

**Sin datos personales en pantalla.** Ni notificaciones, ni nombres reales de terceros,
ni la barra de estado con la hora y la batería.

**Sin precios visibles en A8.** Un importe quemado en el video obliga a rehacerlo cuando
cambie la lista. Mostrar la comparación de funciones, no los números.
