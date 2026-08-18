/**
 * @file accommodation-field-ids.test.tsx
 * @description HOS-385's derived-field-id guard, rehomed onto the split editor
 * (HOS-318 T-027 / R-1).
 *
 * The guard itself is unchanged in intent: every Zod key that has a focusable
 * control must render that control under the id `buildFieldId` derives, or
 * `focusFirstInvalidField` silently does nothing and a failed submit strands the
 * host with no visible cause.
 *
 * What changed is WHERE it renders. There is no single editor component any
 * more, so each key is asserted against the form island that now owns it. The
 * `SECTION_OF` map below is the new part, and it is itself guarded: the suite
 * asserts it partitions the schema exactly, so a key cannot quietly fall out of
 * coverage by being assigned to no page.
 */

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccommodationEditFormSchema } from '@/components/host/editor/accommodation-edit-form.schema';
import {
    ACCOMMODATION_FIELD_ID_SUFFIXES,
    ACCOMMODATION_FIELD_PREFIX
} from '@/components/host/editor/field-ids';
import { BasicsForm } from '@/components/host/editor/forms/BasicsForm.client';
import { CapacityPricingForm } from '@/components/host/editor/forms/CapacityPricingForm.client';
import { ContactForm } from '@/components/host/editor/forms/ContactForm.client';
import { LocationForm } from '@/components/host/editor/forms/LocationForm.client';
import { SeoForm } from '@/components/host/editor/forms/SeoForm.client';
import { ServicesForm } from '@/components/host/editor/forms/ServicesForm.client';
import { buildFieldId } from '@/lib/forms/build-field-id';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { update: vi.fn().mockResolvedValue({ ok: true, data: {} }) }
}));

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

// The map island cannot render in jsdom; the picker's own inputs still do.
vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: () => null
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
    street: 'Av. Belgrano',
    number: '123',
    floor: '',
    apartment: '',
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    beds: 3,
    minNights: 2,
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
    youtubeUrl: '',
    seoTitle: '',
    seoDescription: '',
    videos: []
    // biome-ignore lint/suspicious/noExplicitAny: test fixture stands in for the full entity
} as any;

const COMMON = {
    locale: 'es' as const,
    accommodationId: 'acc-123',
    initialData: MOCK_INITIAL_DATA
};
const DESTINATIONS = [
    { id: 'dest-456', name: 'Concepción del Uruguay', path: '/ar/litoral/cdu' }
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
] as any;
// SPEC-266 dropped the catalog `name` column: labels resolve from i18n by
// `slug`. A fixture carrying `name` instead throws inside `humanizeKey`.
// biome-ignore lint/suspicious/noExplicitAny: test fixture
const CATALOG = [{ id: 'am-1', slug: 'wifi', category: 'connectivity' }] as any;

/** Renders the form island that owns a given section. */
function renderSection(section: string) {
    switch (section) {
        case 'basics':
            return render(
                <BasicsForm
                    {...COMMON}
                    destinations={DESTINATIONS}
                />
            );
        case 'capacityPricing':
            return render(<CapacityPricingForm {...COMMON} />);
        case 'location':
            return render(<LocationForm {...COMMON} />);
        case 'services':
            return render(
                <ServicesForm
                    {...COMMON}
                    amenities={CATALOG}
                    features={CATALOG}
                />
            );
        case 'contact':
            return render(<ContactForm {...COMMON} />);
        case 'seo':
            return render(<SeoForm {...COMMON} />);
        default:
            throw new Error(`unknown section "${section}"`);
    }
}

// ---------------------------------------------------------------------------
// The key set
// ---------------------------------------------------------------------------

/**
 * Which form island renders each schema key's control.
 *
 * Note the ids stay derived from the ZOD key even for the social fields, where
 * the React state key is `facebookUrl` and the schema key is `facebook`. That
 * asymmetry is deliberate and predates this split: the id must match what
 * `focusFirstInvalidField` computes, and that runs off the Zod key it got the
 * error for.
 */
const SECTION_OF: Readonly<Record<string, { section: string; controlName?: string }>> = {
    name: { section: 'basics' },
    summary: { section: 'basics' },
    description: { section: 'basics' },
    type: { section: 'basics' },
    destinationId: { section: 'basics' },
    maxGuests: { section: 'capacityPricing' },
    bedrooms: { section: 'capacityPricing' },
    bathrooms: { section: 'capacityPricing' },
    basePrice: { section: 'capacityPricing' },
    minNights: { section: 'capacityPricing' },
    latitude: { section: 'location' },
    longitude: { section: 'location' },
    street: { section: 'location' },
    number: { section: 'location' },
    floor: { section: 'location' },
    apartment: { section: 'location' },
    phone: { section: 'contact' },
    whatsapp: { section: 'contact' },
    email: { section: 'contact' },
    website: { section: 'contact' },
    facebook: { section: 'contact' },
    instagram: { section: 'contact' },
    twitter: { section: 'contact' },
    linkedin: { section: 'contact' },
    tiktok: { section: 'contact' },
    youtube: { section: 'contact' },
    seoTitle: { section: 'seo' },
    seoDescription: { section: 'seo' }
};

/**
 * Schema keys that deliberately render no single focusable control, with the
 * reason. Each is asserted below to resolve to nothing, so this table cannot be
 * used to hide a field that does render one.
 */
const NO_SINGLE_CONTROL: Readonly<Record<string, string>> = {
    // Rendered as a static read-only `<p>` (BETA-137 hid the ARS/USD select
    // until multi-currency ships), so there is no control to focus.
    currency: 'static read-only indicator, not an editable control',
    // Checkbox GROUPS — many controls, one key, no single focus target.
    amenityIds: 'checkbox group in AmenitiesSection',
    featureIds: 'checkbox group in AmenitiesSection'
};

const ALL_SCHEMA_KEYS = Object.keys(AccommodationEditFormSchema.shape);
const FOCUSABLE_KEYS = ALL_SCHEMA_KEYS.filter((key) => !(key in NO_SINGLE_CONTROL));

/** The id a key's control must render — derived exactly as the sections do. */
function idFor(name: string): string {
    return buildFieldId({
        prefix: ACCOMMODATION_FIELD_PREFIX,
        name,
        suffix: ACCOMMODATION_FIELD_ID_SUFFIXES[name]
    });
}

/**
 * Whether an element is something a user can be sent to.
 *
 * Deliberately not `element.focus()` + `activeElement`: jsdom's focus model does
 * not honour `contenteditable`, so the rich-description branch would fail for a
 * jsdom limitation rather than a real defect.
 */
function isFocusableControl(element: HTMLElement): boolean {
    return (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) ||
        element.getAttribute('contenteditable') === 'true' ||
        element.hasAttribute('tabindex')
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('accommodation editor — derived field ids (HOS-385 AC-5, split per page)', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should cover every schema key exactly once', () => {
        // Guards the arithmetic the whole suite rests on: if the two sets ever
        // stop partitioning the schema, the per-key assertions could pass while
        // silently covering nothing.
        expect(FOCUSABLE_KEYS.length).toBeGreaterThan(0);
        expect(FOCUSABLE_KEYS.length + Object.keys(NO_SINGLE_CONTROL).length).toBe(
            ALL_SCHEMA_KEYS.length
        );
    });

    it('should assign every focusable key to a form island', () => {
        // The new failure mode the split introduces: a key that belongs to no
        // page renders nowhere, and every per-key test below would be skipped
        // rather than failing.
        for (const key of FOCUSABLE_KEYS) {
            expect(
                SECTION_OF[key],
                `schema key "${key}" is not assigned to any form page`
            ).toBeDefined();
        }
    });

    it('should not assign an exempt key to a page as if it had a control', () => {
        for (const key of Object.keys(NO_SINGLE_CONTROL)) {
            expect(SECTION_OF[key]).toBeUndefined();
        }
    });

    describe('every focusable Zod key resolves to a control on its own page', () => {
        for (const key of FOCUSABLE_KEYS) {
            const entry = SECTION_OF[key];
            const controlName = entry?.controlName ?? key;

            it(`should render a focusable control at "${idFor(controlName)}" for "${key}"`, () => {
                renderSection(entry?.section as string);

                const element = document.getElementById(idFor(controlName));

                expect(
                    element,
                    `Nothing renders id "${idFor(controlName)}" (derived from Zod key "${key}") ` +
                        `on the "${entry?.section}" page. focusFirstInvalidField would silently ` +
                        'do nothing for this field.'
                ).not.toBeNull();
                expect(
                    isFocusableControl(element as HTMLElement),
                    `id "${idFor(controlName)}" resolves to a <${(element as HTMLElement).tagName.toLowerCase()}>, ` +
                        'which cannot take focus.'
                ).toBe(true);
            });
        }
    });

    describe('exempt keys really have no control', () => {
        for (const [key, reason] of Object.entries(NO_SINGLE_CONTROL)) {
            it(`should render no control for "${key}" (${reason})`, () => {
                // Rendered on the page that would own it, if any did.
                const section = key === 'currency' ? 'capacityPricing' : 'services';
                renderSection(section);

                const element = document.getElementById(idFor(key));

                expect(
                    element === null || !isFocusableControl(element),
                    `"${key}" is exempt but DOES render a focusable control — remove the exemption.`
                ).toBe(true);
            });
        }
    });
});
