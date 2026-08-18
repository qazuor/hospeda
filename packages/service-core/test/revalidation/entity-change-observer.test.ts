/**
 * @fileoverview
 * Tests for `RevalidationServiceConfig.onEntityChange` (HOS-585 G-1) — the hook
 * IndexNow rides in production.
 *
 * The point of these tests is the DECOUPLING, not the forwarding. Anyone can
 * see that a callback gets called; what is easy to break by accident is that it
 * still gets called when the `revalidation_config` row says this deployment's
 * cache should not be purged. That table configures a CACHE. It is not a
 * publication switch, and letting it gate search-engine notifications would
 * mean a cache tuning change silently stops telling Bing about new content.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    RevalidationConfigModel: vi.fn().mockImplementation(function () {
        return { findByEntityType: vi.fn() };
    }),
    RevalidationLogModel: vi.fn().mockImplementation(function () {
        return { create: vi.fn().mockResolvedValue(undefined) };
    })
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn().mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { RevalidationAdapter } from '../../src/revalidation/adapters/revalidation.adapter.js';
import { WHOLE_ZONE_TARGET } from '../../src/revalidation/adapters/revalidation.adapter.js';
import type { EntityChangeData } from '../../src/revalidation/entity-change.types.js';
import { RevalidationService } from '../../src/revalidation/revalidation.service.js';

function makeMockAdapter(): RevalidationAdapter {
    // `revalidateMany` delegates to `revalidate` on purpose: the service purges
    // in coalesced batches, so an independent `revalidateMany` would leave
    // `revalidate` at zero calls and make every purge assertion below vacuous.
    const revalidate = vi.fn(async (params: { readonly tag: string }) => ({
        success: true,
        target: params.tag,
        durationMs: 1
    }));
    return {
        name: 'MockAdapter',
        revalidate,
        revalidateMany: vi.fn(async (params: { readonly tags: ReadonlyArray<string> }) =>
            Promise.all(params.tags.map((tag) => revalidate({ tag })))
        ),
        purgeEverything: vi.fn(async (_params: { readonly reason?: string }) => ({
            target: WHOLE_ZONE_TARGET,
            success: true,
            durationMs: 1
        }))
    };
}

/** Configure the mocked config model to answer with `record` for every lookup. */
function stubConfig(record: unknown): void {
    (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
        return { findByEntityType: vi.fn().mockResolvedValue(record) };
    });
}

function makeConfigRecord(overrides: Record<string, unknown> = {}) {
    return {
        id: 'cfg-id',
        entityType: 'accommodation',
        enabled: true,
        autoRevalidateOnChange: true,
        debounceSeconds: 1,
        cronIntervalMinutes: 60,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function createService(params: {
    readonly onEntityChange?: (event: EntityChangeData) => void;
    readonly adapter?: RevalidationAdapter;
}) {
    return new RevalidationService({
        adapter: params.adapter ?? makeMockAdapter(),
        cacheTagEnvironment: 'test',
        onEntityChange: params.onEntityChange
    });
}

describe('RevalidationService onEntityChange observer (HOS-585)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        stubConfig(makeConfigRecord());
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return { create: vi.fn().mockResolvedValue(undefined) };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('forwards the event verbatim, slug included', () => {
        const onEntityChange = vi.fn();
        const service = createService({ onEntityChange });

        const event: EntityChangeData = { entityType: 'accommodation', slug: 'hotel-a' };
        service.scheduleRevalidation(event);

        expect(onEntityChange).toHaveBeenCalledTimes(1);
        expect(onEntityChange).toHaveBeenCalledWith(event);
        // The slug is the whole point: without it there is no URL to submit,
        // and it is the field the shared purge window drops downstream.
        expect(onEntityChange.mock.calls[0]?.[0]?.slug).toBe('hotel-a');
    });

    it('notifies synchronously, before the debounce and before any purge', () => {
        const onEntityChange = vi.fn();
        const adapter = makeMockAdapter();
        const service = createService({ onEntityChange, adapter });

        service.scheduleRevalidation({ entityType: 'post', slug: 'un-post' });

        expect(onEntityChange).toHaveBeenCalledTimes(1);
        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('still notifies when the entity type has revalidation DISABLED', async () => {
        stubConfig(makeConfigRecord({ enabled: false }));
        const onEntityChange = vi.fn();
        const adapter = makeMockAdapter();
        const service = createService({ onEntityChange, adapter });

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });
        await vi.runAllTimersAsync();

        // The cache purge is correctly suppressed...
        expect(adapter.revalidate).not.toHaveBeenCalled();
        // ...and the notification is NOT.
        expect(onEntityChange).toHaveBeenCalledTimes(1);
    });

    it('still notifies when autoRevalidateOnChange is off', async () => {
        stubConfig(makeConfigRecord({ autoRevalidateOnChange: false }));
        const onEntityChange = vi.fn();
        const adapter = makeMockAdapter();
        const service = createService({ onEntityChange, adapter });

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
        expect(onEntityChange).toHaveBeenCalledTimes(1);
    });

    it('still notifies when the entity type has NO config row at all', async () => {
        stubConfig(undefined);
        const onEntityChange = vi.fn();
        const adapter = makeMockAdapter();
        const service = createService({ onEntityChange, adapter });

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
        expect(onEntityChange).toHaveBeenCalledTimes(1);
    });

    it('fires once per event in scheduleRevalidationBatch, with no debounce collapsing', () => {
        const onEntityChange = vi.fn();
        const service = createService({ onEntityChange });

        service.scheduleRevalidationBatch({
            events: [
                { entityType: 'accommodation', slug: 'hotel-a' },
                { entityType: 'accommodation', slug: 'hotel-b' },
                { entityType: 'post', slug: 'un-post' }
            ]
        });

        expect(onEntityChange).toHaveBeenCalledTimes(3);
        expect(onEntityChange.mock.calls.map((c) => c[0]?.slug)).toEqual([
            'hotel-a',
            'hotel-b',
            'un-post'
        ]);
    });

    it('lets revalidation proceed when the observer throws', async () => {
        const onEntityChange = vi.fn(() => {
            throw new Error('indexnow exploded');
        });
        const adapter = makeMockAdapter();
        const service = createService({ onEntityChange, adapter });

        expect(() =>
            service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' })
        ).not.toThrow();

        await vi.runAllTimersAsync();

        // The purge happened anyway: a broken notifier never fails a publish.
        expect(adapter.revalidate).toHaveBeenCalled();
        const logger = (createLogger as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value as {
            warn: ReturnType<typeof vi.fn>;
        };
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Entity-change observer threw')
        );
    });

    it('works with no observer configured', async () => {
        const adapter = makeMockAdapter();
        const service = createService({ adapter });

        expect(() =>
            service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' })
        ).not.toThrow();

        await vi.runAllTimersAsync();
        expect(adapter.revalidate).toHaveBeenCalled();
    });
});
