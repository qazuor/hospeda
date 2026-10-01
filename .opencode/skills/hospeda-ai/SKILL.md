---
name: hospeda-ai
description: Reglas para AI core, proveedores, credenciales de aplicación y sincronización de modelos en Hospeda.
triggers:
  - packages/ai-core
  - proveedor AI
  - modelo AI
  - sincronización de modelos
  - moderación AI
---

# Hospeda AI

Usá este skill cuando cambies adapters de proveedores, listado de modelos,
moderación, credenciales administradas por la aplicación o límites AI.

## Reglas

- Separá configuración de proveedor, credenciales y selección de modelo.
- No leas ni muestres API keys; los valores sólo viven en el gestor de entorno.
- Validá proveedor y modelo antes de persistir o invocar.
- Los endpoints de sync deben ser explícitos, auditables y tolerantes a fallos.
- Moderación fail-loud no debe convertirse en allow silencioso.
- Conservá timeouts, retries y límites de costo declarados.

## Verificación

- Probá proveedor válido, modelo inexistente, credencial ausente y error remoto.
- Usá mocks para APIs externas y pruebas de contrato para respuestas.
- No ejecutes sincronizaciones reales sin autorización explícita.
