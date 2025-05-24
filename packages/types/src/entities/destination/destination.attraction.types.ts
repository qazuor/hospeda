import type {
    WithActivityState,
    WithAdminInfo,
    WithAudit,
    WithId
} from '../../common/helpers.types.js';
import type { DestinationId } from '../../common/id.types.js';

/**
 * Notable attraction linked to a destination
 */
export interface DestinationAttractionType
    extends WithId,
        WithAudit,
        WithAdminInfo,
        WithActivityState {
    name: string;
    slug: string;
    description: string;
    icon: string;
    destinationId: DestinationId;
}
