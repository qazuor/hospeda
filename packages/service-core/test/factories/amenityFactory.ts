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
 *
 * The `name` and `description` fields are now I18nText objects (`{es, en, pt}`)
 * matching the JSONB DB column. All three locales default to the same test value
 * as a placeholder (real translations are a content task).
 */
export class AmenityFactoryBuilder {
    private amenity: Amenity;

    constructor() {
        this.amenity = {
            id: getMockAmenityId(),
            slug: 'test-amenity',
            name: { es: 'Test Amenity', en: 'Test Amenity', pt: 'Test Amenity' },
            type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
            icon: '🛏️',
            description: {
                es: 'A test amenity description',
                en: 'A test amenity description',
                pt: 'A test amenity description'
            },
            isBuiltin: false,
            isFeatured: false,
            displayWeight: 50,
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
