import type { AmenityId, AmenityType, UserId } from '@repo/types';
import { AmenitiesTypeEnum } from '@repo/types/enums/amenity-type.enum';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { getMockId } from './utilsFactory';

/**
 * Builder for AmenityType test objects.
 * Allows fluent creation of amenity test data with sensible defaults.
 */
export class AmenityFactoryBuilder {
    private amenity: AmenityType;

    constructor() {
        this.amenity = {
            id: getMockId('feature') as AmenityId,
            slug: 'test-amenity',
            name: 'Test Amenity',
            type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
            icon: '🛏️',
            description: 'A test amenity',
            isBuiltin: false,
            isFeatured: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: undefined
        };
    }

    with(fields: Partial<AmenityType>): this {
        this.amenity = { ...this.amenity, ...fields };
        return this;
    }

    build(): AmenityType {
        return { ...this.amenity };
    }

    static create(fields: Partial<AmenityType> = {}): AmenityType {
        return new AmenityFactoryBuilder().with(fields).build();
    }
}
