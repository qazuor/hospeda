---
description: Consulta segura y descubrible de la memoria Engram
---

Usá `hops engram --help` para ver las operaciones disponibles y elegí siempre
la lectura más acotada que responda la pregunta. Preferí `--json` cuando el
resultado vaya a alimentar otra decisión.

No ejecutes operaciones de escritura (`save`, `delete`, `import`, `sync`,
`setup`, `cloud` u otras equivalentes) sin una confirmación explícita del
usuario y el flag de confirmación que exige el wrapper. Nunca muestres valores
secretos ni trates la memoria como fuente de verdad del código.
