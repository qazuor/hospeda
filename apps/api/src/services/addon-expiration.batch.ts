/**
 * Re-export shim for backward compatibility.
 * The canonical source has moved to @repo/service-core.
 *
 * @module services/addon-expiration.batch
 * @deprecated Import from '@repo/service-core' instead.
 */
export {
    type ExpireAddonFn,
    type ProcessExpiredAddonsResult,
    processExpiredAddonsBatch
} from '@repo/service-core';
