// Vercel Serverless Function entry point.
//
// Uses the `fetch` Web Standard export so Vercel routes a real Web Request
// (not a legacy Node IncomingMessage) — required by hono/vercel's handle().
// A bare `export default function(req)` is the legacy Node convention and
// makes Vercel pass IncomingMessage, which breaks `req.headers.get(...)`.
//
// The try/catch wrapper exposes cold-start errors in the response body so
// they're visible without dashboard access.
let handlerPromise;

async function getHandler() {
    if (!handlerPromise) {
        handlerPromise = import('../dist/vercel.js')
            .then((mod) => mod.default)
            .catch((err) => {
                throw err;
            });
    }
    return handlerPromise;
}

export default {
    async fetch(request) {
        try {
            const handler = await getHandler();
            return await handler(request);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error && err.stack ? err.stack : '';
            return new Response(
                JSON.stringify({
                    error: 'cold_start_failure',
                    message,
                    stack: stack.split('\n').slice(0, 20)
                }),
                { status: 500, headers: { 'content-type': 'application/json' } }
            );
        }
    }
};
