# Guion de grabación — paso a paso

Qué tocar, en qué orden, en cada una de las 26 grabaciones de pantalla del catálogo.

Este documento es el **cómo**. El **qué** y el **para qué** están en
[`grabaciones.md`](grabaciones.md) (catálogo, ratios, reglas de
encuadre) y en el `capturas.md` de cada video. Los códigos (P1, A3, E1…) son los mismos
acá y allá.

> Se graba por **grabación**, no por video. Las 26 grabaciones alimentan los 37 videos y
> casi todas se reutilizan en varios. Grabar "el video V9" no existe: se graba P5 y P6,
> y de ahí sale V9, V18 y tres más.

---

## 1. Antes de tocar el teléfono

### 1.1 · Se graba contra staging, no contra producción

`staging.hospeda.com.ar`. La decisión se tomó después de grabar la primera toma contra
producción y mirar los números que quedaron en cuadro:

| | Producción | Staging |
|---|:-:|:-:|
| Alojamientos verificados | **1** | **110** |
| Destinos | 22 | 26 |
| Reseñas de viajeros | 28 | 36 |
| Tipos de experiencias | 17 | 40 |
| Eventos y actividades | 30 | 54 |

Producción tiene **un solo alojamiento publicado**, y ese número aparece en tipografía
grande en la home y repetido en el pie. Un video de marketing que dice "1 alojamiento" no
es un video de marketing. Además, con un solo alojamiento **P2, P3, P4 y P13 no se pueden
grabar**: piden 6 a 8 en el listado, más de un resultado al filtrar, y tres para la tabla
comparativa.

Staging resuelve las cuatro de una, y encima:

- **Nada de lo que hagas ensucia la base real.** Podés crear cuentas, publicar fichas de
  prueba y borrarlas sin consecuencias
- **A7 deja de cobrar plata.** El checkout de staging va contra Mercado Pago de prueba: se
  puede grabar el flujo **completo**, incluida la pantalla de pago exitoso

Lo que hay que vigilar, a cambio:

- **Los datos son de siembra.** Antes de grabar una ficha, leela: si tiene un nombre o un
  texto que se lee como relleno, no sirve para un video
- **Las reseñas pueden mostrar usuarios de prueba.** Revisá que no aparezcan correos
  terminados en `.test` ni nombres inventados evidentes
- **Staging puede ir adelantada respecto de producción.** Si grabás una pantalla que en el
  sitio real todavía no existe, el video promete algo que nadie va a encontrar. Ante la
  duda sobre una funcionalidad, verificá que esté también en producción antes de grabarla
- **A6 sigue mostrando ceros.** Las estadísticas reflejan visitas reales, y en staging no
  las hay. Ese problema no lo resuelve el cambio de entorno

### 1.2 · Instalá el sitio como aplicación — esto cambia todas las tomas

El sitio trae un manifiesto con `display: standalone`. Traducido: si lo **agregás a la
pantalla de inicio** desde Chrome, se abre **sin barra de dirección**.

Eso resuelve cuatro cosas de un saque:

1. **No se ve que estás en staging.** Sin barra, no hay dominio en cuadro
2. **No se ve tu contador de pestañas** ni el menú de los tres puntos
3. **Ganás unos 130 píxeles de contenido útil** en cada toma
4. **El primer frame queda limpio**, que es de donde salen los fijos

**Cómo se hace**: abrí `staging.hospeda.com.ar/es/` en Chrome → menú de los tres puntos →
*Agregar a la pantalla de inicio* → abrilo desde el ícono nuevo, no desde Chrome.

> Verificá que abrió en modo aplicación antes de grabar: **no tiene que haber barra de
> dirección arriba**. Si la ves, lo abriste desde Chrome.
>
> La única grabación que **no** usa el modo aplicación es **E1**, que justamente muestra
> una búsqueda de Google en el navegador.

### 1.3 · Qué tiene que estar cargado antes de cada grabación

Staging ya trae volumen, así que la mayoría de las grabaciones públicas salen sin preparar
nada. Lo que sigue es lo que hay que revisar o cargar igual.

| Grabación | Qué revisar o cargar |
|---|---|
| **P5** ficha completa | Buscá entre las 110 una que ya esté completa: fotos, comodidades, servicios, preguntas frecuentes, opiniones, reputación externa, mapa, precio y contacto. Si falta alguna, esa sección **no aparece** y el scroll queda con un hueco. Si ninguna está completa, completá una a mano |
| **P6** WhatsApp | Que la ficha de P5 tenga el WhatsApp cargado, y que tu cuenta tenga plan con acceso directo |
| **P1** home | Que la sección de destacados tenga alojamientos, y **esperar a que termine de cargar** antes de arrancar |
| **P2 · P3 · P4** | Nada. Al filtrar, verificá que quede más de un resultado en cuadro |
| **P13** comparador | Elegí tres alojamientos que tengan **precio, calificación y destacado** cargados, o la tabla sale con filas vacías |
| **P7 · P11** destino y lugares | Concepción del Uruguay es el destino más completo; Colón el que más lugares con coordenadas tiene |
| **P8 · P9 · P10** | Nada. Para P10, tocá un chip de categoría que tenga eventos |
| **A2** carga de ficha | El borrador que dejó A1 |
| **A3** calendario | Una dirección `.ics` real **con fechas ya ocupadas**. Con un calendario vacío no se pinta nada, que es lo único que el video quiere mostrar |
| **A4** IA de textos | Una descripción pobre puesta a propósito, y cuota de IA disponible |
| **A5** reputación externa | La ficha **sin** reputación externa todavía. El "antes" es la mitad del video |
| **A9** directorio de oficios | Que haya proveedores cargados |
| **A10** importar ficha | Un link externo que **no sea de Airbnb ni de Booking** |
| **A1 · A8** | Nada previo |

### 1.4 · Dos grabaciones que dependen del estado de la cuenta

**A6 — estadísticas.** Los indicadores muestran visitas reales, y en staging no las hay:
van a estar en cero. Un panel en cero no vende nada. Esta grabación queda pendiente hasta
resolver de dónde sale un panel con números creíbles.

**A7 — checkout.** Necesita una cuenta **sin suscripción activa**, porque "Empezar" es el
botón que arranca una suscripción nueva. En staging el pago es de prueba, así que **el
flujo se puede grabar entero**, hasta la pantalla de pago exitoso.

---

## 2. Preparación del teléfono

Se hace una vez y vale para las 26.

| Paso | Detalle |
|---|---|
| 1 | **No molestar activado.** Una notificación entrando arruina la toma y obliga a regrabar. |
| 2 | **Batería arriba del 80% y cargador desenchufado.** El ícono de carga cambia y se nota entre tomas. |
| 3 | **Brillo al máximo y fijo.** El brillo automático cambia solo al mover el teléfono y se ve como un fundido raro. |
| 4 | **Grabador de pantalla a 1080 × 2340**, 30 fps o más. Verificá el primer archivo antes de seguir: si sale 720 o con otro alto, todo el material queda inservible para los fijos. |
| 5 | **Sin audio interno ni micrófono.** El sonido lo pone la edición. |
| 6 | **Teclado sin la fila de sugerencias**, si se puede. Aparecen palabras del historial personal al escribir. |
| 7 | **Abrí el sitio desde el ícono de la pantalla de inicio**, no desde Chrome. Sin barra de dirección (ver 1.2). |
| 8 | **Ocultá la burbuja flotante del grabador de pantalla.** Queda encima del contenido y arruina el primer frame, que es de donde salen los fijos. |
| 9 | **Esperá a que la página termine de cargar** antes de apretar grabar. Un spinner girando en cuadro delata que arrancaste antes de tiempo. |

Y la regla que ya está en el catálogo, repetida acá porque es la que más se olvida:
**se graba siempre, nunca se captura.** Aunque la pantalla esté quieta, son dos segundos
de video, no un screenshot.

---

## 3. Las cuentas

**Nunca la de super administrador.** Tiene menús y datos que un anfitrión no ve.

Se usan dos estados de sesión, y el orden importa:

| Estado | Para qué | Por qué |
|---|---|---|
| **Sin sesión** | P1 a P5, P7 a P11 | Con sesión iniciada aparece el **widget flotante de chat con IA** sobre la ficha, y tapa el contenido en las tomas de scroll |
| **Con sesión de anfitrión** | P6, P12, P13 y todas las A | Favoritos, comparador y el WhatsApp real necesitan cuenta. El plan de anfitrión ya incluye el paquete completo de turista VIP, así que la misma cuenta sirve para las tres |

> ⚠️ **El botón de WhatsApp solo aparece de verdad con plan.** Sin plan con acceso
> directo, en su lugar sale un cartel "Ver planes". Si grabás P6 sin sesión, grabás el
> upsell, no el botón.

**Antes de cada toma con sesión**: verificá que la barra flotante del comparador esté
vacía. Si quedó algo de una toma anterior, aparece en cuadro. Se limpia con **"Limpiar"**
en la barra.

---

## 4. Orden de grabación

Cargando el contenido a mano, el orden se da vuelta respecto de lo que parecería.

**La ficha completa que pide P5 no existe todavía: hay que construirla.** Y construirla es
exactamente lo que muestran A1 y A2. Así que en vez de cargarla en silencio y grabarla
después, **se graba mientras se carga**: A1 crea la ficha, A2 la completa, y esa misma ficha
ya terminada es la que después se recorre en P5 y P6.

Un solo trabajo de carga alimenta cuatro grabaciones. Hecho al revés, se hace dos veces.

1. **Alta y carga, con la cuenta de anfitrión** — A10 primero (el atajo del importador),
   después A1 de una sola toma, después A2 completando sección por sección hasta que la
   ficha quede impecable
2. **Ajustes sobre esa misma ficha** — A4 (dejá la descripción pobre a propósito antes de
   grabar), A5 (antes de cargarle la reputación externa), A3 (calendario)
3. **Cerrá sesión** y grabá el bloque público — P5 primero, después P1, P2, P3, P4, P7,
   P8, P9, P10, P11
4. **Volvé a iniciar sesión** — P6, P12, P13
5. **El resto del anfitrión** — A6, A8, A9, y A7 al final del todo
6. **Fuera de la plataforma** — E1, E2, E3

> El paso 3 va sin sesión y el 4 con sesión: no es capricho del orden, es que el widget
> flotante de chat con IA solo aparece logueado y tapa el contenido en las tomas de scroll.

> A5 y A4 tienen que grabarse **antes** de que la ficha esté terminada, porque los dos
> videos son un antes y un después. Si primero completás todo y después grabás, no hay
> "antes" que mostrar.

---

## 5. Las grabaciones

Convención: **`▶`** arranca la grabación, **`■`** la corta. Todo lo que está entre las dos
va en una sola toma.

### Bloque público — sin sesión iniciada

---

#### P5 · Ficha de alojamiento completa · *scroll* · V7 V8 V9 V10

La más importante del set. Grabala primera y con la ficha ya completada.

En mobile el layout de dos columnas colapsa y **el bloque de precio, contacto y WhatsApp
queda al final de todo**, después de los carruseles. No es un error: es el orden real.

1. Abrí `/es/alojamientos/<slug-de-la-ficha-completa>/` y esperá a que carguen todas las fotos
2. Bajá una vez para colapsar la barra de dirección, y volvé arriba del todo
3. **▶**
4. Quedate quieto 2 segundos sobre el encabezado (nombre y badges)
5. Scrolleá **lento y parejo**, sin frenar en seco, por las secciones en este orden:
   galería → datos rápidos → descripción → contacto → servicios → comodidades → opiniones
   → reputación externa → preguntas frecuentes → mapa → qué hay cerca
6. Seguí por los carruseles: alojamientos similares, otros del mismo anfitrión, notas y eventos
7. Terminá en el bloque final: precio, alerta de precio, tarjeta del anfitrión
8. **■**

> Grabá también una **segunda pasada más rápida** de la misma ficha. La edición casi
> siempre necesita una versión acelerada y volver a grabarla cuesta más que hacerla ahora.

**Fijos que salen de acá**: `p5.png` (primer frame) y `p5-contacto.png` (el momento del
bloque de contacto).

---

#### P1 · Home · *scroll* · V2 V3 V4 V6 V9

1. Abrí `/es/`
2. **▶**
3. 2 segundos quieto sobre el hero con el buscador
4. Scrolleá lento por: destacados → categorías → destinos → próximos eventos → quiénes
   somos → últimas notas → invitación a anfitriones → testimonios → números → partners
5. **■**

**Fijo**: `p1.png`, primer frame. Es el que va dentro del celular que dibuja Hailuo en
varias tomas, así que el hero tiene que verse impecable.

> El `capturas/pantalla.png` que ya existe **no sirve** para esto: mide 1080 × 2117, es un
> screenshot. Hay que reexportarlo como primer frame de esta grabación.

---

#### P2 · Listado de alojamientos · *scroll* · V2 V8 V30

1. Abrí `/es/alojamientos/`
2. **▶**
3. 2 segundos quieto sobre la cabecera del listado
4. Scrolleá lento por las tarjetas, mostrando entre 6 y 8 alojamientos
5. **■**

---

#### P3 · Buscador con filtros aplicados · *acción* · V30

**No hay botón "Aplicar".** Cada filtro que tocás navega solo, con medio segundo de
demora. No esperes un botón de confirmación: no existe.

1. Abrí `/es/` y quedate en el hero
2. **▶**
3. Tocá el buscador y elegí un destino
4. Elegí fechas de entrada y salida
5. Subí la cantidad de huéspedes a 2
6. Tocá **"Buscar"**
7. Esperá a que cargue el listado
8. Tocá el botón flotante **"Filtros"** — se abre un panel lateral, no un cartel centrado
9. Marcá un tipo de alojamiento y esperá a que el listado se actualice solo
10. Mové el rango de precio y volvé a esperar
11. Tocá **"Cerrar filtros"**
12. Scrolleá los resultados filtrados
13. **■**

---

#### P4 · Buscador en lenguaje natural · *acción* · V30

Existe y es una entrada aparte del buscador normal.

1. Abrí `/es/alojamientos/`
2. **▶**
3. Tocá el botón flotante con la insignia **"IA"** — se abre el panel **"Búsqueda inteligente"**
4. Escribí la consulta **despacio**, para que se lea mientras se escribe:
   `cabaña para 4 con pileta cerca del río`
5. Enviala y esperá los resultados sin tocar nada
6. Scrolleá los resultados
7. **■**

---

#### P7 · Página de destino · *scroll* · V2 V6 V8 V29 V33

1. Abrí `/es/destinos/concepcion-del-uruguay/`
2. **▶**
3. 2 segundos quieto sobre el hero
4. Scrolleá lento por: descripción → galería → puntos de interés → **el mapa con los
   marcadores** → opiniones → preguntas frecuentes → alojamientos en el destino → eventos
   → notas → destinos cercanos
5. Frená 2 segundos sobre el mapa: es lo más vistoso de la página
6. **■**

> Salteá con el dedo el bloque **"¿Viste información incorrecta?"**: es una invitación a
> reportar errores y en un video de venta se lee raro.

---

#### P8 · Gastronomía: listado y ficha · *scroll* · V2 V26 V29

1. Abrí `/es/gastronomia/`
2. **▶**
3. Scrolleá el listado mostrando 4 o 5 locales
4. Entrá al local que tengas con la ficha completa
5. Scrolleá la ficha: galería → descripción → horarios → contacto y redes → opiniones →
   preguntas frecuentes
6. **■**

---

#### P9 · Experiencias: listado y ficha · *scroll* · V2 V27 V29

1. Abrí `/es/experiencias/`
2. **▶**
3. Scrolleá el listado
4. Entrá a una experiencia
5. Scrolleá: galería → información → opiniones → preguntas frecuentes
6. **■**

> ⚠️ **No toques el botón de contacto de la ficha de experiencias.** Está en pantalla pero
> todavía no hace nada. Grabar un botón que no responde es peor que no mostrarlo.

---

#### P10 · Agenda de eventos · *scroll* · V2 V29 V34

**No hay vista de calendario.** Es una lista con filtros y chips. Si el guion de V34
imaginaba una grilla mensual, no existe.

1. Abrí `/es/eventos/`
2. **▶**
3. Scrolleá la lista mostrando 5 o 6 eventos
4. Tocá un chip de categoría (por ejemplo **Música**) y esperá a que filtre
5. Scrolleá los resultados
6. **■**

---

#### P11 · Puntos de interés · *scroll* · V2 V29

**No existe una página de "puntos de interés" suelta.** Los lugares viven dentro de la
página del destino, y solo unos pocos tienen ficha propia.

1. Abrí `/es/destinos/colon/`
2. Scrolleá hasta que la sección de puntos de interés esté arriba de todo en pantalla
3. **▶**
4. Recorré la grilla de lugares
5. Tocá un filtro de categoría y esperá a que la grilla se reordene
6. Bajá hasta el mapa con los marcadores y esperá a que termine de dibujarlos
7. Tocá un marcador para que se abra su globo
8. **■**

Colón es la que más lugares tiene cargados, por eso va ésta y no otra.

---

### Bloque con sesión de anfitrión

Iniciá sesión ahora, antes de seguir.

---

#### P6 · Contacto por WhatsApp · *acción* · V9 V18

1. Abrí `/es/alojamientos/<slug-de-la-ficha-completa>/`
2. Scrolleá hasta el final, donde está la tarjeta del anfitrión, y dejá visible el bloque
   **"Contacto por WhatsApp"**
3. **▶**
4. 2 segundos quieto sobre el botón
5. Tocá **"Consultar por WhatsApp"**
6. Dejá que WhatsApp abra y muestre la conversación con el mensaje ya escrito
7. **■**

> ⚠️ Antes de tocar, revisá que WhatsApp **no tenga conversaciones ni nombres reales a la
> vista** al abrir. Ese es el momento donde más fácil se filtra información de terceros.
>
> Si en lugar del botón aparece **"Ver planes"**, la cuenta no tiene el plan que da acceso
> directo. No sirve: cambiá de cuenta.

---

#### P12 · Favoritos · *acción* · V31

Necesita cuenta sí o sí. No hay favoritos anónimos.

1. Abrí `/es/alojamientos/`
2. **▶**
3. Tocá el corazón de una tarjeta y esperá el cartel **"Guardado en favoritos"**
4. Repetí con dos tarjetas más, sin apurarte
5. Tocá **"Ver favoritos"** en el cartel, o entrá a `/es/mi-cuenta/favoritos/`
6. Scrolleá los tres guardados
7. **■**

---

#### P13 · Comparador · *acción* · V32

El flujo cambió: **primero se activa el modo comparar**, después se agregan. No hay un
botón siempre visible en las tarjetas.

1. Abrí `/es/alojamientos/` y limpiá la barra del comparador si tiene algo
2. **▶**
3. Tocá el interruptor **"Comparar alojamientos"**
4. En la primera tarjeta tocá **"Agregar"** — pasa a decir **"Agregado"**
5. Repetí en otras dos tarjetas. Abajo el contador va marcando cuántos llevás
6. Tocá **"Ver comparación"**
7. **Esperá 3 segundos con la tabla completa quieta en pantalla** — es el argumento del
   video y tiene que leerse entera
8. Scrolleá la tabla despacio: tipo, precio, ubicación, calificación, opiniones, destacado,
   descripción
9. **■**

De una sola toma, sin cortes. **Fijos**: `p13.png` (comparador vacío) y `p13-tabla.png`
(la tabla armada).

---

### Bloque de anfitrión

---

#### A10 + A1 · Importar ficha y alta completa · *acción* · V1 V11

Comparten la misma pantalla, así que se graban seguidas — pero son **dos tomas distintas**,
porque V1 muestra el atajo y V11 muestra el camino completo.

**A10 — Importar ficha** (V1):

1. Abrí `/es/publicar/nueva/`
2. **▶**
3. Tocá **"Importar desde una URL"** para desplegar el bloque
4. Pegá el link en el campo **"URL del alojamiento"** — que se vea el gesto de pegar
5. Tocá **"Importar"**
6. **No cortes durante la espera.** Que se vea cuánto tarda de verdad
7. Cuando los campos se completen solos, scrolleá despacio mostrando todo lo que llegó cargado
8. **■**

> ⚠️ **Si el aviso de origen se ve en pantalla, no puede ser de Airbnb ni de Booking.**
> Usá un link de Mercado Libre o de Google. Es una regla del plan, no una preferencia.

**A1 — Alta completa** (V11), de una sola toma y sin cortes:

1. Cerrá sesión y abrí `/es/publicar/`
2. **▶**
3. Tocá **"Empezar ahora"** y creá la cuenta
4. En **"Paso 1 de 2 · Datos básicos"** completá nombre, tipo, ciudad y descripción corta
5. Tocá **"Crear borrador y seguir al paso 2"**
6. Ya en el listado de propiedades, entrá a editar el borrador
7. Recorré el hub de secciones cargando lo mínimo de cada una
8. Volvé al listado y tocá **"Publicar"** → **"Sí, publicar"**
9. **■**

> Esta es la toma más larga del set y la que más se arruina si se corta: el valor del
> video es justamente que se vea el recorrido entero sin pasos escondidos. Reservale tiempo
> y hacela cuando ya tengas práctica con la interfaz.

---

#### A2 · Carga de ficha · *acción* · V10 V11

**No son pestañas ni acordeones.** Es un menú de secciones y cada una es una pantalla
aparte: en mobile hay que **volver al menú entre sección y sección**. Eso se ve en el video
y está bien que se vea, pero conviene saberlo antes de grabar.

1. Abrí `/es/mi-cuenta/propiedades/<id>/editar/`
2. **▶**
3. 2 segundos quieto sobre el menú **"Elegí qué querés editar"**
4. Entrá a **Fotos**, subí una o reordená dos, volvé al menú
5. Entrá a **Ubicación**, mové el pin del mapa, volvé
6. Entrá a **Servicios y comodidades**, marcá tres o cuatro, volvé
7. Entrá a **Capacidad y precio**, cargá un precio, volvé
8. Entrá a **Contacto y redes**, cargá el WhatsApp, volvé
9. **■**

---

#### A3 · Calendario · *acción* · V16

1. Abrí `/es/mi-cuenta/propiedades/<id>/editar/calendario/`
2. **▶**
3. 2 segundos quieto sobre el calendario con las fechas libres
4. Tocá **"Conectar calendarios externos"**
5. En la ventana **"Sincronización de calendarios externos"**, pegá una dirección `.ics`
   en el campo del feed
6. Tocá **"Conectar"**
7. Esperá sin cortar, y **que se vea el momento exacto en que las fechas ocupadas se pintan solas**.
   Ese instante es el video entero
8. **■**

> Acá **sí** se pueden nombrar Airbnb, Booking y Google: en calendarios está permitido.

---

#### A4 · IA para textos · *acción* · V17

1. Abrí `/es/mi-cuenta/propiedades/<id>/editar/datos/`
2. Dejá en la descripción un texto pobre a propósito, de dos renglones
3. **▶**
4. 3 segundos quieto sobre el texto pobre, para que se alcance a leer
5. Tocá **"Mejorar con IA"**
6. Esperá sin cortar y dejá que aparezca el texto mejorado
7. Scrolleá el resultado
8. Volvé al menú, entrá a **Traducciones** y tocá **"Generar traducciones faltantes"**
9. Mostrá el resultado en los tres idiomas
10. **■**

---

#### A5 · Reputación externa · *acción* · V19

**No es un botón de Google con un clic.** Es un formulario donde se elige la plataforma y
se pega una dirección. No hay ventana de permisos de Google.

1. Abrí primero la ficha pública y grabá 3 segundos donde **no hay estrellas**
2. Andá a `/es/mi-cuenta/propiedades/<id>/editar/reputacion/`
3. **▶**
4. Elegí **Google** en el selector de plataforma
5. Pegá la dirección del perfil
6. Tocá **"Agregar"**, y después **"Actualizar reseñas"**
7. Volvé a la ficha pública y **mostrá las estrellas ya aparecidas**
8. **■**

El antes y el después es el video. Si no se graba el "antes", no hay video.

---

#### A6 · Panel de estadísticas · *scroll* · V20

1. Abrí `/es/mi-cuenta/host-dashboard/`
2. **▶**
3. 2 segundos quieto sobre el título **"Panel del anfitrión"**
4. Scrolleá lento por las tarjetas: tus propiedades, tu suscripción, mensajes, acciones rápidas
5. Frená en **Estadísticas** y recorré los indicadores: vistas, tiempo de respuesta, consultas
6. **■**

> Con un plan que no incluya estadísticas avanzadas, en lugar de los gráficos aparece
> "Estadísticas disponibles en tu próximo plan". Para este video hace falta una cuenta con
> el plan que las incluye.

---

#### A8 · Planes · *quieta* · V13

**Sin que se lean los importes.** Un precio quemado en el video obliga a rehacerlo cuando
cambie la lista, y la lista va a cambiar.

1. Abrí `/es/suscriptores/planes/comparar/`
2. Scrolleá hasta que la comparativa de funciones llene la pantalla y **los precios queden
   fuera de cuadro, arriba**
3. **▶**
4. 3 segundos quieto
5. Scrolleá muy despacio por las filas de funciones, cuidando que ningún importe entre en cuadro
6. **■**

Si en algún momento un precio entra en cuadro, cortá y volvé a empezar. Recortar en edición
no siempre alcanza.

---

#### A9 · Directorio de oficios · *scroll* · V28

1. Abrí `/es/mi-cuenta/directorio-proveedores/`
2. **▶**
3. Scrolleá el listado mostrando los rubros: plomería, gas, electricidad, cerrajería,
   climatización, limpieza
4. Entrá a un proveedor y mostrá su ficha
5. Bajá hasta **"Registrar uso del beneficio"** y quedate 2 segundos ahí
6. **■**

> **No toques "Registrar el uso".** Genera un registro real que la otra parte tiene que
> confirmar o rechazar. Mostrar el botón alcanza.

---

#### A7 · Checkout con Mercado Pago · *acción* · V12 V21

**En staging el pago es de prueba, así que esta vez se graba entera.** Ver el punto 1.4.

1. Abrí `/es/suscriptores/planes/`
2. **▶**
3. Scrolleá los planes
4. Tocá **"Empezar"** en uno
5. Dejá que la pantalla salga del sitio y **entre a Mercado Pago**
6. 2 segundos sobre la pantalla de Mercado Pago ya cargada
7. Completá el pago con una tarjeta de prueba
8. Volvé al sitio y mostrá la pantalla de pago exitoso
9. **■**

---

### Fuera de la plataforma

---

#### E1 · Búsqueda en Google · *acción* · V22

1. Abrí Google en una pestaña nueva y limpia, sin historial a la vista
2. **▶**
3. Escribí despacio: `casa termas federacion alojamiento`
4. Buscá y esperá los resultados
5. Scrolleá hasta que **el resultado de Hospeda entre en cuadro** y quedate 2 segundos
6. Tocalo y dejá que abra la ficha
7. **■**

---

#### E2 · Consulta a una IA · *acción* · V22

1. Abrí un asistente de IA con una conversación nueva
2. **▶**
3. Escribí despacio: `dónde me puedo alojar en Federación cerca de las termas`
4. Enviá y **dejá que la respuesta se escriba sola en cuadro**, sin acelerar
5. Cuando aparezca la mención, quedate 3 segundos
6. **■**

> Puede no mencionarlo, o mencionar otra cosa. Probá varias veces antes de grabar, y grabá
> recién cuando sepas que la respuesta sale bien.

---

#### E3 · Otras plataformas · *scroll* · V23

Acá **sí** se pueden mostrar Airbnb, Booking, Instagram y Facebook: el video se trata
justamente de que Hospeda no reemplaza nada, suma.

1. Abrí cada aplicación por separado
2. **▶** en cada una, 4 o 5 segundos de scroll suave por su pantalla principal
3. **■**

Cuatro tomas cortas, una por plataforma. Sin cuentas personales ni nombres reales en cuadro.

---

## 6. Antes de dar por cerrada la jornada

Mirá **cada archivo completo** buscando lo que no tiene que salir:

- [ ] Nombres, correos o teléfonos de terceros
- [ ] Notificaciones que entraron durante la toma
- [ ] La barra de estado con la hora y la batería (se recorta en edición, pero verificá que
      haya margen para recortarla)
- [ ] Identificadores internos en la barra de dirección
- [ ] Importes en A8
- [ ] Logos de Airbnb o Booking en A10
- [ ] Que todos los archivos midan **1080 × 2340**. Uno solo que salga distinto obliga a
      regrabar esa toma

Al grabarse contra staging, no hay nada que limpiar después: lo que hayas creado para las
tomas puede quedarse donde está.
