import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { PostSponsorId } from '../../common/id.types.js';
import type { ImageType } from '../../common/media.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';
import type { ClientTypeEnum } from '../../enums/client-type.enum.js';

export interface PostSponsorType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: PostSponsorId;
    name: string;
    type: ClientTypeEnum;
    description: string;
    logo?: ImageType;
    contactInfo?: ContactInfoType;
    socialNetworks?: SocialNetworkType;
}

/**
 * Partial editable structure of a PostSponsorType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPostSponsorType = Partial<Writable<PostSponsorType>>;

/**
 * Input structure used to create a new post sponsor.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPostSponsorInputType = NewEntityInput<PostSponsorType>;

/**
 * Input structure used to update an existing post sponsor.
 * All fields are optional for partial patching.
 */
export type UpdatePostSponsorInputType = PartialPostSponsorType;
