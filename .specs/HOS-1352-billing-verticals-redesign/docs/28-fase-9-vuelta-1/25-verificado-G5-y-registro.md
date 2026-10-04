---
title: "FASE 9 vuelta 1 · G5 verificado — autorización, cobro, coherencia y registro"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G5 verificado, y el registro recontado

Verificación de los 20 hallazgos de `05-G5-autorizacion-cobro-y-coherencia.md` (`R11` y los
sueltos de `A1`, `B1` y `D1`), de las cinco contradicciones chicas de su §4 y del recuento de las
listas cerradas, contra el texto vigente del worktree (commit `4347cfd9de`). Tenidas en cuenta
las decisiones `G5-1` = **1**, `G5-2` = **2**, `G5-3` = **2** (contra la recomendación), `G5-4` =
**1** y `G5-5` = **1**, y de la segunda tanda los ítems A–G, L y M, más P1 y P2. Criterio:
`DEC-METH-004`, opción 3. Abreviaturas: `$D` es el `docs/` del paraguas, `$V` y `$B` las carpetas
de cada épica; en el texto, `V/NN` y `B/NN` son `docs/NN-*.md` de cada épica y `N/NN` los del
núcleo. Las líneas son las de hoy, no las de `15-aplicado-G5.md`. Las citas se verificaron con
script (una sola línea, 6–25 palabras).

## 1. Resumen

| hallazgo | veredicto | línea vigente que lo corta o lo declara |
|---|---|---|
| `F-8V1B1-008` (`R11`) | DEJA | `$B/docs/03-maquinas-de-estado.md:1638` «**medido: `GR-1` `VERIFIED` el 2026-09-26** —cambiar el medio de pago dispara un reintento que cobra con el nuevo» |
| `F-8V1D1-005` (`R11`) | DEJA | `$B/docs/06-proveedor.md:412` «**`PARTIALLY_SUPPORTED` desde el 2026-09-25 (noche)**: reactivar retoma el ciclo siguiente, no recupera lo adeudado» |
| `F-8V1A1-001` | DEJA (con vecino, `N-1`) | `$V/docs/17-autorizacion.md:328` «**Una acción administrativa nunca tiene `actor = sujeto`: el paso 3 la rechaza** (*«sin» |
| `F-8V1A1-002` | DEJA | `$V/docs/17-autorizacion.md:506` «`CLIENT_MANAGER` el conjunto entero con limits en `-1` antes de que corra el chequeo, **se» |
| `F-8V1A1-003` | DEJA | `$V/docs/19-superficies.md:44` «**para leer; para escribir, sólo lo que nombra una fila de `NUCLEO/08` §3**» |
| `F-8V1A1-004` | DEJA | `$V/docs/18-partner.md:120` «el partner tiene HOY el entitlement ~~de presencia pública~~ **«página propia»** (§1.2; FASE 9 vuelta 1, `F-8V1A1-004`)» |
| `F-8V1A1-005` | DEJA | `$V/docs/02-modelo-de-datos.md:159` «**Y lo mismo en las dos versiones no vendibles**: la de pre-trial y la de piso declaran» |
| `F-8V1A1-006` | DEJA | `$V/docs/17-autorizacion.md:71` «El `Guest` es un actor (§3.3) y **falla acá**, salvo en una lectura de lo ajeno en estado público» |
| `F-8V1A1-007` | DEJA | `$V/docs/17-autorizacion.md:118` «**Lo que el paso 2 deja pasar con el correo sin verificar es una lista cerrada**: verificar el» |
| `F-8V1A1-009` | DEJA | `$B/docs/03-maquinas-de-estado.md:2522` «**Y con scope `LISTING`, la ficha objetivo es el recurso del paso 4 del cap. 17**» |
| `F-8V1B1-001` | DECLARADO (con vecino, `N-2`) | `$B/docs/03-maquinas-de-estado.md:2806` «**`S10` deja volver antes cuando la persona quiera, y eso regala hasta un ciclo: se acepta y se» |
| `F-8V1B1-003` | DEJA | `$B/docs/03-maquinas-de-estado.md:147` «una fila `CHARGE_DECLINED` cuyo preapproval no se haya releído `cancelled`.** Si la hay, `S1` lo relee por id en el acto» |
| `F-8V1B1-004` | DEJA (con dos vecinos, `N-3` y `N-4`) | `$B/docs/03-maquinas-de-estado.md:182` «**una persona registra la revocación del derecho de arrepentimiento** que el cliente pidió por el canal que sea» |
| `F-8V1B1-005` | DEJA (vecino BAJA, §4) | `$B/docs/03-maquinas-de-estado.md:1845` «**y se reintenta sin pasar nunca del monto confirmado**: partido en parciales que suman lo confirmado» |
| `F-8V1B1-006` | DEJA | `$B/docs/03-maquinas-de-estado.md:176` «**Y si llega a 0 con la fila en `GRACE_PERIOD`** —el último cobro con descuento entró como reintento» |
| `F-8V1D1-002` | **SIGUE** | `$B/descomposicion.md:728` «**un `USER`/`GLOBAL` sin principal viva y cobrada ni ancla viva en sus verticales compatibles queda huérfano** (4d)» |
| `F-8V1D1-003` | DEJA (vecino BAJA, §4) | `$D/nucleo/03-maquinas-de-estado.md:68` «nuestro reloj (`S3`, `S6`, `A3`) y la de un acto del cliente que no puede declararse sobre un» |
| `F-8V1D1-006` | DEJA (vecino BAJA, §4) | `$D/nucleo/04-invariantes.md:123` «El §64 se escribió antes de ~~las 117~~ **las** decisiones **del log**» |
| `F-8V1D1-007` | DEJA | `$B/docs/02-modelo-de-datos.md:937` «a los 3 días, que abre el 21** (`B/09` ~~§6.2~~ **§6, punto 2**; owner 2026-09-25» |
| `F-8V1D1-008` | DEJA | `$V/spec.md:50` «billing donde el comportamiento cruza** (`NUCLEO/00`: las dos épicas se citan entre sí); lo que» |

**Conteo**: **18 DEJA, 1 SIGUE, 1 DECLARADO, 0 OTRA.** Cuatro hallazgos nuevos por caso vecino
(§3: uno ALTA y tres MEDIA) y ocho BAJA de texto o conteo (§4).

**Las cinco contradicciones chicas del §4 de `05-`**:

| contradicción | ¿aparece todavía en el alcance? | línea vigente |
|---|---|---|
| (a) `G13`: contrato dice `V4`, descomposiciones y `B/20` decían `B4` | no | `$B/docs/20-testing.md:352` «consumidor del contrato es billing.~~ (tachado 2026-09-26) **`G12` entra acá y `G13` vive en `V/20`» |
| (b) la partición justificada con «pasarela sin decidir» | no | `$D/11-particion-del-programa.md:28` «(tachado 2026-09-26) **Así estaba el 2026-09-18**: la pasarela sin decidir. Se decidió el» |
| (c) FASE 7: «cinco ítems» contra cuatro de seis | no en capítulos; vive sólo en `D/03-handoff.md` y **no cuenta** | `$D/16-fase-7-del-paraguas.md:325` «lo que hace al orden del corte.~~ **Cuatro de los seis ítems huérfanos** —`rollout`, `coexistence`,» |
| (d) el criterio de `V4` contra `V/03` §2 | no | `$V/descomposicion.md:508` «`cobrada: no` ~~arranca el trial (`T1`) y no lo consume (`T6` no dispara)~~ no arranca el trial ni lo consume**» |
| (e) «nueve pasos» | no (los dos «último de los nueve» de `V/03:1203` y `V/18:252` son del §17.3 del PDR) | `$V/docs/17-autorizacion.md:58` «Quedan ~~**nueve pasos y una precondición**~~ **nueve verificaciones, en siete pasos y una» |

## 2. Racimo `R11` — el dominio, recorrido

**Dominio declarado** (`05-` §2.2): (1) todo texto vivo que atribuye a una fila de la matriz un
estado, y (2) todo conteo de filas de la matriz, sobre núcleo, las dos épicas con `spec.md` y
descomposiciones, contrato y `D/16`.

**Punto (1), reejecutado con script**: el estado de cada fila sale de la matriz sin lo tachado, y
se listan las líneas (sin lo tachado) donde un ID cuyo estado no es `UNKNOWN` cae a menos de 70
caracteres de la palabra `UNKNOWN`. Nueve coincidencias, las nueve correctas:

| lugar | qué afirma hoy | ¿cubierto? |
|---|---|---|
| `$B/descomposicion.md:382` | 98 — 4 `UNKNOWN`, con `RN-3` cerrada el 25/09 | sí |
| `$B/descomposicion.md:403` | del grace queda `UNKNOWN` sólo `GR-2` | sí |
| `$B/docs/06-proveedor.md:28` | quedan cuatro: `PA-6`, `GR-2`, `RC-8`, `RF-3` | sí |
| `$B/docs/09-conciliacion.md:916` | sigue `UNKNOWN` `GR-2` | sí |
| `$B/docs/12-suscripcion.md:159` | `GR-1` `UNKNOWN`, **dentro de un tachado** de varias líneas (el filtro línea a línea no lo ve) | sí (tachado) |
| `$B/spec.md:230` y `:232` | `RN-3` cerró el 25/09; `GR-1` el 26/09 `VERIFIED` | sí |
| `$B/docs/03-maquinas-de-estado.md:1638` | la salida del grace, medida (`GR-1` `VERIFIED`) | sí — era el texto de `F-8V1B1-008` |
| `$B/docs/06-proveedor.md:412` | `RN-3` `PARTIALLY_SUPPORTED` | sí — era la fila que el filtro no veía |
| `$B/docs/09-conciliacion.md:173` | `EX-1` `PARTIALLY_SUPPORTED` desde el 23/09 | sí |

**Punto (2)**: `rg` (sin tachados) de *«N medidas»*, *«N filas `UNKNOWN`»*, *«98 filas»* y
variantes en letras: tres lugares, los tres dicen 98 · 56 · 15 · 23 · 4 o 94 medidas.

- `$B/docs/06-proveedor.md:27` «las reglas de trato que salen de haberlo medido** — 98 filas, ~~92~~ **94** medidas (recontadas»
- `$B/descomposicion.md:377` «### 2.7 Dónde caen las ~~ocho~~ ~~seis~~ cuatro filas `UNKNOWN`»

**Recuento de la matriz** (`python3 contar-filas-de-la-matriz.py` desde `$D`): **98 filas · 56
`VERIFIED` · 15 `PARTIALLY_SUPPORTED` · 23 `NOT_SUPPORTED` · 4 `UNKNOWN`** (`PA-6`, `GR-2`, `RC-8`,
`RF-3`). **Dominio cubierto: sí.** Sin caso vecino: el filtro corrido sobre todo el alcance no
devuelve ninguna línea viva con estado vencido.

## 3. Por hallazgo, y los casos vecinos

### 3.1 Los que dejan de llegar sin vecino

- **`F-8V1A1-002`**: `V/17` §4.3 retira el cargador y `G6` (b) lo detecta por nombre:
  `$V/docs/20-testing.md:55` «*«un rol entró al conjunto efectivo»*: una construcción del conjunto efectivo lee un rol». El `EDITOR` anfitrión resuelve contra su piso.
- **`F-8V1A1-003`**: las dos reglas están en `N/08` §3
  (`$D/nucleo/08-auditoria-y-observabilidad.md:185` «**Dos cosas que ninguna fila de esta tabla hace, ni las que se agreguen:** un acto de un actor»)
  y la fila 15 da la herramienta de soporte sin publicar, destacar ni borrar. El admin que carga
  la ficha de Juan no dispara `T1`; el borrado sólo sale de `PB9`/`PB12`, que corren `A6`.
- **`F-8V1A1-004`**: el script de *«clave vigente | entitlement de presencia | la clave de
  presencia»* sin tachados devuelve cero en el alcance; `V/17:188` y `:451` nombran la clave de
  cada superficie. Un Silver no tiene «página propia»: 404.
- **`F-8V1A1-005`**: `$V/docs/02-modelo-de-datos.md:290` «es una columna y no una clave, así que (a) no la ve. Mensaje propio:»,
  y `$V/docs/15-entitlements-y-limits.md:478` «alguna otra vertical **una fuente de clase `TÍTULO`** trae una `referencia` cuya versión declara».
  Sembrar el piso con *«sí»* falla `G-R3` (d).
- **`F-8V1A1-006`**: `$V/docs/02-modelo-de-datos.md:231` «al `Guest` no hace falta: el paso 1 lo rechaza en toda operación que no sea una lectura pública».
- **`F-8V1A1-007`**: la lista cerrada incluye `PB8`, exportar y la baja:
  `$V/docs/17-autorizacion.md:120` «exportar, `PB8` y `PB12`; regularizar un cobro —cambiar la tarjeta, pagar la cuota—; y **darse».
  Juan con el correo nuevo sin verificar reactiva y exporta; los dos son el hecho 1 del reloj
  (`N/01` §1.2), así que el día 180 no llega.
- **`F-8V1A1-009`**: la fila `A1` exige ficha propia, de la vertical del producto, ni `PURGED` ni
  `MODERATED`; el pedido con la ficha de María contesta *«no existe»*.
- **`F-8V1B1-003`**: `S1` relee la `CHARGE_DECLINED` y no admite el alta hasta verla `cancelled`;
  `$B/docs/12-suscripcion.md:394` «**Y tampoco mientras la fila `CHARGE_DECLINED` tenga el preapproval sin confirmar cancelado**:».
  Revisé las gemelas de la salvedad 4 (`S12`, `S13`, `S3`…): llegan a terminal con la cancelación
  sin confirmar, pero con días de reintento y la marca `CANCELACIÓN_SIN_CONFIRMAR` ya abierta, o sin
  un medio de pago que el proveedor recicle en minutos (la razón de `GR-1` que motivó el arreglo);
  no las doy como vecino.
- **`F-8V1B1-006`**: `desde` = `ACTIVE` **o** `GRACE_PERIOD`; `S5` y `S30` en el mismo acto.
- **`F-8V1D1-007`**: resolví con script toda referencia viva `` `B/NN` §x ``, `` `V/NN` §x `` y
  `` `NUCLEO/NN` §x `` del alcance contra los encabezados reales: **1927 referencias, una rota**, y
  no es de `B/09` (es la de `F-8V1D1-006`, §4). `B/09` §6 tiene sus puntos 1 y 2, y
  `$B/docs/06-proveedor.md:412` «**, *«Lo que este capítulo NO cierra»*,** ya dice que ninguna bloquea».
- **`F-8V1D1-008`**: ningún `spec.md` dice ya que no necesita leer a la otra épica.
- **`R11`**: §2.

### 3.2 `F-8V1A1-001` — DEJA para la misma cuenta; vecino `N-1` (ALTA)

El camino original (Juan, una sola cuenta `ADMIN` + cliente, se asienta su cuota) se corta en el
paso 3 por la regla 5. Pero la regla, y su costo escrito, prescriben la configuración que la
elude:

- `$V/docs/17-autorizacion.md:334` «costo es de una sola vez: quien administra y además es cliente necesita una segunda cuenta —la de»
- `$V/docs/17-autorizacion.md:335` «admin separada de la de cliente— para que lo suyo lo opere otra. Lo prueba un caso de `V5`.»

**`N-1` · ALTA · la segunda cuenta que la regla 5 prescribe es la misma persona.** Camino de Juan:

1. Juan es `ADMIN` y Partner Gold con pago manual. Aplica la regla: separa su cuenta de admin
   (`juan-admin`) de la de cliente (`juan-cliente`), que es lo que el costo de la regla le pide.
2. Desde `juan-admin` registra el pago manual de `juan-cliente`. `actor ≠ sujeto` por cuenta: el
   paso 3 no la rechaza, la regla 1 pide el permiso, que tiene.
3. La suscripción queda cubierta un período sin que entre un peso. `D11` se cumple a la letra
   —lo confirmó *«una persona»*— y es la misma persona interesada, que es exactamente el daño del
   hallazgo. A 22 usuarios, con un owner que opera solo, `juan-admin` es la única cuenta con el
   permiso: no hay *«otra»* persona que lo haga.

El control compara **cuentas**, y la regla dice que existe para que confirme **otra persona**.
Nada del diseño vincula dos cuentas de la misma persona ni prohíbe que una cuenta de staff opere a
un cliente que es su propia otra cuenta. Qué hacer es del owner (declararlo con detector, o exigir
una segunda persona para las acciones que mueven plata): no lo propongo.

### 3.3 `F-8V1B1-001` — DECLARADO; vecino `N-2` (MEDIA)

La elección `G5-3` (2, contra la recomendación) está escrita con causa en `B/03` y `B/12`, y el
detector en `N/08` §4.1 y `B/09` §2.3. El residuo queda declarado, pero **el detector y la
declaración miden un dominio más chico que el daño**:

- `$B/docs/03-maquinas-de-estado.md:2810` «`PS-5` y `PS-6` medidos una pausa de menos de un ciclo que cruza una fecha de cobro **no la»
- `$D/nucleo/08-auditoria-y-observabilidad.md:312` «terminadas por `S10` cuyo `fin_real` cayó a menos de un ciclo de su inicio y que cruzaron una fecha»

**`N-2` · MEDIA · la vuelta anticipada de una pausa LARGA regala casi un ciclo y el detector no la
lista.** El regalo no depende de que la pausa dure menos de un ciclo, sino de que la vuelta no caiga
en el aniversario: lo que se paga de más al pausar (del inicio de la pausa a la próxima fecha) no
compensa lo que se usa sin pagar al volver (de la vuelta a la próxima fecha). Camino de Juan:

1. Juan cobra el día 1. El 31/oct pausa **tres meses** (fin previsto 31/ene): el proveedor saltea
   el 1/nov y el 1/dic.
2. El 2/dic vuelve antes (`S10`, libre por `G5-3`). El proveedor cobra el 1/ene.
3. Pagó octubre entero y usó hasta el 31: perdió un día. Del 2/dic al 1/ene tiene servicio sin
   pagar: 30 días. **Regalo neto, 29 días.**
4. La pausa duró 32 días: *«más de un ciclo»*. El detector, que lista sólo las de `fin_real` a
   menos de un ciclo del inicio, no la ve; el «NO cierra» de `B/03` y el de `B/12` hablan también de
   *«una pausa de menos de un ciclo»*.

El owner aceptó el costo; lo que no está declarado es que alcanza a toda vuelta anticipada, y el
detector que se aceptó como mitigación queda ciego a la mayor parte de él. El predicado correcto
es el de la aritmética (vuelta fuera del aniversario del inicio, con una fecha salteada en el
medio), no la duración. Del sobrecobro inverso (pausar el 5, volver el 25) el «NO cierra» dice que
queda y no tiene detector; es lo que la opción 2 ya decía, así que no lo cuento como vecino.

### 3.4 `F-8V1B1-004` — DEJA; vecinos `N-3` y `N-4` (MEDIA)

`S36` existe, `RF1` la nombra y el 📌 de `DEC-RF-001` parte 4 está en el log. Juan, que pagó el
1/oct y escribe el 4/oct, pierde el acceso ese día y el reembolso total espera confirmación.

**`N-3` · MEDIA · `S36` no sale de `PAUSED`, y dentro de los 10 días del cobro se puede pausar.**

- `$B/docs/03-maquinas-de-estado.md:154` «| S8 | `ACTIVE` | la persona pide pausar | `PAUSED` *(motivo `CUSTOMER_REQUEST`)* |»
- `$B/docs/03-maquinas-de-estado.md:182` «| **S36** ✚ | `ACTIVE`, `GRACE_PERIOD` o `CANCEL_SCHEDULED` |»

Camino de Juan: paga el 1/oct, el 3/oct pausa un mes (`S8`), el 5/oct escribe a soporte que se
arrepiente. Está dentro de los 10 días, pero ninguna fila de revocación sale de `PAUSED`, y `RF1`
dice que lo crea `S36`. La persona de soporte vuelve al camino manual —la baja de `S22` y un
reembolso aparte—, que son las *«dos cosas que alguien tenga que acordarse de hacer juntas»* que
la parte 1 de `DEC-RF-001` prohíbe y que `G5-4` eligió cerrar. Lo mismo con `PAUSED · COURTESY`.

**`N-4` · MEDIA · `S36` dice que cancela con la regla de `S17`, y los otros dos lugares la cuentan
entre las que llegan a terminal sin confirmar.**

- `$B/docs/03-maquinas-de-estado.md:182` «**cancela el preapproval** con la regla de relectura de `S17` y **nuestro correo antes de la llamada**»
- `$B/docs/03-maquinas-de-estado.md:294` «fila no llega a terminal y reintenta la propia transición (precisión 2, abajo). **En `S11` y»
- `$B/docs/09-conciliacion.md:184` «**nuestra llamada**, con la misma forma que `S24`: cancela con la regla de relectura,»
- `$B/docs/09-conciliacion.md:179` «**nuestra llamada**, con la misma forma que `S22`: *«de inmediato»* y sin rama de fallo»

La regla de `S17` es *«si la llamada falla, la transición no ocurre y se reevalúa»*. La tabla de
puertas de `B/09` §3 y la lista del correo de `B/03:286` meten a `S36` en la salvedad 4 —llega a
`CANCELLED` pase lo que pase y reintenta el barrido—, y `B/09` dice *«la misma forma que `S24`»*,
que es *«sin rama de fallo»*. Son dos máquinas distintas. Camino: la persona registra la
revocación de Juan y la llamada de cancelación falla. Si el implementador lee la fila, `S36` no
ocurre, y como su evento es un acto humano y no una condición, **nadie la reevalúa**: el servicio no
se corta, `RF1` no nace y la revocación se pierde sin marca. Si lee `B/09`, la fila llega a
`CANCELLED` y el barrido reintenta. Qué forma es la correcta lo contesta el conjunto (la salvedad
4 la escribieron dos pasadas y la regla de `S17` una); lo dejo como contradicción a resolver.

### 3.5 `F-8V1D1-002` — SIGUE

La entrada *«pagando»* está en `N/01` §2 y las doce líneas de `15-aplicado` §4 punto 2 cambiaron,
pero la lectura ancha sigue llamándose *«cobrada»* en tres lugares vivos que el dominio del
documento no contó (lo clasificó como *«bit del contrato»*):

- `$V/docs/15-entitlements-y-limits.md:163` «hay una principal viva y cobrada ni un ancla viva** (`B/16` §4.2), así que `A5` lo corta.»
- `$V/docs/15-entitlements-y-limits.md:164` «*«Cobrada»* se lee como en `S4`: con al menos un pago acreditado, **o** sucesora de una»
- `$B/descomposicion.md:728` — el **criterio de terminación de `B10`**, citado en §1.
- `$B/spec.md:68` «los addons siguen a su título**: *válida* es `ACTIVE` y cobrada, se pausan con la pausa del cliente»

Camino del hallazgo, reejecutado: el implementador de `B10` lee la fila de su unidad
(`$B/descomposicion.md:136` «*válida* es `ACTIVE` **y ~~cobrada~~ pagando** (`A1`; *«pagando»*, `NUCLEO/01` §2, no el campo `cobrada` de `B4`»),
pero el criterio que tiene que pasar para declararla terminada dice *«principal viva y cobrada»*,
seis líneas debajo del criterio de `B4` que define `cobrada: no` sobre una `ACTIVE` sin pagos. Si
lo implementa con el bit, la orfandad `USER`/`GLOBAL` corta el addon de Juan al nacer su sucesora,
que viene con `cobrada: no`. **El camino se corta en la fila y sigue llegando por el criterio.**
`V/15:164` al menos glosa el término con la lectura ancha; `B/desc:728` y `B/spec:68`, no.

### 3.6 `F-8V1D1-003` y `F-8V1D1-006` — DEJAN, con vecinos BAJA

La regla 5 y `D17` nombran a `S1`; `N/04:123` ya no dice un número. Los dos vecinos (el scope
*«sobre su predecesora»* y la referencia a `NUCLEO/00` §1) están en §4, puntos 2 y 3.

## 4. Texto vencido y conteos que no coinciden (BAJA)

El recuento de las listas cerradas, con script sobre el texto sin tachados:

| lista | medido | documentos | ¿coincide? |
|---|---|---|---|
| decisiones del log | **127** encabezados `### DEC-` − 1 plantilla = **126**; **15** `DEC-METH`; 0 duplicados | Resumen del log (126 / 15 / 111) | sí en el log; **no** en `N/00:43` (124) — punto 3 |
| filas de la matriz | 98 · 56 · 15 · 23 · 4 | `D/06`, `B/06`, `B/spec`, `B/descomposicion` | sí (§2) |
| motivos de marca | **22**; 12 abiertos por `S14` y 10 por otros; 7 con `SÍ` | `N/08`, `B/02`, `B/19` | sí |
| acciones administrativas | **15** filas en `N/08` §3 | `N/08` («QUINCE»), las seis de `V/17`, `B/19:200`, `B/03:2094` | sí |
| máquinas | **10**: ocho tablas (`T`, `PB`, `PP`; `S`, `P`, `MP`, `A`, `RF`) más grace y pausa | `N/00:108`, `N/03:88`, `V/desc`, `V/20`, `B/20` | sí |
| hechos del reloj | **6** más la fila `C` | todas las *«seis hechos»* | sí |
| `S1`–`S36` | **36**, sin huecos ni duplicados | `B/spec:61` | sí |
| `T1`–`T8` | **8** | `V/03`, `V/descomposicion` | sí |
| publicación | **12** filas `PB1`–`PB12`; **6** estados en `desde`/`hacia` | `V/03`, `V/descomposicion` | sí |
| firma del contrato | **7** campos por fuente (más `cubierto`) | contrato, las dos descomposiciones, `B/spec:182` | sí |
| guards | **31** distintos: 20 filas en `V/20` §2 + 15 en `B/20` §2 − 4 cruzadas; por unidad **18** de verticales / **13** de billing | `B/20:370-373`, `V/desc:470`, las dos `spec.md` | sí; **no** en `B/descomposicion.md:672-673` — punto 1 |
| salidas de la predecesora | **10** (1, 2, 4, 5, 6, 7, 9, 10, 11, 12); `S18` en **8** | `B/03:373-490`, `B/02:150`, `B/12:612`, `B/20:116`, contrato `:446`, `:533` | sí |

1. **`B/descomposicion.md` §2 dice 14 guards en billing y 17 en verticales.** `G5-5` movió `G13` a
   `V4` y la aplicación tocó `B/desc:130`, `:163-170` y `:301-306`, no esta línea. Son 13 y 18.
   - `$B/descomposicion.md:672` «al declarar una unidad lista. **Los ~~29~~ ~~30~~ 31 guards ~~están repartidos~~ —~~30~~ **31** repartidos entre las 22 unidades, ~~13~~ **14** en esta»
   - `$B/descomposicion.md:673` «> épica y 17 en la otra (el nuevo, `G-R5-B`, de `V6`; FASE 8 completa, owner 2026-09-25) —,»
   - la gemela está bien: `$V/descomposicion.md:470` «**18** en esta épica y ~~13~~ ~~**14**~~ **13** en la».
2. **La regla 5 del núcleo acota la relectura de `S1` a *«su predecesora»*, y desde
   `F-8V1B1-003` `S1` también relee la fila `CHARGE_DECLINED`**, que no es predecesora de nada.
   `$D/nucleo/03-maquinas-de-estado.md:69` «preapproval que no cobra (`S1`, sobre su predecesora). Ésas **le preguntan antes**, releyendo».
   `D17` (`N/04:144`) dice lo mismo. Falta *«o sobre la `CHARGE_DECLINED` de ese `user + vertical`»*.
3. **`N/04:123` manda la cifra de decisiones a una sección que no existe, y el lugar real está
   vencido.** `$D/nucleo/04-invariantes.md:123` «la cifra vive en `NUCLEO/00` §1, que es el lugar que se recuenta»:
   `N/00` no tiene secciones numeradas (es la única referencia rota de las 1927), y el párrafo
   que quiso nombrar dice 124, no 126 —las dos nuevas son `DEC-AUTH-002` y `-003`, de esta vuelta—:
   `$D/nucleo/00-indice.md:43` «2026-09-25~~ **124** al 2026-09-25, con las siete nuevas de la FASE 9 completa (recontado al».
4. **`B/09` §3, fila `S3`, cuenta la salvedad 4 en trece**, y la salvedad 4 tiene catorce desde
   que entró `S36` (`18-aplicado` la recontó en `:195` y no tocó `:173`).
   - `$B/docs/09-conciliacion.md:173` «No mueve el conteo de la salvedad 4: `S3` sigue siendo una de sus ~~**once**~~ ~~**doce**~~ **trece** filas»
   - `$B/docs/09-conciliacion.md:195` «**catorce** de las **quince** filas *«no»* de la tabla de arriba»
5. **La lista de *«las filas que cancelan en el proveedor»* de `B/03` §3.2 no tiene a `S36` ni a
   la cancelación que ahora corre `S1`**, y las dos llevan el correo antes (`DEC-MAIL-001`), que es
   lo que esa lista enumera. Dice quince; con `S36` son dieciséis.
   - `$B/docs/03-maquinas-de-estado.md:316` «`S20`, `S22`, `S23`, `S24`, `S25`, `S26`, `S27`, `S28` **y `S31`** (FASE 8 completa, pendiente 8,»
   - `$B/docs/03-maquinas-de-estado.md:317` «owner 2026-09-25; **`S16`**, FASE 8 completa, owner 2026-09-25) —**quince**, recontadas sobre esta»
6. **El criterio y la fila de `B6` siguen diciendo *«se reintenta con otro monto»* sin la cota** de
   `F-8V1B1-005`. No contradicen la fila `RF2` (un parcial es *«otro monto»*), pero el criterio de
   terminación es lo que se prueba, y `RF-8` midió justamente que un monto **mayor** entró.
   - `$B/descomposicion.md:724` «no lo marca como no reembolsable**: se queda en `CONFIRMED` y se reintenta con otro monto (`RF-8`)»
   - `$B/descomposicion.md:132` «`RF5` cierra el rechazo sin monto que reintentar, y un `2084` se reintenta con otro monto»
   - `$B/docs/06-proveedor.md:226` «`amount: 5` dio `2084` y `amount: 14` dio `201` minutos después. Cuatro hipótesis murieron.»
7. **La mitad (d) de `G-R3` en `V/20` §2 está escrita como invariante y no como falla**, en una
   columna cuyo encabezado es *«qué falla si se rompe»* y cuyas otras tres mitades describen la
   falla. Leída a la letra, falla si ninguna la declara.
   `$V/docs/20-testing.md:61` «**(d)** ni la versión de trial ni las dos no vendibles declaran `hereda Turista VIP`».
8. **El cuerpo de `F-8V1B1-001` en `N/08` §4.1 y los dos «NO cierra»** hablan de *«pausa de menos
   de un ciclo»*; si se corrige `N-2`, cambian las tres frases.

## Key Learnings

1. Una regla de autorización que compara **cuentas** no cumple una intención escrita sobre
   **personas**: la regla 5 prescribe en su propio costo la segunda cuenta que la elude.
2. Un detector aceptado como mitigación de un residuo del owner hay que recorrerlo contra la
   aritmética del daño, no contra el ejemplo que lo motivó: la pausa corta era el ejemplo; el
   regalo lo produce cualquier vuelta fuera del aniversario.
3. *«Con la regla de `S17`»* es una cita que arrastra una máquina entera (si falla, no ocurre y se
   reevalúa); aplicada a una fila con evento humano, cambia qué pasa cuando falla y choca con las
   listas que la contaban de la otra forma.
4. Una fila nueva con `desde` enumerado (`S36`) tiene su propio caso vecino en el estado que no
   enumeró (`PAUSED`), y ese estado es alcanzable dentro de la ventana legal.
5. Renombrar un término en *«las líneas que usan la lectura ancha»* no alcanza si la clasificación
   se hizo por archivo: el criterio de `B10`, `B/spec` y `V/15` quedaron con *«cobrada»* porque se
   los contó como bit del contrato.
6. Sacar un número de un lugar y mandarlo a otro crea una dependencia nueva: la referencia a
   `NUCLEO/00` §1 apunta a una sección que no existe y a una cifra vencida.
7. Mover una fila entre catálogos deja vencida cada línea que reparte el total por épica, aunque
   el total no cambie: `B/descomposicion.md:672` quedó en 14 + 17.
