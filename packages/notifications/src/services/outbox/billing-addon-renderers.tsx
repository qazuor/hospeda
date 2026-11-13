import type { EmailOutboxRow } from '@repo/db';
import { ADDON_LISTING_PURGED_SUBJECT, AddonListingPurged } from '../../templates/billing/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

function addonListingPurged(row: EmailOutboxRow) {
    const payload: unknown = row.payload;
    if (
        !payload ||
        typeof payload !== 'object' ||
        !('subscriptionId' in payload) ||
        typeof payload.subscriptionId !== 'string'
    )
        throw new TypeError('Faltan datos requeridos del aviso de ficha borrada');
    return { subject: ADDON_LISTING_PURGED_SUBJECT, react: <AddonListingPurged /> };
}

/** Outbox renderer for the A6 before-cancel notice. */
export function createBillingAddonRenderers(): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.addon-listing-purged-cancel': ({ row }) => addonListingPurged(row)
    };
}
