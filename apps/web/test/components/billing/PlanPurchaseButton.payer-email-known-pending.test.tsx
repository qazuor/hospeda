/**
 * @file PlanPurchaseButton.payer-email-known-pending.test.tsx
 * @description HOS-1234: clicking BEFORE the payer-email-known lookup has
 * resolved must still show the confirm dialog.
 *
 * This covers the initial state, which no other file in this family reaches:
 * they all wait for the lookup to settle first, so `useState(false)` could be
 * flipped to `useState(true)` and every one of them would stay green (measured).
 * The initial value IS the fail-open guarantee — a visitor who clicks the
 * instant the island hydrates decides nothing else.
 *
 * Kept in its own file — see the module-singleton caching note in
 * `PlanPurchaseButton.payer-email-known-true.test.tsx`.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
        return `/${locale}${withSlash}`;
    }
}));

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_EMAIL = 'juan@example.com';

const defaultProps = {
    planSlug: 'plan_starter',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    ownPreapprovalEnabled: true
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: SESSION_EMAIL } },
        isPending: false
    });
}

/**
 * Fetch mock whose payer-email-known response NEVER settles, freezing the
 * island in the state it hydrates with.
 */
function buildNeverResolvingFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/payer-email-known')) {
            return new Promise(() => {
                // deliberately never resolves
            });
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription: null } })
        });
    });
}

function getMainButton(): HTMLElement {
    return screen.getByTestId('plan-cta-button');
}

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

describe('PlanPurchaseButton — payer-email-known still pending (HOS-1234)', () => {
    it('shows the dialog when the lookup has not answered yet', async () => {
        mockAuthenticated();
        vi.stubGlobal('fetch', buildNeverResolvingFetchMock());
        const user = userEvent.setup();
        render(<PlanPurchaseButton {...defaultProps} />);

        // No waiting: click into the hydration state on purpose.
        await user.click(getMainButton());

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();
        // And nothing was sent to MercadoPago behind the dialog's back.
        expect(window.location.href).toBe('');
    });
});
