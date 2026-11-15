import {
    type DrizzleClient,
    type ReconciliationMarkReason,
    reconciliationMarkModel
} from '@repo/db';
import { z } from 'zod';

/** Reasons showing that a provider pause may still be our own unconfirmed request. */
export const UNCONFIRMED_PAUSE_REQUEST_REASONS: readonly ReconciliationMarkReason[] = [
    'PAUSA_NO_APLICADA',
    'REANUDACION_NO_APLICADA'
] as const;

const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    tx: z.custom<DrizzleClient>().optional()
});

/**
 * Finds our open pause or resume request before applying TRANS:B:S6's second event.
 * That event requires a provider `paused` status not requested by us (DEC-MP-008);
 * HOS-2003 preserves a request still awaiting confirmation for human review.
 *
 * @param input - Subscription and optional transaction for every mark read
 * @returns The first open request reason, or null
 */
export async function findOpenUnconfirmedPauseRequest(input: {
    readonly subscriptionId: string;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly reason: ReconciliationMarkReason } | null> {
    const value = inputSchema.parse(input);
    for (const reason of UNCONFIRMED_PAUSE_REQUEST_REASONS) {
        const mark = await reconciliationMarkModel.findOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: value.subscriptionId },
            reason,
            ...(value.tx ? { tx: value.tx } : {})
        });
        if (mark) return { reason };
    }
    return null;
}
