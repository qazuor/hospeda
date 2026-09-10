/**
 * Evaluates a Drizzle `WHERE` condition tree against a plain row, so a test can
 * observe what the REAL query the code built would have matched.
 *
 * ---
 * WHY THIS EXISTS
 *
 * A guard clause that lives inside a `.where(...)` cannot be tested by a mock
 * that re-declares the rule in its own body: such a mock keeps answering
 * "correctly" after the clause is deleted from the query, so the test certifies
 * the mock rather than the code. That is not hypothetical — it is exactly how
 * HOS-1326's first attempt shipped an `IS NULL` predicate that matched zero rows
 * in production with two green tests over it, and how the same PR's cron harness
 * kept passing with `inArray(status, PENDING_STATUSES)` deleted outright.
 *
 * The way out is to read the ACTUAL condition object. Under `apps/api`'s mocked
 * `@repo/db` (and any suite that stubs the operators the same way) `and`/`or`/
 * `eq`/`inArray`/`isNull` return plain descriptor objects and every column
 * reference is just its own name, so the tree is inspectable without a database.
 *
 * ---
 * FAIL CLOSED, ALWAYS
 *
 * An unknown operator or an unmapped column THROWS. It must never fall through
 * to `true`: a permissive evaluator would silently re-introduce the very
 * fail-open this module exists to catch, one layer further down and much harder
 * to see. If a query starts using an operator this does not model, the test
 * breaks loudly and someone teaches it the operator — that is the intended cost.
 *
 * @module test/helpers/drizzle-condition
 */

/**
 * Column values to evaluate a condition against, keyed by the column reference
 * the suite's `@repo/db` mock produces.
 *
 * The key is whatever the mock uses for that column — `apps/api/test/setup.ts`
 * renders them snake_case (`mp_subscription_id`), while a file that replaces the
 * `@repo/db` mock wholesale may use its own tokens (`MP_SUBSCRIPTION_ID`). Pass
 * the ones your suite actually generates; anything else throws rather than
 * silently reading `undefined`.
 */
export type DrizzleConditionColumns = Readonly<Record<string, unknown>>;

/** Shape of a mocked Drizzle condition descriptor. */
type ConditionNode = {
    readonly type?: string;
    readonly column?: string;
    readonly left?: string;
    readonly right?: unknown;
    readonly value?: unknown;
    readonly values?: readonly unknown[];
    readonly conditions?: readonly unknown[];
};

/**
 * Evaluate a mocked Drizzle condition tree against a row.
 *
 * @param condition - The object handed to `.where(...)` by the code under test.
 * @param columns - Current values, keyed by column reference. See
 *   {@link DrizzleConditionColumns}.
 * @returns Whether the row satisfies the condition.
 * @throws Error When the tree uses an operator or column this does not model —
 *   deliberately, see the module note.
 *
 * @example
 * ```ts
 * returning: async () =>
 *     matchesCondition(capturedWhere, {
 *         id: row.id,
 *         status: row.status,
 *         mp_subscription_id: row.mpSubscriptionId,
 *         deleted_at: null
 *     })
 *         ? [{ id: row.id }]
 *         : [];
 * ```
 */
export function matchesCondition(condition: unknown, columns: DrizzleConditionColumns): boolean {
    const node = (condition ?? {}) as ConditionNode;

    const read = (column: string | undefined): unknown => {
        if (column === undefined || !Object.hasOwn(columns, column)) {
            throw new Error(
                `matchesCondition: unmapped column '${String(column)}' — teach the test's column map about it rather than letting the predicate pass by default`
            );
        }
        return columns[column];
    };

    switch (node.type) {
        case 'and':
            return (node.conditions ?? []).every((child) => matchesCondition(child, columns));
        case 'or':
            return (node.conditions ?? []).some((child) => matchesCondition(child, columns));
        case 'not':
            return !matchesCondition((node as { condition?: unknown }).condition, columns);
        case 'eq':
            return read(node.left ?? node.column) === (node.right ?? node.value);
        case 'ne':
            return read(node.left ?? node.column) !== (node.right ?? node.value);
        case 'inArray':
            return (node.values ?? []).includes(read(node.column));
        case 'notInArray':
            return !(node.values ?? []).includes(read(node.column));
        case 'isNull':
            return read(node.column) === null || read(node.column) === undefined;
        case 'isNotNull': {
            const value = read(node.column);
            return value !== null && value !== undefined;
        }
        case 'lt':
            return (read(node.column) as number) < (node.value as number);
        case 'gt':
            return (read(node.column) as number) > (node.value as number);
        default:
            throw new Error(
                `matchesCondition: unsupported condition type '${String(node.type)}' — add it here; never default to true`
            );
    }
}
