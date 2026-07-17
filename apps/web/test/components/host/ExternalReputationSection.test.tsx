/**
 * @file ExternalReputationSection.test.tsx
 * @description RTL tests for the ExternalReputationSection React component (SPEC-237 T-013).
 *
 * Covers:
 * - Explainer always present (even when loading)
 * - Empty state when no listings returned
 * - Renders existing listing rows with toggles and remove button
 * - Add listing: calls POST on submit
 * - Toggle (showLink / showReviews): calls PATCH per listing
 * - Remove: calls DELETE per listing
 * - Refresh: calls POST /refresh
 * - Rate-limit (429): shows rate-limit message with computed minutes
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalReputationSection } from '@/components/host/ExternalReputationSection.client';

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/ExternalReputationSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────

const ACC_ID = 'acc-uuid-123';

const LISTING_GOOGLE = {
    id: 'listing-g1',
    platform: 'GOOGLE' as const,
    url: 'https://maps.google.com/?cid=123',
    showLink: true,
    showReviews: true,
    verified: true
};

const LISTING_BOOKING = {
    id: 'listing-b1',
    platform: 'BOOKING' as const,
    url: 'https://booking.com/hotel/example',
    showLink: false,
    showReviews: false,
    verified: false
};

const REPUTATION_META = {
    showExternalReputation: true,
    aggregateFetchedAt: '2026-06-01T12:00:00.000Z'
};

const EMPTY_REPUTATION_META = {
    showExternalReputation: false,
    aggregateFetchedAt: null
};

/** Factory: returns a mock successful Response for GET /external-listings. */
function makeListingsOkResponse(
    listings: (typeof LISTING_GOOGLE)[] = [LISTING_GOOGLE],
    reputation = REPUTATION_META
): Response {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            data: { listings, reputation }
        }),
        headers: new Headers()
    } as unknown as Response;
}

/** Factory: returns a generic ok 200 response with no data (for POST/PATCH/DELETE). */
function makeOkResponse(): Response {
    return {
        ok: true,
        status: 200,
        json: async () => ({})
    } as unknown as Response;
}

// ─── Helper ────────────────────────────────────────────────────────────────

function renderSection() {
    return render(
        <ExternalReputationSection
            locale="es"
            accommodationId={ACC_ID}
        />
    );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ExternalReputationSection', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    // ── 1. Explainer always present ─────────────────────────────────────────

    describe('Google-only explainer', () => {
        it('renders the explainer note immediately on mount (before data loads)', () => {
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
            renderSection();

            expect(
                screen.getByText(/El texto de las reseñas solo está disponible para Google/i)
            ).toBeInTheDocument();
        });

        it('explainer is still present after data loads', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse());
            renderSection();

            await waitFor(() => {
                expect(
                    screen.getByText(/El texto de las reseñas solo está disponible para Google/i)
                ).toBeInTheDocument();
            });
        });
    });

    // ── 2. Empty state ──────────────────────────────────────────────────────

    describe('Empty state', () => {
        it('shows empty-state message when listings array is empty', async () => {
            vi.mocked(global.fetch).mockResolvedValue(
                makeListingsOkResponse([], EMPTY_REPUTATION_META)
            );
            renderSection();

            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });
        });

        it('does not show listing rows when listings is empty', async () => {
            vi.mocked(global.fetch).mockResolvedValue(
                makeListingsOkResponse([], EMPTY_REPUTATION_META)
            );
            renderSection();

            await waitFor(() => {
                expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
            });
        });
    });

    // ── 3. Renders existing listings ────────────────────────────────────────

    describe('Existing listings', () => {
        it('renders one row per listing', async () => {
            vi.mocked(global.fetch).mockResolvedValue(
                makeListingsOkResponse([LISTING_GOOGLE, LISTING_BOOKING])
            );
            renderSection();

            await waitFor(() => {
                const items = screen.getAllByRole('listitem');
                expect(items).toHaveLength(2);
            });
        });

        it('renders the platform label for Google listing', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([LISTING_GOOGLE]));
            renderSection();

            await waitFor(() => {
                // platformLabel fallback for GOOGLE is "Google"
                expect(screen.getByText('Google')).toBeInTheDocument();
            });
        });

        it('renders showLink and showReviews checkboxes per listing', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([LISTING_GOOGLE]));
            renderSection();

            await waitFor(() => {
                const linkCheckbox = screen.getByLabelText(/Google.*Mostrar enlace/i);
                const reviewsCheckbox = screen.getByLabelText(/Google.*Mostrar reseñas/i);
                expect(linkCheckbox).toBeInTheDocument();
                expect(reviewsCheckbox).toBeInTheDocument();
            });
        });

        it('renders a remove button per listing', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([LISTING_GOOGLE]));
            renderSection();

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /Eliminar Google/i })
                ).toBeInTheDocument();
            });
        });
    });

    // ── 4. Add listing ──────────────────────────────────────────────────────

    describe('Add listing', () => {
        it('calls POST /external-listings with the filled form data', async () => {
            // Initial GET (may be called multiple times by React Strict Mode)
            vi.mocked(global.fetch).mockImplementation((url, opts) => {
                const _urlStr = typeof url === 'string' ? url : url.toString();
                if ((opts as RequestInit)?.method === 'POST') {
                    return Promise.resolve(makeOkResponse());
                }
                return Promise.resolve(makeListingsOkResponse([]));
            });

            renderSection();

            // Wait for initial load to finish (empty state)
            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const urlInput = screen.getByPlaceholderText('https://...') as HTMLInputElement;
            fireEvent.change(urlInput, {
                target: { value: 'https://maps.google.com/?cid=999' }
            });

            const addButton = screen.getByRole('button', { name: /Agregar/i });
            fireEvent.click(addButton);

            await waitFor(() => {
                const fetchCalls = vi.mocked(global.fetch).mock.calls;
                const postCall = fetchCalls.find(
                    ([_url, opts]) =>
                        (opts as RequestInit)?.method === 'POST' &&
                        typeof _url === 'string' &&
                        (_url as string).includes('/external-listings')
                );
                expect(postCall).toBeDefined();
                const body = JSON.parse((postCall?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.url).toBe('https://maps.google.com/?cid=999');
                expect(body.platform).toBe('GOOGLE');
            });
        });

        it('disables the add button when URL is empty', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([]));
            renderSection();

            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const addButton = screen.getByRole('button', { name: /Agregar/i });
            expect(addButton).toBeDisabled();
        });

        it('rejects an invalid URL client-side without POSTing (HOS-190 gap)', async () => {
            // Regression guard: this sub-section had its own Save with only a
            // non-empty check, so "csdcsdcsd" round-tripped to a server 400 the
            // client then mis-read into a generic banner. It now validates the
            // URL client-side (AccommodationExternalListingSchema.shape.url) and
            // never fires the POST for a malformed value.
            vi.mocked(global.fetch).mockImplementation((_url, opts) => {
                if ((opts as RequestInit)?.method === 'POST') {
                    return Promise.resolve(makeOkResponse());
                }
                return Promise.resolve(makeListingsOkResponse([]));
            });

            renderSection();
            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const urlInput = screen.getByPlaceholderText('https://...') as HTMLInputElement;
            fireEvent.change(urlInput, { target: { value: 'csdcsdcsd' } });
            fireEvent.click(screen.getByRole('button', { name: /Agregar/i }));

            // A field-level error is shown and the URL input is marked invalid.
            expect(await screen.findByRole('alert')).toBeInTheDocument();
            expect(urlInput).toHaveAttribute('aria-invalid', 'true');

            // No POST was ever issued.
            const postCall = vi
                .mocked(global.fetch)
                .mock.calls.find(([, opts]) => (opts as RequestInit)?.method === 'POST');
            expect(postCall).toBeUndefined();
        });

        it('surfaces a server ServiceError message (DUPLICATE_PLATFORM shape) instead of the generic fallback (HOS-190)', async () => {
            // Regression guard for the ORIGINAL bug: a handler-thrown ServiceError
            // 400 serializes as { error: { code, message, details } } (no
            // userFriendlyMessage/summary). The old code read only `.message`
            // then the fix briefly read only userFriendlyMessage/summary — both
            // half-right. The fallback chain must surface this `message`.
            const duplicateMessage = 'A listing for platform GOOGLE already exists';
            vi.mocked(global.fetch).mockImplementation((_url, opts) => {
                if ((opts as RequestInit)?.method === 'POST') {
                    return Promise.resolve({
                        ok: false,
                        status: 400,
                        json: async () => ({
                            error: { code: 'DUPLICATE_PLATFORM', message: duplicateMessage }
                        })
                    } as unknown as Response);
                }
                return Promise.resolve(makeListingsOkResponse([]));
            });

            renderSection();
            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const urlInput = screen.getByPlaceholderText('https://...') as HTMLInputElement;
            fireEvent.change(urlInput, { target: { value: 'https://maps.google.com/?cid=1' } });
            fireEvent.click(screen.getByRole('button', { name: /Agregar/i }));

            expect(await screen.findByText(duplicateMessage)).toBeInTheDocument();
        });
    });

    // ── 5. Toggle showLink / showReviews ────────────────────────────────────

    describe('Per-listing toggles', () => {
        it('calls PATCH /external-listings/:id with showLink:false when unchecking showLink', async () => {
            vi.mocked(global.fetch).mockImplementation((_url, opts) => {
                if ((opts as RequestInit)?.method === 'PATCH') {
                    return Promise.resolve(makeOkResponse());
                }
                return Promise.resolve(makeListingsOkResponse([LISTING_GOOGLE]));
            });

            renderSection();

            await waitFor(() => {
                expect(screen.getByText('Google')).toBeInTheDocument();
            });

            const linkCheckbox = screen.getByLabelText(
                /Google.*Mostrar enlace/i
            ) as HTMLInputElement;
            expect(linkCheckbox.checked).toBe(true);
            fireEvent.click(linkCheckbox);

            await waitFor(() => {
                const fetchCalls = vi.mocked(global.fetch).mock.calls;
                const patchCall = fetchCalls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        (url as string).includes(`/external-listings/${LISTING_GOOGLE.id}`) &&
                        (opts as RequestInit)?.method === 'PATCH'
                );
                expect(patchCall).toBeDefined();
                const body = JSON.parse((patchCall?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.showLink).toBe(false);
            });
        });

        it('calls PATCH with showReviews:false when unchecking showReviews', async () => {
            vi.mocked(global.fetch).mockImplementation((_url, opts) => {
                if ((opts as RequestInit)?.method === 'PATCH') {
                    return Promise.resolve(makeOkResponse());
                }
                return Promise.resolve(makeListingsOkResponse([LISTING_GOOGLE]));
            });

            renderSection();

            await waitFor(() => {
                expect(screen.getByText('Google')).toBeInTheDocument();
            });

            const reviewsCheckbox = screen.getByLabelText(
                /Google.*Mostrar reseñas/i
            ) as HTMLInputElement;
            fireEvent.click(reviewsCheckbox);

            await waitFor(() => {
                const fetchCalls = vi.mocked(global.fetch).mock.calls;
                const patchCall = fetchCalls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        (url as string).includes(`/external-listings/${LISTING_GOOGLE.id}`) &&
                        (opts as RequestInit)?.method === 'PATCH'
                );
                expect(patchCall).toBeDefined();
                const body = JSON.parse((patchCall?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.showReviews).toBe(false);
            });
        });
    });

    // ── 6. Remove listing ───────────────────────────────────────────────────

    describe('Remove listing', () => {
        it('calls DELETE /external-listings/:id when remove button is clicked', async () => {
            vi.mocked(global.fetch).mockImplementation((_url, opts) => {
                if ((opts as RequestInit)?.method === 'DELETE') {
                    return Promise.resolve({ ok: true, status: 200 } as Response);
                }
                return Promise.resolve(makeListingsOkResponse([LISTING_GOOGLE]));
            });

            renderSection();

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /Eliminar Google/i })
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Eliminar Google/i }));

            await waitFor(() => {
                const fetchCalls = vi.mocked(global.fetch).mock.calls;
                const deleteCall = fetchCalls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        (url as string).includes(`/external-listings/${LISTING_GOOGLE.id}`) &&
                        (opts as RequestInit)?.method === 'DELETE'
                );
                expect(deleteCall).toBeDefined();
            });
        });

        it('removes the listing from the DOM after successful DELETE', async () => {
            vi.mocked(global.fetch).mockImplementation((_url, opts) => {
                if ((opts as RequestInit)?.method === 'DELETE') {
                    return Promise.resolve({ ok: true, status: 200 } as Response);
                }
                return Promise.resolve(makeListingsOkResponse([LISTING_GOOGLE]));
            });

            renderSection();

            await waitFor(() => {
                // The listing row has a platform span with text "Google"
                expect(
                    screen.getByRole('button', { name: /Eliminar Google/i })
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Eliminar Google/i }));

            await waitFor(() => {
                // The remove button is gone when the listing is removed from state
                expect(
                    screen.queryByRole('button', { name: /Eliminar Google/i })
                ).not.toBeInTheDocument();
            });
        });
    });

    // ── 7. Refresh ──────────────────────────────────────────────────────────

    describe('Refresh reputation', () => {
        it('calls POST /external-reputation/refresh when refresh button clicked', async () => {
            vi.mocked(global.fetch).mockImplementation((url, opts) => {
                const urlStr = typeof url === 'string' ? url : url.toString();
                if ((opts as RequestInit)?.method === 'POST' && urlStr.includes('/refresh')) {
                    return Promise.resolve({ ok: true, status: 200 } as Response);
                }
                return Promise.resolve(makeListingsOkResponse([LISTING_GOOGLE]));
            });

            renderSection();

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /Actualizar reseñas/i })
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Actualizar reseñas/i }));

            await waitFor(() => {
                const fetchCalls = vi.mocked(global.fetch).mock.calls;
                const refreshCall = fetchCalls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        (url as string).includes('/external-reputation/refresh') &&
                        (opts as RequestInit)?.method === 'POST'
                );
                expect(refreshCall).toBeDefined();
            });
        });
    });

    // ── SPEC-228 T-022: loading state uses Spinner, not '...' ───────────────

    describe('Loading state (SPEC-228 T-022)', () => {
        it('shows Spinner while loading (no raw "..." text)', () => {
            // Never resolve — keeps loading state active
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
            renderSection();

            // The ellipsis literal must not appear in the DOM
            expect(document.body.textContent).not.toContain('...');

            // The Spinner (role="status") should be present
            const spinner = screen.getByRole('status');
            expect(spinner).toBeInTheDocument();
        });

        it('Spinner is removed once data loads', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([]));
            renderSection();

            await waitFor(() => {
                expect(screen.queryByRole('status')).not.toBeInTheDocument();
            });
        });
    });

    // ── 8. Rate-limit message on 429 ────────────────────────────────────────

    describe('Rate-limit (429)', () => {
        it('shows rate-limit message when refresh returns 429 with Retry-After: 300', async () => {
            vi.mocked(global.fetch).mockImplementation((url, opts) => {
                const urlStr = typeof url === 'string' ? url : url.toString();
                if ((opts as RequestInit)?.method === 'POST' && urlStr.includes('/refresh')) {
                    return Promise.resolve({
                        ok: false,
                        status: 429,
                        headers: new Headers({ 'Retry-After': '300' }) // 5 minutes
                    } as Response);
                }
                return Promise.resolve(makeListingsOkResponse([LISTING_GOOGLE]));
            });

            renderSection();

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /Actualizar reseñas/i })
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Actualizar reseñas/i }));

            await waitFor(() => {
                const msg = screen.getByTestId('rate-limit-msg');
                expect(msg).toBeInTheDocument();
                expect(msg.textContent).toMatch(/5\s*minutos/i);
            });
        });

        it('computes minutes correctly from Retry-After header of 120 seconds', async () => {
            vi.mocked(global.fetch).mockImplementation((url, opts) => {
                const urlStr = typeof url === 'string' ? url : url.toString();
                if ((opts as RequestInit)?.method === 'POST' && urlStr.includes('/refresh')) {
                    return Promise.resolve({
                        ok: false,
                        status: 429,
                        headers: new Headers({ 'Retry-After': '120' }) // exactly 2 minutes
                    } as Response);
                }
                return Promise.resolve(makeListingsOkResponse([LISTING_GOOGLE]));
            });

            renderSection();

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /Actualizar reseñas/i })
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Actualizar reseñas/i }));

            await waitFor(() => {
                const msg = screen.getByTestId('rate-limit-msg');
                expect(msg.textContent).toMatch(/2\s*minutos/i);
            });
        });
    });

    // ── Dynamic per-platform URL hint (BETA-136) ────────────────────────────

    describe('Dynamic URL hint', () => {
        it('shows the Google hint by default (GOOGLE is the initial addPlatform)', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([]));
            renderSection();

            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-url-hint').textContent).toMatch(/Google Maps/i);
            });
        });

        it('updates the hint text when the selected platform changes to BOOKING', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([]));
            renderSection();

            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const platformSelect = screen.getByLabelText('Plataforma') as HTMLSelectElement;
            fireEvent.change(platformSelect, { target: { value: 'BOOKING' } });

            expect(screen.getByTestId('ext-rep-url-hint').textContent).toMatch(
                /extranet de Booking/i
            );
        });

        it('updates the hint text when the selected platform changes to AIRBNB', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([]));
            renderSection();

            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const platformSelect = screen.getByLabelText('Plataforma') as HTMLSelectElement;
            fireEvent.change(platformSelect, { target: { value: 'AIRBNB' } });

            expect(screen.getByTestId('ext-rep-url-hint').textContent).toMatch(
                /anfitrión de Airbnb/i
            );
        });

        it('updates the hint text when the selected platform changes to OTHER', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([]));
            renderSection();

            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const platformSelect = screen.getByLabelText('Plataforma') as HTMLSelectElement;
            fireEvent.change(platformSelect, { target: { value: 'OTHER' } });

            expect(screen.getByTestId('ext-rep-url-hint').textContent).toMatch(
                /enlace público directo/i
            );
        });
    });

    // ── Regression: unmemoized `t` used to recreate `loadListings` on every
    // render, re-triggering its mount effect in an infinite fetch loop ──────

    describe('Regression: stable loadListings effect (infinite fetch loop bug)', () => {
        it('calls GET /external-listings exactly once on mount, even after settling', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeListingsOkResponse([]));

            renderSection();

            await waitFor(() => {
                expect(screen.getByTestId('ext-rep-empty')).toBeInTheDocument();
            });

            const countGetListings = () =>
                vi.mocked(global.fetch).mock.calls.filter(([url, opts]) => {
                    const urlStr = typeof url === 'string' ? url : url.toString();
                    return (
                        urlStr.includes('/external-listings') &&
                        !(opts as RequestInit | undefined)?.method
                    );
                }).length;

            const initialCount = countGetListings();
            expect(initialCount).toBe(1);

            // Give a runaway render->fetch->setState loop a chance to fire more requests.
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(countGetListings()).toBe(initialCount);
        });
    });
});
