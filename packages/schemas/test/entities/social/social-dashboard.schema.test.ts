/**
 * Tests for SocialDashboardResponseSchema's platformBreakdown field and the
 * new SocialDashboardQuerySchema (HOS-66 T-007, G-7).
 *
 * platformBreakdown is additive per the schema-compat policy — a response
 * without it must still be considered invalid only because it's newly
 * required (it's NOT optional, since the service always populates it), but a
 * request query without dateFrom/dateTo must still parse (both optional).
 *
 * @see packages/schemas/src/entities/social/social-dashboard.schema.ts
 */
import { describe, expect, it } from 'vitest';
import {
    SocialDashboardQuerySchema,
    SocialDashboardResponseSchema
} from '../../../src/entities/social/social-dashboard.schema.js';

function makeBaseResponse(overrides: Record<string, unknown> = {}) {
    return {
        kpis: {
            totalPosts: 10,
            pendingReview: 2,
            scheduled: 1,
            publishedLast30Days: 3,
            failedActionNeeded: 0
        },
        quickApprovalQueue: [],
        recentFailures: [],
        makeWebhookConfigured: true,
        platformBreakdown: [
            { platform: 'INSTAGRAM', count: 5 },
            { platform: 'FACEBOOK', count: 3 },
            { platform: 'X', count: 2 }
        ],
        ...overrides
    };
}

describe('SocialDashboardResponseSchema', () => {
    it('parses a response with platformBreakdown', () => {
        const result = SocialDashboardResponseSchema.safeParse(makeBaseResponse());
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.platformBreakdown).toHaveLength(3);
        }
    });

    it('rejects a response missing platformBreakdown (always populated by the service)', () => {
        const { platformBreakdown: _drop, ...withoutBreakdown } = makeBaseResponse();
        const result = SocialDashboardResponseSchema.safeParse(withoutBreakdown);
        expect(result.success).toBe(false);
    });
});

describe('SocialDashboardQuerySchema', () => {
    it('parses an empty query (both bounds optional, backward compatible)', () => {
        const result = SocialDashboardQuerySchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('parses dateFrom/dateTo as ISO date strings coerced to Date', () => {
        const result = SocialDashboardQuerySchema.safeParse({
            dateFrom: '2026-06-01T00:00:00Z',
            dateTo: '2026-06-30T23:59:59Z'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.dateFrom).toBeInstanceOf(Date);
            expect(result.data.dateTo).toBeInstanceOf(Date);
        }
    });

    it('rejects an invalid date string', () => {
        const result = SocialDashboardQuerySchema.safeParse({ dateFrom: 'not-a-date' });
        expect(result.success).toBe(false);
    });
});
