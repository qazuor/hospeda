---
title: "FASE 9 completa · R1, R3 y R8 — el grace de tarjeta, S6 y el cambio de plan"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R1, R3 y R8 — el grace de tarjeta, `S6` y el cambio de plan

`DEC-METH-004` (`01-decision-log.md:144-190`) pide dos cosas para declarar un racimo resuelto: que
el camino de cada hallazgo, reejecutado sobre el texto corregido, **ya no llegue**, y que la regla
corregida se verifique contra **todo el dominio que cuantifica**. Este documento hace las dos para
tres racimos de la FASE 8 completa que comparten zona —el grace del pagador con tarjeta, lo que
`S6` deja atrás y el cambio de plan— y clasifica lo que sobra con `DEC-METH-015`
(`01-decision-log.md:5349-5361`).

**Este documento no aplica ningún cambio.** No edita capítulos, ni el log, ni la matriz. Las
correcciones se proponen; las aplica el orquestador.

Abreviaturas de ruta, como en el resto del programa: `B/NN` es
`HOS-1354-billing-cobro-y-proveedor/docs/NN-*.md`; `V/NN` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/NN-*.md`; `D/` es
`HOS-1352-billing-verticals-redesign/docs/`; `N/NN` es `D/nucleo/NN-*.md`. Los informes de la FASE 8
completa están en `D/25-fase-8-completa/`.

---

## 0. El resultado en una tabla

| racimo | hallazgos | DEJA DE LLEGAR | SIGUE LLEGANDO | LLEGA A OTRA COSA | casos del dominio | cierran | borde | contradicción | al owner / sigue | vacíos |
|---|---|---|---|---|---|---|---|---|---|---|
| **R1** | 8 | **8** | 0 | 0 | 22 | 12 | 8 | 0 | 0 | 2 |
| **R3** | 8 | **5** | **2** | **1** | 26 | 18 | 1 | 3 | 4 | 0 |
| **R8** | 8 | **8** | 0 | 0 | 30 | 22 | 0 | 3 | 3 | 2 |
| **total** | **24** | **21** | **2** | **1** | **78** | **52** | **9** | **6** | **7** | **4** |

Contado con `scratchpad/contar-r1r3r8.py` (salida: `R1 22 {'BORDE': 6, 'BORDE-X': 2, 'OK': 12,
'VACIO': 2}` · `R3 26 {'BORDE': 1, 'CONTRA': 3, 'OK': 18, 'X': 4}` · `R8 30 {'CONTRA': 3, 'OK': 22,
'VACIO': 2, 'X': 3}` · `{'DEJA': 21, 'SIGUE': 2, 'OTRA': 1} 24`). En R1, «borde» junta los 6 `BORDE`
y los 2 `BORDE-X`.

**Lo que hay que llevarse**: los caminos de R1 y R8 dejaron de llegar todos. En R3 siguen llegando
dos (`F-8CB2-009`, `F-8CB3-004`) que el consolidado da por resueltos sin que ningún texto los
haya tocado, y uno llega a otra cosa (`F-8CB1-002`: el suspendido ya vuelve, pero pierde su promo
por otro mecanismo). Y recorrer el dominio de R8 sacó **dos residuos de plata en el camino
principal que ningún hallazgo nombró**: la salida de `DEC-SUB-021` para la tarjeta se apoya en
algo que la matriz no midió (§3.5, pendiente 1), y el primer cobro fallido de una sucesora
declarada en `ACTIVE` deja a la persona sin nada, igual que lo que `DEC-SUB-021` cerró para el
grace (§3.5, pendiente 3).

---

## 1. R1 · el grace de tarjeta arranca en el primer rechazo leído por id

### 1.1 La regla corregida, tal como está hoy

`B/12-suscripcion.md:42-44`:

*«**El reloj del grace de un pagador con tarjeta arranca en el primer rechazo de un cobro de
renovación, leído por id (`D17`)**: el registro de cobro del período, con su pago en `rejected`. Un
webhook sin releer no lo arranca.»*

Y sus dos compañeras. `B/03-maquinas-de-estado.md:1520` (§4, *cuándo entra*): *«En un pagador con
tarjeta, es el primer rechazo de un cobro de renovación, leído por id (`B/12` §1.2, `D17`), no el
fin de los reintentos del proveedor, que no emite evento (`GR-3`)»*. `B/03-maquinas-de-estado.md:1521`
(§4, *cuánto dura*): *«**siempre menos que el ciclo de esa versión** (`DEC-SUB-019`): el proveedor
reintenta durante **un ciclo** (sonda 49)»*.

Y la base en la matriz, que era la otra mitad del racimo. `06-mp-validation-matrix.md:201` (`GR-3`,
su 📌 del 24/09): *«**48,0 h sobre un ciclo de 2 días**. Junto con los ciclos de `1 days` (24,0 h)
son dos puntos de la misma regla: **la ventana de reintentos dura un ciclo, no 24 h fijas.**»* Y
`06-mp-validation-matrix.md:280` (`RC-7`): *«📌 **2026-09-24: no son 24 h fijas, es el ciclo**»*.

`P2` ya no dispara `S4` (`B/03-maquinas-de-estado.md:1636`): *«**vence la ventana del proveedor sin
cobro** | `FAILED` | ~~dispara S4~~ **ya no dispara `S4`**»*.

### 1.2 El dominio — 22 casos

La regla cuantifica sobre **cómo empieza el grace de un cobro de renovación con tarjeta**. Cuatro
ejes, cada uno con su fuente:

| eje | valores | fuente |
|---|---|---|
| **canal** por el que nos enteramos del rechazo | a tiempo · demorado · perdido | `WH-2` (`06-…:265`: *«tres llegaron a los 10,3 y 14,3 días»*), `WH-5` (`06-…:268`: *«SÍ se pierden entregas»*) |
| **desenlace** dentro de la ventana del proveedor | un reintento entra en el grace · ningún reintento entra · un cobro en vuelo entra después de `S6` | `B/03:132` (`S5`), `:133` (`S6`), `:134` (`S7`) |
| **ciclo** | mensual · anual | `B/10` (las dos billing options); `DEC-SUB-019` extrapola el anual (`01-…:5060-5061`) |
| **frontera** con `S16` y el pagador manual | primer cobro de un alta · de una sucesora con `D8` · de una sucesora de `SUSPENDED` · cuota manual sin pago | `B/03:131` (guarda de `S4`), `:143` (`S16`), `:1712` (`MP5`) |

Tamaño: 3 × 3 × 2 = **18** casos de tarjeta en renovación, más **4** de frontera = **22**.

### 1.3 Los caminos reejecutados

#### `F-8CB2-002` — con el `FAILED` de `B/12`, la tarjeta nunca entra al grace · **DEJA DE LLEGAR**

- **Paso 1.** *El 1/11 rebota la renovación; `B/12` §1.3 dice que la suscripción «sigue `ACTIVE`».* Hoy
  `B/12:76` dice lo contrario: *«primer rechazo, y el proveedor **sigue reintentando** |
  **`PENDING`** | `S4` → `GRACE_PERIOD`, y **ahí** arranca el reloj»*. **Corta acá.**
- **Paso 2.** *`FAILED` es el evento de `S4` vía `P2`.* `B/12:80-81`: `FAILED` *«**deja de ser lo que dispara
  `S4`**»*; `B/03:1636`, igual. No llega.
- **Pasos 3 y 4.** *La pausa cae antes y `S6` salta desde `ACTIVE`.* Con el reloj arrancado en el día 0, la
  fila está en `GRACE_PERIOD` desde el día 0 y `S6` corre por el reloj al día 10
  (`B/03:133`), mucho antes de la pausa del proveedor al fin del ciclo.
- **Paso 5.** *`S4` no llegó a correr.* Corrió en el paso 1.

La otra lectura que el hallazgo marcaba —*«grace desde el primer rechazo contradice textualmente
`B/12` §1.2»*— es ahora la única: `B/12:46` tacha la regla vieja.

#### `F-8CB3-002` — el grace arranca después de que el proveedor pausó · **DEJA DE LLEGAR**

- **Paso 1.** *Rechazo el día 1, pago `PENDING`, fila `ACTIVE`.* Hoy el pago queda `PENDING` y la fila pasa a
  `GRACE_PERIOD` (`B/12:76`). **Corta acá.**
- **Paso 2.** *El grace arranca «cuando el proveedor deja de reintentar».* Tachado en `B/12:46-47`.
- **Pasos 3 a 5.** Sin paso 2, no hay ciclo entero sin pagar: `S6` corre al vencer el grace, con sus correos
  (`B/03:1537`, *«Los correos del §42.3 son relativos al vencimiento»*).

#### `F-8CB1-006` — dos momentos de arranque incompatibles · **DEJA DE LLEGAR**

- **Paso 1.** *Plan anual, rechazo.* Igual.
- **Paso 2.** *Implementación A (`B/12` §1.3): `PENDING` y `ACTIVE` sin reloj.* Ya no existe: la tabla de
  `B/12:74-78` pone `S4` en la primera fila. **Corta acá.**
- **Pasos 3 y 4.** Sólo queda la implementación B, que es la de `B/03:1520`. El dato que la sostiene, *«la
  sonda 49 midió»*, está ahora en la matriz (`06-…:201`, 📌 del 24/09). Queda la contradicción
  interna de esa fila, en el §5.

#### `F-8CB2-007` — la ventana puede ser de 24 h fijas · **DEJA DE LLEGAR**

- **Paso 1.** *Grace de 10 días validado contra un ciclo de 30.* Igual.
- **Paso 2.** *«Si la ventana es de 24 h (lo único medido)…»* Ya no es lo único medido: `06-…:201` registra
  48,0 h sobre `2 days` y concluye *«la ventana de reintentos dura un ciclo, no 24 h fijas»*.
  **Corta acá.**
- **Paso 3.** `S6` por el segundo evento a las 24 h no ocurre con una ventana de un ciclo.

#### `F-8CD1-001` — el grace sobre una medición que la matriz no registra · **DEJA DE LLEGAR**

- **Paso 1.** *Plan mensual, `S4` → grace de 10 días.* Igual.
- **Paso 2.** *«Si la ventana es de 24 h —la hipótesis que `GR-3` no descarta—».* `GR-3` ya la descarta
  (`06-…:201`). **Corta acá.**
- **Pasos 3 y 4.** No llegan.

Las citas secundarias que el hallazgo enumeraba, releídas: `B/06:443-446` tiene el 📌
*«Contestado el 2026-09-24 (registrado en la matriz el 2026-09-25, `GR-3`)»*; `B/12:29` titula
*«que dura un ciclo»*; los lotes del minuto `:02` están en `RN-1` (`06-…:191`, 📌 del 24/09).
**Lo que no se registró** es la otra cita que el hallazgo marcaba sobre `RN-3`: va en el §5, C2.

#### `F-8CB3-012` — `DEC-SUB-019` cita como medida una sonda bloqueada · **DEJA DE LLEGAR**

El camino es de registro: *«la matriz la registra bloqueada»*. Hoy `06-…:201` tiene el 📌 *«la
sonda 49 se destrabó y separó las dos hipótesis»* y `B/12:129-132` corrige *«sigue `UNKNOWN`»*. Deja
de llegar **con una salvedad**: la misma celda sigue diciendo más arriba, sin tachar, *«**está
bloqueada**»* y *«cuatro intentos dentro de una ventana de 24 h»* (§5, C1).

#### `F-8CB1-018` y `F-8CB2-013` — textos vencidos sobre `GR-3` · **DEJAN DE LLEGAR**

Los tres lugares citados, releídos: `B/12:129` (*«~~`GR-3` … **sigue `UNKNOWN`**.~~ **`GR-3` está
`VERIFIED`**»*), `B/12:998` (*«~~**`GR-3`** … sigue `UNKNOWN`.~~ **Cerrado**»*) y `B/03:345`
(*«~~`GR-3` «sigue `UNKNOWN`»~~ —`GR-3` está `VERIFIED`»*). *«Esta sección no la usa»* ya no está:
`rg 'Esta sección no la usa'` sobre `B/` no devuelve nada.

### 1.4 El dominio recorrido

| # | canal | desenlace | ciclo | resultado | dónde |
|---|---|---|---|---|---|
| 1-2 | a tiempo | un reintento entra en el grace | mensual · anual | ✅ `S4` al rechazo, `S5` al cobro | `B/03:131-132` |
| 3-4 | a tiempo | ningún reintento entra | mensual · anual | ✅ `S6` al vencer el grace, cancela el preapproval | `B/03:133` |
| 5-6 | a tiempo | cobro en vuelo tras `S6` | mensual · anual | ✅ `S7` → `CANCEL_SCHEDULED` (R3) | `B/03:134` |
| 7-12 | demorado | los tres | mensual · anual | ⚠️ **borde**: no está escrito desde cuándo cuenta el reloj si el rechazo se lee días tarde | §1.5, borde R1-b |
| 13-14 | perdido | un reintento entra | mensual · anual | ✅ la fila nunca salió de `ACTIVE` y el cobro entra; si nos falta, lo marca el barrido (`COBRO_SIN_REGISTRAR`) | `B/09:111` |
| 15-16 | perdido | ningún reintento entra | mensual · anual | ⚠️ **borde con plata**: sin `S4`, `ACTIVE` durante toda la ventana del proveedor y `S6` por la pausa, sin grace ni avisos | §1.5, borde R1-a |
| 17-18 | perdido | cobro en vuelo tras `S6` | mensual · anual | vacío: `S6` corre por la pausa del proveedor, que llega al vencer la ventana, y después no hay reintento | `06-…:201` |
| 19 | frontera | primer cobro de un alta | — | ✅ `S16`, no grace | `B/03:143` |
| 20 | frontera | primer cobro de una sucesora con `D8` | — | ✅ `S16` (guarda complementaria por *«al menos un pago acreditado»*) — su consecuencia va a R8, §3.5 pendiente 3 | `B/03:131`, `:195-197` |
| 21 | frontera | primer cobro de una sucesora de `SUSPENDED` | — | ✅ `S16`, cobra al autorizar | `B/12:436-445` |
| 22 | manual | cuota abierta sin pago | — | ✅ `MP5` → `S4`; la regla de tarjeta no aplica | `B/03:1712` |

**Recuento**: 12 ✅, 8 ⚠️ de borde (6 + 2), 0 que al owner, 2 vacíos.

### 1.5 Residuos de R1

**Al owner**: ninguno propio. El que más se le parece —si los reintentos de un plan mensual caen
dentro de un grace de 10 días— sale del dominio de R8 y va allá (§3.5, pendiente 1).

**De borde:**

- **R1-a · el aviso del primer rechazo que se pierde entero.** `WH-5` mide que se pierden entregas
  (`06-…:268`). Si no llega **ninguna** entrega del registro de cobro rechazado, la fila sigue
  `ACTIVE` y nada la mueve: la fila *«cobros del período»* del barrido sólo actúa sobre un
  `approved` que no tenemos (`B/09:111`: *«Y si la lectura del §4 ve un registro con
  `payment.status` = `approved` que nosotros no tenemos acreditado…»*), y ninguna fila de `B/09`
  dispara `S4` (buscar `S4` entre backticks con `rg` sobre `B/09` no devuelve nada). La fila sale por `S6` segundo evento
  cuando el proveedor pausa, al fin de su ventana: **un ciclo de servicio sin cobrar y ningún
  aviso de grace** (en el anual, la ventana de un año es extrapolación, `B/12:134-135`). Es el
  resultado exacto de `F-8CB2-002`, en una población de borde.
  - **¿Está declarado?** Sólo en el log: `01-decision-log.md:5111-5112` (`DEC-MP-008`, *«sólo en
    bordes —un webhook de cobro fallido que se perdió, y la fila sigue `ACTIVE` cuando el proveedor
    pausa»*). No está en el *«NO cierra»* de `B/12` (`:996-1007`) ni en el de `B/03` (`:2641-2766`).
  - **Propuesta** (una de las dos):
    1. **Corrección sin decisión nueva, preferible**: en `B/09` §3, fila *«cobros del período»*,
       agregar: *«**Y si la lectura del §4 da "intentó y se rechazó" sobre el período en curso de
       una fila `ACTIVE` con al menos un pago acreditado, corre `S4`**: es el aviso del primer
       rechazo que no llegó (`WH-5`), leído por id como pide `B/12` §1.2.»* Es la lectura que el
       barrido ya hace, y cumple `D17`.
    2. **Si no se corrige, declararlo** en `B/12`, *«Lo que este capítulo NO cierra»*: *«**Un primer
       rechazo cuyo aviso se pierde entero** (`WH-5`) no arranca el grace: la fila queda `ACTIVE`
       hasta que el proveedor pausa al vencer su ventana —un ciclo— y sale por `S6` en su segundo
       evento, sin los días ni los avisos del §20. **Causa**: el reloj arranca con una lectura por
       id, y el barrido no mira los rechazos. Declarado por `DEC-METH-015`.»*
- **R1-b · el reloj con el aviso demorado.** `B/12:42-44` dice que el reloj arranca *«en el primer
  rechazo … leído por id»*, y no dice si cuenta desde la fecha del rechazo o desde la lectura.
  Con `WH-2` (hasta 14,3 días, `06-…:265`) las dos lecturas dan resultados distintos: contando
  desde el rechazo, el grace puede estar vencido al leerlo y `S6` corre sin que la persona haya
  recibido ningún aviso; contando desde la lectura, el grace se corre, pero nunca más allá de la
  pausa del proveedor (`S6` segundo evento). Ninguna de las dos mueve plata fuera de un ciclo.
  - **¿Está declarado?** No: `rg 'fecha del rechazo|desde la lectura'` sobre `B/12` y `B/03` no
    devuelve nada.
  - **Propuesta**, en `B/12` §1.2, después de la regla: *«**El reloj cuenta desde que lo leímos,
    no desde la fecha del rechazo**: es lo que se observa (§1.2), y los correos del §42.3 son
    relativos al vencimiento (`B/03` §4). Con un aviso demorado (`WH-2`) el grace termina más
    tarde, y nunca después de la pausa del proveedor, que dispara `S6` por su segundo evento.»* Si
    el owner prefiere la otra lectura, es la misma frase al revés; lo que no puede quedar es
    ninguna.

**Contradicciones de texto de R1**: van juntas en el §5 (C1, C2, C3 y C13).

---

## 2. R3 · `S6` contra el cobro en vuelo y contra la sucesión

### 2.1 La regla corregida, tal como está hoy

Tres piezas.

**El cobro en vuelo.** `B/03-maquinas-de-estado.md:134` (`S7`, columna *hacia*): *«`ACTIVE` —
**o `CANCEL_SCHEDULED`** si el cobro entró sobre un preapproval que `S6` ya canceló (la relectura
lo da `cancelled`): la persona **recibe el período que pagó**, con fin de servicio en el fin de ese
período, y `S12` la termina»*. Y `B/05-idempotencia-y-concurrencia.md:86-90` (`C1`): *«un cobro que
igual entra —estaba en vuelo— lleva la fila a **`CANCEL_SCHEDULED`**, no a `ACTIVE`»*.

**La sucesión.** `B/03-maquinas-de-estado.md:133` (`S6`, condición): *«**Y por cualquiera de los
dos eventos, `S6` no ocurre mientras la fila sea la predecesora de una sucesión en curso**»* y
*«**La protección dura una sola ventana por construcción** … desde `GRACE_PERIOD` ya no se declara
una sucesión (`DEC-SUB-021`…; `G-R1-A`)»*.

**La vuelta del suspendido con tarjeta.** `B/20-testing.md:79-81`: *«**Desde una `SUSPENDED` de
pagador con tarjeta sí deja declararla, con una condición: que su preapproval se relea por id como
`cancelled` en ese acto.**»* Y `N/04-invariantes.md:135` (`D8`): *«**con una sola excepción**: la
sucesora de una `SUSPENDED` de pagador con tarjeta cuyo preapproval se releyó `cancelled` cobra al
autorizar»*.

### 2.2 El dominio — 26 casos

| eje | valores | fuente |
|---|---|---|
| **evento de `S6` × estado de origen** | reloj·`GRACE` · `paused`·`ACTIVE` · `paused`·`GRACE` · contracargo·`ACTIVE` · contracargo·`GRACE` · contracargo·`PAUSED COURTESY` · `MP2`·`GRACE` manual | `B/03:133` (columnas *desde* y *evento*), `:1709` (`MP2`) |
| **sucesión en curso** en ese instante | no · sí | `B/03:133` (condición) |
| **lo que llega después de `S6`** | en vuelo sin sucesión · en vuelo con sucesión desde `SUSPENDED` · preapproval reactivado a mano · `MP4` manual · en vuelo tras `S6` por contracargo | `B/03:134` (`S7`), `:146` (`S19`), `:1711` (`MP4`) |
| **la vuelta** | tarjeta · manual · tarjeta con marca `CONTRACARGO` | `B/20:79-81`, `B/03:134`, `B/03:1378-1380` |
| **la lectura que `S6` hace antes** | cobró · no cobró · *«todavía no se sabe»* · falla | `B/09:695-703` |

Tamaño: 7 × 2 = 14, más 5, más 3, más 4 = **26**.

### 2.3 Los caminos reejecutados

#### `F-8CB1-003`, `F-8CB2-004` y `F-8CD1-004` — el cobro en vuelo reactiva y el espejo lo cancela · **DEJAN DE LLEGAR**

Los tres tienen el mismo camino.

- **Paso 1.** *Rechazo el día 0, grace.* Igual (`B/03:131`).
- **Paso 2.** *El día 10 corre `S6`, no ve cobro y cancela el preapproval; hay un reintento en el lote.*
  Igual (`B/03:133`).
- **Paso 3.** *El reintento se acredita y `S7` lleva la fila a `ACTIVE`.* **Corta acá**: la relectura ve el
  preapproval `cancelled` y `S7` lleva a **`CANCEL_SCHEDULED`**, con fin de servicio en el fin del
  período pagado (`B/03:134`).
- **Paso 4.** *El barrido lee `cancelled` contra `ACTIVE` y espeja a `CANCELLED`.* El par ahora es `cancelled`
  × `CANCEL_SCHEDULED`, y `B/03:2574` dice *«nada: es lo esperado»*. La tabla lo confirma también
  del otro lado: `B/03:2578`, *«**Y no alcanza a la `CANCEL_SCHEDULED` de `S7`**, que llega ahí
  justamente porque la relectura ya vio el preapproval `cancelled`»*.
- **Paso 5.** *Juan pagó un mes y quedó cancelado.* Recibe el período que pagó; `S12` lo termina en su fecha.

El texto que `F-8CD1-004` marcaba en `B/05` C1 está tachado y reemplazado (`B/05:79-90`).

#### `F-8CB1-005` — redeclarar una sucesión cada 72 h da servicio infinito · **DEJA DE LLEGAR**

- **Paso 1.** *Juan cae en grace.* Igual.
- **Paso 2.** *El día 9 pide un cambio de plan.* **Corta acá**: *«**`GRACE_PERIOD`** ✚ | … | **qué hacer para
  regularizar** … Y que **recién con la suscripción al día** puede cambiar de plan»*
  (`B/03:1399`), y `G-R1-A` saca a `GRACE_PERIOD` del conjunto de declaración (`B/20:87-95`,
  *«**El conjunto de declaración queda en tres**»*).
- **Pasos 3 a 6.** No llegan. La prosa y la fila que el hallazgo enfrentaba ya dicen lo mismo para los dos
  primeros eventos (`B/03:1497-1501` y `:133`). Sobre el tercero no: §5, C4.

#### `F-8CB2-008` — `B/03` §4 contra la fila `S6` · **DEJA DE LLEGAR**

El camino es *«Juan está en `GRACE_PERIOD` (día 8 de 10) y pide cambiar de plan»*. **Corta en el
primer paso**, por la misma cita de `B/03:1399`. La población que la protección sigue cuidando
—una sucesión declarada en `ACTIVE` cuya predecesora entra en grace durante la ventana— la
cubren con las mismas palabras la prosa (`B/03:1511-1515`) y la fila (`B/03:133`, *«**Lo que sigue
vigente** es la protección misma…»*).

#### `F-8CB1-002` — el suspendido con tarjeta no tiene por dónde volver · **LLEGA A OTRA COSA**

- **Paso 1.** *Grace, `S6`: `SUSPENDED` con el preapproval `cancelled`.* Igual.
- **Paso 2.** *Quiere pagar; la pantalla ofrece re-autorizar.* Igual (`B/19-superficies.md:115`, fila 10).
- **Paso 3.** *`G-R1-A` rechaza la sucesión desde `SUSPENDED`.* **Corta acá**: `B/20:79-81` la admite con el
  preapproval releído `cancelled`; `S1` la acepta (`B/03:128`: *«la `SUSPENDED` de tarjeta tiene
  su propia relectura, que exige `cancelled`»*); la sucesora cobra al autorizar (`B/12:436-445`,
  `N/04:135`) y hay candado `B` libre.
- **Pasos 4 y 5.** No hace falta darse de baja. **Pero el segundo daño que el hallazgo nombraba sigue
  llegando por otro camino**: *«Pierde su promo `forever` (la redención es única por usuario y
  código)»*. Antes la perdía por `S23` más un alta nueva; hoy la pierde **en la propia sucesión**,
  porque `S18` no re-apunta la redención: *«**la redención de promo NO se re-apunta: la promo se
  pierde con el cambio de plan**»* (`B/03:145`) y *«**Y la persona NO puede volver a canjear el
  mismo código en la sucesora**»* (`B/14-promos-cortesias-y-grants.md:121-124`). Los addons de
  `VERTICAL_SUBSCRIPTION` sí se salvan: `S18` re-apunta los complementos (`B/03:145`).

**Veredicto**: el camino principal del hallazgo se cortó; su consecuencia de plata sobre la promo
llega por otra regla (`B/14` §2.2, pendiente 7 del 25/09), escrita para el cambio de plan que la
persona **elige**, no para la vuelta de un suspendido al mismo plan. Va al owner, §2.5 pendiente 2.

#### `F-8CB2-009` — `MP2` dispara `S6` con un evento que `S6` no declara · **SIGUE LLEGANDO**

El camino, releído: *«Un admin declara el impago de Juan (manual) el día 2 del grace. `MP2`
ordena "`S6`, sin esperar el reloj"»*. `B/03:1709` sigue diciendo *«la suscripción va a `SUSPENDED`
por `S6`, sin esperar el reloj»*. Los eventos de `S6` en `B/03:133` son hoy **tres** —*«se agota el
reloj»*, *«se lee `paused` en el proveedor»*, *«se lee `charged_back`»*— y **ninguno es el acto del
admin**. Por la regla 1 del núcleo (`N/03-maquinas-de-estado.md:34`, *«Lo que no está, no pasa»*),
`MP2` no suspende. No se tocó: `rg 'MP2'` sobre `B/03` devuelve sólo `:1709` y las menciones de
contexto. Es una contradicción de texto sin decisión detrás: §5, C8.

#### `F-8CB3-004` — *«todavía no se sabe»* no tiene salida · **SIGUE LLEGANDO**

- **Paso 1.** *El inventario no cierra: contador mayor que los registros listados.* Igual: `B/09:692`
  (*«**lag** … **no se sabe todavía**»*).
- **Paso 2.** *Cada corrida de `S6` no actúa.* Igual: `B/03:133`, *«o contesta "todavía no se sabe" … `S6` no
  ocurre en esta corrida»*; `B/09:700-703`.
- **Paso 3.** *El segundo evento tiene la misma condición.* Igual: la condición de `S6` es una sola para sus
  tres columnas de evento, y la lectura del `B/09` §4 la usan los dos primeros.
- **Paso 4.** *Avisa a partir del segundo día, sin marca, sin escalamiento.* Igual: `B/09:744-752`, *«**se
  avisa** por el canal de `DEC-OBS-001` … **sin abrir una marca** … **El barrido sigue
  releyéndolo** cada corrida hasta que se resuelva»*.

Lo único nuevo desde el hallazgo es que *«una corrida»* pasó a medirse en tiempo (*«más de un día
después del `date_created`»*, `B/09:744-746`). No hay cota, ni marca, ni escalamiento. Y la
segunda mitad del hallazgo —el buscador `/authorized_payments/search` como fuente, sin figurar
como excepción de `D6`— sigue igual: `N/04:144` (`D17`) declara **una** excepción, la del barrido
de creaciones, y `B/09:682` usa el listado para *«¿qué intentos hubo?»*. El consolidado lo da por
cerrado dentro de R3 (`00-hallazgos.md:337`), pero ninguna de las tres cosas de esa fila lo toca.
Va al owner, §2.5 pendiente 4, porque el propio hallazgo lo pedía (*«Necesita decisión del owner:
sí»*).

### 2.4 El dominio recorrido

| # | caso | resultado | dónde |
|---|---|---|---|
| 1 | reloj·`GRACE`, sin sucesión | ✅ `S6`, cancela el preapproval | `B/03:133` |
| 2 | reloj·`GRACE`, con sucesión | ✅ no corre mientras la sucesión esté en curso; acotado por una ventana | `B/03:133`, `:1511-1515` |
| 3 | `paused`·`ACTIVE`, sin sucesión | ✅ `S6` segundo evento | `B/03:2573` |
| 4 | `paused`·`ACTIVE`, con sucesión | ✅ no corre; y no se puede **declarar** una nueva sobre `paused` | `B/03:128` (`S1`), `:2734-2743` |
| 5 | `paused`·`GRACE`, sin sucesión | ✅ `S6` segundo evento | `B/03:2573` |
| 6 | `paused`·`GRACE`, con sucesión | ✅ no corre; el preapproval pausado no cobra | `B/03:133` |
| 7 | contracargo·`ACTIVE`, sin sucesión | ✅ `S6` tercer evento, sin las guardas del impago | `B/03:133` |
| 8 | contracargo·`ACTIVE`, con sucesión | ⚠️ la tabla corre `S6` y `S31`; la prosa del §4 dice que no corre | §5, C4 |
| 9 | contracargo·`GRACE`, sin sucesión | ✅ ídem 7 | `B/03:133` |
| 10 | contracargo·`GRACE`, con sucesión | ⚠️ ídem 8 | §5, C4 |
| 11 | contracargo·`PAUSED COURTESY`, sin sucesión | ✅ `S6`, cierra la cortesía con `fin_real` | `B/03:133` |
| 12 | contracargo·`PAUSED COURTESY`, con sucesión | ⚠️ ídem 8 (una predecesora puede pausarse durante la ventana: filas 1-2 del recorrido, `B/03:320-321`) | §5, C4 |
| 13 | `MP2`·`GRACE` manual, sin sucesión | ❌ evento no declarado en `S6` | `F-8CB2-009` |
| 14 | `MP2`·`GRACE` manual, con sucesión | ❌ ídem | `F-8CB2-009` |
| 15 | en vuelo, sin sucesión | ✅ `S7` → `CANCEL_SCHEDULED` | `B/03:134` |
| 16 | en vuelo, con sucesión desde `SUSPENDED` | ✅ `S19` lo retiene; la rama 2 reevalúa por `S7`, que por la relectura va a `CANCEL_SCHEDULED` | `B/03:146`, `B/12:610` |
| 17 | preapproval reactivado a mano | ✅ la relectura lo ve vivo: `S7` → `ACTIVE` | `B/03:134` |
| 18 | `MP4` manual | ✅ `S7` → `ACTIVE` | `B/03:1711` |
| 19 | en vuelo tras `S6` por contracargo | ⚠️ **borde**: `S7` le devuelve servicio hasta el fin del período a quien desconoció un cargo | §2.5, borde R3-c |
| 20 | vuelta con tarjeta | ❌ vuelve, **pero pierde la promo** | §2.5, pendiente 2 |
| 21 | vuelta manual | ✅ `MP4` → `S7`; `G-R1-A` le prohíbe la sucesión | `B/20:76-79` |
| 22 | vuelta con tarjeta y marca `CONTRACARGO` | ✅ admitida: la marca no bloquea a una `SUSPENDED` de tarjeta | `B/03:1378-1380` |
| 23 | lectura: cobró | ✅ `S5`, y asienta el cobro | `B/03:132` |
| 24 | lectura: no cobró | ✅ `S6` | `B/03:133` |
| 25 | lectura: *«todavía no se sabe»* | ❌ sin cota, sin marca | `F-8CB3-004` |
| 26 | lectura: falla | ✅ no actúa, reintenta la corrida siguiente (`D17`) | `B/03:133` |

**Recuento**: 18 ✅, 3 ⚠️ de contradicción, 1 ⚠️ de borde, 4 ❌.

### 2.5 Residuos de R3

#### Al owner · R3

**Pendiente 2 · La vuelta del suspendido con tarjeta le quita la promo.**

*Juan* tiene Básico con una promo `forever` del 30 %. Su tarjeta falla, pasa el grace y `S6` lo
suspende. Cambia de tarjeta y vuelve **al mismo plan** por el checkout: la única vuelta que el
diseño le da es una sucesión desde `SUSPENDED` (`B/20:79-81`). `S18` cierra esa sucesión y **no
re-apunta la redención** (`B/03:145`), y `UNIQUE(promo_code_id, user_id)` le impide canjear el
código otra vez (`B/14:121-124`). Juan pasa a pagar precio de lista para siempre. El aviso de
suspensión (`B/19:115`, fila 10) le dice *«volvé a suscribirte con una tarjeta que funcione»* y no
le dice que pierde la promo; el aviso de la fila 7 (`B/19:112`) está escrito para *«cambiar de plan
—upgrade, downgrade o de ciclo—»*. Lo mismo le pasa a quien entró por `S7` a `CANCEL_SCHEDULED` y
vuelve por el arrepentimiento.

La regla de `B/14:101-104` se dio con una razón que acá no aplica: *«La promo se dio sobre el plan
en que estaba; si la persona cambia de plan…»*. Juan no cambia de plan.

1. **Aceptarlo y decirlo.** La fila 10 de `B/19` agrega *«si tenías una promo, al volver la
   perdés»*, y `B/14` §2.2 lo nombra como caso. Costo: dos líneas. Riesgo: un reclamo de alguien
   que perdió un descuento por un rechazo de tarjeta.
2. **`S18` re-apunta la redención cuando la predecesora es una `SUSPENDED` de tarjeta y la sucesora
   ancla la misma versión de plan.** Costo: una rama en `S18` y en el inventario de `B/02` §2.6;
   choca con la forma que `B/14` §2.2 eligió (*«No es una escritura de `S18`: es la ausencia de
   una»*). Riesgo: el contador de N cobros tiene que viajar (`B/02` §2.4).
3. **Re-apuntarla siempre desde `SUSPENDED`**, sea el plan que sea. Más simple que la 2 y contradice
   de frente la pendiente 7 para cualquier plan distinto.

**Recomendación: 1.** Es coherente con *«en grace no se cambia de plan: primero se regulariza»*
(`DEC-SUB-021`): quien llega a `SUSPENDED` no regularizó, y perder un descuento es una consecuencia
proporcionada que no agrega mecanismo. Lo que no puede pasar es que Juan se entere en la factura.

**Pendiente 4 · *«Todavía no se sabe»* no tiene cota (`F-8CB3-004`, sigue llegando).**

*Juan* entra en grace. El proveedor tiene un registro de cobro que su listado no indexa: el
contador dice 3 y el listado devuelve 2 (`B/09:692`). `S6` no actúa (`B/03:133`); desde el día
siguiente sale un aviso agregado diario, sin marca (`B/09:744-752`). Mientras el listado no se
ponga al día, Juan tiene servicio completo, y la pausa del proveedor tampoco lo corta, porque el
segundo evento de `S6` pasa por la misma lectura. La población es de borde —el desfase medido es
de minutos (`B/09:750`)—, pero el hallazgo pidió una decisión y no la hubo.

1. **Declararlo como borde** en el *«NO cierra»* de `B/09`, con el aviso diario como único control.
   Costo: cero. Riesgo: servicio sin cobrar mientras dure el desfase, sin nadie obligado a mirarlo.
2. **A los 3 días, marca.** Mismo plazo que `CANCELACIÓN_SIN_CONFIRMAR` (`B/03:2577`), con un motivo
   nuevo (el 21) que entra al listado accionable y escala por `puesta_en`. Costo: un motivo más y
   el recuento de los inventarios que cuentan motivos (`B/02` §2.5, `B/03:109-112`, `:141`).
   Riesgo bajo.
3. **A los N días, `S6` corre igual.** Costo bajo. Riesgo: suspender a alguien que sí pagó y cuyo
   cobro todavía no se indexó.

**Recomendación: 2.** Es la forma que el diseño ya usa para un caso trabado que no es divergencia
(reintentar y, a los 3 días, marcar), y convierte *«nadie está obligado a mirarlo»* en un caso con
reloj. Si el owner prefiere no sumar motivos, la 1, con el texto de abajo.

Texto de la 1, para `B/09`, *«Lo que este capítulo NO cierra»*: *«**Un cobro que sigue en
"todavía no se sabe" no tiene cota**: `S6` no actúa mientras dure (`B/03` §3.2), y el único
control es el aviso diario del §6.2, sin marca. **Causa**: la lectura del §4 exige el inventario
completo, y el listado del proveedor puede ir atrás de su contador. Declarado por
`DEC-METH-015`.»*

#### De borde · R3

- **R3-c · el cobro en vuelo después de un `S6` por contracargo.** Si `S6` corrió por su tercer
  evento sobre una fila en grace y un reintento en vuelo se acredita, `S7` cumple sus cuatro
  condiciones y lleva la fila a `CANCEL_SCHEDULED` (`B/03:134`): servicio hasta el fin del período
  a quien desconoció un cargo, contra *«si la fila da servicio, se corta en el acto»*
  (`01-…:5175`). No está declarado: `rg 'en vuelo'` sobre `B/03` sólo lo nombra para el impago.
  **Propuesta**, en `B/03`, *«Lo que esta mitad NO cierra»*: *«**Un cobro en vuelo que se acredita
  después de un `S6` por contracargo** entra por `S7` a `CANCEL_SCHEDULED` y devuelve servicio
  hasta el fin de ese período. **Causa**: `S7` se escribió para el borde del impago, y sus
  condiciones no miran por qué evento corrió `S6`. Tiene que coincidir un reintento en vuelo con
  un contracargo sobre la misma fila, y la marca `CONTRACARGO` ya abierta pone a una persona
  delante. Declarado por `DEC-METH-015`.»*
- **R3-d · el aviso de quien entra por `S7` a `CANCEL_SCHEDULED`.** La fila 10 de `B/19` le dijo
  *«ya no se te va a cobrar»* (`B/19:115`) y después se le cobró. Ninguna fila de `B/19` §4 ni de
  `N/07` §6 nombra este desenlace (`rg 'S7'` sobre `B/19` no devuelve nada). **Propuesta**, en
  `B/19`, *«Lo que este capítulo NO cierra»*: *«**Qué se le dice a quien entra por `S7` a
  `CANCEL_SCHEDULED`** —un cobro en vuelo que se acreditó después de que el aviso de suspensión le
  dijo que no se le iba a cobrar—. **Causa**: el destino se agregó a `S7` en la FASE 8 completa
  sobre un borde de milisegundos, sin fila de superficie. Declarado por `DEC-METH-015`.»*

---

## 3. R8 · el cambio de plan en grace, y quién decide la dirección

### 3.1 La regla corregida, tal como está hoy

**En grace no se cambia de plan.** `01-decision-log.md:5202-5205` (`DEC-SUB-021`): *«**Desde
`GRACE_PERIOD` no se declara una sucesión.** El pagador con tarjeta **cambia la tarjeta**
(`EX-36`); los reintentos del proveedor cobran con ella, la fila vuelve a `ACTIVE` por `S5`, y recién
ahí puede cambiar de plan. El pagador manual **paga su cuota**.»* En los capítulos: `B/03:1525` (§4,
*qué se puede hacer adentro*), `B/03:1399` (§3.3.1) y `B/20:87-95` (`G-R1-A`, *«**El conjunto de
declaración queda en tres**»*).

**La dirección la da el veredicto.** `12-contrato-de-cobertura.md:925`: *«**La comparación la hace
verticales, que es dueño de las tablas, y billing recibe un VEREDICTO.**»* Y `:936`: *«**El veredicto
rige TODO cambio de plan, no sólo el del plan retirado**»*.

**En un cambio trabado emite sólo la sucesora.** `12-contrato-de-cobertura.md:461-463`: *«**Emite
sólo la sucesora** … **una fila con una sucesora en `ACTIVE` apuntándola (`sucede_a`) no emite
fuente**, aunque su cancelación en el proveedor haya fallado y siga marcada»*.

### 3.2 El dominio — 30 casos

| eje | valores | fuente |
|---|---|---|
| **estado de la predecesora al pedir el cambio** | `PENDING_AUTHORIZATION` · `ACTIVE` tarjeta `authorized` · `ACTIVE` tarjeta no `authorized` · `ACTIVE` manual · `GRACE` tarjeta · `GRACE` manual · `PAUSED` por pedido · `PAUSED` por cortesía · `SUSPENDED` tarjeta `cancelled` · `SUSPENDED` manual · `CANCEL_SCHEDULED` · terminales | `B/03:45-56` (los nueve estados), `B/20:76-102` (`G-R1-A`) |
| **lugares que enuncian la dirección** | `V/10` §2 · `B/10` §3.5 · `B/12` §2.1 · contrato §4.1 · `DEC-ARCH-008` · `V/descomposicion.md` §2.9 | `rg 'rank'` sobre las dos épicas, el núcleo y el contrato |
| **el primer cobro de la sucesora falla**, por estado de declaración admitido | `ACTIVE` tarjeta · `ACTIVE` manual · `CANCEL_SCHEDULED` · `SUSPENDED` tarjeta | `B/03:143` (`S16`), `:156` (`S29`) |
| **quién emite durante la sucesión** | antes de autorizar · trabada después de autorizar — × `ACTIVE`, `GRACE` (por `S4`), `CANCEL_SCHEDULED`, `SUSPENDED` | contrato `:405-416`, `:456-471` |

Tamaño: 12 + 6 + 4 + 8 = **30**.

### 3.3 Los caminos reejecutados

#### `F-8CD1-002` — «cobro inmediato» y «si falla, sigue en grace» · **DEJA DE LLEGAR**

- **Paso 1.** *Juan, `GRACE_PERIOD`, pide bajar a un plan más barato.* **Corta acá**: `B/03:1399`, la
  operación no se ofrece; `G-R1-A` rechaza la declaración (`B/20:87`). La prosa que el hallazgo
  citaba está tachada (`B/03:1525`), y `DEC-SUB-003` está `SUPERSEDED` (`01-…:682`).
- **Pasos 2 a 4.** No llegan.

#### `F-8CB1-009` — si el primer cobro del plan nuevo falla, la persona se queda sin nada · **DEJA DE LLEGAR**

*«Juan está en grace y pide un downgrade.»* **Corta en el primer paso**, por las mismas citas.
**Pero el mecanismo del daño —`S17` cancela al autorizar, `S16` mata a la sucesora si su primer
cobro se rechaza— sigue vivo fuera del grace**, y el hallazgo no lo miró porque su camino arrancaba
en grace. Va al owner, §3.5 pendiente 3.

#### `F-8CD1-003` — `rank` contra veredicto · **DEJA DE LLEGAR**

- **Paso 1.** *Pro se rediseña y baja un límite.* Igual.
- **Paso 2.** *Juan cambia de Básico a Pro.* Igual.
- **Paso 3.** *Por `V/10` §2, upgrade por `rank`.* **Corta acá**: `V/10-verticales-planes-billing-options.md:95`
  tacha *«los `rank` de las versiones vigentes y vendibles»* y dice *«**las dos versiones del
  cambio** … **y no su `rank`** … `direcciónDeCambio`»*.
- **Paso 4.** *Por `DEC-ARCH-008`, downgrade.* Es la única lectura: `B/10:93-104` y `B/12:156-160` nombran el
  veredicto, y el contrato quitó *«el único caso»* (`12-contrato…:935-938`). Queda el texto viejo
  en el log: §5, C9.

#### `F-8CC1-013` — `B/10` §3.5 no nombra el veredicto · **DEJA DE LLEGAR**

`B/10-verticales-planes-billing-options.md:93-97`: *«~~**La dirección se deriva del delta…**~~ **La
dirección no la deriva billing: la decide el veredicto de verticales,
`direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA`**»*. `rg 'direcciónDeCambio'` sobre
`B/` devuelve `B/10:95` y `B/12:157`.

#### `F-8CA1-012` — «está pagando las dos», con la predecesora en grace · **DEJA DE LLEGAR**

*«Juan en `GRACE_PERIOD` con Premium cambia a Básico.»* **Corta en el primer paso** (no se declara
desde el grace). Y la regla que el hallazgo atacaba también cambió: *«~~Dos fuentes `SUSCRIPCIÓN`…~~
**Desde el 2026-09-25 no son posibles**»* (`12-contrato…:467-471`), con la razón tachada
(`:473-481`).

#### `F-8CC1-007` — el cliente suma dos planes con el crédito de uno · **DEJA DE LLEGAR**

- **Pasos 1 y 2.** *Básico `ACTIVE` pide Premium, autoriza, `S17` falla: las dos filas emiten.* **Corta
  acá**: *«**Emite sólo la sucesora**»* (`12-contrato…:461`), repetido en `B/03:103-106`.
- **Pasos 3 y 4.** `fuentes` trae una sola `SUSCRIPCIÓN`: 20 fichas y no 25 (`12-contrato…:490-492`).

#### `F-8CB1-004` — la ventana reducida protege la autorización, no el enterarnos · **DEJA DE LLEGAR**

- **Pasos 1 y 2.** *Cobro el día D a las 00:30; Juan autoriza a las 23:58 de D-1; el webhook se demora.* Igual.
- **Paso 3.** *El job de `S3` no tiene cadencia escrita y todavía no relee.* **Corta acá**:
  `B/03:1467-1470`, *«**Y sobre una sucesora con tarjeta de ventana reducida, la relectura corre EN
  EL CORTE** —las 00:00 `-04` del día del cobro de la predecesora— **y antes del primer lote en que
  ese cobro puede caer**»*; lo mismo en `B/12:810-815`.
- **Pasos 4 a 6.** La relectura ve `authorized`, corre `S2` y `S17` cancela la predecesora antes del lote de
  la 01:02.

Lo que no cierra está anotado en `B/12:815-822` (§3.5, borde R8-b).

#### `F-8CC1-010` — la sucesora cubre hasta 72 h antes de pagar · **DEJA DE LLEGAR**

- **Paso 1.** *Grace.* Igual.
- **Paso 2.** *Pide Premium desde el grace.* **Corta acá** (`B/03:1399`, `G-R1-A`).
- **Pasos 3 y 4.** No llegan. La afirmación que el hallazgo marcaba como falsa está corregida: `B/12:288-291`
  (*«**Eso vale para un alta, y no para una sucesora con tarjeta** … pueden pasar **hasta las 72 h
  de la ventana**»*) y `B/12:352-355`. La política —que una sucesora sin crédito no emita hasta su
  primer pago— quedó con *«⚠️ … no está decidido»* (`B/12:294-295`): §3.5, borde R8-a.

### 3.4 El dominio recorrido

| # | caso | resultado | dónde |
|---|---|---|---|
| 1 | declarar desde `PENDING_AUTHORIZATION` | ✅ no se ofrece | `B/03:1397` |
| 2 | desde `ACTIVE` tarjeta `authorized` | ✅ se admite, con `D8` y ventana reducida | `B/03:128`, `B/12:781-787` |
| 3 | desde `ACTIVE` tarjeta no `authorized` | ✅ no se ofrece, y la relectura corre `S6` | `B/03:128`, `B/19:131` |
| 4 | desde `ACTIVE` manual | ✅ se admite; su crédito corto se corrige | `B/12:854-864` |
| 5 | desde `GRACE` tarjeta | ❌ no se ofrece; la salida *«cambiá la tarjeta»* se apoya en algo no medido | §3.5, pendiente 1 |
| 6 | desde `GRACE` manual | ✅ no se ofrece; *«pagá tu cuota»* | `B/03:1399` |
| 7 | desde `PAUSED` por pedido | ✅ no se ofrece | `B/03:1398` |
| 8 | desde `PAUSED` por cortesía | ✅ ídem (la fila es por estado, no por motivo) | `B/03:1398` |
| 9 | desde `SUSPENDED` tarjeta `cancelled` | ⚠️ se admite y cobra al autorizar; `B/12` §4.3 le atribuye «días» de servicio | §5, C5 |
| 10 | desde `SUSPENDED` manual | ✅ `G-R1-A` lo prohíbe; vuelve por `MP4` | `B/20:76-79` |
| 11 | desde `CANCEL_SCHEDULED` | ✅ se admite; `S17` no manda nada | `B/03:1359` |
| 12 | desde un terminal | ✅ no hay predecesora viva: alta nueva | `B/03:1360` |
| 13 | dirección en `V/10` §2 | ✅ veredicto | `V/10:95` |
| 14 | dirección en `B/10` §3.5 | ✅ veredicto | `B/10:93-104` |
| 15 | dirección en `B/12` §2.1 | ✅ veredicto | `B/12:156-160` |
| 16 | dirección en el contrato §4.1 | ✅ veredicto para todo cambio | `12-contrato…:925`, `:936` |
| 17 | dirección en `DEC-ARCH-008` | ⚠️ conserva *«el único caso donde la regla hace falta»* | §5, C9 |
| 18 | dirección en `V/descomposicion.md` §2.9 | ⚠️ cita como vigente el texto tachado de `B/10` | §5, C10 |
| 19 | primer cobro falla, sucesora de `ACTIVE` tarjeta | ❌ `S16`; la predecesora ya está `CANCELLED` | §3.5, pendiente 3 |
| 20 | primer cobro falla, sucesora de `ACTIVE` manual | ✅ no hay `S16`: la fila llega a `ACTIVE` sólo con la cuota pagada | `B/03:156` (`S29`) |
| 21 | primer cobro falla, sucesora de `CANCEL_SCHEDULED` | ❌ ídem 19 | §3.5, pendiente 3 |
| 22 | primer cobro falla, sucesora de `SUSPENDED` tarjeta | ✅ `S16` en minutos; no tenía servicio que perder | `B/12:351-353` |
| 23 | antes de autorizar, predecesora `ACTIVE` | ✅ emite la predecesora | `12-contrato…:409` |
| 24 | antes de autorizar, predecesora en `GRACE` por `S4` | ✅ emite, *«la misma `SUSCRIPCIÓN`»* | `12-contrato…:508` |
| 25 | antes de autorizar, predecesora `CANCEL_SCHEDULED` | ✅ emite hasta su fecha | `12-contrato…:414` |
| 26 | antes de autorizar, predecesora `SUSPENDED` | ✅ nadie emite: piso, declarado | `12-contrato…:443-454` |
| 27 | trabada, predecesora `ACTIVE` | ✅ emite sólo la sucesora | `12-contrato…:461-463` |
| 28 | trabada, predecesora en `GRACE` | ✅ ídem | `12-contrato…:479-481` |
| 29 | trabada, predecesora `CANCEL_SCHEDULED` | vacío: el preapproval ya está cancelado, `S17` no manda nada | `B/03:1359` |
| 30 | trabada, predecesora `SUSPENDED` | vacío: ídem, `S6` lo canceló | `B/03:2575` |

**Recuento**: 22 ✅, 3 ⚠️ de contradicción, 3 ❌, 2 vacíos.

### 3.5 Residuos de R8

#### Al owner · R8

**Pendiente 1 · «Cambiá la tarjeta» no está medido como salida del grace.**

`DEC-SUB-021` le da al pagador con tarjeta en grace **una sola salida**: *«**cambia la tarjeta**
(`EX-36`); los reintentos del proveedor cobran con ella, la fila vuelve a `ACTIVE` por `S5`»*
(`01-…:5203-5204`). Lo repiten `B/03:1399`, `B/03:1525`, `B/19:130` (fila 17-bis) y `B/20:89`.
Y la decisión se declara apoyada en *«**Contexto medido**: `EX-36` … y `GR-3`»* (`01-…:5196-5198`).

Ninguna de las dos filas mide lo que la salida necesita:

- `EX-36` (`06-…:391`) mide que **se puede cambiar la tarjeta** de un preapproval vivo. No mide que
  el reintento de un registro de cobro **ya abierto** use la tarjeta nueva.
- `GR-3` (`06-…:201`) mide cuatro intentos y una ventana de un ciclo, **sobre sujetos de 1 y 2
  días**. Cuándo caen esos intentos dentro de una ventana de 30 días no está medido: *«mensual y
  anual, que son extrapolación»*. Con 1 día, el último reintento cae ~18 h después del primero; si
  la forma escala, los reintentos de un plan mensual caen hacia los días 7, 13 y 18, y **un grace
  de 10 días ve uno o ninguno**.
- Lo que sí lo pregunta está `UNKNOWN`: `GR-1` (`06-…:199`), *«Lo que hay que medir es si un pago
  que entra DENTRO de esa ventana cierra el ciclo fallido, y eso no se probó»*.

`B/12:134-137` dice que la ventana mensual sin medir *«**Ninguna de las dos cambia el diseño**»*.
Desde `DEC-SUB-021` sí lo cambia: es de lo que depende que la única salida funcione.

*Juan*, mensual, rechazo el día 0, grace hasta el día 10. El día 2 ve la pantalla de la fila 17-bis,
cambia la tarjeta y la validación de ARS 0 pasa. El próximo reintento del proveedor cae el día 12.
El día 10 corre `S6`: `SUSPENDED` y preapproval cancelado. Juan hizo exactamente lo que la pantalla
le pidió y queda suspendido; para volver tiene que pasar por el checkout, y pierde la promo si tenía
una (pendiente 2).

Por la regla 3 del log (`01-…:46-47`, *«Una decisión sobre Mercado Pago no puede tomarse mientras
su fila … diga `UNKNOWN`»*), la premisa de la salida está sobre una fila `UNKNOWN`.

1. **Condicionar la salida a `GR-1` y medirla.** Registrar en `DEC-SUB-021` que la frase *«los
   reintentos del proveedor cobran con ella»* está condicionada a `GR-1`, como `DEC-SUB-010` lo está
   a su segunda lectura (`01-…:5378`), y medir con el próximo sujeto mensual que falle. Costo: una
   medición que depende de un rechazo real (la tarjeta del owner ya los produjo, `RN-2`). Riesgo:
   mientras tanto, el caso de Juan.
2. **La 1, más una superficie que no prometa.** La fila 17-bis y los correos del grace dicen *«si el
   próximo intento no llega antes del día X, vas a tener que volver a suscribirte»*. Costo: texto.
   Riesgo: ninguno nuevo.
3. **Si la persona cambió la tarjeta durante el grace, el reloj espera el próximo reintento.** `S6`
   por el reloj no corre sobre una fila con la tarjeta cambiada en el grace, y la corta la pausa del
   proveedor (`S6` segundo evento). Costo: una condición en `S6` y una columna que registre el
   cambio. Riesgo: devuelve, acotado, el problema que `DEC-SUB-019` cerró —hasta un ciclo de
   servicio si la tarjeta nueva también falla—.

**Recomendación: 2.** No reabre `DEC-SUB-019` ni `DEC-SUB-021`, no promete lo que no está medido, y
la medición de la 1 decide después si hace falta la 3.

**Pendiente 3 · El primer cobro fallido de una sucesora declarada en `ACTIVE` deja a la persona sin
nada.**

Es el mismo mecanismo que `DEC-SUB-021` cerró para el grace (*«`S17` cancela la predecesora al
**autorizar** la sucesora y `D8` le difiere el primer cobro, así que si ese cobro falla … la persona
se queda sin nada»*, `B/20:91-93`), sobre la población que la decisión dejó abierta.

*Juan* paga Básico hace un año, con un addon de ficha. El día 20 pide Premium, autoriza, `S17`
cancela Básico y `S18` re-apunta el addon a la sucesora (`B/03:145`). El primer cobro de Premium,
diferido por `D8` y por su crédito, se rechaza: la sucesora no tiene ningún pago acreditado, así
que corre `S16` y no `S4` (`B/03:131`, `:143`) → `CHARGE_DECLINED`, terminal, sin grace. Juan queda
sin plan, su addon queda huérfano, y tiene que suscribirse de nuevo desde cero. Lo mismo desde
`CANCEL_SCHEDULED` (el arrepentimiento). Sobre el pagador manual no pasa (`S29` exige la cuota
pagada), y sobre la `SUSPENDED` de tarjeta no hay nada que perder.

`rg 'sin nada'` sobre `B/` devuelve sólo el caso del grace (`B/20:92`) y el de `D7`
(`B/12:486`): esta consecuencia no está escrita en ningún lado.

1. **Aceptarla y decirla antes de confirmar.** La pantalla del cambio de plan dice *«si el primer
   cobro del plan nuevo no entra, vas a tener que volver a suscribirte»*, y `B/12` §4.3 lo nombra
   junto al caso de la sucesora sin crédito. Costo: texto. Riesgo: la persona pierde plan y addon
   por un rechazo, avisada.
2. **Una sucesora cuya predecesora cobró va a `S4` y no a `S16`.** El grace se lee por relación y no
   por autorización. Costo: reabre la lectura *«por autorización»* que `B/03:60-69` defiende, y
   choca con que el proveedor puede haber cancelado ya el preapproval (`PA-6`, `UNKNOWN`), que es un
   grace que no puede terminar en pago. Riesgo alto.
3. **`S17` espera el primer cobro de la sucesora.** Es la alternativa 2 que `DEC-SUB-021` descartó
   (`01-…:5211-5213`), y además choca con la ventana reducida, que existe para que `S17` corra
   **antes** del cobro de la predecesora.

**Recomendación: 1.** Es la única que no reabre una decisión, y el caso tiene la misma forma que el
alta cuyo primer cobro se rechaza, que el diseño ya acepta (`B/12:297-300`). La diferencia es que
esta persona tenía algo, y por eso hay que decírselo antes.

#### De borde · R8

- **R8-a · la sucesora con poco crédito emite antes de pagar.** Declarado en línea en
  `B/12:294-295`: *«⚠️ **Que una sucesora sin crédito no emita hasta su primer pago sería política, y
  no está decidido**»*. No está en *«Lo que este capítulo NO cierra»* (`B/12:996-1007`). Desde
  `DEC-SUB-021`, la sucesora sin crédito ya no existe (la de `SUSPENDED` cobra al autorizar), así
  que lo que queda es la de **poco** crédito. **Propuesta**, en `B/12`, *«Lo que este capítulo NO
  cierra»*: *«**Una sucesora con tarjeta cuyo crédito cubre menos que su ventana** emite desde `S2`
  hasta su primer cobro sin haber pagado esa diferencia —hasta 72 h— (§4.3). **Causa**: `D8` pone el
  primer cobro después de la ventana y el crédito puede ser menor. Una vez por cambio de plan y
  sobre alguien que venía pagando. Declarado por `DEC-METH-015`.»* Y el ⚠️ de `:294-295` pasa a
  remitir ahí.
- **R8-b · la ventana reducida con dos minutos de margen, o con `S17` fallida.** Declarado en línea
  en `B/12:815-822`, con *«La otra salida … pide un motivo de marca nuevo, y eso es una decisión»*.
  Tiene que coincidir una autorización en los últimos minutos, un webhook demorado y, o bien un
  cobro fechado a las 00:00-00:02, o una cancelación de `S17` fallida. Es doble cobro sin detector,
  pero la población es la intersección de tres bordes. **Propuesta**: pasar el párrafo al *«NO
  cierra»* de `B/12` con su causa —*«la corrección relee en el corte, y el primer lote puede caer
  dos minutos después»*— y quitarle el *«eso es una decisión»*, que lo deja leyéndose como una
  pendiente abierta en vez de un borde declarado.

---

## 4. Lo que estos tres racimos piden al owner

| # | racimo | qué | plata o acceso | recomendación |
|---|---|---|---|---|
| 1 | R8 | *«cambiá la tarjeta»* no está medido como salida del grace (`GR-1` `UNKNOWN`, reintentos mensuales sin medir) | acceso: suspende a quien hizo lo que se le pidió | **2**: condicionar a `GR-1` y que la superficie no prometa |
| 2 | R3 | la vuelta del suspendido con tarjeta pierde la promo | plata: precio de lista para siempre | **1**: aceptarlo y decirlo en la fila 10 |
| 3 | R8 | el primer cobro fallido de una sucesora declarada en `ACTIVE` o `CANCEL_SCHEDULED` | acceso y addons pagados | **1**: aceptarlo y decirlo antes de confirmar |
| 4 | R3 | *«todavía no se sabe»* sin cota (`F-8CB3-004`) | servicio sin cobrar, en borde | **2**: marca a los 3 días |

---

## 5. Contradicciones de texto

Cada una con los dos lados y la corrección propuesta. Ninguna pide decisión.

- **C1 · `GR-3` y `RC-7` se contradicen dentro de su propia celda.** `06-mp-validation-matrix.md:201`
  sigue diciendo, sin tachar, *«**Medida entera, y son cuatro intentos dentro de una ventana de 24
  h**»* y *«La sonda 49 … **está bloqueada**»*, y más abajo, en su 📌, *«la sonda 49 se destrabó …
  **la ventana de reintentos dura un ciclo, no 24 h fijas**»*. Lo mismo `:280` (`RC-7`): *«+ 24 h
  exactas»* y *«🚧 **Sigue sin saberse si las 24 h son fijas o son el ciclo**»* contra su 📌.
  **Corrección**: tachar *«de 24 h»* (poner *«de un ciclo»*), tachar *«y **está bloqueada**…»* hasta
  el fin de esa oración, y en `RC-7` tachar el 🚧, remitiendo los dos al 📌 del 24/09. Es la forma
  que el hallazgo leyó (`F-8CB3-012`), y quien lea sólo el comienzo de la celda sigue leyendo 24 h.
- **C2 · `RN-3` no tiene el hecho que se le atribuye.** `DEC-SUB-019` (`01-…:5064-5065`) cita como
  medido *«`next_payment_date` avanzando igual sobre un cobro rechazado — `RN-3`, 2026-09-24»*; lo
  mismo `B/03:138` (`S11`, *«esa fecha ya corrió un ciclo sin pago (`RN-3`)»*) y `B/02:424` (*«y sobre
  un cobro rechazado (`RN-3`)»*). La fila `06-…:193` está `UNKNOWN` y su 📌 del 24/09 habla de otra
  cosa (*«Reactivar no reintenta lo adeudado»*); `rg 'next_payment_date'` sobre esa línea no
  devuelve nada. **Corrección**: registrar la observación en el 📌 de `RN-3` (o en `RN-1`, que ya
  tiene la cadencia de los lotes), con su fecha y sujeto, o degradar las tres citas a *«observado,
  no registrado»*. Era la mitad de `F-8CD1-001` que el consolidado no nombra.
- **C3 · «Los reintentos caen dentro de nuestro grace» está al revés.** `B/12-suscripcion.md:57-59`:
  *«El grace es siempre más corto que el ciclo … Los reintentos caen **dentro** de nuestro grace, y
  si uno entra corre `S5`»*, bajo *«Lo que la regla vieja cuidaba lo cuidan hoy otras dos reglas»*
  (`:54`). Con grace menor que la ventana, lo que cae adentro es **el grace**, dentro de la ventana
  de reintentos; cuántos reintentos caen en el grace no está medido (§3.5, pendiente 1). Y el miedo
  del §1.1 no lo cuida ninguna regla: `DEC-SUB-019` lo **resignó** (`01-…:5083`, *«**Lo que se
  resigna**, declarado: **la recuperación automática después del grace**»*). La misma inversión está
  en `DEC-SUB-021` (`01-…:5197-5198`: *«un ciclo**, que con `DEC-SUB-019` cae dentro de nuestro
  grace»*). **Corrección**, en `B/12:57-59`: *«Nuestro grace cae dentro de la ventana de reintentos
  del proveedor, así que durante todo el grace el proveedor sigue intentando; cuántos de sus
  intentos caen dentro del grace de un plan mensual o anual no está medido. Lo que se resigna es
  el reintento que cae después: `DEC-SUB-019`.»* Y `B/12:134-137` deja de decir que la ventana
  mensual *«no cambia el diseño»*.
- **C4 · La prosa del §4 de `B/03` frena `S6` por contracargo; la fila no.** `B/03:1497-1499`:
  *«**Mientras esa sucesión esté en curso, ni `S5` ni `S6` se ejecutan**»*, sin excepción. La fila
  `S6` (`B/03:133`): *«**por el tercer evento tampoco corre la guarda de la sucesión en curso** …
  **`S6` ocurre igual**»*. Es la forma exacta de `F-8CB2-008` (prosa contra tabla), movida al tercer
  evento. Además `B/03:1515-1516` dice *«La fila `S6` de la tabla dice lo mismo, con una salvedad
  anotada sobre su segundo evento»*, y esa salvedad está cerrada en la fila (*«**Cerrado el
  2026-09-25**»*). **Corrección**, en `:1497-1499`: *«…ni `S5` ni `S6` por sus dos primeros eventos
  se ejecutan … **Por el tercero —un contracargo— `S6` corre igual y `S31` corta a la sucesora**
  (`DEC-SUB-020`, su 📌)»*; y en `:1515-1516`, quitar *«con una salvedad anotada sobre su segundo
  evento»*.
- **C5 · La sucesora de una `SUSPENDED`: ¿minutos o días?** `B/12:292-294`: *«cobra al autorizar,
  como un alta … Si ese primer cobro se rechaza, muere en `CHARGE_DECLINED` como un alta, pero con
  días y no minutos de servicio de esa autorización»*. `B/12:351-353`: *«si era un alta, **o la
  sucesora de una `SUSPENDED` de tarjeta**, que cobra al autorizar como un alta»* → *«los minutos de
  `PA-3`»*. La primera es una frase de la versión anterior que quedó pegada a la excepción.
  **Corrección**: en `:293-294`, *«muere en `CHARGE_DECLINED` como un alta, con los minutos de
  `PA-3`»*, y mover el ⚠️ siguiente al borde R8-a.
- **C6 · Las salidas de `SUSPENDED` en `B/03` §3.1.** `B/03:82-87`: *«su preapproval puede seguir
  vivo, y una segunda suscripción serían dos cobros. Sus salidas no son el candado: son pagar (`S7`),
  … `S23` … `S27` — **cuatro**»*. Desde `DEC-SUB-019`, el preapproval de una `SUSPENDED` de tarjeta
  está cancelado y verificado (`B/03:133`), y tiene una quinta salida: la sucesión de `G-R1-A`
  (`B/20:79-81`), que es **su vuelta normal**. **Corrección**: *«…sobre un pagador manual; sobre uno
  con tarjeta el preapproval ya está cancelado (`DEC-SUB-019`) … **cinco**, y la de la tarjeta es la
  sucesión desde `SUSPENDED` (`G-R1-A`)»*.
- **C7 · `B/05` §3 no conoce el destino nuevo de `S7`.** `B/05:270`: *«**Si las cuatro se
  cumplen**, entra `GRACE_PERIOD → ACTIVE` (`S5`) o `SUSPENDED → ACTIVE` (`S7`)»*. `B/05:86-90`
  (`C1`) y `B/03:134` dicen `CANCEL_SCHEDULED` sobre un preapproval cancelado. **Corrección**: *«…o
  `SUSPENDED → ACTIVE` (`S7`), **o `SUSPENDED → CANCEL_SCHEDULED` si el preapproval ya está
  cancelado** (`C1`, `B/03` §3.2)»*.
- **C8 · `MP2` contra los eventos de `S6`** (`F-8CB2-009`, sigue llegando). `B/03:1709`: *«la
  suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj»*. `B/03:133`: tres eventos, ninguno
  del admin. **Corrección**, en la columna *evento* de `S6`: *«— **o el admin confirma que la cuota
  no se pagó (`MP2`)**: sólo en un pagador manual, desde `GRACE_PERIOD`; es el cuarto evento, y no
  pasa por la lectura del `B/09` §4, porque un pagador manual no tiene preapproval»*. Y el recuento
  de eventos de `S6` en el mismo §.
- **C9 · `DEC-ARCH-008` conserva «el único caso».** `01-decision-log.md:2713-2714`: *«un plan
  retirado **no tiene `rank` comparable**, que es justamente el único caso donde la regla hace
  falta»*. El contrato lo tachó (`12-contrato…:935-938`). **Corrección**: un 📌 en el *Estado* de
  `DEC-ARCH-008`, como el log hace con `DEC-SUB-019` (`01-…:5052-5053`): *«precisada el 2026-09-25
  (FASE 8 completa, `F-8CD1-003`): el veredicto rige todo cambio de plan, no sólo el del plan
  retirado; ver contrato §4.1»*. La entrada no se edita en su contenido.
- **C10 · `V/descomposicion.md:310` cita como vigente el texto tachado de `B/10`.** *«"La dirección
  se deriva del delta entre las dos versiones, no del `rank` … cualquier baja manda" vive hoy en
  `B/10` §3.5»*. `B/10:93` lo tacha. Es salida 3 de `DEC-METH-004` (sub-specs), no capítulo; queda
  anotado para esa pasada.
- **C11 · `B/06` §11 atrasado sobre `RN-3`.** `B/06-proveedor.md:408`: *«`RN-3` | … | el diseño del
  grace | **EN CURSO**: … se lee tras su cobro del **2026-09-24**»*. La matriz ya lo leyó (`06-…:193`,
  📌 del 24/09) y `B/09:833` dice *«ninguna bloquea este capítulo»*. Y `B/06:421` dice *«Tres de las
  ~~cuatro~~ cinco»* con seis filas en la tabla. **Corrección**: *«leído el 2026-09-24: reactivar no
  reintenta lo adeudado; sigue `UNKNOWN` si vuelve a pausar»*, sin *«bloquea el diseño del grace»*;
  y recontar la frase de `:421` con script.
- **C12 · `CHARGE_DECLINED` en el contrato** (fuera de estos tres racimos, pero es la frontera
  `S4`/`S16` del dominio de R1). `12-contrato-de-cobertura.md:416`: *«terminal, y el proveedor ya
  canceló el preapproval»*. `B/03:143`: *«**Ya no exige que el proveedor la haya cancelado**»*
  (`PA-6`, `UNKNOWN`). **Corrección**: *«terminal, y `S16` canceló el preapproval —de nuestro lado,
  si el proveedor no lo había hecho—»*.
- **C13 · Fecha de la regla nueva.** `B/12:47`: *«**Reemplazada el 2026-09-24** (FASE 8 completa,
  racimo `R1`…)»*. El racimo se resolvió con el owner el 2026-09-25 (`00-hallazgos.md:335`), y
  `B/06:443` dice *«registrado en la matriz el 2026-09-25»*. **Corrección**: *«2026-09-25»*.

---

## 6. Lo que este documento no mira

- **La mitad «vuelta» de `F-8CB1-002` sobre los addons**: comprobé que `S18` re-apunta los
  complementos (`B/03:145`); no recorrí `B/16` §4.3 para la sucesora que muere por `S16` después del
  cierre (pendiente 3), que es donde esos addons quedarían huérfanos.
- **`S7` con la relectura fallida.** El destino de `S7` depende de una relectura (`B/03:134`) y el
  texto no dice qué pasa si falla. `S7` se dispara por un hecho puntual, no por una condición sobre
  un estado, así que no es seguro que se reevalúe. No lo cuento en el dominio porque es la regla
  general de `D17` y no una de R3; lo anoto para quien revise `B/05` §3.
- **El recuento de las nueve transiciones** del contrato (`12-contrato…:434-436`) y de `G-R1-A`
  (`B/20:104-110`) no lo rehice: es de R2/R4 de fases anteriores, no de estos racimos.
