# V27 · ¿Ofrecés experiencias? — montaje

Prompts y montaje de **[V27](../../plan-videos.md#v27--ofrecés-experiencias)**: un
**largo de 35 s** armado con **dos tiradas de Hailuo, un montaje de actividades reales,
grabación de pantalla y la placa de cierre**. Publicación y WhatsApp.

Sigue el molde de [`v9/montaje.md`](../v9/montaje.md), con la misma estructura de voz en
off que [`v26`](../v26/montaje.md): Hospedín habla en la apertura, el resto corre en voz
en off sobre imagen sin él en cuadro.

---

## El diálogo completo

Voz en off del [plan de videos](../../plan-videos.md#v27--ofrecés-experiencias), sin
cambios:

> Si ofrecés paseos, excursiones, pesca, alquiler de bicicletas, actividades en el agua o
> visitas guiadas, queremos que estés en Hospeda.
>
> Porque el viaje no termina cuando encontrás alojamiento: queremos mostrar también todo
> lo que se puede hacer una vez que llegás.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura | Hospedín en cámara |
|:-:|---|:-:|:-:|:-:|:-:|
| **F1a** | Si ofrecés paseos, excursiones, pesca, | T1 | 13 | 2,28 s | **sí, habla** |
| **F1b** | alquiler de bicicletas, actividades en el agua o visitas guiadas, queremos que estés en Hospeda. | T2 | 34 | 5,96 s | no — VO sobre el montaje de actividades |
| **F2** | Porque el viaje no termina cuando encontrás alojamiento: queremos mostrar también todo lo que se puede hacer una vez que llegás. | T3 | 41 | 7,19 s | no — VO sobre la grabación |
| — | *(sin voz, la ficha se termina de mostrar)* | T3 | — | ~4,8 s | no |
| — | *(sin voz, cierre)* | T4 | — | ~6,0 s | sí, sin hablar |

**Hablado: 15,4 s de 35 (44%).** El resto son las actividades reales, la ficha de
experiencia y el cierre — el mismo reparto que V26, con la diferencia de que acá **no hay
un remate hablado**: la frase 2 ya cierra la idea sola, así que el personaje vuelve a
cuadro en silencio en vez de decir una línea nueva.

> **Enumerar las actividades importa**, como pide el plan de videos: mucha gente que
> ofrece kayak o cabalgata no se piensa a sí misma como "prestador turístico". Por eso la
> enumeración completa de F1b va en voz en off exactamente encima del montaje de
> actividades — que cada palabra caiga sobre su imagen es lo que hace que la lista se
> sienta concreta y no abstracta.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1–T3 | subtítulo palabra por palabra, sincronizado con la voz en off |
| T4 | **"Sumá tu experiencia a Hospeda"** entrando de a poco |
| T5 | **Sumá tu experiencia en hospeda.com.ar** |

---

## Puesta en escena

**Patrón E · llega al lugar**, fondo **12 · bote de pesca**
([`../fondos.md`](../fondos.md#12--bote-de-pesca--plano-entero-de-frente)), por
asignación de la tabla [Puesta en escena por video](../../plan-videos.md#puesta-en-escena-por-video):
*"la actividad es el tema."*

> ⚠️ **`escena12` no tiene celular.** Es la excepción de los doce fondos de plano entero:
> Hospedín sostiene una **caña de pescar** apoyada sobre el hombro, en vez de un
> teléfono. Eso significa que patrón E acá **no puede resolver la pantalla componiendo un
> inserto sobre el personaje** — ninguna de las dos tomas de este video muestra pantalla
> alguna. La ficha de experiencia (T3) es una grabación a pantalla completa, como T3 y T5
> de V9, no un recuadro compuesto sobre el fondo.

**T1 y T4 reusan `escena12`**: es el mismo bote, al principio y al final — igual que V26
vuelve a la misma mesa.

---

## El montaje — 35 segundos, 4 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–3,0 | 3,0 | Hailuo · `@######ESCENA12#######` | entero | levanta la caña y señala el agua | *"Si ofrecés paseos, excursiones, pesca,"* |
| **T2** | 3,0–9,5 | 6,5 | **filmación real** · actividades | montaje | kayak, bicicletas, pesca, cabalgata — montaje rápido | *"alquiler de bicicletas, actividades en el agua o visitas guiadas, queremos que estés en Hospeda."* |
| **T3** | 9,5–21,5 | 12,0 | **grabación** · P9 | pantalla | experiencias: listado y ficha, scroll completo | *"Porque el viaje no termina cuando encontrás alojamiento: queremos mostrar también todo lo que se puede hacer una vez que llegás."* |
| **T4** | 21,5–27,5 | 6,0 | Hailuo · `@######ESCENA12#######` | entero | abre los brazos hacia el río, sonríe | — (solo música, texto entrando) |
| **T5** | 27,5–35,0 | 7,5 | `placas/final.png` | placa | logo y CTA | — (solo música) |

**Dos tiradas de Hailuo** —T1 y T4—, más **dos tiradas solo por el audio** (ver
[`voz.md`](voz.md)). T2 es filmación real de actividades y T3 es grabación de pantalla;
ninguna de las dos se genera.

---

## ⚠️ Lo que falta: filmación real de actividades

**T2 es la dependencia más grande de los cinco videos de este lote.** No existe hoy: no
está en [`grabaciones.md`](../grabaciones.md) (que sólo cubre pantallas de la
plataforma) y tampoco es algo que se resuelva con Hailuo — la regla 3 del plan de videos
es explícita: la interfaz se graba, el personaje y los ambientes se generan, pero **lo
que un guía o un prestador real hace de verdad no se simula con IA**.

Hace falta salir a filmar **kayak, paseos en bicicleta, pesca y cabalgata**, con gente
real haciendo esas actividades en la zona — probablemente con los propios prestadores que
se sumen a la plataforma, ya que son quienes tienen acceso a esos lugares y ese equipo.
Sin este material, T2 —6,5 s de los 35, pero el corazón del guion, porque es donde se
enumeran las actividades— no se puede armar.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 3,0 s | la frase son 2,28 s, entra cómoda en el mínimo |
| T4 | 6 s | 6,0 s | cierre sostenido sin frase que lo acote, se usa casi todo lo pedido |
| **voz · parte A** | **15 s** | sólo el audio | Oración 1 completa (8,25 s) |
| **voz · parte B** | **12 s** | sólo el audio | Oración 2 completa (7,19 s) |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 35,0 s.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip |
|---|---|:-:|---|---|
| **T1** | 0,0 → 3,0 | 3,0 | tirada T1 · 4 s | 0,0 → 3,0 |
| **T2** | 3,0 → 9,5 | 6,5 | filmación real · actividades | montaje interno de varios cortes cortos |
| **T3** | 9,5 → 21,5 | 12,0 | grabación · P9 | a elección |
| **T4** | 21,5 → 27,5 | 6,0 | tirada T4 · 6 s | 0,0 → 6,0 |
| **T5** | 27,5 → 35,0 | 7,5 | `placas/final.png` | fijo |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1a** | 0,00 → 2,28 | 2,28 | T1 | 0,72 |
| **F1b** | 3,00 → 8,96 | 5,96 | T2 | 0,54 |
| **F2** | 9,50 → 16,69 | 7,19 | T3 | 4,81 (la pantalla sigue mostrando la ficha en silencio) |

> ⚠️ **F1a deja 0,72 s de aire**, por encima del rango habitual de 0,4–0,55: el redondeo
> al pulso de 0,5 s no deja una opción intermedia (2,5 s da 0,22, insuficiente; 3,0 s da
> 0,72). Es el mismo tipo de ajuste que aparece en V26 — más aire nunca es un problema, lo
> que no se puede es que sea menos de 0,4.

### Los cuatro cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 3,0 | T1 → T2 | bote (Hailuo) → actividades reales | medio: cambia de registro visual, animado a real |
| 9,5 | T2 → T3 | actividades reales → pantalla | bajo |
| 21,5 | T3 → T4 | pantalla → bote, plano entero | bajo: la regla 2 se cumple |
| 27,5 | T4 → T5 | bote → placa | bajo |

### Lo demás

1. **Música desde el frame 1**, instrumental, aventurera, 120 BPM.
2. **Tirar el audio de las dos tiradas de Hailuo** y de la filmación real; usar solo la
   pista de voz (ver `voz.md`).
3. **Subtítulos palabra por palabra**, dentro de la zona segura.
4. **Nada de transiciones.** Corte seco en los cuatro.

---

## Qué mirar al revisar las tomas

**Que la caña de pescar no tape la cabeza, el círculo naranja ni el logo del buzo** en
ninguna de las dos tiradas — el fondo ya lo pide, pero conviene verificarlo.

**Que T1 arranque hablando en el frame 1.**

**Que T4 no invente diálogo**: es la toma con más riesgo, porque no tiene frase asignada.
