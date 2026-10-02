# V9b · Retención

<a id="pieza-v9b"></a>
**PIEZA:V9b** — pieza `V9b`, de la unidad `V9` (partida); **cuándo**: después, en la **Fase 1**,
sola; **fuente**: Z y AC (lista de piezas del corte, `16-fase-7-del-paraguas.md` §4.6;
[DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) puntos 3 y 6 y su 📌 de AW).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:949

## Objetivo, alcance y fuera de alcance

**Objetivo.** El resto de la retención de `V9` ([FILA:V9](../10-corte/V9a.md#fila-v9), definida en `V9a`): el reloj de
inactividad con sus cinco hechos, el borrado del día 180 (`PB9`) y los tres avisos, sobre las
tablas y la versión de plazos que `V6` crea al corte, sin escribirlas.

**Fase y gate.** `V9b` es la **Fase 1**, sola ([GATE:FP.F1](../30-el-corte.md#gate-fp-f1)): viaja en su rama épica propia, con
los mismos gates por unidad (el momento 1, [GATE:M1](../30-el-corte.md#gate-m1)), y entra a `staging` entera ([GATE:FP](../30-el-corte.md#gate-fp)).
Su gate propio es el de toda fase posterior: el momento 2 aplicado a la rama de la fase
([GATE:FP.1](../30-el-corte.md#gate-fp-1)), el checklist de smoke del sistema nuevo extendido con lo de la fase —la parte de
`staging` antes del merge y la de producción como un 5c propio— ([GATE:FP.2](../30-el-corte.md#gate-fp-2)) y el drift guard
sobre la rama en verde, sin ninguna migración estructural ([GATE:FP.3](../30-el-corte.md#gate-fp-3)). Es **aditiva**: no
reescribe filas ni código del corte ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 7).

<a id="fila-v9b"></a>
**FILA:V9b — Retención** *(después)*. Qué deja funcionando, en su forma vigente: **el resto de
`V9`**:

1. **el reloj de 90 y 180 días con sus cinco hechos de reinicio** —el hecho 1 lo lee del registro de
   `V9a`—;
2. **`PB9` hacia `PURGED` con todo lo que la fila de `V9` le fija**: la desconexión del calendario,
   el lock, la lista cerrada de lo que cuelga de `listing` y el empuje a billing después del commit;
3. **los tres avisos, que encola en `U2`**;
4. **mergeada antes de la primera fecha en que un aviso de retención podría salir**, según los
   plazos que el owner fija antes del merge de `V6` (corte del MVP, owner 2026-10-01, AC);
5. **lee la tabla de plazos de verticales y la versión guardada en la ficha, que crea `V6`, sin
   escribirlas** (corte del MVP, owner 2026-10-01, BD).

**Capítulos**: `02` §4 · `22` §3 · `01` §1.2 (núcleo) · `03` §9 (`PB9`). **Guards**: ninguno.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:73

**Alcance.** Además de la fila, lo que el mapa de cobertura le da como dueña: [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005) (la
retención sólo toca fichas), [DEC-DATA-001#📌1](../01-decisiones-vigentes.md#dec-data-001-p1) (el punto 4 cerrado: sólo el contenido de la
ficha), [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), los plazos [PLAZO:2](../02-nucleo.md#plazo-2) (borrado por inactividad, 180 días al inicio) y
[PLAZO:4](../02-nucleo.md#plazo-4) (los dos avisos previos de retención) como lectora, y la fila de su fase,
[GATE:FP.F1](../30-el-corte.md#gate-fp-f1).

**Fuera de alcance** (otra pieza, que esta referencia):

- la tabla versionada de plazos de verticales, su versión 1, la acción 22 y `plazos_version` y
  `borrado_anunciado` en la ficha: `V6`, al corte (BD; [FILA:V6](../10-corte/V6.md#fila-v6));
- `PB4`, `PB5`, `PB8`, `PB12`, el lock de publicación, el reconciliador y los hechos 3, 5 y 6:
  `V6` ([TRANS:V:PB4](../04-catalogos.md#trans-v-pb4), [TRANS:V:PB8](../04-catalogos.md#trans-v-pb8), [TRANS:V:PB12](../04-catalogos.md#trans-v-pb12));
- el registro de los actos del dueño, fuente del hecho 1: `V9a` ([FILA:V9a](../10-corte/V9a.md#fila-v9a));
- la función del seudónimo y los casos del seudónimo de [LISTA:V9](../10-corte/V9a.md#lista-v9): `V4` ([FILA:V4](../10-corte/V4.md#fila-v4));
- las filas 27 y 28 del `19` §4 (la alerta cerrada y la conversación en sólo lectura) y sus
  superficies: `V8a` ([FILA:V8a](../10-corte/V8a.md#fila-v8a));
- `A6`, el consumidor del empuje *«la ficha llegó a `PURGED`»*: `B10` ([DEP:11](../03-contrato-de-cobertura.md#dep-11)).

## Historias de usuario y criterios de aceptación

<a id="lista-v9b"></a>
**LISTA:V9b — «Lista cuando»**: el criterio de `V9` sin los casos del seudónimo, que pasaron a `V4`
(corte del MVP, owner 2026-10-01, AC):

1. **el día 180 (`PB9`) borra el contenido de la ficha y nada de la persona** ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)),
   **y después del borrado ningún evento de dominio conserva el texto borrado** (8e);
2. **después de `PB9` la ficha no conserva conexión de calendario** (`G1-5`);
3. **después de `PB9` la alerta de precio de un turista está cerrada y su correo encolado, la
   conversación se lee y no admite mensajes, y lo del dueño que sólo servía a la ficha no tiene filas
   de ella; y `PB9` y `PB8` simultáneos sobre la misma ficha no dejan contenido borrado en una ficha
   `DRAFT`** (`R9`, `F-8V2A2-004`);
4. **el reloj cuenta el hecho 1 desde el registro de `V9a`, también los actos anteriores a su propio
   merge** *(la fuente marca esta cláusula como derivada de AC)*;
5. **un archivado que corrió tarde anuncia una fecha más tarde y `PB9` no borra antes** (la cláusula
   de `PB9` del §2.11; corte del MVP, owner 2026-10-01, BD: la tabla y la acción son de `V6`).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:717

### Historias de usuario

<a id="us-v9b-1"></a>
**US:V9b:1** — Como anfitrión que dejó de usar su ficha, quiero tres avisos antes de perder su
contenido y que el borrado no toque nada mío más que esa ficha, para poder exportarla o reactivarla a
tiempo.
Actor: anfitrión
Fuente: [FILA:V9b](#fila-v9b), [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), [PLAZO:4](../02-nucleo.md#plazo-4)

<a id="us-v9b-2"></a>
**US:V9b:2** — Como turista con una alerta de precio o una conversación sobre una ficha que se borró,
quiero que la alerta se cierre con un aviso y que la conversación se pueda leer, para no perder lo mío
por un borrado ajeno.
Actor: turista
Fuente: [LISTA:V9b](#lista-v9b), [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)

<a id="us-v9b-3"></a>
**US:V9b:3** — Como sistema/cron, quiero borrar sólo cuando el plazo y la fecha anunciada se
cumplieron, releyendo cobertura y pausa bajo el lock, para que el borrado irreversible nunca alcance a
quien volvió.
Actor: sistema/cron
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [PLAZO:2](../02-nucleo.md#plazo-2), [LISTA:V9b](#lista-v9b)

<a id="us-v9b-4"></a>
**US:V9b:4** — Como admin, quiero que la Fase 1 entre a `staging` antes de la primera fecha en que
un aviso de retención podría salir y con su gate de fase, para que ningún reloj llegue a su aviso sin
código que lo mande.
Actor: admin
Fuente: [GATE:FP.F1](../30-el-corte.md#gate-fp-f1), [FILA:V9b](#fila-v9b)

### Criterios de aceptación

<a id="ac-v9b-1"></a>
**AC:V9b:1** — El día 180 borra el contenido de esa ficha y nada de la persona.

- **Dado** un anfitrión con una ficha `ARCHIVED` vencida y otra ficha publicada y paga, con sus
  preferencias de cuenta, sus datos personales y eventos de su suscripción
- **Cuando** corre `PB9` sobre la archivada
- **Entonces** la ficha pasa a `PURGED` con su contenido (textos, fotos, FAQ, horarios) y sus
  borradores borrados, la fila de la ficha queda, y no cambia nada de la persona: ni el `user`, ni
  sus preferencias, ni sus señales de identidad, ni sus datos dentro de eventos u outbox, ni la otra
  ficha.
Fuente: [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), [DEC-DATA-001#📌1](../01-decisiones-vigentes.md#dec-data-001-p1), [LISTA:V9b](#lista-v9b), [FILA:V9](../10-corte/V9a.md#fila-v9)

<a id="ac-v9b-2"></a>
**AC:V9b:2** — Después del borrado, ningún evento conserva el texto.

- **Dado** una ficha cuya descripción el dueño editó varias veces después del corte (registro de
  `V9a`)
- **Cuando** `PB9` la borra
- **Entonces** ningún evento de dominio de esa ficha contiene ninguno de esos textos.
Fuente: [LISTA:V9b](#lista-v9b), [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)

<a id="ac-v9b-3"></a>
**AC:V9b:3** — El calendario se desconecta, y los borrados remotos van después del commit.

- **Dado** una ficha `ARCHIVED` vencida con fotos en el almacenamiento externo y una conexión de
  calendario
- **Cuando** corre `PB9`, y cuando el almacenamiento o el proveedor fallan en el primer intento
- **Entonces** el token queda revocado en el proveedor y no existe en la base; los dos borrados
  remotos (fotos y token) corren después del commit, con las filas marcadas pendientes hasta que se
  confirman, y la corrida diaria los reintenta hasta confirmarlos; las reseñas de terceros se
  conservan sin mostrarse.
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [LISTA:V9b](#lista-v9b)

<a id="ac-v9b-4"></a>
**AC:V9b:4** — Lo que cuelga de la ficha, por dueño del dato.

- **Dado** una ficha con una alerta de precio de un turista, una conversación entre ese turista y el
  dueño, y datos del dueño que sólo sirven a esa ficha
- **Cuando** `PB9` la borra
- **Entonces** la alerta queda cerrada y el correo transaccional *«tu alerta de precio se cerró»*
  encolado; la conversación se lee y no admite mensajes, con su referencia a la ficha anulable; y lo
  del dueño que sólo servía a la ficha no tiene filas de ella; la configuración de revalidación no se
  toca.
Fuente: [LISTA:V9b](#lista-v9b), [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)

<a id="ac-v9b-5"></a>
**AC:V9b:5** — `PB9` y `PB8` simultáneos, bajo el lock.

- **Dado** una ficha `ARCHIVED` vencida cuyo dueño pide reactivarla (`PB8`) en el mismo instante en
  que corre `PB9`
- **Cuando** las dos toman el lock del `user + vertical` y releen adentro su `desde`
- **Entonces** gana una sola: o la ficha queda `DRAFT` con su contenido, o queda `PURGED`; nunca una
  ficha `DRAFT` con el contenido borrado.
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [LISTA:V9b](#lista-v9b)

<a id="ac-v9b-6"></a>
**AC:V9b:6** — `PB9` relee cobertura y pausa antes de borrar.

- **Dado** tres fichas `ARCHIVED` vencidas: la de un dueño que volvió a estar cubierto, la de un dueño
  con una suscripción `PAUSED` por `CUSTOMER_REQUEST` en esa vertical (`retenciónDetenida` = `sí`) y
  la de un dueño sin cobertura con `coberturaPerdidaEn` = `NINGUNO`
- **Cuando** corre la pasada de `PB9`
- **Entonces** la primera no se borra y su reloj se reinicia; la segunda no se borra y no se escribe
  nada; la tercera no se borra en la pasada en que se la ve vencida por primera vez (lo es si la
  fecha de borrado es posterior al arranque de la pasada anterior) y se borra en una pasada
  siguiente si sigue vencida, sin cobertura y sin pausa.
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)

<a id="ac-v9b-7"></a>
**AC:V9b:7** — Nunca antes del plazo ni de la fecha anunciada.

- **Dado** una ficha con la versión de plazos 1 (borrado a 180 días) archivada tarde, con
  `borrado_anunciado` posterior al día 180 de su reloj
- **Cuando** corre `PB9` el día 180 y el día anunciado
- **Entonces** el día 180 no la borra y el día anunciado sí: `PB9` usa el más tardío entre el plazo
  de borrado contado sobre el más tardío de `inactiva_desde`, el fin de la última pausa y
  `coberturaPerdidaEn`, con la versión de plazos que guarda la ficha, y `borrado_anunciado`.
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [PLAZO:2](../02-nucleo.md#plazo-2), [LISTA:V9b](#lista-v9b)

<a id="ac-v9b-8"></a>
**AC:V9b:8** — `PURGED` es final, y el empuje a billing sale después del commit.

- **Dado** una ficha que `PB9` lleva a `PURGED`
- **Cuando** se intenta `PB3` o `PB7` sobre ella, se cuenta el cupo del dueño, y el consumidor del
  empuje *«la ficha llegó a `PURGED`»* lo recibe y relee `fichaPurgada`
- **Entonces** ninguna fila sale de `PURGED` y la ficha no cuenta para el cupo; el empuje sale
  después del commit, nunca dentro de la transacción, y la relectura contesta `sí`. `PB9` sale sólo de
  `ARCHIVED`.
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [FILA:V9](../10-corte/V9a.md#fila-v9)

<a id="ac-v9b-9"></a>
**AC:V9b:9** — El reloj y sus cinco hechos, con el hecho 1 desde el registro de `V9a`.

- **Dado** una ficha cargada por el corte (`inactiva_desde` = instante del corte, escritura `C`) cuyo
  dueño la editó después del corte y antes del merge de `V9b`
- **Cuando** `V9b` calcula su inactividad
- **Entonces** cuenta desde el más reciente de los cinco hechos (1, 2, 3, 5 y 6) o de la escritura
  `C`, y el hecho 1 sale del registro de `V9a`, incluido ese acto anterior a su propio merge.
Fuente: [LISTA:V9b](#lista-v9b), [FILA:V9b](#fila-v9b), [FILA:V9](../10-corte/V9a.md#fila-v9)

<a id="ac-v9b-10"></a>
**AC:V9b:10** — Los tres avisos de retención.

- **Dado** una ficha con la versión de plazos que guarda, el plazo 4 con su valor y el reloj corriendo
- **Cuando** llega cada fecha objetivo
- **Entonces** salen tres correos transaccionales no suprimibles, encolados en el outbox de `U2`:
  uno antes del archivado, uno al archivar y uno antes del borrado; los dos previos cuentan desde el
  más tardío de `inactiva_desde` y el `pausaTerminadaEn` de `retenciónDetenida`, releen la cobertura
  y no salen si el dueño está cubierto; el previo al borrado nunca antes de la fecha que anunció el
  archivado; cada ocurrencia lleva en su clave la fecha objetivo (`listing:<id>:ret:…`), así que un
  reloj reiniciado puede volver a mandarlos sin duplicarlos.
Fuente: [PLAZO:4](../02-nucleo.md#plazo-4), [FILA:V9b](#fila-v9b), [FILA:V9](../10-corte/V9a.md#fila-v9)

<a id="ac-v9b-11"></a>
**AC:V9b:11** — Sólo lee los plazos, y no trae migración estructural.

- **Dado** una base armada desde cero con las migraciones de la rama de la Fase 1 (la versión 1 de
  los plazos de verticales y `plazos_version`/`borrado_anunciado` creadas por `V6`)
- **Cuando** corren `PB9` y los avisos
- **Entonces** leen la tabla de plazos y la versión guardada en la ficha sin escribirlas; `trial` y
  las tablas de sólo agregar no tienen `deleted_at`; y la rama de la fase no contiene ninguna
  migración estructural nueva.
Fuente: [FILA:V9b](#fila-v9b), [LISTA:V9b](#lista-v9b), [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), [PLAZO:2](../02-nucleo.md#plazo-2)

<a id="ac-v9b-12"></a>
**AC:V9b:12** — La Fase 1 llega antes del primer aviso posible.

- **Dado** los plazos fijados por el owner antes del merge de `V6` y el instante del corte
- **Cuando** se decide el merge de la rama de la Fase 1 a `staging`
- **Entonces** la fecha del merge es anterior a la primera fecha en que un aviso de retención podría
  salir, `V9b` está en `Done` y la rama cumple el gate de fase (momento 2 sobre la rama, smoke de
  `staging` extendido antes del merge y drift guard en verde); `B10` no arranca antes de ella.
Fuente: [GATE:FP.F1](../30-el-corte.md#gate-fp-f1), [FILA:V9b](#fila-v9b)

<a id="ac-v9b-13"></a>
**AC:V9b:13** — Salida: la pieza está lista.

- **Dado** la rama de la Fase 1 con `V9b` mergeada
- **Cuando** se corren los casos de [AC:V9b:1](#ac-v9b-1) a [AC:V9b:11](#ac-v9b-11)
- **Entonces** se cumplen las cinco cláusulas de su *«Lista cuando»* y la pieza cumple el momento 1
  ([GATE:M1](../30-el-corte.md#gate-m1)).
Fuente: [LISTA:V9b](#lista-v9b)

## Reglas

- **`PB9`** ([TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)): `ARCHIVED` → `PURGED`, el hard delete; exige `ARCHIVED`; relee
  cobertura, `retenciónDetenida` y `coberturaPerdidaEn`; todo dentro del lock del `user + vertical`,
  porque comparte `desde` con `PB7` y `PB8` y es irreversible; trata lo que cuelga de la ficha con la
  lista cerrada de `V/02` §4.1; empuja *«la ficha llegó a `PURGED`»* después del commit; es *«se
  borra la ficha destino»* de `A6`; no revalida.
- **La retención sólo toca fichas** ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), [DEC-DATA-001#📌1](../01-decisiones-vigentes.md#dec-data-001-p1)).
- **El reloj** (`NUCLEO/01` §1.2): cinco hechos (1, 2, 3, 5 y 6) más la escritura `C`; la pausa pedida
  por el dueño lo detiene y los lectores cuentan desde el más tardío de `inactiva_desde` y
  `pausaTerminadaEn`; `PB9`, además, desde `coberturaPerdidaEn`. Los lectores los vigila la mitad
  *(d)* de [GUARD:G-R6-B](../04-catalogos.md#guard-g-r6-b), de `V6`; la lista cerrada de `PURGED`, [GUARD:G-R9](../04-catalogos.md#guard-g-r9), de `V6`.
- **Los plazos** ([PLAZO:2](../02-nucleo.md#plazo-2), [PLAZO:4](../02-nucleo.md#plazo-4)): valores de la versión que guarda la ficha; un cambio de
  plazo nunca adelanta una fecha ya anunciada (la acción 22 es de `V6`).
- **Los avisos** (`NUCLEO/07` §4.1 y §6): transaccionales, no suprimibles, tres.
- **Aditiva** ([GATE:FP](../30-el-corte.md#gate-fp)): ninguna migración estructural, ningún cambio de filas del corte.

## Modelo de datos y migraciones

- **Sin migración estructural** ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 7; [GATE:FP.3](../30-el-corte.md#gate-fp-3)). Lee, sin escribir: la
  tabla versionada de plazos de verticales y su versión 1, y `listing.plazos_version` y
  `listing.borrado_anunciado` (de `V6`, BD); escribe `listing.inactiva_desde` sólo donde un hecho lo
  pide y por los ejecutores que [GUARD:G-R6-B](../04-catalogos.md#guard-g-r6-b) admite (el reinicio por cobertura de `PB9`).
- Escribe filas sobre el esquema existente: el estado `PURGED`, el borrado del contenido, el cierre de
  alertas, la referencia anulable de la conversación y las marcas de borrado remoto pendiente
  (`V/02` §4.1).
- `trial` y las tablas de sólo agregar nacen sin `deleted_at` ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), su último 📌).

## API

N/A como ruta propia — `PB9` y los avisos son de sistema (`V/03` §9). Hacia billing: el empuje
*«la ficha llegó a `PURGED`»* y la consulta `fichaPurgada` del contrato §3.1/§4.1, que `V6` construye
con `PB12` ([FILA:V6](../10-corte/V6.md#fila-v6)); `V9b` emite el empuje de `PB9`.

## UI web y admin, e i18n

- Los textos de los tres avisos y el del cierre de la alerta van en el catálogo de correos
  (`NUCLEO/07` §6) y en `@repo/i18n`. El aviso al archivar dice que no se borró nada, que vuelve sola
  si recupera cobertura o cupo (`PB7`) o a mano y sin pagar (`PB8`), y desde cuándo se cuentan los
  180 (`NUCLEO/07` §6).
- Las filas 20, 27 y 28 del `19` §4 son de `V8a` ([FILA:V8a](../10-corte/V8a.md#fila-v8a)).

## Cron y outbox

- El job diario que corre `PB9` y los avisos, con la correlación de su corrida y la de cada ficha
  (`NUCLEO/08` §2.3), y con un actor de sistema de la fábrica de `V5` ([FILA:V5](../10-corte/V5.md#fila-v5)).
- La corrida diaria que reintenta los borrados remotos pendientes ([TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)).
- Los tres avisos y el de la alerta cerrada se encolan en el outbox común de `U2`, con la clave de
  schedule que lleva la fecha objetivo (`NUCLEO/07` §2).

## Variables de entorno

N/A — la fila no declara variables de entorno ([FILA:V9b](#fila-v9b)); los plazos son datos de la tabla de
plazos ([PLAZO:2](../02-nucleo.md#plazo-2), [PLAZO:4](../02-nucleo.md#plazo-4)).

## Auditoría y observabilidad

`PB9` es una transición de las máquinas del capítulo 03, y por eso auditable (`NUCLEO/08` §1.1); el
job lleva sus dos correlaciones (`NUCLEO/08` §2.3).

## Seguridad

El borrado es irreversible: por eso relee todo dentro del lock, nunca borra antes de la fecha
anunciada y nunca toca a la persona ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)). El token de calendario se revoca en el
proveedor, no sólo se borra ([TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)).

## Testing esperado

<a id="test-v9b-1"></a>
**TEST:V9b:1** — Integración: `PB9` sobre una ficha vencida borra su contenido y borradores y no
toca `user`, preferencias, otra ficha ni eventos de su suscripción.
Tipo: integración con DB
Cubre: [AC:V9b:1](#ac-v9b-1)
Fuente: [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), [DEC-DATA-001#📌1](../01-decisiones-vigentes.md#dec-data-001-p1), [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)

<a id="test-v9b-2"></a>
**TEST:V9b:2** — Integración: ningún evento de la ficha borrada contiene los textos editados.
Tipo: integración con DB
Cubre: [AC:V9b:2](#ac-v9b-2)
Fuente: [LISTA:V9b](#lista-v9b)

<a id="test-v9b-3"></a>
**TEST:V9b:3** — Integración con el proveedor y el almacenamiento falsos: token revocado y borrado;
con un fallo del primer intento, las filas quedan pendientes y la corrida diaria las confirma.
Tipo: integración con DB
Cubre: [AC:V9b:3](#ac-v9b-3)
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)

<a id="test-v9b-4"></a>
**TEST:V9b:4** — Integración: alerta cerrada con su correo en el outbox, conversación legible y sin
nuevos mensajes, filas del dueño de la ficha borradas.
Tipo: integración con DB
Cubre: [AC:V9b:4](#ac-v9b-4)
Fuente: [LISTA:V9b](#lista-v9b), [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)

<a id="test-v9b-5"></a>
**TEST:V9b:5** — Integración: `PB9` y `PB8` concurrentes sobre la misma ficha; nunca `DRAFT` sin
contenido.
Tipo: integración con DB
Cubre: [AC:V9b:5](#ac-v9b-5)
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [LISTA:V9b](#lista-v9b)

<a id="test-v9b-6"></a>
**TEST:V9b:6** — Integración: cubierta → reinicio; `retenciónDetenida` = `sí` → sin escritura;
`coberturaPerdidaEn` = `NINGUNO` → no borra en la primera pasada y borra en la siguiente.
Tipo: integración con DB
Cubre: [AC:V9b:6](#ac-v9b-6)
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)

<a id="test-v9b-7"></a>
**TEST:V9b:7** — Integración: archivado tarde, `borrado_anunciado` posterior al día 180; `PB9` no
borra el día 180 y sí el anunciado.
Tipo: integración con DB
Cubre: [AC:V9b:7](#ac-v9b-7)
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [PLAZO:2](../02-nucleo.md#plazo-2)

<a id="test-v9b-8"></a>
**TEST:V9b:8** — Integración: `PB3`/`PB7` no toman una `PURGED`; no cuenta para el cupo; el empuje
sale después del commit y `fichaPurgada` contesta `sí`; `PB9` desde un estado que no es `ARCHIVED`
no corre.
Tipo: integración con DB
Cubre: [AC:V9b:8](#ac-v9b-8)
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)

<a id="test-v9b-9"></a>
**TEST:V9b:9** — Unitario sobre el cálculo de inactividad: el más reciente de los cinco hechos o la
escritura `C`, con el hecho 1 leído del registro de `V9a`, incluido un acto anterior al merge.
Tipo: unitario
Cubre: [AC:V9b:9](#ac-v9b-9)
Fuente: [LISTA:V9b](#lista-v9b), [FILA:V9b](#fila-v9b)

<a id="test-v9b-10"></a>
**TEST:V9b:10** — Integración: los tres avisos en sus fechas objetivo, con relectura de cobertura y
sin duplicado tras un reinicio.
Tipo: integración con DB
Cubre: [AC:V9b:10](#ac-v9b-10)
Fuente: [PLAZO:4](../02-nucleo.md#plazo-4), [FILA:V9b](#fila-v9b)

<a id="test-v9b-11"></a>
**TEST:V9b:11** — Migración desde cero: base armada con las migraciones de la rama de la fase;
`PB9` y los avisos leen la versión 1 de los plazos sin escribirla; `trial` y las tablas de sólo
agregar sin `deleted_at`; la rama no agrega migración estructural.
Tipo: migración desde cero
Cubre: [AC:V9b:11](#ac-v9b-11), [AC:V9b:13](#ac-v9b-13)
Fuente: [FILA:V9b](#fila-v9b), [LISTA:V9b](#lista-v9b), [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)

<a id="test-v9b-12"></a>
**TEST:V9b:12** — Smoke de la fase (parte de `staging` del checklist extendido, antes del merge de la
rama): la primera fecha posible de un aviso de retención es posterior a la fecha del merge, y un
aviso de una ficha con la fecha forzada sale una vez.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:V9b:12](#ac-v9b-12)
Fuente: [GATE:FP.F1](../30-el-corte.md#gate-fp-f1), [FILA:V9b](#fila-v9b)

## Smoke y etiquetas

- La pieza no lleva etiqueta `status-needs-smoke-*` ([GATE:M1](../30-el-corte.md#gate-m1)): van sólo en `HOS-1352`.
- El smoke de la Fase 1 es el checklist del sistema nuevo extendido con lo de la fase
  ([GATE:FP.2](../30-el-corte.md#gate-fp-2)): la parte de `staging` antes del merge de la rama ([TEST:V9b:12](#test-v9b-12)) y la de
  producción como un 5c propio, con la tarjeta del owner y un monto aprobado de antemano, después de
  que la fase llegue a producción.

## Dependencias, rollback y despliegue

- **Espera a**: `V9a` (la parte *b* espera a la *a*), y por herencia `V4`, `V6` y `U2`
  (`V/descomposicion.md` §3). **La espera**: `B10` ([GATE:FP.F1](../30-el-corte.md#gate-fp-f1), [DEP:11](../03-contrato-de-cobertura.md#dep-11)).
- **Despliegue**: rama épica propia de la Fase 1 (`epic/**`), que entra a `staging` entera con el gate
  de fase ([GATE:FP](../30-el-corte.md#gate-fp), [GATE:FP.1](../30-el-corte.md#gate-fp-1), [GATE:FP.2](../30-el-corte.md#gate-fp-2), [GATE:FP.3](../30-el-corte.md#gate-fp-3)); el merge lo decide el owner.
- **Rollback**: al ser aditiva y sin migración estructural, revertir la rama de la fase no toca el
  esquema; lo que `PB9` borró no vuelve (es irreversible por diseño).

## Labels de Linear

- `V9b` todavía no tiene issue: entra al árbol de Linear desde esta spec (`V/descomposicion.md` §5;
  [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) implicación 3). Pasa a `Done` al mergearse en la rama de su fase ([GATE:M1](../30-el-corte.md#gate-m1)).
- **Sin** etiqueta `status-needs-smoke-*` ([GATE:M1](../30-el-corte.md#gate-m1)).

## Abiertos

- Quién engancha el aviso *«al archivar»*, que sale con el acto de archivar (`PB4`/`PB5`, de `V6`, al
  corte) pero es uno de los tres avisos de `V9b` (Fase 1, aditiva).
- Cómo se calcula *«la primera fecha en que un aviso de retención podría salir»* para el gate de la
  Fase 1.
- Anotados en `_trabajo/abiertos/g6-v5-v9.md`.

## Origen

- `V/descomposicion.md` §2, fila `V9b` (l. 73); §3; §4, fila `V9b` (l. 717); §2.10, §2.11 y §2.14.
- `V/docs/03-maquinas-de-estado.md` §9 (`PB9`, l. 496); `V/docs/02-modelo-de-datos.md` §4.1–§4.2.
- `NUCLEO/01` §1.2; `NUCLEO/02` §1.5 (plazos 2 y 4); `NUCLEO/07` §2, §4.1 y §6; `NUCLEO/08` §1.1 y §2.3.
- `01-decision-log.md`: `DEC-DATA-005`, `DEC-DATA-001`, `DEC-ARCH-017`.
- `16-fase-7-del-paraguas.md` §4.6 (l. 949) y §4.7 (*«Las fases posteriores»*, l. 1079–1111).
