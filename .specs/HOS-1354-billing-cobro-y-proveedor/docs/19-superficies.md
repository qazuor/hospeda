---
title: Master Spec 19 — Superficies: API, Web y Admin
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 19
---

# 19 · Superficies: API, Web y Admin

Mitad **BILLING** del capítulo 19 del programa. La otra mitad vive en la otra épica.

Las superficies no deciden nada. Leen lo que el núcleo resolvió y lo muestran. Por eso este
capítulo es el más corto de la Parte III en lo conceptual y el más largo en una sola cosa: **la
lista de lo que hay que decirle a la gente**, que los capítulos anteriores fueron dejando y que
nadie tiene junta.

---

## 1. La regla que gobierna todo lo demás

El §45 la escribe en una línea y no admite matices:

> *«Autorización backend jamás depende de ocultar UI.»*

**Ocultar un botón no es un control de acceso: es una comodidad.** Todo lo que la UI esconde
tiene que estar rechazado por la resolución de autorización del capítulo 17 (épica de
verticales), y la UI lo esconde **porque ya sabe** que sería rechazado, nunca para que no lo
intenten.

De ahí sale la única regla de diseño que las tres superficies comparten: **la UI y el backend
preguntan lo mismo, al mismo lugar.** Si la UI tuviera su propia copia del criterio, las dos se
separarían en la primera decisión que alguien cambie en un solo lado.

---

## 2. Qué lee cada superficie

| superficie | qué lee | qué NO lee |
|---|---|---|
| **pricing** (§47) | la **versión vigente** de cada plan, y sólo si es vendible (cap. 10 §2) | nada de la suscripción de nadie |
| **Mi Cuenta** (§45) · **Mi Suscripción** (§46) | la **versión anclada** de la suscripción, su estado, y el conjunto efectivo de entitlements y limits | el catálogo vendible, salvo para ofrecer un cambio |

Las dos primeras filas son la distinción del capítulo 10 §2 dicha desde la UI: **el catálogo es lo
que se puede comprar hoy; la suscripción es lo que se compró.** Una pantalla que las mezcle le
muestra a alguien un precio que no es el suyo.

---

## 3. Mi Suscripción · el §46 pide claridad total de scope

El §46 enumera qué mostrar —todas las verticales, trials, suscripciones, ciclo, grace, pausa,
cancelación programada, addons, cortesía, *Free Forever*— y cierra con *«claridad total de
scope»*. Esa última frase es el requisito real, y significa algo concreto:

**cada cosa que se muestra dice en qué vertical vale.** El modelo entero cuelga de
`user + vertical` (cap. 01 §5, núcleo) y una persona puede estar en estados distintos en cinco
verticales a la vez. Una pantalla que liste «tu suscripción» sin decir cuál no es ambigua: es
incorrecta.

Y **lo global se muestra como global**: un addon de scope `USER` o `GLOBAL`, o una clave de
entitlement global (cap. 15 §3, épica de verticales), no pertenece a ninguna vertical. Mostrarlo
dentro de una es sugerir que se pierde con ella.

### 3.1 La cortesía DIFERIDA se muestra, y con su condición

**El §46 manda mostrar la cortesía, y desde `DEC-GRANT-007` hay una que existe y no está
corriendo.** Entre que `S18` cierra la sucesión y que `S9` la re-emite sobre la sucesora, la
persona **tiene ~~días firmados~~ meses firmados y no tiene cortesía vigente** (`NUCLEO/01` §2.6). Lo que esta
pantalla muestra en esa ventana lo fija `DEC-GRANT-012`:

| qué se muestra | de dónde sale | qué dice |
|---|---|---|
| la **cortesía diferida**, en la vertical de la suscripción que la firmó | `courtesy_grant.saldo_meses` no nulo y sin cerrar (cap. 02 §2.4, `NUCLEO/01` §2.6) | ***«te quedan N meses, que empiezan a correr cuando completes el pago»*** — el saldo **con la condición que lo activa**, nunca a secas. **En meses y no en días** desde la FASE 8 completa (`F-8CB1-001`, owner 2026-09-25; `B/14` §4.7); la frase de `DEC-GRANT-012` decía *«N días»*. ⚠️ Cómo se dice un saldo con fracción de mes depende de lo que queda abierto en `B/02` §2.4 |

**Las tres mitades de esa frase son la decisión, y ninguna es adorno.** El **saldo** porque son
~~días~~ meses que la persona ya tiene firmados y esconderlos es esconderle algo suyo; la **condición**
porque *«te quedan N ~~días~~ meses»* sin decir desde cuándo corren es la clase de promesa que
`NUCLEO/07` §5.3 manda anticipar —es lo que el proveedor hace cuando anuncia *«Pagaste la
suscripción»* sobre un cobro que nunca ocurrió (`EX-3`)—; y que la condición sea **completar el
pago** porque es exactamente el acto que evita la pérdida: si la ventana de autorización vence, el
saldo **se cierra y no vuelve** (`DEC-GRANT-011`, `S3`). **Ésta es la única de las formas posibles
que le da a la persona la información con la que evitar esa pérdida**, y decirlo empuja además a
terminar el checkout.

**Y cuando el saldo ya se cerró, esta pantalla deja de mostrarlo**: no es una cortesía diferida
(`NUCLEO/01` §2.6) y seguir mostrando *«te quedan N ~~días~~ meses»* sería la promesa que el párrafo de
arriba rechaza. **Lo que sí se dice, una vez y por el canal en que la persona no está mirando la
pantalla, es que se cerró** — es la fila 18 del §4.

---

## 4. Lo que hay que decir, y no es una mejora de UX

Ésta es la parte que sólo puede escribirse ahora, con los capítulos ya escritos.

**Cada línea de esta tabla es la mitad de una decisión.** No son advertencias amables: son la
condición bajo la cual se aceptó una regla que, sin el aviso, sería indefendible o directamente
injusta. Si la superficie no lo dice, **la decisión se convierte en lo que se le permitió no
ser.**

| # | dónde | qué tiene que decir | de dónde sale |
|---|---|---|---|
| 3 | al **borrar** una ficha | **qué addons se pierden y por cuánto** | `DEC-ADDON-001`, impl. 1 |
| 3-bis | al **pedir la baja** de una suscripción principal teniendo **addons de ficha** (`LISTING`) en esa vertical, antes de confirmar | **qué addons de ficha se cancelan y por cuánto**: mueren con la suscripción —cuando deja de ser fila viva, que según el estado desde el que se pide es al fin del servicio o hoy (fila 8)— y su cobro se corta; **si vuelve, los contrata de nuevo**, no se reanudan | FASE 8 completa, `F-8CA2-003` (owner 2026-09-25), cap. 16 §4.2 y §4.4 |
| 5 | al **pausar estando en cortesía** | que **la pierde**, y dejarlo elegir | `DEC-GRANT-004`, cap. 01 §3 (núcleo) |
| 5-bis | al **pausar**, antes de confirmar | **qué le pasa a la ficha mientras dure la pausa**: sale del sitio público el mismo día, **vuelve sola al reanudar** si el cupo del plan le alcanza, y si la pausa cruza los 90 días queda **archivada** — sin que se borre nada y sin que la vuelta deje de ser automática. Es el acto que **parece que sólo suspende el cobro**, y el cliente no tiene otra forma de enterarse | cap. 03 §5, `12-contrato…` §2.6, `V/03` §9 (`PB2`, `PB4`, `PB7`), `V/02` §4.2 |
| 6 | al **reanudar** una pausa | **una sola cosa: qué día se le va a cobrar** — nada de días perdidos ni compensaciones | `DEC-SUB-010`, impl. 1 |
| 7 | al ~~**cambiar de ciclo**~~ **cambiar de plan —upgrade, downgrade o de ciclo—** teniendo una promo, antes de confirmar | ***«si cambiás de plan, perdés tu promo»***, y que **el importe nuevo ya no lleva el descuento**. La promo no sobrevive a ningún cambio de plan, y el mismo código **no se puede volver a canjear** en el plan nuevo: el §31 permite un uso por user (cap. 14 §2.2) | cap. 14 §2.2 y §2.3 (épica de billing); FASE 8 completa, pendiente 7, owner 2026-09-25 |
| 7-bis | al **canjear una promo de «primer cobro» o de «N cobros»** | **cuántos cobros lleva el descuento, qué monto paga después**, y que cuando termine **va a recibir un correo del proveedor** diciendo que el vendedor cambió el monto. **En una promo de «primer cobro» este aviso es también el de *«tu promo termina»***: los dos se unifican, porque el último cobro con descuento es el primero; en una de «N cobros» ese correo sale aparte, 7 días antes del último cobro con descuento, configurable (`NUCLEO/07` §6; FASE 8 completa, pendiente 8, owner 2026-09-25). **Al pagador manual el canje no se le ofrece**: no hay promos **de monto** para él (cap. 14 §2.5; FASE 8 completa, pendiente 7, owner 2026-09-25); **la extensión de trial sí** (pendiente 8, owner 2026-09-25) | corrección de diseño, FASE 8 completa, `F-8CB1-007`; cap. 14 §2.4, `DEC-MAIL-001` punto 2, `CT-3` |
| 8 | al **pedir la baja estando pausado, suspendido o en el grace** (`S22` / `S23` / `S24`, cap. 03 §3.2), antes de confirmar | **que el servicio termina hoy y no al fin de un período**: desde esos tres estados no queda período pagado que sostener, así que la frase que la §5 pone en la pantalla de la baja —*«seguís hasta el …»*— **no aplica** y prometerla sería prometer días que no hay. **Y en dos de los tres hay además cobertura que se corta hoy, así que la frase no es la misma para los tres.** Si la pausa era una cortesía, **pierde los meses que le quedaban** (en meses desde la FASE 8 completa, `F-8CB1-001`): esa fila **sí emitía cobertura** (`12-contrato…` §2.6), a diferencia de la pausa pedida por el cliente. Y **desde `GRACE_PERIOD` pierde el servicio entero que el §20 le venía dando** —el grace **sí emite fuente**— más lo que le quedara de reloj, que es lo que hace que ésta sea la única de las cuatro bajas que **retira algo que estaba corriendo**; a cambio no se le sigue reclamando el período impago (`DEC-SUB-014`). Es el aviso simétrico de la fila 5, que ya dice lo mismo para el cruce vecino | cap. 03 §3.2, cap. 12 §7.2, `DEC-SUB-010`, `DEC-SUB-014`, `DEC-GRANT-004` |
| 10 | el aviso de **suspensión** | lo que pierde **como turista**, no sólo como anfitrión — y los **días de addon** que se le van a ir. **Y cómo volver, que no es lo mismo según el método de pago**: con tarjeta, *«tu suscripción se suspendió y ya no se te va a cobrar; para reactivarla, volvé a suscribirte con una tarjeta que funcione»* —la suscripción en el proveedor se canceló al suspender (`DEC-SUB-019`), así que no hay pago que la reactive—; con pago manual, que registrando la cuota adeudada vuelve (`MP4`). Sin esto la persona ve *«suspendido»* y no sabe que tiene que pasar de nuevo por el checkout | cap. 15 §6.3 (épica de verticales), `DEC-ADDON-001` impl. 2 |
| 10-bis | al **registrar un pago manual que llegó después de declarar el impago** (`MP4`, cap. 03 §7.1), antes de confirmar | **qué devuelve la reapertura y qué no**: vuelve el servicio y vuelve la publicación (`S7`), y la ficha que se hubiera archivado **vuelve sola si el cupo del plan le alcanza** (`PB7`, `V/03` §9) — pero **el contenido que el hard delete ya borró no vuelve**, y si la suspensión cruzó el día 180 ~~lo que se reactiva es una ficha vacía~~ **esa ficha no se reactiva**: quedó en `PURGED`, final (`V/02` §4.1, `V/03` §9 `PB9`; FASE 8 completa, `F-8CA2-008`, owner 2026-09-25). Es el acto que **parece que sólo deshace un estado**, y prometer una ficha que no está es peor que no prometerla (cap. 12 §4.5, punto 3). **Y si la fila es la predecesora de una sucesión en curso, dice que el pago NO reactiva**: queda pendiente por `S19` y lo resuelve el cierre, igual que en la fila 15. **Y dice QUÉ PERÍODO paga esta transferencia y cuándo se abre la próxima cuota**, que es lo que el admin necesita para contestarle al cliente en el acto y son **dos respuestas distintas** según cuánto duró el atraso: si la reapertura cae **dentro** del período que se acaba de pagar, el pago cubre **ese** período y la próxima cuota es la del día en que termina; si el atraso fue más largo que un período, el pago **se reimputa al período que arranca hoy** y la próxima cuota se abre **dentro de un ciclo** (cap. 03 §7.2, *«al reabrir por `MP4`»*). Sin esto el acto se confirma sin saber qué compró la plata que el cliente acaba de poner | cap. 03 §7.1, §7.2 y §3.2 (`S19`), `V/02` §4.1, `V/03` §9 |
| 10-ter ✚ | el aviso de **suspensión por contracargo** (`S6` por su tercer evento, cap. 03 §3.2) | **no lo mismo que la 10**, y por eso es otra fila: la 10 habla de un cobro que no entró y le pide *«una tarjeta que funcione»*, y acá **el cobro entró y la persona lo desconoció ante su banco** — decirle que revise su tarjeta es falso. Dice **cuatro** cosas: que la suscripción **se suspendió porque el pago —con su fecha y su monto— fue desconocido ante su banco**; que **ya no se le va a cobrar** —el preapproval se canceló en el mismo acto (`DEC-SUB-020`)—; que **una persona sigue el caso**; y que **para volver, se vuelve a suscribir por el checkout**, como cualquier suspendido con tarjeta (`G-R1-A`). Lo que pierde como turista y los días de addon, igual que la 10. **Es un correo propio del catálogo, *«suspendido por contracargo»*, transaccional y no suprimible** (`NUCLEO/07` §6), con este **texto base del owner**: *«Desconociste el cargo de $X del día Y en tu banco. Mientras se resuelve, suspendimos el servicio. Si fue un error, podés volver a suscribirte desde acá.»* (FASE 8 completa, pendiente 6, owner 2026-09-25). El texto base dice la primera y la cuarta; ⚠️ **las otras dos —que ya no se le va a cobrar y que una persona sigue el caso— no están en él**, y si el texto final las lleva no está decidido. ~~⚠️ **Lo que no dice, porque no está decidido**: si puede volver **antes** de que la disputa se resuelva —`DEC-SUB-020` nombra la vuelta tras `reimbursed` y no dice nada del tiempo previo—, y qué se le dice si la disputa se pierde (`settled`)~~ **Cerrado el 2026-09-25 (owner)**: **si puede volver antes de que la disputa se resuelva lo contesta el texto base**: se lo ofrece en el mismo aviso, *«mientras se resuelve»*. ~~⚠️ **Sigue sin decidir** qué se le dice si la disputa se pierde (`settled`)~~ **Cerrado el 2026-09-25 (owner, pendiente 8)**: **al resolverse la disputa sale un correo transaccional por cada desenlace** (`NUCLEO/07` §6): si gana la persona (`settled`), *«la disputa se resolvió a tu favor; tu suscripción sigue ~~cancelada~~ **suspendida**; podés volver cuando quieras»* cuando la fila está `SUSPENDED`, y *«sigue cancelada»* cuando está `CANCELLED` (FASE 8 completa, owner 2026-09-25); si ganamos nosotros (`reimbursed`, `P7`), *«la disputa se resolvió; el cargo era correcto; podés volver a suscribirte desde acá»*. **Y el mismo aviso de contracargo vale cuando la fila estaba en `CANCEL_SCHEDULED`** y `S12` la pasa a `CANCELLED` (orquestador, pendiente 8, derivado de `DEC-SUB-020`). ~~⚠️ **Sobre una `PAUSED` por cortesía** (`S6` por su tercer evento desde la pendiente 8), si el aviso dice además que **la cortesía terminó** —lo que la fila 8 le dice a quien pide la baja en cortesía— no está decidido~~ **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: **a quien estaba en una `PAUSED` por cortesía** (`S6` por su tercer evento desde la pendiente 8) **el aviso le dice además que la cortesía terminó** | `DEC-SUB-020`, FASE 8 completa (`F-8CB3-009`, owner 2026-09-25; pendientes 6 y 8), cap. 03 §3.2 (`S6`, `S12`) y §6 (`P6`, `P7`), `NUCLEO/07` §6 |
| 11 | la compra de **Turista VIP estando suspendido** | que **al regularizar se le cancela**, sin reembolso | cap. 15 §6.3 (épica de verticales), `DEC-ENT-004` |
| 12 | los **tres avisos de aumento** | precio actual, precio nuevo, **la fecha de ese cliente**, y que puede cancelar | `DEC-MP-002` |
| 13 | la confirmación de **revocar un grant** | que deja al cliente **sin servicio**, qué addons corta, **que se pide el MOTIVO y se guarda** —texto libre, `DEC-GRANT-008`: es lo único que hace defendible el acto seis meses después, empezando por ante el beneficiario que pregunta— **y que los que el grant había pasado a costo $0 se apagan y no vuelven solos**: el débito viejo no se reanuda (`PA-5`, `DEC-GRANT-001`) y no hay compensación, así que recuperarlos es volver a suscribirse. Sin esa frase, *«qué addons corta»* se lee como que corta regalos, y **puede estar cortando lo que la persona pagaba** | cap. 08 §3.1 (núcleo), cap. 16 §3.3 y §3.4 (épica de billing) |
| 13-bis | la confirmación de **anclarle una vertical nueva a un grant** | **qué cobro deja de ocurrir**: se cancela la suscripción que el beneficiario paga en esa vertical (`S13`) y termina la cortesía que tuviera vigente ahí. **Y si ahí había una cortesía DIFERIDA, que su saldo se cierra**, con los meses dichos (en meses desde `F-8CB1-001`): son meses que `SUPER_ADMIN` firmó y que **todavía no se entregaron**, así que quien firma tiene que saber que los está terminando (`B/14` §4.3, `B/02` §2.4). **Y con `includesAddons: true` son varios cobros, enumerados uno por uno**: cada addon compatible que venía pagando pasa a $0 con su suscripción de complemento cancelada (`S20`), y **el cliente recibe un correo del proveedor por cada preapproval** (`EX-3`). Es el acto que **parece que sólo agrega**, y por eso necesita la frase más que los otros | cap. 08 §3.1 (núcleo), `12-contrato…` §2.8, cap. 14 §4.3, cap. 16 §3.4 |
| 13-ter | al **otorgar una cortesía temporal** | **que es en meses enteros y sólo sobre un plan mensual** — sobre una suscripción de **plan anual** la operación **no está disponible**, y la pantalla lo dice con su motivo: en pausa el proveedor se saltea fechas de cobro enteras y al reanudar no corre la fecha, así que treinta días que cruzan la renovación de un anual regalan un año. **Y qué le queda** al admin: la cortesía permanente o una promo sobre la renovación. **Si ya hay una cortesía vigente, que se suman meses**, con la **fecha de fin nueva** dicha | FASE 8 completa, `F-8CB1-001` (owner 2026-09-25), `DEC-GRANT-003` impl. 6, `DEC-GRANT-004` punto 3, cap. 14 §4.7, cap. 03 §3.2 (`S9`) |
| 13-quater | al **elegir un plan anual** —el cambio de plan, o el checkout de un alta nueva— **teniendo una cortesía vigente o un saldo diferido** en esa vertical | **que pierde los N meses de cortesía que le quedan**, porque sobre un plan anual no hay cortesía temporal, y que decide él: puede seguir en mensual y conservarlos | `DEC-GRANT-003` impl. 6, `B/02` §2.4 (`DESTINO_DE_PLAN_ANUAL`) (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25) |
| 14 | el aviso de **discontinuar una vertical** | la **fecha de fin de servicio**, qué pasa con la ficha y **cómo exportarla** | cap. 10 §4.3 |
| 14-bis | el aviso de **discontinuar una vertical**, **a quien está pausado ahí** | **no lo mismo que la 14, y por eso es otra fila**: a esta persona no le corre una fecha de fin de servicio —**no entra al piso de 60 días**, porque la máquina no puede llevarla a `CANCEL_SCHEDULED` (cap. 03 §3.3)—, le corre **el reloj de su pausa**. Dice que la vertical cierra, que **su pausa sigue corriendo y no se la toca nadie**, y que **al volver elige de nuevo** porque el plan que tenía dejó de prestarse: la fila muere ahí, por `S25`. **Y si la pausa era una cortesía, que los meses que le quedaban no se pierden** (en meses desde `F-8CB1-001`) — se difieren y se re-emiten sobre lo que elija (`DEC-GRANT-010`). Sale **el día del anuncio**, que es la mitad que carga toda la ventaja de la decisión: enterarse con la pausa corriendo y con tiempo, en vez de el día de la vuelta | cap. 10 §4.3, cap. 03 §3.2 (`S25`), `NUCLEO/07` §6, `DEC-SUB-015`, `DEC-GRANT-010` |
| 15 | el **cambio de plan** con una cuota impaga viva — la que el proveedor reintenta **mientras la predecesora sigue en `GRACE_PERIOD`**, y también la que el cliente puede pagar a mano (cap. 03 §7, `MP1` o `MP4`): son las **dos puertas del mismo pago** mientras esa ventana dura, y el desenlace es idéntico — **las dos puertas son una por método de pago**: la del proveedor es del pagador con tarjeta y la manual del pagador manual. **Si la predecesora con tarjeta ya está `SUSPENDED`, `S6` cerró su puerta** (`DEC-SUB-019`) y no hay cuota impaga que pueda entrar: este aviso no aplica. **Y desde `DEC-SUB-021` (owner 2026-09-25) esta fila no tiene población al confirmar**: en el grace el cambio de plan no se ofrece (fila 17-bis), así que no hay cambio que confirmar con una cuota impaga viva. La cuota puede aparecer **después**, si la predecesora entra en el grace durante la ventana (`S4`); ~~⚠️ qué se le dice entonces, y cuándo, **no está decidido** (cap. 12 §5.3)~~ **entonces recibe los correos normales del grace, más una línea que dice que el cambio de plan sigue pendiente** (`NUCLEO/07` §6; FASE 8 completa, owner 2026-09-25) | que **el cobro de la cuota impaga puede entrar igual**, antes de confirmar — **y qué pasa con esa plata según lo que el cliente haga**: si termina el checkout **se le devuelve**, si lo abandona **le queda** y le paga el período que está usando. Nunca reactiva la suscripción vieja mientras el cambio esté en curso. **Y que la devolución no es instantánea**: la confirma una persona (`DEC-RF-002`), así que lleva unas horas | cap. 12 §5.3, `NUCLEO/07` §6, cap. 03 §3.2 (`S19`) |
| 16 | el **cambio de plan** con un checkout abierto | que **no se ofrece**: *«terminá o cancelá el checkout que tenés abierto»* | cap. 03 §3.3.1 |
| 16-bis | el **alta nueva** tras un primer cobro rechazado, **teniendo un cambio de plan en curso** | lo mismo que la 16, y por una razón distinta: la sucesora sigue viva y **puede autorizar**, así que un alta nueva serían **dos preapprovals cobrando**. Ofrecer *«empezar de nuevo»* acá —que es lo que el cap. 12 §4.4 pide en el caso general— es ofrecer el doble cobro | cap. 03 §3.2 y §3.3.1, cap. 12 §4.4 |
| 17 | el **cambio de plan** estando pausado | que **no se ofrece**: *«reanudá tu suscripción para cambiar de plan»* | cap. 03 §3.3.1 |
| 17-bis ✚ | el **cambio de plan** estando en el grace | que **no se ofrece**, y **qué hacer para poder**, según el método de pago: con tarjeta, *«cambiá tu tarjeta»* —los reintentos del proveedor cobran con ella—; con pago manual, *«pagá tu cuota»*. Y que **con la suscripción al día** puede cambiar de plan | `DEC-SUB-021` (owner 2026-09-25), cap. 03 §3.3.1 y §4, `EX-36`, `GR-3` |
| 17-ter ✚ | el **cambio de plan** de un pagador con tarjeta cuya suscripción figura `ACTIVE` y cuyo preapproval, **releído por id antes de aceptar el cambio**, no está `authorized` —p. ej. `paused` por una mora cuyo aviso no nos llegó— | que **no se ofrece**: *«tu último cobro no entró, actualizá tu tarjeta»*, el camino de `DEC-SUB-021`, el mismo de la 17-bis. La relectura corre además la transición que corresponda (cap. 03 §10.1; sobre `paused`, `S6` por su segundo evento), y si esa transición suspende, el aviso que sigue es el de la fila 10 | FASE 8 completa, owner 2026-09-25; cap. 03 §3.2 (`S1`, `S6`) y §10.1, `B/20` §2 (`G-R1-A`), `DEC-SUB-021` |
| 18 | al **quedar un alta sin completar**, por sus **dos** caminos: **venció la ventana de autorización** (`S3`) o **se discontinuó la vertical con el checkout abierto** (`S28`), cap. 03 §3.2 | **tres cosas, y la tercera sólo a veces**: que el alta **no quedó hecha** y que **no se le cobró nada**; que **el plazo que tenía venció**, con **su** fecha y no una global —el plazo **no es el mismo para los dos métodos de pago** (`DEC-SUB-016`), así que el aviso lleva el vencimiento de esa persona y nunca una cifra escrita a mano—, y que **puede volver a empezar**; **y si tenía una cortesía diferida, que esos N meses se cerraron y no vuelven** (`DEC-GRANT-011`; en meses desde `F-8CB1-001`), **con el número dicho** — es la misma cifra que «Mi Suscripción» le venía mostrando por el §3.1. **Por el segundo camino cambian dos de las tres y hay que decirlo**: no venció ningún plazo suyo —**cerramos nosotros la vertical**— y **no puede volver a empezar ahí**, porque deja de admitir altas (cap. 10 §4.3); lo que sí vale igual es que el alta no quedó hecha y que no se le cobró nada. **Y por ese camino el saldo de cortesía NO se cierra**: queda diferido sobre una vertical sin altas, que es el desenlace declarado de `DEC-GRANT-010`, así que la frase de los meses **no va** | cap. 03 §3.2 (`S3`, `S28`) y §3.4 punto 1, cap. 10 §4.3, `DEC-SUB-016`, `DEC-GRANT-011`, `DEC-GRANT-012`, `NUCLEO/07` §6 |
| 19 | al **rechazarse el primer cobro de un alta** (`S16`, cap. 03 §3.2 — la fila va a `CHARGE_DECLINED` y el proveedor cancela la autorización) | **qué hacer, según POR QUÉ la rechazaron**, derivado del `status_detail` con un mapa explícito y un **texto genérico obligatorio** para lo que no esté en el mapa: si fue el **antifraude del proveedor** (`cc_rejected_high_risk`), que **su tarjeta está bien** y que pruebe más tarde, desde otro dispositivo, o nos escriba; si fue **la tarjeta** (`payment_method_not_ready`, fondos, vencimiento), que **revise su medio de pago**. Y en los dos casos, que **no se le cobró nada** y que reintentar **es un alta nueva**. Decirle *«revisá tu tarjeta»* a alguien rechazado por el antifraude lo manda a arreglar algo que funciona, y **cada reintento crea otra alta que el antifraude vuelve a rechazar** — medido tres veces seguidas sobre nosotros mismos la noche del 21/09. El mapa se lee del intento **del alta**, que es uno solo: en una renovación el `status_detail` cambia entre reintentos (`RC-6`) y leerlo temprano describe un estado transitorio. **El contenido del mapa queda abierto**: se llena con lo medido, no se inventa | `DEC-MP-004`, cap. 03 §3.2 (`S16`) |

**La 18 cierra DOS huecos que se abrieron el mismo día y por eso es una fila y no dos.**
`DEC-SUB-016` dejó sin escribir *«qué se le dice a quien se le venció la ventana»* y `DEC-GRANT-012`
dejó sin escribir *«qué se le dice cuando el saldo se cierra»* — y **son el mismo instante**: la
transición que vence la ventana es la que cierra el saldo (`S3`). Mandar dos avisos por un solo
hecho es la forma de que el segundo llegue como una sorpresa después del primero.

**Y la tercera cosa es la que hace defendible a `DEC-GRANT-011`.** Esa decisión le quita a alguien
~~días~~ meses que `SUPER_ADMIN` le firmó, apoyada en que **el acto que corta es suyo**; si además se
enterara por no verlos más en la pantalla, el acto sería suyo y el silencio nuestro. **El número va
dicho** porque decir *«perdiste los ~~días~~ meses de cortesía»* sin cuántos eran es pedirle que se acuerde.

**Los ~~tres que van del 16 al 17~~ ~~cuatro que van del 16 al 17-bis~~ cinco que van del 16 al 17-ter son avisos de una operación que NO se ofrece, y por eso están
acá** (el cuarto, `DEC-SUB-021`; el quinto, la relectura de `S1`, FASE 8 completa, owner 2026-09-25). En los ~~tres~~ ~~cuatro~~ cinco la persona **no queda bloqueada** —puede terminar o abandonar el checkout, puede
reanudar, puede regularizar—, así que lo único que faltaba era **decir el no en voz alta** con su motivo, en vez de que
la operación falle sin explicación o, peor, que alguien construya un mecanismo para un camino que el
proveedor no admite (`EX-11`).

### 4.1 Dos reglas sobre cómo se dicen

1. **La confirmación dice qué va a pasar, no pregunta si estás seguro** (cap. 08 §3.1, núcleo).
   *«¿Estás seguro?»* no transmite información: la persona ya decidió cuando llegó ahí.
2. **Cada aviso lleva la fecha de ese cliente, no una global.** `DEC-MP-002` lo exige para el
   aumento y la razón vale para todos: *«cancelá antes si no aceptás»* no sirve para calcular nada
   si no se dice antes de cuándo.

---

## 5. La baja

**Cancelar es self-service, desde Mi Suscripción, en no más pasos que los que costó
suscribirse**, sin teléfono, sin formulario de contacto y sin hablar con nadie. Está decidido en
el capítulo 22 §1.1 como requisito de diseño, **independiente de si además es obligatorio**.

Lo que pasa después ya está resuelto y la pantalla lo dice: se cancela en el proveedor de
inmediato y **el servicio sigue hasta el fin del período pagado** (`DEC-SUB-009`), con esa fecha a
la vista.

**Y esa fecha no siempre es futura: depende del estado desde el que se pide la baja, y son
cuatro** (cap. 03 §3.2). Desde `ACTIVE` es el fin del período pagado (`S11`). Desde `PAUSED`
(`S22`), desde `SUSPENDED` (`S23`) y desde `GRACE_PERIOD` (`S24`) **es hoy** —al pausar los días
no usados se perdieron (`DEC-SUB-010`), estando suspendido el servicio ya estaba cortado (§21), y
en el grace **el período en curso no está pagado**: su cobro es justamente el que falló
(`DEC-SUB-014`)—, así que **la pantalla dice que el
servicio termina en el acto** en vez de una fecha futura que no existe. Es la misma regla 2 del §4
—*«cada aviso lleva la fecha de ese cliente»*— aplicada a un caso en que la fecha es el día mismo.

**Y en una de las cuatro esa frase corta algo que estaba corriendo.** Desde `GRACE_PERIOD` el
cliente **tiene servicio entero** hasta el instante en que confirma (§20, `12-contrato…` §2.6),
mientras que desde `PAUSED` por `CUSTOMER_REQUEST` y desde `SUSPENDED` no tenía ninguno. Por eso
la fila 8 del §4 nombra los tres estados y **no dice lo mismo de los tres**.

Y sale **nuestro** correo antes que el del proveedor, porque el suyo dice *«por un pago
no realizado o por opción del vendedor»* y a alguien que canceló por su voluntad eso le insinúa
mora (`DEC-MAIL-001`, `EX-3`).

---

## 6. Admin

El §48 enumera veintiuna cosas que el admin debe poder **inspeccionar**. Las **acciones** —que el
§48 no enumera aunque el resto del PDR se las asigne— son las doce del capítulo 08 §3 (núcleo),
cada una con permiso propio, auditoría y confirmación explícita si es destructiva o mueve dinero.

Tres cosas que el panel necesita mostrar y que no son inspección de una entidad, sino la salida
de algo que este diseño creó:

| qué | por qué existe |
|---|---|
| el **listado accionable** de las marcas `requiere_conciliación` **abiertas** | es el canal primario, y el correo es agregado (`DEC-OBS-001`). El listado muestra **el estado real de la fila**, que la marca ya no pisa — **y el MOTIVO de cada marca, desde cuándo está abierta y, en las que devuelven plata, TODOS los pagos que lleva colgados, CUÁNTOS son, el monto TOTAL y QUÉ PROPONE EL SISTEMA** (`B/02` §2.2 y §2.5). Se ordena poniendo **adelante los ~~seis~~ siete motivos que significan *«hay plata del cliente que devolver»*** (`B/02` §2.5, última columna; el séptimo, `COBRO_DUPLICADO`, desde la pendiente 6, owner 2026-09-25). **Ese orden se lee ENTERO sobre el motivo**, que es lo que `DEC-RF-006` devolvió: el caso que `DEC-RF-004` había dejado afuera de la columna —la marca de `S21`, cuya propuesta dependía del disparador— es hoy **el motivo 15**, con su `SÍ` propio, y ordena como los otros ~~cinco~~ seis. **Y una fila del listado puede llevar además un VÍNCULO, cuando el diagnóstico fino de ese motivo está declarado afuera de la marca**: hoy es el motivo **7** y su evento crítico, y el vínculo se resuelve con lo que la marca ya guarda (`DEC-RF-005`, y la fila del 7 en la tabla de abajo). **Y la unidad del listado es la MARCA, no la fila**: una suscripción con dos marcas abiertas aparece dos veces, y `S15` levanta una por vez. Hasta la FASE 9-bis-4 la columna era un booleano y las marcas del corpus —**trece** entonces, ~~**quince** hoy~~ ~~**dieciséis** hoy, desde `F-8CB1-013`~~ ~~**diecinueve** hoy~~ **veinte** hoy: el 16 desde `F-8CB1-013` y el 17, el 18 y el 19 desde `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003` (FASE 8 completa, owner 2026-09-25), y el 20 desde la pendiente 6— llegaban acá indistinguibles: el *«reembolso por confirmar»* que `S18` abre se leía igual que una divergencia de monto |

**Y una marca con motivo llega con un DEFAULT, que es lo último que le faltaba.** Un motivo dice
*qué pasó*; la persona que abre el caso además necesita saber **qué debería hacer**, y hasta la
FASE 9-bis-4 una de las tres ramas que abren `REEMBOLSO_POR_CONFIRMAR` llegaba **sin ninguna
indicación**: la rama 6 de `B/12` §5.3, la baja que pide la propia predecesora. `DEC-RF-003` le
puso el default, y es **DEVOLVER**.

| motivo | qué propone el listado |
|---|---|
| `REEMBOLSO_POR_CONFIRMAR` (ramas 1, 5 y **6** de `B/12` §5.3) | **devolver** |
| `COBRO_POSTERIOR_A_LA_BAJA` | **devolver** (`B/05` C2) |
| `COBRO_POSTERIOR_AL_GRANT` | **devolver** (`B/05` C3) |
| `COBRO_DURANTE_CORTESÍA` | **devolver** — es el camino que `DEC-GRANT-007` eligió por escrito para el riesgo que aceptó (`B/02` §2.5, motivo 12) |
| `PAGO_TARDÍO_RECHAZADO` | **devolver** — sus cuatro condiciones sólo fallan con el pago ya acreditado sobre un período que no compró (`B/05` §3). **Con una salida declarada**: si lo que falló es la condición **2** y el monto de más es un precio nuevo que no se propagó, lo que corresponde es aceptarlo y reactivar, y **cuál de las cuatro falló está en el evento crítico** (`NUCLEO/08` §4.3), no en el motivo — **y el listado ENLAZA a ese evento** (`DEC-RF-005`): la persona ve el motivo y, al lado, un vínculo a la condición que falló, en vez de tener que ir a buscarla. **El vínculo no copia el dato y la marca no gana ninguna columna**: `B/05` §3 dice *«cuál de las cuatro condiciones falló va en el evento y no en el motivo»* y eso **no cambia**; lo que resuelve el vínculo es **dónde está el evento**, y se resuelve con lo que la marca ya guarda —la suscripción, el motivo y `puesta_en` (`B/02` §2.2)—, porque `S14` abre la marca y emite el evento crítico **en el mismo acto** (`B/03` §3.2). Esta fila necesita el vínculo porque su diagnóstico fino está **declarado afuera de la marca**, que es lo que `B/05` §3 decidió y esta decisión no toca |
| `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN_O_DISCONTINUACIÓN` (motivo **15**) | **devolver** — la instancia llegó a `CANCELLED` porque **se revocó el grant que era su título** —la tercera cláusula de `A5`— o porque **a su objetivo lo mató la discontinuación de la vertical** —`S25`, `S27` o `S28`—. **En los dos el cliente no hizo nada y pierde días que pagó**, y en los dos **la causa la conoce el acto mismo**, así que `S21` escribe este motivo sin trazar nada hacia atrás (`DEC-RF-006`; `B/03` §3.2, *«cuál de los dos motivos abre `S21`»*) |
| `COBRO_DUPLICADO` (motivo **20**) ✚ | **devolver** — el cobro llegó sobre un período que ya tenía un cobro acreditado, así que uno de los dos no compró nada (`B/02` §2.5, motivo 20; `P1`; FASE 8 completa, pendiente 6, owner 2026-09-25) |
| `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA` (motivo **14**) | **no devolver**, y no es una laguna: `B/16` §4.4 decidió que *«el período ya pagado no se reembolsa»*, con `DEC-GRANT-001` y el §3.4 de ese capítulo como precedente. Cubre `A6`, la primera cláusula de `A5` y la orfandad causada por cualquiera de las **otras nueve** transiciones de `B/16` §4.3. **Los cuatro disparadores están enumerados uno por uno, con el motivo que le toca a cada uno, en `B/03` §3.2**. La persona confirma la propuesta o ve la razón para apartarse. **Y la fila dice en voz alta CUÁNDO apartarse, porque su población no es homogénea** (`DEC-RF-004`, la condición obligatoria, que `DEC-RF-006` mudó entera a este motivo): de las **doce** transiciones que sacan al título de las filas vivas, **cinco no son un acto del cliente**, y **dos de esas cinco caen acá** — **`S17`**, que es nuestra, y **`S12` cuando su `CANCEL_SCHEDULED` lo puso `S26`**. **Por el criterio de la propia decisión esas dos irían al 15 y quedan acá por MECANISMO**: la transición que mata al título no nombra la causa —`S12` sólo ve *«llegó la fecha de fin de servicio»* y `S17` sólo ve *«la sucesora quedó autorizada»*— y `S21` conoce la cláusula de `A5` que disparó, **no cuál de las doce mató al título tres saltos antes**; hacérsela llegar es mecanismo nuevo, y es justo lo que la discontinuación **no** necesita, porque su acto recorre las filas una por una o su guarda la nombra. **Un default es una propuesta y no una sentencia**; lo que no puede ser es una propuesta que contradice el criterio **en silencio**, y por eso esos dos caminos se leen acá y no se deducen. **Y el piso de 60 días no los salva**: la discontinuación que llega por `S26` → `S12` sí lo trae (`B/10` §4.3 y §4.4), pero es el de la **principal** y no el del complemento, que es otra fila y pudo haber cobrado su período |
| `PAGO_PENDIENTE_SIN_RAMA` | **nada**, y es el único: por definición es el caso que **ninguna** de las seis ramas alcanzó (`B/09` §3, segunda comprobación) |

**El default se propone sobre TODOS los pagos de la marca, no sobre el primero.** Una marca lleva
**N** pagos colgados (`B/02` §2.2) y el listado los muestra con su total, así que *«devolver»*
significa **devolverlos todos**; `S15` no la puede levantar mientras a alguno le falte su
resolución (`B/03` §3.2). Ésa es la mitad sin la cual el default era peor que la marca muda: le
decía a la persona *«éste es el pago, devolvelo»* sobre **uno** de los N, y la persona que hacía
bien su trabajo cerraba el caso con el resto adentro.

**El default NO ejecuta nada, y eso es `DEC-RF-002` intacto.** La persona confirma —o se niega, con
lo que vea delante— y el sistema **no dispara ningún reembolso solo**. Lo que cambia es que ahora
encuentra **una propuesta escrita** en vez de una marca muda: *«acá el default es éste, y la
persona confirma salvo que haya razón para no hacerlo»*. **Las filas de la tabla son ~~ocho~~ nueve y se reparten en tres formas, recontadas sobre la tabla de arriba** (con el 20, pendiente 6, owner 2026-09-25): en ~~**seis**~~ **siete** el default es
**devolver**; en **una** —el 14— es **no devolver**; y **una** —`PAGO_PENDIENTE_SIN_RAMA`— no
propone nada. **En las ~~siete~~ ocho que proponen algo, la propuesta no depende de nada más que el
motivo.** Cada una por la razón que su fila escribe.

**Y esta tabla volvió a ser una columna plana con `DEC-RF-006`, así que conviene decirlo porque
durante una vuelta no lo fue.** `DEC-RF-004` había dejado **un** motivo cuyo default se leía por
RAMA: sobre él *«¿qué propone el sistema?»* no tenía respuesta sin mirar además con qué rama llegó
la marca. La partición del motivo en dos —el **14** y el **15** del `B/02` §2.5— pone esa
distinción **en el motivo mismo**, que es una enumeración cerrada y que quien abre la marca escribe
en el acto. **Lo que la partición no hace**: no agrega mecanismo en producción —`S21` ya elegía
entre las dos propuestas con lo que sabía en ese acto, y lo único que cambia es **en qué campo lo
deja**— ni cambia lo que la marca transporta al barrido. **Lo que sí mueve son las dos cifras del
`B/02` §2.5**, recontadas enteras ahí: **quince** motivos y **seis** que devuelven plata *(quince
entonces; ~~**diecinueve** hoy, con los mismos **seis** `SÍ`~~ **veinte** hoy, con **siete** `SÍ` — FASE 8 completa, `F-8CB1-013`,
`F-8CB3-009`, `F-8CB3-003`, `DEC-SUB-020`, y el 20, `COBRO_DUPLICADO`, con la pendiente 6)*.

**Y con eso el defecto que `DEC-RF-003` cerró queda cerrado por construcción, en vez de por una
cláusula.** Lo que allá falló fue *«una misma marca, con un mismo motivo, con dos indicaciones
distintas según **una rama que el listado no muestra**»* (`B/12` §5.3): la rama 6 llegaba muda
porque el listado no sabía que existía. **Un default por rama con la rama a la vista no era eso, y
por eso era admisible; dos motivos distintos ya no son ni siquiera eso**, porque lo que el listado
muestra —el motivo— **es** lo que decide la propuesta. Lo que sigue prohibido es la distinción
invisible, y ahora no hay ninguna que pueda serlo.

**Y el default vacío es el que ya falló, así que no es una opción neutra.** La marca sin motivo
era indistinguible de las otras catorce y **el pago se quedaba**; una marca con motivo y sin default
reproduce el mismo desenlace con más pasos, porque la persona que no sabe qué se espera de ella
**no hace nada**. Por eso el único que llega sin propuesta es el que no puede tener una.

**Y una propuesta puede ser *«no devolver»*, que no es lo mismo que no tener ninguna.** El **14** es
el caso —`A6`, la primera cláusula de `A5` y la orfandad que no causó la
discontinuación—: `B/16` §4.4 decidió la regla —*«el período ya pagado no se reembolsa»*— y dejó la
excepción en manos de una persona, así que lo que el listado le pone delante es **esa regla
escrita**, con el pago y el monto al lado, en vez de una casilla vacía. La diferencia con
`PAGO_PENDIENTE_SIN_RAMA` es que allá **no hay regla** que proponer y acá sí. **Y el 15 —la
revocación del grant, y la orfandad que causó la discontinuación de la vertical— tampoco es una
casilla vacía**: es la otra regla, la de `DEC-RF-004`, su ampliación y `DEC-RF-006`.
| las **versiones de plan retiradas** con cuántas suscripciones siguen ancladas | es lo que convierte la cola larga del retiro en algo que alguien puede decidir atacar (cap. 10 §3.4) |

Y una que ya estaba decidida y conviene repetir acá porque es de superficie: **`SUPER_ADMIN` firma
toda concesión gratuita**, con el costo operativo declarado en el capítulo 08 §3.1 (núcleo) —el
riesgo es que se termine compartiendo la cuenta, y si aparece se resuelve con un permiso acotado,
nunca con una cuenta compartida—.

---

## 7. Pricing

El §47 pide **una pricing por vertical, Turista incluida**, y define tres situaciones: primer uso
(*Empezar*, que inicia esa vertical), trial (elegir plan e iniciar suscripción) y activo (plan
actual y cambio de plan).

Dos cosas que salen de capítulos anteriores y que la pricing tiene que respetar:

1. **Lee la versión vigente y vendible, nada más** (§2). Un plan retirado no aparece, aunque haya
   gente pagándolo.
2. **Que tenga pricing propia es Eje 2** (cap. 01 §4.3, núcleo, ítem 8): la variación legítima es
   **su página**, no el motor que la alimenta. Una pricing que necesite lógica propia por vertical
   para resolver qué mostrar está resolviendo algo que ya resolvió el núcleo.

---

## Lo que este capítulo NO cierra

- **El diseño visual**, que no es materia de esta spec.
- **Qué endpoints expone la API**, uno por uno: lo que este capítulo fija es **qué lee cada
  superficie**, y de ahí sale la API. Enumerarla antes de FASE 3 sería anticipar el trabajo de las
  épicas.
