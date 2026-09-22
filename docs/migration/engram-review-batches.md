# Lotes de revisión Engram

Fecha: 2026-09-17. Esta cola organiza la revisión humana; no ejecuta borrados,
fusiones, reasignaciones ni imports.

## Orden recomendado

| Lote | Criterio | Tamaño observado | Riesgo | Acción inicial |
|---|---|---:|---|---|
| A | Filas vacías o sin título | 33 + 16 | Alto ruido o pérdida de contexto | revisar por ID y fecha; descartar sólo con evidencia |
| B | Hash duplicado | 1 grupo / 33 filas | Posible duplicación exacta | conservar una sola sólo después de comparar proyecto y timestamps |
| C | `tmp/passive` | 5.257 | Contexto efímero masivo | cuarentena; no activar en contexto automático |
| D | Sin proyecto asignado | 1.103 | Mala trazabilidad | asignar sólo con evidencia explícita |
| E | Títulos repetidos | 259 grupos / 1.445 filas | Repetición no necesariamente duplicada | revisar por contenido, no por título |
| F | `hospeda` durable | decisiones, arquitectura, bugfixes y discoveries | Alto valor potencial | revisar primero para admisión curada |
| G | `hospeda2`/worktrees | variantes de proyecto y estados históricos | Riesgo de mezclar contexto | conservar separados hasta decidir equivalencias |

## Regla de decisión

Cada entrada revisada debe tener una ficha de `memory-review-template.md` con
origen, proyecto, fecha, evidencia y destino. Una métrica sólo prioriza; nunca
autoriza una mutación. Los lotes A–E no se eliminan de forma masiva.

## Destinos posibles

- `AGENTS.md` o skill: regla estable y reutilizable.
- documentación: explicación durable que no debe cargarse siempre.
- Engram: decisión o gotcha verificado, con proyecto y topic claros.
- Linear/.specs: estado de trabajo o trazabilidad de una issue.
- histórico: información válida pero no activa.
- descartar: duplicado, ruido, contradicción o secreto confirmado.
