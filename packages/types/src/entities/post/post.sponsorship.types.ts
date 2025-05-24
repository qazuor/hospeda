import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../../common/helpers.types.js';
import type { PostId, PostSponsorId, PostSponsorshipId } from '../../common/id.types.js';
import type { BasePriceType } from '../../common/price.types.js';

export interface PostSponsorshipType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
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
