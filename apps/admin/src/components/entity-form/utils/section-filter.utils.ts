import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import type {
    ConfigMode,
    ConsolidatedFieldConfig,
    ConsolidatedSectionConfig,
    SectionFilterOptions
} from '@/features/accommodations/types/consolidated-config.types';

/**
 * Filtra campos por modo específico
 *
 * @param fields - Array de campos consolidados
 * @param mode - Modo para filtrar
 * @param options - Opciones de filtrado
 * @returns Array de campos filtrados y configurados para el modo
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
            // Si el campo no tiene modos especificados, incluirlo según la opción
            if (!field.modes || field.modes.length === 0) {
                return includeFieldsWithoutMode;
            }

            // Verificar si el campo es visible en este modo
            return field.modes.includes(mode);
        })
        .map((field) => {
            // Si no se debe aplicar configuración específica del modo, retornar tal como está
            if (!applyModeSpecificConfig || !field.modeConfig) {
                return field;
            }

            // Aplicar configuración específica del modo si existe
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
 * Filtra secciones por modo específico
 *
 * @param sections - Array de secciones consolidadas
 * @param mode - Modo para filtrar ('view', 'edit', 'create')
 * @param options - Opciones de filtrado
 * @returns Array de secciones filtradas para el modo especificado
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
            // Verificar si la sección es visible en este modo
            return section.modes.includes(mode);
        })
        .map((section) => {
            // Filtrar campos de la sección por el modo
            const filteredFields = filterFieldsByMode(section.fields, mode, {
                includeFieldsWithoutMode,
                applyModeSpecificConfig
            });

            // Retornar sección con campos filtrados
            return {
                ...section,
                fields: filteredFields
            } as SectionConfig;
        })
        .filter((section) => {
            // Excluir secciones que no tienen campos después del filtrado
            return section.fields.length > 0;
        });
};

/**
 * Obtiene todos los modos únicos de un conjunto de secciones consolidadas
 *
 * @param sections - Array de secciones consolidadas
 * @returns Array de modos únicos
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
 * Valida que una configuración consolidada sea válida
 *
 * @param sections - Array de secciones consolidadas a validar
 * @returns Objeto con resultado de validación y errores si los hay
 */
export const validateConsolidatedConfig = (
    sections: ConsolidatedSectionConfig[]
): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    sections.forEach((section, sectionIndex) => {
        // Validar que la sección tenga al menos un modo
        if (!section.modes || section.modes.length === 0) {
            errors.push(`Section at index ${sectionIndex} (${section.id}) has no modes defined`);
        }

        // Validar que la sección tenga campos
        if (!section.fields || section.fields.length === 0) {
            errors.push(`Section at index ${sectionIndex} (${section.id}) has no fields defined`);
        }

        // Validar campos
        section.fields?.forEach((field: ConsolidatedFieldConfig, fieldIndex: number) => {
            // Validar que el campo tenga ID
            if (!field.id) {
                errors.push(`Field at index ${fieldIndex} in section ${section.id} has no ID`);
            }

            // Validar que si tiene modos específicos, sean válidos
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
