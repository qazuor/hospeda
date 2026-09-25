---
title: "FASE 9 completa · R5 y R7 — el correo que bloquea y la conciliación"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R5 y R7 — el correo que bloquea la cancelación, y la conciliación

`DEC-METH-004` (`01-decision-log.md:144`) cierra un racimo cuando **el camino de cada hallazgo,
reejecutado sobre el texto corregido, ya no llega**, y además **la regla corregida se verifica
contra todo el dominio que cuantifica**. Este documento hace las dos cosas para `R5` y `R7` de la
FASE 8 completa ([`25-fase-8-completa/00-hallazgos.md`](../25-fase-8-completa/00-hallazgos.md) §2 y
§5), sobre el texto de los capítulos **tal como está hoy**.

**No edita nada.** Todo lo que falta se propone con texto exacto y lugar; lo aplica el orquestador.

Abreviaturas: `B` es `HOS-1354-billing-cobro-y-proveedor/docs/`, `NUCLEO` es
`HOS-1352-…/docs/nucleo/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`. Cada conteo de este
documento salió de un script (se nombra cuál) y no de contar a mano.

## Resumen

| racimo | hallazgos | DEJA DE LLEGAR | SIGUE LLEGANDO | LLEGA A OTRA COSA | dominio | casos que fallan |
|---|---|---|---|---|---|---|
| R5 | 2 | 2 | 0 | 0 | 72 | 6 |
| R7 | 13 | 11 | 1 | 1 | 69 | 15 |
| | **15** | **13** | **1** | **1** | **141** | **21** |

**Al owner van dos cosas** (§R5.5.1 y §R7.5.1); **de borde, cinco sin declarar** (uno en R5, cuatro
en R7); y **once contradicciones de texto** (seis en R5, cinco en R7), todas con corrección propuesta.

---

## R5 · El correo bloquea la cancelación de la predecesora

### R5.1 La regla corregida, citada

`B/03-maquinas-de-estado.md:239-240`:

> **Antes de toda cancelación que ejecutamos en el proveedor, nuestro correo tiene que salir**
> (`DEC-MAIL-001` punto 1, precisado el 2026-09-25; FASE 8 completa, `F-8CB2-001`, `F-8CD1-006`).

Con dos ramas. La transitoria, `B/03:242-257`: *«si falla de forma transitoria, la cancelación no
se ejecuta en esta corrida y se reintenta — y quién reintenta depende de la fila»*: el barrido
para las trece de la salvedad 4 y para `A5`/`A6`, **«hasta 3 días después de la transición que
decidió la cancelación»**, y después la marca `CANCELACIÓN_SIN_CONFIRMAR`; la propia transición en
`S6` y `S17`; el barrido también sobre la `CANCEL_SCHEDULED` de `S11` y `S26`. La de sin
destinatario, `B/03:258-262`:

> **si no hay destinatario** —rebote duro o cuenta borrada, que `NUCLEO/07` §4.2 suprime para
> siempre, incluso lo transaccional—, **el correo no bloquea**: se cancela igual, y el
> no-entregable se registra y se escala a una persona

La población, `B/03:266-269`: *«las filas que cancelan en el proveedor: `S3`, `S6`, `S11`, `S13`,
`S16`, `S17`, `S20`, `S22`, `S23`, `S24`, `S25`, `S26`, `S27`, `S28` y `S31` […] —quince,
recontadas sobre esta lista—, y `A5` y `A6` del §8»*. Las mismas dos reglas en el log
(`01-decision-log.md:1519-1526`, `DEC-MAIL-001` 📌; `:1451-1460`, `DEC-CONC-002` 📌), en el núcleo
(`NUCLEO/04-invariantes.md:105`, `NUCLEO/07-outbox-y-notificaciones.md:188-196` y `:225`) y en
`B/09-conciliacion.md:75-86` y `:159-198`.

### R5.2 El dominio

La regla cuantifica sobre **toda cancelación que ejecutamos en el proveedor** y sobre **todo
desenlace del correo que la precede**.

**Eje A — los sitios que cancelan en el proveedor: 18.** Los quince de `B/03:266-269` más `A5` y
`A6` (`B/03:2368-2369`) son los que el texto enumera. **El decimoctavo es `A3`**, que el texto no
enumera pero `B/09-conciliacion.md:243-246` cuenta entre los que cancelan: *«lo cancelamos
nosotros cuando `A3`, `A5` […] o `A6` la llevan a un estado terminal»*. La lápida del corte
(`B/21-migracion.md:153-196`) no es una transición: entra en el reintento por la salvedad 4 y se
trata aparte, en la contradicción C-R5-3.

Recuento con `rows.py` (script sobre la tabla de `B/03` §3.2 y §8): las 15 filas `S` y `A5`/`A6`
llevan la frase *«antes de cancelar»*; ninguna otra fila de las 48 de las máquinas de suscripción,
pago, pago manual e instancia la lleva.

**Eje B — los desenlaces del correo: 4.** El texto nombra dos ramas (transitoria y sin
destinatario). El outbox tiene un tercero que ninguna de las dos alcanza: el `failed` definitivo de
`NUCLEO/07:48-52` —*«Si un correo transaccional no suprimible (§4) agota sus reintentos, eso es un
evento que mira una persona»*—. Y el cuarto es el feliz: sale.

| # | desenlace | fuente |
|---|---|---|
| M1 | sale | — |
| M2 | falla de forma transitoria | `B/03:242` |
| M3 | no hay destinatario (rebote duro, cuenta borrada) | `B/03:258`, `NUCLEO/07:146-147` |
| M4 | **agota sus reintentos** (`failed` definitivo) sin ser una supresión | `NUCLEO/07:48-52`, estados del §44 en `NUCLEO/07:30-31` |

**El eje del pagador colapsa**: sobre un pagador manual no hay llamada y la regla no corre
(`B/03:284-288`, precisión 1). No multiplica casos.

**Tamaño: 18 × 4 = 72.** Casos probados fallando por la FASE 8 completa: 4 (`S17`×M3 y `S6`×M3 de
`F-8CB2-001`; `S11`×M2 de `F-8CD1-006`; `S6`×M2, segundo camino de `F-8CB2-001`). Sin mirar: 68.

### R5.3 Los caminos reejecutados

#### F-8CB2-001 — el rebote duro bloquea para siempre la predecesora, y cobran las dos

1. *Un correo a Juan rebotó en duro.* Sin cambio: `NUCLEO/07:146` sigue suprimiendo *«todo,
   incluso lo transaccional»*.
2. *Juan pasa a anual y autoriza.* Sin cambio.
3. *Llega el webhook; el correo tiene que salir antes de `S17`.* Ahora está en la fila:
   `B/03:144`, *«Y antes de la llamada sale nuestro correo (`DEC-MAIL-001` […])»*.
4. *El correo nunca sale y la cancelación se reintenta indefinidamente.* **Corta acá.**
   `B/03:144`: *«si no hay destinatario, se cancela igual y el no-entregable se escala: es el caso
   por el que se precisó la regla, porque sin eso la predecesora no se cancelaba nunca y cobraban
   las dos»*.
5. y 6. No se alcanzan.

**Segundo camino** (el moroso con rebote duro, `S6`): `B/03:133`, efectos de `S6`: *«si no hay
destinatario, se cancela igual y el no-entregable se escala»*. **Corta.**

**El problema de modelo que el hallazgo también nombraba** —*«Si `S17` encola el correo, ya
escribió `CANCELLED` antes de saber si sale»*— **no se resolvió**: es la contradicción C-R5-1.

**Veredicto: DEJA DE LLEGAR.** Pero el mismo camino con el paso 1 cambiado por M4 —el correo
agota sus reintentos sin rebote duro— **llega igual al doble cobro**, y es el pendiente al owner
§R5.5.1.

#### F-8CD1-006 — la excepción al invariante 25 no está en ninguna transición

1. *Juan pide la baja (`S11`).* Sin cambio.
2. *Falla el envío.* Sin cambio.
3. *Un implementador bloquea, otro cancela igual.* **Corta.** `B/03:138`, `S11`: *«Antes de la
   llamada sale nuestro correo […]: si falla de forma transitoria, la cancelación no se ejecuta en
   esta corrida y se reintenta; si no hay destinatario, se cancela igual»*. Las dos lecturas
   coinciden ahora, y el alcance está escrito: *«El bloqueo vale para toda cancelación que
   ejecutamos en el proveedor, y cada fila de `B/03` que cancela lo lleva escrito»*
   (`NUCLEO/07:194-196`).
4. La pregunta al owner del hallazgo —si `S6` espera al correo— está contestada por el 📌 de
   `DEC-MAIL-001` (`01-decision-log.md:1524-1526`): el bloqueo *«vale para toda cancelación que
   ejecutamos en el proveedor»*, y `S6` lo lleva (`B/03:133`).

**Veredicto: DEJA DE LLEGAR**, salvo que `A3` quedó afuera de la lista (C-R5-2).

### R5.4 El dominio recorrido

Los 18 sitios se agrupan por **quién reintenta**, porque eso decide el resultado de M2 y M4. El
reparto se recontó con script: 11 del barrido + 2 de su propia transición + 2 `CANCEL_SCHEDULED` =
15, y cubre exactamente la lista de `B/03:266-269`.

| grupo | sitios | M1 | M2 transitoria | M3 sin destinatario | M4 agota reintentos |
|---|---|---|---|---|---|
| G1 · terminal, reintenta el barrido 3 días (`B/03:244-251`, `B/09:157`, `:159-184`) | `S3` `S13` `S16` `S20` `S22` `S23` `S24` `S25` `S27` `S28` `S31` (11) | ok | ok: reintenta hasta 3 días, después motivo 16 | ok | **acotado**: la llamada *«espera a esa misma fila»* (`B/03:297-298`) y nunca sale, pero a los 3 días abre la marca 16 y va a persona |
| G2 · `CANCEL_SCHEDULED`, reintenta el barrido (`B/03:253-257`, `B/09:185-190`) | `S11` `S26` (2) | ok | ok | ok | acotado, igual que G1 |
| G3 · no llega a terminal, reintenta la propia transición (`B/03:252-253`, `:289-293`) | `S6` `S17` (2) | ok | **sin cota**: ni plazo ni marca (`B/03:133`, `:144`) | ok | **FALLA**: `S17` nunca ocurre y cobran las dos; `S6` nunca ocurre y el moroso sigue con servicio |
| G4 · complemento, salvedad 1 (`B/09:154`, `:162-164`) | `A5` `A6` (2) | ok | ok | ok | acotado, igual que G1 |
| G5 · fuera de la lista | `A3` (1) | **sin regla**: ni correo ni reintento | sin regla | sin regla | sin regla |

Recuento: 18 sitios × 4 desenlaces = **72**; **66** con resultado correcto o acotado; **6** que
fallan o no tienen regla: `S6`×M4, `S17`×M4, y `A3`×M1–M4 (4). `S6`×M2 y `S17`×M2 se
cuentan como correctos por la regla, pero sin cota de tiempo: `S17`×M2 está declarado en
`B/12-suscripcion.md:815-822` (*«si la cancelación de `S17` falla, `S17` no ocurre en esa corrida
[…] y la predecesora cobra igual. En los dos casos ese cobro no tiene detector»*); `S6`×M2 no está
declarado (§R5.5.2, borde 1).

### R5.5 Residuos

#### R5.5.1 AL OWNER — un correo que agota sus reintentos traba `S17` y `S6` para siempre

**El ejemplo.** Juan pasa de mensual a anual un viernes. Esa noche el proveedor de correo tiene
una caída larga, o rechaza la dirección de Juan con un error que no es rebote duro (`casilla
llena` repetido), y la fila de outbox del *«antes de cancelar»* agota sus reintentos y queda
`failed` (`NUCLEO/07:48-52`). La precisión 3 de `B/03:294-298` dice que un reintento *«mira la que
ya existe. Si está `sent`, la llamada sale sin otro correo; si todavía no salió, es la rama
transitoria de arriba y la llamada espera a esa misma fila»*. Esa fila **no va a salir nunca**:
`S17` no ocurre en ninguna corrida, la predecesora sigue `ACTIVE`, y cuando llega la fecha de la
sucesora **cobran las dos**. En `S6`, un moroso en la misma situación **se queda en
`GRACE_PERIOD` con servicio entero sin límite**. El único aviso es el §1.3 del outbox, que le
dice a una persona *«no salió un correo»*, no *«hay dos cobrando»*. En G1, G2 y G4 el mismo caso
se acota en 3 días por la marca 16; en G3 no hay plazo.

**Opciones:**

1. **Tratar M4 como M3**: un correo obligatorio que agotó sus reintentos no bloquea; se cancela
   igual y se escala como no-entregable. Costo: una línea en `B/03:258` y en `NUCLEO/07:225`.
   Riesgo: en una caída larga del proveedor de correo, algunas cancelaciones salen con sólo el
   correo del proveedor, que insinúa mora (`EX-3`).
2. **Darle a G3 el plazo de G1**: si a los 3 días de la autorización de la sucesora (`S17`) o del
   vencimiento del grace (`S6`) el correo no salió, se cancela igual y se escala. Costo: dos
   frases, y el instante ya está auditado (`NUCLEO/08` §1.1). Riesgo: tres días de doble
   autorización viva en `S17`, que puede caer sobre un lote de cobro.
3. **Reencolar el correo en cada corrida** (una ocurrencia por corrida). Costo: rompe la
   precisión 3 (*«sale UNA vez por cancelación»*) y vuelve a mandar hasta N *«antes de
   cancelar»*. No acota nada si la falla persiste.

**Recomendación: 1.** Es la misma razón que el owner ya dio para M3 —*«El reintento supone una
falla que pasa»* (`01-decision-log.md:1520`)—: un `failed` definitivo es, por definición del
outbox, una falla que no pasó. Y mantiene las tres ramas con la misma forma en los 18 sitios.

#### R5.5.2 DE BORDE

1. **`S6`×M2 sin cota**: una falla transitoria que dura (caída del correo de horas) deja al
   moroso con servicio mientras dure. Grepeé el «NO cierra» de `B/03` (`B/03:2641-2765`) con
   `rg -n "S6.{0,80}(correo|transitori)"`: **no está declarado**. `S17`×M2 sí lo está
   (`B/12:815-822`). Si el owner elige la opción 1 de §R5.5.1, este borde queda con la misma cota
   que la caída del proveedor de correo; si elige la 2, desaparece. **Texto propuesto** para
   `B/03`, *«Lo que esta mitad NO cierra»*:

   > - **`S6` y `S17` no tienen plazo en la rama transitoria del correo** (FASE 9 completa,
   >   declarado por `DEC-METH-015`). Reintentan su propia transición en cada corrida y, mientras
   >   el correo no sale, el moroso conserva el servicio (`S6`) o la predecesora sigue cobrando
   >   (`S17`, ya dicho en `B/12` §5.4). **Causa**: el plazo de 3 días se escribió para las filas
   >   que el barrido reintenta (`B/09` §3), y estas dos no son de ese grupo. Es de borde mientras
   >   la falla sea transitoria de verdad; la que no pasa es la del §R5.5.1.

#### R5.5.3 CONTRADICCIONES DE TEXTO

**C-R5-1 · El correo de `S6` y `S17` no tiene transacción que lo encole.**
`NUCLEO/07:35-36`: *«La transición escribe su estado **y** la fila de outbox en la misma
transacción»*; y la ocurrencia de un correo de evento es *«el id del evento de dominio que lo
causó»* (`NUCLEO/07:73`). `B/03:294-296` (precisión 3) fija esa ocurrencia en *«la transición que
decidió la cancelación»*. En `S6` y `S17` esa transición **no ocurre** hasta que la cancelación
sale (`B/03:289-293`), así que el correo que la precede no puede encolarse en su transacción ni
tomar su id. Es la mitad de `F-8CB2-001` que quedó sin tocar (*«Ningún estado de la tabla
representa "autorizada, correo pendiente, cancelación pendiente"»*). **Corrección propuesta**, en
`B/03` precisión 3, después de *«no la corrida que la reintenta»*:

> **En `S6` y `S17` esa transición todavía no ocurrió cuando el correo tiene que salir**, así que
> el correo se encola en una transacción propia, anterior, y su ocurrencia es **el hecho que la
> dispara**: la autorización de la sucesora confirmada por relectura (`S17`), o el evento de `S6`
> que corresponda —el vencimiento del reloj, el `paused` leído o el id del pago en `charged_back`—.
> La transición se escribe después de la llamada, como ya dice su fila.

**C-R5-2 · `A3` cancela según `B/09` y no lleva ni el correo ni el reintento.**
`B/09:243-246`: *«lo cancelamos nosotros cuando `A3`, `A5` […] o `A6` la llevan a un estado
terminal»*. Contra `B/03:2366` (`A3`: *«la misma ventana que `S3`»*, sin efecto de cancelación
ni correo), `B/03:266-268` (la lista de los que llevan el correo nombra `A5` y `A6`) y
`B/09:162-164` (el reintento es *«la cancelación que `A5` o `A6` mandan»*). Un preapproval de
addon `pending` que nadie cancela se puede autorizar más tarde con el enlace viejo (`EX-1`: un
`pending` no vence), que es el riesgo por el que `S3` sí cancela. **Corrección propuesta**:
agregarle a `A3` el efecto de `S3` —*«cancela el preapproval de su suscripción de complemento en
el proveedor, con la regla de relectura de `S17` y con nuestro correo antes»*— y sumar `A3` a
`B/03:266-268` (*«y `A3`, `A5` y `A6` del §8»*) y a `B/09:162-164` (*«la cancelación que `A3`,
`A5` o `A6` mandan»*). Si `A3` **no** cancela, la corrección es la inversa: sacarlo de
`B/09:244`.

**C-R5-3 · La lápida no tiene transición de la que contar los 3 días ni a la que colgar el correo.**
`B/09:162-164` pone la lápida entre las filas que el barrido reintenta, y `B/09:175-179` cuenta el
plazo desde *«la transición que decidió la cancelación»*, porque *«toda transición es auditable,
con su "cuándo"»*. Contra `B/21-migracion.md:188`: *«La lápida es la única fila `CANCELLED` de todo
el sistema que ninguna transición produce»*. El correo *«antes»* tampoco tiene ocurrencia.
**Corrección propuesta**, en `B/09` §3 punto 2, al final:

> **Sobre una lápida no hay transición**: los 3 días se cuentan desde que se escribió (`B/21`
> §2.5, paso 4 de `16-fase-7…` §4.2), y el reintento sale **sin** correo *«antes de cancelar»*: la
> comunicación del corte es la del corte, no la de una baja.

**C-R5-4 · La precisión 1 enumera siete filas donde la regla vale para todas.**
`B/03:286-288`: *«Sobre un pagador manual tampoco […], así que en `S3`, `S6`, `S23`, `S24`, `S27`,
`S28` y `S31` la condición corre sólo sobre el pagador con tarjeta»*. Un pagador manual también
puede estar en `S11`, `S13`, `S17`, `S22`, `S25` o `S26`, y ahí tampoco hay llamada. Mismo defecto,
del otro lado, en `B/09:157`: *«Y `S23`, `S24` y `S31` entran sólo cuando hubo llamada»*, cuando la
tabla de arriba da la misma salvedad a `S3` (`B/09:136`), `S27` (`:144`) y `S28` (`:145`).
**Corrección propuesta**: en `B/03:286-288`, *«así que en **toda** fila la condición corre sólo
sobre el pagador con tarjeta»*; en `B/09:157`, *«Y `S3`, `S23`, `S24`, `S27`, `S28` y `S31` entran
sólo cuando hubo llamada»*.

**C-R5-5 · Un resto de las «tres corridas» en el motivo 16.**
`B/02-modelo-de-datos.md:917`: *«Antes de la tercera no abre nada: reintenta»*. La regla es de
tiempo (`B/09:175-177`, *«El plazo se cuenta por tiempo, no por corridas»*). Es el único resto:
lo busqué en todo `B/*`, `NUCLEO/*` y el log con un script que excluye las tachaduras
(`tercera corrida|tres corridas|corridas seguidas|la tercera` sin sustantivo). **Corrección
propuesta**: *«Antes de los 3 días no abre nada: reintenta»*.

**C-R5-6 · El log y `B/05` quedaron atrás del reintento.**

- `01-decision-log.md:1452-1453`, 📌 de `DEC-CONC-002`: *«Once filas de `B/03` llegan a su estado
  terminal»*; hoy son **trece** (`B/03:245-247`, `B/09:157`, recontadas con script: 13 de las 14
  filas *«no»*). Propuesta: una nota al pie del 📌, sin tocar su texto: *«Once el día de la
  decisión; trece hoy, con `S31` y `S16` (`B/09` §3, salvedad 4)»*.
- `B/05-idempotencia-y-concurrencia.md:162-166` (`C3`): *«Y acá la repetición no es un borde: es la
  forma normal del caso. […] y ninguna transición reintenta la llamada sola»*. Desde `F-8CB1-013`
  la reintenta el barrido 3 días (`B/09:159-184`). Propuesta: reemplazar la frase por *«un hecho por
  ciclo **si la cancelación sigue sin confirmarse**: el barrido la reintenta 3 días y después abre
  `CANCELACIÓN_SIN_CONFIRMAR` (`B/09` §3); los cobros que entren igual van a la misma marca»*.

---

## R7 · La conciliación ve y no puede escribir, ni salir

### R7.1 La regla corregida, citada

R7 no tiene una frase única; es la regla de `DEC-CONC-002` puntos 1 y 4 aplicada a todo lo que el
barrido lee. Escrita como el texto la sostiene hoy:

1. **Todo lo que la conciliación ve divergente tiene un acto declarado que lo escribe, o una
   marca con un motivo del catálogo cerrado.** `B/09:71-73`: *«Toda divergencia de monto, estado o
   cobro pone la marca `requiere_conciliación` y la mira una persona»*; `B/02:923-925`: *«La
   enumeración es cerrada […] `G-R1-F` […] falla si alguna transición o comprobación del corpus
   pone la marca sin nombrar un motivo de esta tabla»*.
2. **Al proveedor se le pregunta por id; el buscador de suscripciones filtra sólo por
   `payer_email`.** `B/09:764-768`: *«Toda búsqueda por `search` en este diseño filtra sólo por
   `payer_email`»*; `NUCLEO/04-invariantes.md:133` (`D6`) y `:144` (`D17`).
3. **El barrido tiene un vigía que no comparte su ejecución.** `B/09:805-807`: *«El vigía es un
   monitor de cron EXTERNO […] el barrido le hace ping al terminar una corrida completa, y el
   monitor alerta si pasan 26 h sin ping»*.
4. **Un pago ya registrado que cambia se vuelve a leer.** `B/09:577-584` (la comprobación de pagos
   acreditados) y `DEC-SUB-020` (`01-decision-log.md:5158-5163` y su 📌).

### R7.2 El dominio

**Eje A — el catálogo de motivos: 20.** `B/02:900-921`. Recontado con `motivos.py` (parsea la
tabla): **20 filas**; `S14` abre **11** (2, 3, 5, 6, 7, 8, 12, 17, 18, 19, 20) y otros actos **9**
(1, 4, 9, 10, 11, 13, 14, 15, 16); plata: **7 SÍ** (1, 2, 3, 7, 12, 15, 20), **3 puede** (4, 13,
14), **10 no**. Las tres cifras coinciden con las que el propio § declara (`B/02:894-895`,
`:965-967`) y con `B/03:141` (*«once de los veinte»*).

**Eje B — lo que el barrido y la relectura pueden ver: 37 casos**, de `B/09` §3, §4, §6.2, §7 y
§7.1 y de `B/03` §6.

**Eje C — los usos del buscador: 3**, de `B/09:682`, `:762` y `16-fase-7-del-paraguas.md:114`.

**Eje D — los asientos que el diseño manda escribir: 9** (comprobante y reembolso).

**Tamaño: 20 + 37 + 3 + 9 = 69.** Probados fallando por la FASE 8 completa: 13 (uno por hallazgo).
Sin mirar: 56.

### R7.3 Los caminos reejecutados

#### F-8CB3-003 — un cobro aprobado que no registramos no tiene camino a la base

**Camino (a), webhook perdido.**

1. *El webhook se pierde.* Sin cambio.
2. *El barrido ve `approved` y no puede escribirlo; ningún motivo es «cobro que no tenemos».*
   **Cambió**: `B/09:111`, *«el barrido no lo escribe: se abre la marca con motivo
   `COBRO_SIN_REGISTRAR` […] y lo asienta una persona»*; motivo 19 en `B/02:920`.
3. —
4. *`S6` lee «cobró» y ningún acto inserta el pago.* **Corta**: `B/03:132`, `S5`: *«asienta ese
   cobro en el mismo acto: lo lee por id (`D17`) y corre `P1` sobre él (§6), creando la fila de
   `payment` si no existe»*.

Pero sobre una fila `ACTIVE` (no en grace) el cobro llega a la marca 19 y **lo asienta una
persona con un acto que no existe**: `NUCLEO/08-auditoria-y-observabilidad.md:142-154` no tiene
ninguna fila para *«asentar un cobro»*, y el mismo § dice (`:161-163`) *«Lo que no se puede es
ejecutar una escritura que no esté nombrada en ninguna fila»*. Y el motivo 19 dice *«asentar el
cobro: registrarlo y decidir a qué período corresponde»* (`B/02:920`) sin decir que corre `P1`, que
es quien emite el comprobante, escribe `covered_period` y convierte el trial (`B/03:1635`).
**Veredicto (a): LLEGA A OTRA COSA** — de *«no hay camino»* a *«hay camino a una persona, que no
tiene con qué asentarlo»*. Es la contradicción C-R7-1.

**Camino (b), reintento aprobado.** Paso 3: *`C6` descarta la aprobación del reintento.* **Corta**:
`B/05:225-235`, *«ante el choque se relee la fila existente: si está `PENDING` y la lectura por id
dice `approved`, corre `P1` sobre ESA fila»*; y `B/02:323`, *«que no descarta el mismo id con otro
estado»*. **DEJA DE LLEGAR.**

**Veredicto del hallazgo: LLEGA A OTRA COSA** (cuenta como tal en el resumen).

#### F-8CB3-005 — el período se lee de `next_payment_date`

1. *`next_payment_date = 01/10`, el cobro sale a las 14:02 o en un reintento.* Sin cambio.
2. *`P1` resuelve el período con la fecha del próximo cobro, que ya corrió.* **Corta**:
   `B/02:421-423`, *«el período de un cobro del proveedor se identifica por la fecha PROPIA del
   registro de cobro —el `date_created` del `authorized_payment`, leído por id (`EX-16`)—, nunca por
   la fecha del próximo cobro»*; y `B/02:426-428`, *«su `date_created` no se mueve con un
   reintento»*. `P1` lo repite (`B/03:1635`).
3. *El choque con el `UNIQUE` no tiene regla.* **Corta**: `B/02:435-441`, `COBRO_DUPLICADO`.
4. *`C2` no dice qué fecha usa.* Se resuelve por lo mismo: la fecha del hecho es la del registro.

El cruce entre la cuota manual (fecha local) y el cobro del proveedor (fecha del registro) quedó
declarado: `B/02:442-446`, *«el `UNIQUE` puede no verlo»*, con población casi vacía. **DEJA DE
LLEGAR.** Residuo de borde: §R7.5.2, borde 1.

#### F-8CB3-006 — el comprobante no tiene quién lo emita

1. *Un Partner paga por transferencia; `MP1` registra.* Sin cambio.
2. *`receipt` guarda «pago».* **Corta**: `B/02:327`, *«el cobro que certifica —un `payment` o un
   `manual_payment`—»* con CHECK de exactamente una referencia.
3. *Ninguna transición lo emite.* **Corta**: `B/02:327`, *«Lo emiten `P1`, `MP1` y `MP4` […] en la
   misma transacción que acredita»*; `B/03:1635` (`P1`), `:1708` (`MP1`), `:1711` (`MP4`). Los
   huecos: contador en fila (`B/02:342-353`), sostenido por el owner.

**DEJA DE LLEGAR.** El asiento de la marca 19 hereda C-R7-1: si no corre `P1`, no emite.

#### F-8CB3-007 — nada avisa si el barrido deja de correr

1. *Un deploy deja el cron sin registrar, o `429` a mitad de cartera.* Sin cambio.
2. *Las filas no leídas se releen en una corrida que no llega.* Sin cambio.
3. *Nadie recibe nada.* **Corta**: `B/09:792-797`, cada corrida registra *«inicio, fin, cuántas
   filas leyó y cuántas fallaron»*, *«Una corrida es completa si tiene fin y ninguna fila
   fallida»*; y `B/09:805-807`, monitor externo con ping por corrida completa y alerta a las 26 h.
   `NUCLEO/08:178` lo repite.

Lo abierto —elección concreta, plan contratado, canal— está declarado en `B/09:881-885`. **DEJA
DE LLEGAR.** Residuo de borde: §R7.5.2, borde 2.

#### F-8CB3-009 — un pago registrado que cambia no lo compara nadie

El hallazgo describía un estado (*«la fila sigue `SUCCEEDED` […] y el servicio sigue»*). Ahora:
`P6` (`B/03:1640`) lleva el pago a `CHARGED_BACK`; `S6` por su tercer evento (`B/03:133`) corta si
la fila da servicio; `S12` por su segundo (`B/03:139`) corta una `CANCEL_SCHEDULED`; `S31`
(`B/03:158`) corta a la sucesora; `P7` (`B/03:1641`) vuelve si se gana; la comprobación de pagos
acreditados relee (`B/09:577-603`); el reembolso desde el panel abre el 18 sin suspender
(`B/09:590`). **DEJA DE LLEGAR.** Residuos: §R7.5.2 bordes 3 y 4, C-R7-3.

#### F-8CB3-010 — `version` no viene en el `GET`

La fila de la tabla es hoy `B/09:112`: *«el `last_modified` del recurso | el de la última
relectura, guardado en `provider_link`»*, con la medición `RC-9` en la matriz
(`06-mp-validation-matrix.md:282`, `NOT_SUPPORTED`, producción). `provider_link` guarda las dos
(`B/02:51`), y `B/03:2529-2535` deja `version` sólo para ordenar webhooks. **DEJA DE LLEGAR.**

#### F-8CB3-011, F-8CB2-014 y F-8CB1-014 — el `search` por estado devuelve un subconjunto

Los tres hallazgos tienen el mismo camino: la recuperación tras timeout busca por `payer_email` +
`status`, `RC-1` mide que `status` devuelve 15 de 69, y además busca `authorized` cuando la
creación deja `pending`.

1. *Busca por correo y estado.* **Corta**: `B/05:58-63`, *«filtrando en el proveedor SÓLO por
   correo del pagador y el estado de NUESTRO lado»*; `B/09:762`; `D17` (`NUCLEO/04:144`).
2. *Una ausencia no prueba nada y no se dice qué hacer.* **Corta**: `B/05:64-66`, *«una búsqueda
   vacía no prueba que la suscripción no exista»*.
3. *Busca `authorized` y la creación deja `pending` (`F-8CB1-014`).* **Corta**: `B/05:69-71`, *«si
   aparece uno `pending`, se reusa en vez de crear otro»*.

**Los tres: DEJA DE LLEGAR.** Residuo: C-R7-2.

#### F-8CB1-011 — `covered_period` le asigna el período siguiente, y el choque no tiene regla

Mismo corte que `F-8CB3-005` (`B/02:421-433`) y regla de choque escrita en `B/02:435-441` y en
`P1` (`B/03:1635`): *«el pago pasa igual a `SUCCEEDED` […] no se escribe la cobertura, y `S14`
abre la marca con motivo `COBRO_DUPLICADO`»*, con default de devolver (`B/19-superficies.md:220`).
**DEJA DE LLEGAR.**

#### F-8CB1-012 — la fecha de fin de `S11` no tiene fórmula

1. *Juan pide la baja con el cobro rechazado.* Sin cambio.
2. *La fecha sale de la copia del próximo cobro, que ya corrió.* **Corta**: `B/03:138`,
   *«`fin_de_servicio = inicio(P) + un ciclo de la billing option anclada`, donde `P` es el
   `covered_period` más reciente de la fila con `liberado_en` nulo»*, y *«La copia de la fecha del
   próximo cobro no entra»*. La fila sin ningún `covered_period` quedó cerrada (*«el fin de servicio
   es en el acto, como en `S24`»*).

**DEJA DE LLEGAR.** La afirmación falsa que el hallazgo también señalaba sobrevive: C-R7-4.

#### F-8CB1-013 — la cancelación que falla no la reintenta nadie

1. *`S11`, `S22`, `S24`, `S13` llegan a su destino aunque la llamada falle.* Sin cambio: sigue
   siendo así, a propósito.
2. *Nada la reintenta; el barrido sólo relee.* **Corta**: `B/09:169-174`, *«El barrido NO abre la
   marca: vuelve a mandar la cancelación»*; y para `S11` en `CANCEL_SCHEDULED`, `B/09:185-190`.
3. *Lo que abre es una marca sin motivo de plata.* **Corta**: motivo 16, a los 3 días
   (`B/09:175-177`, `B/02:917`).

**DEJA DE LLEGAR.** El texto que el hallazgo citaba como prueba (`B/05` `C3`) sigue diciendo lo
contrario: C-R5-6.

#### F-8CB1-015 — el reembolso no tiene máquina, y el camino manual no tiene fila

1. *`refund` tiene una columna «estado» sin valores ni transiciones.* **Sigue**: `B/02:324`,
   *«`refund` | el pago que se devuelve —un `payment` o un `manual_payment`—, monto, motivo,
   estado, quién lo confirmó»*. Busqué una máquina de `refund` en `B/03` (`rg -n "refund"` sobre
   §6, `B/03:1608-1641`): **no está**; la máquina del §6 es la del **pago** (`P3`, `P4`, `P5`).
2. *La devolución de un `manual_payment` y la del cobro viejo (`DEC-RF-007`, «cae al camino
   manual») no tienen acto.* **Sigue**: `B/06-proveedor.md:239`, *«los dos desenlaces caen al mismo
   camino manual»*; `NUCLEO/08:154` tiene la fila **reembolsar**, pero sin transición que escriba la
   fila de `refund` cuando la devolución ocurre fuera del proveedor.
3. El hallazgo no aparece citado en **ningún** capítulo, log ni núcleo: `rg -l F-8CB1-015` sobre
   todo `.specs/` fuera de los informes 25 y 26 devuelve **cero archivos**. La tabla de §5 del
   consolidado (`25-fase-8-completa/00-hallazgos.md:341`) no lo nombra en la resolución de R7.

**Veredicto: SIGUE LLEGANDO.** Va al owner (§R7.5.1).

### R7.4 El dominio recorrido

#### Eje A — los 20 motivos (`motivos.py`)

Cada motivo tiene emisor (columna *«quién abre la marca»* no vacía en las 20 filas; el script mide
el largo del texto sin tachaduras: mínimo 31 caracteres) y **cada motivo aparece citado fuera de
`B/02`** en al menos un capítulo (ninguno queda sin uso). La dirección inversa —**cada emisor cita
un motivo existente**—: el script `emisores.py` encontró **72** líneas del corpus (`B/*`, `V/*`,
`NUCLEO/*`, contrato, `16-fase-7…`) que abren o ponen una marca; **32** nombran un motivo del
catálogo en la misma línea y las **40** restantes las leí una por una: son prosa sobre el predicado
(`NUCLEO/01:411`, `:663`), frases cortadas por el salto de línea cuyo motivo está en la línea
siguiente (`B/02:438-439`, `B/09:349-350`, `B/16-addons.md:694`), o encabezados de la propia tabla
(`B/02:900`). **Ningún token en mayúsculas con guion bajo en una línea que habla de «motivo» queda
fuera del catálogo**, salvo los que son de otras enumeraciones: `PROVIDER_DUNNING` (motivo de
**pausa**, `01-decision-log.md:4035`), `VENTANA_DE_AUTORIZACIÓN_VENCIDA` (motivo de **cierre de
saldo**, `B/03:158`), `UNPUBLISHED_BY_BILLING`, `PRE_TRIAL`, y `COMPLEMENTO_CON_PERÍODO_COBRADO`
en `01-decision-log.md:4409`, que es el nombre del 14 **antes** de que `DEC-RF-006` lo partiera
(registro histórico, correcto en su fecha).

| # | motivo | emisor (`B/02:902-921`) | el emisor lo nombra en su sitio | resultado |
|---|---|---|---|---|
| 1 | `REEMBOLSO_POR_CONFIRMAR` | `S18` | `B/12:609`, `NUCLEO/08:176` | ok |
| 2 | `COBRO_POSTERIOR_A_LA_BAJA` | `S14` desde `C2` | `B/05` (5 citas) | ok |
| 3 | `COBRO_POSTERIOR_AL_GRANT` | `S14` desde `C3` | `B/05:157` | ok |
| 4 | `PAGO_PENDIENTE_SIN_RAMA` | 2.ª comprobación | `B/09` | ok |
| 5 | `DIVERGENCIA_DE_MONTO` | `S14` desde monto | `B/09:109`, `B/03` (`S30`) | ok |
| 6 | `TRANSICIÓN_NO_DECLARADA` | `S14` desde estado | `B/09:108` | ok |
| 7 | `PAGO_TARDÍO_RECHAZADO` | `S14` desde `B/05` §3 | `B/05` (5 citas) | ok |
| 8 | `REANUDACIÓN_NO_APLICADA` | `S14` desde `S10` y 5.ª comprobación | `B/03`, `B/09` | ok |
| 9 | `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA` | 1.ª comprobación | `B/09` | ok |
| 10 | `FAN_OUT_DE_GRANT_INCOMPLETO` | 3.ª comprobación | `B/09` | ok |
| 11 | `ADDON_SIN_APAGAR` | 4.ª comprobación | `B/09` | ok |
| 12 | `COBRO_DURANTE_CORTESÍA` | `S14` | `B/03`, `B/14` | ok |
| 13 | `CORTESÍA_SIN_RE_EMITIR` | 6.ª comprobación | `B/09` | ok |
| 14 | `…_POR_OTRA_CAUSA` | `S21` | `B/03` (2), `B/16` | ok |
| 15 | `…_POR_REVOCACIÓN_O_DISCONTINUACIÓN` | `S21` | `B/03` (2), `B/16`, `B/10` | ok |
| 16 | `CANCELACIÓN_SIN_CONFIRMAR` | el barrido (salvedades 1 y 4) | `B/09:176`, `B/03:249` | ok, con C-R5-5 |
| 17 | `CONTRACARGO` | `S14` con `P6`, `S6`, `S12` | `B/03:133`, `:139`, `:1640`, `B/09:589` | ok |
| 18 | `REEMBOLSO_FUERA_DEL_FLUJO` | `S14` desde pagos acreditados | `B/09:590` | **emisor ok; el cierre no tiene acto** (C-R7-1) |
| 19 | `COBRO_SIN_REGISTRAR` | `S14` desde cobros del período | `B/09:111`, `B/05:232` | **emisor ok; el cierre no tiene acto** (C-R7-1) |
| 20 | `COBRO_DUPLICADO` | `S14` desde `P1` | `B/03:1635`, `B/02:439` | ok |

Resultado: **20 de 20 con emisor y emisor que cita**; **2** cuyo cierre no es ejecutable.

#### Eje B — lo que la conciliación puede ver (37)

| # | caso | acto o marca | fuente | resultado |
|---|---|---|---|---|
| B1 | estado distinto, transición declarada | la transición | `B/09:108` | ok |
| B2 | estado distinto, sin transición | motivo 6 | `B/09:108` | ok |
| B3 | cancelación nuestra sin confirmar, terminal | reintento → 16 | `B/09:108`, `:159-184` | ok |
| B4 | ídem, `CANCEL_SCHEDULED` | reintento → 16 | `B/09:185-190` | ok |
| B5 | preapproval vivo sobre fila que nunca mandamos cancelar | motivo por §10.1 | `B/09:191-195` | ok |
| B6 | monto distinto por mutación nuestra | reintento 3 días → 5 | `B/09:109` | ok |
| B7 | monto distinto, otra causa | 5 en el acto | `B/09:109` | ok |
| B8 | monto sobre `PAUSED` | no se compara | `B/09:109` | ok |
| B9 | `next_payment_date` distinta | se registra | `B/09:110` | ok |
| B10 | `approved` sin fila de `payment` | 19 | `B/09:111` | **C-R7-1** |
| B11 | `approved` con fila `PENDING` (visto por el barrido) | 19 | `B/09:111` | **C-R7-1** |
| B12 | `approved` con fila `PENDING` (visto por evento) | `P1` sobre la fila | `B/05:225-235` | ok |
| B13 | `approved` visto por la relectura de `S6` | `S5` + `P1` | `B/03:132` | ok |
| B14 | `last_modified` posterior | se relee | `B/09:112` | ok |
| B15 | §4: sin intentos | «no cobró» | `B/09:690` | ok |
| B16 | §4: intentos completos, ninguno aprobado | «no cobró» | `B/09:691` | ok |
| B17 | §4: contador mayor que el listado | «todavía no se sabe» | `B/09:692` | ok |
| B18 | §4: la lectura por id falla | «id de otra cuenta» | `B/09:693` | ok, con borde 2 |
| B19 | «todavía no se sabe» más de un día | aviso, sin marca | `B/09:744-752` | ok (declarado) |
| B20 | pago `SUCCEEDED` igual | nada | `B/09:588` | ok |
| B21 | pago `SUCCEEDED` → `charged_back`, fila `ACTIVE` | `P6` + `S6` + 17 | `B/09:589` | ok |
| B22 | ídem, `GRACE_PERIOD` | `P6` + `S6` + 17 | `B/09:589` | ok |
| B23 | ídem, `PAUSED` `COURTESY` | `P6` + `S6` + 17 | `B/09:589` | ok |
| B24 | ídem, `PAUSED` `CUSTOMER_REQUEST` | `P6` + 17 | `B/03:1640` | ok |
| B25 | ídem, `CANCEL_SCHEDULED` | `P6` + `S12` + 17 | `B/03:139` | ok |
| B26 | ídem, `SUSPENDED` | `P6` + 17 | `B/03:1640` | ok |
| B27 | ídem, terminal | `P6` + 17 | `B/03:1640` | ok |
| B28 | ídem, predecesora `ACTIVE`/`GRACE`/`COURTESY` de una sucesión en curso | `S6` + `S31` | `B/03:133`, `:158` | ok |
| B29 | ídem, predecesora `CANCEL_SCHEDULED` | `S12` + `S31` | `B/03:139` | ok |
| B30 | ídem, predecesora **`SUSPENDED`** de una sucesión en curso | sólo 17; la sucesora sigue | `B/03:1640`, `:158` | **borde 3, sin declarar** |
| B31 | ídem, pago de una **suscripción de complemento** | `S6` sobre un complemento, sin decir | `B/03:133` (el `desde` no dice clase) | **borde 4, sin declarar** |
| B32 | pago `PARTIALLY_REFUNDED` → `charged_back` | `P6` | `B/03:1640`, `B/09:589` | **C-R7-3** (la selección no lo lee) |
| B33 | pago reembolsado fuera del flujo | 18 | `B/09:590` | **C-R7-1** (cierre) |
| B34 | `CHARGED_BACK` sin resolver | nada | `B/09:599` | ok |
| B35 | `CHARGED_BACK` → `reimbursed` | `P7` + correo | `B/09:600` | ok |
| B36 | `CHARGED_BACK` → `settled` | correo | `B/09:601` | ok |
| B37 | el barrido no corre, o corre a medias | vigía externo a 26 h | `B/09:792-807` | ok, con borde 2 |

Recuento (script sobre la columna de resultado): **37** casos; **31 ok**; **6** con residuo —B10,
B11, B33 (C-R7-1), B30, B31 (bordes 3 y 4), B32 (C-R7-3)—; B18 y B37 comparten el borde 2 pero la
regla se cumple.

#### Eje C — los usos del buscador (3)

| # | uso | filtro | fuente | resultado |
|---|---|---|---|---|
| C1 | recuperación tras timeout (`/preapproval/search`) | `payer_email`, estado de nuestro lado | `B/05:58-71`, `B/09:762` | ok |
| C2 | *«¿qué intentos hubo?»* (`/authorized_payments/search`) | `preapproval_id` | `B/09:682` | **contradice** `B/09:764` (C-R7-2) |
| C3 | censo del corte, «recorrido sin filtro» | ninguno | `16-fase-7-del-paraguas.md:114`, `B/21:164-165` | **contradice** `B/09:764` (C-R7-2) |

#### Eje D — los asientos (9)

| # | asiento | quién lo escribe | fuente | resultado |
|---|---|---|---|---|
| D1 | comprobante de un cobro de suscripción | `P1` | `B/03:1635` | ok |
| D2 | comprobante del addon de única vez | `P1` | `B/03:1635`, `B/02:338-339` | ok |
| D3 | comprobante de la primera cuota manual | `MP1` (por `S29`) | `B/03:1708` | ok |
| D4 | comprobante de una cuota reabierta | `MP4` | `B/03:1711` | ok |
| D5 | comprobante de un cobro que asienta una persona (19) | — | `B/02:920` | **C-R7-1** |
| D6 | reembolso por el proveedor de un `payment` | `refund` sin máquina | `B/02:324` | **SIGUE** (§R7.5.1) |
| D7 | reembolso de un `manual_payment` | ninguno | `B/02:355-366` | **SIGUE** (§R7.5.1) |
| D8 | reembolso de un cobro más viejo que el plazo | «camino manual», sin acto | `B/06:239` | **SIGUE** (§R7.5.1) |
| D9 | reembolso hecho desde el panel (18) | la persona, sin acto | `B/02:919` | **C-R7-1** |

**Total R7 recorrido: 20 + 37 + 3 + 9 = 69 casos.** Fallan o no tienen regla (script sobre las cuatro tablas): C2, C3 (una
contradicción), A18, A19, D5, D9, B10, B11, B33 (una contradicción, C-R7-1), D6–D8 (un pendiente al owner),
B30, B31 (dos bordes), B32 (una contradicción). Agrupados por causa: **6 residuos** —1 al owner,
2 de borde, 3 contradicciones— sobre 15 casos del dominio.

### R7.5 Residuos

#### R7.5.1 AL OWNER — el reembolso sigue sin máquina, y la devolución por fuera no tiene acto

**Es `F-8CB1-015` entero, que no llegó a los capítulos.** El racimo lo contaba (`00-hallazgos.md:172-174`)
y la resolución del 25/09 no lo nombra (`:341`).

**El ejemplo.** Juan revoca dentro de los 10 días (`DEC-RF-001`). La persona confirma el
reembolso; el proveedor contesta el `2084`, que *«miente»* (`DEC-RF-001` punto 3) y hay que
reintentar con otro monto. ¿En qué estado queda la fila de `refund` entre el primer intento y el
segundo? `B/02:324` dice *«estado»* y ningún capítulo dice cuáles. Y si Juan era un Partner que pagó
por transferencia, la devolución se hace por fuera del proveedor y **ningún acto escribe su fila**:
ni `MP*` (`B/03` §7) ni la acción *reembolsar* de `NUCLEO/08:154`, que es un permiso, no una
transición. Lo mismo para el cobro viejo que *«cae al camino manual»* (`B/06:239`).

**Opciones:**

1. **Declarar la máquina mínima de `refund`** —`REQUESTED → CONFIRMED → EXECUTED | FAILED`, con
   `EXECUTED` escrito por la relectura del proveedor o, en una devolución por fuera, por la persona
   con el comprobante de la transferencia— y una fila en `B/03` que la ejecute. Costo: una tabla
   nueva en `B/03`, una fila en `NUCLEO/08` §3 (*«asentar una devolución hecha por fuera del
   proveedor»*). Riesgo: bajo; es escribir lo que ya se hace.
2. **Sólo el acto de la devolución por fuera**, sin máquina: la fila de `refund` nace ya ejecutada
   cuando una persona la asienta. Costo: menor. Riesgo: el reembolso por el proveedor sigue sin
   estados intermedios, y el reintento del `2084` no tiene dónde vivir.
3. **Declararlo de borde** (`DEC-METH-015`). Riesgo: es plata que sale, en el camino principal de
   la revocación; no cumple la condición de borde.

**Recomendación: 1**, y juntarla con C-R7-1 en la misma fila de `NUCLEO/08` §3: *«asentar un
cobro o una devolución que el proveedor —o una transferencia— ya ejecutó»*. Las tres cosas que
hoy no tienen acto (el 18, el 19 y la devolución manual) son el mismo gesto.

#### R7.5.2 DE BORDE

1. **El período del proveedor es un instante, y el `UNIQUE` sólo choca por igualdad exacta.**
   `B/02:421-422` identifica el período por el `date_created` del registro; dos registros distintos
   no comparten ese instante, así que `COBRO_DUPLICADO` desde `P1` (`B/03:1635`) tiene población
   casi vacía **entre cobros del proveedor**, no sólo entre clases (lo único declarado, en
   `B/02:442-446`). No mueve plata en el camino principal: un preapproval genera un registro por
   ciclo (`RC-5`). Grepeé `B/03` y `B/09` «NO cierra» con `rg -n "date_created|igualdad|instante"`:
   **no está**. **Texto propuesto** para `B/09`, *«Lo que este capítulo NO cierra»*:

   > - **`COBRO_DUPLICADO` desde `P1` casi no tiene población** (FASE 9 completa, declarado por
   >   `DEC-METH-015`). El período de un cobro del proveedor se identifica por el `date_created` de
   >   su registro (`B/02` §2.3), que es un instante y distinto en cada registro, así que el `UNIQUE`
   >   de `covered_period` sólo choca si dos cobros de la misma suscripción comparten registro, y
   >   eso lo resuelve antes `C6`. **Causa**: se eligió la fecha que no se mueve con un reintento, y
   >   ese mismo rasgo la vuelve única. Un doble cobro entre dos preapprovals de la misma persona
   >   sigue siendo el de la condición 3 de `B/05` §3, no éste.

2. **Una fila que falla siempre deja al barrido sin corridas completas, y el vigía alerta todos los
   días.** `B/09:794-795`: *«Una corrida es completa si tiene fin y ninguna fila fallida»*; y
   `B/09:693`: una lectura por id que falla es *«el id es de otra cuenta»*, que no se arregla sola.
   Con una sola fila así, ninguna corrida es completa, el ping no sale y la alerta de 26 h suena
   cada día: **la alarma se vuelve ruido** y tapa la caída real. Grepeé `B/09:820-885`: **no está
   declarado**. **Texto propuesto**, mismo lugar:

   > - **Una fila cuya lectura por id falla siempre vuelve incompleta toda corrida** (FASE 9
   >   completa, declarado por `DEC-METH-015`). Es el modo *«id de otra cuenta»* del §4, y con él
   >   el vigía del §7.1 alerta todos los días. **Causa**: *«completa»* se definió como cero filas
   >   fallidas sin distinguir la falla transitoria de la permanente. Hasta que se distinga, una
   >   fila así se resuelve a mano antes de que la alerta pierda sentido.

3. **Contracargo sobre una predecesora `SUSPENDED` con una sucesión en curso.** Un suspendido con
   tarjeta vuelve por sucesión (`G-R1-A`, `B/03:128`); si llega un contracargo sobre un pago viejo
   de la predecesora, `P6` sólo abre la marca (`B/03:1640`: *«una `SUSPENDED` […] sólo abren la
   marca»*) y `S31` no corre, porque su evento es *«`S6` por su tercer evento, o `S12` por su
   segundo»* (`B/03:158`). La sucesora sigue cobrando a quien disputa. Busqué en `B/03:2641-2765`
   (`rg -n "SUSPENDED.{0,120}(S31|contracargo)"`): **no está**. **Texto propuesto** para `B/03`,
   *«Lo que esta mitad NO cierra»*:

   > - **Un contracargo sobre una predecesora `SUSPENDED` no corta a su sucesora** (FASE 9
   >   completa, declarado por `DEC-METH-015`). `S31` corre sólo detrás de `S6` o `S12`, y desde
   >   `SUSPENDED` ninguno de los dos corre: la regla del 📌 de `DEC-SUB-020` —*«si la fila da
   >   servicio, se corta; si no, sólo la marca»*— se aplicó a la fila y no a su sucesión. **Causa**:
   >   la sucesión desde `SUSPENDED` (`G-R1-A`) y el corte de la sucesora (`S31`) se escribieron en
   >   pasadas distintas. La marca `CONTRACARGO` queda abierta y la persona que la sigue ve la
   >   sucesora.

4. **Contracargo sobre el pago de una suscripción de complemento.** `P6` corre `S6` *«si la
   suscripción del pago está en `ACTIVE` o `GRACE_PERIOD`»* (`B/03:1640`), y la fila de `S6`
   (`B/03:133`) no dice de qué clase es. `B/16-addons.md` no nombra `S6` ni el contracargo
   (`rg -n "S6|contracargo|charged_back"` sobre el capítulo: cero resultados). **Texto propuesto**
   para `B/16`, *«Lo que este capítulo NO cierra»*:

   > - **Qué hace un contracargo sobre el cobro de un addon periódico** (FASE 9 completa,
   >   declarado por `DEC-METH-015`). `P6` abre la marca `CONTRACARGO` sobre la suscripción de
   >   complemento, que es la dueña del pago; si además corre `S6` sobre ella —y qué le pasa a la
   >   instancia— no está escrito. **Causa**: `DEC-SUB-020` se decidió sobre la principal. El monto
   >   es el de un addon y la marca ya lo pone delante de una persona.

#### R7.5.3 CONTRADICCIONES DE TEXTO

**C-R7-1 · Los motivos 18 y 19 mandan a una persona «asentar» con un acto que el catálogo no tiene.**
`B/02:919` (18): *«asentar el `refund` que falta, con quién lo confirmó, y recién ahí corre `P3` o
`P4`»*; `B/02:920` (19): *«asentar el cobro: registrarlo y decidir a qué período corresponde»*.
Contra `NUCLEO/08:161-163`: *«Lo que no se puede es ejecutar una escritura que no esté nombrada en
ninguna fila»*, y las trece filas de `NUCLEO/08:142-154` no tienen *«asentar»*. Y el 19 no dice que
el asiento corre `P1`, que es lo que emite el comprobante, escribe `covered_period` y avisa la
cobertura (`B/03:1635`). **Corrección propuesta** (junto con §R7.5.1): una fila decimocuarta en
`NUCLEO/08` §3 —*«asentar un cobro o una devolución que ya ocurrió fuera de nuestro flujo | motivos
18 y 19 del cap. 02 §2.5 (billing), `F-8CB1-015` | **sí**»*— y en `B/02:920`, *«asentar el cobro:
crear la fila de `payment` en `PENDING` con el id del registro y correr `P1` sobre ella —que emite
el comprobante y escribe `covered_period`—»*. Recontar en el mismo acto las cinco líneas que
cuantifican sobre esa tabla (`NUCLEO/08:158-161`).

**C-R7-2 · «Toda búsqueda por `search` filtra sólo por `payer_email`» tiene dos excepciones en el
propio corpus.** `B/09:764`, contra `B/09:682` (*«el listado `GET
/authorized_payments/search?preapproval_id=` —filtra bien por ese campo (`EX-16`)—»*) y contra el
censo del corte, *«tomados del recorrido sin filtro del proveedor»* (`16-fase-7-del-paraguas.md:114`,
`B/21:164-165`). **Corrección propuesta** para `B/09:764`: *«Toda búsqueda **de suscripciones**
(`/preapproval/search`) filtra sólo por `payer_email`, **salvo el recorrido sin filtro del censo del
corte** (`16-fase-7…` §4.2), que no filtra nada. El listado de registros de cobro filtra por
`preapproval_id`, que `EX-16` mide como filtro»*.

**C-R7-3 · La comprobación de pagos acreditados selecciona `SUCCEEDED` y dice que vale sobre
`PARTIALLY_REFUNDED`.** `B/09:583-584`: *«Por cada `payment` en `SUCCEEDED` cuya fecha del hecho cae
dentro de la ventana, el barrido lo relee»*; `B/09:589`: *«Vale igual sobre un pago
`PARTIALLY_REFUNDED`»*; `B/03:1640`: `P6` sale de los dos. Con la selección como está escrita, un
pago parcialmente reembolsado no se relee nunca y su contracargo sólo se ve si llega el aviso.
**Corrección propuesta** para `B/09:583`: *«Por cada `payment` en `SUCCEEDED` **o
`PARTIALLY_REFUNDED`** cuya fecha…»*.

**C-R7-4 · `B/02` dice que nadie lee la copia del próximo cobro y, en la misma frase, que alguien la
lee.** `B/02:303`: *«Ninguna regla del diseño la lee para decidir»*, y cuatro líneas después
(`B/02:305-307`): *«`B/12` §5.4 la sigue leyendo para cortar la ventana de una sucesión»*. Es la
mitad de `F-8CB1-012` que quedó (*«La afirmación además es falsa»*). **Corrección propuesta**:
*«**Una sola regla la lee para decidir**: el corte de la ventana de una sucesión (`B/12` §5.4). El
período de `covered_period` y el fin de servicio de `S11` ya no salen de ella»*.

**C-R7-5 · `B/05` manda el reembolso y el `RF-3` a un «capítulo 13» que no existe.**
`B/05:424-430`: *«su mecánica es del capítulo 13»* y *«el capítulo 13 tiene que tratar ese caso como
no resuelto»*. Contra `B/09:825-826`: *«El capítulo 13 no existe: se repartió»*, y `DEC-RF-007`, que
decidió el caso de más de 180 días. **Corrección propuesta**: reemplazar las dos viñetas por *«El
reembolso de un duplicado lo confirma una persona (`DEC-CONC-001`) y su asiento es el de `B/02` §2.3;
el de un cobro más viejo que el plazo del proveedor no se implementa (`DEC-RF-007`)»*.

---

## Lo que este documento no pudo verificar

- **Que el vigía externo exista en el plan contratado**: declarado por el propio `B/09:809-811`; no
  es texto que se pueda verificar.
- **El comportamiento del proveedor en un contracargo** (`RC-8`, `UNKNOWN`): todo el Eje B de
  B21 a B36 verifica **qué hacemos al leer**, no qué lee el proveedor.
- **Los scripts** (`rows.py`, `motivos.py`, `emisores.py`, `counts.py`) quedaron en el scratchpad de
  la sesión, no en el repo.
