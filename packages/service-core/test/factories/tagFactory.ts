import type { Tag } from '@repo/schemas';
import { LifecycleStatusEnum, TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Builder for Tag test objects.
 *
 * Per SPEC-086 D-002 and D-018:
 * - `slug` removed (user-tags have no public URLs).
 * - `notes` removed (replaced by `description`).
 * - `type` is required (INTERNAL / SYSTEM / USER).
 * - `ownerId` is required for USER tags, must be null for INTERNAL/SYSTEM.
 */
export class TagFactoryBuilder {
    private tag: Tag;

    constructor() {
        this.tag = {
            id: getMockId('tag'),
            name: 'Test Tag',
            type: TagTypeEnum.SYSTEM,
            color: TagColorEnum.BLUE,
            icon: undefined,
            description: undefined,
            ownerId: null,
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

    /**
     * Creates a SYSTEM tag (no ownerId).
     */
    static create(fields: Partial<Tag> = {}): Tag {
        return new TagFactoryBuilder().with(fields).build();
    }

    /**
     * Creates a USER tag with the given ownerId.
     * Automatically sets type to USER.
     */
    static createUserTag(ownerId: string, fields: Partial<Tag> = {}): Tag {
        return new TagFactoryBuilder().with({ type: TagTypeEnum.USER, ownerId, ...fields }).build();
    }

    /**
     * Creates an INTERNAL tag (no ownerId, type = INTERNAL).
     */
    static createInternalTag(fields: Partial<Tag> = {}): Tag {
        return new TagFactoryBuilder()
            .with({ type: TagTypeEnum.INTERNAL, ownerId: null, ...fields })
            .build();
    }
}
