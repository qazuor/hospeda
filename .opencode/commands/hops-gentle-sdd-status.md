---
description: Estado read-only del SDD excepcional de Gentle-AI
---

SDD/OpenSpec está fuera del flujo normal de Hospeda. Ejecutá
`hops gentle-sdd-status --json` sólo cuando la persona haya pedido
explícitamente un change SDD, para consultar el routing y las capacidades
detectadas. En el resto de los casos usá ODD, Linear y `.specs` según
corresponda; no asumas que SDD reemplaza a ninguno de ellos.

Este command no instala, archiva, aplica ni modifica cambios SDD. Si el estado
es ambiguo, informalo como pendiente y pedí una decisión antes de mutar nada.
