# SPEC-081: Service Return Type Safety with Relations

> **Status**: draft
> **Priority**: P2
> **Complexity**: 4
> **Origin**: SPEC-066 GAP-007
> **Depends on**: SPEC-066 (completed)
> **Related**: SPEC-058 (BaseModel interface alignment), SPEC-062 (runtime response validation)

---

## Problem Statement

After SPEC-066, `getByField()` returns `ServiceOutput<TEntity | null>` where `TEntity` is the flat database entity type (e.g., `Accommodation`). At runtime, when `getDefaultGetByIdRelations()` returns a config, the entity DOES contain nested relation objects (e.g., `destination`, `owner`, `amenities`), but TypeScript sees only the flat type.

### Type Flow

```
Database (relations populated at runtime)
  -> findOneWithRelations returns T | null (T = flat Accommodation)
  -> getByField returns ServiceOutput<TEntity | null> (flat)
  -> entity as TEntity cast forces flat type
  -> Consumers cannot access .destination, .owner with type safety
```

### Impact

- IDE autocomplete does not show relation properties on getById results
- Consumers need `as any` or type assertions to access relations within service layer
- No compile-time safety for relation navigation in hooks or custom methods
- API routes work around this via access schemas from `@repo/schemas`, which DO include relation fields.. but the gap is at the service layer

### Current Workaround

Access schemas (`AccommodationPublicSchema`, `PostProtectedSchema`) define optional relation fields and are validated at the API boundary. This is intentional and sufficient for API consumers. The type gap only affects service-layer code that wants to access relation data directly.

---

## Proposed Solutions

### Option A: Split TEntity Generic (High effort, full type safety)

Add a `TEntityWithRelations` generic parameter to `BaseCrudService`:

```typescript
export abstract class BaseCrudService<
    TEntity extends { id: string },
    TEntityWithRelations extends TEntity,
    TModel extends BaseModel<TEntity>,
    ...
>
```

- `getByField()`, `list()` return `ServiceOutput<TEntityWithRelations | null>`
- Write ops continue returning `ServiceOutput<TEntity>`
- **Pros**: Full compile-time safety, IDE autocomplete works
- **Cons**: Touches 27 services + 6 base classes, massive refactor

### Option B: Overloaded Return Types (Medium effort)

`getByField()` returns a union type based on relations config:

```typescript
public async getByField(...): Promise<ServiceOutput<TEntity | TEntityWithRelations | null>>
```

- **Pros**: Less invasive than Option A
- **Cons**: Union types are harder to work with, consumers still need narrowing

### Option C: Accept and Document (Low effort)

The current architecture is: service layer returns flat types, API layer validates with access schemas. Relation type safety exists at the API boundary, not at the service layer. Document this as an intentional design decision.

- **Pros**: Zero code changes, matches current working pattern
- **Cons**: Service-layer consumers (hooks, custom methods) lack autocomplete

### Option D: Utility Type Helper (Low-medium effort)

Provide a `WithRelations<TEntity, TRelations>` utility type for service-layer code that needs typed access:

```typescript
type AccommodationDetail = WithRelations<Accommodation, {
    destination: Destination;
    owner: User;
    amenities: Amenity[];
}>;
```

Services that need typed access in custom methods or hooks cast explicitly:

```typescript
const entity = result.data as AccommodationDetail;
```

- **Pros**: Opt-in, no base class changes, provides safety where needed
- **Cons**: Requires manual type maintenance per service

---

## Recommendation

**Option C** (accept and document) is the pragmatic choice for now. The access schemas already provide type safety at the API boundary, and no service currently accesses relation data in hooks or custom methods in a way that causes bugs.

**Option D** is a reasonable follow-up if services start needing typed relation access in custom logic.

**Option A** should only be pursued if multiple services are actively fighting the type gap and the cost of 27-service refactor is justified.

---

## Acceptance Criteria

- [ ] Decision documented as ADR
- [ ] JSDoc on `getByField()` clearly explains the type gap and the access schema workaround (already partially done in SPEC-066)
- [ ] If Option D chosen: utility type added to `@repo/schemas` or `@repo/service-core/types`

---

## Files Likely Affected

- `packages/service-core/src/base/base.crud.read.ts` (JSDoc)
- `packages/service-core/src/types/index.ts` (utility type if Option D)
- `docs/decisions/` (ADR)
