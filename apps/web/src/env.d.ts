/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/**
 * Augment Astro's App namespace with custom types for locals.
 * This provides type safety for data stored in context.locals during requests.
 */
declare namespace App {
    /**
     * Data stored in context.locals, available in middleware and page components.
     */
    interface Locals {
        /**
         * The validated locale for the current request, extracted from the URL path.
         * Guaranteed to be a supported locale (es, en, or pt).
         */
        locale: import('./lib/i18n.js').SupportedLocale;

        /**
         * The authenticated user information, or null if not authenticated.
         * Parsed from the Better Auth session cookie.
         */
        user: {
            /**
             * The unique user ID.
             */
            id: string;

            /**
             * The user's display name.
             */
            name: string;

            /**
             * The user's email address.
             */
            email: string;
        } | null;
    }
}
