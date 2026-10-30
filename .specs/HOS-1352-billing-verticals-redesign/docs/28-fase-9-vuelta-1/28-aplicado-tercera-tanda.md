---
title: "FASE 9 vuelta 1 · tercera tanda aplicada: pedidos cruzados de X e Y, X-1, X-2, Y-1, Y-2 y L1–L6"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — tercera tanda aplicada

Aplica la *«Tercera tanda»* de `10-decisiones-del-owner.md` (`X-1`, `X-2`, `Y-1`, `Y-2` —las cuatro
en la opción 1, la recomendada—, L1–L6 y la cláusula de `Y-2`) y, antes, los pedidos cruzados de
`26-cierre-X-billing.md` §3 y `27-cierre-Y-resto.md` §3. Fui el único agente editando; con permiso
explícito del encargo toqué `01-decision-log.md` y `06-mp-validation-matrix.md`, sólo para L1–L6.
Rutas: `D/` = `.specs/HOS-1352-…/docs/`, `V/` = `.specs/HOS-1353-…/`, `B/` = `.specs/HOS-1354-…/`,
`N/` = `D/nucleo/`. Las líneas son las del worktree al cerrar esta pasada.

## 1. Lo aplicado

### 1.1 Pedidos cruzados

| ítem | archivo:línea | estado |
|---|---|---|
| X-§3 pedido 1 — `V/15`, *«cobrada»* → *«pagando»* (`F-8V1D1-002`) | `V/docs/15:163-165` | **saltado: nació vencido** (Y ya lo había escrito, con el mismo sentido) |
| X-§3 pedido 2 — `UNIQUE(id, vertical)` en `plan_version` (`N-G1-03`) | `V/docs/02:48` | hecho |
| X-§3 pedido 3 — la fila de invalidación del catálogo de addons, tachada (`N-G4V-09`) | `V/docs/02:534` | hecho, sin el tachado anidado interno (la variante que el pedido admitía) |
| X-§3 pedido 4 — contrato §4.1: `S1` lee `vigente`/`vendible` (`N-G4V-07`) | `D/12:1133-1136` | hecho |
| X-§3 pedido 5 — `D/16` §4.3, el pago diferido de una `Preference` (`N-G4V-02`) | `D/16:317-333` | **saltado: nació vencido** (Y ya había reescrito el párrafo y nombraba el «NO cierra» de `B/09`); el párrafo se volvió a tocar por `Y-1` (abajo) |
| Y-§3 P1 — `A6`: el empuje *«después de su commit»* | `B/docs/03:2537` | hecho |
| Y-§3 P2 — ídem en `B/16` §4.2 | `B/docs/16:472-475` | hecho |
| Y-§3 P3 — `B/16` NO cierra, *«al recibir el empuje, que sale después del commit»* | `B/docs/16:978-981` | hecho (reordenada la frase para no repetir *«el empuje»*) |
| Y-§3 P4 — `A1` lee `admiteDestaque` | `B/docs/03:2532` | hecho |
| Y-§3 P5 — `B10`: `admiteDestaque` y `díasDeVigencia` | `B/descomposicion.md:339` | hecho (verificada la firma en `D/12:1027-1028`) |
| Y-§3 P6 — `B/19` §4 fila 3-ter | `B/docs/19:110` | hecho |
| Y-§3 P7 — `B/16` NO cierra, el destaque sobre un borrador | `B/docs/16:1006-1010` | hecho |
| Y-§3 P8 — criterio de `B9`, `extenderTrial` → `RECHAZADA` | `B/descomposicion.md:730` | hecho |
| Y-§3 P9 + X-§3 pedido 5 (choque en `N-G4V-02`) — `B/09` NO cierra, la población | `B/docs/09:941-945` | hecho, **con un solo texto** para los dos pedidos y ya con `Y-1` contestada: la población son las preferencias de addon de los 30 minutos; las del cambio de plan las vence el 1a (`EX-42`). `D/16:322-333` dice lo mismo |
| Y-§3 P10 — el predicado de `N-2` en tres frases | `B/docs/03:2821-2824`, `B/docs/09:66-68`, `B/docs/12:1067-1068` | hecho |
| Y-§3 P11 — aviso: los selectores de «fila viva» de instancia | — | nada que hacer: `X-1` y `X-2` no agregan ningún estado vivo a la instancia de addon |
| Y-§3 P12 — aviso: matriz y `B/06` si `Y-1` = 1; `V/17` y `N/08` si `Y-2` = 1 | ver §1.4, §1.5 y §1.7 | hecho por los ítems de abajo |

### 1.2 `X-1` = 1 — la lápida de recepción la cancela el handler

| ítem | archivo:línea | estado |
|---|---|---|
| El handler manda cancelar en el mismo acto de escribirla, con la relectura y el correo antes; la reintenta la salvedad 4 | `B/docs/09:87-97` (§2.4) | hecho |
| Fila nueva en la tabla de puertas terminales (**no** exenta) | `B/docs/09:195` | hecho |
| ~~diecisiete~~ **dieciocho** puertas | `B/docs/09:174` | hecho |
| Salvedad 4: ~~catorce de las quince~~ **quince de las dieciséis**, *«las dos lápidas»*, `S21` decimosexta, ~~trece~~ **catorce** principales | `B/docs/09:205` | hecho |
| La fila de `S3`: ~~catorce~~ **quince** | `B/docs/09:182` | hecho |
| El reintento: ~~catorce~~ **quince** de la 4, *«las dos lápidas»* | `B/docs/09:211` | hecho |
| `B/02` §2.2, la lápida de recepción | `B/docs/02:69-77` | hecho |
| `B/21` §2.5: la de recepción no puede seguir *«primero se cancela, después se escribe»* | `B/docs/21:226-231` | hecho |
| Espejos en `B/03`: la rama transitoria (`:286-287`), *«una de las quince»* (`:325`), la rama *«sin destinatario»* (`:304-307`), dieciocho puertas (`:2069`, `:2103`, `:2477`), el par terminal × vivo (`:2748`) | `B/docs/03` | hecho |
| Espejo en `B/16`: dieciocho puertas | `B/docs/16:915` | hecho |

**Recuento con script** sobre la tabla *«puerta a un estado terminal»* de `B/09` §3: **18**
puertas, **2** exentas (el espejo y `S17`), **16** *«no»*; la salvedad 4 toma las 16 menos `S21`
(que entra por la 1): **15**. La lista de *«entran sólo cuando hubo llamada»* sigue en siete: la
lápida de recepción siempre tiene la llamada del handler.

### 1.3 `X-2` = 1 — `S36` sale también de `PAUSED`

| ítem | archivo:línea | estado |
|---|---|---|
| Celda `desde` de `S36` y sus efectos desde `PAUSED` (`EX-11`, corte como `S22`, `fin_real`) | `B/docs/03:182` | hecho |
| Fila 12 de las salidas de la predecesora (`B/03` §3.3) | `B/docs/03:394` | hecho: `PAUSED` se nombra como `GRACE_PERIOD`, **alcanzable y no de declaración, así que no se cuenta** —el conteo de diez no cambia— |
| La lista de *«la principal termina»* de `S33` | `B/docs/03:179` | hecho |
| La escritura 4 de `S18` (la cortesía no se difiere por `S36` desde `PAUSED`, la termina como `S22`) | `B/docs/03:583` | hecho |
| Las salidas de `PAUSED` que escriben `fin_real`: ~~seis~~ **siete** (recontadas con script sobre la tabla) | `B/docs/09:545-553` | hecho |
| `B/20`: el guard de declaración y el caso E2E de revocación desde `PAUSED` | `B/docs/20:127-128`, `:541-544` | hecho |
| `B/22`: los estados de salida | `B/docs/22:111-112` | hecho |
| Contrato: la predecesora sale también de `PAUSED` por `S36` sin emitir | `D/12:540-542` | hecho |

### 1.4 `Y-1` = 1 — el corte vence las `Preference` del cambio de plan

| ítem | archivo:línea | estado |
|---|---|---|
| Fila 0: se mide `EX-42` en producción | `D/16:122` | hecho |
| Fila 0b: ~~pregunta `Y-1`~~ la vence el 1a | `D/16:123` | hecho |
| Fila 1a: vencer por API (`expire` de qzpay) los checkouts de cambio de plan sin pago, y releer; cita `EX-42` | `D/16:124` | hecho |
| Herramienta 1 del corte | `D/16:237-239` | hecho |
| §4.3: la población y la coordinación con `Y-1` | `D/16:322-333` | hecho |
| `B/21` | — | no nombra la herramienta ni las preferencias: nada que tocar |

### 1.5 `Y-2` = 1 con su cláusula

| ítem | archivo:línea | estado |
|---|---|---|
| `V/17` §3.2 regla 5: cuentas, no personas; detector; segunda persona cuando haya otra con el permiso (y ~~**otra** persona~~ **otra cuenta**) | `V/docs/17:333`, `:336-345` | hecho |
| `V/17` NO cierra | `V/docs/17:543-550` | hecho |
| Detector en `N/08` §4.1 | `N/08:330-340` | hecho: se define por la columna *«¿destructiva o mueve dinero?»* del §3, no por una lista cerrada |
| Espejos: `N/08` §3 (la frase *«ninguna fila… `actor = sujeto`»*) y `V/spec.md` §3.7 | `N/08:193-194`, `V/spec.md:206-208` | hecho |

### 1.6 Log (L1–L5)

| ítem | archivo:línea | estado |
|---|---|---|
| L1 — `DEC-ARCH-006` impl. 4, el empuje después del commit (tachado + nuevo) | `D/01:2287-2291` | hecho |
| L2 — `DEC-ARCH-006` impl. 5, `ficha` con `admiteDestaque` | `D/01:2298-2300` | hecho |
| Estado de `DEC-ARCH-006` | `D/01:2236` | hecho |
| L3 — 📌 de `G5-3` en `DEC-SUB-010` (el regalo y el predicado del detector) | `D/01:1738-1748` | hecho |
| Estado de `DEC-SUB-010` | `D/01:1691` | hecho |
| L4 — 📌 de la parte 4 de `DEC-RF-001`: `S36` también desde `PAUSED` | `D/01:1653-1663` | hecho |
| Estado de `DEC-RF-001` | `D/01:1608` | hecho |
| L5 — 📌 nuevo en `DEC-AUTH-002` (con la cláusula) | `D/01:5994-6001` | hecho |
| Estado de `DEC-AUTH-002` | `D/01:5985` | hecho |
| Total del log | — | **126** (127 encabezados `### DEC-` menos la plantilla), sin cambio |

### 1.7 Matriz (L6)

| ítem | archivo:línea | estado |
|---|---|---|
| Fila `EX-42` ✚ `UNKNOWN`, en la tabla de *«Cobrar SIN suscripción»* (la de `EX-30`–`EX-41`: pagos únicos sin preapproval; no hay familia de Checkout/`Preference`) | `D/06:398` | hecho |
| Cabecera, Resumen (`UNKNOWN` 4 → 5) y el *«Recalculado»* (98 → 99) | `D/06:17`, `:432`, `:437` | hecho |
| Fila en *«Qué espera cada decisión»* para `Y-1` | `D/06:537` | hecho |
| Alcance: `B/spec.md` §5.2 (título, conteo, fila de la tabla), `B/descomposicion.md` §2.7 (título, conteo, fila), `B/06` (cabecera del capítulo, §11 conteo y fila, el recuento de *«dos de las cinco»*) | `B/spec.md:222`, `:230`, `:242` · `B/descomposicion.md:377`, `:383`, `:393` · `B/docs/06:28`, `:402`, `:417`, `:426` | hecho. `V/`, `N/`, el contrato y `D/11`/`D/16` no afirmaban la cifra |

**El script** (`python3 contar-filas-de-la-matriz.py`, desde `D/`): **99 filas — 56 `VERIFIED`,
15 `PARTIALLY_SUPPORTED`, 23 `NOT_SUPPORTED`, 5 `UNKNOWN`** (`PA-6`, `GR-2`, `RC-8`, `RF-3`,
`EX-42`).

**markdownlint**: `npx markdownlint-cli2` sobre los 20 archivos tocados y este registro, **exit 0**.

## 2. Lo que dejó declarado una opción elegida contra la recomendación

Nada: las cuatro preguntas de la tanda se contestaron con la recomendada. Lo que las opciones
declaran por sí mismas quedó escrito: `Y-2` en el NO cierra de `V/17` (la misma persona con dos
cuentas, con causa y detector); `Y-1`, que una preferencia creada por fuera de la base vieja no la
vence el 1a (`D/16:124`), y que si `EX-42` no da, la pregunta vuelve al owner.

## 3. Propuestas para el log y la matriz

- **`DEC-CONC-002`, 📌 opcional por `X-1`** (lo anticipaba `26-cierre-X-billing.md` §4; no estaba
  entre L1–L6, así que no se escribió): *«**📌 Precisado el 2026-09-26, con OK del owner (FASE 9
  vuelta 1, `X-1`).** La lápida de recepción —la que el handler escribe para un preapproval
  desconocido que no nombra ninguna fila— nace `CANCELLED` y **el mismo acto manda cancelar su
  preapproval**; si la llamada no se aplicó, la reintenta el barrido por la salvedad 4 del punto 4,
  que desde entonces cuenta las dos lápidas, y a los 3 días marca (`B/09` §2.4 y §3).»*

## 4. Residuos y choques

- **Choque `N-G4V-02`** (X pedido 5 contra Y P9): resuelto con un solo texto en `B/09` y `D/16`,
  ya escrito con `Y-1` contestada, así que la frase *«pendiente de la pregunta `Y-1`»* que traía P9
  no entró.
- **`X-2` y la fila 12**: la opción decía *«la fila 12… hoy dice `ACTIVE` · `CANCEL_SCHEDULED`»*.
  No se agregó `PAUSED` a la celda `desde` contada, porque la tabla enumera salidas del **conjunto
  de declaración** y `PAUSED` no lo es (igual que `S22`): se nombra como el `GRACE_PERIOD` de la
  misma fila, y el conteo de diez no se mueve. Si el owner quería otra lectura, es la única
  interpretación que tomé.
- **Principales de la salvedad 4**: *«las otras catorce son principales»* incluye a las dos
  lápidas, cuya clase es `LÁPIDA`; el texto ya contaba así a la del corte. Lo dejé explícito
  entre paréntesis en vez de cambiar la cuenta.
- La línea 2894 de `B/03` (*«de once a doce filas»*) es historia de `S31` y no se tocó.

## Key Learnings

1. Dos pedidos cruzados sobre el mismo hallazgo (`N-G4V-02`) escritos antes de que el owner
   contestara la pregunta de la que dependían (`Y-1`) se aplican mejor juntos y después de la
   decisión: los dos traían texto *«pendiente»* que habría nacido vencido.
2. De los cinco pedidos de X, dos nacieron vencidos porque Y ya había escrito el otro lado;
   releer el destino antes de cada pedido ahorró dos tachados sobre texto ya correcto.
3. Extender una transición a un estado nuevo (`S36` desde `PAUSED`) toca listas que no nombran la
   transición sino el estado de origen: las salidas de `PAUSED` que escriben `fin_real` (`B/09`) y
   las escrituras de `S18` (`B/03`) no aparecían en la lista de impacto de la opción.
4. Una tabla que enumera salidas de un **conjunto de declaración** no gana fila contada cuando la
   transición sale de un estado alcanzable; la forma ya existía (`GRACE_PERIOD`, `S22`) y sirvió
   para `PAUSED` sin mover el conteo.
5. El detector de `Y-2` se definió por una columna del catálogo y no por una lista: una lista de
   acciones que mueven plata caducaría con la decimosexta acción.
