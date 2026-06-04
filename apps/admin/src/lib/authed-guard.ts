/**
 * Pure decision logic for the `/_authed` route guard.
 *
 * Extracted from the TanStack Router `beforeLoad` callback so it can be unit
 * tested without mocking TanStack Router internals or the `redirect()` API.
 *
 * The guard differentiates between four classes of incoming users when the
 * admin permission `ACCESS_PANEL_ADMIN` is missing:
 *
 *   - `USER` (tourist) → external redirect to the public host-onboarding
 *     funnel (`/{lang}/publicar/?from=admin`). 90% of the cases — we send
 *     them straight to a friendly conversion surface instead of a cold wall.
 *   - `HOST` (host without panel access) → internal redirect to forbidden
 *     with `reason=host-missing-permission`. Rare config bug.
 *   - Anything else (guest, staff with wrong account, exotic roles) →
 *     internal redirect to forbidden with `reason=generic`.
 *
 * Authenticated users with full access continue normally, with the existing
 * `passwordChangeRequired` short-circuit honored before allow.
 *
 * @module _authed.guard
 */

import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';

/**
 * Reason variants the forbidden page knows how to render.
 */
export type ForbiddenReason = 'host-missing-permission' | 'generic';

/**
 * Arguments for {@link decideAuthedGuard}. RO-RO.
 */
export interface DecideAuthedGuardArgs {
    readonly authState: AuthState;
    readonly pathname: string;
    readonly preferredLocale: string;
    readonly siteUrl: string;
    /**
     * The admin app's own origin (e.g. `https://admin.hospeda.com.ar`). Used to
     * build the ABSOLUTE `callbackUrl` for the web signin redirect (SPEC-182):
     * the web signin only accepts absolute, allowlisted URLs, so the admin must
     * advertise its own origin + the requested path as the return target.
     */
    readonly adminUrl: string;
}

/**
 * Outcome of the guard decision. The route's `beforeLoad` translates this
 * descriptor into the appropriate `redirect()` call (or simply returns the
 * auth state for the `allow` case).
 */
export type GuardDecision =
    | { readonly kind: 'allow'; readonly authState: AuthState }
    | {
          readonly kind: 'redirect-signin';
          /**
           * Absolute URL of the web signin page with the admin destination
           * carried in an allowlisted `callbackUrl` param (SPEC-182). The admin
           * no longer hosts its own signin page; unauthenticated users are sent
           * to the unified web auth surface.
           */
          readonly href: string;
      }
    | {
          readonly kind: 'redirect-change-password';
      }
    | {
          readonly kind: 'redirect-tourist-funnel';
          readonly href: string;
      }
    | {
          readonly kind: 'redirect-forbidden';
          readonly search: {
              readonly reason: ForbiddenReason;
              readonly redirect: string;
          };
      };

const HOST_ROLE = 'HOST';
const USER_ROLE = 'USER';

const buildTouristFunnelHref = (siteUrl: string, locale: string): string => {
    const target = new URL(`/${locale}/publicar/`, siteUrl);
    target.searchParams.set('from', 'admin');
    return target.toString();
};

/**
 * Build the absolute web signin URL an unauthenticated admin visitor is sent to
 * (SPEC-182). The path the user was trying to reach is preserved as an ABSOLUTE
 * admin URL in the `callbackUrl` param so the web signin — after a successful
 * login — can validate it against its allowlist and redirect back into admin.
 *
 * @param siteUrl - The public web app origin (hosts the unified signin page)
 * @param adminUrl - The admin app's own origin
 * @param locale - The visitor's preferred locale
 * @param pathname - The admin path the visitor originally requested
 * @returns Absolute `{siteUrl}/{locale}/auth/signin/?callbackUrl={absolute admin URL}`
 */
const buildWebSigninHref = (
    siteUrl: string,
    adminUrl: string,
    locale: string,
    pathname: string
): string => {
    const callbackUrl = new URL(pathname, adminUrl).toString();
    const target = new URL(`/${locale}/auth/signin/`, siteUrl);
    target.searchParams.set('callbackUrl', callbackUrl);
    return target.toString();
};

/**
 * Decide what the `/_authed` guard should do based on the resolved auth state
 * and request context.
 *
 * Pure function — no side effects, no `redirect()` calls. The caller is
 * responsible for translating the returned descriptor into a TanStack Router
 * redirect (or for letting the request proceed when the decision is `allow`).
 *
 * @param args - Arguments object.
 * @returns Guard decision descriptor.
 */
export const decideAuthedGuard = (args: DecideAuthedGuardArgs): GuardDecision => {
    const { authState, pathname, preferredLocale, siteUrl, adminUrl } = args;

    if (!authState.isAuthenticated) {
        return {
            kind: 'redirect-signin',
            href: buildWebSigninHref(siteUrl, adminUrl, preferredLocale, pathname)
        };
    }

    const hasPanelAccess = authState.permissions.includes(PermissionEnum.ACCESS_PANEL_ADMIN);

    if (!hasPanelAccess) {
        if (authState.role === USER_ROLE) {
            return {
                kind: 'redirect-tourist-funnel',
                href: buildTouristFunnelHref(siteUrl, preferredLocale)
            };
        }

        const reason: ForbiddenReason =
            authState.role === HOST_ROLE ? 'host-missing-permission' : 'generic';

        return {
            kind: 'redirect-forbidden',
            search: { reason, redirect: pathname }
        };
    }

    if (authState.passwordChangeRequired) {
        return { kind: 'redirect-change-password' };
    }

    return { kind: 'allow', authState };
};
