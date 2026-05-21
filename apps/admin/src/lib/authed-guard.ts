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
          readonly search: { readonly redirect: string };
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
    const { authState, pathname, preferredLocale, siteUrl } = args;

    if (!authState.isAuthenticated) {
        return {
            kind: 'redirect-signin',
            search: { redirect: pathname }
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
