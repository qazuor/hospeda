/**
 * @file PlanPurchaseButton.already-subscribed.test.tsx
 * @description HOS-1321 item 2: `/start-paid` refuses a second live
 * subscription with a 409 carrying `reason: 'ALREADY_SUBSCRIBED'`, and this
 * button used to flatten every rejection into "No pudimos iniciar el pago.
 * Intenta de nuevo." — a sentence that reads as a transient payment failure, so
 * the only thing it suggests is clicking again, which is deterministically
 * refused again. HOS-1260 widened that guard to catch a live `tourist-vip`,
 * which is how the refusal became reachable for a traveller too.
 *
 * The fix routes the failure through `translateApiError`, the repo's own
 * reason → code → status chain, so the copy is a `common.apiError.<REASON>`
 * key. These tests assert the SPECIFIC copy is shown for both audiences this
 * component actually sells to (`owner` and `tourist` — gastronomy, experience
 * and partner pricing pages mount it with `ctaMode="link"` and never fire a
 * checkout from here), and that an unmapped rejection still degrades to the
 * exact generic sentence the line used to hardcode.
 *
 * Own file, like every sibling: `PlanPurchaseButton`'s subscription,
 * trial-eligibility and payer-email lookups are module-level singletons set
 * once per test FILE and never reset between `it()` blocks.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Stand-in for the real `common.apiError.ALREADY_SUBSCRIBED` entry.
 *
 * The component test drives the LOOKUP, not the catalogue: `t` is mocked, so
 * asserting the shipped Spanish sentence here would only assert this file's own
 * constant. That the three locales really carry the key is asserted separately,
 * against the catalogue, in
 * `packages/i18n/test/api-error-already-subscribed.test.ts`.
 */
const { ALREADY_SUBSCRIBED_COPY, RATE_LIMIT_COPY } = vi.hoisted(() => ({
    ALREADY_SUBSCRIBED_COPY: 'Ya tenés una suscripción activa. Entrá en Mi cuenta → Suscripción.',
    RATE_LIMIT_COPY: 'Demasiadas solicitudes. Esperá unos segundos.'
}));

/** The sentence the button hardcoded for every failure before this fix. */
const GENERIC_CHECKOUT_ERROR = 'No pudimos iniciar el pago. Intenta de nuevo.';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

// A catalogue with exactly one entry: the reason key. Everything else falls
// back, which is what the sibling test files' `t` already does. The single
// entry matters — `translateApiErrorWithT` detects an ABSENT key by the value
// coming back equal to the key (see `isMissingTranslation`), so a `t` that
// echoed every key would make the reason branch fall through and the test
// could not tell the fix from the bug.
vi.mock('../../../src/lib/i18n', () => {
    const CATALOG: Record<string, string> = {
        'common.apiError.ALREADY_SUBSCRIBED': ALREADY_SUBSCRIBED_COPY,
        'common.apiError.RATE_LIMIT_EXCEEDED': RATE_LIMIT_COPY
    };
    const t = (key: string, fallback?: string) => CATALOG[key] ?? fallback ?? key;
    return {
        createTranslations: (_locale: string) => ({
            t,
            tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
        }),
        // `lib/api-errors.ts` imports this for its `locale` convenience path.
        // The component always passes its own `t`, so it is never called here —
        // but the import must resolve or the whole module graph fails to mock.
        createT: (_locale: string) => t
    };
});

// The account's trial is burned, so the trial gate is a no-op and the click
// reaches the checkout this file is about. Mocked at the module boundary
// because `fetchTrialClock` caches its answer in a module singleton.
vi.mock('../../../src/lib/billing/trial-clock', () => ({
    fetchTrialClock: () =>
        Promise.resolve({
            isOnTrial: false,
            isExpired: true,
            daysRemaining: null,
            startedAt: '2026-01-01T00:00:00.000Z'
        }),
    resetTrialClockCache: () => undefined
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
        return `/${locale}${withSlash}`;
    },
    buildUrlWithParams: ({ locale, path = '' }: { locale: string; path?: string }) =>
        `/${locale}/${path}/`
}));

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseProps = {
    planSlug: 'owner-basico',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    ownPreapprovalEnabled: true
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

/**
 * Every lookup answers "no subscription in this domain" so the card renders a
 * live "Contratar" (not a plan change, not an already-held VIP) and the click
 * actually reaches `/start-paid`. Only the checkout itself fails.
 *
 * @param startPaidError - The `error` object `/start-paid` answers with.
 * @param status - The HTTP status it answers with (409 unless stated).
 */
function buildFetchMock(startPaidError: Record<string, unknown>, status = 409) {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/payer-email-known')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { hasKnownPayerEmail: true } })
            });
        }
        if (url.includes('/billing/subscriptions/start-paid')) {
            return Promise.resolve({
                ok: false,
                status,
                // An empty `error` object stands for a body the client could not
                // read a code out of — `parseError` then leaves `code`/`reason`
                // undefined and only the status survives.
                json: () =>
                    Promise.resolve(
                        Object.keys(startPaidError).length > 0 ? { error: startPaidError } : {}
                    )
            });
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription: null } })
        });
    });
}

/** The 409 body `/start-paid` really answers (see `routes/billing/start-paid.ts`). */
const ALREADY_SUBSCRIBED_ERROR = {
    code: 'ALREADY_EXISTS',
    message:
        'You already have an active subscription. To change your plan, use the plan-change endpoint.',
    reason: 'ALREADY_SUBSCRIBED'
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanPurchaseButton — a refused checkout says what to do (HOS-1321)', () => {
    // Both audiences this component sells to. `owner` is the host funnel; a
    // `tourist-vip` holder standing on it is exactly who HOS-1260 started
    // refusing. `tourist` is the traveller funnel, refused for a host or
    // commerce owner who already holds a live subscription.
    it.each([
        'owner',
        'tourist'
    ] as const)('renders the ALREADY_SUBSCRIBED copy, never the generic payment error (audience: %s)', async (audience) => {
        // Arrange
        mockAuthenticated();
        vi.stubGlobal('fetch', buildFetchMock(ALREADY_SUBSCRIBED_ERROR));
        const user = userEvent.setup();
        render(
            <PlanPurchaseButton
                {...baseProps}
                audience={audience}
            />
        );

        // Act
        await user.click(screen.getByTestId('plan-cta-button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByText(ALREADY_SUBSCRIBED_COPY)).toBeInTheDocument();
        });
        expect(screen.queryByText(GENERIC_CHECKOUT_ERROR)).not.toBeInTheDocument();
        // The refusal is terminal, not a redirect: nothing was followed.
        expect(window.location.href).toBe('');
    });

    it('still degrades to the generic sentence when the rejection carries no mapped reason', async () => {
        // Arrange — the fall-through the fix must preserve: an unmapped
        // failure has to read exactly as it did before, never as a raw
        // English API message and never as a dotted key.
        //
        // `message` is present ON PURPOSE. It is the only field that can
        // produce the English leak this branch exists to prevent
        // (`translateApiErrorWithT` ends at `apiMessage || fallback`), so a
        // fixture that omitted it asserted nothing about the risk — which is
        // what the first draft of this test did.
        mockAuthenticated();
        vi.stubGlobal(
            'fetch',
            buildFetchMock({
                code: 'SOME_UNMAPPED_CODE',
                reason: 'SOME_UNMAPPED_REASON',
                message: 'Some unmapped English text straight from the API'
            })
        );
        const user = userEvent.setup();
        render(
            <PlanPurchaseButton
                {...baseProps}
                audience="owner"
            />
        );

        // Act
        await user.click(screen.getByTestId('plan-cta-button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByText(GENERIC_CHECKOUT_ERROR)).toBeInTheDocument();
        });
        expect(
            screen.queryByText('Some unmapped English text straight from the API')
        ).not.toBeInTheDocument();
    });

    it('keeps the specific copy of a failure that only carries an HTTP status', async () => {
        // Arrange — a raw 429 arrives with no `code` and no `reason`; the only
        // handle on it is the status, and `common.apiError.RATE_LIMIT_EXCEEDED`
        // already ships in all three locales. The first draft of this fix gated
        // the whole chain on `reason || code`, which silently skipped that
        // branch and threw the copy away. Stripping `message` instead keeps it.
        mockAuthenticated();
        vi.stubGlobal('fetch', buildFetchMock({}, 429));
        const user = userEvent.setup();
        render(
            <PlanPurchaseButton
                {...baseProps}
                audience="owner"
            />
        );

        // Act
        await user.click(screen.getByTestId('plan-cta-button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByText(RATE_LIMIT_COPY)).toBeInTheDocument();
        });
        expect(screen.queryByText(GENERIC_CHECKOUT_ERROR)).not.toBeInTheDocument();
    });

    it('never surfaces the raw English message of a rejection that names nothing', async () => {
        // Arrange — a raw upstream failure, a body with no `error` envelope or
        // a network error all reach the client with a `message` and NO
        // machine-readable identifier. `translateApiError`'s last step is
        // `apiMessage || fallback`, so sending those through the chain would
        // put English on screen where a localized sentence used to be. They
        // must keep taking the generic one.
        const RAW_ENGLISH = 'API request failed with status 502';
        mockAuthenticated();
        vi.stubGlobal('fetch', buildFetchMock({ message: RAW_ENGLISH }));
        const user = userEvent.setup();
        render(
            <PlanPurchaseButton
                {...baseProps}
                audience="owner"
            />
        );

        // Act
        await user.click(screen.getByTestId('plan-cta-button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByText(GENERIC_CHECKOUT_ERROR)).toBeInTheDocument();
        });
        expect(screen.queryByText(RAW_ENGLISH)).not.toBeInTheDocument();
    });
});
