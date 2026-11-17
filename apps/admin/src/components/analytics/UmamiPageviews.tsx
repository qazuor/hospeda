/**
 * @file UmamiPageviews.tsx
 * @description Sends one Umami pageview per resolved router location (HOS-2119).
 *
 * The tracker renders with `data-auto-pageview="false"` (see
 * `lib/analytics/umami-client.ts`), so the router counts the pages: the initial
 * load and every navigation, once TanStack Router's `resolvedLocation` settles
 * (a `beforeLoad` redirect is never counted as a page of its own). The first
 * pageview of a document under the authenticated layout (`/_authed`) waits for
 * the staff identity, which `AuthProvider` settles; routes outside it never
 * wait.
 *
 * Mount it after `DocumentTitle`, so its effect runs after the title was
 * updated for the new route.
 */

import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { trackPageview } from '@/lib/analytics/umami-client';

/** Route id of the layout whose `AuthProvider` settles the staff identity. */
const AUTHED_LAYOUT_ROUTE_ID = '/_authed';

/** Same-origin URLs become a path, like the tracker does for its referrers. */
function stripOrigin(url: string): string {
    const { origin } = window.location;
    return url === origin || url.startsWith(`${origin}/`) ? url.slice(origin.length) : url;
}

/**
 * Router-driven Umami pageviews. Renders nothing.
 *
 * @returns `null`.
 */
export function UmamiPageviews(): null {
    const resolvedHref = useRouterState({ select: (state) => state.resolvedLocation?.href });
    const underAuthedLayout = useRouterState({
        select: (state) => state.matches.some((match) => match.routeId === AUTHED_LAYOUT_ROUTE_ID)
    });
    const lastCountedUrl = useRef<string | null>(null);

    useEffect(() => {
        if (resolvedHref === undefined) return;
        const url = window.location.href;
        if (url === lastCountedUrl.current) return;
        const previous = lastCountedUrl.current;
        lastCountedUrl.current = url;
        trackPageview({
            url,
            title: document.title,
            // The first page keeps the tracker's own `document.referrer`.
            ...(previous === null ? {} : { referrer: stripOrigin(previous) }),
            awaitIdentity: underAuthedLayout
        });
    }, [resolvedHref, underAuthedLayout]);

    return null;
}
