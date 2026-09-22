---
description: Estado y routing SDD read-only de Gentle-AI
---

Ejecutá `hops gentle-sdd-status --json` para consultar el modo SDD/OpenSpec,
el routing y las capacidades detectadas. Usá la salida como evidencia y no
asumas que SDD reemplaza automáticamente a `.specs`.

Este command no instala, archiva, aplica ni modifica cambios SDD. Si el estado
es ambiguo, informalo como pendiente y pedí una decisión antes de mutar nada.
