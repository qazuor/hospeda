/**
 * Reads the provider account the API's token belongs to (`GET /users/me`) so the owner can
 * CONFIRM it before authorizing the production run (HOS-1512 D5). The owner never types the id.
 *
 * @module utils/provider-watch/provider-watch-account
 */
import { WATCH_TEST_ACCOUNT_TAG, type WatchAccount, type WatchTransport } from '@repo/payments';
import { type ProviderWatchAccount, ProviderWatchAccountSchema } from '@repo/schemas';

/** Why the account could not be confirmed. */
export type ProviderAccountRefusal = 'UNREADABLE' | 'WRONG_KIND';

/**
 * Reads the account and checks it is the kind this environment watches: a test account for
 * `sandbox`, a real one for `production`.
 *
 * @param args.transport - The provider transport (this environment's token)
 * @param args.account - The account kind this environment watches
 * @returns The account, or why it cannot be confirmed
 */
export async function readProviderAccount(args: {
    readonly transport: WatchTransport;
    readonly account: WatchAccount;
}): Promise<
    | { readonly ok: true; readonly account: ProviderWatchAccount }
    | { readonly ok: false; readonly refusal: ProviderAccountRefusal }
> {
    const response = await args.transport({ method: 'GET', path: '/users/me' });
    const body = response.body;
    if (
        response.status < 200 ||
        response.status >= 300 ||
        typeof body !== 'object' ||
        body === null
    ) {
        return { ok: false, refusal: 'UNREADABLE' };
    }
    const record = body as {
        readonly id?: unknown;
        readonly nickname?: unknown;
        readonly tags?: unknown;
    };
    if (
        (typeof record.id !== 'number' && typeof record.id !== 'string') ||
        (record.tags !== undefined && record.tags !== null && !Array.isArray(record.tags))
    ) {
        return { ok: false, refusal: 'UNREADABLE' };
    }
    const parsed = ProviderWatchAccountSchema.safeParse({
        id: String(record.id),
        nickname: typeof record.nickname === 'string' ? record.nickname : null,
        isTestAccount: Array.isArray(record.tags) && record.tags.includes(WATCH_TEST_ACCOUNT_TAG)
    });
    if (!parsed.success) return { ok: false, refusal: 'UNREADABLE' };
    if (parsed.data.isTestAccount !== (args.account === 'sandbox')) {
        return { ok: false, refusal: 'WRONG_KIND' };
    }
    return { ok: true, account: parsed.data };
}
