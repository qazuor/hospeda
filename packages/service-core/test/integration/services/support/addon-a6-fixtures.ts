import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import {
    addonInstances,
    emailOutbox,
    emailOutboxModel,
    eq,
    inArray,
    providerLinks,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { VerticalEnum } from '@repo/schemas';
import { vi } from 'vitest';
import { applyA2Recurring } from '../../../../src/services/billing/addon/addon-instance-a2';
import type { CancelPurgedListingAddonPorts } from '../../../../src/services/billing/addon/addon-instance-a6';
import { purchaseAddon } from '../../../../src/services/billing/addon/purchase-addon.service';
import { sendOneTimeOrder } from '../../../../src/services/billing/addon/send-one-time-order.service';
import { getServiceTestDb } from '../helpers';
import { payingPrincipal } from './addon-a2-fixtures';
import { purchaseFixture } from './addon-purchase-fixtures';

const created: Array<{ ownerId: string; complementId: string | null }> = [];

/** Remove only mail and marks belonging to these A6 fixtures. */
export async function retireA6Fixtures(): Promise<void> {
    const db = getServiceTestDb();
    for (const { ownerId, complementId } of created.splice(0)) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ownerId));
        if (complementId) {
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
    }
}

/** Real purchase and principal; the catalog and listing remain programmed test fixtures. */
export async function createA6Fixture(input: {
    readonly status: 'ACTIVE' | 'PENDING_AUTHORIZATION';
    readonly chargeKind?: 'PERIODICO' | 'UNA_VEZ';
}) {
    const f = await purchaseFixture({
        scopeType: 'LISTING',
        chargeKind: input.chargeKind ?? 'PERIODICO'
    });
    await payingPrincipal(f);
    const listingId = crypto.randomUUID();
    const listing = {
        vertical: 'accommodation' as VerticalEnum,
        ownerId: f.ownerId,
        acceptsFeature: true
    };
    f.setListing(listingId, listing);
    const verticals = new VerticalsForBillingSimulator({ clock: f.ports.clock });
    verticals.setListing({ listingId, listing });
    const orderRequestId = crypto.randomUUID();
    const bought = await purchaseAddon(f.input(orderRequestId, listingId), f.ports);
    if (bought.outcome !== 'CREATED') throw new Error(`Addon purchase returned ${bought.outcome}`);
    if (input.chargeKind === 'UNA_VEZ') {
        const sent = await sendOneTimeOrder(
            {
                orderRequestId,
                payerEmail: 'payer@example.test',
                payment: { token: `a6-${crypto.randomUUID()}`, brand: 'visa', kind: 'credit' }
            },
            { provider: f.fake, clock: f.ports.clock }
        );
        if (sent.outcome !== 'ORDER_PLACED') throw new Error(`Order send returned ${sent.outcome}`);
    }
    const [instance] = await getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, bought.instanceId));
    if (!instance) throw new Error('Purchased addon missing');
    const complementId = instance.complementSubscriptionId;
    created.push({ ownerId: f.ownerId, complementId });
    const [link] = complementId
        ? await getServiceTestDb()
              .select()
              .from(providerLinks)
              .where(eq(providerLinks.subscriptionId, complementId))
        : [];
    if (input.status === 'ACTIVE') {
        if (!complementId || !link) throw new Error('ACTIVE fixture needs a complement');
        await f.fake.approve({ authorizationId: link.providerId });
        const activated = await getServiceTestDb().transaction((tx) =>
            applyA2Recurring(
                { tx, complementSubscriptionId: complementId, now: f.ports.clock.now() },
                f.ports
            )
        );
        if (activated.outcome !== 'ACTIVATED') throw new Error('A2 did not activate addon');
    }
    const notices: string[] = [];
    const coverage = vi.fn(async (event: { change: string }) => {
        notices.push(event.change);
    });
    const beforeCancel = vi.fn(
        async ({
            subscriptionId,
            userId,
            kind
        }: {
            subscriptionId: string;
            userId: string;
            kind: string;
        }) => {
            await emailOutboxModel.enqueue({
                recipientUserId: userId,
                recipientEmail: 'payer@example.test',
                template: 'billing.addon-listing-purged-cancel',
                payload: { subscriptionId },
                dedupKey: `a6:${subscriptionId}:${kind}`
            });
            return 'SENT' as const;
        }
    );
    const ports: CancelPurgedListingAddonPorts = {
        provider: f.fake,
        clock: f.ports.clock,
        listing: verticals.listing.bind(verticals),
        listingPurged: verticals.listingPurged.bind(verticals),
        coverageNotices: { emitCoverageChanged: coverage },
        beforeCancelNotice: { beforeCancel }
    };
    return {
        f,
        ports,
        verticals,
        listingId,
        instanceId: instance.id,
        complementId,
        authorizationId: link?.providerId ?? null,
        beforeCancel,
        coverage,
        notices,
        readInstance: async () => {
            const [row] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, instance.id));
            return row;
        },
        readComplement: async () => {
            if (!complementId) return null;
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, complementId));
            return row ?? null;
        }
    };
}
