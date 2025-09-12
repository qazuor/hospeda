import type { PostSponsorCreateInput } from '@repo/schemas';
import type { PostSponsorId, PostSponsorType, UserId } from '@repo/types';
import { ClientTypeEnum, LifecycleStatusEnum, ModerationStatusEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

export class PostSponsorFactoryBuilder {
    private sponsor: Partial<PostSponsorType> = {};

    with(fields: Partial<PostSponsorType>): this {
        Object.assign(this.sponsor, fields);
        return this;
    }

    build(): PostSponsorType {
        return {
            id: getMockId('post') as PostSponsorId,
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
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            deletedAt: undefined,
            deletedById: undefined,
            adminInfo: undefined,
            ...this.sponsor
        };
    }
}

export const createMockPostSponsor = (fields: Partial<PostSponsorType> = {}): PostSponsorType =>
    new PostSponsorFactoryBuilder().with(fields).build();

/**
 * Factory for a valid CreatePostSponsorInput (only user-provided fields)
 */
export const createNewPostSponsorInput = (
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

export const getMockPostSponsorId = (id?: string): PostSponsorId =>
    getMockId('post', id) as PostSponsorId;
