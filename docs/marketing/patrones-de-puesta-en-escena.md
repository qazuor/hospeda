# Patrones de puesta en escena

Trece formas distintas de armar un video con Hospedín. Son genéricas: no pertenecen a
ningún video en particular. A la hora de escribir un prompt se elige **un patrón** y
**un fondo** (ver [`prompts/fondos.md`](prompts/fondos.md)), y recién ahí se le
mete el guion del video que corresponda.

> **Vocabulario.** Acá *patrón* es el comportamiento del personaje y *fondo* es el
> lugar. Los archivos se llaman `escenas/escenaN.png` pero son **fondos** — el nombre
> quedó de antes y conviene no confundirlo con estos patrones.

## Por qué existen

Sin patrones, los 37 videos salen iguales: Hospedín parado, celular en la mano,
habla, acerca el celular, lo aleja, termina de hablar. El plan de videos ya pide
variedad —V4 pide agobio con las manos en la cabeza, V16 pide cara de susto, V24 pide
comparar fotos— y la aplanamos mientras resolvíamos el problema técnico de meter la
grabación de pantalla sin que el personaje derivara. Ese problema ya está resuelto.

Cada patrón también tiene un costo técnico distinto. Algunos consumen muchas acciones
por generación y quedan al filo de los 15 segundos; otros casi ninguna. Eso importa
tanto como la variedad visual.

## Los tres ejes

Los patrones no varían una sola cosa. Varían tres, y conviene tenerlas separadas
porque se combinan entre sí:

| Eje | Opciones |
|---|---|
| **La pose** | de pie · apoyado · sentado · en movimiento · en contacto con el lugar |
| **La escala del plano** | primer plano · plano medio · plano entero · plano general |
| **Quién sostiene la cámara** | una cámara externa · el propio Hospedín (selfie) |

El más desaprovechado es el segundo. **Los doce fondos actuales son todos plano entero
o medio, con la cámara fija a la altura del pecho y él mirando al lente.** Eso uniforma
más que la pose: se pueden cambiar todas las poses del mundo y, si la escala no cambia,
los videos siguen pareciendo el mismo.

---

## A · El portal

Hospedín habla a cámara y, **sin dejar de hablar**, acerca el celular hasta primer
plano. Ahí queda quieto un instante: ése es el hueco donde después se compone la
grabación de pantalla. Después lo aleja, girándolo para que la pantalla deje de
mirar a cámara, y cierra hablando.

**Para qué sirve**: un mensaje corto más una demostración corta.

**Por qué funciona**: la transición está motivada. El objeto ya está en escena, así
que no aparece nada de la nada, y visualmente se entiende que lo que sigue pasa en
ese teléfono.

**Costo**: es el patrón que más acciones consume — leer, hablar, acercar, frenar,
alejar, hablar otra vez. Por eso siempre queda al filo de los 15 segundos. Si el
diálogo crece, algo se trunca.

**Requisitos**: el celular llega grande pero **con sus bordes visibles**, no tapando
el cuadro, y **frena del todo**. La grabación se compone adentro del rectángulo de la
pantalla, con dos keyframes; sin ese frenado hace falta tracking.

**Ya probado en**: V9, V30.

---

## B · El presentador al costado

Hospedín se para a un lado del cuadro y señala **un espacio vacío**, donde después se
compone la grabación de pantalla como inserto. No hay portal: el personaje y la
pantalla conviven durante todo el video.

**Para qué sirve**: los videos largos que muestran mucha plataforma — recorridos por
una ficha, un alta completa, un panel de estadísticas.

**Por qué funciona**: **la grabación puede durar lo que quiera**, porque no depende de
la generación. Y le pedís muchísimo menos movimiento al modelo: menos deriva del
personaje y más tiempo de habla.

**Costo**: muy bajo. Es el patrón más barato en acciones.

**Requisitos**: tiene que señalar y mirar hacia un vacío que al generar no existe. Se
resuelve **componiendo un rectángulo gris plano en la imagen de referencia**, en el
lugar exacto donde después va el inserto. Sin eso, mira a la nada y se nota.

---

## C · La reacción — sin lip sync

Hospedín **no habla**. Reacciona: mira algo fuera de cuadro, cambia de expresión,
gesticula, asiente, se agarra la cabeza. Todo el mensaje va en texto en pantalla, y
opcionalmente en voz en off agregada después.

**Para qué sirve**: los cortos de historia, que se ven en silencio.

**Por qué funciona**: la regla 1 del plan dice que el video tiene que entenderse sin
sonido. Este patrón la toma en serio en vez de tratarla como una obligación de
subtitular.

**Costo**: el más bajo de todos, y por un motivo grande — **elimina el lip sync**, que
es la parte más frágil, más cara y la que más limita la duración de un plano. Sin lip
sync los planos pueden ser más largos sin que el personaje derive.

**Requisitos**: la expresión tiene que leerse sola. Conviene partir de las quince
expresiones ya generadas de la guía del personaje, y no inventar caras nuevas por
video.

> **Las cinco caras negativas** de `personaje/expresiones.png` —`fastidio`, `molesto`,
> `agobio`, `susto` y `preocupación`— son las que usan V4, V16 y V28. Respetan el límite
> de la sección 5 de la biblia: **molesto sí, agresivo no**.

---

## D · El objeto en la mano

En vez del celular sostiene otra cosa: un mapa, una valija, una mochila, la notebook,
la cámara de fotos, la lamparita de idea. **El objeto es el argumento del video.**

**Para qué sirve**: los videos conceptuales, donde no hay pantalla que mostrar sino
una idea que explicar.

**Por qué funciona**: la sección 9 de la biblia ya tiene esas poses generadas y
aprobadas —`con valija`, `con mochila`, `con la notebook`, `con el mapa`, `con la
cámara de fotos`, `con la lamparita de idea`—. No hay que inventar nada, que es
justamente donde los modelos derivan.

**Costo**: bajo. Un objeto quieto en la mano y el personaje hablando.

**Requisitos**: el objeto **nunca puede tapar ni modificar la identidad del
personaje** (sección 16 de la biblia). Y si el video igual necesita mostrar pantalla,
se combina con el patrón B: objeto en una mano, inserto al costado.

---

## E · Llega al lugar

Hospedín entra caminando al cuadro, o llega y se detiene, o abre los brazos mostrando
el paisaje que tiene detrás. Sin pantalla: si hace falta grabación, entra después por
corte.

**Para qué sirve**: destinos, experiencias, atractivos. Todo lo que se trata del
lugar y no de la plataforma.

**Por qué funciona**: aprovecha los doce fondos que hoy se usan como decorado
estático. Acá el fondo pasa a ser el tema.

**Costo**: medio. El movimiento amplio es de los que más derivan.

**Requisitos**: **mejor "llega y frena" que "camina de punta a punta"**. Un recorrido
largo por el cuadro es de los pedidos que más rompen el parecido del personaje. Y la
sección 20 de la biblia aplica de lleno: cuando presenta un lugar, mira hacia el
lugar, lo señala o abre los brazos, y recién después vuelve a cámara.

---

## F · Sentado en la reposera

Hospedín sentado en un sillón playero o una reposera, relajado, en un fondo de playa,
costanera o termas. Habla desde ahí, tranquilo, sin apuro. Puede tener el celular en
la mano apoyado sobre la falda.

**Para qué sirve**: el tono del turista que está disfrutando, no el del anfitrión que
resuelve un problema. Videos de planificación de viaje, favoritos, prueba gratis,
todo lo que quiera sonar sin presión.

**Por qué funciona**: cambia el registro entero sin cambiar nada del personaje. Parado
y hablando a cámara es un presentador; sentado y relajado es alguien que te está
contando algo. Es el contraste más barato que hay contra el patrón A.

**Costo**: bajo. El personaje casi no se desplaza.

**Requisitos**: hay que generar el fondo con la reposera **y a Hospedín ya sentado en
ella**, en una sola pieza. Sentarlo por prompt sobre un fondo que no la tiene es
pedirle al modelo que invente la pose y la perspectiva, y ahí deriva. Cuidar además
que las proporciones sentadas sigan siendo las de la biblia: cabeza grande, piernas
cortas, nada de piernas humanas estiradas.

---

## G · Sentado a la mesa

Hospedín sentado a una mesa de cervecería o restaurante, con algo servido delante
—una pinta, un plato, un café—. Habla de cerca, con el ambiente del lugar detrás.

**Para qué sirve**: gastronomía, y también todo lo que quiera sonar a conversación
entre pares. El "de anfitrión a anfitrión" del plan encaja perfecto acá.

**Por qué funciona**: es el registro más íntimo de los siete. Y para los videos de
gastronómicos, el fondo hace la mitad del trabajo.

**Costo**: bajo. Plano medio, personaje sentado, poco movimiento.

**Requisitos**: mismo cuidado que el patrón F — el fondo tiene que venir con él ya
sentado. Y ojo con la gente del fondo: en los interiores de cervecería y restaurante
hay comensales, y si el modelo decide animarlos roban atención. Conviene pedirlos
desenfocados y quietos.

---

## H · Selfie — él filmando

Hospedín sostiene el celular **con la cámara hacia sí**. El video *es* lo que él está
grabando: encuadre corto, el brazo extendido a la vista, leve inclinación del cuadro,
el lugar detrás.

**Para qué sirve**: destinos, agenda semanal, todo lo que sea "estoy acá y te cuento".

**Por qué funciona**: cambia el código entero. Es el lenguaje nativo de Instagram y
TikTok, y **justifica el vertical** — hoy el 9:16 es una imposición técnica que
arrastramos desde las zonas seguras; acá pasa a ser el formato natural de lo que se
está viendo. También explica por qué te habla de tan cerca, que en el resto de los
patrones es una convención muda.

**Costo**: bajo. Menos cuerpo en cuadro, menos que animar.

**Requisitos**: el fondo tiene que generarse **ya con ese encuadre**. No se llega a un
selfie partiendo de un plano entero: hay que pedirlo desde la imagen de referencia.

---

## I · Primer plano

Solo cabeza y hombros. Ninguno de los doce fondos actuales está así.

**Para qué sirve**: los remates, las frases fuertes, cualquier momento que tenga que
pegar. También como plano suelto dentro de un video armado con otro patrón.

**Por qué funciona**: es intimidad, y además **le da aire al lip sync** — la boca se ve
grande y clara, que es justo lo más frágil de todo el proceso. Y el fondo queda tan
desenfocado que casi desaparece, así que el mismo lugar sirve para varios videos sin
que se note la repetición.

**Costo**: el más bajo de los trece.

**Requisitos**: ⚠️ en primer plano **el círculo naranja puede quedar fuera de cuadro**.
La sección 18 de la biblia dice que nunca se elimina, así que hay que encuadrar
dejándolo entrar. Es el error más fácil de cometer con este patrón.

---

## J · Apoyado

Contra la baranda del muelle, contra la pared de la cabaña, sobre una mesa alta, sobre
un poste. Sigue de pie, pero **la silueta deja de ser simétrica**.

**Para qué sirve**: es el reemplazo directo de "parado firme" en cualquier video del
bloque de anfitriones, sin cambiar nada más del guion.

**Por qué funciona**: la simetría frontal es lo que hace que todos los planos se
parezcan entre sí. Romperla cuesta casi nada y se nota mucho.

**Costo**: mínimo. Casi no se mueve.

**Requisitos**: tiene que haber algo contra lo que apoyarse en el fondo. Los fondos 2
(muelle), 4 (costanera) y 1 (cabaña) lo tienen; los de playa abierta, no.

---

## K · Interactuando con el lugar

Sentado en el muelle con las piernas colgando sobre el agua. Subido al bote. Con los
pies en la orilla. Apoyado en la baranda mirando el río en vez de a cámara.

**Para qué sirve**: destinos, experiencias, contenido de comunidad.

**Por qué funciona**: es el patrón E sin el costo de caminar. El lugar deja de ser
telón de fondo y pasa a ser algo con lo que el personaje tiene contacto físico — que
es exactamente lo que pide la sección 14 de la biblia cuando habla de integrarlo a
escenarios reales.

**Costo**: bajo.

**Requisitos**: como F y G, el fondo tiene que venir con él **ya en esa posición**.

---

## L · Plano general — él chico

Lo contrario del primer plano: Hospedín pequeño en un cuadro grande, con el paisaje
ocupando casi todo.

**Para qué sirve**: los videos de destino. Mostrarlo chico frente al palmar dice más
del lugar que cualquier frase.

**Por qué funciona**: **el lugar pasa a ser el protagonista**, y es el único patrón
donde eso ocurre de verdad.

**Costo**: bajo.

**Requisitos**: ⚠️ **no sirve para hablar.** A esa escala la boca no se lee y el lip sync
se desperdicia. Va con el patrón C —sin diálogo, con texto en pantalla— o como plano de
apertura de un video armado con otro patrón.

---

## M · Dos Hospedines

Dos versiones del personaje en el mismo cuadro —uno turista y otro anfitrión—
conversando entre sí.

**Para qué sirve**: los videos que contrastan dos puntos de vista. V23 desactiva dos
comparaciones equivocadas; V28 ya tiene dos versiones del mismo material, una para
oficios y otra para anfitriones.

**Por qué es posible**: Kling 3.0 Omni sincroniza **dos personajes hablando, cada uno
con su propia pista de audio**, fonema por fonema. No es una idea a futuro: existe hoy.

**Costo**: alto, y con riesgo real de que uno de los dos derive mientras el otro se
mantiene. Conviene dejarlo para cuando el resto esté aceitado.

---

## Cómo se combinan

Los patrones no son excluyentes. Las combinaciones que más sirven:

- **D + B** — objeto en una mano, inserto de pantalla al costado. Para los
  conceptuales que igual necesitan mostrar algo.
- **C + E** — llega al lugar y reacciona, sin hablar. Para los de destino que se ven
  en silencio.
- **F o G + A** — sentado, y desde ahí acerca el celular. El portal funciona igual
  sentado, y el registro relajado le saca la solemnidad.
- **L → cualquiera** — abrir con el plano general del lugar y después cortar al patrón
  que lleve el video. Dos generaciones, corte seco sobre un acento de la música.
- **cualquiera → I** — cerrar en primer plano para el remate. Es el uso más rentable
  del patrón I: no hace falta que todo el video esté ahí, alcanza con la última frase.
- **H + K** — selfie mientras está sentado en el muelle o subido al bote. Es la
  combinación más nativa de redes que se puede armar con este personaje.

Lo que **no** conviene combinar es **E con A**: caminar y después acercar el celular son
dos movimientos grandes en un mismo plano, y ahí es donde el modelo trunca la
secuencia. Tampoco **L con diálogo**, por lo mismo de siempre — a esa escala la boca no
se lee.

## Regla que vale para los trece

**Una sola acción grande por plano, y un solo movimiento de cámara.** Es lo que
recomienda la guía de MiniMax H3 y es lo que confirmamos en la práctica: cuando le
pedimos tres acciones grandes en quince segundos, repartió los tiempos solo y dejó el
final afuera.

Si un video necesita más, se parte en dos generaciones cortando en un momento donde no
se vea ni el personaje ni el fondo — por ejemplo con la pantalla del celular tapando
el cuadro.
