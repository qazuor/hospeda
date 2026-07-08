/**
 * @file TestDailyPlanButton.client.tsx
 * @description Testing-only React island button that subscribes the current
 * user to the hidden daily test billing plan (`owner-test-daily`,
 * `TEST_DAILY_PLAN` in `@repo/billing`).
 *
 * Reuses `billingApi.createCheckout` — the SAME client mechanism the real
 * plan pricing cards use (see `PlanPurchaseButton.client.tsx`) — so a click
 * here exercises the EXACT same `/start-paid` code path a real subscription
 * would, at `billingInterval: 'monthly'` (the daily test plan swaps in its
 * `'day'` price server-side for this one slug; see
 * `apps/api/src/services/subscription-checkout.service.ts`).
 *
 * This button carries NO client-side knowledge of
 * `HOSPEDA_SHOW_TEST_BILLING_PLAN` — the flag is checked exclusively
 * server-side in `resolvePlanBySlug`. When the flag is off, clicking this
 * button still POSTs to `/start-paid`, which rejects with `PLAN_NOT_FOUND`;
 * the resulting generic error message is EXPECTED behavior in that case, not
 * a bug.
 *
 * Hydration: client:load — this is a single-purpose internal test page, no
 * benefit to deferring hydration.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { billingApi } from '../../lib/api/endpoints-protected';
import { useSession } from '../../lib/auth-client';
import type { SupportedLocale } from '../../lib/i18n';
import { buildUrl } from '../../lib/urls';
import styles from './TestDailyPlanButton.module.css';

/**
 * Slug of the hidden daily test plan. Mirrors `TEST_DAILY_PLAN.slug` in
 * `@repo/billing` — kept as a literal here (rather than importing the
 * package) since `apps/web` does not otherwise depend on `@repo/billing`.
 */
const TEST_DAILY_PLAN_SLUG = 'owner-test-daily';

/**
 * Props for {@link TestDailyPlanButton}.
 */
export interface TestDailyPlanButtonProps {
    /** Current locale, used to build the sign-in link. */
    readonly locale: SupportedLocale;
}

/**
 * TestDailyPlanButton — internal-only CTA that subscribes the current user
 * to the hidden daily test plan via the real `/start-paid` checkout flow.
 *
 * - Unauthenticated: shows a "log in first" note with a sign-in link (no
 *   auto-redirect — this is an internal test page, not a conversion funnel).
 * - Authenticated: click starts checkout. If `HOSPEDA_SHOW_TEST_BILLING_PLAN`
 *   is on server-side, this redirects to the real MercadoPago checkout,
 *   exactly like a production subscription. If the flag is off, the server
 *   rejects with `PLAN_NOT_FOUND` and the error message below is shown —
 *   intended behavior, see file JSDoc.
 */
export function TestDailyPlanButton({ locale }: TestDailyPlanButtonProps): JSX.Element {
    const { data: session, isPending: sessionPending } = useSession();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isAuthenticated = !sessionPending && Boolean(session?.user);
    const signinPath = buildUrl({ locale, path: 'auth/signin' });

    async function handleClick(): Promise<void> {
        if (loading) return;
        setError(null);
        setLoading(true);
        try {
            const result = await billingApi.createCheckout({
                planSlug: TEST_DAILY_PLAN_SLUG,
                billingInterval: 'monthly'
            });

            if (!result.ok || !result.data.checkoutUrl) {
                setError(
                    'No se pudo iniciar el checkout. Si HOSPEDA_SHOW_TEST_BILLING_PLAN no está activo en el servidor, este error es el comportamiento esperado.'
                );
                return;
            }

            window.location.href = result.data.checkoutUrl;
        } catch {
            setError('Error de red al iniciar el checkout.');
        } finally {
            setLoading(false);
        }
    }

    if (sessionPending) {
        return <p className={styles.note}>Cargando sesión...</p>;
    }

    if (!isAuthenticated) {
        return (
            <p className={styles.note}>
                Iniciá sesión antes de usar esta página de test.{' '}
                <a
                    href={signinPath}
                    className={styles.signinLink}
                >
                    Ir a iniciar sesión
                </a>
            </p>
        );
    }

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                data-testid="test-daily-plan-button"
                disabled={loading}
                aria-busy={loading}
                onClick={() => void handleClick()}
                className={styles.button}
            >
                {loading ? 'Procesando...' : 'Suscribirse al plan de prueba diario'}
            </button>
            {error !== null && (
                <p
                    role="alert"
                    className={styles.errorMessage}
                >
                    {error}
                </p>
            )}
        </div>
    );
}
