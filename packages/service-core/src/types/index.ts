import type {
    BaseSearchSchema,
    EntityPermissionReasonEnum,
    PaginationSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    SortingSchema
} from '@repo/schemas';
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
    permissions: PermissionEnum[];
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

export type PaginatedListOutput<T> = {
    items: T[];
    total: number;
};

// --- Model Interface ---

export interface BaseModel<T> {
    findById(id: string): Promise<T | null>;
    findOne(where: Record<string, unknown>): Promise<T | null>;
    create(input: Partial<T>): Promise<T>;
    update(where: Record<string, unknown>, input: Partial<T>): Promise<T | null>;
    softDelete(where: Record<string, unknown>): Promise<number>;
    restore(where: Record<string, unknown>): Promise<number>;
    hardDelete(where: Record<string, unknown>): Promise<number>;
    count(params: Record<string, unknown>): Promise<number>;
    findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number }
    ): Promise<PaginatedListOutput<T>>;
}

// --- Search Types ---
export type SortingType = z.infer<typeof SortingSchema>;
export type PaginationType = z.infer<typeof PaginationSchema>;
export type BaseSearchType = z.infer<typeof BaseSearchSchema>;
