/**
 * @file RecommendationsFeed.test.tsx
 * @description RTL tests for the RecommendationsFeed React island (SPEC-284
 * T-016 — full state-matrix coverage building on the T-011 smoke suite).
 *
 * Covers:
 *  - Loading state renders initially
 *  - Populated, non-cold-start feed renders the grid with one card per item
 *  - Cold-start feed renders the banner ABOVE the grid, items still render
 *  - True-empty feed (`items: []`, `isColdStart: false`) renders the empty state
 *  - Fetch error renders the error message + retry action; retry re-fetches
 *  - 403 response renders the entitlement-required message
 *  - Unmounting mid-fetch does not trigger a React state-update warning
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationsFeed } from '../../src/components/account/RecommendationsFeed.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../src/components/account/RecommendationsFeed.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const API_URL = 'http://localhost:3001';
const LOCALE = 'es' as const;

function makeScored(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        accommodation: {
            id: 'accommodation-uuid-001',
            name: 'Cabaña del Río',
            slug: 'cabana-del-rio',
            summary: 'Una cabaña frente al río',
            type: 'CABIN',
            price: { price: 15000, currency: 'ARS' },
            location: { city: 'Concepción del Uruguay' },
            media: { featuredImage: { url: 'https://cdn.example.com/img.jpg' } },
            isFeatured: false,
            ownerId: 'owner-uuid-001',
            reviewsCount: 4,
            averageRating: 4.5,
            destinationId: 'destination-uuid-001',
            amenityIds: ['amenity-uuid-001'],
            ...overrides
        },
        score: { destination: 40, type: 20, price: 14, amenities: 9, quality: 5 },
        totalScore: 88
    };
}

const SCORED_1 = makeScored();
const SCORED_2 = makeScored({
    id: 'accommodation-uuid-002',
    name: 'Departamento Céntrico',
    slug: 'departamento-centrico'
});

/** Successful, populated, non-cold-start feed response. */
function makeGridResponse(items: unknown[] = [SCORED_1, SCORED_2], isColdStart = false) {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            success: true,
            data: { items, isColdStart, generatedAt: new Date().toISOString() }
        })
    } as Response;
}

/** True-empty feed response (`items: []`, `isColdStart: false`). */
function makeEmptyResponse() {
    return makeGridResponse([], false);
}

/** Generic non-2xx, non-403 error response. */
function makeErrorResponse(status = 500) {
    return {
        ok: false,
        status,
        json: async () => ({ success: false, error: { message: 'Server error' } })
    } as Response;
}

/** 403 entitlement-required response. */
function makeEntitlementResponse() {
    return {
        ok: false,
        status: 403,
        json: async () => ({
            success: false,
            error: { code: 'ENTITLEMENT_REQUIRED', message: 'Forbidden' }
        })
    } as Response;
}

function renderComponent() {
    return render(
        <RecommendationsFeed
            locale={LOCALE}
            apiUrl={API_URL}
        />
    );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    global.fetch = vi.fn();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecommendationsFeed', () => {
    // ── 1. Loading state ──────────────────────────────────────────────────────

    describe('Loading state', () => {
        it('shows the loading state initially', () => {
            vi.mocked(global.fetch).mockImplementationOnce(
                () => new Promise<Response>(() => undefined)
            );
            renderComponent();
            expect(screen.getByLabelText('Cargando recomendaciones...')).toBeInTheDocument();
        });
    });

    // ── 2. Populated grid ─────────────────────────────────────────────────────

    describe('Populated grid', () => {
        it('renders one card per item', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeGridResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });
        });

        it('renders the grid list label from i18n', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeGridResponse());
            renderComponent();
            await waitFor(() => {
                expect(
                    screen.getByRole('list', { name: 'Recomendaciones para vos' })
                ).toBeInTheDocument();
            });
        });

        it('renders each card title and the CTA text from i18n', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeGridResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('Cabaña del Río')).toBeInTheDocument();
                expect(screen.getByText('Departamento Céntrico')).toBeInTheDocument();
            });
            expect(screen.getAllByText('Ver alojamiento')).toHaveLength(2);
        });

        it('does NOT render the cold-start banner', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeGridResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });
            expect(
                screen.queryByText('Todavía estamos conociendo tus gustos')
            ).not.toBeInTheDocument();
        });
    });

    // ── 3. Cold-start ─────────────────────────────────────────────────────────

    describe('Cold-start feed', () => {
        it('renders the cold-start banner above the grid', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(
                makeGridResponse([SCORED_1, SCORED_2], true)
            );
            const { container } = renderComponent();

            await waitFor(() => {
                expect(
                    screen.getByText('Todavía estamos conociendo tus gustos')
                ).toBeInTheDocument();
            });

            const banner = container.querySelector('.coldStartBanner');
            const grid = container.querySelector('.grid');
            expect(banner).not.toBeNull();
            expect(grid).not.toBeNull();
            // Direct siblings under the root wrapper: DOCUMENT_POSITION_FOLLOWING
            // means `grid` comes strictly after `banner` in document order.
            expect(banner?.compareDocumentPosition(grid as Node)).toBe(
                Node.DOCUMENT_POSITION_FOLLOWING
            );
        });

        it('renders the cold-start body copy', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(
                makeGridResponse([SCORED_1, SCORED_2], true)
            );
            renderComponent();
            await waitFor(() => {
                expect(
                    screen.getByText(/Mientras tanto, te mostramos alojamientos populares/)
                ).toBeInTheDocument();
            });
        });

        it('still renders the fallback/popular items (cold-start is not empty)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(
                makeGridResponse([SCORED_1, SCORED_2], true)
            );
            renderComponent();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });
            expect(
                screen.queryByText('No encontramos recomendaciones por ahora')
            ).not.toBeInTheDocument();
        });
    });

    // ── 4. True-empty state ───────────────────────────────────────────────────

    describe('True-empty feed', () => {
        it('renders the empty-state title and body', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEmptyResponse());
            renderComponent();
            await waitFor(() => {
                expect(
                    screen.getByText('No encontramos recomendaciones por ahora')
                ).toBeInTheDocument();
            });
            expect(
                screen.getByText('Volvé más tarde o explorá todo nuestro catálogo de alojamientos.')
            ).toBeInTheDocument();
        });

        it('does NOT render any cards or the cold-start banner', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEmptyResponse());
            renderComponent();
            await waitFor(() => {
                expect(
                    screen.getByText('No encontramos recomendaciones por ahora')
                ).toBeInTheDocument();
            });
            expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
            expect(
                screen.queryByText('Todavía estamos conociendo tus gustos')
            ).not.toBeInTheDocument();
        });
    });

    // ── 5. Fetch error + retry ────────────────────────────────────────────────

    describe('Fetch error', () => {
        it('renders the fetch-error message', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeErrorResponse());
            renderComponent();
            await waitFor(() => {
                expect(
                    screen.getByText('No pudimos cargar tus recomendaciones')
                ).toBeInTheDocument();
            });
        });

        it('renders the error inside an alert region with a retry button', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeErrorResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
            });
        });

        it('re-fetches and renders the grid when retry is clicked', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeErrorResponse())
                .mockResolvedValueOnce(makeGridResponse());

            renderComponent();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });
            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
        });
    });

    // ── 6. Entitlement required (403) ─────────────────────────────────────────

    describe('Entitlement required', () => {
        it('renders the entitlement-required message on a 403 response', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEntitlementResponse());
            renderComponent();
            await waitFor(() => {
                expect(
                    screen.getByText('Esta función está disponible para suscriptores Plus y VIP.')
                ).toBeInTheDocument();
            });
        });

        it('does NOT render a retry button (a retry cannot change the plan)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEntitlementResponse());
            renderComponent();
            await waitFor(() => {
                expect(
                    screen.getByText('Esta función está disponible para suscriptores Plus y VIP.')
                ).toBeInTheDocument();
            });
            expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
        });
    });

    // ── 7. Unmount mid-fetch ──────────────────────────────────────────────────

    describe('Unmount during fetch', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('does not trigger a React state-update warning when unmounted before fetch resolves', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            let resolveFetch: ((value: Response) => void) | undefined;
            const pending = new Promise<Response>((resolve) => {
                resolveFetch = resolve;
            });
            vi.mocked(global.fetch).mockReturnValueOnce(pending);

            const { unmount } = renderComponent();
            unmount();

            // Resolve the in-flight fetch AFTER unmount — the isMountedRef guard
            // must prevent any setState call from running.
            resolveFetch?.(makeGridResponse());
            // Flush the fetch resolution + the subsequent res.json() microtask.
            await pending;
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(errorSpy).not.toHaveBeenCalled();
            expect(warnSpy).not.toHaveBeenCalled();
        });
    });
});
