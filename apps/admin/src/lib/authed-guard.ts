/**
 * Pure decision logic for the `/_authed` route guard.
 *
 * Extracted from the TanStack Router `beforeLoad` callback so it can be unit
 * tested without mocking TanStack Router internals or the `redirect()` API.
 *
 * HOS-609: an authenticated user who lacks `ACCESS_PANEL_ADMIN` gets ONE
 * outcome regardless of which roles they hold — an external redirect to the
 * web app's access-denied page (`/{lang}/acceso-denegado/`), which explains
 * why they can't enter and offers a way back to their account. This
 * collapsed two previously distinct branches: the "tourist funnel" (a user
 * holding ONLY `USER` used to be sent to the public host-onboarding page)
 * and the admin's own internal forbidden page with
 * `reason=host-missing-permission` (a `HOST` without panel access). Neither
 * branch reads the role set any more — the decision no longer depends on
 * which hats the account holds, only on whether panel access is granted.
 *
 * Authenticated users with full access continue normally, with the existing
 * `passwordChangeRequired` short-circuit honored before allow.
 *
 * @module _authed.guard
 */

import { PermissionEnum } from '@repo/schemas';
import type { AuthState } from '@/lib/auth-session';

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
          readonly kind: 'redirect-web-forbidden';
          /**
           * Absolute URL of the web app's access-denied page
           * (`/{lang}/acceso-denegado/`). HOS-609: the single outcome for every
           * authenticated visitor who lacks `ACCESS_PANEL_ADMIN`, regardless of
           * role. No original path is carried — the page has no consumer for it.
           */
          readonly href: string;
      };

/**
 * Build the absolute web access-denied URL an authenticated admin visitor
 * without `ACCESS_PANEL_ADMIN` is sent to (HOS-609). Mirrors
 * {@link buildWebSigninHref}'s shape (absolute web URL built from `siteUrl` +
 * locale) but carries no query params — the page has nothing to read back.
 *
 * @param siteUrl - The public web app origin (hosts the access-denied page)
 * @param locale - The visitor's preferred locale
 * @returns Absolute `{siteUrl}/{locale}/acceso-denegado/`
 */
const buildWebForbiddenHref = (siteUrl: string, locale: string): string => {
    return new URL(`/${locale}/acceso-denegado/`, siteUrl).toString();
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
        // HOS-609: one outcome regardless of role — see this module's JSDoc.
        return {
            kind: 'redirect-web-forbidden',
            href: buildWebForbiddenHref(siteUrl, preferredLocale)
        };
    }

    if (authState.passwordChangeRequired) {
        return { kind: 'redirect-change-password' };
    }

    return { kind: 'allow', authState };
};
