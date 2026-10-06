/**
 * @file ListingActions.test.tsx
 * @description RTL tests for the per-listing state badge/checklist island
 * (HOS-166 §8 points 4/5/6, AC-21).
 *
 * Covers: every card state renders the right badge, the checklist renders
 * `missing` for an incomplete draft (AC-21), and a complete draft reports it is
 * ready. There is no publish control: the self-checkout it used to start was
 * removed with the old billing system.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingActions } from '../../../src/components/listing/ListingActions.client';
import type { OwnerListingSummaryWithState } from '../../../src/lib/listing/owner-listings';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/listing/ListingActions.module.css', () => ({
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

// HOS-982 PR 2. The published branch mounts `ListingQrSheet`, which fetches its
// symbol on mount. Without these two the suite made REAL network calls: the
// vitest env sets `PUBLIC_API_URL` to `http://localhost:3001`, so a machine with
// the dev API running had these tests talking to it, and they passed either way
// because the panel swallows a failed image on purpose. A test that is green
// whether or not it reached a live server is not testing anything about it.
vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

function buildListing(
    overrides: Partial<OwnerListingSummaryWithState> = {}
): OwnerListingSummaryWithState {
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
    // Nothing in this suite asserts on the QR panel's own request; the stub is
    // here so it never leaves the process. `vi.stubGlobal` is reset per test by
    // the shared setup, so it is installed for each one.
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
            throw new Error('network disabled in this suite');
        })
    );
});

describe('ListingActions', () => {
    describe('published state', () => {
        it('shows the published badge and a public-page link', () => {
            render(
                <ListingActions
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

        /*
         * HOS-982. The QR sheet rides in the published branch, next to the
         * brochure and for the same reason the brochure is there: the sheet
         * prints a code that resolves to the PUBLIC ficha, so a draft's code
         * would be a permanent 404 on a piece of paper somebody taped to a door.
         * The API enforces that rule itself; this pair only proves the card does
         * not offer a download that could never work.
         */
        it('offers the printable QR sheet on a published listing', () => {
            render(
                <ListingActions
                    listing={buildListing({
                        isPublic: true,
                        hasPublicPage: true,
                        completeness: null
                    })}
                    locale="es"
                />
            );

            expect(screen.getByTestId('listing-qr-sheet')).toBeInTheDocument();
            expect(screen.getByTestId('listing-qr-sheet-download')).toBeInTheDocument();
        });

        /*
         * HOS-982 PR 2. `isPublic` is visibility ALONE; the API also requires
         * `lifecycleState === ACTIVE`. A staff PATCH to INACTIVE that leaves
         * visibility standing produces this row, and it renders the published
         * badge and the public link (both pre-existing, both out of this change's
         * scope) — but the QR panel must not join them, because every request it
         * would make answers 404. Before this fix the card carried three
         * contradictory sentences and no possible action.
         */
        it('does NOT offer it when the listing is PUBLIC but not ACTIVE', () => {
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            render(
                <ListingActions
                    listing={buildListing({
                        isPublic: true,
                        hasPublicPage: false,
                        completeness: null
                    })}
                    locale="es"
                />
            );

            expect(screen.getByTestId('listing-qr-sheet-unpublished')).toBeInTheDocument();
            expect(screen.queryByTestId('listing-qr-sheet-download')).not.toBeInTheDocument();
            // And nothing was asked of the API: the panel does not learn this
            // from a 404, it is told.
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('treats an older answer with no hasPublicPage as NOT published', () => {
            // Fail closed. Falling back to `isPublic` is precisely the
            // single-clause bug the field was added to remove.
            render(
                <ListingActions
                    listing={buildListing({ isPublic: true, completeness: null })}
                    locale="es"
                />
            );

            expect(screen.getByTestId('listing-qr-sheet-unpublished')).toBeInTheDocument();
            expect(screen.queryByTestId('listing-qr-sheet-download')).not.toBeInTheDocument();
        });
    });

    describe('draft-incomplete state (AC-21)', () => {
        it('does NOT offer the printable QR sheet — its code would resolve to a 404', () => {
            render(
                <ListingActions
                    listing={buildListing({
                        completeness: { complete: false, missing: ['summary'] }
                    })}
                    locale="es"
                />
            );

            expect(screen.queryByTestId('listing-qr-sheet')).not.toBeInTheDocument();
            expect(screen.queryByTestId('listing-qr-sheet-download')).not.toBeInTheDocument();
        });

        it('renders the missing checklist', () => {
            render(
                <ListingActions
                    listing={buildListing({
                        completeness: { complete: false, missing: ['summary', 'contactInfo'] }
                    })}
                    locale="es"
                />
            );

            const checklist = screen.getByTestId('listing-checklist');
            expect(checklist).toHaveTextContent('Resumen');
            expect(checklist).toHaveTextContent('Un dato de contacto (teléfono o email)');
        });

        it('always renders the checklist for an incomplete draft', () => {
            render(
                <ListingActions
                    listing={buildListing({
                        completeness: { complete: false, missing: ['name'] }
                    })}
                    locale="es"
                />
            );

            expect(screen.getByTestId('listing-checklist')).toBeInTheDocument();
        });
    });

    describe('draft-complete state', () => {
        it('reports the draft is ready and renders no checklist', () => {
            render(
                <ListingActions
                    listing={buildListing({ completeness: { complete: true, missing: [] } })}
                    locale="es"
                />
            );

            expect(screen.getByText('Borrador — listo para publicar')).toBeInTheDocument();
            expect(screen.queryByTestId('listing-checklist')).not.toBeInTheDocument();
        });
    });

    describe('unknown state', () => {
        it('renders a generic unavailable badge when completeness could not be determined', () => {
            render(
                <ListingActions
                    listing={buildListing({ completeness: null })}
                    locale="es"
                />
            );

            expect(screen.getByText('Estado no disponible')).toBeInTheDocument();
        });
    });
});
