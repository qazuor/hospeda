import type { Tag } from '@repo/schemas';
import { LifecycleStatusEnum, TagColorEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Builder for Tag test objects.
 * Allows fluent creation of tag test data with sensible defaults.
 */
export class TagFactoryBuilder {
    private tag: Tag;

    constructor() {
        this.tag = {
            id: getMockId('tag'),
            name: 'Test Tag',
            slug: 'test-tag',
            color: TagColorEnum.BLUE,
            icon: '🏷️',
            notes: '',
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user'),
            updatedById: getMockId('user'),
            deletedAt: undefined,
            deletedById: undefined
        };
    }

    with(fields: Partial<Tag>): this {
        this.tag = { ...this.tag, ...fields };
        return this;
    }

    build(): Tag {
        return { ...this.tag };
    }

    static create(fields: Partial<Tag> = {}): Tag {
        return new TagFactoryBuilder().with(fields).build();
    }
}
