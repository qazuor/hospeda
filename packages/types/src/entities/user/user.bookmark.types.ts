import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '@repo/types/common/helpers.types.js';
import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostId,
    UserId
} from '../../common/id.types.js';
import type { EntityTypeEnum } from '../../enums/entity-type.enum.js';

export interface UserBookmarkType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    entityId: AccommodationId | DestinationId | PostId | EventId | UserId;
    entityType: EntityTypeEnum;
    name?: string;
    description?: string;
}
