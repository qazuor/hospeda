import { describe, expect, it, vi } from 'vitest';
import {
    FieldTypeEnum,
    RichTextFeatureEnum
} from '../src/components/entity-form/enums/form-config.enums';
import {
    filterSectionsByMode,
    validateConsolidatedConfig
} from '../src/components/entity-form/utils/section-filter.utils';
import { createAccommodationConsolidatedConfig } from '../src/features/accommodations/config/accommodation-consolidated.config';

// Mock de la función de traducción
const mockT = vi.fn((key: string) => key) as ReturnType<
    typeof import('@repo/i18n').useTranslations
>['t'];

// Mock de opciones de accommodation type
const mockAccommodationTypeOptions = [
    { value: 'HOTEL', label: 'Hotel' },
    { value: 'CABIN', label: 'Cabin' },
    { value: 'HOSTEL', label: 'Hostel' }
];

describe('AccommodationConsolidatedConfig', () => {
    describe('createAccommodationConsolidatedConfig', () => {
        it('should create a valid consolidated configuration', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );

            expect(config).toBeDefined();
            expect(config.sections).toHaveLength(7); // Todas las secciones consolidadas
            expect(config.metadata).toBeDefined();
            // mockT returns the i18n key verbatim; the real translated value is 'Accommodation'
            expect(config.metadata?.title).toBe('admin-entities.entities.accommodation.singular');
        });

        it('should have basic-info section with correct structure', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const basicInfoSection = config.sections[0];

            expect(basicInfoSection.id).toBe('basic-info');
            expect(basicInfoSection.modes).toEqual(['view', 'edit', 'create']);
            expect(basicInfoSection.fields).toHaveLength(8); // name, summary, description, richDescription, type, isFeatured, destinationId, ownerId
        });

        it('should have all required fields in basic-info section', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const basicInfoSection = config.sections[0];
            const fieldIds = basicInfoSection.fields.map((field) => field.id);

            expect(fieldIds).toContain('name');
            expect(fieldIds).toContain('description');
            expect(fieldIds).toContain('type');
            expect(fieldIds).toContain('isFeatured');
            expect(fieldIds).toContain('destinationId');
            expect(fieldIds).toContain('ownerId');
        });
    });

    describe('filterSectionsByMode', () => {
        it('should filter sections correctly for view mode', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const viewSections = filterSectionsByMode(config.sections, 'view');

            expect(viewSections).toHaveLength(7);
            expect(viewSections[0].id).toBe('basic-info');

            // All fields must be present in view mode
            expect(viewSections[0].fields).toHaveLength(8);
        });

        it('should filter sections correctly for edit mode', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const editSections = filterSectionsByMode(config.sections, 'edit');

            expect(editSections).toHaveLength(6);
            expect(editSections[0].id).toBe('basic-info');

            // All fields must be present in edit mode
            expect(editSections[0].fields).toHaveLength(8);
        });

        it('should filter sections correctly for create mode', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const createSections = filterSectionsByMode(config.sections, 'create');

            expect(createSections).toHaveLength(5);
            expect(createSections[0].id).toBe('basic-info');

            // isFeatured must not be present in create mode
            const fieldIds = createSections[0].fields.map((field) => field.id);
            expect(fieldIds).not.toContain('isFeatured');
            expect(createSections[0].fields).toHaveLength(7);
        });
    });

    describe('validateConsolidatedConfig', () => {
        it('should validate a correct configuration', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const validation = validateConsolidatedConfig(config.sections);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should detect invalid configuration', () => {
            const invalidConfig = [
                {
                    id: 'invalid-section',
                    modes: [], // Sin modos - debería ser inválido
                    fields: []
                }
            ];

            const validation = validateConsolidatedConfig(invalidConfig as any);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    /**
     * SPEC-187 FR-2: `accommodation.description` is plain text (TEXTAREA), not
     * RICH_TEXT. Any rich `typeConfig` (including `allowedFeatures`) MUST be dropped.
     * The existing `required: true` and `maxLength: 2000` constraints MUST be preserved.
     */
    describe('SPEC-187 FR-2 — accommodation.description is TEXTAREA (revert)', () => {
        it('declares description.type as TEXTAREA', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            expect(description).toBeDefined();
            expect(description?.type).toBe(FieldTypeEnum.TEXTAREA);
        });

        it('preserves description maxLength=2000 and required=true (no rich typeConfig)', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            expect(description?.required).toBe(true);
            const typeConfig = description?.typeConfig as
                | { maxLength?: number; allowedFeatures?: unknown; type?: string }
                | undefined;
            expect(typeConfig?.maxLength).toBe(2000);
        });

        it('drops allowedFeatures and rich type marker from description typeConfig', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            const typeConfig = description?.typeConfig as
                | { allowedFeatures?: unknown; type?: string }
                | undefined;
            expect(typeConfig?.allowedFeatures).toBeUndefined();
            // The legacy destination/post style of "type: 'RICH_TEXT'" inside typeConfig
            // must not leak into the plain TEXTAREA description.
            expect(typeConfig?.type).toBeUndefined();
        });
    });

    /**
     * SPEC-187 FR-5: `accommodation.richDescription` is RICH_TEXT premium content
     * (Phase 2 flips the type), but Phase 1 declares the toolbar matrix on the
     * existing TEXTAREA entry: full set EXCLUDING LINK.
     */
    describe('SPEC-187 FR-5 — accommodation.richDescription allowedFeatures excludes LINK', () => {
        it('declares richDescription.allowedFeatures with full set minus LINK', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const richDescription = basicInfo?.fields.find((f) => f.id === 'richDescription');

            expect(richDescription).toBeDefined();
            const typeConfig = richDescription?.typeConfig as
                | { allowedFeatures?: RichTextFeatureEnum[] }
                | undefined;
            const features = typeConfig?.allowedFeatures;

            expect(features).toBeDefined();
            // Full toolbar minus LINK per FR-5 matrix
            expect(features).toContain(RichTextFeatureEnum.BOLD);
            expect(features).toContain(RichTextFeatureEnum.ITALIC);
            expect(features).toContain(RichTextFeatureEnum.UNDERLINE);
            expect(features).toContain(RichTextFeatureEnum.LIST);
            expect(features).toContain(RichTextFeatureEnum.ORDERED_LIST);
            expect(features).toContain(RichTextFeatureEnum.HEADING);
            expect(features).toContain(RichTextFeatureEnum.QUOTE);
            // Critical assertion — LINK is the only feature that varies by entity
            expect(features).not.toContain(RichTextFeatureEnum.LINK);
        });
    });
});
