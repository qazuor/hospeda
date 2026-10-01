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
después sobre el lote AF a AO (abajo). Todas son la recomendada. Los conteos de la propuesta salen de `contar.py` y `aristas.py`, en esta misma
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

## Resultado del corte

- **Al corte, enteras (17)**: `U1`–`U3`, `V1`–`V6`, `B1`–`B7`, `B11`.
- **Partidas (5)**: `V8`, `V9`, `B8`, `B9`, `B13` — la mitad *a* al corte, la *b* después.
- **Después, enteras (3)**: `V7` (salvo su migración estructural, por AB), `B10` (salvo su modelo
  y la fuente `ADDON`, por AA), `B12`.
- **Guards al corte**: 34 de 35; queda afuera `G-R1-C` (cierre de la sucesión, `B8b`).

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
