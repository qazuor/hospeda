---
title: "FASE 7 del paraguas — la estrategia de despliegue que ninguna épica tiene"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-25
status: CURRENT
fase: 7
---

# 16 · La FASE 7 del paraguas

> **Este documento es del paraguas, no de una épica**, igual que
> [`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md). Y por la misma razón: lo que
> describe **no le pertenece a ninguna de las dos**.

**Está escrito qué tiene que contestar, quién lo escribe y para cuándo** — que es lo que faltaba, y
lo que hacía que seis de los diez ítems del §65 no fueran de nadie. ~~**De su contenido hay un ítem
resuelto**, el orden del corte (§4); los otros cinco siguen pendientes.~~ **De su contenido hay dos
ítems resueltos**: el orden del corte (§4) y el rollback, que el owner decidió que **no existe
pasado el paso 3** (§4.3; owner 2026-09-25; FASE 9 completa, `2c`). Los otros cuatro siguen
pendientes.

---

## 1. El hueco, y por qué no se cerraba solo

`DEC-ARCH-007` partió la FASE 7 **por épica**. El problema es que **ninguna de las dos épicas
despliega**: la unidad que llega a `staging` es **el paraguas**, y el paraguas **no tenía fase que
se la escribiera**.

De los diez ítems que el §65 pide para la FASE 7, cuatro encontraron dónde vivir y **seis
quedaron huérfanos**:

| ítem del §65 | dónde vive hoy |
|---|---|
| implementation order · dependency graph | la `descomposicion.md` de cada épica |
| migration | los dos `21-migracion.md` — y desde la decisión de no migrar, **casi sin sujeto** |
| observability | `NUCLEO/08` |
| **rollout** | — |
| **coexistence** | — |
| **staging** | **el §4**, en lo que hace al orden del corte |
| **feature flags** | — |
| **rollback** | ~~—~~ **el §4.3**: sólo hacia adelante pasado el paso 3; antes, la rama de aborto del §4.2 (owner 2026-09-25; FASE 9 completa, `2c`) |
| **acceptance gates** | — |

~~Cuatro de los seis tienen **cero apariciones en todo el diseño del programa**: `rollout`,
`coexistence`, `feature flags` y `rollback`.~~ Cuatro de los seis **tenían** cero apariciones en
todo el diseño del programa (`rollout`, `coexistence`, `feature flags` y `rollback`); `rollback`
quedó decidido en el §4.3 (FASE 9 vuelta 1, `F-8V1C2-015`).

**Por qué no alcanza con que cada épica escriba la suya y después se junten**: es lo que ya pasó y
es lo que produjo el hueco. **Dos mitades que no despliegan no suman una estrategia de
despliegue.**

---

## 2. El momento, y no es una preferencia

> **Se escribe ANTES de que nazca la rama del paraguas.**

La rama todavía no existe —`git ls-remote` devuelve cero— y el desarrollo arranca en días. Después
de que nazca, **la estrategia de despliegue se escribe con código adentro**, que es exactamente la
posición desde la cual una decisión de rollback deja de ser una decisión y pasa a ser una
descripción de lo que ya se hizo.

---

## 3. El rollback es un ítem de esta fase, no una tarea aparte

Están juntos a propósito: **el rollback es uno de los seis ítems huérfanos**. Decidir quién
escribe la FASE 7 del paraguas **es** decidir quién escribe el rollback; separarlos lo deja como
una tarea suelta que nadie toma — que es exactamente ~~su estado hasta ahora, con **la palabra
«rollback» sin aparecer en un solo documento de diseño del programa**~~ el estado en que estuvo
hasta que el §4.3 lo decidió (FASE 9 vuelta 1, `F-8V1C2-015`).

> ⚠️ **Salvedad aceptada de antemano, y es el resultado más valioso posible.** Puede que la
> conclusión honesta sea **que no hay vuelta atrás**. Reemplazar el sistema de cobro no es revertir
> un deploy: si el corte se hizo y hay gente suscripta en el sistema nuevo, volver al viejo
> significa **deshacer compromisos reales con un proveedor externo**.
>
> Si la respuesta es *«no se puede volver, y el punto de no retorno es éste»*, **eso no es un
> fracaso del documento**. Saber dónde está el punto de no retorno y decidir con eso a la vista es
> mucho mejor que **descubrirlo cruzándolo**.

**Y ésa fue la conclusión** (owner 2026-09-25; FASE 9 completa, `2c`): pasado el paso 3 del corte
**sólo se arregla hacia adelante** — *«no va a pasar»*. Antes del paso 3 lo que existe es la rama
de aborto del §4.2, que restaura el backup. El detalle está en el §4.3.

**Lo que este rollback NO es**: el rollback de las ocho filas de la cartera actual. Ése
desapareció con su sujeto cuando se decidió no migrar (los dos `21-migracion.md` §2). El de acá es
el del **programa**, y es de otro tamaño.

---

## 4. El primer ítem escrito: el orden del corte

De los seis huérfanos, éste se escribe ahora porque **su ausencia tiene un costo concreto y
fechado**, no porque sea el más fácil.

### 4.1 El punto de no retorno no desapareció: subió de escala

Decidir que **no se migra** eliminó el punto de no retorno **por fila** —ya no hay ocho
transcripciones que puedan quedar a medias— y **dejó intacto el del programa**, que es el que
importa:

> **Una autorización viva cobra DESPUÉS del despliegue que borró el código capaz de reconocerla.**
> La persona paga, el dinero entra, y del lado de Hospeda **no queda ni servicio ni asiento
> contable**: el sistema que sabía qué era ese identificador ya no existe, y el nuevo nunca lo
> conoció.

Son **tres** las que pueden hacerlo **según nuestra base** —las únicas con preapproval vivo en ella—,
y el hecho de que sean pocas no cambia nada: **un cobro que entra sin asiento no es un problema de
escala.** ⚠️ **Y la base no las ve todas**: el 2026-09-24 el recorrido del proveedor encontró una
cuarta autorización viva que la base no conocía (§4.2), por eso el censo del paso 1b sale del
proveedor.

### 4.2 El orden, y no es una preferencia

| # | paso | quién lo hace | por qué en ese lugar |
|---|---|---|---|
| 0 | **el despliegue, ensayado en staging y verde** —**con una mitad en producción**: sobre un plan propio sin suscriptores (como la sonda 50) se cancela, se reactiva y se abre el link en el navegador; que venda es condición para el 1a. El resto se ensaya en `staging`— (FASE 9 vuelta 1, `F-8V1C2-006`). **Y en producción se mide `EX-42`** (`06-mp-validation-matrix.md`): sobre una `Preference` propia sin pagar, que el `expire` del adaptador de qzpay la vence en el proveedor y que la relectura lo confirma; es la condición del vencimiento del 1a, y si no da, `Y-1` vuelve al owner (owner 2026-09-26, `Y-1`) | — | lo irreversible (paso 1) sólo arranca cuando lo que puede fallar (paso 3) ya se probó (FASE 8 completa, `F-8CC2-004`). **La mitad en producción existe porque la rama de aborto reactiva planes de producción**, y eso un sandbox no lo prueba |
| 0b | **cerrar las altas del sistema viejo**: una regla en el borde (Cloudflare) rechaza toda ruta del viejo que cree o re-autorice un preapproval, o cree una `Preference` o un pago en el proveedor —checkout de suscripción y su reintento, cambio de plan, cambio de medio de pago, compra de addon—, verificada con una petición a cada una que vuelve rechazada. **El 1a no arranca antes de 30 minutos después de verificado el 0b** (owner 2026-09-26, `G4-1`) | quien opera el corte | el censo del 1b sólo cuenta lo que existe al tomarlo; lo que el viejo venda después no lo ve ningún paso (FASE 9 vuelta 1, `F-8V1C2-003`, `F-8V1B3-006`). El dominio es un criterio y no una lista de rutas: **todo canal que cree o re-autorice un preapproval, o cree una `Preference` o un pago**. Los 30 minutos son la vida de la `Preference` de addons del viejo: así todo pago de una preferencia **de addon** abierta entra con el webhook viejo todavía encendido. **La del cambio a un plan más caro no tiene vencimiento** —`initiatePaidPlanUpgrade` crea la preferencia sin `expiresInMinutes`, y el adaptador de qzpay sólo pone `expiration_date_to` si se lo pasan; verificado en el código el 2026-09-26—, **así que los 30 minutos no la acotan**: ~~pregunta `Y-1` al owner~~ **la vence por API la herramienta del corte en el paso 1a y la relee** (owner 2026-09-26, `Y-1`; FASE 9 vuelta 1, `N-G4V-01`; medido en el paso 0 por `EX-42`). **Por qué el borde y no una bandera**: el viejo no tiene interruptor de checkout y agregarle código a un sistema condenado es el argumento con que `12-contrato…` §5.3 descartó el adaptador; `admite_altas` del nuevo dice otra cosa (bloquea `T1` y anuncia una discontinuación) |
| 1a | **cancelar los `preapproval_plan` viejos**, tomados, como los del 1b, **del proveedor** —todo `preapproval_plan` de la cuenta que no esté `cancelled`— y no de `billing_mp_plan` (FASE 9 completa, `DB-3`). **Y vencer por API las `Preference` del cambio de plan del viejo que siguen sin pago**: la herramienta toma los checkouts de cambio de plan (`mode: payment`) que la base vieja registró sin pago acreditado, les pone `expiration_date_to` = ahora con el método `expire` del adaptador de qzpay, y **relee cada una** hasta ver el vencimiento, como todo lo que el corte muta (`D5`; owner 2026-09-26, `Y-1`; FASE 9 vuelta 1, `N-G4V-01`; la medición es `EX-42` de `06-mp-validation-matrix.md`, en el paso 0) | el sistema **viejo** o una llamada verificada | cierra los links públicos que siguen vendiendo; **es reversible** (sonda 50) y por eso va primero. **Una `Preference` sin vencimiento es otro link que vende**: `initiatePaidPlanUpgrade` la crea sin `expiresInMinutes`, así que los 30 minutos del 0b no la acotan y un pago después del corte llegaría sin preapproval, sin lápida y sin marca (`B/09`, «NO cierra»). **No alcanza** a una preferencia creada por fuera de la base vieja, y hoy no hay ese camino |
| 1b | **cancelar TODOS los preapprovals vivos de la cuenta ~~que no sean sondas~~**, **incluidas las sondas salvo las enumeradas abajo** (FASE 9 completa, `DB-1`), tomados del **recorrido sin filtro del proveedor** y no de nuestra base. *«Vivo»* es **todo estado releído distinto de `cancelled`**: `pending`, `authorized` y `paused` (FASE 9 completa, `DB-2`) | el sistema **viejo**, que todavía corre | es el único que sabe hacerlo; después del despliegue ese código no existe. El censo sale del proveedor porque la base no ve las autorizaciones que nunca se vincularon (`F-8CC2-002`, `F-8CB3-001`) |
| 2 | **verificar releyendo cada uno por su id** y confirmar que quedó `cancelled`. **Y verificar que el recorrido fue completo**: el conteo del recorrido tiene que igualar el `total` del paginado, y **todo id conocido** —los de la base y los de los manifiestos de sonda— tiene que aparecer en él; si no, el corte no avanza (owner 2026-09-25; FASE 9 completa, `2f`) | ídem | `D5` ya lo exige para toda mutación, y `RC-2` mide que leer por id es confiable — **buscar no** (`RC-1`). La completitud del recorrido sin filtro no es fila de la matriz: ~~este control la vuelve condición del gate en vez de premisa~~ este control la vuelve condición del gate **para los ids conocidos**; una autorización desconocida que el recorrido omita no la ve ningún control del corte (§4.3; FASE 9 vuelta 1, `F-8V1B3-005`) |
| 2b | **backup de la base** | — | es lo que restaura la rama de aborto si el paso 3 falla con algo ya escrito (owner 2026-09-25; FASE 9 completa, `2e`) |
| 3 | **desplegar** —con la migración estructural, que escribe **el estado de nacimiento y `inactiva_desde` de toda ficha preexistente** (`V/21` §2.4)—, y **apuntar la URL de notificación de la aplicación del proveedor a la ruta del handler nuevo, verificada con una entrega real** (el alta de una sonda propia) antes del paso 4 (FASE 9 vuelta 1, R1, `F-8V1C2-008`). **La sonda se da de alta con una llamada directa a la API del proveedor desde la herramienta del corte, no por una ruta de la aplicación** —la regla del borde cierra las rutas de los dos sistemas, no la API del proveedor—, **y se cancela en el mismo paso, releída `cancelled`, apenas se vio su entrega**; su id va al manifiesto del corte (FASE 9 vuelta 1, `N-G4V-03`) | — | recién acá, y sólo si el paso 2 cerró. **Sin la entrega verificada, un cobro que llegue después del corte no lo recibe nadie**: las preapprovals de producción no llevan `notification_url` propia. **Despliega con sus rutas de alta cerradas en el borde** (checkout de suscripción, cambio de plan, compra de addon), la misma regla del 0b sobre las rutas nuevas. **El paso 3 termina cuando el despliegue está sano, la sonda de la entrega cancelada y el 3b verificado**: la rama de aborto cubre hasta ahí (FASE 9 vuelta 1, `F-8V1A3-005`; owner 2026-09-26, `G4-1`) |
| 3a | **el catálogo de producción**: las data-migrations del catálogo nuevo (verticales con su evento, `admite_altas` y fin de servicio; por vertical, los planes vendibles, el de trial, el de pre-trial y el de piso con sus versiones) corren en el carril de datos del despliegue, después de la migración estructural y antes de que arranque el proceso nuevo. **Y antes del 3b se verifican contra la base de producción** las condiciones de `G-R3` y el espejo del enum de verticales: si no dan, el corte no sigue (FASE 9 vuelta 1, `F-8V1A3-004`) | el despliegue, en su carril de datos | el grant del 3b ancla un plan que tiene que existir, y un catálogo que no cumple `G-R3` le deja al proceso nuevo una resolución sin fuente |
| 3b | **escribir los dos `permanent_grant`** de las cortesías del owner (`B/21` §2.4), **anclados al vendible de `rank` más alto de Alojamiento, en la vertical en que tenían `comp`** (owner 2026-09-26, `G1-3`) | el sistema **nuevo** —la herramienta de B9 (abajo, *«las herramientas del corte»*)— | antes del paso 4, ~~para que esas dos cuentas no pasen por `cubierto` falso~~ **para que esas dos cuentas estén abajo sólo minutos**: sus fichas nacen `UNPUBLISHED_BY_BILLING` como todas y el grant las sube por `PB3` (`V/21` §2.4, punto 3; FASE 9 completa, `DB-7`; FASE 9 vuelta 1, `F-8V1C2-012`) |
| 4 | **sembrar las lápidas** (`B/21` §2.5) con los ids cancelados **y verificados, conocidos por la base o no, sondas incluidas salvo las del manifiesto** (FASE 9 vuelta 1, R6) | ~~el sistema **nuevo**~~ **una persona, con la herramienta del corte (de B11), sobre la base nueva y el manifiesto del 1b** (FASE 9 vuelta 1, R6) | la fila es del esquema nuevo: no puede existir antes del paso 3 |
| 5 | **abrir las altas del sistema nuevo**: se levanta la regla del borde que las tuvo cerradas desde el despliegue, después de verificado el paso 4 (owner 2026-09-26, `G4-1`) | quien opera el corte | es el fin del corte. Hasta acá el sistema nuevo no crea nada en el proveedor, así que la rama de aborto nunca restaura un backup encima de un preapproval vivo (FASE 9 vuelta 1, `F-8V1A3-005`) |

**Las sondas también se cancelan en el paso 1b**, salvo las que tengan una medición abierta el día
del corte, que se enumeran por id en un manifiesto versionado en `mp-probes/` (declarado por
`DEC-METH-015`, FASE 9 completa, `DB-1`). **Causa**: toda sonda viva que cobre después del corte
llega como desconocida. Las enumeradas cobran la tarjeta del owner y caen ~~en la marca por la
precondición de re-vinculación (`B/21` §2.5; owner 2026-09-25, FASE 9 completa, `2b`)~~ **en una
lápida de recepción**: no tienen lápida del corte (el paso 4 no escribe sobre las del manifiesto) y
su `external_reference` no nombra ninguna fila, así que la precondición de re-vinculación no las
re-vincula y el handler escribe al recibir el primer cobro una lápida con `origen_de_lápida =
RECEPCIÓN`, de la que cuelgan el `payment` y la marca `PAGO_TARDÍO_RECHAZADO`; los cobros
siguientes se cuelgan de esa misma marca, un solo caso por sonda (`B/09` §2.4, `B/21` §2.5; owner
2026-09-25, FASE 9 completa, `2b`; owner 2026-09-26, `G3-2`).

**Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons**: se
apagan antes de desplegar y se verifica como parte del paso (declarado por `DEC-METH-015`, FASE 9
completa, `DB-5`). **Causa**: el handler viejo confirma como procesado el evento de un preapproval
que no conoce (`local_row_not_found`), y MercadoPago no reintenta. Si no se apaga, el cliente que
contrata en esa ventana espera hasta el barrido diario.

**El paso 2 es el gate, y es lo único que vuelve segura la secuencia**: si algún plan o preapproval
**no se pudo cancelar**, el corte **no avanza**. Es la misma forma que el programa ya usa en todas
partes —verificar releyendo en vez de creerle al código de estado— aplicada al único momento donde
no hay vuelta atrás.

**La ventana entre el paso 1 y el paso 3 es la parte incómoda, y se declara**: durante ese rato el
sistema viejo sigue corriendo con ~~tres suscripciones canceladas. Si entra un cobro en vuelo, **lo
registra el viejo**~~ **las suscripciones del censo canceladas. Si entra un cobro en vuelo de una que
la base conoce, lo registra el viejo; si es de una que sólo estaba en el proveedor, el viejo no la
reconoce y ~~la recoge, después del paso 4, la marca de la re-vinculación~~** **lo reconoce, después
del paso 4, su lápida**, porque desde R6 todo id cancelado y verificado tiene una, conocido por la
base o no (FASE 9 vuelta 1, R6); qué se hace con ese cobro es de `B/05` §3 y `B/21` §2.5 (owner
2026-09-26, `G3-1`: se asienta sobre la lápida sin marca) (`B/21` §2.5; FASE 9 completa, `CT-3`), que es exactamente lo que queremos — sigue existiendo el lugar donde anotarlo.
Al revés, con el despliegue primero, ese mismo cobro cae en el vacío. *(Lo que el viejo anote en
esta ventana no se conserva después del corte: owner 2026-09-25, FASE 9 completa, `2a`; `B/21` §4.)*
**Y en esa ventana no hay altas**: el 0b las cerró antes del censo, y el sistema nuevo las abre
recién en el paso 5. Esto no suspende `DEC-MIG-002` —su alcance es el rediseño, y el corte es
su final—, pero por esos minutos nadie puede suscribirse, y se avisa en el mismo aviso previo
al paso 1 (owner 2026-09-26, FASE 9 vuelta 1, `G4-1`).

**Por qué no cancelar después de desplegar**, que es el orden intuitivo: el código que sabe cancelar
esos preapprovals **se va con el despliegue**. Cancelarlos después exige hacerlo a mano contra la
API del proveedor, sin idempotencia, sin registro y sin nadie que verifique — y es el caso que este
§ existe para evitar.

~~**El paso 4 es la única escritura del corte, y es a mano.**~~ **El paso 4 es la única escritura
a mano del corte. ~~Las otras dos —`inactiva_desde` en toda ficha preexistente (`V/21` §2.4) y los
dos `permanent_grant` del paso 3b— las hace el sistema nuevo en el paso 3~~** (FASE 9 completa,
`CT-1`). **Las otras tres las hace el sistema nuevo: el estado de nacimiento y `inactiva_desde` de
toda ficha preexistente, en la migración del paso 3 (`V/21` §2.4); los dos `permanent_grant`, en el
3b** (FASE 9 vuelta 1, R1, `F-8V1C2-012`). **El corte no escribe filas de `trial`**: los clientes actuales se tratan como nuevos
(owner 2026-09-25; FASE 9 completa, `2g`; `V/21` §2.4). Las lápidas hacen **reconocible** un
cobro viejo que llegue tarde, que es lo único que ninguna llamada puede evitar. Se escriben sobre
una lista conocida, en la misma tanda en la que se habla con la gente.

~~**Y hay un quinto acto que no es del sistema: las llamadas.** Las fichas publicadas de Alojamiento~~
~~**se despublican la mañana del corte**~~ ~~**las despublica la primera corrida del reconciliador
diario de cobertura, dentro del primer día**: el corte no es un cambio de `cubierto` (no hay valor
anterior), así que `PB2` no dispara por evento (`V/03` §9, `DEC-ARCH-009`; FASE 9 completa, `C-7`)
—es una consecuencia, no una falla (`V/21` §2.4)— y vuelven solas cuando cada dueño contrata.~~
**Y hay un quinto acto que no es del sistema: las llamadas.** Las fichas que estaban a la vista
**nacen `UNPUBLISHED_BY_BILLING`** por la escritura de nacimiento del paso 3 (`V/21` §2.4). Cada
dueño las recupera **publicándolas, que le arranca el trial** (`2g`, `V/03` §9 `PB1`), o
contratando, y entonces vuelven solas por `PB3` (FASE 9 vuelta 1, R1; owner 2026-09-26, `G1-1`).
**El aviso va ANTES del paso 1**, no después: es lo único que
acota cuánto tiempo queda abajo cada ficha. **Va a la población de `B/21` §1.3** —toda persona con
una ficha que no sea `L1` o con una suscripción viva en el sistema viejo, medida el día del corte—,
**y dice qué pasa con su ficha y cómo estrena el trial** (`V/21` §2.4; FASE 9 vuelta 1, R7). ~~Las dos escriben filas del
esquema nuevo, así que **las dos van después de desplegar**~~ **Los grants del 3b y las lápidas del paso 4 escriben filas del esquema nuevo, así que van después de desplegar** (el antecedente de *«las dos»* se perdió al reescribir este párrafo; FASE 9 vuelta 1, §4 punto 2 de `21-verificado-G1`) — y por eso el paso 3 no es el final
del corte, aunque lo parezca.

**El guion del aviso** (FASE 9 vuelta 1, R1, R7 y `F-8V1C2-002`; owner 2026-09-26, `G1-1` y
`G1-4`). Lo que se le dice a cada persona, en la llamada y en el correo:

1. **Qué pasa con su ficha**: el día X queda en pausa, sin perder nada de lo cargado.
2. **Cómo vuelve**: entrar y **tocar «publicar» sobre su ficha**, que le arranca el trial de
   cliente nuevo; o contratar, y entonces vuelve sola. **Durante el trial vuelve una sola
   ficha**; las demás, al contratar (`V/21` «NO cierra»).
3. **Lo que pagó en el sistema viejo no se devuelve**: el período que le quedaba y los addons
   que tenga vigentes se pierden con el corte, y **el trial que estrena lo compensa de hecho**.
   Se dice así, sin prometer una equivalencia (`B/21` «NO cierra»; owner 2026-09-26, `G1-4`).
4. **Que no contrate ni compre nada en el sistema viejo después de este aviso**: lo que pague
   ahí entra en el punto 3.
5. **Lo que va a ver en la ventana**: el correo de baja que le manda el sistema viejo cuando se
   cancela su suscripción, y su ficha abajo (párrafo siguiente). **Y que durante la ventana no
   puede suscribirse ni comprar, ni en el viejo ni en el nuevo**: las altas cierran en el 0b y
   abren en el paso 5 (owner 2026-09-26, `G4-1`).

**Además de la llamada, un correo** a cada persona de la población de `B/21` §1.3, desde el
sistema viejo o desde la casilla del owner, **con el envío registrado en el manifiesto del corte**
(destinatario, fecha, identificador del mensaje): es la evidencia de `B/22` §1.2, antes de que
exista el outbox nuevo (FASE 9 vuelta 1, `F-8V1C2-011`). **Y el punto 3 es la única constancia de
que la pérdida se avisó**: sin ese envío registrado, el reclamo de un cliente no tiene del lado
nuestro nada que mostrar.

**Lo que la persona ve en la ventana** (declarado por `DEC-METH-015`, FASE 9 vuelta 1,
`F-8V1C2-010`): al cancelar el 1b, el viejo recibe cada cancelación ~~, manda su correo de baja y
baja las fichas del dueño~~ y manda su correo de baja. No se suprime: el aviso previo lo anticipa. ~~La ficha que el viejo bajó
entra al corte con `billing_unpublished_at` y nace `UNPUBLISHED_BY_BILLING` (`V/21` §2.4, `L5`),
igual que las otras.~~ **Las fichas no las baja**: el código viejo estampa `billing_unpublished_at` sólo en el cron de vencimiento del trial, y al cancelar una suscripción refresca el caché `entity_subscriptions` sin tocar `lifecycle_state` (`accommodation.dbschema.ts:119`, `subscription-linked-entities.service.ts:89`, verificado en el código el 2026-09-26). **La ficha entra al corte a la vista, como `L8` y no como `L5`, y nace igual `UNPUBLISHED_BY_BILLING`** (`V/21` §2.4): el resultado no cambia, el mecanismo sí (FASE 9 vuelta 1, §4 punto 1 de `21-verificado-G1`). Si hay aborto, la re-suscripción por el link reactivado la republica con la
lógica del viejo. **Causa**: tocar el código viejo para silenciarlo cuesta más que decirlo, y no
mueve plata.

**Las herramientas del corte, y de quién es cada una** (FASE 9 vuelta 1, `F-8V1C2-004`):

1. **Censo, cancelación y verificación** (pasos 1a, 1b y 2) —**incluido el vencimiento de las
   `Preference` del cambio de plan del viejo en el 1a, con su relectura** (owner 2026-09-26,
   `Y-1`)—: un script del repositorio actual,
   con manifiesto de salida, **mergeado y promovido a `main` antes de que la rama del paraguas
   entre a `staging`** —así no hace falta la excepción de hotfix—. Es de esta FASE 7 del paraguas
   y va con la fecha del §2.
2. **Lápidas** (paso 4): **B11** (`B/21` §2.5; R6).
3. **Grants** (paso 3b): **B9** (`B/21` §2.4).
4. **Estado de nacimiento y escritura `C`** (paso 3): **V6** (`V/21` §2.4; R1).
5. **La regla de las altas en el borde** (pasos 0b, 3 y 5, **y su levantamiento en la rama de aborto**, FASE 9 vuelta 1, `N-G4V-04`): configuración de Cloudflare, no
   código de ninguna épica; la aplica y la verifica quien opera el corte, con la lista de rutas
   de cada sistema que cumplen el criterio del 0b (FASE 9 vuelta 1, `G4-1`).

**Por qué el censo sale del proveedor, y no es una hipótesis.** El 2026-09-24 el recorrido sin
filtro de los 108 preapprovals de la cuenta encontró una autorización viva, del propio owner, que
la base no conocía: `f6d89f71…`, creada desde el link del plan Basic, con un cobro de ARS 18.000
vencido esa misma noche. Se canceló antes de que cobrara (`25-fase-8-completa/00-hallazgos.md`
§4). Con el censo de la base, ese preapproval **sobrevivía al corte y cobraba**. Y los cinco planes
viejos seguían `active` con su link vendiendo, medido en el navegador.

**Y el orden no se invierte, aunque el paso 1 sea irreversible.** La FASE 8 completa señaló
(`F-8CC2-004`) que lo irreversible va antes de lo que puede fallar. El remedio no es cancelar al
final, porque eso reabre la razón de arriba: el código que sabe cancelar se va con el despliegue.
El remedio es el **paso 0** y una rama de aborto declarada.

~~**La rama de aborto: si el paso 3 falla después del paso 1.**~~ **La rama de aborto: si algo
falla después del paso 1b** —un preapproval que el paso 2 no ve `cancelled` después de reintentar
la cancelación, un recorrido que el control del paso 2 no da por completo, o el paso 3— (FASE 9
completa, `DB-4`).

1. Se **reactivan los planes** del paso 1a. La sonda 50 midió que un plan cancelado vuelve a
   `active` con un `PUT` y conserva su `init_point`. **Que el link vuelva a vender no se abrió en el
   navegador**: se verifica en el ensayo del paso 0. **Y se levanta la regla del 0b sobre las rutas
   del viejo**, verificada con una petición a cada una que ahora pasa: sin esto, el checkout propio
   del viejo —el preapproval sin plan— seguía rechazado en el borde después del aborto, sin fecha, y
   `DEC-MIG-002` dice que las altas siguen en el sistema actual mientras el rediseño no termine (FASE
   9 vuelta 1, `N-G4V-04`).
2. El sistema viejo **sigue corriendo**: ~~no se desplegó nada.~~ **~~si el paso 3 alcanzó a escribir
   algo~~ si el paso 3 —que termina con el despliegue sano y el 3b verificado— alcanzó a escribir
   algo —la migración estructural, `inactiva_desde` y el estado de nacimiento, los dos grants—, se
   restaura el backup del paso 2b**. **Lo que el backup no puede pisar es un objeto del proveedor,
   y no hay ninguno** ~~:~~ **salvo la sonda de la entrega del paso 3, que no está en el manifiesto del 1b ni en la base restaurada: antes de restaurar se relee por su id y, si no está `cancelled`, se cancela y se verifica** (FASE 9 vuelta 1, `N-G4V-03`). Fuera de ella no hay ninguno: las altas del sistema nuevo siguen cerradas hasta el paso 5 (FASE 9 vuelta
   1, `F-8V1A3-005`; owner 2026-09-26, `G4-1`). Y el viejo vuelve a correr sobre su propio esquema. **Si el paso
   3 alcanzó a reemplazar la imagen**: se vuelve a desplegar la imagen vieja, se reencienden su
   webhook y sus crons (lo inverso de `DB-5`) y se verifican los dos, igual que su apagado (FASE 9
   vuelta 1, `F-8V1C2-007`) (owner 2026-09-25; FASE 9 completa,
   `2e`). Así el reintento del corte escribe `inactiva_desde` con **su** instante, y la regla de
   *«una sola vez»* de la escritura `C` (`NUCLEO/01` §1.2) vale por corte que **termina**. Lo que el
   viejo anotó entre el backup y la restauración se pierde, y no importa: tampoco se conserva
   después de un corte que sale bien (`2a`).
3. Los clientes cuyos preapprovals se cancelaron en el paso 1b **se re-suscriben por el link
   reactivado**. Ese acto no se puede deshacer (`PA-5`).
4. **El costo, declarado y aceptado por el owner el 2026-09-24**: al re-suscribirse al mismo plan,
   el proveedor **ya no les da el trial**, porque lo concede una vez por pagador y plan (medido en
   producción el 2026-08-31, `HOS-1012`; está en el `CLAUDE.md` del repo), así que les cobra en el
   acto. Con la cartera de hoy son tres clientes reales. ~~**Qué se hace con esa diferencia no está
   decidido.**~~ **La diferencia no se devuelve: quien se re-suscribe arranca un trial nuevo desde
   cero** (owner 2026-09-25; FASE 9 completa, `2d`) — en el sistema nuevo, cuando el corte termine,
   porque ahí los clientes actuales se tratan como nuevos (`2g`, `V/21` §2.4).

### 4.3 Lo que este orden NO resuelve

**Qué pasa si el corte hay que revertirlo después del paso 3.** Eso es el rollback del programa,
es el §3, ~~y sigue sin escribirse~~. Lo que este § agrega es que **el punto de no retorno ahora tiene
una ubicación declarada: está entre el paso 2 y el paso 3.**

**Y la decisión está tomada: pasado el paso 3, sólo hacia adelante** (owner 2026-09-25; FASE 9
completa, `2c`: *«no va a pasar»*). Un defecto grave después del paso 3 se arregla sobre el sistema
nuevo; no se vuelve a la imagen vieja ni se cancela en masa lo que creó el sistema nuevo. **Lo que
esto NO cierra**, declarado por `DEC-METH-015` (FASE 9 completa): un defecto grave pasado el paso 3
se arregla bajo presión, con clientes cobrando en el sistema nuevo. **Causa**: la alternativa
—rollback con cancelación masiva— cancela clientes nuevos cuyo trial el proveedor no repite
(`HOS-1012`), y el owner la descartó.

**Una autorización viva que el recorrido sin filtro no devuelve sobrevive al corte** (FASE 9
vuelta 1, `F-8V1B3-005`; declarado por `DEC-METH-015`). **Causa**: el gate del paso 2 compara el
recorrido contra sí mismo —su conteo contra el `total` del paginado— y contra ids conocidos, y la
completitud del recorrido no está medida (`RC-1`); una fuente independiente sería mecanismo nuevo
sobre una API que `R-MP-01` da por discontinuada. Se detecta en su primer cobro, que llega como
desconocido: el handler le escribe una lápida de recepción y la marca `PAGO_TARDÍO_RECHAZADO` le
propone a la persona devolverlo, con **SÍ** (`B/09` §2.4; owner 2026-09-26, `G3-2`).

**Un pago de una `Preference` del viejo con un medio que acredita días después** (efectivo,
ticket) puede llegar cuando el viejo ya no existe (FASE 9 vuelta 1, `F-8V1B3-006`; declarado por
`DEC-METH-015`). **Causa**: el 0b y los 30 minutos acotan las preferencias, no la acreditación
diferida, que no se midió. La población es la de las preferencias ~~abiertas en los minutos previos
al 0b~~ **de addon abiertas en los 30 minutos previos al 0b** —la del cambio de plan del viejo no
vence y no la acota ningún plazo: ~~es la pregunta `Y-1` al owner (FASE 9 vuelta 1, `N-G4V-01`,
`27-cierre-Y-resto.md` §2)~~ **la vence por API la herramienta del corte en el paso 1a y la relee,
con la medición `EX-42` en el paso 0** (owner 2026-09-26, `Y-1`; FASE 9 vuelta 1, `N-G4V-01`)—; el pago llega como desconocido ~~y cae donde cae todo desconocido sin fila (`F-8V1B3-001`)~~
**y hoy no cae en ningún lugar** (FASE 9 vuelta 1, `N-G4V-02`): la lápida de recepción de
`G3-2` se escribe para **un preapproval** desconocido, y un pago de preferencia no tiene
preapproval; y cómo se concilia un pago único sin preapproval es un «NO cierra» de `B/09`, que
no lee órdenes. **Lo que el corte declara es la población y la causa; el vacío lo nombra billing**,
en el «NO cierra» de `B/09` sobre el pago del addon de única vez, que desde `N-G4V-02` dice que
este pago no cae en la lápida de recepción ni en ninguna marca y no lo ve nadie desde adentro. ~~La
coordinación de la población con `Y-1` está en el pedido de `27-cierre-Y-resto.md` §3.~~ **Con `Y-1`
contestada, la población que queda es la de addon** (el «NO cierra» de `B/09` la nombra igual). No se
abre mecanismo propio del corte.

---

## 5. Lo que este documento todavía no contesta

~~**Cinco de los seis ítems huérfanos**, uno por uno — el sexto, `staging`, quedó escrito en el §4 en
lo que hace al orden del corte.~~ **Cuatro de los seis ítems huérfanos** —`rollout`, `coexistence`,
`feature flags` y `acceptance gates`—, uno por uno: `staging` quedó escrito en el §4 en lo que hace
al orden del corte, y `rollback` quedó decidido en el §4.3 (owner 2026-09-25; FASE 9 completa,
`2c`). Ésa es la FASE 7 del paraguas y es trabajo pendiente, con fecha
límite dada por el §2: **antes de que nazca la rama**.

**Una restricción que ya está fijada y lo acota**: `DEC-ARCH-007` decidió que **las dos épicas
llegan juntas**, así que la estrategia no tiene que resolver *«cómo sale una sola»* — no existe
ese caso, y la ausencia de una tercera implementación del contrato de cobertura
([`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md) §5.3) descansa en lo mismo.
