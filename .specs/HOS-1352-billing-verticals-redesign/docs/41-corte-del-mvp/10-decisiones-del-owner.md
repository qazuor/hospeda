---
title: "Corte del MVP · decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-10-01
updated: 2026-10-01
status: CURRENT
fase: 10
---

# Corte del MVP · decisiones del owner

Respuestas del owner, 2026-10-01, sobre la propuesta de `00-propuesta.md` §6 (lote Y a AE), y
después sobre los lotes AF a AO, AP a AU, AV, AW a AY, AZ y BA a BH (abajo). Todas son la recomendada. Los conteos de la propuesta salen de `contar.py` y `aristas.py`, en esta misma
carpeta.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| Y | precisar «juntas y terminadas» (`DEC-ARCH-007`) y el momento 2 de `DEC-ARCH-016` («las 25 unidades en `Done`») | 1 | sí | un 📌 sobre cada una: «terminadas» es el alcance del corte; las fases posteriores son del sistema nuevo, aditivas (no reescriben filas ni código del corte), con su propio gate; el momento 2 cuenta las piezas del corte. El MVP se registra en una DEC nueva |
| Z | partir unidades para que el grafo cierre | 1 | sí | `V8`, `V9`, `B8`, `B9` y `B13` se parten en una mitad *a* (corte) y una *b* (posterior), con los alcances de `00-propuesta.md` §1; la rama de sucesión de `S1` queda sin ruta hasta `B8b`; una pasada por unidad partida antes de cerrar la spec consolidada |
| AA | addons el día del corte | 1 | sí | al corte, el modelo de addons entero (productos, versiones, instancias, compra) y la fuente `ADDON` real sobre la tabla vacía, con `G-R2-C`; la venta, el destaque y la orfandad (`B10`), después |
| AB | Partner | 1 | sí | la migración estructural de `V7` al corte (borra `starts_at`, `ends_at`, `tier` con su índice y agrega el `UNIQUE` parcial), con sus lectores de `tier` retirados; presencia, postulación, reclamo y rol, después |
| AC | retención y seudónimo | 1 | sí | `V9a` al corte (registro de actos del dueño y seudónimo; la función del seudónimo se reasigna a `V4`); `V9b` (jobs, `PB9`, avisos) mergeada antes de la primera fecha en que un aviso de retención podría salir |
| AD | qué es «el modelo nace completo» | 1 | sí | todo el esquema de las 25 unidades (tablas, columnas, enums, `FK`, `UNIQUE`, `CHECK`, extras) nace en las migraciones de la rama antes del corte; una fase posterior no trae migración estructural |
| AE | cómo viajan las fases posteriores | 1 | sí | una rama épica nueva por fase posterior, con los mismos gates por unidad, que entra a `staging` entera |

## Lote AF a AO (2026-10-01)

Respuestas del owner, 2026-10-01, sobre el registro del MVP y el método de la spec consolidada.
Todas son la recomendada (opción 1). Las letras U a X de la serie del 2026-10-01 no son de este
lote: ver AJ.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| AF | qué DEC registra el MVP y cuál la consolidación | 1 | sí | `DEC-ARCH-017` registra el MVP: precisa `DEC-ARCH-007` y `DEC-ARCH-016` y recoge el corte, la partición *a*/*b* (Z), el esquema que nace completo (AD) y una rama épica por fase (AE); `DEC-METH-019` registra la consolidación |
| AG | qué pasa con las `spec.md` de `HOS-1353` y `HOS-1354` | 1 | sí | la spec consolidada las REEMPLAZA; quedan como stubs con su frontmatter (por Linear) y un aviso que apunta a la consolidada. Se hace en la consolidación, no antes |
| AH | cómo se organiza la consolidada | 1 | sí | por pieza del corte y de cada fase, con catálogos únicos (núcleo, transiciones, guards, etc.), en `spec-consolidada/` del paraguas |
| AI | quién adjudica lo ambiguo | 1 | sí | un agente adjudica las 33 filas `MIXTO` y los 📌 que caen en prosa, con cita y hash de línea; el owner revisa sólo las que cambian el sentido de una regla. Se hace en la consolidación |
| AJ | qué fueron las letras U a X del 2026-10-01 | 1 | sí | existieron y fueron OPERATIVAS de la promoción #3447, no de diseño: U = un agente revisa las 72 traducciones de novedades (PR #3449); V = arreglar el ReDoS de `html-text.ts` y la regex de `</script>`, y descartar la alerta del test como falso positivo; W = los 46 PRs con `whats-new-none`; X = las traducciones quedan `reviewed` (la 2) |
| AK | cómo aparecen U a X en la consolidada | 1 | sí | con una línea en `00-indice.md` de la consolidada; no entran al inventario |
| AL | de dónde salen las US, los AC y los tests | 1 | sí | se DERIVAN con cita obligatoria a ≥1 ítem fuente (`INV`, `TRANS`, `DEC`, `LISTA`, `GUARD`, `MP`…). `trazar.py` suma reglas: todo ítem vivo cubierto por ≥1 AC, todo AC con ≥1 test, todo AC cita fuente. Lo que no tiene fuente va a `80-abiertos` como pregunta al owner. Los verificadores ciegos suman *«toda US/AC/test tiene fuente»*, y el canario incluye un AC inventado |
| AM | forma de las US y los AC | 1 | sí | por pieza (30); US por actor (anfitrión, dueño de comercio, partner, admin, turista, sistema/cron); AC en Given/When/Then con id `AC:<pieza>:n`; el *«Lista cuando»* es el AC de salida |
| AN | forma del mapa AC → test | 1 | sí | por pieza, con tipos de lista cerrada: unitario, integración con DB, ruta API (contrato de errores), guard estático, migración (desde cero y sobre datos), e2e web/admin, smoke manual con etiqueta (local/staging/prod, MP sandbox). Cada invariante con ≥1 test; cada transición con test de integración, incluidas las prohibidas; cada uno de los 35 guards con su prueba de mutación |
| AO | plantilla por pieza | 1 | sí | plantilla completa; una sección que no aplica se declara «N/A» con razón y nunca se borra: objetivo/alcance/fuera; US y AC; reglas (refs a catálogos); modelo de datos y migraciones con carril; API (rutas, tier, permisos, errores); UI web/admin e i18n; cron y outbox; env vars; auditoría y observabilidad; seguridad; testing esperado; smoke y etiquetas; dependencias, rollback y despliegue; labels de Linear; abiertos y `Origen:` |

**Método aprobado con el lote** (de la propuesta previa a la consolidación): inventario cerrado por
script de 18 fuentes sobre un SHA congelado; anclas `<a id="...">` y `Origen: archivo:línea` en cada
ítem; los ítems muertos en `90-retirados.md`; `trazar.py` en 0 en las dos direcciones; dos
verificaciones ciegas opuestas (qué falta / qué se inventó) con canarios, hasta una vuelta sin
`BLOQUEA`; lo anterior queda congelado como histórico.

## Lote AP a AU (2026-10-01)

Respuestas del owner, 2026-10-01, a las preguntas que dejó la pasada de dependencias ocultas de Z
(`20-aplicacion.md` §2.2 y §3). Todas son la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| AP | qué pieza del corte crea el esquema de lo que va después | 1 | sí | cada tabla la crea la pieza del corte dueña de la tabla de la que cuelga: el esquema de `V7` y su migración estructural, con los lectores de `tier` retirados, en `V6`; la cola de cambios, las columnas de la sucesión y las dos tablas de `B12`, en `B3`; promos y cortesías, en `B9a`; addons, en `B4`, que le agrega a `payment` la columna de la instancia. Mitigación: el drift guard sobre la rama de cada fase falla si la fase trae una migración estructural |
| AQ | quién contesta la fuente `CORTESÍA` real al corte | 1 | sí | `B9a`, junto con la fuente `GRANT` |
| AR | las bajas desde `GRACE_PERIOD` y `SUSPENDED` | 1 | sí | `B8a` es `S11`, `S12`, `S23` y `S24`; `S22` (desde una pausa) queda en `B8b` |
| AS | las ramas del corte que tocan lo que sólo existe después | 1 | sí | se implementan enteras al corte sobre el esquema vacío; `S20`, `S21`, `S32` y `S33` pasan a la pieza del corte que las llama; se prueban con filas sembradas; la fase posterior sólo agrega lo que crea filas |
| AT | el gate propio de una fase posterior | 1 | sí | el momento 2 aplicado a la rama de la fase, más el checklist de smoke extendido con lo de la fase: la parte de `staging` antes del merge y la de producción como un 5c propio |
| AU | cómo se dice que todavía no se puede cambiar de plan | 1 | sí | `B13a` muestra en Mi Suscripción *«todavía no se puede cambiar de plan: date de baja al fin del período y volvé a suscribirte»*, y `B8b` lo saca, como excepción declarada y acotada a ese texto |

## Lote AV (2026-10-01)

Respuesta del owner, 2026-10-01, a la pregunta que dejó la aplicación de AP y AS
(`20-aplicacion.md` §5). Es la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| AV | dónde viven al corte `S21`, `S32`, `S33` y la orfandad que dispara a `S21` | 1 | sí | las tablas del modelo de addons pasan de `B4` a `B3`, y `payment` nace en `B5` con su columna de la instancia; la fuente `ADDON` y `G-R2-C` siguen en `B4`; `S21` y la orfandad (`A5`) van a `B5`, su primer llamador; `S32` y `S33`, a `B7`. Sin flechas nuevas. Precisa AP en el renglón de addons |

## Lote AW a AY (2026-10-01)

Respuestas del owner, 2026-10-01, a las preguntas que dejó la etapa de inventario y adjudicación de
la spec consolidada (`DEC-METH-019`; `spec-consolidada/_trabajo/`, inventario sobre `0dbe448276`).
Todas son la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| AW | cómo se agrupan en fases las ocho piezas posteriores (AE fija una rama épica por fase, no cuántas ni cuáles) | 1 | sí | **cuatro fases posteriores, en este orden**: **Fase 1** = `V9b` sola (tiene que estar mergeada antes del primer aviso de retención, AC); **Fase 2** = `B8b` + `B9b`; **Fase 3** = `B10` + `B13b` + `B12`; **Fase 4** = `V7` + `V8b`. Respeta el grafo (`V9b` y `B9b` antes de `B10`; `B13b` antes de `B12`; `V7` antes de `V8b`). Las otras opciones eran una sola fase con las ocho (`V9b` atada a la rama más grande) y una fase por pieza (ocho congelamientos y ocho 5c) |
| AX | qué es un ítem «normativo» para AL (*«todo ítem vivo cubierto por ≥1 AC»*) | 1 | sí | **exigen AC**: las decisiones (menos las de metodología, `DEC-METH-*`), los 📌, las filas de pieza, los *«Lista cuando»*, los guards, las invariantes, las transiciones, las acciones administrativas, los plazos, los motivos, los candados, `RP`, `M`, los pasos del corte, los gates y los traslados del corte (esquema, transición → pieza, instancia de addon → pieza); **sólo citables**: la matriz, las letras del owner y la lista de piezas |
| AY | qué se hace con los restos que la adjudicación encontró en las fuentes y con la cifra de `MIXTO` | 1 | sí | **se corrigen los restos** (en `B/descomposicion.md`: el modelo de addons es de `B3` por AV; `S20` va a `B9a` por AS, y `S21` y `A5` a `B5` por AV) **y un 📌 sobre `DEC-METH-019`** asienta las 38 filas `MIXTO` (no 33) y AX como criterio de AL; AW, que precisa AE, va en un 📌 sobre `DEC-ARCH-017`, que es la decisión de AE |

## Lote AZ (2026-10-01)

Respuesta del owner, 2026-10-01, a la pregunta que dejó la aplicación de AX en las herramientas de la
spec consolidada (tres familias del inventario que AX no nombraba). Es la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| AZ | si las transiciones que no existen (`PROH`), las validaciones del panel que conservan nombre de guard (`VAL`: `G-R3` y `G-R5-B`) y las dependencias entre épicas (`DEP`) son normativas para AL | 1 | sí | **las tres exigen AC**: se suman al criterio de «normativo» de AX. Las otras opciones eran que sólo `PROH` lo exigiera (una validación del panel o una lectura entre épicas quedaba sin criterio verificable) o ninguna (chocaba con AN, que pide un test por cada transición prohibida) |

## Lote BA a BH (2026-10-01)

Respuestas del owner, 2026-10-01, a las preguntas que dejaron el mapa de cobertura de la spec
consolidada (BA a BE, `spec-consolidada/_trabajo/cobertura-lectura.json`, sobre `dab68c3ded`) y el
análisis de nueve posibles errores de las fuentes que ese mapa reportó (BF a BH). Todas son la
recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| BA | qué se hace con los ítems normativos que no construye ninguna pieza (reglas de método, de CI, de organización, de alcance) | 1 | sí | **pasan a sólo citables con una lista CERRADA por script**, que vive en `03-contrato-de-cobertura.md` de la consolidada: `INV:17`, `INV:33`–`INV:37`, `DEC-CI-001` con sus 📌1 y 📌2, `DEC-CI-002`, `DEC-ARCH-005` con su 📌1, `DEC-ARCH-017#📌3`, `DEC-MIG-002`, `DEC-MIG-005#📌5`, `DEC-AUTH-003#📌2`, `DEC-DATA-005#📌4` y `DEC-MP-008#📌2` (18). Precisa AX: 📌 sobre `DEC-METH-019` |
| BB | si exigen AC los 📌 que sólo retiran algo o son notas de registro | 1 | sí | **pasan a la misma lista cerrada**: `DEC-OBS-001#📌2`, `DEC-ADDON-004#📌2`, `DEC-SUB-013#📌2`, `DEC-MP-003#📌1` y `DEC-SUB-019#📌1`; **`DEC-TRIAL-004#📌3`** (teléfono, CUIT y dispositivo no se guardan) **se cubre con un AC negativo en `V4`** |
| BC | qué pieza construye tres comportamientos que ninguna fila asignaba | 1 | sí | **`DEC-ENT-004`** (cancelar en el acto, sin reembolso, el Turista VIP pago que el plan hereda) → **`B3`**, al corte; **`ACC:6`** (configurar el plan y el método de pago de un Partner) → **`V7`**, con `B5` que lo provee; **`INV:9`** (verticales simultáneas en estados distintos) → **`V3`**, con `B3` en «también». Se escribe en las filas de la partición, con un 📌 |
| BD | qué pieza construye la tabla de plazos de verticales y la acción 22 (mitad verticales), que seguían en `V9` | 1 | sí | **`V6`, al corte**: crea la tabla versionada de plazos de verticales y su versión 1 en la misma migración que la escritura `C`, y la acción 22 sobre sus claves; `V9b` sólo las lee. 📌 sobre `DEC-DATA-008` |
| BE | cómo llevan AC los ítems cuya dueña es el corte (pasos, gates, DEC que sólo el corte ejecuta) | 1 | sí | **la pseudo-pieza `CORTE`**: `AC:CORTE:n` y `TEST:CORTE:n` en `30-el-corte.md` de la consolidada, con tipo smoke manual (ensayo en `staging`, 5c en producción) o guard estático; `trazar.py` lo acepta. 📌 sobre `DEC-METH-019` (AM) |
| BF | quién construye la herramienta del paso 4b (la sonda de Webhooks, el pago chico, su devolución y la verificación en `provider_notification`) | 1 | sí | **`U3`**: el script suelto de `scripts/cutover/` suma la sonda (alta, cancelación y relectura), el pago chico por la API de pagos con su devolución releída por id, la consulta de sólo lectura a `provider_notification`, los ids al manifiesto y los inversos (b) y (c) de la rama de aborto. Su *«Lista cuando»* corre contra la cuenta de pruebas; la entrega real al receptor de `B3` se prueba en el ensayo, que ya incluye el 4b (D-4). Sin flechas nuevas; respeta K. Las otras opciones eran `B3` (el pago por fuera del adaptador) y `U3` detrás de `B3` (reabría K) |
| BG | quién crea el esquema de promos y cortesías, que AP puso en `B9a` y que leen antes `B3` (`S3`, `S14`), `B5` (`P1`), `B11` (la sexta comprobación) y `B13a` (Mi Suscripción) | 1 | sí | **`B3`**, como AV hizo con addons, y por el criterio de AP: cortesías y redenciones cuelgan de `subscription`. `B9a` conserva las fuentes `CORTESÍA` y `GRANT`, `S13`, `S20` y la herramienta del 3b. Sin flechas nuevas. Precisa AP. Las otras opciones eran dejar el esquema en `B9a` con tres transiciones compartidas y dos flechas, o diferir las ramas (chocaba con Y y AS) |
| BH | dónde van las superficies de `B13` que confirman o editan actos de otra fase: las filas 13 y 13-bis del `19` §4 (confirmaciones de la acción 2, de `B9a`) y el editor de códigos promocionales (acción 21, de `B9b`) | 1 | sí | **cada superficie va con la fase de su acto**: las filas 13 y 13-bis a **`B13a`**, con la parte de addons leyendo el esquema vacío (AS), y **la flecha nueva `B9a → B13a`**; el editor de códigos a **`B9b`**, con su operación; **`B13b`** queda con el aviso del destaque y el editor de versiones de complemento. Precisa Z. Las otras opciones eran llevarlas a la pieza del acto o dejar Z literal con la acción 2 sin confirmación hasta la Fase 3 |

## Resultado del corte

- **Al corte, enteras (17)**: `U1`–`U3`, `V1`–`V6`, `B1`–`B7`, `B11`.
- **Partidas (5)**: `V8`, `V9`, `B8`, `B9`, `B13` — la mitad *a* al corte, la *b* después.
- **Después, enteras (3)**: `V7` (salvo su migración estructural, por AB), `B10` (salvo su modelo
  y la fuente `ADDON`, por AA), `B12`.
- **Guards al corte**: 34 de 35; queda afuera `G-R1-C` (cierre de la sucesión, `B8b`).
- **Las fases posteriores (AW)**: cuatro, en orden: Fase 1 `V9b`; Fase 2 `B8b` y `B9b`; Fase 3 `B10`,
  `B13b` y `B12`; Fase 4 `V7` y `V8b`. Cada una, una rama épica con su gate (AE, AT).

## Pendiente de aplicar

> **Aplicado el 2026-10-01** (`20-aplicacion.md` §1): Y y AF en el log (`DEC-ARCH-017`,
> `DEC-METH-019` y los dos 📌); Z, AA, AB, AC, AD y AE en las dos descomposiciones y en `D/16`
> §4.6–§4.7. Falta el árbol de Linear, que sale de la spec consolidada. La pasada de Z dejó seis
> preguntas nuevas para el owner, AP a AU (`20-aplicacion.md` §3).

- **Y**: los dos 📌 en `01-decision-log.md` (sobre `DEC-ARCH-007` y `DEC-ARCH-016`) y la DEC nueva
  que registra el MVP. El owner los aprobó en el contenido con la elección 1; el texto se escribe en
  el paso de la spec consolidada.
- **Z, AA, AB, AC, AD**: la partición de unidades, la reasignación del seudónimo a `V4` y el
  alcance del esquema se escriben en la spec consolidada (`descomposicion.md` de cada épica y
  `16-fase-7-del-paraguas.md` §4.6–§4.7), y después en el árbol de Linear.

## Lo que la propuesta no pudo verificar (sigue abierto)

1. Si `partners` tiene filas en producción (decide si el `UNIQUE` de AB es seguro).
2. La duración del trial y los plazos de retención, que fija el owner antes del merge de `V6`.
3. Dependencias internas ocultas en las mitades *a* más allá de la de `S1`.
4. El tamaño de cada pieza: el diseño no tiene estimaciones.
5. Si la baja self-service tiene una exigencia legal con fecha.
6. Si `retenciónDetenida` real sobre cero pausas cumple el juego de casos de la real.
