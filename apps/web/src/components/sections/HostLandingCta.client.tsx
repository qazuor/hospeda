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
import { useMyEntitlements } from '../../hooks/useMyEntitlements';
import { resolveSubscriptionPlansPath } from '../../lib/account-roles';
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
 * - Authenticated (tourist OR host with a plan): primary CTA links to
 *   `/publicar/nueva/`, plus a secondary link to `/mi-cuenta/propiedades/`.
 * - HOST whose entitlements resolved with NO owner subscription: primary CTA
 *   links to the owner plans page so they can activate a plan.
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
    // self-manage in the web app, so the CTA stays inside it.
    //
    // The "needs a plan" nag keys on the SUBSCRIPTION (`plan == null`), NOT on
    // entitlement keys. `loadEntitlements` hands ANY plan-less HOST the
    // `owner-basico` DRAFT defaults, and that plan grants both
    // PUBLISH_ACCOMMODATIONS and EDIT_ACCOMMODATION_INFO — so a host who
    // genuinely needs a plan never lacks those keys, and the only things that
    // could actually trigger the old condition were a fetch error, billing
    // being disabled, or data corruption. `plan == null` is the same signal
    // `mi-cuenta/propiedades/index.astro` already resolves server-side ("plan
    // is null when the owner has no real owner/complex-category subscription").
    //
    // Three guards, all of them fail-OPEN (never nag a paying host):
    //  - `hasResolved`: a fetch genuinely COMPLETED for this actor. `isLoading
    //    === false` is not enough — the hook's `skip` branch resolves it
    //    synchronously, so `skip: true -> false` (role settling to HOST)
    //    commits one render with stale `isLoading=false` + `plan=null`, which
    //    is exactly the flash a click could land on.
    //  - `entitlementsError === null`: a 429/500 on the entitlements endpoint
    //    must never be read as "no plan". `Header.astro` fails open on the same
    //    resolution on the same page load — the two must not contradict.
    //  - `isHost`: an authenticated actor whose role really is HOST.
    const {
        plan,
        error: entitlementsError,
        hasResolved: entitlementsResolved
    } = useMyEntitlements({
        skip: role !== 'HOST'
    });
    const isHost = isAuthenticated && role === 'HOST';
    const needsPlan = isHost && entitlementsResolved && entitlementsError === null && plan === null;

    // HOS-311: the host branch used to point at `mi-cuenta/propiedades`, but
    // `publicar/index.astro` SSR-redirects any authenticated actor with >=1
    // owned accommodation (drafts included) straight to that list — so the only
    // host who can still see this CTA has ZERO properties, and an empty list is
    // one pointless click away from the wizard they came for. Both the host and
    // the tourist therefore get the same destination here; the properties list
    // stays reachable through the secondary link.
    const primaryHref = needsPlan
        ? buildUrl({ locale, path: resolveSubscriptionPlansPath({ role: role ?? null }) })
        : isAuthenticated
          ? newPropertyPath
          : signinPath;
    const primaryLabel = needsPlan
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
