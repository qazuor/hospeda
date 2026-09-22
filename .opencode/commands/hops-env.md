---
description: Chequea variables requeridas sin revelar valores
---

Ejecutá primero `hops env --drift --json` y luego `hops env` si hace falta
confirmar los seis guards. Presentá sólo nombres, presencia y estado de
validación. Si aparece `needsValue` o una variable cruzada distinta, informá
qué clave requiere una decisión humana; nunca inventes un secreto. Ocultá
valores, `.env`, tokens, claves, cookies y passwords.
