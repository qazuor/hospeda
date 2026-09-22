---
description: Genera un artifact de Hospeda mediante el renderer local
---

Usá la skill `visual-artifact` para interpretar el pedido en lenguaje natural,
investigar fuentes autorizadas y producir un bundle semántico `artifact/v1`.
Elegí hero, narrativa, métricas, tablas, timeline, diagramas, formularios o
checklists según el contenido; no fuerces todos los reportes a una tabla.

Ejecutá `hops artifact validate <bundle>` antes de publicar. El renderer local
determina HTML, estilos, sanitización e interactividad; el modelo no debe
escribir HTML final ni pedirle al usuario un JSON preexistente. Presentá un
resumen y pedí aprobación antes de `hops artifact publish <bundle>`.
No publiques automáticamente ni incluyas secretos.
