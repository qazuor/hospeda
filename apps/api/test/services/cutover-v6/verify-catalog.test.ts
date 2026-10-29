/**
 * Unit tests for the step 3a catalog verifier (HOS-1957 G8, AC:CORTE:8).
 */
import { VERTICAL_ACTIVATION_EVENT_BY_VERTICAL, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type {
    CatalogSnapshot,
    Gr3Result
} from '../../../src/services/cutover-v6/verify-catalog.js';
import {
    buildGr3Candidates,
    verifyCatalog
} from '../../../src/services/cutover-v6/verify-catalog.js';

const NOW = new Date('2026-11-01T00:00:00Z');

const VERTICAL_DEADLINES = {
    '1': { days: 90 },
    '2': { days: 180 },
    '3': { months: 1 },
    '4': { beforeArchiveDays: 7, beforeDeletionDays: 7 },
    '5': { daysBefore: [30, 14, 7, 1] },
    '6': { daysAfter: [1, 3, 7, 14, 30] },
    '7': { days: 7 },
    '8': { days: 7 },
    '9': { days: 7 }
};
const BILLING_DEADLINES = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 },
    '20': { daysBefore: [3, 1] }
};

/** A catalog that satisfies every check. */
function goodSnapshot(): CatalogSnapshot {
    const verticals = Object.values(VerticalEnum);
    const plans = verticals.flatMap((v) => [
        { id: `${v}-trial`, vertical: v, slug: 'trial', role: 'trial' },
        { id: `${v}-pre`, vertical: v, slug: 'pre-trial', role: 'pre_trial' },
        { id: `${v}-floor`, vertical: v, slug: 'floor', role: 'floor' },
        { id: `${v}-pro`, vertical: v, slug: 'pro', role: null }
    ]);
    const versions = plans.map((p) => ({
        id: `${p.id}-v1`,
        planId: p.id,
        vertical: p.vertical,
        rank: 1,
        sellable: p.role === null,
        current: true,
        graceDays: 10,
        trialDays: 0,
        allowsPause: false,
        inheritsTouristVip: false
    }));
    return {
        now: NOW,
        verticals: verticals.map((id) => ({
            id,
            activationEvent:
                (VERTICAL_ACTIVATION_EVENT_BY_VERTICAL as Record<string, string | null>)[id] ?? null
        })),
        plans,
        versions,
        entitlements: [],
        limits: [],
        billingOptions: versions
            .filter((v) => v.sellable)
            .map((v) => ({
                planVersionId: v.id,
                cycle: 'monthly',
                amount: 18000,
                currency: 'ARS'
            })),
        addons: [{ id: 'a1', slug: 'boost' }],
        addonVersions: [{ id: 'a1v1', addonId: 'a1' }],
        addonProducts: [
            {
                id: 'p1',
                addonId: 'a1',
                versionId: 'a1v1',
                price: 5000,
                chargeKind: 'UNA_VEZ',
                cycle: null,
                compatibleVerticals: ['accommodation']
            }
        ],
        promoCodes: [
            {
                code: 'WELCOME',
                effectKind: 'DISCOUNT',
                extensionDays: null,
                discountKind: 'PERCENTAGE',
                value: 20,
                allVerticals: true,
                verticals: null,
                validFrom: new Date('2026-10-01T00:00:00Z'),
                validUntil: null,
                durationKind: 'FIRST_CHARGE',
                durationCharges: null,
                closedAt: null
            }
        ],
        verticalDeadlines: [{ version: 1, values: VERTICAL_DEADLINES }],
        billingDeadlines: [{ version: 1, values: BILLING_DEADLINES }]
    };
}

function passingGr3(snapshot: CatalogSnapshot): Gr3Result[] {
    return buildGr3Candidates({ snapshot }).map((c) => ({
        planId: c.planId,
        versionId: c.versionId,
        vertical: c.vertical,
        slug: c.slug,
        message: null
    }));
}

function run(snapshot: CatalogSnapshot, gr3Results = passingGr3(snapshot)) {
    return verifyCatalog({ snapshot, gr3Results });
}

function failing(result: ReturnType<typeof run>): string[] {
    return result.checks.filter((c) => !c.ok).map((c) => c.id);
}

describe('verifyCatalog', () => {
    it('passes a complete catalog and reports its prices', () => {
        // Arrange
        const snapshot = goodSnapshot();

        // Act
        const result = run(snapshot);

        // Assert
        expect(failing(result)).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.report.prices).toHaveLength(Object.values(VerticalEnum).length);
        expect(result.report.promoCodesInForce).toBe(1);
    });

    it('RED: fails when the vertical table does not mirror the enum', () => {
        // Arrange
        const snapshot = { ...goodSnapshot(), verticals: goodSnapshot().verticals.slice(1) };

        // Act
        const result = run(snapshot);

        // Assert
        expect(result.ok).toBe(false);
        expect(failing(result)).toContain('enum-mirror');
    });

    it('RED: fails when a vertical lacks its floor plan', () => {
        // Arrange
        const base = goodSnapshot();
        const snapshot = { ...base, plans: base.plans.filter((p) => p.id !== 'tourist-floor') };

        // Act
        const result = run(snapshot);

        // Assert
        expect(failing(result)).toContain('plan-structure');
    });

    it('RED: fails when a plan has two current versions', () => {
        // Arrange
        const base = goodSnapshot();
        const extra = { ...(base.versions[0] as (typeof base.versions)[number]), id: 'dup' };
        const snapshot = { ...base, versions: [...base.versions, extra] };

        // Act
        const result = run(snapshot);

        // Assert
        expect(failing(result)).toContain('plan-structure');
    });

    it('RED: fails and names the plan when G-R3 rejects its current version', () => {
        // Arrange
        const snapshot = goodSnapshot();
        const gr3 = passingGr3(snapshot).map((r) =>
            r.planId === 'venue-floor' ? { ...r, message: 'clave de piso que falta' } : r
        );

        // Act
        const result = run(snapshot, gr3);

        // Assert
        const gr3Check = result.checks.find((c) => c.id === 'g-r3');
        expect(result.ok).toBe(false);
        expect(gr3Check?.failures).toEqual(['venue/floor: clave de piso que falta']);
    });

    it('RED: fails when G-R3 did not run on every plan', () => {
        // Arrange
        const snapshot = goodSnapshot();

        // Act
        const result = run(snapshot, passingGr3(snapshot).slice(1));

        // Assert
        expect(failing(result)).toContain('g-r3');
    });

    it('RED: fails when a sellable current version has no price', () => {
        // Arrange
        const base = goodSnapshot();
        const snapshot = { ...base, billingOptions: base.billingOptions.slice(1) };

        // Act
        const result = run(snapshot);

        // Assert
        expect(failing(result)).toContain('prices');
    });

    it('RED: fails on a non-positive price', () => {
        // Arrange
        const base = goodSnapshot();
        const [first, ...rest] = base.billingOptions;
        const snapshot = {
            ...base,
            billingOptions: [{ ...(first as (typeof rest)[number]), amount: 0 }, ...rest]
        };

        // Act / Assert
        expect(failing(run(snapshot))).toContain('prices');
    });

    it('RED: fails when an add-on has no product', () => {
        // Arrange
        const snapshot = { ...goodSnapshot(), addonProducts: [] };

        // Act / Assert
        expect(failing(run(snapshot))).toContain('addons');
    });

    it('RED: fails when a promo in force names an unknown vertical', () => {
        // Arrange
        const base = goodSnapshot();
        const promo = {
            ...(base.promoCodes[0] as (typeof base.promoCodes)[number]),
            allVerticals: false,
            verticals: ['cafeteria']
        };

        // Act / Assert
        expect(failing(run({ ...base, promoCodes: [promo] }))).toContain('promo-codes');
    });

    it('ignores a closed promo even if it is malformed', () => {
        // Arrange
        const base = goodSnapshot();
        const promo = {
            ...(base.promoCodes[0] as (typeof base.promoCodes)[number]),
            discountKind: null,
            closedAt: new Date('2026-10-15T00:00:00Z')
        };

        // Act
        const result = run({ ...base, promoCodes: [promo] });

        // Assert
        expect(result.checks.find((c) => c.id === 'promo-codes')?.ok).toBe(true);
        expect(result.report.promoCodesInForce).toBe(0);
    });

    it('RED: fails when deadline version 1 is missing', () => {
        // Arrange
        const snapshot = { ...goodSnapshot(), verticalDeadlines: [] };

        // Act / Assert
        expect(failing(run(snapshot))).toContain('deadlines');
    });

    it('RED: fails when the archive deadline is not before the deletion deadline', () => {
        // Arrange
        const snapshot = {
            ...goodSnapshot(),
            verticalDeadlines: [
                { version: 1, values: { ...VERTICAL_DEADLINES, '1': { days: 400 } } }
            ]
        };

        // Act / Assert
        expect(failing(run(snapshot))).toContain('deadlines');
    });
});

describe('buildGr3Candidates', () => {
    it('maps the current version rows to the publish content', () => {
        // Arrange
        const base = goodSnapshot();
        const snapshot = {
            ...base,
            entitlements: [
                { planVersionId: 'tourist-floor-v1', key: 'ai_chat', planQuota: 10, trialQuota: 10 }
            ],
            limits: [{ planVersionId: 'tourist-floor-v1', key: 'max_favorites', value: 5 }]
        };

        // Act
        const candidate = buildGr3Candidates({ snapshot }).find(
            (c) => c.planId === 'tourist-floor'
        );

        // Assert
        expect(candidate?.content.entitlements).toEqual([
            { key: 'ai_chat', planQuota: 10, trialQuota: 10 }
        ]);
        expect(candidate?.content.limits).toEqual([{ key: 'max_favorites', value: 5 }]);
        expect(candidate?.content.sellable).toBe(false);
    });

    it('skips a plan without exactly one current version', () => {
        // Arrange
        const base = goodSnapshot();
        const snapshot = {
            ...base,
            versions: base.versions.map((v) =>
                v.planId === 'venue-pro' ? { ...v, current: false } : v
            )
        };

        // Act
        const ids = buildGr3Candidates({ snapshot }).map((c) => c.planId);

        // Assert
        expect(ids).not.toContain('venue-pro');
    });
});
