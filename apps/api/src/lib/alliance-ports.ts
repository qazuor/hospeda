/**
 * @file alliance-ports.ts
 * @description Port implementation for the alliance claim flow (HOS-278 §6.2).
 *
 * Bridges `AllianceLeadService`'s `AllianceClaimInvitePort` to the API's
 * runtime dependencies (the `users` table and the notification transport).
 *
 * ## Why the account lookup lives HERE and not in the service
 *
 * "Does this email already have an account?" is the single fact AC-3 forbids
 * disclosing — not in the response body, and not in how long the response
 * takes. Keeping the question entirely outside `AllianceLeadService` means no
 * branch on the submission path can differ on the answer: the service hands
 * EVERY anonymous submission to this port and moves on without awaiting it.
 *
 * @module lib/alliance-ports
 */

import { getDb, users } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { AllianceLeadKind } from '@repo/schemas';
import type { AllianceClaimInvitePort } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';

/**
 * Human-readable program names, so the recipient is not asked to confirm
 * something called `service_provider`.
 *
 * Typed as a total record over {@link AllianceLeadKind}: adding a fifth program
 * fails the build here rather than emailing someone a raw slug.
 */
const PROGRAM_LABELS: Record<AllianceLeadKind, string> = {
    partner: 'Partner',
    sponsor: 'Sponsor',
    editor: 'Editor',
    service_provider: 'Proveedor'
};

/**
 * Builds the confirmation URL carried by the invitation email.
 *
 * The token rides in the query string, which is the only place it can go for a
 * link in an email body. Two consequences are accepted deliberately: it is
 * single-use and short-lived (7 days), so a leaked URL from a browser history
 * or a forwarded message is worth little, and redemption additionally requires
 * being signed in as the account that owns the address.
 *
 * @param params - Site base URL, lead id and raw token.
 * @returns Absolute URL to the account's alliances page, carrying the claim.
 */
function buildClaimUrl(params: {
    readonly siteUrl: string;
    readonly leadId: string;
    readonly token: string;
}): string {
    const url = new URL('/mi-cuenta/aliados', params.siteUrl);
    url.searchParams.set('lead', params.leadId);
    url.searchParams.set('claim', params.token);
    return url.toString();
}

/**
 * Creates the {@link AllianceClaimInvitePort} implementation.
 *
 * Looks the submitted address up in `users` and sends the invitation ONLY when
 * it belongs to an account. When it does not, the port returns silently: the
 * lead keeps its (undeliverable) claim digest and stays unlinked until an admin
 * provisions an account at approval time.
 *
 * Failures are logged and swallowed — the service calls this fire-and-forget,
 * and an undelivered invitation leaves the lead in the same safe unlinked state
 * as never having issued one.
 *
 * @param siteUrl - Base URL of the public web app (e.g. `https://hospeda.com.ar`).
 * @returns An {@link AllianceClaimInvitePort} implementation.
 */
export function createAllianceClaimInvitePort(siteUrl: string): AllianceClaimInvitePort {
    return {
        inviteToClaim: async ({ leadId, email, contactName, kind, token, expiresAt }) => {
            const db = getDb();
            const [account] = await db
                .select({ id: users.id, displayName: users.displayName })
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

            if (!account) {
                // No account behind this address. Nothing to confirm and nobody
                // to ask — and, critically, nothing said to the submitter about
                // it either (AC-3).
                apiLogger.debug(
                    { leadId },
                    '[alliance-claim] no account for the submitted address; no invitation sent'
                );
                return;
            }

            await sendNotification({
                type: NotificationType.ALLIANCE_CLAIM_INVITE,
                recipientEmail: email,
                // The ACCOUNT's name, not the applicant's: the two may be
                // different people, and greeting the owner with a stranger's
                // name would be both confusing and a small disclosure.
                recipientName: account.displayName ?? contactName,
                userId: account.id,
                leadId,
                programLabel: PROGRAM_LABELS[kind],
                claimUrl: buildClaimUrl({ siteUrl, leadId, token }),
                expiresAt: expiresAt.toISOString()
            });

            // Deliberately logs the lead id ONLY. The claim URL embeds the raw
            // token; putting it in a log line would defeat storing a digest.
            apiLogger.info({ leadId }, '[alliance-claim] invitation sent to the address owner');
        }
    };
}
