/**
 * Moderation aggregation service — SPEC-155 T-010.
 *
 * Cross-entity service that counts content items pending moderation across
 * the four main content entities: accommodations, destinations, posts, and events.
 *
 * This service does NOT extend BaseCrudService because it is a pure aggregation
 * with no entity lifecycle. It holds no mutable state and is safe to reuse across
 * requests as a module-level singleton.
 *
 * @module services/moderation/moderation.aggregation.service
 * @see SPEC-155 T-010
 */
import { accommodationModel, destinationModel, eventModel, postModel } from '@repo/db';
import type { ModerationPendingCount } from '@repo/schemas';
import { ModerationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { serviceLogger } from '../../utils';
import { hasPermission } from '../../utils/permission';

/**
 * ModerationAggregationService
 *
 * Provides a single method `getPendingCount` that fans out four DB count
 * queries (one per entity) in parallel and returns the aggregated result.
 *
 * Permission gate: `ACCOMMODATION_MODERATION_CHANGE`.
 * Rationale: this is the only cross-entity moderation permission in the enum.
 * Any admin actor capable of changing moderation state is implicitly authorised
 * to read the pending-count dashboard widget. A dedicated `MODERATION_VIEW_ALL`
 * permission does not yet exist; this choice is intentional and documented.
 */
export class ModerationAggregationService {
    /**
     * Returns the count of PENDING-moderation items across all four content entities.
     *
     * Only non-deleted rows (`deletedAt IS NULL`) are counted. The four queries run
     * in parallel via `Promise.all` to minimise latency.
     *
     * @param actor - The actor performing the request. Must hold `ACCOMMODATION_MODERATION_CHANGE`.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ total, byEntity }` shaped per `ModerationPendingCountSchema`.
     * @throws ServiceError (FORBIDDEN) when actor lacks the required permission.
     * @throws ServiceError (INTERNAL_ERROR) on unexpected DB errors.
     */
    public async getPendingCount(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ModerationPendingCount>> {
        serviceLogger.debug({ actorId: actor?.id }, 'getPendingCount called');

        try {
            // Permission gate
            if (
                !actor?.id ||
                !hasPermission(actor, PermissionEnum.ACCOMMODATION_MODERATION_CHANGE)
            ) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: ACCOMMODATION_MODERATION_CHANGE required for moderation pending count'
                );
            }

            const PENDING = ModerationStatusEnum.PENDING;
            const tx = ctx?.tx;

            // Fan out four count queries in parallel, each scoped to non-deleted PENDING rows.
            const [accommodations, destinations, posts, events] = await Promise.all([
                accommodationModel.count({ moderationState: PENDING, deletedAt: null }, { tx }),
                destinationModel.count({ moderationState: PENDING, deletedAt: null }, { tx }),
                postModel.count({ moderationState: PENDING, deletedAt: null }, { tx }),
                eventModel.count({ moderationState: PENDING, deletedAt: null }, { tx })
            ]);

            const byEntity = { accommodations, destinations, posts, events };
            const total = accommodations + destinations + posts + events;

            serviceLogger.debug({ total, byEntity }, 'getPendingCount result');

            return {
                data: { total, byEntity },
                error: undefined
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    data: undefined,
                    error: { code: err.code, message: err.message }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error({ err }, 'getPendingCount unexpected error');
            return {
                data: undefined,
                error: { code: ServiceErrorCode.INTERNAL_ERROR, message }
            };
        }
    }
}
