/**
 * Factory builder for PoiCategory, for use in tests.
 * Ensures all required fields are present and provides sensible defaults.
 */
import type { PoiCategory, PoiCategoryIdType, UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class PoiCategoryFactoryBuilder {
    private poiCategory: PoiCategory;

    constructor() {
        this.poiCategory = {
            id: getMockId('poiCategory') as PoiCategoryIdType,
            slug: 'museum',
            nameI18n: { es: 'Museo', en: 'Museum', pt: 'Museu' },
            translationMeta: null,
            icon: '🏛️',
            displayWeight: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: { favorite: false }
        };
    }

    with(values: Partial<PoiCategory>): PoiCategoryFactoryBuilder {
        this.poiCategory = { ...this.poiCategory, ...values };
        return this;
    }

    build(): PoiCategory {
        return { ...this.poiCategory };
    }

    static create(values: Partial<PoiCategory> = {}): PoiCategory {
        return new PoiCategoryFactoryBuilder().with(values).build();
    }
}
