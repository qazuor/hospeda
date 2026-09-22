# Índice de la migración OpenCode + Gentle-AI

Este directorio contiene el relevamiento, las decisiones y los gates de la
migración. No implica que las etapas pendientes estén aprobadas ni ejecutadas.

- [human-decisions.md](./human-decisions.md): decisiones que requieren
  aprobación antes de implementar.

## Estado y ejecución

- [current-state.md](./current-state.md): estado efectivo posterior a la
  instalación limpia.
- [opencode-gentle-ai-plan.md](./opencode-gentle-ai-plan.md): arquitectura y
  etapas del plan.
- [opencode-gentle-ai-execution-log.md](./opencode-gentle-ai-execution-log.md):
  registro cronológico de comprobaciones y decisiones.
- [next-validation-gates.md](./next-validation-gates.md): orden de validación
  antes de integrar Hospeda.
- [update-maintenance-policy.md](./update-maintenance-policy.md): política de
  actualización y rollback.
- [bootstrap-reproducibility.md](./bootstrap-reproducibility.md): requisitos
  para validar todo `client-tools` y reinstalar el entorno automáticamente.

## Memoria y conocimiento

- [engram-audit-readonly.md](./engram-audit-readonly.md): auditoría sobre copia.
- [memory-migration-policy.md](./memory-migration-policy.md): admisión y
  clasificación individual.
- [memory-review-template.md](./memory-review-template.md): ficha por entrada.
- [memory-knowledge-gate.md](./memory-knowledge-gate.md): estado posterior a la
  limpieza y reglas del gate de admisión.
- [knowledge-migration-map.md](./knowledge-migration-map.md): `AGENTS.md`,
  `CLAUDE.md`, skills y documentación.
- [skill-migration-backlog.md](./skill-migration-backlog.md): skills candidatas.
- [agent-migration-decision.md](./agent-migration-decision.md): decisión sobre
  agentes.

## Linear, specs y workflow

- [linear-adapter-design.md](./linear-adapter-design.md): API/CLI, MCP y gates.
- [linear-gate-readonly.md](./linear-gate-readonly.md): inventario local y
  alcance del gate read-only.
- [sdd-comparison.md](./sdd-comparison.md): `.specs`, taskmaster y Gentle SDD.
- [command-migration-backlog.md](./command-migration-backlog.md): commands.
- [close-issue-gap.md](./close-issue-gap.md): ausencia de implementación
  ejecutable y diseño seguro pendiente.
- [hops-command-boundary.md](./hops-command-boundary.md): frontera `hops` /
  OpenCode.
- [command-layer-contract.md](./command-layer-contract.md): contrato de salida,
  responsabilidades y prefijo `hops-`.
- [hops-expansion-backlog.md](./hops-expansion-backlog.md): candidatos para
  ampliar `hops`.
- [worktree-decoupling-design.md](./worktree-decoupling-design.md): lifecycle,
  DB, puertos y desacople de Claude.
- [worktree-gate-readonly.md](./worktree-gate-readonly.md): validación del
  flujo actual sin crear worktrees ni levantar servicios.
- [gate8-first-integration.md](./gate8-first-integration.md): primera selección
  reversible de agente en `hops start-issue`.

## Seguridad, arquitectura y complementos

- [security-guards-assessment.md](./security-guards-assessment.md): permisos y
  guards.
- [opencode-permission-gate.md](./opencode-permission-gate.md): auditoría
  read-only de la política efectiva de permisos.
- [precommit-guard-proposal.md](./precommit-guard-proposal.md): checks baratos
  para pre-commit.
- [opencode-global-config-assessment.md](./opencode-global-config-assessment.md):
  config global, agentes, MCP y TUI.
- [opencode-gate2-validation.md](./opencode-gate2-validation.md): validación
  read-only de OpenCode V2, rutas, TUI y fuentes heredadas descubiertas.
- [model-routing-assessment.md](./model-routing-assessment.md): OpenAI,
  GLM/DeepSeek y OpenKilo.
- [opencode-model-gate.md](./opencode-model-gate.md): estado del gate de
  proveedores y modelos después de la instalación limpia.
- [opencode-runtime-log-blocker.md](./opencode-runtime-log-blocker.md): causa
  del bloqueo de comandos runtime en este filesystem read-only.
- [opencode-runtime-validation-runbook.md](./opencode-runtime-validation-runbook.md):
  procedimiento reproducible para repetir los checks cuando haya almacenamiento
  escribible.
- [overlap-map.md](./overlap-map.md): una herramienta principal por problema.
- [plugin-gate-focused.md](./plugin-gate-focused.md): evaluación provisional de
  OpenKilo, OpenChamber, PTY y notificaciones de voz.
- [codegraph-assessment.md](./codegraph-assessment.md): CodeGraph CLI/MCP.

## Regla de trabajo

Los documentos se actualizan en el worktree dedicado de la migración. No se
modifica el checkout principal, el código de Hospeda, Linear, Engram histórico,
Git ni la configuración global salvo que una etapa posterior lo autorice.

## Artifacts visuales

- [artifact-capability-assessment.md](./artifact-capability-assessment.md):
  capacidad actual, opciones y renderer recomendado.
- [artifact-inventory.md](./artifact-inventory.md): inventario agregado y
  política de revisión de los HTML generados por Claude.
- [artifact-hosting-proposal.md](./artifact-hosting-proposal.md): propuesta
  para URLs privadas, sharing, versionado, restauración y migración desde los
  Artifacts online de Claude.
- [artifact-schema-proposal.md](./artifact-schema-proposal.md): contrato
  `artifact/v1`, eventos persistentes, versionado y API local inicial.
- [artifact-schema-proposal.md](./artifact-schema-proposal.md): contrato
  `artifact/v1`, eventos persistentes, versionado y API local inicial.
- [artifact-schema-proposal.md](./artifact-schema-proposal.md): contrato
  `artifact/v1`, bloques visuales y pipeline desde lenguaje natural.
