# Worktrees y `hops` — Gate 6 read-only

Fecha: 2026-09-15

## Flujo confirmado

`hops start-issue` normaliza el identificador, consulta el issue, deriva tipo y
slug, y en `--dry-run` sólo imprime el plan. En ejecución normal delega la
creación a `~/.claude/skills/worktree/scripts/wt-create.sh`, recupera la ruta y
luego lanza `claude` dentro del worktree con `/startIssue HOS-NNN`.

La librería local combina `git worktree list --porcelain` con
`.claude/worktree-state.local.json`. El estado registra base PostgreSQL,
servidores, puertos y PID; Git es la autoridad para branch y detached HEAD.
`hops servers-up/down` delega a `wt-up.sh`/`wt-down.sh`, opera desde el
worktree elegido y conserva la base al bajar servidores. Los comandos DB
inyectan la cadena de conexión del worktree mediante variable de entorno.

## Dependencias

La gestión de Linear, derivación de branch, resolución de contexto, base,
servidores, puertos y limpieza es independiente del agente. La dependencia
específica de Claude está en tres puntos: ruta de los scripts de la skill
global, texto de ayuda y `spawn('claude', ...)` posterior a la creación.

No se creó ningún worktree, no se levantaron bases/servidores y no se ejecutó
ningún script mutante en este gate.

## Recomendación

Mantener `hops` como única autoridad de worktrees, bases, puertos y cleanup.
Adaptar el launcher para aceptar `--agent opencode` y un comando inicial
configurable, preservando `--no-agent`/`--dry-run`. No combinarlo con un plugin
de worktrees de OpenCode: dos autoridades producirían drift de estado, puertos
y limpieza. Más adelante conviene mover los scripts de `~/.claude/skills` a un
paquete versionado y neutral, pero como operación separada y reversible.
