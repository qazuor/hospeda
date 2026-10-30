import type { DrizzleClient } from '@repo/db';
import { sql } from 'drizzle-orm';

export interface ReceiptPayer {
    readonly name: string;
    readonly email: string;
}

export async function nextReceiptNumber(input: { readonly tx: DrizzleClient }): Promise<number> {
    const { receiptCounters } = await import('@repo/db');
    const [row] = await input.tx
        .insert(receiptCounters)
        .values({ id: 1, lastNumber: 1 })
        .onConflictDoUpdate({
            target: receiptCounters.id,
            set: {
                lastNumber: sql`${receiptCounters.lastNumber} + 1`,
                updatedAt: sql`now()`
            }
        })
        .returning({ lastNumber: receiptCounters.lastNumber });
    if (!row) throw new Error('Receipt counter did not return a number');
    return row.lastNumber;
}

export async function readReceiptPayer(input: {
    readonly tx: DrizzleClient;
    readonly userId: string | null;
}): Promise<{ readonly payer: ReceiptPayer | null; readonly deliverable: boolean }> {
    if (!input.userId) return { payer: null, deliverable: false };
    const { eq, users } = await import('@repo/db');
    const [user] = await input.tx
        .select({
            firstName: users.firstName,
            lastName: users.lastName,
            displayName: users.displayName,
            email: users.email,
            deletedAt: users.deletedAt
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
    if (!user || user.deletedAt || !user.email) return { payer: null, deliverable: false };
    const personalName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const name = personalName || user.displayName?.trim() || user.email;
    return { payer: { name, email: user.email }, deliverable: true };
}

export async function issueReceipt(input: {
    readonly tx: DrizzleClient;
    readonly source:
        | { readonly kind: 'PAYMENT'; readonly paymentId: string }
        | { readonly kind: 'MANUAL_PAYMENT'; readonly manualPaymentId: string };
    readonly payer: ReceiptPayer | null;
    readonly issuedAt: Date;
}): Promise<{ readonly receiptId: string; readonly receiptNumber: number }> {
    const { receipts } = await import('@repo/db');
    const receiptNumber = await nextReceiptNumber({ tx: input.tx });
    const [receipt] = await input.tx
        .insert(receipts)
        .values({
            paymentId: input.source.kind === 'PAYMENT' ? input.source.paymentId : null,
            manualPaymentId:
                input.source.kind === 'MANUAL_PAYMENT' ? input.source.manualPaymentId : null,
            receiptNumber,
            pdfRef: null,
            payerName: input.payer?.name ?? null,
            payerEmail: input.payer?.email ?? null,
            issuedAt: input.issuedAt
        })
        .returning({ id: receipts.id });
    if (!receipt) throw new Error('Receipt insert did not return a row');
    return { receiptId: receipt.id, receiptNumber };
}
