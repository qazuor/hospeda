/**
 * iCal feed credential repository (HOS-162 Phase 3 — Layer C).
 *
 * Mirrors `google-calendar-credential.repository.ts` but is deliberately
 * SIMPLER: an iCal feed connection has no OAuth handshake, no refresh token,
 * and no expiry — it is a single user-supplied `.ics` URL treated as a
 * secret (it typically embeds a private, unguessable token, e.g. Airbnb's
 * `?s=...` query param) and stored through the same encrypted "access
 * token" columns the OAuth providers use on `accommodation_calendar_sync`.
 *
 * Like the Google repository, this module bridges the
 * encryption-AGNOSTIC `accommodation_calendar_sync` model (in `@repo/db`,
 * which stores/reads the token columns as opaque ciphertext) with apps/api's
 * `oauth-vault` crypto — every read here decrypts the stored feed URL; every
 * write encrypts it first. The model itself never sees plaintext, and this
 * module never issues raw SQL.
 *
 * `provider` is restricted to {@link IcalProvider} (`AIRBNB` / `BOOKING` /
 * `OTHER`) — the three non-Google `OccupancySourceEnum` values Phase 3
 * introduces — keyed by the table's `(accommodationId, provider)` unique
 * index, same as Google. A single accommodation may therefore hold up to
 * three independent iCal connections (one per provider) plus one Google
 * connection, all coexisting as separate rows.
 *
 * **SECURITY**: the decrypted `feedUrl` MUST NOT be logged anywhere in the
 * call stack — it is a credential (typically embeds a private access token
 * in its query string). This module never logs it.
 *
 * @module services/ical-calendar/ical-credential.repository
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import type { OccupancySourceEnum } from '@repo/schemas';
import { decryptSecret, encryptSecret } from '../../utils/oauth-vault.js';

/**
 * The subset of {@link OccupancySourceEnum} values valid as an iCal feed
 * provider (Phase 3). Excludes `MANUAL` (host-toggled, no connection row)
 * and `GOOGLE_CALENDAR` (OAuth, handled by the Google credential repository).
 */
export type IcalProvider =
    | OccupancySourceEnum.AIRBNB
    | OccupancySourceEnum.BOOKING
    | OccupancySourceEnum.OTHER;

/**
 * Decrypted iCal feed credential + connection state, as returned by
 * {@link getIcalCredential}.
 */
export interface IcalCredential {
    /** The decrypted `.ics` feed URL. MUST NOT be logged. */
    readonly feedUrl: string;
    /** Whether this connection is currently active. */
    readonly isActive: boolean;
    /** The host (or system actor) that created this connection — used to attribute sync-written occupancy rows. */
    readonly createdById: string;
}

/**
 * Input for {@link getIcalCredential}.
 */
export interface GetIcalCredentialInput {
    /** The accommodation to look up. */
    readonly accommodationId: string;
    /** The iCal provider (`AIRBNB` / `BOOKING` / `OTHER`). */
    readonly provider: IcalProvider;
}

/**
 * Input for {@link saveIcalConnection}.
 */
export interface SaveIcalConnectionInput {
    /** The accommodation being connected. */
    readonly accommodationId: string;
    /** The iCal provider (`AIRBNB` / `BOOKING` / `OTHER`). */
    readonly provider: IcalProvider;
    /** The plaintext `.ics` feed URL to encrypt and persist. MUST NOT be logged. */
    readonly feedUrl: string;
    /** The host (or system actor) establishing the connection. */
    readonly createdById: string;
}

/**
 * Reads and decrypts the iCal feed credential + connection state for an
 * accommodation + provider pair.
 *
 * @param input - The accommodation and provider to look up.
 * @returns The decrypted {@link IcalCredential}, or `null` when no connection
 * row exists for that accommodation + provider.
 *
 * @example
 * ```ts
 * const credential = await getIcalCredential({ accommodationId, provider: OccupancySourceEnum.AIRBNB });
 * if (credential?.isActive) {
 *   // Use credential.feedUrl — NEVER log it.
 * }
 * ```
 */
export async function getIcalCredential(
    input: GetIcalCredentialInput
): Promise<IcalCredential | null> {
    const { accommodationId, provider } = input;

    const row = await accommodationCalendarSyncModel.findByAccommodationAndProvider({
        accommodationId,
        provider
    });

    if (row === null) {
        return null;
    }

    const { plaintext: feedUrl } = decryptSecret({
        ciphertext: row.accessTokenCiphertext,
        iv: row.accessTokenIv,
        authTag: row.accessTokenAuthTag
    });

    return {
        feedUrl,
        isActive: row.isActive,
        createdById: row.createdById
    };
}

/**
 * Creates or re-establishes an iCal feed connection for an accommodation +
 * provider pair, encrypting the feed URL before delegating to the model's
 * idempotent {@link accommodationCalendarSyncModel.upsertConnection}.
 *
 * Unlike Google, there is no OAuth exchange, no calendar id, no refresh
 * token, and no token expiry — every one of those columns is explicitly
 * cleared/`null` on every save. `upsertConnection`'s `onConflictDoUpdate`
 * also resets `lastSyncStatus` back to `PENDING` and clears
 * `lastErrorMessage`, so re-pasting a corrected feed URL after a
 * broken-feed failure cleanly restarts the connection's sync state.
 *
 * @param input - The connection details + feed URL to persist.
 *
 * @example
 * ```ts
 * await saveIcalConnection({
 *   accommodationId,
 *   provider: OccupancySourceEnum.AIRBNB,
 *   feedUrl: 'https://www.airbnb.com/calendar/ical/12345.ics?s=abc',
 *   createdById: hostUserId,
 * });
 * ```
 */
export async function saveIcalConnection(input: SaveIcalConnectionInput): Promise<void> {
    const { accommodationId, provider, feedUrl, createdById } = input;

    const encrypted = encryptSecret({ plaintext: feedUrl });

    await accommodationCalendarSyncModel.upsertConnection({
        accommodationId,
        provider,
        externalCalendarId: null,
        accessTokenCiphertext: encrypted.ciphertext,
        accessTokenIv: encrypted.iv,
        accessTokenAuthTag: encrypted.authTag,
        refreshTokenCiphertext: null,
        refreshTokenIv: null,
        refreshTokenAuthTag: null,
        tokenScope: null,
        tokenExpiresAt: null,
        createdById
    });
}
