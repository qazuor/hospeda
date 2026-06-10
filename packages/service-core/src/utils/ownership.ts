import type { Actor } from '../types';

/**
 * Describes how ownership is determined for an owner-scoped entity (SPEC-169 §5.6).
 *
 * Consumed by BOTH the forced owner-scoping in the admin list path (which needs the
 * column to filter on: `where[ownerColumn] = actor.id`) and the `_canAdminView` detail
 * check (which needs the `isOwner` predicate), so the owner column and the ownership
 * predicate stay defined exactly once per entity and cannot drift apart.
 */
export interface OwnershipDescriptor {
    /**
     * The column on the entity that holds the owner's user id. It is not always
     * `ownerId` (e.g. posts identify their owner via `authorId`).
     */
    readonly ownerColumn: string;
    /**
     * Returns `true` iff `actor` owns `entity`, by comparing `entity[ownerColumn]`
     * to `actor.id`. A missing or non-string owner value is treated as not-owned.
     */
    readonly isOwner: (actor: Actor, entity: Record<string, unknown>) => boolean;
}

/**
 * Builds an {@link OwnershipDescriptor} for an entity whose owner is identified by a
 * single id column whose value equals the actor's id.
 *
 * @param ownerColumn - The entity column holding the owner's user id.
 * @returns The ownership descriptor for that column.
 */
const ownedByColumn = (ownerColumn: string): OwnershipDescriptor => ({
    ownerColumn,
    isOwner: (actor: Actor, entity: Record<string, unknown>): boolean => {
        const owner = entity[ownerColumn];
        return typeof owner === 'string' && owner === actor.id;
    }
});

/**
 * Per-entity ownership registry (SPEC-169 §5.6).
 *
 * Keyed by entity type. Kept INTENTIONALLY MINIMAL: only entities that have an
 * owner-scoped (`_VIEW_OWN`) role need a descriptor (YAGNI — no platform-wide
 * ownership registry). Accommodation is the reference entry (SPEC-169 decision D1/D3:
 * accommodation is the only entity that receives owner-scoping in this spec).
 */
export const OWNERSHIP_REGISTRY: Readonly<Record<string, OwnershipDescriptor>> = {
    accommodation: ownedByColumn('ownerId')
};

/**
 * Returns the ownership descriptor for the given entity type, or `undefined` when the
 * entity is not owner-scoped (i.e. has no `_VIEW_OWN` role and therefore no descriptor).
 *
 * @param entityType - The entity type key (e.g. `'accommodation'`).
 * @returns The descriptor, or `undefined` if the entity is not owner-scoped.
 */
export function getOwnershipDescriptor(entityType: string): OwnershipDescriptor | undefined {
    return OWNERSHIP_REGISTRY[entityType];
}
