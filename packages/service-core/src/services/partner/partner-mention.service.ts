import { PartnerMentionModel } from '@repo/db';
import {
    adminSearchPartnerMentionSchema,
    type CreatePartnerMentionBatch,
    createPartnerMentionBatchSchema,
    type PartnerMention,
    ServiceErrorCode,
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

    constructor(
        ctx: ServiceConfig & {
            model?: PartnerMentionModel;
            notifier?: PartnerMentionNotifyPort;
        }
    ) {
        super(ctx, PartnerMentionService.ENTITY_NAME);
        this.model = ctx.model ?? new PartnerMentionModel();
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
