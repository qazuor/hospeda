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
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/commerce/CommerceListingActions.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`
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
        value: { href: '' },
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
        it('renders the suspended badge + a recover CTA linking to the subscription page when subscriptionStatus is past_due', () => {
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
            expect(screen.getByText('Revisar mi suscripción')).toHaveAttribute(
                'href',
                '/es/mi-cuenta/suscripcion/'
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
