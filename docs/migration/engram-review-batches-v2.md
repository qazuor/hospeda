# Lotes Engram después de la limpieza

Esta revisión usa sólo conteos y metadata agregada. No incluye cuerpos de observaciones ni prompts.

## Prioridad actual

| Lote | Señal | Volumen | Decisión inicial |
|---|---|---:|---|
| A | `tmp` y capturas pasivas | 5.259 | cuarentena; no activar como contexto automático |
| B | proyecto vacío | 1.103 | asignar sólo con evidencia, nunca por inferencia débil |
| C | `hospeda`/`hospeda2`/`hospeda3` | 3.088 | revisión humana por fecha y checkout |
| D | worktrees HOS y specs | decenas de proyectos pequeños | revisar contra Linear y `.specs` antes de conservar |
| E | proyectos externos | pocos cientos | conservar separados; no mezclar con Hospeda |
| F | duplicados por hash/título | ver lote histórico | comparar proyecto, fecha y contenido antes de decidir |

## Orden recomendado

1. Confirmar que `tmp` es efímero usando una muestra de metadata, sin cargarlo en el contexto.
2. Revisar `hospeda` y `hospeda2` por lotes temporales, priorizando decisiones durables y gotchas verificados.
3. Separar memorias de worktree/issue ya cerrados como histórico.
4. Revisar duplicados sólo después de resolver el proyecto correcto.
5. Promover reglas estables a skills/AGENTS.md y dejar Engram para decisiones contextualizadas.

## Regla

Los conteos sólo priorizan. Cada mutación futura necesita ficha, evidencia y aprobación humana por lote. No usar `consolidate --all`, `delete` masivo, `sync` ni reparación sobre la DB original.
