---
description: Ejecuta las verificaciones que usa CI
---

Para verificar cambios durante una tarea, ejecutá siempre primero
`hops verify --changed`. El script lee el workflow real de CI y corre lint,
guards, typecheck y los tests de los paquetes afectados, evitando que el agente
reconstruya el plan o lance suites indiscriminadas. Usá `--full` sólo cuando el
usuario lo pida o cuando el cambio exija una suite completa.

Resumí comandos, resultados y fallos sin alterar archivos ni ocultar errores.
