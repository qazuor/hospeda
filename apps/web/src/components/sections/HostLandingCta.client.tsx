/**
 * @file HostLandingCta.client.tsx
 * @description Auth-aware CTA island for the host onboarding landing page.
 *
 * On mount, reads the Better Auth session via `useSession`. While the session
 * is still pending it renders the unauthenticated href as the default (safe
 * fallback), and swaps to the authenticated destination once a session
 * resolves.
 *
 * Hydration: client:only="react" — there is no server-rendered markup for this
 * island, so the session always starts pending on first client render.
 */

import type { JSX } from 'react';
import { useSession } from '../../lib/auth-client';
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
 * Renders the unauthenticated href while the session is pending to avoid layout
 * shift — the swap happens once the Better Auth session resolves.
 *
 * @example
 * ```astro
 * <HostLandingCta client:only="react" locale={locale} />
 * ```
 */
export function HostLandingCta({ locale }: HostLandingCtaProps): JSX.Element {
    const { data: session, isPending } = useSession();

    const { t } = createTranslations(locale);

    const newPropertyPath = buildUrl({ locale, path: 'publicar/nueva' });
    const signinPath = `${buildUrl({ locale, path: 'auth/signin' })}?redirect=${encodeURIComponent(newPropertyPath)}`;
    const propertiesPath = buildUrl({ locale, path: 'mi-cuenta/propiedades' });

    const isAuthenticated = !isPending && Boolean(session?.user);

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
