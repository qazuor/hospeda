/**
 * Error-shape predicates used by the billing customer sync service.
 *
 * These are pure inspections of a caught `unknown`, with no knowledge of billing
 * or of the sync flow, which is why they live beside the service rather than
 * inside it.
 *
 * Both have to look THROUGH wrapper errors rather than at the top-level object,
 * and that is the whole point of the module: the two libraries in this path each
 * wrap the error that actually carries the diagnosis. Drizzle wraps every query
 * failure in a `DrizzleQueryError`, and qzpay-core wraps every provider failure
 * in a `QZPayProviderSyncError`.
 *
 * @module services/billing-customer-sync.errors
 */

/**
 * How far to follow `cause` links.
 *
 * Deep enough for the wrappers this codebase actually stacks
 * (`DrizzleQueryError` → `pg.DatabaseError` is two), shallow enough that a
 * pathological chain cannot turn error handling into a hot loop.
 */
const MAX_CAUSE_DEPTH = 5;

/**
 * Flatten an error and its `cause` ancestry into a list, outermost first.
 *
 * Guards against self-referential `cause` links, which would otherwise spin
 * until the depth cap.
 *
 * @param error - The caught value, of unknown shape
 * @returns Every `Error` reachable through `cause`, outermost first
 */
function collectErrorChain(error: unknown): Error[] {
    const chain: Error[] = [];
    const seen = new Set<unknown>();
    let current: unknown = error;

    while (current instanceof Error && !seen.has(current) && chain.length < MAX_CAUSE_DEPTH) {
        seen.add(current);
        chain.push(current);
        current = (current as Error & { cause?: unknown }).cause;
    }

    return chain;
}

/**
 * Check whether an error is a PostgreSQL unique-constraint violation (SQLSTATE
 * 23505), anywhere in its `cause` chain.
 *
 * ## Why the chain, and not just the top-level error
 *
 * Drizzle 0.45.2 wraps EVERY query failure — see `pg-core/session.ts`
 * `queryWithCache`, which catches and rethrows `new DrizzleQueryError(query,
 * params, e)` on all four of its branches. The wrapper carries `query`,
 * `params` and `cause`; it has **no `code`**, and its message is
 * `Failed query: insert into "billing_customers" …` — which contains neither
 * "duplicate key" nor "unique constraint". So a top-level check misses a real
 * 23505 on both its branches, and the caller's race recovery silently never
 * runs. The same wrapping is documented in
 * `packages/db/test/integration/tx-propagation.test.ts` and
 * `spec-064-billing-concurrency.test.ts`.
 *
 * The pg driver's own `DatabaseError` — the `cause` — is where `code` and the
 * human-readable "duplicate key value violates unique constraint …" live.
 *
 * @param error - The error to check
 * @returns true if any error in the chain is a duplicate-key violation
 */
export function isDuplicateKeyError(error: unknown): boolean {
    const chain = collectErrorChain(error);

    for (const link of chain) {
        // PostgreSQL unique_violation error code, on whichever layer carries it.
        if ((link as Error & { code?: unknown }).code === '23505') {
            return true;
        }
    }

    // Fallback for drivers or wrappers that drop the code: the pg message text
    // survives on at least one link of the chain.
    return chain.some((link) => {
        const message = link.message.toLowerCase();
        return message.includes('duplicate key') || message.includes('unique constraint');
    });
}

/**
 * Extract the diagnosable fields of a `QZPayProviderSyncError` for structured
 * logging (HOS-596).
 *
 * A provider sync failure carries three things `error.message` does not: which
 * provider failed, which operation it was performing, and the provider's own
 * error (`cause`) — for MercadoPago that `cause` message is where the API error
 * code (e.g. `101 — customer already exists`) actually appears. Logging only the
 * wrapper message is what left the production incident undiagnosable for a month.
 *
 * Matched structurally (`provider` + `operation` string fields) rather than with
 * `instanceof`, so a differing qzpay-core instance across the dependency graph
 * cannot silently degrade the log back to a bare message.
 *
 * @param error - The caught error, of unknown shape
 * @returns Extra log fields, or an empty object when the error is not a provider
 *   sync error
 */
export function describeProviderSyncError(error: unknown): {
    provider?: string;
    providerOperation?: string;
    providerError?: string;
} {
    if (!(error instanceof Error)) {
        return {};
    }

    const candidate = error as Error & {
        provider?: unknown;
        operation?: unknown;
        cause?: unknown;
    };

    if (typeof candidate.provider !== 'string' || typeof candidate.operation !== 'string') {
        return {};
    }

    const cause = candidate.cause;
    const providerError = cause instanceof Error ? cause.message : undefined;

    return {
        provider: candidate.provider,
        providerOperation: candidate.operation,
        ...(providerError === undefined ? {} : { providerError })
    };
}
