import {
    addonInstances,
    and,
    eq,
    getDb,
    idempotencyKeys,
    type SelectAddonInstance
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import type { ConfirmOneTimePagePaymentPorts } from './addon-instance-a2-one-time-page';
import { confirmOneTimePageByReference } from './confirm-one-time-page-by-reference';
import { abandonOneTimeAddon } from './expire-addon-authorization-windows-one-time';
import { PAYMENT_PAGE_OPERATION } from './one-time-payment-page';
import {
    type BillingDeadlinesRow,
    type PaymentPageTiming,
    paymentPageExpiry,
    paymentPageTiming
} from './one-time-payment-page-deadline';

/**
 * What to do with a pending one-time page purchase that occupies the identity (owner, product,
 * target) a new purchase request asks for (HOS-2179 T-6 review):
 *
 * - `NOT_A_PAGE`: the occupant has no page creation key (a card order still waiting, until T-7
 *   removes that path). The caller keeps answering it as pending elsewhere.
 * - `RESUME`: its page still takes payments. The caller answers that page's link, resuming its
 *   creation with the stored body if the answer was lost, so the owner can pay it.
 * - `RETRY`: its page stopped taking payments and no approved payment was found (the search saw
 *   none, or every one it saw was not approved), so it was released (`ABANDONED`); the caller
 *   retries the purchase once with the new request.
 * - `ACTIVATED`: its page stopped taking payments and an approved payment was found and
 *   confirmed while answering, so the addon is active now.
 */
export type OccupiedPagePurchaseDecision = 'NOT_A_PAGE' | 'RESUME' | 'RETRY' | 'ACTIVATED';

/**
 * When the occupant's page stops taking payments: the expiry the provider read back, or, when
 * the creation answer was lost, the expiry the resume would send (createdAt plus the page
 * duration of PLAZO:21).
 */
function pageEnd(input: {
    readonly occupant: SelectAddonInstance;
    readonly timing: PaymentPageTiming;
}): Date {
    return (
        input.occupant.paymentPageExpiresAt ??
        paymentPageExpiry({ createdAt: input.occupant.createdAt, timing: input.timing })
    );
}

/**
 * Decides what a new request does with the same owner's pending page purchase that holds its
 * identity, so the owner who came back from the page without paying gets a link to pay, never
 * a "confirming" screen for a payment that does not exist.
 *
 * A page that stopped taking payments is not reopened: its key and page id are one per instance
 * (§5.6), and a second page for the same reference would let two collections race. It is
 * decided now: payments are searched by reference and each id is re-read by id (A2). An
 * approved one activates it. Otherwise it is abandoned at once, without waiting for A3's margin:
 * the page takes only binary-mode, instant payments, so a payment seen and not approved is a
 * final decline, and waiting would keep the owner of a declined card on a screen that cannot
 * end. A payment the search did not show (M4) or whose notice is late (M6) lands after the
 * release and follows the late-payment path (mark 23, a held row, a proposed refund).
 *
 * @param input.occupant - The pending instance holding the identity; the caller already scoped
 *   it to the requesting owner
 * @param input.deadlines - The deadline version in force (PLAZO:21)
 * @param ports - A2's ports
 * @returns The decision
 * @throws PaymentProviderError (transient `UNAVAILABLE`) when the search or a read did not
 *   answer: nothing is decided, and the owner retries later
 */
export async function decideOccupiedPagePurchase(
    input: { readonly occupant: SelectAddonInstance; readonly deadlines: BillingDeadlinesRow },
    ports: ConfirmOneTimePagePaymentPorts
): Promise<OccupiedPagePurchaseDecision> {
    const [key] = await getDb()
        .select({ key: idempotencyKeys.key })
        .from(idempotencyKeys)
        .where(
            and(
                eq(idempotencyKeys.subjectId, input.occupant.id),
                eq(idempotencyKeys.operation, PAYMENT_PAGE_OPERATION)
            )
        )
        .limit(1);
    if (!key) return 'NOT_A_PAGE';
    const now = ports.clock.now();
    const timing = paymentPageTiming(input.deadlines);
    const end = pageEnd({ occupant: input.occupant, timing });
    if (end.getTime() > now.getTime()) return 'RESUME';
    const found = await confirmOneTimePageByReference({ instanceId: input.occupant.id }, ports);
    if (found === 'ACTIVATED') return 'ACTIVATED';
    if (found === 'NONE_FOUND' || found === 'NONE_APPROVED') {
        await abandonOneTimeAddon(
            { instanceId: input.occupant.id, expectedProviderOrderId: null, now },
            { billingFacts: ports.billingFacts, listing: ports.listing }
        );
        return 'RETRY';
    }
    if (found === 'SETTLED') {
        // Another entry decided it meanwhile: retry, which either proceeds or meets an active
        // addon.
        const [current] = await getDb()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, input.occupant.id))
            .limit(1);
        return current?.status === 'ACTIVE' ? 'ACTIVATED' : 'RETRY';
    }
    throw new PaymentProviderError({
        code: 'UNAVAILABLE',
        capability: 'charge',
        message: 'Could not tell whether the expired payment page holds a payment',
        transient: { kind: 'UNAVAILABLE' }
    });
}
