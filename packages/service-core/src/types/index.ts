import type {
    BaseSearchSchema,
    EntityPermissionReasonEnum,
    HttpPaginationSchema,
    HttpSortingSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { ServiceLogger } from '../utils/service-logger';

export type { ServiceLogger };

/**
 * Represents the shared context for all services.
 * @property {ServiceLogger} logger - The logger instance.
 */
export type ServiceContext = {
    logger?: ServiceLogger;
};

/**
 * Represents an actor in the system (user or service) that can perform actions.
 * @interface Actor
 */
export type Actor = {
    /** Unique identifier of the actor */
    id: string;
    /** Role of the actor in the system */
    role: RoleEnum;
    /** Permissions assigned to the actor (direct + by role) */
    permissions: readonly PermissionEnum[];
    /** Entitlements granted to the actor (VIP access, premium features, etc.) */
    entitlements?: Set<string>;
    /** Flag indicating this is a system actor, not a real user */
    _isSystemActor?: boolean;
};

/**
 * Generic type for service input that includes an actor.
 * @template T - The type of the input data
 */
export type ServiceInput<T> = {
    /** The actor performing the action */
    actor: Actor;
} & T;

/**
 * Generic type for service output that can be either a success or an error.
 * @template T - The type of the success data
 */
export type ServiceOutput<T> =
    | {
          /** The success data */
          data: T;
          /** Error is never present in success case */
          error?: never;
      }
    | {
          /** Data is never present in error case */
          data?: never;
          /** The error information */
          error: {
              /** Error code */
              code: ServiceErrorCode;
              /** Error message */
              message: string;
              /** Optional additional details for debugging or context */
              details?: unknown;
          };
      };

/**
 * Result of a view permission check.
 * @interface CanViewResult
 */
export type CanViewResult = {
    /** Whether the actor can view the entity */
    canView: boolean;
    /** Reason for the permission result */
    reason: EntityPermissionReasonEnum;
};

/**
 * Result of an update permission check.
 * @interface CanUpdateResult
 */
export type CanUpdateResult = {
    /** Whether the actor can update the entity */
    canUpdate: boolean;
    /** Reason for the permission result */
    reason: EntityPermissionReasonEnum;
};

/**
 * Result of a delete permission check.
 * @interface CanDeleteResult
 */
export type CanDeleteResult = {
    /** Whether the actor can delete the entity */
    canDelete: boolean;
    /** Reason for the permission result */
    reason: EntityPermissionReasonEnum;
};

/**
 * Result of a create permission check.
 * @interface CanCreateResult
 */
export type CanCreateResult = {
    /** Whether the actor can create the entity */
    canCreate: boolean;
    /** Reason for the permission result */
    reason: EntityPermissionReasonEnum;
};

/**
 * Result of a restore permission check.
 * @interface CanRestoreResult
 */
export type CanRestoreResult = {
    /** Whether the actor can restore the entity */
    canRestore: boolean;
    /** Reason for the permission result */
    reason: EntityPermissionReasonEnum;
};

export type CanHardDeleteResult = {
    canHardDelete: boolean;
    reason: EntityPermissionReasonEnum;
    checkedPermission: PermissionEnum;
};

/**
 * Custom error class for service errors.
 * @extends {Error}
 */
export class ServiceError extends Error {
    /**
     * Creates a new ServiceError.
     * @param {ServiceErrorCode} code - The error code
     * @param {string} message - The error message
     * @param {unknown} [details] - Optional additional details for debugging or context
     */
    constructor(
        public code: ServiceErrorCode,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}

export type { PaginatedListOutput } from '@repo/schemas';
export type { BaseModel, DrizzleClient } from '@repo/db';

// --- Search Types ---
export type SortingType = z.infer<typeof HttpSortingSchema>;
export type PaginationType = z.infer<typeof HttpPaginationSchema>;
export type BaseSearchType = z.infer<typeof BaseSearchSchema>;

/**
 * Parameter type for `_executeAdminSearch()` in BaseCrudRead and service overrides.
 * Contains the assembled query parameters for admin list endpoints.
 */
export type AdminSearchExecuteParams<TEntityFilters = Record<string, unknown>> = {
    /** Base where clause (status, soft-delete, date range filters) */
    readonly where: Record<string, unknown>;
    /** Entity-specific filters extracted from the admin search schema */
    readonly entityFilters: TEntityFilters;
    /** Pagination parameters */
    readonly pagination: { readonly page: number; readonly pageSize: number };
    /** Sort parameters */
    readonly sort: { readonly sortBy: string; readonly sortOrder: 'asc' | 'desc' };
    /** Optional SQL condition for text search */
    readonly search?: SQL;
    /** Optional additional SQL conditions */
    readonly extraConditions?: SQL[];
    /** The actor performing the action */
    readonly actor: Actor;
};
