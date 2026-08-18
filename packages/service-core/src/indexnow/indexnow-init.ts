/**
 * @fileoverview
 * Singleton wiring for the IndexNow notification service (HOS-585 G-1).
 *
 * Mirrors `revalidation/revalidation-init.ts`: one instance per process,
 * created at API startup, retrieved by the write hooks. Kept separate from the
 * revalidation singleton so a deployment can have a live cache purge and no
 * search-engine notification (the normal state of staging) without either
 * knowing about the other.
 */

import type { CacheTagEnvironment } from '@repo/cache-tags';
import { createIndexNowAdapter } from './adapters/adapter-factory.js';
import { IndexNowService } from './indexnow.service.js';

/** Parameters for {@link initializeIndexNowService}. */
export interface InitIndexNowParams {
    /** Resolved deployment environment. Only `'prod'` gets a live adapter. */
    readonly cacheTagEnvironment?: CacheTagEnvironment;
    /** Shared secret matching `HOSPEDA_REVALIDATION_SECRET` on the web app. */
    readonly revalidationSecret?: string;
    /** Base site URL, e.g. `https://hospeda.com.ar`. */
    readonly siteUrl?: string;
    /**
     * Reads the operator's on/off toggle. Injected rather than imported so this
     * module does not depend on the settings service (and so tests can drive
     * it without a database).
     */
    readonly isEnabled: () => Promise<boolean>;
    /** Coalescing window in ms. Defaults to the service's own default. */
    readonly debounceMs?: number;
}

let _instance: IndexNowService | undefined;

/**
 * Create the process-wide {@link IndexNowService}.
 *
 * Idempotent: a second call logs nothing and returns the existing instance,
 * matching the revalidation initializer's behaviour.
 *
 * @param params - Environment, connection and toggle configuration.
 * @returns The singleton.
 */
export function initializeIndexNowService(params: InitIndexNowParams): IndexNowService {
    if (_instance !== undefined) return _instance;

    _instance = new IndexNowService({
        adapter: createIndexNowAdapter({
            cacheTagEnvironment: params.cacheTagEnvironment,
            revalidationSecret: params.revalidationSecret,
            siteUrl: params.siteUrl
        }),
        isEnabled: params.isEnabled,
        debounceMs: params.debounceMs
    });

    return _instance;
}

/**
 * The initialized {@link IndexNowService}, or `undefined` before startup wiring
 * has run. Callers treat `undefined` as "notifications are not configured" and
 * carry on — never as an error.
 *
 * @returns The singleton, or undefined.
 */
export function getIndexNowService(): IndexNowService | undefined {
    return _instance;
}

/**
 * Reset the singleton.
 *
 * @internal Use only in tests.
 */
export function _resetIndexNowService(): void {
    _instance = undefined;
}
