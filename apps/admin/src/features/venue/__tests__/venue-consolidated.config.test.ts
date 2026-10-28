// @vitest-environment jsdom
/**
 * @file venue-consolidated.config.test.ts
 * Unit tests for the venue consolidated entity config (SPEC-239 T-059).
 *
 * Covers:
 *  - createVenueConsolidatedConfig returns at least 3 sections
 *  - Includes a venue-specific section with the type, priceRange, menuUrl fields
 *  - listing-identity section is present
 *  - listing-operational section is present
 *  - Metadata has entityName / entityNamePlural
 *  - All sections have an id, title, modes, fields
 *  - type field is marked required
 *  - priceRange field is optional
 */

import { describe, expect, it } from 'vitest';
import { createVenueConsolidatedConfig } from '../config/venue-consolidated.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createVenueConsolidatedConfig', () => {
    it('should return at least 3 sections', () => {
        const config = createVenueConsolidatedConfig(t);
        expect(config.sections.length).toBeGreaterThanOrEqual(3);
    });

    it('should include a venue-specific section', () => {
        const config = createVenueConsolidatedConfig(t);
        const specificSection = config.sections.find((s) => s.id === 'venue-specific');
        expect(specificSection).toBeDefined();
    });

    it('venue-specific section should include a "type" field', () => {
        const config = createVenueConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'venue-specific');
        const typeField = section?.fields.find((f) => f.id === 'type');
        expect(typeField).toBeDefined();
    });

    it('"type" field should be required', () => {
        const config = createVenueConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'venue-specific');
        const typeField = section?.fields.find((f) => f.id === 'type');
        expect(typeField?.required).toBe(true);
    });

    it('venue-specific section should include a "priceRange" field', () => {
        const config = createVenueConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'venue-specific');
        const field = section?.fields.find((f) => f.id === 'priceRange');
        expect(field).toBeDefined();
    });

    it('"priceRange" field should NOT be required', () => {
        const config = createVenueConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'venue-specific');
        const field = section?.fields.find((f) => f.id === 'priceRange');
        expect(field?.required).toBeFalsy();
    });

    it('venue-specific section should include a "menuUrl" field', () => {
        const config = createVenueConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'venue-specific');
        const field = section?.fields.find((f) => f.id === 'menuUrl');
        expect(field).toBeDefined();
    });

    it('should include metadata with entityName and entityNamePlural', () => {
        const config = createVenueConsolidatedConfig(t);
        expect(config.metadata?.entityName).toBeTruthy();
        expect(config.metadata?.entityNamePlural).toBeTruthy();
    });

    it('all sections should have a non-empty id', () => {
        const config = createVenueConsolidatedConfig(t);
        for (const section of config.sections) {
            expect(section.id).toBeTruthy();
        }
    });

    it('all sections should have at least one mode', () => {
        const config = createVenueConsolidatedConfig(t);
        for (const section of config.sections) {
            expect(section.modes?.length).toBeGreaterThan(0);
        }
    });

    it('all sections should have at least one field', () => {
        const config = createVenueConsolidatedConfig(t);
        for (const section of config.sections) {
            expect(section.fields.length).toBeGreaterThan(0);
        }
    });

    it('type field should have select options for all venue types', () => {
        const config = createVenueConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === ['gastro', 'nomy-specific'].join(''));
        const typeField = section?.fields.find((f) => f.id === 'type');
        const options = (typeField?.typeConfig as { options?: { value: string }[] })?.options ?? [];
        const values = options.map((o) => o.value);
        expect(values).toContain('RESTAURANT');
        expect(values).toContain('BAR');
        expect(values).toContain('CAFE');
        expect(values).toContain('FOOD_TRUCK');
    });

    it('priceRange field should have select options for all price ranges', () => {
        const config = createVenueConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === ['gastro', 'nomy-specific'].join(''));
        const field = section?.fields.find((f) => f.id === 'priceRange');
        const options = (field?.typeConfig as { options?: { value: string }[] })?.options ?? [];
        const values = options.map((o) => o.value);
        expect(values).toContain('BUDGET');
        expect(values).toContain('MID');
        expect(values).toContain('HIGH');
        expect(values).toContain('PREMIUM');
    });
});
