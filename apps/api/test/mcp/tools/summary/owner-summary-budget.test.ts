/**
 * HOS-2331 (AC-C32) — `fitSummaryToBudget`: the serialized summary is never
 * over the limit. Attention items give way from the least urgent end and are
 * counted; a summary that cannot fit is refused, never returned.
 *
 * @module test/mcp/tools/summary/owner-summary-budget
 */

import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { MyPlanItem } from '../../../../src/mcp/tools/plan/my-plan-types';
import { measureResultChars } from '../../../../src/mcp/tools/response-budget';
import {
    fitSummaryToBudget,
    SUMMARY_INCLUDES_OMITTED
} from '../../../../src/mcp/tools/summary/owner-summary-budget';
import type {
    AttentionItem,
    OwnerSummary,
    VerticalListingCounts
} from '../../../../src/mcp/tools/summary/owner-summary-types';

const zero: VerticalListingCounts = {
    total: 0,
    byStatus: { DRAFT: 0, PUBLISHED: 0, UNPUBLISHED_BY_BILLING: 0, ARCHIVED: 0, MODERATED: 0 }
};

const item = (n: number): AttentionItem => ({
    kind: 'incomplete',
    listing: { id: `id-${n}`, vertical: VerticalEnum.VENUE, name: 'x'.repeat(200) },
    missing: ['summary'],
    actionUrl: `http://localhost:4321/es/mi-cuenta/comercio/venue/id-${n}/editar/`
});

const summaryWith = (count: number): OwnerSummary => ({
    listings: { accommodation: zero, venue: zero, experience: zero },
    metrics: {},
    attention: Array.from({ length: count }, (_, n) => item(n)),
    more: 2
});

describe('fitSummaryToBudget', () => {
    it('returns a summary within the limit unchanged', () => {
        // Arrange
        const summary = summaryWith(3);

        // Act
        const fitted = fitSummaryToBudget({ summary });

        // Assert
        expect(fitted).toBe(summary);
    });

    it('drops attention from the least urgent end until the serialized result fits', () => {
        // Arrange
        const summary = summaryWith(10);
        const maxChars = measureResultChars({ value: summaryWith(4) }) + 50;

        // Act
        const fitted = fitSummaryToBudget({ summary, maxChars });

        // Assert
        expect(fitted).toBeDefined();
        expect(measureResultChars({ value: fitted })).toBeLessThanOrEqual(maxChars);
        expect(fitted?.attention.map((i) => i.listing?.id)).toEqual([
            'id-0',
            'id-1',
            'id-2',
            'id-3'
        ]);
        expect(fitted?.more).toBe(2 + 6);
    });

    it('refuses a summary that is over the limit even with no attention left', () => {
        // Arrange
        const summary = summaryWith(2);
        const maxChars = measureResultChars({ value: summaryWith(0) }) - 1;

        // Act
        const fitted = fitSummaryToBudget({ summary, maxChars });

        // Assert
        expect(fitted).toBeUndefined();
    });
});

/** A plan item with long includes, like a plan with many features. */
const planItem = (vertical: 'accommodation' | 'venue'): MyPlanItem => ({
    vertical,
    verticalLabel: vertical,
    plan: { slug: `${vertical}-pro`, name: 'Pro', version: 'v-1' },
    status: 'ACTIVE',
    trialState: null,
    statusLabel: 'Activa',
    nextChargeAt: null,
    serviceEndsAt: null,
    graceEndsAt: null,
    trialDaysLeft: null,
    includes: {
        entitlements: Array.from({ length: 40 }, (_, n) => `Feature ${n} ${'y'.repeat(40)}`),
        limits: [{ label: 'Fotos por alojamiento', value: 15 }]
    },
    addons: [],
    actionUrl: 'http://localhost:4321/es/mi-cuenta/suscripcion/'
});

const withPlan = (count: number): OwnerSummary => ({
    ...summaryWith(count),
    subscription: { accommodation: planItem('accommodation'), venue: planItem('venue') }
});

describe('fitSummaryToBudget with a subscription block (HOS-2328)', () => {
    it('keeps the block whole when it fits', () => {
        // Arrange
        const summary = withPlan(3);

        // Act
        const fitted = fitSummaryToBudget({ summary });

        // Assert
        expect(fitted).toBe(summary);
    });

    it('over budget, trims the includes of the block before any attention item', () => {
        // Arrange: room for every attention item but not for the full includes
        const summary = withPlan(4);
        const trimmedIncludes = {
            ...summary,
            subscription: {
                accommodation: { ...planItem('accommodation'), includes: SUMMARY_INCLUDES_OMITTED },
                venue: { ...planItem('venue'), includes: SUMMARY_INCLUDES_OMITTED }
            }
        };
        const maxChars = measureResultChars({ value: trimmedIncludes }) + 10;

        // Act
        const fitted = fitSummaryToBudget({ summary, maxChars });

        // Assert
        expect(fitted).toBeDefined();
        expect(measureResultChars({ value: fitted })).toBeLessThanOrEqual(maxChars);
        expect(fitted?.attention).toHaveLength(4);
        expect(fitted?.more).toBe(2);
        expect(fitted?.subscription?.accommodation?.includes).toEqual(SUMMARY_INCLUDES_OMITTED);
        expect(fitted?.subscription?.venue?.includes).toEqual(SUMMARY_INCLUDES_OMITTED);
        expect(fitted?.subscription?.venue?.status).toBe('ACTIVE');
    });

    it('trims attention only after every includes is gone', () => {
        // Arrange
        const summary = withPlan(10);
        const maxChars =
            measureResultChars({
                value: {
                    ...withPlan(3),
                    subscription: {
                        accommodation: {
                            ...planItem('accommodation'),
                            includes: SUMMARY_INCLUDES_OMITTED
                        },
                        venue: { ...planItem('venue'), includes: SUMMARY_INCLUDES_OMITTED }
                    }
                }
            }) + 50;

        // Act
        const fitted = fitSummaryToBudget({ summary, maxChars });

        // Assert
        expect(fitted).toBeDefined();
        expect(measureResultChars({ value: fitted })).toBeLessThanOrEqual(maxChars);
        expect(fitted?.attention.length).toBeLessThan(10);
        expect(fitted?.more).toBe(2 + 10 - (fitted?.attention.length ?? 0));
        expect(fitted?.subscription?.accommodation?.includes).toEqual(SUMMARY_INCLUDES_OMITTED);
    });
});
