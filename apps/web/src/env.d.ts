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
             * Every role the user holds (USER, HOST, COMMERCE_OWNER, ADMIN,
             * SUPER_ADMIN, CLIENT_MANAGER, EDITOR, SPONSOR).
             *
             * HOS-296 replaced the former single `role` scalar with this set:
             * one account can wear several hats at once and there is
             * deliberately no derived "primary role" — every gate must ask
             * "does the user hold role X", never "is the user's role X".
             * Populated by middleware from `GET /api/v1/public/auth/me`
             * (`data.actor.roles`); Better Auth's `get-session` no longer
             * carries any role at all.
             *
             * Empty only when the payload was unexpectedly malformed — treat
             * that defensively as the lowest-privilege case.
             *
             * Used by AccountLayout to gate "Mis propiedades" in the
             * sidebar to host-tier roles (SPEC-143 Finding #12 — parity
             * with the top-right UserMenu predicate).
             */
            readonly roles: readonly string[];
            /**
             * Avatar URL from the actor (`users.image`), or null when the user
             * has no avatar. Forwarded by middleware so SSR surfaces (header,
             * account dashboard) can render the avatar instead of falling back
             * to initials (BETA-32).
             */
            readonly image: string | null;
        } | null;

        /**
         * Cloudflare cache tags collected while rendering this response.
         *
         * Middleware creates the set before `next()` and serializes it into the
         * `Cache-Tag` response header afterwards, so any frontmatter that runs
         * during the render — page, layout or component — can contribute to it
         * without having to own the header itself (HOS-369 W1-1).
         *
         * Holds tags that are ALREADY namespaced by deployment environment
         * (`prod:list-accom`, not `list-accom` — HOS-369 W1-2). The prefix is
         * added by `declareCacheTags` on the way in, so middleware only has to
         * serialize, and so a tag that becomes unusable once prefixed is caught
         * while the response can still be demoted.
         *
         * Do NOT write to this directly from a page. Go through
         * `applyCacheHeaders` (`src/lib/cache/response-cache.ts`), which is the
         * only thing that may declare a response edge-cacheable, and which
         * cannot do so without being handed the tags that will purge it.
         */
        cacheTags: Set<string>;

        // NOTE (HOS-369 WB0-1): there is deliberately no `cspNonce` here
        // anymore. Inline scripts/styles are allowed by the sha256 of their own
        // content, computed per response in middleware — a nonce that reaches
        // the Cloudflare cache is a publicly readable token for the whole TTL
        // (spec §5.13 / D-9). Do not reintroduce it.
    }
}
