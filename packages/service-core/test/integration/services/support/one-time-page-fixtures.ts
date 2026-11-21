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
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds
} from '@repo/db';
import { vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../../src/services/billing/addon/addon-instance-a2-one-time-page';
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
    const request = f.input();
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

/**
 * Activates a page purchase the way production does: the customer pays on its page and A2
 * reads the approved payment back by id (HOS-2179 §5.3).
 *
 * @param input.f - The purchase fixture whose fake holds the page
 * @param input.instanceId - The pending page purchase
 * @returns The activated instance and the page payment's id
 */
export async function activatePagePurchase(input: {
    readonly f: Awaited<ReturnType<typeof purchaseFixture>>;
    readonly instanceId: string;
}) {
    const pending = await pageInstance(input.instanceId);
    if (!pending.paymentPageId) throw new Error('Payment page missing');
    const charge = input.f.fake.payOnPage({
        paymentPageId: pending.paymentPageId,
        outcome: 'approved'
    });
    const confirmed = await confirmOneTimePagePayment(
        { instanceId: pending.id, chargeId: charge.chargeId },
        { ...input.f.ports, coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) } }
    );
    if (confirmed.outcome !== 'ACTIVATED') throw new Error(`A2 returned ${confirmed.outcome}`);
    return { instance: await pageInstance(pending.id), paymentId: confirmed.paymentId };
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

/**
 * The payments of the instance hung from one of its marks (D1 of HOS-2179): one per charge a
 * mark holds, with the attachment. Read through `reconciliation_mark_payment` directly, not
 * through the code under test.
 */
export async function heldPagePayments(instanceId: string) {
    return getServiceTestDb()
        .select({
            payment: payments,
            markId: reconciliationMarkPayments.markId,
            reason: reconciliationMarks.reason,
            resolvedAt: reconciliationMarkPayments.resolvedAt,
            refundId: reconciliationMarkPayments.refundId
        })
        .from(payments)
        .innerJoin(
            reconciliationMarkPayments,
            eq(reconciliationMarkPayments.paymentId, payments.id)
        )
        .innerJoin(
            reconciliationMarks,
            eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
        )
        .where(eq(payments.addonInstanceId, instanceId))
        .orderBy(payments.createdAt, payments.id);
}

/**
 * The refund a page-charge mark proposed for its held payment (HOS-2179 D1): created with the
 * mark, `MARK_PROPOSAL`, for the whole held amount. Exactly one is expected.
 */
export async function proposedRefund(paymentId: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(refunds)
        .where(and(eq(refunds.paymentId, paymentId), eq(refunds.reason, 'MARK_PROPOSAL')));
    const [row] = rows;
    if (!row || rows.length !== 1)
        throw new Error(`expected one proposed refund for ${paymentId}, found ${rows.length}`);
    return row;
}

/** The payments of the instance no mark holds: the one that activated it, if any. */
export async function activationPagePayments(instanceId: string) {
    const held = new Set((await heldPagePayments(instanceId)).map((row) => row.payment.id));
    return (await pagePayments(instanceId)).filter((payment) => !held.has(payment.id));
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
