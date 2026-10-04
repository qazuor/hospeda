# 02 · Núcleo

Lo que las dos épicas comparten y el único lugar donde se define: las invariantes (`INV:n` e
`INV:Dn`), las acciones administrativas (`ACC:n`) y los plazos configurables (`PLAZO:n`) viven en
este archivo, cada uno con su ancla y su `Origen:`. La prosa del núcleo que no tiene ítems de
inventario vive en cuatro archivos hermanos:

| archivo | qué trae | fuente |
|---|---|---|
| este, `02-nucleo.md` | el mapa y las reglas de escritura (§1), las invariantes (§2), el catálogo de acciones administrativas (§3) y los plazos (§4) | `nucleo/00-indice.md`, `nucleo/04-invariantes.md`, `nucleo/08-auditoria-y-observabilidad.md` §3, `nucleo/02-modelo-de-datos.md` §1.5 |
| [02-nucleo-glosario.md](02-nucleo-glosario.md) | los nombres, el glosario de estados, los cuatro conjuntos que nombra «vivo», la inactividad y sus hechos, la pausa, el criterio Eje 1 / Eje 2 | `nucleo/01-glosario.md` |
| [02-nucleo-modelo-y-maquinas.md](02-nucleo-modelo-y-maquinas.md) | qué sale de la base y qué del código, cómo nacen los valores, el registro de eventos, y las siete reglas de lectura de las diez máquinas | `nucleo/02-modelo-de-datos.md` (salvo §1.5), `nucleo/03-maquinas-de-estado.md` |
| [02-nucleo-outbox.md](02-nucleo-outbox.md) | el outbox, el dedup, el huso horario, la supresión y el catálogo de correos | `nucleo/07-outbox-y-notificaciones.md` |
| [02-nucleo-auditoria.md](02-nucleo-auditoria.md) | qué es auditable, la baja de cuenta manual, la correlación y la observabilidad | `nucleo/08-auditoria-y-observabilidad.md` (salvo §3) |

Las transiciones, los guards, los motivos, los candados y la matriz viven en
[04-catalogos.md](04-catalogos.md); las decisiones, en
[01-decisiones-vigentes.md](01-decisiones-vigentes.md); el contrato entre las dos épicas, en
[03-contrato-de-cobertura.md](03-contrato-de-cobertura.md). La pieza que construye y prueba cada
ítem de este archivo está nombrada en su bloque (*«Pieza dueña del AC»*): los AC y los tests viven
en el archivo de esa pieza, no acá.

---

## 1. El mapa del núcleo y sus reglas de escritura

### 1.1 Qué es y qué no es

**Es** el diseño completo del sistema nuevo —Verticales + Billing de Hospeda partiendo de cero
(`00-PDR.md` §1)—: dominio, datos, estados, invariantes, servicios, API, jobs, proveedor,
superficies, testing y migración.

**No es** un plan de implementación (eso es el corte y las fases, [30-el-corte.md](30-el-corte.md)
y las piezas), ni una comparación contra lo que existe (FASE 5), ni una clasificación de código en
`KEEP`/`ADAPT`/`REWRITE`, que tiene su propio gate
([DEC-METH-003](01-decisiones-vigentes.md#dec-meth-003)) y **no se anticipa acá ni siquiera de forma
implícita**.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:13, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:21, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:23, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:26

### 1.2 De dónde sale cada afirmación

El diseño se escribió **sin el código**: el §0 del PDR es explícito —*«NO quiero que la
implementación existente condicione el diseño del sistema nuevo»*— y el §65 lo repite. Las tres
fuentes admitidas para una afirmación de diseño son:

1. **el PDR** —y si un texto cita un `§`, se verifica contra el PDR—;
2. **una decisión registrada** en el decision log (en esta spec,
   [01-decisiones-vigentes.md](01-decisiones-vigentes.md)). **Las `SUPERSEDED` no cuentan como
   fuente**: [DEC-SUB-001](90-retirados.md#dec-sub-001), [DEC-SUB-003](90-retirados.md#dec-sub-003)
   (por `DEC-SUB-021`) y [DEC-SUB-005](90-retirados.md#dec-sub-005) enteras;
   [DEC-MIG-001](01-decisiones-vigentes.md#dec-mig-001) y
   [DEC-MIG-002](01-decisiones-vigentes.md#dec-mig-002) sólo en lo que `DEC-MIG-003` reemplazó;
   [DEC-MP-003](01-decisiones-vigentes.md#dec-mp-003) sólo en lo que `DEC-MP-008` reemplazó;
   [DEC-SUB-015](90-retirados.md#dec-sub-015), [DEC-SUB-018](90-retirados.md#dec-sub-018),
   [DEC-GRANT-010](90-retirados.md#dec-grant-010) y [DEC-ARCH-011](90-retirados.md#dec-arch-011)
   enteras, y [DEC-DATA-002](01-decisiones-vigentes.md#dec-data-002) sólo en lo que `DEC-DATA-006`
   reemplazó (revisión del owner, 2026-09-28, C8 y C14); [DEC-MIG-004](90-retirados.md#dec-mig-004)
   entera, por `DEC-MIG-007`, y [DEC-MIG-005](01-decisiones-vigentes.md#dec-mig-005) sólo en sus 📌
   que el lote E de la simplificación del corte marca `SUPERSEDED` (FASE 5, 2026-09-30);
3. **una medición fechada** de la matriz de validación del proveedor o del inventario de hechos (las
   filas `MP:` de [04-catalogos.md](04-catalogos.md)).

**El registro de FASE 1B no es fuente de diseño.** Un hallazgo de 1B puede aparecer **sólo** como
advertencia sobre un modo de falla ya observado —nunca como razón para que el diseño sea de una forma
u otra—, y va marcado como tal. Es la línea que el §0 traza: la arquitectura actual no es la fuente
de verdad.

Desde [DEC-METH-019](01-decisiones-vigentes.md#dec-meth-019), esta spec consolidada es la única
fuente para implementar: cada ítem cita su `Origen:` en esas fuentes congeladas.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:30, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:35, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:40, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:42, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:49, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:61, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:63

### 1.3 Cómo se relacionan el núcleo y las dos épicas

**El núcleo es el único lugar donde algo se define.** Las dos épicas —y en esta spec, las piezas—
describen comportamiento y **referencian** el núcleo; no redefinen una entidad, un estado ni un
invariante. Si una épica necesita algo que el núcleo no tiene, se agrega al núcleo; no se declara
localmente. Es el §7 aplicado al documento: *«Debe existir un único motor genérico de billing»*. Una
spec organizada por subdominio reproduce en el papel la duplicación que el §1 nombra como causa de
este programa.

**Las dos épicas sí se citan entre sí** (FASE 8 completa, `F-8CD1-014`). Lo que ninguna de las dos
puede mutar sola es el contrato de cobertura
([03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)), que vive afuera de las dos justamente
para eso.

**El núcleo no se parte**: un glosario en dos mitades deja de ser un glosario, y las 52 invariantes
numeradas de corrido (revisión del owner, 2026-09-28, C8: sale `D14`; C14: sale `D16`) pierden lo
único que las hace útiles, que es poder preguntar **una vez** si están todas.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:68, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:70, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:74, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:78, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:104, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:106, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:108

### 1.4 Cuándo un hueco se considera cerrado

Los huecos técnicos los resuelve el diseño **sin el owner**. Un hueco se cierra cuando el diseño dice
qué pasa en todos sus casos. Dos reglas de método que salen de los propios huecos y rigen este
documento:

- **`O-METH-01`** — *«cerrar todas las decisiones funcionales» no cierra en 1A*: el cierre de una
  decisión funcional es este diseño, y lo que quede abierto al terminarlo **se declara abierto, no se
  completa en silencio** (§67). En esta spec, eso es [80-abiertos.md](80-abiertos.md).
- **`S-METH-01`** — **cuándo caduca una decisión**. Toda afirmación que se apoye en una medición lleva
  su fecha; una medición de la matriz o del inventario de hechos caduca si el hecho que mide puede
  haber cambiado, y en ese caso **se re-mide antes de implementar**, no antes de escribir.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:87, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:89, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:95, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:98

### 1.5 Las dos épicas, por capítulo

- **Verticales** (`HOS-1353`), once capítulos: `02` modelo de datos sin el precio · `03` Trial,
  Publicación y Postulación de Partner · `10` el Eje 2 · `11` trial · `15` entitlements y limits ·
  `17` autorización · `18` Partner · `19` superficies · `20` testing · `21` migración · `22` lo legal.
- **Billing** (`HOS-1354`), trece capítulos: `02` las entidades de dinero · `03` Suscripción, Grace,
  Pausa, Pago, Pago manual, Addon, Reembolso y el no-retroceso · `05` idempotencia · `06` proveedor ·
  `09` conciliación · `10` retiro de plan (revisión del owner, 2026-09-28, C8: sin vertical
  discontinuada) · `12` suscripción · `14` promos, cortesías y grants · `16` addons · `19` · `20` ·
  `21` · `22`. **No espera la pasarela** ([DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005),
  2026-09-24).

Las citas `V/NN` y `B/NN` que quedan en el texto de esta spec son el rastro a esos capítulos en las
fuentes congeladas; el contenido vigente de cada uno está repartido entre el núcleo, los catálogos y
las piezas.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:122, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:124, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:128, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:130

### 1.6 No hay capítulo de Pagos: lo que debía se repartió

El capítulo `13` (Pagos) **no existe, y no es un pendiente**: cada cosa que debía tenía dueño en un
capítulo ya escrito, y quedó **al lado de la regla que la gobierna**.

| lo que el `13` debía | dónde vive |
|---|---|
| la transición que lleva a `ACTIVE` a un **pagador manual** | **[S29](04-catalogos.md#trans-b-s29)**, `B/03` §3.2 |
| la columna **`período`** y el candado `C5` | **`covered_period`**, `B/02` §2.3, y [LOCK:C5](04-catalogos.md#lock-c5) |
| qué hace un **reembolso con la cobertura** del período | `B/02` §2.3 y `LOCK:C5` |
| la **mecánica del reembolso** contra el proveedor | **`B/06` §4.6** |
| el **checkout** y el `init_point` | `B/06` §6 y §4.2 |
| **quién tiene el reloj de cobro** | **[DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)**: es del proveedor |
| reembolsar un cobro **más viejo que el plazo** | **[DEC-RF-007](01-decisiones-vigentes.md#dec-rf-007)**: no se implementa, es manual |
| una **tarjeta cambiada sobre N preapprovals** | ❌ **retirado: deber mal atribuido** |

**El último se retira porque ese flujo no existe**: [DEC-ADDON-002](01-decisiones-vigentes.md#dec-addon-002)
implicación 3 le pasaba el deber de resolver un cambio de tarjeta que queda a medias sobre varios
preapprovals, y la implicación 1 de **esa misma decisión** dice *«no se tokeniza del lado del
servidor… no manejamos datos de tarjeta»*; cambiar la tarjeta exige un token.
**[EX-36](04-catalogos.md#mp-ex-36) mide que el PROVEEDOR puede; no que nosotros lo hagamos.**

> 📌 **Dos lecciones de método.** *«El proveedor puede X»* **no es** *«nuestro diseño hace X»*. Y un
> capítulo que lleva mucho tiempo declarado como pendiente **puede ser contenido sin domicilio** en
> vez de contenido sin escribir.

🚧 **Lo único que quedó abierto**: cuando el proveedor **pausa** por mora,
[EX-11](04-catalogos.md#mp-ex-11) midió que **rechaza toda modificación**. Nosotros no le cambiamos
la tarjeta a nadie —ni queremos—, así que la pregunta es **si el cliente puede recuperar su medio de
pago por su cuenta desde Mercado Pago sobre una suscripción ya pausada**. Si puede, el flujo existe y
es del proveedor. **Si no puede, la suscripción está muerta** y la única salida es un alta nueva por
el checkout. [RN-3](04-catalogos.md#mp-rn-3) empieza a contestarlo.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:135, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:142, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:153, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:160, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:166

### 1.7 Las áreas que el §65 exige, y dónde quedaron

| área del §65 | dónde, en las fuentes | dónde, en esta spec |
|---|---|---|
| domain · entities · relations · constraints | `01` y `02` del núcleo, más el `02` de cada épica | el glosario, el modelo y la sección de datos de cada pieza |
| DB | el `02` de cada épica | cada pieza, «Modelo de datos y migraciones» |
| states · transitions | `03` del núcleo, más el `03` de cada épica | [02-nucleo-modelo-y-maquinas.md](02-nucleo-modelo-y-maquinas.md) y las `TRANS:` de [04-catalogos.md](04-catalogos.md) |
| invariants | `04` del núcleo | §2 de este archivo |
| services · API | cada subdominio, más el `19` de cada épica | cada pieza, «API» |
| jobs | cada subdominio | cada pieza, «Cron y outbox» |
| provider · MP | `06` de billing | las piezas de billing y la matriz `MP:` |
| manual payments | repartido (§1.6): la máquina en `03` de billing y `S29` · la cuota y su período en `02` · el candado `C5` en `05` | ídem |
| outbox | `07` del núcleo | [02-nucleo-outbox.md](02-nucleo-outbox.md) |
| trial | `11` de verticales | la pieza [V4](10-corte/V4.md#pieza-v4) |
| subscription · billing · pause · grace · cancellation | `12` de billing | las piezas de billing |
| plans · billing options | `10`, partido entre las dos | las piezas de catálogo |
| promo · courtesy · grants | `14` de billing | las piezas de billing |
| addons | `16` de billing | las piezas de billing |
| entitlements · limits | `15` de verticales | las piezas de verticales |
| auth | `17` de verticales | las piezas de verticales |
| UI · Admin | `19`, partido entre las dos | cada pieza, «UI web y admin, e i18n» |
| audit · observability | `08` del núcleo | [02-nucleo-auditoria.md](02-nucleo-auditoria.md) y §3 de este archivo |
| reconciliation | `09` de billing | las piezas de billing |
| testing | `20`, partido entre las dos | cada pieza, «Testing esperado» |
| migration | `21`, partido entre las dos | [30-el-corte.md](30-el-corte.md) y las piezas |

El diseño fuente está completo: **22 de 22 capítulos escritos desde el 2026-09-24**; el `13` no llegó
a existir como archivo (§1.6).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:175, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:177, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:203, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:205

---

## 2. Las invariantes

El §64 del PDR lista 37 *«invariantes fundamentales»*; las decisiones del programa agregan 15 más
(`INV:D1` a `INV:D17`, sin `D14` ni `D16`, retirados). Son **52**. Esta sección dice **dónde se hace
cumplir cada una**, **separa las que no son invariantes del sistema** y **nombra lo que ninguna
cubre todavía**. Lo que una invariante necesita para existir de verdad es un lugar donde no se pueda
esquivar: una invariante enunciada y no impuesta es una intención.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:14, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:18, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:243

### 2.1 Los cuatro lugares donde se hace cumplir algo

| nivel | qué significa | cuándo corresponde |
|---|---|---|
| **base** | una restricción de la base lo impide | cuando la invariante es una propiedad de los datos y **no admite ningún camino que la esquive** |
| **servicio** | hay **un** lugar en el dominio que la evalúa | cuando depende de estado resuelto en el momento |
| **guard** | una verificación automática falla en CI | cuando es una propiedad del código, no de los datos |
| **no verificable** | nadie la comprueba | cuando es una regla de método o una intención; **se declara como tal** |

La regla de reparto: **base antes que servicio, servicio antes que guard, guard antes que nada.**
Bajar un nivel exige una razón escrita, porque cada escalón agrega un camino por donde la invariante
se puede perder.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:23, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:25, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:32

### 2.2 Las 37 del §64: las que sostiene la base (6)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:38, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:40

<a id="inv-1"></a>
**INV:1** — **Trial máximo una vez por `user + vertical`.**
Se hace cumplir en la **base**: `UNIQUE(user_id, vertical)` en `trial`, **sin condición de estado**.
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:44

<a id="inv-2"></a>
**INV:2** — **Borrar una ficha no devuelve el trial.**
Se hace cumplir en la **base**: la fila de `trial` **no se borra nunca**, ni siquiera en el hard
delete del día 180 (el [PLAZO:2](#plazo-2), con ese valor al inicio). **Y nace sin `deleted_at`**,
como toda tabla de sólo agregar: un borrado suave es una escritura que el candado contra `DELETE` no
ve (FASE 5, owner 2026-09-30, lote 4 E).
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:45

<a id="inv-8"></a>
**INV:8** — **Máximo una suscripción principal por vertical.**
Se hace cumplir en la **base**: **dos** `UNIQUE` parciales sobre los estados vivos, partidos por
`sucede_a` (`B/02` §2.2). La invariante cuenta **compromisos, no filas**
([DEC-SUB-011](01-decisiones-vigentes.md#dec-sub-011)): ver [INV:D15](#inv-d15).
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:46

<a id="inv-11"></a>
**INV:11** — **Una ficha tiene un único dueño.**
Se hace cumplir en la **base**: columna no anulable, no tabla de relación.
Pieza dueña del AC: [V6](10-corte/V6.md#pieza-v6).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:47

<a id="inv-19"></a>
**INV:19** — **Los webhooks son idempotentes.**
Se hace cumplir en la **base**: `UNIQUE(proveedor, id_del_hecho)`.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:48

<a id="inv-26"></a>
**INV:26** — **Producto de addon ≠ instancia de addon.**
Se hace cumplir en la **base**: dos tablas, y la instancia no repite ningún campo del producto.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3) (las tablas del modelo de addons pasaron de `B4` a
`B3`: owner, letra AV, [DEC-ARCH-017#📌2](01-decisiones-vigentes.md#dec-arch-017-p2)).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:49

### 2.2.1 Las restricciones que sostienen las invariantes, en los dos modelos de datos

El §64 lista 37 invariantes. Éstas son las que **la base puede hacer cumplir sola**, y por eso son
las que no dependen de que ningún camino de código se acuerde. Cada modelo de datos de las épicas
(`V/02` §5 y `B/02` §5) declara las suyas; cada restricción remite a la invariante que sostiene.

**En el modelo de datos de verticales** (`V/02` §5):

| invariante del §64 | restricción |
|---|---|
| [INV:1](#inv-1) · trial máximo una vez por `user + vertical` | `UNIQUE(user_id, vertical)` en `trial`, sin condición de estado |
| [INV:2](#inv-2) · borrar ficha no devuelve trial | la fila de `trial` no se borra nunca (`V/02` §4.1) — **la sostiene contra el borrado de la cuenta la FK `trial.user_id` → `user` con `ON DELETE RESTRICT`** (`V/02` §2.2; FASE 8 completa, `F-8CA3-008`) |
| [INV:11](#inv-11) · una ficha tiene un único dueño | columna no anulable, no tabla de relación |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (`NUCLEO/03` §1, regla 2; [02-nucleo-glosario.md](02-nucleo-glosario.md) §2.3, regla 2) |

> ⚠️ **Lo que la fila de [INV:2](#inv-2) NO tiene, declarado por
> [DEC-METH-015](01-decisiones-vigentes.md#dec-meth-015)** (FASE 8 completa, `F-8CA3-008`): la FK
> impide que la fila caiga **por arrastre** del borrado de la cuenta, pero **ninguna restricción
> declarada impide un `DELETE` directo sobre `trial`**. Hasta que exista una, esa mitad de la
> invariante depende de que ningún camino de código la borre, que es lo que esta sección dice que
> las de arriba no hacen. **Se rechaza con un trigger que rechaza todo `DELETE` sobre `trial`**, en
> el carril de extras (`packages/db/src/migrations/extras/`): ningún camino legítimo borra esa fila,
> porque el borrado de la cuenta la anonimiza (FASE 9 vuelta 1, `F-8V1A3-013`). Con eso el cap. 04
> §2.1 (núcleo), es decir el §2.2 de este archivo, queda cierto sin cambiar el conteo de seis.
>
> **Y `trial` nace sin `deleted_at`, y las tablas de sólo agregar también** (FASE 5, owner
> 2026-09-30, lote 4 E, `F5-BD-029`). El trigger ve un `DELETE`, no un `UPDATE` que ponga la fecha,
> y el borrado suave de hoy la estampa en toda tabla que la tenga: una fila de `trial` *«borrada»*
> así desaparecía para toda lectura que filtrara por `deleted_at`, y la guarda de
> [T1](04-catalogos.md#trans-v-t1) dejaba de verla mientras el `UNIQUE` seguía rechazando la
> inserción. Sin la columna, no hay borrado suave que hacer.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:988, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:990, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:995, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:996, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:997, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:998, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:1000, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:1004, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:1010, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:1017

**En el modelo de datos de billing** (`B/02` §5):

| invariante del §64 | restricción |
|---|---|
| [INV:8](#inv-8) · máximo una suscripción principal por vertical | **dos** `UNIQUE` parciales sobre los estados vivos, partidos por `sucede_a` (`B/02` §2.2). La invariante cuenta **compromisos, no filas**: durante la ventana del cambio de plan hay dos filas y un solo compromiso de pago |
| [INV:10](#inv-10) · una acción en una vertical no afecta a otra | **`UNIQUE(permanent_grant_id, vertical)` en `permanent_grant_vertical`, más «el plan del ancla pertenece a esa vertical»** (`B/02` §2.4). Es la mitad del §64.10 que el scope estructural del cap. 17 **no** alcanza: ahí la resolución pide la vertical, pero el cruce venía **adentro** de la fuente |
| [INV:19](#inv-19) · los webhooks son idempotentes | `UNIQUE(proveedor, id_del_hecho)` en `payment` |
| — · a lo sumo **un grant vivo** por beneficiario | **`UNIQUE(beneficiario) WHERE revocado_en IS NULL` en `permanent_grant`** (`B/02` §2.4, [DEC-GRANT-009](01-decisiones-vigentes.md#dec-grant-009)). No está en el §64 —el PDR no la enuncia— y entra acá por la misma razón que las otras: es lo que hace que **los nueve consumidores de *«grant vivo»*** (`NUCLEO/01` §2.4, en [02-nucleo-glosario.md](02-nucleo-glosario.md)) no puedan encontrar dos filas si alguno olvida el filtro |
| [INV:26](#inv-26) · producto ≠ instancia | son dos tablas, y la instancia no repite ningún campo del producto |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (`NUCLEO/03` §1, regla 2) |

**Las demás no las puede sostener la base** —dependen de la resolución en el servicio— y son las
del capítulo 04 (núcleo), el resto de esta sección 2. Lo que importa es la distinción: las de
arriba **no admiten un camino que las esquive**, las otras sí, y por eso las otras necesitan estar
en un solo lugar. Las dos épicas lo dicen con las mismas palabras.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1282, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1284, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1289, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1290, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1291, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1292, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1293, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1294, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1296

### 2.3 Las 37 del §64: las que sostiene un servicio (14)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:51

<a id="inv-3"></a>
**INV:3** — **El trial comienza al publicar.**
Se hace cumplir en un **servicio**: la transición [T1](04-catalogos.md#trans-v-t1), con el evento de
activación que declara cada vertical ([DEC-TRIAL-006](01-decisiones-vigentes.md#dec-trial-006)).
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:55

<a id="inv-4"></a>
**INV:4** — **El trial usa el plan de trial de su vertical.**
Se hace cumplir en un **servicio**: la misma [T1](04-catalogos.md#trans-v-t1).
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:56

<a id="inv-5"></a>
**INV:5** — **El plan de trial deriva dinámicamente.**
Se hace cumplir en un **servicio**: **la resolución de limits**, en un solo lugar: derivar → aplicar
overrides → comparar contra el piso ([DEC-TRIAL-001](01-decisiones-vigentes.md#dec-trial-001),
[DEC-TRIAL-002](01-decisiones-vigentes.md#dec-trial-002)).
Pieza dueña del AC: [V3](10-corte/V3.md#pieza-v3).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:57

<a id="inv-6"></a>
**INV:6** — **Máximo una ficha en trial.**
Se hace cumplir en un **servicio**: el primer override de esa misma lista
([DEC-TRIAL-001](01-decisiones-vigentes.md#dec-trial-001)), **contado dentro del lock por
`user + vertical` que toma toda transición que ocupa cupo** (`V/03` §9; FASE 8 completa,
`F-8CA2-010`, owner 2026-09-25): sin él, dos [PB1](04-catalogos.md#trans-v-pb1) simultáneos leían el
mismo conteo y publicaban las dos.
Pieza dueña del AC: [V3](10-corte/V3.md#pieza-v3) · también: [V4](10-corte/V4.md#pieza-v4) (implementa), [V6](10-corte/V6.md#pieza-v6) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:58

<a id="inv-7"></a>
**INV:7** — **No se compran addons en trial.**
Se hace cumplir en un **servicio**: la condición de [A1](04-catalogos.md#trans-b-a1) (`B/03` §8).
Pieza dueña del AC: [B10](20-fase-3/B10.md#pieza-b10).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:59

<a id="inv-9"></a>
**INV:9** — **Verticales simultáneas en estados distintos.**
Es una consecuencia del modelo: todo cuelga de `user + vertical`. La construye `V3`, con `B3` en
«también» (owner, letra BC, [DEC-ARCH-017#📌4](01-decisiones-vigentes.md#dec-arch-017-p4)).
Pieza dueña del AC: [V3](10-corte/V3.md#pieza-v3) · también: [B3](10-corte/B3.md#pieza-b3) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:60

<a id="inv-10"></a>
**INV:10** — **Una acción en una vertical no afecta a otra.**
Se hace cumplir en un **servicio**: **el scope de vertical es estructural**, no un chequeo (`V/17`,
autorización). **En una operación sobre una ficha, la vertical se lee de la ficha y nunca del
pedido** (`V/17` §1.2 precisión 6; FASE 8 completa, `F-8CA1-001`, owner 2026-09-25). **Y una mitad
la sostiene la base**: el ancla de un grant es **por vertical** y su plan pertenece a esa vertical
(`B/02` §2.4 y §5). Ahí el cruce venía **adentro de la fuente**, así que la resolución —que sí pide la
vertical— no lo podía ver.
Pieza dueña del AC: [V5](10-corte/V5.md#pieza-v5) · también: [B9a](10-corte/B9a.md#pieza-b9a) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:61

<a id="inv-14"></a>
**INV:14** — **Los servicios validan vertical, acceso, entitlement y limits.**
Se hace cumplir en un **servicio**: la resolución de autorización (`V/17`).
Pieza dueña del AC: [V5](10-corte/V5.md#pieza-v5).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:62

<a id="inv-20"></a>
**INV:20** — **Existe conciliación.**
Se hace cumplir en un **servicio**: la conciliación de billing (`B/09`).
Pieza dueña del AC: [B11](10-corte/B11.md#pieza-b11).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:63

<a id="inv-21"></a>
**INV:21** — **Una divergencia que necesita intervención notifica a `SUPER_ADMIN` diciendo QUÉ pasó.**
Se hace cumplir en un **servicio**: [S14](04-catalogos.md#trans-b-s14), que **abre una marca
`requiere_conciliación` con su motivo** (`B/02` §2.5; los motivos son los `MOT:n` de
[04-catalogos.md](04-catalogos.md)) sin mover el estado. **El motivo es parte de la invariante y no
un adorno**: notificar veinticuatro casos distintos (el 23 y el 24 desde la FASE 9 vuelta 2, `R4` y
`R20`; el 16 desde `F-8CB1-013`, y el 17, el 18 y el 19 desde `F-8CB3-009`,
[DEC-SUB-020](01-decisiones-vigentes.md#dec-sub-020) y `F-8CB3-003`, FASE 8 completa, owner
2026-09-25; el 20 desde la pendiente 6; el 21 y el 22 desde la FASE 9 completa) con la misma marca no
es *«notificar»*: las que se pierden en el montón son las de los **nueve** motivos que significan
*«hay plata del cliente que devolver»*.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:64

<a id="inv-22"></a>
**INV:22** — **La cancelación normal conserva el período pagado.**
Se hace cumplir en un **servicio**: [S11](04-catalogos.md#trans-b-s11) +
[S12](04-catalogos.md#trans-b-s12), con **nuestra** fecha de fin de servicio
([DEC-SUB-009](01-decisiones-vigentes.md#dec-sub-009)).

- **El adjetivo *«normal»* nombra la baja desde `ACTIVE`, que es la única de las cuatro con un período
  pagado que conservar**: las otras tres —[S22](04-catalogos.md#trans-b-s22) desde `PAUSED`,
  [S23](04-catalogos.md#trans-b-s23) desde `SUSPENDED` y [S24](04-catalogos.md#trans-b-s24) desde
  `GRACE_PERIOD`— van directo a `CANCELLED` con la fecha de fin en el día de la cancelación, porque al
  pausar los días se perdieron ([DEC-SUB-010](01-decisiones-vigentes.md#dec-sub-010)), estando
  suspendido el servicio ya estaba cortado (§21) y en el grace **el período en curso no está pagado**:
  su cobro es el que falló ([DEC-SUB-014](01-decisiones-vigentes.md#dec-sub-014)). La invariante
  **no las alcanza y no es una excepción**: no hay período que conservar.
- **Salvo `S22` sobre una sucesora que vive del crédito de
  [DEC-SUB-006](01-decisiones-vigentes.md#dec-sub-006) sin consumir**: el crédito es período pagado
  (`R17`), así que ahí sí
  hay qué conservar, la fila va a `CANCEL_SCHEDULED` hasta el fin del crédito y la invariante la
  alcanza como a `S11` (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`).
- **Y la revocación del derecho de arrepentimiento, [S36](04-catalogos.md#trans-b-s36), tampoco es la
  baja normal**: corta en el acto desde `ACTIVE` porque devuelve el total del último pago
  ([DEC-RF-001](01-decisiones-vigentes.md#dec-rf-001); owner 2026-09-26, `G5-4`).
Pieza dueña del AC: [B8a](10-corte/B8a.md#pieza-b8a) · también: [B8b](20-fase-2/B8b.md#pieza-b8b) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:65

<a id="inv-23"></a>
**INV:23** — **Sólo los planes mensuales pueden pausarse.**
Se hace cumplir en un **servicio**: `puedePausar()`, un solo lugar (glosario §3, «Dónde vive la
pausa»).
Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b) · también: [V2](10-corte/V2.md#pieza-v2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:66

<a id="inv-24"></a>
**INV:24** — **La pausa puede terminar anticipadamente.**
Se hace cumplir en un **servicio**: [S10](04-catalogos.md#trans-b-s10), el mismo reloj para el fin
previsto y el anticipado ([DEC-SUB-010](01-decisiones-vigentes.md#dec-sub-010)). **Y la vuelta
anticipada sigue libre, a la letra del §26.2**: se acepta que **toda pausa que cruza una fecha de
cobro salteada y termina fuera del aniversario regale días —hasta casi un ciclo, dure lo que dure la
pausa—** (FASE 9 vuelta 1, `N-2`); se declara (`B/03` y `B/12`, *«lo que este capítulo NO
cierra»*) y la detecta el resumen de [DEC-OBS-001](01-decisiones-vigentes.md#dec-obs-001)
(auditoría §4.1, en [02-nucleo-auditoria.md](02-nucleo-auditoria.md)) — owner 2026-09-26, `G5-3`.
Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b) · también: [B11](10-corte/B11.md#pieza-b11) (lee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:67

<a id="inv-30"></a>
**INV:30** — **Sólo `SUPER_ADMIN` otorga *Free Forever*.**
Se hace cumplir en un **servicio**: la autorización de esa operación, y **también la de la cortesía
temporal** ([DEC-GRANT-002](01-decisiones-vigentes.md#dec-grant-002)). **La misma autorización cubre
las otras dos escrituras sobre el instrumento** —anclarle una vertical nueva y revocarlo—, que son la
misma fila del catálogo de acciones ([ACC:2](#acc-2)): si «otorgar» fuera la única autorizada,
extender un grant a una vertical más quedaría sin gate y `SUPER_ADMIN` dejaría de ser exclusivo por la
puerta de al lado.
Pieza dueña del AC: [B9a](10-corte/B9a.md#pieza-b9a) · también: [V5](10-corte/V5.md#pieza-v5) (implementa), [B9b](20-fase-2/B9b.md#pieza-b9b) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:68

### 2.4 Las 37 del §64: las que sostiene un guard (5)

**El 15 y el 16 son la misma invariante enunciada dos veces**, y el modelo de datos explicó por qué su
forma literal es inaplicable: no hay manera de evaluar una capacidad sin nombrarla
([02-nucleo-modelo-y-maquinas.md](02-nucleo-modelo-y-maquinas.md), §1.1 y §1.2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:70, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:80

<a id="inv-12"></a>
**INV:12** — **Rol ≠ acceso activo.**
Se hace cumplir con un **guard**: que ninguna autorización decida sólo por rol.
Pieza dueña del AC: [V5](10-corte/V5.md#pieza-v5).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:74

<a id="inv-13"></a>
**INV:13** — **Rol ≠ entitlement.**
Se hace cumplir con un **guard**: ídem que [INV:12](#inv-12), **y que ninguna construcción del
conjunto efectivo lea un rol** (`V/17` §4.3; FASE 9 vuelta 1, `F-8V1A1-002`).
Pieza dueña del AC: [V5](10-corte/V5.md#pieza-v5).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:75

<a id="inv-15"></a>
**INV:15** — **Toda configuración comercial viene de la base.**
Se hace cumplir con un **guard**. **Reescrito por el modelo de datos**: el catálogo de claves es
código verificado contra la base en las dos direcciones; ningún valor, precio ni asignación vive en
código ([02-nucleo-modelo-y-maquinas.md](02-nucleo-modelo-y-maquinas.md), §1.2 y §1.4).
Pieza dueña del AC: [V1](10-corte/V1.md#pieza-v1) · también: [B2](10-corte/B2.md#pieza-b2) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:76

<a id="inv-16"></a>
**INV:16** — **Los archivos de configuración no son fuente de negocio.**
Se hace cumplir con el mismo guard que [INV:15](#inv-15).
Pieza dueña del AC: [V1](10-corte/V1.md#pieza-v1) · también: [B2](10-corte/B2.md#pieza-b2) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:77

<a id="inv-32"></a>
**INV:32** — **El agrupamiento viejo de Gastronomía y Experiencia no existe, ni como histórico.**
Se hace cumplir con un **guard**: el §55 pide eliminarlo de código, esquema, tipos, tests, docs,
specs, comentarios y naming; es una búsqueda automática, no una revisión. Las cláusulas vigentes:

1. **Sin la excepción histórica del §55.1 y en todo el repositorio** (revisión del owner, 2026-09-28,
   C3, `L2-a` a `L2-c`): los datos que lo nombran se reescriben o se borran, la historia de
   migraciones y el ledger del seed se reemplazan el día del corte por una foto de la base
   (`16-fase-7…` §4.2, paso 6; [30-el-corte.md](30-el-corte.md)), y **el único archivo exento es el
   PDR, por nombre y con la causa escrita**: no se edita.
2. **Lo vigila [G8](04-catalogos.md#guard-g8)** (`V/20` §2), **que hasta el paso 6 lleva esas dos
   historias en una lista de pendientes cerrada** (revisión del owner, casos vecinos, 2026-09-29,
   caso 8) —**la de migraciones sin el carril de extras, que no se reemplaza en el paso 6: los dos
   extras que nombran la palabra, `032` y `033`, los reescribe [U1](10-corte/U1.md#pieza-u1), y un
   extra nuevo que la nombre falla desde el primer día** (FASE 5, owner 2026-09-30, lote 1 H)—, **y
   hasta el cierre de HOS-1352 las carpetas del programa en `.specs/`** (revisión del owner, casos
   vecinos, 2026-09-29, caso H-A).
3. **El paso 6 le saca las dos historias y en el mismo commit enciende la regla que hace fallar un
   build con una de ellas en la lista** (caso F-B); **el commit del cierre le saca la tercera y
   extiende la regla a la lista entera** (caso H-A).
4. **Y ninguna lista de código: el código del sistema viejo sale de la rama al principio de la
   épica** (verificación corta, 2026-09-29, lote N-A; `16-fase-7…` §4.6;
   [DEC-ARCH-014](01-decisiones-vigentes.md#dec-arch-014)).
Adjudicación: fila `MIXTO`, veredicto **VIVO** (cada tachado tiene su reemplazo en la misma celda;
`_trabajo/adjudicacion.json`).
Pieza dueña del AC: [U1](10-corte/U1.md#pieza-u1) · también: [V6](10-corte/V6.md#pieza-v6) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:78

### 2.5 Las 37 del §64: las que son del programa, no del sistema (7)

**Que el §64 mezcle las dos clases no es un defecto del PDR**: las siete son obligaciones reales. Lo
que sí sería un defecto es tratarlas como si fueran verificables sobre el sistema y darlas por
cumplidas porque nadie las contradijo. **Siete de las 37 no se pueden comprobar ejecutando nada.**
Seis de ellas —`INV:17` y `INV:33` a `INV:37`— son **sólo citables**
(owner, letra BA): ninguna pieza las construye y no llevan AC; la lista cerrada está declarada en
[03-contrato-de-cobertura.md](03-contrato-de-cobertura.md). `INV:18` sí tiene pieza.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:83, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:95, .specs/HOS-1352-billing-verticals-redesign/docs/41-corte-del-mvp/10-decisiones-del-owner.md:105

<a id="inv-17"></a>
**INV:17** — **Hospeda gobierna el dominio.**
Qué es en realidad: un **principio de diseño**; orienta el reparto de responsabilidades, no se
comprueba sobre una ejecución. Nivel: **no verificable**.
Sin pieza dueña: sólo citable (owner, letra BA), declarado en [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:87

<a id="inv-18"></a>
**INV:18** — **MP gobierna los hechos ocurridos en MP.**
Qué es en realidad: ídem que [INV:17](#inv-17), un principio de diseño; **su forma operable es la
regla de no-retroceso** (`B/03` §10), y por eso tiene pieza.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:88

<a id="inv-33"></a>
**INV:33** — **No implementar supuestos sobre MP sin pruebas.**
Qué es en realidad: una **regla de método**; es el §58 y su gate es la matriz de validación (las filas
`MP:` de [04-catalogos.md](04-catalogos.md)). Nivel: **no verificable**.
Sin pieza dueña: sólo citable (owner, letra BA), declarado en [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:89

<a id="inv-34"></a>
**INV:34** — **El código legacy dudoso se reescribe.**
Qué es en realidad: una **regla de FASE 5** ([DEC-METH-003](01-decisiones-vigentes.md#dec-meth-003)).
Nivel: **no verificable**.
Sin pieza dueña: sólo citable (owner, letra BA), declarado en [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:90

<a id="inv-35"></a>
**INV:35** — **Sólo se conserva legacy correcto.**
Qué es en realidad: ídem que [INV:34](#inv-34), una regla de FASE 5. Nivel: **no verificable**.
Sin pieza dueña: sólo citable (owner, letra BA), declarado en [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:91

<a id="inv-36"></a>
**INV:36** — **La documentación se mantiene desde el minuto cero.**
Qué es en realidad: una **regla del programa** (§3 del PDR). Nivel: **no verificable**.
Sin pieza dueña: sólo citable (owner, letra BA), declarado en [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:92

<a id="inv-37"></a>
**INV:37** — **Cada handoff reconstruye lo realizado.**
Qué es en realidad: ídem que [INV:36](#inv-36), una regla del programa (§3.3 y §66 del PDR). Nivel:
**no verificable**.
Sin pieza dueña: sólo citable (owner, letra BA), declarado en [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:93

### 2.6 Las 37 del §64: las cinco de subdominio

Los tres de *Free Forever* (27, 28 y 29) y los dos restantes (25 y 31).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:101

<a id="inv-25"></a>
**INV:25** — **El correo nunca controla una transacción de dominio.**
Dónde: el outbox ([02-nucleo-outbox.md](02-nucleo-outbox.md)), con **una excepción decidida**:
[DEC-MAIL-001](01-decisiones-vigentes.md#dec-mail-001) bloquea la acción **sólo antes de cancelar**,
porque ahí el correo del proveedor hace daño. La excepción está declarada y acotada a un caso, y:

- **no bloquea si no hay destinatario** (rebote duro o cuenta borrada, outbox §4.2): ahí se cancela y
  el no-entregable se escala (FASE 8 completa, `F-8CB2-001`, owner 2026-09-25);
- **ni si el correo agotó sus reintentos** (`failed` definitivo, outbox §1.3), con la misma forma
  (owner 2026-09-25; FASE 9 completa, decisión 1).

**Es la única invariante del §64 que una decisión de este programa contradice de frente.** El §43 dice
*«Si falla mail: acción de dominio permanece»*, y `DEC-MAIL-001` decidió que antes de cancelar **sí**
bloquea. El motivo está medido: el correo del proveedor llega primero, con su marca, y dice *«por un
pago no realizado o por opción del vendedor»* —o sea que a alguien que canceló por su voluntad le
llega un aviso que insinúa mora—. La excepción **no debilita la invariante en ningún otro punto**: en
el resto del sistema el correo no bloquea nada. Es además un apartamiento declarado del PDR (§43 y
§64.25).
Pieza dueña del AC: [U2](10-corte/U2.md#pieza-u2).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:105, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:111

<a id="inv-27"></a>
**INV:27** — ***Free Forever* no activa addons automáticamente.**
Dónde: `B/16` §3.2. **Intacta, y con una precisión que hace falta desde
[S20](04-catalogos.md#trans-b-s20)**: lo que el grant no hace solo es **encender** un addon que la
persona no tiene. Convertir a costo $0 uno que **ya tenía comprado** (`B/16` §3.4) no activa nada
—la capacidad ya estaba andando y la persona ya la había elegido, con plata—: lo único automático ahí
es **el fin de un cobro**, y eso la invariante nunca lo prohibió.
Pieza dueña del AC: [B9a](10-corte/B9a.md#pieza-b9a) · también: [B10](20-fase-3/B10.md#pieza-b10) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:106

<a id="inv-28"></a>
**INV:28** — ***Free Forever* puede incluir addons gratis.**
Dónde: ídem, por el flag `includesAddons` (§35.2), y **en sus dos direcciones**: habilita a elegir
addons gratis (`B/16` §3.2) y **lleva a $0 los compatibles que ya se estaban pagando** (`B/16` §3.4).
Con el flag en `false` no pasa ninguna de las dos.
Pieza dueña del AC: [B9a](10-corte/B9a.md#pieza-b9a) · también: [B10](20-fase-3/B10.md#pieza-b10) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:107

<a id="inv-29"></a>
**INV:29** — ***Free Forever* puede tener scope parcial o global.**
Dónde: ídem, y el scope *«todas las futuras»* se permite sin tope
([DEC-PROMO-002](01-decisiones-vigentes.md#dec-promo-002)).
Pieza dueña del AC: [B9a](10-corte/B9a.md#pieza-b9a).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:108

<a id="inv-31"></a>
**INV:31** — **Partner no es self-service.**
Dónde: `V/18`, Partner.
Pieza dueña del AC: [V7](20-fase-4/V7.md#pieza-v7).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:109

### 2.7 Las invariantes que agregan las decisiones (15)

El §64 se escribió antes de las decisiones del log. Éstas no están en su lista y tienen el mismo
peso, porque romperlas rompe algo que ya se decidió. `D14` y `D16` se retiraron
([INV:D14](90-retirados.md#inv-d14), [INV:D16](90-retirados.md#inv-d16)) y sus números no se reusan.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:121, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:123

<a id="inv-d1"></a>
**INV:D1** — **Una suscripción se ancla a una versión de plan, y moverla es un acto explícito.**
De dónde sale: [DEC-ARCH-001](01-decisiones-vigentes.md#dec-arch-001). Dónde se hace cumplir:
**servicio**: ninguna lectura de configuración comercial toma valores del plan, siempre de la versión.
Pieza dueña del AC: [B2](10-corte/B2.md#pieza-b2) · también: [V2](10-corte/V2.md#pieza-v2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:128

<a id="inv-d2"></a>
**INV:D2** — **Dos versiones vendibles y vigentes no comparten `rank` dentro de una vertical.**
De dónde sale: [DEC-ARCH-002](01-decisiones-vigentes.md#dec-arch-002), `V/10` §2. Dónde se hace
cumplir: **base** (y el panel la chequea antes para dar el mensaje: modelo §1.4).
Pieza dueña del AC: [V2](10-corte/V2.md#pieza-v2).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:129

<a id="inv-d3"></a>
**INV:D3** — **Una pausa siempre tiene motivo, y el reloj lee el motivo y nunca al proveedor.**
De dónde sale: [DEC-GRANT-004](01-decisiones-vigentes.md#dec-grant-004). Dónde se hace cumplir:
**base** (dominio cerrado) **+ servicio**. Tiene dos apoyos: necesita que la base restrinja el dominio
del motivo **y** que el servicio lo lea en vez de leer al proveedor.
Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b) · también: [B9b](20-fase-2/B9b.md#pieza-b9b) (implementa), [B4](10-corte/B4.md#pieza-b4) (lee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:130, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:235

<a id="inv-d4"></a>
**INV:D4** — **El candado de idempotencia se persiste ANTES de la primera llamada al proveedor.**
De dónde sale: [DEC-CONC-001](01-decisiones-vigentes.md#dec-conc-001). Dónde se hace cumplir:
**servicio**; si se genera al reintentar, no hay nada que comparar.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3) · también: [B6](10-corte/B6.md#pieza-b6) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:131

<a id="inv-d5"></a>
**INV:D5** — **Toda mutación en el proveedor se verifica releyendo y comparando campo por campo.**
De dónde sale: [EX-20](04-catalogos.md#mp-ex-20), [EX-15](04-catalogos.md#mp-ex-15). Dónde se hace
cumplir: **servicio**: el código de estado **nunca** cierra una mutación.
`D5`, `D9` y `D10` son las tres que más se parecen entre sí y no lo son: `D5` es sobre *verificar*
después de escribir; `D9` y `D10` son sobre *qué se manda* y *qué se muestra*. Las tres existen
porque este proveedor tiene el mismo modo de falla —acepta y no aplica, o devuelve algo que parece
válido y no lo es— en tres momentos distintos.
Pieza dueña del AC: [B1](10-corte/B1.md#pieza-b1).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:132, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:195

<a id="inv-d6"></a>
**INV:D6** — **El buscador del proveedor no es fuente de verdad de nada.**
De dónde sale: [RC-1](04-catalogos.md#mp-rc-1),
[DEC-CONC-002](01-decisiones-vigentes.md#dec-conc-002). Dónde se hace cumplir: **servicio**: el
inventario a conciliar sale de nuestra base.
Pieza dueña del AC: [B11](10-corte/B11.md#pieza-b11).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:133

<a id="inv-d7"></a>
**INV:D7** — **La suscripción vieja se cancela sólo al recibir el webhook de que la nueva quedó
autorizada.**
Y si para entonces su preapproval **ya está cancelado**, `D7` está cumplido y no se lo vuelve a
cancelar ([PA-5](04-catalogos.md#mp-pa-5): re-cancelar da `400`). De dónde sale:
[DEC-SUB-006](01-decisiones-vigentes.md#dec-sub-006). Dónde se hace cumplir: **servicio**; al revés,
el cliente que abandona el checkout se queda sin nada.
Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:134

<a id="inv-d8"></a>
**INV:D8** — **Una fecha de primer cobro futura es la precondición de seguridad de todo cambio de
plan o de ciclo.**
Toda sucesora nace con fecha de primer cobro **posterior al vencimiento de su ventana de
autorización** —**con una sola excepción**: la sucesora de una `SUSPENDED` de pagador con tarjeta
cuyo preapproval se releyó `cancelled` cobra al autorizar, porque ahí no hay otro preapproval que
pueda cobrar ni crédito que cubra la espera (owner 2026-09-25, `B/12` §5.2)—. De dónde sale:
[DEC-SUB-006](01-decisiones-vigentes.md#dec-sub-006). Dónde se hace cumplir: **base**: la fecha
**que el proveedor confirmó** se guarda en `subscription` (`B/02` §2.2), y **un guard** la compara
contra esa ventana; tiene dos apoyos, la columna en base **y** el guard que la compara.
**Por qué subió de servicio a base**: sin una columna que guardara la fecha con la que nació la fila no
había forma de comprobar que se cumplió **ni de escribir el guard**, y su incumplimiento **es
literalmente el doble cobro**. El nivel «base» es el que **no admite ningún camino que lo esquive**, y
es el que corresponde a la precondición del mecanismo más caro del sistema. Releer la fecha del
proveedor no era alternativa: lo prohíbe [INV:D6](#inv-d6) y además un guard tiene que poder correr sin
red.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3) · también: [B8b](20-fase-2/B8b.md#pieza-b8b) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:135, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:187

<a id="inv-d9"></a>
**INV:D9** — **El `reason` que se manda al proveedor es copy para el cliente, nunca un identificador
interno.**
De dónde sale: [EX-19](04-catalogos.md#mp-ex-19),
[DEC-MAIL-001](01-decisiones-vigentes.md#dec-mail-001). Dónde se hace cumplir: **guard**.
Pieza dueña del AC: [B1](10-corte/B1.md#pieza-b1).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:136

<a id="inv-d10"></a>
**INV:D10** — **El `init_point` crudo del proveedor no se muestra nunca sin sanear.**
De dónde sale: [EX-37](04-catalogos.md#mp-ex-37). Dónde se hace cumplir: **guard**.
Pieza dueña del AC: [B1](10-corte/B1.md#pieza-b1).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:137

<a id="inv-d11"></a>
**INV:D11** — **Lo que toca plata lo confirma una persona.**
De dónde sale: [DEC-CONC-001](01-decisiones-vigentes.md#dec-conc-001),
[DEC-CONC-002](01-decisiones-vigentes.md#dec-conc-002),
[DEC-RF-001](01-decisiones-vigentes.md#dec-rf-001). Dónde se hace cumplir: **servicio**.
Pieza dueña del AC: [B5](10-corte/B5.md#pieza-b5) · también: [B6](10-corte/B6.md#pieza-b6) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:138

<a id="inv-d12"></a>
**INV:D12** — **El trial no se le pide al proveedor: el reloj del trial es nuestro.**
De dónde sale: [DEC-TRIAL-002](01-decisiones-vigentes.md#dec-trial-002), `V/03` §2 (el «cap. 03 §2» de
la fuente es el de verticales). Dónde se hace
cumplir: **guard + servicio**: necesita un guard que impida pedirle un trial al proveedor **y** un
servicio que lleve el reloj.
Pieza dueña del AC: [B1](10-corte/B1.md#pieza-b1) · también: [V4](10-corte/V4.md#pieza-v4) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:139, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:238

<a id="inv-d13"></a>
**INV:D13** — **Retirar un plan del catálogo no mueve ninguna suscripción.**
De dónde sale: `B/10` §3.2. Dónde se hace cumplir: **servicio**: retirar publica una versión no
vendible y ninguna lectura de suscripción pasa por la vigente.
Pieza dueña del AC: [B12](20-fase-3/B12.md#pieza-b12).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:140

<a id="inv-d15"></a>
**INV:D15** — **Una sucesión es un compromiso, no dos: a lo sumo una sucesora viva por
`user + vertical`, y una sucesora no puede ser sucedida.**
**Y ninguna sucesión termina sin dejar rastro, con un rastro por forma de terminar**: la que se
**cierra** deja `sucedida_por` puesta en la predecesora; la que **muere sin cerrarse** deja la sucesora
no viva **con su `sucede_a` escrito**. **Nunca las dos columnas en la misma fila.**
De dónde sale: `B/02` §2.2. Dónde se hace cumplir: **base**: los dos índices parciales, partidos por
`sucede_a`, más las dos columnas anulables que no pueden estar puestas a la vez. **Guard**:
[G-R1-C](04-catalogos.md#guard-g-r1-c) (`B/20` §2) exige que las escrituras del cierre vayan juntas y
completas. Tiene dos apoyos.

- **Las seis formas de terminar.** La única escritura de `sucedida_por` es
  [S18](04-catalogos.md#trans-b-s18). De las **seis** formas de terminar que `B/12` §5.3 enumera,
  `S18` corre en **cuatro** —la sucesora autoriza; la sucesión trabada que una persona resuelve por
  [S15](04-catalogos.md#trans-b-s15); la baja que **decide el proveedor** sobre la predecesora (la rama
  5, que entra por el espejo de `B/03` §10.1); y la baja que **pide la propia predecesora** (la rama 6,
  que entra por [S23](04-catalogos.md#trans-b-s23) **o por [S24](04-catalogos.md#trans-b-s24)**, según
  esté suspendida o en el grace, [DEC-SUB-014](01-decisiones-vigentes.md#dec-sub-014))—; en las otras
  dos **no corre**: si la sucesora vence su ventana ([S3](04-catalogos.md#trans-b-s3)) o si le cae un
  grant ([S13](04-catalogos.md#trans-b-s13)), no queda sucesora viva a la que pasarle el origen y
  `sucedida_por` **no se escribe nunca**. Por eso el enunciado nombra **los dos rastros**, y los dos
  son legibles después: `sucedida_por` no se borra nunca, y el `sucede_a` de una fila no viva tampoco
  lo limpia nadie —es el cuarto estado de la relación de `B/03` §3.2, y `S13` lo llama *«el registro
  fiel de lo que pasó»*—.
- `S18` corre además cuando la predecesora se muere sola por [S12](04-catalogos.md#trans-b-s12) o por
  [S16](04-catalogos.md#trans-b-s16), y por [S22](04-catalogos.md#trans-b-s22): esos caminos **no
  están entre las seis**, porque las seis de `B/12` §5.3 enumeran el destino de un **pago pendiente por
  [S19](04-catalogos.md#trans-b-s19)**, que sólo existe sobre una predecesora en `GRACE_PERIOD` o
  `SUSPENDED` —y `S12` sale de `CANCEL_SCHEDULED`, `S16` de `ACTIVE` y `S22` de `PAUSED`—. Escriben la
  columna igual.
- **El apoyo dice lo que la base hace de verdad.** Los dos índices parciales hacen cumplir *«a lo sumo
  una sucesora viva»* y la restricción de las dos columnas hace cumplir que no convivan; **ninguna
  restricción puede obligar a que una columna se escriba**, así que la mitad del rastro es del guard y
  no de la base. Y `G-R1-C` **se cumple de forma vacua cuando no ocurre ninguna de las dos
  escrituras**: un invariante sobre-enunciado es peor que uno ausente, porque quien lo lee **deja de
  buscar el caso** —*«la sucesora se murió y el puntero quedó puesto»*—.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3) · también: [B8b](20-fase-2/B8b.md#pieza-b8b) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:142, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:154, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:156, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:168, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:174, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:180

<a id="inv-d17"></a>
**INV:D17** — **Lo que dice el proveedor no se escribe ni se actúa sin releerlo por id, y se lee el
campo que dice la verdad.**
Son **cinco** entradas y ninguna se salva:

1. **un webhook es un aviso** y se relee el recurso (`B/03` §10.1);
2. **una mutación nuestra** se confirma releyendo ([INV:D5](#inv-d5));
3. **un job que actúa por nuestro reloj** sobre algo que depende del estado del proveedor **le
   pregunta antes de actuar** ([S3](04-catalogos.md#trans-b-s3), [S6](04-catalogos.md#trans-b-s6),
   [A3](04-catalogos.md#trans-b-a3));
4. **un acto del cliente cuya condición depende de ese estado** ([S1](04-catalogos.md#trans-b-s1),
   sobre su predecesora **y sobre la `CHARGE_DECLINED` de ese `user + vertical`**; FASE 9 vuelta 1,
   `F-8V1D1-003` y `F-8V1B1-003`);
5. **una acción administrativa cuya condición depende de ese estado** (devolver, asentar un pago de
   afuera, cancelar, pausar, cambiar de plan, migrar) **relee antes de actuar**, como el job y el acto
   del cliente (revisión del owner, 2026-09-28, N4 y `L3-f`).

**La regla tiene un control automático, [G17](04-catalogos.md#guard-g17)** (`B/20` §2): falla si una
decisión sale de lo que dice un aviso sin releer por id, en las transiciones y en las acciones
administrativas; comprueba **de dónde** sale el estado con que se decide y no **cuándo** se leyó.
**El cuándo va dentro del tipo** (revisión del owner, casos vecinos, 2026-09-29, caso 35): cada
lectura por id del adaptador lleva su instante, y **la decisión rechaza una lectura anterior al
comienzo del acto**, que es el de la decisión sobre ese sujeto (en una acción administrativa, el de
su confirmación), no el de la corrida: un proceso nocturno que leyó 500 a las 3:00 y llega a Juan a
las 3:40 lo tiene que releer.

**Límite declarado**: entre releer y actuar queda una ventana de milisegundos, porque Mercado Pago no
ofrece compare-and-swap, y la cubre el barrido (`B/09`). *«¿Cobró o no?»* se contesta **sólo** con
esta lectura, cobro por cobro: **«cobró» sólo si hay un registro del período con `payment.status` =
`approved`, leído por id** con `GET /authorized_payments/{id}`; **nunca** del `status` del registro
(`scheduled`, `recycling`, `processed` dicen la etapa, no el resultado: [RC-6](04-catalogos.md#mp-rc-6)),
ni del `status_detail` leído temprano (es el del último intento y cambia entre reintentos), ni de
`charged_quantity` (cuenta intentos: [RC-5](04-catalogos.md#mp-rc-5)), ni de `last_charged_date` (se
mueve con un cobro rechazado). **«No cobró» sólo si el inventario está completo** —`charged_quantity`
igual a los registros listados— **y ninguno está aprobado**. **Cualquier otra cosa es «todavía no se
sabe»**: no es divergencia, se relee en la corrida siguiente, y quien necesita actuar (`S6`) la trata
como lectura fallida y no actúa en esa corrida. `charged_amount` no decide; sirve para verificar a
mano. **Un registro que el listado devuelve y cuya lectura por id da `404`**
([EX-55](04-catalogos.md#mp-ex-55): el alta que el proveedor canceló al rechazar el primer cobro) **se
contesta con el pago que el listado nombra, leído por id** con `GET /v1/payments/{id}`: `approved` es
*«cobró»*, cualquier otro estado es *«intentó y se rechazó»*, y esa lectura es la que dispara
[S16](04-catalogos.md#trans-b-s16). **No es una lectura fallida de la corrida**; si el listado no
nombra pago, o esa lectura también falla, sí lo es. (Origen: `B/09` §4,
.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:989, :996, :1000, :1001, :1003)

**Excepciones declaradas**:

- el barrido de creaciones sin respuesta busca **filtrando en el proveedor sólo por correo del
  pagador, y el estado de nuestro lado** —el filtro `status` devuelve un subconjunto en producción
  ([RC-1](04-catalogos.md#mp-rc-1); FASE 8 completa, `F-8CB3-011`, `F-8CB2-014`, `F-8CB1-014`)—,
  porque es la única forma de encontrar lo que nunca registramos
  ([DEC-CONC-001](01-decisiones-vigentes.md#dec-conc-001), `B/05` §1.2);
- *«¿qué intentos hubo?»* se lee del listado `GET /authorized_payments/search?preapproval_id=`
  ([EX-16](04-catalogos.md#mp-ex-16)), que **no** es una lectura por id —es la única forma de conocer
  los ids—; cada id se relee después por id, y la completitud del listado se comprueba contra
  `charged_quantity`: mientras no iguala, la respuesta es *«todavía no se sabe»* y a los 3 días abre
  marca (`B/09` §4 y §6, punto 2; owner 2026-09-25, 3d; FASE 9 completa, la mitad de `F-8CB3-004` que
  la decisión 3d no cubre).

**Y la comparación de cambios sin aviso del barrido lee `last_modified`, no `version`**: la lectura
por id no trae `version` ([RC-9](04-catalogos.md#mp-rc-9); `F-8CB3-010`).

De dónde sale: pedido del owner, 2026-09-24 · [RC-1](04-catalogos.md#mp-rc-1),
[RC-2](04-catalogos.md#mp-rc-2), [RC-5](04-catalogos.md#mp-rc-5), [EX-20](04-catalogos.md#mp-ex-20).
Dónde se hace cumplir: **servicio + guard** (`G17`, revisión del owner, 2026-09-28, `L3-f`): necesita
que el servicio relea en el acto **y** el guard que impide decidir con un estado que no salió de una
lectura por id.
Pieza dueña del AC: [B1](10-corte/B1.md#pieza-b1).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:144, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:240

### 2.8 La pausa que vence sin reanudar

Con `D16` retirado (revisión del owner, 2026-09-28, C14: la pausa del dueño detiene el reloj de
retención, así que no hay desigualdad que vigilar), **lo que sigue en pie es la segunda premisa, que
nunca fue de `D16`**: una pausa que vence y no reanuda deja la fila en `PAUSED`, y eso deja además el
reloj de retención detenido sin fin. Se sigue vigilando donde se puede ver: la rama de fallo de
[S10](04-catalogos.md#trans-b-s10) y la quinta comprobación de cero llamadas de `B/09` §3.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:148, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:149

### 2.9 Lo que ninguna invariante cubre todavía

Tres cosas que el §64 no nombra, que ninguna decisión había resuelto al escribirse (la primera la
cerró después `B/16` §4), y que **no se completan acá** (§67):

1. **Cerrado: qué pasa cuando una suscripción principal muere y quedan complementos vivos.** Lo
   cierra `B/16` §4 (*«Cuando un addon se apaga · cierra `E-ADDON-04`»*), con
   [DEC-ADDON-004](01-decisiones-vigentes.md#dec-addon-004) y
   [DEC-ADDON-007](01-decisiones-vigentes.md#dec-addon-007) (`04-open-decisions.md`, `E-ADDON-04`
   tachado; residuo corregido el 2026-10-02).
2. **Una vertical discontinuada: fuera de esta versión** (revisión del owner, 2026-09-28, C8): las
   verticales no se discontinúan; si algún día hace falta, se diseña entonces. `D14` se retiró;
   [INV:D13](#inv-d13), retirar un plan, sigue.
3. **Si el silencio del cliente vale como aceptación de un aumento.** Es `M-LEGAL-03`, y **cambia el
   diseño, no la redacción**: si no alcanza, [DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002)
   necesita aceptación activa y a quien no responda no se lo puede aumentar. `B/22`, y pide revisión
   profesional.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:202, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:204, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:210, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:213, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:217

### 2.10 El resumen del reparto

| nivel | cuántas del §64 | cuántas de las decisiones |
|---|---|---|
| base | 6 | **4** |
| servicio | 14 | **10** |
| guard | 5 | **6** |
| principio o regla de método, **no verificable ejecutando** | 7 | 0 |
| en un capítulo de subdominio | 5 | 0 |
| **total** | **37** | **15** |

La columna de las decisiones suma **20 apoyos sobre 15 invariantes**, y no es un error de conteo:
**`D3`, `D8`, `D12`, `D15` y `D17` se sostienen en dos niveles a la vez** (base `D2 D3 D8 D15`; guard
`D8 D9 D10 D12 D15 D17`; servicio `D1 D3 D4 D5 D6 D7 D11 D12 D13 D17`). Una invariante con dos apoyos
no está contada de más: está apoyada dos veces. La columna del §64 cierra: 6 + 14 + 5 + 7 + 5 = 37.

**Cincuenta y dos invariantes (37 + 15), y diez las sostiene la base.** El resto depende de que exista
un único lugar donde se evalúen, que es, en una línea, de qué se trata el §7.

**Los conteos se recorren enteros con un script, o no se tocan.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:223, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:225, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:234, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:243, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:252, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:313

---

## 3. El catálogo de acciones administrativas

El §48 del PDR enumera veintiuna cosas que el admin debe poder **inspeccionar** y **ninguna que pueda
hacer**, aunque el resto del PDR se las asigna. Este catálogo las nombra (cierra `M-ADMIN-01`).
**Cada acción lleva tres cosas: permiso propio, registro de auditoría, y confirmación explícita si es
destructiva o mueve dinero.** Qué es un evento auditable, la baja de cuenta manual y las dos reglas
sobre la confirmación están en [02-nucleo-auditoria.md](02-nucleo-auditoria.md).

**La numeración.** Cada acción es un ítem `ACC:n`, numerado por su posición en la tabla de la fuente.
Las fuentes, en cambio, citan las acciones por un ordinal de prosa (*«la acción 22»*, *«la
vigesimocuarta»*) que **no coincide en dos filas** (nota N1): la que las fuentes llaman *«acción 13»*
o *«la decimotercera»* (moderar; su permiso es `AUT-113`) es [ACC:12](#acc-12), y
[ACC:13](#acc-13) (reembolsar) no tiene número en las fuentes; **desde la 14, el número de las fuentes
y el `ACC:n` coinciden**. La decimosexta (discontinuar una vertical) salió con la revisión del owner,
2026-09-28, C8, y su número no se reusa ([ACC:16](90-retirados.md#acc-16)).

**La tabla tiene veinticinco filas vivas, y cada fila es UNA acción, aunque varias nombren más de una
escritura.** *«Otorgar o revocar»*, *«pausar o reanudar»*, *«pedir un arreglo, bajar, cambiar de
nivel o levantar»* (la de moderar, en dos niveles: revisión del owner, 2026-09-28, C10), *«aprobar,
rechazar o anular la espera»* (una postulación de Partner; FASE 9 vuelta 2, `R7`), *«otorgar, anclar
o revocar»*, *«moderar o levantar la moderación»* —**sobre una ficha o sobre la presencia de un
Partner, que es la misma acción con el mismo permiso** (7c)—, *«asentar un cobro o una devolución»*,
*«migrar o cancelar una migración»* (revisión del owner, 2026-09-28, C15), *«crear o cerrar»* un código
promocional y *«publicar o retirar»* una versión de plan o de complemento (la misma revisión, N1,
`L1-f`), y *«asignar o quitar»* el rol `SUPER_ADMIN` (FASE 9 vuelta 3, owner 2026-09-30, lote AC;
verificación, VC3-VT-03) son la misma acción sobre el mismo instrumento, con **un** permiso. Las
líneas que cuantifican sobre esta tabla —`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 y su ⚠️, §3.5, y
`B/19` §6— **dicen veinticinco**.

**Lo que no se puede es ejecutar una escritura que no esté nombrada en ninguna fila**: una escritura
sin fila no tiene permiso que pedir, no es capacidad del actor —así que sus pasos 5 a 7 caen sobre el
sujeto y la vuelven inejecutable; **las filas lo son todas menos [ACC:15](#acc-15) y [ACC:23](#acc-23),
que se evalúan sobre el sujeto a propósito** (FASE 9 vuelta 2, `F-8V2A1-004`; las cinco del catálogo
también son capacidad del actor: su sujeto es el catálogo, no un cliente, revisión del owner,
2026-09-28, N1; la vigesimotercera, revisión del owner, casos vecinos, 2026-09-29, caso F-C)— y **no le
está prohibida a un actor de sistema**, que son las tres cosas que esta tabla reparte. Por eso anclar
una vertical a un grant entra **acá** y no sólo en la prosa del contrato que lo declaró.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:181, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:183, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:186, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:220, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:226, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:230, .specs/HOS-1352-billing-verticals-redesign/docs/37-fase-8-vuelta-3/D1-coherencia-del-conjunto.md:264

### 3.1 Las acciones

<a id="acc-1"></a>
**ACC:1** — **Otorgar o revocar una cortesía temporal**, **en meses enteros y sólo sobre un plan
mensual**; sobre uno **no mensual —trimestral, semestral o anual—** no está disponible (FASE 8
completa, `F-8CB1-001`; `B/14` §4.7; *«no mensual»* donde antes decía *«anual»*, corregido en la
FASE 9 completa, contradicción 1 de `R4`). **Revocar es reanudar antes del fin: corre
[S10](04-catalogos.md#trans-b-s10) por su tercer evento, con `fin_real`, la relectura, sin
reembolso y con el aviso a la persona; lo construye [B9b](20-fase-2/B9b.md#pieza-b9b)** (corte del
MVP, owner 2026-10-02, BO).

- **De dónde sale**: §34, [DEC-GRANT-002](01-decisiones-vigentes.md#dec-grant-002),
  [DEC-GRANT-003](01-decisiones-vigentes.md#dec-grant-003) implicación 6.
- **¿Destructiva o mueve dinero?** **Sí**: revocar deja al cliente sin la cortesía que le quedaba.
  **Re-emitir una cortesía diferida NO es esta acción**: lo hace [S9](04-catalogos.md#trans-b-s9) como
  efecto, con la firma original, y va en la tabla del enrutado (§3.3) —**y CERRAR su saldo tampoco**,
  que es el efecto opuesto y lo hace [S3](04-catalogos.md#trans-b-s3)
  ([DEC-GRANT-011](01-decisiones-vigentes.md#dec-grant-011))—.
- Adjudicación: fila `MIXTO`, veredicto **VIVO** (reemplazo explícito de *«anual»* por *«no
  mensual»*).
Pieza dueña del AC: [B9b](20-fase-2/B9b.md#pieza-b9b) · también: [B3](10-corte/B3.md#pieza-b3) (provee), [B9a](10-corte/B9a.md#pieza-b9a) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:191

<a id="acc-2"></a>
**ACC:2** — **Otorgar, anclarle una vertical nueva, o revocar un grant permanente.**

- **De dónde sale**: §35, §35.4, `12-contrato…` §2.8 (en
  [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)).
- **¿Destructiva o mueve dinero?** **Sí, y la más grave**: revocar deja al cliente **sin grant y sin
  suscripción**, o sea sin servicio, hasta que autorice un débito nuevo
  ([DEC-GRANT-001](01-decisiones-vigentes.md#dec-grant-001)). **Anclar también mueve dinero**: concede
  servicio gratuito permanente en una vertical nueva y **cancela la suscripción que el beneficiario
  pagaba ahí** ([S13](04-catalogos.md#trans-b-s13), `B/03` §3.2) —**y, con `includesAddons: true`, la
  de cada addon compatible que venía pagando** ([S20](04-catalogos.md#trans-b-s20), `B/16` §3.4)—.
- Sólo `SUPER_ADMIN` la ejecuta, en sus tres escrituras ([INV:30](#inv-30)).
Pieza dueña del AC: [B9a](10-corte/B9a.md#pieza-b9a) · también: [B13a](10-corte/B13a.md#pieza-b13a) (implementa; las filas 13 y 13-bis de `B/19` §4 que confirman esta acción van a `B13a`, owner letra BH).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:192

<a id="acc-3"></a>
**ACC:3** — **Registrar un pago manual**, **también la transferencia que no cae en ninguna cuota
abierta**, que [MP6](04-catalogos.md#trans-b-mp6) asienta como un segundo pago del mismo período y que
abre `COBRO_DUPLICADO` con propuesta de devolver (`B/03` §7; FASE 9 vuelta 3, owner 2026-09-30, lote
W): es esta fila y no una nueva, como [MP4](04-catalogos.md#trans-b-mp4).

- **De dónde sale**: §30.
- **¿Destructiva o mueve dinero?** **Sí.**
Pieza dueña del AC: [B5](10-corte/B5.md#pieza-b5).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:193

<a id="acc-4"></a>
**ACC:4** — **Confirmar que no se pagó.**

- **De dónde sale**: §30.
- **¿Destructiva o mueve dinero?** **Sí**: lleva a `SUSPENDED` sin esperar el reloj.
Pieza dueña del AC: [B5](10-corte/B5.md#pieza-b5) · también: [B7](10-corte/B7.md#pieza-b7) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:194

<a id="acc-5"></a>
**ACC:5** — **Aprobar o rechazar una postulación de Partner, o anular la espera tras un rechazo**, para
que el dueño real de un correo cargado por un tercero pueda postularse (`V/18` §2.2; owner 2026-09-27,
FASE 9 vuelta 2, `R7`).

- **El rol de socio no lo asigna aprobar: lo asigna el acto que fija al dueño de la presencia, el
  reclamo**, porque al aprobar todavía no se sabe cuál es la cuenta del dueño (FASE 5, lote de la
  aplicación, owner 2026-09-30, F).
- **El alta directa de un Partner por el admin no fija dueño: manda el aviso de reclamo, y el rol llega
  con el reclamo** (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, N), con su familia
  de operaciones y sus permisos, que es por lo que pregunta el paso 3 de la cadena sobre las acciones
  de un Partner.
- **Y ese rol no se quita** cuando el socio pierde su presencia, porque perder el acceso nunca revoca
  un rol (`V/17` §4.1) (FASE 5, owner 2026-09-30, lote 4 B, contra la recomendación, que era declarar
  el paso 3 vacuo para Partner).
- **De dónde sale**: §17.3.
- **¿Destructiva o mueve dinero?** No.
- Adjudicación: fila `MIXTO`, veredicto **VIVO** (tachado y reemplazo explícitos, lotes F y N).
Pieza dueña del AC: [V7](20-fase-4/V7.md#pieza-v7) · también: [V8b](20-fase-4/V8b.md#pieza-v8b) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:195

<a id="acc-6"></a>
**ACC:6** — **Configurar el plan y el método de pago de un Partner.**

- **De dónde sale**: §17.3. La construye [V7](20-fase-4/V7.md#pieza-v7), sobre el pago manual de
  [B5](10-corte/B5.md#pieza-b5) (owner, letra BC,
  [DEC-ARCH-017#📌4](01-decisiones-vigentes.md#dec-arch-017-p4)).
- **¿Destructiva o mueve dinero?** Sí.
Pieza dueña del AC: [V7](20-fase-4/V7.md#pieza-v7) · también: [B5](10-corte/B5.md#pieza-b5) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:196

<a id="acc-7"></a>
**ACC:7** — **Levantar la marca `requiere_conciliación`.**

- **De dónde sale**: §22.1.
- **¿Destructiva o mueve dinero?** Según el caso, **y el caso lo dice el `motivo` de la marca**, que es
  una columna (`B/02` §2.5; los motivos son los `MOT:n` de [04-catalogos.md](04-catalogos.md)). Se
  levanta **una marca, no la fila**: son **veinticuatro** motivos (el 23 y el 24 desde la FASE 9 vuelta
  2, `R4` y `R20`; el 16 desde `F-8CB1-013`, y el 17, el 18 y el 19 desde `F-8CB3-009`,
  [DEC-SUB-020](01-decisiones-vigentes.md#dec-sub-020) y `F-8CB3-003`, FASE 8 completa, owner
  2026-09-25; el 20 desde la pendiente 6; el 21 y el 22 desde la FASE 9 completa —`B/02` §2.5:
  `COBRO_DEL_PERÍODO_SIN_RESOLVER`, decisión 3d, y `PAUSA_NO_APLICADA`, `F-8CB2-003`—) y **nueve**
  tienen una confirmación de reembolso encima, **y los nueve se leen en el motivo, sin mirar nada
  más**, desde que [DEC-RF-006](01-decisiones-vigentes.md#dec-rf-006) partió en dos el que
  [DEC-RF-004](01-decisiones-vigentes.md#dec-rf-004) había dejado dependiendo del disparador.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3) · también: [B13a](10-corte/B13a.md#pieza-b13a) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:197

<a id="acc-8"></a>
**ACC:8** — **Cancelar una suscripción.**

- **De dónde sale**: §24.
- **¿Destructiva o mueve dinero?** **Sí, e irreversible en el proveedor** ([PA-5](04-catalogos.md#mp-pa-5)).
  **Con motivo revocación del derecho de arrepentimiento es la misma acción y corre
  [S36](04-catalogos.md#trans-b-s36)** (`B/03` §3.2): cancela, corta el servicio en el acto y crea
  [RF1](04-catalogos.md#trans-b-rf1) por el total, así que su confirmación dice las tres cosas (owner
  2026-09-26, `G5-4`).
- Es además el paso 1 de la baja de cuenta manual (auditoría §1.3).
Pieza dueña del AC: [B5](10-corte/B5.md#pieza-b5) · también: [B8a](10-corte/B8a.md#pieza-b8a) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:198

<a id="acc-9"></a>
**ACC:9** — **Pausar o reanudar.**

- **De dónde sale**: §26.
- **¿Destructiva o mueve dinero?** Sí.
Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:199

<a id="acc-10"></a>
**ACC:10** — **Cambiar de plan a un cliente.**

- **De dónde sale**: §27, §28.
- **¿Destructiva o mueve dinero?** Sí.
Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:200

<a id="acc-11"></a>
**ACC:11** — **Extender un trial**: **la cortesía durante el trial**, la misma que `V/11` §3.4 llama
*«extensión firmada por `SUPER_ADMIN`»*. Es **de verticales**, sobre su propia máquina y **fuera del
contrato**: corre [T4](04-catalogos.md#trans-v-t4) con origen `SUPER_ADMIN` y **motivo obligatorio**,
**pasa el techo** ([PLAZO:7](#plazo-7)) y suma al total acumulado visible con su origen (`V/11` §3.5);
la construye [V4](10-corte/V4.md#pieza-v4), y `extenderTrial` sigue siendo sólo del canje (owner
2026-09-26, P2; FASE 9 vuelta 1). No es la fila de la cortesía temporal ([ACC:1](#acc-1)): ésa va en
meses enteros sobre un plan mensual, y ésta en días.

- **De dónde sale**: §34.1, `V/11` §3.4 (el §32 es el canje self-service; FASE 9 vuelta 1, P2).
- **¿Destructiva o mueve dinero?** No.
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:201

<a id="acc-12"></a>
**ACC:12** — **Moderar una ficha o levantar la moderación** —[PB10](04-catalogos.md#trans-v-pb10) y
[PB11](04-catalogos.md#trans-v-pb11), `V/03` §9—, **con motivo** en el campo *«por qué»* del evento
auditable (auditoría §1.2). **Nota N1: las fuentes la llaman «acción 13» o «la decimotercera» (su
permiso es `AUT-113`)**; `ACC:13` no tiene número en las fuentes, y desde la 14 coinciden
(`37-fase-8-vuelta-3/D1-coherencia-del-conjunto.md:264`).

- **En dos niveles y cambiable en las dos direcciones** (revisión del owner, 2026-09-28, C10, `L2-i`):
  **pedir un arreglo sin bajar la ficha** (abre la marca *«pedido de arreglo»*, que no es un estado,
  `V/02` §2.5), **bajarla** (`PB10`), **cambiar de nivel** (de pedido a baja por `PB10`, o de baja a
  sólo pedido por `PB11`/[PB13](04-catalogos.md#trans-v-pb13)) **o levantar** (`PB11`/`PB13`, y cerrar
  el pedido); **sigue siendo una acción con un permiso**.
- **Y sobre la presencia de un Partner, con el mismo permiso y sin los dos niveles, que son sólo de la
  ficha** (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30,
  [G](01-decisiones-vigentes.md#own-39-fases-6-y-7-t1-g); `V/descomposicion.md` §2, fila `V6`; residuo
  corregido el 2026-10-02): escribe su bit de moderación (`V/18` §1.6; owner 2026-09-25, FASE 9
  completa, decisión 7c).
- **De dónde sale**: FASE 8 completa, `F-8CA2-004`, owner 2026-09-25.
- **¿Destructiva o mueve dinero?** **No mueve dinero ni borra**: la ficha pasa a `MODERATED` y su
  contenido se conserva, **y levantar la moderación reinicia el reloj de inactividad** (el hecho 6 de la
  inactividad, glosario §1.2; FASE 9 completa, decisión 5b), así que la frase es verdadera también
  después: antes, `PB11` → [PB5](04-catalogos.md#trans-v-pb5) → [PB9](04-catalogos.md#trans-v-pb9)
  borraba en días (`K-6`). **Si lleva confirmación explícita no lo dice la decisión**, y queda declarado
  con su causa ([DEC-METH-015](01-decisiones-vigentes.md#dec-meth-015)).
Pieza dueña del AC: [V6](10-corte/V6.md#pieza-v6) · también: [V7](20-fase-4/V7.md#pieza-v7) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:202, .specs/HOS-1352-billing-verticals-redesign/docs/37-fase-8-vuelta-3/D1-coherencia-del-conjunto.md:264

<a id="acc-13"></a>
**ACC:13** — **Reembolsar.** (Sin número en las fuentes: nota N1 en [ACC:12](#acc-12).)

- **De dónde sale**: [DEC-RF-001](01-decisiones-vigentes.md#dec-rf-001) ·
  [DEC-RF-002](01-decisiones-vigentes.md#dec-rf-002).
- **¿Destructiva o mueve dinero?** **Sí, sin excepción**: `DEC-RF-002` resolvió el único caso que el
  diseño tenía candidato a excepción —el reembolso del pago pendiente al cerrar una sucesión— **a favor
  de la confirmación**. No hay ninguna operación automática sobre dinero. **Confirmar es la transición
  `REQUESTED → CONFIRMED` del reembolso, [RF2](04-catalogos.md#trans-b-rf2)** (glosario §2.2, `B/03`
  §6.1; FASE 9 completa, 5a).
Pieza dueña del AC: [B6](10-corte/B6.md#pieza-b6) · también: [B5](10-corte/B5.md#pieza-b5) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:203

<a id="acc-14"></a>
**ACC:14** — **Asentar un cobro o una devolución que ya ocurrió fuera de nuestro flujo**: el cobro del
motivo 19 (`COBRO_SIN_REGISTRAR`, [MOT:19](04-catalogos.md#mot-19)): crear la fila de `payment` en
`PENDING` con el id del registro y correr [P1](04-catalogos.md#trans-b-p1) sobre ella; la devolución
del motivo 18 (`REEMBOLSO_FUERA_DEL_FLUJO`, [MOT:18](04-catalogos.md#mot-18)), la de un
`manual_payment` o la del cobro más viejo que el plazo del proveedor: asentar el `refund` por
**[RF4](04-catalogos.md#trans-b-rf4)**, que nace en `EXECUTED` con el comprobante de la transferencia
o la referencia del panel (`B/03` §6.1).

- **De dónde sale**: motivos 18 y 19 de `B/02` §2.5, `F-8CB1-015`; owner 2026-09-25, FASE 9 completa,
  decisión 5a.
- **¿Destructiva o mueve dinero?** **Sí**: registra plata que ya se movió y lo que de eso se desprende
  —el comprobante, `covered_period`, el cierre del reembolso—. Sin esta fila las dos marcas mandaban a
  una persona a *«asentar»* con un acto que la tabla no nombraba, y lo que no se puede es ejecutar una
  escritura que no esté nombrada en ninguna fila.
Pieza dueña del AC: [B5](10-corte/B5.md#pieza-b5) · también: [B13a](10-corte/B13a.md#pieza-b13a) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:204

<a id="acc-15"></a>
**ACC:15** — **Editar el contenido de una ficha ajena** —crearla en borrador a nombre de su dueño,
corregirla, restaurar contenido—, **sin publicar, sin destacar y sin borrar**, que siguen siendo del
dueño o de sus filas (publicar es [PB1](04-catalogos.md#trans-v-pb1) del dueño, destacar es un addon y
borrar es [PB9](04-catalogos.md#trans-v-pb9) o [PB12](04-catalogos.md#trans-v-pb12)). **El *«sin
borrar»* vale para la edición de contenido**: borrar la ficha a pedido de su dueño es otra fila,
[ACC:23](#acc-23), con su permiso (revisión del owner, casos vecinos, 2026-09-29, caso F-C).

- **De dónde sale**: owner 2026-09-26, `G5-2`; FASE 9 vuelta 1, `F-8V1A1-003`.
- **¿Destructiva o mueve dinero?** **No mueve dinero ni borra**: escribe contenido de lo ajeno y su
  dueño recibe **el aviso de la fila 26 de `V/19` §4 y el correo *«contenido de tu ficha editado por
  soporte»* del catálogo de correos** ([02-nucleo-outbox.md](02-nucleo-outbox.md), §6) (FASE 9 vuelta
  2, `F-8V2D1-002`).
- **Es la única fila, con la vigesimotercera, que no es capacidad del actor: sus pasos 5 a 7 se evalúan
  sobre el sujeto, el dueño de la ficha**, así que soporte no le deja la ficha por encima de su cupo
  (`V/17` §3.2 regla 3; FASE 9 vuelta 2, `F-8V2A1-004`).
- Es la herramienta de soporte que el código de hoy tiene sin fila —crear a nombre de un dueño,
  corregir, restaurar—, y sin ella la presión empujaba a pedirle la contraseña al cliente, que es la
  impersonación que `V/17` §3.2 regla 4 prohíbe. **Si lleva confirmación explícita no lo dice la
  decisión**, y queda declarado con su causa
  ([DEC-METH-015](01-decisiones-vigentes.md#dec-meth-015)).
Pieza dueña del AC: [V8a](10-corte/V8a.md#pieza-v8a) · también: [V5](10-corte/V5.md#pieza-v5) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:205

<a id="acc-17"></a>
**ACC:17** — **Migrar a los clientes de un plan retirado** a una versión vigente y vendible de la misma
vertical, **o cancelar una migración anunciada**, **sólo `SUPER_ADMIN`** (`B/10` §3.7).

- **De dónde sale**: revisión del owner, 2026-09-28, C15, `L1-g` y `L1-h`.
- **¿Destructiva o mueve dinero?** **Sí**: le cambia el precio y las capacidades a cada cliente
  alcanzado en su renovación ([S37](04-catalogos.md#trans-b-s37) le muta el monto sobre su
  autorización, `B/03` §3.2), así que su confirmación **muestra a cada uno** con subida o bajada, su
  precio actual y el nuevo, y su fecha. **Cancelarla no mueve plata**: frena lo que todavía no se
  aplicó y avisa *«ya no cambia nada»*. **Es la decimoséptima y no la decimosexta**: el número de la que
  salió (discontinuar una vertical) no se reusa. **Y sigue siendo una fila propia, aparte de publicar
  una versión de plan** ([ACC:18](#acc-18)): mueve a clientes ya anclados, con su aviso y su fecha, y
  publicar no mueve a nadie (revisión del owner, casos vecinos, 2026-09-29, caso 22). **Si la cohorte
  incluye la cuenta de quien la lanza, esa fila se excluye y el acto sigue** (`V/17` §3.2 regla 5;
  caso 24). El aviso previo es el [PLAZO:12](#plazo-12).
Pieza dueña del AC: [B12](20-fase-3/B12.md#pieza-b12) · también: [B3](10-corte/B3.md#pieza-b3) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:207

<a id="acc-18"></a>
**ACC:18** — **Publicar una versión de plan**: crear un plan, publicar una versión nueva con lo que
otorga, sus entitlements y limits, su `rank`, vigente y vendible, sus días de prueba, su gracia y su
pausa; retirarla, que es publicar una no vendible (`B/10` §3); o deshacer el retiro. **Sólo
`SUPER_ADMIN`.**

- **De dónde sale**: revisión del owner, 2026-09-28, N1, `L1-f`; modelo de datos §1.4
  ([02-nucleo-modelo-y-maquinas.md](02-nucleo-modelo-y-maquinas.md)).
- **¿Destructiva o mueve dinero?** **Sí, y la de más alcance del catálogo**: cambia qué se vende y qué
  recibe quien quede anclado a la versión nueva. Su confirmación dice **qué cambia contra la versión
  vigente, clave por clave**, y a cuántos clientes alcanza. **Rechaza lo que antes miraba un guard de
  CI**: [G-R3](04-catalogos.md#val-g-r3), un `rank` repetido entre las vendibles y vigentes de la
  vertical, un plan sin exactamente una versión vigente, los días de prueba de una vertical que pasan
  de cero a más o al revés (`V/11` §8) y una gracia que no es menor que el ciclo más corto que la
  versión ofrece (modelo §1.4). **Un cliente anclado a la versión vieja no cambia por esto**: cambia
  por un aumento ([DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002)) o por [ACC:17](#acc-17). **Es
  la decimoctava.**
Pieza dueña del AC: [V2](10-corte/V2.md#pieza-v2) · también: [V8a](10-corte/V8a.md#pieza-v8a) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:208

<a id="acc-19"></a>
**ACC:19** — **Fijar el precio de un ciclo**, el monto de una `billing_option` de una versión de plan
(`B/02` §2.1). **Sólo `SUPER_ADMIN`.**

- **De dónde sale**: revisión del owner, 2026-09-28, N1, `L1-f`.
- **¿Destructiva o mueve dinero?** **Sí, mueve plata**: sobre una versión de plan **sin clientes** fija
  el precio; sobre una **con clientes se rechaza y se publica una versión nueva**, que rige para las
  altas nuevas ([DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002), parte 1); **y cuenta como cliente de
  una versión la fila con un `S38` encolado hacia ella, un descenso ya pedido** (corte del MVP, owner
  2026-10-02, [CC](01-decisiones-vigentes.md#own-41-corte-del-mvp-t12-cc); `B/12` §3.2). El aviso y la
  mutación a
  los clientes ya anclados (parte 2) llegan con [B12](20-fase-3/B12.md#pieza-b12): una migración a la
  versión nueva por `S37` y `S38` con el motivo *«aumento»*, con la fecha y los contactos del
  [PLAZO:11](#plazo-11) (corte del MVP, owner 2026-10-02,
  [BZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-bz)). Su confirmación dice **el precio
  anterior y el nuevo, el ciclo, a cuántos clientes alcanza y desde cuándo**. Rechaza un monto menor
  que ARS 15 (`DEC-MP-001`, implicación 4) y un ciclo que no sea mayor que la gracia de la versión
  (modelo §1.4). **Su uso queda vedado hasta el momento 5 del corte**: es una regla de operación, no un
  control del código (corte del MVP, owner 2026-10-02,
  [BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm)). **Es la decimonovena.** (Origen: 📌 BM y
  📌 BZ de `DEC-MP-002`, `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1463-1479`)
Pieza dueña del AC: [B2](10-corte/B2.md#pieza-b2) · también: [B13a](10-corte/B13a.md#pieza-b13a) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:209

<a id="acc-20"></a>
**ACC:20** — **Publicar una versión de complemento**: crear un complemento, publicar una versión con
lo que otorga, su tipo de scope, sus verticales compatibles y su precio, o retirarla. **Sólo
`SUPER_ADMIN`.**

- **De dónde sale**: revisión del owner, 2026-09-28, N1, `L1-f`; `B/16`.
- **¿Destructiva o mueve dinero?** **Sí**: fija qué se vende y a qué precio. Su confirmación dice qué
  cambia contra la versión vigente; lo ya comprado sigue anclado a su versión (`políticaDeAddon`,
  [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md), §4.1). **Escribe en las dos épicas,
  cada mitad en la suya** (FASE 9 vuelta 3, F-8V3C1-007): verticales crea la `addon_version`, y billing
  re-apunta `addon_product.version_id` y fija el precio con un acto propio que valida la versión con
  `políticaDeAddon` antes de escribir (contrato §4.1, *«publicar una versión de addon»*); la pantalla
  es una, compuesta en la app del panel. **Es la vigésima.**
Pieza dueña del AC: [B10](20-fase-3/B10.md#pieza-b10) · también: [V2](10-corte/V2.md#pieza-v2) (provee), [B13b](20-fase-3/B13b.md#pieza-b13b) (implementa; el editor de versiones de complemento queda en `B13b`, owner letra BH).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:210

<a id="acc-21"></a>
**ACC:21** — **Crear o cerrar un código promocional**: su efecto, su alcance, sus usos y su vigencia;
cerrarlo deja de aceptar canjes y no toca los ya canjeados. **Sólo `SUPER_ADMIN`.**

- **De dónde sale**: revisión del owner, 2026-09-28, N1, `L1-f`; `B/14`.
- **¿Destructiva o mueve dinero?** **Sí**: un código es plata que se deja de cobrar. Su confirmación
  dice el efecto, a quién alcanza y hasta cuándo. **Es la vigesimoprimera.** El editor de códigos va
  con su operación en [B9b](20-fase-2/B9b.md#pieza-b9b) (owner, letra BH).
Pieza dueña del AC: [B9b](20-fase-2/B9b.md#pieza-b9b) · también: [B3](10-corte/B3.md#pieza-b3) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:211

<a id="acc-22"></a>
**ACC:22** — **Cambiar un plazo** de la lista cerrada de los `PLAZO:n` (§4). **Sólo `SUPER_ADMIN`.**

- **De dónde sale**: revisión del owner, 2026-09-28, C9, C11, `L1-f`, `L2-h`.
- **¿Destructiva o mueve dinero?** **Sí**: mueve cuándo pasa algo —un archivado, un borrado, un aviso,
  el fin de una ventana—. Publica una versión nueva de los plazos de su mitad, y **los relojes ya
  arrancados conservan la suya**, así que un cambio nunca adelanta una fecha ya anunciada. Su
  confirmación dice el valor actual, el nuevo y eso último. **Rechaza los valores que se contradicen**
  (§4.3). **Es la vigesimosegunda.**
- La mitad de verticales (la tabla versionada de plazos de verticales y esta acción sobre sus claves)
  la crea [V6](10-corte/V6.md#pieza-v6) al corte; [V9b](20-fase-1/V9b.md#pieza-v9b) sólo las lee
  (owner, letra BD, [DEC-DATA-008#📌6](01-decisiones-vigentes.md#dec-data-008-p6)).
Pieza dueña del AC: [B2](10-corte/B2.md#pieza-b2) · también: [V6](10-corte/V6.md#pieza-v6) (implementa), [V8a](10-corte/V8a.md#pieza-v8a) (implementa), [B13a](10-corte/B13a.md#pieza-b13a) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:212, .specs/HOS-1352-billing-verticals-redesign/docs/41-corte-del-mvp/10-decisiones-del-owner.md:108

<a id="acc-23"></a>
**ACC:23** — **Borrar una ficha ajena a pedido de su dueño**, **con motivo** en el campo *«por qué»*
del evento auditable: corre [PB12](04-catalogos.md#trans-v-pb12) sobre la ficha (`V/03` §9), con su
lock, su borrado de contenido, su correo de confirmación y su empuje a billing. Es el paso 2 de la baja
de cuenta manual (auditoría §1.3).

- **De dónde sale**: revisión del owner, casos vecinos, 2026-09-29, caso F-C; `V/03` §9.
- **¿Destructiva o mueve dinero?** **Sí, destructiva**: `PURGED` es final y el contenido no vuelve. Su
  confirmación dice qué ficha, que su contenido se borra y no vuelve, y que el destaque que apuntaba a
  ella se cancela ([A6](04-catalogos.md#trans-b-a6), `B/03` §8). **Como [ACC:15](#acc-15), no es
  capacidad del actor: sus pasos 5 a 7 se evalúan sobre el sujeto**, el dueño, porque hace por él lo que
  él mismo podría, y borrar lo propio es parte del piso (`V/03` §9, ⚠️ punto 5), así que ningún cupo la
  rechaza (`V/17` §3.2 regla 3). La clase y la unidad, `V8` como la 15 (hoy `V8a`), confirmadas por el
  owner (revisión del owner, casos vecinos, 2026-09-29, caso H-D). **Es la vigesimotercera.**
Pieza dueña del AC: [V8a](10-corte/V8a.md#pieza-v8a) · también: [V6](10-corte/V6.md#pieza-v6) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:213

<a id="acc-24"></a>
**ACC:24** — **Dar de baja una cuenta a pedido de su dueño** (el nombre, revisión del owner, casos
vecinos, 2026-09-29, caso I-C: la cuenta no se borra), **con motivo**: el paso 3 de la baja de cuenta
manual (auditoría §1.3).

- **Cuándo se rechaza.** Mientras `puedeCobrarle` (contrato §4.1, en
  [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)) conteste `sí`, es decir mientras a la
  cuenta le quede una suscripción, principal o de complemento, que todavía puede cobrar:
  1. **también una `CANCEL_SCHEDULED` o una terminal cuya cancelación nuestra ninguna relectura
     confirmó todavía**: `puedeCobrarle` contesta sobre la cancelación confirmada por Mercado Pago, y
     mientras no lo esté esta acción espera, hasta que una relectura por id la vea `cancelled` —la del
     barrido, la del handler o la de una transición, que escriben `provider_link.cancelado_visto_en`
     (`B/09` §3; corte del MVP, owner 2026-10-02, CH; residuo corregido el 2026-10-02)— o el barrido
     abra la marca (FASE 9 vuelta 3, owner 2026-09-30, lote D; la razón vieja suponía confirmada una cancelación que el
     barrido puede estar reintentando, F-8V3C1-001);
  2. **y una terminal cuyo preapproval canceló el proveedor tras un cobro rechazado, hasta que pase el
     [PLAZO:16](#plazo-16) desde la primera relectura que lo vio `cancelled`** (FASE 9 vuelta 3, owner
     2026-09-30, lote AE);
  3. **o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta** (verificación corta, 2026-09-29, lote N-C);

  **o mientras le cuelgue una ficha fuera de `PURGED` o una presencia de Partner con contenido** (lote
  N-G) (verificación corta, 2026-09-29, lotes M-F y M-G: verticales no puede evaluar una fila viva).
  Los pasos 1 y 2 van antes, y la acción lo relee.
- **De dónde sale**: revisión del owner, casos vecinos, 2026-09-29, caso F-C; auditoría §1.3.
- **¿Destructiva o mueve dinero?** **Sí, destructiva**: la cuenta no vuelve. Su confirmación dice de
  quién es la cuenta y que no le queda cobro ni ficha. **Sobre una postulación sin cuenta, dice de qué
  postulación es el correo que reemplaza** (lote AI).
- **Es capacidad del actor**: el dueño no puede borrar su cuenta en esta versión (la baja desde Mi
  Cuenta es [HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393)), así que no hay nada suyo que
  el sujeto pudiera hacer; la clase y la unidad, `V8` (hoy `V8a`, por la partición Z), confirmadas por
  el owner (caso H-D).
- **Qué escribe: la fila de la cuenta no se borra, se seudonimiza.** Su nombre, su correo y su
  teléfono se reemplazan, sus sesiones se cierran y queda sin acceso. No toca el registro de auditoría,
  que conserva el actor y el sujeto por id, ni los cobros. Y la fila de `trial` que la apunta sigue,
  con su FK `ON DELETE RESTRICT` y el hash del correo, así que la traba contra repetir la prueba no se
  pierde (`V/02` §2.2) (revisión del owner, casos vecinos, 2026-09-29, caso I-C, que corrige la
  elección del caso H-C; FASE 9 vuelta 3, F-8V3D1-007).
- **El seudónimo de esa fila se conserva hasta que el abogado conteste la pregunta 5 de `V/22`**; si la
  respuesta es en contra, soporte borra todos los seudónimos de las cuentas dadas de baja con una tarea
  puntual, que corre una vez, fuera del panel, y queda anotado quién la corrió y cuándo (FASE 9 vuelta
  3, owner 2026-09-30, lote H). No es una fila de esta tabla, por la misma razón que la migración de
  datos única del catálogo no lo es: no se repite ni tiene permiso que pedir.
- **Qué deja la cuenta sin acceso, con dato**: la acción escribe el instante de la baja en
  `user.deleted_at`, la columna con que el código actual ya rechaza crear una sesión para una cuenta
  borrada, en el mismo hook para todo tipo de credencial, Google incluido (`apps/api/src/lib/auth.ts`,
  H-163, leído en hospeda2 el 2026-09-30), y **borra las credenciales vinculadas de la cuenta**, la
  contraseña y las vinculaciones con proveedores externos (las filas de `account`), para que ninguna
  siga verificando aunque ese control se rompa. El paso de la cadena de autorización que lo lee es el
  1, *«quién es»* (`V/17` §1.2): una cuenta dada de baja no tiene actor autenticado (FASE 9 vuelta 3,
  F-8V3A1-004).
- **Y escribir `user.deleted_at` dispara un trigger del carril de extras,
  `trg_softdelete_bookmarks_on_users`, que sobrevive al corte** (`16-fase-7…` §4.2, paso 6): borra de
  `user_bookmarks` los favoritos que otras personas guardaron sobre esa cuenta, no los que la persona
  guardó (`packages/db/src/migrations/extras/003-delete-entity-bookmarks.trigger.sql`, leído en
  hospeda2 el 2026-09-30). Es una escritura sobre datos de terceros que ya pasa hoy con cada baja, y
  queda nombrada acá (FASE 9 vuelta 3, caso vecino de F-8V3A1-004).
- **Y el correo de las postulaciones de Partner**: la baja reemplaza, como el de `user`, el correo de
  toda postulación que lleve el correo de la cuenta (`postulacion.correo`, `V/02` §2.7), que lo
  conservaba en claro y sin retención (FASE 9 vuelta 3, F-8V3A3-006). **Y alcanza también a una
  postulación hecha sin cuenta** (FASE 9 vuelta 3, owner 2026-09-30, lote AI; verificación,
  VC3-VT-08): a pedido de quien la escribió, soporte reemplaza el correo de esa postulación, con motivo
  y con el registro de auditoría, sin cuenta que dar de baja; el sujeto es quien postuló, identificado
  por el correo de la postulación, y las precondiciones de la cuenta (`puedeCobrarle`, fichas y
  presencia) no aplican porque no hay cuenta. Sin esto, la postulación de un Partner sin cuenta
  ([DEC-AUTH-005](01-decisiones-vigentes.md#dec-auth-005)) dejaba un correo en claro que ninguna fila
  de esta tabla podía reemplazar.
- **Los datos de facturación de la cuenta, el nombre y el correo de quien pagó, se conservan tal cual,
  y la seudonimización no los alcanza: son datos de comprobantes que la ley obliga a guardar**
  (revisión del owner, casos vecinos, 2026-09-29, caso J-C). **Viven en el comprobante**: cada
  `receipt` guarda una copia del nombre y el correo de quien paga, escrita al emitirse desde la fila de
  `user` y nunca reescrita, así que esta acción reemplaza los de `user` y la copia queda como estaba
  (`B/02` §2.3; caso K-A). **Y un cobro que llegue igual después de la baja**, en vuelo, se registra
  con el comprobante sin nombre ni correo y sin enviar (`B/03` §6, [P1](04-catalogos.md#trans-b-p1);
  verificación corta, 2026-09-29, lote N-C).
- **Es la vigesimocuarta.**
- Adjudicación: fila `MIXTO`, veredicto **VIVO** (cada ⚠️ tachado quedó decidido en la misma celda;
  *«la unidad, `V8`»* se lee `V8a`).
Pieza dueña del AC: [V8a](10-corte/V8a.md#pieza-v8a) · también: [B4](10-corte/B4.md#pieza-b4) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:214

<a id="acc-25"></a>
**ACC:25** — **Vaciar la presencia de un Partner a pedido de su dueño**, **con motivo**: borra el
contenido de su presencia, sus fotos, su logo, sus secciones y sus enlaces, en la base y en el
almacenamiento externo, y deja su fila de `partners` sin contenido (`V/18` §1.6). En un Partner, es
parte del paso 2 de la baja de cuenta manual (auditoría §1.3).

- **De dónde sale**: verificación corta, 2026-09-29, lote N-G (`VC-VT-07`).
- **¿Destructiva o mueve dinero?** **Sí, destructiva**: el contenido no vuelve. Su confirmación dice de
  qué Partner es, que su contenido se borra y que no vuelve. **No toca el cobro ni la postulación, y no
  es moderar**: el bit de moderación conserva el contenido y esta acción lo borra.
- **Es capacidad del actor, como la vigesimocuarta**: no hay cupo que la rechace, y después del paso 1
  el Partner ya no tiene la clave de su página (derivado y marcado así en la fuente). La construye
  `V8`, con su panel, como la 23 y la 24, sobre la presencia de [V7](20-fase-4/V7.md#pieza-v7)
  (derivado en la fuente, como el caso H-D); por la partición Z, lo de Partner de `V8` es de `V8b`.
- **Es la vigesimoquinta.**
Pieza dueña del AC: [V8b](20-fase-4/V8b.md#pieza-v8b).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:215

<a id="acc-26"></a>
**ACC:26** — **Asignar o quitar el rol `SUPER_ADMIN` a una cuenta** (el nombre, lote AC), **sólo
`SUPER_ADMIN`**, **con motivo** en el campo *«por qué»* del evento auditable.

- **De dónde sale**: FASE 9 vuelta 3, owner 2026-09-30, lote P (`F-8V3A1-006`).
- **¿Destructiva o mueve dinero?** **Sí, y la de más alcance de la tabla**: con el rol, la cuenta
  recibe el permiso de las siete filas *«sólo `SUPER_ADMIN`»* (de [ACC:17](#acc-17) a
  [ACC:22](#acc-22) y ésta), que fijan precios, plazos, el catálogo y quién más puede fijarlos. Su
  confirmación dice a qué cuenta se le da el rol y qué filas pasa a poder ejecutar **o, al quitarlo, a
  qué cuenta se le quita y qué filas deja de poder ejecutar** (FASE 9 vuelta 3, owner 2026-09-30, lote
  AC; verificación, VC3-VT-03).
- **Es la única escritura que da ese permiso**: el permiso de las siete viene sólo con el rol y no se da
  suelto, así que un override por usuario no lo puede dar (`V/17` §3.2 regla 1).
- **Es capacidad del actor**: su sujeto es la cuenta que recibe o pierde el rol y no hay cupo que
  preguntarle, como la vigesimocuarta. Sobre la propia cuenta la rechaza el paso 3 (`V/17` §3.2 regla
  5). Quitarle el rol a una cuenta también es esta fila, con el mismo registro, actor, sujeto y motivo
  (lote AC).
- La construye [V5](10-corte/V5.md#pieza-v5), con la regla del permiso que viene sólo con el rol.
  **Es la vigesimosexta.**
- Adjudicación: fila `MIXTO`, veredicto **VIVO** (lote AC, explícito).
Pieza dueña del AC: [V5](10-corte/V5.md#pieza-v5).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:216

### 3.2 Qué es «sólo `SUPER_ADMIN`», y lo que ninguna fila hace

**Qué es *«sólo `SUPER_ADMIN`»*, decidido** (FASE 9 vuelta 3, owner 2026-09-30, lote P): cada una de
las siete filas que lo dicen, de la 17 a la 22 y la 26, tiene su permiso propio, como las demás, y
**ese permiso viene sólo con el rol `SUPER_ADMIN` y no se da suelto**: un override por usuario no lo
puede dar. El paso 3 sigue preguntando por el permiso y no por el rol (`V/17` §4.3). **Y asignar o
quitar el rol es [ACC:26](#acc-26)**, registrada con actor, sujeto y motivo como cualquier fila, así
que el poder de fijar precios nunca cambia de manos sin rastro (`V/17` §3.2 regla 1).

**Dos cosas que ninguna fila de esta tabla hace, ni las que se agreguen:**

1. un acto de un actor distinto del dueño **nunca es *«el dueño publica»***, así que no ejerce el
   evento de activación ni dispara [T1](04-catalogos.md#trans-v-t1) (el trial es de por vida y lo gasta
   sólo el dueño, `V/03` §2);
2. **ningún borrado de ficha sale de otra fila que [PB9](04-catalogos.md#trans-v-pb9) o
   [PB12](04-catalogos.md#trans-v-pb12)**, que es lo que hace correr [A6](04-catalogos.md#trans-b-a6)
   (`B/03` §8) y cancela el addon `LISTING` de la ficha borrada (FASE 9 vuelta 1, `F-8V1A1-003`).
   [ACC:23](#acc-23) no es la excepción: borra corriendo `PB12` (caso F-C).

**Y las puertas que hoy borran por otro lado se retiran** (FASE 5, owner 2026-09-30, lote 3 C): el
botón con que el dueño borra su ficha pasa a ser el borrado del diseño, el borrado del equipo pasa a
[ACC:23](#acc-23), a pedido y con motivo, y **desaparecen el borrado físico de fichas y de cuentas y la
restauración de fichas del panel** en las tres verticales. Una cuenta no se borra: se da de baja con
[ACC:24](#acc-24).

> **«Entrar como» el cliente queda para una versión posterior, y su condición se escribe hoy**
> (revisión del owner, 2026-09-28, C7). Un admin que le maneja la ficha a quien no sabe hacerlo **no
> está en esta versión y se va a agregar**. La condición, que vale desde ya para quien lo diseñe:
> **todo lo que haga queda registrado como hecho por el admin en nombre del cliente** (actor el admin,
> sujeto el cliente, y nunca `actor = sujeto` en el registro); no es la impersonación que `V/17` §3.2
> regla 4 prohíbe, que borra quién actuó. **Cuando se diseñe, la frase de arriba *«ni las que se
> agreguen»* se reabre**: si el admin publica en nombre del cliente, o esa publicación le arranca la
> prueba al cliente (y la frase cae) o no se la arranca (y el admin no puede publicar la ficha de quien
> no tiene plan). No se decide ahora.
> **Y lo que el código de hoy tiene apagado no espera a esa versión: sale en
> [V5](10-corte/V5.md#pieza-v5)** (FASE 5, owner 2026-09-30, lote 4 C): `impersonate` y `set-role` del
> plugin `admin` de Better Auth, el botón de impersonar del panel y el permiso `USER_IMPERSONATE`.
> HOS-354 se cierra o se reescribe como el *«entrar como»* de esa versión posterior. Con `set-role`
> sale además un segundo camino para asignar roles que no pasa por ninguna fila de esta tabla, y que
> la vigesimosexta no contaba. **Y con ellas `fullAdminRole` del plugin queda sin ninguna acción**
> —salen también `ban`, `delete`, `set-password`, `create` y `update`, y con `delete` la puerta de
> borrado físico de cuentas que el lote 3 C retira—: **el plugin sigue sólo como guardia del baneo**,
> cuyo rechazo de sesión no depende del rol (FASE 5, lote de la aplicación, owner 2026-09-30, L; hoy
> toda ruta del plugin contesta `403`, así que vaciar el rol no rompe nada que funcione).

**Y ninguna fila de esta tabla se ejecuta con `actor = sujeto`**: el paso 3 de la autorización la
rechaza y la hace otra cuenta con el permiso (`V/17` §3.2 regla 5; owner 2026-09-26, `G5-1`).
**Compara cuentas, no personas** (owner 2026-09-26, `Y-2`): la misma persona con dos cuentas la
cumple, y lo que la ve es el detector de la auditoría §4.1.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:245, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:253, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:259, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:265, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:274, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:285

### 3.3 Lo que le pone un caso adelante a una persona no es una fila: el enrutado

**Lo que le pone un caso ADELANTE a esa persona no es una fila de esta tabla: es un efecto de
transición, así que no suma filas.** La distinción hay que decirla porque
[DEC-RF-002](01-decisiones-vigentes.md#dec-rf-002) convirtió el reembolso del pago pendiente en **el
desenlace de un camino que el sistema alcanza solo** —antes era un acto que alguien pedía—, y una
acción con permiso, auditoría y confirmación declarados **no sirve de nada si nadie enruta el caso**.
El enrutado existe y está en estos lugares:

| qué | quién lo hace | dónde |
|---|---|---|
| **abrir** la marca —con motivo **`REEMBOLSO_POR_CONFIRMAR`** y **el pago colgado de ella**— sobre la predecesora que lo retiene, un `payment` **o un `manual_payment`**, porque [S19](04-catalogos.md#trans-b-s19) lo retiene entre por la puerta que entre | **[S18](04-catalogos.md#trans-b-s18)**, como **quinto** efecto del cierre de la sucesión | `B/03` §3.2, `B/02` §2.5, `B/12` §5.3 **ramas 1, 5 y 6** |
| **abrir** la marca —con uno de **dos** motivos y el pago colgado— sobre la **suscripción de complemento** que muere con un período cobrado **sin terminar** | **[S21](04-catalogos.md#trans-b-s21)**, en el mismo acto en que la lleva a `CANCELLED`. **Cuál de los dos escribe es lo que decide lo que el listado propone**, y desde [DEC-RF-006](01-decisiones-vigentes.md#dec-rf-006) eso es **el motivo** y no una rama: **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`** —devolver— si la instancia murió por la **revocación del grant**, y **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`** —no devolver— en el resto. **Son cuatro casos, los cuatro disparadores**: la orfandad ya no se parte (revisión del owner, 2026-09-28, C8: salen la discontinuación y la palabra del nombre del motivo) | `B/03` §3.2, `B/02` §2.5 **motivos 14 y 15** ([MOT:14](04-catalogos.md#mot-14), [MOT:15](04-catalogos.md#mot-15)), `B/16` §4.4, [DEC-ADDON-004](01-decisiones-vigentes.md#dec-addon-004), [DEC-RF-004](01-decisiones-vigentes.md#dec-rf-004), `DEC-RF-006` |
| **hacer que esa marca escale** si nadie la resuelve | el **barrido diario**, que devuelve al recorrido las suscripciones terminales con la marca puesta o con un pago pendiente —**y como el reloj vive adentro del barrido, que el barrido corra lo vigila OTRO proceso**: si pasan 26 h sin una corrida completa, avisa (FASE 8 completa, `F-8CB3-007`)—; el plazo de escalamiento es el [PLAZO:17](#plazo-17) | `B/09` §3, salvedades 2 y 3; **`B/09` §7.1** |
| **re-emitir una cortesía DIFERIDA** sobre la fila que acaba de autorizar —**la sucesora** de un cambio de plan— | **[S9](04-catalogos.md#trans-b-s9)**, por su segundo disparador; la firma sigue siendo la de `SUPER_ADMIN` que la otorgó, así que **no es una concesión nueva** y no suma fila (el alta nueva y el tercer disparador salieron con la revisión del owner, 2026-09-28, C8) | `B/03` §3.2, `B/02` §2.4 y §2.6, `B/14` §4.4, [DEC-GRANT-007](01-decisiones-vigentes.md#dec-grant-007) |
| **CERRAR el saldo de una cortesía diferida**, con `saldo_cerrado_en` y su `motivo_cierre` | **[S3](04-catalogos.md#trans-b-s3)** cuando la sucesora abandonó el checkout, **[S13](04-catalogos.md#trans-b-s13)** cuando un grant pasa a cubrir esa vertical, **`S18`** cuando el destino es de plan no mensual (FASE 8 completa; `DESTINO_DE_PLAN_NO_MENSUAL`, FASE 9 completa, contradicción 1 de `03` §R4.5), **y [S31](04-catalogos.md#trans-b-s31) cuando la sucesora se corta porque un contracargo cortó a su predecesora** (FASE 8 completa, pendiente 8, owner 2026-09-25): **son los cuatro valores de la enumeración cerrada** (`B/02` §2.4), y es cerrada y no el texto libre de [DEC-GRANT-008](01-decisiones-vigentes.md#dec-grant-008) porque **no hay una persona escribiendo el motivo** | `B/03` §3.2, `B/02` §2.4, `B/14` §4.3, [DEC-GRANT-011](01-decisiones-vigentes.md#dec-grant-011) |

Las **cinco** son actos **de sistema**, no de admin, y por eso no suman filas. **La quinta es la única
que no le pone nada delante a nadie**: no enruta un caso, **termina** una concesión que firmó
`SUPER_ADMIN`, y es por eso que necesitó dejar asentado su motivo: el registro de auditoría dice qué
acto ocurrió y cuándo, y **acá no hay nadie a quien preguntarle por qué**. **Ninguna de las dos que
abren una marca es [S14](04-catalogos.md#trans-b-s14)**: su evento es *«divergencia que toca plata o
estado»*, y ni el pago que `S19` retiene ni el período del complemento que muere son divergencias —los
dos son casos **diseñados**, y `S19` lo declara por escrito—. La tercera es un job, la cuarta es un
efecto de `S9` y la quinta, uno de `S3` y de `S13` (y de `S18` y `S31`). Lo que sí es de esta tabla son
los dos actos con que una persona **cierra** el caso: **reembolsar** ([ACC:13](#acc-13)) y **levantar
la marca** ([ACC:7](#acc-7)), cada uno con su fila, su permiso y su confirmación. Sin las dos mitades de
arriba, esas dos filas describen un trámite que nadie empieza.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:290, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:297, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:299, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:303, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:305

---

## 4. Los plazos que deciden cuándo pasa algo

(Revisión del owner, 2026-09-28, C9, C11, `L2-g` y `L2-h`;
[DEC-DATA-008](01-decisiones-vigentes.md#dec-data-008).) **Todo plazo en días o meses que decide
cuándo pasa algo lo configura el `SUPER_ADMIN` desde el panel**, con la acción *«cambiar un plazo»*
([ACC:22](#acc-22)). **Los números del diseño pasan a ser valores iniciales**: donde un texto dice 90 o
180 días, 60 días de aviso o los días de una campaña de correos, se lee *«el plazo, con ese valor al
inicio»*.

**Configurar el 90 y el 180 es un apartamiento declarado del PDR, el décimo** (revisión del owner,
casos vecinos, 2026-09-29, caso 46): el §25 los fija (su *«Día 90»*, el soft delete, y su *«Día
180»*, el hard delete de datos operativos eliminables), y acá pasan a ser los valores iniciales de los
plazos 1 y 2. El PDR no se edita: el apartamiento se registra en `DEC-DATA-008`, donde viven los
otros.

**La lista es cerrada, y son diecinueve.** Cada mitad es dueña de sus claves, como del resto de su
catálogo. Cada plazo dice su mitad, su valor inicial, qué decide y qué reloj guarda la versión de
plazos con que arrancó.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:155, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:157, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:163, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:169, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:193

### 4.1 La lista cerrada

<a id="plazo-1"></a>
**PLAZO:1** — **Archivado por inactividad.**
Mitad: verticales · valor inicial: **90 días** · qué decide: [PB4](04-catalogos.md#trans-v-pb4)
(`V/03` §9) · qué reloj guarda la versión: la ficha (`V/02` §2.5).
Pieza dueña del AC: [V6](10-corte/V6.md#pieza-v6).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:173

<a id="plazo-2"></a>
**PLAZO:2** — **Borrado por inactividad.**
Mitad: verticales · valor inicial: **180 días** · qué decide: [PB9](04-catalogos.md#trans-v-pb9) ·
qué reloj guarda la versión: la ficha.
Pieza dueña del AC: [V9b](20-fase-1/V9b.md#pieza-v9b) · también: [V6](10-corte/V6.md#pieza-v6) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:174

<a id="plazo-3"></a>
**PLAZO:3** — **Archivado de un borrador, el `N` de [PB5](04-catalogos.md#trans-v-pb5).**
Mitad: verticales · valor inicial: **sin valor escrito** (lo fija el owner, §4.2) · qué decide: `PB5`
· qué reloj guarda la versión: la ficha.
Pieza dueña del AC: [V6](10-corte/V6.md#pieza-v6).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:175

<a id="plazo-4"></a>
**PLAZO:4** — **Los dos avisos previos de retención.**
Mitad: verticales · valor inicial: **sin valor escrito** (lo fija el owner, §4.2) · qué decide:
cuántos días antes del archivado y del borrado sale cada uno (catálogo de correos,
[02-nucleo-outbox.md](02-nucleo-outbox.md) §6) · qué reloj guarda la versión: la ficha.
Pieza dueña del AC: [V9b](20-fase-1/V9b.md#pieza-v9b) · también: [V6](10-corte/V6.md#pieza-v6) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:176

<a id="plazo-5"></a>
**PLAZO:5** — **La campaña previa al vencimiento de la prueba.**
Mitad: verticales · valor inicial: **10, 5, 2 y 0 días antes** · qué decide: el catálogo de correos
(outbox §6) · qué reloj guarda la versión: la fila de `trial`, al arrancar
([T1](04-catalogos.md#trans-v-t1)).
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:177

<a id="plazo-6"></a>
**PLAZO:6** — **La campaña de recuperación.**
Mitad: verticales · valor inicial: **+1, +5, +15, +30 y +60 días** · qué decide: el catálogo de correos
(outbox §6) · qué reloj guarda la versión: la fila de `trial`, al vencer
([T3](04-catalogos.md#trans-v-t3)).
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:178

<a id="plazo-7"></a>
**PLAZO:7** — **El techo de días de prueba acumulados, por vertical.**
Mitad: verticales · valor inicial: **sin valor escrito** (lo fija el owner, §4.2) · qué decide: hasta
dónde se extiende una prueba (`V/11` §3; la extensión firmada por `SUPER_ADMIN`, [ACC:11](#acc-11),
pasa el techo) · qué reloj guarda la versión: la fila de `trial`, al arrancar.
Pieza dueña del AC: [V4](10-corte/V4.md#pieza-v4).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:179

<a id="plazo-8"></a>
**PLAZO:8** — **La postulación de Partner atrasada.**
Mitad: verticales · valor inicial: **sin valor escrito** (lo fija el owner, §4.2) · qué decide: cuándo
se marca en el panel (`V/18` §2.3) · qué reloj guarda la versión: la postulación.
Pieza dueña del AC: [V7](20-fase-4/V7.md#pieza-v7) · también: [V8b](20-fase-4/V8b.md#pieza-v8b) (implementa), [V6](10-corte/V6.md#pieza-v6) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:180

<a id="plazo-9"></a>
**PLAZO:9** — **La espera entre un rechazo y una postulación nueva de Partner.**
Mitad: verticales · valor inicial: **sin valor escrito** (lo fija el owner, §4.2) · qué decide: `V/18`
§2.2 (la espera que [ACC:5](#acc-5) puede anular) · qué reloj guarda la versión: el rechazo.
Pieza dueña del AC: [V7](20-fase-4/V7.md#pieza-v7).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:181

<a id="plazo-10"></a>
**PLAZO:10** — **La ventana de autorización de un alta o una sucesión.**
Mitad: billing · valor inicial: **72 h con tarjeta, 7 días con pago manual** · qué decide: cuándo
vence (`B/03` §3.4, [DEC-SUB-016](01-decisiones-vigentes.md#dec-sub-016)) · qué reloj guarda la
versión: la suscripción, al abrir la ventana.
Pieza dueña del AC: [B3](10-corte/B3.md#pieza-b3) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:182

<a id="plazo-11"></a>
**PLAZO:11** — **El aviso previo de un aumento de precio, con sus dos contactos.**
Mitad: billing · valor inicial: **60 días, a 30 y a 7 días** · qué decide:
[DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002) y el catálogo de correos (outbox §6) · qué reloj
guarda la versión: el aumento anunciado.
Pieza dueña del AC: [B2](10-corte/B2.md#pieza-b2) · también: [B12](20-fase-3/B12.md#pieza-b12) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:183

<a id="plazo-12"></a>
**PLAZO:12** — **El aviso previo de una migración de un plan retirado, con sus dos contactos.**
Mitad: billing · valor inicial: **60 días, y los contactos 30 y 7 días antes de la renovación de cada
cliente** (revisión del owner, casos vecinos, 2026-09-29, caso 21) · qué decide: `B/10` §3.7 (la
migración de [ACC:17](#acc-17)) · qué reloj guarda la versión: la migración anunciada.
Pieza dueña del AC: [B12](20-fase-3/B12.md#pieza-b12) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:184

<a id="plazo-13"></a>
**PLAZO:13** — **La renovación por venir.**
Mitad: billing · valor inicial: **5 y 1 días antes** · qué decide: el catálogo de correos (outbox §6) ·
qué reloj guarda la versión: la suscripción, en cada ciclo.
Pieza dueña del AC: [B13a](10-corte/B13a.md#pieza-b13a) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:185

<a id="plazo-14"></a>
**PLAZO:14** — **El aviso de que una promo termina.**
Mitad: billing · valor inicial: **7 días antes** · qué decide: el catálogo de correos (outbox §6) · qué
reloj guarda la versión: el canje.
Pieza dueña del AC: [B9b](20-fase-2/B9b.md#pieza-b9b) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:186

<a id="plazo-15"></a>
**PLAZO:15** — **Lo mínimo que tiene que quedar del ciclo para ofrecer un cambio de plan.**
Mitad: billing · valor inicial: **24 h** · qué decide: `B/12` §5.4 · qué reloj guarda la versión: la
suscripción, en cada ciclo.
Pieza dueña del AC: [B8b](20-fase-2/B8b.md#pieza-b8b) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:187

<a id="plazo-16"></a>
**PLAZO:16** — **La ventana de relectura de la cancelación por rechazo.**
Mitad: billing · valor inicial: **7 días** (FASE 9 vuelta 3, owner 2026-09-30, lote R) · qué decide:
cuánto sigue el barrido releyendo una suscripción que Mercado Pago canceló ante un rechazo antes de
darla por terminada, porque ese `cancelled` se puede deshacer ([EX-45](04-catalogos.md#mp-ex-45);
`B/09` §3, criterio de exención, y [S16](04-catalogos.md#trans-b-s16)) (FASE 9 vuelta 3, owner
2026-09-30, lote K) · qué reloj guarda la versión: la suscripción, al leerse `cancelled` por primera
vez: **`provider_link.cancelado_visto_en`** (`B/02` §2.2; FASE 9 vuelta 3, owner 2026-09-30, lote Z).
El valor cubre con margen las *«horas después»* que registra el código actual en los seis casos de
`EX-45`; no está medido: es el valor inicial. Es también lo que espera la baja de cuenta manual
([ACC:24](#acc-24)) sobre una suscripción cancelada por el proveedor tras un rechazo.
Adjudicación: fila `MIXTO`, veredicto **VIVO** (el valor reemplaza al «sin valor»).
Pieza dueña del AC: [B11](10-corte/B11.md#pieza-b11) · también: [B2](10-corte/B2.md#pieza-b2) (provee), [B4](10-corte/B4.md#pieza-b4) (implementa).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:188, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:201

<a id="plazo-17"></a>
**PLAZO:17** — **El escalamiento de una marca abierta.**
Mitad: billing · valor inicial: **7 días** (FASE 9 vuelta 3, owner 2026-09-30, lote R): una revisión
por semana de lo que nadie resolvió · qué decide: cuándo escala una marca que sigue abierta (`B/09` §3,
*«si sigue abierta pasado su plazo, escala»*) (FASE 9 vuelta 3, F-8V3B3-003) · qué reloj guarda la
versión: la marca, al abrirse (`puesta_en`). **Qué hace concretamente *«escalar»*** no es de esta
lista: lo escribe `B/09` §3. No está medido: es el valor inicial.
Adjudicación: fila `MIXTO`, veredicto **VIVO** (el valor reemplaza al «sin valor»).
Pieza dueña del AC: [B11](10-corte/B11.md#pieza-b11) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:189, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:204

<a id="plazo-18"></a>
**PLAZO:18** — **La ventana de las comprobaciones de pagos acreditados y de órdenes pagadas.**
Mitad: billing · valor inicial: **180 días** (FASE 9 vuelta 3, owner 2026-09-30, lote R): un techo
prudente mientras la matriz no mida cuánto después de acreditado llega un contracargo
([RF-3](04-catalogos.md#mp-rf-3) sigue `UNKNOWN`), sabiendo que su costo crece con los pagos (`B/09`
§3) · qué decide: hasta cuánto después el barrido relee un pago acreditado, y una orden de una instancia
`ABANDONED`: es una sola ventana, porque la de órdenes remite a la de pagos (`B/09` §3), y de ella
cuelga el único productor del motivo 23 ([MOT:23](04-catalogos.md#mot-23)) (FASE 9 vuelta 3,
F-8V3B3-003) · qué reloj guarda la versión: el pago, o la instancia, que la comprobación relee. No está
medido: es el valor inicial.
Adjudicación: fila `MIXTO`, veredicto **VIVO** (el valor reemplaza al «sin valor»).
Pieza dueña del AC: [B11](10-corte/B11.md#pieza-b11) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:190, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:204

<a id="plazo-19"></a>
**PLAZO:19** — **La ventana `N` del resumen de conciliación.**
Mitad: billing · valor inicial: **sin valor escrito: lo fija el owner antes del merge de
[B2](10-corte/B2.md#pieza-b2)** (corte del MVP, owner 2026-10-02, BU; corte del MVP, owner
2026-10-02, BX: la versión 1 falla con un plazo vacío, sin excepciones) · qué decide: cada cuántos
minutos sale el resumen agregado de `RECONCILIATION_REQUIRED`
([DEC-OBS-001](01-decisiones-vigentes.md#dec-obs-001): *«`N` es configuración (§9)»*) · qué reloj
guarda la versión: ninguno: el resumen usa la versión vigente al abrir su ventana (inferido de BU,
*«a los `N` minutos que dice la versión de plazos vigente»*; así lo marca la fuente). **Es una clave
más en la tabla versionada de plazos de billing de `B2`, que cambia [ACC:22](#acc-22)**; la
alternativa de una variable de entorno o una constante queda descartada por ir contra el PDR §9
(BU).
Pieza dueña del AC: [B11](10-corte/B11.md#pieza-b11) · también: [B2](10-corte/B2.md#pieza-b2) (provee).
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:191, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:193

### 4.2 Los valores, cuándo se fijan y dónde nacen

**Son diecinueve** (el 19, la ventana del resumen de conciliación, desde el lote BK a BV del corte
del MVP, owner 2026-10-02, BU: **su valor lo fija el owner antes del merge de
[B2](10-corte/B2.md#pieza-b2)**, y no de `B11`; corte del MVP, owner 2026-10-02, BX: así la regla de
que la versión 1 falla con un plazo vacío vale sin excepciones) (FASE 9 vuelta 3: el 16 por el lote
K, owner 2026-09-30; el 17 y el 18 por `F-8V3B3-003`, que eran *«configuración»* sin valor, pantalla
ni unidad; recontados sobre la tabla). **Los cinco sin valor
escrito de verticales —[PLAZO:3](#plazo-3), [PLAZO:4](#plazo-4), [PLAZO:7](#plazo-7),
[PLAZO:8](#plazo-8) y [PLAZO:9](#plazo-9)— los fija el owner antes del merge de
[V6](10-corte/V6.md#pieza-v6)**, y el [PLAZO:19](#plazo-19), de billing, también sin valor escrito,
**antes del merge de [B2](10-corte/B2.md#pieza-b2)** (BU, BX) (FASE 5,
owner 2026-09-30, lote 3 D; [DEC-DATA-008#📌5](01-decisiones-vigentes.md#dec-data-008-p5): la
migración que los necesita corre en el e2e de cada PR desde que se mergea, no desde el ensayo), **y la
migración estructural del corte falla si alguno está vacío** (revisión del owner, casos vecinos,
2026-09-29, caso 43; la migración, verificación corta, 2026-09-29, lote N-H). El 16, el 17 y el 18 los
fijó el owner (FASE 9 vuelta 3, owner 2026-09-30, lote R;
[DEC-DATA-008#📌4](01-decisiones-vigentes.md#dec-data-008-p4)), y ninguno de los tres está medido: son
los valores iniciales, y los cambia [ACC:22](#acc-22) como a cualquier plazo.

**La versión 1 de los plazos de cada mitad, con los diecinueve valores, nace en la migración
estructural del paso 3 del corte** (`16-fase-7…` §4.2; [30-el-corte.md](30-el-corte.md)), antes que la
escritura `C` y la prueba del corte, que la guardan, y el paso 3a sólo la verifica (la prueba la escribe
después la herramienta del corte de `V6`: FASE 5, owner 2026-09-30, lote 2 D; FASE 5, lote de la
aplicación, owner 2026-09-30, B). Un plazo vacío dejaría un reloj sin fecha.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:193, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:195, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:198, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:201

### 4.3 Lo que no está en la lista, cómo cambia un plazo y lo que el panel rechaza

**Lo que no está en la lista, y por qué.**

- **(a) Los plazos que son del catálogo**: los días de prueba, la gracia y los topes de pausa de un plan
  cuelgan de su versión y cambian publicando una versión nueva (modelo §1.4; [ACC:18](#acc-18)), no
  por esta acción.
- **(b) Ningún plazo técnico** (`L2-g`): los 15 minutos del caché, las 26 horas del vigía del proceso
  diario, los 3 días de reintento de una mutación, los 7 días de [S37](04-catalogos.md#trans-b-s37)
  antes de la renovación y los 180 días que se guarda una entrega de aviso, por cualquiera de los dos
  canales (`B/02` §2.7; mediciones del 2026-09-29, M-2, que la fijó para que la revisión de HOS-1399
  tenga tres meses de datos y la tabla no crezca sin fin); el corte ya no tiene esperas (FASE 5,
  simplificación del corte, S-72). Cada uno protege un invariante, y cambiarlo sin saber cuál es la
  optimización peligrosa.
- **(c) Los que fija Mercado Pago o la ley**: la ventana de reintentos del proveedor, los 10 días
  corridos del arrepentimiento y las 24 horas de la Resolución 424/2020 (`B/22`).

**Cómo cambia uno sin adelantar una fecha ya anunciada** (`L2-h`). *«Cambiar un plazo»* publica **una
versión nueva de los plazos de su mitad**, inmutable, con quién, cuándo, el valor anterior y el nuevo:
**ese registro es el de cada cambio**, además de la auditoría de la acción.

- **Cada reloj guarda la versión de plazos con la que arrancó** (la que dice cada plazo arriba) y
  cuenta con esa, así que un cambio vale para los relojes que arrancan después y **nunca adelanta una
  fecha ya anunciada**.
- Un reloj que se reinicia arranca otra vez, y guarda la versión vigente en ese momento. **Salvo el
  reinicio por el fin de una pausa, que no se escribe** (`retenciónDetenida`, contrato §4.1, en
  [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)): contado desde el fin de la pausa, el
  reloj de retención cuenta con **la versión que guarda la ficha**, la de su último hecho, porque no hay
  escritura que guarde otra; así un plazo que se acortó durante la pausa no le adelanta la fecha a nadie
  (revisión del owner, casos vecinos, 2026-09-29, caso H-E).
- **Y alargar un plazo tampoco alcanza a los relojes ya arrancados** (revisión del owner, casos
  vecinos, 2026-09-29, caso 45): cada reloj cuenta con su versión aunque la nueva sea más larga, porque
  alargar, por ejemplo, una migración ya anunciada movería una fecha que el cliente ya recibió.

**Lo que el panel rechaza, porque se contradice**:

1. **archivar antes que borrar**: el [PLAZO:1](#plazo-1) menor que el [PLAZO:2](#plazo-2);
2. **el `N` de `PB5` ([PLAZO:3](#plazo-3)), en su peor caso en días (meses de 31), menor que el
   PLAZO:2**: es lo que era `G-R5-B`, hoy la validación [VAL:G-R5-B](04-catalogos.md#val-g-r5-b) de
   *«cambiar un plazo»*, con la cota atada al plazo de borrado y no a 6 meses literales (`V/20` §2; confirmado por
   el owner: revisión del owner, casos vecinos, 2026-09-29, caso 50);
3. **cada aviso antes del hecho que anuncia**: los avisos previos del [PLAZO:4](#plazo-4) menores que
   el PLAZO:1 y que la distancia entre el PLAZO:1 y el PLAZO:2; los contactos del
   [PLAZO:11](#plazo-11) y del [PLAZO:12](#plazo-12) menores que su aviso;
4. **el aviso de una migración o de un aumento nunca menor que el mínimo de
   [DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002)**, que queda en 60 días: se puede alargar, no
   acortar (revisión del owner, casos vecinos, 2026-09-29, caso 44);
5. **la gracia menor que el ciclo más corto**, que es del catálogo y rechaza *«publicar una versión de
   plan»* ([ACC:18](#acc-18); modelo §1.4).

**Y el espacio entre el archivado y el borrado queda garantizado** (el ítem que estaba declarado
abierto en `V/03` §9, ⚠️ punto 7): el archivado escribe la fecha de borrado que anuncia, y `PB9` no
borra antes de esa fecha (`V/02` §2.5, `V/03` §9).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:209, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:211, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:216, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:220, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:226, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:230, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:234, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:247

### 4.4 Quién lo construye

- **La tabla de plazos de cada mitad y la operación de cambiarlos**: en verticales,
  [V6](10-corte/V6.md#pieza-v6), al corte (corte del MVP, owner 2026-10-01, BD) —**la tabla versionada
  de los plazos de verticales, su versión 1 con sus valores y la acción 22 sobre sus claves los crea
  `V6` en la misma migración que la escritura `C`, junto con la versión guardada en la ficha
  (`plazos_version` y `borrado_anunciado`); `V9b` sólo los lee**
  ([DEC-DATA-008#📌6](01-decisiones-vigentes.md#dec-data-008-p6))—; en billing,
  [B2](10-corte/B2.md#pieza-b2) (no cambia).
- **Cada reloj guarda su versión en la pieza que lo construye.**
- **Una sola pantalla de plazos, compuesta en la app del panel** (revisión del owner, casos vecinos,
  2026-09-29, caso 47), que lee las dos mitades por la API sin importar ninguna (caso H-F):
  [V8a](10-corte/V8a.md#pieza-v8a) y [B13a](10-corte/B13a.md#pieza-b13a) construyen cada uno la parte
  de su mitad (corte del MVP, owner 2026-10-01, Z; inferido por la fuente que la pantalla es de las
  mitades a, y así lo marca; residuo corregido el 2026-10-02), y cada cambio lo ejecuta la acción *«cambiar un plazo»* de la mitad dueña de la
  clave (`V/descomposicion.md` §2.11, `B/descomposicion.md` §2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:251, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:253, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:254, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:7442, .specs/HOS-1352-billing-verticals-redesign/docs/41-corte-del-mvp/10-decisiones-del-owner.md:108
