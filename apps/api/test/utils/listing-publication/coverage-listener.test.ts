import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listener: undefined as
        | ((event: { userId: string; vertical: VerticalEnum }) => void)
        | undefined,
    subscribe: vi.fn(),
    recalculate: vi.fn(),
    ports: vi.fn(),
    error: vi.fn()
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            onCoverageChanged: (listener: typeof mocks.listener) => {
                mocks.subscribe();
                mocks.listener = listener ?? undefined;
                return vi.fn();
            }
        }
    })
}));
vi.mock('../../../src/utils/listing-publication/ports', () => ({
    getListingPublicationPorts: mocks.ports
}));
vi.mock('../../../../../packages/verticals/src/publication/coverage-recalculation', () => ({
    recalculateCoverage: mocks.recalculate
}));
vi.mock('../../../src/utils/logger', () => ({ apiLogger: { error: mocks.error } }));

import { subscribeListingCoverageRecalculation } from '../../../src/utils/listing-publication/coverage-listener';

describe('listing coverage listener', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listener = undefined;
        mocks.recalculate.mockResolvedValue({});
        mocks.ports.mockReturnValue({ unitOfWork: {}, afterCommit: {}, billing: {}, clock: {} });
    });

    it('subscribes once and ignores verticals without listings', async () => {
        const stop = subscribeListingCoverageRecalculation();
        subscribeListingCoverageRecalculation();
        expect(mocks.subscribe).toHaveBeenCalledTimes(1);
        mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.TOURIST });
        mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.PARTNER });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mocks.recalculate).not.toHaveBeenCalled();
        stop();
    });

    it('recalculates listing verticals and logs failures without throwing', async () => {
        const stop = subscribeListingCoverageRecalculation();
        mocks.recalculate.mockRejectedValueOnce(new Error('expected test failure'));
        expect(() =>
            mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.ACCOMMODATION })
        ).not.toThrow();
        await vi.waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
        expect(mocks.recalculate).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'u1',
                vertical: VerticalEnum.ACCOMMODATION
            })
        );
        stop();
    });
});

describe('TEST:1698:1 AC:1698:2 in-flight recalculations', () => {
    function deferred<T>() {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((done) => {
            resolve = done;
        });
        return { promise, resolve };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listener = undefined;
        mocks.ports.mockReturnValue({ unitOfWork: {}, afterCommit: {}, billing: {}, clock: {} });
    });

    it('TEST:1698:1 AC:1698:2 drains a pending recalculation', async () => {
        const pending = deferred<void>();
        mocks.recalculate.mockReturnValue(pending.promise);
        const stop = subscribeListingCoverageRecalculation();
        mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.ACCOMMODATION });
        let drained = false;
        const drain = import('../../../src/utils/listing-publication/coverage-listener').then(
            ({ drainListingCoverageRecalculations }) =>
                drainListingCoverageRecalculations().then(() => {
                    drained = true;
                })
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(drained).toBe(false);
        pending.resolve(undefined);
        await drain;
        expect(drained).toBe(true);
        stop();
    });

    it('TEST:1698:1 AC:1698:2 drains recalculations that start while waiting', async () => {
        const first = deferred<void>();
        const second = deferred<void>();
        mocks.recalculate
            .mockImplementationOnce(async () => {
                await first.promise;
                mocks.listener?.({ userId: 'u2', vertical: VerticalEnum.GASTRONOMY });
            })
            .mockReturnValueOnce(second.promise);
        const stop = subscribeListingCoverageRecalculation();
        mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.ACCOMMODATION });
        const { drainListingCoverageRecalculations } = await import(
            '../../../src/utils/listing-publication/coverage-listener'
        );
        let drained = false;
        const drain = drainListingCoverageRecalculations().then(() => {
            drained = true;
        });
        first.resolve(undefined);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(drained).toBe(false);
        second.resolve(undefined);
        await drain;
        expect(drained).toBe(true);
        expect(mocks.recalculate).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ userId: 'u1' })
        );
        expect(mocks.recalculate).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ userId: 'u2' })
        );
        stop();
    });

    it('TEST:1698:1 AC:1698:2 resolves after a failed recalculation and logs it once', async () => {
        mocks.recalculate.mockRejectedValueOnce(new Error('expected test failure'));
        const stop = subscribeListingCoverageRecalculation();
        mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.ACCOMMODATION });
        const { drainListingCoverageRecalculations } = await import(
            '../../../src/utils/listing-publication/coverage-listener'
        );
        await expect(drainListingCoverageRecalculations()).resolves.toBeUndefined();
        expect(mocks.error).toHaveBeenCalledTimes(1);
        stop();
    });

    it('TEST:1698:1 AC:1698:4 returns undefined while the recalculation remains pending', async () => {
        const pending = deferred<void>();
        mocks.recalculate.mockReturnValue(pending.promise);
        const stop = subscribeListingCoverageRecalculation();
        const result = mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.ACCOMMODATION });
        expect(result).toBe(undefined);
        expect(mocks.recalculate).toHaveBeenCalledTimes(1);
        pending.resolve(undefined);
        const { drainListingCoverageRecalculations } = await import(
            '../../../src/utils/listing-publication/coverage-listener'
        );
        await drainListingCoverageRecalculations();
        stop();
    });
});
