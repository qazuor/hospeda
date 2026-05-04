// Vercel Serverless Function entry point.
//
// Wraps the ESM bundle import in try/catch so cold-start failures (which
// otherwise surface only as opaque `FUNCTION_INVOCATION_FAILED` 500s in
// the Vercel dashboard) are returned in the response body. The wrapper
// can be removed once cold-start is verified clean in production.
let handlerPromise;

async function getHandler() {
    if (!handlerPromise) {
        handlerPromise = import('../dist/vercel.js')
            .then((mod) => mod.default)
            .catch((err) => {
                // Capture and re-expose the cold-start error so it's
                // visible to anyone hitting the endpoint without needing
                // dashboard access.
                throw err;
            });
    }
    return handlerPromise;
}

export default async function entry(request) {
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
