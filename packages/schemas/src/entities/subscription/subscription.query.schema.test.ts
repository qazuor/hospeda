import { describe, expect, it } from 'vitest';
import { SubscriptionStatusEnum } from '../../enums/subscription-status.enum.js';
import {
    SubscriptionListQuerySchema,
    SubscriptionQuerySchema,
    SubscriptionStatsQuerySchema
} from './subscription.query.schema.js';

describe('SubscriptionQuerySchema', () => {
    it('should validate a full query with all options', () => {
        const fullQuery = {
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            status: SubscriptionStatusEnum.ACTIVE,
            statuses: [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.PAUSED],
            startAtFrom: '2024-01-01',
            startAtTo: '2024-12-31',
            hasActiveTrial: true,
            isActive: true,
            page: 2,
            pageSize: 50,
            sortBy: 'startAt',
            sortOrder: 'asc'
        };

        const result = SubscriptionQuerySchema.safeParse(fullQuery);
        expect(result.success).toBe(true);
    });

    it('should apply defaults for pagination and sorting', () => {
        const minimalQuery = {};

        const result = SubscriptionQuerySchema.safeParse(minimalQuery);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBe(20);
            expect(result.data.sortBy).toBe('createdAt');
            expect(result.data.sortOrder).toBe('desc');
            expect(result.data.includeDeleted).toBe(false);
        }
    });

    it('should validate page and pageSize ranges', () => {
        const invalidPageQuery = {
            page: 0,
            pageSize: 150
        };

        const result = SubscriptionQuerySchema.safeParse(invalidPageQuery);
        expect(result.success).toBe(false);
    });

    it('should coerce date strings to Date objects', () => {
        const dateQuery = {
            startAtFrom: '2024-01-01',
            createdAfter: '2024-06-01T10:00:00Z'
        };

        const result = SubscriptionQuerySchema.safeParse(dateQuery);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startAtFrom).toBeInstanceOf(Date);
            expect(result.data.createdAfter).toBeInstanceOf(Date);
        }
    });
});

describe('SubscriptionListQuerySchema', () => {
    it('should validate a simple list query', () => {
        const listQuery = {
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            status: SubscriptionStatusEnum.ACTIVE,
            page: 1,
            pageSize: 10
        };

        const result = SubscriptionListQuerySchema.safeParse(listQuery);
        expect(result.success).toBe(true);
    });

    it('should only include picked fields', () => {
        const queryWithExtraFields = {
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            status: SubscriptionStatusEnum.ACTIVE,
            hasActiveTrial: true, // This should be filtered out
            page: 1
        };

        const result = SubscriptionListQuerySchema.safeParse(queryWithExtraFields);
        expect(result.success).toBe(true);
        if (result.success) {
            expect('hasActiveTrial' in result.data).toBe(false);
        }
    });
});

describe('SubscriptionStatsQuerySchema', () => {
    it('should validate a stats query', () => {
        const statsQuery = {
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            dateFrom: '2024-01-01',
            dateTo: '2024-12-31',
            groupBy: 'month'
        };

        const result = SubscriptionStatsQuerySchema.safeParse(statsQuery);
        expect(result.success).toBe(true);
    });

    it('should apply default groupBy', () => {
        const minimalStatsQuery = {};

        const result = SubscriptionStatsQuerySchema.safeParse(minimalStatsQuery);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.groupBy).toBe('status');
        }
    });
});
