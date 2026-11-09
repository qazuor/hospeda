import {
    addonInstances,
    domainEventModel,
    emailOutbox,
    eq,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { withdrawAddon } from '../../../src/services/billing/addon/withdraw-addon.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retireWithdrawalFixtures, withdrawalFixture } from './support/addon-withdrawal-fixtures';

afterEach(retireWithdrawalFixtures);
afterAll(closeServiceTestPool);

async function eventsFor(instanceId: string) {
    return (
        await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: instanceId
        })
    ).filter(
        (event) =>
            event.eventType === 'addon_instance.status_changed' && event.entityId === instanceId
    );
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B13b:1 AC:B13b:1 the offered withdrawal cancels the feature (A5 first clause)',
    () => {
        it('ACTIVE owner withdrawal cancels the feature, complement and only its preapproval after commit and delivered mail', async () => {
            const s = await withdrawalFixture({ withCharge: true });
            if (!s.complementId || !s.authorizationId) throw new Error('Complement missing');
            const before = await s.readInstance();
            const principalBefore = (
                await s.f.fake.readAuthorization({ authorizationId: s.principal.authorizationId })
            ).snapshot;
            expect(before?.status).toBe('ACTIVE');
            let committedAtCall = false;
            let mailSentAtCall = false;
            s.cancel.mockImplementation(async (args) => {
                const [instance] = await getServiceTestDb()
                    .select({ status: addonInstances.status })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, s.instanceId));
                const [complement] = await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, s.complementId!));
                committedAtCall =
                    instance?.status === 'CANCELLED' && complement?.status === 'CANCELLED';
                const outbox = await getServiceTestDb()
                    .select({ template: emailOutbox.template, status: emailOutbox.status })
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, s.f.ownerId));
                mailSentAtCall = outbox.some(
                    ({ template, status }) =>
                        template === 'billing.addon-cancelled' && status === 'sent'
                );
                return s.realCancel(args);
            });

            const result = await withdrawAddon(
                { actor: s.actor, instanceId: s.instanceId },
                s.ports
            );

            expect(result).toEqual({
                instanceId: s.instanceId,
                status: 'CANCELLED',
                providerCall: 'SENT'
            });
            expect(committedAtCall).toBe(true);
            expect(mailSentAtCall).toBe(true);
            expect(await s.readInstance()).toMatchObject({
                id: s.instanceId,
                ownerId: s.f.ownerId,
                productId: s.f.productId,
                addonVersionId: s.f.versionId,
                complementSubscriptionId: s.complementId,
                status: 'CANCELLED',
                updatedAt: expect.any(Date)
            });
            expect(await s.readComplement()).toMatchObject({
                id: s.complementId,
                userId: s.f.ownerId,
                class: 'COMPLEMENTO',
                status: 'CANCELLED',
                updatedAt: expect.any(Date)
            });
            const events = await eventsFor(s.instanceId);
            expect(events).toHaveLength(3);
            expect(
                events.find(
                    ({ changes }) =>
                        Array.isArray(changes) &&
                        changes.some((change) => change.new === 'CANCELLED')
                )?.changes
            ).toEqual([{ field: 'status', old: 'ACTIVE', new: 'CANCELLED' }]);
            const mail = await getServiceTestDb()
                .select({ template: emailOutbox.template, status: emailOutbox.status })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, s.f.ownerId));
            expect(mail.filter(({ template }) => template === 'billing.addon-cancelled')).toEqual([
                { template: 'billing.addon-cancelled', status: 'sent' }
            ]);
            expect(s.cancel.mock.calls.map(([call]) => call.authorizationId)).toEqual([
                s.authorizationId
            ]);
            expect(
                (await s.f.fake.readAuthorization({ authorizationId: s.authorizationId })).snapshot
                    .status
            ).toBe('cancelled');
            expect(
                (await s.f.fake.readAuthorization({ authorizationId: s.principal.authorizationId }))
                    .snapshot
            ).toEqual(principalBefore);
            expect(
                await getServiceTestDb()
                    .select({ reason: reconciliationMarks.reason })
                    .from(reconciliationMarks)
                    .where(eq(reconciliationMarks.subscriptionId, s.complementId))
            ).toEqual([{ reason: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA' }]);
        });

        it('pending mail leaves a cancelled local feature and sends zero provider calls', async () => {
            const s = await withdrawalFixture({ deliver: false });
            const result = await withdrawAddon(
                { actor: s.actor, instanceId: s.instanceId },
                s.ports
            );
            expect(result).toEqual({
                instanceId: s.instanceId,
                status: 'CANCELLED',
                providerCall: 'NOTICE_PENDING'
            });
            expect((await s.readInstance())?.status).toBe('CANCELLED');
            expect((await s.readComplement())?.status).toBe('CANCELLED');
            expect(s.cancel.mock.calls).toHaveLength(0);
        });

        it('another owner gets NOT_FOUND, with zero writes and zero provider calls', async () => {
            const s = await withdrawalFixture();
            const eventsBefore = await eventsFor(s.instanceId);
            const before = await s.readInstance();
            await expect(
                withdrawAddon(
                    { actor: { ...s.actor, id: crypto.randomUUID() }, instanceId: s.instanceId },
                    s.ports
                )
            ).rejects.toMatchObject({ reason: 'NOT_FOUND' });
            expect(await s.readInstance()).toEqual(before);
            expect(await eventsFor(s.instanceId)).toHaveLength(eventsBefore.length);
            expect(s.cancel.mock.calls).toHaveLength(0);
        });

        it('a one-time addon returns ADDON_NOT_WITHDRAWABLE', async () => {
            const s = await withdrawalFixture({
                chargeKind: 'UNA_VEZ',
                state: 'PENDING_AUTHORIZATION'
            });
            await expect(
                withdrawAddon({ actor: s.actor, instanceId: s.instanceId }, s.ports)
            ).rejects.toMatchObject({ reason: 'ADDON_NOT_WITHDRAWABLE' });
            expect((await s.readInstance())?.status).toBe('PENDING_AUTHORIZATION');
            expect(s.cancel.mock.calls).toHaveLength(0);
        });

        it('an already cancelled addon returns ADDON_NOT_WITHDRAWABLE with zero calls', async () => {
            const s = await withdrawalFixture();
            await withdrawAddon({ actor: s.actor, instanceId: s.instanceId }, s.ports);
            const callsBefore = s.cancel.mock.calls.length;
            const eventsBefore = await eventsFor(s.instanceId);
            await expect(
                withdrawAddon({ actor: s.actor, instanceId: s.instanceId }, s.ports)
            ).rejects.toMatchObject({ reason: 'ADDON_NOT_WITHDRAWABLE' });
            expect(s.cancel.mock.calls).toHaveLength(callsBefore);
            expect(await eventsFor(s.instanceId)).toHaveLength(eventsBefore.length);
        });

        it('PENDING_AUTHORIZATION withdrawal cancels its waiting preapproval once', async () => {
            const s = await withdrawalFixture({ state: 'PENDING_AUTHORIZATION' });
            if (!s.authorizationId) throw new Error('Authorization missing');
            expect((await s.readInstance())?.status).toBe('PENDING_AUTHORIZATION');
            const result = await withdrawAddon(
                { actor: s.actor, instanceId: s.instanceId },
                s.ports
            );
            expect(result.providerCall).toBe('SENT');
            expect((await s.readInstance())?.status).toBe('CANCELLED');
            expect((await s.readComplement())?.status).toBe('CANCELLED');
            expect(s.cancel.mock.calls.map(([call]) => call.authorizationId)).toEqual([
                s.authorizationId
            ]);
            expect(
                (await s.f.fake.readAuthorization({ authorizationId: s.authorizationId })).snapshot
                    .status
            ).toBe('cancelled');
        });
    }
);
