/**
 * SQL-clause introspection helpers for asserting on the default soft-delete
 * exclusion that `AccommodationModel` injects into `findAll` /
 * `findAllWithRelations` / `count` (HOS-288, mirroring HOS-274 on
 * `EventModel`/`PostModel`).
 *
 * Drizzle compiles `isNull(col)` to the chunk sequence `['', col, ' is null']`
 * and `and(a, b)` to `['(', <inner>, ')']`, so the clause can be walked without
 * a real database connection. The point is to give tests a real assertion where
 * they would otherwise fall back to a vacuous `expect.anything()`.
 *
 * Scope of the sharing: every consumer inside `packages/db` imports from here.
 * Near-identical copies still live in `packages/service-core` and `apps/api`
 * test files — this monorepo has no mechanism for sharing test-only helpers
 * across packages, so those are deliberate duplicates, not an unfinished
 * extraction. If Drizzle changes its chunk layout, they all need the same edit.
 */

type QueryChunk = { value?: unknown[] };

function chunksOf(clause: unknown): QueryChunk[] | undefined {
    return (clause as { queryChunks?: QueryChunk[] } | undefined)?.queryChunks;
}

function operatorOf(clause: unknown): string | undefined {
    const chunks = chunksOf(clause);
    const middle = chunks?.[2]?.value?.[0];
    return typeof middle === 'string' ? middle : undefined;
}

/**
 * Flattens an `and(...)`-composed clause into its leaf conditions, descending
 * through nested AND groups.
 *
 * The recursion is load-bearing, not tidiness. `and(and(a, b), c)` is the normal
 * shape on the admin path — `BaseModelImpl.findAllWithRelations` composes
 * `and(buildWhereClause(where), ...additionalConditions)`, and `buildWhereClause`
 * itself returns an `and(...)` as soon as `where` carries two or more keys. A
 * single-level walk therefore cannot see a predicate one level down, which makes
 * NEGATIVE assertions (`expect(hasSoftDeleteCondition(x)).toBe(false)`) unsound —
 * and that is exactly the direction the admin-trash guard test uses this in.
 *
 * @param clause - The compiled Drizzle clause (or `undefined`).
 * @returns The leaf conditions; `[]` when the clause is `undefined`.
 */
export function flattenAndConditions(clause: unknown): unknown[] {
    if (clause === undefined) return [];
    const chunks = chunksOf(clause);
    const isAndWrapper =
        chunks?.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')';
    if (!isAndWrapper) return [clause];

    const innerChunks = chunksOf(chunks?.[1]);
    if (!innerChunks) return [clause];
    return innerChunks
        .filter((_, i) => i % 2 === 0)
        .flatMap((child) => flattenAndConditions(child));
}

/**
 * True when the clause contains an `IS NULL` condition on a column named
 * `deleted_at`, at any AND nesting depth. The column name is checked too, so an
 * unrelated `IS NULL` predicate can never satisfy the assertion.
 *
 * @param clause - The compiled Drizzle clause (or `undefined`).
 * @returns Whether the soft-delete exclusion is part of the clause.
 */
export function hasSoftDeleteCondition(clause: unknown): boolean {
    return flattenAndConditions(clause).some((c) => {
        if (operatorOf(c) !== ' is null') return false;
        const column = chunksOf(c)?.[1] as unknown as { name?: string } | undefined;
        return column?.name === 'deleted_at';
    });
}
