/**
 * HOS-2060: the `policies` JSONB contract, shared base plus one extension per
 * vertical, and its wiring into the read and write schemas of each entity.
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationAdminSchema,
    AccommodationPoliciesSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema,
    AccommodationUpdateHttpSchema,
    AccommodationUpdateInputSchema,
    DEFAULT_LISTING_POLICIES,
    ExperienceAdminSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperiencePoliciesSchema,
    ExperienceProtectedSchema,
    ExperiencePublicSchema,
    ExperienceUpdateInputSchema,
    httpToDomainAccommodationUpdate,
    LISTING_PAYMENT_METHODS,
    LISTING_SECTIONS,
    ListingPoliciesBaseSchema,
    mergeListingPolicies,
    sectionsTouchedByBody,
    VenueAdminSchema,
    VenueOwnerUpdateInputSchema,
    VenuePoliciesSchema,
    VenueProtectedSchema,
    VenuePublicSchema,
    VenueUpdateInputSchema
} from '../../src/index.js';

const NOTE = { es: 'Solo perros chicos', en: 'Small dogs only', pt: 'Só cães pequenos' };

describe('ListingPoliciesBaseSchema', () => {
    it('accepts an empty object: every policy is optional', () => {
        expect(ListingPoliciesBaseSchema.parse({})).toEqual({});
    });

    it('accepts a full base declaration', () => {
        const input = {
            paymentMethods: ['cash', 'mercadopago'],
            pets: { admission: 'on_request', extraCost: true, notes: NOTE },
            smokingAllowed: 'outdoor_only',
            eventsAllowed: false
        };
        expect(ListingPoliciesBaseSchema.parse(input)).toEqual(input);
    });

    it('has exactly the five owner-approved payment methods', () => {
        expect([...LISTING_PAYMENT_METHODS]).toEqual([
            'cash',
            'debit',
            'credit',
            'transfer',
            'mercadopago'
        ]);
    });

    it.each([
        ['an unknown payment method', { paymentMethods: ['cheque'] }],
        ['a repeated payment method', { paymentMethods: ['cash', 'cash'] }],
        ['an unknown pets admission', { pets: { admission: 'sometimes' } }],
        ['pets without admission', { pets: { extraCost: true } }],
        ['a pets note missing a locale', { pets: { admission: 'yes', notes: { es: 'x' } } }],
        ['a boolean smoking policy', { smokingAllowed: true }],
        ['a string eventsAllowed', { eventsAllowed: 'yes' }]
    ])('rejects %s', (_label, input) => {
        expect(ListingPoliciesBaseSchema.safeParse(input).success).toBe(false);
    });

    it('injects no default for an absent key', () => {
        const parsed = ListingPoliciesBaseSchema.parse({ eventsAllowed: true });
        expect(Object.keys(parsed)).toEqual(['eventsAllowed']);
    });
});

describe('AccommodationPoliciesSchema', () => {
    it('accepts check-in/out windows and the stay length', () => {
        const input = {
            paymentMethods: ['transfer'],
            checkIn: { from: '14:00', to: '22:00' },
            checkOut: { to: '10:00' },
            minNights: 2,
            maxNights: 30
        };
        expect(AccommodationPoliciesSchema.parse(input)).toEqual(input);
    });

    it.each([
        ['a non HH:mm check-in', { checkIn: { from: '2pm' } }],
        ['a 24:00 check-out', { checkOut: { to: '24:00' } }],
        ['zero minimum nights', { minNights: 0 }],
        ['fractional nights', { maxNights: 1.5 }],
        ['maxNights below minNights', { minNights: 5, maxNights: 2 }]
    ])('rejects %s', (_label, input) => {
        expect(AccommodationPoliciesSchema.safeParse(input).success).toBe(false);
    });

    it('accepts the deposit, spoken languages and events details (HOS-2120, HOS-2122)', () => {
        const input = {
            eventsAllowed: true,
            eventsDetails: {
                maxGuests: 40,
                amplifiedSound: false,
                endTime: '00:00',
                extraCost: true,
                notes: NOTE
            },
            deposit: { required: true, percentage: 30, notes: NOTE },
            spokenLanguages: ['es', 'en', 'other']
        };
        expect(AccommodationPoliciesSchema.parse(input)).toEqual(input);
    });

    it('accepts a bare "no deposit" and partial event details', () => {
        const input = { deposit: { required: false }, eventsDetails: { endTime: '23:30' } };
        expect(AccommodationPoliciesSchema.parse(input)).toEqual(input);
    });

    it('lets an update clear each new key with null', () => {
        expect(
            AccommodationPoliciesSchema.safeParse({
                deposit: null,
                spokenLanguages: null,
                eventsDetails: null
            }).success
        ).toBe(true);
    });

    it('parses a row stored before the new keys existed (backward compatible)', () => {
        const legacy = { paymentMethods: ['cash'], eventsAllowed: true, minNights: 2 };
        expect(AccommodationPoliciesSchema.parse(legacy)).toEqual(legacy);
    });

    it.each([
        ['a deposit percentage of 0', { deposit: { required: true, percentage: 0 } }],
        ['a deposit percentage over 100', { deposit: { required: true, percentage: 101 } }],
        ['a fractional deposit percentage', { deposit: { required: true, percentage: 12.5 } }],
        ['a percentage on a "no deposit"', { deposit: { required: false, percentage: 20 } }],
        ['a deposit without the yes/no', { deposit: { percentage: 20 } }],
        ['an unknown language', { spokenLanguages: ['jp'] }],
        ['a repeated language', { spokenLanguages: ['es', 'es'] }],
        ['zero event guests', { eventsDetails: { maxGuests: 0 } }],
        ['a non HH:mm event end time', { eventsDetails: { endTime: 'medianoche' } }]
    ])('rejects %s', (_label, input) => {
        expect(AccommodationPoliciesSchema.safeParse(input).success).toBe(false);
    });

    it('keeps the new keys out of the shared base (venue and experience never carry them)', () => {
        expect(Object.hasOwn(ListingPoliciesBaseSchema.shape, 'deposit')).toBe(false);
        expect(Object.hasOwn(ListingPoliciesBaseSchema.shape, 'spokenLanguages')).toBe(false);
        expect(Object.hasOwn(ListingPoliciesBaseSchema.shape, 'eventsDetails')).toBe(false);
    });

    it('keeps the new keys through the public read schema', () => {
        const policies = {
            deposit: { required: true, percentage: 50 },
            spokenLanguages: ['pt'],
            eventsAllowed: true,
            eventsDetails: { maxGuests: 10 }
        };
        expect(AccommodationPublicSchema.shape.policies.parse(policies)).toEqual(policies);
    });
});

describe('VenuePoliciesSchema', () => {
    it('accepts reservations, age and dress code', () => {
        const input = {
            reservations: 'recommended',
            minAge: 18,
            dressCode: 'elegant',
            dressCodeNote: NOTE
        };
        expect(VenuePoliciesSchema.parse(input)).toEqual(input);
    });

    it.each([
        ['an unknown reservations value', { reservations: 'maybe' }],
        ['an age below 13', { minAge: 12 }],
        ['an age above 30', { minAge: 31 }],
        ['an unknown dress code', { dressCode: 'tuxedo' }]
    ])('rejects %s', (_label, input) => {
        expect(VenuePoliciesSchema.safeParse(input).success).toBe(false);
    });

    it('lets an update clear one key with null', () => {
        expect(VenuePoliciesSchema.safeParse({ minAge: null, dressCode: null }).success).toBe(true);
    });
});

describe('ExperiencePoliciesSchema', () => {
    it('accepts private groups and a cancellation text', () => {
        const input = { privateGroups: true, cancellation: 'Si llueve, reprogramamos.' };
        expect(ExperiencePoliciesSchema.parse(input)).toEqual(input);
    });

    it('rejects a cancellation text over 1500 characters, like the column', () => {
        expect(ExperiencePoliciesSchema.safeParse({ cancellation: 'x'.repeat(1501) }).success).toBe(
            false
        );
    });
});

describe('policies in the read schemas', () => {
    it.each([
        ['AccommodationPublicSchema', AccommodationPublicSchema],
        ['AccommodationProtectedSchema', AccommodationProtectedSchema],
        ['AccommodationAdminSchema', AccommodationAdminSchema],
        ['VenuePublicSchema', VenuePublicSchema],
        ['VenueProtectedSchema', VenueProtectedSchema],
        ['VenueAdminSchema', VenueAdminSchema],
        ['ExperiencePublicSchema', ExperiencePublicSchema],
        ['ExperienceProtectedSchema', ExperienceProtectedSchema],
        ['ExperienceAdminSchema', ExperienceAdminSchema]
    ])('%s declares policies, so a read does not strip it', (_name, schema) => {
        expect(Object.hasOwn(schema.shape, 'policies')).toBe(true);
        expect(schema.shape.policies.safeParse(null).success).toBe(true);
        expect(schema.shape.policies.safeParse(undefined).success).toBe(true);
    });
});

describe('policies in the write schemas', () => {
    it.each([
        ['AccommodationUpdateInputSchema', AccommodationUpdateInputSchema],
        ['VenueUpdateInputSchema', VenueUpdateInputSchema],
        ['VenueOwnerUpdateInputSchema', VenueOwnerUpdateInputSchema],
        ['ExperienceUpdateInputSchema', ExperienceUpdateInputSchema],
        ['ExperienceOwnerUpdateInputSchema', ExperienceOwnerUpdateInputSchema]
    ])('%s accepts valid policies and rejects invalid ones', (_name, schema) => {
        expect(schema.safeParse({ policies: { paymentMethods: ['cash'] } }).success).toBe(true);
        expect(schema.safeParse({ policies: { paymentMethods: ['bitcoin'] } }).success).toBe(false);
    });

    it('validates the vertical extension on the owner venue input', () => {
        expect(VenueOwnerUpdateInputSchema.safeParse({ policies: { minAge: 40 } }).success).toBe(
            false
        );
    });

    it('carries policies through the accommodation HTTP update to the domain input', () => {
        // Arrange
        const policies = { pets: { admission: 'yes' as const }, minNights: 2 };
        const body = AccommodationUpdateHttpSchema.partial().strict().parse({ policies });

        // Act
        const domain = httpToDomainAccommodationUpdate(body);

        // Assert
        expect(domain.policies).toEqual(policies);
    });

    it('lets the accommodation HTTP update clear policies with null', () => {
        const body = AccommodationUpdateHttpSchema.partial().strict().parse({ policies: null });
        expect(httpToDomainAccommodationUpdate(body).policies).toBeNull();
    });

    it('does not emit policies when the HTTP update omits them', () => {
        const domain = httpToDomainAccommodationUpdate(
            AccommodationUpdateHttpSchema.partial().parse({ name: 'Casa del río' })
        );
        expect(Object.hasOwn(domain, 'policies')).toBe(false);
    });

    it('rejects an invalid accommodation policy at the HTTP boundary', () => {
        expect(
            AccommodationUpdateHttpSchema.partial()
                .strict()
                .safeParse({ policies: { checkIn: { from: '25:00' } } }).success
        ).toBe(false);
    });
});

describe('policies in the listing section catalog', () => {
    it.each([
        'accommodation',
        'venue',
        'experience'
    ] as const)('the always-available amenities section owns policies for %s', (vertical) => {
        const sections = LISTING_SECTIONS[vertical] as readonly {
            readonly id: string;
            readonly common: boolean;
            readonly fields: readonly string[];
        }[];
        const owners = sections.filter((section) => section.fields.includes('policies'));
        expect(owners.map((section) => section.id)).toEqual(['amenities']);
        expect(owners[0]?.common).toBe(true);
    });
});

describe('mergeListingPolicies', () => {
    const stored = { paymentMethods: ['cash'], minAge: 18, dressCode: 'elegant' };

    it('keeps every stored key the patch omits', () => {
        const { policies } = mergeListingPolicies({ stored, patch: { minAge: 21 } });
        expect(policies).toEqual({ paymentMethods: ['cash'], minAge: 21, dressCode: 'elegant' });
    });

    it('removes a key the patch sets to null', () => {
        const { policies } = mergeListingPolicies({ stored, patch: { dressCode: null } });
        expect(policies).toEqual({ paymentMethods: ['cash'], minAge: 18 });
    });

    it('clears everything on a null patch and changes nothing on an undefined one', () => {
        expect(mergeListingPolicies({ stored, patch: null }).policies).toBeNull();
        expect(mergeListingPolicies({ stored, patch: undefined }).policies).toBeUndefined();
    });

    it('starts from an empty object when nothing is stored', () => {
        const { policies } = mergeListingPolicies({ stored: null, patch: { eventsAllowed: true } });
        expect(policies).toEqual({ eventsAllowed: true });
    });

    it('does not mutate the stored object', () => {
        const before = { ...stored };
        mergeListingPolicies({ stored, patch: { minAge: null } });
        expect(stored).toEqual(before);
    });
});

describe('DEFAULT_LISTING_POLICIES', () => {
    it('is cash and nothing else, and frozen', () => {
        expect(DEFAULT_LISTING_POLICIES).toEqual({ paymentMethods: ['cash'] });
        expect(Object.isFrozen(DEFAULT_LISTING_POLICIES)).toBe(true);
    });
});

describe('sectionsTouchedByBody — policy keys (HOS-2060, DEC-FAC-040)', () => {
    it('counts venue age and dress code as nightInfo, not amenities', () => {
        const touched = sectionsTouchedByBody({
            vertical: 'venue',
            body: { policies: { minAge: 18, dressCodeNote: { es: 'a', en: 'a', pt: 'a' } } }
        });
        expect(touched).toEqual(['nightInfo']);
    });

    it('counts an unclaimed policy key as amenities', () => {
        const touched = sectionsTouchedByBody({
            vertical: 'venue',
            body: { policies: { paymentMethods: ['cash'] } }
        });
        expect(touched).toEqual(['amenities']);
    });

    it('counts both when a body mixes them', () => {
        const touched = sectionsTouchedByBody({
            vertical: 'venue',
            body: { policies: { paymentMethods: ['cash'], dressCode: 'casual' } }
        });
        expect([...touched].sort()).toEqual(['amenities', 'nightInfo']);
    });

    it('never counts a cleared night key, so a locked section can still be emptied', () => {
        const touched = sectionsTouchedByBody({
            vertical: 'venue',
            body: { policies: { minAge: null, dressCode: null } }
        });
        expect(touched).toEqual([]);
    });

    it('declares the night keys on the venue nightInfo section only', () => {
        const owners = LISTING_SECTIONS.venue.filter((section) =>
            ((section as { policyKeys?: readonly string[] }).policyKeys ?? []).includes('minAge')
        );
        expect(owners.map((section) => section.id)).toEqual(['nightInfo']);
    });
});
