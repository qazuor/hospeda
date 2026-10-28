import { z } from 'zod';
import type { CreateProviderApiInput, ProviderRequest } from './provider-api.ts';
import { createProviderRequest, ProviderError } from './provider-api.ts';

/**
 * The tag `GET /users/me` carries on a provider TEST account, and only there. It is the one
 * signal measured to tell the sandbox from production: both tokens start with `APP_USR-` and
 * `live_mode` is `true` on both (EX-14, mp-probes 42 and 56 to 60, README TEST:U3:11 step 0).
 */
export const TEST_ACCOUNT_TAG = 'test_user';

/**
 * Page size of the filtered search. The same one the payments adapter uses
 * (`packages/payments/src/adapters/mercadopago/mercadopago-search.ts`).
 */
const SEARCH_PAGE_SIZE = 20;
/** Hard ceiling on pages per payer email; a search that would need more is reported incomplete. */
const SEARCH_MAX_PAGES = 50;

const accountSchema = z.object({ tags: z.array(z.string()).nullish() });
const searchPageSchema = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(z.object({ id: z.union([z.string(), z.number()]).transform(String) }))
});

/** What one payer-email search walked: the distinct ids, the rows seen and the reported total. */
export interface PayerEmailSearchResult {
    readonly total: number;
    readonly ids: readonly string[];
    readonly rowsSeen: number;
}

/**
 * Provider reads that only the staging sandbox run needs, on top of {@link ProviderApi}.
 * Implemented by {@link createStagingSandboxApi} and by test doubles.
 */
export interface StagingSandboxApi {
    /** The tags of the account that owns the token (`GET /users/me`). Nothing else is read. */
    readonly readAccountTags: () => Promise<readonly string[]>;
    /**
     * Every preapproval the search lists for one payer email, paginated. The listing status
     * is never used (it can be minutes stale, RC-4): the run re-reads each id by id.
     */
    readonly searchPreapprovalsByPayerEmail: (input: {
        readonly payerEmail: string;
    }) => Promise<PayerEmailSearchResult>;
}

/**
 * Builds the two sandbox reads over the same sender (and retry policy) as the cutover client.
 * Errors carry the path WITHOUT the query string, so a payer email never reaches a message.
 *
 * @param input - token and optional injection points (base URL, fetch, sleep)
 * @returns the staging sandbox reads
 */
export function createStagingSandboxApi(input: CreateProviderApiInput): StagingSandboxApi {
    const request: ProviderRequest = createProviderRequest(input);
    return {
        readAccountTags: async () => {
            const { httpStatus, json } = await request({ method: 'GET', path: '/users/me' });
            const parsed = accountSchema.safeParse(json);
            if (httpStatus !== 200 || !parsed.success) {
                throw new ProviderError({
                    message: 'unusable answer from GET /users/me',
                    httpStatus
                });
            }
            return parsed.data.tags ?? [];
        },
        searchPreapprovalsByPayerEmail: async ({ payerEmail }) => {
            const ids = new Set<string>();
            let total = 0;
            let rowsSeen = 0;
            for (let page = 0; page < SEARCH_MAX_PAGES; page += 1) {
                const params = new URLSearchParams({
                    payer_email: payerEmail,
                    limit: String(SEARCH_PAGE_SIZE),
                    offset: String(page * SEARCH_PAGE_SIZE)
                });
                const { httpStatus, json } = await request({
                    method: 'GET',
                    path: `/preapproval/search?${params.toString()}`
                });
                const parsed = searchPageSchema.safeParse(json);
                if (httpStatus !== 200 || !parsed.success) {
                    throw new ProviderError({
                        message: 'unusable answer from GET /preapproval/search',
                        httpStatus
                    });
                }
                if (page === 0) total = parsed.data.paging.total;
                for (const row of parsed.data.results) ids.add(row.id);
                rowsSeen += parsed.data.results.length;
                if (parsed.data.results.length === 0 || rowsSeen >= total) break;
            }
            return { total, ids: [...ids], rowsSeen };
        }
    };
}
