# V69 · El río cambia todo — montaje

Prompts y montaje de **V69**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— una historia de 12,0 s armada con **una sola tirada de Hailuo, una tirada sólo por el
audio y la placa de cierre**. Es una pieza de **comunidad**: dice algo cultural
verdadero sobre el río, sin vender nada.

Usa el **patrón K** — en contacto con el lugar — sobre el **fondo 34**, sentado en la
orilla con los pies en el agua. Es puramente solo-personaje: **sin grabación de
pantalla, sin captura y sin ningún objeto en la mano**. Molde:
[`../v36/montaje.md`](../v36/montaje.md), que también resuelve un video corto con una
sola tirada de imagen.

> **El fondo 34 llega sin objeto en la mano** — el propio fondo dice explícitamente que
> no hay teléfono en la imagen: las dos manos quedan apoyadas detrás de él, sobre la
> arena.

---

## El diálogo completo

**Hospedín habla en una sola toma continua**, con una pausa corta entre las dos
frases. Esto es lo que dice, de punta a punta:

> El río no es un paisaje de fondo.
>
> Ordena la comida, los tiempos, la forma de vivir de toda la región.

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | El río no es un paisaje de fondo. | T1 | 12 | 2,1 s |
| **S2** | Ordena la comida, los tiempos, la forma de vivir de toda la región. | T1 | 22 | 3,9 s |

**Hablado: 6,0 s de 12,0**, las dos frases en una sola toma continua.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 y S2 |
| T2 (placa) | **Así es el Litoral.** seguido del logo y **hospeda.com.ar** |

---

## El patrón y el fondo

**Patrón K — en contacto con el lugar — sobre el fondo 34**, sentado directamente sobre
la arena de la orilla, con los pies metidos en el agua del río, de tarde. Es el fondo
asignado específicamente a este video, nuevo dentro del bloque de solo-personaje.

**Sin objeto.** El fondo lo aclara de forma explícita: no hay teléfono en la imagen.
Las dos manos quedan apoyadas hacia atrás sobre la arena, sosteniendo el peso del
torso.

**Una sola toma continua**: al ser sólo 6,0 s de guion, no hace falta partir el video en
dos planos de Hospedín — una sola tirada alcanza para las dos frases, con la mirada que
se va un instante hacia el río en S1 y vuelve a cámara para S2, el mismo recurso de
"mirar hacia el lugar" que pide la sección 20 de `personaje-hospedin.md` cuando el
personaje presenta un sitio.

---

## El montaje — 12,0 segundos, 1 corte

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–7,0 | 7,0 | Hailuo · `@######ESCENA34#######` | entero (tal cual la referencia) | sentado con los pies en el agua, mira el río y vuelve a cámara, habla las dos frases | *"El río no es un paisaje de fondo. Ordena la comida, los tiempos, la forma de vivir de toda la región."* |
| **T2** | 7,0–12,0 | 5,0 | `placas/final.png` | placa | logo, sin CTA de venta | — (solo música) |

> **El corte cae en múltiplo de 0,5 s**, sobre una música a **120 BPM**.

**Una sola tirada de Hailuo** —T1—, más **una tirada aparte sólo por el audio** (ver
[`voz.md`](voz.md)). No hay corte entre T1 y otra toma de Hospedín: las dos frases
corren en un único plano continuo.

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 12 → 2,1 s ·
> S2 son 22 → 3,9 s.

## Cómo se recorta la tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 8 s | 7,0 s | las dos frases juntas son 6,0 s: se pide con margen |
| **voz** | 10 s | S1 + S2 (6,0 s de contenido) | mismo guion que T1 |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 12,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 7,0 | 7,0 | tirada T1 · 8 s | 0,0 → 7,0 | 1,0 |
| **T2** | 7,0 → 12,0 | 5,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *El río no es un paisaje...* | 0,00 → 2,11 | 2,1 | T1 | — (sigue directo en S2 tras la pausa) |
| **S2** *Ordena la comida...* | 2,50 → 6,36 | 3,9 | T1 | 0,64 |

> ⚠️ **La pista de voz NO se pega como bloque único.** Se corta como una sola pieza que
> cubre S1 y S2 de corrido —con la pausa entre ambas ya incluida en la tirada— y se
> posiciona desde el frame 1 de T1.

### El único corte

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 7,0 | T1 → T2 | sentado en la orilla → placa | bajo |

Al no haber una segunda toma de Hospedín, **la regla 2 del montaje no aplica**: no hay
dos tomas de personaje seguidas para comparar tamaños de plano.

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida, con el pulso tranquilo del agua —
   no de venta —, **120 BPM**.
2. **El corte va sobre el beat.**
3. **Tirar el audio de la tirada de Hailuo** y usar sólo la pista de voz de `voz.md`.
4. **Subtítulos palabra por palabra** durante T1.
5. **Nada de transiciones.** Corte seco.

---

## Qué mirar al revisar la toma

**Que arranque hablando en el frame 1.**

**Que las dos frases se sientan una sola idea continua**, con la mirada al río en S1
notándose como un gesto real y no como una pausa vacía.

**Que el agua alrededor de los pies se mantenga quieta entre S1 y S2**, sin que el
oleaje cambie de forma de un momento a otro dentro del mismo plano.

**Que el círculo naranja quede completo dentro del cuadro** durante toda la toma.

**Que el video no termine sonando a venta.** La placa dice algo cultural, no pide nada
— revisar el texto final contra esta regla antes de aprobar el corte.
