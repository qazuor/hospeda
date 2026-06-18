/**
 * experience.projections.ts
 *
 * Public-tier projection helpers for experience listings (SPEC-240 T-016).
 *
 * These functions strip or transform fields from a raw DB entity so that the
 * result is safe for public consumption.  The API boundary's response schema
 * (`ExperiencePublicSchema`) applies a final parse; these helpers operate
 * BEFORE the schema boundary to reduce what is sent on the wire.
 *
 * Projection rules:
 * - Strip `adminInfo` (internal platform notes, never public).
 * - Strip `ownerId` to prevent leaking the owner's UUID on public endpoints.
 * - Preserve `rating`, `averageRating`, `reviewsCount` (public aggregates).
 * - Preserve all other identity/content/contact/media/pricing fields.
 *
 * These are NOT the same as Zod schema `.pick()` / `.omit()` — they operate
 * on runtime JS objects so callers don't need to re-parse the entity.
 */

import type { Experience } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Public-tier projection
// ---------------------------------------------------------------------------

/**
 * Applies public-tier projections to a single experience entity.
 *
 * Strips the following fields before the entity reaches a public endpoint:
 * - `adminInfo` — internal platform notes (never exposed publicly).
 * - `ownerId` — the owner's UUID; not safe for unauthenticated consumers.
 *
 * All other fields are preserved so public listing pages have full content.
 *
 * @param entity - The raw experience entity from the database.
 * @returns A projected copy without private fields; the original is not mutated.
 *
 * @example
 * ```ts
 * const safe = projectExperiencePublic(rawEntity);
 * // safe.adminInfo === undefined
 * // safe.ownerId  === undefined
 * ```
 */
export function projectExperiencePublic(entity: Experience): Partial<Experience> {
    const { adminInfo: _adminInfo, ownerId: _ownerId, ...rest } = entity;
    return rest;
}

/**
 * List variant of {@link projectExperiencePublic}.
 * Maps `projectExperiencePublic` over an array of entities.
 *
 * @param entities - Array of raw experience entities.
 * @returns Array of projected entities without private fields.
 */
export function projectExperiencePublicList(entities: Experience[]): Partial<Experience>[] {
    return entities.map(projectExperiencePublic);
}

// ---------------------------------------------------------------------------
// Owner-avatar resolver (mirrors gastronomy pattern)
// ---------------------------------------------------------------------------

/**
 * Resolves the display avatar URL from the two sources stored on the owner
 * relation: `users.image` (column) and `users.profile.avatar` (JSONB field).
 *
 * Prefers `image` (a fresh upload wins) and falls back to `profile.avatar`
 * (seeded / legacy users).  Empty strings are treated as absent.
 *
 * @param owner - The owner relation object (may be undefined/null).
 * @returns The resolved URL string, or `null` when neither source is present.
 */
function resolveOwnerImage(owner: Record<string, unknown> | undefined | null): string | null {
    if (!owner) return null;
    const image = owner.image;
    if (typeof image === 'string' && image.length > 0) return image;
    const profile = owner.profile as { avatar?: unknown } | undefined | null;
    const avatar = profile?.avatar;
    if (typeof avatar === 'string' && avatar.length > 0) return avatar;
    return null;
}

/**
 * Sets `owner.image` on an experience entity to the resolved avatar URL.
 *
 * Idempotent and non-mutating: returns a new entity only when the owner
 * relation is present and the resolved image differs from the stored one.
 *
 * @param entity - The experience entity (may carry an eager-loaded `owner` relation).
 * @returns A new entity object with the resolved avatar, or the original if unchanged.
 */
export function projectExperienceOwnerAvatar<T extends Experience>(entity: T | null): T | null {
    if (!entity) return entity;
    // TYPE-WORKAROUND: projection reads an optionally-loaded relation not present on the base entity type
    const owner = (entity as unknown as { owner?: Record<string, unknown> }).owner;
    if (!owner) return entity;
    const resolved = resolveOwnerImage(owner);
    if (owner.image === resolved) return entity;
    return { ...entity, owner: { ...owner, image: resolved } } as T;
}

/**
 * List variant of {@link projectExperienceOwnerAvatar}.
 *
 * @param entities - Array of experience entities (may carry eager-loaded `owner`).
 * @returns Array with resolved owner avatars.
 */
export function projectExperienceOwnerAvatarList<T extends Experience>(entities: T[]): T[] {
    return entities.map((e) => projectExperienceOwnerAvatar(e) as T);
}
