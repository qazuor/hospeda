import { type DrizzleClient, manualPaymentModel } from '@repo/db';
import { z } from 'zod';

const inputSchema = z.strictObject({ subscriptionId: z.uuid(), now: z.date() });

/** Closes awaiting installments in the terminal transition's transaction. */
export async function closeAwaitingManualInstallmentsInTx(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
}): Promise<{ readonly closed: number }> {
    const { subscriptionId, now } = inputSchema.parse({
        subscriptionId: input.subscriptionId,
        now: input.now
    });
    return {
        closed: await manualPaymentModel.closeAwaitingForSubscription({
            subscriptionId,
            now,
            tx: input.tx
        })
    };
}
