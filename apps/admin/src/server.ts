import {
    createStartHandler,
    defaultStreamHandler,
    defineHandlerCallback
} from '@tanstack/react-start/server';
import { createRouter } from './router';

/**
 * SPEC-209 T-002: cheap container healthcheck endpoint.
 *
 * The compiled virtual server-entry wraps our default export in:
 *
 *   defineEventHandler(function(event) {
 *     const request = toWebRequest(event);
 *     return serverEntry({ request });  // ← calls us with { request: Request }
 *   })
 *
 * So the `ctx` parameter we receive is `{ request: Web Request }`.
 *
 * `/healthz` is intercepted HERE — before `createStartHandler` or
 * `createRouter` are ever called — so no React tree is built and no
 * QZPayBilling instance is constructed.
 *
 * Background: TanStack Start 1.131.26 + @tanstack/router-generator 1.131.26
 * compile `server.handlers.GET` into the SSR bundle correctly, but the
 * route generator never emits `serverRouteTree` from `routeTree.gen.ts`.
 * The SSR dispatch code short-circuits on `t.serverRouteTree && …`, so
 * `server.handlers` is permanently a no-op in this version. Intercepting
 * at the renderer level is the correct workaround.
 */

const HEALTHCHECK_PATH = '/healthz';

const handler = createStartHandler({
    createRouter
});

export default defineHandlerCallback(async (ctx) => {
    // ctx.request is the Web API Request created by toWebRequest(h3Event).
    const { pathname } = new URL(ctx.request.url);

    if (pathname === HEALTHCHECK_PATH) {
        return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    }

    const startHandler = await handler(defaultStreamHandler);
    return startHandler(ctx);
});
