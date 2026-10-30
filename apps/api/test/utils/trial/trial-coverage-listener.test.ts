import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listener: undefined as ((event: CoverageChangedEvent) => void | Promise<void>) | undefined,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    convert: vi.fn(),
    consume: vi.fn(),
    pseudonym: vi.fn(),
    emailRows: [] as { email: string }[],
    warn: vi.fn(),
    error: vi.fn(),
    emitTrial: vi.fn(),
    billing: { coverage: vi.fn() },
    trialPorts: { unitOfWork: { runLocked: vi.fn() }, afterCommit: { invalidateUser: vi.fn() } }
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            coverage: mocks.billing.coverage,
            onCoverageChanged: (listener: typeof mocks.listener) => {
                mocks.subscribe();
                mocks.listener = listener;
                return mocks.unsubscribe;
            }
        }
    })
}));
vi.mock('../../../src/utils/trial/trial-machine-ports', () => ({
    getTrialMachinePorts: () => mocks.trialPorts
}));
vi.mock('@repo/verticals', () => ({
    convertTrialOnTitle: mocks.convert,
    consumeTrialOnFirstPayment: mocks.consume
}));
vi.mock('@repo/service-core', () => ({ computeTrialEmailPseudonym: mocks.pseudonym }));
vi.mock('@repo/db', () => ({
    eq: vi.fn(),
    users: { id: 'users.id', email: 'users.email' },
    getDb: () => ({
        select: () => ({
            from: () => ({ where: () => ({ limit: async () => mocks.emailRows }) })
        })
    })
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: mocks.warn, error: mocks.error }
}));
vi.mock('../../../src/utils/analytics/analytics-facts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/utils/analytics/analytics-facts')>()),
    emitTrialAnalyticsFact: mocks.emitTrial
}));
vi.mock('../../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-08T20:00:00.000Z') } })
}));

import { subscribeTrialCoverageConversion } from '../../../src/utils/trial/trial-coverage-listener';

const USER_ID = '00000000-0000-4000-8000-0000000b4203';
const PSEUDONYM = 'a'.repeat(64);
const OCCURRED_AT = new Date('2026-10-08T20:00:00.000Z');

function notice(sourceType: CoverageChangedEvent['sourceType']): CoverageChangedEvent {
    return { userId: USER_ID, vertical: VerticalEnum.ACCOMMODATION, sourceType, change: 'CHANGED' };
}

function portsFor(event: CoverageChangedEvent) {
    return {
        unitOfWork: mocks.trialPorts.unitOfWork,
        afterCommit: mocks.trialPorts.afterCommit,
        billing: expect.objectContaining({ coverage: mocks.billing.coverage }),
        event
    };
}

describe('Coord-99 the trial consumer of the coverage notice (T2, T5, T8; HOS-1533)', () => {
    let stop: (() => void) | undefined;

    beforeEach(() => {
        stop?.();
        stop = undefined;
        vi.clearAllMocks();
        mocks.listener = undefined;
        mocks.emailRows = [{ email: 'owner@example.com' }];
        mocks.convert.mockResolvedValue({ converted: false, reason: 'NO_CONVERTING_TITLE' });
        mocks.consume.mockResolvedValue({ consumed: false, reason: 'NO_CONVERTING_TITLE' });
        mocks.pseudonym.mockReturnValue({ ok: true, pseudonym: PSEUDONYM });
        mocks.emitTrial.mockReset();
    });

    it('subscribes once and the returned closure unsubscribes', () => {
        // Arrange / Act
        stop = subscribeTrialCoverageConversion();
        subscribeTrialCoverageConversion();
        stop();
        stop = undefined;

        // Assert
        expect(mocks.subscribe).toHaveBeenCalledTimes(1);
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('ignores the TRIAL notices the trial machine emits itself', async () => {
        // Arrange
        stop = subscribeTrialCoverageConversion();

        // Act
        await mocks.listener?.(notice('TRIAL'));

        // Assert
        expect([
            mocks.convert.mock.calls,
            mocks.consume.mock.calls,
            mocks.pseudonym.mock.calls
        ]).toEqual([[], [], []]);
    });

    it('runs convertTrialOnTitle with the notice for a SUBSCRIPTION notice and stops there', async () => {
        // Arrange
        stop = subscribeTrialCoverageConversion();
        const event = notice('SUBSCRIPTION');
        mocks.convert.mockResolvedValue({ converted: true, transition: 'T2', notices: {} });

        // Act
        await mocks.listener?.(event);

        // Assert
        expect(mocks.convert.mock.calls).toEqual([[portsFor(event)]]);
        expect(mocks.consume).not.toHaveBeenCalled();
        expect(mocks.emitTrial.mock.calls).toEqual([
            [
                {
                    kind: 'TRIAL_CONVERTED',
                    userId: USER_ID,
                    vertical: VerticalEnum.ACCOMMODATION,
                    actorKind: 'SYSTEM',
                    trialId: `${USER_ID}:${VerticalEnum.ACCOMMODATION}`,
                    transition: 'T2',
                    trialStateBefore: 'ACTIVE',
                    occurredAt: OCCURRED_AT
                }
            ]
        ]);
    });

    it.each([
        'NO_CONVERTING_TITLE',
        'ALREADY_CONVERTED'
    ] as const)('does not emit for %s (TEST:1878:13)', async (reason) => {
        stop = subscribeTrialCoverageConversion();
        mocks.convert.mockResolvedValue({ converted: false, reason });
        await mocks.listener?.(notice('SUBSCRIPTION'));
        expect(mocks.emitTrial).not.toHaveBeenCalled();
    });

    it('does not emit when T8 reports TRIAL_ROW_EXISTS (TEST:1878:13)', async () => {
        stop = subscribeTrialCoverageConversion();
        mocks.convert.mockResolvedValue({ converted: false, reason: 'NO_TRIAL_ROW' });
        mocks.consume.mockResolvedValue({ consumed: false, reason: 'TRIAL_ROW_EXISTS' });
        await mocks.listener?.(notice('SUBSCRIPTION'));
        expect(mocks.emitTrial).not.toHaveBeenCalled();
    });

    it('reports an expired trial as T5 with EXPIRED before state (TEST:1878:13)', async () => {
        stop = subscribeTrialCoverageConversion();
        mocks.convert.mockResolvedValue({ converted: true, transition: 'T5', notices: {} });
        await mocks.listener?.(notice('SUBSCRIPTION'));
        expect(mocks.emitTrial.mock.calls).toEqual([
            [
                {
                    kind: 'TRIAL_CONVERTED',
                    userId: USER_ID,
                    vertical: VerticalEnum.ACCOMMODATION,
                    actorKind: 'SYSTEM',
                    trialId: `${USER_ID}:${VerticalEnum.ACCOMMODATION}`,
                    transition: 'T5',
                    trialStateBefore: 'EXPIRED',
                    occurredAt: OCCURRED_AT
                }
            ]
        ]);
    });

    it('with NO_TRIAL_ROW computes the owner pseudonym and runs consumeTrialOnFirstPayment (T8)', async () => {
        // Arrange
        stop = subscribeTrialCoverageConversion();
        const event = notice('SUBSCRIPTION');
        mocks.convert.mockResolvedValue({ converted: false, reason: 'NO_TRIAL_ROW' });

        // Act
        await mocks.listener?.(event);

        // Assert
        expect(mocks.pseudonym.mock.calls).toEqual([[{ email: 'owner@example.com' }]]);
        expect(mocks.consume.mock.calls).toEqual([
            [{ ...portsFor(event), emailPseudonym: PSEUDONYM }]
        ]);
        expect(mocks.emitTrial).not.toHaveBeenCalled();
        mocks.consume.mockResolvedValue({ consumed: true, transition: 'T8', notices: {} });
        await mocks.listener?.(event);
        expect(mocks.emitTrial.mock.calls).toEqual([
            [
                {
                    kind: 'TRIAL_CONVERTED',
                    userId: USER_ID,
                    vertical: VerticalEnum.ACCOMMODATION,
                    actorKind: 'SYSTEM',
                    trialId: `${USER_ID}:${VerticalEnum.ACCOMMODATION}`,
                    transition: 'T8',
                    trialStateBefore: 'NONE',
                    occurredAt: OCCURRED_AT
                }
            ]
        ]);
    });

    it('with an invalid owner email does not run T8 and logs a warning', async () => {
        // Arrange
        stop = subscribeTrialCoverageConversion();
        mocks.convert.mockResolvedValue({ converted: false, reason: 'NO_TRIAL_ROW' });
        mocks.pseudonym.mockReturnValue({ ok: false, reason: 'INVALID_EMAIL' });

        // Act
        await mocks.listener?.(notice('SUBSCRIPTION'));

        // Assert
        expect(mocks.consume).not.toHaveBeenCalled();
        expect(mocks.warn.mock.calls).toEqual([
            [
                { userId: USER_ID, vertical: VerticalEnum.ACCOMMODATION },
                'Trial first-payment consumption skipped: no valid owner email'
            ]
        ]);
    });

    it('logs a failure and resolves without throwing', async () => {
        // Arrange
        stop = subscribeTrialCoverageConversion();
        const failure = new Error('expected test failure');
        mocks.convert.mockRejectedValue(failure);

        // Act
        const outcome = mocks.listener?.(notice('SUBSCRIPTION'));

        // Assert
        await expect(outcome).resolves.toBeUndefined();
        expect(mocks.error.mock.calls).toEqual([
            [
                {
                    error: failure,
                    userId: USER_ID,
                    vertical: VerticalEnum.ACCOMMODATION,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                },
                'Trial coverage conversion failed'
            ]
        ]);
    });

    it('is subscribed by the API composition root and torn down on shutdown', () => {
        // Arrange
        const indexPath = path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../../../src/index.ts'
        );

        // Act
        const source = readFileSync(indexPath, 'utf8');

        // Assert
        expect([
            /const\s+unsubscribeTrialConversion\s*=\s*subscribeTrialCoverageConversion\(\)/.test(
                source
            ),
            /unsubscribeTrialConversion\?\.\(\)/.test(source)
        ]).toEqual([true, true]);
    });
});
