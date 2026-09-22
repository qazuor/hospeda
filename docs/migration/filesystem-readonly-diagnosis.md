# Diagnóstico del filesystem read-only

Fecha: 2026-09-18.

## Causa

La sesión de trabajo está ejecutándose dentro de `codex-linux-sandbox` con un
perfil administrado. El proceso PID 1 es el sandbox de Codex y la raíz aparece
montada como:

```text
/dev/nvme1n1p6 ext4 ro,nosuid,nodev,relatime
```

También `/proyects` aparece como `ro`. Los permisos Unix de
`~/.local/share/opencode/log` son correctos; el error no es de ownership ni de
modo del archivo.

## Confirmación

- Dentro del sandbox: `opencode auth --help` falla al abrir
  `~/.local/share/opencode/log/opencode.log` con `EROFS`.
- Fuera del sandbox, usando ejecución elevada: `opencode auth --help` funciona
  y muestra el subcomando `login`.
- Fuera del sandbox, `opencode auth list` funciona y devuelve `No authenticated
  integrations`, sin exponer credenciales.

## Solución

No hay que reparar ni remontar Ubuntu. Para operaciones globales de OpenCode,
Gentle-AI, Engram, Docker y login se debe ejecutar el comando fuera del sandbox
administrado (terminal normal del usuario o ejecución elevada autorizada). La
restricción no afecta el filesystem real de Ubuntu.

No se debe ejecutar `mount -o remount,rw`, `fsck` ni modificar `/etc/fstab`:
serían acciones innecesarias y potencialmente peligrosas en este entorno.

## Implicación operativa

- Lecturas y cambios versionados del worktree: continuar en el worktree de
  migración.
- Comandos que escriben `~/.config`, `~/.local`, `~/.engram`, credenciales o
  logs globales: ejecutar fuera del sandbox, con alcance explícito.
- Login de OpenAI: requiere `opencode auth login` en terminal real; no se debe
  automatizar ni registrar su salida.
