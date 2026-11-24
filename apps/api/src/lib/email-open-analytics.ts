/**
 * @file email-open-analytics.ts
 * @description Sends one server-side `email-open` event to Umami per Brevo `opened`
 * webhook (HOS-2583).
 *
 * Opens used to be measured with an `<img>` pixel on our Umami. Brevo proxies every image
 * through its own cache (`img-cache.net`), fetches the pixel once with its own User-Agent
 * (which Umami drops as a bot) and caches it for 48 hours, so no open ever reached Umami.
 * Brevo's `opened` event is the only reliable signal, and this is where it becomes an
 * Umami event.
 *
 * The event carries NO recipient: a transactional open names the catalog template, a
 * newsletter open names the campaign slug, and neither is personal data.
 */

import { AnalyticsEvents } from '@repo/analytics';
import { captureServerAnalyticsEvent } from './analytics-client';

/**
 * Stable server identity used as the Umami `distinctId` of an email open. It is the
 * identity the other server-side events without a user use (`ai-observability.service`),
 * which the Umami mapper treats as "no user" rather than as a person.
 */
const EMAIL_OPEN_DISTINCT_ID = 'api-server';

/** What an open belongs to. */
export type EmailOpenInput =
    | {
          readonly kind: 'transactional';
          /** Email catalog key of the opened template (`auth.reset-password`). */
          readonly templateKey: string;
          /** When Brevo says the message was opened. */
          readonly at: Date;
      }
    | {
          readonly kind: 'newsletter';
          /** `utm_campaign` slug of the campaign. */
          readonly campaignSlug: string;
          /** When Brevo says the message was opened. */
          readonly at: Date;
      };

/**
 * Captures one `email-open` event. Fire and forget: the analytics client never throws and
 * is a no-op when Umami is not configured.
 *
 * @param input - See {@link EmailOpenInput}
 *
 * @example
 * ```ts
 * captureEmailOpen({ kind: 'transactional', templateKey: 'auth.verify-email', at: new Date() });
 * ```
 */
export function captureEmailOpen(input: EmailOpenInput): void {
    captureServerAnalyticsEvent({
        distinctId: EMAIL_OPEN_DISTINCT_ID,
        name: AnalyticsEvents.emailOpen,
        timestamp: input.at,
        properties:
            input.kind === 'transactional'
                ? { kind: 'transactional', template_key: input.templateKey }
                : { kind: 'newsletter', campaign: input.campaignSlug }
    });
}
