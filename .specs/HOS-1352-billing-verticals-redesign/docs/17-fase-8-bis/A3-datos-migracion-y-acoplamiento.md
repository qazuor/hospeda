---
title: "FASE 8-bis · A3 — datos, migración y acoplamiento oculto"
linear: HOS-1353
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · A3 — datos, migración y acoplamiento oculto

Segunda pasada adversarial A3, **sobre el texto que la FASE 9 produjo**. El encargo de esta pasada
no es *«¿el diseño tiene defectos?»* sino **¿qué rompió el arreglo?**, y el vector es el mismo de
la FASE 8: columnas que hacen falta y no existen, columnas que existen y nadie escribe, datos que
dos lugares declaran distinto, restricciones que no se pueden cumplir, caché e invalidación, y todo
punto donde una épica necesita algo de la otra sin que el contrato lo declare.

**Quince hallazgos: 5 `CRITICA`, 6 `ALTA`, 3 `MEDIA`, 1 `BAJA`.** Trece de los quince los
**introdujo un cambio de la FASE 9**; los otros dos son bordes que el cambio agrandó.

El dominio enumerado de `15-fase-9/00-dominios-de-los-racimos.md` se recorrió en los dos racimos
que caen de lleno en este vector: los **28 casos de R2** (transporte, scope, dirección inversa,
defensas) y los **45 de R3** (5 verticales × 4 estados y × 5 transiciones). Los bloques donde se
concentraron los hallazgos son exactamente los que ese documento marca como no mirados: *(partner,
los 4 estados)*, *(las 5 verticales, `TRIAL_CONVERTED`)*, *(`TRIAL`, `versiónDePlan`)* y
*«dirección inversa D1, D2, D3 — existen, pero cruzan una frontera que §4 declara cerrada»*.

---

## CRITICA

### F-8bA3-001 — `PRE_TRIAL` es una fuente de clase `TÍTULO`, así que todo el mundo está `cubierto` en Partner, para siempre

**Qué se rompe.** `cobertura(user, PARTNER)` devuelve `cubierto: sí` para **toda persona
autenticada de la plataforma, desde el día uno y sin fecha de fin**, sin que nadie haya contratado,
probado ni publicado nada. `cubierto` es el campo que `PB2`, el §6 del capítulo 15 y el
reconciliador consumen, y en Partner nunca puede volverse falso: no hay evento de activación, así
que no hay transición que saque a nadie de `PRE_TRIAL`.

**El camino.**

1. La fuente del trial **está viva en `PRE_TRIAL`** y su `tipo` sigue siendo `TRIAL`:
   `V/03` §2 — *«| `PRE_TRIAL` | **sí** | la versión de **pre-trial** de la vertical |
   `SIN_EMPEZAR` |»* y *«**Y `PRE_TRIAL` no es un `tipo` nuevo del contrato**: la fuente sigue
   siendo `tipo: TRIAL`»*.
2. `TRIAL` es de clase `TÍTULO`, y la clase **no se transporta: se deriva del `tipo`**. El contrato
   §2.4 — *«| **`TÍTULO`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` | **sí** |»* y
   *«**`cubierto` se calcula sólo sobre las fuentes de clase `TÍTULO`**»*.
3. `PRE_TRIAL` **no tiene fila**: `T1` la crea (`V/03` §2). Así que *«estar en `PRE_TRIAL`»* es
   **la ausencia de fila**, y la ausencia de fila es el estado de toda persona en toda vertical que
   todavía no disparó su evento.
4. En Partner **nadie lo dispara nunca**: `DEC-TRIAL-003` la deja sin evento declarado y con trial
   en cero, y el propio dominio enumerado lo dice — `15-fase-9/00-dominios…`, R3 §5:
   *«| (partner, los 4 estados) | 4 | **no tiene evento declarado: su `PRE_TRIAL` no sale nunca** |»*.
5. Resultado: `cubierto: sí`, con `hasta: SIN_EMPEZAR`, **permanente**, para la vertical cuyo
   camino de alta es administrado y cuya presencia Gold es de pago.

**Dónde lo permite el diseño.** Además de las citas de arriba, las dos que muestran que este
desenlace ya estaba identificado como inaceptable:

- `12-contrato-de-cobertura.md` §2.6 — *«**`SIN_EMPEZAR` no es `NO_VENCE`.** Un consumidor que
  confundiera los dos le daría cobertura perpetua a alguien que ni empezó su prueba, y el error es
  en la dirección cara: **no falla ruidosamente, regala.»*. En Partner **no hace falta el error**:
  el valor correcto produce el mismo resultado, porque la fuente nunca cambia de estado.
- `15-fase-9/03-R3-resuelto.md` §6, salida (c) — *«`TRIAL_EXPIRED` apunta a una versión de **piso
  de sólo lectura** … **alto**: `cubierto` sería verdadero para siempre y `12-contrato…` §5.1 pide
  que «un trial vence de verdad». **Se desaconseja**»*. La FASE 9 **descartó explícitamente** una
  salida por producir `cubierto` perpetuo, y la dejó entrar por la otra punta del ciclo.
- `12-contrato-de-cobertura.md` §2.4 — *«Con `cubierto` definido como «al menos una fuente viva»,
  ese suspendido quedaría cubierto por su propio addon … **y el fail-open lo habría introducido el
  arreglo**»*. Es el mismo fail-open, por otra fuente.

**Severidad.** `CRITICA`. Un `cubierto` que no puede volverse falso es el fail-open que el §2.4
declara haber cerrado, reabierto en la vertical donde `PB2` además no tiene sobre qué correr
(la presencia de Partner no es un `listing` — `F-8A3-005`, que sigue llegando).

**¿Es nuevo, o es el arreglo?** Es el arreglo. Lo introdujo la combinación de **R3** (la fuente de
`PRE_TRIAL`, cambio 13) con **R2** (las tres clases de fuente, cambio 1): cada resolución es
defendible sola y juntas producen un título que nunca vence.

---

### F-8bA3-002 — Quien se suscribe antes de publicar queda con un trial colgado en `TRIAL_ACTIVE` que no vence nunca

**Qué se rompe.** Un cliente que paga desde el día uno y publica su primera ficha **después**
dispara `T1`, entra en `TRIAL_ACTIVE` y **ya no puede salir**: `T2` exige el evento *«se autoriza
una suscripción»*, que para él ocurrió antes; `T3` exige *«no hay suscripción autorizada»*. Su fila
queda en `TRIAL_ACTIVE` con una fecha de fin en el pasado. El día que cancele su suscripción,
**sigue teniendo una fuente de clase `TÍTULO` viva** — un trial que nunca expiró — y el paso 5, el
§6 del capítulo 15 y `PB2` leen que está cubierto.

**El camino.**

1. `T1` perdió su condición vieja y **no ganó ninguna sobre la suscripción**: `V/03` §2 —
   *«| T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` |
   **la vertical declara evento y su plan de trial tiene días de trial > 0** | **crea la fila de
   `trial`** … |»*. Las dos condiciones son del **catálogo**, ninguna del sujeto.
2. Un suscriptor que nunca publicó **está en `PRE_TRIAL`**, porque `PRE_TRIAL` es la ausencia de
   fila (`V/03` §2: *«**`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene**»*).
3. Publica. `PB1` ejecuta y **`T1` es su efecto, en la misma transacción** —
   `15-fase-9/03-R3-resuelto.md` §1.3, paso 6: *«`PB1` ejecuta, y **`T1` es su efecto**, en la
   misma transacción»*. Nada consulta si ya tiene suscripción.
4. La fila nace en `TRIAL_ACTIVE`. Las dos salidas están cerradas: `T2` —*«se autoriza una
   suscripción»*— es un evento que ya pasó y no vuelve a ocurrir, y `T3` lleva la condición
   *«no hay suscripción autorizada»* (`V/03` §2).
5. La fila queda `TRIAL_ACTIVE` indefinidamente. `V/03` §2 declara que en ese estado **la fuente
   está viva**, y el dominio de R3 marca la columna entera como no mirada:
   `15-fase-9/00-dominios…` R3 §5 — *«| (las 5 verticales, `TRIAL_CONVERTED`) | 5 | el título pasa
   a ser la suscripción: es `S6`, no `S1` |»*. Justamente: **a `TRIAL_CONVERTED` no llega**.
6. Cancela. La suscripción se apaga, `PB2` pregunta por la cobertura y **la encuentra**: el trial
   sigue declarado vivo. Su ficha no se despublica y su conjunto efectivo sigue resolviendo contra
   el plan de trial.

**Dónde lo permite el diseño.** Las citas de arriba, más:

- `V/02` §2.2 — *«**`UNIQUE(user_id, vertical)`** — sin condición de estado … **su sola existencia
  niega un trial nuevo**»*: la fila colgada es permanente y no hay forma de reemplazarla.
- `V/11` §7 — *«si algún día apareciera un camino que extienda un trial vencido, este cruce
  volvería a existir»*: acá no hay extensión, hay un trial que **nunca vence**, que es peor.

**Severidad.** `CRITICA`. Alguien que dejó de pagar conserva servicio, y la cartera que entra por
esta puerta **no es un borde**: son las tres `trialing` que el capítulo 21 manda re-suscribir
(§2.2) y todo cliente que contrate antes de publicar.

**¿Es nuevo, o es el arreglo?** Es el arreglo. La condición vieja de `T1` —*«no hay trial previo
para ese `user + vertical`»*— tampoco lo cubría, pero mientras `PRE_TRIAL` tenía fila la máquina
tenía un estado inicial distinguible. Al hacer que `PRE_TRIAL` sea *la ausencia de fila* (cambio
13), **toda persona sin fila es un `T1` esperando**, sin importar qué más tenga.

---

### F-8bA3-003 — `addon_instance` no tiene con qué anclar su versión: publicar una versión nueva cambia lo que ya se compró

**Qué se rompe.** *«La instancia ancla su versión»* está escrito en las dos épicas y **ninguna de
las dos tablas lo permite**: `addon_instance` no tiene columna de versión, y el único camino a
`addon_version` es `addon_product.version_id`, que es del **producto**. Re-apuntarlo —que es cómo
se publica una versión nueva— mueve **todas las instancias vivas a la vez**. Quien compró *«+30
fotos»* pasa a tener las que diga la versión nueva, sin comprar nada y sin que nadie se lo avise.

**El camino.**

1. La restricción está declarada del lado de verticales: `V/02` §2.1 — *«| **`addon_version`** |
   **qué otorga un addon y con qué valores**: vigencia, tipo de scope. **Inmutable** | **una
   instancia ancla su versión, igual que una suscripción ancla la suya** |»*.
2. La instancia vive del otro lado y **no tiene la columna**: `B/02` §2.4 — *«| **`addon_instance`**
   | producto, dueño, **objetivo** …, estado, inicio, fin, su suscripción de complemento si es
   recurrente | el objetivo corresponde al tipo de scope del producto |»*.
3. La referencia la lleva el producto: `B/02` §2.4 — *«| **`addon_product`** | **precio,
   recurrencia y verticales compatibles**, más **`version_id`** → `addon_version` … | `version_id`
   **no es anulable** |»*. Y la resolución de la FASE 9 lo afirma como si resolviera el punto:
   `15-fase-9/02-R2-resuelto.md`, en su reejecución de `F-8A3-002` — *«| 2 | `addon_instance`
   tampoco — **no tiene que**: ancla su `addon_version` |»*.
4. `addon_product` **no está declarado inmutable** en ningún lado: lo inmutable es `addon_version`
   (`V/02` §2.1). Así que la operación *«publicar una versión nueva»* es exactamente *«mover
   `addon_product.version_id`»*.
5. La comparación con la suscripción no se sostiene, y es la prueba: `subscription` guarda *«versión
   de plan anclada»* como columna propia (`B/02` §2.2). El addon no tiene la suya, así que **anclar
   y seguir la vigente son, para él, la misma cosa**.
6. Y no hay red: la lista de siete invalidaciones no tiene entrada para *«cambia lo que otorga un
   addon»* (ver `F-8bA3-004`), y el guard `G5` sólo mira *«una fuente que se apaga»* (`V/15` §4.2).
   Una fuente que **cambia de valor** no pasa por el reconciliador.

**Severidad.** `CRITICA`. Alguien recibe de menos o de más lo que pagó, con el mismo mecanismo que
`DEC-ARCH-001` fue a evitar cuando ancló cada suscripción a su versión.

**¿Es nuevo, o es el arreglo?** Es el arreglo: lo introdujo el corte de `addon_product` por campo
(cambio 19). Antes no había versión de addon que anclar; ahora hay una, y la mitad que tendría que
anclarla quedó del lado que no la puede escribir.

---

### F-8bA3-004 — Las cuatro fuentes que la FASE 9 agregó no aparecen en la lista de siete invalidaciones

**Qué se rompe.** El capítulo 02 §3 declara que un error de caché acá *«es de seguridad y no de
rendimiento»*. La lista que lo invalida quedó escrita **antes** de que existieran la versión de
piso, la de pre-trial, el grant anclado a un plan y `addon_version`, y **ninguna de las cuatro
entra por sus siete entradas**. El caso más caro: si a la versión de piso se le sembró una clave
comercial —el escenario exacto que `G-R3` dice vigilar— **retirarla no invalida nada**, y toda la
plataforma la sigue recibiendo desde el caché.

**El camino.** Las cuatro, contra la tabla de `V/02` §3.2:

1. **La versión de piso y la de pre-trial.** La entrada aplicable dice *«| se publica una versión
   nueva de un plan **al que hay suscripciones ancladas** | cambia lo que esa versión otorga |»*.
   A las dos versiones no vendibles **nadie está anclado por suscripción**: son las que `BASE` y
   `PRE_TRIAL` apuntan, y esas fuentes no tienen fila de suscripción. La condición nunca se cumple,
   así que publicar una versión nueva de cualquiera de las dos **no invalida a nadie** — y son las
   dos únicas fuentes que **toda persona de la plataforma tiene** (`12-contrato…` §2.5: *«**`BASE`
   es la fuente que toda persona tiene en toda vertical por el solo hecho de existir**»*).
2. **El grant.** Desde el cambio 5 *«se ancla al plan … y resuelve la versión vigente»*
   (`12-contrato…` §2.8). Publicar una versión nueva de ese plan cambia lo que el grant otorga, y
   la misma entrada 6 exige **suscripciones** ancladas. Un grant no es una suscripción — `B/02`
   §2.4 y `NUCLEO/01` §1.5 insisten en que es *«una entidad independiente»*.
3. **La versión de addon.** La entrada 5 es *«| se activa o vence un addon | ídem |»*: cubre el
   ciclo de vida de la **instancia**, no un cambio en **lo que otorga** la versión. Con
   `F-8bA3-003` encima, el cambio ni siquiera necesita una instancia nueva.
4. **Las tres columnas de `vertical`.** La capacidad de activación está en la versión de pre-trial
   *«si y sólo si esa vertical declara evento»* (`V/02` §2.1). Cambiar
   `vertical.evento_de_activacion` cambia el conjunto efectivo de **toda la vertical** y no está en
   la lista.

**Dónde lo permite el diseño.**

- `V/02` §3.2 — la tabla de siete entradas, completa, sin ninguna de las cuatro.
- `V/02` §3 — *«es de las pocas cosas donde **un error es de seguridad y no de rendimiento**: un
  entitlement que sigue vivo después de revocado es acceso indebido»*.
- `V/15` §4.2 — *«**es la misma lista que invalida el caché** (cap. 02 §3.2), con sus siete
  entradas. Una lista, dos consumidores»*: el reconciliador de excedentes hereda los cuatro huecos.
- `V/02` §2.1 — *«⚠️ **Las dos versiones no vendibles son un punto único de falla** … Si alguien le
  siembra una clave comercial a la de piso o a la de pre-trial, **toda la plataforma la recibe
  gratis, para siempre, sin consumir ningún trial**»*. El guard impide sembrarla; nada devuelve la
  plataforma a la normalidad después de retirarla.

**Severidad.** `CRITICA`. Es acceso indebido por el criterio que el propio capítulo fija, y el
sujeto es *toda la plataforma* en vez de un usuario.

**¿Es nuevo, o es el arreglo?** Es el arreglo. Las cuatro fuentes las crearon los cambios 14, 5 y
19; la lista de siete no se volvió a leer al agregarlas, que es la forma de defecto que esta
pasada existe para encontrar.

---

### F-8bA3-005 — Billing tiene que leer entitlements y limits de verticales para decidir si un cambio de plan es upgrade o downgrade

**Qué se rompe.** El contrato declara, en las dos direcciones, que **los valores de lo que otorga
un plan no cruzan**. Y la única regla que decide **cuándo se cobra** un cambio de plan está escrita
como una comparación de entitlements y limits, del lado de billing. O el corte se rompe, o esa
regla no se puede ejecutar — y de ella depende si el monto se muta hoy o al fin del ciclo.

**El camino.**

1. `B/10` §3.5 — *«**La dirección se deriva del delta entre las dos versiones, no del `rank`:**
   - **si algo baja** —**un limit, un entitlement, una cuota de un entitlement medido**— el cambio
   sigue el camino de downgrade (`DEC-SUB-008`): **el monto se muta ya**, las capacidades bajan al
   fin del ciclo …; - **si nada baja**, sigue el camino de upgrade (`DEC-SUB-007`): inmediato»*.
   Y cierra: *«**Cualquier baja manda**»*.
2. Los dos caminos cobran distinto y en momentos distintos. La comparación es, literalmente, leer
   `plan_version_entitlement` y `plan_version_limit` de las dos versiones y compararlas clave por
   clave. **Las dos tablas son de verticales** (`V/02` §2.1, `DEC-ARCH-005`).
3. El contrato lo prohíbe dos veces, explícitamente:
   - §4 — *«**No cruzan los valores de lo que otorga una fuente** — ni los del plan, ni los del
     addon, ni los de un grant. **Sólo la referencia.**»*
   - §4.1 — *«La inversa transporta **política y estado de catálogo, nunca capacidades**:
     **verticales no le dice a billing qué otorga un plan**, le dice cómo se comporta»*.
4. Y la dirección inversa declarada **no lo incluye**: `políticaDePlan(versiónDePlan) → {
   díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }`. No hay campo por el que pase un
   delta de capacidades.
5. Así que el día que se implemente, o billing lee dos tablas de verticales sin contrato —el
   acoplamiento exacto que el corte venía a impedir— o `B/10` §3.5 **no se puede ejecutar** y el
   caso del plan retirado se queda sin regla de dirección, que es el único caso donde el `rank` no
   la da.

**Dónde lo permite el diseño.** Las cuatro citas de arriba, más la regla de vigilancia que este
mismo hallazgo activa: `12-contrato…` §4.2 — *«**Y en la otra dirección**: si billing necesita leer
de verticales algo que no está en los seis campos del §4.1, vale lo mismo.**Una lectura no
declarada es un acoplamiento que nadie está mirando.»*

**Severidad.** `CRITICA`. El camino elegido decide cuándo se muta el monto (`DEC-MP-002` /
`DEC-SUB-008` contra `DEC-SUB-007`), así que la lectura no declarada es la que decide qué se le
cobra a alguien y en qué fecha.

**¿Es nuevo, o es el arreglo?** Lo destapó el arreglo. `B/10` §3.5 es anterior, pero **la
dirección inversa se declaró recién ahora** (cambio 6), y declarar seis campos sin incluir el
consumidor más caro convierte un acoplamiento invisible en uno que el propio contrato afirma haber
enumerado.

---

## ALTA

### F-8bA3-006 — `admite_altas` y `fin_de_servicio` los ESCRIBE billing, y el contrato las declaró sólo de lectura

**Qué se rompe.** La dirección inversa está escrita como dos funciones de lectura. Las dos columnas
que obligó a crear **no las escribe verticales**: las escribe el acto de discontinuar, que es de
billing. Es una escritura cruzando la frontera, sin operación declarada, sin idempotencia y sin
nadie que diga qué pasa si falla a mitad.

**El camino.**

1. `12-contrato…` §4.1 declara la forma: *«`situaciónDeVertical(vertical) → { admiteAltas,
   finDeServicio }`»*, bajo el encabezado *«el §4 enumera con cuidado lo que billing **empuja** a
   verticales, y **nunca declaró lo que billing LEE**»*. Todo el §4.1 es sobre **lecturas**.
2. `B/10` §4.3 describe la escritura: *«**Día 0 — el anuncio.** **La vertical deja de admitir altas
   y trials.** Y en el mismo acto, **cada suscripción viva se cancela en el proveedor de
   inmediato**»*. El mismo acto atómico toca una tabla de verticales y el proveedor.
3. `B/10` §4.6 confirma que el estado vive en la fila de verticales: *«su situación se lee de **dos
   datos con fecha** sobre su propia fila —si admite altas, y su fecha de fin de servicio—»*.
4. Y el contrato §3 dice que **lo único que billing empuja es un aviso**: *«Es lo único que billing
   le **empuja** a verticales»*. Escribir dos columnas no es un aviso.

**Y hay una segunda mitad, del lado de verticales**: **`T1` no lee ninguna de las dos.** Sus
condiciones son *«la vertical declara evento y su plan de trial tiene días de trial > 0»* (`V/03`
§2). Una vertical **discontinuándose** —`admite_altas = no`, con fecha— sigue arrancando trials:
alguien publica una ficha, `T1` dispara, y **consume su trial de por vida** en una vertical cuyo
servicio termina en 60 días. El §10.2 no lo devuelve nunca y la fila sobrevive a todo (`V/02`
§2.2, §4.2 regla 2). `B/10` §4.3 dice *«deja de admitir altas **y trials**»* y ninguna condición de
la máquina lo hace cumplir.

**Severidad.** `ALTA`. La escritura cruzada es el defecto estructural; la mitad de `T1` quema un
activo irrecuperable, pero en una vertical que la persona no va a volver a usar, así que no llega a
`CRITICA`.

**¿Es nuevo, o es el arreglo?** Es el arreglo, y es el **gemelo exacto de `F-8A3-007`** (que sigue
llegando, ver la tabla de reejecución): la FASE 9 declaró la dirección inversa como lectura
mientras creaba, en el mismo movimiento, la escritura cruzada más grande del programa.

---

### F-8bA3-007 — El trinquete del grant necesita dos referencias y el contrato transporta una

**Qué se rompe.** Un grant ahora promete *«nunca otorga menos de lo que otorgaba el día que se
concedió»*. Cumplirlo exige comparar **dos** versiones de plan; el contrato transporta **un** campo
`referencia`. O el piso no llega a quien tiene que aplicarlo, y el beneficiario pierde capacidades
cuando el plan empeora, o verticales lee una tabla de billing que el contrato no declara.

**El camino.**

1. El piso se guarda del lado de billing: `B/02` §2.4 — *«**`permanent_grant.piso_del_trinquete`**
   — **la referencia a la versión que estaba vigente el día que se firmó**»*, en la fila de
   `permanent_grant`, que es una entidad de la épica de billing.
2. Quien aplica el trinquete es **verticales**: `V/15` §2.5 — *«**El trinquete tiene un segundo
   sujeto, y es el mismo mecanismo** … Se compara igual que el del trial —al final, y sólo puede
   subir el resultado»*. La agregación entera es del capítulo 15.
3. El contrato lleva **un solo campo**: `12-contrato…` §2 — *«`referencia: versiónDePlan |
   versiónDeAddon ← NO anulable`»*, y §2.1 lo define en singular: *«**la referencia, no los
   valores**: una versión de plan o una versión de addon»*.
4. Con un campo, la fuente `GRANT` sólo puede transportar **la vigente** (§2.8). El piso se queda
   del lado de billing, y verticales no tiene de dónde leerlo sin ir a `permanent_grant`.
5. La salida aparente —que billing compare y mande el mejor— es la que el §2.3 prohíbe: *«Si el
   contrato devolviera los entitlements resueltos, la resolución del capítulo 15 … pasaría a vivir
   del lado de billing»*. Comparar dos versiones **es** resolverlas.

**Severidad.** `ALTA`. La promesa *«un grant nunca otorga menos»* es incumplible tal como está
repartida, y quien la pierde es alguien a quien se le firmó un *«para siempre»*.

**¿Es nuevo, o es el arreglo?** Es el arreglo entero: el trinquete del grant lo creó el cambio 5, y
el campo único de `referencia` lo fijó el cambio 4 en el mismo ciclo.

---

### F-8bA3-008 — El `alcance` de un addon dejó de ser un dato de billing, y el contrato sigue pidiéndoselo a billing

**Qué se rompe.** El contrato reparte el trabajo del pliegue en dos tramos diciendo que billing
*«sólo [tiene que] devolver el `objetivo` que ya guarda en `addon_instance`»*. Pero el **`alcance`**
—el otro campo del par, y el que decide en qué tramo cae la fuente— salió de billing con el corte
por campo: el *tipo de scope* ahora vive en `addon_version`, del lado de verticales. Billing tiene
que devolver en el contrato un dato que dejó de ser suyo.

**El camino.**

1. El contrato §2.1 pide los dos campos a quien responde: *«| **`alcance`** | `VERTICAL` ·
   `LISTING` · `USER` · `GLOBAL` (§2.7) |»* y *«| **`objetivo`** | la ficha, si `alcance = LISTING`;
   nada en los otros tres |»*.
2. §2.7 dice de dónde sale cada uno: *«**la firma `cobertura(user, vertical)` no cambia**, y
   billing no necesita saber nada de fichas: **sólo devolver el `objetivo` que ya guarda en
   `addon_instance`**»*, y la tabla de mapeo pone *«| addon | los cuatro del §40 | `LISTING` ·
   `VERTICAL` · `USER` · `GLOBAL` |»*.
3. El tipo de scope se mudó: `V/02` §2.1 — *«| **`addon_version`** | qué otorga un addon y con qué
   valores, vigencia, **tipo de scope** |»*, y la tabla del corte — *«| `addon_version` | qué otorga
   y con qué valores, vigencia, **tipo de scope** | **VERTICALES** |»* contra *«| `addon_product` |
   precio, recurrencia, verticales compatibles | **BILLING** |»*.
4. `B/02` §2.4 lo confirma desde el otro lado: `addon_product` guarda *«precio, recurrencia y
   verticales compatibles, más `version_id` → `addon_version` (épica de verticales), que es donde
   viven **qué otorga, la duración y el tipo de scope**»*.
5. `addon_instance` sólo conserva *«el objetivo corresponde al tipo de scope del producto»* — una
   restricción que billing **ya no puede verificar sola**, porque el tipo de scope está del otro
   lado.

**Severidad.** `ALTA`. No regala capacidades por sí sola, pero deja la única fuente con dos tramos
de pliegue sin un lado que pueda responder su propio campo, y activa la regla de vigilancia del
§4.2 en la dirección que nadie estaba mirando.

**¿Es nuevo, o es el arreglo?** Es el arreglo: lo introdujo el corte de `addon_product` por campo
(cambio 19), que movió el scope sin revisar quién lo transporta.

---

### F-8bA3-009 — `UNIQUE(hash_del_correo, vertical)` hace fallar una publicación, y nadie dice qué pasa con un cambio de correo

**Qué se rompe.** La restricción nueva es dura, sin condición de estado, y **la operación que la
viola no es un registro: es publicar una ficha**. Dos personas reales que comparten un correo —un
matrimonio, un negocio— y la segunda no puede publicar, con un error de base en medio de una
transacción que además tenía que crear la fila de trial. Y nadie declaró qué le pasa al hash cuando
la persona cambia de correo.

**El camino.**

1. `V/02` §2.2 — *«**`UNIQUE(hash_del_correo_normalizado, vertical)`**, sin condición de estado»*.
2. El hash se escribe en `T1` (`V/02` §2.2 lista las columnas; `15-fase-9/03-R3-resuelto.md` §1.2:
   *«el hash del correo normalizado, el piso del trinquete, la referencia al plan y las dos fechas
   se escriben **todos** en `T1`»*).
3. `T1` es un **efecto de `PB1`, en la misma transacción** (`15-fase-9/03-R3-resuelto.md` §1.3,
   paso 6, citando `NUCLEO/03` §1 regla 3: *«una transición es atómica junto con sus efectos
   locales»*). Una colisión de hash **revierte la publicación entera**.
4. Ningún capítulo declara qué se le contesta. El contrato de error del §1.2 de `V/17` reparte
   mensajes por paso, y éste no falla en ningún paso: falla **después** de los nueve, en la base.
5. **Y el cambio de correo no está resuelto en ninguna dirección.** Si el hash se actualiza al
   cambiar de correo, quien consumió su trial con el correo X, se mudó a Y y vuelve con X **recibe
   un trial nuevo**, que es la puerta exacta que la restricción vino a tapar. Si no se actualiza, el
   hash de un correo que ya no es de nadie **bloquea de por vida** a quien lo adopte después — y
   como la fila se conserva íntegra para siempre (`V/02` §4.1), el bloqueo no caduca.

**Severidad.** `ALTA`. El caso de la colisión es raro y ruidoso; el del cambio de correo es
silencioso y va en las dos direcciones, una de las cuales regala trials.

**¿Es nuevo, o es el arreglo?** Es el arreglo: la restricción es el cambio 16, aplicada como
condición de R3 (*«R3 no se puede aplicar sin él»*, `15-fase-9/03-R3-resuelto.md` §6.3). Lo que no
se escribió es su comportamiento cuando choca.

---

### F-8bA3-010 — `G-R3` se comprueba en CI sobre un catálogo que no vive en CI

**Qué se rompe.** El guard que la FASE 9 declara *«el que más carga lleva»* —el único que separa a
la plataforma de recibir una clave comercial gratis para siempre— tiene por sujeto **filas de base
de datos**, y se declara *«sobre el catálogo, en CI»*. Una siembra hecha en producción, o una
corrección aplicada a mano sobre la base, no pasa por ningún PR y el guard no la ve nunca.

**El camino.**

1. `V/02` §2.1 — *«**`G-R3`** — ninguna de las dos versiones no vendibles de una vertical otorga
   una clave de la clase comercial ni ningún entitlement medido … **Se comprueba sobre el catálogo,
   en CI**, en las dos direcciones. Es una verificación automática y no una revisión, **porque es
   el único lugar donde un error de siembra no lo ve nadie**»*.
2. `V/20` §1 ubica la capa: *«| **guards** | propiedades del **código**, no de una ejecución | **el
   árbol de fuentes, en CI** |»*. El sujeto de `G-R3` no es el árbol de fuentes: son
   `plan_version_entitlement` y `plan_version_limit`.
3. Y el dato que necesita del otro lado tampoco está en el árbol: el *«si y sólo si»* se apoya en
   `vertical.evento_de_activacion` y en *«su plan de trial tiene días > 0»* — dos columnas de base.
4. `V/20` §2.1 agrega la exigencia que lo cierra: *«**Todo guard de esta lista lleva un caso que lo
   hace fallar a propósito**»*. Un guard cuyo sujeto no está disponible en la capa donde corre no
   tiene cómo fallar a propósito sobre el dato real.

**Severidad.** `ALTA`. Es el único control de un punto único de falla que el propio capítulo
describe como *«toda la plataforma lo recibe gratis, para siempre»*, declarado en una capa que no
alcanza a su sujeto. `G3` tiene el mismo problema y es anterior; lo nuevo es que ahora el mecanismo
sostiene solo una decisión de diseño.

**¿Es nuevo, o es el arreglo?** Es el arreglo: `G-R3` es del cambio 22 y su sujeto —las dos
versiones no vendibles— lo creó el cambio 14.

---

### F-8bA3-011 — La derivación del plan de trial se queda sin fuente cuando la vertical cierra a altas, y los trials vivos quedan apoyados en un trinquete que no se diseñó para eso

**Qué se rompe.** Los entitlements del plan de trial **no se guardan: se derivan en cada
resolución**, de los planes vendibles y vigentes. El día que se retira el último plan vendible de
una vertical —un estado declarado normal y que *«puede durar años»*— la derivación se queda sin
entradas, y **cada trial vivo se resuelve contra nada**. Lo único que lo sostiene es el trinquete,
que fue diseñado para otra cosa y que nadie declaró como la red de este caso.

**El camino.**

1. `V/02` §2.1 — *«**El plan de trial no es una entidad aparte** … Sus limits y entitlements **no
   se guardan**: se derivan en cada resolución, **del plan vendible de `rank` más alto y del más
   bajo**»*.
2. `V/10` §2 fija la lectura: *«| **la derivación del plan de trial** (§10.3) | las versiones
   **vigentes y vendibles**, la de `rank` más alto y la más baja |»*.
3. `B/10` §4.1 declara el estado sin verlo como un problema para los trials **ya corriendo**:
   *«Retirados todos los planes vendibles la vertical queda **cerrada a altas**: nadie nuevo entra,
   **nadie nuevo arranca un trial —la derivación del §10.3 se queda sin fuente**…—, y **todos los
   que están adentro siguen exactamente igual, indefinidamente**»*. Los que están adentro **con un
   trial** no siguen igual: su conjunto efectivo se deriva en cada lectura.
4. El trinquete podría taparlo —`V/15` §2.5: *«es un **piso** … sólo puede subir el resultado»*—
   pero su motivo declarado es otro: `DEC-TRIAL-002` protege contra que el catálogo **empeore**, no
   contra que **desaparezca**, y nadie escribió que la resolución de un trial pueda dar vacío y
   apoyarse enteramente en él.
5. Y el reconciliador de excedentes no interviene: retirar un plan **no está en la lista de siete**
   salvo por la entrada de *«suscripciones ancladas»*, y un trial no es una suscripción.

**Severidad.** `ALTA`. Es una caída de capacidades sin transición, sin aviso y sin reconciliador,
en un camino que el capítulo 10 declara estable y previsible.

**¿Es nuevo, o es el arreglo?** Es un borde anterior que **el arreglo agrandó**: la asimetría entre
el plan de trial (deriva) y los dos no vendibles nuevos (guardan) es del cambio 14, y el capítulo
la defiende explícitamente como deliberada sin decir qué pasa cuando la fuente de la derivación se
vacía.

---

## MEDIA

### F-8bA3-012 — «Son seis campos» y la firma tiene siete; el dominio enumerado dice cinco

**Qué se rompe.** La regla de vigilancia de la dirección inversa se ancla en un número —*«algo que
no está en **los seis campos** del §4.1»*— y el número no se puede contar contra la firma que lo
acompaña. Un campo que no entra en la cuenta es un campo que la regla no protege.

**El camino.**

1. La firma, en `12-contrato…` §4.1: `políticaDePlan → { díasDeGrace, díasDeTrial, permitePausa,
   vigente, vendible }` y `situaciónDeVertical → { admiteAltas, finDeServicio }`. Se cuentan:
   **siete**.
2. El texto inmediato dice *«**Son seis campos, y el sexto es el que importa declarar.**
   `vigente`/`vendible` no estaba en la cuenta original»*. El seis sale de tratar `vigente` y
   `vendible` como uno, lo cual no es cierto en la firma ni en las lecturas: `V/10` §2 las usa por
   separado —*«la versión vigente … **y sólo si es vendible**»* contra *«su versión anclada, sea
   vigente o no, sea vendible o no»*— y son exactamente la distinción que ese capítulo corrigió.
3. `15-fase-9/00-dominios-de-los-racimos.md`, R2 §3, cuenta un tercer número: *«| dirección
   inversa: **los 5 campos** que billing lee | 5 |»*, sobre la tabla D1–D5.
4. La regla que consume el número: §4.2 — *«si billing necesita leer de verticales algo que no está
   en los seis campos del §4.1, vale lo mismo»*.

**Severidad.** `MEDIA`. No falla en ejecución; deja sin sujeto comprobable a la única regla que
vigila la dirección que `F-8bA3-005` y `F-8bA3-008` acaban de mostrar que está abierta.

**¿Es nuevo, o es el arreglo?** Es el arreglo: la dirección inversa y su conteo son del cambio 6.

---

### F-8bA3-013 — Las tres columnas nuevas de `vertical` no declaran quién las muta, y una de ellas no puede cambiar atómicamente con la versión que el guard le exige

**Qué se rompe.** `plan_version` es inmutable por decisión; `vertical` no dice nada. `G-R3` exige
un *«si y sólo si»* entre una columna mutable (`evento_de_activacion`) y una versión inmutable (la
de pre-trial). Encender el trial de una vertical —el caso concreto que `DEC-TRIAL-003` deja
pendiente para Partner— exige **tres escrituras en tres tablas**, y el guard falla en cualquier
orden intermedio.

**El camino.**

1. `V/02` §2.1 — *«**| `vertical` |** el espejo en base del enum de código, **su evento de
   activación**, **si admite altas** y **su fecha de fin de servicio** |»*. Ninguna nota de
   inmutabilidad, ninguna de quién escribe, ninguna sobre si vuelven atrás. La fila de `plan`,
   justo debajo, sí la lleva: *«**Muta libremente** (`DEC-ARCH-001`)»*.
2. El *«si y sólo si»*: *«**La capacidad de activación está en la versión de pre-trial de una
   vertical si y sólo si esa vertical declara evento de activación y su plan de trial tiene días >
   0**»*, con `G-R3` comprobándolo *«en las dos direcciones»*.
3. Encender Partner exige: escribir `vertical.evento_de_activacion`, **publicar una versión nueva**
   del plan de trial con días > 0 (la versión es inmutable), y **publicar una versión nueva** del
   plan de pre-trial con la capacidad de activación. Entre la primera y la tercera, el catálogo
   viola el guard.
4. `B/10` §4.6 agrega la única propiedad que alguien declaró sobre estas columnas, y lo hace desde
   la otra épica: *«sin que haya transiciones que restringir más allá de que **ninguno de los dos
   vuelva atrás solo**»*. Es una regla de máquina escrita en el capítulo de la épica que no es dueña
   de la tabla.

**Severidad.** `MEDIA`. No rompe nada hoy —Partner está apagado—, y el día que se encienda es un
procedimiento que falla ruidosamente en CI, no en producción.

**¿Es nuevo, o es el arreglo?** Es el arreglo: las tres columnas son el cambio 15 y el *«si y sólo
si»* es del cambio 14.

---

### F-8bA3-014 — El `hasta` del título `BASE` es `NO_VENCE`, y en una vertical que se discontinúa sí vence

**Qué se rompe.** El §2.6 asigna al título `BASE` el valor `NO_VENCE`, definido como *«no hay
ventana **porque no hay fin**»*. Una vertical discontinuada tiene un fin, con fecha, escrito en su
propia fila. El aviso con ventana que `V/15` §4.4 construye sobre `hasta` no tiene de dónde salir
para la fuente que **toda persona tiene**.

**El camino.**

1. `12-contrato…` §2.6 — *«| **`NO_VENCE`** | grant permanente, **título `BASE`** | no hay ventana
   **porque no hay fin** |»*.
2. `12-contrato…` §2.5 — *«Transporta la referencia a la **versión de piso** de esa vertical … y su
   `hasta` es `NO_VENCE`»*.
3. `B/10` §4.3 le pone fecha: *«**La fecha de fin de servicio es una sola para toda la vertical**»*,
   y *«**El día del fin de servicio** … Las fichas pasan a `UNPUBLISHED_BY_BILLING`»*. Desde ese
   día la versión de piso de esa vertical no otorga nada a nadie, incluida *«la de contratar una
   suscripción»* que es su razón de existir (`V/02` §2.1).
4. Los tres avisos de `DEC-MP-002` sí salen, pero por el camino de la discontinuación, no por la
   ventana del contrato. Un consumidor que decidiera con `hasta` —que es para lo que el campo
   existe— no vería venir nada.

**Severidad.** `MEDIA`. El aviso existe por otro camino; lo que queda mal es el campo del contrato,
que es la pieza que `DEC-ARCH-006` protege de las mutaciones unilaterales.

**¿Es nuevo, o es el arreglo?** Es el arreglo: `BASE` es del cambio 1 y los cuatro valores de
`hasta` del cambio 3; el fin de servicio por vertical es anterior a los dos.

---

## BAJA

### F-8bA3-015 — Las tres versiones no vendibles necesitan un `rank` que no significa nada

**Qué se rompe.** `plan_version` declara `rank` entre *«lo que tiene efecto y por eso es
inmutable»*, sin marcarlo opcional. Las tres versiones no vendibles de cada vertical —trial,
pre-trial y piso— no participan de ningún orden: ni de la pricing, ni de la comparación de tiers,
ni de la derivación. Cada una carga un valor que ninguna lectura consume y que un `rank` mal
elegido puede hacer colisionar el día que alguien marque una vendible por error.

**El camino.**

1. `V/02` §2.1 — *«| **`plan_version`** | lo que tiene efecto y por eso **es inmutable**: `rank`,
   si es vendible, días de grace, días de trial, si permite pausa, si hereda Turista VIP |»*.
2. La única restricción que lo usa está condicionada: *«**`UNIQUE(vertical, rank) WHERE vendible
   AND vigente`**»*. Las tres no vendibles quedan fuera del índice y, por lo tanto, sin ninguna
   regla sobre qué valor llevan.
3. Los cuatro consumidores del `rank` que `V/10` §2 enumera leen *«vigentes y vendibles»*, los
   cuatro.

**Severidad.** `BAJA`. Falta de precisión en el modelo; no falla.

**¿Es nuevo, o es el arreglo?** Es el arreglo: con el cambio 14 las versiones no vendibles por
vertical pasaron de una a tres.

---

## Los diecisiete hallazgos de la FASE 8, reejecutados sobre el texto nuevo

Cada uno se volvió a recorrer contra los capítulos corregidos. **Ocho cortan, nueve siguen
llegando.** Los que siguen **no cuentan como hallazgos nuevos** y conservan su ID viejo.

| ID | veredicto | dónde corta, o en qué paso sigue llegando |
|---|---|---|
| `F-8A3-001` — `GRANT` no guarda qué otorga | **CORTA** | paso 2: `permanent_grant` *«no se puede escribir sin la referencia»* — `B/02` §2.4 le dio `plan_id` no anulable. El paso 4 (*«un grant no tiene versión de plan»*) se cae con *«anclar no es ser»* |
| `F-8A3-002` — nadie guarda el valor de un addon | **CORTA** | paso 1: `addon_version_limit` guarda el 30 (`V/02` §2.1). El segundo filo —`capability` singular contra *«efectos»* plural— corta en el mismo lugar: dos tablas hijas |
| `F-8A3-003` — el trial se apoya en `user_id` y el borrado lo cambia | **CORTA** | paso 4: `UNIQUE(hash_del_correo_normalizado, vertical)` (`V/02` §2.2). El defecto se convirtió en `F-8bA3-009`, que es lo que la restricción **no** dice |
| `F-8A3-004` — la migración deja afuera 3 y transcribe 2 que no van | **CORTA** | paso 3: no se transcribe ninguna fila (`V/21` §2.1). Las dos `comp` son del propio owner, así que la decisión comercial que el hallazgo pedía tampoco tiene sujeto |
| `F-8A3-005` — dos máquinas sin entidad | **SIGUE** | paso 3: `V/02` §2.5 sigue siendo **una tabla con una fila**, `listing`. Ni postulación ni presencia de Partner. `V/03` §11 sigue declarando la novena máquina. Y ahora `F-8bA3-001` lo agrava: en Partner `cubierto` nunca cae, así que ni siquiera el disparador existiría |
| `F-8A3-006` — cinco valores de config sin dónde vivir | **SIGUE** (4 de 5) | corta **sólo el punto 2**: `vertical.evento_de_activacion` existe (`V/02` §2.1). Siguen sin columna el techo de días de trial acumulados (`V/11` §3.2), la espera tras un rechazo (`V/18` §2.2), el `N` de `PB5` (`V/03` §9) y los overrides del plan de trial |
| `F-8A3-007` — `T4` es una escritura de billing sobre una máquina de verticales | **SIGUE**, agravado | paso 5: el contrato §4.1 declaró la dirección inversa **como lectura** (`políticaDePlan`, `situaciónDeVertical`) y `T4` sigue siendo una escritura. Y ahora tiene un gemelo más grande: `F-8bA3-006` |
| `F-8A3-008` — las filas migradas nacen sin campaña, piso ni hash | **CORTA** | paso 1: no hay filas migradas |
| `F-8A3-009` — nadie ejecuta la migración | **CORTA** | paso 1: `16-fase-7-del-paraguas.md`, tabla de áreas — *«migration → los dos `21-migracion.md`, y desde la decisión de no migrar, **casi sin sujeto**»*. Quedan tres llamadas, declaradas FASE 7 |
| `F-8A3-010` — el §65 exige `jobs` y verticales no define ni uno | **SIGUE**, agravado | paso 2: `job`/`cron`/`idempot` sobre los once capítulos de `HOS-1353` sigue devolviendo **tres apariciones y ningún job definido** (`V/17` §3.3, §3.5 y `V/20` §1). Y el reloj **subió de categoría**: `V/17` §3.4 lo declara *«una segunda clase de actor»* con guard propio (`G-R3-B`), sobre procesos que ningún capítulo define |
| `F-8A3-011` — el techo de días de trial no se puede hacer cumplir ni mostrar | **SIGUE** | paso 2: `V/02` §2.2 sigue guardando *«inicio, fin»* y nada más. Sin contador y sin origen, `V/11` §3.5 sigue obligando a dos superficies a mostrar lo que ninguna entidad guarda |
| `F-8A3-012` — `versiónDePlan` miente para la fuente `TRIAL` | **SIGUE** | paso 3: `V/02` §2.1 sigue diciendo que los del plan de trial *«**no se guardan**: se derivan»*, y el dominio de R2 lo lista como caso no mirado — *«(`TRIAL`, `versiónDePlan`) — el plan de trial **no guarda** limits ni entitlements»*. Lo que cortó es sólo la mitad `PRE_TRIAL`: esa versión sí guarda |
| `F-8A3-013` — siete entradas de invalidación y un aviso que no las distingue | **SIGUE**, agravado | paso 2: `ADDON` ya es un `tipo` del contrato, pero es de clase `COMPLEMENTO` y **no cuenta para `cubierto`** (§2.4), así que el aviso *«la cobertura cambió»* sigue sin tener qué decir cuando un addon se activa o vence. Y la lista se quedó cuatro entradas corta: `F-8bA3-004` |
| `F-8A3-014` — Mi Cuenta quedó del lado de billing | **SIGUE** | paso 2: `V/19` §2 sigue siendo una tabla con **una fila**, la de Admin |
| `F-8A3-015` — tres capítulos reclaman cerrar el mismo hueco | **SIGUE** | paso 3: los frontmatter de `V/02` y `B/02` siguen declarando idénticos `C-ARCH-01`, `S-ARCH-01`, `M-ARCH-02`, `M-DATA-01`, y `M-ARCH-02` (caché) está sólo en la mitad verticales |
| `F-8A3-016` — nueve pasos sobre siete, 51 sobre 49 | **SIGUE** | paso 1: `V/17` §1.1 sigue cerrando con *«Quedan **nueve pasos** y una precondición»* y la tabla de §1.2 sigue numerando **1 a 7**. Y ahora hay un tercer conteo del mismo tipo: `F-8bA3-012` |
| `F-8A3-017` — referencias que apuntan a secciones que se mudaron | **SIGUE** | paso 1: `V/02` §3.2 sigue justificando una entrada con *«son fuentes independientes (**§2.4**)»*, y `V/02` no tiene §2.4 — la frase vive en `B/02` §2.4. El salto de §2.2 a §2.5 también sigue |

---

## Ataques que intenté y el diseño resistió

**1. «`cubierto` se puede volver verdadero comprando un addon estando suspendido.»** No, y está
cerrado con su razón escrita: `12-contrato…` §2.4 partió las fuentes en tres clases exactamente
para eso —*«el fail-open lo habría **introducido el arreglo**»*— y apoya la regla en dos capítulos
que ya la tenían (*«Un addon nunca fue un título: era el complemento de uno»*). La defensa es por
clase derivada del `tipo`, no por un chequeo. Es de lo mejor resuelto del material.

**2. «Una fuente puede llegar sin referencia y el paso 6 falla abierto.»** No: la referencia **no
es anulable** (§2.3) y la forma elegida es *«hay una fila que no se puede escribir»* en vez de una
rama. Las dos columnas que faltaban —`courtesy_grant.subscription_id` y `permanent_grant.plan_id`—
se crearon con la misma regla. El ataque requiere una fila que la base rechaza.

**3. «El piso del trinquete del trial se puede mover publicando versiones.»** No: se guarda como
**referencia a versiones**, nunca como copia (`V/02` §2.2), y las versiones son inmutables. El
ataque no tiene superficie. (La mitad del grant sí la tiene, pero por otro motivo: `F-8bA3-007`.)

**4. «Un addon global regala capacidades en la vertical que sólo tiene un trial.»** Sigue cerrado
por `V/11` §5.3, y el corte de `addon_product` no lo tocó: la regla es sobre el **título** de la
vertical, no sobre dónde vive la definición del addon.

**5. «La versión de piso le da a un `Guest` algo que no le corresponde.»** No por esta vía:
`V/15` §5.2 lo cierra **por clase** —*«El visitante sin cuenta no recibe ningún entitlement
medido»*— y `V/02` §2.1 limita la versión de piso a *«ninguna capacidad comercial»* con guard. El
ataque necesita una siembra, y la siembra es `F-8bA3-010`, que es sobre el guard y no sobre la
regla.

**6. «Dos sucesoras vivas dejan dos compromisos cobrando.»** No: las dos claves parciales partidas
por `sucede_a` (`B/02` §2.2) hacen que *«la segunda sucesora colisiona con la primera»* sin ninguna
regla extra. El razonamiento de por qué **no** se sacó `PENDING_AUTHORIZATION` de los vivos está
escrito y es correcto.

**7. «Sin migrar, alguien conserva un derecho que el sistema nuevo no ve.»** No encontré ninguno
que no esté declarado: `V/21` §2.3 enumera lo que se pierde —*«Nada de plata … el «trial ya
consumido» de seis personas»*— y lo mide. Lo que sí queda sin declarar es el **camino de vuelta**
de esas personas, y eso es `F-8bA3-002`, que no depende de la migración.

**8. «Las ocho filas `UNKNOWN` de la matriz condicionan algo de este vector.»** Ninguna condiciona
el modelo de datos de verticales. `EX-1` —si una autorización creada y nunca completada vence— dejó
de rozar mi vector cuando se decidió no migrar: las tres `abandoned` ya no se transcriben, así que
el desenlace de esa medición no cambia ningún hallazgo de acá.

---

## Fuera de mi vector

Lo que vi y le toca a otro agente. No lo desarrollo.

**`NUCLEO` · `RECONCILIATION_REQUIRED` dejó de ser un estado y pasó a ser la marca
`requiere_conciliación` (`B/02` §2.2, `B/03` §3.1), pero la regla 1 del capítulo 03 del núcleo
sigue diciendo que toda transición no declarada lo **emite** *«si tocaba plata o estado»*.** Emitir
un estado que ya no existe no está definido, y las máquinas de verticales siguen sin tener ni el
estado ni la marca. Es la misma observación que dejé en la FASE 8, movida de sujeto por el cambio 8.
Es A2 / pasada C.

**Autorización · el paso 2 pregunta por «el estado de la persona» y ninguna entidad lo guarda.**
Sigue igual: ninguna de las tres mitades del capítulo 02 define una fila `user`, y `V/17` §1.2 hace
del paso 2 el segundo de los nueve. Es A1, y la mitad de datos sigue sin dueño.

**Máquinas · `T3` no dispara para quien tiene suscripción autorizada, y nadie declara qué termina
ese trial.** El dato es mío y lo reporté como `F-8bA3-002`; la parte de *cómo debería cerrarse la
máquina* —una transición `PRE_TRIAL`/`TRIAL_ACTIVE` → `TRIAL_CONVERTED` que hoy no existe— es
diseño de máquinas, y es A2.
