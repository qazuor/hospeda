/**
 * CSP (Content Security Policy) helper functions.
 * Extracted from middleware for testability.
 */

/**
 * Builds a Sentry CSP report URI from a Sentry DSN.
 * Sentry accepts CSP violation reports at its security endpoint.
 *
 * @see https://docs.sentry.io/platforms/javascript/security-policy-reporting/
 *
 * DSN format: https://{key}@{host}/{project_id}
 * Report URI: https://{host}/api/{project_id}/security/?sentry_key={key}
 */
// NOTE: This function is intentionally duplicated from apps/web/src/lib/middleware-helpers.ts.
// Extracting to a shared package (@repo/utils) is deferred to avoid adding a cross-app
// dependency for a single utility function. If more CSP utilities are needed, consolidate then.
export function buildSentryReportUri({ dsn }: { dsn: string }): string | null {
    try {
        const url = new URL(dsn);
        const key = url.username;
        const projectId = url.pathname.replace(/\//g, '');
        const host = url.hostname;

        if (!key || !projectId || !host) {
            return null;
        }

        return `https://${host}/api/${projectId}/security/?sentry_key=${key}`;
    } catch {
        return null;
    }
}

/**
 * Builds the complete CSP directive string for the admin app.
 * Uses nonce-based script integrity with strict-dynamic fallback chain.
 *
 * NOTE: In Phase 1 (Report-Only), the nonce is generated but NOT propagated to
 * SSR-injected script tags (requires TanStack Start >= 1.132.0 + Vite 7).
 * Scripts will trigger CSP violation reports but won't be blocked.
 * Phase 2 (enforcement) is blocked until Vite 7 migration.
 *
 * @param nonce - Cryptographically random nonce for this request
 * @param sentryDsn - Sentry DSN for CSP violation reporting. Pass empty string to disable reporting.
 */
export function buildCspDirectives({
    nonce,
    sentryDsn
}: { nonce: string; sentryDsn: string }): string {
    const sentryReportUri = sentryDsn ? buildSentryReportUri({ dsn: sentryDsn }) : null;

    const directives = [
        "default-src 'self'",
        // 'nonce-{RANDOM}' for this request's scripts. 'strict-dynamic' extends trust
        // to scripts loaded by nonced scripts. 'unsafe-eval' included as precaution for
        // MercadoPago's optional antifraud script (security.js) which uses new Function().
        // Can be removed if @qazuor/qzpay-core does not load security.js.
        // 'unsafe-inline' ignored by CSP2+ when nonce is present (serves as CSP1 fallback).
        // https: ignored by strict-dynamic (serves as CSP2 fallback).
        `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' https:`,
        // 'unsafe-inline' required for Sentry Replay (rrweb uses inline style attributes).
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        // MercadoPago domains for QZPay billing integration
        "img-src 'self' data: https: https://*.mlstatic.com",
        "connect-src 'self' https://*.ingest.sentry.io https://*.vercel.app https://*.mercadopago.com https://api.mercadolibre.com https://api-static.mercadopago.com",
        'frame-src https://*.mercadopago.com',
        "worker-src 'self' blob:",
        'child-src blob:',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        sentryReportUri ? `report-uri ${sentryReportUri}` : null
    ]
        .filter(Boolean)
        .join('; ');

    return directives;
}
