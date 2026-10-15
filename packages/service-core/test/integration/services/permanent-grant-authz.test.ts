import { eq, permanentGrants, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { retirePermanentGrantRows, seedGrantPlan } from './support/permanent-grant-fixtures.js';

const userIds: string[] = [];
const now = new Date('2026-10-14T12:00:00.000Z');
afterAll(closeServiceTestPool);
afterEach(async () => retirePermanentGrantRows(userIds.splice(0)));

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:9 — the permanent grant acts authorize ACC_2 inside the service (AC:B9a:9)',
    () => {
        it('a — an actor with the neighbour permissions but not ACC_2 is FORBIDDEN and nothing is written', async () => {
            const seeded = await getServiceTestDb().transaction(async (tx) => {
                const { userId: beneficiaryUserId } = await seedCoverageUser(tx);
                const { userId: actorId } = await seedCoverageUser(tx);
                const coveragePlan = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
                const subscription = await seedCoverageSubscription(tx, {
                    userId: beneficiaryUserId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ...coveragePlan,
                    status: 'ACTIVE'
                });
                const grantPlan = await seedGrantPlan(tx, VerticalEnum.ACCOMMODATION);
                return {
                    beneficiaryUserId,
                    actorId,
                    subscriptionId: subscription.subscriptionId,
                    grantPlan
                };
            });
            userIds.push(seeded.beneficiaryUserId, seeded.actorId);
            const provider = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: { now: () => now }
            });
            const providerCancel = vi.spyOn(provider, 'cancel');
            const emitCoverageChanged = vi.fn(async () => undefined);
            const ports = {
                clock: { now: () => now },
                provider,
                beforeCancelNotice: { beforeCancel: vi.fn(async () => 'SENT' as const) },
                coverageNotices: { emitCoverageChanged },
                orphanhood: {
                    addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                    listing: async () => {
                        throw new Error('no listing addon seeded');
                    }
                }
            };

            await expect(
                grantPermanentGrant(
                    {
                        beneficiaryUserId: seeded.beneficiaryUserId,
                        actor: {
                            id: seeded.actorId,
                            roles: [RoleEnum.ADMIN],
                            permissions: [
                                PermissionEnum.BILLING_SETTLE_EXTERNAL,
                                PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
                                PermissionEnum.USER_UPDATE_ROLES,
                                PermissionEnum.PARTNER_MANAGE
                            ]
                        },
                        reason: 'forbidden authorization test',
                        includesAddons: false,
                        anchors: [{ vertical: VerticalEnum.ACCOMMODATION, ...seeded.grantPlan }]
                    },
                    ports
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });

            const grants = await getServiceTestDb()
                .select({ id: permanentGrants.id })
                .from(permanentGrants)
                .where(eq(permanentGrants.beneficiaryUserId, seeded.beneficiaryUserId));
            const [subscription] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(grants).toHaveLength(0);
            expect(subscription?.status).toBe('ACTIVE');
            expect(emitCoverageChanged).not.toHaveBeenCalled();
            expect(providerCancel).not.toHaveBeenCalled();
            expect(ports.beforeCancelNotice.beforeCancel).not.toHaveBeenCalled();
        });
    }
);
