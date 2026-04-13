# ADR-018: Transaction Propagation via Context Object Pattern

## Status

Superseded (2026-04-10)

The `QueryContext` wrapper interface described in this ADR was never implemented in production code.
SPEC-060 gap remediation (GAP-047) removed the `QueryContext` export from `@repo/db` and all
re-exports. The codebase uses bare `tx?: DrizzleClient` positional parameters throughout instead.
The rest of this ADR remains accurate for context and historical reference.

## Context

SPEC-053 added a `tx` parameter to `findAllWithRelations` and other `BaseModel` methods, enabling
callers to propagate an existing database transaction into read queries. This work revealed a broader
inconsistency in how transaction handles are passed throughout the codebase:

1. **Inconsistent parameter style** .. 13+ `BaseModel` methods accept
   `tx?: NodePgDatabase<typeof schema>` as a positional last parameter, while others (e.g., `count()`)
   use an options object containing `tx`. Some methods accept no transaction parameter at all.
2. **Type lie** .. The `tx` parameter is typed as `NodePgDatabase<typeof schema>`, but callers
   frequently pass a `NodePgTransaction<...>` handle. TypeScript does not catch this mismatch because
   the structural overlap is sufficient, but the declared type is misleading and prevents exhaustive
   type narrowing.
3. **Service layer has zero transaction support** .. `BaseCrudService` and all entity services have no
   mechanism to receive or propagate a transaction. Multi-step business operations (e.g., creating an
   accommodation with its initial media and tags) execute each database call in an independent
   implicit transaction, which means partial failures leave the database in an inconsistent state.
4. **Singleton mutable state** .. Services are module-level singletons that store mutable state between
   lifecycle hooks (e.g., `_lastDeletedEntity` in `BaseCrudService`). This pattern is fragile under
   concurrent requests and cannot be scoped to a transaction boundary.

## Decision

We adopt the **Context Object** pattern as the standard mechanism for propagating transaction handles
and request-scoped metadata through both the model and service layers.

### Target interface

```typescript
/** Union type that honestly represents both connection and transaction handles. */
type DrizzleClient = NodePgDatabase<typeof schema> | NodePgTransaction<...>;

/** Extensible context bag passed as the last parameter to model and service methods. */
interface QueryContext {
  /** Active transaction handle. When omitted, methods use the module-level db instance. */
  tx?: DrizzleClient;
  // Future extensions (non-breaking):
  // requestId?: string;
  // actor?: { id: string; role: string };
}
```

All new model and service methods MUST accept `ctx?: QueryContext` as their last parameter. Existing
methods will be migrated incrementally (see Migration Plan below). The `ctx` parameter is optional, so
existing callers that pass no argument continue to work without modification.

### Why Context Object over alternatives

| Alternative | Why rejected |
|-------------|-------------|
| **Repository with `tx` injected via constructor (DI)** | Would require converting all 50+ route files from direct model imports to dependency-injected repositories. The migration cost is prohibitive given the current architecture, and the benefit (testability via interface swapping) can be achieved more cheaply with Vitest module mocks. |
| **AsyncLocalStorage (implicit context)** | Transaction propagation becomes invisible in function signatures. Developers cannot tell from a method's type whether it participates in a transaction. This "magic" is a common source of subtle bugs when a method is called outside the expected async context. The Hospeda codebase values explicit, type-visible contracts. |
| **Positional `tx` parameter (current state)** | Not extensible. Adding `requestId` or `actor` later would require changing every call site again. The Context Object pays this cost once. |

The `count()` method already uses an options object containing `tx`, establishing precedent for this
pattern within the codebase. The Context Object generalizes this precedent.

## Migration Plan

The migration is split into four sequential specs to limit blast radius and allow incremental review:

| Order | Spec | Scope | Description |
|-------|------|-------|-------------|
| 1 | SPEC-058 | `BaseModel` | Define `QueryContext` and `DrizzleClient` types. Add `ctx?: QueryContext` to all `BaseModel` methods alongside the existing positional `tx` parameters (dual-accept period). |
| 2 | SPEC-060 | Model subclasses | Propagate `ctx` through all 50+ entity model methods that override `BaseModel`. Remove positional `tx` parameters once all callers are migrated. |
| 3 | SPEC-059 | `BaseCrudService` | Add `ctx?: QueryContext` to all service methods and lifecycle hooks (`beforeCreate`, `afterUpdate`, etc.). Replace singleton mutable state (`_lastDeletedEntity`) with context-scoped state. |
| 4 | SPEC-064 | Billing package | Wrap multi-step billing operations (subscription creation, addon purchase, plan changes) in explicit transactions propagated via `ctx`. |

Each spec is independently deployable. The dual-accept period in SPEC-058 ensures that existing
callers using positional `tx` continue to compile while model subclasses and services are migrated.

## Consequences

### Positive

- **Explicit transaction boundaries** .. every method signature declares whether it can participate in
  a transaction. Code reviewers can trace transaction scope by following `ctx` through the call chain.
- **Honest types** .. the `DrizzleClient` union type eliminates the current type lie where
  `NodePgTransaction` is passed to a parameter typed as `NodePgDatabase`.
- **Extensible without breaking changes** .. adding `requestId`, `actor`, or `traceId` to
  `QueryContext` is a non-breaking addition. No call sites need to change.
- **Eliminates singleton mutable state** .. lifecycle hooks receive context-scoped state instead of
  reading from a module-level mutable field, making concurrent request handling safe.
- **Incremental adoption** .. `ctx` is optional everywhere. Migration can proceed method-by-method and
  file-by-file without a big-bang rewrite.

### Negative

- **Four-spec migration effort** .. touching every model and service method is significant work, even
  if each individual change is small. Estimated at 50+ model methods and 30+ service methods.
- **Dual-accept period adds complexity** .. during migration, some methods will accept both positional
  `tx` and `ctx.tx`. This temporary overloading requires clear documentation and must be time-boxed.
- **Context threading is manual** .. unlike AsyncLocalStorage, every intermediate function in the call
  chain must explicitly pass `ctx`. Forgetting to thread it through silently drops the transaction.

### Neutral

- The `QueryContext` interface lives in `@repo/db` since it depends on Drizzle types. Services import
  it from there. This does not create a new dependency direction since services already depend on
  `@repo/db`.
- The pattern does not prescribe where `db.transaction()` is called. Route handlers, services, or
  dedicated transaction orchestrators can all initiate transactions and pass them via `ctx`.

## Alternatives Considered

### Keep positional `tx` and add new positional parameters

Adding `requestId`, `actor`, and other context as additional positional parameters would lead to
unwieldy signatures like `findById(id, tx, requestId, actor)` with ordering ambiguity and null
gaps. This violates the project's RO-RO (Receive Object, Return Object) convention.

### Wrap Drizzle client in a custom abstraction

Creating a `DatabaseClient` class that wraps both `NodePgDatabase` and `NodePgTransaction` behind a
unified interface would add an indirection layer that obscures Drizzle's API. The `DrizzleClient`
union type achieves the same type safety without runtime overhead or API hiding.

### Defer until service-layer rewrite

Waiting for a hypothetical service-layer rewrite to address transaction propagation holistically
would leave the current type lie and data inconsistency risks in place indefinitely. The incremental
migration plan allows progress without blocking on a large-scale rewrite.
