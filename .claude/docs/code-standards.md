# Code Standards (Quick Reference)

> Concise rules for AI agents. Full details: [docs/contributing/code-standards.md](../../docs/contributing/code-standards.md)

## File Naming

- Components: `PascalCase.tsx` (React), `PascalCase.astro` (Astro)
- Utilities: `kebab-case.ts`
- Tests: `*.test.ts` or `*.test.tsx`
- Schemas: `entity-name.schema.ts`
- Models: `entity-name.model.ts`
- Services: `entity-name.service.ts`

## TypeScript

- Strict mode, no `any` types
- `import type` for type-only imports
- Prefer `readonly` and `as const` for immutability
- Named exports only (no default exports)
- Maximum 500 lines per file
- Prefer `type` over `interface`

## Functions

- RO-RO pattern (Receive Object, Return Object) for all functions
- `async/await` instead of `.then()` chains
- Comprehensive JSDoc on all exported functions, classes, and types
- Explicit typed error responses

## Validation

- Zod via `@repo/schemas` for all runtime inputs
- `@repo/schemas` is the single source of truth for entity types
- Never define standalone TypeScript interfaces for entities
- Infer types from schemas: `type X = z.infer<typeof XSchema>`

## Language

- Code, comments, variable names, documentation: English ONLY
- Chat responses: Spanish ONLY

## Imports Order

1. External dependencies (alphabetically)
2. `@repo/*` packages (alphabetically)
3. Relative imports
4. Type imports (`import type`)
5. Styles

## Error Handling

- Return `Result<T>`: `{ success: true, data: T } | { success: false, error: string }`
- Use try/catch with typed errors
- Never swallow errors silently

## Comments

- Explain WHY, not WHAT
- No commented-out code
- No TODO without a linked issue
