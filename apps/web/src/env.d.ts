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
        } | null;
    }
}
