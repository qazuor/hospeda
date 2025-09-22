import type { Amenity, AmenityIdType, UserIdType } from '@repo/schemas';
import { AmenitiesTypeEnum, LifecycleStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock AmenityId for use in tests.
 */
export const getMockAmenityId = (id?: string): AmenityIdType =>
    getMockId('amenity', id) as AmenityIdType;

/**
 * Builder for Amenity test objects.
 * Allows fluent creation of amenity test data with sensible defaults.
 */
export class AmenityFactoryBuilder {
    private amenity: Amenity;

    constructor() {
        this.amenity = {
            id: getMockAmenityId(),
            slug: 'test-amenity',
            name: 'Test Amenity',
            type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
            icon: '🛏️',
            description: 'A test amenity',
            isBuiltin: false,
            isFeatured: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: undefined
        };
    }

    with(fields: Partial<Amenity>): this {
        this.amenity = { ...this.amenity, ...fields };
        return this;
    }

    build(): Amenity {
        return { ...this.amenity };
    }

    static create(fields: Partial<Amenity> = {}): Amenity {
        return new AmenityFactoryBuilder().with(fields).build();
    }
}
