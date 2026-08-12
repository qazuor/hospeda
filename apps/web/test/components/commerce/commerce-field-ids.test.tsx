/**
 * @file commerce-field-ids.test.tsx
 * @description HOS-385 AC-5 for the commerce owner editor — proves the id
 * DERIVATION and the RENDER agree, by mounting the editor and resolving every
 * Zod key against the real DOM.
 *
 * Companion to `test/components/host/accommodation-field-ids.test.tsx`; the
 * reasoning for mounting rather than text-searching sources lives there. Two
 * things differ here.
 *
 * ## Both verticals, because the form's SHAPE branches
 *
 * `PriceSection` is the only section whose fields depend on the vertical:
 * gastronomy edits `priceRange` + `menuUrl`, experience edits `priceFrom` +
 * `priceUnit`. So the schema, the key set and the exemptions are all
 * per-vertical, and a single-vertical run would leave half the price fields
 * unchecked while looking like full coverage.
 *
 * ## Nested keys have to be expanded
 *
 * `contactInfo` and `socialNetworks` are single OBJECT keys on the schema, but
 * `useZodForm` reports their failures as dotted paths (`contactInfo.workEmail`),
 * and those are the names `focusFirstInvalidField` receives. The object keys
 * themselves are exempt; their members are expanded from the two runtime key
 * arrays the editor already renders from, so this cannot cover a member the
 * editor does not claim to draw.
 */

import { ExperienceOwnerUpdateInputSchema, GastronomyOwnerUpdateInputSchema } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingEditor } from '@/components/commerce/CommerceListingEditor.client';
import { CONTACT_KEYS, SOCIAL_KEYS } from '@/components/commerce/editor/commerce-edit-data';
import {
    COMMERCE_FIELD_ID_SUFFIXES,
    COMMERCE_FIELD_PREFIX
} from '@/components/commerce/editor/field-ids';
import type { CommerceListingDetail } from '@/lib/commerce/owner-listings';
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

vi.mock('@/lib/api/client', () => ({ apiClient: { patch: vi.fn() } }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) },
    commerceMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } }),
        removeMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        setFeaturedMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } })
    }
}));

vi.mock('@/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('@/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

// NOTE: `RichTextEditor` is deliberately NOT mocked. The sibling suite stubs it
// with a bare `<textarea aria-label>` that carries NO id — which would make
// `richDescription` resolve to nothing here, or worse, resolve to an id the real
// component never renders. A mock kinder than the real component would immunise
// exactly the wiring this test exists to check.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';

const BASE_DATA = {
    id: 'abc',
    ownerId: 'owner-1',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    destinationId: DESTINATION_ID,
    description: 'Descripción original con suficiente longitud para pasar validación.',
    richDescription: 'old text'
} as unknown as CommerceListingDetail;

type Vertical = 'gastronomy' | 'experience';

function renderEditor(vertical: Vertical) {
    return render(
        <CommerceListingEditor
            vertical={vertical}
            listingId="abc"
            locale="es"
            initialData={BASE_DATA}
            destinations={[{ id: DESTINATION_ID, name: 'Concepción del Uruguay' }]}
        />
    );
}

// ---------------------------------------------------------------------------
// The key set
// ---------------------------------------------------------------------------

/**
 * Schema keys the editor deliberately does NOT render as a single focusable
 * control, with the reason. Each is asserted below to resolve to nothing, so
 * this table cannot be used to hide a field that does render one.
 */
const NO_SINGLE_CONTROL: Readonly<Record<string, string>> = {
    // Object blocks — their members are expanded into dotted keys instead.
    contactInfo: 'JSONB block; members covered as dotted keys',
    socialNetworks: 'JSONB block; members covered as dotted keys',
    // Not exposed in this owner surface.
    videos: 'not exposed by this editor',
    // Owned by the translation panel, which edits a parallel i18n structure.
    nameI18n: 'translation panel, not a field control',
    summaryI18n: 'translation panel, not a field control',
    descriptionI18n: 'translation panel, not a field control',
    richDescriptionI18n: 'translation panel, not a field control',
    // Checkbox GROUPS — many controls, one key, no single focus target.
    amenityIds: 'checkbox group in AmenitiesSection',
    featureIds: 'checkbox group in AmenitiesSection',
    // A bare toggle with no id: it gates priceFrom/priceUnit rather than
    // carrying its own validation message.
    isPriceOnRequest: 'unlabelled toggle, carries no error of its own'
};

const SCHEMA_BY_VERTICAL = {
    gastronomy: GastronomyOwnerUpdateInputSchema,
    experience: ExperienceOwnerUpdateInputSchema
} as const;

/** Every Zod path the editor can be handed for a vertical, dotted paths expanded. */
function allKeysFor(vertical: Vertical): string[] {
    return [
        ...Object.keys(SCHEMA_BY_VERTICAL[vertical].shape),
        ...CONTACT_KEYS.map((key) => `contactInfo.${key}`),
        ...SOCIAL_KEYS.map((key) => `socialNetworks.${key}`)
    ];
}

function focusableKeysFor(vertical: Vertical): string[] {
    return allKeysFor(vertical).filter((key) => !(key in NO_SINGLE_CONTROL));
}

/** The id the editor must render for a key — derived exactly as the sections do. */
function idFor(name: string): string {
    return buildFieldId({
        prefix: COMMERCE_FIELD_PREFIX,
        name,
        suffix: COMMERCE_FIELD_ID_SUFFIXES[name]
    });
}

/**
 * Whether an element is something a user can be sent to.
 *
 * Deliberately not `element.focus()` + `activeElement`: jsdom's focus model does
 * not honour `contenteditable`, so `richDescription` would fail for a jsdom
 * limitation rather than a real defect.
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

describe('commerce editor — derived field ids (HOS-385 AC-5)', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    for (const vertical of ['gastronomy', 'experience'] as const) {
        describe(vertical, () => {
            const focusable = focusableKeysFor(vertical);

            it('should cover every schema key exactly once', () => {
                const exemptHere = allKeysFor(vertical).filter((key) => key in NO_SINGLE_CONTROL);
                expect(focusable.length).toBeGreaterThan(0);
                expect(focusable.length + exemptHere.length).toBe(allKeysFor(vertical).length);
            });

            for (const key of focusable) {
                it(`should render a focusable control at "${idFor(key)}" for "${key}"`, () => {
                    renderEditor(vertical);

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

            it('should render no control for any exempt key', () => {
                renderEditor(vertical);

                for (const key of allKeysFor(vertical).filter((k) => k in NO_SINGLE_CONTROL)) {
                    expect(
                        document.getElementById(idFor(key)),
                        `"${key}" is listed as having no single control, but id "${idFor(key)}" ` +
                            'resolves. Remove it from NO_SINGLE_CONTROL so it gets covered.'
                    ).toBeNull();
                }
            });
        });
    }

    it('should focus the offending control on a failed submit', () => {
        // The two halves above are each proven in isolation: the sections
        // RENDER `buildFieldId(key)`, and `focusFirstInvalidField` RESOLVES
        // `buildFieldId(key)`. Neither proves the editor hands the hook the
        // right namespace — with `fieldIdPrefix: 'acc'` both would still pass
        // and focus would silently do nothing, which is precisely the failure
        // HOS-385 exists to remove. So assert the round trip once, end to end.
        renderEditor('gastronomy');

        // `summary` has a 10-character minimum. It is not the first field on
        // the page, which is the point: the helper picks the first INVALID
        // control in document order, not the first control.
        fireEvent.change(document.getElementById(idFor('summary')) as HTMLElement, {
            target: { value: 'corto' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(document.activeElement?.id).toBe(idFor('summary'));
    });
});
