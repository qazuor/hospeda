---
title: "FASE 8 vuelta 2 · D1 — coherencia del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · D1 — coherencia del conjunto

Ataqué el diseño entero buscando que dos lugares digan cosas distintas sobre lo mismo: núcleo contra
épicas, épica contra contrato y los dos contra el log y la matriz. Recontré con script cada conteo
congelado que pesa (las quince acciones de `NUCLEO/08` §3, los veintidós motivos de `B/02` §2.5 y
sus dos columnas, los 31 guards y su reparto 18 + 13 y 20 + 15, los 54 invariantes y sus apoyos,
las 99 filas de la matriz, las 36 transiciones de la Suscripción y su unidad, las diez del conjunto
de declaración, los estados de cada máquina y los siete campos de la fuente), verifiqué que los 104
`DEC-` citados existan en el log, que las 2190 referencias `B/NN §x`, `V/NN §x`, `NUCLEO/NN §x`,
contrato y FASE 7 resuelvan a una sección real, que ningún id de transición o guard citado falte, y
crucé los estados de medición citados contra `contar-filas-de-la-matriz.py`. Medido sobre el HEAD
`1cccd9119d` del worktree `hospeda-spec-hos-1352-billing-redesign`.

Son **4 hallazgos**: **0 CRITICA, 1 ALTA, 1 MEDIA y 2 BAJA**. La idea más grave: `S36`, la
revocación del derecho de arrepentimiento, entró el 2026-09-26 y no llegó a la enumeración cerrada
de transiciones que disparan la orfandad del addon, que es la lista a la que `A5` remite; el addon
recurrente de quien se arrepiente sigue cobrando, que es exactamente lo que `DEC-RF-001` prohíbe.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2D1-001 — `S36` no está entre las trece transiciones que disparan la orfandad del addon

**Qué se rompe.** `A5` no enumera cuándo evaluar la orfandad: remite a la lista de `B/16` §4.3
(*«enumeradas en `B/16` §4.3 y no copiadas acá»*), y esa lista —trece, recontada con `S31`— no
tiene a `S36`, que desde la FASE 9 vuelta 1 lleva una principal de `ACTIVE`, `GRACE_PERIOD`,
`CANCEL_SCHEDULED` o `PAUSED` a `CANCELLED`. El recuento espejo de `B/03` §3.2 dice lo mismo
(trece, sin `S36`), y la tabla de reparto del motivo de `S21` cuenta *«las otras ocho»* sin ella.
`B/03` §3.2 declara que los espejos de `S36` se recontaron en `B/02`, `B/12`, `B/20` y el contrato;
`B/16` no está en esa lista y quedó sin recontar. Un implementador que cablea la re-evaluación
desde la lista —que la propia lista dice ser el instrumento para *«auditar que ninguna se
olvidó»*— no corre la orfandad al revocar; otro que lee el predicado sí. El primero deja vivo el
preapproval del addon, que `DEC-ADDON-002` implicación 6 dice que *«sigue cobrando por su
cuenta»*. La red es la cuarta comprobación del barrido, al día siguiente, y abre una marca
(`ADDON_SIN_APAGAR`) que una persona tiene que resolver corriendo `A5` a mano: entre tanto el
proveedor puede cobrar el ciclo del addon.

**El camino.**

1. Juan tiene una suscripción mensual de gastronomía en `ACTIVE` y un destaque recurrente
   (`LISTING`) con su propio preapproval.
2. Cinco días después del cobro mensual escribe a soporte: se arrepiente. Una persona registra la
   revocación y corre `S36`: cancela el preapproval de la principal, corta el servicio y crea `RF1`.
3. La principal sale de las filas vivas, pero `S36` no está en la lista de `B/16` §4.3, así que la
   implementación que la sigue no evalúa la condición del §4.2 sobre las instancias `LISTING` de
   Juan (punto 3 de ese §) ni sobre sus `USER`/`GLOBAL` (punto 4).
4. El preapproval del destaque sigue `authorized` en Mercado Pago. Si su fecha de cobro cae antes
   de que alguien resuelva la marca del barrido, Mercado Pago le cobra a Juan un addon sobre una
   ficha que ya no tiene servicio.
5. Juan, que pidió irse con la plata devuelta, ve un cargo nuevo: el final que `DEC-RF-001` nombra
   como *«el peor final posible»*.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2536`
  — "la pueden cumplir las transiciones que sacan a una principal de las filas vivas, enumeradas en `B/16` §4.3 y no copiadas acá"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:704`
  — "sucesora que un contracargo sobre su predecesora corta a `ABANDONED` o `CANCELLED` (FASE 9"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:713`
  — "nombre del estado al que llegó. La lista es para poder auditar que ninguna se olvidó;"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1349`
  — "recontadas sobre la enumeración de `B/16` §4.3: `S3`,"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1366`
  — "transiciones (con `S31`, FASE 9 completa), y la mitad de `S12` que no viene de `S26`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:182`
  — "una persona registra la revocación del derecho de arrepentimiento"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:493`
  — "fila 12 de la tabla, y sus espejos en `B/02`, `B/12`, `B/20` y el contrato están recontados (FASE 9"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:688`
  — "es su propio preapproval y sigue cobrando por su cuenta hasta que alguien lo cancele."
- `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1672`
  — "y sólo le devolvemos la plata, le vuelven a cobrar el mes siguiente — el peor final posible"

El silencio, medido: `rg -n "S36" .specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md`
devuelve una sola línea (la 915, el conteo de puertas a un estado terminal de `B/09` §3), ninguna
en §4.2–§4.4.

**Qué haría falta decidir o escribir.** Si `S36` entra a la enumeración de `B/16` §4.3 y al
recuento de `B/03` §3.2 (catorce), y **qué motivo escribe `S21`** cuando la orfandad la causó una
revocación del derecho de arrepentimiento: la tabla del reparto la dejaría en el 14, *«el cliente
actuó»*, `NO DEVOLVER`, pero la revocación de `DEC-RF-001` es *«reembolso total + cancelación»* y
el período del addon es parte del mismo contrato. Eso último no lo decido yo: es del owner.

## MEDIA

### F-8V2D1-002 — La acción *«editar el contenido de una ficha ajena»* promete un aviso que apunta a otra fila

**Qué se rompe.** La decimoquinta fila de `NUCLEO/08` §3 dice que el dueño recibe *«el aviso de
la fila 1 del cap. 19 (épica de verticales)»*. La fila 1 de `V/19` §4 es *«el botón Empezar de la
pricing de Turista»*, que no tiene nada que ver. Ninguna fila de `V/19` §4 ni del catálogo de
correos de `NUCLEO/07` §6 dice que un admin editó la ficha. El implementador de la acción (V5,
desde el núcleo) cree que hay un aviso que mandar y no encuentra cuál; el de las superficies (V8,
desde `V/19`) no tiene fila que construir. Resultado probable: nadie avisa, y el aviso era el
único rastro que el dueño veía de una escritura ajena sobre su contenido.

**El camino.**

1. Juan tiene una ficha publicada de alojamiento.
2. Un admin corre la acción 15: corrige la descripción y restaura fotos viejas de la ficha de Juan.
3. El núcleo dice que Juan recibe el aviso de la fila 1 del `V/19` §4; esa fila es el botón
   Empezar de Turista, así que no hay aviso definido y V8 no construye ninguno.
4. Juan no se entera de que su ficha cambió hasta que un huésped le pregunta por algo que él no
   escribió.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:166`
  — "escribe contenido de lo ajeno y su dueño recibe el aviso de la fila 1 del cap. 19 (épica de verticales)"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:60`
  — "el botón Empezar de la pricing de Turista | que consume el trial, que es de por vida"

El silencio, medido: `rg -n -c "ficha ajena|editó|edición"` sobre `V/19` da una sola línea (la
44, la fila *Admin* del §2, que habla de qué puede escribir el admin, no de qué se le dice al
dueño), y sobre `nucleo/07-outbox-y-notificaciones.md` da cero.

**Qué haría falta decidir o escribir.** Si la acción 15 lleva aviso al dueño; si lo lleva, qué
fila de `V/19` §4 y qué entrada de `NUCLEO/07` §6 (transaccional o no, suprimible o no); si no lo
lleva, corregir la frase del núcleo.

## BAJA

### F-8V2D1-003 — Las salidas de `PAUSED` son seis en `B/03` y siete en `B/09`

**Qué se rompe.** `S36` sale de `PAUSED` desde el owner 2026-09-26 (`X-2`) y escribe `fin_real`.
`B/09` §3 lo contó (siete salidas). `B/03` no: el recuento del §3.2 dice cinco terminales más
`S6`, y el §5 —la máquina de pausa— dice *«las cinco terminales»* y enumera quién escribe
`fin_real` sin `S36`. La fila de `S36` sí lo escribe, así que el daño exige que alguien construya
el cierre de la pausa desde el §5.

**El camino.**

1. Juan pausa su suscripción por pedido propio dentro de los diez días del cobro, y al día
   siguiente se arrepiente; una persona registra la revocación desde `PAUSED` (`S36`).
2. Quien implementó el cierre de la pausa desde el §5 no incluyó `S36` entre las que escriben
   `fin_real`, y la `subscription_pause` queda sin cierre.
3. Meses después Juan vuelve a suscribirse y pide pausar: los límites se cuentan por
   `user + vertical` y sobreviven a cancelar y volver, y la pausa sin `fin_real` se cuenta entera,
   así que el cupo le da menos meses de los que usó.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:816`
  — "`PAUSED` tiene cinco salidas terminales —`S22`, `S13`, `S17`, `S25` y el espejo del §10.1—"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:545`
  — "siete salidas de `PAUSED` no producen ese estado, y por eso la comprobación no las"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:182`
  — "desde `PAUSED` corta el servicio como `S22` y escribe `fin_real` en su `subscription_pause`"

**Qué haría falta decidir o escribir.** Recontar sobre la tabla las salidas de `PAUSED` en
`B/03` §3.2 (recuadro de `S10`) y en el §5, con `S36`.

### F-8V2D1-004 — La rama 6 de `B/12` §5.3 no nombra a `S36` y `B/03` sí

**Qué se rompe.** `B/03` §3.2 pone a `S36` desde `GRACE_PERIOD` en la rama 6 (la predecesora que
se va sola con un pago retenido por `S19`), y dice que el espejo en `B/12` está recontado. La tabla
de `B/12` §5.3 que asigna *«qué acto dispara cada rama»* sigue diciendo `S23` o `S24`. La fila de
`S18` sí nombra a `S36` en su segundo evento, así que el camino con daño exige construir el
disparo desde `B/12`.

**El camino.**

1. Juan está en `GRACE_PERIOD` con una sucesora esperando autorización, y la cuota que paga en el
   medio queda retenida por `S19`.
2. Dentro de los diez días se arrepiente; una persona corre `S36`.
3. Quien construyó la rama 6 desde la tabla de `B/12` §5.3 dispara el efecto 5 de `S18` sólo con
   `S23` o `S24`: la marca `REEMBOLSO_POR_CONFIRMAR` no se abre sobre la predecesora.
4. El pago retenido de Juan no le llega a ninguna persona hasta que el barrido lo encuentre por
   otra comprobación.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:584`
  — "y `S36` desde `GRACE_PERIOD`, en la misma rama 6"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:725`
  — "6 · la predecesora pide la baja ella misma | `S18` (efecto 5), disparado por `S23` o por `S24`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:493`
  — "fila 12 de la tabla, y sus espejos en `B/02`, `B/12`, `B/20` y el contrato están recontados (FASE 9"

**Qué haría falta decidir o escribir.** Agregar `S36` a la fila 6 de las dos tablas de `B/12` §5.3
(la de desenlaces, línea 674, y la de actos, línea 725).

## Ataques que intenté y el diseño resistió

- **Las quince acciones administrativas**: la tabla de `NUCLEO/08` §3 tiene quince filas (líneas
  152–166, contadas con `awk`), y las siete líneas que cuantifican sobre ella (`V/17` §3.2–§3.5 y
  `B/19` §6) dicen quince.
- **Los 22 motivos de la marca**: 22 filas en `B/02` §2.5; `S14` abre 12 y otros actos 10; los
  `SÍ` son 7 (1, 2, 3, 7, 12, 15, 20), y la tabla de defaults de `B/19` §6 propone devolver
  exactamente esos siete. `NUCLEO/08` §3 dice veintidós y siete.
- **Los guards**: `V/20` §2 tiene 20 filas y `B/20` §2 15; las columnas de las dos
  descomposiciones dan 18 + 13 = 31, con `G13` en `V4`. Ningún guard citado falta del catálogo.
- **Los 54 invariantes**: 37 + `D1`–`D17`; subtotales 6/14/5/7/5 y apoyos 4/11/6 = 21 sobre 17,
  recontados sobre la columna *«dónde se hace cumplir»*.
- **La matriz**: el script da 99 filas, 56/15/23/5, y `UNKNOWN` = `PA-6`, `GR-2`, `RC-8`, `RF-3`,
  `EX-42`; así lo dicen `B/spec` §5.2, `B/descomposicion` §2.7 y `B/06`. Ninguna cita vigente dice
  `UNKNOWN` de una fila cerrada (`GR-1`, `RN-3`, `WH-5`, `EX-1`).
- **Referencias**: los 104 `DEC-` citados existen entre los 126 del log (que coincide con el
  conteo del índice); las 2190 referencias con prefijo resuelven a una sección existente; no hay
  ids de transición inexistentes (`S37`, `PB13`, `T9`, `A7`, `RF6`…).
- **Transiciones**: `S1`–`S36` tienen cada una su unidad en `B/descomposicion` §2; el conjunto de
  declaración tiene diez filas vivas en la tabla; Publicación tiene seis estados y doce
  transiciones, Trial ocho.
- **El censo de emisores del aviso (contrato §3) no nombra `T6`, `T7` ni `T8`**, que sacan la
  fuente de pre-trial. No es hallazgo: `V/02` §3.2 invalida el caché con *«toda transición de la
  máquina de trial»*, y ninguna de las tres cambia `cubierto`.

## Fuera de mi vector

- **La revocación no tiene correo propio**: `S36` manda el *«antes de cancelar»* genérico, y
  `NUCLEO/07` §6 no tiene entrada que diga *«te devolvemos X, tu servicio terminó hoy»*. Es del
  vector de superficies y correos.
- **`S36` en `GRACE_PERIOD` con un pago retenido por `S19`**: `S36` crea `RF1` *«por el total del
  último pago acreditado»* y la rama 6 abre `REEMBOLSO_POR_CONFIRMAR` sobre el pago retenido; si
  son el mismo pago, hay dos caminos de reembolso sobre él. Es del vector de dinero.
- **`B/spec` §2 cuenta *«ocho»* máquinas en el cap. 03** sumando la regla de no-retroceso, que
  `NUCLEO/01` §2 dice que *«no es una máquina»*. Texto sin camino con daño; lo dejo anotado.

## Key Learnings

1. Cuando una transición nueva entra tarde (`S36`, 2026-09-26), sus espejos se recontaron donde
   la propia fila los nombraba (`B/02`, `B/12`, `B/20`, contrato), pero no en las enumeraciones
   que sólo remiten a ella desde otro lado: `B/16` §4.3, el §5 de pausa y la tabla de ramas de
   `B/12`.
2. `A5` delega la lista de disparadores a `B/16` §4.3 *«y no copiadas acá»*: una sola fuente, y
   por eso si falta ahí, falta en todos lados.
3. Los conteos congelados de mayor tráfico (acciones, motivos, guards, invariantes, matriz)
   cierran con script; el desvío aparece en enumeraciones de segundo orden, no en las marquee.
4. Las referencias a *«fila N del cap. 19»* sin prefijo `B/` o `V/` son las que escapan: el
   script de `§` no las ve y la de `NUCLEO/08` §3 apunta a una fila que existe pero habla de otra
   cosa.
