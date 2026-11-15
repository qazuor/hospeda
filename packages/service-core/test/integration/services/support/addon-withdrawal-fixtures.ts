import {
    addonInstances,
    type DrizzleClient,
    emailOutbox,
    eq,
    inArray,
    providerLinks,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { vi } from 'vitest';
import { purchaseAddon } from '../../../../src/services/billing/addon/purchase-addon.service';
import type { WithdrawAddonPorts } from '../../../../src/services/billing/addon/withdraw-addon.service';
import { processProviderNotice } from '../../../../src/services/billing/notice/process-provider-notice.service';
import { getServiceTestDb } from '../helpers';
import { payingPrincipal } from './addon-a2-fixtures';
import { seedComplementCharge } from './addon-orphan-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './addon-purchase-fixtures';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice';

const owners: string[] = [];
const complementIds: string[] = [];

/** Builds the principal and addon through their real services; only catalog rows are seeded. */
export async function withdrawalFixture(
    input: {
        readonly chargeKind?: 'PERIODICO' | 'UNA_VEZ';
        readonly state?: 'ACTIVE' | 'PENDING_AUTHORIZATION';
        readonly deliver?: boolean;
        readonly withCharge?: boolean;
    } = {}
) {
    const f = await purchaseFixture({
        scopeType: 'USER',
        chargeKind: input.chargeKind ?? 'PERIODICO'
    });
    owners.push(f.ownerId);
    const principal = await payingPrincipal(f);
    const bought = await purchaseAddon(f.input(), f.ports);
    if (bought.outcome !== 'CREATED') throw new Error(`Purchase returned ${bought.outcome}`);
    const db = getServiceTestDb();
    const [initial] = await db
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, bought.instanceId));
    if (!initial) throw new Error('Addon instance missing');
    const complementId = initial.complementSubscriptionId;
    if (complementId) complementIds.push(complementId);
    const [link] = complementId
        ? await db
              .select()
              .from(providerLinks)
              .where(eq(providerLinks.subscriptionId, complementId))
        : [];
    if (input.state !== 'PENDING_AUTHORIZATION' && link) {
        await f.fake.approve({ authorizationId: link.providerId });
        const notice = encodeFakeNotice({
            notice: { resourceKind: 'authorization', resourceId: link.providerId, version: '1' },
            format: 'json'
        });
        const result = await processProviderNotice(
            {
                channel: 'WEBHOOKS',
                delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
            },
            {
                provider: f.fake,
                clock: f.ports.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                complements: f.ports,
                coverageNotices: { emitCoverageChanged: async () => {} }
            }
        );
        if (result.outcome !== 'APPLIED') throw new Error(`A2 returned ${result.outcome}`);
    }
    // The fake has no charge operation: seed the credited complement ledger fact for S21.
    if (input.withCharge && complementId)
        await db.transaction((tx) =>
            seedComplementCharge(tx as DrizzleClient, {
                subscriptionId: complementId,
                factAt: new Date(f.ports.clock.now().getTime() - 86_400_000)
            })
        );
    const realCancel = f.fake.cancel.bind(f.fake);
    const cancel = vi.spyOn(f.fake, 'cancel');
    const coverage = vi.fn(async () => {});
    const notice = outboxBeforeCancelNotice({ deliver: input.deliver ?? true });
    const ports: WithdrawAddonPorts = {
        orphanhood: f.ports,
        coverageNotices: { emitCoverageChanged: coverage },
        provider: f.fake,
        clock: f.ports.clock,
        beforeCancelNotice: notice
    };
    return {
        f,
        principal,
        instanceId: bought.instanceId,
        complementId,
        authorizationId: link?.providerId ?? null,
        cancel,
        realCancel,
        coverage,
        ports,
        actor: { id: f.ownerId, roles: [], permissions: [] },
        readInstance: async () =>
            (
                await db
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.id, bought.instanceId))
            )[0],
        readComplement: async () =>
            complementId
                ? (
                      await db
                          .select()
                          .from(subscriptions)
                          .where(eq(subscriptions.id, complementId))
                  )[0]
                : undefined
    };
}

/** Removes only outbox rows created for these fixture owners, then retires their live rows. */
export async function retireWithdrawalFixtures(): Promise<void> {
    const db = getServiceTestDb();
    for (const complementId of complementIds.splice(0)) {
        const marks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, complementId));
        if (marks.length)
            await db.delete(reconciliationMarkPayments).where(
                inArray(
                    reconciliationMarkPayments.markId,
                    marks.map(({ id }) => id)
                )
            );
        await db
            .delete(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, complementId));
    }
    for (const ownerId of owners.splice(0))
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
    await retirePurchaseFixtures();
    vi.restoreAllMocks();
}
