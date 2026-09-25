---
title: "FASE 9 completa · R12 y R14 — el trial que se convierte con el pago, y los cupos bajo lock"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R12 y R14

`DEC-METH-004` pide dos cosas para dar un racimo por resuelto: que el camino de cada hallazgo,
reejecutado sobre el texto **corregido**, ya no llegue, y que la regla corregida se verifique contra
**todo** el dominio que cuantifica. Este documento hace las dos cosas para `R12` (el trial y el
primer ciclo) y `R14` (los cupos). Los residuos se clasifican con `DEC-METH-015`.

**Este documento no edita nada.** Todas las correcciones se proponen; las aplica el orquestador.
Todas las citas se verificaron con `rg -n` sobre el texto del 2026-09-25.

Abreviaturas de rutas: `V/` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B/` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, `NUCLEO/` es `HOS-1352-…/docs/nucleo/`, y lo que no
lleva prefijo es `HOS-1352-…/docs/`.

| racimo | hallazgos | DEJA DE LLEGAR | SIGUE LLEGANDO | LLEGA A OTRA COSA | dominio | OK | declarado | residuo nuevo |
|---|---|---|---|---|---|---|---|---|
| R12 | 10 | 8 | 0 | 2 | 69 | 51 | 7 | 11 |
| R14 | 3 | 2 | 0 | 1 | 19 | 13 | 1 (el guard, fuera del recuento) | 6 |

(Los recuentos del dominio salen del script del §R12.4 y del §R14.4, no de una suma a mano.)

---

## R12 · El trial se convierte con el primer pago acreditado

### R12.1 La regla corregida, tal como quedó

Son cuatro piezas y viven en cuatro lugares.

**1. La conversión espera el cobro.** `V/03-maquinas-de-estado.md:45` (`T2`):

> **aparece un título que convierte**: una fuente viva de clase `TÍTULO` que no es la del trial
> **y que, si es de `tipo: SUSCRIPCIÓN`, trae `cobrada: sí`** —sea porque aparece así o porque una
> ya presente pasa a `sí` con su primer pago acreditado—

`T5` repite la condición (`V/03:48`). El campo lo define el contrato, `12-contrato-de-cobertura.md:118`:

> | **`cobrada`** | en una fuente `SUSCRIPCIÓN`, si **esa fila** tiene **al menos un pago acreditado**

**2. Suscribirse termina el trial.** `V/11-trial.md:441-442`:

> **Suscribirse durante el trial termina el trial.** Si el primer cobro sale bien, **los días que
> quedaban se pierden**

y `V/11:451`: *«**Si el primer cobro se rechaza, el trial sigue**, con los días que le quedaban.»*

**3. El primer rechazo es de `S16`, y `S16` cancela de nuestro lado.** `B/03-maquinas-de-estado.md:191-193`:

> **Sobre una autorización sin ningún pago acreditado manda `S16`** […] **`S4` exige que la fila
> tenga al menos un pago acreditado**, y **el espejo de un `cancelled` sobre una fila `ACTIVE` sin
> ningún pago acreditado le cede el paso a `S16`** (§10.1).

y la fila `S16`, `B/03:143`: *«**Ya no exige que el proveedor la haya cancelado**»* … *«**se cancela
el preapproval DE NUESTRO LADO, con la regla de relectura de `S17`**»*. La pregunta abierta quedó
en la matriz como `PA-6` (`06-mp-validation-matrix.md:176`), marcada *«**No bloquea**»*.

**4. Un complemento no suma sobre un trial.** `V/15-entitlements-y-limits.md:134-136`:

> **El conjunto plegable de un `user + vertical` son sus fuentes de clase `TÍTULO` y `BASE`, más
> las de clase `COMPLEMENTO` SÓLO SI hay al menos una de clase `TÍTULO` viva que NO sea de
> `tipo: TRIAL`.**

con su guard en `V/20-testing.md:57` (`G-R2`, *«**que no sea de `tipo: TRIAL`**»*) y el objetivo
`LISTING` cortado en la compra, `B/03:2364` (`A1`): *«**con scope `LISTING`, el objetivo no puede ser
una ficha de una vertical cuyo único título es un trial**»*.

**5. El corte siembra trials consumidos.** `V/21-migracion.md:209-211`:

> **El corte escribe una fila de `trial` ya consumida por cada dueño que tenía al menos una ficha
> —o una suscripción— en el sistema viejo al momento del corte, por vertical.**

Y la salida del «hash que ya consumió», `V/03:250-253`: *«**`T1`, `T6` y `T7` exigen que el hash del
correo no tenga fila en esa vertical.**»* La FK que sostiene la fila frente al borrado de la cuenta,
`V/02-modelo-de-datos.md:318`: *«**La FK de `trial.user_id` a `user` es `ON DELETE RESTRICT`**»*.

### R12.2 El dominio

La regla cuantifica sobre tres ejes independientes. Se recorren por separado porque no se cruzan:
el eje de addons no depende del evento del ciclo, y el del corte ocurre una sola vez.

**R12-a · los eventos del primer ciclo de una suscripción × el estado de trial de la persona en esa
vertical.** Eventos, con su fuente:

| # | evento del primer ciclo | fuente |
|---|---|---|
| e1 | alta: abre checkout | `B/03:129` (`S1`→`S2`), §3.4 |
| e2 | la ventana vence sin autorizar | `S3`, `B/03` §3.4 |
| e3 | autoriza: `ACTIVE` con `cobrada: no` | `S2`, `B/03:129` |
| e4 | primer pago acreditado: `cobrada` pasa a `sí` | `P1`, `B/03:1635`; aviso, `12-contrato…:795` |
| e5 | primer rechazo leído por id | `S16`, `B/03:143` |
| e6 | llega antes el `cancelled` del proveedor que el rechazo | espejo, `B/03:2576` |
| e7 | el proveedor **pausa** una `ACTIVE` que nunca cobró | espejo `paused`, `S6` 2.º evento, `B/03:133` |
| e8 | un reintento del proveedor cobra después de `S16`, con nuestra cancelación sin confirmar | `B/09` §3 salvedad 4; `B/05` §3 condición 1 |
| e9 | el cliente se da de baja antes del primer cobro | `S11`, `B/03:138` |
| e10 | cambio de plan antes del primer cobro (sucesora con `D8`) | `B/12` §4.3, §5.2 |
| e11 | el cliente pausa antes del primer cobro | `S8`, `B/03:135`; `puedePausar()`, `NUCLEO/01:777` |
| e12 | cortesía sobre la fila recién autorizada | `S9`, `B/03:136` |
| e13 | publica (`PB1`) con la suscripción todavía en `cobrada: no` | `V/03:438`, `T1`/`T6` |
| e14 | contracargo del primer cobro ya acreditado | `S6` 3.er evento, `B/03:133` |
| e15 | se pierde el aviso del primer pago | `12-contrato…` §3; `V/03:176` |

Estados de trial relevantes, de `V/03:42-50`: `PRE_TRIAL`, `TRIAL_ACTIVE`, `TRIAL_EXPIRED`.
**`TRIAL_CONVERTED` no entra**: es terminal: ninguna fila de la tabla lo tiene en su `desde` (`V/03:42-50`), así que multiplicar
por él agrega quince celdas iguales. **Tamaño: 15 × 3 = 45.**

**R12-b · addon × lo que hay de título en la vertical donde tiene que aportar.** Scopes, de `V/11`
§5.2 y `B/16:419`: `LISTING`, `VERTICAL_SUBSCRIPTION`, `USER`, `GLOBAL`. Situaciones de título, de
`12-contrato…` §2.4 y `V/15:134-136`: sólo trial · trial + suscripción `cobrada: no` · suscripción
`cobrada: sí` · sin título. **Tamaño: 4 × 4 = 16.**

**R12-c · la población del corte.** De `V/21:209-224` y `V/21:242-252`: (c1) dueño con ficha
publicada · (c2) dueño con ficha sólo en borrador · (c3) suscripción `trialing` sin ficha · (c4)
suscripción `abandoned` sin ficha · (c5) las dos `comp` del owner · (c6) sin ficha ni suscripción ·
(c7) dos cuentas con el mismo correo normalizado · (c8) cualquier ex-cliente en una vertical con días
de trial en cero. **Tamaño: 8.**

**Total R12: 45 + 16 + 8 = 69 casos.**

### R12.3 Los caminos reejecutados

#### F-8CA2-006 — `T2` y `T6` queman el trial con una suscripción cuyo primer cobro se rechaza

1. *«Juan está en `TRIAL_ACTIVE` en Alojamiento, día 5 de 30.»* Sin cambio.
2. *«Se suscribe: `S2` → `ACTIVE`, emite fuente → `T2` → `TRIAL_CONVERTED`.»* **Se corta acá.**
   `B/03:129`: la fila emite *«**con `cobrada: no`, así que todavía no mueve el trial**»*, y `T2`
   exige `cobrada: sí` (`V/03:45`).
3. *«A los 30 minutos el proveedor rechaza el primer cobro: `S16`.»* `S16` lleva la fila a
   `CHARGE_DECLINED` (`B/03:143`); el trial sigue (`V/11:451`).
4. *«Sus 25 días de trial desaparecieron.»* No: sigue en `TRIAL_ACTIVE`.
5. **La variante `T6`** —*«contrata antes de publicar, publica en esa ventana, y la fila de trial
   nace consumida»*— **sigue llegando.** `T6` no cambió: su condición es *«`cubierto` es
   **verdadero**»* (`V/03:49`), y una `SUSCRIPCIÓN` con `cobrada: no` **es** de clase `TÍTULO` y
   **cuenta** para `cubierto` (`12-contrato…:150-153`: *«una `SUSCRIPCIÓN` con `cobrada: no` es de
   clase `TÍTULO`»*; *«`cubierto` no lo lee»*). Juan publica, `T6` escribe la fila consumida, el
   primer cobro se rechaza y queda sin suscripción y sin trial. Busqué la relación entre `T6` y
   `cobrada` (`rg "T6.{0,120}cobrada|cobrada.{0,120}T6"` y la variante multilínea, en las dos épicas,
   el contrato y el log): **sin resultados**.

**Veredicto: LLEGA A OTRA COSA** — el camino principal (`T2`) deja de llegar; la variante `T6` sigue
llegando y pasa a ser el residuo `R12-OWNER-1` (§R12.5).

#### F-8CC1-002 — `ACTIVE` sin ningún pago ya es un `TÍTULO` y dispara `T2`

1. Juan en `TRIAL_ACTIVE` con 20 días. Sin cambio.
2. `S2` → `ACTIVE`, emite `SUSCRIPCIÓN`. Sigue siendo cierto, pero con `cobrada: no` (`B/03:129`).
3. *«El aviso despierta a la máquina de trial: `T2`.»* **Se corta**: `T2` exige `cobrada: sí`
   (`V/03:45`), y el contrato lo dice del lado del emisor (`12-contrato…:795`: *«el primer pago
   acreditado de una fila, que pasa su `cobrada` de `no` a `sí`»* lleva su propio aviso).
4. Rechazo por antifraude → `S16` → `CHARGE_DECLINED`. Igual.
5. *«No tiene trial ni suscripción.»* **Tiene el trial**: `V/11:451-453`.

**Veredicto: DEJA DE LLEGAR.**

#### F-8CB2-006 — el primer rechazo lo reclaman tres filas

1. Juan autoriza, a los ~26 min el primer cobro se rechaza. Igual.
2. Las tres filas:
   - **`S4`**: su condición ya no es `—`. `B/03:131`: *«**la fila tiene al menos un pago acreditado**»*.
     No corre.
   - **`S16`**: su guarda es la complementaria, `B/03:143`: *«**la fila no tiene ningún pago
     acreditado** […] que es la guarda complementaria de la de `S4`»*. Corre.
   - **El espejo**: `B/03:2576` —*«**salvo sobre una fila `ACTIVE` sin ningún pago acreditado cuyo
     primer cobro figura rechazado […]: eso es `S16`**, llegue antes el aviso que llegue»*—. Cede.
3. Destino único: `CHARGE_DECLINED`, con el correo de `DEC-MP-004`.

**Veredicto: DEJA DE LLEGAR** para las tres filas que el hallazgo nombra. Queda una **cuarta** que
el hallazgo no nombraba, la de `paused` (evento e7 del dominio), como residuo de borde
`R12-BORDE-1`.

#### F-8CB1-010 — *«el primer cobro rechazado cancela el preapproval»* se midió sólo con antifraude

1. Primer cobro rechazado por fondos; el proveedor recicla y no cancela.
2. *«La condición de `S16` no se cumple y corre `S4`.»* **Se corta dos veces**: `S16` ya no exige
   la cancelación del proveedor (`B/03:143`, *«**Ya no exige que el proveedor la haya
   cancelado**»*), y `S4` exige un pago acreditado (`B/03:131`).
3. `S16` cancela de nuestro lado; si falla, la reintenta el barrido (`B/09` §3 salvedad 4, que ahora
   lista a `S16` entre sus trece filas: `B/09:157`). La pregunta quedó en la matriz como `PA-6`,
   `UNKNOWN`, *«No bloquea»* (`06-mp-validation-matrix.md:176`).

**Veredicto: DEJA DE LLEGAR.**

#### F-8CA1-004 — los cortes del addon frente al trial están en prosa

1. Juan: Alojamiento `ACTIVE`, Gastronomía `TRIAL_ACTIVE`.
2. Compra un addon `USER`. `A1` lo acepta: sigue siendo cierto, y es lo decidido (`B/03:2364`,
   *«**Un addon `USER` o `GLOBAL` se puede comprar igual**»*).
3. *«El conjunto plegable admite el complemento porque hay un `TÍTULO` vivo.»* **Se corta**: el
   pliegue pide un título *«**que NO sea de `tipo: TRIAL`**»* (`V/15:135-136`), y `G-R2` lo vigila
   (`V/20:57`).
4. **Scope `LISTING`**: elige como objetivo su ficha de Gastronomía en trial. **Se corta en la
   compra**: `A1` exige que en `cobertura(user, vertical del objetivo)` haya un título que no sea
   trial (`B/03:2364`); y aunque pasara, el delta por ficha pide lo mismo (`V/15`, *«un addon de
   alcance `LISTING` entra en ese delta **sólo si el `user + vertical` tiene título vivo** **que no
   sea un trial**»*).

**Veredicto: DEJA DE LLEGAR.**

#### F-8CA2-011 — `V/11` §5.3 y `V/15` §2.6 pliegan distinto

Camino: *«Juan paga "+30 fotos" `GLOBAL` en Alojamiento y abre un trial en Gastronomía. La resolución
de Gastronomía ve un `TÍTULO` (el trial) y suma el addon.»* **Se corta en la suma**: `V/15:135-136`.
Y `V/15:143` cita la regla de `V/11` como la que manda: *«**`V/11` es el dueño de la regla del
trial, así que manda él**»*. Las dos redacciones dicen ahora lo mismo con palabras distintas
(*«único título es un trial»*, `V/11:255`; *«título que NO sea de `tipo: TRIAL`»*, `V/15:135`), y
son equivalentes.

**Veredicto: DEJA DE LLEGAR.**

#### F-8CC1-006 — el pliegue deja que un addon global aporte sobre un trial

Pasos 1-3 iguales. Paso 4 —*«hay un título vivo, así que el complemento entra»*— **se corta** en
`V/15:135-136` y lo vigila `G-R2` (`V/20:57`: *«**El caso que lo distingue de la versión anterior**:
un addon `USER` o `GLOBAL` comprado con la suscripción de otra vertical, contra una vertical cuyo
único título es un trial, **no entra**»*).

**Veredicto: DEJA DE LLEGAR.**

#### F-8CA2-013 — el corte deja la cartera en `PRE_TRIAL` con el evento ya ejercido

1. *«Todos los anfitriones con fichas publicadas amanecen en `PRE_TRIAL` sin fila.»* **Se corta**:
   `V/21:209-211` escribe la fila consumida, y `V/21` §2.4 lo repite al describir la mañana del
   corte: *«**el dueño que sí la tenía amanece en `TRIAL_CONVERTED`**»*.
2. *«Al publicar cualquier borrador disparan `T1`.»* No: `T1` sale de `PRE_TRIAL` y además exige
   que el hash no tenga fila (`V/03:44`).

**Veredicto: DEJA DE LLEGAR.** El alcance de la escritura abre un residuo al owner (`R12-OWNER-3`) y
uno de registro (contradicción C-R12-1).

#### F-8CA3-003 — el `UNIQUE` del hash vuelve imposible la escritura de `T6`

1-3. Ana borró su cuenta, vuelve con el mismo correo, contrata. Igual.
4. *«Publica. Dispara `T6`, que escribe la fila consumida → violación de `UNIQUE`.»* **Se corta**:
   `T6` exige que el hash no tenga fila (`V/03:49`), así que no dispara; `PB1` publica porque está
   cubierta (`V/03:438`; `V/03:250-253`).
5. *«Si `PB1` y `T6` van en la misma transacción, la publicación falla siempre.»* Ya no hay `T6`.

**Veredicto: DEJA DE LLEGAR.** El residuo —esa persona queda en `PRE_TRIAL` para siempre— está
declarado en `V/03:259-270`.

#### F-8CA3-008 — ninguna restricción sostiene la fila de `trial` frente al borrado de la cuenta

1. Carla pide borrar su cuenta.
2. *«El implementador eligió `ON DELETE CASCADE` porque nada dice lo contrario.»* **Se corta**:
   `V/02:318`, *«**La FK de `trial.user_id` a `user` es `ON DELETE RESTRICT`**»*, y la fila 2 del §5
   la cita (`V/02:684`).
3-4. No llegan.

**Veredicto: DEJA DE LLEGAR.** Quedan declarados dos residuos: el `DELETE` directo sobre `trial`
(`V/02:689-692`) y el proceso de baja de cuenta sin diseñar (`V/02:324`; `V/02:594-600`).

### R12.4 El dominio recorrido

**R12-a** (evento × estado de trial). Columna *«quién lo reclama»* = la fila de billing que decide
el estado; las tres columnas siguientes son el resultado para el trial.

| # | quién lo reclama → estado de billing | `PRE_TRIAL` | `TRIAL_ACTIVE` | `TRIAL_EXPIRED` |
|---|---|---|---|---|
| e1 | `S1` → `PENDING_AUTHORIZATION`; no emite (`12-contrato…` §2.6) | OK | OK | OK |
| e2 | `S3` → `ABANDONED` | OK | OK | OK |
| e3 | `S2` → `ACTIVE`, `cobrada: no` | OK | DECLARADO (dos títulos sumados, `V/03:165`) | OK (`PB3`/`PB7` restituyen; `T5` espera) |
| e4 | `P1` → `cobrada: sí`, con aviso | OK (no hay fila `T` que lo escuche; ver e13) | OK (`T2`; los días se pierden, `V/11:441`) | OK (`T5`) |
| e5 | `S16` → `CHARGE_DECLINED`, cancelación nuestra | OK si no publicó en la ventana; si publicó, ver e13 | OK (sigue en su trial, `V/11:451`) | OK (`PB2` baja) |
| e6 | espejo `cancelled` → cede a `S16` (`B/03:2576`) | OK | OK | OK |
| e7 | espejo `paused` → `S6` → `SUSPENDED`, **no cede a `S16`** | BORDE | BORDE | BORDE |
| e8 | pago sobre `CHARGE_DECLINED` → `B/05` §3 condición 1 falla → marca, devuelve una persona | OK | OK | OK |
| e9 | `S11` → `CANCEL_SCHEDULED` con fin en el acto (`B/03:138`) → `S12` | OK | TEXTO (`V/03:173-175`) | OK |
| e10 | sucesión: sucesora `cobrada: no` hasta `D8` | OK | DECLARADO (`V/03:169-172`) | OK |
| e11 | `S8` → `PAUSED` sin cobro; al volver `S10`, fuente `cobrada: no` | OK | TEXTO (`V/03:130-131`) | OK |
| e12 | `S9` → `PAUSED · COURTESY` emite `CORTESÍA` sin cobro previo | OK | BORDE | OK |
| e13 | `PB1` con `cobrada: no` → `T6` consume | OWNER | DECLARADO (cupo sumado, `V/03:165`) | OK |
| e14 | `S6` 3.er evento → `SUSPENDED` | OK | OK | OK |
| e15 | aviso de `cobrada` perdido | OK | DECLARADO (`V/03:176-178`) | DECLARADO (`V/03:970-971`) |

Notas de las celdas que no son `OK`:

- **e7** (las tres): `S6` sale de `ACTIVE` *«sólo por el segundo o el tercer evento»* (`B/03:133`) y
  su segundo evento es *«se lee `paused` en el proveedor»*; ni su condición ni la fila `paused` del
  espejo excluyen una fila sin ningún pago acreditado, como sí lo hace la fila `cancelled`
  (`B/03:2576`). Para el trial da igual —`SUSPENDED` no emite, el trial sigue—, pero en billing el
  alta que no ocurrió termina en `SUSPENDED` y no en `CHARGE_DECLINED`. Residuo `R12-BORDE-1`.
- **e9 · `TRIAL_ACTIVE`**: el ⚠️ 3 dice *«se declara porque la fuente cubre mientras tanto»*, y desde
  `B/03:138` una fila sin `covered_period` tiene *«`fin_de_servicio` es el instante de la baja»*: la
  fuente no cubre ningún *«mientras tanto»*. Contradicción C-R12-4.
- **e11 · `TRIAL_ACTIVE`**: `V/03:130-131` afirma *«Quien […] **reanuda** (`S10`) ya pagó alguna vez
  sobre esa fila, así que su fuente llega con `cobrada: sí`»*. Con `S8` desde una `ACTIVE` que no
  cobró —`puedePausar()` no mira pagos (`NUCLEO/01:777-783`)— es falso. No tiene consecuencia: al
  primer cobro después de `S10` convierte `T2`. Contradicción C-R12-3.
- **e12 · `TRIAL_ACTIVE`**: `S9` pausa por cortesía una fila recién autorizada (tercer disparador,
  `B/03:136`), `PAUSED · COURTESY` emite `CORTESÍA` (`12-contrato…:412`), y la cortesía convierte
  sin esperar cobro (`V/03:128-130`). Si al volver (`S10`) el primer cobro se rechaza, `S16` lleva
  la fila a `CHARGE_DECLINED` y la persona no tiene trial: lo consumió la cortesía. Residuo
  `R12-BORDE-2`.
- **e13 · `PRE_TRIAL`**: la variante `T6` de `F-8CA2-006`. Residuo `R12-OWNER-1`.

**R12-b** (addon × título en la vertical):

| scope | sólo trial | trial + suscripción `cobrada: no` | suscripción `cobrada: sí` | sin título |
|---|---|---|---|---|
| `LISTING` | OK (`A1` rechaza el objetivo, `B/03:2364`; el delta lo descarta) | OK (si `S16` mata la principal, orfandad por la 2.ª mitad, `B/16:417`) | OK | OK (orfandad, `B/16:417`) |
| `VERTICAL_SUBSCRIPTION` | OK (no hay suscripción a la que apuntar, `V/11` §5.2) | OK (`CHARGE_DECLINED` deja de ser fila viva → huérfano, `B/16:418`) | OK | OK |
| `USER` | OK (`V/15:135`) | OWNER | OK | OK (por diseño, `B/16:419`) |
| `GLOBAL` | OK (`V/15:135`) | OWNER | OK | OK (por diseño, `B/16:419`) |

- **`USER`/`GLOBAL` × `cobrada: no`**: `B/16:114` define *«válida»* como *«**`ACTIVE`** | **sí** | es
  el único»*, sin mirar si cobró. Juan autoriza, compra un addon `USER` en los minutos siguientes,
  su primer cobro se rechaza y `S16` mata la principal. El addon **no queda huérfano**, porque para
  `USER`/`GLOBAL` eso es *«la cuenta se borró»* (`B/16:419`), así que su preapproval sigue cobrando,
  y el pliegue lo descarta en todas sus verticales porque no tiene título. Residuo `R12-OWNER-2`.
  *«Sin título»* se deja en OK porque ahí el addon se compró con una suscripción que sí cobró y la
  regla de orfandad de `B/16` §4.2 lo decidió así (es terreno de `R6`, no de este racimo).

**R12-c** (el corte):

| # | población | resultado |
|---|---|---|
| c1 | dueño con ficha publicada | OK — fila consumida; `T1` no dispara (`V/21:209-211`) |
| c2 | dueño con ficha **sólo en borrador** | OWNER — se le consume un trial sin haber ejercido el evento de activación |
| c3 | suscripción `trialing` sin ficha | OK — el corte cancela las ocho suscripciones y los llama (`V/21` §2.1); pierde los días que quedaban, por decisión |
| c4 | suscripción `abandoned` sin ficha | OWNER — se le consume un trial por un alta que no ocurrió |
| c5 | las dos `comp` del owner | OK — explicado en `V/21` §2.4 |
| c6 | sin ficha ni suscripción | OK — `PRE_TRIAL`, sin fila |
| c7 | dos cuentas con el mismo correo normalizado | DECLARADO — `V/21:242-246` |
| c8 | ex-cliente en vertical con días en cero | DECLARADO — `V/21:247-252` |

**Recuento, con script** (sobre las tres tablas de arriba, contando la marca de cada celda):

```text
$ python3 - <<'EOF'
import re
t = open('07-R12-R14-trial-y-cupos.md').read()
a = t.split('**R12-a**')[1].split('Notas de las celdas')[0]
b = t.split('**R12-b**')[1].split('- **`USER`/`GLOBAL`')[0]
c = t.split('**R12-c**')[1].split('**Recuento')[0]
def cells(sec, first_data_col):
    out = []
    for l in sec.splitlines():
        if not l.startswith('| ') or l.startswith('|---') or l.startswith('| #') or l.startswith('| scope'):
            continue
        cols = [x.strip() for x in l.strip('|').split('|')]
        out += [re.match(r'(OK|DECLARADO|BORDE|OWNER|TEXTO)', x).group(1) for x in cols[first_data_col:]]
    return out
from collections import Counter
for name, cs in (('R12-a', cells(a, 2)), ('R12-b', cells(b, 1)), ('R12-c', cells(c, 2))):
    print(name, len(cs), dict(Counter(cs)))
EOF
R12-a 45 {'OK': 33, 'DECLARADO': 5, 'TEXTO': 2, 'BORDE': 4, 'OWNER': 1}
R12-b 16 {'OK': 14, 'OWNER': 2}
R12-c 8 {'OK': 4, 'OWNER': 2, 'DECLARADO': 2}
```

**69 casos: 51 OK, 7 declarados, 11 con residuo nuevo** (4 de borde, 5 al owner, 2 de texto). Los 11
se reducen a **cinco residuos distintos** (§R12.5), porque las tres celdas de e7 son un mismo
residuo, las dos de `USER`/`GLOBAL` otro, y c2 y c4 otro.

### R12.5 Residuos

#### AL OWNER

**`R12-OWNER-1` · `T6` quema el trial con una suscripción que todavía no cobró.** Toca acceso en el
camino principal: contratar antes de publicar es el orden normal de quien entra pagando.

*Juan* entra a Alojamiento, no publica nada y se suscribe al Básico. A los diez minutos publica su
primera ficha: está cubierto por su suscripción (`cobrada: no`), así que `T6` escribe su fila de
`trial` **consumida** (`V/03:49`). A los 30 minutos le rechazan el primer cobro: `S16`, sin
suscripción. Su trial ya no existe, y no lo usó nunca. Es exactamente lo que `DEC-TRIAL-010` vino a
impedir —*«un alta que no ocurrió no consume el trial»*— por la otra puerta de la máquina.

1. **`T6` exige un título que convierte, y una fila nueva lo consume al primer pago.** `T6` pasa a
   pedir `cubierto` verdadero **por un título que convierte** (el mismo término de `T2`). Si el único
   título es una `SUSCRIPCIÓN` con `cobrada: no`, no dispara ninguna del par: `PB1` publica igual,
   porque está cubierto. Se agrega **`T8`**: `PRE_TRIAL`, *«aparece un título que convierte»*,
   condición *«ya ejerció el evento de activación»*. Lleva a `TRIAL_CONVERTED` y escribe la fila
   consumida, igual que `T7`. El registro del evento ya existe: es el que `T7` lee (`V/03:310-315`).
   - Costo: una fila nueva, y el par `T1`/`T6` pierde su cobertura total.
   - Riesgo: bajo. Es el mecanismo de `T7` con otro disparador.
   - Resultado: si el cobro se rechaza, Juan queda en `PRE_TRIAL` con su ficha bajada por `PB2`, y
     su próximo `PB1` arranca el trial (`T1`, `cubierto` falso).
2. **`S16` repara**: si la fila que llegó a `CHARGE_DECLINED` era el título que hizo disparar `T6`,
   se borra la fila de `trial`.
   - Costo: es la alternativa (2) que `DEC-TRIAL-010` descartó, y choca con *«la fila no se borra
     nunca»* (`V/02:684`).
3. **Declararlo.** La población son quienes publican en la ventana de su primer cobro y además
   tienen la tarjeta rechazada.
   - Costo: el trial perdido de esa gente, sin detector.

**Recomendación: 1.** Es la única que respeta a la vez `DEC-TRIAL-010` y la fila que no se borra.

**`R12-OWNER-2` · un addon `USER`/`GLOBAL` comprado antes del primer cobro sigue cobrando si ese
cobro se rechaza.** Toca plata. El camino es el de alguien que completa su alta y compra un
complemento en la misma sesión.

*Juan* autoriza el Básico y en la misma sesión compra *«+20 fotos»* `USER`. Para `A1` la suscripción
es válida, porque está `ACTIVE` (`B/16:114`). El primer cobro del plan se rechaza por fondos: `S16`.
El del addon, que es más chico, entra. Desde ahí el addon cobra todos los meses, no queda huérfano
(`B/16:419`) y no aporta nada: sin título, el pliegue lo descarta (`V/15:135`). Ningún barrido lo
ve, porque la instancia no es terminal.

1. **«Válida» es `ACTIVE` con `cobrada: sí`.** La fila `ACTIVE` de `B/16` §2.2 y la condición de
   `A1` (`B/03:2364`) piden al menos un pago acreditado.
   - Costo: nadie compra addons en los 26–44 minutos que siguen a un alta (`PA-3`).
   - Por qué encaja: es la misma lectura que el capítulo usa para `PENDING_AUTHORIZATION`
     (`B/16:113`, *«algo que puede no autorizarse nunca»*) y la dirección que eligió (*«hacia no
     vender»*).
2. **`A5` corta el `USER`/`GLOBAL` cuando la principal con la que se compró muere sin haber
   cobrado.**
   - Costo: una cláusula nueva de orfandad, y la regla de `B/16` §4.2 pasa a tener una excepción.
3. **Declararlo.**
   - Costo: un cobro recurrente sin servicio que sólo corta el cliente.

**Recomendación: 1.** Es una condición en un lugar, y sale de la misma regla que ya existe.

**`R12-OWNER-3` · el corte consume el trial de quien nunca ejerció el evento ni pagó.** Toca acceso:
el trial de por vida de personas conocidas.

`V/21:220-221` escribe la fila para *«cada ficha que ya existía el día del corte —**publicada o
no**»*, y `V/21:66-67` para toda suscripción, incluidas las tres `abandoned` (*«eso incluye a esas
seis»*). Pero la regla que funda esta escritura es la de `T7`, y `T7` distingue:
*«**nunca publicó ahí**, tenga o no suscripción | **nada**: sigue en `PRE_TRIAL`»* (`V/03:306`).
Además `DEC-TRIAL-010` dice que *«un alta que no ocurrió no consume el trial»*.

*Juan* dejó un borrador en el sistema viejo, o abrió un checkout y lo abandonó. Nunca publicó y nunca
pagó. El día del corte amanece en `TRIAL_CONVERTED`, y el día que publica `PB1` le dice
*«suscribite para publicar»*.

1. **Acotar la escritura a lo que `T7` acepta como «ya ejerció»**: fichas publicadas, y suscripciones
   que llegaron a autorizar (`trialing`, activas, canceladas después de autorizar). Quedan fuera los
   borradores solos y las `abandoned`.
   - Costo: dos líneas en `V/21` §2.4.
   - Riesgo: una `abandoned` que en el sistema viejo sí usó un trial. Con el diseño de hoy
     (`HOS-171`: sin autorización no hay trial) eso no puede haber pasado.
2. **Dejarlo como está y registrarlo como decisión.** Hoy no figura en el log (C-R12-1).
   - Costo: tres personas conocidas —más los dueños que sólo tengan borradores— sin trial.

**Recomendación: 1.** Es la regla de `T7` aplicada sin excepción, y coincide con `DEC-TRIAL-010`.

#### DE BORDE

**`R12-BORDE-1` · el `paused` del proveedor sobre una `ACTIVE` que nunca cobró va a `S6`, no a
`S16`.** Lo busqué en `B/03` y `B/12` (`rg "paused.{0,200}(sin ningún pago|sin pago acreditado|primer
cobro)"`). La única aparición es la del ítem tachado de `B/03:217`, así que **no está declarado**. No
mueve plata —`S6` cancela el preapproval— ni toca el trial. Sólo pasa si `S16` no leyó el primer
rechazo durante toda la ventana de reintentos del proveedor, un ciclo según `GR-3`. Texto propuesto,
como punto 4 del ⚠️ de `B/03` §3.2, *«el primer rechazo lo reclamaban tres filas»*:

> 4. **Una cuarta fila todavía lo puede reclamar: el `paused` del proveedor** (§10.1, `S6` por su
>    segundo evento), que no le cede el paso a `S16` como el `cancelled`. Pasa sólo si el primer
>    rechazo no se leyó por id en toda la ventana de reintentos del proveedor. En ese caso el alta
>    que no ocurrió termina en `SUSPENDED` en vez de `CHARGE_DECLINED`: vuelve por sucesión, no por
>    alta nueva, y recibe el correo de suspensión en vez del de `DEC-MP-004`. **Causa**: la cesión a
>    `S16` se escribió sobre la fila `cancelled` del espejo, que era la que el hallazgo nombraba. No
>    mueve plata, porque `S6` cancela el preapproval, y no toca el trial, porque `SUSPENDED` no emite.

**`R12-BORDE-2` · una cortesía sobre la fila recién autorizada convierte el trial sin cobro.** Lo
busqué con `rg "S9.{0,200}trial|cortesía.{0,100}convierte"` en `V/03`. El único resultado es
`V/03:128-130`, que da la conversión por cortesía como correcta y no mira este caso. **No está
declarado.** No mueve plata: la persona recibe los meses de cortesía. Texto propuesto, como punto 5
del ⚠️ de `V/03` §2, *«los 26–44 minutos»*:

> 5. **Una cortesía sobre una fila que todavía no cobró convierte igual.** El tercer disparador de
>    `S9` (`B/03` §3.2) pausa por cortesía una fila recién autorizada. La `PAUSED · COURTESY` emite
>    `CORTESÍA`, que convierte sin esperar cobro, así que `T2` dispara. Si al volver (`S10`) el
>    primer cobro se rechaza, `S16` deja a la persona sin suscripción y con el trial consumido por
>    esa cortesía. **Causa**: `DEC-TRIAL-010` condiciona sólo la fuente `SUSCRIPCIÓN`. Recibió los
>    meses de cortesía, así que no perdió servicio.

#### CONTRADICCIONES DE TEXTO

- **C-R12-1 · el corte no está en el log.** El consolidado pone *«el corte siembra trials
  consumidos»* dentro de `DEC-TRIAL-010` (`25-fase-8-completa/00-hallazgos.md:346`), y `V/21:66`
  cita *«owner 2026-09-25»*. Pero la entrada del log (`01-decision-log.md:5282-5302`) no lo menciona.
  Busqué `ya fue cliente` y `corte … consumid` en el log, en `16-fase-7-del-paraguas.md` y en
  `NUCLEO/`: sin resultados. **Corrección**: agregar a `DEC-TRIAL-010` un punto *«Y el corte»* con el
  alcance que el owner confirme en `R12-OWNER-3`.
- **C-R12-2 · `CHARGE_DECLINED` sigue diciendo que lo cancela el proveedor.** Frente a
  `B/03:143` (*«**Ya no exige que el proveedor la haya cancelado**»*) y `B/02:212`, que ya se
  corrigió, quedan tres textos viejos:
  - `B/03:56`: *«**Terminal**: el proveedor la canceló al rechazarlo»*.
  - `B/03:456`: *«`CHARGE_DECLINED` lo canceló el proveedor de forma terminal»*.
  - `NUCLEO/01-glosario.md:499`: *«o el proveedor la canceló de forma terminal»*.

  **Corrección**: la redacción de `B/02:212`, *«`S16` lo canceló al leer el primer cobro rechazado —de
  nuestro lado, o ya lo había hecho el proveedor—»*. En `B/03:456` el argumento
  (*«sin reversa»*) sigue valiendo, porque `S16` llega a `CHARGE_DECLINED` *«pase lo que pase con la
  llamada»*.

  `B/03:65` y `B/12:269` usan la misma premisa como argumento contra `S4`. La conclusión sigue en
  pie, porque ahora `S16` cancela, así que basta una nota.
- **C-R12-3 · `V/03:130-131` dice que quien reanuda ya pagó.** *«Quien […] **reanuda** (`S10`) ya pagó
  alguna vez sobre esa fila»* es falso después de `S8` o de `S9` sobre una `ACTIVE` que no cobró
  (e11, e12). **Corrección**: *«Quien recupera (`S7`) ya pagó sobre esa fila; quien reanuda (`S10`)
  casi siempre también, y si pausó antes del primer cobro su fuente vuelve con `cobrada: no` y
  convierte al primer pago, como un alta»*.
- **C-R12-4 · `V/03:173-175` (⚠️ 3) contra `B/03:138`.** El ⚠️ dice *«la fuente cubre mientras
  tanto»*, y `S11` sobre una fila sin `covered_period` pone *«`fin_de_servicio` es el instante de la
  baja»*. **Corrección**: *«…no convierte nunca: su fin de servicio es el instante de la baja
  (`B/03` §3.2, `S11`), así que no cubre y el trial sigue su reloj. Si un primer cobro en vuelo se
  acredita después (`B/05` C2), la fila pasa a `cobrada: sí` y `T2` convierte»*.
- **C-R12-5 · el diagrama de `V/03` §2 no se actualizó.** `V/03:31` dice *«T2 · aparece un título
  ajeno»* y `V/03:34` *«T5 · aparece un título»*, frente a la tabla (`V/03:45`, `:48`: *«aparece un
  título que convierte»*). La tabla *«decía / dice»* de `V/03:109` también da para `T2` *«aparece un
  título que no es el trial»*. **Corrección**: *«T2 · aparece un título que convierte»* y *«T5 ·
  aparece un título que convierte»*, y en la columna *«dice»* agregar *«…y, si es suscripción, ya
  cobró (`DEC-TRIAL-010`)»*.

---

## R14 · Lock por `user + vertical` en toda transición que ocupa cupo

### R14.1 La regla corregida, tal como quedó

`V/03-maquinas-de-estado.md:650-653`:

> **Toda transición que ocupa cupo —`PB1`, `PB3` y `PB7`— toma un lock por `user + vertical` y
> cuenta dentro de él. `PB2` toma el mismo, en sus dos ramas.** Dos publicaciones simultáneas del
> mismo dueño en la misma vertical pasan una detrás de la otra, y la segunda cuenta lo que la
> primera escribió.

Con su alcance (`V/03:656-657`: *«lo que se evalúa dentro del lock son **los pasos 5 a 7**»*), su
exclusión (`V/03:669-671`: *«**Las que liberan cupo no lo necesitan** —`PB4`, `PB6`, `PB10`,
`PB12`—: una carrera con ellas sólo puede hacer que un conteo vea una publicada de más, y eso
rechaza de más, nunca publica de más»*) y su gemela en la cadena de autorización,
`V/17-autorizacion.md:109-111`. El invariante 6 la cita en `NUCLEO/04-invariantes.md:58`.

### R14.2 El dominio

Todo lo que ocupa, libera o consume un cupo por `user + vertical`, con su fuente:

- **Las doce transiciones de publicación**, `PB1`…`PB12` (`V/03:436-449`).
- **El alta del trial** (`T1`, que ocupa el cupo de una ficha del plan de trial; `NUCLEO/04:58`).
- **Los tres ejecutores que corren transiciones de cupo sin ser el dueño**: el reconciliador de
  excedentes tras un cambio de plan que baja o sube el límite (`V/15:319-321`), la vuelta de la
  cobertura (`S2`, `S7`, `S10` → `PB3`/`PB7`) y el reconciliador diario de cobertura (`V/03:876-879`).
- **Los tres consumos de limit que no son transiciones**: las claves `SUMA` de `V/15:60` (*«fotos,
  fichas, destaques»*) y la cuota de un entitlement medido (`V/15:267`, clase `COMERCIAL`: *«**consume**
  un limit o la cuota de un entitlement medido»*). Las fichas ya están en las transiciones, así que
  quedan fotos, destaques y cuota medida.

**Tamaño: 12 + 1 + 3 + 3 = 19.**

### R14.3 Los caminos reejecutados

#### F-8CA1-006 — los limits se cuentan y se escriben sin serialización

1. Juan: cupo 2, 1 publicada, 3 borradores.
2. Tres `PB1` en paralelo.
3. *«Las tres pasan el paso 7 leyendo "1 de 2".»* **Se corta**: `V/03:438`, *«**Toma el lock del
   `user + vertical` y cuenta el cupo adentro**»*. Pasa la primera y las otras dos leen 2 de 2.
4. *«El reconciliador no dispara.»* Ya no hace falta. Y si igual quedara exceso, lo toma la red
   diaria (`V/03:676-678`).
5. *«La restitución de `PB3`/`PB7` y un `PB1` compiten por el último lugar.»* **Se corta**: `PB3`
   (`V/03:440`) y `PB7` (`V/03:444`) *«**toma[n] el lock y cuenta[n] adentro**»*.

**Veredicto: DEJA DE LLEGAR** para las fichas. La propuesta del hallazgo era serializar *«por
`user + vertical + clave`»*, y los demás limits (fotos, destaques, cuota) **no** quedaron bajo el
lock: `V/17:109-110` lo acota a *«en una transición que ocupa cupo —`PB1`, `PB3`, `PB7`—»*. Es el
residuo `R14-BORDE-1`.

#### F-8CA2-010 — dos `PB1` concurrentes superan cualquier cupo, incluido «una sola ficha en trial»

1. Juan en `PRE_TRIAL`, dos pestañas.
2. *«Cada `PB1` evalúa "¿le queda cupo?" sobre 0 publicadas.»* **Se corta**: la segunda entra al
   lock cuando la primera ya disparó `T1`. Encuentra a Juan en `TRIAL_ACTIVE`, cubierto por el trial
   y con el cupo de una ficha usado, y el paso 7 la rechaza. `NUCLEO/04:58`: *«**contado dentro del
   lock por `user + vertical`**»*.
3. Plan de 3 con 4 `PB1`: igual que en `F-8CA1-006`.

**Veredicto: DEJA DE LLEGAR.**

#### F-8CA2-009 — `PB1` contra `PB2`

1. Juan en el último día de grace, abre un borrador.
2. t0: autorización de `PB1`. **Ya no ocurre fuera del lock**: los pasos 5 a 7 se evalúan adentro
   (`V/03:656-657`).
3. t1: `S6`, aviso, `PB2` baja las publicadas, **con el mismo lock** (`V/03:439`).
4. t2: si `PB1` entra después, *«relee y ya no hay cobertura»*. Si entra antes, `PB2` *«encuentra la
   ficha recién publicada entre las que baja»* (`V/03:658-660`).
5. *«La ficha queda pública 90 días.»* No llega por ninguno de los dos órdenes.

**Veredicto: LLEGA A OTRA COSA.** El camino del hallazgo no llega. Queda una variante que el texto no
cierra: dentro del lock, `PB1` evalúa los pasos 5 y 6 **con el caché** (`V/02` §3.1). El caché se
invalida con toda transición de suscripción (`V/02` §3.2), pero ningún texto ordena esa
invalidación respecto de `PB2`. Si `PB2` corre y suelta el lock antes de que se invalide la entrada,
`PB1` entra, lee el caché viejo y publica sin cobertura. Lo corrige el reconciliador diario, fila 1
(`V/03:904`), **al día siguiente y no a los 90**. Es el residuo `R14-BORDE-3`.

### R14.4 El dominio recorrido

| # | caso | ¿ocupa cupo? | ¿toma el lock? | resultado |
|---|---|---|---|---|
| 1 | `PB1` publica | sí | sí (`V/03:438`) | OK |
| 2 | `PB2` baja (las dos ramas) | libera | sí (`V/03:439`) | OK |
| 3 | `PB3` restituye | sí | sí (`V/03:440`) | OK |
| 4 | `PB4` archiva (desde `PUBLISHED` o `UNPUBLISHED_BY_BILLING`) | libera | no | BORDE |
| 5 | `PB5` archiva un borrador | no | no hace falta | OK |
| 6 | `PB6` el dueño despublica | libera | no | BORDE |
| 7 | `PB7` restituye desde `ARCHIVED` | sí | sí (`V/03:444`) | OK |
| 8 | `PB8` reactiva a `DRAFT` | no (`V/03:710-711`) | no hace falta | OK |
| 9 | `PB9` purga | no (sale de `ARCHIVED`, que no cuenta) | no hace falta | OK |
| 10 | `PB10` modera | libera | no | OK |
| 11 | `PB11` levanta la moderación a `DRAFT` | no | no hace falta | OK |
| 12 | `PB12` el dueño borra | libera | no | BORDE |
| 13 | `T1` arranca el trial | sí (cupo del plan de trial) | sí, dentro de `PB1` | OK |
| 14 | cambio de plan que baja o sube el límite → reconciliador de excedentes | libera / ocupa | sí (`V/03:666-668`) | OK |
| 15 | vuelve la cobertura (`S2`, `S7`, `S10`) → `PB3`/`PB7` | ocupa | sí | OK |
| 16 | reconciliador diario de cobertura | ocupa / libera | sí (`V/03:666-668`) | OK |
| 17 | agregar fotos (clave `SUMA`) | consume limit | no | BORDE |
| 18 | destacar (clave `SUMA`) | consume limit | no | BORDE |
| 19 | usar la cuota de un entitlement medido | consume cuota | no | BORDE |
| — | que un guard verifique el lock | — | — | DECLARADO (`V/03:680-682`) |

La fila *«—»* no es un caso del dominio: es la declaración que ya existe, y se cuenta aparte.

Notas:

- **4 · `PB4` contra `PB3` sobre la misma ficha.** Las dos salen de `UNPUBLISHED_BY_BILLING`. `PB3`
  toma el lock y `PB4` no. `PB4` relee la cobertura, la ve falsa porque la leyó antes del cambio, y
  escribe `ARCHIVED` **después** de que `PB3` escribió `PUBLISHED`. Ninguna regla de concurrencia de
  verticales protege una fila de ficha contra la escritura perdida: busqué `optimista|versión de la
  fila|lock` en `V/` y el único resultado fuera de este § es `V/17:110`. Queda archivada estando
  cubierta, y la vuelve la fila 2 del reconciliador diario (`PB7`) al día siguiente.
- **6 y 12 · `PB6`/`PB12` contra la rama del excedente de `PB2`.** El reconciliador cuenta 5 con
  cupo 3 dentro del lock y baja las 2 más recientes. En paralelo el dueño despublica una de las otras
  tres, sin lock. Quedan 2 publicadas con cupo 3 y una candidata abajo. **Baja de más**, que es lo
  que `V/03:669-671` dice que no puede pasar (*«sólo puede hacer que un conteo vea una publicada de
  más, y eso rechaza de más»*): para `PB2`, ver una de más hace **despublicar** de más. La vuelve la
  fila 2 del reconciliador diario al día siguiente. **`PB10` queda en OK** aunque tenga la misma
  forma: lo ejecuta un admin, es un acto puntual y no una carrera que el dueño pueda provocar, y la
  red es la misma.
- **17-19.** `V/17:109-110` y `V/03:650` acotan el lock a las transiciones de publicación. El paso 7
  de agregar una foto o destacar cuenta afuera. Dos escrituras simultáneas del mismo dueño superan
  el cupo en una unidad por pestaña, y no hay red: el reconciliador de excedentes se dispara por el
  recálculo del conjunto (`V/15:319-321`), no por el conteo. `F-8CA1-006` había pedido la
  serialización *«por `user + vertical + clave`»*.

**Recuento, con script** sobre la tabla (se excluye la fila *«—»*):

```text
$ python3 - <<'EOF'
t = open('07-R12-R14-trial-y-cupos.md').read()
sec = t.split('### R14.4')[1].split('La fila *«—»*')[0]
rows = [l for l in sec.splitlines() if l.startswith('| ') and l.split('|')[1].strip().isdigit()]
from collections import Counter
print(len(rows), dict(Counter(l.strip('|').split('|')[-1].strip().split()[0] for l in rows)))
EOF
19 {'OK': 13, 'BORDE': 6}
```

**19 casos: 13 OK, 6 con residuo de borde** (4, 6, 12, 17, 18, 19), más el guard que ya estaba
declarado. Los seis se reducen a **tres residuos distintos**.

### R14.5 Residuos

#### AL OWNER

Ninguno. Todo exceso que queda es del mismo cliente, sobre claves de un plan que ya paga, y con una
unidad por escritura simultánea. Ninguno borra datos, y los que bajan de más tienen red al día
siguiente.

#### DE BORDE

Ninguno de los tres está en el ⚠️ de `V/03:680-682`, que sólo declara la falta de guard. Lo busqué
también en el «NO cierra» de `V/15` (`rg "lock|carrera|concurren" V/15-entitlements-y-limits.md`): sin
resultados.

**`R14-BORDE-1` · los limits que no son fichas se cuentan fuera del lock.** Texto propuesto, como
punto 2 del ⚠️ de `V/03` §9, *«publicar ocupa cupo bajo un lock»*:

> 2. **El lock es de las transiciones de publicación, no de todo limit.** Las fotos, los destaques y
>    la cuota de un entitlement medido pasan el paso 7 del cap. 17 §1.2 sin lock, así que dos
>    escrituras simultáneas del mismo dueño pueden pasar el cupo en una unidad cada una. Y no hay
>    red, porque el reconciliador de excedentes se dispara por el recálculo del conjunto y no por el
>    conteo (cap. 15 §4.2). **Causa**: la decisión se tomó sobre los tres hallazgos del racimo, y los
>    tres son de fichas. Lo que se regala es cupo de una clave que el cliente ya paga.

**`R14-BORDE-2` · una transición que libera, sin lock, compite con una que escribe la misma ficha
o el mismo conteo.** Texto propuesto, como punto 3 del mismo ⚠️:

> 3. **«Las que liberan no lo necesitan» vale para `PB1`, no para `PB2`.** Una carrera entre la rama
>    del excedente de `PB2` y un `PB6` o un `PB12` del dueño deja **una ficha abajo de más**. Y `PB4`
>    sin lock puede archivar una ficha que `PB3` acaba de republicar. Las dos las devuelve el
>    reconciliador diario de cobertura al día siguiente (su fila 2). **Causa**: el argumento se
>    escribió pensando en el conteo de `PB1`, que con una de más rechaza. Para `PB2`, con una de más
>    despublica. Ninguno de los dos casos publica de más ni borra.

**`R14-BORDE-3` · el lock no ordena el caché.** Texto propuesto, como punto 4 del mismo ⚠️:

> 4. **Dentro del lock, los pasos 5 y 6 pueden responder con el caché** (cap. 02 §3.1), y ningún
>    texto ordena su invalidación respecto de `PB2`. Si `PB2` suelta el lock antes de que se invalide
>    la entrada, un `PB1` puede publicar sin cobertura. Lo baja la fila 1 del reconciliador diario al
>    día siguiente: el atraso es de un día, no los 90 de `F-8CA2-009`. **Causa**: el lock serializa las
>    escrituras, no las lecturas del caché.

#### CONTRADICCIONES DE TEXTO

- **C-R14-1 · `V/03:669-671` contra el caso 6/12.** La frase *«una carrera con ellas sólo puede
  hacer que un conteo vea una publicada de más, y eso rechaza de más, nunca publica de más»* es
  falsa para el conteo de `PB2`, que con una de más despublica de más. **Corrección**: agregar al
  final *«—para `PB1`, `PB3` y `PB7`; para la rama del excedente de `PB2`, ver una de más baja una
  de más, y la devuelve el reconciliador diario (⚠️ punto 3)—»*.

---

## Lo que queda para el owner, en una lista

1. **`R12-OWNER-1`**: `T6` con una suscripción que no cobró. **Recomendado**: `T6` exige un título
   que convierte, y se agrega `T8`.
2. **`R12-OWNER-2`**: un addon `USER`/`GLOBAL` comprado antes del primer cobro. **Recomendado**:
   «válida» es `ACTIVE` con `cobrada: sí`.
3. **`R12-OWNER-3`**: el corte consume el trial de borradores solos y de `abandoned`.
   **Recomendado**: acotarlo a fichas publicadas y a suscripciones que autorizaron.
