import { cleanupTestUsers } from '../support/test-cleanup.ts';
import { execSQL, getDbPool } from './db-helpers.ts';

/** Remove manual payment rows and receipts left by the manual arrears e2e. */
export async function cleanupManualArrearsRows(args: { readonly userIds: readonly string[] }) {
    if (!args.userIds.length) return;
    await execSQL(
        `DELETE FROM receipt WHERE manual_payment_id IN (SELECT id FROM manual_payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])))`,
        [args.userIds]
    );
    await execSQL(
        `DELETE FROM covered_period WHERE manual_payment_id IN (SELECT id FROM manual_payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])))`,
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
        `DELETE FROM email_outbox WHERE recipient_user_id = ANY($1::uuid[]) AND status IN ('pending', 'retry')`,
        [args.userIds]
    );
    await cleanupTestUsers(getDbPool(), args.userIds);
}
