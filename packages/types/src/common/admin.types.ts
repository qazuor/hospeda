import type { WithTags } from './helpers.types.js';

export interface AdminInfoType extends WithTags {
    notes?: string;
    favorite: boolean;
}
