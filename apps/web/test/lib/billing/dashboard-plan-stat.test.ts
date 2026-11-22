import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DASHBOARD_PLAN_SLUGS,
    isPlanActive,
    parsePlanNames,
    resolveDashboardFreeCard,
    resolveDashboardPlanStat,
    resolveDashboardTrialStat,
    resolvePlanActionText,
    resolvePlanStatusLabel,
    statusNeedsAction
} from '../../../src/lib/billing/dashboard-plan-stat';

const plan = {
    slug: 'owner-basico',
    name: 'Basic',
    status: 'ACTIVE',
    vertical: 'accommodation'
} as const;

/** Read the translated plan slugs from one locale's billing catalog. */
function readBillingPlanSlugs(locale: string): string[] {
    const file = path.resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales',
        locale,
        'billing.json'
    );
    const billing = JSON.parse(fs.readFileSync(file, 'utf8')) as { plan?: Record<string, unknown> };
    return Object.keys(billing.plan ?? {});
}

describe('TEST:1756:9-11 dashboard plan stat resolver', () => {
    it('TEST:1756:9 prefers a translation and falls back to the API name', () => {
        expect(
            resolveDashboardPlanStat({
                plan,
                activeSubscriptionsCount: 1,
                planNames: { 'owner-basico': 'Básico' }
            })
        ).toEqual({ kind: 'single', label: 'Básico', statusKey: 'active' });
        expect(
            resolveDashboardPlanStat({ plan, activeSubscriptionsCount: 1, planNames: {} }).label
        ).toBe('Basic');
        expect(
            resolveDashboardPlanStat({
                plan,
                activeSubscriptionsCount: 1,
                planNames: { 'owner-basico': 'owner-basico' }
            }).label
        ).toBe('Basic');
    });

    it.each([
        ['ACTIVE', 'active'],
        ['GRACE_PERIOD', 'grace-period'],
        ['SUSPENDED', 'suspended'],
        ['CANCEL_SCHEDULED', 'cancel-scheduled'],
        ['PAUSED', 'paused']
    ] as const)('TEST:1756:9 maps %s to %s', (status, statusKey) => {
        expect(
            resolveDashboardPlanStat({
                plan: { ...plan, status },
                activeSubscriptionsCount: 1,
                planNames: {}
            })
        ).toMatchObject({ kind: 'single', statusKey });
    });

    it('TEST:1756:10 handles free, multiple and safely parsed plan maps', () => {
        expect(
            resolveDashboardPlanStat({ plan: null, activeSubscriptionsCount: 0, planNames: {} })
        ).toEqual({ kind: 'free' });
        expect(
            resolveDashboardPlanStat({ plan: null, activeSubscriptionsCount: 2, planNames: {} })
        ).toEqual({ kind: 'multiple', count: 2 });
        expect(
            resolveDashboardPlanStat({ plan: null, activeSubscriptionsCount: 4, planNames: {} })
        ).toEqual({ kind: 'multiple', count: 4 });
        expect(parsePlanNames(null)).toEqual({});
        expect(parsePlanNames('{bad')).toEqual({});
        expect(parsePlanNames('{"owner-basico":"Básico","bad":1}')).toEqual({
            'owner-basico': 'Básico'
        });
    });

    it('TEST:1756:11 keeps helper slugs in sync with all three billing catalogs', () => {
        for (const locale of ['es', 'en', 'pt']) {
            expect([...DASHBOARD_PLAN_SLUGS].sort()).toEqual(readBillingPlanSlugs(locale).sort());
        }
    });
});

describe('HOS-1996 dashboard trial stat resolver', () => {
    const running = (endsAt: string | null) => ({
        status: 'TRIAL_ACTIVE' as const,
        startedAt: '2026-11-02T17:48:40.000Z',
        endsAt,
        totalDays: 30,
        origins: { base: 30, promo: 0, support: 0 }
    });

    it('reads an active trial with no paid subscription as a trial, not as free', () => {
        // Arrange: /users/me/stats reports no plan while the Hospeda-owned trial runs.
        expect(
            resolveDashboardPlanStat({ plan: null, activeSubscriptionsCount: 0, planNames: {} })
        ).toEqual({ kind: 'free' });

        // Act
        const stat = resolveDashboardTrialStat({
            summaries: [{ status: 'NONE' }, running('2026-12-02T17:48:40.000Z')]
        });

        // Assert
        expect(stat).toEqual({ kind: 'trial', endsAt: '2026-12-02T17:48:40.000Z' });
    });

    it('stays none without any active trial', () => {
        const ended = { ...running('2026-10-01T00:00:00.000Z'), status: 'TRIAL_EXPIRED' as const };
        expect(resolveDashboardTrialStat({ summaries: [] })).toEqual({ kind: 'none' });
        expect(resolveDashboardTrialStat({ summaries: [{ status: 'NONE' }, ended] })).toEqual({
            kind: 'none'
        });
    });

    it('picks the earliest end date and sorts an undated trial last', () => {
        const stat = resolveDashboardTrialStat({
            summaries: [
                running(null),
                running('2026-12-20T00:00:00.000Z'),
                running('2026-12-02T00:00:00.000Z')
            ]
        });
        expect(stat).toEqual({ kind: 'trial', endsAt: '2026-12-02T00:00:00.000Z' });
    });
});

describe('HOS-1996 dashboard free-branch decision', () => {
    const labels = { free: 'Gratuito', trial: 'En prueba', trialEndsOn: 'Hasta el {{date}}' };
    const formatDate = (iso: string) =>
        iso.startsWith('2026-12-02') ? '2 de diciembre de 2026' : null;
    const trial = (endsAt: string | null) => ({
        status: 'TRIAL_ACTIVE' as const,
        startedAt: '2026-11-02T17:48:40.000Z',
        endsAt,
        totalDays: 30,
        origins: { base: 30, promo: 0, support: 0 }
    });

    it('shows En prueba with the end date for an active trial', () => {
        const card = resolveDashboardFreeCard({
            trialSummaries: [{ status: 'NONE' }, trial('2026-12-02T17:48:40.000Z')],
            labels,
            formatDate
        });
        expect(card).toEqual({ value: 'En prueba', statusText: 'Hasta el 2 de diciembre de 2026' });
    });

    it('falls back to Gratuito when every read failed', () => {
        const card = resolveDashboardFreeCard({ trialSummaries: [], labels, formatDate });
        expect(card).toEqual({ value: 'Gratuito', statusText: null });
    });

    it('shows no date line for a trial without an end date', () => {
        const card = resolveDashboardFreeCard({
            trialSummaries: [trial(null)],
            labels,
            formatDate
        });
        expect(card).toEqual({ value: 'En prueba', statusText: null });
    });
});

describe('HOS-2543 resolvePlanStatusLabel', () => {
    const t = (key: string, _fallback: string, params?: Record<string, unknown>) =>
        params?.date ? `${key}|${String(params.date)}` : key;
    const formatDate = (iso: string) => `D(${iso})`;
    const info = (subscriptionStatus: string | null, serviceEndsAt: string | null = null) => ({
        status: 'active',
        subscriptionStatus,
        serviceEndsAt
    });

    it.each([
        ['ACTIVE', 'host.dashboard.plan.active'],
        ['GRACE_PERIOD', 'host.dashboard.plan.gracePeriod'],
        ['SUSPENDED', 'host.dashboard.plan.suspended'],
        ['PAUSED', 'host.dashboard.plan.paused']
    ])('gives %s its own label', (status, key) => {
        expect(resolvePlanStatusLabel({ info: info(status), t, formatDate })).toBe(key);
    });

    it('shows the end date on a scheduled cancellation', () => {
        expect(
            resolvePlanStatusLabel({
                info: info('CANCEL_SCHEDULED', '2026-12-31T00:00:00.000Z'),
                t,
                formatDate
            })
        ).toBe('host.dashboard.plan.cancelScheduled|D(2026-12-31T00:00:00.000Z)');
    });

    it('drops the date when a scheduled cancellation has none', () => {
        expect(resolvePlanStatusLabel({ info: info('CANCEL_SCHEDULED'), t, formatDate })).toBe(
            'host.dashboard.plan.cancelScheduledNoDate'
        );
    });

    it('falls back to the coarse status for an API without subscriptionStatus', () => {
        expect(resolvePlanStatusLabel({ info: info(null), t, formatDate })).toBe(
            'host.dashboard.plan.active'
        );
        expect(
            resolvePlanStatusLabel({
                info: { status: 'past_due', subscriptionStatus: null, serviceEndsAt: null },
                t,
                formatDate
            })
        ).toBe('host.dashboard.plan.inactive');
    });
});

describe('isPlanActive', () => {
    it.each([
        ['ACTIVE', 'active', true],
        ['GRACE_PERIOD', 'past_due', false],
        ['PAUSED', 'cancelled', false],
        [null, 'active', true],
        [null, 'cancelled', false]
    ])('subscriptionStatus %s / status %s -> %s', (subscriptionStatus, status, expected) => {
        expect(isPlanActive({ info: { status, subscriptionStatus } })).toBe(expected);
    });
});

describe('HOS-2553 subscription card with every subscription', () => {
    const sub = (slug: string, status: string) => ({
        slug,
        name: slug.toUpperCase(),
        status,
        vertical: 'accommodation'
    });
    const planNames = { 'owner-basico': 'Básico' };

    it('lists the one declined subscription as a single plan with its exact status', () => {
        const stat = resolveDashboardPlanStat({
            plan: { ...plan, status: 'CHARGE_DECLINED' },
            activeSubscriptionsCount: 1,
            subscriptions: [sub('owner-basico', 'CHARGE_DECLINED')] as never,
            planNames
        });
        expect(stat).toEqual({ kind: 'single', label: 'Básico', statusKey: 'charge-declined' });
    });

    it('maps the waiting checkout to its own status key', () => {
        const stat = resolveDashboardPlanStat({
            plan: { ...plan, status: 'PENDING_AUTHORIZATION' },
            activeSubscriptionsCount: 1,
            planNames
        });
        expect(stat).toMatchObject({ kind: 'single', statusKey: 'pending-authorization' });
    });

    it('shows three subscriptions with plan and status and no "Ver todas"', () => {
        const stat = resolveDashboardPlanStat({
            plan: null,
            activeSubscriptionsCount: 3,
            subscriptions: [
                sub('owner-basico', 'ACTIVE'),
                sub('venue-pro', 'CHARGE_DECLINED'),
                sub('experience-basico', 'PENDING_AUTHORIZATION')
            ] as never,
            planNames
        });
        expect(stat).toEqual({
            kind: 'list',
            total: 3,
            hasMore: false,
            rows: [
                { label: 'Básico', statusKey: 'active' },
                { label: 'VENUE-PRO', statusKey: 'charge-declined' },
                { label: 'EXPERIENCE-BASICO', statusKey: 'pending-authorization' }
            ]
        });
    });

    it('caps the list at three and offers "Ver todas" with four', () => {
        const stat = resolveDashboardPlanStat({
            plan: null,
            activeSubscriptionsCount: 4,
            subscriptions: ['a', 'b', 'c', 'd'].map((slug) => sub(slug, 'ACTIVE')) as never,
            planNames: {}
        });
        expect(stat).toMatchObject({ kind: 'list', total: 4, hasMore: true });
        expect(stat.kind === 'list' && stat.rows).toHaveLength(3);
    });

    it('keeps the count fallback for an API that predates the subscriptions field', () => {
        expect(
            resolveDashboardPlanStat({ plan: null, activeSubscriptionsCount: 2, planNames: {} })
        ).toEqual({ kind: 'multiple', count: 2 });
    });

    it('flags only the two unsettled statuses as needing action', () => {
        expect(statusNeedsAction({ statusKey: 'charge-declined' })).toBe(true);
        expect(statusNeedsAction({ statusKey: 'pending-authorization' })).toBe(true);
        expect(statusNeedsAction({ statusKey: 'active' })).toBe(false);
        expect(statusNeedsAction({ statusKey: 'grace-period' })).toBe(false);
    });
});

describe('HOS-2553 host dashboard labels for the unsettled statuses', () => {
    const t = (key: string) => key;
    const info = (subscriptionStatus: string) => ({
        status: 'past_due',
        subscriptionStatus,
        serviceEndsAt: null
    });

    it.each([
        ['CHARGE_DECLINED', 'host.dashboard.plan.chargeDeclined'],
        ['PENDING_AUTHORIZATION', 'host.dashboard.plan.pendingAuthorization']
    ])('labels %s with its own text instead of "Inactivo"', (status, key) => {
        expect(resolvePlanStatusLabel({ info: info(status), t, formatDate: () => null })).toBe(key);
    });

    it('adds an action line for both and none for an active plan', () => {
        expect(resolvePlanActionText({ info: info('CHARGE_DECLINED'), t })).toBe(
            'host.dashboard.plan.chargeDeclinedAction'
        );
        expect(resolvePlanActionText({ info: info('PENDING_AUTHORIZATION'), t })).toBe(
            'host.dashboard.plan.pendingAuthorizationAction'
        );
        expect(resolvePlanActionText({ info: info('ACTIVE'), t })).toBeNull();
    });
});
