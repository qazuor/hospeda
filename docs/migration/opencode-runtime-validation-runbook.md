# Runbook de validación runtime OpenCode

Este procedimiento queda preparado, pero no se ejecuta dentro del filesystem
read-only de esta sesión.

## Preflight

1. Comprobar que `~/.local/share/opencode/log` sea escribible por el usuario.
2. Confirmar `opencode --version` y las rutas con `opencode debug paths`.
3. Hacer backup de configuración global y no imprimir su contenido.
4. Abrir una sesión en un directorio temporal sin datos del proyecto.

## Checks no mutantes

- `opencode models` y `opencode auth list`: registrar sólo providers/modelos y
  nombres de entradas, nunca tokens.
- `opencode mcp list`: registrar servidores declarados y estado de conexión.
- `opencode plugin list`: registrar plugins cargados y versiones.
- `opencode debug agents`: registrar IDs, modos y permisos, no prompts.
- Ejecutar una consulta local de lectura que no toque Git, Linear, Engram ni
  archivos del proyecto.

## Criterio de aprobación

El runtime se considera validado sólo si los comandos terminan sin errores, la
TUI abre sin iniciar mutaciones y los MCP/plugins observados coinciden con la
configuración efectiva. Una clave presente en JSON sin aparecer activa se
registra como discrepancia, no como integración funcional.

## Prohibiciones

No ejecutar login, instalación, upgrade, sync, migraciones, `start-issue`,
Linear, Engram write/import, commits, push, worktree creation ni servidores en
esta validación.
