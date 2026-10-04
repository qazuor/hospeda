---
title: Núcleo — mapa del programa y reglas de escritura
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-30
status: CURRENT
fase: 2
---

# Núcleo — mapa del programa y reglas de escritura

El diseño de FASE 2: **cómo se construye hoy Verticales + Billing de Hospeda partiendo de cero**
(`00-PDR.md` §1).

> **Este documento cambió de forma el 2026-09-18.** Era el índice de una Master Spec de 22
> capítulos en un solo lugar. `DEC-ARCH-005` partió el programa en dos épicas autónomas y el
> desarme se ejecutó el mismo día, así que ahora es **el mapa de las tres partes** más las reglas
> de escritura, que no cambiaron.

## Qué es y qué no es

**Es** el diseño completo del sistema nuevo: dominio, datos, estados, invariantes, servicios,
API, jobs, proveedor, superficies, testing y migración.

**No es** un plan de implementación (eso es FASE 7), ni una comparación contra lo que existe
(eso es FASE 5), ni una clasificación de código en `KEEP`/`ADAPT`/`REWRITE` — que tiene su
propio gate (`DEC-METH-003`) y **no se anticipa acá ni siquiera de forma implícita**.

## De dónde sale cada afirmación

La regla de fuentes de esta fase es **distinta de la de FASE 1B**, y conviene decirlo porque
las dos conviven en el mismo programa.

FASE 1B se escribió **sólo contra el código**. FASE 2 se escribe **sin el código**: el §0 del
PDR es explícito —*«NO quiero que la implementación existente condicione el diseño del sistema
nuevo»*— y el §65 lo repite al abrir la fase. Las tres fuentes admitidas son las del programa
(`01-decision-log.md`, regla 4):

1. **el PDR** — y si un capítulo cita un `§`, el texto se verifica contra el PDR antes de
   escribirlo (regla 5);
2. **una decisión registrada** en `01-decision-log.md` — son ~~**111** al 2026-09-24~~ ~~**117** al
   2026-09-25~~ ~~**124** al 2026-09-25, con las siete nuevas de la FASE 9 completa (recontado al
   cierre de la tanda de aplicación; `26-fase-9-completa/14` §5.1)~~ ~~**126** al 2026-09-26~~ ~~**134** al 2026-09-28~~ ~~**135** al 2026-09-29~~ ~~**139** al 2026-09-30~~ ~~**142** al 2026-09-30~~ **144** al 2026-09-30, con las dos de las FASES 6 y 7 —`DEC-METH-018` y `DEC-ARCH-016`— (recontado con script: 145 encabezados menos la plantilla) (FASES 6 y 7, verificación, 2026-09-30, F2), y el 142, con las tres de la FASE 5 —`DEC-METH-017`, `DEC-MIG-007` y `DEC-ARCH-015`— (recontado con script: `rg -c '^### DEC-'` da 143 encabezados, menos la plantilla), y el 139 (FASE 9 vuelta 3, owner 2026-09-30, lote AB: entre ellas `DEC-AUTH-004` y `DEC-AUTH-005`; recontado con script, 140 encabezados menos la plantilla), y el 135 del 2026-09-29 con `DEC-MP-009` (mediciones del 2026-09-29, lote L;
   `30-revision-del-owner/29-aplicacion-lote-l-log-y-matriz.md`), con las ocho de la
   revisión del owner (`30-revision-del-owner/15-aplicacion-log-y-matriz.md`) y las
   dos de la FASE 9 vuelta 1 —`DEC-AUTH-002` y `DEC-AUTH-003`— (recontado con script en
   `28-fase-9-vuelta-1/25-verificado-G5-y-registro.md` §4: 127 encabezados menos la plantilla; el 134, 135 menos la plantilla), recontadas con
   `rg -c "^### DEC-"` menos la plantilla del formato. Las `SUPERSEDED` no cuentan como fuente:
   ~~`DEC-SUB-001` y `DEC-SUB-005` enteras~~ `DEC-SUB-001`, **`DEC-SUB-003`** y `DEC-SUB-005`
   enteras —`DEC-SUB-003` por `DEC-SUB-021`—, ~~`DEC-MIG-001` sólo en lo que `DEC-MIG-003`
   reemplazó~~ `DEC-MIG-001` y **`DEC-MIG-002`** sólo en lo que `DEC-MIG-003` reemplazó (FASE 9
   completa, `C-9`), y
   `DEC-MP-003` sólo en lo que `DEC-MP-008` reemplazó (FASE 9 completa, `C-13`: la lista dejaba a
   `DEC-SUB-003` como fuente, y es el lugar donde un implementador busca qué decisiones valen);
   y desde el 2026-09-28 (revisión del owner, C8 y C14) `DEC-SUB-015`, `DEC-SUB-018`,
   `DEC-GRANT-010` y `DEC-ARCH-011` enteras, y `DEC-DATA-002` sólo en lo que `DEC-DATA-006`
   reemplazó; y desde el 2026-09-30 (FASE 5, simplificación del corte, lote E) `DEC-MIG-004`
   entera, por `DEC-MIG-007`, y `DEC-MIG-005` sólo en sus 📌 que el mismo lote marca `SUPERSEDED`
   (los del 27/09, el de `V2-a`/`V2-m`/`V2-r`, el del 29/09 y el del 30/09);
3. **una medición fechada** de `06-mp-validation-matrix.md` o `07-facts-inventory.md`.

**El registro de FASE 1B (`08`) no es fuente de diseño.** Un hallazgo de 1B puede aparecer en
un capítulo **sólo** como advertencia sobre un modo de falla ya observado —nunca como razón
para que el diseño sea de una forma u otra—, y va marcado como tal. Es la línea que el §0
traza: la arquitectura actual no es la fuente de verdad.

## Cómo se relacionan las tres partes

**El núcleo es el único lugar donde algo se define.** Los capítulos de las dos épicas describen
comportamiento y **referencian** el núcleo; no redefinen una entidad, un estado ni un invariante.
Si una épica necesita algo que el núcleo no tiene, se agrega al núcleo — no se declara localmente.

Es el §7 aplicado al documento: *«Debe existir un único motor genérico de billing»*. Una spec
organizada por subdominio reproduce en el papel la duplicación que el §1 nombra como causa de
este programa.

~~**Y las dos épicas no se referencian entre sí.** Lo único que cruza es~~ **Las dos épicas sí
se citan entre sí**: recontado el 2026-09-25 —la cifra no pretende estar al día: se mueve con cada
pasada (FASE 9 completa, `C-14`)—, **74** líneas de `HOS-1354/docs` citan a verticales
(`` `V/NN` `` o *«épica de verticales»*) y **63** de `HOS-1353/docs` citan a billing (`` `B/NN` ``
o *«épica de billing»*) (FASE 8 completa, `F-8CD1-014`). Lo que ninguna de las dos puede mutar
sola es el contrato de cobertura
([`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md)), que vive afuera de las dos
justamente para eso.

## Cuándo un hueco se considera cerrado

Los 72 huecos técnicos de `04-open-decisions.md` los resuelve el diseño **sin el owner**. Un
hueco se cierra cuando un capítulo dice qué pasa en todos sus casos, y en el **mismo commit**
se marca cerrado en `04-open-decisions.md` con el capítulo que lo cerró. La fila no se borra.

Dos reglas de método que salen de los propios huecos y rigen este documento:

- **`O-METH-01`** — *«cerrar todas las decisiones funcionales» no cierra en 1A*. Se registra
  acá: el cierre de una decisión funcional es este diseño, y lo que quede abierto al terminarlo
  se declara abierto, no se completa en silencio (§67).
- **`S-METH-01`** — **cuándo caduca una decisión**. Toda afirmación que se apoye en una medición
  lleva su fecha; una medición de `06` o de `07` caduca si el hecho que mide puede haber cambiado,
  y en ese caso se re-mide antes de implementar, no antes de escribir.

---

## Las tres partes

### El núcleo — acá · `docs/nucleo/`

Lo que las dos épicas comparten. **No se parte**: un glosario en dos mitades deja de ser un
glosario, y ~~54~~ ~~53~~ 52 invariantes (revisión del owner, 2026-09-28, C8: sale `D14`; C14: sale `D16`) numerados de corrido pierden lo único que los hace útiles, que es poder
preguntar **una vez** si están todos.

| # | capítulo | qué define |
|---|---|---|
| `00` | este documento | el mapa y las reglas de escritura |
| `01` | [glosario](./01-glosario.md) | los nombres, el glosario de estados, los cuatro conjuntos que nombra «vivo» (§2.4), el criterio Eje 1 / Eje 2 |
| `02` | [modelo de datos](./02-modelo-de-datos.md) | qué sale de la base y qué del código, **cómo nacen los valores y quién los cambia, y los plazos configurables** (§1.4 y §1.5; revisión del owner, 2026-09-28, N1 y C9), y el registro de eventos |
| `03` | [máquinas de estado](./03-maquinas-de-estado.md) | las siete reglas de lectura que valen para las ~~nueve~~ diez máquinas (la décima, el reembolso: FASE 9 completa, 5a) |
| `04` | [invariantes](./04-invariantes.md) | los 54 (37 del §64 del PDR y 17 de las decisiones), con quién sostiene cada uno |
| `07` | [outbox y notificaciones](./07-outbox-y-notificaciones.md) | el mecanismo de entrega, el dedup y el huso horario; **lo construye `U2`** (§1.4; FASE 5, owner 2026-09-30, lote 2 A) |
| `08` | [auditoría y observabilidad](./08-auditoria-y-observabilidad.md) | qué es auditable y los identificadores de correlación, **que construye `U2`** (§2.4; FASE 5, owner 2026-09-30, lote 2 B) |

### Épica de verticales · `HOS-1353-…/docs/` — **arranca ya**

Once capítulos: `02` modelo de datos sin el precio · `03` Trial, Publicación y Postulación de
Partner · `10` el Eje 2 · `11` trial · `15` entitlements y limits · `17` autorización ·
`18` Partner · `19` superficies · `20` testing · `21` migración · `22` lo legal.

### Épica de billing · `HOS-1354-…/docs/` — **ya no espera la pasarela** (`DEC-MP-005`, 2026-09-24)

Trece capítulos: `02` las entidades de dinero · `03` Suscripción, Grace, Pausa, Pago, Pago manual,
Addon y el no-retroceso · `05` idempotencia · `06` proveedor · `09` conciliación · `10` retiro de
plan ~~y vertical discontinuada~~ (revisión del owner, 2026-09-28, C8) · `12` suscripción · `14` promos, cortesías y grants · `16` addons ·
`19` · `20` · `21` · `22`.

## ✅ El capítulo `13` (Pagos) NO existe, y no es un pendiente: se repartió

**Resuelto el 2026-09-24. La FASE 2 está en 22 de 22.** El `13` figuró nueve días como *«el único
capítulo sin escribir»* y como bloqueo del programa. Al abrirlo con sus ítems pendientes,
**ninguno necesitó un capítulo nuevo**: cada uno tenía dueño en un capítulo ya escrito, y quedó
**al lado de la regla que lo gobierna** en vez de a un archivo de distancia.

| lo que el `13` debía | dónde vive |
|---|---|
| la transición que lleva a `ACTIVE` a un **pagador manual** | **`S29`**, `B/03` §3.2 |
| la columna **`período`** y el candado `C5` | **`covered_period`**, `B/02` §2.3 y `B/05` §C5 |
| qué hace un **reembolso con la cobertura** del período | `B/02` §2.3 y `B/05` §C5 |
| la **mecánica del reembolso** contra el proveedor | **`B/06` §4.6** |
| el **checkout** y el `init_point` | **ya estaban**: `B/06` §6 y §4.2 |
| **quién tiene el reloj de cobro** | **`DEC-MP-006`**: es del proveedor |
| reembolsar un cobro **más viejo que el plazo** | **`DEC-RF-007`**: no se implementa, es manual |
| una **tarjeta cambiada sobre N preapprovals** | ❌ **retirado: deber mal atribuido** |

**El último merece nombre propio, porque explica por qué el capítulo parecía más grande de lo que
era.** `DEC-ADDON-002` implicación 3 le pasaba al `13` el deber de resolver un cambio de tarjeta que
queda a medias sobre varios preapprovals. **Ese flujo no existe**: la implicación 1 de **esa misma
decisión** dice *«no se tokeniza del lado del servidor… no manejamos datos de tarjeta»*, y cambiar la
tarjeta exige un token. **`EX-36` mide que el PROVEEDOR puede; no que nosotros lo hagamos.** Una
capacidad medida del proveedor se había vuelto un deber de diseño sin que nadie lo justificara.

> 📌 **Dos lecciones de método.** La primera: *«el proveedor puede X»* **no es** *«nuestro diseño hace
> X»* — es la misma forma del error que puso a `EX-24`, una fila que mide un **éxito**, en la lista de
> carencias de [`10-evaluacion-de-proveedor.md`](../10-evaluacion-de-proveedor.md) §1. La segunda: un
> capítulo que lleva mucho tiempo declarado como pendiente **puede ser contenido sin domicilio** en
> vez de contenido sin escribir, y conviene preguntárselo antes de escribirlo.

🚧 **Lo único que quedó abierto, y no estaba en ninguna fila de la matriz**: cuando el proveedor
**pausa** por mora, `EX-11` midió que **rechaza toda modificación**. Nosotros no le cambiamos la
tarjeta a nadie —ni queremos—, así que la pregunta es **si el cliente puede recuperar su medio de
pago por su cuenta desde Mercado Pago sobre una suscripción ya pausada**. Si puede, el flujo existe
y es del proveedor. **Si no puede, la suscripción está muerta** y la única salida es un alta nueva
por el checkout. `RN-3` empieza a contestarlo.

---

## Las áreas que el §65 exige, y dónde quedaron

| área del §65 | dónde |
|---|---|
| domain · entities · relations · constraints | `01` y `02` del núcleo, más el `02` de cada épica |
| DB | el `02` de cada épica |
| states · transitions | `03` del núcleo, más el `03` de cada épica |
| invariants | `04` del núcleo |
| services · API | cada subdominio, más el `19` de cada épica |
| jobs | cada subdominio |
| provider · MP | `06` — billing |
| manual payments | **repartido, no hay `13`** (ver arriba): la máquina en `03` de billing y la transición **`S29`** que la cierra · la cuota y su período en `02` · el candado `C5` en `05` |
| outbox | `07` del núcleo |
| trial | `11` — verticales |
| subscription · billing · pause · grace · cancellation | `12` — billing |
| plans · billing options | `10`, partido entre las dos |
| promo · courtesy · grants | `14` — billing |
| addons | `16` — billing |
| entitlements · limits | `15` — verticales |
| auth | `17` — verticales |
| UI · Admin | `19`, partido entre las dos |
| audit · observability | `08` del núcleo |
| reconciliation | `09` — billing |
| testing | `20`, partido entre las dos |
| migration | `21`, partido entre las dos |

---

## Estado

**22 de 22 capítulos escritos, desde el 2026-09-24.** El `13` **no llegó a existir como archivo**:
lo que debía se repartió entre los capítulos que lo reclamaban, y una de sus piezas resultó un
deber mal atribuido. El reparto completo está arriba, en su propia sección.

El desarme se verificó antes de retirar los originales: **105 de 105 encabezados** presentes en
alguna mitad, y el volumen de texto entre **1,06x y 1,29x** del de partida — el excedente es
frontmatter, la frase de encabezado de cada mitad, y las secciones que van a las dos.
