---
description: Reúne contexto verificable de una issue Hospeda
---

Ejecutá `hops context HOS-NNN --json` y usá su salida como fuente de hechos.
Presentá sólo issue, estado, labels, worktree/branch, cambios, DB, servidores y
spec cuando estén disponibles. Separá `verificado`, `inferido` y `pendiente`.
No reconstruyas datos manualmente ni ejecutes mutaciones en Git, Linear,
Engram, worktrees o archivos del proyecto.
