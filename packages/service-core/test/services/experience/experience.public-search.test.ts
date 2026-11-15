/**
 * @file experience.public-search.test.ts
 * @description Unit tests for the public experience search `amenities` and
 * `features` filters (HOS-2085).
 *
 * Both filters reach the model twice, in the page query
 * (`findAllWithRelations`) and in the count query, so the paginated total
 * describes the same intersection as its items. They are junction-table
 * filters, so they MUST leave the scalar where clause and ride
 * `additionalConditions` as the clauses from `@repo/db`.
 *
 * The model is mocked here; row-level behaviour is the real-DB integration suite.
 */

import { experiences } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../../src/types';

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
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { asMock } from '../../utils/test-utils';

class MockExperienceModel {
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    getTable = vi.fn(() => experiences);
}

const guestActor: Actor = {
    id: '00000000-0000-4000-a000-00000000ff01',
    roles: [],
    permissions: []
};

const AMENITY = '11111111-1111-4111-8111-111111111111';
const FEATURE = '22222222-2222-4222-8222-222222222222';
const dialect = new PgDialect();

/** Compiles one `additionalConditions` entry back to SQL text and params. */
function compiled(condition: unknown) {
    return dialect.sqlToQuery(condition as Parameters<typeof dialect.sqlToQuery>[0]);
}

describe('ExperienceService public search: amenities and features (HOS-2085)', () => {
    let mockModel: MockExperienceModel;
    let service: ExperienceService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel = new MockExperienceModel();
        mockModel.findAllWithRelations.mockResolvedValue({ items: [], total: 0 });
        mockModel.count.mockResolvedValue(0);
        service = new ExperienceService({});
        Object.defineProperty(service, 'model', { value: mockModel });
    });

    it('applies the amenity filter as one junction condition, outside the where clause', async () => {
        const result = await service.search(guestActor, {
            page: 1,
            pageSize: 10,
            amenities: [AMENITY]
        });
        expect(result.error).toBeUndefined();

        const call = asMock(mockModel.findAllWithRelations).mock.calls[0] as unknown[];
        const where = call[1] as Record<string, unknown>;
        const conditions = call[3] as unknown[];

        expect(where).not.toHaveProperty('amenities');
        expect(where).toEqual(
            expect.objectContaining({
                deletedAt: null,
                publicationStatus: PublicationStatusEnum.PUBLISHED
            })
        );
        expect(conditions).toHaveLength(1);
        const { sql, params } = compiled(conditions[0]);
        expect(sql).toContain('r_experience_amenity');
        expect(params).toContain(AMENITY);
    });

    it('applies the feature filter through r_experience_feature', async () => {
        await service.search(guestActor, { page: 1, pageSize: 10, features: [FEATURE] });

        const call = asMock(mockModel.findAllWithRelations).mock.calls[0] as unknown[];
        const conditions = call[3] as unknown[];

        expect(call[1]).not.toHaveProperty('features');
        expect(conditions).toHaveLength(1);
        expect(compiled(conditions[0]).sql).toContain('r_experience_feature');
    });

    it('requires ALL requested items (intersection, not union)', async () => {
        const second = '33333333-3333-4333-8333-333333333333';
        await service.search(guestActor, {
            page: 1,
            pageSize: 10,
            amenities: [AMENITY, second]
        });

        const call = asMock(mockModel.findAllWithRelations).mock.calls[0] as unknown[];
        const { sql, params } = compiled((call[3] as unknown[])[0]);

        expect(sql).toContain('HAVING COUNT(DISTINCT');
        expect(params).toEqual([AMENITY, second, 2]);
    });

    it('applies the same conditions to the count query', async () => {
        await service.count(guestActor, {
            page: 1,
            pageSize: 10,
            amenities: [AMENITY],
            features: [FEATURE]
        });

        const call = asMock(mockModel.count).mock.calls[0] as unknown[];
        const where = call[0] as Record<string, unknown>;
        const options = call[1] as { additionalConditions?: unknown[] };

        expect(where).not.toHaveProperty('amenities');
        expect(where).not.toHaveProperty('features');
        expect(options.additionalConditions).toHaveLength(2);
    });

    it('passes undefined, not an empty array, when no catalog filter is requested', async () => {
        await service.search(guestActor, { page: 1, pageSize: 10 });

        const call = asMock(mockModel.findAllWithRelations).mock.calls[0] as unknown[];

        expect(call[3]).toBeUndefined();
    });

    it('treats an empty list as no filter, not as match-nothing', async () => {
        await service.search(guestActor, { page: 1, pageSize: 10, amenities: [], features: [] });

        const call = asMock(mockModel.findAllWithRelations).mock.calls[0] as unknown[];

        expect(call[3]).toBeUndefined();
    });
});

describe('HOS-1718 featuredFirst forwarding', () => {
    it('forwards featuredFirst to the model options and never as a filter', async () => {
        const mockModel = new MockExperienceModel();
        mockModel.findAllWithRelations.mockResolvedValue({ items: [], total: 0 });
        mockModel.count.mockResolvedValue(0);
        const service = new ExperienceService({});
        Object.defineProperty(service, 'model', { value: mockModel });

        await service.search(guestActor, { page: 1, pageSize: 10, featuredFirst: true });

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;
        expect(call?.[2]).toMatchObject({ featuredFirst: true });
        const where = (call?.[1] as Record<string, unknown> | undefined) ?? {};
        expect(Object.hasOwn(where, 'featuredFirst')).toBe(false);
    });
});
