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

Todo sale de las fuentes congeladas en el commit `f80c0f27154ca023d97a016707d823ff826cf76a`: cada
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
| `00-indice.md` | este índice: el mapa, la regla de anclas y cómo leer |
| `01-decisiones-vigentes.md` | las decisiones (`DEC-*`) vivas con sus 📌 fundidos, y el registro de las letras del owner |
| `02-nucleo.md` | las invariantes (`INV`), las acciones administrativas (`ACC`) y los plazos (`PLAZO`) |
| `03-contrato-de-cobertura.md` | el contrato entre las dos épicas, las dependencias entre épicas (`DEP`) y la lista cerrada de ítems sólo citables (BA, BB) |
| `04-catalogos.md` | los catálogos únicos: la matriz de Mercado Pago (`MP`), los guards (`GUARD`), las validaciones del panel (`VAL`), las transiciones (`TRANS`) y las prohibidas (`PROH`), los motivos (`MOT`), los candados (`LOCK`), las reglas `RP` y `M` |
| `10-corte/<Pieza>.md` | las **22 piezas del corte**, una por archivo |
| `20-fase-1/` a `20-fase-4/` | las **8 piezas posteriores**, en la carpeta de su fase |
| `30-el-corte.md` | los pasos del corte, la rama de aborto y el rollback, los gates de aceptación, el smoke, y la pseudo-pieza `CORTE` |
| `80-abiertos.md` | lo que las fuentes declaran no cerrado y las preguntas al owner que dejó la redacción |
| `90-retirados.md` | todo ítem muerto, con su ancla, su `Origen:` y por qué murió |
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
