/**
 * @file lead-intake-ports.ts
 * @description Ops alert for an inbound acquisition lead (H-62 / H-148).
 *
 * ## What was wrong
 *
 * The platform used to have five public acquisition forms — one for commerce
 * and four for "aliados" — and none of them told anybody when a submission
 * arrived. Commerce had the hook written (`LeadNotificationPort.notifyNewLead`)
 * and it was never injected at any of its five construction sites, so the
 * `else` branch ran every time and logged at `debug`, which production does
 * not emit. Alliance did not model the idea at all: its two ports write to the
 * APPLICANT (claim an account, here is the verdict), never to the platform.
 *
 * The result was a funnel with no doorbell. Discovery depended entirely on an
 * operator deciding, unprompted, to open the admin and look — and the failure
 * mode of that is invisible from the outside: no error, no bounce, no
 * complaint. Nobody knows they did not find out.
 *
 * ## Commerce is gone (HOS-695, release C)
 *
 * The commerce lead-intake funnel accepted no new submissions well before this
 * — HOS-693 retired its public form and admin provisioning flow, HOS-690
 * unmounted the form from the landing pages — and its admin review surface
 * only ever served three smoke-test fixtures with nothing worth preserving.
 * HOS-695 removed that surface and the `commerce_leads` table itself, and this
 * module's commerce branch went with it. `alliance` is the only funnel left;
 * this module is kept (not inlined into the alliance service) because a
 * future funnel would want the exact same ops-alert plumbing, and the
 * `announceLeadToOps` / `stampOpsNotified` shape stays funnel-agnostic on
 * purpose.
 *
 * ## Why `opsNotifiedAt` is stamped here
 *
 * This is the only place that knows whether the alert was actually DELIVERED,
 * as opposed to merely attempted. The column is written on a confirmed
 * delivery and on nothing else, which is what lets the backstop cron keep
 * chasing what never arrived instead of assuming it did.
 *
 * @module lib/lead-intake-ports
 */

import { allianceLeads, getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { AllianceLeadKind } from '@repo/schemas';
import type { AllianceLeadIntakeNotifyPort } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { trySendNotification } from '../utils/notification-helper';

/**
 * Which acquisition funnel a lead came through.
 *
 * A one-member union rather than a plain `'alliance'` literal type on the
 * fields below: kept as a named, extensible type so a future second funnel
 * (this module's whole reason for being funnel-agnostic) widens it in one
 * place instead of every call site.
 */
export type LeadFunnel = 'alliance';

/** Everything the ops alert needs, normalised across funnels. */
export interface LeadIntakeAlert {
    /** Which funnel it arrived through. */
    readonly funnel: LeadFunnel;
    /** UUID of the persisted lead row. */
    readonly leadId: string;
    /** Human label for the program or domain applied for. */
    readonly programLabel: string;
    /** Who applied. */
    readonly contactName: string;
    /** Their email. */
    readonly contactEmail: string;
    /** Their phone, when the form collected one. */
    readonly contactPhone?: string | null;
    /** The business name, when the funnel asks for one. */
    readonly businessName?: string | null;
    /** The applicant's message, verbatim. */
    readonly message?: string | null;
    /** When the row was created. */
    readonly createdAt: Date;
}

/**
 * Human-readable program names for the four "aliados" forms.
 *
 * A total record over {@link AllianceLeadKind}: adding a fifth program fails
 * the build here rather than emailing ops a raw slug. Mirrors the map in
 * `alliance-ports.ts`, which serves applicant-facing mail.
 */
const ALLIANCE_PROGRAM_LABELS: Record<AllianceLeadKind, string> = {
    partner: 'Partner',
    sponsor: 'Sponsor',
    editor: 'Editor',
    service_provider: 'Proveedor'
};

/** Where each funnel's queue lives in the admin. */
const ADMIN_QUEUE_PATHS: Record<LeadFunnel, string> = {
    alliance: '/platform/alliance-leads'
};

/** How the funnel is named to a human reading the alert. */
const FUNNEL_LABELS: Record<LeadFunnel, string> = {
    alliance: 'Aliados'
};

/**
 * Resolves the operations mailboxes that receive lead alerts.
 *
 * Reuses `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`, the address list every other ops
 * alert already uses (payment disputes, webhook failures, AI cost thresholds).
 * Introducing a second list for leads would create a second thing to keep set.
 *
 * @returns The trimmed, non-empty addresses. Empty when the var is unset.
 */
function resolveOpsRecipients(): readonly string[] {
    return (env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS ?? '')
        .split(',')
        .map((address) => address.trim())
        .filter((address) => address.length > 0);
}

/**
 * Formats a timestamp for the alert body.
 *
 * @param date - The moment the lead arrived.
 * @returns A readable Argentina-local date and time.
 */
function formatSubmittedAt(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).format(date);
}

/**
 * Records that ops was told about this lead.
 *
 * @param params - `{ funnel, leadId, notifiedAt }`.
 */
async function stampOpsNotified(params: {
    readonly funnel: LeadFunnel;
    readonly leadId: string;
    readonly notifiedAt: Date;
}): Promise<void> {
    const db = getDb();
    const { leadId, notifiedAt } = params;

    // `params.funnel` is currently always 'alliance' (the only LeadFunnel
    // member) — kept as a parameter, not inlined away, so a second funnel
    // only needs a branch here rather than a signature change everywhere
    // this is called from.
    await db
        .update(allianceLeads)
        .set({ opsNotifiedAt: notifiedAt })
        .where(eq(allianceLeads.id, leadId));
}

/**
 * Sends the ops alert for one lead and records the delivery.
 *
 * Exported because the backstop cron sends the very same alert for anything
 * this path missed; sharing the function is what keeps the two from drifting
 * into saying different things about the same lead.
 *
 * Delivery is attempted for every configured recipient. One confirmed delivery
 * is enough to stamp the row: the point of the column is "somebody was told",
 * and holding it back because a second mailbox bounced would make the cron
 * re-alert the operator who did receive it.
 *
 * @param params - `{ alert }` the normalised lead.
 * @returns `{ delivered }` — true when at least one mailbox received it.
 */
export async function announceLeadToOps(params: { readonly alert: LeadIntakeAlert }): Promise<{
    readonly delivered: boolean;
}> {
    const { alert } = params;
    const recipients = resolveOpsRecipients();

    if (recipients.length === 0) {
        // WARN, not debug: an unset address list means every lead alert is
        // silently dropped, which is the original defect wearing a different
        // hat. It must be visible in production logs.
        apiLogger.warn(
            { leadId: alert.leadId, funnel: alert.funnel },
            '[lead-intake] HOSPEDA_ADMIN_NOTIFICATION_EMAILS is unset; nobody can be told about this lead'
        );
        return { delivered: false };
    }

    const adminUrl = new URL(ADMIN_QUEUE_PATHS[alert.funnel], env.HOSPEDA_ADMIN_URL).toString();

    const outcomes = await Promise.all(
        recipients.map((recipientEmail) =>
            trySendNotification({
                type: NotificationType.ADMIN_LEAD_RECEIVED,
                recipientEmail,
                recipientName: 'Equipo Hospeda',
                // No account is being addressed — this goes to an operations
                // mailbox, which may not correspond to any user row.
                userId: null,
                leadId: alert.leadId,
                funnelLabel: FUNNEL_LABELS[alert.funnel],
                programLabel: alert.programLabel,
                contactName: alert.contactName,
                contactEmail: alert.contactEmail,
                contactPhone: alert.contactPhone ?? undefined,
                businessName: alert.businessName ?? undefined,
                message: alert.message ?? undefined,
                adminUrl,
                submittedAtLabel: formatSubmittedAt(alert.createdAt),
                // Stable per lead AND per recipient. It does not stop a second
                // send — nothing in the notification service dedupes on it —
                // but it keys the retry queue entry, so the backstop cron
                // retrying the same lead reuses one slot instead of stacking a
                // new one per tick.
                idempotencyKey: `lead-intake-${alert.funnel}-${alert.leadId}-${recipientEmail}`
            })
        )
    );

    const delivered = outcomes.some((outcome) => outcome.delivered);

    if (!delivered) {
        apiLogger.error(
            { leadId: alert.leadId, funnel: alert.funnel, recipients: recipients.length },
            '[lead-intake] ops alert reached nobody; leaving it for the backstop cron'
        );
        return { delivered: false };
    }

    await stampOpsNotified({
        funnel: alert.funnel,
        leadId: alert.leadId,
        notifiedAt: new Date()
    });

    apiLogger.info(
        { leadId: alert.leadId, funnel: alert.funnel },
        '[lead-intake] ops alerted about a new lead'
    );

    return { delivered: true };
}

/**
 * Creates the alliance funnel's {@link AllianceLeadIntakeNotifyPort}
 * implementation.
 *
 * @returns A port that alerts ops about a newly submitted alliance lead.
 */
export function createAllianceLeadIntakeNotifyPort(): AllianceLeadIntakeNotifyPort {
    return {
        notifyNewLead: async ({ lead }) => {
            await announceLeadToOps({
                alert: {
                    funnel: 'alliance',
                    leadId: lead.id,
                    programLabel: ALLIANCE_PROGRAM_LABELS[lead.kind] ?? lead.kind,
                    contactName: lead.contactName,
                    contactEmail: lead.email,
                    contactPhone: lead.phone,
                    businessName: lead.businessName,
                    message: lead.message,
                    createdAt: lead.createdAt ?? new Date()
                }
            });
        }
    };
}
