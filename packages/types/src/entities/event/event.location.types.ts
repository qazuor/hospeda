import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '@repo/types/common/helpers.types.js';
import type { BaseLocationType } from '../../common/location.types.js';

export interface EventLocationType
    extends BaseLocationType,
        WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    department?: string;
    placeName?: string;
}
