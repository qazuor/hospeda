# V9a · El registro de los actos del dueño

<a id="pieza-v9a"></a>
**PIEZA:V9a** — pieza `V9a`, de la unidad `V9` (partida); **cuándo**: al corte; **fuente**: Z y AC
(lista de piezas del corte, `16-fase-7-del-paraguas.md` §4.6; [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) puntos 3 y 6).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:948

## Objetivo, alcance y fuera de alcance

**Objetivo.** Que desde el día del corte cada acto del dueño sobre su ficha que no es una
transición —crearla, editarla, exportarla— quede registrado, con el nombre de los campos de
contenido y nunca su texto, porque es la fuente del hecho 1 del reloj de retención y lo que pase
antes de que exista no se reconstruye ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 6).

**La unidad partida.** `V9` deja de ser pieza y queda como el origen de sus dos mitades (Z): la
fila y el *«Lista cuando»* de la unidad se definen acá, en su forma vigente, y `V9b`
([FILA:V9b](../20-fase-1/V9b.md#fila-v9b)) los referencia.

<a id="fila-v9"></a>
**FILA:V9 — Retención** *(partida en `V9a`, al corte, y `V9b`, después: corte del MVP, owner
2026-10-01, Z y AC)*. Qué deja funcionando la unidad, en su forma vigente:

1. **el reloj de 90 y 180 días con sus cinco hechos de reinicio** (el cuarto salió con la revisión
   del owner, 2026-09-28, C8): el sexto, *«se levanta la moderación»*, lo escribe `PB11`, de `V6`
   (owner 2026-09-25; FASE 9 completa, 5b); el quinto lo escribe `PB2`, de `V6`, sobre la ficha
   publicada, y el recálculo que el aviso despierta sobre las demás fichas del dueño en la vertical
   —o, si el aviso se perdió, el reconciliador diario de cobertura, de `V6` ([DEC-ARCH-009](../01-decisiones-vigentes.md#dec-arch-009))—
   (FASE 8 completa, `F-8CA2-001`, owner 2026-09-25);
2. **el día 180 como la fila `PB9` hacia `PURGED`, que sólo borra el contenido de la ficha**
   ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005); FASE 8 completa, `F-8CA2-008`), **y en el mismo acto desconecta el calendario
   de esa ficha: su token se revoca en el proveedor y se borra** (`03` §9 `PB9`, `02` §4.1; owner
   2026-09-26, `G1-5`; la unidad, con OK del owner, FASE 9 vuelta 1, J);
3. el **seudónimo determinístico** del correo (FASE 9 completa, `C-1`) — *su función pasa a `V4`*
   (corte del MVP, owner 2026-10-01, AC; [FILA:V4](V4.md#fila-v4));
4. los **tres** avisos;
5. **el registro de los actos del dueño sobre la ficha que no son transiciones —crearla, editarla,
   exportarla—, que es la fuente del hecho 1, guardando sólo el nombre de los campos de contenido,
   nunca su texto**, para que el día 180 no deje el contenido vivo en los eventos (`NUCLEO/08`
   §1.1–§1.2; owner 2026-09-25, FASE 9 completa, 8e);
6. **el empuje *«la ficha llegó a `PURGED`»* que `PB9` le manda a billing después de su commit**
   (contrato §3.1; FASE 9 vuelta 1, `G2-1`);
7. **`PB9` bajo el lock, con la lista cerrada de lo que cuelga de `listing`** (`03` §9, `02` §2.2 y
   §4.1; FASE 9 vuelta 2, `R9`, `F-8V2A2-004`, `F-8V2A3-004`);
8. **y `V9` depende de `U2`, el outbox común, porque encola los avisos de retención** (FASE 5, owner
   2026-09-30, lote 2 A).

**El reparto** (Z y AC): el punto 5 es de `V9a`; el 3, de `V4`; el resto (1, 2, 4, 6, 7 y 8), de
`V9b`. **Capítulos**: `02` §4 · `22` §3 · `01` §1.2 (núcleo) · `03` §9 (`PB9`) · `08` §1.1–§1.2
(núcleo). **Guards**: ninguno (decía *«el de `D16`»*, que era `G-R5`; se va a `B8`, §2.7).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:71

<a id="fila-v9a"></a>
**FILA:V9a — El registro de los actos del dueño.** Qué deja funcionando: **el registro de los actos
del dueño sobre la ficha que no son transiciones —crearla, editarla, exportarla—, que es la fuente
del hecho 1 del reloj, guardando sólo el nombre de los campos de contenido y nunca su texto**;
**escribe desde el día del corte**, porque lo que pase antes de que exista no se reconstruye (corte
del MVP, owner 2026-10-01, AC; `41-corte-del-mvp/00-propuesta.md` §1 y §4.1). La función del
seudónimo, que la propuesta ponía acá, es de `V4` (AC). **Capítulos**: `08` §1.1–§1.2 (núcleo).
**Guards**: ninguno.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:72

**Alcance.** El punto 5 de [FILA:V9](#fila-v9), completo, y el 📌 de la decisión que lo funda,
[DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1): en los campos de contenido de una ficha —los que borra el día 180— el evento
guarda sólo el **nombre** del campo; los demás campos (estado, plan, monto, fechas) siguen con el
valor anterior y el nuevo; y crear, editar y exportar se registran como eventos aunque no sean
transiciones.

**Fuera de alcance** (lo construye otra pieza):

- el reloj, `PB9`, el empuje a billing, la lista cerrada de `PURGED` y los tres avisos: `V9b`
  ([FILA:V9b](../20-fase-1/V9b.md#fila-v9b)), en la Fase 1;
- la función del seudónimo y sus casos: `V4` ([FILA:V4](V4.md#fila-v4));
- los hechos 2, 3, 5 y 6 y la escritura `C` del corte: la máquina de publicación y el reconciliador
  de `V6` ([FILA:V6](V6.md#fila-v6)).

## Historias de usuario y criterios de aceptación

<a id="lista-v9"></a>
**LISTA:V9 — «Lista cuando» de la unidad** *(partida: ver `V9a` y `V9b`, y los casos del seudónimo
en `V4`; corte del MVP, owner 2026-10-01, Z y AC)*, en su forma vigente:

1. la fila de `trial` sobrevive al borrado de la cuenta, y su **seudónimo** **no** se anonimiza
   (`C-1`);
2. **el día 180 (`PB9`) borra el contenido de la ficha y nada de la persona** ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005)),
   **y después del borrado ningún evento de dominio conserva el texto borrado** (8e);
3. **después de `PB9` la ficha no conserva conexión de calendario: el token quedó revocado en el
   proveedor y no existe en la base** (`G1-5`; FASE 9 vuelta 1, J);
4. **después de `PB9` la alerta de precio de un turista está cerrada y su correo encolado, la
   conversación se lee y no admite mensajes, y lo del dueño que sólo servía a la ficha no tiene filas
   de ella; `PB9` y `PB8` simultáneos sobre la misma ficha no dejan contenido borrado en una ficha
   `DRAFT`; y el seudónimo de un correo es el mismo antes y después de un redeploy** (`02` §2.2 y
   §4.1, `03` §9; FASE 9 vuelta 2, `R9`, `F-8V2A2-004`, `F-8V2A3-004`);
5. **`ana.maria@gmail.com` y `anamaria@gmail.com` comparten seudónimo, y `ana.maria@hotel.com` y
   `anamaria@hotel.com` no** (`02` §2.2; owner 2026-09-27, FASE 9 vuelta 2, `R23`), **ni
   `ana.maria@hotmail.com` y `anamaria@hotmail.com`, ni `ana@hotmail.com` y `ana@outlook.com`; y
   `ana+1@hotel.com` y `ana+2@hotel.com` sí lo comparten** (`02` §2.2; owner 2026-09-28, FASE 9
   vuelta 2, verificación, `V2-j1` a `V2-j3`).

*(La cláusula del fin de servicio salió con el hecho 4: revisión del owner, 2026-09-28, C8.)*
**El reparto**: las cláusulas 1, la última de 4 y la 5 son de `V4` ([LISTA:V4](V4.md#lista-v4)); la segunda mitad
de la 2 se sostiene en el registro de `V9a`; el resto es de `V9b` ([LISTA:V9b](../20-fase-1/V9b.md#lista-v9b)).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:715

<a id="lista-v9a"></a>
**LISTA:V9a — «Lista cuando»**: **un acto del dueño sobre su ficha —crearla, editarla, exportarla—
deja su registro con el nombre de los campos de contenido y nunca su texto, desde el día del corte**
(corte del MVP, owner 2026-10-01, AC). *(La fuente marca esta cláusula como derivada de la fila de
`V9` del §2, `NUCLEO/08` §1.1–§1.2, 8e.)*
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:716

### Historias de usuario

<a id="us-v9a-1"></a>
**US:V9a:1** — Como anfitrión, quiero que crear, editar o exportar mi ficha cuente como actividad
desde el primer día del sistema nuevo, para que el reloj de retención no la archive ni la borre
mientras la estoy usando.
Actor: anfitrión
Fuente: [FILA:V9a](#fila-v9a), [FILA:V9](#fila-v9)

<a id="us-v9a-2"></a>
**US:V9a:2** — Como sistema/cron, quiero leer del registro el acto más reciente del dueño sobre cada
ficha, para contar el hecho 1 del reloj sin reconstruir nada.
Actor: sistema/cron
Fuente: [FILA:V9](#fila-v9), [FILA:V9a](#fila-v9a)

<a id="us-v9a-3"></a>
**US:V9a:3** — Como anfitrión, quiero que el registro no guarde el texto de mi ficha, para que cuando
el contenido se borre no quede una copia en los eventos.
Actor: anfitrión
Fuente: [DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1), [LISTA:V9](#lista-v9)

### Criterios de aceptación

<a id="ac-v9a-1"></a>
**AC:V9a:1** — Crear, editar y exportar se registran aunque no sean transiciones.

- **Dado** el sistema nuevo desplegado y un anfitrión con una ficha
- **Cuando** crea una ficha, la edita y la exporta
- **Entonces** cada acto deja un evento en el registro append-only de eventos de dominio con qué
  pasó (de un catálogo cerrado), sobre qué ficha, quién (actor y tipo de actor), cuándo (UTC) y la
  correlación (`NUCLEO/08` §1.2), aunque ninguno sea una transición de la máquina.
Fuente: [FILA:V9a](#fila-v9a), [LISTA:V9a](#lista-v9a), [DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1)

<a id="ac-v9a-2"></a>
**AC:V9a:2** — De los campos de contenido, sólo el nombre.

- **Dado** una ficha con descripción, fotos, FAQ y horarios (los campos de contenido que borra el día
  180, `V/02` §4.1)
- **Cuando** el dueño edita la descripción y, en el mismo acto, un campo que no es contenido
- **Entonces** el evento guarda, para la descripción, sólo el nombre del campo, sin el valor anterior
  ni el nuevo, y para el otro campo (estado, plan, monto o fecha) el valor anterior y el nuevo.
Fuente: [DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1), [LISTA:V9a](#lista-v9a), [FILA:V9a](#fila-v9a)

<a id="ac-v9a-3"></a>
**AC:V9a:3** — Ninguna copia del texto en los eventos.

- **Dado** una ficha cuya descripción se editó cinco veces
- **Cuando** se leen todos los eventos de dominio de esa ficha
- **Entonces** ninguno contiene ninguno de los textos de la descripción; así, cuando `V9b` borre el
  contenido en `PB9`, ningún evento de dominio conserva el texto borrado.
Fuente: [LISTA:V9](#lista-v9), [DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1), [FILA:V9](#fila-v9)

<a id="ac-v9a-4"></a>
**AC:V9a:4** — Escribe desde el día del corte, y es la fuente del hecho 1.

- **Dado** la rama del corte con `V9a` mergeada, desplegada en el paso del corte
- **Cuando** el dueño de una de las fichas cargadas por la migración la edita después del despliegue,
  y se consulta el acto más reciente del dueño sobre esa ficha
- **Entonces** el evento existe desde ese primer acto (no hay que esperar a ninguna pieza posterior),
  y la consulta devuelve su instante; no se reconstruyen actos anteriores al corte.
Fuente: [FILA:V9a](#fila-v9a), [FILA:V9](#fila-v9), [LISTA:V9a](#lista-v9a)

<a id="ac-v9a-5"></a>
**AC:V9a:5** — Salida: la pieza está lista.

- **Dado** la rama con `V9a` mergeada
- **Cuando** se corren los casos de [AC:V9a:1](#ac-v9a-1) a [AC:V9a:4](#ac-v9a-4)
- **Entonces** un acto del dueño sobre su ficha —crearla, editarla, exportarla— deja su registro con
  el nombre de los campos de contenido y nunca su texto, desde el día del corte, y la pieza cumple el
  momento 1 ([GATE:M1](../30-el-corte.md#gate-m1)).
Fuente: [LISTA:V9a](#lista-v9a)

## Reglas

- **El hecho 1 del reloj** (`NUCLEO/01` §1.2): un acto del dueño sobre la ficha —crearla, editarla,
  publicarla, despublicarla, exportarla, reactivarla— reinicia la inactividad, y se lee del registro
  append-only de eventos de dominio (`NUCLEO/08` §1.3). Publicar, despublicar y reactivar ya son
  transiciones de `V6`; crear, editar y exportar los registra esta pieza ([DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1)).
- **Los campos mínimos del evento** (`NUCLEO/08` §1.2): qué pasó, sobre qué, quién (actor y tipo),
  cuándo, correlación, qué cambió (en contenido, sólo el nombre del campo) y por qué.
- **El registro es inmutable** (`NUCLEO/08` §1.3): append-only, sin `deleted_at` ([DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005),
  su último 📌, que es de `V9b` y `V6`).
- **Escribe desde el corte** ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 6): lo que pase antes de que exista no se
  reconstruye.

## Modelo de datos y migraciones

- El registro es `domain_event` (`NUCLEO/02` §2.6): qué pasó, sobre qué entidad, quién lo causó,
  cuándo, qué campos cambiaron —de los campos de contenido de una ficha, sólo el nombre—;
  append-only y sin `deleted_at`.
- **Sin migración propia en la fila**; el esquema de las 25 unidades nace en las migraciones de la
  rama antes del corte ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 7). Qué pieza crea la tabla, si no existe, no lo dice
  la fila: ver *Abiertos*.
- **Sin migración de datos**: no se reconstruyen actos anteriores al corte ([FILA:V9a](#fila-v9a)).

## API

- N/A como ruta propia — la pieza no agrega rutas: las operaciones de crear, editar y exportar una
  ficha ya existen, y esta pieza les agrega la escritura del evento ([FILA:V9a](#fila-v9a)). La autorización
  es la de `V5` ([FILA:V5](V5.md#fila-v5)).

## UI web y admin, e i18n

N/A — la fila no nombra ninguna superficie ([FILA:V9a](#fila-v9a)); lo que el dueño ve del reloj y los avisos
es de `V9b` y `V8a`.

## Cron y outbox

N/A — `V9a` no encola nada ni corre jobs: el registro se escribe en el acto del dueño
([FILA:V9a](#fila-v9a)). *(Que `V9a` espere a `U2` es una flecha heredada de `V9` que la fuente marca: el
registro no encola; `V/descomposicion.md` §3.)*

## Variables de entorno

N/A — la fila no declara variables de entorno ([FILA:V9a](#fila-v9a)).

## Auditoría y observabilidad

Es un registro de auditoría: los actos del dueño sobre la ficha que no son transiciones se registran
aunque no cumplan ninguna de las tres condiciones de auditable (`NUCLEO/08` §1.1), con los campos de
§1.2 y la correlación del borde que construye `U2` (`NUCLEO/08` §2.4).

## Seguridad

La protección es de datos: el registro no guarda texto de contenido, así que el borrado del día 180 no
deja copias en un registro que la retención no toca ([DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1)). Lo que se pierde es poder
mostrar *«qué decía antes»* una ficha, que ningún capítulo pide.

## Testing esperado

<a id="test-v9a-1"></a>
**TEST:V9a:1** — Integración: crear, editar y exportar una ficha escriben un evento cada uno, con los
campos mínimos.
Tipo: integración con DB
Cubre: [AC:V9a:1](#ac-v9a-1)
Fuente: [FILA:V9a](#fila-v9a), [DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1)

<a id="test-v9a-2"></a>
**TEST:V9a:2** — Integración: editar la descripción y el estado en un acto guarda sólo el nombre de la
descripción y el anterior/nuevo del estado.
Tipo: integración con DB
Cubre: [AC:V9a:2](#ac-v9a-2)
Fuente: [DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1)

<a id="test-v9a-3"></a>
**TEST:V9a:3** — Integración: cinco ediciones de la descripción; ningún evento de la ficha contiene
ninguno de los cinco textos.
Tipo: integración con DB
Cubre: [AC:V9a:3](#ac-v9a-3)
Fuente: [LISTA:V9](#lista-v9), [DEC-DATA-005#📌1](../01-decisiones-vigentes.md#dec-data-005-p1)

<a id="test-v9a-4"></a>
**TEST:V9a:4** — Integración: sobre una base con las fichas cargadas por la migración del corte, el
primer acto del dueño después del despliegue deja su evento y la consulta del acto más reciente lo
devuelve; no hay eventos sintéticos anteriores al corte.
Tipo: integración con DB
Cubre: [AC:V9a:4](#ac-v9a-4), [AC:V9a:5](#ac-v9a-5)
Fuente: [FILA:V9a](#fila-v9a), [LISTA:V9a](#lista-v9a)

## Smoke y etiquetas

N/A — `V9a` no tiene smoke propio: las etiquetas `status-needs-smoke-*` van sólo en `HOS-1352`, nunca
en las piezas ([GATE:M1](../30-el-corte.md#gate-m1)).

## Dependencias, rollback y despliegue

- **Espera a**: `V4`, `V6` y `U2` (heredado de `V9`; la flecha de `V6` se escribe explícita;
  `V/descomposicion.md` §3). **La espera**: `V9b`, que lee su registro.
- **Despliegue**: al corte, en la rama `epic/HOS-1352-verticales-billing` ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017)); se da
  por terminada con el momento 1 ([GATE:M1](../30-el-corte.md#gate-m1)).
- **Rollback**: el del corte (`16-fase-7-del-paraguas.md` §3); la pieza no tiene rollback propio.

## Labels de Linear

- `V9a` todavía no tiene issue: entra al árbol de Linear desde esta spec (`V/descomposicion.md` §5;
  [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) implicación 3). Pasa a `Done` al mergearse en la rama del paraguas ([GATE:M1](../30-el-corte.md#gate-m1)).
- **Sin** etiqueta `status-needs-smoke-*` ([GATE:M1](../30-el-corte.md#gate-m1)).

## Abiertos

- Qué pieza crea `domain_event` si la tabla no existe en la rama (ninguna fila de pieza la nombra).
  Anotado en `_trabajo/abiertos/g6-v5-v9.md`.

## Origen

- `V/descomposicion.md` §2, filas `V9` y `V9a` (l. 71–72); §3; §4, filas `V9` y `V9a` (l. 715–716).
- `NUCLEO/08` §1.1–§1.3; `NUCLEO/01` §1.2 (hecho 1); `NUCLEO/02` §2.6.
- `01-decision-log.md`: `DEC-DATA-005` y su primer 📌; `DEC-ARCH-017`.
- `16-fase-7-del-paraguas.md` §4.6 (lista de piezas, l. 948) y §4.7 (momento 1).
