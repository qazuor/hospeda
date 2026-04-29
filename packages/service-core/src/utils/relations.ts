/**
 * Utilities for handling soft-deleted entities loaded as relations by
 * `findOneWithRelations` and `findAllWithRelations`.
 *
 * Drizzle's `findFirst({ with })` and `findMany({ with })` load related
 * records regardless of their `deletedAt` status. By design, Hospeda services
 * do NOT filter soft-deleted relations at the database layer because some
 * relations legitimately need the deleted record (audit trails,
 * "managed by [deleted user]" UI, historical context).
 *
 * Services that DO need to hide soft-deleted relations from consumers can
 * call `filterSoftDeletedRelations` from `_afterGetByField` (single entity)
 * or after `_executeSearch` / `_executeAdminSearch` (lists). See ADR-023
 * for the per-service decision framework and the policy manifest at
 * `packages/service-core/docs/soft-deleted-relations-manifest.md`.
 */

/**
 * Minimal shape required for an entity to be considered soft-deletable by this
 * utility. Only the optional `deletedAt` field is inspected; the field may be
 * a `Date`, an ISO string, or `null`/`undefined` when the entity is not soft
 * deleted.
 */
export type SoftDeletable = {
    deletedAt?: Date | string | null;
};

/**
 * Predicate that returns `true` when the candidate value is an object with a
 * truthy `deletedAt` field.
 *
 * @param value - Any value, typically a relation field that may be `null`,
 *   an object, or an array of objects.
 * @returns `true` when `value` is a non-null object whose `deletedAt` is a
 *   non-empty `Date` or string.
 */
export function isSoftDeleted(value: unknown): value is SoftDeletable {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const deletedAt = (value as { deletedAt?: unknown }).deletedAt;
    if (deletedAt === undefined || deletedAt === null) {
        return false;
    }
    if (deletedAt instanceof Date) {
        return Number.isFinite(deletedAt.getTime());
    }
    if (typeof deletedAt === 'string') {
        return deletedAt.length > 0;
    }
    return false;
}

/**
 * Returns a shallow copy of `entity` with the named relation fields
 * filtered when their related record is soft-deleted.
 *
 * Behavior per relation key:
 * - **single relation** (object): the field is set to `null` when the related
 *   record's `deletedAt` is truthy.
 * - **array relation** (array of objects): soft-deleted entries are removed.
 *   The field is always returned as an array (possibly empty), never `null`.
 * - **missing relation key on the entity**: ignored. The utility never
 *   introduces new fields.
 *
 * The input entity is not mutated. The output is a new object with the same
 * shape and a subset of relation fields rewritten.
 *
 * @template TEntity - The entity type (already augmented with relations).
 * @param entity - The entity loaded with relations, or `null` when the parent
 *   was not found.
 * @param keys - The relation keys to filter. Pass only keys that the service
 *   has chosen to filter per the manifest at
 *   `packages/service-core/docs/soft-deleted-relations-manifest.md`.
 * @returns A new entity with filtered relation fields, or `null` when the
 *   input was `null`.
 *
 * @example
 * ```ts
 * // Single relation
 * protected async _afterGetByField(
 *     entity: Accommodation | null,
 *     _actor: Actor,
 *     _ctx: ServiceContext
 * ): Promise<Accommodation | null> {
 *     return filterSoftDeletedRelations(entity, ['owner']);
 * }
 *
 * // Array relation
 * filterSoftDeletedRelations(post, ['relatedAccommodations']);
 * ```
 */
export function filterSoftDeletedRelations<TEntity extends Record<string, unknown>>(
    entity: TEntity | null,
    keys: readonly (keyof TEntity & string)[]
): TEntity | null {
    if (!entity || keys.length === 0) {
        return entity;
    }

    let mutated = false;
    const next: Record<string, unknown> = { ...entity };

    for (const key of keys) {
        const value = next[key];

        if (Array.isArray(value)) {
            const filtered = value.filter((item) => !isSoftDeleted(item));
            if (filtered.length !== value.length) {
                next[key] = filtered;
                mutated = true;
            }
            continue;
        }

        if (isSoftDeleted(value)) {
            next[key] = null;
            mutated = true;
        }
    }

    return mutated ? (next as TEntity) : entity;
}
