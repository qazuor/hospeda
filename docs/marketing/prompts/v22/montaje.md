# V22 · Presencia en Google y en las IA — montaje

Prompts y montaje de **[V22](../../plan-videos.md#v22--presencia-en-google-y-en-las-ia)**:
una publicación de 45 s armada con **cuatro tiradas de Hailuo, dos grabaciones de
pantalla y la placa de cierre**.

Usa el **patrón D** —objeto en la mano, la lamparita de idea— sobre el **fondo 4**,
costanera del río, y cierra en **fondo 17**, primer plano, siguiendo la combinación
"cualquiera → I" para el remate. Es un video **largo**: la voz en off hace el trabajo
pesado y Hospedín aparece hablando solo en la apertura, el remate y el cierre — el resto
del tiempo lo lleva la grabación de pantalla o Hospedín reaccionando en silencio.

---

## El diálogo completo

**Esto es lo que se escucha**, de punta a punta, en el orden en que se dice. Es una
narración continua: no todo va en boca de Hospedín, buena parte se agrega en off.

> Hoy un turista te puede encontrar buscando en Google, en redes, o preguntándole a una
> inteligencia artificial.
>
> Por eso importa que tu negocio tenga información clara en internet.
>
> Una publicación en Hospeda suma otra presencia asociada a tu actividad y a tu destino,
> que los buscadores pueden encontrar.
>
> No hay fórmulas mágicas para aparecer primero, pero sí se pueden hacer las cosas bien
> para que te encuentren más.
>
> ⚠️ **La última frase es obligatoria.** Sin ella el video promete posiciones que nadie
> puede garantizar — no se acorta ni se resume.

Repartido en las tomas. La primera frase se divide en dos mitades porque junta 38
sílabas —6,7 s— y la regla de planos hablados cortos pide partir todo lo que pase de
6 s:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1a** | Hoy un turista te puede encontrar buscando en Google, en redes, | T1 | 20 | 3,5 s |
| **F1b** | o preguntándole a una inteligencia artificial. | T2 *(off)* | 18 | 3,2 s |
| **F2** | Por eso importa que tu negocio tenga información clara en internet. | T3 *(off)* | 23 | 4,0 s |
| **F3** | Una publicación en Hospeda suma otra presencia asociada a tu actividad y a tu destino, que los buscadores pueden encontrar. | T4 *(off)* | 44 | 7,7 s |
| **F4** | No hay fórmulas mágicas para aparecer primero, | T5 | 17 | 3,0 s |
| **F5** | pero sí se pueden hacer las cosas bien para que te encuentren más. | T6 | 20 | 3,5 s |

**Hablado: 24,9 s de 45.** Solo **T1, T5 y T6** están lip-synced — la apertura, el
remate y el cierre. F1b, F2 y F3 se escuchan en off mientras la pantalla o Hospedín en
silencio llevan la imagen.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1–T2 | **¿Te encuentran en internet?** |
| T3 | (sin título; la reacción habla sola) |
| T4 | subtítulos de F3 + textos de apoyo: "Google", "buscadores" resaltados sobre la grabación |
| T5–T6 | subtítulo palabra por palabra de F4 y F5 |
| T7 | **Publicá tu alojamiento en hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v22--presencia-en-google-y-en-las-ia)
> y no se cambia acá.

---

## El objeto: la lamparita de idea

**No está entre las dieciocho poses aprobadas de `acciones.png`.** El documento de
patrones la nombra dos veces —acá y en V14— como objeto válido del patrón D, pero la
lámina de referencia todavía no la incluye. Se describe en el prompt siguiendo la misma
gramática visual que los objetos que sí están aprobados —valija, mochila, mapa, cámara—:
simple, estilizada, del mismo estilo 3D, que nunca tapa la cara ni el logo ni desplaza
el círculo naranja.

> ⚠️ **Pendiente de agregar a `acciones.png`.** Hasta que exista esa referencia, cada
> tirada de este video es la única fuente de verdad de cómo se ve el objeto — conviene
> revisar que las tres (T1, T3, T5) lo dibujen igual entre sí antes de dar por buena
> ninguna.

**El fondo 4 no se regenera.** Su imagen ya existe con Hospedín sosteniendo un celular
de pantalla vacía — es el fondo genérico de "plano entero de frente" que comparten los
primeros doce. El patrón D pide que en vez de eso sostenga otra cosa, así que el prompt
mantiene de `escena4.png` todo lo que no es el objeto en la mano —la postura, el fondo,
la luz, el encuadre— y **reemplaza explícitamente** el celular por la lamparita. Es una
decisión deliberada, documentada acá porque no hay una lámina "fondo 4 con lamparita" que
generar aparte.

---

## El montaje — 45 segundos, 6 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,0 | 4,0 | Hailuo · `@######ESCENA4#######` | entero, D lamparita | enumera los canales, mirando a cámara | *"Hoy un turista te puede encontrar buscando en Google, en redes,"* |
| **T2** | 4,0–9,0 | 5,0 | **grabación · E2** | pantalla completa | consulta a una IA que menciona un alojamiento | *(off)* "o preguntándole a una inteligencia artificial." |
| **T3** | 9,0–14,0 | 5,0 | Hailuo · `@######ESCENA4#######` | entero, D lamparita | mira la lamparita, cae la ficha, la lamparita brilla más | *(off)* "Por eso importa que tu negocio tenga información clara en internet." |
| **T4** | 14,0–32,0 | 18,0 | **grabación · E1** | pantalla completa | búsqueda en Google que devuelve la ficha, scroll y acercamiento al resultado | *(off)* "Una publicación en Hospeda suma otra presencia asociada a tu actividad y a tu destino, que los buscadores pueden encontrar." |
| **T5** | 32,0–35,5 | 3,5 | Hailuo · `@######ESCENA4#######` | entero, D lamparita | admite el límite, tono franco | *"No hay fórmulas mágicas para aparecer primero,"* |
| **T6** | 35,5–39,5 | 4,0 | Hailuo · `@######ESCENA17#######` | primer plano | cierra con calidez | *"pero sí se pueden hacer las cosas bien para que te encuentren más."* |
| **T7** | 39,5–45,0 | 5,5 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> Todos los cortes caen en múltiplos de 0,5 s, a 120 BPM.

**Cuatro tiradas de Hailuo** —T1, T3, T5 y T6—, más **dos solo por el audio** (ver
[`voz1.md`](voz1.md) y [`voz2.md`](voz2.md)). T2 y T4 son grabación de pantalla y T7 es
la placa que ya existe.

**Solo T1, T5 y T6 llevan `DIALOGUE`.** T3 es reacción sin hablar — bloque `NO DIALOGUE`
— con la voz de F2 puesta encima en edición, igual que las tomas mudas de V9 y V21.

### Por qué T6 cambia de fondo

**T5 → T6 es la combinación "cualquiera → I"**: cerrar el remate en primer plano. Cambia
el plano —de entero a primer plano— así que la regla 2 del montaje queda cubierta, y el
primer plano le da al cierre el peso que la última frase necesita. En primer plano no se
le ven las manos, así que la lamparita **no** aparece en T6 — no hace falta, alcanza con
la cara.

---

## Por qué la pista de voz se parte en dos

**El guion completo son cerca de 25 s hablados**, y Hailuo tiene un techo duro de 15 s
por tirada. Por eso la narración no sale de una sola tirada de audio como en V9 o V21,
sino de **dos**, cortadas en la costura natural del montaje —el corte T3 → T4, donde la
imagen ya cambia de reacción a grabación—:

- [`voz1.md`](voz1.md): F1a + F1b + F2 — unos 11,3 s.
- [`voz2.md`](voz2.md): F3 + F4 + F5 — unos 14,8 s.

Es la misma técnica de siempre —descartar el audio de las cuatro tiradas de imagen y
usar sólo estas pistas—, sólo que en dos partes en vez de una. El riesgo que agrega:
**el timbre puede variar levemente entre voz1 y voz2** porque son generaciones
separadas. Conviene escucharlas una después de la otra antes de dar por buena la
narración completa.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 4,0 | 4,0 | tirada T1 · 4 s | 0,0 → 4,0 | — |
| **T2** | 4,0 → 9,0 | 5,0 | grabación E2 · consulta IA | a elección | — |
| **T3** | 9,0 → 14,0 | 5,0 | tirada T3 · 6 s | 0,0 → 5,0 | 1,0 |
| **T4** | 14,0 → 32,0 | 18,0 | grabación E1 · búsqueda Google | a elección | — |
| **T5** | 32,0 → 35,5 | 3,5 | tirada T5 · 4 s | 0,0 → 3,5 | 0,5 |
| **T6** | 35,5 → 39,5 | 4,0 | tirada T6 · 4 s | 0,0 → 4,0 | — |
| **T7** | 39,5 → 45,0 | 5,5 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1a** *Hoy un turista te puede encontrar…* | 0,00 → 3,51 | 3,5 | T1 | 0,49 |
| **F1b** *o preguntándole a una inteligencia artificial.* | 4,20 → 7,36 | 3,2 | T2 | 1,64* |
| **F2** *Por eso importa que tu negocio…* | 9,30 → 13,34 | 4,0 | T3 | 0,66 |
| **F3** *Una publicación en Hospeda suma…* | 14,30 → 22,02 | 7,7 | T4 | 9,98* |
| **F4** *No hay fórmulas mágicas…* | 32,00 → 34,98 | 3,0 | T5 | 0,52 |
| **F5** *pero sí se pueden hacer…* | 35,50 → 39,01 | 3,5 | T6 | 0,49 |

> \* **En T2 y T4 el aire hasta el corte es mucho más largo que en el resto**, y es
> deliberado: son las dos grabaciones, y el video es largo — después de que la voz
> termina la frase, la pantalla se queda un rato más para que la demostración se lea
> entera. No es aire de corte al ritmo, es tiempo de demostración. Rellenar ese tramo con
> texto de apoyo en pantalla (regla 1: tiene que entenderse mudo) para que no se sienta
> vacío.

### Los seis cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,0 | T1 → T2 | entero con lamparita → pantalla completa | medio |
| 9,0 | T2 → T3 | pantalla completa → entero con lamparita | bajo |
| 14,0 | T3 → T4 | entero con lamparita → pantalla completa | medio |
| 32,0 | T4 → T5 | pantalla completa → entero con lamparita | bajo |
| 35,5 | T5 → T6 | entero → primer plano | bajo (motivado por la combinación cualquiera→I) |
| 39,5 | T6 → T7 | primer plano → placa | bajo |

**T3 → T4 es el corte más importante del video.** Es donde la idea abstracta ("por eso
importa") se convierte en la prueba concreta (la búsqueda real en Google). El brillo
creciente de la lamparita en T3 tiene que resolverse justo antes del corte, no después,
para que funcione como el gesto que "enciende" la demostración que sigue.

### Lo demás

1. **Música desde el frame 1**, instrumental, de fondo, sin protagonismo — es un video
   explicativo, no una pauta de choque. 120 BPM para que la hoja de corte valga tal cual.
2. **Tirar el audio de las cuatro tiradas de imagen** y usar sólo `voz1.md` + `voz2.md`.
3. **Subtítulos palabra por palabra en las tres tomas habladas** (T1, T5, T6) y también
   sobre las grabaciones (T2, T4), porque ahí la voz sigue sonando en off.
4. **En T4, resaltar visualmente** el nombre del alojamiento y la palabra "Google" en la
   grabación —círculo, subrayado o un pequeño zoom— para que el punto se entienda sin
   sonido incluso en el tramo mudo después de F3.
5. **Nada de transiciones**: corte seco en los seis, salvo T5→T6 que puede resolverse con
   un leve zoom hacia el rostro si el editor lo prefiere — sigue siendo un movimiento
   simple, no una transición de las prohibidas.

---

## Qué mirar al revisar las tomas

**Que la lamparita se vea igual en T1, T3 y T5.** Es un objeto nuevo, sin lámina de
referencia propia — el criterio de continuidad lo pone esta tirada, no una imagen
aprobada de antemano.

**Que T3 no hable.** Es la única reacción del video: si el modelo le mueve la boca, no
sirve.

**Que en T6 el círculo naranja entre completo** en el primer plano — es el error más
fácil del patrón I.

**Que voz1 y voz2 suenen como la misma persona.** Es el costo de partir la narración en
dos tiradas: hay que confirmarlo antes de armar el resto del montaje sobre esa base.

**Que T4 no se sienta vacío en el tramo sin narración.** Nueve segundos y medio de
grabación sin voz necesitan texto de apoyo en pantalla o el video pierde ritmo justo en
su escena central.
