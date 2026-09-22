---
description: Diagnóstico seguro para iniciar una issue en OpenCode
---

Comenzá con `hops env --drift --json`; si hay variables faltantes, obsoletas o
cruzadas distintas, informalo antes de crear el worktree. Después ejecutá
`hops start-issue HOS-NNN --agent opencode --dry-run`. Explicá la
branch/worktree y los pasos que el script propone. Pedí autorización explícita
antes de repetirlo sin `--dry-run`, porque esa variante puede crear estado y
lanzar el agente. No reimplementes el workflow en el command.
