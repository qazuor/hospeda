import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { AccommodationFaqId, AccommodationId } from '../../common/id.types.js';

export interface AccommodationFaqType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: AccommodationFaqId;
    accommodationId: AccommodationId;
    question: string;
    answer: string;
    category?: string;
}

export type PartialAccommodationFaqType = Partial<Writable<AccommodationFaqType>>;
export type NewAccommodationFaqInputType = NewEntityInput<AccommodationFaqType>;
export type UpdateAccommodationFaqInputType = PartialAccommodationFaqType;
