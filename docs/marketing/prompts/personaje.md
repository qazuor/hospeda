# Láminas del personaje — prompts

Las cinco láminas de referencia de Hospedín, en `../personaje/`. Son la fuente de
verdad visual del personaje: van adjuntas en cada generación de fondo y de video, junto
con la biblia completa de [`../personaje-hospedin.md`](../personaje-hospedin.md).

| Lámina | Qué contiene |
|---|---|
| `personaje.png` | El personaje en pose principal, cuerpo entero |
| `poses.png` | Turnaround de cinco vistas + la paleta con los cinco hex |
| `expresiones.png` | Quince expresiones faciales rotuladas |
| `bocas.png` | Quince formas de boca para sincronización labial |
| `acciones.png` | Diecinueve poses de cuerpo entero rotuladas |

## Cómo generarlas

**En una sola conversación de ChatGPT y en este orden.** Cada lámina se apoya en la
anterior: la madre fija la identidad, y las demás la heredan. Pedir la siguiente recién
cuando la anterior esté aprobada.

En la primera, adjuntar las láminas actuales de `../personaje/` como referencia de
silueta, colores y proporciones.

---

## 1 · personaje.png — la lámina madre

```
Personaje 3D de marca, cuerpo entero, sobre fondo blanco liso.

QUIÉN ES
Hospedín, la mascota de Hospeda: una figura simpática con una gran cabeza azul en
forma de gota redondeada y asimétrica, cuerpo pequeño y compacto, brazos y piernas
cortos.

LA CABEZA
Grande, orgánica y asimétrica, de un azul claro (#3AA7D9), con la punta redondeada
inclinada hacia arriba y a un costado. En la parte baja del rostro, integradas como un
paisaje, una franja turquesa (#1EA7A1) y una franja verde (#8CC63F) que atraviesan la
cara en diagonal, más anchas hacia un lado.

Ojos muy grandes y expresivos, blancos, con pupilas negras redondas y un brillo. Cejas
negras, gruesas, curvas y bien separadas de los ojos. Boca simple y muy expresiva:
una forma abierta con el interior oscuro y la lengua rosada, sin dientes visibles en
esta pose. Sin nariz, sin orejas, sin pelo, sin piel humana.

EL CÍRCULO NARANJA
Un círculo naranja (#F5A623) sólido y plano FLOTA en el aire junto a la zona superior
derecha de la cabeza, SIN TOCARLA: queda claramente separado, con un espacio de aire
entre el círculo y el borde de la cabeza. Representa el sol. Es esencial y no puede
faltar, y tiene que entrar completo en el cuadro, sin quedar cortado por el borde.

EL CUERPO
Torso pequeño, brazos cortos, manos azules redondeadas con dedos gruesos y sin uñas,
piernas cortas azules, zapatillas blancas ligeramente sobredimensionadas con detalles
en azul y verde. Proporción general: la cabeza ocupa aproximadamente la mitad de la
altura total.

LA ROPA
Buzo canguro blanco con capucha y cordones azules, con bolsillo canguro al frente.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —una forma redondeada
tipo gota, azul con una franja verde y turquesa abajo, y un punto naranja arriba a la
derecha— y DEBAJO DEL SÍMBOLO la palabra hospeda, en minúsculas, en azul oscuro, con
tipografía redondeada y limpia, centrada respecto del símbolo y claramente legible. El
símbolo arriba y la palabra abajo, como una sola pieza. La palabra tiene que estar: no
la omitas y no la reemplaces por otro texto. Se escribe hospeda, sin mayúsculas, sin
acento y sin la extensión del dominio.

LA POSE
De pie, de frente, mirando a cámara. Una mano levantada con el dedo índice apuntando
hacia arriba, como quien va a explicar algo. La otra mano abierta hacia adelante con la
palma hacia arriba. Expresión alegre, sonriendo con la boca abierta.

ESTILO
Personaje animado 3D moderno y pulido, calidad de animación comercial. Superficies
limpias y suaves, materiales ligeramente mates, iluminación pareja y suave con sombras
naturales, colores vivos pero controlados. Sin fotorrealismo.

FORMATO
Imagen vertical, máxima resolución posible, personaje centrado y completo con aire
alrededor. Fondo blanco liso, sin degradados, sin texturas y sin sombra proyectada
sobre el fondo. Sin texto en ninguna parte de la imagen salvo la palabra del buzo.
```

---

## 2 · poses.png — el giro completo

```
Hoja de referencia de giro (turnaround) del MISMO personaje de la imagen anterior,
sobre fondo blanco liso.

CINCO VISTAS EN UNA FILA, todas del mismo tamaño, a la misma altura y con la misma
iluminación, alineadas sobre una línea de piso imaginaria:

1. De FRENTE
2. De TRES CUARTOS adelante
3. De PERFIL
4. De ESPALDAS
5. De TRES CUARTOS atrás

En las cinco, el personaje está de pie, relajado, con los brazos a los costados y
expresión neutra y amigable. La misma pose en todas: lo único que cambia es el ángulo.

EN LAS VISTAS DE ESPALDAS Y TRES CUARTOS ATRÁS, en la espalda del buzo va impreso el
texto hospeda.com.ar, en minúsculas, en azul oscuro, centrado y legible.

EN LAS VISTAS DE FRENTE Y TRES CUARTOS ADELANTE se ve el logo del buzo. El logo del
buzo es el símbolo de Hospeda —forma redondeada tipo gota, azul con franja verde y
turquesa abajo y punto naranja arriba— y DEBAJO DEL SÍMBOLO la palabra hospeda, en
minúsculas, en azul oscuro, tipografía redondeada, centrada y legible. El símbolo
arriba y la palabra abajo, como una sola pieza. La palabra tiene que estar.

EL CÍRCULO NARANJA flotante acompaña a la cabeza en las cinco vistas, siempre en la
misma posición relativa a ella y girando con el personaje. En la vista de espaldas
queda del lado que corresponda por el giro, pero NUNCA desaparece.

⚠️ EL CÍRCULO NARANJA, EN CADA UNA DE LAS FIGURAS. Es lo primero que se pierde en una
lámina con muchas figuras chicas: o desaparece en algunas, o se pega a la cabeza, o
cambia de lado. Tiene que estar en TODAS, siempre FLOTANDO SEPARADO de la cabeza, del
mismo tamaño relativo y en la misma posición respecto de ella. Ninguna figura de la
lámina puede quedar sin él.

⚠️ AIRE ALREDEDOR DE CADA FIGURA. Entre una figura y la siguiente, y entre cada figura y
el borde de la lámina, tiene que quedar espacio libre suficiente para que el círculo
naranja entre completo sin tocar nada. Preferir figuras más chicas y más separadas antes
que apretadas.

DEBAJO DE LA FILA, una tira horizontal con cinco muestras de color cuadradas, cada una
con su código escrito abajo en letra chica:
#3AA7D9 · #1EA7A1 · #8CC63F · #F5A623 · #0D2B3E

MISMO PERSONAJE que la imagen anterior, sin ningún rediseño: misma silueta de cabeza,
mismas proporciones, mismos colores, mismo buzo, mismas zapatillas.

FORMATO
Imagen horizontal, máxima resolución posible. Fondo blanco liso, sin degradados y sin
texturas. Sin más texto que la dirección de la espalda, la palabra del buzo y los
códigos de color.
```

---

## 3 · expresiones.png — quince expresiones

```
Hoja de expresiones del MISMO personaje de las imágenes anteriores, sobre fondo blanco
liso.

QUINCE RETRATOS del personaje, solo cabeza y hombros, todos del mismo tamaño y con la
misma iluminación, ordenados en una grilla de cinco columnas por tres filas. Debajo de
cada uno, su nombre en letra chica, en mayúsculas y en azul oscuro.

FILA 1 — positivas:
ALEGRE — ojos abiertos y relajados, cejas naturales, sonrisa amigable
RISUEÑO — ojos entrecerrados de risa, sonrisa amplia
GUIÑANDO — un ojo cerrado, sonrisa pícara
ENTUSIASMADO — sonrisa muy amplia, cejas elevadas, ojos bien abiertos
CONTENTO — sonrisa cerrada y tranquila, ojos relajados

FILA 2 — neutras y pensativas:
PENSANDO — mirada hacia arriba y a un costado, boca pequeña, una ceja levantada
DUDA — cejas desparejas, boca torcida, mirada de costado
SERIO — expresión neutra pero amigable, boca en línea recta, mirada atenta
SORPRENDIDO — cejas muy elevadas, ojos muy abiertos, boca pequeña y redonda abierta
DIVERTIDO — sonrisa de costado, un ojo guiñando, lengua apenas afuera

FILA 3 — negativas, TODAS NUEVAS:
FASTIDIO — cejas bajas y caídas hacia afuera, boca torcida hacia un costado, párpados
a media asta. Cansancio de otra vez lo mismo
MOLESTO — cejas bajas y juntas, boca apretada en línea, mirada firme. Molesto pero NO
agresivo
AGOBIO — cejas altas por el medio y caídas por afuera, boca pequeña hacia abajo, ojos
grandes, expresión de estar desbordado
SUSTO — ojos enormes, pupilas chicas, cejas muy altas, boca abierta en óvalo
PREOCUPACIÓN — cejas juntas y levantadas por el medio, boca pequeña hacia abajo,
mirada baja

⚠️ LAS CINCO NEGATIVAS NUNCA SON AGRESIVAS. Nada de cejas en punta de enojo, nada de
mostrar los dientes con violencia, nada de gesto amenazante. Son cansancio, molestia,
desborde, susto y preocupación: siempre simpáticas y nunca hostiles.

EL CÍRCULO NARANJA flotante acompaña a la cabeza en los quince retratos, en su
posición habitual.

⚠️ EL CÍRCULO NARANJA, EN CADA UNA DE LAS FIGURAS. Es lo primero que se pierde en una
lámina con muchas figuras chicas: o desaparece en algunas, o se pega a la cabeza, o
cambia de lado. Tiene que estar en TODAS, siempre FLOTANDO SEPARADO de la cabeza, del
mismo tamaño relativo y en la misma posición respecto de ella. Ninguna figura de la
lámina puede quedar sin él.

⚠️ AIRE ALREDEDOR DE CADA FIGURA. Entre una figura y la siguiente, y entre cada figura y
el borde de la lámina, tiene que quedar espacio libre suficiente para que el círculo
naranja entre completo sin tocar nada. Preferir figuras más chicas y más separadas antes
que apretadas.

MISMO PERSONAJE que las imágenes anteriores, sin ningún rediseño: misma silueta de
cabeza, mismas franjas verde y turquesa en la parte baja del rostro, mismos ojos,
mismas cejas, mismos colores.

FORMATO
Imagen horizontal, máxima resolución posible. Fondo blanco liso. Los quince retratos
bien separados entre sí, sin superponerse. Sin más texto que los nombres debajo de
cada uno.
```

---

## 4 · bocas.png — sincronización labial

```
Hoja de formas de boca para sincronización labial del MISMO personaje de las imágenes
anteriores, sobre fondo blanco liso.

QUINCE FORMAS DE BOCA, cada una en un recuadro, ordenadas en una grilla de cinco
columnas por tres filas, en este orden exacto:

FILA 1: A · E · I · O · U
FILA 2: M · B · P · F · V
FILA 3: L · T · D · S · R

Debajo de cada recuadro va su letra, en mayúscula, grande y clara, en azul oscuro.

CADA RECUADRO muestra ÚNICAMENTE la zona de la boca del personaje, en primer plano
sobre el color azul de su cara, sin ojos, sin cejas y sin el resto de la cabeza.

CÓMO ES CADA UNA:
A — boca bien abierta, ovalada, interior oscuro, lengua rosada abajo
E — abierta y ancha, más achatada que la A, lengua rosada abajo
I — abierta y estirada a lo ancho, con una hilera de dientes blancos arriba
O — abierta y redonda, más chica, interior oscuro con lengua rosada
U — abierta y pequeña, ovalada y fruncida hacia adelante
M — cerrada, una línea curva suave
B — cerrada, línea recta y apretada
P — cerrada y algo comprimida, con las comisuras hacia adentro
F — entreabierta, con una hilera de dientes blancos arriba apoyada sobre el labio
inferior
V — igual que la F, con los dientes superiores a la vista
L — abierta, con la lengua rosada levantada tocando la parte de arriba
T — entreabierta, con una hilera de dientes blancos arriba y la lengua detrás
D — entreabierta, dientes blancos arriba bien visibles, boca algo más abierta que la T
S — apenas abierta y estirada, con las dos hileras de dientes blancos juntas
R — abierta y redondeada, con la lengua rosada al medio, sin tocar arriba

⚠️ LOS DIENTES SON PARTE DEL DISEÑO y tienen que estar en las formas que los llevan.
Son una hilera blanca simple y plana, sin separación entre dientes y sin encías: nunca
una dentadura humana realista.

⚠️ NUNCA LABIOS HUMANOS. La boca es una forma simple y plana recortada sobre la cara
azul, con el interior oscuro y la lengua rosada. Es exactamente la boca del personaje
de las imágenes anteriores, en distintas aperturas.

FORMATO
Imagen horizontal, máxima resolución posible. Fondo blanco liso. Los quince recuadros
del mismo tamaño, bien separados y alineados, con aire suficiente entre uno y otro para
que ninguno se toque. Sin más texto que las letras.

En esta lámina NO aparece el círculo naranja, porque cada recuadro muestra solo la zona
de la boca y no la cabeza entera.
```

---

## 5 · acciones.png — diecinueve poses de uso

```
Hoja de poses de uso del MISMO personaje de las imágenes anteriores, sobre fondo
blanco liso.

DIECINUEVE POSES de cuerpo entero, todas del mismo tamaño, a la misma altura y con la
misma iluminación, ordenadas en una grilla de CINCO COLUMNAS POR CUATRO FILAS: las tres
primeras filas llevan cinco poses y la última lleva cuatro. Debajo de cada una, su
nombre en letra chica, en mayúsculas y en azul oscuro.

FILA 1 — gestos de presentar:
SALUDANDO — una mano en alto saludando, sonrisa amplia
SEÑALANDO — señalando hacia un costado con el brazo extendido y el índice
TE EXPLICO — las dos manos abiertas hacia adelante, gesto de explicar
DESCUBRÍ — un brazo abierto mostrando algo a un costado, mirando hacia allá
ES FÁCIL — encogiéndose de hombros con las palmas hacia arriba

FILA 2 — gestos de reacción:
ENUMERANDO — una mano abierta con la palma hacia arriba, algo separada del cuerpo,
como quien va desplegando opciones una tras otra
VAMOS — un puño en alto, postura enérgica, expresión entusiasmada
PENSANDO — una mano cerca del mentón, mirada hacia arriba
NEGANDO — una mano levantada a la altura del pecho con la PALMA HACIA ADELANTE,
gesto de "no", la cabeza apenas girada, expresión de fastidio contenido. Molesto pero
NO agresivo
AGOBIADO — las DOS MANOS sobre la cabeza, hombros encogidos, expresión de desborde.
Es agobio simpático, nunca angustia ni desesperación

FILA 3 — movimiento y objetos:
CAMINANDO — de perfil, en pleno paso, con una pierna adelante y los brazos en
movimiento natural. Se tiene que leer que está avanzando, no parado de costado
CON LA LLAVE — sosteniendo en alto una llave de puerta simple, con un llavero,
mostrándola hacia la cámara
CON LA LAMPARITA — una lamparita de idea encendida flotando junto a su cabeza, del lado
OPUESTO al círculo naranja para que no compitan, mientras él la señala con el índice
hacia arriba y pone cara de "se me ocurrió algo". La lamparita es un objeto simple y
estilizado, del mismo estilo 3D que el personaje, y NO reemplaza ni tapa al círculo
naranja: los dos se ven, cada uno de su lado
CON EL TELÉFONO — sosteniendo un celular con la pantalla hacia la cámara, vacía
CON VALIJA — tirando de una valija de viaje con ruedas

FILA 4 — con accesorios de viaje:
CON MOCHILA — con una mochila de viaje puesta en la espalda
CON LA NOTEBOOK — sentado, con una notebook abierta apoyada sobre las piernas
CON EL MAPA — sosteniendo un mapa de papel abierto con las dos manos
CON LA CÁMARA — con una cámara de fotos colgada al cuello, sosteniéndola con una mano

⚠️ LOS ACCESORIOS NUNCA TAPAN NI MODIFICAN AL PERSONAJE: no cubren la cara, no ocultan
el logo del buzo y no desplazan el círculo naranja. Son objetos simples y estilizados,
del mismo estilo 3D que el personaje.

EL CÍRCULO NARANJA flotante acompaña a la cabeza en las diecinueve poses, en su posición
habitual. En CAMINANDO, que es de perfil, queda del lado que corresponda al giro, pero
igual está.

⚠️ EL CÍRCULO NARANJA, EN CADA UNA DE LAS FIGURAS. Es lo primero que se pierde en una
lámina con muchas figuras chicas: o desaparece en algunas, o se pega a la cabeza, o
cambia de lado. Tiene que estar en TODAS, siempre FLOTANDO SEPARADO de la cabeza, del
mismo tamaño relativo y en la misma posición respecto de ella. Ninguna figura de la
lámina puede quedar sin él.

⚠️ AIRE ALREDEDOR DE CADA FIGURA. Entre una figura y la siguiente, y entre cada figura y
el borde de la lámina, tiene que quedar espacio libre suficiente para que el círculo
naranja entre completo sin tocar nada. Preferir figuras más chicas y más separadas antes
que apretadas.

EL LOGO DEL BUZO se ve en todas las poses de frente y de tres cuartos. En CAMINANDO,
que es de perfil, se ve parcialmente y eso está bien. Es el símbolo de Hospeda —forma
redondeada tipo gota, azul con franja verde y turquesa abajo y punto naranja arriba— y
DEBAJO DEL SÍMBOLO la palabra hospeda, en minúsculas, en azul oscuro, tipografía
redondeada, centrada y legible. La palabra tiene que estar en todas.

MISMO PERSONAJE que las imágenes anteriores, sin ningún rediseño: misma silueta de
cabeza, mismas proporciones, mismos colores, mismo buzo, mismas zapatillas.

FORMATO
Imagen horizontal, máxima resolución posible. Fondo blanco liso. Las diecinueve poses
bien separadas, sin superponerse. Sin más texto que los nombres debajo de cada una.
```

---

## Cómo verificar cada lámina

**El logo del buzo lleva la palabra `hospeda` debajo del símbolo**, en todas las poses
de frente. En las de espaldas, `hospeda.com.ar` impreso en la espalda.

**El círculo naranja está en TODAS las figuras**, completo, **flotando separado de la
cabeza** y en su posición. Contarlas una por una: quince en expresiones, diecinueve en
acciones. Es el error más frecuente en láminas con muchas figuras chicas — desaparece
en algunas, se pega a la cabeza o cambia de lado. Si una sola figura sale mal, la
lámina no sirve como referencia.

**Las proporciones no se corrieron**: cabeza aproximadamente la mitad de la altura
total, brazos y piernas cortos, zapatillas ligeramente grandes.

**Los dientes de `bocas.png` son una hilera plana**, no una dentadura, y ninguna forma
tiene labios humanos.

**Las cinco expresiones negativas son simpáticas**: cansancio, molestia, desborde,
susto y preocupación, nunca agresión. La sección 5 de la biblia pone `agresivo` en la
lista de lo que el personaje no debe ser.

**Los objetos no tapan el logo del buzo** en las poses que sostienen algo.

**El teléfono de la pose `con el teléfono` tiene el alto 2,17 veces el ancho** y la
pantalla vacía en gris claro. Los prompts de video piden esa proporción, y cuando texto
e imagen se contradicen el modelo le hace caso a la imagen.

## Después de generarlas

Reemplazar los archivos en `../personaje/` y revisar que la tabla de imágenes de
referencia de [`../personaje-hospedin.md`](../personaje-hospedin.md) siga describiendo
lo que cada lámina contiene.
