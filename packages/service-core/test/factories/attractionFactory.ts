/**
 * Factory builder for Attraction, for use in tests.
 * Ensures all required fields are present and provides sensible defaults.
 */
import type { Attraction, AttractionIdType, UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class AttractionFactoryBuilder {
    private attraction: Attraction;

    constructor() {
        this.attraction = {
            id: getMockId('feature') as AttractionIdType,
            slug: 'test-attraction',
            name: 'Test Attraction',
            description: 'A test attraction',
            icon: '\ud83c\udfa1',
            isBuiltin: false,
            isFeatured: false,
            destinationId: undefined,
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

    with(values: Partial<Attraction>): AttractionFactoryBuilder {
        this.attraction = { ...this.attraction, ...values };
        return this;
    }

    build(): Attraction {
        return { ...this.attraction };
    }

    static create(values: Partial<Attraction> = {}): Attraction {
        return new AttractionFactoryBuilder().with(values).build();
    }
}
