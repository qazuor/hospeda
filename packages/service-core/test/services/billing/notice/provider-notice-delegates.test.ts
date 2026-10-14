// TEST:1676:1 (unit) — the factory's exhaustive switch routes CANCELLED_ON_GRACE to the branch-5
// mirror and leaves every other pair unregistered (HOS-1676 H-1, H-5). TEST:1676:3 (unit) —
// LIVE_PREAPPROVAL_ON_CLOSED_ROW is routed to its handler and no longer throws (H-7).
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mirrorMock = vi.hoisted(() => ({
    mirrorProviderCancellationOnGrace: vi.fn()
}));
vi.mock('../../../../src/services/billing/notice/mirror-cancelled-on-grace.js', () => mirrorMock);
const liveMock = vi.hoisted(() => ({
    handleLivePreapprovalOnClosedRow: vi.fn()
}));
vi.mock(
    '../../../../src/services/billing/notice/live-preapproval-on-closed-row.js',
    () => liveMock
);
const successorMock = vi.hoisted(() => ({
    readPayingSuccessorInGrace: vi.fn()
}));
vi.mock(
    '../../../../src/services/billing/subscription/paying-predecessor-successor.js',
    () => successorMock
);
const suspendMock = vi.hoisted(() => ({
    suspendForArrears: vi.fn()
}));
vi.mock(
    '../../../../src/services/billing/subscription/suspend-for-arrears.service.js',
    () => suspendMock
);

import { createProviderNoticeMirrorDelegates } from '../../../../src/services/billing/notice/provider-notice-delegates.js';
import {
    MIRROR_PAIR_IDS,
    type MirrorPairId
} from '../../../../src/services/billing/notice/provider-notice-ports.js';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger.js';
import type { SuccessionCloser } from '../../../../src/services/billing/subscription/subscription-billing-ports.js';
import { unimplementedSuccessionCloser } from '../../../../src/services/billing/subscription/subscription-billing-ports.js';

const REGISTERED: readonly MirrorPairId[] = [
    'CANCELLED_ON_GRACE',
    'LIVE_PREAPPROVAL_ON_CLOSED_ROW'
];
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
    liveMock.handleLivePreapprovalOnClosedRow.mockReset();
    successorMock.readPayingSuccessorInGrace.mockReset();
    successorMock.readPayingSuccessorInGrace.mockResolvedValue(null);
    suspendMock.suspendForArrears.mockReset();
});

describe('createProviderNoticeMirrorDelegates (HOS-1676 H-5)', () => {
    it('AC:B7:4 routes CANCELLED_ON_GRACE on the successor of a paying predecessor in grace to S6, not the mirror', async () => {
        // Arrange
        const graceStartedAt = new Date('2026-10-05T03:00:00.000Z');
        successorMock.readPayingSuccessorInGrace.mockResolvedValue({
            id: subscriptionId,
            graceStartedAt
        });
        suspendMock.suspendForArrears.mockResolvedValue({
            outcome: 'SUSPENDED',
            subscriptionId,
            cancelCall: 'NOT_NEEDED'
        });
        const built = ports();
        const delegates = createProviderNoticeMirrorDelegates(built);

        // Act
        await delegates.delegate({
            pair: 'CANCELLED_ON_GRACE',
            subscriptionId,
            readAt,
            cancelledSeenAt: null
        });

        // Assert
        expect(successorMock.readPayingSuccessorInGrace).toHaveBeenCalledWith({
            subscriptionId,
            payments: creditedPaymentsFromLedger
        });
        expect(suspendMock.suspendForArrears).toHaveBeenCalledTimes(1);
        expect(suspendMock.suspendForArrears).toHaveBeenCalledWith(
            {
                subscriptionId,
                event: 'SUCCESSOR_PROVIDER_CANCELLED',
                occurrenceId: `${subscriptionId}:successor-provider-cancelled:2026-10-05T03:00:00.000Z`
            },
            {
                provider: built.provider,
                clock,
                beforeCancelNotice: built.beforeCancelNotice,
                coverageNotices: undefined
            }
        );
        expect(mirrorMock.mirrorProviderCancellationOnGrace).not.toHaveBeenCalled();
    });

    it('AC:B7:4 a read error of the successor check throws and neither suspends nor mirrors', async () => {
        // Arrange
        successorMock.readPayingSuccessorInGrace.mockRejectedValue(new Error('db down'));
        const delegates = createProviderNoticeMirrorDelegates(ports());

        // Act
        const attempt = delegates.delegate({
            pair: 'CANCELLED_ON_GRACE',
            subscriptionId,
            readAt,
            cancelledSeenAt: null
        });

        // Assert
        await expect(attempt).rejects.toThrow('db down');
        expect(suspendMock.suspendForArrears).not.toHaveBeenCalled();
        expect(mirrorMock.mirrorProviderCancellationOnGrace).not.toHaveBeenCalled();
    });

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
        // A row in grace that is not the successor of a paying predecessor keeps the mirror.
        expect(suspendMock.suspendForArrears).not.toHaveBeenCalled();
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

    it('TEST:1676:3 routes LIVE_PREAPPROVAL_ON_CLOSED_ROW to its handler with the pre-read column and no longer throws MIRROR_PAIR_NOT_REGISTERED', async () => {
        // Arrange
        liveMock.handleLivePreapprovalOnClosedRow.mockResolvedValue({
            outcome: 'DIVERGENCE_MARKED',
            markOutcome: 'OPENED'
        });
        const built = ports();
        const delegates = createProviderNoticeMirrorDelegates(built);
        const cancelledSeenAt = new Date('2026-10-11T12:00:00.000Z');

        // Act
        const attempt = delegates.delegate({
            pair: 'LIVE_PREAPPROVAL_ON_CLOSED_ROW',
            subscriptionId,
            readAt,
            cancelledSeenAt
        });

        // Assert
        await expect(attempt).resolves.toBeUndefined();
        expect(liveMock.handleLivePreapprovalOnClosedRow).toHaveBeenCalledTimes(1);
        expect(liveMock.handleLivePreapprovalOnClosedRow).toHaveBeenCalledWith(
            { subscriptionId, readAt, cancelledSeenAt },
            {
                provider: built.provider,
                clock,
                beforeCancelNotice: built.beforeCancelNotice
            }
        );
        expect(mirrorMock.mirrorProviderCancellationOnGrace).not.toHaveBeenCalled();
    });

    it('TEST:1676:3 propagates a handler error (the notice stays ERROR and retries)', async () => {
        // Arrange
        liveMock.handleLivePreapprovalOnClosedRow.mockRejectedValue(new Error('no deadline 16'));
        const delegates = createProviderNoticeMirrorDelegates(ports());

        // Act
        const attempt = delegates.delegate({
            pair: 'LIVE_PREAPPROVAL_ON_CLOSED_ROW',
            subscriptionId,
            readAt,
            cancelledSeenAt: null
        });

        // Assert
        await expect(attempt).rejects.toThrow('no deadline 16');
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
        expect(liveMock.handleLivePreapprovalOnClosedRow).not.toHaveBeenCalled();
    });
});
