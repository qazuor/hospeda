/**
 * Google Calendar OAuth credential repository (HOS-157 Phase 2 — Layer 2).
 *
 * Bridges the encryption-AGNOSTIC `accommodation_calendar_sync` model (in
 * `@repo/db`, which stores/reads the token columns as opaque ciphertext) with
 * apps/api's `oauth-vault` crypto. Every read here decrypts the stored token
 * triplets; every write encrypts before delegating to the model. The model
 * itself never sees plaintext, and this module never issues raw SQL — it goes
 * exclusively through `accommodationCalendarSyncModel`.
 *
 * Unlike the MercadoLibre credential repository (one global row in
 * `external_oauth_credentials`), Google Calendar credentials are PER
 * ACCOMMODATION: keyed by `(accommodationId, provider=GOOGLE_CALENDAR)` via the
 * table's unique index. The idempotent connect/reconnect race handling lives in
 * the model's `upsertConnection` (`onConflictDoUpdate`), so this module stays a
 * thin encrypt/decrypt shim.
 *
 * ## Google refresh-token semantics
 *
 * Google's `refresh_token` grant does NOT return a new refresh token (see
 * `google-oauth-client.ts`). So {@link saveRefreshedGoogleTokens} accepts an
 * OPTIONAL refresh token and, when omitted, leaves the stored refresh-token
 * columns untouched (the model's `updateTokens` skips undefined columns). The
 * originally-issued refresh token stays valid across refreshes.
 *
 * **SECURITY**: the decrypted `accessToken`/`refreshToken` MUST NOT be logged
 * anywhere in the call stack. This module never logs them.
 *
 * @module services/google-calendar/google-calendar-credential.repository
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import { OccupancySourceEnum } from '@repo/schemas';
import { decryptSecret, encryptSecret } from '../../utils/oauth-vault.js';

/** The `provider` value for all Google Calendar connection rows. */
const GOOGLE_PROVIDER = OccupancySourceEnum.GOOGLE_CALENDAR;

/**
 * Decrypted Google Calendar OAuth credential + connection state, as returned by
 * {@link getGoogleCredential}.
 */
export interface GoogleCredential {
    /** Decrypted OAuth access token. MUST NOT be logged. */
    readonly accessToken: string;
    /**
     * Decrypted OAuth refresh token, or `null` when the connection has no
     * stored refresh token (e.g. a reconnect that did not re-prompt consent).
     * MUST NOT be logged. Without it, the access token cannot be refreshed.
     */
    readonly refreshToken: string | null;
    /**
     * Access token expiry as reported by Google, or `null` if unknown (treated
     * as "needs refresh" by the token service).
     */
    readonly expiresAt: Date | null;
    /** The external Google Calendar id (e.g. `'primary'`), or `null` before first connect. */
    readonly externalCalendarId: string | null;
    /** The Google Calendar incremental sync token (`nextSyncToken`), or `null` before first sync. */
    readonly syncToken: string | null;
    /** Whether this connection is currently active. */
    readonly isActive: boolean;
    /** The host (or system actor) that created this connection — used to attribute sync-written occupancy rows. */
    readonly createdById: string;
}

/**
 * Input for {@link saveRefreshedGoogleTokens}.
 */
export interface SaveRefreshedGoogleTokensInput {
    /** The accommodation whose token was refreshed. */
    readonly accommodationId: string;
    /** The newly-issued plaintext access token to encrypt and persist. MUST NOT be logged. */
    readonly accessToken: string;
    /**
     * The plaintext refresh token to persist, when Google issued a new one.
     * Omit (or `undefined`) to leave the stored refresh token unchanged —
     * Google's refresh grant does not return a new refresh token.
     */
    readonly refreshToken?: string;
    /** Updated OAuth scope(s), if changed. */
    readonly tokenScope?: string;
    /** New access token expiry, as reported by Google. */
    readonly tokenExpiresAt: Date;
}

/**
 * Input for {@link saveGoogleConnection}.
 */
export interface SaveGoogleConnectionInput {
    /** The accommodation being connected. */
    readonly accommodationId: string;
    /** The Google calendar id to sync (e.g. `'primary'`). */
    readonly externalCalendarId?: string | null;
    /** The plaintext access token to encrypt and persist. MUST NOT be logged. */
    readonly accessToken: string;
    /** The plaintext refresh token to encrypt and persist, if Google issued one. MUST NOT be logged. */
    readonly refreshToken?: string | null;
    /** OAuth scope(s) granted, as reported by Google. */
    readonly tokenScope?: string | null;
    /** Access token expiry, as reported by Google. */
    readonly tokenExpiresAt?: Date | null;
    /** The host (or system actor) establishing the connection. */
    readonly createdById: string;
}

/**
 * Reads and decrypts the Google Calendar credential + connection state for an
 * accommodation.
 *
 * @param params.accommodationId - The accommodation to look up.
 * @returns The decrypted {@link GoogleCredential}, or `null` when no Google
 * Calendar connection row exists for the accommodation.
 *
 * @example
 * ```ts
 * const credential = await getGoogleCredential({ accommodationId });
 * if (credential?.isActive) {
 *   // Use credential.accessToken — NEVER log it.
 * }
 * ```
 */
export async function getGoogleCredential(params: {
    accommodationId: string;
}): Promise<GoogleCredential | null> {
    const { accommodationId } = params;

    const row = await accommodationCalendarSyncModel.findByAccommodationAndProvider({
        accommodationId,
        provider: GOOGLE_PROVIDER
    });

    if (row === null) {
        return null;
    }

    const { plaintext: accessToken } = decryptSecret({
        ciphertext: row.accessTokenCiphertext,
        iv: row.accessTokenIv,
        authTag: row.accessTokenAuthTag
    });

    let refreshToken: string | null = null;
    if (
        row.refreshTokenCiphertext !== null &&
        row.refreshTokenIv !== null &&
        row.refreshTokenAuthTag !== null
    ) {
        refreshToken = decryptSecret({
            ciphertext: row.refreshTokenCiphertext,
            iv: row.refreshTokenIv,
            authTag: row.refreshTokenAuthTag
        }).plaintext;
    }

    return {
        accessToken,
        refreshToken,
        expiresAt: row.tokenExpiresAt ?? null,
        externalCalendarId: row.externalCalendarId ?? null,
        syncToken: row.syncToken ?? null,
        isActive: row.isActive,
        createdById: row.createdById
    };
}

/**
 * Persists a refreshed Google access token (and, only if Google issued one, a
 * new refresh token) for an accommodation, encrypting each secret first.
 *
 * Never touches sync-state columns. When {@link SaveRefreshedGoogleTokensInput.refreshToken}
 * is omitted, the stored refresh-token columns are left unchanged.
 *
 * @param input - The refreshed tokens + expiry to persist.
 *
 * @example
 * ```ts
 * await saveRefreshedGoogleTokens({
 *   accommodationId,
 *   accessToken: refreshed.accessToken,
 *   tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
 * });
 * ```
 */
export async function saveRefreshedGoogleTokens(
    input: SaveRefreshedGoogleTokensInput
): Promise<void> {
    const { accommodationId, accessToken, refreshToken, tokenScope, tokenExpiresAt } = input;

    const accessTokenEncrypted = encryptSecret({ plaintext: accessToken });

    const refreshTokenColumns =
        refreshToken === undefined
            ? {}
            : (() => {
                  const enc = encryptSecret({ plaintext: refreshToken });
                  return {
                      refreshTokenCiphertext: enc.ciphertext,
                      refreshTokenIv: enc.iv,
                      refreshTokenAuthTag: enc.authTag
                  };
              })();

    await accommodationCalendarSyncModel.updateTokens({
        accommodationId,
        provider: GOOGLE_PROVIDER,
        accessTokenCiphertext: accessTokenEncrypted.ciphertext,
        accessTokenIv: accessTokenEncrypted.iv,
        accessTokenAuthTag: accessTokenEncrypted.authTag,
        ...refreshTokenColumns,
        ...(tokenScope === undefined ? {} : { tokenScope }),
        tokenExpiresAt
    });
}

/**
 * Creates or re-establishes a Google Calendar connection for an accommodation,
 * encrypting the access (and, if issued, refresh) token before delegating to
 * the model's idempotent {@link upsertConnection}.
 *
 * Used by the OAuth callback route (Layer 4) after a successful
 * authorization-code exchange.
 *
 * @param input - The connection details + tokens to persist.
 *
 * @example
 * ```ts
 * await saveGoogleConnection({
 *   accommodationId,
 *   externalCalendarId: 'primary',
 *   accessToken: tokens.accessToken,
 *   refreshToken: tokens.refreshToken,
 *   tokenScope: tokens.scope,
 *   tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
 *   createdById: hostUserId,
 * });
 * ```
 */
export async function saveGoogleConnection(input: SaveGoogleConnectionInput): Promise<void> {
    const {
        accommodationId,
        externalCalendarId,
        accessToken,
        refreshToken,
        tokenScope,
        tokenExpiresAt,
        createdById
    } = input;

    const accessTokenEncrypted = encryptSecret({ plaintext: accessToken });

    const refreshTokenColumns =
        refreshToken === undefined || refreshToken === null
            ? {}
            : (() => {
                  const enc = encryptSecret({ plaintext: refreshToken });
                  return {
                      refreshTokenCiphertext: enc.ciphertext,
                      refreshTokenIv: enc.iv,
                      refreshTokenAuthTag: enc.authTag
                  };
              })();

    await accommodationCalendarSyncModel.upsertConnection({
        accommodationId,
        provider: GOOGLE_PROVIDER,
        externalCalendarId: externalCalendarId ?? null,
        accessTokenCiphertext: accessTokenEncrypted.ciphertext,
        accessTokenIv: accessTokenEncrypted.iv,
        accessTokenAuthTag: accessTokenEncrypted.authTag,
        ...refreshTokenColumns,
        tokenScope: tokenScope ?? null,
        tokenExpiresAt: tokenExpiresAt ?? null,
        createdById
    });
}
