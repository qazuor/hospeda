# Política de actualización del ecosistema

Fecha: 2026-09-15.

## Comandos observados

Gentle-AI `2.9.0` expone superficies distintas:

- `update`: comprobar actualizaciones disponibles;
- `upgrade`: aplicar actualizaciones a herramientas administradas;
- `sync`: sincronizar configuraciones/skills con la versión actual;
- `install`/`uninstall`: cambiar la instalación;
- `restore`: restaurar un backup;
- `doctor`: diagnósticos;
- `telemetry status|preview`: inspección sin envío, si la versión lo respeta.

Engram expone `version` y comprueba releases por Internet; no se debe confundir
esa comprobación con una actualización de la DB.

## Estado operativo actual

Hasta que Gentle-AI publique sus plugins V2, el canal operativo queda fijado en:

- OpenCode `1.18.31` (última release V1 verificada).
- Gentle-AI `2.9.0`.
- Engram `1.20.0`.

El bootstrap read-only imprime estas versiones esperadas y marca cualquier
desvío como `pin.*=mismatch`. No se debe ejecutar `gentle-ai upgrade`, `sync` o
`install` para corregirlo automáticamente: primero hay que revisar compatibilidad
y crear un backup nuevo.

## Política propuesta

1. Registrar versiones actuales, checksums y estado de Git/config antes de cada
   actualización.
2. Leer release notes y compatibilidad OpenCode V2/Gentle/Engram/plugins.
3. Crear backup de `~/.gentle-ai`, `~/.config/opencode`, plugins, TUI y Engram.
4. Ejecutar primero diagnóstico/read-only y, si existe, un check de updates.
5. Aplicar una sola actualización por vez; no encadenar `upgrade`, `sync` e
   instalación de plugins sin validar entre pasos.
6. Revalidar agentes, MCP, permisos, TUI, launcher background y versiones.
7. Probar OpenCode en sesión aislada antes de usar Hospeda.
8. Mantener rollback y no borrar backups hasta superar un período de uso real.

## Reglas

- Nunca actualizar automáticamente desde un hook, TUI o sesión de agente.
- No actualizar Engram sobre la DB histórica sin backup/restauración probada.
- No ejecutar `sync` si puede regenerar archivos project-locales sin revisar el
  diff.
- Fijar versiones en el manifiesto de tooling y registrar la fecha de cada
  promoción.
- Si una actualización modifica permisos, plugins o schema, detenerse para
  revisión humana.

No se ejecutó `upgrade`, `sync`, `install` ni `restore` durante este relevamiento.
