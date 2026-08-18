# V8 · Formás parte del destino — montaje

Prompts y montaje de **[V8](../../plan-videos.md#v8--formás-parte-del-destino)**: una
publicación de 40 s armada con **cuatro tiradas de Hailuo y la placa de cierre**.
Patrón **D** (objeto en la mano — el mapa), fondo **5 · palmar**.

Estructura y convenciones: [`../v9/montaje.md`](../v9/montaje.md), el molde de todos los
videos.

---

## El diálogo completo

> Publicar tu alojamiento en Hospeda no es sumarlo a otro listado.
>
> Tu alojamiento pasa a formar parte de todo el contenido turístico del destino:
>
> aparece cuando alguien busca dónde quedarse, cuando explora la ciudad y cuando está
> armando qué hacer durante el viaje.
>
> Y cuando alguien se interesa, te escribe directo.

Es la [voz en off de V8](../../plan-videos.md#v8--formás-parte-del-destino), tal cual,
repartida en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Publicar tu alojamiento en Hospeda no es sumarlo a otro listado. | T1 | 24 | 4,21 s |
| **F2** | Tu alojamiento pasa a formar parte de todo el contenido turístico del destino: | T2 | 29 | 5,09 s |
| **F3** | aparece cuando alguien busca dónde quedarse, cuando explora la ciudad y cuando está armando qué hacer durante el viaje. | T3 | 40 | 7,02 s |
| **F4** | Y cuando alguien se interesa, te escribe directo. | T4 | 17 | 2,98 s |

**Hablado: 19,3 s de 40 (48%).**

Texto en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **No es "otro listado más"** entrando en el frame 1 |
| T2–T4 | subtítulo palabra por palabra |
| T5 (placa) | **Publicá tu alojamiento** / **hospeda.com.ar** |

---

## Por qué es patrón D y no B

El guion original pide mostrar el mismo alojamiento apareciendo "en tres contextos
distintos —en la búsqueda, en la página del destino, entre las recomendaciones—". Eso
suena a pantalla, pero la tabla de puesta en escena de plan-videos.md ya decidió otra
cosa para V8: **"es una idea, no una pantalla: el mapa es el argumento"**. La razón es
de fondo: los tres contextos son abstractos —"cuando alguien busca", "cuando explora",
"cuando está armando el viaje"— y forzarlos a tres capturas de pantalla reales
convertiría un mensaje conceptual en una demo de producto, que es justo lo que V7, V9,
V10 y V11 ya cubren. Acá el argumento se resuelve con el **mapa**, la pose ya aprobada
de `acciones.png` ("con el mapa"): un alojamiento no es un punto aislado, es parte de un
mapa entero.

**Este video no tiene ninguna grabación de pantalla.** Es el único de los cinco de este
lote sin material de `grabaciones.md`.

---

## El fondo y el objeto

`escenas/escena5.png` — el palmar, plano entero de frente.
La imagen de referencia lo muestra sosteniendo un **teléfono**: en las cuatro tiradas de
este video ese teléfono se reemplaza por el **mapa** de `acciones.png`, manteniendo el
resto de la escena —el personaje, el sendero, las palmeras, la luz— igual que en
`escena5.png`. Es una desviación deliberada de la referencia, no un error: el patrón D
pide el objeto en la mano en lugar del celular.

> ⚠️ **El mapa tapa el logo del buzo** en la lámina `acciones.png` — es un defecto de
> esa lámina, no una licencia (nota de la biblia del personaje, sección 9). En las
> cuatro tiradas, el logo —el símbolo y la palabra `hospeda` debajo— tiene que quedar
> visible; si el mapa lo tapa, se toma el logo de `personaje/personaje.png`.

---

## El montaje — 40 segundos, 4 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,5 | 5,5 | Hailuo · `@######ESCENA5#######` | medio (busto) | mapa enrollado y cerrado, aclara con la cabeza | F1 |
| **T2** | 5,5–14,0 | 8,5 | Hailuo · `@######ESCENA5#######` | entero | despliega el mapa completo | F2 |
| **T3** | 14,0–23,5 | 9,5 | Hailuo · `@######ESCENA5#######` | medio/cercano | barre la mano sobre el mapa, señala tres puntos | F3 |
| **T4** | 23,5–31,0 | 7,5 | Hailuo · `@######ESCENA5#######` | primer plano | cierre cálido | F4 |
| **T5** | 31,0–40,0 | 9,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Los cortes caen en múltiplos de 0,5 s**: 5,5 · 14,0 · 23,5 · 31,0 · 40,0.

**Sin ningún beat mudo con el personaje en cuadro**: las cuatro tiradas hablan. Es el
único video de este lote donde el personaje no calla en ningún momento salvo al llegar
a la placa — coherente con ser el más conceptual y el que menos apoyo visual externo
tiene.

### Rule 2 — dos tomas seguidas nunca comparten plano

Como no hay grabación que separe las tiradas, **las cuatro tienen que variar de escala
entre sí, una por una**: T1 medio → T2 entero → T3 medio/cercano → T4 primer plano → T5
placa. Ningún par consecutivo repite tamaño de plano, aunque las cuatro partan de la
misma imagen de referencia (`escena5.png`) — igual que T1 y T2 de V1, la variación de
encuadre se pide en el prompt, no viene de generar una imagen nueva por toma.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 7 s | 5,5 s | la frase son 4,21 s |
| T2 | 10 s | 8,5 s | la frase son 5,09 s más el tiempo de desplegar el mapa entero |
| T3 | 11 s | 9,5 s | la frase son 7,02 s, la más larga de las cuatro |
| T4 | 9 s | 7,5 s | la frase son 2,98 s más un cierre cálido sostenido |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,5 | 5,5 | tirada T1 · 7 s | 0,0 → 5,5 | 1,5 |
| **T2** | 5,5 → 14,0 | 8,5 | tirada T2 · 10 s | 0,0 → 8,5 | 1,5 |
| **T3** | 14,0 → 23,5 | 9,5 | tirada T3 · 11 s | 0,0 → 9,5 | 1,5 |
| **T4** | 23,5 → 31,0 | 7,5 | tirada T4 · 9 s | 0,0 → 7,5 | 1,5 |
| **T5** | 31,0 → 40,0 | 9,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 4,21 | 4,21 | T1 | 1,29 s |
| **F2** | 5,50 → 10,59 | 5,09 | T2 | 3,41 s (sigue el despliegue del mapa en silencio) |
| **F3** | 14,00 → 21,02 | 7,02 | T3 | 2,48 s |
| **F4** | 23,50 → 26,48 | 2,98 | T4 | fin de diálogo: hold de 4,52 s antes de la placa |

> ⚠️ **La pista de voz sale de dos tiradas**, no de una sola (ver [`voz.md`](voz.md)):
> las cuatro frases de V8 no entran en los 15 s de Hailuo, ni siquiera juntando F1+F2 o
> F3+F4 sin recortar.

### Los cuatro cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,5 | T1 → T2 | busto → entero, el mapa pasa de cerrado a desplegándose | bajo |
| 14,0 | T2 → T3 | entero → medio/cercano, para que se lean los puntos señalados | medio |
| 23,5 | T3 → T4 | medio/cercano → primer plano, remate | bajo |
| 31,0 | T4 → T5 | primer plano → placa | bajo |

**T2 → T3.** Es el único corte con algo de riesgo real: T2 termina con el mapa entero
desplegado y T3 tiene que arrancar ya más cerca, con la mano empezando a señalar — si el
encuadre de T3 no está claramente más cerrado que el de T2, el corte se siente un
retroceso en vez de un acercamiento.

### Lo demás

1. **Música desde el frame 1**, instrumental, con un tono más contemplativo que el resto
   del lote — es el video que menos corre y más explica.
2. **Tirar el audio de las cuatro tiradas de imagen** y usar solo la pista de voz.
3. **Subtítulos palabra por palabra** en las cuatro.
4. **Corte seco en los cuatro.**

---

## Qué mirar al revisar las tomas

**Que las cuatro arranquen hablando en el frame 1.**

**Que el logo del buzo quede visible en las cuatro**, a pesar del mapa — es el punto
que más fácil se pasa por alto, porque la lámina de referencia (`acciones.png`) ya trae
ese defecto.

**Que el mapa no tape ni modifique la silueta del personaje** (sección 16 de la biblia):
tiene que leerse como algo que sostiene, no como parte de su cuerpo.

**Que T2 despliegue el mapa una sola vez, de forma clara**, no varias veces ni a los
tirones: es el único movimiento grande del video y tiene que leerse bien a la primera.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las cuatro, y que en
T4 (primer plano) quede completo dentro del cuadro.
