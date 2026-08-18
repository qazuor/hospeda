# V33 · Descubrí un destino — molde de la serie

**Esto no es un video: es el MOLDE que se reusa por cada destino.**
[V33](../../plan-videos.md#v33--descubrí-un-destino--serie) es una serie — "un video por
destino", arrancando con Concepción del Uruguay, Colón, Federación y Gualeguaychú—, así
que este documento fija las tomas genéricas y deja marcados con huecos los tramos que
cambian en cada edición: el destino, sus atractivos y el material real filmado del
lugar.

Patrón **L → E**: abre con el plano general (fondo 20, fijo, se reutiliza siempre) y
corta al patrón E ("llega y frena") sobre el fondo que corresponda al destino. **Largo**,
45 s, formato Publicación.

---

## Estructura fija (del plan)

> "imágenes del lugar, tres o cuatro atractivos, la página del destino en la
> plataforma, y cierre."

Esto mezcla **dos tipos de material muy distintos**, y conviene no confundirlos:

1. **Hailuo** genera a Hospedín — el plano general de apertura (T1, fijo) y la llegada
   al destino (T3, cambia el fondo).
2. **Material real** —fotografía o video del lugar— cubre "las imágenes del lugar" y
   "los tres o cuatro atractivos". **Esto no lo genera Hailuo ni sale de los fondos de
   `escenas/`: es filmación o fotografía real del destino**, la misma dependencia que
   ya bloquea al plan de placas para esta categoría.
3. La **grabación de pantalla P7** (página de destino, scroll — ver
   [`../grabaciones.md`](../grabaciones.md)) cubre la parte de plataforma.
4. La **placa de cierre** existente, con el CTA cambiado por destino.

---

## El diálogo — el molde tal como vive en el plan

> (Destino) tiene mucho más para conocer de lo que entra en una escapada de un día.
>
> (Los tres o cuatro atractivos).
>
> En Hospeda estamos reuniendo toda esa información para que puedas descubrir qué
> visitar y organizar mejor tu viaje.

**F1 y F3 no se tocan entre ediciones** (F1 solo recibe el nombre del destino). **F2 la
escribe cada edición**, a partir de las fichas de destino y atractivos ya investigados
del plan de placas (categoría 8) — ver la nota del plan de videos. Este documento **no
inventa atractivos**: sería contenido editorial que no está escrito todavía.

---

## El montaje — molde con huecos marcados

Los tiempos de abajo son un **ejemplo ilustrativo con Colón**, para mostrar cómo cierran
las cuentas. **Recalcular por destino** con la fórmula de sílabas ÷ 5,7 en cuanto F1 (con
el nombre real) y F2 (con los atractivos reales) estén escritos.

| # | Tiempo (ejemplo) | Dura | De dónde sale | Qué pasa | Voz |
|---|---|:-:|---|---|---|
| **T1** | 0,0–3,0 | 3,0 | Hailuo · `@######ESCENA20#######` — **fija, se reutiliza siempre** | plano general, entra caminando al palmar, sin cámara a la vista | — (sin diálogo) |
| **T2** | 3,0–7,5 | 4,5 | 🔒 **HUECO — material real** del destino, montaje corto de 2-3 planos | imágenes del lugar, estableciendo dónde está | — (silencio o música, arranca la voz si conviene adelantarla) |
| **T3** | 7,5–13,0 | 5,5 | Hailuo · `@######ESCENA-DESTINO#######` — **cambia por edición**, ver [`t3.md`](t3.md) | llega y frena en el destino, abre los brazos al paisaje | **F1**: *"(Destino) tiene mucho más para conocer de lo que entra en una escapada de un día."* |
| **T4** | 13,0–34,0 | 🔒 **21,0 (ajustable)** | 🔒 **HUECO — material real** de los tres o cuatro atractivos, un plano por atractivo | los atractivos, uno tras otro | **F2**: *"(Los tres o cuatro atractivos)."* — duración real a recalcular |
| **T5** | 34,0–42,0 | 8,0 | **grabación** P7 | scroll por la página del destino en la plataforma | **F3**: *"En Hospeda estamos reuniendo toda esa información para que puedas descubrir qué visitar y organizar mejor tu viaje."* |
| **T6** | 42,0–45,0 | 3,0 | `placas/final.png`, CTA por destino | logo y CTA | — (solo música) |

**Suma del ejemplo: 45,0 s.** T2 y T4 son los tramos elásticos: si F2 sale más larga o
más corta que en este ejemplo, ese tiempo se ajusta ahí, no en T1, T3, T5 o T6.

> **Todos los cortes, una vez fijado el texto real, caen en múltiplos de 0,5 s**, sobre
> una música a **120 BPM** — igual regla que el resto del lote.

---

## Los dos huecos, explícitos

### Hueco 1 — T2, imágenes del lugar (dependencia)

Sin fotografía o video real del destino no hay plano de apertura del lugar. **Es el
mismo cuello de botella que el plan de placas ya tiene para esta categoría**: no se
resuelve generando algo con IA, porque el objetivo es mostrar el lugar real, no una
recreación.

### Hueco 2 — T4, los atractivos (dependencia de contenido + material)

Necesita dos cosas que hoy no existen para ningún destino de esta primera tanda:

1. **El texto de F2**, con los tres o cuatro atractivos redactados (sale de las fichas
   de destino de la categoría 8 del plan de placas, ya investigadas).
2. **El material real** de esos atractivos — foto o video, uno por atractivo.

---

## Las dos tomas de Hailuo (las únicas que se generan con IA)

| Toma | Fondo | Cambia por edición? | Archivo |
|---|---|:-:|---|
| **T1** | `20` — plano general del palmar | **No.** Una sola generación para toda la serie. | [`t1.md`](t1.md) |
| **T3** | uno de `2`, `4`, `5`, `6`, `8`, `11`, `12` según el destino | **Sí.** Ver la tabla de mapeo en `t3.md`. | [`t3.md`](t3.md) |

La voz sigue la misma regla de siempre —se genera aparte, nunca por toma— pero acá el
guion cambia por edición, así que la tirada también: ver [`voz.md`](voz.md).

---

## Los fondos sugeridos por destino (primera tanda)

Ver el detalle y el porqué de cada uno en [`t3.md`](t3.md). Resumen:

| Destino | Fondo |
|---|:-:|
| Concepción del Uruguay | 4 · costanera |
| Colón | 5 · palmar |
| Federación | 6 · complejo termal |
| Gualeguaychú | 8 · carnaval |

Quedan `2` (muelle de las islas), `11` (autódromo) y `12` (bote de pesca) para destinos
futuros de la serie.

---

## Lo que sigue bloqueado

**Toda la serie depende de material filmado que hoy no existe**: fotografía o video real
de cada destino y de sus tres o cuatro atractivos. Es la misma dependencia que ya frena
la categoría 8 del plan de placas — no es un problema nuevo de este video, es el mismo
cuello de botella heredado.

**Lo que sí se puede generar y evaluar ya**, sin esperar el material real:

- **T1**, la apertura de plano general — no depende de ningún destino.
- **T3** para cada uno de los cuatro fondos ya asignados (Concepción del Uruguay, Colón,
  Federación, Gualeguaychú) — el diálogo de F1 ya se puede escribir con el nombre real
  del destino, sin esperar los atractivos de F2.
- La **grabación P7** (página de destino) para los destinos que ya estén cargados en la
  plataforma.

---

## Qué mirar al revisar las tomas

**Que T1 no cambie entre ediciones.** Si aparece la tentación de regenerarla "para que
combine mejor con tal destino", es una señal de que el molde se está rompiendo — su
gracia es justamente que es la misma apertura para toda la serie.

**Que T3 arranque hablando mientras llega**, no antes ni después — es un patrón E, y la
regla del patrón pide "llega y frena", nunca un recorrido largo por el cuadro.

**Que el nombre del destino en F1 esté bien pronunciado** en la tirada de voz: es lo
único de la frase fija que cambia por edición y lo más fácil de pasar por alto al
revisar.

**Que T4 no repita el mismo tipo de plano en sus atractivos** — si los tres o cuatro
planos del material real son todos el mismo encuadre, el tramo más largo del video se
siente plano.
