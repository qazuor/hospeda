/**
 * @file accommodation.calendar-cascade.ts
 * @description The delete-time half of HOS-663: soft-deleting an accommodation
 * must also shut down its external calendar connections, and hand the host's
 * credentials back to the provider.
 *
 * ## What was broken
 *
 * `accommodation_calendar_sync` holds one row per external calendar connection,
 * carrying the AES-encrypted `access_token` / `refresh_token` of the host's
 * calendar. The sync crons iterate ACTIVE connections, and a soft-delete wrote
 * `deleted_at` on the accommodation and nothing else — so every six hours the
 * platform kept pulling a stranger's agenda for a listing nobody can see.
 * Measured in production: 311 of 324 occupancy rows belonged to deleted
 * listings, both connections still `is_active = true`, `last_sync_status = OK`.
 *
 * Wasted work and noisy data are the small costs. The one that matters is that
 * the credential stayed live: somebody who deletes their listing reasonably
 * expects that to end the platform's access to their calendar.
 *
 * ## Deactivate, not delete
 *
 * The row is deactivated (`is_active = false`) and kept. That is not a
 * compromise, it is the convention this repo already applies to the two
 * neighbouring cases: the host-initiated disconnect route soft-disconnects and
 * keeps the row for audit, and the sibling cascade on this very hook CLOSES an
 * accommodation's conversations rather than deleting them. An accommodation
 * soft-delete is reversible; a cascade that hard-deletes the dependent rows is
 * not, so a restore would silently come back with less than it had.
 *
 * Hard deletes need none of this: `accommodation_calendar_sync.accommodation_id`
 * declares `onDelete: 'cascade'`, so a physical delete already takes the rows
 * (and the tokens) with it. Only the soft path leaked.
 *
 * ## Revocation is a separate act from deactivation
 *
 * Deactivating stops US from using the token. It does not close the grant — the
 * credential remains valid at the provider until it is revoked there. So every
 * connection this cascade deactivates is handed to
 * {@link CalendarConnectionRevocationPort}, which lives in `apps/api` (it needs
 * the OAuth vault and the provider HTTP clients, neither of which belongs in
 * this package) and is registered at API startup.
 *
 * A revocation that fails silently is worse than no revocation, because it
 * leaves everyone believing the access was closed. So a failure — including
 * "no port registered" and "this provider has no revocation endpoint" — is
 * recorded ON THE ROW (`last_sync_status = ERROR` plus a
 * `{@link REVOCATION_FAILURE_PREFIX}`-tagged `last_error_message`) as well as
 * logged at error level. That makes the set of credentials still live at the
 * provider a single SQL query rather than a grep through log retention.
 *
 * The cascade never throws: a dependent row must not be able to fail an
 * accommodation delete. The cron-side condition in
 * `findAllActiveByProvider` is what makes that safe — it is the second,
 * independent defence, enforced on the READ, and it also covers the rows that
 * were already wrong before this shipped.
 */

import { accommodationCalendarSyncModel, type DrizzleClient } from '@repo/db';
import { CalendarSyncStatusEnum, type OccupancySourceEnum } from '@repo/schemas';
import type { ServiceLogger } from '../../utils/service-logger';

/**
 * Prefix stamped on `last_error_message` when a connection was deactivated but
 * its credential could NOT be revoked at the provider.
 *
 * Deliberately a stable, greppable literal: it is the WHERE clause of the
 * operational question this cascade must keep answerable — "which hosts still
 * have a live grant pointing at us?".
 */
export const REVOCATION_FAILURE_PREFIX = 'HOS-663 REVOCATION_FAILED';

/** Outcome of asking the provider to revoke one connection's credential. */
export type CalendarConnectionRevocationResult =
    | {
          /** The provider confirmed the credential is no longer valid. */
          readonly revoked: true;
      }
    | {
          /** The credential may still be valid at the provider. */
          readonly revoked: false;
          /**
           * Why, in a few words, suitable for persisting on the row. Must not
           * contain the credential itself.
           */
          readonly reason: string;
      };

/**
 * The capability `apps/api` supplies so this package can close a grant without
 * importing the OAuth vault or any provider HTTP client.
 */
export interface CalendarConnectionRevocationPort {
    /**
     * Asks the provider to invalidate the stored credential for one
     * accommodation + provider pair.
     *
     * Implementations MUST NOT throw for an operational failure — they return
     * `{ revoked: false, reason }` so the caller can record it. A throw is
     * treated as a failure all the same.
     */
    revoke(input: {
        readonly accommodationId: string;
        readonly provider: OccupancySourceEnum;
    }): Promise<CalendarConnectionRevocationResult>;
}

let _revocationPort: CalendarConnectionRevocationPort | undefined;

/**
 * Registers the provider-side revocation adapter. Called once at API startup.
 *
 * @param port - The adapter, or `undefined` to clear it (tests).
 */
export function setCalendarConnectionRevocationPort(
    port: CalendarConnectionRevocationPort | undefined
): void {
    _revocationPort = port;
}

/**
 * Returns the registered revocation adapter, or `undefined` when none was
 * registered (e.g. a worker process that never initialised the API layer).
 *
 * @returns The adapter or `undefined`.
 */
export function getCalendarConnectionRevocationPort():
    | CalendarConnectionRevocationPort
    | undefined {
    return _revocationPort;
}

/** Input for {@link cascadeCalendarConnectionsOnAccommodationDelete}. */
export interface CascadeCalendarConnectionsInput {
    /** The accommodation that was just soft-deleted. */
    readonly accommodationId: string;
    /** Transaction to participate in, when the caller opened one. */
    readonly tx?: DrizzleClient;
    /** Service logger, so failures land in the same stream as the delete. */
    readonly logger: ServiceLogger;
}

/** What {@link cascadeCalendarConnectionsOnAccommodationDelete} did. */
export interface CascadeCalendarConnectionsResult {
    /** How many connections this call flipped from active to inactive. */
    readonly deactivated: number;
    /** Of those, how many the provider confirmed as revoked. */
    readonly revoked: number;
    /**
     * Of those, how many could NOT be revoked. Every one of them is recorded on
     * its row with {@link REVOCATION_FAILURE_PREFIX}.
     */
    readonly revocationFailures: number;
}

/**
 * Shuts down every active calendar connection of a just-soft-deleted
 * accommodation, and asks each provider to revoke the credential.
 *
 * Never throws: an accommodation delete must not fail over a dependent row.
 * Every failure is both logged and persisted on the connection row.
 *
 * @param input - Accommodation id, optional transaction, and the logger — see {@link CascadeCalendarConnectionsInput}.
 * @returns Counts of what was deactivated and revoked — see {@link CascadeCalendarConnectionsResult}.
 *
 * @example
 * ```ts
 * await cascadeCalendarConnectionsOnAccommodationDelete({
 *     accommodationId,
 *     tx: ctx.tx,
 *     logger: this.logger
 * });
 * ```
 */
export async function cascadeCalendarConnectionsOnAccommodationDelete(
    input: CascadeCalendarConnectionsInput
): Promise<CascadeCalendarConnectionsResult> {
    const { accommodationId, tx, logger } = input;
    const empty: CascadeCalendarConnectionsResult = {
        deactivated: 0,
        revoked: 0,
        revocationFailures: 0
    };

    let deactivatedConnections: Awaited<
        ReturnType<typeof accommodationCalendarSyncModel.deactivateAllByAccommodation>
    >;
    try {
        deactivatedConnections = await accommodationCalendarSyncModel.deactivateAllByAccommodation(
            { accommodationId },
            tx
        );
    } catch (error) {
        logger.error(
            { error, accommodationId },
            '[calendar-cascade] Failed to deactivate calendar connections for a soft-deleted accommodation; the cron-side deleted_at filter remains the active defence'
        );
        return empty;
    }

    if (deactivatedConnections.length === 0) {
        return empty;
    }

    const port = getCalendarConnectionRevocationPort();
    let revoked = 0;
    let revocationFailures = 0;

    for (const connection of deactivatedConnections) {
        const { provider } = connection;
        let outcome: CalendarConnectionRevocationResult;

        if (port === undefined) {
            outcome = { revoked: false, reason: 'no revocation adapter registered' };
        } else {
            try {
                outcome = await port.revoke({ accommodationId, provider });
            } catch (error) {
                outcome = {
                    revoked: false,
                    reason: `adapter threw: ${error instanceof Error ? error.message : String(error)}`
                };
            }
        }

        if (outcome.revoked) {
            revoked += 1;
            logger.info(
                { accommodationId, provider },
                '[calendar-cascade] Revoked calendar credential for a soft-deleted accommodation'
            );
            continue;
        }

        revocationFailures += 1;
        logger.error(
            { accommodationId, provider, reason: outcome.reason },
            `[calendar-cascade] ${REVOCATION_FAILURE_PREFIX}: the connection is deactivated but its credential may still be valid at the provider`
        );

        // Persist it. A failure that lives only in a log line is a failure
        // nobody will find when they need the list of still-live grants.
        try {
            await accommodationCalendarSyncModel.updateSyncState(
                {
                    accommodationId,
                    provider,
                    lastSyncAt: new Date(),
                    lastSyncStatus: CalendarSyncStatusEnum.ERROR,
                    lastErrorMessage: `${REVOCATION_FAILURE_PREFIX}: ${outcome.reason}`
                },
                tx
            );
        } catch (error) {
            logger.error(
                { error, accommodationId, provider },
                '[calendar-cascade] Could not record the revocation failure on the connection row'
            );
        }
    }

    return { deactivated: deactivatedConnections.length, revoked, revocationFailures };
}
