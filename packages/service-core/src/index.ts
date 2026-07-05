/**
 * --- BASE ---
 * Exports the foundational abstract `BaseService` class.
 */

/**
 * --- ENUMS (re-exported to prevent warnings and expose them to consumers) ---
 */
export {
    EntityPermissionReasonEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
export * from './base';
/**
 * --- REVALIDATION ---
 * Exports ISR revalidation adapter interfaces and implementations.
 */
export * from './revalidation';

/**
 * --- SERVICES ---
 * Exports all concrete service implementations.
 */
export * from './services';
/**
 * --- TRANSLATION ---
 * Exports translation service interface and singleton management (SPEC-212).
 */
export * from './translation/translation-init';
/**
 * --- TYPES ---
 * Exports all shared types for the service layer, including `Actor`, `ServiceError`,
 * `ServiceOutput`, and permission-related types.
 */
export * from './types';
/**
 * --- UTILS ---
 * Exports utility functions for logging and validation.
 */
export * from './utils';
