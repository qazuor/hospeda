import { describe, expect, it, vi } from 'vitest';
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
            expect(config.metadata?.title).toBe('Accommodation');
        });

        it('should have basic-info section with correct structure', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const basicInfoSection = config.sections[0];

            expect(basicInfoSection.id).toBe('basic-info');
            expect(basicInfoSection.modes).toEqual(['view', 'edit', 'create']);
            expect(basicInfoSection.fields).toHaveLength(6); // name, description, type, isFeatured, destinationId, ownerId
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

            // Todos los campos deben estar presentes en view mode
            expect(viewSections[0].fields).toHaveLength(6);
        });

        it('should filter sections correctly for edit mode', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const editSections = filterSectionsByMode(config.sections, 'edit');

            expect(editSections).toHaveLength(6);
            expect(editSections[0].id).toBe('basic-info');

            // Todos los campos deben estar presentes en edit mode
            expect(editSections[0].fields).toHaveLength(6);
        });

        it('should filter sections correctly for create mode', () => {
            const config = createAccommodationConsolidatedConfig(
                mockT,
                mockAccommodationTypeOptions
            );
            const createSections = filterSectionsByMode(config.sections, 'create');

            expect(createSections).toHaveLength(5);
            expect(createSections[0].id).toBe('basic-info');

            // isFeatured no debe estar presente en create mode
            const fieldIds = createSections[0].fields.map((field) => field.id);
            expect(fieldIds).not.toContain('isFeatured');
            expect(createSections[0].fields).toHaveLength(5);
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
});
