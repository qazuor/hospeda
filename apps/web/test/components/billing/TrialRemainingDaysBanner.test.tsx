/**
 * @file TrialRemainingDaysBanner.test.tsx
 * @description HOS-1233 T-025 / AC-7, AC-8, AC-9 — the banner is present when a
 * trial is running and absent in every other state.
 *
 * §9 is explicit that the absent-side assertions need a sibling asserting the
 * SAME selector is present when a trial runs, or a selector typo passes as a
 * pass. Every `queryByTestId(BANNER)` below is therefore paired with the first
 * test's `getByTestId(BANNER)`, and both read the one exported constant.
 *
 * `fetchTrialClock` is driven through the real module, reset per test, so the
 * `?productDomain=` the banner asks for is part of what is asserted rather than
 * mocked away — announcing a host's trial on the traveller page is the exact
 * mistake `resolveTrialScopeForAudience` exists to prevent.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialRemainingDaysBanner } from '../../../src/components/billing/TrialRemainingDaysBanner.client';
import { resetTrialClockCache } from '../../../src/lib/billing/trial-clock';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string) => (key === 'pricing.trialBanner.hint' ? HINT : key),
        tPlural: (key: string, count: number) =>
            key === 'pricing.trialBanner.message'
                ? `Tu prueba gratis sigue activa: te quedan ${count} días.`
                : `${key}:${count}`
    })
}));

vi.mock('../../../src/components/billing/TrialRemainingDaysBanner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The one selector the present and absent assertions share. */
const BANNER = 'trial-remaining-days-banner';
const HINT = 'Si contratás un plan ahora, el cobro es inmediato y perdés los días que te quedan.';

function mockAuthenticated(): void {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

function mockUnauthenticated(): void {
    (useSession as MockUseSession).mockReturnValue({ data: null, isPending: false });
}

/** Answers `GET /billing/trial/status` with an explicit clock. */
function buildFetchMock(
    body: {
        readonly isOnTrial: boolean;
        readonly isExpired: boolean;
        readonly daysRemaining: number | null;
        readonly startedAt: string | null;
    } | null
) {
    return vi.fn().mockImplementation(() =>
        body === null
            ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
            : Promise.resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve({ data: body })
              })
    );
}

const RUNNING = {
    isOnTrial: true,
    isExpired: false,
    daysRemaining: 7,
    startedAt: '2026-09-01T00:00:00.000Z'
} as const;

beforeEach(() => {
    vi.clearAllMocks();
    resetTrialClockCache();
    mockAuthenticated();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrialRemainingDaysBanner — HOS-1233 AC-7: present while a trial runs', () => {
    it('states the trial is running and how many days remain', async () => {
        vi.stubGlobal('fetch', buildFetchMock(RUNNING));

        render(
            <TrialRemainingDaysBanner
                locale="es"
                audience="owner"
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId(BANNER)).toBeInTheDocument();
        });
        expect(screen.getByTestId(BANNER)).toHaveTextContent('7');
        expect(screen.getByText(HINT)).toBeInTheDocument();
    });

    it('reads THIS page vertical, not the domain-blind default', async () => {
        const fetchMock = buildFetchMock(RUNNING);
        vi.stubGlobal('fetch', fetchMock);

        render(
            <TrialRemainingDaysBanner
                locale="es"
                audience="gastronomy"
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId(BANNER)).toBeInTheDocument();
        });
        const urls = fetchMock.mock.calls.map((call) => String(call[0]));
        expect(urls.some((url) => url.includes('productDomain=gastronomy'))).toBe(true);
    });
});

describe('TrialRemainingDaysBanner — HOS-1233 AC-8: absent in every state with nothing to report', () => {
    it('renders nothing when no trial is running', async () => {
        vi.stubGlobal(
            'fetch',
            buildFetchMock({
                isOnTrial: false,
                isExpired: true,
                daysRemaining: null,
                startedAt: '2026-01-01T00:00:00.000Z'
            })
        );

        const { container } = render(
            <TrialRemainingDaysBanner
                locale="es"
                audience="owner"
            />
        );

        await waitFor(() => {
            expect(container.querySelector('aside')).toBeNull();
        });
        expect(screen.queryByTestId(BANNER)).toBeNull();
    });

    it('never renders "0 días" — a running trial reporting no days renders nothing', async () => {
        vi.stubGlobal(
            'fetch',
            buildFetchMock({
                isOnTrial: true,
                isExpired: false,
                daysRemaining: 0,
                startedAt: '2026-09-01T00:00:00.000Z'
            })
        );

        render(
            <TrialRemainingDaysBanner
                locale="es"
                audience="owner"
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId(BANNER)).toBeNull();
        });
        expect(screen.queryByText(/0/)).toBeNull();
    });

    it('renders no trial promise when the read fails (AC-9)', async () => {
        vi.stubGlobal('fetch', buildFetchMock(null));

        render(
            <TrialRemainingDaysBanner
                locale="es"
                audience="owner"
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId(BANNER)).toBeNull();
        });
    });

    it('renders nothing and reads nothing for an anonymous visitor', async () => {
        mockUnauthenticated();
        const fetchMock = buildFetchMock(RUNNING);
        vi.stubGlobal('fetch', fetchMock);

        render(
            <TrialRemainingDaysBanner
                locale="es"
                audience="owner"
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId(BANNER)).toBeNull();
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reads nothing at all for aliados — ?productDomain=partner is a 400', async () => {
        const fetchMock = buildFetchMock(RUNNING);
        vi.stubGlobal('fetch', fetchMock);

        render(
            <TrialRemainingDaysBanner
                locale="es"
                audience="partner"
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId(BANNER)).toBeNull();
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
