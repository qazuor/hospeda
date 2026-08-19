# V58 · Hablá directo con el que te va a recibir — montaje

Prompts y montaje de **V58**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— un corto de 12 s armado con **dos tiradas de Hailuo y una tirada sólo por el audio**.
Usa el **patrón I** — primer plano — sobre el **fondo 38**, la costanera al atardecer.
Molde: [`../v15/t9.md`](../v15/t9.md).

**Es un remate, no una demostración**: no hay pantalla que mostrar ni objeto que
sostener, sólo la cercanía de la cara haciendo el trabajo — el mismo criterio que hace
del patrón I el ideal para las frases fuertes.

---

## El diálogo completo

**Hospedín habla en las dos tomas.** Esto es lo que dice, de punta a punta:

> Cuando preguntás algo, no hay ningún intermediario.
>
> Te contesta la persona que te va a recibir.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | Cuando preguntás algo, no hay ningún intermediario. | T1 | 16 | 2,81 s |
| **S2** | Te contesta la persona que te va a recibir. | T2 | 15 | 2,63 s |

**Hablado: 5,4 s de 12.** El resto es el sostenido cálido de cada plano y la placa de
cierre.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 |
| T2 | subtítulo palabra por palabra de S2 |
| T3 (placa) | **Hablá directo con quien te va a recibir.** seguido del logo y **hospeda.com.ar** |

> ⚠️ **No se nombra ninguna plataforma de alquiler de terceros.** El contraste que hace
> el video es "sin intermediario", no una comparación directa con ninguna marca — se
> mantiene igual de genérico que el resto de la serie.

---

## El patrón y el fondo

**Patrón I — primer plano — sobre el fondo 38**, la costanera al atardecer: es el fondo
asignado específicamente a este video. Cabeza y hombros solamente, con el atardecer
completamente desenfocado detrás — el plano pensado para que la expresión y la boca
hagan todo el trabajo, sin nada más en cuadro.

**Sin objeto y sin pantalla.** Las manos ni entran en el encuadre en ninguna de las dos
tomas: es de los videos más económicos en acciones de toda la serie.

**Dos tomas, la misma base, cada vez más cerca**: T1 usa el encuadre tal cual llega el
fondo 38; T2 cierra todavía más, sobre el remate — la regla 2 del montaje exige que las
dos tomas no compartan tamaño de plano, y acá se cumple llevando el segundo encuadre al
límite de lo cerrado que puede ir sin perder la cabeza completa.

---

## El montaje — 12 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–3,5 | 3,5 | Hailuo · `@######ESCENA38#######` | primer plano (tal cual la referencia) | habla, mirada directa y tranquila | *"Cuando preguntás algo, no hay ningún intermediario."* |
| **T2** | 3,5–7,0 | 3,5 | Hailuo · `@######ESCENA38#######` | más cerca todavía | habla el remate, sonríe | *"Te contesta la persona que te va a recibir."* |
| **T3** | 7,0–12,0 | 5,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Dos tiradas de Hailuo** —T1 y T2—, más **una tirada sólo por el audio** (ver
[`voz.md`](voz.md); el guion completo son 5,4 s hablados, entra entero en una sola
generación).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 16 → 2,81 s ·
> S2 son 15 → 2,63 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 3,5 s | la frase son 2,81 s |
| T2 | 4 s | 3,5 s | la frase son 2,63 s, más el remate y la sonrisa final |
| **voz** | 6 s | S1 + S2 (5,4 s de contenido) | cubre las dos tomas |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 12,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 3,5 | 3,5 | tirada T1 · 4 s | 0,0 → 3,5 | 0,5 |
| **T2** | 3,5 → 7,0 | 3,5 | tirada T2 · 4 s | 0,0 → 3,5 | 0,5 |
| **T3** | 7,0 → 12,0 | 5,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *Cuando preguntás algo...* | 0,00 → 2,81 | 2,81 | T1 | 0,69 |
| **S2** *Te contesta la persona...* | 3,70 → 6,33 | 2,63 | T2 | 0,67 |

> S2 no arranca en el mismo instante del corte a T2: hay **0,2 s de asentamiento** antes
> de que la voz retome, mismo criterio que usa V21 en su corte T1→T2.
>
> ⚠️ **La pista de voz NO se pega como un bloque único.** Se corta entre S1 y S2 y cada
> una se posiciona en su lugar — ver [`voz.md`](voz.md).

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 3,5 | T1 → T2 | primer plano → más cerca todavía | bajo |
| 7,0 | T2 → T3 | más cerca todavía → placa | bajo |

**Ningún corte de este video es de riesgo alto**: el fondo no cambia entre T1 y T2, sólo
el encuadre, así que no hay salto de lugar que resolver.

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida y cercana — el tono es de
   confianza, no de urgencia—, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las dos tiradas de Hospedín** y usar sólo la pista de voz de
   `voz.md`.
4. **Subtítulos palabra por palabra** en las dos tomas.
5. **Nada de transiciones.** Corte seco en los dos.

---

## Qué mirar al revisar las tomas

**Que las dos tiradas arranquen hablando en el frame 1**, sin respiro ni mirada previa.

**Que T2 se vea de verdad más cerca que T1** y no una repetición del mismo encuadre —
es la regla 2 del montaje, y con un fondo ya cerrado de por sí es el riesgo más fácil de
pasar por alto.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos, y que quede
completo dentro de cuadro pese a lo cerrado del encuadre.

**Que el atardecer se mantenga consistente** —misma posición del sol, mismo color de
luz— entre las dos tomas.
