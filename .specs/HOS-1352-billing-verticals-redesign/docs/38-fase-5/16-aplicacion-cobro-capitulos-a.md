---
title: "FASE 5 · aplicación — cobro, capítulos 02, 03, 05 y 06"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación en la épica del cobro: capítulos 02, 03, 05 y 06

> Programa HOS-1352. Lleva a cuatro capítulos de `HOS-1354` las decisiones de
> [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) y las piezas de
> [`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md) que caen en ellos. En este
> registro, `$B` es `.specs/HOS-1354-billing-cobro-y-proveedor/docs`. Los números de línea son los
> del worktree del programa después de aplicar.

## 1. Archivos tocados

- `$B/02-modelo-de-datos.md`
- `$B/03-maquinas-de-estado.md`
- `$B/05-idempotencia-y-concurrencia.md`
- `$B/06-proveedor.md`

## 2. Qué se aplicó

### Simplificación del corte, lote C (S-40, S-41, S-45, S-46 y S-70): la lápida del corte y su ventana

`B/02` (las siete menciones de S-70):

- `02-modelo-de-datos.md:56` «Hay un solo escritor de esa forma» — la lápida del corte tachada
  como escritor de la forma de lápida.
- `02-modelo-de-datos.md:56` «Queda con un solo valor, `RECEPCIÓN`» — `origen_de_lápida` pierde
  `CORTE` y la razón del motivo; si la columna sale queda marcado ⚠️ y va a «Vuelve al owner».
- `02-modelo-de-datos.md:84` «la forma de fila de lápida» — la lápida de recepción ya no se define
  por la del corte ni por `B/21` §2.5.
- `02-modelo-de-datos.md:91` «la lápida de recepción** (FASE 5» — la salvedad 4 de `B/09` §3
  cuenta una lápida, no dos.
- `02-modelo-de-datos.md:101` «Es la única lápida que queda» — tachado el párrafo que separaba las
  dos lápidas por su origen y la regla del día del corte; un cobro tardío de un débito viejo entra
  como cualquier desconocido (S-46 se mantiene).
- `02-modelo-de-datos.md:506` «Esta fecha identifica el período, y nada más» — sale la ventana del
  corte (S-41).
- `02-modelo-de-datos.md:1028` «la lápida del corte y su ventana salieron: FASE 5» — motivo 7,
  tachada su rama sobre la lápida del corte.
- `02-modelo-de-datos.md:1040` «la lápida del corte salió: FASE 5, simplificación del corte, S-40 y
  S-70).» — motivo 19, tachado *«sobre la lápida del corte no compara»*.

`B/05` (las cinco menciones de S-70):

- `05-idempotencia-y-concurrencia.md:274` «la lápida del corte y su ventana» — C6, tachada la rama
  del barrido sobre la lápida del corte.
- `05-idempotencia-y-concurrencia.md:307` «Este § no corre sobre una fila que puede recibir el
  cobro** (lista de abajo) (FASE 9 vuelta 1, R4; la» — condición 1, sale la excepción de la lápida
  del corte.
- `05-idempotencia-y-concurrencia.md:348` «entra por la de recepción, como cualquier desconocido» —
  tabla de desempate, tercera fila.
- `05-idempotencia-y-concurrencia.md:378` «ya no tiene regla propia» — tachado el bloque *«lo que no
  desempata por decisión: la lápida del corte»*; la salvedad 4 del 1b se conserva (S-32 se mantiene).
- `05-idempotencia-y-concurrencia.md:397` «corte salió: FASE 5, simplificación del corte, S-40 y
  S-70).» — la comparación de cobros del barrido ya no tiene caso para la lápida del corte.

`B/03` (fuera del conteo de S-70, mismo sujeto):

- `03-maquinas-de-estado.md:295` y `:2772` «la lápida de recepción** (la del corte salió» — la
  salvedad 4 enumeraba *«las dos lápidas»*.
- `03-maquinas-de-estado.md:294` y `:2772` «~~**doce**~~ **once**» — el conteo de esa lista,
  recontado (abajo, §6).
- `03-maquinas-de-estado.md:1767` «la de recepción, la única que queda» — `P1` sobre una lápida;
  tachada también la cita a `B/21` §2.5.

`B/06` (las dos menciones de S-70, más el Worker):

- `06-proveedor.md:460` «en sandbox, antes de `B11`» — `EX-44`: tachado *«da el tamaño de la
  población del cobro sobre la lápida del corte»*.
- `06-proveedor.md:464` «su único sujeto era la ventana del corte» — `EX-48`.
- `06-proveedor.md:462` «el Worker del borde y las lápidas del corte salieron» — `EX-46`, S-45.
- `06-proveedor.md:462` «como el de cualquier desconocido» — `EX-46`, sale la cita a `G3-1`.
- `06-proveedor.md:556` «El Worker del borde que cerraba la ruta» — tachado el párrafo del `500`
  del Worker del paso 3 al 4 (S-45).

### Simplificación del corte, S-42, S-43, S-57 a S-62: la matriz, citada desde `B/06` §11

- `06-proveedor.md:458` «ni del corte: el vencimiento de las `Preference` del viejo salió» y
  «No se mide, por decisión» — `EX-42` (S-43, S-59).
- `06-proveedor.md:464` «No se mide, por decisión» — `EX-48` (S-57).
- `06-proveedor.md:465` «el detector y su segunda corrida salieron» y «No se mide, por decisión» —
  `EX-50` (S-42, S-58).
- `06-proveedor.md:460`, `:461` y `:463` «en sandbox, antes de `B11`» — `EX-44`, `EX-45` y `EX-47`
  salen del paso 0 (S-60, S-61).
- `06-proveedor.md:461` «condiciona sólo esta épica» — `EX-45` pierde el gate del paso 2 y el cobro
  sobre la lápida.
- `06-proveedor.md:467` «el detector que la usaba salió» — `EX-59`, sujeto retirado, fila como
  está (S-38, S-62).
- `06-proveedor.md:476` «ninguna se mide ya en el paso 0 del corte» — el recuento de las lecturas de
  la FASE 9 vuelta 2 (*«cinco de ellas en el paso 0»*, tachado).

### Lote 5 F (`R5-27`): las devoluciones de una orden

- `03-maquinas-de-estado.md:1851` «Por eso las devoluciones de una misma orden se serializan» —
  `RF2`, con lo medido en `EX-58` (`VERIFIED`, 2026-09-30) y el id por resta.
- `03-maquinas-de-estado.md:1851` «Un `409` es un error de programación» — no *«ya estaba hecha»*.
- `03-maquinas-de-estado.md:1851` «Esa nota de `RF-6` es del pago» — la nota de `RF2`.
- `03-maquinas-de-estado.md:1852` «para órdenes salió la rama» — `RF3`, tachadas la rama *«de su
  mismo monto»* y la de dos del mismo monto.
- `03-maquinas-de-estado.md:1851` «Con qué se impone la serialización no está elegido» — ⚠️ que
  apunta a «Vuelve al owner».
- `06-proveedor.md:134` «y está medido cómo» — §4.6 de `B/06` decía *«no están medidos»*.

### Lote 4 E (`R5-29`): tablas de sólo agregar sin `deleted_at`

- `02-modelo-de-datos.md:1241` «Nace sin `deleted_at`» — `provider_notification`, la única tabla
  que `B/02` declara de sólo altas.

## 3. Lo que no se aplicó y por qué

- **Las marcas `R5-` de mis archivos no son racimos de la FASE 5.** Las siete (`B/03` 5, `B/05` 1,
  `B/02` 1) son `C-R5-1`, `C-R5-2`, `C-R5-4`, `C-R5-5` y `C-R5-6`: etiquetas de origen de la FASE 9
  completa, históricas. No hay nada que resolver y no se tocaron.
- **Lote 1 I**: ninguna tabla de mis capítulos usa un enum del cobro viejo ni un permiso
  `BILLING_*`; no hay texto que cambiar.
- **Lote 4 E sobre `trial`**: `trial` vive en `V/02`, no en mis archivos (va a otro dueño). En
  `B/02` no se declara ninguna otra tabla de sólo agregar; no se clasificó ninguna nueva.
- **S-44** (la `Preference` pagada días después) no aparece en mis archivos.
- **`B/06:392`** (*«el handler que exceptúa las sondas del corte»*): S-47 se mantiene; sin cambio.
- **`B/06:549`** (la ruta `/api/v1/webhooks/mercadopago`, citada por F5-API-001): se confirma, sin
  cambio; sólo se tachó el párrafo del Worker que la sigue.
- **`B/06:28`** (el conteo de `UNKNOWN` del encabezado): ningún estado cambia en la FASE 5, así que
  el conteo no se toca.
- **`B/02:841`** (*«la herramienta del corte traen la versión»*): es la escritura de los grants del
  3b, que se mantiene (S-68).

## 4. Para otro dueño

- **`B/09` §3, salvedad 4**: la lista de terminales que reintentan la cancelación contaba *«las dos
  lápidas»*; `B/03:294` y `:2772` ya dicen **once** y la lápida de recepción. Texto propuesto donde
  `B/09` enumere: «~~las dos lápidas~~ **la lápida de recepción** (la del corte salió: FASE 5,
  simplificación del corte, S-40 y S-70)», con el número recontado.
- **`B/09` §2.4 y §3** (las dos menciones de S-70): la comparación de cobros *«sobre la lápida del
  corte compara sólo los registros cuyo pago aprobado es posterior al día del corte»* sale; queda
  la lápida de recepción, que cae en la tercera fila del desempate de `B/05` §3.
- **`V/02` §5** (lote 4 E): «`trial` nace sin `deleted_at`» junto al trigger que rechaza el
  `DELETE`.
- **Matriz, fila `EX-58`** (l.415, columna de lo que condiciona): *«y la rama de `RF3` sobre una
  orden cuya relectura no trae el id de la devolución, que toma la de su mismo monto»* ya no tiene
  sujeto; nota propuesta: «(la rama salió: FASE 5, owner 2026-09-30, lote 5 F)».
- **`B/descomposicion.md`, fila `B6`**: sumar los criterios *«las devoluciones de una orden salen de
  a una»* y *«un `409` en la devolución de una orden es error de programación»*.
- **Log, `DEC-CONC-002`**: su tercer 📌 cuenta dos lápidas; queda una (ya previsto en
  `20-simplificacion-del-corte.md` §11).

## 5. Vuelve al owner

### 5.1 ¿Sale la columna `origen_de_lápida`?

S-70 dice que la columna *«queda con un solo valor y puede salir»*; ni el lote C ni el E lo
decidieron. Hoy la fila de Juan con un cobro viejo es una `subscription` con `clase = LÁPIDA`, y
además dice `origen_de_lápida = RECEPCIÓN`, que ya no le agrega nada: no hay otra lápida.

1. **Sacar la columna**: la lápida se reconoce por `clase = LÁPIDA`. Costo: tachar la columna y su
   restricción en `B/02` y la mención de `B/05` §3. Riesgo: si un día vuelve otra forma de
   lápida, hay que agregar una columna con una migración. **Recomendada**: la base queda sin
   vocabulario que nadie lee, en la línea de la I del lote 1.
2. **Dejarla con un solo valor.** Costo: ninguno ahora. Riesgo: una columna que siempre vale lo
   mismo, y alguien que la lee creyendo que decide algo.

### 5.2 ¿Con qué se impone que las devoluciones de una orden salgan de a una?

El lote 5 F decidió serializar, y `B/05` §1 dice que el diseño no usa locks distribuidos: todo se
resuelve con una restricción de la base o con una relectura. Si a Juan le devolvemos dos cosas de la
misma compra, la segunda tiene que esperar a que la primera tenga su id asentado.

1. **Una restricción de la base**: a lo sumo una devolución de la orden con una llamada sin id
   asentado. Costo: un índice parcial en `refund`. Riesgo: una llamada que nunca responde deja la
   orden esperando hasta que el barrido la reenvíe con la misma clave, que ya está diseñado.
   **Recomendada**: es el mecanismo que `B/05` §1 usa para todo lo demás.
2. **Un candado de fila sobre la instancia durante la llamada.** Costo: bajo. Riesgo: una
   transacción abierta mientras se espera al proveedor.
3. **Que sólo el barrido mande las devoluciones de órdenes, de a una.** Costo: la devolución sale
   en la corrida siguiente y no cuando la persona confirma. Riesgo: más lenta.

## 6. Conteos

Hechos con script (`python3`, sobre el texto sin tachados; la foto de antes es `git show HEAD:`):

| archivo | «lápida del corte» vivas, antes → después | `CORTE` como valor | `G3-1` | `R2` | `V2-a` | «paso 0 del corte» |
|---|---|---|---|---|---|---|
| `B/02` | 6 → 4 (las cuatro dicen que salió) | 2 → 0 | 3 → 0 | 2 → 0 | 2 → 0 | 0 → 0 |
| `B/03` | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| `B/05` | 5 → 4 (las cuatro dicen que salió) | 1 → 0 | 2 → 0 | 6 → 0 | 3 → 0 | 0 → 0 |
| `B/06` | 2 → 1 (dice que salió) | 0 → 0 | 1 → 0 | 1 → 0 | 1 → 0 | 7 → 1 (dice que ya no se mide ahí) |

- Lista de la salvedad 4 en `B/03`: `S12`, `S3`, `S13`, `S16`, `S20`, `S22`, `S23`, `S24`, `S31`,
  `S36` y una lápida = **11** (antes 12, con dos lápidas), contada con `python3` sobre la
  enumeración de `03-maquinas-de-estado.md:294`.
- Menciones de `R5-` en mis archivos: `rg -o -n '.{0,80}R5-.{0,60}'` → 7, todas `C-R5-N`.
- `npx markdownlint-cli2` sobre los cuatro archivos: **0 antes** (sobre `git show HEAD:`) y **0
  después**.
