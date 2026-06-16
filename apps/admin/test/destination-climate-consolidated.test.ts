/**
 * @file destination-climate-consolidated.test.ts
 * @description Tests for the Climate section of the destination consolidated config (SPEC-215).
 *
 * Verifies:
 *   - Climate section is present in the consolidated config with correct id and modes.
 *   - All expected climate fields are registered (bestSeason, bestMonths, all season
 *     temp/rainfall fields, and note).
 *   - bestSeason is a SELECT field with the four ClimateSeasonEnum options.
 *   - Number fields carry correct min/max constraints matching DestinationClimateSchema.
 *   - DestinationClimateSchema (Zod) rejects out-of-range temperature values.
 *   - DestinationClimateSchema accepts a fully valid climate payload.
 *   - The submitted payload shape matches the expected `climate` nested object.
 *
 * Mirrors the structure of `apps/admin/test/destination-consolidated.test.ts`.
 */

import { DestinationClimateSchema } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { FieldTypeEnum } from '../src/components/entity-form/enums/form-config.enums';
import { createDestinationConsolidatedConfig } from '../src/features/destinations/config/destination-consolidated.config';

const mockT = vi.fn((key: string) => key) as ReturnType<
    typeof import('@repo/i18n').useTranslations
>['t'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the climate section from the consolidated config, throwing if absent. */
function getClimateSection() {
    const config = createDestinationConsolidatedConfig(mockT);
    const section = config.sections.find((s) => s.id === 'climate');
    if (!section) throw new Error('Climate section not found in destination consolidated config');
    return section;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DestinationConsolidatedConfig — Climate section (SPEC-215)', () => {
    describe('section registration', () => {
        it('includes the climate section in the consolidated config', () => {
            const config = createDestinationConsolidatedConfig(mockT);
            const ids = config.sections.map((s) => s.id);

            expect(ids).toContain('climate');
        });

        it('climate section has view and edit modes (not create)', () => {
            const section = getClimateSection();

            expect(section.modes).toContain('view');
            expect(section.modes).toContain('edit');
            expect(section.modes).not.toContain('create');
        });

        it('climate section has a non-empty title', () => {
            const section = getClimateSection();

            expect(section.title).toBeTruthy();
        });
    });

    describe('field registration', () => {
        it('registers climate.bestSeason field', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.bestSeason');

            expect(field).toBeDefined();
        });

        it('registers climate.bestMonths field', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.bestMonths');

            expect(field).toBeDefined();
        });

        it('registers all four season temperature fields (min + max per season)', () => {
            const section = getClimateSection();
            const fieldIds = section.fields.map((f) => f.id);

            for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
                expect(fieldIds).toContain(`climate.seasons.${season}.avgTempMinC`);
                expect(fieldIds).toContain(`climate.seasons.${season}.avgTempMaxC`);
            }
        });

        it('registers all four season rainfall fields', () => {
            const section = getClimateSection();
            const fieldIds = section.fields.map((f) => f.id);

            for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
                expect(fieldIds).toContain(`climate.seasons.${season}.rainfallMm`);
            }
        });

        it('registers climate.note i18n text field', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.note');

            expect(field).toBeDefined();
        });
    });

    describe('bestSeason field config', () => {
        it('is a SELECT field', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.bestSeason');

            expect(field?.type).toBe(FieldTypeEnum.SELECT);
        });

        it('is required', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.bestSeason');

            expect(field?.required).toBe(true);
        });

        it('offers spring, summer, autumn, winter as options', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.bestSeason');

            const options = (field?.typeConfig as { options?: { value: string }[] } | undefined)
                ?.options;
            const values = options?.map((o) => o.value) ?? [];

            expect(values).toContain('spring');
            expect(values).toContain('summer');
            expect(values).toContain('autumn');
            expect(values).toContain('winter');
            expect(values).toHaveLength(4);
        });
    });

    describe('temperature field constraints', () => {
        it('avgTempMinC fields are NUMBER fields', () => {
            const section = getClimateSection();

            for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
                const field = section.fields.find(
                    (f) => f.id === `climate.seasons.${season}.avgTempMinC`
                );
                expect(field?.type, `${season}.avgTempMinC type`).toBe(FieldTypeEnum.NUMBER);
            }
        });

        it('avgTempMaxC fields are NUMBER fields', () => {
            const section = getClimateSection();

            for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
                const field = section.fields.find(
                    (f) => f.id === `climate.seasons.${season}.avgTempMaxC`
                );
                expect(field?.type, `${season}.avgTempMaxC type`).toBe(FieldTypeEnum.NUMBER);
            }
        });

        it('temperature NUMBER fields carry min: -60 and max: 60 constraints', () => {
            const section = getClimateSection();

            for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
                for (const subField of ['avgTempMinC', 'avgTempMaxC'] as const) {
                    const field = section.fields.find(
                        (f) => f.id === `climate.seasons.${season}.${subField}`
                    );
                    const tc = field?.typeConfig as { min?: number; max?: number } | undefined;
                    expect(tc?.min, `${season}.${subField} min`).toBe(-60);
                    expect(tc?.max, `${season}.${subField} max`).toBe(60);
                }
            }
        });

        it('rainfallMm NUMBER fields are not required', () => {
            const section = getClimateSection();

            for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
                const field = section.fields.find(
                    (f) => f.id === `climate.seasons.${season}.rainfallMm`
                );
                expect(field?.required, `${season}.rainfallMm required`).toBeFalsy();
            }
        });

        it('rainfallMm fields carry min: 0 and max: 20000', () => {
            const section = getClimateSection();

            for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
                const field = section.fields.find(
                    (f) => f.id === `climate.seasons.${season}.rainfallMm`
                );
                const tc = field?.typeConfig as { min?: number; max?: number } | undefined;
                expect(tc?.min, `${season}.rainfallMm min`).toBe(0);
                expect(tc?.max, `${season}.rainfallMm max`).toBe(20000);
            }
        });
    });

    describe('note field config', () => {
        it('climate.note is an I18N_TEXT field', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.note');

            expect(field?.type).toBe(FieldTypeEnum.I18N_TEXT);
        });

        it('climate.note is not required', () => {
            const section = getClimateSection();
            const field = section.fields.find((f) => f.id === 'climate.note');

            expect(field?.required).toBeFalsy();
        });
    });

    describe('DestinationClimateSchema Zod validation', () => {
        it('accepts a valid climate payload', () => {
            // Arrange
            const validClimate = {
                bestSeason: 'summer',
                bestMonths: 'Diciembre a Marzo',
                seasons: {
                    spring: { avgTempMinC: 12, avgTempMaxC: 24, rainfallMm: 80 },
                    summer: { avgTempMinC: 20, avgTempMaxC: 35 },
                    autumn: { avgTempMinC: 10, avgTempMaxC: 22, rainfallMm: 60 },
                    winter: { avgTempMinC: 4, avgTempMaxC: 14 }
                },
                note: { es: 'Verano caluroso', en: 'Hot summer', pt: 'Verão quente' }
            };

            // Act
            const result = DestinationClimateSchema.safeParse(validClimate);

            // Assert
            expect(result.success).toBe(true);
        });

        it('accepts a minimal climate payload (only bestSeason + empty seasons)', () => {
            // Arrange
            const minimalClimate = {
                bestSeason: 'winter',
                seasons: {}
            };

            // Act
            const result = DestinationClimateSchema.safeParse(minimalClimate);

            // Assert
            expect(result.success).toBe(true);
        });

        it('rejects avgTempMinC below -60', () => {
            // Arrange
            const badPayload = {
                bestSeason: 'spring',
                seasons: {
                    spring: { avgTempMinC: -61, avgTempMaxC: 10 }
                }
            };

            // Act
            const result = DestinationClimateSchema.safeParse(badPayload);

            // Assert
            expect(result.success).toBe(false);
            const issues = result.success ? [] : result.error.issues;
            expect(issues.some((i) => i.path.includes('avgTempMinC'))).toBe(true);
        });

        it('rejects avgTempMaxC above 60', () => {
            // Arrange
            const badPayload = {
                bestSeason: 'summer',
                seasons: {
                    summer: { avgTempMinC: 20, avgTempMaxC: 61 }
                }
            };

            // Act
            const result = DestinationClimateSchema.safeParse(badPayload);

            // Assert
            expect(result.success).toBe(false);
            const issues = result.success ? [] : result.error.issues;
            expect(issues.some((i) => i.path.includes('avgTempMaxC'))).toBe(true);
        });

        it('rejects a non-integer temperature', () => {
            // Arrange
            const badPayload = {
                bestSeason: 'spring',
                seasons: {
                    spring: { avgTempMinC: 10.5, avgTempMaxC: 20 }
                }
            };

            // Act
            const result = DestinationClimateSchema.safeParse(badPayload);

            // Assert
            expect(result.success).toBe(false);
        });

        it('rejects an invalid bestSeason value', () => {
            // Arrange
            const badPayload = {
                bestSeason: 'monsoon',
                seasons: {}
            };

            // Act
            const result = DestinationClimateSchema.safeParse(badPayload);

            // Assert
            expect(result.success).toBe(false);
        });

        it('rejects bestMonths longer than 50 chars', () => {
            // Arrange
            const badPayload = {
                bestSeason: 'autumn',
                bestMonths: 'a'.repeat(51),
                seasons: {}
            };

            // Act
            const result = DestinationClimateSchema.safeParse(badPayload);

            // Assert
            expect(result.success).toBe(false);
        });

        it('parsed payload carries the climate object in the expected nested shape', () => {
            // Arrange
            const input = {
                bestSeason: 'spring',
                bestMonths: 'Octubre y Noviembre',
                seasons: {
                    spring: { avgTempMinC: 10, avgTempMaxC: 22 }
                }
            };

            // Act
            const result = DestinationClimateSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.bestSeason).toBe('spring');
            expect(result.data.bestMonths).toBe('Octubre y Noviembre');
            expect(result.data.seasons.spring?.avgTempMinC).toBe(10);
            expect(result.data.seasons.spring?.avgTempMaxC).toBe(22);
            expect(result.data.note).toBeUndefined();
        });
    });
});
