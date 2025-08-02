/**
 * Factory builder for AttractionType, for use in tests.
 * Ensures all required fields are present and provides sensible defaults.
 */
import type { AttractionId, AttractionType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

export class AttractionFactoryBuilder {
    private attraction: AttractionType;

    constructor() {
        this.attraction = {
            id: getMockId('feature') as AttractionId,
            slug: 'test-attraction',
            name: 'Test Attraction',
            description: 'A test attraction',
            icon: '\ud83c\udfa1',
            isBuiltin: false,
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

    with(values: Partial<AttractionType>): AttractionFactoryBuilder {
        this.attraction = { ...this.attraction, ...values };
        return this;
    }

    build(): AttractionType {
        return { ...this.attraction };
    }

    static create(values: Partial<AttractionType> = {}): AttractionType {
        return new AttractionFactoryBuilder().with(values).build();
    }
}
