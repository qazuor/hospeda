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
 * connection of the accommodation is handed to
 * {@link CalendarConnectionRevocationPort}, which lives in `apps/api` (it needs
 * the OAuth vault and the provider HTTP clients, neither of which belongs in
 * this package) and is registered at API startup.
 *
 * **Every connection, not every connection this call deactivated.** Those are
 * different sets, and the difference is a hole big enough to lose the point of
 * the issue through. `is_active = false` means "we stopped using it", never
 * "the provider closed it": the host-initiated disconnect route flips the flag
 * and revokes nothing. So a host who disconnects their Google calendar and
 * deletes the listing a week later would, if revocation followed the flipped
 * set, keep a live refresh token at Google indefinitely — and with no active
 * row left to make it visible, more quietly than the bug that was reported.
 * That is why the revocation loop reads `findAllByAccommodation`.
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
import type { OccupancySourceEnum } from '@repo/schemas';
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
    /**
     * How many grants the provider confirmed as closed. Counted over EVERY
     * connection of the accommodation, not only the ones {@link deactivated}
     * counts — an already-inactive row still holds an unrevoked credential.
     */
    readonly revoked: number;
    /**
     * How many could NOT be revoked. Every one of them is recorded on its row
     * with {@link REVOCATION_FAILURE_PREFIX}.
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

    // ---- 1. The write. Joins the caller's transaction when there is one. ----
    let deactivated = 0;
    try {
        const flipped = await accommodationCalendarSyncModel.deactivateAllByAccommodation(
            { accommodationId },
            tx
        );
        deactivated = flipped.length;
    } catch (error) {
        logger.error(
            { error, accommodationId },
            '[calendar-cascade] Failed to deactivate calendar connections for a soft-deleted accommodation; the cron-side deleted_at filter remains the active defence'
        );
        // Deliberately falls through rather than returning: the deactivation
        // failing is exactly when the grants most need closing.
    }

    // ---- 2. The set to revoke is WIDER than the set just deactivated. ----
    //
    // `deactivateAllByAccommodation` returns only the rows it flipped, and an
    // already-inactive row is NOT an already-revoked one: the host-initiated
    // disconnect route flips `is_active` and revokes nothing. Revoking only the
    // flipped set means a host who disconnects first and deletes a week later
    // keeps a live refresh token at Google forever — with no active row to make
    // it visible, which is worse than the bug this cascade was written for.
    let connections: Awaited<
        ReturnType<typeof accommodationCalendarSyncModel.findAllByAccommodation>
    >;
    try {
        connections = await accommodationCalendarSyncModel.findAllByAccommodation(
            { accommodationId },
            tx
        );
    } catch (error) {
        logger.error(
            { error, accommodationId },
            '[calendar-cascade] Could not read the connection rows to revoke; their grants may still be live at the provider'
        );
        return { ...empty, deactivated };
    }

    if (connections.length === 0) {
        return { ...empty, deactivated };
    }

    // ---- 3. Revocation. OUTSIDE the caller's transaction, in parallel. ----
    //
    // No `tx` is forwarded past this point, and that is a rule rather than an
    // omission: these calls do outbound HTTP, and this repo's own "no HTTP in a
    // transaction" rule (see `destination-weather-fetch.job.ts`, and the note
    // in both calendar sync crons) exists because holding a Postgres
    // transaction open across a third-party round trip pins a connection for as
    // long as that third party feels like taking. Forwarding `tx` here reads
    // like participation and behaves like a pin. The failure stamps skip the
    // transaction for the same reason, and because a stamp that rolls back
    // takes the only record of an irreversible revocation with it.
    //
    // Parallel rather than serial: each revocation is independently bounded by
    // its own timeout, so N connections cost one timeout, not N. This is on the
    // synchronous path of the user's DELETE.
    const port = getCalendarConnectionRevocationPort();

    const outcomes = await Promise.all(
        connections.map(async ({ provider }) => {
            const outcome = await askPortToRevoke({ port, accommodationId, provider });
            return { provider, outcome };
        })
    );

    let revoked = 0;
    let revocationFailures = 0;

    for (const { provider, outcome } of outcomes) {
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
            await accommodationCalendarSyncModel.markRevocationFailed({
                accommodationId,
                provider,
                errorMessage: `${REVOCATION_FAILURE_PREFIX}: ${outcome.reason}`
            });
        } catch (error) {
            logger.error(
                { error, accommodationId, provider },
                '[calendar-cascade] Could not record the revocation failure on the connection row'
            );
        }
    }

    return { deactivated, revoked, revocationFailures };
}

/**
 * Calls the port for one connection and normalises every way it can go wrong
 * into a {@link CalendarConnectionRevocationResult}.
 *
 * The shape check is not paranoia about our own adapter: the port is a
 * registration hole any caller can fill, and reading `.revoked` off whatever
 * comes back would turn a malformed adapter into an uncaught `TypeError`
 * thrown out of `_afterSoftDelete` — a 500 on a DELETE whose row is already
 * gone. Anything that is not literally `{ revoked: true }` or a well-formed
 * failure is treated as a failure, so it gets recorded rather than crashing.
 *
 * @param input.port - The registered adapter, or `undefined` when none is.
 * @param input.accommodationId - The accommodation being closed out.
 * @param input.provider - The connection's provider.
 * @returns A well-formed outcome, always.
 */
async function askPortToRevoke(input: {
    readonly port: CalendarConnectionRevocationPort | undefined;
    readonly accommodationId: string;
    readonly provider: OccupancySourceEnum;
}): Promise<CalendarConnectionRevocationResult> {
    const { port, accommodationId, provider } = input;

    if (port === undefined) {
        return { revoked: false, reason: 'no revocation adapter registered' };
    }

    let raw: unknown;
    try {
        raw = await port.revoke({ accommodationId, provider });
    } catch (error) {
        return {
            revoked: false,
            reason: `adapter threw: ${error instanceof Error ? error.message : String(error)}`
        };
    }

    if (typeof raw !== 'object' || raw === null) {
        return { revoked: false, reason: 'adapter returned a malformed result' };
    }

    const result = raw as Partial<{ revoked: unknown; reason: unknown }>;
    if (result.revoked === true) {
        return { revoked: true };
    }
    if (result.revoked === false) {
        return {
            revoked: false,
            reason: typeof result.reason === 'string' ? result.reason : 'adapter gave no reason'
        };
    }
    return { revoked: false, reason: 'adapter returned a malformed result' };
}
