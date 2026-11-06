# T11 · Tarjeta con QR

Material de venta · Para todas las verticales. Índice en [`../README.md`](../README.md).

Prompt para **ChatGPT** (el generador de imágenes del custom GPT de Hospeda).

---

- **Para quién:** Visitas en persona
- **Tipo:** Tarjeta imprimible (frente y dorso)
- **Formatos:** 3:2
- **Insignia de prueba gratis:** no

**Qué adjuntar:**

- Logo: apps/web/src/assets/images/logo.webp (otra vez antes de cada imagen nueva)

**Cómo se genera:** una placa por vez, en el mismo chat. Después de la primera, escribí «siguiente»; antes de cada imagen nueva te va a pedir el logo otra vez.

> **Ojo:** ChatGPT no genera un QR que funcione: el cuadrado queda vacío a propósito y el QR real se pega después. Antes de imprimir, cambiá [NOMBRE DEL VENDEDOR].

````
/herooffer-minimal + /brand-illustration + /anti-slop + /no-ai-slop + /BRANDPALETTE + /shallowdepth + /MINIMALPOSTER + /BRANDPALETTE

Diseñá el carrusel "Tarjeta con QR" (2 placas) del material de venta de Hospeda, el portal turístico del Litoral argentino (hospeda.com.ar). Un vendedor lo manda por WhatsApp, Instagram o mail a dueños de negocios que el vendedor visita en persona. Formato: 3:2. Es UNA sola pieza: todas las placas comparten exactamente el mismo diseño.

IMÁGENES ADJUNTAS
- Logo de Hospeda (isotipo: forma azul de río, franja verde y turquesa, círculo naranja de sol, y la palabra "hospeda"). Usalo tal cual: no lo redibujes ni le cambies los colores.

CÓMO VAMOS A TRABAJAR
Generá ahora SOLO la placa 1. Después yo te voy a ir diciendo «siguiente» (generás la que sigue) o «placa X de 2» (generás esa). Cada placa usa exactamente el mismo diseño, márgenes, tipografía, logo, barra de contacto, colores y estilo que la placa 1: solo cambia lo que indica su sección más abajo. Cada placa lleva su indicador ("1/2", "2/2"…).
EL LOGO EN CADA IMAGEN: antes de generar cualquier imagen a partir de la segunda (otra página, otra placa, otro formato o una corrección de la misma), pedime que te adjunte de nuevo el logo de Hospeda y esperá a que lo haga. Usá siempre ese archivo original, tal cual, nunca el logo de una imagen anterior: no lo redibujes, no lo deformes ni le cambies proporciones, colores o tipografía.
FICHA DE ESTILO: apenas generes la placa 1, escribime debajo una ficha corta con los valores exactos que usaste en cada elemento común (colores, tipografías, tamaños y posiciones). Antes de cada placa nueva, releé el SISTEMA VISUAL FIJO y esa ficha, y aplicalos sin cambiar nada. Si notás que una placa salió distinta en algún elemento común, decímelo y rehacela.

SISTEMA VISUAL FIJO (idéntico en todas las placas)
- Tarjeta horizontal 3:2, esquinas rectas (se recorta en la imprenta), con 80 px de margen de seguridad.
- Sin barra de contacto: el contacto va dentro de la tarjeta.
- Un detalle de onda de río fino en #3AA7D9 al 30% en el borde inferior.

PLACA 1 DE 2: Frente
Imagen: Fondo #0D2B3E liso con la onda de río en el borde inferior.
No incluyas a Hospedín.
Composición: El logo grande y centrado, en su versión blanca. Debajo, el lema. Nada más.
Textos (exactamente así, sin agregar ni cambiar palabras):
- Título: "Todo tu viaje, en un solo lugar."
- Indicador de posición, chico, arriba a la derecha: "1/2"

PLACA 2 DE 2: Dorso
Imagen: Fondo blanco. A la derecha, un cuadrado blanco de 520 px con borde punteado gris y la palabra QR en el centro, para pegar el código real después.
No incluyas a Hospedín.
Composición: A la izquierda, de arriba hacia abajo: el logo chico, el nombre del vendedor, su rol, el WhatsApp y el sitio. A la derecha, el cuadrado del QR.
Textos (exactamente así, sin agregar ni cambiar palabras):
- Nombre: "[NOMBRE DEL VENDEDOR]"
- Rol: "Asesor comercial"
- WhatsApp: "3442 47-0650"
- Sitio: "hospeda.com.ar"
- Debajo del QR, chico: "Escaneá y conocé Hospeda"
- Indicador de posición, chico, arriba a la derecha: "2/2"

MEDIDAS FIJAS (iguales en todas las placas)
Formato 3:2: lienzo de 1620x1080 px.
- Márgenes de seguridad: 80 px a la izquierda, 80 px a la derecha y 80 px arriba. Ningún texto ni elemento importante por fuera de ellos.
- Logo: arriba a la izquierda, a 80 px del borde superior y a 80 px del izquierdo. Isotipo de 110 px de alto; a su derecha, a 20 px y centrada con el isotipo, la palabra "hospeda" en minúsculas, Geologica Bold de 56 px, color #0D2B3E (blanco sobre fondo oscuro o foto).
- Título: Geologica ExtraBold (800), 76 px, interlineado 1.05, máximo 3 líneas; si no entra, bajalo hasta 60 px, nunca menos.
- Tag line: Caveat Bold, 44 px. Subtítulo: Roboto Medium, 37 px. Cuerpo e ítems: Roboto, 34 px.

TIPOGRAFÍA
Las de la web de Hospeda: Geologica para títulos, logo, insignia y barra; Caveat solo para la tag line; Roboto para subtítulo, cuerpo e ítems. Si no tenés alguna, usá la sans-serif más parecida. Ninguna otra tipografía manuscrita, serif ni decorativa.

DIRECCIÓN DE ARTE
Priorizá una jerarquía visual muy clara: primero se lee el título, después la insignia o la frase de valor, después los beneficios y por último el contacto.
El logo se ve bien, pero sin competir con el título.
La composición es limpia, aireada y se entiende en 3 segundos.
Separá bien la ilustración o la mascota del texto, para que no compitan.
Fondo atractivo pero simple, con el entorno más suave o desenfocado para que el texto se lea.
Si aparece Hospedín, que esté bien integrado, con una pose amigable y clara, aportando calidez sin tapar ni ensuciar la lectura.
Los beneficios van en bloques o tarjetas claras, con íconos simples de línea, texto corto y muy buena legibilidad en celular.
El pie funciona como CTA claro: el sitio web y el número de WhatsApp se leen rápido y con alto contraste.
Estilo minimalista, profesional, moderno y cálido, con pocos elementos, mucho aire y sin texto extra.
Todo está optimizado para verse en un celular, sobre todo en WhatsApp.

ESTILO
Paleta de Hospeda: azules #0066EF, #2493B6 y #3AA7D9; turquesa #1EA7A1; naranjas #FC8102 y #F5A623; verdes #076C05 y #8CC63F; claros #DFECF8, #FED9AB y #CCE7C3; azul oscuro #0D2B3E para texto y barra. Íconos de línea simples, estilo Phosphor. Luz cálida del Litoral: río, costa, verde. Nada de montañas, nieve, mar ni playas tropicales. Sin montos ni signos de pesos (salvo que esta pieza los pida expresamente en TEXTOS), sin cupones, sin marcas que no estén nombradas acá y sin ningún texto extra.
````
