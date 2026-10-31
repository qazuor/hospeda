# V4 · Por qué armamos Hospeda — montaje

Prompts y montaje de **[V4](../../plan-videos.md#v4--por-qué-armamos-hospeda)**: una
publicación de 45 s armada con **dos tiradas de Hailuo, un montaje de motion graphics y
una grabación de pantalla**.

Usa el **patrón C** —reacción sin lip sync— sobre el **fondo 17**, primer plano.
Hospedín no habla nunca en cámara: reacciona, y todo el mensaje va en la voz en off y en
el texto en pantalla. La estructura sigue el molde de [V9](../v9/montaje.md), con la voz
partida en dos tiradas como en [V22](../v22/montaje.md).

---

## El diálogo completo

**Esto es lo que se escucha**, en off, de punta a punta. Hospedín nunca mueve la boca
para decir esto: es narración agregada en edición, no diálogo de las tomas.

> Cuando querés viajar a una ciudad, la información está por todos lados.
>
> Buscás alojamiento en un sitio, dónde comer en Google, los eventos en Instagram, y
> recién cuando llegás te enterás de qué se puede hacer.
>
> Hospeda nació para ordenar todo eso.
>
> Queremos que cada destino tenga su oferta turística en un mismo lugar, y que los
> negocios de la zona tengan una forma nueva de mostrarse.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Cuando querés viajar a una ciudad, la información está por todos lados. | T1 *(off)* | 23 | 4,0 s |
| **F2** | Buscás alojamiento en un sitio, dónde comer en Google, los eventos en Instagram, y recién cuando llegás te enterás de qué se puede hacer. | T2 *(off)* | 44 | 7,7 s |
| **F3** | Hospeda nació para ordenar todo eso. | T3 *(off)* | 14 | 2,5 s |
| **F4** | Queremos que cada destino tenga su oferta turística en un mismo lugar, y que los negocios de la zona tengan una forma nueva de mostrarse. | T3 *(off)* | 47 | 8,2 s |

**Hablado: 22,4 s de 45.** Todas las frases van en off — **ninguna toma de Hospedín tiene
diálogo**, porque el patrón C nunca lo permite.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | *(sin título; la expresión habla sola)* |
| T2 | ninguno fijo — cada ventana del montaje puede llevar una palabra suelta ("Airbnb", "Google", "Instagram", "grupo") si ayuda a leerlo mudo |
| T3 | subtítulo palabra por palabra de F3 y F4 |
| T4 | **hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v4--por-qué-armamos-hospeda) y
> no se cambia acá.

---

## El fondo y por qué nunca cambia

**Fondo 17, primer plano**, el mismo que usa [V9 T1](../v9/t1.md) y
[V21](../v21/montaje.md) entero. Sostiene el video completo: sin pantalla en el plano de
Hospedín, sin objeto en la mano, solo la cara — que es exactamente lo que pide el patrón C,
porque acá el trabajo lo hace la expresión, no la boca.

**Igual lleva voz.** Aunque Hospedín no hable en cámara en ninguna toma, la narración se
genera con la misma técnica que el resto de la serie — tiradas aparte, solo por el
audio — para que el timbre sea el mismo Hospedín de siempre.

---

## El montaje — 45 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–5,0 | 5,0 | Hailuo · `@######ESCENA17#######` | primer plano | agobio, las dos manos sobre la cabeza | *(off)* "Cuando querés viajar a una ciudad, la información está por todos lados." |
| **T2** | 5,0–25,0 | 20,0 | **motion graphics — fuera de este documento** | pantalla completa | montaje rápido de búsquedas dispersas: un mapa, una red social, un buscador, un grupo de mensajes | *(off)* "Buscás alojamiento en un sitio, dónde comer en Google..." |
| **T3** | 25,0–40,0 | 15,0 | **grabación · P1** | pantalla completa | todo se ordena y se convierte en la pantalla de Hospeda | *(off)* "Hospeda nació para ordenar todo eso. Queremos que cada destino..." |
| **T4** | 40,0–45,0 | 5,0 | Hailuo · `@######ESCENA17#######` | primer plano | aliviado, sonrisa que se relaja | — (NO DIALOGUE) |

> Todos los cortes caen en múltiplos de 0,5 s, a 120 BPM. Los cuatro tramos coinciden
> exactamente con los del guion del plan (0–5, 5–25, 25–40, 40–45): no hizo falta
> reajustarlos.

**Dos tiradas de Hailuo** —T1 y T4—, más **dos solo por el audio** (ver
[`voz1.md`](voz1.md) y [`voz2.md`](voz2.md)). T2 no es Hospeda ni Hailuo (ver más abajo) y
T3 es grabación de pantalla.

**Ninguna toma de Hospedín tiene diálogo.** T1 y T4 son reacciones puras — bloque
`NO DIALOGUE` en los dos prompts.

---

## Qué es T2 y por qué no tiene prompt en este documento

**T2 no es Hospeda ni es Hospedín.** Representa el caos de buscar información repartida
en otras herramientas — un mapa, una red social, un buscador, un grupo de mensajes—, y
ninguno de esos elementos existe en [`grabaciones.md`](../grabaciones.md) ni en
[`fondos.md`](../fondos.md): no es una pantalla de la plataforma que se pueda grabar, y no
es un fondo con Hospedín que generar en Hailuo. Se resuelve como **motion graphics o
metraje de archivo genérico**, producido aparte, fuera del alcance de este documento —
ninguna marca ajena real, solo representaciones genéricas de "un mapa", "una red social",
"un buscador", "un grupo de mensajes".

**La transición clave del video pasa en el corte T2 → T3**: el caos colapsa hacia el
centro y se convierte en la pantalla de Hospeda (P1, home). Esa animación de colapso
también es motion graphics, no una generación de Hailuo ni una grabación simple — es la
pieza que más peso visual tiene del video y conviene tratarla como un encargo aparte.

---

## Por qué la pista de voz se parte en dos

**El guion completo son 22,4 s hablados**, y Hailuo tiene un techo duro de 15 s por
tirada. La narración sale de **dos tiradas de audio**, cortadas en la costura natural del
montaje — el corte T2 → T3, donde la imagen ya pasa del caos al orden—:

- [`voz1.md`](voz1.md): F1 + F2 — unos 11,8 s.
- [`voz2.md`](voz2.md): F3 + F4 — unos 10,7 s.

Se descarta el audio de las dos tiradas de imagen y se usan solo estas dos pistas. El
timbre puede variar levemente entre voz1 y voz2 porque son generaciones separadas —
conviene escucharlas una después de la otra antes de dar por buena la narración completa.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 5,0 | 5,0 | tirada T1 · 6 s | 0,0 → 5,0 | 1,0 |
| **T2** | 5,0 → 25,0 | 20,0 | motion graphics · caos de búsquedas | a elección | — |
| **T3** | 25,0 → 40,0 | 15,0 | grabación P1 · home, resuelta | a elección | — |
| **T4** | 40,0 → 45,0 | 5,0 | tirada T4 · 6 s | 0,0 → 5,0 | 1,0 |

### Dónde cae cada tirada de voz

Es narración de punta a punta, no atada a los cortes de imagen: puede cruzar de una toma
a la siguiente, porque la regla 3 del montaje pide que el audio no se corte nunca.

| Frase | En la timeline | Dura | Cruza por encima de | Nota |
|---|---|:-:|:-:|---|
| **F1** *Cuando querés viajar a una ciudad...* | 0,30 → 4,30 | 4,0 | T1 | arranca 0,3 s después del corte de entrada, no pegado al primer frame |
| **F2** *Buscás alojamiento en un sitio...* | 4,80 → 12,50 | 7,7 | T1 → T2 | cruza el corte de las 5,0 |
| **F3** *Hospeda nació para ordenar todo eso.* | 25,50 → 28,00 | 2,5 | T3 | 0,50 s de aire antes de que empiece F4 |
| **F4** *Queremos que cada destino...* | 28,50 → 36,70 | 8,2 | T3 | termina bien antes del corte a T4, a las 40,0 |

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 5,0 | T1 → T2 | primer plano agobiado → motion graphics del caos | medio |
| 25,0 | T2 → T3 | caos → pantalla de Hospeda, colapsando | **alto** |
| 40,0 | T3 → T4 | pantalla completa → primer plano aliviado | medio |

**T2 → T3 es el corte que hace todo el video.** Es la idea entera resuelta en una sola
transición: el caos se ordena. No es un corte seco simple — es la animación de colapso
que se menciona arriba, y vale la pena que sea la pieza mejor producida de todo el video.

### Lo demás

1. **Música desde el frame 1**, instrumental, que acompaña el arco emocional: tensa y
   apretada en T1-T2, se abre y respira en T3, cálida en T4. 120 BPM para que la hoja de
   corte valga tal cual, aunque el ánimo cambie.
2. **Tirar el audio de las dos tiradas de imagen** y usar solo `voz1.md` + `voz2.md`.
3. **Subtítulos palabra por palabra durante T1 y T3** — T2 puede llevar palabras sueltas
   en vez de subtítulo corrido, porque es un montaje rápido de fragmentos.
4. **Nada de transiciones** salvo la de T2 → T3, que es la única con permiso para ser más
   que un corte seco — sigue sin ser un efecto de plantilla: es un colapso motivado.

---

## Qué mirar al revisar las tomas

**Que ninguna de las dos tiradas hable.** Es el riesgo central del patrón C: con una cara
mirando a cámara, lo primero que un modelo inventa es que hable.

**Que T1 muestre agobio simpático, nunca angustia real** — la sección 5 de la biblia pone
un límite ahí, y `AGOBIO` en `expresiones.png` ya está calibrado para eso.

**Que T4 se sienta un alivio genuino, no solo una sonrisa genérica** — es el contraste que
cierra el arco del video.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.
