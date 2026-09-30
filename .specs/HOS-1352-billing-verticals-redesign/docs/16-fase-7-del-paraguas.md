---
title: "FASE 7 del paraguas — la estrategia de despliegue que ninguna épica tiene"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-28
status: CURRENT
fase: 7
---

# 16 · La FASE 7 del paraguas

> **Este documento es del paraguas, no de una épica**, igual que
> [`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md). Y por la misma razón: lo que
> describe **no le pertenece a ninguna de las dos**.

**Está escrito qué tiene que contestar, quién lo escribe y para cuándo** — que es lo que faltaba, y
lo que hacía que seis de los diez ítems del §65 no fueran de nadie. ~~**De su contenido hay un ítem
resuelto**, el orden del corte (§4); los otros cinco siguen pendientes.~~ ~~**De su contenido hay dos
ítems resueltos**: el orden del corte (§4) y el rollback, que el owner decidió que **no existe
pasado el paso 3** (§4.3; owner 2026-09-25; FASE 9 completa, `2c`). Los otros cuatro siguen
pendientes.~~ ~~**De su contenido hay cuatro ítems resueltos**~~ **De su contenido hay cinco ítems
resueltos** (revisión del owner, casos vecinos, 2026-09-29, caso 4: suma `rollout`, cerrado por el
§4.4 en lo que hace a ramas y por el §4.2 en el orden de despliegue): el orden del corte (§4), el rollback,
que el owner decidió que **no existe pasado el paso 3** (§4.3; owner 2026-09-25; FASE 9 completa,
`2c`), y `coexistence` y `feature flags`, que **no existen, por decisión** (§1; revisión del owner,
2026-09-28, C2). **Y el congelamiento de `staging` hasta el corte está escrito en el §4.4**
(revisión del owner, 2026-09-28, L3-b). ~~Siguen pendientes `rollout`, en lo que el §4.4 no cubra, y
`acceptance gates`.~~ Sigue pendiente `acceptance gates` (revisión del owner, casos vecinos,
2026-09-29, caso 4).

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
| **rollout** | ~~—~~ **el §4.4**: la épica entra a `staging` recién al final, lista para el corte, y desde ahí `staging` no se promueve a `main` hasta el corte (revisión del owner, 2026-09-28, L3-b). ~~Si el ítem pide algo más, sigue pendiente~~ **Cerrado**: las ramas son el §4.4 y el orden de despliegue es el §4.2 (revisión del owner, casos vecinos, 2026-09-29, caso 4) |
| **coexistence** | ~~—~~ **no existe, por decisión** (revisión del owner, 2026-09-28, C2): no hay convivencia entre el sistema viejo y el nuevo, ni código para sostenerla. El nuevo se despliega entero de una vez, en el paso 3 del corte (§4.2) |
| **staging** | **el §4**, en lo que hace al orden del corte, **y el §4.4**, el congelamiento hasta el corte (revisión del owner, 2026-09-28, L3-b) |
| **feature flags** | ~~—~~ **no existen, por decisión** (revisión del owner, 2026-09-28, C2): ningún interruptor en el código de ninguno de los dos sistemas. La regla del borde de los pasos 0b, 3 y 5 ~~y el apuntado de la URL del 4b~~ y el cierre de la ruta de avisos de los pasos 3 y 4 (verificación corta, 2026-09-29, lote O-B; desde el lote P-A, un Worker del borde que contesta `500`, que es código pero no de ninguno de los dos sistemas) **no son interruptores**: son actos operativos del corte, fechados y verificados, y se quedan. Tampoco lo es `G13` (`V/20` §2), que impide que un build de producción importe la implementación de arranque |
| **rollback** | ~~—~~ **el §4.3**: sólo hacia adelante pasado el paso 3; antes, la rama de aborto del §4.2 (owner 2026-09-25; FASE 9 completa, `2c`) |
| **acceptance gates** | — |

~~Cuatro de los seis tienen **cero apariciones en todo el diseño del programa**: `rollout`,
`coexistence`, `feature flags` y `rollback`.~~ Cuatro de los seis **tenían** cero apariciones en
todo el diseño del programa (`rollout`, `coexistence`, `feature flags` y `rollback`); `rollback`
quedó decidido en el §4.3 (FASE 9 vuelta 1, `F-8V1C2-015`), y `coexistence` y `feature flags`
quedaron cerrados como inexistentes (revisión del owner, 2026-09-28, C2).

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
| 0 | **el despliegue, ensayado en staging y verde** —**con una mitad en producción**: sobre un plan propio sin suscriptores (como la sonda 50) se cancela, se reactiva y se abre el link en el navegador; que venda es condición para el 1a. El resto se ensaya en `staging`— (FASE 9 vuelta 1, `F-8V1C2-006`). **Y en producción se mide `EX-42`** (`06-mp-validation-matrix.md`): sobre una `Preference` propia sin pagar, que ~~el `expire` del adaptador de qzpay~~ **la llamada del script del corte, directa a la API del proveedor** (revisión del owner, 2026-09-28, L3-a) la vence en el proveedor y que la relectura lo confirma; es la condición del vencimiento del 1a, y si no da, `Y-1` vuelve al owner (owner 2026-09-26, `Y-1`). **Y se miden dos cosas que dan el tamaño de la población del cobro sobre la lápida del corte** (owner 2026-09-27, FASE 9 vuelta 2, `R2`): **si cancelar un preapproval corta el reciclado de un registro de cobro abierto** —sobre una sonda propia con un registro en `scheduled` o `recycling` (`RC-6`), se cancela el preapproval y se cambia el medio de pago como en `GR-1`—, y **si una cancelación que se leyó `cancelled` en el `PUT` y en un `GET` inmediato sigue `cancelled` releída horas después** —el código actual registra seis que no (`apps/api/src/services/billing/preapproval-recovery.service.ts:22`, `F-8V2C2-004`)—. **No son condición del corte**: desde `R2` un cobro posterior al día del corte abre marca con cualquier resultado (`B/21` §2.5), así que achican la población y no la cierran; si no se consigue el sujeto antes del corte, quedan sin medir y la regla de la marca cubre igual. **Y se mide con qué fecha lee esa regla un cobro** (`EX-48`; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-a`, `F-8V2B3-002`): la ventana del corte se lee en la fecha del pago que aprobó el registro de cobro y no en el `date_created` del registro, que no se mueve con los reintentos (`B/21` §2.5, `B/02` §2.3). **Sobre una sonda propia con un registro que se rechaza y cobra en un reintento posterior** (`GR-1`, `RC-6`), **se lee por id el pago que lo aprobó y se mide qué campo trae el instante de esa aprobación, distinto del `date_created` del registro**; un campo que dé la fecha del registro, o que no venga en la lectura por id, no sirve. **Ésta no achica una población: es el dato con el que la regla de la marca decide**, así que si ningún campo es confiable la ventana vuelve al owner. **Y es condición del 1b**: el 1b no arranca sin ese dato, como el 1a sin `EX-42`, y si no aparece vuelve al owner antes del corte (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-m`). **Y se cuentan las suscripciones anuales vivas del sistema viejo** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-r`; caso 4 de `29-fase-8-vuelta-2/12-` §5): la segunda corrida del detector del cobro sobre la lápida del corte cae el día siguiente al último `expire_date` de los registros de cobro que la re-verificación lee abiertos (`B/21`, «NO cierra»), y `RC-7` midió ese `expire_date` sobre ciclos de 1 y 2 días. El anual del sistema actual es un preapproval recurrente con `frequency: 12` y `frequency_type: months`, así que sobre él la segunda corrida puede caer hasta un año después del corte. El recuento sale del recorrido del proveedor del 1b, que es el censo, y dice cuántas personas quedan en esa población y hasta cuándo. **No es condición del corte**: dice cuándo cae la segunda corrida y no cambia qué cubre la regla. **Y el owner aporta el hecho: no hay anuales vivas en el sistema viejo ni las va a haber antes del corte** (FASE 9 vuelta 3, owner 2026-09-30, lote F; `DEC-MIG-005`, 📌); el recuento lo confirma el día del corte, y si apareciera alguna, lo pagado tampoco se devuelve (el guion, punto 3). ~~La fila de la matriz está propuesta al owner en el registro de cierre de la verificación de la FASE 9 vuelta 2. La fila de la matriz está propuesta al owner en el registro de la verificación de la FASE 9 vuelta 2.~~ Es la fila `EX-50` de la matriz, acortada al conteo: si hay alguna anual viva, el `expire_date` de su registro de cobro abierto se mide ahí (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-y` y `V2-z4`). **Y se mide la lista de proveedores del seudónimo del correo** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-j4`; `V/02` §2.2): **la distribución de dominios de la tabla de usuarios de producción**, que es el único dato de cuota confiable (**la herramienta sólo cuenta dominios: no exporta ni guarda casillas**; FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-w`), y **la prueba de unos 30 correos** de `29-fase-8-vuelta-2/25-lista-de-proveedores-del-seudonimo.md` §4, **con cuentas receptoras nuevas que crea el owner** en Outlook, Hotmail, Yahoo, Proton, iCloud y Gmail, cada una con una parte local con puntos, aleatoria e improbable, para que ninguna variante sea la casilla de un tercero. Por cada correo se anota la hora, el destinatario exacto, el Message-ID y el resultado: *llegó*, *rebote* con su código y su texto, o *nada a los 30 minutos*, revisado el spam. Un rebote a la variante sin puntos prueba que los puntos cuentan; que llegue, que los ignora; *nada* no prueba nada y se repite. Sondear por SMTP no sirve. **Con el resultado queda fija la lista que lleva el despliegue del paso 3**, porque la primera fila de `trial` la escribe el sistema nuevo y el seudónimo no se recalcula. **Y desde C12 es condición del corte** (revisión del owner, 2026-09-28, C12): la primera fila de `trial` ya no es la del primer cliente nuevo sino la prueba que la migración del paso 3 le escribe a toda la cartera con una ficha a la vista, así que **la lista tiene que estar cerrada y medida antes del corte, y sin medición el corte no avanza**. ~~**No es condición del corte**:~~ Lo que sigue vale para qué entra en la lista, no para si se mide: lo que la tabla de `V/02` §2.2 da como *«si la medición lo confirma»* entra sólo si lo confirma, y lo que la medición muestre fuera de la tabla vuelve al owner y, mientras no conteste, no se aplica; las dos son la lectura que no normaliza ante la duda. ~~La fila de la matriz está propuesta al owner en el registro de la aplicación de la verificación, tramo verticales~~ Es la fila `EX-49` de la matriz (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-y`). **Y junto a `EX-49` se verifica el tope de purgas del plan del borde (Cloudflare)**, antes del 4c: cuál es, y que las 22 purgas por destino del 4c entran en él (`V2-t`). Es una lectura de la configuración del borde y no del proveedor de pagos, así que no lleva fila de matriz (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-z3`). **Y se toman dos recuentos sobre la cartera vieja** (revisión del owner, casos vecinos, 2026-09-29, casos 5 y 6): **si el sistema viejo servía alguna ficha que el corte va a hacer nacer `PURGED` o en `DRAFT` (`L1`, `L5`, `L7`)** en su página, en un listado o en la página de un destino; **si da cero, el paso 4c no tiene sujeto y se saltea**. Y **cuántos dueños tienen más de una ficha a la vista (`L8`) en la misma vertical**: **no es gate**; si da más de cero, vuelve al owner antes del corte, que decide con el número a la vista (`V/21` §2.4). **Y se ensaya en `staging` el Worker que cierra la ruta de avisos en los pasos 3 y 4** (verificación corta, 2026-09-29, lote P-A): se le asigna la ruta de avisos de `staging`, se verifica desde afuera que contesta `500` con su cabecera, con la marca de Webhooks y sin ella, se le quita la ruta y se verifica que la ruta vuelve a contestar la aplicación; con él se mide cuánto dura el cierre (abajo, *«las herramientas del corte»*, punto 5) | — | lo irreversible (paso 1) sólo arranca cuando lo que puede fallar (paso 3) ya se probó (FASE 8 completa, `F-8CC2-004`). **La mitad en producción existe porque la rama de aborto reactiva planes de producción**, y eso un sandbox no lo prueba |
| 0b | **cerrar las altas del sistema viejo**: una regla en el borde (Cloudflare) rechaza toda ruta del viejo que cree o re-autorice un preapproval, o cree una `Preference` o un pago en el proveedor —checkout de suscripción y su reintento, cambio de plan, cambio de medio de pago, compra de addon—, verificada con una petición a cada una que vuelve rechazada. **El 1a no arranca antes de 30 minutos después de verificado el 0b** (owner 2026-09-26, `G4-1`) | quien opera el corte | el censo del 1b sólo cuenta lo que existe al tomarlo; lo que el viejo venda después no lo ve ningún paso (FASE 9 vuelta 1, `F-8V1C2-003`, `F-8V1B3-006`). El dominio es un criterio y no una lista de rutas: **todo canal que cree o re-autorice un preapproval, o cree una `Preference` o un pago**. Los 30 minutos son la vida de la `Preference` de addons del viejo: así todo pago de una preferencia **de addon** abierta entra con el webhook viejo todavía encendido. **La del cambio a un plan más caro no tiene vencimiento** —`initiatePaidPlanUpgrade` crea la preferencia sin `expiresInMinutes`, y el adaptador de qzpay sólo pone `expiration_date_to` si se lo pasan; verificado en el código el 2026-09-26—, **así que los 30 minutos no la acotan**: ~~pregunta `Y-1` al owner~~ **la vence por API la herramienta del corte en el paso 1a y la relee** (owner 2026-09-26, `Y-1`; FASE 9 vuelta 1, `N-G4V-01`; medido en el paso 0 por `EX-42`). **Por qué el borde y no una bandera**: el viejo no tiene interruptor de checkout y agregarle código a un sistema condenado es el argumento con que `12-contrato…` §5.3 descartó el adaptador ~~; `admite_altas` del nuevo dice otra cosa (bloquea `T1` y anuncia una discontinuación)~~ (`admite_altas` salió con la revisión del owner, 2026-09-28, C8). **Y la regla del borde no es un interruptor** (revisión del owner, 2026-09-28, C2): es un acto operativo del corte, fechado y verificado, fuera del código de los dos sistemas |
| 1a | **cancelar los `preapproval_plan` viejos**, tomados, como los del 1b, **del proveedor** —todo `preapproval_plan` de la cuenta que no esté `cancelled`— y no de `billing_mp_plan` (FASE 9 completa, `DB-3`). **Y vencer por API las `Preference` del cambio de plan del viejo que siguen sin pago**: la herramienta toma los checkouts de cambio de plan (`mode: payment`) que la base vieja registró sin pago acreditado, les pone `expiration_date_to` = ahora ~~con el método `expire` del adaptador de qzpay~~ **con una llamada directa a la API del proveedor desde el script del corte** (revisión del owner, 2026-09-28, L3-a), y **relee cada una** hasta ver el vencimiento, como todo lo que el corte muta (`D5`; owner 2026-09-26, `Y-1`; FASE 9 vuelta 1, `N-G4V-01`; la medición es `EX-42` de `06-mp-validation-matrix.md`, en el paso 0) | ~~el sistema **viejo** o una llamada verificada~~ **el script del corte**, con cada llamada verificada (revisión del owner, 2026-09-28, L3-a; abajo, *«las herramientas del corte»*) | **no arranca si el recuento de fichas de Gastronomía y de Experiencia, tomado antes del 1a, da una fila** (`B/21` §1.3, `V/21` §2.4; owner 2026-09-27, FASE 9 vuelta 2, `R9-b`): detenerse antes del 1b no deja nada que restaurar, y el del paso 2 queda como segundo control. Cierra los links públicos que siguen vendiendo; **es reversible** (sonda 50) y por eso va primero. **Una `Preference` sin vencimiento es otro link que vende**: `initiatePaidPlanUpgrade` la crea sin `expiresInMinutes`, así que los 30 minutos del 0b no la acotan y un pago después del corte llegaría sin preapproval, sin lápida y sin marca (`B/09`, «NO cierra»). **No alcanza** a una preferencia creada por fuera de la base vieja, y hoy no hay ese camino |
| 1b | **cancelar TODOS los preapprovals vivos de la cuenta ~~que no sean sondas~~**, **incluidas las sondas salvo las enumeradas abajo** (FASE 9 completa, `DB-1`), tomados del **recorrido sin filtro del proveedor** y no de nuestra base. *«Vivo»* es **todo estado releído distinto de `cancelled`**: `pending`, `authorized` y `paused` (FASE 9 completa, `DB-2`) | ~~el sistema **viejo**, que todavía corre~~ **el script del corte** (revisión del owner, 2026-09-28, L3-a) | **no arranca sin el dato de `V2-a` medido en el paso 0** (qué campo del pago trae el instante de su aprobación): sin él la regla de la marca del cobro sobre la lápida del corte no tiene con qué decidir, y si no aparece vuelve al owner antes del corte (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-m`). ~~Es el único que sabe hacerlo; después del despliegue ese código no existe.~~ **El script no depende de ninguno de los dos sistemas**: habla directo con el proveedor, así que el despliegue del paso 3 no se lo lleva (revisión del owner, 2026-09-28, C2 y L3-a). El censo sale del proveedor porque la base no ve las autorizaciones que nunca se vincularon (`F-8CC2-002`, `F-8CB3-001`) |
| 2 | **verificar releyendo cada uno por su id** y confirmar que quedó `cancelled`. **Y verificar que el recorrido fue completo**: el conteo del recorrido tiene que igualar el `total` del paginado, y **todo id conocido** —los de la base y los de los manifiestos de sonda— tiene que aparecer en él; si no, el corte no avanza (owner 2026-09-25; FASE 9 completa, `2f`). **Y el recuento de fichas de Gastronomía y de Experiencia de la re-verificación (`B/21` §1.3) tiene que dar cero**: la tabla de traducción está escrita sólo para `accommodations`, y si da una fila el corte no avanza (`V/21` §2.4; FASE 9 vuelta 2, `F-8V2A2-006`, `F-8V2A3-003`). **Es el segundo control**: el primero es el mismo recuento antes del 1a (owner 2026-09-27, FASE 9 vuelta 2, `R9-b`). **Y el recuento de cuentas de la cartera que comparten seudónimo en la misma vertical tiene que dar cero** (revisión del owner, 2026-09-28, C12): el seudónimo se calcula con la lista cerrada del paso 0, sobre las cuentas con una ficha `L8`; el `UNIQUE(seudónimo, vertical)` rechaza la segunda prueba y la migración del paso 3 se cae. Se cuenta también antes del 1a, como el de arriba, y **si da más de cero, se decide a mano antes del corte** (`V/21` §2.4) | ídem | `D5` ya lo exige para toda mutación, y ~~`RC-2`~~ `RC-1` mide que leer por id es confiable (FASE 9 vuelta 2, `F-8V2C2-007`: `RC-2` es el historial de pagos) — **buscar no** (`RC-1`). La completitud del recorrido sin filtro no es fila de la matriz: ~~este control la vuelve condición del gate en vez de premisa~~ este control la vuelve condición del gate **para los ids conocidos**; una autorización desconocida que el recorrido omita no la ve ningún control del corte (§4.3; FASE 9 vuelta 1, `F-8V1B3-005`) |
| 2b | **backup de la base** | — | es lo que restaura la rama de aborto si el paso 3 falla con algo ya escrito (owner 2026-09-25; FASE 9 completa, `2e`) |
| 3 | **desplegar** —con la migración estructural, que escribe **el estado de nacimiento y `inactiva_desde` de toda ficha preexistente** (`V/21` §2.4) **y la prueba gratis activa de cada dueño con una ficha a la vista, que arranca en ese instante** (revisión del owner, 2026-09-28, C12; `V/21` §2.4, *«la prueba gratis que escribe el corte»*) **y, antes que las dos, la versión 1 de los plazos de cada mitad, con los ~~quince~~ dieciocho valores, que la escritura `C` y la prueba guardan: la migración falla si alguno está vacío, y el owner fija los ~~cinco~~ ~~ocho~~ cinco sin valor escrito antes del ensayo del corte en `staging`** (verificación corta, 2026-09-29, lote N-H; `NUCLEO/02` §1.5; los tres nuevos, FASE 9 vuelta 3, lote K y `F-8V3B3-003`, con su valor fijado: 7, 7 y 180 días, FASE 9 vuelta 3, owner 2026-09-30, lote R) **y el catálogo de producción, la migración de datos única que antes corría en el 3a, de la que la prueba deriva su plan de trial, sus versiones vigentes y su fin** (FASE 9 vuelta 3, owner 2026-09-30, lote C; `NUCLEO/02` §1.4): **si esa escritura falla a la mitad, falla la migración, el paso 3 no termina y el corte entra en la rama de aborto, que restaura el backup del 2b**, así que no queda un catálogo a medias ni una prueba sin plan ni fin. **Las tres columnas del viejo que lee la tabla de traducción, `owner_suspended`, `plan_restricted` y `billing_unpublished_at`, llegan vivas a esta migración**: sobreviven a `U1` como excepción temporal y nombrada (§4.6), y las borra una migración propia que corre después de la clasificación de `V6`, en el mismo despliegue (FASE 9 vuelta 3, owner 2026-09-30, lote N~~; si es ése o uno posterior al corte lo confirma el owner~~; el mismo despliegue, decidido: FASE 9 vuelta 3, owner 2026-09-30, lote S). **Y antes de migrar, con el contenedor viejo ya apagado, se repiten ~~los tres recuentos del paso 2~~ los dos recuentos del paso 2 y el de dueños con más de una `L8` del paso 0** (Gastronomía y Experiencia, seudónimos repetidos por vertical, dueños con más de una `L8`; la remisión, FASE 9 vuelta 3, verificación, VC3-VT-04), porque el viejo acepta cuentas y fichas hasta que se apaga: si alguno de los dos primeros no da cero, no se migra y entra la rama de aborto; el tercero no es gate, y si cambió se anota para el owner (FASE 9 vuelta 3, F-8V3C2-005; decidido por el owner, que no cierra el alta del viejo en el borde: FASE 9 vuelta 3, owner 2026-09-30, lote T). **Y después de migrar, toda migración del journal de la imagen tiene que figurar en la tabla de migraciones aplicadas de producción**, o el corte no sigue y entra la rama de aborto: es la defensa contra un hotfix del congelamiento que trajo una migración (§4.4) y dejó detrás, por fecha, a las del paraguas. *(Que el migrador de Drizzle saltee las más viejas no está leído, lo deriva `F-8V3C2-006`; por eso va como verificación y no como premisa: FASE 9 vuelta 3, F-8V3C2-006.)*—~~, y **apuntar la URL de notificación de la aplicación del proveedor a la ruta del handler nuevo, verificada con una entrega real** (el alta de una sonda propia) antes del paso 4 (FASE 9 vuelta 1, R1, `F-8V1C2-008`). **La sonda se da de alta con una llamada directa a la API del proveedor desde la herramienta del corte, no por una ruta de la aplicación** —la regla del borde cierra las rutas de los dos sistemas, no la API del proveedor—, **y se cancela en el mismo paso, releída `cancelled`, apenas se vio su entrega**; su id va al manifiesto del corte (FASE 9 vuelta 1, `N-G4V-03`)~~. **El apuntado de la URL y su sonda pasaron al paso 4b, después de las lápidas** (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`). **La migración no borra el contenido de las `L1`**: nacen `PURGED` y su contenido —en la base, sus fotos en el almacenamiento externo y su token de calendario— lo borra el paso 5b, cuando ya no hay aborto (FASE 9 vuelta 2, `F-8V2A3-002`; `V/21` §2.4). ~~**Y la ruta del handler nuevo es distinta de la del viejo**, que la imagen nueva no sirve: el apuntado del 4b es el único~~ ~~interruptor~~ ~~acto que decide desde cuándo le llegan eventos al handler nuevo (un acto operativo del corte, no un interruptor en el código: revisión del owner, 2026-09-28, C2); con la misma ruta ese~~ ~~interruptor~~ ~~acto sería el despliegue y los eventos llegarían antes de las lápidas (FASE 9 vuelta 2, `F-8V2C2-001`, `F-8V2C2-002`)~~ **Y la ruta del receptor nuevo es la misma que la del viejo, `/api/v1/webhooks/mercadopago`, con la marca `source_news=webhooks` en la URL de Webhooks y sin ella en la de IPN, como hoy** (verificación corta, 2026-09-29, lote O-B; medido en hospeda2 el 2026-09-29, `apps/api/src/routes/webhooks/mercadopago/router.ts`, y `B/06` §7), **así que no hay URL que apuntar**. **El borde (Cloudflare) cierra esa ruta antes de que se apague el contenedor viejo** (`DB-5`), verificado con una petición desde afuera que vuelve con el código del cierre, **y la tiene cerrada hasta que el paso 4 escribió y verificó las lápidas**: con la misma ruta el despliegue ya no decide desde cuándo le llegan avisos al receptor nuevo, lo decide la apertura del borde, que es un acto operativo del corte y no un interruptor en el código (C2). **El borde cerrado tiene que contestar un código que el proveedor reintenta**: el único medido es el `500` (`WH-4`), y ~~⚠️~~ la regla de bloqueo del borde contesta un `4xx` (el `403` por defecto; con respuesta propia, un código entre 400 y 499, desde el plan Pro, según la documentación de Cloudflare leída el 2026-09-29), así que ~~cómo contesta pide decisión del owner (`30-revision-del-owner/35-` §3, O-B-1).~~ **la ruta no se cierra con una regla de bloqueo: la cierra un Worker del borde (Cloudflare) al que se le asigna esa ruta, y que mientras la tiene contesta `500` a todo pedido, sin pasarlo al servidor, con una cabecera propia que lo distingue de un `500` de la aplicación** (verificación corta, 2026-09-29, lote P-A). **Se prende** asignándole la ruta, antes de apagar el contenedor viejo, verificado con una petición desde afuera, con la marca de Webhooks y sin ella, que vuelve `500` con esa cabecera; **se apaga** quitándole la ruta, al final del paso 4, con las lápidas verificadas. Es código, pero de ninguno de los dos sistemas: vive con el script del corte (abajo, *«las herramientas del corte»*, punto 5), y no es un interruptor en el código de ninguno (C2). *(La cabecera la derivé y la marco: sin ella la verificación desde afuera no distingue el `500` del Worker del que contesta a propósito la aplicación ante un cobro que no resuelve, HOS-276.)* **Mientras está cerrada, el proveedor recibe ~~error~~ el `500` del Worker y reintenta a la misma URL.** Por la escalera medida (`WH-4`: un duplicado a +0,5 s y reintentos a unos 16 a 20 minutos del duplicado, a unos 35 minutos del anterior y a unas 6 horas del anterior), un aviso emitido apenas se cierra la ruta tiene todavía tres reintentos después de abrir si el cierre dura menos de unos 16 minutos, dos si dura menos de unos 50 y uno si dura menos de unas 7 horas; cuántos hay después del quinto no está medido. **El cierre dura lo que duran el despliegue, el 3a, el 3b y el paso 4**, y esa duración se mide en el ensayo del corte en `staging` (paso 0). Lo que igual se pierda cae en el punto (3) del «NO cierra» de `B/21` (~~⚠️~~ sobre el que el barrido no asienta nada~~: `35-` §3, O-B-2~~, **y que desde el lote P-B lista el detector del día siguiente al corte**, sin abrir marca ni asentar: `B/21`, «NO cierra»; verificación corta, 2026-09-29) | — | recién acá, y sólo si el paso 2 cerró. ~~**Sin la entrega verificada, un cobro que llegue después del corte no lo recibe nadie**: las preapprovals de producción no llevan `notification_url` propia.~~ **Despliega con sus rutas de alta cerradas en el borde** (checkout de suscripción, cambio de plan, compra de addon), la misma regla del 0b sobre las rutas nuevas. ~~**El paso 3 termina cuando el despliegue está sano, la sonda de la entrega cancelada y el 3b verificado**~~ **El paso 3 termina cuando el despliegue está sano, el 3b y el paso 4 verificados y la sonda de la entrega del 4b cancelada**: la rama de aborto cubre hasta ahí (FASE 9 vuelta 1, `F-8V1A3-005`; owner 2026-09-26, `G4-1`; con el paso 4 y el 4b adentro desde la FASE 9 vuelta 2, `F-8V2B3-003`: las lápidas son filas de la base y el backup las restaura) |
| 3a | **el catálogo de producción**: ~~las data-migrations del catálogo nuevo~~ **la migración de datos única del catálogo** (revisión del owner, 2026-09-28, N1, `L1-e`: corre una vez, acá, y nunca más es fuente de nada; de ahí en adelante sólo lo cambian las acciones administrativas del catálogo, `NUCLEO/02` §1.4), ~~**que falla si alguno de los cinco plazos sin valor escrito está vacío; el owner los fija antes del ensayo del corte en `staging`** (revisión del owner, casos vecinos, 2026-09-29, caso 43)~~ (la condición pasó al paso 3, con la versión 1 de los plazos: verificación corta, 2026-09-29, lote N-H) (verticales con su evento ~~, `admite_altas` y fin de servicio~~ (salieron con la revisión del owner, 2026-09-28, C8); por vertical, los planes vendibles, el de trial, el de pre-trial y el de piso con sus versiones, **los precios, los complementos y los códigos promocionales vigentes** ~~**y la primera versión de los plazos de cada mitad**~~ (la versión 1 de los plazos la crea la migración estructural del paso 3, y acá sólo se verifica: verificación corta, 2026-09-29, lote N-H), `NUCLEO/02` §1.5) ~~corren en el carril de datos del despliegue, después de la migración estructural y antes de que arranque el proceso nuevo~~ **se cargan dentro de la migración estructural del paso 3, antes de la prueba del corte, que los lee, como los plazos; este paso sólo los verifica** (FASE 9 vuelta 3, owner 2026-09-30, lote C: la prueba se escribía antes del catálogo que la define, `F-8V3A2-001`, `F-8V3A3-001`). **Y antes del 3b se verifican contra la base de producción** las condiciones de `G-R3` **y las demás validaciones del panel sobre el catálogo y los plazos** (`NUCLEO/02` §1.4 y §1.5; `G-R3` pasó a ser una de ellas, revisión del owner, 2026-09-28, N1) y el espejo del enum de verticales: si no dan, el corte no sigue (FASE 9 vuelta 1, `F-8V1A3-004`) | ~~el despliegue, en su carril de datos~~ **la carga, la migración del paso 3; la verificación, quien opera el corte** (FASE 9 vuelta 3, lote C) | el grant del 3b ancla un plan que tiene que existir, y un catálogo que no cumple `G-R3` le deja al proceso nuevo una resolución sin fuente |
| 3b | **escribir los dos `permanent_grant`** de las cortesías del owner (`B/21` §2.4), **anclados al vendible de `rank` más alto ~~de Alojamiento, en la vertical en que tenían `comp`~~ ~~de la vertical en que tenían `comp`~~ de Alojamiento, en la vertical en que tenían `comp`** ~~—el de Alojamiento, si la cortesía era de Alojamiento—~~ —a la letra de `G1-3`: las dos `comp` que existen son del owner y de Alojamiento, y no va a otorgar otra hasta terminar el programa (owner 2026-09-27, FASE 9 vuelta 2, `R11-3b`: se revierte la corrección de la misma vuelta)—, **con la versión que elige quien opera el corte, aceptada sólo si `políticaDePlan(v).vigente`** (owner 2026-09-26, `G1-3`; `12-contrato…` §2.8; FASE 9 vuelta 2, `F-8V2C1-004`, `F-8V2B3-009`). **Correrla dos veces da lo mismo**: la herramienta saltea el `permanent_grant` que ya escribió para ese beneficiario y esa vertical y no escribe un segundo, como la del paso 4 con sus lápidas (FASE 9 vuelta 2, verificación, caso 2 de `12-` §5, arreglo de texto) | el sistema **nuevo** —la herramienta de B9 (abajo, *«las herramientas del corte»*)— | antes del paso 4, ~~para que esas dos cuentas no pasen por `cubierto` falso~~ ~~**para que esas dos cuentas estén abajo sólo minutos**: sus fichas nacen `UNPUBLISHED_BY_BILLING` como todas y el grant las sube por `PB3`~~ **dentro de lo que la rama de aborto cubre: sus fichas nacen `PUBLISHED` con la prueba del corte, como toda ficha que estaba a la vista, y el grant convierte esas dos pruebas** (FASE 9 vuelta 3, F-8V3A2-008: desde C12 nada nace `UNPUBLISHED_BY_BILLING`) (`V/21` §2.4, punto 3; FASE 9 completa, `DB-7`; FASE 9 vuelta 1, `F-8V1C2-012`) |
| 4 | **sembrar las lápidas** (`B/21` §2.5) con los ids cancelados **y verificados, conocidos por la base o no, sondas incluidas salvo las del manifiesto** (FASE 9 vuelta 1, R6). **Y, con las lápidas verificadas, abrir en el borde la ruta de avisos que cerró el paso 3**, ~~verificado con una petición desde afuera que ya no vuelve con el código del cierre~~ **quitándole la ruta al Worker que la cerró, verificado con una petición desde afuera que ya no vuelve con su cabecera** (verificación corta, 2026-09-29, lote P-A); la abre quien opera el corte (verificación corta, 2026-09-29, lote O-B) | ~~el sistema **nuevo**~~ **una persona, con la herramienta del corte (de B11), sobre la base nueva y el manifiesto del 1b** (FASE 9 vuelta 1, R6) | la fila es del esquema nuevo: no puede existir antes del paso 3. ~~**Y va antes del 4b**: con la URL todavía en el viejo,~~ **Y va con la ruta de avisos cerrada en el borde, y la ruta se abre recién con las lápidas verificadas** (verificación corta, 2026-09-29, lote O-B): ningún evento de un id del manifiesto llega al handler nuevo sin su lápida del corte, así que ninguno se vuelve lápida de recepción con la propuesta de devolver que `G3-1` descartó (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`). **La herramienta saltea el choque con una lápida del corte del mismo id —correrla dos veces da lo mismo— y aborta sin escribir ante cualquier otra fila con ese id**, porque ese choque sólo existe si el orden se rompió y la rama de aborto todavía cubre (`B/21` §2.5) |
| 4b | ~~**apuntar la URL de notificación de la aplicación del proveedor a la ruta del handler nuevo, verificada con una entrega real**~~ **verificar con una entrega real que el receptor nuevo recibe en la ruta que el paso 4 abrió; sin apuntar nada, porque la URL no cambia** (verificación corta, 2026-09-29, lote O-B) (el alta de una sonda propia) (FASE 9 vuelta 1, R1, `F-8V1C2-008`; movido del paso 3 en la FASE 9 vuelta 2, `F-8V2B3-003`). **La sonda se da de alta con una llamada directa a la API del proveedor desde la herramienta del corte, no por una ruta de la aplicación** —la regla del borde cierra las rutas de los dos sistemas, no la API del proveedor—, **y se cancela en el mismo paso, releída `cancelled`, apenas se vio su entrega**; su id va al manifiesto del corte (FASE 9 vuelta 1, `N-G4V-03`). **Su evento escribe una lápida de recepción con la marca `TRANSICIÓN_NO_DECLARADA`**, que es la evidencia de la entrega; la levanta por `S15` quien opera el corte, en este paso (`B/09` §2.4; FASE 9 vuelta 2, `F-8V2B3-004`). ~~**Y la URL del canal IPN, que queda activo, se apunta en el mismo paso a la ruta de IPN del receptor nuevo**: sin eso las entregas IPN siguen yendo a la ruta del handler viejo y no se guarda ninguna (`B/02` §2.7; mediciones del 2026-09-29, M-2).~~ **Y el canal IPN, que queda activo, llega a la misma ruta, sin la marca de Webhooks, y tampoco se apunta**: se verifica en el mismo paso (`B/02` §2.7; mediciones del 2026-09-29, M-2; verificación corta, 2026-09-29, lote O-B). ~~⚠️ **Cómo se verifica ese apuntado no está escrito**: la sonda produce avisos de preapproval por Webhooks y ninguno por IPN, que entrega sólo `payment` (`B/06` §7), y la vuelta atrás lo tiene como su tercera cosa (§4.3); pide decisión del owner (verificación corta, 2026-09-29, VC-cobro-08)~~ **Y se verifica con una entrega real de `payment`** (verificación corta, 2026-09-29, lote N-D): la sonda produce avisos de preapproval por Webhooks y ninguno por IPN, que entrega sólo `payment` (`B/06` §7), así que **la herramienta del corte hace un pago chico con la tarjeta del owner, mira que su entrega IPN quedó guardada en `provider_notification`** (`B/02` §2.7) **y lo devuelve**, con el reembolso releído por id. El pago sale directo por la API de pagos del proveedor, no como una orden, porque las órdenes no avisan por ningún canal (`EX-15`, `B/16` §1.4), y no por una ruta de la aplicación; su id y el de su devolución van al manifiesto del corte. Como la sonda de Webhooks, sin la entrega vista el 4b no termina | quien opera el corte, con la herramienta del corte | **Sin la entrega verificada, un cobro que llegue después del corte no lo recibe nadie**: las preapprovals de producción no llevan `notification_url` propia. **Va después del paso 4** para que los reintentos de lo que el viejo no tragó —un cobro que no resuelve lo responde con 500 a propósito (HOS-276), y lo que llegó durante el rollout falló— lleguen con la lápida ya escrita (FASE 9 vuelta 2, `F-8V2C2-002`)~~.~~ **, y desde el lote O-B lo que lo asegura es el cierre del borde: la ruta se abre al final del paso 4, y este paso ya no mueve nada, sólo mira** (verificación corta, 2026-09-29). ~~⚠️ **A qué URL va el reintento de un evento emitido antes del apuntado no está medido** (`WH-4` midió los reintentos, no su destino), **y no se mide, por decisión del owner** (mediciones del 2026-09-29, M-4): si va a la vieja, ese evento se pierde, y su cobro queda en el punto (3) del «NO cierra» de `B/21` sobre `G3-1`, que el barrido diario relee.~~ **El destino del reintento ya no es una pregunta**: la URL no cambia en ningún momento del corte, así que el reintento va a la misma ruta que el aviso original, y `EX-46` queda sin sujeto (verificación corta, 2026-09-29, lote O-B). ~~⚠️ **Y la ruta vieja no existe entre el paso 3 y el 4b** (verificación corta, 2026-09-29, lote N-A): el despliegue del paso 3 reemplaza la imagen vieja, y su ruta de avisos con ella, y la URL sigue apuntándola hasta este paso, así que en ese rato el proveedor avisa a una ruta que ya no existe, también por los cobros en vuelo del 1b, que dependen de un reintento cuyo destino no está medido (`EX-46`). Cómo se reordenan el 3 y el 4b para cerrarlo pide decisión del owner (`30-revision-del-owner/34-` §3, N-A-2; §4.6)~~ **Y no hay rato en que la ruta no exista**: desde el apagado del contenedor viejo hasta la apertura del paso 4 la ruta está cerrada en el borde, que contesta ~~error~~ `500` desde un Worker (lote P-A) y el proveedor reintenta, también por los cobros en vuelo del 1b (paso 3; lote O-B, que resuelve `30-revision-del-owner/34-` §3, N-A-2) |
| 4c | **revalidar las páginas públicas de toda ficha que nació `UNPUBLISHED_BY_BILLING` o `PURGED`** en la migración del paso 3 *(desde C12 ninguna nace `UNPUBLISHED_BY_BILLING`: la que estaba a la vista nace `PUBLISHED` y no cambia de visibilidad; al paso le quedan las `PURGED` y las `L5`/`L7` que nacen en `DRAFT`, **si el sistema viejo las servía**; si ninguna, no tiene sujeto, revisión del owner, 2026-09-28, C12; **se mide en el paso 0, y si da cero el paso se saltea**, revisión del owner, casos vecinos, 2026-09-29, caso 5)*, en el caché de páginas y en el borde, **verificado pidiendo desde afuera la página de una ficha de cada clase** (FASE 9 vuelta 2, `F-8V2C2-006`). **Y los listados que muestran su tarjeta**: purga, una vez por tipo de ficha, la etiqueta de colección (`list-accom`, `list-gastro` y `list-exp`, `packages/cache-tags/src/vocabulary.ts:84`), que invalida en una sola purga todos los listados y el buscador de ese tipo y no gasta el tope de purgas del plan del borde, y la de la portada, que muestra alojamientos destacados. **Y la página de cada destino, que lista sus alojamientos y el código invalida por su destino y no por una colección** (`packages/service-core/src/revalidation/entity-tag-mapper.ts:75`): **una purga por destino, 22**, con la etiqueta de la página de ese destino; ésas sí cuentan para el tope de purgas del borde (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-t`), y ese tope se verifica en el paso 0 (`V2-z3`). **Verificado pidiendo desde afuera un listado que mostraba la tarjeta de una ficha bajada**, y la página de su destino (FASE 9 vuelta 2, verificación, `N-C-07`, arreglo de texto) | quien opera el corte, con la herramienta del corte de V6 | la escritura de nacimiento es directa y **no es una transición, así que no programa revalidación**: sin este paso la ficha que el corte bajó se sigue viendo en su página y en el buscador hasta que la detección de páginas viejas del código actual la alcance, a las 48 h (`apps/api/src/cron/jobs/page-revalidation.job.ts:11`). **Va después del 4b**, cuando la rama de aborto ya no cubre: revalidar antes y abortar dejaba páginas que dicen *«despublicada»* sobre fichas que el backup restaura a la vista. Correrla dos veces da lo mismo |
| 5 | **abrir las altas del sistema nuevo**: se levanta la regla del borde que las tuvo cerradas desde el despliegue, después de verificado el paso 4 (owner 2026-09-26, `G4-1`) **y el 4b** (FASE 9 vuelta 2) | quien opera el corte | es el fin del corte~~.~~, **salvo el borrado del 5b** **y la foto del paso 6** (revisión del owner, 2026-09-28, C3). Hasta acá el sistema nuevo no crea nada en el proveedor, así que la rama de aborto nunca restaura un backup encima de un preapproval vivo (FASE 9 vuelta 1, `F-8V1A3-005`). **Eso vale para la rama de aborto y para nada más**: la restauración del paso 6 corre con las altas abiertas desde este paso y sí puede restaurar encima de un preapproval vivo, y la rama de aborto, sin pisar ninguno, puede borrar cobros que el receptor nuevo ya confirmó; las dos quedan declaradas en el §4.3 (FASE 9 vuelta 3, owner 2026-09-30, lote J; `F-8V3C2-001`, `F-8V3C2-002`) |
| 5b | **borrar el contenido de las `L1`**, como en `PB12`: en la base, sus fotos en el almacenamiento externo y su token de calendario revocado en el proveedor (`V/21` §2.4) | **una persona, con la herramienta del corte de V6**, sobre las `L1` que todavía tienen contenido; correrla dos veces no hace nada más | es lo único del corte que **destruye** algo afuera de la base —el apuntado del 4b y su sonda se deshacen, esto no—, y por eso va cuando ya no hay aborto (FASE 9 vuelta 2, `F-8V2A3-002`). En la migración del paso 3 dejaba, después de un aborto, fichas restaurables sin fotos y con el calendario desconectado; borrar sólo la base ahí dejaba las fotos sin fila que las nombre. **Hasta el 5b las `L1` son `PURGED` con su contenido**, sin mostrarse en ningún lado |
| 6 ✚ | **reemplazar la historia de migraciones de la base por una foto de la base tal como queda después del corte, y lo mismo con las migraciones de datos del seed** (revisión del owner, 2026-09-28, C3, `L2-a`). En el repositorio, `packages/db/src/migrations/**` pasa a ser **una sola migración de partida**, generada de la base de producción ya cortada, y `packages/seed/src/data-migrations/**` queda vacío, **y en el mismo commit ~~se vacía la lista de pendientes de `G8`, que tenía esas dos historias y nada más~~ salen de la lista de pendientes de `G8` esas dos historias; un build destinado a producción después del corte falla si ~~no está vacía~~ le queda una** (`V/20` §2; revisión del owner, casos vecinos, 2026-09-29, caso 8), **y esa regla la enciende este mismo commit: el despliegue del paso 3 corre antes, con la lista llena, y no falla por ella** (revisión del owner, casos vecinos, 2026-09-29, caso F-B). **En la lista queda la tercera entrada, las carpetas del programa en `.specs/`, que la saca el commit del cierre de HOS-1352** (revisión del owner, casos vecinos, 2026-09-29, caso H-A)~~**, y el trinquete de archivos, que no es de este paso: lo vacían las unidades y el retiro del sistema viejo, y el cierre lo exige vacío** (`V/20` §2; verificación corta, 2026-09-29, lote M-E)~~ (el trinquete salió antes de llegar al código: el sistema viejo sale de la rama en la limpieza del principio, §4.6; verificación corta, 2026-09-29, lote N-A); en producción, **la tabla de migraciones aplicadas y el ledger del seed se reescriben para anotarla como aplicada**, sin correr nada. **Ensayado antes en `staging`** con la misma secuencia, **y con un backup propio de las dos tablas y de la base**, tomado justo antes. **El carril de extras (`packages/db/src/migrations/extras/`) queda afuera del reemplazo** (FASE 9 vuelta 3, F-8V3A3-003): guarda lo que Drizzle no expresa, entre eso el trigger que rechaza todo `DELETE` sobre `trial` (invariante 2) y el que rechaza una postulación durante la espera, y se re-aplica idempotente con `db:apply-extras` después de las migraciones (`CLAUDE.md` raíz, los tres carriles), así que no es historia. **La migración de partida la genera Drizzle**, que ve tablas, columnas, índices, claves foráneas y enums, y no triggers, funciones ni vistas materializadas: esos siguen en el carril de extras. **Lleva además, agregadas en la misma migración, las filas de referencia sin las cuales una base armada desde el repositorio no arranca**: la tabla de claves, el espejo del enum de verticales y la versión 1 de los plazos de cada mitad. **No lleva el catálogo de producción** (planes, precios, complementos, códigos): una base armada desde el repositorio usa los datos de demostración del seed (`NUCLEO/02` §1.4). **Antes de este paso la carga del catálogo vive en la migración estructural del paso 3, que es del carril de migraciones del repositorio**: desde que se mergea hasta que este paso la reemplaza por la foto, la corre toda base que aplique las migraciones, el ensayo del corte en `staging`, las bases de desarrollo y la de CI. En `staging` es lo que se ensaya; ~~**qué hace en desarrollo y en CI, donde el seed carga además los datos de demostración, es pregunta abierta** (registro de la aplicación de la verificación corta de la FASE 9 vuelta 3, VC3-VT-07)~~ **en desarrollo y en CI corre igual, y el seed de demostración no carga catálogo donde ya hay uno**: deja el que la migración escribió, así que los dos no chocan (FASE 9 vuelta 3, owner 2026-09-30, lote AL). La unidad que la corre es una sola, `V6`, dueña de la migración estructural; `V2` construye la pieza que carga y que esa migración llama. **Y el ensayo en `staging` compara** el esquema de una base armada desde el repositorio (partida más extras) con el de la base cortada, triggers, funciones y vistas incluidos: si difieren, el paso no sigue | una persona, con la herramienta del corte de V6 (abajo, *«las herramientas del corte»*) | **Va después del 5b**, cuando la rama de aborto ya no cubre: un aborto restaura el backup del 2b, que tiene la historia vieja, y reemplazarla antes dejaba un backup y una historia que no se corresponden. **Y va el mismo día**: la historia vieja nombra el agrupamiento viejo de Gastronomía y Experiencia (`G8`, `V/20` §2) y el corte es el único momento en que la base se toca a propósito. **El commit del repositorio y la reescritura de las dos tablas van juntos**: si un despliegue corre las migraciones con la historia vieja contra las tablas ya reescritas, intenta aplicar todo de nuevo; nadie corre migraciones entre los dos. **La migración única del catálogo ~~del 3a~~ (desde el lote C, dentro de la del paso 3: FASE 9 vuelta 3, owner 2026-09-30) sale acá**, con las demás: su contenido ya está en la foto. **Y salen las 11 migraciones de datos del seed que importaban el archivo de configuración de planes**, congeladas con sus valores adentro desde que el archivo se borró en la rama (`B/21` §4; revisión del owner, casos vecinos, 2026-09-29, caso 9). **Si algo falla, se restaura el backup de este paso**, que deja la base igual a como terminó el 5b, **y pierde lo que el sistema nuevo escribió desde ese backup, con las altas ya abiertas: declarado en el §4.3** (FASE 9 vuelta 3, owner 2026-09-30, lote J) |

**Las sondas también se cancelan en el paso 1b**, salvo las que tengan una medición abierta el día
del corte, que se enumeran por id en un manifiesto versionado ~~en `mp-probes/`~~ (declarado por
`DEC-METH-015`, FASE 9 completa, `DB-1`). **El que lee el handler de producción antes de cancelar
un preapproval desconocido no puede vivir en `mp-probes/`** (FASE 9 vuelta 3, F-8V3C2-008): esa
carpeta es de la spec, está marcada no productiva y sale del repositorio al cerrar HOS-1352. **Vive
en el código del package del cobro**, versionado con él, así que cada despliegue lo lleva, y el
handler lo importa como un módulo: si falta, el build no compila, y no hay rama *«si no lo
encuentra»*. Agregar o sacar una sonda es un cambio de código con su despliegue. El de
`mp-probes/` queda como registro de las mediciones. *(El lugar exacto del archivo es de la FASE 5,
como el nombre del package; lo derivé y lo marco.)* ~~**Y dónde vive es pregunta abierta del owner**:
`B/09` §2.4 y `B/06` §9 la dejan abierta con otra lectura (una tabla que escribe quien opera el
corte), así que lo de arriba es la lectura que se le recomienda, no una decisión (FASE 9 vuelta 3,
`F-8V3B3-006`, `F-8V3C2-008`).~~ **Dónde vive lo decidió el owner: en el código del package del
cobro, importado como módulo; si falta, no compila** (FASE 9 vuelta 3, owner 2026-09-30, lote V; `F-8V3B3-006`, `F-8V3C2-008`). `B/09`
§2.4 y `B/06` §9 dicen lo mismo.
**Causa**: toda sonda viva que cobre después del corte
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
que no conoce (`local_row_not_found`), y MercadoPago no reintenta. **Eso vale para los eventos de
estado; ante un cobro que no resuelve, el viejo responde 500 a propósito (HOS-276) y MercadoPago
sí reintenta**, igual que todo evento que llegó durante el rollout: esos reintentos le llegan al
handler nuevo recién ~~después del 4b~~ cuando el paso 4 abre la ruta en el borde (verificación corta, 2026-09-29, lote O-B), con las lápidas ya escritas (FASE 9 vuelta 2, `F-8V2C2-002`). **Y el borde la cierra antes de apagar el contenedor**, así que en ese rato el proveedor recibe ~~el error del cierre~~ el `500` del Worker del cierre (verificación corta, 2026-09-29, lote P-A) y no el de una ruta que no existe (paso 3; lote O-B). Si no se apaga, el cliente que
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
del paso 4, su lápida** —el reintento le llega ~~después del 4b~~ cuando el paso 4 abre la ruta en el borde (FASE 9 vuelta 2; verificación corta, 2026-09-29, lote O-B)—, porque desde R6 todo id cancelado y verificado tiene una, conocido por la
base o no (FASE 9 vuelta 1, R6); qué se hace con ese cobro es de `B/05` §3 y `B/21` §2.5 (owner
2026-09-26, `G3-1`: se asienta sobre la lápida sin marca; **si es del día del corte**, owner
2026-09-27, FASE 9 vuelta 2, `R2`) (`B/21` §2.5; FASE 9 completa, `CT-3`), que es exactamente lo que queremos — sigue existiendo el lugar donde anotarlo.
Al revés, con el despliegue primero, ese mismo cobro cae en el vacío. *(Lo que el viejo anote en
esta ventana no se conserva después del corte: owner 2026-09-25, FASE 9 completa, `2a`; `B/21` §4.)*
**Y en esa ventana no hay altas**: el 0b las cerró antes del censo, y el sistema nuevo las abre
recién en el paso 5. Esto no suspende `DEC-MIG-002` —su alcance es el rediseño, y el corte es
su final—, pero por esos minutos nadie puede suscribirse, y ~~se avisa en el mismo aviso previo
al paso 1~~ el owner lo dice en el mismo aviso en persona, previo al paso 1 (owner 2026-09-26, FASE 9 vuelta 1, `G4-1`; revisión del owner, 2026-09-28, C12).

**Por qué no cancelar después de desplegar**, que es el orden intuitivo: ~~el código que sabe cancelar
esos preapprovals **se va con el despliegue**. Cancelarlos después exige hacerlo a mano contra la
API del proveedor, sin idempotencia, sin registro y sin nadie que verifique — y es el caso que este
§ existe para evitar.~~ **ese argumento ya no vale** (revisión del owner, 2026-09-28, C2 y L3-a):
decía que el código que sabe cancelar se iba con el despliegue, y el script del corte no se va con
ningún despliegue. **El orden se sostiene igual por la otra razón, la del §4.1**: una autorización
viva que cobra entre el despliegue y su cancelación llega a un sistema que no la conoce y no deja
asiento; cancelada antes, su cobro en vuelo lo registra el viejo o lo reconoce su lápida (arriba).

~~**El paso 4 es la única escritura del corte, y es a mano.**~~ ~~**El paso 4 es la única escritura
a mano del corte.**~~ ~~**El paso 4 y el 5b son las dos escrituras a mano del corte**~~ **El paso 4, el 5b y el 6 son las tres escrituras a mano del corte** (el 5b, FASE 9
vuelta 2, `F-8V2A3-002`; el 6, revisión del owner, 2026-09-28, C3). ~~Las otras dos —`inactiva_desde` en toda ficha preexistente (`V/21` §2.4) y los
dos `permanent_grant` del paso 3b— las hace el sistema nuevo en el paso 3~~ (FASE 9 completa,
`CT-1`). **Las otras tres las hace el sistema nuevo: el estado de nacimiento y `inactiva_desde` de
toda ficha preexistente, en la migración del paso 3 (`V/21` §2.4); los dos `permanent_grant`, en el
3b** (FASE 9 vuelta 1, R1, `F-8V1C2-012`). ~~**El corte no escribe filas de `trial`**: los clientes actuales se tratan como nuevos
(owner 2026-09-25; FASE 9 completa, `2g`; `V/21` §2.4).~~ **Y la prueba gratis activa de cada dueño
con una ficha a la vista, en la misma migración del paso 3** (revisión del owner, 2026-09-28, C12; `V/21` §2.4): los
clientes actuales se siguen tratando como nuevos, y su prueba arranca el día del corte. Las lápidas hacen **reconocible** un
cobro viejo que llegue tarde, que es lo único que ninguna llamada puede evitar. Se escriben sobre
una lista conocida, en la misma tanda en la que se habla con la gente.

~~**Y hay un quinto acto que no es del sistema: las llamadas.** Las fichas publicadas de Alojamiento~~
~~**se despublican la mañana del corte**~~ ~~**las despublica la primera corrida del reconciliador
diario de cobertura, dentro del primer día**: el corte no es un cambio de `cubierto` (no hay valor
anterior), así que `PB2` no dispara por evento (`V/03` §9, `DEC-ARCH-009`; FASE 9 completa, `C-7`)
—es una consecuencia, no una falla (`V/21` §2.4)— y vuelven solas cuando cada dueño contrata.~~
**Y hay un quinto acto que no es del sistema: las llamadas.** ~~Las fichas que estaban a la vista
**nacen `UNPUBLISHED_BY_BILLING`** por la escritura de nacimiento del paso 3 (`V/21` §2.4). Cada
dueño las recupera **publicándolas, que le arranca el trial** (`2g`, `V/03` §9 `PB1`), o
contratando, y entonces vuelven solas por `PB3` (FASE 9 vuelta 1, R1; owner 2026-09-26, `G1-1`).~~
**Las fichas que estaban a la vista nacen `PUBLISHED` y su dueño amanece con una prueba gratis
activa** (revisión del owner, 2026-09-28, C12; `V/21` §2.4); las que el viejo tenía bajadas nacen en `DRAFT`. Para
quedarse después de la prueba, el dueño contrata, y `T2` la convierte. **El aviso va ANTES del
paso 1**, no después: ~~es lo único que acota cuánto tiempo queda abajo cada ficha~~ es lo único
que acota cuánto de la prueba corre sin que el dueño lo sepa. **Y lo da el owner en persona** (revisión del owner,
2026-09-28, C12): **el sistema no manda ningún aviso del corte**, ni previo ni del día, ni el viejo
ni el nuevo, **salvo el correo de baja que el viejo manda al recibir cada cancelación del 1b, que no
se suprime y el owner anticipa** (abajo, *«lo que la persona ve en la ventana»*; revisión del owner,
casos vecinos, 2026-09-29, caso 1). Lo que el sistema aporta es **la lista de a quién avisar, en sólo lectura**, que arma
el script del corte (abajo, *«las herramientas del corte»*). **Y se le recuerda al owner cuando se
acerque la fecha del corte**, porque sin ese aviso nadie más lo da. **Va a la población de `B/21` §1.3** —toda persona con
una ficha que no sea `L1` o con una suscripción viva en el sistema viejo, medida el día del corte—,
**y dice qué pasa con su ficha y cómo estrena el trial** (`V/21` §2.4; FASE 9 vuelta 1, R7).
~~**Al titular de una autorización que sólo conoce el proveedor el aviso le llega después del 1b**,
en la llamada y el correo al pagador que trae el manifiesto: no hay de dónde conocerlo antes (`B/21`
§1.3 y «NO cierra»; owner 2026-09-27, FASE 9 vuelta 2, `R21`).~~ **Al titular de una autorización
que sólo conoce el proveedor el aviso también le llega antes** (owner 2026-09-27, FASE 9 vuelta 2,
`R21-b`): **antes del aviso previo, una pasada de sólo lectura sobre el proveedor** —el recorrido
sin filtro del 1b, sin cancelar— lista las autorizaciones vivas con su `payer_email` y suma a la
población a los titulares que la base no conoce. **Pero ese campo, medido, viene vacío**: el `GET`
por id del preapproval no devuelve el correo real (`EX-19`), y `payer_id` no identifica a la
persona (`EX-56`). **Si otra lectura trae al pagador se mide en sandbox antes del corte** (`EX-59`: el
recorrido sin filtro del buscador, o el pago asociado a un registro de cobro de ese preapproval), y
la pasada toma el pagador de la lectura que lo traiga. **Si ninguna lo trae, el titular que sólo
conoce el proveedor no tiene detector**, y así queda declarado en el §4.3: la pasada sabe que existe,
no a quién llamar (FASE 9 vuelta 3, owner 2026-09-30, lote G; `F-8V3B3-001`).
El 1b cancela después, como está; el titular que
aparezca recién en su manifiesto recibe ~~la llamada y el correo~~ la llamada del owner después del 1b (`B/21` §1.3 y «NO
cierra»; sin correo del sistema, revisión del owner, 2026-09-28, C12). ~~Las dos escriben filas del
esquema nuevo, así que **las dos van después de desplegar**~~ **Los grants del 3b y las lápidas del paso 4 escriben filas del esquema nuevo, así que van después de desplegar** (el antecedente de *«las dos»* se perdió al reescribir este párrafo; FASE 9 vuelta 1, §4 punto 2 de `21-verificado-G1`) — y por eso el paso 3 no es el final
del corte, aunque lo parezca.

**El guion del aviso** (FASE 9 vuelta 1, R1, R7 y `F-8V1C2-002`; owner 2026-09-26, `G1-1` y
`G1-4`). Lo que ~~se le dice a cada persona, en la llamada y en el correo~~ el owner le dice a cada persona, en persona (revisión del owner, 2026-09-28, C12):

1. ~~**Qué pasa con su ficha**: el día X queda en pausa, sin perder nada de lo cargado.~~ **Qué
   pasa con su ficha**: el día X **sigue publicada**, sin perder nada de lo cargado, y **ese día
   arranca su prueba gratis** de cliente nuevo (revisión del owner, 2026-09-28, C12).
2. ~~**Cómo vuelve**: entrar y **tocar «publicar» sobre su ficha**, que le arranca el trial de
   cliente nuevo; o contratar, y entonces vuelve sola. **Durante el trial vuelve una sola
   ficha**; las demás, al contratar (`V/21` «NO cierra»).~~ **Cómo se queda**: contratando antes
   de que venza la prueba. Si no contrata, al vencer la ficha baja, y vuelve sola el día que
   contrate (revisión del owner, 2026-09-28, C12).
3. **Lo que pagó en el sistema viejo no se devuelve**: el período que le quedaba y los addons
   que tenga vigentes se pierden con el corte~~, y **el trial que estrena lo compensa de hecho**~~.
   Se dice así, sin prometer una equivalencia (`B/21` «NO cierra»; owner 2026-09-26, `G1-4`).
   **Y sin decirle que la prueba lo compensa**: no es verdad para todo el que pagó, y *«no se
   devuelve»* vale para todas las suscripciones, mensuales o no (FASE 9 vuelta 3, owner 2026-09-30,
   lote F; `F-8V3C2-004`). El hecho que lo acota lo aporta el owner: no hay anuales vivas en el
   sistema viejo ni las va a haber antes del corte (paso 0).
4. **Que no contrate ni compre nada en el sistema viejo después de este aviso**: lo que pague
   ahí entra en el punto 3.
5. **Lo que va a ver en la ventana**: el correo de baja que le manda el sistema viejo cuando se
   cancela su suscripción ~~, y su ficha abajo~~ (párrafo siguiente; la ficha a la vista no baja
   desde C12). **Y que durante la ventana no
   puede suscribirse ni comprar, ni en el viejo ni en el nuevo**: las altas cierran en el 0b y
   abren en el paso 5 (owner 2026-09-26, `G4-1`).

~~**Además de la llamada, un correo** a cada persona de la población de `B/21` §1.3, desde el
sistema viejo o desde la casilla del owner, **con el envío registrado en el manifiesto del corte**
(destinatario, fecha, identificador del mensaje): es la evidencia de `B/22` §1.2, antes de que
exista el outbox nuevo (FASE 9 vuelta 1, `F-8V1C2-011`). **Y el punto 3 es la única constancia de
que la pérdida se avisó**: sin ese envío registrado, el reclamo de un cliente no tiene del lado
nuestro nada que mostrar.~~ **Sin correo del sistema** (revisión del owner, 2026-09-28, C12): el
aviso es el del owner en persona, y ningún sistema lo manda ni lo registra. **Y tampoco se registra
a mano**: la lista que arma el script dice a quién avisar, no a quién se avisó ni cuándo, y el owner
no anota nada en ella (revisión del owner, casos vecinos, 2026-09-29, caso 2, contra la
recomendación). **Lo que eso deja, aceptado por el owner**: si un cliente reclama después que no le
avisaron de la pérdida del punto 3, no hay registro que lo muestre (`B/21`, «NO cierra»).

**Lo que la persona ve en la ventana** (declarado por `DEC-METH-015`, FASE 9 vuelta 1,
`F-8V1C2-010`): al cancelar el 1b, el viejo recibe cada cancelación ~~, manda su correo de baja y
baja las fichas del dueño~~ y manda su correo de baja. No se suprime: ~~el aviso previo lo anticipa~~ el aviso en persona del owner lo anticipa (revisión del owner, 2026-09-28, C12; ~~si ese correo del viejo choca con C12 lo decide el owner, `30-revision-del-owner/11-` §4~~ **decidido: el código viejo no se toca y el correo sale, como la única excepción declarada a que el sistema no manda ningún aviso del corte; el owner lo anticipa en su aviso en persona, punto 5 del guion** (revisión del owner, casos vecinos, 2026-09-29, caso 1)). ~~La ficha que el viejo bajó
entra al corte con `billing_unpublished_at` y nace `UNPUBLISHED_BY_BILLING` (`V/21` §2.4, `L5`),
igual que las otras.~~ **Las fichas no las baja**: el código viejo estampa `billing_unpublished_at` sólo en el cron de vencimiento del trial, y al cancelar una suscripción refresca el caché `entity_subscriptions` sin tocar `lifecycle_state` (`accommodation.dbschema.ts:119`, `subscription-linked-entities.service.ts:89`, verificado en el código el 2026-09-26). **La ficha entra al corte a la vista, como `L8` y no como `L5`, y nace ~~igual `UNPUBLISHED_BY_BILLING`~~ `PUBLISHED`, con la prueba del dueño** (`V/21` §2.4; revisión del owner, 2026-09-28, C12): el resultado no cambia, el mecanismo sí (FASE 9 vuelta 1, §4 punto 1 de `21-verificado-G1`). Si hay aborto, la re-suscripción por el link reactivado la republica con la
lógica del viejo. **Causa**: tocar el código viejo para silenciarlo cuesta más que decirlo, y no
mueve plata.

**Las herramientas del corte, y de quién es cada una** (FASE 9 vuelta 1, `F-8V1C2-004`):

1. **Censo, cancelación y verificación** (pasos 1a, 1b y 2) —**incluido el vencimiento de las
   `Preference` del cambio de plan del viejo en el 1a, con su relectura** (owner 2026-09-26,
   `Y-1`), **y la pasada de sólo lectura antes del aviso previo, que es el mismo recorrido del 1b
   sin cancelar** (owner 2026-09-27, FASE 9 vuelta 2, `R21-b`)—: ~~un script del repositorio actual,
   con manifiesto de salida~~ **un script suelto, fuera de los dos sistemas** (revisión del owner,
   2026-09-28, C2 y L3-a), con manifiesto de salida —**que trae, por cada id, su pagador (`payer_email`)** (owner
   2026-09-27, FASE 9 vuelta 2, `R21`), **de la lectura que lo traiga, si alguna lo trae** (arriba;
   FASE 9 vuelta 3, lote G)— ~~, **mergeado y promovido a `main` antes de que la rama del paraguas
   entre a `staging`** —así no hace falta la excepción de hotfix—~~. **El manifiesto no se
   versiona**, porque lleva el correo de cada pagador y el historial de git no se borra: vive fuera
   del repositorio, en el almacenamiento de quien opera el corte, **hasta el día siguiente a la
   segunda corrida del detector**, y ahí se borra. De él dependen las lápidas del paso 4, que ya son
   filas de la base, y la fecha de esa segunda corrida (punto 2) (FASE 9 vuelta 3, F-8V3C2-007).
   **No importa código del sistema
   viejo ni del nuevo, ni de qzpay**: habla directo con la API del proveedor (lee, cancela, vence y
   relee por id) y lee la base vieja sólo para los checkouts del 1a y los ids conocidos del paso 2.
   **Arma la lista de a quién avisa el owner**, en sólo lectura: la población de `B/21` §1.3 más
   los titulares que la pasada del proveedor suma, con su `payer_email` si alguna lectura lo trae
   (FASE 9 vuelta 3, lote G); **no le escribe ni le
   manda nada a nadie** (C12). No se despliega con ninguno de los dos sistemas: lo corre quien
   opera el corte, y **se archiva terminado el corte**. **Vive versionado en el repositorio, en
   `scripts/cutover/`, y archivarlo es borrarlo en un commit posterior al corte**: queda en el
   historial de git (revisión del owner, casos vecinos, 2026-09-29, caso 3). **Y como está
   versionado, queda bajo `G8`**: el recuento de Gastronomía y Experiencia del 1a y los checkouts
   del viejo pueden necesitar nombrar el dominio viejo de las suscripciones, y el script **arma ese
   valor sin escribir la palabra de corrido, como el propio `G8`**, así que no entra a la lista de
   pendientes, ~~que sigue en dos~~ **ni a sus tres carpetas ~~ni a su trinquete de archivos~~** (verificación corta, 2026-09-29, VC-VT-11, y lote M-E; el trinquete salió con el lote N-A) (revisión del owner, casos vecinos, 2026-09-29, caso F-D). Versionado no quiere
   decir desplegado: ninguna imagen lo lleva, y se corre desde una copia del repositorio. Es de esta FASE 7 del paraguas y va con la
   fecha del §2.
2. **Lápidas** (paso 4): **B11** (`B/21` §2.5; R6). **Y el detector posterior al corte**, la consulta
   que lista las lápidas del corte con `payment` **y, en su primera corrida, los cobros del día del corte que el proveedor da aprobados y no tienen `payment`, sin abrir marca ni asentar** (verificación corta, 2026-09-29, lote P-B): la construye **B11** y la corre quien opera el
   corte, el día siguiente al corte y el día siguiente al último `expire_date` de los registros de
   cobro que la re-verificación leyó abiertos (`B/21` «NO cierra»; owner 2026-09-27, FASE 9 vuelta
   2, `R2`). **Un registro abierto que es el de un alta no trae `expire_date`** (`RC-7`), ~~y con
   qué fecha entra a la segunda corrida es pregunta abierta del owner, la misma de `B/21` §1.3
   (FASE 9 vuelta 3, `F-8V3B3-004`)~~ **y entra a la segunda corrida con su fecha de creación más
   un ciclo; y la segunda corrida lista igual todo registro de esos ids que siga abierto**, tenga o
   no `expire_date` (FASE 9 vuelta 3, owner 2026-09-30, lote X; `F-8V3B3-004`; `B/21` §1.3). **La segunda corrida la agenda quien opera el corte, el mismo día**: la fecha sale de la
   re-verificación del paso 2 y queda en una issue de Linear con esa fecha de vencimiento, fuera de
   HOS-1352, que se cierra antes (FASE 9 vuelta 3, F-8V3C2-007). La consulta no depende del script
   archivado: lee las lápidas del corte, que son filas de la base.
3. **Grants** (paso 3b): **B9** (`B/21` §2.4).
4. **Estado de nacimiento y escritura `C`** (paso 3): **V6** (`V/21` §2.4; R1). **Y la prueba
   activa del corte** (paso 3): **V6**, con la fila y la derivación del plan de trial de `T1`
   (revisión del owner, 2026-09-28, C12). **Y el borrado del
   contenido de las `L1`** (paso 5b): **V6** (FASE 9 vuelta 2, `F-8V2A3-002`). **Y la revalidación
   de las páginas de las fichas que nacieron despublicadas** (paso 4c): **V6** (FASE 9 vuelta 2,
   `F-8V2C2-006`).
5. **La regla de las altas en el borde** (pasos 0b, 3 y 5, **y su levantamiento en la rama de aborto**, FASE 9 vuelta 1, `N-G4V-04`), **y el cierre de la ruta de avisos** (pasos 3 y 4, y su inverso en la rama de aborto; verificación corta, 2026-09-29, lote O-B): configuración de Cloudflare, no
   código de ninguna épica; la aplica y la verifica quien opera el corte, con la lista de rutas
   de cada sistema que cumplen el criterio del 0b (FASE 9 vuelta 1, `G4-1`). **El cierre de la ruta de
   avisos es un Worker del borde que contesta `500`** (verificación corta, 2026-09-29, lote P-A; paso 3):
   **vive versionado con el script del corte en `scripts/cutover/`, es de esta FASE 7 del paraguas,
   como el punto 1, y se archiva con él, borrándolo en un commit posterior al corte**; ninguna imagen
   lo lleva. **Lo deja listo el paso 0**: el ensayo del corte en `staging` lo prende, verifica desde
   afuera su `500` con su cabecera, lo apaga y mide cuánto dura el cierre, y el 1a no arranca sin
   ese ensayo verde, como con el resto del paso 0. *(Lo derivé y lo marco: el lote P-A elige el
   Worker y no dice quién lo escribe; ninguna unidad de las dos épicas es dueña del borde, y `U1` no
   escribe piezas del diseño nuevo.)*
6. **La foto de la base y el reemplazo de las dos historias** (paso 6): **V6**, que ya es dueña de
   la migración estructural del corte (revisión del owner, 2026-09-28, C3, `L2-a`). Se ensaya en
   `staging` antes del corte, con backup, y se corre una vez.

**Por qué el censo sale del proveedor, y no es una hipótesis.** El 2026-09-24 el recorrido sin
filtro de los 108 preapprovals de la cuenta encontró una autorización viva, del propio owner, que
la base no conocía: `f6d89f71…`, creada desde el link del plan Basic, con un cobro de ARS 18.000
vencido esa misma noche. Se canceló antes de que cobrara (`25-fase-8-completa/00-hallazgos.md`
§4). Con el censo de la base, ese preapproval **sobrevivía al corte y cobraba**. Y los cinco planes
viejos seguían `active` con su link vendiendo, medido en el navegador.

**Y el orden no se invierte, aunque el paso 1 sea irreversible.** La FASE 8 completa señaló
(`F-8CC2-004`) que lo irreversible va antes de lo que puede fallar. El remedio no es cancelar al
final, porque eso reabre la razón de arriba: ~~el código que sabe cancelar se va con el despliegue~~
**un cobro entre el despliegue y la cancelación no deja asiento** (§4.1; la otra mitad del argumento
cayó con el script suelto, revisión del owner, 2026-09-28, L3-a).
El remedio es el **paso 0** y una rama de aborto declarada.

~~**La rama de aborto: si el paso 3 falla después del paso 1.**~~ **La rama de aborto: si algo
falla después del paso 1b** —un preapproval que el paso 2 no ve `cancelled` después de reintentar
la cancelación, un recorrido que el control del paso 2 no da por completo, **un recuento de
Gastronomía o de Experiencia que no da cero** (FASE 9 vuelta 2, `F-8V2A3-003`), o el paso 3
—que desde la FASE 9 vuelta 2
incluye el paso 4 y el 4b— (FASE 9
completa, `DB-4`).

1. Se **reactivan los planes** del paso 1a, con el mismo script del corte (revisión del owner, 2026-09-28, L3-a). La sonda 50 midió que un plan cancelado vuelve a
   `active` con un `PUT` y conserva su `init_point`. **Que el link vuelva a vender no se abrió en el
   navegador**: se verifica en el ensayo del paso 0. **Y se levanta la regla del 0b sobre las rutas
   del viejo**, verificada con una petición a cada una que ahora pasa: sin esto, el checkout propio
   del viejo —el preapproval sin plan— seguía rechazado en el borde después del aborto, sin fecha, y
   `DEC-MIG-002` dice que las altas siguen en el sistema actual mientras el rediseño no termine (FASE
   9 vuelta 1, `N-G4V-04`).
2. El sistema viejo **sigue corriendo**: ~~no se desplegó nada.~~ **~~si el paso 3 alcanzó a escribir
   algo~~ si el paso 3 —que termina con el despliegue sano ~~y el 3b verificado~~, el 3b y el paso 4
   verificados y la sonda del 4b cancelada (FASE 9 vuelta 2)— alcanzó a escribir
   algo —la migración estructural, `inactiva_desde` y el estado de nacimiento, los dos grants, **las
   lápidas**—, se
   restaura el backup del paso 2b**. ~~**Lo que el backup no puede pisar es un objeto del proveedor,
   y no hay ninguno**~~ ~~:~~ ~~**salvo la sonda de la entrega del paso 3, que no está en el manifiesto del 1b ni en la base restaurada: antes de restaurar se relee por su id y, si no está `cancelled`, se cancela y se verifica** (FASE 9 vuelta 1, `N-G4V-03`). Fuera de ella no hay ninguno~~ **Lo que el backup no puede pisar es lo que el corte cambió afuera de la base, y hasta el
   4b son ~~dos cosas~~ tres cosas, cada una con su inverso** (la tercera, verificación corta, 2026-09-29, VC-cobro-08; desde el lote O-B la tercera es el pago chico del 4b, y la primera, la ruta en el borde) (FASE 9 vuelta 2, `F-8V2A3-002`, `F-8V2C2-001`; la
   frase anterior decía *«no hay ninguno»* salvo la sonda, y era falsa): ~~**(a) la URL de
   notificación** —si el 4b alcanzó a apuntarla, se devuelve a la ruta del viejo y se verifica con
   una entrega real, con una sonda dada de alta y cancelada como la del 4b, antes de reencender el
   webhook viejo; sin eso el viejo corre sin recibir un evento, y quien se re-suscribe por el link
   reactivado (punto 3) paga sin que nadie lo vincule—;~~ **(a) la ruta de avisos en el borde**
   (verificación corta, 2026-09-29, lote O-B): si el paso 3 alcanzó a cerrarla, se abre recién con
   la imagen vieja desplegada y su webhook reencendido, y se verifica con una entrega real, con una
   sonda dada de alta y cancelada como la del 4b; si el paso 4 ya la había abierto, se vuelve a
   cerrar antes de redesplegar la imagen vieja y se abre de la misma forma. Sin eso el viejo corre
   sin recibir un evento, y quien se re-suscribe por el link reactivado (punto 3) paga sin que nadie
   lo vincule. **Cerrar y abrir son asignarle y quitarle la ruta al Worker del paso 3**, verificado desde afuera por su cabecera (verificación corta, 2026-09-29, lote P-A). **No hay URL que devolver**: la URL no cambió en ningún paso; y **(b) la sonda de la entrega**, que no
   está en el manifiesto del 1b ni en la base restaurada: antes de restaurar se relee por su id y,
   si no está `cancelled`, se cancela y se verifica (FASE 9 vuelta 1, `N-G4V-03`); y ~~**(c) la URL de IPN**, que el 4b apunta en el mismo paso a la ruta de IPN del receptor nuevo: si alcanzó a apuntarla, se devuelve a la ruta del viejo (verificación corta, 2026-09-29, VC-cobro-08;~~ ~~cómo se verifica ese apuntado, en un sentido y en el otro, pide decisión del owner, `30-revision-del-owner/33-` §3~~ ~~; a la ida se verifica con el pago chico del 4b, lote N-D, y a la vuelta no hay dónde verlo: el viejo contesta las entregas IPN sin guardarlas, `B/06` §7, así que se devuelve sin verificar, y no mueve plata).~~ **(c) el pago chico del 4b** (lote N-D), que ocupa el lugar de la URL de IPN, que ya no se apunta (verificación corta, 2026-09-29, lote O-B): si el 4b alcanzó a hacerlo y no a devolverlo, antes de restaurar se devuelve y se relee por id la devolución; su id y el de la devolución están en el manifiesto del corte. *(Lo derivé y lo marco: es plata del owner que el corte movió afuera de la base, como la sonda de (b).)* **Las fotos y los
   tokens de calendario de las `L1` no están en la lista porque nada los toca antes del 5b**, que
   corre pasado el punto donde la rama deja de cubrir (arriba, paso 5b); **ni el caché de páginas
   públicas, por la misma razón: lo revalida el 4c** (FASE 9 vuelta 2, `F-8V2C2-006`). Fuera de esas dos no hay
   ninguno: las altas del sistema nuevo siguen cerradas hasta el paso 5 (FASE 9 vuelta
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

**Lo que no deshace una restauración: ~~tres~~ cuatro situaciones, declaradas por decisión del owner** (FASE
9 vuelta 3, owner 2026-09-30, lote J, contra la recomendación, que eran tres reglas en el
procedimiento; la cuarta, lote AH; declarado por `DEC-METH-015`). Las dos restauraciones del corte
y la rama de aborto inventarían la base; ~~y las tres dejan afuera algo que el corte ya hizo fuera
de ella~~ las tres primeras dejan afuera algo que el corte ya hizo fuera de ella, y la cuarta lo
que el sistema viejo escribió en ella después del backup. **Las ~~tres~~ cuatro exigen una falla
previa** y el daño de cada una es de clase crítica. No se agrega ninguna regla.

1. **Restaurar el backup del paso 6 deja preapprovals vivos sin fila** (`F-8V3C2-001`). **Causa**:
   el paso 5 abre las altas del sistema nuevo, y el 5b y el 6 corren después; si el 6 falla, su
   backup devuelve la base a como terminó el 5b, y todo lo que el sistema nuevo escribió desde ese
   backup se pierde: suscripciones, preapprovals vinculados, pruebas arrancadas. **Daño**: el
   preapproval sigue `authorized` en el proveedor y su fila ya no existe; la persona autorizó el
   débito y no tiene suscripción ni cobertura, nadie le avisa, y del lado de Hospeda se enteran
   recién con el primer cobro, que el handler recibe como desconocido: lápida de recepción,
   cancelación y la propuesta de devolver.
2. **Un aborto borra los pagos que el receptor nuevo ya asentó** (`F-8V3C2-002`). **Causa**: la rama
   de aborto cubre hasta el 4b, y el paso 4 ya abrió la ruta de avisos; llegan juntos los
   reintentos que el Worker rechazó con `500`, incluidos los cobros en vuelo del 1b, y el receptor
   nuevo los asienta sobre las lápidas y contesta `200`, así que Mercado Pago no los vuelve a
   mandar. Si el 4b no termina, restaurar el 2b borra esos `payment`, y el viejo redesplegado nunca
   los recibe; el detector posterior no corre, porque el corte no terminó. **Daño**: cobros
   confirmados que desaparecen sin lista que los nombre, y quien se re-suscribe por el link
   reactivado paga otra vez, en el acto y sin trial.
3. **Después de un aborto, `main` sigue con el sistema nuevo** (`F-8V3C2-003`). **Causa**: la
   promoción `staging → main` es el paso 3 (§4.4), y la rama de aborto redespliega la imagen vieja
   sin revertir esa promoción; los hotfixes siguen yendo a `main`, y en Coolify todo redespliegue
   construye desde la rama. **Daño**: el primer despliegue de `main` después del aborto (un hotfix,
   o una variable de entorno que pide redesplegar) sube el sistema nuevo sobre la base vieja
   restaurada y corre sus migraciones, que borran las tablas del viejo que está cobrando, sin orden
   de corte, sin lápidas y sin nadie mirando.
4. **Un aborto borra lo que el sistema viejo asentó después del backup del 2b** (FASE 9 vuelta 3,
   owner 2026-09-30, lote AH; verificación, VC3-VT-02). **Causa**: el backup del 2b se toma con el
   viejo encendido, y el viejo sigue recibiendo avisos hasta que el borde cierra su ruta, en el
   paso 3, y aceptando cuentas y fichas hasta que se apaga el contenedor. Si el paso 3 falla y la
   rama de aborto restaura el 2b, todo lo que el viejo escribió entre el backup y el apagado se
   pierde. **Daño**: un cobro en vuelo del 1b que llegó al webhook viejo en esos minutos, que el
   viejo asentó y contestó `200`, desaparece; Mercado Pago no lo reenvía y el detector posterior no
   corre, porque el corte no terminó. Es la misma clase de daño que la segunda situación, del lado
   del viejo. Con menos daño, lo mismo pasa con una cuenta o una ficha que alguien creó en esos
   minutos, que desaparece sin aviso.

**Y el titular que sólo conoce el proveedor, si ninguna lectura trae su pagador** (FASE 9 vuelta
3, owner 2026-09-30, lote G; `F-8V3B3-001`; declarado por `DEC-METH-015`). **Causa**: el `GET` del
preapproval devuelve `payer_email` vacío (`EX-19`), y que otra lectura lo traiga se mide en sandbox
antes del corte (§4.2, *«el aviso va antes del paso 1»*). Si la medición no encuentra ninguna,
**esa población no tiene detector**: la pasada sabe que la autorización existe y no a quién
llamar, así que la persona pierde lo que le quedaba del período sin aviso, y su cobro del día del
corte, si estaba en vuelo, lo lista el detector del día siguiente sin nadie a quien llamar. El
2026-09-24 había un solo titular así, del propio owner.

### 4.4 La rama hasta el corte: sin interruptores, `staging` congelado

(Revisión del owner, 2026-09-28, C2 y L3-b.)

**No hay convivencia ni interruptores, así que el sistema nuevo no puede estar en una rama que se
promueve a producción sin ser el corte.** Un interruptor era la única forma de tenerlo en
`staging` y no activo en `main`, y C2 lo prohíbe. Por eso:

1. **La épica entra a `staging` recién al final, lista para el corte.** Hasta entonces vive en la
   rama del paraguas (`DEC-ARCH-007`), y ahí se construye y se prueba.
2. **Desde que entra, `staging` queda congelado para `main` hasta el corte.** Ninguna promoción
   `staging → main` sale antes, porque arrastraría el sistema nuevo a producción sin el orden del
   §4.2. La promoción `staging → main` es parte del corte: es lo que despliega el paso 3.
3. **Los arreglos urgentes van a `main` como hoy**: rama desde `main`, PR a `main` y, después, el
   back-merge `main → staging`, que es la excepción de hotfix que el repo ya tiene. El congelamiento
   frena la promoción, no los hotfix. **Un hotfix puede traer una migración** (FASE 9 vuelta 3,
   F-8V3C2-006): se aplica en producción antes del paso 3 y, por fecha, puede quedar delante de
   migraciones del paraguas generadas antes, que el ensayo en `staging` aplica en el otro orden.
   Lo que lo cubre es la verificación del paso 3 sobre la tabla de migraciones aplicadas (§4.2): no
   se prohíbe el hotfix, se verifica el resultado.
4. **El script del corte no pasa por ninguna de las dos ramas como parte de un despliegue** (§4.2,
   *«las herramientas del corte»*): no hace falta promoverlo antes, y por eso ya no hace falta la
   excepción de hotfix que la versión anterior evitaba. **Está versionado en `scripts/cutover/`**
   (revisión del owner, casos vecinos, 2026-09-29, caso 3), pero ninguna imagen lo lleva: se corre
   desde una copia del repositorio, y se borra en un commit posterior al corte.

**Con esto `rollout` queda cerrado en lo que hace a ramas** (revisión del owner, casos vecinos,
2026-09-29, caso 4): las ramas son este §, y el orden de despliegue es el §4.2.

**Lo que esto cuesta, declarado**: mientras dure el congelamiento, lo demás de Hospeda que esté en
`staging` no sale a producción. **Causa**: sin interruptores no hay otra forma de tener el sistema
nuevo en `staging` sin llevarlo a `main` (C2), y el owner eligió esta forma (L3-b). **Por eso el
punto 1 importa**: cuanto más tarde entra la
épica a `staging`, más corto es el congelamiento.

### 4.5 `qzpay`: congelado hasta el corte, archivado después

(Revisión del owner, 2026-09-28, N2.) **El cobro nuevo no usa `qzpay`**: se escribe en un package
compartido del monorepo ~~que se puede publicar solo~~ (publicarlo en npm pediría reescribir sus
dependencias internas: revisión del owner, casos vecinos, 2026-09-29, caso 30), y `qzpay` queda como referencia de lectura
(`B/spec.md` §3.1; `G16` falla si vuelve). Pero **el sistema viejo corre con él hasta el corte**,
así que:

1. **Desde ahora, `qzpay` se congela**: sólo entra lo que haga falta para que el sistema viejo
   siga cobrando en producción.
2. **Después del corte, se archiva.** El script del corte no lo usa (§4.2, *«las herramientas del
   corte»*), así que no hay nada del corte que lo necesite.
3. ~~**Y el cobro viejo sale del repositorio después del corte**, con sus dependencias de `qzpay` (verificación corta, 2026-09-29, lote M-D): hasta el corte lo necesita el sistema que cobra, y por eso `G16` mira sólo el package del cobro nuevo (`B/20` §2). ⚠️ **Qué unidad o qué paso lo borra no está escrito**: ninguna unidad de las dos épicas lo tiene y ningún paso del §4.2 lo nombra. Pide decisión del owner (`30-revision-del-owner/33-` §3), y es también lo que vacía el trinquete de `G8` (`V/20` §2).~~ **Y el cobro viejo sale de la rama del paraguas al principio de la épica**, con sus dependencias de `qzpay`, en la limpieza del principio (§4.6; verificación corta, 2026-09-29, lote N-A): el sistema que cobra hasta el corte es el de `main`, que la rama no toca, y de `main` sale con el paso 3, que la reemplaza. Por eso `G16` mira todo el repo (`B/20` §2).

### 4.6 La limpieza del principio: el sistema viejo sale de la rama antes de construir el nuevo

(Verificación corta, 2026-09-29, lote N-A.) El owner, textual: *«ya habíamos definido que no conviven
nunca los 2 sistemas [...] tenemos que estar 100 % seguros de eliminarlo por completo y no dejar código
basura»*. Entre sus dos caminos, limpiar todo al principio o borrar a medida que se avanza, eligió
**limpiar todo al principio**.

**La primera unidad de trabajo del programa, `U1` (lote O-A, abajo), borra el sistema viejo de la rama del paraguas, entero, y
recién después se construye lo nuevo.** Hace ~~dos~~ tres cosas, en el mismo cambio (la tercera, verificación corta, 2026-09-29, lote P-C):

1. **Borra todo el cobro viejo**: `@qazuor/qzpay` con sus paquetes, en los cinco `package.json` que lo
   declaraban el 2026-09-29 (`apps/api`, `apps/admin`, `packages/billing`, `packages/db` y
   `packages/service-core`), sus rutas (los checkouts, el cambio de plan, los addons y el receptor de
   avisos de `apps/api/src/routes/webhooks/mercadopago/`), sus crons, su adaptador y todo lo que sólo el
   sistema viejo usa: también el archivo de configuración de planes y lo que lo lee (`B/21` §4), y el
   esquema de las tablas viejas de billing, cuyo borrado genera la migración que las saca de la base en
   el paso 3 del corte (`B/21` §4; lo derivé del guard de drift del esquema, que exige la migración
   commiteada en el mismo cambio). **Salvo tres columnas de `accommodations`, `owner_suspended`,
   `plan_restricted` y `billing_unpublished_at`, que sobreviven a esta limpieza** (FASE 9 vuelta 3,
   owner 2026-09-30, lote N; `F-8V3A3-002`): sólo las usa el cobro viejo, pero la tabla de traducción
   del corte las lee para `L5` y `L7` (`V/21` §2.4), y la migración que las borrara nacería acá, meses
   antes, y correría en el paso 3 antes que la clasificación de `V6`. Sin ellas una ficha suspendida
   o fuera de cupo caía en `L8` y nacía publicada, con prueba. **Son una excepción temporal y
   nombrada, que los guards de limpieza (`G8`, `G16`) admiten hasta el corte**, ~~y~~ **sin tocar
   ninguno: ninguno mira columnas (`G8` busca una palabra que ninguna de las tres tiene, `V/20` §2;
   `G16` mira `@qazuor/qzpay` y los imports de `apps/`, `B/20` §2;
   FASE 9 vuelta 3, `F-8V3A3-002`)**; y las borra una migración propia que corre después de la clasificación de `V6`, en el paso 3 (§4.2).
2. **Renombra o borra todo lo que nombra el agrupamiento viejo de Gastronomía y Experiencia**: lo que ya
   era la limpieza de `V1` (el rol, sus permisos, la tabla de contactos, el tipo de partner con su
   migración de datos, el `CLAUDE.md` raíz, el i18n, las specs de fuera del programa y `.qtm/`, `V/21`
   §4) y **además el código que la nombra**, que el 2026-09-29 eran unos 1229 archivos versionados y 326
   rutas con la palabra en el nombre, medidos sobre `origin/staging` `35e2d63e81`
   (`30-revision-del-owner/31-` §2, `VC-VT-01`). Lo que tenga que nombrar un valor de la base lo arma en
   partes, como el script del corte (§4.2, *«las herramientas del corte»*).
3. **Al terminar, crea el package del contrato vacío** (verificación corta, 2026-09-29, lote P-C): la
   estructura, con el nombre que fije la FASE 5 (`12-contrato…` §7), su `package.json`, su
   configuración de compilación y un punto de entrada que no exporta nada, y ningún contenido:
   ninguna interfaz, validación, simulador ni caso. Lo llenan `V1` y `B1`, que arrancan en paralelo
   (abajo; `12-contrato…` §7.1). *(Qué es «la estructura» lo derivé y lo marco.)*

**Qué deja demostrado:**

- **El repositorio no nombra la palabra** fuera del PDR y de las tres carpetas de la lista de `G8`
  (`V/20` §2), **ni declara `@qazuor/qzpay`** en ningún `package.json` ni import (`G16` (a), `B/20` §2).
  ~~Los dos guards corren sobre todo el repo, sin lista de pendientes de código, y nacen verdes.~~
  **`G8` corre sobre todo el repo, sin lista de pendientes de código, y nace verde; el predicado (a)
  de `G16` se comprueba con un recorrido a mano en el mismo cambio, porque `G16` nace en `B1`**
  (abajo; FASE 9 vuelta 3, F-8V3D1-003: decía que corrían los dos).
- Las 11 migraciones de datos del seed que importaban el archivo de planes compilan sin él (caso 9), y
  salieron en el mismo cambio la rama del archivo en `scripts/check-seed-dual-write.sh` y la mención a
  los planes en la regla de dual-write del `CLAUDE.md` raíz (caso 42).
- **La rama sigue compilando**: typecheck y lint verdes. Lo que queda roto es el comportamiento, no el
  build. *(Lo derivé y lo marco: sin esto el CI de cada unidad que viene después queda rojo por algo que
  no es suyo.)*

**Mientras tanto la app de la rama está rota**: no cobra ni vende, porque lo viejo salió y lo nuevo
todavía no está. **Las dos mitades se construyen y se prueban contra el simulador del contrato**
(`12-contrato…` §7.1): verticales contra el de billing y billing contra el de verticales, hasta que
`B4` integra la implementación real de billing en la raíz de composición de `apps/api`. **Producción no
cambia**: corre `main`, con el sistema viejo, hasta el paso 3 del corte (§4.4), y la rama de aborto
despliega esa misma imagen (§4.2).

**Ninguna otra unidad de las dos épicas arranca antes de que esta limpieza esté mergeada en la rama del
paraguas**: es el primer nodo de los dos grafos (`V/descomposicion.md` §3, `B/descomposicion.md` §3).
~~⚠️ **Qué unidad la hace pide decisión del owner** (`30-revision-del-owner/34-` §3, N-A-1): `V1`, que
crece, o una unidad propia que va antes de `V1` y de `B1`.~~ **La hace `U1`, una unidad propia del
paraguas, que hace ~~sólo~~ la limpieza** (verificación corta, 2026-09-29, lote O-A; la fila, abajo) **y, al terminarla, crea vacío el package del contrato** (verificación corta, 2026-09-29, lote P-C).

**`U1`, la unidad del paraguas** (verificación corta, 2026-09-29, lote O-A). El nombre sigue la
convención de las otras veintidós, una letra y un número desde 1, y no choca con nada del programa:
la inicial de cada épica es su letra (`V`, `B`), y la del paraguas, `P`, ya nombra las transiciones
del pago (`P1`–`P4`) y es el prefijo de `PB` y de `PP`, así que un `P1` de unidad se confundiría con
una transición. `U` no la usa ninguna familia de ids del programa (recorrido con `rg` sobre las tres
carpetas, 2026-09-29), y el `1` es porque cada familia de unidades empieza en 1; un `0` pegado a `V`
o a `B` la hubiera puesto dentro de una épica. Con ella el programa tiene **23 unidades**: nueve de
verticales, trece de billing y ésta.

| unidad | qué deja funcionando | guards | la unidad está lista cuando… |
|---|---|---|---|
| **U1** | ~~**la limpieza del principio, y nada más**: los dos puntos de arriba en un solo cambio,~~ **la limpieza del principio y, al terminarla, el package del contrato vacío; nada más** (verificación corta, 2026-09-29, lote P-C): los tres puntos de arriba en un solo cambio, más lo que ya era la limpieza del agrupamiento viejo en el producto (el rol, sus permisos, la tabla de contactos, el tipo de partner con su migración de datos, el `CLAUDE.md` raíz, el i18n, las specs de fuera del programa y `.qtm/`: `V/21` §4, `V/descomposicion.md` §2.11) | **`G8`**, que nace en el mismo cambio *(`G16` no: sigue en `B1`, porque su predicado (b), que el package del cobro no importe de `apps/`, necesita el package del cobro, que crea `B1`; `B/20` §2)* | lo de *«qué deja demostrado»*, arriba, y además: **`G8` corre sobre todo el repositorio con el PDR como única exención y las tres carpetas como única lista**, y se rompe a propósito agregando la palabra en un archivo de código, que falla nombrando el archivo; una cuarta carpeta en la lista falla; y **ningún `package.json` ni import declara `@qazuor/qzpay`**, comprobado en el mismo cambio con el recorrido que después hace `G16` (a), que todavía no existe. Ningún código nuevo: si el cambio escribe una pieza del diseño nuevo, no es esta unidad, **salvo la estructura vacía del package del contrato, que entra al workspace, compila y no exporta nada** (verificación corta, 2026-09-29, lote P-C) |

**Por qué `G8` con `U1` y `G16` no.** `G8` no depende de nada que construya otra unidad: es un
recorrido de texto sobre el repositorio, y construirlo en el mismo cambio que la limpieza es lo que
la demuestra y lo que impide que `V1` o `B1`, que arrancan después, en paralelo (lote P-C), vuelvan a escribir
la palabra. `G16` tiene dos predicados, y el (b) mira el package del cobro, que todavía no existe;
partirlo en dos unidades lo volvería dos guards. Entre `U1` y `B1` el predicado (a) queda sin
vigilancia automática, y lo único que corre en ese rato son `V1` y `B1`, que no tienen por qué
declarar `qzpay`. **El reparto de guards cambia y el total no**: 17 de verticales, 15 de billing y 1
de `U1`, 33 (`V/descomposicion.md` §4, `B/descomposicion.md` §4).

**Dónde vive**: en Linear, como sub-issue de HOS-1352 (el paraguas), no de ninguna de las dos
épicas; la issue la crea quien abre el programa. **Sus dependencias**: ninguna. **Quién depende de
ella**: `V1` y `B1`, y por ellas todo lo demás; `B2`, que no espera a `B1`, también la espera (su
dependencia es `V2`, que llega después de `V1`). **No es una dependencia entre épicas**: `U1` no es
de ninguna, así que ~~las once de `B/descomposicion.md` §2.6 siguen siendo once, recontadas sobre la
tabla~~ `U1` no le suma ninguna a las de `B/descomposicion.md` §2.6. **Son doce desde la FASE 9
vuelta 3, y no por `U1`**: la duodécima es la de `V4` sobre `B1`, por la interfaz del reloj
(`12-contrato…` §7.1, punto 5; `F-8V3C1-006`).

**`V1` y `B1` arrancan en paralelo** (verificación corta, 2026-09-29, lote P-C): las dos dependen
sólo de `U1`, y ninguna de la otra. Lo que las ataba era el package del contrato, que antes creaba
`V1` y en el que `B1` escribe la interfaz del reloj (`12-contrato…` §7.1, punto 5): esa espera de
`B1` sobre `V1` no estaba entre las once. Con el package creado vacío por `U1`, cada una llena su
parte, `V1` los puntos 1 a 4 y `B1` el 5, y la espera desaparece: **las dependencias entre épicas
~~siguen en once~~ son doce**, recontadas sobre la tabla (filas 1 a 7 y 9 a 12, **y la de `V4`
sobre `B1`**: FASE 9 vuelta 3, F-8V3C1-006). **Esa espera sí existe, en la otra dirección**:
verticales lee la hora desde `V4`, y la interfaz la escribe `B1`; `V1` no la necesita, así que
siguen arrancando en paralelo. **`G14` sigue en `V1`**: vigila
que una mitad no importe a la otra fuera del package, no el package, así que ningún guard tiene que
nacer con él. Entre `U1` y `V1` esa frontera no la vigila nada automático; si `B1` se mergea antes
con un import que la cruza, `G14` nace rojo en el cambio de `V1` y lo muestra. *(Lo último lo
derivé y lo marco, como el hueco de `G16` (a) de arriba.)*

**Lo que no entra, y por qué:** la historia de migraciones y las migraciones de datos del seed, que se
reemplazan en el paso 6 del corte; las carpetas del programa en `.specs/`, que se reescriben al cerrar
HOS-1352; y el PDR, que no se edita. Son las tres carpetas y la exención de `G8`, y siguen.

~~⚠️ **Y el orden del corte tiene un hueco que esta limpieza vuelve evidente** (§4.2, pasos 3 y 4b): la
imagen que despliega el paso 3 ya no sirve la ruta de avisos del sistema viejo, y la URL de la
aplicación del proveedor la sigue apuntando hasta el 4b. Cómo se reordena pide decisión del owner
(`30-revision-del-owner/34-` §3, N-A-2).~~ **Y el hueco del corte que esta limpieza volvía evidente
se cerró sin mover la URL** (verificación corta, 2026-09-29, lote O-B): el receptor nuevo sirve la
misma ruta que el viejo, `/api/v1/webhooks/mercadopago`, el borde la cierra desde que se apaga el
contenedor viejo hasta que las lápidas están escritas, y el 4b sólo verifica (§4.2, pasos 3, 4 y 4b).

---

## 5. Lo que este documento todavía no contesta

~~**Cinco de los seis ítems huérfanos**, uno por uno — el sexto, `staging`, quedó escrito en el §4 en
lo que hace al orden del corte.~~ ~~**Cuatro de los seis ítems huérfanos** —`rollout`, `coexistence`,
`feature flags` y `acceptance gates`—, uno por uno~~ ~~**Dos de los seis ítems huérfanos**
(`rollout`, en lo que el §4.4 no cubra, y `acceptance gates`), uno por uno (revisión del owner,
2026-09-28, C2 y L3-b)~~ **Uno de los seis ítems huérfanos, `acceptance gates`** (revisión del
owner, 2026-09-28, C2 y L3-b; y casos vecinos, 2026-09-29, caso 4): `staging` quedó escrito en el §4 en lo que hace
al orden del corte y en el §4.4 en lo que hace al congelamiento, `rollout` quedó cerrado por el
§4.4 en lo que hace a ramas y por el §4.2 en el orden de despliegue, `rollback` quedó decidido en el §4.3 (owner 2026-09-25; FASE 9 completa,
`2c`), y `coexistence` y `feature flags` no existen (§1). Ésa es la FASE 7 del paraguas y es trabajo pendiente, con fecha
límite dada por el §2: **antes de que nazca la rama**.

**Una restricción que ya está fijada y lo acota**: `DEC-ARCH-007` decidió que **las dos épicas
llegan juntas**, así que la estrategia no tiene que resolver *«cómo sale una sola»* — no existe
ese caso, y la ausencia de una tercera implementación del contrato de cobertura
([`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md) §5.3) descansa en lo mismo.
