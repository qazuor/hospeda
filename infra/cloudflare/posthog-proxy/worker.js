/**
 * PostHog reverse-proxy Cloudflare Worker (SPEC-181).
 *
 * Proxies PostHog ingestion + static assets under a first-party path
 * (`/api/relay/*`) on the site origin so ad-blockers cannot intercept analytics.
 *
 * Routing (after stripping the `/api/relay` prefix):
 *  - `/static/*`            -> https://us-assets.i.posthog.com   (SDK assets, e.g. array.js)
 *  - everything else        -> https://us.i.posthog.com          (ingestion, decide, flags)
 *
 * Behavior:
 *  - Forwards the original method, headers and body unchanged.
 *  - Forwards the real client IP as `X-Forwarded-For` (Cloudflare `cf-connecting-ip`)
 *    so PostHog geo-lookup stays accurate.
 *  - Marks ingestion endpoints (`/e/`, `/decide/`, `/flags/`) as `Cache-Control: no-store`
 *    on both the upstream request and the returned response — event POSTs carry session
 *    data and must never be cached/replayed by the Cloudflare edge.
 *  - Returns the upstream response otherwise unmodified.
 *
 * Deploy + CSP coupling: see README.md. The Worker MUST be live before
 * `PUBLIC_POSTHOG_HOST` and the web CSP are flipped to the proxy origin.
 */

/** Path prefix the Cloudflare route binds to (e.g. `hospeda.com.ar/api/relay/*`). */
const PROXY_PREFIX = '/api/relay';

/** PostHog Cloud (US) upstream hosts. */
const INGESTION_HOST = 'https://us.i.posthog.com';
const ASSETS_HOST = 'https://us-assets.i.posthog.com';

/** Ingestion path prefixes that must never be cached. */
const NO_CACHE_PREFIXES = ['/e/', '/decide/', '/flags/'];

/**
 * Resolves the upstream URL for an incoming proxied request.
 *
 * @param {URL} url - The incoming request URL (path includes the `/api/relay` prefix).
 * @returns {{ upstreamUrl: string, isIngestion: boolean }}
 */
function resolveUpstream(url) {
    let path = url.pathname;
    if (path === PROXY_PREFIX) {
        path = '/';
    } else if (path.startsWith(`${PROXY_PREFIX}/`)) {
        path = path.slice(PROXY_PREFIX.length);
    }

    const isStatic = path.startsWith('/static/');
    const base = isStatic ? ASSETS_HOST : INGESTION_HOST;
    const isIngestion = NO_CACHE_PREFIXES.some((prefix) => path.startsWith(prefix));

    return { upstreamUrl: `${base}${path}${url.search}`, isIngestion };
}

export default {
    /**
     * @param {Request} request
     * @returns {Promise<Response>}
     */
    async fetch(request) {
        const url = new URL(request.url);

        // Only proxy the `/api/relay` path this Worker's route binds to. Anything else
        // (possible if the Worker is ever bound to a broader route, or called
        // directly outside the Cloudflare route filter) is rejected rather than
        // silently forwarded to PostHog.
        if (url.pathname !== PROXY_PREFIX && !url.pathname.startsWith(`${PROXY_PREFIX}/`)) {
            return new Response('Not found', { status: 404 });
        }

        const { upstreamUrl, isIngestion } = resolveUpstream(url);

        const headers = new Headers(request.headers);
        // Drop the inbound Host header so undici/Workers sets it from the upstream URL.
        headers.delete('host');

        // cf-connecting-ip is set by Cloudflare infra (not user-controlled), so it is
        // safe to overwrite X-Forwarded-For with it — no client spoofing risk.
        const clientIp = request.headers.get('cf-connecting-ip');
        if (clientIp) {
            headers.set('X-Forwarded-For', clientIp);
        }
        if (isIngestion) {
            headers.set('Cache-Control', 'no-store');
        }

        const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
        const init = {
            method: request.method,
            headers,
            body: hasBody ? request.body : undefined,
            redirect: 'manual'
        };
        // Streaming a request body through fetch requires duplex: 'half'.
        if (hasBody) {
            init.duplex = 'half';
        }

        const upstreamResponse = await fetch(upstreamUrl, init);

        if (!isIngestion) {
            return upstreamResponse;
        }

        // Re-wrap so we can force no-store on the response without mutating an
        // immutable upstream headers object.
        const responseHeaders = new Headers(upstreamResponse.headers);
        responseHeaders.set('Cache-Control', 'no-store');
        return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders
        });
    }
};

export { resolveUpstream };
