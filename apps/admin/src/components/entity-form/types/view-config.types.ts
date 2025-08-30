import type { Actor, FieldConfig } from './field-config.types';
import type { SectionConfig } from './section-config.types';

/**
 * Props for view field components
 */
export type ViewFieldProps<T = unknown> = {
    value: T;
    field: FieldConfig;
    entity?: unknown;
    actor?: Actor;
    editInPlace?: boolean;
    onEdit?: (fieldId: string) => void;
    className?: string;
};

/**
 * Props for view section components
 */
export type ViewSectionProps = {
    section: SectionConfig;
    data: Record<string, unknown>;
    entity?: unknown;
    actor?: Actor;
    editInPlace?: boolean;
    onEdit?: (fieldId: string) => void;
    className?: string;
};

/**
 * Props for view layout components
 */
export type ViewLayoutProps = {
    sections: SectionConfig[];
    data: Record<string, unknown>;
    entity?: unknown;
    actor?: Actor;
    editInPlace?: boolean;
    onEdit?: (fieldId: string) => void;
    className?: string;
};

/**
 * View mode configuration
 */
export type ViewConfig = {
    sections: SectionConfig[];
    layout?: 'cards' | 'tabs' | 'accordion';
    editInPlace?: boolean;
    showEditButton?: boolean;
    editButtonText?: string;
    editButtonTextKey?: string; // i18n key
};
