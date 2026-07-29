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

import { EntitlementKey } from '@repo/billing';
import type { JSX } from 'react';
import { useMyEntitlements } from '../../hooks/useMyEntitlements';
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
 * - Authenticated non-HOST: primary CTA links to `/publicar/nueva/`, secondary
 *   link to `/mi-cuenta/propiedades/` is also shown.
 * - HOST with the publishing entitlement: primary CTA links to
 *   `/mi-cuenta/propiedades/` (the redundant secondary link is dropped).
 * - HOST whose entitlement resolved negative: primary CTA links to
 *   `/mi-cuenta/suscripcion/` so they can activate a plan.
 *
 * Renders with the unauthenticated href during SSR/hydration to avoid layout
 * shift — the swap happens synchronously once the Better Auth session resolves.
 *
 * @example
 * ```astro
 * <HostLandingCta client:load locale={locale} />
 * ```
 */
export function HostLandingCta({ locale }: HostLandingCtaProps): JSX.Element {
    const { data: session, isPending } = useSession();

    const { t } = createTranslations(locale);

    const newPropertyPath = buildUrl({ locale, path: 'publicar/nueva' });
    const signinPath = `${buildUrl({ locale, path: 'auth/signin' })}?redirect=${encodeURIComponent(newPropertyPath)}`;
    const propertiesPath = buildUrl({ locale, path: 'mi-cuenta/propiedades' });
    const subscriptionPath = buildUrl({ locale, path: 'mi-cuenta/suscripcion' });

    const isAuthenticated = !isPending && Boolean(session?.user);

    // SPEC-182 (D3): role=HOST is enough to route the CTA to host surfaces.
    // The user may still be mid-onboarding with only a DRAFT, but they should
    // no longer be sent back through the tourist funnel. `role` is a Better
    // Auth additional field returned in the session but absent from the
    // client's inferred type.
    // TYPE-WORKAROUND: cast narrows the runtime shape; falls back to undefined.
    const role = (session?.user as { readonly role?: string } | undefined)?.role;

    // HOS-311: this CTA used to send a HOST straight to the admin panel, which
    // HOS-152 made unreachable for that role (`ACCESS_PANEL_ADMIN` was removed
    // from HOST after a security incident, so `apps/admin`'s authed-guard
    // bounces them to `/auth/forbidden?reason=host-missing-permission`). Hosts
    // self-manage in the web app, so the CTA now stays inside it — and, like
    // `MobileMenu.client.tsx`, it distinguishes a HOST that can actually
    // publish from one that still needs to activate a plan.
    //
    // `hostHasEntitlement` is fail-OPEN while loading (identical contract to
    // MobileMenu's, deliberately): a HOST keeps the "my properties" CTA until
    // the entitlement genuinely resolves negative, instead of flashing the
    // "activate your plan" state on every load.
    const { has: hasEntitlement, isLoading: entitlementsLoading } = useMyEntitlements({
        skip: role !== 'HOST'
    });
    const hostHasEntitlement =
        entitlementsLoading ||
        hasEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS) ||
        hasEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO);
    const isHost = isAuthenticated && role === 'HOST';
    const isHostMode = isHost && hostHasEntitlement;
    const needsPlan = isHost && !hostHasEntitlement;

    const primaryHref = isHostMode
        ? propertiesPath
        : needsPlan
          ? subscriptionPath
          : isAuthenticated
            ? newPropertyPath
            : signinPath;
    const primaryLabel = isHostMode
        ? t('host.landing.hostModeCta', 'Ir a mis propiedades')
        : needsPlan
          ? t('host.landing.activatePlanCta', 'Activá tu plan')
          : t('host.landing.primaryCta', 'Publicar tu propiedad');
    const secondaryLabel = t('host.landing.secondaryCta', 'Ver mis propiedades');
    // Never render the secondary link when the primary already points there.
    const showSecondary = isAuthenticated && primaryHref !== propertiesPath;

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
