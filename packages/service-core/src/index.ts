/**
 * --- BASE ---
 * Exports the foundational abstract `BaseService` class.
 */
export * from './base';

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

/**
 * --- SERVICES ---
 * Exports all concrete service implementations.
 */
export * from './services/accommodation/accommodation.service';

/**
 * --- ENUMS (re-exported to prevent warnings and expose them to consumers) ---
 */
export {
    EntityPermissionReasonEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
