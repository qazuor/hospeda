import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    type NewEventInputType,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserType,
    VisibilityEnum
} from '@repo/types';
import { castBrandedIds, castDateFields } from '../utils/cast-helper';
import { CanViewReasonEnum } from '../utils/service-helper';

/**
 * Determines if the actor can view the event based on visibility and permissions.
 * Returns an object with the result and the reason (for logging).
 *
 * @param actor - The user or public actor requesting the event.
 * @param event - The event object (must include visibility, authorId, and lifecycleState).
 * @returns An object with canView (boolean), reason (CanViewReasonEnum), and checkedPermission (if permission check is required).
 */
export const canViewEvent = (
    actor: UserType | PublicUserType,
    event: { visibility: VisibilityEnum; authorId: string; lifecycleState: LifecycleStatusEnum }
): { canView: boolean; reason: CanViewReasonEnum; checkedPermission?: PermissionEnum } => {
    if (!Object.values(VisibilityEnum).includes(event.visibility as VisibilityEnum)) {
        return {
            canView: false,
            reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
            checkedPermission: undefined
        };
    }
    if (event.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
        // Only admins can view non-active events
        if (
            'role' in actor &&
            (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN)
        ) {
            return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
        }
        return {
            canView: false,
            reason: CanViewReasonEnum.PUBLIC_ACTOR_DENIED,
            checkedPermission: undefined
        };
    }
    if (event.visibility === VisibilityEnum.PUBLIC) {
        return { canView: true, reason: CanViewReasonEnum.PUBLIC };
    }
    if ('role' in actor && (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN)) {
        return { canView: true, reason: CanViewReasonEnum.ADMIN_BYPASS };
    }
    // The author can view their own event even if it is private/draft
    if ('id' in actor && actor.id === event.authorId) {
        return { canView: true, reason: CanViewReasonEnum.OWNER };
    }
    if (event.visibility === VisibilityEnum.PRIVATE) {
        return {
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: PermissionEnum.EVENT_VIEW_PRIVATE
        };
    }
    if (event.visibility === VisibilityEnum.DRAFT) {
        return {
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: PermissionEnum.EVENT_VIEW_DRAFT
        };
    }
    return {
        canView: false,
        reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
        checkedPermission: undefined
    };
};

// Tag input type for normalization
interface TagInput {
    moderationState?: string | ModerationStatusEnum;
    [key: string]: unknown;
}

/**
 * Normalizes the create input for events: casts branded IDs, dates, and ensures moderationState is enum.
 * @param input - The create input object.
 * @returns The normalized create input.
 */
export const normalizeCreateInput = (input: Record<string, unknown>): NewEventInputType => {
    const inputWithBrandedIds = castBrandedIds(input, (id) => id as string);
    const inputWithDates = castDateFields(inputWithBrandedIds);
    // Deep map for media.moderationState
    let media = inputWithDates.media;
    const hasMediaFields = (
        m: unknown
    ): m is { featuredImage?: unknown; gallery?: unknown; videos?: unknown } =>
        typeof m === 'object' && m !== null;
    if (media && hasMediaFields(media)) {
        const mapModeration = <
            T extends { moderationState?: string | ModerationStatusEnum; tags?: TagInput[] }
        >(
            m: T
        ): T => ({
            ...m,
            moderationState:
                m.moderationState && typeof m.moderationState === 'string'
                    ? (ModerationStatusEnum[
                          m.moderationState as keyof typeof ModerationStatusEnum
                      ] ?? ModerationStatusEnum.PENDING_REVIEW)
                    : m.moderationState,
            tags: Array.isArray(m.tags)
                ? m.tags.map((t) => {
                      if (typeof t === 'object' && t !== null && 'moderationState' in t) {
                          const tag = t as TagInput;
                          return {
                              ...tag,
                              moderationState:
                                  tag.moderationState && typeof tag.moderationState === 'string'
                                      ? (ModerationStatusEnum[
                                            tag.moderationState as keyof typeof ModerationStatusEnum
                                        ] ?? ModerationStatusEnum.PENDING_REVIEW)
                                      : tag.moderationState
                          };
                      }
                      return t;
                  })
                : m.tags
        });
        media = {
            ...media,
            featuredImage:
                'featuredImage' in media && media.featuredImage
                    ? mapModeration(media.featuredImage)
                    : undefined,
            gallery:
                'gallery' in media && Array.isArray(media.gallery)
                    ? media.gallery.map(mapModeration)
                    : undefined,
            videos:
                'videos' in media && Array.isArray(media.videos)
                    ? media.videos.map(mapModeration)
                    : undefined
        };
    }
    return {
        ...inputWithDates,
        media
    } as NewEventInputType;
};

/**
 * Builds the update object for soft-deleting (archiving) an event.
 * @param actor - The user or public actor performing the delete.
 * @returns Partial<UpdateEventInputType> with archive fields set.
 * @example
 * const update = buildSoftDeleteUpdate(user);
 */
export const buildSoftDeleteUpdate = (actor: UserType | PublicUserType) => {
    const now = new Date();
    const deletedById = 'id' in actor ? actor.id : undefined;
    return {
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        deletedAt: now,
        deletedById,
        updatedAt: now,
        updatedById: deletedById
    };
};

/**
 * Throws if the event is archived or deleted.
 * @param event - The event object.
 * @throws Error if the event is already archived or deleted.
 */
export const assertNotArchived = (event: {
    lifecycleState?: LifecycleStatusEnum;
    deletedAt?: Date | null;
}) => {
    if (event.lifecycleState === LifecycleStatusEnum.ARCHIVED || event.deletedAt) {
        throw new Error('Event is already archived or deleted');
    }
};

/**
 * Builds the update object for restoring (un-archiving) an event.
 * @param actor - The user or public actor performing the restore.
 * @returns Partial<UpdateEventInputType> with restore fields set.
 * @example
 * const update = buildRestoreUpdate(user);
 */
export const buildRestoreUpdate = (actor: UserType | PublicUserType) => {
    const now = new Date();
    const updatedById = 'id' in actor ? actor.id : undefined;
    return {
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: undefined,
        deletedById: undefined,
        updatedAt: now,
        updatedById
    };
};
