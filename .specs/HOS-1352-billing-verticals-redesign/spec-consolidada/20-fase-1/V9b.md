# V9b · Retención

<a id="pieza-v9b"></a>
**PIEZA:V9b** — pieza `V9b`, de la unidad `V9` (partida); **cuándo**: después, en la **Fase 1**,
sola; **fuente**: Z y AC (lista de piezas del corte, `16-fase-7-del-paraguas.md` §4.6;
[DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) puntos 3 y 6 y su 📌 de AW).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:958

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
reescribe filas ni código del corte ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) puntos 2 y 7).

**La fecha límite de la Fase 1** (corte del MVP, owner 2026-10-02, [BV](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bv)): **límite = el instante del
corte + el plazo 1 − el plazo 4 de `NUCLEO/02` §1.5, con la versión 1 de los plazos**
([PLAZO:1](../02-nucleo.md#plazo-1), [PLAZO:4](../02-nucleo.md#plazo-4)). La Fase 1 se mergea a producción antes de esa fecha, y su gate
([GATE:FP.F1](../30-el-corte.md#gate-fp-f1)) la verifica contra ese número. Las fichas del corte nacen con `inactiva_desde` en el
instante del corte (`NUCLEO/01`, fila `C`) y el primer aviso de `V9b` es el previo al archivado; el
aviso *«al archivar»* ya sale desde `V6` ([BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)). Cada reloj guarda la versión con que arrancó, así que
un cambio de plazo posterior no adelanta la fecha.
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1177, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1178, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1179, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1180, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1181, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1182

<a id="fila-v9b"></a>
**FILA:V9b — Retención** *(después)*. Qué deja funcionando, en su forma vigente: **el resto de
`V9`**:

1. **el reloj de 90 y 180 días con sus cinco hechos de reinicio** —el hecho 1 lo lee del registro de
   `V9a`—;
2. **`PB9` hacia `PURGED` con todo lo que la fila de `V9` le fija**: la desconexión del calendario,
   el lock, la lista cerrada de lo que cuelga de `listing` y el empuje a billing después del commit;
3. **los dos avisos previos, que encola en `U2`, y su job; el *«al
   archivar»* ya lo encola `V6` con `PB4` y `PB5`** (corte del MVP, owner 2026-10-02, [BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl));
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
   de `PB9` del §2.11; corte del MVP, owner 2026-10-01, BD: la tabla y la acción son de `V6`);
6. **los dos avisos previos salen por su job, sin tocar el código de `PB4` y `PB5`, que ya encola el
   *«al archivar»*** (corte del MVP, owner 2026-10-02, [BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:724

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
**US:V9b:4** — Como admin, quiero que la Fase 1 se mergee a producción antes de la primera fecha en que
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
  confirman, y la corrida diaria de `V6` los reintenta hasta confirmarlos ([V6](../10-corte/V6.md#pieza-v6)
  la construye con `PB12`); las reseñas de terceros se
  conservan sin mostrarse.
Fuente: [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9), [LISTA:V9b](#lista-v9b)
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:838, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:519

<a id="ac-v9b-4"></a>
**AC:V9b:4** — Lo que cuelga de la ficha, por dueño del dato.

- **Dado** una ficha con una alerta de precio de un turista, una conversación entre ese turista y el
  dueño, un favorito de un turista, un pedido de arreglo abierto, y datos del dueño que sólo sirven a
  esa ficha
- **Cuando** `PB9` la borra
- **Entonces** la alerta queda cerrada y el correo transaccional *«tu alerta de precio se cerró»*
  encolado; la conversación se lee y no admite mensajes, con su referencia a la ficha anulable; y lo
  del dueño que sólo servía a la ficha no tiene filas de ella; `PB9` no escribe `deleted_at`, así que
  el favorito sigue (el trigger de extras no corre); el pedido de arreglo queda cerrado en el mismo acto,
  sin correo, y su fila se conserva; la configuración de revalidación no se
  toca.
Fuente: [LISTA:V9b](#lista-v9b), [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:787, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:801, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:802

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
  uno antes del archivado y uno antes del borrado, que encola el job de `V9b`, y el de *«al
  archivar»*, que encola `PB4`/`PB5` de `V6` en el mismo acto ([BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)); los dos previos cuentan desde el
  más tardío de `inactiva_desde` y el `pausaTerminadaEn` de `retenciónDetenida`, releen la cobertura
  y no salen si el dueño está cubierto; **releen además el estado de la ficha y la pausa: no salen
  sobre una ficha `MODERATED` ni `PURGED`, ni mientras `retenciónDetenida` conteste `sí`**
  (`NUCLEO/07` §6; N7, C14); el previo al borrado nunca antes de la fecha que anunció el
  archivado; cada ocurrencia lleva en su clave la fecha objetivo (`listing:<id>:ret:…`), así que un
  reloj reiniciado puede volver a mandarlos sin duplicarlos.
Fuente: [PLAZO:4](../02-nucleo.md#plazo-4), [FILA:V9b](#fila-v9b), [FILA:V9](../10-corte/V9a.md#fila-v9), [BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:274

<a id="ac-v9b-14"></a>
**AC:V9b:14** — Los dos avisos previos los suma el job, sin tocar `PB4` ni `PB5`.

- **Dado** la rama de la Fase 1 sobre el código del corte, donde `PB4` y `PB5` (de `V6`) ya encolan
  el aviso *«al archivar»* con su plantilla
- **Cuando** se compara el diff de `V9b` contra la rama del corte, y corre el job de `V9b` sobre una
  ficha que llega al día del aviso previo al archivado y, después de archivada, al previo al borrado
- **Entonces** el diff no toca el código de `PB4` ni de `PB5`; los dos avisos previos salen por el
  job, encolados en el outbox de `U2`; y el archivado de esa ficha encola el *«al archivar»* una sola
  vez, el de `V6`, sin que el job lo duplique.
Fuente: [LISTA:V9b](#lista-v9b), [FILA:V9b](#fila-v9b), [PLAZO:4](../02-nucleo.md#plazo-4), [BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)

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

- **Dado** los plazos de la versión 1, fijados por el owner antes del merge de `V6`, y el instante
  del corte
- **Cuando** se calcula la fecha límite como el instante del corte + el plazo 1 − el plazo 4, con la
  versión 1 de los plazos, y se decide el merge de la rama de la Fase 1
- **Entonces** el gate de la fase verifica contra ese número que el merge a producción es anterior a
  la fecha límite; `V9b` está en `Done` y la rama cumple el gate de fase (momento 2 sobre la rama,
  smoke de `staging` extendido antes del merge y drift guard en verde); `B10` no arranca antes de ella.
Fuente: [GATE:FP.F1](../30-el-corte.md#gate-fp-f1), [FILA:V9b](#fila-v9b), [PLAZO:1](../02-nucleo.md#plazo-1), [PLAZO:4](../02-nucleo.md#plazo-4), [BV](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bv)

<a id="ac-v9b-13"></a>
**AC:V9b:13** — Salida: la pieza está lista.

- **Dado** la rama de la Fase 1 con `V9b` mergeada
- **Cuando** se corren los casos de [AC:V9b:1](#ac-v9b-1) a [AC:V9b:11](#ac-v9b-11) y [AC:V9b:14](#ac-v9b-14)
- **Entonces** se cumplen las seis cláusulas de su *«Lista cuando»* y la pieza cumple el momento 1
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
- **Los avisos** (`NUCLEO/07` §4.1 y §6): transaccionales, no suprimibles, tres; `V9b` suma los dos
  previos y su job, y el *«al archivar»* lo encola `V6` en el acto de `PB4`/`PB5`, con su plantilla
  ([BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl): la pieza anterior escribe su rama entera y la posterior trae lo suyo sin tocar código
  anterior).
- **Aditiva** ([GATE:FP](../30-el-corte.md#gate-fp)): ninguna migración estructural, ningún cambio de filas del corte.

## Diseño de origen: retención y la corrección legal (`V/02` §4, `V/22` §3)

*(Contenido vigente de los capítulos que la fila de `V9b` nombra —`02` §4 y `22` §3—, sin lo
tachado y con las decisiones del owner aplicadas. Lo que se construye en otra pieza va referenciado.)*

### Retención: qué se borra, qué se anonimiza, qué se conserva (`V/02` §4, cierra `M-DATA-01`)

El §25 del PDR ordena soft delete a los 90 días y hard delete a los 180 de *«datos operativos
eliminables»*, y manda conservar auditoría, pagos, registros obligatorios, información legal e
historial necesario. Nunca define qué es eliminable. **Lo define [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)** (owner
2026-09-25): el contenido de una ficha y sus borradores, y **nunca** nada de la persona.

**El riesgo concreto que esto cierra**: si la auditoría del §49 guardara eventos de dominio
*completos* con su contenido, el hard delete no eliminaría nada y la promesa del §25 sería
decorativa. Por eso `domain_event` guarda **referencias y campos que cambiaron, no copias**
(`NUCLEO/02` §2.6: el registro vive en esa mitad; FASE 9 vuelta 1). Es una decisión de modelo tomada
para que la retención sea posible; el registro de los actos del dueño que lo cumple es de `V9a`
([FILA:V9a](../10-corte/V9a.md#fila-v9a)).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:747, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:749, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:750, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:751, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:752, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:754, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:755, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:756, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:757

### La lista (`V/02` §4.1)

**Los dos días se cuentan sobre la misma inactividad**, que es un término del núcleo y no una frase
de esta tabla: `NUCLEO/01` §1.2 la define y enumera **los cinco hechos que la reinician** (el
quinto, *«el dueño pierde la cobertura en la vertical»*, escrito en todas sus fichas en ella: FASE 8
completa, `F-8CA2-001`, owner 2026-09-25; **el sexto, *«se levanta la moderación»*, `PB11`**: FASE
9 completa, decisión 5b; el cuarto salió con la revisión del owner, 2026-09-28, C8). El que más
importa acá es el segundo —**la cobertura comprobada verdadera**, un estado leído y no un cambio
detectado (`NUCLEO/01` §1.2)—, porque es el que impide que el día 180 alcance a alguien que volvió.

**Y se cuentan sobre una columna, no sobre una derivación: `listing.inactiva_desde`** (`V/02`
§2.5). El día 90 es `inactiva_desde` + el plazo 1 y el 180 es `inactiva_desde` + el plazo 2, con la
versión de plazos que guarda la ficha ([PLAZO:1](../02-nucleo.md#plazo-1), [PLAZO:2](../02-nucleo.md#plazo-2)); **el trabajo que hace el reloj es de la
columna, y las transiciones sólo la leen**. El hecho 2 se resuelve **preguntándole al contrato**,
nunca leyendo el aviso que lo empuja (`12-contrato…` §3), y `PB4` y `PB5` vuelven a preguntar en el
momento de archivar (`V/03` §9).

| | qué | por qué |
|---|---|---|
| **Se borra** al día 180 | **el contenido de ESA ficha —textos, fotos, FAQ, horarios— y sus borradores, y nada más** ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)). **Sólo sobre una ficha en `ARCHIVED`**, y la ficha pasa a **`PURGED`** ([TRANS:V:PB9](../04-catalogos.md#trans-v-pb9); FASE 8 completa, `F-8CA2-008`, `F-8CA2-014`, owner 2026-09-25). **Y el mismo contenido se borra en el acto cuando el dueño borra su ficha** ([TRANS:V:PB12](../04-catalogos.md#trans-v-pb12)), que también la lleva a `PURGED` y no es retención: es un acto suyo (FASE 8 completa, `F-8CA2-004`). **«Fotos» incluye su copia en el almacenamiento externo.** **Y `PURGED` conserva la fila**: el borrado es del contenido, no un `DELETE` de `listing`, así que ningún `ON DELETE CASCADE` corre y lo que cuelga de la ficha se trata uno por uno, en la lista cerrada de abajo (FASE 9 vuelta 2, `R9`) —nadie lea *«hard delete»* como borrar la fila— (FASE 9 vuelta 1, `F-8V1A3-010`). **Las reseñas de terceros se conservan, sin mostrarse**: son de quien las escribió ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005) protege a las personas). **La conexión de calendario se desconecta, y su token se revoca en el proveedor y se borra**: un token vivo sobre una ficha que no existe es riesgo sin servicio (owner 2026-09-26, `G1-5`) | es lo que el §25 llama operativo: sirve para prestar el servicio **de esa ficha** y ese servicio terminó |
| **No se anonimiza nada** | el proceso de archivar y purgar **no anonimiza nada** ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)): el renglón *«se anonimiza al día 180»* salió de la retención | la retención es de fichas, y *«el usuario no es un dato operativo»* ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)) |
| **Se conserva íntegro, siempre** | **la fila de `trial`** —que guarda **un seudónimo determinístico del correo normalizado, no el correo**: no permite leer el correo, pero **reconoce a quien vuelve con el mismo** (FASE 9 completa, `C-1`); **tras la baja de la cuenta, el seudónimo se conserva hasta que conteste el abogado, y si contesta en contra lo borra soporte con una tarea puntual** (`V/02` §2.2; FASE 9 vuelta 3, owner 2026-09-30, lote H)—, **y todo lo que es de la persona**: el usuario, sus preferencias, sus señales de identidad ([DEC-TRIAL-004](../01-decisiones-vigentes.md#dec-trial-004)) y sus datos personales, **también dentro de eventos de dominio y del outbox** ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)) | la fila de `trial` es el §10.2: el trial no se devuelve, así que la evidencia de que se consumió **tiene que sobrevivir al borrado** o el borrado se convierte en la forma de conseguir otro. **Lo de la persona**, porque la retención no la toca nunca ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)); su baja pedida por ella misma es otro proceso, que esa decisión no cubre |

**Lo que cuelga de `listing`, y qué le pasa en `PURGED`: la lista cerrada** (owner 2026-09-27, FASE
9 vuelta 2, `R9`; `F-8V2A2-006`). La tabla de arriba promete tratar *«uno por uno»* lo que cuelga de
la ficha, y el esquema actual cuelga bastante más que las reseñas y el calendario; sin `DELETE` de
la fila, nada cae por arrastre. **La regla es la de `G1-5` generalizada por el dueño del dato**: lo
de un tercero se conserva, y lo del dueño que sólo sirve a esa ficha se borra con el contenido. La
alerta de precio es la excepción, y la decidió el owner. Vale igual para `PB9` y para `PB12`. La
columna de tablas es del código actual (`packages/db/src/schemas/`), medida sobre las tres tablas de
`listing` (`V/02` §2.5), incluidas las referencias polimórficas por `entity_type` + `entity_id`, que
no tienen FK. **Sobre el código actual son 29 tablas con FK a `accommodations`, `gastronomies` o
`experiences` y 11 con `entity_type`**, recontadas con un script que cruza los saltos de línea
(FASE 9 vuelta 2, verificación, `N-B-02`: la primera medición contó 28, porque el `references(` de
`posts` está partido en dos líneas). **La vigila [GUARD:G-R9](../04-catalogos.md#guard-g-r9)** (`V/20` §2; owner 2026-09-27, FASE 9
vuelta 2, verificación, `V2-k`):

| qué cuelga | de quién es | en `PURGED` | tablas (código actual) |
|---|---|---|---|
| **el contenido de la ficha**: textos, fotos, FAQ, horarios, amenities y features, etiquetas, y en gastronomía la carta, los especiales y los eventos, y en experiencia los certificados | del dueño | **se borra**: es el renglón de arriba ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)), y las fotos incluyen su copia en el almacenamiento externo | `accommodation_media`, `accommodation_faqs`, `r_accommodation_amenity`, `r_accommodation_feature`; `gastronomy_media`, `gastronomy_faqs`, `r_gastronomy_amenity`, `r_gastronomy_feature`, `gastronomy_menu_sections`, `gastronomy_menu_items`, `gastronomy_daily_specials`, `gastronomy_events`; `experience_media`, `experience_faqs`, `r_experience_amenity`, `r_experience_feature`, `experience_certificates`; `r_entity_tag` |
| **las reseñas** | del tercero que las escribió | **se conservan, sin mostrarse** (arriba) | `accommodation_reviews`, `gastronomy_reviews`, `experience_reviews` |
| **los comentarios** sobre la ficha | del tercero que los escribió | **se conservan, sin mostrarse**, como las reseñas | `entity_comments` |
| **las conversaciones** entre un turista y el dueño | de los dos, y el turista es un tercero | **se conservan en sólo lectura**, con *«esta ficha ya no existe»* (`V/19` §4 fila 28). **La referencia a la ficha admite una ficha ausente**: es anulable, y leer la conversación no la exige. Hoy es `onDelete: restrict` y no anulable | `conversations` |
| **los favoritos** de un turista | del turista | **se conservan**: para él la ficha no existe (`V/17` §1.2, precisión 7), y la superficie la trata así. **Y llegar a `PURGED` no escribe `deleted_at`** (FASE 9 vuelta 3, `F-8V3A3-004`): el carril de extras del código actual tiene un trigger que borra de `user_bookmarks` los favoritos de un alojamiento cuando su `deleted_at` pasa de nulo a no nulo, y `PURGED` es un estado, no un soft delete. Ninguna transición del modelo nuevo escribe esa columna, y la tabla de traducción del corte, que la leía, salió (FASE 5, simplificación del corte, S-01). **Tampoco la escribe el borrado del dueño de hoy**, que sale (abajo, *«las puertas de borrado de hoy»*) | `user_bookmarks` |
| **el pedido de arreglo** de una ficha moderada | de la moderación: el motivo es del admin y el aviso de que corrigió, del dueño | **se cierra en el mismo acto, sin correo, y la fila se conserva como registro de la moderación** (FASE 9 vuelta 3, `F-8V3A2-004`, `F-8V3A3-007`): sin ficha no hay arreglo que pedir, y el correo de *«moderación levantada»* le diría al dueño a dónde volvió una ficha que borró. Cerrado, sale del listado de arreglos pendientes (`V/02` §2.5) | `pedido_de_arreglo` |
| **las alertas de precio** de un turista | del turista | **se cierran, con un aviso al turista** (`V/19` §4 fila 27; el correo, `NUCLEO/07` §6): sin ficha no hay precio que vigilar, y el job de alertas dejaría de evaluar una ficha vacía | `tourist_price_alerts` |
| **la conexión de calendario** | del dueño | **se desconecta: su token se revoca en el proveedor y se borra** (arriba, `G1-5`) | `accommodation_calendar_sync` |
| **las promociones del dueño sobre esa ficha, sus listados y su reputación externos, su ocupación, sus datos de IA, los QR que apuntan a ella y sus estadísticas agregadas** | del dueño, y sólo sirven a esa ficha | **se borran con el contenido** | `owner_promotions` (las de esa ficha), `accommodation_external_listings`, `accommodation_external_reputation`, `accommodation_occupancy`, `accommodation_ia_data`, `qr_codes` (los de esa ficha), `entity_view_monthly_rollups` |
| **lo que no es de la ficha aunque la nombre** | de otro registro | **no lo toca `PURGED`**: la telemetría de vistas tiene su propia retención; la auditoría y el registro de revalidaciones se conservan (§25); **la instancia de un addon de alcance `LISTING` es de billing, y la trata `A6`** (`B/03` §8); el vínculo de addon y el caché de suscripción del cobro viejo salen de la rama con la limpieza del principio y de la base en el paso 3 del corte (`B/21` §4; FASE 9 vuelta 3, `F-8V3A3-007`). **La nota del blog que nombra la ficha como alojamiento relacionado es contenido editorial de Hospeda**: la referencia queda, y la superficie trata la ficha como inexistente (`V/17` §1.2, precisión 7), como en un favorito (FASE 9 vuelta 2, verificación, `N-B-02`). **La configuración de revalidación es por tipo** y no nombra ninguna ficha: tiene `entity_type` sin `entity_id` | `entity_views`, `social_audit_log`, `revalidation_log`, `addon_instance`, `posts`, `revalidation_config` |

**La lista es cerrada**: una tabla nueva que cuelgue de `listing` entra acá en el mismo acto, con su
fila, **y si no entra, [GUARD:G-R9](../04-catalogos.md#guard-g-r9) falla**. La columna de tablas nombra las 40, una por una (FASE 9
vuelta 2, verificación, owner 2026-09-27, `V2-k`): **38 del código actual que sobreviven a la
limpieza del principio —29 con FK y 9 con `entity_type`— y 2 del modelo nuevo, `pedido_de_arreglo`
y `addon_instance`**; las dos del cobro viejo salieron (FASE 9 vuelta 3, `F-8V3A3-007`) y estaban
las dos entre las de `entity_type`, así que las 29 con FK quedan y las 11 con `entity_type` bajan a
9; el total de 38 no cambia (FASE 5, owner 2026-09-30, lote 6 G, `F5-BD-011`). **Lo construyen las
dos transiciones que llegan a `PURGED`: `PB9` (esta pieza) y `PB12` (`V6`)**.

**Las puertas de borrado de hoy, fuera de `PB9` y `PB12`, se retiran todas** (FASE 5, owner
2026-09-30, lote 3 C, `F5-BD-012`, `F5-SUP-017`). Hoy el dueño de un alojamiento borra su ficha
escribiendo `deleted_at` —el trigger les borra los favoritos a los turistas, que esta lista
conserva—, y el panel tiene, en las tres verticales, un borrado, un borrado físico y una
restauración; el borrado físico hace `DELETE` de la fila y arrastra por `CASCADE` las reseñas de
terceros. **El borrado del dueño pasa a ser `PB12`, el del equipo es la acción 23 —a pedido del
dueño y con motivo, que corre `PB12`— ([ACC:23](../02-nucleo.md#acc-23)) y el borrado físico de fichas desaparece** (el de
cuentas, `V/02` §2.2). Sin eso, una ficha se borra sin llegar a `PURGED`, por una puerta que no corre
`A6` ni esta lista. El retiro es de `V6` ([FILA:V6](../10-corte/V6.md#fila-v6)).

**Los dos borrados remotos van después del commit, y la fila los recuerda hasta que se confirman**
(FASE 9 vuelta 3, `F-8V3A2-005`). Las fotos en el almacenamiento externo y la revocación del token
de calendario no entran en la transacción de `PB9` o `PB12` (`NUCLEO/03`, regla 3), y van
**después de su commit**: antes, una transacción que no confirma dejaba una ficha viva sin fotos.
**La transacción no borra la fila de cada foto ni la de la conexión de calendario: las marca
pendientes de borrado remoto**, y cada una se borra recién cuando el almacenamiento o el proveedor
confirman. **Lo pendiente lo reintenta una corrida diaria**, con el vigía de cron externo del
reconciliador diario de cobertura (`V/03` §9; [DEC-ARCH-009](../01-decisiones-vigentes.md#dec-arch-009)), **y una pendiente que sobrevive a una
corrida se reporta como error en cada corrida**: lo colgado conserva una fila que lo nombra y alguien
que lo ve. Una fila marcada no se muestra en ninguna superficie, porque su ficha está en `PURGED`. Lo
construye `V6`, con `PB12`, que llega antes que `PB9`; `PB9` lo usa.

**Las dos preguntas que la FASE 8 completa dejó sobre esta tabla, cerradas el 2026-09-25** (owner):

1. **El día 180 es de UNA ficha y dos renglones alcanzaban a la PERSONA** (`F-8CA3-009`): las
   preferencias de la cuenta, las señales de identidad y los datos personales dentro de un evento o
   del outbox. **La cierra [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)**: la retención sólo toca fichas, y lo de la persona no se
   borra ni se anonimiza nunca, así que ya no hay renglón que alcance a una ficha viva —ni a la
   suscripción viva— a través de su dueño.
2. **El hard delete y `PB5` no tenían orden entre sí** (`F-8CA2-014`). **La cierran las dos salidas
   juntas**, como reglas de capítulo: **el borrado exige `ARCHIVED`** —el aviso del archivado salió
   siempre antes; **el espacio entre los dos no está garantizado** (FASE 9 completa, `K-5`; `V/03`
   §9, ⚠️ de la moderación, punto 7)— **y el `N` de `PB5` se valida contra el plazo de borrado**: hoy
   es la validación [VAL:G-R5-B](../04-catalogos.md#val-g-r5-b) de *«cambiar un plazo»*, que construye `V6` (revisión del owner,
   2026-09-28, C9: dejó de ser guard). La consecuencia queda aceptada: la ficha publicada sin
   cobertura que `PB4` no alcanzó **no se borra** hasta que se archive; y cuando se archive, el día
   180 puede estar ya vencido, así que `PB9` borra en la corrida siguiente, sin el espacio que el
   aviso del archivado supone (FASE 9 completa, `B-3`; declarado por `DEC-METH-015`). **Causa**:
   `PB9` cuenta sobre `inactiva_desde`, no sobre el instante del archivado; pasa sólo si el job del
   archivado estuvo caído más que su plazo. *(Con la tabla de plazos de BD, `PB9` además no borra
   antes de la fecha que el archivado anunció, `borrado_anunciado`: [AC:V9b:7](#ac-v9b-7).)*

**Qué son «sus borradores»**: el corpus usa *«borrador»* **sólo** para una ficha en `DRAFT` (`PB5`,
[DEC-TRIAL-007](../01-decisiones-vigentes.md#dec-trial-007)), y el modelo no tiene ediciones sin publicar de una ficha —`listing` guarda un
contenido (`V/02` §2.5)—. Con la precondición, una ficha en `DRAFT` se borra **sólo después de que
`PB5` la archivó**, igual que cualquier otra. El *«sus borradores»* de [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005) es de **esa**
ficha, así que si el modelo llegara a tener ediciones sin publicar caerían con su contenido; **hoy
no las declara**, y queda anotado.

**El seudónimo existe porque el correo es a la vez el único bloqueo y un dato que el borrado de la
cuenta anonimiza.** [DEC-TRIAL-004](../01-decisiones-vigentes.md#dec-trial-004) decidió que sólo el correo normalizado niega un trial nuevo. **La
retención ya no anonimiza el correo** ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)), pero el corpus declara otro camino que sí:
**el borrado de la cuenta**, en el que la fila de `trial` sobrevive y *«lo personal se anonimiza con
el resto»* (`V/02` §4.2, regla 2), y el pedido de supresión que `V/22` §3 y el pliego legal
(pregunta 5) ponen junto a él. Por ese camino la fila sobreviviría **sin poder reconocer a nadie**,
que es exactamente el desenlace que conservarla viene a evitar. El seudónimo sirve para lo único que
hace falta —«¿este correo ya consumió?», nunca «¿cuál era?»—. **No es irreversible en el sentido que
importa: es un seudónimo determinístico**, y **reconoce a quien vuelve con el mismo correo** —es para
eso que existe, y su `UNIQUE` lo exige determinístico— (FASE 9 completa, `C-1`). Cualquiera con un
correo candidato calcula el seudónimo y confirma si esa persona tuvo trial, y así lo tiene que leer
la consulta legal (`V/22` §3, abajo). ⚠️ **Lo que queda pendiente**: ese camino —la baja de la
cuenta pedida por el propio usuario— es justo lo que [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005) declara que **no decide**
(*«es otro proceso»*); **para la baja manual lo diseña la acción administrativa 24**
([ACC:24](../02-nucleo.md#acc-24); revisión del owner, casos vecinos, 2026-09-29, caso H-C), que seudonimiza la fila de
`user` sin borrarla (caso I-C) y conserva tal cual los datos de facturación que la ley obliga a
guardar (caso J-C; `V/02` §2.2: FASE 9 vuelta 3, `F-8V3D1-007`), en la copia que guarda cada
comprobante (caso K-A); la razón del seudónimo descansa sobre un proceso que el corpus nombra y no
escribe (FASE 8 completa, `F-8CA3-009`, owner 2026-09-25). **La baja desde Mi Cuenta queda fuera de
esta épica, a mano por soporte con una lista de pasos, [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393)** (revisión del owner,
2026-09-28, N7, `g1`). La función del seudónimo y sus casos son de `V4` ([FILA:V4](../10-corte/V4.md#fila-v4); corte del MVP,
owner 2026-10-01, AC).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:759, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:761, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:762, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:763, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:764, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:765, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:766, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:767, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:769, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:770, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:771, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:772, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:773, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:775, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:776, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:777, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:778, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:779, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:781, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:782, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:783, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:784, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:785, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:786, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:787, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:788, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:789, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:790, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:791, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:792, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:793, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:795, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:796, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:797, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:798, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:799, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:800, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:801, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:802, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:803, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:804, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:805, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:806, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:808, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:809, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:810, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:811, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:812, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:813, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:814, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:815, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:816, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:818, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:819, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:820, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:821, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:822, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:823, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:824, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:825, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:826, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:828, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:829, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:830, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:831, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:832, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:833, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:834, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:835, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:836, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:837, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:838, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:840, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:841, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:842, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:843, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:844, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:845, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:846, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:847, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:848, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:849, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:850, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:851, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:852, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:853, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:854, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:855, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:856, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:857, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:858, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:859, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:860, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:861, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:862, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:863, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:864, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:865, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:866, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:867, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:868, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:869, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:870, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:871, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:872, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:873, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:874, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:875, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:876, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:877, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:878, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:879, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:880, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:881, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:882, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:884, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:885, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:886, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:887, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:888, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:889, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:890, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:891, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:892, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:893, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:894, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:895, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:896, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:897, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:898, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:899, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:900, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:901, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:902, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:903, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:904, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:905, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:906

### Cuatro reglas que la lista necesita (`V/02` §4.2)

1. **Anonimizar no es borrar la fila.** El evento conserva su tipo, su fecha, su entidad y su causa;
   lo que se reemplaza es el dato personal. **Desde [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005) la retención no anonimiza
   nada**, así que esta regla no tiene sujeto en el día 180; se conserva para el borrado de la cuenta
   (regla 2), cuyo proceso esa decisión no cubre y queda pendiente (FASE 8 completa, `F-8CA3-009`,
   owner 2026-09-25; fuera de esta épica, a mano por soporte con una lista de pasos,
   [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393): revisión del owner, 2026-09-28, N7, `g1`).
2. **La fila de `trial` sobrevive al borrado de la cuenta.** Es la única entidad de este modelo que
   lo hace, y la razón está en el §10.2. Conserva el `user + vertical`, las fechas y **el seudónimo
   del correo normalizado**; lo personal se anonimiza con el resto. El seudónimo **no** se anonimiza
   —es lo que hace que sobrevivir sirva de algo— (hasta la respuesta del abogado: arriba y `V/22` §3).
3. **El día 90 no borra nada.** La ficha sale del sitio público, **el dueño la sigue viendo** y puede
   **exportarla o reactivarla a borrador sin pagar nada** ([DEC-DATA-001](../01-decisiones-vigentes.md#dec-data-001), [TRANS:V:PB8](../04-catalogos.md#trans-v-pb8)). Poder exportar
   antes es lo que hace defendible el hard delete del día 180, y los avisos son correos
   transaccionales no suprimibles: **tres**, uno antes del día 90, uno **al archivar** y uno antes del
   día 180 (`NUCLEO/07` §6); el *«al archivar»* lo encola `V6` con `PB4`/`PB5`, y los dos previos,
   esta pieza (corte del MVP, owner 2026-10-02, BL).

   **La salida NO es «suscribiéndose»**: ésa era la redacción de [DEC-DATA-001](../01-decisiones-vigentes.md#dec-data-001), escrita cuando la
   única vuelta imaginable era volver a contratar, y describía una salida más angosta que la que el
   diseño tiene; la población declarada de `PB8` es literalmente la contraria —*«el que quiere su
   ficha de vuelta sin pagar todavía»* (`V/03` §9)—.

   **Las dos salidas que esta regla ofrece son ejecutables**: reactivar la ejecutan **`PB7`** —sola,
   cuando la cobertura vuelve **o cuando el cupo vuelve a alcanzar**— ([TRANS:V:PB7](../04-catalogos.md#trans-v-pb7)) y **`PB8`** —a
   pedido del dueño, hacia `DRAFT`— (`V/03` §9); y el dueño tiene con qué ejecutar `PB8`: la versión
   de piso otorga *«recuperar lo suyo»* (`V/02` §2.1), sin lo cual el paso 6 de la autorización
   rechazaría a la única población para la que esta salida existe. **El hard delete del día 180 se
   defiende con las dos salidas, y para el sujeto del borrado las dos tienen que ser alcanzables, no
   sólo estar escritas.**
4. **La vuelta reinicia el reloj, y el reinicio cuelga del hecho, no de la transición.** Lo que
   reinicia la inactividad es **la cobertura comprobada verdadera** (`NUCLEO/01` §1.2, hecho 2) —un
   estado leído, no un cambio detectado—, aunque `PB7` no llegue a disparar porque el cupo no
   alcanza. Sin esta regla, el que reanuda con un plan más chico se queda con la ficha archivada **y
   con el reloj del día 180 corriendo**, que es el mismo desenlace que la regla 3 viene a evitar.

   **El reinicio es una escritura en `inactiva_desde` (`V/02` §2.5) y se ejecuta en CUATRO momentos,
   no en uno**: cuando el recálculo que el aviso despierta vuelve a preguntar y trae `cubierto`
   verdadero; **—sin aviso— cuando el reconciliador diario de cobertura encuentra la vuelta y corre
   `PB3`/`PB7`** (`V/03` §9; [DEC-ARCH-009](../01-decisiones-vigentes.md#dec-arch-009), owner 2026-09-25); —como red— cuando `PB4` o `PB5`
   releen antes de archivar (`V/03` §9); y —como última red— **cuando el hard delete del día 180
   relee antes de borrar** (`NUCLEO/01` §1.2). Los cuatro preguntan; **ninguno le cree al aviso**
   (`12-contrato…` §3).

   **El último es el que no puede faltar.** Las dos relecturas son la misma red aplicada a los tres
   actos que el reloj gobierna —`PB4`, `PB5` y el día 180; el reconciliador no es uno de esos actos:
   no avanza sobre el reloj, restituye—, y **el único irreversible es el del día 180**: si el aviso
   se pierde y el recálculo no corre, el día 90 archiva —recuperable con `PB8`— pero el día 180
   **borra el contenido publicable de un cliente que está pagando**, y no hay `PB8` que traiga de
   vuelta lo que ya no está. La línea del núcleo que nombra a los tres ejecutores —*«`PB4`, `PB5` y
   el hard delete del día 180 releen la cobertura … y, si está cubierta, reinician el reloj en vez de
   avanzar»*— es la que lo dice.

   **Su caso testigo es la pausa.** Alguien pausa hasta 4 pausas-mes —unos 120 días, `B/03` §5—,
   `PB2` le baja la ficha el primer día **y en ese mismo acto escribe `inactiva_desde`** (`NUCLEO/01`
   §1.2, hecho 5; FASE 8 completa, `F-8CA2-001`, owner 2026-09-25) —**y el recálculo escribe ese
   mismo instante en sus fichas que no estaban publicadas**, borrador y excedente incluidos (owner
   2026-09-25)—. *(Sin esa escritura la columna guardaba el último reinicio, de hasta 90 días de
   antigüedad, y el 90 y el 180 caían hasta 90 días antes de lo que esta cuenta dice.)* **Y durante
   una pausa pedida por el dueño el reloj queda detenido** (revisión del owner, 2026-09-28, C14,
   `L1-c`): `PB4`, `PB5` y `PB9`, y los avisos de retención, releen la pregunta `retenciónDetenida`
   del contrato (§4.1) y con `sí` no hacen nada; al volver, el hecho 2 reinicia el reloj, **y todo fin
   de la pausa, por cualquier camino, lo reinicia también** (revisión del owner, casos vecinos,
   2026-09-29, caso 12; `12-contrato…` §4.1), **sin escribir nada: `retenciónDetenida` devuelve
   también cuándo terminó la última pausa, y los lectores cuentan desde el más tardío entre
   `listing.inactiva_desde` y ese instante** (caso F-A) (**y `PB9`, además, desde
   `coberturaPerdidaEn`, el más tardío de los tres**: FASE 9 vuelta 3, owner 2026-09-30, lote Q),
   **con la versión de plazos que guarda la ficha, `listing.plazos_version`** (caso H-E). El
   invariante `D16` y su guard salieron.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:908, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:910, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:911, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:912, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:913, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:914, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:915, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:916, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:917, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:918, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:919, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:920, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:921, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:922, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:923, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:925, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:926, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:927, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:928, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:929, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:930, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:932, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:933, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:934, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:935, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:936, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:937, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:938, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:939, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:940, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:941, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:942, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:943, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:944, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:945, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:946, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:947, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:948, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:950, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:951, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:952, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:953, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:954, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:955, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:957, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:958, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:959, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:960, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:961, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:962, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:963, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:964, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:965, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:966, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:968, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:969, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:970, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:971, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:972, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:973, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:974, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:975, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:976, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:977, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:978, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:979, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:980, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:981, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:982, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:983, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:984, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:986

### El conflicto legal y la corrección que pide al núcleo (`V/22` §3)

#### El defecto (`V/22` §3.1)

Dos piezas que por separado están bien y juntas se anulan:

1. **[DEC-TRIAL-004](../01-decisiones-vigentes.md#dec-trial-004)**: lo único que bloquea un trial nuevo es **el correo normalizado**.
2. **`V/02` §4.2, regla 2**: la fila de `trial` **sobrevive** al borrado de la cuenta, *«conserva el
   `user + vertical` y las fechas; lo personal se anonimiza con el resto»*.

*(La tercera pieza que el capítulo nombraba —que el día 180 anonimizara el correo— ya no existe:
desde [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), owner 2026-09-25, la retención sólo toca fichas y no anonimiza nada de la
persona, `V/02` §4.1.)*

**El correo es a la vez el único bloqueo y un dato que el borrado de la cuenta anonimiza.** Al
borrarse la cuenta, o si llega un pedido de supresión, la fila de `trial` sigue ahí y **ya no puede
reconocer a nadie**: la persona se registra de nuevo con la misma dirección y obtiene un trial nuevo.
**El defecto sigue en pie sin la anonimización del día 180**: la regla 2 alcanza sola (FASE 8
completa, `F-8CA3-009`). ⚠️ Esa baja pedida por el usuario es el proceso que [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005) declara
que no decide, y ningún capítulo la diseña: queda pendiente, fuera de esta épica, a mano por soporte
con una lista de pasos, [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393) (revisión del owner, 2026-09-28, N7, `g1`).

**Y el pedido de supresión de quien postuló un Partner sin cuenta** (FASE 9 vuelta 3, owner
2026-09-30, lote AI; verificación, VC3-VT-08): su correo queda en `postulacion` (`V/02` §2.7) y no
hay cuenta que dar de baja. Lo borra la acción 24 de `NUCLEO/08` §3 ([ACC:24](../02-nucleo.md#acc-24)), que alcanza también
a esa postulación: soporte reemplaza el correo a pedido de quien la escribió, con motivo y registro.

**Y `V/02` lo dice de frente**: la fila se conserva *«porque el trial no se devuelve, así que la
evidencia de que se consumió tiene que sobrevivir al borrado o el borrado se convierte en la forma
de conseguir otro»*. Eso es exactamente lo que pasaría —no por lo que se borra, sino por lo que se
anonimiza—.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:57, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:59, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:61, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:63, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:64, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:65, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:67, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:68, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:70, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:71, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:72, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:73, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:74, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:75, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:76, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:78, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:79, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:80, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:81, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:83, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:84, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:85, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:86

#### La corrección (`V/22` §3.2)

**Se guarda un seudónimo determinístico del correo normalizado, no el correo**: no permite leer el
correo, pero **reconoce a quien vuelve con el mismo correo** (FASE 9 completa, `C-1`). *(Decía «hash
irreversible», y la palabra le vendía al abogado una premisa falsa: cualquiera con un correo
candidato calcula el hash y confirma si esa persona tuvo trial —es la función del hash, y su
`UNIQUE` lo exige determinístico—. Tiene que corregirse **antes de mandar el pliego**.)*

| | |
|---|---|
| **sirve para lo único que tiene que servir** | comparar un candidato contra lo consumido. [DEC-TRIAL-004](../01-decisiones-vigentes.md#dec-trial-004) sólo necesita *«¿este correo ya consumió?»*, nunca *«¿cuál era?»* |
| **sobrevive a la anonimización** | **no se puede leer de vuelta, pero sigue reconociendo a quien trae el mismo correo**: eso es lo que la anonimización del borrado de la cuenta no le saca, y lo que la consulta legal tiene que evaluar. La anonimización es la del borrado de la cuenta; la retención ya no anonimiza ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)) |
| **no cambia la decisión** | el bloqueo sigue siendo el correo normalizado, con la normalización de `V/02` §2.2, que quita los puntos y el `+alias` según la lista cerrada de proveedores (owner 2026-09-27, FASE 9 vuelta 2, `R23`; la lista por proveedor, owner 2026-09-28, verificación, `V2-j1` a `V2-j3`) |

**`V/02` §4 queda corregido en el mismo acto**: lo que la fila de `trial` conserva es el
`user + vertical`, las fechas y **el seudónimo**, no el correo (arriba, regla 2).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:88, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:90, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:91, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:92, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:93, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:94, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:96, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:97, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:98, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:99, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:100, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:102, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:103

#### La pregunta al abogado, en esta forma (`V/22` §3.3)

No *«¿cómo declaramos la finalidad?»*, que es una pregunta sin filo, sino:

> **¿Podemos conservar un seudónimo determinístico del correo —que no permite leerlo pero reconoce a
> quien vuelve con el mismo—, después de borrada la cuenta y después de un pedido de supresión, con
> la única finalidad de no otorgar un segundo trial gratuito?**

Es la formulación útil porque tiene dos respuestas y las dos tienen consecuencia escrita:

- **si se puede** — se implementa como la corrección de arriba y `M-LEGAL-02` se cierra declarando
  finalidad y plazo;
- **si no se puede** — **el trial de por vida deja de ser sostenible tras un borrado**, y eso hay que
  aceptarlo explícitamente. [DEC-TRIAL-004](../01-decisiones-vigentes.md#dec-trial-004) ya aceptó la mitad de esto en su implicación 1 —*«se
  esquiva con una segunda dirección de correo; el trial de por vida del §10.2 queda como intención,
  no como garantía»*—; sería la otra mitad, y **cambia un mecanismo**: hay que poder borrar el
  seudónimo de una fila que hoy se declara íntegra (`V/02` §4.1), con un escritor nuevo y una columna
  anulable, y el `UNIQUE` deja de bloquear a esa persona (FASE 9 completa, `C-1`). **El escritor
  nuevo es una tarea puntual de soporte que los borra todos, y se anota quién la corrió y cuándo;
  hasta la respuesta, la baja de cuenta conserva el seudónimo** (`V/02` §2.2; FASE 9 vuelta 3, owner
  2026-09-30, lote H; `F-8V3A3-006`). Esa tarea no es una fila del catálogo ni se construye ahora
  ([DEC-DATA-005#📌7](../01-decisiones-vigentes.md#dec-data-005-p7)).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:105, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:107, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:109, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:110, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:111, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:113, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:115, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:116, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:117, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:118, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:119, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:120, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:121, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:122, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:123, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:124, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:125, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:127

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

- Los textos de los dos avisos previos y el del cierre de la alerta van en el catálogo de correos
  (`NUCLEO/07` §6) y en `@repo/i18n`. La plantilla del aviso *«al archivar»* es de `V6`, que la
  encola ([BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl); [FILA:V6](../10-corte/V6.md#fila-v6)).
- Las filas 20, 27 y 28 del `19` §4 son de `V8a` ([FILA:V8a](../10-corte/V8a.md#fila-v8a)).

## Cron y outbox

- El job diario que corre `PB9` y los dos avisos previos, con la correlación de su corrida y la de cada ficha
  (`NUCLEO/08` §2.3), y con un actor de sistema de la fábrica de `V5` ([FILA:V5](../10-corte/V5.md#fila-v5)).
- `PB9` usa la corrida diaria que reintenta los borrados remotos pendientes, que construye `V6` con
  `PB12` ([V6](../10-corte/V6.md#pieza-v6); [TRANS:V:PB9](../04-catalogos.md#trans-v-pb9)).
- Los dos avisos previos se encolan en el outbox común de `U2` con la clave de schedule que lleva
  la fecha objetivo; el aviso de alerta cerrada por `PURGED` usa como ocurrencia el id del evento
  de dominio que lo causó (`NUCLEO/07` §2). El *«al archivar»* lo encola `V6`
  en el acto de `PB4`/`PB5` ([BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)).

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
nuevos mensajes, filas del dueño de la ficha borradas; la ficha sin `deleted_at` y el favorito del
turista en su lugar; el pedido de arreglo cerrado, conservado y sin correo en el outbox.
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
**TEST:V9b:10** — Integración: los dos avisos previos en sus fechas objetivo por el job, y el
*«al archivar»* encolado por `PB4`/`PB5`, con relectura de cobertura y sin duplicado tras un
reinicio; y los dos previos no salen sobre una ficha `MODERATED` ni `PURGED`, ni con
`retenciónDetenida` en `sí`.
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
rama): la fecha límite, calculada como el instante del corte + el plazo 1 − el plazo 4 con la
versión 1 de los plazos, es posterior a la fecha prevista del merge a producción, y un aviso de una
ficha con la fecha forzada sale una vez.
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:V9b:12](#ac-v9b-12)
Fuente: [GATE:FP.F1](../30-el-corte.md#gate-fp-f1), [FILA:V9b](#fila-v9b), [BV](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bv)

<a id="test-v9b-13"></a>
**TEST:V9b:13** — Integración: el job de `V9b` encola los dos avisos previos de una ficha; al
archivarla, el outbox tiene un solo *«al archivar»*, el de `PB4`/`PB5`, y el job no lo repite.
Tipo: integración con DB
Cubre: [AC:V9b:14](#ac-v9b-14)
Fuente: [LISTA:V9b](#lista-v9b), [PLAZO:4](../02-nucleo.md#plazo-4), [BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)

<a id="test-v9b-14"></a>
**TEST:V9b:14** — Chequeo estático sobre el diff de la rama de la Fase 1 contra la rama del corte:
ningún archivo de `PB4` ni de `PB5` cambia.
Tipo: guard estático
Cubre: [AC:V9b:14](#ac-v9b-14), [AC:V9b:13](#ac-v9b-13)
Fuente: [LISTA:V9b](#lista-v9b), [BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)
Mutación: agregar en la rama de la fase una línea al servicio de `PB4`; el chequeo falla y lo nombra.

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
- Las etiquetas son `kind-spec` más las `area-*` de la fila, y quedan escritas acá al mergear (owner
  [BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs), con sus defaults en
  [DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5); `16-fase-7-del-paraguas.md` §4.7,
  momento 1); el PR de la pieza propone las `area-*` siguiendo lo escrito del repo.

## Abiertos

N/A — los dos abiertos de la pieza los cerró el owner: el aviso *«al archivar»* lo encola `V6` y
`V9b` suma los dos previos y su job ([BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)), y la fecha límite de la Fase 1 es el instante del corte +
el plazo 1 − el plazo 4, con la versión 1 de los plazos ([BV](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bv)).

## Origen

- `V/descomposicion.md` §2, fila `V9b` (l. 73); §3; §4, fila `V9b` (l. 724); §2.10, §2.11 y §2.14.
- `V/docs/03-maquinas-de-estado.md` §9 (`PB9`, l. 496); `V/docs/02-modelo-de-datos.md` §4.1–§4.2.
- `NUCLEO/01` §1.2; `NUCLEO/02` §1.5 (plazos 2 y 4); `NUCLEO/07` §2, §4.1 y §6; `NUCLEO/08` §1.1 y §2.3.
- `01-decision-log.md`: `DEC-DATA-005`, `DEC-DATA-001`, `DEC-ARCH-017`.
- `16-fase-7-del-paraguas.md` §4.6 (l. 958) y §4.7 (*«Las fases posteriores»* y la fecha límite de
  la Fase 1, l. 1171–1176).
- `41-corte-del-mvp/10-decisiones-del-owner.md`: AC, BD, BL y BV (l. 23, 108, 137 y 147).

**Preámbulos de las fuentes, contexto sin norma.** Cada fuente de abajo abre con un texto entre su título y su primera sección. No trae una regla propia: lo que presenta está escrito en las secciones que la siguen, y se cita acá para que la red de cobertura (R17) lo vea.

- `V/22`, el texto entre su título y su primera sección (contexto, sin norma): qué es el capítulo: el pliego de la consulta legal, separando las preguntas legales de las decisiones de diseño.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:18
