import { type FindPartnerMentionsFilters, PartnerMentionModel, PartnerModel } from '@repo/db';
import {
    adminSearchPartnerMentionSchema,
    type CreatePartnerMentionBatch,
    createPartnerMentionBatchSchema,
    PARTNER_MENTION_ADMIN_ONLY_MASK,
    type PartnerMention,
    type PartnerMentionBatch,
    type PartnerMentionPublic,
    RoleEnum,
    requiresMentionUrl,
    ServiceErrorCode,
    type UpdatePartnerMention,
    updatePartnerMentionSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import {
    checkCanCreateMention,
    checkCanDeleteMention,
    checkCanListMentions,
    checkCanUpdateMention,
    checkCanViewMention
} from './partner-mention.permissions';

/**
 * Notified once per submission, after the rows are committed (HOS-377 AC-9).
 *
 * A port rather than a direct dependency, matching `PartnerRevokeNotifyPort`:
 * `apps/api` owns the notification transport, and a context that injects none
 * simply does not send — logging a mention must never depend on mail working.
 */
export type PartnerMentionNotifyPort = (input: {
    readonly partnerId: string;
    readonly batchId: string | null;
    readonly mentions: readonly PartnerMention[];
}) => Promise<void>;

/** Batch-create input, with the partner resolved from the URL path. */
export interface CreateMentionBatchInput extends CreatePartnerMentionBatch {
    readonly partnerId: string;
}

/**
 * One submission as the partner sees it: a date, and the channels it ran on.
 *
 * Aliased to the schema type rather than re-declared, so the HTTP contract the
 * route publishes and the shape this service builds cannot drift apart.
 */
export type PartnerMentionBatchView = PartnerMentionBatch;

/**
 * How many mentions the partner's own log loads at once.
 *
 * Not user-controllable: this view is a read-only history for one partner, and
 * an unbounded fetch on a page nobody paginates is how a heavy partner's account
 * page starts timing out years from now.
 */
const OWNER_LOG_PAGE_SIZE = 200;

/**
 * Resolves the actor to the account a partner may be owned by, or null.
 *
 * Mirrors `PartnerService`'s own resolver deliberately: an anonymous or guest
 * actor carries a sentinel id that is not a real `users` row, so returning null
 * keeps the ownership filter from ever being built out of a value that could
 * coincidentally match.
 */
const resolveMentionOwnerUserId = (actor: Actor): string | null => {
    const isAnonymous =
        actor.roles.length === 0 || actor.roles.every((role) => role === RoleEnum.GUEST);
    return isAnonymous ? null : actor.id;
};

/**
 * Removes the admin-only fields from a stored row.
 *
 * Deliberately a STRIP, not a `partnerMentionPublicSchema.parse()`. This is a
 * read path over rows that are already in the column, and validating them on the
 * way out means any row that fails — a legacy shape, a column widened later —
 * takes down the partner's entire log with a 500 instead of rendering. Hardening
 * a read contract is how a page that only displays data starts erroring.
 *
 * The field list is derived from `PARTNER_MENTION_ADMIN_ONLY_MASK`, so it cannot
 * drift from the schema-level definition of "what the partner must not see".
 */
const toPublicMention = (mention: PartnerMention): PartnerMentionPublic => {
    const stripped = { ...mention } as Record<string, unknown>;
    for (const field of Object.keys(PARTNER_MENTION_ADMIN_ONLY_MASK)) {
        delete stripped[field];
    }
    return stripped as unknown as PartnerMentionPublic;
};

/**
 * Refuses a mention that does not belong to the partner the caller named.
 *
 * Both mutating routes live under `/admin/partners/{partnerId}/mentions/{id}`,
 * where the two path segments are supplied independently: nothing about the URL
 * forces the mention to actually be that partner's. Without this check, a mention
 * id pasted under the wrong partner would be corrected or deleted anyway, and the
 * audit trail would record it against a partner it never belonged to.
 *
 * `PARTNER_MANAGE` is global, so this is not a privilege boundary — it is a
 * correctness one, which is why it throws NOT_FOUND rather than FORBIDDEN: as far
 * as the scope the caller asked about is concerned, the row genuinely is not
 * there, and a distinct error would confirm it exists under some other partner.
 */
const assertMentionBelongsTo = (mention: PartnerMention, partnerId: string): void => {
    if (mention.partnerId === partnerId) return;
    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Mention not found');
};

/**
 * Collapses a flat, newest-first mention list into batches.
 *
 * A campaign that ran on four networks is ONE thing that happened, so the
 * partner sees one entry with four links rather than four entries sharing a
 * date (AC-10). Un-batched mentions (`batchId === null`) each become their own
 * single-item batch, so the view has exactly one shape to render.
 *
 * Order is preserved from the query, so batches stay newest-promotion-first.
 */
const groupMentionsIntoBatches = (
    mentions: readonly PartnerMention[]
): PartnerMentionBatchView[] => {
    const batches: PartnerMentionBatchView[] = [];
    const byBatchId = new Map<string, PartnerMentionBatchView>();

    for (const mention of mentions) {
        const publicView = toPublicMention(mention);

        if (!mention.batchId) {
            batches.push({
                batchId: null,
                mentionedAt: mention.mentionedAt,
                mentions: [publicView]
            });
            continue;
        }

        const existing = byBatchId.get(mention.batchId);
        if (existing) {
            (existing.mentions as PartnerMentionPublic[]).push(publicView);
            continue;
        }

        const created: PartnerMentionBatchView = {
            batchId: mention.batchId,
            mentionedAt: mention.mentionedAt,
            mentions: [publicView]
        };
        byBatchId.set(mention.batchId, created);
        batches.push(created);
    }

    return batches;
};

/**
 * The partner mentions log (HOS-377).
 *
 * Deliberately its own service rather than methods on `PartnerService`, the same
 * way `partner_subscriptions` got its own schema instead of columns on
 * `partners`: mentions are a child collection with their own lifecycle, their own
 * permissions surface and their own notification.
 */
export class PartnerMentionService extends BaseCrudService<
    PartnerMention,
    PartnerMentionModel,
    typeof createPartnerMentionBatchSchema,
    typeof updatePartnerMentionSchema,
    typeof adminSearchPartnerMentionSchema
> {
    static readonly ENTITY_NAME = 'partnerMention';
    protected readonly entityName = PartnerMentionService.ENTITY_NAME;
    protected readonly model: PartnerMentionModel;

    protected readonly createSchema = createPartnerMentionBatchSchema;
    protected readonly updateSchema = updatePartnerMentionSchema;
    protected readonly searchSchema = adminSearchPartnerMentionSchema;

    protected getDefaultListRelations() {
        return {};
    }

    /** Fired once per committed batch, or null when no transport was injected. */
    private readonly notifier: PartnerMentionNotifyPort | null;

    /** Used only to resolve the caller's own partner in {@link listForOwner}. */
    private readonly partnerModel: PartnerModel;

    constructor(
        ctx: ServiceConfig & {
            model?: PartnerMentionModel;
            partnerModel?: PartnerModel;
            notifier?: PartnerMentionNotifyPort;
        }
    ) {
        super(ctx, PartnerMentionService.ENTITY_NAME);
        this.model = ctx.model ?? new PartnerMentionModel();
        this.partnerModel = ctx.partnerModel ?? new PartnerModel();
        this.adminSearchSchema = adminSearchPartnerMentionSchema;
        this.notifier = ctx.notifier ?? null;
    }

    // ─── Permission hooks ───────────────────────────────────────────────────

    protected _canCreate(actor: Actor, data: unknown): void {
        checkCanCreateMention(actor, data);
    }
    protected _canUpdate(actor: Actor, entity: PartnerMention): void {
        checkCanUpdateMention(actor, entity);
    }
    protected _canSoftDelete(actor: Actor, entity: PartnerMention): void {
        checkCanDeleteMention(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: PartnerMention): void {
        checkCanDeleteMention(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: PartnerMention): void {
        checkCanUpdateMention(actor, entity);
    }
    protected _canView(actor: Actor, entity: PartnerMention): void {
        checkCanViewMention(actor, entity);
    }
    protected _canList(actor: Actor): void {
        checkCanListMentions(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListMentions(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanListMentions(actor);
    }
    protected _canUpdateVisibility(actor: Actor, entity: PartnerMention): void {
        checkCanUpdateMention(actor, entity);
    }

    // ─── Generic read path, sealed ──────────────────────────────────────────

    /**
     * The inherited unscoped search is sealed, like {@link create}.
     *
     * `adminSearchPartnerMentionSchema` declares no `partnerId` on purpose — the
     * scope comes from the URL path — so a generic search has nothing to scope
     * BY and would return every partner's log interleaved. That is not a
     * supported surface: reads go through `listForPartner`, which takes the
     * partner explicitly and therefore cannot forget it.
     */
    protected async _executeSearch(): Promise<PaginatedListOutput<PartnerMention>> {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Use PartnerMentionService.listForPartner — an unscoped mention search would span every partner'
        );
    }

    protected async _executeCount(): Promise<{ count: number }> {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Use PartnerMentionService.listForPartner — an unscoped mention count would span every partner'
        );
    }

    // ─── Write path ─────────────────────────────────────────────────────────

    /**
     * The inherited single-row create is sealed shut.
     *
     * Every mention must go through {@link createBatch}, which is what generates
     * the `batchId` and fires the once-per-submission notification. A row written
     * through the generic path would carry neither: it would show up in the
     * partner's log as an ungrouped orphan and the partner would never be told
     * about it. Failing loudly is better than a create that half-works.
     */
    public override async create(): Promise<never> {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Use PartnerMentionService.createBatch — a mention must be created through the batch path so it gets a batchId and a notification'
        );
    }

    /**
     * Log one submission: N rows, one transaction, one notification.
     *
     * ## What is generated here and never accepted from the caller
     *
     * `batchId` is minted inside this method. A caller-supplied value could file
     * one partner's mention into another partner's batch, and the partner-facing
     * view groups by exactly that column. The schema already strips it, and this
     * method builds its insert from the VALIDATED input for that stripping to
     * mean anything — assembling rows from a raw body would reopen the hole the
     * schema closed.
     *
     * It stays null for a single-entry submission: there is no batch to group.
     *
     * ## Why the notification is outside the transaction
     *
     * The rows are committed first, then the notifier runs. Sending inside the
     * transaction would let a mail-transport failure roll back a promotion that
     * genuinely happened, which is the wrong trade — the log is the record, the
     * email is the courtesy. A notifier that throws is swallowed for the same
     * reason (see below).
     *
     * @param actor - Must hold `PARTNER_MANAGE`.
     * @param input - The partner id plus the validated submission body.
     * @param ctx - Optional service context; `ctx.tx` enlists in a caller's transaction.
     * @returns The created rows.
     */
    public async createBatch(
        actor: Actor,
        input: CreateMentionBatchInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ mentions: PartnerMention[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createBatch',
            input: { ...input, actor },
            schema: createPartnerMentionBatchSchema.extend({
                partnerId: z.string().uuid(),
                actor: z.any()
            }),
            ctx,
            execute: async (validated, a) => {
                this._canCreate(a, validated);

                const { partnerId, mentionedAt, internalNote, entries } = validated;

                // Minted here, never read from input. Null for a lone mention:
                // there is nothing to group it with.
                const batchId = entries.length > 1 ? crypto.randomUUID() : null;

                const rows = entries.map((entry) => ({
                    partnerId,
                    batchId,
                    channel: entry.channel,
                    url: entry.url ?? null,
                    mentionedAt,
                    internalNote: internalNote ?? null,
                    createdById: a.id ?? null,
                    updatedById: a.id ?? null
                }));

                const mentions = await this.model.createMany({ rows, tx: ctx?.tx });

                await this.notifyBatch({ partnerId, batchId, mentions });

                return { mentions };
            }
        });
    }

    /**
     * One partner's log for the admin surface — includes `internalNote`.
     *
     * Takes the partner explicitly instead of reading it from the filters, which
     * is what makes forgetting the scope impossible: there is no code path here
     * that can produce an unscoped query.
     *
     * `total` counts the whole filtered set, not the page: the admin list is
     * paginated, and a page-length total would make the UI advertise exactly one
     * page no matter how long the log actually is.
     *
     * @param actor - Must hold `PARTNER_MANAGE`.
     * @param input - The partner id plus optional filters.
     * @param ctx - Optional service context.
     * @returns The matching mentions, newest promotion first, and the filtered total.
     */
    public async listForPartner(
        actor: Actor,
        input: { partnerId: string; filters?: FindPartnerMentionsFilters },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ mentions: PartnerMention[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listForPartner',
            input: { ...input, actor },
            schema: z.object({ partnerId: z.string().uuid(), filters: z.any().optional() }),
            ctx,
            execute: async (validated, a) => {
                this._canList(a);
                const filters = validated.filters ?? {};
                const [mentions, total] = await Promise.all([
                    this.model.findByPartner({
                        partnerId: validated.partnerId,
                        filters,
                        tx: ctx?.tx
                    }),
                    this.model.countByPartner({
                        partnerId: validated.partnerId,
                        filters,
                        tx: ctx?.tx
                    })
                ]);
                return { mentions, total };
            }
        });
    }

    /**
     * The calling partner's own log, grouped by batch, with admin fields stripped.
     *
     * Auth-only by design, like `PartnerService.getOwn`: an approved partner is
     * an ordinary account holding no partner permission, so demanding one would
     * lock them out of their own mentions. Ownership IS the gate and it fails
     * closed — an actor with no real identity resolves to null and matches the
     * same nothing as an actor who owns no partner. Both get an empty log, never
     * a 403 that would confirm a partner exists.
     *
     * `internalNote` and the audit authors are removed HERE rather than in the
     * route, so the guarantee travels with the data instead of depending on each
     * caller remembering to strip them.
     *
     * @param actor - The authenticated actor.
     * @param ctx - Optional service context.
     * @returns Batches, newest first, each carrying its mentions.
     */
    public async listForOwner(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ batches: PartnerMentionBatchView[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listForOwner',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, a) => {
                const ownerUserId = resolveMentionOwnerUserId(a);
                if (ownerUserId === null) return { batches: [] };

                const partner = await this.partnerModel.findOne({ ownerUserId }, ctx?.tx);
                if (!partner) return { batches: [] };

                const mentions = await this.model.findByPartner({
                    partnerId: partner.id as string,
                    filters: { pageSize: OWNER_LOG_PAGE_SIZE },
                    tx: ctx?.tx
                });

                return { batches: groupMentionsIntoBatches(mentions) };
            }
        });
    }

    /**
     * Correct one mention, re-validating the row as it will END UP.
     *
     * `updatePartnerMentionSchema` only ever sees the patch, so it can catch a
     * channel switch that drops the URL but NOT a lone `{ url: null }` — whether
     * that is legal depends on the channel already stored. This method closes
     * that gap by merging the patch onto the current row and checking the result,
     * which is the only place both halves are visible at once.
     *
     * `partnerId` is the scope the caller believes the mention belongs to — the
     * one in the URL path — and it is CHECKED, not trusted. See
     * {@link assertMentionBelongsTo}.
     *
     * @param actor - Must hold `PARTNER_MANAGE`.
     * @param input - The owning partner, the mention id and the patch.
     * @param ctx - Optional service context.
     * @returns The corrected mention.
     */
    public async correct(
        actor: Actor,
        input: { partnerId: string; id: string; data: UpdatePartnerMention },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ mention: PartnerMention }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'correct',
            input: { ...input, actor },
            schema: z.object({
                partnerId: z.string().uuid(),
                id: z.string().uuid(),
                data: updatePartnerMentionSchema
            }),
            ctx,
            execute: async (validated, a) => {
                const current = await this.model.findById(validated.id, ctx?.tx);
                if (!current) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Mention not found');
                }
                assertMentionBelongsTo(current, validated.partnerId);
                this._canUpdate(a, current);

                // The merged row is the only view in which the per-channel URL
                // rule can actually be decided.
                const mergedChannel = validated.data.channel ?? current.channel;
                const mergedUrl =
                    validated.data.url === undefined ? current.url : validated.data.url;

                if (requiresMentionUrl({ channel: mergedChannel }) && !mergedUrl) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `A ${mergedChannel} mention must keep a link to the publication`
                    );
                }

                const updated = await this.model.update(
                    { id: validated.id },
                    { ...validated.data, updatedById: a.id ?? null },
                    ctx?.tx
                );
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update mention'
                    );
                }

                return { mention: updated };
            }
        });
    }

    /**
     * Soft-delete a mistakenly logged mention.
     *
     * Never a hard delete: a mention that was announced to the partner by email
     * and then vanishes without trace is worse than one marked removed, and the
     * admin who removed it stays on the row.
     *
     * @param actor - Must hold `PARTNER_MANAGE`.
     * @param input - The owning partner and the mention id.
     * @param ctx - Optional service context.
     * @returns How many rows were removed.
     */
    public async remove(
        actor: Actor,
        input: { partnerId: string; id: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'remove',
            input: { ...input, actor },
            schema: z.object({ partnerId: z.string().uuid(), id: z.string().uuid() }),
            ctx,
            execute: async (validated, a) => {
                const current = await this.model.findById(validated.id, ctx?.tx);
                if (!current) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Mention not found');
                }
                assertMentionBelongsTo(current, validated.partnerId);
                this._canSoftDelete(a, current);

                await this.model.update(
                    { id: validated.id },
                    { deletedAt: new Date(), deletedById: a.id ?? null },
                    ctx?.tx
                );

                return { count: 1 };
            }
        });
    }

    /**
     * Tell the partner, once, that the batch was logged.
     *
     * Every failure mode here is swallowed on purpose. The partner may have no
     * reachable address at all — `partners.contactInfo` is nullable and each
     * field inside it is nullish, so a hand-curated partner legitimately has
     * none — and the transport can be down. Neither is a reason to fail a
     * mention that actually happened, or to make the admin retype the form.
     */
    private async notifyBatch(input: {
        partnerId: string;
        batchId: string | null;
        mentions: readonly PartnerMention[];
    }): Promise<void> {
        if (!this.notifier || input.mentions.length === 0) return;

        try {
            await this.notifier(input);
        } catch (error) {
            this.logger.error(
                `partnerMention.notify failed for partner ${input.partnerId}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
