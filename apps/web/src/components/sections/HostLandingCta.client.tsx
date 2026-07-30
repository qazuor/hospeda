/**
 * @file HostLandingCta.client.tsx
 * @description Auth-aware CTA island for the host onboarding landing page.
 *
 * On mount, resolves the visitor through `useAccountPermissions` — the SAME
 * shared `/auth/me` cache (`@/lib/auth-cache`) that `UserMenu` and
 * `MobileMenu` already use. While the snapshot is still resolving, `user` is
 * `null` and the island renders the unauthenticated href as the default (safe
 * fallback), swapping to the authenticated destination once a session
 * resolves.
 *
 * HOS-296 — why NOT Better Auth's `useSession()` any more. This island used to
 * read `session.user` and hand-cast it to `{ readonly role?: string }`.
 * `users.role` is gone, so `role` left Better Auth's `additionalFields`
 * entirely and that cast would have silently yielded `undefined` forever: no
 * compile error, no runtime error. Routing through `auth-cache.ts` — already
 * the client-side `/auth/me` plumbing — keeps ONE session mechanism on the
 * client instead of two, and costs no extra request: `UserMenu` mounts on
 * every page and either the shared in-flight promise or the sessionStorage
 * snapshot already answers this island's read.
 *
 * HOS-311 — the CTA no longer branches on WHICH hats the visitor holds (see
 * the body), only on whether a session exists, so no role is read here at all.
 *
 * Hydration: client:only="react" — there is no server-rendered markup for this
 * island, so the visitor always starts unresolved on first client render (see
 * the mount site in `pages/[lang]/publicar/index.astro`).
 */

import type { JSX } from 'react';
import { useAccountPermissions } from '../../hooks/use-account-permissions';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { buildUrl } from '../../lib/urls';
import styles from './HostLandingCta.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the HostLandingCta component.
 */
export interface HostLandingCtaProps {
    /** Current locale for building internal URLs and translating labels. */
    readonly locale: SupportedLocale;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HostLandingCta — conditional CTA buttons for the /publicar landing page.
 *
 * - Unauthenticated: primary CTA links to `/auth/signin?redirect=/publicar/nueva/`
 * - Authenticated (tourist OR host): primary CTA links to `/publicar/nueva/`,
 *   plus a secondary link to `/mi-cuenta/propiedades/`.
 *
 * Renders the unauthenticated href while the visitor is still unresolved to
 * avoid layout shift — the swap happens once the `/auth/me` snapshot resolves.
 *
 * @example
 * ```astro
 * <HostLandingCta client:only="react" locale={locale} />
 * ```
 */
export function HostLandingCta({ locale }: HostLandingCtaProps): JSX.Element {
    // Simple mode (no `initialUser`): this island has no SSR snapshot to
    // reconcile against, so any fresh authenticated cache entry is trusted
    // directly and a cold load falls through to the shared `/auth/me` fetch.
    // Only `user` is consumed — the destination does not depend on the role
    // set (HOS-311).
    const { user } = useAccountPermissions();

    const { t } = createTranslations(locale);

    const newPropertyPath = buildUrl({ locale, path: 'publicar/nueva' });
    const signinPath = `${buildUrl({ locale, path: 'auth/signin' })}?redirect=${encodeURIComponent(newPropertyPath)}`;
    const propertiesPath = buildUrl({ locale, path: 'mi-cuenta/propiedades' });

    // `user` is null while the snapshot is still resolving, so the
    // unauthenticated href stays the first-paint default — the documented
    // safe fallback, unchanged from the `isPending` behavior it replaces.
    const isAuthenticated = user !== null;

    // HOS-311: this CTA used to send a HOST straight to the admin panel, which
    // HOS-152 made unreachable for that role (`ACCESS_PANEL_ADMIN` was removed
    // from HOST after a security incident, so `apps/admin`'s authed-guard
    // bounces them to `/auth/forbidden?reason=host-missing-permission`). Hosts
    // self-manage in the web app, so the CTA stays inside it.
    //
    // The host branch also used to point at `mi-cuenta/propiedades`, but
    // `publicar/index.astro` SSR-redirects any authenticated actor with >=1
    // owned accommodation (drafts included) straight to that list — so the only
    // host who can still see this CTA has ZERO properties, and an empty list is
    // one pointless click away from the wizard they came for. Both the host and
    // the tourist therefore get the same destination here; the properties list
    // stays reachable through the secondary link.
    //
    // HOS-296: because no branch here reads a role any more, the multi-hat
    // account model cannot regress this CTA — an actor who is both a host and
    // a commerce owner gets the same destination as any other signed-in actor.
    const primaryHref = isAuthenticated ? newPropertyPath : signinPath;
    const primaryLabel = t('host.landing.primaryCta', 'Publicar tu propiedad');
    const secondaryLabel = t('host.landing.secondaryCta', 'Ver mis propiedades');
    // The secondary link is the only route to the properties list from here —
    // the primary always points at the wizard (or signin), never at the list.
    const showSecondary = isAuthenticated;

    return (
        <div className={styles.ctaWrapper}>
            <a
                href={primaryHref}
                className={styles.primaryBtn}
                aria-label={primaryLabel}
            >
                {primaryLabel}
                <span
                    className={styles.btnArrow}
                    aria-hidden="true"
                >
                    &rarr;
                </span>
            </a>
            {showSecondary && (
                <a
                    href={propertiesPath}
                    className={styles.secondaryLink}
                >
                    {secondaryLabel}
                </a>
            )}
        </div>
    );
}
