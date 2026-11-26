import { render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { PartnerClaim } from '../../../src/components/partner/PartnerClaim.client';

const mocks = vi.hoisted(() => ({
    authenticated: false,
    user: { id: 'signed-in-user', name: 'Test', email: 'test@example.test' },
    permissions: [] as string[],
    claim: vi.fn(),
    checkClaim: vi.fn(),
    refresh: vi.fn(),
    lookup: vi.fn(),
    signUp: vi.fn(),
    signInEmail: vi.fn(),
    signOut: vi.fn(),
    resend: vi.fn()
}));

/** Test doubles for the claim island's session, auth and API calls. */
export { mocks };

vi.mock('../../../src/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({
        user: mocks.authenticated ? mocks.user : null,
        permissions: mocks.permissions
    })
}));

vi.mock('../../../src/lib/api/endpoints-protected', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/lib/api/endpoints-protected')>();
    return {
        ...actual,
        partnersApi: { ...actual.partnersApi, claim: mocks.claim, checkClaim: mocks.checkClaim }
    };
});

vi.mock('../../../src/lib/auth-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/auth-client')>();
    return {
        ...actual,
        refreshBetterAuthSession: mocks.refresh,
        signIn: { ...actual.signIn, email: mocks.signInEmail },
        signOut: mocks.signOut,
        resendVerificationEmail: mocks.resend
    };
});

vi.mock('../../../src/lib/api/endpoints', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/api/endpoints')>();
    return { ...actual, partnerClaimsPublicApi: { lookup: mocks.lookup, signUp: mocks.signUp } };
});

vi.mock('../../../src/components/partner/PartnerClaim.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, property) => String(property)
    })
}));

/** Localized path for the test claim flow. */
export const PATH = '/es/partners/reclamar/';
/** Synthetic partner identifier. */
export const PARTNER_ID = 'd32b0f9b-0864-49d8-bf8f-0fb52c40fd15';
/** Synthetic claim secret. */
export const SECRET = 'fragment-secret-value';
/** Default successful claim response data. */
export const CLAIMED = { claimed: true as const, partnerId: PARTNER_ID, emailVerified: false };
const locationDescriptor = Object.getOwnPropertyDescriptor(
    window,
    'location'
) as PropertyDescriptor;

/** Restores the location after a test overrides it to observe navigation. */
export function restoreLocation(): void {
    Object.defineProperty(window, 'location', locationDescriptor);
}

/** Sets a claim fragment without triggering navigation. */
export function setFragment(fragment: string): void {
    window.history.replaceState(null, '', `${PATH}#${fragment}`);
}

/** Sets the session seen by the claim island. */
export function setAuthenticated(authenticated: boolean): void {
    mocks.authenticated = authenticated;
}

/** Renders the claim island in Spanish by default. */
export function renderClaim({ locale = 'es' }: { readonly locale?: 'es' | 'en' | 'pt' } = {}) {
    return render(<PartnerClaim locale={locale} />);
}

/** Registers isolated claim state for the calling test suite. */
export function useClaimFixture(): void {
    beforeEach(() => {
        window.sessionStorage.clear();
        window.history.replaceState(null, '', PATH);
        mocks.authenticated = false;
        mocks.claim.mockReset().mockResolvedValue({ ok: true, data: CLAIMED });
        mocks.checkClaim.mockReset().mockResolvedValue({ ok: true, data: { emailMatches: true } });
        mocks.refresh.mockReset().mockResolvedValue(undefined);
        mocks.lookup.mockReset().mockResolvedValue({
            ok: true,
            data: { email: 'claim@example.test', accountExists: false }
        });
        mocks.signUp.mockReset().mockResolvedValue({ ok: true, data: { claimed: true } });
        mocks.signInEmail.mockReset().mockResolvedValue({ data: {} });
        mocks.signOut.mockReset().mockResolvedValue(undefined);
        mocks.resend.mockReset();
    });

    afterEach(() => {
        restoreLocation();
        vi.restoreAllMocks();
    });
}
