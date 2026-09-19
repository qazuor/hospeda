# Validación de restore de Engram en copia aislada

Fecha: 2026-09-19. La DB original no se modificó.

## Procedimiento

- Se copió `~/.engram/engram.db` a `/tmp/engram-restore-validation-20260919/home/.engram/`.
- Se copiaron WAL/SHM si estaban presentes.
- La copia se abrió con SQLite en modo read-only antes y después del diagnóstico.
- Se ejecutó `engram doctor --json` con `HOME`, `XDG_CONFIG_HOME` y `XDG_DATA_HOME` apuntando sólo a la copia.

## Resultado

- Integridad SQLite antes y después: `ok`.
- Observaciones: 9.782 antes y después.
- Sesiones: 11.822 antes y después.
- Doctor: estado `blocked`, sin errores de corrupción.
- Checks correctos: mismatch de nombre de sesión y lock contention.
- Warning: 1.067 sesiones con project/directory mismatch.
- Bloqueo: 6.030 payloads de sync con campos requeridos ausentes.

El doctor mostró un aviso de actualización de GitHub por falta de red; no se descargó nada. La ejecución sobre la copia confirmó que el backup es legible y que los bloqueos son problemas de calidad/sincronización de datos, no pérdida física de la DB.

## Consecuencia

La estrategia segura sigue siendo conservar la DB original intacta y curar una copia. Antes de una migración futura hay que decidir qué hacer con los 1.067 mismatches y los 6.030 payloads incompletos. No conviene ejecutar `repair`, `sync`, `consolidate`, import o delete masivo automáticamente.
