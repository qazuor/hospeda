# Clasificación del backup Stage 0

Fecha: 2026-09-17. El backup está fuera del repositorio en
`~/.local/state/hospeda-opencode-migration/backups/2026-09-14-stage0` y ocupa
aproximadamente 11 GB. Este documento clasifica su destino; no autoriza
borrado ni restauración.

| Grupo | Ejemplos | Tratamiento en instalación futura |
|---|---|---|
| Memoria crítica | `.engram/engram.db`, `-wal`, `-shm` | Backup binario múltiple; restaurar sólo después de comprobar integridad y compatibilidad |
| Autenticación | `.claude/.credentials.json`, posibles credenciales de OpenCode | Conservar cifrado/aislado; nunca versionar ni copiar automáticamente |
| Conocimiento | `CLAUDE.md`, `RTK.md`, `settings.json` | Revisar elemento por elemento; migrar reglas útiles a AGENTS/skills |
| Historial | `.claude/history.jsonl`, logs y caches | Conservar como evidencia/rollback; no migrar al runtime nuevo por defecto |
| Integraciones | `mcpServers-backup.json`, caches de MCP y plugins | Revalidar proveedor por proveedor; no restaurar a ciegas |
| Tooling | scripts de statusline, backups de settings, manifests | Comparar con la versión versionada; migrar sólo lo aprobado |
| Instaladores | binarios de Engram/Gentle-AI y hashes | Usar como referencia/rollback; instalar versiones actuales aparte |
| OpenCode previo | `opencode.json`, `AGENTS.md`, `tui.json`, lockfiles | Auditar y regenerar; no copiar la configuración completa |

## Reglas

1. El backup completo se conserva intacto hasta cerrar la migración.
2. La futura limpieza puede retirar runtime y caches, pero no `.engram`, specs,
   worktrees, Linear ni scripts versionados.
3. Toda restauración de Engram debe tener una copia binaria adicional y una
   prueba aislada antes de tocar la instalación activa.
4. Los archivos que contengan credenciales sólo se identifican por nombre y
   mecanismo; su contenido no se imprime ni se incorpora al repositorio.
