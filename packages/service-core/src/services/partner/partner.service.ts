import { PartnerModel } from '@repo/db';
import {
    adminSearchPartnerSchema,
    createPartnerSchema,
    LifecycleStatusEnum,
    type Partner,
    PartnerContentReviewStateEnum,
    type PartnerOwnerUpdate,
    PartnerOwnerUpdateSchema,
    PartnerSubscriptionStatusEnum,
    PartnerTierEnum,
    RoleEnum,
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

/**
 * The column a partner listing is owned through.
 *
 * Named rather than inlined so the ownership scope is one string, not a literal
 * repeated across every owner-scoped read.
 */
const PARTNER_OWNER_SCOPE_KEY = 'ownerUserId' as const;

/**
 * Resolves the actor to the account id a partner may be owned by, or null.
 *
 * An anonymous or guest actor carries a sentinel id that is not a real `users`
 * row. Returning null for it means the ownership filter is never built from a
 * value that could coincidentally match — the read simply resolves to nothing,
 * which is the same answer a real user who owns no partner gets.
 */
const resolvePartnerOwnerUserId = (actor: Actor): string | null => {
    const isAnonymous =
        actor.roles.length === 0 || actor.roles.every((role) => role === RoleEnum.GUEST);
    return isAnonymous ? null : actor.id;
};

/**
 * Port for telling a partner their listing was taken down (HOS-278 R-4).
 *
 * Injected rather than imported, for the same reason its host-trade sibling is:
 * `@repo/service-core` has no business knowing about an email transport.
 * Omitting it silences the notification (tests, preview environments) without
 * changing the revocation itself, which is the durable outcome.
 */
export interface PartnerRevokeNotifyPort {
    /**
     * Announces the revocation to the partner's owner.
     *
     * Called fire-and-forget AFTER the row is already written: a mail server
     * having a bad afternoon must not roll back an admin's decision, and an
     * admin watching a spinner must not be waiting on the transport.
     *
     * @param input - Who owns it, what it was called, and why it came down.
     */
    notifyRevoked: (input: {
        readonly partnerId: string;
        readonly ownerUserId: string;
        readonly partnerName: string;
        readonly reason: string;
    }) => Promise<void>;
}

/** Input for {@link PartnerService.revoke}. */
const revokePartnerInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    reason: z
        .string()
        .trim()
        .min(1, { message: 'zodError.partner.revokeReason.required' })
        .max(1000, { message: 'zodError.partner.revokeReason.max' })
});

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
/**
 * The result of a public partner-detail lookup (HOS-294 D-3b, D-6).
 *
 * Three outcomes rather than a nullable partner, because the HTTP layer has to
 * answer two different questions with two different status codes:
 *
 * - `found`    — the page exists and is served (200).
 * - `gone`     — a gold partner that fails the visibility check. It WAS
 *                published, so the URL is deliberately retired (410), which is
 *                what tells a crawler to deindex it.
 * - `notFound` — no row, a soft-deleted row, or a partner that is not gold.
 *                This URL was never served, so it is a plain 404.
 *
 * "Was it published before?" is answered from the CURRENT row alone — no
 * history is stored, and none is needed: only gold ever had a page, so a gold
 * row failing visibility is exactly the set of URLs that went away. The known
 * consequence is that a gold partner downgraded to silver 404s instead of
 * 410ing; the URL leaves the sitemap either way.
 */
export type PartnerPublicLookup =
    | { readonly outcome: 'found'; readonly partner: Partner }
    | { readonly outcome: 'gone' }
    | { readonly outcome: 'notFound' };

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

    /**
     * Port used to tell a partner their listing was revoked (R-4). Null in
     * every context that did not inject one, which silences the notice without
     * changing the revocation.
     */
    private readonly revokeNotifier: PartnerRevokeNotifyPort | null;

    constructor(
        ctx: ServiceConfig & { model?: PartnerModel; revokeNotifier?: PartnerRevokeNotifyPort }
    ) {
        super(ctx, PartnerService.ENTITY_NAME);
        this.model = ctx.model ?? new PartnerModel();
        this.adminSearchSchema = adminSearchPartnerSchema;
        this.revokeNotifier = ctx.revokeNotifier ?? null;
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

        // Update partner status to active.
        //
        // `startsAt` is sealed here because THIS is the moment the alliance
        // begins (HOS-409). Provisioning deliberately leaves it null — at that
        // point nothing has started — and the unpaid reaper reads exactly that
        // column to decide who never paid (`PartnerModel.findUnpaidProvisioned`).
        // Activating without stamping it leaves a paying partner indistinguishable
        // from a deadbeat, so the reaper mails them an unpaid notice on day 30 and
        // archives them on day 90 while they are still being charged.
        //
        // Only when it is absent: an admin who typed the real start date on the
        // edit form outranks "today", and a later reactivation must not rewrite
        // the date the alliance actually began.
        const updated = await this.model.update(
            { id: partnerId },
            {
                subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ...(partner.startsAt ? {} : { startsAt: new Date() })
            }
        );

        if (!updated) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update partner');
        }

        // TODO: Log manual payment in audit log with note

        return updated;
    }

    /**
     * The partner listing owned by the calling account, or null (HOS-278 D3).
     *
     * Auth-only by design, exactly like its `host_trades` sibling: an approved
     * partner is an ordinary account, so demanding `PARTNER_VIEW_ALL` would
     * lock them out of their own ficha and contradict AC-7.
     *
     * Ownership IS the gate, and it fails closed: the query is scoped by
     * `ownerUserId` to the actor's own id, and an actor with no real identity
     * matches the same nothing an actor who owns no partner does. Both get
     * null — never a 403, which would confirm a partner exists, and never a
     * 404, which would make "no partner yet" look like a broken page.
     *
     * @param actor - The authenticated actor.
     * @param ctx - Optional service execution context.
     * @returns `{ partner }`, null when the actor owns none.
     */
    public async getOwn(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ partner: Partner | null }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getOwn',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validatedInput, a) => {
                const ownerUserId = resolvePartnerOwnerUserId(a);
                if (ownerUserId === null) {
                    return { partner: null };
                }

                const partner = await this.model.findOne(
                    { [PARTNER_OWNER_SCOPE_KEY]: ownerUserId },
                    ctx?.tx
                );

                return { partner: partner ?? null };
            }
        });
    }

    /**
     * The partner behind a public `/partners/<slug>/` request (HOS-294 D-6).
     *
     * Gated on THREE conditions, all of which must hold:
     *
     * - `tier === GOLD` — the page is what separates the two paid plans. This
     *   is the only condition this method adds; the other two are the filters
     *   every public partner read already applies.
     * - `lifecycleState === ACTIVE` and `subscriptionStatus === active` — the
     *   same pair `PartnerModel.findByFilters` forces on the carousel, so the
     *   ficha can never outlive a partner's presence in the listing.
     *
     * Gated by {@link checkCanSearch}, NOT `checkCanView`. The distinction is
     * load-bearing: `checkCanSearch` accepts `ACCESS_API_PUBLIC`, which is what
     * an anonymous visitor carries, while `checkCanView` demands
     * `PARTNER_VIEW_ALL`/`PARTNER_MANAGE` and would 403 every real reader. This
     * is the same gate the public partner LIST uses, so both public surfaces
     * move together if that permission is ever tightened.
     *
     * The soft-delete check is deliberate redundancy. `findOne` already
     * excludes deleted rows; repeating it here costs one comparison and means a
     * regression in that filter cannot turn into a public leak.
     *
     * @param actor - The requesting actor, typically anonymous.
     * @param input - `{ slug }` — the slug from the URL, never a UUID.
     * @param ctx - Optional service execution context.
     * @returns One of the three outcomes in {@link PartnerPublicLookup}.
     */
    public async getPublicBySlug(
        actor: Actor,
        input: { readonly slug: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PartnerPublicLookup>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPublicBySlug',
            input: { actor, slug: input.slug },
            schema: z.object({ slug: z.string().min(1) }),
            ctx,
            execute: async (validated, a) => {
                checkCanSearch(a);

                const partner = await this.model.findOne({ slug: validated.slug }, ctx?.tx);

                if (!partner || partner.deletedAt) {
                    return { outcome: 'notFound' } as const;
                }

                // Not gold: this URL was never served for this partner, so the
                // answer is "no such page", not "the page is gone".
                if (partner.tier !== PartnerTierEnum.GOLD) {
                    return { outcome: 'notFound' } as const;
                }

                const isVisible =
                    partner.lifecycleState === LifecycleStatusEnum.ACTIVE &&
                    partner.subscriptionStatus === PartnerSubscriptionStatusEnum.ACTIVE;

                if (!isVisible) {
                    return { outcome: 'gone' } as const;
                }

                return { outcome: 'found', partner } as const;
            }
        });
    }

    /**
     * Applies a partner's edit to their OWN listing (HOS-278 D3).
     *
     * Two destinations, decided per field and not by the caller:
     *
     * - **Operational** (`contactInfo`, `socialNetworks`) apply immediately.
     *   These are the facts that go stale and that only the partner can keep
     *   current; an admin queue would make the directory less accurate rather
     *   than more. Both are shallow-merged by the model, so a form that models
     *   one key cannot delete its siblings.
     * - **Content** (`logoUrl`, `description`, `websiteUrl`) go to the PENDING
     *   columns and wait for review (§6.3 step 4). The live ones are untouched,
     *   so a partner who is already published stays on the carousel while their
     *   edit is in the queue.
     *
     * The identity and commercial fields are not rejected here — they never
     * arrive. `PartnerOwnerUpdateSchema` does not declare them, so Zod strips
     * them at parse time.
     *
     * @param actor - The authenticated owner.
     * @param input - The fields being changed.
     * @param ctx - Optional service execution context.
     * @returns The updated partner.
     * @throws `NOT_FOUND` when the actor owns no partner.
     */
    public async updateOwn(
        actor: Actor,
        input: PartnerOwnerUpdate,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ partner: Partner }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateOwn',
            input: { actor, ...input },
            schema: PartnerOwnerUpdateSchema,
            ctx,
            execute: async (validated, a) => {
                const ownerUserId = resolvePartnerOwnerUserId(a);
                if (ownerUserId === null) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No partner listing is owned by this account'
                    );
                }

                const existing = await this.model.findOne(
                    { [PARTNER_OWNER_SCOPE_KEY]: ownerUserId },
                    ctx?.tx
                );

                // There is no id in the request at all, so there is no "other
                // partner's listing" to address. Reading someone else's is not
                // forbidden here, it is unreachable — the same structural
                // property AC-10 gives the provider ficha.
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No partner listing is owned by this account'
                    );
                }

                const { logoUrl, description, websiteUrl, ...operational } = validated;
                const hasContentEdit =
                    logoUrl !== undefined || description !== undefined || websiteUrl !== undefined;

                const updated = await this.model.update(
                    { id: existing.id },
                    {
                        ...operational,
                        updatedById: a.id,
                        ...(hasContentEdit
                            ? {
                                  // Written as a WHOLE snapshot of the submission,
                                  // not merged with whatever was pending before: a
                                  // second edit replaces the first, and an admin
                                  // must review one coherent proposal rather than a
                                  // collage of two.
                                  pendingLogoUrl: logoUrl ?? null,
                                  pendingDescription: description ?? null,
                                  pendingWebsiteUrl: websiteUrl ?? null,
                                  contentReviewState: PartnerContentReviewStateEnum.PENDING,
                                  // Cleared so a partner who fixes what an admin
                                  // objected to is not still staring at the old
                                  // rejection while the new submission waits.
                                  contentReviewNote: null
                              }
                            : {})
                    },
                    ctx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No partner listing is owned by this account'
                    );
                }

                return { partner: updated };
            }
        });
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
    /**
     * Revokes a partner: makes it invisible while KEEPING the row.
     *
     * R-4 was decided as "revoke, not undo", the same call `host_trades` made.
     * The row survives, the reason and the admin who decided are recorded, and
     * the partner is told. Deleting instead would destroy the only evidence
     * that the partner was ever approved, and the audit question that follows a
     * revocation ("who took this down, and why?") would have no answer.
     *
     * Deliberately NOT `softDelete`: a soft-deleted row disappears from admin
     * queries too, and a revoked partner must stay in front of the admins who
     * revoked it. `lifecycleState` is the visibility switch this table already
     * had — public reads force `ACTIVE`, so flipping it to `INACTIVE` is what
     * removes them from the carousel. `subscriptionStatus` is deliberately left
     * alone: writing it here would conflate "we took them down" with "they
     * stopped paying", and the billing crons read that column.
     *
     * Gated by `PARTNER_MANAGE`, NOT by the stricter `PARTNER_DELETE` its
     * host-trade sibling uses. `PARTNER_DELETE` exists in the enum but is
     * granted to no role and consulted by nothing, so gating on it would ship
     * an endpoint nobody can call — `HOST_TRADE_DELETE`, by contrast, is
     * seeded to SUPER_ADMIN and ADMIN, which is what makes the stricter choice
     * viable there and not here.
     *
     * @param actor - The admin revoking. Requires `PARTNER_MANAGE`.
     * @param input - `{ id, reason }` — the reason is required, not optional.
     * @param ctx - Optional service execution context.
     * @returns The revoked partner.
     */
    public async revoke(
        actor: Actor,
        input: { readonly id: string; readonly reason: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ partner: Partner }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'revoke',
            input: { actor, ...input },
            schema: revokePartnerInputSchema,
            ctx,
            execute: async (validated, a) => {
                const existing = await this.model.findById(validated.id, ctx?.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Partner not found: ${validated.id}`
                    );
                }

                checkCanSoftDelete(a, existing);

                // Re-revoking is a no-op rather than an error: it would
                // otherwise overwrite the ORIGINAL reason and author with
                // whoever pressed the button second, quietly rewriting the
                // audit trail this whole mechanism exists to keep.
                if (existing.revokedAt) {
                    return { partner: existing };
                }

                const updated = await this.model.update(
                    { id: validated.id },
                    {
                        lifecycleState: LifecycleStatusEnum.INACTIVE,
                        revokedAt: new Date(),
                        revokedById: a.id,
                        revokeReason: validated.reason,
                        updatedById: a.id
                    },
                    ctx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Partner not found: ${validated.id}`
                    );
                }

                if (updated.ownerUserId == null) {
                    // Nobody to write to. Curated partners created by hand in
                    // the admin belong to no account, and an approved
                    // application whose applicant never confirmed their email
                    // provisions one the same way. Logged rather than silent:
                    // "the partner was not told" is a real outcome an admin may
                    // need to act on by hand.
                    this.logger.info(
                        { partnerId: updated.id },
                        '[partner] revoked a partner with no owner — nobody was notified'
                    );
                } else if (this.revokeNotifier !== null) {
                    // AFTER the write, and deliberately NOT awaited. The
                    // revocation is the durable outcome; the email reports it.
                    // Awaiting would let a slow transport hold an admin's UI
                    // open, and throwing would surface a delivery problem as a
                    // failed revocation the admin would then retry — which the
                    // re-revoke guard turns into a no-op anyway, so the retry
                    // would not even re-send.
                    const ownerUserId = updated.ownerUserId;
                    void this.revokeNotifier
                        .notifyRevoked({
                            partnerId: updated.id,
                            ownerUserId,
                            partnerName: updated.name,
                            reason: validated.reason
                        })
                        .catch((error: unknown) => {
                            this.logger.error(
                                { partnerId: updated.id, error },
                                '[partner] revocation notice failed to send'
                            );
                        });
                }

                return { partner: updated };
            }
        });
    }
}
