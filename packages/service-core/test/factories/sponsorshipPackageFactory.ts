import type {
    SponsorshipLevelIdType,
    SponsorshipPackage,
    SponsorshipPackageCreateInput,
    SponsorshipPackageIdType,
    UserIdType
} from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class SponsorshipPackageFactoryBuilder {
    private pkg: Partial<SponsorshipPackage> = {};

    with(fields: Partial<SponsorshipPackage>): this {
        Object.assign(this.pkg, fields);
        return this;
    }

    build(): SponsorshipPackage {
        return {
            id: getMockId('sponsorshipPackage') as SponsorshipPackageIdType,
            slug: 'test-package',
            name: 'Premium Package',
            description: 'A premium sponsorship package',
            priceAmount: 100000,
            priceCurrency: 'ARS',
            includedPosts: 5,
            includedEvents: 3,
            eventLevelId: getMockId('sponsorshipLevel') as SponsorshipLevelIdType,
            isActive: true,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            ...this.pkg
        };
    }
}

export const createMockSponsorshipPackage = (
    fields: Partial<SponsorshipPackage> = {}
): SponsorshipPackage => new SponsorshipPackageFactoryBuilder().with(fields).build();

/**
 * Factory for a valid SponsorshipPackageCreateInput (only user-provided fields)
 */
export const createMockSponsorshipPackageCreateInput = (
    overrides: Partial<SponsorshipPackageCreateInput> = {}
): SponsorshipPackageCreateInput => {
    return {
        name: 'Premium Package',
        description: 'A premium sponsorship package',
        priceAmount: 100000,
        priceCurrency: 'ARS',
        includedPosts: 5,
        includedEvents: 3,
        eventLevelId: getMockId('sponsorshipLevel') as SponsorshipLevelIdType,
        isActive: true,
        sortOrder: 0,
        ...overrides
    };
};

export const getMockSponsorshipPackageId = (id?: string): SponsorshipPackageIdType =>
    getMockId('sponsorshipPackage', id) as SponsorshipPackageIdType;
