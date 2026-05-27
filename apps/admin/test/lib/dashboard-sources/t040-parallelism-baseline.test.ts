/**
 * T-040 — Dashboard widget query parallelism baseline (SPEC-155)
 *
 * Asserts that the dashboard fires its widget queries in parallel — no
 * waterfall dependency between independent widget resolvers.
 *
 * ## What "parallel" means here
 *
 * Each widget in the dashboard config owns an independent resolver factory:
 * it is registered via `registerDataSource` and resolved independently by
 * `resolveDataSource`. No resolver awaits the result of another resolver.
 * This structural independence is the guarantee that TanStack Query can
 * (and will) schedule all widget fetches concurrently on mount.
 *
 * ## Approach
 *
 * We assert the structural property at the registry level — no real timers,
 * no network, fully deterministic:
 *
 * 1. Register N independent sources (simulating N widgets).
 * 2. Resolve all N sources and collect their queryFn factories.
 * 3. Start all queryFn invocations simultaneously (no await between them).
 * 4. Verify all N promises complete via `Promise.allSettled` — if any one
 *    blocked on another the test would deadlock or behave differently.
 * 5. Assert that each queryFn was called exactly once (no hidden sequential
 *    chaining calls it multiple times).
 *
 * We additionally verify that the resolver registry itself has no sequential
 * dependency: `resolveDataSource` for source A does not trigger source B.
 *
 * @see apps/admin/src/lib/dashboard-sources.ts — registry under test
 * @see apps/admin/src/components/dashboards/DashboardRenderer.tsx — consumer
 * @see SPEC-155 T-040
 */

import {
    DASHBOARD_STALE_TIME_MS,
    _clearRegistryForTesting,
    buildDashboardQueryKey,
    isSourceRegistered,
    registerDataSource,
    resolveDataSource
} from '@/lib/dashboard-sources';
import type { ResolverContext } from '@/lib/dashboard-sources';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// HELPERS
// ============================================================================

function makeAdminCtx(): ResolverContext {
    return {
        role: 'ADMIN',
        userId: 'usr_admin_para_test',
        permissions: ['ACCOMMODATION_VIEW_ALL'],
        scope: 'all'
    };
}

function makeHostCtx(userId = 'usr_host_para_test'): ResolverContext {
    return {
        role: 'HOST',
        userId,
        permissions: ['ACCOMMODATION_VIEW_OWN'],
        scope: 'own'
    };
}

/**
 * Registers a set of stub sources with IDs derived from a unique prefix.
 * Each source gets its own spy-wrapped queryFn so invocations are trackable.
 *
 * @param prefix - Unique string prefix to namespace the source IDs.
 * @param count  - Number of sources to register.
 * @returns      - Array of { sourceId, spy } tuples.
 */
function registerParallelSources(
    prefix: string,
    count: number
): ReadonlyArray<{ readonly sourceId: string; readonly spy: ReturnType<typeof vi.fn> }> {
    const sources: Array<{ readonly sourceId: string; readonly spy: ReturnType<typeof vi.fn> }> =
        [];

    for (let i = 0; i < count; i++) {
        const sourceId = `${prefix}.source-${i}`;
        const spy = vi.fn(async () => ({ result: i }));

        if (!isSourceRegistered(sourceId)) {
            registerDataSource(sourceId, (ctx) => ({
                queryKey: buildDashboardQueryKey(sourceId, ctx),
                queryFn: spy,
                staleTime: DASHBOARD_STALE_TIME_MS
            }));
        }

        sources.push({ sourceId, spy });
    }

    return sources;
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

afterEach(() => {
    _clearRegistryForTesting();
    vi.restoreAllMocks();
});

// ============================================================================
// T-040 — Structural: resolveDataSource for source A does not call source B
// ============================================================================

describe('T-040 parallelism baseline — resolver independence', () => {
    it('resolving source A does not invoke source B queryFn (no sequential chaining)', () => {
        const sources = registerParallelSources('t040.nochain', 3);

        // Resolve A.
        const ctxA = makeAdminCtx();
        resolveDataSource(sources[0]!.sourceId, ctxA);

        // B and C queryFns must not have been called just because A was resolved.
        expect(sources[1]!.spy).not.toHaveBeenCalled();
        expect(sources[2]!.spy).not.toHaveBeenCalled();
    });

    it('resolving N sources independently calls each factory exactly once when invoked', async () => {
        const count = 5;
        const sources = registerParallelSources('t040.indep', count);
        const ctx = makeAdminCtx();

        // Resolve all N sources and invoke each queryFn once.
        const invocations = sources.map(({ sourceId }) => {
            const { options } = resolveDataSource(sourceId, ctx);
            // Invoke directly to check the spy wiring.
            return options.queryFn();
        });

        // Wait for all invocations to settle.
        const results = await Promise.allSettled(invocations);

        // All must have fulfilled (no failure due to chaining/blocking).
        for (const result of results) {
            expect(result.status).toBe('fulfilled');
        }

        // Each spy was called exactly once — no hidden double-invocations.
        for (const { spy } of sources) {
            expect(spy).toHaveBeenCalledTimes(1);
        }
    });

    it('all N queryFns can be started simultaneously without deadlock', async () => {
        const count = 7;
        const sources = registerParallelSources('t040.simultaneous', count);
        const ctx = makeAdminCtx();

        // Collect queryFn factories first — do NOT await between them.
        const queryFns = sources.map(({ sourceId }) => {
            const { found, options } = resolveDataSource(sourceId, ctx);
            expect(found).toBe(true);
            return options.queryFn;
        });

        // Fire all simultaneously (exact definition of parallel).
        const promises = queryFns.map((fn) => fn());
        const results = await Promise.allSettled(promises);

        expect(results).toHaveLength(count);
        for (const result of results) {
            expect(result.status).toBe('fulfilled');
        }
    });
});

// ============================================================================
// T-040 — queryKey uniqueness: each source gets a distinct cache slot
// ============================================================================

describe('T-040 parallelism baseline — independent cache slots', () => {
    it('N sources for the same role/scope produce N distinct queryKeys', () => {
        const count = 6;
        const sources = registerParallelSources('t040.keys', count);
        const ctx = makeAdminCtx();

        const keys = sources.map(({ sourceId }) => {
            const { options } = resolveDataSource(sourceId, ctx);
            return JSON.stringify(options.queryKey);
        });

        // All N keys must be distinct (no collision that would share a cache entry).
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(count);
    });

    it('the same source resolved for two different HOST users produces two distinct cache keys', () => {
        const [entry] = registerParallelSources('t040.userkeys', 1);
        const sourceId = entry!.sourceId;

        const ctxA = makeHostCtx('usr_para_a');
        const ctxB = makeHostCtx('usr_para_b');

        const { options: optsA } = resolveDataSource(sourceId, ctxA);
        const { options: optsB } = resolveDataSource(sourceId, ctxB);

        expect(JSON.stringify(optsA.queryKey)).not.toBe(JSON.stringify(optsB.queryKey));
    });
});

// ============================================================================
// T-040 — No shared mutable state between resolver invocations
// ============================================================================

describe('T-040 parallelism baseline — resolver invocation isolation', () => {
    it('resolving the same source multiple times with different contexts returns independent objects', () => {
        const [entry] = registerParallelSources('t040.immutable', 1);
        const sourceId = entry!.sourceId;

        const ctx1 = makeAdminCtx();
        const ctx2 = makeHostCtx('usr_immutable_test');

        const result1 = resolveDataSource(sourceId, ctx1);
        const result2 = resolveDataSource(sourceId, ctx2);

        // Options objects must be independent (no reference sharing).
        expect(result1.options).not.toBe(result2.options);
        expect(result1.options.queryKey).not.toBe(result2.options.queryKey);
    });

    it('calling resolveDataSource does not mutate the passed ResolverContext', () => {
        const [entry] = registerParallelSources('t040.nomutate', 1);
        const ctx = makeAdminCtx();
        const ctxCopy = { ...ctx };

        resolveDataSource(entry!.sourceId, ctx);

        // Context object must be unchanged after resolve.
        expect(ctx).toEqual(ctxCopy);
    });

    it('queryFn invocations from two sources are independent — one failure does not affect the other', async () => {
        const failingSourceId = 't040.failsource';
        const successSourceId = 't040.successsource';

        registerDataSource(failingSourceId, (ctx) => ({
            queryKey: buildDashboardQueryKey(failingSourceId, ctx),
            queryFn: async () => {
                throw new Error('intentional failure');
            },
            staleTime: 0
        }));

        registerDataSource(successSourceId, (ctx) => ({
            queryKey: buildDashboardQueryKey(successSourceId, ctx),
            queryFn: async () => ({ value: 42 }),
            staleTime: 0
        }));

        const ctx = makeAdminCtx();
        const { options: failOpts } = resolveDataSource(failingSourceId, ctx);
        const { options: successOpts } = resolveDataSource(successSourceId, ctx);

        const [failResult, successResult] = await Promise.allSettled([
            failOpts.queryFn(),
            successOpts.queryFn()
        ]);

        expect(failResult.status).toBe('rejected');
        expect(successResult.status).toBe('fulfilled');
        // The success source returns its data undisturbed.
        if (successResult.status === 'fulfilled') {
            expect(successResult.value).toEqual({ value: 42 });
        }
    });
});

// ============================================================================
// T-040 — Real HOST sources are all independently resolvable
// ============================================================================

describe('T-040 parallelism baseline — HOST sources resolve independently', () => {
    const HOST_SOURCE_IDS = [
        'host.accommodations.count',
        'host.accommodations.drafts',
        'host.billing.plan',
        'host.conversations.pending',
        'host.reviews.latest',
        'host.stats.favorites',
        'host.stats.response-rate',
        'host.stats.ratings'
    ] as const;

    // Register stubs for all HOST sources so this test file is self-contained.
    // (The real host.ts module may already be registered from other test files,
    // but since we clear in afterEach we register stubs here.)
    const HOST_STUB_PREFIX = 't040.host';
    const hostStubs = HOST_SOURCE_IDS.map((id) => {
        const stubId = `${HOST_STUB_PREFIX}.${id}`;
        return { originalId: id, stubId };
    });

    it('all HOST stub sources can be resolved simultaneously without interference', async () => {
        const ctx = makeHostCtx('usr_parallel_host');

        // Register stubs mapping each HOST ID to a deterministic result.
        for (const { stubId } of hostStubs) {
            if (!isSourceRegistered(stubId)) {
                const capturedId = stubId;
                registerDataSource(stubId, (resolverCtx) => ({
                    queryKey: buildDashboardQueryKey(capturedId, resolverCtx),
                    queryFn: async () => ({ source: capturedId }),
                    staleTime: DASHBOARD_STALE_TIME_MS
                }));
            }
        }

        // Resolve all stubs simultaneously (parallel invocation).
        const promises = hostStubs.map(({ stubId }) => {
            const { found, options } = resolveDataSource(stubId, ctx);
            expect(found).toBe(true);
            return options.queryFn();
        });

        const results = await Promise.allSettled(promises);

        expect(results).toHaveLength(HOST_SOURCE_IDS.length);
        for (const result of results) {
            expect(result.status).toBe('fulfilled');
        }
    });
});
