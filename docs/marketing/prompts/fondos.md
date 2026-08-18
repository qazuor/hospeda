# Fondos de escena — prompts

Los treinta lugares donde puede aparecer Hospedín, en `../escenas/escena1.png` a
`escena30.png`. Cada fondo ya viene con **Hospedín integrado**: no es una foto sobre la
que se lo pega después. Eso es lo que hace que se vea plantado en el lugar y no
recortado encima — cuando el personaje y el ambiente se generan en una sola pasada
comparten luz, grano y profundidad de campo.

Al escribir el prompt de un video se elige **un fondo** y **un patrón** (ver
[`../patrones-de-puesta-en-escena.md`](../patrones-de-puesta-en-escena.md)). El fondo
elegido va al prompt como referencia etiquetada y el prompt tiene que decir
explícitamente que es el punto de partida y que no se cambia durante la toma.

**Generar con**: ChatGPT, en la misma conversación, adjuntando `../personaje/personaje.png`,
`poses.png`, `expresiones.png` y `acciones.png`.

**Guardar como**: `../escenas/escenaN.png`.

---

## Los treinta

| # | Qué es | Patrón | Pantalla | Prompt |
|:-:|---|---|---|:-:|
| 1 | Cabaña del Litoral | plano entero de frente | celular en mano | ✅ |
| 2 | Muelle de las islas | plano entero de frente | celular en mano | ✅ |
| 3 | Costa de arena | plano entero de frente | celular en mano | ✅ |
| 4 | Costanera del río | plano entero de frente | celular en mano | ✅ |
| 5 | Palmar | plano entero de frente | celular en mano | ✅ |
| 6 | Complejo termal | plano entero de frente | celular en mano | ✅ |
| 7 | Balneario | plano entero de frente | celular en mano | ✅ |
| 8 | Carnaval | plano entero de frente | celular en mano | ✅ |
| 9 | Cervecería artesanal | plano entero de frente | celular en mano | ✅ |
| 10 | Restaurante | plano entero de frente | celular en mano | ✅ |
| 11 | Autódromo | plano entero de frente | celular en mano | ✅ |
| 12 | Bote de pesca | plano entero de frente | — (caña de pescar) | ✅ |
| 13 | Reposera en la playa | F sentado en la reposera | celular apoyado | ✅ |
| 14 | Mesa de cervecería | G sentado a la mesa | celular apoyado | ✅ |
| 15 | Inserto lateral | B presentador al costado | teléfono flotante | ✅ |
| 16 | Selfie en la costanera | H selfie | selfie | ✅ |
| 17 | Primer plano | I primer plano | — | ✅ |
| 18 | Apoyado en la baranda | J apoyado | celular en mano | ✅ |
| 19 | Sentado en el muelle | K en contacto con el lugar | — | ✅ |
| 20 | Plano general | L plano general | — | ✅ |
| 21 | Inserto lateral en la costanera | B presentador al costado | teléfono flotante | ✅ |
| 22 | Inserto lateral en el balneario | B presentador al costado | teléfono flotante | ✅ |
| 23 | Inserto lateral en el palmar | B presentador al costado | teléfono flotante | ✅ |
| 24 | Reposera en las termas | F sentado en la reposera | celular apoyado | ✅ |
| 25 | Reposera en la galería de la cabaña | F sentado en la reposera | celular apoyado | ✅ |
| 26 | Mesa en el restaurante | G sentado a la mesa | celular apoyado | ✅ |
| 27 | Mesa al aire libre en la costanera | G sentado a la mesa | celular apoyado | ✅ |
| 28 | Selfie en el balneario | H selfie | selfie | ✅ |
| 29 | Selfie en el carnaval | H selfie | selfie | ✅ |
| 30 | Primer plano cálido de interior | I primer plano | — | ✅ |

### Dos cosas que se rompen al animar

**Los carteles con texto.** Los fondos **2, 4, 5, 6, 8 y 9** tienen carteles legibles, y
los modelos de video adoran reescribir texto. Cada uno de esos prompts pide que el
cartel mantenga su texto letra por letra; si igual sale mal, se tapa en edición o se
regenera.

**La gente de fondo.** Los fondos **7, 8, 9, 10, 11, 14, 22, 26, 28 y 29** tienen
personas. Van desenfocadas y casi quietas: si el modelo decide animarlas, se llevan la
atención justo donde el espectador tiene que estar mirando a Hospedín.

---

## La pantalla del teléfono

Todos los fondos que muestran un teléfono comparten una regla que **no se negocia**:
su pantalla es donde se compone después una grabación real, así que tiene que tener la
proporción del teléfono con el que se graba — **el alto es 2,17 veces el ancho**.

El estándar completo está en [`grabaciones.md`](grabaciones.md).

---

## 1 a 12 · Plano entero de frente

Los doce comparten encuadre: Hospedín de cuerpo entero, de frente, sosteniendo un
celular con la pantalla vacía mirando a cámara. Lo único que cambia es el lugar. La
excepción es el 12, que lleva una caña de pescar en vez del celular.

---

## 1 · Cabaña del Litoral — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, en el terreno frente a una cabaña de madera del Litoral, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, la cabaña de madera de una planta con galería y techo a dos aguas, farol en la
pared, plantas en macetas, un sendero de tierra y piedras, y agua entre los árboles al
fondo, todo bien desenfocado.

Cámara a la altura del pecho, plano entero.
Luz cálida de media tarde entrando en diagonal.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 2 · Muelle de las islas — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie sobre un muelle de madera sobre el río, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, el muelle de madera con un bote amarrado al costado, juncos y vegetación, y un
árbol con flores rojas, todo bien desenfocado.

EL CARTEL. En el fondo hay un cartel que dice exactamente «ISLAS DEL LITORAL / ENTRE RÍOS ARGENTINA». Ese texto se
reproduce LETRA POR LETRA, sin cambiar ninguna palabra, sin inventar letras y sin
agregar texto nuevo. Si no puede quedar legible y correcto, mejor que quede desenfocado
y no se lea.

Cámara a la altura del pecho, plano entero.
Luz cálida de media tarde.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 3 · Costa de arena — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie en una playa de arena del río, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, el agua calma del río, una línea de árboles al fondo y cielo azul con nubes.
Sin gente y sin construcciones: es el fondo más despejado de todos.

Cámara a la altura del pecho, plano entero.
Sol alto y luz limpia de mediodía.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 4 · Costanera del río — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie en una costanera del río, sobre una pasarela de madera con baranda, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, las palmeras de la costanera, el río y un muelle al fondo, todo bien
desenfocado.

EL CARTEL. En el fondo hay un cartel que dice exactamente «COSTANERA DEL RÍO / ENTRE RÍOS ARGENTINA». Ese texto se
reproduce LETRA POR LETRA, sin cambiar ninguna palabra, sin inventar letras y sin
agregar texto nuevo. Si no puede quedar legible y correcto, mejor que quede desenfocado
y no se lea.

Cámara a la altura del pecho, plano entero.
Día soleado, luz clara.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 5 · Palmar — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie en un sendero de tierra entre palmeras yatay altas, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, el pastizal, el agua y más palmeras al fondo, con cielo azul y nubes, todo bien
desenfocado.

EL CARTEL. En el fondo hay un cartel que dice exactamente «PALMARES DEL LITORAL». Ese texto se
reproduce LETRA POR LETRA, sin cambiar ninguna palabra, sin inventar letras y sin
agregar texto nuevo. Si no puede quedar legible y correcto, mejor que quede desenfocado
y no se lea.

Cámara a la altura del pecho, plano entero.
Luz de media mañana, cálida y despejada.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 6 · Complejo termal — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie junto a las piletas de un complejo termal, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, las piletas de agua turquesa con vapor, reposeras y sombrillas, un edificio
moderno bajo y palmeras, todo bien desenfocado.

EL CARTEL. En el fondo hay un cartel que dice exactamente «COMPLEJO TERMAL DEL LITORAL / ENTRE RÍOS». Ese texto se
reproduce LETRA POR LETRA, sin cambiar ninguna palabra, sin inventar letras y sin
agregar texto nuevo. Si no puede quedar legible y correcto, mejor que quede desenfocado
y no se lea.

Cámara a la altura del pecho, plano entero.
Luz cálida de media tarde, con el vapor iluminado a contraluz.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 7 · Balneario — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie en un balneario de arena del río, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, la playa ancha, el agua calma, sombrillas de colores y bañistas pequeños a lo
lejos, con árboles al fondo, todo bien desenfocado.

La gente del fondo va LEJOS, CHICA, BIEN DESENFOCADA y prácticamente quieta: no puede
robar atención ni quedar reconocible.

Cámara a la altura del pecho, plano entero.
Sol alto y cielo despejado.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 8 · Carnaval — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie en un corsódromo de carnaval, de noche.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, una carroza iluminada, plumas y trajes de comparsa, bailarinas, papel picado en
el piso y luces de colores, todo bien desenfocado.

La gente del fondo va LEJOS, CHICA, BIEN DESENFOCADA y prácticamente quieta: no puede
robar atención ni quedar reconocible.

EL CARTEL. En el fondo hay un cartel que dice exactamente «CARNAVAL DEL PAÍS». Ese texto se
reproduce LETRA POR LETRA, sin cambiar ninguna palabra, sin inventar letras y sin
agregar texto nuevo. Si no puede quedar legible y correcto, mejor que quede desenfocado
y no se lea.

Cámara a la altura del pecho, plano entero.
Luz nocturna de espectáculo: la cara iluminada por las luces de colores del corso, con
el fondo en penumbra y los puntos de luz desenfocados.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 9 · Cervecería artesanal — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie en el interior cálido de una cervecería artesanal, de noche.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, la pizarra con la carta de tirada, tanques de cobre, un barril y lámparas
colgantes, con gente al fondo, todo bien desenfocado.

La gente del fondo va LEJOS, CHICA, BIEN DESENFOCADA y prácticamente quieta: no puede
robar atención ni quedar reconocible.

EL CARTEL. En el fondo hay un cartel que dice exactamente «CERVEZA ARTESANAL / BUENA COMPAÑÍA MEJORES MOMENTOS». Ese texto se
reproduce LETRA POR LETRA, sin cambiar ninguna palabra, sin inventar letras y sin
agregar texto nuevo. Si no puede quedar legible y correcto, mejor que quede desenfocado
y no se lea.

Cámara a la altura del pecho, plano entero.
Luz cálida de interior, con las lámparas colgantes desenfocadas detrás.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 10 · Restaurante — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie en el interior cálido de un restaurante, al atardecer.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, mesas servidas con platos y copas, comensales al fondo, plantas, lámparas de
papel y paredes en verde oscuro, todo bien desenfocado.

La gente del fondo va LEJOS, CHICA, BIEN DESENFOCADA y prácticamente quieta: no puede
robar atención ni quedar reconocible.

Cámara a la altura del pecho, plano entero.
Luz cálida de interior al atardecer.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 11 · Autódromo — plano entero de frente

```
Hospedín DE PIE Y DE FRENTE A LA CÁMARA, de cuerpo entero, de pie junto al alambrado perimetral de un autódromo, de día.

Sostiene un TELÉFONO CELULAR MODERNO con una mano, en alto a la altura del pecho, con
la PANTALLA MIRANDO DE FRENTE A LA CÁMARA. La pantalla es una superficie GRIS CLARO
LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos, sin
reflejos y sin brillos. Se le compone contenido después. EL TELÉFONO ES MUY ALARGADO:
su alto es 2,17 veces su ancho, la proporción de un teléfono moderno. Está DE FRENTE Y
PLANO respecto de la cámara, sin perspectiva, sin rotación y sin inclinación. Los dedos
NO tapan la pantalla: se ve entera, con sus cuatro esquinas a la vista.

Mira a cámara con expresión alegre y confiada. La otra mano relajada al costado del
cuerpo.

Detrás, la pista con autos de turismo carretera en carrera, las tribunas con público y
una bandera, todo bien desenfocado.

La gente del fondo va LEJOS, CHICA, BIEN DESENFOCADA y prácticamente quieta: no puede
robar atención ni quedar reconocible.

Cámara a la altura del pecho, plano entero.
Día soleado, luz dura de mediodía.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 12 · Bote de pesca — plano entero de frente

```
Hospedín DE PIE sobre una lancha de pesca en el río, de día, de cuerpo entero y girado
ligeramente hacia la cámara.

Sostiene una CAÑA DE PESCAR con una mano, apoyada sobre el hombro, en actitud relajada.
NO sostiene ningún celular: en esta imagen no hay teléfono.

Mira a cámara con expresión alegre y tranquila.

En la lancha se ven un motor fuera de borda y una red a bordo. Detrás, el agua calma del
río y una costa arbolada al fondo, todo bien desenfocado.

La caña NO tapa la cabeza del personaje, ni el círculo naranja, ni el logo del buzo.

Cámara a la altura del pecho, plano entero.
Luz de media mañana, cálida y despejada.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Componer al personaje LIGERAMENTE A LA IZQUIERDA
DEL CENTRO, para que su círculo naranja no caiga en la franja derecha.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición y SEPARADO de la cabeza, mismas proporciones, mismo buzo canguro blanco,
mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 13 · Reposera en la playa — patrón F

```
Hospedín SENTADO en una reposera de playa de madera y lona clara, en una playa de
arena del río, de tarde.

Está recostado hacia atrás, relajado, con las piernas cortas apoyadas y las zapatillas
a la vista. Sostiene un celular en una mano, apoyado sobre la falda, con la pantalla
gris claro plana y sin contenido, orientada hacia la cámara.
EL TELÉFONO ES MUY ALARGADO: su alto es 2,17 veces su ancho, la proporción de un
teléfono moderno. Está DE FRENTE Y PLANO respecto de la cámara, sin perspectiva, sin
rotación y sin inclinación. Los dedos NO tapan la pantalla: se ve entera, con sus
cuatro esquinas a la vista. La otra mano descansa
sobre el apoyabrazos. Mira a cámara con expresión tranquila y contenta.

La reposera está sobre la arena. Al lado hay una sombrilla plegada y un bolso de playa.
Detrás, el agua calma del río, y más atrás una línea de árboles, todo bien desenfocado.

Hospedín y la reposera van CENTRADOS en el cuadro, ocupando aproximadamente la mitad
del alto de la imagen. Sin grandes zonas vacías a un costado.

Cámara a la altura de él, plano medio corto, ligeramente de frente.
Luz de media tarde, cálida y suave, entrando en diagonal. Nada de sol de mediodía.

Las proporciones sentadas siguen siendo las del personaje: cabeza grande, cuerpo
compacto, piernas cortas. Nada de piernas humanas largas ni de postura realista.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y lo que sostenga— tiene que quedar entre los 250 y los 1470 px de
alto y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Ante la duda, componer más chico y más al centro.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 14 · Mesa de cervecería — patrón G

```
Hospedín SENTADO a una mesa de madera en el interior de una cervecería artesanal
cálida, de noche.

Está sentado en un banco o silla, con el torso apoyado hacia adelante y los antebrazos
sobre la mesa, en actitud de conversación. Sobre la mesa hay un vaso de cerveza servido
y un posavasos. Sostiene un celular en una mano, apoyado sobre la mesa, con la pantalla
gris claro plana y sin contenido, orientada hacia la cámara.
EL TELÉFONO ES MUY ALARGADO: su alto es 2,17 veces su ancho, la proporción de un
teléfono moderno. Está DE FRENTE Y PLANO respecto de la cámara, sin perspectiva, sin
rotación y sin inclinación. Los dedos NO tapan la pantalla: se ve entera, con sus
cuatro esquinas a la vista. Mira a cámara con
expresión cálida y cercana.

Detrás suyo, el ambiente de la cervecería: lámparas colgantes de luz cálida, madera,
algún tanque de cobre, y gente lejana y muy desenfocada. Nada de texto legible en el
ambiente: sin carteles, sin pizarras con la carta, sin precios.

Cámara a la altura de la mesa, plano medio, ligeramente de frente.
Luz cálida de interior, suave, sin contrastes duros.

Las proporciones sentadas siguen siendo las del personaje: cabeza grande, cuerpo
compacto, brazos cortos.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y lo que sostenga— tiene que quedar entre los 250 y los 1470 px de
alto y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Ante la duda, componer más chico y más al centro.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 15 · Inserto lateral — patrón B

```
Hospedín DE PIE en el terreno frente a una cabaña de madera del Litoral, de día,
ubicado en el TERCIO IZQUIERDO del cuadro.

Junto a él, hacia la derecha, flotando en el aire a la altura de su cabeza, hay un
TELÉFONO CELULAR MODERNO VISTO COMPLETAMENTE DE FRENTE, con la pantalla encendida pero
VACÍA. El marco es fino, oscuro y de esquinas redondeadas. La pantalla es una superficie
GRIS CLARO LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos,
sin reflejos y sin brillos. Se le compone contenido después.

EL TELÉFONO — ESTO ES LO MÁS IMPORTANTE DE LA IMAGEN:
- Está PERFECTAMENTE DE FRENTE Y PLANO respecto de la cámara: sin perspectiva, sin
  rotación, sin inclinación y sin escorzo. Sus cuatro bordes quedan paralelos a los
  bordes de la imagen. Si aparece aunque sea levemente girado, la imagen NO SIRVE.
- Es MUY ALARGADO: su alto es 2,17 veces su ancho. Es la proporción de un teléfono
  moderno, mucho más estirado que una hoja. NO es un rectángulo ancho, NO es cuadrado y
  NO tiene proporción 9:16.
- ES GRANDE: ocupa DOS QUINTOS del ancho de la imagen (un 40%) y CASI LA MITAD del
  alto, centrado verticalmente. Es el elemento más grande del cuadro después del
  personaje, y lo que se vea en su pantalla tiene que poder leerse. Un teléfono chico
  NO SIRVE: si ocupa menos de un tercio del ancho, la imagen se descarta.
- Su borde derecho NO puede pasar del 80% del ancho de la imagen. Entre ese borde y el
  borde derecho de la imagen tiene que quedar una franja vacía de al menos un QUINTO del
  ancho total: esa franja se tapa después con íconos de interfaz y todo lo que caiga ahí
  se pierde.
- Ante la duda, el teléfono va MÁS A LA IZQUIERDA, no más a la derecha.
- Queda bien recortado contra el fondo, sin transparencias y sin sombras encima.

HOSPEDÍN: de cuerpo entero, MÁS CHICO QUE EL TELÉFONO, ocupando aproximadamente dos
quintos del alto de la imagen y sin pasar del 38% del ancho. El teléfono es el
elemento dominante del cuadro y él lo presenta: si el personaje compite en tamaño, el
teléfono se achica y la imagen no sirve. Está pegado al borde izquierdo, girado un
poco hacia el teléfono. Lo mira y lo señala con la mano más cercana, con la palma abierta, como
quien presenta algo. La otra mano relajada al costado del cuerpo. No sostiene el teléfono con la mano: el teléfono flota solo.

El círculo naranja flotante de su cabeza tiene que quedar bien adentro del cuadro,
lejos del borde derecho.

Los dos —el personaje y el teléfono— tienen que quedar completos dentro de la banda
central de la imagen, sin tocar ni el borde superior, ni el inferior, ni el derecho.

Detrás, la cabaña de madera con galería, pasto y árboles, todo bien desenfocado.
Cámara a la altura del pecho, plano entero.
Luz cálida de media tarde entrando en diagonal.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el rectángulo gris— tiene que quedar entre los 250 y los 1470 px
de alto y por dentro de los 900 px de ancho, dejando además lugar libre para superponer
subtítulos, título, logo y llamado a la acción.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 16 · Selfie en la costanera — patrón H

```
Hospedín GRABÁNDOSE A SÍ MISMO con el celular, en una costanera del río, de día.

Sostiene el celular con el brazo extendido hacia la cámara, con la cámara del teléfono
apuntando hacia él. La imagen ESTÁ TOMADA DESDE ESE TELÉFONO: se le ve el brazo
extendido entrando en cuadro desde abajo, la cabeza y el torso ocupan buena parte del
encuadre, y el cuadro tiene una leve inclinación natural, como una selfie de verdad.

Mira directamente al lente, sonriendo, cerca de la cámara. Expresión entusiasmada y
cercana.

Detrás suyo, la costanera: baranda de madera, palmeras, el río y un muelle a lo lejos,
todo bien desenfocado por la cercanía del sujeto. Sin carteles legibles.

Encuadre de selfie: plano medio corto, cámara ligeramente por encima de su altura y
apuntando un poco hacia abajo, como cuando alguien se filma con el brazo estirado.
Luz natural de día, cálida y pareja.

El círculo naranja flotante tiene que quedar COMPLETO dentro del cuadro, no cortado.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja y las manos— tiene que quedar entre los 250 y los 1470 px de alto y lejos del
borde derecho, dejando además lugar libre para superponer subtítulos, título, logo y
llamado a la acción. Ante la duda, componer más chico y más al centro.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 17 · Primer plano — patrón I

```
PRIMER PLANO de Hospedín: la cabeza y la parte alta de los hombros, mirando a cámara.

ENCUADRE, IMPORTANTE: la cabeza tiene que quedar COMPLETA y con AIRE LIBRE POR ARRIBA.
Entre la parte más alta de la cabeza y el borde superior de la imagen tiene que quedar
un espacio vacío ancho, de al menos un sexto del alto total. La cabeza NO toca el borde
de arriba y NO queda cortada.

La cabeza ocupa aproximadamente la mitad del alto de la imagen, centrada, con el borde
inferior del cuadro a la altura del pecho. Se le ven bien los ojos, las cejas y la boca
— es un plano pensado para que se le lea la expresión y el movimiento de la boca al
hablar. Expresión amigable y atenta.

Se le ve el arranque del buzo canguro blanco en la parte baja del cuadro, con el logo
apenas asomando.

EL CÍRCULO NARANJA FLOTANTE tiene que quedar COMPLETO dentro del cuadro, en su
posición habitual junto a la zona superior de la cabeza, y separado del borde derecho
de la imagen.

Fondo: exterior de día del Litoral, verde y agua, COMPLETAMENTE desenfocado hasta
volverse manchas de color. No tiene que reconocerse ningún lugar concreto.

Cámara a la altura de sus ojos, de frente, con lente que comprima un poco el fondo.
Luz suave y pareja sobre la cara, sin sombras duras.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. La cabeza y el círculo naranja tienen que
quedar entre los 250 y los 1470 px de alto y lejos del borde derecho, dejando además
lugar libre para superponer subtítulos, título, logo y llamado a la acción. Ante la
duda, componer más chico y más al centro.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz y misma profundidad de campo. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismos ojos, mismas cejas, misma boca.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 18 · Apoyado en la baranda — patrón J

```
Hospedín DE PIE Y APOYADO de costado contra la baranda de madera de un muelle sobre el
río, de día.

Tiene un antebrazo apoyado sobre la baranda y el cuerpo ligeramente girado hacia la
cámara, en postura relajada y asimétrica: no está parado firme y de frente. Una pierna
apenas cruzada delante de la otra. Sostiene un celular en la mano libre, a la altura
del pecho, con la pantalla gris claro plana y sin contenido, orientada hacia la cámara.
EL TELÉFONO ES MUY ALARGADO: su alto es 2,17 veces su ancho, la proporción de un
teléfono moderno. Está DE FRENTE Y PLANO respecto de la cámara, sin perspectiva, sin
rotación y sin inclinación. Los dedos NO tapan la pantalla: se ve entera, con sus
cuatro esquinas a la vista.

Mira a cámara con expresión tranquila y confiada.

Detrás, el río, juncos y una línea de árboles, todo bien desenfocado. Sin carteles
legibles.

Cámara a la altura del pecho, plano medio.
Luz cálida de media tarde entrando en diagonal.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja, las manos y el celular— tiene que quedar entre los 250 y los 1470 px de alto
y lejos del borde derecho, dejando además lugar libre para superponer subtítulos,
título, logo y llamado a la acción. Ante la duda, componer más chico y más al centro.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 19 · Sentado en el muelle — patrón K

```
Hospedín SENTADO EN EL BORDE DE UN MUELLE de madera, con las piernas colgando sobre el
agua del río, de tarde.

Está sentado de costado respecto de la cámara pero con el torso girado hacia ella, las
manos apoyadas en las tablas a los costados del cuerpo, y las piernas cortas colgando
hacia el agua sin llegar a tocarla. Postura relajada, de estar disfrutando el lugar.

Mira a cámara con expresión contenta y tranquila. No sostiene celular: en esta imagen no
hay ningún teléfono.

Debajo y detrás, el agua calma del río reflejando el cielo; más atrás, la costa
arbolada, todo desenfocado. Las tablas del muelle nítidas en primer plano.

Hospedín va CENTRADO en el cuadro, ocupando aproximadamente la mitad del alto de la
imagen. Sin grandes zonas vacías a un costado.

Cámara a la altura de él o apenas por debajo, plano entero, ligeramente de costado.
Luz de media tarde, cálida y baja.

Las proporciones sentadas siguen siendo las del personaje: cabeza grande, cuerpo
compacto, piernas cortas y zapatillas ligeramente sobredimensionadas.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante —la cabeza, el círculo
naranja y las manos— tiene que quedar entre los 250 y los 1470 px de alto y lejos del
borde derecho, dejando además lugar libre para superponer subtítulos, título, logo y
llamado a la acción. Ante la duda, componer más chico y más al centro.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en las tablas en la
dirección de la luz, escala coherente con lo que tiene alrededor y un leve rebote del
color del entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 20 · Plano general — patrón L

```
PLANO GENERAL de un palmar del Litoral, con Hospedín pequeño dentro del cuadro pero
CLARAMENTE VISIBLE.

El paisaje ocupa la mayor parte: palmeras yatay altas alineadas, pastizal, un sendero
de tierra que se aleja, y agua a lo lejos entre las palmeras. Cielo amplio con nubes.

HOSPEDÍN, IMPORTANTE:
- Está de pie sobre el sendero, aproximadamente en el CENTRO del cuadro, ni arriba ni
  abajo del todo.
- Su alto es aproximadamente un CUARTO del alto total de la imagen. Es chico frente al
  paisaje, pero se lo distingue sin esfuerzo: la silueta de la cabeza, el círculo
  naranja, el buzo blanco y las zapatillas se reconocen a simple vista.
- Queda LEJOS del borde inferior: por debajo de él tiene que haber una franja ancha de
  sendero y pasto, de al menos un cuarto del alto de la imagen.
- Está de espaldas parciales, mirando hacia el paisaje, con los brazos apenas separados
  del cuerpo.

Todo el cuadro NÍTIDO, no desenfocado: acá el fondo es el protagonista y tiene que
verse.

Cámara a la altura de una persona de pie, algo alejada, plano general.
Luz de media mañana, cálida y despejada.

A esta escala la cara no se lee, y está bien: este fondo no se usa para planos
hablados. La silueta y los colores tienen que ser inconfundibles aunque la cara no se
distinga.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. El personaje entero tiene que quedar entre los
250 y los 1470 px de alto y lejos del borde derecho, dejando además lugar libre para
superponer subtítulos, título, logo y llamado a la acción. Ante la duda, componer más
chico y más al centro.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el sendero en la
dirección de la luz, escala coherente con las palmeras y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 21 · Inserto lateral en la costanera — patrón B

```
Hospedín DE PIE en una costanera del río, de día, sobre una pasarela de madera con
baranda, ubicado en el TERCIO IZQUIERDO del cuadro.

Junto a él, hacia la derecha, flotando en el aire a la altura de su cabeza, hay un
TELÉFONO CELULAR MODERNO VISTO COMPLETAMENTE DE FRENTE, con la pantalla encendida pero
VACÍA. El marco es fino, oscuro y de esquinas redondeadas. La pantalla es una superficie
GRIS CLARO LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos,
sin reflejos y sin brillos. Se le compone contenido después.

EL TELÉFONO — ESTO ES LO MÁS IMPORTANTE DE LA IMAGEN:
- Está PERFECTAMENTE DE FRENTE Y PLANO respecto de la cámara: sin perspectiva, sin
  rotación, sin inclinación y sin escorzo. Sus cuatro bordes quedan paralelos a los
  bordes de la imagen. Si aparece aunque sea levemente girado, la imagen NO SIRVE.
- Es MUY ALARGADO: su alto es 2,17 veces su ancho. Es la proporción de un teléfono
  moderno, mucho más estirado que una hoja. NO es un rectángulo ancho, NO es cuadrado y
  NO tiene proporción 9:16.
- ES GRANDE: ocupa DOS QUINTOS del ancho de la imagen (un 40%) y CASI LA MITAD del
  alto, centrado verticalmente. Es el elemento más grande del cuadro después del
  personaje, y lo que se vea en su pantalla tiene que poder leerse. Un teléfono chico
  NO SIRVE: si ocupa menos de un tercio del ancho, la imagen se descarta.
- Su borde derecho NO puede pasar del 80% del ancho de la imagen. Entre ese borde y el
  borde derecho de la imagen tiene que quedar una franja vacía de al menos un QUINTO del
  ancho total: esa franja se tapa después con íconos de interfaz y todo lo que caiga ahí
  se pierde.
- Ante la duda, el teléfono va MÁS A LA IZQUIERDA, no más a la derecha.
- Queda bien recortado contra el fondo, sin transparencias y sin sombras encima.

HOSPEDÍN: de cuerpo entero, MÁS CHICO QUE EL TELÉFONO, ocupando aproximadamente dos
quintos del alto de la imagen y sin pasar del 38% del ancho. El teléfono es el
elemento dominante del cuadro y él lo presenta: si el personaje compite en tamaño, el
teléfono se achica y la imagen no sirve. Está pegado al borde izquierdo, girado un
poco hacia el teléfono. Lo mira y lo señala con la mano más cercana, con la palma abierta, como
quien presenta algo. La otra mano relajada al costado del cuerpo. No sostiene el teléfono con la mano: el teléfono flota solo.

Los dos —el personaje y el teléfono— tienen que quedar completos dentro de la banda
central de la imagen, sin tocar ni el borde superior, ni el inferior, ni el derecho.

Detrás, la costanera: palmeras, el río y un muelle a lo lejos, todo bien desenfocado.
Sin carteles legibles.
Cámara a la altura del pecho, plano entero.
Luz de media mañana, cálida y despejada.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 22 · Inserto lateral en el balneario — patrón B

```
Hospedín DE PIE sobre la arena de un balneario del río, de día, ubicado en el TERCIO
IZQUIERDO del cuadro.

Junto a él, hacia la derecha, flotando en el aire a la altura de su cabeza, hay un
TELÉFONO CELULAR MODERNO VISTO COMPLETAMENTE DE FRENTE, con la pantalla encendida pero
VACÍA. El marco es fino, oscuro y de esquinas redondeadas. La pantalla es una superficie
GRIS CLARO LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos,
sin reflejos y sin brillos. Se le compone contenido después.

EL TELÉFONO — ESTO ES LO MÁS IMPORTANTE DE LA IMAGEN:
- Está PERFECTAMENTE DE FRENTE Y PLANO respecto de la cámara: sin perspectiva, sin
  rotación, sin inclinación y sin escorzo. Sus cuatro bordes quedan paralelos a los
  bordes de la imagen. Si aparece aunque sea levemente girado, la imagen NO SIRVE.
- Es MUY ALARGADO: su alto es 2,17 veces su ancho. Es la proporción de un teléfono
  moderno, mucho más estirado que una hoja. NO es un rectángulo ancho, NO es cuadrado y
  NO tiene proporción 9:16.
- ES GRANDE: ocupa DOS QUINTOS del ancho de la imagen (un 40%) y CASI LA MITAD del
  alto, centrado verticalmente. Es el elemento más grande del cuadro después del
  personaje, y lo que se vea en su pantalla tiene que poder leerse. Un teléfono chico
  NO SIRVE: si ocupa menos de un tercio del ancho, la imagen se descarta.
- Su borde derecho NO puede pasar del 80% del ancho de la imagen. Entre ese borde y el
  borde derecho de la imagen tiene que quedar una franja vacía de al menos un QUINTO del
  ancho total: esa franja se tapa después con íconos de interfaz y todo lo que caiga ahí
  se pierde.
- Ante la duda, el teléfono va MÁS A LA IZQUIERDA, no más a la derecha.
- Queda bien recortado contra el fondo, sin transparencias y sin sombras encima.

HOSPEDÍN: de cuerpo entero, MÁS CHICO QUE EL TELÉFONO, ocupando aproximadamente dos
quintos del alto de la imagen y sin pasar del 38% del ancho. El teléfono es el
elemento dominante del cuadro y él lo presenta: si el personaje compite en tamaño, el
teléfono se achica y la imagen no sirve. Está pegado al borde izquierdo, girado un
poco hacia el teléfono. Lo mira y lo señala con la mano más cercana, con la palma abierta, como
quien presenta algo. La otra mano relajada al costado del cuerpo. No sostiene el teléfono con la mano: el teléfono flota solo.

Los dos —el personaje y el teléfono— tienen que quedar completos dentro de la banda
central de la imagen, sin tocar ni el borde superior, ni el inferior, ni el derecho.

Detrás, la playa: agua calma, sombrillas de colores y árboles, todo bien desenfocado.
Si hay bañistas, van muy lejos, chicos y desenfocados.
Cámara a la altura del pecho, plano entero.
Luz de sol alto, cálida y clara, con el cielo despejado.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 23 · Inserto lateral en el palmar — patrón B

```
Hospedín DE PIE sobre un sendero de tierra en un palmar de yatays, de día, ubicado en
el TERCIO IZQUIERDO del cuadro.

Junto a él, hacia la derecha, flotando en el aire a la altura de su cabeza, hay un
TELÉFONO CELULAR MODERNO VISTO COMPLETAMENTE DE FRENTE, con la pantalla encendida pero
VACÍA. El marco es fino, oscuro y de esquinas redondeadas. La pantalla es una superficie
GRIS CLARO LISA Y COMPLETAMENTE VACÍA: sin texto, sin íconos, sin interfaz, sin fotos,
sin reflejos y sin brillos. Se le compone contenido después.

EL TELÉFONO — ESTO ES LO MÁS IMPORTANTE DE LA IMAGEN:
- Está PERFECTAMENTE DE FRENTE Y PLANO respecto de la cámara: sin perspectiva, sin
  rotación, sin inclinación y sin escorzo. Sus cuatro bordes quedan paralelos a los
  bordes de la imagen. Si aparece aunque sea levemente girado, la imagen NO SIRVE.
- Es MUY ALARGADO: su alto es 2,17 veces su ancho. Es la proporción de un teléfono
  moderno, mucho más estirado que una hoja. NO es un rectángulo ancho, NO es cuadrado y
  NO tiene proporción 9:16.
- ES GRANDE: ocupa DOS QUINTOS del ancho de la imagen (un 40%) y CASI LA MITAD del
  alto, centrado verticalmente. Es el elemento más grande del cuadro después del
  personaje, y lo que se vea en su pantalla tiene que poder leerse. Un teléfono chico
  NO SIRVE: si ocupa menos de un tercio del ancho, la imagen se descarta.
- Su borde derecho NO puede pasar del 80% del ancho de la imagen. Entre ese borde y el
  borde derecho de la imagen tiene que quedar una franja vacía de al menos un QUINTO del
  ancho total: esa franja se tapa después con íconos de interfaz y todo lo que caiga ahí
  se pierde.
- Ante la duda, el teléfono va MÁS A LA IZQUIERDA, no más a la derecha.
- Queda bien recortado contra el fondo, sin transparencias y sin sombras encima.

HOSPEDÍN: de cuerpo entero, MÁS CHICO QUE EL TELÉFONO, ocupando aproximadamente dos
quintos del alto de la imagen y sin pasar del 38% del ancho. El teléfono es el
elemento dominante del cuadro y él lo presenta: si el personaje compite en tamaño, el
teléfono se achica y la imagen no sirve. Está pegado al borde izquierdo, girado un
poco hacia el teléfono. Lo mira y lo señala con la mano más cercana, con la palma abierta, como
quien presenta algo. La otra mano relajada al costado del cuerpo. No sostiene el teléfono con la mano: el teléfono flota solo.

Los dos —el personaje y el teléfono— tienen que quedar completos dentro de la banda
central de la imagen, sin tocar ni el borde superior, ni el inferior, ni el derecho.

Detrás, el palmar: palmeras yatay altas, pastizal y agua a lo lejos, todo bien
desenfocado. Sin carteles legibles.
Cámara a la altura del pecho, plano entero.
Luz de media tarde, cálida, entrando en diagonal.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 24 · Reposera en las termas — patrón F

```
Hospedín SENTADO en una reposera de madera y lona clara, junto al borde de una pileta
de aguas termales, de día.

Está recostado hacia atrás, relajado, con las piernas cortas apoyadas y las zapatillas
a la vista. Sostiene un celular en una mano, apoyado sobre la falda, con la pantalla
gris claro plana y sin contenido, orientada hacia la cámara.
EL TELÉFONO ES MUY ALARGADO: su alto es 2,17 veces su ancho, la proporción de un
teléfono moderno. Está DE FRENTE Y PLANO respecto de la cámara, sin perspectiva, sin
rotación y sin inclinación. Los dedos NO tapan la pantalla: se ve entera, con sus
cuatro esquinas a la vista. La otra mano descansa
sobre el apoyabrazos. Mira a cámara con expresión tranquila y contenta.

Detrás, el agua turquesa de la pileta termal con vapor suave, sombrillas y palmeras,
todo bien desenfocado. Sin carteles legibles.

Cámara a la altura de él, plano medio corto, ligeramente de frente.
Luz de media mañana, cálida y suave.

Las proporciones sentadas siguen siendo las del personaje: cabeza grande, cuerpo
compacto, brazos y piernas cortos. Nada de piernas humanas largas ni de postura
realista.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 25 · Reposera en la galería de la cabaña — patrón F

```
Hospedín SENTADO en una silla baja de madera con almohadones, en la galería de una
cabaña de madera del Litoral, de tarde.

Está recostado hacia atrás, relajado, con las piernas cortas apoyadas y las zapatillas
a la vista. Sostiene un celular en una mano, apoyado sobre la falda, con la pantalla
gris claro plana y sin contenido, orientada hacia la cámara.
EL TELÉFONO ES MUY ALARGADO: su alto es 2,17 veces su ancho, la proporción de un
teléfono moderno. Está DE FRENTE Y PLANO respecto de la cámara, sin perspectiva, sin
rotación y sin inclinación. Los dedos NO tapan la pantalla: se ve entera, con sus
cuatro esquinas a la vista. La otra mano descansa
sobre el apoyabrazos. Mira a cámara con expresión tranquila y contenta.

Detrás, la galería de madera con baranda, plantas en macetas y el verde del terreno,
todo bien desenfocado.

Cámara a la altura de él, plano medio corto, ligeramente de frente.
Luz de media tarde, cálida y baja, entrando en diagonal.

Las proporciones sentadas siguen siendo las del personaje: cabeza grande, cuerpo
compacto, brazos y piernas cortos. Nada de piernas humanas largas ni de postura
realista.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 26 · Mesa en el restaurante — patrón G

```
Hospedín SENTADO a una mesa servida en el interior de un restaurante cálido, de noche.

Está sentado con el torso apoyado hacia adelante y los antebrazos sobre la mesa, en
actitud de conversación. Sobre la mesa hay un plato servido, una copa y una vela.
Sostiene un celular en una mano, apoyado sobre la mesa, con la pantalla gris claro
plana y sin contenido, orientada hacia la cámara.
EL TELÉFONO ES MUY ALARGADO: su alto es 2,17 veces su ancho, la proporción de un
teléfono moderno. Está DE FRENTE Y PLANO respecto de la cámara, sin perspectiva, sin
rotación y sin inclinación. Los dedos NO tapan la pantalla: se ve entera, con sus
cuatro esquinas a la vista. Mira a cámara con expresión cálida y
cercana.

Detrás, el ambiente del restaurante: lámparas de luz cálida, plantas, paredes en verde
oscuro y comensales lejanos muy desenfocados. Nada de texto legible: sin carteles, sin
pizarras y sin cartas a la vista.

Cámara a la altura de la mesa, plano medio, ligeramente de frente.
Luz cálida de interior, suave, sin contrastes duros.

Las proporciones sentadas siguen siendo las del personaje: cabeza grande, cuerpo
compacto, brazos y piernas cortos. Nada de piernas humanas largas ni de postura
realista.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 27 · Mesa al aire libre en la costanera — patrón G

```
Hospedín SENTADO a una mesa de café al aire libre, sobre la vereda de una costanera
del río, de tarde.

Está sentado con el torso apoyado hacia adelante y los antebrazos sobre la mesa, en
actitud de conversación. Sobre la mesa hay una taza de café y un vaso de agua. Sostiene
un celular en una mano, apoyado sobre la mesa, con la pantalla gris claro plana y sin
contenido, orientada hacia la cámara.
EL TELÉFONO ES MUY ALARGADO: su alto es 2,17 veces su ancho, la proporción de un
teléfono moderno. Está DE FRENTE Y PLANO respecto de la cámara, sin perspectiva, sin
rotación y sin inclinación. Los dedos NO tapan la pantalla: se ve entera, con sus
cuatro esquinas a la vista. Mira a cámara con expresión cálida y cercana.

Detrás, la costanera: palmeras, la baranda de madera y el río, todo bien desenfocado.
Sin carteles legibles.

Cámara a la altura de la mesa, plano medio, ligeramente de frente.
Luz de media tarde, cálida y baja.

Las proporciones sentadas siguen siendo las del personaje: cabeza grande, cuerpo
compacto, brazos y piernas cortos. Nada de piernas humanas largas ni de postura
realista.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 28 · Selfie en el balneario — patrón H

```
Hospedín GRABÁNDOSE A SÍ MISMO con el celular, en un balneario de arena del río, de
día.

Sostiene el celular con el brazo extendido hacia la cámara, con la cámara del teléfono
apuntando hacia él. La imagen ESTÁ TOMADA DESDE ESE TELÉFONO: se le ve el brazo
extendido entrando en cuadro desde abajo, la cabeza y el torso ocupan buena parte del
encuadre, y el cuadro tiene una leve inclinación natural, como una selfie de verdad.

Mira directamente al lente, sonriendo, cerca de la cámara. Expresión entusiasmada.

Detrás, la playa: arena, agua calma, sombrillas de colores y árboles, todo bien
desenfocado por la cercanía del sujeto. Si hay bañistas, van muy lejos y desenfocados.

Encuadre de selfie: plano medio corto, cámara ligeramente por encima de su altura y
apuntando un poco hacia abajo.
Luz de sol alto, cálida y pareja.

El círculo naranja flotante tiene que quedar COMPLETO dentro del cuadro, no cortado.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 29 · Selfie en el carnaval — patrón H

```
Hospedín GRABÁNDOSE A SÍ MISMO con el celular, en un corsódromo de carnaval, de noche.

Sostiene el celular con el brazo extendido hacia la cámara, con la cámara del teléfono
apuntando hacia él. La imagen ESTÁ TOMADA DESDE ESE TELÉFONO: se le ve el brazo
extendido entrando en cuadro desde abajo, la cabeza y el torso ocupan buena parte del
encuadre, y el cuadro tiene una leve inclinación natural, como una selfie de verdad.

Mira directamente al lente, sonriendo, cerca de la cámara. Expresión entusiasmada.

Detrás, el carnaval de noche: luces de colores, una carroza iluminada y plumas de
comparsa, todo MUY desenfocado y convertido en manchas de luz por la cercanía del
sujeto. Sin carteles legibles y sin caras reconocibles.

Encuadre de selfie: plano medio corto, cámara ligeramente por encima de su altura y
apuntando un poco hacia abajo.
Luz nocturna de espectáculo: la cara iluminada por la pantalla del celular y por las
luces de colores del fondo, sin que le cambien los colores propios del personaje.

El círculo naranja flotante tiene que quedar COMPLETO dentro del cuadro, no cortado.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## 30 · Primer plano cálido de interior — patrón I

```
PRIMER PLANO de Hospedín: la cabeza y la parte alta de los hombros, mirando a cámara,
en un interior cálido de noche.

ENCUADRE, IMPORTANTE: la cabeza tiene que quedar COMPLETA y con AIRE LIBRE POR ARRIBA.
Entre la parte más alta de la cabeza y el borde superior de la imagen tiene que quedar
un espacio vacío ancho, de al menos un sexto del alto total. La cabeza NO toca el borde
de arriba y NO queda cortada.

La cabeza ocupa aproximadamente la mitad del alto de la imagen, con el borde inferior
del cuadro a la altura del pecho. Se le ven bien los ojos, las cejas y la boca — es un
plano pensado para que se le lea la expresión y el movimiento de la boca al hablar.
Expresión amigable y atenta.

Se le ve el arranque del buzo canguro blanco en la parte baja del cuadro.

EL CÍRCULO NARANJA FLOTANTE tiene que quedar COMPLETO dentro del cuadro, en su
posición habitual, y separado del borde derecho de la imagen.

Fondo: interior cálido de noche, con luces anaranjadas y madera, COMPLETAMENTE
desenfocado hasta volverse manchas de color. No tiene que reconocerse ningún lugar
concreto. Es la contraparte nocturna del fondo 17, que es de día y en exterior.

Cámara a la altura de sus ojos, de frente.
Luz cálida y suave sobre la cara, sin sombras duras.

FORMATO Y CALIDAD

Imagen vertical en formato 9:16, a la máxima resolución posible: se va a animar
después y tiene que aguantar acercamientos.

ZONAS SEGURAS. La imagen se publica en Instagram y TikTok, que dibujan su interfaz
encima. Sobre un cuadro de 1080 x 1920 quedan tapados los 250 px de arriba, los 420 px
de abajo y los 180 px del borde derecho. Todo lo importante tiene que quedar entre los
250 y los 1470 px de alto y por dentro de los 900 px de ancho, dejando además lugar
libre para superponer subtítulos, título, logo y llamado a la acción.

⚠️ EL CÍRCULO NARANJA. Va a la derecha de la cabeza, así que si el personaje queda
centrado en el cuadro el círculo se corre a la franja que se tapa. Para evitarlo,
componer al personaje LIGERAMENTE A LA IZQUIERDA DEL CENTRO, de manera que su círculo
naranja quede cerca del eje vertical de la imagen y bien lejos del borde derecho.

Sin personas reconocibles. Si hay gente, va lejos, chica y bien desenfocada.

INTEGRACIÓN: el personaje y el ambiente se generan JUNTOS, en una sola pieza. Misma
luz, misma profundidad de campo, sombra de contacto propia en el piso en la dirección
de la luz, escala coherente con lo que tiene alrededor y un leve rebote del color del
entorno sobre su superficie. No pegar el personaje encima de una foto.

Hospedín sigue siendo un personaje animado 3D con el mismo render de las referencias.
No convertirlo en una criatura fotorrealista aunque el lugar sea creíble.

No rediseñar al personaje: misma silueta de cabeza, mismo círculo naranja flotante en
su posición, mismas proporciones, mismo buzo canguro blanco, mismas zapatillas.

EL LOGO DEL BUZO. Al frente del buzo va el símbolo de Hospeda —la forma redondeada
azul, verde y turquesa con el punto naranja— y DEBAJO DEL SÍMBOLO la palabra hospeda,
en minúsculas, en azul oscuro, con tipografía redondeada y limpia, centrada respecto
del símbolo y claramente legible. El símbolo arriba y la palabra abajo, como una sola
pieza. La palabra tiene que estar: no la omitas y no la reemplaces por otro texto. Se
escribe hospeda, sin mayúsculas, sin acento y sin la extensión del dominio.
```

---

## Cómo verificar cada uno

**El logo lleva la palabra `hospeda` debajo del símbolo**, en minúsculas y legible. Es
lo que más se pierde entre generaciones.

**El teléfono está de frente y plano**, sin perspectiva ni rotación, y con el alto 2,17
veces el ancho. Si sale girado, componer la grabación encima deja de ser un pegado
directo y pasa a ser corner-pin cuadro por cuadro: es el motivo número uno para
descartar una imagen.

**La pantalla está completamente vacía**, gris claro liso, sin reflejos ni brillos.

**El círculo naranja está, completo, separado de la cabeza y LEJOS DEL BORDE DERECHO.**
Va a la derecha de la cabeza por diseño, así que si el personaje queda centrado, el
círculo se corre justo a la franja que tapa la columna de íconos. La corrección es
correr al personaje a la izquierda del centro y pedirle que ocupe menos alto.

**Nada importante cae en las zonas tapadas.** Los 250 px de arriba, los 420 de abajo y
los 180 de la derecha se los come la interfaz de la app.

**Las proporciones aguantan la pose.** En los sentados el riesgo es que le estire las
piernas para que la postura funcione. Cabeza grande, piernas cortas, siempre.
