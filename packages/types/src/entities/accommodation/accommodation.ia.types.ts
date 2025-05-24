import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState
} from '../../common/helpers.types.js';
import type { AccommodationId } from '../../common/id.types.js';

export interface AccommodationIaDataType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithAdminInfo {
    accommodationId: AccommodationId;
    title: string;
    content: string;
    category?: string;
}
