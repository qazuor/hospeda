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
 * @see packages/db/src/models/entity-view/entity-view.model.ts
 * @see packages/schemas/src/entities/entityView/entityView.crud.schema.ts
 * @see SPEC-159 §4.1, §5
 */

import {
    AccommodationModel as AccommodationModelClass,
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
    protected readonly model: EntityViewModel;
    private readonly accommodationModel: AccommodationModel;

    constructor(
        ctx: ServiceConfig,
        model?: EntityViewModel,
        accommodationModel?: AccommodationModel
    ) {
        super(ctx, EntityViewService.ENTITY_NAME);
        this.model = model ?? entityViewModel;
        this.accommodationModel = accommodationModel ?? new AccommodationModelClass();
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

            // The model returns SelectEntityView. Map to EntityView (same shape;
            // the schema validates coerced dates so we cast via unknown).
            const entityView = inserted as unknown as EntityView;

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

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Singleton instance of {@link EntityViewService} for use across the application.
 * Mirrors the convention established in every other service file (e.g.,
 * `AppLogEntryService`, `CronRunService`).
 */
export const entityViewService = new EntityViewService({});
