import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { AttractionId, DestinationId } from '../../common/id.types.js';

export interface AttractionType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: AttractionId;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    isBuiltin: boolean;
}

export interface DestinationAttractionType {
    destinationId: DestinationId;
    attractionId: AttractionId;
}

export type PartialAttractionType = Partial<Writable<AttractionType>>;
export type NewAttractionInputType = NewEntityInput<AttractionType>;
export type UpdateAttractionInputType = PartialAttractionType;
