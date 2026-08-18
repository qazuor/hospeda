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
import { resolveCacheTagEnvironment } from '@repo/cache-tags';
import { createLogger } from '@repo/logger';
import { createIndexNowAdapter } from './adapters/adapter-factory.js';
import type { NotifiableEntity } from './adapters/indexnow.adapter.js';
import { IndexNowService } from './indexnow.service.js';

const logger = createLogger('indexnow-init');

/** Parameters for {@link initializeIndexNowService}. */
export interface InitIndexNowParams {
    /**
     * Raw `HOSPEDA_DEPLOY_ENV`. Passed RAW, not pre-resolved, for the same
     * reason `initializeRevalidationService` does: the rules that decide which
     * deployment a process is (and which fallbacks are refused) live in
     * `resolveCacheTagEnvironment` alone. A second copy in the API layer is how
     * a staging process ends up believing it is production — which here means
     * announcing `Disallow: /` URLs to Bing.
     */
    readonly deployEnv?: string;
    /** Node environment, used as the fallback input to the same resolver. */
    readonly nodeEnv?: string;
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
    /**
     * Answers whether an entity is still publicly visible at send time (AC-4).
     *
     * Required for the same reason `isEnabled` is: this hook rides
     * `scheduleRevalidation`, which fires on an UNPUBLISH by design (purging
     * the page that just disappeared is the point). Without this check the
     * notifier would announce a URL that just stopped being public.
     */
    readonly isPubliclyVisible: (entity: NotifiableEntity) => Promise<boolean>;
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

    // Fail closed, exactly like the revalidation initializer: a process that
    // cannot name its own deployment gets the no-op adapter rather than a
    // guess. An unresolved environment is never treated as production.
    let cacheTagEnvironment: CacheTagEnvironment | undefined;
    try {
        cacheTagEnvironment = resolveCacheTagEnvironment({
            deployEnv: params.deployEnv,
            nodeEnv: params.nodeEnv
        });
    } catch (error) {
        logger.error(
            `IndexNow notification DISABLED: cannot resolve the deployment environment. ${error instanceof Error ? error.message : String(error)}`
        );
    }

    _instance = new IndexNowService({
        adapter: createIndexNowAdapter({
            cacheTagEnvironment,
            revalidationSecret: params.revalidationSecret,
            siteUrl: params.siteUrl
        }),
        isEnabled: params.isEnabled,
        isPubliclyVisible: params.isPubliclyVisible,
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
