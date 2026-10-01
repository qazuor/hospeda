/**
 * New paid signups freeze — the single gate for every self-service "alta".
 *
 * An admin can pause new self-service paid signups platform-wide, without a
 * deploy, by switching `billing_settings.newPaidSignupsFrozen` on from the
 * admin billing settings page. This module is the ONLY place that reads that
 * switch on the request path, so the three entry points below cannot disagree
 * about what "frozen" means.
 *
 * ## What it freezes (owner decision O)
 *
 * - `POST /protected/billing/subscriptions/start-paid` — every accommodation /
 *   tourist checkout, including the conversion of a local trial to paid.
 * - `POST /protected/commerce/listings/:entityType/:entityId/start-subscription`
 *   — the owner commerce self-checkout, in its trial and checkout branches.
 * - `POST /protected/billing/addons/:slug/purchase` — add-on purchases.
 *
 * ## What it deliberately does NOT freeze
 *
 * Anything an existing customer or an operator relies on: admin provisioning
 * (`commerce/admin/start-subscription`, `partners/admin/send-link`,
 * `partners/admin/manual-payment`), the plan upgrade of a paying customer
 * (`plan-change` → `initiatePaidPlanUpgrade`), renewals, webhooks, dunning,
 * cancellations, payment-method replacement, checkout retries and pauses.
 * None of those call this module, and they must keep not calling it.
 *
 * ## Where callers place it
 *
 * Before ANY database write or MercadoPago call — including the
 * billing-customer self-heal (`ensureCustomerExists`), which writes a row and
 * may create a MercadoPago customer. In the error-contract order it is a
 * business rule (step 5): auth, permission and input shape have already run
 * by the time the handler body executes.
 *
 * ## Failure posture
 *
 * The read goes through `BillingSettingsService.getSettings`, which falls back
 * to the defaults (`newPaidSignupsFrozen: false`) when the settings row cannot
 * be read. A database outage therefore reads as "not frozen" — acceptable
 * because every checkout behind this gate needs that same database to proceed,
 * so it fails on its own a step later. The value is compared with a strict
 * `=== true`: anything that is not literally `true` is "not frozen", which is
 * the shipped default.
 *
 * @module services/billing/new-paid-signups-freeze
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { apiLogger } from '../../utils/logger';
import { getBillingSettingsService } from '../billing-settings.service';

/**
 * The self-service entry points the freeze applies to. Used only to label the
 * log line, so support can tell which surface a refused visitor came from.
 */
export type NewPaidSignupEntryPoint = 'start-paid' | 'commerce-self-checkout' | 'addon-purchase';

/**
 * Client-facing message of the refusal. English, like every API message: the
 * web never paints it — it translates `error.code` through
 * `common.apiError.NEW_PAID_SIGNUPS_FROZEN` instead.
 */
export const NEW_PAID_SIGNUPS_FROZEN_MESSAGE =
    'New subscriptions and purchases are temporarily paused. Existing subscriptions keep working normally.';

/**
 * Reads whether new self-service paid signups are currently frozen.
 *
 * @returns `{ frozen }` — `true` only when the stored setting is literally `true`.
 */
export async function readNewPaidSignupsFreeze(): Promise<{ readonly frozen: boolean }> {
    const settings = await getBillingSettingsService().getSettings();
    return { frozen: settings.newPaidSignupsFrozen === true };
}

/**
 * Refuses the request when new self-service paid signups are frozen.
 *
 * Throws a `ServiceError` with code `NEW_PAID_SIGNUPS_FROZEN`, which both API
 * error formatters map to HTTP 409. Resolves silently otherwise.
 *
 * @param input.entryPoint - Which self-service surface is asking (log label only).
 * @throws {ServiceError} `NEW_PAID_SIGNUPS_FROZEN` while the freeze is on.
 *
 * @example
 * ```ts
 * // First statement of the handler body, before any write or MP call:
 * await assertNewPaidSignupsAllowed({ entryPoint: 'start-paid' });
 * ```
 */
export async function assertNewPaidSignupsAllowed(input: {
    readonly entryPoint: NewPaidSignupEntryPoint;
}): Promise<void> {
    const { frozen } = await readNewPaidSignupsFreeze();
    if (!frozen) {
        return;
    }

    apiLogger.info(
        { entryPoint: input.entryPoint },
        'New paid signup refused: self-service signups are frozen by billing settings'
    );

    throw new ServiceError(
        ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN,
        NEW_PAID_SIGNUPS_FROZEN_MESSAGE
    );
}
