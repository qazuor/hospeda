# Hospeda — Plan de videos

Documento de producción de videos para redes.
Complementa el plan de placas: [`plan-contenido-redes.md`](plan-contenido-redes.md).
Inventario de funcionalidades: [`funcionalidades-por-usuario.md`](funcionalidades-por-usuario.md).

---

## Notas generales

### Formatos

- **Historia / estado** — 9:16, vertical. Entre 10 y 30 segundos. Es el formato principal.
- **Publicación** — 9:16 o 4:5. Hasta 60 segundos.
- **WhatsApp** — 9:16, pero **pensado para verse sin sonido y en pantalla chica**. Máximo 30 segundos y con todo el mensaje en texto en pantalla.

En cada video se detalla qué formatos hay que hacer. Casi siempre se produce uno solo y se recorta, no se rehace.

### Reglas de producción

1. **Se ve sin sonido.** La mayoría lo va a mirar en silencio. Todo lo importante va también como texto en pantalla. Si el video no se entiende con el volumen apagado, está mal hecho.
2. **Los primeros 2 segundos deciden todo.** No hay tiempo para presentar la marca antes de decir algo: el logo al principio es tiempo perdido. Se arranca por el gancho y la marca aparece al final.
3. **La pantalla de la plataforma se graba, no se genera.** Todo lo que muestre Hospeda funcionando es grabación real. La inteligencia artificial se usa para el personaje y los ambientes, nunca para simular la interfaz.
4. **Un video, una idea.** Si hay dos mensajes, son dos videos.
5. **Subtítulos siempre**, quemados en el video, no los automáticos de la red.
6. **Las transiciones son corte seco o movimiento simple.** Nada de las transiciones que traen las apps de edición —giros en 3D, estrellitas, barridos con brillo—: envejecen mal, distraen del mensaje y son lo que más rápido delata un video hecho a las apuradas. Lo que sirve es esto:
   - **Corte seco**, cayendo sobre un acento de la música. Es el más usado y casi siempre el mejor.
   - **Zoom hacia un objeto** que ya está en escena, hasta que ese objeto llena el cuadro. Sirve para entrar a una pantalla.
   - **Zoom hacia atrás**, para salir de una pantalla y revelar dónde estaba.
   - **Barrido con la mano**: el personaje empuja el cuadro y entra lo siguiente.
   - **Corte sobre movimiento**: algo se mueve en la misma dirección antes y después del corte.

   **La regla práctica**: si la transición se nota más que lo que muestra, está mal. Y si hay dudas, corte seco.

### El personaje

Es el logo de Hospeda con cuerpo y cara. Aparece en la mayoría de los videos como presentador o como hilo conductor.

> ⚠️ **Antes de generar el primer video hay que escribir la descripción fija del personaje.** Un párrafo cerrado con: colores exactos, proporciones, forma de la cara, ojos, si tiene brazos y piernas, ropa si usa, y estilo de render. **Ese párrafo se pega igual en todos los prompts, siempre.**
>
> Es el punto más importante de toda la producción: si el personaje cambia de un video a otro —o peor, de un plano a otro dentro del mismo video— la pieza se cae. Las herramientas generativas no recuerdan nada entre generaciones: lo único que da consistencia es repetir la misma descripción y usar siempre la misma imagen de referencia.

**Además de la descripción escrita hace falta un juego de imágenes de referencia**, generadas una vez y guardadas para reusar:

- De frente, de perfil y de tres cuartos
- Expresiones: neutra, contenta, sorprendida, señalando
- Cuerpo entero y busto
- Sobre fondo neutro, para poder recortarlo

**Conviene ponerle nombre.** Facilita hablar de él en la producción y, si en algún momento se lo usa como personaje reconocible, ya está bautizado.

### Herramientas

- **ChatGPT** — imágenes fijas: el personaje en distintas poses, fondos, elementos gráficos.
- **ComfyUI** — animación a partir de esas imágenes, y control fino cuando hace falta consistencia.
- **Gemini** — generación de video a partir de texto o de imagen.
- **Grabación de pantalla** — todo lo que muestre la plataforma real.
- **Edición** — armado final, subtítulos, música, ritmo.

### Campos de cada video

| Campo | Obligatorio | Qué es |
|---|---|---|
| **Prioridad** | sí | Del 1 al 5, misma escala que las placas |
| **Formato** | sí | Historia, publicación, WhatsApp |
| **Duración** | sí | Objetivo en segundos |
| **Objetivo** | sí | Qué tiene que lograr. Uno solo |
| **Guion** | sí | Escena por escena, con tiempos |
| **Transiciones** | sí | Cómo se pasa de una parte a otra. Ver la regla 6 |
| **Texto en pantalla** | sí | Lo que se lee, para el que mira sin sonido |
| **Voz** | no | Si lleva voz en off, qué dice |
| **Personaje** | sí | Si aparece, cuándo y haciendo qué |
| **Material a grabar** | sí | Qué hay que capturar de la plataforma |
| **Prompts** | sí | Los prompts de generación, listos para pegar |
| **Música** | sí | Qué clima |
| **CTA** | sí | Cómo cierra |
| **Idioma** | sí | Español salvo que se aclare |

---

## Video de ejemplo

### V1 · Pegá el link y la ficha se carga sola

- **Prioridad**: 1
- **Formato**: Historia 9:16 (principal) · WhatsApp 9:16 (mismo video, sin cambios) · Publicación 4:5 (recorte)
- **Duración**: 22 segundos
- **Objetivo**: que un dueño de alojamiento entienda que publicar no le va a llevar la tarde. **Uno solo**: no explicar precios, ni planes, ni prueba gratis. Eso es otro video.
- **Idioma**: Español

#### Guion

| Tiempo | Qué pasa | Texto en pantalla |
|---|---|---|
| **0:00 – 0:03** | El personaje aparece de golpe, en primer plano, con cara de fastidio. Sostiene un teléfono. | **"¿Cargar tu alojamiento otra vez?"** |
| **0:03 – 0:05** | Niega con la cabeza y hace un gesto de "no". Corte seco. | **"No."** |
| **0:05 – 0:09** | Grabación de pantalla real: se copia el link de un aviso y se pega en el importador de Hospeda. El cursor se ve claro. | **"Pegás el link."** |
| **0:09 – 0:13** | Sigue la grabación: se aprieta importar y aparece el indicador de carga. Un par de segundos, acelerados. | **"Esperás dos segundos."** |
| **0:13 – 0:18** | La ficha aparece completa: fotos, descripción, comodidades. Se hace un scroll lento para que se vea todo lo que se llenó solo. | **"Listo."** |
| **0:18 – 0:22** | Vuelve el personaje, ahora contento, con el pulgar arriba al costado de la ficha terminada. Aparece el logo. | **"Publicá tu alojamiento"**<br>**hospeda.com.ar** |

#### Transiciones

Son tres cortes y **conviene resolverlos como un solo gesto que abre y cierra**: se entra al teléfono al principio y se sale del teléfono al final. Eso le da unidad al video sin ningún efecto raro.

**1 · Dentro del personaje (0:03)** — del fastidio al "no".
Corte seco, cayendo justo sobre un acento de la música. No hay transición: es el mismo personaje, cambia el gesto. Se puede hacer con dos generaciones distintas o con un solo plano y el corte marcado por el sonido.

**2 · Del personaje a la pantalla (0:05)** — la transición importante.

- **Recomendada — zoom al teléfono.** El personaje ya tiene un teléfono en la mano. La cámara se acerca hacia ese teléfono hasta que la pantalla llena el cuadro, y ahí arranca la grabación de Hospeda. Dura menos de un segundo. Es la mejor porque el objeto ya está en escena: no aparece nada de la nada, y explica visualmente que lo que sigue pasa en ese teléfono.
  **Cómo se hace**: se genera el Plano A con el teléfono bien visible y la pantalla hacia la cámara, se compone la grabación adentro de la pantalla en edición, y se hace el acercamiento sobre la imagen fija. No hace falta generar nada nuevo.
- **Alternativa si no se quiere componer — corte seco.** Corte directo del personaje a la pantalla completa, sobre un golpe de música. Funciona bien y no requiere trabajo extra. Es el plan B legítimo, no una versión inferior.
- **Lo que NO conviene**: fundido a blanco o a negro. Frena el ritmo justo cuando el video recién arrancó.

**3 · De la pantalla al personaje contento (0:18)** — el cierre del gesto.

- **Recomendada — zoom hacia atrás.** La cámara se aleja de la ficha terminada y revela que esa ficha está en el teléfono que ahora sostiene el personaje contento. Cierra exactamente el movimiento de la transición 2, y esa simetría es lo que hace que el video se sienta armado y no pegoteado.
  **Requisito**: el Plano B también tiene que tener el teléfono en la mano, con la pantalla visible.
- **Alternativa — la ficha se desliza.** La pantalla se corre hacia un costado y el personaje entra desde el otro. Simple y prolijo.

> **Consecuencia para los prompts**: si se van a hacer las transiciones recomendadas, **los dos planos del personaje necesitan el teléfono con la pantalla hacia la cámara**, y generados con buena resolución para aguantar el acercamiento. Eso ya está pedido en los prompts de abajo.

#### Voz en off

Opcional. **El video tiene que funcionar sin ella.** Si se hace, texto para locutar:

> "¿Ya tenés tu alojamiento publicado en otro lado? No lo cargues de nuevo. Pegás el link, esperás dos segundos, y tu ficha se completa sola. Publicá tu alojamiento en hospeda.com.ar."

#### Personaje

Aparece al principio (0:00–0:05) y al final (0:18–0:22). En el medio no está: el protagonista es la pantalla. Dos planos generados:

- **Plano A** — busto, expresión de fastidio, sosteniendo un teléfono, gesto de negación
- **Plano B** — busto, expresión contenta, pulgar arriba

#### Material a grabar

Grabación de pantalla real del importador, en una sola toma limpia:

1. Un aviso abierto en otra pestaña, se copia la dirección
2. Se pega en el campo de importación de Hospeda
3. Se aprieta importar y corre la carga
4. Aparece la ficha completa y se hace scroll

**Recomendaciones**: grabar en móvil, no en escritorio — el video se ve en móvil. Que la ficha resultante sea de un alojamiento lindo, con buenas fotos. Y grabar más de lo necesario, para tener margen al editar.

> ⚠️ **No nombrar Airbnb ni Booking en el video ni en la grabación.** Si el aviso de origen se ve en pantalla, tapar el logo o usar un aviso de otra plataforma. Vale nombrar Google y Mercado Libre.

#### Prompts

##### Personaje — Plano A (ChatGPT o ComfyUI, imagen fija)

```
[PEGAR ACÁ LA DESCRIPCIÓN FIJA DEL PERSONAJE — el mismo párrafo, sin cambiar una palabra, en todos los prompts]

Plano: busto, encuadre vertical 9:16, personaje centrado y mirando a cámara.
Expresión: fastidio leve, cejas caídas, boca torcida. Cansancio, no enojo.
Pose: sostiene un teléfono en una mano, a la altura del pecho y con la PANTALLA
ORIENTADA HACIA LA CÁMARA, bien visible y sin reflejos. La otra mano en gesto de
negación con la palma hacia adelante.
Pantalla del teléfono: en blanco o gris plano, se le compone contenido después.
Fondo: color plano #DFECF8, sin textura ni degradado.
Luz: pareja y suave, sin sombras duras.
Estilo: [MISMO ESTILO DE RENDER QUE LA REFERENCIA], colores planos, sin fotorrealismo.
Sin texto en la imagen.
Resolución alta: la imagen tiene que aguantar un acercamiento fuerte hacia el teléfono.
```

##### Personaje — Plano B (ChatGPT o ComfyUI, imagen fija)

```
[MISMA DESCRIPCIÓN FIJA DEL PERSONAJE]

Plano: busto, encuadre vertical 9:16, personaje ligeramente a la izquierda del cuadro
dejando espacio libre a la derecha.
Expresión: contento, satisfecho, mirando a cámara.
Pose: sostiene el teléfono en una mano, a la altura del pecho y con la PANTALLA
ORIENTADA HACIA LA CÁMARA, en la misma posición y ángulo que el Plano A. Pulgar
hacia arriba con la otra mano.
Pantalla del teléfono: en blanco o gris plano, se le compone contenido después.
Fondo: color plano #CCE7C3, sin textura ni degradado.
Luz: pareja y suave, sin sombras duras.
Estilo: [MISMO ESTILO DE RENDER QUE LA REFERENCIA], colores planos, sin fotorrealismo.
Sin texto en la imagen.
Resolución alta: la imagen tiene que aguantar el alejamiento desde el teléfono.
```

> **El teléfono tiene que estar en la misma posición, ángulo y tamaño en los dos planos.**
> Si en el Plano A está a la izquierda y en el B a la derecha, el zoom de entrada y el de
> salida no cierran y la simetría se pierde. Conviene generar los dos con el mismo prompt
> base, cambiando solo la expresión y el fondo.

##### Animación de los planos (ComfyUI o Gemini, imagen a video)

```
Animar la imagen de referencia con movimiento mínimo, 3 segundos, sin cambiar
el diseño del personaje.

Plano A: leve negación con la cabeza, un pequeño movimiento de hombros. Nada más.
Plano B: leve asentimiento con la cabeza, el pulgar se mantiene quieto.

La mano que sostiene el teléfono NO se mueve en ninguno de los dos planos: el teléfono
tiene que quedar quieto para poder componerle la pantalla y hacer el acercamiento.

Cámara fija. Fondo fijo. Sin zoom, sin desplazamiento, sin cambios de iluminación.
El personaje no se deforma ni cambia de color en ningún momento.
```

> **Por qué el movimiento tiene que ser mínimo**: cuanto más se le pide a un modelo generativo, más se aleja de la referencia. Un gesto chico sale consistente; una acción compleja devuelve un personaje que ya no es el mismo. **Si un plano necesita movimiento grande, conviene resolverlo con animación tradicional sobre la imagen fija**, no generándolo.

#### Música

Instrumental liviana, sin voz, con un ritmo que acompañe los cortes. El corte del segundo 3 —cuando el personaje dice "no"— tiene que caer sobre un acento de la música.

**Que la música no tape nada**: el video se ve mudo la mayoría de las veces, así que es acompañamiento, no protagonista.

#### CTA

Cierre: **"Publicá tu alojamiento"** y **hospeda.com.ar** en pantalla los últimos 4 segundos, sobre el plano del personaje contento.

#### Variantes que salen de este mismo video

- **WhatsApp**: es el mismo video, sin cambios. Ya está pensado para verse sin sonido.
- **Publicación 4:5**: recorte del mismo material. Verificar que el texto en pantalla no quede cortado.
- **Versión corta de 10 segundos**: solo la grabación de pantalla (0:05 a 0:18) con el texto, sin personaje. Sirve para reutilizar en cualquier momento.

#### De qué placa sale

Es la versión en video de la **14.2** ("Pegá el link y listo") y de la **12.3**, punto 1. Las tres piezas cuentan lo mismo en tres formatos, y eso está bien: es el argumento más fuerte para captar anfitriones.

---

## Qué falta definir antes de producir

| Qué | Por qué frena |
|---|---|
| **La descripción fija del personaje** | Sin ese párrafo, cada generación devuelve un personaje distinto y no hay serie posible |
| **El juego de imágenes de referencia** | Se generan una vez y se reusan siempre. Sin eso, no hay consistencia |
| **Nombre del personaje** | No frena la producción, pero conviene definirlo temprano |
| **Quién graba las pantallas** | Alguien con una cuenta cargada y un alojamiento lindo para mostrar |

---

## Videos a producir

Este documento tiene **un solo video escrito**, como molde. Una vez validado el formato, se escriben los demás.

Candidatos, en orden de prioridad:

#### Para captar anfitriones

- La prueba de 30 días y cómo empezar
- La inteligencia artificial escribiendo una descripción, en vivo
- El calendario sincronizándose y bloqueando fechas solo
- Somos anfitriones como vos — el más importante para la marca

#### Para turistas

- El buscador entendiendo una frase en criollo
- Comparar tres alojamientos lado a lado
- El recorrido de una escapada, de la búsqueda a la consulta

#### De marca

- Qué es Hospeda, en 20 segundos
- Los tres mundos: alojamientos, gastronomía y experiencias

#### Destinos

- Un video por destino principal, con imágenes del lugar

#### Tutoriales

- Cómo publicar tu alojamiento, paso a paso
- Cómo conectar tu calendario
