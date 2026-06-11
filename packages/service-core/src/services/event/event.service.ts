import {
    EventModel,
    buildSearchCondition,
    eventLocations as eventLocationsTable,
    events as eventTable,
    getDb
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ImageProvider } from '@repo/media/server';
import { resolveEnvironment } from '@repo/media/server';
import { getTranslationService } from '../../translation/translation-init';
import type {
    EntityOptionsItem,
    Event,
    EventByAuthorInput,
    EventByCategoryInput,
    EventByLocationInput,
    EventByOrganizerInput,
    EventCreateInput,
    EventFreeInput,
    EventSearchInput,
    EventSummaryInput,
    EventSummaryOutput,
    EventUpcomingInput,
    EventUpdateInput
} from '@repo/schemas';
import {
    type EntityFilters,
    EventAdminSearchSchema,
    EventByAuthorInputSchema,
    EventByCategoryInputSchema,
    EventByLocationInputSchema,
    EventByOrganizerInputSchema,
    EventCreateInputSchema,
    EventFreeInputSchema,
    EventSearchInputSchema,
    EventSummaryInputSchema,
    EventUpcomingInputSchema,
    EventUpdateInputSchema,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { type Actor, ServiceError } from '../../types';
import { checkCanFindOptions } from '../../utils';
import {
    buildEventDateConditions,
    buildEventPriceConditions,
    generateEventSlug
} from './event.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './event.normalizers';
import {
    checkCanAdminList,
    checkCanCreateEvent,
    checkCanDeleteEvent,
    checkCanHardDeleteEvent,
    checkCanListEvents,
    checkCanRestoreEvent,
    checkCanUpdateEvent,
    checkCanViewEvent
} from './event.permissions';
import type { EventHookState } from './event.types';

/** Entity-specific filter fields for event admin search. */
type EventEntityFilters = EntityFilters<typeof EventAdminSearchSchema>;

/**
 * Service for managing events.
 * Provides CRUD operations, search, and permission/lifecycle hooks for Event entities.
 * Extends BaseCrudService for homogeneous validation, error handling, and logging.
 */
export class EventService extends BaseCrudService<
    Event,
    EventModel,
    typeof EventCreateInputSchema,
    typeof EventUpdateInputSchema,
    typeof EventSearchInputSchema
> {
    static readonly ENTITY_NAME = 'event';
    protected readonly entityName = EventService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('event-revalidation');
    protected readonly model: EventModel;

    protected readonly createSchema = EventCreateInputSchema;
    protected readonly updateSchema = EventUpdateInputSchema;
    protected readonly searchSchema = EventSearchInputSchema;

    protected getDefaultListRelations() {
        // `tags` is intentionally excluded: r_entity_tag is polymorphic
        // (entityType + entityId composite reference) and Drizzle's relational
        // query API cannot resolve polymorphic relations natively. Tags must
        // be loaded via a separate query in callers that need them.
        return { author: true, organizer: true, location: true };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Events are searched by name and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'description'];
    }

    /**
     * Optional Cloudinary media provider for asset cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * Initializes a new instance of the EventService.
     * @param ctx - The service context, containing the logger and optional model.
     * @param mediaProvider - Optional ImageProvider for Cloudinary cleanup on hard delete.
     */
    constructor(ctx: ServiceConfig & { model?: EventModel }, mediaProvider?: ImageProvider | null) {
        super(ctx, EventService.ENTITY_NAME);
        this.model = ctx.model ?? new EventModel();
        this.adminSearchSchema = EventAdminSearchSchema;
        this.mediaProvider = mediaProvider ?? null;
    }

    /**
     * Lightweight relation-selector lookup (SPEC-169 §5.5 / decision D4).
     *
     * Returns minimal `{ id, label, slug }` items for populating admin relation selectors
     * WITHOUT requiring a broad `EVENT_VIEW_ALL`-style grant. Gating is admin-panel access
     * only (see {@link checkCanFindOptions}); the route mirrors this with an
     * `ACCESS_PANEL_ADMIN`-only middleware gate.
     *
     * Results are DRAFT-inclusive (the model's `findAll` only excludes soft-deleted rows,
     * never publication state) so relations can target unpublished events.
     *
     * @param actor - The actor performing the lookup (must hold admin-panel access).
     * @param params - `{ q?: string, limit?: number }` — optional search term + result cap.
     * @param ctx - Optional service context (transaction).
     * @returns A `ServiceOutput` with `{ items }` of event options.
     */
    public async findOptions(
        actor: Actor,
        params: { q?: string; limit?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: EntityOptionsItem[] }>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'findOptions',
            input: { actor, ...params },
            schema: z.object({
                q: z.string().trim().min(1).optional(),
                limit: z.number().int().min(1).max(100).default(20)
            }),
            ctx: resolvedCtx,
            execute: async (validatedInput, validatedActor, execCtx) => {
                checkCanFindOptions(validatedActor);

                const trimmedQ = validatedInput.q?.trim();
                const searchCondition =
                    trimmedQ && trimmedQ.length > 0
                        ? buildSearchCondition(trimmedQ, ['name'], this.model.getTable())
                        : undefined;

                const { items } = await this.model.findAll(
                    {},
                    { page: 1, pageSize: validatedInput.limit },
                    searchCondition ? [searchCondition] : undefined,
                    execCtx?.tx
                );

                const options: EntityOptionsItem[] = items.map((item) => ({
                    id: item.id,
                    label: item.name,
                    slug: item.slug
                }));

                return { items: options };
            }
        });
    }

    /**
     * Permission hook: checks if the actor can create an event.
     */
    protected _canCreate(actor: Actor, _data: EventCreateInput): void {
        checkCanCreateEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can update an event.
     */
    protected _canUpdate(actor: Actor, _entity: Event): void {
        checkCanUpdateEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can soft-delete an event.
     */
    protected _canSoftDelete(actor: Actor, _entity: Event): void {
        checkCanDeleteEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can hard-delete an event.
     */
    protected _canHardDelete(actor: Actor, _entity: Event): void {
        checkCanHardDeleteEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can restore an event.
     */
    protected _canRestore(actor: Actor, _entity: Event): void {
        checkCanRestoreEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can view an event.
     */
    protected _canView(actor: Actor, entity: Event): void {
        checkCanViewEvent(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can list events.
     */
    protected _canList(actor: Actor): void {
        checkCanListEvents(actor);
    }

    /**
     * Permission hook: checks if the actor can search events.
     */
    protected _canSearch(actor: Actor): void {
        checkCanListEvents(actor);
    }

    /**
     * Permission hook: checks if the actor can count events.
     */
    protected _canCount(actor: Actor): void {
        checkCanListEvents(actor);
    }

    /**
     * Permission hook: checks if the actor can update the visibility of an event.
     * @param actor - The actor performing the action
     * @param entity - The event entity
     * @param newVisibility - The new visibility value
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Event,
        _newVisibility: VisibilityEnum
    ): void {
        checkCanUpdateEvent(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    /**
     * Lifecycle hook: normalizes input before creating an event and generates slug.
     */
    protected async _beforeCreate(
        input: EventCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Event>> {
        const normalized = await normalizeCreateInput(input);

        // Only generate a slug if one is not already provided
        if (!normalized.slug) {
            // Ensure all required fields are present for slug generation
            if (!normalized.category || !normalized.name || !normalized.date?.start) {
                throw new Error(
                    'Missing required fields for slug generation: category, name, or date.start'
                );
            }
            const slug = await generateEventSlug(
                String(normalized.category),
                normalized.name,
                normalized.date.start
            );
            return { ...normalized, slug };
        }

        return normalized;
    }

    /**
     * Lifecycle hook: normalizes input before updating an event and updates slug if relevant fields change.
     */
    protected async _beforeUpdate(
        input: EventUpdateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Event>> {
        const normalized = await normalizeUpdateInput(input);
        // If category, name, or date.start is present in update, regenerate slug
        if (
            normalized.category !== undefined ||
            normalized.name !== undefined ||
            (normalized.date && normalized.date.start !== undefined)
        ) {
            const category = String(normalized.category ?? input.category);
            const name = normalized.name ?? input.name;
            const dateStart = normalized.date?.start ?? input.date?.start;
            if (!category || !name || !dateStart) {
                throw new Error(
                    'Missing required fields for slug generation: category, name, or date.start'
                );
            }
            const slug = await generateEventSlug(category, name, dateStart);
            return { ...normalized, slug };
        }
        return normalized;
    }

    protected async _afterCreate(
        entity: Event,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Event> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: entity.slug,
                category: entity.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }

        // SPEC-212: fire-and-forget auto-translation
        const translationService = getTranslationService();
        if (translationService) {
            const fields: Record<string, string> = {};
            if (entity.name) fields.name = entity.name;
            if (entity.summary) fields.summary = entity.summary;
            if (entity.description) fields.description = entity.description;
            if (Object.keys(fields).length > 0) {
                void translationService.translate({
                    entityType: 'event',
                    entityId: entity.id,
                    fields
                }).catch(() => {});
            }
        }

        return entity;
    }

    protected async _afterUpdate(
        entity: Event,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Event> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: entity.slug,
                category: entity.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }

        // SPEC-212: fire-and-forget auto-translation on field changes
        const translationService = getTranslationService();
        if (translationService) {
            const fields: Record<string, string> = {};
            if (entity.name) fields.name = entity.name;
            if (entity.summary) fields.summary = entity.summary;
            if (entity.description) fields.description = entity.description;
            if (Object.keys(fields).length > 0) {
                void translationService.translate({
                    entityType: 'event',
                    entityId: entity.id,
                    fields
                }).catch(() => {});
            }
        }

        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: Event,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Event> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: entity.slug,
                category: entity.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.restoredEvent = {
                slug: entity.slug,
                category: entity.category
            };
        }
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<{ count: number }> {
        const restored = ctx.hookState?.restoredEvent;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: restored?.slug,
                category: restored?.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEvent = { slug: entity.slug, category: entity.category };
        }
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<{ count: number }> {
        const deleted = ctx.hookState?.deletedEvent;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: deleted?.slug,
                category: deleted?.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEvent = { slug: entity.slug, category: entity.category };
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<{ count: number }> {
        const deleted = ctx.hookState?.deletedEvent;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: deleted?.slug,
                category: deleted?.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        // Best-effort Cloudinary cleanup after confirmed hard delete
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            const env = resolveEnvironment();
            const prefix = `hospeda/${env}/events/${ctx.hookState.deletedEntityId}/`;
            try {
                await this.mediaProvider.deleteByPrefix({ prefix });
            } catch (mediaError) {
                EventService.revalidationLogger.warn(
                    { error: mediaError, prefix },
                    '[media] Failed to clean up Cloudinary assets for event'
                );
            }
        }
        return result;
    }

    /**
     * Executes admin search for events with JSONB date filters.
     *
     * Extracts date range filters (startDateAfter, startDateBefore, endDateAfter, endDateBefore)
     * from entity filters and converts them into raw SQL conditions against the JSONB `date` column.
     * The JSONB column uses `start` and `end` keys as defined by EventDateSchema.
     *
     * @param params - The assembled admin search parameters from the base class.
     * @returns A paginated list of events matching the criteria.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<EventEntityFilters>
    ): Promise<PaginatedListOutput<Event>> {
        const { entityFilters, ...rest } = params;
        const { startDateAfter, startDateBefore, endDateAfter, endDateBefore, ...simpleFilters } =
            entityFilters;

        const extraConditions: SQL[] = [
            ...(params.extraConditions ?? []),
            ...buildEventDateConditions({
                startDateAfter,
                startDateBefore,
                endDateAfter,
                endDateBefore
            })
        ];

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }

    /**
     * Resolves location IDs for a given destination UUID.
     *
     * Queries `event_locations` for all active (not soft-deleted) rows whose
     * `destination_id` matches the supplied UUID and returns their primary keys.
     * Returns `null` when `destinationId` is undefined (no filter needed) and
     * returns an empty array when the destination exists but has no locations.
     *
     * @param destinationId - The destination UUID to resolve, or undefined.
     * @returns Array of location UUIDs, or null when the filter should be skipped.
     */
    private async _resolveLocationIdsForDestination(
        destinationId: string | undefined
    ): Promise<string[] | null> {
        if (!destinationId) return null;

        const db = getDb();
        const rows = await db
            .select({ id: eventLocationsTable.id })
            .from(eventLocationsTable)
            .where(
                and(
                    eq(eventLocationsTable.destinationId, destinationId),
                    isNull(eventLocationsTable.deletedAt)
                )
            );

        return rows.map((row) => row.id);
    }

    /**
     * Executes the search for events.
     *
     * When `destinationId` is present it is resolved to a list of `event_location` IDs
     * via `event_locations.destination_id`, then applied as an `inArray` condition on
     * `events.location_id`. The field is stripped from the plain filter object so it
     * never leaks into the base `buildWhereClause` (which would look for a non-existent
     * column on the `events` table).
     *
     * @param params - The validated search parameters
     * @param _actor - The actor performing the search
     * @returns Paginated list of events matching the criteria
     */
    protected async _executeSearch(params: EventSearchInput, _actor: Actor, ctx: ServiceContext) {
        const {
            page: _page,
            pageSize: _pageSize,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            q,
            destinationId,
            startDateAfter,
            startDateBefore,
            endDateAfter,
            endDateBefore,
            isFree,
            minPrice,
            maxPrice,
            price,
            currency,
            // Default to TRUE: unpriced events are included unless the caller
            // explicitly opts out with `includeUnpriced=false`. This matches the
            // UI default (toggle ON by default in the composite price filter).
            includeUnpriced = true,
            ...filterParams
        } = params;

        const locationIds = await this._resolveLocationIdsForDestination(destinationId);

        // No locations exist for this destination — return empty result immediately.
        if (locationIds !== null && locationIds.length === 0) {
            return { items: [], total: 0 };
        }

        // Default behavior: hide events that have already started when the
        // caller provided NO date filter at all. If even one bound is set
        // (e.g. only `startDateBefore` — used by the "Pasados" chip), the
        // caller takes full control and the default does NOT apply.
        const effectiveStartDateAfter =
            !startDateAfter && !startDateBefore && !endDateAfter && !endDateBefore
                ? new Date()
                : startDateAfter;

        const additionalConditions: SQL[] = [
            ...buildEventDateConditions({
                startDateAfter: effectiveStartDateAfter,
                startDateBefore,
                endDateAfter,
                endDateBefore
            }),
            ...buildEventPriceConditions({
                isFree,
                minPrice,
                maxPrice,
                price,
                currency,
                includeUnpriced
            })
        ];
        if (locationIds !== null && locationIds.length > 0) {
            additionalConditions.push(inArray(eventTable.locationId, locationIds));
        }

        // Full-text search across the columns declared in getSearchableColumns().
        // BaseCrudRead applies this automatically for `list()` callers but the
        // `search()` path used by the public list route routes the `q` param
        // through `_executeSearch` instead — so we apply it here too.
        if (q && q.trim().length > 0) {
            const searchCondition = buildSearchCondition(
                q,
                this.getSearchableColumns(),
                this.model.getTable()
            );
            if (searchCondition) additionalConditions.push(searchCondition);
        }

        // BaseCrudRead.search strips page/pageSize/sortBy/sortOrder from params
        // before reaching this hook (SPEC-088) and re-publishes them via
        // ctx.pagination. Forward them explicitly so model receives the
        // caller-provided pagination + sort.
        //
        // Use findAllWithRelations so the public list endpoint returns
        // `organizer` and `location` expanded (declared in
        // getDefaultListRelations). Cards on the listing pages need them.
        //
        // KNOWN TRADE-OFF: EventModel.findAll has a custom override for the
        // synthetic `mostSaved` sort field (SPEC-098 T-052a). findAllWithRelations
        // does NOT inherit that override, so when sortBy === 'mostSaved' the
        // ordering falls back to the default (id DESC) instead of bookmark count.
        // Accept this regression to keep card relations consistent; a future
        // change can implement mostSaved at the findAllWithRelations layer.
        return this.model.findAllWithRelations(
            this.getDefaultListRelations(),
            filterParams,
            {
                page: ctx.pagination?.page ?? 1,
                pageSize: ctx.pagination?.pageSize ?? 10,
                sortBy: ctx.pagination?.sortBy,
                sortOrder: ctx.pagination?.sortOrder
            },
            additionalConditions.length > 0 ? additionalConditions : undefined
        );
    }

    /**
     * Executes the count for events.
     *
     * Applies the same `destinationId` → `event_locations` resolution as `_executeSearch`
     * to ensure `search` and `count` return consistent totals.
     *
     * @param params - The validated search parameters
     * @param _actor - The actor performing the count
     * @returns Count of events matching the criteria
     */
    protected async _executeCount(params: EventSearchInput, _actor: Actor, _ctx: ServiceContext) {
        const {
            page: _page,
            pageSize: _pageSize,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            q,
            destinationId,
            startDateAfter,
            startDateBefore,
            endDateAfter,
            endDateBefore,
            isFree,
            minPrice,
            maxPrice,
            price,
            currency,
            includeUnpriced = true,
            ...filterParams
        } = params;

        const locationIds = await this._resolveLocationIdsForDestination(destinationId);

        // No locations exist for this destination — count is zero.
        if (locationIds !== null && locationIds.length === 0) {
            return { count: 0 };
        }

        // Default behavior: hide events that have already started when the
        // caller provided NO date filter at all. If even one bound is set
        // (e.g. only `startDateBefore` — used by the "Pasados" chip), the
        // caller takes full control and the default does NOT apply.
        const effectiveStartDateAfter =
            !startDateAfter && !startDateBefore && !endDateAfter && !endDateBefore
                ? new Date()
                : startDateAfter;

        const additionalConditions: SQL[] = [
            ...buildEventDateConditions({
                startDateAfter: effectiveStartDateAfter,
                startDateBefore,
                endDateAfter,
                endDateBefore
            }),
            ...buildEventPriceConditions({
                isFree,
                minPrice,
                maxPrice,
                price,
                currency,
                includeUnpriced
            })
        ];
        if (locationIds !== null && locationIds.length > 0) {
            additionalConditions.push(inArray(eventTable.locationId, locationIds));
        }

        // Full-text search across the columns declared in getSearchableColumns().
        // BaseCrudRead applies this automatically for `list()` callers but the
        // `search()` path used by the public list route routes the `q` param
        // through `_executeSearch` instead — so we apply it here too.
        if (q && q.trim().length > 0) {
            const searchCondition = buildSearchCondition(
                q,
                this.getSearchableColumns(),
                this.model.getTable()
            );
            if (searchCondition) additionalConditions.push(searchCondition);
        }

        const count = await this.model.count(
            filterParams,
            additionalConditions.length > 0 ? { additionalConditions } : undefined
        );
        return { count };
    }

    /**
     * Returns a paginated list of events authored by a specific user.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (authorId, page, pageSize)
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Paginated list of events
     * @throws ServiceError (FORBIDDEN) if actor is undefined
     */
    public async getByAuthor(
        actor: Actor,
        input: EventByAuthorInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByAuthor',
            input: { ...input, actor },
            schema: EventByAuthorInputSchema,
            ctx,
            execute: async (validatedInput, validatedActor, resolvedCtx) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
                }
                const filters: Record<string, unknown> = { authorId: validatedInput.authorId };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(
                        filters,
                        { page, pageSize },
                        undefined,
                        resolvedCtx.tx
                    );
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of events at a specific location.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (locationId, page, pageSize)
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getByLocation(
        actor: Actor,
        input: EventByLocationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByLocation',
            input: { ...input, actor },
            schema: EventByLocationInputSchema,
            ctx,
            execute: async (validatedInput, validatedActor, resolvedCtx) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = { locationId: validatedInput.locationId };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(
                        filters,
                        { page, pageSize },
                        undefined,
                        resolvedCtx.tx
                    );
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of events organized by a specific organizer.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (organizerId, page, pageSize)
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getByOrganizer(
        actor: Actor,
        input: EventByOrganizerInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByOrganizer',
            input: { ...input, actor },
            schema: EventByOrganizerInputSchema,
            ctx,
            execute: async (validatedInput, validatedActor, resolvedCtx) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = {
                    organizerId: validatedInput.organizerId
                };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(
                        filters,
                        { page, pageSize },
                        undefined,
                        resolvedCtx.tx
                    );
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of upcoming events within a date range.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (fromDate, toDate, page, pageSize)
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getUpcoming(
        actor: Actor,
        input: EventUpcomingInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUpcoming',
            input: { ...input, actor },
            schema: EventUpcomingInputSchema,
            ctx,
            execute: async (validatedInput, validatedActor, resolvedCtx) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = {};
                // Calculate the date range based on daysAhead
                const today = new Date();
                const futureDate = new Date();
                futureDate.setDate(today.getDate() + validatedInput.daysAhead);
                filters['date.start'] = {
                    $gte: today,
                    $lte: futureDate
                };

                // SPEC-095: city/country filters removed — geographic context now derives
                // from the eventLocation.destinationId FK. These input fields are kept on
                // UpcomingEventsSchema for backwards compatibility but are no longer used
                // server-side.

                // Add category filter if provided
                if (validatedInput.category) {
                    filters.category = validatedInput.category;
                }

                // Add price filter if provided
                if (validatedInput.maxPrice) {
                    filters['pricing.basePrice'] = { $lte: validatedInput.maxPrice };
                }
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(
                        filters,
                        { page, pageSize },
                        undefined,
                        resolvedCtx.tx
                    );
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a summary of a specific event.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and error handling.
     * @param actor - Authenticated actor
     * @param input - Event id
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Event summary DTO
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     * @throws ServiceError (NOT_FOUND) if event does not exist
     */
    public async getSummary(
        actor: Actor,
        input: EventSummaryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<EventSummaryOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...input, actor },
            schema: EventSummaryInputSchema,
            ctx,
            execute: async (validatedInput, validatedActor, resolvedCtx) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                let event: Event | null;
                try {
                    event = await this.model.findById(validatedInput.eventId, resolvedCtx.tx);
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
                if (!event) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Event not found');
                }
                await this._canView(validatedActor, event);
                const summary = {
                    id: event.id,
                    slug: event.slug,
                    name: event.name,
                    summary: event.summary,
                    description: event.description,
                    category: event.category,
                    date: event.date,
                    pricing: event.pricing,
                    isFeatured: event.isFeatured,
                    createdAt: event.createdAt
                };
                return summary;
            }
        });
    }

    /**
     * Returns a paginated list of events by category.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (category, page, pageSize)
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getByCategory(
        actor: Actor,
        input: EventByCategoryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByCategory',
            input: { ...input, actor },
            schema: EventByCategoryInputSchema,
            ctx,
            execute: async (validatedInput, validatedActor, resolvedCtx) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = { category: validatedInput.category };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(
                        filters,
                        { page, pageSize },
                        undefined,
                        resolvedCtx.tx
                    );
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of free events (pricing: undefined).
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Pagination parameters (page, pageSize)
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Paginated list of free events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getFreeEvents(
        actor: Actor,
        input: EventFreeInput = { page: 1, pageSize: 20 },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFreeEvents',
            input: { ...input, actor },
            schema: EventFreeInputSchema,
            ctx,
            execute: async (validatedInput, validatedActor, resolvedCtx) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = { pricing: undefined };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(
                        filters,
                        { page, pageSize },
                        undefined,
                        resolvedCtx.tx
                    );
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }
}
