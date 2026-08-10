import { HostTradeBenefitUsageModel, HostTradeModel, UserModel } from '@repo/db';
import type {
    CountResponse,
    HostTrade,
    HostTradeBenefitUsage,
    HostTradeBenefitUsageAdminSearch
} from '@repo/schemas';
import {
    HOST_TRADE_REJECTION_SUSPEND_THRESHOLD,
    HOST_TRADE_REJECTION_WINDOW_DAYS,
    HOST_TRADE_USAGE_EXPIRY_DAYS,
    HostTradeBenefitUsageAdminSearchSchema,
    HostTradeBenefitUsageCreateInputSchema,
    HostTradeBenefitUsageUpdateInputSchema,
    HostTradeUsageChannelEnum,
    HostTradeUsageDeclaredByEnum,
    HostTradeUsageStatusEnum,
    RoleEnum,
    ServiceErrorCode
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
import { withServiceTransaction } from '../../utils/transaction';
import { getUserRoles } from '../user-role/user-role.service';
import { recalculateHostTradeAggregates } from './host-trade-aggregates';
import {
    checkCanDeclareUsageAsHost,
    checkCanManageUsages,
    checkCanViewAllUsages
} from './host-trade-usage.permissions';

/**
 * State passed from a `_before*` hook to its `_after*` counterpart.
 *
 * An instance field would be shared across concurrent requests on the same
 * service instance; `ctx.hookState` is scoped to one invocation.
 */
interface HostTradeUsageHookState extends Record<string, unknown> {
    /** The listing whose counters must be recomputed once the row is gone. */
    affectedHostTradeId?: string;
}

/**
 * Answers "is this account a host?" for the email-lookup channel.
 *
 * Injected so the declaration path can be unit-tested without a role table, and
 * so the definition of "host" lives in ONE place if it ever stops being a role.
 */
export type IsHostUserPort = (userId: string) => Promise<boolean>;

/** Default {@link IsHostUserPort}: the account carries `RoleEnum.HOST`. */
const defaultIsHostUser: IsHostUserPort = async (userId) => {
    const roles = await getUserRoles({ userId });
    return roles.includes(RoleEnum.HOST);
};

/** Shared shape of both declaration inputs, before channel-specific fields. */
const declareBaseShape = {
    hostTradeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    servicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'zodError.hostTradeUsage.servicedAt.format'
    }),
    note: z.string().max(300).optional()
};

const declareAsHostInputSchema = z.object(declareBaseShape);

/** Input for the transitions that only need to name the row. */
const usageIdInputSchema = z.object({
    usageId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** Input for {@link HostTradeUsageService.rejectUsage}. */
const rejectUsageInputSchema = usageIdInputSchema.extend({
    note: z.string().max(300).optional()
});

/** Input for {@link HostTradeUsageService.liftDeclarationSuspension}. */
const liftSuspensionInputSchema = z.object({
    hostTradeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * Input for {@link HostTradeUsageService.applyDeclarationSuspension}.
 *
 * The reason is mandatory and non-empty: a suspension takes away a provider's
 * ability to record work at all, and he is owed an answer when he asks why.
 */
const applySuspensionInputSchema = z.object({
    hostTradeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    reason: z.string().min(1).max(1000)
});

/**
 * Input for {@link HostTradeUsageService.listPendingForHost}.
 *
 * The page window and nothing else. `hostUserId` is deliberately absent: the
 * inbox is the actor's, so a field for it here would be a field a client could
 * fill in with somebody else's id.
 */
const pendingInboxInputSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
});

/** Input for {@link HostTradeUsageService.listForProvider}. */
const providerUsageListInputSchema = z.object({
    hostTradeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    status: z.enum(HostTradeUsageStatusEnum).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
});

/**
 * The label the selector shows for a linked host.
 *
 * Falls back through display name → full name → the id itself. The id is ugly
 * and deliberate: a selector entry with an empty label is unclickable, and a
 * provider can still pick the right row by elimination, which beats a blank
 * line he cannot act on at all.
 */
function resolveHostLabel(row: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
}): string {
    if (row.displayName) return row.displayName;
    const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    return fullName || row.id;
}

/**
 * Asserts there is a session behind the call.
 *
 * The inbox reads are authorised by the actor's own identity — the rows are
 * already scoped to him — so the only thing left to check is that there IS an
 * actor. Without this, an anonymous request would query the inbox of `undefined`
 * and answer an empty list, which reads as "you have nothing pending" rather
 * than "you are not logged in".
 */
function requireSession(actor: Actor): void {
    if (!actor?.id) {
        throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
    }
}

const declareAsProviderInputSchema = z.object({
    ...declareBaseShape,
    hostUserId: z.string().uuid().optional(),
    hostEmail: z.string().email().optional()
});

/**
 * Service for the benefit-usage record (HOS-376).
 *
 * Implements the declaration half of the "one party declares, the other
 * confirms" mechanism across the three channels of spec §6.2. The confirm /
 * reject transitions and the anti-collusion guards are separate concerns and
 * live in their own methods.
 */
export class HostTradeUsageService extends BaseCrudService<
    HostTradeBenefitUsage,
    HostTradeBenefitUsageModel,
    typeof HostTradeBenefitUsageCreateInputSchema,
    typeof HostTradeBenefitUsageUpdateInputSchema,
    typeof HostTradeBenefitUsageAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'hostTradeBenefitUsage';
    protected readonly entityName = HostTradeUsageService.ENTITY_NAME;
    public readonly model: HostTradeBenefitUsageModel;

    public readonly createSchema = HostTradeBenefitUsageCreateInputSchema;
    public readonly updateSchema = HostTradeBenefitUsageUpdateInputSchema;
    public readonly searchSchema = HostTradeBenefitUsageAdminSearchSchema;
    protected readonly adminSearchSchema = HostTradeBenefitUsageAdminSearchSchema;

    private readonly hostTradeModel: HostTradeModel;
    private readonly userModel: UserModel;
    private readonly isHostUser: IsHostUserPort;

    constructor(
        ctx: ServiceConfig,
        model?: HostTradeBenefitUsageModel,
        hostTradeModel?: HostTradeModel,
        userModel?: UserModel,
        isHostUser?: IsHostUserPort
    ) {
        super(ctx, HostTradeUsageService.ENTITY_NAME);
        this.model = model ?? new HostTradeBenefitUsageModel();
        this.hostTradeModel = hostTradeModel ?? new HostTradeModel();
        this.userModel = userModel ?? new UserModel();
        this.isHostUser = isHostUser ?? defaultIsHostUser;
    }

    /** No free-text search surface; the admin list filters on typed columns. */
    protected override getSearchableColumns(): string[] {
        return [];
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    // --- Permission hooks -------------------------------------------------
    // Declaring, confirming and rejecting are ownership-authorised (see the
    // permissions module); these hooks cover the generic CRUD surface, which is
    // admin-only.

    protected _canCreate(actor: Actor): void {
        checkCanManageUsages(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanManageUsages(actor);
    }
    protected _canPatch(actor: Actor): void {
        checkCanManageUsages(actor);
    }
    protected _canDelete(actor: Actor): void {
        checkCanManageUsages(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanManageUsages(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanManageUsages(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanManageUsages(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewAllUsages(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewAllUsages(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewAllUsages(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewAllUsages(actor);
    }
    /**
     * Visibility is not a concept this entity has — a usage row is never
     * published or hidden, it moves through a state machine. The hook is
     * required by the base class, so it is gated on the admin permission rather
     * than left open.
     */
    protected _canUpdateVisibility(actor: Actor): void {
        checkCanManageUsages(actor);
    }

    /**
     * Executes the usage search.
     *
     * Every filter maps directly to a column, so the `where` clause is built by
     * copying the ones that were supplied. `status`, `declaredBy` and
     * `creationChannel` are enum-validated upstream by the search schema.
     */
    protected async _executeSearch(
        params: HostTradeBenefitUsageAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<HostTradeBenefitUsage>> {
        const { items, total } = await this.model.findAll(
            this.buildUsageWhere(params),
            undefined,
            undefined,
            ctx?.tx
        );
        return { items, total };
    }

    /** Executes the usage count, over the same filters as {@link _executeSearch}. */
    protected async _executeCount(
        params: HostTradeBenefitUsageAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<CountResponse> {
        const count = await this.model.count(this.buildUsageWhere(params), { tx: ctx?.tx });
        return { count };
    }

    /** Shared filter builder for search and count, so the two cannot drift. */
    private buildUsageWhere(params: HostTradeBenefitUsageAdminSearch): Record<string, unknown> {
        const where: Record<string, unknown> = {};
        if (params.hostTradeId) where.hostTradeId = params.hostTradeId;
        if (params.hostUserId) where.hostUserId = params.hostUserId;
        if (params.status) where.status = params.status;
        if (params.declaredBy) where.declaredBy = params.declaredBy;
        if (params.creationChannel) where.creationChannel = params.creationChannel;
        return where;
    }

    /**
     * Rescues the `status` filter from the base's lifecycle handling (T-038).
     *
     * `status` is a key `AdminSearchBaseSchema` RESERVES. `adminList` pulls it
     * out of the entity filters and writes `where.lifecycleState` from it,
     * because for every other entity that is what `status` means. This one
     * OVERRIDES it with the usage state machine (`PENDING`/`CONFIRMED`/
     * `REJECTED`/`EXPIRED`), and `host_trade_benefit_usages` has no
     * `lifecycleState` column at all.
     *
     * WITHOUT THIS OVERRIDE THE FILTER DISAPPEARS SILENTLY. `buildWhereClause`
     * warns about an unknown column and SKIPS it — it only throws when every
     * key is unknown, and `deletedAt` is always there to keep it quiet. So
     * `?status=REJECTED` would answer with every usage in the system: filtered
     * by nothing, green in every test, wrong only in production.
     *
     * The fix is deliberately local. Teaching the base to check the column's
     * existence would touch the admin listing of some thirty services to
     * correct one entity that renamed a reserved key.
     *
     * @param params - The query the base assembled.
     * @returns The page, with `status` restored as an entity filter.
     */
    protected override async _executeAdminSearch(
        params: Parameters<
            BaseCrudService<
                HostTradeBenefitUsage,
                HostTradeBenefitUsageModel,
                typeof HostTradeBenefitUsageCreateInputSchema,
                typeof HostTradeBenefitUsageUpdateInputSchema,
                typeof HostTradeBenefitUsageAdminSearchSchema
            >['_executeAdminSearch']
        >[0]
    ): Promise<PaginatedListOutput<HostTradeBenefitUsage>> {
        const { where, entityFilters, ...rest } = params;
        const { lifecycleState, ...cleanWhere } = where as Record<string, unknown>;

        return super._executeAdminSearch({
            ...rest,
            where: cleanWhere,
            entityFilters: {
                ...entityFilters,
                ...(lifecycleState === undefined ? {} : { status: lifecycleState })
            }
        });
    }

    // --- Aggregate upkeep (T-023) -----------------------------------------
    //
    // Only CONFIRMED, non-deleted usages are counted, so the generic CRUD
    // surface can move a counter in three ways: an admin creating or editing a
    // row, and a row leaving or returning from soft/hard delete. The delete
    // hooks come in pairs because the parent listing has to be captured before
    // the row stops being readable.
    //
    // The state machine's own transitions do NOT come through here — see
    // {@link confirmUsage}.

    protected async _afterCreate(
        entity: HostTradeBenefitUsage,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<HostTradeBenefitUsage> {
        await recalculateHostTradeAggregates({ hostTradeId: entity.hostTradeId, tx: ctx?.tx });
        return entity;
    }

    protected async _afterUpdate(
        entity: HostTradeBenefitUsage,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<HostTradeBenefitUsage> {
        await recalculateHostTradeAggregates({ hostTradeId: entity.hostTradeId, tx: ctx?.tx });
        return entity;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<string> {
        await this.rememberParentListing(id, ctx);
        return id;
    }

    protected async _afterSoftDelete(
        result: CountResponse,
        _actor: Actor,
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<CountResponse> {
        await this.recalculateRememberedListing(ctx);
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<string> {
        await this.rememberParentListing(id, ctx);
        return id;
    }

    protected async _afterHardDelete(
        result: CountResponse,
        _actor: Actor,
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<CountResponse> {
        await this.recalculateRememberedListing(ctx);
        return result;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<string> {
        await this.rememberParentListing(id, ctx);
        return id;
    }

    protected async _afterRestore(
        result: CountResponse,
        _actor: Actor,
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<CountResponse> {
        await this.recalculateRememberedListing(ctx);
        return result;
    }

    /** Captures the parent listing before the row stops being readable. */
    private async rememberParentListing(
        id: string,
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<void> {
        const usage = await this.model.findById(id, ctx?.tx);
        if (ctx.hookState) {
            ctx.hookState.affectedHostTradeId = usage?.hostTradeId;
        }
    }

    /** Recomputes the listing captured on the way in, if there was one. */
    private async recalculateRememberedListing(
        ctx: ServiceContext<HostTradeUsageHookState>
    ): Promise<void> {
        const hostTradeId = ctx.hookState?.affectedHostTradeId;
        if (hostTradeId) {
            await recalculateHostTradeAggregates({ hostTradeId, tx: ctx?.tx });
        }
    }

    // --- Declaration ------------------------------------------------------

    /**
     * Declares a usage from the host side — the QR channel (spec §6.2a).
     *
     * The QR encodes a URL carrying the provider's slug and nothing else, so
     * this path needs no identification mechanism at all: THE HOST IS HIS OWN
     * SESSION. That is the whole reason it is the primary channel, and why it
     * is the one that carries no enumeration surface.
     *
     * @param input - Provider id, service date, optional note.
     * @param actor - The host. Must hold `HOST_TRADE_VIEW`.
     * @param ctx - Optional service context (transaction, hook state).
     * @returns The created PENDING usage.
     */
    public async declareAsHost(
        input: { hostTradeId: string; servicedAt: string; note?: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ usage: HostTradeBenefitUsage }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'declareAsHost',
            input: { ...input, actor },
            schema: declareAsHostInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                checkCanDeclareUsageAsHost(validatedActor);

                const provider = await this.requireProvider(validated.hostTradeId, ctx);
                this.assertListingAcceptsDeclarations(provider);
                await this.assertPairAcceptsDeclaration(
                    {
                        hostTradeId: validated.hostTradeId,
                        hostUserId: validatedActor.id,
                        declaredBy: HostTradeUsageDeclaredByEnum.HOST
                    },
                    ctx
                );

                const usage = await this.persistDeclaration(
                    {
                        hostTradeId: validated.hostTradeId,
                        hostUserId: validatedActor.id,
                        declaredBy: HostTradeUsageDeclaredByEnum.HOST,
                        declaredById: validatedActor.id,
                        creationChannel: HostTradeUsageChannelEnum.QR,
                        servicedAt: validated.servicedAt,
                        note: validated.note
                    },
                    ctx
                );

                return { usage };
            }
        });
    }

    /**
     * Declares a usage from the provider side — the selector and email channels
     * (spec §6.2b and §6.2c).
     *
     * Authorised by ownership of the listing, never by a permission. A listing
     * that is not the actor's answers NOT_FOUND rather than FORBIDDEN, so the
     * endpoint cannot be used to discover which listing ids exist.
     *
     * @param input - Provider id, exactly one host identifier, service date, note.
     * @param actor - The provider's owner account.
     * @param ctx - Optional service context (transaction, hook state).
     * @returns The created PENDING usage.
     */
    public async declareAsProvider(
        input: {
            hostTradeId: string;
            hostUserId?: string;
            hostEmail?: string;
            servicedAt: string;
            note?: string;
        },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ usage: HostTradeBenefitUsage }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'declareAsProvider',
            input: { ...input, actor },
            schema: declareAsProviderInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const provider = await this.requireProvider(validated.hostTradeId, ctx);

                // Ownership IS the authorisation. 404 rather than 403 so the
                // endpoint is not an oracle for which listings exist.
                if (!provider.ownerUserId || provider.ownerUserId !== validatedActor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Host trade listing not found'
                    );
                }

                // Listing-wide guards run before the host is resolved: a
                // suspended provider must not get to probe email addresses on
                // his way to being refused anyway.
                this.assertListingAcceptsDeclarations(provider);

                const { hostUserId, creationChannel } = await this.resolveDeclaredHost(
                    validated,
                    ctx
                );

                await this.assertPairAcceptsDeclaration(
                    {
                        hostTradeId: validated.hostTradeId,
                        hostUserId,
                        declaredBy: HostTradeUsageDeclaredByEnum.PROVIDER
                    },
                    ctx
                );

                const usage = await this.persistDeclaration(
                    {
                        hostTradeId: validated.hostTradeId,
                        hostUserId,
                        declaredBy: HostTradeUsageDeclaredByEnum.PROVIDER,
                        declaredById: validatedActor.id,
                        creationChannel,
                        servicedAt: validated.servicedAt,
                        note: validated.note
                    },
                    ctx
                );

                return { usage };
            }
        });
    }

    // --- The host's pending inbox (T-030) ---------------------------------

    /**
     * The pending usages awaiting THIS host's confirmation, newest first.
     *
     * Scoped to the actor, never to a parameter. A `hostUserId` the client
     * could pass would turn a page about your own pending confirmations into a
     * reader for anybody else's — and the rows name a provider, a date and a
     * free-text note about work done at that person's address.
     *
     * Authorised by having a session and nothing more: the rows are already
     * scoped to the caller, so a permission would only decide whether a host
     * may read his own inbox.
     *
     * @param input - The 1-based page window.
     * @param actor - The host whose inbox is being read.
     * @param ctx - Optional service context.
     * @returns The page of pending usages plus the unpaginated total.
     */
    public async listPendingForHost(
        input: { page: number; pageSize: number },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: HostTradeBenefitUsage[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listPendingForHost',
            input: { page: input.page, pageSize: input.pageSize, actor },
            schema: pendingInboxInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                requireSession(validatedActor);

                const [items, total] = await Promise.all([
                    this.model.findPendingForUser(
                        validatedActor.id,
                        { page: validated.page, pageSize: validated.pageSize },
                        ctx?.tx
                    ),
                    this.model.countPendingForUser(validatedActor.id, ctx?.tx)
                ]);

                return { items: items as HostTradeBenefitUsage[], total };
            }
        });
    }

    /**
     * How many usages await this host's confirmation, for the nav badge.
     *
     * Shares the model's definition of "pending for me" with
     * {@link listPendingForHost} — a badge showing 3 over a page listing 1 is
     * worse than either number being wrong on its own.
     *
     * @param actor - The host whose badge is being read.
     * @param ctx - Optional service context.
     */
    public async countPendingForHost(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CountResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countPendingForHost',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor) => {
                requireSession(validatedActor);
                const count = await this.model.countPendingForUser(validatedActor.id, ctx?.tx);
                return { count };
            }
        });
    }

    // --- The provider's own usages and selector (T-031) -------------------

    /**
     * Every usage recorded against a listing, newest first.
     *
     * The listing is a PARAMETER rather than resolved here, because the caller
     * (the `/mine/usages` route) has already had to load its own ficha to know
     * it exists at all — resolving it twice would double the query for nothing.
     * The route is what enforces "your own listing"; this method is the read.
     *
     * @param input.hostTradeId - The listing whose usages are being read.
     * @param input.status - Optional state filter. Absent means every state:
     *   the provider's history, not just his queue.
     * @param actor - The provider's owner account.
     * @param ctx - Optional service context.
     */
    public async listForProvider(
        input: {
            hostTradeId: string;
            status?: HostTradeUsageStatusEnum;
            page: number;
            pageSize: number;
        },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: HostTradeBenefitUsage[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listForProvider',
            input: { ...input, actor },
            schema: providerUsageListInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                requireSession(validatedActor);

                const where: Record<string, unknown> = {
                    hostTradeId: validated.hostTradeId,
                    deletedAt: null
                };
                if (validated.status) {
                    where.status = validated.status;
                }

                const { items, total } = await this.model.findAll(
                    where,
                    { page: validated.page, pageSize: validated.pageSize },
                    undefined,
                    ctx?.tx
                );

                return { items: items as HostTradeBenefitUsage[], total };
            }
        });
    }

    /**
     * The hosts this provider may declare on directly — the scoped selector.
     *
     * Only pairs with a CONFIRMED usage, and that scope IS the privacy
     * property: the list exposes nobody the provider has not already served, so
     * it cannot be used to browse the host base.
     *
     * The payload carries a name and never an email. "Already served" is not
     * consent to hand over a stored address, and a provider who needs the email
     * channel already has the address — what he must not receive is an export
     * of every past client's contact details.
     *
     * @param input.hostTradeId - The listing whose selector is being filled.
     * @param actor - The provider's owner account.
     * @param ctx - Optional service context.
     */
    public async listLinkedHosts(
        input: { hostTradeId: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ hosts: { id: string; displayName: string }[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listLinkedHosts',
            input: { ...input, actor },
            schema: liftSuspensionInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                requireSession(validatedActor);

                const rows = await this.model.findLinkedHostsWithNames(
                    validated.hostTradeId,
                    ctx?.tx
                );

                return {
                    hosts: rows.map((row) => ({
                        id: row.id,
                        displayName: resolveHostLabel(row)
                    }))
                };
            }
        });
    }

    // --- Transitions ------------------------------------------------------

    /**
     * Confirms a pending usage. Only the counterpart may do it.
     *
     * @param input - The usage id.
     * @param actor - Must be the counterpart of whoever declared it.
     * @param ctx - Optional service context.
     * @returns The confirmed usage.
     */
    public async confirmUsage(
        input: { usageId: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ usage: HostTradeBenefitUsage }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'confirmUsage',
            input: { ...input, actor },
            schema: usageIdInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const usage = await this.requireAnswerableBy(
                    validated.usageId,
                    validatedActor,
                    ctx
                );
                this.requireStatus(usage, HostTradeUsageStatusEnum.PENDING);

                const updated = await this.model.update(
                    { id: validated.usageId },
                    {
                        status: HostTradeUsageStatusEnum.CONFIRMED,
                        confirmedAt: new Date(),
                        confirmedById: validatedActor.id,
                        updatedById: validatedActor.id
                    } as unknown as Partial<HostTradeBenefitUsage>,
                    ctx?.tx
                );

                // The ONLY transition that moves a counter, and it does not go
                // through the base update, so `_afterUpdate` never fires for
                // it. `reject` runs from PENDING and `undo` from REJECTED, so
                // neither enters or leaves CONFIRMED — the day a confirmed
                // usage becomes reversible, that path needs this line too.
                await recalculateHostTradeAggregates({
                    hostTradeId: usage.hostTradeId,
                    tx: ctx?.tx
                });

                return { usage: updated as HostTradeBenefitUsage };
            }
        });
    }

    /**
     * Rejects a pending usage. Only the counterpart may do it.
     *
     * The note stays OPTIONAL on purpose. Rejection is the control that keeps
     * the public counter honest (§6.5), and requiring a written explanation to
     * say "that never happened" would put friction on the one action the system
     * most needs people to take.
     *
     * The rejection and the suspension it may trigger are ONE unit of work
     * (T-022). Committing the rejection without its seal would leave a provider
     * over the threshold that nothing marks as suspended, and the guard that
     * refuses his next declaration reads the seal, not the count.
     *
     * @param input - The usage id and an optional reason.
     * @param actor - Must be the counterpart of whoever declared it.
     * @param ctx - Optional service context. Its transaction is joined when
     *   present; otherwise one is opened for the pair.
     * @returns The rejected usage.
     */
    public async rejectUsage(
        input: { usageId: string; note?: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ usage: HostTradeBenefitUsage }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'rejectUsage',
            input: { ...input, actor },
            schema: rejectUsageInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const run = async (execCtx: ServiceContext) => {
                    const usage = await this.requireAnswerableBy(
                        validated.usageId,
                        validatedActor,
                        execCtx
                    );
                    this.requireStatus(usage, HostTradeUsageStatusEnum.PENDING);

                    const updated = await this.model.update(
                        { id: validated.usageId },
                        {
                            status: HostTradeUsageStatusEnum.REJECTED,
                            rejectedAt: new Date(),
                            rejectedById: validatedActor.id,
                            rejectionNote: validated.note ?? null,
                            updatedById: validatedActor.id
                        } as unknown as Partial<HostTradeBenefitUsage>,
                        execCtx.tx
                    );

                    await this.applyRejectionThreshold(usage.hostTradeId, execCtx);

                    return { usage: updated as HostTradeBenefitUsage };
                };

                return ctx?.tx ? run(ctx) : withServiceTransaction(run);
            }
        });
    }

    /**
     * Suspends declaration for a provider whose rejections reached the
     * threshold (spec §6.5, AC-11).
     *
     * Counted EAGERLY, at rejection time, rather than lazily when he next tries
     * to declare: the suspension is also a signal to the admin screen, and a
     * flag that only materialises when the provider happens to come back would
     * keep the pattern invisible for as long as he stays quiet.
     *
     * Two things it deliberately does NOT do:
     *
     * - It never re-stamps a provider who is already suspended. Re-stamping
     *   would move the date an admin is reading and overwrite a reason a human
     *   wrote with the generated one.
     * - It does not run on `undoRejection`. Undoing drops that rejection out of
     *   the count, but lifting the suspension is an explicit admin act
     *   ({@link liftDeclarationSuspension}) — the host who reverted his own
     *   rejection knows nothing about the other two that put the provider over
     *   the line.
     *
     * KNOWN CONSEQUENCE: an admin who lifts a suspension gives back the ability
     * to declare, not a clean slate — the old rejections stay inside the window,
     * so the NEXT rejection re-suspends immediately. That is defensible (a new
     * rejection after a human review is new evidence) but it is not free: giving
     * the lift a real amnesty would need a "cleared at" column to count from,
     * which no migration in this spec provides.
     */
    private async applyRejectionThreshold(hostTradeId: string, ctx: ServiceContext): Promise<void> {
        const rejections = await this.model.countRejectionsInWindow(
            hostTradeId,
            HOST_TRADE_REJECTION_WINDOW_DAYS,
            ctx.tx
        );
        if (rejections < HOST_TRADE_REJECTION_SUSPEND_THRESHOLD) {
            return;
        }

        const provider = await this.hostTradeModel.findById(hostTradeId, ctx.tx);
        if (!provider || provider.declarationSuspendedAt) {
            return;
        }

        await this.hostTradeModel.update(
            { id: hostTradeId },
            {
                declarationSuspendedAt: new Date(),
                // NULL is load-bearing: it is what tells the admin screen no
                // human decided this. An id here means a person acted.
                declarationSuspendedById: null,
                declarationSuspendReason: `Automatic: ${rejections} declarations rejected in the last ${HOST_TRADE_REJECTION_WINDOW_DAYS} days`
            } as unknown as Partial<HostTrade>,
            ctx.tx
        );
    }

    /**
     * Lifts a declaration suspension. Admin only (AC-12).
     *
     * Clears the whole trio, so `declarationSuspendedAt IS NULL` keeps meaning
     * exactly one thing. The record of WHO lifted it is `updatedById` on the
     * listing — the suspension columns describe the suspension, and leaving the
     * previous suspender's id behind on a listing that is no longer suspended
     * would be read as "an admin suspended this".
     *
     * Lifting a suspension that is not there succeeds without writing: that is
     * the outcome the admin asked for, and an error would make a double-click on
     * the admin screen look like a failure.
     *
     * @param input.hostTradeId - The provider whose suspension is being lifted.
     * @param actor - Must hold `HOST_TRADE_USAGE_MANAGE`.
     * @param ctx - Optional service context.
     * @returns Whether a suspension was actually cleared.
     */
    /**
     * Suspends a provider's ability to declare, by an admin's decision (T-038).
     *
     * THE ID IS WHAT SEPARATES THIS FROM THE AUTOMATIC PATH. The threshold
     * suspension writes `declarationSuspendedById: null` on purpose — NULL is
     * how the admin screen knows no human decided it. An admin-applied one
     * carries the actor's id, so the two can be told apart and somebody can be
     * asked why.
     *
     * The reason is REQUIRED here, unlike the rejection note. A rejection is a
     * private "that never happened" between two parties, and friction on it
     * would cost the system its one honest control (§6.5). A suspension takes
     * away a provider's ability to record work at all, and he is owed an answer
     * when he asks why.
     *
     * @param input.hostTradeId - The provider being suspended.
     * @param input.reason - Why. Shown to whoever reviews the suspension.
     * @param actor - Must hold `HOST_TRADE_USAGE_MANAGE`.
     * @param ctx - Optional service context.
     * @returns Nothing beyond success; the listing carries the new state.
     */
    public async applyDeclarationSuspension(
        input: { hostTradeId: string; reason: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ suspended: true }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'applyDeclarationSuspension',
            input: { ...input, actor },
            schema: applySuspensionInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                checkCanManageUsages(validatedActor);

                await this.requireProvider(validated.hostTradeId, ctx);

                await this.hostTradeModel.update(
                    { id: validated.hostTradeId },
                    {
                        declarationSuspendedAt: new Date(),
                        declarationSuspendedById: validatedActor.id,
                        declarationSuspendReason: validated.reason,
                        updatedById: validatedActor.id
                    } as unknown as Partial<HostTrade>,
                    ctx?.tx
                );

                return { suspended: true as const };
            }
        });
    }

    public async liftDeclarationSuspension(
        input: { hostTradeId: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ lifted: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'liftDeclarationSuspension',
            input: { ...input, actor },
            schema: liftSuspensionInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                checkCanManageUsages(validatedActor);

                const provider = await this.requireProvider(validated.hostTradeId, ctx);
                if (!provider.declarationSuspendedAt) {
                    return { lifted: false };
                }

                await this.hostTradeModel.update(
                    { id: validated.hostTradeId },
                    {
                        declarationSuspendedAt: null,
                        declarationSuspendedById: null,
                        declarationSuspendReason: null,
                        updatedById: validatedActor.id
                    } as unknown as Partial<HostTrade>,
                    ctx?.tx
                );

                return { lifted: true };
            }
        });
    }

    /**
     * Reverts a rejection, returning the usage to `PENDING`.
     *
     * Restricted to the account that rejected it, NOT merely to the counterpart.
     * The counterpart rule alone would let the rejected party undo the rejection
     * aimed at them — reversal belongs to whoever said no, which is what keeps
     * the rejection non-punitive and safe to use (§6.5).
     *
     * @param input - The usage id.
     * @param actor - Must be the account that rejected it.
     * @param ctx - Optional service context.
     * @returns The usage, back in PENDING.
     */
    public async undoRejection(
        input: { usageId: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ usage: HostTradeBenefitUsage }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'undoRejection',
            input: { ...input, actor },
            schema: usageIdInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const usage = await this.requireUsage(validated.usageId, ctx);

                if (usage.rejectedById !== validatedActor.id) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Usage not found');
                }
                this.requireStatus(usage, HostTradeUsageStatusEnum.REJECTED);

                const updated = await this.model.update(
                    { id: validated.usageId },
                    {
                        status: HostTradeUsageStatusEnum.PENDING,
                        rejectedAt: null,
                        rejectedById: null,
                        rejectionNote: null,
                        updatedById: validatedActor.id
                    } as unknown as Partial<HostTradeBenefitUsage>,
                    ctx?.tx
                );

                return { usage: updated as HostTradeBenefitUsage };
            }
        });
    }

    // --- Internals --------------------------------------------------------

    /** Loads a usage or throws NOT_FOUND. */
    private async requireUsage(
        usageId: string,
        ctx?: ServiceContext
    ): Promise<HostTradeBenefitUsage> {
        const usage = await this.model.findById(usageId, ctx?.tx);
        if (!usage) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Usage not found');
        }
        return usage;
    }

    /**
     * Loads a usage and asserts the actor is the party expected to answer it.
     *
     * `declaredBy` decides: a provider-declared usage is answered by the host
     * named on the row, a host-declared one by the listing's owner. Everyone
     * else — INCLUDING the declarant answering their own declaration (AC-6) —
     * gets NOT_FOUND rather than FORBIDDEN, so the endpoint cannot be used to
     * discover that a given usage id exists.
     */
    private async requireAnswerableBy(
        usageId: string,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<HostTradeBenefitUsage> {
        const usage = await this.requireUsage(usageId, ctx);

        let counterpartId: string | null;
        if (usage.declaredBy === HostTradeUsageDeclaredByEnum.PROVIDER) {
            counterpartId = usage.hostUserId;
        } else {
            const provider = await this.hostTradeModel.findById(usage.hostTradeId, ctx?.tx);
            counterpartId = provider?.ownerUserId ?? null;
        }

        if (!counterpartId || counterpartId !== actor.id) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Usage not found');
        }
        return usage;
    }

    /** Asserts the usage is in the state the transition requires. */
    private requireStatus(usage: HostTradeBenefitUsage, expected: HostTradeUsageStatusEnum): void {
        if (usage.status !== expected) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Usage is ${usage.status}, expected ${expected}`
            );
        }
    }

    // --- Declaration guards (T-020) ---------------------------------------
    //
    // Four refusals, and THE ORDER IS THE POINT: several can be true at once,
    // and the one that answers has to be the one whose remedy is furthest away.
    // Telling a provider on a revoked listing to wait for his pending usage to
    // resolve would send him after something that still would not let him
    // declare. Most permanent first, most transient last.
    //
    // They are split in two because the provider path only learns WHICH host it
    // is declaring on after resolving an email or a selector id, and the
    // listing-wide half has to refuse before that resolution runs.

    /**
     * Listing-wide guards: `PROVIDER_REVOKED`, then `DECLARATION_SUSPENDED`.
     *
     * Both refuse EVERY channel, the host's QR included. That is a deliberate
     * reading of a suspension: it freezes the LISTING, not one party's
     * keyboard. A provider under review for fabricated declarations would
     * otherwise keep accruing usages through the QR — the channel whose
     * distribution he controls, and the easiest one to hand to a friendly host.
     * The cost is real and accepted: an honest host cannot record a real service
     * with a suspended provider until an admin lifts it.
     */
    private assertListingAcceptsDeclarations(provider: {
        revokedAt?: Date | null;
        deletedAt?: Date | null;
        declarationSuspendedAt?: Date | null;
    }): void {
        if (provider.revokedAt || provider.deletedAt) {
            throw new ServiceError(
                ServiceErrorCode.PROVIDER_REVOKED,
                'This provider is no longer listed'
            );
        }
        if (provider.declarationSuspendedAt) {
            throw new ServiceError(
                ServiceErrorCode.DECLARATION_SUSPENDED,
                'Declaration is suspended for this provider'
            );
        }
    }

    /**
     * Pair-scoped guards: `DECLARATION_BLOCKED`, then `USAGE_PENDING_EXISTS`.
     *
     * The block is scoped by SIDE (`declaredBy`), never by the declarant's user
     * id. Two reasons, and the second is the load-bearing one:
     *
     * - A rejection blocks whoever declared it (spec §6.2, the state diagram:
     *   "bloquea al declarante sobre ese par"). The host denying the provider's
     *   version does not cost the host his own voice — him declaring afterwards
     *   is precisely how a mistaken rejection gets corrected.
     * - A listing that changes hands would otherwise hand the new owner a clean
     *   slate on every pair the previous one was blocked from, the same trap
     *   `updateReply` avoids by re-deriving ownership instead of trusting a
     *   frozen `authorUserId`.
     *
     * The pending guard is NOT scoped by side: one PENDING per pair is a partial
     * UNIQUE index in the database (§7.1), so this is the friendly 409 in front
     * of a constraint violation, and the index does not care who opened it.
     */
    private async assertPairAcceptsDeclaration(
        pair: {
            hostTradeId: string;
            hostUserId: string;
            declaredBy: HostTradeUsageDeclaredByEnum;
        },
        ctx?: ServiceContext
    ): Promise<void> {
        const standingRejection = await this.model.findOne(
            {
                hostTradeId: pair.hostTradeId,
                hostUserId: pair.hostUserId,
                status: HostTradeUsageStatusEnum.REJECTED,
                declaredBy: pair.declaredBy,
                deletedAt: null
            },
            ctx?.tx
        );
        if (standingRejection) {
            throw new ServiceError(
                ServiceErrorCode.DECLARATION_BLOCKED,
                'A standing rejection blocks declaring on this host'
            );
        }

        const pending = await this.model.findOne(
            {
                hostTradeId: pair.hostTradeId,
                hostUserId: pair.hostUserId,
                status: HostTradeUsageStatusEnum.PENDING,
                deletedAt: null
            },
            ctx?.tx
        );
        if (pending) {
            throw new ServiceError(
                ServiceErrorCode.USAGE_PENDING_EXISTS,
                'A pending usage already exists for this pair'
            );
        }
    }

    /** Loads the provider listing or throws NOT_FOUND. */
    private async requireProvider(hostTradeId: string, ctx?: ServiceContext) {
        const provider = await this.hostTradeModel.findById(hostTradeId, ctx?.tx);
        if (!provider) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Host trade listing not found');
        }
        return provider;
    }

    /**
     * Turns the provider's chosen identifier into a host id, and reports which
     * channel produced it.
     *
     * Both branches answer `HOST_NOT_FOUND`, and both are deliberate:
     *
     * - Selector: a `hostUserId` is only accepted if it is already among the
     *   linked hosts. The selector's privacy property is that it lists nobody a
     *   provider has not already served; trusting the body instead of
     *   re-checking would hand him any user id he can guess.
     * - Email: an address that resolves to nobody, or to somebody who is not a
     *   host, is refused EXPLICITLY. A typo is the common case here, and hiding
     *   it costs the provider a thirty-day wait on a row that will never
     *   resolve (§6.2c).
     */
    private async resolveDeclaredHost(
        input: { hostTradeId: string; hostUserId?: string; hostEmail?: string },
        ctx?: ServiceContext
    ): Promise<{ hostUserId: string; creationChannel: HostTradeUsageChannelEnum }> {
        const provided = [input.hostUserId, input.hostEmail].filter(
            (value) => value !== undefined
        ).length;
        if (provided !== 1) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Provide exactly one of hostUserId or hostEmail'
            );
        }

        if (input.hostUserId) {
            const linked = await this.model.findLinkedHosts(input.hostTradeId, ctx?.tx);
            if (!linked.includes(input.hostUserId)) {
                throw new ServiceError(
                    ServiceErrorCode.HOST_NOT_FOUND,
                    'That host is not linked to this listing'
                );
            }
            return {
                hostUserId: input.hostUserId,
                creationChannel: HostTradeUsageChannelEnum.LINKED_SELECTOR
            };
        }

        const user = await this.userModel.findOne({ email: input.hostEmail }, ctx?.tx);
        if (!user || !(await this.isHostUser(user.id as string))) {
            throw new ServiceError(
                ServiceErrorCode.HOST_NOT_FOUND,
                'No host account matches that email address'
            );
        }
        return {
            hostUserId: user.id as string,
            creationChannel: HostTradeUsageChannelEnum.EMAIL_LOOKUP
        };
    }

    /**
     * Writes the PENDING row, sealing the fields the state machine owns.
     *
     * `expiresAt` is computed here rather than defaulted in the database so the
     * clock that decides the deadline is the same one the confirmation email
     * quotes — a DB-side default would drift from the promise in the message.
     */
    private async persistDeclaration(
        data: {
            hostTradeId: string;
            hostUserId: string;
            declaredBy: HostTradeUsageDeclaredByEnum;
            declaredById: string;
            creationChannel: HostTradeUsageChannelEnum;
            servicedAt: string;
            note?: string;
        },
        ctx?: ServiceContext
    ): Promise<HostTradeBenefitUsage> {
        const expiresAt = new Date(Date.now() + HOST_TRADE_USAGE_EXPIRY_DAYS * 86_400_000);

        const created = await this.model.create(
            {
                ...data,
                note: data.note ?? null,
                status: 'PENDING',
                expiresAt,
                createdById: data.declaredById,
                updatedById: data.declaredById
            } as unknown as Partial<HostTradeBenefitUsage>,
            ctx?.tx
        );

        return created as HostTradeBenefitUsage;
    }
}
