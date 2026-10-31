# V47 · Nadie te va a llamar para venderte nada — montaje

Prompts y montaje de **V47**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— una historia de 12 s armada con **dos tiradas de Hailuo y una tirada sólo por el
audio**. Le habla al **anfitrión**.

Usa el **patrón C** — reacción sin lip sync — sobre el **fondo 10**, el interior de un
restaurante al atardecer. Es puramente solo-personaje: **sin grabación de pantalla, sin
captura y sin ningún objeto en la mano**. Molde: [`../v38/montaje.md`](../v38/montaje.md)
(mismo patrón C, mismo mecanismo de voz en off).

---

## El diálogo completo

**Esto es lo que se escucha**, en off, de punta a punta. Hospedín nunca mueve la boca
para decir esto: es narración agregada en edición, no diálogo de las tomas — el patrón
C no lo permite nunca.

> Nadie te va a llamar para venderte nada.
>
> Te registrás cuando quieras, a tu ritmo, sin presión.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | Nadie te va a llamar para venderte nada. | T1 *(off)* | 14 | 2,5 s |
| **S2** | Te registrás cuando quieras, a tu ritmo, sin presión. | T2 *(off)* | 15 | 2,6 s |

**Hablado: 5,1 s de 12.** **Ninguna toma de Hospedín tiene diálogo**: es reacción pura,
sin boca que sincronizar, de punta a punta.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 |
| T2 | subtítulo palabra por palabra de S2 |
| T3 (placa) | **Nadie te llama. Vos avanzás cuando quieras.** seguido del logo y **hospeda.com.ar** |

> ⚠️ **Esto es una desactivación de desconfianza, no una promesa de proceso.** El video
> no dice qué SÍ pasa al registrarse —eso lo cubren otros videos de la serie (V11, ya
> del bloque anterior)—, sólo desactiva la suposición de que va a sonar el teléfono con
> un vendedor insistiendo. Es lo mismo que ya hace V39 con "no somos una app de
> reservas" y V44 con las cuatro cosas que se asumen mal.

---

## El patrón, el fondo y por qué no hay objeto

**Patrón C — reacción sin lip sync — sobre el fondo 10**, el interior de un restaurante
al atardecer: ningún fondo del 1 al 12 estaba repetido todavía en la serie, y el
registro cálido de un restaurante encaja con el tono cercano de "de anfitrión a
anfitrión" que ya usa el resto del plan para este tipo de mensaje.

**Sin objeto.** El fondo 10 muestra a Hospedín sosteniendo un celular vacío en la mano —
como los otros once fondos de este bloque —, pero acá **las dos manos quedan libres**:
no sostiene nada, ni celular ni ningún otro accesorio. El mensaje es puramente actuado
con la cara y el cuerpo — primero un gesto de cautela, después el alivio de que no pasa
nada —, nunca con una pantalla en cuadro.

> **La gente del fondo 10 va desenfocada y casi quieta** en las dos tomas —está en la
> lista de fondos con gente de [`../fondos.md`](../fondos.md#dos-cosas-que-se-rompen-al-animar)—:
> si el modelo la anima, le roba atención a la reacción de Hospedín, que es todo el
> video.

---

## El montaje — 12 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–3,0 | 3,0 | Hailuo · `@######ESCENA10#######` | entero (tal cual la referencia) | sin diálogo: mirada cautelosa hacia un costado, como quien espera que suene el teléfono con una llamada que no quiere | *(off)* "Nadie te va a llamar para venderte nada." |
| **T2** | 3,0–6,0 | 3,0 | Hailuo · `@######ESCENA10#######` | medio, más cerca | sin diálogo: los hombros se relajan, encogimiento de hombros con las palmas hacia arriba, sonrisa tranquila | *(off)* "Te registrás cuando quieras, a tu ritmo, sin presión." |
| **T3** | 6,0–12,0 | 6,0 | `placas/final.png` | placa | frase de cierre, logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Dos tiradas de Hailuo** —T1 y T2—, más **una tirada sólo por el audio** (ver
[`voz.md`](voz.md); las dos frases juntas son 5,1 s hablados, muy por debajo del límite
de 15 s de una sola generación).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 14 → 2,5 s ·
> S2 son 15 → 2,6 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 3,0 s | el gesto de cautela llega antes del mínimo |
| T2 | 4 s | 3,0 s | el gesto de alivio llega antes del mínimo |
| **voz** | 6 s | S1 + S2 (5,1 s de habla más una pausa corta) | cubre T1 y T2 enteros en una sola tirada |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 12,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 3,0 | 3,0 | tirada T1 · 4 s | 0,0 → 3,0 | 1,0 |
| **T2** | 3,0 → 6,0 | 3,0 | tirada T2 · 4 s | 0,0 → 3,0 | 1,0 |
| **T3** | 6,0 → 12,0 | 6,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *Nadie te va a llamar...* | 0,00 → 2,50 | 2,5 | T1 | 0,50 |
| **S2** *Te registrás cuando quieras...* | 3,00 → 5,60 | 2,6 | T2 | 0,40 |

> **La pista de voz sale de una sola tirada** (ver [`voz.md`](voz.md)): las dos frases
> entran juntas en 5,4 s de contenido, dentro de los 6 s pedidos. En edición se corta
> igual entre S1 y S2,
> colocando cada una en su lugar — no se pega como bloque único.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 3,0 | T1 → T2 | entero, cautela → medio más cerca, alivio | bajo |
| 6,0 | T2 → T3 | medio → placa | bajo |

**Ningún corte de este video es de riesgo alto**: las dos tomas están sobre el mismo
fondo y el personaje nunca desaparece del cuadro, así que el único cuidado real es que
el encuadre cambie lo suficiente entre T1 y T2 para que no se lea como una repetición —
ver la regla 2 del montaje en [`../README.md`](../README.md).

### Lo demás

1. **Música desde el frame 1**, instrumental, con un giro suave de tensión a calma en el
   corte de 3,0 s, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las dos tiradas de Hospedín** y usar sólo `voz.md`.
4. **Subtítulos palabra por palabra** en las dos tomas.
5. **Nada de transiciones.** Corte seco en los dos.

---

## Qué mirar al revisar las tomas

**Que ninguna de las dos tiradas hable.** Es el riesgo central del patrón C: con una
cara mirando a cámara, lo primero que un modelo inventa es que hable. Si T1 o T2 mueven
la boca como si dijeran algo, la toma no sirve.

**Que las dos manos queden libres en las dos tomas**, sin celular y sin ningún otro
accesorio.

**Que T1 se lea como cautela, nunca como miedo real ni enojo.** La sección 5 de la
biblia pone el límite: cauteloso sí, angustiado o agresivo no.

**Que T2 sea un alivio simpático y liviano**, con el encogimiento de hombros bien
legible — es el gesto que hace todo el trabajo de "no hay presión".

**Que la gente de fondo del restaurante quede desenfocada y casi quieta** en las dos
tomas.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.
