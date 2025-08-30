/**
 * Entity Form System
 *
 * This module exports the complete entity form system including:
 * - Field components for form inputs
 * - View components for data display
 * - Layout components for organizing content
 * - Section components for grouping fields
 * - Types and configurations
 */

// Core Types
export type * from './types/entity-config.types';
export type * from './types/field-config.types';
export type * from './types/section-config.types';
export type * from './types/view-config.types';

// Enums
export * from './enums/form-config.enums';

// Field Components (Form Inputs)
export * from './fields';

// View Components (Data Display)
export * from './views';

// Layout Components
export * from './layouts';

// Section Components
export * from './sections';

// TODO [c4a5ba4c-12d4-4ef0-8873-96fbfdd771c5]: Add main form and view renderers
// export { EntityFormRenderer } from './EntityFormRenderer';
// export type { EntityFormRendererProps } from './EntityFormRenderer';

// export { EntityViewRenderer } from './EntityViewRenderer';
// export type { EntityViewRendererProps } from './EntityViewRenderer';
