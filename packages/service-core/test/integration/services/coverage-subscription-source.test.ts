import type { CoverageSource } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { createBillingCoverage } from '../../../src/services/billing/coverage/billing-coverage';
import { unregisteredListingQuery } from '../../../src/services/billing/coverage/coverage-ports';
import { resolveSubscriptionSources } from '../../../src/services/billing/coverage/subscription-sources';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    coverageNow,
    frozenClock,
    seedCoverageManualPayment,
    seedCoveragePayment,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures';

afterAll(closeServiceTestPool);

const ports = { clock: frozenClock(), payments: creditedPaymentsFromLedger };

async function seedOne(
    tx: DrizzleClient,
    input: {
        readonly status: string;
        readonly serviceEndsAt?: Date | null;
        readonly vertical?: string;
    }
) {
    const vertical = input.vertical ?? 'accommodation';
    const { userId } = await seedCoverageUser(tx);
    const plan = await seedCoveragePlanVersion(tx, vertical);
    const subscription = await seedCoverageSubscription(tx, {
        userId,
        vertical,
        ...plan,
        status: input.status,
        serviceEndsAt: input.serviceEndsAt
    });
    return { userId, ...plan, ...subscription };
}

function expectedSource(input: {
    readonly planVersionId: string;
    readonly createdAt: Date;
    readonly until: Date | 'NO_KNOWN_DATE';
    readonly charged: boolean;
}): CoverageSource {
    return {
        type: 'SUBSCRIPTION',
        reference: { kind: 'PLAN_VERSION', planVersionId: input.planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: input.createdAt,
        until: input.until,
        charged: input.charged,
        floor: null
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B4:1 the real SUBSCRIPTION source (AC:B4:1)',
    () => {
        it('an ACTIVE row emits one source with its eight fields, charged false without payments', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedOne(tx, { status: 'ACTIVE' });

                // Act
                const { sources } = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    expectedSource({ ...seeded, until: 'NO_KNOWN_DATE', charged: false })
                ]);
            });
        });

        it('charged is true with a SUCCEEDED provider payment, not with a FAILED one', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedOne(tx, { status: 'ACTIVE' });
                await seedCoveragePayment(tx, {
                    subscriptionId: seeded.subscriptionId,
                    status: 'FAILED'
                });
                const before = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });
                await seedCoveragePayment(tx, {
                    subscriptionId: seeded.subscriptionId,
                    status: 'SUCCEEDED'
                });

                // Act
                const after = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(before.sources).toEqual([
                    expectedSource({ ...seeded, until: 'NO_KNOWN_DATE', charged: false })
                ]);
                expect(after.sources).toEqual([
                    expectedSource({ ...seeded, until: 'NO_KNOWN_DATE', charged: true })
                ]);
            });
        });

        it('charged is true with a REGISTERED manual payment', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedOne(tx, { status: 'ACTIVE' });
                await seedCoverageManualPayment(tx, {
                    subscriptionId: seeded.subscriptionId,
                    registeredBy: seeded.userId
                });

                // Act
                const { sources } = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    expectedSource({ ...seeded, until: 'NO_KNOWN_DATE', charged: true })
                ]);
            });
        });

        it('GRACE_PERIOD emits like ACTIVE', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedOne(tx, { status: 'GRACE_PERIOD' });

                // Act
                const { sources } = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    expectedSource({ ...seeded, until: 'NO_KNOWN_DATE', charged: false })
                ]);
            });
        });

        it('CANCEL_SCHEDULED carries its end of service and stops once the clock passes it', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const serviceEndsAt = new Date('2026-10-20T00:00:00.000Z');
                const seeded = await seedOne(tx, { status: 'CANCEL_SCHEDULED', serviceEndsAt });

                // Act
                const before = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });
                const atEnd = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: { ...ports, clock: frozenClock(serviceEndsAt) },
                    tx
                });

                // Assert
                expect(before.sources).toEqual([
                    expectedSource({ ...seeded, until: serviceEndsAt, charged: false })
                ]);
                expect(atEnd.sources).toEqual([]);
            });
        });

        it.each([
            'PENDING_AUTHORIZATION',
            'PAUSED',
            'SUSPENDED',
            'CANCELLED',
            'CHARGE_DECLINED',
            'ABANDONED'
        ])('%s emits no source', async (status) => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedOne(tx, { status });

                // Act
                const { sources } = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(sources).toEqual([]);
            });
        });

        it('a COMPLEMENTO row emits no SUBSCRIPTION source', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedCoverageUser(tx);
                const plan = await seedCoveragePlanVersion(tx, 'accommodation');
                await seedCoverageSubscription(tx, {
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ...plan,
                    status: 'ACTIVE',
                    class: 'COMPLEMENTO'
                });

                // Act
                const { sources } = await resolveSubscriptionSources({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(sources).toEqual([]);
            });
        });

        it('a predecessor whose successor is ACTIVE does not emit; only the successor does', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const predecessor = await seedOne(tx, { status: 'ACTIVE' });
                const successorPlan = await seedCoveragePlanVersion(tx, 'accommodation');
                const successor = await seedCoverageSubscription(tx, {
                    userId: predecessor.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ...successorPlan,
                    status: 'ACTIVE',
                    succeedsId: predecessor.subscriptionId,
                    createdAt: new Date('2026-10-05T10:00:00.000Z')
                });

                // Act
                const { sources } = await resolveSubscriptionSources({
                    userId: predecessor.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    expectedSource({
                        planVersionId: successorPlan.planVersionId,
                        createdAt: successor.createdAt,
                        until: 'NO_KNOWN_DATE',
                        charged: false
                    })
                ]);
            });
        });

        it('a predecessor whose successor still waits for authorization keeps emitting', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const predecessor = await seedOne(tx, { status: 'ACTIVE' });
                const successorPlan = await seedCoveragePlanVersion(tx, 'accommodation');
                await seedCoverageSubscription(tx, {
                    userId: predecessor.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ...successorPlan,
                    status: 'PENDING_AUTHORIZATION',
                    succeedsId: predecessor.subscriptionId
                });

                // Act
                const { sources } = await resolveSubscriptionSources({
                    userId: predecessor.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });

                // Assert
                expect(sources).toEqual([
                    expectedSource({ ...predecessor, until: 'NO_KNOWN_DATE', charged: false })
                ]);
            });
        });

        it('another vertical of the same user does not leak in', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedOne(tx, {
                    status: 'ACTIVE',
                    vertical: VerticalEnum.GASTRONOMY
                });

                // Act
                const accommodation = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports,
                    tx
                });
                const gastronomy = await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.GASTRONOMY,
                    ports,
                    tx
                });

                // Assert
                expect(accommodation.sources).toEqual([]);
                expect(gastronomy.sources).toEqual([
                    expectedSource({ ...seeded, until: 'NO_KNOWN_DATE', charged: false })
                ]);
            });
        });

        it('coverage() over the real source is covered, and no emitted source carries a floor', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedOne(tx, { status: 'ACTIVE' });
                const base: CoverageSource = {
                    type: 'BASE',
                    reference: { kind: 'PLAN_VERSION', planVersionId: 'floor-version' },
                    scope: 'VERTICAL',
                    target: null,
                    since: coverageNow,
                    until: 'NEVER_EXPIRES',
                    charged: null,
                    floor: null
                };
                const coverage = createBillingCoverage({
                    ports: {
                        ...ports,
                        addonPolicy: async () => {
                            throw new Error('no addon instance is seeded');
                        },
                        listing: unregisteredListingQuery.listing,
                        trialAndBase: async () => ({ covered: false, sources: [base] })
                    },
                    tx
                });

                // Act
                const response = await coverage.coverage({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION
                });

                // Assert
                expect(response).toEqual({
                    covered: true,
                    sources: [
                        base,
                        expectedSource({ ...seeded, until: 'NO_KNOWN_DATE', charged: false })
                    ]
                });
                expect(response.sources.filter((source) => source.floor !== null)).toEqual([]);
            });
        });
    }
);
