# V2 · Qué es Hospeda — montaje

Prompts y montaje de **[V2](../../plan-videos.md#v2--qué-es-hospeda)**: una publicación de
40 s armada con **dos tiradas de Hailuo y cinco bloques de grabación de pantalla**.

Usa el **patrón B** —presentador al costado— sobre el **fondo 21**, inserto lateral en la
costanera. Es un video **largo**: la voz en off hace el trabajo pesado y Hospedín aparece
hablando solo en la apertura; el cierre es un gesto silencioso. La estructura sigue el
molde de [V9](../v9/montaje.md), con la voz partida en dos tiradas como en
[V22](../v22/montaje.md), porque el guion entero no entra en los 15 s de una sola tirada.

---

## El diálogo completo

**Esto es lo que se escucha**, de punta a punta, en el orden en que se dice.

> Creamos Hospeda para reunir en un solo lugar todo lo que necesitás para disfrutar un
> destino: alojamientos, gastronomía, experiencias, eventos y lugares para conocer.
>
> Podés descubrir qué hacer, dónde alojarte y contactar directo a los prestadores.
>
> Estamos empezando por Entre Ríos, y queremos que sirva tanto al que viaja como al que
> vive del turismo.

Repartido en las tomas. La primera frase se corta a la mitad porque junta 59 sílabas
—10,4 s— y la regla de planos hablados cortos pide un máximo de 6 s en cámara:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1a** | Creamos Hospeda para reunir en un solo lugar todo lo que necesitás para disfrutar un destino: | T1 | 33 | 5,8 s |
| **F1b** | alojamientos, gastronomía, experiencias, eventos y lugares para conocer. | T2 *(off)* | 26 | 4,6 s |
| **F2** | Podés descubrir qué hacer, dónde alojarte y contactar directo a los prestadores. | T3 *(off)* | 27 | 4,7 s |
| **F3** | Estamos empezando por Entre Ríos, y queremos que sirva tanto al que viaja como al que vive del turismo. | T4 *(off)* | 35 | 6,1 s |

**Hablado: 21,2 s de 40.** Solo **T1 está lip-synced** — la apertura. El resto se escucha
en off mientras la grabación de pantalla lleva la imagen, y T7 es un cierre mudo.

Y lo que se **lee** en pantalla, que no siempre coincide con lo que se dice:

| Cuándo | Texto |
|---|---|
| T1 | **¿Estás planeando una escapada por Entre Ríos?** *(gancho, no es la frase que se dice)* |
| T2–T6 | el nombre de cada sección a medida que aparece: **Alojamientos · Destino · Gastronomía · Experiencias · Eventos** |
| T7 | **hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v2--qué-es-hospeda) y no se
> cambia acá. Que el gancho de T1 no sea literalmente F1a es deliberado — es la misma
> técnica que usa V22 en su T1/T2: el texto en pantalla es el titular que engancha mudo,
> el audio dice la frase completa.

---

## Por qué T1 habla y el resto no

**Solo la apertura queda en cámara.** El plan da un gancho de pantalla propio para los
primeros 4-6 s (algo que en el resto del video no existe: no hay más texto "propio" de
Hospedín, solo los nombres de sección y subtítulos de la voz), así que tiene sentido que
sea el único momento con a Hospedín hablando de verdad. El resto del guion — el recorrido
de cinco secciones — es del tipo que la sección "Hospedín habla, pero en planos cortos"
del plan de videos describe para los largos: **la voz en off hace el trabajo pesado** y el
personaje se guarda para los momentos clave.

**El cierre (T7) es mudo a propósito.** Para cuando llega, ya se dijo todo el guion — no
queda ninguna frase para poner en su boca. Señala en silencio y el CTA se lee en pantalla,
igual que el cierre de [V9](../v9/montaje.md) y de [V21](../v21/montaje.md).

---

## Por qué el recorrido es grabación a pantalla completa, no dentro del inserto

**El fondo asignado es 21, con el rectángulo del patrón B**, pero el recorrido de cinco
secciones se resuelve como **grabación a pantalla completa**, cortando lejos de Hospedín
—la misma técnica que usan [V9](../v9/montaje.md) en T3/T5 y [V22](../v22/montaje.md) en
T2/T4—, y no como contenido compuesto dentro del rectángulo de 311 × 520 px. Es un cambio
deliberado sobre la asignación de partida, por dos razones concretas:

1. **El inserto solo deja leer títulos y botones** (ver [`grabaciones.md`](../grabaciones.md)):
   a esa escala, un recorrido con scroll por cinco secciones distintas queda ilegible.
2. **Hailuo tiene un techo duro de 15 s por tirada.** Mantener a Hospedín generado y en
   cuadro durante los 27,5 s del recorrido pediría varias tiradas encadenadas que no
   agregan nada — el contenido real es la plataforma, no el personaje sosteniendo una
   pose.

El fondo 21 y su rectángulo se usan igual en **T1 y T7**, donde Hospedín está presente de
verdad: en T1 el rectángulo queda vacío y quieto (todavía no hay nada que mostrar ahí), y
en T7 se le compone la tarjeta de cierre —el logo y `hospeda.com.ar`— porque eso sí es
chico y se lee perfecto a esa escala.

---

## El montaje — 40 segundos, 6 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–6,5 | 6,5 | Hailuo · `@######ESCENA21#######` | B, entero con inserto vacío | saluda y abre los brazos en bienvenida, hablando a cámara | *"Creamos Hospeda para reunir en un solo lugar todo lo que necesitás para disfrutar un destino:"* |
| **T2** | 6,5–12,0 | 5,5 | **grabación · P2** | pantalla completa | listado de alojamientos, scroll | *(off)* "alojamientos, gastronomía, experiencias, eventos y lugares para conocer." |
| **T3** | 12,0–17,5 | 5,5 | **grabación · P7** | pantalla completa | página de destino, scroll | *(off)* "Podés descubrir qué hacer, dónde alojarte y contactar directo a los prestadores." |
| **T4** | 17,5–23,0 | 5,5 | **grabación · P8** | pantalla completa | gastronomía: listado y ficha | *(off)* "Estamos empezando por Entre Ríos, y queremos que sirva tanto al que viaja..." |
| **T5** | 23,0–28,5 | 5,5 | **grabación · P9** | pantalla completa | experiencias: listado y ficha | *(off)* "...como al que vive del turismo." *(termina)* |
| **T6** | 28,5–34,0 | 5,5 | **grabación · P10** | pantalla completa | agenda de eventos, scroll | — (solo música) |
| **T7** | 34,0–40,0 | 6,0 | Hailuo · `@######ESCENA21#######` | B, entero con inserto con logo | señala el inserto, ahora con el logo y la URL, sonríe | — (NO DIALOGUE) |

> Todos los cortes caen en múltiplos de 0,5 s, a 120 BPM.

**Dos tiradas de Hailuo** —T1 y T7—, más **dos solo por el audio** (ver
[`voz1.md`](voz1.md) y [`voz2.md`](voz2.md)). T2 a T6 son grabación de pantalla.

**Solo T1 lleva `DIALOGUE`.** T7 es un cierre sin hablar — bloque `NO DIALOGUE` — porque
para cuando llega ya no queda guion.

### Sobre los cinco cortes seguidos de grabación

**T2 a T6 son cinco tomas "pantalla completa" consecutivas**, lo que a primera vista
choca con la regla de no repetir tamaño de plano entre tomas seguidas. La regla existe
para evitar el salto que se lee como error entre dos encuadres parecidos del **mismo
sujeto**; acá el sujeto cambia en cada corte —alojamientos, destino, gastronomía,
experiencias, eventos—, así que cada corte se lee como avance de contenido, no como un
error de continuidad. Es la misma lógica de cualquier video de "recorrido por la app".

---

## Por qué la pista de voz se parte en dos

**El guion completo son 21,2 s hablados**, y Hailuo tiene un techo duro de 15 s por
tirada. La narración sale de **dos tiradas de audio**, cortadas en la costura natural del
guion —el punto y aparte entre la primera oración y la segunda—:

- [`voz1.md`](voz1.md): F1a + F1b — unos 10,4 s.
- [`voz2.md`](voz2.md): F2 + F3 — unos 10,9 s.

Se descarta el audio de las dos tiradas de imagen y se usan solo estas dos pistas. El
riesgo que agrega: el timbre puede variar levemente entre voz1 y voz2 porque son
generaciones separadas — conviene escucharlas una después de la otra antes de dar por
buena la narración completa.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 6,5 | 6,5 | tirada T1 · 7 s | 0,0 → 6,5 | 0,5 |
| **T2** | 6,5 → 12,0 | 5,5 | grabación P2 · listado alojamientos | a elección | — |
| **T3** | 12,0 → 17,5 | 5,5 | grabación P7 · página de destino | a elección | — |
| **T4** | 17,5 → 23,0 | 5,5 | grabación P8 · gastronomía | a elección | — |
| **T5** | 23,0 → 28,5 | 5,5 | grabación P9 · experiencias | a elección | — |
| **T6** | 28,5 → 34,0 | 5,5 | grabación P10 · agenda de eventos | a elección | — |
| **T7** | 34,0 → 40,0 | 6,0 | tirada T7 · 7 s | 0,0 → 6,0 | 1,0 |

### Dónde cae cada tirada de voz

A diferencia de un diálogo en cámara, esta voz es narración **de punta a punta**, así que
no está atada a los cortes de imagen — puede cruzar de una toma a la siguiente sin
problema, porque la regla 3 del montaje pide justo eso: el audio no se corta nunca.

| Frase | En la timeline | Dura | Cruza por encima de | Nota |
|---|---|:-:|:-:|---|
| **F1a** *Creamos Hospeda para reunir...* | 0,00 → 5,79 | 5,8 | T1 (lip-synced) | 0,71 s de aire hasta el corte a T2 |
| **F1b** *alojamientos, gastronomía...* | 6,90 → 11,50 | 4,6 | T2 | 0,50 s de aire hasta el corte a T3 |
| **F2** *Podés descubrir qué hacer...* | 12,40 → 17,10 | 4,7 | T3 | 0,40 s de aire hasta el corte a T4 |
| **F3** *Estamos empezando por Entre Ríos...* | 17,90 → 24,00 | 6,1 | T4 → T5 | cruza el corte de las 23,0; termina bien antes del corte a T6 |

Después de F3 (24,0) quedan **10,0 s solo de música e imagen** —el resto de T5, todo T6 y
la vuelta a Hospedín en T7—, con los nombres de sección todavía apareciendo en pantalla.
No es un vacío: es el tramo donde el video deja de explicar y se queda mostrando.

### Los seis cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 6,5 | T1 → T2 | entero con inserto → pantalla completa | medio |
| 12,0 | T2 → T3 | pantalla completa → pantalla completa (otra sección) | bajo |
| 17,5 | T3 → T4 | pantalla completa → pantalla completa (otra sección) | bajo |
| 23,0 | T4 → T5 | pantalla completa → pantalla completa (otra sección), la voz sigue de largo | bajo |
| 28,5 | T5 → T6 | pantalla completa → pantalla completa (otra sección) | bajo |
| 34,0 | T6 → T7 | pantalla completa → entero con inserto | medio |

**T1 → T2 y T6 → T7 son los que hay que cuidar.** Son los únicos donde Hospedín entra o
sale de cuadro; los cuatro cortes intermedios son entre grabaciones y funcionan solos
mientras cada sección se identifique con su nombre en pantalla.

### Lo demás

1. **Música desde el frame 1**, instrumental, alegre y con energía sostenida — es el video
   de presentación de la marca, vale la pena que suene bien producido. 120 BPM para que la
   hoja de corte valga tal cual.
2. **Tirar el audio de las dos tiradas de imagen** y usar solo `voz1.md` + `voz2.md`.
3. **Subtítulos palabra por palabra sobre las cinco grabaciones** (T2 a T6), porque ahí la
   voz suena en off; en T1 el subtítulo es el texto lip-synced, no el gancho.
4. **El nombre de cada sección aparece apenas entra esa grabación**, grande y en la zona
   segura, para que se entienda el recorrido sin sonido.
5. **Nada de transiciones**: corte seco en los seis.

---

## Qué mirar al revisar las tomas

**Que T1 arranque hablando en el frame 1**, sin respiro previo, y que la frase completa
—las dos oraciones cortas del gesto de bienvenida— entre holgada en los 6,5 s usados.

**Que en T7 el rectángulo se vea plano, vacío y quieto** hasta que se le componga la
tarjeta de cierre encima: nada de reflejos, texto ni interfaz generados por Hailuo ahí.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.

**Que voz1 y voz2 suenen como la misma persona.** Es el costo de partir la narración en
dos tiradas — confirmarlo antes de armar el resto del montaje sobre esa base.
