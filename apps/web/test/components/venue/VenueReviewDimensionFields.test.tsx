/**
 * @file VenueReviewDimensionFields.test.tsx
 * @description AC:6:10 / TEST:6.6:6 — the venue review form offers one
 * optional star row per dimension the public section map allows, and the POST
 * body carries `rating` only for the dimensions actually voted.
 *
 * The form is a native <dialog> island whose session resolves client-side, so
 * the mocks mirror `VenueReviewForm.test.tsx` (`setupDialogMocks` +
 * `buildAuthSnapshot`). The catalog is NOT mocked: `resolveOfferedReviewDimensions`
 * reads the real `REVIEW_RULES`, which is the contract under test.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthSnapshot } from '../../helpers/auth-session';

// ---------------------------------------------------------------------------
// Module mocks — same shape as VenueReviewForm.test.tsx
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) =>
            (
                ({
                    'review.dimensions.food': 'Comida',
                    'review.dimensions.service': 'Servicio',
                    'review.dimensions.ambiance': 'Ambiente',
                    'review.dimensions.value': 'Relación precio-calidad',
                    'review.form.dimensions.title': 'Calificá por aspecto',
                    'review.form.dimensions.optional': 'Opcional',
                    'review.form.dimensions.removeHint':
                        'Tocá de nuevo la estrella elegida para quitar tu voto'
                }) as Record<string, string>
            )[key] ??
            fallback ??
            key
    })
}));

vi.mock('@/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { error: unknown; locale: string; fallback: string }) =>
        fallback
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/venue/VenueReviewForm.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

import { VenueReviewDimensionFields } from '@/components/venue/VenueReviewDimensionFields.client';
import { VenueReviewForm } from '@/components/venue/VenueReviewForm.client';
import { resolveOfferedReviewDimensions } from '@/lib/venue/review-dimensions-view';

const DEFAULT_PROPS = {
    venueId: 'venue-123',
    venueName: 'La Parrilla de Juan',
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001',
    signInHref: '/es/auth/signin'
};

type FormProps = Parameters<typeof VenueReviewForm>[0];

function setupDialogMocks() {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
    });
}

function renderForm(overrides: Partial<FormProps> = {}) {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
    return render(
        <VenueReviewForm
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

function openDialog() {
    fireEvent.click(screen.getByRole('button', { name: /dejar reseña/i }));
}

function rateOverall(star = 5) {
    const group = screen.getByRole('radiogroup', { name: /calificación general/i });
    fireEvent.click(within(group).getByRole('radio', { name: `${star}` }));
}

function dimensionGroup(label: string): HTMLElement | null {
    return screen.queryByRole('radiogroup', { name: label });
}

function stubSuccessfulFetch() {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({})
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

async function submitAndReadBody(fetchMock: ReturnType<typeof vi.fn>): Promise<unknown> {
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    return JSON.parse(String(init.body));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('VenueReviewDimensionFields — offered dimensions (TEST:6.6:6)', () => {
    beforeEach(setupDialogMocks);

    it('renders one optional row per offered dimension', () => {
        render(
            <VenueReviewDimensionFields
                dimensions={resolveOfferedReviewDimensions({ vertical: 'venue' })}
                votes={{}}
                onVote={vi.fn()}
                disabled={false}
                locale="es"
            />
        );

        expect(screen.getByText('Calificá por aspecto')).toBeInTheDocument();
        expect(screen.getAllByRole('radiogroup')).toHaveLength(4);
        for (const label of ['Comida', 'Servicio', 'Ambiente', 'Relación precio-calidad']) {
            expect(screen.getByRole('radiogroup', { name: label })).toBeInTheDocument();
        }
        expect(screen.getAllByText('Opcional')).toHaveLength(4);
        expect(
            screen.getByText('Tocá de nuevo la estrella elegida para quitar tu voto')
        ).toBeInTheDocument();
    });

    it('offers the other three dimensions and no «Comida» when the bound section is absent', () => {
        renderForm({ sectionStates: { menu: { state: 'absent' } } });
        openDialog();

        expect(dimensionGroup('Servicio')).not.toBeNull();
        expect(dimensionGroup('Ambiente')).not.toBeNull();
        expect(dimensionGroup('Relación precio-calidad')).not.toBeNull();
        expect(dimensionGroup('Comida')).toBeNull();
    });

    it('offers all four dimensions when the bound section is available', () => {
        renderForm({ sectionStates: { menu: { state: 'available' } } });
        openDialog();

        expect(dimensionGroup('Comida')).not.toBeNull();
        expect(screen.getAllByRole('radiogroup')).toHaveLength(5); // overall + four
    });

    it('offers all four dimensions when the section map is missing', () => {
        renderForm();
        openDialog();

        expect(dimensionGroup('Comida')).not.toBeNull();
        expect(screen.getAllByRole('radiogroup')).toHaveLength(5);
    });
});

// ---------------------------------------------------------------------------
// POST body
// ---------------------------------------------------------------------------

describe('VenueReviewForm — dimension votes in the POST body (TEST:6.6:6)', () => {
    beforeEach(setupDialogMocks);
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends no rating key when no dimension is voted', async () => {
        const fetchMock = stubSuccessfulFetch();
        renderForm();
        openDialog();
        rateOverall();

        expect(await submitAndReadBody(fetchMock)).toEqual({ overallRating: 5 });
    });

    it('sends only the voted dimension and its integer value', async () => {
        const fetchMock = stubSuccessfulFetch();
        renderForm();
        openDialog();
        rateOverall();
        fireEvent.click(
            within(dimensionGroup('Servicio') as HTMLElement).getByRole('radio', { name: '4' })
        );

        expect(await submitAndReadBody(fetchMock)).toEqual({
            overallRating: 5,
            rating: { service: 4 }
        });
    });

    it('drops the key when the chosen star is tapped again', async () => {
        const fetchMock = stubSuccessfulFetch();
        renderForm();
        openDialog();
        rateOverall();
        const serviceStar = within(dimensionGroup('Servicio') as HTMLElement).getByRole('radio', {
            name: '4'
        });
        fireEvent.click(serviceStar);
        fireEvent.click(serviceStar);

        expect(await submitAndReadBody(fetchMock)).toEqual({ overallRating: 5 });
    });

    it('resets every vote after the dialog closes and reopens', async () => {
        renderForm();
        openDialog();
        const serviceStar = within(dimensionGroup('Servicio') as HTMLElement).getByRole('radio', {
            name: '4'
        });
        fireEvent.click(serviceStar);
        expect(serviceStar).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 250));
        });
        openDialog();

        expect(
            within(dimensionGroup('Servicio') as HTMLElement).getByRole('radio', { name: '4' })
        ).toHaveAttribute('aria-checked', 'false');
    });
});
