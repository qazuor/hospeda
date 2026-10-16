import { courtesyGrants, subscriptionPauses } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { createBillingCoverage } from '../../../src/services/billing/coverage/billing-coverage';
import { resolveCourtesySources } from '../../../src/services/billing/coverage/courtesy-sources';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import type { ServiceError } from '../../../src/types';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    coverageNow,
    frozenClock,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures';

afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9a:12 real COURTESY source', () => {
    it('emits only an unexpired courtesy for an open COURTESY pause', async () => {
        await withServiceTestTransaction(async (tx) => {
            const person = await seedCoverageUser(tx);
            const signer = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
            const sub = await seedCoverageSubscription(tx, {
                ...person,
                vertical: VerticalEnum.ACCOMMODATION,
                ...plan,
                status: 'PAUSED'
            });
            const startsAt = new Date('2026-10-01T00:00:00Z');
            const endsAt = new Date('2026-11-01T00:00:00Z');
            await tx
                .insert(subscriptionPauses)
                .values({ subscriptionId: sub.subscriptionId, reason: 'COURTESY', startsAt });
            await tx.insert(courtesyGrants).values({
                beneficiaryUserId: person.userId,
                grantedBy: signer.userId,
                subscriptionId: sub.subscriptionId,
                months: 1,
                startsAt,
                endsAt,
                reason: 'fixture'
            });
            const result = await resolveCourtesySources({
                userId: person.userId,
                vertical: VerticalEnum.ACCOMMODATION,
                ports: { clock: frozenClock(coverageNow) },
                tx
            });
            expect(result.sources).toEqual([
                {
                    type: 'COURTESY',
                    reference: { kind: 'PLAN_VERSION', planVersionId: plan.planVersionId },
                    scope: 'VERTICAL',
                    target: null,
                    since: startsAt,
                    until: endsAt,
                    charged: null,
                    floor: null
                }
            ]);
            const response = await createBillingCoverage({
                tx,
                ports: {
                    clock: frozenClock(coverageNow),
                    payments: creditedPaymentsFromLedger,
                    addonPolicy: async () => {
                        throw new Error('unexpected addon');
                    },
                    listing: async () => {
                        throw new Error('unexpected listing');
                    },
                    trialAndBase: async () => ({ covered: false, sources: [] })
                }
            }).coverage({ userId: person.userId, vertical: VerticalEnum.ACCOMMODATION });
            expect(response.covered).toBe(true);
            expect(response.sources.map((source) => source.type)).toEqual(['COURTESY']);
        });
    });

    it('does not emit from empty tables, expired rows, another vertical, or deferred rows', async () => {
        await withServiceTestTransaction(async (tx) => {
            const empty = await seedCoverageUser(tx);
            const ports = { clock: frozenClock(coverageNow) };
            expect(
                (
                    await resolveCourtesySources({
                        userId: empty.userId,
                        vertical: VerticalEnum.ACCOMMODATION,
                        ports,
                        tx
                    })
                ).sources
            ).toEqual([]);

            const signer = await seedCoverageUser(tx);
            const expiredUser = await seedCoverageUser(tx);
            const expiredPlan = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
            const expiredSub = await seedCoverageSubscription(tx, {
                ...expiredUser,
                vertical: VerticalEnum.ACCOMMODATION,
                ...expiredPlan,
                status: 'PAUSED'
            });
            await tx.insert(subscriptionPauses).values({
                subscriptionId: expiredSub.subscriptionId,
                reason: 'COURTESY',
                startsAt: coverageNow
            });
            await tx.insert(courtesyGrants).values({
                beneficiaryUserId: expiredUser.userId,
                grantedBy: signer.userId,
                subscriptionId: expiredSub.subscriptionId,
                months: 1,
                startsAt: coverageNow,
                endsAt: coverageNow,
                reason: 'expired'
            });
            expect(
                (
                    await resolveCourtesySources({
                        userId: expiredUser.userId,
                        vertical: VerticalEnum.ACCOMMODATION,
                        ports,
                        tx
                    })
                ).sources
            ).toEqual([]);

            const deferredUser = await seedCoverageUser(tx);
            const deferredPlan = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
            const deferredSub = await seedCoverageSubscription(tx, {
                ...deferredUser,
                vertical: VerticalEnum.ACCOMMODATION,
                ...deferredPlan,
                status: 'CANCELLED'
            });
            await tx.insert(subscriptionPauses).values({
                subscriptionId: deferredSub.subscriptionId,
                reason: 'COURTESY',
                startsAt: coverageNow
            });
            await tx.insert(courtesyGrants).values({
                beneficiaryUserId: deferredUser.userId,
                grantedBy: signer.userId,
                subscriptionId: deferredSub.subscriptionId,
                months: 1,
                startsAt: coverageNow,
                endsAt: new Date('2026-12-01T00:00:00Z'),
                reason: 'deferred',
                balanceMonths: 2
            });
            expect(
                (
                    await resolveCourtesySources({
                        userId: deferredUser.userId,
                        vertical: VerticalEnum.ACCOMMODATION,
                        ports,
                        tx
                    })
                ).sources
            ).toEqual([]);

            const otherVertical = await seedCoverageUser(tx);
            const otherPlan = await seedCoveragePlanVersion(tx, VerticalEnum.GASTRONOMY);
            const otherSub = await seedCoverageSubscription(tx, {
                ...otherVertical,
                vertical: VerticalEnum.GASTRONOMY,
                ...otherPlan,
                status: 'PAUSED'
            });
            await tx.insert(subscriptionPauses).values({
                subscriptionId: otherSub.subscriptionId,
                reason: 'COURTESY',
                startsAt: coverageNow
            });
            await tx.insert(courtesyGrants).values({
                beneficiaryUserId: otherVertical.userId,
                grantedBy: signer.userId,
                subscriptionId: otherSub.subscriptionId,
                months: 1,
                startsAt: coverageNow,
                endsAt: new Date('2026-12-01T00:00:00Z'),
                reason: 'other vertical'
            });
            expect(
                (
                    await resolveCourtesySources({
                        userId: otherVertical.userId,
                        vertical: VerticalEnum.ACCOMMODATION,
                        ports,
                        tx
                    })
                ).sources
            ).toEqual([]);
        });
    });

    it('fails closed when a COURTESY pause has no courtesy grant row', async () => {
        await withServiceTestTransaction(async (tx) => {
            const person = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
            const sub = await seedCoverageSubscription(tx, {
                ...person,
                vertical: VerticalEnum.ACCOMMODATION,
                ...plan,
                status: 'PAUSED'
            });
            await tx.insert(subscriptionPauses).values({
                subscriptionId: sub.subscriptionId,
                reason: 'COURTESY',
                startsAt: coverageNow
            });
            await expect(
                resolveCourtesySources({
                    userId: person.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: { clock: frozenClock(coverageNow) },
                    tx
                })
            ).rejects.toMatchObject({
                reason: 'COVERAGE_COURTESY_ROW_INCONSISTENT'
            } satisfies Partial<ServiceError>);
        });
    });

    it('does not emit on CUSTOMER_REQUEST pause or a deferred courtesy', async () => {
        await withServiceTestTransaction(async (tx) => {
            const person = await seedCoverageUser(tx);
            const signer = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
            const sub = await seedCoverageSubscription(tx, {
                ...person,
                vertical: VerticalEnum.ACCOMMODATION,
                ...plan,
                status: 'PAUSED'
            });
            const startsAt = new Date('2026-10-01T00:00:00Z');
            const endsAt = new Date('2026-11-01T00:00:00Z');
            await tx.insert(subscriptionPauses).values({
                subscriptionId: sub.subscriptionId,
                reason: 'CUSTOMER_REQUEST',
                startsAt
            });
            await tx.insert(courtesyGrants).values({
                beneficiaryUserId: person.userId,
                grantedBy: signer.userId,
                subscriptionId: sub.subscriptionId,
                months: 1,
                startsAt,
                endsAt,
                reason: 'fixture'
            });
            expect(
                (
                    await resolveCourtesySources({
                        userId: person.userId,
                        vertical: VerticalEnum.ACCOMMODATION,
                        ports: { clock: frozenClock(coverageNow) },
                        tx
                    })
                ).sources
            ).toEqual([]);
        });
    });
});
