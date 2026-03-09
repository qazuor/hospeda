import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import type {
    ConfigMode,
    ConsolidatedFieldConfig,
    ConsolidatedSectionConfig,
    SectionFilterOptions
} from '@/features/accommodations/types/consolidated-config.types';

/**
 * Filters fields by a specific mode
 *
 * @param fields - Array of consolidated fields
 * @param mode - Mode to filter by
 * @param options - Filtering options
 * @returns Array of fields filtered and configured for the mode
 */
export const filterFieldsByMode = (
    fields: ConsolidatedFieldConfig[],
    mode: ConfigMode,
    options: Pick<SectionFilterOptions, 'includeFieldsWithoutMode' | 'applyModeSpecificConfig'> = {
        includeFieldsWithoutMode: true,
        applyModeSpecificConfig: true
    }
): ConsolidatedFieldConfig[] => {
    const { includeFieldsWithoutMode = true, applyModeSpecificConfig = true } = options;

    return fields
        .filter((field) => {
            // If the field has no specified modes, include it based on the option
            if (!field.modes || field.modes.length === 0) {
                return includeFieldsWithoutMode;
            }

            // Check if the field is visible in this mode
            return field.modes.includes(mode);
        })
        .map((field) => {
            // If mode-specific config should not be applied, return as-is
            if (!applyModeSpecificConfig || !field.modeConfig) {
                return field;
            }

            // Apply mode-specific configuration if it exists
            const modeSpecificConfig = field.modeConfig[mode];
            if (modeSpecificConfig) {
                return {
                    ...field,
                    ...modeSpecificConfig
                };
            }

            return field;
        });
};

/**
 * Filters sections by a specific mode
 *
 * @param sections - Array of consolidated sections
 * @param mode - Mode to filter by ('view', 'edit', 'create')
 * @param options - Filtering options
 * @returns Array of sections filtered for the specified mode
 *
 * @example
 * ```typescript
 * const viewSections = filterSectionsByMode(consolidatedSections, 'view');
 * const editSections = filterSectionsByMode(consolidatedSections, 'edit');
 * ```
 */
export const filterSectionsByMode = (
    sections: ConsolidatedSectionConfig[],
    mode: ConfigMode,
    options: SectionFilterOptions = { mode }
): SectionConfig[] => {
    const { includeFieldsWithoutMode = true, applyModeSpecificConfig = true } = options;

    return sections
        .filter((section) => {
            // Check if the section is visible in this mode
            return section.modes.includes(mode);
        })
        .map((section) => {
            // Filter section fields by mode
            const filteredFields = filterFieldsByMode(section.fields, mode, {
                includeFieldsWithoutMode,
                applyModeSpecificConfig
            });

            // Return section with filtered fields
            return {
                ...section,
                fields: filteredFields
            } as SectionConfig;
        })
        .filter((section) => {
            // Exclude sections that have no fields after filtering
            return section.fields.length > 0;
        });
};

/**
 * Gets all unique modes from a set of consolidated sections
 *
 * @param sections - Array of consolidated sections
 * @returns Array of unique modes
 */
export const getAvailableModes = (sections: ConsolidatedSectionConfig[]): ConfigMode[] => {
    const modesSet = new Set<ConfigMode>();

    for (const section of sections) {
        for (const mode of section.modes) {
            modesSet.add(mode);
        }
    }

    return Array.from(modesSet);
};

/**
 * Validates that a consolidated configuration is valid
 *
 * @param sections - Array of consolidated sections to validate
 * @returns Object with the validation result and errors if any
 */
export const validateConsolidatedConfig = (
    sections: ConsolidatedSectionConfig[]
): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    sections.forEach((section, sectionIndex) => {
        // Validate that the section has at least one mode
        if (!section.modes || section.modes.length === 0) {
            errors.push(`Section at index ${sectionIndex} (${section.id}) has no modes defined`);
        }

        // Validate that the section has fields
        if (!section.fields || section.fields.length === 0) {
            errors.push(`Section at index ${sectionIndex} (${section.id}) has no fields defined`);
        }

        // Validate fields
        section.fields?.forEach((field: ConsolidatedFieldConfig, fieldIndex: number) => {
            // Validate that the field has an ID
            if (!field.id) {
                errors.push(`Field at index ${fieldIndex} in section ${section.id} has no ID`);
            }

            // Validate that if specific modes are defined, they are valid
            if (field.modes) {
                const invalidModes = field.modes.filter(
                    (mode: string) => !['view', 'edit', 'create'].includes(mode)
                );
                if (invalidModes.length > 0) {
                    errors.push(
                        `Field ${field.id} in section ${section.id} has invalid modes: ${invalidModes.join(', ')}`
                    );
                }
            }
        });
    });

    return {
        isValid: errors.length === 0,
        errors
    };
};
