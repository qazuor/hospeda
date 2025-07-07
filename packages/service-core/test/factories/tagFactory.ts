import type { TagId, TagType, UserId } from '@repo/types';
import { LifecycleStatusEnum, TagColorEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Builder for TagType test objects.
 * Allows fluent creation of tag test data with sensible defaults.
 */
export class TagFactoryBuilder {
    private tag: TagType;

    constructor() {
        this.tag = {
            id: getMockId('tag') as TagId,
            name: 'Test Tag',
            slug: 'test-tag',
            color: TagColorEnum.BLUE,
            icon: '🏷️',
            notes: '',
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            deletedAt: undefined,
            deletedById: undefined
        };
    }

    with(fields: Partial<TagType>): this {
        this.tag = { ...this.tag, ...fields };
        return this;
    }

    build(): TagType {
        return { ...this.tag };
    }

    static create(fields: Partial<TagType> = {}): TagType {
        return new TagFactoryBuilder().with(fields).build();
    }
}
