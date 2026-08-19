# V66 · El que arregla a las once de la noche — montaje

Prompts y montaje de **V66**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— una historia de 14,5 s armada con **dos tiradas de Hailuo, una tirada sólo por el
audio y la placa de cierre**. Le habla a los **oficios** —plomería, gas, electricidad—,
y no es un video de captación: es reconocimiento primero, pedido después.

Usa el **patrón I** — primer plano — sobre el **fondo 39**, primer plano en el palmar
con luz filtrada. Es puramente solo-personaje: **sin grabación de pantalla, sin
captura y sin ningún objeto en la mano**. Molde: [`../v40/montaje.md`](../v40/montaje.md).

> **El fondo 39 encuadra sólo cabeza y hombros** — no hay manos en cuadro en ninguna de
> las dos tiradas, así que no hace falta declarar nada sobre ellas: no hay teléfono que
> desmentir porque el encuadre nunca las incluye.

---

## El diálogo completo

**Hospedín habla en las dos tomas.** Primero dignifica el oficio, después lo nombra sin
pedir nada todavía — el pedido va **sólo en la placa de cierre, en texto, suave**. Esto
es lo que dice, de punta a punta:

> A las once de la noche, cuando algo se rompe, alguien contesta el teléfono.
>
> Un plomero, un electricista, un gasista: el que resuelve cuando nadie más responde.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | A las once de la noche, cuando algo se rompe, alguien contesta el teléfono. | T1 | 25 | 4,4 s |
| **S2** | Un plomero, un electricista, un gasista: el que resuelve cuando nadie más responde. | T2 | 27 | 4,7 s |

**Hablado: 9,1 s de 14,5.** Las dos tomas llevan lip sync, sobre el mismo primer plano
—apretando un poco más el encuadre en T2, para que no se sientan el mismo plano
repetido.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 |
| T2 | subtítulo palabra por palabra de S2 |
| T3 (placa) | **Si sos de un oficio, te estamos buscando.** seguido del logo y **hospeda.com.ar** |

> ⚠️ **El pedido no se dice en voz.** Ni S1 ni S2 mencionan sumarse a nada: son
> reconocimiento puro. El único llamado a la acción de todo el video vive en el texto de
> la placa final, después de que ya quedó dicho lo que se valora del oficio — es la regla
> que pide el brief de este video, no una licencia de edición.

---

## El patrón y el fondo

**Patrón I — primer plano — sobre el fondo 39**, el palmar del Litoral con luz de tarde
filtrada entre las hojas, completamente desenfocado detrás. Es el fondo asignado
específicamente a este video, nuevo dentro del bloque de solo-personaje.

**Sin objeto.** El encuadre de este fondo no incluye las manos —termina a la altura del
pecho—, así que no hay nada que sostener ni que desmentir.

**Dos tomas, mismo primer plano, un poco más cerca en la segunda**: T1 usa el encuadre
tal cual la referencia; T2 cierra un poco más, sobre la frase que nombra los tres
oficios. Es el mismo recurso de acercamiento progresivo que usa
[V40](../v40/montaje.md), adaptado a que el patrón I ya arranca cerca: acá el
movimiento es más sutil, pero sigue siendo un cambio de plano real entre las dos tomas,
como pide la regla 2 del montaje.

---

## El montaje — 14,5 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA39#######` | primer plano (tal cual la referencia) | mira a cámara con calma, habla | *"A las once de la noche, cuando algo se rompe, alguien contesta el teléfono."* |
| **T2** | 4,0–9,5 | 5,5 | Hailuo · `@######ESCENA39#######` | primer plano, un poco más cerca | habla con reconocimiento, asiente al final | *"Un plomero, un electricista, un gasista: el que resuelve cuando nadie más responde."* |
| **T3** | 9,5–14,5 | 5,0 | `placas/final.png` | placa | logo y CTA suave | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Dos tiradas de Hailuo** —T1 y T2—, más **una tirada sólo por el audio** (ver
[`voz.md`](voz.md); el guion completo son 9,1 s hablados, entra entero en el límite de
15 s de una sola tirada).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 25 → 4,4 s ·
> S2 son 27 → 4,7 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 4,0 s | la frase son 4,4 s: se usa el clip completo, sin sobra |
| T2 | 6 s | 5,5 s | la frase son 4,7 s |
| **voz** | 12 s | S1 + S2 (9,1 s de contenido) | cubre T1 y T2 enteras |

> ⚠️ **T1 no tiene sobrante.** La frase (4,4 s) casi llena el mínimo pedido a Hailuo
> (4 s), así que si la generación real trae un respiro antes de la primera palabra, hay
> que volver a generar — no hay margen para recortarlo.

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 14,5 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 4 s | 0,0 → 4,0 | 0,0 |
| **T2** | 4,0 → 9,5 | 5,5 | tirada T2 · 6 s | 0,0 → 5,5 | 0,5 |
| **T3** | 9,5 → 14,5 | 5,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *A las once de la noche...* | 0,00 → 4,39 | 4,4 | T1 | — (toma sin sobra) |
| **S2** *Un plomero, un electricista...* | 4,00 → 8,74 | 4,7 | T2 | 0,76 |

> **La tirada de voz es una sola** (ver [`voz.md`](voz.md)): el guion completo entra en
> el límite de 15 s de Hailuo, así que no hace falta partirla en dos como en V40 o V14.
> Igual **no se pega como bloque único**: se corta entre S1 y S2 y cada frase se
> posiciona sobre su toma.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → T2 | primer plano → un poco más cerca | medio |
| 9,5 | T2 → T3 | primer plano cerrado → placa | bajo |

**T1 → T2 es el corte de mayor cuidado del video**: como el patrón I ya arranca cerca,
el acercamiento entre las dos tomas tiene que notarse aunque sea sutil — si en la
generación real las dos salen prácticamente idénticas, el corte se lee como un salto de
edición en vez de un cambio de plano deliberado (regla 2 del montaje).

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida y contenida — el tono es de
   respeto, no de urgencia —, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las dos tiradas de Hospedín** y usar sólo la pista de voz de
   `voz.md`.
4. **Subtítulos palabra por palabra** en las dos tomas.
5. **Nada de transiciones.** Corte seco en los dos.

---

## Qué mirar al revisar las tomas

**Que las dos tiradas arranquen hablando en el frame 1**, sin respiro ni mirada previa.

**Que T1 no se estire de más**: no tiene sobrante, así que un arranque tardío obliga a
regenerar.

**Que el acercamiento entre T1 y T2 se note**, aunque sea leve — dos primeros planos
prácticamente iguales rompen la regla 2 del montaje.

**Que el círculo naranja quede completo dentro del cuadro** en las dos tomas — en primer
plano es el error más fácil de este patrón, según la propia ficha del fondo 39.

**Que el pedido quede sólo en la placa.** Ni S1 ni S2 tienen que sonar a captación: son
reconocimiento. Si en algún doblaje o subtítulo se cuela un "sumate" o "registrate"
antes de la placa, está mal — revisar contra esta regla antes de aprobar el corte.
