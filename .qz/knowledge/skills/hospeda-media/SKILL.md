---
name: hospeda-media
description: Reglas para Cloudinary, URLs de media, presets, retries y uploads de Hospeda.
triggers:
  - packages/media
  - Cloudinary
  - imágenes
  - uploads
  - media provider
---

# Hospeda Media

Usá este skill cuando cambies uploads, URLs, presets, borrado o healthchecks de
media.

## Reglas

- Usá los subpaths y la fachada del paquete; no instancies providers directamente.
- No armes URLs de Cloudinary inline.
- No agregues presets sin coordinación con configuración y consumidores.
- `delete` y `deleteByPrefix` deben conservar idempotencia y retries.
- Upload no se reintenta automáticamente salvo que el contrato cambie de forma
  explícita.
- Conservá el fallback dev y el comportamiento de `healthCheck`.
- Considerá carreras de avatar y consistencia eventual al modificar borrados.

## Verificación

- Probá upload, URL, borrado idempotente, retry y healthcheck.
- No uses credenciales reales ni ejecutes mutaciones sobre producción.
