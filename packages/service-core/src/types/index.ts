import type { QueryContext } from '@repo/db';
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
export { listOptionsSchema } from './schemas';

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
    /**
     * Pagination parameters extracted from the search/count input before the
     * pagination keys are stripped from `params`.
     *
     * Set by `BaseCrudRead.search()` and `BaseCrudRead.count()` before calling
     * `_executeSearch` / `_executeCount`. Services that need `page` and
     * `pageSize` inside those hooks MUST read them from `ctx.pagination`
     * instead of from `params`. See SPEC-088.
     */
    pagination?: {
        /** Current page number (1-based). */
        page?: number;
        /** Number of items per page. */
        pageSize?: number;
        /** Field to sort by. */
        sortBy?: string;
        /** Sort direction. */
        sortOrder?: 'asc' | 'desc';
    };
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
    /**
     * Display name of the actor — mirrors `users.display_name` (Better Auth
     * maps its virtual `name` field to that column). Optional because guest /
     * system actors don't have one. Exposed in `/api/v1/public/auth/me` so
     * the web UserMenu can keep the navbar in sync after a profile mutation
     * without a separate `/users/:id` round-trip (SPEC-113).
     */
    name?: string;
    /**
     * Email of the actor. Optional for guests / system actors. Mirrors
     * `users.email` and is exposed in `/auth/me` for the same reason as
     * {@link Actor.name}.
     */
    email?: string;
    /**
     * Whether the actor's account email is verified. Mirrors
     * `users.email_verified` populated by Better Auth on signup / verification
     * link click. Optional because guests and system actors have no notion of
     * email verification; callers MUST treat `undefined` as "not verified"
     * (safe default). Consumed by `NewsletterSubscriberService.subscribe` to
     * branch between direct-to-active (verified) and the
     * `NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED` block (unverified).
     */
    emailVerified?: boolean;
    /**
     * Avatar URL of the actor — mirrors `users.image`. Better Auth
     * auto-populates this from the OAuth provider on signin (Google `picture`
     * claim, Facebook profile photo). Optional because users without an
     * uploaded avatar, guests, and system actors don't have one. Exposed in
     * `/auth/me` so the web navbar avatar stays in sync without a separate
     * fetch (SPEC-113 follow-up; same rationale as {@link Actor.name}).
     */
    image?: string;
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
              /**
               * Optional machine-readable reason identifier.
               * Carried by `ServiceError.reason` when thrown; propagated to output
               * by `runWithLoggingAndValidation` and `runWithLogging`.
               */
              reason?: string;
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
 *
 * The optional `reason` field carries a machine-readable identifier that
 * describes *why* the error occurred beyond the generic `code`. It is emitted
 * unconditionally in error response payloads (not gated behind
 * `HOSPEDA_API_DEBUG_ERRORS`) so that clients can branch on it without needing
 * debug mode enabled.
 *
 * @example
 * ```ts
 * throw new ServiceError(
 *   ServiceErrorCode.FORBIDDEN,
 *   'Anonymous email not yet verified',
 *   undefined,
 *   'ANONYMOUS_EMAIL_NOT_VERIFIED'
 * );
 * ```
 *
 * @extends {Error}
 */
export class ServiceError extends Error {
    /**
     * Creates a new ServiceError.
     * @param {ServiceErrorCode} code - The error code
     * @param {string} message - The error message
     * @param {unknown} [details] - Optional additional details for debugging or context
     * @param {string} [reason] - Optional machine-readable reason identifier emitted
     *   unconditionally in API error responses
     */
    constructor(
        public code: ServiceErrorCode,
        message: string,
        public details?: unknown,
        public readonly reason?: string
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
export type { ListOptions } from './schemas';

/**
 * Augments a flat entity type with typed relation fields for service-layer
 * consumers that need autocomplete on populated relations.
 *
 * Service methods (`getByField`, `getById`, `list`, ...) return
 * `ServiceOutput<TEntity | null>` where `TEntity` is the flat database entity
 * type. At runtime, when `getDefaultGetByIdRelations()` returns a config,
 * the entity DOES contain nested relation objects (e.g., `destination`,
 * `owner`), but TypeScript only sees the flat type. See ADR-022.
 *
 * The recommended way to consume relation data is via access schemas from
 * `@repo/schemas` (e.g., `AccommodationPublicSchema`), which validate at the
 * API boundary. Use `WithRelations` only inside the service layer when an
 * access schema does not exist and a typed cast is needed in custom service
 * methods or tests.
 *
 * @template TEntity - The flat database entity type (e.g., `Accommodation`).
 * @template TRelations - An object literal describing the populated relations
 *   keyed by the relation name. Each value is the related entity type or
 *   array of related entity types.
 *
 * @example
 * ```ts
 * import type { WithRelations } from '@repo/service-core';
 * import type { Accommodation, Destination, User, Amenity } from '@repo/schemas';
 *
 * type AccommodationDetail = WithRelations<Accommodation, {
 *     destination: Destination;
 *     owner: User;
 *     amenities: Amenity[];
 * }>;
 *
 * const result = await service.getById(actor, id);
 * // TYPE-WORKAROUND: service layer is relation-agnostic; cast for typed access
 * const accommodation = result.data as AccommodationDetail | null;
 * accommodation?.destination.name; // typed
 * ```
 */
export type WithRelations<TEntity, TRelations extends Record<string, unknown>> = TEntity &
    TRelations;

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
    /** Service execution context carrying transaction and hookState */
    readonly ctx?: ServiceContext;
};
