# V13 · Planes para cada tamaño — montaje

Prompts y montaje de **[V13](../../plan-videos.md#v13--planes-para-cada-tamaño)**: un
largo de 30 s armado con **dos tiradas de Hailuo y grabación de pantalla**, patrón B.

Molde: [`../v9/montaje.md`](../v9/montaje.md).

---

## El diálogo completo

> Queremos que Hospeda sirva tanto al que alquila un departamento como a un complejo o
> un hotel.
>
> Por eso hay distintos planes, con opciones accesibles según lo que necesite cada uno.
>
> No hace falta ser una gran empresa para tener presencia profesional.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | Queremos que Hospeda sirva tanto al que alquila un departamento como a un complejo o un hotel. | T1 | 33 | 5,8 s |
| **S2** | Por eso hay distintos planes, con opciones accesibles según lo que necesite cada uno. | T2 | 29 | 5,1 s |
| **S3** | No hace falta ser una gran empresa para tener presencia profesional. | T3 | 23 | 4,0 s |

**Hablado: 14,9 s de 30.** Es un video "largo" (25-50 s): la voz en off hace el trabajo
pesado y Hospedín aparece hablando sólo en los momentos clave — la apertura y el cierre
—, tal como pide la [regla de planos hablados cortos](../../plan-videos.md#hospedín-habla-pero-en-planos-cortos)
del plan.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1–T2 | subtítulo palabra por palabra de S1 y S2 |
| T2 | rótulos de la comparación: nombre de cada plan y sus funciones, **nunca un importe** |
| T3 | subtítulo de S3, y el cierre **"Mirá los planes en hospeda.com.ar"** |

> ⚠️ **Sin precios visibles, en ningún cuadro del video.** La grabación asignada es
> [`A8`](../../grabaciones.md#con-login-de-anfitrión) — *"Planes, sin que se lean los
> importes"* — y está tageada así a propósito: un precio quemado en el video obliga a
> rehacerlo entero cuando cambie la lista de planes. Lo que se muestra es **la
> comparación de funciones entre planes, nunca los números**. Esto se verifica en cada
> revisión de la tirada A8 antes de componerla, no sólo al momento de grabar.

---

> Los marcadores de referencia van así: `@######POSES#######`, no `@poses`. Cada toma
> arranca con su tabla de reemplazos, con el archivo que va en cada marcador y cuántas
> veces aparece.

---

## El patrón y el fondo

**Patrón B, fondo 22** — inserto lateral en el balneario. Es la asignación de
[la tabla de puesta en escena](../../plan-videos.md#anfitriones--captación): la
comparación de funciones necesita pantalla y tiempo de lectura, y el patrón B es
justamente el que permite que **la grabación dure lo que haga falta** sin que eso
dependa de cuánto aguanta una generación de Hailuo.

**Cómo funciona acá, en concreto**: el personaje y el rectángulo conviven en un único
encuadre durante casi todo el video. Hailuo genera dos tiradas cortas —la apertura (T1)
y el cierre (T3)— y **el tramo del medio (T2) no es un corte nuevo**: es el último
frame de T1, congelado, con la grabación A8 compuesta dentro del rectángulo durante los
15 s que dura la comparación. Por eso T1 y T2 se leen como un solo plano continuo a los
efectos de la regla 2 del montaje (dos tomas seguidas no comparten tamaño de plano): no
hay corte entre ellos, sólo cambia lo que se ve adentro del rectángulo.

> ⚠️ **El recuadro del fondo 22 no tiene todavía la proporción de la grabación real.**
> Como se explica en [`grabaciones.md`](../grabaciones.md), el teléfono de los fondos de
> patrón B mide 311 × 520 px (relación 0,5982) contra los 0,4615 de una grabación real:
> el recuadro es notoriamente más ancho. Hasta que el fondo se regenere con un teléfono
> en vez de un rectángulo, la grabación entra deformada o con bandas — el mismo
> pendiente que ya quedó anotado en V9.
>
> **Y 311 px de ancho es sólo el 29% de una pantalla de 1080**: adentro del recuadro va
> un **recorte ampliado** de la comparación —dos o tres filas de la tabla a la vez, en
> letra grande—, nunca la pantalla entera en miniatura. Si en la grabación original una
> fila no es un título o un ítem corto, adentro del recuadro no se va a leer.

---

## El montaje — 30 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–6,5 | 6,5 | Hailuo · `@######ESCENA22#######` | entero con inserto | señala el rectángulo, presenta | *"Queremos que Hospeda sirva tanto al que alquila un departamento como a un complejo o un hotel."* |
| **T2** | 6,5–21,5 | 15,0 | **grabación A8**, compuesta dentro del último frame de T1, congelado | entero con inserto (sin corte) | la comparación de funciones entre planes, sin importes | *"Por eso hay distintos planes, con opciones accesibles según lo que necesite cada uno."* + silencio |
| **T3** | 21,5–26,0 | 4,5 | Hailuo · `@######ESCENA22#######` | medio, más cerca | remate, sonríe | *"No hace falta ser una gran empresa para tener presencia profesional."* |
| **T4** | 26,0–30,0 | 4,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Los cortes reales del video son sólo dos**: T1/T2 → T3 (21,5 s) y T3 → T4 (26,0 s).
> El límite entre T1 y T2 en esta tabla es una división de contenido (qué se compone
> adentro del rectángulo, y cuándo empieza a hablar S2), no un corte de cámara.
>
> **Todos los cortes reales caen en múltiplos de 0,5 s**, sobre una música a
> **120 BPM**.

**Dos tiradas de Hailuo en todo el video** — T1 y T3 —, más **dos tiradas sólo por el
audio** (ver [`voz.md`](voz.md); el guion no entra en una sola tirada de 15 s, así que
se genera en dos partes).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 33 → 5,8 s ·
> S2 son 29 → 5,1 s · S3 son 23 → 4,0 s.

### Dentro del rectángulo, en T2

**S2 se dice al principio del tramo**, apenas arranca T2: de 6,8 a 11,9 s (con 0,3 s de
respiro después de S1). Los **9,6 s que quedan de T2 son deliberadamente silenciosos**:
es el tiempo que el video le da al espectador para efectivamente leer la comparación,
que es el objetivo del video — no hablarle de los planes sino mostrárselos. En ese tramo
final, la composición dentro del rectángulo sigue en movimiento aunque no haya voz:

- **La captura A8 es "quieta"** (2-3 s de grabación estática, por fila de la tabla), así
  que en edición se cruzan 2-3 encuadres distintos de esa misma sesión —cada uno un par
  de filas de la comparación— con un fundido corto entre ellos, o un paneo lento tipo
  Ken Burns sobre la tabla completa. Cualquiera de las dos evita que 15 s de una imagen
  fija se sientan estáticos.
- Los **nombres de los planes y sus funciones** aparecen como rótulos de texto
  superpuestos, con un pequeño check que se enciende función por función — un recurso
  de edición, no de Hailuo ni de la grabación.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 7 s | 6,5 s | la frase son 5,8 s, y hay que dejar el gesto de presentar hacia el rectángulo |
| T3 | 5 s | 4,5 s | la frase son 4,0 s |
| **voz — parte A** | 15 s | sólo el audio de S1 y S2 | cubre el tramo T1–T2 |
| **voz — parte B** | 15 s | sólo el audio de S3 | cubre T3 |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 30,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 6,5 | 6,5 | tirada T1 · 7 s | 0,0 → 6,5 | 0,5 |
| **T2** | 6,5 → 21,5 | 15,0 | último frame de T1, congelado + grabación A8 compuesta | a elección | — |
| **T3** | 21,5 → 26,0 | 4,5 | tirada T3 · 5 s | 0,0 → 4,5 | 0,5 |
| **T4** | 26,0 → 30,0 | 4,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *Queremos que Hospeda sirva...* | 0,00 → 5,80 | 5,8 | T1 | 0,70 |
| **S2** *Por eso hay distintos planes...* | 6,80 → 11,90 | 5,1 | T2 | 9,60 (visual, sin voz) |
| **S3** *No hace falta ser una gran empresa...* | 21,50 → 25,50 | 4,0 | T3 | 0,50 |

> ⚠️ **La voz de este video sale de DOS tiradas**, no de una. Como se explica en
> [`voz.md`](voz.md), el guion entero (14,9 s hablados más pausas) no entra en el
> límite de 15 s de una sola generación de Hailuo. La parte A cubre S1 y S2 y se
> corta justo donde el video ya tiene un corte real (T2 → T3, en 21,5 s); la parte B
> cubre sólo S3. El empalme cae exactamente sobre un corte de cámara, así que no hay
> forma de que se note la costura entre ambas tiradas.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 21,5 | T2 → T3 | entero con inserto → medio más cerca | medio |
| 26,0 | T3 → T4 | medio → placa | bajo |

**T2 → T3 · el riesgo es que el corte no se note como corte.** Durante 21,5 s el
personaje estuvo prácticamente inmóvil, así que el salto a un plano más cerca —y con
movimiento nuevo, hablando de nuevo— tiene que ser inequívoco. Se resuelve con la
escala: T3 va notoriamente más cerca que T1/T2, y el rectángulo con la comparación
desaparece del cuadro. Sin el rectángulo, el espectador entiende que terminó de mostrar
los planes y arranca el cierre.

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida y tranquila, **120 BPM**.
2. **El corte real va sobre el beat**; el límite T1/T2 no es un corte, así que no
   necesita caer sobre el pulso.
3. **Tirar el audio de las dos tiradas de Hospedín** y usar sólo la pista de voz
   empalmada de las dos partes.
4. **Subtítulos palabra por palabra**, grandes, dentro de la zona segura, en todo el
   tramo hablado.
5. **Nada de transiciones** en los cortes reales.

---

## Qué mirar al revisar las tomas

**Que el rectángulo de T1 quede plano, vacío y quieto**, con sus cuatro bordes
paralelos al cuadro — es el requisito no negociable del patrón B.

**Que arranque hablando en el frame 1**, tanto T1 como T3.

**Que el último frame de T1 sirva como freeze**: el personaje tiene que quedar en una
pose sostenible —sin gesto a mitad de camino— para que 15 s de esa misma imagen no se
vean congelados de forma rara.

**Que en ningún cuadro compuesto dentro del rectángulo se lea un número de precio.** Es
el chequeo más importante de este video: revisar cada recorte de la A8 antes de
componerlo, no confiar en que "ya se grabó sin precios".

**Que el círculo naranja no caiga en la franja derecha** en ninguna de las dos tiradas.
