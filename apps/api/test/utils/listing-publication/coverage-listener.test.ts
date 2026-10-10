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
