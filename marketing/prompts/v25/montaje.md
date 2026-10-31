# V25 · Una buena descripción vende mejor — montaje

Prompts y montaje de **[V25](../../plan-videos.md#v25--una-buena-descripción-vende-mejor)**:
una publicación de 35 s armada con **dos tiradas de Hailuo, un tratamiento de texto y la
placa de cierre**.

Usa el **patrón B** —presentador al costado, con el inserto— sobre el **fondo 22**,
inserto lateral en el balneario. Segundo de la serie de consejos "de anfitrión a
anfitrión", mismo mecanismo de montaje que [V24](../v24/montaje.md): el recuadro se abre
a pantalla completa para la demostración y vuelve a cerrarse para el cierre.

---

## El diálogo completo

**Esto es lo que se escucha**, de punta a punta.

> Cuando describas tu alojamiento, no te quedes en que es hermoso, increíble o
> espectacular.
>
> Contá lo que el huésped quiere saber: para cuántas personas es, dónde está, qué
> comodidades tiene, qué hay cerca y qué lo hace distinto.
>
> La información concreta da más confianza que una colección de adjetivos.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Cuando describas tu alojamiento, no te quedes en que es hermoso, increíble o espectacular. | T1 | 31 | 5,4 s |
| **F2** | Contá lo que el huésped quiere saber: para cuántas personas es, dónde está, qué comodidades tiene, qué hay cerca y qué lo hace distinto. | T2 *(off)* | 43 | 7,5 s |
| **F3** | La información concreta da más confianza que una colección de adjetivos. | T3 | 24 | 4,2 s |

**Hablado: 17,2 s de 35.** Solo **T1 y T3** están lip-synced. F2 —la lista completa de
lo que sí hay que contar— se escucha en off mientras el tratamiento de texto muestra la
lista armándose.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **Una buena descripción vende mejor.** |
| T2 | el texto lleno de adjetivos con tachado, y los cinco puntos apareciendo uno por uno: **capacidad · ubicación · comodidades · qué hay cerca · qué lo hace distinto** |
| T3 | subtítulo palabra por palabra |
| T4 | **hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v25--una-buena-descripción-vende-mejor)
> y no se cambia acá.

---

## El material del inserto: texto, no grabación

**No es una grabación de pantalla ni una foto**: es un tratamiento de texto que se arma
en edición. Dos piezas:

1. **La descripción mala** — un párrafo real con los adjetivos que el guion nombra
   ("hermoso", "increíble", "espectacular") tachándose uno por uno.
2. **La descripción concreta** — los cinco datos que pide F2, apareciendo como una lista
   corta a medida que la voz los nombra: capacidad, ubicación, comodidades, qué hay
   cerca, qué lo hace distinto.

No tiene código en [`grabaciones.md`](../grabaciones.md) porque no es material de la
plataforma: es un gráfico que se diseña para este video.

---

## El montaje — 35 segundos, 3 cortes

Mismo mecanismo que V24: el rectángulo del fondo 22 entra con su fijo puesto en las dos
tiradas de Hailuo, y en edición se **entra con un zoom** hacia él, donde el fijo se
reemplaza por el tratamiento de texto completo, y se **sale con el zoom inverso** para
volver a Hospedín.

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–6,0 | 6,0 | Hailuo · `@######ESCENA22#######` | entero con inserto | señala el recuadro, algo resignado con los adjetivos gastados | *"Cuando describas tu alojamiento, no te quedes en que es hermoso, increíble o espectacular."* |
| **T2** | 6,0–26,0 | 20,0 | **texto compuesto** | pantalla completa | los adjetivos se tachan, aparece la lista de cinco datos concretos | *(off)* "Contá lo que el huésped quiere saber: para cuántas personas es, dónde está, qué comodidades tiene, qué hay cerca y qué lo hace distinto." |
| **T3** | 26,0–31,0 | 5,0 | Hailuo · `@######ESCENA22#######` | entero con inserto | señala el recuadro, ahora con la ficha ya lista | *"La información concreta da más confianza que una colección de adjetivos."* |
| **T4** | 31,0–35,0 | 4,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

**Dos tiradas de Hailuo** —T1 y T3—, más **dos tiradas de audio** (ver
[`voz1.md`](voz1.md) y [`voz2.md`](voz2.md): las tres frases, unos 17,8 s con pausas, no
entran en una sola tirada de Hailuo —15 s de techo—, así que se parte igual que V22 y
V23, con la diferencia de que acá el corte de audio no coincide con un corte de toma:
cae dentro de T2, mientras la pantalla sigue mostrando el mismo tratamiento de texto —
ver el detalle en [Por qué la voz se parte en dos](#por-qué-la-voz-se-parte-en-dos)).

---

## Por qué la voz se parte en dos

**17,2 s hablados más dos pausas cortas son unos 17,8 s**, por encima del techo de 15 s
de Hailuo por tirada. La costura elegida es **dentro de T2**, no en un corte de imagen:

- [`voz1.md`](voz1.md): F1 completa — 5,4 s.
- [`voz2.md`](voz2.md): F2 + F3 — unos 12,1 s.

Es la única de las tres publicaciones largas donde el corte de audio no cae justo en un
corte de toma — T2 dura 20 s y la costura entre voz1 y voz2 cae en algún punto de en
medio, mientras la pantalla sigue mostrando el mismo tratamiento de texto sin
interrupción. Como el oyente nunca ve un corte de imagen ahí, **la costura entre las dos
pistas tiene que ser inaudible**: es el punto donde más se nota si el timbre de `voz1.md`
y `voz2.md` no coinciden.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 6,0 | 6,0 | tirada T1 · 6 s | 0,0 → 6,0 | — |
| **T2** | 6,0 → 26,0 | 20,0 | texto compuesto · adjetivos → checklist | a elección | — |
| **T3** | 26,0 → 31,0 | 5,0 | tirada T3 · 6 s | 0,0 → 5,0 | 1,0 |
| **T4** | 31,0 → 35,0 | 4,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** *Cuando describas tu alojamiento…* | 0,00 → 5,44 | 5,4 | T1 | 0,56 |
| **F2** *Contá lo que el huésped quiere saber…* | 6,30 → 13,84 | 7,5 | T2 | 12,16* |
| **F3** *La información concreta…* | 26,00 → 30,21 | 4,2 | T3 | 0,79 |

> \* De nuevo, el aire después de F2 es largo a propósito: son cinco datos concretos que
> necesitan aparecer uno por uno para que se puedan leer, y T2 dura 20 s completos para
> darles espacio. El resto es la lista terminada, quieta, dando tiempo a releerla.

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 6,0 | T1 → T2 | zoom hacia la miniatura del recuadro, hasta llenar el cuadro | medio |
| 26,0 | T2 → T3 | zoom hacia atrás, revela a Hospedín de nuevo | medio |
| 31,0 | T3 → T4 | entero con inserto → placa | bajo |

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida. 120 BPM.
2. **Tirar el audio de las dos tiradas de imagen** y usar sólo `voz1.md` + `voz2.md`,
   con especial cuidado en que la costura entre ambas quede inaudible dentro de T2.
3. **Subtítulos palabra por palabra en T1, T2 y T3.**
4. **Los cinco puntos de la lista aparecen uno por uno**, sincronizados con la voz,
   no todos juntos.
5. **El tachado de los adjetivos ocurre antes de que empiece la lista**, no en paralelo:
   primero se descarta lo que no sirve, después se arma lo que sí.

---

## Qué mirar al revisar las tomas

**Que el recuadro de T1 y T3 quede vacío, plano y quieto en la tirada de Hailuo.** El
tratamiento de texto se compone entero en edición.

**Que la costura entre `voz1.md` y `voz2.md` sea inaudible.** Es el punto más frágil de
este video en particular, porque cae en medio de T2 y no sobre un corte de imagen que
pueda disimularlo.

**Que en T1 la expresión de fastidio sea suave** — resignación con los adjetivos
gastados, no enojo. Se resuelve hacia el final de la frase, antes del corte.
