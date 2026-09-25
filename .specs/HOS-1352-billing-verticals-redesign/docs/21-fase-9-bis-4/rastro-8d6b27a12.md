---
title: FASE 9-bis-4 — Rastro por aparición de la tanda corta de las ocho decisiones
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `8d6b27a12`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que ningún commit de esta tanda tocó**, van el archivo, las líneas, el §, la cita y **por
qué sigue siendo correcta**. No hay agregados: cada línea de abajo se puede tomar sola y mostrarse
falsa.

## Los commits

| sha | qué escribe |
|---|---|
| `0f7b1e17d` | `DEC-SUB-014` — `S24`, la baja desde `GRACE_PERIOD` |
| `5d412ae60` | `DEC-SUB-015` — la pausada no entra al piso, y `S25` |
| `e828cd76c` | `DEC-GRANT-010` — la cortesía se difiere y se re-emite |
| `e78ddfca6` | la colisión 4 de `B/12` §2.2 y su regla general |
| `6b27f7615` | `DEC-RF-003` — la rama 6 con el default en DEVOLVER |
| `01599ec6a` | `DEC-GRANT-008` y `DEC-GRANT-009` — motivo de la revocación y `UNIQUE` parcial |
| `ec47ed85e` | `DEC-TEST-001` — `G-R6`, y por qué el segundo guard no va |
| `ad5b29a08` | seis premisas ajenas que `S24` y `S25` volvieron falsas |
| `8d6b27a12` | la séptima, del mismo barrido |

## 1. Qué se escribió, en una frase por decisión

| # | decisión | qué quedó escrito |
|---|---|---|
| 1 | `DEC-SUB-014` | **`S24`**: `desde` `GRACE_PERIOD`, evento *«pide la baja»*, `hacia` `CANCELLED` directo, fecha de fin en el día de la cancelación |
| 2 | `DEC-SUB-015` | la pausada **no entra al piso** de `B/10` §4.3, queda `PAUSED` y eso es legal; el aviso sale **al anunciar**; y **`S25`** ejecuta el final |
| 3 | *(sin decisión propia)* | la colisión 4 y su **regla general** pasan a apoyarse en `EX-11` + `DEC-SUB-010` impl. 3, no en *«durante la pausa no hay servicio»* |
| 4 | `DEC-RF-003` | la rama 6 llega al listado accionable con **default en DEVOLVER** |
| 5 | `DEC-GRANT-008` | la revocación guarda **motivo**, en texto libre |
| 6 | `DEC-GRANT-009` | **`UNIQUE(beneficiario) WHERE revocado_en IS NULL`** |
| 7 | `DEC-GRANT-010` | la cortesía sobre un plan que dejó de prestarse **se difiere** (`S25`) y **se re-emite** (`S9`, tercer disparador) |
| 8 | `DEC-TEST-001` | **`G-R6`**, y el segundo guard **rechazado con su razón escrita** |

**Las dos filas nuevas, con sus `desde`:**

| fila | desde | hacia | qué la distingue |
|---|---|---|---|
| `S24` | `GRACE_PERIOD` | `CANCELLED` | es la **única** de las cuatro bajas que retira cobertura que estaba corriendo: el grace **sí emite fuente** |
| `S25` | `PAUSED` | `CANCELLED` | **no tiene evento propio: tiene el de `S10`**, y la separa una guarda booleana — si el plan anclado se sigue prestando o no |

## 2. Qué se grepeó

**Términos NUEVOS** (los que estas decisiones definen): `S24` · `S25` · `G-R6` ·
`motivo_de_revocación` · `UNIQUE(beneficiario)` · *«la baja tiene CUATRO filas»* · *«ocho
transiciones»* que sacan a la predecesora · *«`S18` corre en SIETE de las ocho»* · *«las nueve/diez
que sacan a una principal de las filas vivas»* · *«doce/trece puertas a un estado terminal»* ·
*«ocho casos vivos»* de la regla 7 · *«cuatro pares con dos filas»* · el **tercer** disparador de
`S9` · el **segundo escritor** de `saldo_días` · el **default en DEVOLVER**.

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no
aparece buscando el nuevo: *«la baja tiene TRES filas»* · *«son tres»* los estados desde los que
se pide la baja · *«las otras dos»* bajas sin período · *«siete transiciones»* · *«seis de las
siete»* · *«las ocho que sacan a una principal»* · *«once puertas»* · *«siete de las ocho filas
no»* · *«siete casos vivos»* · *«tres pares»* / *«el único par con dos destinos»* · *«otras dos
salidas de `PAUSED`»* · *«durante la pausa no hay publicación ni servicio»* · *«al fin del primer
ciclo en que el cliente efectivamente tiene servicio»* · *«cada suscripción viva se cancela … y
pasa a `CANCEL_SCHEDULED`»* · el listado accionable citado como `B/19` §4 · *«los de `R1` siguen
siendo cinco»* · *«cinco comprobaciones»* · *«seis de los once motivos»*.

**Alcance**: los **53 archivos** del corpus —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición, el decision log y los
documentos de medición—, con y sin backticks, **incluidos los archivos que los commits tocan**.

**Medido sobre el árbol en `8d6b27a12`**: **277** líneas con al menos una aparición, repartidas en
**179** párrafos; **88** de esos párrafos los tocó la tanda; **91** no, y son los que van abajo,
uno por uno. La partición se calculó con los rangos `+` de
`git diff --unified=0 e32aef15c..HEAD` —el diff de la tanda entera contra su base, no el de cada
commit por separado, porque los rangos de un commit no se proyectan sobre un archivo que los
commits siguientes corrieron— sobre los bloques separados por línea en blanco. No a ojo.

## 3. Las 91 apariciones no corregidas, una por una

### `B/03-maquinas-de-estado.md` (9)

- **L437 · §3.2, el título *«`S10` es la única salida de `PAUSED` que devuelve el servicio»*** →
  **sigue correcta, y es la cláusula que la salva la que `S25` vuelve a poner a prueba**. `S25`
  sale de `PAUSED` con **el mismo evento** que `S10` y **no devuelve el servicio**: cancela. El
  calificativo del título —*«que devuelve el servicio»*— ya estaba puesto por `S22` y `S13`, y
  cubre a `S25` sin cambiarlo. El cuerpo del § sí se corrigió (dos salidas → tres), y está en un
  hunk.
- **L621-625 · §3.2, el segundo disparador de `S13`** — *«el acto nuevo le agrega a `S13` un
  segundo disparador, así que la ejecución parcial de `S13` tiene dos orígenes y no uno»* → sigue
  correcta: los disparadores que esta tanda agregó son de **`S9`**, no de `S13`, y `S13` sigue
  teniendo exactamente dos. Homónimo de *«segundo disparador»*, con otro sujeto.
- **L709-712 · §3.2, `S13` es un fan-out** — *«con **dos disparadores** que lo pueden lanzar»* →
  ídem: es `S13`, no `S9`.
- **L719-726 · §3.2, el detector de la ejecución parcial de `S13`** — *«las otras cinco
  comprobaciones»* → **sigue correcta y hay que decir por qué**: las comprobaciones son **seis** y
  ésta es una de ellas, así que *«las otras cinco»* es el complemento exacto. Esta tanda **no
  agrega ninguna**: la sexta se ensanchó (dos preguntas en vez de una) y sigue siendo la sexta.
- **L1029-1037 · §5, qué le pasa a la ficha durante la pausa** — *«lo que protege al cliente son
  **tres** cosas … y **que la reanudación efectivamente ocurra**, que es la premisa de las otras
  dos»* → **sigue correcta, y es la más cerca de haberse vuelto falsa del rastro**. Lo que la
  salva es su sujeto: el § habla de una pausa **por `CUSTOMER_REQUEST` sobre un plan que se sigue
  prestando**, que es la población de `S10`. Sobre la de `S25` la reanudación **no ocurre por
  diseño** — y la garantía no se cae, cambia de camino: `PB7` republica cuando `cubierto` vuelve a
  ser verdadero, y eso pasa con el alta nueva igual que pasaría al reanudar. Está escrito en el
  hunk de `S25` (§3.2, *«`S25` es el caso en que la persona SÍ pidió volver»*).
- **L1039-1041 · §5, `D16` y `G-R5`** — *«el aviso … es `B/19` §4, fila 5-bis»* → sigue correcta:
  la fila 5-bis **sí** está en el §4 de `B/19`, que es *«lo que hay que decir»*. Lo que estaba mal
  citado y se corrigió es **el listado accionable**, que vive en el §6.
- **L1184-1191 · §7.1, el tope de `MP4`** — *«cuando una persona cancela la suscripción (`S23`)
  … **Y las otras tres condiciones acotan el resto**»* → sigue correcta: *«las otras tres»* son
  las condiciones del `B/05` §3, no bajas. Y `S24` **no le agrega población**: su `desde` es
  `GRACE_PERIOD`, y `MP4` reabre desde `DECLARED_UNPAID` sobre una fila `SUSPENDED`.
- **L1193-1203 · §7.1, lo que el tope NO acota** — *«*«que nadie cancela»*nombra un subconjunto
  recién desde `S23`: hasta esa fila **las otras dos salidas** estaban descartadas»* → sigue
  correcta: su sujeto es **`SUSPENDED`** y sus salidas, no `PAUSED` ni el grace. `S24` y `S25` no
  salen de `SUSPENDED`, así que no le agregan ni le sacan una salida.
- **L1701-1714 · §8, el recuadro de la revocación** — *«Revocar escribe `revocado_en` en el
  **instrumento**»* → **sigue correcta y no es incompleta en lo que afirma**: lo que hace que las
  N anclas dejen de ser vivas es `revocado_en` y sólo esa columna. Que la revocación escriba
  además firmante y motivo (`DEC-GRANT-008`) no cambia el predicado del que habla este párrafo, y
  el inventario completo de lo que escribe está en `B/02` §2.4, que sí se corrigió.

### `B/09-conciliacion.md` (10)

- **L75-78 · §2.4, el recuadro de los trece motivos** — *«Cuatro de los trece motivos significan
  *«hay plata del cliente que devolver»*»* → sigue correcta: **esta tanda no agrega ningún
  motivo**. La rama 6 usa el motivo 1, que ya existía, y lo que `DEC-RF-003` le agrega es un
  **default**, no una fila del catálogo. Las dos cifras se recontaron sobre `B/02` §2.5 y siguen
  dando trece y cuatro.
- **L271-284 · §3, la segunda comprobación** — *«`S18` abre la marca `REEMBOLSO_POR_CONFIRMAR`
  —por la rama 1, por la 5 **y por la 6**»* → sigue correcta: la rama 6 sigue siendo una rama y
  ahora tiene dos filas (`S23` y `S24`), que es una distinción de `B/12` §5.3 y no de acá. Lo que
  esta comprobación pregunta —*«si la rama no es determinable»*— no cambia por el default.
- **L286-290 · §3, la tercera comprobación** — *«un `permanent_grant` cuyo grant tiene
  **`revocado_en` nulo**»* → sigue correcta y **es lo que el `UNIQUE` parcial refuerza**: la
  restricción se define exactamente sobre ese predicado, así que esta comprobación encuentra a lo
  sumo una fila viva donde antes podía encontrar N.
- **L304-348 · §3, el recuadro de la tercera** — *«las otras cinco comprobaciones miran
  `sucede_a`, el pago pendiente y …»* → sigue correcta por lo mismo que L719-726 de `B/03`: son
  seis y ésta es una.
- **L350-358 · §3, la cuarta comprobación** — *«el `permanent_grant` de esa ancla tiene
  **`revocado_en` escrito**»* → ídem que L286-290: el predicado no cambia, la base lo hace más
  fuerte.
- **L360-401 · §3, el recuadro de la cuarta** — *«que el grant del ancla siga vivo es un dato de
  nuestra base **desde que es una columna**»* → sigue correcta, y el motivo nuevo no la toca: la
  comprobación lee `revocado_en`, no por qué se revocó.
- **L426-448 · §3, el recuadro de la quinta** — *«las otras cinco comprobaciones … **ninguna mira
  el reloj de una fila**»* → sigue correcta: ninguna de las seis mira el reloj salvo ésta, y esta
  tanda no agregó ninguna.
- **L474-494 · §3, el recuadro de la sexta** — *«las otras cinco comprobaciones … **ninguna mira
  una cortesía**»* → sigue correcta: sigue siendo la única que mira una cortesía, y lo que cambió
  es que ahora la mira **por dos caminos** en vez de uno, lo cual está en un hunk del commit.
- **L509-511 · §5, el aviso agregado** — *«el mecanismo … es el de `DEC-OBS-001` … cuyo canal
  primario es el listado accionable, no el correo»* → sigue correcta: no cita §, así que la
  corrección de `B/19` §4 → §6 no la alcanza.
- **L518-523 · §3, el escalamiento por reloj** — *«un `REEMBOLSO_POR_CONFIRMAR` tiene plata del
  cliente parada»* → sigue correcta, y el default la refuerza: con *«devolver»* escrito, el reloj
  mide una espera sobre una decisión **ya propuesta**, que es el caso en que esperar es más caro.

### `B/02-modelo-de-datos.md` (9)

- **L519-523 · §2.4, el recuadro de *«revocar retira las anclas como TÍTULO»*** — *«Escribe
  `revocado_en` en el instrumento —**una** escritura, sobre **una** fila»* → **sigue correcta y hay
  que leerla con cuidado**: *«una escritura sobre una fila»* contrasta con *«N filas de ancla»*, y
  el motivo y el firmante van **en esa misma fila y en ese mismo acto**. La revocación sigue siendo
  un `UPDATE` sobre `permanent_grant` y nada más. El detalle de las tres columnas está en el
  párrafo que el commit agregó justo debajo.
- **L590-594 · §2.4** — *«`revocado_en` es **una marca de un acto**, como `fin_real` … no hay
  transiciones, no hay `desde`/`hacia`»* → **sigue correcta y el `UNIQUE` no la contradice**: una
  restricción de unicidad sobre una columna anulable no es una máquina de estados. Y la analogía
  con `fin_real` se volvió más exacta, no menos: `S25` escribe `fin_real` igual que `S22`.
- **L602 · §2.5, el título *«trece motivos … y cuatro de ellos devuelven plata»*** → sigue
  correcta: esta tanda no agrega motivos. Ver L75-78 de `B/09`.
- **L604-609 · §2.5** — *«`S18` pone la marca *«con motivo reembolso por confirmar»* y las ramas
  1, 5 y 6 … se apoyan en ese motivo»* → sigue correcta: las tres ramas siguen siendo tres y el
  motivo sigue siendo el mismo. El default de `DEC-RF-003` es **de la superficie**, no del motivo.
- **L619-623 · §2.5** — *«`S14` … cubre **siete** de los trece casos … Los otros **seis** los
  abren actos que no son `S14`»* → sigue correcta: los escritores no cambiaron. (Es la cifra que
  `B/03` §3.2 citaba mal —*«seis de los once»*— y que el commit de `S24` corrigió allá, contra
  este texto.)
- **L625-639 · §2.5, la tabla de los trece motivos** — fila 1, *«`REEMBOLSO_POR_CONFIRMAR` …
  ramas 1, 5 y 6»* → sigue correcta: la rama 6 sigue abriendo ese motivo, ahora desde dos estados.
  La tabla enumera **quién abre** y **qué tiene que hacer la persona**, no qué se le propone; el
  default vive en `B/19` §6, que es donde la persona lo lee.
- **L641-646 · §2.5** — *«La enumeración es cerrada y **el conteo se recalcula, no se
  incrementa**»* → sigue correcta, y esta tanda la ejecutó en la dirección contraria a la
  esperada: se recontó y **el resultado fue el mismo**, trece y cuatro. Un recuento que no cambia
  el número sigue siendo un recuento.
- **L677-683 · §2.6, la tabla de lo que cuelga** — las filas de complementos y redención, *«se
  re-apuntan a la sucesora»* → siguen correctas: `S25` **no re-apunta nada**. La cortesía es la
  única de las cinco que toca, y su fila está en un hunk; el recuadro que declara a `S25` como
  segundo escritor está justo debajo, también en un hunk.
- **L699-705 · §2.6** — *«las tres primeras … son silenciosas … **Y la tercera tiene además un
  segundo modo de falla que las otras dos no tienen**»* → sigue correcta: el segundo modo de falla
  —*«el diferimiento se puede escribir bien y la re-emisión no ocurrir nunca»*— es **exactamente**
  el que `DEC-GRANT-010` hereda, y el detector que nombra es el mismo.

### `B/12-suscripcion.md` (6)

- **L258-274 · §4.4** — *«lo que la superficie ofrece ahí … (cap. 03 §3.3.1 y §3.4 punto 3,
  `B/19` §4 …)»* → sigue correcta: cita las filas 16 y 16-bis del §4, que son *«lo que hay que
  decir»* y están donde dice.
- **L382-387 · §5.3** — *«Alcanza a `NUCLEO/07` §6 … y a `B/19` §4, fila 15»* → ídem: fila 15 del
  §4.
- **L389-392 · §5.3** — *«las mismas dos filas —`NUCLEO/07` §6 y `B/19` §4 fila 15»* → ídem.
- **L490-497 · §5.3** — *«las **TRES** que abren la marca de dinero ya tienen dónde asentarla …
  El acto es el mismo en las tres»* → **sigue correcta y el default la completa sin moverla**: las
  tres siguen siendo tres, siguen compartiendo acto, motivo y asiento, y desde `DEC-RF-003`
  comparten además **desenlace propuesto**. El párrafo que lo dice es el que el commit agregó
  inmediatamente debajo.
- **L499-505 · §5.3, el recuadro de la marca que se distingue de las otras diez** — *«la
  predecesora llegaba al listado accionable como una `CANCELLED` marcada»* → sigue correcta y **no
  cita §**, así que la corrección `§4 → §6` no la alcanza. Lo que agrega el default es la mitad
  que a este recuadro le faltaba: distinguirse **y** decir qué hacer.
- **L671-679 · §7.2** — *«El argumento va por el período pagado y no por *«durante la pausa no hay
  servicio»*, que es verdad de una sola de las dos pausas»* → **sigue correcta, y es el precedente
  exacto del arreglo de la colisión 4**: el mismo defecto de razón, corregido en otro § y dos
  tandas antes. Su cita a *«`B/19` §4, fila 8»* también es correcta: la fila 8 es del §4.

### `B/16-addons.md` (6)

- **L115-119 · §2.4** — *«un grant revocado no emite ninguna fuente … Se lee sobre
  `permanent_grant.revocado_en`»* → sigue correcta: el predicado no cambia y el `UNIQUE` lo hace
  más barato de evaluar, no distinto.
- **L203-219 · §3.3, el recuadro de la cláusula que nombra la revocación** — *«el `NUCLEO/08` §3
  declara para el grant exactamente **tres** escrituras —otorgar, anclar, revocar»* → **sigue
  correcta y es la que más cerca estuvo de volverse falsa**: `DEC-GRANT-008` agrega **columnas a
  una escritura que ya existía**, no una cuarta escritura. Revocar sigue siendo un acto del
  catálogo, con su permiso y su confirmación.
- **L370-374 · §4.2, la tabla de scopes** — *«una fila de `permanent_grant_vertical` cuyo grant
  tenga `revocado_en` nulo»* → sigue correcta, ídem.
- **L434-448 · §4.2, la tercera mitad de la orfandad** — *«`S13` saca de las filas vivas a la
  suscripción principal de cada vertical que el grant ancla»* → sigue correcta: `S13` no cambió, y
  `S24`/`S25` no son suyas. Lo que había que recontar —cuántas transiciones sacan a una principal—
  está en el §4.3, en hunks de los dos commits.
- **L450-468 · §4.2, el recuadro de la mitad que no estaba en la base** — *«La lectura no cambió:
  lo que cambió es que ahora se puede hacer»* → sigue correcta: sigue leyéndose sobre
  `revocado_en`, y el motivo nuevo no participa de ningún predicado.
- **L489-496 · §4.2** — *«el complemento es UNA de las DOS cosas que `S18` re-apunta … **Y cuelga
  una tercera que desde `DEC-GRANT-007` NO se re-apunta**: la cortesía vigente»* → **sigue
  correcta, y su sujeto es `S18`**, que es el único acto del que este § habla. `S25` difiere la
  misma cortesía por fuera de toda sucesión, y por eso no entra en una frase sobre lo que un
  cierre re-apunta.

### `B/14-promos-cortesias-y-grants.md` (3)

- **L229-241 · §4.3, el recuadro de *«ancla viva»*** — *«sobre un grant **revocado** sí queda
  obligación de pago»* → sigue correcta: el `UNIQUE` sólo impide **dos vivos a la vez**, y no
  toca a los revocados, que se acumulan sin límite por ser el índice parcial.
- **L258-264 · §4.4** — *«`S9` la re-emite sobre **la sucesora** cuando ésta autoriza»* → **sigue
  correcta como enunciado de SU caso**, que es el cruce *«cortesía + cambio de plan»*. El caso de
  `DEC-GRANT-010` no es una sucesión y tiene su propio § —el §4.6, que el commit agregó—, con su
  propia forma de llegar a la fila nueva. Escribirlo acá habría mezclado dos poblaciones que se
  resuelven por punteros distintos.
- **L331-340 · §4.4, el recuadro del riesgo aceptado** — *«la **sexta** comprobación … levanta la
  cortesía diferida cuya **sucesora** ya está `ACTIVE`»* → ídem: es el enunciado de la
  comprobación **para el caso de este §**. La comprobación pasó a tener dos preguntas, y las dos
  están escritas en `B/09` §3, que es su dueño.

### `B/10-verticales-planes-billing-options.md` (1)

- **L218-221 · §4.4, *«el piso de 60 días»*** — *«como el cobro ya se cortó el día 0, esos días se
  prestan **sin cobrar**: un mensual recibe hasta dos meses libres»* → **sigue correcta para la
  población que le quedó**, que es la del §4.4: las que **sí** entran al piso. La pausada quedó
  fuera por `DEC-SUB-015` y **no recibe esos días** —no está recibiendo servicio, está pausada—,
  así que el costo que este § calcula no crece ni se achica por el arreglo. Lo que sí había que
  decir —que la pausada no entra— está en el §4.3, en un hunk.

### `B/20-testing.md` (1)

- **L64-72 · §2, *«Los SEIS de `R1`»*** → sigue correcta: `G-R6` **no es de `R1`**. Su sujeto no
  es `sucede_a` ni `reconciliation_mark` sino **las columnas que una condición lee**, así que abre
  un racimo propio. Los de `R1` siguen siendo seis, y el renglón del §2 que decía *«cinco»* se
  corrigió en el mismo commit.

### `B/22-lo-legal.md` (1) · `B/spec.md` (1) · `B/descomposicion.md` (5)

- **`22-lo-legal.md` L135-136** — *«las otras tres cambian un número o una promesa»* → homónimo:
  son consultas legales, no bajas.
- **`B/spec.md` L155-157** — *«las otras dos, el trial y el título `BASE`, son de la otra épica»*
  → homónimo: son fuentes de cobertura.
- **`descomposicion.md` L12-36, L50-54, L87-101** — *«Doce de los trece capítulos»* → homónimo de
  *«trece»*: son capítulos, no motivos de marca.
- **`descomposicion.md` L318-324** — *«que el caso aparezca en el listado accionable con qué
  devolver (`NUCLEO/08` §4.3)»* → sigue correcta: cita el § del núcleo, no `B/19`, y **el default
  es exactamente *«qué devolver»* escrito de antemano**. La unidad que lo construye sigue siendo
  B13 más el núcleo.
- **`descomposicion.md` L350-364** — la tabla de *«la unidad está lista cuando…»* → sigue
  correcta: ninguna de sus filas nombra una baja, un par ni un conteo que esta tanda moviera.
  **Y `G-R6` no entra acá**, que es una omisión declarada y no un olvido: `DEC-TEST-001` acepta
  por escrito que el guard nuevo nace **sin unidad que lo construya** —*«13 de 27»*—, así que
  agregarle una fila a este reparto sería contradecir la decisión.

### `NUCLEO/01-glosario.md` (3)

- **L288-293 · §2.4, la tabla de los cuatro conjuntos** — *«**grant vivo** … `revocado_en`
  **nulo** … No hay máquina de estados del grant y no hay más valores que esos dos»* → **sigue
  correcta y el `UNIQUE` la ejecuta**: la restricción se define sobre ese mismo predicado. Y el
  motivo nuevo no agrega un tercer valor: acompaña a `revocado_en`, no lo reemplaza.
- **L425-450 · §2.4, las tres reglas de uso** → siguen correctas. La regla 2 —*««vivo» sin
  calificar no se usa en un predicado»*— la cumplen las dos filas nuevas: `S24` y `S25` nombran
  **estados concretos**, no conjuntos, que es por lo que tampoco entran al inventario.
- **L534 · §2.6, el encabezado del inventario de *«cortesía diferida»*** → sigue correcta: sigue
  siendo el **cuarto** inventario del capítulo y lo sigue vigilando `G-R1-F`. Lo que ganó son dos
  filas, y están en un hunk.

### `NUCLEO/07-outbox-y-notificaciones.md` (1) · `NUCLEO/08-auditoria-y-observabilidad.md` (4)

- **`NUCLEO/07` L260-269 · §6** — *«la devolución NO es instantánea … `DEC-RF-002` puso el
  reembolso en manos de una persona»* → **sigue correcta y el default no la toca**: proponer no es
  ejecutar. El correo sigue teniendo que decir que hay una espera, porque la sigue habiendo.
- **`NUCLEO/08` L134-147 · §3, el catálogo de las doce acciones** — *«**Re-emitir una cortesía
  diferida NO es una fila de esta tabla**: lo hace `S9` como efecto, con la firma original»* →
  **sigue correcta y ahora cubre dos disparadores en vez de uno**, que es exactamente lo que el
  argumento sostiene: la firma no cambia, así que no hay concesión nueva que auditar. El catálogo
  **sigue teniendo doce filas**, recontadas sobre esta tabla.
- **`NUCLEO/08` L200-205 · §3** — *«*«qué addons corta»*(`B/19` §4 fila 13)»* → sigue correcta:
  la fila 13 es del §4, y es la que el commit de `DEC-GRANT-008` amplió para que pida el motivo.
- **`NUCLEO/08` L249-255 · §4.1** — *«canal primario: el listado accionable en Admin»* → sigue
  correcta: no cita § de `B/19`.
- **`NUCLEO/08` L273-294 · §4.3** — *«el monto a devolver, el pago que lo origina y POR QUÉ PUERTA
  entró … de las ramas 1, 5 y 6»* → **sigue correcta y es donde el default encaja sin rozarla**:
  esa entrada ya declara que *«no hay nada que diagnosticar — el desenlace lo decidió el diseño»*,
  que es literalmente el argumento de `DEC-RF-003` aplicado a la rama que faltaba.

### `12-contrato-de-cobertura.md` (1)

- **L519-522 · §2.8** — *«*Vivo* acá tiene definición y columna: `permanent_grant.revocado_en`
  nulo»* → sigue correcta; el `UNIQUE` se define sobre ese predicado y el motivo no participa de
  él.

### `V/02-modelo-de-datos.md` (1) · `V/11-trial.md` (1)

- **`V/02` L267-270 · §2.5** — *«la fecha que el cap. 19 §4 fila 18 obliga a imprimirle al
  cliente»* → sigue correcta: fila 18 del §4 de `B/19`, que es *«lo que hay que decir»*.
- **`V/11` L22-27 · §1** — *«sus **siete** transiciones no se repiten acá»* → homónimo: son las
  de la máquina de **trial**, no las de la tabla de suscripción que pasó de siete a ocho.

### `01-decision-log.md` (14)

> No se edita por regla dura de la fase. Van igual, porque el decision log es parte del corpus que
> `DEC-METH-010` obligación 1 manda recorrer.

- **L1295-1348 · `DEC-MP-002`** — *«las otras dos»* en la aritmética del aumento → homónimo: son
  ciclos de cobro.
- **L1876 y L1878-1913 · `DEC-OBS-001`** — *«listado accionable en Admin como canal primario»* →
  siguen correctas: la decisión no fija en qué § del capítulo 19 vive, que es lo que se corrigió.
  Y el default **no contradice** *«cero decisiones destructivas automáticas»*: proponer no ejecuta.
- **L2082-2135 · `DEC-ARCH-006`** · **L2640-2683 · `DEC-METH-007`** · **L3190-3241 ·
  `DEC-SUB-013`** — *«las otras dos»* → homónimos: fuentes que cruzan la frontera, condiciones de
  *«bien testeado»* y decisiones de la semana, respectivamente.
- **L2780-2814 · `DEC-RF-002`** — *«la primera de las **cuatro** ramas con que puede terminar una
  sucesión»* → **sigue correcta como registro de cuándo se escribió**: las ramas eran cuatro ese
  día y hoy son seis (`B/12` §5.3 lo dice y lo fecha). Lo que la decisión fija —que el reembolso
  lo confirma una persona— **no depende del conteo**, y `DEC-RF-003` la extiende sin tocarla.
- **L3521 y L3619 y L3621-3651 y L3657-3672 y L3676 y L3678-3701 y L3743-3771** — las entradas de
  `DEC-SUB-014`, `DEC-RF-003`, `DEC-GRANT-008`, `DEC-GRANT-009` y `DEC-GRANT-010` → **son la
  fuente de esta tanda y no se tocan**. Se verificaron contra lo escrito una por una; las tres
  desviaciones que aparecieron están en el §5, como preguntas al owner.

### `02-worklog.md` (2) · `03-handoff.md` (3) · `04-open-decisions.md` (1) · `05-phase-1a` (1)

- **`02-worklog.md` L672-674 y L933-936**, **`03-handoff.md` L155, L459-463 y L811-815**,
  **`04-open-decisions.md` L400**, **`05-phase-1a-domain-analysis.md` L1146-1149** → **son
  registro histórico de decisiones ya tomadas**, y sus menciones del listado accionable citan
  `DEC-OBS-001`, no un § del capítulo 19. Las dos que **sí** dicen *«cap. 19 §4»*
  —`02-worklog.md` L933-936 y `03-handoff.md` L459-463— hablan de **la lista de avisos**
  (*«la unión de las dos mitades es 1–14»*), que es el §4 de verdad, no del listado accionable.
  Y el *«las otras dos son escritura»* del handoff L155 es un homónimo sobre huecos de fase.

### Documentos de medición (7)

- **`08-phase-1b-code-discovery.md` L1355-1356, L2109-2110, L2751-2756, L2758-2763, L6150-6158**
  — *«los once»* gates, tipos y símbolos → **homónimos exactos**: son conteos del código actual,
  no los motivos de la marca. El que sí era un homónimo peligroso —`B/03` §3.2 diciendo *«seis de
  los once de `B/02` §2.5»*— era una cita **al catálogo de motivos** y estaba caduca; se corrigió.
- **`08-phase-1b-code-discovery.md` L2201-2205 y L6186-6199** — *«las otras dos»* → homónimos:
  son implementaciones duplicadas en el código actual.

## 4. Premisas ajenas que estos commits volvieron falsas y se corrigieron en el mismo acto

**Van agrupadas en 24 filas**; las dos últimas juntan varias correcciones del mismo tipo, así que
el número de filas no es el número de frases corregidas.

| dónde | qué decía | por qué dejó de ser cierta |
|---|---|---|
| `B/03` §3.2, el dominio de la predecesora | *«son **siete** las transiciones»* | son ocho: `GRACE_PERIOD` es uno de los tres estados sucedibles |
| `B/03` §3.2 | *«`S18` corre en SEIS de las siete»* | siete de las ocho |
| `B/03` §3.2, título | *«la baja tiene TRES filas»* | cuatro |
| `B/03` §3.2, pares de la baja | *«la tabla de pares sigue teniendo tres entradas»* | `S25` agrega la cuarta |
| `B/03` §3.2, `S14` | *«seis de los once de `B/02` §2.5»* | siete de los trece (caduco desde la familia de la marca) |
| `B/03` §3.2, `S18` escritura 4 | enumeraba los caminos por los que no corre sin `S24` | `S24` es otro |
| `B/03` §3.2, `S18` escritura 5 | *«el espejo, `S23` y el cierre normal»* | también `S24` |
| `B/03` §3.2, tabla de cómo termina la sucesión | su sexta fila nombraba sólo `S23` | `S24` es la segunda fila de esa rama |
| `B/03` §3.2, `S10` | *«`PAUSED` tiene otras dos salidas»* | tres |
| `B/03` §3.3, celda de `PAUSED` | nombraba `S22` y `S13` | también `S25` |
| `B/03` §4 | el grace sale por `S5` o `S6` | y por `S24` |
| `B/03` §5, *«quién la termina»* | *«la reanuda nuestro reloj, y no hay segunda vía»* | terminarla no siempre es reanudarla |
| `B/03` §7.1 y §7.2 | *«once puertas»*, *«tres pares»*, *«cinco comprobaciones»* | doce/trece, cuatro, seis |
| `B/03` §3.2 | citaba el listado accionable como `B/19` §4 | vive en el §6 |
| `B/05` C2 | *«las otras dos»* bajas sin fecha que extender | las otras tres |
| `B/09` §3 | *«once puertas»* y *«siete de las ocho filas no»* | trece y nueve de diez |
| `B/09` §3, quinta comprobación | *«las otras dos salidas de `PAUSED`»* | tres |
| `B/10` §4.3 | *«cada suscripción viva se cancela y pasa a `CANCEL_SCHEDULED`»* | la pausada no puede, y no entra |
| `B/12` §2.2 colisión 3 | *«en los tres casos»* | cuatro |
| `B/16` §4.3 | *«las ocho que sacan a una principal»* | diez, en dos pasos |
| `B/16` §4.4 | *«las comprobaciones son cinco»* | seis (caduco desde la familia de la sucesión) |
| `B/19` §4 fila 8 y §5 | *«son tres»* los estados desde los que se pide la baja | cuatro, y uno de ellos corta servicio |
| `B/20` §2 | *«los de `R1` siguen siendo cinco»* | seis (caduco desde la misma tanda que los hizo seis) |
| `NUCLEO/03` §1 regla 7 · `NUCLEO/04` 22 y `D15` · `12-contrato…` §2.6 · `V/03` §9 · `V/20` §2 · `NUCLEO/01` §2.6 | siete casos, las otras dos bajas, siete transiciones, tres pares, *«`T1`/`T6` es el único par con dos destinos»*, *«se alcanza por `sucedida_por`»* | ocho, tres, ocho, cuatro, cuatro, dos saltos |

## 5. Lo que de los cinco rastros anteriores dejó de ser cierto o quedó incompleto

1. **`rastro-032f761e0.md` §3, `B/10` §4.3** — justificaba no corregir esa línea con *«no es mía y
   arreglarla es una decisión … Va como pregunta 2 al owner»*. **El owner la contestó**
   (`DEC-SUB-015`) y la línea está corregida, así que esa justificación **ya no describe el
   estado del corpus**. Lo que sigue intacto es su razonamiento: no se resolvió leyendo la
   discontinuación como una de las filas de la baja, exactamente como ese rastro decía que no se
   podía.
2. **`rastro-032f761e0.md` §5, pregunta 2** — decía *«hace falta decidir **qué estado ocupa una
   pausada durante los 60 días de piso**»*. La pregunta quedó **mal planteada, y la respuesta lo
   muestra**: la pausada **no ocupa ningún estado durante el piso porque no entra al piso**. No
   es un matiz — buscar un estado para esa ventana es lo que habría llevado al segundo reloj que
   `DEC-SUB-015` descartó por medido.
3. **`rastro-032f761e0.md` §3, `B/12` §5.3 L501-507** — justificaba *«La marca va sobre la
   PREDECESORA»* diciendo *«la rama 6 nueva la usa igual: el pago cuelga de la predecesora, que es
   la fila que `S23` mató»*. **Sigue siendo cierta y hoy está incompleta**: la fila la puede matar
   `S23` **o `S24`**. La conclusión no se mueve.
4. **`rastro-ce52dce5f.md`** — su pregunta 1 (el motivo de la revocación) y su pregunta 2 (el
   `UNIQUE`) **las contestó el owner** y están implementadas. Nada de lo que ese rastro declaró
   correcto dejó de serlo: sus justificaciones son sobre `revocado_en` como columna, y las tres
   columnas de la revocación siguen siendo una sola escritura sobre una sola fila.
5. **`rastro-8f9f31ac0.md`** (el pagador manual) — **ninguna dejó de ser cierta, y una se volvió
   más fuerte**: su sujeto es la fecha del próximo cobro con sus tres escrituras, que es
   exactamente la columna que `G-R6` pasa a vigilar. Lo que ese rastro justificó como *«tres
   escrituras y un tope»* ahora tiene un guard que lo cuenta.
6. **`rastro-f21d5d828.md`** y **`rastro-5836ec219.md`** — no se encontró ninguna justificación
   caduca. Los términos de las dos son la marca de conciliación y la sucesión, y esta tanda **no
   agregó ni quitó motivos** ni movió el reparto del cierre; lo único que la sucesión ganó es la
   segunda fila de la rama 6, que su propio rastro ya anticipaba como *«la baja pedida por la
   predecesora»*.

## 6. Preguntas para el owner

1. **`DEC-SUB-015` y `DEC-GRANT-010` dicen *«el retiro de un plan»* y el corpus no tiene ese
   acto.** `B/10` §3 —*«Retiro de un plan del catálogo»*— dice con todas las letras que retirar un
   plan **no mueve a ninguna suscripción** (§3.2) y que **no hay fecha de vencimiento** (§3.4):
   ahí no hay piso, ni aviso, ni nada que decidir. El único acto que deja a una pausada apuntando
   a un plan que va a dejar de prestarse es **la discontinuación de la vertical** (§4.3), que es
   donde las dos decisiones apuntan y donde se implementaron. **La decisión no cambió**; lo que
   quedó escrito usa el vocabulario del §4.3 y declara la diferencia. Si el owner quería además
   una política para el retiro de un plan *dentro de una vertical viva*, **ésa no existe todavía**
   y el §3.4 la contesta al revés: el plan retirado sostiene a sus clientes indefinidamente.
2. **Y por eso la re-emisión de `DEC-GRANT-010` tiene un desenlace en el que no llega.** Una
   vertical discontinuada **queda cerrada a altas para siempre** (`B/10` §4.5, borde 4), así que
   en esa vertical no va a existir nunca la fila nueva que reciba el saldo. Re-emitirlo en **otra**
   vertical es lo que `DEC-GRANT-006` prohíbe por escrito. El saldo **no se pierde** —la fila
   queda, con su firma y sus días— pero **no emite nada**. Las salidas posibles son tres: dejarlo
   así y declararlo, cerrarlo devolviendo algo, o reabrir `DEC-GRANT-006` para este caso. **No se
   eligió ninguna.** Es el mismo hueco que `B/09` §3 ya dejó abierto para el saldo de una sucesora
   que abandona.
3. **El acto de la discontinuación sigue sin fila numerada, y no sólo para `PAUSED`.** `S11` no lo
   ejecuta —su evento es *«pide la baja»*, un acto del cliente sobre su propia fila— y `B/10` §4.3
   lo decide `SUPER_ADMIN` sobre la cartera entera de una vertical. Hoy ese movimiento cae en la
   regla 1 del núcleo desde `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED` y `PENDING_AUTHORIZATION`
   exactamente igual que caía desde `PAUSED`. `DEC-SUB-015` resolvió **a quién alcanza el piso**,
   no **qué transición lo ejecuta**.
4. **`G-R6` quedó acotado a las seis tablas de billing y la clase existe en las otras tres
   máquinas.** `DEC-TEST-001` nombró el catálogo de `B/20` §2, que es donde nació el defecto;
   extenderlo pide una fila en `V/20` §2, que la decisión no tomó. Es la misma historia de `G-R4` y
   `G-R5`, que nacieron en un catálogo y terminaron siendo referencias cruzadas.
5. **El catálogo de guards de `B/20` §2 no lista a `G12` ni a `G13`, que sí existen.** Los dos
   están en `B/descomposicion.md` (§2.2 y §3) con su unidad asignada, y el §2 de `B/20` se
   presenta como *«la lista, que es lo que permite preguntar «¿están todos?» una vez»*. **No se
   agregaron** porque agregarlos mueve la cifra de `DEC-TEST-001` (*«12 de 26»* / *«13 de 27»*),
   que es del owner y no mía, y porque el reparto de esos dos es de la descomposición y no de esta
   tanda. Queda anotado.
