import type {
    AccommodationCalendarSync,
    CalendarSyncStatusEnum,
    OccupancySourceEnum
} from '@repo/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { accommodationCalendarSync } from '../../schemas/accommodation/accommodationCalendarSync.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the `accommodation_calendar_sync` table (HOS-157 Phase 2 — Google
 * Calendar sync DB foundation).
 *
 * Encryption-agnostic: every method that touches the `access_token_*` /
 * `refresh_token_*` columns stores/reads them as OPAQUE ciphertext strings.
 * This model never encrypts or decrypts — that is the exclusive
 * responsibility of apps/api's OAuth vault, which calls this model with
 * already-encrypted values and decrypts what it reads back.
 *
 * Extends `BaseModelImpl` for the generic CRUD surface, plus six
 * domain-specific methods:
 *
 * - {@link findByAccommodationAndProvider} — the primary lookup, keyed by the
 *   `(accommodationId, provider)` unique index.
 * - {@link upsertConnection} — idempotent connect/reconnect, backs the OAuth
 *   callback (a later layer).
 * - {@link updateSyncState} — called after every sync run; never touches
 *   token columns.
 * - {@link updateTokens} — called after a token refresh; never touches sync
 *   state columns.
 * - {@link deactivate} / {@link deleteConnection} — the two disconnect
 *   variants (soft vs hard).
 * - {@link deactivateAllByAccommodation} — the delete-time cascade's WRITE
 *   (HOS-663); {@link findAllByAccommodation} is the set it revokes, which is
 *   deliberately wider.
 * - {@link markRevocationFailed} — records a grant we could not close.
 * - {@link findAllActiveByProvider} — the cron's iteration entry point.
 */
export class AccommodationCalendarSyncModel extends BaseModelImpl<AccommodationCalendarSync> {
    protected table = accommodationCalendarSync;
    public entityName = 'accommodationCalendarSync';

    protected override readonly validRelationKeys = ['accommodation', 'createdBy'] as const;

    protected getTableName(): string {
        return 'accommodationCalendarSync';
    }

    /**
     * Finds the connection row for an accommodation + provider pair, if any.
     *
     * @param params.accommodationId - The accommodation to look up.
     * @param params.provider - The calendar provider (Phase 2: `GOOGLE_CALENDAR`).
     * @param tx - Optional transaction client.
     * @returns The connection row, or `null` if none exists.
     */
    async findByAccommodationAndProvider(
        params: { accommodationId: string; provider: OccupancySourceEnum },
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync | null> {
        const { accommodationId, provider } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId, provider };

        try {
            const rows = await db
                .select()
                .from(accommodationCalendarSync)
                .where(
                    and(
                        eq(accommodationCalendarSync.accommodationId, accommodationId),
                        eq(accommodationCalendarSync.provider, provider)
                    )
                )
                .limit(1);

            const row = (rows[0] as AccommodationCalendarSync | undefined) ?? null;
            try {
                logQuery(this.entityName, 'findByAccommodationAndProvider', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByAccommodationAndProvider', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'findByAccommodationAndProvider',
                logContext,
                err.message
            );
        }
    }

    /**
     * Creates or re-establishes a calendar connection for an accommodation +
     * provider pair.
     *
     * Idempotent on `(accommodationId, provider)` via
     * `onConflictDoUpdate` — a re-connect (host re-runs the OAuth consent
     * flow) overwrites the tokens and calendar id in place rather than
     * failing on the unique index or creating a duplicate row. Reconnecting
     * resets `lastSyncStatus` back to `PENDING` and clears `syncToken` /
     * `lastErrorMessage` (a fresh connection has no incremental sync state
     * yet) and sets `isActive` back to `true`.
     *
     * @param params.accommodationId - The accommodation being connected.
     * @param params.provider - The calendar provider (Phase 2: `GOOGLE_CALENDAR`).
     * @param params.externalCalendarId - The Google calendar id (e.g. `'primary'`).
     * @param params.accessTokenCiphertext - Already-encrypted access token.
     * @param params.accessTokenIv - Access token encryption IV.
     * @param params.accessTokenAuthTag - Access token encryption auth tag.
     * @param params.refreshTokenCiphertext - Already-encrypted refresh token, if issued.
     * @param params.refreshTokenIv - Refresh token encryption IV, if issued.
     * @param params.refreshTokenAuthTag - Refresh token encryption auth tag, if issued.
     * @param params.tokenScope - OAuth scope(s) granted, as reported by Google.
     * @param params.tokenExpiresAt - Access token expiry, as reported by Google.
     * @param params.createdById - The host (or system actor) establishing the connection.
     * @param tx - Optional transaction client.
     * @returns The upserted connection row.
     */
    async upsertConnection(
        params: UpsertConnectionInput,
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync> {
        const {
            accommodationId,
            provider,
            externalCalendarId,
            accessTokenCiphertext,
            accessTokenIv,
            accessTokenAuthTag,
            refreshTokenCiphertext,
            refreshTokenIv,
            refreshTokenAuthTag,
            tokenScope,
            tokenExpiresAt,
            createdById
        } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId, provider };
        const now = new Date();

        const sharedColumns = {
            externalCalendarId: externalCalendarId ?? null,
            accessTokenCiphertext,
            accessTokenIv,
            accessTokenAuthTag,
            refreshTokenCiphertext: refreshTokenCiphertext ?? null,
            refreshTokenIv: refreshTokenIv ?? null,
            refreshTokenAuthTag: refreshTokenAuthTag ?? null,
            tokenScope: tokenScope ?? null,
            tokenExpiresAt: tokenExpiresAt ?? null
        };

        try {
            const rows = await db
                .insert(accommodationCalendarSync)
                .values({
                    accommodationId,
                    provider,
                    ...sharedColumns,
                    lastSyncStatus: 'PENDING',
                    isActive: true,
                    createdById,
                    createdAt: now,
                    updatedAt: now
                })
                .onConflictDoUpdate({
                    target: [
                        accommodationCalendarSync.accommodationId,
                        accommodationCalendarSync.provider
                    ],
                    set: {
                        ...sharedColumns,
                        // A fresh (re-)connection has no incremental sync state yet.
                        syncToken: null,
                        lastSyncStatus: 'PENDING',
                        lastErrorMessage: null,
                        isActive: true,
                        updatedAt: now
                    }
                })
                .returning();

            const row = rows[0];
            if (!row) {
                throw new Error(
                    `upsertConnection returned no row for accommodation=${accommodationId} provider=${provider} — unexpected database state`
                );
            }

            try {
                logQuery(this.entityName, 'upsertConnection', logContext, row);
            } catch {}
            return row as AccommodationCalendarSync;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'upsertConnection', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'upsertConnection', logContext, err.message);
        }
    }

    /**
     * Updates the sync-state columns after a sync run, WITHOUT touching any
     * token column. Called by the sync service after every attempt
     * (success or failure).
     *
     * @param params.accommodationId - The accommodation whose connection ran a sync.
     * @param params.provider - The calendar provider.
     * @param params.syncToken - The new incremental sync token, when the run advanced it.
     *   Omit (`undefined`) to leave the stored token unchanged.
     * @param params.lastSyncAt - Timestamp of this sync attempt.
     * @param params.lastSyncStatus - Outcome of this sync attempt (`OK` or `ERROR`).
     * @param params.lastErrorMessage - Error detail when `lastSyncStatus` is `ERROR`.
     *   Pass `null` explicitly to clear a previous error on a successful run.
     * @param tx - Optional transaction client.
     * @returns The updated row, or `null` if no matching connection exists.
     */
    async updateSyncState(
        params: UpdateSyncStateInput,
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync | null> {
        const {
            accommodationId,
            provider,
            syncToken,
            lastSyncAt,
            lastSyncStatus,
            lastErrorMessage
        } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId, provider, lastSyncStatus };

        try {
            const rows = await db
                .update(accommodationCalendarSync)
                .set({
                    ...(syncToken === undefined ? {} : { syncToken }),
                    lastSyncAt,
                    lastSyncStatus,
                    ...(lastErrorMessage === undefined ? {} : { lastErrorMessage }),
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(accommodationCalendarSync.accommodationId, accommodationId),
                        eq(accommodationCalendarSync.provider, provider)
                    )
                )
                .returning();

            const row = (rows[0] as AccommodationCalendarSync | undefined) ?? null;
            try {
                logQuery(this.entityName, 'updateSyncState', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'updateSyncState', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'updateSyncState', logContext, err.message);
        }
    }

    /**
     * Updates the encrypted token columns after a token refresh, WITHOUT
     * touching any sync-state column (`syncToken`, `lastSyncAt`,
     * `lastSyncStatus`, `lastErrorMessage`).
     *
     * @param params.accommodationId - The accommodation whose token was refreshed.
     * @param params.provider - The calendar provider.
     * @param params.accessTokenCiphertext - The newly-encrypted access token.
     * @param params.accessTokenIv - Access token encryption IV.
     * @param params.accessTokenAuthTag - Access token encryption auth tag.
     * @param params.refreshTokenCiphertext - The newly-encrypted refresh token, if rotated.
     * @param params.refreshTokenIv - Refresh token encryption IV, if rotated.
     * @param params.refreshTokenAuthTag - Refresh token encryption auth tag, if rotated.
     * @param params.tokenScope - Updated OAuth scope(s), if changed.
     * @param params.tokenExpiresAt - New access token expiry.
     * @param tx - Optional transaction client.
     * @returns void.
     */
    async updateTokens(params: UpdateTokensInput, tx?: DrizzleClient): Promise<void> {
        const {
            accommodationId,
            provider,
            accessTokenCiphertext,
            accessTokenIv,
            accessTokenAuthTag,
            refreshTokenCiphertext,
            refreshTokenIv,
            refreshTokenAuthTag,
            tokenScope,
            tokenExpiresAt
        } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId, provider };

        try {
            await db
                .update(accommodationCalendarSync)
                .set({
                    accessTokenCiphertext,
                    accessTokenIv,
                    accessTokenAuthTag,
                    ...(refreshTokenCiphertext === undefined ? {} : { refreshTokenCiphertext }),
                    ...(refreshTokenIv === undefined ? {} : { refreshTokenIv }),
                    ...(refreshTokenAuthTag === undefined ? {} : { refreshTokenAuthTag }),
                    ...(tokenScope === undefined ? {} : { tokenScope }),
                    ...(tokenExpiresAt === undefined ? {} : { tokenExpiresAt }),
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(accommodationCalendarSync.accommodationId, accommodationId),
                        eq(accommodationCalendarSync.provider, provider)
                    )
                );

            try {
                logQuery(this.entityName, 'updateTokens', logContext, null);
            } catch {}
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'updateTokens', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'updateTokens', logContext, err.message);
        }
    }

    /**
     * Soft-disconnects a calendar connection: sets `isActive=false` and
     * leaves the row (including its tokens) in place for audit. The cron's
     * {@link findAllActiveByProvider} will no longer pick this row up.
     *
     * Use this over {@link deleteConnection} when the disconnect should be
     * auditable/reversible (e.g. host-initiated disconnect from the UI).
     *
     * @param params.accommodationId - The accommodation to disconnect.
     * @param params.provider - The calendar provider.
     * @param tx - Optional transaction client.
     * @returns The updated row, or `null` if no matching connection exists.
     */
    async deactivate(
        params: { accommodationId: string; provider: OccupancySourceEnum },
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync | null> {
        const { accommodationId, provider } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId, provider };

        try {
            const rows = await db
                .update(accommodationCalendarSync)
                .set({ isActive: false, updatedAt: new Date() })
                .where(
                    and(
                        eq(accommodationCalendarSync.accommodationId, accommodationId),
                        eq(accommodationCalendarSync.provider, provider)
                    )
                )
                .returning();

            const row = (rows[0] as AccommodationCalendarSync | undefined) ?? null;
            try {
                logQuery(this.entityName, 'deactivate', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'deactivate', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'deactivate', logContext, err.message);
        }
    }

    /**
     * Hard-deletes a calendar connection row entirely (tokens included).
     *
     * Use this over {@link deactivate} when the connection must be fully
     * forgotten (e.g. GDPR-style erasure, or a broken/unrecoverable
     * connection the host is replacing from scratch).
     *
     * ## Revoke BEFORE calling this (HOS-663)
     *
     * Destroying our copy of a token is not the same as closing the grant.
     * Once this row is gone the ciphertext is gone with it, so the provider-side
     * grant can no longer be revoked by anyone, ever — not even by a later
     * manual cleanup. A caller that erases a connection without revoking first
     * leaves the host's calendar permanently reachable by a credential nobody
     * can point at any more, which is strictly worse than the soft path.
     *
     * @param params.accommodationId - The accommodation to disconnect.
     * @param params.provider - The calendar provider.
     * @param tx - Optional transaction client.
     * @returns The number of rows deleted (0 or 1).
     */
    async deleteConnection(
        params: { accommodationId: string; provider: OccupancySourceEnum },
        tx?: DrizzleClient
    ): Promise<number> {
        const { accommodationId, provider } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId, provider };

        try {
            const rows = await db
                .delete(accommodationCalendarSync)
                .where(
                    and(
                        eq(accommodationCalendarSync.accommodationId, accommodationId),
                        eq(accommodationCalendarSync.provider, provider)
                    )
                )
                .returning();

            try {
                logQuery(this.entityName, 'deleteConnection', logContext, rows.length);
            } catch {}
            return rows.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'deleteConnection', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'deleteConnection', logContext, err.message);
        }
    }

    /**
     * Deactivates EVERY currently-active connection of one accommodation, for
     * every provider at once, in a single statement (HOS-663).
     *
     * Backs the delete-time cascade: soft-deleting an accommodation leaves its
     * calendar connections `is_active = true`, so the sync crons keep fetching
     * the remote feed and writing occupancy for a listing nobody can see —
     * measured in production as 311 of 324 occupancy rows belonging to deleted
     * listings, with the host's encrypted OAuth tokens still in active use.
     *
     * Deliberately filtered on `isActive = true` and `RETURNING`-based, so the
     * result is exactly the set of connections this call CHANGED — a second
     * call returns `[]`, which makes the write idempotent.
     *
     * That set is NOT the set to revoke. An inactive row is not a revoked row:
     * the only path that deactivates without deleting the accommodation is the
     * host-initiated disconnect route, and it revokes nothing — it just flips
     * `is_active` and leaves the tokens where they are. A host who disconnects
     * and later deletes would otherwise walk away with a live grant and no
     * trace of it anywhere. Revocation therefore iterates
     * {@link findAllByAccommodation}, which does not filter on `isActive`.
     *
     * Soft, not hard: this mirrors {@link deactivate} (the host-initiated
     * disconnect) and the sibling conversation cascade on the same hook, both
     * of which keep the row for audit. An accommodation soft-delete is
     * reversible, so its cascade is reversible too.
     *
     * @param params.accommodationId - The accommodation whose connections to deactivate.
     * @param tx - Optional transaction client.
     * @returns The rows this call flipped from active to inactive (possibly empty).
     */
    async deactivateAllByAccommodation(
        params: { accommodationId: string },
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync[]> {
        const { accommodationId } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId };

        try {
            const rows = await db
                .update(accommodationCalendarSync)
                .set({ isActive: false, updatedAt: new Date() })
                .where(
                    and(
                        eq(accommodationCalendarSync.accommodationId, accommodationId),
                        eq(accommodationCalendarSync.isActive, true)
                    )
                )
                .returning();

            try {
                logQuery(this.entityName, 'deactivateAllByAccommodation', logContext, rows);
            } catch {}
            return rows as AccommodationCalendarSync[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'deactivateAllByAccommodation', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'deactivateAllByAccommodation',
                logContext,
                err.message
            );
        }
    }

    /**
     * Finds EVERY connection row of one accommodation, active or not (HOS-663).
     *
     * The absence of an `isActive` filter is the whole point. Revocation has to
     * iterate this, not {@link deactivateAllByAccommodation}'s return value:
     * `is_active = false` means "we stopped using it", never "the provider
     * closed it". The host-initiated disconnect route flips the flag and
     * revokes nothing, so the inactive rows are precisely the ones whose grants
     * have been quietly outliving their listing.
     *
     * @param params.accommodationId - The accommodation whose connections to read.
     * @param tx - Optional transaction client.
     * @returns Every connection row for that accommodation (possibly empty).
     */
    async findAllByAccommodation(
        params: { accommodationId: string },
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync[]> {
        const { accommodationId } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId };

        try {
            const rows = await db
                .select()
                .from(accommodationCalendarSync)
                .where(eq(accommodationCalendarSync.accommodationId, accommodationId));

            try {
                logQuery(this.entityName, 'findAllByAccommodation', logContext, rows);
            } catch {}
            return rows as AccommodationCalendarSync[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAllByAccommodation', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAllByAccommodation', logContext, err.message);
        }
    }

    /**
     * Records that a connection's credential could NOT be revoked at the
     * provider (HOS-663).
     *
     * Separate from {@link updateSyncState} on purpose, even though it writes
     * two of the same columns. `updateSyncState` also stamps `lastSyncAt`, and
     * a revocation is not a sync: stamping it would claim the connection was
     * read at a moment it was not, and `last_sync_at` is one of the columns the
     * forensic query that FOUND this bug relied on. Truthfulness of that column
     * is worth a second method.
     *
     * @param params.accommodationId - The accommodation whose connection failed to revoke.
     * @param params.provider - The calendar provider.
     * @param params.errorMessage - The already-composed, credential-free reason to persist.
     * @param tx - Optional transaction client.
     * @returns The updated row, or `null` if no matching connection exists.
     */
    async markRevocationFailed(
        params: { accommodationId: string; provider: OccupancySourceEnum; errorMessage: string },
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync | null> {
        const { accommodationId, provider, errorMessage } = params;
        const db = this.getClient(tx);
        const logContext = { accommodationId, provider };

        try {
            const rows = await db
                .update(accommodationCalendarSync)
                .set({
                    lastSyncStatus: 'ERROR',
                    lastErrorMessage: errorMessage,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(accommodationCalendarSync.accommodationId, accommodationId),
                        eq(accommodationCalendarSync.provider, provider)
                    )
                )
                .returning();

            const row = (rows[0] as AccommodationCalendarSync | undefined) ?? null;
            try {
                logQuery(this.entityName, 'markRevocationFailed', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'markRevocationFailed', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'markRevocationFailed', logContext, err.message);
        }
    }

    /**
     * Finds every active connection for a given provider, across all
     * accommodations. Backs the sync cron's iteration entry point — it loops
     * over the returned rows and runs a sync for each.
     *
     * ## Soft-deleted accommodations are excluded (HOS-663)
     *
     * The join on `accommodations` with `deleted_at IS NULL` is the SECOND of
     * two independent defences, not a duplicate of the first. The delete-time
     * cascade (`AccommodationService._afterSoftDelete`) is best-effort by
     * design — it must never fail a delete over a dependent row — so on its own
     * it leaves a hole whenever it does not run: a delete that predates this
     * fix, a delete performed straight against the model or in SQL, or a
     * cascade that threw. This condition closes that hole for every one of
     * those cases at once, including the rows already wrong in production,
     * because it is enforced where the cron READS rather than where the delete
     * WRITES.
     *
     * `accommodation_calendar_sync` has no `deleted_at` of its own (see the
     * table's schema doc), so the liveness of a connection is the liveness of
     * its accommodation — there is no second column here that could disagree.
     *
     * @param params.provider - The calendar provider to iterate (Phase 2: `GOOGLE_CALENDAR`).
     * @param tx - Optional transaction client.
     * @returns All rows with `isActive=true` for the given provider whose accommodation is NOT soft-deleted.
     */
    async findAllActiveByProvider(
        params: { provider: OccupancySourceEnum },
        tx?: DrizzleClient
    ): Promise<AccommodationCalendarSync[]> {
        const { provider } = params;
        const db = this.getClient(tx);
        const logContext = { provider };

        try {
            const rows = await db
                .select({ connection: accommodationCalendarSync })
                .from(accommodationCalendarSync)
                .innerJoin(
                    accommodations,
                    eq(accommodations.id, accommodationCalendarSync.accommodationId)
                )
                .where(
                    and(
                        eq(accommodationCalendarSync.provider, provider),
                        eq(accommodationCalendarSync.isActive, true),
                        isNull(accommodations.deletedAt)
                    )
                );

            const connections = rows.map((row) => row.connection) as AccommodationCalendarSync[];

            try {
                logQuery(this.entityName, 'findAllActiveByProvider', logContext, connections);
            } catch {}
            return connections;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAllActiveByProvider', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAllActiveByProvider', logContext, err.message);
        }
    }
}

// ---------------------------------------------------------------------------
// Supplementary types
// ---------------------------------------------------------------------------

/** Input shape for {@link AccommodationCalendarSyncModel.upsertConnection}. */
export interface UpsertConnectionInput {
    readonly accommodationId: string;
    readonly provider: OccupancySourceEnum;
    readonly externalCalendarId?: string | null;
    readonly accessTokenCiphertext: string;
    readonly accessTokenIv: string;
    readonly accessTokenAuthTag: string;
    readonly refreshTokenCiphertext?: string | null;
    readonly refreshTokenIv?: string | null;
    readonly refreshTokenAuthTag?: string | null;
    readonly tokenScope?: string | null;
    readonly tokenExpiresAt?: Date | null;
    readonly createdById: string;
}

/** Input shape for {@link AccommodationCalendarSyncModel.updateSyncState}. */
export interface UpdateSyncStateInput {
    readonly accommodationId: string;
    readonly provider: OccupancySourceEnum;
    readonly syncToken?: string | null;
    readonly lastSyncAt: Date;
    readonly lastSyncStatus: CalendarSyncStatusEnum;
    readonly lastErrorMessage?: string | null;
}

/** Input shape for {@link AccommodationCalendarSyncModel.updateTokens}. */
export interface UpdateTokensInput {
    readonly accommodationId: string;
    readonly provider: OccupancySourceEnum;
    readonly accessTokenCiphertext: string;
    readonly accessTokenIv: string;
    readonly accessTokenAuthTag: string;
    readonly refreshTokenCiphertext?: string | null;
    readonly refreshTokenIv?: string | null;
    readonly refreshTokenAuthTag?: string | null;
    readonly tokenScope?: string | null;
    readonly tokenExpiresAt?: Date | null;
}

/** Singleton instance of AccommodationCalendarSyncModel for use across the application. */
export const accommodationCalendarSyncModel = new AccommodationCalendarSyncModel();
