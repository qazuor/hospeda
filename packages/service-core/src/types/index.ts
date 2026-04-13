import type { QueryContext } from '@repo/db';
import type {
    BaseSearchSchema,
    EntityPermissionReasonEnum,
    HttpPaginationSchema,
    HttpSortingSchema,
    ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { ServiceLogger } from '../utils/service-logger';

export type { ServiceLogger };

/**
 * Constructor configuration for all services. Carries optional logger.
 */
export type ServiceConfig = {
    logger?: ServiceLogger;
};

/**
 * Runtime context threaded through all service method calls.
 * Extends QueryContext (from @repo/db) to carry an optional transaction
 * client, plus a per-request hookState bag that replaces singleton mutable fields.
 *
 * @template THookState - Shape of the per-request state bag for lifecycle hooks.
 *   Defaults to Record<string, unknown> for stateless services.
 */
export interface ServiceContext<THookState = Record<string, unknown>> extends QueryContext {
    /**
     * Per-request mutable state bag for lifecycle hooks.
     * Replaces instance-level mutable fields to achieve concurrency safety.
     * Initialized to {} by each public method before calling hooks.
     */
    hookState?: THookState;
}

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
 * Options accepted by `BaseCrudRead.list()`.
 *
 * Used as the parameter type for `_beforeList` hooks and to eliminate
 * `as Record<string, unknown>` casts inside `list()`.
 *
 * @property page - The page number for pagination (1-based).
 * @property pageSize - The number of items per page.
 * @property search - Optional full-text search string.
 * @property relations - Optional relations configuration for eager loading.
 * @property where - Optional base where-clause filters as a plain record.
 * @property sortBy - Optional field name to sort by.
 * @property sortOrder - Optional sort direction ('asc' | 'desc').
 *
 * @example
 * ```ts
 * const opts: ListOptions = {
 *   page: 1,
 *   pageSize: 20,
 *   search: 'hotel',
 *   sortBy: 'name',
 *   sortOrder: 'asc',
 * };
 * ```
 */
export type ListOptions = {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly relations?: ListRelationsConfig;
    readonly where?: Record<string, unknown>;
    readonly sortBy?: string;
    readonly sortOrder?: 'asc' | 'desc';
};

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
