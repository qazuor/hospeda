# V31 · Guardá tus favoritos — montaje

Prompts y montaje de **[V31](../../plan-videos.md#v31--guardá-tus-favoritos)**: un corto
de 20 s armado con **dos tiradas de Hailuo, una grabación de pantalla y la placa de
cierre**.

Patrón **F** (sentado en la reposera), fondo **13** (playa). Turista planificando, sin
apuro — el registro que pide el patrón F.

---

## El diálogo completo

**Esto es lo que se escucha de punta a punta cuando el montaje está terminado**, en
orden y sin cortes.

> Mientras organizás el viaje encontrás varias opciones que querés comparar después.
>
> Guardalas en favoritos y tenelas a mano.
>
> Una cosa menos para acordarte entre veinte pestañas abiertas.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Mientras organizás el viaje encontrás varias opciones que querés comparar después. | T1 | 25 | 4,4 s |
| **F2** | Guardalas en favoritos y tenelas a mano. | T2 | 15 | 2,6 s |
| **F3** | Una cosa menos para acordarte entre veinte pestañas abiertas. | T3 | 22 | 3,9 s |

**Hablado: 10,9 s de 20.** El resto es la grabación de pantalla y la placa de cierre.

Y lo que se **lee** en pantalla, que no se dice en voz:

| Cuándo | Texto |
|---|---|
| T1 | **Guardá tus favoritos.** |
| T2–T3 | subtítulo palabra por palabra de F1, F2 y F3 |
| T5 | **Creá tu cuenta gratis en hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v31--guardá-tus-favoritos) y no
> se cambia acá.

---

> **Los marcadores de referencia van así**: `@######POSES#######`, no `@poses`. Cada toma
> arranca con la **tabla de reemplazos**, con el archivo que va en cada marcador y
> **cuántas veces aparece**.

---

## El montaje — 20 segundos, 4 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,0 | 5,0 | Hailuo · `@######ESCENA13#######` | medio corto, sentado | mira el celular en la falda y cuenta opciones con la mano libre | *"Mientras organizás el viaje encontrás varias opciones que querés comparar después."* |
| **T2** | 5,0–8,0 | 3,0 | **grabación** P12a | pantalla | se marcan varios alojamientos como favoritos | *"Guardalas en favoritos y tenelas a mano."* |
| **T3** | 8,0–12,5 | 4,5 | Hailuo · `@######ESCENA13#######` | medio corto, sentado | se hunde relajado en la reposera y abre la mano libre, aliviado | *"Una cosa menos para acordarte entre veinte pestañas abiertas."* |
| **T4** | 12,5–17,0 | 4,5 | **grabación** P12b | pantalla | los favoritos marcados, todos juntos en la cuenta | — (solo música) |
| **T5** | 17,0–20,0 | 3,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Mudo con el personaje en cuadro: 0 s de 20** — cada toma con Hospedín lleva su frase.

> **Dos tiradas de Hailuo para imagen** —T1 y T3—, más **una tercera sólo por el
> audio** (ver [`voz.md`](voz.md)). T2 y T4 son la misma grabación de pantalla (P12,
> "Favoritos: marcar varios y verlos juntos"), usada en dos momentos distintos: primero
> el gesto de marcar, después la vista de todos juntos. T5 es la placa que ya existe.

---

> **De dónde salen estas duraciones.** Cada toma dura lo que tarda su frase, contando
> sílabas a 5,7 por segundo: F1 son 25 sílabas → 4,4 s · F2 son 15 → 2,6 s · F3 son 22 →
> 3,9 s.

### Texto en pantalla

- **T1**: **"Guardá tus favoritos."** grande, entrando en el frame 1.
- **T2–T3**: subtítulo palabra por palabra, sincronizado con la voz.
- **T5**: *Creá tu cuenta gratis en hospeda.com.ar*

Todo el texto va dentro de la zona segura: fuera de los **250 px de arriba, 420 de
abajo y 180 de la derecha** sobre 1080×1920.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 6 s | 5,0 s | la frase son 4,4 s: en 4 s se corta |
| T3 | 6 s | 4,5 s | la frase son 3,9 s: en 4 s se corta |
| **voz** | **15 s** | sólo el audio | el guion entero son ~11,3 s: se pide el máximo para que no trunque la última frase |

Por eso los dos prompts de abajo tienen la misma estructura de tiempo: la acción ocurre
en la primera parte del clip y después el personaje sostiene, con el TIMING en
**fracciones del plano**, no en segundos.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,0 | 5,0 | tirada T1 · 6 s | 0,0 → 5,0 | 1,0 |
| **T2** | 5,0 → 8,0 | 3,0 | grabación P12a · marcar favoritos | a elección | — |
| **T3** | 8,0 → 12,5 | 4,5 | tirada T3 · 6 s | 0,0 → 4,5 | 1,5 |
| **T4** | 12,5 → 17,0 | 4,5 | grabación P12b · verlos juntos | a elección | — |
| **T5** | 17,0 → 20,0 | 3,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 4,39 | 4,4 | T1 | 0,61 |
| **F2** | 5,00 → 7,63 | 2,6 | T2 | 0,37 |
| **F3** | 8,00 → 11,86 | 3,9 | T3 | 0,64 |

> ⚠️ **La pista de voz NO se pega como un bloque único.** Se corta entre frases y cada
> frase se posiciona en su lugar, tal como en V9.

### Los cuatro cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,0 | T1 → T2 | persona sentada → pantalla | bajo |
| 8,0 | T2 → T3 | pantalla → persona sentada | bajo |
| 12,5 | T3 → T4 | persona sentada → pantalla | bajo |
| 17,0 | T4 → T5 | pantalla → placa | bajo |

T1 y T3 comparten el mismo fondo y el mismo tamaño de plano, pero **no son
consecutivas** — T2 se interpone —, así que la regla 2 del montaje sigue cumplida: nunca
hay dos tomas seguidas con el mismo plano. Es el único fondo asignado a este patrón, así
que la variedad la da la alternancia con la pantalla, no el encuadre.

### Lo demás

1. **Música desde el frame 1**, instrumental, tranquila, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las dos tiradas** y usar solo la pista de voz.
4. **Subtítulos palabra por palabra**, grandes, dentro de la zona segura.
5. **Nada de transiciones.** Corte seco en los cuatro.

---

## Lo que sigue bloqueado

**T2 y T4 necesitan la grabación P12** ("Favoritos: marcar varios y verlos juntos",
acción — ver [`../grabaciones.md`](../grabaciones.md)), con una cuenta de turista real,
no la de super admin.

---

## Qué mirar al revisar las tomas

**Que arranque hablando en el frame 1.** Si no, se recorta el arranque: para eso se
generan 6 s.

**Que la acción termine donde dice el TIMING** y después sostenga.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.

**Que las proporciones sentadas se mantengan** — cabeza grande, piernas cortas — y que
el celular nunca se despegue de la falda: en este patrón el teléfono no viaja a cámara.
