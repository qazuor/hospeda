# V28 · Directorio de oficios — montaje

Prompts y montaje de **[V28](../../plan-videos.md#v28--directorio-de-oficios)**, versión
**anfitrión**: un **corto de 20 s** armado con **dos tiradas de Hailuo, grabación de
pantalla y la placa de cierre**. Historia y WhatsApp.

Sigue el molde de [`v9/montaje.md`](../v9/montaje.md), pero con **patrón C — sin lip
sync**: Hospedín no habla en cámara en ningún momento de este video. Todo el mensaje va
en voz en off y texto en pantalla, mientras él reacciona.

---

## Dos versiones, un solo montaje

El plan de videos pide **dos versiones del mismo material**, con objetivos distintos:

- **Para oficios**: *"¿Sos plomero, gasista o electricista? Los alojamientos de la zona
  te necesitan."*
- **Para anfitriones**: mostrar el beneficio — la que tiene guion de voz en off escrito,
  y la que se monta acá.

Este documento monta **solo la versión anfitrión**, porque es la única con voz en off ya
redactada en el plan. **La versión para oficios reutiliza exactamente las mismas dos
tiradas de Hailuo** (`t1.md` y `t3.md`) — la cara de problema y la cara de alivio sirven
para cualquiera de los dos mensajes, porque el patrón C no tiene diálogo que cambiar—, y
sólo cambia:

- la **voz en off** (un guion propio, todavía sin escribir, con el gancho *"¿Sos plomero,
  gasista o electricista?..."*),
- el **texto en pantalla** sobre T2,
- y el **CTA** de la placa final.

**El plan también aclara el orden de publicación**: *"la versión para oficios va
primero: sin oficios cargados, el beneficio no existe."* O sea que aunque este documento
monte primero la versión anfitrión por tener el guion escrito, **la que sale a producción
primero es la de oficios**.

---

## El diálogo completo

Voz en off del [plan de videos](../../plan-videos.md#v28--directorio-de-oficios), versión
anfitrión, sin cambios:

> Se rompió el termotanque un domingo a la mañana.
>
> En Hospeda tenés un directorio de oficios de confianza de la zona, con las
> valoraciones de otros anfitriones que ya los llamaron.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Se rompió el termotanque un domingo a la mañana. | T1 | 17 | 3,0 s |
| **F2** | En Hospeda tenés un directorio de oficios de confianza de la zona, con las valoraciones de otros anfitriones que ya los llamaron. | T2 | 43 | 7,54 s |
| — | *(sin voz, el alivio se asienta)* | T3 | — | ~3,0 s |

**Hablado: 10,54 s de 20 (53%).** Nunca hay lip sync que sincronizar, así que la
proporción no importa tanto como en los patrones hablados — lo que manda acá es que la
reacción de Hospedín *lea* sola, sin sonido, como pide la regla 1 del plan de videos.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de F1 |
| T2 | subtítulo palabra por palabra de F2 |
| T4 | **Sumate en hospeda.com.ar** |

---

## Puesta en escena

**Patrón C · reacción, sin lip sync**, fondo **17 · primer plano**
([`../fondos.md`](../fondos.md#17--primer-plano--patrón-i)), por asignación de la tabla
[Puesta en escena por video](../../plan-videos.md#puesta-en-escena-por-video): *"cara de
problema y alivio, sin diálogo."* Es uno de los tres videos —junto con V4 y V16— que usa
las **cinco caras negativas** de `expresiones.png` (`fastidio`, `molesto`, `agobio`,
`susto`, `preocupación`), documentadas en
[`patrones-de-puesta-en-escena.md`](../patrones-de-puesta-en-escena.md#c--la-reacción--sin-lip-sync).
**Molesto sí, agresivo no**: T1 usa `PREOCUPACIÓN`, nunca una cara de enojo.

`escena17` es el fondo genérico de exterior desenfocado — no se reconoce ningún lugar
concreto, así que sirve igual para las dos tomas sin que el video necesite "estar" en
ningún sitio particular: el problema (el termotanque) pasa en la casa del anfitrión, no
en la playa.

---

## El montaje — 20 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–3,5 | 3,5 | Hailuo · `@######ESCENA17#######` | primer plano | cara de problema: se lleva una mano a la cabeza | *"Se rompió el termotanque un domingo a la mañana."* |
| **T2** | 3,5–11,5 | 8,0 | **grabación** · A9 | pantalla | directorio de oficios, scroll | *"En Hospeda tenés un directorio de oficios de confianza de la zona, con las valoraciones de otros anfitriones que ya los llamaron."* |
| **T3** | 11,5–15,0 | 3,5 | Hailuo · `@######ESCENA17#######` | primer plano | cara de alivio, sonríe | — (solo música) |
| **T4** | 15,0–20,0 | 5,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

**Dos tiradas de Hailuo** —T1 y T3—, más **una tirada solo por el audio** (ver
[`voz.md`](voz.md), que entra entera en los 15 s de Hailuo). T2 es grabación de pantalla
y no se genera.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 3,5 s | la frase son 3,0 s |
| T3 | 4 s | 3,5 s | reacción silenciosa, corta a propósito |
| **voz** | **15 s** | sólo el audio | el guion entero son ~10,9 s: se pide el máximo para que no trunque la última frase |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 20,0 s.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip |
|---|---|:-:|---|---|
| **T1** | 0,0 → 3,5 | 3,5 | tirada T1 · 4 s | 0,0 → 3,5 |
| **T2** | 3,5 → 11,5 | 8,0 | grabación · A9 | a elección |
| **T3** | 11,5 → 15,0 | 3,5 | tirada T3 · 4 s | 0,0 → 3,5 |
| **T4** | 15,0 → 20,0 | 5,0 | `placas/final.png` | fijo |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 3,00 | 3,0 | T1 | 0,50 |
| **F2** | 3,50 → 11,04 | 7,54 | T2 | 0,46 |

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 3,5 | T1 → T2 | primer plano → pantalla | bajo |
| 11,5 | T2 → T3 | pantalla → primer plano | bajo: la regla 2 se cumple |
| 15,0 | T3 → T4 | primer plano → placa | bajo |

### Lo demás

1. **Música desde el frame 1**, instrumental, con un giro de tensión→alivio hacia la
   mitad, 120 BPM.
2. **Tirar el audio de las dos tiradas de Hailuo** y usar solo la pista de voz.
3. **Subtítulos palabra por palabra**, dentro de la zona segura — acá pesan más que en
   ningún otro video del lote, porque no hay lip sync que ayude a seguir el mensaje.
4. **Nada de transiciones.** Corte seco en los tres.

---

## Qué mirar al revisar las tomas

**Que `PREOCUPACIÓN` en T1 se lea como problema, no como enojo.** La sección 5 de la
biblia es explícita: molesto sí, agresivo no.

**Que T3 no repita la misma pose de T1** apenas invertida — tiene que sentirse como un
alivio genuino, no como el mismo fotograma con otra cara pegada encima.

**Que el círculo naranja entre completo en el cuadro** en las dos tomas, como pide
`escena17`.
