# V20 · Mirá cómo te va — montaje

Prompts y montaje de **[V20](../../plan-videos.md#v20--mirá-cómo-te-va)**: un corto de
22 s armado con **dos tiradas de Hailuo, grabación de pantalla y una tercera tirada sólo
por el audio**.

Estructura de referencia: [`../v9/montaje.md`](../v9/montaje.md). Patrón **B**
(presentador al costado), sobre un único fondo:
[`escena21`](../fondos.md#21--inserto-lateral-en-la-costanera--patrón-b) (inserto lateral
en la costanera).

---

## El diálogo completo

> ¿Sabés cuánta gente vio tu ficha este mes? Cuántos te consultaron, cuántos te
> guardaron y cómo estás respecto del resto de la zona. Está todo en tu panel.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | ¿Sabés cuánta gente vio tu ficha este mes? | T1 | 13 | 2,28 s |
| **F2** | Cuántos te consultaron, cuántos te guardaron y cómo estás respecto del resto de la zona. | grabación | 28 | 4,91 s |
| **F3** | Está todo en tu panel. | T2 | 8 | 1,40 s |

**Hablado: 8,59 s de 22.** Es un video de retención, no de captación: **le habla a los
que ya publicaron**, así que el tono es de compañero que le muestra algo, no de venta.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 / grabación / T2 | subtítulo palabra por palabra de F1, F2 y F3 |
| T2, tramo final | **Entrá a tu panel en hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v20--mirá-cómo-te-va) y no se
> cambia acá.

---

> **Los marcadores de referencia van así**: `@######POSES#######`, no `@poses`.

---

## Las tres reglas del montaje

1. **Corte seco, nunca transiciones.**
2. **Dos tomas seguidas nunca comparten tamaño de plano.**
3. **El audio no se corta nunca.**

---

## Por qué patrón B, y por qué la grabación va a pantalla completa igual

`escena21` es un fondo de **patrón B**: Hospedín en el tercio izquierdo, un teléfono
flotante vacío a su lado, listo para componer contenido. La tabla de puesta en escena
elige B para V20 porque **"el panel necesita tiempo en pantalla"** — con patrón A, el
tiempo de pantalla queda atado a lo que dura el "portal" de una tirada de Hailuo; con B,
no depende de eso.

Pero el teléfono flotante del fondo mide sólo el 29% del ancho del video — adentro sólo
se leen títulos y botones (ver [`../grabaciones.md`](../grabaciones.md)). Un panel de
estadísticas tiene números chicos, y el guion pide explícitamente que **"los números
[sean] visibles"**. Por eso, igual que hizo V9 con su propia grabación (T3 y T5, a
pantalla completa aunque el video tuviera una toma de inserto), **la grabación de V20 va
a pantalla completa**, no compuesta dentro del rectángulo del fondo. El patrón B se usa
para las dos tomas de Hailuo —que abren y cierran el video hablando junto al teléfono
flotante—, y la demostración en sí corta a pantalla completa para que los números se
lean.

**El teléfono flotante nunca recibe contenido.** En las dos tomas de Hailuo se queda
vacío, plano y quieto todo el tiempo: es un elemento de escena, no el lugar donde se
compone la grabación.

---

## El montaje — 22 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA21#######` | entero, tercio izquierdo | pregunta y señala el teléfono flotante vacío | *"¿Sabés cuánta gente vio tu ficha este mes?"* |
| **grabación** | 4,0–18,0 | 14,0 | **A6** · panel de estadísticas, con scroll | pantalla completa | recorrido por el panel, los números visibles | *"Cuántos te consultaron, cuántos te guardaron y cómo estás respecto del resto de la zona."* |
| **T2** | 18,0–22,0 | 4,0 | Hailuo · `@######ESCENA21#######` | entero, tercio izquierdo | cierra señalando de nuevo el teléfono flotante | *"Está todo en tu panel."* |

**Mudo con el personaje en cuadro: 0 s.** Las tres partes hablan.

> **Dos tiradas de Hailuo para imagen** —T1 y T2, ambas del mismo fondo—, más **una
> tercera sólo por el audio** (ver [`voz.md`](voz.md)). La grabación (A6, ver
> [`../grabaciones.md`](../grabaciones.md)) es material real, no generado, y **no lleva
> precios ni datos de terceros a la vista**.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 4,0 s | la frase son 2,28 s: sobra margen para el gesto hacia el teléfono |
| T2 | 4 s | 4,0 s | la frase son 1,40 s: sobra margen para el sostén y el CTA |
| **voz** | **15 s** | sólo el audio | se pide el máximo para no truncar la última frase |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip |
|---|---|:-:|---|---|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 4 s | 0,0 → 4,0 |
| **grabación** | 4,0 → 18,0 | 14,0 | A6 · panel de estadísticas | a elección |
| **T2** | 18,0 → 22,0 | 4,0 | tirada T2 · 4 s | 0,0 → 4,0 |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de |
|---|---|:-:|:-:|
| **F1** *¿Sabés cuánta gente…* | 0,00 → 2,28 | 2,28 | T1 |
| **F2** *Cuántos te consultaron…* | 4,00 → 8,91 | 4,91 | grabación |
| **F3** *Está todo en tu panel.* | 18,00 → 19,40 | 1,40 | T2 |

**F1 arranca en el frame 1 de T1** y **F3 en el frame 1 de T2**. **F2 arranca al entrar
la grabación**, con **5,09 s de grabación en silencio** después de que termina de hablar:
tiempo para que el ojo recorra el panel sin la voz guiándolo, antes de volver al
personaje.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → grabación | del presentador junto al teléfono vacío a la pantalla completa con los números | medio |
| 18,0 | grabación → T2 | de la pantalla de vuelta al presentador | **alto** — después de mostrar datos concretos, volver a un teléfono vacío puede sentirse un paso atrás |

**El riesgo del segundo corte se resuelve con el ritmo, no con el contenido del
teléfono.** T2 no intenta repetir ni resumir los números: cierra con una frase corta y
segura, el CTA entra rápido sobre el sostén, y el teléfono vacío queda leído como
elemento de escena, no como una segunda demostración que decepciona por ser más chica.

### Lo demás

1. **Música desde el frame 1**, instrumental, **120 BPM**.
2. **Tirar el audio de las dos tiradas de Hailuo** y usar sólo la pista de voz.
3. **Subtítulos palabra por palabra** durante F1, F2 y F3.
4. **Sin precios ni datos de terceros visibles** en la grabación del panel.
5. **El CTA entra rápido sobre el sostén final de T2**, sin demorarlo.

---

## Qué mirar al revisar las tomas

**Que el teléfono flotante quede vacío, plano y quieto** en las dos tomas de Hailuo — es
el punto más frágil de todo el patrón B, y acá ni siquiera recibe contenido compuesto, así
que no hay excusa para que el modelo invente algo encima.

**Que T1 y T2 arranquen ya hablando**, sin pausa antes de la primera palabra.

**Que el teléfono no aparezca girado, inclinado ni con perspectiva**: tiene que quedar
perfectamente de frente y plano en las dos tomas.

**Que el círculo naranja no se corra a la franja derecha tapada** por la interfaz de
Instagram/TikTok — es el riesgo específico de este fondo, señalado en su propio prompt.
