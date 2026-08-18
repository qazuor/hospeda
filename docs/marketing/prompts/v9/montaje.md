# V9 · Sin comisión por reserva — montaje

Prompts y montaje de **[V9](../../plan-videos.md#v9--sin-comisión-por-reserva)**: un corto
de 20 s armado con **cinco tiradas de Hailuo, grabación de pantalla y la placa de
cierre**.

Es el molde de los demás videos: la estructura de este documento —diálogo, montaje,
prompt por toma, hoja de corte— se repite en todos.

---

## El diálogo completo

**Esto es lo que se escucha de punta a punta cuando el montaje está terminado**, en
orden y sin cortes. Es una sola idea dicha una sola vez: el video no dice nada más.

> En Hospeda no cobramos comisión por cada reserva.
>
> Publicás tu alojamiento, el turista te escribe directo, y la reserva, el pago y la
> relación con tu huésped siguen siendo tuyos.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | En Hospeda no cobramos comisión por cada reserva. | T1 | 17 | 3,0 s |
| — | *(beat visual, sin voz)* | T2 | — | 1,5 s |
| **F2** | Publicás tu alojamiento, | T3 | 9 | 1,6 s |
| **F3** | el turista te escribe directo, | T4 | 11 | 1,9 s |
| — | *(solo música)* | T5 | — | 3,0 s |
| **F4** | y la reserva, el pago y la relación con tu huésped siguen siendo tuyos. | T6 | 23 | 4,0 s |
| — | *(solo música)* | T7 | — | 3,0 s |

**Hablado: 10,5 s de 20.** El resto son los dos beats visuales, la grabación de pantalla
y la placa de cierre.

Y lo que se **lee** en pantalla, que no se dice en voz:

| Cuándo | Texto |
|---|---|
| T1–T2 | **Sin comisión por reserva.** |
| T3–T6 | subtítulo palabra por palabra de F2, F3 y F4 |
| T7 | **Publicá tu alojamiento en hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v9--sin-comisión-por-reserva) y no
> se cambia acá: si hay que ajustarlo, se ajusta allá primero. Ojo con dos cosas que ya
> están decididas y no se relitigan: **nunca decir "sin tarjeta"** y **cero precios**.

---

> **Los marcadores de referencia van así**: `@######POSES#######`, no `@poses`. Como en
> la interfaz de Hailuo hay que reemplazarlos a mano uno por uno, tienen que saltar a la
> vista dentro del prompt: un `@algo` en minúscula se pierde en el texto y se escapa.
> Cada toma arranca con la **tabla de reemplazos**, con el archivo que va en cada
> marcador y **cuántas veces aparece** — así se puede contar y verificar que no quedó
> ninguno sin reemplazar.

---

## Las tres reglas del montaje

1. **Corte seco, nunca transiciones.** Ni fundidos ni wipes. El corte al ritmo de la
   música ES el dinamismo; la transición vistosa es lo que se ve amateur.
2. **Dos tomas seguidas nunca comparten tamaño de plano.** Si cortás entre encuadres
   parecidos, la imagen salta y se lee como error. Si el encuadre cambia de verdad
   —primer plano → plano entero— el ojo lo lee como montaje y ni lo registra.
3. **El audio no se corta nunca.** Música continua y voz corrida por encima de los
   cortes. Es el pegamento: hace que seis planos se sientan una sola cosa.

---

## Los cuatro fondos son el mismo lugar

No hay que generar nada nuevo. Cuatro de los fondos ya aprobados son la **misma playa
de río**, con cuatro tamaños de plano distintos:

| Fondo | Plano | Qué tiene |
|---|---|---|
| `escena17` | **primer plano** | cabeza y hombros, balneario desenfocado detrás |
| `escena7` | **plano entero** | de cuerpo entero, con el celular ya en alto |
| `escena22` | **plano entero con inserto** | el rectángulo gris vacío donde se compone la grabación |
| `escena28` | **plano corto / selfie** | ángulo de brazo extendido, sombrillas al fondo |

Misma arena clara, mismo río, misma luz de mediodía, mismos árboles al fondo. Cortar
entre ellos se lee como varias cámaras en la misma escena.

---

## El montaje — 20 segundos, 6 cortes

La duración sale del plan: V9 es un corto de 20 s.

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–3,5 | 3,5 | Hailuo · `@######ESCENA17#######` | primer plano | niega con la cabeza y con el índice | *"En Hospeda no cobramos comisión por cada reserva."* |
| **T2** | 3,5–5,0 | 1,5 | Hailuo · `@######ESCENA7#######` | entero | empuja el celular hacia la cámara de golpe | — (respiro, solo música) |
| **T3** | 5,0–7,0 | 2,0 | **grabación** | pantalla | la ficha del alojamiento, scroll | *"Publicás tu alojamiento,"* |
| **T4** | 7,0–9,5 | 2,5 | Hailuo · `@######ESCENA22#######` | entero con inserto | señala el inserto: **el botón de contacto** | *"el turista te escribe directo,"* |
| **T5** | 9,5–12,5 | 3,0 | **grabación** | pantalla | **el mensaje del turista llegando** | — (solo música) |
| **T6** | 12,5–17,0 | 4,5 | Hailuo · `@######ESCENA28#######` | plano corto | gesto abierto, sonrisa grande, guiño | *"y la reserva, el pago y la relación con tu huésped siguen siendo tuyos."* |
| **T7** | 17,0–20,0 | 3,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, que es el pulso de una música a
> **120 BPM**. No es casualidad ni comodidad de redondeo: la regla 2 del montaje pide
> cortar sobre el beat, y para eso los límites tienen que ser múltiplos del pulso. Si
> elegís una música a otro tempo, hay que recalcularlos: a 100 BPM el pulso es 0,6 s.

**Mudo con el personaje en cuadro: 1,5 s de 20 (7,5%).**

> **Cuatro tiradas de Hailuo para imagen** —T1, T2, T4 y T6—, más **una quinta sólo por
> el audio** (ver [`voz.md`](voz.md)).
> T3 y T5 son grabación de pantalla y T7 es la placa que ya existe.

---

> **De dónde salen estas duraciones.** Cada toma dura lo que tarda su frase. Contando
> sílabas a ritmo conversacional (unas 5,7 por segundo): F1 son 17 sílabas → 3,0 s ·
> F2 son 9 → 1,6 s · F3 son 11 → 1,9 s · F4 son 23 → 4,0 s. Una toma más corta que su
> frase la corta por la mitad.

### Qué se ve en cada pantalla

Cuatro tomas muestran una pantalla, y **no son lo mismo**: dos son grabación a pantalla
completa, una es grabación compuesta dentro de un recuadro, y una la genera Hailuo.

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T2** | la home de Hospeda en el celular que sostiene | **la genera Hailuo** desde `@######PANTALLA#######` | No, y no hace falta |
| **T3** | la ficha del alojamiento: fotos, título, datos | grabación, pantalla completa | Sí |
| **T4** | el botón de contacto, ampliado | grabación, **compuesta en el recuadro** | Solo lo grande |
| **T5** | el mensaje del turista llegando | grabación, pantalla completa | Sí |

**Los tres momentos de grabación cuentan una progresión** y por eso no repiten:
publicación (T3) → contacto (T4) → mensaje (T5). Si dos muestran lo mismo, el montaje
se siente redundante aunque los planos cambien.

**T2 no se compone en edición.** La pantalla del celular la dibuja Hailuo a partir de
`@######PANTALLA#######` — por eso el prompt insiste en reproducirla fielmente y no
rediseñarla. Componerla encima habría que trackearla, y en el tramo que se usa el
celular está en movimiento. Tampoco hace falta: son 1,5 s de un objeto que viaja hacia
la cámara, y lo único que tiene que lograr es **leerse como Hospeda** —el color, el
logo, la forma general—, no que se distinga una palabra. Si sale deformada o rediseñada,
se regenera la tirada; no se arregla en edición.

**El recuadro de T4 mide 271 × 453 px** sobre el fondo de 941 × 1672, o sea **311 × 520
px** en un video de 1080 × 1920.

> ⚠️ **Su relación es 0,5982 y la del teléfono real es 0,4615**: el recuadro actual es
> notoriamente más ancho que la grabación que va adentro. El fondo de patrón B hay que
> regenerarlo con un **teléfono** en lugar de un rectángulo — ver
> [`grabaciones.md`](../grabaciones.md), que fija el estándar para los 37 videos. Mientras tanto, la grabación entra deformada o con bandas.

---

> ⚠️ **Pero 311 px de ancho es el 29% de una pantalla de 1080.** Si ahí adentro va la
> ficha completa, todo el texto queda al 29% de su tamaño y un cuerpo de 16 px cae por
> debajo de 5: ilegible. Adentro del recuadro va **un recorte ampliado**, no la pantalla
> entera — la zona del botón de contacto encuadrada de modo que llene el recuadro. Regla
> práctica: si en la grabación original el elemento no es un título o un botón, en el
> recuadro no se va a leer.

### Texto en pantalla

- **T1–T2**: **"Sin comisión por reserva."** grande, entrando en el frame 1.
- **T3–T6**: subtítulo palabra por palabra, sincronizado con la voz.
- **T7**: *Publicá tu alojamiento en hospeda.com.ar*

Todo el texto va dentro de la zona segura: fuera de los **250 px de arriba, 420 de
abajo y 180 de la derecha** sobre 1080×1920.

---

## Cómo se recorta cada tirada

**Hailuo va de 4 a 15 segundos.** Los 15 son un techo duro; los 4, el piso. Las tomas
del montaje duran entre 1,4 y 4,5 s, así que casi todas se piden **al mínimo de 4** y se
recorta el sobrante:

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 3,5 s | la frase son 3,0 s: en menos se corta |
| T2 | 4 s | 1,5 s | es un beat visual, no hay frase |
| T4 | 4 s | 2,5 s | la frase son 1,9 s |
| T6 | 6 s | 4,5 s | la frase son 4,0 s y no entra en 4 |
| **voz** | **15 s** | sólo el audio | el guion entero son ~11,3 s: se pide el máximo para que no trunque la última frase |

> **Se puede probar pedir menos de 4** —sobre todo en T2, que solo necesita 1,4—. Si el
> sistema devuelve 4 igual, no se pierde nada: el sobrante es margen de recorte. Lo que
> **nunca** hay que hacer es pedir mucho más de lo que se usa, porque el clip largo con
> poco contenido asignado es justamente lo que empuja al modelo a improvisar.

Por eso todos los prompts de abajo tienen la misma estructura de tiempo: **la acción
ocurre en la primera parte del clip y después el personaje sostiene**, con la lista
cerrada de lo poco que puede hacer mientras tanto. Y el TIMING va siempre en
**fracciones del plano, no en segundos**: así sigue siendo correcto aunque el sistema
devuelva un clip más largo del que se pidió.

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 20,0 s a 120 BPM. **Todas las tiradas se usan desde
su primer frame**, porque los prompts piden que la acción arranque ahí: si alguna sale
con un respiro o una mirada antes de la primera palabra, se recorta ese arranque y se
corre el punto de entrada, que es para lo que existe el sobrante.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 3,5 | 3,5 | tirada T1 · 4 s | 0,0 → 3,5 | 0,5 |
| **T2** | 3,5 → 5,0 | 1,5 | tirada T2 · 4 s | 0,0 → 1,5 | 2,5 |
| **T3** | 5,0 → 7,0 | 2,0 | grabación · ficha | a elección | — |
| **T4** | 7,0 → 9,5 | 2,5 | tirada T4 · 4 s | 0,0 → 2,5 | 1,5 |
| **T5** | 9,5 → 12,5 | 3,0 | grabación · mensaje | a elección | — |
| **T6** | 12,5 → 17,0 | 4,5 | tirada T6 · 6 s | 0,0 → 4,5 | 1,5 |
| **T7** | 17,0 → 20,0 | 3,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** *En Hospeda no cobramos comisión por cada reserva.* | 0,00 → 3,00 | 3,0 | T1 | 0,50 |
| **F2** *Publicás tu alojamiento,* | 5,00 → 6,60 | 1,6 | T3 | 0,40 |
| **F3** *el turista te escribe directo,* | 7,05 → 8,95 | 1,9 | T4 | 0,55 |
| **F4** *y la reserva, el pago y la relación…* | 12,60 → 16,60 | 4,0 | T6 | 0,40 |

> ⚠️ **La pista de voz NO se pega como un bloque único.** Es una sola grabación —por eso
> el timbre es idéntico— pero **se corta entre frases y cada frase se posiciona en su
> lugar**. En la grabación las frases salen con las pausas que quedaron; en el montaje
> tienen que caer donde dice esta tabla, y los silencios no coinciden. Pegarla entera y
> confiar en que calce es la forma más rápida de que F2 arranque sobre el final de T2.

**Ninguna frase toca su corte**: siempre queda entre 0,4 y 0,55 s de aire antes de que
la imagen cambie. Es deliberado — cortar sobre la última sílaba se escucha como un tajo.

### Los seis cortes, uno por uno

Todos son **corte seco**. Lo que cambia es de qué a qué, y cuánto riesgo tiene cada uno.

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 3,5 | T1 → T2 | primer plano → plano entero | bajo |
| 5,0 | T2 → T3 | **entra** en la pantalla | medio |
| 7,0 | T3 → T4 | **sale** de la pantalla | **alto** |
| 9,5 | T4 → T5 | entra en la pantalla | bajo |
| 12,5 | T5 → T6 | sale de la pantalla, al cierre | bajo |
| 17,0 | T6 → T7 | plano corto → placa | bajo |

El montaje alterna **persona / pantalla / persona / pantalla / persona**, que es lo que
le da el pulso. Los dos cortes que hay que cuidar son el segundo y el tercero.

**T2 → T3 · el riesgo es el jump.** Los dos planos son "una pantalla grande", y la
regla 2 dice que dos tomas seguidas no compartan tamaño de plano. Lo que las separa es
que en T2 se ve *un celular como objeto* y en T3 se está *dentro de la pantalla*, sin
marco ni contexto. Para que esa diferencia se lea:

- **En T2 el celular no puede tapar el cuadro.** El prompt ya pide que se le vean los
  cuatro bordes y una franja de playa alrededor; hay que verificarlo en la tirada, no
  darlo por hecho.
- **T3 arranca directamente en la ficha, no en la home.** Si abre con la misma home que
  muestra T2 —dibujada por Hailuo, o sea aproximada— el corte se lee como un error de
  continuidad en lugar de un salto de escala.

**T3 → T4 · el riesgo es que se sienta un retroceso.** El espectador venía viendo la
pantalla grande y legible, y se lo saca afuera para mostrarle **otra pantalla, más
chica**, dentro de un recuadro de 311 px. Eso se percibe como que se le quita algo.

Se resuelve con lo que va adentro del recuadro: **no puede parecer "lo mismo pero más
chico"**. Ahí va el botón de contacto **muy ampliado, casi a nivel de ícono** — no la
ficha, no una miniatura de la pantalla completa. Así los tres momentos de pantalla se
leen como un zoom narrativo que avanza: la ficha entera (T3) → el punto exacto donde el
turista toca (T4) → el mensaje que llega (T5).

> ⚠️ **T3 y T5 están separados por solo 2,5 s y las dos son pantalla completa.** Si se
> parecen, el espectador siente que volvió al mismo lugar y el montaje pierde avance.
> T5 tiene que verse claramente distinto: el mensaje llegando, no la ficha otra vez.

### Lo demás

1. **Música desde el frame 1**, instrumental, alegre, **120 BPM** para que la hoja de
   corte de arriba valga tal cual. Con otro tempo hay que recalcular los límites.
2. **Los cortes van sobre el beat.** Un corte a destiempo se siente como un error; el
   mismo corte sobre el pulso se siente intencional.
3. **Tirar el audio de las cuatro tiradas** y usar solo la pista de voz. El audio de
   Hailuo trae el ambiente de playa de cada toma: si se deja, se superpone con el de la
   toma siguiente en cada corte.
4. **Subtítulos palabra por palabra**, grandes, dentro de la zona segura. En vertical
   suben mucho la retención: buena parte del feed se mira sin sonido.
5. **Nada de transiciones.** Corte seco en los seis.

---

## Lo que sigue bloqueado

**T3 y T5 necesitan la grabación de pantalla con una cuenta de anfitrión real** (no la
de super admin: tiene datos internos y otra interfaz). Son 7 de los 20 segundos.

Las cuatro tiradas de Hailuo se pueden generar y evaluar **ya**: alcanzan para ver si el
método de montaje funciona antes de escribir los otros 34 videos, que es exactamente
para lo que existe esta prueba.

---

## Qué mirar al revisar las tomas

**Que arranque hablando en el frame 1.** Es lo primero que el modelo tiende a desobedecer:
mete un respiro o una mirada antes de la primera palabra. Si lo hace, la toma se puede
salvar recortando ese arranque — para eso se generan 6 s.

**Que la acción termine donde dice el TIMING** y después sostenga. Si el modelo estira
el gesto hasta el final del clip, no queda margen para cortar.

**Que el rectángulo de T4 quede vacío y quieto.** Es el que más riesgo tiene: los
modelos tienden a llenar una superficie vacía.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las cuatro.
