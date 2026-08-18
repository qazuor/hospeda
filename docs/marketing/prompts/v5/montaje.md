# V5 · Quién está detrás — montaje

Prompts y montaje de **[V5](../../plan-videos.md#v5--quién-está-detrás)**: una
publicación de 35 s armada con **dos tiradas de Hailuo y un tramo de material real, sin
generar**.

Usa la combinación **E → I** —llega al lugar, cierra en primer plano— sobre el
**fondo 1** (cabaña) y el **fondo 17** (primer plano). Es el único video de la campaña
donde puede aparecer una persona real, así que el tramo central **no se genera**: queda
como un hueco marcado, para material filmado de verdad. La estructura sigue el molde de
[V9](../v9/montaje.md), con la voz partida en dos tiradas como en
[V22](../v22/montaje.md).

---

## El diálogo completo

**Esto es lo que se escucha**, de punta a punta.

> Atrás de Hospeda hay una persona de la región, que alquila para turismo hace años y
> conoce los problemas del rubro de primera mano.
>
> La plataforma se desarrolla acá, hablando con los que reciben turistas todos los días.
>
> Recién estamos empezando, y queremos construirla junto a los que viven del turismo
> local.

Repartido en las tomas. La primera frase se corta a la mitad porque junta 46 sílabas
—8,1 s— y la regla de planos hablados cortos pide un máximo de 6 s en cámara:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1a** | Atrás de Hospeda hay una persona de la región, | T1 | 16 | 2,8 s |
| **F1b** | que alquila para turismo hace años y conoce los problemas del rubro de primera mano. | T2 *(off, hueco)* | 30 | 5,3 s |
| **F2** | La plataforma se desarrolla acá, hablando con los que reciben turistas todos los días. | T2 *(off, hueco)* | 29 | 5,1 s |
| **F3** | Recién estamos empezando, y queremos construirla junto a los que viven del turismo local. | T3 | 29 | 5,1 s |

**Hablado: 18,3 s de 35.** **T1 y T3 están lip-synced** — la apertura y el cierre. F1b y
F2 se escuchan en off durante el tramo real del medio, que no lleva Hospedín.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | *(sin título; la presentación habla sola)* |
| T2 | ninguno fijo — si el material real lleva algún dato (nombre, rol), va ahí, discreto |
| T3 | subtítulo palabra por palabra de F3 |

> **En singular**: es una persona con colaboradores puntuales, no un equipo — coherente
> con la placa 13.1, según marca el plan. Ningún texto de este video puede sugerir "un
> equipo" ni "nosotros somos varios".

---

## El hueco central — no se genera

**T2 (5,0–25,0, 20 s) es material real, no una tirada de Hailuo y no un fondo de
`fondos.md`.** Es el único tramo de toda la campaña donde puede aparecer una persona de
verdad, y por eso queda marcado como **hueco** en este documento en vez de resuelto con
un prompt:

```
[HUECO — MATERIAL REAL, NO GENERAR]
Foto o plano real de quien está detrás de Hospeda, la región y el trabajo cotidiano.
Se cubre con filmación o fotografía real cuando esté disponible.
```

No se inventa un doble generado ni un standin — eso traicionaría el propósito exacto del
video, que es humanizar mostrando a alguien real. Mientras no haya material, este tramo
queda pendiente y el video no se arma.

---

## El montaje — 35 segundos, 2 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,0 | 5,0 | Hailuo · `@######ESCENA1#######` | E, entero | llega, abre los brazos mostrando el lugar, habla | *"Atrás de Hospeda hay una persona de la región,"* |
| **T2** | 5,0–25,0 | 20,0 | **[HUECO — no generar]** | material real | persona real, región y trabajo | *(off)* "que alquila para turismo hace años... La plataforma se desarrolla acá..." |
| **T3** | 25,0–35,0 | 10,0 | Hailuo · `@######ESCENA17#######` | I, primer plano | cierra hablando, cálido | *"Recién estamos empezando, y queremos construirla junto a los que viven del turismo local."* |

> Todos los cortes caen en múltiplos de 0,5 s, a 120 BPM.

**Dos tiradas de Hailuo** —T1 y T3—, más **dos solo por el audio** (ver
[`voz1.md`](voz1.md) y [`voz2.md`](voz2.md)). T2 es el hueco de material real.

**T1 y T3 llevan `DIALOGUE`.** Es la combinación "E → I" del documento de patrones:
Hospedín presenta y le cede el cuadro a lo real, y cierra en primer plano — el único
patrón donde conviene que hable en los dos extremos, porque en el medio no hay Hospedín
en absoluto.

### Por qué T3 cambia de fondo

**Es la combinación "cualquiera → I" para el remate**: cerrar en primer plano le da al
cierre el peso que la última frase necesita, y de paso cumple la regla 2 —T1 es plano
entero, T3 es primer plano, nunca comparten tamaño de plano— aunque estén separadas por
20 s de material real en el medio.

---

## Por qué la pista de voz se parte en dos

**El guion completo son 18,3 s hablados**, y aunque entra técnicamente bajo el techo de
15 s si se generara todo junto, se separa igual en dos tiradas porque el guion tiene una
costura natural justo donde cambia el tramo — el final de F1a, cuando Hospedín le cede el
cuadro al material real:

- [`voz1.md`](voz1.md): F1a + F1b — unos 8,1 s.
- [`voz2.md`](voz2.md): F2 + F3 — unos 10,2 s.

Se descarta el audio de las dos tiradas de imagen y se usan solo estas dos pistas.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,0 | 5,0 | tirada T1 · 6 s | 0,0 → 5,0 | 1,0 |
| **T2** | 5,0 → 25,0 | 20,0 | material real · hueco | a definir | — |
| **T3** | 25,0 → 35,0 | 10,0 | tirada T3 · 11 s | 0,0 → 10,0 | 1,0 |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Nota |
|---|---|:-:|:-:|---|
| **F1a** *Atrás de Hospeda hay una persona de la región,* | 0,00 → 2,81 | 2,8 | T1 | lip-synced; 2,19 s de sostenido después |
| **F1b** *que alquila para turismo...* | 5,40 → 10,66 | 5,3 | T2 | en off, arranca 0,4 s después del corte a T2 |
| **F2** *La plataforma se desarrolla acá...* | 11,20 → 16,30 | 5,1 | T2 | en off, sigue de largo |
| **F3** *Recién estamos empezando...* | 25,00 → 30,09 | 5,1 | T3 | lip-synced desde el primer frame de T3 |

Entre F2 (termina 16,3) y F3 (arranca 25,0) hay **8,7 s de material real sin narración**,
solo música — tiempo para que la imagen de la persona y el lugar respire antes de volver
a Hospedín.

### Los dos cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,0 | T1 → T2 | Hospedín, plano entero → material real | medio |
| 25,0 | T2 → T3 | material real → Hospedín, primer plano | medio |

**Los dos cortes tienen el mismo peso**: es el video que más depende de que la transición
de "personaje" a "persona real" y de vuelta se sienta natural, no como dos piezas
pegadas. Ayuda que ninguno de los dos comparte tamaño de plano con lo que viene antes o
después.

### Lo demás

1. **Música desde el frame 1**, instrumental, cálida y humana — sin el pulso de urgencia
   de los videos de captación. 120 BPM para que la hoja de corte valga tal cual.
2. **Tirar el audio de las dos tiradas de imagen** y usar solo `voz1.md` + `voz2.md`.
3. **Subtítulos palabra por palabra en las tres tomas habladas** (T1, T2 en off, T3).
4. **Nada de transiciones**: corte seco en los dos.

---

## Qué mirar al revisar las tomas

**Que T1 arranque hablando en el frame 1** y que el gesto de abrir los brazos mostrando
el lugar termine antes de que la frase se acabe, no después.

**Que T3 arranque hablando en el frame 1** — es el remate del video, no puede tener un
respiro previo.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos, y que en T3
—primer plano— entre completo dentro del cuadro.

**Que voz1 y voz2 suenen como la misma persona.**
