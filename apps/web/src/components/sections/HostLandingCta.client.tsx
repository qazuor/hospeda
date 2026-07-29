/**
 * @file HostLandingCta.client.tsx
 * @description Auth-aware CTA island for the host onboarding landing page.
 *
 * On mount, resolves the visitor through `useAccountPermissions` — the SAME
 * shared `/auth/me` cache (`@/lib/auth-cache`) that `UserMenu` and
 * `MobileMenu` already use. While loading, renders the unauthenticated href as
 * the default (safe fallback for SSG). Once resolved it swaps to the
 * authenticated destination if a session exists.
 *
 * HOS-296 — why NOT Better Auth's `useSession()` any more. This island used to
 * read `session.user` and hand-cast it to `{ readonly role?: string }` to reach
 * the host flag. `users.role` is gone, so `role` left Better Auth's
 * `additionalFields` entirely and that cast would have silently yielded
 * `undefined` forever: no compile error, no runtime error, just a permanently
 * dead "Ir al panel de anfitrión" CTA for every host (spec §7.2 /
 * sweep-inventory site #7). Routing through `auth-cache.ts` — already the
 * client-side `/auth/me` plumbing — keeps ONE session mechanism on the client
 * instead of two, and costs no extra request: `UserMenu` mounts on every page
 * and either the shared in-flight promise or the sessionStorage snapshot
 * already answers this island's read.
 *
 * Hydration: client:only="react" (see the mount site in
 * `pages/[lang]/publicar/index.astro`).
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
    /**
     * Admin panel base URL for the host-mode CTA (SPEC-182). When the visitor
     * is a HOST, the primary CTA points here instead of the create wizard.
     * Undefined (env not configured) falls back to the wizard for everyone.
     */
    readonly adminUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HostLandingCta — conditional CTA buttons for the /publicar landing page.
 *
 * - Unauthenticated: primary CTA links to `/auth/signin?redirect=/publicar/nueva/`
 * - Authenticated: primary CTA links to `/publicar/nueva/`, secondary link
 *   to `/mi-cuenta/propiedades/` is also shown.
 *
 * Renders with the unauthenticated href during SSR/hydration to avoid layout
 * shift — the swap happens synchronously once the Better Auth session resolves.
 *
 * @example
 * ```astro
 * <HostLandingCta client:load locale={locale} />
 * ```
 */
export function HostLandingCta({ locale, adminUrl }: HostLandingCtaProps): JSX.Element {
    // Simple mode (no `initialUser`): this island has no SSR snapshot to
    // reconcile against, so any fresh authenticated cache entry is trusted
    // directly and a cold load falls through to the shared `/auth/me` fetch.
    const { user, roles } = useAccountPermissions();

    const { t } = createTranslations(locale);

    const newPropertyPath = buildUrl({ locale, path: 'publicar/nueva' });
    const signinPath = `${buildUrl({ locale, path: 'auth/signin' })}?redirect=${encodeURIComponent(newPropertyPath)}`;
    const propertiesPath = buildUrl({ locale, path: 'mi-cuenta/propiedades' });

    // `user` is null while the snapshot is still resolving, so the
    // unauthenticated href stays the first-paint default — the documented
    // safe fallback, unchanged from the `isPending` behavior it replaces.
    const isAuthenticated = user !== null;

    // SPEC-182 (D3): holding the HOST hat is enough to route the CTA to host
    // surfaces. The user may still be mid-onboarding with only a DRAFT, but
    // they should no longer be sent back through the tourist funnel.
    // HOS-296: `roles.includes('HOST')`, not `role === 'HOST'` — a merchant
    // who is also a host keeps the host CTA.
    const isHostMode = isAuthenticated && roles.includes('HOST') && Boolean(adminUrl);

    const primaryHref = isHostMode
        ? (adminUrl as string)
        : isAuthenticated
          ? newPropertyPath
          : signinPath;
    const primaryLabel = isHostMode
        ? t('host.landing.hostModeCta', 'Ir al panel de anfitrión')
        : t('host.landing.primaryCta', 'Publicar tu propiedad');
    const secondaryLabel = t('host.landing.secondaryCta', 'Ver mis propiedades');

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
            {isAuthenticated && (
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
