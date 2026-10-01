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

Respuestas del owner, 2026-10-01, sobre la propuesta de `00-propuesta.md` §6 (lote Y a AE). Todas
son la recomendada. Los conteos de la propuesta salen de `contar.py` y `aristas.py`, en esta misma
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

## Resultado del corte

- **Al corte, enteras (17)**: `U1`–`U3`, `V1`–`V6`, `B1`–`B7`, `B11`.
- **Partidas (5)**: `V8`, `V9`, `B8`, `B9`, `B13` — la mitad *a* al corte, la *b* después.
- **Después, enteras (3)**: `V7` (salvo su migración estructural, por AB), `B10` (salvo su modelo
  y la fuente `ADDON`, por AA), `B12`.
- **Guards al corte**: 34 de 35; queda afuera `G-R1-C` (cierre de la sucesión, `B8b`).

## Pendiente de aplicar

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
