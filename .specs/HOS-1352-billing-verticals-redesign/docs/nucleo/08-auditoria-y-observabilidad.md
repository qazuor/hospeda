---
title: Master Spec 08 — Auditoría y observabilidad
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 8
cierra:
  - M-ADMIN-01
  - M-AUDIT-01
  - M-OBS-01
  - R-OBS-01
  - S-OBS-01
---

# 08 · Auditoría y observabilidad

El §49 pide registrar *«eventos de dominio completos»* y no limitarse a logs técnicos. El §50
lista los campos que todo log estructurado lleva. El §22.1 ordena qué pasa cada vez que el
sistema no puede decidir solo.

Los tres dan por resuelto **quién lo genera, qué se guarda, y qué pasa cuando eso ocurre mil
veces seguidas**.

---

## 1. Qué es un evento auditable · cierra `M-AUDIT-01`

El §49 no dice cuáles, y el §35.4 detalla los campos para **un** caso —*Free Forever*— y ninguno
más.

### 1.1 El criterio

**Es auditable todo lo que cumple al menos una de las tres:**

1. **mueve dinero** — un cobro, un reembolso, un cambio de monto, una concesión que evita un
   cobro;
2. **cambia el acceso de alguien** — cualquier transición de las máquinas del capítulo 03, un
   grant, una cortesía, un cambio de plan;
3. **lo hace un administrador sobre la cuenta de otro** — aunque no mueva dinero ni cambie
   acceso.

La tercera no es redundante: un admin **mirando** datos de un cliente no cambia nada y tiene que
quedar registrado igual.

**Y se registran además los actos del dueño sobre una ficha que no son transiciones** —crearla,
editarla, exportarla—, aunque no cumplan ninguna de las tres: son el hecho 1 del reloj de
inactividad (cap. 01 §1.2), que se lee de este registro. Sin esto el hecho 1 no tenía fuente para
editar ni exportar (owner 2026-09-25; FASE 9 completa, decisión 8e, `F-8CA3-004`).

### 1.2 Los campos mínimos

| campo | por qué |
|---|---|
| **qué pasó** | el tipo de evento, de un catálogo cerrado |
| **sobre qué** | entidad y su id |
| **quién** | actor **y tipo de actor**: la persona dueña, un administrador, un job, o el proveedor |
| **cuándo** | instante en UTC (cap. 07 §3) |
| **correlación** | §2 de este capítulo |
| **qué cambió** | los campos que cambiaron, con su valor anterior y el nuevo — **no una copia del contenido**. **En los campos de contenido de una ficha —textos, fotos, FAQ, horarios, la misma lista que el día 180 borra (`V/02` §4.1)— el evento guarda sólo el NOMBRE del campo, nunca sus valores**: el valor anterior y el nuevo quedan para los campos que no son contenido —estado, plan, monto, fechas— (owner 2026-09-25; FASE 9 completa, decisión 8e, `F-8CA3-004`) |
| **por qué** | el motivo, cuando la operación lo admite: una cortesía, una cancelación, un reembolso |

**El ~~último~~ campo *«qué cambió»* de la tabla es una decisión de modelo con consecuencia directa**, ya tomada en
el capítulo 02: si la auditoría guardara copias del contenido, el hard delete del §25 no
eliminaría nada y la promesa del §25 sería decorativa. **Y un delta de un campo de texto ES una
copia del contenido**, dos veces: *«valor anterior y nuevo»* y *«no una copia»* no se podían cumplir
juntos sobre una descripción. Cinco ediciones dejaban diez versiones del texto en un registro sin
`delete` que la retención ya no toca (§1.3), y el día 180 borraba la ficha y no el texto. Por eso
los campos de contenido guardan sólo su nombre: se pierde poder mostrar *«qué decía antes»*, que
no lo pide ningún capítulo (FASE 9 completa, 8e).

### 1.3 Es inmutable, y por eso sirve

**Append-only: sin `update` y sin `delete`, y nace sin `deleted_at`** (FASE 5, owner
2026-09-30, lote 4 E: un borrado suave es una escritura que ningún candado contra `delete` ve, y
eso vale para toda tabla de sólo agregar). Un registro que se puede editar no sirve para lo
que el PDR lo necesita: el §29 tiene que poder **demostrar** que se avisó un aumento con su
precio anterior, su precio nuevo y su fecha efectiva; y el §35.4 exige el registro del grant con
su firmante.

~~**La única escritura posterior admitida es la anonimización del día 180** (cap. 02 §4.1), que
reemplaza datos personales y **no toca el tipo, la fecha, la entidad ni la causa**. Eso conserva
el valor probatorio y cumple la retención.~~ **La retención no escribe en este registro**: desde
`DEC-DATA-005` (owner 2026-09-25) el día 180 sólo borra el contenido de una ficha, y los datos
personales **no se tocan, tampoco dentro de eventos o del outbox** — así que el aviso de aumento
que el §29 tiene que demostrar conserva su destinatario (FASE 8 completa, `F-8CA3-009`). ⚠️ Lo que
queda pendiente: el borrado de la cuenta pedido por el propio usuario, que `V/02` §4.2 regla 2
describe con *«lo personal se anonimiza con el resto»*, es un proceso que esa decisión **no
cubre**; si alcanza a este registro, y con qué escritura, ~~no lo dice ningún capítulo~~ **lo dice la vigesimocuarta del §3 para la baja manual: no lo alcanza** (revisión del owner, casos vecinos, 2026-09-29, caso H-C). **Queda fuera
de esta épica** (revisión del owner, 2026-09-28, N7, `g1`, contra la recomendación, que era una
baja mínima ahora): mientras tanto la hace **soporte ~~a mano~~ desde el panel, con una lista de pasos escrita**
(revisión del owner, casos vecinos, 2026-09-29, caso F-C), y
**se corrige la FAQ** de la web, que hoy promete *«Eliminar cuenta»* desde Mi Cuenta y el borrado en 30
días. Se implementa después de terminar HOS-1352:
[HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393).

**La lista de pasos se escribe antes del corte, y el orden es parte de ella** (revisión del owner,
casos vecinos, 2026-09-29, caso 7): desde el corte, un pedido de baja se atiende sobre el sistema
nuevo. Tres pasos, en este orden:

1. **La baja del cobro**: toda suscripción viva de la cuenta, principal o de complemento, termina
   por los caminos que ya existen, con su cancelación releída en el proveedor. **Alcanza con que ninguna pueda cobrar** (verificación corta, 2026-09-29, lote M-G): la que estaba `ACTIVE` queda en `CANCEL_SCHEDULED` por `S11`, ~~cancelada en el proveedor en el acto,~~ **con la cancelación mandada al proveedor en el acto,** y termina sola por `S12` en su fecha de fin, sobre la cuenta ya dada de baja; el paso 3 no la espera **una vez que una relectura vio su preapproval `cancelled`, y la espera mientras no, que es la ventana en que el barrido reintenta la cancelación, hasta 3 días** (FASE 9 vuelta 3, owner 2026-09-30, lote D: `puedeCobrarle` contesta sobre la cancelación confirmada por Mercado Pago, `12-contrato…` §4.1). **Y sobre una suscripción cuyo preapproval canceló el proveedor tras un cobro rechazado, el paso 3 espera hasta que pase el plazo 16, 7 días desde la primera relectura que lo vio `cancelled`**, porque el proveedor puede deshacer esa cancelación y el barrido la sigue releyendo (`EX-45`; FASE 9 vuelta 3, owner 2026-09-30, lote AE). **Y no alcanza mientras una cancelación siga sin confirmar**: con la marca `CANCELACIÓN_SIN_CONFIRMAR` abierta el preapproval todavía puede cobrar, y el paso 3 la espera (verificación corta, 2026-09-29, lote N-C). Va primero porque
   una cuenta que se borra con una autorización viva sigue cobrando, y después no queda nadie a
   quien asentarle el cobro.
2. **`PB12` por cada ficha** de la cuenta (`V/03` §9). Va antes de la cuenta porque una ficha que
   se borra sin `PB12` no apaga su destaque hasta el barrido (`A6`, `B/03` §8), y porque `PB12` es
   el que borra el contenido, las fotos y el token del calendario. **Y, si la cuenta es de un Partner, se vacía su presencia** con la acción 25 (§3): sus fotos, su logo, sus secciones y sus enlaces, en la base y en el almacenamiento externo (verificación corta, 2026-09-29, lote N-G). Era lo único del dueño que el *«todo»* del owner no alcanzaba: la baja del cobro le saca la clave de su página y la deja sin verse, pero guardada.
3. **La cuenta**, al final, cuando ya no le cuelga ni un cobro ni una ficha con contenido **ni una presencia de Partner con contenido** (verificación corta, 2026-09-29, lote N-G).

**Los tres pasos los hace soporte, a pedido del dueño y con motivo** (revisión del owner, casos vecinos, 2026-09-29, caso
F-C, contra la recomendación, que era que el dueño borrara sus fichas y soporte hiciera el 1 y el 3;
con el agregado del owner: *«que soporte pueda borrar todo»*). Soporte es una persona del equipo con
el permiso de cada acción en el panel, y cada paso es una fila del §3: **el 1 es *«cancelar una
suscripción»***, que ya existía; **el 2 es la vigesimotercera, *«borrar una ficha ajena a pedido de
su dueño»***, que corre `PB12`, **y en un Partner también la vigesimoquinta, *«vaciar la presencia de un Partner a pedido de su dueño»*** (verificación corta, 2026-09-29, lote N-G); y **el 3 es la vigesimocuarta, ~~*«borrar una cuenta a pedido de su
dueño»*~~ *«dar de baja una cuenta a pedido de su dueño»*** (el nombre, revisión del owner, casos vecinos, 2026-09-29, caso I-C), que se rechaza mientras ~~a la cuenta le cuelgue una suscripción viva~~ **`puedeCobrarle` conteste `sí` (`12-contrato…` §4.1: una suscripción que todavía puede cobrar, ~~sin `CANCEL_SCHEDULED`~~ **incluida una `CANCEL_SCHEDULED` o una terminal cuya cancelación nuestra ninguna relectura confirmó todavía** (FASE 9 vuelta 3, owner 2026-09-30, lote D), **o una terminal que canceló el proveedor tras un rechazo, dentro del plazo 16** (lote AE), o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta; verificación corta, 2026-09-29, lotes M-F, M-G y N-C)** o le cuelgue una ficha fuera de
`PURGED` **o una presencia de Partner con contenido** (verificación corta, 2026-09-29, lote N-G). ~~Qué escribe borrar la cuenta sigue siendo el ⚠️ de arriba.~~ ~~Qué escribe borrar la cuenta está en su fila del §3: la fila de la cuenta y sus sesiones se borran, lo personal se seudonimiza, y este registro y los cobros no se tocan (revisión del owner, casos vecinos, 2026-09-29, caso H-C).~~ Qué escribe dar de baja la cuenta está en su fila del §3: la fila de la cuenta no se borra, se seudonimiza (lo personal reemplazado, las sesiones cerradas y sin acceso), y este registro y los cobros no se tocan (revisión del owner, casos vecinos, 2026-09-29, caso I-C); **tampoco los datos de facturación de la cuenta, que se conservan tal cual porque la ley obliga a guardar los comprobantes** (revisión del owner, casos vecinos, 2026-09-29, caso J-C), **y viven en ellos: cada comprobante copia el nombre y el correo de quien paga al emitirse** (`B/02` §2.3; revisión del owner, casos vecinos, 2026-09-29, caso K-A).

---

## 2. El identificador de correlación · cierra `M-OBS-01`

El §50 lo pide entre los campos obligatorios. No dice **quién lo genera** ni **cómo viaja** desde
el click de una persona hasta un webhook que llega tres días después — y sin esa cadena los
campos están presentes pero no se pueden unir, que es para lo que servían.

### 2.1 Se genera en el borde, una vez por intención

**Lo genera la primera request que inicia una intención de negocio**, no cada capa. Si no viene
del cliente, se acuña ahí; si viene, se respeta.

Una intención es *«me quiero suscribir»*, no *«guardá esta fila»*. Todo lo que se desprenda de
esa intención lleva el mismo identificador.

### 2.2 Cómo viaja, incluido el salto de tres días

| tramo | cómo |
|---|---|
| request → servicio → base | en el contexto de la operación |
| → evento de dominio | es un campo del evento (§1.2) |
| → outbox | es un campo de la fila |
| → **el proveedor y de vuelta** | **no viaja hacia afuera**: se recupera |

**El salto de vuelta no lleva el identificador en el `external_reference`, y es a propósito.** Ese
campo lleva **nuestro id de suscripción**, y la correlación original se recupera del evento que
creó esa suscripción:

```text
webhook → id del proveedor → provider_link → suscripción
        → el evento de dominio que la creó → la correlación original
```

Se eligió así por dos razones medidas: el `external_reference` **es reescribible** (`EX-19`) y es
la **vía de reparación** de un vínculo roto, así que cargarlo con dos significados lo vuelve
frágil; y el buscador del proveedor **lo ignora** (`RC-1`), así que no sirve para encontrar nada
de todas formas.

**Cuando la cadena se corta** —un webhook de un preapproval que no conocemos— eso **es** la
detección de una huérfana (`DEC-CONC-002`), y arranca su propia correlación anotando que no tiene
padre.

### 2.3 Los jobs tienen dos

Un job lleva **la correlación de su corrida** y, por cada ítem que procesa, **la correlación de
la entidad**. Sin la primera no se puede leer una corrida completa; sin la segunda no se puede
seguir a un cliente a través de un job.

### 2.4 Quién lo construye: `U2` ✚

(FASE 5, owner 2026-09-30, lote 2 B.) **La correlación acuñada en el borde, su campo en el evento y
en la fila del outbox, y las dos de cada job —la de su corrida y la de cada entidad— las construye
`U2`**, la misma unidad que construye el outbox (`NUCLEO/07` §1.4), porque la correlación viaja a
su fila. Hoy el contexto de una request lleva sólo su id y ninguna corrida de job lleva uno propio.
**El reloj con que un job lee la hora no es de `U2`**: sigue siendo la interfaz que construye `B1`
(`12-contrato…` §7.1, punto 5).

---

## 3. El catálogo de acciones administrativas · cierra `M-ADMIN-01`

El §48 enumera veintiuna cosas que el admin debe poder **inspeccionar** y **ninguna que pueda
hacer** — aunque el resto del PDR se las asigna.

**Cada acción lleva tres cosas: permiso propio, registro de auditoría, y confirmación explícita
si es destructiva o mueve dinero.**

| acción | de dónde sale | ¿destructiva o mueve dinero? |
|---|---|---|
| otorgar o revocar una **cortesía temporal** — **en meses enteros y sólo sobre un plan mensual**; sobre ~~un anual~~ **uno no mensual —trimestral, semestral o anual—** no está disponible (FASE 8 completa, `F-8CB1-001`; cap. 14 (billing) §4.7; *«anual»* donde la regla dice *«no mensual»*, corregido en la FASE 9 completa, contradicción 1 de `R4` del informe `03`) **Revocar es reanudar antes del fin: corre `S10` por su tercer evento, con `fin_real`, la relectura, sin reembolso y con el aviso a la persona; lo construye `B9b`** (corte del MVP, owner 2026-10-02, BO) | §34, `DEC-GRANT-002`, `DEC-GRANT-003` impl. 6 | **sí**: revocar deja al cliente sin la cortesía que le quedaba. **Re-emitir una cortesía diferida NO es una fila de esta tabla**: lo hace `S9` como efecto, con la firma original, y va en la tabla del enrutado de más abajo — **y CERRAR su saldo tampoco**, que es el efecto opuesto y lo hace `S3` (`DEC-GRANT-011`) |
| otorgar, **anclarle una vertical nueva**, o revocar un **grant permanente** | §35, §35.4, `12-contrato…` §2.8 | **sí**, y la más grave: revocar deja al cliente **sin grant y sin suscripción**, o sea sin servicio, hasta que autorice un débito nuevo (`DEC-GRANT-001`). **Anclar también mueve dinero**: concede servicio gratuito permanente en una vertical nueva y **cancela la suscripción que el beneficiario pagaba ahí** (`S13`, `B/03` §3.2) — **y, con `includesAddons: true`, la de cada addon compatible que venía pagando** (`S20`, `B/16` §3.4) |
| registrar un **pago manual**, **también la transferencia que no cae en ninguna cuota abierta**, que `MP6` asienta como un segundo pago del mismo período y que abre `COBRO_DUPLICADO` con propuesta de devolver (`B/03` §7; FASE 9 vuelta 3, owner 2026-09-30, lote W): es esta fila y no una nueva, como `MP4` | §30 | **sí** |
| confirmar que **no se pagó** | §30 | **sí**: lleva a `SUSPENDED` sin esperar el reloj |
| aprobar o rechazar una **postulación de Partner** —**o anular la espera tras un rechazo**, para que el dueño real de un correo cargado por un tercero pueda postularse (`V/18` §2.2; owner 2026-09-27, FASE 9 vuelta 2, `R7`)—. ~~**Aprobar asigna además el rol de socio**~~ **El rol de socio no lo asigna aprobar: lo asigna el acto que fija al dueño de la presencia —el reclamo~~, o el alta directa del admin con dueño~~—**, porque al aprobar todavía no se sabe cuál es la cuenta del dueño (FASE 5, lote de la aplicación, owner 2026-09-30, F); **el alta directa de un Partner por el admin no fija dueño: manda el aviso de reclamo, y el rol llega con el reclamo** (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, N), con su familia de operaciones y sus permisos, que es por lo que pregunta el paso 3 de la cadena sobre las acciones de un Partner; **y ese rol no se quita** cuando el socio pierde su presencia, porque perder el acceso nunca revoca un rol (`V/17` §4.1) (FASE 5, owner 2026-09-30, lote 4 B, contra la recomendación, que era declarar el paso 3 vacuo para Partner) | §17.3 | no |
| configurar el **plan y el método de pago** de un Partner | §17.3 | sí |
| **levantar la marca `requiere_conciliación`** | §22.1 | según el caso — **y el caso lo dice el `motivo` de la marca**, que desde la FASE 9-bis-4 es una columna (cap. 02 (billing) §2.5). Se levanta **una marca, no la fila**: son ~~**quince**~~ ~~**dieciséis**~~ ~~**diecinueve**~~ ~~**veinte**~~ ~~**veintidós**~~ ~~**veintitrés**~~ **veinticuatro** motivos (el 23 y el 24 desde la FASE 9 vuelta 2, `R4` y `R20`; el 16 desde `F-8CB1-013`, y el 17, el 18 y el 19 desde `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`, FASE 8 completa, owner 2026-09-25; el 20 desde la pendiente 6 —el 21 y el 22 desde la FASE 9 completa (`B/02` §2.5: `COBRO_DEL_PERÍODO_SIN_RESOLVER`, decisión 3d, y `PAUSA_NO_APLICADA`, `F-8CB2-003`)—) y ~~**seis**~~ ~~**siete**~~ ~~**ocho**~~ **nueve** tienen una confirmación de reembolso encima — **y los ~~seis~~ ~~siete~~ ~~ocho~~ nueve se leen en el motivo, sin mirar nada más**, desde que `DEC-RF-006` partió en dos el que `DEC-RF-004` había dejado dependiendo del disparador |
| **cancelar** una suscripción | §24 | **sí**, e irreversible en el proveedor (`PA-5`). **Con motivo revocación del derecho de arrepentimiento es la misma acción y corre `S36`** (cap. 03 (billing) §3.2): cancela, corta el servicio en el acto y crea `RF1` por el total, así que su confirmación dice las tres cosas (owner 2026-09-26, `G5-4`) |
| **pausar o reanudar** | §26 | sí |
| **cambiar de plan** a un cliente | §27, §28 | sí |
| **extender un trial** —**la cortesía durante el trial**, la misma que `V/11` §3.4 llama *«extensión firmada por `SUPER_ADMIN`»*—: es **de verticales**, sobre su propia máquina y **fuera del contrato**: corre `T4` con origen `SUPER_ADMIN` y **motivo obligatorio**, **pasa el techo** y suma al total acumulado visible con su origen (`V/11` §3.5); la construye **V4**, y `extenderTrial` sigue siendo sólo del canje (owner 2026-09-26, P2; FASE 9 vuelta 1). No es la fila de la cortesía temporal: ésa va en meses enteros sobre un plan mensual, y ésta en días | ~~§32~~ **§34.1**, `V/11` §3.4 (el §32 es el canje self-service; FASE 9 vuelta 1, P2) | no |
| **moderar una ficha** o **levantar la moderación** —`PB10` y `PB11`, `V/03` §9—, **con motivo** en el campo *«por qué»* del §1.2. **Desde la revisión del owner, en dos niveles y cambiable en las dos direcciones** (2026-09-28, C10, `L2-i`): **pedir un arreglo sin bajar la ficha** (abre la marca *«pedido de arreglo»*, que no es un estado, `V/02` §2.5), **bajarla** (`PB10`), **cambiar de nivel** (de pedido a baja por `PB10`, o de baja a sólo pedido por `PB11`/`PB13`) **o levantar** (`PB11`/`PB13`, y cerrar el pedido); **sigue siendo una acción con un permiso**. ~~**Y lo mismo sobre la presencia de un Partner**~~ **Y sobre la presencia de un Partner, con el mismo permiso y sin los dos niveles, que son sólo de la ficha** (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, G; `V/descomposicion.md` §2, fila `V6`; residuo corregido el 2026-10-02): escribe su bit de moderación (`V/18` §1.6; owner 2026-09-25, FASE 9 completa, decisión 7c) | FASE 8 completa, `F-8CA2-004`, owner 2026-09-25 | **no mueve dinero ni borra**: la ficha pasa a `MODERATED` y su contenido se conserva —**y desde la FASE 9 completa levantar la moderación reinicia el reloj de inactividad** (el hecho 6 del cap. 01 §1.2, decisión 5b), así que la frase es verdadera también después: antes, `PB11` → `PB5` → `PB9` borraba en días (`K-6`)—. **Si lleva confirmación explícita no lo dice la decisión**, y queda declarado con su causa (`DEC-METH-015`) |
| **reembolsar** | `DEC-RF-001` · `DEC-RF-002` | **sí**, **sin excepción**: `DEC-RF-002` resolvió el único caso que el diseño tenía candidato a excepción —el reembolso del pago pendiente al cerrar una sucesión— **a favor de la confirmación**. No hay ninguna operación automática sobre dinero. **Confirmar es la transición `REQUESTED → CONFIRMED` del reembolso, `RF2`** (cap. 01 §2.2, cap. 03 (billing) §6.1; FASE 9 completa, 5a) |
| **asentar un cobro o una devolución que ya ocurrió fuera de nuestro flujo** ✚ —el cobro del motivo 19 (`COBRO_SIN_REGISTRAR`): crear la fila de `payment` en `PENDING` con el id del registro y correr `P1` sobre ella; la devolución del motivo 18 (`REEMBOLSO_FUERA_DEL_FLUJO`), la de un `manual_payment` o la del cobro más viejo que el plazo del proveedor: asentar el `refund` por **`RF4`**, que nace en `EXECUTED` con el comprobante de la transferencia (cap. 03 (billing) §6.1) | motivos 18 y 19 del cap. 02 (billing) §2.5, `F-8CB1-015`; owner 2026-09-25, FASE 9 completa, decisión 5a | **sí**: registra plata que ya se movió y lo que de eso se desprende —el comprobante, `covered_period`, el cierre del reembolso—. Sin esta fila las dos marcas mandaban a una persona a *«asentar»* con un acto que la tabla no nombraba, y *«lo que no se puede es ejecutar una escritura que no esté nombrada en ninguna fila»* (abajo) |
| **editar el contenido de una ficha ajena** ✚ —crearla en borrador a nombre de su dueño, corregirla, restaurar contenido—, **sin publicar, sin destacar y sin borrar**, que siguen siendo del dueño o de sus filas (publicar es `PB1` del dueño, destacar es un addon y borrar es `PB9` o `PB12`). **El *«sin borrar»* vale para la edición de contenido**: borrar la ficha a pedido de su dueño es otra fila, la vigesimotercera, con su permiso (revisión del owner, casos vecinos, 2026-09-29, caso F-C) | owner 2026-09-26, `G5-2`; FASE 9 vuelta 1, `F-8V1A1-003` | **no mueve dinero ni borra**: escribe contenido de lo ajeno y su dueño recibe ~~el aviso de la fila 1 del cap. 19 (épica de verticales)~~ **el aviso de la fila 26 del cap. 19 §4 (épica de verticales) y el correo *«contenido de tu ficha editado por soporte»* de `NUCLEO/07` §6** (la fila 1 es el botón Empezar de Turista; FASE 9 vuelta 2, `F-8V2D1-002`). **Y es la única fila que no es capacidad del actor: sus pasos 5 a 7 se evalúan sobre el sujeto, el dueño de la ficha**, así que soporte no le deja la ficha por encima de su cupo (`V/17` §3.2 regla 3; FASE 9 vuelta 2, `F-8V2A1-004`). Es la herramienta de soporte que el código de hoy tiene sin fila —crear a nombre de un dueño, corregir, restaurar—, y sin ella la presión empujaba a pedirle la contraseña al cliente, que es la impersonación que `V/17` §3.2 regla 4 prohíbe. **Si lleva confirmación explícita no lo dice la decisión**, y queda declarado con su causa (`DEC-METH-015`) |
| ~~**discontinuar una vertical** ✚ **o acortar su cola**~~ | ~~`B/10` §4.3, `DEC-ARCH-011`; owner 2026-09-27, FASE 9 vuelta 2, `Q-ALTAS`, `Q-ALTAS-b` y `Q-ACC16`~~ | **sale de la tabla** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Con ella salen sus dos mitades, el reintento automático de la mitad de billing (`V2-i`), su condición de capa de composición y la exención por nombre de la regla de vigilancia (`V2-h`), acortar la cola (`V2-g`) y su sujeto en el resumen del §4.1 (`V2-s`). Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se diseña entonces. **Retirar planes, también todos los de una vertical, sigue**: no es una fila de esta tabla sino una publicación del catálogo (`B/10` §3) |
| **migrar a los clientes de un plan retirado** ✚ a una versión vigente y vendible de la misma vertical, **o cancelar una migración anunciada**, **sólo `SUPER_ADMIN`** (`B/10` §3.7) | revisión del owner, 2026-09-28, C15, `L1-g` y `L1-h` | **sí**: le cambia el precio y las capacidades a cada cliente alcanzado en su renovación (`S37` le muta el monto sobre su autorización, `B/03` §3.2), así que su confirmación **muestra a cada uno** con subida o bajada, su precio actual y el nuevo, y su fecha. **Cancelarla no mueve plata**: frena lo que todavía no se aplicó y avisa *«ya no cambia nada»*. **Es la decimoséptima y no la decimosexta**: el número de la que salió (discontinuar una vertical) no se reusa. **Y sigue siendo una fila propia, aparte de publicar una versión de plan** (la decimoctava): mueve a clientes ya anclados, con su aviso y su fecha, y publicar no mueve a nadie (revisión del owner, casos vecinos, 2026-09-29, caso 22). **Si la cohorte incluye la cuenta de quien la lanza, esa fila se excluye y el acto sigue** (`V/17` §3.2 regla 5; caso 24) |
| **publicar una versión de plan** ✚ (crear un plan, publicar una versión nueva con lo que otorga, sus entitlements y limits, su `rank`, vigente y vendible, sus días de prueba, su gracia y su pausa; retirarla, que es publicar una no vendible, `B/10` §3; o deshacer el retiro), **sólo `SUPER_ADMIN`** | revisión del owner, 2026-09-28, N1, `L1-f`; `NUCLEO/02` §1.4 | **sí, y la de más alcance del catálogo**: cambia qué se vende y qué recibe quien quede anclado a la versión nueva. Su confirmación dice **qué cambia contra la versión vigente, clave por clave**, y a cuántos clientes alcanza. **Rechaza lo que antes miraba un guard de CI**: `G-R3`, un `rank` repetido entre las vendibles y vigentes de la vertical, un plan sin exactamente una versión vigente, los días de prueba de una vertical que pasan de cero a más o al revés (`V/11` §8) y una gracia que no es menor que el ciclo más corto que la versión ofrece (`NUCLEO/02` §1.4). **Un cliente anclado a la versión vieja no cambia por esto**: cambia por un aumento (`DEC-MP-002`) o por la acción 17. **Es la decimoctava** |
| **fijar el precio de un ciclo** ✚, el monto de una `billing_option` de una versión de plan (`B/02` §2.1), **sólo `SUPER_ADMIN`** | revisión del owner, 2026-09-28, N1, `L1-f` | **sí, mueve plata**: ~~sobre una versión con clientes, un precio nuevo es un aumento o una baja para ellos y va por `DEC-MP-002`, con su aviso y la fecha de cada cliente.~~ **sobre una versión sin clientes fija el precio; sobre una con clientes se rechaza y se publica una versión nueva, que rige para las altas nuevas** (`DEC-MP-002`, parte 1); **y cuenta como cliente de una versión la fila con un `S38` encolado hacia ella, un descenso ya pedido** (corte del MVP, owner 2026-10-02, CC; `B/12` §3.2); **el aviso y la mutación a los ya anclados llegan con `B12`, por `S37` y `S38` con el motivo *«aumento»*** (BZ); **un monto menor que ARS 15 se rechaza; y su uso queda vedado hasta el momento 5 del corte**, como regla de operación (corte del MVP, owner 2026-10-02, BM y BZ; residuo corregido el 2026-10-02). Su confirmación dice **el precio anterior y el nuevo, el ciclo, a cuántos clientes alcanza y desde cuándo**. Rechaza un ciclo que no sea mayor que la gracia de la versión (`NUCLEO/02` §1.4). **Es la decimonovena** |
| **publicar una versión de complemento** ✚ (crear un complemento, publicar una versión con lo que otorga, su tipo de scope, sus verticales compatibles y su precio, o retirarla), **sólo `SUPER_ADMIN`** | revisión del owner, 2026-09-28, N1, `L1-f`; `B/16` | **sí**: fija qué se vende y a qué precio. Su confirmación dice qué cambia contra la versión vigente; lo ya comprado sigue anclado a su versión (`políticaDeAddon`, `12-contrato…` §4.1). **Escribe en las dos épicas, cada mitad en la suya** (FASE 9 vuelta 3, F-8V3C1-007): verticales crea la `addon_version`, y billing re-apunta `addon_product.version_id` y fija el precio con un acto propio que valida la versión con `políticaDeAddon` antes de escribir (`12-contrato…` §4.1, *«publicar una versión de addon»*); la pantalla es una, compuesta en la app del panel. **Es la vigésima** |
| **crear o cerrar un código promocional** ✚ (su efecto, su alcance, sus usos y su vigencia; cerrarlo deja de aceptar canjes y no toca los ya canjeados), **sólo `SUPER_ADMIN`** | revisión del owner, 2026-09-28, N1, `L1-f`; `B/14` | **sí**: un código es plata que se deja de cobrar. Su confirmación dice el efecto, a quién alcanza y hasta cuándo. **Es la vigesimoprimera** |
| **cambiar un plazo** ✚ de la lista cerrada de `NUCLEO/02` §1.5, **sólo `SUPER_ADMIN`** | revisión del owner, 2026-09-28, C9, C11, `L1-f`, `L2-h` | **sí**: mueve cuándo pasa algo: un archivado, un borrado, un aviso, el fin de una ventana. Publica una versión nueva de los plazos de su mitad, y **los relojes ya arrancados conservan la suya**, así que un cambio nunca adelanta una fecha ya anunciada. Su confirmación dice el valor actual, el nuevo y eso último. **Rechaza los valores que se contradicen** (`NUCLEO/02` §1.5). **Es la vigesimosegunda** |
| **borrar una ficha ajena a pedido de su dueño** ✚, **con motivo** en el campo *«por qué»* del §1.2: corre `PB12` sobre la ficha (`V/03` §9), con su lock, su borrado de contenido, su correo de confirmación y su empuje a billing. Es el paso 2 de la baja de cuenta manual (§1.3) | revisión del owner, casos vecinos, 2026-09-29, caso F-C; `V/03` §9 | **sí, destructiva**: `PURGED` es final y el contenido no vuelve. Su confirmación dice qué ficha, que su contenido se borra y no vuelve, y que el destaque que apuntaba a ella se cancela (`A6`, `B/03` §8). **Como la decimoquinta, no es capacidad del actor: sus pasos 5 a 7 se evalúan sobre el sujeto**, el dueño, porque hace por él lo que él mismo podría, y borrar lo propio es parte del piso (`V/03` §9, ⚠️ punto 5), así que ningún cupo la rechaza (`V/17` §3.2 regla 3). La clase y la unidad, `V8` como la 15, confirmadas por el owner (revisión del owner, casos vecinos, 2026-09-29, caso H-D). **Es la vigesimotercera** |
| ~~**borrar una cuenta a pedido de su dueño**~~ **dar de baja una cuenta a pedido de su dueño** ✚ (el nombre, revisión del owner, casos vecinos, 2026-09-29, caso I-C: la cuenta no se borra), **con motivo**: el paso 3 de la baja de cuenta manual (§1.3). **Se rechaza mientras ~~a la cuenta le cuelgue una suscripción viva, principal o de complemento,~~ `puedeCobrarle` (`12-contrato…` §4.1) conteste `sí`, es decir mientras le quede una suscripción, principal o de complemento, que todavía puede cobrar ~~(sin `CANCEL_SCHEDULED`)~~ **(también una `CANCEL_SCHEDULED` o una terminal cuya cancelación nuestra ninguna relectura confirmó todavía: `puedeCobrarle` contesta sobre la cancelación confirmada por Mercado Pago, y mientras no lo esté esta acción espera, hasta que ~~el barrido la confirme~~ una relectura por id la vea `cancelled` —la del barrido, la del handler o la de una transición, que escriben `provider_link.cancelado_visto_en` (`B/09` §3; corte del MVP, owner 2026-10-02, CH; residuo corregido el 2026-10-02)— o el barrido abra la marca; FASE 9 vuelta 3, owner 2026-09-30, lote D)** **(y una terminal cuyo preapproval canceló el proveedor tras un cobro rechazado, hasta que pase el plazo 16 desde la primera relectura que lo vio `cancelled`: FASE 9 vuelta 3, owner 2026-09-30, lote AE)** **o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta** (verificación corta, 2026-09-29, lote N-C), o le cuelgue una ficha fuera de `PURGED` **o una presencia de Partner con contenido** (lote N-G)** (verificación corta, 2026-09-29, lotes M-F y M-G: verticales no puede evaluar una fila viva~~, y una `CANCEL_SCHEDULED` ya está dada de baja en el proveedor y termina sola por `S12`, sobre la cuenta ya dada de baja~~; la razón tachada suponía confirmada una cancelación que el barrido puede estar reintentando: FASE 9 vuelta 3, F-8V3C1-001): los pasos 1 y 2 van antes, y la acción lo relee | revisión del owner, casos vecinos, 2026-09-29, caso F-C; §1.3 | **sí, destructiva**: la cuenta no vuelve. Su confirmación dice de quién es la cuenta y que no le queda cobro ni ficha. **Sobre una postulación sin cuenta, dice de qué postulación es el correo que reemplaza** (lote AI). **Es capacidad del actor**: el dueño no puede borrar su cuenta en esta versión (la baja desde Mi Cuenta es [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393)), así que no hay nada suyo que el sujeto pudiera hacer; la clase y la unidad, `V8`, confirmadas por el owner (caso H-D). ~~⚠️ **Qué escribe, es decir qué se borra, qué se anonimiza y si alcanza a este registro, no lo dice ningún capítulo** (§1.3).~~ ~~**Qué escribe: borra la fila de la cuenta y sus sesiones, seudonimiza lo personal (nombre, correo y teléfono) en lo que sobrevive a la cuenta, y no toca este registro, que conserva el actor y el sujeto por id, ni los cobros** (revisión del owner, casos vecinos, 2026-09-29, caso H-C). ⚠️ **Choca con `V/02` §2.4**: la FK de `trial.user_id` es `ON DELETE RESTRICT`, así que la base no deja borrar la fila de una cuenta que tuvo un trial, y ese § dice que el borrado de la cuenta seudonimiza esa fila y no la borra; cuál de las dos vale pide decisión del owner (`30-revision-del-owner/20-` §3).~~ **Qué escribe: la fila de la cuenta no se borra, se seudonimiza. Su nombre, su correo y su teléfono se reemplazan, sus sesiones se cierran y queda sin acceso. No toca este registro, que conserva el actor y el sujeto por id, ni los cobros. Y la fila de `trial` que la apunta sigue, con su FK `ON DELETE RESTRICT` y el hash del correo, así que la traba contra repetir la prueba no se pierde (`V/02` ~~§2.4~~ §2.2)** (revisión del owner, casos vecinos, 2026-09-29, caso I-C, que corrige la elección del caso H-C; el § citado no existía, la FK está en el §2.2: FASE 9 vuelta 3, F-8V3D1-007). **El seudónimo de esa fila se conserva hasta que el abogado conteste la pregunta 5 de `V/22`**; si la respuesta es en contra, soporte borra todos los seudónimos de las cuentas dadas de baja con una tarea puntual, que corre una vez, fuera del panel, y queda anotado quién la corrió y cuándo (FASE 9 vuelta 3, owner 2026-09-30, lote H); no es una fila de esta tabla, por la misma razón que la migración de datos única del catálogo no lo es: no se repite ni tiene permiso que pedir. **Qué deja la cuenta sin acceso, con dato**: la acción escribe el instante de la baja en `user.deleted_at`, la columna con que el código actual ya rechaza crear una sesión para una cuenta borrada, en el mismo hook para todo tipo de credencial, Google incluido (`apps/api/src/lib/auth.ts`, H-163, leído en hospeda2 el 2026-09-30), y **borra las credenciales vinculadas de la cuenta**, la contraseña y las vinculaciones con proveedores externos (las filas de `account`), para que ninguna siga verificando aunque ese control se rompa. El paso de la cadena de autorización que lo lee es el 1, *«quién es»* (`V/17` §1.2): una cuenta dada de baja no tiene actor autenticado (FASE 9 vuelta 3, F-8V3A1-004). **Y escribir `user.deleted_at` dispara un trigger del carril de extras, `trg_softdelete_bookmarks_on_users`, que sobrevive al corte (`16-fase-7…` §4.2, paso 6)**: borra de `user_bookmarks` los favoritos que otras personas guardaron sobre esa cuenta, no los que la persona guardó (`packages/db/src/migrations/extras/003-delete-entity-bookmarks.trigger.sql`, leído en hospeda2 el 2026-09-30). Es una escritura sobre datos de terceros que ya pasa hoy con cada baja, y queda nombrada acá (FASE 9 vuelta 3, caso vecino de F-8V3A1-004). **Y el correo de las postulaciones de Partner**: la baja reemplaza, como el de `user`, el correo de toda postulación que lleve el correo de la cuenta (`postulacion.correo`, `V/02` §2.7), que lo conservaba en claro y sin retención (FASE 9 vuelta 3, F-8V3A3-006). **Y alcanza también a una postulación hecha sin cuenta** (FASE 9 vuelta 3, owner 2026-09-30, lote AI; verificación, VC3-VT-08): a pedido de quien la escribió, soporte reemplaza el correo de esa postulación, con motivo y con este registro, sin cuenta que dar de baja; el sujeto es quien postuló, identificado por el correo de la postulación, y las precondiciones de la cuenta (`puedeCobrarle`, fichas y presencia) no aplican porque no hay cuenta. Sin esto, la postulación de un Partner sin cuenta (`DEC-AUTH-005`) dejaba un correo en claro que ninguna fila de esta tabla podía reemplazar. **Los datos de facturación de la cuenta, el nombre y el correo ~~de su cliente de billing~~ de quien pagó, se conservan tal cual, y la seudonimización no los alcanza: son datos de comprobantes que la ley obliga a guardar** (revisión del owner, casos vecinos, 2026-09-29, caso J-C). ~~⚠️ **En el modelo nuevo esos datos no tienen fila propia**: billing no tiene una entidad de cliente (`B/02`), el `billing_customers` del sistema viejo no sobrevive al corte (`B/21` §4), y el nombre y el correo de quien paga sólo viven en la fila de `user`, que esta acción reemplaza; dónde se conservan pide decisión del owner (`30-revision-del-owner/22-` §3).~~ **Viven en el comprobante**: cada `receipt` guarda una copia del nombre y el correo de quien paga, escrita al emitirse desde la fila de `user` y nunca reescrita, así que esta acción reemplaza los de `user` y la copia queda como estaba (`B/02` §2.3; revisión del owner, casos vecinos, 2026-09-29, caso K-A). **Y un cobro que llegue igual después de la baja**, en vuelo, se registra con el comprobante sin nombre ni correo y sin enviar (`B/03` §6, `P1`; verificación corta, 2026-09-29, lote N-C). **Es la vigesimocuarta** |
| **vaciar la presencia de un Partner a pedido de su dueño** ✚, **con motivo**: borra el contenido de su presencia, sus fotos, su logo, sus secciones y sus enlaces, en la base y en el almacenamiento externo, y deja su fila de `partners` sin contenido (`V/18` §1.6). En un Partner, es parte del paso 2 de la baja de cuenta manual (§1.3) | verificación corta, 2026-09-29, lote N-G (`VC-VT-07`) | **sí, destructiva**: el contenido no vuelve. Su confirmación dice de qué Partner es, que su contenido se borra y que no vuelve. **No toca el cobro ni la postulación, y no es moderar**: el bit de moderación conserva el contenido y esta acción lo borra. **Es capacidad del actor, como la vigesimocuarta**: no hay cupo que la rechace, y después del paso 1 el Partner ya no tiene la clave de su página (lo derivé y lo marco). La construye `V8`, con su panel, como la 23 y la 24, sobre la presencia de `V7` (derivado, como el caso H-D). **Es la vigesimoquinta** |
| **~~asignar el rol `SUPER_ADMIN` a una cuenta~~ asignar o quitar el rol `SUPER_ADMIN` a una cuenta** (lote AC) ✚, **sólo `SUPER_ADMIN`**, **con motivo** en el campo *«por qué»* del §1.2 | FASE 9 vuelta 3, owner 2026-09-30, lote P (`F-8V3A1-006`) | **sí, y la de más alcance de la tabla**: con el rol, la cuenta recibe el permiso de las siete filas *«sólo `SUPER_ADMIN`»* (de la 17 a la 22 y ésta), que fijan precios, plazos, el catálogo y quién más puede fijarlos. Su confirmación dice a qué cuenta se le da el rol y qué filas pasa a poder ejecutar **o, al quitarlo, a qué cuenta se le quita y qué filas deja de poder ejecutar** (FASE 9 vuelta 3, owner 2026-09-30, lote AC; verificación, VC3-VT-03). **Es la única escritura que da ese permiso**: el permiso de las siete viene sólo con el rol y no se da suelto, así que un override por usuario no lo puede dar (`V/17` §3.2 regla 1). **Es capacidad del actor**: su sujeto es la cuenta que recibe ~~el rol~~ **o pierde el rol** (lote AC) y no hay cupo que preguntarle, como la vigesimocuarta. Sobre la propia cuenta la rechaza el paso 3 (`V/17` §3.2 regla 5). ~~Quitarle el rol a una cuenta no es esta fila: queda como pregunta abierta en `37-fase-8-vuelta-3/15-aplicacion-lotes-p-a-aa.md` §6.~~ Quitarle el rol a una cuenta también es esta fila, con el mismo registro, actor, sujeto y motivo (FASE 9 vuelta 3, owner 2026-09-30, lote AC). La construye `V5`, con la regla del permiso que viene sólo con el rol. **Es la vigesimosexta** |

~~**La tabla tiene DOCE filas**~~ ~~**La tabla tiene TRECE filas** —la decimotercera, moderar una
ficha, desde la FASE 8 completa (`F-8CA2-004`, owner 2026-09-25)—~~ ~~**La tabla tiene CATORCE filas**~~ ~~**La
tabla tiene QUINCE filas**~~ ~~**La tabla tiene DIECISÉIS filas**~~ ~~**La tabla tiene QUINCE filas** (revisión del owner, 2026-09-28, C8: sale la decimosexta, discontinuar una vertical; recontadas sobre la tabla)~~ ~~**La tabla tiene DIECISÉIS filas vivas** (revisión del owner, 2026-09-28: C8 sacó la decimosexta, discontinuar una vertical, que queda tachada y con su número sin reusar, y C15 agregó **la decimoséptima, migrar a los clientes de un plan retirado**; recontadas sobre la tabla)~~ ~~**La tabla tiene VEINTIUNA filas vivas** (revisión del owner, 2026-09-28: C8 sacó la decimosexta, discontinuar una vertical, que queda tachada y con su número sin reusar; C15 agregó **la decimoséptima, migrar a los clientes de un plan retirado**; y N1 con C9 agregaron **de la decimoctava a la vigesimosegunda**, las cinco del catálogo: publicar una versión de plan, fijar el precio de un ciclo, publicar una versión de complemento, crear o cerrar un código promocional y cambiar un plazo, `L1-f`; recontadas sobre la tabla)~~ ~~**La tabla tiene VEINTITRÉS filas vivas**~~ ~~**La tabla tiene VEINTICUATRO filas vivas**~~ **La tabla tiene VEINTICINCO filas vivas** (FASE 9 vuelta 3, owner 2026-09-30, lote P: entra **la vigesimosexta**, ~~asignar~~ asignar o quitar el rol `SUPER_ADMIN` a una cuenta (el nombre, lote AC); y antes, verificación corta, 2026-09-29, lote N-G: entra **la vigesimoquinta**, vaciar la presencia de un Partner a pedido de su dueño, parte del paso 2 de la baja de cuenta manual; y antes, revisión del owner, casos vecinos, 2026-09-29, caso F-C: entran **la vigesimotercera y la vigesimocuarta**, borrar una ficha ajena y ~~borrar una cuenta~~ **dar de baja una cuenta** (caso I-C), las dos a pedido de su dueño, que son los pasos 2 y 3 de la baja de cuenta manual del §1.3; recontadas sobre la tabla)
—la decimotercera, moderar una ficha, desde la FASE 8 completa (`F-8CA2-004`, owner 2026-09-25), ~~y~~
la decimocuarta, asentar un cobro o una devolución hecha por fuera, desde la FASE 9 completa
(decisión 5a), **y la decimoquinta, editar el contenido de una ficha ajena, desde la FASE 9 vuelta 1
(owner 2026-09-26, `G5-2`)**, ~~**y la decimosexta, discontinuar una vertical, desde la FASE 9
vuelta 2 (owner 2026-09-27, `Q-ACC16`)**~~**; recontadas sobre la tabla**— **y cada fila es UNA acción, aunque varias nombren más de una escritura.**
*«Otorgar o revocar»*, *«pausar o reanudar»*, *«pedir un arreglo, bajar, cambiar de nivel o levantar»* (revisión del owner, 2026-09-28, C10: la de moderar, en dos niveles), ~~*«aprobar o rechazar»*~~ *«aprobar, rechazar o anular la espera»* (una postulación de Partner; FASE 9 vuelta 2, `R7`), ~~y ahora~~ *«otorgar, anclar o
revocar»*, *«moderar o levantar la moderación»* —**sobre una ficha o sobre la presencia de un Partner,
que es la misma acción con el mismo permiso** (7c)— ~~**y *«asentar un cobro o una devolución»***~~, **y *«asentar un cobro o una devolución»*** ~~**y *«discontinuar una vertical o acortar su cola»*** (FASE 9 vuelta 2, verificación, `V2-g`)~~ **y *«migrar o cancelar una migración»*** (revisión del owner, 2026-09-28, C15), **y *«crear o cerrar»*** un código promocional y *«publicar o retirar»* una versión de plan o de complemento (la misma revisión, N1, `L1-f`), **y *«asignar o quitar»* el rol `SUPER_ADMIN`** (FASE 9 vuelta 3, owner 2026-09-30, lote AC; verificación, VC3-VT-03) son la misma acción sobre el mismo instrumento, con **un** permiso, y por eso las ~~cinco~~
líneas que cuantifican sobre esta tabla —`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 **y su ⚠️, §3.5** y `B/19` §6— ~~siguen
diciendo **doce** y siguen siendo exactas~~ ~~**dicen trece desde la misma pasada**~~ ~~**dicen catorce desde la FASE 9 completa**~~ ~~**dicen quince desde la FASE 9 vuelta 1**~~ ~~**dicen dieciséis desde la FASE 9 vuelta 2** (`Q-ACC16`)~~ ~~**dicen quince otra vez desde la revisión del owner, 2026-09-28, C8**~~ ~~**dicen dieciséis desde la misma revisión, con C8 y C15**~~ ~~**dicen veintiuna desde la misma revisión, con C8, C15 y las cinco del catálogo (N1, C9)**~~ ~~**dicen veintitrés desde los casos vecinos, caso F-C**~~ ~~**dicen veinticuatro desde la verificación corta, lote N-G**~~ **dicen veinticinco desde la FASE 9 vuelta 3, lote P** (las de `V/17`; la de `B/19` §6 es de la otra épica). **Lo que no se puede es ejecutar una escritura que no
esté nombrada en ninguna fila**: una escritura sin fila no tiene permiso que pedir, no es capacidad
del actor —así que sus pasos 5-7 caen sobre el sujeto y la vuelven inejecutable; **las filas lo son
todas menos la decimoquinta~~, que se evalúa~~ **y la vigesimotercera, que se evalúan** sobre el sujeto a propósito** (FASE 9 vuelta 2,
`F-8V2A1-004`; las cinco del catálogo también lo son: su sujeto es el catálogo, no un cliente,
revisión del owner, 2026-09-28, N1; la vigesimotercera, revisión del owner, casos vecinos, 2026-09-29, caso F-C)— y **no le está
prohibida a un actor de sistema**, que son las tres cosas que esta tabla reparte. Por eso anclar
una vertical a un grant entra **acá** y no sólo en la prosa del contrato que lo declaró.

> ~~⚠️ **Quién asigna el permiso de cada fila, y qué es *«sólo `SUPER_ADMIN`»*, no está escrito**
> (FASE 9 vuelta 3, F-8V3A1-006). Seis filas dicen *«sólo `SUPER_ADMIN`»*, que es un rol, contra
> la regla de que ninguna autorización decide sólo por rol (`V/17` §4.3). Y asignar un permiso o un
> rol a una cuenta no es ninguna fila de esta tabla, aunque el código actual ya tiene overrides de
> permiso por usuario: o nadie puede asignar los permisos nuevos, o se asignan sin auditoría. Pide
> decisión (`37-fase-8-vuelta-3/13-aplicacion-nucleo-contrato-y-corte.md` §6).~~
> **Qué es *«sólo `SUPER_ADMIN`»*, decidido** (FASE 9 vuelta 3, owner 2026-09-30, lote P): cada
> una de las siete filas que lo dicen, de la 17 a la 22 y la 26, tiene su permiso propio, como las
> demás, y **ese permiso viene sólo con el rol `SUPER_ADMIN` y no se da suelto**: un override por
> usuario no lo puede dar. El paso 3 sigue preguntando por el permiso y no por el rol (`V/17` §4.3).
> **Y ~~asignar~~ asignar o quitar el rol es la vigesimosexta** (lote AC), registrada con actor, sujeto y motivo como cualquier
> fila, así que el poder de fijar precios nunca cambia de manos sin rastro (`V/17` §3.2
> regla 1).

**Dos cosas que ninguna fila de esta tabla hace, ni las que se agreguen:** un acto de un actor
distinto del dueño **nunca es *«el dueño publica»***, así que no ejerce el evento de activación
ni dispara `T1` (el trial es de por vida y lo gasta sólo el dueño, `V/03` §2); y **ningún
borrado de ficha sale de otra fila que `PB9` o `PB12`**, que es lo que hace correr `A6`
(`B/03` §8) y cancela el addon `LISTING` de la ficha borrada (FASE 9 vuelta 1, `F-8V1A1-003`). La
vigesimotercera no es la excepción: borra corriendo `PB12` (revisión del owner, casos vecinos, 2026-09-29, caso F-C).
**Y las puertas que hoy borran por otro lado se retiran** (FASE 5, owner 2026-09-30, lote 3 C): el
botón con que el dueño borra su ficha pasa a ser el borrado del diseño, el borrado del equipo pasa a
la vigesimotercera, a pedido y con motivo, y **desaparecen el borrado físico de fichas y de cuentas
y la restauración de fichas del panel** en las tres verticales. Una cuenta no se borra: se da de
baja con la vigesimocuarta.

> **«Entrar como» el cliente queda para una versión posterior, y su condición se escribe hoy**
> (revisión del owner, 2026-09-28, C7). Un admin que le maneja la ficha a quien no sabe hacerlo
> **no está en esta versión y se va a agregar**. La condición, que vale desde ya para quien lo
> diseñe: **todo lo que haga queda registrado como hecho por el admin en nombre del cliente**
> (actor el admin, sujeto el cliente, y nunca `actor = sujeto` en el registro, §1.2); no es la
> impersonación que `V/17` §3.2 regla 4 prohíbe, que borra quién actuó. **Cuando se diseñe, la
> frase de arriba *«ni las que se agreguen»* se reabre**: si el admin publica en nombre del
> cliente, o esa publicación le arranca la prueba al cliente (y la frase cae) o no se la arranca
> (y el admin no puede publicar la ficha de quien no tiene plan). No se decide ahora.
> **Y lo que el código de hoy tiene apagado no espera a esa versión: sale en `V5`** (FASE 5, owner
> 2026-09-30, lote 4 C): `impersonate` y `set-role` del plugin `admin` de Better Auth, el botón de
> impersonar del panel y el permiso `USER_IMPERSONATE`. HOS-354 se cierra o se reescribe como el
> *«entrar como»* de esa versión posterior. Con `set-role` sale además un segundo camino para
> asignar roles que no pasa por ninguna fila de esta tabla, y que la vigesimosexta no contaba.
> **Y con ellas `fullAdminRole` del plugin queda sin ninguna acción** —salen también `ban`,
> `delete`, `set-password`, `create` y `update`, y con `delete` la puerta de borrado físico de
> cuentas que el lote 3 C retira—: **el plugin sigue sólo como guardia del baneo**, cuyo rechazo de
> sesión no depende del rol (FASE 5, lote de la aplicación, owner 2026-09-30, L; hoy toda ruta del
> plugin contesta `403`, así que vaciar el rol no rompe nada que funcione).

**Y ninguna fila de esta tabla se ejecuta con `actor = sujeto`**: el paso 3 de la autorización la
rechaza y la hace otra cuenta con el permiso (`V/17` §3.2 regla 5; owner 2026-09-26, `G5-1`).
**Compara cuentas, no personas** (owner 2026-09-26, `Y-2`): la misma persona con dos cuentas la
cumple, y lo que la ve es el detector del §4.1.

**Y lo que le pone un caso ADELANTE a esa persona no es una fila de esta tabla: es un efecto de
transición, así que ~~siguen siendo doce~~ no suma filas.** La distinción hay que decirla porque `DEC-RF-002`
convirtió el reembolso del pago pendiente en **el desenlace de un camino que el sistema alcanza
solo** —antes era un acto que alguien pedía—, y una acción con permiso, auditoría y confirmación
declarados **no sirve de nada si nadie enruta el caso**. El enrutado existe y está en dos lugares
que no son éste:

| qué | quién lo hace | dónde |
|---|---|---|
| **abrir** la marca —con motivo **`REEMBOLSO_POR_CONFIRMAR`** y **el pago colgado de ella**— sobre la predecesora que lo retiene, un `payment` **o un `manual_payment`**, porque `S19` lo retiene entre por la puerta que entre | **`S18`**, como **quinto** efecto del cierre de la sucesión | `B/03` §3.2, `B/02` §2.5, `B/12` §5.3 **ramas 1, 5 y 6** |
| **abrir** la marca —con uno de **dos** motivos y el pago colgado— sobre la **suscripción de complemento** que muere con un período cobrado **sin terminar** | **`S21`**, en el mismo acto en que la lleva a `CANCELLED`. **Cuál de los dos escribe es lo que decide lo que el listado propone**, y desde `DEC-RF-006` eso es **el motivo** y no una rama: ~~**`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN_O_DISCONTINUACIÓN`**~~ **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`** —devolver— si la instancia murió por la **revocación del grant** ~~o **huérfana porque a su título lo mató la discontinuación de la vertical** —`S25`, `S27` o `S28`, o `S12` en la fecha de fin sobre una vertical con fila en `vertical_discontinuation` (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-n`)—, o si es un `USER`/`GLOBAL` que `S26` canceló (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-d`)~~, y **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`** —no devolver— en el resto. ~~**Son cinco casos a distinguir y no cuatro**: los cuatro disparadores, con el de la orfandad partido en dos~~ **Son cuatro casos, los cuatro disparadores**: la orfandad ya no se parte (revisión del owner, 2026-09-28, C8: salen la discontinuación y la palabra del nombre del motivo) | `B/03` §3.2, `B/02` §2.5 **motivos 14 y 15**, `B/16` §4.4, `DEC-ADDON-004`, `DEC-RF-004`, `DEC-RF-006` |
| **hacer que esa marca escale** si nadie la resuelve | el **barrido diario**, que devuelve al recorrido las suscripciones terminales con la marca puesta o con un pago pendiente — **y como el reloj vive adentro del barrido, que el barrido corra lo vigila OTRO proceso**: si pasan 26 h sin una corrida completa, avisa (FASE 8 completa, `F-8CB3-007`) | `B/09` §3, salvedades 2 y 3; **`B/09` §7.1** |
| **re-emitir una cortesía DIFERIDA** sobre la fila que acaba de autorizar — **la sucesora** de un cambio de plan~~, o **el alta nueva** de quien perdió su plan porque se discontinuó su vertical~~ | **`S9`**, por su segundo disparador ~~y por el **tercero**~~ — la firma sigue siendo la de `SUPER_ADMIN` que la otorgó, así que **no es una concesión nueva** y no suma fila ~~, **por ninguno de los dos caminos**~~ (el alta nueva y el tercer disparador salieron con la revisión del owner, 2026-09-28, C8) | `B/03` §3.2, `B/02` §2.4 y §2.6, `B/14` §4.4 ~~y §4.6~~, `DEC-GRANT-007`~~, `DEC-GRANT-010`~~ |
| **CERRAR el saldo de una cortesía diferida**, con `saldo_cerrado_en` y su `motivo_cierre` | **`S3`** cuando la sucesora abandonó el checkout, **`S13`** cuando un grant pasa a cubrir esa vertical, ~~y~~ **`S18`** ~~o el **`S2`** del alta~~ cuando el destino es de plan ~~anual~~ no mensual (FASE 8 completa; `DESTINO_DE_PLAN_NO_MENSUAL`, FASE 9 completa, contradicción 1 de `03` §R4.5), **y `S31` cuando la sucesora se corta porque un contracargo cortó a su predecesora** (FASE 8 completa, pendiente 8, owner 2026-09-25) — **son los ~~tres~~ cuatro valores de la enumeración cerrada** (`B/02` §2.4), y es cerrada y no el texto libre de `DEC-GRANT-008` porque **no hay una persona escribiendo el motivo** | `B/03` §3.2, `B/02` §2.4, `B/14` §4.3, `DEC-GRANT-011` |

Las **cinco** son actos **de sistema**, no de admin, y por eso no suman filas —el renglón decía
*«las dos»*, la tabla ya tenía tres cuando `DEC-GRANT-010` sumó la re-emisión, pasó a cuatro con la
marca que abre `S21` y llega a cinco con el cierre de `DEC-GRANT-011`; el conteo se recontó sobre
las filas cada vez. **La quinta es la única que no le pone nada delante a nadie**: no enruta un
caso, **termina** una concesión que firmó `SUPER_ADMIN`, y es por eso que necesitó dejar asentado
su motivo — el registro de auditoría dice qué acto ocurrió y cuándo, y **acá no hay nadie a quien
preguntarle por qué**. **Ninguna de las dos que abren una marca es `S14`**: su
evento es *«divergencia que toca plata o estado»*, y ni el pago que `S19` retiene ni el período del
complemento que muere son divergencias — los dos son casos **diseñados**, y `S19` lo declara por
escrito. La tercera es un job, la cuarta es un efecto de `S9` y la quinta, uno de `S3` y de `S13`. Lo que sí es de esta
tabla son los dos actos con que una persona **cierra** el caso: **reembolsar** y **levantar la
marca**, cada uno con su fila, su permiso y su confirmación. Sin las dos mitades de arriba, esas
dos filas describen un trámite que nadie empieza.

### 3.1 Dos reglas sobre la confirmación

1. **La confirmación dice qué va a pasar, no pregunta si está seguro.** `DEC-GRANT-001` lo pide
   textualmente para la revocación de un grant — *«la UI del admin debe decirlo explícitamente al
   revocar, o alguien lo va a hacer sin entender que está cortando el servicio de alguien»*.

   **Las tres escrituras sobre un grant tienen cada una su frase, y ninguna se deduce de la otra**:
   otorgar y anclar **cancelan la suscripción que el beneficiario paga** en cada vertical
   alcanzada (`S13`), **terminan la cortesía que tuviera vigente ahí** y **cierran el saldo de una
   cortesía DIFERIDA que estuviera esperando ahí** —~~días~~ meses que `SUPER_ADMIN` firmó y que todavía no
   se entregaron, así que la frase los nombra con su número (`B/14` §4.3, `B/02` §2.4)—. Y el estado
   en el proveedor pasa a `cancelled`, así que el cliente recibe el correo del proveedor por su cuenta
   (`EX-3`)—; revocar corta el servicio. Quien ancla una vertical tiene que leer, antes de
   firmar, **qué cobro deja de ocurrir**, porque ése es el acto que hoy nadie ve: el grant ya
   existía y la pantalla parece decir que sólo se agrega algo.

   **Y con `includesAddons: true` los cobros que dejan de ocurrir son más de uno**: otorgar y
   anclar **también cancelan la suscripción de complemento de cada addon compatible** y lo pasan
   a costo $0 (`S20`, `B/16` §3.4). La frase tiene que **enumerarlos**, no resumirlos, porque
   cada uno es un débito distinto que desaparece y porque **el beneficiario va a recibir un
   correo del proveedor por cada preapproval cancelado** (`EX-3`): quien firma tiene que saber
   cuántos son antes de que los mande.

   **Y la frase de revocar dice que esos addons se apagan y NO vuelven solos.** Es la mitad que
   duele de la decisión del owner: el beneficiario **venía pagando** esos addons, se los pasamos
   a gratis, y al revocar **no se reanuda el débito viejo** —cancelar en el proveedor es
   irreversible (`PA-5`) y `DEC-GRANT-001` ya lo declara— **ni se compensa**. Si los quiere de
   nuevo, vuelve a suscribirse. Sin esta frase, *«qué addons corta»* (`B/19` §4 fila 13) se lee
   como que corta regalos, cuando la mitad puede ser lo que la persona pagaba.

   **Y revocar DEJA MARCA en el instrumento, que es lo que vuelve auditable el acto más grave de
   esta tabla.** El §35.4 exige auditar el grant, y hasta la FASE 9-bis-4 el registro de auditoría
   era **lo único** que sabía que hubo una revocación: la fila del grant no declaraba ni estado ni
   revocación, así que ningún predicado del diseño podía preguntar después si la concesión seguía
   en pie. Ahora la revocación escribe `permanent_grant.revocado_en`, quién la firmó **y el
   MOTIVO, en texto libre** (`B/02` §2.4, `DEC-GRANT-008`). **Las anclas no se borran**: dejan de
   ser anclas vivas todas a la vez. Y la regla que
   esta tabla ya imponía sigue igual —*«lo que no se puede es ejecutar una escritura que no esté
   nombrada en ninguna fila»*—: la escritura es de la fila de arriba y no agrega una ~~décimotercera~~ fila más
   (la decimotercera que la tabla tiene hoy es la de moderar, ~~y~~ la decimocuarta la de asentar, **y la
   decimoquinta la de editar el contenido de una ficha ajena** (`G5-2`), ~~**y la decimosexta la de
   discontinuar una vertical** (`Q-ACC16`)~~, que son otras acciones; la decimosexta salió con la
   revisión del owner, 2026-09-28, C8).

   **El motivo es la mitad que la auditoría necesitaba y el registro de auditoría no da.** Ese
   registro dice **qué acto ocurrió, cuándo y quién lo hizo**; lo que no dice —ni puede— es
   **por qué**, y es lo primero que se pregunta seis meses después, empezando por el beneficiario
   al que le cortaron el servicio sin que hiciera nada. **Libre y no de lista cerrada**: el
   volumen es bajo —son concesiones firmadas a mano por `SUPER_ADMIN`— así que no genera basura, y
   una lista cerrada hay que mantenerla mientras el `otro` se come el resto (`DEC-GRANT-008`).

   **Y la frase de revocar dice además que el trial ya está consumido y no vuelve**
   (`DEC-TRIAL-009`). Recibir el grant consume el trial de esa vertical —`T2` o `T6`, según
   estuviera corriendo o no— y **la revocación no lo devuelve**: el beneficiario queda sin grant,
   sin suscripción y sin trial, así que si quiere seguir paga desde el primer día. Es el dato que
   convierte *«le corto el servicio»* en *«le corto el servicio y además no tiene prueba
   gratuita»*, y sin él quien firma cree que está haciendo algo menos grave de lo que hace.
2. **`SUPER_ADMIN` firma toda concesión gratuita**, temporal o permanente (`DEC-GRANT-002`), y
   eso tiene un costo operativo declarado: compensar unos días a alguien pasa a requerirlo. **El
   riesgo concreto es que se termine compartiendo la cuenta**, que es peor que el riesgo que se
   evita. Si aparece, se resuelve con un permiso acotado y no con una cuenta compartida.

---

## 4. La conciliación pendiente, sin apagar el canal · cierra `R-OBS-01` y `S-OBS-01`

El §22.1 ordena, **siempre** que el sistema no pueda decidir solo: registrar evento crítico,
generar información suficiente para investigar, **enviar correo a `SUPER_ADMIN`**, mostrar alerta
en Admin si corresponde, y evitar decisiones destructivas automáticas.

**El problema es el tercero.** Un incidente de webhooks genera cientos de eventos idénticos: con
un correo por evento, **el canal deja de leerse justo cuando importa**. Y el requisito real lo
enuncia el propio §22.1 al cerrar: *«que `SUPER_ADMIN` esté al tanto y pueda intervenir»*.

### 4.1 Lo que se hace

| | |
|---|---|
| **canal primario** | el **listado accionable en Admin**, que el §22.1 ya contempla. Cada entrada trae lo necesario para decidir sin reconstruir el diagnóstico — **incluido el estado real de la fila**, que la marca ya no pisa |
| **el correo** | **agregado**, con límite de frecuencia: un resumen cada N minutos con el conteo por tipo y los sujetos afectados, en vez de uno por evento |
| **la excepción** | un evento **único y grave** —un doble cobro real detectado **(la marca con motivo `COBRO_DUPLICADO`, cap. 02 (billing) §2.5, motivo 20)**, un reembolso que falló sobre una revocación **(un `refund` de `DEC-RF-001` que llega a `FAILED` por `RF5`, cap. 03 (billing) §6.1)**— manda **su propio correo**, sin esperar la ventana (FASE 9 completa, `DB-4`; el `FAILED`, decisión 5a) |
| **la agrupación** | por **tipo + sujeto**. Cientos de eventos de un mismo incidente colapsan en una línea con su conteo |
| **lo que nunca se agrupa** | el **registro**. El evento crítico se escribe uno por uno, siempre. Lo que se agrupa es el aviso |

**Y un tipo del resumen que no nace de una marca: ~~la pausa corta que regaló un ciclo~~ la vuelta
anticipada que regaló días** ✚ (owner
2026-09-26, `G5-3`; FASE 9 vuelta 1, `F-8V1B1-001`; el predicado, FASE 9 vuelta 1, `N-2`). La vuelta anticipada de una pausa sigue libre
—*«volver cuando quiera»*, §26.2 del PDR a la letra—, y eso deja que ~~una pausa de menos de un
ciclo que cruza una fecha de cobro regale ese ciclo~~ **toda pausa que cruza una fecha de cobro y
termina fuera del aniversario regale días, dure lo que dure**: el proveedor saltea el cobro mientras la fila
está `paused` y, al volver, cobra normal en el ciclo siguiente (`PS-2`, `PS-5`, `PS-6`). **El regalo
no depende de la duración sino de la aritmética**: lo pagado y no usado al pausar —del inicio de la
pausa a la primera fecha salteada— no compensa lo usado sin pagar al volver —de la vuelta a la
próxima fecha de cobro—. Juan cobra el día 1, pausa el 31/oct por tres meses y vuelve el 2/dic: pierde
un día y usa treinta sin pagar, **29 días de regalo con una pausa de 32 días**, que el predicado
viejo (*«a menos de un ciclo de su inicio»*) no listaba. Nuestro
estado y el del proveedor coinciden en cada paso, así que **ninguna comparación del barrido lo ve**,
y por eso tiene su propia línea. **El barrido diario (`B/09` §2.3) lista en el resumen las pausas
terminadas por `S10` ~~cuyo `fin_real` cayó a menos de un ciclo de su inicio y que cruzaron una fecha
de cobro salteada~~ que cruzaron al menos una fecha de cobro salteada y cuyo regalo neto es
positivo** —(próxima fecha de cobro después de `fin_real` − `fin_real`) − (primera fecha salteada −
inicio de la pausa), en días—, con el sujeto, las dos fechas, el ciclo salteado **y los días de
regalo**; se lee de la
`subscription_pause` (`B/02` §2.2) y de la fecha del próximo cobro, sin llamar al proveedor. **No
abre marca ni corta nada**: es un detector, no un control —el costo aceptado se mide, no se
impide— (`B/03` y `B/12`, *«lo que este capítulo NO cierra»*).

**Y otro tipo del resumen que tampoco nace de una marca: las acciones administrativas que mueven
plata** ✚ (owner 2026-09-26, `Y-2`; FASE 9 vuelta 1, `N-1` de `25-verificado-G5`). La regla 5 de
`V/17` §3.2 —una acción administrativa nunca tiene `actor = sujeto`— compara **cuentas**, no
personas: una persona con una cuenta de staff y otra de cliente se opera lo suyo desde la primera
y la regla se cumple. **El resumen lista cada acción del catálogo del §3 cuya columna *«¿destructiva
o mueve dinero?»* dice que mueve dinero** —registrar un pago manual, una cortesía, un grant, la
revocación, un reembolso, asentar un cobro o una devolución de afuera, y las demás de esa
columna—, **con su actor y su sujeto**, leídos del registro de auditoría del §1 sin llamar al
proveedor, para que el owner la revise. **No abre marca ni bloquea nada**, y no distingue a la
misma persona detrás de dos cuentas: la revisión es humana. **La confirmación por una segunda
persona entra cuando haya otra persona con el permiso** (`V/17` §3.2, regla 5). ~~**La acción 16 va
con la vertical como sujeto y cuántos dueños alcanza**, y el `SUPER_ADMIN` que además es dueño en
esa vertical queda visible en esa línea, sin regla nueva (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-s`).~~
(La acción 16 salió con la revisión del owner, 2026-09-28, C8.)

**Y un tercer tipo del resumen que no nace de una marca: el cobro por debajo del esperado** ✚
(FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-f`; caso de `16-` §5). La comparación de
cobros del barrido (`B/09` §3) ya deriva, para cada registro aprobado que tenemos acreditado, el
monto esperado del período que cubre, y el motivo 24 mira sólo el cobro de más. **El de menos
aparece cuando una mutación que sube el monto cae entre la creación del registro del ciclo y su
cobro**, y el registro cobra el viejo (un aumento de `DEC-MP-002`, o `S30` restaurando el precio
al agotarse una promo; si pasa o no es `EX-47`), y en un aumento alcanza a toda la cartera de la
vertical en la misma fecha. **El barrido diario lista en el resumen cada cobro por debajo del
monto esperado de su período, con el sujeto y la diferencia**; se lee de lo que la comparación ya
calcula, sin llamar al proveedor. **No abre marca, no cobra la diferencia y no mueve el conteo de
motivos** de `B/02` §2.5: es plata de Hospeda, nadie pagó de más, y el costo aceptado se mide como
el de la pausa regalada.

### 4.2 Y esto es un apartamiento del §22.1, registrado como `DEC-OBS-001`

El §22.1 dice *«enviar email a `SUPER_ADMIN`»* sin condición, y esto manda un correo agregado en
vez de uno por evento: **se cumple el objetivo que el propio §22.1 enuncia al cerrar y no su
letra**. Queda registrado en `01-decision-log.md` (2026-09-17, aprobado por el owner) y es el
**cuarto** apartamiento del programa. Los otros cuatro puntos del §22.1 se cumplen literalmente.

**La ventana de agregación es un riesgo declarado**: entre el primer evento y el resumen pasan
hasta `N` minutos. Para lo que no puede esperar está la excepción, y **qué entra en esa excepción
es una lista cerrada**: ~~un doble cobro real detectado, y un reembolso que falló sobre una
revocación~~ **la marca con motivo `COBRO_DUPLICADO` (cap. 02 (billing) §2.5, motivo 20), y un
`refund` de una revocación que llega a `FAILED`** (FASE 9 completa, `DB-4` y decisión 5a).

### 4.3 La información suficiente, en concreto

El §22.1 pide *«generar información suficiente para investigar»*. Cada entrada lleva:

- **cuál de las cuatro condiciones del cap. 05 §3 falló**, cuando el caso es un pago tardío — sin
  eso, quien lo mire tiene que rehacer el diagnóstico entero;
- **el monto a devolver, el pago que lo origina y POR QUÉ PUERTA entró ese pago**, cuando el caso
  es el **reembolso por confirmar** de las ramas 1, 5 y 6 del cap. 12 §5.3 (épica de billing). Esta
  entrada es de otra forma que las demás y conviene decirlo: **no hay nada que diagnosticar** —el
  desenlace lo decidió el diseño y `DEC-RF-002` sólo puso la confirmación humana en el medio—, así
  que lo que la persona necesita no es el conflicto entre dos estados sino **qué devolver, a quién
  y de qué cobro**. **La puerta es parte de eso y no es un dato de color**: `S19` retiene el pago
  del período impago entre por la puerta que entre, y un `payment` se devuelve **por la API del
  proveedor** mientras que un `manual_payment` se devuelve **a mano, por donde entró** (cap. 03
  §3.2 y §7, épica de billing). Quien confirma no puede elegir el camino si la entrada no se lo
  dice. La lista de arriba contemplaba el pago tardío que **falla**; éste es el que **sale bien**
  y deja plata por devolver.
  **Y desde la FASE 9-bis-4 esos tres datos no viven sólo acá**: la marca los **guarda** —el
  motivo `REEMBOLSO_POR_CONFIRMAR` y el pago colgado de ella, cap. 02 (billing) §2.2 y §2.5—, que es lo que
  los pone también en el **listado accionable**, el canal primario de `DEC-OBS-001`. Mientras
  fueron sólo campos de un evento, el canal que la persona mira de verdad recibía **una fila
  `CANCELLED` marcada e indistinguible de las otras ~~catorce~~ ~~quince~~ ~~dieciocho~~ ~~diecinueve~~ ~~veintiuna~~ ~~veintidós~~ veintitrés marcas** (~~diecinueve~~ ~~veinte~~ ~~veintidós~~ ~~veintitrés~~ veinticuatro
  motivos desde la FASE 9 vuelta 2, `R4` y `R20`, cap. 02 (billing) §2.5);
- **los dos estados en conflicto**: el nuestro y el del proveedor, con la fecha de cada lectura;
- **la correlación**, para poder seguir la cadena hacia atrás;
- **qué se intentó y qué se frenó**, porque el §22.1 prohíbe decisiones destructivas automáticas
  y hay que saber qué quedó sin hacer.

---

## 5. Los campos del §50, y el uno que falta

El §50 pide como mínimo: `userId`, vertical, `subscriptionId`, `paymentId`, identificadores del
proveedor, id del webhook, id de request, id de correlación, listing y addon.

**Falta uno, y es el que hace legible un incidente**: el **tipo de actor** (§1.2). Los diez
campos del §50 dicen *sobre qué* pasó algo; ninguno dice *quién* lo hizo, y la diferencia entre
un cambio que pidió el cliente, uno que hizo un admin y uno que ejecutó un job es lo primero que
alguien necesita saber cuando algo salió mal.

---

## Lo que este capítulo NO cierra

- **Qué hace el reconciliador para detectar**, y con qué frecuencia, es el capítulo 09.
- **Las superficies del Admin** —cómo se ven estas acciones y este listado— son del capítulo 19.
- ~~**El reembolso que falla sobre una revocación tenía nombre y no productor**~~ **Cerrado por la
  decisión 5a** (FASE 8 completa, `F-8CB3-016`; FASE 9 completa, `DB-4`). La excepción del §4.1 lo
  nombraba y ninguna comprobación lo producía —**causa**: `DEC-RF-001` declaró el acto, no su
  falla—. Desde la máquina del reembolso su productor es **`RF5`**, la llegada de un `refund` de una
  revocación a `FAILED` (cap. 03 (billing) §6.1), que la fila declara como *«su productor»*. Lo que
  este capítulo no dice es con qué plantilla sale ese correo inmediato: es del catálogo del cap. 07
  §6, ~~que no tiene fila para él~~ **que desde BR tiene su fila, *«reembolso de revocación fallido»*, como el
  `COBRO_DUPLICADO`, *«cobro duplicado detectado»*; los dos los construye `B11`** (corte del MVP, owner 2026-10-02).
