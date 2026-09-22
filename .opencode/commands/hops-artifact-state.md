---
description: Lee el estado persistente de un artifact para el agente
---

Ejecutá `hops artifact state <slug>` y usá el JSON como fuente de los checks y
widgets marcados por el usuario. Esto permite continuar el trabajo a partir de
la interacción del visor; no uses `localStorage` ni supongas el estado. La
consulta es read-only y no debe modificar eventos ni publicar versiones.
