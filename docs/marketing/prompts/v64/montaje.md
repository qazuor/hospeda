# V64 · Cocinás bien y nadie de afuera lo sabe — montaje

Prompts y montaje de **[V64](../../plan-videos.md#p2--doce-videos)**: una publicación de
18 s armada con **tres tiradas de Hailuo con diálogo y la placa de cierre**.

Usa el **patrón G** —sentado a la mesa— sobre el **fondo 26**, una mesa en el interior de
un restaurante. **Sin objeto.**
Molde: [`../v40/montaje.md`](../v40/montaje.md) para el recurso de acercamiento
progresivo sobre un único fondo.

---

## El diálogo completo

> Acá todos saben que cocinás bien. Eso ya lo tenés ganado.
>
> El problema es el que no es de acá y no tiene forma de enterarse.
>
> El boca a boca local no llega solo hasta la ruta.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | Acá todos saben que cocinás bien. Eso ya lo tenés ganado. | T1 | 20 | 3,51 s |
| **S2** | El problema es el que no es de acá y no tiene forma de enterarse. | T2 | 23 | 4,04 s |
| **S3** | El boca a boca local no llega solo hasta la ruta. | T3 | 18 | 3,16 s |

**Hablado: 10,7 s de 18,0.** Las tres frases entran cómodas en una sola tirada de voz —
ver [`voz.md`](voz.md).

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de S1 |
| T2 | subtítulo palabra por palabra de S2 |
| T3 | subtítulo palabra por palabra de S3 |
| T4 (placa) | **Cocinás bien. Que se sepa también afuera.** seguido del logo y **hospeda.com.ar** |

---

## El patrón, el fondo y las manos vacías

**Patrón G — sentado a la mesa — sobre el fondo 26**, una mesa en el interior del
restaurante, de noche. **Sin objeto.**

> ⚠️ **El fondo 26 muestra a Hospedín con un celular apoyado sobre la mesa.** Este video
> no usa ningún objeto: en las tres tiradas se declara explícitamente que no sostiene ni
> apoya ningún teléfono, y que las dos manos quedan libres sobre la mesa, disponibles
> para gesticular.

**La gente del fondo va desenfocada y casi quieta**, como pide la nota general de
[`fondos.md`](../fondos.md) para el fondo 26 — si el modelo decide animarla, se roba la
atención que tiene que estar en Hospedín.

**Tres tomas, la misma mesa, cada vez más cerca**: T1 es el plano medio tal cual la
referencia; T2 se acerca un poco, con un gesto de explicar; T3 cierra más cerca todavía,
para el remate. Es el mismo recurso que usa [V40](../v40/montaje.md) para dar acción y
escenario real, no un personaje estático — la lección del piloto de V9.

---

## El montaje — 18 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA26#######` | medio (tal cual la referencia) | sentado a la mesa, habla, orgulloso | *"Acá todos saben que cocinás bien. Eso ya lo tenés ganado."* |
| **T2** | 4,0–8,5 | 4,5 | Hailuo · `@######ESCENA26#######` | un poco más cerca | habla, gesto de explicar con una mano | *"El problema es el que no es de acá y no tiene forma de enterarse."* |
| **T3** | 8,5–12,5 | 4,0 | Hailuo · `@######ESCENA26#######` | más cerca todavía | habla el remate, expresión cálida y segura | *"El boca a boca local no llega solo hasta la ruta."* |
| **T4** | 12,5–18,0 | 5,5 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Tres tiradas de Hailuo con diálogo** —T1, T2 y T3— y **una sola tirada de voz** (ver
[`voz.md`](voz.md); las tres frases juntas son 10,7 s, bien por debajo del techo de
15 s).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 20 → 3,51 s ·
> S2 son 23 → 4,04 s · S3 son 18 → 3,16 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 5 s | 4,0 s | la frase son 3,51 s |
| T2 | 5 s | 4,5 s | la frase son 4,04 s |
| T3 | 5 s | 4,0 s | la frase son 3,16 s |
| **voz** | 12 s | S1 + S2 + S3 (10,7 s de contenido) | cubre T1, T2 y T3 enteras |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 18,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 5 s | 0,0 → 4,0 | 1,0 |
| **T2** | 4,0 → 8,5 | 4,5 | tirada T2 · 5 s | 0,0 → 4,5 | 0,5 |
| **T3** | 8,5 → 12,5 | 4,0 | tirada T3 · 5 s | 0,0 → 4,0 | 1,0 |
| **T4** | 12,5 → 18,0 | 5,5 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *Acá todos saben...* | 0,00 → 3,51 | 3,51 | T1 | 0,49 |
| **S2** *El problema es el que...* | 4,00 → 8,04 | 4,04 | T2 | 0,46 |
| **S3** *El boca a boca local...* | 8,50 → 11,66 | 3,16 | T3 | 0,84 |

> **La pista de voz NO se pega como un bloque único.** Se corta entre cada frase y cada
> una se posiciona en su lugar, aunque las tres salgan de la misma tirada de
> [`voz.md`](voz.md).

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → T2 | medio → un poco más cerca | bajo |
| 8,5 | T2 → T3 | un poco más cerca → más cerca todavía | bajo |
| 12,5 | T3 → T4 | más cerca → placa | bajo |

**Ningún corte de este video es de riesgo alto**: la mesa no cambia en ningún momento y
el personaje nunca desaparece del cuadro, así que el único cuidado real es que cada
acercamiento se note lo suficiente como para no sentirse un salto entre planos iguales —
ver la regla 2 del montaje en [`../README.md`](../README.md).

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida e íntima —el tono es de charla entre
   pares, no de venta—, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las tres tiradas de Hospedín** y usar sólo la pista de voz de
   [`voz.md`](voz.md).
4. **Subtítulos palabra por palabra** en las tres tomas.
5. **Nada de transiciones.** Corte seco en los tres.

---

## Qué mirar al revisar las tomas

**Que las tres tiradas arranquen hablando en el frame 1**, sin respiro ni mirada previa.

**Que las manos queden libres sobre la mesa en las tres**, sin que el modelo agregue un
celular por su cuenta — es la desviación más fácil de cometer partiendo del fondo 26.

**Que la gente de fondo del restaurante se vea desenfocada y quieta** en las tres tomas.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las tres.

**Que el tono se sostenga cálido y de igual a igual**, nunca de lástima ni de venta. El
guion no dice que Hospeda garantiza clientes: dice que el boca a boca local no alcanza
solo. Si en edición se agrega una promesa de resultado, no entra.
