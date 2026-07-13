/**
 * Factory builder for PointOfInterest, for use in tests.
 * Ensures all required fields are present and provides sensible defaults.
 */
import type { PointOfInterest, PointOfInterestIdType, UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class PointOfInterestFactoryBuilder {
    private pointOfInterest: PointOfInterest;

    constructor() {
        this.pointOfInterest = {
            id: getMockId('pointOfInterest') as PointOfInterestIdType,
            slug: 'test-point-of-interest',
            lat: -32.4825,
            long: -58.2372,
            type: 'STADIUM' as PointOfInterest['type'],
            description: 'A test point of interest description',
            icon: '📍',
            isBuiltin: false,
            isFeatured: false,
            displayWeight: 50,
            // HOS-138: POI v2 fields with defaults.
            hasOwnPage: false,
            verified: false,
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

    with(values: Partial<PointOfInterest>): PointOfInterestFactoryBuilder {
        this.pointOfInterest = { ...this.pointOfInterest, ...values };
        return this;
    }

    build(): PointOfInterest {
        return { ...this.pointOfInterest };
    }

    static create(values: Partial<PointOfInterest> = {}): PointOfInterest {
        return new PointOfInterestFactoryBuilder().with(values).build();
    }
}
