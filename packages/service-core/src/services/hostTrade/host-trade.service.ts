import { AccommodationModel, HostTradeModel } from '@repo/db';
import type {
    CountResponse,
    CreateHostTrade,
    HostTrade,
    HostTradeQuery,
    UpdateHostTrade
} from '@repo/schemas';
import {
    CreateHostTradeSchema,
    HostTradeAdminSearchSchema,
    HostTradeQuerySchema,
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

    constructor(
        ctx: ServiceConfig,
        model?: HostTradeModel,
        accommodationModel?: AccommodationModel
    ) {
        super(ctx, HostTradeService.ENTITY_NAME);
        this.model = model ?? new HostTradeModel();
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
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
}
