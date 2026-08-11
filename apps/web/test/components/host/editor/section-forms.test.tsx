/**
 * @file section-forms.test.tsx
 * @description Behavioural tests for the five editor form pages
 * (HOS-318 T-030 / AC-6), rehomed from the deleted monolithic
 * `AccommodationEditor.test.tsx` (R-1).
 *
 * The single most valuable assertion here is a NEGATIVE one: editing one
 * section must never send another section's fields. Every form page holds the
 * whole entity for rendering — the section components take the complete object —
 * so a diff that walked the object instead of the page's own field list would
 * silently ship stale data and clobber whatever another tab just saved.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockAddToast = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { update: (...args: unknown[]) => mockUpdate(...args) }
}));

vi.mock('@/store/toast-store', () => ({ addToast: (...args: unknown[]) => mockAddToast(...args) }));

vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: () => null
}));

const { BasicsForm } = await import('@/components/host/editor/forms/BasicsForm.client');
const { CapacityPricingForm } = await import(
    '@/components/host/editor/forms/CapacityPricingForm.client'
);
const { ContactForm } = await import('@/components/host/editor/forms/ContactForm.client');
const { ServicesForm } = await import('@/components/host/editor/forms/ServicesForm.client');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INITIAL = {
    id: 'acc-123',
    name: 'Hotel Test',
    summary: 'Un hermoso hotel en el centro',
    description: 'Descripcion completa del hotel con todas sus comodidades.',
    type: 'HOTEL',
    destinationId: 'dest-456',
    latitude: -32.47,
    longitude: -58.23,
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    basePrice: 15000,
    currency: 'ARS',
    amenityIds: ['am-1'],
    featureIds: [],
    phone: '+54 9 343 1234567',
    whatsapp: '',
    email: 'contacto@hotel.com',
    website: 'https://hotel.com',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: ''
    // biome-ignore lint/suspicious/noExplicitAny: test fixture stands in for the full entity
} as any;

const COMMON = { locale: 'es' as const, accommodationId: 'acc-123', initialData: INITIAL };
// biome-ignore lint/suspicious/noExplicitAny: test fixture
const DESTINATIONS = [{ id: 'dest-456', name: 'Concepción del Uruguay', path: '/x' }] as any;
// SPEC-266: the catalog is keyed by slug; `name` was dropped.
// biome-ignore lint/suspicious/noExplicitAny: test fixture
const CATALOG = [{ id: 'am-1', slug: 'wifi', category: null }] as any;

/** The body of the first PATCH the mocked API received. */
function firstPatchBody(): Record<string, unknown> {
    return mockUpdate.mock.calls[0][0].data as Record<string, unknown>;
}

/** Submits the form the given element belongs to. */
function submitFrom(element: HTMLElement) {
    fireEvent.submit(element.closest('form') as HTMLFormElement);
}

beforeEach(() => {
    mockUpdate.mockResolvedValue({ ok: true, data: {} });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Cross-section isolation — the regression the split could introduce
// ---------------------------------------------------------------------------

describe('per-section saving does not leak fields across pages (AC-6)', () => {
    it('should send ONLY the price when editing capacity and price', async () => {
        const user = userEvent.setup();
        render(<CapacityPricingForm {...COMMON} />);

        const price = screen.getByLabelText(/precio/i) as HTMLInputElement;
        await user.clear(price);
        await user.type(price, '30000');
        submitFrom(price);

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

        const body = firstPatchBody();
        expect(body).toHaveProperty('basePrice');
        expect(body).not.toHaveProperty('name');
        expect(body).not.toHaveProperty('email');
        expect(body).not.toHaveProperty('amenityIds');
        expect(body).not.toHaveProperty('latitude');
    });

    it('should send ONLY the name when editing basic data', async () => {
        const user = userEvent.setup();
        render(
            <BasicsForm
                {...COMMON}
                destinations={DESTINATIONS}
            />
        );

        const name = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(name);
        await user.type(name, 'Hotel Renombrado');
        submitFrom(name);

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

        const body = firstPatchBody();
        expect(body).toEqual({ name: 'Hotel Renombrado' });
    });

    it('should send ONLY the amenity ids when editing services', async () => {
        const user = userEvent.setup();
        render(
            <ServicesForm
                {...COMMON}
                amenities={CATALOG}
                features={CATALOG}
            />
        );

        const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
        await user.click(checkbox);
        submitFrom(checkbox);

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

        const body = firstPatchBody();
        expect(Object.keys(body).every((key) => key === 'amenityIds' || key === 'featureIds')).toBe(
            true
        );
        expect(body).not.toHaveProperty('basePrice');
    });
});

// ---------------------------------------------------------------------------
// Save feedback
// ---------------------------------------------------------------------------

describe('save feedback', () => {
    it('should show the no-changes toast and NOT call the API on an unchanged form', async () => {
        // Never save silently (HOS-190): Save must always visibly do something.
        render(<CapacityPricingForm {...COMMON} />);

        const price = screen.getByLabelText(/precio/i) as HTMLInputElement;
        submitFrom(price);

        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }))
        );
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should show a success toast after a successful save', async () => {
        const user = userEvent.setup();
        render(
            <BasicsForm
                {...COMMON}
                destinations={DESTINATIONS}
            />
        );

        const name = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(name);
        await user.type(name, 'Otro nombre');
        submitFrom(name);

        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
        );
    });

    it('should resync the baseline so reverting a just-saved field saves again (HOS-190 F6)', async () => {
        // Diffing against the load-time props instead means reverting a
        // just-saved field produces an empty diff while the DB still holds the
        // new value — the change could not be undone without a page reload.
        const user = userEvent.setup();
        render(
            <BasicsForm
                {...COMMON}
                destinations={DESTINATIONS}
            />
        );

        const name = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(name);
        await user.type(name, 'Nombre nuevo');
        submitFrom(name);
        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));

        await user.clear(name);
        await user.type(name, 'Hotel Test');
        submitFrom(name);

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
        expect(mockUpdate.mock.calls[1][0].data).toEqual({ name: 'Hotel Test' });
    });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validation blocks the save', () => {
    it('should not call the API when the name is cleared', async () => {
        const user = userEvent.setup();
        render(
            <BasicsForm
                {...COMMON}
                destinations={DESTINATIONS}
            />
        );

        const name = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(name);
        submitFrom(name);

        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        );
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should not call the API when the email is invalid', async () => {
        // HOS-190 regression: contact validation used to be unreachable because
        // the editor only validated four fields.
        const user = userEvent.setup();
        render(<ContactForm {...COMMON} />);

        const email = screen.getByLabelText(/email/i) as HTMLInputElement;
        await user.clear(email);
        await user.type(email, 'no-es-un-email');
        submitFrom(email);

        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        );
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Social field name translation
// ---------------------------------------------------------------------------

describe('social fields', () => {
    it('should send the bare platform name, not the form-local <network>Url key', async () => {
        const user = userEvent.setup();
        render(<ContactForm {...COMMON} />);

        const twitter = document.getElementById('acc-twitter') as HTMLInputElement;
        await user.type(twitter, 'hospeda');
        submitFrom(twitter);

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

        const body = firstPatchBody();
        expect(body).toHaveProperty('twitter');
        expect(body).not.toHaveProperty('twitterUrl');
    });

    it('should not send untouched social fields', async () => {
        const user = userEvent.setup();
        render(<ContactForm {...COMMON} />);

        const twitter = document.getElementById('acc-twitter') as HTMLInputElement;
        await user.type(twitter, 'hospeda');
        submitFrom(twitter);

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

        const body = firstPatchBody();
        expect(body).not.toHaveProperty('facebook');
        expect(body).not.toHaveProperty('instagram');
    });
});
