import type { SectionConfig } from '../types/section-config.types';

/**
 * Filters sections and their fields based on the current mode
 * @param sections - Array of section configurations
 * @param mode - Current form mode ('view' | 'edit')
 * @returns Filtered sections with filtered fields
 */
export const filterSectionsByMode = (
    sections: SectionConfig[],
    mode: 'view' | 'edit'
): SectionConfig[] => {
    return sections
        .filter((section) => {
            // If section has modes defined, check if current mode is included
            if (section.modes && section.modes.length > 0) {
                return section.modes.includes(mode);
            }
            // If no modes defined, include in all modes
            return true;
        })
        .map((section) => ({
            ...section,
            fields: section.fields.filter((field) => {
                // Check viewOnly/editOnly flags first
                if (field.viewOnly && mode === 'edit') return false;
                if (field.editOnly && mode === 'view') return false;

                // If field has modes defined, check if current mode is included
                if (field.modes && field.modes.length > 0) {
                    return field.modes.includes(mode);
                }

                // If no modes defined, include in all modes
                return true;
            })
        }))
        .filter((section) => section.fields.length > 0); // Remove empty sections
};

/**
 * Gets sections for view mode
 * @param sections - Array of section configurations
 * @returns Sections filtered for view mode
 */
export const getViewSections = (sections: SectionConfig[]): SectionConfig[] => {
    return filterSectionsByMode(sections, 'view');
};

/**
 * Gets sections for edit mode
 * @param sections - Array of section configurations
 * @returns Sections filtered for edit mode
 */
export const getEditSections = (sections: SectionConfig[]): SectionConfig[] => {
    return filterSectionsByMode(sections, 'edit');
};
