import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { PostId, PostSponsorId, PostSponsorshipId } from '../../common/id.types.js';
import type { BasePriceType } from '../../common/price.types.js';

export interface PostSponsorshipType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: PostSponsorshipId;
    sponsorId: PostSponsorId;
    postId: PostId;
    message?: string;
    description: string;
    paid: BasePriceType;
    paidAt?: Date;
    fromDate?: Date;
    toDate?: Date;
    isHighlighted?: boolean;
}

/**
 * Partial editable structure of a PostSponsorshipType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPostSponsorshipType = Partial<Writable<PostSponsorshipType>>;

/**
 * Input structure used to create a new post.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPostSponsorshipInputType = NewEntityInput<PostSponsorshipType>;

/**
 * Input structure used to update an existing post.
 * All fields are optional for partial patching.
 */
export type UpdatePostSponsorshipInputType = PartialPostSponsorshipType;
