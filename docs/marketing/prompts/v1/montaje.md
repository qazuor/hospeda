# V1 · Pegá el link y la ficha se carga sola — montaje

Prompts y montaje de **[V1](../../plan-videos.md#v1--pegá-el-link-y-la-ficha-se-carga-sola)**:
una historia de 22 s armada con **tres tiradas de Hailuo y grabación de pantalla**.
Patrón **A** (el portal), fondo **1 · cabaña del Litoral**.

Estructura y convenciones: [`../v9/montaje.md`](../v9/montaje.md), el molde de todos los
videos.

---

## El diálogo completo

**Esto es lo que se escucha de punta a punta**, en orden y sin cortes:

> ¿Ya tenés tu alojamiento publicado en otro lado? No lo cargues de nuevo.
>
> Pegás el link, esperás dos segundos, y tu ficha se completa sola.
>
> Publicá tu alojamiento en hospeda.com.ar.

Es la [voz en off ya escrita para V1](../../plan-videos.md#v1--pegá-el-link-y-la-ficha-se-carga-sola)
—se usa tal cual, no se reescribe—, repartida en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | ¿Ya tenés tu alojamiento publicado en otro lado? | T1 | 18 | 3,16 s |
| **F2** | No lo cargues de nuevo. | T1 | 7 | 1,23 s |
| — | *(beat visual, sin voz: el celular viaja a primer plano)* | T2 | — | — |
| **F3** | Pegás el link, esperás dos segundos, y tu ficha se completa sola. | T3 | 21 | 3,68 s |
| — | *(silencio, sigue el scroll de la ficha)* | T3 | — | — |
| **F4** | Publicá tu alojamiento en hospeda.com.ar. | T4 | 19 | 3,33 s |

> `hospeda.com.ar` se lee «hospeda punto com punto ar», que es como se cuentan las
> sílabas de F4. El texto del prompt de T4 escribe `hospeda.com.ar` tal cual sale en
> plan-videos.md — no se reescribe la ortografía, solo se pronuncia así.

**Hablado: 11,4 s de 22.** El resto es el beat del portal, la grabación de pantalla y el
aire entre frases.

Y lo que se **lee** en pantalla, que no es lo mismo que se dice —son los textos que ya
trae el guion de V1 en plan-videos.md, más cortos y directos que la voz en off—:

| Cuándo | Texto |
|---|---|
| T1, primera mitad | **¿Cargar tu alojamiento otra vez?** |
| T1, segunda mitad → T2 | **No.** |
| T3 | subtítulo palabra por palabra de F3, y al final **Listo.** |
| T4 | **Publicá tu alojamiento** / **hospeda.com.ar** |

---

## El fondo

Un solo fondo, `escenas/escena1.png` — la cabaña de madera
del Litoral, plano entero de frente, celular en mano. Las tres tiradas parten de la
misma imagen; lo que cambia entre T1 y T4 es el encuadre, descrito en el prompt de cada
una, no una imagen distinta.

---

## El montaje — 22 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,0 | 5,0 | Hailuo · `@######ESCENA1#######` | medio (busto) | fastidio, niega con la mano libre | *"¿Ya tenés tu alojamiento publicado en otro lado? No lo cargues de nuevo."* |
| **T2** | 5,0–6,5 | 1,5 | Hailuo · `@######ESCENA1#######` | entero → primer plano del celular | empuja el celular hacia la cámara | — (solo música) |
| **T3** | 6,5–18,0 | 11,5 | **grabación** | pantalla completa | pega el link, importa, la ficha aparece, scroll | *"Pegás el link, esperás dos segundos, y tu ficha se completa sola."* + silencio |
| **T4** | 18,0–22,0 | 4,0 | Hailuo · `@######ESCENA1#######` | entero | pulgar arriba, sonríe | *"Publicá tu alojamiento en hospeda.com.ar."* |

> **Los cortes caen en múltiplos de 0,5 s** (pulso a 120 BPM): 5,0 · 6,5 · 18,0 · 22,0.

**Mudo con el personaje en cuadro: 1,5 s de 22 (6,8%)**, el mismo beat del portal que
usa V9.

> **Tres tiradas de Hailuo para imagen** —T1, T2 y T4—, más **una cuarta solo por el
> audio** (ver [`voz.md`](voz.md)). T3 es grabación de pantalla real.

### Por qué T1 y T2 no comparten plano

La regla 2 del montaje —dos tomas seguidas nunca comparten tamaño de plano— obliga a
diferenciar T1 de T2 aunque las dos partan de `escena1.png`. Se resuelve así: **T1 pide
un encuadre más cerrado que el de la referencia** —un plano medio, de busto, recortado
sobre la misma imagen— y **T2 arranca en el encuadre literal de la referencia**, de
cuerpo entero, para desde ahí empujar el celular a primer plano. El personaje, el fondo
y la posición del celular son los mismos; lo que cambia es cuánto entra en el cuadro.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 6 s | 5,0 s | las dos frases juntas son 4,39 s de habla; en 4 s no entran |
| T2 | 4 s | 1,5 s | es un beat visual, no hay frase — igual que T2 de V9 |
| T4 | 6 s | 4,0 s | la frase son 3,33 s y hay que dejar aire para el CTA |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,0 | 5,0 | tirada T1 · 6 s | 0,0 → 5,0 | 1,0 |
| **T2** | 5,0 → 6,5 | 1,5 | tirada T2 · 4 s | 0,0 → 1,5 | 2,5 |
| **T3** | 6,5 → 18,0 | 11,5 | grabación · importador | a elección | — |
| **T4** | 18,0 → 22,0 | 4,0 | tirada T4 · 6 s | 0,0 → 4,0 | 2,0 |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** *¿Ya tenés tu alojamiento publicado en otro lado?* | 0,00 → 3,16 | 3,16 | T1 | — (sigue F2) |
| **F2** *No lo cargues de nuevo.* | 3,16 → 4,39 | 1,23 | T1 | 0,61 |
| **F3** *Pegás el link, esperás dos segundos…* | 6,50 → 10,18 | 3,68 | T3 | — (sigue silencio, no corte) |
| **F4** *Publicá tu alojamiento en hospeda.com.ar.* | 18,00 → 21,33 | 3,33 | T4 | — (fin del video) |

> ⚠️ **La pista de voz es una sola tirada** (ver [`voz.md`](voz.md)) que se corta entre
> frases y se reubica en la timeline: no se pega como bloque único, porque los silencios
> de la grabación no coinciden con los de este montaje.

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,0 | T1 → T2 | plano medio → plano entero, arranca el empuje del celular | bajo |
| 6,5 | T2 → T3 | **entra** en la pantalla | medio |
| 18,0 | T3 → T4 | **sale** de la pantalla, al cierre | alto |

**T2 → T3.** Igual que en V9: en T2 el celular tiene que llegar grande pero con sus
cuatro bordes visibles y una franja de cabaña desenfocada alrededor —nunca tapar el
cuadro entero—, y T3 tiene que arrancar directo en el importador, no en una pantalla que
Hailuo dibujó. Si T3 abriera con algo parecido a lo último que se vio en T2, el corte se
lee como un error de continuidad en vez de un salto de escala.

**T3 → T4.** Es el corte más largo de sostener (11,5 s de pantalla) y el que más golpea
al volver al personaje. Por eso T4 tiene que arrancar YA hablando, con el pulgar
levantándose desde el primer fotograma: si hay el más mínimo respiro antes de la
primera sílaba de F4, el cierre se siente lento.

### Lo demás

1. **Música desde el frame 1**, instrumental, liviana, con un acento marcado en el
   segundo 5,0 (cuando "no" da paso al empuje del celular) y en el 18,0 (vuelta al
   personaje). 120 BPM para que la hoja de corte valga tal cual.
2. **Tirar el audio de las tres tiradas de imagen** y usar solo la pista de voz.
3. **Subtítulos palabra por palabra** durante T3 y T4, dentro de la zona segura.
4. **Nada de transiciones.** Corte seco en los tres — es la alternativa que
   plan-videos.md ya documenta como legítima para V1, no un plan B de menor calidad.

---

## Material a grabar (T3)

⚠️ **Este flujo no tiene código en [`grabaciones.md`](../grabaciones.md)**: esa tabla no
cubre el importador, así que se graba aparte, siguiendo el "Material a grabar" que ya
describe [V1 en plan-videos.md](../../plan-videos.md#v1--pegá-el-link-y-la-ficha-se-carga-sola):

1. Un aviso de otra plataforma abierto, se copia el link (sin que se vea el logo de
   Airbnb ni de Booking — tapado o usando otra fuente).
2. Se pega en el campo de importación de Hospeda.
3. Se aprieta importar y corre la carga.
4. Aparece la ficha completa y se hace scroll.

Grabar en móvil, de una sola toma, de un alojamiento con buenas fotos, y con más
metraje del necesario para tener margen al editar.

---

## Qué mirar al revisar las tomas

**Que T1 arranque hablando en el frame 1**, sin respiro entre la pregunta y la
respuesta más allá de la pausa natural.

**Que en T2 el celular llegue grande pero con sus cuatro bordes visibles.** Es el mismo
riesgo que en V9.

**Que T4 arranque con el pulgar ya subiendo**, no como un gesto que empieza después de
la primera palabra.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las tres.
