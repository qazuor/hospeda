/**
 * @file HostLandingCta.client.tsx
 * @description Auth-aware CTA island for the host onboarding landing page.
 *
 * On mount, reads the Better Auth session via `useSession`. While loading,
 * renders the unauthenticated href as the default (safe fallback for SSG).
 * Once hydrated it swaps to the authenticated destination if a session exists.
 *
 * Hydration: client:load — the CTA is above the fold and must be interactive immediately.
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
    const { data: session, isPending } = useSession();

    const { t } = createTranslations(locale);

    const newPropertyPath = buildUrl({ locale, path: 'publicar/nueva' });
    const signinPath = `${buildUrl({ locale, path: 'auth/signin' })}?redirect=${encodeURIComponent(newPropertyPath)}`;
    const propertiesPath = buildUrl({ locale, path: 'mi-cuenta/propiedades' });

    const isAuthenticated = !isPending && Boolean(session?.user);

    // SPEC-182 (D3): role=HOST is enough to route the CTA to host surfaces.
    // The user may still be mid-onboarding with only a DRAFT, but they should
    // no longer be sent back through the tourist funnel. `role` is a Better
    // Auth additional field returned in the session but absent from the
    // client's inferred type.
    // TYPE-WORKAROUND: cast narrows the runtime shape; falls back to undefined.
    const role = (session?.user as { readonly role?: string } | undefined)?.role;
    const isHostMode = isAuthenticated && role === 'HOST' && Boolean(adminUrl);

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
