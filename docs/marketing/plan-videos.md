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

### Composición y zonas seguras

**Todo se genera en vertical 9:16 (1080 × 1920) salvo que el video diga otra cosa.**

El problema: Instagram y TikTok dibujan su propia interfaz encima del video. Si el personaje está bien compuesto pero le cae el nombre de usuario en la cara o los botones de la app sobre la mano, el video queda arruinado y no hay forma de arreglarlo sin volver a generar.

**Zonas que quedan tapadas en 1080 × 1920:**

| Zona | Cuánto | Qué la tapa |
|---|---|---|
| Arriba | ~250 px | Avatar, nombre de usuario, barra de progreso |
| Abajo | ~420 px | Descripción, botones, campo de respuesta |
| Derecha | ~180 px | Columna de íconos de TikTok: me gusta, comentar, compartir |
| Izquierda | ~60 px | Margen |

**Queda utilizable el centro del cuadro, aproximadamente entre los 250 y los 1470 píxeles de alto.** Ahí va todo lo que importa: la cara del personaje, sus manos, el gesto, el objeto que sostiene.

**Y esa zona central hay que compartirla** con los subtítulos, los títulos, los elementos gráficos, el logo y el llamado a la acción. Por eso los planos se generan con aire de sobra: es preferible que el personaje quede un poco chico a que haya que recortarlo después.

#### Bloque de composición para pegar en los prompts

Va en **todos** los prompts de generación, igual que la descripción del personaje:

```
FORMATO: video vertical 9:16, 1080 x 1920. Si no se indica otro formato, este.

ZONAS SEGURAS — la composición tiene que dejar libres:
- 250 px superiores (los tapa la interfaz de la app)
- 420 px inferiores (los tapan botones y descripción)
- 180 px del borde derecho (columna de íconos de TikTok)

Todo lo importante del personaje —cara, manos, gesto, objetos que sostenga— tiene que
quedar dentro del centro del cuadro, entre los 250 y los 1470 px de alto.

Dejar además espacio libre dentro de esa zona central para superponer después:
subtítulos, título, elementos gráficos, logo y llamado a la acción.

NO ubicar partes importantes del personaje donde puedan quedar ocultas por la interfaz
de Instagram o TikTok. Ante la duda, componer más chico y más al centro.
```

### Hospedín, el personaje

Es el logo de Hospeda con cuerpo y cara. Se llama **Hospedín**, y aparece en los videos generados como presentador o hilo conductor.

**La descripción fija del personaje vive en su propio documento**: [`personaje-hospedin.md`](personaje-hospedin.md). Está aparte porque es larga y porque se usa en cada prompt sin modificar una coma. **Cuando un prompt diga `[DESCRIPCIÓN DE HOSPEDÍN]`, se pega ese documento entero.**

Las **imágenes de referencia** del personaje están en la misma carpeta que estos documentos. Se usan siempre las mismas: son las que dan consistencia entre generaciones.

> ⚠️ **Por qué esto es lo más importante de toda la producción.** Las herramientas generativas no recuerdan nada entre una generación y la siguiente. Lo único que hace que Hospedín sea el mismo en el video de enero y en el de julio es repetir exactamente la misma descripción y partir siempre de la misma imagen de referencia. Si en algún prompt se resume la descripción "para que entre", el personaje cambia y la serie se rompe.

### Hospedín habla, pero en planos cortos

**Todos los videos son con Hospedín.** No hay serie con persona real a cámara.

La biblia del personaje contempla la sincronización labial (sección 10), así que **Hospedín puede hablar a cámara**. Pero conviene una regla de producción que vale para los 37 videos:

> **Los planos hablados van cortos: 2 a 6 segundos. Nunca uno largo sostenido.**

**Por qué.** El lip sync es la parte más cara y más frágil del proceso: cuanto más largo el plano hablado, más se degrada el parecido del personaje. Un plano de cuarenta segundos hablando a cámara es el peor caso posible, y además aburre. Con planos cortos el personaje siempre se ve bien, porque nunca está el tiempo suficiente para que se note una deriva.

**Cómo se traduce en la práctica:**

- **Los planos de Hospedín son cortos** y se intercalan con grabación de pantalla, que lleva buena parte del peso.
- **En los videos largos, la voz en off hace el trabajo pesado** y Hospedín aparece hablando solo en los momentos clave: la apertura, un remate, el cierre. Eso baja muchísimo el costo y el riesgo sin perder presencia.
- **Hospedín actúa siempre**: señala, asiente, abre los brazos, muestra con la palma. La sección 20 de la biblia es explícita — cada movimiento tiene que comunicar algo.
- **El texto en pantalla acompaña siempre**, porque la mayoría lo mira sin sonido.

> **Regla práctica**: si un plano hablado dura más de seis segundos, conviene partirlo — o pasar esa parte a voz en off con Hospedín gesticulando.

**Dos duraciones, según para qué es el video:**

| | **Cortos** | **Largos** |
|---|---|---|
| Duración | 10 a 25 segundos | 25 a 50 segundos |
| Para qué | Demostrar una función, gancho | Explicar una idea, dar confianza |
| Dónde | Historias y WhatsApp | Publicaciones |
| Estructura | Hospedín, pantalla, Hospedín | Voz en off con pantalla, Hospedín en planos sueltos |

**Cuándo usar cuál**: una función se demuestra —eso es corto—; una idea se cuenta —eso es largo—.

> Si en algún momento se decide invertir en lip sync, lo que cambia es que los planos de Hospedín pueden ser más largos y la voz en off deja de ser necesaria. El resto de la estructura sirve igual.

### Quién graba las pantallas

Las graba un super administrador, que tiene acceso a todo.

> ⚠️ **Cuidado con esto, que es un problema real.** La pantalla de un super administrador **no es la que ve un anfitrión**: tiene opciones, menús y datos que el usuario común no tiene. Grabar con esa vista y mostrársela a un dueño de alojamiento genera dos problemas — le enseña una interfaz que después no va a encontrar, y puede dejar a la vista información interna de la plataforma o datos de otros usuarios.
>
> **Grabar siempre desde una cuenta de anfitrión de verdad**, aunque sea una creada para eso. Y antes de publicar, mirar el video completo buscando datos que no deberían salir: nombres, correos, teléfonos, importes, identificadores internos.

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

FORMATO Y ZONAS SEGURAS: video vertical 9:16, 1080 x 1920. La composición tiene que
dejar libres los 250 px superiores, los 420 px inferiores y los 180 px del borde
derecho, que quedan tapados por la interfaz de Instagram y TikTok. Todo lo importante
del personaje —cara, manos, gesto, el teléfono— dentro del centro del cuadro, entre
los 250 y los 1470 px de alto, y con espacio libre para superponer subtítulos, título,
logo y llamado a la acción. Ante la duda, componer más chico y más al centro.
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

FORMATO Y ZONAS SEGURAS: video vertical 9:16, 1080 x 1920. La composición tiene que
dejar libres los 250 px superiores, los 420 px inferiores y los 180 px del borde
derecho, que quedan tapados por la interfaz de Instagram y TikTok. Todo lo importante
del personaje —cara, manos, gesto, el teléfono— dentro del centro del cuadro, entre
los 250 y los 1470 px de alto, y con espacio libre para superponer subtítulos, título,
logo y llamado a la acción. Ante la duda, componer más chico y más al centro.
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

FORMATO Y ZONAS SEGURAS: video vertical 9:16, 1080 x 1920. La composición tiene que
dejar libres los 250 px superiores, los 420 px inferiores y los 180 px del borde
derecho, que quedan tapados por la interfaz de Instagram y TikTok. Todo lo importante
del personaje —cara, manos, gesto, el teléfono— dentro del centro del cuadro, entre
los 250 y los 1470 px de alto, y con espacio libre para superponer subtítulos, título,
logo y llamado a la acción. Ante la duda, componer más chico y más al centro.

El encuadre no se altera: el personaje tiene que seguir respetando las zonas seguras
durante toda la animación, no solo en el primer cuadro.
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

## Los 37 videos

Están agrupados por a quién le hablan. El **V1** de arriba es el molde completo, con todos los campos desarrollados: los de abajo dan lo específico de cada uno y se apoyan en las reglas generales para lo común (zonas seguras, transiciones, prompts base, subtítulos).

**Los prompts de Hospedín siguen siempre la misma estructura**, así que no se repiten enteros en cada video. Se arman con tres bloques:

1. `[DESCRIPCIÓN DE HOSPEDÍN]` — el documento del personaje, entero y sin cambios
2. **El plano** — lo que dice cada video en su campo "Planos de Hospedín"
3. `[BLOQUE DE ZONAS SEGURAS]` — el de las notas generales, entero

---

### Marca

#### V2 · Qué es Hospeda

- **Prioridad**: 1 · **Largo**, 40 s · Publicación
- **Objetivo**: que alguien que no conoce Hospeda entienda en un minuto qué reúne y para quién es.
- **Estructura**: voz en off todo el video, Hospedín en tres planos sueltos, el resto es grabación de pantalla.
- **Voz en off**: "Creamos Hospeda para reunir en un solo lugar todo lo que necesitás para disfrutar un destino: alojamientos, gastronomía, experiencias, eventos y lugares para conocer. Podés descubrir qué hacer, dónde alojarte y contactar directo a los prestadores. Estamos empezando por Entre Ríos, y queremos que sirva tanto al que viaja como al que vive del turismo."
- **Guion**: 0–4 s Hospedín saluda y hace un gesto de bienvenida, con el texto *"¿Estás planeando una escapada por Entre Ríos?"* · 4–32 s recorrido por la plataforma: alojamientos, destino, gastronomía, experiencias, eventos · 32–40 s Hospedín otra vez, con el logo y la dirección.
- **Planos de Hospedín**: saludo con la mano, gesto de bienvenida abriendo los brazos, y cierre señalando hacia el logo.
- **Material a grabar**: recorrido continuo por las cinco secciones, en móvil. Grabar de más y acelerar en edición.
- **Texto en pantalla**: los nombres de cada sección a medida que aparecen.
- **CTA**: hospeda.com.ar
- **Nota**: es el video de presentación de la marca. Vale hacerlo bien y usarlo todo el año.

#### V3 · Qué es Hospeda — versión corta

- **Prioridad**: 1 · **Corto**, 20 s · Historia y WhatsApp
- **Objetivo**: el mismo mensaje del V2 pero para historias.
- **Estructura**: sin voz en off. Solo texto en pantalla y cortes rápidos.
- **Guion**: cinco bloques de tres segundos, uno por cada cosa que reúne la plataforma. Texto en pantalla: *"Dónde dormir." / "Dónde comer." / "Qué conocer." / "Qué hacer." / "Qué eventos hay."* y cierre *"Todo un destino, en un solo lugar."*
- **Planos de Hospedín**: solo al final, 3 segundos, con el logo.
- **Material a grabar**: un plano corto de cada sección.
- **CTA**: hospeda.com.ar
- **Sale del V2**: se puede armar con el mismo material, sin grabar de nuevo.

#### V4 · Por qué armamos Hospeda

- **Prioridad**: 1 · **Largo**, 45 s · Publicación
- **Objetivo**: contar el problema que le dio origen. Es el video que mejor explica por qué existe.
- **Voz en off**: "Cuando querés viajar a una ciudad, la información está por todos lados. Buscás alojamiento en un sitio, dónde comer en Google, los eventos en Instagram, y recién cuando llegás te enterás de qué se puede hacer. Hospeda nació para ordenar todo eso. Queremos que cada destino tenga su oferta turística en un mismo lugar, y que los negocios de la zona tengan una forma nueva de mostrarse."
- **Guion**: 0–5 s Hospedín con cara de agobio, rodeado de ventanas que se abren y se amontonan · 5–25 s montaje rápido de búsquedas dispersas: un mapa, una red social, un buscador, un grupo de mensajes · 25–40 s todo eso se ordena y se convierte en la pantalla de Hospeda · 40–45 s Hospedín aliviado, con el logo.
- **Planos de Hospedín**: agobiado con las manos en la cabeza, y aliviado con una sonrisa.
- **Transición clave**: el caos de ventanas colapsa hacia el centro y se convierte en la pantalla de Hospeda. Es el momento que cuenta la idea entera.
- **CTA**: hospeda.com.ar

#### V5 · Quién está detrás

- **Prioridad**: 2 · **Largo**, 35 s · Publicación
- **Objetivo**: humanizar. Es el único video donde puede aparecer una persona real.
- **Voz en off**: "Atrás de Hospeda hay una persona de la región, que alquila para turismo hace años y conoce los problemas del rubro de primera mano. La plataforma se desarrolla acá, hablando con los que reciben turistas todos los días. Recién estamos empezando, y queremos construirla junto a los que viven del turismo local."
- **Guion**: Hospedín presenta, aparece una foto o un plano real de quien está detrás, se muestra la región y el trabajo, y cierra Hospedín.
- **En singular**: es **una persona** con colaboradores puntuales, no un equipo. Coherente con la placa 13.1.
- **CTA**: hospeda.com.ar

#### V6 · Estamos construyendo Hospeda

- **Prioridad**: 2 · **Largo**, 45 s · Publicación
- **Objetivo**: video emocional de cierre de campaña. Convoca sin prometer resultados.
- **Voz en off**: "Hospeda está naciendo en Entre Ríos con una idea simple: que nuestros destinos y los que trabajan del turismo tengan una mejor presencia en internet. Queremos que turistas, alojamientos, gastronómicos, prestadores e instituciones encuentren acá un punto en común. Todavía tenemos muchísimo por construir, y queremos hacerlo con los que viven el turismo de la región."
- **Guion**: montaje de la región, negocios locales, la plataforma funcionando, y Hospedín cerrando.
- **Música**: es el único video del plan donde la música puede tener peso emocional. En el resto es acompañamiento.
- **CTA**: Sumate en hospeda.com.ar

---

### Anfitriones — captación

#### V1 · Pegá el link y la ficha se carga sola

Es el video de ejemplo desarrollado arriba. **Prioridad 1, corto, 22 s.**

#### V7 · Si tenés un alojamiento, esto es para vos

- **Prioridad**: 1 · **Largo**, 30 s · Publicación y WhatsApp
- **Objetivo**: el primer video comercial para dueños. Que entiendan que califican.
- **Voz en off**: "Si tenés una casa, un departamento, una cabaña, una quinta, un hotel o cualquier alojamiento turístico, podés publicarlo en Hospeda. Tenés tu propia página con fotos, descripción, servicios, ubicación, precios y contacto. La idea es simple: que más turistas te encuentren y puedan escribirte directo."
- **Guion**: 0–5 s Hospedín señalando a cámara con el texto *"¿Tenés un alojamiento?"* · 5–25 s recorrido por una ficha real, mostrando cada parte · 25–30 s Hospedín y el cierre.
- **Enumerar los tipos importa**: mucha gente con una cabaña o una quinta no se considera "alojamiento turístico" y cree que esto no es para ella.
- **CTA**: Publicá tu alojamiento en hospeda.com.ar

#### V8 · Formás parte del destino

- **Prioridad**: 1 · **Largo**, 40 s · Publicación
- **Objetivo**: el diferencial de fondo frente a cualquier otro listado.
- **Voz en off**: "Publicar tu alojamiento en Hospeda no es sumarlo a otro listado. Tu alojamiento pasa a formar parte de todo el contenido turístico del destino: aparece cuando alguien busca dónde quedarse, cuando explora la ciudad y cuando está armando qué hacer durante el viaje. Y cuando alguien se interesa, te escribe directo."
- **Guion**: mostrar el mismo alojamiento apareciendo en tres contextos distintos —en la búsqueda, en la página del destino, entre las recomendaciones— para que se entienda visualmente qué significa "formar parte del destino".
- **Es el que mejor explica el modelo**, y el que más lo diferencia de un clasificado.
- **CTA**: Publicá tu alojamiento en hospeda.com.ar

#### V9 · Sin comisión por reserva

- **Prioridad**: 1 · **Corto**, 20 s · Historia y WhatsApp
- **Objetivo**: un solo mensaje, el diferencial comercial más fuerte.
- **Voz en off**: "En Hospeda no cobramos comisión por cada reserva. Publicás tu alojamiento, el turista te escribe directo, y la reserva, el pago y la relación con tu huésped siguen siendo tuyos."
- **Guion**: 0–4 s Hospedín negando con el texto *"Sin comisión por reserva."* · 4–15 s la ficha y el botón de contacto · 15–20 s cierre.
- **Uno solo**: no meter nada más. Este video vive de decir una sola cosa.
- **CTA**: Publicá tu alojamiento en hospeda.com.ar

#### V10 · Todo lo que podés mostrar

- **Prioridad**: 1 · **Largo**, 45 s · Publicación
- **Objetivo**: mostrar que una publicación es mucho más que un aviso.
- **Voz en off**: "Una publicación en Hospeda muestra mucho más que un nombre y un teléfono. Cargás tus fotos, la descripción, la ubicación, los servicios, las características, los precios y tus formas de contacto. La idea es que el turista conozca bien tu propuesta antes de escribirte."
- **Guion**: recorrido completo por una ficha, sección por sección, con el nombre de cada una en pantalla.
- **Material a grabar**: una ficha bien cargada, de un alojamiento lindo. **La calidad del ejemplo es el argumento**: si la ficha que se muestra está a medio llenar, el video juega en contra.
- **CTA**: Publicá tu alojamiento en hospeda.com.ar

#### V11 · Publicar es simple

- **Prioridad**: 1 · **Largo**, 35 s · Publicación y WhatsApp
- **Objetivo**: sacar el miedo a que sea complicado.
- **Voz en off**: "Publicar tu alojamiento es bastante simple. Creás tu cuenta, cargás la información, agregás las fotos, la ubicación, los servicios y tus datos de contacto. Una vez publicado ya tenés tu espacio en Hospeda para empezar a recibir consultas."
- **Guion**: grabación acelerada del alta completa, de principio a fin, sin cortes que escondan pasos.
- **Que se vea entera**: si el video corta y salta, sugiere que hay pasos difíciles que no se muestran. El valor está en que se vea todo el recorrido.
- **CTA**: Empezá en hospeda.com.ar

#### V12 · Probalo gratis

- **Prioridad**: 1 · **Corto**, 20 s · Historia y WhatsApp
- **Objetivo**: la prueba gratis, sin mentir sobre la tarjeta.
- **Voz en off**: "Empezá a usar Hospeda gratis, sin que se te cobre nada. Entrás, elegís tu plan, publicás tu alojamiento y antes del primer cobro siempre te avisamos."
- **Texto en pantalla**: **"Empezá gratis"** como elemento principal.
- **⚠️ Nunca decir "sin tarjeta"**: se pide al registrarse. Lo que no se cobra es la prueba.
- **⚠️ Sin cantidad de días** (regla 10 del plan de contenido): el plazo puede cambiar y no va ni en pantalla ni en la voz. Lo que lo reemplaza es el aviso previo al cobro, que existe y sale automático tres días antes y otra vez un día antes.
- **CTA**: Empezá en hospeda.com.ar

#### V13 · Planes para cada tamaño

- **Prioridad**: 2 · **Largo**, 30 s · Publicación
- **Objetivo**: desactivar la objeción del costo sin convertirlo en una lista de precios.
- **Voz en off**: "Queremos que Hospeda sirva tanto al que alquila un departamento como a un complejo o un hotel. Por eso hay distintos planes, con opciones accesibles según lo que necesite cada uno. No hace falta ser una gran empresa para tener presencia profesional."
- **⚠️ Sin precios visibles**: si se graba la página de planes, **que no se lean los importes**. Un precio quemado en el video obliga a rehacerlo cuando cambie la lista. Mostrar la comparación de funciones, no los números.
- **CTA**: Mirá los planes en hospeda.com.ar

#### V14 · Sumate ahora que estamos empezando

- **Prioridad**: 1 · **Largo**, 30 s · Publicación
- **Objetivo**: convertir el hecho de ser nuevos en un argumento, sin prometer resultados que no se pueden garantizar.
- **Voz en off**: "Hospeda está empezando, y por eso este es un buen momento para sumarte. Estamos incorporando alojamientos, gastronomía, experiencias y contenido de distintos destinos. El que se suma ahora crece con la plataforma y nos ayuda a construir una herramienta más útil."
- **Honestidad como estrategia**: no promete tráfico ni reservas. Ofrece participar de algo que arranca, que es lo único que se puede prometer hoy.
- **CTA**: Sumate en hospeda.com.ar

#### V15 · Somos anfitriones, como vos

- **Prioridad**: 1 · **Largo**, 35 s · Publicación y WhatsApp
- **Objetivo**: autoridad. Es el argumento más fuerte para hablarle a un dueño.
- **Voz en off**: "Esto no lo armó una empresa de software. Lo armó alguien que alquila para turismo hace años. El que pregunta a las once de la noche, las fechas que se superponen entre tres plataformas, la comisión que se lleva media noche, cargar la misma ficha por cuarta vez. Los problemas que resuelve Hospeda son los que sufrimos nosotros primero."
- **Guion**: cada problema enunciado con una imagen que lo represente, y Hospedín asintiendo entre medio.
- **Los cuatro problemas hay que reemplazarlos por los reales**, igual que en la placa 18.8. Los de arriba son ejemplos.
- **CTA**: Sumá tu propiedad en hospeda.com.ar

---

### Anfitriones — funciones

#### V16 · El calendario se sincroniza solo

- **Prioridad**: 1 · **Corto**, 22 s · Historia y WhatsApp
- **Objetivo**: mostrar que se terminan las reservas dobles.
- **Voz en off**: "Conectás tu calendario de Google, de Airbnb, de Booking o el que uses, y las fechas ocupadas se bloquean solas. Sin planillas y sin anotar en un cuaderno."
- **Guion**: 0–4 s Hospedín con cara de susto y el texto *"¿Dos reservas para la misma fecha?"* · 4–18 s grabación real: se conecta el calendario y las fechas se bloquean · 18–22 s Hospedín tranquilo.
- **Marcas**: acá **sí** se nombran Google, Airbnb y Booking.
- **CTA**: Publicá tu alojamiento en hospeda.com.ar

#### V17 · La IA te escribe la descripción

- **Prioridad**: 1 · **Corto**, 22 s · Historia y WhatsApp
- **Objetivo**: sacar la carga de escribir, que es lo que más frena a la gente.
- **Voz en off**: "Escribí la descripción como te salga. La inteligencia artificial la mejora, y de paso la traduce al inglés y al portugués."
- **Guion**: se ve un texto pobre escrito a mano, se aprieta el botón, y aparece la versión trabajada. Después el selector de idioma y las tres versiones.
- **El antes y después es todo**: que el texto original se lea, y el resultado también. Sin acelerar tanto que no se alcance a leer.
- **CTA**: Probalo en hospeda.com.ar

#### V18 · Las consultas van a tu WhatsApp

- **Prioridad**: 1 · **Corto**, 18 s · Historia y WhatsApp
- **Objetivo**: contacto directo, sin intermediarios.
- **Voz en off**: "El que se interesa por tu alojamiento te escribe directo al WhatsApp. Sin intermediarios y sin esperar."
- **Guion**: la ficha, el botón de contacto, y la conversación entrando al teléfono.
- **CTA**: Publicá tu alojamiento en hospeda.com.ar

#### V19 · Traé tus opiniones de Google

- **Prioridad**: 2 · **Corto**, 20 s · Historia
- **Objetivo**: que el que ya tiene reputación no sienta que arranca de cero.
- **Voz en off**: "¿Ya tenés opiniones en Google? Conectalas y se muestran en tu ficha. No empezás de cero."
- **Guion**: la ficha sin estrellas, se conecta, aparecen las estrellas. El cambio visual es el mensaje.
- **CTA**: Sumá tu alojamiento en hospeda.com.ar

#### V20 · Mirá cómo te va

- **Prioridad**: 2 · **Corto**, 22 s · Historia
- **Objetivo**: mostrar las estadísticas a quien nunca las abrió.
- **Voz en off**: "¿Sabés cuánta gente vio tu ficha este mes? Cuántos te consultaron, cuántos te guardaron y cómo estás respecto del resto de la zona. Está todo en tu panel."
- **Guion**: recorrido por el panel de estadísticas, con los números visibles.
- **Le habla a los que ya publicaron**, no a los que faltan. Es retención.
- **CTA**: Entrá a tu panel en hospeda.com.ar

#### V21 · Pagás con Mercado Pago

- **Prioridad**: 1 · **Corto**, 15 s · Historia y WhatsApp
- **Objetivo**: desactivar la desconfianza de dar la tarjeta a una plataforma nueva.
- **Voz en off**: "Los cobros los maneja Mercado Pago. Pagás con tarjeta o con plata de tu cuenta, y nosotros no guardamos los datos de tu tarjeta."
- **Guion**: simple y sobrio. El logo de Mercado Pago tiene que verse claro: es el elemento que hace el trabajo.
- **Importa más ahora**: la tarjeta se pide antes de la prueba, así que esta duda aparece justo en el peor momento.
- **CTA**: Empezá en hospeda.com.ar

#### V22 · Presencia en Google y en las IA

- **Prioridad**: 2 · **Largo**, 45 s · Publicación
- **Objetivo**: explicar el beneficio de visibilidad sin vender humo.
- **Voz en off**: "Hoy un turista te puede encontrar buscando en Google, en redes, o preguntándole a una inteligencia artificial. Por eso importa que tu negocio tenga información clara en internet. Una publicación en Hospeda suma otra presencia asociada a tu actividad y a tu destino, que los buscadores pueden encontrar. No hay fórmulas mágicas para aparecer primero, pero sí se pueden hacer las cosas bien para que te encuentren más."
- **⚠️ La última frase es obligatoria**: sin ella el video promete posiciones que nadie puede garantizar.
- **Guion**: una búsqueda en Google que devuelve la ficha, y una consulta a un asistente que menciona un alojamiento.
- **CTA**: Publicá tu alojamiento en hospeda.com.ar

#### V23 · Hospeda no reemplaza nada, suma

- **Prioridad**: 2 · **Largo**, 40 s · Publicación
- **Objetivo**: desactivar de una vez las dos comparaciones equivocadas: con las redes y con las grandes plataformas.
- **Voz en off**: "¿Ya tenés Instagram, Facebook o una página? Perfecto, no venimos a reemplazarlos. ¿Usás Airbnb o Booking? Tampoco hace falta que dejes de usarlos. Son herramientas distintas. Hospeda está pensado para darte visibilidad dentro del destino y que el turista te conozca y te escriba directo. Es un canal más, no un reemplazo."
- **Fusiona los dos videos** que estaban separados. Decir dos veces "no venimos a reemplazar" suena a estar a la defensiva.
- **Marcas**: acá se pueden mostrar las interfaces de las otras plataformas.
- **CTA**: Sumá tu alojamiento en hospeda.com.ar

---

### Anfitriones — consejos

#### V24 · Mostrá mejor tu alojamiento

- **Prioridad**: 2 · **Largo**, 35 s · Publicación
- **Objetivo**: dar valor antes de vender. Serie de anfitrión a anfitrión.
- **Voz en off**: "Las fotos son lo que más pesa en la primera impresión. Usá buena luz, mostrá todos los ambientes, y no llenes la publicación con diez fotos casi iguales. No hace falta ser fotógrafo para mejorar muchísimo cómo se ve tu alojamiento."
- **Guion**: comparación directa de fotos malas y buenas del mismo ambiente.
- **Fotos propias**: si el ejemplo es de banco de imágenes, la pieza pierde toda la autoridad.
- **CTA**: hospeda.com.ar

#### V25 · Una buena descripción vende mejor

- **Prioridad**: 2 · **Largo**, 35 s · Publicación
- **Objetivo**: enseñar a escribir la ficha. Serie de anfitrión a anfitrión.
- **Voz en off**: "Cuando describas tu alojamiento, no te quedes en que es hermoso, increíble o espectacular. Contá lo que el huésped quiere saber: para cuántas personas es, dónde está, qué comodidades tiene, qué hay cerca y qué lo hace distinto. La información concreta da más confianza que una colección de adjetivos."
- **Guion**: se ve una descripción llena de adjetivos, se tachan, y aparece la versión concreta.
- **CTA**: hospeda.com.ar

---

### Gastronomía, experiencias y oficios

#### V26 · También es para gastronómicos

- **Prioridad**: 1 · **Largo**, 35 s · Publicación y WhatsApp
- **Objetivo**: captar restaurantes, bares y cafeterías.
- **Voz en off**: "Si tenés un restaurante, un bar, una cafetería o un emprendimiento gastronómico, también podés estar en Hospeda. El que visita una ciudad no busca solo dónde dormir: busca dónde comer, dónde tomar algo y qué conocer. Queremos que los negocios de la zona sean parte de esa búsqueda."
- **Guion**: platos y mesas reales de la región, y después la ficha gastronómica dentro de la plataforma.
- **CTA**: Sumá tu negocio en hospeda.com.ar

#### V27 · ¿Ofrecés experiencias?

- **Prioridad**: 1 · **Largo**, 35 s · Publicación y WhatsApp
- **Objetivo**: captar guías, paseos, excursiones y alquileres.
- **Voz en off**: "Si ofrecés paseos, excursiones, pesca, alquiler de bicicletas, actividades en el agua o visitas guiadas, queremos que estés en Hospeda. Porque el viaje no termina cuando encontrás alojamiento: queremos mostrar también todo lo que se puede hacer una vez que llegás."
- **Guion**: montaje rápido de actividades reales —kayak, bicicletas, pesca, cabalgata— y después cómo se ve una ficha de experiencia.
- **Enumerar las actividades importa**: como con los alojamientos, mucha gente no se considera "prestador turístico".
- **CTA**: Sumá tu experiencia en hospeda.com.ar

#### V28 · Directorio de oficios

- **Prioridad**: 1 · **Corto**, 20 s · Historia y WhatsApp
- **Objetivo**: **doble**, y por eso van dos versiones del mismo material.
  - **Para oficios**: sumarse al directorio. *"¿Sos plomero, gasista o electricista? Los alojamientos de la zona te necesitan."*
  - **Para anfitriones**: mostrar el beneficio. *"Se rompió el termotanque un domingo. Tenés a quién llamar."*
- **Voz en off (versión anfitrión)**: "Se rompió el termotanque un domingo a la mañana. En Hospeda tenés un directorio de oficios de confianza de la zona, con las valoraciones de otros anfitriones que ya los llamaron."
- **Guion**: Hospedín con cara de problema, la lista de oficios en pantalla, Hospedín aliviado.
- **La versión para oficios va primero**: sin oficios cargados, el beneficio no existe.
- **CTA**: Sumate en hospeda.com.ar

---

### Turistas

#### V29 · Un fin de semana en Concepción del Uruguay

- **Prioridad**: 1 · **Largo**, 45 s · Publicación
- **Objetivo**: mostrar el recorrido completo de un viaje dentro de la plataforma. Le habla al turista, pero **también le demuestra al anfitrión que hay una propuesta para sus futuros huéspedes**.
- **Voz en off**: "Supongamos que querés pasar un fin de semana en Concepción del Uruguay. En Hospeda conocés el destino, buscás alojamiento, encontrás dónde comer, qué actividades hay, qué eventos coinciden con tu visita y qué lugares visitar. No se trata solo de encontrar dónde dormir: se trata de organizar todo el viaje."
- **Guion**: el recorrido real, en orden: destino, alojamiento, gastronomía, actividad, evento.
- **Es el video que más funciones muestra** en un solo recorrido, y el que mejor explica el concepto de ecosistema.
- **CTA**: Armá tu escapada en hospeda.com.ar

#### V30 · Buscá según tu viaje

- **Prioridad**: 1 · **Corto**, 25 s · Historia
- **Objetivo**: mostrar el buscador y los filtros.
- **Voz en off**: "No todos buscamos lo mismo. A veces necesitás una quinta con pileta, otras un departamento para dos, o algo cerca del centro. En Hospeda filtrás hasta encontrar lo que estás buscando."
- **Guion**: se escribe una búsqueda concreta, se aplican filtros, aparecen los resultados.
- **Se puede combinar con el buscador que entiende lenguaje natural**, escribiendo la frase en criollo en vez de usar filtros. Es más impactante y es un diferencial real.
- **CTA**: Buscá en hospeda.com.ar

#### V31 · Guardá tus favoritos

- **Prioridad**: 2 · **Corto**, 20 s · Historia
- **Objetivo**: motivo concreto para crear cuenta.
- **Voz en off**: "Mientras organizás el viaje encontrás varias opciones que querés comparar después. Guardalas en favoritos y tenelas a mano. Una cosa menos para acordarte entre veinte pestañas abiertas."
- **Guion**: se marcan varios favoritos y después se ven todos juntos en la cuenta.
- **CTA**: Creá tu cuenta gratis en hospeda.com.ar

#### V32 · Compará antes de decidir

- **Prioridad**: 2 · **Corto**, 20 s · Historia
- **Objetivo**: mostrar el comparador, que es la función que mejor justifica registrarse.
- **Voz en off**: "Tres alojamientos, una sola pantalla. Compará precio, capacidad y comodidades sin abrir cinco pestañas."
- **Guion**: se agregan tres al comparador y aparece la tabla. **La tabla completa es el argumento**: que se vea clara y se entiendan las diferencias.
- **CTA**: Probalo en hospeda.com.ar

---

### Destinos y comunidad

#### V33 · Descubrí un destino — serie

- **Prioridad**: 2 · **Largo**, 45 s · Publicación
- **Objetivo**: un video por destino. **Es una serie, no un video suelto.**
- **Estructura fija**: imágenes del lugar, tres o cuatro atractivos, la página del destino en la plataforma, y cierre.
- **Voz en off (molde)**: "*(Destino)* tiene mucho más para conocer de lo que entra en una escapada de un día. *(Los tres o cuatro atractivos)*. En Hospeda estamos reuniendo toda esa información para que puedas descubrir qué visitar y organizar mejor tu viaje."
- **Los primeros**: Concepción del Uruguay, Colón, Federación, Gualeguaychú.
- **De dónde sale el contenido**: de las fichas de destino del plan de placas, categoría 8. Los atractivos ya están investigados y escritos, uno por destino.
- **Depende del material filmado**: sin imágenes buenas del lugar no hay video. Es el mismo cuello de botella que en las placas.
- **CTA**: Conocé *(destino)* en hospeda.com.ar

#### V34 · Qué hacer este fin de semana — serie

- **Prioridad**: 1 · **Corto**, 20 s · Historia
- **Objetivo**: formato recurrente, sale todas las semanas.
- **Voz en off**: "¿Buscás qué hacer este fin de semana? En Hospeda vamos juntando eventos, fiestas y actividades de los destinos de Entre Ríos. Entrá, elegí tu destino y fijate qué hay durante tu visita."
- **Guion**: tres a cinco eventos en pantalla, rápido, con lugar y día.
- **Tiene que armarse en veinte minutos**: es semanal. Si lleva más, el formato está mal diseñado y no se sostiene.
- **Si una semana no hay eventos, no se publica.** Mejor saltear que publicar una edición floja.
- **CTA**: Mirá la agenda en hospeda.com.ar

#### V35 · Buscamos editores locales

- **Prioridad**: 2 · **Corto**, 25 s · Historia
- **Objetivo**: convocar gente que conozca los destinos.
- **Voz en off**: "¿Conocés bien tu ciudad y te gusta recomendar lugares? Buscamos gente que quiera colaborar como editor de Hospeda, mejorando la información de destinos, lugares y eventos. Queremos contenido con conocimiento local, no escrito desde una oficina a quinientos kilómetros."
- **La última frase es el gancho**: es lo que hace que alguien de la zona se sienta interpelado.
- **CTA**: Postulate en hospeda.com.ar

#### V36 · Mostranos tu ciudad

- **Prioridad**: 1 · **Corto**, 20 s · Historia
- **Objetivo**: conseguir fotos y datos de los destinos. **Destraba la serie V33.**
- **Voz en off**: "Estamos armando la guía visual del Litoral y queremos que la hagan los que viven acá. Si tenés buenas fotos de tu ciudad, conocés un lugar que deberíamos sumar, o encontraste algo para corregir, escribinos."
- **Sale una versión por destino**, nombrando la ciudad: convierte mucho más que un pedido genérico.
- **Cada foto que se publique lleva el crédito** de quien la mandó. Si nadie ve su nombre publicado, el flujo se corta.
- **CTA**: Escribinos desde hospeda.com.ar

#### V37 · Qué es ser partner

- **Prioridad**: 3 · **Largo**, 35 s · Publicación
- **Objetivo**: abrir la puerta a instituciones y empresas del rubro.
- **Voz en off**: "Hospeda también quiere trabajar con empresas, instituciones y organizaciones vinculadas al turismo. Un partner puede colaborar con contenido, promociones, acciones conjuntas o eventos que aporten valor al que visita un destino. La idea es crecer armando una red, no cada uno por su lado."
- **⚠️ No prometer acuerdos que no existen** ni mostrar marcas que no sean partners de verdad.
- **CTA**: Escribinos desde hospeda.com.ar

---

## Los 35 de solo-personaje — backlog aprobado

**Videos que se producen enteros con Hailuo**: sin grabación de pantalla, sin captura,
sin filmación real y sin fotos de terceros. Solo Hospedín, eventualmente con un objeto
en la mano.

Por qué existen como bloque aparte: hoy **25 grabaciones de pantalla están trabadas**
esperando una cuenta de anfitrión, y estos 35 no dependen de ninguna. Son la parte de la
producción que puede avanzar sin desbloquear nada.

**Prioridades**: P1 arranca ya · P2 después · P3 más adelante · P4 cuando haya lugar.

**Marcas**: 📋 sale de una placa del [plan de contenido](plan-contenido-redes.md) ·
✨ tema nuevo · ✅ objeto ya en `prompts/personaje.md` · ⚠️ objeto que hay que generar ·
🔒 necesita la experiencia real del dueño antes de escribirse.

---

### P1 — once videos

| # | Título | A quién | Patrón | Objeto | |
|:-:|---|---|:-:|:-:|:-:|
| **V38** | Diez pestañas abiertas para planear un finde | turista | C | — | 📋 |
| **V39** | No somos una app de reservas | todos | I | — | ✨ |
| **V40** | Empezamos por Entre Ríos, y es a propósito | marca | J | — | ✨ |
| **V42** | Un mapa que se llena de a poco | turista · anfitrión | D | mapa ✅ | 📋 |
| **V43** | Si algo no anda, decínoslo | todos | I | — | ✨ |
| **V44** | Cuatro cosas que asumís mal de Hospeda | turista · anfitrión | C | — | 📋 |
| **V45** | Tu alojamiento ya existe, solo que nadie lo encuentra | anfitrión | J | — | ✨ |
| **V46** | Publicás y también viajás como VIP | anfitrión | dos planos en secuencia | — | 📋 |
| **V47** | Nadie te va a llamar para venderte nada | anfitrión | C | — | ✨ |
| **V48** | Vos ponés el precio, vos contestás, vos decidís | anfitrión | D | llave ✅ | ✨ |
| **V50** | Un alojamiento vacío no descansa, pierde | anfitrión | K | — | ✨ |

### P2 — doce videos

| # | Título | A quién | Patrón | Objeto | |
|:-:|---|---|:-:|:-:|:-:|
| **V41** | Por qué se llama Hospedín | marca | K | — | ✨ |
| **V56** | No te pedimos nada para mirar | turista | C | candado ⚠️ | 📋 |
| **V57** | Tres días, ¿a dónde vas? *(plantilla)* | turista | K · F | — | 📋 |
| **V58** | Hablá directo con el que te va a recibir | turista | I | — | ✨ |
| **V59** | El finde largo se planea el martes | turista | J | — | ✨ |
| **V60** | No hace falta ir lejos | turista | L → C | — | ✨ |
| **V61** | Guardátelo para cuando lo necesites | turista | D | mochila ✅ | ✨ |
| **V64** | Cocinás bien y nadie de afuera lo sabe | gastronómico | G | — | ✨ |
| **V65** | Tu experiencia no es "una actividad más" | prestador | K | — | ✨ |
| **V66** | El que arregla a las once de la noche | oficio | I | — | ✨ |
| **V67** | ¿Organizás algo y no está en la agenda? | organizador | C · J | — | 📋 |
| **V71** | Nadie conoce tu pueblo mejor que vos | comunidad | J | — | ✨ |

### P3 — once videos

| # | Título | A quién | Patrón | Objeto | |
|:-:|---|---|:-:|:-:|:-:|
| **V49** | Tus fotos son de hace dos veranos | anfitrión | D | cámara ✅ | 📋 |
| **V51** | El que contesta primero, alquila | anfitrión | C | — | 📋🔒 |
| **V52** | Ni regalado ni de cara | anfitrión | J | — | 📋🔒 |
| **V53** | El primer mate ya está listo | anfitrión | K · G | mate ⚠️ | 📋🔒 |
| **V54** | Te llegó una mala. Ahora qué | anfitrión | C → I | — | 📋🔒 |
| **V55** | Qué hacer cuando no entra nadie | anfitrión | E · K | — | 📋🔒 |
| **V62** | Llueve. No se cancela nada | turista | K | — | ✨ |
| **V63** | Un alojamiento no te llama una vez sola | oficio | D | llave inglesa ⚠️ | 📋 |
| **V68** | Acá el asado se hace con leña | comunidad | G | pinzas ⚠️ | 📋 |
| **V69** | El río cambia todo | comunidad | K | — | ✨ |
| **V70** | Los que se van en marzo se pierden lo mejor | turista | L → I | — | ✨ |

### P4 — uno

| # | Título | A quién | Patrón | Objeto | |
|:-:|---|---|:-:|:-:|:-:|
| **V72** | Tres lugares para… *(plantilla)* | turista | L → C | — | ✨ |

---

### Lo que hay que resolver antes

**Faltan fondos.** Los tres patrones que este bloque más usa son justamente los que
nunca se habían usado, y tienen **un solo fondo cada uno**:

| Patrón | Videos que lo piden | Fondos hoy | Faltan |
|---|:-:|:-:|:-:|
| **K** en contacto con el lugar | 8 | 1 (el 19) | ~4 |
| **J** apoyado | 6 | 1 (el 18) | ~3 |
| **I** primer plano | 6 | 2 (17 y 30) | ~2 |
| **L** plano general | 3 | 1 (el 20) | ~2 |

Sin eso, ocho videos de patrón K transcurren en el mismo lugar. Son **unos once fondos
nuevos**, y conviene generarlos de una sola vez.

**Faltan cuatro objetos**: mate (V53), candado (V56), llave inglesa (V63) y pinzas de
asado (V68). El set aprobado en [`prompts/personaje.md`](prompts/personaje.md) tiene
siete —llave, valija, mochila, notebook, mapa, cámara de fotos y lamparita de idea— y
los cuatro nuevos obligan a regenerar la lámina de acciones. Conviene una sola pasada
con los cuatro juntos, no cuatro pasadas.

**Los cinco de la serie 18 esperan.** V51 a V55 salen de la categoría 18 del plan de
contenido, que abre con una advertencia explícita: los consejos están escritos desde
afuera del oficio y hay que reemplazarlos por lo que realmente pasó. Escribirlos con el
texto actual reproduce exactamente el error contra el que esa categoría advierte.

### Lo que quedó afuera

**En evaluación**: *En qué estamos trabajando* (roadmap con la lamparita) — depende de
qué se anuncie y cómo se maneje.

**Descartados**: *Una palabra por semana* y *Lo que aprendimos este mes*.

**No califican para solo-personaje**, por si vuelven a aparecer: las placas de destino
específico (necesitan el lugar real, y esa producción ya está reservada para V33) y
*Un día de un anfitrión* (es un testimonio, y la regla es que un testimonio no se
inventa jamás).

---

## Puesta en escena por video

Qué **patrón** de comportamiento y qué **fondo** usa cada video. Los patrones están en
[`patrones-de-puesta-en-escena.md`](patrones-de-puesta-en-escena.md) y los veinte
fondos en [`prompts/fondos.md`](prompts/fondos.md).

> Esto es una asignación de partida, no una condena. Si al escribir el prompt de un
> video el patrón no le cierra, se cambia — pero conviene que el cambio sea deliberado
> y quede anotado acá, no que cada video invente su propia puesta.

**Los trece patrones**: A portal · B presentador al costado · C reacción sin lip sync ·
D objeto en la mano · E llega al lugar · F sentado en la reposera · G sentado a la mesa ·
H selfie · I primer plano · J apoyado · K en contacto con el lugar · L plano general ·
M dos Hospedines.

**Los patrones nuevos tienen fondos propios**, y los más usados tienen varios para que
dos videos del mismo bloque no repitan lugar:

| Patrón | Fondos disponibles |
|---|---|
| B inserto lateral | 15 cabaña · 21 costanera · 22 balneario · 23 palmar |
| F reposera | 13 playa · 24 termas · 25 galería |
| G mesa | 14 cervecería · 26 restaurante · 27 costanera |
| H selfie | 16 costanera · 28 balneario · 29 carnaval |
| I primer plano | 17 exterior de día · 30 interior de noche |
| J apoyado | 18 |
| K en contacto | 19 |
| L plano general | 20 |

Los patrones A, C, D y E usan los fondos 1 al 12.

### Marca

| Video | Patrón | Fondo | Por qué |
|---|---|---|---|
| V2 · Qué es Hospeda | **B** | 21 inserto costanera | 40 s recorriendo la plataforma: el inserto deja que la grabación dure lo que haga falta |
| V3 · Qué es Hospeda corta | **F** | 24 reposera termas | sin voz en off ni lip sync, cortes rápidos sobre texto |
| V4 · Por qué armamos Hospeda | **C** | 17 primer plano | el plan pide agobio con las manos en la cabeza: en primer plano esa cara pega el doble |
| V5 · Quién está detrás | **E** → **I** | 1 cabaña → 17 primer plano | presenta, le cede el cuadro a la persona real, y cierra en primer plano |
| V6 · Estamos construyendo Hospeda | **E** | 4 costanera | montaje de la región, el fondo es el tema |

### Anfitriones — captación

| Video | Patrón | Fondo | Por qué |
|---|---|---|---|
| V1 · Pegá el link | **A** | 1 cabaña | el portal está pensado justo para esto: mensaje corto más demo corta |
| V7 · Si tenés un alojamiento | **B** | 15 inserto cabaña | recorre una ficha entera, y la cabaña es el fondo del anfitrión |
| V8 · Formás parte del destino | **D** mapa | 5 palmar | es una idea, no una pantalla: el mapa es el argumento |
| V9 · Sin comisión por reserva | **A** | 7 balneario | ✅ prompt escrito |
| V10 · Todo lo que podés mostrar | **B** | 15 inserto cabaña | recorrido sección por sección |
| V11 · Publicar es simple | **B** | 15 inserto cabaña | el alta completa tiene que verse entera |
| V12 · Probalo gratis | **F** | 25 reposera galería | mensaje único sin presión, y la galería es el patio del anfitrión |
| V13 · Planes para cada tamaño | **B** | 22 inserto balneario | comparación de funciones en pantalla |
| V14 · Sumate ahora | **D** lamparita | 4 costanera | conceptual, sin pantalla que mostrar |
| V15 · Somos anfitriones, como vos | **G** → **I** | 14 cervecería → 30 primer plano interior | de anfitrión a anfitrión, y el remate en primer plano: el 30 es de interior nocturno, así que la luz empalma con la cervecería |

### Anfitriones — funciones

| Video | Patrón | Fondo | Por qué |
|---|---|---|---|
| V16 · El calendario se sincroniza solo | **A** | 1 cabaña | susto y alivio alrededor de una demo corta |
| V17 · La IA te escribe la descripción | **A** | 1 cabaña | el antes y después vive en la pantalla |
| V18 · Las consultas van a tu WhatsApp | **A** | 18 apoyado | 18 s, una sola función, y el fondo 18 ya trae el celular en la mano |
| V19 · Traé tus opiniones de Google | **A** | 1 cabaña | el cambio visual en la ficha es el mensaje |
| V20 · Mirá cómo te va | **B** | 21 inserto costanera | el panel necesita tiempo en pantalla |
| V21 · Pagás con Mercado Pago | **C** | 17 primer plano | sobrio: el logo hace el trabajo, no hace falta que hable |
| V22 · Presencia en Google y en las IA | **D** lamparita | 4 costanera | idea abstracta, sin demo posible |
| V23 · Hospeda no reemplaza nada, suma | **D** mochila | 4 costanera | conceptual, desactiva dos objeciones |

### Anfitriones — consejos

| Video | Patrón | Fondo | Por qué |
|---|---|---|---|
| V24 · Mostrá mejor tu alojamiento | **B** | 15 inserto cabaña | la comparación de fotos va en el inserto |
| V25 · Una buena descripción vende mejor | **B** | 22 inserto balneario | ídem, el antes y después es todo |

### Gastronomía, experiencias y oficios

| Video | Patrón | Fondo | Por qué |
|---|---|---|---|
| V26 · También es para gastronómicos | **G** | 26 mesa restaurante | el fondo hace la mitad del argumento |
| V27 · ¿Ofrecés experiencias? | **E** | 12 bote de pesca | la actividad es el tema; sirve también 19 muelle |
| V28 · Directorio de oficios | **C** | 17 primer plano | cara de problema y alivio, sin diálogo |

### Turistas

| Video | Patrón | Fondo | Por qué |
|---|---|---|---|
| V29 · Un fin de semana en Concepción | **B** | 23 inserto palmar | 45 s recorriendo cinco secciones |
| V30 · Buscá según tu viaje | **A** | 5 palmar | ✅ prompt escrito |
| V31 · Guardá tus favoritos | **F** | 13 reposera playa | el turista planificando, sin apuro |
| V32 · Compará antes de decidir | **B** | 23 inserto palmar | la tabla comparativa necesita pantalla y aire |

### Destinos y comunidad

| Video | Patrón | Fondo | Por qué |
|---|---|---|---|
| V33 · Descubrí un destino (serie) | **L** → **E** | 20 palmar → varía | abre con el plano general y cierra llegando; después 2, 4, 5, 6, 8, 11 o 12 según el destino |
| V34 · Qué hacer este fin de semana (serie) | **H** | 29 selfie carnaval · rota con 16 y 28 | es semanal: el selfie es el formato más rápido y el más nativo, y el fondo rota según el evento de la semana |
| V35 · Buscamos editores locales | **D** notebook | 2 muelle de las islas | convoca a alguien de la zona: el fondo es el argumento |
| V36 · Mostranos tu ciudad | **H** + cámara | 16 selfie costanera | pide fotos de tu ciudad: hablado de cerca y grabado por él mismo convierte más |
| V37 · Qué es ser partner | **G** | 27 mesa costanera | conversación entre organizaciones: de día es más institucional que la cervecería |

### Cómo quedó repartido

Ningún bloque de videos repite fondo dentro del mismo patrón:

| Patrón | Fondo | Videos |
|---|---|---|
| B | 15 cabaña | V7 · V10 · V11 · V24 |
| B | 21 costanera | V2 · V20 |
| B | 22 balneario | V13 · V25 |
| B | 23 palmar | V29 · V32 |
| F | 13 playa | V31 |
| F | 24 termas | V3 |
| F | 25 galería | V12 |
| G | 14 cervecería | V15 |
| G | 26 restaurante | V26 |
| G | 27 costanera | V37 |
| H | 16 costanera | V36 |
| H | 29 carnaval · rota | V34 |
| I | 17 exterior | V4 · V5 · V21 · V28 |
| I | 30 interior | V15 como remate |

El fondo 15 lleva cuatro videos y los cuatro son sobre la propiedad del anfitrión, así
que la cabaña corresponde en todos. El resto quedó a dos o menos.

---

## Resumen

**37 videos.** Doce cortos y el resto largos, más dos series abiertas (destinos y agenda semanal) que se repiten indefinidamente.

### Por dónde empezar

1. **V1** (importar la ficha) — es el mejor argumento y ya está desarrollado entero
2. **V2 y V3** (qué es Hospeda) — sin eso no hay presentación de marca
3. **V7, V9, V12, V15** — el núcleo de captación de anfitriones
4. **V28** en su versión para oficios — destraba el directorio
5. **V36** — destraba la serie de destinos
6. El resto, por prioridad

### Lo que hay que resolver antes

| Qué | Para qué videos |
|---|---|
| La descripción fija de Hospedín y sus imágenes de referencia | Todos |
| Cuenta de anfitrión real para grabar, no la de super admin | Todos los que muestran pantalla |
| Los cuatro problemas reales del rubro | V15 |
| Material filmado de cada destino | V33 |
| Que no se lean precios al grabar la página de planes | V13 |
