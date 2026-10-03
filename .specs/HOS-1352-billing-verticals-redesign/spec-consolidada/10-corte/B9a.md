# B9a · Los grants

Pieza del corte. Mitad *a* de la unidad `B9` («Las concesiones»), partida por el owner en el corte
del MVP (Z): los grants, su fuente con su `piso`, el piso del ancla, `S13`, `S20` (AS), la fuente
`CORTESÍA` real (AQ) y la herramienta del paso 3b.

## Objetivo, alcance y fuera de alcance

<a id="pieza-b9a"></a>

### PIEZA:B9a — en la lista de piezas

| pieza | unidad | cuándo | fuente |
|---|---|---|---|
| `B9a` | `B9` | corte | Z; la fuente `CORTESÍA` (AQ) y `S20` (AS); el esquema de promos y cortesías pasa a `B3` (BG) |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:968, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:744

<a id="fila-b9"></a>

### FILA:B9 — la fila de origen (`B9`, «Las concesiones»)

`B9` está **partida en `B9a`, al corte, y `B9b`, después** (corte del MVP, owner 2026-10-01, Z).
Llama a la pasarela (⛔). Lo que deja funcionando, entre las dos mitades:

- promos, cortesías y grants componen de forma determinista y se enchufan como fuentes;
- **`S20` va a `B9a`, en el mismo acto que `S13`, sobre el esquema vacío** (AS); el modelo de
  addons es de `B3` (AV) (residuo corregido en la fuente el 2026-10-02: la frase que ponía `S20` en
  `B10` quedó tachada);
- **desde la FASE 9 completa**: un canje o un apilado que deja el monto **bajo el piso del proveedor
  se rechaza al canjear**, con el motivo en pantalla (owner 2026-09-25, 4b y 9g);
- **los dos cruces cortesía × pausa tienen fila**, `S34` (cortesía sobre cortesía) y `S35` (la
  persona pausa sobre una cortesía);
- **cada fuente `GRANT` lleva su `piso` por la firma** (9h);
- **la escritura de los dos `permanent_grant` del corte** (`21` §2.4; paso 3b de `D/16` §4.2),
  anclados al vendible de `rank` más alto **de Alojamiento, en la vertical en que tenían `comp`**
  (FASE 9 vuelta 1, `F-8V1C2-004`; owner 2026-09-26, `G1-3`; revertido por el owner el 2026-09-27,
  FASE 9 vuelta 2, `R11-3b`: las dos `comp` son suyas y de Alojamiento);
- **anclar una vertical nueva a un grant emite el aviso de cobertura, igual que otorgarlo y
  revocarlo** (contrato §3, *«quién emite»*; FASE 9 vuelta 2, `F-8V2C1-003`);
- **el piso de todo ancla —al otorgar, al anclar y en el corte— es la versión que trae el acto,
  aceptada sólo si `políticaDePlan(v).vigente`**: billing no resuelve la vigente ni ordena por
  `rank` (contrato §2.8; FASE 9 vuelta 2, `F-8V2C1-004`);
- **la cortesía diferida que `S9` re-emite sobre una sucesora con crédito arranca al agotarse el
  crédito** (FASE 9 vuelta 2, owner 2026-09-27, `R17`);
- **el monto compuesto se redondea una sola vez, hacia abajo, con el mismo cálculo para quien muta y
  para quien compara** (`14` §1.2; FASE 9 vuelta 2, `F-8V2B3-008`);
- **el contador de una promo baja sólo con un cobro que salió con el descuento** (`14` §2.4, `03`
  `P1`; owner 2026-09-27, FASE 9 vuelta 2, `R20`).

Capítulos: `14` entero · `21` §2.4 (los grants del corte) · `03` S9, S13, **S30**, **S34**, **S35** ·
`02` §2.4 · `05` C3 · **`09` §3** (la comparación de monto) (orquestador, FASE 8 completa, pendiente
8). Guards: ninguno.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:145

Las secciones de el capítulo `14`, entero, que la columna de capítulos de la fila le asigna:

<!-- g-secciones: inicio (generado por scripts/generadores/secciones/gen.py; no editar a mano) -->

#### B/14-promos-cortesias-y-grants.md · 14 · Promos, cortesías y grants

Los tres instrumentos aparecen juntos en el §36 como fuentes de entitlements, y el PDR los trata
como variantes de lo mismo. **No lo son, y toda la diferencia está en qué tocan:**

| instrumento | qué toca | con qué mecanismo |
|---|---|---|
| **promo de descuento** (§33) | el **monto** | se muta el monto en el proveedor (`DEC-MP-001`) |
| **cortesía temporal** (§34) | el **cobro** | se **pausa** en el proveedor y el servicio lo sostenemos nosotros (`DEC-GRANT-003`); **sólo sobre planes mensuales y en meses enteros** (§4.7, FASE 8 completa, `F-8CB1-001`) |
| **grant permanente** (§35) | la **obligación** | se cancela toda obligación de pago cubierta (§35.3, `DEC-GRANT-001`) |

Los cuatro huecos de este capítulo se contestan casi todos leyendo esa tabla.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:17

#### B/14-promos-cortesias-y-grants.md · 1. El orden de aplicación y el piso · cierra `A-PROMO-01`

##### B/14-promos-cortesias-y-grants.md · 1.1 Dos descuentos apilables dan resultados distintos según el orden

El §31 declara `stackable` y el §33 admite **porcentaje** y **monto fijo**. Sobre una base de
ARS 1.000, un 20 % y ARS 100:

| orden | cuenta | resultado |
|---|---|---|
| **porcentaje primero** | 1.000 → 800 → 700 | **ARS 700** |
| monto fijo primero | 1.000 → 900 → 720 | ARS 720 |

Sin regla, el total depende del orden en que alguien iteró una lista.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:34

##### B/14-promos-cortesias-y-grants.md · 1.2 La regla: todos los porcentuales primero, después todos los fijos

Y es determinista completa, porque **dentro de cada familia el orden no cambia nada**: los
porcentajes se multiplican y los fijos se suman, y las dos operaciones conmutan. Con dos reglas
—qué familia va primero, y nada más— el resultado queda fijo.

**Y el redondeo es uno, al final** (FASE 9 vuelta 2, `F-8V2B3-008`). Los montos son enteros en la
unidad mínima de la moneda (`B/02` §2.3), y dos porcentajes apilados dan fracciones de centavo.
La composición se calcula sin redondear sobre el precio en la unidad mínima, y **el resultado se
redondea una sola vez, hacia abajo**, a la unidad mínima. Así las dos operaciones siguen
conmutando, que con un redondeo por paso dejaba de ser cierto. **Con ese mismo cálculo derivan el
monto quien muta** —el canje, `S30`, el aumento de `DEC-MP-002`— **y quien compara** —el barrido
(`B/09` §3)—: si redondearan distinto, la divergencia de medio centavo sería permanente y abriría
`DIVERGENCIA_DE_MONTO` en el acto. Hacia abajo por la misma razón que el porcentaje va primero: a
favor del cliente.

**Va primero el porcentaje porque da el total más bajo**, o sea a favor del cliente. Es la misma
dirección que el capítulo 15 (épica de verticales) §2.4 eligió para los limits que no acumulan, y por la misma razón:
una composición que a veces castiga al que acumuló beneficios no se puede explicar.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:46

##### B/14-promos-cortesias-y-grants.md · 1.3 El piso no es nuestro: es del proveedor, y está medido

`PC-2` **`VERIFIED`** (2026-09-15, sandbox y re-verificado en producción): el rango es **ARS 15 a
ARS 2.000.000**. Por debajo, `400 "Cannot pay an amount lower than $ 15.00"`; cero y negativo,
`400 "must be a positive number"`.

De ahí salen tres reglas, en orden:

1. **El monto compuesto se valida contra el rango ANTES de mutar**, nunca se descubre por el
   `400`. Una mutación rechazada deja al cliente pagando el precio entero **en silencio**, porque
   `EX-15` midió que mutar no emite webhook: no hay aviso que nos entere.
2. **Si el resultado cae por debajo del
   piso, el canje —o el apilado— se RECHAZA al canjear, con el motivo en pantalla** (owner
   2026-09-25; FASE 9 completa, 4b; `B/19` §4 fila 7-bis). La redacción anterior mandaba ejecutarlo
   *«con el mecanismo de la cortesía»*, y no había transición que lo hiciera, no heredaba la
   restricción a planes mensuales y **no terminaba nunca**: el contador de la promo sólo baja con
   un cobro confirmado (§2.4) y en pausa no hay cobro. Bajar al piso sigue descartado: le cobraría
   **ARS 15 por ciclo** a alguien a quien le dijimos que no iba a pagar. **Lo gratis ya tiene sus
   dos instrumentos**: el trial y la cortesía. Como todo canje rechazado, **no se consume** (§3.4):
   la persona conserva el código. **Y el motivo en pantalla dice que el mínimo lo pone Mercado
   Pago, no nosotros** (owner 2026-09-25; FASE 9 completa, 9g; el texto, en `B/19` §4 fila 7-bis):
   el piso es del proveedor (`PC-2`), y sin decirlo el rechazo se lee como una regla nuestra.
3. **Por lo tanto un
   descuento del 100 % no se canjea**: el resultado es cero, que el proveedor rechaza igual que el
   piso (`PC-2`). Si lo que se quiere regalar es un período, el instrumento es la cortesía (§4.7),
   que firma `SUPER_ADMIN` (4b).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:66

#### B/14-promos-cortesias-y-grants.md · 2. Una promo en curso cuando cambia el plan · cierra `M-PROMO-02`

##### B/14-promos-cortesias-y-grants.md · 2.1 Las dos preguntas son distintas porque los dos cambios lo son

El §33 admite descuentos de *«N cobros»* y *«forever»*, y el PDR permite cambiar de plan (§27,
§28) y de ciclo (§19). **No son el mismo caso**, y el motivo no es de política sino de mecanismo:

- **bajar de plan** (downgrade) **muta el monto ya** y **la fila sobrevive** (`DEC-SUB-008`,
  `DEC-SUB-007` impl. 2);
- **subir de plan** (upgrade) **cancela y recrea** (`DEC-SUB-007`, alternativa C): la fila que
  llevaba la promo **es sucedida por otra**;
- **cambiar de CICLO cancela y recrea con una re-autorización en el checkout** (`DEC-SUB-006`):
  ídem.

> **El cambio de plan no tiene un solo mecanismo: tiene uno por dirección.** Decir *«cambiar de
> plan muta el monto y la suscripción sobrevive»*, sin distinguir, le atribuye al upgrade el
> mecanismo que `DEC-SUB-007` **descartó por escrito**: la decisión enumera tres alternativas
> —*«(A) aceptar el upgrade gratis…; (B) cobrar la diferencia prorrateada…; (C) cancelar y
> recrear»*— y **decide (C)**.

Y *«inmediato»* en `B/10` §3.5 —*«si nada baja, sigue el camino de upgrade: inmediato»*— significa
**el arranque del checkout**, no la mutación del monto.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:99, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:101

##### B/14-promos-cortesias-y-grants.md · 2.2 Cambio de plan: la promo se pierde

> **FASE 8 completa, pendiente 7, owner 2026-09-25: las promos NO sobreviven a un cambio de
> plan.** La promo se dio sobre el plan en que estaba; si la persona cambia de plan —upgrade,
> downgrade o de ciclo (§2.3)—, **la promo se pierde**. Todo lo que la re-aplicaba sobre la
> sucesora queda tachado abajo.

**Qué pasa con la redención, mecanismo por mecanismo:**

- **en el upgrade y en el cambio de ciclo** —cancelar y recrear—, **`S18` NO re-apunta
  `promo_redemption.subscription_id`**: la redención se queda colgando de la predecesora, que
  termina `CANCELLED` (`B/03` §3.2, `B/02` §2.6). No es una escritura de `S18`: es la ausencia de
  una. La sucesora nace con el precio de lista, y ése es ahora el precio que corresponde;
- **en el downgrade** la fila sobrevive (`DEC-SUB-008`) y la redención sigue colgando de ella.
  **La apaga
  el pedido del downgrade** (`B/12` §2): escribe **`cobros_restantes = 0`** en la
  redención de la fila (`B/02` §2.4), que es la forma que el modelo ya tenía de decir *«sin
  descuento»*, y desde ahí el monto esperado del §2.4 ya no la resta (orquestador, FASE 8 completa,
  pendiente 8; **el pedido y no el acto**, FASE 9 completa, contradicción 1 de `03` §R6.5).
  **La promo se termina en el mismo acto en que `DEC-SUB-008` muta el monto**: ese acto escribe
  `cobros_restantes = 0` y muta al **precio de lista del plan nuevo**, sin promos. Así, entre el
  pedido y el acto que aplica los entitlements al fin del ciclo, el monto esperado es **el del
  plan nuevo, sin promos**, y el `transaction_amount` coincide. **Por qué se movió al pedido**:
  había dos lecturas del mismo instante —*«el del plan NUEVO desde el pedido»* acá y *«el del plan
  vigente»* en el §2.4, `B/12` §2 y `B/09` §3—, y la promo seguía viva según su contador hasta el
  acto, así que el monto esperado la restaba mientras la pantalla prometía *«el importe nuevo ya no
  lleva el descuento»* (`B/19` §4, fila 7); y en el acto *«`S30` no corre»*, así que si el monto
  del pedido llevaba la promo nadie la sacaba.
- **y en la vuelta del suspendido con tarjeta, aunque vuelva al MISMO plan** (owner 2026-09-25;
  FASE 9 completa, 3b): esa vuelta es una sucesión desde `SUSPENDED` (`G-R1-A`), así que la cierra
  `S18`, que no re-apunta la redención. **Se acepta y se dice** en el aviso de suspensión: *«si
  tenías una promo, al volver la perdés»* (`B/19` §4, fila 10). La razón de arriba —*«la promo se
  dio sobre el plan en que estaba»*— no aplica acá, porque la persona no cambia de plan; lo que
  aplica es que no regularizó (`DEC-SUB-021`). **Anotado para el futuro**: ver cómo mejorarlo.

**Y la persona NO puede volver a canjear el mismo código en la sucesora.** La redención no se
borra —queda sobre la predecesora— y `UNIQUE(promo_code_id, user_id)` (`B/02` §2.4) es por user,
no por suscripción: la regla del §31, *«Cada user: máximo un uso de cada código»*, sigue valiendo.
El código que perdió al cambiar de plan ya lo usó.

**Y se dice antes de confirmar el cambio**: *«si cambiás de plan, perdés tu promo»* (`B/19` §4,
fila 7).

|---|---|

1.
2.
3.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:122

##### B/14-promos-cortesias-y-grants.md · 2.3 Cambio de ciclo: la promo se pierde, como en todo cambio de plan

> **FASE 8 completa, pendiente 7, owner 2026-09-25**: el cambio de ciclo es un cambio de plan y
> **ninguna promo lo sobrevive**, tampoco la porcentual `forever` (§2.2). La tabla de abajo queda
> tachada; la pregunta del hueco —*«¿tres cobros en mensual pasando a anual significa tres
> años?»*— ya no se hace, porque la promo no llega al ciclo nuevo.

|---|---|---|

**Y se muestra antes de confirmar el cambio**, con el precio que va a pagar. El checkout de
`DEC-SUB-006` ya le muestra un importe concreto; lo que hay que agregar es que **ese importe ya no
lleva el descuento**, o el cliente lo descubre en el resumen de su tarjeta.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:209

##### B/14-promos-cortesias-y-grants.md · 2.4 Cuándo termina una promo de «primer cobro» o de «N cobros»

> **Corrección de diseño, FASE 8 completa, `F-8CB1-007`.** El §33 pide descuentos de *«primer
> cobro»* y de *«N cobros»*, este capítulo hablaba de *«el contador de N cobros»* (§2.2) y **el
> modelo no tenía contador**: nada contaba cuántos cobros quedaban y nada restituía el precio, así
> que toda promo acotada se volvía `forever`.

**El contador es `promo_redemption.cobros_restantes`** (`B/02` §2.4): **nulo** es `forever`, **N > 0**
son N cobros con descuento por delante y **0** es agotado. Se inicializa al canjear con la duración
del código, y *«primer cobro»* es N = 1.

**Se decrementa UNA vez por cobro confirmado, y «confirmado» tiene una sola lectura**: un pago
`approved` **leído por id** (`B/09` §4), en el mismo acto que lo acredita. No lo mueven una cortesía (§4.2), porque ahí no hay cobro.
Un cambio de plan tampoco lo mueve: **termina la promo** (§2.2; FASE 8 completa, pendiente 7,
owner 2026-09-25). **Y un cobro que salió sin el descuento tampoco**: el contador baja sólo si el
importe cobrado no pasa del monto esperado con esa promo aplicada (owner 2026-09-27, FASE 9 vuelta
2, `R20`, `F-8V2B3-001`). Si Juan canjea un 50 % minutos antes del lote y el registro del ciclo,
creado antes, cobra el precio entero, la promo sigue con su contador intacto para el ciclo que
viene, y la diferencia la marca el barrido con el motivo 24, `IMPORTE_COBRADO_DE_MÁS` (`B/09` §3,
`B/02` §2.5), que propone devolverla.

**Al llegar a 0 se muta el monto del preapproval al monto sin esa promo,
recalculado con las que siguen vivas** (FASE 8 completa, pendiente 7, owner 2026-09-25), con la
misma regla de orden del §1.2 —porcentuales primero, fijos después—: *«700 y nunca 720»*. Sobre
el ejemplo del §1.1 —ARS 1.000 con un 20 % y ARS 100—, si se agota la fija el monto pasa a
**800**, y si se agota la porcentual pasa a **900**; con una sola promo, *«sin esa promo»* es el
precio completo. El proveedor lo permite
sobre una autorizada sin pedir consentimiento nuevo: `PC-1` lo midió (1500 → 2200 → 15 → 1500,
todos `200`, verificado por relectura, y re-verificado en producción) y `PC-3` confirma que la
suscripción sigue `authorized`. Como toda mutación, **se verifica releyendo** (`D5`, `B/06` §4.1):
mutar el monto **no emite webhook** (`EX-15`), así que la relectura es la única confirmación.

**Y el proveedor le escribe al pagador por su cuenta.** `CT-3` lo midió en producción: todo cambio
de monto dispara un correo de Mercado Pago que dice *«El vendedor Hospeda cambió el monto»*, y le
llega **a él y no a nosotros**. `DEC-MAIL-001` ya decidió qué se hace con eso, en sus dos puntos:

- **punto 1: nuestro correo NO bloquea la mutación** —bloquea sólo antes de cancelar—, así que la
  restitución corre aunque el correo falle;
- **punto 2: el correo del proveedor se ANTICIPA, no se desmiente.** Al canjear una promo acotada
  la persona tiene que saber **cuántos cobros lleva el descuento, qué monto paga después** y que
  cuando termine **va a recibir un correo del proveedor avisando el cambio de monto** (`B/19` §4,
  fila 7-bis). **Y se anticipa otra vez antes del último cobro con descuento**, con nuestro correo
  *«tu promo termina; desde el mes que viene pagás $X»* —$X es el monto sin esa promo, recalculado
  con las que siguen vivas—, transaccional (`NUCLEO/07` §6; FASE 8 completa, pendiente 7, owner
  2026-09-25). **Sale 7 días antes del último cobro con descuento, y el plazo es configurable**;
  **en una promo de «primer cobro» se unifica con el aviso del canje** (`B/19` §4, fila 7-bis),
  porque ahí el último cobro con descuento es el primero (FASE 8 completa, pendiente 8, owner
  2026-09-25).

**El monto esperado de una suscripción se deriva siempre, y no se guarda** (FASE 8 completa,
pendiente 7, owner 2026-09-25): es **el precio de su versión de plan menos las promos vivas según
su contador**, compuestas con la regla del §1.2. **Ese precio es el vigente de la versión, con los
aumentos de `DEC-MP-002` ya aplicados** (orquestador, FASE 8 completa, pendiente 8). **Y el
aumento de `DEC-MP-002` muta al monto esperado**, con la versión nueva: parte del precio de lista
y vuelve a restar las promos vivas según su contador (FASE 9 completa, matiz de `F-8CB1-016` en
`03` §R6.5: se deducía de que el reintento lo compara contra él, y ahora se dice). El barrido lo
compara con el `transaction_amount` **releído por id**; si no coinciden, **depende de
quién abrió la divergencia** (orquestador, FASE 8 completa, pendiente 8, derivado de `DEC-CONC-002`
punto 4):

- **si la abrió una mutación NUESTRA** —`S30`, un aumento de precio de `DEC-MP-002` **o `S37`, la de una migración** (revisión del owner, 2026-09-28, C15)—, **reintenta
  la mutación durante 3 días, contados desde esa transición** — (un aumento a un anclado es `S37` desde BZ, corte del MVP, owner 2026-10-02; residuo corregido el 2026-10-02); por tiempo, no por corridas, como el
  reintento de una cancelación nuestra (`B/09` §3)— y después abre la marca con motivo
  **`DIVERGENCIA_DE_MONTO`**. Es el mismo argumento del 📌 del punto 4: terminar un acto nuestro ya
  decidido no es reparar una divergencia;
- **cualquier otra divergencia de monto abre `DIVERGENCIA_DE_MONTO` en el acto**, sin reintento: es
  una divergencia que nadie mandó, y el punto 4 la reserva a una persona.

**Entre el pedido de un downgrade y el acto que lo aplica, el monto esperado es el del plan
nuevo, sin promos** (FASE 8 completa, owner 2026-09-25; FASE 9 completa, contradicción 1
de `03` §R6.5: en esa ventana el plan vigente es el viejo, y el pedido ya mutó al nuevo; la promo
se termina en el pedido, §2.2).

**Entre `S37` y el `S38` que aplica ese cambio, el monto esperado es el precio de lista de la versión destino para su ciclo, sin promos, salvo si el motivo es «aumento»: en ese caso conserva y descuenta la promo viva (BZ; `DEC-MP-002`)** (verificación corta, 2026-09-29, lote M-C). En la migración por retiro es la ventana gemela de la del downgrade, sin promos: `S37` ya mutó el monto (`B/03` §3.2) y la fila sigue en la versión retirada hasta `S38`, así que derivarlo de la versión de la fila le abría `DIVERGENCIA_DE_MONTO` a cada cliente migrado, o hacía que el reintento deshiciera la mutación. **Y el motivo 24 deriva el precio de la versión que rige el período que cubre el cobro**: la destino, si una migración encoló su cambio para ese período (`B/02` §2.5).

**Sin columna nueva.**

**Si la promo se agota con la fila `PAUSED`, ese mes sale con descuento, y se acepta** (FASE 8
completa, pendiente 7, owner 2026-09-25). Sobre una pausada el proveedor rechaza toda modificación
(`EX-11`), así que la mutación falla: **se declara y no se encola nada**. **Y el barrido no compara
el monto de una fila `PAUSED`**, porque ese mes con descuento ya se aceptó, **ni el de una fila
cuyo preapproval la relectura ve `cancelled`** —la `CANCEL_SCHEDULED` y la `SUSPENDED` de tarjeta—,
que ya no se puede mutar (`B/09` §3; FASE 9 vuelta 2, `F-8V2B3-007`); **al reanudar, `S10` es
la transición desde la que corren los 3 días** del reintento (`B/03` §3.2; orquestador, FASE 8
completa, pendiente 8).

> **Las tres cosas que esta
> corrección no cerraba quedaron cerradas por el owner el 2026-09-25** (FASE 8 completa, pendiente
> 7). **Una**: se lee así, y está escrito arriba.
> **Dos**: el monto esperado se deriva, y el barrido reintenta 3
> días antes de marcar — **sólo sobre una mutación nuestra** desde la pendiente 8 (arriba).
> **Tres**: ese mes sale con descuento, y se acepta. La transición que ejecuta la restitución es
> de `B/03` (`S30`), por la regla 1 del núcleo. Lo que estas tres respuestas dejan abierto está en
> *«lo que este capítulo NO cierra»*.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:234

##### B/14-promos-cortesias-y-grants.md · 2.5 El pagador manual no canjea promos de monto

**No hay promos para el pagador manual** (FASE 8 completa, pendiente 7, owner 2026-09-25). El
canje no se le ofrece (`B/19` §4, fila 7-bis). Es coherente con el mecanismo: la promo de
descuento toca el **monto** mutándolo en el proveedor (`DEC-MP-001`, la tabla de arriba del
capítulo), y el pagador manual **no tiene preapproval** (`B/05` §3) que mutar.

**Y la regla es sólo para las promos de monto** (FASE 8 completa, pendiente 8, owner 2026-09-25):
**la extensión de trial (§32) SÍ vale para el pagador manual**. No muta ningún monto, así que la
razón de arriba no la alcanza.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:337

#### B/14-promos-cortesias-y-grants.md · 3. La extensión aplicada el día del vencimiento · cierra `E-PROMO-01`

##### B/14-promos-cortesias-y-grants.md · 3.1 Es una carrera y necesita regla escrita, no una implementación que gane por suerte

El §32 es terminante —*«Sólo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe
rechazar.»*— y no dice qué pasa el mismo día, mientras corre el proceso de expiración.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:350, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:352

##### B/14-promos-cortesias-y-grants.md · 3.2 Gana el estado escrito, y la fecha de fin sin pasar

**El canje vale si y sólo si la fila del trial sigue en `TRIAL_ACTIVE` y su fecha de fin no pasó, en el instante de
escribir** (FASE 9 vuelta 2, `F-8V2A2-003`; `V/03` §2, `T4`; residuo corregido el 2026-10-02), verificado con la concurrencia optimista del capítulo 05. **Y quien escribe es
verticales**: la fila de `trial` es suya, así que billing no la toca; el canje llama a
`extenderTrial(user, vertical, días, claveDeCanje)` (`12-contrato…` §4.1), verticales corre `T4`
dentro del lock de la máquina de trial con el techo ya aplicado (`V/11` §3) y contesta `ACEPTADA`
o `RECHAZADA(motivo)`, y **billing gasta el código sólo con `ACEPTADA`**; la clave de canje hace
idempotente el reintento (owner 2026-09-26, `G4-2`; FASE 9 vuelta 1, `F-8V1C1-009`), y verticales
la guarda en `canje_de_trial`, `V/02` §2.2 (FASE 9 vuelta 3, `F-8V3C1-003`).

- Un canje antes de la fecha de fin, con el job todavía sin correr, **es válido**; **con la fecha de fin ya pasada se rechaza, haya corrido o no el job**: con el job de `T3` atrasado, `extenderTrial` contesta `RECHAZADA` y el código no se consume (§3.4; FASE 9 vuelta 2, `F-8V2A2-003`; residuo corregido el 2026-10-02).
- Un canje después de que el job escribió `TRIAL_EXPIRED` **se rechaza**, aunque sea el mismo día.

(Sin efecto desde `F-8V2A2-003`, FASE 9 vuelta 2: `T4` exige además la fecha de fin sin pasar; residuo corregido el 2026-10-02.)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:357

##### B/14-promos-cortesias-y-grants.md · 3.3 Y el job tiene la mitad que se olvida

**El job de vencimiento re-lee la fecha de fin dentro de su propia transacción**, no actúa sobre
la que leyó al armar el lote.

Sin eso, un job que selecciona *«los trials que vencen hoy»* y los procesa cinco minutos después
vence uno que, en el medio, se extendió diez días. El **evento** de T3 —*llega la fecha de fin*—
dejó de ocurrir, y la tabla del capítulo 03 §1 es exhaustiva: **lo que la tabla no declara no se
ejecuta.** T3 **no tiene ninguna otra condición**, así que la fecha releída es lo único que la
frena: si el job no la re-lee, nada más lo va a hacer.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:374

##### B/14-promos-cortesias-y-grants.md · 3.4 Un canje rechazado no se consume

Igual que en el techo de extensiones (cap. 11 (épica de verticales) §3.3): la fila de canje no se escribe, y la persona
conserva el código. Cobrarle el canje por una carrera que perdió es castigarla por la hora a la
que corrió un proceso nuestro.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:385

#### B/14-promos-cortesias-y-grants.md · 4. Cómo se combinan entre sí · cierra `A-PROMO-02`

##### B/14-promos-cortesias-y-grants.md · 4.1 `stackable` rige SÓLO entre promos

El §31 define `stackable` y `usableWhileAnotherPromoActive`, y los define **entre promos**. Las
otras combinaciones **no son configuración**: las determina el mecanismo de cada instrumento, y
volverlas configurables permitiría configurar un estado que el proveedor rechaza.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:393, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:395

##### B/14-promos-cortesias-y-grants.md · 4.2 Promo de descuento + cortesía temporal

**Durante la cortesía el descuento no se aplica, y no hace falta que se aplique.**

La cortesía **pausa** la suscripción (`DEC-GRANT-003`), y `EX-11` **`VERIFIED`** midió que estando
pausada el proveedor **rechaza toda modificación**. O sea que mutar el monto ahí no es una
decisión: es imposible.

Y no hay pérdida, porque **no hay cobro que descontar**: mientras corre la cortesía no se cobra
nada. Entonces:

**el descuento se suspende con la cortesía y se reanuda al volver, con su contador intacto** —
ningún cobro ocurrió, así que ningún cobro se consumió. Y no hace falta una regla para eso: el
contador —`cobros_restantes`— sólo se decrementa con un cobro confirmado (§2.4).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:401

##### B/14-promos-cortesias-y-grants.md · 4.3 Cortesía temporal + grant permanente

**Sobre un grant no se otorga cortesía**, y no es una restricción arbitraria: el §35.3 ordena
*«cancelar toda obligación de pago cubierta»*, así que **no queda nada que no cobrar**. Es la
misma forma que `DEC-GRANT-004` eligió para *«sobre una pausa no se otorga»*.

> **Y el predicado es *«un ANCLA VIVA en esa vertical»*, no *«el beneficiario tuvo un grant
> alguna vez»*.** La razón es la frase de arriba leída al pie: lo que impide la cortesía es que
> **no queda obligación de pago**, y sobre un grant **revocado** sí queda —el beneficiario volvió
> a suscribirse y volvió a pagar (`DEC-GRANT-001`: revocar *«no reanuda el débito viejo: hay que
> pedirle al cliente que autorice uno nuevo»*)—. Desde que la revocación se guarda
> (`permanent_grant.revocado_en`, `B/02` §2.4) el término tiene columna y esta condición se lee
> sola; escrita sin el adjetivo dejaba sin cortesía, para siempre, a quien alguna vez tuvo un
> grant. Es la regla 2 de `NUCLEO/01` §2.4 sobre el sujeto nuevo.
>
> **Y es *«ancla viva»* y no *«grant vivo»* porque la cortesía es por suscripción**
> (`DEC-GRANT-006`): lo que hay que saber es si **esa** vertical está cubierta por el grant, no si
> el instrumento existe. Un grant vivo anclado sólo en Gastronomía **no impide** una cortesía
> sobre la suscripción de Alojamiento, que el beneficiario sigue pagando.

**Y al revés: otorgar un grant termina cualquier cortesía vigente.** No es una pérdida — el grant
es estrictamente mejor y para siempre—, pero la confirmación del capítulo 08 §3.1 tiene que
decirlo, porque el estado en el proveedor cambia de `paused` a `cancelled` y el cliente va a
recibir el correo del proveedor por su cuenta (`EX-3`).

**Y lo mismo vale para la otra escritura que hace cubrir a un grant: anclarle una vertical nueva**
(`12-contrato…` §2.8). Una cortesía **pausa una suscripción concreta** y no lleva scope
(`DEC-GRANT-006`), así que la que termina es **la de la vertical que se ancla**, y termina porque
`S13` cancela esa suscripción. Las cortesías del beneficiario en las demás verticales **no las
toca nadie**: el acto alcanza una vertical, no la cartera. Se dice acá porque *«otorgar un grant»*
se lee como el único momento en que un grant empieza a cubrir, y desde que el scope es el conjunto
de anclas **son dos**. **Y los dos emiten el aviso de cobertura** (`12-contrato…` §3, *«quién emite»*; FASE 9
vuelta 2, `F-8V2C1-003`): cuando el beneficiario no tenía suscripción en la vertical que se ancla,
`S13` no mueve ninguna fila y el anclaje es la única escritura que puede avisar. Sin su aviso,
`PB3` esperaba al reconciliador, y `T2` no disparaba nunca: un trial en curso en esa vertical
seguía hasta `T3`, que le mandaba la campaña de recuperación a quien acababan de regalarle la
vertical.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:416

###### B/14-promos-cortesias-y-grants.md · Y sobre una cortesía DIFERIDA no hay suscripción que cancelar: lo que se cierra es el SALDO

**La regla de arriba cuantifica sobre *«cortesía vigente»*, y desde `DEC-GRANT-007` existe una que
no lo es.** Una **cortesía diferida** —`saldo_meses` no nulo y sin cerrar, `NUCLEO/01` §2.6— no
pausa nada: su suscripción está `CANCELLED` y **no emite ninguna fuente**. Así que el mecanismo que
la frase de arriba nombra —*«termina porque `S13` cancela esa suscripción»*— **no tiene sujeto**:
la suscripción que la pausaba ya está muerta, y la que iba a recibir el saldo todavía no existe o
`S13` la acaba de cancelar junto con las demás. **No es una elección entre políticas: es una regla
cuyo sujeto no existe**, sobre una población que `DEC-GRANT-007` creó el mismo día.

**Qué pasa entonces, y la respuesta sale de recorrer los dos caminos de re-emisión, no de
preferir.** `S9` sólo puede re-emitir un saldo por **una** ruta (`B/03` §3.2): la del segundo
disparador —la cortesía apunta a una fila cuyo `sucedida_por` es **esta**—
(la del tercero salió con `S25`: revisión del owner, 2026-09-28, C8).
Si el saldo **sobreviviera** al grant, después de `S13` **esa ruta no vuelve a matchear nunca**: la sucesora que el `sucedida_por` nombra la canceló `S13`. Tampoco lo levanta la **sexta** comprobación del `B/09` §3, que resuelve *«la fila que tenía
que recibirlo»* con esa misma pregunta. El saldo quedaría **sin dueño, sin vencimiento y sin
nadie que lo mire** — palabra por palabra la forma que `DEC-GRANT-011` descartó ese mismo día, y
que `B/16` §1.3 rechaza por escrito como *«un instrumento abierto sin fecha de cierre»*.

**Entonces el grant CIERRA el saldo, y el cierre se declara.** Se escriben `saldo_cerrado_en` y
`motivo_cierre = GRANT_PERMANENTE_OTORGADO` (`B/02` §2.4) sobre cada cortesía diferida del
beneficiario **en una vertical que el acto ancla** —el mismo alcance que `S13`, ni más ni menos— y
el efecto vive en `S13` porque es la transición que ya recorre ese conjunto (`B/03` §3.2). **Lo
mismo vale para anclarle una vertical nueva a un grant vivo**, que es el otro momento en que un
grant empieza a cubrir.

**Por qué esto no le saca nada a nadie, que es la objeción obvia.** Lo que el saldo sostiene son
meses **sin cobrar** (en meses desde la FASE 8 completa, `F-8CB1-001`), y el grant es
*«cancelar toda obligación de pago»* **para siempre** (§35.3): mientras el grant viva,
esos meses no valen nada porque no hay ningún cobro que evitar — es
exactamente el argumento con que este mismo § prohíbe **otorgar** una cortesía sobre un grant. Y si
el grant después se revoca, el desenlace es el que `DEC-TRIAL-009` ya fijó para el instrumento
hermano: **recibir el grant lo consume y la revocación no lo devuelve**, porque durante el grant la
persona **recibió la cobertura completa**. (`DEC-GRANT-010` salió
con la revisión del owner, 2026-09-28, C8.)

**Y se declara en los dos lugares donde el acto se mira**: la confirmación de otorgar y la de
anclar lo dicen antes de firmar (`NUCLEO/08` §3.1, que cubre las dos, y `B/19` §4 fila 13-bis, que
es la del anclaje), porque quien firma
tiene que saber que está terminando una concesión de `SUPER_ADMIN` que todavía no se entregó; y
queda asentado en la fila, que es lo que `DEC-GRANT-008` pide de toda revocación. **Lo que no se
hace es cerrarlo en silencio**, que es la única lectura de este caso que sería indefendible.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:454

##### B/14-promos-cortesias-y-grants.md · 4.4 Cortesía temporal + cambio de plan

**Una cortesía vigente sobrevive al cambio de plan, y NO lo hace re-apuntándose**
(`DEC-GRANT-007`, owner, 2026-09-21). `S18` la **cierra** sobre la predecesora y le escribe en
`courtesy_grant.saldo_meses` los meses que le quedaban (FASE 8 completa, `F-8CB1-001`;
la fracción de mes queda abierta, `B/02` §2.4); **`S9` la re-emite sobre la sucesora cuando
ésta autoriza** —o sea cuando llega a `ACTIVE`, que es exactamente el `desde` que `S9` ya tiene—,
re-apuntando ahí `subscription_id`, recalculando `inicio`/`fin` y volviendo el saldo a nulo.
**El `inicio` es el fin del crédito de `DEC-SUB-006` cuando la sucesora vive de él** (owner
2026-09-27, FASE 9 vuelta 2, `R17`, `F-8V2B1-004`): la cortesía arranca cuando se agota lo que la
persona ya pagó, y no corre encima de eso. La pausa se abre igual al autorizar, hasta ese `fin`, así
que cruza exactamente los cobros que la cortesía promete saltear
(`B/03` §3.2, `B/02` §2.4 y §2.6). El instrumento no desapareció — **la suscripción que pausaba se
sucedió**, y la cortesía la espera.

**Por qué re-apuntarla en el cierre no se podía ejecutar, que es el defecto que esto cierra.** El
mecanismo de la cortesía **es la pausa**: `DEC-GRANT-003` la implementa *«pausando en el proveedor
y sosteniendo el servicio de nuestro lado»*, así que re-apuntarla obligaba a dejar la sucesora
*«pausada con motivo `COURTESY`»* en el mismo acto. Y ahí los dos desenlaces le cobran:

- **el `hacia` de `S18` es *«el mismo estado»*** y **la única fila que llega a `PAUSED · COURTESY`
  es `S9`**, cuyo `desde` es `ACTIVE` (`B/03` §3.2). Sobre una sucesora en `PENDING_AUTHORIZATION`
  **no hay transición**, así que por la regla 1 del núcleo —*«lo que la tabla no declara, no
  pasa»*— el cierre del camino normal terminaba **en la marca**, o sea en un incidente sobre un
  cliente que no hizo nada mal;
- y si alguien lo implementaba **sin** pausar —que es lo que la celda de efectos decía, porque
  nombraba *«se re-apuntan»* y no *«se pausa»*—, la sucesora autorizaba, arrancaba el período y
  **cobraba**, con la cortesía encima. Una cortesía re-apuntada sobre una fila `ACTIVE` que sigue
  cobrando no es una cortesía: es
  una fila de base que no hace nada, que es el modo de falla que `B/16` §2.4 nombra para rechazar
  una columna.

**Por qué tampoco puede simplemente morirse con la predecesora**, que es lo que pasaba antes de
todo esto: `courtesy_grant.subscription_id` **no es anulable** y desde `DEC-GRANT-006` es **la única
referencia que la cortesía tiene** —se le retiró el `scope`—, así que una predecesora `CANCELLED`
deja la fila apuntando a algo que no emite fuente (`12-contrato…` §2.6). El beneficio que firmó
`SUPER_ADMIN` desaparece **en silencio**: el barrido no compara grants, la fila no queda marcada,
y el cliente se entera cuando le cobran. Y sin `scope` tampoco hay salida alternativa: reemitirla
exige un acto administrativo nuevo, que es *«la acción más grave del catálogo»* de la que alguien
se puede olvidar (`NUCLEO/08` §3). **El saldo es lo que resuelve las dos puntas**: la fila sigue
apuntando a la predecesora —referencia resoluble, `B/02` §2.4— y el beneficio no se pierde, porque
la re-emisión es un acto **del sistema** y no uno que alguien tenga que acordarse de hacer.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:502

###### B/14-promos-cortesias-y-grants.md · La población NO es vacía, y el corpus la enumera

**La versión anterior de este § afirmaba lo contrario y por eso el defecto duró dos tandas.**
Decía: *«acá `S18` siempre corre sobre una sucesora ya `ACTIVE` … el segundo camino de `S18` sale
de `S12` o de `S16`, y una predecesora con cortesía vigente está `PAUSED`, así que ninguna de las
dos la alcanza. No hay caso en que haya que pausar un preapproval que todavía no autorizó»*.
**Las tres cláusulas se caen, y cada una por su lado:**

1. **La enumeración era de dos caminos y hoy son cinco** —`S12`, `S16`, el espejo del §10.1, `S22`
   y `S23`—. El §2.2 de este mismo capítulo ya los corrigió a tres un commit después, **130 líneas
   más arriba**, y este párrafo quedó como estaba.
2. **El espejo sale de `PAUSED`.** Su `desde` es *«cualquier estado vivo que no sea
   `CANCEL_SCHEDULED`»* (`B/03` §10.1) y `PAUSED` es uno de los seis vivos (`B/02` §2.2); está
   medido que el proveedor **rechaza toda modificación sobre una pausada pero sí deja cancelar**
   (`EX-11`, `B/20` §3.2). Así que una predecesora pausada por cortesía **puede** llegar a `S18`
   con la sucesora todavía sin autorizar.
3. **Y `S17` también sale de `PAUSED`** —es uno de sus cinco `desde` alcanzables—, así que ni
   siquiera hace falta el espejo: en el camino **normal** la predecesora pausada por cortesía
   muere por `S17` y `S18` cierra.

**Cómo se llega, contado sobre la tabla que el propio `B/03` §3.2 ya publica.** `G-R1-A` sólo deja
declarar una sucesión desde `{ACTIVE, CANCEL_SCHEDULED}` y desde una `SUSPENDED` de
pagador con tarjeta con el preapproval releído `cancelled` (`B/20` §2; FASE 8 completa,
`F-8CB1-002`; `GRACE_PERIOD` salió con `DEC-SUB-021`, owner 2026-09-25), así que la
predecesora **no está `PAUSED` cuando se declara** — está `ACTIVE`. Después, **dentro de la ventana
de autorización** —**72 h o 7 días corridos**, según el método de pago (`B/03` §3.4 punto 1)—,
`SUPER_ADMIN` otorga la cortesía: es la **fila 2** de la tabla de recorrido del `B/03`
§3.2, *«`ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía | `PAUSED` | ¿sigue siendo fila viva? sí»*.
De ahí en más la sucesión sigue abierta sobre una predecesora pausada por cortesía, y termina por
`S17` (la sucesora autoriza) o por el espejo (el proveedor la da de baja). **La población está
enumerada en la tabla desde antes de que este § dijera que no existía.**

**Qué sí hay que decir sobre la pausa, ahora que entra por el lado correcto.** `S9` corre sobre la
sucesora **ya `ACTIVE`**, así que no choca con `EX-11` —que mide que el proveedor rechaza
modificaciones **estando ya pausada**— ni con la condición de `S9` (*«no hay pausa vigente»*),
porque una sucesora recién autorizada nació sin ninguna. **Y no se le pide al proveedor nada que
nadie haya medido**: pausar un preapproval `pending` no está en la matriz (`B/20` §3.2 tiene
`EX-11` para la pausada y `EX-39` para las fechas, y nada para una `pending`), y ésa es la razón
por la que `DEC-GRANT-007` descartó la alternativa de que la sucesora heredara la pausa.

> **El riesgo aceptado, dicho en voz alta.** Entre que la sucesora autoriza (`S2`) y que `S9`
> re-emite, **el proveedor puede cobrar el primer pago**. Ese cobro **se devuelve por el camino que
> ya existe** —la marca con motivo `COBRO_DURANTE_CORTESÍA` y la confirmación de una persona
> (`B/02` §2.5, `DEC-RF-002`)— y **no se inventa un mecanismo nuevo** para evitarlo. Se prefiere un
> cobro que se devuelve por una vía escrita antes que una pausa que quizá el proveedor no acepta.
>
> **Y si la re-emisión no ocurre, hay quién lo vea**: la **sexta** comprobación de cero llamadas
> del `B/09` §3 levanta la cortesía diferida cuya sucesora ya está `ACTIVE`. Sin ella el
> mecanismo nuevo tendría el mismo modo de falla silencioso que el viejo — *«el barrido no compara
> grants»*—, que es lo que este § pasó dos tandas describiendo.
>
> **Salvo si la sucesora ya cayó en `GRACE_PERIOD`**, que queda afuera a propósito (owner
> 2026-09-26, P1; FASE 9 vuelta 1): la comprobación la busca en `ACTIVE`, y sólo la pierde si `S9`
> no se ejecutó y además el primer cobro llegó antes del barrido, se rechazó y la predecesora venía
> pagando. Si la persona paga, la fila vuelve a `ACTIVE` y la comprobación la levanta; si termina
> suspendida, el saldo queda diferido y lo repara `SUPER_ADMIN` volviendo a otorgar la cortesía
> (`B/09` §3 y su *«lo que este capítulo NO cierra»*).

**Y no contradice `§4.3`**: allá la cortesía **termina** porque el grant cancela la suscripción y
*«no queda nada que no cobrar»*. Acá sí queda: la sucesora cobra, y es exactamente lo que la
cortesía existe para evitar por los meses que le quedan.

**Ni contradice a `S22`, que hace lo contrario con la misma cortesía.** Ahí la persona **pide la
baja** estando pausada y la cortesía *«termina con ella»* (`B/03` §3.2) — no se difiere, porque no
hay ninguna sucesora que la reciba y porque `DEC-GRANT-004` (1) ya eligió que **quien se va pierde
la cortesía que le quedaba, avisándole**. Diferir es para quien **sigue siendo cliente** con otro
plan; terminar es para quien deja de serlo.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:545

##### B/14-promos-cortesias-y-grants.md · 4.5 Extensión de trial + cortesía durante el trial

**Ya está resuelto en el capítulo 11 (épica de verticales) §3**: las dos extienden, **acumulan contra un único techo**
configurable por `user + vertical`, la que no entra se rechaza entera sin consumir el promo, y el
techo ata al canje pero no a `SUPER_ADMIN`.

Se nombra acá porque el hueco lo listaba como tercera combinación, y para dejar escrito que **no
tiene regla propia**: es el mismo techo.

**Y la cortesía durante el trial no es un acto de billing ni cruza el contrato** (owner
2026-09-26, P2; FASE 9 vuelta 1). Es la acción administrativa *«extender un trial»* de
`NUCLEO/08` §3 —la misma que `V/11` §3.4 llama *«extensión firmada por `SUPER_ADMIN`»*—, y la
ejecuta verticales sobre su propia máquina: `T4` con origen `SUPER_ADMIN` y motivo obligatorio,
que pasa el techo y suma al total visible con su origen (`V/03` §2, `V/11` §3.4 y §3.5); la
construye **V4**. No es un `courtesy_grant` —su suscripción no es anulable (`B/02` §2.4) y un
trial no tiene suscripción— ni toca al proveedor (`DEC-GRANT-003` impl. 4). **`extenderTrial`
sigue siendo sólo del canje** (`12-contrato…` §4.1): billing no la llama para esto y no le pasa
ningún origen, así que el techo no se puede saltear por un parámetro que venga de este lado. La
palabra *«cortesía»* queda repartida entre las dos épicas: **la temporal, en meses, es de
billing** (§4.7); **la del trial, en días, es de verticales**.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:613

##### B/14-promos-cortesias-y-grants.md · sección de título retirado, lo que sigue vivo de su cuerpo

**Sale entero**
(revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Una cortesía sobre un
plan **retirado** no tiene nada que resolver: el plan retirado se sigue prestando (`B/10` §3.2), y
la pausa termina reanudando por `S10`. El diferimiento del saldo tiene un solo escritor, el cierre
de `S18` (§4.4).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:634

##### B/14-promos-cortesias-y-grants.md · 4.7 La unidad de la cortesía temporal: meses enteros, y sólo sobre planes mensuales

**FASE 8 completa, `F-8CB1-001`, owner 2026-09-25** (`DEC-GRANT-003` impl. 6, `DEC-GRANT-004`
punto 3). (`NUCLEO/01` §1.5).

**Por qué no puede ser en días.** La cortesía se implementa **pausando** (`DEC-GRANT-003`), y en
pausa el proveedor **se saltea las fechas de cobro enteras** que caen adentro (`PS-6`) y al
reanudar **no corre la fecha** (`PS-5`). Entonces una cortesía **vale los cobros que cruza, no los
días que promete**: diez días que no cruzan una fecha de cobro valen cero, y treinta días sobre un
plan anual que cruzan la renovación regalan un año —y lo mismo, en tres o seis meses, sobre un
trimestral o un semestral—.

| caso | regla |
|---|---|
| **la unidad** | **meses enteros**: N meses saltean exactamente N cobros |
| **el plan** | **sólo mensual** — la misma validación de la pausa (`DEC-SUB-010`; el término del ciclo mensual de `puedePausar()`, `NUCLEO/01` §3). Es condición de `S9` por su primer disparador (`B/03` §3.2) |
| **un plan no mensual** —trimestral, semestral o anual— | **no se ofrece**: el admin ve que no está disponible y por qué, y `S9` no ocurre. Le quedan **la cortesía permanente** (el grant del §35) o **una promo sobre la renovación** (la fila decía *«anual»* donde la regla dice *«sólo mensual»*; FASE 9 completa, contradicción 1 de `03` §R4.5) |
| **cortesía sobre cortesía** | **se suman meses**, no se reemplazan, y el aviso dice la **fecha de fin nueva** (`DEC-GRANT-004` punto 3). **Lo ejecuta `S34`** (`B/03` §3.2): `S9` sale sólo de `ACTIVE` y exige *«no hay pausa vigente»*, así que la segunda cortesía no tenía transición (FASE 9 completa, contradicción 4 de `03` §R4.5) |
| **la cortesía durante el trial** (§34.1) | **no cambia**: extiende el trial, que es nuestro, y **sigue en días** (§4.5, `DEC-GRANT-003` impl. 4 y 6) |
| **la cortesía permanente** | **no cambia** (`DEC-GRANT-003` impl. 5) |

**Y el saldo diferido hereda la unidad**: `courtesy_grant.saldo_meses` —antes `saldo_días`— guarda
meses (`B/02` §2.4), por el escritor del §4.4 (el del §4.6 salió con la revisión del owner, 2026-09-28, C8).

**Lo que esta regla deja abierto, sin resolver acá:**

1. **Cerrado el 2026-09-25**: se redondea **para
   arriba** (`B/02` §2.4), la dirección de error que `DEC-GRANT-003` ya había aceptado.
2. **Cerrado el 2026-09-25**: **el saldo se
   pierde y se avisa antes**. Si la sucesora es de plan **no mensual —trimestral,
   semestral o anual—**, `S18` cierra el saldo con
   `motivo_cierre = DESTINO_DE_PLAN_NO_MENSUAL` (el alta nueva tras `S25` salió con la revisión del owner, 2026-09-28, C8) (FASE 9 completa, contradicción 1 de `03` §R4.5: con *«anual»*, un saldo que caía
   sobre un trimestral o un semestral se re-emitía y `PS-6` lo volvía cero o un ciclo entero). En los dos casos la pantalla se lo dice a la persona antes de elegir el plan (`B/19` §4
   fila 13-quater).
3. **Cerrado el 2026-09-25**: `S9` toma
   **sólo el término del ciclo mensual y los meses enteros** (**decidido por el owner el 2026-09-25**: la cortesía es un regalo nuestro, no un pedido del cliente, así que no gasta su cuota de pausas, no depende de que el plan permita pausar, y alcanza al pagador manual, cuya fecha de cobro es nuestra).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:645

#### B/14-promos-cortesias-y-grants.md · Lo que este capítulo NO cierra

- **El cupo y la ventana de validez** de un código ya los fijó `DEC-PROMO-001`, y el scope *«todas
  las verticales futuras»* lo fijó `DEC-PROMO-002`. No se reabren.
- **Cómo se ejecuta la mutación del monto contra el proveedor** —y cómo se verifica— es del
  capítulo 13, apoyado en el 06.
- **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora o en grace** sigue
  abierto desde `DEC-MP-002` (implicación 6).
- **Compensar días sobre una suscripción en deuda** (`E-SUB-05`) es del capítulo 12.
-
  **Lo que la pendiente 7 dejaba abierto quedó cerrado en la pendiente 8 de la FASE 8 completa**
  (owner 2026-09-25 para el 4 y el 5; orquestador para el 1, el 2 y el 3):
  1. **Cerrado**: **el pedido del downgrade** (`B/12` §2) escribe `cobros_restantes = 0` (§2.2; el
     pedido y no el acto desde la FASE 9 completa, contradicción 1 de `03` §R6.5).
  2. **Cerrado**: el reintento de 3 días vale
     sólo para mutaciones nuestras —`S30` o un aumento de `DEC-MP-002`— y cuenta desde esa
     transición; cualquier otra divergencia abre `DIVERGENCIA_DE_MONTO` en el acto (§2.4).
  3. **Cerrado**: la
     comparación saltea las filas `PAUSED`, y al reanudar los 3 días corren desde `S10` (§2.4).
  4. **Cerrado**: 7 días antes,
     configurable; en una promo de «primer cobro» se unifica con el aviso del canje (§2.4).
  5.
     **Cerrado**: no la alcanza; la regla es sólo para las promos de monto (§2.5).
- **Lo que la pendiente 8 dejaba abierto quedó cerrado** (FASE 8 completa, owner 2026-09-25):
  1. **Cerrado**: en esa ventana el
     monto esperado es el del plan nuevo desde el pedido, porque `DEC-SUB-008` muta el monto en ese acto (§2.4) —**y sin
     promos**: el mismo pedido escribe `cobros_restantes = 0` (FASE 9 completa, contradicción 1 de
     `03` §R6.5; el §2.4 decía *«plan vigente»*, que en esa ventana es el viejo).
- **Cerrado** (FASE 9 vuelta 1, `F-8V1B1-006`): `S30` sale de `ACTIVE` o `GRACE_PERIOD`; con la fila en grace, `S5` y `S30` corren en el mismo acto y la mutación se aplica (`B/03` §3.2, fila `S30`; residuo corregido el 2026-10-02).
  2. **Cerrado**: los 3 días del
     reintento de monto de un aumento corren desde `S37`, la transición que muta el monto siete días antes de la fecha efectiva (BZ; `B/09` §3; `DEC-MP-002` y su 📌 de CC).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:685

<!-- g-secciones: fin -->

<a id="fila-b9a"></a>

### FILA:B9a — «Los grants»

Llama a la pasarela (⛔). Deja funcionando **los grants, su fuente con su `piso`, el piso del ancla
leído con `políticaDePlan(v).vigente`, `S13`, y la herramienta del paso 3b que escribe los dos
`permanent_grant` del corte** (corte del MVP, owner 2026-10-01, Z; `41-corte-del-mvp/00-propuesta.md`
§1: *«el paso 3b escribe los dos `permanent_grant` con la herramienta de `B9`»*); **y la fuente
`CORTESÍA` real, junto con la de `GRANT`, contestando sobre la tabla vacía hasta `B9b`** (corte del
MVP, owner 2026-10-01, AQ); el esquema de promos y cortesías pasa a `B3` (corte del MVP, owner
2026-10-01, BG); **y `S20`, que corre en el mismo acto que `S13`, con el cierre del saldo de una
cortesía diferida (`DEC-GRANT-013`), enteros sobre el esquema vacío** (AS).

Capítulos: `14` (los grants) · `21` §2.4 · `03` S13, **S20** · `02` §2.4 · **`05` C3** (sobre `S13`:
corte del MVP, owner 2026-10-01, Z) · **`09` §3** (la tercera comprobación, motivo 10,
`FAN_OUT_DE_GRANT_INCOMPLETO`, que sirve a `S13` y `S20`: corte del MVP, owner 2026-10-01, AS).
*(Inferido por la fuente, que lo marca: el precedente de la fila de `B7` —las unidades «toman las
comprobaciones del `09` §3 que sirven a sus transiciones»— leído con `S13` y `S20` en `B9a` (Z y AS)
y `A5` en `B5` (AV); y `B11` ya tiene `09` entero.)* Guards: ninguno.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:146

**Fuera de alcance** (y dónde vive): promos, cortesías, `S9`, `S30`, `S34`, `S35`, el canje con
`extenderTrial` y la acción 21, en [B9b](../20-fase-2/B9b.md#pieza-b9b); el esquema de promos y
cortesías, en [B3](B3.md#pieza-b3) (BG); las confirmaciones de revocar y de anclar (filas 13 y 13-bis
del `B/19` §4), en [B13a](B13a.md#pieza-b13a) (BH); el permiso «sólo `SUPER_ADMIN`», en
[V5](V5.md#pieza-v5); la orfandad que apaga los addons al revocar (`A5`), en [B5](B5.md#pieza-b5).

## Historias de usuario y criterios de aceptación

### Historias de usuario

<a id="us-b9a-1"></a>
**US:B9a:1**

Actor: admin

Como `SUPER_ADMIN`, quiero otorgar un *Free Forever* —o anclarle una vertical nueva a uno vivo— y que
en el mismo acto deje de cobrarse lo que el grant cubre, sin reembolso, para que el beneficiario no
pague nunca más algo que le regalamos.

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001) · [ACC:2](../02-nucleo.md#acc-2)

<a id="us-b9a-2"></a>
**US:B9a:2**

Actor: admin

Como `SUPER_ADMIN`, quiero revocar un grant dejando escrito por qué, sabiendo que no se repara nada,
para que el acto sea defendible seis meses después.

Fuente: [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009)

<a id="us-b9a-3"></a>
**US:B9a:3**

Actor: anfitrión

Como anfitrión con un *Free Forever* que incluye addons, quiero que los addons compatibles que ya
venía pagando pasen a costo $0, para no pagar todos los meses algo declarado gratis.

Fuente: [TRANS:B:S20](../04-catalogos.md#trans-b-s20) · [INV:28](../02-nucleo.md#inv-28)

<a id="us-b9a-4"></a>
**US:B9a:4**

Actor: sistema/cron

Como sistema, quiero que la herramienta del paso 3b escriba los dos `permanent_grant` del corte una
sola vez aunque se corra dos veces, para que las dos cuentas de cortesía del owner queden cubiertas.

Fuente: [PASO:3b](../30-el-corte.md#paso-3b) · [FILA:B9a](#fila-b9a)

### Criterios de aceptación

<a id="ac-b9a-1"></a>
**AC:B9a:1** — otorgar un grant corta el cobro en el acto (`S13`)

- **Dado** un beneficiario con filas vivas PRINCIPALES en una vertical —en cualquiera de los seis
  estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos—
- **Cuando** `SUPER_ADMIN` le otorga un *Free Forever* con un ancla en esa vertical
- **Entonces** cada una de esas filas pasa a `CANCELLED` y **se cancela su preapproval** en el
  proveedor —autorizado o esperando autorización— con la regla de `S17` (si la relectura dice que ya
  está `cancelled`, no se manda nada) y con **nuestro correo antes de cada llamada** (falla
  transitoria: esa cancelación no se ejecuta en esta corrida y se reintenta; sin destinatario: se
  cancela igual y se escala); **sin reembolso** del período ya cobrado; el acceso pasa a darlo el
  grant; una fila que retenía un pago pendiente por `S19` **apaga la bandera en el mismo acto, sin
  reembolso**; una fila `PAUSED` cierra su pausa con `fin_real`; las filas de complemento **no
  entran**. El proceso es **idempotente y reanudable fila por fila**.

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [TPZ:S13](#tpz-s13) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001) · [ACC:2](../02-nucleo.md#acc-2)

<a id="ac-b9a-2"></a>
**AC:B9a:2** — anclar una vertical nueva es el mismo acto, y los tres emiten el aviso de cobertura

- **Dado** un grant vivo sin ancla en la vertical V y un beneficiario que paga en V
- **Cuando** `SUPER_ADMIN` le ancla V con un plan de V y un piso de ese mismo plan
- **Entonces** corre `S13` sobre las principales vivas de V, como al otorgar; y **otorgar, anclar y
  revocar emiten el aviso de cobertura**. Una vertical **sin ancla no recibe nada**: el grant no
  emite fuente donde no ancló, y extenderlo es anclar (desanclar no está declarado).

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [FILA:B9](#fila-b9) · [ACC:2](../02-nucleo.md#acc-2) · [INV:29](../02-nucleo.md#inv-29)

<a id="ac-b9a-3"></a>
**AC:B9a:3** — otorgar cierra el saldo de una cortesía diferida (sembrada)

- **Dado** un beneficiario con una `courtesy_grant` sembrada con `saldo_meses` no nulo y sin cerrar,
  en una vertical que el acto ancla (AS)
- **Cuando** se otorga el grant o se ancla esa vertical
- **Entonces** `S13` cierra el saldo con `saldo_cerrado_en` y `motivo_cierre =
  GRANT_PERMANENTE_OTORGADO`; esos meses no vuelven, tampoco si el grant se revoca después; y escribir
  un cierre ya escrito **no escribe nada**.

Fuente: [DEC-GRANT-013](../01-decisiones-vigentes.md#dec-grant-013) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [FILA:B9a](#fila-b9a)

<a id="ac-b9a-4"></a>
**AC:B9a:4** — `S20` convierte a $0 los complementos compatibles, en ese orden (sembrado)

- **Dado** un beneficiario con filas DE COMPLEMENTO sembradas (AS) en cualquiera de los seis estados
  de la suscripción, con su instancia en uno de sus dos estados vivos y su `addon_product` compatible
  con la vertical que el acto ancla —y, para `VERTICAL_SUBSCRIPTION` y `LISTING`, con el objetivo en
  esa vertical—, una de ellas con la instancia en `PENDING_AUTHORIZATION` y otra `PAUSED` por `S32`
- **Cuando** se otorga, o se ancla, un grant con **`includesAddons: true`**
- **Entonces** en cada fila, **primero la instancia**: una `ACTIVE` sigue `ACTIVE` y pasa a colgar
  del **ancla** como su título; una `PENDING_AUTHORIZATION` no se convierte, muere por `A3` al vencer
  su ventana y la pantalla de *«esperando que completes el pago»* deja de ofrecer el enlace en el
  acto; **después el cobro**: se cancela el preapproval con la regla de `S17` y el correo antes, y la
  fila de complemento llega a `CANCELLED`; **sin reembolso**; la fila `PAUSED` por `S32` cierra la
  pausa con `fin_real`. El proceso es **reanudable fila por fila bajo ese orden**. **Con
  `includesAddons: false`, `S20` no corre** y el complemento sigue cobrando. La fuente sigue
  transportando `addon_instance.addon_version_id`: convertir a $0 no es volver a comprar.

Fuente: [TRANS:B:S20](../04-catalogos.md#trans-b-s20) · [TPZ:S20](#tpz-s20) · [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003) · [INV:28](../02-nucleo.md#inv-28)

<a id="ac-b9a-5"></a>
**AC:B9a:5** — lo que el grant no hace con los addons

- **Dado** un beneficiario sin ningún addon comprado, y otro con un addon cuyo producto **no** declara
  compatible la vertical anclada
- **Cuando** se le otorga un grant con `includesAddons: true`
- **Entonces** al primero **no se le enciende ningún addon**: no nace ninguna instancia (lo único
  automático de `S20` es el fin de un cobro); y el segundo **sigue cobrándose**, porque el grant es
  título sólo donde ancló.

Fuente: [INV:27](../02-nucleo.md#inv-27) · [INV:28](../02-nucleo.md#inv-28) · [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003)

<a id="ac-b9a-6"></a>
**AC:B9a:6** — la fuga del `USER`/`GLOBAL` se deja

- **Dado** un addon sembrado de scope `USER` o `GLOBAL` cuyo producto declara compatibles dos
  verticales, en un beneficiario cuyo grant ancla una sola
- **Cuando** se otorga el grant con `includesAddons: true`
- **Entonces** `S20` lo convierte a $0 y queda gratis **también en la vertical que el grant no
  ancló**; no se relee el producto ni se le pide al grant anclar las dos; y la conversión se apaga
  con el grant al revocarlo (`A5`, de `B5`).

Fuente: [DEC-ADDON-005](../01-decisiones-vigentes.md#dec-addon-005) · [TRANS:B:S20](../04-catalogos.md#trans-b-s20)

<a id="ac-b9a-7"></a>
**AC:B9a:7** — revocar: se guarda el motivo y no se repara nada

- **Dado** un grant vivo que convirtió addons a $0 y cuyo beneficiario consumió su trial al recibirlo
- **Cuando** `SUPER_ADMIN` lo revoca
- **Entonces** se escriben **juntas** las tres columnas de la revocación —`revocado_en`, quién la
  firmó y `motivo_de_revocación` en texto libre— y ninguna se escribe sola; **no se borra ninguna
  fila**, ni el grant ni sus anclas; el beneficiario queda **sin grant y sin suscripción** y **no se
  reanuda el débito viejo**; los addons que el grant había pasado a $0 **se apagan y no vuelven
  solos**; **el trial no vuelve**: no hay transición de vuelta; y la confirmación del acto declara
  las tres cosas (la pantalla es de [B13a](B13a.md#ac-b13a-6)).

Fuente: [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001) · [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009) · [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003) · [ACC:2](../02-nucleo.md#acc-2)

<a id="ac-b9a-8"></a>
**AC:B9a:8** — a lo sumo un grant vivo por beneficiario, por la base

- **Dado** un beneficiario con un grant vivo y otros dos revocados
- **Cuando** se intenta escribir un segundo grant vivo para el mismo beneficiario
- **Entonces** **la base lo rechaza** por el `UNIQUE(beneficiario) WHERE revocado_en IS NULL`; los
  revocados no cuentan; y un grant sin ningún ancla no se escribe: el grant lleva al menos un ancla, o
  no otorga nada.

Fuente: [DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:579

<a id="ac-b9a-9"></a>
**AC:B9a:9** — sólo `SUPER_ADMIN`, en las tres escrituras

- **Dado** un admin que no es `SUPER_ADMIN`
- **Cuando** intenta otorgar, anclar una vertical nueva o revocar un grant
- **Entonces** la operación se rechaza en el backend en los tres casos, y no se escribe nada; la misma
  autorización cubre las tres escrituras sobre el instrumento.

Fuente: [INV:30](../02-nucleo.md#inv-30) · [ACC:2](../02-nucleo.md#acc-2)

<a id="ac-b9a-10"></a>
**AC:B9a:10** — el scope: parcial, global, y *«todas las futuras»* sin tope

- **Dado** un grant con anclas en una, en varias o en todas las verticales actuales
- **Cuando** se crea una vertical nueva
- **Entonces** el grant **no emite fuente** en ella hasta que `SUPER_ADMIN` le ancle un plan —un acto
  del catálogo, auditado, que dispara `S13`—; y ningún grant lleva vencimiento ni tope de verticales
  obligatorio.

Fuente: [INV:29](../02-nucleo.md#inv-29) · [DEC-PROMO-002](../01-decisiones-vigentes.md#dec-promo-002)

<a id="ac-b9a-11"></a>
**AC:B9a:11** — el piso del ancla, validado con `políticaDePlan(v).vigente`

- **Dado** un acto —otorgar, anclar o la herramienta del 3b— que trae una versión de piso
- **Cuando** `políticaDePlan(v).vigente` para esa versión es falso (contra el simulador del contrato
  mientras `V2` no esté integrada)
- **Entonces** el acto **se rechaza y no escribe ninguna fila**; billing no resuelve la vigente ni
  ordena por `rank`; con `vigente` verdadero, el piso queda escrito como referencia a esa versión del
  plan del ancla, nunca como copia de sus valores.

Fuente: [DEP:12](../03-contrato-de-cobertura.md#dep-12) · [LISTA:B9a](#lista-b9a) · [FILA:B9](#fila-b9)

<a id="ac-b9a-12"></a>
**AC:B9a:12** — las fuentes `GRANT` y `CORTESÍA` reales

- **Dado** `B4` mergeada, con la fuente `ADDON` y las de arranque del contrato
- **Cuando** `B9a` agrega la fuente `GRANT` y la `CORTESÍA` real
- **Entonces** **no se toca una línea de lo que dejó `B4`**; **cada `GRANT` sale con su `piso`**; y la
  fuente `CORTESÍA` contesta **desde los datos sobre la tabla vacía** —sin cortesías, no emite
  nada— y su caso del juego de la real pasa sobre una fila sembrada.

Fuente: [LISTA:B9a](#lista-b9a) · [FILA:B9a](#fila-b9a)

<a id="ac-b9a-13"></a>
**AC:B9a:13** — un cobro que entra después del grant (`05` C3)

- **Dado** una suscripción que `S13` canceló al otorgar
- **Cuando** se acredita un cobro posterior —uno o varios ciclos, si la cancelación sigue sin
  confirmarse—
- **Entonces** `S14` pone la marca con motivo `COBRO_POSTERIOR_AL_GRANT` con el cobro colgado y, si
  ya hay una abierta con ese motivo, los siguientes cuelgan de **ésa**; el barrido reintenta la
  cancelación 3 días y después abre `CANCELACIÓN_SIN_CONFIRMAR`; el grant no espera al cobro.

Fuente: [LOCK:C3](../04-catalogos.md#lock-c3) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13)

<a id="ac-b9a-14"></a>
**AC:B9a:14** — la tercera comprobación del barrido: el fan-out incompleto

- **Dado** un otorgamiento cuyo `S13` o `S20` quedó a medias —una fila cubierta por un ancla viva
  sigue viva o su complemento sigue cobrando—
- **Cuando** corre la tercera comprobación del `B/09` §3, que toma esta pieza
- **Entonces** se abre la marca con motivo `FAN_OUT_DE_GRANT_INCOMPLETO` y la acción es reanudar
  `S13`/`S20`, que es idempotente y reanudable fila por fila.

Fuente: [MOT:10](../04-catalogos.md#mot-10) · [FILA:B9a](#fila-b9a) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13)

<a id="ac-b9a-15"></a>
**AC:B9a:15** — la herramienta del paso 3b

- **Dado** la base del corte, después de que el script escribió las cinco pruebas
- **Cuando** quien opera el corte corre la herramienta de `B9a` con la versión que elige
- **Entonces** escribe los **dos** `permanent_grant` de las cortesías del owner, **anclados al vendible
  de `rank` más alto de Alojamiento, en la vertical en que tenían `comp`**, con esa versión aceptada
  sólo si `políticaDePlan(v).vigente`; el grant convierte las dos pruebas del corte de esas cuentas;
  y **correrla dos veces da lo mismo**: saltea el `permanent_grant` ya escrito para ese beneficiario y
  esa vertical y no escribe un segundo.

Fuente: [PASO:3b](../30-el-corte.md#paso-3b) · [FILA:B9a](#fila-b9a) · [FILA:B9](#fila-b9)

<a id="ac-b9a-16"></a>
**AC:B9a:16** — salida de la pieza (el *«Lista cuando»* de `B9a` y lo que toma de `B9`)

- **Dado** `B9a` mergeada en la rama del paraguas, con `B4` y `B8a` adentro
- **Cuando** se corre su juego sobre una base creada desde cero, con filas sembradas para lo que sólo
  existe después (AS)
- **Entonces** **agregar el grant como fuente no toca una línea de lo que dejó `B4`, y cada `GRANT`
  sale con su `piso`** (9h); **otorgar o anclar un grant con una versión de piso que `políticaDePlan`
  no da por vigente se rechaza y no escribe ninguna fila** (`F-8V2C1-004`); **y la fuente `CORTESÍA`
  real contesta desde los datos sobre la tabla vacía, con su caso en el juego de la real sobre una
  fila sembrada** (AQ); **y `S13` sobre una sucesión con un pago retenido apaga la bandera de la
  rama 4 de `12` §5.3 por la interfaz que escribió `B7`, sin cambiar su código** (BL,
  [AC:B9a:17](#ac-b9a-17)). Las cláusulas de `B9` que no son de los grants se demuestran en
  [B9b](../20-fase-2/B9b.md#lista-b9b).

Fuente: [LISTA:B9a](#lista-b9a) · [LISTA:B9](#lista-b9) · [FILA:B9a](#fila-b9a) · [FILA:B9](#fila-b9)

<a id="ac-b9a-17"></a>
**AC:B9a:17** — `S13` apaga la bandera de la rama 4 por la interfaz de `B7`

- **Dado** `B7` mergeada, con la rama 4 de `12` §5.3 escrita entera y su llamada contra la interfaz
  interna que llama `S13`, y una sucesión sembrada cuya predecesora retiene un pago por `S19`
- **Cuando** `SUPER_ADMIN` otorga un grant con un ancla en esa vertical y corre `S13`
- **Entonces** **`S13` apaga la bandera de verdad**, sin reembolso, por esa interfaz; y **el diff de
  `B9a` no cambia el código de `B7`**: la implementación real llega detrás de la interfaz que `B7`
  ya llama (era del criterio de `B7`, que llega antes, y pasa al de `B9a`).

Fuente: [LISTA:B9a](#lista-b9a) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [OWN:41-corte-del-mvp:t9:BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl) · [DEC-ARCH-017#📌6](../01-decisiones-vigentes.md#dec-arch-017-p6)

### Los criterios de terminación de origen

<a id="lista-b9"></a>

#### LISTA:B9 — el criterio de `B9`, en su forma vigente (partido: ver `B9a` y `B9b`)

1. un 20 % y ARS 100 sobre ARS 1.000 dan **700 y nunca 720**;
2. un descuento que deja el monto bajo ARS 15 **se rechaza al canjear, con el motivo en pantalla que
   dice que el mínimo lo pone Mercado Pago, y el código no se consume** (owner 2026-09-25, 4b y 9g;
   `14` §1.3);
3. **una cortesía sobre una `PAUSED · COURTESY` suma meses sin cambiar de estado** (`S34`) y
   **pausar sobre una cortesía la cambia a `CUSTOMER_REQUEST` sólo después de avisar lo que se
   pierde** (`S35`);
4. agregar cortesía y grant como fuentes **no toca una línea** de lo que dejó B4 —**y cada `GRANT`
   sale con su `piso`** (9h)—;
5. **con `extenderTrial` → `RECHAZADA` el código de canje queda intacto, y el reintento con la misma
   `claveDeCanje` después de un `ACEPTADA` no extiende dos veces ni consume el código dos veces**
   (contrato §4.1; FASE 9 vuelta 1, `N-G4V-08`; la mitad de verticales está en el criterio de `V4`);
6. **una cortesía de N meses re-emitida sobre una sucesora con crédito saltea N cobros contados
   desde el fin del crédito** (FASE 9 vuelta 2, owner 2026-09-27, `R17`);
7. **otorgar o anclar un grant con una versión de piso que `políticaDePlan` no da por vigente se
   rechaza y no escribe ninguna fila** (contrato §2.8; FASE 9 vuelta 2, `F-8V2C1-004`);
8. **un 15 % y un 10 % apilados sobre ARS 9.999 mutan el preapproval a 7.649,23 y el barrido deriva
   lo mismo, sin marca** (`14` §1.2; FASE 9 vuelta 2, `F-8V2B3-008`);
9. **una promo de «primer cobro» canjeada después de creado el registro del ciclo, que cobra el
   precio entero, sigue con `cobros_restantes = 1`** (`14` §2.4; FASE 9 vuelta 2, `R20`).

Las cláusulas 4 (entera: la fuente `GRANT` y, por AQ, la `CORTESÍA` real sobre la tabla vacía) y 7 son de `B9a`; las demás, de
[B9b](../20-fase-2/B9b.md#lista-b9b).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1072

<a id="lista-b9a"></a>

#### LISTA:B9a — el *«Lista cuando»* de `B9a`

De las cláusulas de `B9`, las de los grants: **agregar el grant como fuente no toca una línea de lo
que dejó `B4`, y cada `GRANT` sale con su `piso`** (9h); **y otorgar o anclar un grant con una
versión de piso que `políticaDePlan` no da por vigente se rechaza y no escribe ninguna fila**
(`F-8V2C1-004`) (corte del MVP, owner 2026-10-01, Z); **y la fuente `CORTESÍA` real contesta desde
los datos sobre la tabla vacía, con su caso en el juego de la real sobre una fila sembrada** (corte
del MVP, owner 2026-10-01, AQ). *(Lo sembrado, con el mismo precedente que la fuente `ADDON` en
`B4`; la fuente lo marca.)*; **y `S13` sobre una sucesión con un pago retenido apaga la bandera de
la rama 4 de `12` §5.3 por la interfaz que escribió `B7`, sin cambiar su código** (era del criterio
de `B7`, que llega antes: corte del MVP, owner 2026-10-02, BL).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1073

## Reglas

- transiciones: [TRANS:B:S13](../04-catalogos.md#trans-b-s13),
  [TRANS:B:S20](../04-catalogos.md#trans-b-s20);
- candado: [LOCK:C3](../04-catalogos.md#lock-c3) (sobre `S13`; pasa de `B9b` a esta pieza, Z);
- motivo: [MOT:10](../04-catalogos.md#mot-10), y el 3, que abre `S14` desde `C3`,
  [MOT:3](../04-catalogos.md#mot-3) (dueña `B11`; esta pieza lo ejerce);
- invariantes: [INV:27](../02-nucleo.md#inv-27), [INV:28](../02-nucleo.md#inv-28),
  [INV:29](../02-nucleo.md#inv-29), [INV:30](../02-nucleo.md#inv-30); y el ancla por vertical de
  [INV:10](../02-nucleo.md#inv-10) (dueña `V5`);
- decisiones: [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001),
  [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008),
  [DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009),
  [DEC-GRANT-013](../01-decisiones-vigentes.md#dec-grant-013),
  [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003),
  [DEC-ADDON-005](../01-decisiones-vigentes.md#dec-addon-005),
  [DEC-PROMO-002](../01-decisiones-vigentes.md#dec-promo-002),
  [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009);
- y las que ejerce sin ser su dueña («también» y «provee»): el grant anclado con su fuente y su piso,
  [DEC-GRANT-005](../01-decisiones-vigentes.md#dec-grant-005) y
  [DEC-ARCH-006#📌3](../01-decisiones-vigentes.md#dec-arch-006-p3); el permiso,
  [DEC-GRANT-002](../01-decisiones-vigentes.md#dec-grant-002); la cortesía una por suscripción y su
  cierre, [DEC-GRANT-006](../01-decisiones-vigentes.md#dec-grant-006) y
  [DEC-GRANT-014](../01-decisiones-vigentes.md#dec-grant-014); la revocación que dispara la orfandad,
  [DEC-ADDON-006](../01-decisiones-vigentes.md#dec-addon-006); los grants del 3b,
  [DEC-MIG-003](../01-decisiones-vigentes.md#dec-mig-003),
  [DEC-MIG-003#📌2](../01-decisiones-vigentes.md#dec-mig-003-p2),
  [DEC-MIG-006](../01-decisiones-vigentes.md#dec-mig-006) y
  [DEC-MIG-006#📌2](../01-decisiones-vigentes.md#dec-mig-006-p2); la fuente `CORTESÍA` que
  [ACC:1](../02-nucleo.md#acc-1) y [DEC-GRANT-003](../01-decisiones-vigentes.md#dec-grant-003)
  necesitan; y la partición, [DEC-ARCH-017#📌1](../01-decisiones-vigentes.md#dec-arch-017-p1) (AQ, AS).

### Las transiciones de la Suscripción que construye esta pieza

<a id="tpz-s13"></a>
**TPZ:S13** — `S13` → `B9a`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:863

<a id="tpz-s20"></a>
**TPZ:S20** — `S20` → `B9a` (AS).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:870

## Modelo de datos y migraciones

- **`permanent_grant` y `permanent_grant_vertical`** (`B/02` §2.4), que esta pieza crea por ser la
  dueña de los grants y tener `02` §2.4 entre sus capítulos *(inferido de la fila: el §4.6 de `D/16`
  lista sólo el esquema de lo posterior)*: el grant con beneficiario, `includesAddons`, firmante,
  motivo, suscripciones afectadas y las **tres columnas de la revocación**, que van juntas
  ([DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008)); **`UNIQUE(beneficiario) WHERE
  revocado_en IS NULL`** ([DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009)); el ancla con
  `UNIQUE(permanent_grant_id, vertical)`, el plan no anulable con FK compuesta sobre
  `plan(id, vertical)` y el piso no anulable con FK compuesta sobre `plan_version(id, plan_id)`.
  Carril: migración estructural de la rama, antes del corte (AD).
- **Lee, sin crearlas**: cortesías (`courtesy_grant`, con `saldo_meses`, `saldo_cerrado_en` y
  `motivo_cierre`), creadas por `B3` (BG).
- **Crea, por BN**: la columna del ancla del título de `addon_instance` (anulable) con su FK a
  `permanent_grant_vertical`, que nace acá (`B/02` §2.4; [BN](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bn)).
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:575

## API

Las tres escrituras sobre el instrumento —otorgar, anclar una vertical nueva y revocar— son la fila
del grant permanente del catálogo administrativo ([ACC:2](../02-nucleo.md#acc-2)): tier admin, sólo
`SUPER_ADMIN` ([INV:30](../02-nucleo.md#inv-30)), confirmación explícita. El rechazo por piso no
vigente no escribe nada ([AC:B9a:11](#ac-b9a-11)). **Las rutas una por una y los códigos de error no
los cierra la fuente** (`B/19`, *«Lo que este capítulo NO cierra»*): los propone el PR de esta pieza
siguiendo lo escrito del repo, los aprueba la revisión de contexto fresco del momento 1 (y el owner
en el PR si es un permiso nuevo), y quedan escritos en esta sección al mergear
([BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)).

## UI web y admin, e i18n

N/A en esta pieza — las confirmaciones de revocar y de anclar (filas 13 y 13-bis del `B/19` §4) las
construye [B13a](B13a.md#fila-b13a) (BH); esta pieza entrega los datos que dicen (qué cobros corta,
qué complementos, qué saldo cierra).

## Cron y outbox

- **La tercera comprobación del barrido** ([AC:B9a:14](#ac-b9a-14)), que corre en el barrido diario.
- **El correo antes de cada cancelación** de `S13` y `S20`, por el outbox común de `U2`.
- **El aviso de cobertura** al otorgar, anclar y revocar.

## Variables de entorno

N/A — ninguna fila de esta pieza declara una variable de entorno ([FILA:B9a](#fila-b9a)).

## Auditoría y observabilidad

- Las tres escrituras son una acción del catálogo, auditada con su firmante
  ([ACC:2](../02-nucleo.md#acc-2)); la revocación guarda además su motivo
  ([DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008)).
- Las marcas que deja ante una persona: `COBRO_POSTERIOR_AL_GRANT` ([MOT:3](../04-catalogos.md#mot-3))
  y `FAN_OUT_DE_GRANT_INCOMPLETO` ([MOT:10](../04-catalogos.md#mot-10)).

## Seguridad

Sólo `SUPER_ADMIN` otorga, ancla o revoca ([INV:30](../02-nucleo.md#inv-30)); el permiso lo
construye [V5](V5.md#pieza-v5) y el backend lo exige aunque la UI oculte el botón (`B/19` §1). El
rechazo se prueba por ruta ([TEST:B9a:9](#test-b9a-9)).

## Testing esperado

| AC | tests | tipo |
|---|---|---|
| [AC:B9a:1](#ac-b9a-1) | [TEST:B9a:1](#test-b9a-1) | integración con DB |
| [AC:B9a:2](#ac-b9a-2) | [TEST:B9a:2](#test-b9a-2) | integración con DB |
| [AC:B9a:3](#ac-b9a-3) | [TEST:B9a:3](#test-b9a-3) | integración con DB |
| [AC:B9a:4](#ac-b9a-4) | [TEST:B9a:4](#test-b9a-4) | integración con DB |
| [AC:B9a:5](#ac-b9a-5) | [TEST:B9a:5](#test-b9a-5) | integración con DB |
| [AC:B9a:6](#ac-b9a-6) | [TEST:B9a:6](#test-b9a-6) | integración con DB |
| [AC:B9a:7](#ac-b9a-7) | [TEST:B9a:7](#test-b9a-7) | integración con DB |
| [AC:B9a:8](#ac-b9a-8) | [TEST:B9a:8](#test-b9a-8) | migración desde cero |
| [AC:B9a:9](#ac-b9a-9) | [TEST:B9a:9](#test-b9a-9) | ruta API |
| [AC:B9a:10](#ac-b9a-10) | [TEST:B9a:10](#test-b9a-10) | integración con DB |
| [AC:B9a:11](#ac-b9a-11) | [TEST:B9a:11](#test-b9a-11) | integración con DB |
| [AC:B9a:12](#ac-b9a-12) | [TEST:B9a:12](#test-b9a-12) | unitario |
| [AC:B9a:13](#ac-b9a-13) | [TEST:B9a:13](#test-b9a-13) | integración con DB |
| [AC:B9a:14](#ac-b9a-14) | [TEST:B9a:14](#test-b9a-14) | integración con DB |
| [AC:B9a:15](#ac-b9a-15) | [TEST:B9a:16](#test-b9a-16) | integración con DB |
| [AC:B9a:16](#ac-b9a-16) | [TEST:B9a:8](#test-b9a-8), [TEST:B9a:11](#test-b9a-11), [TEST:B9a:12](#test-b9a-12), [TEST:B9a:17](#test-b9a-17) | migración desde cero, integración con DB, unitario |
| [AC:B9a:17](#ac-b9a-17) | [TEST:B9a:17](#test-b9a-17) | integración con DB |

<a id="test-b9a-1"></a>
**TEST:B9a:1** — `S13` sobre los seis estados

Tipo: integración con DB

Cubre: [AC:B9a:1](#ac-b9a-1)

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001)

Una principal por cada estado vivo: todas terminan `CANCELLED`, el falso registra una cancelación
por preapproval vivo y ninguna por el ya `cancelled`, ningún `refund`, la bandera de `S19` apagada,
la pausa con `fin_real`; con la llamada del falso cortada a la mitad, una segunda corrida completa lo
que faltaba sin repetir lo hecho.

<a id="test-b9a-2"></a>
**TEST:B9a:2** — anclar una vertical nueva y el aviso de cobertura

Tipo: integración con DB

Cubre: [AC:B9a:2](#ac-b9a-2)

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [ACC:2](../02-nucleo.md#acc-2)

Anclar V corre `S13` sólo sobre V; otorgar, anclar y revocar emiten cada uno el aviso de cobertura
después del commit, sin entrega durable y sin usar el outbox de `U2`, que es sólo de correos
(CK, [DEC-ARCH-009](../01-decisiones-vigentes.md#dec-arch-009)); la red es el reconciliador diario.
La prueba observa el aviso después del commit y comprueba que un rollback no lo emite;
en una vertical sin ancla la fuente `GRANT` no aparece.

<a id="test-b9a-3"></a>
**TEST:B9a:3** — el cierre del saldo diferido

Tipo: integración con DB

Cubre: [AC:B9a:3](#ac-b9a-3)

Fuente: [DEC-GRANT-013](../01-decisiones-vigentes.md#dec-grant-013)

Con una `courtesy_grant` sembrada con saldo, el otorgamiento escribe el cierre con el motivo; una
segunda corrida no escribe nada; revocar después no reabre el saldo.

<a id="test-b9a-4"></a>
**TEST:B9a:4** — `S20` y su orden, sembrado

Tipo: integración con DB

Cubre: [AC:B9a:4](#ac-b9a-4)

Fuente: [TRANS:B:S20](../04-catalogos.md#trans-b-s20) · [INV:28](../02-nucleo.md#inv-28)

Con las filas sembradas: la instancia cuelga del ancla antes de que el falso registre la cancelación;
cortado el proceso entre las dos escrituras, la corrida siguiente termina la segunda; con
`includesAddons: false` el falso no registra ninguna cancelación de complemento.

<a id="test-b9a-5"></a>
**TEST:B9a:5** — el grant no enciende addons

Tipo: integración con DB

Cubre: [AC:B9a:5](#ac-b9a-5)

Fuente: [INV:27](../02-nucleo.md#inv-27)

Sin addons, otorgar con `includesAddons: true` no crea ninguna `addon_instance`; un addon no
compatible con la vertical anclada conserva su preapproval vivo.

<a id="test-b9a-6"></a>
**TEST:B9a:6** — la fuga del `USER`/`GLOBAL`

Tipo: integración con DB

Cubre: [AC:B9a:6](#ac-b9a-6)

Fuente: [DEC-ADDON-005](../01-decisiones-vigentes.md#dec-addon-005)

El `USER` compatible con dos verticales y grant en una queda convertido y su fuente aparece sin cobro
en las dos.

<a id="test-b9a-7"></a>
**TEST:B9a:7** — revocar sin reparar

Tipo: integración con DB

Cubre: [AC:B9a:7](#ac-b9a-7)

Fuente: [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009)

La revocación escribe las tres columnas juntas; un intento de escribir sólo una la rechaza la base;
ninguna fila se borra; el falso no registra ninguna reanudación; el trial sigue consumido.

<a id="test-b9a-8"></a>
**TEST:B9a:8** — el esquema de los grants desde cero

Tipo: migración desde cero

Cubre: [AC:B9a:8](#ac-b9a-8), [AC:B9a:16](#ac-b9a-16)

Fuente: [DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009) · [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [FILA:B9a](#fila-b9a)

Sobre una base vacía migrada con la rama: existen las dos tablas con sus `UNIQUE`, sus FK compuestas
y las tres columnas de la revocación; `addon_instance` tiene la columna anulable del ancla del título,
con su FK a `permanent_grant_vertical` (BN); un segundo grant vivo para el mismo beneficiario falla, y un
grant sin ningún ancla no se escribe.

<a id="test-b9a-9"></a>
**TEST:B9a:9** — sólo `SUPER_ADMIN`, por ruta

Tipo: ruta API

Cubre: [AC:B9a:9](#ac-b9a-9)

Fuente: [INV:30](../02-nucleo.md#inv-30)

Un admin sin `SUPER_ADMIN` recibe el rechazo de permiso del contrato de errores en otorgar, anclar y
revocar, y la base queda igual.

<a id="test-b9a-10"></a>
**TEST:B9a:10** — una vertical nueva no recibe nada sin ancla

Tipo: integración con DB

Cubre: [AC:B9a:10](#ac-b9a-10)

Fuente: [INV:29](../02-nucleo.md#inv-29) · [DEC-PROMO-002](../01-decisiones-vigentes.md#dec-promo-002)

Con una vertical sembrada después del grant, la fuente `GRANT` no aparece en ella; anclarla la hace
aparecer y corre `S13`.

<a id="test-b9a-11"></a>
**TEST:B9a:11** — el piso con `políticaDePlan(v).vigente`

Tipo: integración con DB

Cubre: [AC:B9a:11](#ac-b9a-11), [AC:B9a:16](#ac-b9a-16)

Fuente: [DEP:12](../03-contrato-de-cobertura.md#dep-12)

Con el simulador del contrato contestando `vigente: no`, otorgar, anclar y la herramienta del 3b no
escriben ninguna fila; con `sí`, el ancla queda con la referencia a esa versión.

<a id="test-b9a-12"></a>
**TEST:B9a:12** — las fuentes `GRANT` y `CORTESÍA` en el juego de la real

Tipo: unitario

Cubre: [AC:B9a:12](#ac-b9a-12), [AC:B9a:16](#ac-b9a-16)

Fuente: [LISTA:B9a](#lista-b9a)

El diff de `B9a` no modifica archivos de `B4`; cada fuente `GRANT` del juego trae `piso`; la
`CORTESÍA` real no emite sobre la tabla vacía y emite sobre la fila sembrada.

<a id="test-b9a-13"></a>
**TEST:B9a:13** — `C3`, cobros posteriores al grant

Tipo: integración con DB

Cubre: [AC:B9a:13](#ac-b9a-13)

Fuente: [LOCK:C3](../04-catalogos.md#lock-c3) · [MOT:3](../04-catalogos.md#mot-3)

Con el falso sin aplicar la cancelación, dos cobros de ciclos seguidos cuelgan de una sola marca
`COBRO_POSTERIOR_AL_GRANT`; a los 3 días se abre `CANCELACIÓN_SIN_CONFIRMAR`.

<a id="test-b9a-14"></a>
**TEST:B9a:14** — la tercera comprobación

Tipo: integración con DB

Cubre: [AC:B9a:14](#ac-b9a-14)

Fuente: [MOT:10](../04-catalogos.md#mot-10)

Con `S13` cortado a la mitad, el barrido abre `FAN_OUT_DE_GRANT_INCOMPLETO`; reanudado, la corrida
siguiente no la vuelve a abrir.

<a id="test-b9a-16"></a>
**TEST:B9a:16** — la herramienta del 3b, dos veces

Tipo: integración con DB

Cubre: [AC:B9a:15](#ac-b9a-15)

Fuente: [PASO:3b](../30-el-corte.md#paso-3b)

Sobre una base con las cinco pruebas escritas, la herramienta escribe dos grants anclados a
Alojamiento con la versión dada; la segunda corrida no escribe nada; con una versión no vigente no
escribe ninguno.

<a id="test-b9a-17"></a>
**TEST:B9a:17** — la bandera de la rama 4, apagada por `S13` real

Tipo: integración con DB

Cubre: [AC:B9a:17](#ac-b9a-17), [AC:B9a:16](#ac-b9a-16)

Fuente: [LISTA:B9a](#lista-b9a) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13)

Sobre una sucesión sembrada con un pago retenido por `S19`, otorgar el grant deja la bandera apagada,
ningún `refund` y la predecesora `CANCELLED`; el diff de `B9a` no toca archivos de `B7`.

## Smoke y etiquetas

N/A — sin etiquetas `status-needs-smoke-*` en la pieza ([GATE:M1](../30-el-corte.md#gate-m1)); la
herramienta del 3b se ejecuta en el ensayo del corte y en el corte real, que son de la pseudo-pieza
`CORTE` ([PASO:3b](../30-el-corte.md#paso-3b)).

## Dependencias, rollback y despliegue

- **Espera a** `B8a` (`B8a → B9a`), a `B4` (`B4 → B9a`) y, por la dependencia entre épicas de la
  fila 12, a `V2` para integrarse ([DEP:12](../03-contrato-de-cobertura.md#dep-12)); se prueba antes
  contra el simulador del contrato.
- **La esperan** [B13a](B13a.md#pieza-b13a) (`B9a → B13a`, BH) y [B9b](../20-fase-2/B9b.md#pieza-b9b).
- **Despliegue**: PR a la rama `epic/HOS-1352-verticales-billing` con el momento 1
  ([GATE:M1](../30-el-corte.md#gate-m1)); la herramienta del 3b corre en el corte.
- **Rollback**: la fuente no fija uno por pieza; pasado el paso 3 del corte sólo se arregla hacia
  adelante (`16-fase-7…` §4.3).

## Labels de Linear

Pasa a `Done` al mergearse en la rama del paraguas; sin etiquetas `status-needs-smoke-*`
([GATE:M1](../30-el-corte.md#gate-m1)).

- Las etiquetas son `kind-spec` más las `area-*` de la fila, y quedan escritas acá al mergear (owner
  [BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs), con sus defaults en
  [DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5); `16-fase-7-del-paraguas.md` §4.7,
  momento 1); el PR de la pieza propone las `area-*` siguiendo lo escrito del repo.

## Abiertos

- Ninguno propio: las rutas y los códigos de error los cerró BS (los propone el PR de esta pieza).

## Origen

`B/descomposicion.md` §2 (filas `B9` y `B9a`), §2.6 (fila 12), §2.12 y §4 (filas `B9` y `B9a`);
`D/16` §4.2 (paso 3b, *«las herramientas del corte»*) y §4.6; `B/03` §3.2 (`S13`, `S20`); `B/05` C3;
`B/02` §2.4 y §2.5 (motivo 10); `NUCLEO/04` (27 a 30); `NUCLEO/08` §3 (la fila del grant);
`01-decision-log.md`; `41-corte-del-mvp/10-decisiones-del-owner.md` (Z, AQ, AS, BG, BH, BL, BS).
