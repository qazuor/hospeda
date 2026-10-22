import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listener: undefined as ((event: CoverageChangedEvent) => Promise<void> | void) | undefined,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    invalidate: vi.fn()
}));

vi.mock('../../src/utils/listing-access/coverage-notices', () => ({
    getCoverageNotices: () => ({
        onCoverageChanged: (listener: (event: CoverageChangedEvent) => Promise<void> | void) => {
            mocks.subscribe();
            mocks.listener = listener;
            return () => {
                mocks.unsubscribe();
                mocks.listener = undefined;
            };
        }
    })
}));
vi.mock('../../src/utils/effective-set-cache', () => ({
    invalidateEffectiveSetsForUser: mocks.invalidate
}));

import { subscribeEffectiveSetCoverageInvalidation } from '../../src/utils/effective-set-coverage-invalidation';

const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE,
    VerticalEnum.TOURIST,
    VerticalEnum.PARTNER
];
const changes = ['ADDED', 'REMOVED', 'CHANGED'] as const;

/** Delivers one event the way the real registry does: to the registered listener, if any. */
const emit = (event: CoverageChangedEvent) => mocks.listener?.(event);

describe('TEST:1738:1 AC:1738:1 AC:1738:4 effective-set coverage invalidation listener', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listener = undefined;
        mocks.invalidate.mockResolvedValue(undefined);
    });

    it('(a) registers a single listener across repeated subscriptions', () => {
        const first = subscribeEffectiveSetCoverageInvalidation();
        const second = subscribeEffectiveSetCoverageInvalidation();
        expect(mocks.subscribe).toHaveBeenCalledTimes(1);
        first();
        second();
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
        expect(mocks.listener).toBeUndefined();
    });

    it('(b) invalidates the user for every vertical and every change', async () => {
        const stop = subscribeEffectiveSetCoverageInvalidation();
        let expected = 0;
        for (const vertical of verticals) {
            for (const change of changes) {
                await emit({
                    userId: 'user-1',
                    vertical,
                    sourceType: 'SUBSCRIPTION',
                    change
                });
                expected += 1;
                expect(mocks.invalidate).toHaveBeenCalledTimes(expected);
                expect(mocks.invalidate).toHaveBeenLastCalledWith('user-1');
            }
        }
        stop();
    });

    it('(c) rejects the listener promise but never the emitter', async () => {
        const { createCoverageNoticeRegistry } = await import('@repo/service-core');
        const registry = createCoverageNoticeRegistry();
        const stop = subscribeEffectiveSetCoverageInvalidation();
        registry.onCoverageChanged(mocks.listener!);
        mocks.invalidate.mockRejectedValue(new Error('expected test failure'));
        const event: CoverageChangedEvent = {
            userId: 'user-1',
            vertical: VerticalEnum.TOURIST,
            sourceType: 'SUBSCRIPTION',
            change: 'ADDED'
        };

        const result = emit(event);
        expect(result).toBeInstanceOf(Promise);
        await expect(result).rejects.toThrow('expected test failure');
        await expect(registry.emitCoverageChanged(event)).resolves.toBeUndefined();
        stop();
    });

    it('(d) stops invalidating after teardown', async () => {
        const stop = subscribeEffectiveSetCoverageInvalidation();
        stop();
        await emit({
            userId: 'user-1',
            vertical: VerticalEnum.ACCOMMODATION,
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
        expect(mocks.invalidate).not.toHaveBeenCalled();
    });
});
