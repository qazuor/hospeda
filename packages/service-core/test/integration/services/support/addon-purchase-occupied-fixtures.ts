import {
    addonInstances,
    and,
    domainEvent,
    eq,
    providerLinks,
    type SelectAddonInstance,
    subscriptions
} from '@repo/db';
import { purchaseAddon } from '../../../../src/services/billing/addon/purchase-addon.service';
import { getServiceTestDb } from '../helpers';
import {
    principalFixture,
    type purchaseFixture,
    purchaseFixtureInstances
} from './addon-purchase-fixtures';

/** A purchase fixture, as `purchaseFixture` returns it. */
export type OccupiedPurchaseFixture = Awaited<ReturnType<typeof purchaseFixture>>;

/**
 * Buys the recurring add-on once and returns the pending occupant and its preapproval (HOS-2668).
 *
 * @param f - The purchase fixture
 * @returns The occupant instance, its COMPLEMENTO, its preapproval and its checkout
 */
export async function pendingOccupant(f: OccupiedPurchaseFixture) {
    await principalFixture({ ownerId: f.ownerId, credited: true });
    const first = await purchaseAddon(f.input(), f.ports);
    if (first.outcome !== 'CREATED' || !first.checkoutUrl)
        throw new Error('Expected a created recurring purchase with a checkout');
    const [instance] = await purchaseFixtureInstances(f.ownerId);
    const complementId = instance?.complementSubscriptionId;
    if (!instance || !complementId) throw new Error('Occupant complement missing');
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, complementId));
    if (!link) throw new Error('Occupant preapproval missing');
    return {
        instance,
        complementId,
        authorizationId: link.providerId,
        checkoutUrl: first.checkoutUrl
    };
}

/**
 * The status of an occupant's instance and COMPLEMENTO.
 *
 * @param input.instance - The occupant instance
 * @returns Both statuses
 */
export async function statusOf(input: { readonly instance: SelectAddonInstance }) {
    const db = getServiceTestDb();
    const [instance] = await db
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.id, input.instance.id));
    const [complement] = await db
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.instance.complementSubscriptionId ?? ''));
    return { instance: instance?.status, complement: complement?.status };
}

/**
 * The recorded provider cancellation decisions of a COMPLEMENTO.
 *
 * @param complementId - The COMPLEMENTO
 * @returns Their reasons and actor types
 */
export async function cancellationDecisions(complementId: string) {
    return getServiceTestDb()
        .select({ reason: domainEvent.reason, actorType: domainEvent.actorType })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityId, complementId),
                eq(domainEvent.eventType, 'subscription.provider_cancellation_decided')
            )
        );
}

/**
 * The `addon_instance.status_changed` events that moved an instance to `ABANDONED`.
 *
 * @param instanceId - The instance
 * @returns Their actor types and changes
 */
export async function abandonEvents(instanceId: string) {
    const events = await getServiceTestDb()
        .select({ actorType: domainEvent.actorType, changes: domainEvent.changes })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityId, instanceId),
                eq(domainEvent.eventType, 'addon_instance.status_changed')
            )
        );
    return events.filter((event) => JSON.stringify(event.changes).includes('"new":"ABANDONED"'));
}
