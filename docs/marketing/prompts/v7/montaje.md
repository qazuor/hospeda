# V7 · Si tenés un alojamiento, esto es para vos — montaje

Prompts y montaje de **[V7](../../plan-videos.md#v7--si-tenés-un-alojamiento-esto-es-para-vos)**:
una publicación de 30 s armada con **dos tiradas de Hailuo y grabación de pantalla**.
Patrón **B** (presentador al costado), fondo **15 · inserto lateral en la cabaña**.

Estructura y convenciones: [`../v9/montaje.md`](../v9/montaje.md), el molde de todos los
videos.

---

## El diálogo completo

> Si tenés una casa, un departamento, una cabaña, una quinta, un hotel o cualquier
> alojamiento turístico, podés publicarlo en Hospeda.
>
> Tenés tu propia página con fotos, descripción, servicios, ubicación, precios y
> contacto.
>
> La idea es simple: que más turistas te encuentren y puedan escribirte directo.

Es la [voz en off de V7](../../plan-videos.md#v7--si-tenés-un-alojamiento-esto-es-para-vos),
tal cual, repartida en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Si tenés una casa, un departamento, una cabaña, una quinta, un hotel o cualquier alojamiento turístico, podés publicarlo en Hospeda. | T1 | 47 | 8,25 s |
| **F2** | Tenés tu propia página con fotos, descripción, servicios, ubicación, precios y contacto. | T2 | 27 | 4,74 s |
| **F3** | La idea es simple: que más turistas te encuentren y puedan escribirte directo. | T2 | 26 | 4,56 s |

**Hablado: 17,5 s de 30.** El resto es la grabación silenciosa (mostrando más de la
ficha de lo que da a leer la voz) y el cierre sin diálogo.

> **Enumerar los tipos importa** — es la nota del plan de videos: mucha gente con una
> cabaña o una quinta no se considera "alojamiento turístico". Por eso F1 es tan larga:
> no se acorta la lista.

Texto en pantalla — **distinto del audio**, como en V9:

| Cuándo | Texto |
|---|---|
| T1 | **¿Tenés un alojamiento?** grande, entrando en el frame 1 |
| T2, mientras habla F2 y F3 | subtítulo palabra por palabra |
| T2, resto silencioso | los nombres de cada sección que aparece: **Fotos** · **Descripción** · **Servicios** · **Ubicación** · **Precios** · **Contacto** |
| T3 | **Publicá tu alojamiento** / **hospeda.com.ar** |

---

## El fondo

[`escenas/escena15.png`](../../escenas/escena15.png) — inserto lateral en la cabaña.
Hospedín en el tercio izquierdo, el teléfono flotante a la derecha con la pantalla
vacía. Las dos tiradas de personaje parten de la misma imagen.

---

## El montaje — 30 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–9,0 | 9,0 | Hailuo · `@######ESCENA15#######` | entero con inserto | enumera con la mano, termina señalando el teléfono | F1 |
| **T2** | 9,0–24,5 | 15,5 | **grabación** | pantalla completa | recorrido por la ficha, sección por sección | F2 + F3, después silencio |
| **T3** | 24,5–30,0 | 5,5 | Hailuo · `@######ESCENA15#######` | entero con inserto | sonríe y asiente, sin hablar | — (solo música) |

> **Los cortes caen en múltiplos de 0,5 s**: 9,0 · 24,5 · 30,0.

### Por qué T2 va a pantalla completa y no adentro del inserto

El patrón B asignado dice que personaje y pantalla "conviven durante todo el video", y
en el inserto de 311 px eso sería literal. Pero acá el guion pide un **recorrido por
seis secciones distintas** de la ficha, y `grabaciones.md` ya deja escrito que adentro
del inserto **solo se leen títulos y botones**: si ahí adentro va la ficha completa,
todo el texto cae por debajo de lo legible. Por eso T2 se resuelve como **pantalla
completa, sin Hospedín en cuadro**, con la voz en off llevando el peso — la misma
solución que V9 usa en sus propias tomas de grabación (T3 y T5), y que queda anotada acá
en vez de forzar el patrón contra el contenido.

Esto no rompe el patrón B: el personaje sigue estando **al principio y al final**, junto
al inserto, y es el inserto lo que le da al video la libertad de que la grabación dure
lo que necesite — acá, 15,5 s.

### Rule 2 — dos tomas seguidas nunca comparten plano

T1 (entero con inserto) → T2 (pantalla completa): cambia del todo. T2 → T3 (entero con
inserto otra vez): también cambia. Ningún par de tomas seguidas repite tamaño de plano.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 10 s | 9,0 s | la frase son 8,25 s, la más larga de las cinco de este lote |
| T3 | 6 s | 5,5 s | sin diálogo, es el cierre silencioso |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 9,0 | 9,0 | tirada T1 · 10 s | 0,0 → 9,0 | 1,0 |
| **T2** | 9,0 → 24,5 | 15,5 | grabación · ficha (P5) | a elección | — |
| **T3** | 24,5 → 30,0 | 5,5 | tirada T3 · 6 s | 0,0 → 5,5 | 0,5 |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Nota |
|---|---|:-:|:-:|---|
| **F1** | 0,00 → 8,25 | 8,25 | T1 | aire hasta el corte: 0,75 s |
| **F2** | 9,00 → 13,74 | 4,74 | T2 | pausa corta antes de F3 |
| **F3** | 14,00 → 18,56 | 4,56 | T2 | de acá a 24,5 sigue la grabación en silencio |

> ⚠️ **La pista de voz sale de una sola tirada** dedicada (ver [`voz.md`](voz.md)),
> partida en **dos** generaciones porque el guion completo no entra en los 15 s de
> Hailuo. Se corta entre frases y se reubica acá.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 9,0 | T1 → T2 | entra a pantalla completa, sale Hospedín de cuadro | medio |
| 24,5 | T2 → T3 | sale de la pantalla, vuelve el personaje para el cierre | medio |

**T1 → T2.** T1 tiene que dejar leer con claridad el gesto final de "presentar" hacia
el teléfono, para que la pantalla completa que sigue se sienta motivada por ese gesto y
no como un salto arbitrario.

**T2 → T3.** Después de 15,5 s de pantalla, volver al personaje pide que arranque **ya
sonriendo**, no con una transición de vuelta a la neutralidad — el corte tiene que
sentirse como un remate, no como "se acabó la demo".

### Lo demás

1. **Música desde el frame 1**, instrumental, acompañando sin tapar los 17,5 s hablados.
2. **Tirar el audio de las dos tiradas de imagen** y usar solo la pista de voz.
3. **Subtítulos palabra por palabra** durante F2 y F3; etiquetas de sección durante el
   resto silencioso de T2.
4. **Corte seco en los dos.**

---

## Material a grabar (T2)

**P5 · Ficha de alojamiento completa**, sección por sección — ver
[`grabaciones.md`](../grabaciones.md). Es la misma grabación que reutilizan V8, V9 y
V10: conviene grabarla una sola vez, bien, con un alojamiento lindo y bien cargado.

---

## Qué mirar al revisar las tomas

**Que T1 arranque hablando en el frame 1**, con el gesto de enumerar ya en marcha —no
antes de la primera palabra.

**Que el teléfono flotante de `escena15.png` quede vacío, plano y quieto en las dos
tiradas.** Nada se compone ahí en este video —la grabación va a pantalla completa—, pero
igual tiene que sostenerse vacío: si el modelo le mete contenido, la imagen no sirve
igual, porque rompe la continuidad con T3.

**Que T3 no invente diálogo.** Es un cierre mudo; si el modelo le abre la boca, hay que
regenerar.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.
