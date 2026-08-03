/**
 * @file namespace.ts
 * @description Deployment-environment namespacing for cache tags.
 *
 * `staging.hospeda.com.ar` and `hospeda.com.ar` are the SAME Cloudflare zone —
 * verified identical `CLOUDFLARE_ZONE_ID`. One zone means one cache and one
 * per-zone purge quota, so an unqualified vocabulary (`list-accom`, `home`,
 * `accom-<slug>`) is byte-identical across environments and has two
 * consequences, both silent:
 *
 *   - any write in staging evicts production's cached objects, and vice versa;
 *   - both environments spend the same 5-tag-purges-per-minute budget, while
 *     the rate limiter in `revalidation.service.ts` is per-process state that
 *     cannot see the other deployment at all.
 *
 * The fix is a prefix on EVERY tag, including production's. Symmetry is the
 * point: an asymmetric scheme ("prod is the bare form, staging is prefixed")
 * makes the failure mode of a MISSING configuration value indistinguishable
 * from correct production behaviour — exactly the case that bites, since the
 * emitter and the purger read that value from different processes.
 *
 * Two constraints shaped the separator:
 *
 *   - `:` (0x3A) is inside the `VALID_TAG_PATTERN` of `vocabulary.ts`
 *     (`[\x21-\x2B\x2D-\x7E]`), so a namespaced tag needs no widening of the
 *     validity rule — including the copy of that rule duplicated in
 *     `@repo/schemas`;
 *   - `-` is already load-bearing INSIDE tags (entity prefixes, slug words,
 *     UUID groups), so reusing it would make `accom-prod-x` ambiguous. No
 *     slug, UUID or vocabulary constant contains a colon, which is what makes
 *     the FIRST colon an unambiguous namespace boundary and lets
 *     {@link parseNamespacedCacheTag} be exact rather than heuristic.
 *
 * THE INVARIANT THIS FILE EXISTS FOR: the emitter (`apps/web`) and the purger
 * (`@repo/service-core`) must derive the identical namespace. If they diverge,
 * the purge matches nothing and evicts nothing — and reports success while
 * doing it. That is why {@link resolveCacheTagEnvironment} lives here next to
 * the builder instead of once per side, and why it THROWS rather than guessing
 * a default in a deployed environment.
 *
 * This module holds to the package's zero-dependency rule and, additionally,
 * never reads `process.env`: the environment arrives as a parameter. Reading it
 * here would make the resolution untestable from the side that does not own the
 * variable, and would pull Node globals into the web client bundle graph.
 */

import { isValidCacheTag } from './vocabulary.js';

/**
 * The closed set of deployment environments a cache tag may be namespaced by.
 *
 * Deliberately the SAME vocabulary as `resolveEnvironment()` in
 * `@repo/media/src/server/environment.ts`, which already reads
 * `HOSPEDA_DEPLOY_ENV` for Cloudinary folder isolation. Reusing the values
 * means one variable carries one meaning across the whole platform; inventing a
 * parallel spelling (`stg`, `staging`) would give the same deployment two
 * different identities and reintroduce the drift this file removes.
 */
export const CACHE_TAG_ENVIRONMENTS = ['prod', 'preview', 'dev', 'test'] as const;

/** A deployment environment that can namespace a cache tag. */
export type CacheTagEnvironment = (typeof CACHE_TAG_ENVIRONMENTS)[number];

/**
 * The character between the environment and the tag it qualifies.
 *
 * See the file docblock for why it is a colon and not a hyphen.
 */
export const CACHE_TAG_NAMESPACE_SEPARATOR = ':';

const ENVIRONMENT_SET: ReadonlySet<string> = new Set<string>(CACHE_TAG_ENVIRONMENTS);

/**
 * Narrow an arbitrary string to a {@link CacheTagEnvironment}.
 *
 * Returns the narrowed value rather than a `value is …` predicate: TypeScript
 * cannot attach a type predicate to a destructured binding (TS1230), and the
 * RO-RO convention is not worth trading for one. Callers get the same
 * type-safety from the non-null branch, without a cast.
 *
 * @param params.value - Candidate environment identifier.
 * @returns The environment, or `null` when the value is not one of
 *   {@link CACHE_TAG_ENVIRONMENTS}.
 */
export function toCacheTagEnvironment({
    value
}: {
    readonly value: string | undefined | null;
}): CacheTagEnvironment | null {
    if (typeof value !== 'string' || !ENVIRONMENT_SET.has(value)) return null;
    return value as CacheTagEnvironment;
}

/**
 * Whether a string is one of the recognised deployment environments.
 *
 * @param params.value - Candidate environment identifier.
 * @returns `true` when the value is one of {@link CACHE_TAG_ENVIRONMENTS}.
 */
export function isCacheTagEnvironment({
    value
}: {
    readonly value: string | undefined | null;
}): boolean {
    return toCacheTagEnvironment({ value }) !== null;
}

/**
 * Build the literal prefix an environment contributes to every one of its tags.
 *
 * @param params.environment - The deployment environment.
 * @returns The prefix including its trailing separator, e.g. `prod:`.
 */
export function buildCacheTagNamespace({
    environment
}: {
    readonly environment: CacheTagEnvironment;
}): string {
    return `${environment}${CACHE_TAG_NAMESPACE_SEPARATOR}`;
}

/**
 * Split a namespaced tag back into its environment and its bare tag.
 *
 * Exact, not heuristic: the namespace boundary is the FIRST colon, and no
 * vocabulary constant, slug or UUID contains one. Used by the purge endpoint to
 * compare an incoming tag's namespace against its own — the one runtime check
 * that can actually observe emitter/purger divergence, because it is the only
 * place where a namespace derived by one process meets a namespace derived by
 * the other.
 *
 * @param params.tag - A candidate namespaced tag.
 * @returns The parsed parts, or `null` when the tag carries no recognisable
 *   environment namespace or the remainder is not a usable tag.
 */
export function parseNamespacedCacheTag({ tag }: { readonly tag: string }): {
    readonly environment: CacheTagEnvironment;
    readonly tag: string;
} | null {
    const boundary = tag.indexOf(CACHE_TAG_NAMESPACE_SEPARATOR);
    if (boundary <= 0) return null;

    const environment = toCacheTagEnvironment({ value: tag.slice(0, boundary) });
    if (environment === null) return null;

    const bare = tag.slice(boundary + CACHE_TAG_NAMESPACE_SEPARATOR.length);
    if (!isValidCacheTag({ tag: bare })) return null;

    return { environment, tag: bare };
}

/**
 * Qualify one bare tag with its deployment environment.
 *
 * Lowercases, because Cloudflare matches tags case-insensitively but our own
 * dedup sets, logs and tests do not — the same reasoning as
 * `normalizeCacheTagKey`, applied to the whole tag so both sides produce a
 * byte-identical string and not merely an equivalent one.
 *
 * Three outcomes, all deliberate:
 *
 *   - already namespaced with THIS environment → returned unchanged. Idempotence
 *     is what lets the purge service namespace at more than one entry point
 *     without producing `prod:prod:home`, a tag that would match nothing;
 *   - already namespaced with a DIFFERENT environment → `null`. Re-prefixing
 *     would yield `prod:preview:home` and silently purge nothing; the honest
 *     answer to "this tag came from somewhere else" is to refuse it;
 *   - otherwise → `<env>:<tag>`, validated as a whole, so a tag that only
 *     exceeds Cloudflare's 1024-character ceiling ONCE the prefix is added is
 *     dropped here rather than at Cloudflare's storage layer where the loss is
 *     invisible.
 *
 * @param params.environment - The deployment environment to qualify by.
 * @param params.tag - The bare vocabulary tag.
 * @returns The namespaced tag, or `null` when it cannot be built. Callers drop
 *   `null` rather than emitting a tag Cloudflare would silently discard —
 *   matching `buildEntityCacheTag`'s existing contract.
 */
export function namespaceCacheTag({
    environment,
    tag
}: {
    readonly environment: CacheTagEnvironment;
    readonly tag: string;
}): string | null {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) return null;

    const parsed = parseNamespacedCacheTag({ tag: normalized });
    if (parsed !== null) {
        return parsed.environment === environment ? normalized : null;
    }

    if (!isValidCacheTag({ tag: normalized })) return null;

    const namespaced = `${buildCacheTagNamespace({ environment })}${normalized}`;
    return isValidCacheTag({ tag: namespaced }) ? namespaced : null;
}

/**
 * Qualify a batch of bare tags, dropping the ones that cannot be namespaced.
 *
 * Order is preserved because it is load-bearing: `serializeCacheTags` truncates
 * from the TAIL when a response exceeds Cloudflare's limits, so callers put the
 * narrow entity tags first and the broad collection tags last.
 *
 * @param params.environment - The deployment environment to qualify by.
 * @param params.tags - Bare vocabulary tags, in priority order.
 * @returns The namespaced tags, deduplicated, in input order.
 */
export function namespaceCacheTags({
    environment,
    tags
}: {
    readonly environment: CacheTagEnvironment;
    readonly tags: Iterable<string>;
}): readonly string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    for (const tag of tags) {
        const namespaced = namespaceCacheTag({ environment, tag });
        if (namespaced === null || seen.has(namespaced)) continue;
        seen.add(namespaced);
        out.push(namespaced);
    }

    return out;
}

/**
 * Resolve the deployment environment both sides must agree on.
 *
 * ONE implementation, imported by the emitter and by the purger, because the
 * cost of two is a purge that reports success and evicts nothing. It is pure —
 * the caller reads `process.env` and passes the values in — so the resolution
 * of a deployment whose variables you do not own is still testable.
 *
 * The rules, and why the obvious fallback is absent:
 *
 *   - an explicit `HOSPEDA_DEPLOY_ENV` in the closed vocabulary wins;
 *   - an explicit value OUTSIDE the vocabulary throws. Silently ignoring
 *     `staging` or `stg` is how one side lands on a different namespace than
 *     the other while both look configured;
 *   - with no explicit value, only the unambiguously local environments are
 *     inferred: `NODE_ENV=test` → `test`, `development`/unset → `dev`;
 *   - anything else — in practice `NODE_ENV=production`, which is what BOTH
 *     staging and production run — throws. This is the whole point. Falling
 *     back to `prod` there is precisely the bug: staging's web app has
 *     `NODE_ENV=production` and no `HOSPEDA_DEPLOY_ENV`, so it would emit
 *     `prod:*` while staging's API purges `preview:*`, and every purge would
 *     evict production instead.
 *
 * Callers decide what a throw means for them, but neither may treat it as
 * "carry on unnamespaced": the emitter stops declaring responses cacheable and
 * the purger stops purging. Both degrade to correct-but-uncached rather than to
 * cross-environment eviction.
 *
 * @param params.deployEnv - Raw `HOSPEDA_DEPLOY_ENV`, or undefined when unset.
 * @param params.nodeEnv - Raw `NODE_ENV`, or undefined when unset.
 * @returns The resolved environment.
 * @throws {Error} When the environment cannot be resolved unambiguously. The
 *   message names the variable, the offending value and the accepted set.
 */
export function resolveCacheTagEnvironment({
    deployEnv,
    nodeEnv
}: {
    readonly deployEnv: string | undefined;
    readonly nodeEnv: string | undefined;
}): CacheTagEnvironment {
    const trimmedDeployEnv = deployEnv?.trim() ?? '';

    if (trimmedDeployEnv.length > 0) {
        const explicit = toCacheTagEnvironment({ value: trimmedDeployEnv });
        if (explicit !== null) return explicit;
        throw new Error(
            `HOSPEDA_DEPLOY_ENV is "${trimmedDeployEnv}", which is not one of ${CACHE_TAG_ENVIRONMENTS.join(' | ')}. ` +
                'Cache tags cannot be namespaced, so the emitter and the purger would disagree silently.'
        );
    }

    const trimmedNodeEnv = nodeEnv?.trim() ?? '';
    if (trimmedNodeEnv === 'test') return 'test';
    if (trimmedNodeEnv === '' || trimmedNodeEnv === 'development') return 'dev';

    throw new Error(
        `HOSPEDA_DEPLOY_ENV is not set and NODE_ENV="${trimmedNodeEnv}" cannot identify the deployment. ` +
            `Set HOSPEDA_DEPLOY_ENV to one of ${CACHE_TAG_ENVIRONMENTS.join(' | ')} on this deployment. ` +
            'It is NOT inferred from NODE_ENV=production because staging and production both run it, ' +
            'and guessing "prod" would make staging purge production.'
    );
}
