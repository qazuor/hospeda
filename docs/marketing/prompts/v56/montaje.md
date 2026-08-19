# V56 · No te pedimos nada para mirar — montaje

Prompts y montaje de **V56**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— una historia de 18 s armada con **tres tiradas de Hailuo, una tirada sólo por el
audio y la placa de cierre**. Usa el **patrón C** — la reacción sin lip sync — sobre el
**fondo 12**, la lancha de pesca. Molde: [`../v21/montaje.md`](../v21/montaje.md).

**Hospedín no habla nunca en cámara.** Reacciona con el candado abierto en la mano;
todo el mensaje va en la voz en off y en el texto en pantalla.

> **El fondo 12 llega con una caña de pescar en la mano** — en las tres tiradas se
> reemplaza por el candado abierto de `acciones2.png`, que es el objeto de este video.
> Ninguna toma puede dejar la caña en cuadro: el reemplazo se declara explícito en cada
> prompt, igual que hace [V14](../v14/montaje.md) con la lamparita sobre el fondo 4.

---

## El mensaje

**Esto es lo que se escucha**, en off, de punta a punta. Hospedín nunca mueve la boca
para decir esto: es narración agregada en edición, no diálogo de las tomas.

> Podés mirar todo el catálogo sin crear una cuenta.
>
> Sirve para guardar lo que te gustó, pero es opcional.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Podés mirar todo el catálogo sin crear una cuenta. | T1 | 18 | 3,16 s |
| **F2** | Sirve para guardar lo que te gustó, pero es opcional. | T2-T3 | 17 | 2,98 s |

**Hablado: 6,1 s de 18.** El resto es la reacción con el candado, el remate silencioso
de T3 y la placa de cierre.

Y lo que se **lee** en pantalla, que no se dice en voz:

| Cuándo | Texto |
|---|---|
| T1 | **No te pedimos nada para mirar.** |
| T2 | subtítulo palabra por palabra de F1 y F2 |
| T3 | **Sin cuenta. Sin mail. Sin registro.** (refuerzo, sin voz) |
| T4 (placa) | **No te pedimos nada para mirar.** + logo + **Probá ahora en hospeda.com.ar** |

> ⚠️ **No se menciona ninguna forma de pago.** El video habla de mirar el catálogo, no
> de registrarse para una prueba: no corresponde la frase "sin tarjeta" en ningún lado,
> y no se usa.

---

## Por qué patrón C acá

**El candado abierto es el argumento visual**, no un discurso. Igual que V21 con el
logo de Mercado Pago, patrón C —sin lip sync— dedica el plano a que el objeto se lea
bien en vez de a que la boca se mueva, y es el patrón más barato en acciones, así que el
plano puede sostenerse más tiempo sin que el personaje derive.

**Igual lleva `voz.md`.** Aunque Hospedín no hable en cámara en ninguna toma, la
narración se genera con la misma técnica que el resto de la serie —una tirada aparte,
solo por el audio— para que el timbre sea el mismo Hospedín de siempre.

---

## El fondo y el objeto

**Fondo 12**, la lancha de pesca — el único fondo del bloque 1 a 12 que trae una caña en
la mano. El candado reemplaza esa caña en las tres tiradas: mismo lugar en la mano,
mismo tamaño relativo, sin tapar la cara ni el logo.

**El candado**: el de `acciones2.png` — un candado simple, ABIERTO, con el arco
levantado y separado del cuerpo. Sostenido en alto con una mano, a la altura del pecho,
en el mismo lugar donde el fondo 12 le pone la caña. Tiene que leerse abierto sin
ambigüedad en las tres tomas: es lo único que sostiene el argumento del video.

**Tres tomas, la misma base, cada vez más cerca**: T1 es el encuadre entero de la
referencia, con la lancha y el río bien presentes; T2 se acerca y sube el candado hacia
cámara; T3 cierra en primer plano, sin el candado en cuadro, para el remate — el mismo
recurso de acercamiento progresivo que usa [V40](../v40/montaje.md).

---

## El montaje — 18 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA12#######` | entero (tal cual la referencia) | mira el candado, curioso, después a cámara | *(off)* "Podés mirar todo el catálogo sin crear una cuenta." |
| **T2** | 4,0–9,0 | 5,0 | Hailuo · `@######ESCENA12#######` | más cerca | levanta el candado hacia cámara, bien abierto, asiente | *(off)* "Sirve para guardar lo que te gustó, pero es opcional." |
| **T3** | 9,0–13,0 | 4,0 | Hailuo · `@######ESCENA12#######` | primer plano | sonrisa cálida, sin objeto en cuadro, sostiene | — (solo música) |
| **T4** | 13,0–18,0 | 5,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Ninguna toma de Hospedín tiene diálogo.** Las tres son reacción pura —bloque
`NO DIALOGUE` en los tres prompts—, así que no llevan `BOCAS` como referencia: no hay
boca que sincronizar. La narración entera vive en `voz.md` y se pega encima en edición.

**Tres tiradas de Hailuo** —T1, T2 y T3—, más **una tirada sólo por el audio** (ver
[`voz.md`](voz.md); el guion completo son 6,1 s hablados, entra entero en una sola
generación).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: F1 son 18 → 3,16 s ·
> F2 son 17 → 2,98 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 4,0 s | reacción inicial, se usa entera |
| T2 | 6 s | 5,0 s | el gesto de levantar el candado más el gancho de F2 |
| T3 | 4 s | 4,0 s | remate silencioso, se usa entera |
| **voz** | 9 s | F1 + F2 (6,1 s de contenido) | cubre T1, T2 y T3 |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 18,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 4 s | 0,0 → 4,0 | 0,0 |
| **T2** | 4,0 → 9,0 | 5,0 | tirada T2 · 6 s | 0,0 → 5,0 | 1,0 |
| **T3** | 9,0 → 13,0 | 4,0 | tirada T3 · 4 s | 0,0 → 4,0 | 0,0 |
| **T4** | 13,0 → 18,0 | 5,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** *Podés mirar todo...* | 0,00 → 3,16 | 3,16 | T1 | 0,84 |
| **F2** *Sirve para guardar...* | 4,20 → 7,18 | 2,98 | T2 | 1,82 hasta T3 |

> F2 no arranca en el mismo instante del corte a T2: hay **0,2 s de asentamiento** antes
> de que la voz retome, mismo criterio que usa V21 en su corte T1→T2. El resto de T2 y
> todo T3 quedan como sostenido silencioso, con el refuerzo de texto en pantalla.
>
> ⚠️ **La pista de voz NO se pega como un bloque único.** Se corta entre F1 y F2 y cada
> una se posiciona en su lugar — ver [`voz.md`](voz.md).

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → T2 | entero con el candado → más cerca, candado en alto | bajo |
| 9,0 | T2 → T3 | más cerca → primer plano, sin objeto | medio |
| 13,0 | T3 → T4 | primer plano → placa | bajo |

**T2 → T3 es el corte a cuidar**: el candado desaparece de cuadro porque T3 es un
primer plano de remate. Se resuelve por ritmo — la sonrisa de T2 ya empezó a instalarse
antes del corte, así que T3 se lee como continuación del mismo gesto, no como un salto
de tema.

### Lo demás

1. **Música desde el frame 1**, instrumental, liviana y directa —el tono es "no hay
   nada que temer, mirá tranquilo"—, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las tres tiradas de Hospedín** y usar sólo la pista de voz de
   `voz.md`.
4. **Subtítulos palabra por palabra** en T1 y T2.
5. **Nada de transiciones.** Corte seco en los tres.

---

## Qué mirar al revisar las tomas

**Que ninguna de las tres tiradas hable.** Es el riesgo central del patrón C: con una
cara mirando a cámara, lo primero que un modelo inventa es que hable. Si se mueve la
boca como si dijera algo, la toma no sirve.

**Que el candado se lea abierto en T1 y T2**, sin ambigüedad, con el arco separado del
cuerpo. Un candado que se lee cerrado dice exactamente lo contrario del video.

**Que la caña de pescar de la referencia no aparezca en ninguna toma.**

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las tres.

**Que el video no mencione ninguna forma de pago ni la palabra "tarjeta".** Es un video
sobre navegar sin cuenta, no sobre el período de prueba.
