---
title: "Corte del MVP · decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-10-01
updated: 2026-10-07
status: CURRENT
fase: 10
---

# Corte del MVP · decisiones del owner

Respuestas del owner, 2026-10-01, sobre la propuesta de `00-propuesta.md` §6 (lote Y a AE), y
después sobre los lotes AF a AO, AP a AU, AV, AW a AY, AZ, BA a BH, BI a BJ, BK a BV, BW a BX, BY a CB y CC a CD, y después CE a DD (abajo). Todas son la recomendada; BI quedó reemplazada por BJ, y BM se aplicó con la aclaración del owner. Los conteos de la propuesta salen de `contar.py` y `aristas.py`, en esta misma
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
| BM | el cambio de precio al corte (acción 19) | 1, con la aclaración del owner | sí | su primera respuesta, *«no vamos a cambiar precios en el corte»*, no elegía entre las opciones y quedó pendiente; **la aclaró el mismo día**, textual: *«en el momento del corte no se puede cambiar precio, quedan los que tenemos actualmente.. una vez la epica esta terminada, mergeada, deployada y smokeada y queda en produccion andando estable, ahi si, si algun dia queremos cambiar un precio, lo podemos cambiar»*. **Los precios del corte son los vigentes hoy**: los carga la migración estructural del paso 3 y los verifica el 3a; no se cambian durante el corte; **ningún precio cambia hasta que el corte está mergeado, deployado, smokeado y estable en producción, es decir con el momento 5 cumplido**. Desde ahí **la acción 19 queda disponible con la mecánica de la opción 1**: sobre una versión sin clientes fija el precio; sobre una con clientes se rechaza y se publica una versión nueva, que rige para las altas nuevas (`DEC-MP-002`, parte 1); el aviso y la mutación a los ya anclados (parte 2) llegan con `B12`, y la cláusula de anunciar un aumento pasa de `B2` a `B12`; un monto menor que ARS 15 se rechaza. **El código de la acción 19 vive en `B2`, y su uso queda vedado hasta el momento 5, como regla de operación.** Las otras opciones eran que `B2` anuncie al corte y `B12` aplique, que `B2` traiga el job (inviable: ciclo) o editar el monto vigente (contra `DEC-ARCH-001`) |
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

## Lote CH y CI (2026-10-02)

Respuesta del owner, 2026-10-02, a la única pregunta que dejó la adjudicación de la vuelta 2 de
verificación ciega (fuentes en `69cbe79360`, spec en `200317c484`; hallazgo `H2-VA8-7`). Es la
recomendada (opción 1). **Y a CI**, el mismo día, el hueco de orden que dejó a la vista la
aplicación de CH: también la opción 1.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CH | quién escribe `provider_link.cancelado_visto_en`, si `B/09` §3 dice *«la primera relectura que ve `cancelled`, sea del barrido, del handler o de una transición»* y el reparto de `B/descomposicion.md` §2.11, de la misma letra Z, le da la escritura sólo al barrido de `B11`; el handler y `S16` son de `B3`, que se mergea antes de que `B4` cree la columna | 1 | sí | **la escribe toda relectura por id que ve `cancelled`, como dice el capítulo**: `B3` (el handler y `S16`) llama a una interfaz interna, *«anotar la cancelación vista»*; **`B4` la implementa al crear la columna**, con su caso sobre filas sembradas, y **el barrido de `B11` la usa también**. Es BL aplicada; el reparto de §2.11 suma a `B3` como pieza que llama. El instante queda exacto. Las otras opciones eran que la escribiera sólo el barrido, tachando la regla de `B/09` §3 (hasta un día `puedeCobrarle` contesta `sí` sobre un preapproval ya cancelado y el plazo 16 arranca tarde) o que `B11` metiera la escritura en el handler y en `S16` al llegar (toca código de `B3`: contradice BL y el punto 2 de `DEC-ARCH-017`) |
| CI | si `B11` espera a `B4`, si el grafo de `B/descomposicion.md` §3 hace depender a `B11` sólo de `B5` y `B11` escribe y lee `provider_link.cancelado_visto_en`, la columna que crea `B4` (hueco que ya traía el reparto de Z y que CH dejó a la vista) | 1 | sí | **flecha nueva `B4 → B11`: `B11` espera a `B4`**, en los dos grafos de §3, en la tabla de paralelos y en las flechas que se escriben explícitas. Costo nulo en el camino crítico: `B11` no está en el del corte. Las otras opciones eran aplicar BL a `B11` con interfaces de escritura y de lectura (si `B11` corre antes que `B4`, la exención lee *«no vista»* y abre marcas falsas) o mover la columna a `B3` (reabre AP y AV) |

## Lote CJ (2026-10-02)

Respuesta del owner, 2026-10-02, a la única pregunta que dejó la adjudicación de la vuelta 3 de
verificación ciega (fuentes en `591034c665`, spec en `a10f010e78`; hallazgo `H3-VB07-7`). Es la
recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CJ | quién retira la ruta que borra cuentas de verdad (`user/admin/hardDelete.ts`), si la fila de `V6` de `V/descomposicion.md` §2 dice que con `V6` *«desaparecen el borrado físico de fichas y de cuentas»* y la tabla de puertas de la misma descomposición (§2.13, lote 3 C) le da la de cuentas a `V8a` (Z sólo renombró `V8` a `V8a`; el reparto es de antes) | 1 | sí | **la retira `V6`**, en el mismo cambio que las puertas de fichas y antes del corte: se corrige la tabla de puertas para que diga `V6`, y el mapa de cobertura de la spec consolidada también. `AC:V6:25` ya lo exige, y queda una sola pieza dueña de todas las puertas de borrado físico; la acción 24, que la reemplaza, sigue en `V8a`. Las otras opciones eran que la retirara `V8a` (cuatro lugares que cambiar, y entre el merge de `V6` y el de `V8a` la ruta sigue viva contra la `FK` `RESTRICT` de `V4`) o las dos, `V6` deshabilitándola y `V8a` borrando el archivo (reparte un solo acto en dos piezas, contra cómo la fuente reparte las puertas) |

## Lote CK (2026-10-03)

Respuesta del owner, 2026-10-03, a la única pregunta que dejó la adjudicación de la vuelta 5 de
verificación ciega (fuentes en `8a1d8902c2`, spec en `2e9ef99e2e`; hallazgo `H5-VA-A2-1`,
duplicado `H5-VB-03-1`). Es la recomendada (opción 1).

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CK | si el aviso de cambio de cobertura sale después del commit sin entrega durable, como `DEC-ARCH-009` y el contrato, o se encola en U2, como decía la fila de B4 | 1 | sí | **se ratifica `DEC-ARCH-009`: el aviso sale después del commit, sin entrega durable, y el reconciliador diario es la red**. El outbox de `U2` sigue siendo sólo de correos. `coberturaPerdidaEn` se guarda en la misma transacción que registra la pérdida de cobertura, antes del aviso; su lectura no espera la entrega. Se conserva la dependencia de `B4` respecto de `U2` por las obligaciones de sus predecesores, incluidos los correos de `B3` (BR), no por encolar el aviso de cobertura. La red conserva su población y sus exclusiones: no corre la máquina de trial ni promete recuperar el aviso de primer pago; se acepta hasta un día de atraso en los casos cubiertos. La otra opción era agregar transporte durable de eventos con identidad, reintentos, recuperación y confirmación, distinto del outbox de correos |

## Lote CL a CP (2026-10-07)

Respuestas del owner, 2026-10-07, al cerrar `U1` (`HOS-1421`, la salida de la unidad). CL a CO
aprueban desvíos que la implementación de `U1` (`HOS-1416` a `HOS-1420`) ya había tomado; CP
confirma la medición de producción de BT. No eran preguntas con opciones: se registra la que se
aplicó.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CL | si `U1` retira `featured_by_entitlement` junto con `is_featured` en las tres tablas de fichas, como dicen el lote 1 F, `AC:U1:8` y la sección de esquema de `U1.md` | la aplicada | sí | **se conserva `featured_by_entitlement` en las tres tablas y sólo sale `is_featured`** (migración `0128`, `HOS-1419`). La escribirán los planes premium y el complemento; hasta las unidades `B` no tiene escritor. Reemplaza lo que el lote 1 F, `AC:U1:8` y `U1.md` dicen de esa columna |
| CM | si `U1` borra las superficies web del cobro viejo (`PlanPurchaseButton`, `planes/*`, `suscripcion` y las páginas de complementos) | la aplicada | sí | **quedan para las unidades `B`**, que las reescriben contra el cobro nuevo. `U1` no las toca: la rama compila y lo que queda roto es el comportamiento, no el build |
| CN | qué job de `CI Pass` es la barrera de `TEST:U1:23` (una migración que no aplica desde cero no llega a `CI Pass`) | la aplicada | sí | **`test-integration`**, cuyo global-setup aplica la cadena completa de migraciones sobre una base vacía y que está en los `needs` de `ci-pass`. No `e2e-pr`: también corre `db:migrate` desde cero, pero es un workflow aparte, fuera de `CI Pass` |
| CO | si `TEST:U1:22` exige que el job `guards` corra literalmente `pnpm check:guards` | la aplicada | sí | **se acepta la convención del repo: un paso del job `guards` por guard**, y el mismo guard listado también en `check:guards`. El test de salida (`scripts/__tests__/u1-exit-ci-wiring.test.ts`) comprueba las dos cosas para `G8` |
| CP | qué pasa con las filas vivas que midió BT en producción antes del merge de `U1` | se borran en el corte | sí | **se borran en el corte, como ya hace la migración `0126`**: las 39 filas de `role_permission` y las 3 de `user_role_audit`. Medido el 2026-10-07 con `hops psql --target=prod`, sólo lectura y contando: `user_role` con el rol de dueño de comercio, 0; `role_permission` con ese rol, 27, y con sus siete permisos, 14 (unión, 39); `user_permission` con esos permisos, 0; `user_role_audit` con ese rol, 3; la tabla de contactos de alta no existe en producción (la borró la migración `0098`). Ninguna de esas tablas tiene `deleted_at`, así que todas sus filas son vivas |

## Lote CQ (2026-10-07)

Respuesta del owner, 2026-10-07, al hueco que encontró la revisión de `HOS-1423` (`U2.2`, PR
#3488): ninguna hoja del árbol convierte un rebote duro del proveedor en la fila `bounced` de la
bitácora que lee la supresión. `EmailHardBounceError` sólo se lanza en los tests;
`BrevoEmailTransport.send` envuelve todo error en un `Error` genérico; y el webhook de Brevo
(`apps/api/src/routes/webhooks/brevo.ts`) reenvía `hard_bounce` al seguimiento del newsletter y no
escribe la bitácora. Hoy un rebote real termina como reintentos agotados después de cinco intentos,
y las ramas de rebote duro de `AC:U2:4` y `AC:U2:7` sólo se prueban con errores inyectados. No era
una pregunta con opciones: el owner aprobó la hoja nueva `HOS-1627` con este alcance.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CQ | quién convierte un rebote duro real del proveedor en la fila `bounced` de la bitácora, de la que dependen la supresión (`AC:U2:7`), el escalado (`AC:U2:4`) y `B3` | la aprobada | sí | **`U2`, con una hoja nueva antes de la salida (`HOS-1627`, `AC:U2:12`)**: el transport traduce a `EmailHardBounceError` el rebote duro que detecta de forma sincrónica, y el webhook de Brevo traduce el evento de rebote duro en una fila `bounced` para ese destinatario, de forma idempotente. El test entra un rebote real por el webhook y comprueba que el próximo envío, de cualquier clase, queda suprimido; sacar el mapeo lo pone en rojo. Qué rechazo sincrónico es un rebote duro y si el evento de los correos transaccionales llega al mismo webhook con la misma forma no se dan por hechos: los confirma el PR de la hoja |

## Lote CR a DD (2026-10-07)

Respuestas del owner, 2026-10-07, al alcance del MVP medido sobre el grafo de hojas reparado (las dos
auditorías de dependencias y los análisis de alcance del coordinador). No eran preguntas con opciones
numeradas en este archivo: se registra lo que el owner decidió y cómo quedó aplicado en la spec y en
el árbol (`docs/42-arbol-linear/arbol.json`). Las piezas `V` siguen enteras al corte.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| CR | qué quiere decir la regla 1 del corte («no hay segundo tren») | la aclarada | — | **todo lo que tiene que andar sale en el deploy del MVP**; después pueden salir, cuando sea, deploys con más funciones. **Las fases posteriores no están atadas a fechas**, salvo plazos reales de seguridad: hoy son dos, el de `V9b` (BV, ver DD) y el de la sucesión de `B8b` (DC) |
| CS | dónde va Partner y qué pasa con `PP1` | Fase 4; opción (b) | sí | **`V7` y `V8b` siguen en la Fase 4.** La cláusula de `PP1` sale de `AC:V5:16` (que queda «el guest falla en el paso 1 salvo en la lectura pública») y pasa a `V7.1` como `AC:V7:20`. Así `V5.7` no espera a nada de Partner |
| CT | qué pasa con `B6` (ejecutar la devolución por el proveedor) | se difiere entera a la Fase 2 | sí | al corte se devuelve desde el panel de Mercado Pago y se asienta con la acción 14 (`RF4`). **Entra una AC en `B5.3`** (`AC:B5:41`): asentar por `RF4` la devolución de un pago con un `REQUESTED` abierto (el que crea `S36`) **cierra ese `REQUESTED`** en vez de crear otra fila; sin eso no tiene salida sin `B6`. También pasa a la Fase 2 `AC:B11:14` (reenvío con la clave de `RF2`) |
| CU | qué partes de los grants van al corte | sólo la herramienta del 3b | sí | **al corte un grant sólo se otorga desde la herramienta del paso 3b**. Revocar y la fuga de `USER`/`GLOBAL` (`AC:B9a:6`, `:7`), el grant a quien paga (`AC:B9a:13`, `:14`, `:17`), las confirmaciones de `B13a.3` (`AC:B13a:6`) y la orfandad por revocación (`AC:B5:26`) pasan a la Fase 2, en hojas nuevas `B9a.6`, `B9a.7` y `B5.10` |
| CV | qué pasa con el pagador manual | Fase 4 | sí | **`B5.4` y `B5.4b` (`MP1`–`MP6`) van a la Fase 4**, con Partner, que es su único sujeto. Al corte quedan la tabla `manual_payment`, sus enums y la columna de método. Van con ellos `AC:B3:4`, `AC:B5:35`, `AC:B7:5`, `AC:B7:12`, `AC:B7:18` y `AC:B13a:18` (hojas `B3.14`, `B7.11`, `B13a.12`). Cómo se partieron las AC de `B7` que tocan al pagador manual es Coord-6 |
| CW | qué pasa con la acción 19 (fijar el precio, `B2.2`) | Fase 2 | sí | va a la Fase 2 con su predicado `AC:B3:40` (hoja `B3.13`), porque necesita `S38` de `B8b` y BM la prohíbe hasta el momento 5 |
| CX | qué pasa con la batería mensual contra el proveedor real (`B1.6`) | Fase 4 | sí | se difiere **hasta que todo el programa esté desplegado**: va en la Fase 4, la última |
| CY | qué pasa con los contracargos | se difieren, salvo la detección | sí | **al corte, leer `charged_back` (por el aviso o por la comprobación del barrido) sólo abre la marca 17** por una interfaz interna (patrón BL), sin `P6`, sin `S6`/`S12` y sin correo; la marca sale en el listado accionable y una persona cancela con la acción 8. La AC nueva es `AC:B11:27` (en `B11.4`). Los enums `CHARGED_BACK` y `CONTRACARGO` quedan al corte (AD). Pasan a la Fase 2 `B5.2b` (`P6`/`P7`), `AC:B7:10`, `AC:B7:27`, `AC:B8a:7`, `AC:B11:25` y las mitades de contracargo de `AC:B7:11`, `AC:B11:12` y `AC:B13a:9`, que se separan como `AC:B7:33`, `AC:B11:28` y `AC:B13a:25`. **Cómo se comporta Mercado Pago en un contracargo (`RC-8`) sigue sin medir**: no se puede fabricar uno, así que no hay smoke real posible |
| CZ | qué pasa con los tests y guards que cubren código del MVP pero viven en piezas diferidas | entran al MVP | sí | **toda prueba de código del MVP va en el MVP.** `AC:B12:1` («retirar un plan no mueve a nadie», que prueba la acción 18 de `V2`, `S1` y las lecturas por versión anclada) pasa a `B4.5` como `AC:B4:12`. `G-R1-C` se queda con `B8b`: protege el cierre de una sucesión, que al corte no existe |
| DA | la limpieza del sistema viejo | el 100 % en el MVP | sí | **entran dos hojas nuevas en `B13a`**, la pieza de superficies de `B` al corte, que es donde la decisión CM dejó las superficies del cobro viejo: `B13a.9` (web: `AC:B13a:20`–`:22`) y `B13a.10` (admin y el guard «ningún cliente llama a un endpoint que la API no registra»: `AC:B13a:23`, `:24`). Borran o reescriben toda superficie vieja que siga en la rama (`mi-cuenta/addons`, `AddonsPurchasePanel`, `canjear`, `PlanChangeFlow`/`PlanPicker`, las páginas de checkout de partners, las compuertas viejas del admin, las llamadas de `PlanPurchaseButton` a `validatePromoCode` y `createCheckout`, entre otras). **`B12` no es limpieza**: retira planes del catálogo **nuevo**, y sigue en la Fase 3 |
| DB | qué promos y cortesías salen al corte | la rebanada básica de la spec | sí | **sale sólo lo que la spec ya diseña y funciona sin `B8b`**, sin inventar nada: `AC:B9b:1`–`:6`, `:9` y la parte 7-bis de `:12` (hojas `B9b.1`, `B9b.2` y `B9b.4`). El canje es el diseñado: **sobre una suscripción viva, mutando el monto**; no se agrega un canje en el checkout. **Limitación**: una promo de «primer cobro» canjeada después del alta no alcanza al primer cobro (`AC:B9b:4` ya lo cubre); al lanzamiento se usan promos de «N cobros». La cortesía básica del corte es la extensión de trial (acción 11 de `V4`) y su canje por código (`AC:B9b:6`); las cortesías temporales siguen en la Fase 2 con `B8b`. La parte 13-ter/13-quinquies de `AC:B9b:12` se separa como `AC:B9b:14` (Fase 2) |
| DC | qué pasa con el suscriptor suspendido que quiere volver | queda después del MVP, con fecha límite | sí | un `SUSPENDED` con tarjeta **no puede volver a suscribirse sin la sucesión de `B8b`** (su fila es viva y ocupa el `UNIQUE` del invariante 8). Se queda después del MVP, con un **plazo de seguridad: la sucesión de `B8b` tiene que estar en producción antes de la primera renovación fallida posible ≈ el corte + la duración del trial + un mes de cobro** (el owner: «unos dos meses»). Los correos de las filas 10 y 10-ter **prometen «volvé a suscribirte»**: el texto se mantiene y el plazo existe para que la promesa sea verdad cuando alguien la lea |
| DD | si `V9b` conserva su fecha límite | sí | sí | **`V9b` conserva la fecha de BV** (corte + plazo 1 − plazo 4): es un plazo real de seguridad, la excepción que CR admite |

## Lote DE (2026-10-08)

Respuesta del owner, 2026-10-08, al pendiente que dejó Coord-4 («qué es exportar una ficha y qué
pieza lo construye»). No era una pregunta con opciones: se registra lo que el owner decidió.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| DE | qué es exportar una ficha y qué pieza lo construye | se difiere, fuera del MVP | — | **exportar una ficha queda fuera del MVP y se difiere.** El owner no recuerda haber acordado esa funcionalidad, así que después se decide si sale de la spec o en qué fase entra (pendiente en `spec-consolidada/80-abiertos.md` §4-ter). Al corte, `V9a.1` registra crear y editar; el acto «exportar» de `AC:V9a:1` queda diferido y **el registro lo suma en forma aditiva** cuando la operación exista. Nada del corte construye exportar ni lo espera |

## Lote DF (2026-10-08)

Respuesta del owner, 2026-10-08, al valor pendiente del PLAZO:19, la ventana `N` del resumen de
conciliación (`DEC-OBS-001`, BU y BX). No era una pregunta con opciones: se registra lo que el owner
decidió.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| DF | cuánto dura la ventana `N` del resumen de conciliación (PLAZO:19) | 60 minutos | — | **el valor inicial del PLAZO:19 es 60 minutos.** Un desajuste de conciliación lo mira una persona: una ventana más corta vuelve ruido el resumen y una más larga deja un problema de cobro horas sin aviso. Es un plazo versionado; cambiarlo después publica una versión nueva |

## Lote DG (2026-10-08)

Respuesta del owner, 2026-10-08, al retiro transitorio de gates de plan por `U1` (commit
`acb12be063`). No era una pregunta con opciones: se registra el alcance aprobado para el MVP.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| DG | si el MVP deja sin gate las rutas de API marcadas `HOS-1352: transitional until V3` y los consumidores web de `/users/me/entitlements`, que ya no existe | restituir los gates en el MVP | — | **V5 restituye en lecturas y escrituras cada capacidad y cupo por clave del catálogo sobre el conjunto efectivo de V3; B13a agrega la lectura protegida de capacidades para web y migra sus pantallas.** Se conserva qué función y cuánto permite cada plan; no se agrega una habilitación por defecto. El guard de API exige cero marcadores transitorios y falla con uno reintroducido. Sin lectura válida, web falla cerrado |

## Lote DH a DJ (2026-10-08)

Respuesta del owner, 2026-10-08, a tres huecos que encontró la implementación de `V2.3`
(HOS-1436). No eran preguntas con opciones: se registra lo que el owner decidió.

| Letra | Pregunta | Elegida | Recomendada | En una línea |
|---|---|---|---|---|
| DH | cómo se identifica, por vertical, el plan no vendible (trial, pre-trial, piso) | columna `plan.role` | — | **cada plan no vendible se reconoce por una columna nueva e inmutable `plan.role` (`'trial'`, `'pre_trial'`, `'floor'`), con `UNIQUE(vertical, role)` y un trigger de inmutabilidad en extras.** La implementa `V2.3` (HOS-1436); `V4.5` (HOS-1447) y `V4.2` dependen de ella. Se descartaron tres punteros en `vertical` y una convención de slug: el slug es mutable (`V2.md:347`) y una convención falla abierta ante un renombre |
| DI | cómo se prueba la causa (c) de `G-R3` si `activate_trial` no existe como clave | `V2.3` agrega la clave `activate_trial`, clase BASE | — | **`V2.3` agrega al catálogo la clave `activate_trial`, de clase BASE,** para que la causa (c) de `G-R3` sea comprobable (`plan_version_entitlement.key` tiene FK a `catalog_key`). COMMERCIAL chocaría con la causa (a) |
| DJ | qué ancla una suscripción de complemento y cómo tiene ciclo propio un addon periódico | los COMPLEMENTO quedan exentos; `addon_product.cycle` | — | **las suscripciones `COMPLEMENTO` quedan exentas de `plan_version_id` y `billing_option_id` no nulos, igual que la `LÁPIDA`; `addon_product.cycle` (mismo dominio que `billing_option.cycle`, nulo si no es periódico) le da su propio ciclo a un addon periódico.** Se descartó anclar la versión del principal: un principal anual cobraría anual a un addon «mensual», y el complemento contaría como cliente en la acción 19 |

## Decisiones del coordinador (2026-10-07)

No son letras del owner: las tomó el coordinador del programa sobre hallazgos de las hojas en curso,
dentro de lo que el owner ya había decidido. Cada una dice cómo revertirla.

| Id | Qué | Por qué | Cómo se revierte |
|---|---|---|---|
| Coord-1 | **`V6.8` se parte.** `V6.8a`, aditiva: el enum de seis valores, las columnas nuevas (anulables al nacer, nunca con `DEFAULT`, que sería un escritor fuera de la lista de `G-R6-B`) y la tabla de pedidos de arreglo con su índice parcial (`AC:V6:16`). `V6.9` llena las columnas con la escritura `C` y les pone el `NOT NULL` (`AC:V6:31`). **`V6.9b`**, hoja nueva, borra las seis columnas viejas y cambia sus lectores (`AC:V6:32`, `TEST:V6:18`). Nombres de código en inglés: `publication_status` (`PublicationStatusEnum`: `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED`, `MODERATED`, `PURGED`), `inactive_since`, `deadlines_version`, `deletion_announced_at` y la tabla `fix_request` | el implementador de `V6.8` midió que `AC:V6:16` entera toca unos 450 archivos y que esos lectores dependen de las transiciones `PB` de `V6.1`–`V6.7`. Por eso el borrado no puede ir en `V6.9`, que va antes de `V6.1`: va en `V6.9b`, que espera a `V6.1`–`V6.7` y a `V5.2`. **`V5` lee `publication_status` desde `V5.1`** (sigue esperando a `V6.8a`): el caso `RESTRICTED` de `AC:V5:5` es un valor de `visibility`, que no existe en el estado nuevo; deja de existir con `V6.9b` y no pide decisión de producto | juntar `V6.8a`, la parte de `AC:V6:31` y `V6.9b` en una sola hoja posterior a `V6.7` |
| Coord-2 | **Las mentiras del falso entran con su superficie.** `B1.4` arranca `G15`, las dos listas como datos, el mecanismo de apagar una mentira nombrándola (`AC:B1:9`) y las mentiras cuya superficie ya existe: `M3`, `M5`, `M6`, `M8`, `M10`, `M11`, `M13`, `RP2`–`RP6` y `RP9`. **Regla nueva** (en `B1.md` y en el RUNBOOK): la hoja que agrega una superficie a la interfaz agrega al falso las mentiras de esa superficie, cada una con su fila y su prueba. Reparto: `M1` (al crear), `M9` y `RP1` → `AC:B3:42` (`B3.1`); `RP12` → `AC:B5:42` (`B5.2`); `RP7`, `RP8` y `RP11` → `AC:B7:34` (`B7.1`); `M4` → cláusula de `AC:B11:1` (`B11.1`); `M7` → cláusula de `AC:B11:10` (`B11.3`); `M1` sobre una suscripción viva y `M2` (lo que pedía `TEST:B1:3`) → `AC:B8b:27` (`B8b.3b`, la primera hoja que manda dos campos); `M12` y `RP10` → `AC:B8b:28` (`B8b.1`). **Pruebas de defensa**, iguales a las que nombra el PR de `B1.4`: `M8` → `TEST:B8a:10`, `M12` → `TEST:B8b:3`, `M7` → `TEST:B11:9` | la interfaz de `B1.2` sigue a propósito sólo lo que el dominio necesita hoy, y la mitad de las mentiras cae sobre superficies que todavía no tiene; no se amplía la interfaz por adelantado. El pedido nombraba `B3`, `B5` y `B7`: `M4` va a `B11` (la superficie del buscador es suya) y `M2`, `M12` y `RP10` a `B8b` (en el MVP no hay mutación de dos campos ni pausa nuestra). `M12` no estaba en el comentario de la hoja de `B1.4`: queda reasignada a `B8b` por la pausa y la reanudación, igual que en el PR de `B1.4`. `M7` iba a `B7` en la primera versión de esta entrada; pasó a `B11` porque su defensa es la lectura del barrido y su prueba, `TEST:B11:9` | volver a poner todas las mentiras en `B1.4` ampliando antes la interfaz |
| Coord-3 | **`B1.5` pasa al criterio de `B3`** como `B3.12` (la misma issue, `AC:B3:43`, antes `AC:B1:16`), después de `B3.5b`: es la primera hoja que consume el adaptador desde la API y la web. `B1.7` se redefine con lo que queda en `B1`; `B3.6`, `V4.7`, `B5.9` y `B7.7b` pasan a esperar a `B3.12` | `TEST:B1:17` necesita un consumidor real de `@repo/payments` en las apps, que recién aparece en `B3`; igual que el grace pasó a `B7` (BL). **Abierto para `B3.12`**: `AC:B1:1` dice que el falso no nombra conceptos de Mercado Pago y `AC:B3:43` pide que el servidor responda como Mercado Pago; la lectura propuesta (el falso de dominio sin conceptos del proveedor y una cáscara HTTP aparte, con su forma) no pide decisión de producto | devolver `AC:B3:43` a `B1` como hoja posterior a `B3.5b` |
| Coord-4 | **`V9a.1`**: la correlación viaja en `ServiceContext` y el evento se escribe en los hooks, dentro de la misma transacción del acto; «editar» incluye las subentidades de la ficha; de cada campo que no está en la lista cerrada de no-contenido se guarda sólo el nombre; el actor es sólo el dueño. **Exportar queda fuera de `V9a.1`** hasta que el owner conteste qué es (ver abajo) | `AC:V9a:1` pide registrar «exportar una ficha», que no existe en el epic: el PDF actual (`listing-brochure`) es premium, sólo cubre gastronomía y experiencias y exige la ficha publicada; la operación está especificada (`V5.md` §3, `04-catalogos.md`) pero ninguna pieza del corte la construye | registrar exportar en `V9a.1` cuando exista la operación |
| Coord-5 | **Forma del árbol al aplicar CR a DD**: las AC que se difieren dentro de una pieza del corte viven en hojas propias de su fase (`B3.13`, `B3.14`, `B5.10`, `B7.10`, `B7.11`, `B8a.6`, `B9a.6`, `B9a.7`, `B11.11`, `B13a.11`, `B13a.12`), así cada issue es de una sola fase; `B7.4` se conserva con una sola AC (`AC:B7:13`) en vez de fundirla con `B7.4b`, para no borrar una issue; la detección del contracargo va en `B11.4` (y no en `B5.1`, que ya tiene cuatro AC) y la llaman el receptor y el barrido; `AC:B4:12` va en la salida de `B4`, que ya espera a `B3` y a `B5`, más la acción 18 de `V2.3`; las hojas de limpieza van en `B13a` sin dependencias de entrada; la rebanada de promos reusa `B9b.1`, `B9b.2` y `B9b.4`, y `B9b.3`/`B9b.5` quedan en la Fase 2; y `chequeo.py` reemplaza «una sola hoja de entrada» y «la entrada espera la salida de la pieza anterior» por la regla real (cada hoja depende de la que crea lo que usa, con su motivo; ninguna depende de una fase posterior; cada salida espera a todos los sumideros de su pieza) | aplicar las decisiones sin inventar contenido y con issues de una sola fase | cada punto es independiente; el árbol se regenera con el script de la reparación |
| Coord-6 | **`AC:B7:5` y `AC:B7:18` van enteras a la Fase 4** con el pagador manual (CV); `AC:B7:13` y `AC:B7:16` se quedan al corte y anotan que su rama de `MP4` / `MP1` llega en la Fase 4 | el pedido del owner decía «partes» de `AC:B7:5` y `:18`; leídas, **`AC:B7:5` es entera `MP5`** (la cuota del período y `S4`) y **`AC:B7:18` es entera `MP1`** (el crédito de la sucesora de un pagador manual): no queda ninguna mitad de tarjeta que dejar al corte. Es una lectura del coordinador, no del owner | partir cada una en dos AC y dejar al corte la mitad de tarjeta, si el owner lee una |
| Coord-7 | **Las pantallas del admin dejan de leer las compuertas viejas y leen las capacidades nuevas que resuelve `V3`** (`AC:B13a:23`, hoja `B13a.10`, que pasa a depender de `V3.4`, la salida de `V3`). Si no existe una lectura del conjunto efectivo en el tramo `admin` de la API, la agrega esa hoja, sin lógica propia | sacar las compuertas sin reemplazarlas era una decisión de UX no respaldada: el admin dejaría de mostrar u ocultar según el plan. Leer lo que resuelve `V3` mantiene el comportamiento sobre el sistema nuevo; `V3.4` es la hoja que deja completa la resolución (verticales simultáneas y salida) | volver a «borrar las compuertas» y sacar la arista `B13a.10 ← V3.4`; o, si el owner prefiere otra UX, reescribir `AC:B13a:23` |
| Coord-8 | **Ocho AC cambiaron de hoja en la reparación del grafo** (sin cambio de texto): `AC:V6:22` de `V6.10` a `V6.9` (la migración del paso 3 escribe los plazos v1 y `TEST:V6:20` cubre a la vez la 17 y la 22) y, para no vaciar `V6.10`, `AC:V6:29` de `V6.9` a `V6.10` (la medición de partners queda antes de su migración, `V6.11`); `AC:B3:38` de `B3.10` a `B3.9` (`manual_payment` e `idempotency_key` los usan `B3.1` y `B3.1b`, así que van en la hoja de esquema, que pasa a ser la primera de `B3`) y `AC:B3:31` de `B3.9` a `B3.10` (es comportamiento, `S2`/`S3` en dos verticales, no esquema); `AC:B4:11` de `B4.4` a `B4.3` (`AC:B4:5` escribe `cancelado_visto_en`, cuya columna e interfaz nacen en la 11); `AC:B5:24` de `B5.5b` a `B5.6b` (usa `A5`/`S21`, de `B5.6`); `AC:B5:39` de `B5.8` a `B5.9` (`B5.8`, el esquema, pasa a ser la primera hoja de `B5`, y el e2e de `S36` va en la salida); `AC:B5:11` de `B5.3` a `B5.9` (la acción 14 corre `S7`/`S19` de `B7.4` y la extensión `max` de `B8a.4`, que necesitan antes a `B5.3`: era un ciclo); y `AC:B8a:2` de `B8a.1` a `B8a.3` (el correo antes de cancelar cubre `S23` y `S24`, que nacen en `B8a.3`) | cada hoja tiene que depender de la que crea lo que usa, sin ciclos; estos movimientos cortan las inversiones y los ciclos que medieron las dos auditorías de dependencias | devolver cada AC a su hoja de origen reabre la inversión o el ciclo que cortó; se revierte rehaciendo el grafo |
| Coord-9 | **El falso sale de la entrada principal de `@repo/payments`** a un subpath de pruebas (`@repo/payments/fake`) o a un package de pruebas, en `B3.1` (cláusula de `AC:B3:42`), antes de que `apps/api` importe el package | `AC:B1:17` («ningún build de producción importa el package de pruebas») es de `B1.2`, ya hecha, y hoy se cumple sólo porque ninguna app importa `@repo/payments`; `B3.1` es la primera hoja que lo hace (`S1` crea el preapproval por el adaptador), y ya depende de `B1.4`, así que no hace falta otra arista | dejar el falso en la entrada principal y agregar un guard que prohíba importarlo desde código de producción |
| Coord-10 | **`TEST:V2:6` pasa de `V2.2` a `V2.4`** (cubre `AC:V2:4` y `AC:V2:8`); y `AC:V2:4` gana la regla de `F-8cA3-010`: **`direcciónDeCambio` compara sólo la cuota del plan, no la del trial** | el test necesita el catálogo que carga la migración (`AC:V2:8`, `V2.4`); en `V2.2` `AC:V2:4` la prueba `TEST:V2:5`. La regla venía de la FASE 8-bis-2 y nunca se había volcado a la spec consolidada | devolver el test a `V2.2` con un catálogo sembrado; la regla no se revierte sin reabrir `F-8cA3-010` |
| Coord-11 | **Hoja nueva del MVP `V9a.1c`.** Reparto de lo que `V9b.md:367` nombra como contenido de la ficha: **`V9a.1`** registra lo que viaja en el `update` de la fila principal —textos, horarios (`opening_hours`, columna de la fila) y amenities/features (van en el payload del update y se sincronizan en su transacción)—; **`V9a.1c`** registra las subentidades con operaciones propias, con `recordListingOwnerAct` dentro de la transacción y sólo el nombre del campo: FAQ y fotos o media en las tres verticales (`AC:V9a:6`), y carta, especiales, eventos, certificados y etiquetas (`AC:V9a:7`). Depende de `V9a.1`. **Pendiente**: la ocupación, que no es contenido de esa fila sino de `V9b.md:375` (lo del dueño que se conserva) | la spec nombra todo eso como contenido de la ficha, y una edición que no se registra no reinicia el reloj de inactividad | sacar `AC:V9a:7` a una hoja posterior, o dejar `V9a.1c` sólo con FAQ y media |
| Coord-21 | **`B3.9` crea `subscription`** (`arbol.json` `B3.1`, `por_que`), sin lo que depende de `provider_link` (HOS-1529) | la tabla es de `B3.1`; lo que cuelga de `provider_link` todavía no tiene dónde apoyarse | mover la creación de `subscription` a la hoja que crea `provider_link` |
| Coord-22 | **Los overrides del trial son filas de `plan_version_limit` de la versión del plan trial** (`V2.md:78`; `trial.dbschema.ts:61-73`, de `V4.1` y Coord-15); no hay tabla de overrides (HOS-1440) | una tabla aparte duplicaría lo que `plan_version_limit` ya expresa por versión y abriría un segundo lugar donde leer el tope | agregar una tabla de overrides y migrar esas filas |
| Coord-23 | **Elecciones de DDL de `B3.9` (HOS-1529)**: el cambio programado guarda la selección a conservar como `jsonb` `{clave de límite: [ids]}`; `subscription.payment_method` es `CARD` o `MANUAL`; `promo_code` lleva `all_verticals` (boolean) más un arreglo `verticals`; el comprobante del pago manual es anulable; columnas en inglés con el nombre de la spec en el JSDoc; `plan_migration.reason` es `RETIREMENT` o `PRICE_INCREASE`, con FK a `billing_deadline_version` y `notice_days >= 60`; `promo_code` gana `closed_at` y `closed_by`. **Coord-23-V2 (HOS-1436)**: el puerto de clientes alcanzados devuelve 0 hasta que `B3` ancle las suscripciones a `plan_version`; la causa (g) compara contra la versión de plan trial vigente anterior; `MAINTENANCE_MODE_WRITE`; la causa (h) usa los ciclos del pedido con mínimos de 28/89/181/365 días | son decisiones de forma que la spec no fijaba y que cada hoja necesitaba para escribir su migración sin esperar al owner; ninguna cambia qué permite o cobra un plan | cambiar la columna o la tabla en una migración aditiva antes del corte (el modelo nace completo, AD) |
| Coord-24 | **`V6.11` depende de `V6.9`** (HOS-1481): `PLAZO:9` vive en la tabla de plazos de verticales que crea `V6.9`; el nodo de `arbol.json` suma la arista | sin esa tabla la migración de partners de `V6.11` no tiene dónde leer el plazo | quitar la arista `V6.11` → `V6.9` y mover `PLAZO:9` a una tabla que exista antes |

**Pendientes para el owner que dejaron estos hallazgos** (no se decidieron):

1. **El orden de `MIN` y `BEST_DECLARED`**: cuando aparezca la primera clave que declare una de
   esas estrategias, el owner confirma el orden (anotado en `spec-consolidada/80-abiertos.md` §4-bis).
2. **Qué es exportar una ficha y qué pieza lo construye.** La spec lo autoriza en `V5` (paso 4 y la
   versión de piso: «verla, exportarla, reactivarla y borrarla») y lo nombra `V9a`, pero nadie lo
   construye. La pieza natural para construirlo es **`V8a`** (las superficies de fichas del corte), con
   la autorización que `V5` ya escribe; `V9a.1` agrega el evento cuando exista. **Contestado en DE
   (2026-10-08)**: se difiere fuera del MVP; queda abierto si sale de la spec o en qué fase entra.

## Resultado del corte

- **Al corte, enteras (17)**: `U1`–`U3`, `V1`–`V6`, `B1`–`B7`, `B11`.
- **Partidas (5)**: `V8`, `V9`, `B8`, `B9`, `B13` — la mitad *a* al corte, la *b* después.
- **Después, enteras (3)**: `V7` (salvo su migración estructural, por AB), `B10` (salvo su modelo
  y la fuente `ADDON`, por AA), `B12`.
- **Guards al corte**: 34 de 35; queda afuera `G-R1-C` (cierre de la sucesión, `B8b`).
- **Las fases posteriores (AW)**: cuatro, en orden: Fase 1 `V9b`; Fase 2 `B8b` y `B9b`; Fase 3 `B10`,
  `B13b` y `B12`; Fase 4 `V7` y `V8b`. Cada una, una rama épica con su gate (AE, AT).
- **Desde el 2026-10-07 (CR a DD)**: también van después, **en la Fase 2**, `B6` entera, `B2.2`, las
  partes de `B9a` de revocar y de grant a quien paga, `B13a.3` y los contracargos (salvo detectarlos);
  y **en la Fase 4**, el pagador manual, `PP1` (con `V7`) y `B1.6`. **Al corte**, en cambio, entran la
  rebanada básica de `B9b`, `AC:B12:1` (como `AC:B4:12`) y dos hojas de limpieza del sistema viejo.
  Dos plazos de seguridad: `V9b` (BV) y la sucesión de `B8b` (DC).

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
