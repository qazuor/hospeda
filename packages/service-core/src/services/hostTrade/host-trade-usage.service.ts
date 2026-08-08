import { HostTradeBenefitUsageModel, HostTradeModel, UserModel } from '@repo/db';
import type {
    CountResponse,
    HostTradeBenefitUsage,
    HostTradeBenefitUsageAdminSearch
} from '@repo/schemas';
import {
    HOST_TRADE_USAGE_EXPIRY_DAYS,
    HostTradeBenefitUsageAdminSearchSchema,
    HostTradeBenefitUsageCreateInputSchema,
    HostTradeBenefitUsageUpdateInputSchema,
    HostTradeUsageChannelEnum,
    HostTradeUsageDeclaredByEnum,
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
import { getUserRoles } from '../user-role/user-role.service';
import {
    checkCanDeclareUsageAsHost,
    checkCanManageUsages,
    checkCanViewAllUsages
} from './host-trade-usage.permissions';

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

                await this.requireProvider(validated.hostTradeId, ctx);

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

                const { hostUserId, creationChannel } = await this.resolveDeclaredHost(
                    validated,
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

    // --- Internals --------------------------------------------------------

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
