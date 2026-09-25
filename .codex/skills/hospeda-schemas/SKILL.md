---
name: hospeda-schemas
description: Reglas para Zod, schemas de request/response, transforms, errores y contratos compartidos de Hospeda.
triggers:
  - packages/schemas
  - Zod
  - schema de API
  - validación
  - request body
  - response schema
---

# Hospeda Schemas

Usá este skill cuando el cambio toque `packages/schemas`, contratos de API,
validación Zod o tipos compartidos entre API, web y admin.

## Reglas

- Organizá schemas por entidad y separá request, response, params, query y
  entidades internas.
- Reutilizá schemas base y refinements; no dupliques reglas en handlers o UI.
- Diferenciá `optional`, `nullable`, defaults y transforms: cambian el contrato.
- Los errores deben ser estables y útiles para los consumidores.
- Cambios incompatibles requieren revisar API, admin, web, tests y datos existentes.
- Mantené inferencia TypeScript desde Zod; no escribas tipos paralelos sin razón.

## Verificación

- Ejecutá tests del schema y consumidores directos.
- Cubrí valores válidos, inválidos, límites, nullability y transforms.
- Verificá que OpenAPI y respuestas reales sigan alineadas.
- Para cambios acotados usá `qz-verify --changed` y ampliá cuando el contrato
  sea compartido.

## Checklist

- [ ] No hay validación duplicada.
- [ ] Request/response y nullability están explícitos.
- [ ] Tipos inferidos y consumidores actualizados.
- [ ] Casos límite y errores tienen cobertura.
- [ ] No se filtraron datos sensibles.
