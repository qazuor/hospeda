---
name: hops-branch-workflow
description: Flujo de ramas, promociones y back-merges de Hospeda.
---

# Branch workflow

- El desarrollo normal nace desde `develop` y llega primero a `develop`.
- La promoción `develop → staging` es explícita; no la hagas automáticamente
  al terminar una issue.
- `staging` acepta también PRs directos cuando el responsable lo pide para un
  hotfix o una urgencia.
- `main` sólo recibe una promoción explícita después del soak requerido.
- Las promociones y back-merges se ejecutan con los comandos del adapter; no
  reconstruyas manualmente los pasos de GitHub.
- Antes de mergear, verificá base esperada, conflictos, checks y estado del PR.
- No cambies de branch ni hagas merge, push o back-merge sin autorización
  explícita del usuario.

La configuración vigente de bases y promociones está en `.qz/project.json`.
