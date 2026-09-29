---
title: "Revisión del owner · aplicación del lote de la matriz con las mediciones del 2026-09-29"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · aplicación del lote de la matriz con las mediciones del 2026-09-29

El lote de [`25-lote-matriz-mediciones-2026-09-29.md`](./25-lote-matriz-mediciones-2026-09-29.md)
(§ 2 por fila, § 3.2 la matriz, § 3.3 los espejos), escrito en `$D/06-mp-validation-matrix.md` y en
sus espejos con el **OK del owner del 2026-09-29, 17:20 `-03`**, con tres elecciones:

- **A**: OK entero.
- **B**: `WH-5` se cierra **`VERIFIED`**, con escrito que la entrega del 21/09 no se recuperó porque
  los logs de producción arrancan el 25/09 (el 🚧 de § 2.3 ya lo dice).
- **C**: `EX-53` queda **`NOT_SUPPORTED`**: el owner miró en la web y en la app del celular, y la
  opción de pausar no aparece en ninguna.

Editado en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `ce11412ec7`, sin
commits. El log y el PDR no se tocaron, ni los informes. **Los 10 puntos de impacto en el diseño
(`25-` § 4) no se aplicaron**: son una tanda posterior. `D/06` es la matriz, `B/` es
`HOS-1354…/docs`, `$B/` y `$D/` las raíces.

**Antes de escribir** grepeé cada ID: existen las diecinueve filas que se tocan, y `EX-55` y
`EX-56` no existían (la última `EX` era `EX-54`). La lectura de producción que `25-` § 0.1 pedía
escribir ya estaba como anexo al final de
[`RESULTS-2026-09-29.md`](../mp-probes/RESULTS-2026-09-29.md), con otro título y con el cruce por id
que el lote daba por faltante (ver § 3).

**Forma.** Los textos se extrajeron con un script de los bloques `text` de `25-` § 2
(`aplicar_lote25.py`, en el scratchpad de la sesión), en vez de copiarse a mano, y se pegaron al
final de la celda de conclusión separados por un espacio, como pide `25-` § 2. Las celdas de
estado, fecha, entorno y evidencia se reemplazaron comprobando antes que el texto de hoy fuera el
que el lote cita. Por `25-` § 0.2, **`WH-5` y `EX-15` quedan con el estado a secas** (la historia
va en su ✅), y `WH-6`, `EX-52` y `EX-53` con `` ~~`UNKNOWN`~~ ``, como `GR-1`.

## 1. Qué se escribió en la matriz

### Las filas

| `25-` | fila | estado | dónde |
|---|---|---|---|
| § 2.1 | `WH-6` | `UNKNOWN` → `VERIFIED` | `D/06:270` «Medida el 2026-09-29 con los dos canales escuchando» |
| § 2.2 | `EX-15` | `PARTIALLY_SUPPORTED` → `VERIFIED` | `D/06:336` «Cerrada el 2026-09-29 con los dos canales escuchando» |
| § 2.3 | `WH-5` | `PARTIALLY_SUPPORTED` → `VERIFIED` | `D/06:269` «queda descartada por el canal, en los dos entornos» |
| § 2.3 | `WH-5`, lo no recuperado | — | `D/06:269` «los logs de producción empiezan el 2026-09-25 10:33» |
| § 2.4 | `EX-52` | `UNKNOWN` → `VERIFIED` | `D/06:409` «la autoría de una baja sólo se conoce por nuestro propio registro» |
| § 2.5 | `EX-53` | `UNKNOWN` → `NOT_SUPPORTED` | `D/06:410` «Mirado en la web y en la app del celular: no aparece en ninguna.» |
| § 2.6 | `EX-55` ✚ | nueva, `VERIFIED` | `D/06:412` «¿Un alta de preapproval que devuelve `400` deja un preapproval creado?» |
| § 2.7 | `EX-56` ✚ | nueva, `VERIFIED` | `D/06:413` «A nombre de un pagador INVITADO que el proveedor crea» |
| § 2.8 | `EX-54` | sigue `UNKNOWN` | `D/06:411` «2026-09-29, no medido» |
| § 2.9 | `WH-1` | sigue `VERIFIED` | `D/06:265` «el duplicado a ~0,5 s aparece también por IPN» |
| § 2.10 | `WH-4` | sigue `VERIFIED` | `D/06:268` «2026-09-29, la escalera inicial en los dos canales» |
| § 2.11 | `EX-2` | sigue `VERIFIED` | `D/06:317` «`version` existe sólo en Webhooks» |
| § 2.11 | `EX-13` | sigue `VERIFIED` | `D/06:329` «IPN trae `x-signature` pero no verifica: 0 de 12» |
| § 2.11 | `EX-14` | sigue `NOT_SUPPORTED` | `D/06:330` «por IPN tampoco: el cuerpo no trae `live_mode`» |
| § 2.12 | `EX-16` | sigue `VERIFIED` | `D/06:331` «un registro de cobro puede existir por búsqueda y no por id» |
| § 2.13 | `EX-30` | sigue `VERIFIED` | `D/06:388` «una orden con tarjeta rechazada devuelve `402` y queda creada igual» |
| § 2.14 | `EX-36` | sigue `VERIFIED` | `D/06:393` «2026-09-29, qué avisa» |
| § 2.15 | `EX-44` | sigue `UNKNOWN` | `D/06:401` «sigue produciendo avisos de su registro de cobro» |
| § 2.15 | `EX-46` | sigue `UNKNOWN` | `D/06:403` «mientras el owner cambiaba la URL de Webhooks» |
| § 2.15 | `PA-6` | sigue `UNKNOWN` | `D/06:177` «Indicio de sandbox, no medición de producción» |
| § 2.16 | `RC-4` | sigue `NOT_SUPPORTED` | `D/06:279` «el `search` tampoco devuelve el mismo ESTADO que el `GET`» |
| § 2.17 | `RF-7` | sigue `VERIFIED` | `D/06:314` «2026-09-29, la Orders API en sandbox» |

Lo tachado, como lo pide cada sección: *«Sin medir.»* en `WH-6` y `EX-52`, *«Sin medir»* en
`EX-53`, y las fechas viejas de `EX-15` y `WH-5`:

- `D/06:336` «~~2026-09-15~~ **2026-09-29**»
- `D/06:270` «~~Sin medir.~~ Secuencia de la sonda 09»

### Encabezado, resumen y pie (`25-` § 3.2)

| qué | dónde |
|---|---|
| frontmatter | `D/06:6` «updated: 2026-09-29» |
| encabezado | `D/06:17` «Recontado el 2026-09-29 tras las mediciones de los dos canales (sondas 52 a 57» |
| resumen, `VERIFIED` | `D/06:443` «el 2026-09-29 (mediciones de los dos canales, sondas 52 a 57) entraron `WH-6`» |
| resumen, `WH-5` del 23/09 | `D/06:443` «(salió el 2026-09-28) (volvió el 2026-09-29)» |
| resumen, `PARTIALLY_SUPPORTED` | `D/06:444` «salieron las dos el 2026-09-29: `WH-5` y `EX-15` vuelven a `VERIFIED`» |
| resumen, `NOT_SUPPORTED` | `D/06:445` «la del 2026-09-29: `EX-53` (el pagador no puede pausar desde su cuenta)» |
| resumen, `UNKNOWN` | `D/06:447` «salieron tres el 2026-09-29 (mediciones de los dos canales)» |
| pie | `D/06:452` «tras las mediciones de los dos canales: 61 · 15 · 24 · 14» |
| pie, las sumadas | `D/06:452` «y `EX-55` y `EX-56` (mediciones del 29/09, sondas 52 y 53)» |

## 2. Las cifras, recontadas

Coinciden con `25-` § 3.1, columna *con el lote (recomendado)*; ninguna se forzó.

| qué | cifra | comando (desde `$D`) |
|---|---|---|
| filas de la matriz | **114**: 61 · 15 · 24 · 14 | `python3 contar-filas-de-la-matriz.py` |
| cerradas | **100** | 114 − 14 |

Las `UNKNOWN`, según el script: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42` a `EX-50` y `EX-54`, las
mismas que lista `25-` § 3.1.

## 3. Lo que difiere del texto del lote, y por qué

1. **El ancla del anexo de producción.** `25-` § 0.1 proponía titularlo *«Anexo: producción, logs
   de la API (29/09, tarde)»* y sus textos citaban `#anexo-producción-logs-de-la-api-2909-tarde`.
   El anexo se escribió como *«Anexo: la lectura de producción para `WH-5` y `WH-6` (29/09,
   tarde)»*, así que las seis citas (`WH-6` dos veces, `WH-5` dos, `EX-44` una, y la celda de
   evidencia de `WH-5`) apuntan a `#anexo-la-lectura-de-producción-para-wh-5-y-wh-6-2909-tarde`,
   el slug de ese título con la misma regla que ya usa el ancla del anexo de la mañana.
2. **`EX-53`, el hueco del owner.** El corchete *«[web / app / las dos: a completar por el
   owner]»* de § 2.5 quedó como *«Mirado en **la web y en la app del celular**: no aparece en
   ninguna.»*, por la elección C.
3. **`WH-6`, dos agregados que pidió el orquestador.** El cruce por id, que `25-` § 0.1 daba por no
   llegado, está en el anexo (*«los 8 ids de pago de IPN son exactamente los 8 de Webhooks, uno a
   uno»*): el *«8 de 8 en producción»* suma *«(cruzadas por id: son los mismos 8 pagos que llegaron
   por Webhooks, uno a uno)»*. Y la salvedad ⚠️ quedó acotada en el tiempo: *««Sólo `payment`» vale
   para lo medido: desde el 2026-09-25 en producción y el 2026-09-29 en sandbox (suscripciones,
   órdenes y cambios de tarjeta)»*, con el contraste de `RF-7` como estaba.
   - `D/06:270` «(cruzadas por id: son los mismos 8 pagos que llegaron por Webhooks, uno a uno)»
   - `D/06:270` «desde el 2026-09-25 en producción y el 2026-09-29 en sandbox»
4. **Los dos espejos que no son cifra** (`25-` § 3.3, *«para que el owner decida si entran»*)
   **entraron**, por el *«OK entero»* de la elección A: la fila tachada de `WH-5` en §2.7 de la
   descomposición y el 📌 *«Las cuatro que salieron, y cómo»* de `B/06` § 11 suman *«(reabierta el
   2026-09-28, cerrada el 2026-09-29)»*. Si el owner leía A como «las filas» y no esto, son dos
   paréntesis que se sacan sin tocar ninguna cifra.
5. **El ajuste de espacios de las celdas.** Reescribir una fila normaliza a un espacio el borde de
   cada celda; el único efecto visible es que la conclusión de `WH-6` ya no termina en un espacio
   antes del `|`. El diff por palabras de la matriz no borra nada fuera de lo que el lote tacha o
   reemplaza.

## 4. Espejos de las cifras en el texto vivo

Los que lista `25-` § 3.3, con la marca que el lote define (*mediciones de los dos canales*). Las
cifras del log no se movieron, porque el lote no toca decisiones.

| espejo | dónde |
|---|---|
| la matriz en la tabla de documentos | `.specs/HOS-1352-billing-verticals-redesign/spec.md:85` «~~112~~ 114 filas, ~~92~~ ~~93~~ ~~94~~ ~~95~~ 100 cerradas» |
| ídem, el paréntesis | `.specs/HOS-1352-billing-verticals-redesign/spec.md:85` «29/09, mediciones de los dos canales (sondas 52 a 57): cerraron `WH-5`» |
| la FASE 1C en la tabla de fases | `.specs/HOS-1352-billing-verticals-redesign/spec.md:137` «29/09, recontado con el script tras las mediciones de los dos canales: cerraron» |
| el recuento de la matriz de billing | `$B/spec.md:256` «~~112~~ 114 filas — ~~55~~ ~~56~~ ~~55~~ 61 `VERIFIED`» |
| ídem, la entrada del día | `$B/spec.md:257` «el 29/09 cerraron `WH-5`, `WH-6`, `EX-15`, `EX-52` y `EX-53` y entraron `EX-55` y `EX-56`» |
| ídem, las que no tienen fila | `$B/spec.md:257` «`EX-52`, `EX-53` y `WH-6` salieron el 29/09 (mediciones de los dos canales)» |
| el capítulo del proveedor | `B/06:28` «quedan catorce `UNKNOWN` y trece son de este capítulo» |
| lo que sigue `UNKNOWN` | `B/06:408` «Doce de las catorce filas de 114» |
| el 📌 de § 11 | `B/06:436` «(reabierta el 2026-09-28, cerrada el 2026-09-29)» |
| el encabezado de §2.7 | `$B/descomposicion.md:401` «~~(más tres del 2026-09-28 sin unidad)~~» |
| las cifras de §2.7 | `$B/descomposicion.md:405` «~~112~~ 114 filas de la matriz» |
| ídem, la entrada del día | `$B/descomposicion.md:407` «Salieron el 29/09.» |
| la fila tachada de `WH-5` | `$B/descomposicion.md:416` «desde el 2026-09-23 (reabierta el 2026-09-28, cerrada el 2026-09-29)» |

## 5. Lo que queda afuera

1. **Los 10 puntos de `25-` § 4** (N8 en `B/12`, `L3-g` y N9 en `B/06`, la deduplicación de
   `payment` entre canales, el `payment` de ARS 0, el `400` que crea, `payer_id`, la cancelación
   del proveedor sin aviso, los saltos de `version`, el dato lateral de `80a633be…` y la
   confirmación del cobro de única vez): tanda posterior, sin decidir.
2. **`## Qué espera cada decisión` de la matriz** sigue sin nombrar `EX-52` ni `EX-53` (`25-` § 4,
   punto 1), y la tabla `## Composición` sigue congelada en 84. No son espejos de este lote.
3. **`03-handoff.md`** no se tocó: lo actualiza el owner (`15-` § 3).
4. **El script de conteo sigue sin ignorar lo tachado** (`25-` § 0.2). Hoy cuenta bien porque
   ninguna celda de estado tiene un estado de mayor prioridad tachado; arreglarlo pide su propio
   OK.
5. **Lo que `25-` § 5 deja abierto** (la clave de firma de IPN, el destino del reintento tras
   cambiar la URL, la sonda 54, la escalera completa, los sujetos vivos de sandbox y las URL del
   panel) sigue en manos de quien dice esa tabla.

## Key Learnings

1. Un lote que cita un ancla de un anexo **todavía no escrito** se desalinea cuando el anexo se
   escribe con otro título: antes de aplicar hay que comparar cada `#ancla` del lote contra los
   encabezados reales del archivo citado.
2. Extraer los bloques `text` del lote por posición, con aserciones sobre el texto que cada celda
   tenía antes, deja el diff de contenido en cero por construcción y hace fallar el script, no la
   matriz, si el archivo se movió desde que se escribió el lote.
3. Un veredicto *«sólo X»* se escribe con su ventana de medición (fechas y entorno), no como
   propiedad del canal, cuando otra fila `VERIFIED` ya vio lo contrario fuera de esa ventana.
