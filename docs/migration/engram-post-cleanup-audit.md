# Reauditoría read-only de Engram después de la limpieza

Fecha de inspección: 2026-09-19. No se leyeron cuerpos de observaciones, prompts, tokens ni credenciales. No se ejecutaron comandos de mutación.

## Estado técnico

- Ejecutable: Engram 1.20.0.
- DB: `~/.engram/engram.db`, aproximadamente 73 MiB.
- SQLite: `integrity_check = ok`, journal WAL.
- Checkpoint read-only del 2026-09-19: 9.786 observaciones y 11.823 sesiones.
  El esquema activo no expuso una tabla `prompts` consultable con ese nombre,
  por lo que ese contador queda no verificado.
- La base contiene tablas FTS y sincronización; no se modificó ninguna.
- `engram projects list` y `engram stats` intentaron una migración y fallaron con `migration: attempt to write a readonly database (8)`. Esto confirma el bloqueo de filesystem/runtime, no una corrupción.

## Señales agregadas

- 56 proyectos distintos aparecen en observaciones y 201 en sesiones.
- Las observaciones provienen principalmente de `engram-autosave-SessionEnd` (5.607) y filas sin `tool_name` (4.132); hay 39 de `engram-autosave-PreCompact`.
- Los grupos con más observaciones son `tmp`, `hospeda`, `hospeda2` y `hospeda3`. No se interpretan como memoria válida sin revisión del proyecto y fecha.

## Conclusión

La limpieza redujo memoria, pero la DB sigue mezclando proyectos y capturas automáticas. El checkpoint actual mantiene 56 proyectos en observaciones, 1.103 observaciones sin proyecto y 97 referencias foráneas huérfanas preexistentes. No conviene importar, consolidar, borrar o sincronizar todavía. La integridad SQLite es buena, pero la CLI no debe completar migraciones sobre la DB activa durante esta etapa.

## Próximo procedimiento seguro

1. Crear varias copias binarias de la DB y WAL/SHM con checksums.
2. Trabajar sobre una copia restaurada en un directorio escribible.
3. Ejecutar doctor/export en esa copia, nunca sobre la original.
4. Revisar por lotes: proyecto, origen automático, fecha, título/resumen y relación con Hospeda actual.
5. Marcar cada observación conservar/editar/descartar/pendiente y registrar decisión fuera de Engram.
6. Recién después preparar importación selectiva a una DB limpia o reutilización directa.

El lote de memoria sigue requiriendo aprobación humana; esta auditoría no cambia ninguna observación.
