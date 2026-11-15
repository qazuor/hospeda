import { execSQL } from './db-helpers.ts';
import { monthlyOptionForSlug as readMonthlyOptionForSlug } from './signup-checkout.ts';

/** Returns the current monthly Partner plan option for action 6. AC:V7:17; ACC:6. */
export async function monthlyOptionForSlug(slug: 'partner-silver'): Promise<string> {
    return readMonthlyOptionForSlug(slug);
}

/** Removes action 6-owned rows while preserving append-only domain events. AC:V7:17; ACC:6. */
export async function cleanupPartnerBillingSetupRows(args: {
    readonly userIds: readonly string[];
    readonly partnerIds: readonly string[];
}): Promise<void> {
    if (args.userIds.length) {
        await execSQL(
            `DELETE FROM receipt WHERE manual_payment_id IN (SELECT mp.id FROM manual_payment mp JOIN subscription s ON s.id = mp.subscription_id WHERE s.user_id = ANY($1::uuid[]))`,
            [args.userIds]
        );
        await execSQL(
            `DELETE FROM covered_period WHERE manual_payment_id IN (SELECT mp.id FROM manual_payment mp JOIN subscription s ON s.id = mp.subscription_id WHERE s.user_id = ANY($1::uuid[]))`,
            [args.userIds]
        );
        await execSQL(
            `DELETE FROM manual_payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
            [args.userIds]
        );
        await execSQL(
            `DELETE FROM provider_link WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
            [args.userIds]
        );
        await execSQL(
            "DELETE FROM email_outbox WHERE recipient_user_id = ANY($1::uuid[]) AND status IN ('pending', 'retry')",
            [args.userIds]
        );
    }
    if (args.partnerIds.length)
        await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [args.partnerIds]);
}
