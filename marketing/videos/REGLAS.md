# Reglas para los videos tutoriales de Hospeda (motion graphics)

Lo que se fue decidiendo al armar los videos. Es la base del prompt para los próximos:
cada corrección del dueño se agrega acá, con el porqué.

Fuente de verdad del personaje: `marketing/personaje-hospedin.md`.
Grabaciones: `marketing/prompts/grabaciones.md`.

Rutas: las de código son relativas a `marketing/videos/`. Lo generado (tomas, poses, audio, renders)
vive FUERA del repo, bajo `$HOSPEDA_MARKETING_ASSETS_DIR/video-lab/` (ver `README.md`); acá se lo
nombra como `<public>/…`.

## Historial de correcciones del dueño

| Versión | Lo que dijo | Qué cambió |
|---|---|---|
| v1→v2 | «Hay un movimiento rápido y molesto del celular antes de cada acción» | Cámara con ease senoidal, movimientos dimensionados por distancia, sin bombeo; scroll suave en la grabación |
| v2→v3 | «Sigue sin verse profesional, como de estudio con 20 años» | Todo lo de la sección *Nivel estudio* de abajo |
| 31/10/2026 | «Todo lo que se ve en modo celular es un Galaxy S24 Ultra» | Antes se grababa a 390 × 844 con marco de iPhone (isla de cámara, hora «9:41»). Ahora todo sale del dispositivo de referencia de abajo |

## Formato

- Vertical 9:16, 1080×1920, 30 fps, H.264 + AAC 192k. Destino principal: WhatsApp.
- Audio normalizado a **-14 LUFS**, true peak -1,5 dB (`ffmpeg loudnorm` sobre el render).
- A1 v3: 28,7 s, ~10 MB. WhatsApp recomprime los videos; mandarlo como documento llega intacto.

## Dispositivo de referencia: Samsung Galaxy S24 Ultra

Todo lo que se muestra en modo celular representa la pantalla de un **Galaxy S24 Ultra con la
configuración de fábrica** (resolución FHD+, zoom por defecto, Chrome). Medido por el dueño en
el teléfono real el 31/10/2026 (whatismyviewport.com):

| Medida | Valor |
|---|---|
| Pantalla, en píxeles CSS | **412 × 892** |
| Área visible de la página en Chrome | **411 × 750** (las barras de Android y Chrome ocupan 142 px) |
| DPR | 2,63 → **1080 × 2340** físicos |
| Proporción | **19,5:9** (0,4615 ancho/alto) |

- **Se graba el área visible real: viewport de 412 × 750.** Cada toma muestra exactamente lo que
  ve un usuario, con el mismo corte arriba y abajo. Se usa 412 de ancho (el ancho de pantalla);
  el 411 medido es redondeo de Chrome.
- **DPR 3 al grabar**, no 2,63: la sobremuestra deja margen para los zooms sin pixelar.
- **Las barras se dibujan en la edición**: barra de estado de Android arriba, barra de direcciones
  de Chrome y barra de navegación, hasta completar los 892. Son un componente, mínimas y siempre
  iguales; en los momentos de foco el zoom puede dejarlas fuera de cuadro.
- **La pantalla editada (capa 2) se exporta a 1080 × 2340**, la resolución real del teléfono. La
  pantalla dentro del marco (capa 3) respeta la misma proporción 19,5:9; el marco del teléfono
  tiene que ser el de un S24 Ultra: marco plano de titanio, esquinas casi rectas, cámara
  perforada centrada arriba y barra de estado de Android. Nada de muesca ni barra de estado
  de otro sistema.
- Coincide con la referencia de [`prompts/grabaciones.md`](../prompts/grabaciones.md), que ya
  fijaba 1080 × 2340 para las grabaciones hechas con el teléfono.

- **En código** las medidas viven en `config/device.ts` (`REFERENCE_DEVICE`): el grabador, el
  probe y la composición A1 las leen de ahí. Las barras se reparten 38 (estado) + 56 (Chrome)
  - 48 (navegación); sólo el total de 142 está medido, el reparto es el default de Android.
- **En un prompt de imagen o video** se describe la forma, nunca la marca (el modelo imprimiría
  logos). Frase canónica, en el idioma del prompt:
  - *«Es un teléfono Android de gama alta: marco plano de titanio, esquinas casi rectas apenas
    redondeadas, bordes de pantalla finos y parejos, y una sola cámara frontal en un orificio
    circular diminuto, centrado arriba dentro de la pantalla. Sin muesca, sin logos y sin
    ninguna marca visible.»* + la proporción de pantalla 19,5:9 (alto 2,17 veces el ancho).
  - *«It is a modern Android flagship with a 19.5:9 screen: flat titanium frame, nearly square
    corners, thin even bezels and a single tiny round punch-hole camera centred at the top of
    the screen. No logos or brand names on it.»*
- **Guard**: `scripts/check-marketing-device.ts` (`pnpm check:marketing-device`, corre en CI)
  falla si `marketing/` nombra otro teléfono o medidas de otro teléfono.

> ⚠️ **Pendiente: regrabar A1.** La toma actual (`<public>/a1/screen.mp4` + `events.json`) usa
> el viewport anterior (el de la fila del 31/10/2026 en el historial), previo a este dispositivo. El grabador y la composición ya usan el S24 Ultra; la
> toma vieja entra con bandas a los costados hasta que se regrabe con `pnpm record:a1`.

## Grabación (record/record-a1.mts)

- Pantallas **reales** de Hospeda, vista **mobile** con el viewport del dispositivo de referencia (arriba).
- Chromium headless nuevo (`channel: 'chromium'`) + `--force-device-scale-factor=3`. El headless shell por
  defecto ignora el DPR y graba a escala 1.
- Usuario `host-basico@local.test`. Antes de cada toma: se borra el borrador de la toma anterior (si no,
  `/publicar/` muestra «Ya tenés un borrador en curso») y su alojamiento publicado se llama
  **«Casa Quinta Las Palmeras»** (el seed lo trae como «Alojamiento Completo — Host Basico»).
- **Puesta en escena de demo**: se ocultan con CSS los avisos de plan/upsell que en un tutorial se leen
  como publicidad o error: banner «anfitrión en preparación», QR imprimible de la tarjeta, «Probá Hospeda
  gratis», «Función premium», «Texto con formato… Mejorar plan». Lista exacta en `DEMO_HIDE_CSS`; no se
  toca nada más de la interfaz. Los «Falta para publicar» del panel se dejan: cuentan la historia del
  paso 3.
- Los scripts que se inyectan en la página van como **texto**, no como función: `tsx` les agrega un
  helper `__name` que no existe en la página y el script falla en silencio.
- Cookie de consentimiento precargada; corrector ortográfico apagado; campos vaciados antes de tipear.
- Scroll **suave** y sólo si el elemento está fuera de la franja cómoda de la pantalla.
- Botón al final de un formulario: se alinea al borde inferior antes de tocarlo (si no, aparece el footer).
- **Grabar con la máquina libre**: con la CPU saturada la página captura a 8-11 cuadros/s en vez de 20-25.
- El grabador registra cada acción con su caja en pantalla: el montaje se recalcula solo al regrabar.

## Montaje (src/a1/) — nivel estudio

- **Estructura**: intro (2,2 s, exactamente el primer compás de la música: el groove entra cuando arranca
  el tutorial) → tutorial → cierre (4 s).
- **Intro**: «¿Querés publicar tu alojamiento?» palabra por palabra + Hospedín grande (pose `main`, que
  parpadea) + el teléfono inclinado en 3D a la derecha. Hospedín sale por la izquierda y el teléfono
  se endereza y se centra.
- **Teléfono creíble**: el S24 Ultra del dispositivo de referencia (marco plano de titanio, esquinas
  casi rectas, botones a la derecha, cámara perforada centrada), barra de estado de Android (hora,
  wifi, señal, batería llena), barra de direcciones de Chrome y barra de navegación de tres botones,
  reflejo de vidrio y sombra profunda.
- **Edición**: las cargas de página se cortan y se tapan con un **barrido de marca** (azul + verde con
  el logo). El tipeo largo se muestra con **jump cut**: el arranque y el final, con un leve golpe de zoom
  para que se lea como corte y no como salto. Ritmo general 1,2×.
- **Foco**: zoom moderado (1,4× tipeo, 1,3× toques) y el resto de la pantalla **atenuado** con el campo
  activo iluminado y contorno naranja. Con zoom fuerte (1,85×) se perdía el teléfono y se cortaban textos.
- **Cámara sin tirones**: ease senoidal, 22-44 cuadros según el recorrido, sin alejarse entre acciones
  cercanas, salto instantáneo durante un barrido.
- **Toques** sólo en taps (no en tipeo): presión blanca + anillo naranja.
- **Un mensaje por vez**: Hospedín entra desde el borde **sólo al cambiar de etapa**, dice una frase y
  se va. Arriba a la izquierda queda un chip de paso («1/3 · Datos básicos»). Nada de título fijo +
  globo + interfaz al mismo tiempo.
- **Fondo con profundidad**: capas (manchas de luz, dos filas de colinas) con paralaje según la cámara,
  y viñeta suave.
- **Cierre**: logo que entra girando, «Publicá tu alojamiento» palabra por palabra, píldora
  `hospeda.com.ar`, eslogan, Hospedín festejando. El teléfono sale del cuadro por completo.
- Tipografías de la web: Geologica (títulos), Roboto (texto).
- Sin elementos decorativos naranjas sueltos: compiten con el sol de Hospedín.

## Sonido (`<public>/audio/`, tools/audio/)

- Todo sintetizado por código (sin derechos de terceros). Música: Do mayor, 110 BPM, base de 48 s.
- Efectos: tap en cada toque, tecleo suave mientras se ve escribir, whoosh en los barridos y en la
  intro/cierre, pop cuando entra Hospedín, ding en «Cambios guardados», swell al final de la intro.
- La música se desvanece en el cierre y entra un remate musical cuyo golpe cae en el logo.
- Nadie lo escuchó al generarlo: **el dueño valida el sonido**.

## Hospedín (`<public>/hospedin/hd/`, tools/hd_*.py)

- Poses ampliadas 4× con Real-ESRGAN anime antes de recortar; recorte con `bria-rmbg` + máscara de
  saturación + relleno de huecos (mangas sólidas).
- El **sol va en su propia capa** y flota aparte (nunca toca la cabeza, biblia §2). `layers.json` tiene
  la posición del sol por pose y los ojos de `main` para el parpadeo.
- Real-ESRGAN deforma el logo chico del buzo («hoopodo»): se repinta desde la pose `main`.
- No hay pose de pulgar arriba: para festejar va `vamos`. La lamparita pierde los rayitos.

## Pendiente de definir con el dueño

- Voz en off (opcional; el video tiene que funcionar sin ella).
- Publicar exige plan activo y los usuarios del seed no lo tienen: resolverlo antes del video de
  publicación.
- Animación «de verdad» de Hospedín (saludo con brazo articulado, etc.): requiere un clip generado
  (Hailuo, método de `marketing/`) o separar el personaje en piezas.
