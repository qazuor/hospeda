# V34 · Qué hacer este fin de semana — molde de la serie

**Esto no es un video: es el MOLDE que se reusa cada semana.**
[V34](../../plan-videos.md#v34--qué-hacer-este-fin-de-semana--serie) es una serie
semanal que **tiene que armarse en veinte minutos** — el plan es explícito: "si lleva
más, el formato está mal diseñado y no se sostiene." Este documento está escrito para
que eso sea posible: casi todo se genera **una sola vez** y se reutiliza, y lo único que
cambia semana a semana es un solo hueco marcado.

Patrón **H** (selfie), fondo rotando entre **29** (carnaval, base), **16** (costanera) y
**28** (balneario). **Corto**, 20 s, formato Historia.

---

## La idea central: separar lo fijo de lo que cambia

| Qué | Cambia semana a semana? | Dónde vive |
|---|:-:|---|
| El guion (las tres frases) | **No.** | Fijo, ver abajo |
| La pista de voz | **No.** Se genera una vez y se reutiliza siempre. | [`voz.md`](voz.md) |
| T1 y T3 (Hailuo, el personaje) | **No**, salvo la rotación de fondo (que tampoco es semanal: se pre-generan las tres variantes una vez). | [`t1.md`](t1.md) · [`t3.md`](t3.md) |
| **T2 — la agenda** | **Sí. Es el único hueco real.** | Grabación fresca cada semana |

Con T1, T3, la voz y la placa ya resueltos de antemano, el trabajo semanal se reduce a:
grabar la pantalla de la agenda actualizada (P10), tipear el texto de los 3 a 5 eventos
sobre esa grabación, y montar — el trabajo de veinte minutos que pide el plan.

---

## El diálogo completo — fijo, no cambia por edición

> ¿Buscás qué hacer este fin de semana?
>
> En Hospeda vamos juntando eventos, fiestas y actividades de los destinos de Entre
> Ríos.
>
> Entrá, elegí tu destino y fijate qué hay durante tu visita.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | ¿Buscás qué hacer este fin de semana? | T1 | 12 | 2,1 s |
| **F2** | En Hospeda vamos juntando eventos, fiestas y actividades de los destinos de Entre Ríos. | T2 | 30 | 5,3 s |
| **F3** | Entrá, elegí tu destino y fijate qué hay durante tu visita. | T3 | 22 | 3,9 s |

**Hablado: 11,2 s de 20.** El resto es la agenda en pantalla y la placa.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **¿Qué hacés este finde?** |
| T2 | 🔒 **HUECO — semanal**: nombre, lugar y día de cada evento, sobre la grabación |
| T4 | **Mirá la agenda en hospeda.com.ar** |

---

## El montaje — 20 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Qué pasa | Voz |
|---|---|:-:|---|---|---|
| **T1** | 0,0–2,5 | 2,5 | Hailuo · [`t1.md`](t1.md), fondo de la semana | selfie, gancho de la pregunta | *"¿Buscás qué hacer este fin de semana?"* |
| **T2** | 2,5–12,5 | 10,0 | 🔒 **HUECO — grabación P10**, semanal | scroll rápido por la agenda, 3 a 5 eventos con lugar y día sobreimpresos | *"En Hospeda vamos juntando eventos, fiestas y actividades de los destinos de Entre Ríos."* |
| **T3** | 12,5–17,0 | 4,5 | Hailuo · [`t3.md`](t3.md), mismo fondo que T1 | selfie, cierre con un saludo | *"Entrá, elegí tu destino y fijate qué hay durante tu visita."* |
| **T4** | 17,0–20,0 | 3,0 | `placas/final.png` | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Mudo con el personaje en cuadro: 0 s de 20** — T1 y T3 llevan su frase cada una.

---

## El trabajo semanal, paso a paso (los veinte minutos)

1. **Elegir el fondo de la semana** entre 29, 16 y 28 — el que no se usó la semana
   pasada — y usar el T1 y el T3 ya generados para ese fondo. Cero generación nueva.
2. **Grabar P10** ("Agenda de eventos", scroll — ver
   [`../grabaciones.md`](../grabaciones.md)) con los eventos actuales de la semana.
3. **Escribir el texto sobreimpreso** de cada evento: nombre, lugar y día. Tres a cinco,
   rápido.
4. **Montar**: T1 fijo + T2 nuevo + T3 fijo + T4 fija, con la pista de voz fija debajo
   de todo, cortando sobre el beat.
5. **Si esa semana no hay eventos que valgan la pena, no se publica** — el plan lo dice
   explícito: mejor saltear que publicar una edición floja.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 2,5 s | la frase son 2,1 s: en menos se corta |
| T3 | 6 s | 4,5 s | la frase son 3,9 s |
| **voz** | **15 s** | sólo el audio | el guion entero son ~11,6 s: se pide el máximo, una sola vez, para siempre |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 2,5 | 2,5 | tirada T1 (fondo de la semana) · 4 s | 0,0 → 2,5 | 1,5 |
| **T2** | 2,5 → 12,5 | 10,0 | grabación P10 · esa semana | a elección | — |
| **T3** | 12,5 → 17,0 | 4,5 | tirada T3 (mismo fondo) · 6 s | 0,0 → 4,5 | 1,5 |
| **T4** | 17,0 → 20,0 | 3,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 2,11 | 2,1 | T1 | 0,39 |
| **F2** | 2,50 → 7,76 | 5,3 | T2 | — (T2 sigue 4,74 s más en silencio, con los eventos aún en pantalla) |
| **F3** | 12,50 → 16,36 | 3,9 | T3 | 0,64 |

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 2,5 | T1 → T2 | selfie → pantalla de agenda | bajo |
| 12,5 | T2 → T3 | pantalla → selfie | bajo |
| 17,0 | T3 → T4 | selfie → placa | bajo |

T1 y T3 comparten fondo y plano pero no son consecutivas — T2 se interpone —, así que la
regla 2 del montaje sigue cumplida.

### Lo demás

1. **Música desde el frame 1**, instrumental, con energía de fin de semana, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las tiradas T1 y T3** y usar solo la pista de voz fija.
4. **Subtítulos palabra por palabra** en T1 y T3; en T2 el texto es el de cada evento,
   no un subtítulo de la voz.
5. **Nada de transiciones.** Corte seco en los tres.

---

## Lo que sigue bloqueado

**T2 necesita la grabación P10 fresca de cada semana** — es, por diseño, el único
elemento que se genera de nuevo en cada edición. T1, T3 y la voz se pueden generar y
aprobar **ya, una sola vez**, sin esperar a ninguna semana en particular.

---

## Qué mirar al revisar las tomas

**Que T1 y T3 arranquen hablando en el frame 1.**

**Que el círculo naranja quede completo dentro del cuadro** en las tres variantes de
fondo — es el riesgo específico del patrón H (ver
[`../../patrones-de-puesta-en-escena.md`](../../patrones-de-puesta-en-escena.md)).

**Que, semana a semana, T2 muestre información real y vigente** — lugar y día
correctos. Un evento vencido en pantalla es peor que no publicar esa semana.
