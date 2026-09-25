---
title: "FASE 9-bis-5 · rastro de la familia 2 — el pagador manual"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9-bis-5
---

# Rastro de la familia 2 — el pagador manual

Cierra el **crítico #4** de la FASE 8-bis-5 —`F-8fB1-001` (`CRITICA`) y `F-8fB1-004` (`ALTA`)—.
**Seis commits sobre el corpus de diseño**, más el de este rastro, sobre **siete** archivos.

---

## 1. Los commits

| sha | qué cierra |
|---|---|
| `7a92b4da4` | **`F-8fB1-001`** — el tope de la fecha se retira y lo reemplaza la **reimputación de la cuota**: si el período que la cuota cubre ya terminó, `MP4` la reimputa al que arranca en la reactivación |
| `44e3d963a` | **`F-8fB1-004`** — **la primera cuota de un pagador manual no abre grace**: la abre el alta, en `PENDING_AUTHORIZATION`, donde `S4` no alcanza, y su final es `ABANDONED` por `S3` |
| `cbd3e7093` | mismo crítico, la mitad que faltaba: **el alta es `S1`**, que ya existe, y el período de esa primera cuota es **el instante del alta**, porque ahí todavía no hay fecha que copiar |
| `c73326233` | premisa ajena: `S3 → ABANDONED` gana **la misma salvedad de `S23` y `S24`** en `B/09` §3 — sobre un pagador manual no hubo llamada que confirmar |
| `34678ded3` | cuatro cuantificadores del §7 que las dos cláusulas de `MP5` dejaban al borde (el título del §7.2, el recuadro del §7.1, *«el único estado desde el que `MP5` crea»* y el aviso al admin) |
| `2e58663f7` | el inventario de *«lo que `MP4` escribe»* suma el `período` reimputado, y el evento de dominio lleva el viejo |

---

## 2. Qué se arregló

1. **El tope de la fecha no existe más.** Dejaba la fecha del próximo cobro **en el instante de la
   reactivación**, y la condición de `MP5` es *«ya llegó»*: sobre la única población en la que el
   tope corría —la suspensión más larga que un período— el que volvía liquidaba con `MP4` el
   período que había pasado suspendido, `MP5` le abría en la misma corrida el que arrancaba, y `S4`
   lo devolvía a `GRACE_PERIOD` el mismo día. **Dos períodos cobrados, cero días comprados.**
2. **El remedio no es una fecha: es a qué período se imputa la plata.** `MP4` **reimputa** la cuota
   —le reescribe el `período` sobre la misma fila que `MP2` o `MP3` cerraron— cuando el período que
   cubría **ya terminó**, y el avance de un ciclo sale de ahí: la fecha queda en **la reactivación
   más un ciclo** y el pago compra **un período entero de servicio**.
3. **Y así la mitad (b) se cumple literal.** *«El que vuelve paga el período que arranca, no los que
   pasó suspendido»*: paga **el que arranca y nada más**, y los períodos que transcurrieron bajo la
   suspensión no se cobran ni quedan como deuda.
4. **La reimputación no mueve ninguna de las cuatro condiciones del `B/05` §3**, y está dicho
   condición por condición: la **2** no depende del período porque el monto se resuelve de la
   versión de plan anclada; la **4** se evalúa sobre el período reimputado, donde no hay otra cuota
   porque durante la suspensión no se creó ninguna; la **1** y la **3** no nombran período.
5. **Se asienta.** La reimputación va en el evento de dominio de `MP4` —regla 4 del `NUCLEO/03`
   §1—, con el período que la cuota tenía y el que pasó a cubrir. Es la única escritura del
   `período` que no es la de su creación, y `B/02` §2.3 la declara como tal.
6. **La regla del §4.3 de `B/12` alcanza al pagador manual, y lo que faltaba era su ejecutor.** Lo
   que se lee *«por autorización»* es el **predicado de `S16`** —el remedio—, no la regla; que el
   remedio no tenga sujeto la deja sin ejecutor, no inaplicable. El §7.2 sacaba de ahí la
   conclusión invertida (*«no cae en el §4.3»*).
7. **El ejecutor: la primera cuota no abre grace.** La abre la cláusula *(b)* de `MP5` **en `S1`**,
   con la fila en `PENDING_AUTHORIZATION`, que **no emite fuente**; `S4` no la alcanza porque su
   `desde` es `ACTIVE`; y si nadie transfiere, `S3` lleva la fila a `ABANDONED` —terminal, no vivo,
   candado `A` libre, reintento como alta nueva—, que es el desenlace que `CHARGE_DECLINED` le da
   al pagador con tarjeta. La cuota se cierra por la segunda cláusula de `MP3`.
8. **La garantía de no-repetición del `B/12` §4.5 punto 1 gana sujeto**: *«cada reintento muere sin
   pasar por `GRACE_PERIOD`»* son **dos destinos y no uno**, y sobre el pagador manual el servicio
   recibido es **ninguno**, no *«los minutos de `PA-3`»*.
9. **`MP5` gana una cláusula y no un par.** El par sigue siendo `(sin fila, se abre la cuota de un
   período)` con una sola fila, como `S9` tiene tres disparadores y `A5` tres cláusulas sin sumar
   pares. `G-R4` no se mueve.
10. **El período de la primera cuota es el instante del alta**, porque en `PENDING_AUTHORIZATION`
    la fecha del próximo cobro todavía no existe; y sobre un pagador manual **la escritura 1
    —*«la estrena `S2`»*— tiene población vacía**, así que la estrena `MP1` al registrarla. **Sigue
    habiendo tres escrituras**, no cuatro.

---

## 3. Qué se grepeó

**Términos NUEVOS que esta familia introduce**: *«reimputa»* / *«reimputación»* / *«reimputado»* ·
*«el período que la cuota cubre ya terminó»* · *«la reactivación más un ciclo»* · *«la primera
cuota»* como sujeto · *«cláusula (a)»* / *«cláusula (b)»* de `MP5` · *«el instante del alta»* ·
*«no abre grace»*.

**Términos VIEJOS que se retiran o se estrechan**, grepeados aparte porque el consumidor no
actualizado no aparece buscando el nuevo: *«el instante de la reactivación»* **como valor de la
fecha** · *«un tope»* / *«el tope»* **en el sentido de la fecha** —separado a mano del tope de la
reapertura (condición 1 del `B/05` §3) y del tope de pausa de `D16`, que **no se tocan**— ·
*«re-anclaje»* / *«re-ancla»* · *«la cuota la crea un reloj»* · *«es la entrada de esta máquina»* ·
*«Sólo corre con la suscripción en `ACTIVE`»* · *«el único estado desde el que `MP5` crea»* ·
*«no cae en el §4.3»* · *«`CHARGE_DECLINED` tiene acá población vacía»* · *«se agota el grace»*
como evento único de `MP3` · *«la estrena `S2`»*.

**Términos de ANCLA**, grepeados porque son los sujetos sobre los que el arreglo se apoya: `MP1` ·
`MP2` · `MP3` · `MP4` · `MP5` · `S1` · `S3` · `S4` · `S16` · `S23` · `AWAITING` ·
`DECLARED_UNPAID` · `manual_payment` · `CHARGE_DECLINED` · *«pago manual»* / *«pagador manual»* /
*«pagos manuales»* · *«la fecha del próximo cobro»* · *«cuota»* / *«cuotas»* · *«lo adeudado»* ·
*«mitad (b)»* · *«el grace no es un beneficio de entrada»* · `DEC-SUB-002` · `DEC-SUB-012` ·
`DEC-SUB-013`.

**Alcance**: los **46 archivos** del corpus de diseño —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, la partición y los documentos de medición—,
construidos con `fd -e md` sobre los tres directorios quitando los informes de fase (`14-…` a
`23-…`), el PDR, las probes, **el decision log y la matriz** (que el alcance de `DEC-METH-011`
excluye por definición y que las reglas duras prohíben tocar). Con y sin backticks, **incluidos los
siete archivos del corpus que la familia toca**, contados con `git diff --name-only`.

**Medido sobre el árbol en `2e58663f7`**: **471** líneas con al menos una aparición; **228** las
tocaron los commits de la familia y **243** no, y son las que van abajo. La partición se calculó
con los rangos `+` de `git diff --unified=0 0dd6c7be6..2e58663f7` proyectados sobre los bloques
separados por línea en blanco —el párrafo es la unidad que `DEC-METH-011` fija—, no a ojo.

> **Una advertencia sobre el barrido.** *«Cuota»* es el término más productivo del corpus y el más
> contaminado: **75 de las 243** apariciones no corregidas son la **cuota de un entitlement
> medido** —un tope de consumo mensual—, que comparte la palabra con la cuota del pago manual y no
> comparte nada más. Van agrupadas y nombradas como lo que son, porque contarlas como hallazgos
> habría enterrado las que sí son del pago manual.

---

## 4. Las 243 apariciones no corregidas, una por una

### Grupo A — *«cuota»* de un ENTITLEMENT MEDIDO, no del pago manual · 75 apariciones

**Las 75 cuantifican sobre un tope de consumo** —*«dos cuotas: la del plan y la del trial»*,
*«`DEC-ENT-002` fijó que se resetean todos los meses»*, *«una cuota necesita a quién imputarla»*— y
el cuantificador es correcto para ese sujeto. **Ninguna de las 75 nombra una fila de
`manual_payment`, un período de facturación ni una obligación de pago**, que son los tres sujetos
que los commits de esta familia mueven; una cuota de consumo no se abre, no se registra, no se
reimputa y no manda a nadie a `GRACE_PERIOD`. **Si alguna dijera *«la cuota se abre»* o *«la cuota
se paga»*, sería falsa**; ninguna lo dice: todas la resetean, la consumen o la imputan a un `user`.

| archivo | líneas |
|---|---|
| `02-worklog.md` | L220, L221, L242 |
| `04-open-decisions.md` | L228, L229, L284, L338 |
| `05-phase-1a-domain-analysis.md` | L324, L326, L702, L704, L705, L1362 |
| `08-phase-1b-code-discovery.md` | L1221, L1225, L1303, L1391, L1502, L1546, L1554, L2337, L2922 |
| `11-particion-del-programa.md` | L62 |
| `12-contrato-de-cobertura.md` | L671 |
| `NUCLEO/01-glosario.md` | L227, L229, L636, L645 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L118, L248, L274, L276 |
| `V/02-modelo-de-datos.md` | L45 |
| `V/11-trial.md` | L179, L184, L189, L192, L196, L202, L204, L206, L209, L212, L215, L430 |
| `V/15-entitlements-y-limits.md` | L233, L384, L386, L443 |
| `V/spec.md` | L221, L344 |
| `B/03` | L67, L348, L361, L1329, L1373, L1375, L1379, L1386, L1524, L1584, L1586, L1624, L1626, L1638, L1655 |
| `B/05` | L291, L298 |
| `B/10` | L95 |
| `B/12` | L67, L252, L369, L400, L403, L460 |

> **Las quince de `B/03` y las seis de `B/12` son el caso ambiguo y por eso van revisadas una por
> una, no por el grupo.** **Ocho** son la cuota del **proveedor** en `recycling` —`B/03` L67, L348,
> L361 y `B/12` L67, L252, L369, L400, L460—, que es un objeto del proveedor y no una fila de
> `manual_payment`. Las **trece** restantes sí son la cuota del pago manual, en cláusulas que la
> familia no mueve: la **idempotencia del reloj** (*«correr dos veces no crea dos cuotas»*), la
> **mitad (b)** (*«si estuvo `SUSPENDED` no se crearon cuotas»*), la **cortesía** (*«abrir una
> cuota durante una cortesía sería cobrarle la cortesía»*), el **catálogo de doce acciones**, el
> **aviso**, y la narración **histórica** del defecto que `MP5` cerró. **Ninguna de las trece dice
> quién abre la primera cuota ni a qué período se imputa el pago que `MP4` registra**, que es lo
> único que los commits cambian; `B/03` L1379 es la que más cerca pasa —*«pagada la primera cuota
> el reloj no volvía a encontrar nada»*— y cuantifica sobre el estado **anterior** a `MP5`, que es
> lo que ese párrafo narra.

### Grupo B — `CHARGE_DECLINED` del pagador con TARJETA · 22 apariciones

**Las 22 cuantifican sobre una suscripción CON autorización** —*«autorizó y el primer cobro de esa
autorización se rechazó»*, *«el proveedor la canceló al rechazarlo»*, *«`ABANDONED`, `CANCELLED` y
`CHARGE_DECLINED` no tienen autorización que pueda cobrar»*— y **siguen siendo exactas sobre esa
población, que es la única sobre la que el estado existe**. El arreglo **no le agrega ni le quita
una entrada a `CHARGE_DECLINED`**: sobre un pagador manual ese estado sigue teniendo **población
vacía**, y lo que cambió es que el §7.2 ya no deriva de esa población vacía que la regla del §4.3
no se aplique. Los conteos que estas líneas llevan —*«siguen siendo nueve»* estados,
*«`ABANDONED` y `CHARGE_DECLINED`»* como los dos terminales sin autorización, *«las diez
transiciones»* de `B/16`— **no se mueven**, porque la familia no agrega ninguna transición a un
estado terminal. **Si alguna dijera *«todo el que no paga su primer cobro muere en
`CHARGE_DECLINED`»*, sería falsa**; ninguna lo dice: todas nombran la autorización.

| archivo | líneas |
|---|---|
| `02-worklog.md` | L996 |
| `03-handoff.md` | L333 |
| `12-contrato-de-cobertura.md` | L329 |
| `NUCLEO/01-glosario.md` | L300, L378 |
| `V/03` | L195 |
| `B/02` | L162 |
| `B/03` | L51, L53, L76, L183, L256, L1317, L1733 |
| `B/09` | L96, L109 |
| `B/12` | L206, L230, L280 |
| `B/16` | L386, L387, L539 |

### Grupo D — el pagador manual como MÉTODO sin débito en el proveedor · 45 apariciones

**Las 45 cuantifican sobre la capacidad del método** —*«no tiene débito en el proveedor»*, *«no
tiene nada que pausar porque no hay débito que detener»*, *«el §17.2 lo admite en Partner»*,
*«cómo se registra un pago manual es del capítulo 13»*— y **el arreglo no le devuelve ni le retira
ninguna capacidad**: sigue sin preapproval, sigue sin pausa, sigue sin débito. Lo que la familia
cambia es **cuándo se abre su cuota y a qué período se imputa su pago**, que ninguna de las 45
nombra. **Si alguna dijera *«el pagador manual entra al grace como el resto»* o *«su cuota la abre
siempre un reloj»*, sería falsa**; ninguna lo dice.

| archivo | líneas |
|---|---|
| `04-open-decisions.md` | L402 |
| `05-phase-1a-domain-analysis.md` | L396, L1108, L1129 |
| `11-particion-del-programa.md` | L161 |
| `NUCLEO/00-indice.md` | L108 |
| `NUCLEO/03-maquinas-de-estado.md` | L17 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L273 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L138 |
| `V/03` | L17 |
| `V/18-partner.md` | L178, L188 |
| `V/20` | L71 |
| `B/descomposicion` | L231 |
| `B/02` | L274, L279, L701 |
| `B/03` | L17, L84, L363, L367, L378, L385, L1093, L1116, L1124, L1143, L1164, L1195, L1197, L1214, L1465, L1499, L1611, L1616, L1622, L1980 |
| `B/05` | L148, L296 |
| `B/06` | L211, L229 |
| `B/09` | L136 |
| `B/20` | L160, L175 |
| `B/spec.md` | L47 |

> **Dos de estas piden nombrarse aparte.** `05-phase-1a-domain-analysis.md` **L396** cita el PDR
> —*«§30 lo repite para pagos manuales: `GRACE_PERIOD` durante 10 días»*— y **es una cita del PDR,
> que esta fase no edita**; lo que el arreglo acota es **la primera** cuota, y el §7 de `B/03` lo
> dice ahora en el párrafo que el §30 interpreta, que es donde vive la interpretación. `B/03`
> **L1195-1197** —*«lo que este tope NO acota»*— habla del **tope de la reapertura**, o sea de la
> condición 1 del `B/05` §3, que **esta familia no toca**: es el otro tope, y la homonimia es
> exactamente el riesgo que el §3 de este rastro separó a mano.

### Grupo E — `DEC-SUB-002` como *«los días de grace los declara la versión de plan»* · 12 apariciones

**Las 12 cuantifican sobre la DURACIÓN del grace y su origen** —*«en DB por plan, default 10»*,
*«los días que declara la versión de plan»*, *«un schedule relativo al vencimiento»*— y **el
arreglo no toca ni la cifra ni de dónde sale**. Lo que acota es **sobre qué cuota corre ese grace**
—no sobre la primera de un pagador manual—, que es una cuestión de población y no de duración.
**Si alguna dijera *«todo cobro que falla abre esos días»*, sería falsa**; ninguna lo dice: todas
hablan de cuántos son y quién los declara.

| archivo | líneas |
|---|---|
| `02-worklog.md` | L224 |
| `03-handoff.md` | L777 |
| `04-open-decisions.md` | L232 |
| `08-phase-1b-code-discovery.md` | L1005 |
| `NUCLEO/01-glosario.md` | L168 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L292 |
| `V/10` | L79 |
| `B/03` | L996, L1006, L1374 |
| `B/06` | L324 |
| `B/12` | L33 |

### Grupo F — *«el grace no es un beneficio de entrada»* fuera del §4.3 · 3 apariciones

Son las tres que quedan después de que el commit `44e3d963a` reescribiera el §4.3 y el §4.5 punto
1 de `B/12` y el párrafo *«cómo entra el grace»* de `B/03` §7.2.

- **`B/12` L205** es **el enunciado de la regla**, en el blockquote del §4.3: *«El grace no es un
  beneficio de entrada. Una suscripción cuyo primer cobro de esa autorización se rechaza no pasa
  por `GRACE_PERIOD`: va a `CHARGE_DECLINED`, que es terminal»*. **Sigue correcta y no se toca a
  propósito**: su segunda oración cuantifica sobre *«esa autorización»* y es el remedio de la
  población que autoriza, que no cambió; el párrafo que el commit agregó **debajo** es el que dice
  que la primera oración es la regla y la segunda uno de sus dos remedios. Reescribir el
  blockquote habría borrado la distinción en vez de escribirla.
- **`B/12` L588** —*«el reloj existe para acotar el servicio regalado a quien no pagó (§4.3: «el
  grace no es un beneficio de entrada»)»*, en el §5.3— cita la regla **por su fundamento** y sobre
  una fila que **ya pagó al menos un período** (es la predecesora de una sucesión con una cuota
  impaga). Sigue correcta: el arreglo va en la misma dirección, y esa población no es la de la
  primera cuota.
- **`B/03` L535** —*«el reloj del §4 existe para acotar el servicio que se le presta a quien no
  pagó»*, en el argumento de `S24`— cita el mismo fundamento sobre una fila **en `GRACE_PERIOD`**,
  o sea una que ya entró al grace. Sigue correcta por la misma razón, y **no cuantifica sobre
  quién entra**, que es lo único que el arreglo cambió.

### Grupo G — *«la fecha del próximo cobro»* y sus TRES escrituras · 9 apariciones

**Las 9 cuantifican sobre la columna y sobre el número tres** —*«tiene tres escrituras y una de
ellas es `S10`»*, *«esa columna queda con dos escritores en vez de tres»*, *«se mueve, y es la
misma cifra que el barrido compara»*— y **el tres no se movió**: la familia **retira el tope**, que
nunca fue una escritura de esta columna sino una sustitución de su valor, y pone en su lugar una
escritura del `período` de la cuota, que es **otra columna**. Las tres siguen siendo `S2`, el
avance de `MP1`/`MP4` y el avance de `S10`. **Si alguna dijera *«tres escrituras y un tope»*,
sería falsa** —y la que lo decía, `B/02` §2.2, la corrigió el commit `7a92b4da4`—; ninguna de las
nueve lo dice.

| archivo | líneas |
|---|---|
| `10-evaluacion-de-proveedor.md` | L443 |
| `V/descomposicion` | L259 |
| `B/02` | L47, L230, L234 |
| `B/03` | L1372 |
| `B/20` | L186, L187, L197 |

> **`B/20` L186-187 es la que más de cerca pasa y sigue siendo exacta**: *«se rompe a propósito
> sacándole a `S10` la escritura que avanza la fecha … esa columna queda con dos escritores en vez
> de tres y el guard sigue verde»*. Con el tope retirado la mutación sigue dejando **dos de tres**,
> porque el tope no estaba contado entre los tres.

### Grupo H — el §7 y sus transiciones, en cláusulas que la familia no mueve · 77 apariciones

Es el grupo caro, y va con el criterio explícito: **una aparición entra acá cuando su cláusula
nombra `MP1`/`MP4`/`MP5` por algo que el arreglo no cambia** —la herencia de `S19`, el par de
`G-R4`, el reembolso de un `manual_payment`, el catálogo de doce acciones, la puerta manual del
pago del período impago, el guard `G-R1-D`—.

**Lo que las 77 comparten**: ninguna dice **a qué período se imputa** el pago que `MP4` registra,
ni **desde qué estado** se abre una cuota, ni **quién la abre**. Las cinco frases que sí lo decían
—la celda de `MP4` en la tabla del §7, el párrafo del tope en *«qué mueve la fecha»*, la sección
*«al reabrir por `MP4`»*, la fila `S7` de la tabla de las tres vueltas a `ACTIVE`, y el bullet
*«no agrega una columna»*— **están las cinco adentro de commits de esta familia**, y por eso no
figuran acá.

**Las cuatro subclases, con su cuantificador verificado:**

1. **La puerta doble del pago del período impago hacia `S19`** (`B/03` L363-407, `B/12`
   L373-375, L505, `B/20` L59, L154-169, `B/descomposicion` L348-351, L451, `B/05` L203,
   `NUCLEO/08` L168). Cuantifican sobre **dos puertas** y **cuatro caminos que reactivan**:
   *«`S5`, `S7`, el efecto de `MP1` y el de `MP4`»*. **Siguen siendo dos y cuatro.** La cláusula
   nueva de `MP1` —la del alta— **no agrega un quinto camino que reactive**, porque no reactiva
   nada: lleva a `ACTIVE` una fila que nunca estuvo ahí, y una fila en `PENDING_AUTHORIZATION`
   **no puede ser la predecesora de una sucesión** (una predecesora está viva y ya autorizó), que
   es el sujeto entero de `G-R1-D`. Si alguna dijera *«los cuatro caminos son los únicos en que
   `MP1` tiene efecto»*, sería falsa; ninguna lo dice: todas cuantifican sobre los que
   **reactivan**.
2. **Los pares y los conteos de la máquina** (`B/03` L1264-1302, L1325-1327, `NUCLEO/01` L302,
   `B/02` L280). *«La máquina sigue teniendo tres estados»*, *«`MP4` agrega una arista, no un
   nodo»*, *«el catálogo de acciones administrativas sigue teniendo DOCE filas»*, *«la máquina
   tenía cuatro salidas y ninguna entrada»*. **Los tres números siguen exactos**: la familia no
   agrega ni un estado ni una fila ni una acción de admin —`MP5` gana una **cláusula** dentro de su
   fila, y el §7.2 dice por qué eso no es un par nuevo—. La frase *«cuatro salidas y ninguna
   entrada»* es el enunciado histórico de `F-8B2-018` y sigue describiendo el estado **anterior**,
   que es lo que cuantifica.
3. **El reembolso de un `manual_payment` y su estado** (`B/03` L1118-1133, `B/02` L48, L238, L280,
   L700, `NUCLEO/08` L282, `B/09` L135, `B/12` L505). *«El estado del `manual_payment` no se
   mueve»*, *«`MP4` revierte la declaración de impago … lo que sigue sin mover esa columna es
   devolver la plata»*. **Siguen correctas**: la reimputación escribe el **`período`**, no la
   columna de estado, y el §7.1 lo dice donde esas frases viven. Si alguna dijera *«lo único que
   `MP4` escribe es la columna de estado»*, sería falsa —y la que lo daba a entender, el bullet
   *«no agrega una columna»*, la corrigió `2e58663f7`—.
4. **El resto de `B/20` y `V/20`** (`B/20` L62, L174, L189, L206, `V/20` L65, L70, L103). Son el
   enunciado de `G-R6` y la narración de `F-8eB1-002`: *«`MP5` disparaba sobre «el período actual
   arrancó» y ninguna escritura del corpus avanzaba esa columna»*. **Siguen correctas y describen
   un defecto cerrado**, con las tres escrituras intactas (grupo G).

| archivo | líneas |
|---|---|
| `NUCLEO/01-glosario.md` | L302 |
| `NUCLEO/07-outbox-y-notificaciones.md` | L281 |
| `NUCLEO/08-auditoria-y-observabilidad.md` | L168, L282 |
| `V/20` | L65, L70, L103 |
| `B/descomposicion` | L348, L350, L351, L451 |
| `B/02` | L48, L238, L280, L700 |
| `B/03` | L364, L379, L386, L387, L389, L393, L397, L399, L406, L407, L1118, L1120, L1121, L1122, L1127, L1128, L1133, L1136, L1144, L1193, L1229, L1252, L1264, L1266, L1269, L1272, L1275, L1276, L1277, L1279, L1314, L1315, L1318, L1319, L1325, L1326, L1327, L1345, L1346, L1464, L1500, L1582, L1585, L1588 |
| `B/05` | L158, L203 |
| `B/09` | L135 |
| `B/12` | L373, L374, L375, L505 |
| `B/20` | L59, L62, L154, L155, L159, L165, L166, L169, L174, L189, L206 |

> **Una de las 77 está FALSA y no la arreglo, con su razón.** `B/03` **L1275** dice *«`MP4` no
> agrega ningún par con dos filas, así que **`G-R4` sigue contando tres**»*, y el §7.2 del mismo
> capítulo dice *«los pares con dos filas son **cuatro** desde `S25`»*. La caducidad la produjo la
> familia de la baja de la 9-bis-4 (`S25`), no ésta: la premisa de `MP4` era verdadera cuando se
> escribió y la dejó falsa un commit posterior de otra familia. **No la corrijo porque `S25` y el
> conteo de pares son de otro terreno**, y porque el conteo se recuenta entero y no se le suma uno.
> Queda en el §7 como pregunta.

---

## 5. Premisas ajenas que el arreglo volvió falsas y se corrigieron en el mismo acto

| premisa | de quién era | qué pasó | dónde quedó corregida |
|---|---|---|---|
| *«si el atraso fue más largo que un período, arranca uno nuevo hoy y la cuota se abre ahora»* | `B/19` §4, fila 10-bis (el aviso del `MP4`) | **queda FALSA**: con la reimputación no se abre ninguna cuota hoy — el pago compra el período que arranca y la próxima se abre dentro de un ciclo | `B/19` §4 fila 10-bis, reescrita entera (`7a92b4da4`) |
| *«si el atraso fue más largo, hoy, y la cuota ya está abierta»* | `NUCLEO/07` §6, fila *«reapertura tras un pago manual tardío»* | **queda FALSA por lo mismo**, y era la otra mitad del mismo aviso | `NUCLEO/07` §6, misma fila (`cbd3e7093`) |
| *«la cuota copia la fecha del próximo cobro vigente»*, sin excepción | `B/02` §2.3 | **queda INCOMPLETA**: la primera de un pagador manual se abre cuando esa columna todavía no existe | `B/02` §2.3, con la excepción escrita (`cbd3e7093`) |
| *«el período se identifica por su fecha de inicio, que es el valor que la fecha tenía cuando la cuota se abrió»* | `B/02` §2.3 | **queda INCOMPLETA**: hay una segunda escritura del `período`, la reimputación de `MP4` | `B/02` §2.3, con las dos escrituras declaradas (`7a92b4da4`) |
| *«`manual_payment` guarda quién lo registró, cuándo, comprobante, que es lo que `MP4` escribe»* | `B/03` §7.1, *«lo que NO cambia»* | **queda INCOMPLETA**: `MP4` escribe además el `período` cuando reimputa | `B/03` §7.1, mismo bullet (`2e58663f7`) |
| *«`S3` → `ABANDONED`: nuestra llamada … no exenta»* | `B/09` §3, la tabla de las trece puertas | **queda INCOMPLETA sobre un pagador manual**, igual que `S23` y `S24` ya lo declaraban: ahí no hubo llamada que confirmar. **No mueve el conteo**: `S3` sigue siendo una de las nueve filas de la salvedad 4, exactamente como `S23` y `S24`, que también la llevan | `B/09` §3, fila `S3` (`c73326233`) |
| *«el grace no es un beneficio de entrada … un primer cobro fallido para un `user + vertical` sin ningún pago acreditado va directo a `SUSPENDED`»* | `04-open-decisions.md`, el cierre de `R-SUB-01` | **estaba FALSA por DOS lecturas retiradas antes de esta familia** —la histórica por `user + vertical` y el destino `SUSPENDED`, que `B/03` §3.1 reemplazó por `CHARGE_DECLINED`— y esta familia le agrega la mitad del pagador manual. La corregí entera porque la leí entera | `04-open-decisions.md`, misma línea (`44e3d963a`) |
| *«`MP3` sale de «se agota el grace»»* · *«`S4` es la fila … el único estado desde el que `MP5` crea»* · *«la cuota la crea un reloj»* (título del §7.2 y recuadro del §7.1) · *«el aviso sale en el mismo instante en que `S4` entra al grace»* | el arreglo de `MP5` de la 9-bis-4 (§7.1 y §7.2) | **quedan las cuatro INCOMPLETAS** con la segunda cláusula de `MP5` y la segunda de `MP3` | `B/03` §7.1 y §7.2, las cuatro en su lugar (`34678ded3`) |

**Y una que NO se corrigió, declarada**: `B/03` **L1275** (*«`G-R4` sigue contando tres»*) está
falsa por `S25` y **no es de esta familia** — ver el §4, grupo H, y el §7.

---

## 6. Lo que este rastro vuelve falso de los anteriores

**De la 9-bis-4 — `rastro-8f9f31ac0.md`, que es el rastro del arreglo que esta familia reemplaza:**

1. **La tabla de commits, fila `11aac0088`** — *«el re-anclaje de `MP4` deja de ser
   incondicional»*, o sea el **tope**. **Queda superada**: el tope se retira entero y lo reemplaza
   la reimputación de la cuota. Lo que ese commit cerró —el doble cobro de los días 20 a 30 sobre
   la reapertura **dentro** del período— **sigue cerrado**, y por el mismo mecanismo: la
   reimputación tampoco corre ahí.
2. **§1, `F-8eB1-001`** — *«el avance de `MP4` lleva un tope y no un re-anclaje: sólo si ese avance
   cae en el pasado la fecha pasa a ser el instante de la reactivación»*. **Queda FALSA como
   remedio**: esa fecha es exactamente la que hace disparar a `MP5` en el acto.
3. **§2, la lista de términos** — *«el **tope** de `MP4`»* figura como término nuevo de esa
   familia. **Queda retirado como término del corpus**, y por eso esta familia lo grepeó como
   término viejo.
4. **§4, pregunta 1** — *«la **mitad (2)** de la decisión —«el que vuelve paga el período que
   arranca, no los que pasó suspendido»— **se cumple entera con el tope**; lo que cambia es el
   alcance del remedio, no la elección»*. **Es la línea que `F-8fB1-001` señaló como falsa y
   ahora es verdadera**, pero **no por el tope**: se cumple por la reimputación. La pregunta que
   esa línea le hacía al owner —si se enmienda la viñeta de `DEC-SUB-013`— **sigue abierta y
   cambió de contenido**: ver el §7.
5. **§3, la línea del `S10`** —*«es el argumento que hace que el tope NO corra en `S10`»*—
   **sobrevive con otro sujeto**: lo que no corre en `S10` ahora es la **reimputación**, y por la
   misma razón escrita (durante una cortesía no se abrió ninguna cuota).

**De la 9-bis-4 — `rastro-f21d5d828.md`:**

6. **§3, `B/03`** — *«**L1409-1414 · §7.2** — el tope de `MP4` → **sigue correcta**»*, sin
   argumento. **Queda FALSA**, y es la segunda de las dos resoluciones que `F-8fB1-001` midió como
   equivocadas sobre la misma aparición.

**De la 9-bis-4 — lo que NO vuelvo falso, y conviene decirlo porque parece que sí:**

7. `rastro-8d6b27a12.md` §L113-117 y `rastro-032f761e0.md` L27-28 y L323 hablan del **tope de la
   reapertura** —la condición 1 del `B/05` §3, *«mientras la fila siga viva»*— y
   `rastro-40b922120.md` L180, L200-201 y `rastro-12cc0879f.md` L210 hablan del **tope de pausa**
   de `D16`/`G-R5`. **Los dos siguen enteros**: esta familia sólo retira el tope de la **fecha**, y
   la homonimia de los tres es lo que el §3 separó a mano.

**De la familia 1 de esta misma tanda — `rastro-93eb0a1dc.md`:**

8. **§4, `B/03` L119** — la justificación de la fila `S4`. **Sigue verdadera**: la celda ganó una
   cláusula (*«sobre la primera cuota no corre»*) y la cita que el rastro justifica —*«en un
   pagador manual eso es que `MP5` abrió la cuota…»*— sigue textual en la misma celda y en la
   misma línea.
9. **§4, `B/03` L1398** — *«Y que sean TRES y no cero es lo que `G-R6` vigila»*. **La afirmación
   sigue verdadera** —siguen siendo tres— pero **el número de línea caducó**: hoy es **L1463**.
   Las dos entradas de esa tabla que citan `B/03` son las únicas de sus 132 que caen en archivos
   que esta familia tocó.

---

## 7. Preguntas para el owner

**Son tres, y las tres van también en la respuesta al owner, no sólo acá.**

1. **La ventana de la primera cuota de un pagador manual: ¿72 h alcanzan para una transferencia?**
   La regla nueva no depende de la cifra —lo que la sostiene es que la fila no dé servicio mientras
   corre—, pero la única ventana declarada hoy es la de `S3`, **72 h**, escrita para el tiempo que
   tarda alguien en completar un checkout, no para el que tarda una transferencia bancaria en
   acreditarse. Si son pocas, un Partner de buena fe muere en `ABANDONED` y tiene que dar de alta
   de nuevo. **Es una cifra de producto y no la elijo.** Está nombrada en `B/03` §7.2.
2. **`DEC-SUB-013` quedó otra vez más ancha que su capítulo, y ahora por un motivo distinto.** El
   log dice *«el período se **RE-ANCLA** al instante de la reactivación»*; la 9-bis-4 lo estrechó a
   un **tope** y dejó esa misma pregunta abierta (`rastro-8f9f31ac0.md` §4, pregunta 1); **esta
   familia retira el tope entero** y en su lugar pone la reimputación de la cuota. La mitad (2) de
   la decisión ahora se cumple **literal**, pero por un mecanismo que la viñeta no nombra.
   ¿Se enmienda la viñeta de `DEC-SUB-013`, o queda el log como registro de lo que se eligió y el
   capítulo como el texto vigente? **No lo resuelvo: esta fase tiene prohibido editar el log.**
3. **`B/03` §7.1 dice *«`G-R4` sigue contando tres»* y el §7.2 del mismo capítulo dice **cuatro**
   desde `S25`.** La caducidad es de la familia de la baja de la 9-bis-4, no de ésta, y la dejé sin
   tocar porque el conteo de pares es de otro terreno y **se recuenta entero, no se le suma uno**.
   ¿La toma la familia que siga, o la corrijo yo en una pasada aparte?

**Y una consecuencia aceptada que no es pregunta pero conviene que esté a la vista**: con la
reimputación, el que vuelve tras una suspensión larga **no paga** el período que consumió en grace
antes de caer —ese tramo queda sin cobrar—. Es lo que la mitad (b) manda (*«no los que pasó
suspendido»*) y el precio de la política de retención del §20, acotado porque el grace sólo alcanza
a quien ya tiene un pago acreditado. Está escrito en `B/03` §7.2, en *«al reabrir por `MP4`»*.
