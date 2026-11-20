import type { DrizzleClient } from '@repo/db';
import {
    addonInstances,
    addons,
    addonVersions,
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    eq,
    partnerApplicationModel,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';

const logger = createLogger('one-time-addon-activated-notice');

/** Outbox template mailed to the owner when a one-time add-on bought on a payment page activates (HOS-2405). */
export const ONE_TIME_ADDON_ACTIVATED_TEMPLATE = 'billing.one-time-addon-activated';

/** The listing verticals a one-time add-on can name in its mail. */
export const ONE_TIME_ADDON_LISTING_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

/** One listing vertical the mail can name. */
export type OneTimeAddonListingVertical = (typeof ONE_TIME_ADDON_LISTING_VERTICALS)[number];

/** Why no mail was enqueued, or `ENQUEUED` / `ALREADY_ENQUEUED`. */
export type OneTimeAddonActivatedNoticeOutcome =
    | 'ENQUEUED'
    | 'ALREADY_ENQUEUED'
    | 'NOT_ACTIVE'
    | 'NO_RECIPIENT';

/** Payload of the owner mail; the listing NAME is read at render time, like the listing notices. */
export interface OneTimeAddonActivatedPayload {
    readonly addonInstanceId: string;
    readonly locale: 'es' | 'en' | 'pt';
    readonly addonSlug: string;
    readonly addonName: string;
    readonly listingId: string | null;
    readonly vertical: OneTimeAddonListingVertical | null;
    readonly endsAt: string | null;
}

const inputSchema = z.strictObject({
    tx: z.custom<DrizzleClient>((value) => typeof value === 'object' && value !== null),
    instanceId: z.uuid(),
    listing: z
        .strictObject({ id: z.uuid(), vertical: z.enum(ONE_TIME_ADDON_LISTING_VERTICALS) })
        .nullable()
});

/**
 * HOS-2405 (owner, 2026-11-20): when a one-time add-on bought on a payment page becomes
 * `ACTIVE`, its owner is told «tu destaque está activo», naming the add-on, the listing and the
 * expiry (`ends_at`). Runs inside the activation transaction, so the mail commits only with the
 * activation.
 *
 * - The recipient is the account that owns the instance (`addon_instance.owner_id`), never the
 *   payer's declared email nor any provider email (MP never returns `payer_email`).
 * - The locale is the owner account's, read the way the other localized billing mails read it.
 * - The dedup key is `(owner, template, instance id)`: an instance activates once, so every
 *   entry that reaches the activation (notice, return, A3) converges on one row.
 *
 * @param input.tx - The activation transaction
 * @param input.instanceId - The instance that just became `ACTIVE`
 * @param input.listing - The listing it targets and its vertical; `null` when it targets none
 * @returns What happened; a missing recipient is logged and skipped, never thrown
 */
export async function enqueueOneTimeAddonActivatedNotice(input: {
    readonly tx: DrizzleClient;
    readonly instanceId: string;
    readonly listing: {
        readonly id: string;
        readonly vertical: OneTimeAddonListingVertical;
    } | null;
}): Promise<{ readonly outcome: OneTimeAddonActivatedNoticeOutcome }> {
    const { tx, instanceId, listing } = inputSchema.parse(input);
    const [row] = await tx
        .select({
            status: addonInstances.status,
            ownerId: addonInstances.ownerId,
            endsAt: addonInstances.endsAt,
            addonSlug: addons.slug,
            addonName: addons.name,
            email: users.email
        })
        .from(addonInstances)
        .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
        .innerJoin(addons, eq(addons.id, addonVersions.addonId))
        .innerJoin(users, eq(users.id, addonInstances.ownerId))
        .where(eq(addonInstances.id, instanceId))
        .limit(1);
    if (row?.status !== 'ACTIVE') return { outcome: 'NOT_ACTIVE' };
    if (!row.email) {
        logger.warn({ instanceId }, 'No account email for the one-time add-on activated notice');
        return { outcome: 'NO_RECIPIENT' };
    }
    const locale = await partnerApplicationModel.readAccountLocaleByEmail({
        tx,
        email: row.email
    });
    const template = ONE_TIME_ADDON_ACTIVATED_TEMPLATE;
    const payload: OneTimeAddonActivatedPayload = {
        addonInstanceId: instanceId,
        locale,
        addonSlug: row.addonSlug,
        addonName: row.addonName,
        listingId: listing?.id ?? null,
        vertical: listing?.vertical ?? null,
        endsAt: row.endsAt?.toISOString() ?? null
    };
    const result = await emailOutboxModel.enqueue(
        {
            recipientUserId: row.ownerId,
            recipientEmail: row.email,
            template,
            payload: { ...payload },
            dedupKey: buildEmailDedupKey({
                recipient: row.ownerId,
                template,
                occurrence: buildEventOccurrence({ eventId: instanceId })
            })
        },
        tx
    );
    return { outcome: result.enqueued ? 'ENQUEUED' : 'ALREADY_ENQUEUED' };
}
