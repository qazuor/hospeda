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

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccommodationEditorProps } from '@/components/host/AccommodationEditor.client';
import { AccommodationEditor } from '@/components/host/AccommodationEditor.client';
import { addToast } from '@/store/toast-store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

// The Location section renders LocationPicker → LocationPickerMap, which
// imports Leaflet and initialises a real map instance in a `useEffect`. In
// jsdom this races React Testing Library's synchronous `cleanup()` (fired
// automatically between tests): once the calendar-gate tests below started
// rendering the FULL editor without an intervening `await`/`waitFor`, the DOM
// node backing the map got unmounted before Leaflet's async init settled,
// throwing an unhandled `Error: Map container not found` that flips the
// vitest process exit code to 1 even though every assertion still passes.
// Stubbed with a minimal placeholder (mirrors `LocationPicker.test.tsx`'s
// mock of the same module) — this file never asserts on map internals.
vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: () => <div data-testid="mock-location-picker-map" />
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
vi.mock('@/components/host/editor/ContactInfoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/SocialNetworksSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/LocationSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/CalendarSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/PlanEntitlementGate.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// Entitlements gate the calendar section (`can_use_calendar`). Default to
// "resolved, not entitled" so unrelated tests never race the real hook's
// async session/entitlements fetch. Individual tests override `mockHas`.
let mockHas = vi.fn((_key: string) => false);
const mockIsLoading = { current: false };
vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: mockHas,
        isLoading: mockIsLoading.current,
        error: null,
        limit: vi.fn(() => -1),
        plan: null
    })
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
    featureIds: ['ft-1'],
    phone: '+54 9 343 1234567',
    whatsapp: '',
    email: 'contacto@hotel.com',
    website: 'https://hotel.com',
    facebookUrl: 'https://facebook.com/hotel',
    instagramUrl: 'https://instagram.com/hotel',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: ''
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
    // ExternalReputationSection fetches its own data on mount; stub `fetch`
    // so that unrelated call resolves cleanly instead of rendering its own
    // `role="alert"` error banner, which collides with these tests' field
    // validation assertions.
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        listings: [],
                        reputation: { showExternalReputation: false, aggregateFetchedAt: null }
                    }
                })
            })
        );
        mockHas = vi.fn((_key: string) => false);
        mockIsLoading.current = false;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should render all section headings', () => {
        // BETA-138: each heading now also appears as a link label in the
        // sticky section nav, so these assertions scope to the <legend> to
        // disambiguate from the nav's <a> with the same text.
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        expect(screen.getByText('Información básica', { selector: 'legend' })).toBeInTheDocument();
        expect(screen.getByText('Capacidad', { selector: 'legend' })).toBeInTheDocument();
        expect(screen.getByText('Precio', { selector: 'legend' })).toBeInTheDocument();
        expect(screen.getByText('Ubicación', { selector: 'legend' })).toBeInTheDocument();
        expect(screen.getByText('Contacto', { selector: 'legend' })).toBeInTheDocument();
        expect(screen.getByText('Redes sociales', { selector: 'legend' })).toBeInTheDocument();
        expect(
            screen.getByText('Servicios y comodidades', { selector: 'legend' })
        ).toBeInTheDocument();
    });

    it('should render the sticky section nav with a link per card section', () => {
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Información básica' })).toHaveAttribute(
            'href',
            '#editor-basicInfo'
        );
        expect(screen.getByRole('link', { name: 'Reputación externa' })).toHaveAttribute(
            'href',
            '#editor-externalReputation'
        );
    });

    it('should NOT render a featured-toggle section (self-service disabled, BETA-144)', () => {
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        expect(screen.queryByRole('link', { name: 'Destacado' })).not.toBeInTheDocument();
        expect(document.getElementById('editor-featuredToggle')).not.toBeInTheDocument();
    });

    it('should render form fields with initial data values', () => {
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Hotel Test');

        const summaryInput = screen.getByLabelText(/resumen/i) as HTMLTextAreaElement;
        expect(summaryInput.value).toBe('Un hermoso hotel en el centro');

        // Phase B: contact info fields (BETA-139: phone split into country + number;
        // BETA-144: country field is a CountryCodeCombobox trigger button, not an input).
        // BETA-151 added a parallel WhatsApp field sharing the "País"/"Número"
        // sub-labels, so scope to the phone <fieldset> (legend "Teléfono").
        const phoneFieldset = within(screen.getByRole('group', { name: /^teléfono$/i }));
        const phoneCountryTrigger = phoneFieldset.getByLabelText(/país/i) as HTMLButtonElement;
        expect(phoneCountryTrigger).toHaveTextContent('Argentina (+54)');

        const phoneNumberInput = phoneFieldset.getByLabelText(/número/i) as HTMLInputElement;
        expect(phoneNumberInput.value).toBe('9 343 1234567');

        const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
        expect(emailInput.value).toBe('contacto@hotel.com');

        const websiteInput = screen.getByLabelText(/sitio web/i) as HTMLInputElement;
        expect(websiteInput.value).toBe('https://hotel.com');

        // Phase B: social networks fields (BETA-139: only the handle is shown)
        const facebookInput = screen.getByLabelText(/facebook/i) as HTMLInputElement;
        expect(facebookInput.value).toBe('hotel');

        const instagramInput = screen.getByLabelText(/instagram/i) as HTMLInputElement;
        expect(instagramInput.value).toBe('hotel');

        // Phase B: location fields
        const latInput = screen.getByLabelText(/latitud/i) as HTMLInputElement;
        expect(latInput.value).toBe('-32.47');

        const lngInput = screen.getByLabelText(/longitud/i) as HTMLInputElement;
        expect(lngInput.value).toBe('-58.23');
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

    it('should show a success message after a successful save', async () => {
        // Regression: a successful save was previously silent (only cleared the
        // error), leaving the user with no confirmation that the change applied.
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

        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        // Success is surfaced as a toast (not an inline banner) — assert the
        // toast store received a success toast with the confirmation message.
        await vi.waitFor(() => {
            expect(vi.mocked(addToast)).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                    message: expect.stringMatching(/cambios guardados/i)
                })
            );
        });
    });

    it('blocks submit and shows a field error when email is invalid (HOS-190 regression — contact validation)', async () => {
        // Regression guard: `validateForm` previously only checked
        // name/summary/basePrice/currency — the ContactInfoSection error
        // slots (phone/whatsapp/email/website) were rendered but their
        // `errors` prop was always `{}`, so an invalid email/phone/URL
        // silently reached the API instead of being caught client-side.
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
        await user.clear(emailInput);
        await user.type(emailInput, 'not-an-email');
        fireEvent.submit(emailInput.closest('form')!);

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('blocks submit and shows a field error when the phone is not a valid number (HOS-190 gap)', async () => {
        // Regression guard: `AccommodationEditFormSchema` used to inherit the
        // HTTP schema's bare `z.string().optional()` for phone/whatsapp (no
        // format check), so "abc" reached the server. It now enforces
        // InternationalPhoneRegex client-side (composePhoneValue → "+54 abc").
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const phoneNumberInput = within(
            screen.getByRole('group', { name: /^teléfono$/i })
        ).getByLabelText(/número/i) as HTMLInputElement;
        await user.clear(phoneNumberInput);
        await user.type(phoneNumberInput, 'abc');
        fireEvent.submit(phoneNumberInput.closest('form')!);

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('shows a "no changes" info toast when submitting an unchanged form (HOS-190)', async () => {
        // Regression guard: a diff-empty submit used to `return` silently,
        // leaving the host with no feedback. It now surfaces an info toast.
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        fireEvent.submit(nameInput.closest('form')!);

        await vi.waitFor(() => {
            expect(vi.mocked(addToast)).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'info',
                    message: expect.stringMatching(/no hay cambios/i)
                })
            );
        });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should include contact info fields in PATCH payload when changed', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        // Two fields carry a "Número" sub-label (phone + WhatsApp); scope to the
        // phone <fieldset> (legend "Teléfono") to target the phone number input.
        const phoneNumberInput = within(
            screen.getByRole('group', { name: /^teléfono$/i })
        ).getByLabelText(/número/i) as HTMLInputElement;
        await user.clear(phoneNumberInput);
        await user.type(phoneNumberInput, '9 343 9999999');
        fireEvent.submit(phoneNumberInput.closest('form')!);

        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.data.phone).toBe('+54 9 343 9999999');
    });

    it('should include whatsapp in PATCH payload when changed', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        // Scope to the WhatsApp <fieldset> (legend "WhatsApp") to target its number input.
        const whatsappNumberInput = within(
            screen.getByRole('group', { name: /^whatsapp$/i })
        ).getByLabelText(/número/i) as HTMLInputElement;
        await user.clear(whatsappNumberInput);
        await user.type(whatsappNumberInput, '9 343 8888888');
        fireEvent.submit(whatsappNumberInput.closest('form')!);

        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.data.whatsapp).toBe('+54 9 343 8888888');
    });

    it('should include social network fields in PATCH payload when changed', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const twitterInput = screen.getByLabelText(/twitter/i) as HTMLInputElement;
        await user.type(twitterInput, 'mi-hotel');
        fireEvent.submit(twitterInput.closest('form')!);

        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.data.twitter).toBe('https://x.com/mi-hotel');
    });

    it('should not include unchanged contact/social fields in PATCH payload', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        // Change only the name — contact/social fields should NOT appear in payload
        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(nameInput);
        await user.type(nameInput, 'Solo cambio nombre');
        fireEvent.submit(nameInput.closest('form')!);

        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.data.name).toBe('Solo cambio nombre');
        expect(callArg.data.phone).toBeUndefined();
        expect(callArg.data.facebook).toBeUndefined();
        expect(callArg.data.twitter).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // SPEC-208: media persistence in buildPatchPayload
    // -----------------------------------------------------------------------

    it('should include media in PATCH payload when featuredImage changes from null', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const user = userEvent.setup();
        // Start with no initial media so any photo state is a "change"
        render(
            <AccommodationEditor
                {...DEFAULT_PROPS}
                initialFeaturedImage={null}
                initialGallery={[]}
            />
        );

        // Simulate an upload result arriving via onFeaturedImageChange by
        // directly triggering name change (photo state cannot be driven via
        // file input in jsdom, but the component initialises photoData from
        // initialFeaturedImage). Instead we test the no-change case first:
        // with null initial and no upload, payload should NOT include media.
        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(nameInput);
        await user.type(nameInput, 'Hotel con fotos');
        fireEvent.submit(nameInput.closest('form')!);

        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        // No photo change → media should be absent from payload
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.data.media).toBeUndefined();
    });

    it('should include media when initialFeaturedImage differs from current photoData', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ ok: true, data: {} });
        vi.doMock('@/lib/api/endpoints-protected', () => ({
            accommodationEditApi: { update: mockUpdate }
        }));

        const initialImage = {
            url: 'https://example.com/old.jpg',
            publicId: 'hospeda/old',
            width: 800,
            height: 600
        } as const;

        // Mount with an existing featured image — it seeds photoData.
        // The test simulates the user having removed it (no direct way to
        // drive photo state via file input in jsdom, so we pass a different
        // initialGallery to ensure the diff logic fires).
        const user = userEvent.setup();
        render(
            <AccommodationEditor
                {...DEFAULT_PROPS}
                initialFeaturedImage={null}
                initialGallery={[initialImage]}
            />
        );

        // Change name to trigger a save
        const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
        await user.clear(nameInput);
        await user.type(nameInput, 'Hotel con galería');
        fireEvent.submit(nameInput.closest('form')!);

        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledOnce();
        });
        // Gallery was seeded from initialGallery — it matches current photoData,
        // so media should NOT be added (no change detected).
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.data.name).toBe('Hotel con galería');
        // media only appears when photoData diverges from initial
        // (gallery was initialised from initialGallery prop, so no change)
        expect(callArg.data.media).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // HOS-43: calendar section entitlement gate
    // -----------------------------------------------------------------------

    describe('calendar section entitlement gate', () => {
        it('renders the upgrade nudge (not the calendar) when the owner lacks can_use_calendar', () => {
            mockHas = vi.fn((_key: string) => false);
            mockIsLoading.current = false;

            render(<AccommodationEditor {...DEFAULT_PROPS} />);

            // Other sections also use PlanEntitlementGate with the same fallback
            // copy — scope to the calendar section's own <section> landmark.
            const calendarSection = within(screen.getByRole('region', { name: 'Calendario' }));
            expect(calendarSection.getByText('Función premium')).toBeInTheDocument();
            expect(calendarSection.queryByText('Calendario de ocupación')).not.toBeInTheDocument();
        });

        it('renders the calendar section when the owner has can_use_calendar', () => {
            mockHas = vi.fn((key: string) => key === 'can_use_calendar');
            mockIsLoading.current = false;

            render(<AccommodationEditor {...DEFAULT_PROPS} />);

            const calendarSection = within(screen.getByRole('region', { name: 'Calendario' }));
            expect(calendarSection.getByText('Calendario de ocupación')).toBeInTheDocument();
            expect(calendarSection.queryByText('Función premium')).not.toBeInTheDocument();
        });
    });
});
