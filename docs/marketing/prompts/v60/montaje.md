# V60 · No hace falta ir lejos — montaje

Prompts y montaje de **V60**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— un corto de 16 s armado con **tres tiradas de Hailuo y una tirada sólo por el
audio**. Usa la combinación **L → C** — plano general que abre, reacción sin lip sync
que cierra — sobre el **fondo 40**, el pasillo de palmeras. Molde de la combinación:
[`../../patrones-de-puesta-en-escena.md`](../../patrones-de-puesta-en-escena.md#cómo-se-combinan).

**Hospedín no habla nunca en cámara.** Reacciona en silencio; todo el mensaje va en la
voz en off y en el texto en pantalla.

---

## Por qué L → C

**El fondo 40 es plano general**: Hospedín aparece chico, a un cuarto del alto de la
imagen, rodeado de troncos de palmera. La propia ficha del fondo lo dice —"a esta
escala la cara no se lee, y está bien"—, así que un plano hablado ahí desperdicia el
lip sync sin que nadie lo vea. La combinación **L → C** resuelve esto de la forma que
recomienda [`patrones-de-puesta-en-escena.md`](../../patrones-de-puesta-en-escena.md):
el plano general funciona como **apertura**, y el video cierra acercándose sin que en
ningún momento haga falta que hable — el mismo criterio que exige la regla
"L con diálogo no combina" de esa misma guía.

**Igual lleva `voz.md`.** El mensaje entero vive en una narración agregada en edición,
igual que en el resto de los videos de patrón C.

---

## El mensaje

**Esto es lo que se escucha**, en off, de punta a punta. Hospedín nunca mueve la boca
para decir esto: es narración agregada en edición, no diálogo de las tomas.

> A veces lo que buscás está mucho más cerca de lo que pensás.
>
> No hace falta ir lejos para tener un buen fin de semana.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | A veces lo que buscás está mucho más cerca de lo que pensás. | T1 | 19 | 3,33 s |
| **F2** | No hace falta ir lejos para tener un buen fin de semana. | T2 | 19 | 3,33 s |

**Hablado: 6,7 s de 16.** El resto es el acercamiento del pasillo de palmeras, el
remate silencioso de T3 y la placa de cierre.

Y lo que se **lee** en pantalla, que no se dice en voz:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de F1 |
| T2 | subtítulo palabra por palabra de F2 |
| T3 | **No hace falta ir lejos.** (refuerzo, sin voz) |
| T4 (placa) | **No hace falta ir lejos.** + logo + **hospeda.com.ar** |

> ⚠️ **Ningún destino se nombra.** El video habla de la cercanía en general, nunca de
> un lugar puntual: el palmar es escenario, no el tema del video.

---

## El patrón y el fondo

**Fondo 40**, el pasillo de palmeras — el fondo asignado específicamente a este video.
La referencia trae a Hospedín chico, de espaldas parciales, mirando hacia el fondo del
pasillo: la toma de apertura usa esa misma composición tal cual, sin acercar.

**Sin objeto.** Los brazos quedan apenas separados del cuerpo, sin sostener nada, en
las tres tomas.

**Tres tomas, cada vez más cerca, dentro del mismo pasillo de palmeras**: T1 es el
plano general de la referencia; T2 recorta más cerca, todavía entre los troncos,
suficientemente cerca como para que la reacción se lea; T3 cierra más cerca todavía,
sobre el remate. Es la misma técnica de encuadre progresivo que usa
[V8](../v8/t1.md) para acercarse desde un fondo que arranca más abierto.

---

## El montaje — 16 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA40#######` | general (tal cual la referencia) | camina un paso, mira alrededor | *(off)* "A veces lo que buscás está mucho más cerca de lo que pensás." |
| **T2** | 4,0–8,0 | 4,0 | Hailuo · `@######ESCENA40#######` | más cerca, dentro del mismo pasillo | se da vuelta hacia cámara, sonríe | *(off)* "No hace falta ir lejos para tener un buen fin de semana." |
| **T3** | 8,0–11,0 | 3,0 | Hailuo · `@######ESCENA40#######` | más cerca todavía | sostiene la sonrisa, sin objeto en cuadro | — (solo música) |
| **T4** | 11,0–16,0 | 5,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Ninguna toma de Hospedín tiene diálogo.** Las tres son reacción pura —bloque
`NO DIALOGUE` en los tres prompts—, así que no llevan `BOCAS` como referencia: no hay
boca que sincronizar. La narración entera vive en `voz.md` y se pega encima en
edición.

**Tres tiradas de Hailuo** —T1, T2 y T3—, más **una tirada sólo por el audio** (ver
[`voz.md`](voz.md); el guion completo son 6,7 s hablados, entra entero en una sola
generación).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: F1 son 19 → 3,33 s ·
> F2 son 19 → 3,33 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 4,0 s | apertura, se usa entera |
| T2 | 4 s | 4,0 s | el giro hacia cámara más el gancho de F2 |
| T3 | 4 s | 3,0 s | remate silencioso |
| **voz** | 9 s | F1 + F2 (6,7 s de contenido) | cubre las tres tomas |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 16,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 4 s | 0,0 → 4,0 | 0,0 |
| **T2** | 4,0 → 8,0 | 4,0 | tirada T2 · 4 s | 0,0 → 4,0 | 0,0 |
| **T3** | 8,0 → 11,0 | 3,0 | tirada T3 · 4 s | 0,0 → 3,0 | 1,0 |
| **T4** | 11,0 → 16,0 | 5,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** *A veces lo que buscás...* | 0,00 → 3,33 | 3,33 | T1 | 0,67 |
| **F2** *No hace falta ir lejos...* | 4,20 → 7,53 | 3,33 | T2 | 0,47 |

> F2 no arranca en el mismo instante del corte a T2: hay **0,2 s de asentamiento** antes
> de que la voz retome, mismo criterio que usa V21 en su corte T1→T2.
>
> ⚠️ **La pista de voz NO se pega como un bloque único.** Se corta entre F1 y F2 y cada
> una se posiciona en su lugar — ver [`voz.md`](voz.md).

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → T2 | plano general → más cerca, dentro del mismo pasillo | medio |
| 8,0 | T2 → T3 | más cerca → más cerca todavía | bajo |
| 11,0 | T3 → T4 | más cerca todavía → placa | bajo |

**T1 → T2 es el corte a cuidar**: es el salto más grande de escala del video, de plano
general a un recorte donde ya se lee la cara. Se resuelve manteniendo el mismo pasillo
de palmeras y la misma luz en las dos tomas, así el corte se lee como un acercamiento
dentro del mismo lugar y no como un cambio de escena.

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida y sin apuro — el tono es de una
   escapada simple, no de un anuncio—, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las tres tiradas de Hospedín** y usar sólo la pista de voz de
   `voz.md`.
4. **Subtítulos palabra por palabra** en T1 y T2.
5. **Nada de transiciones.** Corte seco en los tres.

---

## Qué mirar al revisar las tomas

**Que ninguna de las tres tiradas hable.** Es el riesgo central del patrón C: con una
cara mirando a cámara, lo primero que un modelo inventa es que hable. Si en T2 o T3 se
mueve la boca como si dijera algo, la toma no sirve.

**Que el pasillo de palmeras se mantenga reconocible entre T1 y T2** pese al cambio de
escala: mismos troncos, misma luz filtrada, mismo pastizal.

**Que en T1 la cara no tenga que leerse** — es plano general a propósito, y forzar
detalle facial ahí no suma nada.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las tres, ni en T1 se
pierda contra el fondo de troncos.
