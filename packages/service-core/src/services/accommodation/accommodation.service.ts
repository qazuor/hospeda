import {
    AccommodationFaqModel,
    AccommodationIaDataModel,
    AccommodationMediaModel,
    AccommodationModel,
    AmenityModel,
    DestinationModel,
    FeatureModel,
    RAccommodationAmenityModel,
    RAccommodationFeatureModel,
    UserModel,
    accommodations,
    sql,
    withTransaction
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import { resolveEnvironment } from '@repo/media/server';
import {
    type Accommodation,
    AccommodationAdminSearchSchema,
    type AccommodationByDestinationParams,
    AccommodationByDestinationParamsSchema,
    AccommodationComparisonRequestSchema,
    type AccommodationCreateDraftHttp,
    AccommodationCreateDraftHttpSchema,
    type AccommodationCreateInput,
    AccommodationCreateInputSchema,
    type AccommodationFaq,
    type AccommodationFaqAddInput,
    AccommodationFaqAddInputSchema,
    type AccommodationFaqListInput,
    AccommodationFaqListInputSchema,
    type AccommodationFaqListOutput,
    type AccommodationFaqRemoveInput,
    AccommodationFaqRemoveInputSchema,
    type AccommodationFaqReorderInput,
    AccommodationFaqReorderInputSchema,
    type AccommodationFaqSingleOutput,
    type AccommodationFaqUpdateInput,
    AccommodationFaqUpdateInputSchema,
    type AccommodationIaDataAddInput,
    AccommodationIaDataAddInputSchema,
    type AccommodationIaDataListInput,
    AccommodationIaDataListInputSchema,
    type AccommodationIaDataListOutput,
    type AccommodationIaDataRemoveInput,
    AccommodationIaDataRemoveInputSchema,
    type AccommodationIaDataSingleOutput,
    type AccommodationIaDataUpdateInput,
    AccommodationIaDataUpdateInputSchema,
    type AccommodationIdType,
    type AccommodationListWrapper,
    type AccommodationMediaAddInput,
    AccommodationMediaAddInputSchema,
    type AccommodationMediaArchiveInput,
    AccommodationMediaArchiveInputSchema,
    type AccommodationMediaListInput,
    AccommodationMediaListInputSchema,
    type AccommodationMediaListOutput,
    type AccommodationMediaRemoveInput,
    AccommodationMediaRemoveInputSchema,
    type AccommodationMediaReorderInput,
    AccommodationMediaReorderInputSchema,
    type AccommodationMediaRestoreInput,
    AccommodationMediaRestoreInputSchema,
    type AccommodationMediaSetFeaturedInput,
    AccommodationMediaSetFeaturedInputSchema,
    type AccommodationMediaSingleOutput,
    type AccommodationOptionsItem,
    type AccommodationRatingInput,
    type AccommodationSearchInput,
    type AccommodationSearchResult,
    AccommodationSearchSchema,
    type AccommodationStats,
    type AccommodationStatsWrapper,
    type AccommodationSummary,
    type AccommodationSummaryParams,
    AccommodationSummaryParamsSchema,
    type AccommodationSummaryWrapper,
    type AccommodationTopRatedParams,
    AccommodationTopRatedParamsSchema,
    type AccommodationUpdateInput,
    AccommodationUpdateInputSchema,
    type CountResponse,
    DestinationTypeEnum,
    type EntityFilters,
    type IdOrSlugParams,
    IdOrSlugParamsSchema,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    type Success,
    VisibilityEnum,
    type WithOwnerIdParams,
    WithOwnerIdParamsSchema,
    httpToDomainAccommodationCreateDraft
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import { diffTranslatableFields } from '../../translation/diff-translatable-fields';
import { getTranslationService } from '../../translation/translation-init';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { parseIdOrSlug } from '../../utils';
import { hasPermission } from '../../utils/permission';
import { withServiceTransaction } from '../../utils/transaction.js';
import { ConversationService } from '../conversation/conversation.service.js';
import { DestinationService } from '../destination/destination.service';
import {
    flattenAccommodationJoinRelations,
    flattenAccommodationJoinRelationsList,
    generateSlug
} from './accommodation.helpers';
import { syncAmenityJunction, syncFeatureJunction } from './accommodation.junction-sync';
import { attachComposedMedia, attachComposedMediaList } from './accommodation.media-read';
import { syncAccommodationMedia } from './accommodation.media-sync';
import {
    normalizeAccommodationOutput,
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './accommodation.normalizers';
import {
    checkCanAdminList,
    checkCanAdminView,
    checkCanCreate,
    checkCanFindOptions,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from './accommodation.permissions';
import {
    applyAccommodationLocationPrivacy,
    applyAccommodationLocationPrivacyList,
    projectAccommodationCityDestination,
    projectAccommodationCityDestinationList,
    projectAccommodationOwnerAvatar,
    projectAccommodationOwnerAvatarList
} from './accommodation.projections';
import type {
    AccommodationHookState,
    AccommodationPublishDeps,
    HostOnboardingResult
} from './accommodation.types';

/** Entity-specific filter fields for accommodation admin search. */
type AccommodationEntityFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;

/**
 * Provides accommodation-specific business logic, including creation, updates,
 * permissions, and other operations. It extends the generic `BaseCrudService` to
 * leverage a standardized service pipeline (validation, permissions, hooks, etc.).
 */
export class AccommodationService extends BaseCrudService<
    Accommodation,
    AccommodationModel,
    typeof AccommodationCreateInputSchema,
    typeof AccommodationUpdateInputSchema,
    typeof AccommodationSearchSchema
> {
    static readonly ENTITY_NAME = 'accommodation';
    /**
     * Roles that already imply host-level capabilities. Used to skip the USER → HOST
     * promotion in `createForOnboarding` (the promotion is a no-op for an already-
     * privileged actor) and by the `_assignHostRoleIfNeeded` hook.
     */
    private static readonly PRIVILEGED_ROLES: ReadonlySet<string> = new Set([
        RoleEnum.HOST,
        RoleEnum.ADMIN,
        RoleEnum.CLIENT_MANAGER,
        RoleEnum.SUPER_ADMIN
    ]);

    /**
     * Roles whose accommodations bypass the billing eligibility check on
     * publish. Regular `HOST` users are NOT in this set — they go through the
     * trial / subscription flow like any other paying owner. Only true admin
     * roles publishing on behalf of the platform are exempt from billing.
     */
    private static readonly BILLING_EXEMPT_ROLES: ReadonlySet<string> = new Set([
        RoleEnum.ADMIN,
        RoleEnum.CLIENT_MANAGER,
        RoleEnum.SUPER_ADMIN
    ]);
    protected readonly entityName = AccommodationService.ENTITY_NAME;
    /**
     * @inheritdoc
     */
    protected readonly model: AccommodationModel;
    /**
     * @inheritdoc
     */

    /**
     * @inheritdoc
     */
    protected readonly createSchema = AccommodationCreateInputSchema;
    /**
     * @inheritdoc
     */
    protected readonly updateSchema = AccommodationUpdateInputSchema;

    /**
     * @inheritdoc
     */
    protected readonly searchSchema = AccommodationSearchSchema;

    /**
     * @inheritdoc
     */
    protected getDefaultListRelations() {
        return {
            destination: true,
            owner: true
        };
    }

    /**
     * Returns relations for detail views (getById, getBySlug, getByName).
     * Loads more relations than list view for richer detail pages.
     * @see getDefaultListRelations — lighter relations for list operations
     */
    protected override getDefaultGetByIdRelations() {
        // NOTE: `tags` relation omitted — Drizzle can't infer r_entity_tag (polymorphic
        // entityId+entityType, no direct FK). Pending dedicated SPEC for a polymorphic
        // helper; load tags separately when needed.
        // NOTE: `amenities` and `features` are intentionally NOT loaded here (SPEC-117 A-6).
        // They go through r_accommodation_{amenity,feature} join tables and can be loaded
        // via Drizzle RQB with `{ amenities: { with: { amenity: true } } }` — see
        // `accommodation.model.findTopRated` and the `includeAmenities` / `includeFeatures`
        // branches in `searchWithRelations`. The detail page in the admin still loads them
        // via dedicated tab endpoints (`/accommodations/{id}/amenities`,
        // `/accommodations/{id}/features`) to keep the base detail response light.
        return {
            destination: true,
            owner: true,
            reviews: true,
            faqs: true
        };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Accommodations are searched by name and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'description'];
    }

    /**
     * @inheritdoc
     */
    protected normalizers: CrudNormalizersFromSchemas<
        typeof AccommodationCreateInputSchema,
        typeof AccommodationUpdateInputSchema,
        typeof AccommodationSearchSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput,
        search: (params: AccommodationSearchInput) => params // identity by default, can be overridden in tests
    };

    private destinationService: DestinationService;
    private conversationService: ConversationService;
    private readonly _destinationModel: DestinationModel;

    /**
     * Optional Cloudinary media provider for asset cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * User model used directly for system-level role assignment in lifecycle hooks.
     * Used instead of UserService to avoid actor permission requirements on hook actions.
     */
    private readonly _userModel: UserModel;

    /**
     * Optional billing dependencies required by `publish()`. Wired by the API layer
     * (apps/api) which has access to TrialService and the QZPay client. Routes that
     * never publish (e.g. read endpoints) instantiate the service without these.
     */
    private readonly _publishDeps: AccommodationPublishDeps | null;

    /**
     * Junction model for `r_accommodation_amenity`. Used by the SPEC-172 transactional
     * sync helpers to insert/delete amenity associations alongside create/update.
     */
    private readonly _rAmenityModel: RAccommodationAmenityModel;

    /**
     * Junction model for `r_accommodation_feature`. Used by the SPEC-172 transactional
     * sync helpers to insert/delete feature associations alongside create/update.
     */
    private readonly _rFeatureModel: RAccommodationFeatureModel;

    /**
     * Catalog model for `amenities`. Used to validate that all supplied amenity IDs
     * exist before any junction rows are written.
     */
    private readonly _amenityModel: AmenityModel;

    /**
     * Catalog model for `features`. Used to validate that all supplied feature IDs
     * exist before any junction rows are written.
     */
    private readonly _featureCatalogModel: FeatureModel;

    /**
     * Model for `accommodation_media`. Used by SPEC-204 T-007 write-both sync to
     * mirror the JSONB media value into the relational table inside the same transaction.
     * Initialized once at construction; the singleton is safe to reuse across requests.
     */
    private readonly _accommodationMediaModel: AccommodationMediaModel;

    /**
     * Initializes a new instance of the AccommodationService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional AccommodationModel instance (for testing/mocking).
     * @param mediaProvider - Optional ImageProvider for Cloudinary cleanup on hard delete.
     * @param userModel - Optional UserModel instance (for testing/mocking).
     * @param publishDeps - Optional billing dependencies required by `publish()`.
     *   Required only when calling `publish()`; other methods do not need them.
     * @param rAmenityModel - Optional junction model for `r_accommodation_amenity` (for testing/mocking).
     * @param rFeatureModel - Optional junction model for `r_accommodation_feature` (for testing/mocking).
     * @param amenityModel - Optional catalog model for `amenities` (for testing/mocking).
     * @param featureCatalogModel - Optional catalog model for `features` (for testing/mocking).
     * @param accommodationMediaModel - Optional media model for `accommodation_media` (for testing/mocking).
     *   When omitted, a default `AccommodationMediaModel` is instantiated. Pass a mock in unit tests
     *   to avoid requiring a real database connection when the payload includes a `media` field.
     */
    constructor(
        ctx: ServiceConfig,
        model?: AccommodationModel,
        mediaProvider?: ImageProvider | null,
        userModel?: UserModel,
        publishDeps?: AccommodationPublishDeps | null,
        rAmenityModel?: RAccommodationAmenityModel,
        rFeatureModel?: RAccommodationFeatureModel,
        amenityModel?: AmenityModel,
        featureCatalogModel?: FeatureModel,
        accommodationMediaModel?: AccommodationMediaModel
    ) {
        super(ctx, AccommodationService.ENTITY_NAME);
        this.model = model ?? new AccommodationModel();
        this.adminSearchSchema = AccommodationAdminSearchSchema;
        this.destinationService = new DestinationService(ctx);
        this.conversationService = new ConversationService(ctx, {
            // Internal use only: closeAllForAccommodation does not need JWT signing
            // or mailer dispatch — it just runs an UPDATE + schedule cancellation.
            authSecret: 'internal-system-actor-no-jwt-signing-needed-here-32',
            siteUrl: ''
        });
        this._destinationModel = new DestinationModel();
        this.mediaProvider = mediaProvider ?? null;
        this._userModel = userModel ?? new UserModel();
        this._publishDeps = publishDeps ?? null;
        this._rAmenityModel = rAmenityModel ?? new RAccommodationAmenityModel();
        this._rFeatureModel = rFeatureModel ?? new RAccommodationFeatureModel();
        this._amenityModel = amenityModel ?? new AmenityModel();
        this._featureCatalogModel = featureCatalogModel ?? new FeatureModel();
        // SPEC-204 T-007: shadow-write to accommodation_media on every create/update.
        // Injectable for unit tests that need to mock DB operations (see FIX 1 note).
        this._accommodationMediaModel = accommodationMediaModel ?? new AccommodationMediaModel();
    }

    /**
     * Reads the location obfuscation salt from the environment. Returns `null`
     * when missing so callers can gracefully skip privacy projection in unit
     * tests that mock models without setting up env. Production validates the
     * salt at startup (see `apps/api/src/utils/env.ts`).
     */
    private getLocationSalt(): string | null {
        const salt = process.env.HOSPEDA_LOCATION_SALT;
        return salt && salt.length >= 32 ? salt : null;
    }

    // --- Read Projection Hooks (SPEC-095, SPEC-097) ---
    /**
     * Projects the eager-loaded destination relation into the lightweight
     * `cityDestination` field (SPEC-095) and applies privacy-aware location
     * obfuscation (SPEC-097): always computes `approximateLocation`, and
     * strips exact `coordinates`/`street`/`number`/`floor`/`apartment` from
     * `location` when the actor lacks `ACCOMMODATION_LOCATION_EXACT_VIEW`
     * and is not the owner.
     */
    protected override async _afterGetByField(
        entity: Accommodation | null,
        actor: Actor,
        ctx: ServiceContext
    ): Promise<Accommodation | null> {
        const flattened = flattenAccommodationJoinRelations(entity);
        const withCity = projectAccommodationCityDestination(flattened);
        const withOwnerAvatar = projectAccommodationOwnerAvatar(withCity);
        const salt = this.getLocationSalt();
        const withPrivacy = salt
            ? applyAccommodationLocationPrivacy(withOwnerAvatar, { actor, salt })
            : withOwnerAvatar;
        // SPEC-204 T-013: read `media` from the relational accommodation_media
        // table (shape-identical composition). Videos still come from JSONB.
        return attachComposedMedia({
            entity: withPrivacy,
            mediaModel: this._accommodationMediaModel,
            tx: ctx?.tx
        });
    }

    /**
     * Applies SPEC-095 + SPEC-097 projections to every item in a list result.
     *
     * Flattens `amenities`/`features` junction rows when the model populated them
     * via `includeAmenities`/`includeFeatures` — the public response schema picks
     * a merged shape (`amenityId` + entity fields) that the raw Drizzle output
     * does not satisfy. The flatten is a no-op when those relations weren't
     * requested.
     */
    protected override async _afterList(
        result: PaginatedListOutput<Accommodation>,
        actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<Accommodation>> {
        if (!result?.items) return result;
        const flattened = flattenAccommodationJoinRelationsList(result.items);
        const withCity = projectAccommodationCityDestinationList(flattened);
        const withOwnerAvatar = projectAccommodationOwnerAvatarList(withCity);
        const salt = this.getLocationSalt();
        const withPrivacy = salt
            ? applyAccommodationLocationPrivacyList(withOwnerAvatar, { actor, salt })
            : withOwnerAvatar;
        // SPEC-204 T-013: batch-read `media` from the relational table (no N+1).
        const items = await attachComposedMediaList({
            items: withPrivacy,
            mediaModel: this._accommodationMediaModel,
            tx: ctx?.tx
        });
        return { ...result, items };
    }

    /**
     * Applies SPEC-095 + SPEC-097 projections to every item in a search result.
     *
     * Flattens `amenities`/`features` junction rows when the model populated them
     * via `includeAmenities`/`includeFeatures` — the public response schema picks
     * a merged shape (`amenityId` + entity fields) that the raw Drizzle output
     * does not satisfy. The flatten is a no-op when those relations weren't
     * requested.
     */
    protected override async _afterSearch(
        result: PaginatedListOutput<Accommodation>,
        actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<Accommodation>> {
        if (!result?.items) return result;
        const flattened = flattenAccommodationJoinRelationsList(result.items);
        const withCity = projectAccommodationCityDestinationList(flattened);
        const withOwnerAvatar = projectAccommodationOwnerAvatarList(withCity);
        const salt = this.getLocationSalt();
        const withPrivacy = salt
            ? applyAccommodationLocationPrivacyList(withOwnerAvatar, { actor, salt })
            : withOwnerAvatar;
        // SPEC-204 T-013: batch-read `media` from the relational table (no N+1).
        const items = await attachComposedMediaList({
            items: withPrivacy,
            mediaModel: this._accommodationMediaModel,
            tx: ctx?.tx
        });
        return { ...result, items };
    }

    // --- Permissions Hooks ---
    /**
     * @inheritdoc
     */
    protected _canCreate(actor: Actor, data: AccommodationCreateInput): void {
        checkCanCreate(actor, data);
    }
    /**
     * @inheritdoc
     */
    protected _canUpdate(actor: Actor, entity: Accommodation): void {
        checkCanUpdate(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canSoftDelete(actor: Actor, entity: Accommodation): void {
        checkCanSoftDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canHardDelete(actor: Actor, entity: Accommodation): void {
        checkCanHardDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canRestore(actor: Actor, entity: Accommodation): void {
        checkCanRestore(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canView(actor: Actor, entity: Accommodation): void {
        checkCanView(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks ACCOMMODATION_VIEW_ALL.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    /**
     * @inheritdoc
     * For accommodations, search permission is the same as list permission.
     * This could be evolved to a specific `ACCOMMODATION_SEARCH` permission if needed.
     */
    protected _canSearch(actor: Actor): void {
        checkCanList(actor);
    }
    /**
     * @inheritdoc
     * For accommodations, count permission is the same as list permission.
     */
    protected _canCount(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * @inheritdoc
     * For accommodations, visibility can be changed by anyone who can update the entity.
     * This could be evolved to a specific `ACCOMMODATION_UPDATE_VISIBILITY` permission if needed.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        entity: Accommodation,
        _newVisibility: Accommodation['visibility']
    ): void {
        checkCanUpdate(actor, entity);
    }

    // --- Admin Search Override ---

    /**
     * Overrides the default admin search to handle JSONB price filters.
     *
     * The accommodation `price` column is JSONB with a nested `price` key holding
     * the numeric nightly rate. Standard column filters cannot query inside JSONB,
     * so `minPrice` and `maxPrice` are extracted from `entityFilters` and converted
     * into raw SQL conditions that cast `(price->>'price')::numeric` for comparison.
     *
     * All other filters are passed through to the base implementation unchanged.
     *
     * @param params - The assembled admin search parameters from `adminList`.
     * @returns A paginated list of matching accommodations.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<AccommodationEntityFilters>
    ): Promise<PaginatedListOutput<Accommodation>> {
        // SPEC-169 §5.2: forced owner-scoping. An actor holding ONLY
        // ACCOMMODATION_VIEW_OWN (not VIEW_ALL) is physically unable to widen the query —
        // the server OVERWRITES any client-supplied ownerId with the actor's own id, closing
        // the "drop the filter and get everything" bypass. Staff (VIEW_ALL) list unscoped.
        // The owner column is 'ownerId' per the shared ownership descriptor (§5.6).
        const ownerScoped =
            !hasPermission(params.actor, PermissionEnum.ACCOMMODATION_VIEW_ALL) &&
            hasPermission(params.actor, PermissionEnum.ACCOMMODATION_VIEW_OWN);
        const scopedParams: AdminSearchExecuteParams<AccommodationEntityFilters> = ownerScoped
            ? {
                  ...params,
                  entityFilters: { ...params.entityFilters, ownerId: params.actor.id }
              }
            : params;

        const { entityFilters, ...rest } = scopedParams;
        const { minPrice, maxPrice, ...simpleFilters } = entityFilters;

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        if (minPrice !== undefined) {
            extraConditions.push(sql`(${accommodations.price}->>'price')::numeric >= ${minPrice}`);
        }
        if (maxPrice !== undefined) {
            extraConditions.push(sql`(${accommodations.price}->>'price')::numeric <= ${maxPrice}`);
        }

        const result = await super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });

        if (!result?.items) return result;

        return {
            ...result,
            items: projectAccommodationCityDestinationList(result.items)
        };
    }

    /**
     * Retrieves an accommodation by id for the ADMIN detail endpoint (SPEC-169 §2.1/§5.2).
     *
     * Unlike the generic {@link getById} (which applies `_canView`/`checkCanView` and therefore
     * grants access to ANY `PUBLIC` record), this uses {@link checkCanAdminView}: an actor with
     * `ACCOMMODATION_VIEW_ALL` sees any record; an actor with only `ACCOMMODATION_VIEW_OWN` sees
     * ONLY their own (others — including PUBLIC — resolve to `NOT_FOUND`, decision D2). The same
     * relation loading and read projections as `getById` are applied via `_afterGetByField`.
     *
     * @param actor - The actor performing the action.
     * @param id - The accommodation id.
     * @param ctx - Optional service context (transaction, hook state).
     * @returns A `ServiceOutput` with the accommodation, or a `ServiceError`.
     */
    public async adminGetById(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Accommodation | null>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: `adminGetById(id=${id})`,
            input: { actor, id },
            schema: z.object({ id: z.string() }),
            ctx: resolvedCtx,
            execute: async ({ id: validatedId }, validatedActor, execCtx) => {
                const relations = this.getDefaultGetByIdRelations();
                const where = { id: validatedId } as Record<string, unknown>;
                const entity = relations
                    ? await this.model.findOneWithRelations(where, relations, execCtx?.tx)
                    : await this.model.findOne(where, execCtx?.tx);

                if (!entity) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }

                checkCanAdminView(validatedActor, entity as Accommodation);

                return this._afterGetByField(entity as Accommodation, validatedActor, execCtx);
            }
        });
    }

    /**
     * Lightweight relation-selector lookup (SPEC-169 §5.5 / decision D4).
     *
     * Returns minimal `{ id, label, slug, type, destination }` items for populating admin
     * relation selectors WITHOUT requiring a broad `ACCOMMODATION_VIEW_ALL` grant. Gating is
     * admin-panel access only (see {@link checkCanFindOptions}); the route mirrors this with an
     * `ACCESS_PANEL_ADMIN`-only middleware gate. This deliberately bypasses the heavy
     * `checkCanAdminList` (VIEW_ALL/VIEW_OWN) used by {@link adminList}.
     *
     * Results are DRAFT-inclusive (the model's `searchWithRelations` only excludes soft-deleted
     * rows, never publication state) so relations can target unpublished accommodations.
     *
     * @param actor - The actor performing the lookup (must hold admin-panel access).
     * @param params - `{ q?: string, limit?: number }` — optional search term + result cap.
     * @param ctx - Optional service context (transaction).
     * @returns A `ServiceOutput` with `{ items }` of accommodation options.
     */
    public async findOptions(
        actor: Actor,
        params: { q?: string; limit?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: AccommodationOptionsItem[] }>> {
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

                const { items } = await this.model.searchWithRelations(
                    {
                        q: validatedInput.q,
                        page: 1,
                        pageSize: validatedInput.limit
                    } as AccommodationSearchInput,
                    execCtx?.tx
                );

                const options: AccommodationOptionsItem[] = items.map((item) => ({
                    id: item.id,
                    label: item.name,
                    slug: item.slug,
                    type: item.type,
                    destination: item.destination
                        ? {
                              id: item.destination.id,
                              name: item.destination.name,
                              slug: item.destination.slug
                          }
                        : null
                }));

                return { items: options };
            }
        });
    }

    // --- Lifecycle Hooks ---
    /**
     * @inheritdoc
     * Generates a unique slug for the accommodation before it is created.
     * This hook ensures that every accommodation has a URL-friendly and unique identifier.
     *
     * SPEC-172: also strips `amenityIds`/`featureIds` from the payload (they are
     * write-only junction sync inputs, not columns in the `accommodations` table)
     * and stores them in `ctx.hookState` so `_afterCreate` can execute the
     * transactional sync after the accommodation row is inserted.
     */
    protected async _beforeCreate(
        data: AccommodationCreateInput,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<Partial<Accommodation>> {
        // SPEC-143 #29: a service-suspended owner is "not selling", so they
        // cannot create new accommodations while the subscription is paused.
        // No exemption — this guards the owner target itself, not the caller.
        if (data.ownerId) {
            const owner = await this._userModel.findById(data.ownerId, ctx?.tx);
            if (owner?.serviceSuspended) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Cannot create an accommodation while the owner subscription is paused'
                );
            }
        }

        await this._assertDestinationIsCity(data.destinationId);

        // SPEC-172: capture junction sync inputs in hookState.
        // amenityIds / featureIds are write-only — they do not map to any column in
        // the `accommodations` table. Drizzle ignores unknown fields on insert,
        // so no DB error occurs, but the _afterCreate hook needs them from hookState.
        if (ctx.hookState) {
            // Store as-is so `_afterCreate` can distinguish undefined (no-op) from [] (clear all).
            ctx.hookState.pendingAmenityIds = data.amenityIds;
            ctx.hookState.pendingFeatureIds = data.featureIds;
            // SPEC-204 T-007: capture media value for shadow-write into accommodation_media.
            // undefined → field absent in payload → no-op; null/object → full replace.
            ctx.hookState.pendingMedia = (data as Record<string, unknown>).media as
                | import('@repo/schemas').Media
                | null
                | undefined;
        }

        // Only generate a slug if one is not already provided
        if (!data.slug) {
            const slug = await generateSlug(data.type as string, data.name as string);
            return { slug };
        }
        // If slug is provided, return empty object to avoid overwriting
        return {};
    }

    /**
     * SPEC-095: enforce that an accommodation can only reference a destination
     * of type `CITY`. Province- or higher-level destinations are too coarse;
     * neighborhood- or town-level destinations should resolve up to their CITY
     * ancestor before being assigned.
     *
     * @throws ServiceError(VALIDATION_ERROR) if the destination is missing or
     * not a CITY.
     */
    private async _assertDestinationIsCity(destinationId: string | undefined): Promise<void> {
        if (!destinationId) return;
        const destination = await this._destinationModel.findById(destinationId);
        if (!destination) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Destination ${destinationId} does not exist`
            );
        }
        if (destination.destinationType !== DestinationTypeEnum.CITY) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'destinationId must reference a destination of type CITY'
            );
        }
    }

    /**
     * Resolves the destination slug for a given destinationId using the model directly
     * to avoid service-layer permission checks in lifecycle hooks.
     */
    private async _resolveDestinationSlug(destinationId: string): Promise<string | undefined> {
        try {
            const destination = await this._destinationModel.findById(destinationId);
            return destination?.slug;
        } catch {
            // Destination lookup is best-effort for revalidation context enrichment.
            // Never let it break the main CRUD flow.
            return undefined;
        }
    }

    protected async _afterCreate(
        entity: Accommodation,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<Accommodation> {
        // SPEC-172: sync amenity/feature junctions transactionally.
        // pendingAmenityIds/pendingFeatureIds were captured by _beforeCreate.
        // undefined → skip (no-op contract); defined → sync inside the same ctx.tx.
        if (ctx.hookState?.pendingAmenityIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; call create() from within withServiceTransaction'
                );
            }
            await syncAmenityJunction({
                accommodationId: entity.id,
                amenityIds: ctx.hookState.pendingAmenityIds,
                junctionModel: this._rAmenityModel,
                amenityModel: this._amenityModel,
                tx: ctx.tx
            });
        }
        if (ctx.hookState?.pendingFeatureIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; call create() from within withServiceTransaction'
                );
            }
            await syncFeatureJunction({
                accommodationId: entity.id,
                featureIds: ctx.hookState.pendingFeatureIds,
                junctionModel: this._rFeatureModel,
                featureModel: this._featureCatalogModel,
                tx: ctx.tx
            });
        }
        // SPEC-204 T-007: shadow-write media into accommodation_media.
        // undefined → no-op (media field was absent in the create payload).
        if (ctx.hookState?.pendingMedia !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Media sync requires an active transaction; call create() from within withServiceTransaction'
                );
            }
            await syncAccommodationMedia({
                accommodationId: entity.id,
                media: ctx.hookState.pendingMedia as import('@repo/schemas').Media | null,
                mediaModel: this._accommodationMediaModel,
                tx: ctx.tx
            });
        }

        if (entity.destinationId) {
            await this.destinationService.updateAccommodationsCount(entity.destinationId, ctx);
        }
        const destinationSlug = entity.destinationId
            ? await this._resolveDestinationSlug(entity.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: entity.slug,
                destinationSlug,
                accommodationType: entity.type?.toLowerCase()
            });
        } catch (error) {
            this.logger.warn(
                { error, entityType: 'accommodation' },
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
            if (entity.richDescription) fields.richDescription = entity.richDescription;
            if (Object.keys(fields).length > 0) {
                void translationService
                    .translate({
                        entityType: 'accommodation',
                        entityId: entity.id,
                        fields
                    })
                    .catch(() => {});
            }
        }

        return entity;
    }

    /**
     * Captures the current `lifecycleState` of the entity before an update and stores it
     * in `ctx.hookState.previousLifecycleState` for use in `_afterUpdate`.
     *
     * Note: The base `_beforeUpdate` receives only the update payload, not the entity ID.
     * To retrieve the current state, we read `lifecycleState` from the incoming update data
     * is NOT sufficient — we need the state BEFORE the update. Because `AccommodationUpdateInputSchema`
     * omits `id`, the entity must be re-fetched via a model lookup keyed on any available field.
     * Since no unique field is reliably present in all update payloads (slug is optional),
     * we store `undefined` here and rely on idempotent logic in `_afterUpdate` instead.
     *
     * The `_afterUpdate` hook is idempotent: it only assigns HOST role if the user does not
     * already hold a privileged role, so repeated ACTIVE-state updates are safe no-ops.
     *
     * SPEC-172: also strips `amenityIds`/`featureIds` from the returned payload (they are
     * write-only junction sync inputs, not columns in the `accommodations` table) and stores
     * them in `ctx.hookState` for `_afterUpdate` to execute the transactional sync.
     *
     * @param data - The normalized update payload.
     * @param _actor - The actor performing the update.
     * @param ctx - Service execution context carrying transaction and hookState.
     * @returns The update data with junction sync fields removed (this hook also writes to hookState as a side effect).
     */
    protected async _beforeUpdate(
        data: AccommodationUpdateInput,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<Partial<Accommodation>> {
        // SPEC-095: when destinationId is being changed, validate it is a CITY.
        if (data.destinationId) {
            await this._assertDestinationIsCity(data.destinationId);
        }

        // Store the incoming lifecycleState (target state) so _afterUpdate can read it.
        // The idempotency guard in _afterUpdate handles the case where this is unchanged.
        if (ctx.hookState) {
            ctx.hookState.previousLifecycleState =
                typeof data.lifecycleState === 'string' ? data.lifecycleState : undefined;
        }

        // SPEC-212 AC-5: capture translatable field values from the entity BEFORE the update
        // so _afterUpdate can diff and re-translate ONLY fields that actually changed.
        // The entity ID is available via ctx.hookState.updateId (set by the update() override).
        if (ctx.hookState) {
            const entityId = ctx.hookState.updateId;
            if (entityId) {
                const current = await this.model.findById(entityId, ctx.tx);
                ctx.hookState.previousTranslatableFields = {
                    name: current?.name ?? undefined,
                    summary: current?.summary ?? undefined,
                    description: current?.description ?? undefined,
                    richDescription: current?.richDescription ?? undefined
                };
            }
        }

        // SPEC-172: capture junction sync inputs in hookState.
        // amenityIds / featureIds are write-only — they do not map to any column in
        // the `accommodations` table. Drizzle ignores unknown fields on update,
        // so no DB error occurs, but the _afterUpdate hook needs them from hookState.
        if (ctx.hookState) {
            // Store as-is so `_afterUpdate` can distinguish undefined (no-op) from [] (clear all).
            ctx.hookState.pendingAmenityIds = data.amenityIds;
            ctx.hookState.pendingFeatureIds = data.featureIds;
            // SPEC-204 DIRECT CUTOVER: pendingMedia is no longer captured for update.
            // The accommodation_media table is the sole source of truth for photos;
            // UPDATE only writes videos to the JSONB blob. Gallery management is done
            // via granular media endpoints, not via the bulk update path.
        }

        // SPEC-198.1: capture and strip aiAssistedFields (write-only, not a DB column).
        // The _afterUpdate hook persists them into extraInfo JSONB for audit/analytics.
        const cleanData = { ...data } as Record<string, unknown>;
        const aiAssistedFields = cleanData.aiAssistedFields as readonly string[] | undefined;
        cleanData.aiAssistedFields = undefined;

        if (aiAssistedFields !== undefined && ctx.hookState) {
            ctx.hookState.pendingAiAssistedFields = aiAssistedFields;
            this.logger.info(
                { aiAssistedFields },
                '[accommodation] AI-assisted fields detected in update payload'
            );
        }

        return cleanData as Partial<Accommodation>;
    }

    /**
     * Schedules revalidation after an accommodation update, and auto-assigns the HOST
     * role to the owning user when the accommodation's `lifecycleState` transitions to
     * `ACTIVE` for the first time.
     *
     * Role assignment is idempotent: if the user already holds `HOST`, `ADMIN`,
     * `CLIENT_MANAGER`, or `SUPER_ADMIN`, no change is made. This ensures the hook is
     * safe to fire on any ACTIVE-state update, not just the initial transition.
     *
     * Role assignment uses `UserModel` directly (bypassing `UserService` permission checks)
     * because this is a system-level side effect that should not depend on the actor's
     * permissions.
     *
     * SPEC-172: also syncs amenity/feature junctions when `pendingAmenityIds` or
     * `pendingFeatureIds` are present in `ctx.hookState` (set by `_beforeUpdate`).
     *
     * SPEC-204 DIRECT CUTOVER: does NOT sync `accommodation_media` on update.
     * The relational table is the sole source of truth for photos; gallery
     * management goes through dedicated media endpoints, not the bulk update path.
     *
     * @param entity - The updated accommodation entity.
     * @param _actor - The actor performing the update.
     * @param ctx - Service execution context carrying transaction and hookState.
     * @returns The updated entity unchanged.
     */
    protected async _afterUpdate(
        entity: Accommodation,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<Accommodation> {
        // SPEC-172: sync amenity/feature junctions transactionally.
        // pendingAmenityIds/pendingFeatureIds were captured by _beforeUpdate.
        // undefined → skip (no-op contract); defined → sync inside the same ctx.tx.
        if (ctx.hookState?.pendingAmenityIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; call update() from within withServiceTransaction'
                );
            }
            await syncAmenityJunction({
                accommodationId: entity.id,
                amenityIds: ctx.hookState.pendingAmenityIds,
                junctionModel: this._rAmenityModel,
                amenityModel: this._amenityModel,
                tx: ctx.tx
            });
        }
        if (ctx.hookState?.pendingFeatureIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; call update() from within withServiceTransaction'
                );
            }
            await syncFeatureJunction({
                accommodationId: entity.id,
                featureIds: ctx.hookState.pendingFeatureIds,
                junctionModel: this._rFeatureModel,
                featureModel: this._featureCatalogModel,
                tx: ctx.tx
            });
        }
        // SPEC-204 DIRECT CUTOVER: accommodation_media is NOT synced on update.
        // Photo gallery management is handled exclusively via granular media endpoints.
        // Videos remain in the JSONB blob and are written by the regular update path.

        const destinationSlug = entity.destinationId
            ? await this._resolveDestinationSlug(entity.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                id: entity.id,
                slug: entity.slug,
                destinationSlug,
                accommodationType: entity.type?.toLowerCase()
            });
        } catch (error) {
            this.logger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }

        // Auto-assign HOST role when accommodation becomes ACTIVE.
        // Uses an idempotency guard so this is safe on any ACTIVE-state update.
        if (entity.lifecycleState === LifecycleStatusEnum.ACTIVE && entity.ownerId) {
            await this._assignHostRoleIfNeeded(entity.ownerId, ctx);
        }

        // SPEC-198.1: persist AI-assisted fields into extraInfo JSONB for audit / analytics.
        // This runs as an additional targeted update because aiAssistedFields is a write-only
        // input field, not a column on the accommodations table. We merge into extraInfo
        // so existing keys (capacity, bedrooms, etc.) are preserved.
        const pendingAi = ctx.hookState?.pendingAiAssistedFields;
        if (pendingAi !== undefined && pendingAi.length > 0) {
            // TYPE-WORKAROUND: extraInfo DB column is jsonb $type<Record<string, unknown>>,
            // but the Zod schema types it as a specific shape. We merge at the DB level
            // via a raw cast since the schema's strict shape does not include aiAssistedFields.
            const currentExtra = (entity.extraInfo ?? {}) as Record<string, unknown>;
            const mergedExtra: Record<string, unknown> = {
                ...currentExtra,
                aiAssistedFields: [...pendingAi]
            };
            try {
                await this.model.update(
                    { id: entity.id },
                    { extraInfo: mergedExtra } as unknown as Partial<Accommodation>, // TYPE-WORKAROUND: extraInfo DB column is jsonb — merge result is Record<string,unknown> which doesn't match the Zod strict shape
                    ctx?.tx
                );
            } catch (error) {
                this.logger.warn(
                    { error, accommodationId: entity.id, aiAssistedFields: pendingAi },
                    '[accommodation] Failed to persist AI-assisted fields to extraInfo (non-blocking)'
                );
            }
        }

        // SPEC-212 AC-5: fire-and-forget auto-translation for changed fields only.
        // previousTranslatableFields was captured by _beforeUpdate; diff to skip
        // fields whose Spanish source text did not change in this update.
        const translationService = getTranslationService();
        if (translationService) {
            const fields = diffTranslatableFields({
                previous: ctx.hookState?.previousTranslatableFields ?? {},
                // TYPE-WORKAROUND: the entity's typed shape carries many non-string
                // fields; diffTranslatableFields only reads the listed string columns.
                current: entity as unknown as Record<string, string | null | undefined>,
                fieldNames: ['name', 'summary', 'description', 'richDescription']
            });
            if (Object.keys(fields).length > 0) {
                void translationService
                    .translate({
                        entityType: 'accommodation',
                        entityId: entity.id,
                        fields
                    })
                    .catch(() => {});
            }
        }

        return entity;
    }

    // --- Host Onboarding ---

    /**
     * Specialized create entry point for the public host-onboarding flow.
     *
     * Unlike the generic `create()` method, this one is callable by any authenticated
     * `USER` because it does NOT require the `ACCOMMODATION_CREATE` permission. It is
     * the single back-end seam used by `POST /api/v1/protected/host-onboarding/start`
     * and intentionally encodes the three terminal states a USER can land in when
     * trying to publish their first listing:
     *
     * - `created`  - no privileged role, no active draft. A fresh DRAFT is inserted
     *   with `ownerId = actor.id`, `lifecycleState = DRAFT`, `lastWarnedAt = null`,
     *   and the owner is atomically promoted USER -> HOST in the same transaction.
     *   The promotion is required so the owner can access the admin panel
     *   (`ACCESS_PANEL_ADMIN` is granted to HOST). The trial subscription is NOT
     *   created here — it is deferred to the first publish (see `publish()`).
     *
     * - `resumed`  - a non-deleted DRAFT already exists for this owner. The existing
     *   row is returned and the caller resumes onboarding on it. This is the
     *   idempotency guarantee: at most one active DRAFT per USER at any given time.
     *   Defensively re-promotes a `USER` who somehow has an active DRAFT (legacy
     *   data) so the admin-access invariant is restored.
     *
     * Slug generation and destination validation reuse the same `_beforeCreate` hook
     * as the generic create flow, so the resulting row is structurally identical to
     * one that would have been produced by `create()`.
     *
     * @param actor - The authenticated user starting onboarding.
     * @param input - Lean draft input (name, summary, type, destinationId, optional description).
     * @param ctx - Optional service context. When provided with a transaction, the
     *   operation participates in the existing transaction.
     * @returns A `ServiceOutput` containing the discriminated `HostOnboardingResult`.
     */
    public async createForOnboarding(
        actor: Actor,
        input: AccommodationCreateDraftHttp,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<HostOnboardingResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createForOnboarding',
            input: { actor, ...input },
            schema: AccommodationCreateDraftHttpSchema,
            ctx,
            execute: async (validatedData, validatedActor, execCtx) => {
                if (!validatedActor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Actor must be authenticated to start host onboarding'
                    );
                }

                const user = await this._userModel.findById(validatedActor.id, execCtx?.tx);

                const existingDraft = await this.model.findOne(
                    {
                        ownerId: validatedActor.id,
                        lifecycleState: LifecycleStatusEnum.DRAFT,
                        deletedAt: null
                    },
                    execCtx?.tx
                );
                if (existingDraft) {
                    // Defense-in-depth: legacy data may have a USER who owns
                    // an active DRAFT but was never promoted. Re-promote so
                    // the admin panel access gate is satisfied. No-op when the
                    // user is already HOST (most common path on resume).
                    if (user && user.role === RoleEnum.USER) {
                        await this._userModel.update(
                            { id: validatedActor.id },
                            { role: RoleEnum.HOST },
                            execCtx?.tx
                        );
                    }
                    return { status: 'resumed', accommodation: existingDraft };
                }

                const domainInput = httpToDomainAccommodationCreateDraft(
                    validatedData,
                    validatedActor.id
                );

                // Wrap the draft insert, slug generation, amenity junction sync,
                // and USER -> HOST role promotion in a single short transaction.
                //
                // _beforeCreate is called INSIDE the transaction (not before it) so
                // that ctx.hookState.pendingAmenityIds is captured into the same
                // txCtx that _afterCreate reads from. Calling _beforeCreate outside
                // the transaction would write hookState into execCtx, but _afterCreate
                // is called with txCtx (a separate ServiceContext), so the junction
                // data would be silently lost — amenities would never be synced.
                // (SPEC-258 B-API fix)
                //
                // Promoting at draft creation (rather than at first publish) is
                // required so the owner can access the admin panel right away
                // (`ACCESS_PANEL_ADMIN` is granted to HOST). The trial subscription
                // is still deferred to the first publish — see `publish()`.
                const result = await withServiceTransaction(
                    async (txCtx) => {
                        // Run _beforeCreate inside the tx so that hookState mutations
                        // (pendingAmenityIds, pendingFeatureIds, slug) are visible to
                        // _afterCreate which runs in the same txCtx.
                        const processedData = await this._beforeCreate(
                            domainInput,
                            validatedActor,
                            txCtx
                        );

                        const payload = {
                            ...domainInput,
                            ...processedData,
                            ownerId: validatedActor.id,
                            lifecycleState: LifecycleStatusEnum.DRAFT,
                            lastWarnedAt: null,
                            createdById: validatedActor.id,
                            updatedById: validatedActor.id
                        } as Partial<Accommodation>;

                        const next = await this.model.create(payload, txCtx.tx);
                        if (!next) {
                            throw new ServiceError(
                                ServiceErrorCode.INTERNAL_ERROR,
                                'Failed to create onboarding draft accommodation'
                            );
                        }
                        // Promote USER -> HOST. No-op if the actor is already HOST
                        // or higher — an existing host creating another draft flows
                        // here and the update is a benign no-op at the DB level.
                        if (user && user.role === RoleEnum.USER) {
                            await this._userModel.update(
                                { id: validatedActor.id },
                                { role: RoleEnum.HOST },
                                txCtx.tx
                            );
                        }
                        // Run _afterCreate INSIDE the transaction so that role
                        // promotion + amenity junction sync + media shadow-writes
                        // are all atomic. If any step throws, the whole tx rolls
                        // back (FIX 2, SPEC-204; extended by SPEC-258 B-API).
                        const after = await this._afterCreate(next, validatedActor, txCtx);
                        return after;
                    },
                    undefined,
                    { timeoutMs: 5000 }
                );

                return { status: 'created', accommodation: result };
            }
        });
    }

    /**
     * Creates a new accommodation, wrapping the operation in a database transaction
     * when `amenityIds`, `featureIds`, or `media` are present in the input
     * (SPEC-172 / SPEC-204).
     *
     * When none of those fields are present, delegates directly to `super.create()`
     * which behaves exactly as before — this override is a transparent pass-through
     * for callers that do not supply junction or media data.
     *
     * When junction sync fields OR a media payload ARE present, a
     * `withServiceTransaction` boundary is opened so that:
     * - The accommodation row insert
     * - The amenity junction inserts (via `_afterCreate` → `syncAmenityJunction`)
     * - The feature junction inserts (via `_afterCreate` → `syncFeatureJunction`)
     * - The accommodation_media shadow-writes (via `_afterCreate` → `syncAccommodationMedia`)
     *
     * all commit or roll back atomically. An unknown catalog ID in either list causes
     * the whole transaction to roll back with `VALIDATION_ERROR`.
     *
     * @param actor - The actor performing the action.
     * @param data - Create input, optionally including `amenityIds`, `featureIds`,
     *   and `media`.
     * @param ctx - Optional service context. When provided with a transaction, the
     *   operation participates in the existing transaction instead of opening a new one.
     */
    public override async create(
        actor: Actor,
        data: AccommodationCreateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Accommodation>> {
        const { amenityIds, featureIds } = data as {
            amenityIds?: readonly string[];
            featureIds?: readonly string[];
        };
        const needsMedia = (data as Record<string, unknown>).media !== undefined;
        const needsTx = amenityIds !== undefined || featureIds !== undefined || needsMedia;

        if (!needsTx) {
            return super.create(actor, data, ctx);
        }

        // Junction sync requested — ensure everything runs in a single transaction.
        // If the caller already provides ctx.tx, use it (no new boundary needed).
        if (ctx?.tx) {
            return super.create(actor, data, ctx);
        }

        return withServiceTransaction(
            async (txCtx) => {
                return super.create(actor, data, txCtx);
            },
            ctx,
            { timeoutMs: 10_000 }
        );
    }

    /**
     * Intercepts updates to enforce billing gates and route lifecycle transitions
     * through the correct publish flow.
     *
     * SPEC-217: gates ALL writes for regular HOST owners whose subscription is lapsed
     * (`subscription_required`). Admins and billing-exempt owners are excluded.
     * This applies to both name/field updates on published accommodations AND to
     * DRAFT→ACTIVE transitions. The gate fires before any DB write so lapsed hosts
     * can never mutate accommodations regardless of the payload.
     *
     * SPEC-172: when `amenityIds` or `featureIds` are present in the update payload,
     * wraps the full update + junction sync in a `withServiceTransaction` boundary so
     * the accommodation update and the junction mutations are fully atomic.
     *
     * Behaviour matrix:
     * - `publishDeps` wired AND owner has `subscription_required` AND actor is not admin:
     *   → reject with FORBIDDEN immediately (all writes blocked).
     * - `lifecycleState === ACTIVE` AND current state is NOT ACTIVE AND
     *   `publishDeps` are wired AND eligibility is NOT `subscription_required`:
     *   → apply any non-lifecycle fields via the regular update pipeline first,
     *     then delegate to `publish()`.
     * - Anything else → fall through to the standard `BaseCrudService.update()`
     *   (including the legacy `_afterUpdate.assignHostRoleIfNeeded` best-effort
     *   path used by callers that have not wired billing deps, e.g. unit tests
     *   exercising lifecycle hooks in isolation).
     *
     * The `publishDeps` gate keeps this override fully backwards compatible:
     * service consumers that never wired billing dependencies see the same
     * behaviour as before this method existed.
     */
    public override async update(
        actor: Actor,
        id: string,
        data: AccommodationUpdateInput,
        ctx?: ServiceContext<AccommodationHookState>
    ): Promise<ServiceOutput<Accommodation>> {
        // SPEC-212 AC-5: store the entity ID in hookState so _beforeUpdate can
        // fetch the pre-update entity and capture its translatable field values.
        const resolvedCtx: ServiceContext<AccommodationHookState> = { hookState: {}, ...ctx };
        if (resolvedCtx.hookState) {
            resolvedCtx.hookState.updateId = id;
        }

        // SPEC-217: fetch accommodation once so both the write-gate and the
        // publish branch below can reuse the result without a second DB round-trip.
        const current = this._publishDeps ? await this.model.findById(id, resolvedCtx?.tx) : null;

        // SPEC-217: gate ALL writes for regular HOST owners whose subscription is
        // lapsed. Admins (actor with ACCOMMODATION_UPDATE_ANY) and owners with
        // billing-exempt roles (ADMIN/SUPER_ADMIN/CLIENT_MANAGER) are excluded.
        // The gate only fires when publishDeps are wired; services instantiated
        // without billing deps (e.g. unit tests) are unaffected.
        if (this._publishDeps && current) {
            const actorIsAdmin = actor.permissions.includes(
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            );
            if (!actorIsAdmin) {
                // Perf optimisation (SPEC-217): when the actor IS the owner we can
                // derive the exempt check from actor.role directly, avoiding an extra
                // DB round-trip for the common owner-edits-own-accommodation path.
                const ownerIsBillingExempt =
                    actor.id === current.ownerId
                        ? AccommodationService.BILLING_EXEMPT_ROLES.has(actor.role)
                        : await this._userModel
                              .findById(current.ownerId, resolvedCtx?.tx)
                              .then(
                                  (owner) =>
                                      !!owner &&
                                      AccommodationService.BILLING_EXEMPT_ROLES.has(owner.role)
                              );
                if (!ownerIsBillingExempt) {
                    const eligibility = await this._publishDeps.checkEligibility(
                        current.ownerId,
                        resolvedCtx
                    );
                    if (eligibility === 'subscription_required') {
                        return {
                            error: new ServiceError(
                                ServiceErrorCode.FORBIDDEN,
                                'subscription_required'
                            )
                        };
                    }
                }
            }
        }

        const target = (data as { lifecycleState?: unknown }).lifecycleState;
        if (target === LifecycleStatusEnum.ACTIVE && this._publishDeps) {
            if (current && current.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
                const { lifecycleState: _drop, ...restFields } = data as Record<string, unknown>;
                // If the caller set `visibility` in the same request, it is applied
                // via `super.update` below; publish must then NOT auto-promote it.
                const callerSetVisibility = 'visibility' in restFields;
                if (Object.keys(restFields).length > 0) {
                    const updateResult = await super.update(
                        actor,
                        id,
                        restFields as AccommodationUpdateInput,
                        resolvedCtx
                    );
                    if (updateResult.error) return updateResult;
                }
                return this.publish(actor, id, resolvedCtx, { callerSetVisibility });
            }
        }

        // SPEC-204 DIRECT CUTOVER — media blob on update carries ONLY videos.
        //
        // The relational `accommodation_media` table is the sole source of truth for
        // photos (gallery, featuredImage, archivedGallery). Sending photo fields from
        // a bulk update would overwrite the blob's photo-related keys and create a
        // divergence with the table. We therefore strip those fields from any incoming
        // `media` object before passing it to `super.update()`.
        //
        // B-2 (videos preservation): videos remain in the JSONB blob. The web editor
        // sends only featuredImage+gallery, so `videos` is typically absent from
        // client payloads. Without the guard the existing videos array would be wiped
        // by the shallow JSONB merge. We carry it forward from the current DB row
        // whenever the payload omits the `videos` key entirely.
        //   - Absent `videos` key in payload → carry forward from existing row.
        //   - Explicit `videos: []` in payload → respected (clears the list).
        //
        // Fetch only when needed: if `data.media` is undefined the DB write won't
        // touch the media column at all, so no action is required.
        let normalizedData = data;
        if (data.media !== undefined) {
            // Strip photo fields — they are managed exclusively via media endpoints.
            const {
                gallery: _gallery,
                featuredImage: _featuredImage,
                archivedGallery: _archivedGallery,
                ...videosOnlyMedia
            } = data.media as Record<string, unknown>;
            // Carry forward existing videos when the payload omits the `videos` key.
            const existingVideos = (await this.model.findById(id, resolvedCtx?.tx))?.media?.videos;
            const shouldCarryVideos =
                existingVideos !== undefined &&
                !('videos' in (data.media as Record<string, unknown>));
            normalizedData = {
                ...data,
                media: {
                    ...videosOnlyMedia,
                    ...(shouldCarryVideos ? { videos: existingVideos } : {})
                }
            } as AccommodationUpdateInput;
        }

        // SPEC-172: if junction sync fields are present and no external tx exists,
        // open a transaction so the accommodation update + junction sync are atomic.
        // Media no longer needs a tx here: the JSONB write goes through model.update()
        // directly and is atomic by itself.
        const { amenityIds, featureIds } = normalizedData as {
            amenityIds?: readonly string[];
            featureIds?: readonly string[];
        };
        const needsTx = amenityIds !== undefined || featureIds !== undefined;

        if (needsTx && !resolvedCtx?.tx) {
            return withServiceTransaction(
                async (txCtx) => {
                    return super.update(actor, id, normalizedData, txCtx);
                },
                resolvedCtx,
                { timeoutMs: 10_000 }
            );
        }

        return super.update(actor, id, normalizedData, resolvedCtx);
    }

    /**
     * Atomically transitions an accommodation to `ACTIVE` (the "publish" flow),
     * orchestrating billing trial creation when the owner is publishing for the
     * first time.
     *
     * Role promotion (USER -> HOST) is NOT done here — it happens earlier, at
     * draft creation time in `createForOnboarding`, so the owner can access the
     * admin panel to complete the listing. By the time `publish` runs, the
     * owner is already HOST (or higher).
     *
     * Flow (Option C "external first, then short tx" pattern):
     *
     *  1. Fetch the accommodation. Authorize: actor must be the owner OR hold
     *     `ACCOMMODATION_UPDATE_ANY`.
     *  2. If already `ACTIVE`, return it idempotently.
     *  3. Resolve the owner. If the owner is billing-exempt (ADMIN/SUPER_ADMIN/
     *     CLIENT_MANAGER), skip the eligibility check entirely and just flip
     *     lifecycleState to ACTIVE.
     *  4. Otherwise (regular HOST), ask the billing layer for the owner's
     *     publish eligibility (`first_publish` / `has_active_sub` /
     *     `subscription_required`).
     *  5. `subscription_required` -> reject with FORBIDDEN.
     *  6. `first_publish` -> call `startTrial` OUTSIDE any transaction (timeout
     *     is enforced by the caller-supplied implementation). On failure,
     *     return `SERVICE_UNAVAILABLE` with no DB writes.
     *  7. Open a short transaction:
     *      - update accommodation lifecycleState to ACTIVE
     *  8. If the transaction throws AFTER `startTrial` succeeded, compensate
     *     by calling `cancelTrial(subscriptionId)`. If the cancel itself fails,
     *     log a CRITICAL inconsistency warning for manual reconciliation.
     *  9. Schedule revalidation as a best-effort side effect (never rolls back
     *     the publish on revalidation errors).
     *
     * @param actor - The user (or admin) performing the publish.
     * @param id - The accommodation ID to publish.
     * @param ctx - Optional service context. When provided with a transaction,
     *   the fetch-and-validate phase runs inside it; the publish transaction
     *   itself is always opened independently to keep the boundary short.
     * @param opts - Optional publish options.
     * @param opts.callerSetVisibility - When `true`, the caller already set the
     *   accommodation's `visibility` explicitly (e.g. an admin patch that carries
     *   both `lifecycleState: ACTIVE` and a `visibility` value), so publish must
     *   NOT auto-promote it. When omitted/`false`, publish promotes a `PRIVATE`
     *   onboarding draft to `PUBLIC` (see the visibility note inside the method).
     * @returns The updated `Accommodation` on success, or a `ServiceError` on
     *   any failure with codes: `NOT_FOUND`, `FORBIDDEN`, `CONFIGURATION_ERROR`,
     *   `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.
     */
    public async publish(
        actor: Actor,
        id: string,
        ctx?: ServiceContext,
        opts?: { readonly callerSetVisibility?: boolean }
    ): Promise<ServiceOutput<Accommodation>> {
        return this.runWithLoggingAndValidation({
            methodName: `publish(id=${id})`,
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_, validatedActor, execCtx) => {
                const accommodation = await this.model.findById(id, execCtx?.tx);
                if (!accommodation) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Accommodation ${id} not found`
                    );
                }

                const isOwner = accommodation.ownerId === validatedActor.id;
                const isAdmin = validatedActor.permissions.includes(
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                );
                if (!isOwner && !isAdmin) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: only the owner or an admin can publish this accommodation'
                    );
                }

                if (accommodation.lifecycleState === LifecycleStatusEnum.ACTIVE) {
                    return accommodation;
                }

                const owner = await this._userModel.findById(accommodation.ownerId, execCtx?.tx);
                // Owners with admin-grade roles (ADMIN/SUPER_ADMIN/CLIENT_MANAGER)
                // bypass billing entirely. Regular HOST users — including the
                // ones promoted from USER at draft creation — go through the
                // standard eligibility check and trial flow.
                const ownerIsBillingExempt =
                    !!owner && AccommodationService.BILLING_EXEMPT_ROLES.has(owner.role);

                let trialSubscriptionId: string | null = null;

                if (!ownerIsBillingExempt) {
                    if (!this._publishDeps) {
                        throw new ServiceError(
                            ServiceErrorCode.CONFIGURATION_ERROR,
                            'Publish requires billing dependencies; AccommodationService was instantiated without publishDeps'
                        );
                    }
                    const eligibility = await this._publishDeps.checkEligibility(
                        accommodation.ownerId,
                        execCtx
                    );
                    if (eligibility === 'subscription_required') {
                        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'subscription_required');
                    }
                    if (eligibility === 'first_publish') {
                        try {
                            const result = await this._publishDeps.startTrial({
                                ownerId: accommodation.ownerId,
                                accommodationId: id
                            });
                            trialSubscriptionId = result.subscriptionId;
                            // SPEC-222 Part 1: emit a single structured linkage line
                            // tying the trial subscription to the accommodation that
                            // triggered it and its owner. Searching the observability
                            // stack by ANY of these ids surfaces the whole linkage,
                            // even though trials are per-owner. Logging only — no extra
                            // remote call, no change to publish timing/compensation.
                            this.logger.info(
                                {
                                    subscriptionId: trialSubscriptionId,
                                    accommodationId: id,
                                    ownerId: accommodation.ownerId,
                                    planSlug: 'owner-basico',
                                    eligibility
                                },
                                '[accommodation.publish] trial subscription linkage'
                            );
                        } catch (error) {
                            this.logger.error(
                                { error, ownerId: accommodation.ownerId, accommodationId: id },
                                '[accommodation.publish] Trial subscription creation failed'
                            );
                            throw new ServiceError(
                                ServiceErrorCode.SERVICE_UNAVAILABLE,
                                'service_unavailable'
                            );
                        }
                    }
                }

                // Visibility promotion (SPEC-217): onboarding drafts are created
                // PRIVATE (intentionally hidden while unpublished). Publishing must
                // reveal them so the public detail-by-slug endpoint can serve the
                // listing; otherwise `checkCanView` rejects anonymous readers (404).
                // We promote ONLY a PRIVATE source — never RESTRICTED or PUBLIC — so a
                // deliberately-restricted listing is not silently leaked public on
                // activation. And when the caller set `visibility` explicitly in the
                // same request (`callerSetVisibility`), we respect their choice and
                // skip promotion entirely.
                const shouldPromoteVisibility =
                    !opts?.callerSetVisibility &&
                    accommodation.visibility === VisibilityEnum.PRIVATE;

                let updated: Accommodation;
                try {
                    updated = await withServiceTransaction(
                        async (txCtx) => {
                            const next = await this.model.update(
                                { id },
                                {
                                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                                    ...(shouldPromoteVisibility
                                        ? { visibility: VisibilityEnum.PUBLIC }
                                        : {}),
                                    updatedById: validatedActor.id
                                },
                                txCtx.tx
                            );
                            if (!next) {
                                throw new ServiceError(
                                    ServiceErrorCode.INTERNAL_ERROR,
                                    'Failed to flip accommodation lifecycleState to ACTIVE'
                                );
                            }
                            return next;
                        },
                        undefined,
                        { timeoutMs: 5000 }
                    );
                } catch (txError) {
                    if (trialSubscriptionId && this._publishDeps) {
                        try {
                            await this._publishDeps.cancelTrial(trialSubscriptionId);
                            this.logger.warn(
                                {
                                    trialSubscriptionId,
                                    ownerId: accommodation.ownerId,
                                    accommodationId: id,
                                    txError
                                },
                                '[accommodation.publish] Local tx failed after trial creation; trial cancelled as compensation'
                            );
                        } catch (cancelError) {
                            this.logger.error(
                                {
                                    cancelError,
                                    txError,
                                    trialSubscriptionId,
                                    ownerId: accommodation.ownerId,
                                    accommodationId: id
                                },
                                '[accommodation.publish] CRITICAL: trial subscription was created but local tx failed AND cancel compensation also failed; manual reconciliation required'
                            );
                        }
                    }
                    throw txError;
                }

                const destinationSlug = updated.destinationId
                    ? await this._resolveDestinationSlug(updated.destinationId)
                    : undefined;
                try {
                    getRevalidationService()?.scheduleRevalidation({
                        entityType: 'accommodation',
                        slug: updated.slug,
                        destinationSlug,
                        accommodationType: updated.type?.toLowerCase()
                    });
                } catch (error) {
                    this.logger.warn(
                        { error, entityType: 'accommodation' },
                        '[accommodation.publish] Revalidation scheduling failed (non-blocking)'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Transitions an accommodation from `ACTIVE` to `INACTIVE` (paused).
     *
     * The accommodation stops appearing on the public site immediately after
     * unpublishing. It can be reactivated at any time by the owner. This is a
     * soft pause — the accommodation retains all data, FAQs, media, and settings.
     *
     * Permission model mirrors `publish()`:
     * - The actor must be the owner (`ACCOMMODATION_UPDATE_OWN`) or hold
     *   `ACCOMMODATION_UPDATE_ANY`.
     * - Owner-suspended accommodations are also blocked by `checkCanUpdate`.
     *
     * @param actor - The actor performing the unpublish action.
     * @param id    - The accommodation ID to unpublish.
     * @param ctx   - Optional service context (transaction / hookState).
     * @returns A `ServiceOutput` containing the updated accommodation, or a
     *   `ServiceError` on permission / state / update failure.
     *
     * @throws {ServiceError} NOT_FOUND    — accommodation does not exist.
     * @throws {ServiceError} FORBIDDEN    — actor lacks update permission or owner is suspended.
     * @throws {ServiceError} VALIDATION_ERROR — accommodation is not currently ACTIVE.
     * @throws {ServiceError} INTERNAL_ERROR — DB update returned nothing.
     */
    public async unpublish(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Accommodation>> {
        return this.runWithLoggingAndValidation({
            methodName: `unpublish(id=${id})`,
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_, validatedActor, execCtx) => {
                const accommodation = await this.model.findById(id, execCtx?.tx);
                if (!accommodation) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Accommodation ${id} not found`
                    );
                }

                // Reuse checkCanUpdate: verifies ownership OR ACCOMMODATION_UPDATE_ANY,
                // and blocks edits when ownerSuspended (billing pause).
                checkCanUpdate(validatedActor, accommodation);

                if (accommodation.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Only an active accommodation can be unpublished'
                    );
                }

                const updated = await this.model.update(
                    { id },
                    {
                        lifecycleState: LifecycleStatusEnum.INACTIVE,
                        updatedById: validatedActor.id
                    },
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to flip accommodation lifecycleState to INACTIVE'
                    );
                }

                const destinationSlug = updated.destinationId
                    ? await this._resolveDestinationSlug(updated.destinationId)
                    : undefined;
                try {
                    getRevalidationService()?.scheduleRevalidation({
                        entityType: 'accommodation',
                        slug: updated.slug,
                        destinationSlug,
                        accommodationType: updated.type?.toLowerCase()
                    });
                } catch (error) {
                    this.logger.warn(
                        { error, entityType: 'accommodation' },
                        '[accommodation.unpublish] Revalidation scheduling failed (non-blocking)'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Assigns the `HOST` role to a user if they do not already hold a privileged role.
     *
     * Privileged roles that already imply host capabilities (no re-assignment needed):
     * `HOST`, `ADMIN`, `CLIENT_MANAGER`, `SUPER_ADMIN`.
     *
     * This is a best-effort operation: errors are logged but never propagated so that
     * a role-assignment failure never rolls back the accommodation update itself.
     *
     * @param ownerId - The ID of the user to potentially assign the HOST role.
     * @param ctx - Service execution context carrying transaction and hookState.
     */
    private async _assignHostRoleIfNeeded(ownerId: string, ctx: ServiceContext): Promise<void> {
        try {
            const user = await this._userModel.findById(ownerId, ctx?.tx);
            if (!user) {
                this.logger.warn(
                    { ownerId },
                    '[accommodation] Cannot assign HOST role: owner user not found'
                );
                return;
            }
            if (AccommodationService.PRIVILEGED_ROLES.has(user.role)) {
                // User already has a privileged role — no action required.
                return;
            }
            await this._userModel.update({ id: ownerId }, { role: RoleEnum.HOST }, ctx?.tx);
            this.logger.info(
                { ownerId, previousRole: user.role },
                '[accommodation] HOST role assigned to owner after accommodation became ACTIVE'
            );
        } catch (error) {
            this.logger.warn(
                { error, ownerId },
                '[accommodation] Failed to assign HOST role (non-blocking)'
            );
        }
    }

    protected async _afterUpdateVisibility(
        entity: Accommodation,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Accommodation> {
        const destinationSlug = entity.destinationId
            ? await this._resolveDestinationSlug(entity.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: entity.slug,
                destinationSlug,
                accommodationType: entity.type?.toLowerCase()
            });
        } catch (error) {
            this.logger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id, ctx?.tx);
        if (entity && ctx.hookState) {
            ctx.hookState.restoredAccommodation = {
                slug: entity.slug,
                destinationId: entity.destinationId,
                type: entity.type
            };
        }
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<{ count: number }> {
        const restored = ctx.hookState?.restoredAccommodation;
        if (restored?.destinationId) {
            await this.destinationService.updateAccommodationsCount(restored.destinationId, ctx);
        }
        const destinationSlug = restored?.destinationId
            ? await this._resolveDestinationSlug(restored.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: restored?.slug,
                destinationSlug,
                accommodationType: restored?.type?.toLowerCase()
            });
        } catch (error) {
            this.logger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id, ctx?.tx);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEntity = {
                destinationId: entity.destinationId,
                slug: entity.slug,
                type: entity.type
            };
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<CountResponse> {
        const deleted = ctx.hookState?.deletedEntity;
        const deletedId = ctx.hookState?.deletedEntityId;

        // SPEC-085 AC-008-01: cascade close all conversations attached to the
        // soft-deleted accommodation so guests cannot reply on a stale thread.
        // Best-effort: a failure here logs but does not block the accommodation
        // soft-delete itself.
        if (deletedId && ctx?.tx) {
            try {
                await this.conversationService.closeAllForAccommodation(deletedId, ctx.tx);
            } catch (error) {
                this.logger.warn(
                    { error, accommodationId: deletedId },
                    'closeAllForAccommodation failed (non-blocking)'
                );
            }
        }

        if (deleted?.destinationId) {
            await this.destinationService.updateAccommodationsCount(deleted.destinationId, ctx);
        }
        const destinationSlug = deleted?.destinationId
            ? await this._resolveDestinationSlug(deleted.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: deleted?.slug,
                destinationSlug,
                accommodationType: deleted?.type?.toLowerCase()
            });
        } catch (error) {
            this.logger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id, ctx?.tx);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEntity = {
                destinationId: entity.destinationId,
                slug: entity.slug,
                type: entity.type
            };
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<CountResponse> {
        const deleted = ctx.hookState?.deletedEntity;
        if (deleted?.destinationId) {
            await this.destinationService.updateAccommodationsCount(deleted.destinationId, ctx);
        }
        const destinationSlug = deleted?.destinationId
            ? await this._resolveDestinationSlug(deleted.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: deleted?.slug,
                destinationSlug,
                accommodationType: deleted?.type?.toLowerCase()
            });
        } catch (error) {
            this.logger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        // Best-effort Cloudinary cleanup after confirmed hard delete
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            const env = resolveEnvironment();
            const prefix = `hospeda/${env}/accommodations/${ctx.hookState.deletedEntityId}/`;
            try {
                await this.mediaProvider.deleteByPrefix({ prefix });
            } catch (mediaError) {
                this.logger.warn(
                    { error: mediaError, prefix },
                    '[media] Failed to clean up Cloudinary assets for accommodation'
                );
            }
        }
        return result;
    }

    // --- Core Logic ---
    /**
     * @inheritdoc
     * Executes the database search for accommodations with destination and owner relations.
     *
     * Uses `searchWithRelations` so that the destination and owner objects are always
     * included in the response, matching the behaviour of the `list` method.
     * All AccommodationSearchInput fields are forwarded to the model, including
     * price-range filters (JSONB), capacity ranges (JSONB extraInfo), minRating,
     * and amenity EXISTS subquery filters.
     *
     * @param params The validated and processed search parameters.
     * @param actor The actor performing the search.
     * @returns A paginated list of accommodations with destination and owner populated.
     */
    protected async _executeSearch(
        params: AccommodationSearchInput,
        actor: Actor,
        ctx: ServiceContext
    ) {
        const hasVipAccess =
            actor.entitlements?.has('vip_promotions_access') ||
            hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

        // BaseCrudRead.search strips page/pageSize/sortBy/sortOrder from params
        // before reaching this hook (SPEC-088) and re-publishes them via
        // ctx.pagination. Forward them explicitly so the model uses the
        // caller-provided pageSize instead of falling back to its default of 10.
        // An owner listing their OWN accommodations (ownerId === self) still
        // sees their service-suspended listings; for everyone else (non-VIP)
        // suspended listings are hidden. Admins / VIP see all. (SPEC-143 #29)
        //
        // SPEC-167 T-004: plan-restricted accommodations follow the same owner
        // visibility rule — owner always sees their own restricted items (so they
        // can choose/restore); everyone else (non-VIP) has them hidden.
        const isOwnScope = !!params.ownerId && params.ownerId === actor.id;

        return this.model.searchWithRelations({
            ...params,
            page: ctx.pagination?.page ?? 1,
            pageSize: ctx.pagination?.pageSize ?? 10,
            sortBy: ctx.pagination?.sortBy,
            sortOrder: ctx.pagination?.sortOrder,
            excludeRestricted: !hasVipAccess,
            excludeOwnerSuspended: !hasVipAccess && !isOwnScope,
            excludePlanRestricted: !hasVipAccess && !isOwnScope,
            // Restrict to ACTIVE lifecycle state for public reads.
            // Owners always see their own non-ACTIVE accommodations (so their
            // "my listings" view shows DRAFTs); VIP/staff see all lifecycleStates.
            activeOnly: !hasVipAccess && !isOwnScope
        });
    }

    /**
     * @inheritdoc
     * Executes the database count for accommodations.
     * @param params The validated and processed search parameters.
     * @param actor The actor performing the count.
     * @returns An object containing the total count of accommodations matching the criteria.
     */
    protected async _executeCount(
        params: AccommodationSearchInput,
        actor: Actor,
        _ctx: ServiceContext
    ) {
        const hasVipAccess =
            actor.entitlements?.has('vip_promotions_access') ||
            hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

        // Mirror _executeSearch so count and search agree on what is visible.
        // SPEC-167 T-004: plan-restricted items are excluded from public counts
        // but owners always see their own (isOwnScope mirrors ownerSuspended rule).
        const isOwnScope = !!params.ownerId && params.ownerId === actor.id;

        return this.model.countByFilters({
            ...params,
            excludeRestricted: !hasVipAccess,
            excludeOwnerSuspended: !hasVipAccess && !isOwnScope,
            excludePlanRestricted: !hasVipAccess && !isOwnScope,
            activeOnly: !hasVipAccess && !isOwnScope
        });
    }

    /**
     * Search accommodations with destination and owner relations for list display.
     * This method follows the complete service pipeline with validation, permissions,
     * normalization, and lifecycle hooks while providing enriched data for UI lists.
     *
     * @param actor - The actor performing the action
     * @param params - Search parameters including filters and pagination
     * @param _ctx - Optional service context (reserved for future transaction propagation)
     * @returns Accommodations with related destination and owner data
     */
    public async searchWithRelations(
        actor: Actor,
        params: AccommodationSearchInput,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationSearchResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'searchWithRelations',
            input: { actor, ...params },
            schema: this.searchSchema,
            execute: async (validatedParams, validatedActor) => {
                // 1. Permission Check
                await this._canSearch(validatedActor);

                // 2. Normalization
                const normalizedParams = this.normalizers?.search
                    ? await this.normalizers.search(validatedParams, validatedActor)
                    : validatedParams;

                // 3. Lifecycle Hook: Before Search
                const processedParams = await this._beforeSearch(
                    normalizedParams,
                    validatedActor,
                    {}
                );

                // 4. Execute search with relations
                const page = processedParams.page ?? 1;
                const pageSize = processedParams.pageSize ?? 10;

                const hasVipAccess =
                    validatedActor.entitlements?.has('vip_promotions_access') ||
                    hasPermission(validatedActor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

                // Forward every validated field to the model via spread so the
                // search path stays in lockstep with `_executeSearch`. The
                // previous manual literal silently dropped fields added later
                // (anyAmenityGroups, capacity/bedroom/bathroom ranges, minRating,
                // sorts) — spreading processedParams guarantees new optional
                // filters added to the schema reach the model automatically.
                const isOwnScope =
                    !!processedParams.ownerId && processedParams.ownerId === validatedActor.id;

                // SPEC-167 T-004: plan-restricted accommodations are excluded from
                // public reads, but owners always see their own restricted items.
                const modelParams = {
                    ...processedParams,
                    page,
                    pageSize,
                    excludeRestricted: !hasVipAccess,
                    excludeOwnerSuspended: !hasVipAccess && !isOwnScope,
                    excludePlanRestricted: !hasVipAccess && !isOwnScope,
                    activeOnly: !hasVipAccess && !isOwnScope
                };

                const result = await this.model.searchWithRelations(modelParams);

                // 5. Lifecycle Hook: After Search (adapt the result format)
                const adaptedResult = {
                    items: result.items.map((item) => item as Accommodation),
                    total: result.total,
                    page,
                    pageSize
                };

                const projected = await this._afterSearch(adaptedResult, validatedActor, {});

                // 6. Return in AccommodationSearchResult format
                return {
                    data: projected.items,
                    pagination: {
                        page,
                        pageSize,
                        total: result.total,
                        totalPages: Math.ceil(result.total / pageSize),
                        hasNextPage: page * pageSize < result.total,
                        hasPreviousPage: page > 1
                    }
                };
            }
        });
    }

    /**
     * Returns top-rated accommodations, optionally filtered by destination, type, and featured flag.
     * The output is a compact summary tailored for cards/lists and includes joined amenities/features only when related.
     * @param actor - The actor performing the action
     * @param params - Input with optional pageSize, destinationId, type and onlyFeatured
     * @param ctx - Optional service context for transaction propagation
     * @returns List of summarized accommodations ordered by rating
     */
    public async getTopRated(
        actor: Actor,
        params: AccommodationTopRatedParams,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRated',
            input: { ...params, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (validated, actor) => {
                await this._canList(actor);

                const hasVipAccess =
                    actor.entitlements?.has('vip_promotions_access') ||
                    hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

                const items = await this.model.findTopRated({
                    limit: validated.pageSize,
                    destinationId: validated.destinationId,
                    excludeRestricted: !hasVipAccess,
                    excludeOwnerSuspended: !hasVipAccess,
                    // SPEC-167 T-004: top-rated list is always a public view (no
                    // own-scope), so plan-restricted mirrors ownerSuspended exactly.
                    excludePlanRestricted: !hasVipAccess,
                    activeOnly: !hasVipAccess
                    // type: validated.type, // Field not available in schema
                    // onlyFeatured: validated.onlyFeatured // Field not available in schema
                });

                const normalized =
                    items.map(
                        (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                    ) ?? [];

                // SPEC-204 T-013: batch-read `media` from the relational table (no N+1).
                const accommodations = await attachComposedMediaList({
                    items: normalized,
                    mediaModel: this._accommodationMediaModel,
                    tx: ctx?.tx
                });

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Gets a summary for a specific accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing id or slug
     * @param ctx - Optional service context for transaction propagation
     * @returns The accommodation summary wrapped in an object
     */
    public async getSummary(
        actor: Actor,
        data: AccommodationSummaryParams,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationSummaryWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...data, actor },
            schema: AccommodationSummaryParamsSchema,
            execute: async (validated, actor, execCtx) => {
                const { id } = validated;
                // Use model.findOne() directly to avoid loading 7 detail relations
                // (destination, owner, amenities, features, reviews, faqs, tags)
                // that getSummary immediately discards.
                const entity = await this.model.findOne({ id }, execCtx?.tx);
                if (!entity) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canView(actor, entity as Accommodation);
                if (!entity.location) {
                    this.logger.warn(`Accommodation ${entity.id} has no location for summary.`);
                    return { accommodation: null };
                }
                // SPEC-204 T-013: compose `media` from the relational table so the
                // summary cover image matches the relational source of truth.
                const withMedia = await attachComposedMedia({
                    entity: entity as Accommodation,
                    mediaModel: this._accommodationMediaModel,
                    tx: execCtx?.tx
                });
                const accommodation = {
                    id: entity.id,
                    type: entity.type,
                    ownerId: entity.ownerId,
                    slug: entity.slug,
                    name: entity.name,
                    summary: entity.summary,
                    isFeatured: entity.isFeatured,
                    reviewsCount: 0,
                    averageRating: 0,
                    media: withMedia?.media ?? entity.media,
                    location: entity.location
                };
                return { accommodation };
            }
        });
    }

    /**
     * Returns the summary shape for each requested accommodation, respecting per-item
     * visibility rules. Items that the actor cannot view are silently excluded so a
     * single non-viewable accommodation does not block the entire comparison.
     *
     * The caller is responsible for the entitlement + plan-limit gate
     * (enforced by `gateComparator()` on the route before this method is reached).
     *
     * Projection pipeline (mirrors `_afterList`):
     * - Composed media batch-read via {@link attachComposedMediaList}
     * - Location privacy obfuscation via {@link applyAccommodationLocationPrivacyList}
     *   (adds `approximateLocation`, strips exact coordinates for non-owners/non-admin)
     *
     * The result is reordered to match the order of `data.ids`; absent/invisible IDs
     * are simply omitted from the output.
     *
     * @param actor - The actor performing the comparison
     * @param data - Object containing the list of accommodation UUIDs to compare
     * @param _ctx - Optional service context for transaction propagation
     * @returns Viewable accommodations in summary shape, ordered to match `data.ids`
     */
    public async compareByIds(
        actor: Actor,
        data: { ids: string[] },
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: AccommodationSummary[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'compareByIds',
            input: { ...data, actor },
            schema: AccommodationComparisonRequestSchema,
            execute: async (validated, _validatedActor, execCtx) => {
                // Fetch all rows in one DB round-trip; does NOT filter soft-deleted
                const rows = await this.model.findByIds(validated.ids, execCtx?.tx);

                // Filter to viewable items. _canView throws a ServiceError for
                // soft-deleted, inactive, plan-restricted, suspended, or RESTRICTED
                // visibility accommodations the actor cannot access. We catch and drop
                // those silently so a single invisible item does not 500 the request.
                const viewableRows: Accommodation[] = [];
                for (const row of rows) {
                    try {
                        this._canView(actor, row as Accommodation);
                        viewableRows.push(row as Accommodation);
                    } catch {
                        // Non-viewable accommodation — excluded from comparison result
                    }
                }

                // Batch-read composed media from the relational table (no N+1)
                const withMedia = await attachComposedMediaList({
                    items: viewableRows,
                    mediaModel: this._accommodationMediaModel,
                    tx: execCtx?.tx
                });

                // Apply privacy-aware location projection:
                // adds `approximateLocation`, strips exact fields for non-owners/non-admin
                const salt = this.getLocationSalt();
                const withPrivacy = salt
                    ? applyAccommodationLocationPrivacyList(withMedia, { actor, salt })
                    : withMedia;

                // Cast to expose the dynamically-added `approximateLocation` field
                // that `applyAccommodationLocationPrivacyList` injects at runtime but
                // that the base `Accommodation` type does not declare.
                type WithApproxLocation = Accommodation & {
                    approximateLocation?: AccommodationSummary['approximateLocation'];
                };
                const projectedItems = withPrivacy as WithApproxLocation[];

                // Build an id-keyed map for O(n) reordering
                const summaryMap = new Map<string, AccommodationSummary>();
                for (const item of projectedItems) {
                    const summary: AccommodationSummary = {
                        id: item.id,
                        name: item.name,
                        slug: item.slug,
                        summary: item.summary,
                        type: item.type,
                        price: item.price,
                        location: item.location,
                        media: item.media,
                        isFeatured: item.isFeatured,
                        ownerId: item.ownerId,
                        // Denormalized rating columns on the accommodations table —
                        // surfaced so the comparison matrix can rank by quality.
                        reviewsCount: item.reviewsCount ?? 0,
                        averageRating: item.averageRating ?? 0,
                        ...(item.approximateLocation !== undefined && {
                            approximateLocation: item.approximateLocation
                        })
                    };
                    summaryMap.set(item.id, summary);
                }

                // Reorder to match the original ids order (inArray/findByIds does NOT
                // preserve order). IDs missing from the viewable set are simply omitted.
                const items: AccommodationSummary[] = [];
                for (const id of validated.ids) {
                    const summary = summaryMap.get(id);
                    if (summary) {
                        items.push(summary);
                    }
                }

                return { items };
            }
        });
    }

    /**
     * Gets aggregated statistics for a single accommodation
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodation id or slug
     * @param ctx - Optional service context for transaction propagation
     * @returns The accommodation statistics wrapped in a stats object
     */
    public async getStats(
        actor: Actor,
        data: IdOrSlugParams,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationStatsWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { ...data, actor },
            schema: IdOrSlugParamsSchema,
            execute: async (validatedParams, validatedActor, execCtx) => {
                // Use utility to determine if it's ID or slug
                const { field } = parseIdOrSlug(validatedParams.idOrSlug);

                // Use model.findOne() directly to avoid loading 7 detail relations
                // that getStats immediately discards (only uses flat fields).
                const entity = await this.model.findOne(
                    { [field]: validatedParams.idOrSlug },
                    execCtx?.tx
                );

                if (!entity) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }

                await this._canView(validatedActor, entity as Accommodation);

                // Create the stats object following AccommodationStatsSchema format
                const stats: AccommodationStats = {
                    total: 1, // Single accommodation
                    totalFeatured: entity.isFeatured ? 1 : 0,
                    averagePrice: entity.price?.price,
                    averageRating: entity.averageRating ?? 0,
                    totalByType: {
                        [entity.type]: 1
                    }
                };

                // Return wrapped in AccommodationStatsWrapper format
                return { stats };
            }
        });
    }

    /**
     * Gets accommodations by destination.
     *
     * Uses `searchWithRelations` (not the raw `findAll`) so the public visibility
     * predicate is enforced at the DB query level:
     * - `ownerSuspended=true` accommodations are hidden from public actors.
     * - `planRestricted=true` accommodations are hidden from public actors.
     *
     * SPEC-167 T-026: this is a public-only path — there is no `ownerId` in the
     * params, so there is no own-scope exemption. The only bypass is VIP access
     * (`vip_promotions_access` entitlement or `ACCOMMODATION_VIEW_ALL` permission),
     * which mirrors the predicate applied by `getTopRatedByDestination`.
     *
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId
     * @param ctx - Optional service context for transaction propagation
     * @returns The list of accommodations wrapped in accommodations array
     */
    public async getByDestination(
        actor: Actor,
        data: AccommodationByDestinationParams,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByDestination',
            input: { ...data, actor },
            schema: AccommodationByDestinationParamsSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);

                const hasVipAccess =
                    validatedActor.entitlements?.has('vip_promotions_access') ||
                    hasPermission(validatedActor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

                const result = await this.model.searchWithRelations(
                    {
                        destinationId: validated.destinationId,
                        page: validated.page ?? 1,
                        pageSize: validated.pageSize ?? 10,
                        // SPEC-167 T-026: destination list is always a public view (no
                        // own-scope), so both visibility flags mirror each other exactly.
                        excludeOwnerSuspended: !hasVipAccess,
                        excludePlanRestricted: !hasVipAccess,
                        activeOnly: !hasVipAccess
                    },
                    ctx?.tx
                );

                const normalized = Array.isArray(result.items)
                    ? result.items.map(
                          (item) =>
                              normalizeAccommodationOutput(item, validatedActor) as Accommodation
                      )
                    : [];

                // SPEC-204 T-013: batch-read `media` from the relational table (no N+1).
                const accommodations = await attachComposedMediaList({
                    items: normalized,
                    mediaModel: this._accommodationMediaModel,
                    tx: ctx?.tx
                });

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Gets top-rated accommodations by destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId (required)
     * @param ctx - Optional service context for transaction propagation
     * @returns The list of top-rated accommodations for the destination
     */
    public async getTopRatedByDestination(
        actor: Actor,
        data: AccommodationTopRatedParams,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRatedByDestination',
            input: { ...data, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (validated, actor) => {
                await this._canList(actor);

                // For this method, destinationId is required
                if (!validated.destinationId) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'destinationId is required for getTopRatedByDestination'
                    );
                }

                const hasVipAccess =
                    actor.entitlements?.has('vip_promotions_access') ||
                    hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

                const items = await this.model.findTopRated({
                    limit: validated.pageSize,
                    destinationId: validated.destinationId,
                    excludeRestricted: !hasVipAccess,
                    excludeOwnerSuspended: !hasVipAccess,
                    // SPEC-167 T-004: destination top-rated is always a public view.
                    excludePlanRestricted: !hasVipAccess,
                    activeOnly: !hasVipAccess
                });

                const normalized =
                    items.map(
                        (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                    ) ?? [];

                // SPEC-204 T-013: batch-read `media` from the relational table (no N+1).
                const accommodations = await attachComposedMediaList({
                    items: normalized,
                    mediaModel: this._accommodationMediaModel,
                    tx: ctx?.tx
                });

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Adds a FAQ to an accommodation.
     *
     * Assigns `displayOrder = max(current displayOrder) + 1` so new FAQs always
     * appear at the end of the ordered list. When no FAQs exist yet, starts at 0.
     *
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId and faq
     * @param ctx - Optional service context for transaction propagation
     * @returns The created FAQ
     */
    public async addFaq(
        actor: Actor,
        data: AccommodationFaqAddInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationFaqSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addFaq',
            input: { ...data, actor },
            schema: AccommodationFaqAddInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                // Compute next displayOrder: max(existing) + 1, or 0 if none yet.
                const existing = await faqModel.findAll(
                    { accommodationId: validated.accommodationId, deletedAt: null },
                    { pageSize: 1, sortBy: 'displayOrder', sortOrder: 'desc' },
                    undefined,
                    ctx?.tx
                );
                const topOrder = existing.items[0]?.displayOrder ?? -1;
                const nextOrder = typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;
                const faqToCreate = {
                    ...validated.faq,
                    accommodationId: validated.accommodationId as AccommodationIdType,
                    displayOrder: nextOrder
                };
                const createdFaq = await faqModel.create(faqToCreate, ctx?.tx);
                return { faq: createdFaq };
            }
        });
    }

    /**
     * Removes a FAQ from an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId and faqId
     * @param ctx - Optional service context for transaction propagation
     * @returns Success boolean
     */
    public async removeFaq(
        actor: Actor,
        data: AccommodationFaqRemoveInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeFaq',
            input: { ...data, actor },
            schema: AccommodationFaqRemoveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validated.faqId, ctx?.tx);
                if (!faq || faq.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                await faqModel.softDelete({ id: validated.faqId }, ctx?.tx);
                return { success: true };
            }
        });
    }

    /**
     * Updates a FAQ for an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId, faqId, and faq
     * @param ctx - Optional service context for transaction propagation
     * @returns The updated FAQ
     */
    public async updateFaq(
        actor: Actor,
        data: AccommodationFaqUpdateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationFaqSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateFaq',
            input: { ...data, actor },
            schema: AccommodationFaqUpdateInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validated.faqId, ctx?.tx);
                if (!faq || faq.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                const updatedFaq = await faqModel.update(
                    { id: validated.faqId },
                    {
                        ...validated.faq,
                        accommodationId: validated.accommodationId as AccommodationIdType
                    },
                    ctx?.tx
                );
                if (!updatedFaq) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update FAQ');
                }
                return { faq: updatedFaq };
            }
        });
    }

    /**
     * Gets all FAQs for an accommodation.
     * Optimized to use a single query with relations.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId
     * @param ctx - Optional service context for transaction propagation
     * @returns The list of FAQs
     */
    public async getFaqs(
        actor: Actor,
        data: AccommodationFaqListInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationFaqListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFaqs',
            input: { ...data, actor },
            schema: AccommodationFaqListInputSchema,
            execute: async (validated, actor) => {
                // Single query to load accommodation with FAQs
                const accommodation = await this.model.findWithRelations(
                    { id: validated.accommodationId },
                    { faqs: true },
                    ctx?.tx
                );
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canView(actor, accommodation);
                // FAQs are already loaded via the relation
                // TYPE-WORKAROUND: Drizzle relation result widens entity type to include the joined `faqs` array which is not part of the base Accommodation type.
                const faqs = (accommodation as unknown as { faqs?: unknown[] }).faqs ?? [];
                return { faqs: faqs as AccommodationFaq[] };
            }
        });
    }

    /**
     * Retrieves an accommodation's FAQs for the ADMIN sub-tab (SPEC-169 §2.1).
     *
     * Same data as {@link getFaqs} but gated with {@link checkCanAdminView} instead of the
     * generic `_canView`: a `VIEW_OWN`-only HOST sees the FAQs of THEIR OWN accommodation, and
     * an accommodation owned by someone else (even PUBLIC) resolves to `NOT_FOUND` (decision D2).
     * `getFaqs` is kept unchanged for the protected/public-facing path, which legitimately
     * exposes FAQs of any viewable accommodation.
     *
     * @param actor - The actor performing the action.
     * @param data - The FAQ list input (accommodationId).
     * @param ctx - Optional service context.
     * @returns A `ServiceOutput` with the FAQ list, or a `ServiceError`.
     */
    public async adminGetFaqs(
        actor: Actor,
        data: AccommodationFaqListInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationFaqListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'adminGetFaqs',
            input: { ...data, actor },
            schema: AccommodationFaqListInputSchema,
            execute: async (validated, validatedActor) => {
                const accommodation = await this.model.findWithRelations(
                    { id: validated.accommodationId },
                    { faqs: true },
                    ctx?.tx
                );
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                checkCanAdminView(validatedActor, accommodation as Accommodation);
                // TYPE-WORKAROUND: Drizzle relation result widens entity type to include the joined `faqs` array which is not part of the base Accommodation type.
                const faqs = (accommodation as unknown as { faqs?: unknown[] }).faqs ?? [];
                return { faqs: faqs as AccommodationFaq[] };
            }
        });
    }

    /**
     * Reorders FAQs on an accommodation (SPEC-177 T-010).
     *
     * Steps:
     * 1. Gate on `_canUpdate` (ANY or OWN + ownership — same as addFaq/updateFaq).
     * 2. Load all active FAQs for the accommodation.
     * 3. Validate that every `faqId` in `order` belongs to this accommodation
     *    (unknown / foreign IDs are rejected with `VALIDATION_ERROR`).
     * 4. Apply each `displayOrder` in a single transaction.
     *
     * @param actor - The actor performing the action
     * @param data - Input containing accommodationId and the ordered array of { faqId, displayOrder }
     * @param ctx - Optional service context for transaction propagation
     * @returns Success boolean
     */
    public async reorderFaqs(
        actor: Actor,
        data: AccommodationFaqReorderInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'reorderFaqs',
            input: { ...data, actor },
            schema: AccommodationFaqReorderInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const faqModel = new AccommodationFaqModel();
                // Load all active FAQs for this accommodation to validate ownership.
                const { items: existingFaqs } = await faqModel.findAll(
                    { accommodationId: validated.accommodationId, deletedAt: null },
                    { pageSize: 200 },
                    undefined,
                    ctx?.tx
                );
                const existingIds = new Set(existingFaqs.map((f) => f.id));

                // Reject any faqId that doesn't belong to this accommodation.
                const unknownIds = validated.order
                    .map((item) => item.faqId)
                    .filter((id) => !existingIds.has(id));
                if (unknownIds.length > 0) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Unknown or foreign faqId(s) for this accommodation: ${unknownIds.join(', ')}`
                    );
                }

                // Apply all displayOrder updates in a single transaction.
                const doReorder = async (tx: DrizzleClient): Promise<void> => {
                    for (const item of validated.order) {
                        await faqModel.update(
                            { id: item.faqId },
                            { displayOrder: item.displayOrder },
                            tx
                        );
                    }
                };

                if (ctx?.tx) {
                    await doReorder(ctx.tx);
                } else {
                    await withTransaction(doReorder);
                }

                return { success: true };
            }
        });
    }

    /**
     * Adds IA data to an accommodation.
     * @param input - Input object for adding IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with the created IA data
     */
    public async addIAData(
        input: AccommodationIaDataAddInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationIaDataSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataAddInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaDataToCreate = {
                    ...validated.iaData,
                    accommodationId: validated.accommodationId as AccommodationIdType
                };
                const createdIaData = await iaDataModel.create(iaDataToCreate, ctx?.tx);
                return { iaData: createdIaData };
            }
        });
    }

    /**
     * Removes IA data from an accommodation.
     * @param input - Input object for removing IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with success status
     */
    public async removeIAData(
        input: AccommodationIaDataRemoveInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataRemoveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaData = await iaDataModel.findById(validated.iaDataId, ctx?.tx);
                if (!iaData || iaData.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'IA data not found for this accommodation'
                    );
                }
                await iaDataModel.hardDelete({ id: validated.iaDataId }, ctx?.tx);
                return { success: true };
            }
        });
    }

    /**
     * Updates IA data for an accommodation.
     * @param input - Input object for updating IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with the updated IA data
     */
    public async updateIAData(
        input: AccommodationIaDataUpdateInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationIaDataSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataUpdateInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaData = await iaDataModel.findById(validated.iaDataId, ctx?.tx);
                if (!iaData || iaData.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'IA data not found for this accommodation'
                    );
                }
                const updatedIaData = await iaDataModel.update(
                    { id: validated.iaDataId },
                    {
                        ...validated.iaData,
                        accommodationId: validated.accommodationId as AccommodationIdType
                    },
                    ctx?.tx
                );
                if (!updatedIaData) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update IA data'
                    );
                }
                return { iaData: updatedIaData };
            }
        });
    }

    /**
     * Gets all IA data for an accommodation.
     * @param input - Input object for getting all IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with the list of IA data
     */
    public async getAllIAData(
        input: AccommodationIaDataListInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationIaDataListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAllIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataListInputSchema,
            execute: async (validated, actor) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canView(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const { items: iaData } = await iaDataModel.findAll(
                    { accommodationId: validated.accommodationId },
                    undefined,
                    undefined,
                    ctx?.tx
                );
                return { iaData };
            }
        });
    }

    /**
     * Gets accommodations by owner.
     * @param input - Input object for owner query.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns List of accommodations owned by the specified user
     */
    public async getByOwner(
        input: WithOwnerIdParams,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByOwner',
            input: { actor: actor, ...input },
            schema: WithOwnerIdParamsSchema,
            execute: async (validated, actor) => {
                await this._canList(actor);

                const result = await this.model.findAll(
                    { ownerId: validated.ownerId },
                    undefined,
                    undefined,
                    ctx?.tx
                );

                const normalized = Array.isArray(result.items)
                    ? result.items.map(
                          (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                      )
                    : [];

                // SPEC-204 T-013: batch-read `media` from the relational table (no N+1).
                const accommodations = await attachComposedMediaList({
                    items: normalized,
                    mediaModel: this._accommodationMediaModel,
                    tx: ctx?.tx
                });

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for the accommodation from a review service.
     * @param accommodationId - The ID of the accommodation to update
     * @param stats - The computed review stats to persist
     * @param ctx - Optional service context for transaction propagation
     * @internal
     */
    async updateStatsFromReview(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number; rating: AccommodationRatingInput },
        ctx?: ServiceContext
    ): Promise<void> {
        await this.model.updateById(
            accommodationId,
            {
                reviewsCount: stats.reviewsCount,
                averageRating: stats.averageRating,
                rating: stats.rating
            },
            ctx?.tx
        );
    }

    /**
     * Per-accommodation market comparison for the HOST card J redesign.
     *
     * Delegates to {@link AccommodationModel.getMarketComparisonByOwnerId} —
     * the SQL builds the destination averages on the fly so the dashboard
     * does not need a materialised aggregate table.
     *
     * Permission gating: requires `ACCOMMODATION_VIEW_OWN` (the same right
     * the host's own accommodation list uses). `ownerId` is always derived
     * from `actor.id` so the host cannot peek at another host's market data.
     */
    public async getHostMarketComparison(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<
        ServiceOutput<
            ReadonlyArray<{
                readonly accommodationId: string;
                readonly accommodationName: string;
                readonly accommodationType: string;
                readonly destinationId: string;
                readonly destinationName: string | null;
                readonly yourRating: number | null;
                readonly yourReviews: number;
                readonly destinationAvgRating: number | null;
                readonly destinationReviewsTotal: number;
                readonly yourPrice: number | null;
                readonly destinationAvgPrice: number | null;
            }>
        >
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getHostMarketComparison',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                // ACCOMMODATION_VIEW_OWN is the permission HOSTs hold on their
                // own listing surface since SPEC-169 (which removed the broad
                // ACCOMMODATION_VIEW_ALL from HOST). The endpoint scopes results
                // to ownerId = actor.id and the destination averages it returns
                // are server-side aggregates (no other host's listing data is
                // exposed), so VIEW_OWN is the correct gate — matching the other
                // host analytics endpoints (views, favorites). Using VIEW_ALL
                // here made the widget 403 for every real host.
                if (!validatedActor.permissions.includes(PermissionEnum.ACCOMMODATION_VIEW_OWN)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ACCOMMODATION_VIEW_OWN required for market comparison'
                    );
                }
                return this.model.getMarketComparisonByOwnerId(validatedActor.id, execCtx?.tx);
            }
        });
    }

    /**
     * Adds a photo to an accommodation gallery (SPEC-204 granular gallery endpoint).
     *
     * This is a URL-receiver method: the upload to Cloudinary has already happened
     * via `POST /api/v1/admin/media/upload`. This method registers the already-uploaded
     * URL as a new `accommodation_media` row.
     *
     * Permission model: delegates to `_canUpdate` (same as `addFaq` / `addIaData`).
     * This enforces `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN`
     * + ownership), allowing HOSTs to add photos to their own accommodations.
     *
     * Plan cap enforcement is NOT done here — it is done in the route handler
     * because `checkLimit` requires the Hono `Context` object (populated by
     * `entitlementMiddleware`). The service receives a pre-screened request.
     *
     * `sortOrder` is computed as max(visible sortOrder) + 1 (append to end).
     * When no visible rows exist yet, starts at 0.
     *
     * Server-controlled fields set here:
     * - `state`      → `'visible'` (newly added photos are always visible)
     * - `isFeatured` → `false` (featured is managed by a dedicated endpoint)
     * - `sortOrder`  → max(current visible sortOrder) + 1
     * - `moderationState` → defaults to `ModerationStatusEnum.PENDING` when not supplied
     *
     * @param actor - The actor performing the action.
     * @param data  - Input containing accommodationId and the photo payload.
     * @param ctx   - Optional service context for transaction propagation.
     * @returns The created `AccommodationMedia` row, wrapped in a `{ media }` envelope.
     */
    public async addMedia(
        actor: Actor,
        data: AccommodationMediaAddInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationMediaSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addMedia',
            input: { ...data, actor },
            schema: AccommodationMediaAddInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const mediaModel = new AccommodationMediaModel();

                // Compute next sortOrder: max(visible sortOrder) + 1, or 0 if none yet.
                // Using the base findAll with descending sort on sortOrder picks the
                // highest current sortOrder in a single-row page — same pattern as addFaq.
                const existing = await mediaModel.findAll(
                    {
                        accommodationId: validated.accommodationId,
                        state: 'visible',
                        deletedAt: null
                    },
                    { pageSize: 1, sortBy: 'sortOrder', sortOrder: 'desc' },
                    undefined,
                    ctx?.tx
                );
                const topOrder = existing.items[0]?.sortOrder ?? -1;
                const nextSortOrder =
                    typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

                const rowToCreate = {
                    ...validated.media,
                    accommodationId: validated.accommodationId as AccommodationIdType,
                    moderationState:
                        validated.media.moderationState ?? ModerationStatusEnum.PENDING,
                    state: 'visible' as const,
                    isFeatured: false,
                    sortOrder: nextSortOrder
                };

                const createdMedia = await mediaModel.create(rowToCreate, ctx?.tx);
                return { media: createdMedia };
            }
        });
    }

    /**
     * Removes a single photo from an accommodation gallery (SPEC-204 T-018).
     *
     * Steps:
     * 1. Gate on `_canUpdate` (ANY or OWN + ownership — same as `addMedia`).
     * 2. Verify the media row exists AND belongs to this accommodation.
     * 3. Soft-delete the row (sets `deletedAt`).
     * 4. Resequence the remaining visible rows to a dense 0-based `sortOrder`
     *    (preserves their relative order). Both steps run in a single transaction.
     *
     * Does NOT touch Cloudinary — deleting the binary is a separate concern
     * orchestrated by the caller. Only the DB row is affected.
     *
     * @param actor - The actor performing the action.
     * @param data  - Input containing accommodationId and mediaId.
     * @param ctx   - Optional service context for transaction propagation.
     * @returns `{ success: true }` on success.
     */
    public async removeMedia(
        actor: Actor,
        data: AccommodationMediaRemoveInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeMedia',
            input: { ...data, actor },
            schema: AccommodationMediaRemoveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const mediaModel = new AccommodationMediaModel();
                const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
                if (!mediaRow || mediaRow.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Media not found for this accommodation'
                    );
                }

                // Soft-delete + resequence in a single transaction.
                const doRemove = async (tx: DrizzleClient): Promise<void> => {
                    await mediaModel.softDelete({ id: validated.mediaId }, tx);

                    // Reload the remaining visible rows to resequence them.
                    const { items: remaining } = await mediaModel.findByAccommodation({
                        accommodationId: validated.accommodationId,
                        state: 'visible',
                        pageSize: 200,
                        tx
                    });

                    // Apply dense 0-based sortOrder in the existing visual order.
                    for (let i = 0; i < remaining.length; i++) {
                        const row = remaining[i];
                        if (row && row.sortOrder !== i) {
                            await mediaModel.update({ id: row.id }, { sortOrder: i }, tx);
                        }
                    }
                };

                if (ctx?.tx) {
                    await doRemove(ctx.tx);
                } else {
                    await withTransaction(doRemove);
                }

                return { success: true };
            }
        });
    }

    /**
     * Reorders an accommodation's gallery photos (SPEC-204 T-019).
     *
     * Steps:
     * 1. Gate on `_canUpdate` (ANY or OWN + ownership — same as `addMedia`).
     * 2. Load all current VISIBLE rows for the accommodation.
     * 3. Validate that `orderedIds` is exactly the set of current visible row ids
     *    — no missing entries, no extras, no foreign ids. Rejects with
     *    `VALIDATION_ERROR` on any mismatch.
     * 4. Batch-update each row's `sortOrder` to its index in `orderedIds`.
     *    All updates run in a single transaction.
     *
     * @param actor - The actor performing the action.
     * @param data  - Input containing accommodationId and the ordered array of mediaId UUIDs.
     * @param ctx   - Optional service context for transaction propagation.
     * @returns The reordered list wrapped in a `{ media: [...] }` envelope.
     */
    public async reorderMedia(
        actor: Actor,
        data: AccommodationMediaReorderInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationMediaListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'reorderMedia',
            input: { ...data, actor },
            schema: AccommodationMediaReorderInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const mediaModel = new AccommodationMediaModel();

                // Load all visible rows to validate and resequence.
                const { items: visibleRows } = await mediaModel.findByAccommodation({
                    accommodationId: validated.accommodationId,
                    state: 'visible',
                    pageSize: 200,
                    tx: ctx?.tx
                });

                const existingIds = new Set(visibleRows.map((r) => r.id));

                // Validate set equality: orderedIds must match existingIds exactly.
                const inputIds = new Set(validated.orderedIds);
                const missingIds = [...existingIds].filter((id) => !inputIds.has(id));
                const extraIds = [...inputIds].filter((id) => !existingIds.has(id));

                if (missingIds.length > 0 || extraIds.length > 0) {
                    const details: string[] = [];
                    if (missingIds.length > 0) details.push(`missing: ${missingIds.join(', ')}`);
                    if (extraIds.length > 0)
                        details.push(`unknown/foreign: ${extraIds.join(', ')}`);
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `orderedIds does not match visible media for this accommodation — ${details.join('; ')}`
                    );
                }

                // Build a map for fast row lookup so we can return the updated list.
                const rowById = new Map(visibleRows.map((r) => [r.id, r]));

                // Apply all sortOrder updates in a single transaction.
                const doReorder = async (tx: DrizzleClient): Promise<void> => {
                    for (let i = 0; i < validated.orderedIds.length; i++) {
                        const id = validated.orderedIds[i];
                        if (id !== undefined) {
                            await mediaModel.update({ id }, { sortOrder: i }, tx);
                        }
                    }
                };

                if (ctx?.tx) {
                    await doReorder(ctx.tx);
                } else {
                    await withTransaction(doReorder);
                }

                // Return the reordered rows with their updated sortOrder values.
                const reordered = validated.orderedIds
                    .map((id, idx) => {
                        const row = rowById.get(id);
                        return row ? { ...row, sortOrder: idx } : null;
                    })
                    .filter((r): r is NonNullable<typeof r> => r !== null);

                return { media: reordered };
            }
        });
    }

    /**
     * Lists the media rows for an accommodation gallery (SPEC-204).
     *
     * Returns all non-deleted rows ordered by `sortOrder ASC`. Supports an optional
     * `state` filter (defaults to `'visible'`). Admin equivalent of
     * `adminGetFaqs` — gated with `_canUpdate` so a VIEW_OWN HOST sees only their
     * own accommodation's gallery.
     *
     * @param actor - The actor performing the action.
     * @param data  - Input containing accommodationId and optional state filter.
     * @param ctx   - Optional service context for transaction propagation.
     * @returns The media list wrapped in a `{ media: [...] }` envelope.
     */
    public async adminGetMedia(
        actor: Actor,
        data: AccommodationMediaListInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationMediaListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'adminGetMedia',
            input: { ...data, actor },
            schema: AccommodationMediaListInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const mediaModel = new AccommodationMediaModel();
                const { items } = await mediaModel.findByAccommodation({
                    accommodationId: validated.accommodationId,
                    state: validated.state ?? 'visible',
                    pageSize: 200,
                    tx: ctx?.tx
                });

                return { media: items };
            }
        });
    }

    /**
     * Promotes a single photo to the featured image of an accommodation (SPEC-204 T-020).
     *
     * Steps:
     * 1. Gate on `_canUpdate` (ANY or OWN + ownership).
     * 2. Verify the target media row exists AND belongs to this accommodation.
     * 3. Guard: target row must be `state = 'visible'` — a DB CHECK constraint
     *    forbids `is_featured = true AND state = 'archived'`, so we reject early
     *    with a clear ServiceError rather than letting the DB raise.
     * 4. In a TRANSACTION: clear the previous featured row (`is_featured = false`),
     *    then set the target row `is_featured = true`. Clear-then-set order is
     *    mandatory — setting the new one first would briefly violate the partial
     *    unique index on (accommodation_id) WHERE is_featured.
     *
     * @param actor - The actor performing the action.
     * @param data  - Input containing accommodationId and mediaId.
     * @param ctx   - Optional service context for transaction propagation.
     * @returns The updated media row wrapped in a `{ media }` envelope.
     */
    public async setFeaturedMedia(
        actor: Actor,
        data: AccommodationMediaSetFeaturedInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationMediaSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setFeaturedMedia',
            input: { ...data, actor },
            schema: AccommodationMediaSetFeaturedInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const mediaModel = new AccommodationMediaModel();
                const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
                if (!mediaRow || mediaRow.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Media not found for this accommodation'
                    );
                }

                // Guard: archived photos cannot be featured (DB CHECK constraint would fire).
                // Reject early with a clear, actionable message.
                if (mediaRow.state === 'archived') {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Cannot feature an archived photo — restore it to visible first'
                    );
                }

                // Transaction: clear-then-set to avoid briefly having two featured rows
                // which would violate the partial unique index on
                // (accommodation_id) WHERE is_featured = true AND deleted_at IS NULL.
                const doSetFeatured = async (tx: DrizzleClient): Promise<void> => {
                    // 1. Clear any existing featured row for this accommodation.
                    const existing = await mediaModel.findFeatured({
                        accommodationId: validated.accommodationId,
                        tx
                    });
                    if (existing && existing.id !== validated.mediaId) {
                        await mediaModel.update({ id: existing.id }, { isFeatured: false }, tx);
                    }
                    // 2. Promote the target row.
                    await mediaModel.update({ id: validated.mediaId }, { isFeatured: true }, tx);
                };

                if (ctx?.tx) {
                    await doSetFeatured(ctx.tx);
                } else {
                    await withTransaction(doSetFeatured);
                }

                // Re-fetch the updated row to return the current DB state.
                const updated = await mediaModel.findById(validated.mediaId, ctx?.tx);
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to retrieve updated media row after set-featured'
                    );
                }
                return { media: updated };
            }
        });
    }

    /**
     * Archives a single accommodation photo (SPEC-204 T-021a).
     *
     * Steps:
     * 1. Gate on `_canUpdate` (ANY or OWN + ownership).
     * 2. Verify the target media row exists AND belongs to this accommodation.
     * 3. Guard: only `state = 'visible'` rows can be archived (idempotency guard
     *    — already-archived rows are rejected).
     * 4. Guard: featured photos cannot be archived — the DB CHECK constraint
     *    enforces `NOT (is_featured AND state = 'archived')`. We reject early with
     *    an actionable message telling the caller to unfeature first.
     * 5. Flip `state = 'archived'` and `archivedAt = NOW()`.
     *
     * NOTE: this is the per-photo admin archive endpoint — distinct from the
     * billing downgrade archive in plan-photo-restriction logic (which works by
     * URL/count on the full gallery). Do NOT confuse the two.
     *
     * @param actor - The actor performing the action.
     * @param data  - Input containing accommodationId and mediaId.
     * @param ctx   - Optional service context for transaction propagation.
     * @returns The archived media row wrapped in a `{ media }` envelope.
     */
    public async archiveMedia(
        actor: Actor,
        data: AccommodationMediaArchiveInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationMediaSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'archiveMedia',
            input: { ...data, actor },
            schema: AccommodationMediaArchiveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const mediaModel = new AccommodationMediaModel();
                const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
                if (!mediaRow || mediaRow.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Media not found for this accommodation'
                    );
                }

                // Guard: only visible rows can be archived.
                if (mediaRow.state !== 'visible') {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Photo is already archived'
                    );
                }

                // Guard: featured photos cannot be archived — the CHECK constraint
                // `NOT (is_featured AND state = 'archived')` would fire at the DB.
                // Reject early with an actionable message.
                if (mediaRow.isFeatured) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Cannot archive the featured photo — unfeature it first'
                    );
                }

                const archived = await mediaModel.update(
                    { id: validated.mediaId },
                    { state: 'archived', archivedAt: new Date() },
                    ctx?.tx
                );
                if (!archived) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to retrieve updated media row after archive'
                    );
                }
                return { media: archived };
            }
        });
    }

    /**
     * Restores an archived accommodation photo (SPEC-204 T-021b).
     *
     * Steps:
     * 1. Gate on `_canUpdate` (ANY or OWN + ownership).
     * 2. Verify the target media row exists AND belongs to this accommodation.
     * 3. Guard: only `state = 'archived'` rows can be restored.
     * 4. Flip `state = 'visible'`, clear `archivedAt = NULL`, and assign
     *    `sortOrder = max(current visible sortOrder) + 1` (append at end).
     *
     * Plan cap on restore: intentionally NOT enforced here. The plan cap is a
     * billing-layer concern enforced at the upload/add routes (where new binary
     * assets are registered). Restoring a previously-visible photo that already
     * exists in the DB is treated as a management action, not a new addition.
     * This mirrors how addFaq/restore works elsewhere in this service. If product
     * decides to enforce the cap on restore in the future, it must be added
     * explicitly — the handler was intentionally left without an inline cap check.
     *
     * @param actor - The actor performing the action.
     * @param data  - Input containing accommodationId and mediaId.
     * @param ctx   - Optional service context for transaction propagation.
     * @returns The restored media row wrapped in a `{ media }` envelope.
     */
    public async restoreMedia(
        actor: Actor,
        data: AccommodationMediaRestoreInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationMediaSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'restoreMedia',
            input: { ...data, actor },
            schema: AccommodationMediaRestoreInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);

                const mediaModel = new AccommodationMediaModel();
                const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
                if (!mediaRow || mediaRow.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Media not found for this accommodation'
                    );
                }

                // Guard: only archived rows can be restored.
                if (mediaRow.state !== 'archived') {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Photo is not archived'
                    );
                }

                // Compute next sortOrder: append at end of current visible gallery.
                const existing = await mediaModel.findAll(
                    {
                        accommodationId: validated.accommodationId,
                        state: 'visible',
                        deletedAt: null
                    },
                    { pageSize: 1, sortBy: 'sortOrder', sortOrder: 'desc' },
                    undefined,
                    ctx?.tx
                );
                const topOrder = existing.items[0]?.sortOrder ?? -1;
                const nextSortOrder =
                    typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

                const restored = await mediaModel.update(
                    { id: validated.mediaId },
                    { state: 'visible', archivedAt: null, sortOrder: nextSortOrder },
                    ctx?.tx
                );
                if (!restored) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to retrieve updated media row after restore'
                    );
                }
                return { media: restored };
            }
        });
    }
}
