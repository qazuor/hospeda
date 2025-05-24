import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../../common/helpers.types.js';
import type { PermissionId, RoleId, UserId } from '../../common/id.types.js';
import type { FullLocationType } from '../../common/location.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';
import type { UserBookmarkType } from './user.bookmark.types.js';
import type { UserProfile } from './user.profile.types.js';
import type { UserSettingsType } from './user.settings.types.js';

export interface UserType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    id: UserId;
    userName: string;
    passwordHash: string;

    firstName?: string;
    lastName?: string;
    brithDate?: Date;

    emailVerified?: boolean;
    phoneVerified?: boolean;

    contactInfo?: ContactInfoType;
    location?: FullLocationType;
    socialNetworks?: SocialNetworkType;

    roleId: RoleId;
    permissionIds?: PermissionId[];

    profile?: UserProfile;
    settings?: UserSettingsType;
    bookmarks?: UserBookmarkType[];
}
