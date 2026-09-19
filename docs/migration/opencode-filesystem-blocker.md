# Bloqueo de filesystem de OpenCode

## Diagnóstico

La configuración y los archivos de OpenCode tienen owner y permisos normales (`uid=1000`, directorios 775, auth 600), pero el filesystem raíz está montado `ro` (`ext4 ro,nosuid,nodev`). Por eso una operación que necesita abrir/escribir `~/.local/share/opencode/log/opencode.log` falla con `FileSystem.open`, aunque el archivo sea legible y sus permisos parezcan correctos.

Esto afecta `opencode providers list`, autenticación, logs, DB de sesiones, snapshots y cualquier plugin que necesite persistencia. No es un problema de provider ni una credencial inválida.

## Procedimiento reversible pendiente

1. Confirmar con el administrador/host por qué el root está read-only y si existe una sesión de recuperación.
2. Resolver el montaje a nivel de sistema; no basta con `chmod`.
3. Verificar escritura de un archivo temporal dentro de `~/.local/share/opencode`.
4. Ejecutar `opencode providers list`, `opencode mcp list` y una sesión mínima.
5. Confirmar que no se dañaron DB/logs; conservar backup previo.

No se ejecutó `mount -o remount,rw`, no se cambiaron permisos y no se borraron logs. Hacerlo sin entender la causa puede agravar un problema de disco o filesystem.

## Mitigación mientras siga read-only

- Mantener el runtime sin operaciones que requieran persistencia nueva.
- No instalar plugins/providers ni regenerar configuración.
- Usar consultas que ya funcionen y registrar el bloqueo.
- Reintentar validaciones después de que el host vuelva a `rw`.
