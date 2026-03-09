import type {
    SponsorshipLevel,
    SponsorshipLevelCreateInput,
    SponsorshipLevelIdType,
    UserIdType
} from '@repo/schemas';
import { SponsorshipTargetTypeEnum, SponsorshipTierEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class SponsorshipLevelFactoryBuilder {
    private level: Partial<SponsorshipLevel> = {};

    with(fields: Partial<SponsorshipLevel>): this {
        Object.assign(this.level, fields);
        return this;
    }

    build(): SponsorshipLevel {
        return {
            id: getMockId('sponsorshipLevel') as SponsorshipLevelIdType,
            slug: 'test-level',
            name: 'Gold Sponsorship',
            description: 'A gold tier sponsorship level',
            targetType: SponsorshipTargetTypeEnum.EVENT,
            tier: SponsorshipTierEnum.GOLD,
            priceAmount: 50000,
            priceCurrency: 'ARS',
            benefits: [
                { key: 'logo', label: 'Logo placement' },
                { key: 'banner', label: 'Banner ad' }
            ],
            sortOrder: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            ...this.level
        };
    }
}

export const createMockSponsorshipLevel = (
    fields: Partial<SponsorshipLevel> = {}
): SponsorshipLevel => new SponsorshipLevelFactoryBuilder().with(fields).build();

/**
 * Factory for a valid SponsorshipLevelCreateInput (only user-provided fields)
 */
export const createMockSponsorshipLevelCreateInput = (
    overrides: Partial<SponsorshipLevelCreateInput> = {}
): SponsorshipLevelCreateInput => {
    return {
        name: 'Gold Sponsorship',
        description: 'A gold tier sponsorship level',
        targetType: SponsorshipTargetTypeEnum.EVENT,
        tier: SponsorshipTierEnum.GOLD,
        priceAmount: 50000,
        priceCurrency: 'ARS',
        benefits: [{ key: 'logo', label: 'Logo placement' }],
        sortOrder: 0,
        isActive: true,
        ...overrides
    };
};

export const getMockSponsorshipLevelId = (id?: string): SponsorshipLevelIdType =>
    getMockId('sponsorshipLevel', id) as SponsorshipLevelIdType;
