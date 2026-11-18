import { HostTradeCategoryModel } from '@repo/db';
import type { PublicHostTradeCatalog } from '@repo/schemas';
import { PublicHostTradeCatalogSchema, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeCategoryService } from '../../../src/services/host-trade-category/host-trade-category.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const names = (es: string) => ({ es, en: es, pt: es });

/**
 * The model owns the filtering and ordering (one joined query, covered by the
 * DB integration test). The service contract: no permission, one model call,
 * output validated against the public schema.
 */
const catalog: PublicHostTradeCatalog = {
    groups: [
        {
            slug: 'instalaciones',
            nameI18n: names('Instalaciones'),
            displayWeight: 10,
            categories: [
                {
                    id: getMockId('hostTradeCategory', 'a'),
                    slug: 'plomeria',
                    nameI18n: names('Plomeria'),
                    displayWeight: 10,
                    keywordsI18n: { es: ['canerias'] }
                },
                {
                    id: getMockId('hostTradeCategory', 'b'),
                    slug: 'gas',
                    nameI18n: names('Gas'),
                    displayWeight: 20,
                    keywordsI18n: {}
                }
            ]
        },
        {
            slug: 'mantenimiento',
            nameI18n: names('Mantenimiento'),
            displayWeight: 20,
            categories: [
                {
                    id: getMockId('hostTradeCategory', 'c'),
                    slug: 'pintura',
                    nameI18n: names('Pintura'),
                    displayWeight: 10,
                    keywordsI18n: {}
                }
            ]
        }
    ]
};

describe('HostTradeCategoryService.getPublicCatalog', () => {
    let service: HostTradeCategoryService;
    let model: HostTradeCategoryModel;

    beforeEach(() => {
        model = createTypedModelMock(HostTradeCategoryModel, ['findPublicCatalog']);
        service = new HostTradeCategoryService({ logger: createLoggerMock() }, model);
        vi.clearAllMocks();
    });

    it('should serve a guest actor with no permissions', async () => {
        asMock(model.findPublicCatalog).mockResolvedValue(catalog);

        const result = await service.getPublicCatalog(createActor({ permissions: [] }));

        expect(result.error).toBeUndefined();
        expect(result.data?.groups).toHaveLength(2);
    });

    it('should read the catalog with exactly one model call', async () => {
        asMock(model.findPublicCatalog).mockResolvedValue(catalog);

        await service.getPublicCatalog(createActor({ permissions: [] }));

        expect(model.findPublicCatalog).toHaveBeenCalledTimes(1);
    });

    it('should keep the order the model returns (group weight, then category weight)', async () => {
        asMock(model.findPublicCatalog).mockResolvedValue(catalog);

        const result = await service.getPublicCatalog(createActor({ permissions: [] }));

        expect(result.data?.groups.map((g) => g.slug)).toEqual(['instalaciones', 'mantenimiento']);
        expect(result.data?.groups[0]?.categories.map((c) => c.slug)).toEqual(['plomeria', 'gas']);
    });

    it('should return an empty catalog when nothing is active (empty groups omitted by the model)', async () => {
        asMock(model.findPublicCatalog).mockResolvedValue({ groups: [] });

        const result = await service.getPublicCatalog(createActor({ permissions: [] }));

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ groups: [] });
    });

    it('should return output that passes PublicHostTradeCatalogSchema', async () => {
        asMock(model.findPublicCatalog).mockResolvedValue(catalog);

        const result = await service.getPublicCatalog(createActor({ permissions: [] }));

        expect(() => PublicHostTradeCatalogSchema.parse(result.data)).not.toThrow();
    });

    it('should not leak a field the public schema does not declare', async () => {
        const leaky = {
            groups: [
                {
                    ...catalog.groups[0],
                    adminInfo: { secret: true },
                    categories: [{ ...catalog.groups[0]?.categories[0], deletedAt: null }]
                }
            ]
        };
        asMock(model.findPublicCatalog).mockResolvedValue(leaky as never);

        const result = await service.getPublicCatalog(createActor({ permissions: [] }));

        expect(result.data?.groups[0]).not.toHaveProperty('adminInfo');
        expect(result.data?.groups[0]?.categories[0]).not.toHaveProperty('deletedAt');
    });

    it('should answer a typed error (not a throw) when the model returns a malformed shape', async () => {
        asMock(model.findPublicCatalog).mockResolvedValue({ groups: [{ slug: 1 }] } as never);

        const result = await service.getPublicCatalog(createActor({ permissions: [] }));

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBeDefined();
        expect(result.error?.code).not.toBe(ServiceErrorCode.FORBIDDEN);
    });
});
