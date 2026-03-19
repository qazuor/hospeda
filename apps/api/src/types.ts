import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { EntitlementKey, LimitKey } from '@repo/billing';
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
    /** Role from Better Auth admin plugin */
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | null;
}

export interface AppBindings {
    Variables: {
        logger: ApiLogger;
        actor: Actor;
        /** Better Auth session for the current request */
        session?: AuthSession;
        /** Better Auth user for the current request */
        user?: AuthUser;
        qzpay?: QZPayBilling;
        billingEnabled?: boolean;
        billingCustomerId?: string | null;
        userEntitlements: Set<EntitlementKey>;
        userLimits: Map<LimitKey, number>;
        /**
         * True when the billing service failed to load entitlements.
         * Used by requireLimit and requireEntitlement to return 503
         * instead of silently granting unlimited access.
         */
        billingLoadFailed?: boolean;
        webhookEventId?: string;
    };
}

// biome-ignore lint/complexity/noBannedTypes: empty object {} is required as the default generic parameter for OpenAPIHono Schema
export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;

export type AppMiddleware = MiddlewareHandler<AppBindings>;
