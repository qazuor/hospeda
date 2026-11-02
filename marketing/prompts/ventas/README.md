# Material de venta — prompts

Prompts para generar con **ChatGPT** (el custom GPT de Hospeda) las piezas que usan los
vendedores por WhatsApp, Instagram y mail. Plan de origen: la conversación del 01/11/2026
(kit transversal + una sección por vertical + aliados).

> **No edites los `.md` de las piezas a mano.** Salen de `_generador/`: cambiá los datos
> ahí y corré `node marketing/prompts/ventas/_generador/generar.mjs`. Este README también se
> regenera.

## Cómo se usa

1. **Un chat nuevo por pieza.** Pegá el prompt entero y adjuntá lo que dice «Qué adjuntar».
2. **El logo, siempre:** `apps/web/src/assets/images/logo.webp`. Antes de cada imagen
   nueva (otra página, otra placa, otro formato o una corrección), el prompt hace que
   ChatGPT te lo pida de nuevo. Adjuntalo cada vez: si no, el logo se deforma.
3. **Hospedín**, cuando la pieza lo lleva: `marketing/Hospedin.png` y las guías del
   personaje (`marketing/personaje-hospedin.md`).
4. **Carruseles y PDF:** se genera una imagen por vez. Escribí «siguiente» para la próxima.
   Las páginas de los PDF salen como imágenes 2:3; el PDF lo armás vos después.
5. **Capturas:** las piezas que muestran la plataforma llevan una captura real, sacada con
   una cuenta de anfitrión (nunca la de super admin). Si no la adjuntás, la pantalla queda
   como un rectángulo con la palabra CAPTURA para pegarla después: ChatGPT no inventa la
   interfaz.

## Reglas de todo el kit

- **Cero precios**, salvo en la hoja de precios (T6), que se rehace con los valores del día.
- **Nada que no exista** como si funcionara: lo que viene lleva «Próximamente».
- **Sin métricas inventadas** ni testimonios inventados.
- **Ningún destino por encima de otro**; nunca la lista completa.
- **Sin cupones.**
- **Airbnb, Booking y Google** se nombran solo en calendario y reputación, nunca con su logo.
  En la importación de fichas se dice «Google, Mercado Libre y otras plataformas».
- La insignia dice «30 días de prueba gratis · Sin tarjeta», igual que los flyers de venta.

## Piezas

### Para todas las verticales

| Pieza | Para quién | Tipo |
|---|---|---|
| [T1 · Qué es Hospeda](transversal/t1-que-es-hospeda.md) | Todos los clientes, como primer mensaje | Placa |
| [T2 · Cómo funciona](transversal/t2-como-funciona.md) | Todos los clientes, después del primer contacto | Infografía |
| [T3 · La prueba gratis](transversal/t3-prueba-gratis.md) | Indecisos que preguntan cuánto cuesta | Placa |
| [T4 · Sin comisión](transversal/t4-sin-comision.md) | Quien ya publica en portales que cobran comisión | Infografía comparativa |
| [T5 · Mapa de cobertura](transversal/t5-mapa-de-cobertura.md) | Todos los clientes | Imagen |
| [T6 · Hoja de precios](transversal/t6-hoja-de-precios.md) | Quien ya pidió el precio | PDF (4 páginas) |
| [T7 · Paso a paso del alta](transversal/t7-paso-a-paso-del-alta.md) | Quien ya dijo que sí y tiene que cargar | Carrusel (6 placas) |
| [T8 · Preguntas frecuentes](transversal/t8-preguntas-frecuentes.md) | Todos los clientes, para despejar dudas | PDF (2 páginas) |
| [T11 · Tarjeta con QR](transversal/t11-tarjeta-con-qr.md) | Visitas en persona | Tarjeta imprimible (frente y dorso) |

### Alojamientos

| Pieza | Para quién | Tipo |
|---|---|---|
| [A1 · Publicar es fácil](alojamientos/a1-publicar-es-facil.md) | Quien alquila un departamento o una casa y no se lleva bien con la tecnología | Carrusel (4 placas) |
| [A2 · Tu ficha, así se ve](alojamientos/a2-tu-ficha-asi-se-ve.md) | Todos los alojamientos | Placa con captura anotada |
| [A3 · Importá tu ficha](alojamientos/a3-importa-tu-ficha.md) | Quien ya publica en otra plataforma | Placa |
| [A4 · Calendario sin reservas dobles](alojamientos/a4-calendario-sin-reservas-dobles.md) | Cabañas, complejos y hoteles que publican en varias plataformas | Infografía |
| [A5 · Tu reputación, junta](alojamientos/a5-tu-reputacion-junta.md) | Quien ya tiene reseñas en otros sitios | Placa |
| [A6 · En tres idiomas](alojamientos/a6-en-tres-idiomas.md) | Hoteles y alojamientos con turismo extranjero | Placa |
| [A7 · Qué plan te conviene](alojamientos/a7-que-plan-te-conviene.md) | Quien pregunta qué plan elegir | Infografía (árbol de decisión) |
| [A8 · Complementos](alojamientos/a8-complementos.md) | Clientes que ya tienen plan y quieren más | Listado |
| [A9 · Presentación para hoteles y complejos](alojamientos/a9-presentacion-para-hoteles.md) | Hoteles, apart hoteles y complejos grandes | PDF (7 páginas) |
| [A10 · Beneficios de ser anfitrión](alojamientos/a10-beneficios-de-ser-anfitrion.md) | Todos los alojamientos, para cerrar | Placa |

### Comer y salir

| Pieza | Para quién | Tipo |
|---|---|---|
| [C1 · Que el turista te encuentre](comer-y-salir/c1-que-el-turista-te-encuentre.md) | Todos los locales, como primer mensaje | Placa |
| [C2 · Tu local, así se ve](comer-y-salir/c2-tu-local-asi-se-ve.md) | Todos los locales | Placa con captura anotada |
| [C3 · Para locales chicos](comer-y-salir/c3-kit-para-locales-chicos.md) | Carritos, rotiserías, cafés, heladerías | Placa |
| [C4 · Presentación para restaurantes y resto bars](comer-y-salir/c4-presentacion-para-restaurantes-y-resto-bars.md) | Restaurantes, parrillas, resto bars y cervecerías grandes | PDF (4 páginas) |
| [C5 · De noche](comer-y-salir/c5-de-noche.md) | Pubs, boliches y resto bars que abren de noche | Carrusel (4 placas) |
| [C6 · Planes y complementos](comer-y-salir/c6-planes-y-complementos.md) | Quien pregunta qué plan elegir | Infografía |
| [C7 · Lo que se viene](comer-y-salir/c7-lo-que-se-viene.md) | Clientes que ya publican o que dudan | Listado |

### Experiencias

| Pieza | Para quién | Tipo |
|---|---|---|
| [E1 · Mostrá tu experiencia](experiencias/e1-mostra-tu-experiencia.md) | Todas las experiencias, como primer mensaje | Placa |
| [E2 · Tu experiencia, así se ve](experiencias/e2-tu-experiencia-asi-se-ve.md) | Todas las experiencias | Placa con captura anotada |
| [E3 · Turista internacional](experiencias/e3-turista-internacional.md) | Pesca, naturaleza, avistaje de aves | Placa |
| [E4 · Cerca de los alojamientos](experiencias/e4-cerca-de-los-alojamientos.md) | Todas las experiencias | Infografía |
| [E5 · Hoy, y lo que viene](experiencias/e5-hoy-y-lo-que-viene.md) | Quien pregunta si se puede reservar o cobrar por Hospeda | Placa |
| [E6 · Planes y complementos](experiencias/e6-planes-y-complementos.md) | Quien pregunta qué plan elegir | Infografía |

### Aliados

| Pieza | Para quién | Tipo |
|---|---|---|
| [P1 · Por qué aliarse](aliados/p1-por-que-aliarse.md) | Marcas, empresas e instituciones | PDF (5 páginas) |
| [P2 · Oro vs. plata](aliados/p2-oro-vs-plata.md) | Quien duda entre los dos niveles | Infografía comparativa |
| [P3 · Dónde aparece tu marca](aliados/p3-donde-aparece-tu-marca.md) | Quien quiere ver la presencia antes de decidir | Carrusel (3 placas) |
| [P4 · Aliado fundador](aliados/p4-aliado-fundador.md) | Marcas que pueden entrar en el lanzamiento | Placa |
| [P5 · Kit de medios](aliados/p5-kit-de-medios.md) | Marcas grandes que piden números | PDF (3 páginas, plantilla) |


### Textos (no son imágenes)

| Pieza | Para quién |
|---|---|
| [T9 · Kit del vendedor](textos/t9-kit-del-vendedor.md) | Los vendedores: perfiles, qué mandar, qué no prometer, objeciones |
| [T10 · Plantillas de mensajes](textos/t10-plantillas-de-mensajes.md) | WhatsApp, Instagram, email y firma |
