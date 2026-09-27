---
title: Master Spec 21 — Migración
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-27
status: CURRENT
fase: 2
capitulo: 21
cierra:
  - M-MIG-01
  - O-MIG-01
  - R-MIG-01
---

# 21 · Migración

Mitad **VERTICALES** del capítulo 21 del programa. La otra mitad vive en la otra épica.

Este capítulo es corto por una razón que está medida: **no hay casi nada que migrar.**

Los tres huecos que cierra se contestan con el mismo número, y el número no se hereda del PDR:
se midió, y se re-midió al escribir este capítulo.

---

## 2. El trial ya consumido · cierra `M-MIG-01`

### 2.1 La pregunta ya no tiene sujeto: NO SE MIGRA

`M-MIG-01` preguntaba si alguien que consumió un trial bajo reglas distintas —otro alcance, otra
duración, otro disparador— arrastra el consumo al modelo nuevo. **La pregunta se disuelve porque
no se transcribe ninguna fila.**

> **El sistema nuevo no hereda una sola fila. Las ocho suscripciones vivas se cancelan, y quien
> tenga algo vivo se suscribe de nuevo.**

### 2.2 Qué hizo posible la decisión, y no fue un criterio técnico

Hasta que el owner aportó el dato, nadie sabía **de quién eran las ocho**. Con eso:

| las ocho | quiénes son |
|---|---|
| **2 `comp`** | **del propio owner.** No hay un cliente real detrás de ninguna |
| **3 `abandoned`** | no tienen **nada vivo** que migrar: abandonaron el checkout. **Verificado también del lado del proveedor** el 2026-09-24 (`B/21` §2.4) |
| **3 `trialing`** | clientes reales, **y contactables** — el owner puede hablarles para que se resuscriban |

Las tres `trialing` son las **únicas** con preapproval vivo (medido: 3 de 3, y ninguna de las otras
cinco), y sobre ellas se apoyaba **todo lo pesado** de la migración: el punto de no retorno, el
orden forzado y la ausencia de rollback. **Con las ocho recuperables por teléfono, esa carga no
tiene sujeto.**

### 2.3 Qué cuesta cada camino, y qué se pierde exactamente

| | |
|---|---|
| **migrar** | escribir una unidad de trabajo nueva, el orden forzado, el punto de no retorno **por fila**, y aceptar que el rollback no existe pasado cierto paso |
| **no migrar** | **tres llamadas** y dos cuentas propias |

**Qué se pierde, medido:**

- ~~**Nada de plata.** No hay **un solo pago histórico**: ningún comprobante, ninguna serie que
  reconstruir.~~ **La plata del sistema viejo**: hasta el 2026-09-17 no había un solo pago; desde el
  2026-09-26 los hay (`B/21` §1.3), y **no se conservan** — ni se transcriben ni se congelan las
  tablas viejas (owner 2026-09-25; FASE 9 completa, `CT-6` y `2a`; `B/21` §4).
- ~~**El «trial ya consumido» de seis personas** —las tres `abandoned` y las tres `trialing`—, que
  sin migrarlo **podrían repetir trial**. Son seis personas conocidas, y tres ya habían abandonado
  el checkout igual.~~ ~~**Ya no se pierde** (FASE 8 completa, owner 2026-09-25): el corte escribe
  una fila de `trial` **ya consumida** por cada dueño que tenía ficha o suscripción en el sistema
  viejo (§2.4, *«el rastro de que ya fue cliente»*), y eso incluye a esas seis. No es migrar su
  trial: es la misma forma que la lápida de billing.~~ **El trial ya consumido de todo cliente
  actual se pierde, y a propósito**: el corte no siembra trials consumidos, así que quien tenía
  ficha o suscripción en el sistema viejo **puede estrenar el trial en el sistema nuevo** (owner
  2026-09-25; FASE 9 completa, `2g`): *«A los clientes ya suscriptos les regalamos el trial de
  nuevo: los tomamos como clientes nuevos. Sólo les respetamos la ficha para que no la tengan que
  cargar de nuevo; la suscripción es como si recién arrancaran.»* Revierte la regla del 2026-09-25
  de la FASE 8 completa (§2.4, *«el rastro de que ya fue cliente»*, tachado).

**El argumento de fondo no es de pereza**: se estaba construyendo una migración para **ocho filas
sin un solo pago, todas de gente a la que se puede llamar**. Diseñarla, revisarla, ejecutarla y
garantizar su rollback es desproporcionado frente a un mensaje. Y el beneficio extra es real: **el
sistema nuevo arranca sin una sola fila heredada** —sin transcripciones, sin estados viejos, sin
dudas sobre si algo quedó mal migrado—. Es el escenario más limpio posible, y **sólo está
disponible ahora**, mientras son ocho.

### 2.4 Cómo amanece la población existente: se despublica, y se la llama

**El programa nunca preguntó esto.** Sin fila de `trial`, el estado es `PRE_TRIAL` por
construcción —*«`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene»* (`V/03` §2)—, así que ~~**el
100 % de los usuarios de producción amanece ahí**~~ ~~**amanece ahí todo el que no tenía ficha ni
suscripción en el sistema viejo**; **el dueño que sí la tenía amanece en `TRIAL_CONVERTED`**, por la
fila que el corte le escribe (abajo, *«el rastro de que ya fue cliente»*; FASE 8 completa, owner
2026-09-25). Lo que sigue razona sobre `PRE_TRIAL` y vale igual para ellos: `TRIAL_CONVERTED`
tampoco emite fuente ni cubre (`V/03` §2, *«qué contesta el contrato en cada estado»*).~~ **el 100 %
de los usuarios de producción amanece ahí, otra vez**: el corte no escribe filas de `trial` y los
clientes actuales se tratan como nuevos (owner 2026-09-25; FASE 9 completa, `2g`; abajo, *«el
rastro de que ya fue cliente»*, revertido). Y el evento que los sacaría **ya ocurrió**: `T1`
dispara con *«la ficha queda publicada»*, que es la **transición** de publicar, y sus fichas ya
están publicadas.

**Y la guarda nueva del par `T1`/`T6` no cambia esta conclusión, que es lo que hay que
verificar.** Desde que `T1` exige `cubierto` **falso** y `T6` lo exige **verdadero** (`V/03` §2),
el mismo evento podría mandar a alguien a `TRIAL_CONVERTED` en vez de a `TRIAL_ACTIVE`. **La
conclusión se sostiene, pero por el argumento del párrafo de arriba y no por `cubierto`: el evento
ya ocurrió, así que la mañana del corte no dispara NINGUNA de las dos.** Nadie publica una ficha
que ya está publicada, y sin evento no hay transición — para las ocho filas por igual. `T7`
tampoco: Alojamiento ya tiene sus días de trial en `> 0` y el corte no enciende nada.

**Dos correcciones sobre esta misma verificación, porque razonaba sobre el conjunto equivocado:**

1. **No es cierto que «nadie tiene un título vivo».** Las ocho suscripciones se cancelan (§2.1),
   sí, pero la otra mitad del corte **escribe dos `permanent_grant`** en el mismo acto —las dos
   cortesías del owner, `B/21` §2.4; paso 3b del `16-fase-7…` §4.2— y un `GRANT` con `hasta: NO_VENCE` es de clase **`TÍTULO`**
   (`12-contrato…` §2.4). Para esas dos cuentas `cubierto` es **verdadero** en cuanto el grant
   existe. No cambia lo de abajo —no dispara ninguna transición—, pero sí cambia **cuál
   dispararía** el día que publiquen algo nuevo, y eso es el punto 3.
2. **Y por eso `PB2` tampoco las alcanza.** Con `cubierto` verdadero no hay cambio de cobertura
   que despublique nada: **lo de abajo vale para seis de las ocho**, no para las ocho.
3. ~~**El orden entre la escritura de los dos grants y el paso 4 no está fijado en ningún lado, y
   hay que fijarlo en el procedimiento del corte.**~~ **El orden entre la escritura de los dos
   grants y el paso 4 quedó fijado: los grants son el paso 3b, antes del 4** (`16-fase-7…` §4.2;
   FASE 9 completa, `DB-7`). Si los grants se escriben **antes**, esas dos
   cuentas nunca pierden cobertura; si se escriben **después**, pasan por una ventana con
   `cubierto` falso en la que `PB2` les baja las fichas y `PB3` se las devuelve. Las dos ramas
   terminan igual y el residuo es una despublicación visible de minutos sobre dos cuentas del
   owner: **es un orden que hay que escribir, no una decisión de diseño**. **Desde R1 las fichas
   de esas dos cuentas nacen `UNPUBLISHED_BY_BILLING` como todas** (tabla de abajo), así que
   ningún `PB2` les baja nada y el grant del 3b las sube por `PB3`: el residuo son los minutos
   entre el nacimiento y el grant, el mismo que este punto ya acepta (FASE 9 vuelta 1,
   `F-8V1C2-012`).

~~**Lo que este § NO decide es qué pasa con el trial de esas dos cuentas.** Cubiertas por un grant,
el día que publiquen una ficha dispara **`T6`** y su fila de `trial` nace **consumida**; y si ese
grant se revocara alguna vez, quedarían sin grant y sin el trial que nunca usaron. Eso es un
defecto de la máquina de trial, no del corte, **está abierto y lo decide el owner**. Acá sólo se
declara que el corte pone a dos cuentas en esa posición, y que las dos son suyas y *«regenerables
de cero»* (`B/21` §2.4) — que es lo que lo vuelve tolerable mientras se decide.~~ ~~**El trial de esas
dos cuentas lo resuelve la misma regla que el de todo dueño existente** (FASE 8 completa, owner
2026-09-25): tenían suscripción —las dos `comp`— en el sistema viejo, así que **el corte les escribe
la fila consumida** (abajo) y `T6` ya no dispara sobre ellas. Si el grant se revocara quedarían sin
grant y sin trial, que es el §10.2 aplicado a quien ya fue cliente; las dos son del owner y
*«regenerables de cero»* (`B/21` §2.4).~~ **El trial de esas dos cuentas vuelve a ser el de
cualquier cuenta cubierta por un grant** (owner 2026-09-25; FASE 9 completa, `2g`): el corte no les
escribe fila, así que el día que publiquen dispara `T6` —un `GRANT` es un título que convierte— y
su fila nace consumida. Si el grant se revocara quedarían sin grant y sin trial; las dos son del
owner y *«regenerables de cero»* (`B/21` §2.4), y eso se declara, no se diseña.

~~**Qué pasa entonces, y está determinado.** `PRE_TRIAL` **no cubre** —un reloj que no arrancó no es
un título (`12-contrato…` §2.4)—~~ ~~y `PB2` se dispara **por el cambio de `cubierto`** (`V/03` §9), así
que **las fichas publicadas de Alojamiento se despublican la mañana del corte**~~ ~~y el corte no es
un cambio de `cubierto` (no hay valor anterior), así que `PB2` no dispara por evento: **las
despublica la primera corrida del reconciliador diario de cobertura** (`V/03` §9, `DEC-ARCH-009`),
**dentro del primer día** (FASE 9 completa, `C-7`). No es una ambigüedad entre dos ramas: es una
consecuencia.~~

**En qué estado nace cada ficha, y está determinado** (FASE 9 vuelta 1, R1; owner 2026-09-26,
`G1-1` y `G1-2`). La migración estructural del corte le escribe a cada ficha preexistente el estado
de la tabla de abajo, una sola vez, con la escritura `C`. La ficha que estaba a la vista **nace
`UNPUBLISHED_BY_BILLING`**: es el estado al que `PB2` la llevaría en la primera corrida del
reconciliador, porque `PRE_TRIAL` no cubre, y escribirlo en el corte le ahorra al dueño un día de
ficha publicada sin cobertura y le deja estrenar el trial desde el primer minuto. El reloj no
cambia: la escritura `C` le pone el instante del corte, el mismo que `PB2` le escribiría.

**La tabla de traducción** cuantifica **toda ficha que existe en la base el día del corte**, por
las columnas viejas de `accommodations` (las otras tres verticales tienen cero filas y se
re-cuentan con la consulta de `B/21` §1.3). Se evalúa en este orden y gana la primera que aplica.

**Y está escrita sólo para `accommodations`, así que el recuento de las otras tiene que dar cero, o
el corte no sigue** (FASE 9 vuelta 2, `F-8V2A3-003`). `listing` son las filas que ya existen, una
tabla por vertical (cap. 02 §2.5). `gastronomies` y `experiences` no tienen `billing_unpublished_at`,
`owner_suspended` ni `plan_restricted`, que son las columnas de `L5` y `L7`, y `experiences` tiene
en cambio `has_active_subscription` (código actual). Ahí no se sabe si una ficha `INACTIVE` la bajó
billing o su dueño, que es justo lo que separa `L4` de `L5`, y adivinarlo hace nacer una ficha en
un estado del que `PB3` no la devuelve. **Si el recuento de `B/21` §1.3 da una fila de Gastronomía o
de Experiencia, el corte se detiene antes del paso 3** y la clase de esa fila se escribe con sus
columnas a la vista. `DEC-MIG-002` sigue tomando altas, así que el cero es una medición que vence y
no una premisa. Partner no tiene ficha: su presencia no se traduce (§4).

| clase | condición sobre las columnas viejas | nace en |
|---|---|---|
| `L1` | `deleted_at` no nulo | **`PURGED`, con el contenido borrado** como en `PB12` (`G1-2`) —**el borrado, en el paso 5b del corte y no en la migración** (FASE 9 vuelta 2, `F-8V2A3-002`)— |
| `L2` | `lifecycle_state = DRAFT` | `DRAFT` |
| `L3` | `lifecycle_state = ARCHIVED` | `DRAFT` |
| `L4` | `lifecycle_state = INACTIVE` y `billing_unpublished_at` nulo | `DRAFT` |
| `L5` | `lifecycle_state = INACTIVE` y `billing_unpublished_at` no nulo | `UNPUBLISHED_BY_BILLING` |
| `L6` | `lifecycle_state = ACTIVE` y `visibility` distinta de `PUBLIC` | `DRAFT` |
| `L7` | `ACTIVE` + `PUBLIC` y (`owner_suspended` o `plan_restricted`) | `UNPUBLISHED_BY_BILLING` |
| `L8` | `ACTIVE` + `PUBLIC`, sin ninguna de las dos marcas | `UNPUBLISHED_BY_BILLING` |

Dos capas que no cambian el estado y se resuelven aparte:

- **`moderation_state`**: `PENDING` y `APPROVED` no se traducen, porque la columna nunca gobernó la
  visibilidad —el código de hoy lo dice (`packages/service-core/src/services/accommodation/`
  `accommodation.service.ts`: ninguna lectura pública filtra por `moderationState`)— y `PENDING` es
  el default de toda fila. **`REJECTED` tampoco se traduce**: se lista en la re-verificación de
  `B/21` §1.3 y el admin la modera después con `PB10` si quiere (owner 2026-09-26, `G1-2`).
  `REJECTED` nunca bajó nada, así que ignorarla no cambia lo que se ve hoy.
- **`is_featured`**: no cruza. El diseño nuevo no tiene destaque curado fuera de la capacidad
  comercial, y `B/21` §4 lo retira.

**Por qué la borrada nace `PURGED` con el contenido borrado** (`G1-2`): honra el acto del dueño con
el mismo efecto que `PB12`, y no le reaparece como borrador. El borrado ~~corre en la migración~~
**no corre en la migración: lo corre la herramienta del corte de V6 en el paso 5b**, cuando ya no
hay rama de aborto (`16-fase-7…` §4.2; FASE 9 vuelta 2, `F-8V2A3-002`). El efecto de `PB12`
incluye las fotos en el almacenamiento externo y la revocación del token de calendario en el
proveedor (cap. 02 §4.1), que el backup del 2b no restaura: en la migración, un aborto dejaba
fichas que el viejo puede restaurar sin fotos y con el calendario muerto. Y no se parte en dos
—la base en la migración, lo externo después— porque las fotos quedarían sin fila que las nombre.
Hasta el 5b la `L1` es `PURGED` con su contenido, sin mostrarse. El borrado es
sobre lo que el dueño ya había borrado; si alguna la borró un admin y no su dueño, su contenido se
pierde igual (declarado en el «NO cierra» del capítulo).

> ~~**Y eso es lo que se hace: se despublican. No se siembra nada.** Se les avisa **antes** del corte,
> se los llama, contratan, y la ficha vuelve sola por `PB3` cuando la cobertura vuelve.
> **Y desde `2g` tienen además el camino del cliente nuevo**: sin fila de `trial`, volver a
> publicar —o el botón de suscribirse, que manda a publicar a quien todavía no publicó en esa
> vertical (`V/19`; owner 2026-09-25, FASE 9 completa, `6c`)— les arranca el trial como a
> cualquiera (`T1`, `V/03` §2).~~
>
> **Y eso es lo que se hace: no se siembra nada.** Se les avisa **antes** del corte y se los
> llama. **El camino que se les nombra es el del cliente nuevo** (`2g`): entrar y **publicar su
> ficha**, que `PB1` admite desde `UNPUBLISHED_BY_BILLING` o desde `DRAFT` cuando arranca un trial
> (`V/03` §9), y eso les arranca el trial por `T1`. El botón de suscribirse los manda ahí, porque
> no tienen ningún `PB1` en el sistema nuevo (`V/19` fila 23), **siempre que publicar les arranque
> el trial**: si la vertical no declara evento, sus días están en cero o el hash del correo ya tiene
> fila, los manda al checkout, y si la vertical no admite altas no les ofrece nada (la regla única
> del botón, escrita sólo en `V/19` §4 fila 23; FASE 9 vuelta 1, `F-8V1D1-004`; residuo de G4
> resuelto el 2026-09-26). Al contratar, las fichas que siguen
> abajo vuelven solas por `PB3`, hasta llenar el cupo (FASE 9 vuelta 1, R1; owner 2026-09-26,
> `G1-1`), **en el orden de `V/03` §9 *«cuáles vuelven»*: como no tienen evento de publicación en el
> registro nuevo, cuentan como publicadas en el instante del corte y desempatan por `created_at`**
> (FASE 9 vuelta 1, `N-G1-01`).

**Y vuelve sola aunque la llamada tarde.** El procedimiento depende de que alguien llame, así que
puede pasarse del día 90: ahí `PB4` archiva la ficha y la que la devuelve ya no es `PB3` sino
**`PB7`**, con el mismo disparador y el mismo desenlace (`V/03` §9). No cambia el resultado, sino
**de qué fila depende** — y conviene decirlo porque antes de la 9-bis-3 `PB7` no existía, así
que una demora de tres meses en la agenda de llamados convertía *«vuelve sola»* en un incidente
por cada cuenta.

**Y el reloj de esas fichas arranca el día del corte, no el día que se crearon** (FASE 8 completa,
`F-8CA3-002`, `F-8CC2-003`, owner 2026-09-25). `listing.inactiva_desde` **no es anulable** (`V/02`
§2.5), así que la migración estructural tiene que ponerle un valor a cada ficha que ya existe, y el
único que la regla de la columna ofrecía —*«una ficha nace con el instante de su creación»*— es su
`created_at`: con él, toda ficha creada más de 90 días antes del corte se archivaba y toda ficha de
más de 180 **se borraba en la primera corrida**, antes de que sonara el teléfono y con los tres
avisos de retención fechados en el pasado. **Toda ficha que existía el día del corte nace con
`inactiva_desde` = el instante del corte.** Es la escritura `C` de la lista cerrada del
`NUCLEO/01` §1.2 —**una sola vez, en la migración estructural del corte, y en ningún otro lugar**—,
y `G-R6-B` la admite por ese lugar. **Se mantiene con `2g`**: lo que el owner respeta de los
clientes actuales es la ficha, y ésta es la escritura que la protege. **Y la de un corte abortado
no cuenta**: la rama de aborto restaura el backup, así que el reintento escribe con **su** instante
(`16-fase-7…` §4.2; owner 2026-09-25, FASE 9 completa, `2e`). *(~~Sobre las fichas publicadas, `PB2`
escribe~~ ~~el mismo día~~ ~~**dentro del primer día, cuando la corrida del reconciliador la despublica**
(FASE 9 completa, `C-7`), el hecho 5 al despublicarlas, `NUCLEO/01` §1.2;~~ la escritura `C` sigue haciendo falta porque la
columna no admite nulo ~~**antes** de que `PB2` corra~~, y porque alcanza también a ~~las que no estaban
publicadas~~ **toda ficha preexistente, incluida la del dueño que ese día no pierde la cobertura**:
el hecho 5 ya alcanza a las no publicadas de un dueño que la pierde —FASE 8 completa, owner
2026-09-25—, pero sobre un dueño que no la pierde no ocurre. **Lo tachado afirmaba que `PB2` corre
sobre las fichas del corte, y el paréntesis siguiente lo niega desde R1** (FASE 9 vuelta 2,
`F-8V2A3-006`).)* *(Desde R1 ninguna ficha
preexistente nace `PUBLISHED`: las que estaban a la vista nacen `UNPUBLISHED_BY_BILLING` con la
escritura `C`, así que `PB2` no corre sobre ellas en el corte y el instante que les queda es el
del corte, el mismo que `PB2` les habría escrito. FASE 9 vuelta 1, R1.)*

> ⚠️ **Lo que esto NO cierra** (no resuelto acá): con el reloj en el corte, **la agenda de llamados
> tiene un límite de hecho en el día 180**. Pasado ese día, sin contratar, el hard delete ya corrió
> y ~~lo que `PB7` devuelve es una ficha vacía~~ la ficha quedó en `PURGED`, que es final: no la
> devuelve nada (`V/03` §9, `PB9`; `F-8CA2-008`, cerrado por el owner el 2026-09-25). ~~El límite de
> la agenda sigue abierto igual. El hallazgo propone
> declararlo como límite de la agenda (`F-8CA3-002`); **si se declara y cómo se vigila lo decide el
> owner**.~~ **El límite no tiene tratamiento especial, por decisión del owner** (2026-09-25; FASE 9
> completa, `5c`): *«tenemos 180 días para que lo hagan, es un montón de tiempo»*. No hay fecha
> tope ni vigilancia propia de la agenda; está declarado en el «NO cierra» del capítulo para que no
> se vuelva a reportar. Y `DEC-MIG-004` retiró su defecto #7 con la causa *«no se transcribe ninguna»*: la ficha
> sí sobrevive al corte y su reloj sí se siembra, así que esa causa no alcanza a esta columna — la
> corrección del texto del log queda para el log.

**Por qué no sembrarles un trial, que era la alternativa.** Habría dejado las fichas arriba mientras
contratan, y **no cuesta menos: cuesta lo mismo más una siembra.** A esta gente **hay que llamarla
igual** —es lo que decide todo este capítulo: son pocos, la mayoría **no pagó nunca**, y el owner
**los conoce a todos**—, así que la siembra no ahorra una sola conversación. Agregar filas para
evitar un efecto que la llamada ya resuelve es el mecanismo que el §56 pide no construir: *«no
contaminar la arquitectura nueva para salvar unas pocas relaciones legacy»*. ~~*(La fila de `trial`
consumida que el corte sí escribe —abajo— no es esa siembra: no cubre ni deja ninguna ficha arriba;
hace lo contrario, impedir un trial nuevo. FASE 8 completa, owner 2026-09-25.)*~~ *(Desde `2g` el
corte no siembra ningún trial, ni activo ni consumido: el trial de cada cliente actual arranca
cuando él publica, como el de cualquier cliente nuevo. Owner 2026-09-25, FASE 9 completa.)*

**Qué se pierde, dicho sin adornos**: la ficha de cada uno está abajo **desde el corte hasta que esa
persona ~~contrata~~ publica o contrata** (FASE 9 vuelta 1, R1). Si alguno tarda una semana, estuvo una semana afuera. Lo que lo acota es que el
aviso va **antes** del corte, no después.

**Y qué se gana, que no es sólo ahorrarse la siembra**: el camino de vuelta —perder la cobertura,
recuperarla, y que la ficha se republique sola— **se ejercita el primer día**, sobre un puñado de
casos conocidos y con el owner al teléfono. Es exactamente cuando conviene descubrir que falla, si
falla.

**Consecuencia sobre la regla del capítulo, y es limpia**: ~~del lado de verticales **no se escribe
ninguna fila**, así que *«el sistema nuevo no hereda una sola fila»* sigue siendo literal acá.~~
del lado de verticales **no se transcribe ninguna fila viva**, que es la precisión de `DEC-MIG-003`
(*«ninguna fila VIVA del sistema viejo pasa al nuevo»*).
**Lo que sí se escribe es un valor de columna sobre filas que ya existen** —el `inactiva_desde` de
arriba—, y por eso figura en la lista cerrada de escritores de esa columna como escritura propia
(FASE 8 completa, `F-8CC2-003`, owner 2026-09-25), ~~**y la fila de `trial` consumida de cada dueño
existente** (abajo, *«el rastro de que ya fue cliente»*; FASE 8 completa, owner 2026-09-25)~~. ~~La
única excepción del programa es la lápida del `B/21` §2.5, y tiene su razón propia — hace
reconocible un cobro viejo, que ninguna llamada puede evitar.~~ ~~**Las filas nuevas que el corte
escribe son dos clases, y ninguna es una transcripción**: la lápida del `B/21` §2.5, que hace
reconocible un cobro viejo, y la fila de `trial` consumida, que hace reconocible a un cliente viejo.~~
**Del lado de verticales el corte no escribe ninguna fila nueva** (owner 2026-09-25; FASE 9
completa, `2g`). Las filas nuevas del corte son de billing y ninguna es una transcripción: la
lápida del `B/21` §2.5, que hace reconocible un cobro viejo, y los dos `permanent_grant` del
`B/21` §2.4, que son las cortesías del owner escritas como el caso normal del diseño nuevo.

#### El rastro de que ya fue cliente: la fila de `trial` consumida que escribe el corte

(FASE 8 completa, owner 2026-09-25; cierra `F-8CA2-013`.)

> **Revertido por el owner el 2026-09-25** (FASE 9 completa, `2g`; retoma `R12-OWNER-3` del informe
> `07`): **el corte NO siembra trials consumidos.** *«A los clientes ya suscriptos les regalamos el
> trial de nuevo: los tomamos como clientes nuevos. Sólo les respetamos la ficha para que no la
> tengan que cargar de nuevo; la suscripción es como si recién arrancaran.»* Todo lo que sigue en
> este apartado queda tachado como rastro. Se mantiene lo que toca fichas —la escritura `C` de
> `inactiva_desde`, arriba—. Con esto el corte **ya no necesita leer las tablas viejas**, que se
> retiran sin conservarse (`B/21` §4; `2a`), y pierden sujeto el `R12-OWNER-3` (borradores solos y
> `abandoned` que perdían el trial), el `DB-6` del informe `02` (quien autorizó sin fila vieja
> estrenaba trial) y la precisión de las soft-deleted del `DB-5` del informe `09`: con la regla
> nueva, todos ellos estrenan trial como cualquier cliente nuevo, que es lo que el owner decidió.
> **El defecto que la regla revertida cerraba (`F-8CA2-013`) pasa a ser la decisión**: un dueño
> existente que publica después del corte dispara `T1` y recibe el trial entero.

~~**El defecto.** Sin fila de `trial`, el dueño con fichas publicadas amanecía en `PRE_TRIAL`, y al
publicar cualquier borrador después del corte disparaba `T1` y recibía el trial entero: el
principio que funda `T7` —quien ya ejerció el evento de activación no estrena trial (`V/03` §2)— se
aplicaba en el encendido y no en el corte. La población no eran las seis personas del §2.3: era
**toda la cartera**.~~

> ~~**El corte escribe una fila de `trial` ya consumida por cada dueño que tenía al menos una ficha
> —o una suscripción— en el sistema viejo al momento del corte, por vertical.** Es el rastro de
> que esa persona ya fue cliente, para que `T1` no le dé un trial nuevo (§10.2).~~

- ~~**Qué se escribe**: la misma fila que escriben `T6` y `T7` —en `TRIAL_CONVERTED`, **consumida**,
  sin reloj y sin campaña (`V/03` §2)—, con el `user_id` del dueño, la vertical y **el hash del
  correo normalizado** (cap. 02 §2.2).~~
- ~~**El hash**: se calcula sobre el correo de su cuenta al momento del corte, **normalizado como
  manda `DEC-TRIAL-004`** —puntos y `+alias`— y con **la misma función** que usan `T1`, `T6` y
  `T7`. Es la condición para que sirva: la guarda de las tres compara un hash contra otro (`V/03`
  §2, *«el hash que ya consumió»*), y un hash calculado distinto no niega nada.~~
- ~~**Alcance, por vertical**: el `user + vertical` de cada ficha que ya existía el día del corte
  —publicada o no, la misma población de la escritura `C` de arriba— y el de cada suscripción del
  sistema viejo, **en las verticales cuyo plan de trial tiene días > 0 el día del corte**. En una
  vertical con los días en cero —Partner hoy (`DEC-TRIAL-003`)— **no se escribe**: consumir ahí un
  trial que la vertical todavía no ofrece es lo que `V/03` §2 (*«la tercera fila es nueva y es
  deliberada»*) llama destruirlo antes de que nazca, y el día del encendido lo resuelve `T7`.~~
- ~~**Dónde y cuántas veces**: en la migración estructural del corte, **una sola vez**, como la
  escritura `C` de `inactiva_desde` (`NUCLEO/01` §1.2) y como la lápida de billing (`B/21` §2.5).~~
- ~~**No es una migración, y `DEC-MIG-003` sigue en pie**: no se transcribe nada vivo —ni el trial
  que alguien tuviera corriendo, ni su fecha, ni su plan—. Es un rastro, de la misma familia que la
  lápida: la lápida hace reconocible un cobro viejo; esta fila hace reconocible a un cliente viejo.~~

~~**Qué cambia la mañana del corte: nada visible.** `TRIAL_CONVERTED` no emite fuente, así que esas
personas amanecen sin cobertura igual que en `PRE_TRIAL`, `PB2` despublica igual y la ficha vuelve
cuando contratan (arriba). Lo que cambia es **el día que publican algo nuevo sin haber contratado**:
`T1` no dispara —la persona no está en `PRE_TRIAL` y su hash ya tiene fila— y `PB1` no publica,
porque no está cubierta ni arranca un trial (`V/03` §9; *«suscribite para publicar»*, cap. 19 §4
fila 21).~~

> ~~⚠️ **Lo que esto NO cierra, declarado con su causa por `DEC-METH-015`** (ninguno mueve plata en
> el camino principal, da acceso indebido ni borra datos):~~
>
> 1. ~~**Dos cuentas del sistema viejo con el mismo correo normalizado en la misma vertical**: el
>    `UNIQUE(hash_del_correo_normalizado, vertical)` (cap. 02 §2.2) admite una sola fila, y cuál de
>    las dos la recibe no está escrito. La otra queda en `PRE_TRIAL` con su hash ya consumido —el
>    caso de *«el hash que ya consumió»* (`V/03` §2)—, y sin cobertura tampoco publica. **Causa**: la
>    regla se escribió por dueño y la restricción es por hash. Las dos terminan sin trial.~~
> 2. ~~**El ex-cliente de una vertical con los días en cero** (Partner hoy): el corte no le escribe
>    fila, y el día del encendido `T7` lo alcanza sólo si ya ejerció el evento de activación, que
>    Partner todavía no declara (`DEC-TRIAL-006`). **Causa**: la regla del corte hereda la
>    restricción de `V/03` §2 para no destruir un trial que no existe. Qué hace el encendido con el
>    ex-partner queda para el día del encendido (cap. 11 §8).~~
> 3. ~~**El procedimiento del corte** (`16-fase-7-del-paraguas.md` §4) no nombra esta escritura, y
>    ese documento no se edita desde esta pasada. **Causa**: la decisión es posterior al
>    procedimiento. Va con la escritura `C`, que tampoco tiene paso propio ahí.~~
> 4. ~~**Es una fila de `trial` en `TRIAL_CONVERTED` que ninguna transición produce**, igual que la
>    lápida es la única `CANCELLED` que ninguna transición produce (`B/21` §2.5). Una enumeración de
>    las filas `T` no la ve. **Causa**: es una escritura única del corte, no algo que pase en la vida
>    de un trial. La máquina la lee igual que la de `T6`/`T7`: no sale nada de `TRIAL_CONVERTED`.~~

### 2.5 La condición de caducidad, que es lo único que hay que vigilar

> ⚠️ `DEC-MIG-002` decidió **seguir tomando altas durante el rediseño**, así que la cartera crece.
> ~~Con ocho filas *«no migrar»* son tres llamadas~~ Con la población de `B/21` §1.3 —hoy, los
> dueños de doce alojamientos y tres suscriptores— (FASE 9 vuelta 1, R7); **el umbral medido está
> en unas veinte**, y arriba de eso deja de ser viable. **El umbral se mide en personas a llamar,
> no en suscripciones**: el corte le hace efecto a toda ficha preexistente (§2.4), no sólo a quien
> tenía una suscripción viva.

El aviso que el owner ya se comprometió a dar —*«si veo que empiezan a entrar registros nuevos, te
aviso»*— **ahora tiene una consecuencia concreta: hay que volver a discutir esta decisión.**

---

## 4. Lo que NO se migra, y no es una omisión

- **Gastronomía, experiencia y partner**: cero filas al 2026-09-15; se re-cuentan el día del corte
  con la consulta de `B/21` §1.3 (FASE 9 vuelta 1, R7). El rediseño de esas tres verticales no
  toca un solo dato existente.
- **La respuesta de la página de un partner que ya no tiene la presencia sí cambia, aunque no se
  migre ningún dato** (FASE 8 completa, `F-8CA1-014`, owner 2026-09-25). El código de hoy
  responde **410** al partner revocado —a propósito, para que un buscador retire la URL para
  siempre— y 404 al resto (`apps/api/src/routes/partners/public/get-by-slug.ts`). El diseño exige
  que ajeno, archivado e inexistente sean indistinguibles desde afuera (cap. 17 §1.2, precisión 1)
  y que la lectura sin la clave ~~de presencia~~ **de la página** (FASE 9 vuelta 1, `F-8V1A1-004`) responda 404 (cap. 18 §1.6), así que **la migración
  lo cambia a 404**. Lo que se pierde con el cambio es esa señal de desindexación. **La revocación
  del admin sin tocar el cobro no se pierde**: pasa al bit de moderación de la presencia, que
  escribe la misma acción administrativa que `PB10` (cap. 18 §1.6; owner 2026-09-25, FASE 9
  completa, `7c`). Partner tiene cero filas, así que tampoco hay nada que migrar ahí.
- **`commerce`**: el §55 ordena eliminarlo de fuentes activas, con la excepción histórica del
  §55.1 —auditoría, historia de migraciones, entender datos legacy— **marcada inequívocamente**.
  Eso es trabajo de FASE 5 y de código, no de datos.

---

## Lo que este capítulo NO cierra

- **Cómo se le avisa ~~a las tres personas~~ a la población de `B/21` §1.3 (FASE 9 vuelta 1, R7) y cuándo se cancelan sus suscripciones** es FASE 7: acá
  está que no se migra, no el procedimiento de la conversación.
- **La clasificación del código legacy** en reusar o reescribir tiene su propio gate
  (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.
- **La agenda de llamados del corte no tiene tratamiento especial frente al día 180** (§2.4;
  declarado por `DEC-METH-015`, FASE 9 completa, `5c`, `OW-2` del informe `05`, `F-8CA3-002`): no
  hay fecha tope ni vigilancia propia. Un dueño que no contrata ni vuelve a publicar en 180 días
  desde el corte pierde su ficha por `PB9` (`PURGED`, final), con los tres avisos de retención
  llegándole igual por correo. **Causa**: decisión del owner, *«tenemos 180 días para que lo
  hagan, es un montón de tiempo»*. Se declara para que no se vuelva a reportar.
- **El trial de los clientes actuales no se preserva** (§2.3 y §2.4; declarado por
  `DEC-METH-015`, FASE 9 completa, `2g`): quien tenía ficha o suscripción en el sistema viejo
  estrena el trial en el sistema nuevo, aunque ya lo hubiera usado. **Causa**: decisión del owner,
  que los trata como clientes nuevos y sólo les respeta la ficha.
- **Quien contrata sin publicar paga desde el primer cobro** (§2.4; declarado por `DEC-METH-015`,
  FASE 9 vuelta 1, R1). Si un dueño del corte llega al checkout por otro camino, `S1` lo cubre,
  `PB3` le sube la ficha y ~~`T8` no escribe nada, porque no ejerció el evento en el sistema nuevo:
  paga el primer ciclo y conserva el trial sin usar~~ **`T8` le consume el trial al primer cobro:
  la vuelta de su ficha por `PB3` bajo un título que paga cuenta como ejercicio del evento para
  `T8`, y sólo para ella** (`V/03` §2; owner 2026-09-27, FASE 9 vuelta 2, `R15`). Ya no conserva
  un trial para el día que cancele. ~~**hasta su próximo `PB1` cubierto: si después publica otra ficha cubierto por un título que convierte —su suscripción ya cobró—, `T6` consume la fila sin darle el trial (`V/03` §2), que es la misma regla que para cualquier cubierto que publica** (FASE 9 vuelta 1, §4 punto 4 de `21-verificado-G1`).~~ **Causa**: el guion y el botón lo mandan a
  publicar; cobrarle al que elige pagar no es un defecto. No da acceso indebido ni borra nada.
- **Durante el trial vuelve una sola ficha** (§2.4; declarado por `DEC-METH-015`, FASE 9 vuelta 1,
  R1). El cupo del trial es una (invariante 6); las demás esperan a que contrate. **Causa**: `2g`
  le da el trial de un cliente nuevo, no uno más grande. El aviso lo dice.
- **En una vertical sin trial, el dueño del corte no tiene trial que estrenar** (§2.4; declarado
  por `DEC-METH-015`, FASE 9 vuelta 1, R1). Hoy son cero fichas (§4, re-contadas por `B/21` §1.3).
  **Causa**: la configuración de la vertical, no el corte.
- **Una ficha vieja borrada por un admin, y no por su dueño, pierde su contenido en el corte**
  (§2.4, `L1`; declarado por `DEC-METH-015`, owner 2026-09-26, `G1-2`). Toda `L1` nace `PURGED`
  con el contenido borrado, la haya borrado quien la haya borrado: la regla no lee
  `deleted_by_id`, que además queda nulo si esa cuenta ya no existe (`ON DELETE SET NULL`).
  **Causa**: el owner eligió honrar el borrado con el efecto de `PB12` sobre toda la clase, sin
  una rama por autor. No mueve plata ni da acceso: borra lo que ya no estaba a la vista.
