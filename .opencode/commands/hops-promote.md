---
description: Plan read-only de promoción entre ramas declaradas
---

Ejecutá `hops promote --plan [from] [to] --json`. Interpretá el plan, las
precondiciones (`checkout.clean`, refs disponibles y divergencia) y los commits
divergentes. No crees PR, no hagas merge, push ni cambies ramas sin aprobación
explícita.
