export * from './adapters/index.js';
export type { EntityChangeData } from './entity-change.types.js';
export { getAffectedCacheTags } from './entity-tag-mapper.js';
export type {
    EntityResolver,
    RevalidationServiceConfig,
    RevalidationTrigger
} from './revalidation.service.js';
export { RevalidationService } from './revalidation.service.js';
export type { InitRevalidationParams } from './revalidation-init.js';
export {
    _resetRevalidationService,
    getRevalidationService,
    initializeRevalidationService
} from './revalidation-init.js';
export * from './revalidation-stats.service.js';
