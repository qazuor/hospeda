/**
 * Fixtures for one-time page purchases (HOS-2179): a paying owner, a page purchase bought
 * through A1, and readers of what A2, the notice receiver and the sweep left on the instance.
 * The fake provider lies by default; only the M1 lie of `purchaseFixture` is switched off.
 */
import {
    addonInstances,
    addonProducts,
    and,
    domainEvent,
    eq,
    isNull,
    payments,
    reconciliationMarks
} from '@repo/db';
import { vi } from 'vitest';
import { purchaseAddon } from '../../../../src/services/billing/addon/purchase-addon.service';
import { getServiceTestDb, getServiceTestPool } from '../helpers';
import { payingPrincipal } from './addon-a2-fixtures';
import { purchaseFixture } from './addon-purchase-fixtures';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice';

/** Every page purchase bought in the running file, so its marks can be lifted afterwards. */
const boughtInstances: { readonly id: string; readonly ownerId: string }[] = [];

/** A paying owner with a one-time product, ready to buy through a payment page. */
export async function pageSetup() {
    const f = await purchaseFixture();
    await payingPrincipal(f);
    const request = { ...f.input(), oneTimeChannel: 'PAGE' as const };
    const ports = {
        ...f.ports,
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
        coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) }
    };
    return { f, request, ports };
}

/** Buys the page purchase and returns its instance and page. */
export async function boughtPage(s: Awaited<ReturnType<typeof pageSetup>>) {
    const result = await purchaseAddon(s.request, s.f.ports);
    if (result.outcome !== 'CREATED') throw new Error(`Purchase returned ${result.outcome}`);
    const instance = await pageInstance(result.instanceId);
    if (!instance.paymentPageId) throw new Error('Payment page missing');
    boughtInstances.push({ id: instance.id, ownerId: instance.ownerId });
    // The principal's own notices are not this purchase's: a test sees only what it pays.
    s.f.fake.takeDeliveries();
    return { instance, paymentPageId: instance.paymentPageId };
}

/** The instance as stored. */
export async function pageInstance(instanceId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    if (!row) throw new Error('Instance missing');
    return row;
}

/** The payments hung from the instance. */
export async function pagePayments(instanceId: string) {
    return getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.addonInstanceId, instanceId));
}

/** Every mark of the instance, open or lifted, oldest first. */
export async function pageMarks(instanceId: string) {
    return getServiceTestDb()
        .select({ reason: reconciliationMarks.reason, liftedAt: reconciliationMarks.liftedAt })
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.addonInstanceId, instanceId))
        .orderBy(reconciliationMarks.placedAt);
}

/** The `reconciliation.mark_opened` events of the instance, oldest first. */
export async function pageMarkEvents(instanceId: string) {
    const rows = await getServiceTestDb()
        .select({ changes: domainEvent.changes, actorType: domainEvent.actorType })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityId, instanceId),
                eq(domainEvent.eventType, 'reconciliation.mark_opened')
            )
        )
        .orderBy(domainEvent.occurredAt, domainEvent.id);
    return rows.map((row) => ({
        actorType: row.actorType,
        changes: row.changes as readonly { readonly field: string; readonly new?: unknown }[]
    }));
}

/** The value one event change carries. */
export function changeOf(
    event: { readonly changes: readonly { readonly field: string; readonly new?: unknown }[] },
    field: string
): unknown {
    return event.changes.find((change) => change.field === field)?.new;
}

/** Sets the product's price, so a page payment of the old price reads as another amount. */
export async function pagePriceIs(productId: string, price: number) {
    await getServiceTestDb()
        .update(addonProducts)
        .set({ price })
        .where(eq(addonProducts.id, productId));
}

/** Lifts every open mark of the instance, as a person settling it would. */
export async function liftPageMarks(instanceId: string, liftedBy: string) {
    await getServiceTestDb()
        .update(reconciliationMarks)
        .set({ liftedAt: new Date(), liftedBy })
        .where(
            and(
                eq(reconciliationMarks.addonInstanceId, instanceId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
}

/**
 * Lifts the marks this file's page purchases left open. The integration files share one
 * database, and other files page through every open mark (listActionableReconciliationMarks),
 * so open marks left here would push theirs off the page.
 */
export async function retirePageMarks() {
    for (const bought of boughtInstances.splice(0)) await liftPageMarks(bought.id, bought.ownerId);
}

/** Makes every mark insert for this one instance fail while `run` runs; other files are untouched. */
export async function refusePageMarks(instanceId: string, run: () => Promise<void>) {
    const pool = getServiceTestPool();
    const name = `refuse_page_marks_${instanceId.replaceAll('-', '')}`;
    await pool.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.addon_instance_id = '${instanceId}' THEN RAISE EXCEPTION 'mark refused by test'; END IF; RETURN NEW; END $$`
    );
    await pool.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON reconciliation_mark FOR EACH ROW EXECUTE FUNCTION ${name}()`
    );
    try {
        await run();
    } finally {
        await pool.query(`DROP TRIGGER ${name} ON reconciliation_mark`);
        await pool.query(`DROP FUNCTION ${name}()`);
    }
}
