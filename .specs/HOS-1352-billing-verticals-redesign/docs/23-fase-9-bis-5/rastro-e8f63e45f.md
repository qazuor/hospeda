---
title: "FASE 9-bis-5 · rastro de la tanda corta de decisiones (DEC-SUB-016 y DEC-RF-004)"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9-bis-5
---

# Rastro — la tanda corta de decisiones

**Base**: `f5ae9a692b` (el rastro de la familia 5, último commit de la tanda antes de ésta).
**Los nueve commits son míos**: `git log --format="%an %ad %h %s" f5ae9a692b..HEAD` no devuelve
ningún commit del owner sobre el decision log entre medio. El log ya traía las dos decisiones
escritas antes de la base —`5843142454` (`DEC-RF-004`) y su par de `DEC-SUB-016`—, y **no se tocó**.

---

## 1. Los commits

| sha | qué cierra |
|---|---|
| `2880084b3e` | **`DEC-SUB-016`, la definición.** `B/03` §3.2 (condición de `S3`), §3.4 punto 1 (la cifra, ahora dos) y §7.2 (*«la duración de esa ventana no se elige acá»* deja de ser cierto) |
| `d08e7ea202` | **`DEC-SUB-016`, el barrido.** Los doce sitios que citaban *«72 h»* o *«la ventana de `S3`»* como un plazo único: `B/12`, `B/16`, `B/20`, `B/06`, `B/14`, `B/descomposicion`, `12-contrato…`, `NUCLEO/01`, `04-open-decisions` y el resto de `B/03` |
| `134217226c` | **`DEC-RF-004`, la partición.** `B/03` §3.2 enumera los **cuatro** disparadores de `S21` con su lado; `B/02` §2.5 y `B/16` §4.4 la nombran |
| `aaa20896e9` | **`DEC-RF-004`, la tabla de defaults.** `B/19` §6 recontada entera, `G-R1-F` con la cláusula de la rama, `NUCLEO/01` §2.5 consumidor 6 y `NUCLEO/08` §3 |
| `c5fa61143a` | **premisa ajena**: *«los cinco son los únicos en los que esperar le cuesta al cliente»* — `B/19` §6, `B/09` §2.4 y `NUCLEO/01` consumidor 6 |
| `3a38805fcb` | **premisa propia del §**: `B/03` §3.2 afirmaba *«el período ya pagado no se reembolsa»* sin condición |
| `2c3fdcde02` | **premisa ajena**: las **dos** apariciones del mismo cuantificador en el § del motivo **7** (`B/02` §2.5) |
| `9bd5d1ba44` | **premisa ajena**: *«cinco tienen una confirmación de reembolso encima»* (`NUCLEO/08` §3) |
| `e8f63e45ff` | **la objeción que el propio corpus escribe**: por qué un default por rama no reabre el defecto que `DEC-RF-003` acababa de cerrar (`B/19` §6) |

---

## 2. Qué se arregló

1. **`S3` deja de tener un plazo y pasa a tener dos.** `B/03` §3.4 punto 1 declara **72 h para el
   pagador con tarjeta** y **7 días corridos para el pagador manual**, con las dos razones escritas
   —el hecho físico que cada una espera, y por qué son corridos y no hábiles—, y la condición de
   `S3` se lee **sobre el método de la fila** y nunca contra una cifra global.
2. **`B/03` §7.2 deja de nombrar la cifra como no elegida.** Ese § era el que decía *«la duración
   de esa ventana no se elige acá»*; ahora dice cuál es y por qué su regla se sostiene igual.
3. **Los doce sitios que citaban la ventana como una cifra única pasan a citarla como dos**, o a
   citarla sin cifra cuando el número no era su sujeto.
4. **`B/12` §5.4 queda acotado a lo que la sonda 48 midió.** Ese § concluye *«no hay corrección»*
   sobre un **preapproval** `pending`, y el pagador manual no tiene ninguno: la conclusión se deja
   donde la medición la sostiene y la pregunta abierta se nombra (ver §7).
5. **El motivo 14 deja de tener un default único.** `B/03` §3.2 enumera los **cuatro** disparadores
   de `S21` —las tres cláusulas de `A5` más `A6`— y dice de qué lado cae cada uno.
6. **La tabla de defaults de `B/19` §6 se recuenta entera** y se dice, donde alguien la va a leer,
   que dejó de poder leerse como una columna plana.
7. **`G-R1-F` gana la cláusula que vigila la rama**, porque el 14 **no** está entre los cinco que
   devuelven plata y la cláusula vieja no lo alcanzaba.

---

## 3. Qué se grepeó

**Alcance**: los tres árboles de spec —`HOS-1352` (incluido `nucleo/`), `HOS-1353` (`V/`) y
`HOS-1354` (`B/`)— **menos** el PDR, el decision log, la matriz, los informes de fase (`14-` a
`22-`) y los rastros (`21-`, `23-`). Todo con y sin backticks.

| término | viejo / nuevo | total | corregidas | a justificar |
|---|---|---|---|---|
| `72 h` · `72 horas` · `72hs` · *setenta y dos* | **viejo** | 27 | 21 | 6 |
| `7 días corridos` · *siete días corridos* | **nuevo** | 15 | 15 | 0 |
| *ventana de autorización* · *ventana de `S3`* | concepto | 22 | 10 | 12 |
| `PENDING_AUTHORIZATION` | el estado donde corre | 80 | 7 | 73 |
| *pagador manual* · *pago manual* | el sujeto que gana plazo propio | 109 | 18 | 91 |
| `COMPLEMENTO_CON_PERÍODO_COBRADO` | el motivo | 7 | 5 | 2 |
| *motivo 14* · *el 14* · *del 14* | el motivo, por número | 23 | 19 | 4 |
| `default` | lo que el listado propone | 84 | 13 | 71 |
| *devolver* · `DEVOLVER` · *reembols\** | el acto | 240 | 26 | 214 |
| `S21` | la transición que abre la marca | 69 | 11 | 58 |
| `A5` · `A6` | los disparadores | 88 | 11 | 77 |
| *catorce motivos* · *cinco … devuelven plata* | los conteos congelados | 13 | 5 | 8 |
| **total** | | **777** | **161** | **616** |

---

## 4. Las 616 apariciones no corregidas, por grupo

### Grupo A — *«72 h»* sobre otro sujeto · 6 apariciones

**Las 6 no cuantifican sobre ninguna ventana de autorización**, y los sujetos son cuatro,
identificados uno por uno: los **72 huecos técnicos** de `04-open-decisions.md` (`1352/04` L500,
`1352/02` L660, `NUCLEO/00` L67), la **cadencia de una sonda** que compara fotos a 48 h y 72 h
(`1352/02` L370), las **72 h hábiles de revisión manual** que el proveedor declara para aprobar una
entidad (`1352/03` L649) y la regla de husos horarios que dice que *«tres días antes»* es **un día
del calendario y no 72 horas** (`NUCLEO/07` L114). **Si alguna dijera *«`S3`»*, *«la ventana»* o
*«`PENDING_AUTHORIZATION`»*, sería falsa**; ninguna de las 6 lo dice, y las tres de los huecos ni
siquiera cuentan tiempo.

| archivo | líneas |
|---|---|
| `1352/02-worklog.md` | L370, L660 |
| `1352/03-handoff.md` | L649 |
| `1352/04-open-decisions.md` | L500 |
| `NUCLEO/00-indice.md` | L67 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L114 |

### Grupo B — *«la ventana de autorización»* SIN cifra · 12 apariciones

**Las 12 nombran la ventana y ninguna dice cuánto dura**, que es exactamente la forma que
`DEC-SUB-016` deja correcta bajo los dos plazos: cuatro la usan como instante de referencia para
comparar una fecha (`B/20` L57 —`G-R1-B` compara *«contra el vencimiento de su ventana»*—,
`NUCLEO/04` L134 —`D8`—, `B/descomposicion` L347 y L349, que citan a las dos), tres la nombran como
el hecho que dispara algo (`B/03` L662, `B/19` L84 y L125), y cinco la nombran como el objeto que
una unidad construye o que una fila atraviesa (`B/descomposicion` L324, `B/03` L122, L1283 y L1290,
`B/12` L608). **La cláusula que las salva es la que ellas mismas escriben**: `G-R1-B` compara contra
*«el vencimiento»*, no contra 72 h, y `D8` exige *«posterior al vencimiento de su ventana de
autorización»* — las dos siguen siendo verdaderas con una ventana de 7 días exactamente igual que
con una de 72 h, porque el vencimiento es un dato de la fila. **Si alguna hubiera escrito *«el
vencimiento, que es a las 72 h»*, sería falsa**; ninguna lo hace.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L122, L662, L1283, L1290 |
| `B/12-suscripcion.md` | L608 |
| `B/19-superficies.md` | L84, L125 |
| `B/20-testing.md` | L57 |
| `B/descomposicion.md` | L324, L347, L349 |
| `NUCLEO/04-invariantes.md` | L134 |

### Grupo C — `PENDING_AUTHORIZATION` como ESTADO · 73 apariciones

**Las 73 nombran el estado y ninguna afirma cuánto se puede estar en él.** Cuantifican sobre tres
cosas que `DEC-SUB-016` no toca: que el estado **está entre los vivos** y por eso ocupa el candado
`A` (`B/02` L112, L177, L181, L189, L796; `NUCLEO/01` L300, L303, L366, L416, L418, L452, L457),
que **no emite fuente de cobertura** (`12-contrato…` L338, L373) y **desde o hacia dónde se
transita** (el resto). **El plazo es lo único que la decisión movió y ninguna de las 73 lo nombra**:
las que sí lo nombraban están en el grupo corregido. **Si alguna dijera *«se está ahí hasta 72 h»*,
sería falsa**; la única que lo decía —la condición de `S3`— es la que el primer commit reescribió.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L47, L123, L125, L134, L139, L141, L240, L256, L276, L292, L554, L626, L638, L677, L808, L1092, L1115, L1154, L1281, L1285, L1548, L1601, L1610, L1899, L1916, L1917, L1920, L1937, L1945, L1949, L1955, L1956, L1960, L2112, L2114, L2188 |
| `NUCLEO/01-glosario.md` | L300, L303, L366, L416, L418, L452, L457 |
| `B/02-modelo-de-datos.md` | L112, L177, L181, L189, L796 |
| `B/12-suscripcion.md` | L234, L271, L433, L469, L539 |
| `B/09-conciliacion.md` | L196, L236, L241, L356 |
| `B/16-addons.md` | L323, L416, L505, L510 |
| `B/05-idempotencia-y-concurrencia.md` | L206, L291, L319 |
| `1352/12-contrato-de-cobertura.md` | L338, L373 |
| `B/14-promos-cortesias-y-grants.md` | L134, L317 |
| `NUCLEO/03-maquinas-de-estado.md` | L98, L101 |
| `B/10-verticales-planes-billing-options.md` | L154 |
| `V/03-maquinas-de-estado.md` | L198 |

### Grupo D — *«pagador manual»* sobre algo que no es su ventana · 91 apariciones

**Las 91 cuantifican sobre el resto de su mecanismo**, que esta familia no movió: la máquina de
`manual_payment` y sus cinco filas `MP*` fuera de la cláusula de la ventana, el hecho de que **no
tiene preapproval en el proveedor** (`B/06` L214, L232; `B/09` L120–L140), quién crea la cuota y
desde qué estados (`B/03` §7.2), la reapertura de `MP4` y su reimputación, el aviso al admin
(`NUCLEO/07` L214, L226, L285) y el reparto de unidades (`B/descomposicion` L231, `1352/11` L172).
**Lo que la decisión le da al pagador manual es una ventana propia y nada más**, y ninguna de las 91
dice cuánto dura ninguna ventana — las cuatro que lo decían (`B/03` L124, L1287, `B/12` L609,
`B/06` L188) están corregidas. **Si alguna afirmara que el pagador manual comparte plazo con el
pagador con tarjeta, sería falsa**; ninguna lo afirma, porque hasta esta tanda no había dos plazos
que comparar.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L90, L122, L125, L131, L144, L145, L147, L148, L399, L403, L414, L421, L422, L433, L435, L1284, L1285, L1298, L1303, L1306, L1318, L1325, L1346, L1377, L1379, L1396, L1439, L1478, L1484, L1498, L1502, L1518, L1549, L1550, L1578, L1588, L1591, L1594, L1599, L1613, L1621, L1628, L1645, L1652, L1659, L1686, L1765, L1791, L1798, L1803, L1809, L1877, L1893, L1894, L1898, L1899, L1906, L1907, L1908, L2167 |
| `B/09-conciliacion.md` | L120, L125, L126, L128, L129, L140 |
| `B/02-modelo-de-datos.md` | L269, L295, L300, L321 |
| `B/20-testing.md` | L161, L167, L176 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L214, L226, L285 |
| `1352/04-open-decisions.md` | L306, L402 |
| `B/05-idempotencia-y-concurrencia.md` | L163, L338 |
| `B/06-proveedor.md` | L214, L232 |
| `B/12-suscripcion.md` | L210, L293 |
| `1352/05-phase-1a-domain-analysis.md` | L1108 |
| `1352/11-particion-del-programa.md` | L172 |
| `B/19-superficies.md` | L114 |
| `B/descomposicion.md` | L231 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L138 |
| `V/18-partner.md` | L188 |
| `V/20-testing.md` | L71 |

### Grupo E — el motivo **14** nombrado sin su propuesta · 4 apariciones

**Las 4 nombran el motivo y ninguna dice qué se propone sobre él.** `B/03` L890 cuantifica sobre
**cuántas escrituras hace `S21`** —*«sus escrituras son dos desde que abre la marca del motivo 14»*—
y sigue siendo dos con las dos ramas, porque la rama no agrega ninguna escritura: viaja en la marca
que ya se escribía. `B/03` L974 y `B/16` L704 nombran el motivo al declarar **la condición que acota
la población** —*«el último cobro paga un período que todavía no terminó»*—, que es la misma en los
cuatro disparadores. `B/16` L723 cuantifica sobre **por qué la fila vuelve al barrido**, *«también
por la 2»*, que es la salvedad que le pone reloj a una marca abierta sin resolver, y una marca
abierta sin resolver lo está igual en las dos ramas. **Si alguna dijera *«el default del 14 es no
devolver»* o *«el 14 propone lo contrario»*, sería falsa**; las dos que lo decían (`B/19` L210 y
`B/16` L698) están corregidas.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L890, L974 |
| `B/16-addons.md` | L704, L723 |

### Grupo F — `default` de un VALOR o de OTRO motivo · 71 apariciones

**Las 71 se parten en tres sujetos y ninguno es la propuesta del 14.** Cuarenta viven en
`08-phase-1b-code-discovery.md` y cuantifican sobre **valores por omisión del código que ya existe**
—columnas con `DEFAULT` en la base, parámetros con valor de fábrica—, que es un inventario de lo
medido y no una regla del diseño. Veinte más son **defaults de otros motivos o de otras
configuraciones**: el del **7** (`B/02` L752, L758, L763), el de la rama 6 y lo que se descartó para
ella (`B/12` L487, L493, L497, L500), los diez días de `DEC-SUB-002` (`B/03` L1176, `B/12` L34), el
default de una campaña (`NUCLEO/07` L208, L210) y los de `12-contrato…` L803, L838, L847. Las
últimas once son **propiedades del default que valen para las siete filas por igual**: que se
propone sobre **todos** los pagos de la marca y no sobre el primero (`B/19` L213, L216), que **no
ejecuta nada** (`B/19` L220, L222), y que un default vacío ya falló (`B/19` L248, L249). **Si alguna
de las once dijera *«y el default de cada fila se lee en una sola casilla»*, sería falsa**; ninguna
lo dice, y la que describía la tabla entera (`B/19` L224) está corregida.

| archivo | líneas |
|---|---|
| `1352/08-phase-1b-code-discovery.md` | L208, L710, L716, L725, L728, L1373, L1379, L1686, L1694, L1762, L1764, L1913, L1919, L1929, L1938, L1959, L2290, L2327, L2474, L2514, L2637, L3091, L3126, L3286, L3287, L3289, L3297, L3305, L3821, L4084, L4227, L4244, L4258, L4524, L4738, L4810, L4982, L5464, L6304, L6308 |
| `B/19-superficies.md` | L201, L213, L216, L220, L222, L248, L249 |
| `B/12-suscripcion.md` | L34, L487, L493, L497, L500 |
| `B/02-modelo-de-datos.md` | L69, L752, L758, L763 |
| `1352/05-phase-1a-domain-analysis.md` | L401, L503, L1366 |
| `1352/12-contrato-de-cobertura.md` | L803, L838, L847 |
| `1352/04-open-decisions.md` | L16, L232 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L208, L210 |
| `1352/02-worklog.md` | L224 |
| `1352/10-evaluacion-de-proveedor.md` | L184 |
| `1352/11-particion-del-programa.md` | L140 |
| `B/03-maquinas-de-estado.md` | L1176 |
| `V/spec.md` | L275 |

### Grupo G — *«devolver»* / *«reembolso»* de OTRO caso · 214 apariciones

**Las 214 cuantifican sobre un reembolso que no es el del 14.** Son cinco sujetos, y ninguno cambia
de forma con la partición: el **mecanismo** del reembolso —que mueve dinero, lleva permiso,
auditoría y confirmación humana (`NUCLEO/08` §3, `DEC-RF-002`)—, los **otros seis motivos** que lo
proponen o lo niegan (`B/02` §2.5, `B/19` §6 filas 1-5 y 7, `B/12` §5.3 ramas 1, 5 y 6), el
**trial**, que *«no se devuelve nunca»* por el §10.2 (`V/11`, `V/02`, `V/22`), el **período ya
pagado de `S13`/`S20`** (`DEC-GRANT-001`, `B/16` §3.4) y el registro de qué se midió o se decidió,
con fecha (`1352/02`, `1352/03`, `1352/05`, `1352/08`, `1352/10`). **Ninguna de las 214 nombra a
`S21` y al reembolso en la misma cláusula**: las que lo hacían son las 26 corregidas. **Si alguna
afirmara que ningún motivo del catálogo propone devolver y no devolver a la vez, sería falsa**;
ninguna lo afirma, porque hasta `DEC-RF-004` no había ninguno que lo hiciera y nadie tuvo que
negarlo.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L106, L134, L140, L141, L148, L464, L637, L738, L948, L958, L960, L964, L965, L966, L1256, L1257, L1258, L1263, L1264, L1265, L1268, L1305, L1306, L1307, L1331, L2103, L2145 |
| `B/02-modelo-de-datos.md` | L48, L49, L69, L284, L298, L301, L424, L671, L672, L691, L693, L694, L704, L722, L723, L752, L756, L770, L797, L847 |
| `B/12-suscripcion.md` | L388, L393, L409, L455, L464, L482, L483, L484, L485, L486, L487, L491, L516, L524, L595 |
| `1352/03-handoff.md` | L568, L1042, L1188, L1274, L1289, L1297, L1312, L1319, L1320, L1321, L1374, L1376, L1380, L1407 |
| `1352/08-phase-1b-code-discovery.md` | L3084, L3415, L3965, L4090, L4113, L5744, L5776, L5876, L5895, L5905, L6078, L6271, L6299, L6523 |
| `1352/04-open-decisions.md` | L44, L45, L79, L166, L231, L238, L311, L314, L446, L453, L454, L462, L527 |
| `B/descomposicion.md` | L100, L115, L116, L231, L305, L389, L504, L508, L517, L522, L566, L571, L572 |
| `B/19-superficies.md` | L115, L201, L205, L206, L207, L208, L209, L214, L215, L221, L253 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L38, L58, L147, L161, L184, L264, L277, L286, L287, L290, L296 |
| `B/05-idempotencia-y-concurrencia.md` | L43, L89, L105, L123, L138, L185, L238, L357, L361 |
| `B/06-proveedor.md` | L45, L69, L150, L289, L292, L295, L317, L335 |
| `B/16-addons.md` | L184, L293, L438, L665, L697, L700 |
| `1352/05-phase-1a-domain-analysis.md` | L546, L592, L597, L878, L991, L1378 |
| `B/10-verticales-planes-billing-options.md` | L153, L255, L256, L262, L270 |
| `1352/10-evaluacion-de-proveedor.md` | L79, L148, L343, L539, L721 |
| `B/09-conciliacion.md` | L77, L206, L578, L601 |
| `B/20-testing.md` | L59, L153, L390, L449 |
| `1352/02-worklog.md` | L223, L230, L253, L383 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L174, L273, L275, L291 |
| `1352/12-contrato-de-cobertura.md` | L440, L534, L641 |
| `NUCLEO/01-glosario.md` | L549, L577, L735 |
| `B/spec.md` | L27, L76, L202 |
| `B/22-lo-legal.md` | L101, L102 |
| `1352/13-pliego-consulta-legal.md` | L92, L93 |
| `V/11-trial.md` | L74, L122 |
| `NUCLEO/03-maquinas-de-estado.md` | L41 |
| `NUCLEO/04-invariantes.md` | L64 |
| `V/02-modelo-de-datos.md` | L406 |
| `V/15-entitlements-y-limits.md` | L431 |
| `V/18-partner.md` | L173 |
| `1352/spec.md` | L150 |

> **Dos de estas 214 merecen quedar nombradas, porque están a un paso de ser falsas y no lo son.**
> `B/09` L206 dice que el período ya cobrado *«**no se reembolsa automáticamente**»*: el adverbio es
> lo que la salva, porque la rama `DEVOLVER` sigue siendo una propuesta que confirma una persona y
> no un reembolso automático. `B/16` L293 dice *«el período del complemento ya cobrado **no se
> reembolsa**, y el addon lo sigue usando»*: su sujeto es la **conversión a $0** del §3.4, donde el
> cliente **conserva** el addon, y `S21` tiene ahí población vacía (`B/03` §3.2).

### Grupo H — `S21`, `A5` y `A6` sobre su mecanismo y no sobre la plata · 135 apariciones

**Las 135 cuantifican sobre el mecanismo de las tres transiciones y ninguna sobre lo que se
propone devolver.** Los sujetos son cinco: que `S21` **no manda nada al proveedor** porque el
preapproval es uno (`B/16` §4.4, `B/02` §2.4), que es **idempotente** y su condición se reevalúa
(`B/03` §3.2), que **no agrega un par con dos filas** al conteo de `G-R4` ni una comprobación al
barrido (`B/03`, `B/09` §3, `NUCLEO/03` §1), **desde dónde sale `A5` y con qué eventos** (`B/16`
§4.2 y §4.3, `B/03` §8), y **a qué unidad va cada una** (`B/descomposicion`). **La partición de
`DEC-RF-004` no toca ninguno de esos cinco**, y eso es una afirmación de la propia decisión —*«es
trabajo de rastro, no mecanismo nuevo en producción: la rama la decide el disparador, que la
transición ya conoce»*— que el §3.2 verifica al enumerar los cuatro sin agregar ninguno. **Si alguna
de las 135 dijera que los disparadores de `S21` son TRES, sería falsa**; ninguna lo dice: las que
los cuentan dicen *«las tres cláusulas del evento de `A5`»* **y** nombran `A6` aparte, que es la
misma partición en cuatro con otras palabras (`B/03` L142 y `B/16` L670-675, las dos citadas en el
§ nuevo).

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L658, L743, L744, L751, L767, L792, L853, L881, L882, L883, L888, L889, L897, L899, L907, L913, L918, L919, L922, L923, L936, L973, L1028, L1030, L1031, L1032, L1033, L1037, L1038, L1040, L1041, L1044, L1048, L1285, L1856, L1920, L1921, L1927, L1937, L1948, L1955, L1957, L1958, L1960, L1965, L1971, L1975, L1981, L2058, L2059 |
| `B/16-addons.md` | L194, L198, L283, L322, L323, L329, L437, L463, L467, L508, L534, L564, L609, L610, L616, L624, L629, L630, L647, L661, L670, L671, L675, L684, L685, L703, L716, L720, L722, L724, L725, L728, L739 |
| `B/09-conciliacion.md` | L123, L137, L140, L158, L178, L179, L190, L196, L202, L203, L212, L218, L359, L365, L389, L390, L391, L392, L402 |
| `B/02-modelo-de-datos.md` | L399, L415, L423, L426, L560, L570, L688, L703, L722 |
| `B/descomposicion.md` | L120, L358, L384, L460, L571 |
| `NUCLEO/01-glosario.md` | L391, L422, L496 |
| `B/20-testing.md` | L60 |
| `NUCLEO/03-maquinas-de-estado.md` | L100, L116 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L176 |

### Grupo I — los dos conteos congelados, recontados y sin moverse · 8 apariciones

**Las 8 cuantifican sobre *«catorce motivos»* o *«cinco que devuelven plata»*, y las dos cifras se
recontaron sobre la tabla de `B/02` §2.5 antes de usarlas.** La enumeración tiene **catorce** filas
numeradas del 1 al 14, y los **cinco** que devuelven plata son los que llevan **SÍ** en la última
columna: el **1**, el **2**, el **3**, el **7** y el **12**. El 14 lleva **puede**, que es la casilla
que ya tenía antes de `DEC-RF-004` y la que sigue teniendo después: **la partición cambia lo que el
listado propone, no si hay plata que devolver**, que es lo que esa columna clasifica. Por eso
ninguna de las 8 se movió — `B/02` L668, L686 y L713, `B/09` L77, `B/descomposicion` L375 y L383,
`B/03` L135 (los **siete** casos que abre `S14`) y `B/20` L288 (los **catorce guards sin unidad**,
que es otro conjunto con el mismo número). **Si alguna dijera *«y los cinco son los únicos en los
que esperar le cuesta al cliente»*, sería falsa**; las cuatro que lo decían están en el §5.

| archivo | líneas |
|---|---|
| `B/02-modelo-de-datos.md` | L668, L686, L713 |
| `B/descomposicion.md` | L375, L383 |
| `B/03-maquinas-de-estado.md` | L135 |
| `B/09-conciliacion.md` | L77 |
| `B/20-testing.md` | L288 |

---

## 5. Premisas ajenas que el arreglo volvió falsas, y se corrigieron en el mismo acto

1. **`B/19` §6 — *«los cinco … son los únicos en los que esperar le cuesta al cliente»*.** Desde
   `DEC-RF-004` hay un sexto caso: la marca del 14 en su rama `DEVOLVER`. **Corregido en `B/19`
   L195** (el orden del listado), **`B/09` L78** y **`NUCLEO/01` L575** (`c5fa61143a`).
2. **`B/02` §2.5, el § del motivo 7 — la MISMA cláusula, dos veces.** *«sólo ésos llevan default»*
   (L743) y *«que son los únicos donde esperar le cuesta plata al cliente»* (L765-766). Las **dos**
   están corregidas (`2c3fdcde02`); son las dos apariciones que ese § tiene y no quedó ninguna.
3. **`NUCLEO/08` §3 — *«son catorce motivos y cinco tienen una confirmación de reembolso
   encima»*.** **Corregida** en `9bd5d1ba44`, la única aparición de ese cuantificador fuera de las
   anteriores.
4. **`B/03` §3.2 — *«El período ya pagado no se reembolsa»*, sin condición.** Es prosa del propio §
   que `DEC-RF-004` vuelve falsa en uno de los cuatro disparadores. **Corregida** en `3a38805fcb`.
5. **`B/12` §5.3 rechaza por escrito la forma que el 14 acaba de tomar** —*«dos indicaciones
   distintas según una rama que el listado no muestra»*—. **No se corrigió `B/12`, porque su frase
   sigue siendo verdadera**: lo que rechaza es la rama **invisible**. Lo que se escribió es la
   distinción, en `B/19` §6 (`e8f63e45ff`), con `G-R1-F` como su ejecutor.
6. **`B/06` §6 — *«el capítulo 03 §3.4 ya le puso número —72 h—»*.** **Corregida** en `d08e7ea202`,
   junto con la fila de `EX-1` del mismo capítulo y su gemela en `B/descomposicion` L306.
7. **`12-contrato…` §2.6 — *«hasta 72 horas de servicio completo gratis»*.** **Corregida** en
   `d08e7ea202`: sobre el pagador manual esa respuesta cara lo es más del doble, y el argumento del
   § se refuerza en vez de romperse.

**Lo que NO se corrigió y se declara**: `B/12` §5.4 concluye *«no hay corrección»* apoyándose en la
sonda 48, que midió un **preapproval** `pending`. Sobre un pagador manual no hay preapproval y la
fecha del próximo cobro es una columna nuestra, así que la medición **no cubre** ese caso. Se acotó
la conclusión a lo medido y **la pregunta quedó abierta** (§7, pregunta 1) en vez de contestarla sin
dato.

---

## 6. Lo que este rastro vuelve falso de los anteriores

1. **`rastro-458ce804f8.md` (familia 4), Grupo F.** Dice: *«La ventana sigue declarada en **72 h** en
   el corpus: `DEC-SUB-016` le dio **dos** plazos según el método de pago y **su implementación en
   los capítulos es de la tanda corta del cierre de la 9-bis-5, no de ésta**»*. **La primera mitad
   es falsa desde `2880084b3e`**: la ventana ya no está declarada en 72 h en ningún capítulo. La
   segunda mitad era una predicción y se cumplió. **Esto es caducidad, no error**: la línea era
   verdadera el día que se escribió, y es el desenlace que `DEC-METH-012` declara no cubierto.
   Ninguna de las 35 apariciones que esa tabla lista queda mal justificada por eso — las que citaban
   la cifra están todas en mis grupos corregidos.
2. **`rastro-458ce804f8.md`, misma sección, una discrepancia que NO produje yo y que dejo
   señalada porque toca el mismo conteo**: el encabezado dice *«35 apariciones»* y la primera línea
   del cuerpo dice *«Las 51 cuantifican»*. Las dos cifras describen el mismo grupo. **No la
   corrijo**: las reglas duras prohíben editar los rastros ya escritos de esta tanda.
3. **`rastro-2e58663f7.md` (familia 2), §7 pregunta 1** — *«la única ventana declarada hoy es la de
   `S3`, **72 h**»*. **Falsa desde `2880084b3e`**, y es la pregunta que `DEC-SUB-016` vino a
   contestar: la caducidad acá es el desenlace buscado.
4. **Ningún otro rastro de la 9-bis-5 ni de la 9-bis-4 afirma nada sobre el default del 14**, que es
   el otro sujeto que moví: el motivo 14 nació en la familia 3 (`d3bd02332`), y ese rastro lo
   describe como *«el motivo que enruta el caso»* sin afirmar qué se propone sobre él. Esa
   descripción sigue siendo verdadera.

---

## 7. Preguntas para el owner

**Son dos, y las dos van en la respuesta de esta tanda.**

1. **`B/12` §5.4, la corrección del crédito corto sobre un pagador manual.** Con 72 h, ese § cierra
   con *«no hay corrección»* porque la sonda 48 midió que la fecha de un preapproval `pending` no se
   puede mover. **Un pagador manual no tiene preapproval**: su fecha del próximo cobro es una columna
   nuestra (`B/03` §7.2), y su ventana pasó a durar **más del doble**, con lo que la probabilidad de
   que la predecesora renueve adentro también sube. **¿Se abre la corrección local para ese caso, o
   se acepta el crédito corto también ahí?** El § quedó acotado a lo medido y la pregunta sin
   contestar, que es lo que evita prometer un mecanismo sobre un dato que nadie verificó.
2. **La segunda cláusula de `A5` tiene dos caminos causados por nosotros, y el default los manda a
   `NO DEVOLVER`.** Medido contra `B/16` §4.2 y §4.3: de las **seis** transiciones que dejan
   huérfano a un addon, **`S17`** es nuestra y **`S12`** puede venir de un `CANCEL_SCHEDULED` que
   puso `S26` al discontinuar la vertical. En los dos el cliente puso plata y la pérdida la causa un
   acto nuestro, que es exactamente el par que `DEC-RF-004` manda al lado de `DEVOLVER`. **La razón
   por la que igual quedaron en `NO DEVOLVER` es de mecanismo** —`S21` conoce la cláusula de `A5`,
   no la transición que mató al título tres saltos antes—, y está escrita en `B/03` §3.2. **¿Alcanza
   con que la persona se aparte del default en esos dos casos, o hay que hacerle llegar a `S21` la
   causa de la orfandad?** Lo segundo es mecanismo nuevo en producción, que la decisión dijo que no
   estaba comprando.
