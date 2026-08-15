# V17 · La IA te escribe la descripción — montaje

Prompts y montaje de **[V17](../../plan-videos.md#v17--la-ia-te-escribe-la-descripción)**:
un corto de 22 s armado con **dos tiradas de Hailuo, grabación de pantalla y una tercera
tirada sólo por el audio**.

Estructura de referencia: [`../v9/montaje.md`](../v9/montaje.md). Patrón **A** (portal),
sobre un único fondo: [`escena1`](../fondos.md#1--cabaña-del-litoral--plano-entero-de-frente)
(cabaña del Litoral).

---

## El diálogo completo

> Escribí la descripción como te salga. La inteligencia artificial la mejora, y de paso
> la traduce al inglés y al portugués.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Escribí la descripción como te salga. | T1 | 12 | 2,11 s |
| **F2** | La inteligencia artificial la mejora, y de paso la traduce al inglés y al portugués. | grabación | 30 | 5,26 s |
| — | *(sin voz — satisfecho)* | T2 | — | 4,0 s |

**Hablado: 7,37 s de 22.** El resto es la grabación en silencio —tiempo para leer— y el
cierre mudo.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 / grabación | subtítulo palabra por palabra de F1 y F2 |
| T2, tramo final | **Probalo en hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v17--la-ia-te-escribe-la-descripción)
> y no se cambia acá. **El antes y después es todo el video**: el texto original tiene
> que leerse, y el resultado también — por eso la grabación se lleva 14 de los 22
> segundos, sin acelerar.

---

> **Los marcadores de referencia van así**: `@######POSES#######`, no `@poses`. Cada
> toma arranca con su **tabla de reemplazos**.

---

## Las tres reglas del montaje

1. **Corte seco, nunca transiciones.**
2. **Dos tomas seguidas nunca comparten tamaño de plano.**
3. **El audio no se corta nunca.**

---

## Un solo fondo, dos encuadres

Como V16, un único fondo (`escena1`, la cabaña) con las dos tomas de Hailuo variando el
encuadre dentro de la propia acción: **T1** arranca en plano entero y **termina en primer
plano**, empujando el celular hacia cámara mientras habla — el portal de este video.
**T2** arranca **de nuevo en plano entero**, del otro lado del corte de grabación.

---

## El montaje — 22 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA1#######` | entero → primer plano | habla y empuja el celular hacia la cámara | *"Escribí la descripción como te salga."* |
| **grabación** | 4,0–18,0 | 14,0 | **A4** · texto pobre → mejorado → traducido | pantalla completa | se aprieta el botón, aparece la versión trabajada, selector de idioma y las tres versiones | *"La inteligencia artificial la mejora, y de paso la traduce al inglés y al portugués."* |
| **T2** | 18,0–22,0 | 4,0 | Hailuo · `@######ESCENA1#######` | entero | satisfecho, gesto de "es fácil" | — (mudo, sólo el CTA en pantalla) |

**Mudo con el personaje en cuadro: 4,0 s de 22 (18%).** Es el cierre: ya se dijo todo
sobre la pantalla, así que T2 no necesita agregar más voz.

> **Dos tiradas de Hailuo para imagen** —T1 y T2—, más **una tercera sólo por el audio**
> (ver [`voz.md`](voz.md)). La grabación (A4, ver
> [`../grabaciones.md`](../grabaciones.md)) es material real, no generado.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 4,0 s | la frase son 2,11 s, y el resto del clip es el empuje hacia el portal |
| T2 | 4 s | 4,0 s | sin frase: la duración la fija el guion, no el diálogo |
| **voz** | **15 s** | sólo el audio | se pide el máximo para no truncar la última frase |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip |
|---|---|:-:|---|---|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 4 s | 0,0 → 4,0 |
| **grabación** | 4,0 → 18,0 | 14,0 | A4 · descripción con IA | a elección |
| **T2** | 18,0 → 22,0 | 4,0 | tirada T2 · 4 s | 0,0 → 4,0 |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de |
|---|---|:-:|:-:|
| **F1** *Escribí la descripción…* | 0,00 → 2,11 | 2,11 | T1 |
| **F2** *La inteligencia artificial…* | 4,00 → 9,26 | 5,26 | grabación |

**F1 arranca en el frame 1 de T1** (regla de "ya hablando"). **F2 arranca exactamente al
entrar la grabación**, y le sobran **8,74 s de grabación en silencio** después: es el
tiempo para que el texto antes/después se lea completo sin apuro, que es justo lo que
pide la tarea para este video.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → grabación | de primer plano del celular a la pantalla completa | medio — el celular tiene que llegar grande con los cuatro bordes visibles |
| 18,0 | grabación → T2 | de la pantalla de vuelta al plano entero del personaje, satisfecho | bajo |

### Lo demás

1. **Música desde el frame 1**, instrumental, **120 BPM**.
2. **Tirar el audio de las dos tiradas de Hailuo** y usar sólo la pista de voz.
3. **Subtítulos palabra por palabra** durante F1 y F2.
4. **No acelerar la grabación.** Es la instrucción explícita del plan: el antes y el
   después tienen que leerse enteros, letra por letra, no como un destello.
5. **El CTA entra sobre el sostén final de T2**, en silencio.

---

## Qué mirar al revisar las tomas

**Que T1 arranque ya hablando**, con el empuje del celular ocurriendo mientras habla, no
después.

**Que el empuje termine del todo hacia el 85%** y no siga en movimiento al cortar.

**Que la pantalla de T1 quede vacía y plana** hasta el corte.

**Que la grabación en sí no acelere el texto**: es la única forma de que se lea.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.
