/**
 * @fileoverview
 * HostTradeService search, count and admin search with the `categories`
 * filter and page hydration (HOS-919 T-021).
 */

import { HostTradeModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeService } from '../../../src/services/hostTrade/host-trade.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const DEST_ID = getMockId('destination', 'dest-1');
const HT_A = getMockId('user', 'ht-a');
const HT_B = getMockId('user', 'ht-b');

const makeTrade = (id: string, name: string) => ({
    id,
    slug: name.toLowerCase(),
    name,
    contact: '123',
    benefit: '10%',
    destinationId: DEST_ID,
    is24h: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
});

const ref = (slug: string) => ({
    id: getMockId('user', slug),
    slug,
    nameI18n: { es: slug, en: slug, pt: slug },
    groupSlug: 'instalaciones'
});

const actor = createActor({
    permissions: [
        PermissionEnum.HOST_TRADE_VIEW,
        PermissionEnum.HOST_TRADE_VIEW_ALL,
        PermissionEnum.ACCESS_PANEL_ADMIN
    ]
});

const PAGE = { page: 1, pageSize: 10 } as const;

const PREDICATE = sql`/* categories predicate */ true`;

describe('HostTradeService categories filter and hydration', () => {
    let service: HostTradeService;
    let model: HostTradeModel;

    beforeEach(() => {
        model = createTypedModelMock(HostTradeModel, [
            'findAll',
            'count',
            'buildCategoriesFilterCondition',
            'hydrateCategories',
            'getTable'
        ]);
        asMock(model.buildCategoriesFilterCondition).mockReturnValue(PREDICATE);
        asMock(model.hydrateCategories).mockResolvedValue(new Map());
        asMock(model.getTable).mockReturnValue({ createdAt: {}, deletedAt: {} });
        service = new HostTradeService({ logger: createLoggerMock() }, model);
        vi.clearAllMocks();
        asMock(model.buildCategoriesFilterCondition).mockReturnValue(PREDICATE);
        asMock(model.hydrateCategories).mockResolvedValue(new Map());
        asMock(model.getTable).mockReturnValue({ createdAt: {}, deletedAt: {} });
    });

    describe('search', () => {
        it('should translate categories into the model predicate and not into the where map', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });

            const result = await service.search(actor, {
                ...PAGE,
                categories: ['plomeria', 'pintura']
            });

            expect(result.error).toBeUndefined();
            expect(model.buildCategoriesFilterCondition).toHaveBeenCalledWith({
                categorySlugs: ['plomeria', 'pintura']
            });
            const [where, , conditions] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(where).not.toHaveProperty('category');
            expect(where).not.toHaveProperty('categories');
            expect(conditions).toEqual([PREDICATE]);
        });

        it('should ignore the deprecated single category param', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });

            await service.search(actor, { ...PAGE, category: 'PLOMERIA' as never });

            const [where] = asMock(model.findAll).mock.calls[0] as [Record<string, unknown>];
            expect(where).not.toHaveProperty('category');
        });

        it('should add no condition when the filter is absent', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });

            await service.search(actor, { ...PAGE, destinationId: DEST_ID });

            expect(model.buildCategoriesFilterCondition).not.toHaveBeenCalled();
            const [where, , conditions] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(where).toMatchObject({ destinationId: DEST_ID });
            expect(conditions).toBeUndefined();
        });

        it('should treat an empty categories value as no filter (not as match-nothing)', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });

            await service.search(actor, { ...PAGE, categories: [] });

            expect(model.buildCategoriesFilterCondition).not.toHaveBeenCalled();
        });

        it('should return an empty page without hydrating when only unknown slugs match nothing', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });

            const result = await service.search(actor, { ...PAGE, categories: ['no-existe'] });

            expect(result.data?.items).toEqual([]);
            expect(model.hydrateCategories).not.toHaveBeenCalled();
        });

        it('should hydrate the whole page with ONE batched call and attach categories', async () => {
            asMock(model.findAll).mockResolvedValue({
                items: [makeTrade(HT_A, 'Ana'), makeTrade(HT_B, 'Beto')],
                total: 2
            });
            asMock(model.hydrateCategories).mockResolvedValue(
                new Map([[HT_A, [ref('plomeria'), ref('gas')]]])
            );

            const result = await service.search(actor, { ...PAGE });

            expect(model.hydrateCategories).toHaveBeenCalledTimes(1);
            expect(model.hydrateCategories).toHaveBeenCalledWith(
                expect.objectContaining({ hostTradeIds: [HT_A, HT_B] })
            );
            const items = result.data?.items ?? [];
            expect(items[0]?.categories.map((c) => c.slug)).toEqual(['plomeria', 'gas']);
            expect(items[1]?.categories).toEqual([]);
        });
    });

    describe('count', () => {
        it('should apply the same categories predicate as the list', async () => {
            asMock(model.count).mockResolvedValue(3);

            const result = await service.count(actor, {
                ...PAGE,
                categories: ['plomeria', 'pintura']
            });

            expect(result.data?.count).toBe(3);
            expect(model.buildCategoriesFilterCondition).toHaveBeenCalledWith({
                categorySlugs: ['plomeria', 'pintura']
            });
            const [where, options] = asMock(model.count).mock.calls[0] as [
                Record<string, unknown>,
                { additionalConditions?: unknown[] }
            ];
            expect(where).not.toHaveProperty('category');
            expect(options.additionalConditions).toEqual([PREDICATE]);
        });

        it('should keep count equal to the list length for the same filter', async () => {
            const items = [makeTrade(HT_A, 'Ana'), makeTrade(HT_B, 'Beto')];
            asMock(model.findAll).mockResolvedValue({ items, total: items.length });
            asMock(model.count).mockResolvedValue(items.length);

            const list = await service.search(actor, { ...PAGE, categories: ['plomeria'] });
            const count = await service.count(actor, { ...PAGE, categories: ['plomeria'] });

            expect(count.data?.count).toBe(list.data?.items.length);
        });
    });

    describe('adminList', () => {
        it('should turn categories into the predicate and drop both category keys from the where map', async () => {
            asMock(model.findAll).mockResolvedValue({
                items: [makeTrade(HT_A, 'Ana')],
                total: 1
            });

            const result = await service.adminList(actor, {
                categories: ['plomeria'],
                category: 'PLOMERIA' as never
            });

            expect(result.error).toBeUndefined();
            const [where, , conditions] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(where).not.toHaveProperty('category');
            expect(where).not.toHaveProperty('categories');
            expect(conditions).toEqual([PREDICATE]);
        });

        it('should hydrate the admin page with one batched call', async () => {
            asMock(model.findAll).mockResolvedValue({
                items: [makeTrade(HT_A, 'Ana'), makeTrade(HT_B, 'Beto')],
                total: 2
            });
            asMock(model.hydrateCategories).mockResolvedValue(new Map([[HT_B, [ref('pintura')]]]));

            const result = await service.adminList(actor, {});

            expect(model.hydrateCategories).toHaveBeenCalledTimes(1);
            expect(result.data?.items[1]?.categories.map((c) => c.slug)).toEqual(['pintura']);
        });
    });
});
