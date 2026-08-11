/**
 * @file mi-cuenta-proveedor.astro.test.ts
 * @description Source-level assertions for the provider self-service page
 * (HOS-278 §8). Astro pages cannot be rendered via Vitest, so we lean on
 * string-level assertions on the .astro source — same pattern used by
 * `mi-cuenta-aliados.astro.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/proveedor/index.astro'),
    'utf8'
);

describe('mi-cuenta/proveedor/index.astro (HOS-278 §8 provider self-service)', () => {
    it('is SSR (prerender = false — authenticated, owner-scoped data)', () => {
        expect(source).toContain('prerender = false');
    });

    it('redirects unauthenticated visitors to signin (safety-net guard)', () => {
        expect(source).toContain('Astro.locals.user');
        expect(source).toMatch(/if\s*\(\s*!user\s*\)/);
        expect(source).toContain("path: 'auth/signin'");
    });

    it('fetches the caller own listing, forwarding the session cookie', () => {
        expect(source).toContain("import { hostTradesApi } from '@/lib/api/endpoints-protected';");
        expect(source).toContain('hostTradesApi.mine({');
        expect(source).toContain("Astro.request.headers.get('cookie')");
    });

    it('degrades to a friendly error state on fetch failure, without crashing the page', () => {
        expect(source).toContain('const fetchFailed = !tradeResult.ok;');
        expect(source).toContain('fetchFailed ? (');
        expect(source).toContain('account.provider.errors.fetchFailed');
    });

    it('renders an empty state (not an error, not a 404) when the caller owns no listing', () => {
        expect(source).toContain('trade === null');
        expect(source).toContain('account.provider.empty.text');
        expect(source).toContain('account.provider.empty.cta');
        expect(source).toContain("path: 'mi-cuenta/aliados'");
    });

    it('renders a revoked state (no edit form) when the listing was taken down', () => {
        expect(source).toContain('const isRevoked = trade !== null && trade.revokedAt != null;');
        expect(source).toContain('isRevoked ? (');

        // `revokedAt` is `z.coerce.date().nullish()`, so an absent value can
        // arrive as `undefined` (key dropped by JSON serialization), not only
        // as `null`. A strict `!== null` test would read that `undefined` as
        // "revoked" and hide the edit form from EVERY healthy provider — a
        // failure that looks like the page working, on the branch nobody
        // exercises by default.
        expect(source).not.toContain('trade.revokedAt !== null');
        expect(source).toContain('account.provider.revoked.text');
        expect(source).toContain('trade.revokeReason && ');

        // The revoked branch's own markup (between its ternary arm and the
        // final `) : (` fallback arm) must not render the edit form island —
        // it lives strictly in the arm that follows.
        const revokedBranch = source.slice(
            source.indexOf('isRevoked ? ('),
            source.indexOf('<HostTradeEditForm locale={locale} trade={trade}')
        );
        expect(revokedBranch).not.toContain('<HostTradeEditForm');
    });

    it('renders the HostTradeEditForm island with client:load in the fallback (editable) branch', () => {
        expect(source).toContain(
            "import { HostTradeEditForm } from '@/components/account/HostTradeEditForm.client';"
        );
        expect(source).toContain('<HostTradeEditForm locale={locale} trade={trade} client:load />');
    });

    it('wraps content in AccountLayout with the proveedor active section', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="proveedor"');
    });

    it('resolves locale from Astro.locals, not Astro.params.lang', () => {
        expect(source).toContain('Astro.locals.locale as SupportedLocale');
    });
});
