/**
 * The fake provider's `GET /users/me` (HOS-1512, TEST:B1:19): the answer the watch battery's
 * environment guard reads. The test account carries `tags: ["test_user"]`; a production
 * account carries no such tag. `live_mode` is `true` on both, as measured (EX-14).
 */

/** Which kind of account the fake answers as. */
export type FakeProviderAccount = 'sandbox' | 'production';

/** Handles `GET /users/me`. */
export function handleUsersMeRoute(args: {
    readonly method: string;
    readonly url: URL;
    readonly account: FakeProviderAccount;
}): { readonly status: number; readonly body?: unknown } | null {
    if (args.method !== 'GET' || args.url.pathname !== '/users/me') return null;
    return {
        status: 200,
        body: {
            id: args.account === 'sandbox' ? 900000001 : 100000001,
            nickname: args.account === 'sandbox' ? 'TESTUSER-FAKE' : 'HOSPEDA-FAKE',
            live_mode: true,
            tags: args.account === 'sandbox' ? ['test_user', 'normal'] : ['normal']
        }
    };
}
