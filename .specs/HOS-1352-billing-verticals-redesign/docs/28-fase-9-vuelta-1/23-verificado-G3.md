---
title: "FASE 9 vuelta 1 · G3 verificado — el desempate de motivos y la conciliación"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G3 verificado

Verificación de los 18 hallazgos de `03-G3-motivos-y-conciliacion.md` (R4, R12 y los sueltos de
`B2`/`B3`) contra el texto vigente del worktree al 2026-09-26, con `G3-1` = **2** (la lápida del
corte sale del desempate y de la comparación de cobros) y `G3-2` = **1** (lápida de recepción).
Criterio: `DEC-METH-004`, opción 3. Abreviaturas: `B/NN` es
`.specs/HOS-1354-billing-cobro-y-proveedor/docs/NN-*.md`; `D/16` es
`.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`. Las líneas de
`13-aplicado-G3.md` corrieron por ediciones de otros grupos; acá van las de hoy.

## 1. Resumen

| hallazgo | veredicto | línea vigente que lo corta o lo declara |
|---|---|---|
| `F-8V1B2-003` | DEJA | `B/09:137` «sobre cualquier otra, el motivo que asigna la tabla de desempate del `B/05` §3» |
| `F-8V1B3-002` | DECLARADO | `B/21:380` «El cobro en vuelo del corte que sale bien se asienta sobre la lápida sin marca y no se» |
| `F-8V1B2-002` | DEJA | `B/03:157` «`max(fin_de_servicio vigente, la fórmula recalculada)`: una extensión nunca acorta» |
| `F-8V1B1-007` | DECLARADO | `B/05:318` «Y lo que no desempata por decisión: la lápida del corte» |
| `F-8V1C2-013` | DECLARADO | `B/05:321` «se asienta sobre la lápida sin marca: no reactiva nada, no extiende nada y no se le» |
| `F-8V1B3-004` | DEJA | `B/02:51` «El `external_reference` de todo preapproval que crea el sistema nuevo es el `id` de su fila de `subscription`» |
| `F-8V1B2-007` | DEJA | `B/09:839` «sólo si su `external_reference` nombra esta fila: el que nombra otra fila nuestra es de la búsqueda de ésa» |
| `F-8V1B2-008` | DEJA | `B/09:839` «Tras una búsqueda vacía, la corrida siguiente vuelve a crear, con una clave nueva acuñada y persistida» |
| `F-8V1B2-001` | DEJA | `B/03:161` «escribe `levantada_en` contra la versión de la marca que leyó» |
| `F-8V1B3-001` | DEJA | `B/09:83` «si no nombra ninguna, de una lápida de recepción» |
| `F-8V1B2-004` | DEJA | `B/03:2737` «cuyo reloj del §4 ya se agotó: eso es `S6` por su primer evento» |
| `F-8V1B2-005` | **SIGUE** | `B/03:1480` «fila con una marca `requiere_conciliación` abierta no puede ser sucedida —cualquiera sea su motivo, y ningún `sucede_a`» |
| `F-8V1B2-006` | DEJA | `B/03:177` «`S31` se escribe en la misma transacción que la escritura de `S6` —o de `S12`— que la dispara» |
| `F-8V1B3-005` | DECLARADO | `D/16:305` «Una autorización viva que el recorrido sin filtro no devuelve sobrevive al corte» |
| `F-8V1B2-009` | DEJA | `B/03:152` «sobre una fila `ACTIVE`, que no tiene grace que apagar, lo que corre es `P1` sobre ese cobro» |
| `F-8V1B2-010` | DEJA | `B/02:948` «`S14`, desde la rama de fallo de `S10` o de `S33`» |
| `F-8V1B2-011` | DEJA | `B/03:1599` «proveedor (§10.1), con las salvedades de ese par que alcanzan al grace» |
| `F-8V1B3-007` | DEJA | `B/09:195` «el aviso de cancelación existe sólo si la cancelación se aplicó (`EX-15` mide que cancelar sí notifica)» |

**Conteo**: 13 DEJA, 1 SIGUE, 4 DECLARADO, 0 OTRA.

Notas por veredicto, donde el renglón no alcanza:

- **`F-8V1B3-002`**: el camino de los cobros **históricos** del sistema viejo deja de llegar (la
  lápida del corte no entra a la comparación de cobros, `B/09:137`). El cobro **en vuelo** queda
  como residuo declarado por `G3-1`, con causa, población y detector en `B/21:380-397`.
- **`F-8V1B1-007`**: la mitad `CHARGE_DECLINED` **deja** (`B/05:307`, primera fila); la mitad de la
  lápida es el residuo de `G3-1`. Se cuenta como DECLARADO porque es la mitad con plata.
- **`F-8V1C2-013`**: la lápida ya no cae en el comodín; tampoco en ningún motivo, por decisión. El
  *NO cierra* de `B/21` lo nombra por su ID (`B/21:381-382`).
- **`F-8V1B2-004`**: el primer evento deja; el segundo y el tercero quedan declarados en el *NO
  cierra* de `B/03` (`B/03:2972`), con causa y detector (la marca `CONTRACARGO`).
- **`F-8V1B2-008`**: el camino de Juan (segundo `pending` creado mientras el primero no estaba
  indexado) se corta si el tardío aparece con la fila todavía en `PENDING_AUTHORIZATION`; el que
  aparece después de `S2` es residuo declarado en `B/09:983`.
- **`F-8V1B2-005` — por qué SIGUE.** La mitad del par que el hallazgo nombraba primero (monto
  distinto sobre la predecesora) **deja**: `B/05:352-355` manda todo a `S19` *falle la condición que
  falle*. Pero el paso 3 del camino —*si además hace cumplir el invariante*, la sucesión hay que
  matarla— sigue llegando por dos textos que el arreglo no tocó:
  1. `B/03` §3.3 conserva la lectura de invariante, en la gemela de la frase que se corrigió en
     `B/02:256`: *ningún `sucede_a` puede apuntarla* (`B/03:1480-1481`). Una marca `COBRO_DUPLICADO`
     que `P1` abre sobre la predecesora en curso —el propio `B/05:356` la manda ahí— choca con eso.
  2. El mismo párrafo de `B/05` se contradice: la frase nueva dice *falle la condición que falle*
     y dos líneas más abajo sigue *Cualquier otra forma de fallar la 3 —otra fila viva que no es su
     sucesora, o la segunda mitad— sigue siendo divergencia y sigue poniendo la marca*
     (`B/05:361-363`), con el argumento *una fila marcada no puede ser sucedida* (`B/05:361`), que
     `B/02:258-260` ya retiró. El par (predecesora en curso, falla la segunda mitad de la 3) tiene
     otra vez dos filas.

## 2. Racimos

### 2.1 R4 — el dominio de 17 casos × tres productores

Recorrido de cada caso del dominio declarado (`03-` §2.1) contra el texto vigente, con
`G3-1` = 2 y `G3-2` = 1. **E** = el evento del cobro; **B** = la comparación de cobros del
barrido; **R** = la re-vinculación.

| # | estado al llegar el cobro | E: dónde se contesta | B: dónde se contesta | ¿cubierto? |
|---|---|---|---|---|
| 1 | `PENDING_AUTHORIZATION` | `B/05:311-312`, relee y corre `S2` | `B/05:328` + `B/02:959`: abre `19`, y el asiento es `P1` | E sí; B **parcial** (N-G3V-02) |
| 2 | `ACTIVE`, período en curso | `B/05:313`, `P1` | `B/09:137`, `19` | sí |
| 3 | `GRACE_PERIOD` | `B/05:266-269`, las cuatro condiciones; tabla `B/05:305-309` | `B/09:137`, relectura de `S6` → `S5`; si falla una condición, la tabla | sí |
| 4 | `SUSPENDED` | `B/05:266-269`, cuatro condiciones → `S7` o tabla | fuera de la lista de `B/05:311-316`; si las cuatro se cumplen la tabla no asigna nada | E sí; B **no** (N-G3V-01) |
| 5 | predecesora de una sucesión en curso | `B/05:352-355`, `S19` | `B/05:315-316` la da por receptora → `19` → asiento `P1`, no `S19` | E sí, con la contradicción de §1; B **parcial** (N-G3V-02) |
| 6 | `PAUSED`, cobro anterior a la pausa | `B/05:314`, `P1` | `19` | sí |
| 7 | `PAUSED`, cobro posterior | `B/05:309`, `7` | `B/09:137` → tabla → `7` | sí |
| 8 | `CANCEL_SCHEDULED` de `S11`, cobro anterior | `B/05:113`, `C2` fila 1 con `max` | `B/05:315` → `19` → asiento `P1`, sin la extensión | E sí; B **parcial** (N-G3V-02) |
| 9 | `CANCEL_SCHEDULED` de `S26`, cobro anterior | `B/05:113`, `B/03:172`, `max` conserva el piso | ídem 8 | E sí; B **parcial** (N-G3V-02) |
| 10 | `CANCEL_SCHEDULED` (`S7`, `S11`, `S26`), cobro posterior | `B/05:307`, `2` | `B/02:940`, `2` | sí |
| 11 | `CANCELLED` por acto nuestro, del cliente o espejo | `B/05:307`, `2` | `B/02:940`, `2` | sí (salvo `S36`, N-G3V-04, sin efecto de plata) |
| 12 | `CANCELLED` por `S13` o `S20` | `B/05:308`, `3` | `B/02:941`, `3` | sí |
| 13 | `CANCELLED`, lápida del corte | `B/05:318-324`, se asienta sin marca | `B/09:137`, no compara | **declarado** (`G3-1`, `B/21:380`) |
| 14 | `ABANDONED` (`S3`, `S28`, `S31`) | `B/05:307`, `2` | `2` | sí |
| 15 | `CHARGE_DECLINED` (`S16`) | `B/05:307`, `2` | `2` | sí |
| 16 | desconocido que nombra una fila vinculada | R: `B/09:79-81`, `7` con cobro, `6` sin él; `B/05:309` | — | sí |
| 17 | desconocido que no nombra ninguna fila | R: `B/09:82-88`, lápida de recepción + `7`/`6` | tras levantar la marca, ninguna salvedad la barre | E/R sí; B **no** (N-G3V-03) |

**Resultado: el dominio de R4 NO queda cubierto.** El productor **E** contesta los 17 casos (el
13 por decisión). El productor **B** deja un caso sin respuesta (4), cuatro con respuesta
incompleta (1, 5, 8, 9: se abre el motivo correcto pero su asiento saltea la regla de recepción
de la fila) y el 17 sin barrido después de levantar la marca. Los cinco miembros del racimo, cada
uno sobre su propia fila, dejan de llegar o quedan declarados (§1). Lo que queda abierto son
**gemelas** de las filas que los hallazgos nombraban: van en §3.

### 2.2 R12 — el vínculo fila ↔ preapproval

| caso | barrido de creaciones | re-vinculación | ¿cubierto? |
|---|---|---|---|
| (a) nombra esta fila, uno solo | `B/09:839`, se reusa | `B/09:76-79`: se re-vincula si la fila no tiene `provider_link`; si lo tiene, `7`/`6` | sí |
| (b) nombra otra fila nuestra | `B/09:839`, no se toca | `B/09:76-79`, ídem (a) sobre esa fila | sí |
| (c) no nombra ninguna fila | `B/09:839`, no se reusa nunca | `B/09:82-88`, lápida de recepción | sí |
| (d) más de un `pending` nombra esta fila | `B/09:839`, el más reciente, los otros se cancelan sin correo; escritura admitida en `B/09:854` | no aplica | sí |
| fila sin vínculo / ya vinculada | `B/02:51`, `UNIQUE(subscription_id)`; «vivo» = existe | `B/21:183-184`, misma lectura | sí |
| tras búsqueda vacía | `B/09:839`, se recrea con clave nueva; mientras siga `PENDING_AUTHORIZATION` cancela los tardíos | — | sí; el tardío posterior a `S2` declarado en `B/09:983` |

**Resultado: el dominio de R12 queda cubierto.** No encontré caso vecino con plata.

## 3. Hallazgos nuevos (casos vecinos)

### N-G3V-01 — ALTA · El barrido no tiene motivo para un cobro sin registrar sobre una `SUSPENDED` cuyas cuatro condiciones se cumplen

**Qué se rompe.** El arreglo de R4 le dio al barrido dos salidas: `19` sobre una fila *que puede
recibir el cobro* —una lista cerrada que no incluye `GRACE_PERIOD` ni `SUSPENDED`— y *el motivo
que esta tabla asigna* sobre cualquier otra. Pero la tabla sólo asigna motivos a **fallas** de las
cuatro condiciones. Sobre una `SUSPENDED` con un cobro legítimo —el que estaba en vuelo cuando
`S6` canceló—, el evento correría `S7`; el barrido no escribe estado y no tiene motivo que abrir.
`GRACE_PERIOD` se salva porque `B/09:137` le da la relectura de `S6` → `S5`; `SUSPENDED` no tiene
esa salvedad. El `03-` §2.1 decía para el caso 4, B: *`19`, igual que hoy*. El texto aplicado lo
sacó de la lista.

**Camino de Juan.**

1. Se agota el grace de Juan. En el instante en que `S6` cancela el preapproval, el reintento de la
   cuota ya estaba en vuelo y cobra. `S6` escribe `SUSPENDED` y la ficha deja de emitir.
2. El aviso de ese cobro se pierde (`WH-5`).
3. El barrido de esa noche ve un registro `approved` sin `payment` sobre una `SUSPENDED`. No está en
   la lista de lo que puede recibir, así que no abre `19`. La tabla no asigna motivo porque ninguna
   condición falla.
4. Un implementador no abre nada: Juan pagó el período, sigue suspendido y nadie lo ve. Otro abre
   `7` por comodín, y la bandeja le propone devolver un cobro que debía reactivarlo.

**Evidencia.**

| dónde | cita |
|---|---|
| `B/05:311` | «Lo que este § no desempata, porque la fila puede recibir el cobro» |
| `B/05:328` | «El barrido abre `COBRO_SIN_REGISTRAR` sólo sobre una fila que puede» |
| `B/05:329` | «recibir el cobro. Sobre cualquier otra abre el motivo que esta tabla asigna, con el cobro» |
| `B/05:268` | «la suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED`» |
| `B/05:278` | «que lo que puede llegar ahí es sólo un borde —un cobro que ya estaba en vuelo en el instante de» |

**Qué haría falta.** Que el barrido, sobre una `GRACE_PERIOD` o `SUSPENDED` cuyas cuatro condiciones
se cumplen, abra `19` (asentar, con el asiento corriendo `S5`/`S7`) o que `SUSPENDED` tenga la misma
relectura que ya tiene el grace. Es aplicación: el `03-` ya había escrito el primer destino.

### N-G3V-02 — ALTA · El asiento del motivo 19 es `P1` a secas, y saltea la regla de recepción de las filas que no son `ACTIVE`

**Qué se rompe.** La lista de lo que *puede recibir el cobro* (`B/05:311-316`) nombra cinco filas, y
cada una recibe el cobro por un camino distinto: `S2` para la `PENDING_AUTHORIZATION`, `P1` para la
`ACTIVE` y la `PAUSED`, la extensión con `max` de `C2` para la `CANCEL_SCHEDULED`, la retención de
`S19` para la predecesora. El barrido abre `19` sobre las cinco, y el motivo 19 dice que asentar *es
crear la fila de `payment` en `PENDING` … y correr `P1`*. `P1` no extiende la fecha de fin de
servicio ni retiene: la extensión vive en `C2` del evento y la retención en `S19`. El `03-` escribía
para el caso 5, B: *el asiento entra por `S19`*; el texto aplicado no lo dice en ningún lado.

**Camino de Juan (caso 9).**

1. Juan está en `GRACE_PERIOD`. El día 0 se discontinúa su vertical: `S26` lo lleva a
   `CANCEL_SCHEDULED` con fin de servicio el día 60.
2. El reintento de octubre ya había cobrado (anterior a la baja) y el aviso se pierde.
3. El barrido ve el `approved` sin `payment`: la fila *puede recibir*, así que abre `19`.
4. La operadora sigue la instrucción del 19: crea el `payment` y corre `P1`. Nadie aplica la regla
   de `C2` fila 1. En el caso de `S11` (caso 8), la fecha de fin no se extiende y Juan pierde el
   período que pagó.

**Camino de Juan (caso 5).** La predecesora de Juan está en una sucesión en curso. El cobro de su
período impago se aprueba y el aviso se pierde. El barrido abre `19` y la operadora corre `P1`: el
pago queda acreditado y no retenido. Al cerrar la sucesión, `S18` no encuentra el pago de `S19`, así
que las ramas 1, 5 y 6 de `B/12` §5.3 no abren `REEMBOLSO_POR_CONFIRMAR`. Juan pagó el período viejo
y el nuevo, y a nadie se le propone devolverle nada.

**Evidencia.**

| dónde | cita |
|---|---|
| `B/02:959` | «asentarlo es crear la fila de `payment` en `PENDING` con el id del registro y correr `P1` sobre ella» |
| `B/05:315` | «con el cobro anterior a la cancelación (§2 `C2`, primera fila); y la predecesora de una sucesión» |
| `B/05:113` | «Se extiende la fecha de fin de servicio hasta cubrirlo —con `max` sobre la fecha vigente» |
| `B/03:1761` | «El período que escribe en `covered_period` sale de la fecha del propio registro de cobro» |

**Qué haría falta.** Una frase en el motivo 19 (`B/02` §2.5) y en `B/09` §3: el asiento corre la
regla con la que esa fila recibe el cobro —`S2`, `P1`, `C2` fila 1 con `max`, o `S19`—, la misma que
nombra la lista de `B/05` §3.

### N-G3V-03 — MEDIA · La lápida de recepción no está en la tabla de puertas terminales ni en las salvedades, y *la lápida* de la salvedad 4 quedó ambigua

**Qué se rompe.** El criterio de exención de `B/09` §3 pregunta quién dejó al preapproval sin poder
cobrar. El de una lápida de recepción no lo dejó nadie: sigue vivo, y en el caso de `D/16:305` es la
autorización de un cliente que el censo no vio. La tabla de puertas terminales tiene una fila para
*la lápida del corte* y ninguna para la de recepción. La salvedad 4 y el par del §10.1 dicen *y la
lápida*, que desde `G3-2` nombra a dos filas. Leída como la del corte, la de recepción sólo vuelve al
barrido mientras tenga marca abierta (salvedad 2). Leída como las dos, el barrido le *reintenta* a
la de recepción una cancelación que nadie decidió. Ningún texto manda cancelar ese preapproval.

**Camino de Juan.**

1. El censo no vio el preapproval viejo de Juan. Un mes después del corte cobra: el handler escribe
   la lápida de recepción y abre `7`. La operadora devuelve y levanta la marca por `S15`.
2. Nadie cancela el preapproval, porque ni el motivo 7 ni `B/09` §2.4 lo piden.
3. Al mes siguiente vuelve a cobrar y el aviso se pierde. La lápida, sin marca abierta, no está en
   ninguna salvedad: el barrido no la mira. El cobro no lo ve nadie.

**Evidencia.**

| dónde | cita |
|---|---|
| `B/09:83` | «si no nombra ninguna, de una lápida de recepción» |
| `B/09:185` | `la **lápida** del corte → CANCELLED` es la única fila de lápida de la tabla (sin cita literal: la celda contiene comillas anidadas) |
| `B/09:195` | «`S25`, `S27`, `S28`, `S31`, `S36` y la lápida» |
| `B/02:72` | «de la de recepción se puede levantar y el cobro siguiente del mismo preapproval no puede caer en» |

**Qué haría falta.** Decir si la lápida de recepción entra a la salvedad 4 —y entonces quién decide
cancelar su preapproval— o que el motivo 7 sobre una lápida de recepción incluya cancelarlo. Es una
frase, pero decide si el sistema cancela solo la autorización de un cliente: puede ser del owner.

### N-G3V-04 — BAJA · `S36` falta en la enumeración de la primera fila del desempate y en las salidas del grace

**Qué se rompe.** `S36` (G5-4) sale de `ACTIVE`, `GRACE_PERIOD` o `CANCEL_SCHEDULED` hacia
`CANCELLED`. La primera fila del desempate (`B/05:307`) lo cubre por **criterio** —*un acto nuestro*—
pero su enumeración no lo nombra, que es el defecto de raíz de R4. Y la lista de salidas del grace
(`B/03:1595-1599`), que `F-8V1B2-011` acaba de completar con el espejo, no nombra `S36`: es la gemela
exacta de ese hallazgo. Sin efecto de plata (el criterio manda a `2`, y el `2` y el `7` llevan
**SÍ**).

**Camino de Juan.** Juan, en el grace, revoca dentro de los 10 días: una persona corre `S36`. Un
implementador que lee §4 no encuentra esa salida; y un cobro en vuelo sobre la fila de `S36` cae,
para quien lea la lista y no el criterio, en el comodín `7`.

**Evidencia.**

| dónde | cita |
|---|---|
| `B/03:182` | «una persona registra la revocación del derecho de arrepentimiento que el cliente pidió por el canal que sea» |
| `B/03:1595` | «Entra por `S4` y sale por `S5`, por `S6` o por» |
| `B/05:307` | «`CANCELLED` por `S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31` o el espejo» |

### N-G3V-05 — BAJA · La atribución falsa a `EX-15` sobrevive en tres gemelas

**Qué se rompe.** `F-8V1B3-007` se corrigió en las dos frases de `B/09`. La misma afirmación —cancelar
no emite webhook— sigue en `B/02`, que además la **cita** como si fuera el texto vigente de la
salvedad 4, en `B/03` atribuida a `EX-15`, y en `B/16`.

**Camino de Juan.** Un implementador que arma el handler desde `B/03` §3.2 no espera el aviso de
cancelación y trata el que llega como huérfano; el que lee `B/02` cita una frase que `B/09` ya no dice.

**Evidencia.**

| dónde | cita |
|---|---|
| `B/02:83` | «cancelar no emite webhook, así que si la» |
| `B/03:849` | «mutar o cancelar no emite webhook, así que el primer aviso sería que el cobro no llega» |
| `B/16:784` | «que ya no es cliente — y como mutar o cancelar no emite webhook, nadie se entera desde adentro» |

## 4. Texto vencido y contradicciones

- **`B/05:241-242` sigue diciendo que el barrido abre `COBRO_SIN_REGISTRAR` sin condición.** Es la
  línea que `F-8V1B2-003` citaba, y no se tocó: el mismo capítulo dice setenta líneas más abajo que
  lo abre *sólo* sobre una fila que puede recibir (`B/05:328`). La autoridad normativa (`B/09:137`,
  `B/02:959`) ya está bien, por eso el hallazgo cuenta DEJA; falta la salvedad en §2.
- **`B/05:361-363`** — contradicción interna del párrafo de la excepción, descrita en §1
  (`F-8V1B2-005`).
- **`B/03:1480-1481`** — la lectura de invariante de la marca (*ningún `sucede_a` puede apuntarla*),
  gemela de la frase corregida en `B/02:256`.
- **`13-aplicado-G3.md`** cita líneas que ya corrieron (por ejemplo `B/09:189` para `EX-15`, hoy
  `B/09:195`; `B/02:945` para el motivo 8, hoy `B/02:948`). No es un error del registro: lo avisa en
  su encabezado.

## Key Learnings

1. Un desempate que reparte fallas no contesta el caso en que nada falla: al pasarle el segundo
   productor a la tabla, `SUSPENDED` con las cuatro condiciones cumplidas quedó sin salida, porque la
   lista de *puede recibir* se escribió pensando en el evento, que sí corre `S7`.
2. *Puede recibir el cobro* son cinco filas con cinco formas de recibirlo. Mandarlas todas al mismo
   motivo con la misma instrucción de asiento (`P1`) borra la extensión de `C2` y la retención de
   `S19`: el motivo correcto con el asiento equivocado mueve plata igual.
3. Partir una fila en dos formas (`origen_de_lápida`) vuelve ambiguo todo texto que decía *la
   lápida* en singular. Hay que barrer cada mención y decidir a cuál de las dos se refiere.
4. La corrección de una frase tiene gemelas en otros capítulos que la citan o la repiten
   (`EX-15`: cuatro lugares, se corrigieron dos). `rg` sobre la afirmación, no sobre el ID del hallazgo.
5. Una fila nueva de la máquina (`S36`) llegó después de que R4 y `F-8V1B2-011` escribieran sus
   enumeraciones. El criterio la cubre y la lista no, que es exactamente la causa que R4 vino a cerrar.
