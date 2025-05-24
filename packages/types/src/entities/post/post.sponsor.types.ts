import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../../common/helpers.types.js';
import type { PostSponsorId } from '../../common/id.types.js';
import type { ImageType } from '../../common/media.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';
import type { ClientTypeEnum } from '../../enums/client-type.enum.js';

export interface PostSponsorType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    id: PostSponsorId;
    name: string;
    type: ClientTypeEnum;
    description: string;
    logo?: ImageType;
    contact?: ContactInfoType;
    social?: SocialNetworkType;
}
