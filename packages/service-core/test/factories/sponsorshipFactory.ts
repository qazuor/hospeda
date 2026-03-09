import type {
    Sponsorship,
    SponsorshipCreateInput,
    SponsorshipIdType,
    SponsorshipLevelIdType,
    SponsorshipPackageIdType,
    UserIdType
} from '@repo/schemas';
import { SponsorshipStatusEnum, SponsorshipTargetTypeEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class SponsorshipFactoryBuilder {
    private sponsorship: Partial<Sponsorship> = {};

    with(fields: Partial<Sponsorship>): this {
        Object.assign(this.sponsorship, fields);
        return this;
    }

    build(): Sponsorship {
        return {
            id: getMockId('sponsorship') as SponsorshipIdType,
            slug: 'test-sponsorship',
            sponsorUserId: getMockId('user') as UserIdType,
            targetType: SponsorshipTargetTypeEnum.EVENT,
            targetId: getMockId('event'),
            levelId: getMockId('sponsorshipLevel') as SponsorshipLevelIdType,
            packageId: getMockId('sponsorshipPackage') as SponsorshipPackageIdType,
            status: SponsorshipStatusEnum.ACTIVE,
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paymentId: null,
            logoUrl: 'https://example.com/logo.png',
            linkUrl: 'https://example.com',
            couponCode: null,
            couponDiscountPercent: null,
            analytics: { impressions: 0, clicks: 0, couponsUsed: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            ...this.sponsorship
        };
    }
}

export const createMockSponsorship = (fields: Partial<Sponsorship> = {}): Sponsorship =>
    new SponsorshipFactoryBuilder().with(fields).build();

/**
 * Factory for a valid SponsorshipCreateInput (only user-provided fields)
 */
export const createMockSponsorshipCreateInput = (
    overrides: Partial<SponsorshipCreateInput> = {}
): SponsorshipCreateInput => {
    return {
        sponsorUserId: getMockId('user') as UserIdType,
        targetType: SponsorshipTargetTypeEnum.EVENT,
        targetId: getMockId('event'),
        levelId: getMockId('sponsorshipLevel') as SponsorshipLevelIdType,
        status: SponsorshipStatusEnum.PENDING,
        startsAt: new Date(),
        ...overrides
    };
};

export const getMockSponsorshipId = (id?: string): SponsorshipIdType =>
    getMockId('sponsorship', id) as SponsorshipIdType;
