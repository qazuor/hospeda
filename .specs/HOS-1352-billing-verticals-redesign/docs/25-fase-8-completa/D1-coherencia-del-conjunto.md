---
title: "FASE 8 completa · D1 — coherencia del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · D1 — coherencia del conjunto

Ataqué la consistencia del corpus como conjunto (núcleo, `B/NN`, `V/NN`, contrato, log y matriz),
no un mecanismo. Busqué con scripts y no a ojo: recuento de la matriz con un parser propio
(independiente del `contar-filas-de-la-matriz.py`), resolución automática de todo
`` `B/NN` §x.y ``, `` `V/NN` §x.y ``, `` `NUCLEO/NN` §x.y `` y `cap. NN §x.y` contra los
encabezados reales, existencia de todo `DEC-…`, de todo id de fila de la matriz y de todo id de
transición (`S*`, `T*`, `PB*`, `A*`, `MP*`), detección de IDs de decisión duplicados, y recuento
de cada número que un documento afirma sobre sí mismo o sobre otro.

**16 hallazgos: 0 `CRITICA` · 4 `ALTA` · 6 `MEDIA` · 6 `BAJA`.** Los cuatro `ALTA` tienen la
misma forma: **una regla cambió en un lugar y el lugar viejo sigue enunciando la versión anterior
como vigente**, y en los cuatro el lugar viejo decide plata o acceso. La más grave en una línea:
**el diseño del grace de tarjeta (`DEC-SUB-019`, *«el grace siempre menos que el ciclo»*) se apoya
en una medición —la sonda 49, *«la ventana del proveedor dura un ciclo»*— que la matriz no tiene:
su fila `GR-3` sigue diciendo que esa sonda *«está bloqueada»* y que las dos hipótesis son
*«indistinguibles»*.**

Lo que resistió (conteos del log, de la matriz, de invariantes, de motivos de marca, de las doce
transiciones que sacan un título de las filas vivas, de las doce acciones administrativas; la
ausencia de restos de `PROVIDER_DUNNING`; los plazos de ventana y de pausa) está al final.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila.

---

## CRITICA

Ninguno.

---

## ALTA

### F-8CD1-001 — El grace de tarjeta está diseñado sobre una medición que la matriz no registra, y la matriz dice lo contrario

**Qué se rompe.** `DEC-SUB-019`, `B/03` §4 y `B/12` §1.4 dan por **medido** que la ventana de
reintentos del proveedor dura **un ciclo** (sonda 49, 2026-09-24) y construyen sobre eso la
restricción *«el grace es siempre más corto que el ciclo»* y la cancelación del preapproval en `S6`.
La matriz —la fuente de verdad de lo medido— **no tiene esa medición**: `GR-3` dice que la sonda 49
está bloqueada y que *«ventana de 24 h»* y *«ventana de un ciclo»* son indistinguibles. `DEC-SUB-019`
cita además como medido un hecho de `RN-3`, que en la matriz es `UNKNOWN` (*«se lee tras el cobro
previsto del 2026-09-24»*). Si la hipótesis que la matriz deja abierta fuera la verdadera (ventana
fija de 24 h), el grace de 10 días no existe para ningún pagador con tarjeta.

**El camino.**

1. Juan, plan mensual con tarjeta, `ACTIVE`. Falla su renovación: `S4` → `GRACE_PERIOD`, grace de 10
   días (`DEC-SUB-002`), validado como *«menor que el ciclo»* (30 días).
2. Si la ventana del proveedor es de 24 h —la hipótesis que `GR-3` no descarta—, el proveedor pausa
   el preapproval al día siguiente.
3. El espejo lee `paused × GRACE_PERIOD` → `S6` por su segundo evento (`DEC-MP-008`) → `SUSPENDED`
   el día 1, sin listado público, sin edición, sin entitlements.
4. Los 9 días de grace que el §20 promete, y que la validación de configuración da por
   garantizados, no existen. La validación *«grace < ciclo»* es verde y no protege nada, porque
   compara contra la cifra equivocada.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5001-5003` (`DEC-SUB-019`):

> **El hecho que la motiva**: la **sonda 49** (producción, 2026-09-24) midió que **la ventana de
> reintentos del proveedor dura un ciclo**: el cobro de renovación de un preapproval de `2 days`
> trae `expire_date` a **48,0 h** de creado, y los de `1 days` traían 24 h (`GR-3`).

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5008-5009`:

> `next_payment_date` avanzando igual sobre un cobro rechazado — `RN-3`, 2026-09-24)

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197` (`GR-3`):

> los cinco ciclos son de sujetos con **`frequency: 1 days`**, así que *«ventana de 24 h»* y
> *«ventana de un ciclo»* **son indistinguibles acá**. La [sonda 49](...) existe para separarlas con
> un sujeto de `2 days` y **está bloqueada**

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:189` (`RN-3`):

> | RN-3 | Recuperación tras el fallo | `UNKNOWN` |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1283`:

> y **siempre menos que el ciclo de esa versión** (`DEC-SUB-019`): el proveedor reintenta durante
> **un ciclo** (sonda 49) y después pausa

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:408-413` sigue, además, en la
versión previa a la sonda:

> Lo que falta es si esa ventana es **fija de 24 h** o es **el ciclo** — los cinco sujetos medidos
> eran de ciclo diario, así que las dos hipótesis son indistinguibles ahí. La sonda 49 las separa
> con un sujeto de `2 days` y **se lee el 2026-09-24**.

Y la regla que lo prohíbe, `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:46-47`:

> **Una decisión sobre Mercado Pago no puede tomarse mientras su fila de
> [`06-mp-validation-matrix.md`] diga `UNKNOWN`** (§61).

Se repite en `B/12` §1.4 (`12-suscripcion.md:87`, *«La sonda 49 midió que el proveedor reintenta
durante **un ciclo**»*), en `B/09` (`09-conciliacion.md:660-661`, *«cuatro intentos dentro de **un
ciclo**… (`GR-3`, sonda 49)»*, citando una fila que dice 24 h) y en `B/12` §5.4
(`12-suscripcion.md:676-680`, los lotes de cobro al minuto `:02`, *«manifiesto de `RN-3`, fuera del
repo»*), ninguna de ellas en la matriz. El título de `B/12` §1 (`12-suscripcion.md:29`) todavía dice
*«sin saber cuánto dura el suyo»*.

**Severidad**: `ALTA`. El resultado probable de la sonda favorece al diseño, pero hoy el corpus
tiene dos verdades sobre el hecho que dimensiona el dunning de todo pagador con tarjeta, y la que
manda por regla (la matriz) es la que no sostiene el diseño. No es `CRITICA` porque, si la medición
existe, se arregla registrándola.

**Necesita decisión del owner**: **no**. Es registrar la sonda 49 y la lectura de `RN-3` en la
matriz (o degradar las afirmaciones a *«no medido»*); la política de `DEC-SUB-019` no cambia.

---

### F-8CD1-002 — Cambiar de plan en grace promete «cobro inmediato» y «si falla, sigue en grace»; la sucesión no puede hacer ninguna de las dos cosas

**Qué se rompe.** `DEC-SUB-003` (ACCEPTED, nunca marcada superada) y `B/03` §4 dicen que desde
`GRACE_PERIOD` se cobra el plan nuevo **de inmediato** y que, si ese cobro falla, la persona **sigue
en grace con el plan anterior**. El mecanismo real del cambio de plan es la sucesión, y `D8`/`B/12`
§5.2 obligan a que la sucesora nazca con el primer cobro **después** del vencimiento de su ventana.
Un implementador que siga `B/03` §4 cobra en el acto (viola `D8`, con la cuota vieja todavía en
reciclado); uno que siga `D8` no puede cumplir la segunda promesa, y Juan termina sin nada.

**El camino.**

1. Juan, `GRACE_PERIOD`, pide bajar a un plan más barato (el camino de recuperación de
   `DEC-SUB-003`). Se crea la sucesora con primer cobro posterior a su ventana (`D8`).
2. Juan autoriza: `S2` → la sucesora `ACTIVE`; `S17` cancela la predecesora (`CANCELLED`).
3. Días después, el primer cobro de la sucesora se rechaza: `S16` → `CHARGE_DECLINED`, terminal.
4. Juan no *«sigue en grace con el plan anterior»*: la predecesora está `CANCELLED` y la sucesora
   muerta. Lo que la pantalla (`B/03` §4, *«qué se puede hacer adentro»*) le prometió no ocurre.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1287`:

> **cambiar de plan está permitido, y es el camino de recuperación** (`DEC-SUB-003`): se intenta el
> cobro del plan nuevo de inmediato; si entra, vuelve a `ACTIVE` con el plan nuevo; si falla,
> **sigue en grace con el plan anterior y no cambia nada**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:690-692`:

> **Se intenta el cobro del plan nuevo de inmediato**: si entra, vuelve a `ACTIVE` con el plan
> nuevo; si falla, **sigue en grace con el plan anterior y no cambia nada**.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:339-340`:

> **Toda sucesora nace con fecha de primer cobro POSTERIOR AL VENCIMIENTO DE SU VENTANA DE
> AUTORIZACIÓN.** Ninguna puede cobrar antes de que su propia ventana se cierre.

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:134` (`D8`, nivel base):

> Toda sucesora nace con fecha de primer cobro **posterior al vencimiento de su ventana de
> autorización**

Y `DEC-SUB-003` implicación 3 (`01-decision-log.md:704-705`) apoya el cobro inmediato en una fila
`UNKNOWN`: *«depende del comportamiento del proveedor, que está en `UNKNOWN` (`GR-1`…)»*.

**Severidad**: `ALTA`. Rompe el camino de recuperación de todo moroso; el cobro inmediato lo
detectaría `G-R1-B`, pero la promesa de *«si falla, no cambia nada»* no la vigila nada.

**Necesita decisión del owner**: **sí**. `DEC-SUB-003` es una decisión suya todavía ACCEPTED; que
`D8` la haya vaciado exige marcarla superada o precisada y decidir qué se le promete a quien cambia
de plan en mora.

---

### F-8CD1-003 — Quién decide si un cambio de plan sube o baja: el `rank` (V/10) o el veredicto por delta (contrato, `DEC-ARCH-008`)

**Qué se rompe.** El cuándo-se-cobra de un cambio de plan (upgrade inmediato con `DEC-SUB-007`,
downgrade al fin del ciclo con `DEC-SUB-008`) depende de la dirección. `V/10` §2 dice que la
comparación de tiers del §27/§28 **lee los `rank`**; `DEC-ARCH-008` y el contrato §4.1 dicen que la
dirección es un **veredicto por delta** que emite verticales, y que derivarla del `rank` **ya está
rechazado**. `B/10` §3.5 enuncia la regla del delta sólo para *«un cliente en un plan retirado»*, y
`B/12` no nombra `direcciónDeCambio` en ninguna parte.

**El camino.**

1. El plan Pro (rank 3) se rediseña y su nueva versión baja el límite de fichas de 20 a 15, sin
   bajar el precio.
2. Juan, en Básico (rank 1, 18 fichas publicadas por un addon), cambia a Pro.
3. Por `V/10` §2 (rank 1 → 3) es upgrade: se cobra en el acto y las capacidades cambian ya — se le
   recortan 3 fichas **en silencio mientras se le cobra como mejora**.
4. Por `DEC-ARCH-008` (*«cualquier baja manda»*) es downgrade: monto al fin del ciclo y aviso de
   excedente antes. Dos implementaciones, dos cobros en días distintos.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/10-verticales-planes-billing-options.md:95`:

> | **la comparación de tiers** (§27, §28) | los `rank` de las versiones **vigentes y vendibles** |

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:710-713`:

> derivar la dirección del `rank` es barato y **el diseño ya lo rechazó por escrito** —un plan más
> caro puede bajar un límite al rediseñarse, y entonces al cliente **se le recorta algo en silencio
> mientras se le cobra como mejora**; y un plan retirado no tiene `rank` comparable, que es el único
> caso donde la regla hace falta—.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:88-93`:

> ### 3.5 Un cliente en un plan retirado que quiere cambiar
>
> …
> **La dirección se deriva del delta entre las dos versiones, no del `rank`:**

`00-PDR.md:1302` y `:1318` son `# 27. UPGRADE` y `# 28. DOWNGRADE`: los §§ que `V/10` resuelve por
`rank`. El propio contrato se contradice en una frase (*«ya lo rechazó»* y *«el único caso donde la
regla hace falta»* es el plan retirado), que es exactamente la ambigüedad que deja vivo a `V/10` §2.

**Severidad**: `ALTA`. Decide el día del cobro y si se avisa el excedente, en todo cambio de plan
entre versiones rediseñadas.

**Necesita decisión del owner**: **no**. `DEC-ARCH-008` ya decidió; falta que `V/10` §2 y `B/10`
§3.5 dejen de enunciar otra cosa (y que `B/12` nombre la consulta).

---

### F-8CD1-004 — La carrera «entra el pago mientras se suspende» ya no termina en el mismo estado desde `DEC-SUB-019`

**Qué se rompe.** `B/05` C1 afirma que los dos órdenes terminan igual y que, si suspender va
primero, el pago entra por `S7`. Desde `DEC-SUB-019`, suspender **cancela el preapproval**. Un cobro
en vuelo que entra después reactiva la fila por `S7` a `ACTIVE` **sin preapproval**, y la tabla del
§10.1 lee `cancelled × ACTIVE` como *«baja decidida por el proveedor»* y la espeja a `CANCELLED`.
Juan paga el período y lo pierde.

**El camino.**

1. Juan, tarjeta, `GRACE_PERIOD`. El último reintento del proveedor se está procesando.
2. Corre `S6`: relee, no ve cobro acreditado, cancela el preapproval, `SUSPENDED`.
3. El cobro en vuelo se acredita. `S7` (*«sólo lo alcanzan los bordes —un cobro en vuelo en el
   instante de `S6`»*) → `ACTIVE`.
4. El barrido relee: preapproval `cancelled`, fila `ACTIVE` → *«espejar la baja decidida por el
   proveedor»* → `CANCELLED`. El pago queda acreditado sobre una fila muerta y ninguna fila de la
   tabla lo manda a reembolso.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:66-72`:

> **No hace falta decidir un ganador: los dos órdenes terminan en el mismo estado.**
> …
>
> - Si la suspensión ocurre primero, el pago entra por `SUSPENDED → ACTIVE`, que es una
>   transición válida.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:128` (`S7`):

> un pagador con tarjeta **no vuelve por acá**: `S6` le canceló el preapproval (`DEC-SUB-019`)… y
> `S7` sólo lo alcanzan los bordes —un cobro en vuelo en el instante de `S6`, un preapproval
> reactivado a mano—

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2244`:

> | `cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` ni `SUSPENDED` | **`S12`** si hay
> una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4) |

**Severidad**: `ALTA`. Plata del cliente acreditada y servicio cortado, en una carrera que el
diseño declara resuelta; la acota que sea un borde de milisegundos.

**Necesita decisión del owner**: **no**. Es corrección de diseño: `B/05` C1 quedó escrito contra la
suspensión anterior a `DEC-SUB-019`.

---

## MEDIA

### F-8CD1-005 — «Ninguna máquina consulta el estado del proveedor para decidir» contra `D17`, `S3` y `S6`, que sí lo consultan

**Qué se rompe.** La regla 5 del núcleo prohíbe que una máquina decida leyendo al proveedor. `D17`
(2026-09-24) exige lo contrario para los jobs de nuestro reloj, y `S3`/`S6` tienen la relectura del
proveedor **en su condición**. Un implementador que aplique la regla 5 suspende sin preguntar.

**El camino.** 1. Webhook del cobro perdido. 2. Vence el grace de Juan, que sí pagó. 3. Con la regla 5,
`S6` decide por su reloj y suspende; con `D17`, relee y corre `S5`.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:58-59`:

> 5. **Ninguna máquina consulta el estado del proveedor para decidir.** Consulta el suyo. Lo que
>    el proveedor dice entra siempre por §10, la regla de no-retroceso.

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:143` (`D17`):

> y **un job que actúa por nuestro reloj** sobre algo que depende del estado del proveedor **le
> pregunta antes de actuar** (`S3`, `S6`).

**Severidad**: `MEDIA`. Dos lecturas incompatibles del núcleo sobre la misma transición.

**Necesita decisión del owner**: **no**. `D17` es posterior y viene del owner; la regla 5 necesita
la excepción escrita.

---

### F-8CD1-006 — La única excepción al invariante 25 («el correo bloquea antes de cancelar») no está en ninguna transición, y no se sabe qué cancelaciones alcanza

**Qué se rompe.** El núcleo dice *«bloquea la acción sólo antes de cancelar»*, justificado por el
caso de la sucesión (`S17`), mientras el daño medido es el de la baja voluntaria (`S11`). Ninguna
fila de `B/03` §3.2 lleva el bloqueo, y el corpus cancela en el proveedor en `S3`, `S6` (desde
`DEC-SUB-019`), `S11`, `S13`, `S17`, `S20`, `S22`-`S28`. Con la regla 1 (*«lo que no está, no
pasa»*) el bloqueo no existe; con el catálogo de correos, alcanza a todas, y `S6` quedaría trabada
por una caída del proveedor de mail.

**El camino.** 1. Juan pide la baja (`S11`). 2. Falla el envío de nuestro correo. 3. Un implementador
bloquea y reintenta (catálogo del núcleo); otro cancela igual (tabla de `B/03`). En el segundo, a
Juan le llega sólo el correo del proveedor que insinúa mora.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:188-191`:

> 2. **Nuestro correo bloquea la acción sólo antes de cancelar.** … Y **sale gratis**: la
>    cancelación de la vieja ocurre cuando llega el webhook de que la nueva quedó autorizada

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:113-114`:

> a alguien que canceló por su voluntad le llega un aviso que insinúa mora.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:132` (`S11`, efectos
completos): *«**se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de
servicio»* — sin bloqueo.

**Severidad**: `MEDIA`. Ambigüedad de alcance sobre la única excepción declarada a un invariante.

**Necesita decisión del owner**: **sí**, en lo que toca a `S6`: si la suspensión por mora debe
esperar al correo es política, no redacción.

---

### F-8CD1-007 — `S13` y `S17` cortan una pausa sin escribir su `fin_real`, contra la razón que `S22` y `S25` dan para escribirlo

**Qué se rompe.** `S22` y `S25` escriben `fin_real` porque los topes de pausa sobreviven a cancelar
y *«una pausa que se corta sin registrar su fin real le come al cliente meses que no usó»*. `S13`
(grant) y `S17` (sucesión sobre una predecesora `PAUSED`) también sacan a la fila de `PAUSED` y no
lo escriben. `B/03` §5 afirma que `S13` *«cierra la pausa»*, y `B/09` §3 enumera las salidas de
`PAUSED` sin `S17`.

**El camino.** 1. Juan pausa 4 meses. 2. Al mes, cambia de plan: `S17` cancela la predecesora
`PAUSED`. 3. La `subscription_pause` queda sin `fin_real`. 4. Al año quiere pausar otra vez y el
acumulado de 8 pausas-mes le cuenta los 3 meses que no usó.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:143` (`S22`):

> **Se escribe `fin_real` en la `subscription_pause`** … los topes del §26.3 **sobreviven a cancelar
> y volver a suscribirse** (`DEC-SUB-004`), así que una pausa que se corta sin registrar su fin real
> le come al cliente meses que no usó.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1310-1313`:

> sale por S10 — **o termina, sin reanudar, por `S22` (la persona pide la baja) o por `S13` (le cae
> un grant)**. Las dos terminales mandan la fila a `CANCELLED` y **cierran la pausa**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:416-419`:

> **Las otras tres salidas de `PAUSED` no producen ese estado** … `S22` y `S25` además escriben el
> `fin_real` de la pausa

(`S13`, línea 134, y `S17`, línea 138, no nombran `fin_real`; `S17` tiene `PAUSED` en su `desde`.)

**Severidad**: `MEDIA`. Consume cupo de pausa ajeno; no mueve plata.

**Necesita decisión del owner**: **no**.

---

### F-8CD1-008 — Dos IDs de decisión están duplicados: `DEC-ENT-002` y `DEC-ARCH-008` nombran dos decisiones distintas cada uno

**Qué se rompe.** El log tiene 111 encabezados de decisión pero **109 IDs únicos**. Una cita de
`DEC-ENT-002` puede ser *«cuotas mensuales»* o *«la CLASE de una clave es un atributo del
catálogo»*; una de `DEC-ARCH-008`, *«la dirección la decide verticales»* o *«los inventarios de
`NUCLEO/01` son capítulo de `B3`»*. Las citas de `V/11:206`, `V/15:444` y `NUCLEO/07:118` se
refieren a la primera; las de `01-decision-log.md:4476`, `:4494`, `:4510`, a la segunda. El índice
cuenta *«111»* como fuentes (`nucleo/00-indice.md:42`).

**El camino.** 1. Un implementador busca `DEC-ENT-002` para saber si una cuota de trial se resetea.
2. `rg` le devuelve dos encabezados. 3. Toma el primero o el último según su búsqueda.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:577`:

> ### DEC-ENT-002 — Las cuotas de consumo son mensuales, independientes del ciclo de pago

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:4279`:

> ### DEC-ENT-002 — La CLASE de una clave de entitlement es un atributo declarado del catálogo, no un juicio

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2639` y `:4595`:

> ### DEC-ARCH-008 — La dirección de un cambio de plan la decide VERTICALES, y billing recibe un veredicto
>
> ### DEC-ARCH-008 — Los tres inventarios de `NUCLEO/01` son capítulo de la unidad `B3`

**Severidad**: `MEDIA`. Una referencia que resuelve a dos reglas.

**Necesita decisión del owner**: **no**. Renumerar las dos segundas (rompe la regla 1 del log sólo en
el ID, no en el contenido).

---

### F-8CD1-009 — La lista cerrada de lectores de `listing.inactiva_desde` dice «cinco» y enumera seis

**Qué se rompe.** `G-R6-B`(c) falla si *«uno de esos cinco ya no lee»*: el guard necesita la lista
exacta. `V/02` §2.5 enumera `PB4`, `PB5`, el día 180, **los dos** avisos previos y la fecha de la
fila 18 — seis — y después dice que los dos avisos y la superficie van *«contados por separado»*.
Es el lector que protege el hard delete, la única operación irreversible del programa.

**El camino.** 1. Quien construye `G-R6-B` cuenta cinco: deja afuera uno de los dos avisos o la
fila 18. 2. Un refactor saca ese lector. 3. La mitad (c) sigue verde.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:316-319`:

> **Y la leen cinco consumidores, y esta lista también es cerrada**: `PB4` (día 90) y `PB5` (N meses)
> del cap. 03 §9, el día 180 del §4.1 de este capítulo, los **dos avisos previos** de schedule del
> cap. 07 §6 (núcleo) y la fecha que el cap. 19 §4 fila 18 obliga a imprimirle al cliente

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:332-333`:

> sigue siendo la de `DEC-DATA-004`, con los dos avisos de schedule y la superficie del archivado
> contados por separado.

**Severidad**: `MEDIA`. Conteo congelado sobre una lista que un guard cuenta.

**Necesita decisión del owner**: **no**.

---

### F-8CD1-010 — La definición de «fila viva» se reescribió y su columna de propósito, su párrafo de exclusión y su inventario no

**Qué se rompe.** El 2026-09-24 `SUSPENDED` de tarjeta quedó viva **sin** autorización que pueda
cobrar. La misma fila del glosario sigue diciendo que el conjunto existe para *«una autorización que
sigue pudiendo cobrar»*, y el párrafo siguiente excluye a los otros tres estados *«porque no tienen
autorización que pueda cobrar»* —el criterio que `SUSPENDED` ya no cumple—. Y el predicado nuevo de
`S6` (*«mientras la fila sea la predecesora… una sucesora viva apuntándola»*) no está en el
inventario del grupo B, que el glosario declara *«el control»* de `G-R1-E`.

**El camino.** 1. Un implementador del candado lee *«para qué existe»* y excluye `SUSPENDED`. 2. La
vuelta de Juan entra como alta suelta: dos filas en la vertical. 3. `G-R1-E` no ve el consumidor de
`S6`, porque el inventario tiene uno menos.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:366` (misma fila):

> **reescrito el 2026-09-24 por decisión del owner**: desde `DEC-SUB-019` una `SUSPENDED` de tarjeta
> **ya no puede cobrar** y sigue siendo viva … | el candado del §11: impedir un segundo `INSERT`
> sobre una autorización que sigue pudiendo cobrar |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:385-386`:

> **Los tres que quedan afuera de la primera lo están por la razón que le da su nombre**:
> `ABANDONED`, `CANCELLED` y `CHARGE_DECLINED` **no tienen autorización que pueda cobrar**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:127` (`S6`):

> **Y por el segundo evento, `S6` no ocurre mientras la fila sea la predecesora de una sucesión en
> curso** —una sucesora viva apuntándola— (owner, 2026-09-24)

(el inventario B, `nucleo/01-glosario.md:430-439`, filas 7-16, no la nombra).

**Severidad**: `MEDIA`. La enumeración de seis sigue explícita, lo que acota el daño.

**Necesita decisión del owner**: **no**.

---

## BAJA

### F-8CD1-011 — Las enumeraciones de salida del grace y de la pausa no coinciden con la tabla de transiciones

`B/03` §4 enumera las salidas de `GRACE_PERIOD` (`S5`, `S6`, `S24`, `S17`, `S13`) sin `S26`, que la
manda a `CANCEL_SCHEDULED` (`03-maquinas-de-estado.md:147`). `B/03` §5 dice que de `PAUSED` salen
`S10`, `S22` y `S13` —*«Las dos terminales»*— y omite `S25` y `S17`.
`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1272-1274`:

> Entra por `S4` y sale por `S5`, por `S6` o por **`S24`** … — y por `S17` o `S13`

**Severidad**: `BAJA` (la tabla manda y está completa). **Owner**: no.

### F-8CD1-012 — La matriz se contradice en su cabecera y en su cierre

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:12-14` abre con *«**FASE 1C
en curso.** … **44 filas `VERIFIED`, 14 `PARTIALLY_SUPPORTED`, 14 `NOT_SUPPORTED`, 12 `UNKNOWN`**,
sobre **84**»* (el script da 93 · 53 · 14 · 22 · 4). La línea 406-407 dice que el conteo del script
*«**nunca estuvo mal**»* y el 🚨 de la línea 424 dice que descartaba cuatro filas. La línea 521 dice
que `BD-MP-01` y `BD-MP-02` *«siguen bloqueadas por el §61»*; el resumen del log las da cerradas por
`DEC-SUB-010` y `DEC-GRANT-003`. Y la nota documental de las líneas 467-468 (*«la ventana del
proveedor **mide lo mismo que nuestro grace** (10 días)»*) no está retirada aunque `GR-3` la refuta.
**Severidad**: `BAJA`. **Owner**: no.

### F-8CD1-013 — Conteos congelados en `NUCLEO/04`

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:122`: *«El §64 se escribió
antes de las 45 decisiones»* (son 111). Líneas 97-98: *«**Cinco de las 37 no se pueden comprobar
ejecutando nada.**»*, contra la tabla §2.4 y el resumen del §5, que dicen **7**. El encabezado de la
línea 100, *«Los cinco de Free Forever (27, 28, 29)»*, nombra tres. El frontmatter dice
`updated: 2026-09-20` con una nota del 2026-09-24 (`D17`); el log dice `updated: 2026-09-21` con
decisiones del 24. **Severidad**: `BAJA`. **Owner**: no.

### F-8CD1-014 — `NUCLEO/00` afirma dos cosas que el corpus desmiente

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:63`: *«**Y las dos épicas no se
referencian entre sí.**»*. Medido: **56** líneas de `HOS-1354/docs` citan a verticales (`` `V/NN` ``,
*«épica de verticales»*) y **38** de `HOS-1353/docs` citan a billing. La línea 95 describe el glosario
con *«los dos sentidos de «vivo»»*; el glosario §2.4 se titula *««Vivo» nombra cuatro conjuntos»*
(`nucleo/01-glosario.md:356`). **Severidad**: `BAJA`. **Owner**: no.

### F-8CD1-015 — Seis referencias de sección apuntan a un § que no existe

Resultado del resolvedor contra los encabezados reales:

- `` `V/02` §1.2 `` — `02-modelo-de-datos.md:733` (billing) y `12-contrato-de-cobertura.md:603`.
  `V/02` empieza en el §2; el contenido citado (*«una segunda forma de declarar entitlements»*) es de
  `NUCLEO/02` §1.2.
- *«capítulo 18 §5»* — `nucleo/01-glosario.md:247`. `V/18` no tiene §5; la postulación es §2.1.
- *«cap. 10 §2»* — `B/19` `19-superficies.md:44` y `:47`. `B/10` empieza en §3; es `V/10` §2.
- *«cap. 02 §3.2»* — `B/16` `16-addons.md:351`. `B/02` no tiene §3.
- *«cap. 03 §1.2»* — `B/02` `02-modelo-de-datos.md:933` y `V/02` `02-modelo-de-datos.md:528`.
  Ningún cap. 03 de épica tiene §1; es `NUCLEO/03` §1, regla 2.

**Severidad**: `BAJA`. **Owner**: no.

### F-8CD1-016 — Conteos que el texto afirma sobre sí mismo y no cierran

- `B/03` §3 (`03-maquinas-de-estado.md:29`): transiciones con `desde` de conjunto, *«en esta tabla
  hay **cinco**»* (`S13`, `S20`, `S26`-`S28`). También lo es `S21` (*«toda fila viva DE
  COMPLEMENTO»*), que el propio glosario inventaría como consumidor 20.
- `B/03` §3.4 (`:1207`) se titula *«Las tres precisiones»* y enumera cuatro (la línea 1211 dice
  *«cuatro cosas y acá están las cuatro»*).
- `B/06` §4 (`06-proveedor.md:116`): *«Las cinco reglas duras»*, con subsecciones 4.1 a 4.6.
- `B/03` `S24` (`:145`): *«la única de las tres bajas directas que corta servicio de verdad»*. `S22`
  también lo corta cuando el motivo es `COURTESY` (su propia celda: *«esa fila **sí emite
  fuente**… y deja de emitirla hoy»*).
- `B/20` `G-R4` (`20-testing.md:64`): *«cubre las **seis** tablas de esta épica»*. `B/03` tiene
  cuatro tablas de transiciones (`S`, `P`, `MP`, `A`); grace y pausa son sub-estados sin tabla propia.
- Log, resumen (`01-decision-log.md:5145`): *«Apartamientos declarados del PDR | **7**»*. No cuenta
  `DEC-MAIL-001`, que `NUCLEO/04` (líneas 110-112) llama *«el único invariante del §64 que una
  decisión de este programa contradice de frente»* (§43).

**Severidad**: `BAJA`. **Owner**: no.

---

## Ataques que intenté y el diseño resistió

- **Restos de `PROVIDER_DUNNING`.** Cero apariciones fuera del log. La tabla del espejo tacha la
  versión vieja (`B/03:2240`), `subscription_pause` tiene dos motivos (`B/02:50`) y `B/03` §5 dice
  `CUSTOMER_REQUEST · COURTESY`.
- **Filas de la matriz inexistentes.** Todos los IDs `PA|FR|RN|GR|PS|CN|PC|UP|DW|CT|GT|WH|RC|RF|EX-N`
  citados en el corpus existen en la matriz (los únicos «huérfanos» del grep eran `DEC-RF-00N`).
  Con mi parser: 93 filas · 53 / 14 / 22 / 4, igual que el script; los `UNKNOWN` son `RN-3`, `GR-1`,
  `GR-2`, `RF-3`.
- **Decisiones inexistentes o superadas citadas como vigentes.** Todo `DEC-…` citado existe (salvo
  `DEC-BILL-001`, ejemplo de formato del PDR). `DEC-SUB-001`/`005` sólo aparecen como historia.
- **Conteo del log.** 112 encabezados − plantilla = 111; METH 14 + funcionales 97 = 111; 4
  `SUPERSEDED` coinciden con los que lista `NUCLEO/00`.
- **Invariantes.** 37 + 17 = 54; base 6 + 4 = 10; apoyos 4 + 11 + 6 = 21 sobre 17; las tablas §2.1-§2.5
  suman 6 + 14 + 5 + 7 + 5 = 37.
- **Motivos de la marca.** 15 motivos, 6 con `SÍ` (1, 2, 3, 7, 12, 15), 7 de `S14` y 8 de otros actos:
  coinciden en `B/02` §2.5, `B/03` `S14`, `B/19` §6, `B/20` `G-R1-F`, `NUCLEO/03` regla 1 y
  `NUCLEO/04` fila 21. La tabla de defaults de `B/19` §6 tiene 8 filas (6 devolver, 1 no, 1 nada), y
  lo dice.
- **Las doce transiciones que sacan un título de las filas vivas** (`B/16` §4.3): recontadas contra
  `B/03` §3.2, son doce, y `S26` queda afuera con razón.
- **Las doce acciones administrativas** de `NUCLEO/08` §3: la tabla tiene doce filas.
- **Contrato**: §2.6 tiene las 10 filas que el glosario le atribuye; la dirección inversa tiene 7
  campos en 3 preguntas.
- **Plazos**: la ventana de autorización (72 h / 7 días) y el tope de pausa (4 pausas-mes ≈ 120 días
  contra 180) se dicen igual en todos los capítulos que los nombran.
- **Pares con dos filas** (`NUCLEO/03` regla 7): el nuevo segundo evento de `S6` desde `ACTIVE` no
  comparte `(desde, evento)` con ninguna otra fila; los cuatro pares siguen siendo cuatro.

## Fuera de mi vector

- **La vuelta del suspendido con marca abierta.** `B/03` §3.3 prohíbe suceder una fila *«con una
  marca `requiere_conciliación` abierta… cualquiera sea su motivo»* (`03-maquinas-de-estado.md`,
  tras la tabla del §3.3) y desde `DEC-SUB-019` el pagador con tarjeta suspendido **sólo** vuelve como
  sucesora: una `SUSPENDED` con marca abierta no tiene salida para el cliente. Le toca a A2/B2.
- **`S7` sobre tarjeta** (`03-maquinas-de-estado.md:128`) promete `ACTIVE` en los bordes sin decir de
  dónde sale el cobro siguiente: es el mecanismo detrás de F-8CD1-004. Le toca a B1.

## Key Learnings

1. El tipo de defecto dominante del corpus ya no es la ausencia sino **la regla vieja que sobrevive
   en el lugar viejo**: los cuatro `ALTA` son una regla corregida en un § y enunciada intacta en otro
   (`DEC-SUB-003`/`B/03` §4, `V/10` §2, `B/05` C1, `GR-3`).
2. Las decisiones del 2026-09-24 citan mediciones (sonda 49, lectura de `RN-3`, lotes `:02`) que no
   llegaron a la matriz: la regla *«la matriz manda»* está rota justo en la tanda más reciente.
3. El log tiene **IDs duplicados** (`DEC-ENT-002`, `DEC-ARCH-008`): contar encabezados da 111 y
   contar IDs únicos da 109. Un recuento de decisiones tiene que contar las dos cosas.
4. Un resolvedor de `§` contra encabezados reales encontró seis referencias rotas en minutos. Sirve
   para CI y es barato.
5. Los números que un párrafo dice de sí mismo («cinco», «tres precisiones», «cinco reglas») caducan
   cuando se agrega un ítem y nadie recuenta. Los que se recontaron con script (invariantes, motivos,
   matriz) cerraron todos.
