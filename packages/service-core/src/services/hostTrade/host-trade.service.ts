import { AccommodationModel, HostTradeModel, type SelectHostTrade } from '@repo/db';
import type {
    CountResponse,
    CreateHostTrade,
    HostTrade,
    HostTradeOwnerUpdate,
    HostTradeQuery,
    UpdateHostTrade
} from '@repo/schemas';
import {
    CreateHostTradeSchema,
    HostTradeAdminSearchSchema,
    HostTradeOwnerUpdateSchema,
    HostTradeQuerySchema,
    RoleEnum,
    ServiceErrorCode,
    UpdateHostTradeSchema
} from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import {
    checkCanAdminListHostTrades,
    checkCanCreateHostTrade,
    checkCanDeleteHostTrade,
    checkCanHardDeleteHostTrade,
    checkCanRestoreHostTrade,
    checkCanUpdateHostTrade,
    checkCanViewHostTrade,
    checkCanViewOrViewAll
} from './host-trade.permissions';

/**
 * The `where` key that scopes a read to a single owner.
 *
 * Typed against the table's row shape ON PURPOSE, mirroring
 * `APPLICANT_SCOPE_KEY` in the alliance-lead service. `buildWhereClause`
 * silently DROPS a key the table does not have, so a typo — or a future column
 * rename — would not fail. It would quietly remove the ownership filter and
 * turn "my listing" into "the first listing in the table". Binding the literal
 * to `keyof SelectHostTrade` turns that runtime footgun into a build error.
 */
const OWNER_SCOPE_KEY: keyof SelectHostTrade = 'ownerUserId';

/** The only value `benefit_review_state` ever holds while an edit is waiting. */
const HOST_TRADE_BENEFIT_REVIEW_PENDING = 'pending';

/**
 * Input for {@link HostTradeService.revoke}.
 *
 * `reason` is REQUIRED. A revocation with no reason recorded is exactly the
 * audit gap R-4 exists to close — the row survives precisely so the question
 * "why is this provider no longer listed?" has an answer.
 */
const revokeHostTradeInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    reason: z
        .string()
        .min(1, { message: 'zodError.hostTrade.revokeReason.required' })
        .max(1000, { message: 'zodError.hostTrade.revokeReason.max' })
});

/** Input for {@link HostTradeService.reviewPendingBenefit}. */
const reviewPendingBenefitInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    decision: z.enum(['approve', 'reject'], {
        message: 'zodError.hostTrade.benefitReview.decision.invalid'
    })
});

/**
 * Port for telling a provider their listing was taken down (HOS-278 R-4).
 *
 * Injected rather than imported, for the same reason the alliance ports are:
 * `@repo/service-core` has no business knowing about an email transport.
 * Omitting it silences the notification (tests, preview environments) without
 * changing the revocation itself, which is the durable outcome.
 */
export interface HostTradeRevokeNotifyPort {
    /**
     * Announces the revocation to the listing's owner.
     *
     * Called fire-and-forget AFTER the row is already written: a mail server
     * having a bad afternoon must not roll back an admin's decision, and an
     * admin watching a spinner must not be waiting on Resend.
     *
     * @param input - Who owns it, what it was called, and why it came down.
     */
    notifyRevoked: (input: {
        readonly hostTradeId: string;
        readonly ownerUserId: string;
        readonly listingName: string;
        readonly reason: string;
    }) => Promise<void>;
}

/**
 * Resolves the actor to the account id a listing may be owned by, or null.
 *
 * An anonymous or guest actor carries a sentinel id that is not a real `users`
 * row. Returning null for it means the ownership filter is never built from a
 * value that could coincidentally match — the read simply resolves to nothing,
 * which is the same answer a real user who owns no listing gets.
 */
const resolveOwnerUserId = (actor: Actor): string | null => {
    const isAnonymous =
        actor.roles.length === 0 || actor.roles.every((role) => role === RoleEnum.GUEST);
    return isAnonymous ? null : actor.id;
};

/**
 * Service for managing the host-trades directory.
 *
 * Host-trade entries are admin-curated records of local tradespeople and
 * service providers (plumbers, electricians, cleaners, etc.) that hosts can
 * contact for maintenance and operational needs. Each entry is scoped to a
 * destination (city / locality).
 *
 * Hosts read entries relevant to their accommodation destinations via
 * {@link listForHost}. Admins perform full CRUD via the standard inherited
 * BaseCrudService methods.
 *
 * @extends BaseCrudService
 */
export class HostTradeService extends BaseCrudService<
    HostTrade,
    HostTradeModel,
    typeof CreateHostTradeSchema,
    typeof UpdateHostTradeSchema,
    typeof HostTradeQuerySchema
> {
    static readonly ENTITY_NAME = 'hostTrade';
    protected readonly entityName = HostTradeService.ENTITY_NAME;
    public readonly model: HostTradeModel;

    public readonly createSchema = CreateHostTradeSchema;
    public readonly updateSchema = UpdateHostTradeSchema;
    public readonly searchSchema = HostTradeQuerySchema;

    /**
     * Admin search schema for host-trade list filtering.
     * Uses the default _executeAdminSearch() since all filter fields map
     * directly to table column names.
     */
    protected readonly adminSearchSchema = HostTradeAdminSearchSchema;

    /**
     * AccommodationModel used to resolve a host's accommodation destinations
     * in {@link listForHost}. Injected via constructor for testability.
     */
    private readonly accommodationModel: AccommodationModel;

    /**
     * Columns searched when the `search` (free-text) query param is provided.
     * Host trades are searchable by name and benefit description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'benefit'];
    }

    /**
     * No automatic relations are loaded for host-trade list queries.
     * Destination data is not embedded by default to keep responses lean;
     * callers that need destination info should use a dedicated lookup.
     */
    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Port used to tell a provider their listing was revoked (R-4). Null in
     * tests and preview environments, which silences the email without
     * changing the revocation.
     */
    private readonly revokeNotifier: HostTradeRevokeNotifyPort | null;

    constructor(
        ctx: ServiceConfig,
        model?: HostTradeModel,
        accommodationModel?: AccommodationModel,
        revokeNotifier?: HostTradeRevokeNotifyPort | null
    ) {
        super(ctx, HostTradeService.ENTITY_NAME);
        this.model = model ?? new HostTradeModel();
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
        this.revokeNotifier = revokeNotifier ?? null;
    }

    // --- Permission hooks ---

    /** @inheritdoc */
    protected _canCreate(actor: Actor): void {
        checkCanCreateHostTrade(actor);
    }

    /** @inheritdoc */
    protected _canUpdate(actor: Actor): void {
        checkCanUpdateHostTrade(actor);
    }

    /** @inheritdoc */
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeleteHostTrade(actor);
    }

    /** @inheritdoc */
    protected _canHardDelete(actor: Actor): void {
        checkCanHardDeleteHostTrade(actor);
    }

    /** @inheritdoc */
    protected _canRestore(actor: Actor): void {
        checkCanRestoreHostTrade(actor);
    }

    /**
     * View permission for host-trade entries. Used by the base class on
     * getById / getBySlug. Accepts HOST_TRADE_VIEW (host-facing) or
     * HOST_TRADE_VIEW_ALL (admin).
     * @inheritdoc
     */
    protected _canView(actor: Actor): void {
        checkCanViewOrViewAll(actor);
    }

    /**
     * List permission. Accepts HOST_TRADE_VIEW (host) or HOST_TRADE_VIEW_ALL (admin)
     * so that the base `_canAdminList` can pass through to the override check.
     * @inheritdoc
     */
    protected _canList(actor: Actor): void {
        checkCanViewOrViewAll(actor);
    }

    /** @inheritdoc */
    protected _canSearch(actor: Actor): void {
        checkCanViewOrViewAll(actor);
    }

    /** @inheritdoc */
    protected _canCount(actor: Actor): void {
        checkCanViewOrViewAll(actor);
    }

    /** @inheritdoc */
    protected _canUpdateVisibility(actor: Actor): void {
        checkCanUpdateHostTrade(actor);
    }

    /**
     * Admin list permission: first verifies admin panel access (via base class),
     * then checks the entity-specific HOST_TRADE_VIEW_ALL permission.
     *
     * The super call MUST come first — it guards the admin boundary.
     * @inheritdoc
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminListHostTrades(actor);
    }

    // --- Lifecycle hooks ---

    /**
     * Before-create hook: ensures a URL-safe, globally-unique slug is set.
     *
     * Slug uniqueness must account for soft-deleted rows because the database
     * enforces a UNIQUE constraint on the `slug` column regardless of `deletedAt`.
     * `model.findOne({ slug })` sees all rows (including soft-deleted ones)
     * unless the model explicitly filters them — the BaseModelImpl default
     * does NOT add a `deletedAt IS NULL` guard in `findOne`, so a collision
     * check against `findOne({ slug })` correctly covers all rows.
     *
     * - If the caller omits `slug`: auto-generate from `name` and de-duplicate.
     * - If the caller provides `slug`: verify it is not already taken; throw
     *   VALIDATION_ERROR on collision (do not silently mutate caller-supplied slug).
     *
     * @param data - The validated create input.
     * @returns Partial entity data with a valid `slug` set.
     */
    protected async _beforeCreate(
        data: CreateHostTrade,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<HostTrade>> {
        const providedSlug = (data as { slug?: string }).slug;

        if (providedSlug) {
            // Caller supplied a slug — verify it is not already taken
            const existing = await this.model.findOne({ slug: providedSlug });
            if (existing) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Slug "${providedSlug}" is already taken by another host trade entry`
                );
            }
            return { ...data, slug: providedSlug };
        }

        // Auto-generate a unique slug from the name
        const slug = await createUniqueSlug(data.name, async (candidate) => {
            const exists = await this.model.findOne({ slug: candidate });
            return !!exists;
        });

        return { ...data, slug };
    }

    /**
     * Before-update hook: if the caller is changing the slug, verify the new
     * value is not already taken by a different row.
     *
     * @param data - The validated update input (may be partial).
     * @returns Partial entity data (unchanged if no slug mutation detected).
     */
    protected async _beforeUpdate(
        data: UpdateHostTrade,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<HostTrade>> {
        const newSlug = (data as { slug?: string; id?: string }).slug;
        const entityId = (data as { id?: string }).id;

        if (!newSlug) {
            return { ...data };
        }

        // Check if slug is taken by a DIFFERENT row
        const existing = await this.model.findOne({ slug: newSlug });
        if (existing && existing.id !== entityId) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Slug "${newSlug}" is already taken by another host trade entry`
            );
        }

        return { ...data, slug: newSlug };
    }

    // --- Search / count ---

    /**
     * Executes the host-trade search query for public / host-facing list calls.
     *
     * Filters by `destinationId`, `category`, and `is24h` when provided.
     *
     * @param params - Validated query parameters from HostTradeQuerySchema.
     * @param _actor - The requesting actor (unused; result set is not actor-scoped here).
     * @param _ctx - Service context (carries optional transaction).
     */
    protected async _executeSearch(
        params: HostTradeQuery,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<HostTrade>> {
        const where: Record<string, unknown> = {};
        if (params.destinationId) where.destinationId = params.destinationId;
        if (params.category) where.category = params.category;
        if (typeof params.is24h === 'boolean') where.is24h = params.is24h;

        const { items, total } = await this.model.findAll(where);
        return { items, total };
    }

    /**
     * Executes the host-trade count query.
     *
     * @param params - Validated query parameters from HostTradeQuerySchema.
     * @param _actor - The requesting actor.
     * @param _ctx - Service context.
     */
    protected async _executeCount(
        params: HostTradeQuery,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<CountResponse> {
        const where: Record<string, unknown> = {};
        if (params.destinationId) where.destinationId = params.destinationId;
        if (params.category) where.category = params.category;
        if (typeof params.is24h === 'boolean') where.is24h = params.is24h;

        const count = await this.model.count(where);
        return { count };
    }

    /**
     * Executes the admin search query with admin-specific filters.
     *
     * All entity-specific filter fields (`category`, `destinationId`, `isActive`,
     * `is24h`) map directly to table column names, so they are merged into the
     * `where` clause by the base implementation. Sorting, pagination, and text
     * search are also forwarded to the base class, which handles them uniformly.
     *
     * @param params - Full admin search params assembled by the base `adminList` method.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<HostTrade>> {
        return super._executeAdminSearch(params);
    }

    // --- Custom methods ---

    /**
     * Returns all active host-trade entries relevant to the calling host.
     *
     * The host's relevant destinations are determined by collecting the distinct
     * `destinationId` values from their non-deleted accommodations. If the host
     * has no accommodations, an empty array is returned immediately without
     * querying the `host_trades` table.
     *
     * Rows are ordered by `category ASC, name ASC` (implemented in the model).
     *
     * Permission required: HOST_TRADE_VIEW (the host-facing read permission).
     *
     * @param actor - The authenticated host performing the request.
     * @param ctx - Optional service context (carries transaction client).
     * @returns ServiceOutput wrapping an array of HostTrade rows.
     *
     * @example
     * ```ts
     * const service = new HostTradeService({ logger });
     * const result = await service.listForHost(actor);
     * if (result.success) {
     *   console.log(result.data.trades); // HostTrade[]
     * }
     * ```
     */
    public async listForHost(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ trades: HostTrade[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listForHost',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validatedInput, actor) => {
                // 1. Permission gate
                checkCanViewHostTrade(actor);

                // 2. Resolve the host's accommodations and collect distinct destinationIds
                const accommodationResult = await this.accommodationModel.findAll(
                    { ownerId: actor.id },
                    undefined,
                    undefined,
                    ctx?.tx
                );

                const accommodations = Array.isArray(accommodationResult.items)
                    ? accommodationResult.items
                    : [];

                if (accommodations.length === 0) {
                    return { trades: [] };
                }

                const distinctDestinationIds = [
                    ...new Set(
                        accommodations
                            .map((a) => a.destinationId as string | undefined)
                            .filter((id): id is string => typeof id === 'string' && id.length > 0)
                    )
                ];

                if (distinctDestinationIds.length === 0) {
                    return { trades: [] };
                }

                // 3. Fetch active host-trade entries for those destinations
                const trades = await this.model.findForHost(distinctDestinationIds, ctx?.tx);

                return { trades };
            }
        });
    }

    // -----------------------------------------------------------------------
    // Owner self-service (HOS-278 AC-7 .. AC-10)
    // -----------------------------------------------------------------------

    /**
     * Returns the listing the authenticated actor OWNS, or null.
     *
     * Deliberately has NO permission gate. AC-7 requires a provider to reach
     * their own ficha without `HOST_TRADE_VIEW` and without a host
     * subscription — the provider is an ordinary tourist account that happens
     * to have had an application approved, and demanding the directory-reading
     * permission would lock them out of their own listing.
     *
     * Ownership IS the gate, and it fails closed: the query is scoped by
     * `ownerUserId` to the actor's own id, and an actor with no real identity
     * matches the same nothing an actor who owns no listing does. Both get
     * null — never a 403, which would confirm a listing exists, and never a
     * 404, which would make "no listing yet" look like a broken page.
     *
     * @param actor - The authenticated actor.
     * @param ctx - Optional service execution context.
     * @returns `{ trade }`, null when the actor owns none.
     */
    public async getOwn(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ trade: HostTrade | null }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getOwn',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validatedInput, a) => {
                const ownerUserId = resolveOwnerUserId(a);
                if (ownerUserId === null) {
                    return { trade: null };
                }

                const trade = await this.model.findOne({ [OWNER_SCOPE_KEY]: ownerUserId }, ctx?.tx);

                return { trade: trade ?? null };
            }
        });
    }

    /**
     * Applies a provider's edit to their OWN listing.
     *
     * Two destinations, decided per field and not by the caller:
     *
     * - **Operational** (`contact`, `scheduleText`, `is24h`) apply immediately.
     *   This is the information that goes stale and that only the provider can
     *   keep current; routing it through an admin queue would make the
     *   directory less accurate, not more.
     * - **Benefit** goes to the PENDING columns and waits for review (AC-8).
     *   The benefit is the provider's consideration for being listed, so the
     *   vetted one stays live and public until an admin approves the new one.
     *   Nothing here ever writes the live benefit columns.
     *
     * The identity fields are not rejected here — they never arrive.
     * `HostTradeOwnerUpdateSchema` does not declare them, so Zod strips them at
     * parse time (AC-9).
     *
     * @param actor - The authenticated owner.
     * @param input - The fields being changed.
     * @param ctx - Optional service execution context.
     * @returns The updated listing.
     * @throws `NOT_FOUND` when the actor owns no listing.
     */
    public async updateOwn(
        actor: Actor,
        input: HostTradeOwnerUpdate,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ trade: HostTrade }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateOwn',
            input: { actor, ...input },
            schema: HostTradeOwnerUpdateSchema,
            ctx,
            execute: async (validated, a) => {
                const ownerUserId = resolveOwnerUserId(a);
                if (ownerUserId === null) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No host trade listing is owned by this account'
                    );
                }

                const existing = await this.model.findOne(
                    { [OWNER_SCOPE_KEY]: ownerUserId },
                    ctx?.tx
                );

                // AC-10 lives here, and it is the SAME lookup as AC-7: there is
                // no id in the request at all, so there is no "other provider's
                // listing" to address. Reading someone else's is not forbidden,
                // it is unreachable.
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No host trade listing is owned by this account'
                    );
                }

                const { benefitType, benefitValue, benefitText, ...operational } = validated;
                const hasBenefitEdit =
                    benefitType !== undefined ||
                    benefitValue !== undefined ||
                    benefitText !== undefined;

                const updated = await this.model.update(
                    { id: existing.id },
                    {
                        ...operational,
                        updatedById: a.id,
                        ...(hasBenefitEdit
                            ? {
                                  pendingBenefitType: benefitType ?? null,
                                  pendingBenefitValue: benefitValue ?? null,
                                  pendingBenefitText: benefitText ?? null,
                                  benefitReviewState: HOST_TRADE_BENEFIT_REVIEW_PENDING
                              }
                            : {})
                    },
                    ctx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No host trade listing is owned by this account'
                    );
                }

                return { trade: updated };
            }
        });
    }

    // -----------------------------------------------------------------------
    // Admin: revoke (HOS-278 R-4) and benefit review (AC-8)
    // -----------------------------------------------------------------------

    /**
     * Revokes a listing: makes it invisible while KEEPING the row.
     *
     * R-4 was decided as "revoke, not undo". The row survives, the reason and
     * the admin who decided are recorded, and the provider is told. Deleting
     * instead would destroy the only evidence that the provider was ever
     * approved, and the audit question that follows a revocation ("who took
     * this down, and why?") would have no answer.
     *
     * Deliberately NOT `softDelete`. A soft-deleted row disappears from admin
     * queries too; a revoked one must stay in front of the admins who revoked
     * it. `isActive` is the visibility switch this table already had — the trio
     * is what turns flipping it into a decision with an author.
     *
     * Gated by `HOST_TRADE_DELETE` rather than `HOST_TRADE_UPDATE`: it removes
     * a provider from the directory, which is nearer to deletion than to an
     * edit, and the stricter of the two permissions is the safer default.
     *
     * @param actor - The admin revoking.
     * @param input - `{ id, reason }` — the reason is required, not optional.
     * @param ctx - Optional service execution context.
     * @returns The revoked listing.
     */
    public async revoke(
        actor: Actor,
        input: { readonly id: string; readonly reason: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ trade: HostTrade }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'revoke',
            input: { actor, ...input },
            schema: revokeHostTradeInputSchema,
            ctx,
            execute: async (validated, a) => {
                checkCanDeleteHostTrade(a);

                const existing = await this.model.findById(validated.id, ctx?.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Host trade not found: ${validated.id}`
                    );
                }

                // Re-revoking is a no-op rather than an error: it would
                // otherwise overwrite the ORIGINAL reason and author with
                // whoever pressed the button second, quietly rewriting the
                // audit trail this whole mechanism exists to keep.
                if (existing.revokedAt) {
                    return { trade: existing };
                }

                const updated = await this.model.update(
                    { id: validated.id },
                    {
                        isActive: false,
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
                        `Host trade not found: ${validated.id}`
                    );
                }

                if (updated.ownerUserId === null || updated.ownerUserId === undefined) {
                    // Nobody to write to. Listings that predate HOS-278 were
                    // admin-curated and belong to no account, and an approved
                    // application whose applicant never confirmed their email
                    // provisions one the same way. Logged rather than silent:
                    // "the provider was not told" is a real outcome an admin
                    // may need to act on by hand.
                    this.logger.info(
                        { hostTradeId: updated.id },
                        '[host-trade] revoked a listing with no owner — nobody was notified'
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
                            hostTradeId: updated.id,
                            ownerUserId,
                            listingName: updated.name,
                            reason: validated.reason
                        })
                        .catch((error: unknown) => {
                            this.logger.error(
                                {
                                    hostTradeId: updated.id,
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                '[host-trade] revocation notice failed to send'
                            );
                        });
                }

                return { trade: updated };
            }
        });
    }

    /**
     * Resolves a pending benefit edit (AC-8).
     *
     * Approving COPIES the pending values onto the live ones; rejecting
     * DISCARDS them. Either way the pending columns and the marker are cleared,
     * which is why `benefit_review_state` has only one value — what remains
     * after a review is a listing with nothing pending, not a listing in an
     * "approved edit" state.
     *
     * @param actor - The admin reviewing.
     * @param input - `{ id, decision }`.
     * @param ctx - Optional service execution context.
     * @returns The listing after the review.
     */
    public async reviewPendingBenefit(
        actor: Actor,
        input: { readonly id: string; readonly decision: 'approve' | 'reject' },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ trade: HostTrade }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'reviewPendingBenefit',
            input: { actor, ...input },
            schema: reviewPendingBenefitInputSchema,
            ctx,
            execute: async (validated, a) => {
                checkCanUpdateHostTrade(a);

                const existing = await this.model.findById(validated.id, ctx?.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Host trade not found: ${validated.id}`
                    );
                }

                if (!existing.benefitReviewState) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'This listing has no pending benefit edit to review'
                    );
                }

                const cleared = {
                    pendingBenefitType: null,
                    pendingBenefitValue: null,
                    pendingBenefitText: null,
                    benefitReviewState: null,
                    updatedById: a.id
                };

                const updated = await this.model.update(
                    { id: validated.id },
                    validated.decision === 'approve'
                        ? {
                              ...cleared,
                              benefitType: existing.pendingBenefitType,
                              benefitValue: existing.pendingBenefitValue,
                              // The pending FINE PRINT becomes the live one. An
                              // edit that cleared it legitimately leaves an
                              // empty string, not the previous conditions —
                              // keeping the old prose beside a new benefit is
                              // how a listing ends up promising terms nobody
                              // agreed to.
                              benefit: existing.pendingBenefitText ?? ''
                          }
                        : cleared,
                    ctx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Host trade not found: ${validated.id}`
                    );
                }

                return { trade: updated };
            }
        });
    }
}
