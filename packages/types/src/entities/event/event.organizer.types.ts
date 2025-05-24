import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../../common/helpers.types.js';
import type { EventOrganizerId } from '../../common/id.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';

export interface EventOrganizerType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    id: EventOrganizerId;
    name: string;
    logo?: string;
    contactInfo?: ContactInfoType;
    social?: SocialNetworkType;
}
