# V70 · Los que se van en marzo se pierden lo mejor — montaje

Prompts y montaje de **V70**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— una historia de 13,0 s armada con **dos tiradas de Hailuo, una tirada sólo por el
audio y la placa de cierre**. Le habla al **turista** sobre la temporada baja: marzo
sigue siendo Litoral, con menos gente.

Usa la combinación **L → I** — plano general que corta a primer plano — sobre el
**fondo 41** para la apertura, plano general frente al río ancho al amanecer. Es
puramente solo-personaje: **sin grabación de pantalla, sin captura y sin ningún objeto
en la mano**. Molde: [`../v40/montaje.md`](../v40/montaje.md) para el acercamiento
progresivo, y la combinación **L → cualquiera** de
[`../../patrones-de-puesta-en-escena.md`](../../patrones-de-puesta-en-escena.md#cómo-se-combinan).

> ⚠️ **El fondo 41 no sirve para hablar.** A la escala de un plano general la boca no se
> lee, así que **T1 no tiene diálogo**: la voz de S1 corre como voz en off mientras
> Hospedín mira el río en silencio. Recién en T2, con un encuadre mucho más cerrado
> sobre el mismo lugar y la misma luz, hay boca legible y ahí sí habla S2.

---

## El diálogo completo

> Marzo en el Litoral tiene menos gente y el mismo río.
>
> Los que se van justo antes se pierden lo mejor de la temporada.

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | Marzo en el Litoral tiene menos gente y el mismo río. | T1 (voz en off, sin lip sync) | 19 | 3,3 s |
| **S2** | Los que se van justo antes se pierden lo mejor de la temporada. | T2 (con lip sync) | 20 | 3,5 s |

**Hablado: 6,8 s de 13,0.**

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 |
| T2 | subtítulo palabra por palabra de S2 |
| T3 (placa) | **Marzo también es Litoral.** seguido del logo y **hospeda.com.ar** |

---

## El patrón y el fondo

**T1 — patrón L sobre el fondo 41**: plano general de la orilla de un río ancho al
amanecer, con Hospedín chico dentro del cuadro. **T2 — patrón I**, un encuadre mucho
más cerrado sobre el mismo lugar y la misma luz de amanecer, referenciando el fondo 41
para la continuidad del lugar aunque el encuadre en sí sea nuevo — el mismo criterio
que usa V40 para acercar el plano dentro de un único fondo de referencia, llevado acá al
extremo de pasar de plano general a primer plano.

**Sin objeto en ninguna de las dos.** El fondo 41 no menciona manos porque a esa
distancia no se distinguen; en T2, ya en primer plano, tampoco hay nada que sostener.

---

## El montaje — 13,0 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA41#######` | general (tal cual la referencia) | de pie frente al río al amanecer, sin hablar | *"Marzo en el Litoral tiene menos gente y el mismo río."* (voz en off) |
| **T2** | 4,0–8,0 | 4,0 | Hailuo · `@######ESCENA41#######`, encuadre cerrado | primer plano | habla el remate, mirando a cámara | *"Los que se van justo antes se pierden lo mejor de la temporada."* |
| **T3** | 8,0–13,0 | 5,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Dos tiradas de Hailuo** —T1 y T2—, más **una tirada sólo por el audio** (ver
[`voz.md`](voz.md); el guion completo son 6,8 s hablados, entra entero en el límite de
15 s de una sola tirada).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 19 → 3,3 s ·
> S2 son 20 → 3,5 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 4,0 s | la frase son 3,3 s: se usa el clip completo, sin sobra |
| T2 | 4 s | 4,0 s | la frase son 3,5 s: se usa el clip completo, sin sobra |
| **voz** | 10 s | S1 + S2 (6,8 s de contenido) | cubre T1 (voz en off) y T2 (lip sync) |

> ⚠️ **Ni T1 ni T2 tienen sobrante.** Las dos frases casi llenan el mínimo de 4 s de
> Hailuo, así que si alguna de las dos generaciones trae un respiro antes de empezar,
> hay que volver a generarla — no hay margen para recortarlo.

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 13,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 4 s | 0,0 → 4,0 | 0,0 |
| **T2** | 4,0 → 8,0 | 4,0 | tirada T2 · 4 s | 0,0 → 4,0 | 0,0 |
| **T3** | 8,0 → 13,0 | 5,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *Marzo en el Litoral...* | 0,00 → 3,33 | 3,3 | T1 (voz en off) | 0,67 |
| **S2** *Los que se van justo antes...* | 4,00 → 7,51 | 3,5 | T2 (lip sync) | 0,49 |

> **La tirada de voz es una sola** (ver [`voz.md`](voz.md)). Igual **no se pega como
> bloque único**: se corta entre S1 y S2 y cada frase se posiciona sobre su toma —
> S1 sobre T1, como voz en off pura sin que la boca se mueva, y S2 sobre T2, esta vez
> sincronizada.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → T2 | plano general al amanecer → primer plano | bajo — el cambio de escala es enorme, exactamente lo que pide la regla 2 |
| 8,0 | T2 → T3 | primer plano → placa | bajo |

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida, con un crecimiento suave hacia
   T2, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las dos tiradas de Hailuo** y usar sólo la pista de voz de
   `voz.md`.
4. **Subtítulos palabra por palabra** en las dos tomas, incluida T1 pese a no tener lip
   sync — es voz en off, y la regla de verse sin sonido sigue valiendo igual.
5. **Nada de transiciones.** Corte seco en los dos.

---

## Qué mirar al revisar las tomas

**Que T1 nunca hable.** Es la toma con más riesgo de que el modelo invente que abre la
boca — bloque `NO DIALOGUE` propio en [`t1.md`](t1.md) y lista cerrada de lo que hace
mientras la voz en off suena por encima.

**Que T2 arranque hablando en el frame 1**, sin respiro ni mirada previa.

**Que la luz del amanecer se lea igual en las dos tomas** —mismo cielo rosado y
dorado, mismo reflejo sobre el agua— aunque el encuadre cambie radicalmente: es lo que
sostiene que las dos tomas son "el mismo lugar" y no dos fondos distintos pegados uno
al lado del otro.

**Que el círculo naranja quede completo dentro del cuadro** en las dos, sobre todo en
T2, donde primer plano es justamente el patrón donde más fácil se corta.

**Que ningún destino puntual quede nombrado**, ni en la voz ni en la placa: el video
habla de "el Litoral" en general.
