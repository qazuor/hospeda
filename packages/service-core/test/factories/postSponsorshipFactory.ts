import type {
    PostIdType,
    PostSponsorIdType,
    PostSponsorship,
    PostSponsorshipCreateInput,
    PostSponsorshipIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, PriceCurrencyEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class PostSponsorshipFactoryBuilder {
    private sponsorship: Partial<PostSponsorship> = {};

    with(fields: Partial<PostSponsorship>): this {
        Object.assign(this.sponsorship, fields);
        return this;
    }

    build(): PostSponsorship {
        return {
            id: getMockId('postSponsorship') as PostSponsorshipIdType,
            sponsorId: getMockId('postSponsor') as PostSponsorIdType,
            postId: getMockId('post') as PostIdType,
            message: 'Sponsored message',
            description: 'A valid sponsorship description',
            paid: { price: 100, currency: PriceCurrencyEnum.USD },
            paidAt: new Date(),
            fromDate: new Date(),
            toDate: new Date(),
            isHighlighted: false,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            adminInfo: undefined,
            ...this.sponsorship
        };
    }
}

export const createMockPostSponsorship = (fields: Partial<PostSponsorship> = {}): PostSponsorship =>
    new PostSponsorshipFactoryBuilder().with(fields).build();

/**
 * Factory for a valid CreatePostSponsorshipInput (only user-provided fields)
 */
export const createMockPostSponsorshipCreateInput = (
    overrides: Partial<PostSponsorshipCreateInput> = {}
): PostSponsorshipCreateInput => {
    return {
        sponsorId: getMockId('postSponsor') as PostSponsorIdType,
        postId: getMockId('post') as PostIdType,
        message: 'Sponsored message',
        description: 'A valid sponsorship description',
        paid: { price: 100, currency: PriceCurrencyEnum.USD },
        paidAt: new Date(),
        fromDate: new Date(),
        toDate: new Date(),
        isHighlighted: false,
        ...overrides
    };
};

export const getMockPostSponsorshipId = (id?: string): PostSponsorshipIdType =>
    getMockId('postSponsorship', id) as PostSponsorshipIdType;

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use createMockPostSponsorshipCreateInput instead
 */
export const createNewPostSponsorshipInput = createMockPostSponsorshipCreateInput;
