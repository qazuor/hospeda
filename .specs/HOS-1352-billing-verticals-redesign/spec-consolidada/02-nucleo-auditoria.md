# 02 · Núcleo — auditoría y observabilidad

Parte del núcleo de la spec consolidada: qué es un evento auditable y qué guarda, la baja de cuenta
manual, el identificador de correlación, las reglas de la confirmación de las acciones
administrativas, la conciliación pendiente sin apagar el canal y los campos del §50. Es el texto
vigente del capítulo 08 del núcleo, sin tachados. **El catálogo de acciones administrativas (§3 de
la fuente) no está acá**: son los ítems `ACC:n` de [`02-nucleo.md`](02-nucleo.md#acc-1).

> **Nota N1, sobre la numeración de las acciones.** Las fuentes llaman *«acción 13»* o *«la
> decimotercera»* a moderar una ficha, que es [ACC:12](02-nucleo.md#acc-12) (`AUT-113`);
> [ACC:13](02-nucleo.md#acc-13), reembolsar, no tiene número en las fuentes; desde la 14 el número
> de las fuentes y el `ACC:n` coinciden; y la decimosexta, discontinuar una vertical, salió
> ([ACC:16](90-retirados.md#acc-16)). Ver
> `.specs/HOS-1352-billing-verticals-redesign/docs/37-fase-8-vuelta-3/D1-coherencia-del-conjunto.md:264`.

El §49 del PDR pide registrar *«eventos de dominio completos»* y no limitarse a logs técnicos. El
§50 lista los campos que todo log estructurado lleva. El §22.1 ordena qué pasa cada vez que el
sistema no puede decidir solo. Los tres dan por resuelto **quién lo genera, qué se guarda, y qué
pasa cuando eso ocurre mil veces seguidas**. Este capítulo cierra `M-ADMIN-01`, `M-AUDIT-01`,
`M-OBS-01`, `R-OBS-01` y `S-OBS-01`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/37-fase-8-vuelta-3/D1-coherencia-del-conjunto.md:264, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:18, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:20, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:24

## 1. Qué es un evento auditable · cierra `M-AUDIT-01`

El §49 no dice cuáles, y el §35.4 detalla los campos para **un** caso —*Free Forever*— y ninguno
más.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:29, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:31

### 1.1 El criterio

**Es auditable todo lo que cumple al menos una de las tres:**

1. **mueve dinero**: un cobro, un reembolso, un cambio de monto, una concesión que evita un
   cobro;
2. **cambia el acceso de alguien**: cualquier transición de las máquinas del capítulo 03, un
   grant, una cortesía, un cambio de plan;
3. **lo hace un administrador sobre la cuenta de otro**, aunque no mueva dinero ni cambie
   acceso.

La tercera no es redundante: un admin **mirando** datos de un cliente no cambia nada y tiene que
quedar registrado igual.

**Y se registran además los actos del dueño sobre una ficha que no son transiciones** —crearla,
editarla, exportarla—, aunque no cumplan ninguna de las tres: son el hecho 1 del reloj de
inactividad (cap. 01 §1.2 del núcleo), que se lee de este registro. Sin esto el hecho 1 no tenía
fuente para editar ni exportar (owner 2026-09-25; FASE 9 completa, decisión 8e, `F-8CA3-004`).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:34, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:36, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:38, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:40, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:42, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:45, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:48

### 1.2 Los campos mínimos

| campo | por qué |
|---|---|
| **qué pasó** | el tipo de evento, de un catálogo cerrado |
| **sobre qué** | entidad y su id |
| **quién** | actor **y tipo de actor**: la persona dueña, un administrador, un job, o el proveedor |
| **cuándo** | instante en UTC (outbox §3, [`02-nucleo-outbox.md`](02-nucleo-outbox.md)) |
| **correlación** | §2 de este capítulo |
| **qué cambió** | los campos que cambiaron, con su valor anterior y el nuevo, **no una copia del contenido**. **En los campos de contenido de una ficha —textos, fotos, FAQ, horarios, la misma lista que el día 180 borra (`V/02` §4.1)— el evento guarda sólo el NOMBRE del campo, nunca sus valores**: el valor anterior y el nuevo quedan para los campos que no son contenido —estado, plan, monto, fechas— (owner 2026-09-25; FASE 9 completa, decisión 8e, `F-8CA3-004`) |
| **por qué** | el motivo, cuando la operación lo admite: una cortesía, una cancelación, un reembolso |

**El campo *«qué cambió»* es una decisión de modelo con consecuencia directa**, ya tomada en el
capítulo 02: si la auditoría guardara copias del contenido, el hard delete del §25 no eliminaría
nada y la promesa del §25 sería decorativa. **Y un delta de un campo de texto ES una copia del
contenido**, dos veces: *«valor anterior y nuevo»* y *«no una copia»* no se podían cumplir juntos
sobre una descripción. Cinco ediciones dejaban diez versiones del texto en un registro sin
`delete` que la retención ya no toca (§1.3), y el día 180 borraba la ficha y no el texto. Por eso
los campos de contenido guardan sólo su nombre: se pierde poder mostrar *«qué decía antes»*, que
no lo pide ningún capítulo (FASE 9 completa, 8e).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:53, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:57, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:59, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:62, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:63, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:65, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:67

### 1.3 Es inmutable, y por eso sirve

**Append-only: sin `update` y sin `delete`, y nace sin `deleted_at`** (FASE 5, owner
2026-09-30, lote 4 E: un borrado suave es una escritura que ningún candado contra `delete` ve, y
eso vale para toda tabla de sólo agregar). Un registro que se puede editar no sirve para lo
que el PDR lo necesita: el §29 tiene que poder **demostrar** que se avisó un aumento con su
precio anterior, su precio nuevo y su fecha efectiva; y el §35.4 exige el registro del grant con
su firmante.

**La retención no escribe en este registro**: desde
[DEC-DATA-005](01-decisiones-vigentes.md#dec-data-005) (owner 2026-09-25) el día 180 sólo borra el
contenido de una ficha, y los datos personales **no se tocan, tampoco dentro de eventos o del
outbox**, así que el aviso de aumento que el §29 tiene que demostrar conserva su destinatario
(FASE 8 completa, `F-8CA3-009`). El borrado de la cuenta pedido por el propio usuario, que `V/02`
§4.2 regla 2 describe con *«lo personal se anonimiza con el resto»*, es un proceso que esa
decisión **no cubre**; si alcanza a este registro lo dice la vigesimocuarta
([ACC:24](02-nucleo.md#acc-24)) para la baja manual: **no lo alcanza** (revisión del owner, casos
vecinos, 2026-09-29, caso H-C). **La baja desde Mi Cuenta queda fuera de esta épica** (revisión
del owner, 2026-09-28, N7, `g1`, contra la recomendación, que era una baja mínima ahora): mientras
tanto la hace **soporte desde el panel, con una lista de pasos escrita** (revisión del owner, casos
vecinos, 2026-09-29, caso F-C), y **se corrige la FAQ** de la web, que hoy promete *«Eliminar
cuenta»* desde Mi Cuenta y el borrado en 30 días. Se implementa después de terminar HOS-1352:
[HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393).

**La lista de pasos se escribe antes del corte, y el orden es parte de ella** (revisión del owner,
casos vecinos, 2026-09-29, caso 7): desde el corte, un pedido de baja se atiende sobre el sistema
nuevo. Tres pasos, en este orden:

1. **La baja del cobro**: toda suscripción viva de la cuenta, principal o de complemento, termina
   por los caminos que ya existen, con su cancelación releída en el proveedor. **Alcanza con que
   ninguna pueda cobrar** (verificación corta, 2026-09-29, lote M-G): la que estaba `ACTIVE` queda
   en `CANCEL_SCHEDULED` por [S11](04-catalogos.md#trans-b-s11), **con la cancelación mandada al
   proveedor en el acto**, y termina sola por [S12](04-catalogos.md#trans-b-s12) en su fecha de
   fin, sobre la cuenta ya dada de baja; el paso 3 no la espera **una vez que una relectura vio su
   preapproval `cancelled`, y la espera mientras no, que es la ventana en que el barrido reintenta
   la cancelación, hasta 3 días** (FASE 9 vuelta 3, owner 2026-09-30, lote D: `puedeCobrarle`
   contesta sobre la cancelación confirmada por Mercado Pago, `12-contrato…` §4.1). **Y sobre una
   suscripción cuyo preapproval canceló el proveedor tras un cobro rechazado, el paso 3 espera
   hasta que pase el plazo 16 ([PLAZO:16](02-nucleo.md#plazo-16)), 7 días desde la primera
   relectura que lo vio `cancelled`**, porque el proveedor puede deshacer esa cancelación y el
   barrido la sigue releyendo ([EX-45](04-catalogos.md#mp-ex-45); FASE 9 vuelta 3, owner
   2026-09-30, lote AE). **Y no alcanza mientras una cancelación siga sin confirmar**: con la marca
   `CANCELACIÓN_SIN_CONFIRMAR` abierta el preapproval todavía puede cobrar, y el paso 3 la espera
   (verificación corta, 2026-09-29, lote N-C). Va primero porque una cuenta que se borra con una
   autorización viva sigue cobrando, y después no queda nadie a quien asentarle el cobro.
2. **[PB12](04-catalogos.md#trans-v-pb12) por cada ficha** de la cuenta (`V/03` §9). Va antes de
   la cuenta porque una ficha que se borra sin `PB12` no apaga su destaque hasta el barrido
   ([A6](04-catalogos.md#trans-b-a6), `B/03` §8), y porque `PB12` es el que borra el contenido,
   las fotos y el token del calendario. **Y, si la cuenta es de un Partner, se vacía su presencia**
   con la acción 25 ([ACC:25](02-nucleo.md#acc-25)): sus fotos, su logo, sus secciones y sus
   enlaces, en la base y en el almacenamiento externo (verificación corta, 2026-09-29, lote N-G).
   Era lo único del dueño que el *«todo»* del owner no alcanzaba: la baja del cobro le saca la
   clave de su página y la deja sin verse, pero guardada.
3. **La cuenta**, al final, cuando ya no le cuelga ni un cobro ni una ficha con contenido **ni una
   presencia de Partner con contenido** (verificación corta, 2026-09-29, lote N-G).

**Los tres pasos los hace soporte, a pedido del dueño y con motivo** (revisión del owner, casos
vecinos, 2026-09-29, caso F-C, contra la recomendación, que era que el dueño borrara sus fichas y
soporte hiciera el 1 y el 3; con el agregado del owner: *«que soporte pueda borrar todo»*). Soporte
es una persona del equipo con el permiso de cada acción en el panel, y cada paso es una acción del
catálogo: **el 1 es *«cancelar una suscripción»*** ([ACC:8](02-nucleo.md#acc-8)), que ya existía;
**el 2 es la vigesimotercera, *«borrar una ficha ajena a pedido de su dueño»***
([ACC:23](02-nucleo.md#acc-23)), que corre `PB12`, **y en un Partner también la vigesimoquinta,
*«vaciar la presencia de un Partner a pedido de su dueño»*** ([ACC:25](02-nucleo.md#acc-25))
(verificación corta, 2026-09-29, lote N-G); y **el 3 es la vigesimocuarta, *«dar de baja una
cuenta a pedido de su dueño»*** ([ACC:24](02-nucleo.md#acc-24)) (el nombre, revisión del owner,
casos vecinos, 2026-09-29, caso I-C), que se rechaza mientras **`puedeCobrarle` conteste `sí`**
(`12-contrato…` §4.1: una suscripción que todavía puede cobrar, **incluida una `CANCEL_SCHEDULED`
o una terminal cuya cancelación nuestra ninguna relectura confirmó todavía** —FASE 9 vuelta 3,
owner 2026-09-30, lote D—, **o una terminal que canceló el proveedor tras un rechazo, dentro del
plazo 16** —lote AE—, o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta; verificación corta,
2026-09-29, lotes M-F, M-G y N-C) o le cuelgue una ficha fuera de `PURGED` **o una presencia de
Partner con contenido** (verificación corta, 2026-09-29, lote N-G). Qué escribe dar de baja la
cuenta está en su acción: la fila de la cuenta no se borra, se seudonimiza (lo personal
reemplazado, las sesiones cerradas y sin acceso), y este registro y los cobros no se tocan
(revisión del owner, casos vecinos, 2026-09-29, caso I-C); **tampoco los datos de facturación de la
cuenta, que se conservan tal cual porque la ley obliga a guardar los comprobantes** (revisión del
owner, casos vecinos, 2026-09-29, caso J-C), **y viven en ellos: cada comprobante copia el nombre y
el correo de quien paga al emitirse** (`B/02` §2.3; revisión del owner, casos vecinos, 2026-09-29,
caso K-A).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:74, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:76, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:85, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:91, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:92, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:99, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:103, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:104, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:107, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:109, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:110, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:112, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:115, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:118, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:119

## 2. El identificador de correlación · cierra `M-OBS-01`

El §50 lo pide entre los campos obligatorios. No dice **quién lo genera** ni **cómo viaja** desde
el click de una persona hasta un webhook que llega tres días después, y sin esa cadena los campos
están presentes pero no se pueden unir, que es para lo que servían.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:123, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:125

### 2.1 Se genera en el borde, una vez por intención

**Lo genera la primera request que inicia una intención de negocio**, no cada capa. Si no viene
del cliente, se acuña ahí; si viene, se respeta.

Una intención es *«me quiero suscribir»*, no *«guardá esta fila»*. Todo lo que se desprenda de
esa intención lleva el mismo identificador.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:129, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:131, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:134

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

Se eligió así por dos razones medidas: el `external_reference` **es reescribible**
([EX-19](04-catalogos.md#mp-ex-19)) y es la **vía de reparación** de un vínculo roto, así que
cargarlo con dos significados lo vuelve frágil; y el buscador del proveedor **lo ignora**
([RC-1](04-catalogos.md#mp-rc-1)), así que no sirve para encontrar nada de todas formas.

**Cuando la cadena se corta** —un webhook de un preapproval que no conocemos— eso **es** la
detección de una huérfana ([DEC-CONC-002](01-decisiones-vigentes.md#dec-conc-002)), y arranca su
propia correlación anotando que no tiene padre.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:137, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:139, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:146, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:150, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:155, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:160

### 2.3 Los jobs tienen dos

Un job lleva **la correlación de su corrida** y, por cada ítem que procesa, **la correlación de
la entidad**. Sin la primera no se puede leer una corrida completa; sin la segunda no se puede
seguir a un cliente a través de un job.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:164, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:166

### 2.4 Quién lo construye: `U2`

(FASE 5, owner 2026-09-30, lote 2 B.) **La correlación acuñada en el borde, su campo en el evento y
en la fila del outbox, y las dos de cada job —la de su corrida y la de cada entidad— las construye
[U2](10-corte/U2.md#pieza-u2)**, la misma unidad que construye el outbox
([`02-nucleo-outbox.md`](02-nucleo-outbox.md), §1.4), porque la correlación viaja a su fila. Hoy
el contexto de una request lleva sólo su id y ninguna corrida de job lleva uno propio. **El reloj
con que un job lee la hora no es de `U2`**: sigue siendo la interfaz que construye
[B1](10-corte/B1.md#pieza-b1) (`12-contrato…` §7.1, punto 5).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:170, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:172, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:176

## 3. Dos reglas sobre la confirmación de las acciones administrativas

Las acciones del catálogo (`ACC:n`, en [`02-nucleo.md`](02-nucleo.md#acc-1)) llevan confirmación
explícita si son destructivas o mueven dinero. Dos reglas sobre esa confirmación:

1. **La confirmación dice qué va a pasar, no pregunta si está seguro.**
   [DEC-GRANT-001](01-decisiones-vigentes.md#dec-grant-001) lo pide textualmente para la
   revocación de un grant: *«la UI del admin debe decirlo explícitamente al revocar, o alguien lo
   va a hacer sin entender que está cortando el servicio de alguien»*.

   **Las tres escrituras sobre un grant ([ACC:2](02-nucleo.md#acc-2)) tienen cada una su frase, y
   ninguna se deduce de la otra**: otorgar y anclar **cancelan la suscripción que el beneficiario
   paga** en cada vertical alcanzada ([S13](04-catalogos.md#trans-b-s13)), **terminan la cortesía
   que tuviera vigente ahí** y **cierran el saldo de una cortesía DIFERIDA que estuviera esperando
   ahí** —meses que `SUPER_ADMIN` firmó y que todavía no se entregaron, así que la frase los nombra
   con su número (`B/14` §4.3, `B/02` §2.4)—. Y el estado en el proveedor pasa a `cancelled`, así
   que el cliente recibe el correo del proveedor por su cuenta ([EX-3](04-catalogos.md#mp-ex-3));
   revocar corta el servicio. Quien ancla una vertical tiene que leer, antes de firmar, **qué cobro
   deja de ocurrir**, porque ése es el acto que hoy nadie ve: el grant ya existía y la pantalla
   parece decir que sólo se agrega algo.

   **Y con `includesAddons: true` los cobros que dejan de ocurrir son más de uno**: otorgar y
   anclar **también cancelan la suscripción de complemento de cada addon compatible** y lo pasan
   a costo $0 ([S20](04-catalogos.md#trans-b-s20), `B/16` §3.4). La frase tiene que
   **enumerarlos**, no resumirlos, porque cada uno es un débito distinto que desaparece y porque
   **el beneficiario va a recibir un correo del proveedor por cada preapproval cancelado**
   (`EX-3`): quien firma tiene que saber cuántos son antes de que los mande.

   **Y la frase de revocar dice que esos addons se apagan y NO vuelven solos.** Es la mitad que
   duele de la decisión del owner: el beneficiario **venía pagando** esos addons, se los pasamos
   a gratis, y al revocar **no se reanuda el débito viejo** —cancelar en el proveedor es
   irreversible ([PA-5](04-catalogos.md#mp-pa-5)) y `DEC-GRANT-001` ya lo declara— **ni se
   compensa**. Si los quiere de nuevo, vuelve a suscribirse. Sin esta frase, *«qué addons corta»*
   (`B/19` §4 fila 13) se lee como que corta regalos, cuando la mitad puede ser lo que la persona
   pagaba.

   **Y revocar DEJA MARCA en el instrumento, que es lo que vuelve auditable el acto más grave del
   catálogo.** El §35.4 exige auditar el grant, y hasta la FASE 9-bis-4 el registro de auditoría
   era **lo único** que sabía que hubo una revocación: la fila del grant no declaraba ni estado ni
   revocación, así que ningún predicado del diseño podía preguntar después si la concesión seguía
   en pie. Ahora la revocación escribe `permanent_grant.revocado_en`, quién la firmó **y el
   MOTIVO, en texto libre** (`B/02` §2.4, [DEC-GRANT-008](01-decisiones-vigentes.md#dec-grant-008)).
   **Las anclas no se borran**: dejan de ser anclas vivas todas a la vez. Y la regla que el catálogo
   ya imponía sigue igual —*«lo que no se puede es ejecutar una escritura que no esté nombrada en
   ninguna fila»*—: la escritura es de la acción del grant y no agrega una acción más (la que las
   fuentes llaman decimotercera es la de moderar, [ACC:12](02-nucleo.md#acc-12); la decimocuarta,
   la de asentar, [ACC:14](02-nucleo.md#acc-14); **y la decimoquinta, la de editar el contenido de
   una ficha ajena**, [ACC:15](02-nucleo.md#acc-15) (`G5-2`), que son otras acciones; la
   decimosexta salió con la revisión del owner, 2026-09-28, C8).

   **El motivo es la mitad que la auditoría necesitaba y el registro de auditoría no da.** Ese
   registro dice **qué acto ocurrió, cuándo y quién lo hizo**; lo que no dice —ni puede— es
   **por qué**, y es lo primero que se pregunta seis meses después, empezando por el beneficiario
   al que le cortaron el servicio sin que hiciera nada. **Libre y no de lista cerrada**: el
   volumen es bajo —son concesiones firmadas a mano por `SUPER_ADMIN`— así que no genera basura, y
   una lista cerrada hay que mantenerla mientras el `otro` se come el resto (`DEC-GRANT-008`).

   **Y la frase de revocar dice además que el trial ya está consumido y no vuelve**
   ([DEC-TRIAL-009](01-decisiones-vigentes.md#dec-trial-009)). Recibir el grant consume el trial de
   esa vertical —[T2](04-catalogos.md#trans-v-t2) o [T6](04-catalogos.md#trans-v-t6), según
   estuviera corriendo o no— y **la revocación no lo devuelve**: el beneficiario queda sin grant,
   sin suscripción y sin trial, así que si quiere seguir paga desde el primer día. Es el dato que
   convierte *«le corto el servicio»* en *«le corto el servicio y además no tiene prueba
   gratuita»*, y sin él quien firma cree que está haciendo algo menos grave de lo que hace.
2. **`SUPER_ADMIN` firma toda concesión gratuita**, temporal o permanente
   ([DEC-GRANT-002](01-decisiones-vigentes.md#dec-grant-002)), y eso tiene un costo operativo
   declarado: compensar unos días a alguien pasa a requerirlo. **El riesgo concreto es que se
   termine compartiendo la cuenta**, que es peor que el riesgo que se evita. Si aparece, se
   resuelve con un permiso acotado y no con una cuenta compartida.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:319, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:321, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:325, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:335, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:342, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:349, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:358, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:363, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:370, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:376

## 4. La conciliación pendiente, sin apagar el canal · cierra `R-OBS-01` y `S-OBS-01`

El §22.1 ordena, **siempre** que el sistema no pueda decidir solo: registrar evento crítico,
generar información suficiente para investigar, **enviar correo a `SUPER_ADMIN`**, mostrar alerta
en Admin si corresponde, y evitar decisiones destructivas automáticas.

**El problema es el tercero.** Un incidente de webhooks genera cientos de eventos idénticos: con
un correo por evento, **el canal deja de leerse justo cuando importa**. Y el requisito real lo
enuncia el propio §22.1 al cerrar: *«que `SUPER_ADMIN` esté al tanto y pueda intervenir»*.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:383, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:385, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:389

### 4.1 Lo que se hace

| | |
|---|---|
| **canal primario** | el **listado accionable en Admin**, que el §22.1 ya contempla. Cada entrada trae lo necesario para decidir sin reconstruir el diagnóstico, **incluido el estado real de la fila**, que la marca ya no pisa |
| **el correo** | **agregado**, con límite de frecuencia: un resumen cada N minutos con el conteo por tipo y los sujetos afectados, en vez de uno por evento |
| **la excepción** | un evento **único y grave** —un doble cobro real detectado **(la marca con motivo `COBRO_DUPLICADO`, cap. 02 (billing) §2.5, motivo 20, [MOT:20](04-catalogos.md#mot-20))**, un reembolso que falló sobre una revocación **(un `refund` de [DEC-RF-001](01-decisiones-vigentes.md#dec-rf-001) que llega a `FAILED` por [RF5](04-catalogos.md#trans-b-rf5), cap. 03 (billing) §6.1)**— manda **su propio correo**, sin esperar la ventana (FASE 9 completa, `DB-4`; el `FAILED`, decisión 5a) |
| **la agrupación** | por **tipo + sujeto**. Cientos de eventos de un mismo incidente colapsan en una línea con su conteo |
| **lo que nunca se agrupa** | el **registro**. El evento crítico se escribe uno por uno, siempre. Lo que se agrupa es el aviso |

**Y un tipo del resumen que no nace de una marca: la vuelta anticipada que regaló días** (owner
2026-09-26, `G5-3`; FASE 9 vuelta 1, `F-8V1B1-001`; el predicado, FASE 9 vuelta 1, `N-2`). La
vuelta anticipada de una pausa sigue libre —*«volver cuando quiera»*, §26.2 del PDR a la letra—, y
eso deja que **toda pausa que cruza una fecha de cobro y termina fuera del aniversario regale días,
dure lo que dure**: el proveedor saltea el cobro mientras la fila está `paused` y, al volver, cobra
normal en el ciclo siguiente ([PS-2](04-catalogos.md#mp-ps-2), [PS-5](04-catalogos.md#mp-ps-5),
[PS-6](04-catalogos.md#mp-ps-6)). **El regalo no depende de la duración sino de la aritmética**: lo
pagado y no usado al pausar —del inicio de la pausa a la primera fecha salteada— no compensa lo
usado sin pagar al volver —de la vuelta a la próxima fecha de cobro—. Juan cobra el día 1, pausa el
31/oct por tres meses y vuelve el 2/dic: pierde un día y usa treinta sin pagar, **29 días de regalo
con una pausa de 32 días**, que el predicado viejo (*«a menos de un ciclo de su inicio»*) no
listaba. Nuestro estado y el del proveedor coinciden en cada paso, así que **ninguna comparación
del barrido lo ve**, y por eso tiene su propia línea. **El barrido diario (`B/09` §2.3) lista en el
resumen las pausas terminadas por [S10](04-catalogos.md#trans-b-s10) que cruzaron al menos una
fecha de cobro salteada y cuyo regalo neto es positivo** —(próxima fecha de cobro después de
`fin_real` − `fin_real`) − (primera fecha salteada − inicio de la pausa), en días—, con el sujeto,
las dos fechas, el ciclo salteado **y los días de regalo**; se lee de la `subscription_pause`
(`B/02` §2.2) y de la fecha del próximo cobro, sin llamar al proveedor. **No abre marca ni corta
nada**: es un detector, no un control —el costo aceptado se mide, no se impide— (`B/03` y `B/12`,
*«lo que este capítulo NO cierra»*).

**Y otro tipo del resumen que tampoco nace de una marca: las acciones administrativas que mueven
plata** (owner 2026-09-26, `Y-2`; FASE 9 vuelta 1, `N-1` de `25-verificado-G5`). La regla 5 de
`V/17` §3.2 —una acción administrativa nunca tiene `actor = sujeto`,
[DEC-AUTH-002](01-decisiones-vigentes.md#dec-auth-002)— compara **cuentas**, no personas: una
persona con una cuenta de staff y otra de cliente se opera lo suyo desde la primera y la regla se
cumple. **El resumen lista cada acción del catálogo cuya columna *«¿destructiva o mueve dinero?»*
dice que mueve dinero** —registrar un pago manual ([ACC:3](02-nucleo.md#acc-3)), una cortesía
([ACC:1](02-nucleo.md#acc-1)), un grant y su revocación ([ACC:2](02-nucleo.md#acc-2)), un reembolso
([ACC:13](02-nucleo.md#acc-13)), asentar un cobro o una devolución de afuera
([ACC:14](02-nucleo.md#acc-14)), y las demás de esa columna—, **con su actor y su sujeto**, leídos
del registro de auditoría del §1 sin llamar al proveedor, para que el owner la revise. **No abre
marca ni bloquea nada**, y no distingue a la misma persona detrás de dos cuentas: la revisión es
humana. **La confirmación por una segunda persona entra cuando haya otra persona con el permiso**
(`V/17` §3.2, regla 5). (La acción 16 salió con la revisión del owner, 2026-09-28, C8.)

**Y un tercer tipo del resumen que no nace de una marca: el cobro por debajo del esperado**
(FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-f`; caso de `16-` §5). La comparación de
cobros del barrido (`B/09` §3) ya deriva, para cada registro aprobado que tenemos acreditado, el
monto esperado del período que cubre, y el motivo 24 ([MOT:24](04-catalogos.md#mot-24)) mira sólo
el cobro de más. **El de menos aparece cuando una mutación que sube el monto cae entre la creación
del registro del ciclo y su cobro**, y el registro cobra el viejo (un aumento de
[DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002), o [S30](04-catalogos.md#trans-b-s30)
restaurando el precio al agotarse una promo; si pasa o no es [EX-47](04-catalogos.md#mp-ex-47)), y
en un aumento alcanza a toda la cartera de la vertical en la misma fecha. **El barrido diario lista
en el resumen cada cobro por debajo del monto esperado de su período, con el sujeto y la
diferencia**; se lee de lo que la comparación ya calcula, sin llamar al proveedor. **No abre marca,
no cobra la diferencia y no mueve el conteo de motivos** de `B/02` §2.5: es plata de Hospeda, nadie
pagó de más, y el costo aceptado se mide como el de la pausa regalada.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:393, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:397, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:398, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:399, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:400, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:401, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:403, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:407, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:416, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:426, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:430, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:439, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:441, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:448

### 4.2 Y esto es un apartamiento del §22.1, registrado como `DEC-OBS-001`

El §22.1 dice *«enviar email a `SUPER_ADMIN`»* sin condición, y esto manda un correo agregado en
vez de uno por evento: **se cumple el objetivo que el propio §22.1 enuncia al cerrar y no su
letra**. Queda registrado en el decision log como
[DEC-OBS-001](01-decisiones-vigentes.md#dec-obs-001) (2026-09-17, aprobado por el owner) y es el
**cuarto** apartamiento del programa. Los otros cuatro puntos del §22.1 se cumplen literalmente.

**La ventana de agregación es un riesgo declarado**: entre el primer evento y el resumen pasan
hasta `N` minutos. Para lo que no puede esperar está la excepción, y **qué entra en esa excepción
es una lista cerrada**: **la marca con motivo `COBRO_DUPLICADO` (cap. 02 (billing) §2.5, motivo
20), y un `refund` de una revocación que llega a `FAILED`** (FASE 9 completa, `DB-4` y decisión
5a).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:454, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:456, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:461, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:464

### 4.3 La información suficiente, en concreto

El §22.1 pide *«generar información suficiente para investigar»*. Cada entrada lleva:

- **cuál de las cuatro condiciones del cap. 05 §3 falló**, cuando el caso es un pago tardío: sin
  eso, quien lo mire tiene que rehacer el diagnóstico entero;
- **el monto a devolver, el pago que lo origina y POR QUÉ PUERTA entró ese pago**, cuando el caso
  es el **reembolso por confirmar** de las ramas 1, 5 y 6 del cap. 12 §5.3 (épica de billing). Esta
  entrada es de otra forma que las demás y conviene decirlo: **no hay nada que diagnosticar** —el
  desenlace lo decidió el diseño y [DEC-RF-002](01-decisiones-vigentes.md#dec-rf-002) sólo puso la
  confirmación humana en el medio—, así que lo que la persona necesita no es el conflicto entre dos
  estados sino **qué devolver, a quién y de qué cobro**. **La puerta es parte de eso y no es un
  dato de color**: [S19](04-catalogos.md#trans-b-s19) retiene el pago del período impago entre por
  la puerta que entre, y un `payment` se devuelve **por la API del proveedor** mientras que un
  `manual_payment` se devuelve **a mano, por donde entró** (cap. 03 §3.2 y §7, épica de billing).
  Quien confirma no puede elegir el camino si la entrada no se lo dice. La lista de arriba
  contemplaba el pago tardío que **falla**; éste es el que **sale bien** y deja plata por devolver.
  **Y esos tres datos no viven sólo acá**: la marca los **guarda** —el motivo
  `REEMBOLSO_POR_CONFIRMAR` y el pago colgado de ella, cap. 02 (billing) §2.2 y §2.5—, que es lo
  que los pone también en el **listado accionable**, el canal primario de `DEC-OBS-001`. Mientras
  fueron sólo campos de un evento, el canal que la persona mira de verdad recibía **una fila
  `CANCELLED` marcada e indistinguible de las otras veintitrés marcas** (veinticuatro motivos desde
  la FASE 9 vuelta 2, `R4` y `R20`, cap. 02 (billing) §2.5);
- **los dos estados en conflicto**: el nuestro y el del proveedor, con la fecha de cada lectura;
- **la correlación**, para poder seguir la cadena hacia atrás;
- **qué se intentó y qué se frenó**, porque el §22.1 prohíbe decisiones destructivas automáticas
  y hay que saber qué quedó sin hacer.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:467, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:469, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:471, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:473, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:484, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:488, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:490, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:491, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:492

## 5. Los campos del §50, y el uno que falta

El §50 pide como mínimo: `userId`, vertical, `subscriptionId`, `paymentId`, identificadores del
proveedor, id del webhook, id de request, id de correlación, listing y addon.

**Falta uno, y es el que hace legible un incidente**: el **tipo de actor** (§1.2). Los diez
campos del §50 dicen *sobre qué* pasó algo; ninguno dice *quién* lo hizo, y la diferencia entre
un cambio que pidió el cliente, uno que hizo un admin y uno que ejecutó un job es lo primero que
alguien necesita saber cuando algo salió mal.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:497, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:499, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:502

## 6. Lo que este capítulo NO cierra

- **Qué hace el reconciliador para detectar**, y con qué frecuencia, es el capítulo 09 (épica de
  billing).
- **Las superficies del Admin** —cómo se ven estas acciones y este listado— son del capítulo 19.
- **El reembolso que falla sobre una revocación ya tiene productor** (cerrado por la decisión 5a;
  FASE 8 completa, `F-8CB3-016`; FASE 9 completa, `DB-4`). La excepción del §4.1 lo nombraba y
  ninguna comprobación lo producía —**causa**: `DEC-RF-001` declaró el acto, no su falla—. Desde la
  máquina del reembolso su productor es **[RF5](04-catalogos.md#trans-b-rf5)**, la llegada de un
  `refund` de una revocación a `FAILED` (cap. 03 (billing) §6.1), que la fila declara como *«su
  productor»*. Lo que este capítulo no dice es con qué plantilla sale ese correo inmediato:
  es del catálogo de correos ([`02-nucleo-outbox.md`](02-nucleo-outbox.md), §6), que desde BR tiene su
  fila, *«reembolso de revocación fallido»*, como el `COBRO_DUPLICADO`, *«cobro duplicado detectado»*;
  los dos los construye [B11](10-corte/B11.md#pieza-b11) (corte del MVP, owner 2026-10-02,
  [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:509, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:511, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:512, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:513, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:515, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:518, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:519
