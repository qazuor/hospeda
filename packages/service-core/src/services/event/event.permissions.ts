/**
 * Permission helpers for EventService.
 * Each function throws ServiceError(FORBIDDEN) if the actor lacks permission.
 * Follows the pattern of other service permission helpers.
 */
import type { Event } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import { type Actor, ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import { isAuthorEditLockedByModeration } from '../moderation/author-edit-lock';
import { isContentStateApproved } from '../moderation/public-read-floor';

/**
 * Checks if the actor can create an event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanCreateEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_CREATE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to create event');
    }
}

/**
 * Checks if the actor can update the given event.
 *
 * Mirrors the post twin (HOS-374 §7.6.2): `EVENT_UPDATE` covers any event,
 * `EVENT_UPDATE_OWN` covers only the actor's own and stops applying once the
 * platform approved the event, unless the actor also holds `EVENT_PUBLISH_OWN`
 * (§7.6.3).
 *
 * The event is now a required argument — the check could not be author-scoped
 * without it.
 *
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanUpdateEvent(actor: Actor, event: Event): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (hasPermission(actor, PermissionEnum.EVENT_UPDATE)) {
        return;
    }
    if (actor.id === event.authorId && hasPermission(actor, PermissionEnum.EVENT_UPDATE_OWN)) {
        if (
            isAuthorEditLockedByModeration({
                moderationState: event.moderationState,
                canPublishOwn: hasPermission(actor, PermissionEnum.EVENT_PUBLISH_OWN)
            })
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied to update a published event'
            );
        }
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to update event');
}

/**
 * Checks if the actor can manage an event's gallery photos (HOS-390).
 *
 * Delegates to {@link checkCanUpdateEvent} rather than introducing a dedicated
 * `EVENT_MEDIA_*` permission: a photo IS event content, so editing the gallery
 * cannot require less — nor more — than editing the event itself. Adding a
 * separate permission would let the two drift, producing an actor who can
 * rewrite an event's description but not replace its cover image (or vice versa).
 *
 * Exists as its own named function so the media helpers read against a
 * media-specific seam (mirroring `checkGastronomyCanEditMedia`), and so a future
 * divergence has one place to land instead of five call sites.
 *
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkEventCanEditMedia(actor: Actor, event: Event): void {
    checkCanUpdateEvent(actor, event);
}

/**
 * Checks if the actor can delete the given event.
 *
 * `EVENT_DELETE` deletes any event; `EVENT_DELETE_OWN` deletes only the actor's
 * own. Authorship alone grants nothing (HOS-374 §7.6.2).
 *
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanDeleteEvent(actor: Actor, event: Event): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (hasPermission(actor, PermissionEnum.EVENT_DELETE)) {
        return;
    }
    if (actor.id === event.authorId && hasPermission(actor, PermissionEnum.EVENT_DELETE_OWN)) {
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to delete event');
}

/**
 * Checks if the actor can change an event's moderation state.
 *
 * `EVENT_MODERATION_CHANGE` was seeded but gated nothing server-side until
 * HOS-374 §7.6.4 — it only decided whether the admin panel rendered a widget,
 * while the write itself rode the generic update behind plain `EVENT_UPDATE`.
 *
 * The verdict belongs to the platform, so there is no author path.
 *
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanModerateEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!hasPermission(actor, PermissionEnum.EVENT_MODERATION_CHANGE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to moderate event');
    }
}

/**
 * Checks if the actor can raise or lower an event's publication.
 *
 * `EVENT_PUBLISH_TOGGLE` is the broad side (any event), `EVENT_PUBLISH_OWN` the
 * author side. One permission covers both directions on purpose (§7.6.2).
 *
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanSetEventPublishState(actor: Actor, event: Event): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (hasPermission(actor, PermissionEnum.EVENT_PUBLISH_TOGGLE)) {
        return;
    }
    if (actor.id === event.authorId && hasPermission(actor, PermissionEnum.EVENT_PUBLISH_OWN)) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied to change event publication state'
    );
}

/**
 * Checks if the actor can change an event's lifecycle state.
 *
 * Archiving is a platform-side action with no author counterpart, same shape as
 * moderation.
 *
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanSetEventLifecycleState(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!hasPermission(actor, PermissionEnum.EVENT_LIFECYCLE_CHANGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to change event lifecycle state'
        );
    }
}

/**
 * Checks if the actor can restore the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanRestoreEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_RESTORE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to restore event');
    }
}

/**
 * Checks if the actor can view the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanViewEvent(actor: Actor, event: Event): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');

    // Soft-deleted events existed but are permanently gone. The base model's
    // findOneWithRelations does not filter deleted_at IS NULL, so this check
    // enforces it here to prevent ghost rows from leaking on public reads. Only
    // events that were PUBLIC (indexable) surface as GONE (410) so crawlers/LLM
    // fetchers deindex the URL fast; deleted PRIVATE/RESTRICTED content that was
    // never public returns NOT_FOUND (404, uniform) to preserve the
    // anti-enumeration contract (SPEC-092 T-087). Staff with EVENT_VIEW_ALL are
    // exempt: events have no separate admin-view bypass, so admin/getById relies
    // on this same check to manage deleted rows. HOS-117 T-022.
    if (
        event.deletedAt !== null &&
        event.deletedAt !== undefined &&
        !hasPermission(actor, PermissionEnum.EVENT_VIEW_ALL)
    ) {
        if (event.visibility === VisibilityEnum.PUBLIC) {
            throw new ServiceError(ServiceErrorCode.GONE, 'Event is gone');
        }
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Event not found');
    }

    // Public read floor, platform half (HOS-374 §5.1.1 / §7.6.5): content the
    // platform has not approved, or that has been archived, is not readable —
    // regardless of how public its `visibility` says it is. The author still
    // reads their own drafts, and so do the elevated view permissions;
    // otherwise an editor could not review what they just wrote. NOT_FOUND, not
    // FORBIDDEN, so an unapproved event is indistinguishable from a missing one.
    if (
        !isContentStateApproved(event) &&
        actor.id !== event.authorId &&
        !hasPermission(actor, PermissionEnum.EVENT_VIEW_ALL) &&
        !hasPermission(actor, PermissionEnum.EVENT_VIEW_PRIVATE) &&
        !hasPermission(actor, PermissionEnum.EVENT_VIEW_DRAFT)
    ) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Event not found');
    }

    // Public events: anyone can view
    if (event.visibility === VisibilityEnum.PUBLIC) return;
    // Private/restricted: only with the relevant view permission. EVENT_VIEW_ALL
    // is accepted here too so the soft-deleted exemption above is self-sufficient
    // and does not silently rely on seed roles bundling EVENT_VIEW_ALL with
    // EVENT_VIEW_PRIVATE/EVENT_VIEW_DRAFT (matches the isStaff pattern in
    // gastronomy/experience `_canView`).
    if (
        actor.permissions?.includes(PermissionEnum.EVENT_VIEW_PRIVATE) ||
        actor.permissions?.includes(PermissionEnum.EVENT_VIEW_DRAFT) ||
        actor.permissions?.includes(PermissionEnum.EVENT_VIEW_ALL)
    ) {
        return;
    }
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to view event');
}

/**
 * Checks if the actor can list/search events.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanListEvents(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    // Listing is allowed for any authenticated actor; results are filtered by visibility elsewhere.
    return;
}

/**
 * Checks if the actor can hard delete the given event.
 * Throws ServiceError(FORBIDDEN) if not allowed.
 */
export function checkCanHardDeleteEvent(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.EVENT_HARD_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to hard delete event'
        );
    }
}

/**
 * Checks if an actor has permission to admin-list this entity type.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.EVENT_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: EVENT_VIEW_ALL required for admin list'
        );
    }
}
