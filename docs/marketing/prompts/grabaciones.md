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

26 grabaciones cubren los 37 videos. Están agrupadas por pantalla y no por video, porque
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
| A10 | **Importar ficha**: pegar el link, esperar, la ficha aparece completa | acción | V1 |

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

---

## Los fijos — la pantalla nunca sale gris

Los fondos traen el teléfono con la pantalla **gris lisa**, pensada como máscara de
posición para componer encima. Pero un celular gris que de golpe se enciende con un
video se lee como un error de edición, y en las tomas donde el teléfono se mueve no hay
nada que componer: no se puede trackear.

Por eso **todo teléfono que entra en cuadro lleva pantalla desde la tirada**. Hailuo la
dibuja a partir de un fijo que se le adjunta como referencia, con el marcador
`@######PANTALLA#######`. Lo probamos en V9 y responde bien.

### El fijo es un frame de la grabación, no un screenshot

Es la misma regla de *"se graba siempre, nunca se captura"*, aplicada al fijo: se
exporta **el primer frame de la grabación** que esa toma va a mostrar, a 1080 × 2340,
**ratio 0,4615**.

Un screenshot da 0,5102 —le faltan la barra de estado y la de navegación— y esa
diferencia del 10% es la que después no deja calzar la grabación dentro del marco que
Hailuo dibujó. Con el teléfono en movimiento no se nota; con el teléfono quieto y una
grabación compuesta encima, es exactamente el desfasaje.

> ⚠️ El `capturas/pantalla.png` que ya existe mide **1080 × 2117**: es un screenshot.
> Hay que reexportarlo como frame de P1 antes de usarlo en una toma con composición.

### Cuando el fijo no sale de una grabación

No todo lo que entra en un teléfono o en un inserto es una grabación de pantalla. **V24**
abre su recuadro con **fotos propias** de un alojamiento y **V25** con un **tratamiento
de texto** armado en edición; ninguno de los dos está en el catálogo de 25 y ninguno
debería estarlo.

La regla no cambia, solo la fuente: **el fijo es el primer frame de lo que ese recuadro
va a mostrar**, sea una grabación, una foto o una placa. Se guarda igual en `capturas/`
y se nombra por el video que lo estrena, sin código de grabación:

```
capturas/v24-foto1.png      la primera foto de la comparación
capturas/v25-texto.png      el primer estado del tratamiento de texto
```

El ratio 0,4615 solo aplica cuando el fijo va **dentro del marco de un teléfono**. En un
inserto rectangular manda la proporción de ese recuadro, que está en el montaje del
video.

### Cómo se nombran

Un fijo por grabación, con **el mismo código de la grabación** de la que sale:

```
capturas/p1.png     primer frame de P1 (home)
capturas/a3.png     primer frame de A3 (calendario)
capturas/e1.png     primer frame de E1 (búsqueda en Google)
```

Cuando una toma necesita **otro momento** de la misma grabación —porque el video ya
mostró el arranque y esta toma entra más adelante— se sufija con qué muestra:

```
capturas/p5-contacto.png    el botón de contacto dentro de la ficha
capturas/a2-fotos.png       el paso de carga de fotos
```

El sufijo describe **qué se ve**, no en qué toma se usa: el mismo fijo lo comparten
varios videos, igual que las grabaciones.

### Qué necesita cada video

Cada carpeta de video tiene su propio [`capturas.md`](.) con la lista exacta: qué fijo
va en cada toma, de qué grabación sale y de qué momento. Es lo que hay que tener en la
mano al sentarse a grabar.
