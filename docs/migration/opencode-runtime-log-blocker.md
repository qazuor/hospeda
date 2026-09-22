# Bloqueo del runtime de OpenCode: log global

Fecha: 2026-09-15

## Diagnóstico

Las rutas globales de OpenCode (`~/.local/share/opencode` y `log/`) pertenecen
al usuario y tienen permisos nominales de escritura, pero el filesystem de esta
sesión está montado como `ro` (read-only). Por eso cualquier subcomando del
runtime falla al abrir `~/.local/share/opencode/log/opencode.log`, incluso
`models --help` y `auth --help`.

Se probó de forma no mutante la ejecución con rutas temporales (`OPENCODE_LOG_DIR`
y `XDG_STATE_HOME`); esta versión siguió intentando usar la ruta global, por lo
que la redirección no quedó verificada como soportada por el binario actual. No
se cambiaron permisos ni se tocó la configuración global.

La documentación oficial actual indica que los logs de Linux se escriben en
`~/.local/share/opencode/log/` y sólo documenta `--log-level` para el logging;
no documenta una variable soportada para cambiar ese directorio:
<https://dev.opencode.ai/docs/troubleshooting/> (consultada el 2026-09-17).

## Consecuencia

No es un fallo de la instalación de OpenCode ni evidencia de corrupción de
Engram. Es una limitación del filesystem de esta sesión. Al ejecutar fuera del
filesystem read-only, `opencode v2.0.3`, `models --help`, `mcp list` y `plugin
list` deberían poder escribir sus logs; todavía debe hacerse esa comprobación
en un entorno writable.

## Próximo paso seguro

Las próximas consultas deben ejecutarse fuera del sandbox y revisar sólo
nombres/estado. No hace falta cambiar rutas ni permisos del sistema.
No se debe resolver creando symlinks, cambiando ownership ni borrando el log
sin backup y aprobación explícita.
