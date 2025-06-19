import type { PermissionEnum, RoleEnum } from '@repo/types';

export enum EntityPermissionReasonEnum {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    OWNER = 'OWNER',
    PUBLIC_ACCESS = 'PUBLIC_ACCESS',
    NOT_OWNER = 'NOT_OWNER',
    NOT_ADMIN = 'NOT_ADMIN',
    NOT_SUPER_ADMIN = 'NOT_SUPER_ADMIN',
    NOT_PUBLIC = 'NOT_PUBLIC',
    DELETED = 'DELETED',
    ARCHIVED = 'ARCHIVED',
    DRAFT = 'DRAFT',
    REJECTED = 'REJECTED',
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    PRIVATE = 'PRIVATE',
    RESTRICTED = 'RESTRICTED',
    DENIED = 'DENIED',
    MISSING_PERMISSION = 'MISSING_PERMISSION'
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
              code: string;
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

// --- Service Error Types ---

/**
 * Error codes that can be returned by services.
 * @enum {string}
 */
export enum ServiceErrorCode {
    /** Input validation failed */
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    /** Entity not found */
    NOT_FOUND = 'NOT_FOUND',
    /** User is not authenticated */
    UNAUTHORIZED = 'UNAUTHORIZED',
    /** User is not authorized to perform the action */
    FORBIDDEN = 'FORBIDDEN',
    /** Unexpected internal error */
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    /** Entity or assignment already exists */
    ALREADY_EXISTS = 'ALREADY_EXISTS'
}

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
    ): Promise<T[] | { items: T[]; total: number }>;
}
