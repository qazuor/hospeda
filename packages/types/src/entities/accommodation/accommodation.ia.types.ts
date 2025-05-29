import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { AccommodationIaDataId, AccommodationId } from '../../common/id.types.js';

export interface AccommodationIaDataType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: AccommodationIaDataId;
    accommodationId: AccommodationId;
    title: string;
    content: string;
    category?: string;
}

export type PartialAccommodationIaDataType = Partial<Writable<AccommodationIaDataType>>;
export type NewAccommodationIaDataInputType = NewEntityInput<AccommodationIaDataType>;
export type UpdateAccommodationIaDataInputType = PartialAccommodationIaDataType;
