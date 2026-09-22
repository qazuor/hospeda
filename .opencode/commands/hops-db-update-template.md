---
description: Construye y promueve de forma controlada el template de bases
---

Usá `bash scripts/worktree/template.sh status hospeda_template` para mostrar el
estado actual. Si está stale, construí una candidata con
`template.sh build-candidate <nombre>`, verificá journal, manifest, seed y
health checks, y presentá el plan. La promoción requiere autorización humana y
se ejecuta sólo con `template.sh promote <candidata> hospeda_template
--confirm`. Conservá el backup y nunca uses `db:push --force`. No lo ejecutes
contra producción.
