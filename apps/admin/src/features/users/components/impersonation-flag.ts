/**
 * Master switch for the impersonation affordance, isolated in its own module
 * (HOS-1198) so a test can override it via `vi.mock` without touching the
 * disabled-pending-HOS-354 behavior every other consumer relies on.
 *
 * `false` until HOS-354 restores a working `/api/auth/admin/*` path. See
 * {@link ../ImpersonateButton} for the full context on why the button is
 * disabled rather than deleted.
 */
export function isImpersonationEnabled(): boolean {
    return false;
}
