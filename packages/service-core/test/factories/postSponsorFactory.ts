import type {
    PostSponsor,
    PostSponsorCreateInput,
    PostSponsorIdType,
    UserIdType
} from '@repo/schemas';
import { ClientTypeEnum, LifecycleStatusEnum, ModerationStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class PostSponsorFactoryBuilder {
    private sponsor: Partial<PostSponsor> = {};

    with(fields: Partial<PostSponsor>): this {
        Object.assign(this.sponsor, fields);
        return this;
    }

    build(): PostSponsor {
        return {
            id: getMockId('postSponsor') as PostSponsorIdType,
            name: 'Sponsor Name',
            type: ClientTypeEnum.POST_SPONSOR,
            description: 'A valid sponsor description',
            logo: {
                url: 'https://example.com/logo.png',
                moderationState: ModerationStatusEnum.APPROVED,
                caption: undefined,
                description: undefined
            },
            contactInfo: {
                mobilePhone: '+1234567890'
            },
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            adminInfo: undefined,
            ...this.sponsor
        };
    }
}

export const createMockPostSponsor = (fields: Partial<PostSponsor> = {}): PostSponsor =>
    new PostSponsorFactoryBuilder().with(fields).build();

/**
 * Factory for a valid CreatePostSponsorInput (only user-provided fields)
 */
export const createMockPostSponsorCreateInput = (
    overrides: Partial<PostSponsorCreateInput> = {}
): PostSponsorCreateInput => {
    return {
        name: 'Sponsor Name',
        type: ClientTypeEnum.POST_SPONSOR,
        description: 'A valid sponsor description',
        logo: {
            url: 'https://example.com/logo.png',
            moderationState: ModerationStatusEnum.APPROVED,
            caption: undefined,
            description: undefined
        },
        contactInfo: {
            mobilePhone: '+1234567890'
        },
        ...overrides
    };
};

export const getMockPostSponsorId = (id?: string): PostSponsorIdType =>
    getMockId('postSponsor', id) as PostSponsorIdType;

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use createMockPostSponsorCreateInput instead
 */
export const createNewPostSponsorInput = createMockPostSponsorCreateInput;
