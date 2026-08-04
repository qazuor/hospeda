/**
 * @file index.ts
 * @description Public surface of `@repo/cache-tags`.
 *
 * This package is deliberately dependency-free. It sits between `apps/web` (the
 * emitter) and `@repo/service-core` (the purger), and anything it imports would
 * be pulled into both — including, for the web app, the client bundle graph.
 * Keep it that way.
 */

export type { CacheTagEnvironment } from './namespace.js';
export {
    buildCacheTagNamespace,
    CACHE_TAG_ENVIRONMENTS,
    CACHE_TAG_NAMESPACE_SEPARATOR,
    isCacheTagEnvironment,
    namespaceCacheTag,
    namespaceCacheTags,
    parseNamespacedCacheTag,
    resolveCacheTagEnvironment,
    toCacheTagEnvironment
} from './namespace.js';
export type { CacheTagEntity, SerializedCacheTags } from './vocabulary.js';
export {
    buildEntityCacheTag,
    buildEntityCacheTags,
    CACHE_TAG_ALL,
    CACHE_TAG_COLLECTIONS,
    CACHE_TAG_ENTITY_PREFIXES,
    CACHE_TAG_HEADER_NAME,
    CACHE_TAG_HOME,
    CACHE_TAG_PRICING,
    CACHE_TAG_SITE_CONFIG,
    isValidCacheTag,
    MAX_CACHE_TAG_HEADER_BYTES,
    MAX_CACHE_TAG_LENGTH,
    MAX_CACHE_TAGS_PER_RESPONSE,
    normalizeCacheTagKey,
    serializeCacheTags
} from './vocabulary.js';
