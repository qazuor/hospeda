/**
 * @file alliance-lead-message.test.ts
 * @description Unit tests for the pure alliance-lead message
 * serialization/validation helpers (HOS-277 §7.3).
 */

import { describe, expect, it } from 'vitest';
import {
    ALLIANCE_LEAD_SPECIFIC_FIELDS,
    buildAllianceLeadTypedFields,
    serializeAllianceLeadMessage,
    validateAllianceLeadSpecificFields
} from '../../../src/lib/forms/alliance-lead-message';

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe('ALLIANCE_LEAD_SPECIFIC_FIELDS', () => {
    it('declares businessName, website, partnershipType for partner', () => {
        expect(ALLIANCE_LEAD_SPECIFIC_FIELDS.partner.map((f) => f.name)).toEqual([
            'businessName',
            'website',
            'partnershipType'
        ]);
    });

    it('declares businessName, website, sponsorshipInterest for sponsor', () => {
        expect(ALLIANCE_LEAD_SPECIFIC_FIELDS.sponsor.map((f) => f.name)).toEqual([
            'businessName',
            'website',
            'sponsorshipInterest'
        ]);
    });

    it('declares businessName, category, destinationId, benefitType, benefitValue, benefitText, website for service_provider (HOS-278 §6.4)', () => {
        expect(ALLIANCE_LEAD_SPECIFIC_FIELDS.service_provider.map((f) => f.name)).toEqual([
            'businessName',
            'category',
            'destinationId',
            'benefitType',
            'benefitValue',
            'benefitText',
            'website'
        ]);
    });

    it('marks every service_provider field EXCEPT website as typed (HOS-278 §6.4)', () => {
        const typedFlags = Object.fromEntries(
            ALLIANCE_LEAD_SPECIFIC_FIELDS.service_provider.map((f) => [f.name, !!f.typed])
        );
        expect(typedFlags).toEqual({
            businessName: true,
            category: true,
            destinationId: true,
            benefitType: true,
            benefitValue: true,
            benefitText: true,
            website: false
        });
    });

    it('does not mark any field as typed for partner, sponsor, or editor', () => {
        for (const kind of ['partner', 'sponsor', 'editor'] as const) {
            expect(ALLIANCE_LEAD_SPECIFIC_FIELDS[kind].some((f) => f.typed)).toBe(false);
        }
    });

    it('declares portfolioLinks, topics, experience for editor (no businessName — B2C)', () => {
        expect(ALLIANCE_LEAD_SPECIFIC_FIELDS.editor.map((f) => f.name)).toEqual([
            'portfolioLinks',
            'topics',
            'experience'
        ]);
        expect(ALLIANCE_LEAD_SPECIFIC_FIELDS.editor.some((f) => f.name === 'businessName')).toBe(
            false
        );
    });

    it('marks website fields as type "url"', () => {
        for (const kind of ['partner', 'sponsor', 'service_provider'] as const) {
            const website = ALLIANCE_LEAD_SPECIFIC_FIELDS[kind].find((f) => f.name === 'website');
            expect(website?.type).toBe('url');
        }
    });
});

describe('serializeAllianceLeadMessage', () => {
    it('serializes filled specific fields with i18n labels, per HOS-277 §7.3 example', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'partner',
            specificValues: {
                businessName: 'Acme SA',
                website: 'https://acme.com',
                partnershipType: 'Agencia de turismo'
            },
            freeText: 'Queremos sumar 10 alojamientos.',
            t
        });

        expect(message).toBe(
            [
                'businessName: Acme SA',
                'website: https://acme.com',
                'partnershipType: Agencia de turismo',
                '',
                'Mensaje:',
                'Queremos sumar 10 alojamientos.'
            ].join('\n')
        );
    });

    it('skips empty specific fields', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'partner',
            specificValues: { businessName: 'Acme SA', partnershipType: 'Agencia' },
            freeText: '',
            t
        });

        expect(message).not.toContain('website');
        expect(message).toContain('businessName: Acme SA');
        expect(message).toContain('partnershipType: Agencia');
    });

    it('omits the free-text block entirely when freeText is empty', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'editor',
            specificValues: { topics: 'Gastronomía regional' },
            freeText: '   ',
            t
        });

        expect(message).toBe('topics: Gastronomía regional');
        expect(message).not.toContain('messageIntro');
    });

    it('trims whitespace from field values and free text', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'editor',
            specificValues: { topics: '  Turismo aventura  ' },
            freeText: '  Hola  ',
            t
        });

        expect(message).toContain('topics: Turismo aventura');
        expect(message).toContain('Hola');
        expect(message).not.toContain('  Turismo aventura  ');
    });
});

describe('validateAllianceLeadSpecificFields', () => {
    it('reports required errors for missing required fields', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'partner',
            specificValues: {},
            t
        });

        expect(errors.businessName).toBeDefined();
        expect(errors.partnershipType).toBeDefined();
        expect(errors.website).toBeUndefined(); // optional
    });

    it('passes when required fields are filled', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'partner',
            specificValues: { businessName: 'Acme', partnershipType: 'Agencia' },
            t
        });

        expect(Object.keys(errors)).toHaveLength(0);
    });

    it('rejects a malformed URL in an optional url field', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'partner',
            specificValues: {
                businessName: 'Acme',
                partnershipType: 'Agencia',
                website: 'not-a-url'
            },
            t
        });

        expect(errors.website).toBeDefined();
    });

    it('accepts a well-formed https URL', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'partner',
            specificValues: {
                businessName: 'Acme',
                partnershipType: 'Agencia',
                website: 'https://acme.com'
            },
            t
        });

        expect(errors.website).toBeUndefined();
    });

    it('does not require businessName for editor (B2C, HOS-277 §7.3)', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'editor',
            specificValues: { topics: 'Gastronomía' },
            t
        });

        expect(Object.keys(errors)).toEqual([]);
    });

    // ── service_provider (HOS-278 §6.4) ─────────────────────────────────────

    it('requires businessName, category, destinationId, benefitType for service_provider', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'service_provider',
            specificValues: {},
            t
        });

        expect(errors.businessName).toBeDefined();
        expect(errors.category).toBeDefined();
        expect(errors.destinationId).toBeDefined();
        expect(errors.benefitType).toBeDefined();
        expect(errors.website).toBeUndefined(); // optional
        expect(errors.benefitText).toBeUndefined(); // optional
    });

    it('does NOT require benefitValue when benefitType is TWO_FOR_ONE (no numeric value)', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'TWO_FOR_ONE'
            },
            t
        });

        expect(errors.benefitValue).toBeUndefined();
    });

    it('requires benefitValue when benefitType is PERCENTAGE', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'PERCENTAGE'
            },
            t
        });

        expect(errors.benefitValue).toBeDefined();
    });

    it('requires benefitValue when benefitType is FIXED_AMOUNT', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'FIXED_AMOUNT',
                benefitValue: '0'
            },
            t
        });

        // "0" is not a positive integer, so this must still fail — just via
        // the number-format check rather than "missing".
        expect(errors.benefitValue).toBeDefined();
    });

    it('passes when benefitValue is a positive integer for a numeric benefitType', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'PERCENTAGE',
                benefitValue: '15'
            },
            t
        });

        expect(errors.benefitValue).toBeUndefined();
    });

    it('rejects a non-integer benefitValue', () => {
        const errors = validateAllianceLeadSpecificFields({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'PERCENTAGE',
                benefitValue: 'not-a-number'
            },
            t
        });

        expect(errors.benefitValue).toBeDefined();
    });
});

describe('serializeAllianceLeadMessage — typed fields are excluded (HOS-278 §6.4)', () => {
    it('does NOT serialize typed service_provider fields into message', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme SA',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'PERCENTAGE',
                benefitValue: '15',
                benefitText: 'Solo días hábiles',
                website: 'https://acme.com'
            },
            freeText: 'Ofrecemos servicio 24hs.',
            t
        });

        expect(message).not.toContain('businessName');
        expect(message).not.toContain('category');
        expect(message).not.toContain('destinationId');
        expect(message).not.toContain('benefitType');
        expect(message).not.toContain('benefitValue');
        expect(message).not.toContain('benefitText');
        expect(message).not.toContain('Acme SA');
        expect(message).not.toContain('PLOMERIA');
    });

    it('still serializes the non-typed website field for service_provider', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'service_provider',
            specificValues: { website: 'https://acme.com' },
            freeText: 'Ofrecemos servicio 24hs.',
            t
        });

        expect(message).toContain('website: https://acme.com');
    });

    it('serializes nothing but the free-text block when only typed fields are filled', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme SA',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'PERCENTAGE',
                benefitValue: '15'
            },
            freeText: 'Ofrecemos servicio 24hs.',
            t
        });

        expect(message).toBe(['Mensaje:', 'Ofrecemos servicio 24hs.'].join('\n'));
    });

    it('keeps serializing every non-typed field for partner (unchanged behavior)', () => {
        const message = serializeAllianceLeadMessage({
            kind: 'partner',
            specificValues: { businessName: 'Acme SA', partnershipType: 'Agencia' },
            freeText: '',
            t
        });

        expect(message).toContain('businessName: Acme SA');
        expect(message).toContain('partnershipType: Agencia');
    });
});

describe('buildAllianceLeadTypedFields (HOS-278 §6.4)', () => {
    it('extracts all typed fields for service_provider, converting benefitValue to a number', () => {
        const typedFields = buildAllianceLeadTypedFields({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme SA',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'PERCENTAGE',
                benefitValue: '15',
                benefitText: 'Solo días hábiles',
                website: 'https://acme.com'
            }
        });

        expect(typedFields).toEqual({
            businessName: 'Acme SA',
            category: 'PLOMERIA',
            destinationId: 'dest-1',
            benefitType: 'PERCENTAGE',
            benefitValue: 15,
            benefitText: 'Solo días hábiles'
        });
        expect(typedFields.benefitValue).toBe(15);
        expect(typeof typedFields.benefitValue).toBe('number');
        // website is not typed — must not leak into the typed payload.
        expect(typedFields).not.toHaveProperty('website');
    });

    it('excludes benefitValue when the current benefitType does not carry a numeric value', () => {
        const typedFields = buildAllianceLeadTypedFields({
            kind: 'service_provider',
            specificValues: {
                businessName: 'Acme SA',
                category: 'PLOMERIA',
                destinationId: 'dest-1',
                benefitType: 'TWO_FOR_ONE',
                // Stale value left over from a previous PERCENTAGE selection —
                // must NOT be sent, or the backend rejects it.
                benefitValue: '15'
            }
        });

        expect(typedFields).not.toHaveProperty('benefitValue');
    });

    it('returns no typed fields for partner/sponsor/editor', () => {
        for (const kind of ['partner', 'sponsor', 'editor'] as const) {
            const typedFields = buildAllianceLeadTypedFields({
                kind,
                specificValues: { businessName: 'Acme SA', partnershipType: 'Agencia' }
            });

            expect(typedFields).toEqual({});
        }
    });
});
