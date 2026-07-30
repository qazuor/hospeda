/**
 * Universal Actor Middleware.
 *
 * Creates and injects an Actor into the Hono context for all routes.
 * Reads the authenticated user from context (set by auth middleware)
 * and resolves permissions from the database. Unauthenticated requests
 * receive a guest actor with minimal public access.
 *
 * @module actor-middleware
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { getUserRoles } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { setRequestContextActor } from '../lib/request-context';
import { createGuestActor } from '../utils/actor';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { getPermissionsForRoles } from '../utils/role-permissions-cache';
import { getUserPermissionsWithEffect } from '../utils/user-permissions-cache';

/**
 * Schema for validating mock actor permissions.
 * @internal TEST-ONLY
 */
const MockPermissionsSchema = z.array(z.nativeEnum(PermissionEnum));

/**
 * Check if mock actor headers are allowed.
 * @internal TEST-ONLY .. Never enable in production or staging!
 *
 * Mock actor headers are ONLY accepted when ALL conditions are met:
 * - NODE_ENV === 'test'
 * - ALLOW_MOCK_ACTOR === 'true' (explicit opt-in)
 * - CI !== 'true' (never in CI pipelines with real tokens)
 *
 * Headers:
 * - x-mock-actor-id: UUID of the mock actor
 * - x-mock-actor-role: Role enum value, or a comma-separated list of them
 *   (HOS-296 — an actor now holds a SET of roles)
 * - x-mock-actor-permissions: JSON array of permissions
 */
const isMockActorAllowed = (): boolean => {
    return env.NODE_ENV === 'test' && env.HOSPEDA_ALLOW_MOCK_ACTOR === true && env.CI !== 'true';
};

/**
 * Resolves the roles an authenticated user holds, with an EXPLICIT failure
 * policy (HOS-296).
 *
 * The two sibling reads in this middleware — `getPermissionsForRoles` and
 * `getUserPermissionsWithEffect` — swallow their errors and degrade to an
 * empty set. This one deliberately does NOT, and the asymmetry is the point:
 *
 * - Degrading a PERMISSION read removes capabilities from an identity that is
 *   still correct. It fails closed and the worst outcome is a spurious 403.
 * - Degrading a ROLE read changes WHO the actor is. A `SUPER_ADMIN` would
 *   silently become a plain `USER`, every admin surface would answer 403 with
 *   nothing explaining it, and any code that reads "not staff" as "scope this
 *   to the owner" would produce a different response body for the same URL —
 *   the exact shape of a cache-poisoning bug.
 *
 * So a failed role read is an outage, surfaced as a retryable 503 rather than
 * as a quietly downgraded session.
 *
 * An EMPTY result is treated identically to a failed one. Zero rows is a data
 * bug, never a legitimate state — signup grants the baseline `USER` hat and
 * `revokeRole` refuses to remove the last one — and falling back to `[USER]`
 * would produce exactly the outcome this policy exists to prevent: on a
 * database that has the `user_role` table but no rows (a documented state in
 * the backfill runbook, and one Drizzle will not re-migrate), EVERY signed-in
 * account, super admins included, would silently become a plain `USER` and
 * lock itself out of the admin panel with no in-app route to self-repair.
 *
 * KNOWN TRADE-OFF (deliberately not fixed here): `actorMiddleware` is global,
 * so this policy also reaches `/api/v1/public/*`. A transient failure therefore
 * serves 503 to signed-in visitors on public pages while anonymous ones are
 * unaffected. Narrowing the middleware's scope so public routes resolve a guest
 * actor instead is an architectural change out of scope for HOS-296; the
 * fail-loud identity guarantee was judged the more important of the two.
 *
 * @param params.userId - Authenticated user id.
 * @returns Every role the user holds; never empty.
 * @throws {HTTPException} 503 when the role set cannot be resolved, or resolves
 *   to an empty set.
 */
const resolveHeldRoles = async (params: { userId: string }): Promise<readonly RoleEnum[]> => {
    let roles: readonly RoleEnum[];

    try {
        roles = await getUserRoles({ userId: params.userId });
    } catch (error) {
        apiLogger.error(
            `Failed to resolve the role set for user ${params.userId}: ${
                error instanceof Error ? error.message : String(error)
            }. Refusing to degrade to a partial identity.`
        );
        throw new HTTPException(503, { message: 'Service temporarily unavailable' });
    }

    if (roles.length === 0) {
        apiLogger.error(
            `User ${params.userId} holds no roles in user_role. This is a data integrity problem — every account must hold at least the baseline ${RoleEnum.USER} hat. Refusing to degrade to a partial identity.`
        );
        throw new HTTPException(503, { message: 'Service temporarily unavailable' });
    }

    return roles;
};

/**
 * Universal actor middleware that runs on all routes.
 * Reads the authenticated user from context (set by auth middleware)
 * and builds the appropriate Actor with permissions.
 *
 * For authenticated users:
 * - SUPER_ADMIN gets all permissions without DB lookup
 * - Other roles get permissions from the database via UserCache
 *
 * For unauthenticated requests:
 * - Creates a guest actor with public access only
 *
 * @returns Middleware that injects actor into context
 */
export const actorMiddleware = (): MiddlewareHandler => {
    return async (c, next) => {
        /**
         * @internal TEST-ONLY: Mock actor headers for E2E tests.
         * These headers are ONLY processed when:
         * - NODE_ENV === 'test'
         * - ALLOW_MOCK_ACTOR === 'true'
         *
         * @warning NEVER enable ALLOW_MOCK_ACTOR in production or staging!
         */
        if (isMockActorAllowed()) {
            const mockActorId = c.req.header('x-mock-actor-id');
            const mockActorRole = c.req.header('x-mock-actor-role');
            const mockActorPermissions = c.req.header('x-mock-actor-permissions');

            if (mockActorId && mockActorRole && mockActorPermissions) {
                // Validate the mock actor's role SET. The header stays a single
                // value in the common case; a comma-separated list lets a test
                // exercise a multi-hat actor without a second header.
                const roleValidation = z
                    .array(z.nativeEnum(RoleEnum))
                    .nonempty()
                    .safeParse(mockActorRole.split(',').map((value) => value.trim()));
                if (!roleValidation.success) {
                    throw new HTTPException(400, {
                        message: `Invalid mock actor role: ${mockActorRole}. Must be one of: ${Object.values(RoleEnum).join(', ')}`
                    });
                }

                // Parse and validate permissions with proper error handling
                let parsedPermissions: PermissionEnum[];
                try {
                    const rawPermissions = JSON.parse(mockActorPermissions);
                    const permissionsValidation = MockPermissionsSchema.safeParse(rawPermissions);

                    if (!permissionsValidation.success) {
                        throw new HTTPException(400, {
                            message: `Invalid mock actor permissions format: ${permissionsValidation.error.message}`
                        });
                    }

                    parsedPermissions = permissionsValidation.data;
                } catch (error) {
                    if (error instanceof HTTPException) {
                        throw error;
                    }
                    // JSON parse error
                    throw new HTTPException(400, {
                        message: `Invalid mock actor permissions JSON: ${error instanceof Error ? error.message : 'Parse error'}`
                    });
                }

                const actor: Actor = {
                    id: mockActorId,
                    roles: roleValidation.data,
                    permissions: parsedPermissions
                };

                apiLogger.debug(
                    `Using mock actor for testing: actorId=${mockActorId}, roles=${roleValidation.data.join(',')}, permissionsCount=${parsedPermissions.length}`
                );

                c.set('actor', actor);
                await next();
                return;
            }
        }

        // Read authenticated user from context (set by auth middleware)
        const user = c.get('user');
        let actor: Actor;

        if (user?.id) {
            try {
                // HOS-296: the role set is NOT on the session user any more.
                //
                // `users.role` was dropped, so Better Auth's `additionalFields`
                // — a plain column mapping — has no source for it and the
                // session object carries no role at all. The hats live in
                // `user_role`, one row each, and are read here per request.
                //
                // This is the SAME route billing entitlements already take
                // (`entitlementMiddleware` queries the DB and `c.set`s the
                // result, which this middleware merges into the actor below):
                // a per-request value the plain-column session cannot express.
                // Resolving them here is what makes them travel for free on
                // `GET /api/v1/public/auth/me`, which is the one contract every
                // downstream consumer reads (HOS-296 OQ-4, actor-only).
                //
                // The read is UNCACHED and runs once per authenticated
                // request. A 60s process-local cache was tried and removed —
                // see `getUserRoles`' JSDoc for why (pre-commit invalidation).
                //
                // An account with zero rows is a data bug, not a legitimate
                // state, and is treated as an outage rather than degraded to
                // `[USER]`. Failure policy, including the empty-set case and
                // its public-route trade-off: see `resolveHeldRoles`.
                //
                // TEST-ONLY short-circuit: when the mock-auth middleware
                // fabricated the session user it also fabricated its hats,
                // because that user has no `user_role` rows to read.
                const mockRoles = c.get('mockUserRoles');
                const userRoles: readonly RoleEnum[] =
                    mockRoles ?? (await resolveHeldRoles({ userId: user.id }));

                // Better Auth maps its virtual `name` field to `display_name`
                // (see apps/api/src/lib/auth.ts: user.fields.name = 'displayName')
                // and exposes it on the session user object as `.name`. The
                // `image` field is auto-populated by Better Auth on OAuth
                // signin (Google `picture` claim, Facebook profile photo) and
                // mirrors `users.image`. We forward name, email, and image
                // onto the actor so /auth/me can surface them to the web
                // UserMenu without a separate fetch (SPEC-113 — keeps the
                // navbar name + avatar in sync after profile mutations).
                const userName = typeof user.name === 'string' ? user.name : undefined;
                const userEmail = typeof user.email === 'string' ? user.email : undefined;
                const userImage = typeof user.image === 'string' ? user.image : undefined;
                // Better Auth's session.user mirrors `users.email_verified` here.
                // We forward the flag onto Actor so NewsletterSubscriberService.subscribe
                // can branch between direct-to-active (verified) and the
                // NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED block (unverified) without a
                // second DB read on every call.
                const userEmailVerified =
                    typeof user.emailVerified === 'boolean' ? user.emailVerified : undefined;
                // HOS-296: `users.must_change_password` rides on the actor.
                //
                // It is a Better Auth `additionalField`, so it only ever
                // existed on the native `get-session` response. Once `apps/web`
                // stopped reading that endpoint (it no longer carries the role
                // set), the commerce-owner password gate would either have died
                // silently or cost a second round-trip on every protected
                // route. Forwarding it here makes `/auth/me` the single source
                // for everything the middleware needs.
                //
                // Normalised to a strict boolean: the column is nullable, and
                // the gate's semantics are "block only on an explicit true".
                const userMustChangePassword = user.mustChangePassword === true;

                // SUPER_ADMIN keeps its short-circuit, now on "HOLDS
                // SUPER_ADMIN" rather than "IS SUPER_ADMIN": the hat wins
                // regardless of what else the account wears.
                if (userRoles.includes(RoleEnum.SUPER_ADMIN)) {
                    actor = {
                        id: user.id,
                        roles: userRoles,
                        permissions: Object.values(PermissionEnum),
                        name: userName,
                        email: userEmail,
                        emailVerified: userEmailVerified,
                        image: userImage,
                        mustChangePassword: userMustChangePassword
                    };
                } else {
                    // Resolve the UNION of the permissions of every held role
                    // from role_permission (cached on a sorted role-set key).
                    const rolePermissions = await getPermissionsForRoles({ roles: userRoles });

                    // Merge per-user overrides from user_permission (cached), split by
                    // effect. Effective set = (⋃ perms(role) for role in roles ∪ grants)
                    // \ denies (HOS-296 AC-3), with deny winning over grant (SPEC-170).
                    //
                    // The deny pass runs LAST and over the whole union, so a deny beats a
                    // grant arriving from ANY held role — accumulating hats can never be
                    // used to walk around an explicit per-user deny (R-1).
                    //
                    // An actor HOLDING SUPER_ADMIN never reaches this branch, so denies
                    // can never strip a super (handled by the short-circuit above).
                    const userOverrides = await getUserPermissionsWithEffect({ userId: user.id });

                    const effectivePermissions = new Set<PermissionEnum>([
                        ...rolePermissions,
                        ...userOverrides.grants
                    ]);
                    for (const deniedPermission of userOverrides.denies) {
                        effectivePermissions.delete(deniedPermission);
                    }

                    const allPermissions = Array.from(effectivePermissions);

                    actor = {
                        id: user.id,
                        roles: userRoles,
                        permissions: allPermissions,
                        name: userName,
                        email: userEmail,
                        emailVerified: userEmailVerified,
                        image: userImage,
                        mustChangePassword: userMustChangePassword
                    };
                }

                // Attach billing entitlements if available
                const userEntitlements = c.get('userEntitlements');
                if (userEntitlements) {
                    actor.entitlements = new Set<string>(
                        Array.from(userEntitlements || []).map((e) => String(e))
                    );
                }
            } catch (error) {
                apiLogger.error(
                    'Error building user actor:',
                    error instanceof Error ? error.message : String(error)
                );
                throw new HTTPException(503, {
                    message: 'Service temporarily unavailable'
                });
            }
        } else {
            // Unauthenticated request .. use GUEST actor
            actor = createGuestActor();
        }

        // Inject actor into context
        c.set('actor', actor);

        // Enrich the AsyncLocalStorage request context with the resolved actor
        // so logs emitted by packages that don't have access to Hono's Context
        // can still be attributed to the actor. Guest actors have no meaningful
        // identity, so we only set when a real user id is present.
        // HOS-296: "is this a guest" is now "does the actor hold ONLY the GUEST
        // hat". `createGuestActor()` produces exactly `[GUEST]`, and no real
        // account is ever granted it, so an actor carrying any other role is a
        // real identity worth attributing logs to.
        const isGuestOnly =
            actor.roles.length > 0 && actor.roles.every((r) => r === RoleEnum.GUEST);
        if (actor.id && actor.roles.length > 0 && !isGuestOnly) {
            // Better Auth's session object exposes `id` directly (see
            // `c.set('session', sessionData.session)` in middlewares/auth.ts),
            // not nested under a `.session` key. Guest/unauthenticated requests
            // never reach this branch, so `session` is only read once we
            // already know a real user is attached.
            const session = c.get('session');
            setRequestContextActor({
                userId: actor.id,
                roles: actor.roles,
                ...(session?.id === undefined ? {} : { sessionId: session.id })
            });
        }

        await next();
    };
};

/**
 * Get actor from context.
 *
 * Retrieves the actor that was injected by actorMiddleware.
 * Throws if actor is not available (should never happen if middleware is configured).
 *
 * @param c - Hono context
 * @returns Actor object
 * @throws HTTPException if actor is not in context
 */
export const getActorFromContext = (c: Parameters<MiddlewareHandler>[0]): Actor => {
    const actor = c.get('actor');

    if (!actor) {
        apiLogger.error('Actor not found in context - actorMiddleware may not be running');
        throw new HTTPException(500, {
            message: 'Internal server error: Actor not available'
        });
    }

    return actor;
};
