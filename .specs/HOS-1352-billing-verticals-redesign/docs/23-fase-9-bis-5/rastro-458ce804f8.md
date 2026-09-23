---
title: "FASE 9-bis-5 · rastro de la familia 4 — la cortesía diferida"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9-bis-5
---

# Rastro de la familia 4 — la cortesía diferida

Implementa **`DEC-GRANT-011`** (el saldo que nadie completó) y **`DEC-GRANT-012`** (la cortesía se
muestra con su condición), y cierra los defectos **`E2`** (`MEDIA`) y **`F3`** (`ALTA`) del censo de
la FASE 8-bis-5. **Dieciséis commits sobre el corpus de diseño**, más el de este rastro, sobre **trece**
archivos.

---

## 1. Los commits

| sha | qué cierra |
|---|---|
| `548ff6aef7` | **`DEC-GRANT-011`** — `courtesy_grant` gana `saldo_cerrado_en` y `motivo_cierre`, las dos anulables y escritas juntas |
| `7946114aff` | **`DEC-GRANT-011`** — **`S3`** cierra el saldo al mandar la sucesora a `ABANDONED`, y dice por qué no alcanza al de `S25` |
| `77d2d95b3b` | **`DEC-GRANT-011`** — *«cortesía diferida»* se estrecha a *«saldo no nulo **y sin cerrar**»*, y su inventario suma dos consumidores |
| `f0b19217b1` | **`DEC-GRANT-011`** — la **sexta** comprobación deja de perseguir un saldo cerrado, y el recuadro que declaraba el caso abierto dice quién lo cierra |
| `27ba3c54bb` | **`DEC-GRANT-011`** — la tabla del enrutado de `NUCLEO/08` §3 gana el cierre y se recuenta entera |
| `2e28904a67` | **`DEC-GRANT-011`** — `G-R1-F` gana dos predicados: cerrar sin las dos columnas, y cerrar desde un acto que la enumeración no nombra |
| `14ba191b97` | **`DEC-GRANT-012`** + el hueco de `DEC-SUB-016` — `B/19` §3.1 (qué se muestra) y la **fila 18** del §4 (qué se avisa), que son un aviso porque son un mismo instante |
| `8e9fe5248f` | **`DEC-GRANT-012`** — el catálogo de correos gana su fila, con la fecha de esa persona y no el plazo |
| `4df8b55f2d` | **`E2`** — un grant sobre una cortesía **diferida** cierra su saldo, con motivo propio y las dos confirmaciones diciéndolo |
| `a577de930e` | **`F3`** — la discontinuación gana `S26`, `S27` y `S28`, y el § que explica por qué son tres |
| `3075b5a84d` | **`F3`** — el día 0 de `B/10` §4.3 nombra quién ejecuta cada destino |
| `53df8414ce` | **`F3`** — las dos puertas terminales nuevas entran al barrido; tres conteos recontados |
| `4c52873b73` | **`F3`** — la fila 18 y el correo cubren el segundo camino a `ABANDONED`; y por qué las tres filas no mueven los pares con dos filas |
| `dac3debb90` | premisas ajenas: **cinco**, todas del barrido (§5) |
| `458ce804f8` | premisa ajena: el **tercer** lugar donde vive *«la sucesora venció su ventana o la mató `S13`»*, que el barrido de cierre encontró después de corregir los otros dos |

> **Un commit que está en el rango y NO es de esta familia**: `5843142454` (*«el motivo 14 devuelve
> cuando la causa no la puso el cliente»*, `DEC-RF-004`) lo escribió el owner sobre el **decision
> log** entre el cierre de la familia 3 y el arranque de ésta. Toca **un solo archivo y está fuera
> del corpus** —el log lo excluye `DEC-METH-011` por definición—, así que no entra en el barrido de
> abajo ni en su partición. Se nombra para que nadie lo lea como una familia sin rastro.

---

## 2. Qué se arregló

1. **El saldo diferido tiene ahora los dos desenlaces que le faltaban, y los dos se asientan.**
   `DEC-GRANT-007` creó una cortesía que existe y no está corriendo, y la única salida escrita era
   la re-emisión. `courtesy_grant` gana **`saldo_cerrado_en`** y **`motivo_cierre`** —las dos
   anulables, las dos juntas, como las tres de la revocación del grant—, y el motivo es una
   **enumeración cerrada** cuyo trabajo principal es decir **quién no está en ella**.
2. **`S3` cierra el saldo de la sucesora que abandona el checkout.** Misma transición, mismo acto:
   el saldo deja de ser diferido y `S9` no lo puede tomar nunca más. **No alcanza al saldo que
   difirió `S25`**, y no por excepción: una vertical discontinuada **no admite altas**, así que ahí
   no llega a existir la fila en `PENDING_AUTHORIZATION` cuya ventana pueda vencer. Ese saldo sigue
   *«diferido y sin emitir»*, que es lo que `DEC-GRANT-010` declaró y el owner eligió no cerrar.
3. **El término se estrechó en vez de borrarse el dato.** *«Cortesía diferida»* pasa a ser *«saldo
   no nulo **y sin cerrar**»*, porque los **dos** lugares que leen el término para **hacer** algo
   —el segundo disparador de `S9` y la sexta comprobación— seguirían persiguiendo un saldo que ya
   tuvo desenlace. Los días cerrados quedan en la fila porque son el registro de qué se perdió, y el
   aviso los nombra con su número.
4. **La cortesía diferida se muestra con la condición que la activa.** `B/19` §3.1: *«te quedan N
   días, que empiezan a correr cuando completes el pago»*. Las tres mitades de esa frase son la
   decisión: el saldo, la condición, y que la condición sea **completar el pago** — que es
   exactamente el acto que evita la pérdida que `DEC-GRANT-011` acaba de crear.
5. **Los dos huecos de copy se resolvieron con UNA fila, porque son UN instante.** `DEC-SUB-016`
   dejó sin escribir *«qué se le dice a quien se le venció la ventana»* y `DEC-GRANT-012` *«qué se le
   dice cuando el saldo se cierra»*: **la transición que vence la ventana es la que cierra el
   saldo**. Es la fila **18** de `B/19` §4 y su fila propia en el catálogo de correos.
6. **El aviso lleva la FECHA de esa persona y nunca el plazo**, que es como se escribe algo que no
   contradice `DEC-SUB-016` sin adelantarla: esa decisión le dio a la ventana **dos** duraciones
   según el método de pago, y un correo con la fecha de vencimiento de su propio checkout es
   correcto bajo las dos.
7. **`E2`: un grant sobre una cortesía diferida cierra su saldo, y no por preferencia.** La regla de
   `B/14` §4.3 cuantifica sobre *«cortesía **vigente**»* y la ejecuta `S13` cancelando la suscripción
   que la pausaba; sobre una diferida **no hay ninguna**. Recorridas las **dos** rutas de re-emisión
   de `S9`, después de `S13` **ninguna vuelve a matchear** —la sucesora que el `sucedida_por` nombra
   la canceló `S13`, y la predecesora no murió por `S25`— y la sexta comprobación resuelve *«la fila
   que tenía que recibirlo»* con esas mismas dos preguntas. Dejarlo sobrevivir era dejarlo **sin
   dueño, sin vencimiento y sin nadie que lo mire**, palabra por palabra la forma que `DEC-GRANT-011`
   descartó el mismo día.
8. **`F3`: la discontinuación tiene tres filas y no una.** `B/10` §4.3 ordenaba el movimiento y
   ninguna transición numerada lo ejecutaba, así que caía en la marca desde **cuatro** estados. Son
   tres porque **el destino cambia con lo que cada estado emite** (`12-contrato…` §2.6): `ACTIVE` y
   `GRACE_PERIOD` al piso de `CANCEL_SCHEDULED` (`S26`), `SUSPENDED` a `CANCELLED` (`S27`) y
   `PENDING_AUTHORIZATION` a `ABANDONED` (`S28`). Una sola fila con `desde` de cuatro obliga a un
   destino único, y el único que sirve para `ACTIVE` **emite**: le devolvería 60 días de servicio
   gratis a quien dejó de pagar y a quien nunca autorizó.
9. **Las tres contestan lo que el §3 obliga a contestar** —alcanzan a las principales **y** a las de
   complemento, porque `B/10` §4.3 ordena el acto sobre *«cada suscripción de complemento viva en
   ella»*—, **no agregan ningún par con dos filas** —comparten evento y no `desde`, así que `G-R4`
   sigue contando cuatro— y **entran a la unidad `B12`**, que es la dueña del cap. 10.
10. **Los conteos se recontaron enteros, no se les sumó uno**: las transiciones con `desde` de
    conjunto (dos → **cinco**), las salidas de `SUSPENDED` (tres → **cuatro**), las puertas a un
    estado terminal del `B/09` §3 (trece → **quince**) con sus filas *«no»* (diez → **doce**) y la
    salvedad 4 (nueve → **once**), las transiciones que sacan una principal de las filas vivas (diez
    → **doce**), y la tabla del enrutado de `NUCLEO/08` §3 (cuatro → **cinco**).

---

## 3. Qué se grepeó

**Términos NUEVOS que esta familia introduce**: `saldo_cerrado_en` · `motivo_cierre` ·
`VENTANA_DE_AUTORIZACIÓN_VENCIDA` · `GRANT_PERMANENTE_OTORGADO` · `S26` · `S27` · `S28` · *«saldo
cerrado»* / *«cierre del saldo»* / *«cerrar el saldo»*.

**Términos VIEJOS o que se ESTRECHAN**, grepeados aparte porque el consumidor no actualizado no
aparece buscando el nuevo: *«cortesía diferida»* **sin** la condición del cierre · `saldo_días`
como único dato del diferimiento · *«cada suscripción viva que pueda llegar a `CANCEL_SCHEDULED`»* ·
*«ninguna transición numerada lo ejecuta»* · *«la sucesora venció su ventana (`S3`) o la mató
`S13`»* · *«las diez transiciones»* que sacan una principal de las filas vivas · *«trece puertas»* /
*«diez filas no»* / *«nueve de las diez»* · *«las cuatro son actos de sistema»* · *«las tres salidas
de `SUSPENDED`»* · *«la única persona a la que el cierre de la vertical no le llega»*.

**Términos de ANCLA**, los sujetos sobre los que el arreglo se apoya: `courtesy_grant` ·
*«cortesía»* (todas sus formas) · `S3` · `S9` · `S13` · `S18` · `S25` · *«discontinu\*»* ·
`CANCEL_SCHEDULED` · `PENDING_AUTHORIZATION` · `ABANDONED` · *«ventana de autorización»* / *«72 h»* ·
*«piso de 60 días»* / *«60 días»*.

**Alcance**: los **47 archivos** del corpus de diseño —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, la partición, las decisiones abiertas y los documentos
de medición—, construidos con un recorrido de los tres directorios quitando los informes de fase
(`14-…` a `23-…`), el PDR, las probes, **el decision log y la matriz** (que el alcance de
`DEC-METH-011` excluye por definición y que las reglas duras prohíben tocar). Con y sin backticks,
**incluidos los trece archivos que la familia toca**.

**Medido sobre el árbol en `dac3debb90`**: **905** líneas con al menos una aparición; **217** las
tocaron los commits de la familia y **688** no, y son las que van abajo. La partición se calculó con
los rangos `+` de `git diff --unified=0 548ff6aef7~1..dac3debb90` proyectados sobre los bloques
separados por línea en blanco —el párrafo es la unidad que `DEC-METH-011` fija—, no a ojo.

> **Una advertencia sobre el barrido.** *«Cortesía»* y los cinco identificadores de transición son
> los términos más productivos del corpus y los más contaminados: **158 de las 688** apariciones son
> la cortesía **vigente** o la promo —el instrumento de siempre, que esta familia no toca—, **93**
> son documentos de proceso y medición que describen lo que se decidió o se midió, y **tres** usan
> *«discontinuada»* sobre **una API del proveedor**, no sobre una vertical. Van agrupadas y
> nombradas como lo que son.

---

## 4. Las 688 apariciones no corregidas, una por una

### Grupo A — `08-phase-1b-code-discovery.md`, el CÓDIGO DE HOY · 11 apariciones

**Las 11 describen lo que el código hace hoy**, medido en la FASE 1B —`billing_subscriptions`,
qzpay, los servicios de `apps/api`—, y su cuantificador es sobre la implementación existente y
**nunca sobre el diseño de esta tanda**. Ninguna nombra `courtesy_grant`, `saldo_días` ni ninguna de
las transiciones numeradas, que son entidades que **este corpus inventa y el código no tiene**. **Si
alguna dijera que el saldo de una cortesía se cierra, o que existe una transición que discontinúa
una vertical, sería falsa**; ninguna lo dice: las once nombran la cortesía como un concepto de
producto o el estado `cancelled` de MercadoPago.

| archivo | líneas |
|---|---|
| `08-phase-1b-code-discovery.md` | L2259, L2270, L2275, L2276, L2277, L3450, L3461, L3469, L5676, L5696, L6465 |

### Grupo B — la cortesía VIGENTE y la promo, que esta familia no toca · 158 apariciones

**Las 158 cuantifican sobre la cortesía como instrumento que está CORRIENDO** —`PAUSED` con
motivo `COURTESY`, el mecanismo de `DEC-GRANT-003`, su exclusividad de `SUPER_ADMIN`, su cruce con
promos, con la pausa, con el trial y con el cupo— **o sobre la promo**, que comparte capítulo. **Lo
que esta familia movió no es la cortesía vigente**: es el **saldo** de una diferida, que es una
columna que sólo existe entre que su suscripción muere y la siguiente autoriza (`NUCLEO/01` §2.6), y
los dos términos **conviven a propósito** desde `DEC-GRANT-007`. **Si alguna dijera *«la cortesía
diferida»* y afirmara que su saldo sólo puede re-emitirse, habría que releerla**; las recorrí y
ninguna lo hace: las que sí lo dicen son `B/02` §2.4 y §2.6, `B/14` §4.4 y §4.6, `B/09` §3 y
`NUCLEO/01` §2.6, y **las seis están en párrafos que los commits tocaron**.

| archivo | líneas |
|---|---|
| `B/14-promos-cortesias-y-grants.md` | L2, L17, L25, L68, L71, L209, L211, L213, L217, L220, L225, L230, L235, L238, L240, L243, L249, L251, L303, L305, L309, L312, L323, L324, L329, L330, L343, L353, L356, L362, L363, L364, L383, L387, L389, L391, L392, L394, L397, L408, L410, L416, L418, L431, L438, L452, L453, L455 |
| `B/03-maquinas-de-estado.md` | L188, L303, L312, L318, L725, L1162, L1164, L1167, L1168, L1169, L1600, L1621, L1716, L1729, L1731, L1733, L1734, L1736 |
| `B/02-modelo-de-datos.md` | L430, L577, L679, L704, L705, L785, L791, L793, L797, L805, L824 |
| `12-contrato-de-cobertura.md` | L34, L47, L293, L299, L325, L426, L548, L727, L761, L828 |
| `NUCLEO/01-glosario.md` | L199, L203, L226, L320, L479, L516, L615, L671, L727, L773 |
| `B/descomposicion.md` | L199, L246, L343, L375, L376, L496, L497 |
| `V/11-trial.md` | L98, L137, L146, L298, L337, L339 |
| `B/spec.md` | L35, L53, L77, L112, L155 |
| `V/17-autorizacion.md` | L41, L204, L226, L230, L248 |
| `B/20-testing.md` | L31, L107, L119, L120 |
| `V/03-maquinas-de-estado.md` | L47, L60, L103, L191 |
| `V/spec.md` | L41, L255, L280, L284 |
| `B/21-migracion.md` | L50, L129, L133 |
| `V/15-entitlements-y-limits.md` | L279, L347, L446 |
| `B/10-verticales-planes-billing-options.md` | L187, L201 |
| `B/12-suscripcion.md` | L143, L701 |
| `B/16-addons.md` | L171, L493 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L179, L194 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L41, L58 |
| `V/02-modelo-de-datos.md` | L359, L375 |
| `B/06-proveedor.md` | L86 |
| `B/09-conciliacion.md` | L466 |
| `B/19-superficies.md` | L56 |
| `NUCLEO/00-indice.md` | L110 |
| `NUCLEO/04-invariantes.md` | L68 |
| `V/18-partner.md` | L173 |
| `V/20-testing.md` | L31 |
| `V/21-migracion.md` | L95 |

### Grupo C1 — la discontinuación de una vertical, en párrafos que las tres filas no mueven · 23 apariciones

**Las 23 cuantifican sobre el ACTO y sus consecuencias, no sobre qué transición lo ejecuta**: la
regla del §4.2 (*«se deja de cobrar antes de dejar de prestar»*), el piso de 60 días y su fórmula,
los cuatro bordes, el aviso a la pausada, el reloj de retención que arranca ese día, el invariante
`D14` y las referencias cruzadas que dicen *«lo cerró el capítulo 10 §4»*. **`S26`, `S27` y `S28` no
cambian ninguna de esas cosas: las vuelven ejecutables**, que es exactamente lo que `F3` reclamaba.
**Dos merecen decirse enteras porque cuantifican sobre algo que sí se movió y siguen siendo
verdaderas**: `NUCLEO/04` L140 —*«anunciada la discontinuación, no se emite un cobro más en ella»*—
**sigue siendo cierta y recién ahora tiene quién la cumpla**, porque las tres filas cancelan el
preapproval en el proveedor; y `B/10` L275 —*«lo que no pasa es que el reloj del grace la empuje a
`SUSPENDED` por efecto de la discontinuación»*— **sigue siendo cierta sin cláusula nueva**, porque
`S26` saca la fila de `GRACE_PERIOD` y `S6` no tiene de dónde salir.

| archivo | líneas |
|---|---|
| `B/10-verticales-planes-billing-options.md` | L111, L118, L166, L189, L206, L225, L269, L275, L294 |
| `B/03-maquinas-de-estado.md` | L593, L612, L1012 |
| `B/14-promos-cortesias-y-grants.md` | L447, L448 |
| `NUCLEO/01-glosario.md` | L57, L138 |
| `NUCLEO/04-invariantes.md` | L140, L218 |
| `B/09-conciliacion.md` | L470 |
| `B/descomposicion.md` | L500 |
| `B/spec.md` | L51 |
| `V/02-modelo-de-datos.md` | L535 |
| `V/17-autorizacion.md` | L322 |

### Grupo C2 — *«discontinuada»* de una API del proveedor, otro sujeto · 3 apariciones

**Las 3 hablan de la API de preapprovals que MercadoPago anunció en discontinuación**, no de una
vertical de Hospeda: *«la única capacidad del diseño que vive en una API anunciada como discontinuada
es la 6»*. El cuantificador es sobre **las ocho capacidades de proveedor** y es correcto para ese
sujeto. Se separan a mano del grupo anterior porque el término las trae y contarlas como hallazgos
habría enterrado las 23 que sí son de la vertical.

| archivo | líneas |
|---|---|
| `B/06-proveedor.md` | L239, L288 |
| `B/spec.md` | L201 |

### Grupo D — `S3`, `S9`, `S13`, `S18` y `S25` como sujeto, en propiedades que no se movieron · 265 apariciones

**Las 265 cuantifican sobre propiedades de esas cinco filas que los commits no tocaron**: sus
`desde`, su lugar en las tablas de recorrido, el cierre de la sucesión y sus cinco escrituras, el
fan-out del grant, los candados `A` y `B`, la re-emisión sobre la sucesora, los detectores del
`B/09` §3 y su reparto por unidades. **Lo que esta familia les agregó es distinto en cada una y está
enumerado**: a `S3` el cierre del saldo, a `S13` el cierre del saldo con otro motivo, y a ninguna
otra nada — `S9`, `S18` y `S25` **no cambiaron**, lo que cambió es el término que `S9` lee. **Cuatro
que merecen decirse enteras, porque cuantifican sobre algo que sí se movió y siguen siendo
verdaderas**:

- **`B/03` L191 y la tabla de las ocho** — *«son **ocho** las transiciones que la sacan de ahí sin
  que nadie declare una sucesión»*, sobre el conjunto `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`.
  `S26` mueve una predecesora de `ACTIVE` o `GRACE_PERIOD` a **`CANCEL_SCHEDULED`**, que **está en
  ese mismo conjunto**, así que no la saca; `S27` y `S28` salen de estados que no están en él. **Si
  la cláusula se hubiera escrito como *«las transiciones que la mueven»* en vez de *«que la sacan de
  ahí»*, hoy sería falsa.**
- **`NUCLEO/04` L163-176 (`D15`)** — *«de las **seis** formas de terminar que `B/12` §5.3 enumera,
  `S18` corre en **cuatro** … en las otras dos no corre: si la sucesora vence su ventana (`S3`) o si
  le cae un grant (`S13`)»*. El cuantificador es **sobre las seis ramas**, no sobre los actos que las
  disparan, y `S28` **no agrega una séptima rama**: entra como segundo disparador de la **2** (§5).
  Por eso las dos siguen siendo dos.
- **`B/03` L445, L792 y L1774** — *«los pares con dos filas son **cuatro** desde `S25`»*. Un par es
  `(desde, evento)`: las tres filas nuevas comparten el **evento** y no el `desde`, y ninguna otra
  fila de la tabla tiene ese evento, así que no hay par nuevo ni guarda que dirimir.
- **`B/03` L1012 (§3.3)** — *«las dos que quedan afuera de la prohibición tienen fila: `ACTIVE` es
  `S10`, y `CANCELLED` es `S22`, `S13` y `S25`»*. Enumera lo que sale **de `PAUSED`**, y las tres
  filas nuevas **excluyen `PAUSED` explícitamente** (`DEC-SUB-015`), así que la enumeración sigue
  completa.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L152, L169, L191, L218, L231, L235, L236, L237, L240, L250, L297, L319, L337, L345, L346, L349, L351, L357, L358, L359, L360, L369, L445, L457, L461, L462, L463, L464, L465, L466, L511, L516, L519, L527, L531, L535, L565, L580, L581, L585, L588, L590, L594, L670, L672, L683, L690, L704, L710, L712, L713, L715, L716, L726, L760, L765, L768, L771, L782, L784, L786, L792, L795, L797, L799, L802, L835, L926, L953, L1009, L1018, L1048, L1090, L1099, L1125, L1126, L1135, L1213, L1215, L1241, L1298, L1498, L1530, L1560, L1774, L1778, L1841, L1843, L1855, L1868, L1875, L2052 |
| `B/09-conciliacion.md` | L140, L141, L166, L226, L235, L236, L237, L238, L240, L250, L253, L254, L256, L281, L282, L284, L288, L296, L314, L322, L327, L339, L395, L414, L417, L421, L423, L425, L431, L461, L467 |
| `B/16-addons.md` | L226, L231, L235, L236, L253, L288, L294, L323, L338, L398, L405, L408, L416, L418, L419, L434, L435, L470, L474, L476, L478, L489, L492, L494, L507, L510, L624, L678, L689 |
| `B/02-modelo-de-datos.md` | L111, L117, L124, L128, L131, L133, L134, L138, L183, L670, L680, L687, L693, L701, L702, L777, L781, L786, L796, L800, L808, L811 |
| `B/12-suscripcion.md` | L91, L235, L273, L333, L421, L456, L481, L482, L483, L484, L485, L486, L505, L528, L529, L531, L532, L533, L564 |
| `B/14-promos-cortesias-y-grants.md` | L113, L116, L118, L134, L304, L306, L316, L317, L342, L357, L368, L370, L376, L415, L428 |
| `NUCLEO/01-glosario.md` | L378, L405, L407, L408, L411, L413, L486, L503, L577, L586 |
| `B/20-testing.md` | L70, L79, L80, L95, L103, L109, L118, L257, L441 |
| `12-contrato-de-cobertura.md` | L321, L345, L377, L381, L495, L505, L509, L511 |
| `NUCLEO/03-maquinas-de-estado.md` | L84, L97, L98, L122, L123, L124, L127, L135 |
| `B/descomposicion.md` | L297, L310, L353, L370, L371, L457, L495 |
| `NUCLEO/04-invariantes.md` | L163, L164, L170, L174, L184 |
| `B/05-idempotencia-y-concurrencia.md` | L140, L233, L300 |
| `B/10-verticales-planes-billing-options.md` | L175, L183, L186 |
| `B/19-superficies.md` | L195 |
| `V/03-maquinas-de-estado.md` | L467 |
| `V/20-testing.md` | L202 |
| `V/descomposicion.md` | L187 |

### Grupo E — los tres estados como miembros de conjuntos que no cambiaron · 109 apariciones

**Las 114 nombran `CANCEL_SCHEDULED`, `PENDING_AUTHORIZATION` o `ABANDONED` como miembros de un
conjunto** —los **seis** vivos de `B/02` §2.2, los **nueve** de `B/03` §3.1, los **dos** de la
instancia de addon, las filas de la tabla de qué emite cada estado— **y ninguno de esos conjuntos
ganó ni perdió un miembro**: esta familia agregó **transiciones**, no estados. **Si alguna dijera
*«a `CANCEL_SCHEDULED` se llega sólo por `S11`»* o *«a `ABANDONED` sólo por `S3`»*, sería falsa**;
las recorrí y las dos que enumeran cómo se llega a un terminal son la tabla de puertas del `B/09` §3
y la de `B/16` §4.4, **y las dos se recontaron** (§2 punto 10).

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L47, L48, L53, L74, L114, L182, L190, L198, L256, L260, L308, L547, L554, L555, L558, L677, L686, L808, L925, L937, L1013, L1029, L1041, L1052, L1057, L1064, L1074, L1084, L1211, L1294, L1329, L1398, L1474, L1476, L1527, L1536, L1548, L1822, L1839, L1840, L1860, L1872, L1878, L1879, L1883, L1884, L2035, L2037, L2041, L2042 |
| `B/12-suscripcion.md` | L215, L234, L271, L277, L279, L293, L432, L468, L578, L706, L719 |
| `NUCLEO/01-glosario.md` | L300, L303, L305, L334, L358, L381, L410, L412, L444, L449 |
| `B/02-modelo-de-datos.md` | L112, L177, L181, L182, L189, L215, L221, L728 |
| `B/05-idempotencia-y-concurrencia.md` | L204, L206, L234, L290, L291, L319 |
| `B/09-conciliacion.md` | L96, L194, L202, L234, L239, L354 |
| `B/16-addons.md` | L84, L89, L386, L505, L663, L677 |
| `12-contrato-de-cobertura.md` | L190, L320, L327, L352 |
| `B/14-promos-cortesias-y-grants.md` | L351, L360, L429 |
| `V/03-maquinas-de-estado.md` | L195, L197 |
| `B/10-verticales-planes-billing-options.md` | L165 |
| `NUCLEO/03-maquinas-de-estado.md` | L101 |
| `NUCLEO/04-invariantes.md` | L179 |

### Grupo F — la ventana de 72 h y el piso de 60 días · 35 apariciones

**Las 51 cuantifican sobre la duración de la ventana de autorización o sobre el piso de la
discontinuación, y esta familia no movió ninguna de las dos.** La ventana sigue declarada en **72 h**
en el corpus: `DEC-SUB-016` le dio **dos** plazos según el método de pago y **su implementación en
los capítulos es de la tanda corta del cierre de la 9-bis-5, no de ésta** (§6). Por eso el aviso de
la fila 18 lleva **la fecha de vencimiento de esa persona** y no una cifra: es correcto bajo los dos
plazos, y no adelanta ninguno. El piso de 60 días tampoco se movió — lo que `S27` y `S28` dicen es
**a quién no le corresponde**, que es una lectura del piso y no un cambio suyo.

| archivo | líneas |
|---|---|
| `B/12-suscripcion.md` | L177, L280, L370, L438, L596, L601, L606, L607, L666, L671 |
| `B/03-maquinas-de-estado.md` | L180, L261, L386, L449, L453, L1070, L1220, L1852 |
| `B/descomposicion.md` | L276, L293, L316, L318 |
| `B/10-verticales-planes-billing-options.md` | L104, L196, L248 |
| `B/06-proveedor.md` | L188, L194 |
| `B/22-lo-legal.md` | L89, L133 |
| `12-contrato-de-cobertura.md` | L333 |
| `B/16-addons.md` | L506 |
| `B/20-testing.md` | L78 |
| `NUCLEO/00-indice.md` | L67 |
| `NUCLEO/04-invariantes.md` | L134 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L114 |

### Grupo G — documentos de proceso y de medición · 84 apariciones

**Las 93 viven en el worklog, el handoff, las decisiones abiertas, el análisis de dominio, la
evaluación de proveedor, la partición, el inventario de hechos y el pliego legal**, y cuantifican
sobre **qué se decidió, qué se midió o cómo se repartió el trabajo**, con fecha. Ninguna es una regla
del diseño: son el registro de cómo se llegó a ella. **Si alguna afirmara el estado ACTUAL de una
regla que esta familia movió, habría que releerla**; las recorrí y las que nombran la cortesía o la
discontinuación lo hacen en pasado —*«quedó anotado ahí, sin decidir»*, *«lo cerró el capítulo 10
§4»*— o como pregunta ya cerrada por una decisión que sigue vigente.

| archivo | líneas |
|---|---|
| `04-open-decisions.md` | L32, L48, L49, L50, L51, L55, L82, L84, L127, L239, L281, L294, L300, L307, L310, L314, L320, L356, L359, L360, L367, L500, L513, L532 |
| `05-phase-1a-domain-analysis.md` | L152, L335, L343, L665, L807, L844, L849, L850, L851, L855, L864, L867, L869, L904, L1029, L1128, L1272 |
| `03-handoff.md` | L106, L159, L175, L553, L649, L769, L772, L922, L1035, L1036, L1098, L1209, L1270 |
| `02-worklog.md` | L192, L231, L243, L244, L321, L370, L616, L660, L993 |
| `10-evaluacion-de-proveedor.md` | L77, L79, L148, L250, L339, L427, L537, L562, L709 |
| `11-particion-del-programa.md` | L93, L123, L142, L146, L168, L172 |
| `13-pliego-consulta-legal.md` | L59, L67, L75, L167, L184 |
| `07-facts-inventory.md` | L35 |

---

## 5. Premisas ajenas que el arreglo volvió falsas y se corrigieron en el mismo acto

**Trece, y las trece verificables con un `rg`.**

| # | dónde | qué decía | qué dice ahora | commit |
|---|---|---|---|---|
| 1 | `B/03` §3.2, *«por qué `S18` también sale de `PENDING_AUTHORIZATION`»* | *«si después la sucesora abandona … **el mismo desenlace que tendría si nunca hubiera declarado la sucesión**»* | el mismo desenlace **con una excepción**: si la predecesora tenía cortesía, declarar la sucesión la dejó diferida y el abandono la **cierra** | `7946114aff` |
| 2 | `B/02` §2.4, la enumeración que este mismo rastro creó | *«`motivo_cierre` … **hoy tiene un solo valor**»* | **dos**, uno por cada acto que cierra un saldo, en tabla | `4df8b55f2d` |
| 3 | `NUCLEO/08` §3, la tabla del enrutado | *«**Las cuatro** son actos de sistema»* | **cinco**, con el cierre del saldo sumado y el conteo rehecho sobre las filas | `27ba3c54bb` |
| 4 | `NUCLEO/08` §3.1, regla 1 | *«otorgar y anclar cancelan la suscripción … y **terminan la cortesía que tuviera vigente ahí**»* | y **cierran el saldo de una diferida**, con los días nombrados | `4df8b55f2d` |
| 5 | `B/19` §4, fila 13-bis | ídem, en la confirmación del anclaje | ídem | `4df8b55f2d` |
| 6 | `B/03` §3, el recuadro de los `desde` de conjunto | *«en esta tabla hay **dos**, `S13` y `S20`»* | **cinco**, y las tres nuevas contestan **las dos clases** | `a577de930e` |
| 7 | `B/03` §3.1, la salida de `SUSPENDED` | *«su salida no es el candado: es pagar, el espejo, o `S23`»* — **tres** | **cuatro**, y la cuarta la decide `SUPER_ADMIN` sobre la cartera | `a577de930e` |
| 8 | `B/03`, *«Lo que esta mitad NO cierra»* | *«**la otra mitad SIGUE ABIERTA** … va como pregunta al owner»* | **CERRADA**, y no era una pregunta: faltaban las filas | `a577de930e` |
| 9 | `B/10` §4.3, el día 0 | *«cada suscripción viva **que pueda llegar a `CANCEL_SCHEDULED`** … pasa a ese estado»* | tres destinos según lo que cada estado emite, en tabla, y por qué el calificativo se leía mal | `3075b5a84d` |
| 10 | `B/09` §3 y `B/16` §4.4 | *«**trece** puertas»*, *«**diez** filas «no»»*, *«**nueve** de las diez»* | **quince**, **doce** y **once de las doce**, recontadas sobre la tabla | `53df8414ce` |
| 11 | `B/16` §4.2 | *«las transiciones que la cumplen son **las diez** que sacan a una principal de las filas vivas»* | **las doce**, con `S27` y `S28` — y **`S26` explícitamente afuera**, porque `CANCEL_SCHEDULED` sigue siendo fila viva | `dac3debb90` |
| 12 | `B/03` §3.2, `B/16` §4.2 y `B/02` §2.2 | *«la sucesora venció su ventana (`S3`) o la mató `S13`»*, en **los tres** lugares donde se enumera — el tercero es **donde el término se define**, y lo encontró el barrido de cierre después de corregir los otros dos | los tres ganan el tercer camino, **`S28`** | `dac3debb90` · `458ce804f8` |
| 13 | `NUCLEO/07` §6 | *«el de la pausa discontinuada existe porque es **la única persona** a la que el cierre de la vertical no le llega por los tres avisos»* | deja de ser *«la única»*: a quien tiene un checkout abierto tampoco le corre una fecha de fin de servicio | `dac3debb90` |

**Y una que no es una premisa ajena sino un hueco que el arreglo abre y cierra en el mismo commit**:
la **rama 2** de `B/12` §5.3 gana un segundo disparador —`S28`— que llega **al mismo destino por
otro mecanismo**: la predecesora está en `CANCEL_SCHEDULED` por `S26`, así que *«reactivar»* no
aplica y el pago retenido **le queda**, pagando el período que la fecha de fin de servicio todavía
cubre. **Mismo destino, mecanismo distinto: es la misma rama y no una séptima** (`dac3debb90`).

**Y un número que ya estaba caduco antes de esta familia y que ésta mueve otra vez**: `B/03` §7.1,
la tabla *«Lo que NO cambia»*, citaba *«sus **nueve** puertas»* del `B/09` §3 cuando ya eran trece.
Quedó escrito **cuándo se escribió y cuánto es hoy** en vez de pisar el registro (`dac3debb90`).

**Trece premisas, trece correcciones, todas ejecutadas enteras** — verificado con `rg` sobre el
corpus después del último commit: ninguna de las formulaciones viejas sobrevive en ningún archivo.

---

## 6. Lo que este rastro vuelve falso de los anteriores

**Seis líneas y una clase entera, todas por CADUCIDAD** —eran verdaderas el día que se escribieron y
un commit posterior las movió—, y ninguna por error del rastro que las escribió.

### De `23-fase-9-bis-5/rastro-d3bd02332.md` (familia 3, la marca y los motivos)

| línea del rastro | qué declaraba | por qué es falsa hoy |
|---|---|---|
| §5, fila 6 | *«`NUCLEO/08` §3, la tabla del enrutado … **las cuatro**, con la fila de `S21` sumada y el conteo rehecho»* | son **cinco**: el cierre del saldo de `DEC-GRANT-011` es el quinto acto de sistema (`27ba3c54bb`) |
| §4, Grupo D | *«las **trece puertas** a un estado terminal del `B/09` §3 (L110)»*, como uno de los cinco conjuntos que **no** se movieron | son **quince** desde `S27` y `S28` (`53df8414ce`). **La afirmación sobre la familia 3 sigue siendo cierta** —ella no las movió— pero la cardinalidad citada ya no es la del corpus |

### De `23-fase-9-bis-5/rastro-2e58663f7.md` (familia 2, el pagador manual)

| línea del rastro | qué declaraba | por qué es falsa hoy |
|---|---|---|
| L374 | *«`S3` → `ABANDONED` … `B/09` §3, **la tabla de las trece puertas**»* | **quince**. La corrección que esa fila declara —la salvedad del pagador manual— **sigue en pie y sin tocar**; lo caduco es el tamaño de la tabla |

### De `21-fase-9-bis-4/rastro-8d6b27a12.md` (la tanda corta de las ocho decisiones)

| línea del rastro | qué declaraba | por qué es falsa hoy |
|---|---|---|
| L403 | *«`B/03` §7.1 y §7.2 · «once puertas» … → doce/trece»* | el valor corregido pasó a **quince** |
| L406 | *«`B/09` §3 · «once puertas» y «siete de las ocho filas no» → **trece y nueve de diez**»* | **quince** y **once de doce** |
| L408 | *«`B/10` §4.3 · «cada suscripción viva se cancela y pasa a `CANCEL_SCHEDULED`» → **la pausada no puede, y no entra**»* | la corrección era correcta y **quedó corta**: además de la pausada, **la suspendida y la que espera autorización tampoco van a `CANCEL_SCHEDULED`** (`S27` y `S28`) |
| L411 | *«`B/16` §4.3 · «las ocho que sacan a una principal» → **diez, en dos pasos**»* | **doce** |

### Y una clase entera, que conviene decir aunque no sea una afirmación falsa

**Los `L<n>` de los rastros anteriores sobre los trece archivos que esta familia edita ya no
apuntan a la misma línea.** No es un error de nadie: un rastro cita líneas de un árbol fechado. Se
dice acá porque **la forma de verificar una fila de un rastro viejo es el texto citado, no el
número**, y porque el barrido de esta familia lo confirmó fila por fila sobre el texto.

---

## 7. Preguntas para el owner

**Tres, y las tres se decidieron para poder seguir; las tres piden ratificación, no confirmación.**

1. **`E2` se resolvió CERRANDO el saldo, que es la lectura que el censo marcaba como la que sube la
   severidad — y se eligió después de descartar la otra midiendo, no prefiriendo.** El censo
   suponía que dejar el saldo vivo produciría *«un regalo de más»*; recorrí las **dos** rutas de
   re-emisión de `S9` y **ninguna vuelve a alcanzar ese saldo después de `S13`** —la sucesora que el
   `sucedida_por` nombra la cancela el propio grant, y la predecesora no murió por `S25`—, así que
   el regalo de más **no existe** y lo que queda es un instrumento sin dueño, sin vencimiento y sin
   nadie que lo mire: la forma que `DEC-GRANT-011` y `DEC-SUB-016` descartaron **el mismo día**.
   **Lo que sí cuesta plata es lo que se eligió**: si el grant después se revoca, esos días no
   vuelven. **¿Se ratifica, o el grant tiene que dejar el saldo vivo y hacerlo alcanzable ampliando
   el tercer disparador de `S9`?** Lo segundo es mecanismo nuevo y por eso no lo tomé.
2. **`motivo_cierre` es una enumeración CERRADA donde `DEC-GRANT-008` eligió texto libre, y es una
   decisión de modelo que tomé sin consultar.** La razón que esa decisión escribe para el texto
   libre es que *«son concesiones firmadas a mano por `SUPER_ADMIN`»*, y acá **no hay una persona
   escribiendo el motivo**: el que cierra es una transición. Una lista cerrada además le da a
   `G-R1-F` algo que leer, que es lo que vuelve comprobable *«un grant no cierra un saldo sin estar
   en la tabla»*. **Se declara como decisión y se pide ratificación**, igual que `DEC-ENT-002`.
3. **`F3` se cerró con TRES filas donde el censo pedía una, y la tercera decisión es de plata.**
   `S27` manda la **suspendida** a `CANCELLED` en vez de al piso de 60 días, porque `SUSPENDED` **no
   emite cobertura** y `CANCEL_SCHEDULED` **sí**: mandarla al piso le devolvería hasta 60 días de
   servicio gratis a quien dejó de pagar. **El costo de la elección**: esa persona pierde la
   posibilidad de regularizar y volver durante esos 60 días, porque `S27` cierra la ventana de
   `MP4` igual que `S23`. **¿Se ratifica, o a la suspendida se le da el piso como a las demás?**

**Y una nota que no es pregunta, porque no puedo tocar el archivo donde está**: la entrada de
**`DEC-GRANT-011`** dice que volver a otorgar la cortesía *«es un acto que ya existe (`S13`)»*, y
`S13` es el *Free Forever*: **otorgar una cortesía es el PRIMER disparador de `S9`**. El capítulo
quedó escrito con la referencia correcta (`B/03` §3.2); la entrada del log **no se tocó**, porque las
reglas duras lo prohíben sin consultar.
