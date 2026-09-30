---
title: "FASE 5 · aplicación — capítulos del cobro (09, 10, 12, 14, 16, 19, 20, 22)"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación en los capítulos del cobro `B/09`, `B/10`, `B/12`, `B/14`, `B/16`, `B/19`, `B/20` y `B/22`

> Programa HOS-1352. Aplica [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) y las
> piezas de [`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md) (opción 1 en A a
> E) a los ocho capítulos de esta asignación. `$B` = `.specs/HOS-1354-billing-cobro-y-proveedor`.
> Sólo diseño; sin commits.

## 1. Archivos tocados

- `$B/docs/09-conciliacion.md`
- `$B/docs/16-addons.md`
- `$B/docs/22-lo-legal.md`

Sin cambios, después de buscar cada pieza (ver §3): `$B/docs/10-verticales-planes-billing-options.md`,
`$B/docs/12-suscripcion.md`, `$B/docs/14-promos-cortesias-y-grants.md`, `$B/docs/19-superficies.md`,
`$B/docs/20-testing.md`.

## 2. Qué se aplicó

### Simplificación del corte, lote C (S-40, S-41, S-42, S-70)

- `B/09:97` «la lápida del corte salió; la forma de fila» — la lápida de recepción deja de citar la
  del corte y `B/21` §2.5 como modelo; la forma de fila de R6 queda (S-40, S-70).
- `B/09:187` «Sale la lápida del corte, su ventana y el detector del día siguiente» — se tachan, en
  la fila *«cobros del período»*, la no-comparación de los cobros del día del corte, el detector del
  día siguiente y la regla del cobro posterior al día del corte; un cobro tardío de un débito viejo
  lo recoge la lápida de recepción con `PAGO_TARDÍO_RECHAZADO` y la propuesta de devolver (S-40,
  S-41, S-42; S-46 se mantiene).
- `B/09:308` «| ~~la **lápida** del corte» — la fila de la lápida del corte en la tabla de puertas a
  un estado terminal sale (S-40).
- `B/09:288` «**catorce** puertas a un estado terminal» — el conteo baja de quince a catorce (S-40).
- `B/09:319` «**once** de las **doce** filas» — la salvedad 4 pasa de doce de trece a once de doce
  (S-40).
- `B/09:319` «~~ **la lápida de recepción** (**la de recepción**» — de *«las dos lápidas»* a la de
  recepción (S-40, S-70).
- `B/09:319` «duodécima, `S21`» — `S21` pasa de decimotercera a duodécima fila *«no»* (S-40).
- `B/09:319` «diez son principales» — de once a diez principales (S-40).
- `B/09:319` «la ventana del corte salió: FASE 5» — la relectura sobre una lápida pierde la mención
  de los cobros posteriores al día del corte (S-41).
- `B/09:324` «~~**doce**~~ **once** de la 4» — el reintento de una cancelación nuestra cuenta once
  (S-40).
- `B/09:325` «la del corte salió: FASE 5, simplificación del corte, S-40)—» — de *«las dos
  lápidas»* a la de recepción en el mismo párrafo (S-40).
- `B/09:351` «Sobre ~~una lápida~~ la lápida de recepción no hay transición» y `B/09:354` «esa
  excepción del correo era de la lápida del corte» — los 3 días se cuentan desde que se escribió
  (§2.4); sale la cita a `B/21` §2.5 y al paso 4, y la excepción del correo del corte (S-40, S-70;
  ver §5).
- `B/16:907` «la lápida de recepción (FASE 5, simplificación del corte, S-40 y S-70» — la única
  mención de la lápida del corte en `B/16` (S-70).
- `B/16:1021` «~~**quince**~~ **catorce** (sale la lápida del corte» — el conteo de puertas que
  `B/16` cita de `B/09` §3 (S-40).

### Simplificación del corte, lotes B y C (S-43, S-44, S-72)

- `B/09:1188` «Sale la parte del corte» — en *«lo que este capítulo NO cierra»* se tacha el pago
  diferido de una `Preference` del viejo, su vencimiento por API en el 1a con `EX-42` y los 30
  minutos previos al 0b; queda el «NO cierra» del pago de única vez, que es producto (S-43, S-44,
  S-72).

### Mediciones que salen del paso 0 (S-60, S-61)

- `B/09:229` «de `EX-44`, en sandbox antes de» — la medición que decide si cancelar corta el
  reciclado se hace en sandbox antes de `B11`, fuera del paso 0 (S-60).
- `B/09:187` «se mide en sandbox antes de `B11`, fuera del paso 0» — `EX-47` (S-61).

### Lote 5 F · devoluciones de una orden (`R5-27`)

- `B/09:862` «Sobre la devolución de una ORDEN no hay llamada sin id» — serializadas por orden, id
  por resta contra las registradas, la rama del mismo monto no se usa en órdenes, `409` = error de
  programación, y la nota de `RF-6` (`200` con cuerpo vacío) queda del pago.
- `B/09:1286` «sobre una orden no pasa: sus devoluciones se» — el «NO cierra» de las dos
  devoluciones del mismo monto queda acotado al pago.
- `B/16:141` «Y la devolución de una orden trae su» — el camino de la orden, con la serialización
  y el `409`.
- `B/22:136` «**están medidos** (`EX-58`, `VERIFIED`, 2026-09-30,» — la revocación del addon de
  única vez deja de decir que la idempotencia de la devolución no está medida.

### Lote 2 A y B · el outbox común `U2`

- `B/09:1109` «los agrega `U2`, el outbox común» — la correlación de corrida del barrido, el id de
  corrida y el huso los agrega `U2`; el reloj sigue en `B1` (lote 2 B).
- `B/22:57` «lo construye `U2`, el outbox común» — la evidencia del envío vive en el outbox de `U2`,
  que absorbe la bitácora de correos (lote 2 A).

## 3. Lo que no se aplicó y por qué

- **Las 4 menciones de `R5-` de `B/09`** (l.314, 319, 326 y 351): son `C-R5-2`, `C-R5-3` y
  `C-R5-4`, marcas de la FASE 9 completa (racimo 5 de la vuelta C), no racimos `R5-NN` de la FASE 5.
  Nada que resolver; se dejan.
- **`R5-31`** (`B/19` §3, `SUP-005`) y las otras citas a `B/19` del informe 04 (`SUP-009`,
  `SUP-028`, `SUP-032`, `SUP-034`): son del grupo B del consolidado (lo corrige el código en su
  unidad) o sin decisión en `10-`; no piden texto en `B/19`. La cita de `03-` a `B/19:329`
  (`API-007`) es KEEP.
- **Lote 1 E y F** (`owner_promotions.plan_restricted`, `is_featured`, `featured_by_entitlement`,
  destaque, home): cero apariciones en `B/14` y `B/16` (`rg` de `plan_restricted`, `owner_promo`,
  `featured`, `destac`, `patrocin`, `tipo de cambio`: 0). `B/14` habla de los códigos de promo del
  cobro nuevo, no de las promociones del dueño.
- **Lote 5 F en `B/12`**: `B/12` no habla de órdenes ni de sus devoluciones (su única cita de
  `RF-6` es genérica, l.591). Nada que corregir.
- **Lote 2 A/B en `B/19` y `B/20`**: ninguno nombra el outbox ni la correlación; el reloj de
  `B/20` §8 punto 2 ya es de `B1`, como manda el lote 2 B.
- **S-62 (`EX-59`), S-63 (`EX-40`), `EX-42`/`EX-48`/`EX-50`**: sin menciones en mis archivos salvo
  `EX-42` en el bullet tachado de `B/09:1188`. **`EX-45`** aparece en `B/09` (l.219, 236, 281, 1297)
  sólo por su uso de producto (la ventana de relectura por rechazo), sin *«paso 0»*: nada que
  cambiar.
- **El manifiesto de sondas y el 4b** (`B/09` §2.4, l.110-135): S-47 y S-48 los mantienen.
- **`B/10`, `B/14`, `B/19`, `B/20`**: ninguna pieza de la asignación los toca (búsquedas de
  `lápida`, `corte`, `paso 0`, `EX-4x`, `outbox`, `correlaci`, `featured`, `plan_restricted`).

## 4. Para otro dueño

- **`B/03` §6.1, filas `RF2` y `RF3`** (`03-maquinas-de-estado.md:1851-1852`), lote 5 F: sacar de
  `RF3` la rama *«toma la devolución de la orden de su mismo monto»* para órdenes, sumar la
  serialización por orden y la resta, y corregir la nota de `RF2` sobre `RF-6`. Texto propuesto,
  al lado de lo tachado: *«sobre una orden, el `POST` devuelve todas las devoluciones de la orden y
  la nueva sale por resta contra las registradas; las de una misma orden se serializan; un `409` es
  un error de programación (clave mal derivada); el `200` con cuerpo vacío de `RF-6` es del pago
  (FASE 5, owner 2026-09-30, lote 5 F)»*. `B/09:862` ya lo cita así.
- **`06-mp-validation-matrix.md:401` y `:402`** (`EX-44`, `EX-45`): la columna *«para qué»* todavía
  nombra *«el cobro sobre la lápida del corte»*; con S-40 queda sólo el uso de producto
  (`B/09` §3). Lo mismo `B/06:453` (fila de `EX-44`).
- **`B/descomposicion.md`, criterios de `B11`**: que los tests de la salvedad 4 cuenten once filas
  y una sola lápida (`B/09:319`), y que la conciliación de la devolución de una orden pruebe la
  serialización y la resta (`B/09:862`).

## 5. Vuelve al owner

### Si el reintento sobre la lápida de recepción repite el correo *«antes de cancelar»*

`B/09` §3, punto 2, decía que sobre *«una lápida»* el reintento sale **sin** correo, con una razón
que sólo vale para la del corte (*«la comunicación del corte es la del corte»*). Al salir la del
corte, esa excepción se tachó (`B/09:354`) y quedó sin decir qué pasa con la de recepción, cuyo
correo lo manda el handler al escribirla y *«sin destinatario conocido no bloquea»* (§2.4).
Ejemplo: a Juan le entra un cobro de un débito viejo; el handler escribe la lápida de recepción,
intenta el correo y manda cancelar; la cancelación no se aplica y el barrido la reintenta al día
siguiente.

1. **El reintento sigue el punto 1 como toda cancelación nuestra**: el correo sale una vez, antes
   del primer intento, y no se repite si se entregó. Costo: ninguno (es la regla general). Riesgo:
   si el correo no se entregó por falta de destinatario, el reintento lo vuelve a intentar sin
   efecto. **Recomendada**.
2. **El reintento sobre la lápida de recepción sale sin correo**, como antes. Costo: una excepción
   escrita. Riesgo: Juan, si tiene correo conocido y el primero falló, no recibe ninguno.

## 6. Conteos

Cambios aplicados (viñetas del §2): **23** — `B/09`: 18, `B/16`: 3, `B/22`: 2.

```sh
awk '/^## 2\./{f=1} /^## 3\./{f=0} f && /^- /' 38-fase-5/17-aplicacion-cobro-capitulos-b.md | wc -l
```

markdownlint (`npx markdownlint-cli2`): **0 antes y 0 después** en los tres archivos tocados (el
«antes» se corrió sobre `git show HEAD:` de cada uno).

Menciones de `lápida del corte` que quedan sin tachar en mis archivos, con
`rg -c 'lápida del corte' <archivo>`: se revisaron una por una; todas las restantes están dentro de
un tachado o en la nota de origen `(FASE 5, …)`.
