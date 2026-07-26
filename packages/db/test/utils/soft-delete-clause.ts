/**
 * SQL-clause introspection helpers for asserting on the default soft-delete
 * exclusion that `AccommodationModel` injects into `findAll` /
 * `findAllWithRelations` / `count` (HOS-288, mirroring HOS-274 on
 * `EventModel`/`PostModel`).
 *
 * Drizzle compiles `isNull(col)` to the chunk sequence `['', col, ' is null']`
 * and `and(a, b)` to `['(', <inner>, ')']`, so the clause can be walked without
 * a real database connection. Extracted from
 * `accommodation.model.soft-delete.test.ts` so tests that only need to assert
 * "the injected condition is really there" do not have to re-declare the walker
 * or fall back to a vacuous `expect.anything()`.
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
 * Flattens an `and(...)`-composed clause into its top-level conditions.
 *
 * @param clause - The compiled Drizzle clause (or `undefined`).
 * @returns The top-level conditions; `[]` when the clause is `undefined`.
 */
export function flattenAndConditions(clause: unknown): unknown[] {
    if (clause === undefined) return [];
    const chunks = chunksOf(clause);
    const isAndWrapper =
        chunks?.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')';
    if (!isAndWrapper) return [clause];

    const innerChunks = chunksOf(chunks?.[1]);
    if (!innerChunks) return [clause];
    return innerChunks.filter((_, i) => i % 2 === 0);
}

/**
 * True when the (possibly AND-composed) clause contains an `IS NULL` condition
 * on a column named `deleted_at`. The column name is checked too, so an
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
