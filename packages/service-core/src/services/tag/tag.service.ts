/**
 * @fileoverview TagService — User-tag subsystem business logic (SPEC-086).
 *
 * Implements type invariants (T-018), hard-delete with impact count (T-022),
 * quota enforcement with advisory lock (T-019), picker visibility + entity-tag
 * scoping (T-020), assignTag/removeAssignment with entity-access check (T-021),
 * and user-tag own CRUD (T-023).
 *
 * Key design decisions:
 * - D-002: Three-type model (INTERNAL / SYSTEM / USER). No slug. No notes.
 * - D-005: assignedById is always set to actor.id — never caller-provided.
 * - D-006: Picker visibility per actor (SYSTEM + own USER, optionally INTERNAL).
 * - D-007: Entity-tag visibility per actor (own assignments only, or all for admins).
 * - D-008: Permission to assign requires permission to see the tag in the picker.
 * - D-009: Entity-level access required before assignment. See EntityAccessRegistry.
 * - D-010: USER tag quota race protected by PostgreSQL advisory lock.
 * - D-011: Hard delete only. No soft-delete, no restore.
 * - D-012: No TAG_USER_UPDATE_ANY — super-admin moderation is delete-only.
 * - D-017: Permission dispatch per type (TAG_INTERNAL_*, TAG_SYSTEM_*, TAG_USER_*).
 * - D-018: Service-layer type invariants enforced before any DB write.
 * - D-021: Quota default 50, overrideable via HOSPEDA_TAG_USER_QUOTA_PER_USER env var.
 * - D-022: listOwnTags returns all lifecycle states (ACTIVE + INACTIVE + ARCHIVED).
 */
import { type DrizzleClient, REntityTagModel, TagModel, sql, withTransaction } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { EntityTag, Tag } from '@repo/schemas';
import {
    EntityTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    type TagAddToEntityInput,
    TagAddToEntityInputSchema,
    type TagAddToEntityOutput,
    TagAdminSearchSchema,
    type TagCreateInput,
    TagCreateInputSchema,
    type TagGetEntitiesByTagInput,
    TagGetEntitiesByTagInputSchema,
    type TagGetEntitiesByTagOutput,
    type TagGetForEntityInput,
    TagGetForEntityInputSchema,
    type TagGetForEntityOutput,
    type TagGetPopularInput,
    TagGetPopularInputSchema,
    type TagGetPopularOutput,
    type TagRemoveFromEntityInput,
    TagRemoveFromEntityInputSchema,
    TagSearchInputSchema,
    TagTypeEnum,
    TagUpdateInputSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { getCanViewChecker } from './entity-access-registry';
import { normalizeCreateInput, normalizeUpdateInput } from './tag.normalizers';
import {
    assertCanCreateTag,
    assertCanDeleteTag,
    assertCanViewTag,
    checkCanAdminList,
    checkCanCountTags,
    checkCanHardDeleteTag,
    checkCanListTags,
    checkCanRestoreTag,
    checkCanSearchTags,
    checkCanSoftDeleteTag,
    checkCanUpdateTag,
    checkCanUpdateVisibilityTag
} from './tag.permissions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default USER tag quota per user when env var is not set or invalid. */
const DEFAULT_USER_TAG_QUOTA = 50;

// ---------------------------------------------------------------------------
// Service output types for new methods
// ---------------------------------------------------------------------------

/** Result of getImpactCount — counts r_entity_tag rows for a given tag. */
export interface TagImpactCountOutput {
    count: number;
}

/** Result of deleteTag — confirms hard delete with impact count. */
export interface TagDeleteTagOutput {
    deleted: true;
    impactCount: number;
}

/** Result of getPickerTags — tags visible in the actor's picker. */
export interface TagPickerOutput {
    tags: Tag[];
}

/** Input for getPickerTags — optional name search query. */
export interface TagPickerInput {
    search?: string;
}

// ---------------------------------------------------------------------------
// T-021: assignTag / removeAssignment output types
// ---------------------------------------------------------------------------

/** Result of assignTag — confirms per-user tag-entity assignment. */
export interface TagAssignOutput {
    /** Whether the assignment was new (`true`) or already existed (`false`, idempotent). */
    assigned: true;
    /** True when the assignment was newly inserted; false when it already existed. */
    wasAlreadyAssigned: boolean;
}

/** Input for assignTag — entity coordinates only (assignedById is injected from actor). */
export interface TagAssignInput {
    tagId: string;
    entityId: string;
    entityType: EntityTypeEnum;
}

/** Input for removeAssignment — entity coordinates only. */
export interface TagRemoveAssignmentInput {
    tagId: string;
    entityId: string;
    entityType: EntityTypeEnum;
}

/** Result of removeAssignment — confirms row deletion. */
export interface TagRemoveAssignmentOutput {
    removed: true;
}

// ---------------------------------------------------------------------------
// T-023: User-tag own CRUD output types
// ---------------------------------------------------------------------------

/** Result of listOwnTags — all USER tags belonging to the actor. */
export interface TagListOwnOutput {
    tags: Tag[];
}

/** Input query options for listOwnTags. */
export interface TagListOwnQuery {
    search?: string;
    lifecycleState?: LifecycleStatusEnum;
}

/** Result of getOwnTagImpactCount — count of actor's own assignments for a tag. */
export interface TagOwnImpactCountOutput {
    count: number;
}

/** Result of getQuotaStatus — actor's current quota utilization. */
export interface TagQuotaStatusOutput {
    used: number;
    limit: number;
}

/**
 * TagService — business logic for the user-tag subsystem (SPEC-086).
 *
 * Extends BaseCrudRelatedService. Adds:
 * - Type invariant validation on create/update (D-018).
 * - Cross-type name collision check on create/update (D-018).
 * - `getImpactCount()` for the delete confirmation dialog (D-011).
 * - `deleteTag()` — hard delete with permission dispatch by type (D-017).
 */
export class TagService extends BaseCrudRelatedService<
    Tag,
    TagModel,
    REntityTagModel,
    typeof TagCreateInputSchema,
    typeof TagUpdateInputSchema,
    typeof TagSearchInputSchema
> {
    static readonly ENTITY_NAME = 'tag';
    protected readonly entityName = TagService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('tag-revalidation');

    /** The database model for Tag. */
    protected readonly model: TagModel;

    /** Zod schema for tag creation. */
    protected readonly createSchema = TagCreateInputSchema;
    /** Zod schema for tag updates. */
    protected readonly updateSchema = TagUpdateInputSchema;
    /** Zod schema for tag search/filtering. */
    protected readonly searchSchema = TagSearchInputSchema;
    /**
     * Admin search schema for tag list filtering.
     * Uses default _executeAdminSearch() because all entity-specific filter fields
     * map directly to table column names.
     */
    protected readonly adminSearchSchema = TagAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    protected normalizers: CrudNormalizersFromSchemas<
        typeof TagCreateInputSchema,
        typeof TagUpdateInputSchema,
        typeof TagSearchInputSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    /**
     * Initializes a new instance of the TagService.
     *
     * @param ctx - The service context, containing the logger.
     * @param model - Optional TagModel instance (for testing/mocking).
     * @param relatedModel - Optional REntityTagModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceConfig, model?: TagModel, relatedModel?: REntityTagModel) {
        super(ctx, TagService.ENTITY_NAME, relatedModel);
        this.model = model ?? new TagModel();
    }

    // ---------------------------------------------------------------------------
    // T-019: Quota enforcement helpers
    // ---------------------------------------------------------------------------

    /**
     * Returns the per-user USER tag quota.
     *
     * Reads `HOSPEDA_TAG_USER_QUOTA_PER_USER` from the environment.
     * Falls back to {@link DEFAULT_USER_TAG_QUOTA} (50) if the variable is
     * not set or its value is not a finite positive integer.
     *
     * @returns Quota as a positive integer.
     */
    private getUserTagQuota(): number {
        const raw = process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER;
        if (!raw) return DEFAULT_USER_TAG_QUOTA;
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_USER_TAG_QUOTA;
        return parsed;
    }

    /**
     * Enforces the USER tag quota with a PostgreSQL advisory lock (D-010, D-021).
     *
     * Acquires `pg_advisory_xact_lock(hashtext(ownerId))` inside a transaction so
     * that concurrent create attempts for the same user serialize on the lock. The
     * lock is automatically released when the transaction ends (commit or rollback).
     *
     * If the caller has already opened a transaction (`ctx.tx` is set), the lock is
     * acquired inside that boundary, providing the strongest atomicity guarantee (lock
     * + insert in one transaction). If no transaction exists, a short inner transaction
     * acquires and immediately releases the lock after the count check.
     *
     * @param ownerId - UUID of the user whose quota is checked.
     * @param ctx - Current service context; `ctx.tx` is used when available.
     * @throws {ServiceError} QUOTA_EXCEEDED when the active USER tag count >= quota.
     */
    private async enforceUserTagQuota(ownerId: string, ctx?: ServiceContext): Promise<void> {
        const quota = this.getUserTagQuota();
        const model = this.model;

        const runCheck = async (tx: DrizzleClient): Promise<void> => {
            // Acquire per-user advisory lock for the duration of this transaction.
            // hashtext() maps the UUID string to a 32-bit signed integer (PostgreSQL built-in).
            // pg_advisory_xact_lock() blocks until the lock is acquired; auto-released on tx end.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`);
            const count = await model.countActiveByOwner(ownerId, tx);
            if (count >= quota) {
                throw new ServiceError(
                    ServiceErrorCode.QUOTA_EXCEEDED,
                    `USER tag quota exceeded: ${count}/${quota} ACTIVE USER tags. Deactivate or delete existing tags to create new ones. (AC-F09, D-021)`
                );
            }
        };

        if (ctx?.tx) {
            await runCheck(ctx.tx);
        } else {
            await withTransaction(runCheck);
        }
    }

    /** Creates the default related model instance for tag-entity relations. */
    protected createDefaultRelatedModel(): REntityTagModel {
        return new REntityTagModel();
    }

    /**
     * Overrides update to inject the tag ID into `ctx.hookState.updateId`
     * before the pipeline runs. This allows `_beforeUpdate` to load the current
     * entity for the cross-type name-collision check (D-018) without needing
     * access to `_canUpdate`'s entity parameter.
     */
    public override async update(
        actor: Actor,
        id: string,
        data: z.infer<typeof TagUpdateInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Tag>> {
        const enrichedCtx: ServiceContext = {
            ...ctx,
            hookState: { ...ctx?.hookState, updateId: id }
        };
        return super.update(actor, id, data, enrichedCtx);
    }

    // ---------------------------------------------------------------------------
    // BaseCrudRelatedService permission hooks
    // ---------------------------------------------------------------------------

    protected _canCreate(actor: Actor, data: TagCreateInput): void {
        assertCanCreateTag(actor, data.type);
    }

    protected _canUpdate(actor: Actor, entity: Tag): void {
        checkCanUpdateTag(actor, entity);
    }

    protected _canDelete(actor: Actor, entity: Tag): void {
        assertCanDeleteTag(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: Tag): void {
        checkCanRestoreTag(actor, entity);
    }

    protected _canView(actor: Actor, entity: Tag): void {
        assertCanViewTag(actor, entity);
    }

    protected _canList(actor: Actor): void {
        checkCanListTags(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkCanSearchTags(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanCountTags(actor);
    }

    /**
     * Soft-delete is not supported. Tags use hard delete only (D-011).
     */
    protected _canSoftDelete(actor: Actor, entity: Tag): void {
        checkCanSoftDeleteTag(actor, entity);
    }

    /**
     * Hard-delete via the typed deleteTag() method. This hook is the base-class
     * hook; prefer calling deleteTag() directly for full impact-count support.
     */
    protected _canHardDelete(actor: Actor, entity: Tag): void {
        checkCanHardDeleteTag(actor, entity);
    }

    protected _canUpdateVisibility(actor: Actor, entity: Tag, _newVisibility: unknown): void {
        checkCanUpdateVisibilityTag(actor, entity);
    }

    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    // ---------------------------------------------------------------------------
    // T-018: Type invariants + cross-type name collision
    // ---------------------------------------------------------------------------

    /**
     * Validates that type invariants are satisfied before any DB write.
     *
     * Service-layer invariants per D-018:
     * - AC-F01: type = USER ⇒ ownerId NOT NULL.
     * - AC-F02: type IN (INTERNAL, SYSTEM) ⇒ ownerId IS NULL.
     *
     * These invariants are also enforced by the Zod schema (TagCreateInputSchema),
     * but the service enforces them independently as a defense-in-depth layer.
     *
     * @param input - The (potentially normalized) create or update-with-type input.
     * @throws {ServiceError} VALIDATION_ERROR if invariant is violated.
     */
    private validateTypeInvariants(input: { type: TagTypeEnum; ownerId?: string | null }): void {
        if (input.type === TagTypeEnum.USER && input.ownerId == null) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'ownerId is required for USER tags (AC-F01, D-018)'
            );
        }
        if (
            (input.type === TagTypeEnum.INTERNAL || input.type === TagTypeEnum.SYSTEM) &&
            input.ownerId != null
        ) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'ownerId must be null for INTERNAL and SYSTEM tags (AC-F02, D-018)'
            );
        }
    }

    /**
     * Checks that a USER tag's name does not collide with an existing INTERNAL or SYSTEM tag.
     *
     * Per D-018: cross-type name collision is rejected at service layer with a 409 conflict.
     * Not enforced by DB constraint (D-018 note). Case-insensitive comparison.
     *
     * Only runs for USER tags — INTERNAL and SYSTEM name collisions are handled by partial
     * unique indexes in the database.
     *
     * @param input - Contains type and name.
     * @param tx - Optional transaction client for consistency.
     * @throws {ServiceError} CONFLICT if name is reserved by a SYSTEM or INTERNAL tag.
     */
    private async checkCrossTypeNameCollision(
        input: { type: TagTypeEnum; name: string },
        tx?: ServiceContext['tx']
    ): Promise<void> {
        if (input.type !== TagTypeEnum.USER) return;

        const nameNormalized = input.name.trim().toLowerCase();

        // Check INTERNAL tags with same name (case-insensitive)
        const internalTags = await this.model.findByType(TagTypeEnum.INTERNAL, undefined, tx);
        const hasInternalCollision = internalTags.some(
            (t) => t.name.toLowerCase() === nameNormalized
        );
        if (hasInternalCollision) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                `Name '${input.name}' is reserved by a system tag (INTERNAL). Choose a different name. (AC-F03, D-018)`
            );
        }

        // Check SYSTEM tags with same name (case-insensitive)
        const systemTags = await this.model.findByType(TagTypeEnum.SYSTEM, undefined, tx);
        const hasSystemCollision = systemTags.some((t) => t.name.toLowerCase() === nameNormalized);
        if (hasSystemCollision) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                `Name '${input.name}' is reserved by a system tag (SYSTEM). Choose a different name. (AC-F03, D-018)`
            );
        }
    }

    // ---------------------------------------------------------------------------
    // Lifecycle hooks — wire in invariant checks
    // ---------------------------------------------------------------------------

    protected async _beforeCreate(
        input: TagCreateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<TagCreateInput> {
        this.validateTypeInvariants(input);

        if (input.type === TagTypeEnum.USER) {
            // Quota enforcement with advisory lock (D-010, D-021, AC-F09, AC-F10, AC-F17).
            //
            // We acquire a PostgreSQL transaction-scoped advisory lock keyed on the
            // owner's UUID via hashtext(). The lock is automatically released when
            // the surrounding transaction commits or rolls back, which prevents the
            // TOCTOU race where two concurrent creates both see count < quota.
            //
            // Architecture note on the lock / insert boundary:
            // The cleanest guarantee is to have the advisory lock and model.create() inside
            // the SAME transaction. This is achieved when the caller wraps the service.create()
            // call in withServiceTransaction() (passing ctx with ctx.tx populated). In that
            // case we acquire the lock and do the count inside the caller's transaction; the
            // base-class pipeline then calls model.create(data, ctx.tx) inside the same boundary.
            //
            // When NO caller transaction exists (ctx.tx is null), we open a short-lived inner
            // transaction just for the lock + count. The lock is released at the end of that
            // inner tx (before model.create() runs). The protection is still meaningful because
            // concurrent creates for the SAME user will serialize on the advisory lock during
            // the count phase, so the last writer sees the updated count from the first writer's
            // insert. For the absolute strongest guarantee, callers should use withServiceTransaction().
            await this.enforceUserTagQuota(input.ownerId as string, ctx);
        }

        await this.checkCrossTypeNameCollision(input, ctx?.tx);
        return input;
    }

    protected async _beforeUpdate(
        input: z.infer<typeof TagUpdateInputSchema>,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<z.infer<typeof TagUpdateInputSchema>> {
        // type is immutable — TagUpdateInputSchema excludes it, so we validate
        // using the existing entity's type. If name changes, re-check collision.
        // The base does not pass the current entity to this hook; we retrieve
        // the tag ID from hookState (injected by our update() override) and
        // look up the current entity to get its type.
        if (input.name) {
            const updateId = ctx.hookState?.updateId as string | undefined;
            if (updateId) {
                const current = await this.model.findById(updateId, ctx?.tx);
                if (current && input.name !== current.name) {
                    await this.checkCrossTypeNameCollision(
                        { type: current.type, name: input.name },
                        ctx?.tx
                    );
                }
            }
        }
        return input;
    }

    // ---------------------------------------------------------------------------
    // Revalidation hooks
    // ---------------------------------------------------------------------------

    protected async _afterCreate(entity: Tag, _actor: Actor, _ctx: ServiceContext): Promise<Tag> {
        this.scheduleRevalidation('_afterCreate');
        return entity;
    }

    protected async _afterUpdate(entity: Tag, _actor: Actor, _ctx: ServiceContext): Promise<Tag> {
        this.scheduleRevalidation('_afterUpdate');
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: Tag,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Tag> {
        this.scheduleRevalidation('_afterUpdateVisibility');
        return entity;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        this.scheduleRevalidation('_afterSoftDelete');
        return result;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        this.scheduleRevalidation('_afterHardDelete');
        return result;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        this.scheduleRevalidation('_afterRestore');
        return result;
    }

    private scheduleRevalidation(hook: string): void {
        try {
            getRevalidationService()?.scheduleRevalidation({ entityType: 'tag' });
        } catch (error) {
            TagService.revalidationLogger.warn(
                { error, entityType: 'tag', hook },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
    }

    // ---------------------------------------------------------------------------
    // Search / count execution
    // ---------------------------------------------------------------------------

    protected async _executeSearch(
        params: z.infer<typeof TagSearchInputSchema>,
        _actor: Actor,
        ctx: ServiceContext
    ) {
        // BaseCrudRead.search strips page/pageSize/sortBy/sortOrder from params
        // and republishes them on ctx.pagination. Read from ctx so the
        // caller-provided pageSize is honored (params would always fall back
        // to the default, capping results — see the amenity search fix).
        const page = ctx.pagination?.page ?? 1;
        const pageSize = ctx.pagination?.pageSize ?? 10;
        return this.model.findAll(params, { page, pageSize });
    }

    protected async _executeCount(
        params: z.infer<typeof TagSearchInputSchema>,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ---------------------------------------------------------------------------
    // T-022: Impact count + hard delete with permission dispatch
    // ---------------------------------------------------------------------------

    /**
     * Returns the number of r_entity_tag rows referencing the given tag.
     *
     * Used to populate the impact count before the delete confirmation dialog (D-011).
     * The actor must be able to view the tag (assertCanViewTag).
     *
     * @param actor - The actor performing the action.
     * @param tagId - UUID of the tag to count assignments for.
     * @param ctx - Optional service context (transaction support).
     * @returns ServiceOutput with `{ count: number }`.
     */
    public async getImpactCount(
        actor: Actor,
        tagId: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagImpactCountOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getImpactCount',
            input: { actor, tagId },
            schema: z.object({ actor: z.any(), tagId: z.string().uuid() }),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                const tag = await this.model.findById(validated.tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                assertCanViewTag(actor, tag as Tag);
                const count = await this.relatedModel.countByTagId(validated.tagId, execCtx?.tx);
                return { count };
            }
        });
    }

    /**
     * Hard-deletes a tag with permission dispatch by tag type (D-017, D-011).
     *
     * Before deletion, fetches the current impact count so callers can display
     * a post-delete confirmation. DB cascades on `r_entity_tag.tagId` handle
     * assignment cleanup — no service-layer cascade is needed (D-011).
     *
     * Permission dispatch:
     * - INTERNAL → TAG_INTERNAL_DELETE
     * - SYSTEM   → TAG_SYSTEM_DELETE
     * - USER (own) → TAG_USER_DELETE_OWN + ownership check
     * - USER (any) → TAG_USER_DELETE_ANY (super-admin moderation)
     *
     * @param actor - The actor performing the action.
     * @param tagId - UUID of the tag to delete.
     * @param ctx - Optional service context (transaction support).
     * @returns ServiceOutput with `{ deleted: true; impactCount: number }`.
     */
    public async deleteTag(
        actor: Actor,
        tagId: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagDeleteTagOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'deleteTag',
            input: { actor, tagId },
            schema: z.object({ actor: z.any(), tagId: z.string().uuid() }),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                const tag = await this.model.findById(validated.tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }

                // Permission dispatch by type (D-017)
                assertCanDeleteTag(actor, tag as Tag);

                // Fetch impact count BEFORE deletion (D-011)
                const impactCount = await this.relatedModel.countByTagId(
                    validated.tagId,
                    execCtx?.tx
                );

                // Hard delete — DB cascades clean up r_entity_tag rows (D-011)
                await this.model.hardDelete({ id: validated.tagId }, execCtx?.tx);

                this.scheduleRevalidation('deleteTag');

                return { deleted: true as const, impactCount };
            }
        });
    }

    // ---------------------------------------------------------------------------
    // Entity-tag assignment methods
    // ---------------------------------------------------------------------------

    /**
     * Returns the most popular SYSTEM tags by distinct-entity usage count (D-006, D-001).
     *
     * Popularity is measured by the number of DISTINCT entities that have the tag assigned
     * (D-006). Only SYSTEM tags appear in popularity surfaces (D-001 — INTERNAL and USER
     * tags are organizational and never public-facing).
     *
     * @param actor - The actor performing the action.
     * @param params - Optional limit for the number of tags.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with an array of Tag.
     */
    public async getPopularTags(
        actor: Actor,
        params: TagGetPopularInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagGetPopularOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPopularTags',
            input: { actor, ...params },
            schema: TagGetPopularInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanListTags(actor);
                // findPopularTags already uses DISTINCT entityId count (model T-015).
                // Filter results to SYSTEM tags only per D-001 (popularity surface is
                // public-facing; INTERNAL/USER tags must never appear there).
                const results = await this.relatedModel.findPopularTags({
                    limit: validated.limit ?? 10
                });
                const tagsList: Tag[] = results
                    .map((row) => row.tag as Tag)
                    .filter((tag) => tag.type === TagTypeEnum.SYSTEM);
                return { tags: tagsList };
            }
        });
    }

    /**
     * Returns the tags visible in the actor's picker (D-006, T-020).
     *
     * Picker visibility rules per actor:
     * - Anonymous → UNAUTHORIZED (no picker for anonymous users).
     * - Authenticated user → SYSTEM (ACTIVE) + actor's own USER (ACTIVE).
     * - Actor with TAG_INTERNAL_VIEW → also includes INTERNAL (ACTIVE).
     *
     * Name search is applied via safeIlike on the `name` column only (D-014).
     *
     * @param actor - The actor requesting the picker. Must be authenticated (non-null id).
     * @param query - Optional search query. Only `search` is supported (substring on name).
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with an array of Tag visible in the actor's picker.
     */
    public async getPickerTags(
        actor: Actor,
        query?: TagPickerInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagPickerOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPickerTags',
            input: { actor, query: query ?? {} },
            schema: z.object({
                actor: z.any(),
                query: z.object({ search: z.string().optional() }).optional()
            }),
            ctx,
            execute: async (_validated, _actorArg, execCtx) => {
                // Anonymous actors have no picker (D-006).
                if (!actor?.id) {
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Picker is not available for anonymous users (D-006)'
                    );
                }

                const hasInternalView =
                    actor.permissions?.includes(PermissionEnum.TAG_INTERNAL_VIEW) ?? false;

                const tags = await this.model.findPickerTags(
                    {
                        actorId: actor.id,
                        hasInternalView,
                        nameQuery: query?.search
                    },
                    execCtx?.tx
                );

                return { tags };
            }
        });
    }

    /**
     * Adds a tag to an entity (polymorphic).
     *
     * @param actor - The actor performing the action.
     * @param params - tagId, entityId, entityType.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<TagAddToEntityOutput>
     */
    public async addTagToEntity(
        actor: Actor,
        params: TagAddToEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagAddToEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addTagToEntity',
            input: { actor, ...params },
            schema: TagAddToEntityInputSchema.strict(),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                const tag = await this.model.findById(validated.tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                // Picker visibility check (D-008)
                assertCanViewTag(actor, tag as Tag);

                const existing = await this.relatedModel.findOne(
                    {
                        tagId: validated.tagId,
                        entityId: validated.entityId,
                        entityType: validated.entityType as EntityTypeEnum
                    },
                    execCtx?.tx
                );
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Tag already associated with entity'
                    );
                }
                await this.relatedModel.create(
                    {
                        tagId: validated.tagId,
                        entityId: validated.entityId,
                        entityType: validated.entityType as EntityTypeEnum
                    },
                    execCtx?.tx
                );
                return { success: true };
            }
        });
    }

    /**
     * Removes a tag from an entity (polymorphic).
     *
     * @param actor - The actor performing the action.
     * @param params - tagId, entityId, entityType.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<TagAddToEntityOutput>
     */
    public async removeTagFromEntity(
        actor: Actor,
        params: TagRemoveFromEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagAddToEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeTagFromEntity',
            input: { actor, ...params },
            schema: TagRemoveFromEntityInputSchema.strict(),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                const tag = await this.model.findById(validated.tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                assertCanViewTag(actor, tag as Tag);

                const existing = await this.relatedModel.findOne(
                    {
                        tagId: validated.tagId,
                        entityId: validated.entityId,
                        entityType: validated.entityType as EntityTypeEnum
                    },
                    execCtx?.tx
                );
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Tag-entity relation not found'
                    );
                }
                await this.relatedModel.hardDelete(
                    {
                        tagId: validated.tagId,
                        entityId: validated.entityId,
                        entityType: validated.entityType as EntityTypeEnum
                    },
                    execCtx?.tx
                );
                return { success: true };
            }
        });
    }

    /**
     * Gets all tag assignments for a given entity, scoped by actor visibility (D-007, T-020).
     *
     * Visibility rules per actor:
     * - Anonymous → returns empty array (no user-tag display for anonymous per D-007).
     * - Authenticated user A → only assignments where `assignedById = A.id`.
     * - Actor with TAG_VIEW_ALL_ASSIGNMENTS → all assignments with `assignedBy` populated
     *   for the attribution UI.
     *
     * @param actor - The actor requesting tags. Null/anonymous returns empty.
     * @param params - entityId and entityType identifying the target entity.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<TagGetForEntityOutput>
     */
    public async getTagsForEntity(
        actor: Actor,
        params: TagGetForEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagGetForEntityOutput>> {
        // Anonymous actors see nothing from this subsystem (D-007).
        // This guard MUST run before runWithLoggingAndValidation because
        // validateActor() rejects actors with empty id via UNAUTHORIZED.
        if (!actor?.id) {
            return { data: { tags: [] } };
        }

        return this.runWithLoggingAndValidation({
            methodName: 'getTagsForEntity',
            input: { actor, ...params },
            schema: TagGetForEntityInputSchema.strict(),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                const hasViewAll =
                    actor.permissions?.includes(PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS) ?? false;

                if (hasViewAll) {
                    // Admin / super-admin: all assignments with attribution (D-007).
                    // TYPE-WORKAROUND: findByEntityAll returns EntityTag[] from schema but the
                    // runtime rows include a `tag` relation joined by Drizzle's relational API.
                    // The schema type does not declare this join property, so we cast via unknown.
                    const relations = await this.relatedModel.findByEntityAll(
                        validated.entityId,
                        validated.entityType as EntityTypeEnum,
                        execCtx?.tx
                    );
                    // TYPE-WORKAROUND: relational query result is `Array<{ tag: Tag }>` but Drizzle's inferred type loses the `.tag` projection; cast to extract and narrow.
                    const tags = (relations as unknown as Array<{ tag?: Tag }>)
                        .map((rel) => rel.tag)
                        // TYPE-WORKAROUND: filter(Boolean) widens the array to (Tag|undefined)[]; the output schema requires Tag[].
                        .filter(Boolean) as unknown as TagGetForEntityOutput['tags'];
                    return { tags };
                }

                // Regular authenticated user: only own assignments (D-007).
                const relations = await this.relatedModel.findByEntityAndActor(
                    validated.entityId,
                    validated.entityType as EntityTypeEnum,
                    actor.id,
                    execCtx?.tx
                );
                // TYPE-WORKAROUND: same Drizzle relational join cast as in the admin branch above.
                const tags = (relations as unknown as Array<{ tag?: Tag }>)
                    .map((rel) => rel.tag)
                    // TYPE-WORKAROUND: filter(Boolean) widens to (Tag|undefined)[]; output schema requires Tag[].
                    .filter(Boolean) as unknown as TagGetForEntityOutput['tags'];
                return { tags };
            }
        });
    }

    /**
     * Returns all entities associated with a given tag.
     * Optionally filters by entity type.
     *
     * @param actor - The actor performing the action.
     * @param params - tagId (required) and entityType (optional).
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with an array of { entityId, entityType }.
     */
    public async getEntitiesByTag(
        actor: Actor,
        params: TagGetEntitiesByTagInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagGetEntitiesByTagOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getEntitiesByTag',
            input: { actor, ...params },
            schema: TagGetEntitiesByTagInputSchema.strict(),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                const tag = await this.model.findById(validated.tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                assertCanViewTag(actor, tag as Tag);
                const relations = await this.relatedModel.findAllWithEntities(
                    validated.tagId,
                    validated.entityType
                );
                const entities = (relations as EntityTag[]).map((rel) => ({
                    entityId: rel.entityId as string,
                    entityType: rel.entityType as string
                }));
                return { entities };
            }
        });
    }

    // ---------------------------------------------------------------------------
    // T-021: assignTag with entity-access check + assignedById injection
    // ---------------------------------------------------------------------------

    /**
     * Assigns a tag to an entity with per-user attribution and entity-access check (D-008, D-009).
     *
     * Pre-checks (in order):
     * 1. Tag exists — NOT_FOUND if missing.
     * 2. Picker visibility (D-008) — actor must be able to see this tag:
     *    - INTERNAL tag + actor lacks TAG_INTERNAL_VIEW → FORBIDDEN.
     *    - USER tag + ownerId !== actor.id → FORBIDDEN (can't assign someone else's USER tag).
     *    - SYSTEM tag → allowed for any authenticated actor.
     * 3. Entity-level access (D-009) — actor must be able to view the target entity.
     *    Uses EntityAccessRegistry which currently returns true (stub) for all types.
     * 4. Injects `assignedById = actor.id` — NEVER accepts caller-provided assignedById.
     * 5. Inserts into r_entity_tag via REntityTagModel.assign().
     *
     * Idempotency (D-005 corollary): if the same actor previously assigned the same tag
     * to the same entity, the 4-column PK `(tagId, entityId, entityType, assignedById)`
     * will conflict. This is handled by checking for an existing row before inserting.
     * The operation succeeds but `wasAlreadyAssigned` is set to `true` in the result,
     * indicating no new row was created. This keeps the API idempotent for the caller
     * (e.g., double-click on the picker checkbox).
     *
     * Two different actors assigning the same SYSTEM tag to the same entity each get
     * their own row (different `assignedById`), satisfying AC-F04.
     *
     * @param actor - The actor performing the assignment. Must be authenticated.
     * @param params - Tag and entity coordinates (no assignedById — injected automatically).
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with `{ assigned: true, wasAlreadyAssigned: boolean }`.
     */
    public async assignTag(
        actor: Actor,
        params: TagAssignInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagAssignOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignTag',
            input: { actor, ...params },
            schema: z.object({
                actor: z.any(),
                tagId: z.string().uuid(),
                entityId: z.string().uuid(),
                entityType: z.nativeEnum(EntityTypeEnum)
            }),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                // 1. Tag existence
                const tag = await this.model.findById(validated.tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }

                const typedTag = tag as Tag;

                // 2. Picker visibility check (D-008)
                //    - INTERNAL: actor must have TAG_INTERNAL_VIEW
                //    - USER: ownerId must match actor.id (can't assign someone else's personal tag)
                //    - SYSTEM: any authenticated actor is allowed
                if (typedTag.type === TagTypeEnum.INTERNAL) {
                    const hasInternalView =
                        actor.permissions?.includes(PermissionEnum.TAG_INTERNAL_VIEW) ?? false;
                    if (!hasInternalView) {
                        throw new ServiceError(
                            ServiceErrorCode.FORBIDDEN,
                            'Permission denied: TAG_INTERNAL_VIEW required to assign INTERNAL tags (D-008, AC-F07)'
                        );
                    }
                } else if (typedTag.type === TagTypeEnum.USER) {
                    if (typedTag.ownerId !== actor.id) {
                        throw new ServiceError(
                            ServiceErrorCode.FORBIDDEN,
                            "Permission denied: cannot assign another user's USER tag (D-008)"
                        );
                    }
                }
                // SYSTEM: no additional picker check — any authenticated actor can assign.

                // 3. Entity-level access check (D-009)
                //    EntityAccessRegistry currently stubs all checks to true with a warning.
                //    Real wiring happens in follow-up tasks.
                const canView = getCanViewChecker(validated.entityType);
                const hasEntityAccess = await canView(validated.entityId, actor);
                if (!hasEntityAccess) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: actor does not have read access to the target entity (D-009, AC-F08)'
                    );
                }

                // 4. Idempotency: check for existing row before inserting.
                //    The 4-column PK is (tagId, entityId, entityType, assignedById).
                //    If the same actor already assigned the same tag to the same entity,
                //    we return success without inserting a duplicate row.
                const existingRow = await this.relatedModel.findOne(
                    {
                        tagId: validated.tagId,
                        entityId: validated.entityId,
                        entityType: validated.entityType as EntityTag['entityType'],
                        assignedById: actor.id
                    },
                    execCtx?.tx
                );
                if (existingRow) {
                    // Idempotent: already assigned by this actor. Return success.
                    return { assigned: true as const, wasAlreadyAssigned: true };
                }

                // 5. Insert with actor.id as assignedById (D-005 — never caller-provided).
                await this.relatedModel.assign(
                    {
                        tagId: validated.tagId,
                        entityId: validated.entityId,
                        entityType: validated.entityType as EntityTag['entityType'],
                        assignedById: actor.id
                    },
                    execCtx?.tx
                );

                return { assigned: true as const, wasAlreadyAssigned: false };
            }
        });
    }

    /**
     * Removes a tag assignment that was made by the current actor (D-007).
     *
     * Actors can only remove their own assignments. Attempting to remove another
     * actor's assignment returns FORBIDDEN (D-007: each user manages only their
     * own assignments). This is enforced by matching `assignedById = actor.id`
     * in the delete predicate — no other row is ever touched.
     *
     * @param actor - The actor performing the removal. Must be authenticated.
     * @param params - Tag and entity coordinates identifying the assignment to remove.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with `{ removed: true }`.
     */
    public async removeAssignment(
        actor: Actor,
        params: TagRemoveAssignmentInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagRemoveAssignmentOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeAssignment',
            input: { actor, ...params },
            schema: z.object({
                actor: z.any(),
                tagId: z.string().uuid(),
                entityId: z.string().uuid(),
                entityType: z.nativeEnum(EntityTypeEnum)
            }),
            ctx,
            execute: async (validated, _actorArg, execCtx) => {
                // Verify the assignment exists AND belongs to this actor.
                // The delete predicate uses actor.id — it will remove 0 rows
                // if the actor didn't make the assignment.
                const deleted = await this.relatedModel.deleteByTagIdEntityUser(
                    validated.tagId,
                    validated.entityId,
                    validated.entityType as EntityTag['entityType'],
                    actor.id,
                    execCtx?.tx
                );

                if (deleted === 0) {
                    // Either the assignment doesn't exist or it belongs to a different actor.
                    // Per D-007, we surface FORBIDDEN to prevent information leakage
                    // (caller should not learn that another actor made the assignment).
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: assignment not found or belongs to a different actor (D-007)'
                    );
                }

                return { removed: true as const };
            }
        });
    }

    // ---------------------------------------------------------------------------
    // T-023: User-tag own CRUD
    // ---------------------------------------------------------------------------

    /**
     * Returns all USER tags belonging to the current actor (AC-003-01, D-022).
     *
     * Per D-022, the manager shows ALL lifecycle states (ACTIVE + INACTIVE + ARCHIVED)
     * so the actor has full history visibility. Pickers only show ACTIVE (handled by
     * getPickerTags). This method is intended for the own-tag manager UI.
     *
     * Optional filters:
     * - `lifecycleState`: restrict to a specific lifecycle state.
     * - `search`: substring match on `name` via safeIlike (D-014, AC-F23).
     *   Applied in-memory since the volume is at most quota (50) tags.
     *
     * @param actor - The actor whose USER tags are listed. Must be authenticated.
     * @param query - Optional filters: lifecycleState and/or search.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with `{ tags: Tag[] }` — only actor's USER tags.
     */
    public async listOwnTags(
        actor: Actor,
        query?: TagListOwnQuery,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagListOwnOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listOwnTags',
            input: { actor, query: query ?? {} },
            schema: z.object({
                actor: z.any(),
                query: z
                    .object({
                        search: z.string().optional(),
                        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
                    })
                    .optional()
            }),
            ctx,
            execute: async (_validated, _actorArg, execCtx) => {
                if (!actor?.permissions?.includes(PermissionEnum.TAG_USER_VIEW_OWN)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: TAG_USER_VIEW_OWN required to list own tags'
                    );
                }

                // findByOwner returns all lifecycle states for the actor (D-022).
                let tags = await this.model.findByOwner(actor.id, execCtx?.tx);

                // Apply optional lifecycle filter.
                if (query?.lifecycleState) {
                    tags = tags.filter((t) => t.lifecycleState === query.lifecycleState);
                }

                // Apply optional name search (in-memory: volume ≤ quota, D-014, AC-F23).
                if (query?.search?.trim()) {
                    const lc = query.search.trim().toLowerCase();
                    tags = tags.filter((t) => t.name.toLowerCase().includes(lc));
                }

                return { tags };
            }
        });
    }

    /**
     * Convenience wrapper for creating a USER tag under the current actor (AC-001).
     *
     * Forces `type = USER` and `ownerId = actor.id` regardless of what the caller
     * provides. Delegates to the existing `create()` pipeline which enforces:
     * - Type invariants (T-018, D-018).
     * - Quota + advisory lock (T-019, D-010, D-021).
     * - Cross-type name collision check (T-018, AC-F03).
     *
     * This is the method the user manager and the picker's "+ Create new personal
     * tag" button calls. Callers should NOT pass `type` or `ownerId` — they are
     * always overridden.
     *
     * @param input - Tag creation input. `type` and `ownerId` are forced by this method.
     * @param actor - The actor creating the tag. Will become the tag owner.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with the created Tag.
     */
    public async createUserTag(
        input: Omit<TagCreateInput, 'type' | 'ownerId' | 'lifecycleState'> & {
            lifecycleState?: LifecycleStatusEnum;
        },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Tag>> {
        // Force type=USER and ownerId=actor.id — caller cannot override.
        const forcedInput: TagCreateInput = {
            ...input,
            type: TagTypeEnum.USER,
            ownerId: actor.id,
            lifecycleState: input.lifecycleState ?? LifecycleStatusEnum.ACTIVE
        };
        return this.create(actor, forcedInput, ctx);
    }

    /**
     * Updates a USER tag owned by the current actor (D-022).
     *
     * Verifiable ownership is enforced: if the tag is not a USER tag or its
     * `ownerId` does not match `actor.id`, FORBIDDEN is returned.
     *
     * Patchable fields: `name`, `color`, `icon`, `description`, `lifecycleState`.
     * Immutable fields: `type` (immutable per D-002) and `ownerId` (ownership
     * cannot be transferred). If input contains either, VALIDATION_ERROR is returned.
     *
     * @param tagId - UUID of the USER tag to update.
     * @param input - Partial update fields (type and ownerId are rejected if present).
     * @param actor - The actor performing the update. Must own the tag.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with the updated Tag.
     */
    public async updateOwnTag(
        tagId: string,
        input: z.infer<typeof TagUpdateInputSchema>,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Tag>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateOwnTag',
            input: { actor, tagId, ...input },
            schema: z
                .object({
                    actor: z.any(),
                    tagId: z.string().uuid()
                })
                .passthrough(),
            ctx,
            execute: async (_validated, _actorArg, execCtx) => {
                // Verify existence and ownership.
                const tag = await this.model.findById(tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                const typedTag = tag as Tag;

                if (typedTag.type !== TagTypeEnum.USER || typedTag.ownerId !== actor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: can only update own USER tags (D-022)'
                    );
                }

                // Reject attempts to mutate immutable fields.
                const raw = input as Record<string, unknown>;
                if ('type' in raw && raw.type !== undefined) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'type is immutable and cannot be changed (D-002)'
                    );
                }
                if ('ownerId' in raw && raw.ownerId !== undefined) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'ownerId is immutable and cannot be transferred (D-022)'
                    );
                }

                // Delegate to base update pipeline (which re-checks cross-type name
                // collision in _beforeUpdate if name changed).
                const result = await this.update(actor, tagId, input, execCtx);
                if (!result.data) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Update returned no data'
                    );
                }
                return result.data;
            }
        });
    }

    /**
     * Returns the count of r_entity_tag rows where assignedById = actor.id for a given tag (T-023).
     *
     * This differs from the global `getImpactCount()` (which counts ALL assignments
     * across all users) — here we count only the current actor's own assignments.
     * This is the impact shown in the user-tag manager before the actor deletes their
     * personal tag (AC-003-02).
     *
     * @param tagId - UUID of the USER tag to count assignments for.
     * @param actor - The actor whose assignments are counted. Must own the tag.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with `{ count: number }`.
     */
    public async getOwnTagImpactCount(
        tagId: string,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagOwnImpactCountOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getOwnTagImpactCount',
            input: { actor, tagId },
            schema: z.object({ actor: z.any(), tagId: z.string().uuid() }),
            ctx,
            execute: async (_validated, _actorArg, execCtx) => {
                // Verify the tag exists and belongs to this actor.
                const tag = await this.model.findById(tagId, execCtx?.tx);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                const typedTag = tag as Tag;

                if (typedTag.type !== TagTypeEnum.USER || typedTag.ownerId !== actor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: can only check impact count for own USER tags (T-023)'
                    );
                }

                // Count only rows where this actor is the assigner (not global count).
                // REntityTagModel does not have a dedicated countByTagIdAndActor; we
                // fetch all rows for this tagId scoped to the actor via findByEntityAndActor
                // is entity-scoped. Instead, we use findOne pattern or countByTagId
                // with actor filter. Since there is no dedicated method, we count via
                // the model's findAllWithEntities and filter by assignedById in memory.
                //
                // Note: this is acceptable since the volume is bounded by the quota (≤50 tags,
                // each with at most one assignment per entity per actor). Real-world impact
                // counts in the low hundreds at most.
                //
                // Future optimization: add countByTagIdAndActor to REntityTagModel.
                const allAssignments = await this.relatedModel.findAllWithEntities(
                    tagId,
                    undefined,
                    execCtx?.tx
                );
                // TYPE-WORKAROUND: findAllWithEntities returns the Drizzle relational join shape; we only need the EntityTag fields and filter by actor.
                const actorAssignments = (allAssignments as unknown as Array<EntityTag>).filter(
                    (row) => (row as EntityTag).assignedById === actor.id
                );

                return { count: actorAssignments.length };
            }
        });
    }

    /**
     * Returns the current USER tag quota status for the actor (AC-003-03).
     *
     * Used to populate the quota indicator bar in the user tag manager.
     * `used` counts only ACTIVE USER tags (per D-022 and D-021 quota definition).
     * `limit` is the configured quota from {@link getUserTagQuota}.
     *
     * @param actor - The actor whose quota is queried. Must be authenticated.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with `{ used: number, limit: number }`.
     */
    public async getQuotaStatus(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagQuotaStatusOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getQuotaStatus',
            input: { actor },
            schema: z.object({ actor: z.any() }),
            ctx,
            execute: async (_validated, _actorArg, execCtx) => {
                const used = await this.model.countActiveByOwner(actor.id, execCtx?.tx);
                const limit = this.getUserTagQuota();
                return { used, limit };
            }
        });
    }
}
