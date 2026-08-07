/**
 * @file accommodation-field-ids.test.tsx
 * @description HOS-385 AC-5 — proves the id DERIVATION and the RENDER agree,
 * by mounting the accommodation editor and resolving every Zod key against the
 * real DOM.
 *
 * ## Why this replaces the old guard
 *
 * `test/lib/forms/field-input-id-contract.test.ts` checked the same contract by
 * text-searching the section sources for `id="acc-name"`. That worked while ids
 * were literals. It cannot work now: the sections call `buildFieldId`, so there
 * are no literals left to find, and every accommodation row of that guard fails
 * for a reason that has nothing to do with correctness.
 *
 * Mounting is also strictly stronger. A text search proves a string appears
 * SOMEWHERE in a file; it says nothing about whether the element renders, in
 * which branch, or whether it is a control at all. This resolves the id the way
 * `focusFirstInvalidField` does — `document.getElementById` — against the DOM the
 * host actually sees.
 *
 * ## Why it is driven by the schema, not by a list
 *
 * The key set comes from `AccommodationEditFormSchema.shape`, minus an explicit
 * exemption table. That direction is deliberate and fail-CLOSED: a field added
 * to the schema is covered by default, and lands here as a failure until someone
 * either renders it with a derived id or exempts it on the record. A hand-written
 * include-list would have the opposite failure mode — a forgotten row is silent
 * lost coverage, which is exactly the shape of bug this spec exists to kill.
 *
 * The exemptions get the same rigour as the coverage: each one is asserted to
 * resolve to NOTHING, so an exemption cannot be used to park a field that really
 * does render a control.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccommodationEditorProps } from '@/components/host/AccommodationEditor.client';
import {
    AccommodationEditFormSchema,
    AccommodationEditor
} from '@/components/host/AccommodationEditor.client';
import {
    ACCOMMODATION_FIELD_ID_SUFFIXES,
    ACCOMMODATION_FIELD_PREFIX
} from '@/components/host/editor/field-ids';
import { buildFieldId } from '@/lib/forms/build-field-id';

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

// Leaflet initialises a real map in a `useEffect` and races RTL's synchronous
// cleanup in jsdom (see the note in `AccommodationEditor.test.tsx`). The map is
// not a field and holds no id, so stubbing it costs this suite nothing.
vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: () => <div data-testid="mock-location-picker-map" />
}));

// Self-fetches its entitlement on mount; it renders a toggle, not a schema
// field. Stubbed for the same stability reason as above.
vi.mock('@/components/host/editor/FeaturedToggleSection.client', () => ({
    FeaturedToggleSection: () => <div data-testid="mock-featured-toggle-section" />
}));

/**
 * Entitlements decide which CONTROL `description` renders as, so this suite
 * drives them per test rather than pinning them: the id has to resolve in both
 * branches, and only one of them exists at a time.
 */
let entitled = false;
vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: () => entitled,
        isLoading: false,
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

const DEFAULT_PROPS: AccommodationEditorProps = {
    locale: 'es',
    accommodationId: 'acc-123',
    initialData: MOCK_INITIAL_DATA,
    destinations: [{ id: 'dest-456', name: 'Concepción del Uruguay', path: '/ar/litoral/cdu' }],
    amenities: [{ id: 'am-1', name: 'WiFi', category: 'connectivity' }],
    features: [{ id: 'ft-1', name: 'Vista al río', category: null }]
};

// ---------------------------------------------------------------------------
// The key set
// ---------------------------------------------------------------------------

/**
 * Schema keys the editor deliberately does NOT render as a single focusable
 * control, with the reason. Each is asserted below to resolve to nothing, so
 * this table cannot be used to hide a field that does render one.
 */
const NO_SINGLE_CONTROL: Readonly<Record<string, string>> = {
    // Rendered as a static read-only `<p>` (BETA-137 hid the ARS/USD select
    // until multi-currency ships), so there is no control to focus.
    currency: 'static read-only indicator, not an editable control',
    // Accepted by the PATCH schema but the editor exposes no input for it; the
    // location section edits coordinates, not a postal address.
    address: 'not exposed by this editor',
    // Availability and pet policy are not part of the editor form.
    isAvailable: 'not exposed by this editor',
    allowsPets: 'not exposed by this editor',
    // Checkbox GROUPS — many controls, one key, no single focus target.
    amenityIds: 'checkbox group in AmenitiesSection',
    featureIds: 'checkbox group in AmenitiesSection',
    // Managed by PhotoSection's uploader, not by a labelled form control.
    media: 'media uploader, not a labelled control'
};

const ALL_SCHEMA_KEYS = Object.keys(AccommodationEditFormSchema.shape);
const FOCUSABLE_KEYS = ALL_SCHEMA_KEYS.filter((key) => !(key in NO_SINGLE_CONTROL));

/** The id the editor must render for a key — derived exactly as the sections do. */
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
 * jsdom limitation rather than a real defect. This asserts the property that
 * actually matters — the id resolves to a control, not to a `<div>` or a label.
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

describe('accommodation editor — derived field ids (HOS-385 AC-5)', () => {
    beforeEach(() => {
        entitled = false;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should cover every schema key exactly once', () => {
        // Guards the arithmetic this whole suite rests on: if the two sets ever
        // stop partitioning the schema, the per-key assertions below could pass
        // while silently covering nothing.
        expect(FOCUSABLE_KEYS.length).toBeGreaterThan(0);
        expect(FOCUSABLE_KEYS.length + Object.keys(NO_SINGLE_CONTROL).length).toBe(
            ALL_SCHEMA_KEYS.length
        );
    });

    describe('every focusable Zod key resolves to a control', () => {
        for (const key of FOCUSABLE_KEYS) {
            it(`should render a focusable control at "${idFor(key)}" for "${key}"`, () => {
                render(<AccommodationEditor {...DEFAULT_PROPS} />);

                const element = document.getElementById(idFor(key));

                expect(
                    element,
                    `Nothing renders id "${idFor(key)}" (derived from Zod key "${key}"). ` +
                        'focusFirstInvalidField would silently do nothing for this field.'
                ).not.toBeNull();
                expect(
                    isFocusableControl(element as HTMLElement),
                    `id "${idFor(key)}" resolves to a <${(element as HTMLElement).tagName.toLowerCase()}>, ` +
                        'which cannot take focus.'
                ).toBe(true);
            });
        }
    });

    describe('exempt keys really have no control', () => {
        for (const [key, reason] of Object.entries(NO_SINGLE_CONTROL)) {
            it(`should render no control for "${key}" (${reason})`, () => {
                render(<AccommodationEditor {...DEFAULT_PROPS} />);

                expect(
                    document.getElementById(idFor(key)),
                    `"${key}" is listed as having no single control, but id "${idFor(key)}" ` +
                        'resolves. Remove it from NO_SINGLE_CONTROL so it gets covered.'
                ).toBeNull();
            });
        }
    });

    it('should focus the offending control on a failed submit', () => {
        // The two halves above are each proven in isolation: the sections
        // RENDER `buildFieldId(key)`, and `focusFirstInvalidField` RESOLVES
        // `buildFieldId(key)`. Neither proves the editor hands the hook the
        // right namespace — with `fieldIdPrefix: 'ce'` both would still pass
        // and focus would silently do nothing, which is precisely the failure
        // HOS-385 exists to remove. So assert the round trip once, end to end.
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        // `name` has a 3-character minimum, and it is the first field on the
        // page — so it is both invalid and the expected focus target.
        fireEvent.change(document.getElementById(idFor('name')) as HTMLElement, {
            target: { value: 'x' }
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

        expect(document.activeElement?.id).toBe(idFor('name'));
    });

    it('should resolve "description" in the rich-text branch too', () => {
        // `description` is the only key whose CONTROL depends on an entitlement:
        // a plain `<textarea>` without `can_use_rich_description`, a TipTap
        // contenteditable with it. The default-entitlement run above covers the
        // first branch; this covers the second, because focus has to land on
        // whichever one is mounted.
        entitled = true;
        render(<AccommodationEditor {...DEFAULT_PROPS} />);

        const element = document.getElementById(idFor('description'));

        expect(element).not.toBeNull();
        expect(element?.tagName).not.toBe('TEXTAREA');
        expect(isFocusableControl(element as HTMLElement)).toBe(true);
    });
});
