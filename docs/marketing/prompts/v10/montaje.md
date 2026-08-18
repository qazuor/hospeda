# V10 · Todo lo que podés mostrar — montaje

Prompts y montaje de **[V10](../../plan-videos.md#v10--todo-lo-que-podés-mostrar)**: una
publicación de 45 s armada con **dos tiradas de Hailuo y grabación de pantalla**.
Patrón **B** (presentador al costado), fondo **15 · inserto lateral en la cabaña**.

Estructura y convenciones: [`../v9/montaje.md`](../v9/montaje.md), el molde de todos los
videos.

---

## El diálogo completo

> Una publicación en Hospeda muestra mucho más que un nombre y un teléfono.
>
> Cargás tus fotos, la descripción, la ubicación, los servicios, las características,
> los precios y tus formas de contacto.
>
> La idea es que el turista conozca bien tu propuesta antes de escribirte.

Es la [voz en off de V10](../../plan-videos.md#v10--todo-lo-que-podés-mostrar), tal
cual, repartida en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Una publicación en Hospeda muestra mucho más que un nombre y un teléfono. | T1 | 25 | 4,39 s |
| **F2** | Cargás tus fotos, la descripción, la ubicación, los servicios, las características, los precios y tus formas de contacto. | T2 | 36 | 6,32 s |
| **F3** | La idea es que el turista conozca bien tu propuesta antes de escribirte. | T3 | 25 | 4,39 s |

**Hablado: 15,1 s de 45 (33,5%).** Es, de los cinco videos de este lote, el que más se
apoya en la imagen sola: la voz da la lista una vez y el resto del tiempo lo hace el
recorrido visual con los nombres de cada sección en pantalla.

Texto en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **Mostrá todo lo que tenés** entrando en el frame 1 |
| T2, mientras habla F2 | subtítulo palabra por palabra |
| T2, resto silencioso | el nombre de cada sección al llegar: **Fotos** · **Descripción** · **Ubicación** · **Servicios** · **Características** · **Precios** · **Contacto** |
| T3 | **Publicá tu alojamiento** / **hospeda.com.ar** |

---

## El fondo

`escenas/escena15.png` — inserto lateral en la cabaña, el
mismo que usa V7. Las dos tiradas de personaje parten de la misma imagen.

---

## El montaje — 45 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,0 | 5,0 | Hailuo · `@######ESCENA15#######` | entero con inserto | presenta hacia el teléfono | F1 |
| **T2** | 5,0–38,0 | 33,0 | **grabación** | pantalla completa | recorrido completo por la ficha, sección por sección, con el nombre de cada una en pantalla | F2, después silencio |
| **T3** | 38,0–45,0 | 7,0 | Hailuo · `@######ESCENA15#######` | entero con inserto | cierre, sonríe | F3 |

> **Los cortes caen en múltiplos de 0,5 s**: 5,0 · 38,0 · 45,0.

### Por qué el recorrido va a pantalla completa

Igual que en V7: el objetivo de V10 es literalmente mostrar **cada sección** de la
ficha, y el inserto de 311 px solo deja leer títulos y botones (per
[`grabaciones.md`](../grabaciones.md)). Con siete secciones para mostrar, forzarlas
adentro del recuadro sería ilegible. T2 va a **pantalla completa, sin Hospedín en
cuadro**, con la voz en off llevando la enumeración y el resto del recorrido en
silencio — la misma solución de V7, y la misma que V9 usa en sus propias tomas de
grabación.

**33,0 s de recorrido para siete secciones** dan un promedio de ~4,7 s por sección,
tiempo cómodo para que cada nombre entre en pantalla, se lea y dé paso al siguiente.

### Rule 2 — dos tomas seguidas nunca comparten plano

T1 (entero con inserto) → T2 (pantalla completa) cambia del todo. T2 → T3 (entero con
inserto otra vez) también. Ningún par de tomas seguidas repite tamaño de plano.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 6 s | 5,0 s | la frase son 4,39 s |
| T3 | 8 s | 7,0 s | la frase son 4,39 s más el aire para que se lea el CTA |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,0 | 5,0 | tirada T1 · 6 s | 0,0 → 5,0 | 1,0 |
| **T2** | 5,0 → 38,0 | 33,0 | grabación · ficha (P5) | a elección | — |
| **T3** | 38,0 → 45,0 | 7,0 | tirada T3 · 8 s | 0,0 → 7,0 | 1,0 |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Nota |
|---|---|:-:|:-:|---|
| **F1** | 0,00 → 4,39 | 4,39 | T1 | aire hasta el corte: 0,61 s |
| **F2** | 5,00 → 11,32 | 6,32 | T2 | de acá a 38,0 sigue el recorrido en silencio |
| **F3** | 38,00 → 42,39 | 4,39 | T3 | fin del video: hold de 2,61 s con el CTA |

> ⚠️ **La pista de voz sale de una sola tirada** dedicada (ver [`voz.md`](voz.md)),
> partida en **dos** generaciones: el guion completo no entra en los 15 s de Hailuo.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,0 | T1 → T2 | entra a pantalla completa, sale Hospedín de cuadro | medio |
| 38,0 | T2 → T3 | sale de la pantalla, después de 33 s ahí | alto |

**T2 → T3.** Es el corte que más pesa en todo el lote: 33 s es mucho tiempo sin ver al
personaje, así que T3 tiene que arrancar con una sonrisa ya instalada, no construida
desde cero — si tarda en llegar a la sonrisa, el remate se siente tibio.

### Lo demás

1. **Música desde el frame 1**, instrumental, con un pulso parejo que sostenga los 33 s
   de recorrido sin que se sientan largos.
2. **Tirar el audio de las dos tiradas de imagen** y usar solo la pista de voz.
3. **Subtítulos palabra por palabra** durante F1, F2 y F3; el nombre de cada sección en
   pantalla durante el resto silencioso de T2.
4. **Corte seco en los dos.**

---

## Material a grabar (T2)

**P5 · Ficha de alojamiento completa**, sección por sección — ver
[`grabaciones.md`](../grabaciones.md), la misma que reutilizan V7, V8 y V9.

⚠️ **La nota del plan de videos aplica entera acá**: "la calidad del ejemplo es el
argumento". Si la ficha que se muestra está a medio llenar, el video juega en contra —
tiene que ser de un alojamiento lindo y con las siete secciones bien cargadas.

---

## Qué mirar al revisar las tomas

**Que T1 y T3 arranquen hablando en el frame 1.**

**Que el teléfono flotante de `escena15.png` quede vacío, plano y quieto en las dos
tiradas.** No se compone nada adentro en este video —el recorrido va a pantalla
completa—, pero igual tiene que sostenerse vacío para no romper la continuidad entre
T1 y T3.

**Que T3 arranque con la sonrisa ya puesta**, no construyéndose durante el plano.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.
