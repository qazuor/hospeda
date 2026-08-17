import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { EntitlementKey, LimitKey } from '@repo/billing';
import type { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler, Schema } from 'hono';
import type { ApiLogger } from './utils/logger';

/**
 * Better Auth session data set on context by auth middleware.
 * Represents the active session for the current request.
 */
export interface AuthSession {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    impersonatedBy?: string | null;
    twoFactorVerified?: boolean | null;
}

/**
 * Better Auth user data set on context by auth middleware.
 * Includes base fields and admin plugin fields (role, banned, etc.).
 */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    /**
     * HOS-296 — there is deliberately NO `role` here.
     *
     * The Better Auth admin plugin still declares a `role` field on its user
     * model, but `users.role` was dropped, so the value is always `undefined`
     * on the session user. Keeping it in this mirror would be the exact
     * silent-`undefined` failure the spec calls the worst kind: it compiles,
     * it never throws, and every read is quietly empty. The role set is
     * resolved from `user_role` in `actorMiddleware` and lives on
     * `Actor.roles`.
     */
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | null;
    /**
     * Mirrors `users.must_change_password`, exposed by Better Auth as an
     * `additionalField` (see `lib/auth.ts`). `true` for commerce-owner accounts
     * provisioned with a server-generated password (SPEC-239 T-041).
     *
     * Declared here — rather than being cast at each read site — because
     * `actorMiddleware` now forwards it onto `Actor.mustChangePassword` so
     * `/auth/me` carries it (HOS-296). Nullable/optional because the column is
     * nullable and the mock-auth path fabricates a user without it.
     */
    mustChangePassword?: boolean | null;
}

export interface AppBindings {
    Variables: {
        logger: ApiLogger;
        actor: Actor;
        /** Better Auth session for the current request */
        session?: AuthSession;
        /** Better Auth user for the current request */
        user?: AuthUser;
        /**
         * @internal TEST-ONLY (HOS-296).
         *
         * Roles fabricated by the mock-auth middleware when
         * `HOSPEDA_DISABLE_AUTH=true` in a test run. That middleware invents a
         * user that exists in NO database, so `actorMiddleware` cannot resolve
         * its hats from `user_role` — the query would either fail (no DB in a
         * unit test) or, worse, return the hats of some unrelated real row.
         * When present, `actorMiddleware` uses this instead of querying.
         *
         * NEVER set outside the mock-auth path: the guard that makes it safe
         * is that only that path writes it, and it only exists when
         * `NODE_ENV=test` + `HOSPEDA_DISABLE_AUTH=true` + `CI!=='true'`.
         */
        mockUserRoles?: readonly RoleEnum[];
        qzpay?: QZPayBilling;
        billingEnabled?: boolean;
        billingCustomerId?: string | null;
        userEntitlements: Set<EntitlementKey>;
        ownerEntitlements: Set<EntitlementKey>;
        userLimits: Map<LimitKey, number>;
        /**
         * True when the billing service failed to load entitlements.
         * Used by requireLimit and requireEntitlement to return 503
         * instead of silently granting unlimited access.
         */
        billingLoadFailed?: boolean;
        webhookEventId?: string;
        /**
         * HOS-216: sanitized replacement for `body.description` on
         * `PATCH /accommodations/:id`, stashed by `gateRichDescription` /
         * `gateVideoEmbed` (see `middlewares/accommodation-entitlements.ts`)
         * when the actor lacks the entitlement for content detected in the
         * submitted description. The route handler applies this instead of
         * the raw body value so only the gated syntax is dropped — the rest
         * of the PATCH (name, price, capacity, contact...) still persists.
         * `undefined` means neither gate touched the description.
         */
        accommodationDescriptionOverride?: string;
        /**
         * Sanitized replacement for `body.videos` on `PATCH /accommodations/:id`,
         * stashed by `gateVideoEmbed` when the actor lacks `CAN_EMBED_VIDEO`.
         *
         * Separate from {@link accommodationDescriptionOverride} because the two
         * carry different surfaces of the same gate: a description with a pasted
         * YouTube link, and the dedicated `videos` column the editor writes. The
         * gate used to inspect only the first, so an actor with no video
         * entitlement could still fill the column — and the read filter that was
         * supposed to hide it was matching a shape that no longer exists.
         *
         * Always the empty array when set (neutralize, not reject — HOS-216).
         * `undefined` means the gate did not touch the videos.
         */
        accommodationVideosOverride?: readonly unknown[];
    };
}

// biome-ignore lint/complexity/noBannedTypes: empty object {} is required as the default generic parameter for OpenAPIHono Schema
export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;

export type AppMiddleware = MiddlewareHandler<AppBindings>;
