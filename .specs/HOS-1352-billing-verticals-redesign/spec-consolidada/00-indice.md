# 00 · Índice de la spec consolidada de HOS-1352

Rediseño integral de Verticales y Billing de Hospeda: el paraguas `HOS-1352` con sus dos épicas,
`HOS-1353` (verticales, capacidades y autorización) y `HOS-1354` (billing, cobro y proveedor).

## La regla: esta spec es la única fuente para implementar

Por [DEC-METH-019](01-decisiones-vigentes.md#dec-meth-019) (owner, 2026-10-01, lote AF a AO, todas
la recomendada):

- **La spec consolidada es la única fuente para implementar.** El diseño vigente estaba repartido en
  38 archivos, con tachados y precisiones en prosa; acá está en su forma vigente, sin tachados, y lo
  muerto en [90-retirados.md](90-retirados.md).
- **Lo anterior queda congelado como histórico**; un cambio posterior se escribe en la consolidada y
  en el log de decisiones.
- **Las `spec.md` de `HOS-1353` y `HOS-1354` quedan reemplazadas**: siguen como stubs con su
  frontmatter, por Linear, y un aviso que apunta acá
  ([AG](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ag)).
- **Las US, los AC y los tests se derivan, nunca se inventan**: cada uno cita al menos un ítem
  fuente; lo que no tiene fuente va a [80-abiertos.md](80-abiertos.md) como pregunta al owner
  ([AL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-al)).
- **Se acepta sólo con trazabilidad mecánica** (`scripts/trazar.py` en 0 en las dos direcciones) **y
  dos verificaciones ciegas opuestas** —qué falta y qué se inventó—, con canarios, hasta una vuelta
  sin `BLOQUEA`.

Todo sale de las fuentes congeladas en el commit `17f9702675528e00d0981312325bec38bb962113`
(re-congeladas después de aplicar las letras BK a BX del owner): cada
`Origen:` cita `archivo:línea` en ese SHA, y las herramientas leen las fuentes desde ahí
(`scripts/comun.py`), nunca del árbol de trabajo.

**Las letras U a X del 2026-10-01 fueron operativas de la promoción #3447, no de diseño** (U, revisar
las traducciones de novedades; V, el ReDoS de `html-text.ts`; W, los PRs con `whats-new-none`; X, las
traducciones `reviewed`): no entran al inventario ni a esta spec
([AJ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-aj),
[AK](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ak)).

## El mapa de archivos

Se organiza **por pieza del corte y de cada fase, con catálogos únicos**
([AH](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ah)). Un ítem se **define una vez**, en el
archivo que le toca, y se **referencia** desde todos los demás.

| archivo | qué tiene |
|---|---|
| `00-indice.md` | este índice: el mapa, la regla de anclas y cómo leer; las reglas que valen para todas las piezas; y lo que decían la partición del programa, las descomposiciones y las `spec.md` de las dos épicas |
| `01-decisiones-vigentes.md` | las decisiones (`DEC-*`) vivas con sus 📌 fundidos, y el registro de las letras del owner |
| `02-nucleo.md` | las invariantes (`INV`), las acciones administrativas (`ACC`) y los plazos (`PLAZO`) |
| `03-contrato-de-cobertura.md` | el contrato entre las dos épicas, las dependencias entre épicas (`DEP`) y la lista cerrada de ítems sólo citables (BA, BB) |
| `04-catalogos.md` | los catálogos únicos: la matriz de Mercado Pago (`MP`), los guards (`GUARD`), las validaciones del panel (`VAL`), las transiciones (`TRANS`) y las prohibidas (`PROH`), los motivos (`MOT`), los candados (`LOCK`), las reglas `RP` y `M` |
| `10-corte/<Pieza>.md` | las **22 piezas del corte**, una por archivo |
| `20-fase-1/` a `20-fase-4/` | las **8 piezas posteriores**, en la carpeta de su fase |
| `30-el-corte.md` | los pasos del corte, la rama de aborto y el rollback, los gates de aceptación, el smoke, y la pseudo-pieza `CORTE` |
| `80-abiertos.md` | lo que las fuentes declaran no cerrado —con la consulta legal pendiente y lo que las descomposiciones no deciden— y las preguntas al owner que dejó la redacción |
| `90-retirados.md` | todo ítem muerto, con su ancla, su `Origen:` y por qué murió, y el texto que una fuente declara rastro |
| `scripts/` | las herramientas: `inventario.py`, `adjudicar.py`, `asignar.py`, `cobertura.py`, `trazar.py`, `defs.py`, `comun.py` y los canarios |
| `_trabajo/` | lo que producen: `inventario.json`, `adjudicacion.json`, `asignacion.json`, `cobertura.json` |

## Las piezas y las fases

Por [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017): **30 piezas, 22 al corte y 8 después,
en fases aditivas sobre el sistema nuevo**. Una pieza va al corte si sin ella no se apaga el viejo ni
se ejecuta el corte; si sin ella el sistema nuevo cobra mal o regala; si escribe un dato que no se
reconstruye; si cambia la forma de una tabla que tiene filas el día del corte; o si la exige el grafo.
Lo que se difiere llega sin tocar nada de lo construido. **Todo el esquema de las 25 unidades nace en
las migraciones de la rama antes del corte**; una fase posterior no trae migración estructural.

**Al corte (22), en `10-corte/`** — enteras (17) y las mitades *a* de las cinco partidas (5):

| | piezas |
|---|---|
| paraguas | [U1](10-corte/U1.md#pieza-u1), [U2](10-corte/U2.md#pieza-u2), [U3](10-corte/U3.md#pieza-u3) |
| verticales | [V1](10-corte/V1.md#pieza-v1), [V2](10-corte/V2.md#pieza-v2), [V3](10-corte/V3.md#pieza-v3), [V4](10-corte/V4.md#pieza-v4), [V5](10-corte/V5.md#pieza-v5), [V6](10-corte/V6.md#pieza-v6), [V8a](10-corte/V8a.md#pieza-v8a), [V9a](10-corte/V9a.md#pieza-v9a) |
| billing | [B1](10-corte/B1.md#pieza-b1), [B2](10-corte/B2.md#pieza-b2), [B3](10-corte/B3.md#pieza-b3), [B4](10-corte/B4.md#pieza-b4), [B5](10-corte/B5.md#pieza-b5), [B6](10-corte/B6.md#pieza-b6), [B7](10-corte/B7.md#pieza-b7), [B8a](10-corte/B8a.md#pieza-b8a), [B9a](10-corte/B9a.md#pieza-b9a), [B11](10-corte/B11.md#pieza-b11), [B13a](10-corte/B13a.md#pieza-b13a) |

**Después (8), en cuatro fases, en este orden**
([AW](01-decisiones-vigentes.md#own-41-corte-del-mvp-t5-aw); los gates, en
[30-el-corte.md](30-el-corte.md#gate-fp)):

| fase | carpeta | piezas |
|---|---|---|
| 1 | `20-fase-1/` | [V9b](20-fase-1/V9b.md#pieza-v9b) |
| 2 | `20-fase-2/` | [B8b](20-fase-2/B8b.md#pieza-b8b), [B9b](20-fase-2/B9b.md#pieza-b9b) |
| 3 | `20-fase-3/` | [B10](20-fase-3/B10.md#pieza-b10), [B13b](20-fase-3/B13b.md#pieza-b13b), [B12](20-fase-3/B12.md#pieza-b12) |
| 4 | `20-fase-4/` | [V7](20-fase-4/V7.md#pieza-v7), [V8b](20-fase-4/V8b.md#pieza-v8b) |

Cada fase posterior viaja en una rama épica nueva, con los mismos gates por unidad, y entra a
`staging` entera ([AE](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-ae)). La partición de
las cinco unidades en mitades *a* y *b* es la de
[Z](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-z).

**El grafo, recontado después de las letras BL a BR**
([DEC-ARCH-017#📌6](01-decisiones-vigentes.md#dec-arch-017-p6)): **30 piezas, 22 al corte, 35 guards
con 34 al corte, 62 flechas y cero violaciones**. Las dos flechas nuevas son las de
[BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br), **`U2 → B3` y `U2 → V4`**: el outbox
común va antes de las primeras piezas que encolan, y por transitividad antes de todas las demás que
encolan. Las otras letras de ese lote (BL, BN, BO y BP) y BW no agregan flechas.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:7946, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:7972

## Reglas que valen para todas las piezas

Cinco letras del owner del 2026-10-02 fijan cómo se reparte y cómo se cierra el trabajo entre
piezas. Se definen en [01-decisiones-vigentes.md](01-decisiones-vigentes.md); acá van en una línea
cada una, para que quien abre una pieza las tenga a la vista.

- **Una pieza anterior que llama a algo que construye una posterior**
  ([BL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)): la anterior escribe su rama entera y
  la llamada contra una interfaz interna, y la posterior trae la implementación sin tocar código
  anterior; si lo llamado ya existe cuando llega la anterior, la anterior lo hace entero; un
  criterio que necesita la implementación real va al *«Lista cuando»* de la posterior.
- **Qué pieza crea una tabla que usan dos piezas del corte**
  ([BN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bn)): la primera pieza del grafo que la
  escribe o la referencia, con todas sus restricciones; si una `FK` suya apunta a una tabla que nace
  después, nace con la dueña de la tabla destino, y la rama que la escribe se completa ahí y se prueba
  con filas sembradas. **`domain_event`, el registro de auditoría, la crea `U2`**
  ([BW](01-decisiones-vigentes.md#own-41-corte-del-mvp-t10-bw),
  [DEC-ARCH-017#📌7](01-decisiones-vigentes.md#dec-arch-017-p7)), y no `V9a`: la escriben antes
  `V2`, `V4` y `B3`, y `U2` es ancestro de todas ellas.
- **Los precios del corte son los vigentes hoy**
  ([BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm),
  [DEC-MP-002#📌2](01-decisiones-vigentes.md#dec-mp-002-p2)): los carga el paso 3a y no se cambian
  durante el corte; **ningún precio cambia hasta que el momento 5 esté cumplido**
  ([GATE:M5](30-el-corte.md#gate-m5)). El código de la acción 19 es de `B2`; su uso queda vedado
  hasta el momento 5, como regla de operación y no como control del código.
- **Los detalles que las fuentes dejan a la implementación**
  ([BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs),
  [DEC-METH-019#📌4](01-decisiones-vigentes.md#dec-meth-019-p4)) —la ruta, el permiso y el
  `error.code` de cada acto y de cada rechazo, el nombre de una tabla auxiliar, una cadencia, las
  listas que viven en el código, el texto de un aviso que la fuente deja a producto, los labels de
  Linear, las credenciales—: **los propone el PR de la pieza dueña siguiendo lo escrito del repo, los
  aprueba la revisión de contexto fresco del momento 1** (y el owner en el PR cuando es texto al
  cliente o un permiso nuevo) **y quedan escritos en la sección de la pieza en esta spec al
  mergear**. No entra lo que es regla comercial ni lo que cambia comportamiento.
- **Las mediciones de producción que una pieza necesita**
  ([BT](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bt)): las corre esa pieza con
  `hops psql --target=prod`, en sólo lectura y contando, antes de su merge, y deja el número en el
  PR; si da cero no hay nada que decidir, y si no, vuelve al owner con el número antes del merge.
  Una salida vacía de `hops psql` no es un cero: se repite. Hoy son dos: `V6` mide las filas de
  `partners` con `owner_user_id` repetido, y `U1` las del rol de dueño de comercio, sus permisos y
  su tabla de contactos.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:7946, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:7977, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1463, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:8100, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:603

## Cómo leer un archivo de pieza

Cada archivo de pieza lleva **la plantilla completa**
([AO](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ao)), con estos encabezados `##`, en este
orden; una sección que no aplica dice `N/A — <razón con cita>` y nunca se borra:

1. Objetivo, alcance y fuera de alcance
2. Historias de usuario y criterios de aceptación
3. Reglas
4. Modelo de datos y migraciones
5. API
6. UI web y admin, e i18n
7. Cron y outbox
8. Variables de entorno
9. Auditoría y observabilidad
10. Seguridad
11. Testing esperado
12. Smoke y etiquetas
13. Dependencias, rollback y despliegue
14. Labels de Linear
15. Abiertos
16. Origen

- **Las historias de usuario** van por actor, de una lista cerrada: anfitrión, dueño de comercio,
  partner, admin, turista, sistema/cron
  ([AM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-am)).
- **Los criterios de aceptación** van en Dado/Cuando/Entonces, con id `AC:<pieza>:n`; el *«Lista
  cuando»* de la pieza es su AC de salida. Todo ítem del que la pieza es dueña en el contrato de
  cobertura tiene al menos un AC en ella; lo que la pieza sólo ejerce o provee se referencia.
- **Los tests** van con id `TEST:<pieza>:n` y un tipo de la lista cerrada
  ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): unitario, integración con DB, ruta
  API, guard estático, migración desde cero, migración sobre datos, e2e web, e2e admin y smoke manual,
  éste con su etiqueta `local`, `staging` o `prod` (y `MP sandbox` cuando corresponde). Cada
  invariante con al menos un test; cada transición, también las prohibidas, con un test de
  integración con DB; cada guard con su prueba de mutación.
- **La pseudo-pieza `CORTE`** ([BE](01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-be)): los
  pasos, los gates y las decisiones que sólo el corte ejecuta llevan su `AC:CORTE:n` y su
  `TEST:CORTE:n` en [30-el-corte.md](30-el-corte.md#ac-corte-1), sin US, con tipo smoke manual o guard
  estático.

## La regla de anclas

Todo ítem se define con un ancla y su origen, y se referencia con un link a esa ancla. El formato lo
fija `scripts/trazar.py` y no admite variantes:

- **Definición**: una línea sola con el ancla HTML `a` de `id` igual al slug, abierta y cerrada en la misma línea (`<a id="<slug>">` y su `</a>` pegado), y después el bloque del ítem —hasta la
  próxima ancla o el próximo encabezado `#` o `##`— con una línea
  `Origen: <archivo>:<línea>[, <archivo>:<línea>…]`, con rutas desde la raíz del repositorio. La
  primera posición es la del ítem en el SHA congelado, y esa línea contiene su id local; las demás son
  la evidencia.
- **Slug**: el id canónico en minúsculas, con 📌 → `p` y toda otra secuencia de caracteres que no sea
  letra ni dígito → `-`. Por ejemplo, `DEC-SUB-008` → `dec-sub-008`; `TRANS:B:S1` → `trans-b-s1`;
  `DEC-ARCH-017#📌5` → `dec-arch-017-p5`; `PASO:0b` → `paso-0b`.
- **Referencia**: `[DEC-SUB-008](01-decisiones-vigentes.md#dec-sub-008)`. Nunca se redefine lo que
  vive en otro archivo.
- **Historia de usuario**: el ancla de id `us-<pieza>-<n>` y una línea con `US:<Pieza>:<n>`, otra
  `Actor: <actor>` y otra `Fuente:` con los links a los ítems que la sostienen.
- **Criterio de aceptación**: el ancla de id `ac-<pieza>-<n>`, `AC:<Pieza>:<n>`, las líneas `Dado …`,
  `Cuando …` y `Entonces …`, y `Fuente: …`.
- **Test**: el ancla de id `test-<pieza>-<n>`, `TEST:<Pieza>:<n>`, `Tipo: <tipo>`, `Cubre:` con los
  links a sus AC y `Fuente: …`; un smoke manual suma `Etiqueta:`, y un guard estático que cubre un
  guard suma `Mutación:` (cómo se rompe a propósito).
- **Un ítem muerto** tiene su ancla en [90-retirados.md](90-retirados.md) y en ningún otro lado. Un
  ancla que no sea un ítem del inventario ni una US, un AC o un test es un invento, y `trazar.py` la
  rechaza.

## Cómo leer el contenido

- **Lo vigente, sin tachados.** Cada ítem está en su forma vigente: el texto sin lo tachado, con los
  📌 vivos ya fundidos en su decisión y las partes muertas omitidas. Las filas `MIXTO` y los 📌 que
  caen en prosa los adjudicó un agente, con cita y hash de línea
  ([AI](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ai)); una adjudicación caduca si cambia la
  línea fuente.
- **Qué exige un AC.** Un ítem normativo vivo —una decisión (menos las de metodología), un 📌, una
  fila de pieza, un *«Lista cuando»*, un guard, una invariante, una transición o una prohibida, una
  acción administrativa, un plazo, un motivo, un candado, una regla `RP` o `M`, un paso, un gate, un
  traslado del corte, una validación del panel o una dependencia entre épicas— tiene al menos un AC
  ([AX](01-decisiones-vigentes.md#own-41-corte-del-mvp-t5-ax),
  [AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)). **La matriz, las letras del owner y la
  lista de piezas son sólo citables**, y también la lista cerrada de
  [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)
  ([BA](01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-ba),
  [BB](01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-bb)).
- **Lo muerto** está en [90-retirados.md](90-retirados.md), con por qué murió. No se implementa.
- **Lo abierto** está en [80-abiertos.md](80-abiertos.md): lo que las fuentes declaran no cerrado y
  las preguntas al owner que dejó la redacción. Un abierto no es un criterio: no lleva US, AC ni test.
- **Lo inferido** se marca como tal en el texto (*«inferido»*, o *«la fuente lo derivó y lo
  marca»* cuando la marca viene de la fuente).

## Cómo se comprueba

```
python3 scripts/trazar.py _trabajo/inventario.json _trabajo/adjudicacion.json . --cobertura=_trabajo/cobertura.json
```

desde esta carpeta. Las reglas R1 a R17 (más R7b y R7c) están en el encabezado del script; la spec se
acepta con el resultado `APROBADO (0)` y las dos verificaciones ciegas sin `BLOQUEA`.

## La partición del programa en dos épicas

Lo que `D/11-particion-del-programa.md` decide, en su forma vigente. **Decisión del owner,
2026-09-18**: el programa se parte en dos épicas bajo la épica principal, **Verticales** y
**Billing** ([DEC-ARCH-005](01-decisiones-vigentes.md#dec-arch-005)). Lo que sigue no decide si
partir: decide **por dónde pasa el corte**, y lo declara de una sola forma para que no aparezcan
seis repartos como pasó con `qzpay` (`F-1B-132`).

### Por qué se parte, y qué lo destrabó

El 2026-09-18 la pasarela estaba sin decidir; se decidió el 2026-09-24
([DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005)), y **la partición sigue en pie por una razón
que nunca dependió de la pasarela**: el dinero y las capacidades son dos materias (FASE 9 vuelta 1,
contradicción (b)).

**Aquel bloqueo alcanzaba al dinero y no alcanzaba a las capacidades.** Qué puede hacer una cuenta,
qué publica cada vertical, cómo se agregan los limits, quién está autorizado a qué: nada de eso
necesita saber con qué pasarela se cobra. Se estaba esperando por una razón que no aplicaba a la
mitad del programa.

**Y hay una medición que lo confirma desde otro ángulo.** De los 21 capítulos escritos de la Master
Spec, **ocho no citan ni una sola medición del proveedor** —índice, glosario, verticales, trial,
entitlements, autorización, Partner y migración—, contados con `rg`. Esos ocho son, casi
exactamente, la épica de verticales. El corte no hubo que inventarlo: ya estaba en el material.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:20, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:28, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:33, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:38

### La frontera, en una línea

> **Es BILLING si necesita saber un precio, ejecutar o interpretar un cobro, o hablar con la
> pasarela.**
> **Es VERTICALES si sólo necesita saber qué puede hacer una cuenta, sin preguntar si pagó.**

Es el criterio del owner —*«toca plata o no toca plata»*— aplicado a este reparto. Y no es una
formulación nueva: el capítulo 15 ya la había escrito al cerrar, distinguiendo su materia de la del
capítulo 14 con las palabras exactas —*«acá se agregan **capacidades**, allá se compone
**dinero**»*—.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:45, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:47, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:51

#### El corte pasa por dentro del catálogo de planes, no por afuera

Es el punto donde el reparto se equivoca si se hace por nombre. «Plan» suena a billing y no lo es:
de las seis entidades del catálogo comercial (cap. 02 §2.1), **cinco no tienen un solo campo de
dinero**.

| entidad | qué guarda | lado |
|---|---|---|
| `vertical` | el espejo en base del enum de código | **VERTICALES** |
| `plan` | vertical, slug, nombre, descripción, orden en la pricing | **VERTICALES** |
| `plan_version` | `rank`, vendible, días de grace, días de trial, permite pausa, hereda Turista VIP | **VERTICALES** |
| `plan_version_entitlement` | qué clave otorga, y las dos cuotas de las medidas | **VERTICALES** |
| `plan_version_limit` | qué clave limita y con qué valor | **VERTICALES** |
| **`billing_option`** | **el ciclo y su precio: monto y moneda** | **BILLING** |

El propio capítulo 02 lo dice al pie de esa tabla: *«El precio cuelga de la versión, no del
plan»*. O sea que el precio vive en **una sola tabla hoja**, y todo lo que está encima de ella es
configuración de capacidades.

**Esto es lo que vuelve independiente al trial.** Su plan se deriva *«del plan vendible de `rank`
más alto y del más bajo»* (cap. 02 §2.1), y `rank` y `vendible` son columnas de `plan_version`. La
derivación no toca `billing_option` en ningún punto: **un trial se puede resolver entero sin que
exista un precio en la base.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:56, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:58, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:62, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:71, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:75

#### Lo que el corte NO es

- **No es por entidad, es por campo.** El mismo `plan_version` sostiene el `rank` (verticales) y
  cuelga del `billing_option` (billing). Cortar por tabla obliga a elegir mal.
- **No es «lo que menciona a billing».** Un capítulo que dice *«ver capítulo 12»* no es billing. La
  pregunta es qué necesita para **funcionar**, no a quién nombra.
- **No es una separación de despliegue.** Son dos épicas de trabajo sobre el mismo sistema, no dos
  sistemas.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:80, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:82, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:84, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:86

### El reparto, capítulo por capítulo

`VERTICALES` · `BILLING` · `PARTIDO` (cada mitad va a su épica) · `COMPARTIDO` (las dos lo
necesitan igual y no se puede partir sin duplicarlo).

| # | capítulo | lado |
|---|---|---|
| 00 | índice y reglas de escritura | **COMPARTIDO** |
| 01 | glosario y modelo conceptual | **PARTIDO** — identidad, vertical y capacidades a verticales; catálogo comercial, compromiso de pago y concesiones a billing |
| 02 | modelo de datos | **PARTIDO** — §2.1 menos `billing_option`, §2.5 y §3 a verticales; §2.2, §2.3, §2.4 y **§2.6** a billing. El **§2.6** —qué cuelga de una suscripción y qué le pasa cuando otra la sucede— es nuevo de la FASE 9-bis-3 y toma un número que ninguna de las dos mitades usaba, porque el §2.5 ya es de verticales |
| 03 | las máquinas de estado | **PARTIDO** — trial, publicación y postulación de Partner a verticales; suscripción, grace, pausa, pago, pago manual, addon y el no-retroceso a billing |
| 04 | invariantes | **PARTIDO** — los de acceso, trial y roles a verticales; los de dinero y proveedor a billing; los de método, compartidos |
| 05 | idempotencia y concurrencia | **BILLING** |
| 06 | abstracción de proveedor | **BILLING** |
| 07 | outbox y notificaciones | **PARTIDO** — el mecanismo es compartido, **y lo construye [U2](10-corte/U2.md#pieza-u2), una unidad del paraguas y no de ninguna de las dos épicas, que depende de `U1` y va antes de las piezas que encolan**: `V6`, `V9a`, `V9b`, `B4` y `B12` (FASE 5, owner 2026-09-30, lote 2 A; `NUCLEO/07` §1.4), **y desde [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br) también `V4` y `B3`**, que encolan antes y cubren por transitividad al resto; del catálogo de correos, los dos del trial a verticales y el resto a billing |
| 08 | auditoría y observabilidad | **PARTIDO** — el criterio y la correlación son compartidos, **y la correlación la construye `U2`, con el outbox** (FASE 5, owner 2026-09-30, lote 2 B; `NUCLEO/08` §2.4), **que crea también `domain_event`, el registro de auditoría** ([BW](01-decisiones-vigentes.md#own-41-corte-del-mvp-t10-bw)); del catálogo de acciones admin, la postulación de Partner y la extensión de trial a verticales |
| 09 | conciliación | **BILLING** |
| 10 | verticales, planes y billing options | **PARTIDO** — el Eje 2 y la lectura del catálogo a verticales; el retiro de un plan a billing (la vertical discontinuada salió: revisión del owner, 2026-09-28, C8) |
| 11 | trial | **VERTICALES** |
| 12 | suscripción | **BILLING** |
| 13 | pagos | **BILLING** — no se escribió: se repartió entre `B/02` §2.3, `B/03` `S29` y §6.1, `B/05` C5 y `B/06` §4.6 cuando se decidió la pasarela |
| 14 | promos, cortesías y grants | **BILLING** |
| 15 | entitlements y limits | **VERTICALES** — con la salvedad del §6, que lee el estado de la suscripción a través de `cobertura()` |
| 16 | addons | **BILLING** — el §4.1 reutiliza el reconciliador de verticales, no lo duplica |
| 17 | autorización | **VERTICALES** |
| 18 | Partner | **VERTICALES** |
| 19 | superficies | **PARTIDO** — Mi Cuenta, los mensajes de trial y de excedente y las postulaciones a verticales; la pricing, Mi Suscripción y la baja a billing |
| 20 | testing | **PARTIDO** — los guards de verticales y los de billing, el proveedor falso y la suite de sandbox a billing; los guards de cada pieza, en el [catálogo](04-catalogos.md) |
| 21 | migración | **PARTIDO** — el trial ya consumido a verticales; el conteo de pagos y el riesgo de cobro durante el rediseño a billing |
| 22 | lo legal | **PARTIDO** — las señales de identidad y el seudónimo del correo a verticales; el aumento, la revocación y el botón de arrepentimiento a billing ([80-abiertos.md](80-abiertos.md), *«Consulta legal pendiente»*) |

**Cinco capítulos son billing sin una sola fisura**: 05, 06, 09, 12 y 14. Ninguna de sus secciones
sobrevive sin la pasarela. **Tres son verticales enteros**: 11, 17 y 18.

*(Lo que difiere de la tabla de la fuente, y de dónde sale: el capítulo 13 se repartió con
`DEC-MP-005` y `DEC-MP-006` —`B/descomposicion.md`, recuadro inicial—; la vertical discontinuada
salió con C8; las piezas que esperan a `U2` son las de `V/descomposicion.md` §3 con la partición de
[Z](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-z) y BR; la fila 20 ya no nombra los
guards uno por uno porque se movieron de pieza después de la partición —`G8`, por ejemplo, es de
`U1`—, y el censo vivo es el catálogo.)*

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:169, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:171, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:174, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:200, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:203, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:19, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:602, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:623

#### Los capítulos se movieron

**Corregido el 2026-09-18, el mismo día**: la versión primera decía que los capítulos quedaban donde
estaban y que la tabla era sólo un índice de lectura. Era correcto mientras las dos specs sólo
declaraban alcance, y dejó de serlo cuando el owner pidió que fueran autónomas: si los capítulos se
quedan en un lugar **y además** cada spec los absorbe, hay dos fuentes para lo mismo.

**Lo que efectivamente se hizo** ([DEC-ARCH-005](01-decisiones-vigentes.md#dec-arch-005); el
desarme se ejecutó el 2026-09-18):

| dónde | qué |
|---|---|
| `HOS-1353-…/docs/` | **11 capítulos**, los de verticales |
| `HOS-1354-…/docs/` | **13 capítulos**, los de billing |
| `HOS-1352-…/docs/nucleo/` | **7**: reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas de estado |

Los siete capítulos mixtos se partieron de verdad, y **los originales se retiraron**: dejarlos habría
sido la segunda fuente. `09-master-spec/` ya no existe. **Lo que sí se conservó son los números**:
verticales tiene los capítulos 11, 15, 17 y 18, salteados; son identificadores, no orden, y
renumerarlos rompería las referencias cruzadas entre capítulos. **Y el riesgo de partir era real**:
105 encabezados podían perderse en el camino, así que el desarme se verificó antes de retirar ningún
original —105 de 105 presentes en alguna mitad, y el volumen de texto entre 1,06x y 1,29x del de
partida—.

Desde [DEC-METH-019](01-decisiones-vigentes.md#dec-meth-019), esos 38 archivos son histórico
congelado y la fuente para implementar es esta spec.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:205, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:207, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:214, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:216, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:222, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:225, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:229

### Un dato de migración que refuerza la elección

El capítulo 21 midió que **Gastronomía, Experiencia y Partner tienen cero filas** y que **no hay un
solo pago histórico**. Las tres verticales que el rediseño viene a ordenar no cargan ninguna deuda
de datos. Es decir: la épica de verticales no sólo es independiente **por diseño** —no pregunta por
dinero— sino también **por datos**: no tiene nada que migrar y nada que romper. Los compromisos de
cobro vivos que existen están del otro lado de la frontera.

*(Dos precisiones posteriores: los compromisos vivos eran tres según la base, y el recorrido del
proveedor encontró una cuarta autorización viva que la base no conocía —[paso 1a](30-el-corte.md#paso-1a)—;
y si `partners` tiene filas en producción lo mide la pieza que lo necesita antes de su merge
—[BT](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bt); ver [80-abiertos.md](80-abiertos.md),
§1—.)*

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:239, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:241, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:245

### Autónomas para desarrollar, juntas para liberar

**«Autónomas» significa que ninguna espera a la otra para avanzar. No significa que una pueda salir
a producción sola.** Las dos llegan **juntas y terminadas**
([DEC-ARCH-007](01-decisiones-vigentes.md#dec-arch-007)). Hay que decirlo con todas las letras
porque la ambigüedad ya costó: una sesión llegó a proponer construir un adaptador sobre el billing
actual —código real sobre un sistema condenado, escrito para tirarlo— para que verticales pudiera
llegar sola. **Esa premisa nunca existió.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:251, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:253, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:256

#### El flujo de ramas lo hace cumplir

No es una regla que alguien tenga que recordar: **es la forma del flujo**. Misma lógica que la
condición A de [DEC-ARCH-004](01-decisiones-vigentes.md#dec-arch-004): convertir *«no lo hagas»* en
*«no se puede»*.

| | |
|---|---|
| **la rama de integración** | `epic/HOS-1352-verticales-billing`, **nace para recibir el PR de `U1`**, que es el primer código, **de `staging` y con el CI ya encendido** ([momento 1](30-el-corte.md#gate-m1); FASES 6 y 7, D-1 y A). Los documentos siguen yendo por su rama de spec, que sí va a `staging`: son documentación y no despliegan nada |
| **las sub-épicas** | cortan de ella y mergean **a ella**. Nunca a `staging` directamente |
| **`staging` → paraguas** | periódicamente y **como obligación**, nunca al revés hasta el final |
| **dónde se revisa** | **en los PRs de sub-épica → paraguas**. El PR final a `staging` va a ser enorme y nadie lo puede revisar de verdad: es el merge de algo ya revisado, no el momento de mirar; tiene su propio gate ([momento 2](30-el-corte.md#gate-m2)) |
| **las fases posteriores** | cada una viaja en una rama épica nueva, con los mismos gates por unidad, y entra a `staging` entera ([AE](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-ae); [las fases posteriores](30-el-corte.md#gate-fp)) |

**Es una excepción declarada** al flujo de 6 pasos del `CLAUDE.md` del repo, que exige que toda rama
salga de `staging` y vuelva a `staging`. Queda escrita acá para que el próximo agente que entre no la
«corrija».

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:260, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:262, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:265, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:272, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1050

#### Qué significa «terminada» para una épica

**No significa «en producción».** Significa **lista y verificada contra el contrato**, esperando a la
otra. Lo que eso exige pieza por pieza y para la rama entera son los gates de los momentos 1 y 2
([30-el-corte.md](30-el-corte.md#gate-m1)); con
[DEC-ARCH-007#📌3](01-decisiones-vigentes.md#dec-arch-007-p3), *«juntas y terminadas»* es el
alcance del corte, las 22 piezas.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:276, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:278

#### Y el riesgo cambia de forma

No es la coexistencia de dos sistemas en producción —no la hay— sino **la espera**: si una épica
termina meses antes, su código espera, y una rama que vive meses acumula conflictos con todo lo que
entre a `staging` mientras tanto. Lo acotan el merge periódico de `staging` hacia el paraguas y la
integración continua. **Cómo se integra sin activar** lo resolvió la FASE 7 del paraguas: no hay
convivencia ni interruptores, el nuevo se despliega entero de una vez en el corte, y desde que la
épica entra `staging` queda congelado para `main` hasta el corte ([paso 0b](30-el-corte.md#paso-0b),
[paso 3](30-el-corte.md#paso-3)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:281, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:283

### Lo que esta partición NO decide

Todo lo que la partición dejaba afuera ya lo cerró otra decisión:

- **Cuál es la pasarela: cerrado por [DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005)**
  (2026-09-24): Mercado Pago. La PRUEBA 0 y el KYC de Mobbex que este punto esperaba nunca
  recibieron respuesta, así que la evaluación de proveedor se cerró en el paso 4 de 6 sin
  completarse.
- **Si el capítulo 13 adopta el cargo puntual como modelo canónico: cerrado por
  [DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)** (2026-09-24): no. El modelo canónico es el
  **mandato del proveedor**, porque [MP:EX-31](04-catalogos.md#mp-ex-31) midió que el cargo puntual
  contra credencial guardada **no está habilitado para nuestra aplicación** (`403` en las cuatro
  formas de pedirlo). **Sin destino pendiente desde el 2026-09-26** (su 📌: la habilitación no tuvo
  respuesta).
- **Qué se reescribe y qué se reutiliza del código actual: cerrado por
  [DEC-METH-017](01-decisiones-vigentes.md#dec-meth-017)** (la FASE 5) **y
  [DEC-METH-018](01-decisiones-vigentes.md#dec-meth-018)** (el pase de la FASE 6, en paralelo a `U1`,
  para lo que la FASE 5 dejó sin veredicto). Es el gate propio de
  [DEC-METH-003](01-decisiones-vigentes.md#dec-meth-003), que la partición no toca.
- **El orden de implementación dentro de la épica de verticales**: es de su descomposición, no de la
  partición; está más abajo, en *«El orden de verticales»*, y la partición en piezas del corte y
  fases es la de [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:290, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:292, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:296, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:301, .specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:303, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:761

## Cómo se cortan y se ordenan las unidades

Lo que dicen las dos descomposiciones (`V/descomposicion.md`, `B/descomposicion.md`) sobre el
criterio de corte, el orden y dónde vive cada unidad. **No son un plan de fechas ni el atomizado en
tareas**: son el corte en unidades de trabajo y el orden que sale de las dependencias del propio
diseño; el atomizado de cada unidad se hace cuando esa unidad arranca. Las unidades son hoy las
**30 piezas** de [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017) (arriba, *«Las piezas y las
fases»*); qué deja demostrado cada una es su *«Lista cuando»*, en su archivo.

### El criterio de corte de verticales

**Se corta siguiendo la cadena de preguntas del diseño**, no por capa técnica ni por capítulo.
Cortar **por capa** —toda la base, después todos los servicios, después la API— tiene el problema
conocido: nada funciona hasta el final, y el primer error de modelado se descubre cuando ya hay tres
capas encima. Cortar **por capítulo** es peor: los capítulos son ejes de diseño y se cruzan —el `02`
toca todo, el `15` y el `17` se necesitan mutuamente—.

La cadena que sí ordena es la del propio sistema, y cada eslabón deja **una pregunta contestada**:

```text
¿qué verticales y qué claves existen?      → V1
¿qué otorga un plan?                        → V2
¿qué puede hacer esta cuenta?               → V3
¿tiene título vivo?                         → V4
¿puede hacer ESTO, acá y ahora?             → V5
¿qué pasa cuando algo baja?                 → V6
```

Las tres últimas —Partner (`V7`), superficies (`V8a`, `V8b`) y retención (`V9a`, `V9b`)— no están
en la cadena porque **no la condicionan**: se apoyan en ella.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:16, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:18, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:20, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:25, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:36

#### Dos reglas que valen para todas las de verticales

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después es un
   guard que se escribe contra código ya escrito, y para entonces ya hay call sites que lo violan. Y
   cada uno **lleva su caso que lo hace fallar a propósito**: un guard que no puede fallar es un
   comentario con exit code 0. (Es la condición 2 del [momento 1](30-el-corte.md#gate-m1-2).)
2. **Ninguna unidad pregunta por dinero.** Si una lo necesita, es señal de que el corte de
   [DEC-ARCH-005](01-decisiones-vigentes.md#dec-arch-005) se está filtrando: se mira, no se resuelve
   en el lugar.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:39, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:41, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:45

### El criterio de corte de billing

**Se corta por lo que sobrevive a la respuesta del capítulo 13**, no por capa técnica ni por
capítulo. Cortar **por capa** tiene el problema conocido: nada funciona hasta el final, y el primer
error de modelado se descubre con tres capas encima. Cortar **por capítulo** es peor acá que en la
otra épica, porque los tres capítulos transversales —el `02`, el `03` y el `05`— no tienen materia
propia: se reparten entre cinco, seis y cuatro unidades respectivamente.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:49, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:51, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:54

#### La restricción que la otra épica no tenía

**Doce de los trece capítulos se escribieron con la forma de Mercado Pago puesta** —el
`preapproval`, su checkout, su pausa nativa—, y [DEC-ARCH-004](01-decisiones-vigentes.md#dec-arch-004)
llegó **al día siguiente** de casi todos ellos: los capítulos son del 2026-09-17, la decisión del 18.
Lo que esa decisión dice sobre lo ya escrito está en su implicación 3: *«las 20 decisiones acopladas
se revisan, no se reescriben. En cada una la política sobrevive y lo que se revisa es la forma»*.

**Entonces el corte no puede seguir el mecanismo: tiene que seguir la política.** Una unidad definida
como *«crear el preapproval y mandar al checkout»* dejaría de existir si el 13 contestaba que el cargo
puntual contra tarjeta guardada era el modelo canónico. Una definida como *«que exista un compromiso
de cobro vivo, con la ventana en que todavía no lo es»* sobrevive a las dos respuestas, y lo que
cambia adentro es qué se hace en esa ventana. Las trece unidades están enunciadas así a propósito.

**Y el 13 contestó lo mismo que hace Mercado Pago**
([DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006), 2026-09-24): el reloj de cobro es del proveedor
y el mandato es el modelo canónico, **sin destino pendiente** (su 📌 del 2026-09-26: la habilitación
del cargo puntual no tuvo respuesta). **El reparto no se redibujó**; lo que cambió es el interior de
`B6`. Desde [DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005) las unidades que llaman a la pasarela
se construyen contra el adaptador de Mercado Pago, y nada del reparto espera a un tercero (FASE 9
completa, salida 3 de [DEC-METH-004](01-decisiones-vigentes.md#dec-meth-004)).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:59, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:61, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:67, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:73, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:78, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:19

#### La cadena que ordena

Cada eslabón deja **una pregunta contestada**:

```text
¿cómo se le habla a una pasarela, y cómo miente?   → B1
¿cuánto cuesta?                                     → B2
¿hay un compromiso de cobro vivo?                   → B3
¿esta persona está cubierta?                        → B4
¿qué dinero se movió?                               → B5
¿cómo se mueve el dinero?                           → B6
¿qué pasa cuando no entra?                          → B7
¿qué pasa cuando el cliente cambia de idea?         → B8a, B8b
```

`B6` ya no está bloqueada ([DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)). Las cinco
últimas —concesiones (`B9a`, `B9b`), addons (`B10`), conciliación (`B11`), el catálogo que se retira
(`B12`) y superficies (`B13a`, `B13b`)— no están en la cadena porque **no la condicionan**: se apoyan
en ella.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:83, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:85, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:93, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:98

#### Tres reglas que valen para todas las de billing

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después se escribe
   contra código ya escrito, y para entonces hay call sites que lo violan: nace con una lista de
   excepciones, que es exactamente cómo un guard deja de servir. Y cada uno **lleva su caso que lo
   hace fallar a propósito**: un guard que no puede fallar es un comentario con exit code 0.
2. **Ninguna unidad le cree a un código de estado.** Toda mutación se verifica releyendo y
   comparando **campo por campo cada campo que se mandó**, y ninguna aserción de test se escribe
   sobre un `2xx`. No es criterio: está medido nueve veces que este proveedor **acepta y descarta**,
   y que un `PUT` con varios campos se aplica a medias con un solo `200`
   ([MP:EX-20](04-catalogos.md#mp-ex-20)).
3. **Lo que toca plata no se ejecuta solo.** Toda divergencia de monto, estado o cobro **abre una
   marca `requiere_conciliación`, con su MOTIVO** (`B/02` §2.5; el catálogo de
   [motivos](04-catalogos.md)), y la mira una persona. Es el criterio del owner —*«toca plata o no
   toca plata»*— aplicado adentro de la épica que toca plata entera. **El motivo es parte de la
   regla**: el corpus escribe **veinticuatro** marcas distintas sobre la misma casilla (FASE 8
   completa: `F-8CB1-013`, `F-8CB3-009`, `F-8CB3-003`, `DEC-SUB-020`, y la pendiente 6, owner
   2026-09-25; FASE 9 completa: el 21 con la decisión 3d y el 22 con `F-8CB2-003`), y **nueve**
   dicen *«hay plata del cliente que devolver»* (el 23 y el 24, con su `SÍ`, desde la FASE 9 vuelta
   2, `R4` y `R20`); sin el motivo todas llegaban iguales a la bandeja y las que se perdían eran
   ésas.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:101, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:103, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:108, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:112

### El orden de verticales, y qué se puede hacer en paralelo

Con el corte del MVP ([Z](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-z) y
[AC](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-ac)); las piezas posteriores van entre
corchetes:

```text
U1 ──► U2 ──► V4 (BR), V6, V9a, [V9b]
V1 ──► V2 ──► V3 ──► V4 ──► V5 ──► V6 ──► V8a ──► [V8b]
                                └──► [V7] ──────────┘
            V4, V6 ──► V9a ──► [V9b]
```

| | |
|---|---|
| **camino crítico del corte** | `U1 → V1 → V2 → V3 → V4 → V5 → V6 → V8a` |
| **las partidas** | `V8a → V8b` y `V9a → V9b`: la parte *b* espera a la *a* |
| **`V7`** | espera a `V5`, y la espera sólo `V8b` |
| **`V9a`** | espera a `V4`, `V6` y `U2` (la flecha de `V6` se escribe explícita) *(que `V9a` espere a `U2` lo dejó la fuente por regla —heredó la flecha de `V9`— aunque el registro no encola, y lo marca)* |
| **`U2` antes de las que encolan** | [U2](10-corte/U2.md#pieza-u2), el outbox común, del paraguas, entra una vez que esté `U1`, en paralelo con `V1`–`V3`; lo esperan **`V4`, que encola los avisos del trial** ([BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br)), y por transitividad `V5` a `V9b`, con `V6` y `V9a` explícitas; del otro lado, `B3` (BR), `B4` y `B12`. **No es una dependencia entre épicas**: `U2` es del paraguas, como `U1`, y no suma a las de `B/descomposicion.md` §2.6 (FASE 5, owner 2026-09-30, lote 2 A) |
| **`U3`, fuera del grafo** | [U3](10-corte/U3.md#pieza-u3), el script del corte, del paraguas: **entra después de `U1`, en paralelo con `V1`, `B1` y `U2`, y sólo tiene que estar mergeada antes del ensayo del corte; no la espera ninguna unidad de esta épica** (FASES 6 y 7, lote de la aplicación, owner 2026-09-30, K). No es una dependencia entre épicas y no toca el camino crítico |
| **nada arranca antes que `V1`** | de esta épica: `V1` depende sólo de [U1](10-corte/U1.md#pieza-u1), la limpieza del principio, que es del paraguas (verificación corta, 2026-09-29, lotes N-A y O-A). **No es una dependencia entre épicas**: `U1` no es de ninguna, y no le suma ninguna a las de `B/descomposicion.md` §2.6, **que son doce desde la FASE 9 vuelta 3 por otra razón: `V4` depende de `B1`, que escribe la interfaz del reloj** (contrato §7.1, punto 5; `F-8V3C1-006`). **`V1` y `B1` arrancan en paralelo, y cada una llena su parte del package del contrato que `U1` deja vacío** (verificación corta, 2026-09-29, lote P-C); **la espera de verticales sobre `B1` empieza en `V4`**, la primera unidad que lee la hora |

**Y mientras la app de la rama está rota**, desde la limpieza del principio hasta que `B4` integra la
implementación real de billing, **verticales se construye y se prueba contra el simulador de billing
del contrato** (`12-contrato…` §7.1; `D/16` §4.6; verificación corta, 2026-09-29, lote N-A; ver
[03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)).

**`V5` es la bisagra**: hasta ahí se construyen capacidades, y de ahí en adelante se consumen. Es
también el punto donde el contrato deja de ser una definición y pasa a tener un consumidor real: el
paso 5.

*(La fuente conserva también el grafo anterior a la partición del MVP, con `V8` y `V9` enteras; el
vigente es éste. Que `U2` entre en paralelo con `V1`–`V3` y no `V1`–`V5` sale de que `V4` la espera
desde BR: inferido.)*

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:607, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:621, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:622, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:623, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:624, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:625, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:627, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:638, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:643, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:645

### Dónde vive cada unidad

Las nueve de verticales están en Linear como sub-issues de `HOS-1353`, y las trece de billing como
sub-issues de `HOS-1354`, cada una con su ficha publicada. **Las diez mitades del corte del MVP**
(`V8a`, `V8b`, `V9a`, `V9b`, `B8a`, `B8b`, `B9a`, `B9b`, `B13a`, `B13b`; Z) **todavía no tienen
issue**: entran al árbol de Linear desde esta spec ([DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017),
implicación 3). El estado en vivo —qué está bloqueado, qué se puede empezar, qué está en curso— se
lleva en el **[tablero](https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB)**, que calcula solo cuáles
están listas: una unidad lo está cuando todas sus dependencias están hechas.

| unidad | issue | ficha | | unidad | issue | ficha |
|---|---|---|---|---|---|---|
| **V1** | [HOS-1355](https://linear.app/hospeda-beta/issue/HOS-1355) | [ficha](https://claude.ai/artifact/Xy46L4orTxa3MwSaNGgK6o) | | **B1** | [HOS-1364](https://linear.app/hospeda-beta/issue/HOS-1364) | [ficha](https://claude.ai/artifact/XS15EzcyrUFXkHrqRPk7mp) |
| **V2** | [HOS-1356](https://linear.app/hospeda-beta/issue/HOS-1356) | [ficha](https://claude.ai/artifact/DhWZPJ72BxssRMYp2WTQ6R) | | **B2** | [HOS-1365](https://linear.app/hospeda-beta/issue/HOS-1365) | [ficha](https://claude.ai/artifact/W7vHN5g24wAL6UcvPjMNmN) |
| **V3** | [HOS-1357](https://linear.app/hospeda-beta/issue/HOS-1357) | [ficha](https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6) | | **B3** | [HOS-1366](https://linear.app/hospeda-beta/issue/HOS-1366) | [ficha](https://claude.ai/artifact/SZWTgCVsibxQQBoCv1BqS1) |
| **V4** | [HOS-1358](https://linear.app/hospeda-beta/issue/HOS-1358) | [ficha](https://claude.ai/artifact/AfAufifn4m4qurfC4fKgYa) | | **B4** | [HOS-1367](https://linear.app/hospeda-beta/issue/HOS-1367) | [ficha](https://claude.ai/artifact/PhznPesGdJNckEgUJukffC) |
| **V5** | [HOS-1359](https://linear.app/hospeda-beta/issue/HOS-1359) | [ficha](https://claude.ai/artifact/KsjdENgkcaJaz49Qk9h1dX) | | **B5** | [HOS-1368](https://linear.app/hospeda-beta/issue/HOS-1368) | [ficha](https://claude.ai/artifact/TCjMHoQtCmbE1GDvJndrKu) |
| **V6** | [HOS-1360](https://linear.app/hospeda-beta/issue/HOS-1360) | [ficha](https://claude.ai/artifact/Lqmv2r3Vt53ugG2iBKnJEY) | | **B6** | [HOS-1369](https://linear.app/hospeda-beta/issue/HOS-1369) | [ficha](https://claude.ai/artifact/7Rgsqbpv4xexx9dbzbaqwF) |
| **V7** | [HOS-1361](https://linear.app/hospeda-beta/issue/HOS-1361) | [ficha](https://claude.ai/artifact/G9qtHb2DN8upN9QzaE7ueb) | | **B7** | [HOS-1370](https://linear.app/hospeda-beta/issue/HOS-1370) | [ficha](https://claude.ai/artifact/BxvBsVpS1pypNgdaFqb9ZY) |
| **V8** | [HOS-1362](https://linear.app/hospeda-beta/issue/HOS-1362) | [ficha](https://claude.ai/artifact/SqXumRq9YrBQpqiyoNTYGq) | | **B8** | [HOS-1371](https://linear.app/hospeda-beta/issue/HOS-1371) | [ficha](https://claude.ai/artifact/UASiMLVL8iS9WVjPD2EU9d) |
| **V9** | [HOS-1363](https://linear.app/hospeda-beta/issue/HOS-1363) | [ficha](https://claude.ai/artifact/5Nc7PT6fyh67GoL7Lfmwcd) | | **B9** | [HOS-1372](https://linear.app/hospeda-beta/issue/HOS-1372) | [ficha](https://claude.ai/artifact/Fe1bqQkj8QThu75uKsHjev) |
| | | | | **B10** | [HOS-1373](https://linear.app/hospeda-beta/issue/HOS-1373) | [ficha](https://claude.ai/artifact/CcSEbDa1dofcH7KH1RwZp3) |
| | | | | **B11** | [HOS-1374](https://linear.app/hospeda-beta/issue/HOS-1374) | [ficha](https://claude.ai/artifact/TCB6UEHbuxKDnLqYkHHmTC) |
| | | | | **B12** | [HOS-1375](https://linear.app/hospeda-beta/issue/HOS-1375) | [ficha](https://claude.ai/artifact/TuSxTZSU9xcUTy7Fp9uE6q) |
| | | | | **B13** | [HOS-1376](https://linear.app/hospeda-beta/issue/HOS-1376) | [ficha](https://claude.ai/artifact/7rdj5o5UFqbar5vD5ixsLn) |

**Las otras fichas del programa**: [el paraguas](https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA) ·
[la épica de verticales](https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP) ·
[la épica de billing](https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ) ·
[el contrato de cobertura](https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:728, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:730, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:737, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:749, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1065, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1067, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1075, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1091

## La épica de verticales (`HOS-1353`): el diseño que reemplaza a su `spec.md`

Lo que la `spec.md` de `HOS-1353` decía en sus §1 a §7, en su forma vigente. Desde
[AG](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ag) esa `spec.md` es un stub que apunta acá;
lo que en ella era una definición de otro archivo se referencia con su link.

### De dónde sale

El programa `HOS-1352` quedó detenido por una sola cosa: **la pasarela no estaba decidida**. Ya lo
está: Mercado Pago es el proveedor y lo que no hace lo suple el diseño
([DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005)); el mandato del proveedor es el modelo
canónico, sin destino pendiente de cargo puntual
([DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)).

**Ese bloqueo alcanzaba al dinero y no alcanzaba a las capacidades.**
[DEC-ARCH-005](01-decisiones-vigentes.md#dec-arch-005) parte el programa en dos épicas autónomas y
ésta es la que arranca. El corte, con su fundamento, es el de la partición del programa
(`D/11-particion-del-programa.md`, más arriba en este índice).

**La frontera, en una línea:**

> Es de esta épica si sólo necesita saber **qué puede hacer una cuenta**, sin preguntar si pagó.

Es el criterio del owner —*«toca plata o no toca plata»*—, y no hubo que inventarlo: el capítulo 15
ya lo había escrito al cerrar, separando su materia de la de promos y cortesías con las palabras
exactas — *«acá se agregan **capacidades**, allá se compone **dinero**»*.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:26, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:28, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:35, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:39, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:41, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:43

### El diseño de esta épica

Once capítulos, en `V/docs/`. **Son de esta épica**: ningún otro documento los contiene, **y citan
a billing donde el comportamiento cruza** (`NUCLEO/00`: las dos épicas se citan entre sí); lo que
cruza por contrato es la cobertura (`12-contrato…`, en
[03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)) (FASE 9 vuelta 1, `F-8V1D1-008`).

| # | capítulo | qué resuelve |
|---|---|---|
| `02` | modelo de datos | el catálogo de planes **sin el precio**, la ficha, el caché del conjunto efectivo, la retención |
| `03` | máquinas de estado | **tres**: Trial, Publicación y Postulación de Partner |
| `10` | verticales y planes | el Eje 2 como lista cerrada, y qué se lee del catálogo desde dónde |
| `11` | trial | el reloj de calendario, el techo de días, la reparación, la campaña de recuperación |
| `15` | entitlements y limits | las cuatro estrategias de agregación, el scope, el excedente, el visitante sin cuenta |
| `17` | autorización | los siete pasos, el scope estructural, actor ≠ sujeto, el rol que no se revoca |
| `18` | Partner | la presencia —la página y el carrusel, cada uno con su clave, y su bit de moderación (owner 2026-09-25; FASE 9 completa, 7b y 7c)— y la postulación |
| `19` | superficies | Mi Cuenta, los mensajes de trial y de excedente, las postulaciones, **y el botón de suscribirse que manda a publicar a quien todavía no publicó** (owner 2026-09-25; FASE 9 completa, 6c) **si publicar le arrancaría el trial, con la regla escrita sólo en `19` §4 fila 23** (FASE 9 vuelta 1, `F-8V1D1-004`) |
| `20` | testing | las cuatro capas y **veintiún guards** (entra [G19](04-catalogos.md#guard-g19), de `V5`: FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H; entra [G18](04-catalogos.md#guard-g18): FASE 5, lote de la aplicación, owner 2026-09-30, E; [G-R3](04-catalogos.md#val-g-r3) y [G-R5-B](04-catalogos.md#val-g-r5-b) pasan a ser validaciones del panel, por N1 y C9, y conservan su fila sin contarse; `G-R5` sale por C14 y entra [G14](04-catalogos.md#guard-g14) por N6; [G-R2-C](04-catalogos.md#guard-g-r2-c), owner 2026-09-25, FASE 9 completa, 4e; [G13](04-catalogos.md#guard-g13), que vino de `B/20` §2: owner 2026-09-26, `G5-5`; [G-R9](04-catalogos.md#guard-g-r9), la lista cerrada de `PURGED`: FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`) |
| `21` | migración | el trial ya consumido —**que el corte no siembra: los dueños del sistema viejo arrancan como clientes nuevos** (owner 2026-09-25; FASE 9 completa, 2g)—, cómo amanece la población existente, **con su ficha a la vista publicada y una prueba gratis activa desde el día del corte** (revisión del owner, 2026-09-28, C12), la escritura `C` de `inactiva_desde`, y por qué no hay deuda de datos |
| `22` | lo legal | el **seudónimo determinístico** del correo (FASE 9 completa, `C-1`); las señales que sólo observaban (teléfono, identificador fiscal, dispositivo) no se guardan (revisión del owner, 2026-09-28, N7, `g2`) |

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:49, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:51, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:56, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:67, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:68

#### Lo que cita y no contiene

Tres cosas, y ninguna la bloquea — las tres están escritas y cerradas:

| qué | dónde | por qué no está acá |
|---|---|---|
| **el núcleo** — reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas | `D/nucleo/`, en esta spec [02-nucleo.md](02-nucleo.md) | es vocabulario y método común. Partirlo lo rompe: un glosario en dos mitades deja de ser un glosario, y los **54** invariantes numerados de corrido (37 + `D1`–`D17`, `NUCLEO/04` §3; recontado en la salida 3 de la FASE 9 completa) pierden lo único que los hace útiles — poder preguntar **una vez** si están todos |
| **el contrato de cobertura** | `D/12-contrato-de-cobertura.md`, en esta spec [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md) | es **la frontera**, y por eso tiene una sola fuente que ninguna de las dos épicas puede mutar sola |
| **el PDR y el decision log** | `D/`, en esta spec [01-decisiones-vigentes.md](01-decisiones-vigentes.md) | son las fuentes del programa entero |

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:70, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:72, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:76, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:77, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:78

### Las definiciones declaradas

Lo que esta épica da por fijado. Cada una con su capítulo; ninguna se re-litiga acá.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:82, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:84

#### Qué diferencia legítimamente a una vertical de otra

**El Eje 2 es una lista cerrada de ocho ítems y todo lo demás es Eje 1.** Los ocho: el evento que
activa el trial, qué publica, la sección de Mi Cuenta, qué claves tienen sentido, el camino de
alta, si hereda Turista VIP, los métodos de pago admitidos y si tiene pricing propia.

**La consecuencia, que es el corazón del rediseño**: Alojamiento, Gastronomía y Experiencia
**coinciden en siete de los ocho** y difieren sólo en cuál subconjunto de claves tiene sentido —
configuración en base, no comportamiento. **Tres verticales que coinciden en siete ítems no
justifican una sola línea de código separado** (cap. 10 §1.1).

Las dos que sí difieren de verdad son **Turista** (no publica nada, y es el origen de la herencia
en vez de su destino) y **Partner** (no tiene trial, no es self-service, y su presencia no es una
ficha). Las dos caen dentro de la lista cerrada.

**Lo que NO es Eje 2 aunque lo parezca**: los ciclos que ofrece un plan, el grace, la pausa, los
días de trial y los overrides. Son **valores** configurables por plan, y el Eje 2 es variación de
*comportamiento*, no de *valores*.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:86, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:88, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:92, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:97, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:101

#### Qué sale de la base y qué sale del código

**El catálogo de claves es código; la configuración comercial es base.** Una clave existe porque
hay código que la respeta; qué plan la otorga y con qué valor es un dato.

La defensa va en **las dos direcciones**, cada una un defecto distinto —un permiso que nunca se
puede otorgar, y configuración que nadie va a leer—: una clave de código que no está en el catálogo
la ataja [G3](04-catalogos.md#guard-g3), y la otra dirección pasa a ser una restricción de la base
(revisión del owner, 2026-09-28, N1; `NUCLEO/02` §1.4).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:105, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:107, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:110, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:402

#### El catálogo de planes es de esta épica, menos el precio

De las seis entidades del catálogo comercial, **cinco no tienen un solo campo de dinero**:
`vertical`, `plan`, `plan_version` —que guarda `rank`, vendible, días de grace, días de trial,
permite pausa, hereda VIP—, `plan_version_entitlement` y `plan_version_limit`. **El precio vive en
una sola tabla hoja, `billing_option`**, que es de la otra épica.

*(Desde la FASE 8 el catálogo de addons se parte por el mismo corte, por campo: `addon` y
`addon_version` —qué otorga, vigencia, scope— son de esta épica, y `addon_product` —precio,
recurrencia y **verticales compatibles**— de la otra (cap. 02 §2.1). `vertical` no guarda
`admite_altas` ni hay fecha de fin de servicio por vertical: las verticales no se discontinúan
(revisión del owner, 2026-09-28, C8).)*

**Eso es lo que vuelve independiente al trial**: deriva su plan del vendible de `rank` más alto y
del más bajo, y las dos columnas están en `plan_version`. **Un trial se resuelve entero sin que
exista un precio en la base.**

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:114, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:116, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:121, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:130

#### Cómo se agrega un limit

**La estrategia se declara con la clave, no con el plan**, y la lista es cerrada: `SUMA`,
`MÁXIMO`, `MÍNIMO` y `MEJOR_DECLARADO`. Las tres últimas son la misma regla dicha de tres formas:
**gana la fuente más favorable**.

Vive con la clave porque, si la declarara el plan, dos planes de la misma vertical podrían
declarar estrategias distintas para la misma clave y **la clave significaría dos cosas**.

**Cuando no acumula, gana el cliente.** La alternativa es que comprar un addon te deje peor que
antes, y eso no se puede defender ante nadie.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:134, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:136, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:140, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:143

#### Qué scope tiene una clave

**Cada clave declara si es de vertical o global.** Y la defensa contra el cruce entre verticales es
**estructural, no un chequeo**: una clave de vertical se resuelve por `user + vertical`, así que
no se puede invocar sin la vertical. No hay un control que alguien pueda olvidar.

**El scope de la clave dice dónde vale; la fuente dice por cuánto tiempo.**

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:146, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:148, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:152

#### Cómo se autoriza una operación

**Siete pasos, en un orden que no es preferencia** (son nueve verificaciones agrupadas en siete
pasos y una precondición: FASE 9 vuelta 1, contradicción (e)): va de lo que no depende de nada
hacia lo que depende de todo, y cada paso revela lo mínimo.

1. quién es · 2. estado de la persona · 3. permiso · 4. el recurso: existencia, estado y dueño ·
5. **fuente viva** (el paso 5 acepta el piso, que no es título: cap. 17 §1.2, precisión 5) · 6.
entitlement · 7. limits — con el **contexto de vertical** como precondición estructural, no como
paso.

**Y la precondición se lee del recurso, nunca del pedido**: en una operación sobre algo que guarda
su vertical —la ficha y su contenido, la presencia de Partner, la instancia de addon— la vertical
es la del recurso, y si el pedido declara otra, **no existe**. **La vertical de una ficha es
inmutable desde el alta** (cap. 17 §1.2, precisión 6; la mitad *(c)* de
[G2](04-catalogos.md#guard-g2)) — FASE 8 completa, `F-8CA1-001`; owner 2026-09-25, FASE 9
completa, 7a.

**Las precisiones que el orden hace cumplir** —el cap. 17 §1.2 tiene nueve (la octava, FASE 9
vuelta 2, `F-8V2A1-002`; la novena, [PP1](04-catalogos.md#trans-v-pp1) como segunda excepción del
guest, FASE 9 vuelta 3, owner 2026-09-30, lotes I y M); éstas son las que esta épica necesita para
leerse sola (salida 3 de la FASE 9 completa)—:

- **El paso 4 responde «no existe» a las tres cosas.** Un recurso ajeno, uno archivado y uno
  inexistente son indistinguibles desde afuera; decir *«no es tuyo»* confirma que el id existe.
  **Para su dueño no**: una ficha `ARCHIVED` le acepta verla, exportarla y reactivarla
  ([PB8](04-catalogos.md#trans-v-pb8)) **—y borrarla, [PB12](04-catalogos.md#trans-v-pb12)—**, que
  es lo que [DEC-DATA-001](01-decisiones-vigentes.md#dec-data-001) promete (cap. 17 §1.2, precisión
  1). **Y le alcanza el paso 6 aunque no pague nada**, porque la versión de piso otorga *«recuperar
  lo suyo»* (cap. 02 §2.1): sin eso la promesa era inejecutable justo para la población a la que se
  le borra el contenido.
- **Lo ajeno existe sólo en estado público** (precisión 7; owner 2026-09-25, FASE 9 completa, 8c):
  para quien no es el dueño, el recurso existe sólo si es una ficha `PUBLISHED` o una presencia de
  Partner **con la clave de esa superficie** —«página propia» para la página, «presencia en el
  carrusel» para el carrusel (cap. 18 §1.2)— **vigente y sin moderar** (FASE 9 vuelta 1,
  `F-8V1A1-004`). Todo lo demás contesta como inexistente. **Y sólo para leer: una escritura exige
  `sujeto = dueño`, y sobre lo ajeno contesta *«no existe»*** (FASE 9 vuelta 2, `F-8V2A1-001`).
  **Las conversaciones, las reseñas y los comentarios son de quien los escribe**, y el turista los
  crea sólo sobre una ficha `PUBLISHED`; sobre otra contesta *«no existe»*, sin exención por
  superficie (FASE 9 vuelta 3, `F-8V3A1-003`).
- **El sujeto no lo elige el pedido** (precisión 8; FASE 9 vuelta 2, `F-8V2A1-002`): fuera de las
  operaciones de `actor ≠ sujeto` es el actor, y en ellas es el dueño del recurso, leído del
  recurso.
- **El estado de la persona va antes del permiso**, porque al revés una cuenta **con el correo sin
  verificar** puede averiguar qué permisos tiene probando operaciones. *(«Inhabilitado por abuso»
  salió del paso 2: no tenía dato que lo escribiera, y el abuso se trata ficha por ficha con
  `MODERATED` — owner 2026-09-25, FASE 9 completa, 8b.)*
- **Los limits van últimos** porque son los únicos que necesitan contar — **y, en una transición
  que ocupa cupo, los pasos 5 a 7 se evalúan dentro de un lock por `user + vertical`** (cap. 03 §9;
  FASE 8 completa, `R14`, owner 2026-09-25).

**Qué pasos recorre una lectura**: toda operación corre la resolución, pero una lectura no pasa
por el paso 5, y **una lectura de lo propio —Mi Cuenta, su billing, sus fichas— tampoco por el 6**,
así que un suspendido puede ver cómo regularizar (cap. 17 §3.5; owner 2026-09-25, FASE 9 completa,
8d).

**Y los siete se resuelven en un solo lugar.** El invariante no es que cada servicio los haga: es
que **ninguno los haga por su cuenta**.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:154, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:156, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:160, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:164, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:170, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:174, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:180, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:190, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:193, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:197, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:201, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:206

#### Actor y sujeto

**Toda operación lleva dos identidades** y casi siempre coinciden. Lo que autoriza que difieran es
**un permiso de esa acción concreta**, nunca una condición general de «es administrador».

**El admin no hereda los entitlements del sujeto**: los pasos 5, 6 y 7 se evalúan sobre el sujeto,
y la excepción son las catorce primeras acciones de `NUCLEO/08` §3
([ACC:1](02-nucleo.md#acc-1) a [ACC:14](02-nucleo.md#acc-14)), **la decimoséptima, migrar a los
clientes de un plan retirado** ([ACC:17](02-nucleo.md#acc-17); revisión del owner, 2026-09-28, C15),
**de la decimoctava a la vigesimosegunda, las cinco del catálogo** ([ACC:18](02-nucleo.md#acc-18) a
[ACC:22](02-nucleo.md#acc-22); la misma revisión, N1 y C9), **la vigesimocuarta, dar de baja una
cuenta a pedido de su dueño** ([ACC:24](02-nucleo.md#acc-24); revisión del owner, casos vecinos,
2026-09-29, casos F-C e I-C), **la vigesimoquinta, vaciar la presencia de un Partner a pedido de su
dueño** ([ACC:25](02-nucleo.md#acc-25); verificación corta, 2026-09-29, lote N-G), **y la
vigesimosexta, asignar o quitar el rol `SUPER_ADMIN` a una cuenta, cuyo permiso, como el de las
otras filas *«sólo `SUPER_ADMIN`»*, viene sólo con el rol y no se da suelto**
([ACC:26](02-nucleo.md#acc-26); FASE 9 vuelta 3, owner 2026-09-30, lotes P y AC). La decimosexta
salió con la revisión del owner, 2026-09-28, C8 ([ACC:16](90-retirados.md#acc-16)). La
decimoquinta, editar el contenido de una ficha ajena ([ACC:15](02-nucleo.md#acc-15)), se evalúa
sobre el dueño (cap. 17 §3.2 regla 3; FASE 9 vuelta 2, `F-8V2A1-004`), **y la vigesimotercera,
borrar una ficha ajena a pedido de su dueño ([ACC:23](02-nucleo.md#acc-23)), también** (caso F-C).
**Y leer lo ajeno pide el permiso de inspección de esa entidad**, que no es una fila de aquel
catálogo (cap. 17 §3.2 regla 1; `F-8V2A1-002`).

**Y no existe la impersonación** — impersonar hace que el registro diga que lo hizo el cliente, y
ése es exactamente el rastro que no se puede perder. **Y una acción administrativa nunca tiene
`actor = sujeto`**: el paso 3 la rechaza y la hace otra cuenta con el permiso (cap. 17 §3.2 regla
5; owner 2026-09-26, `G5-1`). **Compara cuentas, no personas**: se declara, con detector en el
resumen de [DEC-OBS-001](01-decisiones-vigentes.md#dec-obs-001), y la confirmación por una segunda
persona entra cuando haya otra persona con el permiso (owner 2026-09-26, `Y-2`).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:209, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:211, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:214, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:216, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:218, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:220

#### El rol no se toca al perder el acceso

**Perder el acceso NUNCA revoca un rol**: ni la suspensión, ni el vencimiento del trial, ni la
cancelación, ni la pausa ([G4](04-catalogos.md#guard-g4) falla si una transición de suscripción o
de trial escribe roles).

**El rol dice a qué familia de operaciones pertenece la persona; el estado de acceso dice si hoy
puede ejecutarlas.** Son dos ejes independientes, y los pasos 3 y 5 están separados para que
puedan discrepar.

Va con su mitad obligatoria: **ninguna autorización decide sólo por rol**
([G6](04-catalogos.md#guard-g6)). Las dos juntas o ninguna funciona. **Y ningún rol es una
fuente**: el conjunto efectivo sale sólo de las fuentes de `cobertura()`, y el cargador que le da
el conjunto entero al staff se retira (cap. 17 §4.3; la segunda mitad de `G6`; FASE 9 vuelta 1,
`F-8V1A1-002`).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:227, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:229, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:232, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:236

#### El trial

**Es único de por vida por `user + vertical`**, impuesto por una restricción de base sin condición
de estado. **El reloj es de calendario y no lo detiene nada** — ni despublicar, ni borrar la ficha,
ni dejar de entrar.

**Se consume al ejercer el evento de activación o con el primer pago, nunca con una autorización.**
Una suscripción convierte el trial recién con su primer pago acreditado
([T2](04-catalogos.md#trans-v-t2), [T5](04-catalogos.md#trans-v-t5);
[DEC-TRIAL-010](01-decisiones-vigentes.md#dec-trial-010)), y **suscribirse antes de publicar no
lo quema**: [T6](04-catalogos.md#trans-v-t6) exige un título que convierte; quien publicó con una
suscripción que todavía no cobró consume su fila por [T8](04-catalogos.md#trans-v-t8), al primer
pago, y quien pagó sin haber publicado sigue en `PRE_TRIAL` y la consume `T6` cuando publique
(FASE 9 vuelta 1, `F-8V1A2-004`). La salvedad `R15`, que contaba como ejercicio del evento la vuelta
de una ficha por `PB3` o `PB7` bajo esa suscripción, salió (revisión del owner, 2026-09-28, C12,
`L1-b`). La superficie lo evita antes: **el botón de suscribirse de quien todavía no publicó en esa
vertical lo manda a publicar si publicar le arrancaría el trial**, que arranca su trial (cap. 03 §2,
cap. 19 §4 fila 23, donde está la regla entera; owner 2026-09-25, FASE 9 completa, 6c; FASE 9
vuelta 1, `F-8V1D1-004`).

**El trial no vuelve; lo que hay es reparación hacia adelante.** Mientras sigue vivo se extiende;
si ya venció, la reparación es un instrumento de la otra épica.

**Y tiene techo**: cada vertical declara un máximo de días acumulados, en base y no en código.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:241, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:243, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:247, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:255, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:261, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:264

#### El excedente

**No se dispara por evento: se dispara por condición** — cuando el conjunto efectivo de un
`user + vertical` se recalcula y **dejó de coincidir con el límite, en cualquiera de las dos
direcciones**. Enumerar puntos de invocación es cómo se olvida el séptimo.

**Nunca borra**: archiva, despublica o deshabilita. **Cae lo más reciente primero**, y el criterio
va escrito en el aviso.

**Y vuelve primero lo que cayó al final**, hasta llenar el cupo, con el criterio escrito en el
aviso también. Es el mismo criterio recorrido al revés, no un segundo criterio: con él **lo que
queda arriba depende sólo del límite y no del camino**. Sin esa mitad, el que vuelve a subir de
plan paga el grande y recibe el chico, porque su cobertura nunca se interrumpió y no hay cambio
que disparar ([DEC-DATA-003](01-decisiones-vigentes.md#dec-data-003)).

**La ventana para elegir existe sólo cuando la fecha se sabía.** Prometer una ventana que a veces
no existe es peor que no prometerla: cuando no la hay, el aviso dice **qué se hizo** y cómo
revertirlo.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:266, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:268, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:272, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:275, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:281

#### El visitante sin cuenta

**Es un actor del modelo, no la falta de uno.** **No recibe ningún entitlement medido**, y de los
booleanos sólo los de lectura pública — enunciado **por clase** para que una clave medida nueva no
quede habilitada por omisión.

No hay cuota chica para el guest porque **una cuota necesita a quién imputarla**, y sin cuenta lo
único disponible se elude trivialmente.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:285, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:287, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:291

### El contrato con la épica de billing

Todo lo que esta épica necesita de `HOS-1354` es **un hecho y un aviso**: una consulta de cobertura
por `user + vertical`, y el evento que avisa que esa cobertura cambió. Los dos están definidos —y
**sólo** definidos— en el contrato de cobertura (`D/12-contrato-de-cobertura.md`, en esta spec
[03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)): **la firma exacta, con todos sus
campos y su tabla de qué es cada uno, es su §2**; el aviso es su §3; y **cuáles fuentes cuentan
para `cubierto` y cuáles no** es su §2.4.

> **Acá no va una copia de la firma, y la ausencia es el arreglo.**
> [DEC-ARCH-006](01-decisiones-vigentes.md#dec-arch-006) protege al contrato de que una épica lo
> mute sola, pero **una copia no necesita que nadie la mute para divergir: alcanza con que el
> contrato avance**. Ésta existió y divergió — publicaba **tres campos de cinco**, sin `alcance` y
> sin `objetivo`, y sin `objetivo` el pliegue en dos tramos del §2.7 no se puede calcular, así que
> **un addon comprado para una ficha habilitaba su capacidad en toda la cartera** (`F-8dC2-001`).
> El campo que haga falta acá se lee allá.

El mismo hecho lo pedía el diseño en cuatro lugares con cuatro nombres, **antes de que el contrato
existiera**: el paso 5 de la autorización, la transición [PB2](04-catalogos.md#trans-v-pb2) de
publicación, la pérdida de beneficios de turista al suspender, y el disparador del recálculo del
conjunto efectivo. **Eso es una tabla histórica y no el censo de quién lo consume**, que vive en la
fila `cubierto` del contrato §2.1 y hoy es más larga **—no se enumera acá: esa enumeración ya había
caducado (le faltaban `T1`, `T6` y el reconciliador diario de cobertura), que es el defecto que
este párrafo describe; salida 3 de la FASE 9 completa—**. Contar acá para saber cuántos hay da una
cifra congelada, que es lo que le pasó a la regla de vigilancia del §4.2 del contrato.

**Nada más cruza la frontera**: ni montos, ni estados de pago, ni ids del proveedor, ni fechas de
cobro —sobre cobros cruza un solo bit, `cobrada`, declarado en el contrato §4
([DEC-TRIAL-010](01-decisiones-vigentes.md#dec-trial-010))—. **Y desde la FASE 9 completa cruza
también `piso`**, en la fuente `GRANT`: una versión de plan, no dinero, para que el trinquete del
grant no tenga que leer una tabla de billing (contrato §2.1; owner 2026-09-25, 9h). Ni siquiera el
estado exacto de la suscripción — esta épica no distingue `ACTIVE` de `GRACE_PERIOD`, porque
durante el grace el servicio sigue.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:296, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:298, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:305, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:312, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:322, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:327

#### Cómo se construye sin que exista billing

**El trial ya es un título vivo, y el trial no es billing.** La implementación de arranque del
contrato resuelve de verdad las **dos** fuentes que ya viven de este lado —el trial, con su máquina
del capítulo 03 §2, y el título `BASE` del contrato §2.5— y responde que no a las **cuatro** de
billing: suscripción, cortesía, grant y addon (contrato §5.1).

**El piso no es un agregado cosmético a esa lista.** Sin `BASE`, un `TRIAL_EXPIRED` no tiene
ninguna fuente en el paso 5 y el paso le niega **la operación de suscribirse**, que es la única
forma de volver a tener un título: queda afuera para siempre (contrato §2.5). Y el piso **no
devuelve `cubierto` a verdadero** —es de clase `BASE`, no `TÍTULO`—, así que `PB2` sigue
disparando cuando el trial vence.

**Y otorga TRES cosas, no dos** (cap. 02 §2.1): ninguna capacidad comercial, contratar una
suscripción, y **recuperar lo suyo** —ver, exportar y traer a borrador una ficha propia archivada
([PB8](04-catalogos.md#trans-v-pb8))—. La tercera es la que vuelve ejecutable la defensa del hard
delete del día 180 para quien no vuelve a pagar, que es exactamente su sujeto.

Con eso se construye y se prueba **entero**: la autorización recorre sus siete pasos, la máquina de
publicación tiene vivo su `PB2` alimentado por [T3](04-catalogos.md#trans-v-t3), el reconciliador
de excedentes corre disparado por las transiciones de trial, **el reconciliador diario de cobertura
compara el contrato con las fichas una vez por día (`V/03` §9,
[DEC-ARCH-009](01-decisiones-vigentes.md#dec-arch-009))**, y la agregación de limits y los scopes
no tienen ninguna dependencia que defaultear porque nunca preguntaron por dinero.

**No es un stub de datos fijos, y la diferencia decide el ejercicio**: un simulacro que contesta
siempre que sí es un fail-open y **deja sin ejercer la mitad interesante** —perder la cobertura—;
uno que contesta siempre que no deja todo apagado. Que esa implementación de arranque no llegue a
un build de producción lo ataja [G13](04-catalogos.md#guard-g13).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:330, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:332, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:337, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:343, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:348, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:354, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:407

#### Lo que queda inactivo, declarado y no escondido

Mientras se construye sin billing:

1. **El trial nunca convierte.** `T2` y `T5` disparan cuando aparece un título que convierte —una
   suscripción, recién con su primer pago acreditado
   ([DEC-TRIAL-010](01-decisiones-vigentes.md#dec-trial-010), `V/03` §2)—, y sin billing no aparece
   ninguno. **Lo mismo `T8`, y la guarda de `T6` que pide un título que convierte** (owner
   2026-09-25; FASE 9 completa, 6c): sin billing no hay primer pago, así que el trial se consume
   sólo por [T1](04-catalogos.md#trans-v-t1) y la rama de `T6`/`T8` con suscripción queda sin
   ejercer hasta [B4](10-corte/B4.md#pieza-b4). **Y el botón de suscribirse no tiene checkout al que
   mandar**: su rama *«mandar a publicar»* sí se ejerce.
2. **No hay reparación de un trial ya vencido**, porque se hace con una cortesía. Alguien
   perjudicado por un error de moderación **después** de que su trial venció no tiene reparación
   hasta que exista billing. Mientras el trial sigue vivo sí la tiene: la extensión
   [T4](04-catalogos.md#trans-v-t4).
3. **El techo de días de trial cuenta una fuente de tres**: las extensiones de `T4`, no las que
   vendrían de un promo o de una cortesía. El número no cambia; cambia cuántas cosas suman.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:358, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:360, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:367, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:370

#### Cómo se integra con la otra épica

**El código de esta épica no va a `staging` por su cuenta**
([DEC-ARCH-007](01-decisiones-vigentes.md#dec-arch-007)). Corta de la rama de integración del
paraguas —`epic/HOS-1352-verticales-billing`— y mergea ahí. La unidad que llega a `staging` es el
paraguas, con las dos épicas adentro ([GATE:M2](30-el-corte.md#gate-m2)).

**La revisión ocurre en esos PRs**, los de esta épica hacia el paraguas. El PR final a `staging` va
a ser demasiado grande para revisarse de verdad: tiene que ser el merge de algo ya revisado.

Y una obligación que es la que hace viable todo lo anterior: **`staging` se mergea periódicamente
hacia la rama del paraguas**, nunca al revés hasta el final. Sin eso, una rama que vive meses
acumula conflictos con todo lo que entre al repo mientras tanto.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:373, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:375, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:379, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:382

### Cómo se comprueba que está bien

**Once guards con id propio de esta épica** —[G1](04-catalogos.md#guard-g1) a
[G6](04-catalogos.md#guard-g6), [G8](04-catalogos.md#guard-g8), **[G13](04-catalogos.md#guard-g13)**
(el octavo; lo construye [V4](10-corte/V4.md#pieza-v4): owner 2026-09-26, `G5-5`),
**[G14](04-catalogos.md#guard-g14)** (el noveno, la frontera del package del contrato; lo construye
[V1](10-corte/V1.md#pieza-v1): revisión del owner, 2026-09-28, N6), **[G18](04-catalogos.md#guard-g18)**
(el décimo, el control del SQL generado del catálogo y de la tabla de claves; lo construye `V1`:
FASE 5, lote de la aplicación, owner 2026-09-30, E) **y [G19](04-catalogos.md#guard-g19)** (el
undécimo, el actor de sistema armado fuera de la fábrica; lo construye
[V5](10-corte/V5.md#pieza-v5): FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H)—, y cada uno
**lleva un caso que lo hace fallar a propósito**, porque un guard que no puede fallar es un
comentario con exit code 0. Qué hace fallar a cada uno está en su definición, en
[04-catalogos.md](04-catalogos.md).

**Once NO es el total**: el catálogo del capítulo `20` §2 lista **veintiuno** (con `G18`: FASE 5,
lote de la aplicación, owner 2026-09-30, E; con `G19`: FASES 6 y 7, pase de la FASE 6, owner
2026-09-30, H) (recontado el 2026-09-28 sobre la tabla: decía veinte sin
[G-R9](04-catalogos.md#guard-g-r9); sale `G-R5` por C14 y entra `G14` por N6; **y `G-R3` y
`G-R5-B` pasan a ser validaciones del panel**, por N1 y C9) —el decimonoveno es
[G-R2-C](04-catalogos.md#guard-g-r2-c) (owner 2026-09-25; FASE 9 completa, 4e), y el vigésimo,
`G13`, que vino de `B/20` §2—, y los **diez** que no están en esta lista son los `G-R*` —los racimos
de la FASE 9 y sus **tres** referencias cruzadas con billing (sale `G-R5`, C14)—, que se numeran
ahí y no acá. Esta lista es **la porción con id propio**; la lista entera es la del `20` §2, que es
el único lugar donde se puede preguntar *«¿están todos?»*: en esta spec, el catálogo de guards de
[04-catalogos.md](04-catalogos.md).

**`G1` y `G2` son la pinza**: uno acota quién **puede** nombrar una vertical, el otro obliga a que
las operaciones **lo hagan**. Por separado, cada uno deja pasar lo que el otro atrapa.

Y la regla que vale para los **veintiuno** (con `G18`: FASE 5, lote de la aplicación, E; con
`G19`: FASES 6 y 7, pase de la FASE 6, H; FASES 6 y 7, verificación, 2026-09-30, F3; revisión del
owner, 2026-09-28, N1 y C9): **el texto con que falla no puede afirmar más de lo que el predicado
verifica.**

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:388, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:390, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:392, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:398, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:411, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:414

### Por qué tampoco carga deuda de datos

El capítulo 21 midió que **Gastronomía, Experiencia y Partner tienen cero filas**, y que **no hay
un solo pago histórico**. Los tres compromisos de cobro vivos están del otro lado de la frontera.

Esta épica es independiente **por diseño** —no pregunta por dinero— y también **por datos**: no
**transcribe ninguna fila del sistema viejo** —ni siquiera de `trial`: el corte no siembra trials
consumidos (owner 2026-09-25; FASE 9 completa, 2g)—. **Lo único que toca de lo existente son las
fichas**, y sin migrarlas: **la migración del corte carga una lista cerrada de cinco fichas, que
fija el owner cuando esté listo para el corte, una por cada cuenta de
[DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007), y borra las filas de todas las demás** (FASE
5, owner 2026-09-30, lote 1 J; simplificación del corte, S-01 y S-02, lote A); **las cinco nacen**
con `listing.inactiva_desde` en el instante del corte —la escritura `C` de `NUCLEO/01` §1.2—,
**nacen `PUBLISHED`, como recién creadas, y la herramienta del corte de
[V6](10-corte/V6.md#pieza-v6), que es del sistema nuevo, después de la migración, le escribe a cada
dueño una prueba gratis activa que arranca ese día, con la función de la aplicación; el script
suelto del corte sigue sin importar código de ningún sistema** (FASE 5, lote de la aplicación,
owner 2026-09-30, B; revisión del owner, 2026-09-28, C12; FASE 5, lote 2 D y S-12: es la única
fila nueva de verticales que escribe el corte, una prueba activa, no transcrita de ninguna), y la
página del partner sin presencia pasa de responder 410 a 404 (`V/21` §2.4 y §4). La migración es la
del [paso 3](30-el-corte.md#paso-3) y las cinco pruebas, las del corte. *(Decía «nada que migrar y
nada que romper», y la escritura `C` es una escritura sobre filas existentes; salida 3 de la FASE 9
completa.)*

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:419, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:421, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:424, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:443

### Lo que la `spec.md` de verticales no decidía

- **El orden de implementación.** Sale de las dependencias entre capítulos, no de acá. *(Inferido:
  hoy lo fijan la descomposición de la épica, `V/descomposicion.md` §3, más arriba en este índice,
  y el reparto en el corte y en las cuatro fases de
  [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017).)*
- **Cuáles son las claves de entitlement y de limit de cada vertical.** Es configuración: acá está
  que el subconjunto se declara por vertical y que cada clave lleva scope, estrategia y
  `enforcementStrategy` — no cuál es. *(El capítulo 15 le suma un cuarto atributo, la clase; ver
  [80-abiertos.md](80-abiertos.md), `V/docs/15-entitlements-y-limits.md`.)*
- **Cerrado** (revisión del owner, 2026-09-28, C4): si el mes de una cuota corre por calendario o
  por aniversario, que seguía abierto desde [DEC-ENT-002](01-decisiones-vigentes.md#dec-ent-002),
  corre por la fecha del ciclo de cada persona, también en anual y en la prueba gratis (`15` §7).
- **Cerrado**: qué se reescribe y qué se reutiliza del código actual. **Lo contestó la FASE 5
  ([DEC-METH-017](01-decisiones-vigentes.md#dec-meth-017)), y lo que dejó sin veredicto lo
  contestó el pase de la FASE 6** ([DEC-METH-018](01-decisiones-vigentes.md#dec-meth-018)) (FASES 6
  y 7, verificación, 2026-09-30, F5).
- **«Entrar como» el cliente** (revisión del owner, 2026-09-28, C7): no está en esta versión y se
  va a agregar; su condición (se registra como hecho por el admin en nombre del cliente) está en
  `17` (*«lo que este capítulo NO cierra»*, en [80-abiertos.md](80-abiertos.md)) y en `NUCLEO/08`
  §3. **Y el código apagado que hoy lo prepara sale**: `impersonate` y `set-role` del plugin
  `admin` de Better Auth, el botón del panel y el permiso `USER_IMPERSONATE`; HOS-354 se cierra o se
  reescribe como el *«entrar como»* de esa versión (FASE 5, owner 2026-09-30, lote 4 C; lo hace
  [V5](10-corte/V5.md#pieza-v5)). **Y el rol de administrador del plugin (`fullAdminRole`) queda
  sin ninguna acción**: el plugin sigue sólo como guardia del baneo en el inicio de sesión (FASE 5,
  lote de la aplicación, owner 2026-09-30, L).
- **La baja de cuenta pedida por el usuario** (revisión del owner, 2026-09-28, N7, `g1`): fuera de
  esta épica; la hace soporte a mano con una lista de pasos, y se corrige la FAQ (`HOS-1393`;
  `NUCLEO/08` §1). **La lista se escribe antes del corte, en este orden: la baja del cobro, `PB12`
  por cada ficha y la cuenta** (revisión del owner, casos vecinos, 2026-09-29, caso 7; `NUCLEO/08`
  §1.3).
- **Cerrado**: nada de la épica de billing se decide acá, y su primera pregunta —si el cargo
  puntual es el modelo canónico— **se planteó en `HOS-1354` y está respondida** (2026-09-26): no lo
  es; el modelo canónico es el mandato del proveedor
  ([DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)), sobre Mercado Pago
  ([DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005)).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:448, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:450, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:451, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:455, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:457, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:460, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:468, .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:473

## La épica de billing (`HOS-1354`): el diseño que reemplaza a su `spec.md`

La `spec.md` de `HOS-1354` queda como stub
([AG](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ag)); lo que decía, en su forma vigente, es
esto. **La épica se sostiene sola en su diseño y no está bloqueada**: trece capítulos escritos y
ninguno pendiente; el `13` (Pagos) **no se escribió, se repartió** entre los capítulos que lo
reclamaban (2026-09-24). [DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005) fijó Mercado Pago y
[DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006) contestó quién tiene el reloj de cobro: el
proveedor. **No sale a producción sola**
([DEC-ARCH-007](01-decisiones-vigentes.md#dec-arch-007)): las dos épicas llegan juntas y
terminadas.

### Qué la bloqueaba, y ya no

**Nada la bloquea desde el 2026-09-24** (FASE 9 completa, salida 3 de
[DEC-METH-004](01-decisiones-vigentes.md#dec-meth-004)): la pasarela es **Mercado Pago**
([DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005)), el reloj de cobro es **del proveedor**
([DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)) y la evaluación de proveedor se cerró en el
paso 4 de 6 sin completarse. Lo que sigue es **el estado de antes de esa decisión**, que la fuente
deja como rastro: la PRUEBA 0 no se envió y ya no hace falta, y la sonda de Mobbex nunca tuvo
cuenta contra la que correr.

[DEC-ARCH-004](01-decisiones-vigentes.md#dec-arch-004) puso el ciclo de vida de nuestro lado y dejó
la pasarela detrás de un adaptador —al proveedor se le pide **cobrar, reembolsar, leer y avisar**,
y nada más—, y el adaptador de referencia estuvo sin decidirse hasta el 2026-09-24:

| | |
|---|---|
| **Mercado Pago** | niega el cobro a demanda con un `403 "The application is not authorized to perform this type of payment"` en **las cuatro variantes** del request. Es un portón comercial, no un error del pedido. La PRUEBA 0 (§5.0 del documento 10) eran dos textos redactados que el owner tenía que enviar |
| **Mobbex** | documenta el cobro a demanda **con monto libre** —exactamente lo que `DEC-ARCH-004` necesita— pero el alta propia quedó en **revisión manual de KYC**. Sin entidad aprobada no hay token |
| **el resto de la plaza** | búsqueda externa del 2026-09-18: **ningún proveedor argentino ofrece el cobro a demanda como self-service**; los cinco relevados exigen alta comercial previa |

**Lo que no la bloqueaba**: casi todo el diseño. Suscripción, grace, pausa, promos, cortesías,
grants, addons, conciliación, idempotencia y las máquinas de estado del dinero ya estaban escritos.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:30, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:38, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:43, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:49

### El diseño de esta épica

Trece capítulos en `B/docs/`, y **cinco de ellos son billing sin una sola fisura**: ninguna de sus
secciones sobrevive sin la pasarela. En esta spec su contenido vive en las piezas `B1` a `B13b` y en
los catálogos; la tabla dice qué resuelve cada capítulo:

| # | capítulo | qué resuelve |
|---|---|---|
| `02` | modelo de datos | `billing_option` —donde vive el precio—, suscripción, pausa, el vínculo con el proveedor, el dinero, addons y concesiones |
| `03` | máquinas de estado | **ocho**: Suscripción (`S1`–`S38`: `S36`, la revocación, owner 2026-09-26, `G5-4`; **`S37`, la aplicación de una migración**, revisión del owner, 2026-09-28, C15; **`S38`, la que aplica la cola de cambios programados**, revisión del owner, casos vecinos, 2026-09-29, caso 37; `S25`–`S28` retiradas con su número, C8), Grace, Pausa, Pago, **Reembolso** (§6.1, `RF1`–`RF5`: owner 2026-09-25, [DEC-RF-008](01-decisiones-vigentes.md#dec-rf-008)), Pago manual, Addon, y la regla de no-retroceso |
| `05` | idempotencia y concurrencia | los tres mecanismos, los seis cruces del §52, y qué hace seguro a un pago tardío |
| `06` | proveedor | las ocho capacidades, las seis reglas duras de trato, el riesgo de plataforma |
| `09` | conciliación | las cuatro partes, los **cuatro** modos de «cero cobros» (§4, reescrito el 2026-09-24 por `RC-5`), y el bug vivo que pasa a ser caso de uso |
| `10` | retiro de plan | retirar no mueve a nadie, **tampoco retirar todos los planes de una vertical**; discontinuar una vertical queda fuera de esta versión (revisión del owner, 2026-09-28, C8) |
| `12` | suscripción | el grace, la cola de cambios programados, el precio que cambia entre programar y ejecutar |
| `14` | promos, cortesías y grants | el orden de aplicación y el piso, y cómo se combinan entre sí |
| `16` | addons | dos ejes, qué es una suscripción «válida», el addon a costo cero, el huérfano **y el estado en que queda su cobro** — y desde el 2026-09-25 **los addons siguen a su título**: *válida* es `ACTIVE` y pagando (`NUCLEO/01` §2, no el campo `cobrada` del contrato; FASE 9 vuelta 1, `F-8V1D1-002`), se pausan con la pausa del cliente (`S32`, `S33`), la orfandad se lee sobre el conjunto de principales y anclas vivas, y un `USER`/`GLOBAL` se emite sólo en sus verticales compatibles (owner, [DEC-ADDON-007](01-decisiones-vigentes.md#dec-addon-007)) |
| `19` | superficies | la pricing, Mi Suscripción y la baja |
| `20` | testing | las cuatro capas y **diecisiete guards** —`G7`, `G9`–`G12` (`G13` pasó a `V/20` §2 y lo construye `V4`: owner 2026-09-26, `G5-5`), **`G15`–`G17`** (revisión del owner, 2026-09-28: las dos listas del falso, `qzpay` que vuelve y la decisión sin releer), los seis de `R1` y las **tres** referencias cruzadas (sale `G-R5`: revisión del owner, 2026-09-28, C14)—, el proveedor falso que **tiene que mentir**, **con sus dos listas cerradas, la batería que vigila a Mercado Pago, y el E2E que reemplaza el smoke manual sección por sección** (revisión del owner, 2026-09-28, C13, N3); los guards, en [04-catalogos.md](04-catalogos.md#guard-g7) |
| `21` | migración | la premisa del §56 medida, y el cobro durante el rediseño — **y la cartera actual no se migra: de su billing no se conserva nada, y se conservan el usuario y sus preferencias** (owner 2026-09-25, [DEC-MIG-005](01-decisiones-vigentes.md#dec-mig-005)) **y, de las fichas, sólo la de cada cuenta de la lista cerrada que fija el owner; las demás se borran en el corte** (FASE 5, owner 2026-09-30, lote 1 J; [DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007)); **y un cobro tardío de un débito viejo entra por la lápida de recepción como cualquier desconocido, sin lápida del corte** (FASE 5, simplificación del corte, lote C) |
| `22` | lo legal | el aumento, la revocación y el botón de arrepentimiento |

**El `13` (Pagos) no existe, y no es un pendiente: se repartió** (2026-09-24) entre `B/02` §2.3,
`B/03` `S29` y §6.1, `B/05` C5 y `B/06` §4.6 (`nucleo/00-indice.md`, *«El capítulo `13` NO
existe»*); ver abajo, *«El capítulo 13 (Pagos)»*.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:53, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:55, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:58, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:61, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:68, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:70, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:71, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:74

#### Lo que cita y no contiene

| qué | dónde, en esta spec |
|---|---|
| **el núcleo** — reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas | [02-nucleo.md](02-nucleo.md) y sus partes |
| **el contrato de cobertura** — la frontera con la otra épica | [03-contrato-de-cobertura.md](03-contrato-de-cobertura.md) |
| **el PDR, el decision log y la matriz del proveedor** | [01-decisiones-vigentes.md](01-decisiones-vigentes.md) y [04-catalogos.md](04-catalogos.md) |

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:77, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:79

### Las definiciones declaradas

Siete definiciones, una por subsección, que la fuente pone bajo un encabezado sin cuerpo propio.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:87

#### Al proveedor se le piden cuatro cosas, y el ciclo de vida es nuestro

[DEC-ARCH-004](01-decisiones-vigentes.md#dec-arch-004). **Cobrar, reembolsar, leer y avisar.** El
package concentra el dominio entero —el reloj de la pausa, el dunning, los reintentos, las
cortesías y el candado contra el doble cobro— y **la pasarela queda como un detalle al fondo**.

Dos condiciones que lo hacen exigible: un **guard estático** que prohíba importar el SDK fuera del
adaptador, y un **adaptador falso en memoria desde el día uno**, que es lo que prueba que la
abstracción no miente.

**`qzpay` se saca, y el cobro nuevo se escribe en un package compartido del monorepo** (revisión
del owner, 2026-09-28, N2). Todo el cobro nuevo vive **bien encapsulado en un package compartido
del repo; publicarlo en npm pediría reescribir sus dependencias internas** (revisión del owner,
casos vecinos, 2026-09-29, caso 30): **no depende de ninguna app ni de la mitad de verticales,
salvo del package del contrato** (`12-contrato…` §7.1). **Sí puede depender de otros packages
internos de Hospeda** (`@repo/*`), con la regla del owner, textual: *«siempre que sea simple evitar
la dependencia de otro package de Hospeda, evitalo; si es complejo, la dejamos y en el futuro se
reverá»*, porque *«no quiero demorar la salida de esta épica por eso»*.
[GUARD:G16](04-catalogos.md#guard-g16) falla si vuelve `@qazuor/qzpay` **a cualquier
`package.json` o import del repo**, del que la limpieza del principio (`U1`, la unidad del
paraguas: lote O-A) lo saca antes de `B1` (verificación corta, 2026-09-29, lote N-A;
`16-fase-7…` §4.6), o si el package importa de `apps/` (`B/20` §2), **y no mira sus dependencias
hacia packages internos**; y [GUARD:G14](04-catalogos.md#guard-g14) ya vigila que no importe de
verticales. **`qzpay` queda sólo como referencia de lectura**: su adaptador de Mercado Pago sirve
para ver cómo se arma un pedido o se verifica una firma; **su motor y su esquema no**, porque el
modelo nuevo es otro ([DEC-METH-007](01-decisiones-vigentes.md#dec-meth-007),
[DEC-MIG-003](01-decisiones-vigentes.md#dec-mig-003)). Lo que se toma de él pasa el filtro 2 de
`DEC-METH-007`: un test que falla si se rompe, contra una fila de la matriz. Y **se congela y se
archiva después del corte** ([30-el-corte.md](30-el-corte.md#paso-3), §4.5).

**Y las pasarelas no son intercambiables.** La API no expone el mínimo común denominador: **para
cada capacidad se declara qué pasa cuando el proveedor no la tiene** —se emula, se degrada, o se
bloquea la función del producto—. Un adaptador que finge paridad es peor que ninguno, porque el
código de arriba le cree.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:89, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:91, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:95, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:99, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:117

#### El riesgo se trasladó hacia nosotros, y está declarado

Lo dice [DEC-CONC-001](01-decisiones-vigentes.md#dec-conc-001): con el ciclo de vida de nuestro
lado, **un doble cobro es nuestro bug y es plata de un cliente real**; ni Mercado Pago ni Mobbex
ofrecen idempotencia en la creación, así que **el candado es nuestro y va antes de llamar al
proveedor**. Se aceptó el trade por dos razones: un bug nuestro se arregla y uno del proveedor no,
y **nadie puede testear lo que no controla**.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:122, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:124, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:128

#### El código de estado no cierra ninguna mutación

**Toda mutación se verifica releyendo y comparando campo por campo.** No es criterio: es medición
—de ocho operaciones que el PDR pediría, **cinco devuelven `2xx` y no aplican nada**—. No es un
proveedor que rechaza lo que no soporta: es uno que **acepta y descarta**. Las cinco tienen fila en
la matriz: [MP:EX-4](04-catalogos.md#mp-ex-4), [MP:EX-21](04-catalogos.md#mp-ex-21),
[MP:EX-34](04-catalogos.md#mp-ex-34), [MP:EX-35](04-catalogos.md#mp-ex-35) y
[MP:CN-1](04-catalogos.md#mp-cn-1), la M1 de `B/20` §3.2, que suma
[MP:EX-5](04-catalogos.md#mp-ex-5); el *«de ocho»* es de este párrafo y no de una fila (la
presentación lo citaba como *«5 de 8»* y se corrige al publicarla: revisión del owner, casos
vecinos, 2026-09-29, caso 29).

Y no alcanza con releer «la» mutación: un `PUT` con varios campos **se aplica a medias con un solo
`200`**. El que falla no arrastra al que funciona.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:131, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:133, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:140

#### Las cuatro decisiones de mecanismo que ya están tomadas

| | |
|---|---|
| **la pausa** | es la **nativa del proveedor**, en **meses enteros**, y los días no usados del ciclo en curso se pierden: con ciclos enteros el cliente vuelve el mismo día del mes, así que lo perdido se compensa con lo que gana al volver. **El reloj que la reanuda es nuestro** ([DEC-SUB-010](01-decisiones-vigentes.md#dec-sub-010)) |
| **la cortesía temporal** | se implementa **pausando** en el proveedor y sosteniendo el servicio de nuestro lado. Es la única de las cuatro estrategias medidas que **no mueve un peso** ([DEC-GRANT-003](01-decisiones-vigentes.md#dec-grant-003)) |
| **cada addon recurrente** | es **una autorización aparte**, no una línea del monto del plan. Subir el monto toca plata cada vez, en el punto exacto donde el proveedor acepta sin aplicar, y esa mutación **no emite aviso** ([DEC-ADDON-002](01-decisiones-vigentes.md#dec-addon-002)) |
| **el cambio de precio** | se muta el monto de la autorización vigente; el aviso previo se cumple **de nuestro lado** ([DEC-MP-001](01-decisiones-vigentes.md#dec-mp-001)). **Ningún precio cambia hasta el momento 5** ([GATE:M5](30-el-corte.md#gate-m5)): los precios del corte son los vigentes hoy, los carga el [paso 3a](30-el-corte.md#paso-3a) y no se cambian durante el corte; desde ahí la acción 19 rige con la mecánica de [DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002), y el aviso y la mutación a los ya anclados llegan con `B12` ([BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm)) |

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:143, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:147, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:148, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:149, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:150

#### Nunca se le pide un trial al proveedor

Está medido que **una fecha de primer cobro futura se convierte en un free trial sola**: el request
no lo nombra, el objeto queda con uno, y al comprador se le anuncia *«Tu prueba gratis comenzó»*.

Como la fecha futura es la **precondición de seguridad** de todo cambio de plan y de ciclo, no se
puede evitar: **se anticipa, no se desmiente**. Y el guard tiene que mirar la relectura, porque
**en el payload no hay nada que ver**.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:152, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:154, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:157

#### La copy del proveedor no sostiene ninguna decisión

Tres textos suyos contradicen sus propios datos. **Regla para soporte, que sale directo de la
medición: ante un reclamo, mirar el PAGO, nunca el correo.** La regla vive con las decisiones del
proveedor en [01-decisiones-vigentes.md](01-decisiones-vigentes.md#dec-mp-006).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:161, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:163

#### El proveedor falso tiene que mentir

No alcanza con que responda bien: **tiene que reproducir los modos de falla medidos** —aceptar y no
aplicar, responder `2xx` sobre lo que descartó— porque un doble tiene que fallar como el original.
**Y miente sólo donde dice una lista cerrada de trece mentiras medidas**, con las reglas propias del
proveedor en otra lista, y una batería que corre contra el real cada semana en la cuenta de
pruebas, cada mes en producción y a mano cuando se quiera, que avisa y no ajusta nada (`B/20` §3.2
y §4.1; revisión del owner, 2026-09-28, C13, `L3-c` y `L3-d`;
[GUARD:G15](04-catalogos.md#guard-g15)). El e2e que corre hoy contra un stub honesto **no puede,
por construcción, detectar divergencias** con el proveedor real.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:166, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:168, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:174

### El contrato con la épica de verticales

Esta épica **entrega** un hecho y un aviso, y nada más: una consulta de cobertura por
`user + vertical`, y el evento que avisa que esa cobertura cambió. Los dos están definidos —y
**sólo** definidos— en el contrato de cobertura
([03-contrato-de-cobertura.md](03-contrato-de-cobertura.md)): **la firma exacta, con todos sus
campos y su tabla de qué es cada uno, es su §2**; el aviso es su §3; qué emite cada uno de los
nueve estados de la suscripción, su §2.6.

**Acá no va una copia de la firma, y la ausencia es el arreglo.**
[DEC-ARCH-006](01-decisiones-vigentes.md#dec-arch-006) protege al contrato de que una épica lo
mute sola, pero **una copia no necesita que nadie la mute para divergir: alcanza con que el
contrato avance**. Ésta existió y divergió —publicaba **tres campos de cinco**, sin `alcance` y sin
`objetivo`, que son justamente los dos que esta épica tiene que llenar para que un addon comprado
para una ficha no habilite su capacidad en toda la cartera (`F-8dC2-001`)—. El campo que haga
falta se lee en el contrato.

**Lo que esta épica implementa son cuatro de las seis fuentes** —suscripción, cortesía, grant y
addon—; las otras dos, el trial y el título `BASE`, son de la otra épica y ya existen (contrato
§5.1 y §5.2). Se enchufa: **no modifica nada de lo construido**.

**Y devuelve un puntero, nunca los valores.** Quién sabe *qué otorga* un plan es verticales; quién
sabe *cuál plan* tiene esta persona es esta épica. Devolver los entitlements resueltos mudaría la
resolución del capítulo 15 para este lado y sería la segunda fuente de algo que tiene que tener una
sola.

**No cruzan la frontera** montos, precios, estados de pago, ids del proveedor ni fechas de cobro
—sobre cobros cruza un solo bit, `cobrada`, declarado en el contrato §4
([DEC-TRIAL-010](01-decisiones-vigentes.md#dec-trial-010))—. **Y una fuente `GRANT` lleva además su
`piso`**, la versión de plan del trinquete (owner 2026-09-25; FASE 9 completa, 9h): la firma pasó
a **siete campos por fuente, y a ocho con `desde`** (revisión del owner, 2026-09-28, C4: el
instante en que la fuente empezó a cubrir, que ancla la cuota mensual y no es fecha de cobro), y el
piso sigue siendo **un puntero, no un valor** —por eso cruza sin romper la regla de arriba, y
verticales deja de leerlo de `permanent_grant_vertical`—. Ni siquiera el estado exacto de la
suscripción: verticales no distingue `ACTIVE` de `GRACE_PERIOD`, porque durante el grace **el
servicio sigue**.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:179, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:181, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:188, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:195, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:199, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:204, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:212

### Lo que no se puede cerrar todavía

Tres subsecciones bajo un encabezado sin cuerpo propio: el capítulo 13, las filas `UNKNOWN` y el
riesgo de plataforma.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:217

#### El capítulo 13 (Pagos), y la pregunta que lo gobernaba: contestada el 2026-09-24

**Ya no existe como capítulo**: lo que debía se repartió el 2026-09-24 entre `B/02` §2.3, `B/03`
`S29` y §6.1, `B/05` C5 y `B/06` §4.6 (`nucleo/00-indice.md`, *«El capítulo `13` NO existe»*). **La
pregunta que lo gobernaba era ésta**: *¿el capítulo 13 adopta el cargo puntual contra tarjeta
guardada como modelo canónico, tratando el mandato del proveedor —lo que Mercado Pago hace hoy—
como modo degradado?*

**Contestada por [DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006): no. El reloj de cobro es del
proveedor, y el mandato (`preapproval`) es el modelo canónico.** No por preferencia:
[MP:EX-31](04-catalogos.md#mp-ex-31) **midió que el cargo puntual contra credencial guardada
devuelve `403` en las cuatro formas de pedirlo**, y el rechazo es del **permiso**, no del pedido:
la misma orden sin esos nodos entra con `201`. **El cargo puntual dejó de ser destino el
2026-09-26** (📌 de `DEC-MP-006`: la habilitación no tuvo respuesta y no se espera más), y queda la
obligación de que la interfaz del capítulo 13 no impida migrar. **Lo que la subsección siguiente
anota sigue valiendo**: con el reloj del proveedor, las filas del cobro fallido **siguen siendo
bloqueantes de diseño**.

No se podía esquivar, porque decide **quién tiene el reloj**, y eso no se esconde detrás de una
interfaz: **dos relojes sobre la misma autorización son el doble cobro** que
[DEC-ARCH-004](01-decisiones-vigentes.md#dec-arch-004) declara como riesgo nuestro.

**Un costo que la decisión no enumeró** y que trajo la búsqueda externa: si el reloj fuera nuestro,
**los reintentos también lo serían, y son terreno regulado** —hay códigos de rechazo que no se
pueden reintentar nunca, hay techo de intentos por ventana y hay multas por excederlo—. Hoy eso lo
absorbe Mercado Pago dentro del `preapproval`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:219, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:221, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:226, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:231, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:240, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:244

#### Las filas que siguen `UNKNOWN`

**Recontadas** con `contar-filas-de-la-matriz.py` (FASE 9 completa, salida 3 de `DEC-METH-004`;
último recuento en los cruces de la aplicación de la FASE 5, 2026-09-30): **117 filas — 63
`VERIFIED`, 16 `PARTIALLY_SUPPORTED`, 24 `NOT_SUPPORTED`, 14 `UNKNOWN`**. Las mediciones del 30/09
cerraron `EX-57` y `EX-58`, `VERIFIED`, y pasaron `EX-59` a `PARTIALLY_SUPPORTED`; **`EX-49`**, la
lista del seudónimo del correo, **es de verticales** (`V/02` §2.2;
[MP:EX-49](04-catalogos.md#mp-ex-49)) y no va en esta tabla; `EX-52`, `EX-53` y `WH-6` salieron el
29/09 (mediciones de los dos canales), y `EX-54` no tiene fila en ella (revisión del owner, casos
vecinos, 2026-09-29, caso 34). De las ocho de antes cerraron `RN-2` y `GR-3` (el 22/09: el cobro
fallido **sí** se fabricó, en producción), `WH-5` (`VERIFIED`) y `EX-1` (`PARTIALLY_SUPPORTED`);
`RN-3` ya no es `UNKNOWN` pero sigue condicionando el grace, y `GR-1` salió el 2026-09-26. Las filas
se definen en [04-catalogos.md](04-catalogos.md); acá, qué condiciona cada una:

| fila | qué condiciona |
|---|---|
| [MP:RN-3](04-catalogos.md#mp-rn-3) · [MP:GR-2](04-catalogos.md#mp-gr-2) | la recuperación tras un cobro fallido y el pago tardío después de suspender (§22). Las lee el grace de `B7`; la cita de `RN-3` que usa [DEC-SUB-019](01-decisiones-vigentes.md#dec-sub-019) se lee *«observado, no registrado»* (su 📌 del 2026-09-25) |
| [MP:GR-1](04-catalogos.md#mp-gr-1) | **`VERIFIED` el 2026-09-26** (sonda 49): un pago dentro de la ventana cierra el ciclo fallido, y cambiar el medio dispara un reintento en el momento que cobra con el nuevo. [DEC-SUB-021](01-decisiones-vigentes.md#dec-sub-021) deja de estar condicionada y la pantalla puede decir que al cambiar la tarjeta se reintenta el cobro |
| [MP:PA-6](04-catalogos.md#mp-pa-6) | si el proveedor cancela el preapproval ante cualquier primer rechazo. **No decide** [DEC-SUB-022](01-decisiones-vigentes.md#dec-sub-022): decide **cuánto dura** el grace de la sucesora de quien venía pagando, y el barrido lo acota a un día (owner 2026-09-25, 3c) |
| [MP:RC-8](04-catalogos.md#mp-rc-8) | qué estado lee el pago en un contracargo. **Fuente documental**: [DEC-SUB-020](01-decisiones-vigentes.md#dec-sub-020) fija qué hacemos al leerlo, no cómo se comporta el proveedor |
| [MP:RF-3](04-catalogos.md#mp-rf-3) | el plazo máximo para reembolsar. **Ya no bloquea** ([DEC-RF-007](01-decisiones-vigentes.md#dec-rf-007)): pasado el plazo la operación no se ofrece y la reparación es manual, asentada por `RF4` ([DEC-RF-008](01-decisiones-vigentes.md#dec-rf-008)) |
| [MP:EX-42](04-catalogos.md#mp-ex-42) | si el `expire` de qzpay vence una `Preference` de Checkout Pro y la relectura lo confirma. **No se mide, por decisión** (FASE 5, owner 2026-09-30, simplificación del corte, lote C; S-43, S-59): el 1a ya no vence `Preference`. Sigue `UNKNOWN` |
| [MP:EX-43](04-catalogos.md#mp-ex-43) | si reenviar una orden con la misma clave y el mismo cuerpo horas después, con el token de la tarjeta ya vencido, devuelve la misma orden si existía, y qué devuelve si nunca se creó (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`). **Ya no condiciona `A3`, que sólo confirma y nunca reenvía**: el reenvío de horas después se declaraba seguro por [MP:EX-41](04-catalogos.md#mp-ex-41), que midió el inmediato (FASE 9 vuelta 3, owner 2026-09-30, lote E). **No bloquea**: condiciona sólo el reenvío del mismo pedido desde una pantalla que quedó abierta, que es una compra que la persona está pidiendo, y la mide **B10** (`B/06` §11) |
| [MP:EX-44](04-catalogos.md#mp-ex-44) | si cancelar un preapproval corta el reciclado de un registro de cobro abierto, o un cambio de medio posterior todavía lo cobra. Condiciona la exención de las terminales (`B/09` §3; `R2`). **No bloquea**. **Se mide en sandbox antes de `B11`, fuera del paso 0** (FASE 5, owner 2026-09-30, simplificación del corte; S-60), y la lee **B11** (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) |
| [MP:EX-45](04-catalogos.md#mp-ex-45) | si una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato sigue `cancelled` releída horas después. Condiciona **el criterio de exención del barrido y la salida de `S16`**, cubiertos mientras tanto por la ventana de relectura de la cancelación por rechazo (`NUCLEO/02` §1.5; `B/09` §3; FASE 9 vuelta 3, owner 2026-09-30, lote K), así que no bloquea **B11**; **se mide en sandbox antes de `B11`, fuera del paso 0** (FASE 5, owner 2026-09-30, simplificación del corte; S-60); el código actual registra seis que no (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) |
| [MP:EX-46](04-catalogos.md#mp-ex-46) | a qué URL va el reintento de una notificación emitida antes de cambiar la URL de la aplicación. Condicionaba el paso 4b del corte (`F-8V2C2-002`). **No se mide, por decisión del owner**: si el día del corte se pierde un reintento, el barrido diario lo relee (mediciones del 2026-09-29, M-4). **No bloquea una unidad**: si va a la vieja, el evento se pierde **y su cobro lo ve el barrido de B11 como el de cualquier desconocido** (la lápida del corte salió: FASE 5, simplificación del corte, S-40 y S-70; verificación, `VF5-06`). **Sin sujeto desde el lote O-B**: la URL no cambia en el corte (`16-fase-7…` §4.2; verificación corta, 2026-09-29) |
| [MP:EX-47](04-catalogos.md#mp-ex-47) | si un registro de cobro ya creado cobra el monto viejo o el nuevo cuando la mutación del preapproval cae en medio. Condiciona la comparación del importe cobrado contra el esperado (`B/09` §3, `B/14` §2.4; `F-8V2B3-001`, `R20`), que es de **B11**. **No bloquea**: si cobra el viejo, lo ve el motivo 24 cuando la mutación bajó el monto, y la línea del resumen del cobro de menos cuando lo subió (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-f`). **Se mide en sandbox antes de `B11`, fuera del paso 0** (FASE 5, owner 2026-09-30, simplificación del corte; S-61) |
| [MP:EX-48](04-catalogos.md#mp-ex-48) | qué campo del pago que aprobó un registro de cobro en un reintento, leído por id, trae el instante de esa aprobación, distinto del `date_created` del registro. **No se mide, por decisión** (FASE 5, owner 2026-09-30, simplificación del corte, lote C; S-57): su único sujeto era la ventana del corte, que salió. Sigue `UNKNOWN` |
| [MP:EX-50](04-catalogos.md#mp-ex-50) | cuántas suscripciones anuales del sistema viejo siguen vivas el día del corte. **No se mide, por decisión** (FASE 5, owner 2026-09-30, simplificación del corte; S-58): la segunda corrida del detector salió, y el owner ya dio el hecho, cero anuales vivas. Sigue `UNKNOWN` |
| [MP:EX-57](04-catalogos.md#mp-ex-57) | si una orden de `/v1/orders` se encuentra por su `external_reference` sin conocer su id. Condiciona la búsqueda por el identificador del pedido de la comprobación de órdenes pagadas (`B/09` §3) y el motivo 23 sin id (FASE 9 vuelta 3, lote E); si no se puede, esa población queda sin detector |
| [MP:EX-59](04-catalogos.md#mp-ex-59) | si, con el `GET` del preapproval trayendo `payer_email` vacío, otra lectura trae el correo del pagador. **Sujeto retirado**: el detector del titular que sólo conoce el proveedor salió (FASE 5, owner 2026-09-30, simplificación del corte; S-38, S-62); la fila de la matriz no cambia de estado |

**La pregunta del capítulo 13 se contestó con el reloj del proveedor**
([DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)), así que las filas del cobro fallido **siguen
gobernando el diseño del grace**, como `DEC-MP-006` dejó escrito.

*(La fuente se contradice en el conteo: el encabezado dice «quince filas», el recuento da 14
`UNKNOWN` en toda la matriz y el texto habla de «dieciséis» y de «las quince de billing»; además
`EX-57` figura cerrada `VERIFIED` y en la tabla, y `EX-59` pasada a `PARTIALLY_SUPPORTED`. Se
transcriben las filas que la tabla vigente lista; el estado de cada una es el de
[04-catalogos.md](04-catalogos.md).)*

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:249, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:255, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:256, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:257, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:262, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:264, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:265, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:266, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:267, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:268, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:269, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:270, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:271, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:272, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:273, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:274, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:275, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:276, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:277, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:278, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:283

#### El riesgo de plataforma

**De las ocho capacidades, la única que vive en una API anunciada como discontinuada es
reembolsar**, y es justamente la que el derecho de revocación necesita. La guía de migración del
proveedor **excluye explícitamente a las suscripciones**. Su interfaz no puede filtrar el nombre de
ningún endpoint hacia el dominio.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:287, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:289

### Cómo se integra, y cómo se libera

**El código de esta épica no va a `staging` por su cuenta**
([DEC-ARCH-007](01-decisiones-vigentes.md#dec-arch-007)). Corta de la rama de integración del
paraguas —`epic/HOS-1352-verticales-billing`— y mergea ahí. La unidad que llega a `staging` es el
paraguas, con las dos épicas adentro ([GATE:M2](30-el-corte.md#gate-m2)).

**«Terminada» no significa «en producción»**: significa lista y verificada contra el contrato
([GATE:M1](30-el-corte.md#gate-m1)).

Y la obligación que hace viable todo lo anterior: **`staging` se mergea periódicamente hacia la
rama del paraguas**, nunca al revés hasta el final.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:296, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:298, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:302, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:304

### Lo que necesita del owner

**Nada que destrabe** (FASE 9 completa, salida 3 de `DEC-METH-004`): lo que la fuente pedía para
destrabar —enviar la PRUEBA 0, avisar del alta de Mobbex, responder la pregunta del capítulo 13—
quedó sin objeto el 2026-09-24: `DEC-MP-005` cerró la evaluación de proveedor sin la PRUEBA 0 ni
la cuenta de Mobbex, y `DEC-MP-006` contestó la pregunta.

**Lo que quedaba en sus manos, y no trababa ninguna unidad, también se cerró:**

1. **Pedir la habilitación de *«pagos automáticos»***: **cerrado sin respuesta**; el owner decidió
   no esperar más y el mandato queda sin destino pendiente (📌 de
   [DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)).
2. **Medir `GR-1` con el próximo rechazo mensual real**: **hecho el 2026-09-26**;
   [MP:GR-1](04-catalogos.md#mp-gr-1) `VERIFIED` con la sonda 49; la salida *«cambiá la tarjeta»*
   de [DEC-SUB-021](01-decisiones-vigentes.md#dec-sub-021) se le puede decir al cliente.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:309, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:311, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:323, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:327, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:331

### Lo que esta épica NO decide

- **Cuál es la pasarela**: cerrado por [DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005) el
  2026-09-24, que fija **Mercado Pago**, con la directriz de que lo que el proveedor no hace lo
  suple el diseño. La evaluación se cerró en el paso 4 de 6 sin completarse, porque los dos pasos
  que faltaban dependían de respuestas que no llegaron.
- **El modelo canónico de cobro**: cerrado por [DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)
  el 2026-09-24: es el **mandato del proveedor**, y el reloj de cobro es suyo.
- **El orden de implementación.** Sale de las dependencias entre capítulos (ver la partición y el
  orden de las unidades en este índice, y [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017)).
- **Qué se reescribe y qué se reutiliza del código actual**: cerrado por
  [DEC-METH-017](01-decisiones-vigentes.md#dec-meth-017) (la FASE 5), y lo que dejó sin veredicto
  por [DEC-METH-018](01-decisiones-vigentes.md#dec-meth-018) (el pase de la FASE 6; FASES 6 y 7,
  verificación, 2026-09-30, F5), salvo `qzpay`, que
  [DEC-ARCH-004](01-decisiones-vigentes.md#dec-arch-004) ya resolvió: **se saca, y queda sólo
  como referencia de lectura** (revisión del owner, 2026-09-28, N2).
- **Nada de la épica de verticales.** Su diseño se sostiene solo, y en esta spec está en las piezas
  `V*` y en la sección de la épica de verticales de este índice.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:335, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:337, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:340, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:342, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:343, .specs/HOS-1354-billing-cobro-y-proveedor/spec.md:347
