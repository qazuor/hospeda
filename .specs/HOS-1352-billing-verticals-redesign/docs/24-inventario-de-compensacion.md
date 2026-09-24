---
title: Inventario de compensación — qué de lo que Mercado Pago no hace lo suple el diseño
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 1C
---

# 24 · Inventario de compensación

## Por qué existe

`DEC-MP-005` (2026-09-24) fijó Mercado Pago **y** una directriz: *«lo que MP no hace lo suple
nuestro lado, hasta donde se pueda»*. Esa directriz **no es un cambio de rumbo** — el diseño ya venía
compensando— pero **nadie había inventariado la compensación**, así que no existía forma de contestar
*«¿cuántas carencias del proveedor siguen sin respuesta de diseño?»* sin volver a leer el corpus
entero.

Este documento cruza **cada carencia medida** contra **la decisión o el capítulo que dice qué hacemos
en su lugar**, y marca las que no tienen ninguno.

**No decide nada.** Es un cruce con citas. Lo que destapa se resuelve donde corresponda.

## Cómo se construyó, y la regla que lo hace útil

**Está prohibido inferir.** Una fila cuenta como compensada sólo si existe una cita que (a) nombra el
hecho y (b) dice qué hacemos en su lugar. *«Es obvio que haríamos X»* no es una cita. Ante la duda, la
fila va del lado de las que faltan.

Fuentes admitidas: `01-decision-log.md`, los capítulos de `HOS-1354`, los de `HOS-1353` y los del
núcleo. **Quedaron fuera** `08-phase-1b-code-discovery.md` y todo lo que vive bajo `14-`…`23-` y los
`rastro-*.md`: son registro histórico, no diseño.

## El universo NO son las `NOT_SUPPORTED`, y ése es el primer hallazgo

Lo natural sería cruzar las **22** filas `NOT_SUPPORTED`. Sería incompleto: **el estado de la matriz
mide si el proveedor HACE la cosa, no si la hace BIEN.** Tres de las fallas que
[`10-evaluacion-de-proveedor.md`](./10-evaluacion-de-proveedor.md) §1 clasifica en la categoría A
—*«la más cara, y la más específica de este proveedor»*— están en otro estado:

| fila | estado | qué mide |
|---|---|---|
| `EX-15` | **`VERIFIED`** | mutar el monto **no emite webhook** |
| `EX-3` | **`VERIFIED`** | los correos que el proveedor le manda al cliente por su cuenta |
| `RC-1` | `PARTIALLY_SUPPORTED` | el buscador miente en tres direcciones |

**El universo son 25 filas**, no 22.

## Y una fila que sale, porque mide un éxito

**`EX-24` NO es una carencia.** Está `VERIFIED` y mide que el ciclo de un plan **sí es editable**
—*«verificado por relectura dos veces: `1 days → 2 days` … y `1 months → 2 months`»*—.

`10-evaluacion-de-proveedor.md` la lista **dos veces como falla**: entre los *«9 casos»* de A1
*«acepta y no aplica»* (l. 55) y bajo *«cambiar el ciclo»* en la tabla de capacidades que faltan
(l. 73). **Las dos son falsas, y por la misma razón.** Los casos de A1 son **8**.

Lo que sí vale de `EX-24` es su asimetría con `EX-25` —el ciclo del plan se edita pero **no alcanza a
los ya suscriptos**—, y eso ya lo dice `EX-25`.

> **Cómo se coló, porque el modo de falla se repite**: la fila de la matriz dice lo correcto; lo que
> agrupa mal es **la tabla que la resume**. Quien lee la tabla no ve nada raro. La defensa es abrir la
> fila.

---

## El cruce

### Compensadas — 21 de 25

> **Actualizado el 2026-09-24**: `EX-25` y `EX-27` pasaron acá desde la lista de abajo con
> `DEC-MP-007`. Y **`EX-31` estaba mal clasificada**: figuraba *«sin rastro»*, pero `DEC-MP-006` la
> cita como el hecho que la decide (`01-decision-log.md:4858`). La búsqueda que armó esta lista no
> la vio. Eran 18 y 7.

| fila | qué no hace MP | qué hacemos en su lugar | dónde está escrito |
|---|---|---|---|
| `PS-4` | no existe la auto-reanudación; no hay `pauseUntil` | **el reloj de fin de pausa es nuestro**, y el mismo scheduler sirve para el auto-resume y el early resume | `DEC-SUB-010` |
| `PS-6` | el ciclo que vence en pausa avanza la fecha sin cobrar, y lo pagado se pierde | la pausa se toma **en meses enteros**; al volver se cobra normal en el ciclo siguiente, sin prorrateo — *«la aritmética se compensa sola, así que no hace falta mecanismo»* | `DEC-SUB-010` |
| `RC-4` | el `search` devuelve menos campos que el `GET` | **el inventario a conciliar sale de NUESTRA base**: se guarda el id de cada suscripción y se leen de a una. El buscador **no puede ser fuente de verdad de nada** | `DEC-CONC-002` |
| `EX-4` | el ciclo de una viva no se muta: `200` y nada cambia | **cancelar y recrear**, re-autorizando en el checkout | `DEC-SUB-006` · `06-proveedor.md` §3 |
| `EX-5` | una autorización cubre **un solo monto** | **un preapproval aparte por cada addon recurrente** | `DEC-ADDON-002` |
| `EX-12` | un `card_token` es de **un solo uso** | toda re-autorización pasa por el **checkout del proveedor**; nunca se reusa un token guardado | `DEC-SUB-006` · `DEC-SUB-007` |
| `EX-14` | un evento de la cuenta de pruebas llega con `live_mode: true` | **el guard es `GET /users/me`**: la cuenta de pruebas trae `tags: ["test_user"]`, y todo lo que mute algo abre con él | `06-proveedor.md` §4.4 |
| `EX-17` | la creación no deduplica por ningún mecanismo — diez intentos, diez ids | **el candado es nuestro, va ANTES de llamar al proveedor, y es DURABLE** (nada en memoria del proceso) | `DEC-CONC-001` |
| `EX-18` | sólo ARS | ⚠️ **compensación de MODELO, no funcional**: la columna `moneda` existe con una restricción que hoy admite un valor, para no pagar una migración el día que haya otro proveedor. **Cobrar en otra moneda sigue sin existir** | `02-modelo-de-datos.md` §2.1 |
| `EX-20` | un `PUT` con varios campos **se aplica a medias** con un solo `200` | **toda mutación se verifica releyendo y comparando campo por campo** — el código de estado nunca cierra una mutación | `06-proveedor.md` §4.1 · invariante `D5` |
| `EX-21` | no se puede mover una viva de plan: `200` y sigue en el viejo | **cancelar y recrear**, compensando los días pagados **por valor** | `DEC-SUB-006` |
| `EX-22` | con plan, lo que la suscripción traiga se descarta en silencio | **no aplica al diseño**: no se usan los planes del proveedor. La premisa tiene decisión propia desde el 2026-09-24 — ver hallazgo 2 | `DEC-MP-007` |
| `EX-25` | el cambio de ciclo del plan **no alcanza a los ya suscriptos** | **no aplica, y nuestro modelo hace lo mismo a propósito**: el catálogo es nuestro y versionado, cambiar un plan publica una versión nueva y no mueve a nadie; mover a alguien es cancelar y recrear | `DEC-MP-007` · invariantes `D1` y `D13` · `DEC-SUB-006` |
| `EX-27` | `repetitions` y `billing_day` no funcionan sin plan | ⚠️ **resignada con causa, no suplida**: es lo que se pierde por no usar planes. Hoy ninguno se usa —la duración de una promo la llevamos mutando el monto—; si algún día hiciera falta cobrar un día fijo del mes, se relee la decisión | `DEC-MP-007` · `DEC-MP-001` |
| `EX-31` | no se puede cobrar de forma recurrente sin `preapproval`, con credencial guardada | ⚠️ **no se suple: es el límite duro de la directriz**. El reloj de cobro es del proveedor y el mandato es el modelo canónico; el cargo puntual queda **declarado como destino**, con la habilitación pedida en paralelo. **Un permiso comercial no se compensa con código** | `DEC-MP-006` |
| `EX-34` | la fecha de una viva es inmutable: cuatro formas, cuatro `200`, nada escrito | la pausa se toma en **meses enteros** y la aritmética se compensa sola | `DEC-SUB-010` · `06-proveedor.md` §3 |
| `EX-35` | no se le puede poner un `free_trial` a una viva | **la cortesía se implementa pausando** y sosteniendo el servicio de nuestro lado | `DEC-GRANT-003` |
| `EX-37` | el `init_point` **viene roto** y la API responde `201` con él | **se sanea antes de mostrarlo, con un guard estático** — porque es un call site que cualquiera vuelve a escribir «bien» copiando lo que la API devuelve | `06-proveedor.md` §4 · invariante `D10` |
| `EX-15` | mutar el monto **no emite webhook** | **no hay nada que releer porque nada llega**: el cambio de precio que el proveedor aceptó y no aplicó se detecta por barrido, no por evento | `03-maquinas-de-estado.md` · `09-conciliacion.md` |
| `EX-3` | correos al cliente que sus propios datos desmienten; pausa y cancelación llegan idénticas | el capítulo de outbox fija **qué avisamos nosotros y cuándo**, sabiendo qué manda el proveedor por su cuenta | `NUCLEO/07` · `NUCLEO/08` |
| `RC-1` | el buscador ignora `external_reference`, devuelve todo, o devuelve un subconjunto plausible | **leer por id**, nunca por búsqueda | `02-modelo-de-datos.md` · `05-idempotencia-y-concurrencia.md` |

### Sin compensación declarada — 4 de 25

| fila | qué no hace MP | estado en el corpus |
|---|---|---|
| **`RC-5`** 🚨 | `charged_quantity` cuenta **intentos, no cobros** | **El capítulo 09 sigue afirmando la regla que esta medición volvió falsa.** `09-conciliacion.md:549` resuelve *«no cobró nunca»* con *«el preapproval tiene `charged_quantity` en cero o nulo»* y concluye que la conciliación *«concluye desde el contador del preapproval»*. Aplicada al sujeto medido, **esa regla dice «sí cobró» sobre una suscripción que no cobró un peso**. La propia fila declara que se dejó *«como hallazgo para la FASE 8-bis-5 en vez de corregirse acá»* |
| **`RC-6`** | el `status` de un `authorized_payment` **no dice si se cobró** | Única mención fuera de la matriz: `DEC-MP-004` usa un sub-hallazgo suyo (que el `status_detail` es el del último intento). **Ningún documento dice qué campo leemos en su lugar** |
| **`EX-39`** | tampoco se mueve la fecha de una `pending`: la inmutabilidad **no depende del estado** | `12-suscripcion.md` §5.4 reconoce el hecho y `DEC-SUB-017` **excluye explícitamente** esta población: abre la corrección **sólo para el pagador manual**, y *«sobre el preapproval `pending` del proveedor la conclusión no cambia»* |
| **`EX-32`** | Wallet Connect no está disponible | **Sin rastro.** Cero apariciones fuera de la matriz |

---

## Los tres hallazgos transversales

### 1 · `RC-5` no es una carencia sin compensar: es una regla escrita que quedó falsa

Las otras de la lista son huecos — algo que nadie decidió todavía. **`RC-5` es distinta**: hay
una regla escrita, vigente y citable en `09-conciliacion.md` que **una medición posterior volvió
falsa**, y el capítulo no se corrigió. Un hueco no hace nada; una regla falsa **se ejecuta**.

Es además el caso que el `C1` de la 8-bis-5 identificó como **el primer crítico del programa producido
por una medición externa y no por un arreglo** (`F-8fB3-001`).

### 2 · «No usamos los planes del proveedor» sostiene tres filas y no tiene decisión propia

`EX-22` queda fuera de alcance porque **no usamos `preapproval_plan`**. Esa premisa es load-bearing
—si cambiara, vuelven `EX-22`, y con ella `EX-25` y `EX-27`, que son las otras dos filas de planes— y
**no está escrita como decisión en ningún lado**:

- vive en **una implicación de otra decisión** (`01-decision-log.md:1519-1521`), atribuida a
  `DEC-MP-002`;
- pero `DEC-MP-002` es *«El aumento rige ya para los nuevos, y alcanza a los existentes tras 60 días
  de aviso»*, que **no decide nada sobre usar o no los planes del proveedor**. Lo que la implica es
  `DEC-MP-001`, que eligió **mutar el monto** como mecanismo;
- y **`preapproval_plan` tiene cero apariciones** en los capítulos de `HOS-1354`, `HOS-1353` y el
  núcleo.

O sea: una premisa que decide el alcance de tres mediciones **no se puede citar**, y su única mención
apunta a la decisión equivocada.

> ✅ **Resuelto el 2026-09-24 con `DEC-MP-007`**: la premisa es decisión propia, con sus razones y con
> `EX-27` declarada como lo que se resigna. `DEC-MAIL-001` lleva en su campo *Estado* el puntero y la
> corrección de la atribución.

### 3 · Las mediciones más nuevas son las que no tienen decisión

`RC-5` y `RC-6` son del **2026-09-22**; `EX-39` del 2026-09-19. Las compensadas son casi todas del
**2026-09-15/16**. La correlación no es casual: una medición se vuelve decisión cuando alguien la
levanta, y **las últimas no tuvieron tiempo**. Vale como heurística para la próxima tanda: *una fila
medida después de la última decisión de su dominio es candidata a estar sin compensar*.

---

## Lo que este documento NO cubre

- **La categoría C de `10-evaluacion-de-proveedor.md`** —el banco que honra el débito sobre una
  tarjeta pausada, el retraso variable del cobro, los rechazos por riesgo del adquirente—. **No se
  arreglan cambiando de proveedor** y tampoco se «suplen» en el sentido de esta directriz: se conviven.
  Necesitan su propio tratamiento.
- **`R-MP-01`** — la API de reembolsos que MP anunció en discontinuación, con su guía de migración
  excluyendo explícitamente a las suscripciones. No es una carencia medida sino **un riesgo asumido**
  por `DEC-MP-005`, y su tratamiento está en **`HOS-1354` `06-proveedor.md` §10**, que lo cierra
  (`04-open-decisions.md:313`). No es del capítulo 13: ese capítulo no existe (se repartió, ver
  `nucleo/00-indice.md`).
- **Qué hacer con las 7 que faltan.** Este documento las nombra; no las resuelve.
