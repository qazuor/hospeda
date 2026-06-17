// @vitest-environment jsdom
/**
 * @file gastronomy-consolidated.config.test.ts
 * Unit tests for the gastronomy consolidated entity config (SPEC-239 T-059).
 *
 * Covers:
 *  - createGastronomyConsolidatedConfig returns at least 3 sections
 *  - Includes a gastronomy-specific section with the type, priceRange, menuUrl fields
 *  - commerce-identity section is present
 *  - commerce-operational section is present
 *  - Metadata has entityName / entityNamePlural
 *  - All sections have an id, title, modes, fields
 *  - type field is marked required
 *  - priceRange field is optional
 */

import { describe, expect, it } from 'vitest';
import { createGastronomyConsolidatedConfig } from '../config/gastronomy-consolidated.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGastronomyConsolidatedConfig', () => {
    it('should return at least 3 sections', () => {
        const config = createGastronomyConsolidatedConfig(t);
        expect(config.sections.length).toBeGreaterThanOrEqual(3);
    });

    it('should include a gastronomy-specific section', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const specificSection = config.sections.find((s) => s.id === 'gastronomy-specific');
        expect(specificSection).toBeDefined();
    });

    it('gastronomy-specific section should include a "type" field', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'gastronomy-specific');
        const typeField = section?.fields.find((f) => f.id === 'type');
        expect(typeField).toBeDefined();
    });

    it('"type" field should be required', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'gastronomy-specific');
        const typeField = section?.fields.find((f) => f.id === 'type');
        expect(typeField?.required).toBe(true);
    });

    it('gastronomy-specific section should include a "priceRange" field', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'gastronomy-specific');
        const field = section?.fields.find((f) => f.id === 'priceRange');
        expect(field).toBeDefined();
    });

    it('"priceRange" field should NOT be required', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'gastronomy-specific');
        const field = section?.fields.find((f) => f.id === 'priceRange');
        expect(field?.required).toBeFalsy();
    });

    it('gastronomy-specific section should include a "menuUrl" field', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'gastronomy-specific');
        const field = section?.fields.find((f) => f.id === 'menuUrl');
        expect(field).toBeDefined();
    });

    it('should include metadata with entityName and entityNamePlural', () => {
        const config = createGastronomyConsolidatedConfig(t);
        expect(config.metadata?.entityName).toBeTruthy();
        expect(config.metadata?.entityNamePlural).toBeTruthy();
    });

    it('all sections should have a non-empty id', () => {
        const config = createGastronomyConsolidatedConfig(t);
        for (const section of config.sections) {
            expect(section.id).toBeTruthy();
        }
    });

    it('all sections should have at least one mode', () => {
        const config = createGastronomyConsolidatedConfig(t);
        for (const section of config.sections) {
            expect(section.modes?.length).toBeGreaterThan(0);
        }
    });

    it('all sections should have at least one field', () => {
        const config = createGastronomyConsolidatedConfig(t);
        for (const section of config.sections) {
            expect(section.fields.length).toBeGreaterThan(0);
        }
    });

    it('type field should have select options for all gastronomy types', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'gastronomy-specific');
        const typeField = section?.fields.find((f) => f.id === 'type');
        const options = (typeField?.typeConfig as { options?: { value: string }[] })?.options ?? [];
        const values = options.map((o) => o.value);
        expect(values).toContain('RESTAURANT');
        expect(values).toContain('BAR');
        expect(values).toContain('CAFE');
        expect(values).toContain('FOOD_TRUCK');
    });

    it('priceRange field should have select options for all price ranges', () => {
        const config = createGastronomyConsolidatedConfig(t);
        const section = config.sections.find((s) => s.id === 'gastronomy-specific');
        const field = section?.fields.find((f) => f.id === 'priceRange');
        const options = (field?.typeConfig as { options?: { value: string }[] })?.options ?? [];
        const values = options.map((o) => o.value);
        expect(values).toContain('BUDGET');
        expect(values).toContain('MID');
        expect(values).toContain('HIGH');
        expect(values).toContain('PREMIUM');
    });
});
