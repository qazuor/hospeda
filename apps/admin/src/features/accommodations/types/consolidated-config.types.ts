import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';

/**
 * Modos disponibles para secciones y campos
 */
export type ConfigMode = 'view' | 'edit' | 'create';

/**
 * Configuración específica por modo para campos
 */
export interface ModeSpecificFieldConfig {
    /** Configuración específica para modo vista */
    view?: Partial<FieldConfig>;
    /** Configuración específica para modo edición */
    edit?: Partial<FieldConfig>;
    /** Configuración específica para modo creación */
    create?: Partial<FieldConfig>;
}

/**
 * Campo consolidado que soporta múltiples modos
 */
export interface ConsolidatedFieldConfig extends Omit<FieldConfig, 'modes'> {
    /** Modos en los que este campo es visible */
    modes?: ConfigMode[];
    /** Configuración específica por modo */
    modeConfig?: ModeSpecificFieldConfig;
}

/**
 * Sección consolidada que soporta múltiples modos
 */
export interface ConsolidatedSectionConfig extends Omit<SectionConfig, 'fields' | 'modes'> {
    /** Modos en los que esta sección es visible */
    modes: ConfigMode[];
    /** Campos de la sección con soporte para múltiples modos */
    fields: ConsolidatedFieldConfig[];
}

/**
 * Configuración completa de entidad consolidada
 */
export interface ConsolidatedEntityConfig {
    /** Secciones consolidadas */
    sections: ConsolidatedSectionConfig[];
    /** Metadatos de la entidad */
    metadata?: {
        title?: string;
        description?: string;
        entityName?: string;
        entityNamePlural?: string;
    };
}

/**
 * Opciones para el filtrado de secciones por modo
 */
export interface SectionFilterOptions {
    /** Modo para el cual filtrar */
    mode: ConfigMode;
    /** Si incluir campos sin modo especificado (por defecto: true) */
    includeFieldsWithoutMode?: boolean;
    /** Si aplicar configuración específica del modo (por defecto: true) */
    applyModeSpecificConfig?: boolean;
}
