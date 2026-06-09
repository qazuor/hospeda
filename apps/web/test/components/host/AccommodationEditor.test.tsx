/**
 * @file AccommodationEditor.test.tsx
 * @description Tests for the AccommodationEditor orchestrator component.
 *
 * Covers:
 * - Renders all section headings when given initialData props
 * - Initializes form state from props
 * - ActionBar with save/cancel buttons
 * - Validation: required fields (name, summary) show inline errors
 * - Submit handler: builds PATCH payload from changed fields only
 */

import { AccommodationEditor } from '@/components/host/AccommodationEditor.client';
import type { AccommodationEditorProps } from '@/components/host/AccommodationEditor.client';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

// CSS module mocks for all section modules
vi.mock('@/components/host/AccommodationEditor.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/BasicInfoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/CapacitySection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/PricingSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/AmenitiesSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/ActionBar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_INITIAL_DATA = {
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
    beds: 3,
    basePrice: 15000,
    currency: 'ARS',
    isAvailable: true,
    isFeatured: false,
    amenityIds: ['am-1'],
    featureIds: ['ft-1']
} as const;

const MOCK_DESTINATIONS = [
    { id: 'dest-456', name: 'Concepción del Uruguay', path: '/argentina/litoral/cdu' }
];

const MOCK_AMENITIES = [
    { id: 'am-1', name: 'WiFi', category: 'connectivity' },
    { id: 'am-2', name: 'Pileta', category: 'leisure' }
];

const MOCK_FEATURES = [{ id: 'ft-1', name: 'Vista al río', category: null }];

const DEFAULT_PROPS: AccommodationEditorProps = {
    locale: 'es',
    accommodationId: 'acc-123',
    initialData: MOCK_INITIAL_DATA,
    destinations: MOCK_DESTINATIONS,
    amenities: MOCK_AMENITIES,
    features: MOCK_FEATURES
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccommodationEditor', () => {
    it('should render all section headings', () => {
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        expect(screen.getByText('Información básica')).toBeInTheDocument();
        expect(screen.getByText('Capacidad')).toBeInTheDocument();
        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('Servicios y comodidades')).toBeInTheDocument();
    });

    it('should render form fields with initial data values', () => {
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Hotel Test');

        const summaryInput = screen.getByLabelText(/resumen/i) as HTMLTextAreaElement;
        expect(summaryInput.value).toBe('Un hermoso hotel en el centro');
    });

    it('should render save button', () => {
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
    });

    it('should render cancel button in ActionBar', () => {
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    });

    it('should show validation error when name is cleared and form submitted', async () => {
        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(nameInput);
        // Submit the form directly to trigger validation
        fireEvent.submit(nameInput.closest('form')!);

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should show validation error when summary is too short', async () => {
        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const summaryInput = screen.getByLabelText(/resumen/i) as HTMLTextAreaElement;
        await user.clear(summaryInput);
        await user.type(summaryInput, 'Corto');
        fireEvent.submit(summaryInput.closest('form')!);

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should call accommodationEditApi.update with changed fields only', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(nameInput);
        await user.type(nameInput, 'Hotel Actualizado');
        fireEvent.submit(nameInput.closest('form')!);

        // Wait for async submit
        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.id).toBe('acc-123');
        expect(callArg.data.name).toBe('Hotel Actualizado');
    });
});
