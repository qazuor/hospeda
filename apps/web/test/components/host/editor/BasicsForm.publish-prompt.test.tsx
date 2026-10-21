import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BasicsForm } from '@/components/host/editor/forms/BasicsForm.client';
import type { AccommodationEditData } from '@/lib/api/types';

const mockUpdate = vi.hoisted(() => vi.fn());
const mockSubscribeDestination = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { update: (...args: unknown[]) => mockUpdate(...args) },
    publishApi: { subscribeDestination: (...args: unknown[]) => mockSubscribeDestination(...args) }
}));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: () => null
}));
vi.mock('@/components/host/editor/BasicInfoSection.client', () => ({
    BasicInfoSection: ({
        data,
        onFieldChange
    }: {
        data: { description: string };
        onFieldChange: (field: string, value: string) => void;
    }) =>
        createElement('textarea', {
            'aria-label': 'Descripción',
            value: data.description,
            onChange: (event: { currentTarget: { value: string } }) =>
                onFieldChange('description', event.currentTarget.value)
        })
}));

const PLACEHOLDER =
    'Borrador en progreso. Completá la descripción del alojamiento desde el panel de administración antes de publicarlo.';
const INITIAL = {
    id: 'acc-1',
    name: 'Cabin',
    summary: 'A cabin summary that is long enough',
    description: PLACEHOLDER,
    type: 'CABIN',
    destinationId: 'dest-1',
    maxGuests: 4,
    minNights: 1,
    bedrooms: 2,
    bathrooms: 1,
    publicationStatus: 'DRAFT',
    amenityIds: [],
    featureIds: [],
    videos: [],
    latitude: null,
    longitude: null,
    street: '',
    number: '',
    floor: '',
    apartment: '',
    basePrice: 100,
    currency: 'ARS',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    seoTitle: '',
    seoDescription: ''
} as unknown as AccommodationEditData;
const destinations = [{ id: 'dest-1', name: 'City', path: '/city' }];

beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({ ok: true, data: {} });
    mockSubscribeDestination.mockResolvedValue({
        ok: true,
        data: { destination: 'PUBLISH', trialDays: 14 }
    });
});

async function saveDescription(
    initialData: AccommodationEditData,
    hasMainImage: boolean
): Promise<void> {
    const user = userEvent.setup();
    render(
        <BasicsForm
            locale="es"
            accommodationId="acc-1"
            initialData={initialData}
            destinations={destinations}
            hasMainImage={hasMainImage}
            trialDays={14}
        />
    );
    const description = screen.getByLabelText('Descripción');
    await user.clear(description);
    await user.type(
        description,
        'A genuine description of this welcoming cabin and its surroundings.'
    );
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
}

describe('TEST:1722:5 BasicsForm publish-ready prompt', () => {
    it('opens the dialog after saving the real description that was last missing', async () => {
        await saveDescription(INITIAL, true);
        await waitFor(() =>
            expect(mockSubscribeDestination).toHaveBeenCalledWith({ vertical: 'accommodation' })
        );
        expect(await screen.findByText(/Tu ficha ya está lista/i)).toBeInTheDocument();
    });

    it.each([
        [
            'a non-draft listing',
            { ...INITIAL, publicationStatus: 'PUBLISHED' } as AccommodationEditData,
            true
        ],
        ['a draft without the main photo', INITIAL, false]
    ])('does not open for %s', async (_caseName, initialData, hasMainImage) => {
        await saveDescription(initialData, hasMainImage);
        expect(mockSubscribeDestination).not.toHaveBeenCalled();
        expect(screen.queryByText(/Tu ficha ya está lista/i)).toBeNull();
    });
});
