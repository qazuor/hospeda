import type { UserPushTokenModel } from '@repo/db';
import {
    accounts,
    eq,
    getDb,
    safeIlike,
    UserModel,
    userPushTokenModel,
    userRole,
    users as userTable
} from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import { resolveEnvironment } from '@repo/media/server';
import type {
    EntityFilters,
    EntityOptionsItem,
    RoleEnum,
    User,
    UserAdminStats,
    UserOnboarding,
    UserOnboardingWhatsNew
} from '@repo/schemas';
import {
    type CompleteProfileBody,
    CompleteProfileBodySchema,
    type CompleteProfileResponse,
    PermissionEnum,
    type PushTokenRegisterBody,
    PushTokenRegisterBodySchema,
    RoleGrantReason,
    ServiceErrorCode,
    type SetPasswordResponse,
    type SkipSetPasswordResponse,
    type UserAddPermissionInput,
    UserAddPermissionInputSchema,
    UserAdminSearchSchema,
    type UserAssignRoleInput,
    UserAssignRoleInputSchema,
    type UserCreateInput,
    UserCreateInputSchema,
    type UserRemovePermissionInput,
    UserRemovePermissionInputSchema,
    type UserRolePermissionOutput,
    UserSchema,
    type UserSearch,
    type UserSearchResult,
    UserSearchSchema,
    type UserSetPermissionsInput,
    UserSetPermissionsInputSchema,
    type UserUpdateAvatarInput,
    UserUpdateAvatarInputSchema,
    UserUpdateInputSchema
} from '@repo/schemas';
import { inArray, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import type {
    Actor,
    AdminSearchExecuteParams,
    ListOptions,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceLogger,
    ServiceOutput
} from '../../types';
import { listOptionsSchema, ServiceError } from '../../types';
import { serviceLogger } from '../../utils';
import { checkCanFindOptions, hasPermission } from '../../utils/permission';
import { grantRole } from '../user-role/user-role.service.js';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeUserInput,
    normalizeViewInput
} from './user.normalizers';
import { canAssignRole, checkCanAdminList } from './user.permissions';
import type { PublicAuthorListOutput, UserHookState, UserPublicProfile } from './user.types';

/** Entity-specific filter fields for user admin search. */
type UserEntityFilters = EntityFilters<typeof UserAdminSearchSchema>;

/**
 * Resolves the two role filters of `UserAdminSearchSchema` into a single set.
 *
 * `UserAdminSearchSchema` exposes both a legacy singular `role` and a
 * multi-value `roles`, and documents them as coexisting: "if both are present,
 * the resolver intersects them". Nothing implemented that intersection, so
 * before HOS-296 `role` was silently handled as a plain column filter and after
 * the column was dropped it became a runtime failure. This is that resolver.
 *
 * The three outcomes are deliberately distinct:
 * - `undefined` — no role filter was supplied; do not constrain the query.
 * - a non-empty array — match users holding ANY of these roles.
 * - an EMPTY array — both filters were supplied and are disjoint, so no user
 *   can satisfy them. Callers must render this as "match nothing", never as
 *   "no filter", or the operator's query silently widens.
 *
 * An empty `roles` array parsed from `?roles=` or `?roles=,,` is treated as
 * "not supplied", preserving the previous behaviour of never collapsing a
 * blank query parameter into `WHERE FALSE`.
 *
 * @param params.role - Legacy single-value role filter, if supplied.
 * @param params.roles - Multi-value role filter, if supplied.
 * @returns The roles to match, or `undefined` when no filter applies.
 */
export const resolveRoleFilter = ({
    role,
    roles
}: {
    role?: RoleEnum;
    roles?: readonly RoleEnum[];
}): readonly RoleEnum[] | undefined => {
    const hasRoles = roles !== undefined && roles.length > 0;

    if (role !== undefined && hasRoles) {
        return roles.filter((candidate) => candidate === role);
    }
    if (role !== undefined) {
        return [role];
    }
    if (hasRoles) {
        return roles;
    }
    return undefined;
};

/**
 * Service for managing users, roles, and permissions.
 * Enforces strict permission rules:
 * - Only super admin can create, delete, or restore users
 * - Users can update themselves, or be updated by super admin
 * - Only super admin or admin can search/list/count users
 * - Only super admin can manage roles and permissions
 */
export class UserService extends BaseCrudService<
    User,
    UserModel,
    typeof UserCreateInputSchema,
    typeof UserUpdateInputSchema,
    typeof UserSearchSchema
> {
    static readonly ENTITY_NAME = 'user';
    protected readonly entityName = UserService.ENTITY_NAME;
    protected readonly model: UserModel;
    protected readonly schema = UserSchema;
    protected readonly filterSchema = UserSearchSchema;
    protected readonly normalizers: CrudNormalizersFromSchemas<
        typeof UserCreateInputSchema,
        typeof UserUpdateInputSchema,
        typeof UserSearchSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = UserCreateInputSchema;
    protected readonly updateSchema = UserUpdateInputSchema;
    protected readonly searchSchema = UserSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Users are searched by display name, first name, last name, and email.
     */
    protected override getSearchableColumns(): string[] {
        return ['displayName', 'firstName', 'lastName', 'email'];
    }

    /**
     * Optional Cloudinary media provider for avatar cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * Model for the `user_push_tokens` table (SPEC-243 T-011).
     * Injected to allow test substitution via private field override.
     */
    private readonly pushTokenModel: UserPushTokenModel;

    /**
     * Initializes a new instance of the UserService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional UserModel instance (for testing/mocking).
     * @param mediaProvider - Optional ImageProvider for Cloudinary avatar cleanup on hard delete.
     */
    constructor(ctx: ServiceConfig, model?: UserModel, mediaProvider?: ImageProvider | null) {
        super(ctx, UserService.ENTITY_NAME);
        this.logger = ctx.logger ?? serviceLogger;
        this.model = model ?? new UserModel();
        this.adminSearchSchema = UserAdminSearchSchema;
        this.mediaProvider = mediaProvider ?? null;
        this.pushTokenModel = userPushTokenModel;
    }

    /**
     * Lightweight relation-selector lookup (SPEC-169 §5.5 / decision D4).
     *
     * Returns minimal `{ id, label, slug }` items for populating admin relation selectors
     * (e.g. an accommodation owner picker) WITHOUT requiring the broad `USER_READ_ALL` grant
     * normally needed to list users. Gating is admin-panel access only (see
     * {@link checkCanFindOptions}); the route mirrors this with an `ACCESS_PANEL_ADMIN`-only
     * middleware gate.
     *
     * `label` is the user's `displayName`, which is NULLABLE (SPEC-169 §12 flag: see T-018
     * report). It falls back to the (always-present) `email` so the selector never shows an
     * empty label. `slug` is the always-present unique user slug. The search term matches
     * `displayName` and `email`.
     *
     * Results are DRAFT-inclusive (the model's `findAll` only excludes soft-deleted rows) so
     * relations can target users in any lifecycle state.
     *
     * @param actor - The actor performing the lookup (must hold admin-panel access).
     * @param params - `{ q?: string, limit?: number }` — optional search term + result cap.
     * @param ctx - Optional service context (transaction).
     * @returns A `ServiceOutput` with `{ items }` of user options.
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
                const additionalConditions: SQL[] =
                    trimmedQ && trimmedQ.length > 0
                        ? [safeIlike(userTable.displayName, trimmedQ)]
                        : [];

                const { items } = await this.model.findAll(
                    {},
                    { page: 1, pageSize: validatedInput.limit },
                    additionalConditions,
                    execCtx?.tx
                );

                const options: EntityOptionsItem[] = items.map((item) => ({
                    id: item.id,
                    label: item.displayName ?? item.email,
                    slug: item.slug
                }));

                return { items: options };
            }
        });
    }

    /**
     * Resolves a user's PUBLIC author profile by slug.
     *
     * Deliberately does NOT go through `getBySlug`/`_canView`. `_canView` gates
     * the full user row on "self or USER_READ_ALL", which is correct for that
     * row — it carries email, phone, address, roles, settings and onboarding
     * state — but it also made the public author page unreachable: every
     * anonymous visitor got a 403 on
     * `GET /api/v1/public/users/by-slug/{slug}`, which the web app renders as a
     * 404. Loosening `_canView` instead would have been the wrong fix: it also
     * feeds `POST /api/v1/public/users/batch`, which takes a caller-supplied
     * list of ids, so relaxing it would turn a currently-dead endpoint into a
     * live user-enumeration surface.
     *
     * So this method is a separate, narrow read path. It projects exactly
     * {@link UserPublicProfile} and never returns anything else, which is what
     * makes skipping the permission check safe.
     *
     * The projection is a pure function of the row: no branch reads `actor`, so
     * the response is byte-identical for an anonymous visitor, the user
     * themselves, and an admin. The route is edge-cached and its cache key does
     * NOT include the session, so any actor-dependent field here would poison
     * the cache for everyone.
     *
     * Soft-deleted users are treated as absent (`null`). `findOne` does not
     * filter `deleted_at`, so it is filtered explicitly — otherwise a deleted
     * author's profile would keep serving a 200 from a public URL.
     *
     * @param actor - The requesting actor. Used for logging only; it never
     *   changes the result. A guest actor is expected and valid.
     * @param params - `{ slug }` — the user's URL slug.
     * @param ctx - Optional service context (transaction).
     * @returns A `ServiceOutput` with the public profile, or `null` when no
     *   live user owns that slug.
     */
    public async getPublicProfileBySlug(
        actor: Actor,
        params: { slug: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserPublicProfile | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPublicProfileBySlug',
            input: { actor, ...params },
            schema: z.object({ slug: z.string().trim().min(1) }),
            ctx,
            execute: async (validatedInput, _validatedActor, execCtx) => {
                const user = await this.model.findOne({ slug: validatedInput.slug }, execCtx?.tx);

                if (!user || user.deletedAt) return null;

                // The social block is opt-in (HOS-375 §6.7) and the opt-in
                // belongs to the PROFILE OWNER, never to whoever is asking.
                // That is load-bearing, not stylistic: this route is edge-cached
                // (`cacheTTL: 300`) with a cache key that does not include the
                // session, so a viewer-dependent branch here would serve one
                // visitor's payload to everyone. Read the owner's setting only.
                //
                // `settings` itself is never projected — only this one derived
                // boolean's EFFECT is visible.
                const showSocialNetworks = user.settings?.publicProfileShowSocialNetworks === true;

                return {
                    id: user.id,
                    displayName: user.displayName ?? null,
                    slug: user.slug,
                    avatar: user.profile?.avatar ?? null,
                    bio: user.profile?.bio ?? null,
                    // Content-curation flag the author page needs for its
                    // indexability gate (HOS-375 §6.5 cond. 1 / AC-13). A plain
                    // column read, so it does not break the actor-blindness
                    // documented above.
                    isSystemAccount: user.isSystemAccount === true,
                    // Omitted entirely when opted out, rather than emitted as
                    // null: "this author publishes no social links" and "this
                    // author opted out" are the same thing to a consumer, and an
                    // explicit null invites rendering an empty block.
                    ...(showSocialNetworks && user.socialNetworks
                        ? { socialNetworks: user.socialNetworks }
                        : {})
                };
            }
        });
    }

    /**
     * Lists the authors that have a public, INDEXABLE author page.
     *
     * Feeds `GET /api/v1/public/authors`, whose only consumer is the dynamic
     * sitemap (HOS-375 §6.6). The row predicate lives in
     * {@link UserModel.listPublicAuthors} — read its docstring before changing
     * anything about who is included; it mirrors the web helper
     * `evaluateAuthorIndexability`, and the whole point of the pairing is that
     * the sitemap can never advertise a URL the page then serves as `noindex`.
     *
     * Like {@link UserService.getPublicProfileBySlug}, this method runs NO
     * permission check. That is safe for the same reason: it never returns a
     * user row, only `{ slug, updatedAt }` for people whose author page is
     * already public and indexed. `actor` is accepted for logging and is never
     * branched on, so the response is identical for every caller and the route
     * stays safe to cache at the edge.
     *
     * It is NOT a user directory and must never be widened into one. Every row
     * here is already discoverable through the sitemap it exists to build; a
     * looser predicate would turn it into a user-enumeration surface (R-1).
     *
     * @param actor - The requesting actor. Used for logging only; a guest actor
     *   is expected and valid.
     * @param params - `{ page, pageSize }`. Both are optional and defaulted.
     * @param ctx - Optional service context (transaction).
     * @returns A `ServiceOutput` with the page of authors and its pagination.
     */
    public async listPublicAuthors(
        actor: Actor,
        params: { page?: number; pageSize?: number } = {},
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PublicAuthorListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listPublicAuthors',
            input: { actor, ...params },
            schema: z.object({
                page: z.coerce.number().int().min(1).default(1),
                // Capped so a crafted `?pageSize=100000` cannot ask the database
                // for every qualifying author in one request.
                pageSize: z.coerce.number().int().min(1).max(100).default(50)
            }),
            ctx,
            execute: async (validatedInput, _validatedActor, execCtx) => {
                const { page, pageSize } = validatedInput;

                const { items, total } = await this.model.listPublicAuthors(
                    { page, pageSize },
                    execCtx?.tx
                );

                return {
                    items,
                    pagination: {
                        page,
                        pageSize,
                        total,
                        totalPages: Math.ceil(total / pageSize)
                    }
                };
            }
        });
    }

    /**
     * Permission: Requires USER_CREATE permission to create users.
     */
    protected _canCreate(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_CREATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_CREATE permission to create users'
            );
        }
    }

    /**
     * Permission: Requires USER_RESTORE permission to restore users.
     */
    protected _canRestore(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_RESTORE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_RESTORE permission to restore users'
            );
        }
    }

    /**
     * Permission: Self or actor with USER_READ_ALL permission can update.
     */
    protected _canUpdate(actor: Actor, entity: User): void {
        if (actor.id !== entity.id && !hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only self or users with USER_READ_ALL can update user'
            );
        }
    }

    /**
     * Permission: Requires USER_READ_ALL permission to search/list/count users.
     */
    protected _canSearch(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_READ_ALL permission to search users'
            );
        }
    }
    protected _canList(actor: Actor): void {
        this._canSearch(actor);
    }
    protected _canCount(actor: Actor): void {
        this._canSearch(actor);
    }

    /**
     * Permission: Requires USER_UPDATE_ROLES permission to manage permissions.
     */
    protected _canManagePermissions(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_UPDATE_ROLES)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_UPDATE_ROLES permission to manage permissions'
            );
        }
    }

    /**
     * Permission: Requires USER_DELETE permission to soft delete users.
     */
    protected _canSoftDelete(actor: Actor, _entity: User): void {
        if (!hasPermission(actor, PermissionEnum.USER_DELETE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_DELETE permission to soft delete users'
            );
        }
    }

    /**
     * Permission: Requires USER_HARD_DELETE permission to hard delete users.
     */
    protected _canHardDelete(actor: Actor, _entity: User): void {
        if (!hasPermission(actor, PermissionEnum.USER_HARD_DELETE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_HARD_DELETE permission to hard delete users'
            );
        }
    }

    /**
     * Permission: Self or actor with USER_READ_ALL permission can view.
     */
    protected _canView(actor: Actor, entity: User): void {
        if (actor.id !== entity.id && !hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only self or users with USER_READ_ALL can view user'
            );
        }
    }

    /**
     * Permission: Requires USER_READ_ALL permission to update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: User, _newVisibility: unknown): void {
        if (!hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_READ_ALL permission to update user visibility'
            );
        }
    }

    /**
     * Permission: Requires admin access (base class) plus USER_READ_ALL for admin list.
     * Calls super to enforce ACCESS_PANEL_ADMIN / ACCESS_API_ADMIN first, then
     * applies the entity-specific USER_READ_ALL check.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    // --- Lifecycle Hooks ---

    /**
     * Normalizes and generates slug before creating a user.
     */
    protected async _beforeCreate(
        data: UserCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<User>> {
        // Ensure data is properly typed for normalization
        const cleanData = data as Partial<User>;
        const normalized = await normalizeUserInput(cleanData);
        return normalized;
    }

    /**
     * Normalizes and generates slug before updating a user.
     * Bookmarks are always omitted from the result (even if type allows).
     */
    protected async _beforeUpdate(
        data: Partial<User>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<User>> {
        // Remove bookmarks before normalization to avoid type errors
        const { bookmarks, ...rest } = data;
        return normalizeUserInput(rest) as Partial<User>;
    }

    // --- Custom Methods (stubs) ---

    /**
     * Grants a role to a user. Gated by `canAssignRole` (super admin only).
     *
     * **This is a thin wrapper over `grantRole`, and it is ADDITIVE** — the
     * name is historical. It adds a hat; it never replaces one. There is no
     * "unassign" counterpart here: revoking goes through `revokeRole`, which
     * refuses to remove a user's last role.
     *
     * The method had no production caller when HOS-296 landed (only
     * `assignRole.test.ts`). It was migrated rather than deleted because
     * leaving a dead second write path to `users.role` is exactly how the three
     * divergent role writers in the spec's §5.3 came to exist — and the
     * compiler would have surfaced it the moment anyone called it.
     *
     * @param actor - The actor performing the action; recorded as `granted_by`.
     * @param params - The input object containing userId and role.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns The subject user, unchanged — the granted hat lives in
     *   `user_role`, not on the user entity, so nothing about the row differs.
     *   Read the resulting set with `getUserRoles({ userId })`.
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async assignRole(
        actor: Actor,
        params: UserAssignRoleInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignRole',
            input: { ...params, actor },
            schema: UserAssignRoleInputSchema,
            ctx,
            execute: async ({ userId, role }, actor, execCtx) => {
                canAssignRole(actor);
                const user = await this.model.findById(userId, execCtx?.tx);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                // HOS-296: delegate. This method used to own a second write path
                // to `users.role` (`model.update({ role })`) with its own
                // same-role no-op short-circuit. Both are gone: `grantRole` is
                // the single sanctioned writer, it is idempotent on the
                // `(user_id, role)` primary key, and it writes the audit row —
                // which the old direct update never did.
                const granted = await grantRole({
                    userId,
                    role,
                    grantedBy: actor.id,
                    reason: RoleGrantReason.ADMIN_ASSIGN_ROLE,
                    ctx: execCtx
                });
                if (granted.error) {
                    throw granted.error;
                }

                return { user };
            }
        });
    }

    /**
     * Adds a permission to a user. Only super admin.
     * @param actor - The actor performing the action
     * @param params - The input object containing userId and permission
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns The updated user object
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async addPermission(
        actor: Actor,
        params: UserAddPermissionInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addPermission',
            input: { ...params, actor },
            schema: UserAddPermissionInputSchema,
            ctx,
            execute: async ({ userId, permission }, actor, execCtx) => {
                await this._canManagePermissions(actor);
                const user = await this.model.findById(userId, execCtx?.tx);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }
                if (user.permissions.includes(permission)) {
                    return { user };
                }
                const updated = await this.model.update(
                    { id: userId },
                    { permissions: [...user.permissions, permission] },
                    execCtx?.tx
                );
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to add permission'
                    );
                }
                return { user: updated };
            }
        });
    }

    /**
     * Removes a permission from a user. Only super admin.
     * @param actor - The actor performing the action
     * @param params - The input object containing userId and permission
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns The updated user object
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async removePermission(
        actor: Actor,
        params: UserRemovePermissionInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePermission',
            input: { ...params, actor },
            schema: UserRemovePermissionInputSchema,
            ctx,
            execute: async ({ userId, permission }, actor, execCtx) => {
                await this._canManagePermissions(actor);
                const user = await this.model.findById(userId, execCtx?.tx);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }
                if (!user.permissions.includes(permission)) {
                    return { user };
                }
                const updated = await this.model.update(
                    { id: userId },
                    { permissions: user.permissions.filter((p) => p !== permission) },
                    execCtx?.tx
                );
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to remove permission'
                    );
                }
                return { user: updated };
            }
        });
    }

    /**
     * Sets the permissions array for a user. Only super admin.
     * @param actor - The actor performing the action
     * @param params - The input object containing userId and permissions
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns The updated user object
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async setPermissions(
        actor: Actor,
        params: UserSetPermissionsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setPermissions',
            input: { ...params, actor },
            schema: UserSetPermissionsInputSchema,
            ctx,
            execute: async ({ userId, permissions }, actor, execCtx) => {
                await this._canManagePermissions(actor);
                const user = await this.model.findById(userId, execCtx?.tx);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }
                const updated = await this.model.update(
                    { id: userId },
                    { permissions },
                    execCtx?.tx
                );
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to set permissions'
                    );
                }
                return { user: updated };
            }
        });
    }

    /**
     * Updates the user avatar image URL and satellite columns atomically.
     *
     * Writes the `image` URL, `imagePublicId`, `imageModerationState`, and
     * `imageCaption` columns within a single model update so that all four
     * values are committed together or not at all.
     *
     * @param actor - The actor performing the action.
     * @param params - Input containing userId and Cloudinary metadata.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns The updated user object.
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async updateAvatar(
        actor: Actor,
        params: UserUpdateAvatarInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<User>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateAvatar',
            input: { ...params, actor },
            schema: UserUpdateAvatarInputSchema,
            ctx,
            execute: async (
                { userId, imageUrl, imagePublicId, imageModerationState, imageCaption },
                _validatedActor,
                execCtx
            ) => {
                const existing = await this.model.findById(userId, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                const updated = await this.model.update(
                    { id: userId },
                    {
                        image: imageUrl,
                        imagePublicId,
                        imageModerationState,
                        imageCaption: imageCaption ?? null
                    },
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update user avatar'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Executes admin search for users with email partial match support.
     *
     * Overrides the base implementation to handle the `email` filter as a
     * case-insensitive partial match (ILIKE) instead of an exact equality check.
     * Delegates all remaining query assembly (where, pagination, sort, search,
     * relations) to `super._executeAdminSearch()`.
     *
     * @param params - The assembled admin search parameters.
     * @returns A paginated list of users matching the criteria.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<UserEntityFilters>
    ): Promise<PaginatedListOutput<User>> {
        const { where, entityFilters, pagination, sort, search, extraConditions, ctx } = params;
        const { email, role, roles, ...simpleFilters } = entityFilters;

        const additionalConditions: SQL[] = [...(extraConditions ?? [])];

        if (search) {
            additionalConditions.push(search);
        }

        // email partial match (ilike, not eq)
        if (email) {
            additionalConditions.push(safeIlike(userTable.email, email));
        }

        // HOS-296: `users.role` is gone, so neither filter can be a column
        // comparison any more. Left as-is, the legacy singular `role` fell
        // through into `simpleFilters` and reached `findAllWithCounts` as a
        // WHERE on a dropped column — a runtime failure on every
        // `?role=ADMIN` request.
        const roleFilter = resolveRoleFilter({ role, roles });

        if (roleFilter) {
            if (roleFilter.length === 0) {
                // `role` and `roles` were both supplied and disjoint. An empty
                // intersection means "no user can satisfy both", which is NOT
                // the same as "no role filter given" — returning every user
                // here would silently widen the operator's query.
                additionalConditions.push(sql`false`);
            } else {
                // "holds any of these hats" is a semi-join against `user_role`.
                // `IN (subquery)` de-duplicates for us — a JOIN would emit one
                // row per matching hat and inflate the paginated count for a
                // user holding two of the filtered roles.
                // `ctx?.tx` first: every other read in this method threads the
                // caller's transaction, and a subquery built from `getDb()`
                // would silently escape it (SPEC-059 forwarding contract).
                additionalConditions.push(
                    inArray(
                        userTable.id,
                        (ctx?.tx ?? getDb())
                            .select({ userId: userRole.userId })
                            .from(userRole)
                            .where(inArray(userRole.role, [...roleFilter]))
                    )
                );
            }
        }

        return this.model.findAllWithCounts(
            { ...where, ...simpleFilters },
            {
                page: pagination.page,
                pageSize: pagination.pageSize,
                sortBy: sort.sortBy,
                sortOrder: sort.sortOrder
            },
            additionalConditions.length > 0 ? additionalConditions : undefined,
            ctx?.tx
        );
    }

    /**
     * Lifecycle hook: captures the user ID and imagePublicId before hard delete
     * for avatar cleanup in _afterHardDelete.
     *
     * Reads the satellite column `imagePublicId` so the post-delete hook can
     * delete the Cloudinary asset directly without URL parsing.
     *
     * @param id - The ID of the user to hard-delete.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context carrying transaction and hookState.
     */
    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<UserHookState>
    ): Promise<string> {
        if (ctx.hookState) {
            ctx.hookState.deletedEntityId = id;
            // Read imagePublicId from satellite column before the row is gone.
            const user = await this.model.findById(id, ctx.tx);
            ctx.hookState.deletedImagePublicId = user?.imagePublicId ?? null;
        }
        return id;
    }

    /**
     * Lifecycle hook: removes the user avatar from Cloudinary after a confirmed hard delete.
     *
     * Uses the satellite column value (`deletedImagePublicId`) captured in
     * _beforeHardDelete when available. Falls back to the legacy
     * path-construction strategy for rows that pre-date the satellite column.
     *
     * Best-effort: errors are logged but never propagated.
     *
     * @param result - An object containing the count of affected rows.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context carrying transaction and hookState.
     */
    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<UserHookState>
    ): Promise<{ count: number }> {
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            // Prefer the satellite column value; fall back to legacy path construction
            // for rows created before the 0013 migration populated the column.
            const env = resolveEnvironment();
            const publicId =
                ctx.hookState.deletedImagePublicId ??
                `hospeda/${env}/avatars/${ctx.hookState.deletedEntityId}`;
            try {
                await this.mediaProvider.delete({ publicId });
            } catch (mediaError) {
                this.logger.warn(
                    { error: mediaError, publicId },
                    '[media] Failed to clean up Cloudinary avatar for user'
                );
            }
        }
        return result;
    }

    /**
     * Executes a search for users.
     *
     * Reads pagination from `ctx.pagination` (set by BaseCrudRead.search before
     * stripping those keys from `params`). See SPEC-088.
     *
     * @param params - The validated and processed search parameters (filters only — pagination
     *   keys have been stripped by the base class).
     * @param _actor - The actor performing the search.
     * @param ctx - Service execution context carrying pagination via `ctx.pagination`.
     * @returns Paginated list of users matching the criteria.
     */
    protected async _executeSearch(params: UserSearch, _actor: Actor, ctx: ServiceContext) {
        const { page, pageSize } = ctx.pagination ?? {};
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes a count for users.
     * @param params - The validated and processed search parameters (filters, pagination, etc.)
     * @returns Count of users matching the criteria
     */
    protected async _executeCount(params: UserSearch, _actor: Actor, _ctx: ServiceContext) {
        const count = await this.model.count(params);
        return { count };
    }

    /**
     * Override the list method to use findAllWithCounts for better performance
     */
    public override async list(actor: Actor, options: ListOptions = {}, ctx?: ServiceContext) {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, ...options },
            ctx: resolvedCtx,
            schema: listOptionsSchema,
            execute: async (validatedOptions, validatedActor, execCtx) => {
                await this._canList(validatedActor);

                const normalized =
                    (await this.normalizers?.list?.(validatedOptions || {}, validatedActor)) ??
                    (validatedOptions || {});
                const processedOptions = await this._beforeList(
                    normalized,
                    validatedActor,
                    execCtx
                );

                // Use the efficient findAllWithCounts method
                const result = await this.model.findAllWithCounts(processedOptions.where ?? {}, {
                    page: processedOptions.page,
                    pageSize: processedOptions.pageSize
                });

                return this._afterList(result, validatedActor, execCtx);
            }
        });
    }

    /**
     * Searches for users with accommodation, event, and post counts.
     * Uses the efficient findAllWithCounts method that fetches counts via
     * correlated subqueries instead of N+1 individual queries.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns Users with counts
     */
    public async searchForList(
        actor: Actor,
        params: UserSearch,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserSearchResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'searchForList',
            input: { ...params, actor },
            schema: UserSearchSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                await this._canSearch(validatedActor);
                const { page, pageSize } = validated;

                const result = await this.model.findAllWithCounts(validated, { page, pageSize });

                const itemsWithCounts = result.items.map((user) => ({
                    ...user,
                    accommodationCount: user.accommodationsCount,
                    eventsCount: user.eventsCount,
                    postsCount: user.postsCount
                }));

                return {
                    data: itemsWithCounts,
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

    // -----------------------------------------------------------------------
    // SPEC-113 — Profile completion flow methods
    // -----------------------------------------------------------------------

    /**
     * Checks whether a user needs to set a password.
     *
     * Returns TRUE when the user has at least one OAuth account row
     * (`providerId IN ('google','facebook')`) AND zero credential account rows
     * (`providerId = 'credential'`).  Used internally by `completeProfile` to
     * compute the `requiresSetPassword` response flag.
     *
     * @param userId - The user's UUID.
     * @returns TRUE if the user is OAuth-only (no credential account row).
     */
    private async _userRequiresSetPassword(userId: string): Promise<boolean> {
        const db = getDb();
        const userAccounts = await db
            .select({ providerId: accounts.providerId })
            .from(accounts)
            .where(eq(accounts.userId, userId));

        const hasOAuthAccount = userAccounts.some((a) =>
            ['google', 'facebook'].includes(a.providerId)
        );
        const hasCredentialAccount = userAccounts.some((a) => a.providerId === 'credential');

        return hasOAuthAccount && !hasCredentialAccount;
    }

    /**
     * Completes the post-signup profile for an authenticated user.
     *
     * Persists the supplied form fields (displayName, firstName, phone, locale,
     * newsletterOptIn) to the user row and flips `profileCompleted = true`.
     * The caller MUST be acting on their own account — this method verifies
     * `actor.id === input.userId` and throws FORBIDDEN otherwise.
     *
     * Phone is stored in `contactInfo.mobilePhone`.
     * Locale is stored in `settings.languageWeb`.
     * `newsletterOptIn` is intentionally NOT persisted here — the route layer
     * delegates newsletter subscription to `NewsletterSubscriberService` before
     * calling this method.
     *
     * @param actor - The actor performing the action.
     * @param input - Validated form fields plus the target userId.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ profileCompleted: true, requiresSetPassword: boolean }`.
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async completeProfile(
        actor: Actor,
        input: { userId: string } & CompleteProfileBody,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CompleteProfileResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'completeProfile',
            input: { ...input, actor },
            schema: CompleteProfileBodySchema.extend({ userId: UserSchema.shape.id }),
            ctx,
            execute: async (
                {
                    userId,
                    firstName,
                    lastName,
                    displayName,
                    birthDate,
                    imageUrl,
                    phone,
                    locale,
                    bio,
                    website,
                    occupation,
                    socialNetworks,
                    location
                },
                actor,
                execCtx
            ) => {
                // Self-only guard — actor may only complete their own profile.
                if (actor.id !== userId) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: can only complete your own profile'
                    );
                }

                const existing = await this.model.findById(userId, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                // Derive display name server-side when client did not override it.
                // Defense-in-depth: do not trust the client to always send the derived value.
                const resolvedDisplayName =
                    displayName?.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();

                // Merge phone into existing contactInfo (shallow merge).
                const existingContactInfo = (existing.contactInfo as Record<string, unknown>) ?? {};
                const contactInfo = phone
                    ? { ...existingContactInfo, mobilePhone: phone }
                    : existingContactInfo;

                // Merge locale into existing settings (shallow merge).
                const existingSettings = (existing.settings as Record<string, unknown>) ?? {};
                const settings = locale
                    ? { ...existingSettings, languageWeb: locale }
                    : existingSettings;

                // Merge bio/website/occupation into existing profile JSONB (shallow merge).
                const existingProfile = (existing.profile as Record<string, unknown>) ?? {};
                const hasProfileFields =
                    bio !== undefined || website !== undefined || occupation !== undefined;
                const profile = hasProfileFields
                    ? {
                          ...existingProfile,
                          ...(bio !== undefined && { bio }),
                          ...(website !== undefined && { website }),
                          ...(occupation !== undefined && { occupation })
                      }
                    : existingProfile;

                // Merge social networks into existing JSONB (shallow merge).
                const existingSocial = (existing.socialNetworks as Record<string, unknown>) ?? {};
                const resolvedSocialNetworks = socialNetworks
                    ? { ...existingSocial, ...socialNetworks }
                    : existingSocial;

                // The JSONB columns (socialNetworks, location) and the
                // string-vs-Date birthDate are intentionally permissive at
                // runtime — Drizzle stores whatever the column accepts. We
                // cast to Partial<User> at the model.update boundary because
                // the Zod-derived User type tightens each JSONB field to its
                // full schema (SocialNetwork, FullLocationType) while we
                // accept partial onboarding subsets here.
                // birthDate is converted to Date since the column is typed
                // as timestamp and Drizzle expects a Date, not the ISO
                // string the HTTP body carries.
                const patch = {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    displayName: resolvedDisplayName,
                    profileCompleted: true,
                    ...(Object.keys(contactInfo).length > 0 && { contactInfo }),
                    ...(Object.keys(settings).length > 0 && { settings }),
                    ...(Object.keys(profile).length > 0 && { profile }),
                    ...(Object.keys(resolvedSocialNetworks).length > 0 && {
                        socialNetworks: resolvedSocialNetworks
                    }),
                    ...(birthDate !== undefined && { birthDate: new Date(birthDate) }),
                    ...(imageUrl !== undefined && { image: imageUrl }),
                    ...(location !== undefined && { location })
                } as Partial<User>;

                const updated = await this.model.update({ id: userId }, patch, execCtx?.tx);

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update user profile'
                    );
                }

                const requiresSetPassword = await this._userRequiresSetPassword(userId);

                return { profileCompleted: true as const, requiresSetPassword };
            }
        });
    }

    /**
     * Records that an OAuth-only user has been shown the set-password prompt
     * and chose to skip it.
     *
     * Flips `setPasswordPrompted = true` without creating any credential account
     * row.  Subsequent middleware checks will see this flag and not redirect the
     * user again.
     *
     * The caller MUST be acting on their own account.
     *
     * @param actor - The actor performing the action.
     * @param input - Object containing the target userId.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ setPasswordPrompted: true, credentialCreated: false }`.
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async skipSetPassword(
        actor: Actor,
        input: { userId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SkipSetPasswordResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'skipSetPassword',
            input: { ...input, actor },
            schema: z.object({ userId: UserSchema.shape.id }),
            ctx,
            execute: async ({ userId }, actor, execCtx) => {
                if (actor.id !== userId) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: can only skip set-password for your own account'
                    );
                }

                const existing = await this.model.findById(userId, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                const updated = await this.model.update(
                    { id: userId },
                    { setPasswordPrompted: true } as Partial<User>,
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update set_password_prompted flag'
                    );
                }

                return { setPasswordPrompted: true as const, credentialCreated: false as const };
            }
        });
    }

    /**
     * Records that the set-password flow completed successfully for a user.
     *
     * Called AFTER the route layer has invoked Better Auth's `setPassword`
     * endpoint (which creates the `credential` account row).  This method
     * only flips `setPasswordPrompted = true` on the user row so subsequent
     * middleware checks do not re-prompt the user.
     *
     * The caller MUST be acting on their own account.
     *
     * @param actor - The actor performing the action.
     * @param input - Object containing the target userId.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ setPasswordPrompted: true, credentialCreated: true }`.
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async markSetPasswordDone(
        actor: Actor,
        input: { userId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SetPasswordResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markSetPasswordDone',
            input: { ...input, actor },
            schema: z.object({ userId: UserSchema.shape.id }),
            ctx,
            execute: async ({ userId }, actor, execCtx) => {
                if (actor.id !== userId) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: can only mark set-password done for your own account'
                    );
                }

                const existing = await this.model.findById(userId, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                const updated = await this.model.update(
                    { id: userId },
                    { setPasswordPrompted: true } as Partial<User>,
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update set_password_prompted flag'
                    );
                }

                return { setPasswordPrompted: true as const, credentialCreated: true as const };
            }
        });
    }

    /**
     * Returns aggregated admin dashboard statistics for the users entity.
     *
     * Gated on `USER_READ_ALL` — the same permission used by `adminList` and
     * `getById`. Delegates the two DB aggregations to `UserModel.getAdminStats`.
     *
     * @param actor - The actor performing the action. Must have `USER_READ_ALL`.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ byRole, newUsersTrend }` shaped per `UserAdminStatsSchema`.
     * @throws ServiceError (FORBIDDEN) when actor lacks permission.
     * @throws ServiceError (INTERNAL_ERROR) on unexpected DB errors.
     */
    public async getAdminStats(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserAdminStats>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAdminStats',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                if (!hasPermission(validatedActor, PermissionEnum.USER_READ_ALL)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: USER_READ_ALL required for user admin stats'
                    );
                }
                return this.model.getAdminStats(execCtx?.tx);
            }
        });
    }

    // -----------------------------------------------------------------------
    // SPEC-175 — What's New seen-state methods
    // -----------------------------------------------------------------------

    /**
     * Marks one or more What's New entry ids as seen for the authenticated user.
     *
     * Performs a **defensive read-modify-write** at the service level regardless
     * of the underlying JSONB column's replace/merge behaviour. The `settings`
     * column in `UserModel` does NOT declare `mergeableJsonbColumns` for
     * `settings`, so `model.update` would REPLACE the whole column. This method
     * therefore reads the current settings first, computes the union of existing
     * and new seenIds via `Set`, and writes back only the merged object — keeping
     * ALL sibling keys (`theme`, `language`, `notifications`, `newsletter`,
     * `onboarding.adminTours`, `onboarding.whatsNew.baselineAt`) intact.
     *
     * Idempotent: calling twice with overlapping ids is safe — Set union never
     * produces duplicates.
     *
     * @param actor - The authenticated actor performing the action (self-only).
     * @param input - `{ ids }` — non-empty array of entry ids to mark as seen.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ success: true }` on success.
     * @throws ServiceError (NOT_FOUND) when the actor's user row is missing.
     * @throws ServiceError (INTERNAL_ERROR) on update failure.
     */
    public async markWhatsNewSeen(
        actor: Actor,
        input: { ids: string[] },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: true }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markWhatsNewSeen',
            input: { ...input, actor },
            schema: z.object({
                ids: z.array(z.string().min(1)).min(1)
            }),
            ctx,
            execute: async ({ ids }, validatedActor, execCtx) => {
                // Read current user (defensive read-modify-write).
                const existing = await this.model.findById(validatedActor.id, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                // Shallow-cast JSONB to typed settings. settings may be null/undefined.
                const currentSettings = (existing.settings as Record<string, unknown>) ?? {};

                // Safely navigate the onboarding.whatsNew namespace.
                const currentOnboarding =
                    (currentSettings.onboarding as Record<string, unknown>) ?? {};
                const currentWhatsNew =
                    (currentOnboarding.whatsNew as UserOnboardingWhatsNew) ?? {};
                const currentSeenIds: string[] = currentWhatsNew.seenIds ?? [];

                // Set-union: idempotent, no duplicates.
                const newSeenIds = Array.from(new Set([...currentSeenIds, ...ids]));

                // Deep-merge preserving ALL sibling keys.
                const mergedSettings: Record<string, unknown> = {
                    ...currentSettings,
                    onboarding: {
                        ...currentOnboarding,
                        whatsNew: {
                            ...currentWhatsNew,
                            seenIds: newSeenIds
                        }
                    }
                };

                const updated = await this.model.update(
                    { id: validatedActor.id },
                    { settings: mergedSettings } as Partial<User>,
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update whats-new seenIds'
                    );
                }

                return { success: true as const };
            }
        });
    }

    /**
     * Lazily initialises the `onboarding.whatsNew` namespace in the actor's
     * settings when it is absent.
     *
     * Sets `baselineAt = now().toISOString()` and `seenIds = []`, preserving
     * all sibling keys. If the namespace already exists, this is a no-op and
     * returns success without writing to the database.
     *
     * Used by `GET /api/v1/protected/whats-new` to ensure every user has a
     * baseline timestamp after their first request — entries published before
     * `baselineAt` are automatically treated as seen, preventing pre-existing
     * users from being flooded on feature deploy.
     *
     * @param actor - The authenticated actor performing the action (self-only).
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ initialized: boolean }` — `true` when a write occurred, `false` when already present.
     * @throws ServiceError (NOT_FOUND) when the actor's user row is missing.
     * @throws ServiceError (INTERNAL_ERROR) on update failure.
     */
    public async initWhatsNewBaseline(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ initialized: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'initWhatsNewBaseline',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                // Read current user (defensive read-modify-write).
                const existing = await this.model.findById(validatedActor.id, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                const currentSettings = (existing.settings as Record<string, unknown>) ?? {};
                const currentOnboarding =
                    (currentSettings.onboarding as Record<string, unknown>) ?? {};
                const currentWhatsNew = currentOnboarding.whatsNew as
                    | UserOnboardingWhatsNew
                    | undefined;

                // No-op if already initialized.
                if (currentWhatsNew !== undefined) {
                    return { initialized: false };
                }

                const mergedSettings: Record<string, unknown> = {
                    ...currentSettings,
                    onboarding: {
                        ...currentOnboarding,
                        whatsNew: {
                            baselineAt: new Date().toISOString(),
                            seenIds: [] as string[]
                        } satisfies UserOnboardingWhatsNew
                    }
                };

                const updated = await this.model.update(
                    { id: validatedActor.id },
                    { settings: mergedSettings } as Partial<User>,
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to initialise whats-new baseline'
                    );
                }

                return { initialized: true };
            }
        });
    }

    // -----------------------------------------------------------------------
    // SPEC-174 — Admin tour seen-state method
    // -----------------------------------------------------------------------

    /**
     * Records that the authenticated user has seen (or skipped) a specific
     * admin tour at the given config version.
     *
     * Performs a **defensive read-modify-write** at the service level, mirroring
     * the approach used by {@link markWhatsNewSeen}. The `settings` column in
     * `UserModel` is REPLACE-mode (no `mergeableJsonbColumns` declared for
     * `settings`), so this method reads the current settings, sets
     * `settings.onboarding.adminTours[tourId] = version`, and writes back the
     * full merged object — keeping ALL sibling keys intact:
     * - `theme*`, `language*`, `notifications`, `newsletter`
     * - `onboarding.whatsNew` (baselineAt + seenIds untouched)
     * - Any other `onboarding.adminTours` entries for other tour ids.
     *
     * Calling this method twice with the same `tourId` simply overwrites the
     * stored version with the same value (idempotent).
     *
     * @param actor - The authenticated actor performing the action (self-only: `me` endpoint).
     * @param input - `{ tourId, version }` — the catalog id and config version being acknowledged.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ success: true }` on success.
     * @throws ServiceError (NOT_FOUND) when the actor's user row is missing.
     * @throws ServiceError (INTERNAL_ERROR) on update failure.
     */
    public async markAdminTourSeen(
        actor: Actor,
        input: { tourId: string; version: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: true }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markAdminTourSeen',
            input: { ...input, actor },
            schema: z.object({
                tourId: z.string().min(1).max(100),
                version: z.number().int().nonnegative()
            }),
            ctx,
            execute: async ({ tourId, version }, validatedActor, execCtx) => {
                // Read current user (defensive read-modify-write).
                const existing = await this.model.findById(validatedActor.id, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                // Shallow-cast JSONB to typed settings. settings may be null/undefined.
                const currentSettings = (existing.settings as Record<string, unknown>) ?? {};

                // Safely navigate the onboarding namespace, preserving all sibling keys.
                const currentOnboarding =
                    (currentSettings.onboarding as Record<string, unknown>) ?? {};
                const currentAdminTours =
                    (currentOnboarding.adminTours as UserOnboarding['adminTours']) ?? {};

                // Deep-merge: update only the specific tourId, keep all other keys.
                const mergedSettings: Record<string, unknown> = {
                    ...currentSettings,
                    onboarding: {
                        ...currentOnboarding,
                        adminTours: {
                            ...currentAdminTours,
                            [tourId]: version
                        }
                    }
                };

                const updated = await this.model.update(
                    { id: validatedActor.id },
                    { settings: mergedSettings } as Partial<User>,
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update admin tour seen state'
                    );
                }

                return { success: true as const };
            }
        });
    }

    // -----------------------------------------------------------------------
    // SPEC-243 T-011 — Mobile push-token registration
    // -----------------------------------------------------------------------

    /**
     * Registers (or re-registers) an Expo push token for the calling user.
     *
     * Performs an UPSERT keyed on the global UNIQUE(`token`) constraint.
     * If the token was previously registered by another user (re-login on the
     * same device), ownership is transferred to the current actor.
     *
     * Self-scoped: always uses `actor.id`.  No extra permission beyond being
     * authenticated is required (protected-tier endpoint).
     *
     * @param actor - The authenticated actor registering the token.
     * @param input - `{ token, platform }` — validated body fields.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ registered: true }` on success.
     * @throws ServiceError (VALIDATION_ERROR, INTERNAL_ERROR)
     */
    public async registerPushToken(
        actor: Actor,
        input: PushTokenRegisterBody,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ registered: true }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'registerPushToken',
            input: { ...input, actor },
            schema: PushTokenRegisterBodySchema,
            ctx,
            execute: async ({ token, platform }, validatedActor, execCtx) => {
                await this.pushTokenModel.upsertByToken(
                    { userId: validatedActor.id, token, platform },
                    execCtx?.tx
                );
                return { registered: true as const };
            }
        });
    }

    // -----------------------------------------------------------------------
    // SPEC-289 — Search History preference methods
    // -----------------------------------------------------------------------

    /**
     * Toggles the `settings.searchHistoryEnabled` preference for the actor.
     *
     * Performs a **defensive read-modify-write** so all sibling settings keys
     * are preserved (same pattern as {@link markWhatsNewSeen}). Setting
     * `enabled = false` pauses search history recording without deleting
     * existing entries; setting it back to `true` resumes recording.
     *
     * @param actor - The authenticated actor performing the action (self-only).
     * @param input - `{ enabled }` — `true` to enable, `false` to pause.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ success: true }` on success.
     * @throws ServiceError (NOT_FOUND) when the actor's user row is missing.
     * @throws ServiceError (INTERNAL_ERROR) on update failure.
     */
    public async patchSearchHistoryPreferences(
        actor: Actor,
        input: { enabled: boolean },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: true }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'patchSearchHistoryPreferences',
            input: { ...input, actor },
            schema: z.object({ enabled: z.boolean() }),
            ctx,
            execute: async ({ enabled }, validatedActor, execCtx) => {
                // Defensive read-modify-write: preserve all sibling settings keys.
                const existing = await this.model.findById(validatedActor.id, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }

                const currentSettings = (existing.settings as Record<string, unknown>) ?? {};
                const mergedSettings: Record<string, unknown> = {
                    ...currentSettings,
                    searchHistoryEnabled: enabled
                };

                const updated = await this.model.update(
                    { id: validatedActor.id },
                    { settings: mergedSettings } as Partial<User>,
                    execCtx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update search history preferences'
                    );
                }

                return { success: true as const };
            }
        });
    }
}
