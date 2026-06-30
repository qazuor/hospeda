/**
 * @fileoverview EntityAccessRegistry — stub registry for entity-level access checks (SPEC-086 T-021).
 *
 * Per D-009: before any insert into r_entity_tag, the service must verify that the actor
 * has read access to the target entity. This registry maps EntityTypeEnum values to
 * per-entity canView checker functions.
 *
 * Current status: all entity types return `true` (stub) and log a warning. Wiring the
 * actual checks against AccommodationService, PostService, etc. is follow-up work outside
 * T-021's scope.
 *
 * When wiring real checks, replace the stub for a given entityType with a function that
 * calls the corresponding service's canView (or equivalent) method. The registry supports
 * partial wiring — only the entity types with real checks need to be replaced.
 */
import { createLogger } from '@repo/logger';
import { EntityTypeEnum } from '@repo/schemas';
import type { Actor } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Function signature for per-entity visibility checks.
 *
 * Receives the entity ID and the actor; returns a Promise that resolves to
 * `true` if the actor can view the entity, `false` otherwise.
 *
 * @param entityId - UUID of the entity to check.
 * @param actor - The actor whose access is being verified.
 * @returns Promise resolving to `true` if the actor has read access.
 */
export type CanViewChecker = (entityId: string, actor: Actor) => Promise<boolean>;

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const registryLogger = createLogger('entity-access-registry');

// ---------------------------------------------------------------------------
// Stub checker
// ---------------------------------------------------------------------------

/**
 * Stub checker returned for every entity type until real wiring is in place.
 *
 * Always returns `true` and emits a WARN log so the team is alerted that
 * entity-level access is not yet enforced for this entity type.
 *
 * @param entityType - The entity type for which no real checker is registered.
 */
function stubChecker(entityType: EntityTypeEnum): CanViewChecker {
    return async (_entityId: string, _actor: Actor): Promise<boolean> => {
        registryLogger.warn(
            {
                entityType,
                note: 'Entity-access check not yet wired for this entity type. Returning true (permissive stub). See SPEC-086 T-021 and D-009 for wiring instructions.'
            },
            `[EntityAccessRegistry] canView stub: ${entityType} — real access check not wired yet`
        );
        return true;
    };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * EntityAccessRegistry — maps EntityTypeEnum to canView checker functions.
 *
 * All entries are stubs (returning true with a warning) until real service
 * wiring is done. Replace individual entries with the real service call:
 *
 * @example
 * ```ts
 * // Wire AccommodationService canView:
 * EntityAccessRegistry[EntityTypeEnum.ACCOMMODATION] = async (entityId, actor) => {
 *     const svc = new AccommodationService(actor);
 *     const result = await svc.getById(actor, entityId);
 *     return result.success;
 * };
 * ```
 */
export const EntityAccessRegistry: Record<EntityTypeEnum, CanViewChecker> = {
    [EntityTypeEnum.ACCOMMODATION]: stubChecker(EntityTypeEnum.ACCOMMODATION),
    [EntityTypeEnum.DESTINATION]: stubChecker(EntityTypeEnum.DESTINATION),
    [EntityTypeEnum.USER]: stubChecker(EntityTypeEnum.USER),
    [EntityTypeEnum.POST]: stubChecker(EntityTypeEnum.POST),
    [EntityTypeEnum.EVENT]: stubChecker(EntityTypeEnum.EVENT),
    [EntityTypeEnum.CONVERSATION]: stubChecker(EntityTypeEnum.CONVERSATION),
    [EntityTypeEnum.REVIEW]: stubChecker(EntityTypeEnum.REVIEW),
    [EntityTypeEnum.BILLING_SUBSCRIPTION]: stubChecker(EntityTypeEnum.BILLING_SUBSCRIPTION),
    [EntityTypeEnum.PAYMENT]: stubChecker(EntityTypeEnum.PAYMENT),
    [EntityTypeEnum.EXPERIENCE]: stubChecker(EntityTypeEnum.EXPERIENCE),
    [EntityTypeEnum.GASTRONOMY]: stubChecker(EntityTypeEnum.GASTRONOMY)
};

/**
 * Returns the canView checker registered for a given entity type.
 *
 * Falls back to a stub that returns `true` with a warning if no entry is
 * found (defensive guard — should not happen with the current exhaustive map).
 *
 * @param entityType - The EntityTypeEnum value to look up.
 * @returns The registered (or stub) CanViewChecker function.
 */
export function getCanViewChecker(entityType: EntityTypeEnum): CanViewChecker {
    const checker = EntityAccessRegistry[entityType];
    if (!checker) {
        registryLogger.warn(
            { entityType },
            `[EntityAccessRegistry] No checker registered for entityType '${entityType}'. Falling back to permissive stub.`
        );
        return stubChecker(entityType as EntityTypeEnum);
    }
    return checker;
}
