/**
 * SearchHistoryService — SPEC-289 Phase 2
 *
 * Manages the `user_search_history` table:
 *   - Recording new search entries (append-only, fire-and-forget safe).
 *   - Listing entries capped to the actor's plan limit.
 *   - Deleting one entry (owner-scoped hard delete).
 *   - Clearing all entries for the actor (hard delete).
 *
 * Design notes:
 *  - Extends `BaseService` rather than `BaseCrudService` because the entity is
 *    append-only (no soft-delete, no lifecycle, no admin search surface).
 *  - Opt-out: `settings.searchHistoryEnabled` is checked inside `record()` so
 *    the write-hook in the accommodation list route stays thin and fire-and-forget
 *    safe.
 *  - Trim: after each insert, entries beyond the global hard cap (200) are
 *    hard-deleted using a raw SQL `NOT IN` subquery for efficiency.
 *
 * @module services/userSearchHistory
 */
import { UserModel, type UserSearchHistoryModel, userSearchHistoryModel } from '@repo/db';
import type { SearchHistoryFilters, UserSearchHistoryEntry } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Largest plan cap across all tiers (VIP = 200).
 * Used as the storage trim bound after each record insert.
 */
const HARD_CAP = 200;

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/**
 * Input for {@link SearchHistoryService.record}.
 */
export const RecordSearchHistoryInputSchema = z.object({
    /** Free-text query component (`q` parameter). `null` when absent. */
    queryText: z.string().nullable(),
    /** Structured filter snapshot. `null` when no filters were applied. */
    filters: z
        .object({
            destinationId: z.string().uuid().optional(),
            minPrice: z.number().optional(),
            maxPrice: z.number().optional(),
            currency: z.string().optional(),
            minGuests: z.number().optional(),
            maxGuests: z.number().optional(),
            minBedrooms: z.number().optional(),
            maxBedrooms: z.number().optional(),
            minBathrooms: z.number().optional(),
            maxBathrooms: z.number().optional(),
            minRating: z.number().optional(),
            maxRating: z.number().optional(),
            isFeatured: z.boolean().optional(),
            isAvailable: z.boolean().optional(),
            hasPool: z.boolean().optional(),
            hasWifi: z.boolean().optional(),
            allowsPets: z.boolean().optional(),
            hasParking: z.boolean().optional(),
            type: z.string().optional(),
            types: z.array(z.string()).optional(),
            amenities: z.array(z.string().uuid()).optional(),
            features: z.array(z.string().uuid()).optional(),
            checkIn: z.coerce.date().optional(),
            checkOut: z.coerce.date().optional()
        })
        .nullable(),
    /** Number of results returned at search time. `null` if unavailable. */
    resultCount: z.number().int().nullable()
});

export type RecordSearchHistoryInput = z.infer<typeof RecordSearchHistoryInputSchema>;

/**
 * Input for {@link SearchHistoryService.list}.
 */
export const ListSearchHistoryInputSchema = z.object({
    /** Maximum number of entries to return (from the actor's plan limit). */
    planLimit: z.number().int().positive()
});

export type ListSearchHistoryInput = z.infer<typeof ListSearchHistoryInputSchema>;

/**
 * Output of {@link SearchHistoryService.list}.
 */
export interface ListSearchHistoryOutput {
    readonly entries: readonly UserSearchHistoryEntry[];
    readonly total: number;
}

/**
 * Input for {@link SearchHistoryService.deleteOne}.
 */
export const DeleteOneSearchHistoryInputSchema = z.object({
    /** Entry UUID to hard-delete. */
    id: z.string().uuid()
});

export type DeleteOneSearchHistoryInput = z.infer<typeof DeleteOneSearchHistoryInputSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Service for recording and managing a user's accommodation search history.
 *
 * All mutations are hard-deletes (no soft-delete). Opt-out is read from
 * `users.settings.searchHistoryEnabled` and checked inside `record()`.
 */
export class SearchHistoryService extends BaseService {
    static readonly ENTITY_NAME = 'userSearchHistory';
    protected override readonly entityName = SearchHistoryService.ENTITY_NAME;

    private readonly model: UserSearchHistoryModel;
    private readonly userModel: UserModel;

    constructor(config: ServiceConfig, model?: UserSearchHistoryModel, userModel?: UserModel) {
        super(config, SearchHistoryService.ENTITY_NAME);
        this.model = model ?? userSearchHistoryModel;
        this.userModel = userModel ?? new UserModel();
    }

    // -------------------------------------------------------------------------
    // record
    // -------------------------------------------------------------------------

    /**
     * Records a new search entry for the actor.
     *
     * Respects the opt-out preference (`settings.searchHistoryEnabled`): if the
     * user has set it to `false`, this is a no-op. Safe to call fire-and-forget —
     * never throws; errors are caught and returned as `ServiceOutput.error`.
     *
     * After inserting, trims the user's rows beyond {@link HARD_CAP} (200) to
     * bound storage.
     *
     * @param actor - The authenticated actor performing the search.
     * @param input - Query text, storable filters, and result count.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ recorded: true }` when a row was inserted, `{ recorded: false }` when skipped.
     */
    public async record(
        actor: Actor,
        input: RecordSearchHistoryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ recorded: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'record',
            input: { ...input, actor },
            schema: RecordSearchHistoryInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                // Opt-out check: read the user's settings from the DB.
                const user = await this.userModel.findById(validatedActor.id, execCtx.tx);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                const settings = (user.settings as Record<string, unknown>) ?? {};
                // `searchHistoryEnabled` defaults to `true` when absent.
                if (settings.searchHistoryEnabled === false) {
                    return { recorded: false };
                }

                // Insert the entry.
                await this.model.create(
                    {
                        userId: validatedActor.id,
                        queryText: validated.queryText,
                        filtersJson: validated.filters as SearchHistoryFilters | null,
                        resultCount: validated.resultCount
                    },
                    execCtx.tx
                );

                // Trim entries beyond the hard cap using a raw sub-select DELETE.
                await this.model.raw(
                    sql`DELETE FROM user_search_history
                        WHERE user_id = ${validatedActor.id}::uuid
                        AND id NOT IN (
                            SELECT id FROM user_search_history
                            WHERE user_id = ${validatedActor.id}::uuid
                            ORDER BY created_at DESC
                            LIMIT ${HARD_CAP}
                        )`,
                    execCtx.tx
                );

                return { recorded: true };
            }
        });
    }

    // -------------------------------------------------------------------------
    // list
    // -------------------------------------------------------------------------

    /**
     * Returns the most recent search entries for the actor, newest first.
     *
     * The number of entries returned is `min(planLimit, stored)` so that
     * downgraded users (VIP→Plus) transparently see only the most recent N.
     *
     * @param actor - The authenticated actor.
     * @param input - `{ planLimit }` — maximum entries allowed by the actor's plan.
     * @param ctx - Optional service context.
     * @returns `{ entries, total }` — the capped list and the (uncapped) stored count.
     */
    public async list(
        actor: Actor,
        input: ListSearchHistoryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ListSearchHistoryOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { ...input, actor },
            schema: ListSearchHistoryInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                const { planLimit } = validated;

                const { items, total } = await this.model.findAll(
                    { userId: validatedActor.id },
                    {
                        page: 1,
                        pageSize: planLimit,
                        sortBy: 'createdAt',
                        sortOrder: 'desc'
                    },
                    undefined,
                    execCtx.tx
                );

                return { entries: items, total };
            }
        });
    }

    // -------------------------------------------------------------------------
    // deleteOne
    // -------------------------------------------------------------------------

    /**
     * Hard-deletes a single search history entry owned by the actor.
     *
     * Returns `NOT_FOUND` if the entry does not exist.
     * Returns `FORBIDDEN` if the entry belongs to a different user.
     *
     * @param actor - The authenticated actor.
     * @param input - `{ id }` — the UUID of the entry to delete.
     * @param ctx - Optional service context.
     * @returns `{ deleted: true }` on success.
     */
    public async deleteOne(
        actor: Actor,
        input: DeleteOneSearchHistoryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ deleted: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'deleteOne',
            input: { ...input, actor },
            schema: DeleteOneSearchHistoryInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                const entry = await this.model.findById(validated.id, execCtx.tx);

                if (!entry) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Search history entry ${validated.id} not found`
                    );
                }

                if (entry.userId !== validatedActor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: You can only delete your own search history entries'
                    );
                }

                // Include userId in the filter for DB-enforced ownership — closes
                // the read-then-delete TOCTOU window without an extra round-trip.
                const deleteCount = await this.model.hardDelete(
                    { id: validated.id, userId: validatedActor.id },
                    execCtx.tx
                );

                return { deleted: deleteCount > 0 };
            }
        });
    }

    // -------------------------------------------------------------------------
    // clearAll
    // -------------------------------------------------------------------------

    /**
     * Hard-deletes ALL search history entries for the actor.
     *
     * No-op (returns `{ deleted: 0 }`) when the actor has no entries.
     *
     * @param actor - The authenticated actor.
     * @param ctx - Optional service context.
     * @returns `{ deleted: N }` — count of rows removed.
     */
    public async clearAll(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ deleted: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'clearAll',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                // hardDelete returns the count of removed rows (0 when no entries exist).
                const deleted = await this.model.hardDelete(
                    { userId: validatedActor.id },
                    execCtx.tx
                );

                return { deleted };
            }
        });
    }
}
