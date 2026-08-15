# V11 · Publicar es simple — montaje

Prompts y montaje de **[V11](../../plan-videos.md#v11--publicar-es-simple)**: una
publicación de 35 s armada con **dos tiradas de Hailuo y una grabación de pantalla
continua**. Patrón **B** (presentador al costado), fondo **15 · inserto lateral en la
cabaña**.

Estructura y convenciones: [`../v9/montaje.md`](../v9/montaje.md), el molde de todos los
videos.

---

## El diálogo completo

> Publicar tu alojamiento es bastante simple.
>
> Creás tu cuenta, cargás la información, agregás las fotos, la ubicación, los
> servicios y tus datos de contacto.
>
> Una vez publicado ya tenés tu espacio en Hospeda para empezar a recibir consultas.

Es la [voz en off de V11](../../plan-videos.md#v11--publicar-es-simple), tal cual,
repartida en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Publicar tu alojamiento es bastante simple. | T1 | 15 | 2,63 s |
| **F2** | Creás tu cuenta, cargás la información, agregás las fotos, la ubicación, los servicios y tus datos de contacto. | T2 | 35 | 6,14 s |
| **F3** | Una vez publicado ya tenés tu espacio en Hospeda para empezar a recibir consultas. | T3 | 30 | 5,26 s |

**Hablado: 14,0 s de 35.**

Texto en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **Publicar es más simple de lo que pensás** entrando en el frame 1 |
| T2, mientras habla F2 | subtítulo palabra por palabra |
| T2, resto silencioso | ningún rótulo por sección — ver más abajo por qué |
| T3 | **Empezá en hospeda.com.ar** |

---

## El fondo

`escenas/escena15.png` — el mismo inserto lateral en la
cabaña que usan V7 y V10.

---

## El montaje — 35 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–3,0 | 3,0 | Hailuo · `@######ESCENA15#######` | entero con inserto | tranquilizador, gesto de "es fácil" | F1 |
| **T2** | 3,0–29,0 | 26,0 | **grabación A1** | pantalla completa | el alta completa, de principio a fin, **sin cortes internos** | F2, después silencio |
| **T3** | 29,0–35,0 | 6,0 | Hailuo · `@######ESCENA15#######` | entero con inserto | entusiasmado, cierre | F3 |

> **Los cortes caen en múltiplos de 0,5 s**: 3,0 · 29,0 · 35,0.

### Por qué T2 es una sola toma, sin cortes internos

Es la condición que trae este video y no los otros dos de patrón B: el plan de videos
dice **"que se vea entera: si el video corta y salta, sugiere que hay pasos difíciles
que no se muestran"**. Eso cambia cómo se arma T2 frente a V7 y V10:

- **La fuente es UNA sola grabación** —`A1: Alta completa: registro → publicado, sin
  cortes` en [`grabaciones.md`](../grabaciones.md)—, tomada de principio a fin en una
  sola pasada, no un compilado de clips de distintas secciones.
- **En edición se puede acelerar**, pero no cortar ni saltar partes: acelerar la
  velocidad de reproducción de un plano no es lo mismo que cortarlo, y es justamente el
  recurso que permite que un trámite real entre en 26 s sin esconder pasos.
- **Por eso T2 no lleva rótulos por sección** como sí lleva V10: acá el punto no es
  "mirá todo lo que tiene", es "mirá que no falta nada del camino". Rotular por sección
  fragmentaría visualmente algo que tiene que leerse como un solo trayecto continuo.

### Rule 2 — dos tomas seguidas nunca comparten plano

T1 (entero con inserto) → T2 (pantalla completa) cambia del todo. T2 → T3 (entero con
inserto otra vez) también.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 3,0 s | la frase son 2,63 s, la más corta de las tres |
| T3 | 8 s | 6,0 s | la frase son 5,26 s más el aire para el CTA |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 3,0 | 3,0 | tirada T1 · 4 s | 0,0 → 3,0 | 1,0 |
| **T2** | 3,0 → 29,0 | 26,0 | grabación A1, acelerada | de principio a fin, sin recortes internos | — |
| **T3** | 29,0 → 35,0 | 6,0 | tirada T3 · 8 s | 0,0 → 6,0 | 2,0 |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Nota |
|---|---|:-:|:-:|---|
| **F1** | 0,00 → 2,63 | 2,63 | T1 | aire hasta el corte: 0,37 s |
| **F2** | 3,00 → 9,14 | 6,14 | T2 | de acá a 29,0 sigue la grabación en silencio, acelerada |
| **F3** | 29,00 → 34,26 | 5,26 | T3 | fin del video: hold de 0,74 s con el CTA |

> ⚠️ **La pista de voz sale de una sola tirada** (ver [`voz.md`](voz.md)): las tres
> frases de V11 entran cómodas en los 15 s de Hailuo, a diferencia de V7, V8 y V10.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 3,0 | T1 → T2 | entra a pantalla completa, sale Hospedín de cuadro | medio |
| 29,0 | T2 → T3 | sale de la pantalla, después de 26 s de un trámite continuo | alto |

**T2 → T3.** El corte tiene que sentirse como el final natural del trámite —"ya está
publicado, volvemos con Hospedín"—, no como una interrupción. Conviene que el último
fotograma de la grabación sea ya la ficha publicada, para que T3 arranque sobre esa
confirmación.

### Lo demás

1. **Música desde el frame 1**, instrumental, con un pulso que sostenga la aceleración
   del trámite sin sentirse ansiosa.
2. **Tirar el audio de las dos tiradas de imagen** y usar solo la pista de voz.
3. **Subtítulos palabra por palabra** durante F1, F2 y F3.
4. **Corte seco en los dos** — el único de los tres cortes de este lote que no admite
   discusión, porque T2 en sí misma ya está pensada como una sola toma sin cortes.

---

## Material a grabar (T2)

**A1 · Alta completa: registro → publicado, sin cortes** — ver
[`grabaciones.md`](../grabaciones.md). Es la única grabación de todo el plan que exige
esta condición explícitamente: **una sola toma**, sin retomar. Si se corta y se retoma
en la grabación original, se nota, y acá arruina el argumento del video.

Con cuenta de anfitrión real, nunca la de super admin. Grabar de más al principio y al
final por si hace falta ajustar el punto de entrada o salida en edición — lo que no se
puede hacer es cortar en el medio.

---

## Qué mirar al revisar las tomas

**Que T1 y T3 arranquen hablando en el frame 1.**

**Que el teléfono flotante de `escena15.png` quede vacío, plano y quieto en las dos
tiradas.**

**Que la grabación de T2 sea realmente una sola toma.** Es la condición central de este
video: si al revisar el material se nota un corte o un salto, no se resuelve en
edición — hay que volver a grabar el alta entera.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos tiradas.
