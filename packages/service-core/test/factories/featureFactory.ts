import type { FeatureId, FeatureType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { getMockId } from './utilsFactory';

/**
 * Factory builder for FeatureType, for use in tests.
 * Ensures all required fields are present and provides sensible defaults.
 */
export class FeatureFactoryBuilder {
    private feature: FeatureType;

    constructor() {
        this.feature = {
            id: getMockId('feature') as FeatureId,
            slug: 'test-feature',
            name: 'Test Feature',
            description: 'A test feature',
            icon: '⭐',
            isBuiltin: false,
            isFeatured: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: { favorite: false }
        };
    }

    with(values: Partial<FeatureType>): FeatureFactoryBuilder {
        this.feature = { ...this.feature, ...values };
        return this;
    }

    build(): FeatureType {
        return { ...this.feature };
    }

    static create(values: Partial<FeatureType> = {}): FeatureType {
        return new FeatureFactoryBuilder().with(values).build();
    }
}
