// TEST:1676:1 (unit) — the factory's exhaustive switch routes CANCELLED_ON_GRACE to the branch-5
// mirror and leaves every other pair unregistered (HOS-1676 H-1, H-5).
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mirrorMock = vi.hoisted(() => ({
    mirrorProviderCancellationOnGrace: vi.fn()
}));
vi.mock('../../../../src/services/billing/notice/mirror-cancelled-on-grace.js', () => mirrorMock);

import { createProviderNoticeMirrorDelegates } from '../../../../src/services/billing/notice/provider-notice-delegates.js';
import {
    MIRROR_PAIR_IDS,
    type MirrorPairId
} from '../../../../src/services/billing/notice/provider-notice-ports.js';
import type { SuccessionCloser } from '../../../../src/services/billing/subscription/subscription-billing-ports.js';
import { unimplementedSuccessionCloser } from '../../../../src/services/billing/subscription/subscription-billing-ports.js';

const REGISTERED: readonly MirrorPairId[] = ['CANCELLED_ON_GRACE'];
const clock = { now: () => new Date('2026-10-13T12:00:00.000Z') };
const readAt = new Date('2026-10-13T11:59:00.000Z');
const subscriptionId = '11111111-1111-4111-8111-111111111111';

function fakeProvider(): PaymentProvider {
    return new FakePaymentProvider({
        idNamespace: 'hos-1676-unit',
        clock,
        honestAbout: [{ lie: 'M1', why: 'unit test: never called' }]
    });
}

function ports(successionCloser?: SuccessionCloser) {
    return {
        provider: fakeProvider(),
        clock,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        successionCloser
    };
}

beforeEach(() => {
    mirrorMock.mirrorProviderCancellationOnGrace.mockReset();
});

describe('createProviderNoticeMirrorDelegates (HOS-1676 H-5)', () => {
    it('routes CANCELLED_ON_GRACE to mirrorProviderCancellationOnGrace with readAt and S18 defaulted', async () => {
        // Arrange
        mirrorMock.mirrorProviderCancellationOnGrace.mockResolvedValue({
            outcome: 'CANCELLED',
            successionClosed: false
        });
        const delegates = createProviderNoticeMirrorDelegates(ports());

        // Act
        await delegates.delegate({
            pair: 'CANCELLED_ON_GRACE',
            subscriptionId,
            readAt,
            cancelledSeenAt: null
        });

        // Assert
        expect(mirrorMock.mirrorProviderCancellationOnGrace).toHaveBeenCalledTimes(1);
        expect(mirrorMock.mirrorProviderCancellationOnGrace).toHaveBeenCalledWith(
            { subscriptionId, readAt },
            { clock, successionCloser: unimplementedSuccessionCloser, coverageNotices: undefined }
        );
    });

    it('passes an injected S18 through and does not throw on NOT_APPLICABLE (a race)', async () => {
        // Arrange
        mirrorMock.mirrorProviderCancellationOnGrace.mockResolvedValue({
            outcome: 'NOT_APPLICABLE',
            reason: 'NOT_IN_GRACE'
        });
        const closer: SuccessionCloser = { closeSuccession: vi.fn(async () => undefined) };
        const delegates = createProviderNoticeMirrorDelegates(ports(closer));

        // Act
        const attempt = delegates.delegate({
            pair: 'CANCELLED_ON_GRACE',
            subscriptionId,
            readAt,
            cancelledSeenAt: readAt
        });

        // Assert
        await expect(attempt).resolves.toBeUndefined();
        expect(mirrorMock.mirrorProviderCancellationOnGrace.mock.calls[0]?.[1]).toMatchObject({
            successionCloser: closer
        });
    });

    it.each(
        MIRROR_PAIR_IDS.filter((pair) => !REGISTERED.includes(pair))
    )('H-1: %s stays unregistered and throws MIRROR_PAIR_NOT_REGISTERED', async (pair) => {
        // Arrange
        const delegates = createProviderNoticeMirrorDelegates(ports());

        // Act
        const attempt = delegates.delegate({
            pair,
            subscriptionId,
            readAt,
            cancelledSeenAt: null
        });

        // Assert
        await expect(attempt).rejects.toMatchObject({ reason: 'MIRROR_PAIR_NOT_REGISTERED' });
        expect(mirrorMock.mirrorProviderCancellationOnGrace).not.toHaveBeenCalled();
    });
});
