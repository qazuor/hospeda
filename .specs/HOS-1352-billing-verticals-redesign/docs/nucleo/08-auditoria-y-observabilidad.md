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

**Append-only: sin `update` y sin `delete`.** Un registro que se puede editar no sirve para lo
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
cubre**; si alcanza a este registro, y con qué escritura, no lo dice ningún capítulo.

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

---

## 3. El catálogo de acciones administrativas · cierra `M-ADMIN-01`

El §48 enumera veintiuna cosas que el admin debe poder **inspeccionar** y **ninguna que pueda
hacer** — aunque el resto del PDR se las asigna.

**Cada acción lleva tres cosas: permiso propio, registro de auditoría, y confirmación explícita
si es destructiva o mueve dinero.**

| acción | de dónde sale | ¿destructiva o mueve dinero? |
|---|---|---|
| otorgar o revocar una **cortesía temporal** — **en meses enteros y sólo sobre un plan mensual**; sobre ~~un anual~~ **uno no mensual —trimestral, semestral o anual—** no está disponible (FASE 8 completa, `F-8CB1-001`; cap. 14 (billing) §4.7; *«anual»* donde la regla dice *«no mensual»*, corregido en la FASE 9 completa, contradicción 1 de `R4` del informe `03`) | §34, `DEC-GRANT-002`, `DEC-GRANT-003` impl. 6 | **sí**: revocar deja al cliente sin la cortesía que le quedaba. **Re-emitir una cortesía diferida NO es una fila de esta tabla**: lo hace `S9` como efecto, con la firma original, y va en la tabla del enrutado de más abajo — **y CERRAR su saldo tampoco**, que es el efecto opuesto y lo hace `S3` (`DEC-GRANT-011`) |
| otorgar, **anclarle una vertical nueva**, o revocar un **grant permanente** | §35, §35.4, `12-contrato…` §2.8 | **sí**, y la más grave: revocar deja al cliente **sin grant y sin suscripción**, o sea sin servicio, hasta que autorice un débito nuevo (`DEC-GRANT-001`). **Anclar también mueve dinero**: concede servicio gratuito permanente en una vertical nueva y **cancela la suscripción que el beneficiario pagaba ahí** (`S13`, `B/03` §3.2) — **y, con `includesAddons: true`, la de cada addon compatible que venía pagando** (`S20`, `B/16` §3.4) |
| registrar un **pago manual** | §30 | **sí** |
| confirmar que **no se pagó** | §30 | **sí**: lleva a `SUSPENDED` sin esperar el reloj |
| aprobar o rechazar una **postulación de Partner** | §17.3 | no |
| configurar el **plan y el método de pago** de un Partner | §17.3 | sí |
| **levantar la marca `requiere_conciliación`** | §22.1 | según el caso — **y el caso lo dice el `motivo` de la marca**, que desde la FASE 9-bis-4 es una columna (cap. 02 (billing) §2.5). Se levanta **una marca, no la fila**: son ~~**quince**~~ ~~**dieciséis**~~ ~~**diecinueve**~~ ~~**veinte**~~ **veintidós** motivos (el 16 desde `F-8CB1-013`, y el 17, el 18 y el 19 desde `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`, FASE 8 completa, owner 2026-09-25; el 20 desde la pendiente 6 —el 21 y el 22 desde la FASE 9 completa (`B/02` §2.5: `COBRO_DEL_PERÍODO_SIN_RESOLVER`, decisión 3d, y `PAUSA_NO_APLICADA`, `F-8CB2-003`)—) y ~~**seis**~~ **siete** tienen una confirmación de reembolso encima — **y los ~~seis~~ siete se leen en el motivo, sin mirar nada más**, desde que `DEC-RF-006` partió en dos el que `DEC-RF-004` había dejado dependiendo del disparador |
| **cancelar** una suscripción | §24 | **sí**, e irreversible en el proveedor (`PA-5`) |
| **pausar o reanudar** | §26 | sí |
| **cambiar de plan** a un cliente | §27, §28 | sí |
| **extender un trial** | §32 | no |
| **moderar una ficha** o **levantar la moderación** —`PB10` y `PB11`, `V/03` §9—, **con motivo** en el campo *«por qué»* del §1.2 — **y lo mismo sobre la presencia de un Partner**: escribe su bit de moderación (`V/18` §1.6; owner 2026-09-25, FASE 9 completa, decisión 7c) | FASE 8 completa, `F-8CA2-004`, owner 2026-09-25 | **no mueve dinero ni borra**: la ficha pasa a `MODERATED` y su contenido se conserva —**y desde la FASE 9 completa levantar la moderación reinicia el reloj de inactividad** (el hecho 6 del cap. 01 §1.2, decisión 5b), así que la frase es verdadera también después: antes, `PB11` → `PB5` → `PB9` borraba en días (`K-6`)—. **Si lleva confirmación explícita no lo dice la decisión**, y queda declarado con su causa (`DEC-METH-015`) |
| **reembolsar** | `DEC-RF-001` · `DEC-RF-002` | **sí**, **sin excepción**: `DEC-RF-002` resolvió el único caso que el diseño tenía candidato a excepción —el reembolso del pago pendiente al cerrar una sucesión— **a favor de la confirmación**. No hay ninguna operación automática sobre dinero. **Confirmar es la transición `REQUESTED → CONFIRMED` del reembolso, `RF2`** (cap. 01 §2.2, cap. 03 (billing) §6.1; FASE 9 completa, 5a) |
| **asentar un cobro o una devolución que ya ocurrió fuera de nuestro flujo** ✚ —el cobro del motivo 19 (`COBRO_SIN_REGISTRAR`): crear la fila de `payment` en `PENDING` con el id del registro y correr `P1` sobre ella; la devolución del motivo 18 (`REEMBOLSO_FUERA_DEL_FLUJO`), la de un `manual_payment` o la del cobro más viejo que el plazo del proveedor: asentar el `refund` por **`RF4`**, que nace en `EXECUTED` con el comprobante de la transferencia (cap. 03 (billing) §6.1) | motivos 18 y 19 del cap. 02 (billing) §2.5, `F-8CB1-015`; owner 2026-09-25, FASE 9 completa, decisión 5a | **sí**: registra plata que ya se movió y lo que de eso se desprende —el comprobante, `covered_period`, el cierre del reembolso—. Sin esta fila las dos marcas mandaban a una persona a *«asentar»* con un acto que la tabla no nombraba, y *«lo que no se puede es ejecutar una escritura que no esté nombrada en ninguna fila»* (abajo) |

~~**La tabla tiene DOCE filas**~~ ~~**La tabla tiene TRECE filas** —la decimotercera, moderar una
ficha, desde la FASE 8 completa (`F-8CA2-004`, owner 2026-09-25)—~~ **La tabla tiene CATORCE filas**
—la decimotercera, moderar una ficha, desde la FASE 8 completa (`F-8CA2-004`, owner 2026-09-25), y
la decimocuarta, asentar un cobro o una devolución hecha por fuera, desde la FASE 9 completa
(decisión 5a; recontadas sobre la tabla)— **y cada fila es UNA acción, aunque varias nombren más de una escritura.**
*«Otorgar o revocar»*, *«pausar o reanudar»*, *«aprobar o rechazar»*, ~~y ahora~~ *«otorgar, anclar o
revocar»*, *«moderar o levantar la moderación»* —**sobre una ficha o sobre la presencia de un Partner,
que es la misma acción con el mismo permiso** (7c)— **y *«asentar un cobro o una devolución»*** son la misma acción sobre el mismo instrumento, con **un** permiso, y por eso las ~~cinco~~
líneas que cuantifican sobre esta tabla —`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 **y su ⚠️, §3.5** y `B/19` §6— ~~siguen
diciendo **doce** y siguen siendo exactas~~ ~~**dicen trece desde la misma pasada**~~ **dicen catorce desde la FASE 9 completa** (las de `V/17`; la de `B/19` §6 es de la otra épica). **Lo que no se puede es ejecutar una escritura que no
esté nombrada en ninguna fila**: una escritura sin fila no tiene permiso que pedir, no es capacidad
del actor —así que sus pasos 5-7 caen sobre el sujeto y la vuelven inejecutable— y **no le está
prohibida a un actor de sistema**, que son las tres cosas que esta tabla reparte. Por eso anclar
una vertical a un grant entra **acá** y no sólo en la prosa del contrato que lo declaró.

**Y lo que le pone un caso ADELANTE a esa persona no es una fila de esta tabla: es un efecto de
transición, así que ~~siguen siendo doce~~ no suma filas.** La distinción hay que decirla porque `DEC-RF-002`
convirtió el reembolso del pago pendiente en **el desenlace de un camino que el sistema alcanza
solo** —antes era un acto que alguien pedía—, y una acción con permiso, auditoría y confirmación
declarados **no sirve de nada si nadie enruta el caso**. El enrutado existe y está en dos lugares
que no son éste:

| qué | quién lo hace | dónde |
|---|---|---|
| **abrir** la marca —con motivo **`REEMBOLSO_POR_CONFIRMAR`** y **el pago colgado de ella**— sobre la predecesora que lo retiene, un `payment` **o un `manual_payment`**, porque `S19` lo retiene entre por la puerta que entre | **`S18`**, como **quinto** efecto del cierre de la sucesión | `B/03` §3.2, `B/02` §2.5, `B/12` §5.3 **ramas 1, 5 y 6** |
| **abrir** la marca —con uno de **dos** motivos y el pago colgado— sobre la **suscripción de complemento** que muere con un período cobrado **sin terminar** | **`S21`**, en el mismo acto en que la lleva a `CANCELLED`. **Cuál de los dos escribe es lo que decide lo que el listado propone**, y desde `DEC-RF-006` eso es **el motivo** y no una rama: **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN_O_DISCONTINUACIÓN`** —devolver— si la instancia murió por la **revocación del grant** o **huérfana porque a su título lo mató la discontinuación de la vertical** —`S25`, `S27` o `S28`—, y **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`** —no devolver— en el resto. **Son cinco casos a distinguir y no cuatro**: los cuatro disparadores, con el de la orfandad partido en dos | `B/03` §3.2, `B/02` §2.5 **motivos 14 y 15**, `B/16` §4.4, `DEC-ADDON-004`, `DEC-RF-004`, `DEC-RF-006` |
| **hacer que esa marca escale** si nadie la resuelve | el **barrido diario**, que devuelve al recorrido las suscripciones terminales con la marca puesta o con un pago pendiente — **y como el reloj vive adentro del barrido, que el barrido corra lo vigila OTRO proceso**: si pasan 26 h sin una corrida completa, avisa (FASE 8 completa, `F-8CB3-007`) | `B/09` §3, salvedades 2 y 3; **`B/09` §7.1** |
| **re-emitir una cortesía DIFERIDA** sobre la fila que acaba de autorizar — **la sucesora** de un cambio de plan, o **el alta nueva** de quien perdió su plan porque se discontinuó su vertical | **`S9`**, por su segundo disparador y por el **tercero** — la firma sigue siendo la de `SUPER_ADMIN` que la otorgó, así que **no es una concesión nueva** y no suma fila, **por ninguno de los dos caminos** | `B/03` §3.2, `B/02` §2.4 y §2.6, `B/14` §4.4 y §4.6, `DEC-GRANT-007`, `DEC-GRANT-010` |
| **CERRAR el saldo de una cortesía diferida**, con `saldo_cerrado_en` y su `motivo_cierre` | **`S3`** cuando la sucesora abandonó el checkout, **`S13`** cuando un grant pasa a cubrir esa vertical, ~~y~~ **`S18`** o el **`S2`** del alta cuando el destino es de plan anual (FASE 8 completa), **y `S31` cuando la sucesora se corta porque un contracargo cortó a su predecesora** (FASE 8 completa, pendiente 8, owner 2026-09-25) — **son los ~~tres~~ cuatro valores de la enumeración cerrada** (`B/02` §2.4), y es cerrada y no el texto libre de `DEC-GRANT-008` porque **no hay una persona escribiendo el motivo** | `B/03` §3.2, `B/02` §2.4, `B/14` §4.3, `DEC-GRANT-011` |

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
   (la decimotercera que la tabla tiene hoy es la de moderar, y la decimocuarta la de asentar, que
   son otras acciones).

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
  `CANCELLED` marcada e indistinguible de las otras ~~catorce~~ ~~quince~~ ~~dieciocho~~ ~~diecinueve~~ veintiuna marcas** (~~diecinueve~~ ~~veinte~~ veintidós
  motivos desde la FASE 8 completa, pendiente 6, cap. 02 (billing) §2.5);
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
  §6, que no tiene fila para él.
