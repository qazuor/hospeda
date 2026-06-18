// @vitest-environment jsdom
/**
 * @file experience-consolidated.config.test.ts
 * Unit tests for the experience consolidated entity config (SPEC-240 T-032).
 *
 * Covers:
 *  - Three sections are returned in the correct order (identity, specific, operational)
 *  - Experience-specific section contains required fields (type, priceFrom, priceUnit, isPriceOnRequest)
 *  - type field has SELECT options for all ExperienceTypeEnum values
 *  - priceUnit field has SELECT options for all billing units
 *  - Metadata includes entityName and entityNamePlural from i18n
 *  - Commerce identity section is first (identity-gating: ownerId is view/edit only, not create)
 *  - Commerce operational section is last
 *
 * Owner field-gating validation: ownerId field in the identity section is
 * constrained to modes ['view', 'edit'] (not 'create') — only admins can
 * assign owners AFTER creation. This mirrors the gastronomy pattern and is
 * required by AC-4.1 (SPEC-240).
 */

import { ExperienceTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { createExperienceConsolidatedConfig } from '../config/experience-consolidated.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal translation function stub. */
const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createExperienceConsolidatedConfig — sections', () => {
    it('should return exactly 3 sections', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections).toHaveLength(3);
    });

    it('should have commerce-identity as the first section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[0]?.id).toBe('commerce-identity');
    });

    it('should have experience-specific as the second section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[1]?.id).toBe('experience-specific');
    });

    it('should have commerce-operational as the third section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[2]?.id).toBe('commerce-operational');
    });
});

describe('createExperienceConsolidatedConfig — experience-specific section fields', () => {
    function getSpecificSection() {
        const config = createExperienceConsolidatedConfig(t as never);
        return config.sections[1];
    }

    it('should include a "type" field', () => {
        const section = getSpecificSection();
        expect(section?.fields.find((f) => f.id === 'type')).toBeDefined();
    });

    it('"type" field should be required', () => {
        const section = getSpecificSection();
        const typeField = section?.fields.find((f) => f.id === 'type');
        expect(typeField?.required).toBe(true);
    });

    it('"type" field should have SELECT type', () => {
        const section = getSpecificSection();
        const typeField = section?.fields.find((f) => f.id === 'type');
        expect(typeField?.type).toBe('SELECT');
    });

    it('"type" field SELECT options should include all ExperienceTypeEnum values', () => {
        const section = getSpecificSection();
        const typeField = section?.fields.find((f) => f.id === 'type');
        const options =
            typeField?.typeConfig && 'options' in typeField.typeConfig
                ? (typeField.typeConfig.options as { value: string }[])
                : [];
        const values = options.map((o) => o.value);
        const EXPECTED = Object.values(ExperienceTypeEnum);
        for (const v of EXPECTED) {
            expect(values).toContain(v);
        }
    });

    it('should include a "priceUnit" field', () => {
        const section = getSpecificSection();
        expect(section?.fields.find((f) => f.id === 'priceUnit')).toBeDefined();
    });

    it('"priceUnit" field SELECT options should include per_day, per_hour, per_person, per_group', () => {
        const section = getSpecificSection();
        const priceUnitField = section?.fields.find((f) => f.id === 'priceUnit');
        const options =
            priceUnitField?.typeConfig && 'options' in priceUnitField.typeConfig
                ? (priceUnitField.typeConfig.options as { value: string }[])
                : [];
        const values = options.map((o) => o.value);
        expect(values).toContain('per_day');
        expect(values).toContain('per_hour');
        expect(values).toContain('per_person');
        expect(values).toContain('per_group');
    });

    it('should include a "priceFrom" field', () => {
        const section = getSpecificSection();
        expect(section?.fields.find((f) => f.id === 'priceFrom')).toBeDefined();
    });

    it('"priceFrom" field should be optional', () => {
        const section = getSpecificSection();
        const priceFomField = section?.fields.find((f) => f.id === 'priceFrom');
        expect(priceFomField?.required).toBe(false);
    });

    it('should include a "isPriceOnRequest" field', () => {
        const section = getSpecificSection();
        expect(section?.fields.find((f) => f.id === 'isPriceOnRequest')).toBeDefined();
    });
});

describe('createExperienceConsolidatedConfig — owner field-gating', () => {
    it('ownerId in identity section should be available in view and edit modes only (not create)', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        const identitySection = config.sections[0];
        const ownerField = identitySection?.fields.find((f) => f.id === 'ownerId');
        // Owner assignment is admin-only and is done post-creation via assign-owner action;
        // the consolidated form does not include ownerId in 'create' mode.
        expect(ownerField).toBeDefined();
        expect(ownerField?.modes).toContain('view');
        expect(ownerField?.modes).toContain('edit');
        expect(ownerField?.modes).not.toContain('create');
    });
});

describe('createExperienceConsolidatedConfig — metadata', () => {
    it('should return metadata with title, description, entityName, entityNamePlural', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.metadata).toBeDefined();
        expect(config.metadata?.title).toBeTruthy();
        expect(config.metadata?.description).toBeTruthy();
        expect(config.metadata?.entityName).toBeTruthy();
        expect(config.metadata?.entityNamePlural).toBeTruthy();
    });

    it('should call the translation function for metadata keys', () => {
        const tMock = vi.fn((key: string) => key);
        createExperienceConsolidatedConfig(tMock as never);
        expect(tMock).toHaveBeenCalled();
    });
});
