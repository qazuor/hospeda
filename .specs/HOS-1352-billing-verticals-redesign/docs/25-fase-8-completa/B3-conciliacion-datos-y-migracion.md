---
title: "FASE 8 completa · B3 — Conciliación, datos y migración (lado billing)"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · B3 — Conciliación, datos y migración (lado billing)

Ataqué la conciliación (`B/09`), el modelo de datos de billing (`B/02`), la migración (`B/21`), lo
legal (`B/22`), la estrategia de testing (`B/20`) y la observabilidad (`NUCLEO/08`), leídos contra
la matriz y contra lo que existe hoy en `apps/api/src/cron`, `packages/db/src/schemas/billing` y
`packages/billing`. El foco estuvo en cuatro cosas: divergencias que el barrido no ve o ve tarde,
lecturas que se apoyan en campos que la matriz mide como mentirosos, restricciones de base que no
sostienen lo que se promete, y lo que el corte deja vivo del lado del proveedor.

**Diecinueve hallazgos: 2 `CRITICA`, 5 `ALTA`, 8 `MEDIA`, 4 `BAJA`.** Las dos más graves en una
línea cada una. **El corte sólo cancela lo que nuestra base conoce**, y hoy existen preapprovals y
planes del proveedor que la base no conoce y que van a seguir cobrando después del corte. Y **el
grace de un pagador con tarjeta no llega a correr nunca**: `B/12` lo hace arrancar cuando el
proveedor deja de reintentar, y `GR-3` midió que eso pasa cuando vence la ventana del ciclo, o sea
después de que el proveedor ya pausó. Mientras tanto la persona conserva un ciclo entero de
servicio sin pagar.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila.

---

## CRITICA

### F-8CB3-001 — El corte sólo cancela lo que conoce nuestra base: planes del proveedor, checkouts sin vincular y sujetos de sonda siguen cobrando después, y el único camino que les queda es re-vincularlos

**Qué se rompe.** Después del corte le siguen llegando al sistema nuevo cobros de preapprovals que
no tienen ni lápida ni fila. Para un preapproval desconocido el único camino automático es
re-vincularlo, y el propio `B/21` describe qué sale de eso: *«pagó dos veces y el sistema registra
una»*. Si la re-vinculación no encuentra candidato, lo que queda es un cobro mensual sin servicio y
sin registro.

**El camino.**

1. El sistema de hoy vende por **planes del proveedor** (`preapproval_plan`). El checkout es un
   *share link* que se arma con el id del plan. Ese link no es de un solo uso: sirve mientras el
   plan esté activo en Mercado Pago.
2. El inventario del corte se midió **sólo sobre `billing_subscriptions`**. De ahí salen las tres
   con preapproval y, con ellas, las tres lápidas. Nadie inventarió los planes del proveedor, ni
   las filas de `billing_pending_checkouts` en `reconcile_assisted`, que el código describe como un
   cobro real que no se pudo vincular. Tampoco los sujetos de sonda que siguen vivos en la cuenta de
   producción: la matriz cuenta 108 preapprovals ahí, contra 8 filas locales.
3. El sistema nuevo no usa planes del proveedor (`DEC-MP-007`). Así que nadie desactiva los planes
   viejos, y además la matriz no midió si se pueden desactivar: ninguna de las filas `EX-21` a
   `EX-29` lo cubre.
4. Semanas después del corte, Juan abre un link viejo (un correo, el historial del navegador) y se
   suscribe. Mercado Pago crea el preapproval y lo cobra. Pasa lo mismo con un sujeto del reloj que
   alguien reactiva, o con un checkout de Path C que el cliente autoriza tarde. `EX-1` midió que un
   `pending` no vence nunca.
5. El webhook llega a producción. Los preapprovals de producción no llevan `notification_url`
   (`WH-5`), así que entran por el receptor de la aplicación. Para el sistema nuevo es un
   desconocido, y el tratamiento es re-vincularlo. `B/21` §2.5 dice que el candidato más plausible
   es la suscripción nueva de esa persona.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:159-165` §2.5:

> Las tres con preapproval vivo se cancelan en
> el proveedor y no queda rastro. Si alguna emite un cobro después del corte —porque la cancelación
> se aceptó y no se aplicó, o porque el cobro ya estaba en vuelo— **ese webhook llega como un
> preapproval desconocido**, y el sistema nuevo tiene **un solo camino automático** para un
> desconocido: re-vincularlo. El candidato más plausible del emparejamiento es **la suscripción nueva
> de esa misma persona**, que acaba de contratar. **El cobro viejo se imputa como pago del ciclo
> nuevo: pagó dos veces y el sistema registra una.**

La lápida es el único remedio, y cubre sólo a *«las tres»*.

`.specs/HOS-1352-billing-verticals-redesign/docs/07-facts-inventory.md:138` (el inventario sobre el
que se decidió):

> FROM billing_subscriptions WHERE deleted_at IS NULL GROUP BY 1,2,3 ORDER BY 1,2,3;

`packages/db/src/schemas/billing/billing_mp_plan.dbschema.ts:16` y `:94-95` (lo que vende hoy):

> Maps each Hospeda commercial plan variant to the MercadoPago `preapproval_plan`
> …
> always NULL. The share link is currently built 100% from
> `mpPreapprovalPlanId` by `buildPreapprovalPlanShareLink`

`apps/api/src/cron/jobs/abandoned-pending-subs.job.ts:43-45`:

> HOS-276: an `mp_subscription_id`-null row whose `billing_pending_checkouts`
> correlation row already resolved to `reconcile_assisted` (a REAL charge
> that could not be auto-linked

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:264` (`WH-5`):

> **las 108 preapprovals de producción son de `1890101689209057` y ninguna tiene `notification_url`**

**Severidad**: `CRITICA`. Es plata real de un cliente, cobrada todos los meses, sin servicio o
imputada al período equivocado. Lo produce un acto ordinario del cliente, abrir un link que tiene,
no un borde de carrera. `DEC-MIG-004` no lo cubre: su remedio es llamar a la población conocida, y
éstos son justamente los preapprovals que nadie conoce.

**Necesita decisión del owner**: **no**. Es una corrección del procedimiento del corte: inventariar
del lado del proveedor, desactivar los planes viejos y medir antes si eso se puede. La política de
no migrar queda como está.

---

### F-8CB3-002 — El grace de un pagador con tarjeta no corre nunca: arranca cuando el proveedor deja de reintentar, y eso pasa después de que el proveedor ya pausó

**Qué se rompe.** El moroso con tarjeta conserva **un ciclo entero de servicio sin pagar**, con el
pago en `PENDING` y la fila en `ACTIVE`. Después pasa directo a `SUSPENDED` por la pausa del
proveedor, sin grace y sin ninguno de los correos del §42.3. En un plan anual, si la ventana es el
ciclo, eso es un año. La restricción *«el grace es siempre más corto que el ciclo»* de
`DEC-SUB-019` queda sin sentido, porque presupone que el grace arranca con el primer rechazo.

**El camino.**

1. El cobro mensual de Juan se rechaza el día 1. Por `B/12` §1.3 el pago queda en `PENDING` y la
   fila sigue `ACTIVE`, porque el proveedor *«va a reintentar»*.
2. Según `B/12` §1.2, el grace arranca *«cuando el proveedor deja de reintentar»*, y eso se detecta
   *«releyendo el recurso, nunca contando días»*. No se puede usar el número de reintentos.
3. `GR-3` mide que lo que cierra el ciclo fallido **no es agotar los reintentos sino vencer la
   ventana**: `retry_attempt: 4` y la fila siguió `authorized` seis horas más. El paso de
   `scheduled` a `processed` **no emite ningún evento**. Y la pausa del proveedor cae **entre 80 y
   105 s antes** del `expire_date`. Sin un número, la única señal observable de «dejó de
   reintentar» es `processed`, y llega después de la pausa.
4. `DEC-SUB-019` apoya en la sonda 49 que la ventana dura un ciclo. Entonces el día 30 llega la
   pausa, `S6` corre por su segundo evento desde `ACTIVE` y `S4` no ocurrió nunca.
5. Juan usó 30 días sin pagar. Ningún correo de grace le avisó antes de la suspensión.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:42-43` §1.2 y `:57-60` §1.3:

> **El reloj del grace arranca cuando el proveedor deja de reintentar, no cuando falla un
> intento. Y eso se detecta releyendo el recurso, nunca contando días.**
> …
> | el proveedor rechazó y **va a reintentar** | **`PENDING`** | sigue `ACTIVE` |
> | el proveedor **agotó sus reintentos** | `FAILED` | S4 → `GRACE_PERIOD`, y **ahí** arranca el reloj |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:112`, que sigue vigente:

> **Esta sección no la usa.** Se escribió justamente para no necesitarla.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1283` §4:

> **siempre menos que el ciclo de esa versión** (`DEC-SUB-019`): el proveedor reintenta durante **un ciclo** (sonda 49) y después pausa

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197` (`GR-3`):

> ⚠️ **Y lo que decide el desenlace NO es agotar los reintentos sino VENCER LA VENTANA** … la transición final del ciclo fallido —`scheduled` → `processed`, el instante en que el proveedor se rinde— **no emite ningún evento**.

**Severidad**: `CRITICA`. Es la operación principal de dunning, y para toda la población con
tarjeta no se puede ejecutar. Además regala un ciclo entero por moroso. Dos capítulos vigentes
contestan distinto cuándo arranca el grace: `B/12` §1.2 dice que al rendirse el proveedor, y
`DEC-SUB-019` junto con `B/03` §4 razonan como si arrancara en el primer rechazo.

**Necesita decisión del owner**: **no** para ver la contradicción: `B/12` §1.2–1.3 se escribió
contra un `GR-3` `UNKNOWN` que ya no lo es. **Sí** para elegir el disparador: el primer rechazo
cambia qué significa «un cobro falla» en `S4`.

---

## ALTA

### F-8CB3-003 — Un cobro aprobado que no registramos no tiene ningún camino a la base: el barrido lo ve y no puede escribirlo, y la deduplicación por id tira la aprobación de un reintento

**Qué se rompe.** El proveedor cobra y nosotros no asentamos el cobro. Sin fila `SUCCEEDED` no hay
`covered_period` (el candado de `C5`), no hay comprobante y no hay `payment` del que colgar un
`refund`. Si Juan revoca dentro de los 10 días, la revocación no tiene qué devolver.

**El camino.**

1. **(a) Por webhook perdido.** Nuestro endpoint se cae más tiempo que la escalera de reintentos
   del proveedor: cinco entregas hasta +6,07 h (`WH-4`). El `payment` del ciclo nunca se inserta.
2. El barrido diario lee los `authorized_payments` y encuentra uno con `payment.status =
   approved`. Pero el barrido *«no escribe salvo la reparación de vínculo»*, y ninguno de los
   quince motivos de la marca es «cobro que no tenemos».
3. **(b) Por reintento aprobado.** El cobro del día 1 se rechaza y queda en `PENDING` (`B/12`
   §1.3). El reintento de las 14:07 se aprueba **dentro del mismo registro**, con el mismo id. El
   evento llega con un `id_del_hecho` que ya está en `payment`, y `C6` manda *«la segunda instancia
   falla al insertar y no hace nada más»*. `P1` no corre nunca.
4. En los dos casos `S6` pregunta, lee «cobró» y *«lo que corre es `S5`»*. Pero ningún acto
   declarado inserta el pago que esa lectura vio.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:96` y `:644-645`:

> | cobros del período | los `authorized_payments` del preapproval | ver §4 |
> …
> **Los dos barridos son idempotentes**: correrlos dos veces no produce nada distinto, porque
> ninguno escribe salvo la reparación de vínculo del §2.4.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:202-203` (`C6`):

> Lo resuelve `UNIQUE(proveedor, id_del_hecho)`: la segunda instancia falla al insertar y no hace
> nada más.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:553-554` (el reintento vive en
el mismo registro):

> (`authorized_payment`), y **los reintentos de ese ciclo quedan adentro del mismo registro**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:307`: `payment` guarda
*«**id del hecho en el proveedor**»* y no dice si ese id es el del `authorized_payment` o el del
pago embebido.

**Severidad**: `ALTA`. La plata entró, así que al cliente no se le cobra de más. Lo que se pierde es
el asiento, el comprobante y la posibilidad de reembolsar, y se arregla a mano si alguien lo ve. La
población (b) es la de todo cobro que se aprueba en un reintento.

**Necesita decisión del owner**: **no**. Hay que declarar quién asienta un cobro visto por
relectura y hacer que `C6`/`§10.2` distingan un duplicado de un cambio de estado del mismo hecho.

---

### F-8CB3-004 — «Todavía no se sabe» no tiene salida: bloquea `S6` sin límite, no abre marca y no lleva reloj

**Qué se rompe.** Una fila cuyo inventario de intentos no cierra queda en `GRACE_PERIOD` con
servicio completo **para siempre**. `S6` no corre ni por el fin del grace ni por la pausa del
proveedor, y lo único que sale es un aviso agregado diario, sin marca y sin escalamiento.

**El camino.**

1. El cobro de Juan falla y la fila entra en grace. Después, `charged_quantity` sigue mayor que los
   registros que devuelve `/authorized_payments/search`. Puede ser un subconjunto del buscador, que
   es la tercera mentira de `RC-1` medida sobre otro buscador de la misma familia, o un registro
   que nunca se indexa.
2. Cada corrida de `S6` recibe «todavía no se sabe», lo trata como lectura fallida y no actúa.
3. El proveedor pausa. El segundo evento de `S6` tiene la misma condición, así que tampoco actúa.
4. `B/09` §6.2 avisa a partir del segundo día, *«sin abrir una marca»*. Al no haber marca, no hay
   `puesta_en` y no hay escalamiento.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:582-585` §4:

> **Cualquier otra cosa es «todavía no se sabe»**, y no es una divergencia: se relee en la corrida
> siguiente. Quien consulta este § y necesita una respuesta para actuar —`S6`, que antes de
> suspender pregunta si cobró— **trata «todavía no se sabe» como una lectura fallida y no actúa en
> esa corrida**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:627-630` §6.2:

> **se avisa** por el canal de
> `DEC-OBS-001` (listado accionable y correo agregado, como un tipo más del resumen), **sin abrir
> una marca**

Y la fuente del inventario es un buscador, contra el invariante que lo prohíbe.
`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:132`:

> | D6 | **El buscador del proveedor no es fuente de verdad de nada**

`D17` (`:143`) declara **una** sola excepción, *«el barrido de creaciones sin respuesta»*. La
segunda, `/authorized_payments/search` como fuente de *«¿qué intentos hubo?»* (`B/09`:564), no
figura.

**Severidad**: `ALTA`. Es servicio regalado sin cota. La hace visible el aviso diario, pero nada la
obliga a cerrarse.

**Necesita decisión del owner**: **sí**. Qué hacer con un caso que sigue sin saberse después de N
días es un trade entre suspender a un cliente al día y regalar servicio. `B/03` §4 ya eligió no
suspender *«una corrida»*, pero no eligió «nunca».

---

### F-8CB3-005 — El período de un cobro del proveedor se lee de `next_payment_date`, un campo que el proveedor mueve solo

**Qué se rompe.** `covered_period` (el candado de `C5`), la condición 4 del pago tardío, la
extensión de fin de servicio de `C2` y el *«último cobro paga un período que todavía no terminó»*
de `S21` razonan sobre un período cuya etiqueta depende de **cuándo** se releyó el preapproval. Un
cobro reintentado o procesado después del avance queda etiquetado con el período siguiente.

**El camino.**

1. Juan tiene `next_payment_date = 01/10 13:13`. El cobro sale en el lote de las 14:02 (`B/09`
   §6.2), o se rechaza y se aprueba en un reintento a las +18 h (`GR-3`).
2. `P1` resuelve el período *«por su fecha de inicio… la fecha del próximo cobro que él tiene»*,
   leída por id. Para entonces el proveedor ya corrió la fecha: la corre aunque el cobro no salga
   (`PS-2`, `PS-6`) y aunque se rechace (`RN-3`, citado en `DEC-SUB-019`). La etiqueta queda en
   `01/11`.
3. Si el cobro siguiente se procesa antes del avance, lo etiqueta también `01/11`: choca con el
   `UNIQUE` de `covered_period` y el diseño no dice qué hace `P1` ante ese choque. `B/02` §2.3 sólo
   declara correcto el choque de `MP4`. Si se procesa después, no choca, y la cuota manual de
   `01/10`, etiquetada desde la copia local diaria, tampoco choca con nada. Es justo el doble cobro
   que `C5` existe para impedir.
4. `B/09` §4 dice *«un registro del período»* sin decir cómo se asigna un registro a un período.
   Y `C2` decide por *«la fecha del hecho»* sin decir si es el `date_created` del registro o la
   aprobación del reintento.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:366-368` §2.3:

> **Y el período de un cobro del proveedor se resuelve igual que el del manual: por su fecha de
> inicio**, que con `DEC-MP-006` —el reloj es del proveedor— es la fecha del próximo cobro que él
> tiene.

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:204` (`PS-2`):

> **la pausa NO congela el calendario** — su `next_payment_date` igual se corrió +24 h sin haber cobrado

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:254` (`GT-1`):

> `next_payment_date` **no se limpia**, así que ese campo no sirve para saber si va a cobrar

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:84`:

> **Decide la fecha del hecho, no la de llegada:**

`EX-16` (matriz:323) mide que el registro trae `debit_date` y `date_created` propios. Ninguna regla
los usa.

**Severidad**: `ALTA`. Se rompe el único candado de base contra el doble cobro de `C5`, y el pago
del ciclo siguiente puede quedar sin escritura posible. La severidad depende de un instante del
proveedor que no está medido: cuándo avanza la fecha respecto del cobro.

**Necesita decisión del owner**: **no**. Hay que elegir la fuente del período y medir el instante
del avance.

---

### F-8CB3-006 — El comprobante no tiene quién lo emita y no puede apuntar a un pago manual

**Qué se rompe.** `DEC-LEGAL-001` obliga a emitir un comprobante **por cada cobro**. Hoy eso no se
puede cumplir por dos razones: ninguna transición lo emite, y el `receipt` sólo puede colgar de un
`payment`, que no existe en ningún cobro de un pagador manual (Partner, efectivo, transferencia).

**El camino.**

1. Un Partner paga su cuota por transferencia. `MP1` registra el `manual_payment` y la fila vuelve
   a `ACTIVE`.
2. `receipt` guarda *«pago»*. Es exactamente la ambigüedad que `B/02` §2.3 corrigió para `refund`:
   la única entidad llamada «pago» es `payment`. La cuota manual queda sin comprobante.
3. Tampoco los cobros con tarjeta lo tienen asegurado: ni `P1`, ni `MP1`, ni `MP4` nombran la
   emisión entre sus efectos. La palabra «comprobante» aparece en `manual_payment` con **otro**
   sentido, la prueba que sube el admin.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:311`:

> | **`receipt`** | pago, número, PDF. **Comprobante no fiscal** (§54, `DEC-LEGAL-001`) | `UNIQUE(numero)`, sin huecos |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:317-320` (el mismo defecto,
arreglado sólo para `refund`):

> **El `refund` cuelga del pago que se devuelve, y ese pago puede no ser un `payment`.** La
> versión anterior decía sólo *«pago»* y la única entidad con ese nombre es `payment`, que es *«el
> registro de un hecho en el proveedor»*

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:144-145`:

> **El comprobante no fiscal** ya lo decidió `DEC-LEGAL-001` y no se reabre: se emite por cada
> cobro

Además, *«`UNIQUE(numero)`, sin huecos»*: un `UNIQUE` no impide huecos, y con dos contenedores
sirviendo tráfico (`DEC-CONC-001`) una secuencia de base los deja en cada rollback. El mecanismo que
los evitaría no está declarado.

**Severidad**: `ALTA`. Es una obligación legal firmada que no se cumple para una población entera.
Se arregla a mano emitiendo el PDF fuera del sistema.

**Necesita decisión del owner**: **no**. Hay que declarar el emisor y la doble puerta. Si «sin
huecos» es de verdad requisito o sólo aspiración, eso **sí** es del owner.

---

### F-8CB3-007 — Nada avisa si el barrido diario deja de correr o corre a medias, y el reloj de escalamiento vive adentro del propio barrido

**Qué se rompe.** Seis comprobaciones de cero llamadas, cuatro salvedades, el escalamiento de las
marcas y la vigilancia de las lápidas dependen **todos** del barrido diario. Si el job muere, o
termina en verde con la mitad de las lecturas por id fallidas, el sistema entero de detección se
apaga en silencio. Es el mismo modo de falla que `B/09` §1 le reprocha al buscador del proveedor.

**El camino.**

1. Un deploy deja el cron sin registrar, o el proveedor devuelve `429` a mitad de la cartera.
2. Las filas no leídas *«se releen en la corrida siguiente»*, que no llega o vuelve a cortarse.
3. El *Free Forever* de Ana sigue cobrando (salvedad 4). Su marca nunca escala, porque *«hacer que
   esa marca escale»* **es** el barrido. Nadie recibe nada: el correo agregado sólo lista lo que el
   barrido encontró.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:170`:

> | **hacer que esa marca escale** si nadie la resuelve | el **barrido diario**, que devuelve al recorrido las suscripciones terminales con la marca puesta o con un pago pendiente | `B/09` §3, salvedades 2 y 3 |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:37-38` (el criterio que el
barrido propio no se aplica):

> **El tercero es el peor**: un barrido que liste desde el proveedor procesa parte de la cartera y
> **termina en verde**.

En `B/*`, `NUCLEO/*` y `V/*` no hay ninguna regla de vida ni de completitud del barrido. Busqué
*heartbeat*, *«el barrido no corrió»*, *«corrida exitosa»* y *«última corrida»*: cero resultados.

**Severidad**: `ALTA`. No rompe plata por sí solo, pero apaga en bloque todos los detectores que el
diseño declara como *backstop* de los caminos que sí la rompen.

**Necesita decisión del owner**: **no**.

---

## MEDIA

### F-8CB3-008 — La re-vinculación automática no tiene regla de emparejamiento ni precondición, y la base admite dos preapprovals vivos sobre la misma fila

**Qué se rompe.** Hay un caso general, fuera del corte, en que la re-vinculación duplica el cobro.
Re-vincular una huérfana a una fila que ya tiene un preapproval vivo deja dos autorizaciones
cobrando bajo una suscripción. El barrido lee **cada id por separado**, los dos dicen `authorized`
contra `ACTIVE` y los dos **coinciden**.

**El camino.** 1) Llega un webhook de un preapproval desconocido cuyo `external_reference` apunta a
la fila de Juan, o cuyo pagador es Juan. 2) La re-vinculación le escribe un `provider_link`. 3)
`provider_link` sólo es único por id del proveedor, no por suscripción. 4) Juan paga dos veces por
mes y ninguna comparación lo ve.

**Dónde lo permite el diseño.** `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:51`:

> | **`provider_link`** | el id del proveedor de una suscripción, cuál es el proveedor, y **la última `version` del recurso que aplicamos** | **`UNIQUE(proveedor, id_del_proveedor)`**.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:68-69` §2.4:

> Re-vincular una huérfana reescribiendo su `external_reference` **no cambia plata ni estado**:
> sólo dice de quién es.

No declara contra qué fila ni con qué precondición. El único texto que habla del emparejamiento es
*«el candidato más plausible»* (`B/21`:163).

**Severidad**: `MEDIA`. Dos implementadores eligen candidato distinto, y uno de los dos caminos es
un doble cobro invisible. No lo subo porque la población fuera del corte es chica.

**Necesita decisión del owner**: **no**.

---

### F-8CB3-009 — Un pago ya registrado que cambia después (reembolso hecho desde el panel, contracargo) no lo compara nadie

**Qué se rompe.** El barrido compara estado, monto, fecha, «¿cobró?» y `version` del
**preapproval**. Nunca compara el estado de un `payment` que ya está en `SUCCEEDED`. Si alguien
reembolsa desde el panel (`DEC-RF-007` deja reparaciones manuales) o el cliente desconoce el cargo
en su banco, nuestra fila sigue `SUCCEEDED`, el `covered_period` no se libera y el servicio sigue.
La máquina del pago tampoco tiene una transición por contracargo.

**Dónde lo permite el diseño.** `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1369-1373`
(`P1`–`P5`: ningún `SUCCEEDED →` por causa externa) y la tabla del `B/09` §3 (`:91-97`), que no
tiene una fila «estado de un pago registrado». Busqué *contracargo*, *chargeback*,
*charged_back*, *mediación* y *disputa* en `B/*`, `NUCLEO/*`, el PDR, la matriz y el log: **cero
resultados**. Por la regla 3 de la matriz, sin fila no se puede decidir.

**Severidad**: `MEDIA`. La plata que se pierde es nuestra, y el caso es raro con la cartera de hoy.

**Necesita decisión del owner**: **sí**. Qué se hace ante un contracargo es política, y antes hay
que medirlo.

---

### F-8CB3-010 — La comparación de `version` del barrido supone que el `GET` por id devuelve `version`, y la matriz sólo lo midió en el cuerpo del webhook

**Qué se rompe.** `B/09` §3 y `B/02` §2.2 presentan la comparación de `version` como el detector del
cambio que no avisa (`EX-15`). Si el `GET /preapproval/{id}` no trae ese campo, la fila no se puede
evaluar, y el barrido la da por coincidente. Hoy además nuestra capa lo descarta en producción
(`EX-2`).

**Dónde lo permite el diseño.** `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:97`:

> | la `version` del recurso | la última que aplicamos | si la del proveedor es mayor, **el recurso cambió sin avisarnos**: se relee entero |

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:309` (`EX-2`):

> **SÍ: el cuerpo trae `version`, un contador monótono POR RECURSO.**

Ninguna fila de la matriz afirma que la lectura por id la traiga. `RC-4` enumera los campos que
coinciden entre el `search` y el `GET`, y `version` no está entre ellos.

**Severidad**: `MEDIA`. Es una afirmación sobre el proveedor que la matriz no sostiene (regla 2).
`DIVERGENCIA_DE_MONTO` compensa en parte, porque compara el monto directamente.

**Necesita decisión del owner**: **no**. Hay que medirlo.

---

### F-8CB3-011 — La excepción declarada de `D17` busca por un filtro de estado que en producción devuelve un subconjunto

**Qué se rompe.** El barrido de creaciones sin respuesta pregunta *«¿este pagador tiene alguna
suscripción autorizada que yo no tenga registrada?»* con `payer_email` + `status`. `RC-1` midió en
producción que filtrar por un estado válido devuelve **15 de 69** sin avisar. Una ausencia en esa
respuesta no prueba que la suscripción no exista, y el diseño no dice qué hace cuando no encuentra
nada.

**Dónde lo permite el diseño.** `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:56-58`:

> La que sí la tiene es **«¿este pagador tiene alguna suscripción autorizada que yo no
> tenga registrada?»**, por correo del pagador y estado, que sí filtran y se componen.

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:270` (`RC-1`):

> `status=cancelled` trae **15** filas … y recorriendo las 76 sin filtro hay **69** canceladas.

**Severidad**: `MEDIA`. Con el checkout por `init_point` (`B/06` §6), una creación sin respuesta
deja un `pending` que nadie puede autorizar, así que la población dañina es chica. Pero la regla
está escrita para el caso en que sí cobró.

**Necesita decisión del owner**: **no**.

---

### F-8CB3-012 — `DEC-SUB-019` y `B/03` §4 citan como medida la sonda 49, y la matriz la registra bloqueada

**Qué se rompe.** La validación *«grace < ciclo»* y la cancelación en `S6` se apoyan en que la
ventana de reintentos dura un ciclo. La fila de la matriz que manda sobre eso dice que la sonda 49
**está bloqueada** y que 24 h y «un ciclo» son indistinguibles. El log dice que el 2026-09-24 la
sonda midió 48,0 h. Uno de los dos documentos está desactualizado, y la regla 2 dice que manda la
matriz.

**Dónde.** `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197`:

> La [sonda 49](./mp-probes/probe-49-la-ventana-de-reintentos.mjs) existe para separarlas con un sujeto de `2 days` y **está bloqueada**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5001-5003`:

> la **sonda 49** (producción, 2026-09-24) midió que **la ventana de
> reintentos del proveedor dura un ciclo**: el cobro de renovación de un preapproval de `2 days`
> trae `expire_date` a **48,0 h** de creado

Y `B/12` §1.5 (`:108`) y su cierre (`:841`) siguen diciendo que `GR-3` *«sigue `UNKNOWN`»*.

**Severidad**: `MEDIA`. Es un registro, pero le cambia la base a una decisión que corta un cobro.

**Necesita decisión del owner**: **no**.

---

### F-8CB3-013 — `DEC-MIG-002` manda transcribir las altas nuevas, `DEC-MIG-003` manda no transcribir nada, y `B/21` §3.3 todavía declara la decisión abierta

**Qué se rompe.** Quien escriba el procedimiento del corte para las altas que entren durante el
rediseño recibe tres instrucciones distintas: transcribir a mano, cancelar y resuscribir, o
esperar una decisión. `DEC-MIG-002` sigue `ACCEPTED` sin ningún puntero a la entrada que la
contradice.

**Dónde.** `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2239-2240`:

> Se siguen tomando altas en el sistema actual, y **se transcriben a mano
> cuando el rediseño esté listo**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:113-114`:

> **No se completa en silencio** (§67). Queda declarada como decisión del owner en
> [`04-open-decisions.md`]

**Severidad**: `MEDIA`.

**Necesita decisión del owner**: **no**: `DEC-MIG-003` ya decidió. Falta el puntero y la
corrección de `B/21` §3.3.

---

### F-8CB3-014 — El destino de las tablas de billing de hoy no está declarado, y desde el 2026-09-26 guardan pagos reales

**Qué se rompe.** `B/02` §4.1 obliga a conservar íntegros pagos, reembolsos y comprobantes, y
`B/09` §6.1 dice que el histórico *«es nuestro o no existe»*. El corte no escribe ninguna fila de
pago en el modelo nuevo, y ningún capítulo dice qué pasa con `billing_payments` ni con el resto de
las tablas de QZPay. La premisa *«cero pagos»* caduca en dos días, y con `DEC-MIG-002` crece.

**Dónde.** `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:917`:

> | **Se conserva íntegro, siempre** | pagos, reembolsos, comprobantes, el vínculo con el proveedor | los cuatro primeros son obligación legal y contable |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:213`: *«**Los pagos**: no hay
ninguno.»* Es falso a partir del 2026-09-26, fecha que el propio `B/21` §3.1 registra.

**Severidad**: `MEDIA`. `DEC-MIG-004` cubre la relación con el cliente. No cubre el registro
contable.

**Necesita decisión del owner**: **sí**, o se decide en la FASE 7 del paraguas. Retener las tablas
viejas, leerlas o exportarlas es política de retención.

---

### F-8CB3-015 — El proveedor falso no puede reproducir ninguna de las mentiras en que se apoya la conciliación, y el E2E no tiene un flujo de conciliación

**Qué se rompe.** Las cuatro filas de *«cero cobros»* del `B/09` §4, el «todavía no se sabe», la
ventana `scheduled`/`processed`, la pausa previa al `expire_date`, la supersesión de entregas y la
fecha que avanza sin cobrar no se pueden ejercitar contra el stub. Los tests de dominio quedan
verificados contra un proveedor que no existe, que es lo que `B/20` §3.1 dice querer evitar.

**Dónde.** `.specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:391-410` (la tabla de
mentiras). `RC-5`, `RC-6`, `RC-7`, `GR-3`, `WH-1`, `WH-2`, `WH-5`, `PS-2`, `PS-6`,
`charged_quantity` y `last_charged` aparecen **cero** veces en el capítulo (contado con
`rg -c`). La lista E2E (`:451-470`) no tiene un caso de webhook perdido, de huérfana ni de barrido,
y salta del 6 al 8.

**Severidad**: `MEDIA`.

**Necesita decisión del owner**: **no**.

---

## BAJA

### F-8CB3-016 — La excepción del correo inmediato nombra un «doble cobro real detectado» que ningún motivo de la marca produce

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:276-278`:

> **qué entra en esa excepción
> es una lista cerrada**: un doble cobro real detectado, y un reembolso que falló sobre una
> revocación.

Ninguno de los quince motivos del `B/02` §2.5 se llama así. La condición 4 del pago tardío cae en
`PAGO_TARDÍO_RECHAZADO` junto con otras tres, y tampoco hay un detector declarado del reembolso que
falla. Dos implementadores enrutan distinto el correo inmediato, o no lo mandan nunca.

### F-8CB3-017 — `B/22` §4 cuenta «seis» preguntas y la tabla tiene cinco

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:127-136`: las filas son 1, 2, 3, 4 y
6. Falta la 5, y dice *«las otras tres»* sobre dos. El capítulo tampoco tiene §3.

### F-8CB3-018 — `B/21` cita un §2 que no existe y atribuye a su §2.4 un umbral que está en `V/21`

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:109`: *«el umbral medido está en
unas 20 (§2.4)»*. El `B/21` §2.4 no lo contiene; está en `V/21` §2.5. El capítulo va §1, §3, §2.4,
§2.5, §4, sin encabezado §2. `NUCLEO/02`:88 remite a un *«§4»* que el archivo no tiene.

### F-8CB3-019 — La fila de la lápida dice que nadie verificó su cancelación, y el corte declara una relectura como gate

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:131` (*«sin idempotencia, sin
registro y sin nadie que verifique»*) contra `01-decision-log.md` `DEC-MIG-003`: *«cancelar en el
proveedor, **verificar releyendo por id**… es el gate»*. Con la relectura hecha, la lápida cumple
el segundo criterio de exención. No rompe nada, porque la salvedad 4 la barre igual, pero las dos
descripciones no pueden ser verdad a la vez.

---

## Ataques que intenté y el diseño resistió

- **Decidir «¿cobró?» con `charged_quantity` o `last_charged_date`.** El `B/09` §4 reescrito lo
  prohíbe con fila (`RC-5`, `RC-6`) y usa el contador sólo para saber si el inventario está
  completo.
- **Tratar `next_payment_date` como divergencia.** El `B/09` §3 lo registra y declara que no es
  divergencia (`PS-6`). El problema que queda es otro: usarlo como período (F-005).
- **Barrer desde el buscador del proveedor.** El inventario sale de nuestra base y se lee por id
  (`RC-1`, `RC-2`, `D6`).
- **Terminales que salen del barrido con una cancelación nuestra sin confirmar.** El criterio de
  exención por *«quién dejó al preapproval sin poder cobrar»* más la salvedad 4 cubren `S3`, `S12`,
  `S13`, `S20`–`S28` y la lápida. Recorrí las quince puertas y no encontré una sin salvedad.
- **Una marca que se traga los cobros repetidos.** `reconciliation_mark_payment` con N pagos por
  marca, más *«`S15` no puede levantar una marca con pagos sin resolver»*, cierra el caso de los
  meses 2 a N.
- **El candado `A` vacío.** La primera comprobación de cero llamadas lo vigila, sin excepción para
  `PENDING_AUTHORIZATION`.
- **Desorden y duplicados de webhooks de suscripción.** La combinación de `version` y relectura
  (`§10.1`) lo resiste, siempre que la `version` se persista (F-010).
- **La pausa vencida que no reanuda, la cortesía diferida sin re-emitir y el fan-out del grant a
  medias.** Cada uno tiene su comprobación de cero llamadas con motivo propio.

## Fuera de mi vector

- **`C5` puede tener población vacía.** `MP1` sale sólo de `AWAITING` y `AWAITING` lo crea sólo
  `MP5` sobre un pagador manual, así que no queda claro cuándo conviven un `payment` y un
  `manual_payment` en la misma fila (`B/05`:167 contra `B/03`:1396-1400). Le toca a B1/B2.
- **`C6` sigue descartando la actualización de un reembolso** que llega con el id del pago
  (`RF-7`, anotado en la matriz como `F-8B1-013`). `B/05`:202-203 no cambió.
- **`refund` sigue sin el id del reembolso del proveedor** (`B/02`:308; anotado en la matriz como
  `F-8B3-011`), a menos que se lea `idempotency_key.resultado` como ese dato.

## Key Learnings

1. El inventario del corte se midió sobre `billing_subscriptions`. El sistema de hoy vende por
   `preapproval_plan` con share links reusables y tiene checkouts de Path C sin vincular
   (`reconcile_assisted`). Todo eso queda vivo en el proveedor después del corte.
2. `B/12` §1.2–1.3 (el grace arranca cuando el proveedor deja de reintentar) se escribió contra un
   `GR-3` `UNKNOWN`. Medido, esa señal llega después de la pausa y deja sin efecto el grace del
   pagador con tarjeta.
3. «Todavía no se sabe» (`B/09` §4) no tiene salida ni reloj, y bloquea también el segundo evento
   de `S6`.
4. El barrido detecta cobros aprobados que no tenemos, pero no tiene ningún camino para
   escribirlos. Y la deduplicación por id del hecho (`C6`) descarta el cambio de estado de un
   reintento que se aprueba dentro del mismo registro.
5. `receipt` repite el defecto de «pago = `payment`» que `B/02` §2.3 ya había corregido para
   `refund`, y ninguna transición emite el comprobante.
6. El período de un cobro del proveedor se deriva de `next_payment_date`, que según la matriz se
   mueve solo. El `authorized_payment` trae `debit_date` y `date_created` propios, y no se usan.
