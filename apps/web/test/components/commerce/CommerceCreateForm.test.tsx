/**
 * @file CommerceCreateForm.test.tsx
 * @description RTL tests for the owner self-service commerce create form
 * island (HOS-166 §7.2, §8 point 2).
 *
 * Covers: pre-fill degrades to a fully empty, usable form when absent
 * (AC-10/AC-11/AC-12), successful submit calls the create endpoint and
 * redirects to the editor, validation blocks submit on missing required
 * fields, and the experience vertical additionally requires priceFrom/priceUnit.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceCreateForm } from '../../../src/components/commerce/CommerceCreateForm.client';
import type { CommerceListingDetail } from '../../../src/lib/commerce/owner-listings';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/commerce/CommerceCreateForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`
}));

vi.mock('../../../src/lib/commerce/owner-listings', () => ({
    createOwnerListing: vi.fn()
}));

import { createOwnerListing } from '../../../src/lib/commerce/owner-listings';

const mockCreate = vi.mocked(createOwnerListing);

const destinations = [{ id: 'dest-1', name: 'Concepción del Uruguay' }];

/**
 * Builds a minimal fake `createOwnerListing` success response. Only `id` is
 * read by the component (to build the editor redirect URL); the rest of
 * `CommerceListingDetail`'s many required fields are irrelevant to these
 * tests.
 *
 * TYPE-WORKAROUND: a real `CommerceListingDetail` (Gastronomy|Experience
 * union) has dozens of required fields unrelated to this test's assertions;
 * a double-cast keeps the fixture minimal instead of hand-filling every one.
 */
function fakeCreatedListing(id: string): CommerceListingDetail {
    return { id } as unknown as CommerceListingDetail;
}

beforeEach(() => {
    mockCreate.mockReset();
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

describe('CommerceCreateForm', () => {
    describe('D-4 pre-fill degradation (AC-10/AC-11/AC-12)', () => {
        it('renders a fully empty, usable form when no prefill is given', () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={destinations}
                />
            );

            expect(screen.getByLabelText('Nombre del comercio')).toHaveValue('');
        });

        it('pre-fills name from the prefill prop when one is provided', () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={destinations}
                    prefill={{ name: 'La Parrilla de Juan' }}
                />
            );

            expect(screen.getByLabelText('Nombre del comercio')).toHaveValue('La Parrilla de Juan');
        });

        it('lets the owner overwrite a pre-filled value freely', () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={destinations}
                    prefill={{ name: 'La Parrilla de Juan' }}
                />
            );

            const input = screen.getByLabelText('Nombre del comercio');
            fireEvent.change(input, { target: { value: 'Otro nombre' } });

            expect(input).toHaveValue('Otro nombre');
        });

        it('pre-fills destinationId from the prefill prop when one is provided (HOS-257)', () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={destinations}
                    prefill={{ name: 'La Parrilla de Juan', destinationId: 'dest-1' }}
                />
            );

            expect(screen.getByLabelText('Ciudad / Destino')).toHaveValue('dest-1');
        });

        it('lets the owner overwrite a pre-filled destinationId freely (AC-12)', () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={[...destinations, { id: 'dest-2', name: 'Colón' }]}
                    prefill={{ destinationId: 'dest-1' }}
                />
            );

            const select = screen.getByLabelText('Ciudad / Destino');
            fireEvent.change(select, { target: { value: 'dest-2' } });

            expect(select).toHaveValue('dest-2');
        });
    });

    describe('gastronomy submit', () => {
        it('submits a DRAFT create payload and redirects to the editor on success', async () => {
            mockCreate.mockResolvedValue({ ok: true, data: fakeCreatedListing('listing-1') });

            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={destinations}
                />
            );

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'La Parrilla de Juan' }
            });
            fireEvent.change(screen.getByLabelText('Categoría'), {
                target: { value: 'RESTAURANT' }
            });
            fireEvent.change(screen.getByLabelText('Resumen'), {
                target: { value: 'Parrilla tradicional a orillas del río' }
            });
            fireEvent.change(screen.getByLabelText('Descripción'), {
                target: {
                    value: 'Una parrilla familiar con más de 20 años de historia en la ciudad.'
                }
            });

            fireEvent.click(screen.getByTestId('commerce-create-submit'));

            await waitFor(() => {
                expect(mockCreate).toHaveBeenCalledTimes(1);
            });

            const call = mockCreate.mock.calls[0]?.[0];
            expect(call?.vertical).toBe('gastronomy');
            expect(call?.data).toMatchObject({ name: 'La Parrilla de Juan', type: 'RESTAURANT' });

            await waitFor(() => {
                expect(window.location.href).toContain(
                    '/mi-cuenta/comercio/gastronomy/listing-1/editar'
                );
            });
        });

        it('does not submit when required fields are missing', async () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={destinations}
                />
            );

            fireEvent.click(screen.getByTestId('commerce-create-submit'));

            await waitFor(() => {
                expect(mockCreate).not.toHaveBeenCalled();
            });
        });
    });

    describe('destinationsLoadFailed (judgment-day fix)', () => {
        it('shows an error message instead of silently hiding the destination select', () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={[]}
                    destinationsLoadFailed
                />
            );

            expect(screen.getByRole('alert')).toHaveTextContent(
                'No pudimos cargar el listado de ciudades / destinos.'
            );
            expect(screen.queryByLabelText('Ciudad / Destino')).not.toBeInTheDocument();
        });

        it('shows an empty-catalog message (not the load-failed one) when destinations legitimately loaded empty', () => {
            render(
                <CommerceCreateForm
                    vertical="gastronomy"
                    locale="es"
                    destinations={[]}
                />
            );

            // HOS-260: a genuinely empty catalog must not leave the required
            // destinationId field silently missing with zero explanation.
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Todavía no hay ciudades / destinos cargados.'
            );
            expect(screen.queryByLabelText('Ciudad / Destino')).not.toBeInTheDocument();
        });
    });

    describe('experience vertical', () => {
        it('renders the priceFrom/priceUnit fields (required at create for experience)', () => {
            render(
                <CommerceCreateForm
                    vertical="experience"
                    locale="es"
                    destinations={destinations}
                />
            );

            expect(screen.getByLabelText('Precio desde (centavos)')).toBeInTheDocument();
            expect(screen.getByLabelText('Unidad de precio')).toBeInTheDocument();
        });

        it('does not require priceFrom when isPriceOnRequest is checked', async () => {
            mockCreate.mockResolvedValue({ ok: true, data: fakeCreatedListing('listing-2') });

            render(
                <CommerceCreateForm
                    vertical="experience"
                    locale="es"
                    destinations={destinations}
                />
            );

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'City Tour CdU' }
            });
            fireEvent.change(screen.getByLabelText('Categoría'), {
                target: { value: 'TOUR_GUIDE' }
            });
            fireEvent.change(screen.getByLabelText('Resumen'), {
                target: { value: 'Recorré la ciudad con guías locales' }
            });
            fireEvent.change(screen.getByLabelText('Descripción'), {
                target: { value: 'Un tour guiado por el casco histórico de la ciudad, dos horas.' }
            });
            // priceUnit stays REQUIRED even when isPriceOnRequest is checked (the
            // create schema is not `.partial()` — see the component's inline
            // comment on the priceUnit select for why it is not disabled here).
            fireEvent.change(screen.getByLabelText('Unidad de precio'), {
                target: { value: 'per_day' }
            });
            fireEvent.click(screen.getByText('Precio a consultar'));

            fireEvent.click(screen.getByTestId('commerce-create-submit'));

            await waitFor(() => {
                expect(mockCreate).toHaveBeenCalledTimes(1);
            });

            const call = mockCreate.mock.calls[0]?.[0];
            expect(call?.data).toMatchObject({ priceFrom: 0, isPriceOnRequest: true });
        });
    });
});
