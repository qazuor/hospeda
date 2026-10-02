# B8a · La baja

Pieza del corte. Mitad *a* de la unidad `B8` («Los cambios del compromiso»), partida por el owner
en el corte del MVP (Z). Construye las cuatro bajas cuyo estado de origen existe al corte: `S11`,
`S12`, `S23` y `S24` (AR).

## Objetivo, alcance y fuera de alcance

<a id="pieza-b8a"></a>

### PIEZA:B8a — en la lista de piezas

| pieza | unidad | cuándo | fuente |
|---|---|---|---|
| `B8a` | `B8` | corte | Z; `S11`, `S12`, `S23` y `S24` (AR) |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:962, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:741

<a id="fila-b8"></a>

### FILA:B8 — la fila de origen (`B8`, «Los cambios del compromiso»), en su forma vigente

`B8` está **partida en `B8a`, al corte, y `B8b`, después** (corte del MVP, owner 2026-10-01, Z).
Llama a la pasarela (⛔). Lo que deja funcionando, entre las dos mitades:

- cambiar de plan, de ciclo, pausar y darse de baja, cada uno por su camino y sin pisarse —
  **incluido el CIERRE de la sucesión con sus cinco escrituras**, y **con la dirección del cambio
  saliendo de `direcciónDeCambio` (contrato §4.1) y nunca del `rank`**—;
- **desde `GRACE_PERIOD` no se declara una sucesión** (`DEC-SUB-021`);
- **la suspensión de la principal pausa sus complementos recurrentes por `S32` y `S33` los reanuda
  al volver**, igual que una pausa (owner 2026-09-26, `G2-2`); las tablas del modelo del complemento
  las crea `B3` (corte del MVP, owner 2026-10-01, AV);
- **la vuelta anticipada de una pausa sigue libre**, con su detector en el barrido de `B11` (owner
  2026-09-26, `G5-3`);
- **la baja desde `ACTIVE` cancela en el acto el cobro de los complementos recurrentes que dependen
  de la principal** —la selección de `S32`, con `CANCEL_SCHEDULED` en la exclusión (FASE 9 vuelta 2,
  verificación, owner 2026-09-27, `V2-c`)— **y los sostiene hasta el fin de servicio** (FASE 9
  vuelta 2, owner 2026-09-27, `R1-a`; las tablas del modelo del complemento las crea `B3`, AV);
- **el fin de servicio de una sucesora que vive del crédito es `max(fórmula, fin del crédito)`**
  (FASE 9 vuelta 2, owner 2026-09-27, `R17`), **también cuando la baja sale de `PAUSED · COURTESY`:
  `S22` la lleva a `CANCEL_SCHEDULED` con fin en el fin del crédito** (FASE 9 vuelta 2, verificación,
  owner 2026-09-27, `V2-b`).

Capítulos: `03` §5, S8–S12, **S17–S18**, **S22–S24**, **S31** · `12` §2, §3, §6, §7 · `02` §2.6 ·
`05` C2, C4. Guards: `G-R1-C` pasa a `B8b` (Z); `G-R5` salió (revisión del owner, 2026-09-28, C14).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:142

<a id="fila-b8a"></a>

### FILA:B8a — «La baja»

Llama a la pasarela (⛔). Deja funcionando **la baja: `S11`, `S12`, `S23` y `S24`, las cuatro bajas
cuyo estado de origen existe al corte**; la de una pausa, `S22`, queda en `B8b` (corte del MVP,
owner 2026-10-01, Z y AR; `41-corte-del-mvp/00-propuesta.md` §1: *«la baja self-service es criterio
de `B13`»*); **con sus ramas enteras sobre el esquema vacío**: la de los complementos (`R1-a`) y la
de la sucesora que vive del crédito (`R17`), probadas con filas sembradas (AS); **la prueba de punta a punta
de la baja (`20` §5.1 punto 3) no es de esta pieza sino de [`B13a`](B13a.md#fila-b13a), que construye la pantalla;
acá quedan sus pruebas de integración** (corte del MVP, owner 2026-10-02, CG).

Capítulos: `03` §5, **S11–S12**, **S23–S24** · **`05` C2** (sobre `S11`, `S23` y `S24`: corte del
MVP, owner 2026-10-01, AR y AS). Guards: ninguno.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:143

**Fuera de alcance** (y dónde vive): `S22`, la baja desde una pausa, y la cláusula de `05` C2 sobre
`S22`, en [B8b](../20-fase-2/B8b.md#pieza-b8b); el cambio de plan, de ciclo, la pausa, el cierre de
la sucesión, `S38` y `G-R1-C`, en [B8b](../20-fase-2/B8b.md#pieza-b8b); la pantalla de la baja
self-service y sus avisos, en [B13a](B13a.md#pieza-b13a); `S21` y la orfandad (`A5`), en
[B5](B5.md#pieza-b5); `S32`/`S33`, en [B7](B7.md#pieza-b7).

## Historias de usuario y criterios de aceptación

### Historias de usuario

<a id="us-b8a-1"></a>
**US:B8a:1**

Actor: anfitrión

Como anfitrión con una suscripción `ACTIVE`, quiero darme de baja y seguir con servicio hasta el fin
del período que ya pagué, sin un cobro más ni del plan ni de mis complementos recurrentes, para irme
sin perder lo pagado. *Ejemplo*: Juan, anfitrión de una cabaña en Colón, se suscribió al Básico la
semana siguiente al corte; si pide la baja, su fecha de fin sale del período que pagó su último
cobro acreditado, no de la fecha del próximo cobro.

Fuente: [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [DEC-SUB-009](../01-decisiones-vigentes.md#dec-sub-009) · [INV:22](../02-nucleo.md#inv-22)

<a id="us-b8a-2"></a>
**US:B8a:2**

Actor: anfitrión

Como anfitrión en `GRACE_PERIOD` o `SUSPENDED`, quiero poder darme de baja en el acto, para no
esperar a que me suspendan por falta de pago ni quedar bloqueado para volver a suscribirme.

Fuente: [TRANS:B:S24](../04-catalogos.md#trans-b-s24) · [TRANS:B:S23](../04-catalogos.md#trans-b-s23) · [DEC-SUB-014](../01-decisiones-vigentes.md#dec-sub-014)

<a id="us-b8a-3"></a>
**US:B8a:3**

Actor: admin

Como admin, quiero ejecutar la baja de una suscripción `SUSPENDED`, que es la tercera salida de ese
estado, para liberar el candado `A` del cliente.

Fuente: [TRANS:B:S23](../04-catalogos.md#trans-b-s23)

<a id="us-b8a-4"></a>
**US:B8a:4**

Actor: sistema/cron

Como sistema, quiero cortar el servicio de una `CANCEL_SCHEDULED` cuando llega su fecha de fin, una
sola vez aunque el proceso corra dos veces, y en el orden que deja a la orfandad ver los
complementos, para que ningún residuo quede sin que una persona lo vea.

Fuente: [TRANS:B:S12](../04-catalogos.md#trans-b-s12) · [DEC-SUB-009](../01-decisiones-vigentes.md#dec-sub-009)

### Criterios de aceptación

<a id="ac-b8a-1"></a>
**AC:B8a:1** — la baja desde `ACTIVE` (`S11`) y su fecha de fin

- **Dado** una suscripción principal en `ACTIVE` cuyo `covered_period` más reciente con
  `liberado_en` nulo es `P` —lo pagó el último cobro acreditado, sea `payment` o `manual_payment`—
- **Cuando** la persona pide la baja
- **Entonces** la fila pasa a `CANCEL_SCHEDULED`; el preapproval **se cancela en el proveedor de
  inmediato**, con la regla de relectura de `S17`; y se guarda **nuestra** fecha de fin de servicio,
  `fin_de_servicio = inicio(P) + un ciclo de la billing option anclada`. La copia de la fecha del
  próximo cobro (`next_payment_date`) **no entra** en el cálculo: sobre una fila con un cobro en
  reintento esa fecha ya corrió un ciclo sin pago. Ésta es la baja *«normal»* del invariante 22: la
  única de las cuatro con un período pagado que conservar.

Fuente: [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [TPZ:S11](#tpz-s11) · [DEC-SUB-009](../01-decisiones-vigentes.md#dec-sub-009) · [INV:22](../02-nucleo.md#inv-22)

<a id="ac-b8a-2"></a>
**AC:B8a:2** — el correo antes de cancelar, en las tres bajas que llaman al proveedor

- **Dado** una baja por `S11`, `S23` o `S24` cuyo preapproval sigue vivo
- **Cuando** se va a mandar la cancelación al proveedor
- **Entonces** **antes de la llamada sale nuestro correo**; si el correo falla de forma transitoria,
  la cancelación **no se ejecuta en esta corrida** y se reintenta; si no hay destinatario, se cancela
  igual y el no-entregable se escala. En `S11` la regla vale también para la llamada de cada
  complemento.

Fuente: [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [TRANS:B:S23](../04-catalogos.md#trans-b-s23) · [TRANS:B:S24](../04-catalogos.md#trans-b-s24) · [DEC-SUB-009](../01-decisiones-vigentes.md#dec-sub-009)

<a id="ac-b8a-3"></a>
**AC:B8a:3** — la rama de los complementos de `S11` (`R1-a`), sobre filas sembradas

- **Dado** una principal en `ACTIVE` con filas DE COMPLEMENTO sembradas (AS): una
  `VERTICAL_SUBSCRIPTION` que cuelga de ella y un `LISTING` sobre una ficha de su vertical, las dos
  en `ACTIVE` con su instancia viva; un `USER` compatible con esa vertical y con otra en la que queda
  una principal viva que no está `PAUSED`, `SUSPENDED` ni `CANCEL_SCHEDULED`; y una fila de
  complemento que no está en `ACTIVE`
- **Cuando** la persona pide la baja de la principal (`S11`)
- **Entonces** **en el mismo acto** se cancelan en el proveedor los preapprovals de la
  `VERTICAL_SUBSCRIPTION` y del `LISTING` —cada uno con el correo antes y la relectura de `S17`— y
  esas dos filas de complemento pasan a `CANCEL_SCHEDULED` **con el mismo `fin_de_servicio` de la
  principal**; la instancia **no cambia de estado** y el complemento **sigue dando servicio hasta esa
  fecha**; el `USER` **no entra** en la selección, porque le queda una principal viva fuera de la
  exclusión —y tampoco entraría con un ancla viva— (la selección es la de `S32`, con `CANCEL_SCHEDULED` en la exclusión, `V2-c`); y la fila
  de complemento que no estaba en `ACTIVE` **no entra**. Para un `USER`/`GLOBAL` que sí entra, la
  fecha es la más tardía entre las principales compatibles en `CANCEL_SCHEDULED`.

Fuente: [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [FILA:B8a](#fila-b8a) · [FILA:B8](#fila-b8) · [LISTA:B8a](#lista-b8a)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:161

<a id="ac-b8a-4"></a>
**AC:B8a:4** — la rama de la sucesora que vive del crédito (`R17`), sobre filas sembradas

- **Dado** una fila sembrada que vive del crédito de `DEC-SUB-006` —su fecha de primer cobro fue
  corrida al crearla, con la corrección de `B/12` §5.4 si la hubo—
- **Cuando** pide la baja desde `ACTIVE`
- **Entonces** `fin_de_servicio = max(fórmula, fin del crédito)`, donde el fin del crédito es esa
  fecha de primer cobro; **sin ningún `covered_period`**, el fin de servicio es el fin del crédito;
  **y sólo si tampoco tiene crédito** el fin de servicio es el instante de la baja, como en `S24`, y
  `S12` encuentra su fecha ya cumplida.

Fuente: [DEC-SUB-009#📌1](../01-decisiones-vigentes.md#dec-sub-009-p1) · [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [FILA:B8a](#fila-b8a)

<a id="ac-b8a-5"></a>
**AC:B8a:5** — `S12` por la fecha de fin, idempotente

- **Dado** una fila en `CANCEL_SCHEDULED` —puesta por `S11`, o por la regla de `S11` desde el espejo
  de `R18` o desde `S7`—
- **Cuando** llega su fecha de fin de servicio y el proceso corre, y corre una segunda vez
- **Entonces** la fila pasa a `CANCELLED` y se corta el servicio en la primera corrida; **la segunda
  corrida no hace nada**.

Fuente: [TRANS:B:S12](../04-catalogos.md#trans-b-s12) · [TPZ:S12](#tpz-s12) · [DEC-SUB-009](../01-decisiones-vigentes.md#dec-sub-009) · [INV:22](../02-nucleo.md#inv-22)

<a id="ac-b8a-6"></a>
**AC:B8a:6** — el orden de `S12` sobre las filas de complemento

- **Dado** una principal en `CANCEL_SCHEDULED` con un `LISTING` sembrado en `CANCEL_SCHEDULED` con la
  misma fecha y cuyo último cobro pagó días posteriores a esa fecha, y un `USER` en
  `CANCEL_SCHEDULED` con otra principal compatible viva
- **Cuando** llega la fecha de fin
- **Entonces** corre primero el `S12` de la principal; la orfandad corre `A5` → `S21` sobre sus
  complementos, que lleva el `LISTING` a `CANCELLED` y abre el motivo 14 con ese cobro; **recién
  después** corre `S12` sobre las filas de complemento que sigan en `CANCEL_SCHEDULED` —el `USER`—, y
  ese `S12` **apaga también su instancia** por `A5`, porque su preapproval ya está cancelado. Si el
  `LISTING` termina por su propio `S12`, sin marca, el orden está al revés.

Fuente: [TRANS:B:S12](../04-catalogos.md#trans-b-s12) · [TRANS:B:S11](../04-catalogos.md#trans-b-s11)

<a id="ac-b8a-7"></a>
**AC:B8a:7** — `S12` por un contracargo

- **Dado** una fila en `CANCEL_SCHEDULED` con un pago acreditado
- **Cuando** ese pago, **releído por id**, se lee `charged_back`
- **Entonces** la fila pasa a `CANCELLED` **ya, sin esperar su fecha de fin**; `S14` abre la marca con
  motivo `CONTRACARGO` con el pago colgado; y **al proveedor no se manda nada nuevo** —el preapproval
  ya lo canceló `S11`, y si esa cancelación no se confirmó la sigue el reintento del barrido—. Si la
  fila es predecesora de una sucesión en curso, la rama de `S31` es de
  [B8b](../20-fase-2/B8b.md#tpz-s31): al corte no hay sucesiones declaradas.

Fuente: [TRANS:B:S12](../04-catalogos.md#trans-b-s12)

<a id="ac-b8a-8"></a>
**AC:B8a:8** — la baja desde `SUSPENDED` (`S23`)

- **Dado** una suscripción en `SUSPENDED`
- **Cuando** la persona pide la baja, o un admin la ejecuta
- **Entonces** la fila pasa a `CANCELLED` con la fecha de fin de servicio en **el día de la
  cancelación** (no hay servicio ni cobertura que retirar); **si el preapproval sigue vivo se
  cancela**, con la relectura de `S17` y el correo antes; **sobre un pagador manual no se manda
  nada**; **se libera el candado `A`**, así que la persona puede dar un alta nueva; y el acto es
  **idempotente**.

Fuente: [TRANS:B:S23](../04-catalogos.md#trans-b-s23) · [TPZ:S23](#tpz-s23) · [LISTA:B8a](#lista-b8a) · [INV:22](../02-nucleo.md#inv-22)

<a id="ac-b8a-9"></a>
**AC:B8a:9** — la baja desde `GRACE_PERIOD` (`S24`) corta en el acto

- **Dado** una suscripción en `GRACE_PERIOD` (el cobro del período en curso falló)
- **Cuando** la persona pide la baja
- **Entonces** la fila pasa a `CANCELLED` **directo, sin pasar por `CANCEL_SCHEDULED`**, con la fecha
  de fin de servicio en **el día de la cancelación**; el preapproval **se cancela de inmediato** con
  la relectura de `S17` y el correo antes; sobre un pagador manual no se manda nada; y **el reloj del
  grace se apaga**: la fila no llega a `SUSPENDED` después, y el intento no cae en la regla 1 del
  núcleo. Es la única de las bajas directas que corta servicio de verdad siempre, porque
  `GRACE_PERIOD` sí emite fuente. Idempotente.

Fuente: [TRANS:B:S24](../04-catalogos.md#trans-b-s24) · [TPZ:S24](#tpz-s24) · [DEC-SUB-014](../01-decisiones-vigentes.md#dec-sub-014) · [LISTA:B8a](#lista-b8a)

<a id="ac-b8a-10"></a>
**AC:B8a:10** — un cobro anterior a la baja que se acredita después (`05` C2, primera fila)

- **Dado** una fila que `S11` dejó en `CANCEL_SCHEDULED`, principal o de complemento
- **Cuando** se acredita un cobro **anterior** a la cancelación
- **Entonces** escribe su `covered_period` y la fecha de fin pasa a
  `max(fin_de_servicio vigente, la fórmula recalculada)`: una extensión **nunca acorta**. Sobre la
  fila de complemento la extensión **no le da servicio más allá del fin de la principal**; lo que su
  cobro pagó después de esa fecha es el residuo que `S21` toma en el motivo 14.

Fuente: [LOCK:C2](../04-catalogos.md#lock-c2) · [TRANS:B:S11](../04-catalogos.md#trans-b-s11)

<a id="ac-b8a-11"></a>
**AC:B8a:11** — un cobro posterior a la baja (`05` C2, segunda fila), y las bajas directas

- **Dado** una fila dada de baja por `S11`, `S23` o `S24`
- **Cuando** entra un cobro **posterior** a la cancelación —en `S23` y `S24` cualquier cobro que
  entre, porque la fila fue directo a `CANCELLED` y no hay fecha que extender—
- **Entonces** se pone la marca `requiere_conciliación` con motivo `COBRO_POSTERIOR_A_LA_BAJA` y el
  cobro se cuelga de ella; **si ya hay una abierta con ese motivo sobre la fila, el cobro se cuelga
  de ésa y no se abre una segunda**; la devolución la confirma una persona y nada se reembolsa solo.
  Sobre una fila que venía de `GRACE_PERIOD`, la marca deja ver el pago, el monto y desde cuándo la
  fila estaba en grace.

Fuente: [LOCK:C2](../04-catalogos.md#lock-c2) · [TRANS:B:S23](../04-catalogos.md#trans-b-s23) · [TRANS:B:S24](../04-catalogos.md#trans-b-s24)

<a id="ac-b8a-12"></a>
**AC:B8a:12** — `CANCEL_SCHEDULED` → `ACTIVE` no existe

- **Dado** una fila en `CANCEL_SCHEDULED`
- **Cuando** algo intenta llevarla a `ACTIVE` —la persona se arrepiente—
- **Entonces** ninguna escritura la lleva ahí: arrepentirse es una sucesión, que entra por el
  candado `B` y no tiene ruta hasta `B8b`; el intento cae en la regla 1 del núcleo y abre la marca con
  motivo `TRANSICIÓN_NO_DECLARADA`, y la fila no cambia.

Fuente: [PROH:B:1](../04-catalogos.md#proh-b-1) · [MOT:6](../04-catalogos.md#mot-6)

<a id="ac-b8a-13"></a>
**AC:B8a:13** — `CANCELLED` no revive

- **Dado** una fila en `CANCELLED` (por `S12`, `S23` o `S24`)
- **Cuando** algo intenta llevarla a cualquier otro estado, o entra un cobro sobre ella
- **Entonces** la fila no cambia de estado: el intento de transición cae en la regla 1 del núcleo
  (motivo `TRANSICIÓN_NO_DECLARADA`) y el cobro va a la marca de `AC:B8a:11`.

Fuente: [PROH:B:2](../04-catalogos.md#proh-b-2) · [MOT:6](../04-catalogos.md#mot-6) · [LOCK:C2](../04-catalogos.md#lock-c2)

<a id="ac-b8a-14"></a>
**AC:B8a:14** — salida de la pieza (el *«Lista cuando»* de `B8a`, y la parte de `B8` que le toca)

- **Dado** `B8a` mergeada en la rama del paraguas, con `B3`, `B5` y `B7` ya adentro
- **Cuando** se corre su juego de pruebas sobre una base creada desde cero por las migraciones de la
  rama, con filas sembradas para lo que sólo existe después (AS)
- **Entonces** **darse de baja desde `ACTIVE` con un destaque recurrente cancela en el mismo acto los
  dos preapprovals, y el destaque se sigue viendo hasta el fin de servicio sin un cobro más**
  (`R1-a`); **darse de baja desde `GRACE_PERIOD` corta el servicio en el acto** (`S24`,
  `DEC-SUB-014`); **y desde `SUSPENDED` lleva la fila a `CANCELLED`** (`S23`). Las cláusulas de `B8`
  sobre la baja desde una pausa o una sucesora, y todas las demás de `B8`, se demuestran en
  [B8b](../20-fase-2/B8b.md#lista-b8b).

Fuente: [LISTA:B8a](#lista-b8a) · [LISTA:B8](#lista-b8) · [FILA:B8a](#fila-b8a) · [FILA:B8](#fila-b8) · [DEC-SUB-014](../01-decisiones-vigentes.md#dec-sub-014)

### Los criterios de terminación de origen

<a id="lista-b8"></a>

#### LISTA:B8 — el criterio de `B8`, en su forma vigente (partido: ver `B8a` y `B8b`)

El criterio de la unidad de origen (corte del MVP, owner 2026-10-01, Z):

1. **un cambio hacia una versión de `rank` MAYOR con un solo limit menor sigue el camino de
   DOWNGRADE** —si sigue el de upgrade, la dirección se está derivando del `rank` en vez de
   pedírsela a `direcciónDeCambio` (contrato §4.1), y el cliente pierde el aviso previo del
   excedente—;
2. un downgrade encima de otro **vuelve a preguntar** qué conservar;
3. un aumento cuya fecha cae sobre una pausada se aplica en el **primer cobro posterior a la
   reanudación** y nunca recortando los 60 días;
4. cancelar estando pausado corta el servicio **ese día**;
5. **una predecesora que se muere sola con la sucesora todavía esperando autorización cierra la
   sucesión en el acto, y un alta nueva sobre ese `user + vertical` la rechaza la base**;
6. **un upgrade no le saca nada al cliente**: los complementos terminan colgando de la sucesora, y
   **la cortesía vigente NO se re-apunta: se cierra con su saldo de meses y `S9` la re-emite sobre
   la sucesora cuando ésta autoriza** (`02` §2.6, `14` §4.4, `DEC-GRANT-007`) — **salvo la promo,
   que se pierde en todo cambio de plan** (`02` §2.6, `14` §2.2: FASE 8 completa, `R6`, pendiente
   7; y la vuelta del suspendido por sucesión la pierde también, que se acepta y se dice: owner
   2026-09-25, 3b);
7. **en `GRACE_PERIOD` el cambio de plan no se ofrece ni se puede declarar** —la pantalla dice cómo
   regularizar— (`DEC-SUB-021`);
8. **darse de baja desde `ACTIVE` con un destaque recurrente cancela en el mismo acto los dos
   preapprovals, y el destaque se sigue viendo hasta el fin de servicio sin un cobro más** (FASE 9
   vuelta 2, owner 2026-09-27, `R1-a`);
9. **una baja sobre una sucesora que vive del crédito deja el servicio hasta el fin del crédito**,
   nunca en el acto (FASE 9 vuelta 2, owner 2026-09-27, `R17`); **también si está pausada por una
   cortesía re-emitida: `S22` la lleva a `CANCEL_SCHEDULED` con fin en el fin del crédito, y si la
   lleva a `CANCELLED` en el acto está leyendo la pausa y no el crédito** (FASE 9 vuelta 2,
   verificación, owner 2026-09-27, `V2-b`).

La cláusula 8 es de `B8a`; las demás, de [B8b](../20-fase-2/B8b.md#lista-b8b).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1062

<a id="lista-b8a"></a>

#### LISTA:B8a — el *«Lista cuando»* de `B8a`

De las cláusulas de `B8`, la de la baja desde `ACTIVE`: **darse de baja desde `ACTIVE` con un
destaque recurrente cancela en el mismo acto los dos preapprovals, y el destaque se sigue viendo
hasta el fin de servicio sin un cobro más** (`R1-a`) —su mitad de complementos corre al corte sobre
el esquema vacío y se prueba con filas sembradas (corte del MVP, owner 2026-10-01, AS)—; las de la
baja desde una pausa o una sucesora quedan en `B8b` (corte del MVP, owner 2026-10-01, Z); **y darse
de baja desde `GRACE_PERIOD` corta el servicio en el acto (`S24`, `DEC-SUB-014`), y desde
`SUSPENDED` lleva la fila a `CANCELLED` (`S23`)** (corte del MVP, owner 2026-10-01, AR). *(Las dos
últimas cláusulas las derivó la fuente de las filas `S23` y `S24` de `03` §3.2, porque el criterio
de `B8` no las nombraba; la fuente lo marca.)*

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1063

## Reglas

Las reglas de esta pieza viven en los catálogos y se referencian, no se repiten:

- transiciones: [TRANS:B:S11](../04-catalogos.md#trans-b-s11),
  [TRANS:B:S12](../04-catalogos.md#trans-b-s12), [TRANS:B:S23](../04-catalogos.md#trans-b-s23),
  [TRANS:B:S24](../04-catalogos.md#trans-b-s24);
- transiciones que no existen: [PROH:B:1](../04-catalogos.md#proh-b-1),
  [PROH:B:2](../04-catalogos.md#proh-b-2);
- candado: [LOCK:C2](../04-catalogos.md#lock-c2) sobre `S11`, `S23` y `S24` (sobre `S22` es de
  [B8b](../20-fase-2/B8b.md#pieza-b8b));
- invariante: [INV:22](../02-nucleo.md#inv-22);
- decisiones: [DEC-SUB-009](../01-decisiones-vigentes.md#dec-sub-009) con su
  [📌1](../01-decisiones-vigentes.md#dec-sub-009-p1) (`R17`), y
  [DEC-SUB-014](../01-decisiones-vigentes.md#dec-sub-014). La de una pausa,
  [DEC-SUB-009#📌2](../01-decisiones-vigentes.md#dec-sub-009-p2), es de `B8b`.
- y las que esta pieza ejerce sin ser su dueña («también»): el correo antes de cancelar,
  [DEC-MAIL-001](../01-decisiones-vigentes.md#dec-mail-001); la baja como acción del catálogo,
  [ACC:8](../02-nucleo.md#acc-8); `S11` sobre los complementos,
  [DEC-ADDON-002#📌1](../01-decisiones-vigentes.md#dec-addon-002-p1),
  [DEC-ADDON-002#📌2](../01-decisiones-vigentes.md#dec-addon-002-p2) y
  [DEC-ADDON-004#📌1](../01-decisiones-vigentes.md#dec-addon-004-p1); el motivo
  [MOT:2](../04-catalogos.md#mot-2) que abre `C2`; y la partición del MVP,
  [DEC-ARCH-017#📌1](../01-decisiones-vigentes.md#dec-arch-017-p1) (AR, AS).

### Las transiciones de la Suscripción que construye esta pieza

<a id="tpz-s11"></a>
**TPZ:S11** — `S11` → `B8a`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:854

<a id="tpz-s12"></a>
**TPZ:S12** — `S12` → `B8a`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:855

<a id="tpz-s23"></a>
**TPZ:S23** — `S23` → `B8a` (AR).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:866

<a id="tpz-s24"></a>
**TPZ:S24** — `S24` → `B8a` (AR).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:867

## Modelo de datos y migraciones

**Sin migración propia.** Todo el esquema de las 25 unidades nace en las migraciones de la rama antes
del corte (AD), y lo que esta pieza escribe cuelga de tablas que crean otras piezas del corte: la
suscripción, su candado `A` y la marca, `B3`; las tablas del modelo del complemento, `B3` (AV);
`payment` y `covered_period`, `B5` ([DEC-ARCH-017#📌2](../01-decisiones-vigentes.md#dec-arch-017-p2)).
Las ramas que tocan lo que sólo se llena después —complementos y sucesoras con crédito— se
implementan enteras sobre el esquema vacío y se prueban con filas sembradas (AS,
[DEC-ARCH-017#📌1](../01-decisiones-vigentes.md#dec-arch-017-p1)). Carril: ninguno propio.

## API

La baja es un acto del catálogo administrativo ([ACC:8](../02-nucleo.md#acc-8), dueña `B5`) y una
operación self-service del dueño desde Mi Suscripción, cuya pantalla es de
[B13a](B13a.md#pieza-b13a). **Qué endpoints expone la API, uno por uno, la fuente no lo cierra**
(`B/19`, *«Lo que este capítulo NO cierra»*); lo que se fija acá es el comportamiento del acto. Tier:
el dueño, por `/api/v1/protected/*`; el admin (`S23`), por `/api/v1/admin/*`, según la arquitectura
de rutas del repo. Las rutas exactas y sus códigos de error los propone el PR de esta pieza siguiendo
lo escrito del repo, los aprueba la revisión de contexto fresco del momento 1 (y el owner en el PR
cuando es un permiso nuevo), y quedan escritos en esta sección al mergear
([BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)).

## UI web y admin, e i18n

N/A — la pantalla de la baja, la fila 8 y la 3-bis de la lista de lo que hay que decir y Mi
Suscripción son de [B13a](B13a.md#fila-b13a) (*«la baja self-service es criterio de `B13`»*,
[FILA:B8a](#fila-b8a)).

## Cron y outbox

- **El job que corre `S12` al llegar la fecha de fin de servicio**, idempotente, en el orden de
  [AC:B8a:6](#ac-b8a-6): primero las principales, después la orfandad, después los complementos que
  quedan.
- **El correo antes de cancelar** ([AC:B8a:2](#ac-b8a-2)) sale por el outbox común de `U2`; su
  falla transitoria frena la cancelación de esa corrida
  ([DEC-MAIL-001](../01-decisiones-vigentes.md#dec-mail-001)).

## Variables de entorno

N/A — ninguna fila ni transición de esta pieza declara una variable de entorno
([FILA:B8a](#fila-b8a)).

## Auditoría y observabilidad

- La baja ejecutada por un admin desde `SUSPENDED` es la acción del catálogo
  [ACC:8](../02-nucleo.md#acc-8), con su auditoría.
- Lo que esta pieza deja ante una persona son marcas: `COBRO_POSTERIOR_A_LA_BAJA`
  ([MOT:2](../04-catalogos.md#mot-2)), `CONTRACARGO` desde `S12`, y el motivo 14 que abre `S21` en el
  orden de `S12`; y `TRANSICIÓN_NO_DECLARADA` ([MOT:6](../04-catalogos.md#mot-6)) ante una transición
  que no existe.

## Seguridad

La baja la pide el dueño de la suscripción o la ejecuta un admin (`S23`); la autorización la resuelve
el capítulo 17 de verticales y la UI no la reemplaza (*«Autorización backend jamás depende de ocultar
UI»*, `B/19` §1). El acto administrativo lleva su permiso y su auditoría
([ACC:8](../02-nucleo.md#acc-8)).

## Testing esperado

| AC | tests | tipo |
|---|---|---|
| [AC:B8a:1](#ac-b8a-1) | [TEST:B8a:1](#test-b8a-1) | integración con DB |
| [AC:B8a:2](#ac-b8a-2) | [TEST:B8a:2](#test-b8a-2) | integración con DB |
| [AC:B8a:3](#ac-b8a-3) | [TEST:B8a:3](#test-b8a-3) | integración con DB |
| [AC:B8a:4](#ac-b8a-4) | [TEST:B8a:4](#test-b8a-4) | integración con DB |
| [AC:B8a:5](#ac-b8a-5) | [TEST:B8a:5](#test-b8a-5) | integración con DB |
| [AC:B8a:6](#ac-b8a-6) | [TEST:B8a:6](#test-b8a-6) | integración con DB |
| [AC:B8a:7](#ac-b8a-7) | [TEST:B8a:7](#test-b8a-7) | integración con DB |
| [AC:B8a:8](#ac-b8a-8) | [TEST:B8a:8](#test-b8a-8) | integración con DB |
| [AC:B8a:9](#ac-b8a-9) | [TEST:B8a:9](#test-b8a-9) | integración con DB |
| [AC:B8a:10](#ac-b8a-10) | [TEST:B8a:10](#test-b8a-10) | integración con DB |
| [AC:B8a:11](#ac-b8a-11) | [TEST:B8a:11](#test-b8a-11) | integración con DB |
| [AC:B8a:12](#ac-b8a-12) | [TEST:B8a:12](#test-b8a-12) | integración con DB |
| [AC:B8a:13](#ac-b8a-13) | [TEST:B8a:13](#test-b8a-13) | integración con DB |
| [AC:B8a:14](#ac-b8a-14) | [TEST:B8a:14](#test-b8a-14), [TEST:B8a:3](#test-b8a-3), [TEST:B8a:8](#test-b8a-8), [TEST:B8a:9](#test-b8a-9) | migración desde cero, integración con DB |

<a id="test-b8a-1"></a>
**TEST:B8a:1** — `S11` con la fórmula de los cobros acreditados

Tipo: integración con DB

Cubre: [AC:B8a:1](#ac-b8a-1)

Fuente: [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [INV:22](../02-nucleo.md#inv-22)

Una fila `ACTIVE` con un `covered_period` de un `payment` y otra con uno de un `manual_payment`, y una
tercera con un cobro en reintento cuya `next_payment_date` ya corrió un ciclo: las tres llegan a
`CANCEL_SCHEDULED` con `inicio(P) + un ciclo`, y el falso registra la cancelación del preapproval.

<a id="test-b8a-2"></a>
**TEST:B8a:2** — el correo antes de la llamada

Tipo: integración con DB

Cubre: [AC:B8a:2](#ac-b8a-2)

Fuente: [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [TRANS:B:S23](../04-catalogos.md#trans-b-s23) · [TRANS:B:S24](../04-catalogos.md#trans-b-s24)

Con el envío del correo fallando de forma transitoria, el falso no registra ninguna cancelación en
esa corrida y la siguiente la manda; sin destinatario, la cancelación sale y queda escalado el
no-entregable. Para `S11`, `S23` y `S24`.

<a id="test-b8a-3"></a>
**TEST:B8a:3** — la selección de complementos de `S11`, sembrada

Tipo: integración con DB

Cubre: [AC:B8a:3](#ac-b8a-3), [AC:B8a:14](#ac-b8a-14)

Fuente: [TRANS:B:S11](../04-catalogos.md#trans-b-s11) · [LISTA:B8a](#lista-b8a)

Con las filas sembradas del AC: dos cancelaciones de complemento en el falso además de la principal,
las dos filas en `CANCEL_SCHEDULED` con la fecha de la principal, la instancia sin cambio, el `USER`
intacto y la fila no `ACTIVE` intacta. Con la otra principal del `USER` en `CANCEL_SCHEDULED` y sin
ancla viva, el `USER` sí entra (`V2-c`); con un ancla viva, no entra.

<a id="test-b8a-4"></a>
**TEST:B8a:4** — la sucesora que vive del crédito, sembrada

Tipo: integración con DB

Cubre: [AC:B8a:4](#ac-b8a-4)

Fuente: [DEC-SUB-009#📌1](../01-decisiones-vigentes.md#dec-sub-009-p1)

Tres filas sembradas: con `covered_period` y crédito (gana el mayor), sin `covered_period` con crédito
(fin del crédito), y sin los dos (fin en el instante de la baja y `S12` la encuentra cumplida).

<a id="test-b8a-5"></a>
**TEST:B8a:5** — `S12` corre dos veces

Tipo: integración con DB

Cubre: [AC:B8a:5](#ac-b8a-5)

Fuente: [TRANS:B:S12](../04-catalogos.md#trans-b-s12) · [DEC-SUB-009](../01-decisiones-vigentes.md#dec-sub-009)

Con el reloj adelantado a la fecha de fin, la primera corrida deja `CANCELLED`; la segunda no
escribe nada.

<a id="test-b8a-6"></a>
**TEST:B8a:6** — el orden de `S12` con la orfandad

Tipo: integración con DB

Cubre: [AC:B8a:6](#ac-b8a-6)

Fuente: [TRANS:B:S12](../04-catalogos.md#trans-b-s12)

El `LISTING` sembrado termina `CANCELLED` por `S21` con la marca 14 abierta y su cobro colgado; el
`USER` termina `CANCELLED` por `S12` con su instancia apagada.

<a id="test-b8a-7"></a>
**TEST:B8a:7** — `S12` por un `charged_back` releído

Tipo: integración con DB

Cubre: [AC:B8a:7](#ac-b8a-7)

Fuente: [TRANS:B:S12](../04-catalogos.md#trans-b-s12)

Con el falso dando `charged_back` al releer el pago, la fila pasa a `CANCELLED` antes de su fecha, la
marca `CONTRACARGO` queda abierta con el pago, y el falso no registra ninguna llamada nueva.

<a id="test-b8a-8"></a>
**TEST:B8a:8** — `S23` por la persona y por un admin

Tipo: integración con DB

Cubre: [AC:B8a:8](#ac-b8a-8), [AC:B8a:14](#ac-b8a-14)

Fuente: [TRANS:B:S23](../04-catalogos.md#trans-b-s23)

Con tarjeta y preapproval vivo: cancelación en el falso y fecha de fin hoy; con pagador manual: cero
llamadas; en los dos, un alta nueva sobre el mismo `user + vertical` pasa el candado `A`; repetir el
acto no escribe nada.

<a id="test-b8a-9"></a>
**TEST:B8a:9** — `S24` corta en el acto y apaga el reloj del grace

Tipo: integración con DB

Cubre: [AC:B8a:9](#ac-b8a-9), [AC:B8a:14](#ac-b8a-14)

Fuente: [TRANS:B:S24](../04-catalogos.md#trans-b-s24) · [DEC-SUB-014](../01-decisiones-vigentes.md#dec-sub-014)

La fila va de `GRACE_PERIOD` a `CANCELLED` sin `CANCEL_SCHEDULED`, la fuente de cobertura deja de
emitirse ese día, y con el reloj adelantado más allá del grace la fila no pasa a `SUSPENDED` ni se
abre `TRANSICIÓN_NO_DECLARADA`.

<a id="test-b8a-10"></a>
**TEST:B8a:10** — `C2`, cobro anterior acreditado tarde

Tipo: integración con DB

Cubre: [AC:B8a:10](#ac-b8a-10)

Fuente: [LOCK:C2](../04-catalogos.md#lock-c2)

Un cobro con fecha anterior a la baja que se acredita después extiende la fecha con `max`; uno cuya
fórmula da una fecha menor no la acorta; sobre el complemento la extensión no lo deja emitir más allá
del fin de la principal.

<a id="test-b8a-11"></a>
**TEST:B8a:11** — `C2`, cobro posterior y las bajas directas

Tipo: integración con DB

Cubre: [AC:B8a:11](#ac-b8a-11)

Fuente: [LOCK:C2](../04-catalogos.md#lock-c2) · [MOT:2](../04-catalogos.md#mot-2)

Dos cobros posteriores sobre la misma fila cuelgan de una sola marca `COBRO_POSTERIOR_A_LA_BAJA`; lo
mismo tras `S23` y tras `S24`; ningún `refund` se crea solo.

<a id="test-b8a-12"></a>
**TEST:B8a:12** — prohibida: `CANCEL_SCHEDULED` → `ACTIVE`

Tipo: integración con DB

Cubre: [AC:B8a:12](#ac-b8a-12)

Fuente: [PROH:B:1](../04-catalogos.md#proh-b-1)

Un intento de escribir `ACTIVE` sobre una `CANCEL_SCHEDULED` deja la fila igual y abre
`TRANSICIÓN_NO_DECLARADA`.

<a id="test-b8a-13"></a>
**TEST:B8a:13** — prohibida: `CANCELLED` → cualquier cosa

Tipo: integración con DB

Cubre: [AC:B8a:13](#ac-b8a-13)

Fuente: [PROH:B:2](../04-catalogos.md#proh-b-2)

Para cada estado de destino, el intento sobre una `CANCELLED` deja la fila igual y abre
`TRANSICIÓN_NO_DECLARADA`; un cobro sobre ella no la reactiva.

<a id="test-b8a-14"></a>
**TEST:B8a:14** — la suite de la baja sobre una base desde cero

Tipo: migración desde cero

Cubre: [AC:B8a:14](#ac-b8a-14)

Fuente: [FILA:B8a](#fila-b8a) · [FILA:B8](#fila-b8) · [DEC-SUB-014](../01-decisiones-vigentes.md#dec-sub-014)

Sobre una base vacía migrada con las migraciones de la rama, las tablas que `B8a` escribe y las del
modelo del complemento existen sin ninguna migración de `B8a`, y la suite de esta pieza corre
completa sobre las filas sembradas.

## Smoke y etiquetas

N/A — las etiquetas `status-needs-smoke-*` van sólo en `HOS-1352`, nunca en las piezas, y la pieza
pasa a `Done` al mergearse en la rama del paraguas
([GATE:M1](../30-el-corte.md#gate-m1)). Lo manual de la baja vive en el checklist de smoke del
sistema nuevo, que escribe [B13a](B13a.md#pieza-b13a).

## Dependencias, rollback y despliegue

- **Espera a** `B7` (`B5 → B7 → B8a`, camino crítico del corte `U1 → B1 → B3 → B5 → B7 → B8a → B9a`),
  y por él a `B3` y `B5`.
- **La esperan** [B9a](B9a.md#pieza-b9a) (`B8a → B9a`), [B13a](B13a.md#pieza-b13a) (`B8a → B13a`) y
  su mitad posterior [B8b](../20-fase-2/B8b.md#pieza-b8b) (`B8a → B8b`).
- **Despliegue**: entra a la rama `epic/HOS-1352-verticales-billing` por su PR, con el momento 1
  cumplido ([GATE:M1](../30-el-corte.md#gate-m1)), y llega a producción con el corte.
- **Rollback**: la fuente no fija uno por pieza; antes del corte el PR se revierte en la rama, y
  pasado el paso 3 del corte sólo se arregla hacia adelante (`16-fase-7…` §4.3).

## Labels de Linear

La pieza es un issue de la épica de billing; pasa a `Done` al mergearse en la rama del paraguas, y
**no lleva etiquetas `status-needs-smoke-*`**, que van sólo en `HOS-1352`
([GATE:M1](../30-el-corte.md#gate-m1)).

- Las etiquetas son `kind-spec` más las `area-*` de la fila, y quedan escritas acá al mergear (owner
  [BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs), con sus defaults en
  [DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5); `16-fase-7-del-paraguas.md` §4.7,
  momento 1); el PR de la pieza propone las `area-*` siguiendo lo escrito del repo.

## Abiertos

- Ninguno propio: las rutas y los códigos de error los cerró BS (los propone el PR de esta pieza).

## Origen

`B/descomposicion.md` §2 (filas `B8` y `B8a`), §2.12 y §4 (filas `B8` y `B8a`); `D/16` §4.6;
`B/03` §3.2 (`S11`, `S12`, `S23`, `S24`) y §3.3; `B/05` C2; `NUCLEO/04` (invariante 22);
`01-decision-log.md` (`DEC-SUB-009`, `DEC-SUB-014`, `DEC-ARCH-017`);
`41-corte-del-mvp/10-decisiones-del-owner.md` (Z, AR, AS, AV, BS).
