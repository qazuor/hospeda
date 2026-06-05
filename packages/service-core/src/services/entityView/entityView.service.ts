/**
 * @file entityView.service.ts
 *
 * Service for the `entity_views` append-only telemetry table (SPEC-159 T-006/T-007).
 *
 * **Why NOT BaseCrudService / BaseService with runWithLoggingAndValidation (capture):**
 * The standard `runWithLoggingAndValidation` wrapper requires an `actor` argument
 * and calls `validateActor()`. View capture is an anonymous public write — there is
 * no authenticated actor by design (SPEC-159 §4.1). The service therefore handles
 * validation and error wrapping manually for `capture`, mirroring the same pattern
 * used by `AppLogEntryService.recordEntry` and `CronRunService.recordRun` (both are
 * actor-less system/telemetry operations that return structured `ServiceOutput`).
 *
 * **No permission check on capture:**
 * Capture is intentionally open — the caller (route layer) is responsible for
 * rate-limiting, bot-filtering, and origin validation. Performing a permission
 * check here would require a real actor, contradicting the anonymous-write design.
 * This is an explicit, documented deviation from the standard service convention.
 *
 * **T-007 aggregation methods:**
 * `getStatsForHostAccommodations` and `getStatsForEditorEntities` require an
 * authenticated actor and use `runWithLoggingAndValidation` with permission checks
 * via `PermissionEnum` (never role checks — matches the repo-wide convention).
 *
 * **SPEC-197 admin methods:**
 * `getAdminSummary`, `getAdminBatch`, `getAdminTopEntities`, and
 * `getAdminDailySeries` gate on `ANALYTICS_VIEW` permission. They follow the same
 * `runWithLoggingAndValidation` pattern with no constructor-time dereference of
 * `@repo/db` exports (lazy getter pattern preserved).
 *
 * @see packages/db/src/models/entity-view/entity-view.model.ts
 * @see packages/schemas/src/entities/entityView/entityView.crud.schema.ts
 * @see SPEC-159 §4.1, §5
 * @see SPEC-197 §4.2
 */

import {
    AccommodationModel as AccommodationModelClass,
    type AdminSummaryTotalsRow,
    type DailySeriesRow,
    type EntityViewModel,
    entityViewModel
} from '@repo/db';
import type { AccommodationModel } from '@repo/db';
import {
    EntityTypeEnum,
    type EntityView,
    EntityViewCaptureInputSchema,
    type EntityViewStats,
    type EntityViewWindow,
    EntityViewWindowSchema,
    PermissionEnum,
    ServiceErrorCode,
    type TrackableEntityType
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { hasPermission } from '../../utils/permission.js';

// ---------------------------------------------------------------------------
// Input schema for the capture method (service-layer extension of the HTTP body)
// ---------------------------------------------------------------------------

/**
 * Full capture input schema: the two public fields from
 * {@link EntityViewCaptureInputSchema} plus two server-derived fields that the
 * route layer computes before calling the service.
 *
 * The `EntityViewCaptureInputSchema` (from `@repo/schemas`) deliberately omits
 * `visitorHash` and `isAuthenticated` because they are never supplied by the
 * HTTP client — they are derived server-side (fingerprinting + auth check).
 * This schema extends it with those fields so the service can validate the
 * complete payload.
 */
const EntityViewServiceCaptureSchema = EntityViewCaptureInputSchema.extend({
    /**
     * Salted daily hash of the visitor fingerprint, or `'user:<uuid>'` for
     * authenticated viewers. Computed by the route layer before calling
     * `capture`. Must be a non-empty string.
     */
    visitorHash: z
        .string({ message: 'zodError.entityView.visitorHash.required' })
        .min(1, { message: 'zodError.entityView.visitorHash.empty' }),
    /**
     * Whether the viewer was authenticated at the time of the view. Set by
     * the route layer based on session presence.
     */
    isAuthenticated: z.boolean({
        message: 'zodError.entityView.isAuthenticated.required'
    })
});

// ---------------------------------------------------------------------------
// Input schemas for T-007 aggregation methods (service-local, no HTTP wire shape)
// ---------------------------------------------------------------------------

/**
 * Accepted window values for aggregation methods.
 * Maps '7d' → 7 days, '30d' → 30 days.
 */
const WINDOW_DAYS: Record<'7d' | '30d', number> = { '7d': 7, '30d': 30 };

/**
 * Input schema for {@link EntityViewService.getStatsForHostAccommodations}.
 *
 * Only `window` is accepted — `actor.id` is used to resolve owned accommodation
 * IDs internally. Rejecting any caller-supplied owner/host ID prevents a host
 * from peeking at another host's view counts.
 */
const GetStatsForHostAccommodationsSchema = z.object({
    /** Rolling window. Defaults to '30d' when omitted from query params. */
    window: EntityViewWindowSchema
});

/**
 * Input schema for {@link EntityViewService.getStatsForEditorEntities}.
 *
 * `entityType` is restricted to POST and EVENT — ACCOMMODATION is served by the
 * host-specific method above. `entityIds` is bounded at 100 to prevent accidental
 * bulk-export from widget calls (SPEC-159 §5 / dashboard widget design).
 */
const GetStatsForEditorEntitiesSchema = z.object({
    /**
     * Entity type to aggregate. Only POST and EVENT are allowed here.
     * ACCOMMODATION stats are served via `getStatsForHostAccommodations`.
     */
    entityType: z.enum([EntityTypeEnum.POST, EntityTypeEnum.EVENT] as const, {
        message: 'zodError.entityView.editorStats.entityType.invalid'
    }),
    /**
     * Array of entity UUIDs to aggregate. Must be non-empty and bounded at 100
     * to prevent widget calls from becoming unbounded bulk-export requests.
     */
    entityIds: z
        .array(
            z
                .string({ message: 'zodError.entityView.entityId.required' })
                .uuid({ message: 'zodError.entityView.entityId.invalidUuid' }),
            { message: 'zodError.entityView.editorStats.entityIds.required' }
        )
        .min(1, { message: 'zodError.entityView.editorStats.entityIds.empty' })
        .max(100, { message: 'zodError.entityView.editorStats.entityIds.tooMany' }),
    /** Rolling window for the aggregation. */
    window: EntityViewWindowSchema
});

// ---------------------------------------------------------------------------
// Input schemas for SPEC-197 admin aggregation methods
// ---------------------------------------------------------------------------

/**
 * Input schema for {@link EntityViewService.getAdminSummary}.
 * Only `window` is needed — the model aggregates all entity types without an
 * ID filter.
 */
const GetAdminSummarySchema = z.object({
    /** Rolling window for the aggregation ('7d' or '30d'). */
    window: EntityViewWindowSchema
});

/**
 * Input schema for {@link EntityViewService.getAdminBatch}.
 * `entityIds` must be a non-empty array of max 100 UUIDs. The service validates
 * the cap here rather than relying on the Zod schema used by the HTTP layer so
 * that direct service callers are also protected.
 */
const GetAdminBatchSchema = z.object({
    /** Entity type shared by all IDs in the batch. */
    entityType: z.enum([
        EntityTypeEnum.ACCOMMODATION,
        EntityTypeEnum.POST,
        EntityTypeEnum.EVENT
    ] as const),
    /**
     * Entity UUIDs to query. Must be non-empty and bounded at 100.
     * The service throws VALIDATION_ERROR before reaching the model if exceeded.
     */
    entityIds: z
        .array(z.string().uuid({ message: 'zodError.entityView.entityId.invalidUuid' }))
        .min(1, { message: 'zodError.adminView.batch.entityIds.empty' }),
    /** Rolling window for the aggregation ('7d' or '30d'). */
    window: EntityViewWindowSchema
});

/**
 * Input schema for {@link EntityViewService.getAdminTopEntities}.
 */
const GetAdminTopEntitiesSchema = z.object({
    /** Entity type to rank by total views. */
    entityType: z.enum([
        EntityTypeEnum.ACCOMMODATION,
        EntityTypeEnum.POST,
        EntityTypeEnum.EVENT
    ] as const),
    /** Rolling window in days (derived from window string by the method). */
    windowDays: z.number().int().positive(),
    /** Maximum number of entities to return. Must be in [1, 50]. */
    limit: z.number().int().min(1).max(50)
});

/**
 * Input schema for {@link EntityViewService.getAdminDailySeries}.
 * V1 only accepts windowDays = 30.
 */
const GetAdminDailySeriesSchema = z.object({
    /** Rolling window in days. Fixed at 30 for V1. */
    windowDays: z.number().int().positive()
});

// ---------------------------------------------------------------------------
// Public input/output types
// ---------------------------------------------------------------------------

/**
 * Full service-layer input for {@link EntityViewService.capture}.
 *
 * Contains the two public fields the HTTP client sends (`entityType`,
 * `entityId`) plus the two server-derived fields (`visitorHash`,
 * `isAuthenticated`) that the route layer computes before calling the service.
 *
 * @example
 * ```ts
 * const input: EntityViewCaptureServiceInput = {
 *   entityType: 'ACCOMMODATION',
 *   entityId: '550e8400-e29b-41d4-a716-446655440000',
 *   visitorHash: 'a3f2b1...',
 *   isAuthenticated: false,
 * };
 * ```
 */
export interface EntityViewCaptureServiceInput {
    /** Trackable entity type: 'ACCOMMODATION' | 'POST' | 'EVENT'. */
    readonly entityType: TrackableEntityType;
    /** UUID of the viewed entity. */
    readonly entityId: string;
    /**
     * Salted daily hash of the visitor fingerprint, or `'user:<uuid>'` for
     * authenticated viewers.
     */
    readonly visitorHash: string;
    /** Whether the viewer was authenticated at the time of the view. */
    readonly isAuthenticated: boolean;
}

/**
 * Input for {@link EntityViewService.getStatsForHostAccommodations}.
 *
 * The actor's own accommodation IDs are resolved internally — no ownerId
 * param is accepted to prevent cross-host peeking.
 */
export interface GetStatsForHostAccommodationsInput {
    /** Authenticated actor performing the request. */
    readonly actor: Actor;
    /** Rolling window for the aggregation ('7d' or '30d'). */
    readonly window: EntityViewWindow;
}

/**
 * Input for {@link EntityViewService.getStatsForEditorEntities}.
 */
export interface GetStatsForEditorEntitiesInput {
    /** Authenticated actor performing the request. */
    readonly actor: Actor;
    /**
     * Entity type to aggregate. ACCOMMODATION is not permitted here —
     * it is served by `getStatsForHostAccommodations`.
     */
    readonly entityType: EntityTypeEnum.POST | EntityTypeEnum.EVENT;
    /**
     * Array of entity UUIDs to include. Max 100 IDs (widget cap, not bulk
     * export).
     */
    readonly entityIds: readonly string[];
    /** Rolling window for the aggregation ('7d' or '30d'). */
    readonly window: EntityViewWindow;
}

/**
 * Input for {@link EntityViewService.getAdminSummary}.
 */
export interface GetAdminSummaryInput {
    /** Authenticated actor performing the request (must have ANALYTICS_VIEW). */
    readonly actor: Actor;
    /** Rolling window for the aggregation ('7d' or '30d'). */
    readonly window: EntityViewWindow;
}

/**
 * Input for {@link EntityViewService.getAdminBatch}.
 */
export interface GetAdminBatchInput {
    /** Authenticated actor performing the request (must have ANALYTICS_VIEW). */
    readonly actor: Actor;
    /** Entity type shared by all IDs in the batch. */
    readonly entityType: TrackableEntityType;
    /**
     * Array of entity UUIDs to query. Must be non-empty and ≤ 100 items.
     * Exceeding 100 returns a VALIDATION_ERROR ServiceError.
     */
    readonly entityIds: readonly string[];
    /** Rolling window for the aggregation ('7d' or '30d'). */
    readonly window: EntityViewWindow;
}

/**
 * Input for {@link EntityViewService.getAdminTopEntities}.
 */
export interface GetAdminTopEntitiesInput {
    /** Authenticated actor performing the request (must have ANALYTICS_VIEW). */
    readonly actor: Actor;
    /** Entity type to rank by total views. */
    readonly entityType: TrackableEntityType;
    /** Rolling window in days (7 or 30). */
    readonly windowDays: number;
    /** Maximum number of entities to return. Must be in [1, 50]; defaults to 10. */
    readonly limit: number;
}

/**
 * Input for {@link EntityViewService.getAdminDailySeries}.
 */
export interface GetAdminDailySeriesInput {
    /** Authenticated actor performing the request (must have ANALYTICS_VIEW). */
    readonly actor: Actor;
    /** Rolling window in days. Fixed at 30 for V1. */
    readonly windowDays: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Service for the `entity_views` telemetry table (SPEC-159 T-006/T-007).
 *
 * Responsibilities:
 *   - `capture` — validate and record a single anonymous view event.
 *   - `getStatsForHostAccommodations` — return view stats for all of the
 *     authenticated host's accommodations over a rolling window.
 *   - `getStatsForEditorEntities` — return view stats for a caller-supplied
 *     batch of POST or EVENT entities over a rolling window (editor dashboard).
 *
 * Does NOT extend `BaseCrudService`: `entity_views` is an append-only
 * telemetry table, not a user-facing CRUD entity. The `capture` path has no
 * actor and requires no permission check by design (rate-limiting and
 * bot-filtering are route-layer concerns).
 */
export class EntityViewService extends BaseService {
    static readonly ENTITY_NAME = 'entity_views';
    protected readonly entityName = EntityViewService.ENTITY_NAME;
    private readonly modelOverride: EntityViewModel | undefined;
    private readonly accommodationModelOverride: AccommodationModel | undefined;
    private accommodationModelLazy: AccommodationModel | undefined;

    constructor(
        ctx: ServiceConfig,
        model?: EntityViewModel,
        accommodationModel?: AccommodationModel
    ) {
        super(ctx, EntityViewService.ENTITY_NAME);
        // IMPORTANT: do NOT dereference @repo/db exports here. The singleton
        // below is constructed at barrel import time; touching `entityViewModel`
        // or `AccommodationModelClass` in the constructor breaks every test
        // that partially mocks '@repo/db' (vitest mock proxies throw on access
        // to undefined exports). Resolution is deferred to the lazy getters.
        this.modelOverride = model;
        this.accommodationModelOverride = accommodationModel;
    }

    /**
     * Lazily resolves the entity-view model: injected override or the shared
     * singleton. First dereference of `entityViewModel` happens on first
     * method call, never at import/construction time.
     */
    protected get model(): EntityViewModel {
        return this.modelOverride ?? entityViewModel;
    }

    /**
     * Lazily resolves the accommodation model used for host ownership lookups.
     * Instantiated once on first use (or the injected override).
     */
    private get accommodationModel(): AccommodationModel {
        if (!this.accommodationModelLazy) {
            this.accommodationModelLazy =
                this.accommodationModelOverride ?? new AccommodationModelClass();
        }
        return this.accommodationModelLazy;
    }

    /**
     * Records a single view event for the given entity.
     *
     * **No permission check** — capture is an anonymous public write. The route
     * layer is responsible for rate-limiting, bot-filtering, and origin
     * validation before calling this method. See SPEC-159 §4.1 for the full
     * security rationale.
     *
     * Validates the complete payload (entityType UUID format, visitorHash
     * non-empty) via `EntityViewServiceCaptureSchema` before delegating to the
     * model. Returns a typed `ServiceOutput` so the caller never receives an
     * unhandled exception.
     *
     * @param input - The view event to record (entity type + id + server-derived fields).
     * @returns `ServiceOutput<EntityView>` — success carries the inserted row;
     *   failure carries a typed error with `VALIDATION_ERROR` or `INTERNAL_ERROR`.
     *
     * @example
     * ```ts
     * const result = await entityViewService.capture({
     *   entityType: 'ACCOMMODATION',
     *   entityId: '550e8400-e29b-41d4-a716-446655440000',
     *   visitorHash: 'a3f2b1...',
     *   isAuthenticated: false,
     * });
     * if (result.error) {
     *   // handle validation or DB error
     * }
     * ```
     */
    public async capture(input: EntityViewCaptureServiceInput): Promise<ServiceOutput<EntityView>> {
        const parseResult = EntityViewServiceCaptureSchema.safeParse(input);

        if (!parseResult.success) {
            const fieldErrors = parseResult.error.flatten().fieldErrors;
            const formErrors = parseResult.error.flatten().formErrors;

            const errorMessages: string[] = [];
            for (const [field, errors] of Object.entries(fieldErrors)) {
                if (Array.isArray(errors) && errors.length > 0) {
                    errorMessages.push(`${field}: ${errors.join(', ')}`);
                }
            }
            if (formErrors.length > 0) {
                errorMessages.push(`Form errors: ${formErrors.join(', ')}`);
            }

            const message =
                errorMessages.length > 0
                    ? `Validation failed: ${errorMessages.join('; ')}`
                    : 'Invalid input data provided.';

            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message,
                    details: {
                        fieldErrors,
                        formErrors,
                        issues: parseResult.error.issues
                        // input intentionally omitted — it contains visitorHash,
                        // which must never appear in logs or forwarded error details
                        // (privacy contract, see docs/guides/view-tracking-privacy.md)
                    }
                }
            };
        }

        const validated = parseResult.data;

        try {
            const inserted = await this.model.insertView({
                entityType: validated.entityType,
                entityId: validated.entityId,
                visitorHash: validated.visitorHash,
                isAuthenticated: validated.isAuthenticated
            });

            // The model returns SelectEntityView, whose entityType is the FULL
            // EntityTypeEnum union; EntityView narrows it to the trackable
            // subset. Build the result explicitly from the inserted row plus the
            // already-validated entityType — no cast needed.
            const entityView: EntityView = {
                id: inserted.id,
                entityType: validated.entityType,
                entityId: inserted.entityId,
                visitorHash: inserted.visitorHash,
                isAuthenticated: inserted.isAuthenticated,
                viewedAt: inserted.viewedAt
            };

            this.logger.info(
                {
                    entityType: validated.entityType,
                    entityId: validated.entityId,
                    isAuthenticated: validated.isAuthenticated
                },
                'entity_views capture recorded'
            );

            return { data: entityView };
        } catch (error) {
            const message =
                error instanceof Error
                    ? `Failed to record view: ${error.message}`
                    : 'Failed to record view: unknown error';

            this.logger.error(
                {
                    error,
                    entityType: validated.entityType,
                    entityId: validated.entityId,
                    isAuthenticated: validated.isAuthenticated
                    // visitorHash intentionally omitted — privacy contract
                },
                'entity_views capture failed'
            );

            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message,
                    details: error
                }
            };
        }
    }

    // -------------------------------------------------------------------------
    // T-007: Aggregation methods (require authenticated actor)
    // -------------------------------------------------------------------------

    /**
     * Returns view-count statistics for every accommodation owned by the actor.
     *
     * **Permission:** `ACCOMMODATION_VIEW_OWN`. `actor.id` is used to resolve
     * owned IDs — no `ownerId` param is accepted (anti-peeking).
     *
     * **Zero-view normalization:** DB omits entities with no rows in the window;
     * this method adds them back as `{ unique: 0, total: 0 }`.
     *
     * @param input - Actor + rolling window.
     * @returns One `EntityViewStats` entry per owned accommodation.
     */
    public async getStatsForHostAccommodations(
        input: GetStatsForHostAccommodationsInput
    ): Promise<ServiceOutput<EntityViewStats[]>> {
        const { actor, ...params } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'getStatsForHostAccommodations',
            input: { actor, ...params },
            schema: GetStatsForHostAccommodationsSchema,
            execute: async (validated, validatedActor) => {
                if (!hasPermission(validatedActor, PermissionEnum.ACCOMMODATION_VIEW_OWN)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ACCOMMODATION_VIEW_OWN required to view accommodation stats'
                    );
                }

                const ownedIds = await this.accommodationModel.findIdsByOwnerId(validatedActor.id);

                if (ownedIds.length === 0) {
                    return [];
                }

                const windowDays = WINDOW_DAYS[validated.window];
                const modelStats = await this.model.getStatsForEntities({
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: ownedIds,
                    windowDays
                });

                return normalizeStats(ownedIds, modelStats);
            }
        });
    }

    /**
     * Returns view-count statistics for a caller-supplied batch of POST or EVENT
     * entities (editor dashboard widget).
     *
     * **Permissions:** `POST_VIEW_ALL` for POST, `EVENT_VIEW_ALL` for EVENT.
     * ACCOMMODATION is rejected — use `getStatsForHostAccommodations` instead.
     *
     * **entityIds cap:** Max 100 IDs — prevents widget calls from becoming bulk
     * exports (SPEC-159 §5).
     *
     * @param input - Actor, entity type, entity IDs (≤100), and rolling window.
     * @returns One `EntityViewStats` entry per requested ID (zero-view included).
     */
    public async getStatsForEditorEntities(
        input: GetStatsForEditorEntitiesInput
    ): Promise<ServiceOutput<EntityViewStats[]>> {
        const { actor, ...params } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'getStatsForEditorEntities',
            input: { actor, ...params },
            schema: GetStatsForEditorEntitiesSchema,
            execute: async (validated, validatedActor) => {
                const requiredPermission =
                    validated.entityType === 'POST'
                        ? PermissionEnum.POST_VIEW_ALL
                        : PermissionEnum.EVENT_VIEW_ALL;

                if (!hasPermission(validatedActor, requiredPermission)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        `Permission denied: ${requiredPermission} required to view ${validated.entityType} stats`
                    );
                }

                const windowDays = WINDOW_DAYS[validated.window];
                const modelStats = await this.model.getStatsForEntities({
                    entityType: validated.entityType,
                    entityIds: validated.entityIds,
                    windowDays
                });

                return normalizeStats(validated.entityIds, modelStats);
            }
        });
    }

    // -------------------------------------------------------------------------
    // SPEC-197: Admin aggregation methods (require ANALYTICS_VIEW permission)
    // -------------------------------------------------------------------------

    /**
     * Returns platform-wide view totals per entity type for a given window.
     *
     * **Permission:** `ANALYTICS_VIEW`.
     *
     * **Zero-fill guarantee:** The result always contains exactly three items —
     * one per trackable entity type (ACCOMMODATION, POST, EVENT). Entity types
     * absent from the model result (zero views in the window) are zero-filled.
     *
     * @param input - Actor and rolling window ('7d' or '30d').
     * @returns Array of three `AdminSummaryTotalsRow` items, one per entity type.
     *
     * @example
     * ```ts
     * const result = await entityViewService.getAdminSummary({ actor, window: '30d' });
     * if (!result.error) {
     *   // result.data has exactly 3 items
     * }
     * ```
     */
    public async getAdminSummary(
        input: GetAdminSummaryInput
    ): Promise<ServiceOutput<AdminSummaryTotalsRow[]>> {
        const { actor, ...params } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'getAdminSummary',
            input: { actor, ...params },
            schema: GetAdminSummarySchema,
            execute: async (validated, validatedActor) => {
                if (!hasPermission(validatedActor, PermissionEnum.ANALYTICS_VIEW)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ANALYTICS_VIEW required to access admin view summary'
                    );
                }

                const windowDays = WINDOW_DAYS[validated.window];
                const rows = await this.model.getAdminSummaryTotals({ windowDays });
                return normalizeAdminSummary(rows);
            }
        });
    }

    /**
     * Returns view-count statistics for a caller-supplied batch of entity IDs.
     *
     * **Permission:** `ANALYTICS_VIEW`.
     *
     * **entityIds cap:** Max 100 IDs. Exceeding this limit returns a
     * `VALIDATION_ERROR` ServiceError before the model is called.
     *
     * **Zero-fill guarantee:** Every requested entity ID appears in the result.
     * IDs absent from the model result (zero views) are zero-filled.
     *
     * @param input - Actor, entity type, entity IDs (≤100), and rolling window.
     * @returns One `EntityViewStats` entry per requested ID.
     *
     * @example
     * ```ts
     * const result = await entityViewService.getAdminBatch({
     *   actor,
     *   entityType: 'ACCOMMODATION',
     *   entityIds: ['uuid1', 'uuid2'],
     *   window: '30d',
     * });
     * ```
     */
    public async getAdminBatch(
        input: GetAdminBatchInput
    ): Promise<ServiceOutput<EntityViewStats[]>> {
        const { actor, ...params } = input;

        // Validate the 100-item cap before runWithLoggingAndValidation so the
        // error is typed as VALIDATION_ERROR and not wrapped as INTERNAL_ERROR.
        if (params.entityIds.length > 100) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'entityIds must contain at most 100 items',
                    details: { count: params.entityIds.length, max: 100 }
                }
            };
        }

        return this.runWithLoggingAndValidation({
            methodName: 'getAdminBatch',
            input: { actor, ...params },
            schema: GetAdminBatchSchema,
            execute: async (validated, validatedActor) => {
                if (!hasPermission(validatedActor, PermissionEnum.ANALYTICS_VIEW)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ANALYTICS_VIEW required to access admin batch stats'
                    );
                }

                const windowDays = WINDOW_DAYS[validated.window];
                const modelStats = await this.model.getStatsForEntities({
                    entityType: validated.entityType,
                    entityIds: validated.entityIds,
                    windowDays
                });

                return normalizeStats(validated.entityIds, modelStats);
            }
        });
    }

    /**
     * Returns the top-N most-viewed entities for a given entity type and window.
     *
     * **Permission:** `ANALYTICS_VIEW`.
     *
     * **limit cap:** Max 50. Exceeding this limit returns a `VALIDATION_ERROR`
     * ServiceError before the model is called.
     *
     * @param input - Actor, entity type, windowDays, and limit (≤50, default 10).
     * @returns Array of `EntityViewStats` ordered by `total DESC`, length ≤ limit.
     *
     * @example
     * ```ts
     * const result = await entityViewService.getAdminTopEntities({
     *   actor,
     *   entityType: 'POST',
     *   windowDays: 30,
     *   limit: 10,
     * });
     * ```
     */
    public async getAdminTopEntities(
        input: GetAdminTopEntitiesInput
    ): Promise<ServiceOutput<EntityViewStats[]>> {
        const { actor, ...params } = input;

        // Validate the 50-item cap before runWithLoggingAndValidation.
        if (params.limit > 50) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'limit must be at most 50',
                    details: { limit: params.limit, max: 50 }
                }
            };
        }

        return this.runWithLoggingAndValidation({
            methodName: 'getAdminTopEntities',
            input: { actor, ...params },
            schema: GetAdminTopEntitiesSchema,
            execute: async (validated, validatedActor) => {
                if (!hasPermission(validatedActor, PermissionEnum.ANALYTICS_VIEW)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ANALYTICS_VIEW required to access admin top entities'
                    );
                }

                return this.model.getTopViewedEntities({
                    entityType: validated.entityType,
                    windowDays: validated.windowDays,
                    limit: validated.limit
                });
            }
        });
    }

    /**
     * Returns the 30-day daily view-count series grouped by entity type,
     * gap-filled to exactly 90 rows (3 entity types × 30 days).
     *
     * **Permission:** `ANALYTICS_VIEW`.
     *
     * **Gap-fill semantics:** For any (date, entityType) pair absent from the
     * model result, the service emits `{ date, entityType, total: 0 }`. The
     * date range is the last `windowDays` calendar days in UTC, matching the
     * `DATE_TRUNC('day', viewed_at)` bucketing used by the SQL query.
     *
     * @param input - Actor and windowDays (fixed at 30 for V1).
     * @returns Exactly 90 `DailySeriesRow` items ordered by date ASC, entityType ASC.
     *
     * @example
     * ```ts
     * const result = await entityViewService.getAdminDailySeries({ actor, windowDays: 30 });
     * if (!result.error) {
     *   // result.data.length === 90
     * }
     * ```
     */
    public async getAdminDailySeries(
        input: GetAdminDailySeriesInput
    ): Promise<ServiceOutput<DailySeriesRow[]>> {
        const { actor, ...params } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'getAdminDailySeries',
            input: { actor, ...params },
            schema: GetAdminDailySeriesSchema,
            execute: async (validated, validatedActor) => {
                if (!hasPermission(validatedActor, PermissionEnum.ANALYTICS_VIEW)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ANALYTICS_VIEW required to access admin daily series'
                    );
                }

                const modelRows = await this.model.getDailySeries({
                    windowDays: validated.windowDays
                });
                return gapFillDailySeries(modelRows, validated.windowDays);
            }
        });
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes model stats to guarantee every requested entity ID appears in the
 * result, inserting `{ unique: 0, total: 0 }` for IDs absent from the DB query
 * result (zero-view entities are omitted by the model per its contract).
 *
 * @param requestedIds - Full list of entity IDs that should appear in output.
 * @param modelStats - Partial list returned by the DB (omits zero-view entities).
 * @returns Complete list with one entry per requested ID.
 */
function normalizeStats(
    requestedIds: readonly string[],
    modelStats: readonly EntityViewStats[]
): EntityViewStats[] {
    const statsMap = new Map<string, EntityViewStats>(modelStats.map((s) => [s.entityId, s]));
    return requestedIds.map((id) => statsMap.get(id) ?? { entityId: id, unique: 0, total: 0 });
}

/** All trackable entity types, in stable order for zero-fill iteration. */
const TRACKABLE_ENTITY_TYPES: readonly TrackableEntityType[] = [
    EntityTypeEnum.ACCOMMODATION,
    EntityTypeEnum.POST,
    EntityTypeEnum.EVENT
];

/**
 * Normalizes admin summary rows to guarantee all three entity types are present.
 * Model rows absent from the DB result (zero views) are zero-filled.
 *
 * @param modelRows - Partial array from `getAdminSummaryTotals` (may omit types).
 * @returns Array of exactly three rows, one per trackable entity type.
 */
function normalizeAdminSummary(
    modelRows: readonly AdminSummaryTotalsRow[]
): AdminSummaryTotalsRow[] {
    const rowMap = new Map<TrackableEntityType, AdminSummaryTotalsRow>(
        modelRows.map((r) => [r.entityType, r])
    );
    return TRACKABLE_ENTITY_TYPES.map(
        (entityType) => rowMap.get(entityType) ?? { entityType, unique: 0, total: 0 }
    );
}

/**
 * Gap-fills a daily series result so that every (date, entityType) combination
 * in the last `windowDays` calendar days (UTC) has an entry.
 *
 * The date range is generated in UTC to match the `DATE_TRUNC('day', viewed_at)`
 * bucketing used by the model SQL query. "Today" is the current UTC date; the
 * range includes `windowDays` dates: from `today - (windowDays - 1) days` through
 * `today` inclusive (so a 30-day window yields exactly 30 distinct dates).
 *
 * Missing (date, entityType) pairs are emitted as `{ date, entityType, total: 0 }`.
 *
 * @param modelRows - Rows returned by `getDailySeries` (only days with data).
 * @param windowDays - Number of calendar days in the window (always 30 for V1).
 * @returns Gap-filled array of exactly `windowDays * 3` rows ordered by date ASC,
 *   entityType ASC.
 */
function gapFillDailySeries(
    modelRows: readonly DailySeriesRow[],
    windowDays: number
): DailySeriesRow[] {
    // Build a lookup keyed by "date|entityType" for O(1) access.
    const rowMap = new Map<string, DailySeriesRow>(
        modelRows.map((r) => [`${r.date}|${r.entityType}`, r])
    );

    // Generate the date list in UTC. Today = UTC midnight of the current day.
    // The window is [today - (windowDays - 1) days .. today] inclusive.
    const nowUtc = new Date();
    const todayUtc = new Date(
        Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate())
    );

    const result: DailySeriesRow[] = [];

    for (let dayOffset = windowDays - 1; dayOffset >= 0; dayOffset--) {
        const dayMs = todayUtc.getTime() - dayOffset * 24 * 60 * 60 * 1000;
        const d = new Date(dayMs);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        for (const entityType of TRACKABLE_ENTITY_TYPES) {
            const key = `${dateStr}|${entityType}`;
            result.push(rowMap.get(key) ?? { date: dateStr, entityType, total: 0 });
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Singleton instance of {@link EntityViewService} for use across the application.
 * Mirrors the convention established in every other service file (e.g.,
 * `AppLogEntryService`, `CronRunService`).
 */
export const entityViewService = new EntityViewService({});
