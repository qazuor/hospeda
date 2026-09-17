---
title: Master Spec 08 — Auditoría y observabilidad
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
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

### 1.2 Los campos mínimos

| campo | por qué |
|---|---|
| **qué pasó** | el tipo de evento, de un catálogo cerrado |
| **sobre qué** | entidad y su id |
| **quién** | actor **y tipo de actor**: la persona dueña, un administrador, un job, o el proveedor |
| **cuándo** | instante en UTC (cap. 07 §3) |
| **correlación** | §2 de este capítulo |
| **qué cambió** | los campos que cambiaron, con su valor anterior y el nuevo — **no una copia del contenido** |
| **por qué** | el motivo, cuando la operación lo admite: una cortesía, una cancelación, un reembolso |

**El último campo de la tabla es una decisión de modelo con consecuencia directa**, ya tomada en
el capítulo 02: si la auditoría guardara copias del contenido, el hard delete del §25 no
eliminaría nada y la promesa del §25 sería decorativa.

### 1.3 Es inmutable, y por eso sirve

**Append-only: sin `update` y sin `delete`.** Un registro que se puede editar no sirve para lo
que el PDR lo necesita: el §29 tiene que poder **demostrar** que se avisó un aumento con su
precio anterior, su precio nuevo y su fecha efectiva; y el §35.4 exige el registro del grant con
su firmante.

**La única escritura posterior admitida es la anonimización del día 180** (cap. 02 §4.1), que
reemplaza datos personales y **no toca el tipo, la fecha, la entidad ni la causa**. Eso conserva
el valor probatorio y cumple la retención.

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
| otorgar o revocar una **cortesía temporal** | §34, `DEC-GRANT-002` | **sí**: revocar deja al cliente sin la cortesía que le quedaba |
| otorgar o revocar un **grant permanente** | §35, §35.4 | **sí**, y la más grave: revocar deja al cliente **sin grant y sin suscripción**, o sea sin servicio, hasta que autorice un débito nuevo (`DEC-GRANT-001`) |
| registrar un **pago manual** | §30 | **sí** |
| confirmar que **no se pagó** | §30 | **sí**: lleva a `SUSPENDED` sin esperar el reloj |
| aprobar o rechazar una **postulación de Partner** | §17.3 | no |
| configurar el **plan y el método de pago** de un Partner | §17.3 | sí |
| resolver un **`RECONCILIATION_REQUIRED`** | §22.1 | según el caso |
| **cancelar** una suscripción | §24 | **sí**, e irreversible en el proveedor (`PA-5`) |
| **pausar o reanudar** | §26 | sí |
| **cambiar de plan** a un cliente | §27, §28 | sí |
| **extender un trial** | §32 | no |
| **reembolsar** | `DEC-RF-001` | **sí** |

### 3.1 Dos reglas sobre la confirmación

1. **La confirmación dice qué va a pasar, no pregunta si está seguro.** `DEC-GRANT-001` lo pide
   textualmente para la revocación de un grant — *«la UI del admin debe decirlo explícitamente al
   revocar, o alguien lo va a hacer sin entender que está cortando el servicio de alguien»*.
2. **`SUPER_ADMIN` firma toda concesión gratuita**, temporal o permanente (`DEC-GRANT-002`), y
   eso tiene un costo operativo declarado: compensar unos días a alguien pasa a requerirlo. **El
   riesgo concreto es que se termine compartiendo la cuenta**, que es peor que el riesgo que se
   evita. Si aparece, se resuelve con un permiso acotado y no con una cuenta compartida.

---

## 4. `RECONCILIATION_REQUIRED` sin apagar el canal · cierra `R-OBS-01` y `S-OBS-01`

El §22.1 ordena, **siempre** que el sistema llegue a ese estado: registrar evento crítico,
generar información suficiente para investigar, **enviar correo a `SUPER_ADMIN`**, mostrar alerta
en Admin si corresponde, y evitar decisiones destructivas automáticas.

**El problema es el tercero.** Un incidente de webhooks genera cientos de eventos idénticos: con
un correo por evento, **el canal deja de leerse justo cuando importa**. Y el requisito real lo
enuncia el propio §22.1 al cerrar: *«que `SUPER_ADMIN` esté al tanto y pueda intervenir»*.

### 4.1 Lo que se hace

| | |
|---|---|
| **canal primario** | el **listado accionable en Admin**, que el §22.1 ya contempla. Cada entrada trae lo necesario para decidir sin reconstruir el diagnóstico |
| **el correo** | **agregado**, con límite de frecuencia: un resumen cada N minutos con el conteo por tipo y los sujetos afectados, en vez de uno por evento |
| **la excepción** | un evento **único y grave** —un doble cobro real detectado, un reembolso que falló sobre una revocación— manda **su propio correo**, sin esperar la ventana |
| **la agrupación** | por **tipo + sujeto**. Cientos de eventos de un mismo incidente colapsan en una línea con su conteo |
| **lo que nunca se agrupa** | el **registro**. El evento crítico se escribe uno por uno, siempre. Lo que se agrupa es el aviso |

### 4.2 Y esto es un apartamiento del §22.1

> ⚠️ **PENDIENTE DEL OWNER.** El §22.1 dice *«enviar email a `SUPER_ADMIN`»* sin condición, y
> esto manda un correo agregado en vez de uno por evento. **Se cumple el objetivo que el propio
> §22.1 enuncia y no su letra**, así que corresponde registrarlo como decisión en
> `01-decision-log.md` — y ese documento no se toca sin el OK del owner. Hasta entonces, esta
> spec describe el comportamiento agregado y la entrada del log está pendiente.

### 4.3 La información suficiente, en concreto

El §22.1 pide *«generar información suficiente para investigar»*. Cada entrada lleva:

- **cuál de las cuatro condiciones del cap. 05 §3 falló**, cuando el caso es un pago tardío — sin
  eso, quien lo mire tiene que rehacer el diagnóstico entero;
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
