/**
 * @file mi-cuenta-partner.astro.test.ts
 * @description Source-level assertions for the partner self-service page
 * (HOS-278 §8, HOS-862). Astro pages cannot be rendered via Vitest, so we
 * lean on string-level assertions on the .astro source — same pattern used
 * by `mi-cuenta-proveedor.astro.test.ts`.
 *
 * HOS-862 regression: Partner payment follows the manual subscription path
 * created by administrative action 6 and paid by bank transfer.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../../../packages/i18n/src/locales/en/account.json';
import es from '../../../../packages/i18n/src/locales/es/account.json';
import pt from '../../../../packages/i18n/src/locales/pt/account.json';

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
    describe('HOS-1782', () => {
        it('no locale promises a payment link to an approved partner', () => {
            // Arrange
            const approved = [
                es.partner.status.approved,
                en.partner.status.approved,
                pt.partner.status.approved
            ];
            // Act
            const positions = approved.map((copy) =>
                Math.max(
                    copy.indexOf('link de pago'),
                    copy.indexOf('payment link'),
                    copy.indexOf('link de pagamento')
                )
            );
            // Assert
            expect(positions).toEqual([-1, -1, -1]);
        });

        it('renders the open installment card outside the revoked state', () => {
            // Arrange
            // Act
            const hasFetch = source.includes('billingSubscriptionApi.listManualInstallments');
            // Assert
            expect(hasFetch).toBe(true);
            expect(source).toContain('data-testid="partner-installment"');
            expect(source).toContain('!isRevoked && installmentView');
        });

        it('the installment card has no link', () => {
            // Arrange
            const start = source.indexOf('data-testid="partner-installment"');
            const end = source.indexOf('</Section>', start);
            // Act
            const card = source.slice(start, end);
            // Assert
            expect(card.search(/<a\s/)).toBe(-1);
        });
    });
    it('renders row 22 outside the revoked status branch and guards moderation reason', () => {
        const card = source.indexOf('data-testid="partner-presence-notice"');
        const revoked = source.indexOf('isRevoked ? (');
        expect(card).toBeGreaterThan(-1);
        expect(revoked).toBeGreaterThan(card);
        expect(source).toContain('presence.moderated ||');
        expect(source).toContain(
            "presence.moderated || (isContentApproved && presence.publicPage === 'hidden' && presence.carousel === 'hidden')"
        );
        const moderation = source.slice(
            source.indexOf('data-testid="partner-presence-moderated"'),
            source.indexOf('</div>', source.indexOf('data-testid="partner-presence-moderated"'))
        );
        expect(moderation).toContain('presence.moderationReason !== null');
        expect(moderation).toContain('data-testid="partner-presence-moderation-reason"');
        expect(moderation).not.toContain('set:html');
    });

    it('ships every row 22 translation key in all supported locales', () => {
        const keys = ['hidden', 'notDeleted', 'returnsAlone', 'moderated'];
        for (const key of keys) {
            expect(es.partner.presence[key as keyof typeof es.partner.presence]).toBeTruthy();
            expect(en.partner.presence[key as keyof typeof en.partner.presence]).toBeTruthy();
            expect(pt.partner.presence[key as keyof typeof pt.partner.presence]).toBeTruthy();
        }
    });
    it('is SSR (prerender = false — authenticated, owner-scoped data)', () => {
        expect(source).toContain('prerender = false');
    });

    it('redirects unauthenticated visitors to signin (safety-net guard)', () => {
        expect(source).toContain('Astro.locals.user');
        expect(source).toMatch(/if\s*\(\s*!user\s*\)/);
        expect(source).toContain('buildLoginRedirect');
    });

    it('fetches the caller own partner listing, forwarding the session cookie', () => {
        expect(source).toContain(
            "import { billingSubscriptionApi, partnersApi } from '@/lib/api/endpoints-protected';"
        );
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

    it('does not tell an active Partner that Hospeda still needs to create the subscription (HOS-2235)', () => {
        const approvedBranch = getApprovedBranch();

        expect(source).toContain('hasActivePartnerSubscription');
        expect(approvedBranch).toContain('hasActivePartnerSubscription');
        expect(approvedBranch).toContain("'account.partner.status.activeSubscription'");
        expect(es.partner.status.activeSubscription).toBeTruthy();
        expect(en.partner.status.activeSubscription).toBeTruthy();
        expect(pt.partner.status.activeSubscription).toBeTruthy();
    });

    it('renders an empty state (not an error, not a 404) when the caller has no ficha', () => {
        expect(source).toContain('partner === null');
        expect(source).toContain('account.partner.empty.text');
        expect(source).toContain('account.partner.empty.cta');
    });

    it('empty-state CTA points at the public /sumate/partner landing, not at its own section (HOS-2450)', () => {
        const emptyState = source.slice(source.indexOf('partner === null'));
        const ctaHref = emptyState.match(
            /<LinkButton href=\{buildUrl\(\{ locale, path: '([^']+)' \}\)\}>/
        );
        expect(ctaHref?.[1]).toBe('sumate/partner');
        expect(ctaHref?.[1]).not.toBe('mi-cuenta/aliados');
        // The target page really exists.
        expect(
            existsSync(resolve(__dirname, '../../src/pages/[lang]/sumate/partner/index.astro'))
        ).toBe(true);
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
        expect(source).toContain('{!isRevoked && <PartnerEditForm');
    });

    it('wraps content in AccountLayout with the partner active section', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="partner"');
    });

    describe('partner dashboard on the kit (HOS-2477)', () => {
        it('has one PageHeader with a StatusPill and none of the legacy primitives', () => {
            expect(source.match(/<PageHeader\b/g)).toHaveLength(1);
            expect(source).toContain('<StatusPill slot="status"');
            expect(source).not.toContain('AccountPageHeader');
            expect(source).not.toContain('AccountSectionCard');
        });

        it('shows the state banner as a «próxima acción» Alert', () => {
            expect(source).toContain("title={t('account.partner.nextAction.title')}");
        });

        it('reads the numbers from mineStats through the stats island, only for live content', () => {
            expect(source).toContain(
                '{!isRevoked && isContentApproved && <PartnerStatsGrid client:visible locale={locale} />}'
            );
        });

        it('mounts the edit form without wrapping it in another Section', () => {
            const form = source.indexOf('<PartnerEditForm');
            const preceding = source.slice(source.lastIndexOf('{!isRevoked', form), form);
            expect(preceding).not.toContain('<Section');
        });

        it('every pill state has a label in every locale', () => {
            for (const dict of [es, en, pt]) {
                for (const state of [
                    'revoked',
                    'active',
                    'approved',
                    'underReview',
                    'rejected',
                    'draft'
                ]) {
                    expect(
                        (dict.partner as unknown as { statusPill: Record<string, string> })
                            .statusPill[state]
                    ).toBeTruthy();
                }
            }
        });
    });

    it('resolves locale from Astro.locals, not Astro.params.lang', () => {
        expect(source).toContain('Astro.locals.locale as SupportedLocale');
    });
});
