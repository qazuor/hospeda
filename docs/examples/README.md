# Code Examples

For practical examples of Hospeda development patterns, see the [Guides](../guides/README.md) directory.

## Key Guides

- **[Adding a New Entity](../guides/adding-new-entity.md)** .. Complete tutorial covering Schema, Model, Service, and Route creation (the canonical end-to-end guide; API/admin/web layers are covered as steps in this guide)
- **[Creating Endpoints (API)](../../apps/api/docs/development/creating-endpoints.md)** .. API-specific guide for new endpoints
- **[Admin Development](../../apps/admin/docs/development/README.md)** .. Admin-specific patterns (creating pages, forms, tables)
- **[Web App Guidelines](../../apps/web/CLAUDE.md)** .. Web-specific patterns

## Inline Example Files

Runnable `.ts` examples live next to the source packages, not under `docs/examples/`:

- **Service-core examples** .. `packages/service-core/src/examples/` (`basic-service.ts`, `custom-methods.ts`, `with-hooks.ts`, `complex-logic.ts`)
- **DB examples** .. `packages/db/examples/` (`basic-model.ts`, `with-relations.ts`, `complex-queries.ts`, `advanced-patterns.ts`)
- **Logger examples** .. `packages/logger/docs/examples/` (`basic-logging.ts`, `scoped-logging.ts`, `structured-logging.ts`, `error-logging.ts`)
- **API endpoint examples** .. `apps/api/src/examples/` (`crud-endpoint.ts`, `list-endpoint.ts`, `custom-endpoint.ts`, `complex-logic.ts`)
