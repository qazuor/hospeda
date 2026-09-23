---
description: Ejecuta las verificaciones que usa CI
---

Para verificar cambios durante una tarea, ejecutá siempre primero
`hops verify --changed`. El script lee el workflow real de CI y corre lint,
guards, typecheck y los tests de los paquetes afectados, evitando que el agente
reconstruya el plan o lance suites indiscriminadas. Usá `--full` sólo cuando el
usuario lo pida o cuando el cambio exija una suite completa.

Cuando el resultado lo vaya a consumir otro agente, agregá `--json`: devuelve
un único contrato JSON en stdout con `status`, pasos ejecutados, fallos,
paquetes afectados y `mutations: "none"`; los logs de los checks no se mezclan
con esa salida. `--list --json` permite inspeccionar el plan sin ejecutar nada.

Resumí comandos, resultados y fallos sin alterar archivos ni ocultar errores.
