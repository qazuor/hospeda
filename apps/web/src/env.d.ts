/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/**
 * Augment Astro's App namespace with custom types for request-scoped locals.
 * Provides full type safety for data populated by middleware and consumed in pages.
 */
declare namespace App {
    interface Locals {
        /**
         * The validated locale for the current request, extracted from the URL path.
         * Always a supported locale (es | en | pt) — guaranteed by middleware.
         */
        locale: 'es' | 'en' | 'pt';

        /**
         * The authenticated user, or null for unauthenticated requests.
         * Populated by the auth middleware for protected routes, auth routes,
         * and Server Island requests.
         */
        user: {
            /** Unique user identifier */
            readonly id: string;
            /** User's display name */
            readonly name: string;
            /** User's email address */
            readonly email: string;
            /**
             * User role from the Better Auth session (USER, HOST, ADMIN,
             * SUPER_ADMIN, CLIENT_MANAGER, EDITOR). Populated by middleware
             * from the `role` additional field configured in
             * `apps/api/src/lib/auth.ts`. `null` only when the role was
             * unexpectedly absent from the session payload — treat that
             * defensively as the lowest-privilege case (USER).
             *
             * Used by AccountLayout to gate "Mis propiedades" in the
             * sidebar to host-tier roles (SPEC-143 Finding #12 — parity
             * with the top-right UserMenu predicate).
             */
            readonly role: string | null;
            /**
             * Avatar URL from the Better Auth session (`users.image`), or null
             * when the user has no avatar. Forwarded by middleware so SSR
             * surfaces (header, account dashboard) can render the avatar
             * instead of falling back to initials (BETA-32).
             */
            readonly image: string | null;
        } | null;

        /**
         * Cryptographic nonce for Content Security Policy.
         * Generated per-request by middleware. Applied to inline scripts/styles in BaseLayout.
         */
        cspNonce: string;
    }
}
