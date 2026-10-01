---
name: hops-bun-tooling
description: Consideraciones de Bun y streams para scripts de client-tools.
---

# Tooling Bun

En scripts ejecutados mediante `bun run`, stdout puede ser un pipe y no un
TTY. Para logs que pueden envolver líneas, escribí `\r\n` explícitamente para
evitar cascadas visuales.

Los comandos follow/streaming deben esperar explícitamente la salida del hijo
antes de resolver la función principal y reenviar Ctrl-C al proceso hijo.
Evitá conectar stdout y stderr de procesos distintos a otro proceso sin
controlar los límites de línea; preferí procesar las líneas en el propio CLI.
