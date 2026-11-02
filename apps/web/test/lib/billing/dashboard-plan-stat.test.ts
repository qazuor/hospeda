import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DASHBOARD_PLAN_SLUGS,
    parsePlanNames,
    resolveDashboardPlanStat,
    resolveDashboardTrialStat
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
        ['CANCEL_SCHEDULED', 'cancel-scheduled']
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
