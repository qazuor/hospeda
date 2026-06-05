/**
 * @file entityView.service.ts
 *
 * Service for the `entity_views` append-only telemetry table (SPEC-159 T-006).
 *
 * **Why NOT BaseCrudService / BaseService with runWithLoggingAndValidation:**
 * The standard `runWithLoggingAndValidation` wrapper requires an `actor` argument
 * and calls `validateActor()`. View capture is an anonymous public write — there is
 * no authenticated actor by design (SPEC-159 §4.1). The service therefore handles
 * validation and error wrapping manually, mirroring the same pattern used by
 * `AppLogEntryService.recordEntry` and `CronRunService.recordRun` (both are
 * actor-less system/telemetry operations that return structured `ServiceOutput`).
 *
 * **No permission check on capture:**
 * Capture is intentionally open — the caller (route layer) is responsible for
 * rate-limiting, bot-filtering, and origin validation. Performing a permission
 * check here would require a real actor, contradicting the anonymous-write design.
 * This is an explicit, documented deviation from the standard service convention.
 *
 * **T-007 extension point:**
 * Aggregation methods (`getStats`, `getBatchStats`) are expected as T-007 work.
 * The class is structured so those methods slot in naturally alongside `capture`.
 *
 * @see packages/db/src/models/entity-view/entity-view.model.ts
 * @see packages/schemas/src/entities/entityView/entityView.crud.schema.ts
 * @see SPEC-159 §4.1, §5
 */

import { type EntityViewModel, entityViewModel } from '@repo/db';
import {
    type EntityView,
    EntityViewCaptureInputSchema,
    type TrackableEntityType
} from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { ServiceConfig, ServiceOutput } from '../../types/index.js';

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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Service for the `entity_views` telemetry table (SPEC-159 T-006/T-007).
 *
 * Responsibilities (current — T-006):
 *   - Validate and record a single view event via {@link capture}.
 *
 * Planned (T-007):
 *   - `getStats` / `getBatchStats` — aggregate unique visitors + total visits
 *     over a rolling window for one or many entities.
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

    constructor(ctx: ServiceConfig, model?: EntityViewModel) {
        super(ctx, EntityViewService.ENTITY_NAME);
        this.model = model ?? entityViewModel;
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
                        issues: parseResult.error.issues,
                        input
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

            this.logger.error({ error, input: validated }, 'entity_views capture failed');

            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message,
                    details: error
                }
            };
        }
    }
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
