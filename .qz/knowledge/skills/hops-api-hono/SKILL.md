---
name: hops-api-hono
description: Diagnóstico de rutas Hono y pruebas de subrouters en la API Hospeda.
---

# Hono en Hospeda

Cuando varios endpoints hermanos se montan en `/` dentro del mismo router,
los middlewares de autorización pueden aplicarse durante la resolución de una
ruta montada como subrouter. En tests de integración:

- otorgá al actor mock la unión de permisos de las rutas hermanas;
- usá la barra final cuando el endpoint es la raíz de un subrouter;
- documentá el motivo en el test para no volver a diagnosticarlo como un bug de
  la ruta o del guard.

Esto es conocimiento de la implementación actual de Hono en Hospeda, no una
regla global del kit.
