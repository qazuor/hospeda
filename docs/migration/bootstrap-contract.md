# Contrato del bootstrap reproducible

Este documento fija el contrato antes de implementar el instalador. No instala,
actualiza ni elimina nada por sí mismo.

## Modos

| Modo | Escribe | Requiere confirmación | Resultado |
|---|---:|---:|---|
| `qz install --plan` | no | no | plan, destinos, drift y riesgos |
| `qz install --check` | no | no | hashes, versiones, permisos y salud |
| `qz install --apply` | sí | sí | backup, aplicación idempotente y manifest |
| `qz install --restore <manifest>` | sí | sí | rollback sólo desde backup verificado |

`--apply` debe abortar antes de escribir si una ruta está fuera de la allowlist,
si el checksum de origen no coincide o si el backup no pudo completarse.

## Capas

### Global

OpenCode, Gentle-AI, Engram (conservando DB existente), TUI, providers sin
credenciales, skills/commands universales, permisos y el servidor local de
artifacts.

### Cliente

Derivaciones equivalentes para OpenCode, Claude Code y Codex. La fuente
semántica es única; cada cliente recibe archivos generados y un manifest de
hashes. Un archivo local modificado se reporta como conflicto y nunca se pisa
silenciosamente.

### Proyecto

El adapter detectado por `.qz/project.json` prepara checkout operativo,
`hospeda-staging`, wrappers, `.env.local` desde la fuente protegida, template
Postgres, puertos, servidores, skills locales y comandos `hops-*`. Los valores
secretos se resuelven localmente y no se guardan en el manifest.

## Manifest mínimo

```json
{
  "schemaVersion": 1,
  "bootstrapVersion": "semver",
  "createdAt": "iso-8601",
  "host": { "os": "ubuntu", "arch": "x64" },
  "clients": ["opencode", "claude", "codex"],
  "components": [{
    "id": "opencode",
    "version": "1.18.31",
    "source": "official-release",
    "sha256": "...",
    "paths": ["~/.local/bin/opencode", "~/.config/opencode"]
  }],
  "adapters": [{ "project": "hospeda", "version": "semver", "root": "..." }],
  "backups": [{ "path": "...", "sha256": "..." }]
}
```

El ejemplo es contractual: los valores reales de auth, envs y Engram no se
incluyen en texto ni se imprimen.

## Orden y rollback

1. Inventariar y comprobar espacio/permisos.
2. Crear backup y manifest previo.
3. Instalar componentes globales versionados.
4. Generar archivos de cliente y validar hashes.
5. Detectar adapters de proyectos y ejecutar su `--plan`.
6. Aplicar el adapter sólo con selección explícita.
7. Ejecutar checks read-only y guardar manifest final.
8. Ante cualquier fallo, detenerse; `--restore` vuelve al manifest anterior.

Una actualización posterior repite `--plan`, muestra drift y crea backup nuevo.
No elimina memoria Engram, worktrees, Git, specs ni credenciales externas sin
una operación separada y aprobada.
