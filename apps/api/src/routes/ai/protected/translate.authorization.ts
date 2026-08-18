/**
 * Authorization policy for `POST /api/v1/protected/ai/translate` (HOS-584).
 *
 * The route persists AI translations onto a content row identified by an id in
 * the REQUEST BODY. Every other protected write route takes its id from the URL
 * and can therefore hand the check to `ownershipMiddleware`, which reads
 * `c.req.param(...)`. This one cannot, so the rule lives here — as a pure
 * function, testable without a database, a context or an AI stub.
 *
 * @module apps/api/routes/ai/protected/translate.authorization
 */

import { PermissionEnum } from '@repo/schemas';
import type { TranslationEntityOwnership } from '../../../services/ai-translate.service';

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

/**
 * The entity types this route accepts.
 *
 * Four of the service's five translatable types. `pointOfInterest` is absent on
 * purpose: it is a staff-curated catalog with no owner column and no
 * owner-facing editor, so there is no protected-tier caller for it — it is
 * translated through the admin route.
 *
 * The route's request schema derives its enum from this constant, and
 * {@link ENTITY_RULES} is keyed by it, so a type added to one is a compile
 * error until it is added to the other. That is the point: a new accepted type
 * must not be able to arrive without a rule saying who may write it.
 */
export const PROTECTED_TRANSLATABLE_ENTITY_TYPES = [
    'accommodation',
    'destination',
    'event',
    'post'
] as const;

/** An entity type reachable through the protected translate route. */
export type ProtectedTranslatableEntityType = (typeof PROTECTED_TRANSLATABLE_ENTITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** How one entity type decides who may translate it. */
interface TranslateAuthorizationRule {
    /**
     * Row columns that prove ownership when they equal the actor's id, in no
     * particular order — any match is enough.
     *
     * An EMPTY list means the type has no owner concept at all, so the only way
     * in is {@link TranslateAuthorizationRule.bypassPermission}.
     */
    readonly ownershipFields: readonly (keyof TranslationEntityOwnership)[];
    /** Permission that grants access regardless of ownership. */
    readonly bypassPermission: PermissionEnum;
}

/**
 * The per-type rules.
 *
 * `accommodation` mirrors the accommodation PATCH route's ownership config
 * (`['ownerId', 'createdById']` + `ACCOMMODATION_UPDATE_ANY`) on purpose: a host
 * who may edit a row through PATCH must not be refused when translating it, and
 * vice versa.
 *
 * `destination` has no owner column — it is staff-managed content. "Nobody owns
 * it" resolves to nobody by default, never to everybody, which is exactly the
 * failure this module exists to close.
 */
const ENTITY_RULES: Readonly<Record<ProtectedTranslatableEntityType, TranslateAuthorizationRule>> =
    {
        accommodation: {
            ownershipFields: ['ownerId', 'createdById'],
            bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
        },
        destination: {
            ownershipFields: [],
            bypassPermission: PermissionEnum.DESTINATION_UPDATE
        },
        event: {
            ownershipFields: ['authorId', 'createdById'],
            bypassPermission: PermissionEnum.EVENT_UPDATE
        },
        post: {
            ownershipFields: ['authorId', 'createdById'],
            bypassPermission: PermissionEnum.POST_UPDATE
        }
    };

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/**
 * Whether this actor may persist translations onto this row.
 *
 * @param entityType - The content type being translated.
 * @param ownership - The row's ownership columns, as loaded by
 * `loadTranslationEntityOwnership`.
 * @param actorId - The authenticated actor's id.
 * @param actorPermissions - The actor's permission set.
 * @returns `true` when the actor owns the row or holds the type's bypass
 * permission; `false` otherwise.
 */
export function mayTranslateEntity({
    entityType,
    ownership,
    actorId,
    actorPermissions
}: {
    readonly entityType: ProtectedTranslatableEntityType;
    readonly ownership: TranslationEntityOwnership;
    readonly actorId: string;
    readonly actorPermissions: readonly PermissionEnum[];
}): boolean {
    const rule = ENTITY_RULES[entityType];

    if (actorPermissions.includes(rule.bypassPermission)) {
        return true;
    }

    // An empty actor id must never match an empty column: `loadTranslationEntityOwnership`
    // already normalises blank columns to `null`, and this guard covers the
    // other half (an actor whose id never resolved).
    if (actorId.length === 0) {
        return false;
    }

    return rule.ownershipFields.some((field) => ownership[field] === actorId);
}
