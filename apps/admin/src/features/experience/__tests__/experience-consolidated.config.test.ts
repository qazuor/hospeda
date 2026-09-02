// @vitest-environment jsdom
/**
 * @file experience-consolidated.config.test.ts
 * Unit tests for the experience consolidated entity config (SPEC-240 T-032).
 *
 * Covers:
 *  - Five sections are returned in the correct order (identity, specific,
 *    meeting point, practical details, operational) — the third arrived with
 *    HOS-1048 and the fourth with HOS-898/1047/1056
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

import { ExperienceTypeEnum, MAX_EXPERIENCE_DURATION_MINUTES, PermissionEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
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
    // 3 → 4 with HOS-1048's meeting-point section, 4 → 5 with the
    // practical-details one (HOS-898 / HOS-1047 / HOS-1056). The count stays
    // frozen on purpose: it is what makes a section silently dropped — or a
    // second one silently added — fail here rather than on an operator's screen.
    it('should return exactly 5 sections', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections).toHaveLength(5);
    });

    it('should have commerce-identity as the first section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[0]?.id).toBe('commerce-identity');
    });

    it('should have experience-specific as the second section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[1]?.id).toBe('experience-specific');
    });

    it('should have experience-meeting-point as the third section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[2]?.id).toBe('experience-meeting-point');
    });

    it('should have experience-practical-details as the fourth section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[3]?.id).toBe('experience-practical-details');
    });

    it('should have commerce-operational as the last section', () => {
        const config = createExperienceConsolidatedConfig(t as never);
        expect(config.sections[4]?.id).toBe('commerce-operational');
    });
});

// ---------------------------------------------------------------------------
// HOS-1048 — meeting point
// ---------------------------------------------------------------------------

describe('createExperienceConsolidatedConfig — meeting-point section (HOS-1048)', () => {
    function getMeetingPointSection() {
        const config = createExperienceConsolidatedConfig(t as never);
        return config.sections.find((s) => s.id === 'experience-meeting-point');
    }

    it('should declare exactly the three meeting-point fields, in order', () => {
        // Arrange
        const section = getMeetingPointSection();

        // Act
        const ids = section?.fields.map((field) => field.id);

        // Assert
        expect(ids).toEqual(['meetingPoint', 'meetingPointLat', 'meetingPointLong']);
    });

    it('should leave every meeting-point field optional', () => {
        // Arrange
        const section = getMeetingPointSection();

        // Act
        const required = (section?.fields ?? []).map((field) => field.required);

        // Assert — an experience may describe where to meet in words and never
        // pin it, and one that has not filled the address in must stay savable.
        expect(required).toEqual([false, false, false]);
    });

    it('should expose the meeting point in view, edit and create modes', () => {
        // Arrange
        const section = getMeetingPointSection();

        // Act
        const fieldModes = (section?.fields ?? []).map((field) => field.modes);

        // Assert
        expect(section?.modes).toEqual(['view', 'edit', 'create']);
        expect(fieldModes).toEqual([
            ['view', 'edit', 'create'],
            ['view', 'edit', 'create'],
            ['view', 'edit', 'create']
        ]);
    });

    it('should clamp the coordinates to the real WGS84 ranges', () => {
        // Arrange
        const section = getMeetingPointSection();

        // Act
        const lat = section?.fields.find((field) => field.id === 'meetingPointLat');
        const long = section?.fields.find((field) => field.id === 'meetingPointLong');

        // Assert
        expect(lat?.typeConfig).toMatchObject({ min: -90, max: 90 });
        expect(long?.typeConfig).toMatchObject({ min: -180, max: 180 });
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

// ---------------------------------------------------------------------------
// HOS-898 / HOS-1047 / HOS-1056 — practical details
// ---------------------------------------------------------------------------

describe('createExperienceConsolidatedConfig — practical-details section', () => {
    function getPracticalDetailsSection() {
        const config = createExperienceConsolidatedConfig(t as never);
        return config.sections.find((section) => section.id === 'experience-practical-details');
    }

    it('should expose durationMinutes, cancellationPolicy and acceptsPrivateGroups', () => {
        const section = getPracticalDetailsSection();
        const ids = section?.fields.map((field) => field.id);

        expect(ids).toEqual(['durationMinutes', 'cancellationPolicy', 'acceptsPrivateGroups']);
    });

    it('should NOT expose the two text[] checklists', () => {
        // Not an oversight: this form system has no string-list control, and a
        // TEXTAREA bound to a `string[]` submits a string the owner-update
        // schema rejects. Both lists are edited from the owner editor. This
        // assertion is what turns a future "just add a TEXTAREA" into a red
        // test instead of a validation error on an operator's screen.
        const ids = getPracticalDetailsSection()?.fields.map((field) => field.id) ?? [];

        expect(ids).not.toContain('whatToBring');
        expect(ids).not.toContain('requirements');
    });

    it('should keep every field optional', () => {
        // All four issues are ficha data an owner fills in over time; requiring
        // any of them would block staff from saving an existing listing.
        const section = getPracticalDetailsSection();

        expect(section?.fields.every((field) => field.required === false)).toBe(true);
    });

    it('should bound the duration to whole minutes within the schema cap', () => {
        const duration = getPracticalDetailsSection()?.fields.find(
            (field) => field.id === 'durationMinutes'
        );

        expect(duration?.type).toBe(FieldTypeEnum.NUMBER);
        // Read from the schema constant rather than restated: a literal here
        // would keep passing after the schema raised or lowered the cap, and
        // the form would silently accept a value the API rejects.
        expect(duration?.typeConfig).toMatchObject({
            min: 1,
            max: MAX_EXPERIENCE_DURATION_MINUTES,
            step: 1
        });
    });

    it('should render the private-groups flag as a switch, not a text input', () => {
        const flag = getPracticalDetailsSection()?.fields.find(
            (field) => field.id === 'acceptsPrivateGroups'
        );

        expect(flag?.type).toBe(FieldTypeEnum.SWITCH);
    });

    it('should carry ordinary commerce permissions and NO entitlement gate', () => {
        // Owner decision (2026-09-01): all of this ships from the basic tier.
        // The HOS-974 audit found three entitlements granted and demanded by no
        // route; a key per ficha field manufactures exactly that problem.
        const section = getPracticalDetailsSection();

        expect(section?.permissions?.view).toEqual([PermissionEnum.COMMERCE_VIEW_ALL]);
        expect(section?.permissions?.edit).toEqual([PermissionEnum.COMMERCE_EDIT_ALL]);
    });
});
