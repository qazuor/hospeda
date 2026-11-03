# T6 · Hoja de precios

Material de venta · Para todas las verticales. Índice en [`../README.md`](../README.md).

Prompt para **ChatGPT** (el generador de imágenes del custom GPT de Hospeda).

---

- **Para quién:** Quien ya pidió el precio
- **Tipo:** PDF (4 páginas)
- **Formatos:** 2:3 (una imagen por página; el PDF se arma después)
- **Insignia de prueba gratis:** no

**Qué adjuntar:**

- Logo: apps/web/src/assets/images/logo.webp (otra vez antes de cada imagen nueva)
- Los precios vigentes copiados del catálogo de planes y complementos del admin, con la fecha de hoy.

**Cómo se genera:** una página por vez, en el mismo chat. Después de la primera, escribí «siguiente»; antes de cada imagen nueva te va a pedir el logo otra vez.

> **Regla:** es la ÚNICA pieza del kit con precios. Se rehace cada vez que cambia el catálogo; los valores se copian del admin, nunca de memoria.

> **Verificar antes:** que los planes y complementos de cada página sigan existiendo en el catálogo con esos nombres.

````
/herooffer-minimal + /brand-illustration + /anti-slop + /no-ai-slop + /BRANDPALETTE + /shallowdepth + /MINIMALPOSTER + /FEATURECALLOUTS

Diseñá el documento "Hoja de precios" (4 páginas) del material de venta de Hospeda, el portal turístico del Litoral argentino (hospeda.com.ar). Cada página es una imagen vertical 2:3 que después se arma en un PDF. Un vendedor lo manda por WhatsApp o mail a dueños de negocios turísticos que pidieron los precios. Todas las páginas comparten exactamente el mismo diseño.

IMÁGENES ADJUNTAS
- Logo de Hospeda (isotipo: forma azul de río, franja verde y turquesa, círculo naranja de sol, y la palabra "hospeda"). Usalo tal cual: no lo redibujes ni le cambies los colores.
- Los precios vigentes copiados del catálogo de planes y complementos del admin, con la fecha de hoy.

CÓMO VAMOS A TRABAJAR
Generá ahora SOLO la página 1. Después yo te voy a ir diciendo «siguiente» (generás la que sigue) o «página X de 4» (generás esa). Cada página usa exactamente el mismo diseño, márgenes, tipografía, logo, barra de contacto, colores y estilo que la página 1: solo cambia lo que indica su sección más abajo. Cada página lleva su número de página en la barra ("1/4", "2/4"…).
EL LOGO EN CADA IMAGEN: antes de generar cualquier imagen a partir de la segunda (otra página, otra placa, otro formato o una corrección de la misma), pedime que te adjunte de nuevo el logo de Hospeda y esperá a que lo haga. Usá siempre ese archivo original, tal cual, nunca el logo de una imagen anterior: no lo redibujes, no lo deformes ni le cambies proporciones, colores o tipografía.
FICHA DE ESTILO: apenas generes la página 1, escribime debajo una ficha corta con los valores exactos que usaste en cada elemento común (colores, tipografías, tamaños y posiciones). Antes de cada página nueva, releé el SISTEMA VISUAL FIJO y esa ficha, y aplicalos sin cambiar nada. Si notás que una página salió distinta en algún elemento común, decímelo y rehacela.
Antes de generar la página 1, pedime los precios vigentes y la fecha, y esperá. Reemplazá cada [PRECIO …] y cada [FECHA] por el valor que te pase, copiado exactamente. Si te falta un valor, no lo inventes: preguntámelo.

SISTEMA VISUAL FIJO (idéntico en todas las páginas)
- Fondo blanco con una banda superior de 180 px en #EEF8FF donde va el logo.
- Título de cada página en Geologica ExtraBold #0D2B3E, alineado a la izquierda, debajo de la banda.
- Bloques de contenido en tarjetas blancas con borde de 2 px #DFECF8 y esquinas de 24 px de radio.
- Íconos de línea estilo Phosphor, de 56 px, en #2493B6 dentro de círculos #DFECF8.
- Barra de contacto #0D2B3E abajo, con "hospeda.com.ar", el WhatsApp y el número de página.
- Un detalle de onda de río fino, en #3AA7D9 al 30%, arriba a la derecha de la banda.

PÁGINA 1 DE 4: Planes de alojamientos
Imagen: Sin foto. Tres tarjetas de plan en columna, una por plan, cada una con su nombre, su precio mensual, su precio anual y tres líneas de lo que incluye. La del medio con un borde #3AA7D9 un poco más grueso.
No incluyas a Hospedín.
Composición: Título arriba. Las tres tarjetas una debajo de la otra. Abajo, una nota chica con la fecha de vigencia.
Textos (exactamente así, sin agregar ni cambiar palabras):
- Título: "Planes para alojamientos"
- Tarjeta 1: "Básico" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Para un alojamiento"
- Tarjeta 2: "Profesional" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Calendario sincronizado y aparecer destacado"
- Tarjeta 3: "Premium" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Estadísticas avanzadas y el máximo de fotos"
- Nota al pie: "Pagando el año, pagás 10 meses y tenés 12. Precios vigentes desde [FECHA]."
- CTA en la barra de contacto: "Consultá tus dudas al WhatsApp" y, debajo, "hospeda.com.ar"
- En la barra, a la derecha: "3442 47-0650"
- Número de página, en la barra: "1/4"

PÁGINA 2 DE 4: Planes de Comer y salir
Imagen: Igual que la página 1: tres tarjetas de plan en columna.
No incluyas a Hospedín.
Composición: Igual que la página 1.
Textos (exactamente así, sin agregar ni cambiar palabras):
- Título: "Planes para Comer y salir"
- Tarjeta 1: "Para 1 local" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"
- Tarjeta 2: "Hasta 3 locales" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"
- Tarjeta 3: "Hasta 5 locales" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"
- Nota al pie: "Los rubros Gastronomía y Noche no cambian el precio. Precios vigentes desde [FECHA]."
- CTA en la barra de contacto: "Consultá tus dudas al WhatsApp" y, debajo, "hospeda.com.ar"
- En la barra, a la derecha: "3442 47-0650"
- Número de página, en la barra: "2/4"

PÁGINA 3 DE 4: Planes de Experiencias
Imagen: Igual que la página 1: tres tarjetas de plan en columna.
No incluyas a Hospedín.
Composición: Igual que la página 1.
Textos (exactamente así, sin agregar ni cambiar palabras):
- Título: "Planes para Experiencias"
- Tarjeta 1: "Básico" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"
- Tarjeta 2: "Profesional" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Mapa y cómo llegar"
- Tarjeta 3: "Premium" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Galerías de fotos por fecha"
- Nota al pie: "Precios vigentes desde [FECHA]."
- CTA en la barra de contacto: "Consultá tus dudas al WhatsApp" y, debajo, "hospeda.com.ar"
- En la barra, a la derecha: "3442 47-0650"
- Número de página, en la barra: "3/4"

PÁGINA 4 DE 4: Complementos
Imagen: Una tabla limpia de tres columnas: complemento, para qué sirve y precio. Filas separadas por líneas finas #DFECF8.
No incluyas a Hospedín.
Composición: Título arriba. La tabla ocupa el resto de la página.
Textos (exactamente así, sin agregar ni cambiar palabras):
- Título: "Complementos"
- Subtítulo: "Se suman a cualquier plan, sin cambiar de plan."
- Fila: "Destacar 7 días" · "Aparecés destacado una semana" · "[PRECIO] por única vez"
- Fila: "Destacar 30 días" · "Aparecés destacado un mes" · "[PRECIO] por única vez"
- Fila: "20 fotos más (alojamientos)" · "Más fotos en cada alojamiento" · "[PRECIO] por mes"
- Fila: "5 alojamientos más" · "Más alojamientos que tu plan" · "[PRECIO] por mes"
- Fila: "1 local o experiencia más" · "Uno más que tu plan" · "[PRECIO] por mes"
- Nota al pie: "Precios vigentes desde [FECHA]."
- CTA en la barra de contacto: "Sumalos desde tu cuenta o escribinos" y, debajo, "hospeda.com.ar"
- En la barra, a la derecha: "3442 47-0650"
- Número de página, en la barra: "4/4"

MEDIDAS FIJAS (iguales en todas las páginas)
Formato 2:3: lienzo de 1080x1620 px.
- Márgenes de seguridad: 72 px a la izquierda, 72 px a la derecha y 72 px arriba. Ningún texto ni elemento importante por fuera de ellos.
- Logo: arriba a la izquierda, a 72 px del borde superior y a 72 px del izquierdo. Isotipo de 72 px de alto; a su derecha, a 13 px y centrada con el isotipo, la palabra "hospeda" en minúsculas, Geologica Bold de 36 px, color #0D2B3E (blanco sobre fondo oscuro o foto).
- Barra de contacto: todo el ancho (1080 px), 110 px de alto, fondo #0D2B3E sólido sin degradado ni sombra, desde y=1510 hasta y=1620 px. Pegada al borde inferior. Padding de 72 px a la izquierda y 72 px a la derecha. A la izquierda, el CTA en Geologica Bold de 28 px, blanco, en hasta 2 líneas. A la derecha, el ícono de WhatsApp de 40 px (verde #25D366) y, a 10 px, "3442 47-0650" en Geologica Bold de 36 px, blanco. En el extremo derecho de la barra, a 24 px del teléfono, el número de página en Roboto de 24 px, blanco al 70%. Nada de la imagen se superpone con la barra.
- Título: Geologica ExtraBold (800), 64 px, interlineado 1.05, máximo 3 líneas; si no entra, bajalo hasta 48 px, nunca menos.
- Tag line: Caveat Bold, 36 px. Subtítulo: Roboto Medium, 31 px. Cuerpo e ítems: Roboto, 28 px.

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
