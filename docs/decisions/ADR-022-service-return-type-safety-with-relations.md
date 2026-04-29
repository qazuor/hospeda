# ADR-022: Service Return Type Safety with Relations

**Status**: Accepted
**Date**: 2026-04-29
**Spec**: SPEC-081

## Context

After SPEC-066, `BaseCrudService.getByField()` (and its convenience wrappers
`getById`, `getBySlug`, `getByName`) return `ServiceOutput<TEntity | null>`,
where `TEntity` is the flat database entity type (e.g., `Accommodation`).

When a service overrides `getDefaultGetByIdRelations()` with a non-null
config, the runtime path is:

```
getByField → model.findOneWithRelations → Drizzle findFirst({ with })
```

The returned object DOES contain populated relation fields at runtime
(e.g., `accommodation.destination`, `accommodation.owner`,
`accommodation.amenities`), but TypeScript only sees `Accommodation` (the
flat type). Consumers cannot access `.destination` or `.owner` with type
safety inside the service layer.

The same gap exists in `findAllWithRelations` paths (`list`, `adminList`,
`search` when relations are loaded).

### What already works

- API routes validate every response against an access schema from
  `@repo/schemas` (e.g., `AccommodationPublicSchema`,
  `PostProtectedSchema`). These access schemas DO declare the relation
  fields, so API consumers (web, admin) get typed relation access through
  `z.infer<typeof AccessSchema>`.
- The runtime data is correct — the gap is purely at the TypeScript
  boundary, between the model layer and the API layer.

### Where the gap hurts

- Custom service methods that need to access `entity.owner` or
  `entity.destination` to make a business decision must cast.
- Internal hooks (`_afterGetByField`, `_beforeUpdate`, ...) that want to
  inspect relation data must cast.
- Tests that assert on populated relations work, but lose autocomplete.

## Considered Options

### Option A — Split `TEntity` generic (rejected)

Add `TEntityWithRelations extends TEntity` as a new generic to
`BaseCrudService` and propagate it through every base class and concrete
service.

- Touches 27 services + 6 base classes.
- Massive refactor with no incremental adoption path.
- Forces every service to define a `WithRelations` shape even when it never
  loads relations.
- Rejected: cost is not justified by the size of the gap.

### Option B — Overloaded return types (rejected)

`getByField()` returns `ServiceOutput<TEntity | TEntityWithRelations | null>`.

- Less invasive than Option A, but consumers now need narrowing
  (`if ('destination' in entity)`).
- Union types in `ServiceOutput` complicate the surface for every consumer
  whether they care about relations or not.
- Rejected: shifts cost from the service layer to every consumer.

### Option C — Accept and document (partially adopted)

Treat the gap as intentional. Service layer returns flat types; relation
type safety lives at the API boundary via access schemas.

- Already the de-facto state, and it works for API consumers.
- Doesn't help service-layer consumers who need typed relation access.

### Option D — Utility type helper (adopted alongside C)

Provide a `WithRelations<TEntity, TRelations>` utility type for service-layer
code that needs typed access:

```ts
type AccommodationDetail = WithRelations<Accommodation, {
    destination: Destination;
    owner: User;
    amenities: Amenity[];
}>;

const result = await service.getById(actor, id);
const entity = result.data as AccommodationDetail | null;
```

- Opt-in, no base class changes, no impact on services that don't need it.
- The cast is explicit and visible in code review.
- Caller declares the relation shape they expect, which doubles as
  documentation of what the service is configured to load.

## Decision

Adopt **Option C + Option D**:

1. Service-layer return types remain flat (`ServiceOutput<TEntity | null>`).
   This is the documented, intentional design.
2. API boundary remains the canonical place for typed relation access via
   access schemas from `@repo/schemas`. API consumers (web, admin) MUST
   prefer access schemas over the utility type.
3. Service-layer code that genuinely needs typed relation access uses the
   `WithRelations<TEntity, TRelations>` utility type exported from
   `@repo/service-core`. The cast is explicit and carries a
   `// TYPE-WORKAROUND:` marker per ADR-021 when used inside production
   service source.
4. JSDoc on `getByField`, `getById`, `getBySlug`, `getByName` documents
   the gap and points at both the access schema and the utility type.

## Consequences

### Positive

- Zero churn for the 27 existing services.
- Service-layer consumers that need typed relation access have an opt-in
  escape hatch.
- Access schemas remain the single source of truth for the relation shape
  exposed at the API boundary.
- No new generic parameters on `BaseCrudService` to reason about.

### Negative

- The utility type requires manual maintenance per call site — the caller
  declares the relation shape, and a drift between the declaration and
  what the service actually loads is not caught at compile time.
- Service-layer consumers that need typed relations still need to write
  the `WithRelations<...>` declaration, which is friction.

### Neutral

- The utility type is intentionally simple (`TEntity & TRelations`). It
  does not attempt to enforce that the relation keys match the
  `getDefaultGetByIdRelations()` config of the service. That correspondence
  is the caller's responsibility, justified by the comment marker.

## References

- `packages/service-core/src/types/index.ts` — `WithRelations` definition
- `packages/service-core/src/base/base.crud.read.ts` — `getByField` JSDoc
- ADR-021 — Type-cast marker policy (`// TYPE-WORKAROUND:`)
- SPEC-066 — getById relation loading consistency
- SPEC-062 — Runtime response validation at the API boundary
