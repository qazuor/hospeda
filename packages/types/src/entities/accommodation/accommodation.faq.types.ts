import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState
} from '../../common/helpers.types.js';
import type { AccommodationId } from '../../common/id.types.js';

export interface AccommodationFaqType extends WithId, WithAudit, WithLifecycleState, WithAdminInfo {
    accommodationId: AccommodationId;
    question: string;
    answer: string;
    category?: string;
}
