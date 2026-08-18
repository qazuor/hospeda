# Prompts — cómo está organizado

```
prompts/
├── fondos.md        los 30 fondos de escena, un prompt cada uno
├── personaje.md     las 5 láminas de referencia del personaje
├── grabaciones.md   el estándar del teléfono, las 26 grabaciones y los fijos
└── vN/              una carpeta por video
    ├── montaje.md   diálogo, hoja de corte y los cortes
    ├── capturas.md  qué grabar con el celular y qué fijos hacen falta
    ├── t1.md        una toma por archivo
    ├── t2.md
    └── voz.md       la tirada de la que sale la pista de audio
```

---

## Los marcadores de referencia

Se escriben **`@######POSES#######`**, no `@poses`. En la interfaz de Hailuo hay que
reemplazarlos a mano uno por uno, así que tienen que saltar a la vista dentro del
prompt: un `@algo` en minúscula se pierde en el texto y se escapa.

Cada toma abre con su **tabla de reemplazos**: el archivo que va en cada marcador y
**cuántas veces aparece**, para poder contar y verificar que no quedó ninguno.

---

## Cómo se arma un video

Un video **no es una tirada**. Una tirada de Hailuo es un plano único, y el ritmo de un
reel sale del montaje. Hailuo entrega **tomas**; el video se arma en edición.

### Las tres reglas del montaje

1. **Corte seco, nunca transiciones.** El corte al ritmo de la música ES el dinamismo;
   la transición vistosa es lo que se ve amateur.
2. **Dos tomas seguidas nunca comparten tamaño de plano.** Entre encuadres parecidos la
   imagen salta y se lee como error; si el encuadre cambia de verdad —primer plano →
   plano entero— el ojo lo lee como montaje y ni lo registra.
3. **El audio no se corta nunca.** Música continua y voz corrida por encima de los
   cortes. Es lo que hace que varios planos se sientan una sola cosa.

### Cómo se calculan las duraciones

**Cada toma dura lo que tarda su frase.** Se cuentan las sílabas y se divide por **5,7
por segundo**, que es el ritmo conversacional. Una toma más corta que su frase la corta
por la mitad.

**Los cortes caen en múltiplos de 0,5 s**, que es el pulso a 120 BPM. Con otro tempo se
recalculan.

**Cada frase deja 0,4-0,55 s de aire antes de su corte.** Cortar sobre la última sílaba
se escucha como un tajo.

### Cuánto se le pide a Hailuo

Hailuo va de **4 a 15 segundos**. Casi todas las tomas se piden al mínimo de 4 y se
recorta el sobrante; se pide más solo cuando la frase no entra.

**Nunca pedir mucho más de lo que se usa.** Un clip largo con poco contenido asignado es
lo que empuja al modelo a improvisar — y con una cara mirando a cámara, lo primero que
inventa es que hable.

Por eso todos los prompts tienen la misma estructura de tiempo: **la acción ocurre en la
primera parte y después el personaje sostiene**, con la lista cerrada de lo poco que
puede hacer mientras tanto. El TIMING va siempre en **fracciones del plano, no en
segundos**, así sigue valiendo aunque el clip salga más largo del pedido.

### La pista de voz

**Se genera una sola vez**, en una tirada aparte de la que solo se usa el audio. Si cada
toma clona la voz por su cuenta, el timbre varía entre toma y toma, y eso se nota mucho
más que cualquier corte de imagen.

En edición se descarta el audio de las tiradas de imagen —trae el ambiente de cada
fondo, que se duplicaría en cada corte— y **la pista se corta entre frases**, colocando
cada una en su lugar. No se pega como bloque único: los silencios de la grabación no son
los del montaje.

**Los guiones largos no entran en una tirada.** El techo de Hailuo son 15 s y un video
de 40 o 45 s tiene más voz que eso. Se calcula ANTES de diagramar el montaje —sílabas ÷
5,7 más las pausas— y si supera los 15 s se parte en **dos tiradas consecutivas**,
cortando en una pausa natural del texto. Las dos clonan la misma referencia de voz, así
que el timbre se mantiene; lo que hay que cuidar es que la segunda no arranque con otra
entonación, para lo cual conviene que empiece en oración nueva y no a mitad de frase.

---

## La estructura de un prompt de toma

`FORMAT` → `THE REFERENCES` → `OPENING COMPOSITION` → `ACTION, IN ORDER` → `TIMING` →
`DIALOGUE` → anclas de identidad (`KEEP UNCHANGED`) → `SOUND`.

En inglés, con el diálogo en español marcado `[Spanish]`. Límite ~7000 caracteres.

**Donde el prompt pone un adjetivo, el modelo hace lo que quiere.** Van fracciones y
multiplicadores: "hasta el 78% del ancho", "2,17 veces su ancho", "un cuarto del alto".

**Una toma sin diálogo lleva un bloque `NO DIALOGUE` propio**, del mismo peso visual que
el `DIALOGUE` de las demás, más la lista cerrada de lo que hace mientras sostiene. Para
un modelo, la ausencia de un bloque no es una prohibición: es un hueco que llena solo.

---

## La pantalla del teléfono

**Ningún teléfono entra en cuadro con la pantalla gris.** El gris de los fondos es una
máscara de posición; en la tirada se reemplaza por un fijo real que se adjunta con el
marcador `@######PANTALLA#######`. El estándar del fijo —que es un frame de la
grabación, nunca un screenshot— está en [`grabaciones.md`](grabaciones.md).

El molde probado está en [`v9/t2.md`](v9/t2.md) y [`v30/t2.md`](v30/t2.md). Son cuatro
piezas y van las cuatro:

1. **En la tabla de reemplazos**, con su conteo de apariciones:

   | Marcador | Archivo a adjuntar | Veces |
   |---|---|:-:|
   | `@######PANTALLA#######` | `../../capturas/p1.png` | 3 |

2. **En `THE REFERENCES`**:

   > `@######PANTALLA####### is a real screenshot of a website open in a mobile browser:`
   > `it is exactly what is displayed on the phone screen, and it must be reproduced`
   > `faithfully, never redesigned or reinvented.`

3. **En `OPENING COMPOSITION`**, colgado del teléfono: `...holding a smartphone up in one`
   `hand with its screen facing the camera and showing the website from`
   `@######PANTALLA#######.`

4. **Un bloque `THE PHONE SCREEN` propio**, del mismo peso que los demás:

   > `THE PHONE SCREEN: it always shows the website from @######PANTALLA####### — the`
   > `same layout, colours, logo, headline and search fields, in the same positions,`
   > `sharp and free of glare. Never redesign it and never invent a generic app screen.`

Cuando el teléfono es el de un fondo, va además el ancla de forma, para que el modelo no
lo reemplace por otro modelo de celular al dibujarle contenido:

> `THE PHONE: its shape, proportions and screen aspect ratio are exactly those of the`
> `phone in @######ESCENAN#######. Do not reshape it and do not substitute a different`
> `phone model.`

### El teléfono quieto es innegociable

Cuando el teléfono queda en primer plano, **tiene que tener cero movimiento**. No es una
preferencia estética: la grabación real se compone después dentro de ese marco, y un
marco que deriva, escala o rota obliga a trackearlo cuadro a cuadro. Con un objeto
animado por un modelo de video, ese track no cierra nunca.

**El resto de la escena sí se puede mover** —el entorno, el pelo, la ropa, la gente de
fondo, la respiración del personaje—. Lo único congelado es el teléfono.

Se pide en dos lugares a la vez, porque con uno solo el modelo lo desobedece:

- **En el `TIMING`**, cerrando el tramo largo del plano:

  > `30-100% the phone is held completely still in close-up. No drift, no creeping`
  > `forward, no scale change.`
  >
  > `The phone must never still be moving after 30%.`

- **En la lista cerrada de lo que hace mientras sostiene**, dejando el teléfono afuera
  de todo lo que se mueve: `he holds the phone up steadily with both the phone and the`
  `framing completely still`.

En las tomas de patrón B el mismo requisito cae sobre el rectángulo del inserto, que
además no puede taparse con la mano ni con el brazo.

---

## Los patrones y su efecto en el montaje

El patrón asignado a cada video está en la tabla *Puesta en escena por video* de
[`../plan-videos.md`](../plan-videos.md).

| Patrón | Qué implica para el montaje |
|---|---|
| **A** portal | El celular viaja a primer plano y ahí se compone la grabación. Consume muchas acciones: es el que más se aprieta contra el límite |
| **B** presentador al costado | La grabación va en el teléfono flotante y **puede durar lo que quiera**: es el patrón de los videos largos de plataforma |
| | *Cómo se logra*: se genera una apertura corta, se **congela su último frame** y la grabación se compone sobre ese freeze todo el tiempo que haga falta. Así el plano dura más que el techo de 15 s de Hailuo sin pedirle al modelo que sostenga al personaje |
| | *Cuándo NO usar el inserto*: si lo que hay que mostrar tiene texto o números chicos. A 311 px solo se leen títulos y botones, así que el recorrido detallado va a **pantalla completa** y el teléfono flotante queda vacío, usado solo en las tomas que abren y cierran |
| **C** reacción sin lip sync | **No habla**: todo el mensaje va en texto y voz en off. Elimina el lip sync, que es lo más frágil, así que los planos pueden ser más largos |
| **D** objeto en la mano | El objeto es el argumento. Sin pantalla; si hace falta, se combina con B |
| **E** llega al lugar | "Llega y frena", nunca "camina de punta a punta": el recorrido largo es de los pedidos que más rompen el parecido |
| **F/G** sentado | Cambia el registro sin cambiar el personaje. Barato en acciones |
| **H** selfie | La cámara la sostiene él. El más rápido de producir |
| **I** primer plano | La expresión hace el trabajo. Ideal para remates |
| **J/K/L** apoyado, en contacto, plano general | Bajo costo de acciones; el fondo pesa más que el personaje |

---

## Qué mirar en cada tirada

**Que arranque hablando en el frame 1**, sin respiro ni mirada previa. Es lo primero que
el modelo desobedece. Si pasa, se recorta el arranque: para eso está el sobrante.

**Que la acción termine donde dice el TIMING** y después sostenga. Si estira el gesto
hasta el final, no queda margen para cortar.

**Que el círculo naranja no se pegue a la cabeza** ni caiga en la franja derecha.

**En las tomas con teléfono, que la pantalla sea la del fijo y quede quieta.** Que
Hailuo no la haya rediseñado ni inventado una app genérica, y que no derive, parpadee ni
cambie de contenido a lo largo del clip.

**En la tirada de voz, que no haya ambiente audible** y que la última frase esté
completa: es lo único irrecuperable en edición.
