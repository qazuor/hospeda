/**
 * Audience of the email template catalog (HOS-2565 AC-1.2). The staff set is
 * frozen on purpose: reclassifying a mail is a deliberate edit of this list.
 */
import { describe, expect, it } from 'vitest';
import { EMAIL_CATALOG } from '../../src/catalog/index';

/** The 13 catalog entries read by staff, never by end users. */
const STAFF_KEYS: readonly string[] = Object.freeze([
    'notification.admin_payment_failure',
    'notification.admin_system_event',
    'notification.admin_lead_received',
    'notification.feedback_report',
    'notification.contact_submission',
    'notification.ai_cost_threshold_alert',
    'outbox.billing.reconciliation-summary',
    'outbox.billing.duplicate-charge-detected',
    'outbox.billing.mark-escalated',
    'outbox.billing.revocation-refund-failed',
    'outbox.billing.manual-installment-unpaid',
    'outbox.billing.provider-watch-alert',
    'outbox.verticals.listing-fix-reported'
]);

describe('email catalog audience', () => {
    it('should declare audience user or staff on every entry', () => {
        for (const entry of EMAIL_CATALOG) {
            expect(['user', 'staff'], `${entry.key} has an invalid audience`).toContain(
                entry.audience
            );
        }
    });

    it('should flag exactly the 13 frozen staff keys as staff', () => {
        const staff = EMAIL_CATALOG.filter((entry) => entry.audience === 'staff').map(
            (entry) => entry.key
        );

        expect(staff.sort()).toEqual([...STAFF_KEYS].sort());
        expect(staff).toHaveLength(13);
    });

    it('should flag every other entry as user', () => {
        const users = EMAIL_CATALOG.filter((entry) => entry.audience === 'user');

        expect(users).toHaveLength(EMAIL_CATALOG.length - STAFF_KEYS.length);
    });
});
