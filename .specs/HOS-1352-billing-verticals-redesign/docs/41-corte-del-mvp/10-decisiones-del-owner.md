---
title: "Corte del MVP · decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-10-01
updated: 2026-10-02
status: CURRENT
fase: 10
---

# Corte del MVP · decisiones del owner

Respuestas del owner, 2026-10-01, sobre la propuesta de `00-propuesta.md` §6 (lote Y a AE), y
después sobre los lotes AF a AO, AP a AU, AV, AW a AY, AZ, BA a BH, BI a BJ, BK a BV, BW a BX, BY a CB y CC a CD (abajo). Todas son la recomendada; BI quedó reemplazada por BJ, y BM se aplicó con la aclaración del owner. Los conteos de la propuesta salen de `contar.py` y `aristas.py`, en esta misma
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

## Lote BI y BJ (2026-10-01)

Respuestas del owner, 2026-10-01, sobre la mitad de `DEC-ENT-003` que el mapa de cobertura de la spec
consolidada dejó sin pieza (`spec-consolidada/_trabajo/cobertura-lectura.json`, sobre `fed4c735ba`):
*«mientras su plan comercial se lo dé, no puede comprar Turista VIP: la UI no lo ofrece y la API lo
rechaza»*. BI se presentó con una premisa errónea y la reemplaza BJ, que es la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| ~~BI~~ | quién rechaza la compra de Turista VIP mientras el plan vigente lo hereda | ~~1~~ | — | **reemplazada por BJ: la premisa era errónea, el checkout no es de `B5`**. BI ponía la dueña en `B5`, pero comprar Turista VIP es elegir un plan de la vertical Turista, es decir `S1` (`B/03` §3.2), y `S1` es de `B3` (`B/descomposicion.md` §2.12); `B5` es el registro del dinero y no tiene checkout |
| BJ | qué pieza rechaza la compra de Turista VIP mientras el plan vigente lo hereda | 1 | sí | **`B3`**: `S1` suma la guarda *«el `user` no tiene un plan vigente que herede Turista VIP»*; en «también», **`B13a`** (la pricing no lo ofrece, `B/19` §4) y **`V3`** (la resolución de capacidades contesta si el plan vigente lo hereda, `V/15` §6.3). **El código de error del rechazo queda abierto**: `apps/api/docs/error-contract.md` no lo fija. Las otras opciones eran `B5`, que no tiene el alta, y una guarda doble en `S1` y en el asiento del pago |

## Lote BK a BV (2026-10-02)

Respuestas del owner, 2026-10-02, a las preguntas que dejó el triage de los abiertos de la spec
consolidada (55 `AB` de `spec-consolidada/_trabajo/abiertos/` y 37 `EF` de los informes de los
redactores, leídos sobre `f80c0f2715`). Todas son la recomendada (opción 1); BM, con una aclaración del owner
el mismo día (en su fila). Los 22 residuos que el mismo triage verificó no son preguntas: se
corrigen sin elección, 18 en la fuente y 4 por adjudicación.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| BK | qué se hace con el texto superado que ningún 📌 tacha fuera de lo que AI nombró: las cuatro decisiones `SUPERSEDED EN PARTE`, las precisadas *«por otra decisión»* (siete pares, con el *«cinco consumidores»* de `DEC-DATA-004`) y la fila `EX-46` de la matriz | 1 | sí | **se amplía el punto 7 de `DEC-METH-019` a esas tres familias**: un veredicto `PARCIAL` con cita y hash, la consolidada omite lo muerto con «[…]» y su nota, y el owner revisa sólo lo que cambie el sentido de una regla (como en AI). Precisa AI. Las otras opciones eran dejar el texto entero con el *Estado* arriba (quien implementa lee lo que ya no va) o reescribir esas decisiones en la consolidada (redactar diseño, que el punto 8 prohíbe) |
| BL | qué hace una pieza anterior que llama a algo que construye una posterior (`S18`/`S31`/`S38` desde `B5` y `B7`, la sucesión de `S1`, `A6` desde la cuarta comprobación, el aviso *«al archivar»*, el grace del punto 8 de `B1`) | 1 | sí | **la pieza anterior escribe su rama entera y la llamada contra una interfaz interna, y la posterior trae la implementación sin tocar código anterior; si lo llamado ya existe cuando llega la anterior, la anterior lo hace entero; un criterio que necesita la implementación real va al *«Lista cuando»* de la posterior**. Aplicada: `B5` y `B7` llaman a `S18`/`S31`/`S38` por interfaz y `B8b` la implementa; `B3` escribe la rama de sucesión de `S1` sin ruta y `B8b` agrega la ruta; `B5` escribe la cuarta comprobación y llama a `A6` por interfaz, y `B10` la implementa; `V6` encola el aviso *«al archivar»* con su plantilla en `PB4`/`PB5` y `V9b` suma los dos avisos previos y el job; el punto 8 de `B1` pasa al *«Lista cuando»* de `B7`. Sin flechas nuevas. Las otras opciones eran que la posterior agregue la llamada (rompe *«aditiva»*) o mover al corte lo llamado (contradice Z y AA) |
| BM | el cambio de precio al corte (acción 19) | 1, con la aclaración del owner | sí | su primera respuesta, *«no vamos a cambiar precios en el corte»*, no elegía entre las opciones y quedó pendiente; **la aclaró el mismo día**, textual: *«en el momento del corte no se puede cambiar precio, quedan los que tenemos actualmente.. una vez la epica esta terminada, mergeada, deployada y smokeada y queda en produccion andando estable, ahi si, si algun dia queremos cambiar un precio, lo podemos cambiar»*. **Los precios del corte son los vigentes hoy**: los carga el paso 3a y no se cambian durante el corte; **ningún precio cambia hasta que el corte está mergeado, deployado, smokeado y estable en producción, es decir con el momento 5 cumplido**. Desde ahí **la acción 19 queda disponible con la mecánica de la opción 1**: sobre una versión sin clientes fija el precio; sobre una con clientes se rechaza y se publica una versión nueva, que rige para las altas nuevas (`DEC-MP-002`, parte 1); el aviso y la mutación a los ya anclados (parte 2) llegan con `B12`, y la cláusula de anunciar un aumento pasa de `B2` a `B12`; un monto menor que ARS 15 se rechaza. **El código de la acción 19 vive en `B2`, y su uso queda vedado hasta el momento 5, como regla de operación.** Las otras opciones eran que `B2` anuncie al corte y `B12` aplique, que `B2` traiga el job (inviable: ciclo) o editar el monto vigente (contra `DEC-ARCH-001`) |
| BN | qué pieza crea una tabla que usan dos piezas del corte (`manual_payment`, `idempotency_key`, `reconciliation_mark_payment`, el índice parcial de `refund`, `domain_event`) | 1 | sí | **cada tabla nace con todas sus restricciones (AD) en la primera pieza del grafo que la escribe o la referencia; si una `FK` suya apunta a una tabla que nace después, nace con la dueña de la tabla destino, y la rama que la escribe se completa ahí y se prueba con filas sembradas (AS)**. Aplicada: `B3` crea `manual_payment` e `idempotency_key`; `B5` crea `payment` (AV), `refund` con su índice parcial y `reconciliation_mark_payment`; `V9a` crea `domain_event` (inferido: ninguna pieza anterior la escribe). Sin flechas nuevas. Precisa AP y AV. Las otras opciones eran que cada pieza cree las de su capítulo (`B5→B3`, ciclo) o una migración única al principio (contradice AP y AV) |
| BO | cómo se revoca una cortesía temporal (acción 1) | 1 | sí | **revocar es reanudar antes del fin por un acto del `SUPER_ADMIN`: un tercer evento de `S10`, con `fin_real` y la relectura, sin reembolso y con el aviso a la persona; lo agrega `B9b`, con su fila en `B/19` §4**. Sin flechas nuevas. Las otras opciones eran una transición propia (duplica `S10`) o sacar *«revocar»* de la acción 1 |
| BP | cuándo se corta el Turista VIP que el plan nuevo hereda (`DEC-ENT-004`) | 1 | sí | **en `S2`, cuando el plan comercial pasa a `ACTIVE`, con una cláusula nueva que cancela la suscripción de Turista VIP, con el correo antes**: es la única que cumple *«el servicio no se interrumpe»*. Precisa BC. Las otras opciones eran `S1` (si la ventana vence queda sin VIP y sin plan) o el primer pago acreditado (un evento de `B5`, contra BC) |
| BQ | qué cubre el ensayo del corte: Q1, si recorre la rama de aborto; Q2, con qué etiqueta se registra la medición de `EX-49` | Q1: 1 · Q2: 1 | sí | **Q1: el ensayo recorre la rama de aborto una vez, en `staging`, sobre la misma copia**: una falla provocada después del 1b, y se verifica restaurar el 2b, la imagen vieja, los inversos (b) y (c) y la regla del 0b puesta hasta el reintento. **Q2: la medición de `EX-49` lleva la etiqueta `prod`**: lee datos de producción, no muta nada y es gate del corte real. Las otras opciones eran que la rama corra por primera vez el día del corte, y la etiqueta `staging` |
| BR | los correos: la flecha de `U2` y las filas que faltan en el catálogo | 1 | sí | **dos flechas, `U2→B3` y `U2→V4`, que por transitividad cubren a las demás piezas que encolan; y dos filas en el catálogo de correos: *«reembolso de revocación fallido»* y *«cobro duplicado detectado»*, transaccionales, no suprimibles, a `SUPER_ADMIN` y al producirse el evento, con `B11` como dueña** (`DEC-OBS-001`). Las otras opciones eran una sola fila genérica o ninguna flecha |
| BS | regla para los detalles que las fuentes dejan a la implementación (rutas, permisos, `error.code`, nombres de tablas auxiliares, cadencias, listas que viven en el código, textos de aviso, labels, credenciales) | 1 | sí | **lo propone el PR de la pieza dueña siguiendo lo escrito del repo, lo aprueba la revisión de contexto fresco del momento 1 (y el owner en el PR cuando es texto al cliente o un permiso nuevo), y queda escrito en la sección de la pieza en la consolidada al mergear**. No entra lo que es regla comercial ni lo que cambia comportamiento. Precisa `DEC-METH-019`. Las otras opciones eran una tabla única antes de la primera pieza o una convención sin registro |
| BT | las mediciones de producción que nadie corrió (`partners` con `owner_user_id` repetido; las filas vivas del rol de dueño de comercio, sus permisos y su tabla de contactos) | 1 | sí | **la pieza que las necesita mide con `hops psql --target=prod`, en sólo lectura y contando, antes de su merge, y deja el número en el PR; si da cero no hay nada que decidir, y si no, vuelve al owner con el número antes del merge**. Una salida vacía de `hops psql` no es un cero: se repite. Las otras opciones eran confiar en las mediciones viejas o que la migración decida sola |
| BU | dónde vive la ventana `N` del resumen de conciliación (`DEC-OBS-001`) | 1 | sí | **una clave más en la tabla versionada de plazos de billing (`B2`), que cambia la acción 22, sumada a la lista cerrada de `NUCLEO/02` §1.5; su valor inicial lo fija el owner antes del merge de `B11`**. Las otras opciones eran una variable de entorno o una constante (las dos contra el PDR §9) |
| BV | la fecha límite de la Fase 1 (`V9b`) | 1 | sí | **límite = instante del corte + plazo 1 − plazo 4, con la versión 1 de los plazos; la Fase 1 se mergea a producción antes de esa fecha, y el gate de la fase la verifica contra ese número**. Vale con BL, porque el aviso *«al archivar»* ya sale desde `V6`. Las otras opciones eran esa fecha menos un margen fijo, o decidirla a ojo |

## Lote BW y BX (2026-10-02)

Respuestas del owner, 2026-10-02, a las dos preguntas que dejó la aplicación del lote BK a BV. Las
dos son la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| BW | qué pieza crea `domain_event`, que BN ponía en `V9a` con una premisa errónea: nucleo/08 §1.1 manda registrar toda transición y todo acto administrativo, así que la escriben antes `V2`, `V4` y `B3` | 1 | sí | **`U2`**, que es ancestro de todas las piezas que la escriben y ya lleva la correlación «al evento» (nucleo/08 §2); precisa la aplicación de BN. Las otras opciones eran la primera que la escribe (`V2` y `B3` no se ordenan en el grafo) o dejarla en `V9a` (inviable: se escribiría antes de existir) |
| BX | cuándo se fija el valor del plazo 19 (BU), si la versión 1 de los plazos falla con una clave vacía desde el merge de la pieza que la escribe, anterior a `B11` | 1 | sí | **el owner fija el valor del plazo 19 antes del merge de `B2`**, y no de `B11`: la regla de que la versión 1 falla con un plazo vacío se conserva sin excepciones. Precisa BU. Las otras opciones eran exceptuar la clave hasta `B11` o agregarla con una migración de datos de `B11` |

## Lote BY a CB (2026-10-02)

Respuestas del owner, 2026-10-02, a las cuatro preguntas que dejó la segunda vuelta del triage de la
spec consolidada (fuentes en `17f9702675`). Todas son la recomendada (opción 1). La misma vuelta
encontró que el registro de BS no recogía los defaults de su opción 1; se asientan en un 📌 nuevo
sobre `DEC-METH-019`.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| BY | qué hace una pieza anterior que LEE una tabla que nace después (la guarda de `S15` y el predicado (f) de `G-R1-F`, de `B3`, leen `reconciliation_mark_payment`, que nace en `B5` por BN) | 1 | sí | **BL vale también para leer**: `B3` escribe la guarda de `S15` y el predicado (f) de `G-R1-F` contra una interfaz interna; `B5` trae la implementación sobre su tabla y prueba el rechazo con filas sembradas, y ese criterio va al *«Lista cuando»* de `B5`. Precisa BL. Las otras opciones eran que la tabla naciera en `B3` sin su FK (contra BN) o pasar `S15` entera a `B5` |
| BZ | por qué camino le llega un aumento de precio a un cliente ya anclado (`B12`, BM) | 1 | sí | **el aumento a un anclado es una migración a la versión nueva, por `S37` y `S38`, con el motivo *«aumento»***: la fecha y los contactos son los del plazo 11, sin la cohorte `PARA_RESOLVER` y sin las reglas propias de la migración que no aplican a un aumento (la promo viva se conserva). Precisa BM y `DEC-MP-002`. Las otras opciones eran una transición nueva que muta sólo el monto o que el aumento no alcance a los anclados |
| CA | quién construye las superficies de la suspensión sobre el Turista VIP (`V/15` §6.3) y qué pasa al regularizar | 1 | sí | **`B7` construye el aviso de suspensión que nombra lo que se pierde como turista y suma a `S7` la cláusula espejo de BP**: si al regularizar el plan vuelve a heredar Turista VIP, cancela el VIP pago, sin reembolso y con el correo antes; **`B13a` construye la advertencia en la pantalla de compra de VIP**. Las otras opciones eran las dos superficies en `V3` o las superficies sin la cláusula en `S7` |
| CB | dónde vive el caché del conjunto efectivo (`V/02` §3) | 1 | sí | **en el Redis que la API ya usa**, con la invalidación por `user`; si Redis no responde se lee la resolución en vivo; y un contador de entradas sospechosas en los logs estructurados. Las otras opciones eran memoria del proceso (no se invalida en todas las instancias) o sin caché |

## Lote CC y CD (2026-10-02)

Respuestas del owner, 2026-10-02, a las dos preguntas que dejó la adjudicación de la primera vuelta
de verificación ciega de la spec consolidada (fuentes en `c7a3fac900`, spec en `296e6495b6`). Las
dos son la recomendada (opción 1). Los residuos que la misma adjudicación encontró en las fuentes no
son preguntas: se corrigen sin elección, con su autoridad.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CC | si un descenso encolado —monto ya mutado al precio del plan destino (`DEC-SUB-008`), y `S38` que aplica el cambio de versión al fin del ciclo— cuenta como cliente de la versión destino a los efectos de BM y BZ | 1 | sí | **un descenso encolado cuenta como cliente de la versión destino**: la acción 19 rechaza fijar el precio de una versión hacia la que hay un `S38` encolado (BM) y se publica una versión nueva; el cliente llega por `S38` a la versión cuyo precio vio y, si después hay aumento, le llega por BZ como a cualquier anclado. **El rechazo de la acción 19 suma un predicado** —cuenta también las filas con un `S38` encolado hacia esa versión— **y su test**, en `B2`. Precisa BM y BZ, y `B/12` §3.2. Las otras opciones eran que no cuente (`S38` aplica el precio nuevo y una relectura muta el monto en el acto: un aumento sin los 60 días del §29) o que fijar el precio cancele los descensos encolados con un aviso (el cliente pierde un pedido que hizo) |
| CD | por qué transición nace el addon que elige gratis el beneficiario de un grant con `includesAddons: true` (`B/16` §3.1-§3.2: sin `payment`, sin comprobante, con el ancla como título), si la máquina de la instancia (`B/03` §8, exhaustiva) sólo tiene `A1` → `PENDING_AUTHORIZATION` y `A2` con preapproval u orden | 1 | sí | **una transición nueva, `A1-bis`**: *(sin fila)* → `ACTIVE`, con el evento *«la persona elige un addon compatible teniendo un ancla viva de un grant con `includesAddons: true`»*, sin preapproval ni orden, sin `payment` ni comprobante, y con el ancla como título de la instancia; **la construye `B10`**, con su AC y su test. `A5` ya apaga la instancia cuando se revoca el grant. Las otras opciones eran reusar `A1` y `A2` con una autorización vacía (un `PENDING_AUTHORIZATION` que no espera nada, y `A2` nombra preapproval u orden) o diferir el addon elegido gratis a una pieza posterior (`FILA:B10` e `INV:28` quedarían incumplidas) |

## Lote CE (2026-10-02)

Respuesta del owner, 2026-10-02, a la pregunta que quedó abierta después de CD (fuentes en
`e291df0b5b`). Es la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CE | si el objetivo `LISTING` de un addon que nace por `A1-bis` (CD) exige las mismas guardas que `A1` (`B/03` §8): ficha propia, de la vertical del producto, y en un estado que acepte destacarla | 1 | sí | **sí: `A1-bis` exige sobre el objetivo `LISTING` las mismas guardas que `A1`**: la ficha es propia de la persona, de la vertical del producto, y `ficha(idDeFicha).admiteDestaque` contesta sí —ni `PURGED` ni `MODERATED`—; si no, *«no existe»*, como en `A1`. Que el addon sea gratis no cambia qué ficha puede destacarse. **Una guarda más en `A1-bis` y su test, en `B10`**. Precisa CD. Las otras opciones eran sólo la autorización del capítulo 17 (se podría destacar una ficha moderada, que nadie ve) o dejarlo abierto hasta `B10` (`B10` no podría cerrar su *«Lista cuando»*) |

## Lote CF y CG (2026-10-02)

Respuestas del owner, 2026-10-02, a las dos preguntas de orden de merge que dejó la pasada 4 de
redacción de la spec consolidada (fuentes en `b949031c70`). Las dos son la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CF | en qué PR entra el predicado de CC (la acción 19 de `B2` cuenta como cliente de una versión la fila con un `S38` encolado hacia ella), si lee la cola de cambios programados (`ESQ:3`), que crea `B3` (AP), y `B2` se mergea antes que `B3` | 1 | sí | **el predicado y su test van en el PR de `B3`**, como una cláusula más sobre el rechazo de la acción 19, que ya existe; **el AC sigue siendo de `B2`** en la spec, y el criterio de salida que lo demuestra es de `B3`. Precisa CC. Las otras opciones eran que `B2` creara la cola (reabre AP) o escribir el predicado en `B2` contra una interfaz y probarlo en `B3` (BL habla de piezas posteriores que implementan una interfaz, no de una tabla) |
| CG | dónde vive la prueba de punta a punta de la baja (`B/20` §5.1 punto 3, *«la cancelación `B8`»*), si la pantalla de la baja la construye `B13a` y `B13a` espera a `B8a` (BH) | 1 | sí | **en `B13a`**, la primera pieza del corte con la API, la web y la pantalla de la baja juntas; **`B8a` conserva sus pruebas de integración**. Precisa el punto 3 de `B/20` §5.1, escrito antes de partir `B8` y `B13` (Z). Las otras opciones eran la prueba en `B8a` contra la API sin pantalla (no ejercita la pantalla que el e2e reemplaza del smoke manual) o las dos (dos pruebas del mismo flujo) |

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
