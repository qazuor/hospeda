# V36 · Mostranos tu ciudad — montaje

Prompts y montaje de **[V36](../../plan-videos.md#v36--mostranos-tu-ciudad)**: un corto
de 20 s armado con **una sola tirada de Hailuo, un tramo de fotos de la comunidad y la
placa de cierre**.

Patrón **H + cámara** (selfie), fondo **16** (costanera). **Sale una versión por destino,
nombrando la ciudad** — igual que el plan lo pide, pero el nombre va en el **texto en
pantalla**, no en la voz (ver la nota más abajo).

---

## Por qué el nombre de la ciudad no está en el guion de voz

**Regla de este lote: el texto de la voz en off sale tal cual del plan de videos, sin
reescribirlo.** El guion de V36, tal como está escrito en
[el plan](../../plan-videos.md#v36--mostranos-tu-ciudad), dice "la guía visual del
Litoral" — genérico, sin nombre de ciudad. Pero la instrucción de producción para este
video pide explícitamente que **"sale una versión por destino, nombrando la ciudad"**.

Las dos reglas se concilian así: **la voz queda intacta, igual en todas las ediciones, y
el nombre de la ciudad se agrega como texto en pantalla** — un título que dice "Buscamos
fotos de **(Ciudad)**", sobreimpreso desde el arranque de T1. Esto además tiene una
ventaja de producción: **T1, T2 (si ya existiera material) y la tirada de voz se generan
UNA SOLA VEZ y sirven para todas las ciudades** — lo único que cambia por edición es el
título y, eventualmente, el tramo de fotos reales de T2.

---

## El diálogo completo — no se toca por edición

> Estamos armando la guía visual del Litoral y queremos que la hagan los que viven acá.
>
> Si tenés buenas fotos de tu ciudad, conocés un lugar que deberíamos sumar, o
> encontraste algo para corregir, escribinos.

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Estamos armando la guía visual del Litoral y queremos que la hagan los que viven acá. | T1 | 30 | 5,3 s |
| **F2** | Si tenés buenas fotos de tu ciudad, conocés un lugar que deberíamos sumar, o encontraste algo para corregir, escribinos. | T1 | 41 | 7,2 s |

**Hablado: 12,5 s de 20**, las dos frases en una sola toma continua.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | 🔒 **HUECO — por edición**: **"Buscamos fotos de (Ciudad)"**, título grande desde el frame 1 |
| T2 | crédito de las fotos de ejemplo, sobreimpreso: "Foto de \[nombre]" |
| T3 | **Escribinos desde hospeda.com.ar** |

---

## El montaje — 20 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Qué pasa | Voz |
|---|---|:-:|---|---|---|
| **T1** | 0,0–13,5 | 13,5 | Hailuo · [`t1.md`](t1.md) — **fija, una vez para toda la serie** | selfie, las dos frases seguidas, título con el nombre de la ciudad sobreimpreso | F1 + F2, de corrido |
| **T2** | 13,5–16,5 | 3,0 | 🔒 **HUECO — dependencia**: mini collage de 2-3 fotos de ejemplo enviadas por la comunidad, con crédito visible | fotos que ya llegaron, con el nombre de quien las mandó | — (solo música) |
| **T3** | 16,5–20,0 | 3,5 | `placas/final.png` | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Mudo con el personaje en cuadro: 0 s de 20** — T1 lleva las dos frases seguidas.

> **Una sola tirada de Hailuo para imagen** —T1—, más **una tirada aparte sólo por el
> audio** (ver [`voz.md`](voz.md)). No hay corte entre T1 y otra toma de Hospedín: el
> selfie es de punta a punta un solo plano, el más nativo de todo el patrón H.

---

### Por qué T2 importa tanto como el resto

El plan es explícito: **"cada foto que se publique lleva el crédito de quien la mandó.
Si nadie ve su nombre publicado, el flujo se corta."** T2 no es un relleno visual: es la
prueba de que el pedido de T1 funciona — mostrar que ya hay gente real cuyo nombre
aparece en pantalla es lo que le da credibilidad a la promesa de la voz.

---

## Cómo se recorta la tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 15 s | 13,5 s | las dos frases juntas son 12,5 s: se pide el máximo por seguridad |
| **voz** | **15 s** | sólo el audio | mismo guion que T1, ~12,8 s hablados: se pide el máximo |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 13,5 | 13,5 | tirada T1 · 15 s | 0,0 → 13,5 | 1,5 |
| **T2** | 13,5 → 16,5 | 3,0 | fotos de ejemplo, HUECO | a elección | — |
| **T3** | 16,5 → 20,0 | 3,5 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 5,26 | 5,3 | T1 | — (sigue directo en F2) |
| **F2** | 5,45 → 12,64 | 7,2 | T1 | 0,86 |

> ⚠️ **La pista de voz NO se pega como bloque único.** Se corta como una sola pieza que
> cubre F1 y F2 de corrido (la pausa entre ambas ya está en la tirada), y se posiciona
> desde el frame 1 de T1.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 13,5 | T1 → T2 | selfie → fotos de la comunidad | bajo |
| 16,5 | T2 → T3 | fotos → placa | bajo |

Al no haber una segunda toma de Hospedín, **la regla 2 del montaje no aplica**: no hay
dos tomas de personaje seguidas para comparar.

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de T1** y usar solo la pista de voz.
4. **Subtítulos palabra por palabra** durante T1.
5. **Nada de transiciones.** Corte seco en los dos.

---

## Lo que sigue bloqueado

**T2 necesita fotos reales enviadas por la comunidad, con crédito**, que hoy no
existen para ningún destino — es la misma clase de dependencia que V33: no se resuelve
generando algo con IA, porque el argumento del video es justamente que las fotos son de
gente real.

**T1 y la voz se pueden generar y evaluar ya**, sin esperar ninguna foto: no dependen de
T2.

---

## Qué mirar al revisar la toma

**Que arranque hablando en el frame 1.**

**Que las dos frases se sientan una sola idea continua**, sin un salto de energía entre
la primera (el pedido) y la segunda (los tres motivos para escribir).

**Que el título de la ciudad sea legible** dentro de la zona segura y no tape la cara.

**Que el círculo naranja quede completo dentro del cuadro.**
