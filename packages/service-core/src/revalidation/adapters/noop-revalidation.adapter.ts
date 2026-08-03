import type { RevalidateTargetResult, RevalidationAdapter } from './revalidation.adapter.js';
import { WHOLE_ZONE_TARGET } from './revalidation.adapter.js';

/**
 * No-op adapter used in development and test environments.
 * Simulates successful invalidation without making any HTTP calls.
 *
 * @example
 * ```ts
 * const adapter = new NoOpRevalidationAdapter();
 * const result = await adapter.revalidate({ tag: 'accom-hotel-paradise' });
 * // result.success === true, no HTTP request was made
 * ```
 */
export class NoOpRevalidationAdapter implements RevalidationAdapter {
    readonly name = 'NoOpRevalidationAdapter';

    /**
     * Simulates a successful purge without making any HTTP calls.
     *
     * @param params.tag - The cache tag (returned in the result, otherwise ignored)
     * @returns A successful result targeting the given tag
     */
    async revalidate(params: { readonly tag: string }): Promise<RevalidateTargetResult> {
        const { tag } = params;
        const start = Date.now();
        return {
            target: tag,
            success: true,
            durationMs: Date.now() - start
        };
    }

    /**
     * Simulates a successful purge for every tag without making any HTTP calls.
     *
     * @param params.tags - The cache tags to simulate purging
     * @returns Array of successful results, one per tag
     */
    async revalidateMany(params: {
        readonly tags: ReadonlyArray<string>;
    }): Promise<ReadonlyArray<RevalidateTargetResult>> {
        const { tags } = params;
        return Promise.all(tags.map((tag) => this.revalidate({ tag })));
    }

    /**
     * Simulates a successful whole-zone flush.
     *
     * @param _params.reason - Ignored; accepted for interface parity
     * @returns A successful result targeting `*`
     */
    async purgeEverything(_params: { readonly reason?: string }): Promise<RevalidateTargetResult> {
        const start = Date.now();
        return {
            target: WHOLE_ZONE_TARGET,
            success: true,
            durationMs: Date.now() - start
        };
    }
}
