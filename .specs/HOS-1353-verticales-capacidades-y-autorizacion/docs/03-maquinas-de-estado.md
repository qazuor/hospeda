---
title: Master Spec 03 — Las máquinas de estado
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 3
cierra:
  - M-SUB-01
  - M-CONC-02
---

# 03 · Las máquinas de estado

La mitad de verticales del capítulo 03 del programa: Trial, Publicación y Postulación de Partner. Las reglas de lectura comunes viven en el núcleo; Suscripción, Grace, Pausa, Pago, Pago manual, Addon y la regla de no-retroceso viven en la épica de billing.

---

## 2. Trial

**Alcance**: uno por `user + vertical`, de por vida (§10.1). No se reinicia por borrar la
ficha, crear otra, cancelar, volver, cambiar de plan ni registrarse de nuevo sobre la misma
identidad detectable (§10.2, `DEC-TRIAL-004`).

```text
                  T1 · evento de activación, y NO hay título
  PRE_TRIAL ───────────────────────────────────────────────────► TRIAL_ACTIVE
      │                                                            │      │
      │             T2 · aparece un título que convierte           │      │ T3 · llega
      │                    ┌───────────────────────────────────────┘      │ la fecha de fin
      │                    │                                              ▼
      │                    ▼        T5 · aparece un título que convierte
      └──────────► TRIAL_CONVERTED ◄──────────────────────────────── TRIAL_EXPIRED
       T6 · evento de activación,
            y SÍ hay un título que convierte
       T7 · la vertical enciende sus días de trial,
            y el evento de activación ya se ejerció
       T8 · aparece un título que convierte,
            y el evento de activación ya se ejerció
```

*(El diagrama decía ~~«T2 · aparece un título ajeno»~~ y ~~«T5 · aparece un título»~~ después de
que la tabla pasara a *«aparece un título que convierte»*, y ~~«T6 · … y SÍ hay título»~~ antes
de que `T6` exigiera uno que convierte; corregido con la tabla, y `T8` agregada — owner
2026-09-25; FASE 9 completa, `C-R12-5` y decisión 6c.)*

| # | desde | evento | hacia | condición | efectos |
|---|---|---|---|---|---|
| T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **falso** **y la vertical admite altas** (`vertical.admite_altas`, cap. 02 §2.1; FASE 8 completa, `F-8CC1-001`, owner 2026-09-25) **y la vertical tiene al menos una versión de plan vigente y vendible** —de ahí se deriva el plan de trial (cap. 10 §2)—: retirados todos los vendibles, no arranca ningún trial (owner 2026-09-27, FASE 9 vuelta 2, `R24`, `F-8V2A3-005`) **y no hay fila de `trial` con el mismo hash del correo normalizado en esa vertical** (cap. 02 §2.2; FASE 8 completa, `F-8CA3-003`) | **crea la fila de `trial`**; se asigna el plan de trial; arranca el reloj; se agenda la campaña previa del §10.7 |
| T2 | `TRIAL_ACTIVE` | ~~**aparece una fuente viva de clase `TÍTULO` que no es la del trial**~~ **aparece un título que convierte**: una fuente viva de clase `TÍTULO` que no es la del trial **y que, si es de `tipo: SUSCRIPCIÓN`, trae `cobrada: sí`** —sea porque aparece así o porque una ya presente pasa a `sí` con su primer pago acreditado— (`12-contrato…` §2.1; `DEC-TRIAL-010`, owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`) | `TRIAL_CONVERTED` | — | se cancela la campaña previa; el acceso pasa a depender de esa fuente |
| T3 | `TRIAL_ACTIVE` | llega la fecha de fin | `TRIAL_EXPIRED` | **—** | ~~arranca la campaña de recuperación~~ arranca la campaña de recuperación **si la vertical admite altas** (`NUCLEO/07` §6; FASE 9 vuelta 1, `F-8V1A2-006`) ~~y el reloj de retención~~; **la publicación la mueve `PB2`**, por el cambio de `cubierto` (§9), **y el reloj de retención tampoco es suyo: lo arranca el hecho 5 por el mismo cambio de `cubierto`**, que escriben `PB2` y el recálculo (cap. 02 §2.5). `T3` no escribe `listing.inactiva_desde` (FASE 9 vuelta 2, `F-8V2A2-007`) |
| T4 | `TRIAL_ACTIVE` | promo de extensión o cortesía | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) **y con la fecha de fin sin pasar**: si ya pasó y `T3` todavía no corrió, el canje contesta `RECHAZADA` y la cortesía no corre. El §32 dice *«nunca después»*, y el estado solo no lo sabe: con el job de `T3` atrasado, un canje revivía un trial cuya fuente el contrato ya había dejado de emitir (FASE 9 vuelta 2, `F-8V2A2-003`) | corre la fecha de fin; **re-agenda** la campaña previa. **La promo llega por `extenderTrial`** (`12-contrato…` §4.1), la única escritura de billing en verticales: corre dentro del lock de esta máquina, con el techo de `11` §3, y contesta `ACEPTADA` o `RECHAZADA` (owner 2026-09-26, `G4-2`). **La cortesía NO llega por `extenderTrial`**: es la acción administrativa *«extender un trial»* de `NUCLEO/08` §3, de esta épica y fuera del contrato —**origen `SUPER_ADMIN` y motivo obligatorio**, **pasa el techo** de `11` §3.4 y suma al total acumulado con su origen (`11` §3.5), en el mismo lock—; billing no interviene (owner 2026-09-26, P2; FASE 9 vuelta 1) |
| T5 | `TRIAL_EXPIRED` | ~~**aparece una fuente viva de clase `TÍTULO`**~~ **aparece un título que convierte**, en el mismo sentido que `T2` (`DEC-TRIAL-010`; abajo, *«`T5` espera el cobro igual que `T2`»*) | `TRIAL_CONVERTED` | — | corta la campaña de recuperación; **la publicación la restituye `PB3`**, por el cambio de `cubierto` (§9) |
| T6 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_CONVERTED` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **verdadero** **por un título que convierte** —en el mismo sentido que `T2`: si el único título es una `SUSCRIPCIÓN` con `cobrada: no`, `T6` no dispara (owner 2026-09-25; FASE 9 completa, decisión 6c, `R12-OWNER-1`)— **y no hay fila de `trial` con el mismo hash del correo normalizado en esa vertical** (cap. 02 §2.2; FASE 8 completa, `F-8CA3-003`) | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |
| T7 | `PRE_TRIAL` | **el encendido: la vertical pasa los días de trial de su plan de trial de 0 a > 0** | `TRIAL_CONVERTED` | la persona **ya ejerció el hecho que la vertical declara como evento de activación**, en cualquier momento anterior al encendido — **`cubierto` no participa** — **y no hay fila de `trial` con el mismo hash del correo normalizado en esa vertical** (`F-8CA3-003`) | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |
| **T8** | `PRE_TRIAL` | **aparece un título que convierte**, en el mismo sentido que `T2` —y en particular, **una `SUSCRIPCIÓN` presente pasa a `cobrada: sí` con su primer pago acreditado**— | `TRIAL_CONVERTED` | la persona **ya ejerció el evento de activación** en esa vertical —el mismo hecho y el mismo registro que lee `T7`— **o le volvió una ficha por `PB3` o `PB7` bajo un título que paga**, y eso cuenta como ejercicio del evento para esta guarda y sólo para ella (abajo, *«la vuelta bajo un título que paga»*; owner 2026-09-27, FASE 9 vuelta 2, `R15`) **y** la vertical declara evento y su plan de trial tiene días de trial > 0 **y no hay fila de `trial` con el mismo hash del correo normalizado en esa vertical** —las guardas de catálogo y de hash de `T6`— | **crea la fila de `trial`, consumida**, sin reloj y sin campaña — igual que `T6` y `T7`, con otro disparador (owner 2026-09-25; FASE 9 completa, decisión 6c, `R12-OWNER-1`) |

**Qué contesta el contrato de cobertura en cada estado.** El trial es **fuente viva en
`PRE_TRIAL` y en `TRIAL_ACTIVE`, y en ningún otro estado**; lo que cambia entre los dos no es *si
hay título* sino **a qué versión de plan apunta**:

| estado | ¿fuente viva? | `referencia` | `hasta` |
|---|---|---|---|
| `PRE_TRIAL` | **sí** | la versión de **pre-trial** de la vertical | `SIN_EMPEZAR` |
| `TRIAL_ACTIVE` | **sí** | la versión del **plan de trial** | la fecha de fin |
| `TRIAL_CONVERTED` | no | — (el título pasó a ser la fuente que lo convirtió: una suscripción, una cortesía o un grant) | — |
| `TRIAL_EXPIRED` | no | — | — |

**Las dos filas de abajo son lo que sostiene `PB2`**: si `TRIAL_EXPIRED` siguiera cubriendo, `PB2`
no dispararía nunca y el criterio que `12-contrato-de-cobertura.md` §5.1 le pone a la
implementación de arranque —*«los dos caminos se ejercen completos, porque un trial vence de
verdad»*— quedaría sin objeto.

**Y desde la fecha de fin de servicio de su vertical, `TRIAL_ACTIVE` tampoco es fuente viva**,
aunque la máquina siga en ese estado hasta `T3`: el contrato no emite ahí ninguna fuente de título
(`12-contrato…` §2.6, *«una vertical discontinuada no cubre a nadie»*; FASE 8 completa,
`F-8CC1-001`, owner 2026-09-25). Por la letra de esa regla, `PRE_TRIAL` tampoco: quien estaba ahí
resuelve contra la versión de piso. **La fecha la lee por la pregunta `finDeServicio` del
contrato §4.1**, que contesta billing: ~~era una columna de `vertical`~~ dejó de ser una columna
de esta épica (owner 2026-09-27, FASE 9 vuelta 2, `R5`).

**Y la fila de arriba no abre la puerta inversa, porque no hay puerta**: nadie entra a
`PRE_TRIAL`, se empieza ahí, y ninguna transición vuelve. Una cobertura que sólo existe en el
estado inicial **no puede recuperarse** por esta vía, así que no desarma ningún disparador de
pérdida. Quien ya gastó su trial tiene su respuesta al paso 5 por otro lado —el título `BASE`
(`12-contrato…` §2.5)—, que no cubre y sólo le deja volver a contratar.

**Y `PRE_TRIAL` no es un `tipo` nuevo del contrato**: la fuente sigue siendo `tipo: TRIAL`.

### La máquina de trial habla el vocabulario del contrato, y no el de la suscripción

Es la regla que decide las cuatro filas de arriba que cambiaron, y conviene leerla antes que
ellas porque las explica a las cuatro de una vez.

> **Ninguna condición ni ningún evento de esta máquina nombra un estado de la suscripción.**
> Lo que nombran es lo que el contrato de cobertura entrega: **`cubierto`** y **las fuentes vivas
> con su clase** (`12-contrato…` §2.1 y §2.4).

**No es una preferencia de redacción: es lo único ejecutable.** El §4 del contrato declara que
*«el estado exacto de la suscripción no cruza»*, así que una condición escrita sobre estados de
suscripción **no la puede evaluar el lado que tiene que evaluarla**. `T2`, `T3` y `T6` estaban
escritas así —*«se autoriza una suscripción»*, *«no hay suscripción autorizada»*, *«ya hay una
suscripción viva»*— y las tres producían el mismo defecto por caminos distintos: el que las
implementara iba a leer `cubierto`, que es **otro conjunto**, sin que ninguna línea lo dijera.
~~Los dos sentidos de *«vivo»*~~ **Dos de los cuatro sentidos de *«vivo»* —fila viva y fuente
viva—** y por qué no son intercambiables están en el cap. 01 (núcleo) §2.4 (FASE 9 completa, `C-14`).

**Y es el mismo mecanismo que el §9 ya eligió para `PB2` y `PB3`**: atarse al hecho que el
contrato emite —*«la cobertura de (`user`, vertical) cambió»* (`12-contrato…` §3)— en vez de a una
lista de transiciones de la otra épica, mantenida a mano. No agrega un mecanismo: usa el que
estaba, en la segunda máquina que lo necesitaba.

**Qué gana cada fila, en una línea:**

| fila | decía | dice | qué se cierra |
|---|---|---|---|
| `T1` | sin condición sobre el sujeto | `cubierto` **falso** | ya no dispara sobre quien tiene un título, que era la rama que dejaba una fuente `TÍTULO` perpetua |
| `T2` | *«se autoriza una suscripción»* | aparece un título que no es el trial **y, si es suscripción, ya cobró** (`DEC-TRIAL-010`; FASE 9 completa, `C-R12-5`) | ahora alcanza también a quien **recupera** (`S7`), **reanuda** (`S10`) o recibe una cortesía o un grant durante el trial |
| `T3` | *«no hay suscripción autorizada»* | sin condición | `TRIAL_ACTIVE` **siempre** tiene salida: el reloj vence y punto |
| `T6` | *«ya hay una suscripción viva»* | `cubierto` **verdadero** **por un título que convierte** (FASE 9 completa, 6c) | deja de quemar el trial de quien no está cubierto por nada — **y, desde 6c, el de quien está cubierto sólo por una suscripción que todavía no cobró**: lo consume `T8` al primer pago |

### El trial se convierte con el primer pago acreditado, no con la autorización

(`DEC-TRIAL-010`, owner 2026-09-25; FASE 8 completa, racimo `R12`: `F-8CA2-006`, `F-8CC1-002`.)

**El defecto.** `T2` convertía en cuanto aparecía un título, y una suscripción emite desde `ACTIVE`
(`12-contrato…` §2.6), **antes de cualquier cobro**. El primero llega entre 26 y 44 minutos después
de autorizar (`PA-3`, `B/12` §4.3); si se rechazaba, `S16` llevaba la fila a `CHARGE_DECLINED` y la
persona quedaba **sin suscripción y sin trial**, que ya no se devuelve (§10.2). Una tarjeta
rechazada le costaba el trial entero.

> **Una fuente `SUSCRIPCIÓN` convierte el trial sólo si trae `cobrada: sí`** (`12-contrato…` §2.1).
> Mientras tanto el trial **sigue corriendo**; si el primer cobro se rechaza, la persona **sigue en
> `TRIAL_ACTIVE` con los días que le quedaban**.

Es la regla de `B/12` §4.4 llevada al trial: *«un primer cobro rechazado no es una suscripción con
un problema, es un alta que no ocurrió»*, y un alta que no ocurrió no consume el trial. **Las otras
tres fuentes de clase `TÍTULO` —cortesía, grant y la suscripción que ya cobró— convierten como
antes**: no tienen un primer cobro que esperar. ~~Quien **recupera** (`S7`) o **reanuda** (`S10`)
ya pagó alguna vez sobre esa fila, así que su fuente llega con `cobrada: sí`.~~ **Quien recupera
(`S7`) ya pagó sobre esa fila; quien reanuda (`S10`) casi siempre también, y si pausó antes del
primer cobro —`puedePausar()` no mira pagos (`NUCLEO/01` §3)— su fuente vuelve con `cobrada: no` y
convierte al primer pago, como un alta** (FASE 9 completa, `C-R12-3`).

**No rompe `G-R4-B`**: `cobrada` es un campo del contrato, no un estado de la suscripción, y la
máquina sigue hablando sólo el vocabulario del contrato (arriba). **Y el cobro no se difiere al fin
del trial** para no tener que esperar: una fecha futura se convierte sola en un *free trial* del
proveedor (`EX-38`), que es lo que `HOS-1012` eliminó (`DEC-TRIAL-010`).

#### `T5` espera el cobro igual que `T2`, aunque ahí no haya días que proteger

La razón de `DEC-TRIAL-010` —no quemar los días que quedaban— no alcanza a `T5`: en
`TRIAL_EXPIRED` no queda ningún día. **La cambia igual, por dos razones que salen de la fila:**

1. **Sin el cambio, `T5` no dispararía nunca sobre quien se suscribió al final del trial.** Si la
   suscripción aparece en `TRIAL_ACTIVE` con `cobrada: no`, `T2` no convierte; si `T3` vence el
   trial antes del primer cobro, el título **ya había aparecido**, y un `T5` que espera *«aparece
   un título»* no ve ningún evento: la persona quedaba en `TRIAL_EXPIRED` pagando, con la campaña
   de recuperación de `T3` corriendo. Con `cobrada` en el evento, el primer pago la convierte.
2. **Sobre un alta que no ocurrió, `T5` cortaba la campaña de recuperación** —su efecto— y dejaba
   a la persona en `TRIAL_CONVERTED` sin título: justamente a quien intentó volver y no pudo.

#### Los 26–44 minutos: dos títulos a la vez, y el pliegue los suma

Mientras el primer cobro no llega, la persona tiene **dos fuentes de clase `TÍTULO`**: la del
trial, que apunta al plan de trial —derivado del plan vendible de `rank` más alto (cap. 02 §2.1)—,
y la de su suscripción `ACTIVE`. **`cubierto` es verdadero por las dos y ninguna se descarta**: el
pliegue del cap. 15 §2.6 no distingue un título de otro, así que las claves `SUMA` suman los dos
cupos y las de «no acumula» toman el más favorable. Es exactamente el caso que la viñeta de `T6`
(abajo) describe como defecto —*«paga el básico y opera con las capacidades del premium»*—,
abierto ahora por la ventana del primer cobro. El pliegue **no duplica** nada que no sumara ya con
dos títulos cualesquiera; lo que cambia es que ahora la ventana existe.

> ⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`** (cap. 15 §2.6 lo repite donde se
> pliega):
>
> 1. **Durante la ventana la persona tiene el cupo de los dos títulos sumado.** Si publica por
>    encima del cupo que le va a quedar, al convertir (`T2`) o al rechazarse el cobro (`S16`) el
>    conjunto efectivo baja y **el reconciliador de excedentes** despublica lo que sobra (cap. 15
>    §4.3). Dura lo que tarde el primer cobro: los minutos de `PA-3` en un alta.
> 2. **La ventana es más larga sobre una sucesora con tarjeta**: su primer cobro nace después del
>    vencimiento de su ventana de autorización (`D8`, `B/12` §4.3), hasta 72 h, y mientras tanto
>    trae `cobrada: no`. Alcanza a quien, estando en `TRIAL_ACTIVE`, cambia de plan antes de que un
>    pago acreditado lo convierta.
> 3. **Una `CANCEL_SCHEDULED` que se dio de baja antes del primer cobro no convierte nunca**: ~~trae
>    `cobrada: no` hasta que `S12` la termina, y el trial sigue su reloj. Es lo que `DEC-TRIAL-010`
>    pide —no hubo alta—, y se declara porque la fuente cubre mientras tanto.~~ **su fin de servicio
>    es el instante de la baja** (`B/03` §3.2, `S11`: una fila sin `covered_period` termina en el
>    acto), así que no cubre y el trial sigue su reloj. Si un primer cobro en vuelo se acredita
>    después (`B/05` §3, `C2`), la fila pasa a `cobrada: sí` y `T2` convierte (FASE 9 completa,
>    `C-R12-4`).
> 4. **Si se pierde el aviso del primer pago** (`12-contrato…` §3), `T2` no dispara, el trial sigue
>    hasta `T3` y la persona termina en `TRIAL_EXPIRED` con su suscripción; la red diaria no corre
>    esta máquina (§9, ⚠️ punto 3); si la persona estaba en `PRE_TRIAL`, `T8` tampoco dispara (§9,
>    ⚠️ punto 3; FASE 9 vuelta 1, `F-8V1C1-010`).
> 5. **Una cortesía sobre una fila que todavía no cobró convierte igual** (FASE 9 completa,
>    `R12-BORDE-2`; declarado por `DEC-METH-015`, FASE 9 completa). El tercer disparador de `S9`
>    (`B/03` §3.2) pausa por cortesía una fila recién autorizada. La `PAUSED · COURTESY` emite
>    `CORTESÍA`, que convierte sin esperar cobro, así que `T2` dispara. Si al volver (`S10`) el
>    primer cobro se rechaza, `S16` deja a la persona sin suscripción y con el trial consumido por
>    esa cortesía. **Causa**: `DEC-TRIAL-010` condiciona sólo la fuente `SUSCRIPCIÓN`. Recibió los
>    meses de cortesía, así que no perdió servicio.

#### `T6` espera el cobro, y `T8` lo consume

(Owner 2026-09-25; FASE 9 completa, decisión 6c, `R12-OWNER-1`.)

**El defecto.** `T6` pedía `cubierto` verdadero, y una `SUSCRIPCIÓN` con `cobrada: no` **es** de
clase `TÍTULO` y cuenta para `cubierto` (`12-contrato…` §2.1). Quien se suscribía **antes de
publicar** —el orden normal de quien entra pagando— y publicaba en la ventana de su primer cobro
disparaba `T6`: la fila de `trial` nacía consumida, el cobro se rechazaba (`S16`) y la persona
quedaba sin suscripción **y sin trial**, que es lo que `DEC-TRIAL-010` vino a impedir por la otra
puerta de la máquina.

> **`T6` exige un título que convierte, igual que `T2`. Si el único título es una suscripción que
> todavía no cobró, no dispara ninguna del par: `PB1` publica igual, porque el dueño está
> cubierto, y la persona sigue en `PRE_TRIAL`. `T8` consume la fila cuando ese título pasa a
> convertir —el primer pago acreditado— si la persona ya ejerció el evento de activación.**

- **Si el cobro sale bien**, `T8` escribe la fila consumida: el mismo desenlace que `T6` le daba,
  un pago después. El registro del evento de activación es el que `T7` ya lee (abajo), así que
  no pide ningún hecho nuevo.
- **Si el cobro se rechaza**, `S16` lleva la fila a `CHARGE_DECLINED`, `PB2` baja la ficha y la
  persona queda en `PRE_TRIAL`: su próximo `PB1`, sin cobertura, arranca el trial por `T1`
  —también sobre la ficha que `PB2` bajó, porque `PB1` sale de `UNPUBLISHED_BY_BILLING` cuando
  arranca un trial (§9; FASE 9 vuelta 1, R1)—.
- **La superficie empuja al orden que no necesita `T8`** (decisión del owner, 6c): el botón de
  suscribirse de una vertical **en la que la persona todavía no publicó la manda a publicar**
  **si publicar le arrancaría el trial** (la regla, escrita sólo en `V/19` §4 fila 23; FASE 9
  vuelta 1, `F-8V1D1-004`) —y
  eso arranca el trial— en vez de al checkout (`V/19` §4, fila 23; `B/19`). **`T8` queda como red**
  para quien llega al checkout por otro camino.

**No agrega ningún par a `G-R4`.** `T8` sale de `PRE_TRIAL`, que comparte con `T1`, `T6` y `T7`,
pero su evento —*«aparece un título que convierte»*— no lo declara ninguna otra fila de ese
`desde`; `T2` declara el mismo evento desde `TRIAL_ACTIVE`, que es otro par. **Y el par
`T1`/`T6` sigue disjunto por `cubierto`**, pero deja de cubrir toda la mitad de catálogo: con
`cubierto` verdadero sólo por una suscripción que no cobró, **no dispara ninguna de las dos**, que
es el efecto buscado. **No rompe `G-R4-B`**: *«un título que convierte»* es vocabulario del
contrato (`cubierto`, `fuentes` y `cobrada`), no un estado de la suscripción.

#### La vuelta bajo un título que paga cuenta para `T8`, y el lock de la máquina de trial

(Owner 2026-09-27, FASE 9 vuelta 2, `R15`; `F-8V2A2-001`, `F-8V2A2-002`.)

**El defecto.** `T6` y `T8` son las dos filas que consumen el trial de quien ya es cliente, y las
dos cuelgan del evento de activación. El dueño del corte que contrata por teléfono nunca hace un
`PB1`: sus fichas vuelven solas por `PB3` (`V/21` §2.4), y restituir no es publicar (§9). Quedaba
pagando en `PRE_TRIAL` sin fila, y el día que cancelaba y publicaba sin cobertura `T1` le daba un
trial entero: la puerta que `T6` existe para cerrar.

> **Una ficha que vuelve por `PB3` o `PB7` bajo un título que paga cuenta como ejercicio del evento
> de activación para la guarda de `T8`, y sólo para ella.** Un título que paga es una fuente de
> `tipo: SUSCRIPCIÓN`, haya cobrado o no: cuando `PB3` sube la ficha del corte, la suscripción
> todavía no cobró, y `T8` lee esa vuelta cuando se acredita el primer cobro. `PB3` y `PB7` ya leen
> las fuentes dentro del lock, y su registro guarda si una `SUSCRIPCIÓN` cubría esa vuelta.

**No cambia qué es publicar para `T1`.** Restituir sigue sin ser el evento de activación: `PB3` y
`PB7` no arrancan ni consumen ningún trial por sí solas, `T1` sigue mirando `PB1`, y el botón de
`V/19` §4 fila 23 sigue leyendo el evento. Lo único que cambia es que quien paga y recupera sus
fichas sin publicar no se guarda el trial para el día que cancele.

> **El lock de la máquina de trial es el mismo lock por `user + vertical` que toma la publicación**
> (§9, *«publicar ocupa cupo bajo un lock»*), **y lo toman todas las transiciones de esta tabla.**
> `T1` y `T6` ya lo tienen, porque se evalúan dentro de `PB1`. `T2`, `T5` y `T8` lo toman al
> despertar con el aviso. `T3` lo toma el job del vencimiento. `T4` lo toman `extenderTrial` y la
> acción administrativa. `T7` lo toma persona por persona el día del encendido. Adentro, cada una
> relee lo que su guarda lee: `cobrada`, el registro del evento y la fecha de fin.

**Coincide con el de publicación porque sus guardas leen lo que escribe la otra.** `T6` lee
`cobrada` dentro de `PB1`, y `T8` lee el registro que `PB1` escribe. Con dos locks, si el primer
cobro se acreditaba mientras `PB1` estaba en vuelo, cada una veía el estado viejo de la otra y
ninguna escribía la fila. Como el evento de `T8` ocurre una sola vez, nadie la escribía después.
Con uno solo pasan en orden. Si entra primero `PB1`, `T8` relee y ve el evento. Si entra primero
`T8`, no lo ve y no dispara, y `PB1` lee después `cobrada: sí`, porque el aviso sale después del
commit de billing (`12-contrato…` §3), así que dispara `T6`. **Siempre escribe una de las dos.** Y
es el lock que el contrato nombra cuando dice que `T3` y el canje no se pisan (`12-contrato…`
§4.1). La carrera entre dos personas con el mismo correo no la ordena este lock, sino el `UNIQUE`
del hash (abajo).

### `T1` y `T6` comparten el par, y sus guardas son complementarias

`T1` y `T6` comparten `desde` y `evento`, y es **el único par `(desde, evento)` con dos destinos
distintos de esta épica**, y uno de los ~~**tres** que el diseño declara hoy — los otros dos son
`S5`/`S19` y `S7`/`S19`~~ **cuatro** que el diseño declara hoy — los otros tres son `S5`/`S19`,
`S7`/`S19` y `S10`/`S25` (FASE 9 completa, `C-12`), en la tabla de suscripción de la épica de billing, separados también por
un booleano (`B/03` §3.2; la lista está en el cap. 03 (núcleo) §1 regla 7). Lo cuenta `G-R4` sobre
las ~~nueve~~ **diez** tablas (la décima, la del reembolso: FASE 9 completa, 5a), no una lectura a mano. La regla 7 del cap. 03 (núcleo) exige que sus guardas sean
disjuntas, y acá lo son **por construcción y no por acuerdo**: ~~las dos piden la misma mitad de
catálogo —la vertical declara evento y su plan de trial tiene días > 0— y difieren en el valor de
**un booleano**, `cubierto`.~~ las dos piden la mitad de catálogo —la vertical declara evento y su
plan de trial tiene días > 0—, `T1` le suma que la vertical admita altas (abajo; FASE 8 completa,
`F-8CC1-001`, owner 2026-09-25), y **lo que las separa es un booleano**, `cubierto`. No hay una regla de precedencia que alguien pueda olvidar leer,
porque no hace falta ninguna.

~~**Las tres consecuencias del par, recorridas**~~ **Las consecuencias del par, recorridas** (FASE 9 vuelta 1, `F-8V1A2-010`: las filas se nombran por su contenido, no por su ordinal) — la mitad de catálogo × los dos valores de
`cubierto`:

| catálogo | `cubierto` | qué pasa |
|---|---|---|
| declara evento y días > 0 | **falso** | `T1`: arranca el trial |
| declara evento y días > 0 | **verdadero** | `T6`: la fila nace consumida, y el título es la fuente que ya tiene |
| declara evento y días > 0 | **verdadero, pero sólo por una `SUSCRIPCIÓN` con `cobrada: no`** | **ninguna de las dos**: `T6` exige un título que convierte. `PB1` publica igual —el dueño está cubierto— y la fila la escribe **`T8`** al primer pago acreditado; si ese cobro se rechaza, la persona sigue en `PRE_TRIAL` (FASE 9 completa, decisión 6c) |
| no declara evento, **o** días = 0 | cualquiera | **ninguna de las dos dispara en ese momento**, y la persona se queda en `PRE_TRIAL` — **hasta el encendido, que es lo que resuelve `T7`** |
| declara evento y días > 0, **pero la vertical no admite altas** | **falso** | **ninguna de las dos**: `T1` exige `admite_altas` y `T6` exige `cubierto`. La persona se queda en `PRE_TRIAL` (FASE 8 completa, `F-8CC1-001`, owner 2026-09-25) **y no publica**: `PB1` exige cobertura o un `T1` que dispare (§9; owner 2026-09-25) |
| declara evento y días > 0, **pero la vertical no tiene ninguna versión de plan vigente y vendible** ✚ | **falso** | **ninguna de las dos**: `T1` exige una versión vigente y vendible y `T6` exige `cubierto`. La persona se queda en `PRE_TRIAL` **y no publica**, y la pantalla le dice que **la vertical no tiene planes disponibles**, sin ofrecerle suscribirse (cap. 19 §4 fila 29). La vertical **no** queda cerrada a altas: retirar todos los vendibles no escribe `admite_altas`, y cerrarla es discontinuarla (`B/10` §4.1; owner 2026-09-27, FASE 9 vuelta 2, `R24`) |
| declara evento y días > 0, **pero ya hay una fila de `trial` con el hash de su correo en esa vertical** | cualquiera | **ninguna de las dos**, y tampoco `T7` ni `T8`: ~~las tres~~ las cuatro exigen que el hash no tenga fila. La persona se queda en `PRE_TRIAL` y **la publicación sigue** ~~(FASE 8 completa, `F-8CA3-003`; abajo)~~ **sólo si está cubierta**: sin cobertura `PB1` no publica, porque no arranca ningún trial (FASE 8 completa, `F-8CA3-003`; condición de `PB1`, owner 2026-09-25; abajo) |

~~**La tercera fila es nueva y es deliberada.**~~ **La fila de *«no declara evento, o días = 0»* es nueva y es deliberada.** `T6` no repetía la mitad de catálogo, así que en una
vertical que declarara evento con los días en cero le escribía a un cliente la fila consumida de
un trial **que la vertical todavía no ofrece** — y el día que lo encendiera, esa persona ya no lo
tenía. `DEC-TRIAL-003` contempla exactamente ese día para Partner. Consumir un beneficio que no
existe no es consumirlo: es destruirlo antes de que nazca.

**`T1` exige que la vertical admita altas, y `T6` y `T7` no** —ni `T8`, por la misma razón (FASE
9 completa, 6c)— (FASE 8 completa, `F-8CC1-001`,
owner 2026-09-25). El owner lo decidió para `T1` —si la vertical no admite altas, no arranca
ningún trial— y dejó `T6`/`T7` para «si corresponde», y **no corresponde**, por lo que esas dos filas
hacen: **ninguna arranca un trial**, las dos escriben la fila **consumida**, sin reloj y sin
campaña. Exigirles `admite_altas` dejaría sin consumir el trial de quien ya ejerció el evento de
activación, y es la puerta del §10.2 —*«un trial gratis para quien ya fue cliente»*— que `T6` y
`T7` existen para cerrar.

**El par sigue disjunto por construcción**, y por el mismo booleano: `T1` pide `cubierto` falso y
`T6` verdadero. Lo que deja de ser verdad es que las dos cubran todos los casos de la mitad de
catálogo: con la vertical cerrada a altas y `cubierto` falso **no dispara ninguna**, que es la
~~cuarta fila de la tabla de arriba~~ fila de *«la vertical no admite altas»* de la tabla de arriba y el efecto buscado. Hasta esta pasada `T1` no miraba la
situación de la vertical, y el día 0 de una discontinuación —*«la vertical deja de admitir altas y
trials»* (`B/10` §4.3)— seguía arrancando trials (`F-8CC1-001`).

> ~~⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`**: **quien publica en una vertical
> cerrada a altas sin estar cubierto queda publicado hasta un día.** La versión de pre-trial
> sigue llevando la capacidad de activación —cap. 02 §2.1 la ata a *«declara evento y días > 0»*,
> no a `admite_altas`—, así que `PB1` publica, `T1` no dispara y `cubierto` sigue falso: una ficha
> publicada sin cobertura. **La baja el reconciliador diario de cobertura** al día siguiente, por
> la primera rama de `PB2` (§9, `DEC-ARCH-009`). Pasa entre el día 0 y la fecha de fin de servicio
> —después, la fuente de `PRE_TRIAL` ya no se emite (arriba, *«qué contesta el contrato en cada
> estado»*)— y en una vertical cerrada a altas sin discontinuar. No mueve plata; es un día de ficha
> visible sin título, en una vertical sin altas.~~ **CERRADO por el owner el 2026-09-25** (FASE 8
> completa): **`PB1` publica sólo si el dueño está cubierto o si esa publicación dispara `T1`** (§9).
> En una vertical cerrada a altas `T1` no dispara, así que quien no está cubierto **no publica** y
> la pantalla le dice *«suscribite para publicar»* (cap. 19 §4 fila 21). La capacidad de activación
> de la versión de pre-trial no cambia: ya no alcanza sola para publicar.

#### El hash que ya consumió: la rama que la base rechazaba sin que ninguna fila la declarara

(FASE 8 completa, `F-8CA3-003`.) El `UNIQUE(hash_del_correo_normalizado, vertical)` del cap. 02
§2.2 se escribió para **negar** un trial, y alcanzaba también a la escritura que **registra** uno
consumido. Quien borró su cuenta y vuelve con el mismo correo tiene `user_id` nuevo y ninguna fila
propia, pero su hash ya tiene la suya (cap. 02 §4.2 regla 2): si contrataba antes de publicar,
`T6` intentaba escribir la fila consumida, **chocaba con el `UNIQUE`**, y ninguna máquina declaraba
qué pasaba después — con `PB1` y `T6` en la misma transacción, **la persona pagaba y no podía
publicar**.

> **`T1`, `T6` ~~y `T7`~~, `T7` y `T8` (desde la FASE 9 completa, 6c) exigen que el hash del correo no tenga fila en esa vertical.** Si la tiene,
> ninguna dispara: el trial ya está consumido por esa fila, **la publicación sigue** ~~y la persona
> se queda en `PRE_TRIAL`~~ **si la persona está cubierta** —sin cobertura `PB1` no publica, porque
> no arranca ningún trial (§9; owner 2026-09-25)— y la persona se queda en `PRE_TRIAL`.
>
> **El mismo `UNIQUE` resuelve la carrera entre dos escrituras de la fila** —`T8` al acreditarse
> el pago y `T6` en un `PB1` simultáneo, o `T1` contra `T8`—: la que choca **no es un error**, es
> la guarda de hash leída tarde. No dispara, y la transacción que la contenía sigue con esa
> lectura: en `PB1`, publica sólo si la persona está cubierta (FASE 9 vuelta 1, `F-8V1A2-009`).

Es la lectura literal de `DEC-TRIAL-004` —*«el email normalizado niega el trial»*— escrita como
guarda en vez de como error de la base. **El par `T1`/`T6` sigue disjunto por `cubierto`**: la
guarda nueva es la misma en las dos, así que no las separa ni las solapa.

> ⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`**: **esa persona se queda en
> `PRE_TRIAL` para siempre**, porque su `user_id` no tiene fila y ninguna transición la va a
> escribir. Mientras esté cubierta no cambia nada. ~~**Sin cobertura, su fuente de `PRE_TRIAL`
> sigue llevando la capacidad de activación** (cap. 02 §2.1), así que `PB1` le publica, `T1` no
> dispara y la ficha queda **publicada sin título hasta que el reconciliador diario de cobertura
> la baja** al día siguiente (§9, `DEC-ARCH-009`) — **y puede repetirlo con otro borrador**. Es la
> misma forma que el ⚠️ de arriba sobre la vertical cerrada a altas, en una población acotada: quien
> borró su cuenta y volvió con el mismo correo.~~ **Sin cobertura no publica** —`PB1` exige
> cobertura o un `T1` que dispare, y acá `T1` no dispara— y la pantalla le dice *«suscribite para
> publicar»* (§9, cap. 19 §4 fila 21; FASE 8 completa, owner 2026-09-25): la ficha publicada sin
> título y el borrador repetible dejan de existir. Que su fila de `trial` quede asociada a la
> cuenta nueva no está escrito; **ya no tiene consecuencia sobre la publicación**.

#### La fila de los días en cero no es un estado final: `T7` la cierra el día del encendido

(Título cambiado en la FASE 9 vuelta 1, `F-8V1A2-010`: decía *«la tercera fila»*, y la tabla ya
tiene seis.)

**«Se queda en `PRE_TRIAL`» es verdadero mientras la configuración no cambie, y la configuración
va a cambiar**: `DEC-TRIAL-003` no dice *«Partner no tiene trial»*, dice *«hoy lo tiene en cero»*
y que **encenderlo es una decisión registrada**. El día del encendido, quien quedó en esa fila
**sale de `PRE_TRIAL` con las dos guardas del par cumplidas**: la vertical declara evento, los
días ya son `> 0`, y `cubierto` decide cuál de las dos dispara. Para el que **fue cliente y se
fue** —contrató, publicó, pagó meses y canceló— `cubierto` es **falso**, así que dispara **`T1`**
y le arranca un trial completo: las capacidades del plan vendible de `rank` más alto, gratis, a
alguien cuya relación comercial ya terminó. Y no le pasa a una persona: le pasa **a toda la
cohorte de ex-clientes de esa vertical, el mismo día**.

**Eso es exactamente lo que el §10.2 existe para cerrar** —*«un trial gratis para quien ya fue
cliente»*, la frase con la que este mismo § justifica a `T6`—, y en ~~el tercer renglón~~ ese renglón no lo
cerraba nadie, porque `T6` tampoco dispara mientras los días estén en cero. `T7` es el renglón que
faltaba:

> **El encendido de una vertical resuelve, en el acto, a todo el que quedó en `PRE_TRIAL` habiendo
> ya ejercido el evento de activación: su fila de `trial` se escribe consumida.** No arranca ningún
> reloj y no manda ninguna campaña — es la misma escritura de `T6`, con otro disparador.

~~**Y el corte hace la misma escritura una sola vez, fuera de esta tabla** (FASE 8 completa, owner
2026-09-25): cada dueño con ficha o suscripción en el sistema viejo amanece con su fila de `trial`
ya consumida en las verticales con días de trial > 0, para que `T1` no le dé un trial nuevo
(`V/21` §2.4, *«el rastro de que ya fue cliente»*). No es una transición —como la escritura `C`
de `inactiva_desde`, ocurre una vez en la vida del programa— y deja a esa persona en
`TRIAL_CONVERTED`, el mismo estado que `T6` y `T7`.~~ **El corte NO escribe filas de `trial`**
(owner 2026-09-25; FASE 9 completa, decisión 2g): *«a los clientes ya suscriptos les regalamos el
trial de nuevo: los tomamos como clientes nuevos»*. Cada dueño del sistema viejo amanece en
`PRE_TRIAL` sin fila y **su próxima publicación arranca un trial por `T1`**, como la de cualquiera;
lo único que el corte le respeta es la ficha (la escritura `C` de `inactiva_desde`, cap. 01 §1.2,
núcleo). Es una excepción de una sola vez al §10.2, decidida por el owner, y no toca `T7`: el
encendido sigue resolviendo a quien ejerció el evento **en el sistema nuevo**.

**Por qué la condición es «ya ejerció el evento» y no `cubierto`, que es la pregunta obvia.** Las
dos mitades importan y ninguna es intercambiable con la otra:

| quién | qué le pasa el día del encendido | por qué es lo correcto |
|---|---|---|
| **ya publicó en esa vertical** (con los días en cero sólo se puede publicar teniendo un título: la versión de pre-trial **no lleva la capacidad de activación** cuando los días son cero, cap. 02 §2.1) | **`T7`**: fila consumida | ya fue cliente y ya ejerció el evento que arranca el trial. Devolvérselo el día del encendido es el reseteo del §10.2 |
| **nunca publicó ahí**, tenga o no suscripción | **nada**: sigue en `PRE_TRIAL` | nunca ejerció el evento. Cuando lo ejerza, deciden `T1` y `T6` como en cualquier vertical — y es **literalmente** la población que `DEC-TRIAL-008` protege: *«alguien `SUSPENDED` por impago que **nunca publicó en esa vertical** recibe los días de trial que habría recibido igual si no hubiera contratado nunca»* |

> ⚠️ **`T7` consume también el trial de quien publicó sólo con una suscripción que nunca cobró**
> (owner 2026-09-26, `G2-4`; declarado por `DEC-METH-015`). Con días en cero, `T8` no dispara —su
> guarda pide días > 0—, y el registro del evento no dice con qué título se publicó: quien se
> suscribió, publicó en los minutos antes del primer cobro y vio ese cobro rechazado queda en la
> fila de *«ya publicó en esa vertical»* de esta tabla, y el día del encendido `T7` le escribe la fila consumida.
> **Causa**: saber si fue cliente es leer historia de cobro, que `DEC-TRIAL-008` cerró. Pierde un
> trial que no usó y no paga nada. Contradice la letra de `DEC-TRIAL-010` —*«un alta que no
> ocurrió no consume el trial»*— para esta población, y se acepta.

**Y no pide ningún hecho nuevo en la frontera**, que es la restricción que `DEC-TRIAL-008` acaba
de poner y que un *«¿alguna vez tuvo un título acá?»* habría violado de frente. *«Ejerció el
evento de activación»* es **un hecho de verticales**: es el mismo hecho que esta máquina ya tiene
que detectar para disparar `T1`, leído sobre el pasado en vez de sobre el instante. Su registro
existe y es duradero sin agregar nada: publicar es una transición de la máquina del §9, o sea un
evento auditable por el criterio 2 del cap. 08 §1.1 (núcleo), y ese registro es **append-only**
(§1.3) — ni borrar la ficha ni darse de baja lo borran, que es la misma promesa que el §10.2 ya
hace sobre el trial.

**`T7` no agrega ningún par a `G-R4` y no toca los cuatro declarados** —eran tres cuando esto se
escribió; el cuarto lo agregó `S25` (`DEC-SUB-015`), en la otra épica y sin abrir este §—. Comparte el `desde` con
`T1`/`T6`, pero **no el evento**: el suyo es el encendido, un cambio de catálogo, y los de aquéllas
son el evento de activación de la persona. El par `(PRE_TRIAL, evento de activación)` sigue
teniendo **dos** filas y dos destinos, que es lo que el cap. 03 §1 regla 7 (núcleo) enumera y lo
que `G-R4` cuenta. Y el par `(PRE_TRIAL, encendido)` tiene **una sola** fila, así que no hay
guardas que dirimir.

**El encendido no es una acción del catálogo del cap. 08 §3 (núcleo) y no hay que agregarlo ahí.**
No es un acto de un administrador sobre la cuenta de otro: es **configuración de catálogo**
—publicar una versión del plan de trial con días `> 0`, cap. 10 §3—, igual que cualquier otro
cambio de versión. Es auditable por el criterio 2 del §1.1 —cambia el acceso de mucha gente a la
vez— y `DEC-TRIAL-003` ya exige que la decisión quede registrada. Lo que el capítulo 11 (épica de
verticales) §8 agrega es **qué hay que hacer el mismo día**, porque encender el número sin ejecutar
`T7` es lo que abre la puerta.

**Y `cubierto` no se puede referir a sí mismo por accidente**, que es la trampa obvia de
condicionar una máquina de trial sobre la cobertura: la fuente del trial en `PRE_TRIAL` tiene
`hasta: SIN_EMPEZAR` y por eso es de clase `BASE`, no de clase `TÍTULO` (`12-contrato…` §2.4). No
cuenta para `cubierto`, así que el valor que leen `T1` y `T6` **está decidido enteramente por
fuentes ajenas al trial** — la suscripción, la cortesía o el grant.

**Consecuencia declarada, porque no decirla sería esconderla.** De los diez estados de la
suscripción, los que **no emiten fuente** (`12-contrato…` §2.6) dan `cubierto` falso, así que para
todos ellos dispara **`T1`**. Para cuatro —`ABANDONED`, `CANCELLED`, `CHARGE_DECLINED` y no tener
fila ninguna— es trivialmente lo correcto: no hay relación comercial de ningún tipo. Los otros
tres son los que valen la pena mirar, y son `PENDING_AUTHORIZATION`, `PAUSED` por
`CUSTOMER_REQUEST` y `SUSPENDED`. En los tres la persona **recibe su trial de verdad**, con su
reloj, y no pierde nada.

Para dos de los tres es la respuesta correcta sin matices: quien abrió un checkout y todavía no lo
autorizó —el contrato acaba de declarar que esa fila *«no vale nada»* porque el checkout se puede
abandonar, y cobrarle por ella el activo más caro que una persona tiene una sola vez en la vida
sería la lectura contraria— y quien pidió pausar, a quien *«el servicio está detenido»* (`B/16`
§2.2).

**Para el tercero es una concesión, y va medida.** Alguien `SUSPENDED` por impago que **nunca
publicó en esa vertical** recibe los días de trial que habría recibido igual si no hubiera
contratado nunca. Recibe **su único trial de por vida**, no uno extra: el día que regulariza, `T2`
lo convierte; si no regulariza, `T3` lo vence, `PB2` lo despublica y no le queda nada. Lo que el
diseño **no puede** hacer hoy es distinguirlo de quien no tiene nada — los dos ven exactamente la
misma respuesta del contrato—, y darle a verticales el dato que los separa es **agregarle un
segundo hecho a la frontera**, que dispara la regla de vigilancia del `12-contrato…` §4.2.

**Decidido: se deja así, y la frontera NO gana ese segundo hecho** (`DEC-TRIAL-008`, owner,
2026-09-21). Tres razones, y la tercera es la que sorprende:

1. **Un bit tipo *«hay un vínculo de suscripción no terminal»* es un estado de cobranza con otro
   nombre.** `DEC-ARCH-006` fija que el contrato es uno solo, y el día que ese bit exista alguien
   escribe la segunda regla de producto encima. Es una puerta, no una excepción.
2. **La alternativa empeora dos casos para arreglar uno**: alcanza a los tres estados, incluidos
   los dos que acá quedan bien resueltos.
3. **Quien está `SUSPENDED` ya no está pagando.** Darle su trial en una vertical nueva **no cuesta
   ingreso** —no hay ingreso que perder— y es la única vía por la que esa persona podría volver.
   Bloquearla protege un ingreso inexistente y cierra la puerta de vuelta.

Y queda rechazada con el resto la variante de distinguir **sólo** a `SUSPENDED`, que es la peor:
es literalmente una señal de deuda cruzando a verticales.

**Seis cosas que la tabla fija y conviene leer explícitas:**

- **`PRE_TRIAL` es el estado más poblado del sistema** y es un estado real, no la ausencia de
  uno: es donde vive quien entró a la vertical y todavía no publicó, con borradores ilimitados,
  sin capacidades comerciales y sin consumir trial (`DEC-TRIAL-007`).
- **No existe transición de vuelta a `PRE_TRIAL` ni a `TRIAL_ACTIVE` desde `TRIAL_EXPIRED`.**
  Es lo que hace cumplir al §10.2. Un trial consumido no se devuelve ni siquiera si la ficha que
  lo disparó se borra — con la consecuencia ya registrada de que alguien puede quedarse sin
  ficha y sin trial (`E-TRIAL-04`, capítulo 11 (épica de verticales)).
- **La extensión sólo entra por T4**, o sea sólo durante `TRIAL_ACTIVE`. El §32 es terminal:
  *«Solo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe rechazar.»*
- **`T6` es `T1` para quien ya está cubierto, y sin él el trial queda colgado.** Alguien puede
  contratar **antes** de publicar: el día que publica, `T1` dispararía sobre alguien que ya tiene
  un título y lo dejaría en `TRIAL_ACTIVE` **con dos fuentes de clase `TÍTULO` a la vez** — la de
  su plan y la del plan de trial, que el pliegue del capítulo 15 (épica de verticales) suma y cuyos
  entitlements *«se derivan … del plan vendible de `rank` más alto»* (cap. 02 §2.1).
  **Paga el básico y opera con las capacidades del premium.** `T6` cierra el caso escribiendo
  la fila **ya consumida**: el título es la fuente que ya tiene, que es exactamente lo que
  `TRIAL_CONVERTED` significa. **Desde la FASE 9 completa ese título tiene que convertir** (owner
  2026-09-25, 6c): una suscripción que todavía no cobró no alcanza, y la fila la escribe `T8` al
  primer pago (arriba, *«`T6` espera el cobro, y `T8` lo consume»*).

  **Y consumirlo es lo correcto, no un castigo**: la fila es única de por vida, así que sin
  escribirla esa persona **se guardaría un trial para el día que cancele** — un trial gratis para
  quien ya fue cliente, que es la puerta que el §10.2 existe para cerrar. Lo que no pierde es
  nada: **la condición garantiza que hay un título vivo**, así que no necesita probar lo que ya
  tiene. La justificación dejó de apoyarse en una lectura de *«viva»* que verticales no puede
  hacer y pasó a apoyarse en el único dato que el contrato le entrega.

  **La rama vieja —`T1` ganando el par— ya no existe, y no por precedencia**: la condición de `T1`
  exige `cubierto` **falso**, así que sobre esta persona no dispara. Y aunque disparara, el estado
  ya no sería terminal: `T3` perdió la condición que lo bloqueaba.

  **La otra mitad de este caso la cerró el contrato**: quien contrata y **no** publica conserva su
  fuente de `PRE_TRIAL` mientras paga, y antes eso lo seguía cubriendo el día que cancelaba. Desde
  que **un reloj que no arrancó no es un título** (`12-contrato…` §2.4), esa fuente ya no cubre.
- **`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene.** La condición vieja —*«no hay trial
  previo para ese `user + vertical`»*— decía lo mismo que su estado de origen **y lo negaba**: con
  fila en `PRE_TRIAL`, *«no hay trial previo»* es falso siempre, y `T1` **no dispara nunca**. Se
  cae por **redundante**, no por permisiva. Lo que impide un segundo trial son dos cosas que
  siguen intactas: **ninguna transición vuelve a `PRE_TRIAL`** y la fila que `T1` crea es única de
  por vida (cap. 02 §2.2), ahora por `user` **y** por hash de correo.

  **Lo que sí hacía falta, y la condición vieja no era, es una condición sobre el sujeto.** Al
  caerse aquélla `T1` quedó sin ninguna que mirara el estado comercial de la persona, que es
  justo lo que `T6` vino a mirar: durante una vuelta entera del ciclo las dos filas del par
  pudieron disparar a la vez. `cubierto` **falso** es esa condición, y es del sujeto, no del
  catálogo — por eso las dos mitades de la guarda son necesarias y ninguna sobra.
- **T4 re-agenda la campaña previa**, no la deja como estaba. Si el trial se extiende 10 días y
  el aviso de «faltan 2 días» ya salió, el cliente tiene que recibirlo de nuevo contra la fecha
  nueva. El cruce inverso —la campaña de recuperación ya disparada y el trial extendido después—
  **no existe**: esa campaña arranca en T3 y T4 exige `TRIAL_ACTIVE`, así que entre las dos no hay
  camino (`E-TRIAL-03`, disuelto por el capítulo 11 (épica de verticales) §7).

---

## 9. Publicación

Es la máquina de la ficha, y el §63 la pide aparte porque no coincide con la de la suscripción:
una suscripción cubre **todas** las fichas de su vertical (§12), así que un solo evento de
billing mueve varias publicaciones a la vez.

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| PB1 | ~~`DRAFT`~~ `DRAFT` **o `UNPUBLISHED_BY_BILLING`** (FASE 9 vuelta 1, R1) | el dueño publica | `PUBLISHED` | **sólo si el dueño está cubierto** —`cubierto` verdadero en esa vertical— **o si esta publicación dispara `T1`**, o sea si arranca un trial: la persona está en `PRE_TRIAL` y se cumplen las condiciones de `T1` (§2). **Si no, no publica**, y la pantalla le dice *«suscribite para publicar»* (cap. 19 §4 fila 21) (FASE 8 completa, owner 2026-09-25). Es **inmediato, sin revisión previa** (`DEC-TRIAL-005`): publicar es quedar visible, y es el evento que consume el trial en las verticales con ficha. **Toma el lock del `user + vertical` y cuenta el cupo adentro** (abajo, *«publicar ocupa cupo bajo un lock»*; FASE 8 completa, `F-8CA1-006`, `F-8CA2-010`, owner 2026-09-25). **Desde `UNPUBLISHED_BY_BILLING` sale sólo por la segunda rama**: si esta publicación dispara `T1`. Es el camino del dueño que perdió la ficha por billing y todavía no estrenó su trial —la cartera del corte (`V/21` §2.4; `2g`) y quien quedó en `PRE_TRIAL` por un primer cobro rechazado (§2, `T8`)—. **Con cobertura no sale por acá**: la ficha vuelve por `PB3`, con el criterio de *«cuáles vuelven»*, y no a mano (FASE 9 vuelta 1, R1; owner 2026-09-26, `G1-1`) |
| PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` | o el excedente tras un downgrade, que no cambia `cubierto` y sí el cupo. **En la primera rama escribe `listing.inactiva_desde` con el instante de la caída** —es el hecho 5 del cap. 01 §1.2 (núcleo), *«la ficha deja de estar publicada porque perdió la cobertura»*—; **en la del excedente no la escribe**, porque la cobertura sigue verdadera (FASE 8 completa, `F-8CA2-001`, `F-8CA3-001`, owner 2026-09-25). **`PB2` es uno de los dos ejecutores del hecho 5, no el único**: el hecho es *«el dueño pierde la cobertura en la vertical»* y alcanza a **todas** sus fichas en ella; a las que no están en `PUBLISHED` —y por eso `PB2` no toca— se lo escribe el recálculo que el mismo aviso despierta, sin transición de esta máquina (owner 2026-09-25). **Toma el mismo lock que `PB1`, en las dos ramas**, **y dentro del lock relee `cubierto` —primera rama— y el cupo —segunda— antes de escribir**: si la relectura ya no da la condición, `PB2` no ocurre (la regla de `B/05` §2, `C1`, igual que `PB1`; FASE 9 vuelta 1, `F-8V1A2-008`), y así la carrera contra `PB1` no deja una ficha publicada sin cobertura (abajo; FASE 8 completa, `F-8CA2-009`, owner 2026-09-25) |
| PB3 | `UNPUBLISHED_BY_BILLING` | **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie** | `PUBLISHED` | y el cupo alcanza. **Es una disyunción de dos, simétrica a la de `PB2`** (`DEC-DATA-003`). Ocupa cupo, así que **toma el lock y cuenta adentro**, como `PB1` (abajo) |
| PB4 | `PUBLISHED` o `UNPUBLISHED_BY_BILLING` | día 90 de **inactividad**, contado sobre `listing.inactiva_desde` (cap. 01 §1.2, núcleo; cap. 02 §2.5) | `ARCHIVED` | **relee la cobertura antes de archivar** (ver abajo). Sale del sitio público, **el dueño la sigue viendo** y puede exportarla o reactivarla (`DEC-DATA-001`) — y las dos cosas son ejecutables desde que existen `PB7` y `PB8` |
| PB5 | `DRAFT` | N meses de **inactividad**, contado sobre `listing.inactiva_desde` (cap. 01 §1.2, núcleo; cap. 02 §2.5) | `ARCHIVED` | `DEC-TRIAL-007`; `N` es configuración, **validada menor que 6 meses** —el día 180 cae así ~~siempre después del archivado y de su aviso~~ después del archivado; **el espacio entre los dos no está garantizado** (⚠️ de *«la moderación y el borrado del dueño»*, punto 6, y `V/20` §2, `G-R5-B`; FASE 9 completa, `K-5`)—, y lo vigila `G-R5-B` (cap. 20 §2; FASE 8 completa, `F-8CA2-014`, owner 2026-09-25). **Relee la cobertura antes de archivar**, igual que `PB4` |
| PB6 | `PUBLISHED` | el dueño despublica | `DRAFT` | y **no devuelve el trial** (§10.2) |
| **PB7** | `ARCHIVED` | **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie** | `PUBLISHED` | y el cupo alcanza, **y el evento que la archivó dice que venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`**. Es `PB3` un estado más atrás, **con la misma disyunción y por la misma razón** (ver abajo). Ocupa cupo, así que **toma el lock y cuenta adentro**, como `PB1` |
| **PB8** | `ARCHIVED` | **el dueño la reactiva** | `DRAFT` | desde cualquier origen, incluido el de `PB5`. Es la mitad de `DEC-DATA-001` que se prometía en una nota y no ejecutaba ninguna tabla. **La autoriza la versión de piso**, que otorga *«recuperar lo suyo»* (cap. 02 §2.1): sin eso el paso 6 rechazaba a su única población, la que no paga. **Toma el lock del `user + vertical` y relee adentro que la ficha siga en `ARCHIVED`**, porque comparte `desde` con `PB7` y `PB9` (abajo, *«publicar ocupa cupo bajo un lock»*; FASE 9 vuelta 2, `F-8V2A2-004`) |
| **PB9** | `ARCHIVED` | día 180 de **inactividad**, contado sobre `listing.inactiva_desde` (cap. 01 §1.2, núcleo; cap. 02 §2.5) | **`PURGED`** | **es el hard delete** (cap. 02 §4.1): borra el contenido de esa ficha —textos, fotos, FAQ, horarios— y sus borradores, **y nada más**; nada de la persona (`DEC-DATA-005`). **Las reseñas de terceros se conservan sin mostrarse, y la conexión de calendario se desconecta: su token se revoca en el proveedor y se borra** (cap. 02 §4.1; FASE 9 vuelta 1, owner 2026-09-26, `G1-5`). **Exige `ARCHIVED`**: sale sólo de ahí, así que el aviso del archivado salió siempre antes (`F-8CA2-014`). **Relee la cobertura antes de borrar**, igual que `PB4` y `PB5`: si está cubierta, no borra y reinicia el reloj. **Y lo relee todo dentro del lock del `user + vertical`**: el estado, el reloj y la cobertura, porque comparte `desde` con `PB7` y `PB8` y es irreversible (abajo; FASE 9 vuelta 2, `F-8V2A2-004`). **Y lo que cuelga de la ficha lo trata la lista cerrada del cap. 02 §4.1**: las alertas de precio se cierran con un aviso al turista, las conversaciones quedan en sólo lectura y lo del dueño que sólo sirve a la ficha se borra (owner 2026-09-27, FASE 9 vuelta 2, `R9`). **`PURGED` es final**: ninguna fila sale de ahí —`PB3` y `PB7` no la toman— y **no cuenta para el cupo**; el dueño ve que la ficha existió y que se borró por inactividad (cap. 19 §4 fila 20). ~~**Es también *«la ficha se borró»* de `B/16` §4.2**, igual que `PB12`: el addon `LISTING` que apuntaba a ella **queda huérfano** (`A5`)~~ **Es también *«se borra la ficha destino»* de `A6`** (`B/03` §8), igual que `PB12`: desde `K-9` `A6` es la única fila que cancela el addon `LISTING` que apuntaba a ella; la orfandad de `A5` ya no mira el borrado (FASE 9 vuelta 1, `F-8V1A2-002`). **Y ~~en el mismo acto~~ el mismo acto, después de su commit y nunca dentro de su transacción, empuja a billing el hecho *«la ficha llegó a `PURGED`»*** (`12-contrato…` §3.1; owner 2026-09-26, `G2-1`; el orden, FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`: `A6` relee `fichaPurgada`, y un empuje anterior al commit la lee `no`) (orquestador, FASE 8 completa, 2026-09-25). FASE 8 completa, `F-8CA2-008`, `F-8CA2-014`, owner 2026-09-25 |
| **PB10** | `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED` | **un admin la modera, con motivo** | **`MODERATED`** | es una acción administrativa del cap. 08 §3 (núcleo): permiso propio y auditada **con su motivo** (el campo *«por qué»* del cap. 08 §1.2). Sale del sitio público, **no cuenta para el cupo** y **no devuelve el trial** (§10.2; `V/11` §2). FASE 8 completa, `F-8CA2-004`, owner 2026-09-25 |
| **PB11** | `MODERATED` | **un admin levanta la moderación** | `DRAFT` | **es la única salida de `MODERATED`**: el dueño no la republica —~~`PB1` sale sólo de `DRAFT`~~ `PB1` sale de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial (FASE 9 vuelta 1, R1)— y el sistema tampoco —`PB3` y `PB7` no la tienen en su `desde`—. Es la misma acción administrativa que `PB10`. FASE 8 completa, `F-8CA2-004`, owner 2026-09-25. **Escribe `listing.inactiva_desde` con el instante en que se levanta**: es el **hecho 6** del cap. 01 §1.2 (núcleo), *«se levanta la moderación»* —mientras la ficha estuvo moderada el dueño no podía actuar, y contar esa ausencia lo castigaría por una decisión nuestra, la razón del hecho 4— (owner 2026-09-25; FASE 9 completa, decisión 5b, `OW-1`) |
| **PB12** | `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED` | **el dueño la borra** | **`PURGED`** | **borra el contenido en el acto** —el mismo que `PB9`: textos, fotos, FAQ, horarios y sus borradores, nada de la persona (`DEC-DATA-005`), con las reseñas de terceros conservadas sin mostrarse y el calendario desconectado y su token revocado y borrado (FASE 9 vuelta 1, owner 2026-09-26, `G1-5`), **y el resto de lo que cuelga de la ficha según la lista cerrada del cap. 02 §4.1** (owner 2026-09-27, FASE 9 vuelta 2, `R9`)—; **la fila queda y no vuelve**, porque `PURGED` es final. **No devuelve el trial** (§10.2; invariante 2 del cap. 04, núcleo). Es ~~*«la ficha se borró»* de `B/16` §4.2, así que el addon `LISTING` que apuntaba a ella **queda huérfano** (`A5`) —y es~~ *«se borra la ficha destino»* de `A6` (`B/03` §8), la única fila que cancela el addon `LISTING` que apuntaba a ella (`K-9`; FASE 9 vuelta 1, `F-8V1C1-013`), **y ~~en el mismo acto~~ el mismo acto, después de su commit y nunca dentro de su transacción, empuja a billing el hecho *«la ficha llegó a `PURGED`»*** (`12-contrato…` §3.1; owner 2026-09-26, `G2-1`; el orden, FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`: `A6` relee `fichaPurgada`, y un empuje anterior al commit la lee `no`). FASE 8 completa, `F-8CA2-004`, owner 2026-09-25 |

~~**La máquina tiene cinco estados y nueve transiciones**: `DRAFT`, `PUBLISHED`,
`UNPUBLISHED_BY_BILLING`, `ARCHIVED` y **`PURGED`**, y de `PB1` a **`PB9`**.~~ **La máquina tiene
seis estados y doce transiciones**: `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED`,
**`PURGED`** y **`MODERATED`**, y de `PB1` a **`PB12`** (recontadas sobre la tabla; FASE 8
completa, `F-8CA2-004`, owner 2026-09-25). Hasta la FASE 8
completa eran cuatro y ocho: el hard delete del día 180 no tenía fila y dejaba la ficha vaciada en
`ARCHIVED`, desde donde `PB7` la republicaba (`F-8CA2-008`, owner 2026-09-25); eso sumó `PURGED` y
`PB9`. **Y la baja por moderación y el borrado del dueño tampoco tenían fila** (`F-8CA2-004`): eso
suma `MODERATED`, `PB10`, `PB11` y `PB12` (abajo, *«la moderación y el borrado del dueño»*).

**La ficha nace en `DRAFT`, y nacer no es una fila de esta tabla** (FASE 9 completa, `B-9`;
declarado por `DEC-METH-015`, FASE 9 completa). Es el hecho 1 —crearla— y la forma de la regla 2
del cap. 03 §1 (núcleo): el estado inicial vive en la creación de la fila. Sin esta línea, la
regla 1 leída al pie de la letra no deja crear una ficha.

**La ficha que ya existía el día del corte nace en el estado que le da la tabla de traducción
de `V/21` §2.4**, escrito una sola vez por la migración estructural del corte, junto con la
escritura `C` de `inactiva_desde`. Tampoco es una fila de esta tabla: es la forma de la regla 2
del cap. 03 §1 (núcleo) para una fila que no nació en el sistema nuevo (FASE 9 vuelta 1, R1).

**`PB2` y `PB3` se disparan por el CAMBIO de `cubierto` —o por el del cupo—, no por una lista de
transiciones**, y ése es el arreglo: las dos listas estaban **congeladas** y se quedaron cortas
apenas el diseño se movió. `PB2` enumeraba cuatro causas y **no conocía `S16`** —el alta cuyo primer cobro se
rechaza—; `PB3` enumeraba tres y **no conocía `S2`**, así que **el que recontrataba después de
cancelar pagaba y su ficha no volvía nunca** — y tampoco podía sacarla a mano, porque ~~`PB1` sale
sólo de `DRAFT`~~ `PB1` sale de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial
(FASE 9 vuelta 1, R1) —y quien recontrata está cubierto—.

**El contrato ya emite el hecho** —*«la cobertura de (user, vertical) cambió»* (`12-contrato…`
§3)— así que atarse a él **no agrega un mecanismo: usa el que estaba**. Una lista de transiciones
en una épica, mantenida a mano contra los cambios de la otra, es el punto de falla favorito de un
arreglo hecho por racimos.

**Pero el hecho dice CUÁNDO preguntar y no contesta la pregunta, y ~~las dos filas del reloj releen
antes de actuar — y no son las únicas que releen, sólo las únicas que tienen fila acá~~ las tres
filas del reloj —`PB4`, `PB5` y `PB9`— releen antes de actuar.** El §3 del contrato prohíbe decidir con lo que trae el aviso —*«un consumidor que
decidiera con lo que trae el evento estaría creyéndole a un mensaje en vez de al estado»*—, y `PB4`
y `PB5` **deciden lo más caro que decide esta máquina** ~~:~~ **después de `PB9`**: el día 90 es el primer escalón del hard
delete del día 180 (cap. 02 §4.1). Así que ~~las dos~~ las tres, en el momento de ejecutar, **vuelven a pedirle
la cobertura al contrato**: si el `user + vertical` está cubierto, no archivan y **reinician el
reloj** escribiendo `listing.inactiva_desde` (cap. 02 §2.5, hecho 2 del cap. 01 §1.2, núcleo). Un
aviso perdido pasa así a costar un retraso en el reinicio y nunca un archivado indebido — y que
estos avisos se pierden lo declara el propio diseño en el otro consumidor de la misma lista
(cap. 02 §3.2, regla 2). **La relectura no restituye**: si el aviso perdido era el de la vuelta, la
ficha que está abajo la republica **el reconciliador diario de cobertura** (final de este §;
`DEC-ARCH-009`), no `PB4`.

~~**Y son dos filas porque esta máquina tiene dos, no porque los actores del reloj sean dos: el
tercero está afuera y es el que más caro sale.** *«Las dos»* de este párrafo cuantifica **las filas
de esta tabla**, y es verdadero de las filas. El **hard delete del día 180** no es una transición de
publicación —no mueve la ficha de estado: le borra el contenido (cap. 02 §4.1)— así que no puede
tener fila acá, y **relee exactamente igual, por la misma razón y con el mismo efecto**: si la
cobertura vuelve verdadera, no borra y escribe el hecho 2 (cap. 01 §1.2, núcleo; cap. 02 §4.2,
regla 4). Leer *«las dos»* como *«los dos únicos que releen»* deja al único acto irreversible del
programa decidiendo con un aviso que el propio diseño declara que se pierde.~~ **Y desde la FASE 8
completa el tercero tiene fila: es `PB9`** (`F-8CA2-008`, owner 2026-09-25). El hard delete del día
180 **mueve la ficha a `PURGED`** en vez de dejarla vaciada en `ARCHIVED`, y **relee exactamente
igual que `PB4` y `PB5`, por la misma razón y con el mismo efecto**: si la cobertura vuelve
verdadera, no borra y escribe el hecho 2 (cap. 01 §1.2, núcleo; cap. 02 §4.2, regla 4). Es el
único acto irreversible del programa, y ahora la tabla lo dice en vez de dejarlo afuera.

**Y el excedente queda como la única causa enumerada**, porque es la que **no** cambia `cubierto`:
la persona sigue cubierta y lo que no le alcanza es el cupo.

**Y por eso `PB3` y `PB7` tienen la misma disyunción, que es lo que faltaba: sin la segunda rama,
el excedente entraba y no salía nunca.** El recorrido, porque es corto y termina en un borrado:
un anfitrión con cinco fichas baja de Premium a Básico, el reconciliador le despublica tres por la
segunda rama de `PB2`, y tres meses después **vuelve a Premium y paga el precio entero**. Su
`cubierto` fue verdadero de punta a punta —un upgrade es una sucesión, y la predecesora emite
hasta que `S17` la mata (`12-contrato…` §2.6)—, así que **no hay ningún cambio de `cubierto` que
disparar**. Con `PB3` pidiendo sólo ese cambio, las tres se quedaban en
`UNPUBLISHED_BY_BILLING`, desde donde no salía ninguna otra fila —~~`PB1` sale sólo de `DRAFT`~~ `PB1` sale de `DRAFT`, y de
`UNPUBLISHED_BY_BILLING` sólo si arranca un trial (FASE 9 vuelta 1, R1)—, y
ahí se quedaban **para siempre**. **Paga el plan más caro y recibe el más chico, indefinidamente y
sin que nada lo señale** (`DEC-DATA-003`). *(Este renglón decía además que el día 90 `PB4` las
archivaba y el día 180 el hard delete les borraba el contenido, y es falso para este sujeto por la
razón del recuadro de abajo: la relectura de `PB4` encuentra cubierto al dueño y no archiva. El
daño es el encierro, no el borrado, y alcanza solo.)*

**`PB7` la lleva también, y no es una extensión de la decisión sino su condición** (`DEC-DATA-004`,
punto `B2`). Si `PB7` se quedara con el evento único, **una ficha que ya está en `ARCHIVED` y cuyo
dueño ya recuperó la cobertura no tendría cómo volver el día que el cupo crezca**: `cubierto` ya
pasó a verdadero —no queda ningún cambio que disparar— y lo único que se mueve después es el cupo.
Se quedaría ahí para siempre, que es el mismo encierro de `PB3` **un estado más adentro**, y es lo
que `DEC-DATA-002` declaró cerrado con *«vuelve sola por `PB7` y nunca se borra»*.

> ⚠️ **La población de esa segunda rama hay que nombrarla bien, porque la primera versión de este
> párrafo la nombró mal y tres lugares del corpus se apoyaron en esa premisa.** Decía que *«la
> mitad `UNPUBLISHED_BY_BILLING` del `desde` de `PB4` es exactamente la población del excedente»*,
> y **no lo es: la ficha del excedente de un dueño CUBIERTO no llega nunca al día 90.** `PB4` relee
> la cobertura antes de archivar y la encuentra verdadera —el excedente es la única causa que
> **no** cambia `cubierto`—, así que no archiva y **reinicia el reloj**. Esa mitad del `desde` de
> `PB4` alcanza a la ficha que bajó por la **primera** rama de `PB2` —se perdió la cobertura— y
> siguió sin cobertura noventa días.
>
> **La población real de la segunda rama de `PB7` existe, y es la que la vuelve necesaria**: una
> ficha archivada **mientras su dueño no estaba cubierto** —el caso de la pausa larga que la
> sección de abajo desarrolla: **4 pausas-mes** son unos 120 días contra los 90 de `PB4`—, que **al
> volver la cobertura no entra en el cupo** y se queda en `ARCHIVED` con su reloj reiniciado, y a
> la que **después le crece el cupo**. Ahí `cubierto` no cambia y el cupo sí, que es exactamente el
> evento que la segunda rama declara.
>
> **Lo que se corrige es el sujeto de la razón, no la conclusión**, así que `DEC-DATA-004` `B2`
> queda en pie tal como se ratificó: la rama sigue siendo **la condición** de `DEC-DATA-003` y no
> una extensión. **Y la ficha del excedente de un dueño cubierto no se archiva ni se borra, a
> propósito**: vuelve por la segunda rama de **`PB3`**, un estado antes, y mientras tanto su reloj
> se reinicia —*«las que no entran no se borran»*, abajo, y cap. 02 §4.2 regla 4—. El hard delete
> del día 180 **no la alcanza nunca**, que es el lado conservador y el que el diseño eligió.

**Qué NO cambia, y conviene contarlo para que nadie lo recuente.** La rama nueva **no toca
`cubierto`** —lo lee, no lo mueve—, así que no consume ni devuelve ningún trial (`T2`, `T5` y `T6`
siguen colgando de las fuentes de clase `TÍTULO`, §2) y **no es el evento de activación**:
restituir no es publicar, igual que en la rama vieja —**salvo para la guarda de `T8`**, que cuenta
la vuelta bajo un título que paga como ejercicio del evento (§2; owner 2026-09-27, FASE 9 vuelta
2, `R15`)—. Tampoco agrega pares a `G-R4`: son **dos
eventos en la misma fila con el mismo destino**, no dos filas sobre un par — la misma forma que
`PB2` ya tenía (cap. 03 §1 regla 7, núcleo).

**`UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT` a propósito.** Si billing bajara la
ficha a `DRAFT`, al recuperar la cobertura no habría forma de saber cuáles republicar sin
publicar también las que el dueño había bajado él. La distinción es lo que hace posible PB3.

**El excedente tras un downgrade tiene criterio escrito y predecible**: se despublican **las
publicadas más recientemente**, hasta entrar en el límite, y **el criterio va escrito en el
aviso** — si el cliente no puede leerlo, deja de ser predecible y se pierde el motivo por el que
se eligió (`DEC-SUB-008`).

### La moderación y el borrado del dueño

FASE 8 completa, `F-8CA2-004`, owner 2026-09-25.

**Desde `DEC-TRIAL-005` toda moderación es reactiva, y hasta acá ninguna fila bajaba una ficha por
decisión nuestra ni la borraba.** Por la regla 1 del cap. 03 §1 (núcleo) esos actos no se
ejecutaban, y llevarlos a un estado existente los deshacía la propia máquina: desde `DRAFT` el
dueño la republica con `PB1`, y desde `UNPUBLISHED_BY_BILLING` la republica `PB3` en el próximo
cambio de cobertura o de cupo. **`MODERATED` es un estado propio por la misma razón que
`UNPUBLISHED_BY_BILLING` es distinto de `DRAFT`**: el estado es lo que dice quién puede sacarla de
ahí.

- **Entra desde cualquier estado no final** (`PB10`): `DRAFT`, `PUBLISHED`,
  `UNPUBLISHED_BY_BILLING` o `ARCHIVED`. `PURGED` es final.
- **No la republica nadie más que un admin**: ni el dueño con `PB1`, ni el sistema con `PB3` o
  `PB7`. **Sólo un admin la saca, y a `DRAFT`** (`PB11`); desde ahí publicar vuelve a ser un acto
  del dueño.
- **No cuenta para el cupo** ni compite por él (abajo, *«qué cuenta para el cupo»*).
- **No devuelve el trial** (§10.2). `V/11` §2.2 ya separa la baja justificada, que no repara nada,
  del error de moderación, que se repara con los instrumentos de `V/11` §2.3 y no con una
  transición de vuelta.

**El reloj de inactividad corre en `MODERATED`, por la regla general del cap. 01 §1.2 (núcleo)**:
la inactividad es *«el tiempo que lleva sin estar a la vez publicada y cubierta»*, y una ficha
moderada no está publicada. ~~Ni `PB10` ni `PB11` escriben `listing.inactiva_desde`: las ejecuta un
admin, y el hecho 1 es *«un acto del dueño»*.~~ **`PB10` no escribe `listing.inactiva_desde`**: la
ejecuta un admin, y el hecho 1 es *«un acto del dueño»*. Lo que no pasa mientras dura es que alguien actúe
sobre ese reloj: `PB4`, `PB5` y `PB9` no tienen `MODERATED` en su `desde`, así que **una ficha
moderada no se archiva ni se borra por inactividad**. ~~La consecuencia, dicha para que no sorprenda:
al volver a `DRAFT` por `PB11` la ficha trae la inactividad acumulada, y `PB5` la puede archivar en
cuanto se cumplan sus `N` meses, con su relectura de cobertura y su aviso, como a cualquier
borrador.~~ **`PB11` sí lo escribe: levantar la moderación es el hecho 6** (owner 2026-09-25; FASE 9
completa, decisión 5b, `OW-1`). Leída la versión anterior —*«al volver a `DRAFT` la ficha trae la
inactividad acumulada»*—, una moderación larga sobre un dueño sin cobertura terminaba en
`PB11` → `PB5` → `PB9`: el archivado con un aviso que imprimía una fecha de borrado ya pasada y el
borrado en la corrida siguiente, días después de que un admin decidiera que la ficha estaba bien.
Con el hecho 6 la ficha vuelve a `DRAFT` con el reloj en cero, y lo que le toca es lo de
cualquier borrador recién tocado. Y el hecho 5 —*«el dueño pierde la cobertura en la vertical»*— se escribe también sobre
ella, porque alcanza a toda ficha del dueño en la vertical, publicada o no.

**`PB12` lleva al mismo estado final que `PB9`, y por eso no hace falta uno nuevo.** `PURGED` ya
dice *«la fila queda, el contenido no, y no vuelve»*; lo que cambia es quién lo pide y cuándo:
**el dueño, y el borrado es en el acto**. No relee la cobertura, porque la relectura de `PB4`,
`PB5` y `PB9` existe para no borrarle nada a alguien que volvió, y acá el que borra es el dueño.
~~Es el evento que `B/16` §4.2 llama *«la ficha se borró»* —el addon `LISTING` queda huérfano y `A5`
lo cancela— y el que `A6` (`B/03` §8) llama *«se borra la ficha destino»*. **No es el único**:
*«la ficha se borró»* es **cualquier llegada a `PURGED`**, así que `PB9` también deja huérfano al
addon `LISTING`~~ Es el evento que `A6` (`B/03` §8) llama *«se borra la ficha destino»*, y desde
`K-9` es la única fila que lo ejecuta: la orfandad de `A5` (`B/16` §4.2) ya no mira el borrado.
**No es el único**: `PB9` llega al mismo `PURGED`, así que también dispara `A6` (FASE 9 vuelta 1,
`F-8V1A2-002`, `F-8V1C1-013`) (orquestador, FASE 8 completa, 2026-09-25). **Billing se entera por
dos caminos** (owner 2026-09-26, `G2-1`, contra la recomendación: no se acepta ni un cobro de más):
`PB9` y `PB12` le **empujan ~~en el mismo acto~~ en el mismo acto, después de su commit** (FASE 9
vuelta 1, `N-G2V-01`/`N-G4V-05`) el hecho *«la ficha llegó a `PURGED`»*
(`12-contrato…` §3.1), y como ese empuje no tiene transporte durable, **la red es la consulta
`fichaPurgada` del contrato §4.1, que billing lee en su barrido diario** (`B/09` §3). Las construye
V6, dueña de `PB12`: la consulta y el empuje de `PB12`; el de `PB9` va con V9, que tiene esa fila
(`descomposicion.md` §2).

**Ninguna de las tres agrega pares a `G-R4`.** `PB10` y `PB12` comparten `desde` con casi toda la
tabla, pero sus eventos —el acto del admin y el del dueño— no los declara ninguna otra fila, así
que cada par tiene **una sola** fila; `PB11` es la única que sale de `MODERATED` (cap. 03 §1
regla 7, núcleo). **Ninguna es de la clase del reloj** (cap. 17 §3.4), así que `G-R3-B` no ve
nada nuevo; **ninguna condición lee una columna** ~~y **ninguna escribe `listing.inactiva_desde`**,
así que `G-R6` y `G-R6-B` tampoco (cap. 20 §2)~~, así que `G-R6` tampoco; **`PB11` escribe
`listing.inactiva_desde` desde la FASE 9 completa** —el hecho 6, decisión 5b—, y `G-R6-B` mitad
*(a)* la admite **por la lista**, como a los otros cinco hechos (cap. 20 §2).

> ⚠️ **Lo que esto NO cierra, declarado con su causa por `DEC-METH-015`** (ninguno mueve plata en
> el camino principal, da acceso indebido ni borra datos):
>
> 1. **`PB12` no sale de `MODERATED`.** La decisión nombra el borrado del dueño y no dice si
>    alcanza a una ficha moderada; sin fila, por la regla 1 no se ejecuta, y el dueño la puede
>    borrar después de que un admin la levante. El contenido se conserva, que es el lado que no
>    borra.
> 2. **Qué operaciones del dueño acepta una ficha `MODERATED`** —verla, exportarla, editarla— no
>    está escrito; es la pregunta *«¿está en un estado que acepta esto?»* del paso 4 del cap. 17
>    §1.2. Si editar se admite, es el hecho 1 y reinicia el reloj.
> 3. **Los avisos al dueño** al moderar, al levantar la moderación y al borrar no tienen fila en
>    `V/19` §4, y la fila 20 de ahí dice *«se borró por inactividad»*, que no es la causa de una
>    ficha que llegó a `PURGED` por `PB12`. **Cerrado en parte** (FASE 9 vuelta 1; owner
>    2026-09-26, `G2-3`; precisado 2026-09-26), y por partes:
>    - **Al moderar (`PB10`): cerrado.** Tiene la fila 24 de `V/19` §4 y su correo en
>      `NUCLEO/07` §6, porque el dueño no está presente cuando un admin modera y la fila sola no
>      le llegaba. La fila nombra el motivo y los destaques recurrentes sobre esa ficha, que se
>      siguen cobrando hasta que el dueño los dé de baja.
>    - **Al levantar la moderación (`PB11`): abierto.** No tiene fila ni correo.
>    - **Al borrar (`PB12`): abierto, y con dos huecos.** No tiene fila, y la fila 20 sigue
>      nombrando sólo `PB9` y la causa *«por inactividad»*, así que una ficha borrada por su dueño
>      no tiene texto propio en Mi Cuenta.
> 4. **El contenido de una ficha moderada no tiene fin**: ningún reloj actúa en `MODERATED`, así
>    que se conserva mientras dure la moderación.
> 5. ~~**Qué capacidad autoriza `PB12` en el paso 6 no está escrita.** Borrar escribe estado, así
>    que pasa por el paso 5 y por el 6 (cap. 17 §3.5), y la lista cerrada de la versión de piso
>    (cap. 02 §2.1) da *«recuperar lo suyo»* como verla, exportarla y reactivarla, no borrarla. Si
>    nadie la declara, un dueño sin título —el de una ficha `ARCHIVED` que no paga— no puede borrar
>    su ficha. El resultado es conservar, no borrar.~~ **CERRADO por el owner el 2026-09-25** (FASE 8
>    completa): **borrar lo propio es parte del piso**. La fila 3 de la lista cerrada de la versión de
>    piso (cap. 02 §2.1) otorga ahora verla, exportarla, reactivarla **y borrarla**, así que el paso 6
>    autoriza `PB12` siempre, con o sin plan (cap. 17 §1.2 precisión 1). La lista sigue teniendo tres
>    filas y `G-R3` no cambia: es la misma clave, *«recuperar lo suyo»*, de clase `DE_ACCESO`.
> 6. **Los avisos previos de retención no dicen en qué estados se programan** (FASE 9 completa,
>    `B-4`; declarado por `DEC-METH-015`, FASE 9 completa). El reloj se escribe en `MODERATED` —el
>    hecho 5 alcanza a toda ficha del dueño— y, por la letra de los hechos 2, 4 y 5 (*«toda
>    ficha»*), también en `PURGED`. Sobre una ficha moderada, el aviso anuncia un archivado o un
>    borrado que `PB4`, `PB5` y `PB9` no van a ejecutar; sobre una purgada, algo que ya pasó.
>    **Causa**: los avisos leen la columna (`V/02` §2.5, lectores 4 y 5) y no el estado.
> 7. **El espacio entre el archivado y el borrado no está garantizado** (FASE 9 completa, `K-5`,
>    `B-2`, `B-3`; declarado por `DEC-METH-015`, FASE 9 completa). `PB9` exige `ARCHIVED`, así que
>    el **orden** se cumple siempre; el **espacio** no: `PB9` cuenta sobre `inactiva_desde` y no
>    sobre el instante del archivado, así que un `N` de `PB5` entre 180 días y 6 meses (`V/20` §2,
>    `G-R5-B`) o un job de `PB4`/`PB5` caído más que su plazo (`V/02` §4.1) dejan al borrado en la
>    corrida siguiente al archivado, sin el tiempo para exportar que el aviso supone. **Causa**: el
>    borrado se ató al reloj de la ficha y no al del archivado. Levantar una moderación larga ya no
>    es uno de estos casos: `PB11` reinicia el reloj (hecho 6).
> 8. **El empuje de *«la ficha llegó a `PURGED`»* no tiene transporte durable** (FASE 9 vuelta 1;
>    owner 2026-09-26, `G2-1`). Éste **sí puede mover plata**, y por eso se nombra aunque el
>    encabezado diga lo contrario: si el empuje de `PB9` o de `PB12` se pierde, `A6` corre recién
>    cuando el barrido diario de billing lee `fichaPurgada: sí` (contrato §4.1), y si el cobro
>    mensual de un destaque `LISTING` cae en ese día, entra. `S21` lo pone delante de una persona
>    con la marca del motivo 14. **La red es la consulta, no el empuje**, y un borrado que no pasa
>    por `PB9` ni por `PB12` ~~—el hard delete del admin, `F-8V1A1-003`—~~ **—desde `G5-2` el admin
>    no tiene ninguno (`NUCLEO/08` §3); el que queda es el borrado de la cuenta pedido por el propio
>    usuario, pendiente en `NUCLEO/08` §1, y `fichaPurgada` contesta `sí` sobre la fila que ya no
>    existe (FASE 9 vuelta 1, §4 punto 1 de `22-verificado-G2`)—** no empuja nada y depende
>    sólo de ella. **Un empuje emitido antes del commit no sería un empuje perdido de vez en
>    cuando: sería un empuje perdido siempre**, porque `A6` relee `fichaPurgada` y lee `no`; por eso
>    sale después del commit (contrato §3.1; FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`). **Causa**: el outbox del núcleo es de correos, y ningún hecho de verticales
>    tiene transporte durable (`12-contrato…` §3).

### Publicar ocupa cupo bajo un lock por `user + vertical`

FASE 8 completa, racimo `R14`: `F-8CA1-006`, `F-8CA2-010`, `F-8CA2-009`; owner 2026-09-25.

**El paso 7 del cap. 17 §1.2 contaba y la transición escribía después, sin nada en el medio.** Dos
`PB1` simultáneos leían el mismo conteo y publicaban los dos: con un plan de 3 quedaban 4, y en
`PRE_TRIAL` quedaban dos fichas en trial, contra el invariante 6 del cap. 04 (núcleo), *«máximo una
ficha en trial»*. El reconciliador de excedentes no se enteraba, porque se dispara cuando el
conjunto efectivo se recalcula (cap. 15 §4.2) y una carrera no recalcula nada. Y `PB1` contra
`PB2`: autorizado en t0, `PB2` baja las publicadas en t1, `PB1` escribe en t2 y la ficha queda
publicada sin cobertura, con el reloj reiniciado por el hecho 3.

> **Toda transición que ocupa cupo —`PB1`, `PB3` y `PB7`— toma un lock por `user + vertical` y
> cuenta dentro de él. `PB2` toma el mismo, en sus dos ramas.** Dos publicaciones simultáneas del
> mismo dueño en la misma vertical pasan una detrás de la otra, y la segunda cuenta lo que la
> primera escribió.

**Es la forma de la regla de concurrencia de `B/05` §2, `C1`, llevada a esta máquina**: *«el proceso
que suspende relee y reevalúa dentro de la misma transacción que escribe»*. Acá lo que se evalúa
dentro del lock son **los pasos 5 a 7** del cap. 17 §1.2 —fuente viva, conjunto efectivo y cupo—,
no sólo el 7, y eso es lo que hace que el mismo lock resuelva también la carrera contra `PB2`: si
`PB2` corre primero, `PB1` entra después, relee y ya no hay cobertura; si `PB1` corre primero,
`PB2` entra después y encuentra la ficha recién publicada entre las que baja.

- **Por qué `user + vertical`**: es el alcance del cupo —la resolución de entitlements y limits es
  por `user + vertical` (cap. 02 §3.1)— y el de `PB2`, que baja todas las fichas del dueño en la
  vertical. El cupo del trial es uno más de esos cupos, así que el invariante 6 queda cubierto sin
  regla aparte.
- **Los dos reconciliadores lo toman sin regla propia**: el de excedentes (cap. 15 §4.2) y el
  diario de cobertura (abajo) corren `PB2`, `PB3` y `PB7`, y el lock es de la transición, no de
  quien la dispare.
- **Las que liberan cupo no lo necesitan** —`PB4`, `PB6`, `PB10`, `PB12`—: una carrera con ellas
  sólo puede hacer que un conteo vea una publicada de más, y eso rechaza de más, nunca publica de
  más —**para `PB1`, `PB3` y `PB7`; para la rama del excedente de `PB2`, ver una de más baja una
  de más, y la devuelve el reconciliador diario** (⚠️ de abajo, punto 3; FASE 9 completa,
  `C-R14-1`)—.
- **Las que no ocupan ni liberan cupo lo toman si comparten `desde` con una que lo toma** (FASE 9
  vuelta 2, `F-8V2A2-004`). **`PB8` y `PB9`** salen de `ARCHIVED`, como `PB7`, así que lo toman y
  releen su `desde` adentro. `PB9` relee además el reloj y la cobertura, porque es la única
  irreversible y corre el mismo día que el aviso le imprime al dueño como fecha de borrado. Sin
  lock, `PB9` borraba sobre una lectura vieja el contenido que `PB8` o `PB7` acababan de
  devolver, y `PURGED` no tiene red. **`PB11` no lo toma**: es la única salida de `MODERATED`, y
  ninguna otra fila le disputa ese `desde`.
- **No es el lock distribuido que `B/05` §1 descarta.** Ese § lo descarta por *«el que lo toma y
  muere»*; éste vive dentro de la transacción que escribe y se suelta con ella. Con qué primitiva
  de la base se implementa es libertad de implementación.

**El reconciliador diario de cobertura queda como red** (`DEC-ARCH-009`): si igual quedan más
fichas en `PUBLISHED` que el cupo, su tercera fila corre la segunda rama de `PB2`, con hasta un día
de atraso.

> ⚠️ **Lo que esto NO cierra, declarado con su causa por `DEC-METH-015`**:
>
> 1. **Ningún guard verifica que las transiciones que ocupan cupo tomen el lock.** Un camino que lo
>    omita reabre la carrera, y la red es la del párrafo de arriba, con su día de atraso.
> 2. **El lock es de las transiciones de publicación, no de todo limit** (FASE 9 completa,
>    `R14-BORDE-1`; declarado por `DEC-METH-015`, FASE 9 completa). Las fotos, los destaques y la
>    cuota de un entitlement medido pasan el paso 7 del cap. 17 §1.2 sin lock, así que dos
>    escrituras simultáneas del mismo dueño pueden pasar el cupo en una unidad cada una. Y no hay
>    red, porque el reconciliador de excedentes se dispara por el recálculo del conjunto y no por el
>    conteo (cap. 15 §4.2). **Causa**: la decisión se tomó sobre los tres hallazgos del racimo, y los
>    tres son de fichas. Lo que se regala es cupo de una clave que el cliente ya paga.
> 3. **«Las que liberan no lo necesitan» vale para `PB1`, no para `PB2`** (FASE 9 completa,
>    `R14-BORDE-2`; declarado por `DEC-METH-015`, FASE 9 completa). Una carrera entre la rama del
>    excedente de `PB2` y un `PB6` o un `PB12` del dueño deja **una ficha abajo de más**. Y `PB4`
>    sin lock puede archivar una ficha que `PB3` acaba de republicar. Las dos las devuelve el
>    reconciliador diario de cobertura al día siguiente (su fila 2). **Causa**: el argumento se
>    escribió pensando en el conteo de `PB1`, que con una de más rechaza. Para `PB2`, con una de más
>    despublica. Ninguno de los dos casos publica de más ni borra.
> 4. **Dentro del lock, los pasos 5 y 6 pueden responder con el caché** (FASE 9 completa,
>    `R14-BORDE-3`; declarado por `DEC-METH-015`, FASE 9 completa) (cap. 02 §3.1), y ningún texto
>    ordena su invalidación respecto de `PB2`. Si `PB2` suelta el lock antes de que se invalide la
>    entrada, un `PB1` puede publicar sin cobertura. Lo baja la fila 1 del reconciliador diario al
>    día siguiente: el atraso es de un día, no los 90 de `F-8CA2-009`. **Causa**: el lock serializa
>    las escrituras, no las lecturas del caché.

### Cuáles vuelven, cuando el cupo no alcanza para todas

**`PB3` y `PB7` compiten por el mismo cupo**, se disparan con el mismo hecho y en el mismo
instante, y con cinco fichas abajo y lugar para tres **cuáles tres suben es una decisión de
visibilidad pública**. Dejarla en el orden en que una implementación recorra dos tablas es, con las
palabras del núcleo, *«exactamente la diferencia entre una máquina de estados y una convención»*.

> **El criterio es el inverso exacto del de bajada: vuelve primero la que cayó al final.** Como
> *«cae lo más reciente primero»* (`DEC-SUB-008`), eso es **la publicada menos recientemente entre
> las que están abajo**, y se sigue subiendo hacia las más recientes hasta llenar el cupo.

**Se elige el inverso y no un criterio propio por una razón que se puede verificar**: con él, el
conjunto que queda publicado **depende sólo del cupo y no del camino**. Quien bajó de cinco a dos y
volvió a cuatro termina con **exactamente** las cuatro que tendría si hubiera contratado cuatro de
entrada. Cualquier otro orden hace que el resultado dependa de por cuántos planes pasó, que es lo
contrario de predecible — y `V/15` §4.3 ya declaró por qué no se inventa un segundo criterio:
*«dos criterios distintos para la misma clase de problema es cómo se vuelve impredecible»*.

**Una ficha `PURGED` no es candidata**: no está en el `desde` de `PB3` ni en el de `PB7`, y no
cuenta para el cupo, así que ni ocupa lugar ni compite por él (`PB9`; FASE 8 completa,
`F-8CA2-008`, owner 2026-09-25).

**Qué cuenta para el cupo: las fichas en `PUBLISHED`, y ninguna otra** (FASE 8 completa, owner
2026-09-25; lo que el corpus ya asumía, dicho en un solo lugar). Es la lectura que sostienen todas
las filas que lo nombran: `PB2` **despublica** el excedente hasta entrar en el límite, `PB3` y `PB7`
**publican** hasta llenarlo, `DEC-SUB-008` plantea el caso como *«5 fichas publicadas que baja a un
plan de 3»*, publicar (`PB1`) es lo que **consume** un limit (`V/15` §3.4) y volver a `DRAFT` por
`PB8` **no cuenta contra ningún limit** (`V/02` §2.1). Así que `DRAFT`, `UNPUBLISHED_BY_BILLING` y
`ARCHIVED` **no ocupan lugar** —las dos últimas son candidatas que compiten por él— y `PURGED`, que
es final, **ni ocupa lugar ni compite**. **`MODERATED` tampoco**: no está en el `desde` de `PB3` ni
en el de `PB7`, así que ni ocupa lugar ni compite por él (`PB10`; FASE 8 completa, `F-8CA2-004`,
owner 2026-09-25).

**El origen NO desempata, y es deliberado.** Una candidata en `ARCHIVED` y una en
`UNPUBLISHED_BY_BILLING` entran en **la misma cola ordenada**, sin prioridad por el estado del que
vienen. Lo único que las separa es **cuánto tardó nuestro reloj en archivar una y no la otra**, que
es contabilidad nuestra y no algo que el dueño haya elegido; usarlo como criterio le haría depender
la visibilidad de un detalle que no puede ver ni predecir. `PB7` **sí** mira su origen, pero para
otra cosa: para no publicar el borrador de `PB5`, que nunca fue candidato.

**El dato con el que se ordena ya existe y no pide columna nueva**: cuándo se publicó cada ficha,
que es el mismo que la bajada necesita para decidir *«la más reciente»*. Sale del registro
append-only de eventos de dominio (cap. 08 §1.2 y §1.3, núcleo), igual que el origen que `PB7`
consulta.

**Y la ficha del corte, que no tiene ninguna publicación en ese registro, cuenta como publicada en
el instante del corte** (FASE 9 vuelta 1, `N-G1-01`). R1 le dio estado y reloj a toda ficha
preexistente, pero no el tercer dato que `UNPUBLISHED_BY_BILLING` consume: nació por la escritura
`C` de la migración (`V/21` §2.4), no por `PB1`, así que el criterio no la ordenaba y la ficha que
quedaba visible era la que la implementación recorriera primero. **La lectura es ésta, sin columna
nueva y sin escribir en el registro un evento que no ocurrió**: el instante de publicación de una
candidata es el de su último evento de publicación en el registro y, si no tiene ninguno, el de su
escritura `C` —el mismo instante que el corte le pone en `inactiva_desde`—. Así una ficha del corte
es siempre menos reciente que cualquiera publicada después del corte, que es lo que fue. **A igual
instante —todas las del corte de un mismo dueño lo comparten— desempata la fila más vieja**, por
`listing.created_at`, que el corte conserva del sistema viejo (`V/02` §2.5), **y después el id**: un
orden total, que el aviso de la fila 19 puede escribir como *«vuelven primero las que cargaste hace
más tiempo»*. **Una ficha del corte que el dueño publica por `PB1` pasa a tener su evento** y se
ordena por él, como cualquier otra.

**Y va escrito en el aviso, por la misma razón que el de bajada.** `DEC-SUB-008` lo dice y `V/19`
fila 8 lo obliga para el excedente: *«si el cliente no puede leerlo, deja de ser predecible y se
pierde el motivo por el que se eligió»*. El espejo es la **fila 19** de `V/19` §4 y su correo está
en el catálogo del cap. 07 §6 (núcleo). Las que no entran **no se borran** —su reloj se reinicia
igual, §4.2 regla 4 del cap. 02—, pero quedan abajo, y el dueño tiene que poder saber por qué.

### `ARCHIVED` tiene salida, y son dos porque hay dos maneras de volver

**El caso que las obliga es una pausa del catálogo.** Alguien toma la pausa más larga que le
vendemos —**4 pausas-mes**, unos 120 días (`B/03` §5)—. La pausa por `CUSTOMER_REQUEST` **no
emite fuente** (`12-contrato…` §2.6), así que `cubierto` pasa a falso, `PB2` baja la ficha, el
día 90 llega antes que el fin de la pausa y `PB4` la archiva. Antes de la 9-bis-3 **ninguna
fila de ninguna tabla del programa tenía `ARCHIVED` en su columna `desde`**, así que por la
regla 1 del cap. 03 §1 (núcleo) volver de ahí no era una operación: era un incidente. Y el reloj
seguía hasta el hard delete del día 180 (cap. 02 §4.1). El sujeto no era una ficha abandonada:
era la de un cliente que no canceló nada.

**`ARCHIVED` tiene además una tercera salida, que no es volver: `PB9`**, el hard delete del día
180, hacia `PURGED`, que es final (FASE 8 completa, `F-8CA2-008`, owner 2026-09-25). Las dos de
vuelta siguen siendo dos. **Y desde la misma pasada tiene dos más, que tampoco son volver**: `PB10`, a `MODERATED` por
un admin, y `PB12`, a `PURGED` por el dueño (FASE 8 completa, `F-8CA2-004`, owner 2026-09-25).

**Son dos filas y no una porque los dos caminos de vuelta no se pueden mezclar:**

| | `PB7` | `PB8` |
|---|---|---|
| quién la dispara | el hecho que el contrato empuja | el dueño |
| hacia dónde | `PUBLISHED` | `DRAFT` |
| desde qué origen | sólo si venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING` | cualquiera |
| para quién existe | el que pausó, el que recontrata, el que regularizó | el que quiere su ficha de vuelta sin pagar todavía, y el borrador que archivó `PB5` |
| con qué la autoriza | su fuente de clase `TÍTULO`, que es la que acaba de volver | **la versión de piso**, *«recuperar lo suyo»* (cap. 02 §2.1) — su población **no tiene ninguna otra** |

> 📌 **Cerrado el 2026-09-25** (FASE 8 completa, `F-8CA2-008`, owner 2026-09-25): el hard delete
> es la fila **`PB9`** y lleva la ficha a **`PURGED`**, un estado final. `PB7` sale de `ARCHIVED` y
> `PB3` de `UNPUBLISHED_BY_BILLING`, así que **ninguna de las dos la toma**; no entra en la cola
> de cuáles vuelven ni **cuenta para el cupo**, y el dato que la guarda pedía es el estado mismo,
> que escribe una transición —`G-R6` no tiene nada que objetar—. **Adónde va** la ficha es a
> `PURGED`, y el dueño ve que existió y que se borró por inactividad (cap. 19 §4 fila 20). Y como
> `PB9` exige `ARCHIVED`, una ficha en `UNPUBLISHED_BY_BILLING` no llega nunca vaciada a `PB3`.
>
> ~~⚠️ **Abierto desde la FASE 8 completa: `PB7` y `PB3` no distinguen una ficha que el hard delete
> ya vació** (`F-8CA2-008`; no resuelto acá).~~ El texto original, como registro: el hard delete del día 180 **no mueve el estado** —le
> borra el contenido y la deja en `ARCHIVED`—, y `PB7` sólo mira el origen. Si el dueño recupera
> la cobertura después del día 180, `PB7` publica una página vacía, y por el criterio de vuelta
> —*«la publicada menos recientemente»*, abajo— la vacía, que suele ser la más vieja, **ocupa el
> cupo antes que las intactas**. El hallazgo propone que la guarda de `PB3`/`PB7` excluya lo
> vaciado, y **no es mecánico**: pide un dato que diga *«el hard delete ya corrió sobre esta
> ficha»* —el hard delete no es una transición, así que una guarda que lo leyera cae bajo `G-R6`
> (`V/20` §2)—, y pide decidir adónde va esa ficha si no vuelve. El núcleo ya lo dice de un solo
> lado: el correo de la reapertura avisa *«que el contenido no vuelve»* (`NUCLEO/07` §6), sin
> decir si la ficha sí. ~~Queda para el owner.~~

**`PB7` no puede ignorar el origen, y ésa es toda la razón por la que lo mira.** A `ARCHIVED` se
entra por dos puertas: `PB4`, desde una ficha que estaba a la vista, y `PB5`, desde un
**borrador** que su dueño nunca publicó. Una vuelta automática que no las distinguiera
**publicaría el borrador de alguien que nunca pidió publicarlo** el día que recupera cobertura.
Es exactamente la razón por la que `UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT`,
una puerta más adentro.

**Y el origen no necesita ninguna columna nueva: ya está escrito.** El evento de dominio de
`PB4` y el de `PB5` guardan *«los campos que cambiaron, con su valor anterior y el nuevo»*
(cap. 08 §1.2, núcleo) sobre un registro **append-only** (§1.3). Preguntarle al registro de
verticales por un hecho de verticales es el mismo mecanismo que `T7` usa para *«ya ejerció el
evento de activación»* (§2), y por el mismo motivo: el dato existe, es duradero y no hay que
pedírselo a nadie. Una columna denormalizada es libertad de implementación, nunca una segunda
fuente.

**Las dos reinician el reloj, y `PB7` ni siquiera hace falta que dispare para que se reinicie.**
El hecho que reinicia la inactividad es **la cobertura comprobada verdadera** (cap. 01 §1.2,
núcleo, hecho 2) —un estado leído, no un cambio detectado, que es por lo que cualquiera que actúe
sobre el reloj lo puede comprobar en el momento de actuar—, no la transición: si el cupo no alcanza
y la ficha se queda abajo, el reloj se reinicia igual. Atarlo a `PB7` habría dejado el borrado vivo justo para el que vuelve con un plan más
chico.

**Qué queda del caso de la pausa, medido y no estimado.** El reloj **no se detiene** durante la
pausa —verticales no sabe que hay una pausa, y el §4 del contrato con `DEC-TRIAL-008` deciden que
no lo sepa—, así que la ficha **sí** se archiva el día 90. Lo que ya no pasa es lo caro: al
reanudar, `cubierto` vuelve a verdadero, el reloj se reinicia y `PB7` la republica sola. Entre el
primer día de la pausa y ese reinicio hay **120 días** contra los **180** del borrado, y las
pausas encadenadas no acumulan porque cada reanudación reinicia. Que las dos cifras sigan en ese
orden es `D16` (cap. 04 §3, núcleo), no una cuenta que alguien tenga que rehacer.

**Y la cuenta mide desde el primer día de la pausa porque `PB2` escribe el reloj ese día** (hecho 5
del cap. 01 §1.2, núcleo; FASE 8 completa, `F-8CA2-001`, `F-8CA3-001`, owner 2026-09-25). Hasta
entonces no lo escribía nadie: el reloj guardaba el último reinicio, que la relectura de `PB4` pone
cada 90 días sobre una ficha publicada y cubierta, y con 85 días de antigüedad al pausar la ficha se
archivaba el día 5 de la pausa y se borraba el día 95. ~~**Vale para la ficha que estaba publicada
cuando la pausa empezó**; la que ya estaba abajo no pasa por `PB2` y queda abierta en el cap. 01
§1.2 (núcleo).~~ **Vale para toda ficha del dueño en esa vertical** (FASE 8 completa, owner
2026-09-25): la que ya estaba abajo —el borrador, la excedente— no pasa por `PB2`, y el mismo
instante se lo escribe el recálculo que el aviso despierta (cap. 01 §1.2, núcleo, hecho 5). ~~Lo que
queda abierto allá es el disparo —el aviso perdido y el aviso repetido—, no el alcance.~~ **El
aviso perdido tiene red desde `DEC-ARCH-009`**: el reconciliador diario de cobertura (abajo) corre
`PB2` y escribe el hecho 5 hasta un día después, salvo para el dueño ~~que sólo tiene borradores~~
**sin ninguna ficha publicada** (⚠️ del reconciliador, punto 1; FASE 9 completa, `B-1`). Lo
que queda allá es el aviso repetido, que el owner aceptó, no el alcance.

**Tres cosas que estas dos filas NO son, y conviene decirlas porque cada una toca un arreglo de
esta misma tanda:**

1. **`PB7` no es el evento de activación, y no consume ningún trial.** El evento que `T1` y `T7`
   miran es *«el dueño publica»*, que es `PB1` — un acto suyo. `PB3` ya republicaba sin ser `PB1`
   y `PB7` hace lo mismo un estado más atrás: **restituir no es publicar**. Leerlo al revés le
   quemaría el trial a quien reanuda una pausa. **`PB1` desde `UNPUBLISHED_BY_BILLING` sí es
   publicar**: es un acto del dueño, y por eso es el evento que `T1` mira. Lo que no es publicar
   es que la ficha vuelva sola (FASE 9 vuelta 1, R1). **Para la guarda de `T8`, en cambio, la vuelta
   bajo un título que paga cuenta como ejercicio del evento**, y el trial lo consume el primer cobro,
   no la vuelta (§2; owner 2026-09-27, FASE 9 vuelta 2, `R15`).
2. **Ninguna de las dos comparte par con otra fila.** Salen las dos de `ARCHIVED`, pero sus
   eventos son distintos —el cambio de `cubierto` y el acto del dueño—, así que cada par tiene
   **una sola** fila y **`PB7`/`PB8` no agregan ninguno** a los pares con dos destinos, que desde la
   FASE 9-bis-4 son **cuatro** —el cuarto es `S10`/`S25` (`NUCLEO/03` §1 regla 7)—. Es el mismo caso que
   `T7`, y está anotado en la regla 7 del cap. 03 §1 (núcleo). **`PB9` tampoco agrega ninguno**:
   sale también de `ARCHIVED`, pero su evento —el día 180 de inactividad— no lo declara ninguna
   otra fila (FASE 8 completa, `F-8CA2-008`).
3. **`PB7` no es una transición de la clase del reloj**, así que no la alcanza la propiedad
   *«nunca otorga»* del cap. 17 §3.4. Las de esa clase en esta máquina son `PB4` ~~y `PB5`, y las
   dos~~ , `PB5` y **`PB9`** (FASE 8 completa, `F-8CA2-008`), y las tres **quitan**; a `PB7` la disparan **un cambio de cobertura o un cambio de cupo**, igual que a
   `PB3`. **Ninguno de los dos es el reloj**: los dos son el recálculo del conjunto efectivo de un
   `user + vertical` (cap. 15 §4.2), que lo dispara un acto —el de la persona o el de billing— y
   no el paso del tiempo.

**Y la mitad `PUBLISHED` del `desde` de `PB4` deja de ser letra muerta con el término definido.**
Una ficha publicada y cubierta no acumula inactividad, así que esa mitad sólo alcanza a una ficha
que quedó **publicada sin cobertura** — ~~el caso que `DEC-MIG-004` mide como defecto 1, *«`PB2` no
dispara la mañana del corte y la cartera queda publicada sin cobertura»*~~ **una ficha publicada sin
cobertura que el reconciliador diario todavía no bajó** (FASE 9 completa, `C-7`: desde
`DEC-ARCH-009` la cartera del corte la baja la primera corrida del reconciliador, dentro del primer
día, y no `PB4`). Es la red, y por eso se queda.

### El reconciliador diario de cobertura: el aviso es rápido, el reconciliador es la red

`DEC-ARCH-009` (owner 2026-09-25; FASE 8 completa, racimo `R10`: `F-8CA2-002`, `F-8CC1-005`,
`F-8CA1-007`, `F-8CC1-009`).

**Vive acá y no en el cap. 15 §4, y la razón es qué ejecuta.** Lo que hace es correr `PB2`, `PB3` y
`PB7`, que son filas de esta tabla, y escribir `listing.inactiva_desde` e invalidar el caché, que
son del cap. 02 §2.5 y §3.2. El cap. 15 §4.2 define **el reconciliador de excedentes**, que se
dispara por el recálculo del conjunto efectivo y **sólo** por él; ponerle al lado una pieza que se
dispara por calendario y que hace además la primera rama de las tres transiciones confundiría dos
piezas que el corpus ya nombra *«el reconciliador»* con un solo sentido. Por eso éste lleva nombre
propio —**el reconciliador diario de cobertura**— y lo construye **V6**, la unidad de esta tabla
(`descomposicion.md` §2).

**Qué agujero tapa.** El aviso *«la cobertura de (user, vertical) cambió»* (`12-contrato…` §3) es
lo único que billing le empuja a verticales y no tiene transporte durable. Tres cosas quedaban sin
red: **(1)** si se perdía el aviso de que la cobertura **volvió**, `PB3`/`PB7` no disparaban, `PB4`
releía, encontraba al dueño cubierto y **reiniciaba el reloj sin republicar**, y el dueño no tiene
transición propia para salir de `UNPUBLISHED_BY_BILLING` —~~`PB1` sale sólo de `DRAFT`~~ `PB1` sale
de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial (FASE 9 vuelta 1, R1)—: pagaba y
sus fichas no se veían, sin límite (`F-8CA2-002`, `F-8CC1-005`); **(2)** una fuente con `hasta:
fecha` que deja de emitirse porque la fecha pasó **no es una transición**, así que no produce aviso
ni invalida el caché (`F-8CA1-007`, `F-8CC1-009`); **(3)** si se perdía el aviso de la caída, nadie
escribía el hecho 5 del cap. 01 §1.2 (núcleo).

> **Una vez por día, el reconciliador le pregunta al contrato por cada dueño de la población, lo
> compara con el estado de sus fichas y, si no coinciden, corre la transición que el aviso habría
> disparado** —que relee su condición dentro del lock (FASE 9 vuelta 1, `F-8V1A2-008`)—. Tapa los tres agujeros sin importar por qué hay diferencia —aviso perdido, fecha
> vencida o un camino que nadie previó—, porque se apoya en la pregunta y no en un mensaje.

**La población**: todo `user + vertical` con al menos una ficha que **no** esté en `DRAFT` ni en
`PURGED` **ni en `MODERATED`** —o sea, en `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED`—. `DRAFT` queda afuera
porque ninguna transición del sistema lo publica (`PB1` es un acto del dueño); `PURGED`, porque es
final; **`MODERATED`, porque ninguna transición del sistema la saca de ahí —sólo un admin, con
`PB11`— y no cuenta para el cupo** (FASE 8 completa, `F-8CA2-004`, owner 2026-09-25).

**Y todo `user + Partner` ~~con presencia cargada~~ con una clave de presencia, que no tiene
fichas** (FASE 8 completa, `R13`: `F-8CA1-005`, `F-8CA2-005`, `F-8CA3-006`; owner 2026-09-25).
**Desde la FASE 9 completa las claves de presencia son dos** —la página propia, que otorga Gold, y
el carrusel, que otorgan Gold y Silver (`V/18` §1.6; owner 2026-09-25, decisión 7b)—, y la
población se lee sin la entidad del contenido, que no está declarada (`V/18` §1.6, ⚠️ punto 2):
**todo `user + Partner` cuya entrada del caché otorga alguna de las dos claves, o que tiene en
Partner una fuente de clase `TÍTULO`** (FASE 9 completa, contradicción 3 del informe `08`). La presencia de Partner ~~Gold~~ no tiene
máquina: su lectura pública pregunta por el entitlement ~~de presencia~~ **de su superficie** (FASE 9 vuelta 1, `F-8V1A1-004`) desde el caché (`V/18` §1.6),
y la invalidación de esa entrada la llevan el aviso y este reconciliador. Para ese `user + vertical`
**no corre ninguna transición**: resuelve en vivo si el conjunto efectivo otorga ~~la presencia~~
cada una de las dos claves, lo compara con la entrada del caché y, si no coinciden, **la invalida**.
**El bit de moderación de la presencia no es de este reconciliador** (`V/18` §1.6, decisión 7c): lo
escribe un admin y la lectura lo lee en vivo, no desde el caché. Es lo que cubre la fecha que
vence sin transición para quien no tiene fichas, que el punto 2 del ⚠️ de abajo deja afuera para
el resto.

**La pregunta** es la del `12-contrato…` §2.1: `cubierto`, y el cupo que el cap. 15 resuelve sobre
`fuentes`. **Se hace en vivo y nunca contra el caché**: el caché es justamente lo que puede estar
viejo (`F-8CA1-007`).

**Qué compara, y qué corre en cada diferencia:**

| lo que encuentra | qué corre | qué escribe en `listing.inactiva_desde` |
|---|---|---|
| `cubierto` **falso** y al menos una ficha en `PUBLISHED` | **`PB2`, primera rama**, sobre cada ficha publicada | el **hecho 5**: `PB2` sobre la publicada, y el reconciliador sobre las demás fichas del dueño en la vertical, **en el mismo acto** |
| `cubierto` **verdadero**, menos fichas en `PUBLISHED` que el cupo, y candidatas en `UNPUBLISHED_BY_BILLING` o en `ARCHIVED` con el origen que `PB7` exige | **`PB3`** / **`PB7`**, por la rama que corresponda, con el criterio de *«cuáles vuelven»* de arriba | el **hecho 2**, en todas las fichas del dueño en la vertical; la que vuelve a `PUBLISHED` recibe además el **hecho 3**, que es de la propia transición |
| `cubierto` **verdadero** y más fichas en `PUBLISHED` que el cupo | **`PB2`, segunda rama** (el excedente) | **nada**: la cobertura sigue verdadera y esa rama no es ningún hecho (cap. 01 §1.2, núcleo) |
| ninguna de las tres | nada | nada |

Y cuando corre algo, **invalida ~~la entrada del caché de ese `user + vertical`~~ las entradas del
caché de ese `user`, en todas sus verticales** (cap. 02 §3.2, regla 3: la invalidación es por
`user`; owner 2026-09-25, FASE 9 completa, decisión 8a).

**Es un ejecutor adicional, y la distinción entre hecho y ejecutor es lo que hace que no mueva
nada más.**

- **De las transiciones.** `PB2`, `PB3` y `PB7` no ganan filas ni cambian su evento: el de la
  primera rama de cada una sigue siendo **el cambio** de `cubierto` (el ⚠️ del cap. 01 §1.2,
  núcleo), y la diferencia que el reconciliador encuentra —una ficha publicada sin cobertura, o
  abajo con cobertura y cupo— es **la huella de un cambio que no se entregó**. Así que `G-R4` no
  gana ningún par. **Y no son de la clase del reloj** (cap. 17 §3.4), aunque el reconciliador corra
  por calendario: el calendario decide **cuándo mira**, no cuál es el evento. Las de esa clase son
  las que tienen **al tiempo como evento** —`T3`, `PB4`, `PB5` y `PB9`—, así que `G-R3-B`, que
  lee las tablas, no ve ninguna transición nueva que otorgue. Sobre quién se evalúan los pasos 5–7
  cuando las corre él lo declara el cap. 17 §3.4.
- **De los hechos del reloj.** Escribe el **2** y el **5** del cap. 01 §1.2 (núcleo) —**y el 4 en
  la corrida del fin de servicio de una vertical** (abajo; owner 2026-09-27, FASE 9 vuelta 2,
  `R5`)— y **ningún hecho nuevo**: la lista sigue en ~~cinco~~ **seis** —el sexto, `PB11`, lo agregó la FASE 9
  completa (decisión 5b), no este reconciliador—, más la escritura `C` del corte, y `G-R6-B` mitad *(a)* lo
  admite por la lista. Lo que crece es la cuenta de ejecutores: el **2** pasa a tener **cuatro** y
  el **5**, **tres** (cap. 02 §2.5). **No lee `listing.inactiva_desde`** —compara estados de ficha,
  no el reloj—, así que los **seis** lectores del cap. 02 §2.5 no se mueven, y la mitad *(b)* no
  tiene nada que objetar. `G-R6` tampoco: el reconciliador no es una transición y no agrega ninguna
  condición que lea una columna.
- **De «fila viva»** (`NUCLEO/01` §2.4). No es consumidor: le pregunta al contrato y **nunca lee una
  fila de billing**, que es donde viven todos los consumidores de ese inventario.

**Por qué el hecho 5 se escribe sólo junto con `PB2`, y no cada vez que lee `cubierto` falso.** La
ficha publicada **es** la memoria de que antes había cobertura: `PB2` la encuentra una sola vez, la
baja, y al día siguiente ya no hay diferencia. Sobre una ficha que ya estaba abajo no hay estado
que lo recuerde, y escribir el hecho 5 cada vez que la relectura trae falso **correría el reloj
todos los días**: ninguna ficha de un dueño sin cobertura llegaría nunca al archivado ni al día
180. Es el goteo que el ⚠️ punto 3 del cap. 01 §1.2 (núcleo) acepta que no ocurre porque los
avisos son los de un cambio; con un disparo diario ocurriría, así que la regla de la tabla es la
que lo impide.

**El vigía es el del barrido de billing** (`B/09` §7.1): el mismo monitor de cron externo, con la
misma regla —el reconciliador le hace ping al terminar una corrida completa y el monitor alerta si
pasan 26 h sin ping—. Si el reconciliador no corre, las tres redes se apagan a la vez y en
silencio, que es el mismo modo de falla que ese § le reprocha al barrido. Lo que ese § deja abierto
del vigía —la elección concreta, si el plan contratado lo incluye y por qué canal llega la alerta—
vale igual acá.

**El costo aceptado es de `DEC-ARCH-009`: hasta un día de atraso** en todo lo que el aviso no
cubrió. El instante que escribe es el de la corrida y no el del cambio, así que en el reloj el
atraso cae del lado que **atrasa** el borrado, nunca del que lo adelanta.

> ⚠️ **Lo que el reconciliador NO cierra** (declarado con su causa por `DEC-METH-015`; ~~ninguno
> mueve plata en el camino principal, da acceso indebido en él ni borra datos~~ **ninguno mueve
> plata ni da acceso indebido en el camino principal, y el único que puede adelantar un borrado
> —el punto 1— necesita un aviso perdido**; FASE 9 completa, residuo `α` del informe `06`):
>
> 1. ~~**El dueño que sólo tiene borradores está fuera de la población.** Si se pierde el aviso de
>    su caída, nadie le escribe el hecho 5 a sus fichas en `DRAFT`: no hay ficha publicada que
>    delate la diferencia. Su red sigue siendo la relectura de `PB5` y la de `PB9` sobre el reloj
>    viejo, como antes de este §.~~ **El dueño sin ninguna ficha en `PUBLISHED` en el momento de la
>    caída no tiene red para el hecho 5** (FASE 9 completa, `B-1` y `α`; declarado por
>    `DEC-METH-015`, FASE 9 completa). Si se pierde el aviso, el reconciliador no encuentra una
>    ficha publicada que delate la diferencia y no escribe el hecho 5 —sólo lo escribe junto con
>    `PB2`, por la razón de arriba—. Alcanza al que sólo tiene borradores, que además está fuera de
>    la población, **y al que tiene todas sus fichas en `UNPUBLISHED_BY_BILLING`, `ARCHIVED` o
>    `MODERATED`**, que está adentro. Su red sigue siendo la relectura de `PB4`, `PB5` y `PB9`
>    sobre el reloj viejo, **y eso puede adelantar el borrado del día 180**: el reloj de una ficha
>    `ARCHIVED` de un dueño cubierto puede tener hasta 180 días, porque `PB9` lo reinicia al
>    releer. **Causa**: la fila compara estados de ficha, y la ficha publicada es la única que
>    guarda la memoria de que hubo cobertura (cap. 01 §1.2, núcleo, ⚠️ punto 3).
> 2. ~~**La fecha que vence sin transición se corrige sólo si produce una diferencia de fichas.**~~
>    **Una diferencia que no mueve fichas no invalida el caché**, venga de una fecha que vence sin
>    transición o de una transición cuyo aviso se perdió (FASE 9 completa, `β`; declarado por
>    `DEC-METH-015`, FASE 9 completa). Si el dueño no tiene ninguna ficha publicada, o no está en
>    la población, o la persona no tiene fichas, **o el cambio sólo toca capacidades que no son
>    cupo**, el reconciliador no encuentra nada y **no invalida**: la entrada del caché sigue
>    otorgando hasta el próximo evento de la lista del cap. 02 §3.2, hasta que corra el job
>    atascado (`S12`, `S10`/`S25`, `T3` o el de un addon `DÍAS_FIJOS`) o hasta que venza la red de
>    tiempo. **Causa**: el reconciliador compara estados de ficha, no conjuntos efectivos. Pasa
>    sólo cuando esa primera línea falla: **el fin de servicio de una vertical ya no es uno de estos
>    casos**, porque lo invalida ~~el barrido del día~~ este reconciliador en la corrida de ese día
>    (abajo, *«el día del fin de servicio»*; cap. 02 §3.2; owner 2026-09-25, decisión 6b; el
>    ejecutor, owner 2026-09-27, FASE 9 vuelta 2, `R5`).
>    **La excepción es la presencia de Partner**, que no tiene fichas y sí está en la población desde
>    `R13` (arriba): ahí el reconciliador compara el entitlement y no el estado de fichas.
> 3. **La máquina de trial no la corre.** `DEC-ARCH-009` nombra `PB2`, `PB3` y `PB7`. Si se pierde
>    el aviso de un título que aparece durante el trial **—o, desde `DEC-TRIAL-010`, el del primer
>    pago acreditado de su suscripción, que es el que ahora convierte (`12-contrato…` §3)—**, `T2`
>    no dispara y la persona tiene dos títulos —su plan y el del trial— hasta que `T3` vence el
>    trial; si se pierde durante `TRIAL_EXPIRED`, `T5` no corta la campaña de recuperación. **El
>    reconciliador no se desalinea por `cobrada`**: compara `cubierto` y el cupo contra las fichas,
>    y `cobrada` no mueve ninguno de los dos (`12-contrato…` §2.1). **Y, desde 6c, si se pierde el
>    del primer pago de quien publicó en `PRE_TRIAL` con una suscripción sin cobrar, `T8` no
>    escribe la fila consumida y nadie la escribe después**: si alguna vez publica sin cobertura,
>    `T1` le arranca un trial siendo alguien que ya fue cliente. Necesita un aviso perdido y una
>    segunda publicación sin cobertura, y regala un trial, no cobra (FASE 9 vuelta 1,
>    `F-8V1C1-010`; declarado por `DEC-METH-015`). **Lo mismo cuando lo que se pierde es el aviso
>    del alta de quien no publicó** (FASE 9 vuelta 2, `R15`): la ficha la sube el reconciliador al
>    día siguiente, después del primer cobro, y `T8` ya despertó sin ver ninguna vuelta. Su evento
>    ocurre una sola vez, así que la vuelta bajo un título que paga no la consume nadie. **Causa**:
>    la misma, que el reconciliador no corre la máquina de trial.
> 4. **No sabe por qué el cupo alcanza.** Si el dueño libera un lugar con `PB6`, al día siguiente
>    encuentra candidatas y cupo y corre `PB3`/`PB7`. Es la letra de la segunda rama de las dos
>    —*«el cupo vuelve a alcanzar sin que `cubierto` cambie»*— y el riesgo de republicar lo que el
>    dueño no quería está aceptado por `DEC-DATA-003` (cap. 15 §4.4).

### El día del fin de servicio: billing avisa, verticales ejecuta

Owner 2026-09-27, FASE 9 vuelta 2, `R5` (`F-8V2A3-001`, `F-8V2C1-001`). **Este texto vivía en
`B/10` §4.3**, que le mandaba al barrido de billing del día del fin de servicio correr `PB2`,
escribir `listing.inactiva_desde` en cada ficha de la vertical e invalidar el caché. Eran tres
escrituras de billing en verticales, y el contrato admite una sola, `extenderTrial`
(`12-contrato…` §4.1 y §4.2). Un constructor que respetara el contrato no escribía el hecho 4, y
otro que respetara el capítulo escribía en tablas de verticales sin contrato. **Ahora billing sólo
avisa y verticales ejecuta.**

**Billing calcula la fecha y corta la cobertura.** La fecha sale de la fórmula de `B/10` §4.3 y
verticales la lee por la pregunta `finDeServicio(vertical)` del contrato §4.1. Desde esa fecha el
contrato no emite en la vertical ninguna fuente de título (`12-contrato…` §2.6), y las
suscripciones que `S26` llevó a `CANCEL_SCHEDULED` consuman su `CANCELLED` con el aviso que ya
emiten. Nada más cruza.

**Verticales lo ejecuta en el reconciliador diario de cobertura** (arriba), en su primera corrida
con la fecha cumplida. No es un reloj nuevo: es la pieza que ya corre por calendario, ya corre
`PB2`, ya escribe hechos del reloj y ya invalida el caché. Esa corrida hace tres cosas sobre la
vertical:

1. **Corre `PB2`, primera rama**, sobre cada ficha publicada, con el hecho 5 en las demás fichas del
   dueño. No es una fila nueva de la tabla de comparación: el dueño aparece con `cubierto` falso y
   fichas publicadas, que es su primera fila. Si el aviso de una `S12` llegó antes, ya no queda
   diferencia y no corre nada.
2. **Escribe el hecho 4 en cada ficha de la vertical**, publicada o no, con **el instante del fin de
   servicio** y no el de la corrida. Escribe sólo sobre la ficha cuyo `inactiva_desde` es anterior a
   ese instante, así que una segunda corrida no pisa un hecho posterior y repetirla da lo mismo.
3. **Invalida las entradas del caché de la vertical entera** (cap. 02 §3.2, fila *«llega el fin de
   servicio»*): el grant, la cortesía y el trial dejan de otorgar sin que ninguna fila suya
   transicione, así que ninguna otra fila de invalidación ocurre.

**Y el recorrido es sobre la vertical, no sobre la población.** La población del reconciliador deja
afuera `DRAFT` y `MODERATED`, y el hecho 4 alcanza también a los borradores, porque sobre ellos
corre `PB5`. Esa corrida recorre todas las fichas de la vertical una vez.

**Por qué arranca el reloj ahí, no antes** (movido de `B/10` §4.3). El fin de servicio de una
vertical discontinuada es el cuarto de los hechos que reinician la inactividad (cap. 01 §1.2,
núcleo). Contar su ausencia desde antes lo castigaría por una decisión nuestra, aunque el dueño
lleve meses sin tocar la ficha. Tres precisiones, cada una para una lectura que sale mal:

1. **La escritura es del reconciliador, no de `PB2`.** `PB2` escribe el hecho 5 sobre la ficha que
   baja, y el recálculo del aviso o el reconciliador lo escriben en las demás fichas del dueño que
   ese día pierde la cobertura. Sobre ése, el 4 y el 5 escriben el mismo instante, porque el
   contrato corta la cobertura en la fecha de fin de servicio. **El 4 sigue haciendo falta por el
   dueño que ese día ya estaba sin cobertura**: sobre él no ocurre ningún 5.
2. **No es un escritor de más.** Es el hecho 4 de la lista cerrada del cap. 01 §1.2 (núcleo), así
   que `G-R6-B` mitad *(a)* lo acepta por la lista: la lista cierra hechos, y cada hecho puede tener
   su ejecutor. **Cambió el ejecutor, no el hecho**: era el barrido de billing y ahora es el
   reconciliador, y la lista sigue en seis.
3. **Sin ella el borrado se adelanta hasta 90 días.** Entre dos evaluaciones de `PB4` hay 90 días,
   así que la fecha que la columna trae ese día puede tener esa antigüedad. El hard delete caería en
   `fin_de_servicio + 90` en vez de en `+ 180`, sobre una población a la que **los tres avisos de
   `DEC-MP-002` le dijeron cómo exportar** y hasta cuándo.

**El costo es el de siempre de este reconciliador: hasta un día.** Si la corrida de ese día cae
antes del instante de la fecha, lo ejecuta la del día siguiente, y mientras tanto el caché puede
seguir otorgando capacidades de la vertical cerrada. El barrido de billing que lo hacía antes
también era diario, así que no se pierde nada. El hecho 4 no se atrasa, porque escribe el instante
de la fecha y no el de la corrida. Si el reconciliador no corre, lo avisa el monitor de cron
externo (arriba, *«el vigía»*).

---

## 11. Postulación de Partner

**Es la novena**, agregada al escribir el capítulo 18 (ver la nota del cap. 01 (núcleo) §2.2). Chica, sin
ciclos y sin vuelta atrás.

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| PP1 | — | alguien completa el formulario del §17.3 | `PENDIENTE` | sólo el camino A; el camino B no crea postulación. **Y sólo si no hay otra postulación `PENDIENTE` del mismo correo, ni una `RECHAZADA` del mismo correo dentro de la espera configurable** (FASE 9 vuelta 1, `F-8V1A2-005`) **que el admin no haya anulado. La guarda es una restricción de la base, no un chequeo**: dos envíos simultáneos no pasan los dos (cap. 02 §2.7, cap. 18 §2.2; owner 2026-09-27, FASE 9 vuelta 2, `R7`) |
| PP2 | `PENDIENTE` | el admin aprueba | `APROBADA` | **no vincula nada todavía**: si el correo ya es de un usuario, se le manda a **esa** dirección un aviso para reclamarlo (cap. 18 §2.4) |
| PP3 | `PENDIENTE` | el admin rechaza | `RECHAZADA` | **se comunica** (§17.3); ~~habilita postular de nuevo pasada la espera configurable~~ la espera la mira `PP1` (FASE 9 vuelta 1, `F-8V1A2-005`) |

**Ninguna transición la dispara el tiempo.** Una `PENDIENTE` que nadie resuelve **no vence**: se
marca atrasada en el panel del §48, porque vencerla sería un rechazo silencioso y el §17.3 exige
que el rechazo se comunique. Una `APROBADA` que nadie reclama tampoco vence, y es inofensiva: la
suscripción es el último de los nueve pasos del §17.3, así que no publica nada y no se le cobra
nada.

**Reclamar no es una transición de esta máquina**: es el acto que vincula el Partner a un usuario
(cap. 18 §2.4) **—el de la sesión que reclama (owner 2026-09-27, FASE 9 vuelta 2, `R7`)—**, y la
postulación sigue `APROBADA`. **Anular la espera tampoco es una transición**: la `RECHAZADA` sigue
`RECHAZADA`, y lo que cambia es la guarda que `PP1` lee (cap. 02 §2.7). El panel lee *«aprobada sin reclamar»* como
`APROBADA` sin ese vínculo: un dato, no un estado. Dónde vive el vínculo lo declara `V/02` ~~junto
con el resto de la cuenta de Partner~~ **§2.7: es `partner.owner_user_id`, nulo hasta el reclamo, y
la postulación `APROBADA` apunta a su Partner por `partner_id`** (FASE 9 vuelta 1, `F-8V1A2-005`;
la sección se escribió en la misma vuelta, porque la delegación no tenía texto del otro lado).
