---
title: "FASE 9 · las decisiones del owner, una por una"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 — las decisiones del owner

Los cinco racimos resueltos dejaron **37 decisiones** que sólo puede tomar el owner. Este
documento las lleva **una por una**, con lo que se decidió y por qué.

**No reemplaza al decision log.** Las que resulten ser decisiones de arquitectura o de producto se
promueven a `01-decision-log.md` con su `DEC-` propia; el resto vive acá, que es donde la FASE 9
las va a buscar para aplicar el texto.

## Estado

| | |
|---|---|
| total | **37** |
| ya contestadas antes de abrir esta tanda | **4** |
| contestadas en la tanda | **1** |
| pendientes | **32** |

### Las cuatro que se contestaron antes, sin estar en la lista

| origen | qué | dónde quedó |
|---|---|---|
| `R5` #4 | autorizar la cuarta consulta read-only | corrida el 2026-09-19; resultado en `07-facts-inventory.md` |
| `R6` #2 (parte) | qué workflows corren en `epic/**` | `DEC-CI-001` |
| `R6` #4 | si `lighthouse` y `a11y-sweep` corren por PR | `DEC-CI-001` — **no corren** |
| — | qué se hace con los guards viejos y de dónde salen los nuevos | `DEC-METH-005` |

---

## D-01 · Un addon, solo, ¿da cobertura? — `R2` #6

**Decidido: NO. Las fuentes se parten en dos clases y `cubierto` cuenta sólo las de TÍTULO.**

> **`cubierto` se calcula sólo sobre `TRIAL`, `SUSCRIPCIÓN`, `CORTESÍA` y `GRANT`. `ADDON` es de**
> **clase COMPLEMENTO: agrega capacidades y nunca cobertura.**

**El problema que evita**, y estaba medido en el diseño, no era hipotético: `B/16` §4.2 dice que
*«la suspensión y la pausa no dejan huérfano a nada»* y que el reloj del addon *«no se congela»*
(`DEC-ADDON-001`). Con `cubierto` definido como *«al menos una fuente viva»* (contrato §2.1), en
cuanto `R2` agregue `ADDON` a las fuentes **un suspendido queda cubierto por su propio addon**:
dejó de pagar y sigue adentro. Es un fail-open **introducido por el arreglo**, que es la forma de
defecto que `DEC-METH-004` manda a evitar.

**Por qué esta salida y no congelar el reloj del addon**: porque **no inventa una regla, escribe
una que ya rige en dos capítulos**. El §38 exige *«una subscription válida compatible»* para
adquirir un addon, y `B/16` §2.4 declara su única excepción —*«un grant permanente vale como
título en lugar de la suscripción `ACTIVE`»*—. **Un addon nunca fue un título: era el complemento
de uno.**

**Lo que NO cierra, y queda separado a propósito**: si el cliente pierde días de addon que pagó
mientras su suscripción está suspendida. Es una decisión de producto, es legítima, y es otra —
congelar el reloj (`DEC-ADDON-001`) se puede decidir cuando el owner quiera, sin tocar esto.

- **Costo**: una línea en el §2.1 del contrato.
- **La clase no se transporta**: se deriva del `tipo`. Transportarla sería una segunda fuente de un
  dato que el `tipo` ya determina.
- **Dónde se aplica**: `12-contrato-de-cobertura.md` §2.1, más el §1.4 de
  [`02-R2-resuelto.md`](./02-R2-resuelto.md).

---

## D-02 · Los addons de una suscripción sucedida — `R1` #4

**Decidido: se RE-APUNTAN a la sucesora.** No se cancelan y no se rehacen: el addon deja de colgar
de la fila vieja y pasa a colgar de la nueva, en el mismo acto del upgrade. **Y lo mismo para el
contador de «N cobros» de una promo** (`B/14` §2.2).

**El argumento, en una línea**: *el objetivo del addon no desapareció, se sucedió*. La suscripción
vieja y la nueva son la misma relación comercial con la persona — que es exactamente lo que `R1`
acaba de modelar con `sucede_a`. Cancelar un addon ahí es **tratar una sucesión como una baja**.

**Qué pasaba si no se decidía**, y por eso el riesgo era alto: `B/16` §4.3 **cancela en el
proveedor, de inmediato, los addons recurrentes** que colgaban de la fila vieja. El cliente mejora
su plan y **pierde en el mismo acto addons que pagó**. `DEC-SUB-007` impl. 4 lo había dejado
**explícitamente abierto** —*«hay que decidir si siguen colgando del cliente o si hay que
re-vincularlos»*— como el hueco `E-ADDON-04`, y nadie volvió.

**Por qué importaba ahora y no antes**: mientras el candado de `R1` bloqueaba el upgrade, esto era
teórico. `R1` lo volvió ejecutable.

**Lo que NO se decidió acá**: colgar los addons **del cliente** en vez de la suscripción. Es más
limpio conceptualmente y es **un rediseño del capítulo 16**, no una decisión de esta fase. Se
discute el día que un addon tenga que sobrevivir a no tener ninguna suscripción viva.

- **Costo**: medio — el cambio 18 del §2 de [`05-R1-resuelto.md`](./05-R1-resuelto.md), más el
  contador de promos de `B/14` §2.2.
- **Dónde se aplica**: `B/16` §4.3 y `B/14` §2.2.

---

## D-03 · La fecha de primer cobro de la sucesora se GUARDA — `R1` #5

**Decidido: se agrega la columna.** `subscription` guarda la fecha de primer cobro con la que
nació la fila.

**Qué convierte**: `D8` —*«una fecha de primer cobro futura es la precondición de seguridad de todo
cambio de plan o de ciclo»* (`NUCLEO/04` §3)— pasa de **invariante recordable** a **verificable**.
Sin la columna no hay forma de comprobar que se cumplió **ni de escribir el guard `G-R1-B`**, y su
incumplimiento **es literalmente el doble cobro**.

**El argumento que lo decide es del propio programa**: el capítulo 04 clasifica cada invariante por
quién lo sostiene, y define el nivel «base» como **el que no admite ningún camino que lo esquive**.
Un invariante *de servicio*, para la precondición del mecanismo más caro del sistema, es el nivel
equivocado. Hoy hay **ocho** sostenidos por la base; éste es el noveno.

**Por qué no releerla del proveedor**: lo prohíbe `D6`, *«el buscador del proveedor no es fuente de
verdad de nada»*. Y no serviría igual: un guard tiene que poder correr sin red.

- **Costo**: bajo — una columna, en un modelo que todavía no existe.
- **Dónde se aplica**: `B/02-modelo-de-datos.md` §2.2 (la tabla `subscription`) y `NUCLEO/04` §3
  (subir `D8` de nivel).

---

## D-04 · Quien gastó su trial vuelve por un QUINTO TIPO DE TÍTULO — `R3` #1

**Decidido: la salida (a).** El contrato gana un quinto `tipo` para los que no tienen ninguno —
`Turista Free`, `Guest` y `TRIAL_EXPIRED`.

**El círculo que rompe**: a un `TRIAL_EXPIRED` no le queda ninguna fuente viva, así que el paso 5
le niega **la operación de suscribirse**, que es la única forma de volver a tener una. **Queda
afuera para siempre**, contra la *«recuperación posible»* que el §21 promete y que `NUCLEO/01`
§2.1 cita para los dos `SUSPENDED`. Son **8 de los 45 casos de `R3`** y es **un hallazgo del
barrido**: ningún informe de FASE 8 lo tenía. **No es «no anda hasta que exista billing»** — el día
que billing exista va a seguir sin andar.

**Por qué la (a) y no las otras dos**:

- **Cierra dos cosas a la vez.** Es la única salida que además cierra `F-8A1-005`.
- **«No tener título» no es un accidente: es el estado base de la plataforma.** Todo usuario
  autenticado es `Turista Free` sin suscripción real (§14) y todo visitante es `Guest`. Que el paso
  5 no tenga respuesta para el caso más común del sistema es **el mismo defecto que `R3` acaba de
  arreglar para `PRE_TRIAL`**, del otro lado del ciclo.
- La **(b)** —una clase de «operaciones que abren título»— tiene riesgo medio porque **la clase
  puede crecer y cada miembro es una operación menos verificada**: es el mecanismo que, mal usado,
  se vuelve la exención por ruta que `R3` se cuidó de no abrir.
- La **(c)** la desaconseja el propio `R3`: `cubierto` sería verdadero **para siempre** y el
  contrato §5.1 pide que *«un trial vence de verdad»*.

> ⚠️ **El costo de la (a) no es técnico, es de proceso.** El contrato es la frontera, y
> `DEC-ARCH-006` dice que **ninguna épica lo muta sola**. Esta decisión **forma paquete** con las de
> `R2` sobre el contrato (`D-01` y las que sigan): se aplican juntas o no se aplican.

- **Dónde se aplica**: `12-contrato-de-cobertura.md` §2.1, y `V/17` §1.2 (el paso 5).

---

## D-05 · Qué otorga un grant: el PLAN, su versión vigente, y con trinquete — `R2` #1

**Decidido**: el grant **se ancla al plan**, no a una versión, y resuelve **la versión vigente —
sea vendible o no—**, con un **trinquete**: *un grant nunca otorga menos de lo que otorgaba el día
que se concedió.*

**El problema que cierra** es la causa del racimo `R2`, el defecto que encontraron **tres agentes de
las dos épicas por separado**: un grant permanente cruza la frontera, la persona queda «cubierta»,
y cuando el paso 6 pregunta **qué capacidades le da, no hay respuesta**. *Free Forever* no otorgaba
nada, porque el contrato transporta un solo campo de contenido (`versiónDePlan`) y un grant no
apunta a ningún plan.

**La recomendación original era anclar a una VERSIÓN fija. El owner la mejoró**, y el diseño le da
la razón: `V/02` §2.1 ya tiene **los dos modos escritos** —*«la pricing lee la versión **vigente** y
sólo si es vendible; una suscripción lee su versión **anclada**, vigente o no, vendible o no»*— así
que seguir la vigente no inventa un modo nuevo. Y **`UNIQUE(plan_id) WHERE vigente`** garantiza que
«la última» es unívoca y siempre existe.

**Por qué «vendible o no» y no como la pricing**: porque **retirar un plan se hace publicando una
versión no vendible** (`D13`, cap. 10 §3.2). Leyendo como la pricing —*sólo si es vendible*— el día
que se retira el plan Premium **todos los `Free Forever` anclados a él se quedan sin nada**. El
híbrido toma «la vigente» de la pricing y el «vendible o no» de la suscripción.

**Por qué el trinquete**: seguir la versión vigente expone al beneficiario a que **el plan
empeore** —una versión que reparte distinto le saca algo a quien tiene un «para siempre», sin que
nadie lo haya decidido para esa persona—. El trinquete es un instrumento **que el diseño ya tiene**
(el piso de `V/15` §2.5), aplicado acá: sigue las mejoras y no sufre los recortes.

**Por qué no dejar que el grant declare su propio juego de claves**: sería **una segunda forma de
declarar entitlements**, que `V/02` §1.2 prohíbe — y obligaría a mantener dos catálogos en
sincronía para siempre. Es el defecto que este programa entero viene a corregir.

- **Beneficio operativo**: regalar algo pasa a ser **elegir un plan concreto**, y queda auditado.
  Hoy *Free Forever* es un nombre comercial sin contenido definido.
- **Riesgo declarado**: que alguien lea el anclaje como *«el grant es un plan»*. Lo contesta el
  §2.2.
- **Dónde se aplica**: `permanent_grant` en `B/02`, el §1.3 de
  [`02-R2-resuelto.md`](./02-R2-resuelto.md), y el trinquete en `V/15` §2.5.
- ⚠️ **Candidata a `DEC-` propia** en el decision log: cambia el modelo de un instrumento comercial.

---

## D-06 · La dirección inversa se declara DENTRO del contrato — `R2` #5

**Decidido: se escribe**, con sus **seis** campos, y dos columnas nuevas en `vertical`.

**El problema**: el contrato enumera con cuidado **lo que billing empuja a verticales** y **nunca
declara lo que billing LEE** (`plan_version`, `vertical`). Eso resultó ser **el acoplamiento real**
entre las dos épicas (`F-8B3-009`), con un agravante medido: **dos de las columnas que billing lee
no existen**. Hoy billing lee tablas de verticales **sin contrato que lo regule**, que es
exactamente el acoplamiento que el corte en dos épicas venía a impedir.

**La objeción que el propio hallazgo anticipa, y por qué no aplica**: *«salvo que ampliar el
contrato en la otra dirección se considere una mutación de `DEC-ARCH-006`»*. **No lo es.**
`DEC-ARCH-006` decidió que la frontera es **un contrato con dos implementaciones**; nunca dijo que
fuera de una sola vía. Esto **no muta la decisión: escribe la mitad que faltaba.**

**El costo de no hacerlo**: el acoplamiento existe igual, sólo que **sin declarar**. El día que
billing lea una columna que verticales cambió, nadie se entera hasta que rompe.

**Un detalle que lo refuerza**: `R2` descubrió que la dirección inversa tiene **seis** campos, no
cinco. El sexto —`vigente`/`vendible`— salió de recorrer el dominio, y **era la diferencia entre
que `F-8B3-009` se cortara o siguiera llegando**. Sin declararla, ese campo se pierde de vista y el
hallazgo vuelve.

- **Costo**: una sección del contrato, más dos columnas en `vertical` (`E-5`, `E-6`).
- **Dónde se aplica**: `12-contrato-de-cobertura.md` (sección nueva) y el §1.7 de
  [`02-R2-resuelto.md`](./02-R2-resuelto.md).

> **`D-01`, `D-04`, `D-05` y `D-06` tocan todas el contrato**, que es la frontera. Por
> `DEC-ARCH-006` **ninguna épica lo muta sola**: se aplican como un solo cambio, no de a una.

---

## D-07 · El guard de la §6.3 nace en `V4`, no en `B4` — `R2` #4

**Decidido: va a `V4`**, como guard de **destino de producción**. El owner delegó la elección
—*«lo que te parezca mejor, no es un guard que me importe mucho»*— con el razonamiento de que
*«vamos a trabajar en un branch especial; mientras no mergeemos nunca va a llegar a prod»*.

**Ese razonamiento es correcto y no cubre el caso que el guard protege.** Mientras el branch no se
mergee, nada llega a producción — de acuerdo. **El guard es para el momento del merge**, y ese
momento tiene una propiedad que `DEC-ARCH-007` ya dejó escrita: *«el PR final a `staging` va a ser
enorme y nadie lo puede revisar de verdad»*.

El escenario: la épica de verticales **se construye con la implementación de arranque adentro**,
porque es la que le permite avanzar sin billing (`DEC-ARCH-006`). Si el día del merge quedó algo
enganchado a ella, **ése es el día en que entra sin que nadie lo vea**. El guard convierte eso en un
build que falla, en vez de un descubrimiento en producción.

**Por qué `V4` y no `B4`**: en `B4` la defensa **no existe durante toda la épica de verticales**,
que es justo cuando la implementación de arranque está viva y es la única que hay. Y el contrato
§6 dice que las tres defensas *«ninguna es opcional, y las tres son parte de la decisión»*:
dejarla sin dueño sería desarmar `DEC-ARCH-006` sin registrarlo.

**Lo que lo hace posible sin molestar**: si falla sobre un **build destinado a producción** y no
sobre la rama, **no se dispara mientras nada apunte a producción**. Se puede escribir el día uno y
quedarse callado meses.

**Y ya estaba implícito en `DEC-METH-005`**: los guards necesarios corren desde el día 1 de
implementación. Ésta es necesaria desde el día 1 de verticales.

- **Costo**: bajo. **Dónde se aplica**: `HOS-1353/descomposicion.md` (`V4`) y el §3.1 de
  [`02-R2-resuelto.md`](./02-R2-resuelto.md).

---

## D-08 · La herencia de Turista VIP en el trial se DECLARA, no se deriva — `R2` #3

**Decidido: se declara explícitamente** en el plan de trial, igual que ya se declara `vendible`.
**No se deriva** del plan vendible de `rank` más alto.

**La diferencia, y por qué importa la dirección en la que falla**: los limits y entitlements del
plan de trial **se derivan** (`DEC-TRIAL-001`). Si `hereda Turista VIP` se derivara igual, y el plan
premium hereda, entonces **el trial regala beneficios de Turista VIP a alguien que todavía no pagó
nada** — y `DEC-ENT-003` **además le bloquea la compra de VIP** mientras se los estemos dando
gratis. No sólo se regala: **se impide vender eso mismo** durante todo el trial.

**El argumento de fondo**: los entitlements del trial se derivan porque **el objetivo es que la
persona pruebe el producto**. VIP es otra cosa — un beneficio cruzado, de otra vertical, que se
vende aparte. Derivarlo mete **una decisión comercial adentro de una derivación técnica**, donde
nadie la ve.

**Lo que esta decisión NO define**: *si* el trial incluye VIP. Define que eso sea **una elección
explícita** en vez de una consecuencia automática de cómo se deriva el plan. El valor por defecto
es una decisión aparte.

- **Costo**: una línea en `V/02` §2.1.
- **Dónde se aplica**: `V/02` §2.1 y `DEC-TRIAL-001`.

---

## D-09 · El trial NO incluye Turista VIP — el valor que `D-08` dejó abierto

**Decidido: no lo incluye.** El plan de trial declara que **no hereda** Turista VIP.

**La razón que decide es `DEC-ENT-003`: mientras alguien tiene VIP, no puede comprarlo.**
Regalarlo durante el trial **bloquea la venta de VIP justo en los días en que esa persona está más
interesada en la plataforma** — el peor momento posible para no poder venderle algo.

**Y la segunda**: al terminar el trial habría que sacárselo. Eso no se percibe como *«se terminó la
prueba»* sino como **que le sacaron algo**, así que la relación de pago arranca con una pérdida en
vez de con una ganancia.

**El argumento en contra** —mostrar el valor completo levanta la conversión— es real, y se
contradice con el primero: **no sirve mostrarle el valor de algo que no se le puede cobrar mientras
se lo mostrás**.

- **Reversible**: es un valor declarado, no una derivación. Cambiarlo es una línea el día que se
  quiera probar lo contrario.

---

## D-10 · `addon_product` se parte por campo, como ya se partió el plan — `R2` #2

**Decidido: se parte.** **Qué otorga** el addon va a verticales, con versión inmutable; **cuánto
sale** va a billing.

**El problema que cierra**: el PDR define la agregación con un ejemplo concreto —*«plan 20 fotos +
addon 30 = 50»*— y **el 30 no tiene dónde vivir**: ningún lugar del modelo guarda qué otorga un
addon. Es `F-8A3-002`, uno de los críticos de `R2`, y seguía intacto.

**Por qué el riesgo es bajo: el criterio no es nuevo.** Es **exactamente el mismo corte que
`11-particion` §2.1 ya hizo** con `plan_version` y `billing_option` — el precio vive en una tabla
hoja y todo lo que está encima es configuración de capacidades. Esta decisión **aplica a la entidad
que había quedado sin partir** un criterio que el programa ya tomó.

**Qué pasaba si no**: además de dejar `F-8A3-002` intacto, el lado verticales tendría que
**preguntarle a billing qué otorga un addon** — el acoplamiento que el corte en dos épicas venía a
impedir.

**Consecuencia útil**: partido el addon, **puede otorgar sin que billing intervenga**, que es lo que
hace falta para que `D-01` —el addon como complemento que agrega capacidades y nunca cobertura— sea
implementable.

- **Costo**: medio — tres entidades nuevas del lado de verticales y una referencia del lado de
  billing.
- **Dónde se aplica**: `V/02` §2.1, `B/02` §2.4, y la ficha de una unidad de cada épica.

> **Con `D-10` quedan cerradas las seis decisiones de `R2`**: `D-01`, `D-05`, `D-06`, `D-07`,
> `D-08`+`D-09` y `D-10`.

---

## D-11 · `RECONCILIATION_REQUIRED` deja de ser un estado y pasa a ser una MARCA — `R1` #2

**Decidido: marca.** La fila **conserva su estado real** y se le agrega una marca de «necesita
intervención».

**Se ratificó expresamente porque contradice una razón que el owner había escrito**, en `B/02`
§2.2: *«si una suscripción necesita intervención humana, la persona tiene que poder contratar de
nuevo sin esperar a que alguien resuelva un caso»*. Por eso el estado había quedado **fuera de los
vivos a propósito**.

**La intención era buena; lo que produjo, no.** Al no verlo el candado, se abrieron **dos críticos
a la vez**: `F-8B1-002` —el preapproval sigue vivo y habilita una segunda suscripción, **dos
cobros**— y `F-8B2-002` —**un estado del que no se sale**, sin destino legal una vez que el cliente
recontrató—.

**Y `R1` encontró la causa de fondo**: escribir `RECONCILIATION_REQUIRED` **en la columna de
estado borra el estado real**. Eso obliga a `S15` a adivinar a dónde volver y **convierte una
alerta en una decisión destructiva automática**, que es lo que el §22.1 prohíbe.

**Por qué la marca no contradice la intención original sino que la cumple mejor**: la razón era
*«que la persona no espere a que alguien resuelva un caso»*. Con la marca **no espera nada: su
suscripción sigue en su estado real y funcionando**. La marca es para el operador, no para el
cliente. La alternativa —dejarlo estado y **meterlo** en los vivos— cierra el doble cobro pero **le
cobra al cliente la espera**, que es exactamente lo que la razón quería evitar.

- **Costo**: medio — es el cambio que más texto toca de todo `R1`.
- **Dónde se aplica**: `B/02` §2.2, `B/03` §3.1 y §3.2, `B/09` §3, `NUCLEO/03`.
- ⚠️ **Candidata a `DEC-` propia**: revisa una razón registrada del owner.

---

## D-12 · La marca NO congela la sucesión desde `CANCEL_SCHEDULED` — `R1` #3

**Decidido: la salida (a).** Una fila marcada **sí puede suceder** cuando está en
`CANCEL_SCHEDULED`.

**El caso**: alguien programó su baja —sigue con servicio hasta que termine el período que pagó—,
tiene una **marca** puesta (`D-11`), y quiere volver antes del vencimiento. Con la marca frenando
la sucesión **no puede**, y se queda afuera sin haberlo elegido. Es el par abierto
`CANCEL_SCHEDULED` × `C9` del dominio de `R1`.

**Por qué la excepción es segura, y es por medición y no por criterio**: en `CANCEL_SCHEDULED` **el
preapproval ya está cancelado**, así que **no puede haber doble cobro**. El peligro que la marca
existe para prevenir **no está presente en ese estado**. No es *«hagamos una excepción porque el
caso es molesto»*: es que **el mecanismo del daño no existe ahí**.

**Por qué no la (b)** —congelar igual y avisar a `SUPER_ADMIN` con plazo—: convierte un problema
técnico en uno operativo y suma a una persona mirando avisos **para evitar algo que en ese estado
no puede pasar**. Y si nadie mira el aviso a tiempo, el cliente pierde el servicio igual, sólo que
ahora por culpa nuestra.

- **Es el único lugar donde la marca admite una excepción demostrablemente segura.**
- **Costo**: bajo. **Dónde se aplica**: `B/03` §3.3 y el §2 de
  [`05-R1-resuelto.md`](./05-R1-resuelto.md).

---

## D-13 · La sucesión se declara como apartamiento del §11 — `R1` #1

**Decidido: se declara**, con `DEC-` propia en el decision log, y **redactada así**:

> **El invariante 8 del §64 cuenta COMPROMISOS, no FILAS.**

**Por qué esa formulación y no *«ahora puede haber dos suscripciones»***: porque **conserva la
política del PDR intacta** y explica por qué dos filas no la violan. Con la sucesión de `R1` el
máximo de filas vivas pasa a dos durante la ventana del cambio de plan, pero **sigue habiendo un
solo compromiso de pago**. Lo que deja de ser literal es el enunciado *sobre las filas*.

**Por qué hay que declararlo**: el PDR **no se edita** (regla 1), así que un apartamiento se
registra como decisión. Hay cuatro precedentes exactos: `DEC-ARCH-003`, `DEC-OBS-001`,
`DEC-METH-004` y `DEC-METH-005`.

**El riesgo de no declararlo es concreto**: alguien lee el §64, ve *«máximo una»* y **«arregla» el
candado de vuelta** — deshaciendo `R1` sin saber que lo está haciendo, y con toda la razón desde su
punto de vista.

- **Costo**: una decisión escrita. **Es la que legitima toda la resolución de `R1`.**
- ⚠️ **`DEC-` propia obligatoria**, no opcional: es un apartamiento declarado del PDR.

---

## D-14 · Toda sucesora nace con fecha de primer cobro a un día como mínimo — `R1` #6

**Decidido: la salida (a).** Ninguna sucesora cobra hoy; lo mínimo es mañana.

**El choque que resuelve** son **dos reglas correctas que no pueden cumplirse a la vez**: `B/12`
§5.2 concluye que en `GRACE_PERIOD` **el crédito es cero** —*«el período en curso no se pagó»*—, así
que la fecha de primer cobro de la sucesora cae **hoy**; y `D8` exige que sea **futura**. Alguien en
mora que quiere mejorar su plan choca contra las dos.

**Por qué la (a) y no declarar que desde grace la precondición es otra**: la (b) es más exacta
conceptualmente, **y por eso es peor**. Le mete **una rama a la precondición de seguridad del
mecanismo más caro del sistema**, y obliga a `G-R1-B` —el guard que vigila `D8`— a **saber de dónde
viene cada sucesión** para saber qué exigir. Un guard con esa forma es un guard que alguien va a
leer mal.

**La (a) es uniforme y verificable sin contexto**: vale para toda sucesión, venga de donde venga, y
deja `D8` como una regla de una sola línea y sin excepciones. El costo es que el cliente espere un
día para el primer cobro del plan nuevo — **a su favor**.

- **Costo**: bajo. **Dónde se aplica**: `B/12` §5.2, `NUCLEO/04` §3 (`D8`), y `G-R1-B`.

---

## D-15 · La cuota en `recycling` puede entrar, y se avisa ANTES — `R1` #7

**Decidido: la salida (b), con el aviso previo como parte de la decisión.** No se cancela la
predecesora antes de tiempo; se acepta que el cobro puede entrar **y se le comunica al cliente
antes de que pase**.

**El caso**: `B/12` §5.3 decide ser generoso —el período impago *«no se compensa con el cobro nuevo
ni se cobra aparte»*—, pero **mientras la predecesora viva su cuota sigue en `recycling`** (`B/12`
§1.3, **medido**) y puede entrar. Si entra dentro de las 72 h de la sucesión, **el cliente paga la
deuda que le perdonamos**.

**Ninguna de las dos salidas es limpia, y se eligió por cuál daño es reversible.** Cancelar la
predecesora en el acto contradice `D7` —*«la vieja se cancela sólo al recibir el webhook de que la
nueva quedó autorizada»*—, que existe por una razón medida: **si se cancela antes y el cliente
abandona el checkout, se queda sin nada**. Ese daño es **silencioso y no se deshace**. El de la (b)
es **un cobro indebido, visible y reversible**.

**Es el mismo criterio que `R5` ya aplicó sin nombrarlo**: entre dos males, el reversible — ahí se
autoriza antes de cancelar porque *un cobro se reembolsa y una cancelación en el proveedor no*
(`PA-5`).

> **El aviso previo no es un adorno: es lo que hace aceptable la decisión.** Un cobro que sorprende
> es un reclamo; uno anunciado es un trámite. Y el reembolso, que es la salida si entra, descansa
> sobre la única capacidad que el cap. 06 §10 declara **en riesgo de plataforma** (`RF-6/7/8`).

- **Costo**: bajo. **Dónde se aplica**: `B/12` §5.3, y el catálogo de correos de `NUCLEO/07`.

---

## D-16 · La renovación dentro de la ventana: se MIDIÓ, y no hay corrección — `R1` #8

**Decidido: se tiró la sonda, y el resultado cierra la decisión.** No hay que elegir entre salidas:
**la salida limpia no existe**, y eso ahora es un hecho medido y no una suposición.

**El caso**: el crédito del cambio de plan se computa **al crear** la sucesora (`DEC-SUB-006`). La
ventana de autorización dura 72 h, así que **si la predecesora renueva dentro de la ventana, el
crédito quedó corto por un ciclo entero**. Corregirlo exige mover la fecha de cobro de la sucesora,
que en ese momento está `pending`.

**Lo que se sabía**: `EX-34` midió que la fecha de una suscripción **viva** es inmutable y que
**falla en silencio**. Pero eso era sobre una **autorizada**, y había razón para dudar: `EX-33` ya
había mostrado que una `pending` acepta cosas que una autorizada no.

**Lo que se midió** — sonda 48, sandbox, 2026-09-19, cuenta `TESTUSER1461768820173121923` (MLA),
registrada como **`EX-39`**:

| | |
|---|---|
| `auto_recurring.start_date` suelto | `200`, **`last_modified` congelado**, fecha sin moverse |
| `next_payment_date` suelto | `200`, ídem |
| `auto_recurring` completo con la fecha adentro | `200`, ídem |
| **control**: `PUT` de `transaction_amount` sobre el MISMO sujeto | `200`, **`last_modified` SÍ se movió**, 2000 → 2500 |

**El control es lo que vuelve concluyente la medición**: separa *«la fecha no se puede mover»* de
*«este objeto no acepta nada»*. Entró el monto, así que **lo bloqueado son las fechas, no el
objeto** — el mismo método que volvió concluyente a `EX-34`.

> **Y el hallazgo es más fuerte que la pregunta**: la inmutabilidad de las fechas **no depende del
> estado**. Vale igual sobre una `pending` que sobre una autorizada, así que `start_date` sirve
> **sólo al crear**, y punto.

**Consecuencia**: `D-16` se resuelve con la **ventana corta** —ofrecer el cambio con ventana
reducida cuando falten pocos días para la renovación— porque **la corrección no existe**. Queda
pendiente definir qué es «pocos días»; es un número, no un mecanismo.

- **Costo de la medición**: cero. Sandbox, sin tarjeta, sujeto propio que no toca nada existente.
- **Un defecto del propio script, corregido**: el aviso *«doscientos que no aplicó»* saltaba
  también en el control —que no pide mover ninguna fecha y sí aplicó—. Lo que delata un `200` vacío
  es que **`last_modified` no se haya movido**, no que la fecha siga igual.

---

## D-17 · Los dos huecos del barrido: la operación NO se ofrece — `R1` #10

**Decidido: en los dos estados la operación no se ofrece, con el motivo explícito en pantalla.**

**Los dos salieron de recorrer los 84 casos sin mirar** y **ningún informe de FASE 8 los tenía**:

| hueco | estado | qué había |
|---|---|---|
| **A** | cambiar de plan **antes de terminar de autorizar** (`PENDING_AUTHORIZATION` × `C2`/`C3`) | **nada**: ningún capítulo lo nombra. El diseño dice qué pasa si reintenta **el mismo** plan —`B/03` §3.4.4, *«no se crea otra, se reusa la vigente»*— y nada de cambiar a otro |
| **B** | cambiar de plan **estando pausado** (`PAUSED` × `C2`/`C3`) | una regla escrita **cuyo destino no existe**: `B/03` §3.3 dice que *«se encola»*, y la cola de `B/12` §2.1 **es de entitlements, no de checkouts**. Y `EX-11` mide que el proveedor **rechaza toda modificación sobre una pausada** |

**Por qué no construir el mecanismo**: **los dos son de superficie, no de modelo, y en ninguno el
cliente queda bloqueado**. En el A tiene un checkout abierto que puede terminar o abandonar —y
abandonarlo lo deja en `ABANDONED`, desde donde sí puede elegir otro—; en el B puede reanudar y
cambiar. Construir la cola del B además exige pelear contra `EX-11`.

**Lo único que faltaba era decir el no en voz alta** en vez de que alguien lo descubra
implementando — que es exactamente cómo se generaron los 141 hallazgos.

- **Mensajes**: A → *«terminá o cancelá el checkout que tenés abierto»*; B → *«reanudá tu
  suscripción para cambiar de plan»*.
- **Dónde se aplica**: `B/19` (superficies) y `B/03` §3.3, que hoy promete una cola inexistente.

---

## No decidible hoy · `F-8B3-002` y el capítulo 13 — `R1` #9

**No es una decisión pendiente del owner: es un bloqueo.** El segundo candado
—`UNIQUE(subscription_id, período)`— cuantifica sobre una columna **que no existe y no se puede
derivar**, y quien la define es **el capítulo 13, el único de los 22 sin escribir**. Se destraba
cuando se decida la pasarela y se escriba ese capítulo.

**Lo que `R1` sí dejó hecho**, y es lo que corresponde: que el candado **figure como inexistente**
en vez de aparecer en un capítulo como si existiera, que **su forma quede nombrada** para que el
capítulo 13 la escriba y no la invente, y que **quede dicho qué lo sostiene mientras tanto — y es
una persona**: `D11`, *«lo que toca plata lo confirma una persona»*.

> **Con `D-17` quedan cerradas las diez decisiones de `R1`**, salvo ésta, que no depende del owner.

---

## D-18 · La unicidad del hash del correo es CONDICIÓN DE APLICACIÓN de `R3` — `R3` #3

**Decidido: la restricción entra en el mismo cambio que `R3`.** No es una tarea suelta: es una
**dependencia**, y queda anotada como tal.

**El caso**: hoy **nadie puede disparar `T1`** —ése era el racimo— así que el segundo trial por
re-registro es **teórico**. `R3` lo vuelve real: apenas se aplique, alguien se registra de nuevo
con el mismo correo, obtiene un `user_id` nuevo, entra en `PRE_TRIAL` y **publica**. Trial gratis,
las veces que quiera.

Es `F-8A2-010`, y **ya tiene su arreglo escrito**: una restricción de unicidad propia sobre el
**hash del correo normalizado**. No hay nada que diseñar; hay que **no olvidarlo**.

**Por qué el orden importa**: aplicar `R3` primero y la restricción después abre una ventana —de
días o semanas— en la que **el §10.2 queda incumplido por la puerta exacta que `DEC-TRIAL-004` y el
hash construyeron para tapar**. Y no hace falta mala fe para encontrarla: se descubre sola.

> **Es el tercer caso del mismo patrón en esta tanda**: *arreglar un bloqueo total vuelve
> alcanzables los bugs que vivían detrás*. Mientras el candado bloqueaba el upgrade, los addons
> cancelados eran teóricos (`D-02`); mientras `T1` no se podía disparar, el segundo trial también.
> **Conviene preguntárselo en cada racimo que se aplique.**

- **Costo**: una restricción de base. **Dónde se aplica**: `V/02`, junto con el cambio de `R3`.

---

## D-19 · El reloj es una segunda clase de actor, y lleva guard — `R3` #2

**Ratificado**: cuando el actor es el reloj, los pasos 5 a 7 se evalúan **por analogía con las doce
acciones administrativas** —la capacidad del actor, no la del sujeto—, la clase se **declara**
transición por transición, y **lleva un guard que verifica su propiedad**.

**El hueco**: `T3` —el vencimiento del trial— **la dispara el reloj**. `V/17` §3.3 declara al
sistema como actor pero **nunca dice cómo se evalúan los pasos 5, 6 y 7 cuando el actor es uno**, y
esos pasos preguntan por el título, las capacidades y el cupo **de alguien que no existe**. Es el
segundo hallazgo nuevo del barrido de `R3`; no estaba en ningún informe de FASE 8.

**Por qué pedía ratificación y no la tomó `R3` solo**: porque **declara una clase nueva** en `V/17`
§3, y ese mismo capítulo dice textual *«a qué clase pertenece una operación se declara, nunca se
infiere»*. Dejarla inferida sería incumplir la regla del capítulo con el que se la resuelve.

**La propiedad que la hace segura, y es lo que el guard vigila**:

> **Una transición de esta clase nunca otorga. `T3` quita.**

**Por qué el guard no es opcional**: el riesgo de la clase es *«bajo mientras la propiedad se
verifique; medio si nadie la verifica»*. Sin verificación es **una puerta abierta con un cartel que
dice no pasar**. Y encaja con `DEC-METH-005`: es un guard que la unidad correspondiente **entrega
desde el día 1**.

**La alternativa descartada** —que cada transición del reloj resuelva por su cuenta— es cómo se
generan las exenciones por ruta: cada job inventando su propia respuesta al paso 5.

- **Costo**: un párrafo, la enumeración, y un guard. **Dónde se aplica**: `V/17` §3.

---

## D-20 · «Sin fecha» se desambigua en el contrato — `R3` #4

**Decidido: se distinguen los dos casos**, como una fila más del campo `hasta`. Entra en el mismo
cambio que `D-01`, `D-04`, `D-05` y `D-06`.

**El caso**: el contrato §2.1 define `hasta` como *«la fecha hasta la que cubre, o **sin fecha**
para un grant permanente»*. Con `R3`, la fuente de trial en `PRE_TRIAL` **también devuelve «sin
fecha»** —todavía no arrancó ningún reloj—, así que el campo pasa a significar dos cosas: *«esto no
vence nunca»* y *«esto todavía no arrancó»*. Un consumidor que asuma la primera **le da cobertura
perpetua a alguien que ni empezó su prueba**, y ése es el error en la dirección cara: **no falla
ruidosamente, regala**.

**Por qué `R3` no lo resolvió solo, y estuvo bien**: el contrato es la frontera y `DEC-ARCH-006`
dice que ninguna épica lo muta sola. `R3` **lo miró y no lo resolvió en el lugar**, que es
literalmente la regla de vigilancia del §4 del contrato.

> **Una buena noticia que `R3` dejó anotada para `R2`**: `PRE_TRIAL` **no es un `tipo` nuevo**. La
> fuente sigue siendo `tipo: TRIAL` y lo único que cambia es a qué `versiónDePlan` apunta. De las
> tres salidas que `F-8A1-002` enumeraba, la elegida es **la que no toca el enum**, así que el
> contrato **no gana un valor más** por culpa de `R3`: sólo hay que desambiguar un campo.

- **Costo**: una fila. **Dónde se aplica**: `12-contrato-de-cobertura.md` §2.1.

---

## D-21 · El evento de activación gana una columna en `vertical` — `R3` #5

**Decidido: una columna en `vertical`**, y **atada a `R3` como condición de aplicación**, igual que
`D-18`.

**El caso**: la resolución de `R3` se apoya en que **cada vertical declara su evento de
activación** —el momento en que el pre-trial pasa a trial corriendo— y **ese valor no tiene columna
en ninguna entidad**. Está medido: `F-8A3-006` (`ALTA`). `vertical` es *«el espejo en base del
enum»* y `plan_version` guarda seis columnas que no lo incluyen.

**Por qué es peor que el agujero de `D-18`**: si se olvida, la regla del «si y sólo si» de `R3`
**queda sin lado izquierdo** y el guard `G-R3` —el que impide sembrar una clave comercial en la
versión de pre-trial— **no puede verificar nada**. O sea: **se aplica la defensa y no defiende, sin
que nada lo avise**. El agujero de `D-18` al menos es visible cuando alguien lo usa.

**Por qué columna y no tabla de configuración**: `vertical` es exactamente donde el diseño ya pone
el espejo del enum, y hoy **hay una sola cosa que configurar**. Crear una tabla para una columna es
adelantarse; si mañana aparece la segunda, pasar de columna a tabla es trivial.

- **Costo**: una columna. **Dónde se aplica**: `V/02` §2.1, junto con el cambio de `R3`.

> **`R3` tiene ahora DOS condiciones de aplicación**: `D-18` (la unicidad del hash del correo) y
> `D-21` (esta columna). Ninguna es opcional y las dos entran en el mismo cambio.

---

## D-22 · El pre-trial GUARDA sus entitlements y el trial los DERIVA, a propósito — `R3` #7

**Ratificado.** Dos planes no vendibles de la misma vertical se comportan al revés, y es
deliberado.

| plan | sus limits y entitlements |
|---|---|
| **de trial** | **no se guardan: se derivan** (`V/02` §2.1) |
| **de pre-trial** | **se guardan** |

**El motivo**: el de trial **tiene de dónde derivarse** —el vendible de `rank` más alto y el más
bajo, dos extremos concretos—. El de pre-trial **no es ninguno de los dos**: es un conjunto mínimo
propio, lo justo para que alguien exista y llegue a publicar, y **no hay fórmula que lo produzca**.

**Por qué se ratifica en vez de aplicarse sin más**, y la razón no es técnica: **es el tipo de
diferencia que alguien unifica después sin entender para qué estaba**. Dentro de seis meses alguien
ve dos planes no vendibles de la misma vertical, uno que deriva y otro que no, **lo toma por una
inconsistencia** y los unifica — y al hacerlo, o el pre-trial pasa a otorgar lo del premium, o el
trial deja de derivarse.

**Lo valioso de esta decisión no es la elección, que es obvia: es que quede el porqué.** Sin él la
asimetría se lee como un descuido; con él, como lo que es — dos planes que resuelven problemas
distintos.

- **Costo**: una siembra por vertical. **Riesgo**: bajo, y acotado por `G-R3` (`D-19`).

---

## D-23 · El criterio se escribe AHORA; la enumeración se arma durante la implementación — `R3` #6

**Decidido: se parte en dos, y la segunda mitad va con guard.**

1. **Ahora**: escribir **el criterio** — qué hace que una operación de dominio pase por el paso 5.
2. **Durante la implementación**: la enumeración, que se arma sola a medida que se construyen las
   superficies.
3. **Y un guard que lo hace cumplir**: toda operación de dominio **declara** si pasa por el paso 5,
   y **el build falla si alguna no lo declara**.

**El problema**: el dominio de `R3` se cerró **por vertical y por estado, no por operación**, porque
**el conjunto de operaciones que pasan por el paso 5 nunca se enumeró**. Lo único enumerado son las
**12 acciones administrativas**, que son **la excepción, no el conjunto**.

**Y hay una regla en uso que nadie escribió**: para decidir que las lecturas de «Mi Cuenta» no
pasan por el paso 5, `R3` usó el criterio *«escribe estado y es auditable»* — **inferido** de cómo
`F-8A2-001` clasifica a `PB1`, y **ausente de todo capítulo**.

**Por qué no enumerar ahora**: enumerar operaciones **contra el diseño en papel produce una lista
que la implementación va a contradecir**. Las operaciones aparecen al construir las superficies, no
antes; una lista escrita hoy nace desactualizada.

> ⚠️ **El guard no es un adorno: es lo único que vuelve segura la postergación.** Sin él, alguien
> agrega una operación dentro de ocho meses, no se pregunta nada, y nadie se entera — la fábrica de
> exenciones por ruta. Con él, *«nadie puede afirmar que revisó todas»* —que es lo que el documento
> de dominios advierte textualmente— se convierte en **«el build no pasa si hay una sin
> clasificar»**, y la enumeración queda **completa por construcción**.

**Es el mismo patrón que `DEC-METH-005`** (los guards corren desde el día 1) **y que `D-19`** (la
clase se declara, nunca se infiere).

- **Dónde se aplica**: `V/17` §3 (el criterio) y la unidad de superficies de verticales (el guard).

---

## D-24 · Las dos `comp` son del owner: van como el Free Forever normal — `R5` #1

**Decidido: `permanent_grant`, exactamente como funcione el Free Forever del diseño nuevo. Nada
especial.** Y **se pueden regenerar de cero si conviene**.

**El dato que lo decide lo aportó el owner, y no estaba en ningún documento**: *«las 2 comp
actuales son mías»*. **No hay un cliente real detrás de ninguna de las dos.**

**Eso desarma la preocupación entera de esta decisión.** El riesgo que `R5` había identificado era
que alguien las transcribiera literalmente según `V/21` §2.3 y **les escribiera un trial que nunca
tuvieron**, convirtiendo un acceso permanente en uno que vence en 30 días. Con el dato del owner,
si eso pasara **el perjudicado sería él mismo y se arregla regenerándolas**.

**Por qué igual se escriben como `permanent_grant`**: es el instrumento del diseño nuevo para *«esta
persona tiene esto sin pagar, indefinidamente»*, y **converge con `D-05`** —el grant anclado al
plan, leyendo su versión vigente—. No hace falta inventar nada para cortesías heredadas: **son el
caso normal**.

> **La consecuencia sobre `R5` es mayor que esta decisión.** El racimo se construyó sobre **ocho
> filas**. Dos de ellas son del owner y **descartables**, así que **el conjunto con riesgo real son
> seis** — y de esas seis, **tres son `abandoned`, sin compromiso de cobro vivo**. Los actos
> irreversibles, el punto de no retorno y el rollback **sólo pesan sobre las tres `trialing`**, que
> son las únicas con preapproval (medido en `EX` del 2026-09-19: 3 de 3, y ninguna de las otras
> cinco).

- **Costo**: cero si se regeneran; dos grants firmados si se migran.

---

## D-25 · Las tres `trialing` son clientes, pero contactables — dato del owner

**Dato que no estaba en ningún documento**: *«las 3 son clientes, pero son amigos míos, a los que
les puedo hablar para que se resuscriban de nuevo si la migración es complicada»*.

Es el dato de mayor apalancamiento de todo `R5`. Las tres `trialing` son las **únicas** de las ocho
con preapproval vivo, y sobre ellas se apoyaba **todo lo pesado del racimo**: el punto de no
retorno, el orden forzado, y la ausencia de rollback. Con esto, **las ocho filas son recuperables
por teléfono**.

---

## D-26 · NO se migra: se cancelan las ocho y quien tenga algo vivo se suscribe de nuevo — `R5` #2, #3

**Decidido: se arranca de cero.** El sistema nuevo **no hereda una sola fila**.

**La opción no existía hasta `D-24` y `D-25`**, porque nadie sabía de quién eran las ocho. `R5`
resolvió la migración correctamente; lo que cambió es que **la migración dejó de hacer falta**.

**Qué cuesta cada camino**:

| | |
|---|---|
| **migrar** | escribir `M1` como unidad de trabajo nueva, el orden forzado, el punto de no retorno **por fila**, y aceptar que el rollback no existe pasado el paso 8 |
| **no migrar** | **tres llamadas** y dos cuentas propias. Las tres `abandoned` no tienen nada vivo que migrar |

**Qué se pierde exactamente, medido**:

- **Nada de plata.** No hay **un solo pago histórico**: ningún comprobante, ninguna serie que
  reconstruir.
- **El «trial ya consumido» de seis personas** —las tres `abandoned` y las tres `trialing`—, que sin
  migrarlo **podrían repetir trial**. Son seis personas conocidas, y tres ya habían abandonado el
  checkout igual.

**El argumento de fondo, y no es de pereza**: se estaba construyendo una migración para **ocho
filas sin un solo pago, todas de gente a la que se puede llamar**. Diseñarla, revisarla, ejecutarla
y garantizar su rollback es **desproporcionado frente a un mensaje de WhatsApp**. Y el beneficio
extra es real: **el sistema nuevo arranca sin una sola fila heredada** — sin transcripciones, sin
estados viejos, sin dudas sobre si algo quedó mal migrado. Es el escenario más limpio posible, y
**sólo está disponible ahora**, mientras son ocho.

### Qué queda sin objeto

**Cuatro de los cinco críticos de `R5` dejan de existir** — no se resuelven: **se eliminan**.

| hallazgo | qué era |
|---|---|
| `F-8A3-004` | la migración dejaba afuera las tres relaciones con trial |
| `F-8B3-006` | transcribía el trial y dejaba los compromisos sin vínculo |
| `F-8C2-001` | el punto de no retorno sin lado elegido |
| `F-8C2-002` | `DEC-MIG-001` y el §2.3 describían dos operaciones distintas |
| `F-8A3-009` (`ALTA`) | nadie ejecutaba la migración |

**Y `M1` no se crea.** La unidad 23 de `R5` #3 deja de tener sujeto.

**El quinto crítico, `F-8C2-005`, sigue abierto a medias**: desaparece el rollback *de las ocho
filas*, y **sigue abierto el rollback del PROGRAMA**, que es otra cosa y `R5` ya había dicho que no
podía escribir.

> ⚠️ **Esta decisión tiene una condición de caducidad, y es la que el owner ya venía siguiendo.**
> `DEC-MIG-002` decidió **seguir tomando altas durante el rediseño**, así que la cartera crece. Con
> ocho filas *«no migrar»* son tres llamadas; **el umbral que `R5` midió está en unas veinte**, y
> arriba de eso deja de ser viable. El aviso que el owner ya se comprometió a dar —*«si veo que
> empiezan a entrar registros nuevos, te aviso»*— **ahora tiene una consecuencia concreta: hay que
> volver a discutir esta decisión.**

- ⚠️ **`DEC-` propia obligatoria**: **supersede en parte a `DEC-MIG-001`**, que definía qué hacer
  con las cinco filas.
- **Dónde se aplica**: los dos `21-migracion.md`, que hoy describen una migración que no va a
  ocurrir.

---

## D-27 · La automatización de Linear queda como está, y va a la lista de dev experience — `R6` #3

**Decidido: la salida (3) por ahora** —dejarla activa y revertir a mano— **con el motivo del owner**:
*«tengo a un agente en Codex trabajando en mejorar todo el dev experience»*. **Queda anotada para
ese trabajo**, igual que `develop` en `DEC-CI-002`, para que no se pierda.

**El mecanismo, para quien lo tome**: el equipo Hospeda tiene **«On PR merge, move to Done»**
activo, y dispara con **cualquier PR cuyo título mencione un issue** — sin magic word y sin chequeo
de completitud. Y `DEC-CI-001` mantiene `validate-pr-title` corriendo en `epic/**`, así que **los
PRs de sub-épica van a llevar `[HOS-NNNN]` porque el CI lo exige**.

**Consecuencia**: cada sub-épica que mergee al paraguas **marca su unidad `Done`**, meses antes de
que exista nada desplegado. Son 22. **Ya pasó dos veces** —PR #1982 cerró `HOS-36`, PR #1983 cerró
`HOS-54`, ambos sin trabajo real y revertidos a mano— y el `CLAUDE.md` del repo lo documenta.

**La salida que se descartó y por qué no era viable**: no poner el `HOS-N` en el título choca de
frente con `C-3`. `validate-pr-title` exige el tag para que un reviewer sepa a qué spec pertenece
cada PR; **sacarlo para esquivar la automatización sería romper una defensa para compensar otra mal
configurada**.

**La salida recomendada, para cuando se tome**: poner la automatización en **`No action`** para el
equipo Hospeda. Quedan los dos caminos válidos que ya se usan — `/closeSpec` y el magic word
deliberado.

> **El riesgo de la (3) mientras dure, dicho una vez**: no es el trabajo de revertir 22 veces, es
> que **alguna no se revierta**. Y durante los meses que dure, **`Done` deja de significar algo en
> el tablero** — que es lo que el `CLAUDE.md` describe como *«no puede coexistir»* con un estado
> real.

- **Es la única de las 33 que se resuelve en una herramienta externa**, no en el repo.

---

## D-28 · La espera se corta en días, no en meses — `R6` #6

**Decidido por el owner**: *«ni en pedo vamos a esperar 3 meses. Si en 3 o 4 días no tenemos
respuesta, empezaremos a desarrollar con lo que tenemos conocido hoy en día»*. Plazo: **hasta el
2026-09-23**.

**La recomendación era una revisión a los 3 meses y estaba mal calibrada.** Razonaba sobre *el
costo de la rama larga* —cuándo un branch se vuelve caro de mergear—; el owner razona sobre **el
costo de no avanzar**, y tiene razón: **el adaptador existe justamente para que lo segundo no
dependa de la pasarela**.

**Y no fuerza nada: `DEC-ARCH-004` ya diseñó esto.** Su **condición B** es *«adaptador falso en
memoria desde el día uno»*, y la ficha de `B1` lo dice textual — **la interfaz de las ocho
capacidades y `G12` se pueden escribir hoy**, porque esa API se define *«por lo que Hospeda
necesita, no por lo que una pasarela ofrece»*. **Lo que esperaba era el adaptador real, no el
contrato.**

**Qué significa «con lo conocido»**: construir contra la interfaz de las ocho capacidades y el
**proveedor falso**, con las **90 filas medidas** de la matriz como referencia de comportamiento.
El adaptador real se escribe cuando se sepa cuál es.

> ⚠️ **Consecuencia operativa que hay que ejecutar**: **doce unidades llevan `status-blocked` en
> Linear**, y con esta decisión *«bloqueada»* pasa a significar otra cosa — no *«no se puede
> empezar»* sino *«su adaptador real espera»*. **Esas etiquetas hay que revisarlas una por una**, y
> es parte de la salida 4 de `DEC-METH-004` (lo publicado).

**Lo que esta decisión NO cambia**: `F-8C2-007` sigue en pie — **decidir la pasarela no destraba
las nueve unidades, reabre la FASE 1C**. Si sale Mobbex, hay que re-medir; lo que el adaptador
compra es que esa re-medición **no invalide lo construido**, sólo el adaptador.

- **Y cierra la mitad «cota» de `F-8C2-014`.** La otra mitad —el nacimiento de la rama— ya estaba
  cerrada.

---

## D-29 · El barrido profundo de seguridad cubre `epic/**` — como REGLA, no para esta épica — `R6` #7

**Decidido: `codeql-staging.yml` barre también el paraguas** — y el owner lo **generalizó**:
*«para todas las épicas que hagamos de ahora en adelante, no sólo ésta»*. Toda rama de integración
de una épica grande, que recién mergea cuando la épica está lista, **lleva barrido profundo**.

**El caso**: `codeql-staging.yml` tiene **`ref: staging` fijo**, así que la rama del paraguas
acumularía **meses de código nuevo sin barrido profundo**, cubierta sólo por **semgrep por diff** —
que mira el cambio y no el conjunto, y por lo tanto **no ve lo que emerge de la combinación** de
cambios que individualmente pasaron.

**Por qué cambió el peso respecto de lo que `R6` había evaluado**: `R6` lo dio por *«menor mientras
el paraguas viva poco, y crece con la espera»*. Con `D-28` —arrancar a desarrollar en días sin
esperar la pasarela— **el paraguas va a vivir más, no menos**: verticales avanza ya y billing
construye contra el proveedor falso.

**El argumento es el mismo que metió `codeql.yml` en `epic/**` en `DEC-CI-001`**: una rama que vive
meses necesita las defensas **más**, no menos. Éste es el barrido profundo en vez del de PR.

**Y la generalización es coherente con lo ya decidido**: `DEC-CI-001` declaró `epic/**` como **tipo
de rama del proyecto, no excepción temporal**, justamente para que la próxima épica no tenga que
volver a decidir esto.

- **Costo**: bajo — una corrida programada o un input, sobre un workflow que ya existe.
- **Se escribe en los dos lugares donde vive la regla**: `DEC-CI-001` y el `CLAUDE.md` del repo.

---

## D-30 · La condición de salida de la FASE 9, y el CICLO 8 ↔ 9 — `R6` #8

**Decidido, y son dos cosas. La segunda la agregó el owner y cambia el método del programa.**

### 1. Cuándo termina la FASE 9

> **Cuando las cuatro salidas de `DEC-METH-004` están cerradas y ningún `CRITICA` queda abierto
> **sin causa declarada**.**

**La parte que hace la definición usable es «sin causa declarada»**: permite terminar con cosas
abiertas —el capítulo 13 no se va a escribir antes— **siempre que cada una diga por qué y de qué
depende**. La alternativa *«ningún `CRITICA` abierto, punto»* **nunca se cumple**: ata el fin de la
fase a algo que la fase no controla.

Cierra el paso 4 de `F-8C2-016`, que `DEC-METH-004` había dejado a medias: aquélla definió cuándo
un **hallazgo** está resuelto, no cuándo la **fase** termina.

### 2. El ciclo: la FASE 8 vuelve a correr sobre lo que la 9 produjo

**Decisión del owner**: *«una vez que 9 decimos ok, listo, volvemos a ejecutar la 8, para
asegurarnos que con los cambios de la 9 no aparece ningún problema nuevo, y si aparece, otra vez
la 9»*.

**Y tiene evidencia en esta misma tanda**: **la FASE 9 ya demostró que puede introducir defectos
nuevos.** `D-01` existe porque el arreglo de `R2` —agregar `ADDON` a las fuentes— **abría un
fail-open que el diseño original no tenía**; `D-20` porque la resolución de `R3` le daba un segundo
significado a un campo del contrato. **Los dos se cazaron de casualidad**, mientras se resolvía otra
cosa. Una pasada 8-bis los habría encontrado sistemáticamente.

**La condición de corte, sin la cual el ciclo no termina**:

> **Se repite hasta que una pasada de FASE 8 no produzca ningún `CRITICA` nuevo.**

**No** *«ningún hallazgo»*: siempre va a aparecer algo menor, y atarlo a cero es la misma trampa
que la definición de salida descartada. Los `ALTA` y `MEDIA` de la última pasada **se registran y
se va a FASE 10 con ellos declarados**.

**Cómo corre la 8-bis: ENTERA, no sólo sobre lo que cambió.** Ratificado por el owner. La causa
raíz del programa es que **las contradicciones viven ENTRE capítulos**, así que atacar sólo los
textos corregidos la volvería ciega a justamente lo que este ciclo busca. Lo que la abarata no es
recortar el alcance sino que **arranca con los 327 casos ya enumerados**: recorre dominios en vez
de descubrirlos.

- ⚠️ **`DEC-` propia obligatoria**: modifica el método del programa, que el PDR §65 define como
  fases en secuencia. **Es un apartamiento declarado más.**
