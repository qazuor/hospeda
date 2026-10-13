import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_CLOSURE_CONTACT_KEYS,
    ACCOUNT_CLOSURE_PERSONAL_FIELDS,
    buildAccountEmailPseudonym,
    buildApplicationEmailPseudonym,
    isPseudonymizedEmail,
    type PartnerPresenceContentRow,
    partnerPresenceHasContent
} from '../../../src/models/account-closure/account-closure.pure.ts';

const EMPTY_PRESENCE: PartnerPresenceContentRow = {
    logoUrl: null,
    description: null,
    websiteUrl: null,
    pendingLogoUrl: null,
    pendingDescription: null,
    pendingWebsiteUrl: null,
    socialNetworks: null,
    contactInfo: null
};

describe('TEST:V8a:13 account closure pure helpers', () => {
    it('builds the account pseudonym from the id, lowercase', () => {
        // Arrange
        const userId = 'ABCDEF01-0000-4000-8000-000000000001';

        // Act
        const result = buildAccountEmailPseudonym({ userId });

        // Assert
        expect(result).toEqual({
            email: 'deleted-abcdef01-0000-4000-8000-000000000001@pseudonym.invalid'
        });
    });

    it('builds the application pseudonym from the id, lowercase', () => {
        // Arrange
        const applicationId = '11111111-2222-4333-8444-555555555555';

        // Act
        const result = buildApplicationEmailPseudonym({ applicationId });

        // Assert
        expect(result).toEqual({
            email: 'deleted-application-11111111-2222-4333-8444-555555555555@pseudonym.invalid'
        });
    });

    it('recognises a pseudonymised mailbox regardless of case, and only that', () => {
        // Arrange / Act / Assert
        expect(isPseudonymizedEmail({ email: 'deleted-x@pseudonym.invalid' })).toBe(true);
        expect(isPseudonymizedEmail({ email: 'Deleted-X@Pseudonym.INVALID' })).toBe(true);
        expect(isPseudonymizedEmail({ email: 'juan@example.com' })).toBe(false);
        expect(isPseudonymizedEmail({ email: 'juan@pseudonym.invalid.com' })).toBe(false);
    });

    it('names every replaced field and no value', () => {
        // Arrange / Act / Assert
        expect(ACCOUNT_CLOSURE_PERSONAL_FIELDS).toEqual([
            'email',
            'displayName',
            'firstName',
            'lastName',
            'slug',
            'contactInfo.homePhone',
            'contactInfo.workPhone',
            'contactInfo.mobilePhone',
            'contactInfo.whatsapp',
            'contactInfo.personalEmail',
            'contactInfo.workEmail'
        ]);
        for (const key of ACCOUNT_CLOSURE_CONTACT_KEYS) {
            expect(ACCOUNT_CLOSURE_PERSONAL_FIELDS).toContain(`contactInfo.${key}`);
        }
    });
});

describe('TEST:V8a:12 partner presence content predicate', () => {
    it('an empty presence has no content', () => {
        expect(partnerPresenceHasContent(EMPTY_PRESENCE)).toBe(false);
    });

    it('blank strings and empty or all-null objects are not content', () => {
        // Arrange
        const row: PartnerPresenceContentRow = {
            ...EMPTY_PRESENCE,
            logoUrl: '   ',
            description: '',
            socialNetworks: {},
            contactInfo: { mobilePhone: null, website: '  ' }
        };

        // Act / Assert
        expect(partnerPresenceHasContent(row)).toBe(false);
    });

    it.each([
        ['logoUrl', { logoUrl: 'https://cdn.test/logo.png' }],
        ['description', { description: 'Una descripción' }],
        ['websiteUrl', { websiteUrl: 'https://partner.test' }],
        ['pendingLogoUrl', { pendingLogoUrl: 'https://cdn.test/pending.png' }],
        ['pendingDescription', { pendingDescription: 'Pendiente' }],
        ['pendingWebsiteUrl', { pendingWebsiteUrl: 'https://pending.test' }],
        ['socialNetworks', { socialNetworks: { instagram: 'https://instagram.com/p' } }],
        ['contactInfo', { contactInfo: { mobilePhone: '+5493442000000' } }]
    ] as const)('%s alone is content', (_field, patch) => {
        // Arrange
        const row: PartnerPresenceContentRow = { ...EMPTY_PRESENCE, ...patch };

        // Act / Assert
        expect(partnerPresenceHasContent(row)).toBe(true);
    });
});
