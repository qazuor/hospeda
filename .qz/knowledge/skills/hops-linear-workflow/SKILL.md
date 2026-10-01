---
name: hops-linear-workflow
description: Workflow de Linear, specs, smoke gates y cierre de issues de Hospeda.
---

# Workflow Linear de Hospeda

- Usá `hops issue-preflight HOS-NNN` antes de iniciar una issue.
- Para registrar trabajo futuro, usá `hops linear-backlog --title ...
  --description ...`; el borrador es read-only y sólo `--yes` crea la issue.
- `kind-spec` sólo corresponde cuando ya existe `.specs/HOS-NNN-*/spec.md`.
  Si la issue todavía no tiene spec, usá `kind-needs-spec`.
- Si el agente implementó un cambio de Beta Feedback, el estado final esperado
  es `Ready for QA`; `Done` queda reservado para algo ya resuelto que sólo fue
  verificado y documentado.
- Antes de cerrar, ejecutá `hops close-issue --plan` y respetá sus bloqueos de
  smoke, closeout, tasks, env drift, template y PR/CI.
- Los cambios de billing requieren los smoke gates que declare Linear. Nunca
  marques Done sólo porque el PR fue mergeado.
- Antes de ofrecer una spec del índice, comprobá que su directorio existe y
  contrastá estado, closeout y archivo en Git. Un índice puede quedar desfasado
  después de archivar una spec.

El comando determinista es la fuente de verdad operativa; esta skill explica
las decisiones que el agente debe interpretar cuando el comando informa un
bloqueo.
