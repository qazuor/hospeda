/**
 * Sentry tunnel Cloudflare Worker (SPEC-181 follow-up).
 *
 * Forwards Sentry SDK "envelopes" through a first-party path (`/api/event`) on
 * the site origin so ad-blockers cannot intercept error/trace/replay reports.
 * uBlock Origin blocks Sentry directly via `||sentry.io^$3p`; routing the
 * envelopes through a same-origin path defeats that (the path itself is neutral
 * and not on privacy blocklists — rename it if a list ever catches it).
 *
 * Unlike the PostHog proxy (a blind passthrough to a fixed host), Sentry's
 * upstream is NOT constant: the SDK's `tunnel` option puts the project DSN in
 * the FIRST line of the envelope (a JSON header). This Worker:
 *  1. Reads the envelope body.
 *  2. Parses the first line as JSON and extracts `dsn`.
 *  3. Derives `{ host, projectId }` from the DSN.
 *  4. SSRF GUARD: only forwards when host is `*.sentry.io` and projectId is
 *     numeric. Anything else is rejected with 403 — without this, an attacker
 *     could craft an envelope whose DSN points anywhere and turn this Worker
 *     into an open proxy.
 *  5. POSTs the raw envelope to `https://<host>/api/<projectId>/envelope/`.
 *
 * Only POST is accepted (the SDK always POSTs envelopes). The Cloudflare route
 * binds this Worker to the exact `/api/event` path.
 *
 * Deploy + CSP coupling: see README.md. The Worker MUST be live before
 * `PUBLIC_SENTRY_TUNNEL` is set and the web CSP drops `https://*.sentry.io`
 * from `connect-src`.
 */

/** Exact path the Cloudflare route binds to (e.g. `hospeda.com.ar/api/event`). */
const TUNNEL_PATH = '/api/event';

/**
 * Resolves the Sentry ingestion upstream from an envelope's first line.
 *
 * @param {string} firstLine - The first line of the envelope body (a JSON header).
 * @returns {{ upstreamUrl: string } | { error: string }} Resolved upstream URL,
 *   or an `error` describing why the envelope was rejected.
 */
function resolveSentryUpstream(firstLine) {
    if (!firstLine) {
        return { error: 'empty envelope' };
    }

    let header;
    try {
        header = JSON.parse(firstLine);
    } catch {
        return { error: 'envelope header is not valid JSON' };
    }

    const dsn = header?.dsn;
    if (typeof dsn !== 'string' || dsn.length === 0) {
        return { error: 'envelope header has no dsn' };
    }

    let parsed;
    try {
        parsed = new URL(dsn);
    } catch {
        return { error: 'dsn is not a valid URL' };
    }

    // `URL.hostname` is already lowercased and strips any userinfo/port, so
    // `KEY@SENTRY.IO:443` → `sentry.io` and `k@sentry.io@evil.com` → `evil.com`
    // (the last `@` wins) — both handled by the allowlist below. The DSN scheme
    // is intentionally ignored: the upstream is always rebuilt as `https://`.
    const host = parsed.hostname;
    const projectId = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');

    // SSRF guard: only ever forward to Sentry's own ingestion hosts, and only
    // when the project id is a bare number. This is the single most important
    // check in this Worker — it is what stops the tunnel being an open proxy.
    // `endsWith('.sentry.io')` requires the leading dot, so `sentry.io.evil.com`
    // and `notsentry.io` are both rejected; only `sentry.io` and true subdomains
    // pass.
    const isSentryHost = host === 'sentry.io' || host.endsWith('.sentry.io');
    if (!isSentryHost) {
        return { error: `dsn host is not a sentry.io host: ${host}` };
    }
    if (!/^\d+$/.test(projectId)) {
        return { error: `dsn project id is not numeric: ${projectId}` };
    }

    return { upstreamUrl: `https://${host}/api/${projectId}/envelope/` };
}

export default {
    /**
     * @param {Request} request
     * @returns {Promise<Response>}
     */
    async fetch(request) {
        const url = new URL(request.url);

        // Only serve the exact tunnel path this Worker's route binds to.
        if (url.pathname !== TUNNEL_PATH) {
            return new Response('Not found', { status: 404 });
        }

        // The Sentry SDK always POSTs envelopes. Reject everything else so the
        // tunnel can't be probed with other verbs.
        if (request.method !== 'POST') {
            return new Response('Method not allowed', {
                status: 405,
                headers: { Allow: 'POST' }
            });
        }

        // Read the body as raw bytes (not text) so the forwarded envelope is
        // byte-for-byte identical to what the SDK sent — envelopes can carry
        // binary items (e.g. replay segments) that a text round-trip would
        // corrupt. Only the FIRST line (a JSON header) is decoded, to read the
        // DSN. A literal `\n` byte (0x0A) can't appear inside a UTF-8 multibyte
        // sequence, so scanning for it is safe regardless of header contents.
        //
        // ASSUMPTION: the envelope is NOT compressed. The Sentry browser SDK
        // sends plaintext envelopes (fetch/sendBeacon, no gzip), so the first
        // line is readable JSON. If a `content-encoding` were ever introduced,
        // this scan would read compressed bytes, fail to parse the DSN, and the
        // envelope would be rejected (403) rather than mis-forwarded — a safe
        // failure, but it would silently drop reports, so revisit here first if
        // the SDK ever enables compression.
        const bodyBuffer = await request.arrayBuffer();
        const bytes = new Uint8Array(bodyBuffer);
        const newlineIndex = bytes.indexOf(0x0a);
        const firstLineBytes = newlineIndex === -1 ? bytes : bytes.subarray(0, newlineIndex);
        const firstLine = new TextDecoder().decode(firstLineBytes);

        const resolved = resolveSentryUpstream(firstLine);
        if ('error' in resolved) {
            // 403 (not 400) because a non-sentry DSN is a rejected forwarding
            // target, not merely a malformed request — keep the surface quiet.
            return new Response('Forbidden', { status: 403 });
        }

        const headers = new Headers();
        // Preserve the envelope content type; default to the Sentry envelope
        // media type when the SDK omitted it.
        headers.set(
            'Content-Type',
            request.headers.get('content-type') || 'application/x-sentry-envelope'
        );
        // Ingestion must never be cached/replayed by the edge.
        headers.set('Cache-Control', 'no-store');

        // cf-connecting-ip is set by Cloudflare infra (not user-controlled), so
        // it is safe to forward as X-Forwarded-For — no client spoofing risk.
        const clientIp = request.headers.get('cf-connecting-ip');
        if (clientIp) {
            headers.set('X-Forwarded-For', clientIp);
        }

        const upstreamResponse = await fetch(resolved.upstreamUrl, {
            method: 'POST',
            headers,
            body: bodyBuffer,
            redirect: 'manual'
        });

        // Re-wrap so we can force no-store on the response returned to the browser.
        const responseHeaders = new Headers(upstreamResponse.headers);
        responseHeaders.set('Cache-Control', 'no-store');
        return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders
        });
    }
};

export { resolveSentryUpstream, TUNNEL_PATH };
