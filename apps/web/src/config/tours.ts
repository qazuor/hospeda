/**
 * @file tours.ts
 * @description Web welcome tour configurations, one per audience (tourist,
 * host, gastronomy owner, experience owner, editor, sponsor).
 *
 * These are the web-specific equivalents of the admin's tour configs
 * (apps/admin/src/config/ia/tours.ts). They define different DOM selectors
 * because the web layout is different from the admin panel.
 */

export interface TourStepConfig {
    readonly id: string;
    readonly target: string;
    readonly title: string;
    readonly body: string;
    readonly side?: 'top' | 'right' | 'bottom' | 'left';
    readonly align?: 'start' | 'center' | 'end';
}

export interface TourConfig {
    readonly id: string;
    readonly version: number;
    readonly roles: ReadonlyArray<string>;
    readonly trigger: 'auto-first-visit';
    readonly steps: ReadonlyArray<TourStepConfig>;
}

/**
 * HOS-788: `WEB_TOURS`' declared order is now a real PRIORITY, not just a
 * multi-hat tie-break (see `getWelcomeToursForRoles` / `getNextPendingWelcomeTour`
 * below) — it decides which tour runs first when several are pending at once.
 *
 * `web.tourist.welcome` is deliberately first: it is the ONE tour every
 * account qualifies for (its `roles` is `['USER']`, and every role set on the
 * platform is built on top of `USER`), and it is the reason this file exists
 * at all — a freshly-registered account held no role any tour recognized, so
 * nobody ever saw a first-run tour (HOS-788). It teaches the generic account
 * shell (profile, favorites, alerts, reviews, inbox) that every specialized
 * tour below assumes already makes sense to the viewer, so it must run before
 * any of them, never after.
 *
 * The role-specific tours that follow are ordered by how they were rolled out
 * (host first, then the two commerce verticals split out of the old shared
 * `web.commerce.welcome` by HOS-788, then editor, then sponsor) — there is no
 * product reason to prefer one business hat's tour over another's, so ANY
 * stable order is fine here; this one is just the one that needed the least
 * churn to existing tests.
 */
export const WEB_TOURS: ReadonlyArray<TourConfig> = [
    {
        id: 'web.tourist.welcome',
        version: 1,
        // HOS-788: every role set includes USER (it is the base hat granted
        // at signup and never removed), so this is the one tour every account
        // is eligible for. It is the fix for the reported bug: a brand-new
        // signup used to match NO tour at all.
        roles: ['USER'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingTourist.title',
                body: 'account.welcomeTour.greetingTourist.body',
                side: 'bottom',
                align: 'center'
            },
            {
                id: 'favorites',
                target: '[data-tour="favorites"]',
                title: 'account.welcomeTour.favorites.title',
                body: 'account.welcomeTour.favorites.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'alerts',
                target: '[data-tour="alerts"]',
                title: 'account.welcomeTour.alerts.title',
                body: 'account.welcomeTour.alerts.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'reviews',
                target: '[data-tour="reviews"]',
                title: 'account.welcomeTour.reviews.title',
                body: 'account.welcomeTour.reviews.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'inbox',
                target: '[data-tour="inbox"]',
                title: 'account.welcomeTour.inbox.title',
                body: 'account.welcomeTour.inbox.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'profile',
                target: '[data-tour="profile"]',
                title: 'account.welcomeTour.profile.title',
                body: 'account.welcomeTour.profile.body',
                side: 'right',
                align: 'start'
            }
        ]
    },
    {
        id: 'web.host.welcome',
        version: 2,
        // HOS-788: EDITOR moved to its own `web.editor.welcome` — an editor is
        // not a host, and these steps talk exclusively about publishing a
        // property. `profile` was dropped (HOS-788): it now lives in
        // `web.tourist.welcome`, which every HOST also qualifies for and sees
        // first.
        roles: ['HOST', 'ADMIN', 'SUPER_ADMIN', 'CLIENT_MANAGER'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingHost.title',
                body: 'account.welcomeTour.greetingHost.body',
                side: 'bottom',
                align: 'center'
            },
            {
                id: 'properties',
                target: '[data-tour="properties"]',
                title: 'account.welcomeTour.properties.title',
                body: 'account.welcomeTour.properties.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'host-dashboard',
                target: '[data-tour="host-dashboard"]',
                title: 'account.welcomeTour.hostDashboard.title',
                body: 'account.welcomeTour.hostDashboard.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'messages',
                target: '[data-tour="messages"]',
                title: 'account.welcomeTour.messages.title',
                body: 'account.welcomeTour.messages.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'promotions',
                target: '[data-tour="promotions"]',
                title: 'account.welcomeTour.promotions.title',
                body: 'account.welcomeTour.promotions.body',
                side: 'right',
                align: 'start'
            }
        ]
    },
    {
        id: 'web.gastronomy.welcome',
        version: 1,
        // HOS-788: split out of the old shared `web.commerce.welcome`. Gated
        // on the vertical-specific `GASTRONOMY_OWNER` role only (HOS-1077),
        // NOT the retiring `COMMERCE_OWNER` — `createForOwner`
        // (`packages/service-core/src/services/commerce/base-commerce-listing.service.ts`)
        // grants BOTH roles in the same transaction as the listing, so every
        // real gastronomy owner already carries `GASTRONOMY_OWNER`. Including
        // the shared legacy role here too would have made a pure
        // EXPERIENCE_OWNER (who also gets `COMMERCE_OWNER`) match this tour
        // as well, showing gastronomy-only content to an experience owner.
        roles: ['GASTRONOMY_OWNER'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingGastronomy.title',
                body: 'account.welcomeTour.greetingGastronomy.body',
                side: 'bottom',
                align: 'center'
            },
            {
                id: 'commerce',
                target: '[data-tour="commerce"]',
                title: 'account.welcomeTour.commerce.title',
                body: 'account.welcomeTour.commerceGastronomy.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'commerce-listings',
                target: '[data-tour="commerce-listings"]',
                title: 'account.welcomeTour.commerceListings.title',
                body: 'account.welcomeTour.commerceListings.body',
                side: 'top',
                align: 'start'
            },
            {
                id: 'gastronomy-qr',
                target: '[data-tour="gastronomy-qr"]',
                title: 'account.welcomeTour.gastronomyQr.title',
                body: 'account.welcomeTour.gastronomyQr.body',
                side: 'top',
                align: 'start'
            },
            {
                id: 'commerce-views',
                target: '[data-tour="commerce-views"]',
                title: 'account.welcomeTour.commerceViews.title',
                body: 'account.welcomeTour.commerceViews.body',
                side: 'top',
                align: 'start'
            }
        ]
    },
    {
        id: 'web.experience.welcome',
        version: 1,
        // HOS-788: split out of the old shared `web.commerce.welcome`, same
        // reasoning as `web.gastronomy.welcome` above — gated on
        // `EXPERIENCE_OWNER` only, never the retiring `COMMERCE_OWNER`.
        //
        // No experience-exclusive step: `ExperienceCertificatePanel`
        // (`CommerceListingActions.client.tsx`) is real and experience-only,
        // but it only mounts once a listing reaches the `published` state —
        // never guaranteed on a brand-new EXPERIENCE_OWNER's first visit,
        // which is exactly when this tour runs. Anchoring a step to it would
        // sometimes point at nothing, so this tour stays on the same
        // guaranteed-present commerce elements the gastronomy tour also uses,
        // minus the gastronomy-only QR step.
        roles: ['EXPERIENCE_OWNER'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingExperience.title',
                body: 'account.welcomeTour.greetingExperience.body',
                side: 'bottom',
                align: 'center'
            },
            {
                id: 'commerce',
                target: '[data-tour="commerce"]',
                title: 'account.welcomeTour.commerce.title',
                body: 'account.welcomeTour.commerceExperience.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'commerce-listings',
                target: '[data-tour="commerce-listings"]',
                title: 'account.welcomeTour.commerceListings.title',
                body: 'account.welcomeTour.commerceListings.body',
                side: 'top',
                align: 'start'
            },
            {
                id: 'commerce-views',
                target: '[data-tour="commerce-views"]',
                title: 'account.welcomeTour.commerceViews.title',
                body: 'account.welcomeTour.commerceViews.body',
                side: 'top',
                align: 'start'
            }
        ]
    },
    {
        id: 'web.editor.welcome',
        version: 1,
        // HOS-788: split out of `web.host.welcome` — an editor publishes
        // posts/events, not accommodations, so the host tour's steps never
        // applied to them. `myPosts`/`myEvents` are independently gated
        // (`POST_CREATE`/`EVENT_CREATE`, see `src/config/navigation.ts`), so a
        // seeded `editor@local.test` account (which holds both) sees both
        // steps; a hypothetical editor with only one would still see the tour
        // start, and driver.js simply cannot highlight the missing step's
        // element — same structural risk every other tour here already
        // accepts for a mid-flight permission change.
        roles: ['EDITOR'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingEditor.title',
                body: 'account.welcomeTour.greetingEditor.body',
                side: 'bottom',
                align: 'center'
            },
            {
                id: 'my-posts',
                target: '[data-tour="my-posts"]',
                title: 'account.welcomeTour.myPosts.title',
                body: 'account.welcomeTour.myPosts.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'my-events',
                target: '[data-tour="my-events"]',
                title: 'account.welcomeTour.myEvents.title',
                body: 'account.welcomeTour.myEvents.body',
                side: 'right',
                align: 'start'
            }
        ]
    },
    {
        id: 'web.sponsor.welcome',
        version: 1,
        // HOS-788: SPONSOR is the one role with NO self-service surface in
        // the web app at all — post-sponsorship management
        // (`POST_SPONSORSHIP_*` permissions) is admin-only today, and the
        // "Sumate como aliado" sponsor discovery-door option
        // (`src/config/discovery-doors.ts`) is explicitly a lead-only flow
        // with no `manageHref` and no `acquiredPermission`, so it never
        // reflects an already-approved sponsor either. There is honestly
        // nothing role-specific to point a step at, so this tour is a single
        // greeting acknowledging the sponsor hat and pointing them at the
        // team for anything sponsorship-related — a short, honest tour
        // instead of one that highlights an element that does not exist.
        roles: ['SPONSOR'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingSponsor.title',
                body: 'account.welcomeTour.greetingSponsor.body',
                side: 'bottom',
                align: 'center'
            }
        ]
    }
];

/**
 * Resolves every auto-first-visit welcome tour whose audience intersects a
 * user's role set, in `WEB_TOURS`' declared (priority) order.
 *
 * HOS-788: renamed and pluralized from the old `getWelcomeTourForRoles`,
 * which returned only the FIRST match and so could only ever hand a
 * multi-hat user ONE tour, ever — a tourist who later became a host never
 * saw the host tour, because the tourist tour (once it existed) had already
 * "claimed" them. Callers that need to know what to show RIGHT NOW should
 * use `getNextPendingWelcomeTour` instead, which additionally filters out
 * whatever the user has already seen.
 *
 * @param params - `{ roles }` (RO-RO): every role the user holds. Empty or
 *   `null` (guest / unresolved) yields no tours.
 * @returns Every matching tour config, in priority order. Empty when none
 *   apply.
 */
export function getWelcomeToursForRoles({
    roles
}: {
    readonly roles: readonly string[] | null;
}): TourConfig[] {
    if (!roles || roles.length === 0) return [];
    return WEB_TOURS.filter(
        (tour) =>
            tour.trigger === 'auto-first-visit' &&
            tour.roles.some((tourRole) => roles.includes(tourRole))
    );
}

/**
 * Resolves the ONE welcome tour that should run right now for a user: the
 * highest-priority tour (per `WEB_TOURS`' declared order) among the ones
 * their role set matches that they have NOT already seen.
 *
 * HOS-788 design decision — chained, one at a time, not all-at-once: this
 * function deliberately returns a single tour rather than the whole pending
 * list. Every consumer (`TourController`, `DashboardController`) recomputes
 * it on every render, and `hasSeen`'s identity changes the moment
 * `useTourState().markSeen` records a tour as seen — so the moment ONE tour
 * completes (or is skipped) and `WEB_TOURS` still holds a later match that is
 * still unseen, this function starts returning THAT tour on the very next
 * render, and `TourController` launches it automatically. A user with several
 * pending tours (e.g. the seeded `host-commerce@local.test` dual-role
 * fixture, or anybody who held multiple roles before this feature shipped)
 * therefore sees them run back-to-back, each ending with its own "Finalizar"
 * click, rather than ten steps flattened into one mega-tour — and rather
 * than needing a page reload between them, since nothing here depends on a
 * fresh mount. Skipping one tour only marks THAT one seen; it does not
 * suppress the rest, which is deliberate: "I don't need to see this one in
 * detail" is not the same statement as "never show me anything again".
 *
 * @param params - `{ roles, hasSeen }` (RO-RO): every role the user holds,
 *   and the `hasSeen` predicate from `useTourState()`.
 * @returns The next tour to run, or `undefined` when every matching tour has
 *   already been seen (or none match at all).
 */
export function getNextPendingWelcomeTour({
    roles,
    hasSeen
}: {
    readonly roles: readonly string[] | null;
    readonly hasSeen: (input: { tourId: string; version: number }) => boolean;
}): TourConfig | undefined {
    return getWelcomeToursForRoles({ roles }).find(
        (tour) => !hasSeen({ tourId: tour.id, version: tour.version })
    );
}
