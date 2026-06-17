/**
 * @file index.ts
 * Public barrel for the generic commerce admin config-layer.
 *
 * Concrete commerce entities (gastronomy, experiences, …) import from here
 * to access config builders, section factories, and hook factories WITHOUT
 * depending on the internal file paths of this feature.
 *
 * DO NOT export gastronomy-specific or experience-specific symbols here.
 * This module is the reusable shared layer only.
 */

// Types
export type {
    ColumnTFunction,
    CommerceConsolidatedConfigParams,
    CommerceEntityConfigParams
} from './types';

// List config factory
export { createCommerceListConfig } from './config/createCommerceListConfig';

// Shared section builders
export {
    createCommerceIdentitySection,
    createCommerceOperationalSection
} from './config/commerceSections';

// Hooks factory + related types
export { createCommerceEntityHooks } from './hooks/createCommerceEntityHooks';

export type {
    AssignOwnerInput,
    CommerceEntityHooks,
    CommerceEntityHooksConfig,
    ModerateReviewInput,
    PendingReviewsQueryParams,
    ReviewModerationDecision
} from './hooks/createCommerceEntityHooks';
