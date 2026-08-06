import { PartnerModel } from '@repo/db';
import {
    adminSearchPartnerSchema,
    createPartnerSchema,
    LifecycleStatusEnum,
    type Partner,
    PartnerContentReviewStateEnum,
    PartnerSubscriptionStatusEnum,
    ServiceErrorCode,
    searchPartnerSchema,
    updatePartnerSchema
} from '@repo/schemas';
import { toSlug } from '@repo/utils';
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
    checkCanAdminList,
    checkCanCount,
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from './partner.permissions';

/** Input for {@link PartnerService.reviewContent}. */
const reviewPartnerContentInputSchema = z
    .object({
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        decision: z.enum(['approve', 'reject'], {
            message: 'zodError.partner.contentReview.decision.invalid'
        }),
        note: z
            .string()
            .trim()
            .min(1, { message: 'zodError.partner.contentReview.note.tooShort' })
            .max(1000, { message: 'zodError.partner.contentReview.note.tooLong' })
            .optional()
    })
    .superRefine((value, ctx) => {
        // A rejection with no reason puts the partner back in front of the same
        // empty form with nothing to fix. The whole point of keeping `rejected`
        // as a state instead of silently discarding the submission is that it
        // carries something actionable, so an empty one is a validation error
        // rather than a permitted shortcut.
        if (value.decision === 'reject' && !value.note) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['note'],
                message: 'zodError.partner.contentReview.note.requiredOnReject'
            });
        }
    });

/**
 * Whether a partner may have a payment initiated for it (HOS-278 AC-11).
 *
 * The single definition of the gate, exported so the two payment surfaces
 * (`send-link`, `manual-payment`) cannot drift into disagreeing about what
 * "content approved" means.
 *
 * Reads {@link Partner.contentApprovedAt} and NOT
 * {@link Partner.contentReviewState}: an already-published partner who edits
 * their logo has a pending state again, but the content on the carousel is
 * still the approved one, so cutting off their billing over it would punish
 * them for keeping the listing current.
 *
 * @param partner - The partner being charged.
 * @returns True when an admin has accepted this partner's content at least once.
 */
export const isPartnerContentApprovedForPayment = (
    partner: Pick<Partner, 'contentApprovedAt'>
): boolean => partner.contentApprovedAt != null;

/** Message used whenever the AC-11 gate refuses a payment. */
export const PARTNER_CONTENT_NOT_APPROVED_MESSAGE =
    'Partner content has not been approved yet. Review the partner content before enabling payment.';

/**
 * Service for managing partners.
 * Provides CRUD operations and permission/lifecycle hooks for Partner entities.
 */
export class PartnerService extends BaseCrudService<
    Partner,
    PartnerModel,
    typeof createPartnerSchema,
    typeof updatePartnerSchema,
    typeof searchPartnerSchema
> {
    static readonly ENTITY_NAME = 'partner';
    protected readonly entityName = PartnerService.ENTITY_NAME;
    protected readonly model: PartnerModel;

    protected readonly createSchema = createPartnerSchema;
    protected readonly updateSchema = updatePartnerSchema;
    protected readonly searchSchema = searchPartnerSchema;

    protected getDefaultListRelations() {
        return {};
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Partners are searched by slug and name.
     */
    protected override getSearchableColumns(): string[] {
        return ['slug', 'name'];
    }

    constructor(ctx: ServiceConfig & { model?: PartnerModel }) {
        super(ctx, PartnerService.ENTITY_NAME);
        this.model = ctx.model ?? new PartnerModel();
        this.adminSearchSchema = adminSearchPartnerSchema;
    }

    /**
     * Lifecycle hook: runs before create.
     * Auto-generates slug from name when not provided.
     */
    protected async _beforeCreate(
        data: Record<string, unknown>,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Partner>> {
        const updates: Partial<Partner> = {};

        if (!data.slug || (data.slug as string).trim().length === 0) {
            const base = `${(data.name as string) ?? 'partner'}`;
            const suffix = Date.now().toString(36);
            updates.slug = `${toSlug(base) || 'partner'}-${suffix}`;
        }

        // A partner created HERE was typed into the admin by a person who holds
        // PARTNER_MANAGE, so its content has already passed the only review
        // AC-11 asks for — stamping the gate is what keeps hand-created
        // partners payable instead of parking them in a review queue nobody
        // put them in.
        //
        // Provisioning from an approved lead does NOT come through this hook:
        // it writes via `partnerModel.create` directly (see
        // `alliance-lead.partner-provisioning.ts`), so a provisioned partner
        // keeps `contentApprovedAt` null and stays gated until its own content
        // is reviewed. That seam is load-bearing — a column DEFAULT would have
        // approved both paths indiscriminately.
        updates.contentApprovedAt = new Date();
        updates.contentApprovedById = actor.id;

        return updates;
    }

    /**
     * Permission hook: checks if the actor can create a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canCreate(actor: Actor, data: Record<string, unknown>): void {
        checkCanCreate(actor, data);
    }

    /**
     * Permission hook: checks if the actor can update a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canUpdate(actor: Actor, entity: Partner): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can soft-delete a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canSoftDelete(actor: Actor, entity: Partner): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can hard-delete a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canHardDelete(actor: Actor, entity: Partner): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can restore a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canRestore(actor: Actor, entity: Partner): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can view a partner.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canView(actor: Actor, entity: Partner): void {
        checkCanView(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can list partners.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Permission hook: checks if the actor can search partners.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Permission hook: checks if the actor can count partners.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Permission hook: checks if the actor can use admin list for partners.
     * Requires admin access (base class) plus `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    /**
     * Permission hook: checks if the actor can update the visibility of a partner.
     * Requires `PARTNER_MANAGE` (same as update).
     */
    protected _canUpdateVisibility(actor: Actor, entity: Partner, _newVisibility: unknown): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Executes the search for partners.
     * Forces lifecycleState = ACTIVE for public/protected paths.
     */
    protected async _executeSearch(
        params: Record<string, unknown>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<Partner>> {
        const { page = 1, pageSize = 20, ...filterParams } = params;
        (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        const items = await this.model.findByFilters(
            filterParams as Parameters<PartnerModel['findByFilters']>[0]
        );
        const total = await this.model.countActivePartners(
            filterParams as { q?: string; type?: string; tier?: string }
        );
        return { items, total };
    }

    /**
     * Executes the count for partners.
     * Forces lifecycleState = ACTIVE for public/protected paths.
     */
    protected async _executeCount(
        params: Record<string, unknown>,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page: _page, pageSize: _pageSize, ...filterParams } = params;
        (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        const count = await this.model.countActivePartners(
            filterParams as { q?: string; type?: string; tier?: string }
        );
        return { count };
    }

    /**
     * Register manual payment for partner
     *
     * Gated by AC-11 exactly like `send-link`: this path skips MercadoPago but
     * it still flips the partner to ACTIVE/active, which is what actually puts
     * them on the carousel. A comp or an off-platform transfer is no reason to
     * publish content nobody reviewed.
     */
    async registerManualPayment(
        actor: Actor,
        partnerId: string,
        _note?: string,
        _ctx?: ServiceContext
    ): Promise<Partner> {
        checkCanCreate(actor, {});

        const partner = await this.model.findById(partnerId);
        if (!partner) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner not found');
        }

        if (!isPartnerContentApprovedForPayment(partner)) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                PARTNER_CONTENT_NOT_APPROVED_MESSAGE
            );
        }

        // Update partner status to active
        const updated = await this.model.update(
            { id: partnerId },
            {
                subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            }
        );

        if (!updated) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update partner');
        }

        // TODO: Log manual payment in audit log with note

        return updated;
    }

    /**
     * Resolves the content submission a partner is waiting on (HOS-278 AC-11).
     *
     * Approving promotes the pending trio onto the live columns and stamps
     * {@link Partner.contentApprovedAt}, which is what opens the payment step
     * — step 5 of §6.3, and the reason the whole review exists. Rejecting
     * discards the pending copy and records why, so the partner has something
     * to act on instead of an unexplained silence.
     *
     * Either way the partner ends up with nothing pending.
     *
     * @param actor - The reviewing admin. Requires `PARTNER_MANAGE`.
     * @param input - Which partner, the verdict, and the reason when refusing.
     * @param ctx - Optional service execution context.
     * @returns The partner as it stands after the decision.
     * @throws `NOT_FOUND` when the partner does not exist.
     * @throws `VALIDATION_ERROR` when there is no pending submission to resolve.
     */
    public async reviewContent(
        actor: Actor,
        input: {
            readonly id: string;
            readonly decision: 'approve' | 'reject';
            readonly note?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ partner: Partner }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'reviewContent',
            input: { actor, ...input },
            schema: reviewPartnerContentInputSchema,
            ctx,
            execute: async (validated, a) => {
                const existing = await this.model.findById(validated.id, ctx?.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Partner not found: ${validated.id}`
                    );
                }

                checkCanUpdate(a, existing);

                // Read the review STATE, not the pending columns: a partner who
                // submitted only a description leaves `pendingLogoUrl` null, and
                // a presence check would call that "nothing to review".
                if (existing.contentReviewState !== PartnerContentReviewStateEnum.PENDING) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'This partner has no pending content submission to review'
                    );
                }

                const cleared = {
                    pendingLogoUrl: null,
                    pendingDescription: null,
                    pendingWebsiteUrl: null,
                    updatedById: a.id
                };

                const updated = await this.model.update(
                    { id: validated.id },
                    validated.decision === 'approve'
                        ? {
                              ...cleared,
                              contentReviewState: PartnerContentReviewStateEnum.APPROVED,
                              contentReviewNote: null,
                              logoUrl: existing.pendingLogoUrl ?? null,
                              // The pending TEXTS become the live ones as
                              // submitted. A submission that cleared the
                              // description means the partner wants it gone —
                              // keeping the previous prose beside a new logo is
                              // how a listing ends up saying something nobody
                              // wrote.
                              description: existing.pendingDescription ?? null,
                              websiteUrl: existing.pendingWebsiteUrl ?? null,
                              // Stamped only when it is still null: this is the
                              // date content FIRST cleared review, and every
                              // later approval must leave it alone so the
                              // payment gate reads as a fact about the partner
                              // rather than about their most recent edit.
                              ...(existing.contentApprovedAt
                                  ? {}
                                  : { contentApprovedAt: new Date(), contentApprovedById: a.id })
                          }
                        : {
                              ...cleared,
                              contentReviewState: PartnerContentReviewStateEnum.REJECTED,
                              contentReviewNote: validated.note ?? null
                          },
                    ctx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Partner not found: ${validated.id}`
                    );
                }

                return { partner: updated };
            }
        });
    }
}
