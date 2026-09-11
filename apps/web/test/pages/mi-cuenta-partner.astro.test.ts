/**
 * @file mi-cuenta-partner.astro.test.ts
 * @description Source-level assertions for the partner self-service page
 * (HOS-278 §8, HOS-862). Astro pages cannot be rendered via Vitest, so we
 * lean on string-level assertions on the .astro source — same pattern used
 * by `mi-cuenta-proveedor.astro.test.ts`.
 *
 * HOS-862 regression: an approved partner has no in-app payment CTA. Partner
 * payment is admin-mediated by design — an admin assigns the partner's plan
 * and sends a MercadoPago payment link out of band
 * (`POST /admin/partners/{id}/send-link`); there is no self-service checkout
 * endpoint a link on this page could ever reach. The approved banner must
 * therefore state the fact (the team will send the payment link) instead of
 * offering a link/CTA to `mi-cuenta/suscripcion`, a subscription dashboard
 * that never lists a partner plan (`SUBSCRIPTION_DASHBOARD_DOMAINS` has no
 * `'partner'` entry, and even it did, an approved partner has no
 * subscription yet, so the dashboard would only offer the owner/tourist
 * plans anyway).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/partner/index.astro'),
    'utf8'
);

/**
 * The markup rendered specifically for an approved-content partner —
 * isolated the same way `mi-cuenta-proveedor.astro.test.ts` isolates its
 * revoked branch, so an assertion here can only be satisfied by content that
 * actually renders in this state, not by markup living in a sibling branch
 * (`toMatch` over the whole file would be blind to that distinction).
 */
function getApprovedBranch(): string {
    const start = source.indexOf('isContentApproved ? (');
    const end = source.indexOf(') : isUnderReview ? (');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

describe('mi-cuenta/partner/index.astro (HOS-278 §8 partner self-service)', () => {
    it('is SSR (prerender = false — authenticated, owner-scoped data)', () => {
        expect(source).toContain('prerender = false');
    });

    it('redirects unauthenticated visitors to signin (safety-net guard)', () => {
        expect(source).toContain('Astro.locals.user');
        expect(source).toMatch(/if\s*\(\s*!user\s*\)/);
        expect(source).toContain("path: 'auth/signin'");
    });

    it('fetches the caller own partner listing, forwarding the session cookie', () => {
        expect(source).toContain("import { partnersApi } from '@/lib/api/endpoints-protected';");
        expect(source).toContain('partnersApi.mine({');
        expect(source).toContain("Astro.request.headers.get('cookie')");
    });

    // ── HOS-862 regression ──────────────────────────────────────────────────
    it('renders the approved-content state with NO in-app payment link (HOS-862)', () => {
        const approvedBranch = getApprovedBranch();

        // The one string that used to send an approved partner to a
        // subscription dashboard that never lists a partner plan. Its
        // removal IS the fix — this line fails (RED) against the
        // pre-fix source and passes once the dead CTA is gone.
        expect(approvedBranch).not.toContain("path: 'mi-cuenta/suscripcion'");
        expect(source).not.toContain("path: 'mi-cuenta/suscripcion'");

        // No anchor/link of any kind in the approved branch — a partner in
        // this state has nothing to click, only something to be told.
        expect(approvedBranch).not.toMatch(/<a\s/);

        // The old CTA copy key is gone — an unused translation key would be
        // an orphan promising a button nobody renders.
        expect(approvedBranch).not.toContain('approvedCta');
        expect(source).not.toContain('approvedCta');

        // The banner still uses the approved status key, just without a CTA.
        expect(approvedBranch).toContain("'account.partner.status.approved'");
    });

    it('renders an empty state (not an error, not a 404) when the caller has no ficha', () => {
        expect(source).toContain('partner === null');
        expect(source).toContain('account.partner.empty.text');
        expect(source).toContain('account.partner.empty.cta');
        expect(source).toContain("path: 'mi-cuenta/aliados'");
    });

    it('renders a revoked state (no edit form) when the listing was taken down', () => {
        expect(source).toContain(
            'const isRevoked = partner !== null && partner.revokedAt != null;'
        );
        expect(source).toContain('isRevoked ? (');

        // `revokedAt` is nullish, so an absent value can arrive as
        // `undefined` (a key dropped by JSON serialization), not only as
        // `null`. A strict `!== null` test would read that `undefined` as
        // "revoked" and hide the edit form from every healthy partner.
        expect(source).not.toContain('partner.revokedAt !== null');
    });

    it('renders the PartnerEditForm island with client:load outside the revoked state', () => {
        expect(source).toContain(
            "import { PartnerEditForm } from '@/components/account/PartnerEditForm.client';"
        );
        expect(source).toContain(
            '<PartnerEditForm locale={locale} partner={partner} client:load />'
        );
        expect(source).toContain('{!isRevoked && (');
    });

    it('wraps content in AccountLayout with the partner active section', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="partner"');
    });

    it('resolves locale from Astro.locals, not Astro.params.lang', () => {
        expect(source).toContain('Astro.locals.locale as SupportedLocale');
    });
});
