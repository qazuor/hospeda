---
description: Preflight de cierre de una issue sin mutar estado
---

Ejecutá primero `hops env --drift --json`; si el resultado no está limpio,
detené el cierre y reportá únicamente las claves/estados pendientes. Luego
ejecutá `hops close-issue --plan --issue HOS-NNN`. Usá el resultado para
resumir criterios de cierre, Git, commits, spec/closeout, Linear, PR/CI,
smoke-gates y worktrees. Agregá riesgos y próximos pasos sólo con evidencia.
No marques Done, no publiques comentarios, no limpies worktrees y no ejecutes
push, merge ni otras mutaciones.
