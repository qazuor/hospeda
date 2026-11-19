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
 * - `NONE_APPROVED`: every id the search yielded, re-read by id, is not an approved payment of
 *   this purchase. The only outcome that lets A3 abandon.
 * - `UNDECIDED`: the search or a read did not answer, or an approved payment could not activate
 *   (another amount). Nothing may be decided this run.
 */
export type ConfirmOneTimePageByReferenceOutcome =
    | 'ACTIVATED'
    | 'SETTLED'
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
                return 'SETTLED';
            case 'AMOUNT_MISMATCH':
            case 'UNKNOWN':
            case 'NOT_APPLICABLE':
                undecided = true;
                break;
            case 'NOT_APPROVED':
            case 'NOT_THIS_PURCHASE':
                break;
        }
    }
    return undecided ? 'UNDECIDED' : 'NONE_APPROVED';
}
