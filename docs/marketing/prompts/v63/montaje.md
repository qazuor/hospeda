# V63 · Un alojamiento no te llama una vez sola — montaje

Prompts y montaje de **[V63](../../plan-videos.md#p3--once-videos)**: una publicación de
23 s armada con **tres tiradas de Hailuo con diálogo, una tirada silenciosa y la placa de
cierre**.

Usa el **patrón D** —objeto en la mano, la llave inglesa— sobre el **fondo 1**, la cabaña
del Litoral. Le habla al que hace el oficio: plomero, electricista, el que arregla.
Molde: [`../v14/montaje.md`](../v14/montaje.md) y [`../v23/montaje.md`](../v23/montaje.md)
para el reemplazo del celular por el objeto del patrón D.

---

## El diálogo completo

> Esto es para el plomero, el electricista, el que arregla lo que se rompe.
>
> Un alojamiento que te llama una vez, te vuelve a llamar.
>
> No sos una changa suelta. Sos el que ya conocen y en el que confían.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | Esto es para el plomero, el electricista, el que arregla lo que se rompe. | T1 | 26 | 4,56 s |
| **S2** | Un alojamiento que te llama una vez, te vuelve a llamar. | T2 | 19 | 3,33 s |
| **S3** | No sos una changa suelta. Sos el que ya conocen y en el que confían. | T3 | 22 | 3,86 s |
| — | *(remate visual, sin voz)* | T4 | — | — |

**Hablado: 11,8 s de 23,0.** Las tres frases entran cómodas en una sola tirada de voz —
ver [`voz.md`](voz.md).

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 |
| T2 | subtítulo palabra por palabra de S2 |
| T3 | subtítulo palabra por palabra de S3 |
| T5 (placa) | **Un alojamiento no te llama una vez sola.** seguido del logo y **hospeda.com.ar** |

---

## El patrón, el fondo y el objeto

**Patrón D — objeto en la mano — sobre el fondo 1**, la cabaña del Litoral. El fondo 1
(`escena1.png`) muestra a Hospedín con un **celular** en la mano: en las cuatro tiradas de
este video —T1 a T4— se lo reemplaza explícitamente por la **llave inglesa** de plomero.

**La llave inglesa está entre las poses de `acciones2.png`** — "CON LA LLAVE INGLESA:
sosteniendo con una mano una llave inglesa de plomero, en actitud de oficio resuelto".
`acciones2.png` es una lámina nueva, todavía sin generar: el prompt la referencia igual,
con el marcador `@######ACCIONES2#######`, exactamente como los videos que ya usan
`acciones.png` referencian sus poses.

**Va en una mano, en alto a la altura del pecho** —el mismo lugar donde el fondo 1 pone el
celular—, dejando la otra mano libre para gesticular.

---

## El montaje — 23 segundos, 4 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,0 | 5,0 | Hailuo · `@######ESCENA1#######` | entero (tal cual la referencia) | con la llave inglesa en alto, habla | *"Esto es para el plomero, el electricista, el que arregla lo que se rompe."* |
| **T2** | 5,0–9,0 | 4,0 | Hailuo · `@######ESCENA1#######` | un poco más cerca | habla, asiente convencido | *"Un alojamiento que te llama una vez, te vuelve a llamar."* |
| **T3** | 9,0–13,5 | 4,5 | Hailuo · `@######ESCENA1#######` | más cerca todavía | habla el remate, sonríe con seguridad | *"No sos una changa suelta. Sos el que ya conocen y en el que confían."* |
| **T4** | 13,5–17,5 | 4,0 | Hailuo · `@######ESCENA1#######` | primer plano | sin diálogo: levanta un poco más la llave y sonríe | — (beat visual) |
| **T5** | 17,5–23,0 | 5,5 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Tres tiradas de Hailuo con diálogo** —T1, T2 y T3—, **una tirada silenciosa** —T4— y
**una sola tirada de voz** (ver [`voz.md`](voz.md); las tres frases juntas son 11,8 s,
por debajo del techo de 15 s).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 26 → 4,56 s ·
> S2 son 19 → 3,33 s · S3 son 22 → 3,86 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 6 s | 5,0 s | la frase son 4,56 s |
| T2 | 5 s | 4,0 s | la frase son 3,33 s |
| T3 | 5 s | 4,5 s | la frase son 3,86 s |
| T4 | 4 s | 4,0 s | es un beat visual, no hay frase — sin margen de recorte |
| **voz** | 15 s | S1 + S2 + S3 (11,8 s de contenido) | cubre T1, T2 y T3 enteras |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 23,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,0 | 5,0 | tirada T1 · 6 s | 0,0 → 5,0 | 1,0 |
| **T2** | 5,0 → 9,0 | 4,0 | tirada T2 · 5 s | 0,0 → 4,0 | 1,0 |
| **T3** | 9,0 → 13,5 | 4,5 | tirada T3 · 5 s | 0,0 → 4,5 | 0,5 |
| **T4** | 13,5 → 17,5 | 4,0 | tirada T4 · 4 s | 0,0 → 4,0 | 0,0 |
| **T5** | 17,5 → 23,0 | 5,5 | `placas/final.png` | fijo | — |

> **T4 se usa entera**: no hay sobrante para corregir un arranque tardío del gesto. Si la
> generación real trae un respiro antes de levantar la llave, hay que volver a generar.

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *Esto es para el plomero...* | 0,00 → 4,56 | 4,56 | T1 | 0,44 |
| **S2** *Un alojamiento que te llama...* | 5,00 → 8,33 | 3,33 | T2 | 0,67 |
| **S3** *No sos una changa suelta...* | 9,00 → 12,86 | 3,86 | T3 | 0,64 |

> **La pista de voz NO se pega como un bloque único.** Se corta entre cada frase y cada
> una se posiciona en su lugar, aunque las tres salgan de la misma tirada de
> [`voz.md`](voz.md).

### Los cuatro cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,0 | T1 → T2 | entero con la llave → un poco más cerca | bajo |
| 9,0 | T2 → T3 | un poco más cerca → más cerca todavía | bajo |
| 13,5 | T3 → T4 | hablando más cerca → primer plano silencioso | bajo |
| 17,5 | T4 → T5 | primer plano → placa | bajo |

**Ningún corte de este video es de riesgo alto**: el lugar no cambia en ningún momento y
el personaje nunca desaparece del cuadro, así que el único cuidado real es que cada
acercamiento se note lo suficiente como para no sentirse un salto entre planos iguales —
ver la regla 2 del montaje en [`../README.md`](../README.md).

### Lo demás

1. **Música desde el frame 1**, instrumental, con energía de confianza tranquila —el tono
   es "de laburante a laburante", no de venta—, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las cuatro tiradas de Hospedín** y usar sólo la pista de voz de
   [`voz.md`](voz.md).
4. **Subtítulos palabra por palabra** en T1, T2 y T3.
5. **Nada de transiciones.** Corte seco en los cuatro.

---

## Qué mirar al revisar las tomas

**Que la llave inglesa se vea igual en las cuatro tiradas**: mismo tamaño, mismo color,
sostenida en el mismo lugar. Al salir de una lámina nueva sin generar todavía, es el
elemento con más riesgo de derivar entre generaciones — comparar las cuatro tiradas lado
a lado antes de aprobar.

**Que las tres tiradas con diálogo arranquen hablando en el frame 1**, sin respiro ni
mirada previa.

**Que T4 termine exactamente donde dice el TIMING**: no tiene sobrante para corregir un
arranque tardío.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las cuatro.

**Que el tono se sostenga de laburante a laburante**, nunca de venta ni de promesa de
clientes. El guion no dice que Hospeda consigue trabajo: dice que un alojamiento que ya
te llamó una vez vuelve a llamarte. Si en edición se agrega algo como "conseguí más
clientes", no entra.
