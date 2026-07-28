/**
 * MercadoLibre listing-description fetch (HOS-286)
 *
 * The ML Items API (`GET /items/{id}`) does NOT carry the seller's description
 * — it lives behind a separate endpoint. That is why ML imports used to arrive
 * with an empty description and an empty "Descripción corta".
 *
 * Kept out of the adapter so its timeout/degradation policy is testable on its
 * own and the adapter file stays inside the 500-line limit.
 *
 * @module services/accommodation-import/adapters/mercadolibre-description
 */

/**
 * The subset of an ML Item Description API response that is read here.
 */
interface MlItemDescription {
    /** Plain-text rendering of the seller's description. */
    readonly plain_text?: string | null | undefined;
}

/**
 * Below this many milliseconds left, the call is not worth starting: it would
 * abort before a round-trip completes and only add latency.
 */
const MIN_USEFUL_BUDGET_MS = 250;

/**
 * Fetches a listing's description from `GET /items/{id}/description`.
 *
 * **Best-effort by design:** the description is an enrichment, not a
 * precondition. Every failure mode — non-2xx, malformed body, network error,
 * timeout, no time left — resolves to `null`, so a successful item extraction
 * is never downgraded to a failed import because of this second call.
 *
 * **Deadline, not a fresh budget.** `ImportSourceAdapter.extract` is
 * contractually bound to resolve within `ctx.timeoutMs`, and this call runs
 * SEQUENTIALLY after the item call. Taking a share of the original budget
 * (rather than what is left of it) still overruns — full + 50% is 1.5× — so the
 * caller passes an absolute deadline and this spends only the remainder.
 *
 * @param input - Item ID, Bearer token, and the absolute epoch-ms deadline the
 *   whole extraction must respect.
 * @returns The raw `plain_text`, or `null` when unavailable.
 *
 * @example
 * ```ts
 * const deadlineAt = Date.now() + ctx.timeoutMs;
 * // ... item call ...
 * const text = await fetchItemDescription({ itemId, token, deadlineAt });
 * ```
 */
export async function fetchItemDescription(input: {
    readonly itemId: string;
    readonly token: string;
    readonly deadlineAt: number;
}): Promise<string | null> {
    const { itemId, token, deadlineAt } = input;

    const budgetMs = deadlineAt - Date.now();
    if (budgetMs < MIN_USEFUL_BUDGET_MS) {
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budgetMs);

    try {
        const response = await fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            },
            signal: controller.signal
        });

        if (!response.ok) {
            return null;
        }

        const body = (await response.json()) as MlItemDescription;
        return typeof body?.plain_text === 'string' ? body.plain_text : null;
    } catch {
        // Network error, timeout, or a non-JSON body — degrade silently.
        return null;
    } finally {
        clearTimeout(timer);
    }
}
