/**
 * @file mi-cuenta-index.astro.test.ts
 * @description The general dashboard after its move to the kit (HOS-2473).
 *
 * The page source is checked for its wiring (Astro pages do not render under
 * Vitest); the role-aware entry points (H-151, HOS-296) and the subscription
 * stat (HOS-1066, HOS-1996) are checked as real behaviour on the pure module
 * the page now delegates to, `lib/account/general-dashboard.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TrialStatusEnum, type TrialSummaryResponse } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildGeneralDashboardLinks,
    resolveSubscriptionStatText
} from '../../src/lib/account/general-dashboard';

const page = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/index.astro'),
    'utf8'
);
const lib = readFileSync(resolve(__dirname, '../../src/lib/account/general-dashboard.ts'), 'utf8');

/** Identity translator: returns the key, with params appended for assertions. */
const t = (key: string, _fallback?: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

const ids = (permissions: string[]) =>
    buildGeneralDashboardLinks({ permissions }).map((row) => row.id);

describe('mi-cuenta/index.astro — wiring (HOS-2473)', () => {
    it('renders the kit header, stat island and links section, with the dashboard template', () => {
        expect(page).toContain('<GeneralDashboardHeader');
        expect(page).toContain('<GeneralDashboardStats');
        expect(page).toContain('<DashboardLinksSection');
        expect(page).toContain('template="dashboard"');
    });

    it('keeps the per-user numbers in a client island, not in a DOM script', () => {
        expect(page).toMatch(/<GeneralDashboardStats[^>]*client:visible/);
        expect(page).not.toContain('<script>');
        expect(page).not.toContain('getElementById');
    });

    it('reads plan names from the catalog, never a hand-kept slug list', () => {
        expect(page).toContain('readDashboardPlanNames');
        expect(page).not.toContain('DASHBOARD_PLAN_SLUGS');
    });

    it('keeps the What’s New / tour controller', () => {
        expect(page).toContain('<DashboardController');
    });
});

describe('general dashboard entry points (H-151, HOS-296)', () => {
    it('gates through the shared predicates, never a role literal', () => {
        expect(lib).toContain("canAccessPublisherArea({ area: 'host', permissions })");
        expect(lib).toContain("canAccessPublisherArea({ area: 'venue', permissions })");
        expect(lib).not.toMatch(/includes\(\s*['"](HOST|VENUE_OWNER|EXPERIENCE_OWNER)['"]\s*\)/);
    });

    it('offers a tourist only the account entries, and no «Editar perfil» duplicate', () => {
        expect(ids([])).toEqual(['messages', 'preferences', 'newsletter']);
    });

    it('prepends the host entries for a host', () => {
        expect(ids(['accommodation.create']).slice(0, 2)).toEqual(['hostDashboard', 'properties']);
    });

    it('offers a venue owner their dashboard and listings, with the merchant inbox copy', () => {
        const rows = buildGeneralDashboardLinks({ permissions: ['venue.editOwn'] });
        expect(rows.map((row) => row.id)).toContain('venueDashboard');
        expect(rows.map((row) => row.id)).not.toContain('experienceDashboard');
        const listings = rows.find((row) => row.id === 'listings');
        expect(listings?.labelKey).toBe('listing.owner.nav');
        expect(listings?.path).toBe('mi-cuenta/comercio');
        expect(rows.find((row) => row.id === 'messages')?.descriptionKey).toBe(
            'account.pages.dashboard.nav.myMessagesListingDesc'
        );
    });

    it('keeps both hats for an account that is host AND experience owner', () => {
        const rowIds = ids(['accommodation.create', 'experience.editOwn']);
        expect(rowIds).toContain('hostDashboard');
        expect(rowIds).toContain('experienceDashboard');
    });
});

describe('subscription StatCard text (HOS-1066, HOS-1996)', () => {
    const base = { planNames: { 'owner-pro': 'Pro anfitrión' }, t, formatDate: () => '01/12' };

    it('names a single plan from the catalog map with its exact status', () => {
        const text = resolveSubscriptionStatText({
            ...base,
            stats: {
                plan: { slug: 'owner-pro', name: 'owner-pro', status: 'GRACE_PERIOD' },
                activeSubscriptionsCount: 1
            } as never,
            trialSummaries: []
        });
        expect(text).toEqual({
            value: 'Pro anfitrión',
            hint: 'account.pages.dashboard.stats.gracePeriodStatus',
            rows: [],
            action: null,
            viewAll: false
        });
    });

    it.each([
        ['CHARGE_DECLINED', 'chargeDeclinedStatus', 'chargeDeclinedAction'],
        ['PENDING_AUTHORIZATION', 'pendingAuthorizationStatus', 'pendingAuthorizationAction']
    ])('HOS-2553 gives %s its own status and a what-to-do line', (status, statusKey, actionKey) => {
        const text = resolveSubscriptionStatText({
            ...base,
            stats: {
                plan: { slug: 'owner-pro', name: 'owner-pro', status },
                activeSubscriptionsCount: 1
            } as never,
            trialSummaries: []
        });
        expect(text.hint).toBe(`account.pages.dashboard.stats.${statusKey}`);
        expect(text.action).toBe(`account.pages.dashboard.stats.${actionKey}`);
    });

    it('HOS-2553 lists every live subscription (max three) with active and pending counts and «Ver todas»', () => {
        const sub = (slug: string, status: string) => ({
            slug,
            name: slug,
            status,
            vertical: 'accommodation'
        });
        const text = resolveSubscriptionStatText({
            ...base,
            stats: {
                plan: null,
                activeSubscriptionsCount: 2,
                subscriptions: [
                    sub('owner-pro', 'ACTIVE'),
                    sub('venue-pro', 'CHARGE_DECLINED'),
                    sub('experience-pro', 'PENDING_AUTHORIZATION'),
                    sub('partner-gold', 'ACTIVE')
                ]
            } as never,
            trialSummaries: []
        });
        expect(text).toEqual({
            value: 'account.pages.dashboard.stats.subscriptionsSummary:{"active":"account.pages.dashboard.stats.activeSubscriptionsPart_other:{\\"count\\":2}","pending":"account.pages.dashboard.stats.pendingSubscriptionsPart_one:{\\"count\\":1}"}',
            hint: null,
            rows: [
                { plan: 'Pro anfitrión', status: 'account.pages.dashboard.stats.activeStatus' },
                { plan: 'venue-pro', status: 'account.pages.dashboard.stats.chargeDeclinedStatus' },
                {
                    plan: 'experience-pro',
                    status: 'account.pages.dashboard.stats.pendingAuthorizationStatus'
                }
            ],
            action: 'account.pages.dashboard.stats.chargeDeclinedAction',
            viewAll: true
        });
    });

    it('heads the list with only the non-zero part (Decision 1)', () => {
        const sub = (slug: string, status: string) => ({
            slug,
            name: slug,
            status,
            vertical: 'accommodation'
        });
        const head = (statuses: readonly string[]) =>
            resolveSubscriptionStatText({
                ...base,
                stats: {
                    plan: null,
                    activeSubscriptionsCount: 0,
                    subscriptions: statuses.map((status, i) => sub(`plan-${i}`, status))
                } as never,
                trialSummaries: []
            }).value;
        // Settled statuses other than ACTIVE still count as active.
        expect(head(['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED'])).toBe(
            'account.pages.dashboard.stats.activeSubscriptionsPart_other:{"count":3}'
        );
        // A declined charge is neither active nor pending.
        expect(head(['PENDING_AUTHORIZATION', 'CHARGE_DECLINED'])).toBe(
            'account.pages.dashboard.stats.pendingSubscriptionsPart_one:{"count":1}'
        );
        expect(head(['ACTIVE', 'CHARGE_DECLINED'])).toBe(
            'account.pages.dashboard.stats.activeSubscriptionsPart_one:{"count":1}'
        );
        expect(head(['PENDING_AUTHORIZATION', 'PENDING_AUTHORIZATION'])).toBe(
            'account.pages.dashboard.stats.pendingSubscriptionsPart_other:{"count":2}'
        );
        // Neither part: the neutral count stays.
        expect(head(['CHARGE_DECLINED', 'CHARGE_DECLINED'])).toBe(
            'account.pages.dashboard.stats.subscriptionsCount_other:{"count":2}'
        );
    });

    it('shows the count for two or more live subscriptions', () => {
        const text = resolveSubscriptionStatText({
            ...base,
            stats: { plan: null, activeSubscriptionsCount: 3 },
            trialSummaries: []
        });
        expect(text.value).toBe(
            'account.pages.dashboard.stats.multipleSubscriptions_other:{"count":3}'
        );
    });

    it('asks the trial before the free label', () => {
        const trial = {
            status: TrialStatusEnum.TRIAL_ACTIVE,
            endsAt: '2026-12-01T00:00:00.000Z'
        } as unknown as TrialSummaryResponse;
        const withTrial = resolveSubscriptionStatText({
            ...base,
            stats: { plan: null, activeSubscriptionsCount: 0 },
            trialSummaries: [trial]
        });
        expect(withTrial.value).toBe('account.pages.dashboard.stats.trialStatus');
        const free = resolveSubscriptionStatText({
            ...base,
            stats: { plan: null, activeSubscriptionsCount: 0 },
            trialSummaries: []
        });
        expect(free).toEqual({
            value: 'account.pages.dashboard.stats.freeStatus',
            hint: null,
            rows: [],
            action: null,
            viewAll: false
        });
    });
});
