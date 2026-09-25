---
name: hospeda-admin
description: Reglas específicas para desarrollar y verificar `apps/admin` de Hospeda con TanStack Start, CRUD, tablas, auth y SSR.
triggers:
  - apps/admin
  - TanStack Start
  - CRUD admin
  - TanStack Table
  - formularios admin
  - rutas protegidas
---

# Hospeda Admin

Usá este skill cuando el cambio toque `apps/admin`, páginas CRUD, tablas,
formularios, auth del panel, rutas protegidas, SSR o despliegue del admin.

## Fuente de verdad

- Reglas detalladas durante la transición: `apps/admin/CLAUDE.md`.
- Rutas file-based: `apps/admin/src/routes/`.
- Configuración de entidades: `apps/admin/src/config/`.
- Hooks y clientes: `apps/admin/src/hooks/` y `apps/admin/src/lib/`.
- Componentes compartidos: `apps/admin/src/components/`.
- Contratos API: `packages/schemas/` y `apps/api/`.

Verificá cada regla legacy contra el patrón implementado por la entidad que se
está modificando.

## Arquitectura CRUD

- Seguí el patrón de configuración de entidad y la factory de hooks existente.
- Mantené separadas las páginas list, view, edit y create.
- Respetá el routing file-based y los parámetros tipados.
- Reutilizá tablas, filtros, paginación, acciones y relation managers antes de
  crear componentes paralelos.
- Los cambios de API deben actualizar contrato, cliente, estados de carga y
  estados de error del admin.

## Auth y SSR

- Las rutas protegidas deben usar el mecanismo de auth existente.
- No construyas singletons por request en código que pueda ejecutarse del lado
  cliente.
- No accedas a APIs browser-only durante SSR.
- Conservá permisos, roles y redirecciones; no agregues bypass para simplificar
  una prueba.
- El SSR debe crear estado por request cuando corresponda; no uses singletons
  de datos o clientes que compartan estado entre requests.

## Formularios, tablas y UX

- Validá formularios con los schemas compartidos cuando corresponda.
- Mantené estados de loading, empty, error, success y optimistic updates
  coherentes con el patrón del panel.
- En TanStack Table, preservá columnas, sorting, filtros y selección al agregar
  acciones nuevas.
- Las acciones destructivas requieren confirmación y feedback visible.
- Respetá componentes, tokens y accesibilidad del sistema de UI.

## API, despliegue y healthchecks

- Usá el cliente API común y sus errores tipados.
- El healthcheck operativo es `/healthz` cuando el despliegue lo requiera; no
  uses `GET /` como sustituto.
- Conservá la configuración de build con Nitro/Vite y los comandos declarados
  por el proyecto.
- El plugin `nitro/vite` y la salida `.output/server/index.mjs` son parte del
  contrato de despliegue; no los reemplaces por un SSR Vite genérico.
- No pongas valores de entorno en código ni commits.

## Variables y build inicial

- `VITE_*` queda embebido en el cliente; los secretos permanecen en variables
  server-side `HOSPEDA_*` y nunca se duplican en `VITE_*`.
- Después de un checkout fresco, construí los paquetes workspace no aliased
  antes de `pnpm dev`; de lo contrario el SSR puede fallar por `dist/` ausente.

## Testing y verificación

- Ejecutá tests de la ruta/componente modificado y typecheck relevante.
- Probá permisos, navegación, errores de API y estados vacíos en cambios CRUD.
- Para cambios acotados preferí `qz-verify --changed`.
- Si el cambio toca SSR o build, ejecutá el build del admin además de tests.

## Checklist

- [ ] Se respetó el patrón CRUD y el routing file-based.
- [ ] Auth, permisos y SSR conservan las invariantes existentes.
- [ ] API, schemas y cliente están sincronizados.
- [ ] Loading, empty, error y confirmaciones son explícitos.
- [ ] Tablas y formularios mantienen accesibilidad y estados coherentes.
- [ ] Tests, typecheck y build relevantes pasaron.
- [ ] No se expusieron secretos ni datos privados.
