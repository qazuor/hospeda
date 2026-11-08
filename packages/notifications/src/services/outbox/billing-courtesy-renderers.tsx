import type { EmailOutboxRow } from '@repo/db';
import { z } from 'zod';
import {
    COURTESY_REVOKED_SUBJECT,
    CourtesyRevoked
} from '../../templates/billing/courtesy-revoked.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const payloadSchema = z.object({ nextChargeOn: z.iso.date() });

/** Builds the billing courtesy renderer for the production sender. */
export function createBillingCourtesyRenderers(): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.courtesy-revoked': ({ row }: { readonly row: EmailOutboxRow }) => {
            const result = payloadSchema.safeParse(row.payload);
            if (!result.success) throw new TypeError('Missing courtesy revocation notice data');
            return {
                subject: COURTESY_REVOKED_SUBJECT,
                react: <CourtesyRevoked nextChargeOn={result.data.nextChargeOn} />
            };
        }
    };
}
