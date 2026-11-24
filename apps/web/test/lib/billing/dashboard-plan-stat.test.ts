import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    getActionStatusKey,
    parsePlanNames,
    resolveDashboardFreeCard,
    resolveDashboardPlanStat,
    resolveDashboardTrialStat,
    statusNeedsAction
} from '../../../src/lib/billing/dashboard-plan-stat';

const plan = {
    slug: 'owner-basico',
    name: 'Basic',
    status: 'ACTIVE',
    vertical: 'accommodation'
} as const;

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
            activeCount: 1,
            pendingCount: 1,
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
        expect(stat).toMatchObject({
            kind: 'list',
            total: 4,
            activeCount: 4,
            pendingCount: 0,
            hasMore: true
        });
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

    it('narrows the action key to the two unsettled statuses and null otherwise', () => {
        expect(getActionStatusKey({ statusKey: 'charge-declined' })).toBe('charge-declined');
        expect(getActionStatusKey({ statusKey: 'pending-authorization' })).toBe(
            'pending-authorization'
        );
        expect(getActionStatusKey({ statusKey: 'active' })).toBeNull();
        expect(getActionStatusKey({ statusKey: 'grace-period' })).toBeNull();
    });
});

/** Read one locale namespace file as a plain object. */
function readLocale(locale: string, namespace: string): Record<string, unknown> {
    const file = path.resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales',
        locale,
        `${namespace}.json`
    );
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Walk a dotted key through a parsed locale object. */
function at(source: Record<string, unknown>, dotted: string): string {
    const value = dotted
        .split('.')
        .reduce<unknown>(
            (node, part) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[part]
                    : undefined,
            source
        );
    if (typeof value !== 'string') throw new Error(`Missing key ${dotted}`);
    return value;
}

describe('HOS-2553 declined sign-up action copy', () => {
    // A declined sign-up never started a plan, so the copy cannot threaten to take one away.
    const LOSE_PLAN = {
        es: /perder tu plan|plan siga activo/i,
        en: /lose your plan|plan stays active/i,
        pt: /perder seu plano|plano continue ativo/i
    } as const;
    const RETRY = { es: /intent/i, en: /try/i, pt: /tent/i } as const;
    // The host dashboard no longer carries a plan widget (D19), so the account card is
    // the one place this copy lives.
    const KEYS = [['account', 'pages.dashboard.stats.chargeDeclinedAction']] as const;

    it.each(
        (['es', 'en', 'pt'] as const).flatMap((locale) =>
            KEYS.map(([namespace, key]) => [locale, namespace, key] as const)
        )
    )('%s %s.%s offers a retry and does not speak of losing a plan', (locale, namespace, key) => {
        const copy = at(readLocale(locale, namespace), key);
        expect(copy).not.toMatch(LOSE_PLAN[locale]);
        expect(copy).toMatch(RETRY[locale]);
    });
});
