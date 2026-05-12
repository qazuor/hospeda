/**
 * CSP (Content Security Policy) helper functions.
 * Extracted from middleware for testability.
 */

import { buildSentryReportUri } from '@repo/utils';

export { buildSentryReportUri };

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
        // 'self' allows the admin's own bundled scripts (Vite ships everything self-hosted —
        // no CDN script tags). 'nonce-{RANDOM}' for this request's inline scripts.
        // 'strict-dynamic' extends trust to scripts loaded by nonced scripts.
        // 'unsafe-eval' included as precaution for MercadoPago's optional antifraud script
        // (security.js) which uses dynamic code evaluation internally.
        // Can be removed if @qazuor/qzpay-core does not load security.js.
        // 'unsafe-inline' ignored by CSP2+ when nonce is present (serves as CSP1 fallback).
        // Previously included 'https:' as a CSP1 blanket fallback — removed because no
        // external script CDNs are actually used (Sentry, MercadoPago are bundled
        // via npm), and 'strict-dynamic' already neutralized it in CSP2+ browsers.
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline'`,
        // 'unsafe-inline' required for Sentry Replay (rrweb uses inline style attributes).
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        // MercadoPago domains for QZPay billing integration.
        // Cloudinary (res.cloudinary.com) is the media CDN for Hospeda uploads (T-041 enabled
        // admin media rendering via getMediaUrl). blob: is required for AvatarUpload previews
        // using URL.createObjectURL. The explicit res.cloudinary.com entry enforces principle
        // of least privilege even though the current 'https:' blanket already covers it.
        // SPEC-097: explicit OpenStreetMap tile hosts for the admin location
        // picker (LocationPickerField). The blanket `https:` already covers
        // them, but the explicit entry future-proofs the directive when the
        // blanket gets removed.
        "img-src 'self' data: blob: https: https://res.cloudinary.com https://*.mlstatic.com https://*.tile.openstreetmap.org https://*.openstreetmap.org",
        "connect-src 'self' https://*.sentry.io https://api.mercadopago.com https://sdk.mercadopago.com https://www.mercadopago.com https://api.mercadolibre.com https://api-static.mercadopago.com",
        'frame-src https://www.mercadopago.com',
        "worker-src 'self' blob:",
        'child-src blob:',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "media-src 'self'",
        'upgrade-insecure-requests',
        sentryReportUri ? `report-uri ${sentryReportUri}` : null
    ]
        .filter(Boolean)
        .join('; ');

    return directives;
}
