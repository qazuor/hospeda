import type {
    BasePriceType,
    PostId,
    PostSponsorId,
    PostSponsorshipId,
    PostSponsorshipType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum, PriceCurrencyEnum } from '@repo/types';
import type { CreatePostSponsorshipInput } from '../../src/services/postSponsorship/postSponsorship.schemas';
import { getMockId } from './utilsFactory';

export class PostSponsorshipFactoryBuilder {
    private sponsorship: Partial<PostSponsorshipType> = {};

    with(fields: Partial<PostSponsorshipType>): this {
        Object.assign(this.sponsorship, fields);
        return this;
    }

    build(): PostSponsorshipType {
        return {
            id: getMockId('post') as PostSponsorshipId,
            sponsorId: getMockId('post') as PostSponsorId,
            postId: getMockId('post') as PostId,
            message: 'Sponsored message',
            description: 'A valid sponsorship description',
            paid: { price: 100, currency: PriceCurrencyEnum.USD } as BasePriceType,
            paidAt: new Date(),
            fromDate: new Date(),
            toDate: new Date(),
            isHighlighted: false,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            deletedAt: undefined,
            deletedById: undefined,
            adminInfo: undefined,
            ...this.sponsorship
        };
    }
}

export const createMockPostSponsorship = (
    fields: Partial<PostSponsorshipType> = {}
): PostSponsorshipType => new PostSponsorshipFactoryBuilder().with(fields).build();

/**
 * Factory for a valid CreatePostSponsorshipInput (only user-provided fields)
 */
export const createNewPostSponsorshipInput = (
    overrides: Partial<CreatePostSponsorshipInput> = {}
): CreatePostSponsorshipInput => {
    return {
        sponsorId: getMockId('post') as PostSponsorId,
        postId: getMockId('post') as PostId,
        message: 'Sponsored message',
        description: 'A valid sponsorship description',
        paid: { price: 100, currency: PriceCurrencyEnum.USD } as BasePriceType,
        paidAt: new Date(),
        fromDate: new Date(),
        toDate: new Date(),
        isHighlighted: false,
        ...overrides
    };
};

export const getMockPostSponsorshipId = (id?: string): PostSponsorshipId =>
    getMockId('post', id) as PostSponsorshipId;
