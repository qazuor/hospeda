# Mapa de solapamientos

Fecha: 2026-09-15.

| Problema | Soluciones que se solapan | Enfoque principal recomendado | Decisión sobre las demás |
|---|---|---|---|
| snapshots, rollback y trazabilidad | OpenCode snapshots, Git, worktrees | Git + worktrees para código; snapshots sólo para sesiones/configuración | no usar snapshots como fuente de verdad técnica |
| lifecycle de worktrees | `hops`, `opencode-worktree`, `open-trees`, OpenChamber | `hops` + lifecycle versionado | no instalar otro gestor |
| specs y tareas | `.specs`/Linear, Gentle SDD, taskmaster legacy | `.specs` + Linear; Gentle SDD sólo para cambios complejos | taskmaster no se reinstala 1:1 |
| memoria y persistencia | Engram, MEMORY.md, sesiones OpenCode | Engram curado para decisiones; archivos para rollback/documentación | no importar MEMORY.md completo |
| compaction/contexto | OpenCode compaction, dynamic-context-pruning, CodeGraph | compaction nativa + CodeGraph selectivo | pruning sólo si una medición demuestra beneficio |
| agentes en background | Gentle agents, OpenCode agents, plugins background | agentes nativos de Gentle/OpenCode con pocos roles | no agregar delegación por defecto |
| permisos de shell | OpenCode permissions, Gentle profiles, safety-net | permisos OpenCode/Gentle + guards versionados | safety-net sólo como piloto, no segunda política |
| PTY/procesos largos | `hops servers`, `opencode-pty` | `hops` para servidores; PTY sólo si falta una capacidad concreta | evitar duplicar lifecycle |
| tokens/uso | Tokenscope, Mystatus, Costs | un único statusline/medición que demuestre utilidad | no instalar tres contadores |
| handoff | `/handoff` Claude, `opencode-handoff`, Engram | command explícito + resumen curado | no ejecutar al compactar automáticamente |
| browser | Playwright/browser nativo, `opencode-browser`, OpenChamber | browser aprobado por tarea y skill de QA | plugin sólo si cubre un gap real |
| Linear | API/CLI `hops`, MCP Linear, commands | API/CLI determinista; MCP como interfaz opcional | no duplicar mutaciones |
| review/RDD/GGA | Gentle review/RDD/GGA, plugins de review | Gentle + scripts/CI de Hospeda | plugins sólo para un gap medido |
| documentación | Context7, skills locales, docs del repo | docs versionadas + Context7 bajo demanda | no copiar documentación completa al prompt |
| voz/notificaciones | TUI/OpenCode, Gentle, `smart-voice-notify` | notificaciones nativas; TTS como piloto accesible | webhooks/red desactivados inicialmente |

## Reglas de decisión

1. Cada problema tiene una autoridad principal.
2. Una herramienta secundaria sólo entra si resuelve un gap medido.
3. La herramienta secundaria no puede crear una segunda fuente de verdad.
4. Toda incorporación debe declarar permisos, costo de contexto, mantenimiento y
   rollback.
5. Si dos herramientas hacen lo mismo, conservar la que ya está versionada,
   probada y alineada con Hospeda.
