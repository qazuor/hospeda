import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';

/**
 * Available modes for sections and fields
 */
export type ConfigMode = 'view' | 'edit' | 'create';

/**
 * Mode-specific configuration for fields
 */
export interface ModeSpecificFieldConfig {
    /** View mode specific configuration */
    view?: Partial<FieldConfig>;
    /** Edit mode specific configuration */
    edit?: Partial<FieldConfig>;
    /** Create mode specific configuration */
    create?: Partial<FieldConfig>;
}

/**
 * Consolidated field that supports multiple modes
 */
export interface ConsolidatedFieldConfig extends Omit<FieldConfig, 'modes'> {
    /** Modes in which this field is visible */
    modes?: ConfigMode[];
    /** Mode-specific configuration */
    modeConfig?: ModeSpecificFieldConfig;
}

/**
 * Consolidated section that supports multiple modes
 */
export interface ConsolidatedSectionConfig extends Omit<SectionConfig, 'fields' | 'modes'> {
    /** Modes in which this section is visible */
    modes: ConfigMode[];
    /** Section fields with multi-mode support */
    fields: ConsolidatedFieldConfig[];
}

/**
 * Complete consolidated entity configuration
 */
export interface ConsolidatedEntityConfig {
    /** Consolidated sections */
    sections: ConsolidatedSectionConfig[];
    /** Entity metadata */
    metadata?: {
        title?: string;
        description?: string;
        entityName?: string;
        entityNamePlural?: string;
    };
}

/**
 * Options for filtering sections by mode
 */
export interface SectionFilterOptions {
    /** Mode to filter by */
    mode: ConfigMode;
    /** Whether to include fields without a specified mode (default: true) */
    includeFieldsWithoutMode?: boolean;
    /** Whether to apply mode-specific configuration (default: true) */
    applyModeSpecificConfig?: boolean;
}
