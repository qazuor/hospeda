# Manifiesto de limpieza global OpenCode + Gentle-AI

Este manifiesto definió la instalación limpia normal solicitada: retirar el
estado global existente y reinstalar como si OpenCode/Gentle-AI nunca hubieran
estado instalados. La limpieza ya fue ejecutada el 2026-09-14; este archivo
queda como registro de alcance y rollback.

## Retirar

### OpenCode CLI y estado

- symlink activo `~/.local/bin/opencode`;
- paquete global `@opencode/cli` bajo el árbol nvm que lo contiene;
- instalación histórica `~/.opencode/`;
- configuración y plugins `~/.config/opencode/`;
- datos, auth, sesiones, snapshots, logs y DB `~/.local/share/opencode/`;
- cache `~/.cache/opencode/`;
- datos del cliente Desktop `~/.config/ai.opencode.desktop/` y
  `~/.local/share/ai.opencode.desktop/`, si se confirma que no se desea conservar
  ese cliente.

Todo lo anterior debe estar respaldado antes de retirarse. No se debe borrar
ninguna entrada de `~/.config/claude`, `~/.claude`, Engram ni CodeGraph como
parte de la limpieza OpenCode.

### Gentle-AI administrado

- `~/.local/bin/gentle-ai` y cualquier instalación anterior del binario;
- `~/.gentle-ai/` (estado, caches, telemetry y snapshots administrados), después
  de verificar que sus backups están dentro del backup Stage 0;
- archivos administrados de Gentle que estén fuera de OpenCode sólo si el
  inventario final los identifica como pertenecientes a Gentle y no a Claude.

No se debe borrar `~/.engram`, `~/.local/bin/engram` ni la DB Engram. Engram se
actualizará/reconectará como etapa independiente.

## Conservar fuera de la limpieza

- backup Stage 0 y sus checksums;
- `~/.claude`, Claude Code, sus commands, skills, agents y memorias;
- DB, WAL/SHM y exportaciones de Engram;
- CodeGraph, sus índices y configuración;
- repositorio Hospeda, `.specs`, scripts, Git y worktrees;
- credenciales que no pertenezcan a OpenCode; se documentan por existencia, no
  se imprimen ni se migran automáticamente.

## Reinstalación ejecutada

1. OpenCode CLI `2.0.3` fue instalado globalmente con npm.
2. Se verificó estado vacío: no existen auth, account, DB ni sesiones anteriores.
3. Gentle-AI `2.9.0` fue instalado con `full-gentleman`.
4. Se verificaron 62 checks; OpenCode background on y Pi off.
5. Auth/providers permanecen sin configurar y no se copió `auth.json` viejo.
6. Engram `1.20.0` quedó activo sin tocar la DB histórica.
7. La capa Hospeda todavía debe añadirse desde el worktree dedicado.

## Riesgos

- El borrado de `~/.local/share/opencode` elimina sesiones, snapshots y auth
  locales; sólo debe hacerse tras confirmar el backup.
- El cliente Desktop puede compartir estado o usar rutas distintas; se trata
  como componente separado.
- Gentle puede haber escrito assets en más de un directorio; el inventario debe
  preceder cualquier `rm` amplio.
