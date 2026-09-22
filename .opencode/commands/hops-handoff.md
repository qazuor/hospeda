---
description: Prepara un handoff completo de Hospeda para otra sesión o agente
---

Ejecutá primero `hops handoff --plan --json`. Usá ese JSON como fuente de los
hechos del worktree, branch, cambios, commits y estado read-only. No vuelvas a
reconstruirlos manualmente.

Luego redactá el handoff que se entregará a la próxima sesión con este formato:

Encerrá todo el prompt entre estos marcadores, en líneas separadas y sin texto
antes o después:

```text
===== BEGIN HOSPEDA HANDOFF =====
...
===== END HOSPEDA HANDOFF =====
```

## Contexto

- issue/spec y objetivo;
- worktree y branch;
- estado Git y tests conocidos.

## Qué se hizo

Enumerá cambios y verificaciones de esta sesión, citando archivos o comandos
cuando exista evidencia. Separá hechos de inferencias.

## Hallazgos y decisiones

Registrá problemas descubiertos, decisiones tomadas, trade-offs y dependencias.
No inventes decisiones que no estén en la conversación o en archivos
versionados.

## Pendientes y bloqueos

Indicá tareas abiertas, preguntas, gates no ejecutados, riesgos y qué información
falta. Incluí el motivo de cada bloqueo.

## Próximo paso

Proponé una única acción concreta, reversible y pequeña.

El resultado, dentro de esos marcadores, debe ser un prompt autocontenido para
otra sesión. No hagas commit,
push, cambios en Linear, escrituras en Engram ni ediciones del proyecto. No
incluyas secretos, tokens, `.env`, cookies ni logs completos. Marcá cada dato
como `verificado`, `inferido` o `pendiente` cuando corresponda.
