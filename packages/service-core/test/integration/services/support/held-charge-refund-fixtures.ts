/**
 * Shared arrangement for the HOS-2179 D1 suites on the refund a page-charge mark proposes: a held
 * charge for each reason, the notice receiver, the two sweep passes that read page charges, and
 * action 7. Everything runs against the fake with its lies on.
 */
import {
    eq,
    reconciliationCreditedPaymentModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    reconciliationPagePaymentModel,
    refunds
} from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { expect, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { abandonOneTimeAddon } from '../../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { receiveProviderDelivery } from '../../../../src/services/billing/notice/receive-provider-delivery.service';
import { liftReconciliationMarkByAdmin } from '../../../../src/services/billing/reconciliation/lift-reconciliation-mark-by-admin.service';
import { runCreditedPaymentsCheck } from '../../../../src/services/billing/reconciliation/sweep/credited-payments-check';
import { runReconciliationSweep } from '../../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service';
import { getServiceTestDb } from '../helpers';
import { withSeededReconciliationInventory } from '../reconciliation-sweep-fixtures';
import { purchaseNow } from './addon-purchase-fixtures';
import { boughtPage, heldPagePayments, pagePriceIs, pageSetup } from './one-time-page-fixtures';
import { orderDeadlines } from './paid-order-fixtures';
import { seedAdminActor } from './refund-fixtures';

const DAY_MS = 86_400_000;

/** The arranged page purchase. */
export type HeldChargeSetup = Awaited<ReturnType<typeof pageSetup>>;

/** The three page-charge reasons, with mark 23 named by its number. */
export const HELD_CHARGE_CASES = ['DIVERGENCIA_DE_MONTO', 'COBRO_DUPLICADO', 'MARK_23'] as const;

/** One of {@link HELD_CHARGE_CASES}. */
export type HeldChargeCase = (typeof HELD_CHARGE_CASES)[number];

/** The due primary-channel Webhooks deliveries, taken from the fake. */
export function takeDue(s: HeldChargeSetup): readonly NoticeDelivery[] {
    return s.f.fake
        .takeDeliveries()
        .deliveries.filter(
            (delivery: NoticeDelivery) =>
                delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary'
        );
}

/** Hands the given deliveries to the receiver, wired as the API wires it; returns the outcomes. */
export async function deliver(s: HeldChargeSetup, deliveries: readonly NoticeDelivery[]) {
    const outcomes: string[] = [];
    for (const delivery of deliveries) {
        const answer = await receiveProviderDelivery(
            {
                url: 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks',
                delivery
            },
            {
                provider: s.f.fake,
                clock: s.f.ports.clock,
                beforeCancelNotice: s.ports.beforeCancelNotice,
                coverageNotices: s.ports.coverageNotices,
                complements: { addonPolicy: s.f.ports.addonPolicy, listing: s.f.ports.listing }
            }
        );
        outcomes.push(answer.outcome);
    }
    return outcomes;
}

/**
 * A held charge on a fresh purchase for one reason, opened by A2. Returns the held row and the
 * notice deliveries the opening left, so a test can hand them over again.
 */
export async function heldChargeFor(reason: HeldChargeCase) {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    let chargeId = first.chargeId;
    if (reason === 'DIVERGENCIA_DE_MONTO') {
        await pagePriceIs(instance.productId, 12000);
        await confirmOneTimePagePayment({ instanceId: instance.id, chargeId }, s.ports);
    } else if (reason === 'COBRO_DUPLICADO') {
        const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await confirmOneTimePagePayment({ instanceId: instance.id, chargeId }, s.ports);
        chargeId = second.chargeId;
        await confirmOneTimePagePayment({ instanceId: instance.id, chargeId }, s.ports);
    } else {
        await abandonOneTimeAddon({
            instanceId: instance.id,
            expectedProviderOrderId: null,
            now: s.f.ports.clock.now()
        });
        await confirmOneTimePagePayment({ instanceId: instance.id, chargeId }, s.ports);
    }
    const held = await heldPagePayments(instance.id);
    expect(held).toHaveLength(1);
    const [row] = held;
    if (!row) throw new Error('held payment missing');
    const deliveries = takeDue(s);
    return { s, instance, chargeId, held: row, deliveries };
}

/** A purchase abandoned while an approved payment on its page went unnoticed (mark 23 pending). */
export async function paidWithoutLiveInstance() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    await abandonOneTimeAddon({
        instanceId: instance.id,
        expectedProviderOrderId: null,
        now: s.f.ports.clock.now()
    });
    s.f.advanceTo(new Date(purchaseNow.getTime() + DAY_MS));
    return { s, instance, paid };
}

/** Runs the sweep with only the page-payments pass, over the given purchases only. */
export async function sweepPagePayments(s: HeldChargeSetup, owned: readonly string[]) {
    const original =
        reconciliationPagePaymentModel.listSettledOneTimePagePurchasesInWindowPage.bind(
            reconciliationPagePaymentModel
        );
    const listing = vi
        .spyOn(reconciliationPagePaymentModel, 'listSettledOneTimePagePurchasesInWindowPage')
        .mockImplementation(async (page) => {
            const rows = await original({ ...page, afterInstanceId: undefined, limit: 10_000 });
            return rows
                .filter(({ instance }) => owned.includes(instance.id))
                .filter(
                    ({ instance }) =>
                        page.afterInstanceId === undefined || instance.id > page.afterInstanceId
                )
                .slice(0, page.limit);
        });
    try {
        return await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'single', correlationId: crypto.randomUUID() },
                {
                    provider: s.f.fake,
                    clock: s.f.ports.clock,
                    pagePayments: {
                        deadlines: orderDeadlines(180),
                        complements: {
                            addonPolicy: s.f.ports.addonPolicy,
                            listing: s.f.ports.listing
                        },
                        coverageNotices: s.ports.coverageNotices
                    }
                }
            )
        );
    } finally {
        listing.mockRestore();
    }
}

/** Runs the credited-payments check of the sweep over the given payments only. */
export async function sweepCreditedPayments(s: HeldChargeSetup, owned: readonly string[]) {
    const original = reconciliationCreditedPaymentModel.listCreditedPaymentsInWindowPage.bind(
        reconciliationCreditedPaymentModel
    );
    const listing = vi
        .spyOn(reconciliationCreditedPaymentModel, 'listCreditedPaymentsInWindowPage')
        .mockImplementation(async (page) =>
            (await original({ ...page, afterPaymentId: undefined, limit: 10_000 }))
                .filter((row) => owned.includes(row.id))
                .filter((row) => page.afterPaymentId === undefined || row.id > page.afterPaymentId)
                .slice(0, page.limit)
        );
    try {
        return await runCreditedPaymentsCheck(
            { correlationId: crypto.randomUUID(), pageSize: 50 },
            { provider: s.f.fake, clock: s.f.ports.clock, deadlines: orderDeadlines(180) }
        );
    } finally {
        listing.mockRestore();
    }
}

/** The mark row, read fresh. */
export async function markRow(markId: string) {
    const [mark] = await getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.id, markId));
    if (!mark) throw new Error('mark missing');
    return mark;
}

/** The single attachment of the held payment to its mark, read fresh. */
export async function heldLink(paymentId: string) {
    const [link] = await getServiceTestDb()
        .select()
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.paymentId, paymentId));
    if (!link) throw new Error('held link missing');
    return link;
}

/** Every refund of a payment, oldest first. */
export async function refundsOf(paymentId: string) {
    return getServiceTestDb()
        .select()
        .from(refunds)
        .where(eq(refunds.paymentId, paymentId))
        .orderBy(refunds.createdAt, refunds.id);
}

/** Action 7 by a person who may lift marks, resolving nothing without a refund. */
export async function liftByAdmin(s: HeldChargeSetup, markId: string) {
    const person = await seedAdminActor([PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK]);
    const mark = await markRow(markId);
    return liftReconciliationMarkByAdmin(
        { actor: person, markId, expectedVersion: mark.version, resolveWithoutRefund: [] },
        { clock: s.f.ports.clock }
    );
}
