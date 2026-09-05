/**
 * @file CommerceListingActions.test.tsx
 * @description RTL tests for the per-listing state badge/checklist/CTA
 * island (HOS-166 §8 points 4/5/6, AC-21).
 *
 * Covers: every card state renders the right badge, the checklist renders
 * `missing` and disables the publish CTA while incomplete (AC-21), a
 * complete draft enables the CTA and starts checkout on click, and a 422
 * response updates the checklist from the SERVER's `missing` array
 * (R-5 — the server is authoritative, never the local preview).
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingActions } from '../../../src/components/commerce/CommerceListingActions.client';
import type { CommerceOwnerListingSummaryWithState } from '../../../src/lib/commerce/owner-listings';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        // Signature matches the real `PluralTranslationFn`: `(key, count,
        // params?)` and NO fallback parameter. A stub that accepted a fallback
        // would let a call site pass one and look fine here while the real
        // function silently treated it as `params`.
        //
        // The key and count are both rendered so the test asserting the trial
        // CTA names its days can tell itself apart from the one asserting it
        // names none — a stub that dropped `count` would make those two cases
        // produce identical output and one of them would be vacuous.
        tPlural: (key: string, count: number) => `${key} [${count}]`
    })
}));

vi.mock('../../../src/components/commerce/CommerceListingActions.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`,
    buildUrlWithParams: ({
        locale,
        path,
        params
    }: {
        locale: string;
        path: string;
        params: Record<string, string>;
    }) => `/${locale}/${path}/?${new URLSearchParams(params).toString()}`
}));

vi.mock('../../../src/lib/billing/checkout-pending', () => ({
    storePendingCheckoutSubId: vi.fn()
}));

vi.mock('../../../src/lib/commerce/owner-listings', () => ({
    startOwnerListingCheckout: vi.fn()
}));

import { storePendingCheckoutSubId } from '../../../src/lib/billing/checkout-pending';
import { startOwnerListingCheckout } from '../../../src/lib/commerce/owner-listings';

const mockStartCheckout = vi.mocked(startOwnerListingCheckout);
const mockStorePending = vi.mocked(storePendingCheckoutSubId);

function buildListing(
    overrides: Partial<CommerceOwnerListingSummaryWithState> = {}
): CommerceOwnerListingSummaryWithState {
    return {
        id: 'listing-1',
        vertical: 'gastronomy',
        name: 'La Parrilla',
        slug: 'la-parrilla',
        type: 'RESTAURANT',
        isPublic: false,
        completeness: null,
        ...overrides
    };
}

beforeEach(() => {
    mockStartCheckout.mockReset();
    mockStorePending.mockReset();
    Object.defineProperty(window, 'location', {
        // `reload` is included (HOS-689 item 4): the `appliedEffect: 'attached'`
        // branch calls `window.location.reload()` instead of navigating via
        // `href` — real jsdom's `location.reload` throws "Not implemented"
        // unless the mock supplies its own.
        value: { href: '', reload: vi.fn() },
        writable: true,
        configurable: true
    });
});

describe('CommerceListingActions', () => {
    describe('published state', () => {
        it('shows the published badge and a public-page link', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({ isPublic: true, completeness: null })}
                    locale="es"
                />
            );

            expect(screen.getByText('Publicado')).toBeInTheDocument();
            expect(screen.getByText('Ver ficha pública')).toHaveAttribute(
                'href',
                '/es/gastronomia/la-parrilla/'
            );
        });
    });

    describe('draft-incomplete state (AC-21)', () => {
        it('renders the missing checklist and disables the publish button', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({
                        completeness: { complete: false, missing: ['summary', 'contactInfo'] }
                    })}
                    locale="es"
                />
            );

            const checklist = screen.getByTestId('commerce-checklist');
            expect(checklist).toHaveTextContent('Resumen');
            expect(checklist).toHaveTextContent('Un dato de contacto (teléfono o email)');
            expect(screen.getByTestId('commerce-publish-button')).toBeDisabled();
        });

        it('never renders a bare disabled button — the checklist is always visible alongside it', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({
                        completeness: { complete: false, missing: ['name'] }
                    })}
                    locale="es"
                />
            );

            expect(screen.getByTestId('commerce-checklist')).toBeInTheDocument();
        });
    });

    describe('draft-complete state', () => {
        it('enables the publish button when complete', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                />
            );

            expect(screen.getByTestId('commerce-publish-button')).toBeEnabled();
            expect(screen.queryByTestId('commerce-checklist')).not.toBeInTheDocument();
        });

        it('starts checkout, stores the pending id, and redirects on click', async () => {
            mockStartCheckout.mockResolvedValue({
                ok: true,
                data: {
                    checkoutUrl: 'https://mp.test/checkout/abc',
                    localSubscriptionId: 'sub-1',
                    expiresAt: '2026-01-01T00:00:00.000Z'
                }
            });

            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                />
            );

            fireEvent.click(screen.getByTestId('commerce-publish-button'));

            await waitFor(() => {
                expect(mockStartCheckout).toHaveBeenCalledWith({
                    vertical: 'gastronomy',
                    listingId: 'listing-1'
                });
            });
            expect(mockStorePending).toHaveBeenCalledWith('sub-1');
            await waitFor(() => {
                expect(window.location.href).toBe('https://mp.test/checkout/abc');
            });
        });

        it('shows "Publicar" (no "y pagar") when the owner already holds a vertical subscription (HOS-689 item 4)', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                    trialVerdict="has_active_sub"
                />
            );

            expect(screen.getByTestId('commerce-publish-button')).toHaveTextContent('Publicar');
            expect(screen.getByTestId('commerce-publish-button')).not.toHaveTextContent(
                'Publicar y pagar'
            );
        });

        it('offers the free days instead of a payment when a trial is available (HOS-1184)', () => {
            // The bug in one assertion. Before HOS-1184 this owner read
            // "Publicar y pagar" and was sent to MercadoPago, which charges on
            // card authorization — while /planes/gastronomia promised them
            // thirty free days reading the same database column.
            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                    trialVerdict="trial_available"
                    trialDays={30}
                />
            );

            const button = screen.getByTestId('commerce-publish-button');
            // Asserted as the KEY plus the count, because `tPlural` takes no
            // fallback: this file's stub renders `<key> [<count>]`. The Spanish
            // string itself (`Publicar gratis 30 días`) lives in
            // `packages/i18n` and is pinned by the i18n guards, not here — a
            // component test that hardcoded it would just be re-asserting its
            // own stub.
            expect(button).toHaveTextContent('publishCtaTrial');
            expect(button).toHaveTextContent('30');
            expect(button).not.toHaveTextContent('Publicar y pagar');
            // Owner copy decision (HOS-1183, applied to both verticals): the CTA
            // announces the free days and NEVER claims no card is needed — the
            // card is asked for at signup.
            expect(button).not.toHaveTextContent('sin tarjeta');
        });

        it('names no number rather than a wrong one when trialDays is absent', () => {
            // A verdict that arrives without a length still publishes free; it
            // just cannot say for how long. Rendering "0 días" or a hardcoded 30
            // would be the promise drifting from the grant, which is the whole
            // failure mode this issue is about.
            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                    trialVerdict="trial_available"
                />
            );

            const button = screen.getByTestId('commerce-publish-button');
            expect(button).toHaveTextContent('Publicar gratis');
            expect(button).not.toHaveTextContent('0');
            expect(button).not.toHaveTextContent('Publicar y pagar');
        });

        it('reloads instead of navigating when the backend attaches without a checkout (appliedEffect: attached)', async () => {
            // HOS-688 §6.8 branch 2: the owner already held a subscription for
            // this vertical, so the backend attached the listing and published
            // it synchronously — `checkoutUrl` is only an in-app sentinel, so
            // following it via `href` would be meaningless. The component must
            // reload instead.
            mockStartCheckout.mockResolvedValue({
                ok: true,
                data: {
                    checkoutUrl: 'https://hospeda.test/mi-cuenta/comercio/',
                    localSubscriptionId: 'sub-2',
                    expiresAt: '2026-01-01T00:00:00.000Z',
                    appliedEffect: 'attached'
                }
            });

            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                    trialVerdict="has_active_sub"
                />
            );

            fireEvent.click(screen.getByTestId('commerce-publish-button'));

            await waitFor(() => {
                expect(window.location.reload).toHaveBeenCalledOnce();
            });
            // No pending-checkout id is stashed, and no navigation happens —
            // there is nothing for the success/poller flow to resolve.
            expect(mockStorePending).not.toHaveBeenCalled();
            expect(window.location.href).toBe('');
        });

        it('replaces the local checklist with the SERVER missing array on a 422 (R-5)', async () => {
            // `missing` is a SIBLING of `code`/`message` on the real API error
            // body (`{success:false, error:{code, message, missing}}`), NOT
            // nested under `details` — mirrors what `apps/api/test/routes/
            // commerce/protected/start-subscription.test.ts` asserts as
            // `body.error.missing`. A mock shaped as `details: { missing }`
            // would NOT pin this contract (the component would read
            // `result.error.missing`, find it undefined, and fall back to an
            // empty checklist) — this shape is required for this test to
            // actually fail against the old `details.missing` reader.
            mockStartCheckout.mockResolvedValue({
                ok: false,
                error: {
                    status: 422,
                    message: 'Listing incomplete',
                    missing: ['media.featuredImage']
                }
            });

            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                />
            );

            fireEvent.click(screen.getByTestId('commerce-publish-button'));

            await waitFor(() => {
                expect(screen.getByTestId('commerce-checklist')).toHaveTextContent(
                    'Foto principal'
                );
            });
            expect(screen.getByTestId('commerce-publish-button')).toBeDisabled();
        });

        it('shows an already-subscribed message on 409', async () => {
            mockStartCheckout.mockResolvedValue({
                ok: false,
                error: { status: 409, message: 'Already subscribed' }
            });

            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                />
            );

            fireEvent.click(screen.getByTestId('commerce-publish-button'));

            await waitFor(() => {
                expect(
                    screen.getByText('Este comercio ya tiene una suscripción activa.')
                ).toBeInTheDocument();
            });
        });
    });

    describe('unknown state', () => {
        it('renders a generic unavailable badge when completeness could not be determined', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({ completeness: null })}
                    locale="es"
                />
            );

            expect(screen.getByText('Estado no disponible')).toBeInTheDocument();
        });
    });

    describe('suspended state (HOS-166 judgment-day W1)', () => {
        it('renders the suspended badge + a recover CTA linking to the commerce-scoped subscription page when subscriptionStatus is past_due', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({
                        isPublic: false,
                        completeness: { complete: true, missing: [] },
                        subscriptionStatus: SubscriptionStatusEnum.PAST_DUE
                    })}
                    locale="es"
                />
            );

            expect(screen.getByText('Suspendido')).toBeInTheDocument();
            // HOS-259 / HOS-689: `?domain=<listing.vertical>` scopes the account
            // subscription page (and the underlying `productDomain` query
            // filter) to the caller's subscription for THIS listing's
            // vertical specifically — the transitional `commerce` umbrella
            // would match either gastronomy or experience ambiguously for an
            // owner who holds both, exactly the bug HOS-259 fixed for
            // accommodation vs. commerce in the first place. `buildListing`'s
            // default vertical is 'gastronomy'.
            expect(screen.getByText('Revisar mi suscripción')).toHaveAttribute(
                'href',
                '/es/mi-cuenta/suscripcion/?domain=gastronomy'
            );
        });

        it("scopes the recover CTA to the experience vertical when that is the listing's vertical", () => {
            render(
                <CommerceListingActions
                    listing={buildListing({
                        vertical: 'experience',
                        isPublic: false,
                        completeness: { complete: true, missing: [] },
                        subscriptionStatus: SubscriptionStatusEnum.PAST_DUE
                    })}
                    locale="es"
                    trialVerdict="has_active_sub"
                />
            );

            expect(screen.getByText('Revisar mi suscripción')).toHaveAttribute(
                'href',
                '/es/mi-cuenta/suscripcion/?domain=experience'
            );
        });

        it('does NOT render suspended when the listing is already public, even if subscriptionStatus is stale past_due', () => {
            render(
                <CommerceListingActions
                    listing={buildListing({
                        isPublic: true,
                        completeness: null,
                        subscriptionStatus: SubscriptionStatusEnum.PAST_DUE
                    })}
                    locale="es"
                />
            );

            expect(screen.getByText('Publicado')).toBeInTheDocument();
            expect(screen.queryByText('Suspendido')).not.toBeInTheDocument();
        });
    });
});
