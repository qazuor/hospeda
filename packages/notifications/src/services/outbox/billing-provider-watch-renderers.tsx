import type { EmailOutboxRow } from '@repo/db';
import { z } from 'zod';
import {
    ProviderWatchAlert,
    providerWatchAlertSubject
} from '../../templates/billing/provider-watch-alert.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

/** Template identifier of the provider watch alert mail. */
export const PROVIDER_WATCH_ALERT_TEMPLATE = 'billing.provider-watch-alert';

const alertSchema = z.object({
    measurementId: z.string().min(1),
    kind: z.enum(['value_changed', 'shape_changed']),
    label: z.string().min(1).optional(),
    expected: z.string(),
    obtained: z.string(),
    details: z.array(z.string())
});

/** Payload the alert mail is enqueued with: values already rendered as text. */
export const providerWatchAlertPayloadSchema = z.object({
    account: z.enum(['sandbox', 'production']),
    finishedAt: z.iso.datetime({ offset: true }),
    alerts: z.array(alertSchema).min(1),
    /** Alerts the run found beyond the ones the mail carries. */
    omitted: z.number().int().min(0).default(0)
});

/** Builds the renderer of the provider watch alert mail for the production sender. */
export function createBillingProviderWatchRenderers(): Readonly<
    Record<string, OutboxMailRenderer>
> {
    return {
        [PROVIDER_WATCH_ALERT_TEMPLATE]: ({ row }: { readonly row: EmailOutboxRow }) => {
            const result = providerWatchAlertPayloadSchema.safeParse(row.payload);
            if (!result.success) throw new TypeError('Missing provider watch alert data');
            return {
                subject: providerWatchAlertSubject({
                    account: result.data.account,
                    count: result.data.alerts.length
                }),
                react: <ProviderWatchAlert {...result.data} />
            };
        }
    };
}
