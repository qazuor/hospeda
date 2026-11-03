import { type DrizzleClient, manualPaymentModel, type SelectManualPayment } from '@repo/db';

/** MP5 clause (b) on signup; HOS-1541 adds the admin notice here, inside the same transaction. */
export async function openManualInstallmentInTx(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly periodStart: Date;
}): Promise<{ readonly manualPayment: SelectManualPayment }> {
    const manualPayment = await manualPaymentModel.insertAwaitingInstallment(input);
    return { manualPayment };
}
