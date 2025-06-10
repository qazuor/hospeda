import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '@repo/types/common/helpers.types.js';
import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostId,
    UserBookmarkId,
    UserId
} from '../../common/id.types.js';
import type { EntityTypeEnum } from '../../enums/entity-type.enum.js';

export interface UserBookmarkType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: UserBookmarkId;
    userId: UserId;
    entityId: AccommodationId | DestinationId | PostId | EventId | UserId;
    entityType: EntityTypeEnum;
    name?: string;
    description?: string;
}

/**
 * Partial editable structure of a UserBookmarkType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialUserBookmarkType = Partial<Writable<UserBookmarkType>>;

/**
 * Input structure used to create a new user bookmark.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewUserBookmarkInputType = NewEntityInput<UserBookmarkType>;

/**
 * Input structure used to update an existing user bookmark.
 * All fields are optional for partial patching.
 */
export type UpdateUserBookmarkInputType = PartialUserBookmarkType;
