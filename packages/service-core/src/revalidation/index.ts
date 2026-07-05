export * from './adapters/index.js';
export type {
    AccommodationTypeSlug,
    EntityChangeData,
    EventCategorySlug,
    SupportedLocale
} from './entity-path-mapper.js';
export {
    ACCOMMODATION_TYPE_SLUGS,
    EVENT_CATEGORY_SLUGS,
    getAffectedPaths,
    getLocalizedPath,
    SUPPORTED_LOCALES
} from './entity-path-mapper.js';
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
