import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DASHBOARD_PLAN_SLUGS,
    parsePlanNames,
    resolveDashboardPlanStat
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
