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
 * Scope of the sharing, stated honestly: the three `accommodation.*` test files in
 * `packages/db/test/models/` import from here. Older local copies still live in
 * `event.model.soft-delete.test.ts`, `post.model.soft-delete.test.ts`,
 * `event.model.categories.test.ts` and `post.model.categories.test.ts` (the first
 * two are also WEAKER — they match on the ` is null` operator without checking the
 * column name, so any unrelated `IS NULL` satisfies them), and in
 * `packages/service-core` / `apps/api` test files, which cannot import across
 * package boundaries because this monorepo has no mechanism for sharing test-only
 * helpers. All of those are still single-level walkers and none of them has the
 * OR guard below. If Drizzle changes its chunk layout, every copy needs the edit.
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
 * True when `sql.join` interleaved these chunks with ` and ` separators.
 *
 * `and(...)` and `or(...)` compile to the SAME chunk shape — `['(', <joined>, ')']`.
 * The ONLY thing telling them apart is the separator sitting at the odd indices of
 * the joined inner SQL. Flattening without this check treats a disjunction as a
 * conjunction, so a clause where `deleted_at IS NULL` is merely one branch of an
 * `or(...)` — a query that DOES return soft-deleted rows — would satisfy
 * {@link hasSoftDeleteCondition}. That is a false green on the exact property
 * these helpers exist to assert, so the check is a correctness guard, not polish.
 */
function isAndJoined(innerChunks: QueryChunk[]): boolean {
    for (let i = 1; i < innerChunks.length; i += 2) {
        if (innerChunks[i]?.value?.[0] !== ' and ') return false;
    }
    return true;
}

/**
 * Flattens an `and(...)`-composed clause into its leaf conditions, descending
 * through nested AND groups. Any group joined by something other than ` and `
 * (an `or(...)`) is returned as one opaque leaf rather than descended into.
 *
 * The recursion matters because a single-level walk cannot see a predicate one
 * level down, which makes NEGATIVE assertions
 * (`expect(hasSoftDeleteCondition(x)).toBe(false)`) unsound on any nested clause.
 * `buildWhereClause` returns its own `and(...)` as soon as `where` carries two or
 * more keys, and `BaseModelImpl` then composes
 * `and(buildWhereClause(where), ...additionalConditions)` — so a caller-supplied
 * `where.deletedAt` alongside another `where` key and an additional condition
 * nests exactly that way.
 *
 * @param clause - The compiled Drizzle clause (or `undefined`).
 * @returns The leaf conditions; `[]` when the clause is `undefined`.
 */
export function flattenAndConditions(clause: unknown): unknown[] {
    if (clause === undefined) return [];
    const chunks = chunksOf(clause);
    const isGroupWrapper =
        chunks?.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')';
    if (!isGroupWrapper) return [clause];

    const innerChunks = chunksOf(chunks?.[1]);
    if (!innerChunks) return [clause];
    // An OR group is opaque: its branches are alternatives, not conjuncts.
    if (!isAndJoined(innerChunks)) return [clause];
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
