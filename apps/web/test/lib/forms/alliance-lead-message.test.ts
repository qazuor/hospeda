/**
 * @file alliance-lead-message.test.ts
 * @description Unit tests for the pure alliance-lead message
 * serialization/validation helpers (HOS-277 §7.3).
 */

import { describe, expect, it } from 'vitest';
import {
    ALLIANCE_LEAD_SPECIFIC_FIELDS,
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

    it('declares businessName, serviceType, coverageArea, website for service_provider', () => {
        expect(ALLIANCE_LEAD_SPECIFIC_FIELDS.service_provider.map((f) => f.name)).toEqual([
            'businessName',
            'serviceType',
            'coverageArea',
            'website'
        ]);
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
});
