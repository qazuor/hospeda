---
title: "FASE 9-bis-5 · rastro de la segunda tanda corta de decisiones (DEC-RF-005, DEC-SUB-017, DEC-TEST-002 y la condición de DEC-RF-004)"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9-bis-5
---

# Rastro — la segunda tanda corta de decisiones

**Base**: `10dbdcc54f` (el commit del owner con las cinco decisiones del cierre de la quinta vuelta).
**Los quince commits son míos**: `git log --format="%an %ad %h %s" 10dbdcc54f..HEAD` no devuelve
ningún commit del owner entre medio. **El decision log no se tocó**, y tampoco el PDR, la matriz,
los informes de la 8-bis-5, los rastros de la 9-bis-4 ni los seis rastros anteriores de esta tanda.

---

## 1. Los commits

| sha | qué cierra |
|---|---|
| `d587ba9404` | **`DEC-RF-005`.** `B/19` §6: la fila del motivo **7** gana el vínculo al evento crítico, y la fila del listado accionable declara que un vínculo existe |
| `90e986b1f2` | **`DEC-SUB-017`.** `B/12` §5.4: el encabezado, la rama del proveedor acotada a lo que la sonda 48 midió, y la rama local del pagador manual escrita entera |
| `d84af6cfe0` | **premisa ajena**: `B/12` §5.2 apoyaba su argumento en *«71 horas»*, una cifra que `DEC-SUB-016` partió en dos |
| `20f9634d38` | **`DEC-TEST-002`, el desarrollo.** `B/descomposicion` §4: el criterio de terminación sobre los escritores, con la forma que la familia 5 construyó para los guards |
| `be5ea3436f` | **`DEC-TEST-002`, el espejo.** `V/descomposicion` §4 |
| `cf55e2b143` | **`DEC-SUB-017`, el borde que no queda.** `B/12` §5.4: el instante de la recomputación es el último en que el caso puede ocurrir, y la transición en la que se apoya la debe el capítulo 13 |
| `1a7983dddb` | **premisas propias del catálogo**: las **dos** líneas de `B/20` §2 que afirmaban que esa clase *«no la vigila ninguno»* y que la dirección de escritores *«sigue rechazada»* |
| `abf392ed1d` | **premisa ajena**: `V/descomposicion` §2.8, el precio que declara al resolver `I1` |
| `43a6d138f0` | **conteo congelado**: las **dos** líneas del recuadro de `B/16` §4.3 que decían *«las diez»* donde la enumeración del mismo § dice **doce** |
| `483bbd1c7e` | **`DEC-RF-004`, la condición agregada (1/2).** `B/03` §3.2: recuento a **doce** y los **cinco** caminos que no son del cliente, con lo que cada uno trae o no trae |
| `af140227d5` | **`DEC-RF-004`, la condición agregada (2/2).** `B/19` §6: la fila del motivo **14** lo dice en voz alta |
| `0941cb8e1f` | **conteo congelado**: la tercera cita de *«las seis transiciones del `B/16` §4.3»*, en `B/03` §8 |
| `a4e2b64932` | **premisa ajena (2/3)**: `V/20` §2, el espejo de la mitad de escritores de `G-R6-B` |
| `4bcb3c50fb` | **premisa ajena (3/3)**: `V/02` §2.5, la **tercera** copia del mismo enunciado, encontrada al verificar que la corrección estuviera entera |

---

## 2. Qué se arregló

1. **El listado ENLAZA al evento del motivo 7, y la marca no guarda nada nuevo.** La fila del 7 en
   `B/19` §6 dice que la persona ve el motivo y, al lado, un vínculo a la condición que falló; que
   el vínculo **no copia** el dato, porque `B/05` §3 mandó que viva en el evento y eso no cambia; y
   **con qué se resuelve** — la suscripción, el motivo y `puesta_en`, que `reconciliation_mark` ya
   tiene (`B/02` §2.2), porque `S14` abre la marca y emite el evento en el mismo acto. **Cero
   columnas nuevas**, que es lo que `DEC-RF-005` compró.
2. **La fila del listado accionable declara que un vínculo puede existir**, para que las dos
   enumeraciones de *«qué muestra el listado»* no queden diciendo cosas distintas.
3. **`B/12` §5.4 dejó de tener una conclusión y pasa a tener dos ramas.** Sobre el preapproval
   `pending` del proveedor la conclusión de la sonda 48 está intacta; sobre el pagador manual —que
   no tiene preapproval— **la corrección se abre**, y el § dice cómo: el crédito se **recomputa**
   en el instante en que `MP1` estrena la fecha del próximo cobro, contra los pagos acreditados a
   ese instante.
4. **Esa corrección no agrega un escritor ni una columna, y se dice por qué.** `MP1` ya escribe esa
   fecha sobre un pagador manual —la escritura de `S2` tiene ahí población vacía—, así que las
   escrituras siguen siendo las que `B/02` §2.2 declara. Tampoco toca `D8`: la corrección sólo
   empuja la fecha hacia adelante.
5. **Y ese instante no deja borde, que es la comprobación que faltaba hacer.** `MP1` es el registro
   que habilita a la sucesora a llegar a `ACTIVE` (`B/03` §7.1), y llegar a `ACTIVE` dispara `S17`
   sobre la predecesora: **después de la recomputación no queda predecesora viva que renueve**, y
   antes de ella toda renovación está acreditada y la recomputación la ve. El otro final de la
   ventana —`S3`— no deja sucesora. Queda declarado que la fila que lleva a `ACTIVE` a un pagador
   manual **es una de las que el capítulo 13 todavía debe**.
6. **Un escritor declarado y no implementado bloquea la terminación de su unidad.** Los dos §4
   ganan la condición, con el mismo par desarrollo/espejo con que la familia 5 volvió exigibles los
   29 guards, y con la razón de por qué es un criterio y no un guard: un guard sobre esa clase sólo
   puede correr cuando exista el código.
7. **Las TRES líneas del corpus que cerraban esa clase en falso quedan corregidas** —`B/20` §2,
   `V/20` §2 y `V/02` §2.5—, y las tres siguen siendo verdaderas de lo que afirman: ningún **guard**
   la vigila.
8. **El conteo de las transiciones que dejan huérfano a un addon se recontó entero: son doce.**
   Tres citas decían **seis** o **diez** y ninguna de las tres coincidía con la enumeración del §
   que citan.
9. **La fila del motivo 14 dice en voz alta cuándo apartarse del default**, que es la condición
   obligatoria de la ampliación de `DEC-RF-004`: de las doce, **cinco** no son un acto del cliente,
   van nombradas una por una, y **`S27` y `S28` son las dos que más lo necesitan** porque no traen
   el piso de 60 días con el que las otras llegan compensadas.

---

## 3. Qué se grepeó

**Alcance**: los tres árboles de spec —`HOS-1352` (incluido `nucleo/`), `HOS-1353` (`V/`) y
`HOS-1354` (`B/`)—, **46 archivos**, **menos** el PDR, el decision log, la matriz, los informes de
fase (`14-` a `22-`), los rastros (`21-`, `23-`) y los directorios de sondas. Todo con y sin
backticks. **Las cuentas son por LÍNEA** y **los términos se superponen**: una línea que nombra
`S21` y `A5` a la vez cuenta en los dos, así que el total de abajo es de apariciones y no de líneas
distintas.

| término | viejo / nuevo | total | corregidas o escritas | a justificar |
|---|---|---|---|---|
| `enlaza` · `enlace` · `vínculo` · `vincula` | **nuevo** (`DEC-RF-005`) | 52 | 2 | 50 |
| *evento crítico* | el objeto que se enlaza | 12 | 2 | 10 |
| *cuatro condiciones* | lo que el evento dice | 14 | 1 | 13 |
| `PAGO_TARDÍO_RECHAZADO` | el motivo 7 | 8 | 1 | 7 |
| *listado accionable* | la superficie | 19 | 1 | 18 |
| *crédito* | el sujeto de `DEC-SUB-017` | 29 | 7 | 22 |
| *sonda 48* · `EX-39` | la medición que se acota | 9 | 1 | 8 |
| *escritor* · *escritores* | el sujeto de `DEC-TEST-002` | 51 | 8 | 43 |
| *criterio de terminación* | **nuevo** | 9 | 7 | 2 |
| `G-R6` | el guard cuya contrapartida se cierra | 58 | 2 | 56 |
| `COMPLEMENTO_CON_PERÍODO_COBRADO` · *motivo 14* · *el 14* · *del 14* | el motivo | 24 | 3 | 21 |
| `S21` | la transición que abre la marca | 70 | 2 | 68 |
| `A5` | el evento con sus tres cláusulas | 84 | 2 | 82 |
| `S17` | uno de los caminos nuestros | 86 | 5 | 81 |
| `S25` · `S26` · `S27` · `S28` | los otros tres, y el que los dispara | 94 | 8 | 86 |
| *las seis* · *seis transiciones* · *las diez* · *las doce* | **el conteo viejo y el nuevo** | 63 | 5 | 58 |
| *60 días* | el piso que compensa, o no | 29 | 2 | 27 |
| *pagador manual* · *pago manual* | la población de `DEC-SUB-017` | 115 | 7 | 108 |
| `default` | lo que el listado propone | 87 | 4 | 83 |
| **total** | | **913** | **70** | **843** |

> **Un falso positivo que hay que declarar porque infla el primer término si se grepea sin
> anclar**: `enlace` aparece **70** veces más como final de **`desenlace`**, que es otra palabra y
> otro sujeto. La tabla de arriba usa `(^|[^s])enlace`, así que esas 70 **no están contadas** en
> las 52. Ninguna de las 70 habla de un vínculo entre dos objetos.

---

## 4. Las 843 apariciones no corregidas, por grupo

### Grupo A — `enlace` / `vínculo` sobre otro objeto · 50 apariciones

**Las 50 nombran un vínculo que no es el del listado al evento, y son tres sujetos.** El
**`init_point` del checkout** —*«el enlace para retomar»*, con su fecha de vencimiento— en `B/03`
L259, L685, L1124, L1169, L1975, `B/12` L276 y `B/06` L200, que además mide que **viene roto**
(`EX-37`); el **`provider_link`**, o sea el vínculo de una fila con el recurso del proveedor, y su
reparación automática cuando una huérfana se re-vincula (`B/09` §2.4 L66, L68, L567, L595; `B/02`
L847; `B/21` L50, L163, L198; `1352/07` L36, L63, L68, L84; `1352/02` L319, L908; `1352/03` L433,
L450; `NUCLEO/08` L110; `1352/04` L73); y el **vínculo entre entidades del dominio** —el addon con
su título (`B/02` L397, L419), el addon con su suscripción de complemento (`B/16` L323, L499), la
postulación de Partner que *«no vincula nada»* hasta que la dirección se prueba (`V/18` L54, L136,
L141; `V/03` L219, L519; `V/descomposicion` L392; `1352/04` L414)—. **La cláusula que las salva es
la que ellas mismas escriben**: ninguna de las 50 dice *«el listado»*, *«la marca»* ni *«el evento
crítico»*, que son los tres términos del vínculo que `DEC-RF-005` creó. **Si alguna dijera que el
listado accionable no tiene ningún vínculo, sería falsa**; ninguna lo dice, porque hasta esta tanda
no había ninguno que negar.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L141, L259, L685, L1124, L1169, L1975 |
| `1352/03-handoff.md` | L254, L433, L450, L674, L705 |
| `B/09-conciliacion.md` | L66, L68, L567, L595 |
| `1352/07-facts-inventory.md` | L36, L63, L68, L84 |
| `1352/02-worklog.md` | L67, L319, L908 |
| `1352/04-open-decisions.md` | L73, L414, L512 |
| `1352/08-phase-1b-code-discovery.md` | L430, L2050, L2505 |
| `B/02-modelo-de-datos.md` | L397, L419, L847 |
| `B/21-migracion.md` | L50, L163, L198 |
| `V/18-partner.md` | L54, L136, L141 |
| `B/12-suscripcion.md` | L83, L276 |
| `B/16-addons.md` | L323, L499 |
| `B/spec.md` | L46, L227 |
| `V/03-maquinas-de-estado.md` | L219, L519 |
| `B/05-idempotencia-y-concurrencia.md` | L301 |
| `B/06-proveedor.md` | L200 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L110 |
| `1352/13-pliego-consulta-legal.md` | L116 |
| `V/descomposicion.md` | L392 |

### Grupo B — *«evento crítico»* y *«las cuatro condiciones»* sobre lo que el evento CONTIENE · 23 apariciones

**Las 23 cuantifican sobre qué lleva adentro el evento, o sobre cuál de las cuatro condiciones
falló, y ninguna sobre cómo se llega a él.** `NUCLEO/08` §4.3 (L250, L266, L284) **enumera los
campos** de cada entrada y encabeza la lista con *«cuál de las cuatro condiciones del cap. 05 §3
falló»*; `B/05` §3 (L211, L215, L223, L234, L239, L257, L313, L93) **define las cuatro** y decide
cuál motivo gana cuando el mismo hecho cae bajo dos §§; `B/02` L699 y L732 las nombran al declarar
el motivo 7 en la tabla de los catorce; `B/03` L126, L128, L135, L1306, L1769 y L1891 las nombran
como la condición que un `desde` o un tope leen. **`DEC-RF-005` no toca ninguno de esos dos
sujetos**: el contenido del evento es exactamente el que el corpus ya declara, y el reparto entre
evento y motivo es el que `B/05` §3 fijó y la decisión cita para no contradecirlo. **Si alguna
dijera que quien resuelve tiene que ir a buscar el evento por su cuenta, sería falsa**; la única
que lo decía —la fila del 7 en `B/19` §6— es la corregida.

| archivo | líneas |
|---|---|
| `B/03-maquinas-de-estado.md` | L126, L128, L135, L1306, L1769, L1891 |
| `B/05-idempotencia-y-concurrencia.md` | L93, L211, L215, L223, L234, L239, L257, L313 |
| `B/02-modelo-de-datos.md` | L125, L699, L732, L757 |
| `B/descomposicion.md` | L528, L529, L600 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L250, L266, L284 |
| `B/09-conciliacion.md` | L533, L534 |
| `1352/04-open-decisions.md` | L402 |
| `1352/05-phase-1a-domain-analysis.md` | L1138 |

### Grupo C — *«listado accionable»* sin enumerar qué muestra · 18 apariciones

**Las 18 nombran el listado como el canal y ninguna enumera sus campos.** Diez lo nombran como
**dónde aparece** un caso que otra regla abre —`B/05` L89 y L125 (`C2` y `C3`), `B/09` L475 y L521,
`B/12` L489 y L516, `B/16` L705, `B/02` L763, `B/03` L107, `B/20` L61—; cuatro lo nombran como
**el canal primario de `DEC-OBS-001`** frente al correo (`NUCLEO/08` L262 y L299, `NUCLEO/01` L575,
`B/descomposicion` L517); y cuatro son **registro de qué se decidió y cuándo** (`1352/02` L673,
`1352/03` L814, `1352/04` L404, `1352/05` L1146). **La enumeración de qué muestra el listado vive en
UN solo lugar** —la fila de `B/19` §6—, que es la corregida, y ninguna de las 18 la repite. **Si
alguna enumerara los campos del listado sin el vínculo, sería falsa**; ninguna los enumera.

| archivo | líneas |
|---|---|
| `B/05-idempotencia-y-concurrencia.md` | L89, L125 |
| `B/09-conciliacion.md` | L475, L521 |
| `B/12-suscripcion.md` | L489, L516 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L262, L299 |
| `B/02-modelo-de-datos.md` | L763 |
| `B/03-maquinas-de-estado.md` | L107 |
| `B/16-addons.md` | L705 |
| `B/20-testing.md` | L61 |
| `B/descomposicion.md` | L517 |
| `NUCLEO/01-glosario.md` | L575 |
| `1352/02-worklog.md` | L673 |
| `1352/03-handoff.md` | L814 |
| `1352/04-open-decisions.md` | L404 |
| `1352/05-phase-1a-domain-analysis.md` | L1146 |

### Grupo D — *«crédito»* que no es el de una sucesora, o que no cuantifica sobre cuándo se computa · 22 apariciones

**Las 22 se parten en tres sujetos y ninguno es el instante del cómputo.** Ocho hablan de un
**crédito que no es el de `DEC-SUB-006`** —el crédito de una tarjeta, un saldo a favor genérico o lo
que se registró de la base vieja (`1352/03` L1007, `1352/04` L160, L297, L298, L299, `1352/05` L535,
`1352/10` L769, L786)—. Nueve cuantifican sobre **de qué se computa**, que es la forma congelada del
§5.2 y la que la corrección local respeta al pie de la letra: *«a partir de los pagos acreditados,
nunca a partir de los días transcurridos»* (`B/12` L317, L320, L323, L355, `B/05` L328, `B/20` L152,
L169, `B/03` L387, L1093). Cinco cuantifican sobre **cuánto vale el crédito en un caso concreto** —
cero en grace, o el que corre la fecha de primer cobro del arrepentimiento (`B/12` L450, L484, L610,
L612, `B/03` L1525)—. **La corrección local no mueve ninguno de los tres**: recomputar más tarde lee
**los mismos pagos acreditados** y deja el valor donde la fórmula lo pone. **Si alguna dijera que el
crédito se computa una sola vez y no se vuelve a computar nunca, sería falsa**; ninguna lo dice —
`B/03` L1072 dice *«como cualquier otra, al crear la sucesora»*, que es de dónde sale y no cuántas
veces se lee.

| archivo | líneas |
|---|---|
| `B/12-suscripcion.md` | L317, L320, L323, L355, L450, L484, L610, L612 |
| `1352/04-open-decisions.md` | L160, L297, L298, L299 |
| `B/03-maquinas-de-estado.md` | L387, L1093, L1525 |
| `B/20-testing.md` | L152, L169 |
| `1352/10-evaluacion-de-proveedor.md` | L769, L786 |
| `1352/03-handoff.md` | L1007 |
| `1352/05-phase-1a-domain-analysis.md` | L535 |
| `B/05-idempotencia-y-concurrencia.md` | L328 |

### Grupo E — *«sonda 48»* / `EX-39` acotados al proveedor en su propia cláusula · 8 apariciones

**Las 8 citan la medición y las 8 nombran al proveedor en la misma frase.** `B/02` L265 la cita
bajo el encabezado ***«Con débito**, las fechas las tiene el proveedor y son inmutables para
nosotros»*, que es la rama que la decisión deja intacta y **declara su alcance en la primera
palabra**; `B/03` L1811 dice *«sobre un pagador **con tarjeta** no hay nada que reimputar: las
fechas las tiene el proveedor»*; `B/05` L330 y `B/12` L452 la citan como *«las fechas **del
proveedor** son inmutables»*; `B/14` L138 y L374 la citan como el **control** que sí movió el monto
sobre un preapproval `pending`. `B/12` L619 y L627 son la tabla de la sonda y su control, que
describen qué se midió. **Ninguna de las 8 afirma nada sobre una fecha que no esté en el
proveedor**, y por eso `DEC-SUB-017` no las alcanza: la rama que abre es exactamente la población
donde no hay preapproval. **Si alguna dijera *«y tampoco se puede corregir sobre un pagador
manual»*, sería falsa**; ninguna lo dice.

| archivo | líneas |
|---|---|
| `B/12-suscripcion.md` | L452, L619, L627 |
| `B/14-promos-cortesias-y-grants.md` | L138, L374 |
| `B/02-modelo-de-datos.md` | L265 |
| `B/03-maquinas-de-estado.md` | L1811 |
| `B/05-idempotencia-y-concurrencia.md` | L330 |

### Grupo F — *«pagador manual»* sobre el resto de su mecanismo · 108 apariciones

**Las 108 cuantifican sobre partes de su máquina que esta tanda no movió**, y son cinco sujetos:
las cinco filas `MP*` y sus cuotas (`B/03` §7 entero), que **no tiene preapproval** (`B/06` L214,
L232; `B/09` L120-L140), qué pasa con él en cada transición que cancela —*«sobre un pagador manual
no se manda nada»*— (`B/03` `S23`, `S24`, `S25`, `S27`, `S28`), el aviso al admin (`NUCLEO/07`
L214, L226, L285) y el reparto de unidades (`B/descomposicion` L231, `1352/11` L172). **Lo único
que `DEC-SUB-017` le da al pagador manual es una corrección del crédito de su SUCESORA**, y ninguna
de las 108 habla del crédito de una sucesora: las que sí lo hacen están en el grupo D o entre las
corregidas. **Si alguna afirmara que sobre un pagador manual no hay nada que corregir porque las
fechas no se mueven, sería falsa**; ninguna lo afirma, y la única que rozaba el tema —`B/02` §2.2,
*«sin débito es la única copia que existe»*— dice justo lo contrario y por eso sostiene la
corrección en vez de contradecirla.

### Grupo G — *«escritor»* sobre otra columna o sobre otra pregunta · 43 apariciones

**Las 43 se parten en cuatro sujetos y ninguno es *«el escritor declarado está implementado»*.**
Trece cuantifican sobre **los cuatro escritores de `listing.inactiva_desde`** y sobre qué mitad de
`G-R6-B` los mira (`V/20` L66, L74, L80, L87, L93, L113, L123, L131, L153, L184; `V/02` L310, L337,
L346); diez son **inventario de lo medido en el código que ya existe** (`1352/08`, nueve líneas, más
`B/20` L124); doce nombran **quién es el segundo escritor de una columna concreta** —`S25` sobre el
`saldo_días` (`B/02` L348, L807, L812; `B/14` L417), el cierre del §4.3 sobre `inactiva_desde`
(`B/10` L238), el acumulador de la marca (`B/02` L74), el catálogo contado sobre los escritores que
hay hoy (`B/02` L683, L708), y `NUCLEO/01` L100, L127, L496, L578—; y ocho cuantifican sobre **el
predicado de `G-R6`** y sobre cuántas escrituras tiene la fecha del próximo cobro (`B/20` L188,
L197, L216, L256, L265; `V/descomposicion` L118, L127, L258). **La condición nueva no cambia
ninguno de esos cuatro**: no agrega ni quita escritores, no toca ninguna lista cerrada y no cambia
qué verifica ningún guard — **exige que lo declarado esté construido cuando la unidad se declara
lista**, que es una pregunta que ninguna de las 43 hace. **Si alguna dijera que un escritor
declarado y no implementado no lo mira nada, sería falsa**; las dos que lo decían (`B/20` L218-219
y su espejo de `V/20` L156) están corregidas.

| archivo | líneas |
|---|---|
| `V/20-testing.md` | L66, L74, L80, L87, L93, L113, L123, L131, L153, L184 |
| `1352/08-phase-1b-code-discovery.md` | L1231, L1236, L1241, L4619, L5879, L5897, L5911, L5984, L6271 |
| `B/02-modelo-de-datos.md` | L74, L348, L683, L708, L807, L812 |
| `B/20-testing.md` | L124, L188, L197, L216, L256, L265 |
| `NUCLEO/01-glosario.md` | L100, L127, L496, L578 |
| `V/02-modelo-de-datos.md` | L310, L337, L346 |
| `V/descomposicion.md` | L118, L127, L258 |
| `B/10-verticales-planes-billing-options.md` | L238 |
| `B/14-promos-cortesias-y-grants.md` | L417 |

### Grupo H — `G-R6` sobre su predicado, su dominio o su reparto · 56 apariciones

**Las 56 cuantifican sobre tres cosas del guard y ninguna sobre lo que NO verifica.** Qué compara
—columnas leídas contra columnas escritas— y cómo se rompe a propósito (`B/20` L62, L63, L174,
L239-L242; `V/20` L65, L66, L68, L92, L108, L140, L143, L174, L237, L242); **cuál es su dominio**,
las nueve máquinas de las dos épicas contra las tablas declaradas (`V/02` L247, L306-L345; `B/10`
L236, L239; `B/03` L1672; `V/15` L251, L263; `NUCLEO/01` L59-L137); y **a qué unidad va y cuántos
guards hay**, que es el reparto de la quinta enmienda (`B/20` L304-L353; `V/descomposicion` L57-L367;
`B/descomposicion` L566). **`DEC-TEST-002` no le agrega ni le quita un predicado al guard**, y eso
es una afirmación de la decisión misma —*«es un criterio de terminación, no un guard»*— que el
párrafo corregido de `B/20` §2 repite en su última línea. **Si alguna de las 56 afirmara que `G-R6`
verifica que el escritor esté implementado, sería falsa**; ninguna lo afirma, y la que declara lo
contrario es la que ahora además dice quién sí lo exige.

### Grupo I — *«criterio de terminación»* de otra unidad · 2 apariciones

**Las 2 nombran el criterio de una unidad concreta y no la lista de condiciones que valen para
todas.** `B/descomposicion` L404 dice que *«el criterio de terminación de `B7` quedó describiendo el
comportamiento que la tanda reemplazó»* —es sobre el pago tardío y `S19`— y L526 lo repite al
introducir esa corrección. **Las dos cuantifican sobre el contenido de UNA fila de la tabla del §4**,
y la condición nueva es transversal y está **fuera** de la tabla, exactamente como la de los guards.
**Si alguna dijera que el §4 es sólo la tabla, sería falsa**; ninguna lo dice.

### Grupo J — el motivo **14**, `S21` y `A5` sobre su mecanismo · 171 apariciones

**Las 171 cuantifican sobre el mecanismo de la marca y de las tres transiciones, no sobre de qué
lado cae cada disparador.** Son cinco sujetos, y la condición agregada no mueve ninguno: que `S21`
**no manda nada al proveedor** porque el preapproval es uno (`B/16` §4.4, `B/02` §2.4); que es
**idempotente** y su condición se reevalúa (`B/03` §3.2); que **no agrega un par** al conteo de
`G-R4` ni una comprobación al barrido (`B/03`, `B/09` §3, `NUCLEO/03` §1); **desde dónde sale `A5`,
con qué eventos y sobre qué scopes** (`B/16` §4.2 y §4.3, `B/03` §8); y **la condición que acota la
población** —*«el último cobro paga un período que todavía no terminó»*— (`B/03` L890, L955, L974,
L983, L985; `B/16` L694, L704, L723; `NUCLEO/08` L142, L169). **La condición que esta tanda agrega
es de superficie**: dice en voz alta, en la fila del listado, qué caminos hay detrás del disparador
2. **No agrega ninguna escritura, ningún dato en la marca y ninguna rama nueva al default** —que
sigue siendo `DEVOLVER` en la tercera cláusula de `A5` y `NO DEVOLVER` en los otros tres—, así que
las 171 siguen diciendo lo que verificaban. **Si alguna dijera que el disparador 2 es siempre un
acto del cliente, sería falsa**; ninguna lo dice, y la que se ocupaba de negarlo (`B/03` §3.2) es la
corregida.

### Grupo K — `S17`, `S25`, `S26`, `S27` y `S28` sobre su propio mecanismo · 167 apariciones

**Las 167 cuantifican sobre qué hace cada transición y ninguna sobre qué se propone devolver
cuando deja huérfano a un addon.** Los sujetos son cuatro: **el `desde`, el evento y la condición**
de cada una (`B/03` §3.2, las filas); **qué se manda al proveedor**, con la regla de relectura de
`S17` como referencia común (`B/03`, `B/09`, `B/16`); **qué se escribe de nuestro lado** —`fin_real`
en la pausa, el `saldo_días` diferido, el candado `A` que se libera, la ventana de `MP4` que se
cierra— (`B/02`, `B/14`, `B/03` §7.1); y **el reparto por unidades y el aviso** (`B/descomposicion`,
`NUCLEO/07`, `V/03`). **Lo que esta tanda dice de ellas es una sola cosa —que `S17`, `S25`, `S27` y
`S28` son actos deliberados nuestros, y que `S26` es el que pone el `CANCEL_SCHEDULED` que `S12`
consuma— y eso no es una propiedad de ninguna de las transiciones sino de la lista que las
contiene**, que vive en `B/16` §4.3 y en `B/03` §3.2, los dos corregidos. **Si alguna afirmara que
las transiciones que sacan a una principal de las filas vivas son seis o diez, sería falsa**; las
tres que lo decían están corregidas y ninguna otra las cuenta.

### Grupo L — *«las seis»*, *«las diez»* y *«las doce»* de OTROS conjuntos · 58 apariciones

**Las 58 cuantifican sobre conjuntos que no son las transiciones de `B/16` §4.3, y se recontaron
contra el documento dueño de cada uno antes de dejarlas.** Los conjuntos son siete: **las seis ramas
de `B/12` §5.3** —el destino de un pago retenido por `S19`— (`B/03` L449, L1456, `B/09` L267,
`B/12` L489, L592, `B/19` L211, `NUCLEO/04` L176, L177, L181); **las seis comprobaciones de cero
llamadas de `B/09` §3** (`B/09` L446, `B/16` L728, `B/02` L696); **las seis filas vivas de una
suscripción** (`NUCLEO/01` L418, L529, `B/02` L537); **las doce acciones administrativas del
`NUCLEO/08` §3** (`B/03` L1391, `B/19` L187, `V/17` L229, L246, L259); **las seis filas de una tabla
del cap. 03** (`B/03` L468); **los conjuntos del inventario de código y del registro de la fase**
(`1352/02`, `1352/03`, `1352/04`, `1352/05`, `1352/08`, `1352/11`, `1352/12`, `1352/13`); y **los
conteos de guards y de unidades** (`B/20` L231, `V/20` L69, L216, `B/descomposicion` L32, L384,
`B/spec` L155, `V/spec` L111). **`B/16` L539 es la línea que ya decía doce** y es la enumeración
contra la que se recontaron las tres citas corregidas. **Si alguna de las 58 dijera *«las seis que
sacan a una fila principal de las filas vivas»*, sería falsa**; ninguna lo dice — las tres que lo
decían son `B/16` L562, L567 y `B/03` L1955, las tres corregidas.

| archivo | líneas |
|---|---|
| `1352/08-phase-1b-code-discovery.md` | L1294, L1465, L1893, L2169, L3309, L4147, L4797, L4798, L4972 |
| `1352/03-handoff.md` | L152, L209, L300, L494, L1309, L1378 |
| `NUCLEO/04-invariantes.md` | L176, L177, L181, L256, L269 |
| `1352/02-worklog.md` | L726, L844, L945, L1088 |
| `B/03-maquinas-de-estado.md` | L449, L468, L1391, L1456 |
| `1352/13-pliego-consulta-legal.md` | L57, L107, L221 |
| `V/17-autorizacion.md` | L229, L246, L259 |
| `1352/04-open-decisions.md` | L404, L463 |
| `B/02-modelo-de-datos.md` | L537, L696 |
| `B/09-conciliacion.md` | L267, L446 |
| `B/12-suscripcion.md` | L489, L592 |
| `B/16-addons.md` | L539, L728 |
| `B/19-superficies.md` | L187, L211 |
| `B/descomposicion.md` | L32, L384 |
| `NUCLEO/01-glosario.md` | L418, L529 |
| `V/20-testing.md` | L69, L216 |
| `1352/05-phase-1a-domain-analysis.md` | L1346 |
| `1352/11-particion-del-programa.md` | L54 |
| `1352/12-contrato-de-cobertura.md` | L669 |
| `B/20-testing.md` | L231 |
| `B/spec.md` | L155 |
| `V/spec.md` | L111 |

### Grupo M — *«60 días»* de otro piso o de otro plazo · 27 apariciones

**Las 27 cuantifican sobre el piso de la discontinuación, sobre la ventana de una pausa o sobre un
plazo legal, y ninguna sobre qué compensa el piso a un COMPLEMENTO.** Once son **el piso del `B/10`
§4.3 y §4.4** visto desde la principal —qué día es, cómo se calcula y a quién alcanza (`B/10` L104,
L196, L248, `B/03` L148, L149, L637, `B/19` L120, `B/12` L562, `B/descomposicion` L601, `NUCLEO/07`
L213, L224)—; cuatro son **la ventana de 60 días de una pausa o de un cambio de precio** (`B/12`
L177, L717, L722, `B/22` L89); y doce son **el registro de qué se decidió y los plazos del pliego
legal** (`1352/04` L82, L84, L300, L310, `1352/05` L343, L1029, `1352/13` L59, L67, L75, L167, L184,
`B/22` L133). **Lo que esta tanda afirma sobre el piso es que `S27` y `S28` no lo traen**, y eso no
lo contradice ninguna de las 27: las que dicen quién entra al piso lo dicen por estado —`ACTIVE` y
`GRACE_PERIOD` sí, `SUSPENDED` y `PENDING_AUTHORIZATION` no— que es exactamente lo que `DEC-SUB-018`
ratificó. **Si alguna dijera que toda fila alcanzada por la discontinuación recibe el piso, sería
falsa**; ninguna lo dice, y la tabla de `B/03` §5 que reparte los cuatro estados es la que lo
impide.

### Grupo N — `default` de un valor o de otro motivo · 83 apariciones

**Las 83 se parten en tres sujetos y ninguno es la condición que la fila del 14 agrega.** Cuarenta
viven en `08-phase-1b-code-discovery.md` y cuantifican sobre **valores por omisión del código que ya
existe**; veinte son **defaults de otros motivos o de otras configuraciones** —el del 7, el de la
rama 6, los diez días de `DEC-SUB-002`, el de una campaña—; y las restantes son **propiedades del
default que valen para las siete filas por igual**: que se propone sobre **todos** los pagos de la
marca, que **no ejecuta nada** y que un default vacío ya falló. **La condición agregada no cambia
qué propone el 14 en ninguno de sus cuatro disparadores** —sigue `DEVOLVER` en la tercera cláusula
de `A5` y `NO DEVOLVER` en los otros tres—, así que las tres cifras que el §6 congela siguen siendo
las mismas: **siete** filas, **cinco** con default único, **una** por rama y **una** sin propuesta.
**Si alguna dijera que el default del 14 se lee sin mirar el disparador, sería falsa**; las que lo
decían están corregidas desde la tanda anterior (`rastro-e8f63e45f.md`, grupo F).

---

## 5. Premisas ajenas que el arreglo volvió falsas, y se corrigieron en el mismo acto

1. **`B/20` §2 — *«la clase «lo declarado no está construido» … no la vigila este guard y **no la
   vigila ninguno**»*.** Verdadera hasta `DEC-TEST-002`. **Corregida en `B/20` L218-219**
   (`1a7983dddb`), conservando lo que sí sigue siendo cierto: ningún **guard** la vigila.
2. **`B/20` §2, sobre `G-R6-B` — *«Para escritores la dirección simétrica sigue rechazada»*.**
   **Corregida en `B/20` L256-261** (`1a7983dddb`): sigue rechazada **como guard**, y la cubre un
   criterio.
3. **`V/20` §2 — el espejo de la anterior, *«Queda afuera, con su razón»*.** **Corregida en
   `V/20` L156** (`a4e2b64932`).
4. **`V/02` §2.5 — la TERCERA copia del mismo enunciado, *«Para los cuatro escritores la dirección
   simétrica sigue deliberadamente afuera»*.** **Corregida** (`4bcb3c50fb`). **Apareció al verificar
   la fila 3, no al escribirla**, que es exactamente el modo de falla que el §4 de las instrucciones
   llama *«ejecutada a la mitad»*: el grep de *«sigue rechazada»* y *«queda afuera»* devolvía dos y
   el de *«dirección simétrica»* devuelve **tres**. **Con ésta son las tres apariciones del corpus y
   no queda ninguna**, verificado con `rg 'dirección simétrica'` sobre los 46 archivos.
5. **`V/descomposicion` §2.8 — *«Lo que a cambio **no** verifica … es que el escritor declarado esté
   implementado»*.** Sigue siendo verdadera del guard y se le agregó **quién sí lo exige**
   (`abf392ed1d`).
6. **`B/12` §5.2 — *«que puede ser **71 horas** después»*.** `DEC-SUB-016` partió esa ventana en dos
   y el barrido de la tanda anterior no la alcanzó porque la línea no dice *«72»*. **Corregida en
   `B/12` L333-337** (`d84af6cfe0`); el argumento del § —*«con un día la fecha ya pasó durante casi
   toda la ventana»*— **se refuerza** con el plazo más largo. **Es la única aparición de una cifra
   de la ventana de `S3` escrita en horas y distinta de 72**: `rg '\bhoras\b'` sobre el corpus
   devuelve **14** líneas y las otras 13 son la ventana de `S3` dicha en 72 (tres), la revisión
   manual del proveedor, el reloj de dos sondas, la regla de husos horarios, los plazos de la Ley
   24.240, el cron de revalidación y el registro de la fase.
7. **`B/16` §4.3 — *«las **diez** transiciones»*, dos veces en el mismo recuadro.** La enumeración
   del propio § dice **doce** desde la familia 4. **Corregidas las dos** (`43a6d138f0`), que son las
   dos únicas apariciones de *«diez»* en ese archivo — `rg '\bdiez\b'` sobre él devuelve ahora cero.
8. **`B/03` §8 — *«Cualquiera de las **seis** transiciones del `B/16` §4.3 sirve»*.** **Corregida**
   (`0941cb8e1f`). Con las tres correcciones anteriores, **el corpus entero cuenta doce**: `rg 'las
   (seis|diez) transiciones'` sobre los 46 archivos devuelve **una sola línea**, y es la **cita
   textual** de la ampliación de `DEC-RF-004` que el recuadro nuevo de `B/03` §3.2 reproduce para
   decir en qué difiere. Ninguna afirmación del corpus cuenta seis ni diez.
9. **`B/03` §3.2 — *«los dos caminos nuestros llegan con su propia plata ya resuelta en otro lado —
   la discontinuación con el piso de 60 días»*.** **Falsa para `S27` y `S28`**, que `DEC-SUB-018` y
   sus propias filas mandan a `CANCELLED` y `ABANDONED` **sin pasar por el piso**. **Corregida**
   (`483bbd1c7e`), separando cuáles traen compensación y cuáles no.

---

## 6. Lo que este rastro vuelve falso de los anteriores

1. **`rastro-e8f63e45f.md` (la tanda corta anterior), §7 pregunta 2 — *«de las **seis**
   transiciones que dejan huérfano a un addon»*.** **No es caducidad: era falsa el día que se
   escribió.** `B/16` §4.3 ya decía **las doce** en su línea de encabezado en el commit
   `458ce804f8`, anterior a esa tanda —verificado con `git show 458ce804f8:…/16-addons.md`—, y el
   *«seis»* es **el primer tramo de su enumeración** leído como si fuera la lista entera. La cifra
   viajó de ahí a `B/03` §3.2 y de ahí a la ampliación de `DEC-RF-004`, que la cita. **Las tres
   citas del corpus están corregidas; la del decision log no se toca** (regla dura) y queda como
   pregunta al owner (§7).
2. **`rastro-e8f63e45f.md`, §2 punto 4, §5 *«Lo que NO se corrigió y se declara»* y §7 pregunta 1 —
   las tres describen `B/12` §5.4 como concluyendo *«no hay corrección»* con la pregunta abierta.**
   **Caducas desde `90e986b1f2`**: el § tiene dos ramas, la local está escrita y la pregunta la
   contestó `DEC-SUB-017`. Es el desenlace buscado, igual que pasó con `DEC-SUB-016`.
3. **`rastro-93eb0a1dc.md` (familia 1), §5 — *«un escritor declarado y no implementado pasa en
   verde, y esa clase no la vigila nada»*.** **Caduca desde `20f9634d38`**: pasa en verde, sí, y la
   clase la vigila un criterio de terminación. Esa línea es exactamente la que `DEC-TEST-002` vino
   a cerrar, así que la caducidad es el desenlace buscado.
4. **`rastro-458ce804f8.md` (familia 4), §5 fila 11 — *«`B/16` §4.2: «las transiciones que la
   cumplen son **las diez**» → **las doce**, con `S27` y `S28`»*.** **La corrección que esa fila
   declara quedó ejecutada a la mitad**: movió la línea de encabezado y dejó **dos** apariciones de
   *«las diez»* en el recuadro del mismo §, más **una** de *«las seis»* en `B/03` §8. Es la clase de
   fila que el §4 de las instrucciones llama *«la más falsable del rastro»*, y es la segunda vez que
   le pasa a esta serie. **No corrijo ese rastro** —las reglas duras lo prohíben— y **sí corregí las
   tres apariciones** (`43a6d138f0`, `0941cb8e1f`).
5. **Y me pasó a mí en la misma tanda, así que va declarado con el mismo nombre.** La fila 3 de mi
   §5 decía, al escribirla, que las apariciones del enunciado de escritores eran **dos** y estaban
   las dos corregidas. **Eran tres**: `V/02` §2.5 llevaba la tercera, y apareció sólo porque
   verifiqué la afirmación con un grep antes de commitear el rastro (`4bcb3c50fb`). **La fila quedó
   reescrita con la cifra medida**, y el método que la encontró es el que hay que repetir: una fila
   del §5 se verifica con el `rg` que su propia redacción promete, no con el recuerdo de qué se
   editó.
6. **Ningún rastro de la 9-bis-5 ni de la 9-bis-4 afirma nada sobre el vínculo del listado al
   evento**, que es el otro sujeto que moví: `rastro-d3bd02332.md` describe el motivo 7 y su salida
   declarada sin afirmar dónde se lee la condición que falló, y esa descripción sigue siendo
   verdadera.

---

## 7. Preguntas para el owner

**Es una, y va en la respuesta de esta tanda.**

1. **La ampliación de `DEC-RF-004` está escrita sobre un conteo que no es el del corpus, y la
   decisión no cambia por eso pero su alcance sí.** El log dice *«De las **seis** transiciones que
   dejan huérfano un addon (`B/16` §4.3), **dos no son del cliente**»*. Medido sobre esa misma
   enumeración: son **doce**, y **cinco** no son un acto del cliente —`S17`; `S12` cuando su
   `CANCEL_SCHEDULED` lo puso `S26`; y `S25`, `S27` y `S28`—. El criterio de la decisión se sostiene
   igual o mejor con cinco, y la condición obligatoria está implementada sobre los cinco. **Lo que
   queda para el owner es si la cifra del decision log se corrige** —no la toqué, por regla dura— **y
   si con cinco caminos, dos de ellos sin ninguna compensación de por medio (`S27` y `S28`, a los
   que `DEC-SUB-018` les niega el piso de 60 días), el default del disparador 2 sigue siendo el
   correcto o pasa a merecer la partición que la decisión descartó por mecanismo.**
**Y una que estuvo a punto de ser la segunda y NO lo es, dicho porque el camino para descartarla
es el que importa.** La corrección local queda atada a `MP1`, y parecía dejar afuera el caso en que
la predecesora renueva **después** de que `MP1` corrió —lo que habría pedido una cuarta escritura de
una columna que `B/02` §2.2 declara cerrada en tres—. **Ese caso no existe**: `MP1` es el registro
que habilita a la sucesora a llegar a `ACTIVE` (`B/03` §7.1), y llegar a `ACTIVE` dispara `S17`
sobre la predecesora, que la lleva a `CANCELLED`. Después de la recomputación no hay predecesora
viva que renueve. **Estaba escrita como pregunta y la medición la contestó**, que es lo que
`DEC-METH-012` pide antes de afirmar sobre una cláusula entera.
