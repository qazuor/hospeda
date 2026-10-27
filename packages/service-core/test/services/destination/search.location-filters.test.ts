/**
 * HOS-1899: `country` / `state` / `city` are keys of the `location` JSONB column, not
 * columns. They used to be put in the `where` record, where `buildWhereClause` skipped
 * them (filter ignored) or threw when they were the only keys (HTTP 500). These tests
 * assert on what the service HANDS TO THE MODEL, for search, count and searchForList.
 */
import { type DestinationModel, destinations } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { buildDestinationLocationConditions } from '../../../src/services/destination/destination.location-filters';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

/** Renders one condition to SQL text plus bound params. */
const render = (condition: unknown) => new PgDialect().sqlToQuery(condition as SQL);

describe('destination location filters (HOS-1899)', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        model = createModelMock();
        model.findAll = vi.fn().mockResolvedValue({ items: [], total: 0 });
        model.count = vi.fn().mockResolvedValue(0);
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
        vi.clearAllMocks();
    });

    describe('buildDestinationLocationConditions', () => {
        it('returns nothing when no filter is given or the value is blank', () => {
            expect(buildDestinationLocationConditions({})).toEqual([]);
            expect(buildDestinationLocationConditions({ city: '   ' })).toEqual([]);
        });

        it('compares the matching location key case-insensitively', () => {
            const [condition] = buildDestinationLocationConditions({ city: ' CDU ' });
            const { sql, params } = render(condition);

            expect(sql).toContain(`lower("destinations"."location"->>$1) = $2`);
            expect(params).toEqual(['city', 'cdu']);
        });

        it('emits one condition per filter, in country, state, city order', () => {
            const conditions = buildDestinationLocationConditions({
                city: 'a',
                state: 'b',
                country: 'c'
            });

            expect(conditions.map((c) => render(c).params[0])).toEqual([
                'country',
                'state',
                'city'
            ]);
        });
    });

    describe('search', () => {
        it('hands the location conditions to model.findAll and keeps them out of where', async () => {
            await service.search(actor, { city: 'CDU', country: 'AR', page: 1, pageSize: 10 });

            const [where, , additional] = (model.findAll as Mock).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                SQL[] | undefined
            ];
            expect(where).not.toHaveProperty('city');
            expect(where).not.toHaveProperty('country');
            expect(additional?.map((c) => render(c).params)).toEqual([
                ['country', 'ar'],
                ['city', 'cdu']
            ]);
        });

        it('keeps the text search condition next to the location conditions', async () => {
            model.getTable = vi.fn().mockReturnValue(destinations);

            await service.search(actor, { q: 'rio', city: 'CDU', page: 1, pageSize: 10 });

            const additional = (model.findAll as Mock).mock.calls[0]?.[2] as SQL[];
            expect(additional).toHaveLength(2);
            expect(additional.map((c) => render(c).sql).join(' ')).toContain(
                'lower("destinations"."location"->>$'
            );
        });

        it('passes no additional conditions when no location filter is set', async () => {
            await service.search(actor, { isFeatured: true, page: 1, pageSize: 10 });

            expect((model.findAll as Mock).mock.calls[0]?.[2]).toBeUndefined();
        });
    });

    describe('count', () => {
        it('hands the SAME location conditions to model.count so totals agree', async () => {
            await service.count(actor, { city: 'CDU', country: 'AR', page: 1, pageSize: 10 });

            const [where, options] = (model.count as Mock).mock.calls[0] as [
                Record<string, unknown>,
                { additionalConditions?: SQL[] } | undefined
            ];
            expect(where).toEqual({});
            expect(options?.additionalConditions?.map((c) => render(c).params)).toEqual([
                ['country', 'ar'],
                ['city', 'cdu']
            ]);
        });
    });

    describe('searchForList', () => {
        it('hands the location conditions to model.findAll', async () => {
            await service.searchForList(actor, { state: 'ER', page: 1, pageSize: 10 });

            const [where, , additional] = (model.findAll as Mock).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                SQL[] | undefined
            ];
            expect(where).not.toHaveProperty('state');
            expect(additional?.map((c) => render(c).params)).toEqual([['state', 'er']]);
        });
    });
});
