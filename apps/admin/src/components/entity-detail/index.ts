/**
 * @file Entity Detail System Index
 *
 * Central export file for the complete entity detail configuration system.
 * This includes layouts, field renderers, types, and utilities.
 */

// Core types and configurations
export * from './types';

// Layout system
export * from './layouts';

// Field rendering system
export * from './field-renderers';

// Utility functions and factories
export { validateFieldConfig } from './field-renderers/FieldRenderer';
export {
    createGapClasses,
    createResponsiveClasses,
    useLayoutValidation
} from './layouts/ConfigurableLayout';
