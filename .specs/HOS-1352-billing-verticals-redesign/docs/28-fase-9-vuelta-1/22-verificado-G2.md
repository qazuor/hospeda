---
title: "FASE 9 vuelta 1 · G2 verificado — el fin de la ficha, el addon y el aviso de cobertura"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G2 verificado

Verificación de los **17** hallazgos de `02-G2-purged-addons-y-aviso.md` (racimos R2, R3, R9 y los
sueltos de `A2`) contra el texto vigente del worktree de la spec (commit `4347cfd9de`), con el
criterio de `DEC-METH-004` opción 3: cada camino de Juan se reejecutó paso a paso sobre el texto
de hoy, y cada racimo se recorrió contra todo el dominio que declaró su documento de resolución.
Las decisiones del owner que se tomaron en cuenta son las de `10-decisiones-del-owner.md`:
**`G2-1` = 2** (empuje de verticales a billing, con `fichaPurgada` como red; contra la
recomendación), **`G2-2` = 1**, **`G2-3` = 1**, **`G2-4` = 1**, y el OK `K` (la unidad que consume
el empuje es `B10`).

Rutas: `V/` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion/`, `B/` =
`.specs/HOS-1354-billing-cobro-y-proveedor/`, `D/` = `.specs/HOS-1352-billing-verticals-redesign/docs/`.
Las citas se verificaron con `27-fase-8-vuelta-1/verificar-citas.py`.

---

## 1. Resumen

| hallazgo | veredicto | línea que lo corta o lo declara |
|---|---|---|
| `F-8V1A3-003` (R2) | **DEJA** | «Es lo único que verticales le empuja a billing.» — `D/12-contrato-de-cobertura.md:933` |
| `F-8V1C1-001` (R2) | **DEJA** | «el empuje de `PB9`/`PB12` que dispara `A6` no llegó o `A6` no se pudo ejecutar» — `B/docs/09-conciliacion.md:471` |
| `F-8V1A2-002` (R2) | **DEJA** | «desde `K-9` `A6` es la única fila que cancela el addon `LISTING` que apuntaba a ella» — `V/docs/03-maquinas-de-estado.md:536` |
| `F-8V1C1-013` (R2) | **DEJA** | «la única fila que cancela el addon `LISTING` que apuntaba a ella (`K-9`; FASE 9 vuelta 1, `F-8V1C1-013`)» — `V/docs/03-maquinas-de-estado.md:539` |
| `F-8V1D1-009` (R2) | **DEJA** | «los **dos** de la instancia, la misma enumeración que el 18» — `D/nucleo/01-glosario.md:575` |
| `F-8V1B1-002` (R3) | **DEJA** | «o pasa a `SUSPENDED` por `S6`, por cualquiera de sus cinco eventos» — `B/docs/03-maquinas-de-estado.md:178` |
| `F-8V1A2-007` (R3) | **DECLARADO** | «Un destaque recurrente sobre una ficha que no se ve con la principal viva se sigue cobrando» — `B/docs/16-addons.md:990` |
| `F-8V1C1-006` (R9) | **DEJA** | «Emite el aviso, en el mismo acto, toda escritura que cambia la respuesta del §2.1» — `D/12-contrato-de-cobertura.md:862` |
| `F-8V1C1-010` (R9) | **DECLARADO** | «segunda publicación sin cobertura, y regala un trial, no cobra (FASE 9 vuelta 1,» — `V/docs/03-maquinas-de-estado.md:1180` |
| `F-8V1A2-010` (R9) | **DEJA** | «La fila de los días en cero no es un estado final» — `V/docs/03-maquinas-de-estado.md:342` |
| `F-8V1C1-012` (R9) | **DEJA** | «que publica sólo con `cubierto` verdadero o si dispara `T1`» — `D/12-contrato-de-cobertura.md:119` |
| `F-8V1A2-003` | **DECLARADO** | «consume también el trial de quien publicó sólo con una suscripción que nunca cobró» — `V/docs/03-maquinas-de-estado.md:387` |
| `F-8V1A2-004` | **DEJA** | «publicó con una suscripción que todavía no cobró consume su fila por `T8`» — `V/spec.md:230` |
| `F-8V1A2-005` | **SIGUE** (paso 4) | «Dónde vive el vínculo lo declara `V/02` junto con el resto de la cuenta de Partner» — `V/docs/03-maquinas-de-estado.md:1208` |
| `F-8V1A2-006` | **DEJA** | «cada envío relee `vertical.admite_altas` antes de salir» — `D/nucleo/07-outbox-y-notificaciones.md:226` |
| `F-8V1A2-008` | **DEJA** | «y dentro del lock relee `cubierto` —primera rama— y el cupo —segunda— antes de escribir» — `V/docs/03-maquinas-de-estado.md:529` |
| `F-8V1A2-009` | **DEJA** | «la guarda de hash leída tarde. No dispara, y la transacción que la contenía» — `V/docs/03-maquinas-de-estado.md:322` |

**Conteo: 13 DEJA · 1 SIGUE · 3 DECLARADO · 0 OTRA.** Racimos: **R2 cubierto** (con dos
salvedades de texto, §4), **R3 no cubierto** (el caso `m`, `PB5`, y su vecino: §3, `N-G2V-02`),
**R9 cubierto**. Hallazgos nuevos: **3** (1 ALTA, 1 MEDIA, 1 BAJA).

---

## 2. Recorrido por racimo

### 2.1 R2 · la llegada a `PURGED` llega a billing

**Los cinco caminos, reejecutados.**

- `F-8V1A3-003` y `F-8V1C1-001` (Juan borra «Cabañas del Río», con destaque mensual y la principal
  viva). Paso 3 del camino original, *«nada en el contrato avisa a billing»*: se corta en el §3.1
  nuevo del contrato, que emite el hecho en el acto de `PB12` y hace correr `A6` al recibirlo. Paso
  4, *«el barrido del cap. 09 no mira `PURGED`»*: se corta en la mitad nueva de la cuarta
  comprobación, que lee `fichaPurgada` y corre `A6` antes de marcar. El empuje perdido vuelve al
  día de atraso, declarado (§2.1, caso 1). Pero ver `N-G2V-01`: hay una lectura del texto vigente
  en la que el empuje llega **siempre** antes de tiempo y el camino principal cae a la red.
- `F-8V1A2-002` y `F-8V1C1-013`: las tres menciones de `V/03` §9 que mandaban el borrado a `A5`
  están tachadas y reescritas a `A6`. `rg` sobre `V/`, `B/`, el núcleo y el contrato: las únicas
  apariciones de *«la ficha se borró»* que quedan están dentro de `~~…~~` o cuentan la historia
  de `K-9`. La colisión `A5`/`A6` no tiene de dónde releerse.
- `F-8V1D1-009`: la fila 18 del inventario dejó el *«único»* y entraron la 23 (`A6`) y la 24
  (`S32`). Ver `N-G2V-03` para el vecino.

| cita | dónde |
|---|---|
| «busca las instancias vivas de scope `LISTING` con ese `objetivo` y corre `A6`» | `D/12-contrato-de-cobertura.md:936` |
| «En los dos caminos `A6` relee `fichaPurgada` antes de cancelar» | `B/docs/03-maquinas-de-estado.md:2527` |
| «en ese caso el barrido corre primero `A6`» | `B/docs/09-conciliacion.md:471` |

**El dominio declarado (doce casos), contra el texto vigente.**

| # | caso | dónde se contesta | ¿cubierto? |
|---|---|---|---|
| 1 | `PB9` desde `ARCHIVED` | «Y en el mismo acto empuja a billing el hecho» — `V/docs/03-maquinas-de-estado.md:536` | sí (empuje + red); empuje perdido declarado |
| 2–5 | `PB12` desde `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED` | «y en el mismo acto empuja a billing el hecho» — `V/docs/03-maquinas-de-estado.md:539` | sí, los cuatro `desde` están en la fila |
| 6 | `MODERATED` → `PURGED` | «`PB12` no sale de `MODERATED`.** La decisión nombra el borrado del dueño» — `V/docs/03-maquinas-de-estado.md:736` | sí: no existe la llegada, es el NO cierra 1 |
| 7 | hard delete del admin fuera de `PB9`/`PB12` | «borrado de ficha sale de otra fila que `PB9` o `PB12`» — `D/nucleo/08-auditoria-y-observabilidad.md:188` | sí: desde `G5-2` no existe. Tres NO cierra lo siguen nombrando como camino vivo (§4, punto 1) |
| 8 | borrado de la cuenta pedido por el usuario | «queda pendiente: el borrado de la cuenta pedido por el propio usuario» — `D/nucleo/08-auditoria-y-observabilidad.md:87` | sí, por la red: `fichaPurgada` contesta `sí` si la fila no existe. El NO cierra del empuje no lo nombra (§4, punto 1) |
| 9 | discontinuación de la vertical | «hoy son **trece** (FASE 9 completa, contradicción 2 de `03` §R6.5)» — `B/docs/03-maquinas-de-estado.md:2526` | sí: la principal sale de las filas vivas antes, `A5` corre con el motivo 15; `A6` encuentra `CANCELLED` |
| 10 | instancia en `PENDING_AUTHORIZATION` | «puede cobrar —`PENDING_AUTHORIZATION` o `ACTIVE`» — `B/docs/09-conciliacion.md:465` | sí, en el `desde` de `A6` y en la cuarta comprobación |
| 11 | instancia de única vez | «Se consume**: no se libera ni se reasigna» — `B/docs/03-maquinas-de-estado.md:2527` | sí; sin preapproval, el día de atraso no mueve plata |
| 12 | complemento en `PAUSED` por `S32` (y, desde `G2-2`, por `S6`) | «o termina por `S20` o `S21` —que le escriben `fin_real`—» — `B/docs/03-maquinas-de-estado.md:178` | sí: la instancia sigue `ACTIVE`, `A6` corre y `S21` sale de `PAUSED` |

Un caso más, fuera del dominio declarado, que verifiqué porque es otra llegada a `PURGED`: **la
ficha que el corte hace nacer `PURGED`** (`L1`, `G1-2`). No tiene addon vivo: el corte descarta las
compras de addon del sistema viejo.

| cita | dónde |
|---|---|
| «corte descarta sin nombrar hasta ahora —compras de addon, canjes de promo, grants de destaque y» | `B/docs/21-migracion.md:68` |

**Veredicto del racimo: cubierto**, con dos salvedades de texto (§4, punto 1) y el vecino
`N-G2V-01`, que no es un caso del dominio sino del mecanismo nuevo.

### 2.2 R3 · el addon recurrente sin servicio con la principal viva

**Los dos caminos, reejecutados.**

- `F-8V1B1-002` (Juan, alojamiento de ARS 18.000 y destaque de ARS 3.000; rechaza el primero,
  entra el segundo, corre `S6`). Paso 4, *«el complemento sigue `ACTIVE` y cobra»*: se corta en el
  evento nuevo de `S32`. Paso 3, el correo *«ya no se te va a cobrar»*: ahora es verdad, y dice lo
  de los addons. Paso 5, *«nada detecta el caso»*: si el `PUT paused` no se aplica, `S14` pone la
  marca `PAUSA_NO_APLICADA`. La vuelta: por `S7` (pago manual) o por la sucesión con tarjeta, que
  `S18` re-apunta y `S33` reanuda; si la principal termina desde `SUSPENDED`, `S21` cancela desde
  `PAUSED`. Queda un residuo declarado —el complemento que autoriza después de `S6`— y el complemento
  que no se reanuda, declarado sin detector.
- `F-8V1A2-007` (un admin modera la ficha destacada de Juan). Sigue cobrando por decisión del owner
  (`G2-3` = 1): el aviso de moderar nombra los destaques y la NO cierra lo declara con causa.

| cita | dónde |
|---|---|
| «tampoco tus addons recurrentes, que quedan pausados y vuelven cuando vuelvas» | `B/docs/19-superficies.md:117` |
| «o la principal vuelve de `SUSPENDED` por `S7`» | `B/docs/03-maquinas-de-estado.md:179` |
| «El complemento que no se reanuda al volver de una suspensión no tiene detector» | `B/docs/16-addons.md:986` |
| «en la suspensión no hay tope, pero necesita que `S6` caiga dentro de la ventana de autorización» | `B/docs/16-addons.md:998` |

El residuo de la suspensión sí es alcanzable, aunque angosto: `A1` exige principal `ACTIVE`, y la
ventana de autorización es de 72 h con tarjeta y 7 días con pago manual, menos que el grace de 10
días; así que sólo lo alcanzan `S6` por su segundo o tercer evento (preapproval pausado por el
proveedor, contracargo), que salen de `ACTIVE` sin grace. Está bien declarado.

**El dominio declarado (a–o), contra el texto vigente.**

| # | estado | dónde se contesta | ¿cubierto? |
|---|---|---|---|
| a | principal `PAUSED · CUSTOMER_REQUEST` | «Un complemento que autoriza durante la pausa de su principal cobra hasta que ella vuelva» — `B/docs/16-addons.md:995` | sí (`S32`, 4a) + residuo declarado |
| b | principal `PAUSED · COURTESY` | «Las pausas por `COURTESY` no pausan complementos» — `B/docs/03-maquinas-de-estado.md:178` | sí |
| c | principal `GRACE_PERIOD` | «el grace **sí emite fuente**— más lo que le quedara de reloj» — `B/docs/19-superficies.md:115` | sí: hay servicio |
| d | principal `CANCEL_SCHEDULED` | «servicio hasta el fin; después `S12` → orfandad» — `D/28-fase-9-vuelta-1/02-G2-purged-addons-y-aviso.md:216` | sí, sin cambio desde la resolución |
| e | principal `SUSPENDED` | «o pasa a `SUSPENDED` por `S6`» — `B/docs/03-maquinas-de-estado.md:178` | sí (`G2-2` = 1) |
| f | principal terminal sin relevo | «desde una `SUSPENDED`, `S23` o `S27`» — `B/docs/03-maquinas-de-estado.md:179` | sí (orfandad + `S21`) |
| g | ancla de grant revocada | «o se revoca el grant del que cuelga el ancla que era su título» — `B/docs/03-maquinas-de-estado.md:2526` | sí |
| h | vertical discontinuada | «hoy son **trece** (FASE 9 completa, contradicción 2 de `03` §R6.5)» — `B/docs/03-maquinas-de-estado.md:2526` | sí |
| i | ficha `DRAFT` por `PB6` | «que se siguen cobrando aunque no esté publicada» — `V/docs/19-superficies.md:72` | declarado (`G2-3`) |
| j | `UNPUBLISHED_BY_BILLING`, rama 1 | se reduce a a, e, f | sí |
| k | `UNPUBLISHED_BY_BILLING`, rama 2 | «y los destaques recurrentes de las fichas que baja, que se siguen cobrando» — `D/nucleo/07-outbox-y-notificaciones.md:235` | declarado (`G2-3`) |
| l | `ARCHIVED` por `PB4` | se reduce a a, e, f | sí |
| m | `ARCHIVED` por `PB5` | «el aviso de **ficha archivada** (`PB4`, día 90)» — `V/docs/19-superficies.md:65` | **no**: la NO cierra dice que el acto lo dice, y ningún aviso de `PB5` nombra los destaques (§3, `N-G2V-02`) |
| n | `MODERATED` | «los destaques recurrentes sobre esa ficha, que se siguen cobrando hasta que los dé de baja» — `V/docs/19-superficies.md:71` | declarado (`G2-3`); el correo no está en el catálogo (§4, punto 4) |
| o | `PURGED` | es R2 | sí |

**Veredicto del racimo: no cubierto** por el caso `m`, que el propio `12-aplicado-G2.md` §4 punto
3 dejó *«como residuo sin escribir»* mientras la NO cierra afirma lo contrario.

### 2.3 R9 · el censo de emisores

**Los cuatro caminos, reejecutados.**

- `F-8V1C1-006` (un admin revoca el grant de Juan; el trial de Juan vence con la implementación de
  arranque). Paso 1, *«el implementador de `B9` sigue la tabla de efectos y no emite»*: se corta en
  el censo del contrato (*«otorgar y revocar un grant»*) y en la frase nueva antes de la tabla de
  `B/03` §3.2. Paso 3, `T3` sin aviso en la de arranque: se corta en el §5.1.
- `F-8V1C1-010`: declarado en el ⚠️ punto 3 del reconciliador y cruzado desde el ⚠️ punto 4 de `V/03`
  §2.
- `F-8V1A2-010`: los cinco ordinales tachados o renombrados por contenido; `V/18` dice *«las
  cuatro»*; `T8` entró a la lista de quién espera el primer pago.
- `F-8V1C1-012`: `PB1` encabeza la fila `cubierto`.

| elemento del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| emisores de billing salvo `P1` | «el censo de emisores está allá (*«quién emite»*) y no se copia» — `B/docs/03-maquinas-de-estado.md:142` | sí |
| `T1`–`T5` en la de arranque | «en las transiciones de trial del censo del §3» — `D/12-contrato-de-cobertura.md:1188` | sí |
| fecha que vence sin transición | «**Una fecha que vence sin transición no emite** (§2.6): la cubre el» — `D/12-contrato-de-cobertura.md:864` | sí |
| `T8` como consumidor del primer pago | «`T2`, `T5` **y `T8`** esperan» — `D/12-contrato-de-cobertura.md:845` | sí |
| pérdida del aviso de `T8` | «si la persona estaba en `PRE_TRIAL`, `T8` tampoco dispara» — `V/docs/03-maquinas-de-estado.md:194` | declarado |
| `PB1` como consumidor de `cubierto` | «que publica sólo con `cubierto` verdadero o si dispara `T1`» — `D/12-contrato-de-cobertura.md:119` | sí |
| `A2`/`A4`/`A5`/`A6` | «otorgar y revocar un grant (`NUCLEO/08` §3); `A2`, `A4`, `A5`» — `D/12-contrato-de-cobertura.md:870` | sí |

**Veredicto del racimo: cubierto.**

### 2.4 Los sueltos de `A2`

- `F-8V1A2-003` → **DECLARADO**: el ⚠️ de `T7` nombra la población y su causa (`G2-4` = 1).
- `F-8V1A2-004` → **DEJA**: el spec dice ahora lo mismo que la tabla; el paso 3 (*«con el spec,
  `T8` escribe la fila consumida»* a quien nunca publicó) ya no tiene de dónde salir.
- `F-8V1A2-005` → **SIGUE, en el paso 4.** Los pasos 2 y 3 se cortan: la baja se tachó y la lista
  crece declarada; la unicidad de `PENDIENTE` y la espera están en la guarda de `PP1`. Pero el paso
  4 —*«el panel no tiene de dónde leer que ya no está sin reclamar»*— sigue llegando: el panel lee
  *«`APROBADA` sin ese vínculo»*, y el vínculo no está en ningún modelo de datos. La línea vigente lo
  delega a `V/02`, y `rg -i "vincul|reclam|partner"` sobre `V/docs/02-modelo-de-datos.md` y
  `D/nucleo/02-modelo-de-datos.md` no encuentra ninguna columna ni tabla que lo guarde. El
  implementador del panel sigue sin saber qué leer. BAJA en su efecto (es una lista del admin).
- `F-8V1A2-006` → **DEJA**: `T3` no arranca la recuperación sin altas y cada envío relee.
- `F-8V1A2-008` → **DEJA**: `PB2` relee dentro del lock en las dos ramas, y el reconciliador corre
  la transición que relee. Con el camino original (03:00:00 lee falso, 03:00:01 `S2`, 03:00:02
  `PB2`), la relectura de las 03:00:02 ve `cubierto` verdadero y `PB2` no ocurre.
- `F-8V1A2-009` → **DEJA**: el choque con el `UNIQUE` pasa a ser la guarda leída tarde, y `PB1`
  sigue con esa lectura.

| cita | dónde |
|---|---|
| «Reclamar no es una transición de esta máquina» | `V/docs/03-maquinas-de-estado.md:1206` |
| «ni una `RECHAZADA` del mismo correo dentro de la espera configurable» | `V/docs/03-maquinas-de-estado.md:1196` |
| «y no se da de baja: es inofensiva y ninguna fila la saca» | `V/docs/18-partner.md:259` |
| «arranca la campaña de recuperación **si la vertical admite altas**» | `V/docs/03-maquinas-de-estado.md:53` |
| «que relee su condición dentro del lock» | `V/docs/03-maquinas-de-estado.md:1053` |
| «resuelve la carrera entre dos escrituras de la fila» | `V/docs/03-maquinas-de-estado.md:320` |

---

## 3. Hallazgos nuevos (casos vecinos)

### N-G2V-01 · ALTA · el empuje de `PURGED` no tiene la regla «después del commit» que tiene el aviso, y `A6` relee

**Qué es vecino de qué.** `F-8V1C1-003` le puso al aviso de cobertura la regla de salir después
del commit, porque un aviso anterior despierta a un consumidor que relee, ve el estado viejo y no
hace nada. El empuje nuevo del §3.1 es el gemelo exacto —un evento cuyo consumidor relee antes de
actuar— y no la tiene: dice *«en el mismo acto»*, en el contrato y en las dos filas de `V/03`.

**El camino de Juan.**

1. Juan tiene Premium en Alojamiento y un destaque mensual sobre «Cabañas del Río»; su cobro es el
   día 30.
2. El día 29 borra la ficha (`PB12`). V6 emite el empuje *«en el mismo acto»*, dentro de la
   transacción de `PB12`, antes del commit.
3. `B10` lo recibe, busca la instancia viva y corre `A6`, que **relee `fichaPurgada`**: la
   transacción de `PB12` todavía no commiteó, así que la ficha sigue en `DRAFT` y la respuesta es
   `no`. `A6` no corre, y el empuje ya se consumió.
4. El barrido de billing del día siguiente lee `fichaPurgada: sí` y corre `A6`, pero el cobro del
   día 30 ya entró. `S21` lo pone delante de una persona con el motivo 14.
5. Con esa lectura pasa en **todo** borrado, no sólo cuando se pierde el empuje: el camino
   principal queda exactamente en la opción 1 de `G2-1`, la que el owner rechazó porque *«no
   acepta ni un cobro de más»*.

| cita | dónde |
|---|---|
| «**El aviso sale después del commit** de lo que cambió la respuesta, igual que la invalidación» | `D/12-contrato-de-cobertura.md:880` |
| «Lo emite verticales **en el mismo acto** de `PB9` y de `PB12`» | `D/12-contrato-de-cobertura.md:933` |
| «porque la ficha está en `PURGED`, y lo relee con la consulta `fichaPurgada` del §4.1 antes de» | `D/12-contrato-de-cobertura.md:942` |

`rg -n "después del commit"` sobre `V/`, `B/`, el contrato y el núcleo: una sola aparición, la del
aviso. **Severidad ALTA y no CRITICA**: es una lectura del texto, no la única; y el cobro de más
tiene detector (la marca del motivo 14). **Qué haría falta**: la misma frase en el §3.1 —el empuje
sale después del commit de `PB9`/`PB12`— y en las dos filas de `V/03` §9.

### N-G2V-02 · MEDIA · el destaque sobre una ficha que nunca se publicó cobra sin servicio y sin aviso, y la NO cierra de `G2-3` dice lo contrario para `PB5`

**Qué es vecino de qué.** `G2-3` resolvió los estados *«sin servicio con la principal viva»* a los
que se llega **desde** una ficha publicada: moderada, excedente, despublicada. La garantía que la
hace aceptable es que *«el acto que lo causa lo dice y ofrece la baja»*. El gemelo es la ficha que
**nunca estuvo publicada**: `A1` acepta como objetivo cualquier estado salvo `PURGED` y `MODERATED`,
así que un `DRAFT` (recién creado, reactivado por `PB8` o devuelto por `PB11`) es un objetivo válido,
y `PB5` lo archiva sin que ningún aviso nombre los destaques.

**El camino de Juan.**

1. Juan crea «Cabañas del Río» en borrador y, antes de terminar de cargarla, compra un destaque
   mensual para ella: `A1` pasa, porque la ficha no está `PURGED` ni `MODERATED`.
2. No la publica nunca. El destaque cobra cada mes sobre una ficha que no se ve. No hubo ningún
   acto que causara el *«sin servicio»*, así que no hubo ningún aviso.
3. A los `N` meses `PB5` archiva el borrador. El aviso de retención *«al archivar»* no dice nada
   de destaques: la fila de destaques de `V/19` §4 es la del archivado de `PB4`, y tampoco lo dice.
4. El destaque sigue cobrando sobre una ficha `ARCHIVED`, sin tope, y la NO cierra afirma que el
   acto se lo dijo.

| cita | dónde |
|---|---|
| «en un estado que acepte destacarla —ni `PURGED` ni `MODERATED`—» | `B/docs/03-maquinas-de-estado.md:2522` |
| «—`MODERATED`, bajada por excedente, `DRAFT` por `PB6`, `ARCHIVED` por `PB5`— (FASE 9 vuelta 1;» | `B/docs/16-addons.md:991` |
| «El acto que lo causa lo dice y ofrece la baja» | `B/docs/16-addons.md:992` |
| «el aviso de **ficha archivada** (`PB4`, día 90)» | `V/docs/19-superficies.md:65` |

**Severidad MEDIA**: débito sin servicio y sin tope, pero la compra y el borrador son actos del
propio dueño. **Qué haría falta**: o que `A1` exija que la ficha objetivo esté `PUBLISHED` (o
avise al comprar sobre un borrador), o que el aviso del archivado de `PB5` nombre los destaques y
la NO cierra deje de afirmarlo para `PB5` sin él. Lo primero es del owner si cambia `A1`.

### N-G2V-03 · BAJA · el inventario de «fila viva» dice «uno de los dos» y hay al menos tres consumidores de sólo instancia, dos de ellos entrados con `G2-1`

**Qué es vecino de qué.** `F-8V1D1-009` era que el inventario no conocía a `A6`. El arreglo lo
agregó y cambió *«único»* por *«uno de los dos»*. El mismo acto de `G2-1` metió dos selectores
nuevos de la instancia viva que el inventario no lista: la búsqueda del consumidor del empuje y la
mitad `fichaPurgada` del barrido. Y la cuarta comprobación de `B/09` §3 enumera los dos estados de
la instancia y tampoco figura.

**El camino de Juan.** Juan (implementador) agrega un estado vivo a la instancia de addon, recorre
el inventario —*«el control, no un registro»*— y actualiza el 18 y el 23. La búsqueda del empuje
dice *«instancias vivas»* sin enumerar, y su implementación quedó con la lista vieja: una instancia
en el estado nuevo no se encuentra al llegar el empuje, y espera al barrido (un día de atraso, el
cobro que el empuje venía a evitar).

| cita | dónde |
|---|---|
| «es **uno de los dos consumidores cuyo sujeto es SÓLO una instancia de addon**» | `D/nucleo/01-glosario.md:571` |
| «busca las instancias vivas de scope `LISTING` con ese `objetivo` y corre `A6`» | `D/12-contrato-de-cobertura.md:936` |
| «puede cobrar —`PENDING_AUTHORIZATION` o `ACTIVE`» | `B/docs/09-conciliacion.md:465` |

**Qué haría falta**: filas en el inventario para la cuarta comprobación de `B/09` §3 y para las dos
búsquedas de `G2-1`, y el *«uno de los dos»* reescrito sin número. La búsqueda del §3.1 debería
decir *«en uno de sus dos estados vivos»*, como `S20`.

---

## 4. Texto vencido y contradicciones (BAJA)

1. **El hard delete del admin figura como camino vivo en tres NO cierra, y `G5-2` lo cerró.** El
   núcleo dice que ningún borrado sale de otra fila que `PB9` o `PB12`; el contrato §3.1, el ⚠️
   punto 8 de `V/03` §9 y la NO cierra de `B/16` siguen nombrando *«el hard delete del admin,
   `F-8V1A1-003`»* como el borrado que no empuja. El camino que sí queda sin empuje —el borrado de
   la cuenta, pendiente en `N/08` §1— no está nombrado en ninguno.

   | cita | dónde |
   |---|---|
   | «sin pasar por `PB9` ni por `PB12` (el hard delete del admin, `F-8V1A1-003`)» | `B/docs/16-addons.md:981` |
   | «ningún borrado de ficha sale de otra fila que `PB9` o `PB12`» | `D/nucleo/08-auditoria-y-observabilidad.md:188` |

2. **La fila `cubierto` del contrato sigue diciendo *«el hard delete del día 180»***, que desde la
   FASE 8 completa es la fila `PB9`; está en la misma celda donde se agregó `PB1`.

   | cita | dónde |
   |---|---|
   | «`PB4`, `PB5` y el hard delete del día 180**, que lo releen» | `D/12-contrato-de-cobertura.md:119` |

3. **`S33` y la vuelta de `S7` a `CANCEL_SCHEDULED`.** `S7` puede llevar la principal a
   `CANCEL_SCHEDULED` (un cobro que entró sobre un preapproval ya cancelado); el evento de `S33`
   exige la principal `ACTIVE` y nombra *«vuelve de `SUSPENDED` por `S7`»* sin decir hacia dónde.
   Leído estricto, el complemento queda pausado mientras la principal da servicio hasta el fin del
   período, y después `S12` lo deja huérfano. Falla hacia no cobrar; lo cubre en espíritu la NO
   cierra *«no se reanuda al volver de una suspensión»*.

   | cita | dónde |
   |---|---|
   | «o `CANCEL_SCHEDULED`** si el cobro entró sobre un preapproval que `S6` ya canceló» | `B/docs/03-maquinas-de-estado.md:153` |

4. **El aviso de moderar tiene fila en `V/19` §4 y no tiene correo en el catálogo del núcleo.** El
   dueño no está presente cuando un admin modera, y el catálogo de `N/07` §6 no tiene ninguna fila
   de moderación (`rg -i moder` sobre el capítulo: cero). `V/03` §9 da el NO cierra 3 por
   *«cerrado en parte»* con esa fila, y `G2-3` se apoya en que el acto se lo dice.

   | cita | dónde |
   |---|---|
   | «**el de moderar tiene fila** en `V/19` §4 y nombra los destaques» | `V/docs/03-maquinas-de-estado.md:746` |

---

## Key Learnings

1. Un mecanismo nuevo que copia la forma de otro (el empuje de `PURGED` copia al aviso: evento sin
   transporte, consumidor que relee) hereda sus riesgos pero no sus reglas: la regla «después del
   commit» del aviso no viajó al empuje, y con la relectura del consumidor un evento temprano no
   es un evento perdido de vez en cuando, es un evento perdido siempre.
2. Un NO cierra que declara «el acto lo dice» es una afirmación verificable sobre otro capítulo: hay
   que buscar el aviso de cada acto de la lista (acá, `PB5` no tiene).
3. Un residuo declarado puede quedar vencido por la decisión de otro grupo (`G5-2` cerró el hard
   delete del admin) y seguir nombrado como el camino sin red, mientras el camino que sí queda
   (borrado de la cuenta) no aparece.
4. Arreglar un inventario cambiando «único» por «uno de los dos» vuelve a congelar un conteo; en el
   mismo acto entraron consumidores nuevos que lo desmienten. Los inventarios de control no deberían
   llevar números en la prosa.
5. Un «lo declara `V/02`» sin texto en `V/02` es una promesa, no un cierre: el paso del camino que
   dependía de ese dato sigue llegando.
