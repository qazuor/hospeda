# V23 · Hospeda no reemplaza nada, suma — montaje

Prompts y montaje de **[V23](../../plan-videos.md#v23--hospeda-no-reemplaza-nada-suma)**:
una publicación de 40 s armada con **tres tiradas de Hailuo, una grabación de pantalla y
la placa de cierre**.

Usa el **patrón D** —objeto en la mano, la mochila— sobre el **fondo 4**, costanera del
río, y cierra en **fondo 17**, primer plano. Es la combinación "cualquiera → I" para el
remate, igual que [V22](../v22/montaje.md).

---

## El diálogo completo

**Esto es lo que se escucha**, de punta a punta. Es la fusión de los dos videos que
antes estaban separados —redes y grandes plataformas—, así que el tono es de
pregunta-y-respuesta rápida, no de discurso.

> ¿Ya tenés Instagram, Facebook o una página? Perfecto, no venimos a reemplazarlos.
>
> ¿Usás Airbnb o Booking? Tampoco hace falta que dejes de usarlos. Son herramientas
> distintas.
>
> Hospeda está pensado para darte visibilidad dentro del destino y que el turista te
> conozca y te escriba directo. Es un canal más, no un reemplazo.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | ¿Ya tenés Instagram, Facebook o una página? | T1 | 15 | 2,6 s |
| **F2** | Perfecto, no venimos a reemplazarlos. | T1 | 13 | 2,3 s |
| **F3** | ¿Usás Airbnb o Booking? | T2 *(off)* | 7 | 1,2 s |
| **F4** | Tampoco hace falta que dejes de usarlos. | T2 *(off)* | 14 | 2,5 s |
| **F5** | Son herramientas distintas. | T2 *(off)* | 8 | 1,4 s |
| **F6** | Hospeda está pensado para darte visibilidad dentro del destino y que el turista te conozca y te escriba directo. | T3 *(off)* | 41 | 7,2 s |
| **F7** | Es un canal más, no un reemplazo. | T4 | 11 | 1,9 s |

**Hablado: 19,1 s de 40.** Solo **T1 y T4** están lip-synced — la apertura, con las dos
primeras preguntas resueltas de corrido, y el remate. F3 a F6 se escuchan en off.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **¿Ya tenés redes? Perfecto.** |
| T2 | rótulos por plataforma a medida que aparece: "Instagram", "Facebook", "Airbnb", "Booking" |
| T3 | subtítulo palabra por palabra de F6 |
| T4 | **Es un canal más, no un reemplazo.** |
| T5 | **Sumá tu alojamiento en hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v23--hospeda-no-reemplaza-nada-suma)
> y no se cambia acá. **Acá sí se pueden mostrar las interfaces de las otras
> plataformas** — es la única excepción de marcas de toda la serie de anfitriones, y es
> justamente el argumento del video: no se esconde de qué se está hablando.

---

## El objeto: la mochila

**Sí está entre las poses aprobadas de `acciones.png`** — "CON MOCHILA: con una mochila
de viaje puesta en la espalda". A diferencia de la lamparita de V22, acá no hace falta
documentar una sustitución nueva: el prompt referencia `@######ACCIONES#######`
directamente para esa pose.

**Va en la espalda, no en la mano.** Eso deja las dos manos libres para gesticular, así
que T1 y T3 pueden usar gestos de las manos sin que la mochila estorbe — a diferencia de
V22, donde una mano siempre sostenía la lamparita.

**El fondo 4 tampoco se regenera acá.** Igual que en V22, se parte de `escena4.png` y se
reemplaza explícitamente el celular de la referencia por la mochila puesta.

---

## El montaje — 40 segundos, 4 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,5 | 5,5 | Hailuo · `@######ESCENA4#######` | entero, D mochila | pregunta y responde de corrido, tono liviano | *"¿Ya tenés Instagram, Facebook o una página? Perfecto, no venimos a reemplazarlos."* |
| **T2** | 5,5–23,5 | 18,0 | **grabación · E3** | pantalla completa | Instagram, Facebook, Airbnb y Booking, una tras otra | *(off)* "¿Usás Airbnb o Booking? Tampoco hace falta que dejes de usarlos. Son herramientas distintas." |
| **T3** | 23,5–31,5 | 8,0 | Hailuo · `@######ESCENA4#######` | entero, D mochila | te explico, manos abiertas | *(off)* "Hospeda está pensado para darte visibilidad dentro del destino y que el turista te conozca y te escriba directo." |
| **T4** | 31,5–34,5 | 3,0 | Hailuo · `@######ESCENA17#######` | primer plano | remate, seguro y liviano | *"Es un canal más, no un reemplazo."* |
| **T5** | 34,5–40,0 | 5,5 | `placas/final.png` | placa | logo y CTA | — (solo música) |

**Tres tiradas de Hailuo** —T1, T3 y T4—, más **dos tiradas de audio**
(ver [`voz1.md`](voz1.md) y [`voz2.md`](voz2.md) — igual que V22, el guion no entra en
una sola tirada). T2 es grabación de pantalla y T5 es la placa que ya existe.

**Solo T1 y T4 llevan `DIALOGUE`.** T3 es reacción hablando-sin-audio-propio — bloque
`NO DIALOGUE` — con la voz de F6 puesta encima en edición.

---

## Por qué la voz se parte en dos

**El guion completo son 19,1 s hablados**, por encima del techo de 15 s de Hailuo por
tirada. Igual que en V22, no entra en una sola generación. Se parte en dos, con el corte
en la misma costura del montaje —T2 → T3, donde la imagen pasa de grabación a Hospedín
reaccionando—:

- [`voz1.md`](voz1.md): F1 a F5 — unos 10,9 s.
- [`voz2.md`](voz2.md): F6 + F7 — unos 9,4 s.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,5 | 5,5 | tirada T1 · 6 s | 0,0 → 5,5 | 0,5 |
| **T2** | 5,5 → 23,5 | 18,0 | grabación E3 · Airbnb / Booking / Instagram | a elección | — |
| **T3** | 23,5 → 31,5 | 8,0 | tirada T3 · 8 s | 0,0 → 8,0 | — |
| **T4** | 31,5 → 34,5 | 3,0 | tirada T4 · 4 s | 0,0 → 3,0 | 1,0 |
| **T5** | 34,5 → 40,0 | 5,5 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1+F2** *¿Ya tenés Instagram…? Perfecto, no venimos…* | 0,00 → 4,91 | 4,9 | T1 | 0,59 |
| **F3+F4+F5** *¿Usás Airbnb o Booking?…* | 5,50 → 10,59 | 5,1 | T2 | 12,91* |
| **F6** *Hospeda está pensado para…* | 23,70 → 30,89 | 7,2 | T3 | 0,61 |
| **F7** *Es un canal más, no un reemplazo.* | 31,50 → 33,43 | 1,9 | T4 | 1,07 |

> \* **El aire después de F3-F4-F5 es mucho más largo que el resto.** T2 dura 18 s y la
> voz sólo ocupa los primeros 5,1: el resto es la vidriera de las cuatro plataformas,
> silenciosa salvo por los rótulos en pantalla — ver la nota de la hoja de corte de V22,
> es el mismo criterio.

### Los cuatro cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,5 | T1 → T2 | entero con mochila → pantalla completa | medio |
| 23,5 | T2 → T3 | pantalla completa → entero con mochila | bajo |
| 31,5 | T3 → T4 | entero → primer plano | bajo (cualquiera→I) |
| 34,5 | T4 → T5 | primer plano → placa | bajo |

**T1 → T2 es el corte que arma el argumento.** Hospedín nombra Instagram, Facebook,
Airbnb y Booking en confianza, y la grabación que sigue **los muestra de verdad** — es la
única vez en toda la serie de anfitriones que se nombran y se ven las otras plataformas,
así que el corte tiene que sentirse como una demostración honesta, no como
un desvío.

### Lo demás

1. **Música desde el frame 1**, instrumental, liviana y de buena onda — el tono es
   distendido, casi de chiste interno ("tranqui, no te vamos a pedir que elijas"). 120
   BPM.
2. **Tirar el audio de las tres tiradas de imagen** y usar sólo `voz.md` + `voz2.md`.
3. **Rótulos por plataforma en T2**, sincronizados con el cambio de pantalla: el nombre
   de cada app aparece y desaparece a medida que se ve, para que se entienda mudo cuál es
   cuál.
4. **Subtítulos palabra por palabra en T1, T3 y T4.**
5. **Nada de transiciones**: corte seco en los cuatro.

---

## Qué mirar al revisar las tomas

**Que la mochila se vea igual en T1 y T3** — es una pose aprobada, pero conviene
confirmar que las dos tiradas la dibujan del mismo tamaño y en la misma posición sobre
la espalda.

**Que T3 no hable.** Es la única reacción del video.

**Que T2 muestre las cuatro plataformas con tiempo para leerse.** Dieciocho segundos
alcanzan para Instagram, Facebook, Airbnb y Booking sin apurar ninguna, pero si el corte
entre ellas es muy rápido, el efecto "mirá, las usás todas" se pierde.

**Que en T4 el círculo naranja entre completo** en el primer plano.
