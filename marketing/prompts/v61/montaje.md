# V61 · Guardátelo para cuando lo necesites — montaje

Prompts y montaje de **[V61](../../plan-videos.md#p2--doce-videos)**: una publicación de
21 s armada con **tres tiradas de Hailuo con diálogo, una tirada silenciosa y la placa de
cierre**.

Usa el **patrón D** —objeto en la mano, la mochila— sobre el **fondo 5**, el palmar.
Molde: [`../v14/montaje.md`](../v14/montaje.md) y [`../v23/montaje.md`](../v23/montaje.md)
para el reemplazo del celular por la mochila.

> ⚠️ **Esto es un argumento, no una demostración.** El video habla de la idea de guardar
> algo que te gustó para cuando estés listo — nunca describe ni muestra la interfaz de
> favoritos. Ningún prompt de este video menciona un botón, un ícono de corazón ni ningún
> otro elemento de pantalla.

---

## El diálogo completo

> A veces ves algo que te gusta, pero no es el momento.
>
> Guardalo. Después lo tenés ahí, esperándote.
>
> Cuando vuelvas a pensarlo, ya vas a saber por dónde arrancar.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | A veces ves algo que te gusta, pero no es el momento. | T1 | 18 | 3,16 s |
| **S2** | Guardalo. Después lo tenés ahí, esperándote. | T2 | 15 | 2,63 s |
| **S3** | Cuando vuelvas a pensarlo, ya vas a saber por dónde arrancar. | T3 | 19 | 3,33 s |
| — | *(remate visual, sin voz)* | T4 | — | — |

**Hablado: 9,1 s de 21,0.** Las tres frases entran cómodas en una sola tirada de voz —ver
[`voz.md`](voz.md)—, así que no hace falta partirla en dos.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 |
| T2 | subtítulo palabra por palabra de S2 |
| T3 | subtítulo palabra por palabra de S3 |
| T5 (placa) | **Guardátelo para cuando lo necesites.** seguido del logo y **hospeda.com.ar** |

---

## El patrón, el fondo y el objeto

**Patrón D — objeto en la mano — sobre el fondo 5**, el palmar. El fondo 5
(`escena5.png`) muestra a Hospedín con un **celular** en la mano: en las cuatro tiradas de
este video —T1 a T4— se lo reemplaza por la **mochila** del patrón D, tal como ya hacen
[V23](../v23/montaje.md) con el fondo 4.

**La mochila está entre las poses aprobadas de `acciones.png`** — "CON MOCHILA: con una
mochila de viaje puesta en la espalda". No hace falta describir un objeto nuevo: el
prompt referencia `@######ACCIONES#######` directamente para esa pose.

**Va en la espalda, no en la mano.** Eso deja las dos manos libres, así que T1 a T3 pueden
usar gestos sin que la mochila estorbe — el mismo criterio que ya usa V23.

> ⚠️ **El fondo 5 lleva un cartel legible**: dice «PALMARES DEL LITORAL». Se ve entero en
> T1, el encuadre de establecimiento; en T2 y T3 el acercamiento progresivo ya lo saca de
> cuadro por su cuenta, así que solo T1 necesita pedir explícitamente que el texto se
> reproduzca letra por letra.

**Cuatro tomas, el mismo lugar, cada vez más cerca**: T1 es el encuadre de
establecimiento tal cual la referencia; T2 se acerca un poco; T3 cierra más cerca
todavía, hablando; T4 es un remate silencioso en primer plano, ajustándose la mochila. Es
el mismo recurso de zoom progresivo que usa [V40](../v40/montaje.md), para que el video dé
acción y escenario real en vez de un personaje estático — la lección del piloto de V9.

---

## El montaje — 21,0 segundos, 4 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA5#######` | entero (tal cual la referencia) | con la mochila puesta, habla, mira algo que le llama la atención | *"A veces ves algo que te gusta, pero no es el momento."* |
| **T2** | 4,0–7,5 | 3,5 | Hailuo · `@######ESCENA5#######` | un poco más cerca | habla, una mano toca el tirante de la mochila | *"Guardalo. Después lo tenés ahí, esperándote."* |
| **T3** | 7,5–11,5 | 4,0 | Hailuo · `@######ESCENA5#######` | más cerca todavía | habla el remate, gesto abierto y seguro | *"Cuando vuelvas a pensarlo, ya vas a saber por dónde arrancar."* |
| **T4** | 11,5–15,5 | 4,0 | Hailuo · `@######ESCENA5#######` | primer plano | sin diálogo: se acomoda el tirante y sonríe | — (beat visual) |
| **T5** | 15,5–21,0 | 5,5 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Tres tiradas de Hailuo con diálogo** —T1, T2 y T3—, **una tirada silenciosa** —T4— y
**una sola tirada de voz** (ver [`voz.md`](voz.md); las tres frases juntas son 9,1 s,
bien por debajo del techo de 15 s).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 18 → 3,16 s ·
> S2 son 15 → 2,63 s · S3 son 19 → 3,33 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 5 s | 4,0 s | la frase son 3,16 s |
| T2 | 4 s | 3,5 s | la frase son 2,63 s |
| T3 | 5 s | 4,0 s | la frase son 3,33 s |
| T4 | 4 s | 4,0 s | es un beat visual, no hay frase — sin margen de recorte |
| **voz** | 12 s | S1 + S2 + S3 (9,1 s de contenido) | cubre T1, T2 y T3 enteras |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 21,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 5 s | 0,0 → 4,0 | 1,0 |
| **T2** | 4,0 → 7,5 | 3,5 | tirada T2 · 4 s | 0,0 → 3,5 | 0,5 |
| **T3** | 7,5 → 11,5 | 4,0 | tirada T3 · 5 s | 0,0 → 4,0 | 1,0 |
| **T4** | 11,5 → 15,5 | 4,0 | tirada T4 · 4 s | 0,0 → 4,0 | 0,0 |
| **T5** | 15,5 → 21,0 | 5,5 | `placas/final.png` | fijo | — |

> **T4 se usa entera**: no hay sobrante para corregir un arranque tardío del gesto. Si la
> generación real trae un respiro antes de empezar a acomodarse el tirante, hay que volver
> a generar.

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *A veces ves algo...* | 0,00 → 3,16 | 3,16 | T1 | 0,84 |
| **S2** *Guardalo. Después...* | 4,00 → 6,63 | 2,63 | T2 | 0,87 |
| **S3** *Cuando vuelvas a pensarlo...* | 7,50 → 10,83 | 3,33 | T3 | 0,67 |

> **La pista de voz NO se pega como un bloque único.** Se corta entre cada frase y cada
> una se posiciona en su lugar, aunque las tres salgan de la misma tirada de
> [`voz.md`](voz.md).

### Los cuatro cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → T2 | entero con mochila → un poco más cerca | bajo |
| 7,5 | T2 → T3 | un poco más cerca → más cerca todavía | bajo |
| 11,5 | T3 → T4 | hablando más cerca → primer plano silencioso | bajo |
| 15,5 | T4 → T5 | primer plano → placa | bajo |

**Ningún corte de este video es de riesgo alto**: el lugar no cambia en ningún momento y
el personaje nunca desaparece del cuadro, así que el único cuidado real es que cada
acercamiento se note lo suficiente como para no sentirse un salto entre planos iguales —
ver la regla 2 del montaje en [`../README.md`](../README.md).

### Lo demás

1. **Música desde el frame 1**, instrumental, liviana y cálida, con un aire despreocupado
   —el tono es "no hay apuro"—, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las cuatro tiradas de Hospedín** y usar sólo la pista de voz de
   [`voz.md`](voz.md).
4. **Subtítulos palabra por palabra** en T1, T2 y T3.
5. **Nada de transiciones.** Corte seco en los cuatro.

---

## Qué mirar al revisar las tomas

**Que la mochila se vea igual en las cuatro tiradas**: mismo tamaño, mismos tirantes,
puesta en el mismo lugar de la espalda.

**Que las tres tiradas con diálogo arranquen hablando en el frame 1**, sin respiro ni
mirada previa.

**Que T1 y T4 terminen exactamente donde dice el TIMING**: T1 tiene apenas 1,0 s de
sobra y T4 no tiene ninguna, así que si el arranque o el gesto se estiran no hay margen
para corregir en corte.

**Que el cartel del fondo 5 se lea «PALMARES DEL LITORAL» completo y sin errores en T1**,
la única toma donde queda en cuadro. Si sale mal, se tapa en edición o se regenera —no
entra a la timeline con el cartel deformado.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las cuatro.

**Que el video no describa ni sugiera ninguna pantalla.** Es puramente conceptual: si en
edición aparece la tentación de agregar un ícono o un botón superpuesto, no entra.
