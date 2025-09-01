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

// Context and Providers
export * from './context';
export * from './hooks';
export * from './providers';

// Field Components (Form Inputs)
export * from './fields';

// View Components (Data Display)
export * from './views';

// Layout Components
export * from './layouts';

// Section Components
export * from './sections';

// Main Layout Component
export { EntityFormLayout, type EntityFormLayoutProps } from './EntityFormLayout';
