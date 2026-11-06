/**
 * @file venue.public-search.test.ts
 * @description Unit tests for the public venue search `businessLine` filter
 * (HOS-1787 leaf 6.8).
 *
 * The filter reaches the model twice: once in the page query
 * (`findAllWithRelations`) and once in the count query, so the paginated total
 * matches the filtered page. `business_lines` is `text[]`, so it MUST leave the
 * scalar spread (the generic builder would emit `eq(text[], 'food')`) and ride
 * `additionalConditions` as the `@>` clause from `@repo/db`.
 *
 * The model is mocked here; row-level behaviour is the real-DB integration suite.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../../src/types';

// HOS-1499: listing writes live behind a transaction; nothing here writes, but
// the module graph expects the doubles.
vi.mock('../../../src/utils/transaction', async () => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return { withServiceTransaction: vi.fn(doubles.fakeWithServiceTransaction) };
});
vi.mock('@repo/db', async (importOriginal) => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...(await importOriginal<object>()),
        domainEventModel: doubles.domainEventModelDouble
    };
});

import { PgDialect } from 'drizzle-orm/pg-core';
import { VenueService } from '../../../src/services/venue/venue.service';
import { asMock } from '../../utils/test-utils';

class MockVenueModel {
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
}

const guestActor: Actor = {
    id: '00000000-0000-4000-a000-00000000ff01',
    roles: [],
    permissions: []
};

const FEATURE = '11111111-1111-4111-8111-111111111111';
const dialect = new PgDialect();

/** Compiles one `additionalConditions` entry back to SQL text. */
function sqlOf(condition: unknown): string {
    return dialect.sqlToQuery(condition as Parameters<typeof dialect.sqlToQuery>[0]).sql;
}

/** Where clause of the first `findAllWithRelations` call. */
function searchWhere(call: unknown[] | undefined): Record<string, unknown> {
    return (call?.[1] as Record<string, unknown> | undefined) ?? {};
}

/** Additional conditions of the first `findAllWithRelations` call. */
function searchConditions(call: unknown[] | undefined): unknown[] | undefined {
    return call?.[3] as unknown[] | undefined;
}

describe('VenueService public search: businessLine filter (HOS-1787 6.8)', () => {
    let mockModel: MockVenueModel;
    let service: VenueService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel = new MockVenueModel();
        mockModel.findAllWithRelations.mockResolvedValue({ items: [], total: 0 });
        mockModel.count.mockResolvedValue(0);
        service = new VenueService({});
        Object.defineProperty(service, 'model', { value: mockModel });
    });

    it('keeps businessLine out of the where clause and applies one condition', async () => {
        const result = await service.search(guestActor, {
            page: 1,
            pageSize: 10,
            businessLine: 'nightlife'
        });
        expect(result.error).toBeUndefined();

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(searchWhere(call)).not.toHaveProperty('businessLine');
        expect(searchWhere(call)).toEqual(
            expect.objectContaining({
                deletedAt: null,
                publicationStatus: PublicationStatusEnum.PUBLISHED
            })
        );
        expect(searchConditions(call)).toHaveLength(1);
        expect(sqlOf(searchConditions(call)?.[0])).toContain('business_lines');
    });

    it('combines businessLine with the features filter as two conditions', async () => {
        await service.search(guestActor, {
            page: 1,
            pageSize: 10,
            businessLine: 'food',
            features: [FEATURE]
        });

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(searchWhere(call)).not.toHaveProperty('businessLine');
        expect(searchWhere(call)).not.toHaveProperty('features');
        expect(searchConditions(call)).toHaveLength(2);
        const sqlTexts = (searchConditions(call) ?? []).map(sqlOf);
        expect(sqlTexts.some((sql) => sql.includes('business_lines'))).toBe(true);
        expect(sqlTexts.some((sql) => sql.includes('r_venue_feature'))).toBe(true);
    });

    it('applies the same businessLine condition to the count query', async () => {
        await service.count(guestActor, { page: 1, pageSize: 10, businessLine: 'nightlife' });

        const call = asMock(mockModel.count).mock.calls[0] as unknown[];
        const where = call[0] as Record<string, unknown>;
        const options = call[1] as { additionalConditions?: unknown[] };

        expect(where).not.toHaveProperty('businessLine');
        expect(options.additionalConditions).toHaveLength(1);
        expect(sqlOf(options.additionalConditions?.[0])).toContain('business_lines');
    });

    it('passes undefined — not an empty array — when no businessLine is requested', async () => {
        await service.search(guestActor, { page: 1, pageSize: 10 });

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(searchConditions(call)).toBeUndefined();
    });
});
