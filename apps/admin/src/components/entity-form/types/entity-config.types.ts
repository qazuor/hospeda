import type { ZodSchema } from 'zod';
import type { AutosaveStrategyEnum } from '../enums/form-config.enums';
import type { SectionConfig } from './section-config.types';
import type { ViewConfig } from './view-config.types';

/**
 * Route configuration for entity pages
 */
export type EntityRouteConfig = {
    base: string; // e.g., '/accommodations'
    view: string; // e.g., '/accommodations/$id'
    edit: string; // e.g., '/accommodations/$id/edit'
    create?: string; // e.g., '/accommodations/new'
    sections: Record<string, string>; // section id -> route
    editSections: Record<string, string>; // section id -> edit route
};

/**
 * Validation configuration for entity
 */
export type EntityValidationConfig = {
    entitySchema?: ZodSchema; // Main entity schema
    sectionSchemas?: Record<string, ZodSchema>; // Section-specific schemas
    crossSectionValidation?: Array<{
        sections: string[];
        validator: (data: Record<string, unknown>) => Promise<boolean> | boolean;
        errorMessageKey: string; // i18n key
    }>;
};

/**
 * Autosave configuration (prepared for future)
 */
export type AutosaveConfig = {
    enabled: boolean;
    strategy: AutosaveStrategyEnum;
    debounceMs?: number;
    sections?: string[]; // Sections that support autosave
    fields?: string[]; // Fields that support autosave
    onSave?: (data: Record<string, unknown>) => Promise<void>;
    onError?: (error: Error) => void;
};

/**
 * Main entity configuration type
 */
export type EntityConfig = {
    entityType: string;
    entityName: string; // i18n key
    entityNamePlural: string; // i18n key

    // Sections for different modes
    viewSections: SectionConfig[];
    editSections: SectionConfig[];
    createSections?: SectionConfig[]; // If different from edit

    // View configuration
    viewConfig?: ViewConfig;

    // Route configuration
    routes: EntityRouteConfig;

    // Base permissions for the entity
    permissions: {
        view: string[];
        edit: string[];
        create: string[];
        delete: string[];
    };

    // Validation configuration
    validation?: EntityValidationConfig;

    // Autosave configuration (prepared for future)
    autosave?: AutosaveConfig;

    // Entity-specific metadata
    metadata?: {
        icon?: string;
        color?: string;
        description?: string; // i18n key
        tags?: string[];
    };
};
