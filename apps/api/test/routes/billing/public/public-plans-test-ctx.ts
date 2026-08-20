/**
 * Minimal Hono-context stub for the public plans handler.
 *
 * `createSimpleRoute` declares no `request.query`, so HOS-685 reads `?domain=`
 * straight off the context inside the handler. That makes the context a real
 * argument of the handler under test — these suites capture the raw handler and
 * call it directly, so they have to supply one.
 *
 * `query('domain')` returns `undefined` by default, which is the shape Hono
 * produces for an absent parameter and therefore the "every caller that exists
 * today" path.
 */
export function makePublicPlansCtx(domain?: string): unknown {
    return {
        req: {
            query: (key: string) => (key === 'domain' ? domain : undefined)
        }
    };
}
