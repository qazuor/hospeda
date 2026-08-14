# Hospedín — Biblia del personaje

Mascota oficial, presentador virtual y guía turístico de Hospeda.

> **Cómo se usa este documento.** Cuando un prompt de generación diga `[DESCRIPCIÓN DE HOSPEDÍN]`, se pega **este documento entero, sin resumir ni recortar**. Resumirlo "para que entre" es exactamente lo que hace que el personaje cambie entre generaciones.

## Imágenes de referencia

Están en las subcarpetas de `docs/marketing/` y son la fuente de verdad visual. **Van en cada generación junto con este texto.**

Los nombres son cortos, sin acentos ni espacios, para poder referenciarlos como `@personaje`, `@poses`, `@expresiones`, `@bocas`, `@acciones`, `@escena7`, `@pantalla` y `@voz` en los modelos que aceptan referencias etiquetadas.

| Archivo | Qué contiene |
|---|---|
| `personaje/personaje.png` | **Lámina madre.** El personaje en pose principal, cuerpo entero, alta resolución |
| `personaje/poses.png` | Turnaround de cinco vistas (frente, 3/4 adelante, perfil, espaldas, 3/4 atrás) + la paleta con los cinco códigos hex |
| `personaje/expresiones.png` | Quince expresiones faciales rotuladas, en tres filas de cinco |
| `personaje/bocas.png` | **Hoja de bocas para sincronización labial**: quince formas rotuladas (A, E, I, O, U, M, B, P, F, V, L, T, D, S, R) |
| `personaje/acciones.png` | Dieciocho poses de cuerpo entero rotuladas, en tres filas de seis |
| `personaje/voz.wav` | Seis segundos de la voz de Hospedín, para los modelos que clonan timbre a partir de un audio |
| `escenas/escena1.png` … `escena30.png` | Hospedín integrado en distintos lugares del Litoral, listos para usar como cuadro de partida. Cuál es cuál: [`prompts/fondos.md`](prompts/fondos.md) |
| `capturas/pantalla.png` | Captura real de la home de Hospeda en móvil, para lo que se vea en pantalla. Proporciones y cómo grabar: [`prompts/grabaciones.md`](prompts/grabaciones.md) |
| `placas/final.png` | Placa de cierre con logo, dirección y llamado a la acción |

**Cuál usar según el caso:**

- **Un plano nuevo del personaje** → `personaje/personaje.png` como referencia principal
- **Una vista o ángulo específico** → la vista correspondiente de `personaje/poses.png`
- **Una expresión** → la que corresponda de `personaje/expresiones.png`
- **Una pose de cuerpo entero** → la que corresponda de `personaje/acciones.png`
- **Lip sync** → `personaje/bocas.png`, que tiene las formas para A, E, I, O, U, M, B, P, F, V, L, T, D, S y R
- **Una escena concreta** → la de `escenas/` que corresponda: ya traen personaje y lugar integrados en una sola pieza
- **La voz** → `personaje/voz.wav` en los modelos que aceptan audio de referencia

---

## Índice

1. [Quién es Hospedín](#1-quién-es-hospedín)
2. [Identidad visual](#2-identidad-visual)
3. [Proporciones](#3-proporciones)
4. [Estilo visual](#4-estilo-visual)
5. [Personalidad](#5-personalidad)
6. [Identidad cultural](#6-identidad-cultural)
7. [Voz](#7-voz)
8. [Lenguaje corporal](#8-lenguaje-corporal)
9. [Expresiones faciales](#9-expresiones-faciales)
10. [Habla y sincronización labial](#10-habla-y-sincronización-labial)
11. [Animación](#11-animación)
12. [Cámara](#12-cámara)
13. [Videos para redes sociales](#13-videos-para-redes-sociales)
14. [Interacción con escenarios reales](#14-interacción-con-escenarios-reales)
15. [Interacción con interfaces digitales](#15-interacción-con-interfaces-digitales)
16. [Vestimenta](#16-vestimenta)
17. [Consistencia de marca](#17-consistencia-de-marca)
18. [Elementos que nunca deben cambiar](#18-elementos-que-nunca-deben-cambiar)
19. [Continuidad entre tomas](#19-continuidad-entre-tomas)
20. [Forma de actuar](#20-forma-de-actuar)
21. [Humor](#21-humor)
22. [Comportamiento predeterminado](#22-comportamiento-predeterminado)
23. [Regla fundamental](#23-regla-fundamental)

---

## Instrucción para el modelo

Estás trabajando con **Hospedín**, la mascota oficial, presentador virtual y guía turístico de Hospeda.

Las imágenes de referencia proporcionadas son la **referencia visual principal y autoritativa** del personaje.

El objetivo es preservar de manera consistente la identidad, proporciones, colores, personalidad, vestimenta y estilo visual de Hospedín en todas las imágenes, animaciones y videos.

**No rediseñar, reinterpretar ni "mejorar" el personaje** salvo que se solicite explícitamente.

> **La consistencia visual del personaje tiene prioridad sobre la creatividad.**

---

## 1. Quién es Hospedín

**Nombre**: Hospedín
**Sitio web**: hospeda.com.ar
**Rol**: Mascota oficial, presentador virtual y guía turístico de Hospeda.

Hospeda es una plataforma turística enfocada inicialmente en Entre Ríos y el Litoral argentino, que reúne en un mismo lugar información y servicios relacionados con alojamientos, gastronomía, experiencias, atractivos turísticos, destinos, eventos, servicios turísticos e información útil para viajeros.

Hospedín representa a Hospeda y funciona como un puente amigable entre la plataforma y sus usuarios. Puede comunicarse tanto con turistas como con propietarios de alojamientos, gastronómicos, prestadores de experiencias, profesionales y empresas vinculadas al turismo.

### Qué puede hacer Hospedín

- Explicar qué es Hospeda y cómo funciona
- Presentar funcionalidades
- Recomendar lugares
- Presentar destinos y alojamientos
- Hablar sobre gastronomía
- Presentar experiencias y actividades
- Anunciar eventos
- Brindar información turística
- Explicar beneficios para propietarios, gastronómicos y prestadores turísticos
- Dar consejos de viaje
- Explicar cómo utilizar el sitio web
- Señalar elementos de una interfaz
- Presentar promociones
- Realizar tutoriales
- Actuar como conductor de videos
- Presentar contenido para redes sociales

> Hospedín **no es una mascota decorativa**. Es un personaje recurrente y reconocible que debe sentirse como el presentador y guía oficial del universo Hospeda.

---

## 2. Identidad visual

> **Usar siempre las imágenes de referencia proporcionadas como fuente principal de verdad visual.**

La silueta de Hospedín está directamente inspirada en el logo de Hospeda, y los colores principales provienen de la identidad visual de la marca.

Su diseño combina visualmente los tres elementos del logo, que son los tres elementos del paisaje del Litoral:

- **El azul** — el río, que es la forma principal y le da la silueta a la cabeza
- **El verde y el turquesa** — la costa y el campo, integrados en la parte inferior del rostro como un paisaje
- **El naranja** — el sol, que flota junto a la cabeza

### Paleta exacta

| Color | Código | Dónde va |
|---|---|---|
| Azul | `#3AA7D9` | Cabeza, brazos, manos, piernas |
| Turquesa | `#1EA7A1` | Franja del rostro |
| Verde | `#8CC63F` | Franja del rostro |
| Naranja | `#F5A623` | El círculo del sol |
| Azul oscuro | `#0D2B3E` | Detalles y contornos |

### Elementos que lo componen

- Una gran **cabeza azul** de forma orgánica y asimétrica
- Formas redondeadas y suaves
- Una **zona turquesa** integrada en la parte inferior del rostro
- Una **zona verde** integrada en la parte inferior del rostro
- Grandes **ojos expresivos**, con pupilas negras
- **Cejas negras**
- **Boca simple y muy expresiva**
- **Brazos y manos azules**
- **Piernas azules**
- **Buzo canguro blanco con capucha** y cordones azules, con el logo de Hospeda al frente —el símbolo **y debajo la palabra `hospeda`**, en minúsculas y azul oscuro, como una sola pieza— y **`hospeda.com.ar` impreso en la espalda**
- **Zapatillas blancas** con detalles en azul, verde y turquesa

### El círculo naranja

Hospedín tiene un **círculo naranja flotante** junto a la zona superior derecha de su cabeza.

Ese círculo **representa el sol** y proviene directamente del logo de Hospeda. Es una parte esencial de la identidad visual del personaje.

**Flota separado de la cabeza**, con aire visible entre los dos. No la toca, no se apoya en el contorno y no se mete adentro. Cuando el personaje gira, el círculo lo acompaña: queda del lado que corresponda por el giro, pero nunca desaparece.

> ⚠️ **Nunca eliminarlo.** Debe permanecer visualmente asociado a Hospedín en toda generación.

---

## 3. Proporciones

Hospedín tiene proporciones estilizadas propias de una mascota animada:

- Cabeza muy grande
- Cuerpo compacto
- Torso pequeño
- Brazos relativamente cortos
- Piernas cortas
- Manos moderadamente grandes
- Zapatillas ligeramente sobredimensionadas

Debe transmitir una sensación **amigable, compacta, suave, redondeada y accesible**.

### Qué evitar

No utilizar anatomía humana realista. Concretamente, evitar:

- Piernas o brazos humanos largos
- Anatomía musculosa
- Manos humanas realistas
- Piel humana
- Orejas, nariz o cabello humanos
- Barba o bigote

> La silueta general debe permanecer extremadamente cercana a las imágenes de referencia.

---

## 4. Estilo visual

Hospedín es un personaje **3D moderno y pulido**.

- Animación 3D moderna
- Formas suaves y redondeadas
- Superficies limpias
- Materiales ligeramente suaves
- Renderizado profesional
- Iluminación suave y sombras naturales
- Expresiones claras
- Colores vivos pero controlados
- Estética publicitaria moderna
- Calidad de animación comercial

Debe parecer apropiado para una marca turística moderna. **Evitar el fotorrealismo excesivo.**

> Incluso cuando Hospedín aparezca dentro de escenarios reales, debe continuar siendo claramente un personaje animado 3D.

---

## 5. Personalidad

Hospedín es amigable, cercano, curioso, servicial, optimista, simpático, inteligente, confiable y alegre. Es juguetón cuando corresponde, entusiasta por los viajes, conocedor de Entre Ríos y del Litoral argentino, e interesado en descubrir lugares y ayudar a viajeros.

Le gusta ayudar a las personas a descubrir lugares, experiencias y servicios. **Su entusiasmo debe sentirse genuino.**

### Qué no debe ser

Infantil · hiperactivo · molesto · arrogante · ingenuo · agresivo · excesivamente corporativo · excesivamente vendedor · payasesco · exageradamente efusivo.

### Para quién funciona

Debe funcionar correctamente para adultos, familias, parejas, viajeros, propietarios de alojamientos, gastronómicos, prestadores turísticos y profesionales del turismo.

> Conceptualmente puede pensarse como una combinación de:
> **guía turístico local + asistente digital + presentador + mascota de marca**.

---

## 6. Identidad cultural

Hospedín es argentino, y su identidad está especialmente relacionada con **Entre Ríos y el Litoral argentino**.

Debe transmitir de manera sutil: cercanía, hospitalidad, tranquilidad, conocimiento local y entusiasmo por la región.

### Español rioplatense

Cuando habla en español debe utilizar español rioplatense natural. Formas a utilizar cuando corresponda:

`podés` · `tenés` · `querés` · `encontrá` · `conocé` · `descubrí` · `vení` · `mirá`

Evitar el español excesivamente neutro o expresiones que resulten extrañas en Argentina.

### Sin exagerar el estereotipo

No abusar de *che · boludo · viste · dale* ni de modismos regionales.

> Su identidad argentina debe sentirse **natural, moderna y profesional**.

---

## 7. Voz

Hospedín debe tener una voz argentina amigable, de adulto joven: cálida, clara, conversacional, segura, agradable, natural, expresiva y fácil de comprender.

**Velocidad**: moderada. Debe transmitir energía sin hablar apresuradamente.

Debe sonar como alguien que conoce la región, disfruta viajar, disfruta explicar y quiere ayudar.

### Qué evitar

Voz infantil · voz excesivamente aguda · voz de locutor publicitario tradicional · tono artificial o robótico · gritos · entusiasmo exagerado · tono de vendedor agresivo.

> Hospedín habla como una persona cercana que conoce muy bien aquello que está explicando.

---

## 8. Lenguaje corporal

Hospedín es expresivo. Puede usar gestos como:

- Saludar con la mano
- Señalar
- Levantar el pulgar
- Abrir los brazos
- Explicar utilizando las manos
- Mirar hacia aquello que está explicando
- Señalar textos e interfaces
- Asentir
- Pensar
- Festejar
- Caminar
- Presentar algo con la palma abierta
- Sostener objetos
- Interactuar con pantallas

Los movimientos deben ser **fluidos, claros, naturales e intencionales**.

> No debe moverse constantemente sin motivo. Cuando habla, sus movimientos deben reforzar aquello que está diciendo.

---

## 9. Expresiones faciales

Los ojos, cejas y boca de Hospedín son muy expresivos.

| Expresión | Cómo se ve |
|---|---|
| **Alegre** | Ojos abiertos y relajados, cejas naturales, sonrisa amigable |
| **Entusiasmado** | Sonrisa amplia, cejas ligeramente elevadas, postura energética |
| **Curioso** | Cabeza ligeramente inclinada, mirada concentrada |
| **Pensando** | Mirada ligeramente hacia arriba, una mano cerca del mentón |
| **Sorprendido** | Cejas elevadas, ojos abiertos, boca pequeña abierta |
| **Confiado** | Sonrisa amigable, ojos relajados, postura segura |
| **Explicando** | Mirada comprometida, sonrisa moderada, movimientos naturales de manos |
| **Divertido** | Pequeña sonrisa, posibilidad de guiño cuando sea apropiado |
| **Serio / informativo** | Expresión neutral pero amigable, postura tranquila, mirada atenta |

### Las cinco expresiones negativas

Hospedín también nombra el problema antes de resolverlo, y para eso necesita expresiones que no sean alegres. **Son incómodas, nunca agresivas**: la sección 5 pone "agresivo" en la lista de lo que el personaje no debe ser, y eso no se levanta acá.

| Expresión | Cómo se ve |
|---|---|
| **Fastidio** | Párpados a media asta, cejas caídas, boca en línea torcida. Resignado, no enojado |
| **Molesto** | Cejas juntas hacia adentro, boca recta. Es lo más lejos que llega: fastidio con el ceño fruncido |
| **Agobio** | Cejas caídas hacia afuera, ojos grandes, boca hacia abajo. Desbordado, pidiendo ayuda |
| **Susto** | Cejas altas, ojos muy abiertos, boca chica abierta. Sorpresa desagradable, breve |
| **Preocupación** | Cejas caídas, mirada baja, boca en arco hacia abajo. Es la más suave de las cinco |

### Expresiones ya generadas

Las quince de `personaje/expresiones.png`. Conviene partir de una de ellas antes de generar una nueva:

`alegre` · `risueño` · `guiñando` · `entusiasmado` · `contento` · `pensando` · `duda` · `serio` · `sorprendido` · `divertido` · `fastidio` · `molesto` · `agobio` · `susto` · `preocupación`

### Poses ya generadas

Las dieciocho de `personaje/acciones.png`:

`saludando` · `señalando` · `te explico` · `descubrí` · `es fácil` · `enumerando` · `¡vamos!` · `pensando` · `negando` · `agobiado` · `caminando` · `con la llave` · `con el teléfono mostrando la pantalla` · `con valija` · `con mochila` · `con la notebook` · `con el mapa` · `con la cámara de fotos`

> **Al usar `acciones.png` como referencia**: en `con la notebook`, `con el mapa` y `con la cámara`, el objeto tapa el logo del buzo. Es un defecto de esa lámina, no una licencia: el logo con la palabra `hospeda` debajo del símbolo va siempre visible salvo que el objeto lo tape físicamente en el plano. Para esas tres, tomar el logo de `personaje/personaje.png`.
>
> Hospedín **nunca** debe resultar aterrador, agresivo, perturbador, extraño ni siniestro.

---

## 10. Habla y sincronización labial

Cuando Hospedín habla:

- Sincronizar correctamente la boca con el diálogo
- Preservar el diseño original de la boca
- Utilizar formas de boca claras
- Animar sutilmente las mejillas cuando corresponda
- Parpadear ocasionalmente
- Utilizar las cejas para enfatizar frases
- Realizar pequeños movimientos de cabeza
- Respetar pausas naturales

### Qué evitar

- No deformar exageradamente el rostro
- No crear labios humanos
- No crear dientes humanos excesivamente realistas

> La boca debe continuar perteneciendo visualmente al personaje original.

---

## 11. Animación

La animación debe sentirse profesional, fluida y expresiva:

- Movimientos suaves
- Anticipación antes de gestos importantes
- Movimientos secundarios sutiles
- Sensación natural de peso
- Poses claras y siluetas fáciles de interpretar
- *Squash & stretch* moderado
- Pequeños movimientos cuando está quieto

> Hospedín debe sentirse vivo incluso cuando no está hablando.

### Animaciones de espera

Respiración sutil · parpadeos · pequeños cambios de postura · pequeños movimientos de cabeza · movimientos suaves de ojos.

Evitar que rebote constantemente y evitar movimientos frenéticos.

---

## 12. Cámara

Para videos donde actúa como presentador, usar preferentemente **plano medio**, **plano americano**, o **plano entero** cuando sea importante mostrar movimiento.

Cuando habla directamente al público, Hospedín normalmente mira hacia cámara.

### Cuando presenta algo

1. Mira hacia el objeto
2. Señala o interactúa con él
3. Vuelve naturalmente su atención hacia la cámara

### Movimientos de cámara

Generalmente suaves. Pueden usarse acercamiento lento, alejamiento lento, paneo suave y seguimiento ligero.

> Evitar movimientos de cámara caóticos salvo que la escena específicamente lo requiera.

---

## 13. Videos para redes sociales

Hospedín se utiliza frecuentemente en Reels, historias, videos verticales, videos promocionales, tutoriales, anuncios, presentaciones de funcionalidades y contenido turístico.

### Formato predeterminado

**Cuando no se especifique formato: video vertical 9:16.**

### Zonas seguras

La composición debe dejar zonas seguras para subtítulos, títulos, elementos gráficos, interfaz, logo y llamadas a la acción.

> ⚠️ **No colocar partes importantes del personaje donde puedan quedar ocultas por elementos de interfaz de Instagram o TikTok.**

Medidas de referencia para 1080 × 1920: dejar libres los **250 px superiores**, los **420 px inferiores** y los **180 px del borde derecho**.

---

## 14. Interacción con escenarios reales

Hospedín puede aparecer dentro de escenarios reales: playas, ríos, costaneras, cabañas, hoteles, departamentos, casas, restaurantes, campings, complejos termales, paisajes naturales, edificios históricos, calles, plazas, atractivos turísticos y eventos.

> **Cuando aparece en un escenario real, debe continuar siendo un personaje 3D.**

Integrarlo correctamente mediante iluminación, sombras, perspectiva, escala, dirección de luz y reflejos ambientales. Debe sentirse físicamente presente dentro del escenario.

**No transformar a Hospedín en una criatura fotorrealista.**

---

## 15. Interacción con interfaces digitales

Hospedín puede presentar el sitio web o la interfaz móvil de Hospeda. Puede pararse junto a una pantalla, señalar tarjetas y botones, explicar funciones de búsqueda, mostrar mapas, presentar alojamientos, explicar filtros, mostrar información de destinos, señalar fotografías y explicar funcionalidades.

> **Cuando se proporcione una captura real de Hospeda: no rediseñar la interfaz ni inventar una nueva.** Utilizar fielmente el diseño proporcionado.

Hospedín actúa como presentador de la interfaz, no como su diseñador.

---

## 16. Vestimenta

**Vestimenta predeterminada**: buzo canguro blanco con capucha de Hospeda. El logo debe permanecer visible y reconocible.

**Calzado predeterminado**: zapatillas blancas con detalles sutiles en azul, verde y turquesa.

Solo utilizar vestimenta alternativa cuando sea solicitada explícitamente.

### Accesorios

Puede usar accesorios relacionados con viajes cuando la escena lo requiera: mochila, valija, cámara fotográfica, anteojos de sol, sombrero para el sol, mapa, teléfono móvil, tablet.

> Los accesorios **nunca** deben ocultar ni modificar la identidad fundamental del personaje.

---

## 17. Consistencia de marca

Hospedín debe ser inmediatamente reconocible entre distintas imágenes, escenas, videos, campañas y publicaciones.

### Mantener siempre

Silueta de la cabeza · círculo naranja · proporciones faciales · forma de los ojos · estilo de cejas · estilo de boca · colores · formas verde y turquesa · proporciones corporales · buzo blanco · logo · zapatillas.

> **La consistencia del personaje es más importante que la variación creativa.**

---

## 18. Elementos que nunca deben cambiar

**Nunca:**

- Eliminar el círculo naranja
- Agregar cabello, orejas, nariz o piel humana
- Hacerlo musculoso
- Hacerlo alto y delgado
- Modificar los colores principales
- Alterar radicalmente la silueta
- Modificar el logo de Hospeda
- Convertirlo en un animal o en un humano
- Agregar labios humanos
- Hacerlo aterrador
- Cambiar arbitrariamente su edad aparente
- Cambiar sus proporciones entre escenas
- Modificar arbitrariamente la posición del círculo naranja

---

## 19. Continuidad entre tomas

En videos compuestos por múltiples tomas, **Hospedín debe considerarse el mismo personaje físico durante toda la producción**.

### Mantener continuidad de

Tamaño corporal · ropa · colores · accesorios · rostro · proporciones · posición del círculo naranja · estilo visual.

Si varias tomas pertenecen a una misma escena, mantener además la dirección de iluminación, la posición de los accesorios, la orientación espacial y las condiciones ambientales.

> **No generar una versión ligeramente diferente de Hospedín para cada toma.** Siempre que sea posible, utilizar las imágenes maestras de referencia en **cada** generación.

---

## 20. Forma de actuar

Hospedín debe **actuar** como presentador. No debe limitarse a permanecer quieto mirando la cámara.

**Cada movimiento debe comunicar algo.**

| Si dice | Puede hacer |
|---|---|
| "Encontrá alojamientos" | Señalar tarjetas de alojamientos |
| "Contactate directamente con el propietario" | Señalar un botón o ícono de contacto |
| "Descubrí Entre Ríos" | Abrir los brazos mostrando un paisaje |
| "Elegí tu próximo destino" | Desplegar o señalar un mapa |

> La acción visual debe reforzar el diálogo.

---

## 21. Humor

Hospedín puede utilizar humor ocasional. El humor debe ser **ligero, inteligente, familiar, simpático y breve**.

Puede reaccionar visualmente a situaciones mediante miradas, pequeños gestos, pausas y expresiones.

> No convertirlo en un personaje exclusivamente cómico. Su función principal continúa siendo **informar, ayudar, presentar y acompañar**.

---

## 22. Comportamiento predeterminado

Cuando una instrucción no especifique todos los detalles necesarios, usar estos valores:

| Aspecto | Valor predeterminado |
|---|---|
| Expresión | Amigable y alegre |
| Postura | Relajada pero segura |
| Mirada | Principalmente hacia cámara |
| Gesticulación | Moderada |
| Movimiento | Suave y natural |
| Parpadeo | Natural y ocasional |
| Respiración | Muy sutil |
| Personalidad | Argentina, cercana y conocedora de turismo |
| Comportamiento | Presentador profesional y amigable |
| Formato de video | Vertical 9:16 cuando esté destinado a redes sociales |

> **No inventar cambios visuales importantes.**

---

## 23. Regla fundamental

Hospedín es un **personaje de marca establecido**. No es un personaje nuevo que deba diseñarse en cada generación.

Cada nueva imagen o video debe representar al **mismo** Hospedín.

> La prioridad absoluta es preservar su identidad visual y su personalidad.

El objetivo es que una persona pueda mirar decenas de videos creados en distintos momentos y reconocer inmediatamente al mismo personaje:

**Hospedín** — mascota oficial, presentador virtual y guía turístico de Hospeda.

---

## Cómo se relaciona con la paleta de las placas

Las dos paletas ya están reconciliadas, sin rehacer nada del personaje:

- **El azul `#3AA7D9` y el naranja `#F5A623` se sumaron** a la paleta de las placas. No reemplazaron a los que ya estaban: ahora hay dos azules y dos naranjas disponibles, el original para las placas y el del personaje para cuando Hospedín aparezca o para piezas que tengan que dialogar con él.
- **El verde `#8CC63F` reemplazó al `#90BE1E`** que usaban las placas. Eran casi el mismo color y tener los dos era redundante.
- El resto de la paleta de placas quedó intacta.

La paleta unificada está en [`plan-contenido-redes.md`](plan-contenido-redes.md).

El azul oscuro `#0D2B3E` es exclusivo del personaje, para detalles y contornos. No se agregó a las placas.

---

## El eslogan

La guía de personaje trae el eslogan de la marca, que no estaba en el plan de contenido:

> **Hospeda — Todo tu viaje, en un solo lugar.**

Conviene usarlo de forma consistente en las piezas de marca. Va bien como cierre de las placas de la categoría 1 y como remate de los videos institucionales.
