# Placas — el sistema visual

Los números del sistema de placas. **Este archivo no va al modelo**: cada prompt de
`placas/` ya lleva adentro todo lo que necesita. Esto es para quien produce, y es la
fuente de la que se destilan los prompts nuevos.

El contenido de cada placa sale de [`../../plan-contenido-redes.md`](../../plan-contenido-redes.md).
El personaje, de [`../../personaje-hospedin.md`](../../personaje-hospedin.md).

---

## De dónde salen estos números

Están **medidos sobre `../../custom gpt/ref1.png`**, la placa mejor lograda de la tanda
anterior, no elegidos de la nada. Los horizontales son medición directa. Los verticales
están adaptados de 1:1 a 4:5 y son los que hay que corregir con las pruebas.

---

## Los dos formatos

| Formato | Píxeles | Dónde va |
|---|---|---|
| **4:5** | 1080 × 1350 | Publicaciones de feed. Es el formato por defecto |
| **9:16** | 1080 × 1920 | Historias y estados |

**No hay un tercero.** El 2:3 de 800 × 1200 que el plan usaba para WhatsApp se eliminó:
el 4:5 cumple esa función.

**Si el pedido no dice el formato, se pregunta antes de generar.** Nunca se asume.

### Zona segura del 9:16

Instagram tapa los bordes de una historia con su propia interfaz. Nada que importe
—texto, logo, la cara de Hospedín, el CTA— puede caer ahí:

- **arriba**: los primeros 250 px (13%) los tapan el avatar y la barra de progreso
- **abajo**: los últimos 320 px (16,7%) los tapa la caja de respuesta
- **a los costados**: 60 px (5,5%) de cada lado

Queda una zona útil de **960 × 1350 px**, que es exactamente la misma superficie que la
placa de 4:5. Por eso la adaptación de un formato al otro no es un reencuadre: es
correr el fondo y las manchas orgánicas, y dejar el bloque de contenido quieto.

---

## La grilla

| Qué | Valor | Cómo se obtuvo |
|---|---|---|
| Margen exterior | **5%** (54 px en 1080) | Medido: el logo arranca en 4,1% y el texto en 5,4% |
| Ancho del logo | **29% del ancho** | Medido: símbolo 4,1%→12,3%, palabra 14,4%→33,1% |
| Columna de texto | **50% del ancho** | La foto ocupa la otra mitad |
| Barra de pie | **4,5% de alto** | Medido en ref1 |

---

## La estructura canónica

De arriba hacia abajo. Todas las placas de las refs comparten esto, y es lo que hay que
sostener:

1. **Logo** arriba a la izquierda, 29% del ancho
2. **Tag line** opcional, en pastilla azul con icono, arriba del título
3. **Título** grande, alineado a la izquierda, 2 o 3 líneas, con **una sola palabra en
   azul** para que se despegue
4. **Subtítulo** en azul o turquesa, la mitad del cuerpo del título
5. **Cuerpo**, dos renglones como máximo (regla 6 del plan)
6. **Foto o captura** a la derecha, dentro de una mancha orgánica que muerde el centro
7. **Fila de 3 o 4 iconos** en círculo celeste, con etiqueta en negrita y sub-etiqueta
   en regular
8. **CTA** en pastilla azul con flecha en círculo
9. **Barra de pie** con el globo y `hospeda.com.ar`

No van las nueve en cada placa. Van en ese orden las que vayan.

---

## Tipografías

| Rol | Tipografía | Tamaño en 1080 px de ancho |
|---|---|---|
| Título | **Geologica** Bold | 96 a 130 px |
| Subtítulo | **Geologica** SemiBold | 46 a 56 px |
| Tag line manuscrito | **Caveat** | 64 a 84 px |
| Cuerpo | **Roboto** Regular | 34 a 40 px |
| Etiqueta de icono | **Roboto** Bold | 28 px |
| Sub-etiqueta de icono | **Roboto** Regular | 24 px |
| CTA | **Geologica** SemiBold | 40 px |
| Barra de pie | **Roboto** Regular | 28 px |

**Nada baja de 24 px.** Si el texto no entra, se recorta el texto — no se achica la
letra. Es la regla 6 del plan y es la que más se rompe sola.

El manuscrito (Caveat) va **solo** en frases emocionales cortas, en azul, con subrayado
verde a mano alzada. Nunca en el cuerpo, nunca en el CTA, nunca en una URL.

---

## Paleta

La única válida es la de [`../../plan-contenido-redes.md`](../../plan-contenido-redes.md).

| Rol | Hex |
|---|---|
| Fondo | `#FFFFFF` |
| Fondo alternativo y manchas | `#DFECF8` |
| Texto principal | `#0D2B3E` |
| Palabra destacada del título, CTA | `#0066EF` |
| Azul del personaje y de acentos | `#3AA7D9` |
| Azul secundario | `#2493B6` |
| Verde lima | `#8CC63F` |
| Verde oscuro | `#076C05` |
| Turquesa | `#1EA7A1` |
| Naranja | `#F5A623` |
| Naranja secundario | `#FC8102` |
| Durazno | `#FED9AB` |
| Verde claro | `#CCE7C3` |

**Máximo tres colores fuertes por placa**, más el blanco y el celeste de fondo.

Prohibidos: violeta, fucsia, magenta, rojo fuerte, neón, dorado, negro dominante, gris
corporativo, degradados intensos.

---

## Iconos

Iconos de línea de **Phosphor Regular** — <https://phosphoricons.com/> — trazo uniforme,
esquinas redondeadas, sin relleno. Van dentro de círculos `#DFECF8` de 120 px.

Un solo color por icono: `#0066EF`, `#8CC63F`, `#1EA7A1` o `#F5A623`.

Prohibidos: iconos 3D, stickers, multicolores, con sombra dura, infantiles.

---

## Manchas y garabatos

**Manchas orgánicas** (los blobs): formas blandas y asimétricas en `#DFECF8`, `#8CC63F`
o `#1EA7A1`, en las esquinas y como máscara de la foto. Nunca geométricas, nunca con
borde.

**Garabatos**: sol de rayos rectos, dos o tres pájaros en V, olas de tres líneas, flecha
punteada, chispas de énfasis, corazón de línea. Trazo fino, dibujados a mano.

**Máximo cuatro garabatos por placa.** Si compiten con el mensaje, sobran.

---

## Lo que el prompt no puede garantizar

Esto está medido sobre las cinco imágenes generadas hasta ahora, no supuesto:

| Se pidió | Salió |
|---|---|
| 1080 × 1080 | 1254 × 1254, las cuatro veces |
| 1080 × 1920 | 941 × 1672 |
| Un único azul de CTA | `#0068E8`, `#0050E0`, `#1868F0`, `#0058E0` |
| Verde `#8CC63F` | `#B0D058` |
| Un fondo de la paleta | `#023A7D`, que no existe en ninguna paleta |

**Conclusión: el hex escrito en el prompt orienta, no fija.** Por eso:

- **El tamaño se corrige al exportar.** La imagen que sale se recorta y se escala a
  1080 × 1350 o 1080 × 1920 exactos antes de guardarla. No se acepta lo que salga.
- **El logo se adjunta, no se describe.** El archivo va adjunto en el mismo mensaje que
  el prompt, y el prompt manda copiarlo exacto. Es la única forma de que salga bien: un
  logo descrito con palabras el modelo lo reinventa siempre. Si igual sale distinto —otra
  tipografía, otro color, otra separación, otra ortografía— **se regenera, no se corrige
  a mano**.
- **Para la 1.1 y cualquier placa con foto a sangre**, hay que adjuntar la versión del
  logo que contraste con el fondo. Si el fondo es oscuro y se adjunta el logo oscuro, el
  modelo va a inventar una versión clara — y ahí ya dejó de ser el logo.

Si después de varias rondas el color sigue drifteando más de lo tolerable, la salida es
la plantilla maestra: se aprueba una placa, y se adjunta como referencia en todas las
siguientes — el mismo rol que cumple `escena25.png` en los videos.

---

## Cómo se escribe un prompt: descripción, nunca especificación

Los números de este archivo son para quien produce. **Adentro del prompt no van.**

Un prompt que dice `1080 x 1350 px`, `29% del ancho`, `55% izquierdo` y una lista
numerada del 1 al 8 no se lee como la descripción de una imagen: se lee como una orden de
construcción. Con eso el GPT deja de dibujar y empieza a **fabricar un archivo** — genera,
y al terminar reemplaza la imagen por un path a un PNG. Pasó con las tres primeras
versiones, y sigue pasando con Code Interpreter apagado.

Las reglas viejas del custom GPT, las que producían las refs, nunca fueron así. Describen
cualidades y elementos: *"clean, light, modern and rounded"*, *"leave enough breathing
room"*, *"big headline on left, large photo on right, organic mask, blue CTA pill"*. Es el
mismo layout de `ref1`, contado como quien describe una foto.

Reglas para escribir un prompt nuevo:

| Va | No va |
|---|---|
| "vertical 4:5, de 1080 por 1350 píxeles" | `FORMATO: 1080 x 1350 px` |
| "arriba a la izquierda" | `arranca al 5% del ancho` |
| "ocupando casi la mitad de la placa" | `45% derecho` |
| Párrafos que describen lo que se ve | Listas numeradas de armado |
| Los hex de la paleta | Un hex por cada elemento |
| El texto exacto, entre comillas | — |

### El tamaño sí se pide, pero como frase

Corregido después de medirlo. Lo que rompe no es nombrar el tamaño: son las listas
numeradas y las posiciones en porcentaje. La medida, dicha al pasar dentro de una
oración, ayuda y no empuja hacia el archivo.

| Qué decía el prompt | Ratio que salió | Desvío de 4:5 |
|---|---|---|
| `square 1080x1080` (reglas viejas) | 1,000 | 25,0% |
| `FORMATO: 1080 x 1350 px` (spec) | 0,758 | 5,2% |
| sólo "vertical 4:5" | 0,640 | **20,0%** |

Sacar la medida del todo **empeoró el ratio cuatro veces**. Por eso vuelve, redactada.

**Igual no se llega solo: el recorte final es obligatorio.** Y ojo con recortar tarde —
llevar un 1003 x 1568 a 4:5 exige cortar 315 px de alto, y un recorte centrado se lleva
puestos el logo arriba y la barra de pie abajo. Cuanto más cerca salga del 0,800, menos
destructivo es el ajuste.

---

## Qué revisar antes de aprobar

1. ¿El formato es 4:5 o 9:16, y el pedido decía cuál?
2. ¿El logo es idéntico al archivo adjunto — forma, color, tipografía, separación y
   ortografía? Cualquier diferencia es un logo inventado y se regenera.
3. ¿El texto dice **exactamente** lo que pedía el prompt, sin faltas?
4. ¿Los colores son los de la paleta, o aparecieron inventados?
5. ¿El cuerpo entra en dos renglones, sin achicar la letra?
6. ¿Hay como mucho tres colores fuertes y cuatro garabatos?
7. ¿Nada de precios, ni cantidad de días de prueba, ni cupones? (reglas 1, 9 y 10)
8. ¿La URL dice `hospeda.com.ar`, bien escrita?
9. En 9:16, ¿lo importante entró en la zona segura de 960 × 1350?
10. Si hay captura de la plataforma, ¿se ve como el portal real y no como una app genérica?
