import { addonInstances, eq, getDb } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import {
    type ConfirmOneTimePagePaymentPorts,
    confirmOneTimePagePayment
} from './addon-instance-a2-one-time-page';

const logger = createLogger('addon-one-time-page-by-reference');

const inputSchema = z.object({ instanceId: z.uuid() });

/** How far before the purchase a payment's creation may be read, for provider clock skew. */
const SEARCH_SKEW_MS = 3_600_000;

/**
 * What a confirmation by reference found.
 *
 * - `ACTIVATED`: an approved payment, re-read by id, activated the purchase.
 * - `SETTLED`: the purchase stopped waiting meanwhile (another entry decided it).
 * - `NONE_FOUND`: the search yielded no id at all. A search may answer only part of the matches
 *   (M4), so this is "nothing seen", not "nothing paid".
 * - `NONE_APPROVED`: the search yielded ids, and each, re-read by id, is not an approved payment
 *   of this purchase for its price: none approved, or one of another amount whose
 *   `DIVERGENCIA_DE_MONTO` is open (AC-8).
 *
 * `NONE_FOUND` and `NONE_APPROVED` are the only outcomes that let a purchase be abandoned (A3,
 * and the owner's retry over an expired page); a payment that lands after that follows the
 * late-payment path.
 * - `UNDECIDED`: the search or a read did not answer, or a divergence mark could not be opened.
 *   Nothing may be decided this run.
 */
export type ConfirmOneTimePageByReferenceOutcome =
    | 'ACTIVATED'
    | 'SETTLED'
    | 'NONE_FOUND'
    | 'NONE_APPROVED'
    | 'UNDECIDED';

/**
 * Looks for a payment of a page purchase by its reference and confirms it (HOS-2179 §5.3 path
 * 3 and §5.4). The search is not a source of truth (INV:D6): it only yields ids, and each id
 * goes through A2, which re-reads it by id before deciding. Shared by A3 and, later, by the
 * return re-read (§5.3 path 2).
 *
 * @param input.instanceId - The pending one-time page purchase
 * @param ports - A2's ports
 * @returns What was found; never throws for a provider failure
 */
export async function confirmOneTimePageByReference(
    input: { readonly instanceId: string },
    ports: ConfirmOneTimePagePaymentPorts
): Promise<ConfirmOneTimePageByReferenceOutcome> {
    inputSchema.parse(input);
    const [instance] = await getDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, input.instanceId))
        .limit(1);
    if (!instance?.orderRequestId) return 'UNDECIDED';
    if (instance.status !== 'PENDING_AUTHORIZATION') return 'SETTLED';
    let chargeIds: readonly string[];
    try {
        ({ chargeIds } = await ports.provider.searchCharges({
            reference: instance.orderRequestId,
            createdFrom: new Date(instance.createdAt.getTime() - SEARCH_SKEW_MS).toISOString(),
            createdTo: ports.clock.now().toISOString()
        }));
    } catch (error) {
        logger.warn(
            {
                instanceId: instance.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'Charge search by reference did not answer'
        );
        return 'UNDECIDED';
    }
    if (chargeIds.length === 0) return 'NONE_FOUND';
    let undecided = false;
    for (const chargeId of chargeIds) {
        const result = await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId },
            ports
        );
        switch (result.outcome) {
            case 'ACTIVATED':
                return 'ACTIVATED';
            case 'ALREADY_CONFIRMED':
            case 'DUPLICATE_PAYMENT':
            case 'LATE_PAYMENT':
            // Only a purchase that holds the charge reads charged back here; A3 never sees one.
            case 'CHARGED_BACK':
                return 'SETTLED';
            case 'UNKNOWN':
            case 'NOT_APPLICABLE':
                undecided = true;
                break;
            // Another amount is decided: it activates nothing and MOT:5 is already open on
            // the instance (AC-8), so it does not keep the purchase waiting forever.
            case 'AMOUNT_MISMATCH':
            case 'NOT_APPROVED':
            case 'NOT_THIS_PURCHASE':
                break;
        }
    }
    return undecided ? 'UNDECIDED' : 'NONE_APPROVED';
}
